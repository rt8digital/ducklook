import DOMPurify from 'dompurify';
import {
  ArrowLeft,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  Code2,
  Download,
  Flag,
  Forward,
  HelpCircle,
  MailOpen,
  MapPin,
  Paperclip,
  PenSquare,
  Printer,
  Reply,
  ReplyAll,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { MailMessage } from '../types';
import { formatBytes, formatFullTimestamp, getCategoryColor } from '../utils/formatters';
import { api } from '../utils/api';
import { Avatar } from './Avatar';

interface ReadingPaneProps {
  message: MailMessage | null;
  threadMessages: MailMessage[];
  conversationView: boolean;
  onBackMobile?: () => void;
  onReply: (msg: MailMessage, mode: 'reply' | 'replyAll' | 'forward') => void;
  onEditDraft: (msg: MailMessage) => void;
  onDelete: (msg: MailMessage) => void;
  onToggleFlag: (msg: MailMessage) => void;
  onRsvpInvite: (messageId: string, response: 'accepted' | 'tentative' | 'declined') => Promise<void>;
  onQuickReplySend: (parentMsg: MailMessage, bodyText: string) => Promise<void>;
  avatarLookup: Record<string, string | null>;
}

export function ReadingPane({
  message,
  threadMessages,
  conversationView,
  onBackMobile,
  onReply,
  onEditDraft,
  onDelete,
  onToggleFlag,
  onRsvpInvite,
  onQuickReplySend,
  avatarLookup,
}: ReadingPaneProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [sourceModalMsg, setSourceModalMsg] = useState<MailMessage | null>(null);
  const [quickReplyText, setQuickReplyText] = useState('');
  const [sendingQuick, setSendingQuick] = useState(false);

  const itemsToRender =
    conversationView && threadMessages.length > 0 ? threadMessages : message ? [message] : [];

  useEffect(() => {
    if (message) {
      setExpandedIds(new Set([message.id]));
      setQuickReplyText('');
    }
  }, [message?.id]);

  if (!message) {
    return (
      <section
        aria-label="Reading pane"
        className="h-full flex flex-col items-center justify-center bg-[#FAFAFA] dark:bg-[#19191D] p-8 text-center"
      >
        <MailOpen className="w-12 h-12 text-neutral-300 dark:text-neutral-700 mb-3" aria-hidden="true" />
        <h3 className="font-display font-semibold text-base text-neutral-700 dark:text-neutral-200">
          Select an item to read
        </h3>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-xs">
          Use your mouse or the Up and Down arrow keys to navigate messages in the list.
        </p>
      </section>
    );
  }

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleQuickSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickReplyText.trim() || sendingQuick) return;
    setSendingQuick(true);
    try {
      await onQuickReplySend(message, quickReplyText.trim());
      setQuickReplyText('');
    } finally {
      setSendingQuick(false);
    }
  };

  return (
    <section
      aria-label="Message reading pane"
      className="h-full flex flex-col bg-[#FAFAFA] dark:bg-[#19191D] overflow-hidden"
    >
      {/* Top Subject Header */}
      <div className="bg-white dark:bg-[#202024] border-b border-neutral-200 dark:border-neutral-800 px-4 py-3 shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2 min-w-0">
            {onBackMobile && (
              <button
                type="button"
                onClick={onBackMobile}
                aria-label="Back to message list"
                className="md:hidden mt-0.5 min-w-[36px] min-h-[36px] inline-flex items-center justify-center rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 shrink-0"
              >
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
            <div className="min-w-0">
              <h1 className="font-display font-semibold text-base sm:text-lg text-[#242424] dark:text-white leading-snug break-words">
                {message.subject || '(No subject)'}
              </h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                {itemsToRender.length > 1 && (
                  <span className="tabular-nums font-medium">
                    {itemsToRender.length} messages in conversation
                  </span>
                )}
                {message.categories.map((cat) => (
                  <span key={cat} className="inline-flex items-center gap-1.5 text-neutral-700 dark:text-neutral-300">
                    <span
                      className="w-2.5 h-2.5 rounded-xs inline-block"
                      style={{ backgroundColor: getCategoryColor(cat) }}
                      aria-hidden="true"
                    />
                    <span>{cat}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {message.isDraft && (
              <button
                type="button"
                onClick={() => onEditDraft(message)}
                className="h-8 px-3 rounded-md bg-[#0F6CBD] hover:bg-[#0D5CA3] text-white text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <PenSquare className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Resume draft</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onToggleFlag(message)}
              aria-label={message.isFlagged ? 'Unflag message' : 'Flag message'}
              title={message.isFlagged ? 'Unflag' : 'Flag'}
              className="min-w-[36px] min-h-[36px] inline-flex items-center justify-center rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300"
            >
              <Flag className={`w-4 h-4 ${message.isFlagged ? 'text-[#C50F1F] fill-[#C50F1F]' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              aria-label="Print message"
              title="Print"
              className="hidden sm:inline-flex min-w-[36px] min-h-[36px] items-center justify-center rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300"
            >
              <Printer className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setSourceModalMsg(message)}
              aria-label="View RFC 5322 message headers and source"
              title="View message headers"
              className="min-w-[36px] min-h-[36px] inline-flex items-center justify-center rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300"
            >
              <Code2 className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(message)}
              aria-label="Delete message"
              title="Delete"
              className="min-w-[36px] min-h-[36px] inline-flex items-center justify-center rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-red-400 hover:text-red-600"
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* Thread Messages */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-3">
        {itemsToRender.map((item) => {
          const isExpanded = expandedIds.has(item.id) || itemsToRender.length === 1;
          const sanitizedHtml = DOMPurify.sanitize(item.htmlBody || '', {
            USE_PROFILES: { html: true },
          });
          const avatarSrc = avatarLookup[item.fromEmail.toLowerCase()] || null;

          return (
            <article
              key={item.id}
              className="bg-white dark:bg-[#232328] border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden"
            >
              {/* Message Card Header */}
              <div
                onClick={() => {
                  if (itemsToRender.length > 1) toggleExpand(item.id);
                }}
                className={`px-4 py-3 flex items-start justify-between gap-3 ${
                  itemsToRender.length > 1 ? 'cursor-pointer hover:bg-neutral-50/70 dark:hover:bg-neutral-800/40' : ''
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <Avatar name={item.fromName} email={item.fromEmail} src={avatarSrc} size="md" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-[#242424] dark:text-white">
                        {item.fromName}
                      </span>
                      <span className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                        &lt;{item.fromEmail}&gt;
                      </span>
                    </div>
                    {isExpanded ? (
                      <div className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5 space-y-0.5">
                        <div>
                          <span className="text-neutral-500">To: </span>
                          {item.to.map((p) => p.name || p.address).join('; ') || 'Undisclosed recipients'}
                        </div>
                        {item.cc.length > 0 && (
                          <div>
                            <span className="text-neutral-500">Cc: </span>
                            {item.cc.map((p) => p.name || p.address).join('; ')}
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                        {item.snippet}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-neutral-500 dark:text-neutral-400 tabular-nums hidden sm:inline">
                    {formatFullTimestamp(item.dateTs)}
                  </span>
                  {itemsToRender.length > 1 && (
                    <span className="text-neutral-400" aria-hidden="true">
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </span>
                  )}
                </div>
              </div>

              {/* Expanded Body */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-1 border-t border-neutral-100 dark:border-neutral-800">
                  {/* Reply / Forward Action Bar */}
                  {!item.isDraft && (
                    <div className="flex flex-wrap items-center justify-between gap-2 py-2 mb-2 border-b border-neutral-100 dark:border-neutral-800/80">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onReply(item, 'reply')}
                          className="h-8 px-2.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                        >
                          <Reply className="w-3.5 h-3.5 text-[#0F6CBD] dark:text-[#479EF5]" aria-hidden="true" />
                          <span>Reply</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onReply(item, 'replyAll')}
                          className="h-8 px-2.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                        >
                          <ReplyAll className="w-3.5 h-3.5 text-[#0F6CBD] dark:text-[#479EF5]" aria-hidden="true" />
                          <span>Reply all</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onReply(item, 'forward')}
                          className="h-8 px-2.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                        >
                          <Forward className="w-3.5 h-3.5 text-[#0F6CBD] dark:text-[#479EF5]" aria-hidden="true" />
                          <span>Forward</span>
                        </button>
                      </div>
                      <span className="sm:hidden text-[11px] text-neutral-500 tabular-nums">
                        {formatFullTimestamp(item.dateTs)}
                      </span>
                    </div>
                  )}

                  {/* Meeting Invite Card */}
                  {item.meetingInvite && (
                    <div className="mb-4 p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-[#F7F9FC] dark:bg-[#1E242E]">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm font-display font-semibold text-[#242424] dark:text-white">
                            <Calendar className="w-4 h-4 text-[#0F6CBD] dark:text-[#479EF5] shrink-0" aria-hidden="true" />
                            <span>{item.meetingInvite.title}</span>
                          </div>
                          <div className="text-xs text-neutral-600 dark:text-neutral-300 tabular-nums">
                            {new Date(item.meetingInvite.startTs).toLocaleString([], {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                            })}{' '}
                            –{' '}
                            {new Date(item.meetingInvite.endTs).toLocaleTimeString([], {
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </div>
                          {item.meetingInvite.location && (
                            <div className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-400">
                              <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                              <span>{item.meetingInvite.location}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => onRsvpInvite(item.id, 'accepted')}
                            className={`h-8 px-3 rounded-md text-xs font-medium inline-flex items-center gap-1 border transition-colors ${
                              item.meetingInvite.rsvpStatus === 'accepted'
                                ? 'bg-[#107C10] border-[#107C10] text-white'
                                : 'bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-700'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Accept</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onRsvpInvite(item.id, 'tentative')}
                            className={`h-8 px-3 rounded-md text-xs font-medium inline-flex items-center gap-1 border transition-colors ${
                              item.meetingInvite.rsvpStatus === 'tentative'
                                ? 'bg-[#0F6CBD] border-[#0F6CBD] text-white'
                                : 'bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-700'
                            }`}
                          >
                            <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Tentative</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onRsvpInvite(item.id, 'declined')}
                            className={`h-8 px-3 rounded-md text-xs font-medium inline-flex items-center gap-1 border transition-colors ${
                              item.meetingInvite.rsvpStatus === 'declined'
                                ? 'bg-[#C50F1F] border-[#C50F1F] text-white'
                                : 'bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-700'
                            }`}
                          >
                            <X className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Decline</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Attachments Bar */}
                  {item.attachments.length > 0 && (
                    <div className="mb-4 flex flex-wrap gap-2">
                      {item.attachments.map((att) => (
                        <button
                          type="button"
                          key={att.id}
                          onClick={() => {
                            api.saveAttachment(item.id, att.id).catch(() => undefined);
                          }}
                          title={`Save ${att.filename}`}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/70 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs transition-colors"
                        >
                          <Paperclip className="w-3.5 h-3.5 text-neutral-500 shrink-0" aria-hidden="true" />
                          <span className="font-medium truncate max-w-[200px]">{att.filename}</span>
                          <span className="text-neutral-500 tabular-nums">{formatBytes(att.size)}</span>
                          <Download className="w-3.5 h-3.5 text-[#0F6CBD] dark:text-[#479EF5] shrink-0" aria-hidden="true" />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Sanitized HTML / Text Body */}
                  <div
                    className="email-body-prose text-[#242424] dark:text-neutral-200"
                    dangerouslySetInnerHTML={{
                      __html: sanitizedHtml || `<p>${item.textBody}</p>`,
                    }}
                  />
                </div>
              )}
            </article>
          );
        })}

        {/* Inline Quick Reply Box */}
        {!message.isDraft && (
          <form
            onSubmit={handleQuickSend}
            className="bg-white dark:bg-[#232328] border border-neutral-200 dark:border-neutral-800 rounded-lg p-3"
          >
            <label htmlFor="quick-reply-input" className="sr-only">
              Quick reply to {message.fromName}
            </label>
            <textarea
              id="quick-reply-input"
              rows={2}
              value={quickReplyText}
              onChange={(e) => setQuickReplyText(e.target.value)}
              placeholder={`Quick reply to ${message.fromName}...`}
              className="w-full resize-y bg-transparent text-[13px] text-[#242424] dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none"
            />
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => onReply(message, 'reply')}
                className="text-xs text-[#0F6CBD] dark:text-[#479EF5] hover:underline font-medium"
              >
                Open full composer
              </button>
              <button
                type="submit"
                disabled={!quickReplyText.trim() || sendingQuick}
                className="h-8 px-3.5 rounded-md bg-[#0F6CBD] hover:bg-[#0D5CA3] disabled:opacity-40 text-white text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{sendingQuick ? 'Sending...' : 'Send'}</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* RFC 5322 Raw Headers & Source Inspector Modal */}
      {sourceModalMsg && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="rfc-headers-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-2xl bg-white dark:bg-[#232328] rounded-lg border border-neutral-200 dark:border-neutral-700 shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
              <h2 id="rfc-headers-title" className="font-display font-semibold text-sm">
                RFC 5322 Message Headers &amp; Protocol Metadata
              </h2>
              <button
                type="button"
                onClick={() => setSourceModalMsg(null)}
                aria-label="Close headers dialog"
                className="min-w-[36px] min-h-[36px] inline-flex items-center justify-center rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono bg-neutral-50 dark:bg-neutral-900 p-3 rounded border border-neutral-200 dark:border-neutral-800">
                <div>
                  <span className="text-neutral-500">Message-ID: </span>
                  <span className="break-all">{sourceModalMsg.messageIdHeader}</span>
                </div>
                <div>
                  <span className="text-neutral-500">Thread-ID: </span>
                  <span>{sourceModalMsg.threadId}</span>
                </div>
                {sourceModalMsg.remoteUid !== null && (
                  <div>
                    <span className="text-neutral-500">IMAP UID: </span>
                    <span>{sourceModalMsg.remoteUid}</span>
                  </div>
                )}
                {sourceModalMsg.remoteUidl && (
                  <div>
                    <span className="text-neutral-500">POP3 UIDL: </span>
                    <span>{sourceModalMsg.remoteUidl}</span>
                  </div>
                )}
              </div>
              <pre className="text-xs font-mono bg-neutral-50 dark:bg-neutral-900 p-3 rounded border border-neutral-200 dark:border-neutral-800 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                {sourceModalMsg.rawHeaders || 'No raw headers captured for this local draft.'}
              </pre>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
