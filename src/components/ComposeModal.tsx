import {
  AlertCircle,
  Bold,
  Italic,
  Link2,
  List,
  ListOrdered,
  Paperclip,
  Save,
  Send,
  Signature,
  Trash2,
  Underline,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ContactRecord, EmailParticipant, MailAccount } from '../types';
import { formatBytes } from '../utils/formatters';

export interface ComposeInitialState {
  draftId?: string | null;
  accountId: string;
  to: EmailParticipant[];
  cc: EmailParticipant[];
  bcc: EmailParticipant[];
  subject: string;
  htmlBody: string;
  inReplyTo?: string | null;
  referencesHeader?: string | null;
  threadId?: string | null;
  importance?: 'high' | 'normal' | 'low';
}

interface ComposeModalProps {
  initialState: ComposeInitialState;
  accounts: MailAccount[];
  contacts: ContactRecord[];
  signatureHtml: string;
  signatureEnabled: boolean;
  onClose: () => void;
  onSend: (payload: {
    accountId: string;
    draftId?: string | null;
    to: EmailParticipant[];
    cc: EmailParticipant[];
    bcc: EmailParticipant[];
    subject: string;
    htmlBody: string;
    textBody: string;
    inReplyTo?: string | null;
    referencesHeader?: string | null;
    threadId?: string | null;
    importance: 'high' | 'normal' | 'low';
    attachments: Array<{ filename: string; contentType: string; size: number; contentBase64?: string }>;
  }) => Promise<void>;
  onSaveDraft: (payload: {
    draftId?: string | null;
    accountId: string;
    to: EmailParticipant[];
    cc: EmailParticipant[];
    bcc: EmailParticipant[];
    subject: string;
    htmlBody: string;
    textBody: string;
    inReplyTo?: string | null;
    referencesHeader?: string | null;
    threadId?: string | null;
    importance: 'high' | 'normal' | 'low';
  }) => Promise<void>;
}

