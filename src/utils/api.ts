import type {
  AppSettings,
  BootstrapPayload,
  CalendarEvent,
  ContactRecord,
  EmailParticipant,
  MailFolder,
  MailMessage,
  MailRule,
  SecurityMode,
  TaskItem,
} from '../types';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const method = (options?.method ?? 'GET') as 'GET' | 'POST' | 'PATCH' | 'DELETE';
  const [path, queryString] = url.split('?');
  const query = queryString
    ? Object.fromEntries(new URLSearchParams(queryString).entries())
    : undefined;
  const body =
    typeof options?.body === 'string' ? (JSON.parse(options.body) as unknown) : undefined;

  return window.ducklookApi.invoke({ method, path, query, body }) as Promise<T>;
}

export const api = {
  bootstrap: () => request<BootstrapPayload>('/api/bootstrap'),

  getMessages: (params: {
    accountId?: string;
    folderId?: string;
    bucket?: string;
    q?: string;
    filter?: string;
    sort?: string;
    scope?: 'folder' | 'all';
  }) => {
    const usp = new URLSearchParams();
    if (params.accountId) usp.set('accountId', params.accountId);
    if (params.folderId) usp.set('folderId', params.folderId);
    if (params.bucket) usp.set('bucket', params.bucket);
    if (params.q) usp.set('q', params.q);
    if (params.filter) usp.set('filter', params.filter);
    if (params.sort) usp.set('sort', params.sort);
    if (params.scope) usp.set('scope', params.scope);
    return request<{ messages: MailMessage[] }>(`/api/messages?${usp.toString()}`);
  },

  getMessageDetail: (id: string) =>
    request<{ message: MailMessage; threadMessages: MailMessage[] }>(`/api/messages/${encodeURIComponent(id)}`),

  sendMessage: (payload: {
    accountId: string;
    draftId?: string | null;
    to: EmailParticipant[];
    cc?: EmailParticipant[];
    bcc?: EmailParticipant[];
    subject: string;
    htmlBody: string;
    textBody: string;
    inReplyTo?: string | null;
    referencesHeader?: string | null;
    threadId?: string | null;
    importance?: 'high' | 'normal' | 'low';
    attachments?: Array<{ filename: string; contentType: string; size: number; contentBase64?: string }>;
  }) =>
    request<{ ok: boolean; id: string; messageIdHeader: string; folders: MailFolder[] }>('/api/messages/send', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  saveDraft: (payload: {
    draftId?: string | null;
    accountId: string;
    to: EmailParticipant[];
    cc?: EmailParticipant[];
    bcc?: EmailParticipant[];
    subject: string;
    htmlBody: string;
    textBody: string;
    inReplyTo?: string | null;
    referencesHeader?: string | null;
    threadId?: string | null;
    importance?: 'high' | 'normal' | 'low';
  }) =>
    request<{ ok: boolean; id: string; folders: MailFolder[] }>('/api/messages/draft', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateMessage: (
    id: string,
    patch: {
      isRead?: boolean;
      isFlagged?: boolean;
      folderId?: string;
      focusedBucket?: 'focused' | 'other';
      categories?: string[];
      snoozedUntil?: number | null;
    }
  ) =>
    request<{ message: MailMessage; folders: MailFolder[] }>(`/api/messages/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  deleteMessage: (id: string) =>
    request<{ ok: boolean; folders: MailFolder[] }>(`/api/messages/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  bulkAction: (payload: {
    ids: string[];
    action: 'mark_read' | 'mark_unread' | 'flag' | 'unflag' | 'move' | 'archive' | 'junk' | 'delete' | 'categorize';
    folderId?: string;
    category?: string;
  }) =>
    request<{ ok: boolean; folders: MailFolder[] }>('/api/messages/bulk', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  createFolder: (accountId: string, name: string) =>
    request<{ id: string; folders: MailFolder[] }>('/api/folders', {
      method: 'POST',
      body: JSON.stringify({ accountId, name }),
    }),

  emptyFolder: (folderId: string) =>
    request<{ ok: boolean; folders: MailFolder[] }>(`/api/folders/${encodeURIComponent(folderId)}/empty`, {
      method: 'POST',
    }),

  deleteFolder: (folderId: string) =>
    request<{ ok: boolean; folders: MailFolder[] }>(`/api/folders/${encodeURIComponent(folderId)}`, {
      method: 'DELETE',
    }),

  testAccount: (payload: {
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
  }) =>
    request<{
      ok: boolean;
      protocol: string;
      incoming: {
        banner: string;
        capabilities: string[];
        messageCount?: number;
        totalBytes?: number;
        inboxTotal?: number;
        inboxUnread?: number;
        mailboxes?: Array<{ name: string; path: string; role: string }>;
      };
      smtpOk: boolean;
      smtpError: string | null;
    }>('/api/accounts/test', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  createAccount: (payload: {
    name: string;
    email: string;
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
    leaveOnServer: boolean;
  }) =>
    request<{
      ok: boolean;
      accountId: string;
      syncSummary: { fetched: number; capabilities: string[] };
      syncWarning: string | null;
      accounts: BootstrapPayload['accounts'];
      folders: MailFolder[];
    }>('/api/accounts', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  syncAccount: (accountId: string) =>
    request<{
      ok: boolean;
      fetched: number;
      capabilities: string[];
      accounts: BootstrapPayload['accounts'];
      folders: MailFolder[];
    }>(`/api/accounts/${encodeURIComponent(accountId)}/sync`, {
      method: 'POST',
    }),

  deleteAccount: (accountId: string) =>
    request<{ ok: boolean; accounts: BootstrapPayload['accounts']; folders: MailFolder[] }>(
      `/api/accounts/${encodeURIComponent(accountId)}`,
      { method: 'DELETE' }
    ),

  createEvent: (payload: Omit<CalendarEvent, 'id'>) =>
    request<{ ok: boolean; id: string }>('/api/calendar', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateEvent: (id: string, patch: Partial<CalendarEvent>) =>
    request<{ ok: boolean }>(`/api/calendar/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  deleteEvent: (id: string) =>
    request<{ ok: boolean }>(`/api/calendar/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  rsvpInvite: (messageId: string, response: 'accepted' | 'tentative' | 'declined') =>
    request<{ ok: boolean; invite: MailMessage['meetingInvite'] }>('/api/calendar/rsvp', {
      method: 'POST',
      body: JSON.stringify({ messageId, response }),
    }),

  createContact: (payload: Omit<ContactRecord, 'id' | 'avatarUrl'>) =>
    request<{ ok: boolean; id: string }>('/api/contacts', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateContact: (id: string, patch: Partial<ContactRecord>) =>
    request<{ ok: boolean }>(`/api/contacts/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  deleteContact: (id: string) =>
    request<{ ok: boolean }>(`/api/contacts/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  createTask: (payload: {
    accountId: string;
    title: string;
    notes?: string;
    isImportant?: boolean;
    dueDate?: number | null;
    listName?: 'My Day' | 'Tasks' | 'Flagged Email';
    linkedMessageId?: string | null;
  }) =>
    request<{ ok: boolean; id: string }>('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateTask: (id: string, patch: Partial<TaskItem>) =>
    request<{ ok: boolean }>(`/api/tasks/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  deleteTask: (id: string) =>
    request<{ ok: boolean }>(`/api/tasks/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  createRule: (payload: Omit<MailRule, 'id'>) =>
    request<{ ok: boolean; id: string }>('/api/rules', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  toggleRule: (id: string, enabled: boolean) =>
    request<{ ok: boolean }>(`/api/rules/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    }),

  deleteRule: (id: string) =>
    request<{ ok: boolean }>(`/api/rules/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  runRules: (accountId: string) =>
    request<{ ok: boolean; processed: number }>('/api/rules/run', {
      method: 'POST',
      body: JSON.stringify({ accountId }),
    }),

  updateSettings: (patch: Partial<AppSettings>) =>
    request<{ ok: boolean; settings: AppSettings }>('/api/settings', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  saveAttachment: (messageId: string, attachmentId: string) =>
    window.ducklookApi.saveAttachment(messageId, attachmentId),
};
