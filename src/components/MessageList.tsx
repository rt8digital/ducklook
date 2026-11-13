import {
  Archive,
  ArrowUpDown,
  Filter,
  Flag,
  Inbox,
  Mail,
  MailOpen,
  Paperclip,
  Trash2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { FocusedBucket, MailFolder, MailMessage } from '../types';
import { formatListTimestamp, getCategoryColor } from '../utils/formatters';
import { Avatar } from './Avatar';

interface MessageListProps {
  folder: MailFolder | undefined;
  messages: MailMessage[];
  loading: boolean;
  selectedId: string | null;
  checkedIds: Set<string>;
  selectMode: boolean;
  focusedInboxEnabled: boolean;
  activeBucket: FocusedBucket;
  onChangeBucket: (b: FocusedBucket) => void;
  filter: 'all' | 'unread' | 'flagged' | 'attachments';
  onChangeFilter: (f: 'all' | 'unread' | 'flagged' | 'attachments') => void;
  sort: 'date_desc' | 'date_asc' | 'sender' | 'subject';
  onChangeSort: (s: 'date_desc' | 'date_asc' | 'sender' | 'subject') => void;
  density: 'comfortable' | 'compact';
  onSelectMessage: (msg: MailMessage) => void;
  onToggleCheck: (id: string) => void;
  onToggleCheckAll: () => void;
  onQuickToggleRead: (msg: MailMessage) => void;
  onQuickToggleFlag: (msg: MailMessage) => void;
  onQuickDelete: (msg: MailMessage) => void;
  onQuickArchive: (msg: MailMessage) => void;
  onComposeNew: () => void;
  avatarLookup: Record<string, string | null>;
}

export function MessageList({
  folder,
  messages,
  loading,
  selectedId,
  checkedIds,
  selectMode,
  focusedInboxEnabled,
  activeBucket,
  onChangeBucket,
  filter,
  onChangeFilter,
  sort,
  onChangeSort,
  density,
  onSelectMessage,
  onToggleCheck,
  onToggleCheckAll,
  onQuickToggleRead,
  onQuickToggleFlag,
  onQuickDelete,
  onQuickArchive,
  onComposeNew,
  avatarLookup,
}: MessageListProps) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
        setSortOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const showFocusedTabs = focusedInboxEnabled && folder?.role === 'inbox';
  const allChecked = messages.length > 0 && messages.every((m) => checkedIds.has(m.id));

  const handleListKeyDown = (e: React.KeyboardEvent) => {
    if (messages.length === 0) return;
    const idx = messages.findIndex((m) => m.id === selectedId);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = messages[Math.min(messages.length - 1, idx + 1)];
      if (next) onSelectMessage(next);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = messages[Math.max(0, idx <= 0 ? 0 : idx - 1)];
      if (prev) onSelectMessage(prev);
    }
  };

  return (
    <section
      aria-label={folder ? `${folder.name} message list` : 'Message list'}
      className="h-full flex flex-col bg-white dark:bg-[#1F1F23] border-r border-neutral-200 dark:border-neutral-800 select-none"
    >
      {/* List Header */}
      <div
        ref={menuRef}
        className="px-3 py-2 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-2 shrink-0"
      >
        <div className="flex items-center gap-2 min-w-0">
          {selectMode && (
            <input
              type="checkbox"
              checked={allChecked}
              onChange={onToggleCheckAll}
              aria-label="Select all visible messages"
              className="w-4 h-4 rounded border-neutral-300 text-[#0F6CBD] focus:ring-[#0F6CBD] cursor-pointer"
            />
          )}

          {showFocusedTabs ? (
            <div
              role="tablist"
              aria-label="Inbox priority"
              className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 p-0.5 rounded-md"
            >
              {(['focused', 'other'] as const).map((b) => (
                <button
                  key={b}
                  type="button"
                  role="tab"
                  aria-selected={activeBucket === b}
                  onClick={() => onChangeBucket(b)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors capitalize whitespace-nowrap ${
                    activeBucket === b
                      ? 'bg-white dark:bg-[#2C2C32] text-[#0F6CBD] dark:text-[#479EF5] shadow-2xs'
                      : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>
          ) : (
            <h2 className="font-display font-semibold text-sm text-[#242424] dark:text-neutral-100 truncate">
              {folder?.name || 'Messages'}
            </h2>
          )}
        </div>

        {/* Filter & Sort Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setFilterOpen((v) => !v);
                setSortOpen(false);
              }}
              aria-expanded={filterOpen}
              aria-label="Filter messages"
              className={`h-7 px-2 rounded text-xs font-medium inline-flex items-center gap-1 transition-colors whitespace-nowrap ${
                filter !== 'all'
                  ? 'bg-[#CFE4FA] dark:bg-[#1E3A5F] text-[#0F6CBD] dark:text-white'
                  : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              <Filter className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="capitalize">{filter === 'all' ? 'Filter' : filter}</span>
            </button>
            {filterOpen && (
              <div className="absolute right-0 mt-1 w-40 bg-white dark:bg-[#2A2A2E] border border-neutral-200 dark:border-neutral-700 rounded-md shadow-lg py-1 z-30">
                {(['all', 'unread', 'flagged', 'attachments'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => {
                      onChangeFilter(f);
                      setFilterOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs capitalize hover:bg-neutral-100 dark:hover:bg-neutral-700 ${
                      filter === f ? 'font-semibold text-[#0F6CBD] dark:text-[#479EF5]' : ''
                    }`}
                  >
                    {f === 'attachments' ? 'Has attachments' : f}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setSortOpen((v) => !v);
                setFilterOpen(false);
              }}
              aria-expanded={sortOpen}
              aria-label="Sort messages"
              className="h-7 px-2 rounded text-xs font-medium inline-flex items-center gap-1 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors whitespace-nowrap"
            >
              <ArrowUpDown className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Sort</span>
            </button>
            {sortOpen && (
              <div className="absolute right-0 mt-1 w-40 bg-white dark:bg-[#2A2A2E] border border-neutral-200 dark:border-neutral-700 rounded-md shadow-lg py-1 z-30">
                {[
                  { id: 'date_desc', label: 'Newest on top' },
                  { id: 'date_asc', label: 'Oldest on top' },
                  { id: 'sender', label: 'From (A-Z)' },
                  { id: 'subject', label: 'Subject (A-Z)' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      onChangeSort(opt.id as typeof sort);
                      setSortOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-700 ${
                      sort === opt.id ? 'font-semibold text-[#0F6CBD] dark:text-[#479EF5]' : ''
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Scrollable Message List */}
      <div
        ref={listRef}
        role="listbox"
        aria-label="Emails"
        tabIndex={0}
        onKeyDown={handleListKeyDown}
        className="flex-1 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800/80 focus:outline-none"
      >
        {loading ? (
          <div className="p-3 space-y-3" aria-busy="true" aria-label="Loading messages">
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="flex items-start gap-3 py-2 animate-pulse">
                <div className="w-9 h-9 rounded-full bg-neutral-200 dark:bg-neutral-800 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-1/2 bg-neutral-200 dark:bg-neutral-800 rounded" />
                  <div className="h-3 w-4/5 bg-neutral-100 dark:bg-neutral-800/70 rounded" />
                  <div className="h-2.5 w-3/5 bg-neutral-100 dark:bg-neutral-800/50 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center">
            <Inbox className="w-10 h-10 text-neutral-300 dark:text-neutral-600 mb-3" aria-hidden="true" />
            <p className="font-display font-semibold text-sm text-neutral-800 dark:text-neutral-200">
              Nothing in {folder?.name || 'this view'}
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-[240px]">
              {filter !== 'all'
                ? 'Try clearing your active filter or switching between Focused and Other.'
                : 'Messages you receive or move here will appear in this list.'}
            </p>
            <button
              type="button"
              onClick={onComposeNew}
              className="mt-4 px-3.5 py-1.5 rounded-md bg-[#0F6CBD] hover:bg-[#0D5CA3] text-white text-xs font-medium"
            >
              Compose new mail
            </button>
          </div>
        ) : (
          messages.map((msg) => {
            const isSelected = msg.id === selectedId;
            const isChecked = checkedIds.has(msg.id);
            const avatarSrc = avatarLookup[msg.fromEmail.toLowerCase()] || null;
            const padY = density === 'compact' ? 'py-2' : 'py-3';

            return (
              <div
                key={msg.id}
                role="option"
                aria-selected={isSelected}
                tabIndex={-1}
                onClick={() => onSelectMessage(msg)}
                className={`group relative px-3 ${padY} flex items-start gap-2.5 cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-[#EFF6FC] dark:bg-[#1B2A3A]'
                    : !msg.isRead
                    ? 'bg-white dark:bg-[#232329] hover:bg-neutral-50 dark:hover:bg-[#28282E]'
                    : 'bg-white dark:bg-[#1F1F23] hover:bg-neutral-50 dark:hover:bg-[#26262B]'
                }`}
              >
                {/* Unread Indicator / Multi-select Checkbox */}
                <div className="pt-1 flex items-center gap-1.5 shrink-0">
                  {selectMode || isChecked ? (
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => onToggleCheck(msg.id)}
                      aria-label={`Select message from ${msg.fromName}`}
                      className="w-4 h-4 rounded border-neutral-300 text-[#0F6CBD] focus:ring-[#0F6CBD] cursor-pointer"
                    />
                  ) : (
                    <div className="relative">
                      <Avatar name={msg.fromName} email={msg.fromEmail} src={avatarSrc} size="md" />
                      {!msg.isRead && (
                        <span
                          aria-label="Unread"
                          className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#0F6CBD] dark:bg-[#479EF5]"
                        />
                      )}
                    </div>
                  )}
                </div>

                {/* Message Summary */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-[13px] truncate ${
                        !msg.isRead
                          ? 'font-semibold text-[#242424] dark:text-white'
                          : 'font-medium text-neutral-700 dark:text-neutral-200'
                      }`}
                    >
                      {msg.isDraft ? (
                        <span className="text-[#C50F1F] dark:text-red-400 mr-1">[Draft]</span>
                      ) : null}
                      {msg.fromName}
                    </span>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {msg.hasAttachments && (
                        <Paperclip className="w-3.5 h-3.5 text-neutral-400" aria-label="Has attachments" />
                      )}
                      {msg.isFlagged && (
                        <Flag
                          className="w-3.5 h-3.5 text-[#C50F1F] fill-[#C50F1F]"
                          aria-label="Flagged"
                        />
                      )}
                      <span
                        className={`text-[11px] tabular-nums ${
                          !msg.isRead
                            ? 'font-semibold text-[#0F6CBD] dark:text-[#479EF5]'
                            : 'text-neutral-500 dark:text-neutral-400'
                        }`}
                      >
                        {formatListTimestamp(msg.dateTs)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 mt-0.5">
                    {msg.importance === 'high' && (
                      <span
                        title="High importance"
                        className="text-xs font-bold text-[#C50F1F] dark:text-red-400 shrink-0"
                      >
                        !
                      </span>
                    )}
                    <p
                      className={`text-[13px] truncate ${
                        !msg.isRead
                          ? 'font-semibold text-[#0F6CBD] dark:text-[#479EF5]'
                          : 'text-neutral-800 dark:text-neutral-200'
                      }`}
                    >
                      {msg.subject || '(No subject)'}
                    </p>
                  </div>

                  {density === 'comfortable' && (
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                      {msg.snippet || 'No preview available'}
                    </p>
                  )}

                  {msg.categories.length > 0 && (
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-neutral-600 dark:text-neutral-400 truncate">
                      {msg.categories.map((cat) => (
                        <span key={cat} className="inline-flex items-center gap-1 shrink-0">
                          <span
                            className="w-2 h-2 rounded-xs inline-block"
                            style={{ backgroundColor: getCategoryColor(cat) }}
                            aria-hidden="true"
                          />
                          <span>{cat}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Hover Quick Actions */}
                <div
                  className="hidden group-hover:flex group-focus-within:flex items-center gap-0.5 absolute right-2 bottom-2 bg-white/95 dark:bg-[#2A2A30]/95 border border-neutral-200 dark:border-neutral-700 rounded shadow-xs px-1 py-0.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => onQuickToggleRead(msg)}
                    title={msg.isRead ? 'Mark as unread' : 'Mark as read'}
                    aria-label={msg.isRead ? 'Mark as unread' : 'Mark as read'}
                    className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300"
                  >
                    {msg.isRead ? <Mail className="w-3.5 h-3.5" /> : <MailOpen className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => onQuickToggleFlag(msg)}
                    title={msg.isFlagged ? 'Unflag' : 'Flag'}
                    aria-label={msg.isFlagged ? 'Unflag' : 'Flag'}
                    className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300"
                  >
                    <Flag className={`w-3.5 h-3.5 ${msg.isFlagged ? 'text-[#C50F1F] fill-[#C50F1F]' : ''}`} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onQuickArchive(msg)}
                    title="Archive"
                    aria-label="Archive message"
                    className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300"
                  >
                    <Archive className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onQuickDelete(msg)}
                    title="Delete"
                    aria-label="Delete message"
                    className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-600 dark:text-red-400 hover:text-red-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