function RecipientInput({
  label,
  value,
  onChange,
  contacts,
}: {
  label: string;
  value: EmailParticipant[];
  onChange: (list: EmailParticipant[]) => void;
  contacts: ContactRecord[];
}) {
  const [input, setInput] = useState('');
  const [focused, setFocused] = useState(false);

  const suggestions =
    input.trim().length > 0
      ? contacts
          .filter(
            (c) =>
              !value.some((v) => v.address.toLowerCase() === c.email.toLowerCase()) &&
              (c.displayName.toLowerCase().includes(input.toLowerCase()) ||
                c.email.toLowerCase().includes(input.toLowerCase()))
          )
          .slice(0, 5)
      : [];

  const commitInput = (raw: string) => {
    const email = raw.trim().replace(/,$/, '');
    if (!email || !email.includes('@')) return;
    if (!value.some((v) => v.address.toLowerCase() === email.toLowerCase())) {
      onChange([...value, { name: email.split('@')[0], address: email }]);
    }
    setInput('');
  };

  return (
    <div className="relative flex items-start gap-2 py-1.5 border-b border-neutral-200 dark:border-neutral-800">
      <span className="w-10 pt-1 text-xs font-medium text-neutral-500 dark:text-neutral-400 shrink-0">
        {label}
      </span>
      <div className="flex-1 flex flex-wrap items-center gap-1.5 min-w-0">
        {value.map((p) => (
          <span
            key={p.address}
            className="inline-flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded px-2 py-0.5 text-xs text-[#242424] dark:text-neutral-100"
          >
            <span className="truncate max-w-[200px]">{p.name || p.address}</span>
            <button
              type="button"
              onClick={() => onChange(value.filter((item) => item.address !== p.address))}
              aria-label={`Remove ${p.address}`}
              className="text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={input}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setTimeout(() => setFocused(false), 150);
            if (input.trim()) commitInput(input);
          }}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
              if (input.trim()) {
                e.preventDefault();
                commitInput(input);
              }
            } else if (e.key === 'Backspace' && !input && value.length > 0) {
              onChange(value.slice(0, -1));
            }
          }}
          placeholder="Add recipient email..."
          className="flex-1 min-w-[140px] bg-transparent text-xs py-1 focus:outline-none text-[#242424] dark:text-neutral-100"
        />
      </div>

      {focused && suggestions.length > 0 && (
        <div className="absolute left-12 top-full mt-1 w-72 bg-white dark:bg-[#2A2A2E] border border-neutral-200 dark:border-neutral-700 rounded-md shadow-lg py-1 z-30">
          {suggestions.map((c) => (
            <button
              key={c.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange([...value, { name: c.displayName, address: c.email }]);
                setInput('');
              }}
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-700"
            >
              <div className="font-semibold text-[#242424] dark:text-white">{c.displayName}</div>
              <div className="text-neutral-500 dark:text-neutral-400">{c.email}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ComposeModal({
  initialState,
  accounts,
  contacts,
  signatureHtml,
  signatureEnabled,
  onClose,
  onSend,
  onSaveDraft,
}: ComposeModalProps) {
  const [accountId, setAccountId] = useState(initialState.accountId);
  const [to, setTo] = useState<EmailParticipant[]>(initialState.to);
  const [cc, setCc] = useState<EmailParticipant[]>(initialState.cc);
  const [bcc, setBcc] = useState<EmailParticipant[]>(initialState.bcc);
  const [showCcBcc, setShowCcBcc] = useState(initialState.cc.length > 0 || initialState.bcc.length > 0);
  const [subject, setSubject] = useState(initialState.subject);
  const [importance, setImportance] = useState<'high' | 'normal' | 'low'>(initialState.importance || 'normal');
  const [attachments, setAttachments] = useState<
    Array<{ filename: string; contentType: string; size: number; contentBase64?: string }>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const [linkInputOpen, setLinkInputOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('https://');
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editorRef.current) {
      const base = initialState.htmlBody || '';
      const sig = signatureEnabled && !initialState.draftId && signatureHtml ? `<br/><br/>${signatureHtml}` : '';
      editorRef.current.innerHTML = base + sig;
    }
  }, [initialState, signatureEnabled, signatureHtml]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const execFormat = (cmd: string, val?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
  };

  const handleInsertSignature = () => {
    if (!editorRef.current || !signatureHtml) return;
    editorRef.current.innerHTML += `<br/>${signatureHtml}`;
  };

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files) return;
    const loaded: Array<{ filename: string; contentType: string; size: number; contentBase64: string }> = [];
    for (const file of Array.from(files)) {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = typeof reader.result === 'string' ? reader.result : '';
          resolve(result.split(',')[1] || '');
        };
        reader.readAsDataURL(file);
      });
      loaded.push({
        filename: file.name,
        contentType: file.type || 'application/octet-stream',
        size: file.size,
        contentBase64: base64,
      });
    }
    setAttachments((prev) => [...prev, ...loaded]);
  };

  const handleSendClick = async () => {
    setError(null);
    if (to.length === 0) {
      setError('Please enter at least one recipient in the To field.');
      return;
    }
    const htmlBody = editorRef.current?.innerHTML || '';
    const textBody = editorRef.current?.innerText || '';
    setSending(true);
    try {
      await onSend({
        accountId,
        draftId: initialState.draftId,
        to,
        cc,
        bcc,
        subject: subject.trim() || '(No subject)',
        htmlBody,
        textBody,
        inReplyTo: initialState.inReplyTo,
        referencesHeader: initialState.referencesHeader,
        threadId: initialState.threadId,
        importance,
        attachments,
      });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  const handleSaveDraftClick = async () => {
    const htmlBody = editorRef.current?.innerHTML || '';
    const textBody = editorRef.current?.innerText || '';
    await onSaveDraft({
      draftId: initialState.draftId,
      accountId,
      to,
      cc,
      bcc,
      subject,
      htmlBody,
      textBody,
      inReplyTo: initialState.inReplyTo,
      referencesHeader: initialState.referencesHeader,
      threadId: initialState.threadId,
      importance,
    });
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="compose-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-0 sm:p-4"
    >
      <div className="w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-3xl bg-white dark:bg-[#222226] sm:rounded-lg border border-neutral-200 dark:border-neutral-700 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-2.5 bg-[#F8F8F8] dark:bg-[#1B1B1E] border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <h2 id="compose-modal-title" className="font-display font-semibold text-sm">
            New Message
          </h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleSaveDraftClick}
              title="Save draft and close"
              className="h-8 px-2.5 rounded text-xs font-medium inline-flex items-center gap-1 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-neutral-800"
            >
              <Save className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Save draft</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Discard and close"
              className="min-w-[36px] min-h-[36px] inline-flex items-center justify-center rounded-md hover:bg-neutral-200/70 dark:hover:bg-neutral-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Form Fields */}
        <div className="px-4 pt-2 flex-1 overflow-y-auto flex flex-col">
          {error && (
            <div
              role="alert"
              className="mb-2 px-3 py-2 rounded bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {/* From Account */}
          <div className="flex items-center gap-2 py-1.5 border-b border-neutral-200 dark:border-neutral-800">
            <label htmlFor="compose-from" className="w-10 text-xs font-medium text-neutral-500 dark:text-neutral-400">
              From
            </label>
            <select
              id="compose-from"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="flex-1 bg-transparent text-xs font-medium text-[#242424] dark:text-neutral-100 focus:outline-none"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id} className="bg-white dark:bg-neutral-800">
                  {a.name} &lt;{a.email}&gt; ({a.protocol.toUpperCase()})
                </option>
              ))}
            </select>
            {!showCcBcc && (
              <button
                type="button"
                onClick={() => setShowCcBcc(true)}
                className="text-xs text-[#0F6CBD] dark:text-[#479EF5] hover:underline font-medium shrink-0"
              >
                Cc / Bcc
              </button>
            )}
          </div>

          <RecipientInput label="To" value={to} onChange={setTo} contacts={contacts} />
          {showCcBcc && (
            <>
              <RecipientInput label="Cc" value={cc} onChange={setCc} contacts={contacts} />
              <RecipientInput label="Bcc" value={bcc} onChange={setBcc} contacts={contacts} />
            </>
          )}

          {/* Subject */}
          <div className="flex items-center gap-2 py-2 border-b border-neutral-200 dark:border-neutral-800">
            <label htmlFor="compose-subject" className="sr-only">
              Subject
            </label>
            <input
              id="compose-subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Add a subject"
              className="flex-1 bg-transparent text-sm font-medium text-[#242424] dark:text-white placeholder:text-neutral-400 focus:outline-none"
            />
            <label htmlFor="compose-importance" className="sr-only">
              Importance
            </label>
            <select
              id="compose-importance"
              value={importance}
              onChange={(e) => setImportance(e.target.value as 'high' | 'normal' | 'low')}
              className="text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded px-2 py-1"
            >
              <option value="normal">Normal importance</option>
              <option value="high">High importance</option>
              <option value="low">Low importance</option>
            </select>
          </div>

          {/* Formatting Toolbar */}
          <div className="flex flex-wrap items-center gap-1 py-1.5 border-b border-neutral-200 dark:border-neutral-800">
            <button
              type="button"
              onClick={() => execFormat('bold')}
              aria-label="Bold"
              className="p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => execFormat('italic')}
              aria-label="Italic"
              className="p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => execFormat('underline')}
              aria-label="Underline"
              className="p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              <Underline className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => execFormat('insertUnorderedList')}
              aria-label="Bulleted list"
              className="p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => execFormat('insertOrderedList')}
              aria-label="Numbered list"
              className="p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              <ListOrdered className="w-3.5 h-3.5" />
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setLinkInputOpen((v) => !v)}
                aria-label="Insert hyperlink"
                aria-expanded={linkInputOpen}
                className="p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <Link2 className="w-3.5 h-3.5" />
              </button>
              {linkInputOpen && (
                <div className="absolute left-0 top-full mt-1 w-64 bg-white dark:bg-[#2A2A2E] border border-neutral-200 dark:border-neutral-700 rounded-md shadow-lg p-2 z-30 flex items-center gap-1.5">
                  <input
                    type="url"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://..."
                    aria-label="Link URL"
                    className="flex-1 min-w-0 h-7 px-2 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (linkUrl.trim()) execFormat('createLink', linkUrl.trim());
                      setLinkInputOpen(false);
                    }}
                    className="h-7 px-2.5 rounded bg-[#0F6CBD] text-white text-xs font-medium shrink-0"
                  >
                    Insert
                  </button>
                </div>
              )}
            </div>

            <div className="h-4 w-px bg-neutral-200 dark:bg-neutral-700 mx-1" aria-hidden="true" />

            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleFilesSelected(e.target.files)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-2 py-1 rounded text-xs font-medium inline-flex items-center gap-1 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              <Paperclip className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Attach</span>
            </button>
            <button
              type="button"
              onClick={handleInsertSignature}
              className="px-2 py-1 rounded text-xs font-medium inline-flex items-center gap-1 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              <Signature className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Signature</span>
            </button>
          </div>

          {/* Attachments List */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 py-2 border-b border-neutral-200 dark:border-neutral-800">
              {attachments.map((att, idx) => (
                <span
                  key={`${att.filename}-${idx}`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-neutral-100 dark:bg-neutral-800 text-xs"
                >
                  <Paperclip className="w-3 h-3 text-neutral-500" />
                  <span>{att.filename}</span>
                  <span className="text-neutral-500 tabular-nums">{formatBytes(att.size)}</span>
                  <button
                    type="button"
                    onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                    aria-label={`Remove attachment ${att.filename}`}
                    className="text-neutral-500 hover:text-red-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Rich Editor */}
          <div
            ref={editorRef}
            contentEditable
            role="textbox"
            aria-multiline="true"
            aria-label="Message body"
            className="flex-1 min-h-[220px] py-3 text-sm leading-relaxed text-[#242424] dark:text-neutral-100 focus:outline-none email-body-prose"
          />
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-[#F8F8F8] dark:bg-[#1B1B1E] border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="h-8 px-3 rounded-md text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-neutral-800 inline-flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Discard</span>
          </button>

          <button
            type="button"
            disabled={sending}
            onClick={handleSendClick}
            className="h-9 px-4 rounded-md bg-[#0F6CBD] hover:bg-[#0D5CA3] disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-2 transition-colors"
          >
            <Send className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{sending ? 'Sending...' : 'Send'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
