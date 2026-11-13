import {
  CalendarCheck,
  HelpCircle,
  Menu,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { MailAccount } from '../types';
import { Avatar } from './Avatar';

interface TopBarProps {
  activeAccount: MailAccount | undefined;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  searchScope: 'folder' | 'all';
  onSearchScopeChange: (scope: 'folder' | 'all') => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  myDayOpen: boolean;
  onToggleMyDay: () => void;
  onOpenSettings: (tab?: 'accounts' | 'general' | 'signatures' | 'rules' | 'autoreply') => void;
  onOpenShortcuts: () => void;
  onToggleMobileFolders?: () => void;
  showFolderToggle?: boolean;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
}

export function TopBar({
  activeAccount,
  searchQuery,
  onSearchChange,
  searchScope,
  onSearchScopeChange,
  theme,
  onToggleTheme,
  myDayOpen,
  onToggleMyDay,
  onOpenSettings,
  onOpenShortcuts,
  onToggleMobileFolders,
  showFolderToggle = false,
  searchInputRef,
}: TopBarProps) {
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setProfileOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, []);

  return (
    <header
      role="banner"
      className="h-12 shrink-0 bg-[#0F6CBD] dark:bg-[#1B1B1E] text-white border-b border-[#0B5A9F] dark:border-neutral-800 px-3 flex items-center justify-between gap-4 z-30"
    >
      {/* Left Zone: Brand */}
      <div className="flex items-center gap-2 shrink-0">
        {showFolderToggle && (
          <button
            type="button"
            onClick={onToggleMobileFolders}
            aria-label="Toggle mail folders"
            className="lg:hidden min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-md hover:bg-white/15 transition-colors"
          >
            <Menu className="w-5 h-5" aria-hidden="true" />
          </button>
        )}
        <span className="font-display font-semibold text-base tracking-tight whitespace-nowrap shrink-0">
          DuckLook
        </span>
      </div>

      {/* Center Zone: Search */}
      <div className="flex-1 max-w-xl min-w-0">
        <div
          role="search"
          className="flex items-center bg-white/95 dark:bg-[#2A2A2E] text-[#242424] dark:text-neutral-100 rounded-md h-8 px-2.5 border border-transparent focus-within:ring-2 focus-within:ring-white/80 dark:focus-within:ring-[#479EF5] transition-shadow"
        >
          <Search className="w-4 h-4 text-neutral-500 dark:text-neutral-400 shrink-0 mr-2" aria-hidden="true" />
          <label htmlFor="global-mail-search" className="sr-only">
            Search mail, contacts, or events
          </label>
          <input
            ref={searchInputRef}
            id="global-mail-search"
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search mail (press /)"
            className="w-full min-w-0 bg-transparent text-[13px] placeholder:text-neutral-500 dark:placeholder:text-neutral-400 focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Clear search"
              className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-500 dark:text-neutral-300 shrink-0"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
          <div className="hidden sm:flex items-center border-l border-neutral-200 dark:border-neutral-700 pl-2 ml-1.5 shrink-0">
            <label htmlFor="search-scope-select" className="sr-only">
              Search scope
            </label>
            <select
              id="search-scope-select"
              value={searchScope}
              onChange={(e) => onSearchScopeChange(e.target.value as 'folder' | 'all')}
              className="bg-transparent text-xs font-medium text-neutral-600 dark:text-neutral-300 focus:outline-none cursor-pointer"
            >
              <option value="folder" className="bg-white dark:bg-neutral-800">
                Current folder
              </option>
              <option value="all" className="bg-white dark:bg-neutral-800">
                All mailboxes
              </option>
            </select>
          </div>
        </div>
      </div>

      {/* Right Zone: Utilities + Account */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={onToggleMyDay}
          aria-pressed={myDayOpen}
          aria-label="Toggle My Day agenda panel"
          title="My Day"
          className={`min-w-[40px] min-h-[40px] px-2.5 inline-flex items-center gap-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
            myDayOpen ? 'bg-white/25' : 'hover:bg-white/15'
          }`}
        >
          <CalendarCheck className="w-4 h-4" aria-hidden="true" />
          <span className="hidden md:inline">My Day</span>
        </button>

        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-md hover:bg-white/15 transition-colors"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4" aria-hidden="true" />
          ) : (
            <Moon className="w-4 h-4" aria-hidden="true" />
          )}
        </button>

        <button
          type="button"
          onClick={() => onOpenSettings('accounts')}
          aria-label="Open DuckLook settings"
          title="Settings"
          className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-md hover:bg-white/15 transition-colors"
        >
          <Settings className="w-4 h-4" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={onOpenShortcuts}
          aria-label="Keyboard shortcuts"
          title="Keyboard shortcuts (?)"
          className="hidden sm:inline-flex min-w-[40px] min-h-[40px] items-center justify-center rounded-md hover:bg-white/15 transition-colors"
        >
          <HelpCircle className="w-4 h-4" aria-hidden="true" />
        </button>

        <div className="relative" ref={profileRef}>
          <button
            type="button"
            onClick={() => setProfileOpen((p) => !p)}
            aria-expanded={profileOpen}
            aria-haspopup="menu"
            aria-label="Account profile and connection menu"
            className="min-w-[40px] min-h-[40px] px-1 inline-flex items-center justify-center rounded-md hover:bg-white/15 transition-colors"
          >
            <Avatar
              name={activeAccount?.name || 'No account'}
              email={activeAccount?.email}
              src={activeAccount?.avatarUrl}
              size="sm"
            />
          </button>

          {profileOpen && (
            <div
              role="menu"
              aria-label="Account menu"
              className="absolute right-0 mt-1.5 w-72 bg-white dark:bg-[#242428] text-[#242424] dark:text-neutral-100 rounded-lg border border-neutral-200 dark:border-neutral-700 shadow-lg p-3 z-50"
            >
              <div className="flex items-center gap-3 pb-3 border-b border-neutral-200 dark:border-neutral-700">
                <Avatar
                  name={activeAccount?.name || 'No account'}
                  email={activeAccount?.email}
                  src={activeAccount?.avatarUrl}
                  size="lg"
                />
                <div className="min-w-0">
                  <div className="font-display font-semibold text-sm truncate">
                    {activeAccount?.name || 'No account'}
                  </div>
                  <div className="text-xs text-neutral-600 dark:text-neutral-400 truncate">
                    {activeAccount?.email}
                  </div>
                  <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 uppercase tracking-wide">
                    {activeAccount
                      ? `${activeAccount.protocol.toUpperCase()} · ${activeAccount.incomingHost}`
                      : 'Local workspace'}
                  </div>
                </div>
              </div>

              <div className="pt-2 space-y-1">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setProfileOpen(false);
                    onOpenSettings('accounts');
                  }}
                  className="w-full min-h-[38px] px-2.5 py-1.5 text-left text-xs font-medium rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-700/60 flex items-center gap-2 transition-colors"
                >
                  <Plus className="w-4 h-4 text-[#0F6CBD] dark:text-[#479EF5]" aria-hidden="true" />
                  Manage IMAP / POP3 Accounts
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setProfileOpen(false);
                    onOpenSettings('signatures');
                  }}
                  className="w-full min-h-[38px] px-2.5 py-1.5 text-left text-xs font-medium rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-700/60 flex items-center gap-2 transition-colors"
                >
                  <Settings className="w-4 h-4 text-neutral-500" aria-hidden="true" />
                  Email Signatures &amp; Rules
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
