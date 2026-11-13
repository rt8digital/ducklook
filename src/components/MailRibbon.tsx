import {
  Archive,
  CheckSquare,
  Columns2,
  Flag,
  FolderInput,
  MailOpen,
  PenSquare,
  RefreshCw,
  ShieldAlert,
  Tag,
  Trash2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { MailFolder } from '../types';
import { CATEGORY_COLORS } from '../utils/formatters';

interface MailRibbonProps {
  onComposeNew: () => void;
  hasSelection: boolean;
  selectionCount: number;
  selectedIsRead?: boolean;
  selectedIsFlagged?: boolean;
  onDelete: () => void;
  onArchive: () => void;
  onJunk: () => void;
  onToggleRead: () => void;
  onToggleFlag: () => void;
  onMoveTo: (folderId: string) => void;
  onCategorize: (category: string) => void;
  onSync: () => void;
  isSyncing: boolean;
  folders: MailFolder[];
  readingPanePosition: 'right' | 'bottom' | 'off';
  onChangeReadingPane: (pos: 'right' | 'bottom' | 'off') => void;
  selectMode: boolean;
  onToggleSelectMode: () => void;
}

export function MailRibbon({
  onComposeNew,
  hasSelection,
  selectionCount,
  selectedIsRead,
  selectedIsFlagged,
  onDelete,
  onArchive,
  onJunk,
  onToggleRead,
  onToggleFlag,
  onMoveTo,
  onCategorize,
  onSync,
  isSyncing,
  folders,
  readingPanePosition,
  onChangeReadingPane,
  selectMode,
  onToggleSelectMode,
}: MailRibbonProps) {
  const [moveOpen, setMoveOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const ribbonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ribbonRef.current && !ribbonRef.current.contains(e.target as Node)) {
        setMoveOpen(false);
        setCatOpen(false);
        setLayoutOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div
      ref={ribbonRef}
      role="toolbar"
      aria-label="Mail actions"
      className="h-12 shrink-0 bg-white dark:bg-[#202024] border-b border-neutral-200 dark:border-neutral-800 px-3 flex items-center justify-between gap-2 overflow-x-auto"
    >
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={onComposeNew}
          className="h-8 px-3.5 rounded-md bg-[#0F6CBD] hover:bg-[#0D5CA3] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
        >
          <PenSquare className="w-3.5 h-3.5" aria-hidden="true" />
          <span>New mail</span>
        </button>

        <div className="h-5 w-px bg-neutral-200 dark:bg-neutral-700 mx-1 shrink-0" aria-hidden="true" />

        <button
          type="button"
          onClick={onDelete}
          disabled={!hasSelection}
          title="Delete selected (Del)"
          className="h-8 px-2.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Delete</span>
        </button>

        <button
          type="button"
          onClick={onArchive}
          disabled={!hasSelection}
          title="Archive"
          className="h-8 px-2.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap shrink-0"
        >
          <Archive className="w-3.5 h-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Archive</span>
        </button>

        <button
          type="button"
          onClick={onJunk}
          disabled={!hasSelection}
          title="Report junk"
          className="hidden md:inline-flex h-8 px-2.5 rounded-md text-xs font-medium items-center gap-1.5 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap shrink-0"
        >
          <ShieldAlert className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Junk</span>
        </button>

        <button
          type="button"
          onClick={onToggleRead}
          disabled={!hasSelection}
          className="hidden sm:inline-flex h-8 px-2.5 rounded-md text-xs font-medium items-center gap-1.5 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap shrink-0"
        >
          <MailOpen className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{selectedIsRead ? 'Mark unread' : 'Mark read'}</span>
        </button>

        <button
          type="button"
          onClick={onToggleFlag}
          disabled={!hasSelection}
          className="hidden md:inline-flex h-8 px-2.5 rounded-md text-xs font-medium items-center gap-1.5 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap shrink-0"
        >
          <Flag className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{selectedIsFlagged ? 'Unflag' : 'Flag'}</span>
        </button>

        {/* Move To Dropdown */}
        <div className="relative">
          <button
            type="button"
            disabled={!hasSelection}
            onClick={() => {
              setMoveOpen((v) => !v);
              setCatOpen(false);
              setLayoutOpen(false);
            }}
            aria-expanded={moveOpen}
            className="h-8 px-2.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap shrink-0"
          >
            <FolderInput className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden xl:inline">Move to</span>
          </button>
          {moveOpen && (
            <div className="absolute left-0 mt-1 w-48 bg-white dark:bg-[#2A2A2E] border border-neutral-200 dark:border-neutral-700 rounded-md shadow-lg py-1 z-40">
              {folders.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    onMoveTo(f.id);
                    setMoveOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-700 truncate"
                >
                  {f.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Categorize Dropdown */}
        <div className="relative hidden lg:block">
          <button
            type="button"
            disabled={!hasSelection}
            onClick={() => {
              setCatOpen((v) => !v);
              setMoveOpen(false);
              setLayoutOpen(false);
            }}
            aria-expanded={catOpen}
            className="h-8 px-2.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap shrink-0"
          >
            <Tag className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Categorize</span>
          </button>
          {catOpen && (
            <div className="absolute left-0 mt-1 w-44 bg-white dark:bg-[#2A2A2E] border border-neutral-200 dark:border-neutral-700 rounded-md shadow-lg py-1 z-40">
              {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    onCategorize(cat);
                    setCatOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-2"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-xs shrink-0"
                    style={{ backgroundColor: color }}
                    aria-hidden="true"
                  />
                  <span>{cat}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Ribbon Controls */}
      <div className="flex items-center gap-1.5 shrink-0">
        {selectionCount > 1 && (
          <span className="text-xs font-medium text-[#0F6CBD] dark:text-[#479EF5] tabular-nums px-2 whitespace-nowrap">
            {selectionCount} selected
          </span>
        )}

        <button
          type="button"
          onClick={onToggleSelectMode}
          aria-pressed={selectMode}
          title="Multi-select messages"
          className={`h-8 px-2.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
            selectMode
              ? 'bg-[#CFE4FA] dark:bg-[#1E3A5F] text-[#0F6CBD] dark:text-white'
              : 'text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
        >
          <CheckSquare className="w-3.5 h-3.5" aria-hidden="true" />
          <span className="hidden xl:inline">Select</span>
        </button>

        <div className="relative hidden md:block">
          <button
            type="button"
            onClick={() => {
              setLayoutOpen((v) => !v);
              setMoveOpen(false);
              setCatOpen(false);
            }}
            aria-expanded={layoutOpen}
            title="Reading pane layout"
            className="h-8 px-2.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 whitespace-nowrap shrink-0"
          >
            <Columns2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden xl:inline">Layout</span>
          </button>
          {layoutOpen && (
            <div className="absolute right-0 mt-1 w-44 bg-white dark:bg-[#2A2A2E] border border-neutral-200 dark:border-neutral-700 rounded-md shadow-lg py-1 z-40">
              {(['right', 'bottom', 'off'] as const).map((pos) => (
                <button
                  key={pos}
                  type="button"
                  onClick={() => {
                    onChangeReadingPane(pos);
                    setLayoutOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-700 capitalize ${
                    readingPanePosition === pos ? 'font-semibold text-[#0F6CBD] dark:text-[#479EF5]' : ''
                  }`}
                >
                  Reading pane: {pos}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onSync}
          disabled={isSyncing}
          className="h-8 px-2.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-60 whitespace-nowrap shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} aria-hidden="true" />
          <span className="hidden sm:inline">{isSyncing ? 'Syncing...' : 'Sync'}</span>
        </button>
      </div>
    </div>
  );
}
