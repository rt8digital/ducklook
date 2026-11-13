import {
  Archive,
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  FolderPlus,
  Inbox,
  Plus,
  Send,
  ShieldAlert,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { useState } from 'react';
import type { FolderRole, MailAccount, MailFolder } from '../types';

interface FolderPaneProps {
  accounts: MailAccount[];
  folders: MailFolder[];
  selectedFolderId: string;
  onSelectFolder: (folderId: string, accountId: string) => void;
  onCreateFolder: (accountId: string, name: string) => Promise<void>;
  onDeleteFolder: (folderId: string) => Promise<void>;
  onEmptyFolder: (folderId: string) => Promise<void>;
  onOpenAddAccount: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

function getFolderIcon(role: FolderRole) {
  switch (role) {
    case 'inbox':
      return Inbox;
    case 'drafts':
      return FileText;
    case 'sent':
      return Send;
    case 'archive':
      return Archive;
    case 'junk':
      return ShieldAlert;
    case 'deleted':
      return Trash2;
    default:
      return Folder;
  }
}

export function FolderPane({
  accounts,
  folders,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
  onDeleteFolder,
  onEmptyFolder,
  onOpenAddAccount,
  mobileOpen,
  onCloseMobile,
}: FolderPaneProps) {
  const [expandedAccounts, setExpandedAccounts] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(accounts.map((a) => [a.id, true]))
  );
  const [favoritesOpen, setFavoritesOpen] = useState(true);
  const [creatingForAccount, setCreatingForAccount] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');

  const toggleAccount = (id: string) => {
    setExpandedAccounts((prev) => ({ ...prev, [id]: !(prev[id] ?? true) }));
  };

  const favoriteFolders = folders.filter(
    (f) => f.role === 'inbox' || f.role === 'sent' || f.role === 'drafts'
  );

  const submitNewFolder = async (accountId: string) => {
    const trimmed = newFolderName.trim();
    if (!trimmed) {
      setCreatingForAccount(null);
      return;
    }
    await onCreateFolder(accountId, trimmed);
    setNewFolderName('');
    setCreatingForAccount(null);
  };

  const paneContent = (
    <div className="h-full flex flex-col bg-[#F5F5F5] dark:bg-[#18181B] text-[#242424] dark:text-neutral-100 select-none">
      <div className="lg:hidden flex items-center justify-between px-3 py-2.5 border-b border-neutral-200 dark:border-neutral-800">
        <span className="font-display font-semibold text-sm">Folders &amp; Accounts</span>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close folder pane"
          className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-800"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2.5 space-y-4">
        {/* Favorites Section */}
        <div>
          <button
            type="button"
            onClick={() => setFavoritesOpen((v) => !v)}
            aria-expanded={favoritesOpen}
            className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 rounded-md"
          >
            {favoritesOpen ? (
              <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <Star className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Favorites</span>
          </button>

          {favoritesOpen && (
            <ul className="mt-1 space-y-0.5" role="list">
              {favoriteFolders.map((folder) => {
                const Icon = getFolderIcon(folder.role);
                const selected = folder.id === selectedFolderId;
                const acc = accounts.find((a) => a.id === folder.accountId);
                return (
                  <li key={`fav-${folder.id}`}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectFolder(folder.id, folder.accountId);
                        onCloseMobile();
                      }}
                      aria-current={selected ? 'true' : undefined}
                      className={`w-full min-h-[36px] px-2.5 py-1.5 rounded-md flex items-center justify-between gap-2 text-[13px] transition-colors ${
                        selected
                          ? 'bg-[#CFE4FA] dark:bg-[#1E3A5F] text-[#0F6CBD] dark:text-white font-semibold'
                          : 'hover:bg-neutral-200/70 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200'
                      }`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                        <span className="truncate">
                          {folder.name}
                          {accounts.length > 1 && acc ? ` (${acc.name.split(' ')[0]})` : ''}
                        </span>
                      </span>
                      {folder.unreadCount > 0 && (
                        <span className="tabular-nums text-xs font-semibold shrink-0">
                          {folder.unreadCount}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Account Trees */}
        {accounts.map((acc) => {
          const isOpen = expandedAccounts[acc.id] ?? true;
          const accFolders = folders.filter((f) => f.accountId === acc.id);
          return (
            <div key={acc.id} className="border-t border-neutral-200/80 dark:border-neutral-800 pt-2.5">
              <div className="flex items-center justify-between gap-1">
                <button
                  type="button"
                  onClick={() => toggleAccount(acc.id)}
                  aria-expanded={isOpen}
                  className="flex-1 min-w-0 flex items-center gap-1.5 px-2 py-1 text-left text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white rounded-md"
                >
                  {isOpen ? (
                    <ChevronDown className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  )}
                  <span className="truncate">{acc.email}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setExpandedAccounts((p) => ({ ...p, [acc.id]: true }));
                    setCreatingForAccount(acc.id);
                  }}
                  aria-label={`Create new folder in ${acc.email}`}
                  title="New folder"
                  className="p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 shrink-0"
                >
                  <FolderPlus className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>

              {acc.protocol !== 'local' && (
                <div className="px-7 text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                  {acc.protocol.toUpperCase()} · {acc.incomingHost}
                </div>
              )}

              {isOpen && (
                <ul className="mt-1 space-y-0.5" role="list">
                  {accFolders.map((folder) => {
                    const Icon = getFolderIcon(folder.role);
                    const selected = folder.id === selectedFolderId;
                    return (
                      <li key={folder.id} className="group flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            onSelectFolder(folder.id, acc.id);
                            onCloseMobile();
                          }}
                          aria-current={selected ? 'true' : undefined}
                          className={`flex-1 min-w-0 min-h-[34px] px-2.5 py-1 rounded-md flex items-center justify-between gap-2 text-[13px] transition-colors ${
                            selected
                              ? 'bg-[#CFE4FA] dark:bg-[#1E3A5F] text-[#0F6CBD] dark:text-white font-semibold'
                              : 'hover:bg-neutral-200/70 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200'
                          }`}
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                            <span className="truncate">{folder.name}</span>
                          </span>
                          <span className="flex items-center gap-1.5 shrink-0">
                            {folder.unreadCount > 0 ? (
                              <span className="tabular-nums text-xs font-semibold">
                                {folder.unreadCount}
                              </span>
                            ) : folder.role === 'drafts' && folder.totalCount > 0 ? (
                              <span className="tabular-nums text-xs text-neutral-500">
                                {folder.totalCount}
                              </span>
                            ) : null}
                          </span>
                        </button>

                        {(folder.role === 'deleted' || folder.role === 'junk') && folder.totalCount > 0 && (
                          <button
                            type="button"
                            onClick={() => onEmptyFolder(folder.id)}
                            title={`Empty ${folder.name}`}
                            aria-label={`Empty ${folder.name}`}
                            className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1.5 rounded text-neutral-500 hover:text-red-600 dark:hover:text-red-400 transition-opacity"
                          >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        )}
                        {folder.role === 'custom' && (
                          <button
                            type="button"
                            onClick={() => onDeleteFolder(folder.id)}
                            title={`Delete folder ${folder.name}`}
                            aria-label={`Delete folder ${folder.name}`}
                            className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1.5 rounded text-neutral-500 hover:text-red-600 dark:hover:text-red-400 transition-opacity"
                          >
                            <X className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        )}
                      </li>
                    );
                  })}

                  {creatingForAccount === acc.id && (
                    <li className="px-2 py-1">
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          submitNewFolder(acc.id);
                        }}
                        className="flex items-center gap-1"
                      >
                        <label htmlFor={`new-folder-${acc.id}`} className="sr-only">
                          New folder name
                        </label>
                        <input
                          id={`new-folder-${acc.id}`}
                          autoFocus
                          type="text"
                          value={newFolderName}
                          onChange={(e) => setNewFolderName(e.target.value)}
                          placeholder="Folder name..."
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                              setCreatingForAccount(null);
                              setNewFolderName('');
                            }
                          }}
                          className="w-full min-w-0 bg-white dark:bg-neutral-900 border border-[#0F6CBD] rounded px-2 py-1 text-xs focus:outline-none"
                        />
                        <button
                          type="submit"
                          className="px-2 py-1 text-xs font-medium bg-[#0F6CBD] text-white rounded shrink-0"
                        >
                          Add
                        </button>
                      </form>
                    </li>
                  )}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Account Trigger */}
      <div className="p-2.5 border-t border-neutral-200 dark:border-neutral-800">
        <button
          type="button"
          onClick={() => {
            onOpenAddAccount();
            onCloseMobile();
          }}
          className="w-full min-h-[38px] px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#242428] hover:bg-neutral-50 dark:hover:bg-neutral-800 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5 text-[#0F6CBD] dark:text-[#479EF5]" aria-hidden="true" />
          <span>Add IMAP / POP3 account</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Folder Sidebar */}
      <aside
        aria-label="Mail folders"
        className="hidden lg:block w-[236px] shrink-0 border-r border-neutral-200 dark:border-neutral-800 h-full overflow-hidden"
      >
        {paneContent}
      </aside>

      {/* Mobile / Tablet Slide-over Drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div
            className="fixed inset-0 bg-black/40"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside
            aria-label="Mail folders drawer"
            className="relative w-72 max-w-[85vw] h-full z-10 border-r border-neutral-200 dark:border-neutral-800 shadow-xl"
          >
            {paneContent}
          </aside>
        </div>
      )}
    </>
  );
}
