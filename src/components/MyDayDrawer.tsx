import { Calendar, Check, CheckSquare, Plus, X } from 'lucide-react';
import { useState } from 'react';
import type { CalendarEvent, TaskItem } from '../types';

interface MyDayDrawerProps {
  open: boolean;
  onClose: () => void;
  events: CalendarEvent[];
  tasks: TaskItem[];
  activeAccountId: string;
  onCreateTask: (payload: { accountId: string; title: string; listName: 'My Day' }) => Promise<void>;
  onToggleTask: (id: string, isCompleted: boolean) => Promise<void>;
  onOpenCalendar: () => void;
}

export function MyDayDrawer({
  open,
  onClose,
  events,
  tasks,
  activeAccountId,
  onCreateTask,
  onToggleTask,
  onOpenCalendar,
}: MyDayDrawerProps) {
  const [quickTask, setQuickTask] = useState('');

  if (!open) return null;

  const now = new Date();
  const todayEvents = events.filter((ev) => {
    const d = new Date(ev.startTs);
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  });

  const myDayTasks = tasks.filter((t) => t.listName === 'My Day');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTask.trim()) return;
    await onCreateTask({ accountId: activeAccountId, title: quickTask.trim(), listName: 'My Day' });
    setQuickTask('');
  };

  return (
    <aside
      aria-label="My Day agenda and tasks"
      className="fixed md:static right-0 top-12 bottom-0 w-80 max-w-[90vw] shrink-0 bg-[#F8F8F8] dark:bg-[#1B1B1E] border-l border-neutral-200 dark:border-neutral-800 flex flex-col z-40 shadow-xl md:shadow-none"
    >
      <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
        <div>
          <h2 className="font-display font-semibold text-sm">My Day</h2>
          <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
            {now.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close My Day panel"
          className="p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3.5 space-y-5">
        {/* Today's Calendar */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-neutral-600 dark:text-neutral-300 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#0F6CBD] dark:text-[#479EF5]" aria-hidden="true" />
              <span>Today&apos;s Calendar</span>
            </h3>
            <button
              type="button"
              onClick={onOpenCalendar}
              className="text-[11px] text-[#0F6CBD] dark:text-[#479EF5] hover:underline font-medium"
            >
              Open
            </button>
          </div>
          {todayEvents.length === 0 ? (
            <div className="p-3 rounded-md bg-white dark:bg-[#232328] border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-500">
              No remaining events scheduled today.
            </div>
          ) : (
            <div className="space-y-2">
              {todayEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="p-2.5 rounded-md bg-white dark:bg-[#232328] border border-neutral-200 dark:border-neutral-800"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-xs shrink-0"
                      style={{ backgroundColor: ev.categoryColor }}
                    />
                    <span className="text-xs font-semibold truncate">{ev.title}</span>
                  </div>
                  <div className="text-[11px] text-neutral-500 tabular-nums pl-4 mt-0.5">
                    {new Date(ev.startTs).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} –{' '}
                    {new Date(ev.endTs).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </div>
                  {ev.location && (
                    <div className="text-[11px] text-neutral-500 pl-4 truncate">{ev.location}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* My Day To Do */}
        <div>
          <h3 className="text-xs font-semibold text-neutral-600 dark:text-neutral-300 flex items-center gap-1.5 mb-2">
            <CheckSquare className="w-3.5 h-3.5 text-[#0F6CBD] dark:text-[#479EF5]" aria-hidden="true" />
            <span>To Do</span>
          </h3>

          <form onSubmit={handleAdd} className="flex items-center gap-1.5 mb-2.5">
            <label htmlFor="myday-quick-task" className="sr-only">
              Add My Day task
            </label>
            <input
              id="myday-quick-task"
              type="text"
              value={quickTask}
              onChange={(e) => setQuickTask(e.target.value)}
              placeholder="Add a task..."
              className="flex-1 h-8 px-2.5 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs"
            />
            <button
              type="submit"
              aria-label="Add task"
              className="h-8 w-8 rounded bg-[#0F6CBD] text-white inline-flex items-center justify-center shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </form>

          <div className="space-y-1.5">
            {myDayTasks.map((t) => (
              <div
                key={t.id}
                className="px-2.5 py-2 rounded-md bg-white dark:bg-[#232328] border border-neutral-200 dark:border-neutral-800 flex items-center gap-2"
              >
                <button
                  type="button"
                  onClick={() => onToggleTask(t.id, !t.isCompleted)}
                  aria-label={t.isCompleted ? 'Mark incomplete' : 'Mark complete'}
                  className={`w-4 h-4 rounded-full border inline-flex items-center justify-center shrink-0 ${
                    t.isCompleted
                      ? 'bg-[#0F6CBD] border-[#0F6CBD] text-white'
                      : 'border-neutral-400 hover:border-[#0F6CBD]'
                  }`}
                >
                  {t.isCompleted && <Check className="w-2.5 h-2.5" />}
                </button>
                <span className={`text-xs truncate ${t.isCompleted ? 'line-through text-neutral-400' : ''}`}>
                  {t.title}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
