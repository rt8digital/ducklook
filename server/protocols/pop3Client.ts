import net from 'node:net';
import tls from 'node:tls';
import { simpleParser, type ParsedMail } from 'mailparser';
import type { ParsedExternalMessage, SecurityMode } from '../types.ts';

interface Pop3ConnectionConfig {
  host: string;
  port: number;
  security: SecurityMode;
  user: string;
  pass: string;
  timeoutMs?: number;
}

class Pop3Session {
  private socket: net.Socket | tls.TLSSocket;
  private buffer = Buffer.alloc(0);
  private waiters: Array<{
    mode: 'line' | 'multiline';
    resolve: (val: string) => void;
    reject: (err: Error) => void;
  }> = [];
  private closed = false;
  private timeoutMs: number;

  private constructor(socket: net.Socket | tls.TLSSocket, timeoutMs: number) {
    this.socket = socket;
    this.timeoutMs = timeoutMs;
    this.attachListeners(socket);
  }

  private attachListeners(sock: net.Socket | tls.TLSSocket) {
    sock.on('data', (chunk: Buffer) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      this.processBuffer();
    });
    sock.on('error', (err) => {
      this.failAll(err);
    });
    sock.on('close', () => {
      this.closed = true;
      this.failAll(new Error('POP3 connection closed unexpectedly'));
    });
  }

  private detachListeners(sock: net.Socket | tls.TLSSocket) {
    sock.removeAllListeners('data');
    sock.removeAllListeners('error');
    sock.removeAllListeners('close');
  }

  private failAll(err: Error) {
    while (this.waiters.length > 0) {
      const w = this.waiters.shift();
      w?.reject(err);
    }
  }

  private processBuffer() {
    while (this.waiters.length > 0) {
      const current = this.waiters[0];
      const text = this.buffer.toString('latin1');

      if (current.mode === 'line') {
        const idx = text.indexOf('\r\n');
        if (idx === -1) return;
        const line = text.slice(0, idx);
        this.buffer = this.buffer.subarray(idx + 2);
        this.waiters.shift();
        current.resolve(line);
      } else {
        // First line must be +OK or -ERR
        const firstCrlf = text.indexOf('\r\n');
        if (firstCrlf === -1) return;
        const firstLine = text.slice(0, firstCrlf);
        if (firstLine.startsWith('-ERR')) {
          this.buffer = this.buffer.subarray(firstCrlf + 2);
          this.waiters.shift();
          current.reject(new Error(firstLine));
          return;
        }
        // Multiline terminates with \r\n.\r\n
        const afterFirst = text.slice(firstCrlf + 2);
        if (afterFirst.startsWith('.\r\n')) {
          this.buffer = this.buffer.subarray(firstCrlf + 2 + 3);
          this.waiters.shift();
          current.resolve('');
          return;
        }
        const termIdx = afterFirst.indexOf('\r\n.\r\n');
        if (termIdx === -1) return;
        const rawBody = afterFirst.slice(0, termIdx);
        const totalBytesConsumed = firstCrlf + 2 + termIdx + 5;
        this.buffer = this.buffer.subarray(totalBytesConsumed);
        this.waiters.shift();
        // RFC 1939 dot-unstuffing
        const unstuffed = rawBody
          .split('\r\n')
          .map((line) => (line.startsWith('..') ? line.slice(1) : line))
          .join('\r\n');
        current.resolve(unstuffed);
      }
    }
  }

  private readResponse(mode: 'line' | 'multiline'): Promise<string> {
    if (this.closed) {
      return Promise.reject(new Error('POP3 socket already closed'));
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.waiters.findIndex((w) => w.resolve === wrappedResolve);
        if (idx !== -1) this.waiters.splice(idx, 1);
        reject(new Error('POP3 command timed out'));
      }, this.timeoutMs);

      const wrappedResolve = (val: string) => {
        clearTimeout(timer);
        resolve(val);
      };
      const wrappedReject = (err: Error) => {
        clearTimeout(timer);
        reject(err);
      };

      this.waiters.push({ mode, resolve: wrappedResolve, reject: wrappedReject });
      this.processBuffer();
    });
  }

  static async connect(cfg: Pop3ConnectionConfig): Promise<{ session: Pop3Session; greeting: string }> {
    const timeoutMs = cfg.timeoutMs ?? 12000;
    const isLoopback = cfg.host === '127.0.0.1' || cfg.host === 'localhost';

    const socket = await new Promise<net.Socket | tls.TLSSocket>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`POP3 connect timeout (${cfg.host}:${cfg.port})`)), timeoutMs);
      if (cfg.security === 'tls') {
        const s = tls.connect(
          {
            host: cfg.host,
            port: cfg.port,
            servername: cfg.host,
            rejectUnauthorized: !isLoopback,
          },
          () => {
            clearTimeout(timer);
            resolve(s);
          }
        );
        s.once('error', (e) => {
          clearTimeout(timer);
          reject(e);
        });
      } else {
        const s = net.connect({ host: cfg.host, port: cfg.port }, () => {
          clearTimeout(timer);
          resolve(s);
        });
        s.once('error', (e) => {
          clearTimeout(timer);
          reject(e);
        });
      }
    });

    const session = new Pop3Session(socket, timeoutMs);
    const greeting = await session.readResponse('line');
    if (!greeting.startsWith('+OK')) {
      session.destroy();
      throw new Error(`Unexpected POP3 greeting: ${greeting}`);
    }
    return { session, greeting };
  }

  async command(cmd: string): Promise<string> {
    this.socket.write(`${cmd}\r\n`);
    const resp = await this.readResponse('line');
    if (!resp.startsWith('+OK')) {
      throw new Error(resp);
    }
    return resp;
  }

  async multilineCommand(cmd: string): Promise<string> {
    this.socket.write(`${cmd}\r\n`);
    return this.readResponse('multiline');
  }

  async upgradeStartTls(host: string): Promise<void> {
    await this.command('STLS');
    const plainSocket = this.socket as net.Socket;
    this.detachListeners(plainSocket);
    const isLoopback = host === '127.0.0.1' || host === 'localhost';
    const tlsSocket = await new Promise<tls.TLSSocket>((resolve, reject) => {
      const upgraded = tls.connect(
        {
          socket: plainSocket,
          servername: host,
          rejectUnauthorized: !isLoopback,
        },
        () => resolve(upgraded)
      );
      upgraded.once('error', reject);
    });
    this.socket = tlsSocket;
    this.attachListeners(tlsSocket);
  }

  async quit(): Promise<void> {
    try {
      await this.command('QUIT');
    } catch {
      // ignore close errors
    } finally {
      this.destroy();
    }
  }

  destroy() {
    this.closed = true;
    try {
      this.socket.destroy();
    } catch {
      // ignore
    }
  }
}

