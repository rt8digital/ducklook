import {
  Calendar,
  Check,
  CheckSquare,
  ListTodo,
  Plus,
  Star,
  Sun,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { TaskItem } from '../types';

interface TasksViewProps {
  tasks: TaskItem[];
  activeAccountId: string;
  onCreateTask: (payload: {
    accountId: string;
    title: string;
    notes?: string;
    isImportant?: boolean;
    dueDate?: number | null;
    listName?: 'My Day' | 'Tasks' | 'Flagged Email';
  }) => Promise<void>;
  onUpdateTask: (id: string, patch: Partial<TaskItem>) => Promise<void>;
  onDeleteTask: (id: string) => Promise<void>;
}

type TaskFilter = 'My Day' | 'Important' | 'Tasks' | 'Completed';

export function TasksView({
  tasks,
  activeAccountId,
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
}: TasksViewProps) {
  const [activeList, setActiveList] = useState<TaskFilter>('My Day');
  const [newTitle, setNewTitle] = useState('');
  const [newDue, setNewDue] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const visibleTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (activeList === 'Completed') return t.isCompleted;
      if (activeList === 'Important') return t.isImportant && !t.isCompleted;
      if (activeList === 'My Day') return t.listName === 'My Day';
      return true;
    });
  }, [tasks, activeList]);

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) || null;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    await onCreateTask({
      accountId: activeAccountId,
      title: newTitle.trim(),
      listName: activeList === 'Tasks' ? 'Tasks' : 'My Day',
      isImportant: activeList === 'Important',
      dueDate: newDue ? new Date(`${newDue}T17:00:00`).getTime() : null,
    });
    setNewTitle('');
    setNewDue('');
  };

  return (
    <div className="h-full flex flex-col md:flex-row bg-white dark:bg-[#1F1F23] overflow-hidden">
      {/* Left Smart Lists */}
      <aside className="w-full md:w-56 shrink-0 border-b md:border-b-0 md:border-r border-neutral-200 dark:border-neutral-800 bg-[#F5F5F5] dark:bg-[#18181B] p-2.5 flex md:flex-col gap-1 overflow-x-auto">
        {(
          [
            { id: 'My Day', icon: Sun },
            { id: 'Important', icon: Star },
            { id: 'Tasks', icon: ListTodo },
            { id: 'Completed', icon: CheckSquare },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          const active = activeList === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveList(item.id)}
              className={`min-h-[36px] px-3 py-1.5 rounded-md text-xs font-medium inline-flex items-center gap-2 whitespace-nowrap transition-colors ${
                active
                  ? 'bg-[#CFE4FA] dark:bg-[#1E3A5F] text-[#0F6CBD] dark:text-white font-semibold'
                  : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-neutral-800'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{item.id}</span>
            </button>
          );
        })}
      </aside>

      {/* Main Task Stream */}
      <div className="flex-1 flex flex-col overflow-hidden p-4 sm:p-6">
        <div className="max-w-3xl w-full mx-auto flex flex-col h-full">
          <div className="mb-4">
            <h1 className="font-display font-semibold text-xl text-[#242424] dark:text-white">
              {activeList}
            </h1>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 tabular-nums">
              {new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })} ·{' '}
              {visibleTasks.filter((t) => !t.isCompleted).length} open
            </p>
          </div>

          <form onSubmit={handleAdd} className="flex flex-wrap sm:flex-nowrap items-center gap-2 mb-4">
            <label htmlFor="new-task-title" className="sr-only">
              Add a task
            </label>
            <input
              id="new-task-title"
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Add a task..."
              className="flex-1 min-w-[200px] h-9 px-3 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs focus:outline-none focus:border-[#0F6CBD]"
            />
            <label htmlFor="new-task-due" className="sr-only">
              Due date
            </label>
            <input
              id="new-task-due"
              type="date"
              value={newDue}
              onChange={(e) => setNewDue(e.target.value)}
              className="h-9 px-2.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs tabular-nums"
            />
            <button
              type="submit"
              className="h-9 px-3.5 rounded-md bg-[#0F6CBD] hover:bg-[#0D5CA3] text-white text-xs font-semibold inline-flex items-center gap-1.5 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Add</span>
            </button>
          </form>

          <div className="flex-1 overflow-y-auto space-y-1.5">
            {visibleTasks.length === 0 ? (
              <div className="py-12 text-center text-xs text-neutral-500">
                No tasks in {activeList}. Add one above to stay organized.
              </div>
            ) : (
              visibleTasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => setSelectedTaskId(task.id)}
                  className={`px-3 py-2.5 rounded-md border flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                    selectedTaskId === task.id
                      ? 'bg-[#EFF6FC] dark:bg-[#1B2A3A] border-[#0F6CBD]'
                      : 'bg-white dark:bg-[#232328] border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/40'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateTask(task.id, { isCompleted: !task.isCompleted });
                      }}
                      aria-label={task.isCompleted ? `Mark "${task.title}" incomplete` : `Complete "${task.title}"`}
                      className={`w-5 h-5 rounded-full border inline-flex items-center justify-center shrink-0 transition-colors ${
                        task.isCompleted
                          ? 'bg-[#0F6CBD] border-[#0F6CBD] text-white'
                          : 'border-neutral-400 hover:border-[#0F6CBD]'
                      }`}
                    >
                      {task.isCompleted && <Check className="w-3 h-3" aria-hidden="true" />}
                    </button>

                    <div className="min-w-0">
                      <div
                        className={`text-sm truncate ${
                          task.isCompleted
                            ? 'line-through text-neutral-400'
                            : 'text-[#242424] dark:text-neutral-100 font-medium'
                        }`}
                      >
                        {task.title}
                      </div>
                      {task.dueDate && (
                        <div className="text-[11px] text-neutral-500 tabular-nums flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3 h-3" aria-hidden="true" />
                          <span>Due {new Date(task.dueDate).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => onUpdateTask(task.id, { isImportant: !task.isImportant })}
                      aria-label={task.isImportant ? 'Remove importance' : 'Mark important'}
                      className="p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700"
                    >
                      <Star
                        className={`w-4 h-4 ${
                          task.isImportant ? 'text-amber-500 fill-amber-500' : 'text-neutral-400'
                        }`}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteTask(task.id)}
                      aria-label={`Delete task ${task.title}`}
                      className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-950/40 text-neutral-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Task Notes Side Panel */}
      {selectedTask && (
        <aside className="w-full md:w-72 shrink-0 border-t md:border-t-0 md:border-l border-neutral-200 dark:border-neutral-800 bg-[#F8F8F8] dark:bg-[#18181B] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-display font-semibold text-xs text-neutral-500 uppercase tracking-wide">
              Task Details
            </span>
            <button
              type="button"
              onClick={() => setSelectedTaskId(null)}
              className="text-xs text-[#0F6CBD] dark:text-[#479EF5] hover:underline"
            >
              Close
            </button>
          </div>
          <input
            type="text"
            value={selectedTask.title}
            onChange={(e) => onUpdateTask(selectedTask.id, { title: e.target.value })}
            aria-label="Task title"
            className="w-full px-2.5 py-1.5 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm font-medium"
          />
          <textarea
            rows={5}
            value={selectedTask.notes}
            onChange={(e) => onUpdateTask(selectedTask.id, { notes: e.target.value })}
            placeholder="Add notes..."
            aria-label="Task notes"
            className="w-full p-2.5 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs"
          />
        </aside>
      )}
    </div>
  );
}
