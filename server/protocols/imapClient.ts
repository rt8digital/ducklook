import { ImapFlow } from 'imapflow';
import { simpleParser, type ParsedMail } from 'mailparser';
import type { FolderRole, ParsedExternalMessage, SecurityMode } from '../types.ts';

interface ImapConnectionConfig {
  host: string;
  port: number;
  security: SecurityMode;
  user: string;
  pass: string;
}

function createImapClient(cfg: ImapConnectionConfig): ImapFlow {
  const isLoopback = cfg.host === '127.0.0.1' || cfg.host === 'localhost';
  return new ImapFlow({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.security === 'tls',
    doSTARTTLS: cfg.security === 'starttls',
    auth: {
      user: cfg.user,
      pass: cfg.pass,
    },
    tls: {
      rejectUnauthorized: !isLoopback,
    },
    logger: false,
    connectionTimeout: 12000,
    greetingTimeout: 10000,
  });
}

function mapSpecialUseToRole(specialUse?: string, name?: string): FolderRole {
  if (specialUse === '\\Inbox' || name?.toLowerCase() === 'inbox') return 'inbox';
  if (specialUse === '\\Sent' || name?.toLowerCase().includes('sent')) return 'sent';
  if (specialUse === '\\Drafts' || name?.toLowerCase().includes('draft')) return 'drafts';
  if (specialUse === '\\Trash' || name?.toLowerCase().includes('trash') || name?.toLowerCase().includes('deleted')) {
    return 'deleted';
  }
  if (specialUse === '\\Junk' || name?.toLowerCase().includes('junk') || name?.toLowerCase().includes('spam')) {
    return 'junk';
  }
  if (specialUse === '\\Archive' || name?.toLowerCase().includes('archive')) return 'archive';
  return 'custom';
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function parsedImapMailToMessage(
  parsed: ParsedMail,
  rawString: string,
  uid: number,
  flags: Set<string>
): ParsedExternalMessage {
  const fromVal = parsed.from?.value?.[0];
  const toList = parsed.to
    ? (Array.isArray(parsed.to) ? parsed.to : [parsed.to]).flatMap((g) =>
        g.value.map((v) => ({ name: v.name || v.address || '', address: v.address || '' }))
      )
    : [];
  const ccList = parsed.cc
    ? (Array.isArray(parsed.cc) ? parsed.cc : [parsed.cc]).flatMap((g) =>
        g.value.map((v) => ({ name: v.name || v.address || '', address: v.address || '' }))
      )
    : [];
  const bccList = parsed.bcc
    ? (Array.isArray(parsed.bcc) ? parsed.bcc : [parsed.bcc]).flatMap((g) =>
        g.value.map((v) => ({ name: v.name || v.address || '', address: v.address || '' }))
      )
    : [];
  const replyToList = parsed.replyTo
    ? (Array.isArray(parsed.replyTo) ? parsed.replyTo : [parsed.replyTo]).flatMap((g) =>
        g.value.map((v: { name?: string; address?: string }) => ({
          name: v.name || v.address || '',
          address: v.address || '',
        }))
      )
    : [];

  const textBody = parsed.text || '';
  const htmlBody = typeof parsed.html === 'string' ? parsed.html : '';
  const plainSnippetSource = textBody || htmlBody.replace(/<[^>]+>/g, ' ');
  const snippet = plainSnippetSource.replace(/\s+/g, ' ').trim().slice(0, 180);

  const headerEnd = rawString.indexOf('\r\n\r\n');
  const rawHeaders = headerEnd !== -1 ? rawString.slice(0, headerEnd) : rawString.slice(0, 2000);

  const attachments = (parsed.attachments || []).map((att, idx) => ({
    id: `att-${Date.now()}-${uid}-${idx}`,
    filename: att.filename || `attachment-${idx + 1}.bin`,
    contentType: att.contentType || 'application/octet-stream',
    size: att.size || att.content?.length || 0,
    contentBase64: att.content ? att.content.toString('base64') : undefined,
  }));

  return {
    remoteUid: uid,
    remoteUidl: null,
    messageIdHeader: parsed.messageId || `<imap-${uid}@ducklook.local>`,
    inReplyTo: parsed.inReplyTo || null,
    referencesHeader: Array.isArray(parsed.references)
      ? parsed.references.join(' ')
      : parsed.references || null,
    fromName: fromVal?.name || fromVal?.address || 'Unknown Sender',
    fromEmail: fromVal?.address || 'unknown@example.com',
    to: toList,
    cc: ccList,
    bcc: bccList,
    replyTo: replyToList,
    subject: parsed.subject || '(No subject)',
    snippet,
    textBody,
    htmlBody: htmlBody || `<pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(textBody)}</pre>`,
    rawHeaders,
    dateTs: parsed.date ? parsed.date.getTime() : Date.now(),
    isRead: flags.has('\\Seen'),
    isFlagged: flags.has('\\Flagged'),
    attachments,
  };
}

export async function testImapConnection(cfg: ImapConnectionConfig): Promise<{
  ok: boolean;
  banner: string;
  capabilities: string[];
  mailboxes: Array<{ name: string; path: string; role: FolderRole }>;
  inboxTotal: number;
  inboxUnread: number;
}> {
  const client = createImapClient(cfg);
  await client.connect();
  try {
    const capabilities = Array.from(client.capabilities.keys());
    const list = await client.list();
    const mailboxes = list.map((m) => ({
      name: m.name,
      path: m.path,
      role: mapSpecialUseToRole(m.specialUse, m.name),
    }));
    const status = await client.status('INBOX', { messages: true, unseen: true });
    return {
      ok: true,
      banner: client.serverInfo?.name || 'IMAP4rev1 Server Ready',
      capabilities,
      mailboxes,
      inboxTotal: status && typeof status !== 'boolean' ? status.messages ?? 0 : 0,
      inboxUnread: status && typeof status !== 'boolean' ? status.unseen ?? 0 : 0,
    };
  } finally {
    await client.logout().catch(() => {});
  }
}

export async function syncImapAccount(
  cfg: ImapConnectionConfig,
  existingUidsByPath: Map<string, Set<number>>,
  maxPerFolder = 35
): Promise<{
  capabilities: string[];
  folders: Array<{
    name: string;
    path: string;
    role: FolderRole;
    messages: ParsedExternalMessage[];
  }>;
}> {
  const client = createImapClient(cfg);
  await client.connect();
  try {
    const capabilities = Array.from(client.capabilities.keys());
    const rawList = await client.list();

    const foldersOut: Array<{
      name: string;
      path: string;
      role: FolderRole;
      messages: ParsedExternalMessage[];
    }> = [];

    for (const box of rawList) {
      if (box.flags?.has('\\Noselect')) continue;
      const role = mapSpecialUseToRole(box.specialUse, box.name);
      const existingUids = existingUidsByPath.get(box.path) ?? new Set<number>();
      const folderMessages: ParsedExternalMessage[] = [];

      const lock = await client.getMailboxLock(box.path);
      try {
        const mailboxInfo = client.mailbox;
        const exists = mailboxInfo && typeof mailboxInfo !== 'boolean' ? mailboxInfo.exists : 0;
        if (exists > 0) {
          const startSeq = Math.max(1, exists - maxPerFolder + 1);
          for await (const msg of client.fetch(`${startSeq}:*`, {
            uid: true,
            flags: true,
            source: true,
          })) {
            if (existingUids.has(msg.uid)) continue;
            if (!msg.source) continue;
            const rawString = msg.source.toString('utf8');
            const parsed = await simpleParser(msg.source);
            folderMessages.push(
              parsedImapMailToMessage(parsed, rawString, msg.uid, msg.flags || new Set<string>())
            );
          }
        }
      } finally {
        lock.release();
      }

      foldersOut.push({
        name: box.name,
        path: box.path,
        role,
        messages: folderMessages,
      });
    }

    return { capabilities, folders: foldersOut };
  } finally {
    await client.logout().catch(() => {});
  }
}

export async function updateImapFlags(
  cfg: ImapConnectionConfig,
  folderPath: string,
  uid: number,
  action: 'add' | 'remove',
  flags: string[]
): Promise<void> {
  const client = createImapClient(cfg);
  await client.connect();
  try {
    const lock = await client.getMailboxLock(folderPath);
    try {
      if (action === 'add') {
        await client.messageFlagsAdd({ uid }, flags, { uid: true });
      } else {
        await client.messageFlagsRemove({ uid }, flags, { uid: true });
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
}
