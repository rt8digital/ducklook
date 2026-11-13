import crypto from 'node:crypto';
import { decryptSecret, encryptSecret } from './crypto.ts';
import {
  applyRulesToMessage,
  db,
  getAppSettings,
  refreshFolderCounts,
  safeParseJson,
  serializeAccount,
  serializeFolder,
  serializeMessage,
} from './db.ts';
import { syncImapAccount, testImapConnection, updateImapFlags } from './protocols/imapClient.ts';
import { syncPop3Messages, testPop3Connection } from './protocols/pop3Client.ts';
import { sendSmtpMail, testSmtpConnection } from './protocols/smtpClient.ts';
import type { AccountRow, FolderRow, MessageRow, ParsedExternalMessage, SecurityMode } from './types.ts';

export interface ApiRequest {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  query?: Record<string, string | undefined>;
  body?: Record<string, unknown> | null;
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function fail(status: number, message: string): never {
  throw new ApiError(status, message);
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function uid(prefix: string): string {
  return `${prefix}-${crypto.randomBytes(6).toString('hex')}`;
}

function normalizeSubjectForThread(subject: string): string {
  return subject.replace(/^(re|fwd|fw)\s*:\s*/gi, '').trim().toLowerCase() || 'no-subject';
}

function resolveThreadId(accountId: string, msg: ParsedExternalMessage): string {
  if (msg.inReplyTo) {
    const parent = db
      .prepare('SELECT thread_id FROM messages WHERE account_id = ? AND message_id_header = ? LIMIT 1')
      .get(accountId, msg.inReplyTo) as { thread_id: string } | undefined;
    if (parent) return parent.thread_id;
  }
  const norm = normalizeSubjectForThread(msg.subject);
  const bySubject = db
    .prepare('SELECT thread_id, subject FROM messages WHERE account_id = ? ORDER BY date_ts DESC LIMIT 100')
    .all(accountId) as Array<{ thread_id: string; subject: string }>;
  for (const row of bySubject) {
    if (normalizeSubjectForThread(row.subject) === norm && norm !== 'no-subject') {
      return row.thread_id;
    }
  }
  return `thr-${crypto.randomBytes(5).toString('hex')}`;
}

function insertExternalMessage(
  accountId: string,
  folderId: string,
  msg: ParsedExternalMessage,
  isInbox: boolean
): string {
  const id = uid('msg');
  const threadId = resolveThreadId(accountId, msg);
  const isOther =
    /newsletter|digest|unsubscribe|no-reply|noreply|notifications@/i.test(msg.fromEmail) ||
    /digest|unsubscribe/i.test(msg.subject);

  db.prepare(`
    INSERT INTO messages (
      id, account_id, folder_id, remote_uid, remote_uidl, message_id_header,
      in_reply_to, references_header, thread_id, from_name, from_email,
      to_json, cc_json, bcc_json, reply_to_json, subject, snippet, text_body, html_body,
      raw_headers, date_ts, is_read, is_flagged, is_draft, focused_bucket, importance,
      categories_json, has_attachments, attachments_json, meeting_invite_json, snoozed_until, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    accountId,
    folderId,
    msg.remoteUid,
    msg.remoteUidl,
    msg.messageIdHeader,
    msg.inReplyTo,
    msg.referencesHeader,
    threadId,
    msg.fromName,
    msg.fromEmail,
    JSON.stringify(msg.to),
    JSON.stringify(msg.cc),
    JSON.stringify(msg.bcc),
    JSON.stringify(msg.replyTo),
    msg.subject,
    msg.snippet,
    msg.textBody,
    msg.htmlBody,
    msg.rawHeaders,
    msg.dateTs,
    msg.isRead ? 1 : 0,
    msg.isFlagged ? 1 : 0,
    0,
    isOther ? 'other' : 'focused',
    'normal',
    '[]',
    msg.attachments.length > 0 ? 1 : 0,
    JSON.stringify(msg.attachments),
    null,
    null,
    Date.now()
  );

  if (isInbox) {
    applyRulesToMessage(accountId, id);
  }
  return id;
}

async function performAccountSync(account: AccountRow): Promise<{ fetched: number; capabilities: string[] }> {
  if (account.protocol === 'local') {
    db.prepare('UPDATE accounts SET last_sync_at = ?, last_error = NULL WHERE id = ?').run(Date.now(), account.id);
    refreshFolderCounts(account.id);
    return { fetched: 0, capabilities: safeParseJson<string[]>(account.capabilities_json, []) };
  }

  const incomingPass = decryptSecret(account.incoming_pass_enc);

  if (account.protocol === 'pop3') {
    const inbox = db
      .prepare("SELECT id FROM folders WHERE account_id = ? AND role = 'inbox' LIMIT 1")
      .get(account.id) as { id: string } | undefined;
    if (!inbox) throw new Error('Account inbox folder missing');

    const existingRows = db
      .prepare('SELECT remote_uidl FROM messages WHERE account_id = ? AND remote_uidl IS NOT NULL')
      .all(account.id) as Array<{ remote_uidl: string }>;
    const existingUidls = new Set(existingRows.map((r) => r.remote_uidl));

    const { messages, capabilities } = await syncPop3Messages(
      {
        host: account.incoming_host,
        port: account.incoming_port,
        security: account.incoming_security,
        user: account.incoming_user,
        pass: incomingPass,
      },
      existingUidls,
      Boolean(account.leave_on_server)
    );

    const tx = db.transaction(() => {
      for (const m of messages) {
        insertExternalMessage(account.id, inbox.id, m, true);
      }
      db.prepare('UPDATE accounts SET last_sync_at = ?, last_error = NULL, capabilities_json = ? WHERE id = ?').run(
        Date.now(),
        JSON.stringify(capabilities),
        account.id
      );
    });
    tx();
    refreshFolderCounts(account.id);
    return { fetched: messages.length, capabilities };
  }

  const folderRows = db.prepare('SELECT * FROM folders WHERE account_id = ?').all(account.id) as FolderRow[];
  const folderByPath = new Map<string, FolderRow>();
  for (const f of folderRows) folderByPath.set(f.remote_path, f);

  const existingUidRows = db
    .prepare('SELECT folder_id, remote_uid FROM messages WHERE account_id = ? AND remote_uid IS NOT NULL')
    .all(account.id) as Array<{ folder_id: string; remote_uid: number }>;
  const folderIdToPath = new Map(folderRows.map((f) => [f.id, f.remote_path]));
  const existingUidsByPath = new Map<string, Set<number>>();
  for (const row of existingUidRows) {
    const p = folderIdToPath.get(row.folder_id);
    if (!p) continue;
    if (!existingUidsByPath.has(p)) existingUidsByPath.set(p, new Set());
    existingUidsByPath.get(p)!.add(row.remote_uid);
  }

  const { capabilities, folders } = await syncImapAccount(
    {
      host: account.incoming_host,
      port: account.incoming_port,
      security: account.incoming_security,
      user: account.incoming_user,
      pass: incomingPass,
    },
    existingUidsByPath
  );

  let fetchedCount = 0;
  const tx = db.transaction(() => {
    for (const remoteFolder of folders) {
      let localFolder = folderByPath.get(remoteFolder.path);
      if (!localFolder) {
        const newFolderId = uid('fld');
        const sortMap: Record<string, number> = {
          inbox: 1,
          drafts: 2,
          sent: 3,
          archive: 4,
          junk: 5,
          deleted: 6,
          custom: 10,
        };
        db.prepare(
          'INSERT INTO folders (id, account_id, name, remote_path, role, unread_count, total_count, sort_order) VALUES (?, ?, ?, ?, ?, 0, 0, ?)'
        ).run(
          newFolderId,
          account.id,
          remoteFolder.name,
          remoteFolder.path,
          remoteFolder.role,
          sortMap[remoteFolder.role] ?? 10
        );
        localFolder = {
          id: newFolderId,
          account_id: account.id,
          name: remoteFolder.name,
          remote_path: remoteFolder.path,
          role: remoteFolder.role,
          unread_count: 0,
          total_count: 0,
          sort_order: sortMap[remoteFolder.role] ?? 10,
        };
        folderByPath.set(remoteFolder.path, localFolder);
      }

      for (const m of remoteFolder.messages) {
        insertExternalMessage(account.id, localFolder.id, m, remoteFolder.role === 'inbox');
        fetchedCount += 1;
      }
    }
    db.prepare('UPDATE accounts SET last_sync_at = ?, last_error = NULL, capabilities_json = ? WHERE id = ?').run(
      Date.now(),
      JSON.stringify(capabilities),
      account.id
    );
  });
  tx();
  refreshFolderCounts(account.id);
  return { fetched: fetchedCount, capabilities };
}

function listAccounts() {
  return (db.prepare('SELECT * FROM accounts ORDER BY is_default DESC, name ASC').all() as AccountRow[]).map(
    serializeAccount
  );
}

function listFolders() {
  return (db.prepare('SELECT * FROM folders ORDER BY sort_order ASC, name ASC').all() as FolderRow[]).map(
    serializeFolder
  );
}

function serializeEvents() {
  const rows = db.prepare('SELECT * FROM calendar_events ORDER BY start_ts ASC').all() as Array<{
    id: string;
    account_id: string;
    title: string;
    description: string;
    location: string;
    start_ts: number;
    end_ts: number;
    all_day: number;
    category_color: string;
    attendees_json: string;
    is_online_meeting: number;
    meeting_link: string;
    recurrence: 'none' | 'daily' | 'weekly' | 'monthly';
    reminder_minutes: number;
    status: 'busy' | 'tentative' | 'free' | 'oof';
  }>;
  return rows.map((e) => ({
    id: e.id,
    accountId: e.account_id,
    title: e.title,
    description: e.description,
    location: e.location,
    startTs: e.start_ts,
    endTs: e.end_ts,
    allDay: Boolean(e.all_day),
    categoryColor: e.category_color,
    attendees: safeParseJson(e.attendees_json, []),
    isOnlineMeeting: Boolean(e.is_online_meeting),
    meetingLink: e.meeting_link,
    recurrence: e.recurrence,
    reminderMinutes: e.reminder_minutes,
    status: e.status,
  }));
}

function serializeContacts() {
  const rows = db.prepare('SELECT * FROM contacts ORDER BY is_favorite DESC, display_name ASC').all() as Array<{
    id: string;
    account_id: string;
    first_name: string;
    last_name: string;
    display_name: string;
    email: string;
    phone: string;
    company: string;
    job_title: string;
    department: string;
    location: string;
    notes: string;
    avatar_url: string | null;
    is_favorite: number;
    category: string;
  }>;
  return rows.map((c) => ({
    id: c.id,
    accountId: c.account_id,
    firstName: c.first_name,
    lastName: c.last_name,
    displayName: c.display_name,
    email: c.email,
    phone: c.phone,
    company: c.company,
    jobTitle: c.job_title,
    department: c.department,
    location: c.location,
    notes: c.notes,
    avatarUrl: c.avatar_url,
    isFavorite: Boolean(c.is_favorite),
    category: c.category,
  }));
}

function serializeTasks() {
  const rows = db
    .prepare('SELECT * FROM tasks ORDER BY is_completed ASC, is_important DESC, sort_order ASC, created_at DESC')
    .all() as Array<{
    id: string;
    account_id: string;
    title: string;
    notes: string;
    is_completed: number;
    is_important: number;
    due_date: number | null;
    list_name: 'My Day' | 'Tasks' | 'Flagged Email';
    linked_message_id: string | null;
    sort_order: number;
    created_at: number;
  }>;
  return rows.map((t) => ({
    id: t.id,
    accountId: t.account_id,
    title: t.title,
    notes: t.notes,
    isCompleted: Boolean(t.is_completed),
    isImportant: Boolean(t.is_important),
    dueDate: t.due_date,
    listName: t.list_name,
    linkedMessageId: t.linked_message_id,
    sortOrder: t.sort_order,
    createdAt: t.created_at,
  }));
}

function serializeRules() {
  const rows = db.prepare('SELECT * FROM rules ORDER BY name ASC').all() as Array<{
    id: string;
    account_id: string;
    name: string;
    enabled: number;
    condition_field: 'from' | 'subject' | 'body';
    condition_operator: 'contains' | 'equals';
    condition_value: string;
    action_type: 'move' | 'mark_read' | 'flag' | 'categorize' | 'delete';
    action_value: string;
  }>;
  return rows.map((r) => ({
    id: r.id,
    accountId: r.account_id,
    name: r.name,
    enabled: Boolean(r.enabled),
    conditionField: r.condition_field,
    conditionOperator: r.condition_operator,
    conditionValue: r.condition_value,
    actionType: r.action_type,
    actionValue: r.action_value,
  }));
}

function bootstrap() {
  return {
    accounts: listAccounts(),
    folders: listFolders(),
    events: serializeEvents(),
    contacts: serializeContacts(),
    tasks: serializeTasks(),
    rules: serializeRules(),
    settings: getAppSettings(),
  };
}

function listMessages(query: Record<string, string | undefined>) {
  const accountId = query.accountId ?? '';
  const folderId = query.folderId ?? '';
  const bucket = query.bucket ?? '';
  const q = (query.q ?? '').trim();
  const filter = query.filter ?? 'all';
  const sort = query.sort ?? 'date_desc';
  const scope = query.scope ?? 'folder';

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (scope !== 'all' && folderId) {
    conditions.push('folder_id = ?');
    params.push(folderId);
  } else if (accountId && scope !== 'all') {
    conditions.push('account_id = ?');
    params.push(accountId);
  }

  if (bucket === 'focused' || bucket === 'other') {
    conditions.push('focused_bucket = ?');
    params.push(bucket);
  }

  if (filter === 'unread') conditions.push('is_read = 0');
  if (filter === 'flagged') conditions.push('is_flagged = 1');
  if (filter === 'attachments') conditions.push('has_attachments = 1');

  if (q) {
    conditions.push('(subject LIKE ? OR from_name LIKE ? OR from_email LIKE ? OR text_body LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  let orderSql = 'ORDER BY date_ts DESC';
  if (sort === 'date_asc') orderSql = 'ORDER BY date_ts ASC';
  if (sort === 'sender') orderSql = 'ORDER BY from_name ASC, date_ts DESC';
  if (sort === 'subject') orderSql = 'ORDER BY subject ASC, date_ts DESC';

  const rows = db.prepare(`SELECT * FROM messages ${whereSql} ${orderSql} LIMIT 250`).all(...params) as MessageRow[];
  return { messages: rows.map((r) => serializeMessage(r, false)) };
}

function getMessageDetail(id: string) {
  const row = db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as MessageRow | undefined;
  if (!row) fail(404, 'Message not found');

  const threadRows = db
    .prepare('SELECT * FROM messages WHERE account_id = ? AND thread_id = ? ORDER BY date_ts ASC')
    .all(row.account_id, row.thread_id) as MessageRow[];

  return {
    message: serializeMessage(row, false),
    threadMessages: threadRows.map((r) => serializeMessage(r, false)),
  };
}

export function getAttachment(messageId: string, attachmentId: string) {
  const row = db.prepare('SELECT attachments_json FROM messages WHERE id = ?').get(messageId) as
    | { attachments_json: string }
    | undefined;
  if (!row) return null;
  const attachments = safeParseJson<
    Array<{ id: string; filename: string; contentType: string; size: number; contentBase64?: string }>
  >(row.attachments_json, []);
  return attachments.find((a) => a.id === attachmentId) ?? null;
}

async function sendMessage(body: Record<string, unknown>) {
  const accountId = asString(body.accountId);
  const draftId = (body.draftId as string | null | undefined) ?? null;
  const to = ((body.to as Array<{ name?: string; address: string }>) ?? []).map((p) => ({
    name: p.name ?? '',
    address: p.address,
  }));
  const cc = ((body.cc as Array<{ name?: string; address: string }>) ?? []).map((p) => ({
    name: p.name ?? '',
    address: p.address,
  }));
  const bcc = ((body.bcc as Array<{ name?: string; address: string }>) ?? []).map((p) => ({
    name: p.name ?? '',
    address: p.address,
  }));
  const subject = asString(body.subject);
  const htmlBody = asString(body.htmlBody);
  const textBody = asString(body.textBody);
  const inReplyTo = (body.inReplyTo as string | null | undefined) ?? null;
  const referencesHeader = (body.referencesHeader as string | null | undefined) ?? null;
  const threadId = (body.threadId as string | null | undefined) ?? null;
  const importance = asString(body.importance, 'normal');
  const attachments =
    (body.attachments as Array<{ filename: string; contentType: string; size?: number; contentBase64?: string }>) ?? [];

  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId) as AccountRow | undefined;
  if (!account) fail(404, 'Account not found');
  if (!Array.isArray(to) || to.length === 0) fail(400, 'At least one recipient in "To" is required.');

  let messageIdHeader = `<${uid('sent')}@${account.email.split('@')[1] || 'ducklook.local'}>`;

  if (account.protocol === 'imap' || account.protocol === 'pop3') {
    const outgoingPass = decryptSecret(account.outgoing_pass_enc) || decryptSecret(account.incoming_pass_enc);
    const sent = await sendSmtpMail(
      {
        host: account.outgoing_host,
        port: account.outgoing_port,
        security: account.outgoing_security as SecurityMode,
        user: account.outgoing_user || account.incoming_user,
        pass: outgoingPass,
      },
      {
        fromName: account.name,
        fromEmail: account.email,
        to,
        cc,
        bcc,
        subject,
        htmlBody,
        textBody,
        inReplyTo,
        referencesHeader,
        attachments,
      }
    );
    messageIdHeader = sent.messageId;
  }

  const sentFolder = db
    .prepare("SELECT id FROM folders WHERE account_id = ? AND role = 'sent' LIMIT 1")
    .get(account.id) as { id: string } | undefined;

  const now = Date.now();
  const resolvedThread = threadId || `thr-${crypto.randomBytes(5).toString('hex')}`;
  const plainText = textBody || htmlBody.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const snippet = plainText.slice(0, 180);

  const rawHeaders = [
    `From: ${account.name} <${account.email}>`,
    `To: ${to.map((p) => (p.name ? `${p.name} <${p.address}>` : p.address)).join(', ')}`,
    cc.length
      ? `Cc: ${cc.map((p) => (p.name ? `${p.name} <${p.address}>` : p.address)).join(', ')}`
      : null,
    `Subject: ${subject}`,
    `Date: ${new Date(now).toUTCString()}`,
    `Message-ID: ${messageIdHeader}`,
    inReplyTo ? `In-Reply-To: ${inReplyTo}` : null,
    referencesHeader ? `References: ${referencesHeader}` : null,
    `MIME-Version: 1.0`,
  ]
    .filter(Boolean)
    .join('\r\n');

  const normalizedAtts = attachments.map((a, idx) => ({
    id: uid(`att${idx}`),
    filename: a.filename,
    contentType: a.contentType || 'application/octet-stream',
    size: a.size ?? (a.contentBase64 ? Buffer.from(a.contentBase64, 'base64').length : 0),
    contentBase64: a.contentBase64,
  }));

  const sentId = uid('msg');
  if (sentFolder) {
    db.prepare(`
      INSERT INTO messages (
        id, account_id, folder_id, remote_uid, remote_uidl, message_id_header,
        in_reply_to, references_header, thread_id, from_name, from_email,
        to_json, cc_json, bcc_json, reply_to_json, subject, snippet, text_body, html_body,
        raw_headers, date_ts, is_read, is_flagged, is_draft, focused_bucket, importance,
        categories_json, has_attachments, attachments_json, meeting_invite_json, snoozed_until, created_at
      ) VALUES (?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?, ?, ?, ?, ?, 1, 0, 0, 'focused', ?, '[]', ?, ?, NULL, NULL, ?)
    `).run(
      sentId,
      account.id,
      sentFolder.id,
      messageIdHeader,
      inReplyTo,
      referencesHeader,
      resolvedThread,
      account.name,
      account.email,
      JSON.stringify(to),
      JSON.stringify(cc),
      JSON.stringify(bcc),
      subject,
      snippet,
      plainText,
      htmlBody,
      rawHeaders,
      now,
      importance,
      normalizedAtts.length > 0 ? 1 : 0,
      JSON.stringify(normalizedAtts),
      now
    );
  }

  const allAccounts = db.prepare('SELECT * FROM accounts').all() as AccountRow[];
  const recipientEmails = [...to, ...cc, ...bcc].map((p) => p.address.toLowerCase());
  for (const targetAcc of allAccounts) {
    if (targetAcc.protocol === 'local' && recipientEmails.includes(targetAcc.email.toLowerCase())) {
      const targetInbox = db
        .prepare("SELECT id FROM folders WHERE account_id = ? AND role = 'inbox' LIMIT 1")
        .get(targetAcc.id) as { id: string } | undefined;
      if (targetInbox) {
        const deliveredId = uid('msg');
        db.prepare(`
          INSERT INTO messages (
            id, account_id, folder_id, remote_uid, remote_uidl, message_id_header,
            in_reply_to, references_header, thread_id, from_name, from_email,
            to_json, cc_json, bcc_json, reply_to_json, subject, snippet, text_body, html_body,
            raw_headers, date_ts, is_read, is_flagged, is_draft, focused_bucket, importance,
            categories_json, has_attachments, attachments_json, meeting_invite_json, snoozed_until, created_at
          ) VALUES (?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, '[]', '[]', ?, ?, ?, ?, ?, ?, 0, 0, 0, 'focused', ?, '[]', ?, ?, NULL, NULL, ?)
        `).run(
          deliveredId,
          targetAcc.id,
          targetInbox.id,
          `${messageIdHeader}.delivered`,
          inReplyTo,
          referencesHeader,
          resolvedThread,
          account.name,
          account.email,
          JSON.stringify(to),
          JSON.stringify(cc),
          subject,
          snippet,
          plainText,
          htmlBody,
          rawHeaders,
          now,
          importance,
          normalizedAtts.length > 0 ? 1 : 0,
          JSON.stringify(normalizedAtts),
          now
        );
        applyRulesToMessage(targetAcc.id, deliveredId);
      }
    }
  }

  if (draftId) {
    db.prepare('DELETE FROM messages WHERE id = ? AND is_draft = 1').run(draftId);
  }

  refreshFolderCounts();
  return { ok: true, id: sentId, messageIdHeader, folders: listFolders() };
}

function saveDraft(body: Record<string, unknown>) {
  const draftId = (body.draftId as string | null | undefined) ?? null;
  const accountId = asString(body.accountId);
  const to = (body.to as unknown[]) ?? [];
  const cc = (body.cc as unknown[]) ?? [];
  const bcc = (body.bcc as unknown[]) ?? [];
  const subject = asString(body.subject);
  const htmlBody = asString(body.htmlBody);
  const textBody = asString(body.textBody);
  const inReplyTo = (body.inReplyTo as string | null | undefined) ?? null;
  const referencesHeader = (body.referencesHeader as string | null | undefined) ?? null;
  const threadId = (body.threadId as string | null | undefined) ?? null;
  const importance = asString(body.importance, 'normal');

  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId) as AccountRow | undefined;
  if (!account) fail(404, 'Account not found');
  const draftsFolder = db
    .prepare("SELECT id FROM folders WHERE account_id = ? AND role = 'drafts' LIMIT 1")
    .get(account.id) as { id: string } | undefined;
  if (!draftsFolder) fail(400, 'Drafts folder missing');

  const now = Date.now();
  const plainText = textBody || htmlBody.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const snippet = plainText.slice(0, 180);

  if (draftId) {
    db.prepare(`
      UPDATE messages
      SET to_json = ?, cc_json = ?, bcc_json = ?, subject = ?, snippet = ?, text_body = ?, html_body = ?, date_ts = ?, importance = ?
      WHERE id = ? AND is_draft = 1
    `).run(
      JSON.stringify(to),
      JSON.stringify(cc),
      JSON.stringify(bcc),
      subject,
      snippet,
      plainText,
      htmlBody,
      now,
      importance,
      draftId
    );
    refreshFolderCounts(account.id);
    return { ok: true, id: draftId, folders: listFolders() };
  }

  const id = uid('msg');
  db.prepare(`
    INSERT INTO messages (
      id, account_id, folder_id, remote_uid, remote_uidl, message_id_header,
      in_reply_to, references_header, thread_id, from_name, from_email,
      to_json, cc_json, bcc_json, reply_to_json, subject, snippet, text_body, html_body,
      raw_headers, date_ts, is_read, is_flagged, is_draft, focused_bucket, importance,
      categories_json, has_attachments, attachments_json, meeting_invite_json, snoozed_until, created_at
    ) VALUES (?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?, ?, ?, '', ?, 1, 0, 1, 'focused', ?, '[]', 0, '[]', NULL, NULL, ?)
  `).run(
    id,
    account.id,
    draftsFolder.id,
    `<draft-${id}@ducklook.local>`,
    inReplyTo,
    referencesHeader,
    threadId || `thr-${crypto.randomBytes(5).toString('hex')}`,
    account.name,
    account.email,
    JSON.stringify(to),
    JSON.stringify(cc),
    JSON.stringify(bcc),
    subject,
    snippet,
    plainText,
    htmlBody,
    now,
    importance,
    now
  );

  refreshFolderCounts(account.id);
  return { ok: true, id, folders: listFolders() };
}

async function updateMessage(id: string, body: Record<string, unknown>) {
  const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as MessageRow | undefined;
  if (!msg) fail(404, 'Message not found');

  const { isRead, isFlagged, folderId, focusedBucket, categories, snoozedUntil } = body;

  if (typeof isRead === 'boolean') {
    db.prepare('UPDATE messages SET is_read = ? WHERE id = ?').run(isRead ? 1 : 0, msg.id);
    if (msg.remote_uid) {
      const acc = db.prepare('SELECT * FROM accounts WHERE id = ?').get(msg.account_id) as AccountRow | undefined;
      const fld = db.prepare('SELECT remote_path FROM folders WHERE id = ?').get(msg.folder_id) as
        | { remote_path: string }
        | undefined;
      if (acc?.protocol === 'imap' && fld) {
        updateImapFlags(
          {
            host: acc.incoming_host,
            port: acc.incoming_port,
            security: acc.incoming_security,
            user: acc.incoming_user,
            pass: decryptSecret(acc.incoming_pass_enc),
          },
          fld.remote_path,
          msg.remote_uid,
          isRead ? 'add' : 'remove',
          ['\\Seen']
        ).catch(() => {});
      }
    }
  }

  if (typeof isFlagged === 'boolean') {
    db.prepare('UPDATE messages SET is_flagged = ? WHERE id = ?').run(isFlagged ? 1 : 0, msg.id);
    if (msg.remote_uid) {
      const acc = db.prepare('SELECT * FROM accounts WHERE id = ?').get(msg.account_id) as AccountRow | undefined;
      const fld = db.prepare('SELECT remote_path FROM folders WHERE id = ?').get(msg.folder_id) as
        | { remote_path: string }
        | undefined;
      if (acc?.protocol === 'imap' && fld) {
        updateImapFlags(
          {
            host: acc.incoming_host,
            port: acc.incoming_port,
            security: acc.incoming_security,
            user: acc.incoming_user,
            pass: decryptSecret(acc.incoming_pass_enc),
          },
          fld.remote_path,
          msg.remote_uid,
          isFlagged ? 'add' : 'remove',
          ['\\Flagged']
        ).catch(() => {});
      }
    }
  }

  if (typeof folderId === 'string') {
    db.prepare('UPDATE messages SET folder_id = ? WHERE id = ?').run(folderId, msg.id);
  }

  if (focusedBucket === 'focused' || focusedBucket === 'other') {
    db.prepare('UPDATE messages SET focused_bucket = ? WHERE id = ?').run(focusedBucket, msg.id);
  }

  if (Array.isArray(categories)) {
    db.prepare('UPDATE messages SET categories_json = ? WHERE id = ?').run(JSON.stringify(categories), msg.id);
  }

  if (snoozedUntil !== undefined) {
    db.prepare('UPDATE messages SET snoozed_until = ? WHERE id = ?').run(snoozedUntil as number | null, msg.id);
  }

  refreshFolderCounts(msg.account_id);
  const updated = db.prepare('SELECT * FROM messages WHERE id = ?').get(msg.id) as MessageRow;
  return { message: serializeMessage(updated, false), folders: listFolders() };
}

function deleteMessage(id: string) {
  const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as MessageRow | undefined;
  if (!msg) fail(404, 'Message not found');

  const currentFolder = db.prepare('SELECT * FROM folders WHERE id = ?').get(msg.folder_id) as FolderRow | undefined;
  const trash = db
    .prepare("SELECT id FROM folders WHERE account_id = ? AND role = 'deleted' LIMIT 1")
    .get(msg.account_id) as { id: string } | undefined;

  if (currentFolder?.role === 'deleted' || !trash) {
    db.prepare('DELETE FROM messages WHERE id = ?').run(msg.id);
  } else {
    db.prepare('UPDATE messages SET folder_id = ? WHERE id = ?').run(trash.id, msg.id);
  }

  refreshFolderCounts(msg.account_id);
  return { ok: true, folders: listFolders() };
}

function bulkAction(body: Record<string, unknown>) {
  const ids = (body.ids as string[]) ?? [];
  const action = asString(body.action);
  const folderId = asString(body.folderId);
  const category = asString(body.category);

  if (!Array.isArray(ids) || ids.length === 0) fail(400, 'No message IDs specified');

  const tx = db.transaction(() => {
    for (const id of ids) {
      const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as MessageRow | undefined;
      if (!msg) continue;
      if (action === 'mark_read') db.prepare('UPDATE messages SET is_read = 1 WHERE id = ?').run(id);
      if (action === 'mark_unread') db.prepare('UPDATE messages SET is_read = 0 WHERE id = ?').run(id);
      if (action === 'flag') db.prepare('UPDATE messages SET is_flagged = 1 WHERE id = ?').run(id);
      if (action === 'unflag') db.prepare('UPDATE messages SET is_flagged = 0 WHERE id = ?').run(id);
      if (action === 'move' && folderId) db.prepare('UPDATE messages SET folder_id = ? WHERE id = ?').run(folderId, id);
      if (action === 'archive') {
        const arch = db
          .prepare("SELECT id FROM folders WHERE account_id = ? AND role = 'archive' LIMIT 1")
          .get(msg.account_id) as { id: string } | undefined;
        if (arch) db.prepare('UPDATE messages SET folder_id = ? WHERE id = ?').run(arch.id, id);
      }
      if (action === 'junk') {
        const junk = db
          .prepare("SELECT id FROM folders WHERE account_id = ? AND role = 'junk' LIMIT 1")
          .get(msg.account_id) as { id: string } | undefined;
        if (junk) db.prepare('UPDATE messages SET folder_id = ? WHERE id = ?').run(junk.id, id);
      }
      if (action === 'delete') {
        const fld = db.prepare('SELECT role FROM folders WHERE id = ?').get(msg.folder_id) as
          | { role: string }
          | undefined;
        const trash = db
          .prepare("SELECT id FROM folders WHERE account_id = ? AND role = 'deleted' LIMIT 1")
          .get(msg.account_id) as { id: string } | undefined;
        if (fld?.role === 'deleted' || !trash) {
          db.prepare('DELETE FROM messages WHERE id = ?').run(id);
        } else {
          db.prepare('UPDATE messages SET folder_id = ? WHERE id = ?').run(trash.id, id);
        }
      }
      if (action === 'categorize' && category) {
        const cats = safeParseJson<string[]>(msg.categories_json, []);
        const next = cats.includes(category) ? cats.filter((c) => c !== category) : [...cats, category];
        db.prepare('UPDATE messages SET categories_json = ? WHERE id = ?').run(JSON.stringify(next), id);
      }
    }
  });
  tx();
  refreshFolderCounts();
  return { ok: true, folders: listFolders() };
}

function createFolder(body: Record<string, unknown>) {
  const accountId = asString(body.accountId);
  const name = asString(body.name).trim();
  if (!accountId || !name) fail(400, 'Account and folder name required');
  const id = uid('fld');
  db.prepare(
    'INSERT INTO folders (id, account_id, name, remote_path, role, unread_count, total_count, sort_order) VALUES (?, ?, ?, ?, ?, 0, 0, 20)'
  ).run(id, accountId, name, name, 'custom');
  return { id, folders: listFolders() };
}

function emptyFolder(id: string) {
  db.prepare('DELETE FROM messages WHERE folder_id = ?').run(id);
  refreshFolderCounts();
  return { ok: true, folders: listFolders() };
}

function deleteFolder(id: string) {
  const fld = db.prepare('SELECT * FROM folders WHERE id = ?').get(id) as FolderRow | undefined;
  if (!fld) fail(404, 'Folder not found');
  if (fld.role !== 'custom') fail(400, 'System folders cannot be deleted');
  db.prepare('DELETE FROM folders WHERE id = ?').run(fld.id);
  return { ok: true, folders: listFolders() };
}

async function testAccount(body: Record<string, unknown>) {
  const protocol = asString(body.protocol);
  const incomingHost = asString(body.incomingHost);
  const incomingPort = Number(body.incomingPort);
  const incomingSecurity = body.incomingSecurity as SecurityMode;
  const incomingUser = asString(body.incomingUser);
  const incomingPass = asString(body.incomingPass);
  const outgoingHost = asString(body.outgoingHost);
  const outgoingPort = Number(body.outgoingPort);
  const outgoingSecurity = body.outgoingSecurity as SecurityMode;
  const outgoingUser = asString(body.outgoingUser);
  const outgoingPass = asString(body.outgoingPass);

  let incomingResult: unknown;
  if (protocol === 'pop3') {
    incomingResult = await testPop3Connection({
      host: incomingHost,
      port: incomingPort,
      security: incomingSecurity,
      user: incomingUser,
      pass: incomingPass,
    });
  } else if (protocol === 'imap') {
    incomingResult = await testImapConnection({
      host: incomingHost,
      port: incomingPort,
      security: incomingSecurity,
      user: incomingUser,
      pass: incomingPass,
    });
  } else {
    fail(400, 'Protocol must be imap or pop3');
  }

  let smtpOk = false;
  let smtpError: string | null = null;
  if (outgoingHost) {
    try {
      await testSmtpConnection({
        host: outgoingHost,
        port: outgoingPort,
        security: outgoingSecurity,
        user: outgoingUser || incomingUser,
        pass: outgoingPass || incomingPass,
      });
      smtpOk = true;
    } catch (err) {
      smtpError = (err as Error).message;
    }
  }

  return { ok: true, protocol, incoming: incomingResult, smtpOk, smtpError };
}

async function createAccount(body: Record<string, unknown>) {
  const name = asString(body.name);
  const email = asString(body.email);
  const protocol = asString(body.protocol);
  const incomingHost = asString(body.incomingHost);
  const incomingPort = Number(body.incomingPort);
  const incomingSecurity = body.incomingSecurity as SecurityMode;
  const incomingUser = asString(body.incomingUser);
  const incomingPass = asString(body.incomingPass);
  const outgoingHost = asString(body.outgoingHost);
  const outgoingPort = Number(body.outgoingPort);
  const outgoingSecurity = (body.outgoingSecurity as SecurityMode) || 'tls';
  const outgoingUser = asString(body.outgoingUser);
  const outgoingPass = asString(body.outgoingPass);
  const leaveOnServer = body.leaveOnServer === undefined ? true : Boolean(body.leaveOnServer);

  if (!name || !email || !protocol || !incomingHost) {
    fail(400, 'Name, email, protocol, and incoming server host are required.');
  }

  const count = db.prepare('SELECT COUNT(*) as cnt FROM accounts').get() as { cnt: number };
  const isDefault = count.cnt === 0 ? 1 : 0;
  const id = uid('acc');
  db.prepare(`
    INSERT INTO accounts (
      id, name, email, protocol, incoming_host, incoming_port, incoming_security,
      incoming_user, incoming_pass_enc, outgoing_host, outgoing_port, outgoing_security,
      outgoing_user, outgoing_pass_enc, leave_on_server, sync_interval_sec,
      last_sync_at, last_error, capabilities_json, is_default, avatar_url
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 120, NULL, NULL, '[]', ?, NULL)
  `).run(
    id,
    name.trim(),
    email.trim(),
    protocol,
    incomingHost.trim(),
    incomingPort,
    incomingSecurity,
    incomingUser.trim() || email.trim(),
    encryptSecret(incomingPass || ''),
    (outgoingHost || incomingHost).trim(),
    Number(outgoingPort || 465),
    outgoingSecurity,
    (outgoingUser || incomingUser || email).trim(),
    encryptSecret(outgoingPass || incomingPass || ''),
    leaveOnServer ? 1 : 0,
    isDefault
  );

  const baseFolders = [
    { name: 'Inbox', remote: 'INBOX', role: 'inbox', sort: 1 },
    { name: 'Drafts', remote: 'Drafts', role: 'drafts', sort: 2 },
    { name: 'Sent Items', remote: 'Sent', role: 'sent', sort: 3 },
    { name: 'Archive', remote: 'Archive', role: 'archive', sort: 4 },
    { name: 'Junk Email', remote: 'Junk', role: 'junk', sort: 5 },
    { name: 'Deleted Items', remote: 'Trash', role: 'deleted', sort: 6 },
  ];
  for (const f of baseFolders) {
    db.prepare(
      'INSERT INTO folders (id, account_id, name, remote_path, role, unread_count, total_count, sort_order) VALUES (?, ?, ?, ?, ?, 0, 0, ?)'
    ).run(uid('fld'), id, f.name, f.remote, f.role, f.sort);
  }

  const row = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as AccountRow;
  let syncSummary = { fetched: 0, capabilities: [] as string[] };
  let syncWarning: string | null = null;
  try {
    syncSummary = await performAccountSync(row);
  } catch (err) {
    syncWarning = (err as Error).message;
    db.prepare('UPDATE accounts SET last_error = ? WHERE id = ?').run(syncWarning, id);
  }

  return {
    ok: true,
    accountId: id,
    syncSummary,
    syncWarning,
    accounts: listAccounts(),
    folders: listFolders(),
  };
}

async function syncAccount(id: string) {
  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as AccountRow | undefined;
  if (!account) fail(404, 'Account not found');

  try {
    const result = await performAccountSync(account);
    return { ok: true, ...result, accounts: listAccounts(), folders: listFolders() };
  } catch (err) {
    const msg = (err as Error).message;
    db.prepare('UPDATE accounts SET last_error = ? WHERE id = ?').run(msg, account.id);
    fail(400, msg);
  }
}

function deleteAccount(id: string) {
  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as AccountRow | undefined;
  if (!account) fail(404, 'Account not found');

  db.prepare('DELETE FROM accounts WHERE id = ?').run(id);

  // Promote another mailbox to default when the default account is removed.
  if (account.is_default) {
    const next = db.prepare('SELECT id FROM accounts ORDER BY name ASC LIMIT 1').get() as { id: string } | undefined;
    if (next) db.prepare('UPDATE accounts SET is_default = 1 WHERE id = ?').run(next.id);
  }

  return { ok: true, accounts: listAccounts(), folders: listFolders() };
}

function createEvent(body: Record<string, unknown>) {
  const accountId = asString(body.accountId);
  const title = asString(body.title);
  const startTs = Number(body.startTs);
  const endTs = Number(body.endTs);

  if (!accountId || !title.trim() || !startTs || !endTs) {
    fail(400, 'Title, start time, and end time are required.');
  }

  const id = uid('evt');
  const isOnlineMeeting = Boolean(body.isOnlineMeeting);
  db.prepare(`
    INSERT INTO calendar_events (
      id, account_id, title, description, location, start_ts, end_ts, all_day,
      category_color, attendees_json, is_online_meeting, meeting_link, recurrence, reminder_minutes, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    accountId,
    title.trim(),
    asString(body.description),
    asString(body.location),
    startTs,
    endTs,
    body.allDay ? 1 : 0,
    asString(body.categoryColor, '#0F6CBD'),
    JSON.stringify(body.attendees ?? []),
    isOnlineMeeting ? 1 : 0,
    asString(body.meetingLink) || (isOnlineMeeting ? `https://teams.microsoft.com/l/meetup-join/${id}` : ''),
    asString(body.recurrence, 'none'),
    Number(body.reminderMinutes ?? 15),
    asString(body.status, 'busy')
  );
  return { ok: true, id };
}

function updateEvent(id: string, body: Record<string, unknown>) {
  const existing = db.prepare('SELECT * FROM calendar_events WHERE id = ?').get(id);
  if (!existing) fail(404, 'Event not found');

  const {
    title,
    description,
    location,
    startTs,
    endTs,
    allDay,
    categoryColor,
    attendees,
    isOnlineMeeting,
    meetingLink,
    recurrence,
    reminderMinutes,
    status,
  } = body;

  db.prepare(`
    UPDATE calendar_events SET
      title = COALESCE(?, title),
      description = COALESCE(?, description),
      location = COALESCE(?, location),
      start_ts = COALESCE(?, start_ts),
      end_ts = COALESCE(?, end_ts),
      all_day = COALESCE(?, all_day),
      category_color = COALESCE(?, category_color),
      attendees_json = COALESCE(?, attendees_json),
      is_online_meeting = COALESCE(?, is_online_meeting),
      meeting_link = COALESCE(?, meeting_link),
      recurrence = COALESCE(?, recurrence),
      reminder_minutes = COALESCE(?, reminder_minutes),
      status = COALESCE(?, status)
    WHERE id = ?
  `).run(
    title ?? null,
    description ?? null,
    location ?? null,
    startTs ?? null,
    endTs ?? null,
    typeof allDay === 'boolean' ? (allDay ? 1 : 0) : null,
    categoryColor ?? null,
    attendees ? JSON.stringify(attendees) : null,
    typeof isOnlineMeeting === 'boolean' ? (isOnlineMeeting ? 1 : 0) : null,
    meetingLink ?? null,
    recurrence ?? null,
    reminderMinutes ?? null,
    status ?? null,
    id
  );
  return { ok: true };
}

function deleteEvent(id: string) {
  db.prepare('DELETE FROM calendar_events WHERE id = ?').run(id);
  return { ok: true };
}

function rsvpInvite(body: Record<string, unknown>) {
  const messageId = asString(body.messageId);
  const response = asString(body.response);
  const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId) as MessageRow | undefined;
  if (!msg || !msg.meeting_invite_json) fail(404, 'Meeting invitation not found');

  const invite = safeParseJson<{
    title: string;
    startTs: number;
    endTs: number;
    location: string;
    organizer: string;
    rsvpStatus?: string;
    eventId?: string;
  } | null>(msg.meeting_invite_json, null);
  if (!invite) fail(400, 'Invalid invite payload');

  invite.rsvpStatus = response;
  let eventId = invite.eventId;

  if (response === 'accepted' || response === 'tentative') {
    if (eventId) {
      db.prepare('UPDATE calendar_events SET status = ? WHERE id = ?').run(
        response === 'accepted' ? 'busy' : 'tentative',
        eventId
      );
    } else {
      eventId = uid('evt');
      invite.eventId = eventId;
      db.prepare(`
        INSERT INTO calendar_events (
          id, account_id, title, description, location, start_ts, end_ts, all_day,
          category_color, attendees_json, is_online_meeting, meeting_link, recurrence, reminder_minutes, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, '#0F6CBD', ?, 1, '', 'none', 15, ?)
      `).run(
        eventId,
        msg.account_id,
        invite.title,
        `Organizer: ${invite.organizer}`,
        invite.location,
        invite.startTs,
        invite.endTs,
        JSON.stringify([{ name: msg.from_name, email: invite.organizer, response: 'accepted' }]),
        response === 'accepted' ? 'busy' : 'tentative'
      );
    }
  } else if (response === 'declined' && eventId) {
    db.prepare('DELETE FROM calendar_events WHERE id = ?').run(eventId);
    invite.eventId = undefined;
  }

  db.prepare('UPDATE messages SET meeting_invite_json = ? WHERE id = ?').run(JSON.stringify(invite), msg.id);
  return { ok: true, invite };
}

function createContact(body: Record<string, unknown>) {
  const accountId = asString(body.accountId);
  const email = asString(body.email);
  if (!accountId || !email.trim()) fail(400, 'Email is required');
  const firstName = asString(body.firstName);
  const lastName = asString(body.lastName);
  const resolvedDisplay = (asString(body.displayName) || `${firstName} ${lastName}`.trim() || email).trim();
  const id = uid('cnt');
  db.prepare(`
    INSERT INTO contacts (
      id, account_id, first_name, last_name, display_name, email, phone,
      company, job_title, department, location, notes, avatar_url, is_favorite, category
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
  `).run(
    id,
    accountId,
    firstName,
    lastName,
    resolvedDisplay,
    email.trim(),
    asString(body.phone),
    asString(body.company),
    asString(body.jobTitle),
    asString(body.department),
    asString(body.location),
    asString(body.notes),
    body.isFavorite ? 1 : 0,
    asString(body.category, 'Colleagues')
  );
  return { ok: true, id };
}

function updateContact(id: string, body: Record<string, unknown>) {
  const {
    firstName,
    lastName,
    displayName,
    email,
    phone,
    company,
    jobTitle,
    department,
    location,
    notes,
    isFavorite,
    category,
  } = body;
  db.prepare(`
    UPDATE contacts SET
      first_name = COALESCE(?, first_name),
      last_name = COALESCE(?, last_name),
      display_name = COALESCE(?, display_name),
      email = COALESCE(?, email),
      phone = COALESCE(?, phone),
      company = COALESCE(?, company),
      job_title = COALESCE(?, job_title),
      department = COALESCE(?, department),
      location = COALESCE(?, location),
      notes = COALESCE(?, notes),
      is_favorite = COALESCE(?, is_favorite),
      category = COALESCE(?, category)
    WHERE id = ?
  `).run(
    firstName ?? null,
    lastName ?? null,
    displayName ?? null,
    email ?? null,
    phone ?? null,
    company ?? null,
    jobTitle ?? null,
    department ?? null,
    location ?? null,
    notes ?? null,
    typeof isFavorite === 'boolean' ? (isFavorite ? 1 : 0) : null,
    category ?? null,
    id
  );
  return { ok: true };
}

function deleteContact(id: string) {
  db.prepare('DELETE FROM contacts WHERE id = ?').run(id);
  return { ok: true };
}

function createTask(body: Record<string, unknown>) {
  const accountId = asString(body.accountId);
  const title = asString(body.title);
  if (!accountId || !title.trim()) fail(400, 'Task title required');
  const id = uid('tsk');
  db.prepare(`
    INSERT INTO tasks (
      id, account_id, title, notes, is_completed, is_important, due_date, list_name, linked_message_id, sort_order, created_at
    ) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, 0, ?)
  `).run(
    id,
    accountId,
    title.trim(),
    asString(body.notes),
    body.isImportant ? 1 : 0,
    (body.dueDate as number | null | undefined) ?? null,
    asString(body.listName, 'My Day'),
    (body.linkedMessageId as string | null | undefined) ?? null,
    Date.now()
  );
  return { ok: true, id };
}

function updateTask(id: string, body: Record<string, unknown>) {
  const { title, notes, isCompleted, isImportant, dueDate, listName } = body;
  db.prepare(`
    UPDATE tasks SET
      title = COALESCE(?, title),
      notes = COALESCE(?, notes),
      is_completed = COALESCE(?, is_completed),
      is_important = COALESCE(?, is_important),
      due_date = COALESCE(?, due_date),
      list_name = COALESCE(?, list_name)
    WHERE id = ?
  `).run(
    title ?? null,
    notes ?? null,
    typeof isCompleted === 'boolean' ? (isCompleted ? 1 : 0) : null,
    typeof isImportant === 'boolean' ? (isImportant ? 1 : 0) : null,
    dueDate === undefined ? null : dueDate,
    listName ?? null,
    id
  );
  if (dueDate === null) {
    db.prepare('UPDATE tasks SET due_date = NULL WHERE id = ?').run(id);
  }
  return { ok: true };
}

function deleteTask(id: string) {
  db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  return { ok: true };
}

function createRule(body: Record<string, unknown>) {
  const accountId = asString(body.accountId);
  const name = asString(body.name);
  const conditionValue = asString(body.conditionValue);
  if (!accountId || !name.trim() || !conditionValue.trim()) {
    fail(400, 'Rule name and condition value are required');
  }
  const enabled = body.enabled === undefined ? true : Boolean(body.enabled);
  const id = uid('rule');
  db.prepare(`
    INSERT INTO rules (
      id, account_id, name, enabled, condition_field, condition_operator, condition_value, action_type, action_value
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    accountId,
    name.trim(),
    enabled ? 1 : 0,
    asString(body.conditionField, 'from'),
    asString(body.conditionOperator, 'contains'),
    conditionValue.trim(),
    asString(body.actionType, 'move'),
    asString(body.actionValue)
  );
  return { ok: true, id };
}

function updateRule(id: string, body: Record<string, unknown>) {
  const { enabled } = body;
  if (typeof enabled === 'boolean') {
    db.prepare('UPDATE rules SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, id);
  }
  return { ok: true };
}

function deleteRule(id: string) {
  db.prepare('DELETE FROM rules WHERE id = ?').run(id);
  return { ok: true };
}

function runRules(body: Record<string, unknown>) {
  const accountId = asString(body.accountId);
  const inbox = db
    .prepare("SELECT id FROM folders WHERE account_id = ? AND role = 'inbox' LIMIT 1")
    .get(accountId) as { id: string } | undefined;
  if (!inbox) fail(404, 'Inbox not found');

  const inboxMsgs = db.prepare('SELECT id FROM messages WHERE folder_id = ?').all(inbox.id) as Array<{ id: string }>;
  for (const m of inboxMsgs) {
    applyRulesToMessage(accountId, m.id);
  }
  refreshFolderCounts(accountId);
  return { ok: true, processed: inboxMsgs.length };
}

function updateSettings(body: Record<string, unknown>) {
  const current = getAppSettings();
  const next = { ...current, ...body };
  db.prepare(
    'INSERT INTO settings (key, value_json) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json'
  ).run('app_settings', JSON.stringify(next));
  return { ok: true, settings: next };
}

/**
 * Single entry point for every renderer API call. This is invoked over IPC by
 * the Electron main process and contains no HTTP-specific logic.
 */
export async function handleApiCall(request: ApiRequest): Promise<unknown> {
  const [rawPath, rawQueryString] = request.path.split('?');
  const path = rawPath || '/';
  const query: Record<string, string | undefined> = { ...request.query };
  if (rawQueryString) {
    for (const [key, value] of new URLSearchParams(rawQueryString)) query[key] = value;
  }
  const body = request.body ?? {};
  const segments = path.split('/').filter(Boolean).map((part) => decodeURIComponent(part));
  // Renderer calls keep the legacy /api prefix for readability; strip it here.
  if (segments[0] === 'api') segments.shift();
  const method = request.method;

  const is = (expected: string[]): boolean =>
    segments.length === expected.length && expected.every((seg, i) => seg === segments[i]);
  const starts = (prefix: string[]): boolean =>
    segments.length >= prefix.length && prefix.every((seg, i) => seg === segments[i]);

  // Bootstrap / workspace
  if (method === 'GET' && is(['bootstrap'])) return bootstrap();

  // Messages
  if (method === 'GET' && is(['messages'])) return listMessages(query);
  if (method === 'POST' && is(['messages', 'send'])) return sendMessage(body);
  if (method === 'POST' && is(['messages', 'draft'])) return saveDraft(body);
  if (method === 'POST' && is(['messages', 'bulk'])) return bulkAction(body);
  if (method === 'GET' && segments[0] === 'messages' && segments.length === 2) {
    return getMessageDetail(segments[1]);
  }
  if (method === 'PATCH' && segments[0] === 'messages' && segments.length === 2) {
    return updateMessage(segments[1], body);
  }
  if (method === 'DELETE' && segments[0] === 'messages' && segments.length === 2) {
    return deleteMessage(segments[1]);
  }
  if (method === 'GET' && starts(['messages']) && segments[2] === 'attachment') {
    return getAttachment(segments[1], segments[3]) ?? fail(404, 'Attachment not found');
  }

  // Folders
  if (method === 'POST' && is(['folders'])) return createFolder(body);
  if (method === 'POST' && segments[0] === 'folders' && segments[2] === 'empty') {
    return emptyFolder(segments[1]);
  }
  if (method === 'DELETE' && segments[0] === 'folders' && segments.length === 2) {
    return deleteFolder(segments[1]);
  }

  // Accounts
  if (method === 'POST' && is(['accounts', 'test'])) return testAccount(body);
  if (method === 'POST' && is(['accounts'])) return createAccount(body);
  if (method === 'POST' && segments[0] === 'accounts' && segments[2] === 'sync') {
    return syncAccount(segments[1]);
  }
  if (method === 'DELETE' && segments[0] === 'accounts' && segments.length === 2) {
    return deleteAccount(segments[1]);
  }

  // Calendar
  if (method === 'POST' && is(['calendar', 'rsvp'])) return rsvpInvite(body);
  if (method === 'POST' && is(['calendar'])) return createEvent(body);
  if (method === 'PATCH' && segments[0] === 'calendar' && segments.length === 2) {
    return updateEvent(segments[1], body);
  }
  if (method === 'DELETE' && segments[0] === 'calendar' && segments.length === 2) {
    return deleteEvent(segments[1]);
  }

  // Contacts
  if (method === 'POST' && is(['contacts'])) return createContact(body);
  if (method === 'PATCH' && segments[0] === 'contacts' && segments.length === 2) {
    return updateContact(segments[1], body);
  }
  if (method === 'DELETE' && segments[0] === 'contacts' && segments.length === 2) {
    return deleteContact(segments[1]);
  }

  // Tasks
  if (method === 'POST' && is(['tasks'])) return createTask(body);
  if (method === 'PATCH' && segments[0] === 'tasks' && segments.length === 2) {
    return updateTask(segments[1], body);
  }
  if (method === 'DELETE' && segments[0] === 'tasks' && segments.length === 2) {
    return deleteTask(segments[1]);
  }

  // Rules
  if (method === 'POST' && is(['rules', 'run'])) return runRules(body);
  if (method === 'POST' && is(['rules'])) return createRule(body);
  if (method === 'PATCH' && segments[0] === 'rules' && segments.length === 2) {
    return updateRule(segments[1], body);
  }
  if (method === 'DELETE' && segments[0] === 'rules' && segments.length === 2) {
    return deleteRule(segments[1]);
  }

  // Settings
  if (method === 'PATCH' && is(['settings'])) return updateSettings(body);

  fail(404, `No API handler for ${method} ${path}`);
}
