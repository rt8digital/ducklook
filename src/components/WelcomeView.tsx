import {
  ArrowRight,
  CheckCircle2,
  Inbox,
  Loader2,
  Mail,
  Server,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import type { MailAccount, MailFolder, SecurityMode } from '../types';
import { api } from '../utils/api';

interface WelcomeViewProps {
  onComplete: (accounts: MailAccount[], folders: MailFolder[]) => void;
}

interface Preset {
  id: string;
  label: string;
  protocol: 'imap' | 'pop3';
  incomingHost: string;
  incomingPort: number;
  outgoingHost: string;
  outgoingPort: number;
  outgoingSecurity: SecurityMode;
}

const PRESETS: Preset[] = [
  {
    id: 'gmail',
    label: 'Gmail',
    protocol: 'imap',
    incomingHost: 'imap.gmail.com',
    incomingPort: 993,
    outgoingHost: 'smtp.gmail.com',
    outgoingPort: 465,
    outgoingSecurity: 'tls',
  },
  {
    id: 'outlook',
    label: 'Microsoft 365 / Outlook.com',
    protocol: 'imap',
    incomingHost: 'outlook.office365.com',
    incomingPort: 993,
    outgoingHost: 'smtp.office365.com',
    outgoingPort: 587,
    outgoingSecurity: 'starttls',
  },
  {
    id: 'fastmail',
    label: 'Fastmail',
    protocol: 'imap',
    incomingHost: 'imap.fastmail.com',
    incomingPort: 993,
    outgoingHost: 'smtp.fastmail.com',
    outgoingPort: 465,
    outgoingSecurity: 'tls',
  },
];

export function WelcomeView({ onComplete }: WelcomeViewProps) {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [protocol, setProtocol] = useState<'imap' | 'pop3'>('imap');
  const [incomingHost, setIncomingHost] = useState('imap.gmail.com');
  const [incomingPort, setIncomingPort] = useState(993);
  const [incomingSecurity, setIncomingSecurity] = useState<SecurityMode>('tls');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [outgoingHost, setOutgoingHost] = useState('smtp.gmail.com');
  const [outgoingPort, setOutgoingPort] = useState(465);
  const [outgoingSecurity, setOutgoingSecurity] = useState<SecurityMode>('tls');
  const [leaveOnServer, setLeaveOnServer] = useState(true);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const applyPreset = (id: string) => {
    const preset = PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setProtocol(preset.protocol);
    setIncomingHost(preset.incomingHost);
    setIncomingPort(preset.incomingPort);
    setIncomingSecurity('tls');
    setOutgoingHost(preset.outgoingHost);
    setOutgoingPort(preset.outgoingPort);
    setOutgoingSecurity(preset.outgoingSecurity);
    setError(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice('Connecting to your mail server and syncing your folders...');
    try {
      const result = await api.createAccount({
        name: displayName.trim() || email,
        email,
        protocol,
        incomingHost,
        incomingPort,
        incomingSecurity,
        incomingUser: username || email,
        incomingPass: password,
        outgoingHost,
        outgoingPort,
        outgoingSecurity,
        outgoingUser: username || email,
        outgoingPass: password,
        leaveOnServer,
      });
      if (result.syncWarning) {
        setNotice(`Account added, but the first sync reported: ${result.syncWarning}`);
      }
      onComplete(result.accounts, result.folders);
    } catch (err) {
      setNotice(null);
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen w-screen overflow-y-auto bg-[#F5F5F5] dark:bg-[#141414] text-[#242424] dark:text-[#F0F0F0]">
      <div className="mx-auto flex min-h-screen max-w-5xl items-start justify-center px-4 py-6 sm:px-8 sm:py-10">
        <div className="grid w-full overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl dark:border-neutral-800 dark:bg-[#1D1D20] lg:grid-cols-[0.9fr_1.1fr]">
          <aside className="relative hidden flex-col justify-between bg-gradient-to-br from-[#0F6CBD] to-[#07447A] p-8 text-white lg:flex">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-white/15">
                  <Mail className="h-5 w-5" aria-hidden="true" />
                </div>
                <span className="font-display text-lg font-semibold">DuckLook</span>
              </div>
              <h1 className="mt-10 font-display text-3xl font-semibold leading-tight">
                Your mailboxes, on your desktop.
              </h1>
              <p className="mt-4 text-sm leading-relaxed text-white/80">
                Connect any standard IMAP or POP3 mailbox. Messages are synced and stored locally in an
                encrypted-on-disk SQLite database — not in a browser cache.
              </p>
            </div>

            <ul className="space-y-3 text-sm text-white/90">
              {[
                'IMAP4rev1 and POP3 mail sync',
                'SMTP sending with attachments',
                'Calendar, contacts, and tasks stored locally',
                'Password encryption through the OS keychain',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-white/70" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </aside>

          <section className="p-6 sm:p-8">
            <div className="mb-6 flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#E8F1FA] text-[#0F6CBD] dark:bg-[#1E3A5F] dark:text-[#479EF5]">
                <Inbox className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h2 className="font-display text-xl font-semibold">Add your first account</h2>
                <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                  Nothing is preloaded. Your mailbox starts empty and fills from your own server.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="preset" className="mb-1 block text-xs font-medium">
                  Quick preset
                </label>
                <select
                  id="preset"
                  defaultValue=""
                  onChange={(e) => applyPreset(e.target.value)}
                  className="h-9 w-full rounded-md border border-neutral-300 bg-white px-2.5 text-xs dark:border-neutral-700 dark:bg-neutral-900"
                >
                  <option value="" disabled>
                    Choose a provider (optional)
                  </option>
                  {PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="display-name" className="mb-1 block text-xs font-medium">
                    Display name
                  </label>
                  <input
                    id="display-name"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Work mailbox"
                    className="h-9 w-full rounded-md border border-neutral-300 bg-white px-2.5 text-xs dark:border-neutral-700 dark:bg-neutral-900"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="mb-1 block text-xs font-medium">
                    Email address
                  </label>
                  <input
                    id="email"
                    required
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (!username) setUsername(e.target.value);
                    }}
                    placeholder="you@example.com"
                    className="h-9 w-full rounded-md border border-neutral-300 bg-white px-2.5 text-xs dark:border-neutral-700 dark:bg-neutral-900"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="username" className="mb-1 block text-xs font-medium">
                    Username
                  </label>
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Usually your email address"
                    className="h-9 w-full rounded-md border border-neutral-300 bg-white px-2.5 text-xs dark:border-neutral-700 dark:bg-neutral-900"
                  />
                </div>
                <div>
                  <label htmlFor="password" className="mb-1 block text-xs font-medium">
                    Password / app password
                  </label>
                  <input
                    id="password"
                    required
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Stored in the OS keychain"
                    className="h-9 w-full rounded-md border border-neutral-300 bg-white px-2.5 text-xs dark:border-neutral-700 dark:bg-neutral-900"
                  />
                </div>
              </div>

              <fieldset className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
                <legend className="px-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                  Incoming mail
                </legend>
                <div className="grid gap-3 sm:grid-cols-[1.4fr_0.6fr_1fr]">
                  <div>
                    <label htmlFor="incoming-host" className="mb-1 block text-xs font-medium">
                      Host
                    </label>
                    <input
                      id="incoming-host"
                      required
                      value={incomingHost}
                      onChange={(e) => setIncomingHost(e.target.value)}
                      className="h-9 w-full rounded-md border border-neutral-300 bg-white px-2.5 font-mono text-xs dark:border-neutral-700 dark:bg-neutral-900"
                    />
                  </div>
                  <div>
                    <label htmlFor="incoming-port" className="mb-1 block text-xs font-medium">
                      Port
                    </label>
                    <input
                      id="incoming-port"
                      required
                      type="number"
                      value={incomingPort}
                      onChange={(e) => setIncomingPort(Number(e.target.value))}
                      className="h-9 w-full rounded-md border border-neutral-300 bg-white px-2.5 font-mono text-xs tabular-nums dark:border-neutral-700 dark:bg-neutral-900"
                    />
                  </div>
                  <div>
                    <label htmlFor="protocol" className="mb-1 block text-xs font-medium">
                      Protocol
                    </label>
                    <select
                      id="protocol"
                      value={protocol}
                      onChange={(e) => {
                        const next = e.target.value as 'imap' | 'pop3';
                        setProtocol(next);
                        setIncomingPort(next === 'imap' ? 993 : 995);
                      }}
                      className="h-9 w-full rounded-md border border-neutral-300 bg-white px-2.5 text-xs uppercase dark:border-neutral-700 dark:bg-neutral-900"
                    >
                      <option value="imap">IMAP</option>
                      <option value="pop3">POP3</option>
                    </select>
                  </div>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="incoming-security" className="mb-1 block text-xs font-medium">
                      Encryption
                    </label>
                    <select
                      id="incoming-security"
                      value={incomingSecurity}
                      onChange={(e) => setIncomingSecurity(e.target.value as SecurityMode)}
                      className="h-9 w-full rounded-md border border-neutral-300 bg-white px-2.5 text-xs dark:border-neutral-700 dark:bg-neutral-900"
                    >
                      <option value="tls">SSL/TLS</option>
                      <option value="starttls">STARTTLS</option>
                      <option value="none">None</option>
                    </select>
                  </div>
                  {protocol === 'pop3' && (
                    <label className="flex items-end gap-2 pb-2 text-xs">
                      <input
                        type="checkbox"
                        checked={leaveOnServer}
                        onChange={(e) => setLeaveOnServer(e.target.checked)}
                      />
                      Leave messages on the server
                    </label>
                  )}
                </div>
              </fieldset>

              <fieldset className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
                <legend className="px-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                  Outgoing mail (SMTP)
                </legend>
                <div className="grid gap-3 sm:grid-cols-[1.4fr_0.6fr_1fr]">
                  <div>
                    <label htmlFor="outgoing-host" className="mb-1 block text-xs font-medium">
                      Host
                    </label>
                    <input
                      id="outgoing-host"
                      required
                      value={outgoingHost}
                      onChange={(e) => setOutgoingHost(e.target.value)}
                      className="h-9 w-full rounded-md border border-neutral-300 bg-white px-2.5 font-mono text-xs dark:border-neutral-700 dark:bg-neutral-900"
                    />
                  </div>
                  <div>
                    <label htmlFor="outgoing-port" className="mb-1 block text-xs font-medium">
                      Port
                    </label>
                    <input
                      id="outgoing-port"
                      required
                      type="number"
                      value={outgoingPort}
                      onChange={(e) => setOutgoingPort(Number(e.target.value))}
                      className="h-9 w-full rounded-md border border-neutral-300 bg-white px-2.5 font-mono text-xs tabular-nums dark:border-neutral-700 dark:bg-neutral-900"
                    />
                  </div>
                  <div>
                    <label htmlFor="outgoing-security" className="mb-1 block text-xs font-medium">
                      Encryption
                    </label>
                    <select
                      id="outgoing-security"
                      value={outgoingSecurity}
                      onChange={(e) => setOutgoingSecurity(e.target.value as SecurityMode)}
                      className="h-9 w-full rounded-md border border-neutral-300 bg-white px-2.5 text-xs dark:border-neutral-700 dark:bg-neutral-900"
                    >
                      <option value="tls">SSL/TLS</option>
                      <option value="starttls">STARTTLS</option>
                      <option value="none">None</option>
                    </select>
                  </div>
                </div>
              </fieldset>

              {error && (
                <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="break-words">{error}</span>
                </div>
              )}

              {notice && !error && (
                <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300">
                  {busy ? (
                    <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
                  ) : (
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  )}
                  <span className="break-words">{notice}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#0F6CBD] text-sm font-semibold text-white transition-colors hover:bg-[#0D5CA3] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Connecting and syncing...
                  </>
                ) : (
                  <>
                    Connect mailbox
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </>
                )}
              </button>

              <p className="flex items-center justify-center gap-1.5 text-[11px] text-neutral-500 dark:text-neutral-400">
                <Server className="h-3.5 w-3.5" aria-hidden="true" />
                All data stays on this computer. No cloud account is created.
              </p>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
