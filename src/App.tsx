import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppRail, type ActiveModule } from './components/AppRail';
import { CalendarView } from './components/CalendarView';
import { ComposeModal, type ComposeInitialState } from './components/ComposeModal';
import { ContactsView } from './components/ContactsView';
import { FolderPane } from './components/FolderPane';
import { MailRibbon } from './components/MailRibbon';
import { MessageList } from './components/MessageList';
import { MyDayDrawer } from './components/MyDayDrawer';
import { ReadingPane } from './components/ReadingPane';
import { SettingsModal, type SettingsTab } from './components/SettingsModal';
import { ShortcutsModal } from './components/ShortcutsModal';
import { TasksView } from './components/TasksView';
import { TopBar } from './components/TopBar';
import { WelcomeView } from './components/WelcomeView';
import type {
  AppSettings,
  CalendarEvent,
  ContactRecord,
  FocusedBucket,
  MailAccount,
  MailFolder,
  MailMessage,
  MailRule,
  TaskItem,
} from './types';
import { api } from './utils/api';

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  readingPanePosition: 'right',
  density: 'comfortable',
  focusedInboxEnabled: true,
  conversationView: true,
  signatureHtml: '',
  signatureEnabled: true,
  autoReplyEnabled: false,
  autoReplyMessage: '',
  syncIntervalSec: 120,
};

