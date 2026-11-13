import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import type { AccountRow, FolderRow, MessageRow } from './types.ts';

const DATA_DIR = process.env.DUCKLOOK_DATA_DIR
  ? path.resolve(process.env.DUCKLOOK_DATA_DIR)
  : path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'ducklook.db');
export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    protocol TEXT NOT NULL,
    incoming_host TEXT NOT NULL DEFAULT '',
    incoming_port INTEGER NOT NULL DEFAULT 993,
    incoming_security TEXT NOT NULL DEFAULT 'tls',
    incoming_user TEXT NOT NULL DEFAULT '',
    incoming_pass_enc TEXT NOT NULL DEFAULT '',
    outgoing_host TEXT NOT NULL DEFAULT '',
    outgoing_port INTEGER NOT NULL DEFAULT 465,
    outgoing_security TEXT NOT NULL DEFAULT 'tls',
    outgoing_user TEXT NOT NULL DEFAULT '',
    outgoing_pass_enc TEXT NOT NULL DEFAULT '',
    leave_on_server INTEGER NOT NULL DEFAULT 1,
    sync_interval_sec INTEGER NOT NULL DEFAULT 120,
    last_sync_at INTEGER,
    last_error TEXT,
    capabilities_json TEXT NOT NULL DEFAULT '[]',
    is_default INTEGER NOT NULL DEFAULT 0,
    avatar_url TEXT
  );

  CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    remote_path TEXT NOT NULL,
    role TEXT NOT NULL,
    unread_count INTEGER NOT NULL DEFAULT 0,
    total_count INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 10
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    folder_id TEXT NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
    remote_uid INTEGER,
    remote_uidl TEXT,
    message_id_header TEXT NOT NULL,
    in_reply_to TEXT,
    references_header TEXT,
    thread_id TEXT NOT NULL,
    from_name TEXT NOT NULL,
    from_email TEXT NOT NULL,
    to_json TEXT NOT NULL DEFAULT '[]',
    cc_json TEXT NOT NULL DEFAULT '[]',
    bcc_json TEXT NOT NULL DEFAULT '[]',
    reply_to_json TEXT NOT NULL DEFAULT '[]',
    subject TEXT NOT NULL DEFAULT '',
    snippet TEXT NOT NULL DEFAULT '',
    text_body TEXT NOT NULL DEFAULT '',
    html_body TEXT NOT NULL DEFAULT '',
    raw_headers TEXT NOT NULL DEFAULT '',
    date_ts INTEGER NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0,
    is_flagged INTEGER NOT NULL DEFAULT 0,
    is_draft INTEGER NOT NULL DEFAULT 0,
    focused_bucket TEXT NOT NULL DEFAULT 'focused',
    importance TEXT NOT NULL DEFAULT 'normal',
    categories_json TEXT NOT NULL DEFAULT '[]',
    has_attachments INTEGER NOT NULL DEFAULT 0,
    attachments_json TEXT NOT NULL DEFAULT '[]',
    meeting_invite_json TEXT,
    snoozed_until INTEGER,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_messages_folder ON messages(folder_id, date_ts DESC);
  CREATE INDEX IF NOT EXISTS idx_messages_account ON messages(account_id, date_ts DESC);
  CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id);
  CREATE INDEX IF NOT EXISTS idx_messages_uidl ON messages(account_id, remote_uidl);

  CREATE TABLE IF NOT EXISTS calendar_events (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    start_ts INTEGER NOT NULL,
    end_ts INTEGER NOT NULL,
    all_day INTEGER NOT NULL DEFAULT 0,
    category_color TEXT NOT NULL DEFAULT '#0F6CBD',
    attendees_json TEXT NOT NULL DEFAULT '[]',
    is_online_meeting INTEGER NOT NULL DEFAULT 0,
    meeting_link TEXT NOT NULL DEFAULT '',
    recurrence TEXT NOT NULL DEFAULT 'none',
    reminder_minutes INTEGER NOT NULL DEFAULT 15,
    status TEXT NOT NULL DEFAULT 'busy'
  );

  CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL DEFAULT '',
    last_name TEXT NOT NULL DEFAULT '',
    display_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    company TEXT NOT NULL DEFAULT '',
    job_title TEXT NOT NULL DEFAULT '',
    department TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    avatar_url TEXT,
    is_favorite INTEGER NOT NULL DEFAULT 0,
    category TEXT NOT NULL DEFAULT 'Colleagues'
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    is_completed INTEGER NOT NULL DEFAULT 0,
    is_important INTEGER NOT NULL DEFAULT 0,
    due_date INTEGER,
    list_name TEXT NOT NULL DEFAULT 'My Day',
    linked_message_id TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS rules (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    condition_field TEXT NOT NULL,
    condition_operator TEXT NOT NULL,
    condition_value TEXT NOT NULL,
    action_type TEXT NOT NULL,
    action_value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL
  );
