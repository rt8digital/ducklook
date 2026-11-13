import { Calendar, CheckSquare, Mail, Users } from 'lucide-react';

export type ActiveModule = 'mail' | 'calendar' | 'contacts' | 'tasks';

interface AppRailProps {
  activeModule: ActiveModule;
  onSelectModule: (mod: ActiveModule) => void;
  unreadInboxCount: number;
}

const ITEMS: Array<{ id: ActiveModule; label: string; icon: typeof Mail }> = [
  { id: 'mail', label: 'Mail', icon: Mail },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'contacts', label: 'People', icon: Users },
  { id: 'tasks', label: 'To Do', icon: CheckSquare },
];

export function AppRail({ activeModule, onSelectModule, unreadInboxCount }: AppRailProps) {
  return (
    <>
      {/* Desktop / Tablet Vertical Rail */}
      <nav
        aria-label="DuckLook modules"
        className="hidden md:flex flex-col items-center w-12 shrink-0 bg-[#F0F0F0] dark:bg-[#1B1B1E] border-r border-neutral-200 dark:border-neutral-800 py-2 gap-1"
      >
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeModule === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectModule(item.id)}
              aria-current={isActive ? 'page' : undefined}
              aria-label={
                item.id === 'mail' && unreadInboxCount > 0
                  ? `${item.label}, ${unreadInboxCount} unread`
                  : item.label
              }
              title={item.label}
              className={`relative w-10 h-10 rounded-md inline-flex items-center justify-center transition-colors ${
                isActive
                  ? 'bg-white dark:bg-[#2C2C31] text-[#0F6CBD] dark:text-[#479EF5] shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/70 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-100'
              }`}
            >
              <Icon className="w-[18px] h-[18px]" aria-hidden="true" />
              {item.id === 'mail' && unreadInboxCount > 0 && (
                <span className="sr-only">{unreadInboxCount} unread messages</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Mobile Bottom Navigation Bar (strictly <= 56px height) */}
      <nav
        aria-label="DuckLook mobile navigation"
        className="md:hidden fixed bottom-0 inset-x-0 h-14 bg-[#F8F8F8] dark:bg-[#1B1B1E] border-t border-neutral-200 dark:border-neutral-800 grid grid-cols-4 z-30"
      >
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeModule === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectModule(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
                isActive
                  ? 'text-[#0F6CBD] dark:text-[#479EF5]'
                  : 'text-neutral-600 dark:text-neutral-400'
              }`}
            >
              <Icon className="w-5 h-5" aria-hidden="true" />
              <span className="whitespace-nowrap">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
