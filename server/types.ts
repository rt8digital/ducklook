export type MailProtocol = 'imap' | 'pop3' | 'local';
export type SecurityMode = 'tls' | 'starttls' | 'none';
export type FolderRole = 'inbox' | 'drafts' | 'sent' | 'archive' | 'junk' | 'deleted' | 'custom';
export type FocusedBucket = 'focused' | 'other';
export type ImportanceLevel = 'high' | 'normal' | 'low';

export interface EmailParticipant {
  name: string;
  address: string;
}

export interface AttachmentRecord {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  contentBase64?: string;
}

export interface MeetingInviteMeta {
  title: string;
  startTs: number;
  endTs: number;
  location: string;
  organizer: string;
  rsvpStatus?: 'pending' | 'accepted' | 'tentative' | 'declined';
  eventId?: string;
}

export interface AccountRow {
  id: string;
  name: string;
  email: string;
  protocol: MailProtocol;
  incoming_host: string;
  incoming_port: number;
  incoming_security: SecurityMode;
  incoming_user: string;
  incoming_pass_enc: string;
  outgoing_host: string;
  outgoing_port: number;
  outgoing_security: SecurityMode;
  outgoing_user: string;
  outgoing_pass_enc: string;
  leave_on_server: number;
  sync_interval_sec: number;
  last_sync_at: number | null;
  last_error: string | null;
  capabilities_json: string;
  is_default: number;
  avatar_url: string | null;
}

export interface FolderRow {
  id: string;
  account_id: string;
  name: string;
  remote_path: string;
  role: FolderRole;
  unread_count: number;
  total_count: number;
  sort_order: number;
}

export interface MessageRow {
  id: string;
  account_id: string;
  folder_id: string;
  remote_uid: number | null;
  remote_uidl: string | null;
  message_id_header: string;
  in_reply_to: string | null;
  references_header: string | null;
  thread_id: string;
  from_name: string;
  from_email: string;
  to_json: string;
  cc_json: string;
  bcc_json: string;
  reply_to_json: string;
  subject: string;
  snippet: string;
  text_body: string;
  html_body: string;
  raw_headers: string;
  date_ts: number;
  is_read: number;
  is_flagged: number;
  is_draft: number;
  focused_bucket: FocusedBucket;
  importance: ImportanceLevel;
  categories_json: string;
  has_attachments: number;
  attachments_json: string;
  meeting_invite_json: string | null;
  snoozed_until: number | null;
  created_at: number;
}

export interface ProtocolTestInput {
  protocol: 'imap' | 'pop3';
  incomingHost: string;
  incomingPort: number;
  incomingSecurity: SecurityMode;
  incomingUser: string;
  incomingPass: string;
  outgoingHost: string;
  outgoingPort: number;
  outgoingSecurity: SecurityMode;
  outgoingUser: string;
  outgoingPass: string;
}

export interface ParsedExternalMessage {
  remoteUid: number | null;
  remoteUidl: string | null;
  messageIdHeader: string;
  inReplyTo: string | null;
  referencesHeader: string | null;
  fromName: string;
  fromEmail: string;
  to: EmailParticipant[];
  cc: EmailParticipant[];
  bcc: EmailParticipant[];
  replyTo: EmailParticipant[];
  subject: string;
  snippet: string;
  textBody: string;
  htmlBody: string;
  rawHeaders: string;
  dateTs: number;
  isRead: boolean;
  isFlagged: boolean;
  attachments: AttachmentRecord[];
}
