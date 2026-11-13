import nodemailer from 'nodemailer';
import type { EmailParticipant, SecurityMode } from '../types.ts';

interface SmtpConfig {
  host: string;
  port: number;
  security: SecurityMode;
  user: string;
  pass: string;
}

export interface SendMailPayload {
  fromName: string;
  fromEmail: string;
  to: EmailParticipant[];
  cc?: EmailParticipant[];
  bcc?: EmailParticipant[];
  subject: string;
  htmlBody: string;
  textBody: string;
  inReplyTo?: string | null;
  referencesHeader?: string | null;
  attachments?: Array<{
    filename: string;
    contentType: string;
    contentBase64?: string;
  }>;
}

function createTransporter(cfg: SmtpConfig) {
  const isLoopback = cfg.host === '127.0.0.1' || cfg.host === 'localhost';
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.security === 'tls',
    requireTLS: cfg.security === 'starttls',
    ignoreTLS: cfg.security === 'none',
    auth: cfg.user
      ? {
          user: cfg.user,
          pass: cfg.pass,
        }
      : undefined,
    tls: {
      rejectUnauthorized: !isLoopback,
    },
    connectionTimeout: 12000,
    greetingTimeout: 10000,
  });
}

export async function testSmtpConnection(cfg: SmtpConfig): Promise<{ ok: boolean }> {
  const transporter = createTransporter(cfg);
  await transporter.verify();
  return { ok: true };
}

export async function sendSmtpMail(
  cfg: SmtpConfig,
  payload: SendMailPayload
): Promise<{ messageId: string }> {
  const transporter = createTransporter(cfg);
  const formatParticipants = (list?: EmailParticipant[]) =>
    list?.map((p) => (p.name ? `"${p.name.replace(/"/g, '')}" <${p.address}>` : p.address));

  const info = await transporter.sendMail({
    from: payload.fromName ? `"${payload.fromName.replace(/"/g, '')}" <${payload.fromEmail}>` : payload.fromEmail,
    to: formatParticipants(payload.to),
    cc: formatParticipants(payload.cc),
    bcc: formatParticipants(payload.bcc),
    subject: payload.subject,
    text: payload.textBody,
    html: payload.htmlBody,
    inReplyTo: payload.inReplyTo || undefined,
    references: payload.referencesHeader || undefined,
    attachments: (payload.attachments || [])
      .filter((a) => a.contentBase64)
      .map((a) => ({
        filename: a.filename,
        content: Buffer.from(a.contentBase64!, 'base64'),
        contentType: a.contentType,
      })),
  });

  return { messageId: info.messageId || `<msg-${Date.now()}@ducklook.local>` };
}