function parsedMailToMessage(
  parsed: ParsedMail,
  rawString: string,
  uidl: string
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
    id: `att-${Date.now()}-${idx}`,
    filename: att.filename || `attachment-${idx + 1}.bin`,
    contentType: att.contentType || 'application/octet-stream',
    size: att.size || att.content?.length || 0,
    contentBase64: att.content ? att.content.toString('base64') : undefined,
  }));

  return {
    remoteUid: null,
    remoteUidl: uidl,
    messageIdHeader: parsed.messageId || `<pop3-${uidl}@ducklook.local>`,
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
    isRead: false,
    isFlagged: false,
    attachments,
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function testPop3Connection(cfg: Pop3ConnectionConfig): Promise<{
  ok: boolean;
  banner: string;
  capabilities: string[];
  messageCount: number;
  totalBytes: number;
}> {
  const { session, greeting } = await Pop3Session.connect(cfg);
  try {
    let capabilities: string[] = [];
    if (cfg.security === 'starttls') {
      await session.upgradeStartTls(cfg.host);
    }
    try {
      const capaRaw = await session.multilineCommand('CAPA');
      capabilities = capaRaw
        .split('\r\n')
        .map((s) => s.trim())
        .filter(Boolean);
    } catch {
      capabilities = ['USER', 'UIDL', 'STAT'];
    }

    await session.command(`USER ${cfg.user}`);
    await session.command(`PASS ${cfg.pass}`);
    const statLine = await session.command('STAT');
    const match = statLine.match(/^\+OK\s+(\d+)\s+(\d+)/i);
    const messageCount = match ? Number(match[1]) : 0;
    const totalBytes = match ? Number(match[2]) : 0;

    return {
      ok: true,
      banner: greeting,
      capabilities,
      messageCount,
      totalBytes,
    };
  } finally {
    await session.quit();
  }
}

export async function syncPop3Messages(
  cfg: Pop3ConnectionConfig,
  existingUidls: Set<string>,
  leaveOnServer: boolean,
  maxFetch = 40
): Promise<{
  messages: ParsedExternalMessage[];
  capabilities: string[];
}> {
  const { session } = await Pop3Session.connect(cfg);
  try {
    let capabilities: string[] = [];
    if (cfg.security === 'starttls') {
      await session.upgradeStartTls(cfg.host);
    }
    try {
      const capaRaw = await session.multilineCommand('CAPA');
      capabilities = capaRaw
        .split('\r\n')
        .map((s) => s.trim())
        .filter(Boolean);
    } catch {
      capabilities = ['USER', 'STAT'];
    }

    await session.command(`USER ${cfg.user}`);
    await session.command(`PASS ${cfg.pass}`);

    const uidMap: Array<{ num: number; uidl: string }> = [];
    try {
      const uidlRaw = await session.multilineCommand('UIDL');
      for (const line of uidlRaw.split('\r\n')) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 2 && /^\d+$/.test(parts[0])) {
          uidMap.push({ num: Number(parts[0]), uidl: parts[1] });
        }
      }
    } catch {
      const listRaw = await session.multilineCommand('LIST');
      for (const line of listRaw.split('\r\n')) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 2 && /^\d+$/.test(parts[0])) {
          uidMap.push({ num: Number(parts[0]), uidl: `pop3-${parts[0]}-${parts[1]}` });
        }
      }
    }

    const unseen = uidMap.filter((item) => !existingUidls.has(item.uidl));
    const toFetch = unseen.slice(-maxFetch);
    const parsedMessages: ParsedExternalMessage[] = [];

    for (const item of toFetch) {
      const rawRfc5322 = await session.multilineCommand(`RETR ${item.num}`);
      const parsed = await simpleParser(Buffer.from(rawRfc5322, 'utf8'));
      parsedMessages.push(parsedMailToMessage(parsed, rawRfc5322, item.uidl));
      if (!leaveOnServer) {
        await session.command(`DELE ${item.num}`);
      }
    }

    return { messages: parsedMessages, capabilities };
  } finally {
    await session.quit();
  }
}
