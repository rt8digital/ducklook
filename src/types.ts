export type MailProtocol = 'imap' | 'pop3' | 'local';
export type SecurityMode = 'tls' | 'starttls' | 'none';
export type FolderRole = 'inbox' | 'drafts' | 'sent' | 'archive' | 'junk' | 'deleted' | 'custom';
export type FocusedBucket = 'focused' | 'other';
export type ImportanceLevel = 'high' | 'normal' | 'low';

export interface EmailParticipant {
  name: string;
  address: string;
}

export interface AttachmentMeta {
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

export interface MailAccount {
  id: string;
  name: string;
  email: string;
  protocol: MailProtocol;
  incomingHost: string;
  incomingPort: number;
  incomingSecurity: SecurityMode;
  incomingUser: string;
  outgoingHost: string;
  outgoingPort: number;
  outgoingSecurity: SecurityMode;
  outgoingUser: string;
  leaveOnServer: boolean;
  syncIntervalSec: number;
  lastSyncAt: number | null;
  lastError: string | null;
  capabilities: string[];
  isDefault: boolean;
  avatarUrl?: string | null;
}

export interface MailFolder {
  id: string;
  accountId: string;
  name: string;
  remotePath: string;
  role: FolderRole;
  unreadCount: number;
  totalCount: number;
  sortOrder: number;
}

export interface MailMessage {
  id: string;
  accountId: string;
  folderId: string;
  remoteUid: number | null;
  remoteUidl: string | null;
  messageIdHeader: string;
  inReplyTo: string | null;
  referencesHeader: string | null;
  threadId: string;
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
  isDraft: boolean;
  focusedBucket: FocusedBucket;
  importance: ImportanceLevel;
  categories: string[];
  hasAttachments: boolean;
  attachments: AttachmentMeta[];
  meetingInvite: MeetingInviteMeta | null;
  snoozedUntil: number | null;
  createdAt: number;
}

export interface CalendarEvent {
  id: string;
  accountId: string;
  title: string;
  description: string;
  location: string;
  startTs: number;
  endTs: number;
  allDay: boolean;
  categoryColor: string;
  attendees: { name: string; email: string; response: 'accepted' | 'tentative' | 'declined' | 'none' }[];
  isOnlineMeeting: boolean;
  meetingLink: string;
  recurrence: 'none' | 'daily' | 'weekly' | 'monthly';
  reminderMinutes: number;
  status: 'busy' | 'tentative' | 'free' | 'oof';
}

export interface ContactRecord {
  id: string;
  accountId: string;
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  phone: string;
  company: string;
  jobTitle: string;
  department: string;
  location: string;
  notes: string;
  avatarUrl: string | null;
  isFavorite: boolean;
  category: string;
}

export interface TaskItem {
  id: string;
  accountId: string;
  title: string;
  notes: string;
  isCompleted: boolean;
  isImportant: boolean;
  dueDate: number | null;
  listName: 'My Day' | 'Tasks' | 'Flagged Email';
  linkedMessageId: string | null;
  sortOrder: number;
  createdAt: number;
}

export interface MailRule {
  id: string;
  accountId: string;
  name: string;
  enabled: boolean;
  conditionField: 'from' | 'subject' | 'body';
  conditionOperator: 'contains' | 'equals';
  conditionValue: string;
  actionType: 'move' | 'mark_read' | 'flag' | 'categorize' | 'delete';
  actionValue: string;
}

export interface AppSettings {
  theme: 'light' | 'dark';
  readingPanePosition: 'right' | 'bottom' | 'off';
  density: 'comfortable' | 'compact';
  focusedInboxEnabled: boolean;
  conversationView: boolean;
  signatureHtml: string;
  signatureEnabled: boolean;
  autoReplyEnabled: boolean;
  autoReplyMessage: string;
  syncIntervalSec: number;
}

export interface BootstrapPayload {
  accounts: MailAccount[];
  folders: MailFolder[];
  events: CalendarEvent[];
  contacts: ContactRecord[];
  tasks: TaskItem[];
  rules: MailRule[];
  settings: AppSettings;
}
