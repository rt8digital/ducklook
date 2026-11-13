import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Plus,
  Trash2,
  Video,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { CalendarEvent } from '../types';

interface CalendarViewProps {
  events: CalendarEvent[];
  activeAccountId: string;
  onCreateEvent: (payload: Omit<CalendarEvent, 'id'>) => Promise<void>;
  onUpdateEvent: (id: string, patch: Partial<CalendarEvent>) => Promise<void>;
  onDeleteEvent: (id: string) => Promise<void>;
}

type CalViewMode = 'day' | 'workweek' | 'week' | 'month';

const EVENT_COLORS = [
  { label: 'Cobalt Blue', value: '#0F6CBD' },
  { label: 'Emerald', value: '#107C10' },
  { label: 'Violet', value: '#8764B8' },
  { label: 'Amber', value: '#CA5010' },
  { label: 'Teal', value: '#038387' },
  { label: 'Crimson', value: '#C50F1F' },
];

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(d: Date, delta: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + delta);
  return copy;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function toLocalDateInput(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toLocalTimeInput(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CalendarView({
  events,
  activeAccountId,
  onCreateEvent,
  onUpdateEvent,
  onDeleteEvent,
}: CalendarViewProps) {
  const [cursorDate, setCursorDate] = useState<Date>(() => startOfDay(new Date()));
  const [viewMode, setViewMode] = useState<CalViewMode>('week');
  const [modalEvent, setModalEvent] = useState<Partial<CalendarEvent> | null>(null);
  const [saving, setSaving] = useState(false);

  // Modal form state
  const [formTitle, setFormTitle] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formStartTime, setFormStartTime] = useState('09:00');
  const [formEndTime, setFormEndTime] = useState('10:00');
  const [formLocation, setFormLocation] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formColor, setFormColor] = useState('#0F6CBD');
  const [formOnline, setFormOnline] = useState(true);
  const [formStatus, setFormStatus] = useState<'busy' | 'tentative' | 'free' | 'oof'>('busy');

  const today = useMemo(() => startOfDay(new Date()), []);

  const openNewEventModal = (baseDay: Date, hour = 10) => {
    const startTs = new Date(baseDay.getFullYear(), baseDay.getMonth(), baseDay.getDate(), hour, 0).getTime();
    const endTs = startTs + 60 * 60 * 1000;
    setModalEvent({});
    setFormTitle('');
    setFormDate(toLocalDateInput(startTs));
    setFormStartTime(toLocalTimeInput(startTs));
    setFormEndTime(toLocalTimeInput(endTs));
    setFormLocation('');
    setFormDesc('');
    setFormColor('#0F6CBD');
    setFormOnline(true);
    setFormStatus('busy');
  };

  const openEditEventModal = (ev: CalendarEvent) => {
    setModalEvent(ev);
    setFormTitle(ev.title);
    setFormDate(toLocalDateInput(ev.startTs));
    setFormStartTime(toLocalTimeInput(ev.startTs));
    setFormEndTime(toLocalTimeInput(ev.endTs));
    setFormLocation(ev.location);
    setFormDesc(ev.description);
    setFormColor(ev.categoryColor || '#0F6CBD');
    setFormOnline(ev.isOnlineMeeting);
    setFormStatus(ev.status);
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || saving) return;
    setSaving(true);
    try {
      const [y, m, d] = formDate.split('-').map(Number);
      const [sh, sm] = formStartTime.split(':').map(Number);
      const [eh, em] = formEndTime.split(':').map(Number);
      const startTs = new Date(y, m - 1, d, sh, sm).getTime();
      let endTs = new Date(y, m - 1, d, eh, em).getTime();
      if (endTs <= startTs) endTs = startTs + 30 * 60 * 1000;

      if (modalEvent?.id) {
        await onUpdateEvent(modalEvent.id, {
          title: formTitle.trim(),
          startTs,
          endTs,
          location: formLocation.trim(),
          description: formDesc.trim(),
          categoryColor: formColor,
          isOnlineMeeting: formOnline,
          status: formStatus,
        });
      } else {
        await onCreateEvent({
          accountId: activeAccountId,
          title: formTitle.trim(),
          description: formDesc.trim(),
          location: formLocation.trim(),
          startTs,
          endTs,
          allDay: false,
          categoryColor: formColor,
          attendees: [],
          isOnlineMeeting: formOnline,
          meetingLink: '',
          recurrence: 'none',
          reminderMinutes: 15,
          status: formStatus,
        });
      }
      setModalEvent(null);
    } finally {
      setSaving(false);
    }
  };

  const visibleDays = useMemo(() => {
    if (viewMode === 'day') return [cursorDate];
    const dayOfWeek = cursorDate.getDay();
    const sunday = addDays(cursorDate, -dayOfWeek);
    if (viewMode === 'workweek') {
      return [1, 2, 3, 4, 5].map((offset) => addDays(sunday, offset));
    }
    if (viewMode === 'week') {
      return [0, 1, 2, 3, 4, 5, 6].map((offset) => addDays(sunday, offset));
    }
    // month grid (42 days starting from Sunday of week containing 1st)
    const firstOfMonth = new Date(cursorDate.getFullYear(), cursorDate.getMonth(), 1);
    const gridStart = addDays(firstOfMonth, -firstOfMonth.getDay());
    return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  }, [cursorDate, viewMode]);

  const navigateRange = (dir: -1 | 1) => {
    if (viewMode === 'day') setCursorDate((d) => addDays(d, dir));
    else if (viewMode === 'week' || viewMode === 'workweek') setCursorDate((d) => addDays(d, dir * 7));
    else setCursorDate((d) => new Date(d.getFullYear(), d.getMonth() + dir, 1));
  };

  // Mini month days
  const miniMonthDays = useMemo(() => {
    const first = new Date(cursorDate.getFullYear(), cursorDate.getMonth(), 1);
    const start = addDays(first, -first.getDay());
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [cursorDate]);

  const hours = Array.from({ length: 13 }, (_, i) => i + 7); // 7 AM - 7 PM

  return (
    <div className="h-full flex flex-col bg-white dark:bg-[#1F1F23] overflow-hidden">
      {/* Calendar Toolbar */}
      <div className="h-12 px-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-2 shrink-0 overflow-x-auto">
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => openNewEventModal(cursorDate)}
            className="h-8 px-3.5 rounded-md bg-[#0F6CBD] hover:bg-[#0D5CA3] text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>New event</span>
          </button>

          <button
            type="button"
            onClick={() => setCursorDate(today)}
            className="h-8 px-3 rounded-md border border-neutral-300 dark:border-neutral-700 text-xs font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 whitespace-nowrap"
          >
            Today
          </button>

          <div className="flex items-center">
            <button
              type="button"
              onClick={() => navigateRange(-1)}
              aria-label="Previous period"
              className="min-w-[34px] min-h-[34px] inline-flex items-center justify-center rounded hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => navigateRange(1)}
              aria-label="Next period"
              className="min-w-[34px] min-h-[34px] inline-flex items-center justify-center rounded hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <h1 className="font-display font-semibold text-sm sm:text-base whitespace-nowrap">
            {cursorDate.toLocaleDateString([], { month: 'long', year: 'numeric' })}
          </h1>
        </div>

        <div
          role="tablist"
          aria-label="Calendar view"
          className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 p-0.5 rounded-md shrink-0"
        >
          {(
            [
              { id: 'day', label: 'Day' },
              { id: 'workweek', label: 'Work week' },
              { id: 'week', label: 'Week' },
              { id: 'month', label: 'Month' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={viewMode === tab.id}
              onClick={() => setViewMode(tab.id)}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                viewMode === tab.id
                  ? 'bg-white dark:bg-[#2C2C32] text-[#0F6CBD] dark:text-[#479EF5] shadow-2xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Split */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Mini-Calendar Sidebar */}
        <aside className="hidden lg:flex w-60 shrink-0 border-r border-neutral-200 dark:border-neutral-800 bg-[#F8F8F8] dark:bg-[#18181B] flex-col p-3 space-y-4 overflow-y-auto">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-display font-semibold text-xs">
                {cursorDate.toLocaleDateString([], { month: 'short', year: 'numeric' })}
              </span>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => setCursorDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                  aria-label="Previous month"
                  className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setCursorDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                  aria-label="Next month"
                  className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 text-center text-[10px] font-semibold text-neutral-500 mb-1">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <span key={i}>{d}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-0.5 text-center">
              {miniMonthDays.map((d) => {
                const inMonth = d.getMonth() === cursorDate.getMonth();
                const isToday = isSameDay(d, today);
                const isSelected = isSameDay(d, cursorDate);
                return (
                  <button
                    key={d.toISOString()}
                    type="button"
                    onClick={() => setCursorDate(d)}
                    className={`h-7 w-7 mx-auto rounded-full text-[11px] tabular-nums inline-flex items-center justify-center transition-colors ${
                      isToday
                        ? 'bg-[#0F6CBD] text-white font-semibold'
                        : isSelected
                        ? 'bg-[#CFE4FA] dark:bg-[#1E3A5F] text-[#0F6CBD] dark:text-white font-semibold'
                        : inMonth
                        ? 'hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200'
                        : 'text-neutral-400 dark:text-neutral-600'
                    }`}
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-neutral-200 dark:border-neutral-800 pt-3">
            <h2 className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-2">
              Upcoming events
            </h2>
            <div className="space-y-2">
              {events.slice(0, 5).map((ev) => (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => openEditEventModal(ev)}
                  className="w-full text-left p-2 rounded-md bg-white dark:bg-[#232328] border border-neutral-200 dark:border-neutral-800 hover:border-[#0F6CBD] transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-xs shrink-0"
                      style={{ backgroundColor: ev.categoryColor }}
                    />
                    <span className="text-xs font-medium truncate">{ev.title}</span>
                  </div>
                  <div className="text-[11px] text-neutral-500 tabular-nums mt-0.5 pl-3.5">
                    {new Date(ev.startTs).toLocaleDateString([], { month: 'short', day: 'numeric' })} ·{' '}
                    {new Date(ev.startTs).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Calendar Grid */}
        <div className="flex-1 overflow-auto">
          {viewMode === 'month' ? (
            <div className="h-full min-h-[520px] flex flex-col">
              <div className="grid grid-cols-7 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#1B1B1E] text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <div key={d} className="px-2 py-2 text-center border-r last:border-r-0 border-neutral-200 dark:border-neutral-800">
                    {d}
                  </div>
                ))}
              </div>
              <div className="flex-1 grid grid-cols-7 grid-rows-6">
                {visibleDays.map((day) => {
                  const dayEvents = events.filter((ev) => isSameDay(new Date(ev.startTs), day));
                  const inMonth = day.getMonth() === cursorDate.getMonth();
                  const isToday = isSameDay(day, today);
                  return (
                    <div
                      key={day.toISOString()}
                      onClick={() => openNewEventModal(day)}
                      className={`min-h-[84px] p-1.5 border-r border-b border-neutral-200 dark:border-neutral-800 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors ${
                        !inMonth ? 'bg-neutral-50/60 dark:bg-[#18181B]/60' : ''
                      }`}
                    >
                      <div className="flex justify-end mb-1">
                        <span
                          className={`text-xs tabular-nums w-6 h-6 inline-flex items-center justify-center rounded-full ${
                            isToday
                              ? 'bg-[#0F6CBD] text-white font-semibold'
                              : inMonth
                              ? 'text-neutral-800 dark:text-neutral-200'
                              : 'text-neutral-400 dark:text-neutral-600'
                          }`}
                        >
                          {day.getDate()}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {dayEvents.slice(0, 3).map((ev) => (
                          <button
                            key={ev.id}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditEventModal(ev);
                            }}
                            style={{ backgroundColor: ev.categoryColor }}
                            className="w-full text-left px-1.5 py-0.5 rounded text-[11px] font-medium text-white truncate block"
                          >
                            {new Date(ev.startTs).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}{' '}
                            {ev.title}
                          </button>
                        ))}
                        {dayEvents.length > 3 && (
                          <div className="text-[10px] text-neutral-500 pl-1">+{dayEvents.length - 3} more</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="min-w-[540px]">
              {/* Day Columns Header */}
              <div
                className="grid border-b border-neutral-200 dark:border-neutral-800 sticky top-0 bg-white dark:bg-[#1F1F23] z-10"
                style={{ gridTemplateColumns: `64px repeat(${visibleDays.length}, minmax(0, 1fr))` }}
              >
                <div className="p-2 border-r border-neutral-200 dark:border-neutral-800" />
                {visibleDays.map((day) => {
                  const isToday = isSameDay(day, today);
                  return (
                    <div
                      key={day.toISOString()}
                      className="p-2 text-center border-r last:border-r-0 border-neutral-200 dark:border-neutral-800"
                    >
                      <div className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 uppercase">
                        {day.toLocaleDateString([], { weekday: 'short' })}
                      </div>
                      <div
                        className={`mt-0.5 w-7 h-7 mx-auto rounded-full inline-flex items-center justify-center text-sm font-semibold tabular-nums ${
                          isToday ? 'bg-[#0F6CBD] text-white' : 'text-[#242424] dark:text-white'
                        }`}
                      >
                        {day.getDate()}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Hourly Slots */}
              <div className="relative">
                {hours.map((hr) => (
                  <div
                    key={hr}
                    className="grid border-b border-neutral-100 dark:border-neutral-800/80 h-14"
                    style={{ gridTemplateColumns: `64px repeat(${visibleDays.length}, minmax(0, 1fr))` }}
                  >
                    <div className="pr-2 pt-1 text-right text-[11px] text-neutral-500 dark:text-neutral-400 tabular-nums border-r border-neutral-200 dark:border-neutral-800">
                      {hr === 12 ? '12 PM' : hr > 12 ? `${hr - 12} PM` : `${hr} AM`}
                    </div>
                    {visibleDays.map((day) => {
                      const slotEvents = events.filter((ev) => {
                        const s = new Date(ev.startTs);
                        return isSameDay(s, day) && s.getHours() === hr;
                      });
                      return (
                        <div
                          key={`${day.toISOString()}-${hr}`}
                          onClick={() => openNewEventModal(day, hr)}
                          className="relative border-r last:border-r-0 border-neutral-100 dark:border-neutral-800/80 hover:bg-neutral-50 dark:hover:bg-neutral-800/30 cursor-pointer p-0.5"
                        >
                          {slotEvents.map((ev) => (
                            <button
                              key={ev.id}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditEventModal(ev);
                              }}
                              style={{ backgroundColor: ev.categoryColor }}
                              className="w-full text-left px-2 py-1 rounded text-white text-[11px] shadow-2xs overflow-hidden block"
                            >
                              <div className="font-semibold truncate">{ev.title}</div>
                              <div className="text-[10px] opacity-90 truncate">
                                {new Date(ev.startTs).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                {ev.location ? ` · ${ev.location}` : ''}
                              </div>
                            </button>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create / Edit Event Modal */}
      {modalEvent && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="event-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <form
            onSubmit={handleSaveModal}
            className="w-full max-w-lg bg-white dark:bg-[#232328] rounded-lg border border-neutral-200 dark:border-neutral-700 shadow-2xl overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
              <h2 id="event-modal-title" className="font-display font-semibold text-sm flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-[#0F6CBD] dark:text-[#479EF5]" aria-hidden="true" />
                <span>{modalEvent.id ? 'Edit Event' : 'New Calendar Event'}</span>
              </h2>
              <button
                type="button"
                onClick={() => setModalEvent(null)}
                aria-label="Close event dialog"
                className="min-w-[34px] min-h-[34px] inline-flex items-center justify-center rounded hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <label htmlFor="ev-title" className="block text-xs font-medium text-neutral-600 dark:text-neutral-300 mb-1">
                  Title
                </label>
                <input
                  id="ev-title"
                  required
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Add a title"
                  className="w-full h-9 px-3 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:border-[#0F6CBD]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label htmlFor="ev-date" className="block text-xs font-medium text-neutral-600 dark:text-neutral-300 mb-1">
                    Date
                  </label>
                  <input
                    id="ev-date"
                    required
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs tabular-nums"
                  />
                </div>
                <div>
                  <label htmlFor="ev-start" className="block text-xs font-medium text-neutral-600 dark:text-neutral-300 mb-1">
                    Start
                  </label>
                  <input
                    id="ev-start"
                    required
                    type="time"
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs tabular-nums"
                  />
                </div>
                <div>
                  <label htmlFor="ev-end" className="block text-xs font-medium text-neutral-600 dark:text-neutral-300 mb-1">
                    End
                  </label>
                  <input
                    id="ev-end"
                    required
                    type="time"
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label htmlFor="ev-loc" className="block text-xs font-medium text-neutral-600 dark:text-neutral-300 mb-1">
                    Location
                  </label>
                  <div className="relative">
                    <MapPin className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-2.5" aria-hidden="true" />
                    <input
                      id="ev-loc"
                      type="text"
                      value={formLocation}
                      onChange={(e) => setFormLocation(e.target.value)}
                      placeholder="Conference room or URL"
                      className="w-full h-9 pl-8 pr-3 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="ev-status" className="block text-xs font-medium text-neutral-600 dark:text-neutral-300 mb-1">
                    Show as
                  </label>
                  <div className="relative">
                    <Clock className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-2.5" aria-hidden="true" />
                    <select
                      id="ev-status"
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value as typeof formStatus)}
                      className="w-full h-9 pl-8 pr-3 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs"
                    >
                      <option value="busy">Busy</option>
                      <option value="tentative">Tentative</option>
                      <option value="free">Free</option>
                      <option value="oof">Out of Office</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 pt-1">
                <label className="inline-flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formOnline}
                    onChange={(e) => setFormOnline(e.target.checked)}
                    className="w-4 h-4 rounded text-[#0F6CBD]"
                  />
                  <Video className="w-3.5 h-3.5 text-[#4F6BED]" aria-hidden="true" />
                  <span>Teams online meeting</span>
                </label>

                <div className="flex items-center gap-1.5">
                  {EVENT_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setFormColor(c.value)}
                      aria-label={c.label}
                      style={{ backgroundColor: c.value }}
                      className={`w-5 h-5 rounded-full transition-transform ${
                        formColor === c.value ? 'ring-2 ring-offset-2 ring-[#0F6CBD] scale-110' : ''
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="ev-desc" className="block text-xs font-medium text-neutral-600 dark:text-neutral-300 mb-1">
                  Description
                </label>
                <textarea
                  id="ev-desc"
                  rows={3}
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Agenda, notes, or dial-in details..."
                  className="w-full p-2.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs"
                />
              </div>
            </div>

            <div className="px-4 py-3 bg-[#F8F8F8] dark:bg-[#1B1B1E] border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              {modalEvent.id ? (
                <button
                  type="button"
                  onClick={async () => {
                    await onDeleteEvent(modalEvent.id!);
                    setModalEvent(null);
                  }}
                  className="h-8 px-3 rounded-md text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 inline-flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Delete</span>
                </button>
              ) : (
                <span />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setModalEvent(null)}
                  className="h-8 px-3 rounded-md border border-neutral-300 dark:border-neutral-700 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="h-8 px-4 rounded-md bg-[#0F6CBD] hover:bg-[#0D5CA3] text-white text-xs font-semibold"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
