import {
  CheckCircle2,
  Filter,
  Mail,
  PenTool,
  PlaneTakeoff,
  Plus,
  RefreshCw,
  Server,
  Settings,
  ShieldCheck,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type {
  AppSettings,
  MailAccount,
  MailFolder,
  MailRule,
  SecurityMode,
} from '../types';
import { api } from '../utils/api';

export type SettingsTab = 'accounts' | 'general' | 'signatures' | 'rules' | 'autoreply';

interface SettingsModalProps {
  open: boolean;
  initialTab: SettingsTab;
  onClose: () => void;
  accounts: MailAccount[];
  folders: MailFolder[];
  rules: MailRule[];
  settings: AppSettings;
  onUpdateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  onAccountsChanged: (accounts: MailAccount[], folders: MailFolder[]) => void;
  onSyncAccount: (accountId: string) => Promise<void>;
  onRulesChanged: () => Promise<void>;
}

const PRESETS = [
  {
    id: 'outlook',
    label: 'Microsoft 365 / Outlook.com (IMAP)',
    protocol: 'imap' as const,
    incomingHost: 'outlook.office365.com',
    incomingPort: 993,
    incomingSecurity: 'tls' as SecurityMode,
    outgoingHost: 'smtp.office365.com',
    outgoingPort: 587,
    outgoingSecurity: 'starttls' as SecurityMode,
  },
  {
    id: 'gmail',
    label: 'Gmail (IMAP + App Password)',
    protocol: 'imap' as const,
    incomingHost: 'imap.gmail.com',
    incomingPort: 993,
    incomingSecurity: 'tls' as SecurityMode,
    outgoingHost: 'smtp.gmail.com',
    outgoingPort: 465,
    outgoingSecurity: 'tls' as SecurityMode,
  },
  {
    id: 'gmail-pop3',
    label: 'Gmail (POP3 + App Password)',
    protocol: 'pop3' as const,
    incomingHost: 'pop.gmail.com',
    incomingPort: 995,
    incomingSecurity: 'tls' as SecurityMode,
    outgoingHost: 'smtp.gmail.com',
    outgoingPort: 465,
    outgoingSecurity: 'tls' as SecurityMode,
  },
  {
    id: 'fastmail',
    label: 'Fastmail (IMAP)',
    protocol: 'imap' as const,
    incomingHost: 'imap.fastmail.com',
    incomingPort: 993,
    incomingSecurity: 'tls' as SecurityMode,
    outgoingHost: 'smtp.fastmail.com',
    outgoingPort: 465,
    outgoingSecurity: 'tls' as SecurityMode,
  },
];

export function SettingsModal({
  open,
  initialTab,
  onClose,
  accounts,
  folders,
  rules,
  settings,
  onUpdateSettings,
  onAccountsChanged,
  onSyncAccount,
  onRulesChanged,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [wizardOpen, setWizardOpen] = useState(false);

  // Account Wizard Form
  const [accName, setAccName] = useState('');
  const [accEmail, setAccEmail] = useState('');
  const [protocol, setProtocol] = useState<'imap' | 'pop3'>('imap');
  const [incomingHost, setIncomingHost] = useState('imap.gmail.com');
  const [incomingPort, setIncomingPort] = useState(993);
  const [incomingSecurity, setIncomingSecurity] = useState<SecurityMode>('tls');
  const [incomingUser, setIncomingUser] = useState('');
  const [incomingPass, setIncomingPass] = useState('');
  const [outgoingHost, setOutgoingHost] = useState('smtp.gmail.com');
  const [outgoingPort, setOutgoingPort] = useState(465);
  const [outgoingSecurity, setOutgoingSecurity] = useState<SecurityMode>('tls');
  const [leaveOnServer, setLeaveOnServer] = useState(true);

  const [testing, setTesting] = useState(false);
  const [testOutput, setTestOutput] = useState<{
    ok: boolean;
    summary: string;
    capabilities?: string[];
  } | null>(null);
  const [savingAcc, setSavingAcc] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  // Signature & OOF state
  const [sigDraft, setSigDraft] = useState(settings.signatureHtml);
  const [sigEnabled, setSigEnabled] = useState(settings.signatureEnabled);
  const [oofEnabled, setOofEnabled] = useState(settings.autoReplyEnabled);
  const [oofMessage, setOofMessage] = useState(settings.autoReplyMessage);

  // Rule creator state
  const [ruleName, setRuleName] = useState('');
  const [ruleField, setRuleField] = useState<'from' | 'subject' | 'body'>('from');
  const [ruleValue, setRuleValue] = useState('');
  const [ruleAction, setRuleAction] = useState<'move' | 'mark_read' | 'flag' | 'categorize' | 'delete'>('move');
  const [ruleActionVal, setRuleActionVal] = useState('');

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab, open]);

  useEffect(() => {
    setSigDraft(settings.signatureHtml);
    setSigEnabled(settings.signatureEnabled);
    setOofEnabled(settings.autoReplyEnabled);
    setOofMessage(settings.autoReplyMessage);
  }, [settings]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const applyPreset = (presetId: string) => {
    setTestOutput(null);
    const p = PRESETS.find((item) => item.id === presetId);
    if (!p) return;
    setProtocol(p.protocol);
    setIncomingHost(p.incomingHost);
    if ('incomingPort' in p && p.incomingPort) setIncomingPort(p.incomingPort);
    setIncomingSecurity(p.incomingSecurity);
    setOutgoingHost(p.outgoingHost);
    if ('outgoingPort' in p && p.outgoingPort) setOutgoingPort(p.outgoingPort);
    setOutgoingSecurity(p.outgoingSecurity);
  };

  const handleProtocolSwitch = (nextProto: 'imap' | 'pop3') => {
    setProtocol(nextProto);
    setTestOutput(null);
    if (nextProto === 'imap') {
      setIncomingPort(incomingSecurity === 'tls' ? 993 : 143);
    } else {
      setIncomingPort(incomingSecurity === 'tls' ? 995 : 110);
    }
  };

  const handleSecuritySwitch = (sec: SecurityMode) => {
    setIncomingSecurity(sec);
    if (protocol === 'imap') setIncomingPort(sec === 'tls' ? 993 : 143);
    else setIncomingPort(sec === 'tls' ? 995 : 110);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestOutput(null);
    try {
      const res = await api.testAccount({
        protocol,
        incomingHost,
        incomingPort,
        incomingSecurity,
        incomingUser: incomingUser || accEmail,
        incomingPass,
        outgoingHost,
        outgoingPort,
        outgoingSecurity,
        outgoingUser: incomingUser || accEmail,
        outgoingPass: incomingPass,
      });
      const countText =
        protocol === 'pop3'
          ? `Mailbox: ${res.incoming.messageCount ?? 0} messages (${res.incoming.totalBytes ?? 0} bytes)`
          : `INBOX: ${res.incoming.inboxTotal ?? 0} messages (${res.incoming.inboxUnread ?? 0} unread), ${
              res.incoming.mailboxes?.length ?? 0
            } folders`;
      const smtpText = res.smtpOk ? 'SMTP verified' : `SMTP warning: ${res.smtpError || 'not checked'}`;
      setTestOutput({
        ok: true,
        summary: `${res.incoming.banner} · ${countText} · ${smtpText}`,
        capabilities: res.incoming.capabilities,
      });
    } catch (err) {
      setTestOutput({
        ok: false,
        summary: (err as Error).message,
      });
    } finally {
      setTesting(false);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAcc(true);
    try {
      const res = await api.createAccount({
        name: accName || accEmail,
        email: accEmail,
        protocol,
        incomingHost,
        incomingPort,
        incomingSecurity,
        incomingUser: incomingUser || accEmail,
        incomingPass,
        outgoingHost,
        outgoingPort,
        outgoingSecurity,
        outgoingUser: incomingUser || accEmail,
        outgoingPass: incomingPass,
        leaveOnServer,
      });
      onAccountsChanged(res.accounts, res.folders);
      setWizardOpen(false);
      setTestOutput(null);
    } catch (err) {
      setTestOutput({ ok: false, summary: (err as Error).message });
    } finally {
      setSavingAcc(false);
    }
  };

  const primaryAccountId = accounts[0]?.id ?? '';
  const primaryFolders = folders.filter((f) => f.accountId === primaryAccountId);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-0 sm:p-4"
    >
      <div className="w-full h-full sm:h-[82vh] sm:max-w-4xl bg-white dark:bg-[#222226] sm:rounded-lg border border-neutral-200 dark:border-neutral-700 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 bg-[#F8F8F8] dark:bg-[#1B1B1E] border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between shrink-0">
          <h2 id="settings-modal-title" className="font-display font-semibold text-sm flex items-center gap-2">
            <Settings className="w-4 h-4 text-[#0F6CBD] dark:text-[#479EF5]" aria-hidden="true" />
            <span>DuckLook Settings &amp; Accounts</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="min-w-[36px] min-h-[36px] inline-flex items-center justify-center rounded-md hover:bg-neutral-200/70 dark:hover:bg-neutral-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Split */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          <nav
            aria-label="Settings sections"
            className="w-full md:w-52 shrink-0 border-b md:border-b-0 md:border-r border-neutral-200 dark:border-neutral-800 bg-[#F5F5F5] dark:bg-[#18181B] p-2 flex md:flex-col gap-1 overflow-x-auto"
          >
            {(
              [
                { id: 'accounts', label: 'IMAP / POP3 Accounts', icon: Server },
                { id: 'general', label: 'Layout & General', icon: Mail },
                { id: 'signatures', label: 'Signatures', icon: PenTool },
                { id: 'rules', label: 'Inbox Rules', icon: Filter },
                { id: 'autoreply', label: 'Automatic Replies', icon: PlaneTakeoff },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`min-h-[36px] px-3 py-1.5 rounded-md text-xs font-medium inline-flex items-center gap-2 whitespace-nowrap text-left transition-colors ${
                    active
                      ? 'bg-[#CFE4FA] dark:bg-[#1E3A5F] text-[#0F6CBD] dark:text-white font-semibold'
                      : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-neutral-800'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Settings Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {activeTab === 'accounts' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-display font-semibold text-base">Connected Mail Accounts</h3>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      Configure standard IMAP4rev1 (RFC 3501), POP3 (RFC 1939 / STLS), and SMTP (RFC 5321) servers.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setWizardOpen((v) => !v)}
                    className="h-8 px-3.5 rounded-md bg-[#0F6CBD] hover:bg-[#0D5CA3] text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{wizardOpen ? 'Hide wizard' : 'Add IMAP / POP3 account'}</span>
                  </button>
                </div>

                {/* Add Account Form */}
                {wizardOpen && (
                  <form
                    onSubmit={handleCreateAccount}
                    className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-[#FAFAFA] dark:bg-[#1A1A1E] space-y-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-neutral-200 dark:border-neutral-800">
                      <span className="font-display font-semibold text-xs uppercase tracking-wide text-neutral-600 dark:text-neutral-300">
                        Account Protocol Configuration
                      </span>
                      <div className="flex items-center gap-2">
                        <label htmlFor="preset-select" className="text-xs text-neutral-500">
                          Quick preset:
                        </label>
                        <select
                          id="preset-select"
                          defaultValue=""
                          onChange={(e) => applyPreset(e.target.value)}
                          className="h-7 px-2 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs"
                        >
                          <option value="" disabled>
                            Choose server preset...
                          </option>
                          {PRESETS.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <label className="block font-medium mb-1">Display name</label>
                        <input
                          required
                          type="text"
                          value={accName}
                          onChange={(e) => setAccName(e.target.value)}
                          placeholder="e.g. Work IMAP"
                          className="w-full h-8 px-2.5 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                        />
                      </div>
                      <div>
                        <label className="block font-medium mb-1">Email address</label>
                        <input
                          required
                          type="email"
                          value={accEmail}
                          onChange={(e) => {
                            setAccEmail(e.target.value);
                            if (!incomingUser) setIncomingUser(e.target.value);
                          }}
                          placeholder="you@domain.com"
                          className="w-full h-8 px-2.5 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                        />
                      </div>
                      <div>
                        <span className="block font-medium mb-1">Incoming protocol</span>
                        <div className="grid grid-cols-2 gap-1 bg-neutral-200/70 dark:bg-neutral-800 p-0.5 rounded">
                          {(['imap', 'pop3'] as const).map((proto) => (
                            <button
                              key={proto}
                              type="button"
                              onClick={() => handleProtocolSwitch(proto)}
                              className={`h-7 rounded text-xs font-semibold uppercase ${
                                protocol === proto
                                  ? 'bg-white dark:bg-[#2C2C32] text-[#0F6CBD] dark:text-[#479EF5] shadow-2xs'
                                  : 'text-neutral-600 dark:text-neutral-400'
                              }`}
                            >
                              {proto}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Incoming Server */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                      <div className="sm:col-span-2">
                        <label className="block font-medium mb-1">
                          Incoming {protocol.toUpperCase()} host
                        </label>
                        <input
                          required
                          type="text"
                          value={incomingHost}
                          onChange={(e) => setIncomingHost(e.target.value)}
                          className="w-full h-8 px-2.5 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block font-medium mb-1">Port</label>
                        <input
                          required
                          type="number"
                          value={incomingPort}
                          onChange={(e) => setIncomingPort(Number(e.target.value))}
                          className="w-full h-8 px-2.5 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 font-mono tabular-nums"
                        />
                      </div>
                      <div>
                        <label className="block font-medium mb-1">Encryption</label>
                        <select
                          value={incomingSecurity}
                          onChange={(e) => handleSecuritySwitch(e.target.value as SecurityMode)}
                          className="w-full h-8 px-2 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                        >
                          <option value="tls">SSL/TLS</option>
                          <option value="starttls">STARTTLS</option>
                          <option value="none">None</option>
                        </select>
                      </div>
                    </div>

                    {/* Credentials */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block font-medium mb-1">Username</label>
                        <input
                          required
                          type="text"
                          value={incomingUser}
                          onChange={(e) => setIncomingUser(e.target.value)}
                          placeholder="Username or email"
                          className="w-full h-8 px-2.5 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                        />
                      </div>
                      <div>
                        <label className="block font-medium mb-1">Password / App password</label>
                        <input
                          required
                          type="password"
                          value={incomingPass}
                          onChange={(e) => setIncomingPass(e.target.value)}
                          placeholder="Stored in the OS keychain"
                          className="w-full h-8 px-2.5 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                        />
                      </div>
                    </div>

                    {/* Outgoing SMTP */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs pt-2 border-t border-neutral-200 dark:border-neutral-800">
                      <div className="sm:col-span-2">
                        <label className="block font-medium mb-1">Outgoing SMTP host</label>
                        <input
                          required
                          type="text"
                          value={outgoingHost}
                          onChange={(e) => setOutgoingHost(e.target.value)}
                          className="w-full h-8 px-2.5 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block font-medium mb-1">SMTP port</label>
                        <input
                          required
                          type="number"
                          value={outgoingPort}
                          onChange={(e) => setOutgoingPort(Number(e.target.value))}
                          className="w-full h-8 px-2.5 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 font-mono tabular-nums"
                        />
                      </div>
                      <div>
                        <label className="block font-medium mb-1">SMTP encryption</label>
                        <select
                          value={outgoingSecurity}
                          onChange={(e) => setOutgoingSecurity(e.target.value as SecurityMode)}
                          className="w-full h-8 px-2 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                        >
                          <option value="tls">SSL/TLS</option>
                          <option value="starttls">STARTTLS</option>
                          <option value="none">None</option>
                        </select>
                      </div>
                    </div>

                    {protocol === 'pop3' && (
                      <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={leaveOnServer}
                          onChange={(e) => setLeaveOnServer(e.target.checked)}
                          className="w-4 h-4 rounded text-[#0F6CBD]"
                        />
                        <span>Leave a copy of retrieved messages on the POP3 server (UIDL tracking)</span>
                      </label>
                    )}

                    {testOutput && (
                      <div
                        role="status"
                        className={`p-3 rounded-md border text-xs space-y-1.5 ${
                          testOutput.ok
                            ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                            : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
                        }`}
                      >
                        <div className="flex items-start gap-2 font-medium">
                          {testOutput.ok ? (
                            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                          ) : (
                            <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                          )}
                          <span>{testOutput.summary}</span>
                        </div>
                        {testOutput.capabilities && testOutput.capabilities.length > 0 && (
                          <div className="font-mono text-[11px] opacity-85 pl-6 break-all">
                            Capabilities: {testOutput.capabilities.slice(0, 12).join(' · ')}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                      <button
                        type="button"
                        disabled={testing}
                        onClick={handleTestConnection}
                        className="h-8 px-3.5 rounded-md border border-neutral-300 dark:border-neutral-600 text-xs font-medium inline-flex items-center gap-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-[#0F6CBD] dark:text-[#479EF5]" />
                        <span>{testing ? 'Testing handshake...' : 'Test connection'}</span>
                      </button>
                      <button
                        type="submit"
                        disabled={savingAcc}
                        className="h-8 px-4 rounded-md bg-[#0F6CBD] hover:bg-[#0D5CA3] text-white text-xs font-semibold"
                      >
                        {savingAcc ? 'Connecting & syncing...' : 'Connect & sync'}
                      </button>
                    </div>
                  </form>
                )}

                {/* Existing Accounts List */}
                <div className="space-y-2.5">
                  {accounts.map((acc) => (
                    <div
                      key={acc.id}
                      className="p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#26262C] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-display font-semibold text-sm">{acc.name}</span>
                          <span className="text-[11px] font-mono uppercase text-neutral-500 dark:text-neutral-400">
                            {acc.protocol}
                          </span>
                        </div>
                        <div className="text-xs text-neutral-600 dark:text-neutral-300">{acc.email}</div>
                        <div className="text-[11px] text-neutral-500 dark:text-neutral-400 font-mono truncate">
                          In: {acc.incomingHost}:{acc.incomingPort} ({acc.incomingSecurity}) · Out:{' '}
                          {acc.outgoingHost}:{acc.outgoingPort}
                        </div>
                        {acc.capabilities.length > 0 && (
                          <div className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                            RFC capabilities: {acc.capabilities.slice(0, 6).join(', ')}
                          </div>
                        )}
                        {acc.lastError && (
                          <div className="text-xs text-red-600 dark:text-red-400">
                            Last sync error: {acc.lastError}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={syncingId === acc.id}
                          onClick={async () => {
                            setSyncingId(acc.id);
                            try {
                              await onSyncAccount(acc.id);
                            } finally {
                              setSyncingId(null);
                            }
                          }}
                          className="h-8 px-3 rounded-md border border-neutral-300 dark:border-neutral-700 text-xs font-medium inline-flex items-center gap-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${syncingId === acc.id ? 'animate-spin' : ''}`} />
                          <span>Sync now</span>
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (
                              accounts.length === 1 &&
                              !window.confirm(
                                'Remove your only mailbox account? Its local messages, folders, calendar, contacts, and tasks will be deleted from this computer.'
                              )
                            ) {
                              return;
                            }
                            const res = await api.deleteAccount(acc.id);
                            onAccountsChanged(res.accounts, res.folders);
                          }}
                          aria-label={`Remove account ${acc.email}`}
                          title="Remove account"
                          className="h-8 px-2.5 rounded-md border border-neutral-300 dark:border-neutral-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'general' && (
              <div className="space-y-5 max-w-xl">
                <div>
                  <h3 className="font-display font-semibold text-base">Layout &amp; Appearance</h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Customize reading pane orientation, message list density, and theme.
                  </p>
                </div>

                <div className="space-y-4 text-xs">
                  <div className="flex items-center justify-between py-2 border-b border-neutral-200 dark:border-neutral-800">
                    <div>
                      <div className="font-semibold">Color theme</div>
                      <div className="text-neutral-500">Switch between Light and Dark surfaces</div>
                    </div>
                    <select
                      value={settings.theme}
                      onChange={(e) => onUpdateSettings({ theme: e.target.value as 'light' | 'dark' })}
                      className="h-8 px-2.5 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                    >
                      <option value="light">Light mode</option>
                      <option value="dark">Dark mode</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between py-2 border-b border-neutral-200 dark:border-neutral-800">
                    <div>
                      <div className="font-semibold">Reading pane position</div>
                      <div className="text-neutral-500">Choose where the active message thread renders</div>
                    </div>
                    <select
                      value={settings.readingPanePosition}
                      onChange={(e) =>
                        onUpdateSettings({ readingPanePosition: e.target.value as 'right' | 'bottom' | 'off' })
                      }
                      className="h-8 px-2.5 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                    >
                      <option value="right">Show on the right</option>
                      <option value="bottom">Show on the bottom</option>
                      <option value="off">Hide</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between py-2 border-b border-neutral-200 dark:border-neutral-800">
                    <div>
                      <div className="font-semibold">Display density</div>
                      <div className="text-neutral-500">Control spacing and snippet lines in message list</div>
                    </div>
                    <select
                      value={settings.density}
                      onChange={(e) => onUpdateSettings({ density: e.target.value as 'comfortable' | 'compact' })}
                      className="h-8 px-2.5 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                    >
                      <option value="comfortable">Comfortable</option>
                      <option value="compact">Compact</option>
                    </select>
                  </div>

                  <label className="flex items-center justify-between py-2 border-b border-neutral-200 dark:border-neutral-800 cursor-pointer">
                    <div>
                      <div className="font-semibold">Focused Inbox</div>
                      <div className="text-neutral-500">Separate high-priority mail from digests and notifications</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.focusedInboxEnabled}
                      onChange={(e) => onUpdateSettings({ focusedInboxEnabled: e.target.checked })}
                      className="w-4 h-4 rounded text-[#0F6CBD]"
                    />
                  </label>

                  <label className="flex items-center justify-between py-2 cursor-pointer">
                    <div>
                      <div className="font-semibold">Conversation view</div>
                      <div className="text-neutral-500">Group related replies into expandable threads</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.conversationView}
                      onChange={(e) => onUpdateSettings({ conversationView: e.target.checked })}
                      className="w-4 h-4 rounded text-[#0F6CBD]"
                    />
                  </label>
                </div>
              </div>
            )}

            {activeTab === 'signatures' && (
              <div className="space-y-4 max-w-xl">
                <div>
                  <h3 className="font-display font-semibold text-base">Email Signature</h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Automatically appended to new outgoing messages.
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sigEnabled}
                    onChange={(e) => setSigEnabled(e.target.checked)}
                    className="w-4 h-4 rounded text-[#0F6CBD]"
                  />
                  <span>Automatically include my signature on new messages</span>
                </label>
                <textarea
                  rows={6}
                  value={sigDraft}
                  onChange={(e) => setSigDraft(e.target.value)}
                  aria-label="Signature HTML"
                  className="w-full p-3 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ signatureHtml: sigDraft, signatureEnabled: sigEnabled })}
                  className="h-8 px-4 rounded-md bg-[#0F6CBD] hover:bg-[#0D5CA3] text-white text-xs font-semibold"
                >
                  Save signature
                </button>
              </div>
            )}

            {activeTab === 'rules' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display font-semibold text-base">Inbox Rules</h3>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      Automatically organize incoming IMAP, POP3, and local messages.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await api.runRules(primaryAccountId);
                      await onRulesChanged();
                    }}
                    className="h-8 px-3 rounded-md border border-neutral-300 dark:border-neutral-700 text-xs font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    Run rules on Inbox now
                  </button>
                </div>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!ruleName.trim() || !ruleValue.trim()) return;
                    await api.createRule({
                      accountId: primaryAccountId,
                      name: ruleName.trim(),
                      enabled: true,
                      conditionField: ruleField,
                      conditionOperator: 'contains',
                      conditionValue: ruleValue.trim(),
                      actionType: ruleAction,
                      actionValue: ruleActionVal,
                    });
                    setRuleName('');
                    setRuleValue('');
                    await onRulesChanged();
                  }}
                  className="p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-[#FAFAFA] dark:bg-[#1A1A1E] grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs"
                >
                  <input
                    required
                    type="text"
                    value={ruleName}
                    onChange={(e) => setRuleName(e.target.value)}
                    placeholder="Rule name"
                    className="h-8 px-2.5 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                  />
                  <select
                    value={ruleField}
                    onChange={(e) => setRuleField(e.target.value as 'from' | 'subject' | 'body')}
                    className="h-8 px-2 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                  >
                    <option value="from">From contains</option>
                    <option value="subject">Subject contains</option>
                    <option value="body">Body contains</option>
                  </select>
                  <input
                    required
                    type="text"
                    value={ruleValue}
                    onChange={(e) => setRuleValue(e.target.value)}
                    placeholder="Match text..."
                    className="h-8 px-2.5 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                  />
                  <select
                    value={ruleAction}
                    onChange={(e) => {
                      const val = e.target.value as typeof ruleAction;
                      setRuleAction(val);
                      if (val === 'move' && primaryFolders[0]) setRuleActionVal(primaryFolders[0].id);
                      if (val === 'categorize') setRuleActionVal('Engineering');
                    }}
                    className="h-8 px-2 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                  >
                    <option value="move">Move to folder</option>
                    <option value="mark_read">Mark as read</option>
                    <option value="flag">Flag message</option>
                    <option value="categorize">Categorize</option>
                    <option value="delete">Delete</option>
                  </select>
                  <button
                    type="submit"
                    className="h-8 px-3 rounded bg-[#0F6CBD] hover:bg-[#0D5CA3] text-white font-semibold"
                  >
                    Add rule
                  </button>
                </form>

                <div className="space-y-2">
                  {rules.map((r) => (
                    <div
                      key={r.id}
                      className="p-3 rounded-md border border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={r.enabled}
                          onChange={async (e) => {
                            await api.toggleRule(r.id, e.target.checked);
                            await onRulesChanged();
                          }}
                          aria-label={`Toggle rule ${r.name}`}
                          className="w-4 h-4 rounded text-[#0F6CBD]"
                        />
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{r.name}</div>
                          <div className="text-neutral-500">
                            If {r.conditionField} {r.conditionOperator} &ldquo;{r.conditionValue}&rdquo; → {r.actionType}
                            {r.actionValue ? ` (${r.actionValue})` : ''}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          await api.deleteRule(r.id);
                          await onRulesChanged();
                        }}
                        aria-label={`Delete rule ${r.name}`}
                        className="p-1.5 rounded text-neutral-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'autoreply' && (
              <div className="space-y-4 max-w-xl">
                <div>
                  <h3 className="font-display font-semibold text-base">Automatic Replies (Out of Office)</h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Configure an automated response when you are away.
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={oofEnabled}
                    onChange={(e) => setOofEnabled(e.target.checked)}
                    className="w-4 h-4 rounded text-[#0F6CBD]"
                  />
                  <span>Turn on automatic replies</span>
                </label>
                <textarea
                  rows={5}
                  value={oofMessage}
                  onChange={(e) => setOofMessage(e.target.value)}
                  aria-label="Out of office reply message"
                  className="w-full p-3 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs"
                />
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ autoReplyEnabled: oofEnabled, autoReplyMessage: oofMessage })}
                  className="h-8 px-4 rounded-md bg-[#0F6CBD] hover:bg-[#0D5CA3] text-white text-xs font-semibold"
                >
                  Save automatic replies
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