export default function App() {
  const [bootstrapping, setBootstrapping] = useState(true);
  const [accounts, setAccounts] = useState<MailAccount[]>([]);
  const [folders, setFolders] = useState<MailFolder[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [rules, setRules] = useState<MailRule[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  // Navigation & Selection State
  const [activeModule, setActiveModule] = useState<ActiveModule>('mail');
  const [activeAccountId, setActiveAccountId] = useState<string>('');
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
  const [activeBucket, setActiveBucket] = useState<FocusedBucket>('focused');
  const [filter, setFilter] = useState<'all' | 'unread' | 'flagged' | 'attachments'>('all');
  const [sort, setSort] = useState<'date_desc' | 'date_asc' | 'sender' | 'subject'>('date_desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchScope, setSearchScope] = useState<'folder' | 'all'>('folder');

  const [messages, setMessages] = useState<MailMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [activeMessage, setActiveMessage] = useState<MailMessage | null>(null);
  const [threadMessages, setThreadMessages] = useState<MailMessage[]>([]);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [mobileShowReading, setMobileShowReading] = useState(false);
  const [mobileFoldersOpen, setMobileFoldersOpen] = useState(false);

  // Overlays
  const [composeState, setComposeState] = useState<ComposeInitialState | null>(null);
  const [myDayOpen, setMyDayOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('accounts');
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string>('');

  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const announce = useCallback((text: string) => {
    setStatusNotice(text);
    window.setTimeout(() => {
      setStatusNotice((curr) => (curr === text ? '' : curr));
    }, 3600);
  }, []);

  // Sync dark mode class on <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.theme === 'dark');
  }, [settings.theme]);

  const reloadBootstrap = useCallback(async () => {
    const data = await api.bootstrap();
    setAccounts(data.accounts);
    setFolders(data.folders);
    setEvents(data.events);
    setContacts(data.contacts);
    setTasks(data.tasks);
    setRules(data.rules);
    setSettings(data.settings);
    return data;
  }, []);

  useEffect(() => {
    reloadBootstrap()
      .then((data) => {
        const defaultAcc = data.accounts[0]?.id || '';
        setActiveAccountId(defaultAcc);
        const inbox = data.folders.find((f) => f.accountId === defaultAcc && f.role === 'inbox') || data.folders[0];
        if (inbox) setSelectedFolderId(inbox.id);
      })
      .finally(() => setBootstrapping(false));
  }, [reloadBootstrap]);

  const currentFolder = useMemo(
    () => folders.find((f) => f.id === selectedFolderId),
    [folders, selectedFolderId]
  );

  const activeAccount = useMemo(
    () => accounts.find((a) => a.id === activeAccountId) || accounts[0],
    [accounts, activeAccountId]
  );

  const avatarLookup = useMemo(() => {
    const map: Record<string, string | null> = {};
    for (const acc of accounts) {
      if (acc.avatarUrl) map[acc.email.toLowerCase()] = acc.avatarUrl;
    }
    for (const c of contacts) {
      if (c.avatarUrl) map[c.email.toLowerCase()] = c.avatarUrl;
    }
    return map;
  }, [accounts, contacts]);

  const fetchMessages = useCallback(async () => {
    if (!selectedFolderId && searchScope !== 'all') return;
    setLoadingMessages(true);
    try {
      const bucketParam =
        settings.focusedInboxEnabled && currentFolder?.role === 'inbox' && !searchQuery
          ? activeBucket
          : '';
      const res = await api.getMessages({
        accountId: activeAccountId,
        folderId: selectedFolderId,
        bucket: bucketParam,
        q: searchQuery,
        filter,
        sort,
        scope: searchQuery && searchScope === 'all' ? 'all' : 'folder',
      });
      setMessages(res.messages);
    } finally {
      setLoadingMessages(false);
    }
  }, [
    activeAccountId,
    selectedFolderId,
    settings.focusedInboxEnabled,
    currentFolder?.role,
    activeBucket,
    searchQuery,
    filter,
    sort,
    searchScope,
  ]);

  useEffect(() => {
    if (!bootstrapping) {
      fetchMessages();
    }
  }, [bootstrapping, fetchMessages]);

  const loadMessageDetail = useCallback(async (id: string) => {
    const res = await api.getMessageDetail(id);
    setActiveMessage(res.message);
    setThreadMessages(res.threadMessages);
  }, []);

  const handleSelectMessage = useCallback(
    async (msg: MailMessage) => {
      setSelectedMessageId(msg.id);
      setMobileShowReading(true);
      await loadMessageDetail(msg.id);
      if (!msg.isRead) {
        const res = await api.updateMessage(msg.id, { isRead: true });
        setFolders(res.folders);
        setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, isRead: true } : m)));
        setActiveMessage((curr) => (curr && curr.id === msg.id ? { ...curr, isRead: true } : curr));
      }
    },
    [loadMessageDetail]
  );

  // Auto-select first message when list updates and none selected on desktop
  useEffect(() => {
    if (messages.length > 0 && !selectedMessageId) {
      setSelectedMessageId(messages[0].id);
      loadMessageDetail(messages[0].id);
    } else if (messages.length === 0) {
      setActiveMessage(null);
      setThreadMessages([]);
    }
  }, [messages, selectedMessageId, loadMessageDetail]);

  const openNewCompose = useCallback(() => {
    setComposeState({
      accountId: activeAccountId,
      to: [],
      cc: [],
      bcc: [],
      subject: '',
      htmlBody: '',
      importance: 'normal',
    });
  }, [activeAccountId]);

  const openReplyCompose = useCallback(
    (msg: MailMessage, mode: 'reply' | 'replyAll' | 'forward') => {
      const prefix = mode === 'forward' ? 'Fwd: ' : 'Re: ';
      const cleanSubj = msg.subject.replace(/^(re|fwd|fw)\s*:\s*/gi, '').trim();
      const subject = `${prefix}${cleanSubj}`;

      let to: Array<{ name: string; address: string }> = [];
      let cc: Array<{ name: string; address: string }> = [];

      if (mode === 'reply') {
        to = [{ name: msg.fromName, address: msg.fromEmail }];
      } else if (mode === 'replyAll') {
        const selfEmail = activeAccount?.email.toLowerCase() || '';
        const candidates = [{ name: msg.fromName, address: msg.fromEmail }, ...msg.to];
        to = candidates.filter(
          (p, i, arr) =>
            p.address.toLowerCase() !== selfEmail &&
            arr.findIndex((x) => x.address.toLowerCase() === p.address.toLowerCase()) === i
        );
        cc = msg.cc.filter((p) => p.address.toLowerCase() !== selfEmail);
      }

      const quotedHeader = `<br/><br/><hr/><p style="font-size:12px;color:#666"><strong>From:</strong> ${msg.fromName} &lt;${msg.fromEmail}&gt;<br/><strong>Sent:</strong> ${new Date(
        msg.dateTs
      ).toLocaleString()}<br/><strong>Subject:</strong> ${msg.subject}</p><blockquote>${msg.htmlBody}</blockquote>`;

      setComposeState({
        accountId: msg.accountId,
        to,
        cc,
        bcc: [],
        subject,
        htmlBody: quotedHeader,
        inReplyTo: mode === 'forward' ? null : msg.messageIdHeader,
        referencesHeader: mode === 'forward' ? null : [msg.referencesHeader, msg.messageIdHeader].filter(Boolean).join(' '),
        threadId: mode === 'forward' ? null : msg.threadId,
        importance: 'normal',
      });
    },
    [activeAccount?.email]
  );

  const openDraftCompose = useCallback((msg: MailMessage) => {
    setComposeState({
      draftId: msg.id,
      accountId: msg.accountId,
      to: msg.to,
      cc: msg.cc,
      bcc: msg.bcc,
      subject: msg.subject,
      htmlBody: msg.htmlBody,
      inReplyTo: msg.inReplyTo,
      referencesHeader: msg.referencesHeader,
      threadId: msg.threadId,
      importance: msg.importance,
    });
  }, []);

  const targetIds = useMemo(() => {
    if (checkedIds.size > 0) return Array.from(checkedIds);
    return selectedMessageId ? [selectedMessageId] : [];
  }, [checkedIds, selectedMessageId]);

  const handleBulkAction = useCallback(
    async (
      action: 'mark_read' | 'mark_unread' | 'flag' | 'unflag' | 'move' | 'archive' | 'junk' | 'delete' | 'categorize',
      extra?: { folderId?: string; category?: string }
    ) => {
      if (targetIds.length === 0) return;
      const res = await api.bulkAction({ ids: targetIds, action, ...extra });
      setFolders(res.folders);
      setCheckedIds(new Set());
      if (action === 'delete' || action === 'archive' || action === 'junk' || action === 'move') {
        if (selectedMessageId && targetIds.includes(selectedMessageId)) {
          setSelectedMessageId(null);
          setMobileShowReading(false);
        }
      }
      await fetchMessages();
      if (selectedMessageId && !targetIds.includes(selectedMessageId)) {
        await loadMessageDetail(selectedMessageId);
      }
      announce(`Updated ${targetIds.length} message${targetIds.length > 1 ? 's' : ''}`);
    },
    [targetIds, selectedMessageId, fetchMessages, loadMessageDetail, announce]
  );

  const handleSync = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const res = await api.syncAccount(activeAccountId);
      setAccounts(res.accounts);
      setFolders(res.folders);
      await fetchMessages();
      announce(
        res.fetched > 0
          ? `Synced ${res.fetched} new message${res.fetched > 1 ? 's' : ''}`
          : 'Mailbox is up to date'
      );
    } catch (err) {
      announce(`Sync issue: ${(err as Error).message}`);
    } finally {
      setIsSyncing(false);
    }
  }, [activeAccountId, isSyncing, fetchMessages, announce]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (isInput) return;
      if (composeState || settingsOpen || shortcutsOpen) return;

      if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === '?') {
        e.preventDefault();
        setShortcutsOpen(true);
      } else if (e.key.toLowerCase() === 'c') {
        e.preventDefault();
        openNewCompose();
      } else if (e.key.toLowerCase() === 'r' && activeMessage && activeModule === 'mail') {
        e.preventDefault();
        openReplyCompose(activeMessage, 'reply');
      } else if (e.key.toLowerCase() === 'f' && activeMessage && activeModule === 'mail') {
        e.preventDefault();
        openReplyCompose(activeMessage, 'forward');
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && targetIds.length > 0 && activeModule === 'mail') {
        e.preventDefault();
        handleBulkAction('delete');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    composeState,
    settingsOpen,
    shortcutsOpen,
    activeMessage,
    activeModule,
    targetIds.length,
    openNewCompose,
    openReplyCompose,
    handleBulkAction,
  ]);

  const unreadInboxCount = useMemo(
    () => folders.filter((f) => f.role === 'inbox').reduce((sum, f) => sum + f.unreadCount, 0),
    [folders]
  );

  const selectedMsgObj = useMemo(
    () => messages.find((m) => m.id === selectedMessageId) || activeMessage,
    [messages, selectedMessageId, activeMessage]
  );

  if (bootstrapping) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#F5F5F5] dark:bg-[#141414]">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-[#0F6CBD] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="font-display text-sm font-medium text-neutral-600 dark:text-neutral-300">
            Loading DuckLook workspace...
          </p>
        </div>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <WelcomeView
        onComplete={(nextAccounts, nextFolders) => {
          setAccounts(nextAccounts);
          setFolders(nextFolders);
          const account = nextAccounts[0];
          if (!account) return;
          setActiveAccountId(account.id);
          const inbox = nextFolders.find((f) => f.accountId === account.id && f.role === 'inbox');
          if (inbox) setSelectedFolderId(inbox.id);
        }}
      />
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#F5F5F5] dark:bg-[#141414] text-[#242424] dark:text-[#F0F0F0]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-2 focus:bg-[#0F6CBD] focus:text-white focus:rounded-md focus:text-xs focus:font-semibold"
      >
        Skip to main content
      </a>

      <TopBar
        activeAccount={activeAccount}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchScope={searchScope}
        onSearchScopeChange={setSearchScope}
        theme={settings.theme}
        onToggleTheme={async () => {
          const next = settings.theme === 'dark' ? 'light' : 'dark';
          const res = await api.updateSettings({ theme: next });
          setSettings(res.settings);
        }}
        myDayOpen={myDayOpen}
        onToggleMyDay={() => setMyDayOpen((v) => !v)}
        onOpenSettings={(tab = 'accounts') => {
          setSettingsTab(tab);
          setSettingsOpen(true);
        }}
        onOpenShortcuts={() => setShortcutsOpen(true)}
        showFolderToggle={activeModule === 'mail'}
        onToggleMobileFolders={() => setMobileFoldersOpen((v) => !v)}
        searchInputRef={searchInputRef}
      />

      <div className="flex-1 flex overflow-hidden pb-14 md:pb-0">
        <AppRail
          activeModule={activeModule}
          onSelectModule={setActiveModule}
          unreadInboxCount={unreadInboxCount}
        />

        <main id="main-content" className="flex-1 flex overflow-hidden min-w-0">
          {activeModule === 'mail' && (
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">
              <MailRibbon
                onComposeNew={openNewCompose}
                hasSelection={targetIds.length > 0}
                selectionCount={targetIds.length}
                selectedIsRead={selectedMsgObj?.isRead}
                selectedIsFlagged={selectedMsgObj?.isFlagged}
                onDelete={() => handleBulkAction('delete')}
                onArchive={() => handleBulkAction('archive')}
                onJunk={() => handleBulkAction('junk')}
                onToggleRead={() => handleBulkAction(selectedMsgObj?.isRead ? 'mark_unread' : 'mark_read')}
                onToggleFlag={() => handleBulkAction(selectedMsgObj?.isFlagged ? 'unflag' : 'flag')}
                onMoveTo={(folderId) => handleBulkAction('move', { folderId })}
                onCategorize={(category) => handleBulkAction('categorize', { category })}
                onSync={handleSync}
                isSyncing={isSyncing}
                folders={folders.filter((f) => f.accountId === activeAccountId)}
                readingPanePosition={settings.readingPanePosition}
                onChangeReadingPane={async (pos) => {
                  const res = await api.updateSettings({ readingPanePosition: pos });
                  setSettings(res.settings);
                }}
                selectMode={selectMode}
                onToggleSelectMode={() => {
                  setSelectMode((v) => !v);
                  setCheckedIds(new Set());
                }}
              />

              <div className="flex-1 flex overflow-hidden min-w-0">
                <FolderPane
                  accounts={accounts}
                  folders={folders}
                  selectedFolderId={selectedFolderId}
                  onSelectFolder={(folderId, accountId) => {
                    setSelectedFolderId(folderId);
                    setActiveAccountId(accountId);
                    setSelectedMessageId(null);
                    setCheckedIds(new Set());
                    setMobileShowReading(false);
                  }}
                  onCreateFolder={async (accountId, name) => {
                    const res = await api.createFolder(accountId, name);
                    setFolders(res.folders);
                    announce(`Folder "${name}" created`);
                  }}
                  onDeleteFolder={async (folderId) => {
                    const res = await api.deleteFolder(folderId);
                    setFolders(res.folders);
                    if (selectedFolderId === folderId) {
                      const inbox = res.folders.find((f) => f.role === 'inbox');
                      if (inbox) setSelectedFolderId(inbox.id);
                    }
                    announce('Folder deleted');
                  }}
                  onEmptyFolder={async (folderId) => {
                    const res = await api.emptyFolder(folderId);
                    setFolders(res.folders);
                    await fetchMessages();
                    announce('Folder emptied');
                  }}
                  onOpenAddAccount={() => {
                    setSettingsTab('accounts');
                    setSettingsOpen(true);
                  }}
                  mobileOpen={mobileFoldersOpen}
                  onCloseMobile={() => setMobileFoldersOpen(false)}
                />

                {/* Message List + Reading Pane Container */}
                <div
                  className={`flex-1 flex min-w-0 overflow-hidden ${
                    settings.readingPanePosition === 'bottom' ? 'flex-col' : 'flex-row'
                  }`}
                >
                  <div
                    className={`${
                      mobileShowReading && settings.readingPanePosition !== 'off'
                        ? 'hidden md:block'
                        : 'block'
                    } ${
                      settings.readingPanePosition === 'off'
                        ? 'flex-1'
                        : settings.readingPanePosition === 'bottom'
                        ? 'h-[45%] shrink-0 border-b border-neutral-200 dark:border-neutral-800'
                        : 'w-full md:w-[350px] xl:w-[390px] shrink-0'
                    } overflow-hidden`}
                  >
                    <MessageList
                      folder={currentFolder}
                      messages={messages}
                      loading={loadingMessages}
                      selectedId={selectedMessageId}
                      checkedIds={checkedIds}
                      selectMode={selectMode}
                      focusedInboxEnabled={settings.focusedInboxEnabled}
                      activeBucket={activeBucket}
                      onChangeBucket={setActiveBucket}
                      filter={filter}
                      onChangeFilter={setFilter}
                      sort={sort}
                      onChangeSort={setSort}
                      density={settings.density}
                      onSelectMessage={handleSelectMessage}
                      onToggleCheck={(id) => {
                        setCheckedIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(id)) next.delete(id);
                          else next.add(id);
                          return next;
                        });
                      }}
                      onToggleCheckAll={() => {
                        if (messages.every((m) => checkedIds.has(m.id))) {
                          setCheckedIds(new Set());
                        } else {
                          setCheckedIds(new Set(messages.map((m) => m.id)));
                        }
                      }}
                      onQuickToggleRead={async (msg) => {
                        const res = await api.updateMessage(msg.id, { isRead: !msg.isRead });
                        setFolders(res.folders);
                        setMessages((prev) =>
                          prev.map((m) => (m.id === msg.id ? { ...m, isRead: !msg.isRead } : m))
                        );
                      }}
                      onQuickToggleFlag={async (msg) => {
                        const res = await api.updateMessage(msg.id, { isFlagged: !msg.isFlagged });
                        setFolders(res.folders);
                        setMessages((prev) =>
                          prev.map((m) => (m.id === msg.id ? { ...m, isFlagged: !msg.isFlagged } : m))
                        );
                        if (activeMessage?.id === msg.id) {
                          setActiveMessage({ ...activeMessage, isFlagged: !msg.isFlagged });
                        }
                      }}
                      onQuickArchive={async (msg) => {
                        const res = await api.bulkAction({ ids: [msg.id], action: 'archive' });
                        setFolders(res.folders);
                        if (selectedMessageId === msg.id) setSelectedMessageId(null);
                        await fetchMessages();
                        announce('Moved to Archive');
                      }}
                      onQuickDelete={async (msg) => {
                        const res = await api.deleteMessage(msg.id);
                        setFolders(res.folders);
                        if (selectedMessageId === msg.id) setSelectedMessageId(null);
                        await fetchMessages();
                        announce('Message deleted');
                      }}
                      onComposeNew={openNewCompose}
                      avatarLookup={avatarLookup}
                    />
                  </div>

                  {settings.readingPanePosition !== 'off' && (
                    <div
                      className={`${
                        mobileShowReading ? 'flex' : 'hidden md:flex'
                      } flex-1 flex-col min-w-0 overflow-hidden`}
                    >
                      <ReadingPane
                        message={activeMessage}
                        threadMessages={threadMessages}
                        conversationView={settings.conversationView}
                        onBackMobile={() => setMobileShowReading(false)}
                        onReply={openReplyCompose}
                        onEditDraft={openDraftCompose}
                        onDelete={async (msg) => {
                          const res = await api.deleteMessage(msg.id);
                          setFolders(res.folders);
                          setSelectedMessageId(null);
                          setMobileShowReading(false);
                          await fetchMessages();
                          announce('Message deleted');
                        }}
                        onToggleFlag={async (msg) => {
                          const res = await api.updateMessage(msg.id, { isFlagged: !msg.isFlagged });
                          setFolders(res.folders);
                          setMessages((prev) =>
                            prev.map((m) => (m.id === msg.id ? { ...m, isFlagged: !msg.isFlagged } : m))
                          );
                          setActiveMessage({ ...msg, isFlagged: !msg.isFlagged });
                        }}
                        onRsvpInvite={async (messageId, response) => {
                          const res = await api.rsvpInvite(messageId, response);
                          if (activeMessage && activeMessage.id === messageId) {
                            setActiveMessage({ ...activeMessage, meetingInvite: res.invite });
                          }
                          await reloadBootstrap();
                          announce(`Invitation ${response}`);
                        }}
                        onQuickReplySend={async (parentMsg, bodyText) => {
                          const cleanSubj = parentMsg.subject.replace(/^(re|fwd|fw)\s*:\s*/gi, '').trim();
                          await api.sendMessage({
                            accountId: parentMsg.accountId,
                            to: [{ name: parentMsg.fromName, address: parentMsg.fromEmail }],
                            subject: `Re: ${cleanSubj}`,
                            htmlBody: `<p>${bodyText.replace(/\n/g, '<br/>')}</p>`,
                            textBody: bodyText,
                            inReplyTo: parentMsg.messageIdHeader,
                            referencesHeader: [parentMsg.referencesHeader, parentMsg.messageIdHeader]
                              .filter(Boolean)
                              .join(' '),
                            threadId: parentMsg.threadId,
                          });
                          await loadMessageDetail(parentMsg.id);
                          const data = await api.bootstrap();
                          setFolders(data.folders);
                          announce('Reply sent');
                        }}
                        avatarLookup={avatarLookup}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeModule === 'calendar' && (
            <div className="flex-1 min-w-0 overflow-hidden">
              <CalendarView
                events={events}
                activeAccountId={activeAccountId}
                onCreateEvent={async (payload) => {
                  await api.createEvent(payload);
                  await reloadBootstrap();
                  announce('Calendar event saved');
                }}
                onUpdateEvent={async (id, patch) => {
                  await api.updateEvent(id, patch);
                  await reloadBootstrap();
                  announce('Calendar event updated');
                }}
                onDeleteEvent={async (id) => {
                  await api.deleteEvent(id);
                  await reloadBootstrap();
                  announce('Calendar event deleted');
                }}
              />
            </div>
          )}

          {activeModule === 'contacts' && (
            <div className="flex-1 min-w-0 overflow-hidden">
              <ContactsView
                contacts={contacts}
                activeAccountId={activeAccountId}
                onCreateContact={async (payload) => {
                  await api.createContact(payload);
                  await reloadBootstrap();
                  announce('Contact created');
                }}
                onUpdateContact={async (id, patch) => {
                  await api.updateContact(id, patch);
                  await reloadBootstrap();
                }}
                onDeleteContact={async (id) => {
                  await api.deleteContact(id);
                  await reloadBootstrap();
                  announce('Contact deleted');
                }}
                onComposeToContact={(contact) => {
                  setComposeState({
                    accountId: activeAccountId,
                    to: [{ name: contact.displayName, address: contact.email }],
                    cc: [],
                    bcc: [],
                    subject: '',
                    htmlBody: '',
                  });
                }}
              />
            </div>
          )}

          {activeModule === 'tasks' && (
            <div className="flex-1 min-w-0 overflow-hidden">
              <TasksView
                tasks={tasks}
                activeAccountId={activeAccountId}
                onCreateTask={async (payload) => {
                  await api.createTask(payload);
                  await reloadBootstrap();
                }}
                onUpdateTask={async (id, patch) => {
                  await api.updateTask(id, patch);
                  await reloadBootstrap();
                }}
                onDeleteTask={async (id) => {
                  await api.deleteTask(id);
                  await reloadBootstrap();
                }}
              />
            </div>
          )}
        </main>

        <MyDayDrawer
          open={myDayOpen}
          onClose={() => setMyDayOpen(false)}
          events={events}
          tasks={tasks}
          activeAccountId={activeAccountId}
          onCreateTask={async (payload) => {
            await api.createTask(payload);
            await reloadBootstrap();
          }}
          onToggleTask={async (id, isCompleted) => {
            await api.updateTask(id, { isCompleted });
            await reloadBootstrap();
          }}
          onOpenCalendar={() => {
            setActiveModule('calendar');
            setMyDayOpen(false);
          }}
        />
      </div>

      {/* Compose Modal */}
      {composeState && (
        <ComposeModal
          initialState={composeState}
          accounts={accounts}
          contacts={contacts}
          signatureHtml={settings.signatureHtml}
          signatureEnabled={settings.signatureEnabled}
          onClose={() => setComposeState(null)}
          onSend={async (payload) => {
            const res = await api.sendMessage(payload);
            setFolders(res.folders);
            await fetchMessages();
            if (selectedMessageId) await loadMessageDetail(selectedMessageId);
            announce('Message sent');
          }}
          onSaveDraft={async (payload) => {
            const res = await api.saveDraft(payload);
            setFolders(res.folders);
            await fetchMessages();
            announce('Draft saved');
          }}
        />
      )}

      {/* Settings & Accounts Modal */}
      <SettingsModal
        open={settingsOpen}
        initialTab={settingsTab}
        onClose={() => setSettingsOpen(false)}
        accounts={accounts}
        folders={folders}
        rules={rules}
        settings={settings}
        onUpdateSettings={async (patch) => {
          const res = await api.updateSettings(patch);
          setSettings(res.settings);
          announce('Settings saved');
        }}
        onAccountsChanged={(nextAccounts, nextFolders) => {
          setAccounts(nextAccounts);
          setFolders(nextFolders);
          const newest = nextAccounts[nextAccounts.length - 1];
          if (newest) {
            setActiveAccountId(newest.id);
            const inbox = nextFolders.find((f) => f.accountId === newest.id && f.role === 'inbox');
            if (inbox) setSelectedFolderId(inbox.id);
          }
          fetchMessages();
          announce('Account configuration updated');
        }}
        onSyncAccount={async (accountId) => {
          const res = await api.syncAccount(accountId);
          setAccounts(res.accounts);
          setFolders(res.folders);
          await fetchMessages();
          announce(`Synced ${res.fetched} new message${res.fetched === 1 ? '' : 's'}`);
        }}
        onRulesChanged={async () => {
          await reloadBootstrap();
          await fetchMessages();
          announce('Rules updated');
        }}
      />

      {/* Keyboard Shortcuts Modal */}
      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      {/* Accessible Live Status Banner */}
      <div role="status" aria-live="polite" className="fixed bottom-16 md:bottom-4 right-4 z-50 pointer-events-none">
        {statusNotice && (
          <div className="px-3.5 py-2 rounded-md bg-[#242424] dark:bg-neutral-100 text-white dark:text-neutral-900 text-xs font-medium shadow-lg">
            {statusNotice}
          </div>
        )}
      </div>
    </div>
  );
}