`);

export function refreshFolderCounts(accountId?: string): void {
  const folders = accountId
    ? (db.prepare('SELECT id FROM folders WHERE account_id = ?').all(accountId) as { id: string }[])
    : (db.prepare('SELECT id FROM folders').all() as { id: string }[]);

  const countStmt = db.prepare(`
    SELECT
      COUNT(*) as total_count,
      SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as unread_count
    FROM messages
    WHERE folder_id = ?
  `);
  const updateStmt = db.prepare('UPDATE folders SET total_count = ?, unread_count = ? WHERE id = ?');

  const tx = db.transaction(() => {
    for (const f of folders) {
      const row = countStmt.get(f.id) as { total_count: number; unread_count: number | null };
      updateStmt.run(row.total_count || 0, row.unread_count || 0, f.id);
    }
  });
  tx();
}

export function serializeAccount(row: AccountRow) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    protocol: row.protocol,
    incomingHost: row.incoming_host,
    incomingPort: row.incoming_port,
    incomingSecurity: row.incoming_security,
    incomingUser: row.incoming_user,
    outgoingHost: row.outgoing_host,
    outgoingPort: row.outgoing_port,
    outgoingSecurity: row.outgoing_security,
    outgoingUser: row.outgoing_user,
    leaveOnServer: Boolean(row.leave_on_server),
    syncIntervalSec: row.sync_interval_sec,
    lastSyncAt: row.last_sync_at,
    lastError: row.last_error,
    capabilities: safeParseJson<string[]>(row.capabilities_json, []),
    isDefault: Boolean(row.is_default),
    avatarUrl: row.avatar_url,
  };
}

export function serializeFolder(row: FolderRow) {
  return {
    id: row.id,
    accountId: row.account_id,
    name: row.name,
    remotePath: row.remote_path,
    role: row.role,
    unreadCount: row.unread_count,
    totalCount: row.total_count,
    sortOrder: row.sort_order,
  };
}

export function serializeMessage(row: MessageRow, includeAttachmentPayloads = false) {
  const attachments = safeParseJson<Array<{
    id: string;
    filename: string;
    contentType: string;
    size: number;
    contentBase64?: string;
  }>>(row.attachments_json, []);

  return {
    id: row.id,
    accountId: row.account_id,
    folderId: row.folder_id,
    remoteUid: row.remote_uid,
    remoteUidl: row.remote_uidl,
    messageIdHeader: row.message_id_header,
    inReplyTo: row.in_reply_to,
    referencesHeader: row.references_header,
    threadId: row.thread_id,
    fromName: row.from_name,
    fromEmail: row.from_email,
    to: safeParseJson(row.to_json, []),
    cc: safeParseJson(row.cc_json, []),
    bcc: safeParseJson(row.bcc_json, []),
    replyTo: safeParseJson(row.reply_to_json, []),
    subject: row.subject,
    snippet: row.snippet,
    textBody: row.text_body,
    htmlBody: row.html_body,
    rawHeaders: row.raw_headers,
    dateTs: row.date_ts,
    isRead: Boolean(row.is_read),
    isFlagged: Boolean(row.is_flagged),
    isDraft: Boolean(row.is_draft),
    focusedBucket: row.focused_bucket,
    importance: row.importance,
    categories: safeParseJson<string[]>(row.categories_json, []),
    hasAttachments: Boolean(row.has_attachments),
    attachments: includeAttachmentPayloads
      ? attachments
      : attachments.map(({ id, filename, contentType, size }) => ({ id, filename, contentType, size })),
    meetingInvite: row.meeting_invite_json ? safeParseJson(row.meeting_invite_json, null) : null,
    snoozedUntil: row.snoozed_until,
    createdAt: row.created_at,
  };
}

export function safeParseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function getAppSettings() {
  const row = db.prepare('SELECT value_json FROM settings WHERE key = ?').get('app_settings') as
    | { value_json: string }
    | undefined;
  const defaults = {
    theme: 'light' as const,
    readingPanePosition: 'right' as const,
    density: 'comfortable' as const,
    focusedInboxEnabled: true,
    conversationView: true,
    signatureHtml: '',
    signatureEnabled: true,
    autoReplyEnabled: false,
    autoReplyMessage: '',
    syncIntervalSec: 120,
  };
  if (!row) return defaults;
  return { ...defaults, ...safeParseJson(row.value_json, defaults) };
}

export function applyRulesToMessage(accountId: string, messageId: string): void {
  const rules = db
    .prepare('SELECT * FROM rules WHERE account_id = ? AND enabled = 1')
    .all(accountId) as Array<{
      id: string;
      condition_field: 'from' | 'subject' | 'body';
      condition_operator: 'contains' | 'equals';
      condition_value: string;
      action_type: 'move' | 'mark_read' | 'flag' | 'categorize' | 'delete';
      action_value: string;
    }>;

  if (!rules.length) return;
  const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId) as MessageRow | undefined;
  if (!msg) return;

  for (const rule of rules) {
    let target = '';
    if (rule.condition_field === 'from') target = `${msg.from_name} ${msg.from_email}`.toLowerCase();
    if (rule.condition_field === 'subject') target = msg.subject.toLowerCase();
    if (rule.condition_field === 'body') target = msg.text_body.toLowerCase();

    const needle = rule.condition_value.toLowerCase().trim();
    if (!needle) continue;
    const matched =
      rule.condition_operator === 'equals' ? target.trim() === needle : target.includes(needle);

    if (!matched) continue;

    if (rule.action_type === 'mark_read') {
      db.prepare('UPDATE messages SET is_read = 1 WHERE id = ?').run(messageId);
    } else if (rule.action_type === 'flag') {
      db.prepare('UPDATE messages SET is_flagged = 1 WHERE id = ?').run(messageId);
    } else if (rule.action_type === 'categorize' && rule.action_value) {
      const cats = safeParseJson<string[]>(msg.categories_json, []);
      if (!cats.includes(rule.action_value)) {
        cats.push(rule.action_value);
        db.prepare('UPDATE messages SET categories_json = ? WHERE id = ?').run(JSON.stringify(cats), messageId);
      }
    } else if (rule.action_type === 'move' && rule.action_value) {
      const folder = db
        .prepare('SELECT id FROM folders WHERE id = ? AND account_id = ?')
        .get(rule.action_value, accountId) as { id: string } | undefined;
      if (folder) {
        db.prepare('UPDATE messages SET folder_id = ? WHERE id = ?').run(folder.id, messageId);
      }
    } else if (rule.action_type === 'delete') {
      const trash = db
        .prepare("SELECT id FROM folders WHERE account_id = ? AND role = 'deleted' LIMIT 1")
        .get(accountId) as { id: string } | undefined;
      if (trash) {
        db.prepare('UPDATE messages SET folder_id = ? WHERE id = ?').run(trash.id, messageId);
      }
    }
  }
}
