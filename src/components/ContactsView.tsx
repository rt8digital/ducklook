import {
  Building2,
  Edit3,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  Star,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ContactRecord } from '../types';
import { Avatar } from './Avatar';

interface ContactsViewProps {
  contacts: ContactRecord[];
  activeAccountId: string;
  onCreateContact: (payload: Omit<ContactRecord, 'id' | 'avatarUrl'>) => Promise<void>;
  onUpdateContact: (id: string, patch: Partial<ContactRecord>) => Promise<void>;
  onDeleteContact: (id: string) => Promise<void>;
  onComposeToContact: (contact: ContactRecord) => void;
}

export function ContactsView({
  contacts,
  activeAccountId,
  onCreateContact,
  onUpdateContact,
  onDeleteContact,
  onComposeToContact,
}: ContactsViewProps) {
  const [filterMode, setFilterMode] = useState<'all' | 'favorites'>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(() => contacts[0]?.id || null);
  const [editing, setEditing] = useState<Partial<ContactRecord> | null>(null);

  const filtered = useMemo(() => {
    return contacts.filter((c) => {
      if (filterMode === 'favorites' && !c.isFavorite) return false;
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        c.displayName.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q) ||
        c.jobTitle.toLowerCase().includes(q)
      );
    });
  }, [contacts, filterMode, query]);

  const activeContact = filtered.find((c) => c.id === selectedId) || filtered[0] || null;

  const openEditor = (c?: ContactRecord) => {
    if (c) {
      setEditing({ ...c });
    } else {
      setEditing({
        accountId: activeAccountId,
        firstName: '',
        lastName: '',
        displayName: '',
        email: '',
        phone: '',
        company: '',
        jobTitle: '',
        department: '',
        location: '',
        notes: '',
        isFavorite: false,
        category: 'Colleagues',
      });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !editing.email?.trim()) return;
    if (editing.id) {
      await onUpdateContact(editing.id, editing);
    } else {
      await onCreateContact({
        accountId: activeAccountId,
        firstName: editing.firstName || '',
        lastName: editing.lastName || '',
        displayName:
          editing.displayName?.trim() ||
          `${editing.firstName || ''} ${editing.lastName || ''}`.trim() ||
          editing.email,
        email: editing.email.trim(),
        phone: editing.phone || '',
        company: editing.company || '',
        jobTitle: editing.jobTitle || '',
        department: editing.department || '',
        location: editing.location || '',
        notes: editing.notes || '',
        isFavorite: Boolean(editing.isFavorite),
        category: editing.category || 'Colleagues',
      });
    }
    setEditing(null);
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-[#1F1F23] overflow-hidden">
      {/* Header Toolbar */}
      <div className="h-12 px-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => openEditor()}
            className="h-8 px-3.5 rounded-md bg-[#0F6CBD] hover:bg-[#0D5CA3] text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>New contact</span>
          </button>

          <div
            role="tablist"
            aria-label="Contact filter"
            className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 p-0.5 rounded-md"
          >
            {(['all', 'favorites'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={filterMode === m}
                onClick={() => setFilterMode(m)}
                className={`px-2.5 py-1 text-xs font-medium rounded capitalize transition-colors whitespace-nowrap ${
                  filterMode === m
                    ? 'bg-white dark:bg-[#2C2C32] text-[#0F6CBD] dark:text-[#479EF5] shadow-2xs'
                    : 'text-neutral-600 dark:text-neutral-400'
                }`}
              >
                {m === 'all' ? 'All contacts' : 'Favorites'}
              </button>
            ))}
          </div>
        </div>

        <div className="relative w-56 sm:w-64">
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-2.5" aria-hidden="true" />
          <label htmlFor="contacts-search" className="sr-only">
            Search contacts
          </label>
          <input
            id="contacts-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter people..."
            className="w-full h-8 pl-8 pr-3 rounded-md border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-xs focus:outline-none focus:border-[#0F6CBD]"
          />
        </div>
      </div>

      {/* Directory Split */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left List */}
        <div className="w-full md:w-80 shrink-0 border-b md:border-b-0 md:border-r border-neutral-200 dark:border-neutral-800 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800/70 max-h-[42vh] md:max-h-none">
          {filtered.length === 0 ? (
            <div className="p-8 text-center">
              <Users className="w-9 h-9 text-neutral-300 dark:text-neutral-600 mx-auto mb-2" />
              <p className="text-xs text-neutral-500">No matching contacts.</p>
            </div>
          ) : (
            filtered.map((c) => {
              const selected = activeContact?.id === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className={`w-full px-3.5 py-2.5 text-left flex items-center gap-3 transition-colors ${
                    selected
                      ? 'bg-[#EFF6FC] dark:bg-[#1B2A3A]'
                      : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
                  }`}
                >
                  <Avatar name={c.displayName} email={c.email} src={c.avatarUrl} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-semibold truncate text-[#242424] dark:text-white">
                        {c.displayName}
                      </span>
                      {c.isFavorite && (
                        <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" aria-label="Favorite" />
                      )}
                    </div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                      {c.jobTitle ? `${c.jobTitle} · ${c.company}` : c.email}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Right Detail Card */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#FAFAFA] dark:bg-[#19191D]">
          {activeContact ? (
            <div className="max-w-2xl bg-white dark:bg-[#232328] border border-neutral-200 dark:border-neutral-800 rounded-lg p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-neutral-200 dark:border-neutral-800">
                <div className="flex items-center gap-4">
                  <Avatar
                    name={activeContact.displayName}
                    email={activeContact.email}
                    src={activeContact.avatarUrl}
                    size="xl"
                  />
                  <div>
                    <h2 className="font-display font-semibold text-xl text-[#242424] dark:text-white">
                      {activeContact.displayName}
                    </h2>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">
                      {[activeContact.jobTitle, activeContact.company].filter(Boolean).join(' · ') ||
                        activeContact.category}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onComposeToContact(activeContact)}
                    className="h-8 px-3.5 rounded-md bg-[#0F6CBD] hover:bg-[#0D5CA3] text-white text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    <Mail className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Send email</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateContact(activeContact.id, { isFavorite: !activeContact.isFavorite })}
                    aria-label={activeContact.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                    className="min-w-[34px] min-h-[34px] rounded-md border border-neutral-200 dark:border-neutral-700 inline-flex items-center justify-center hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    <Star
                      className={`w-4 h-4 ${
                        activeContact.isFavorite ? 'text-amber-500 fill-amber-500' : 'text-neutral-400'
                      }`}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditor(activeContact)}
                    aria-label="Edit contact"
                    className="min-w-[34px] min-h-[34px] rounded-md border border-neutral-200 dark:border-neutral-700 inline-flex items-center justify-center hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteContact(activeContact.id)}
                    aria-label="Delete contact"
                    className="min-w-[34px] min-h-[34px] rounded-md border border-neutral-200 dark:border-neutral-700 inline-flex items-center justify-center text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-5 text-xs">
                <div>
                  <dt className="text-neutral-500 dark:text-neutral-400 mb-1 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5" aria-hidden="true" /> Email
                  </dt>
                  <dd className="font-medium text-sm text-[#0F6CBD] dark:text-[#479EF5]">
                    {activeContact.email}
                  </dd>
                </div>
                <div>
                  <dt className="text-neutral-500 dark:text-neutral-400 mb-1 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5" aria-hidden="true" /> Phone
                  </dt>
                  <dd className="font-medium text-sm tabular-nums">{activeContact.phone || '—'}</dd>
                </div>
                <div>
                  <dt className="text-neutral-500 dark:text-neutral-400 mb-1 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" aria-hidden="true" /> Department &amp; Organization
                  </dt>
                  <dd className="font-medium text-sm">
                    {[activeContact.department, activeContact.company].filter(Boolean).join(' · ') || '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-neutral-500 dark:text-neutral-400 mb-1 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" aria-hidden="true" /> Office Location
                  </dt>
                  <dd className="font-medium text-sm">{activeContact.location || '—'}</dd>
                </div>
              </dl>

              {activeContact.notes && (
                <div className="mt-5 pt-4 border-t border-neutral-200 dark:border-neutral-800">
                  <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">Notes</div>
                  <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
                    {activeContact.notes}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-neutral-500">
              Select a contact to view details.
            </div>
          )}
        </div>
      </div>

      {/* Contact Edit Modal */}
      {editing && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="contact-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <form
            onSubmit={handleSave}
            className="w-full max-w-md bg-white dark:bg-[#232328] rounded-lg border border-neutral-200 dark:border-neutral-700 shadow-2xl overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
              <h2 id="contact-modal-title" className="font-display font-semibold text-sm">
                {editing.id ? 'Edit Contact' : 'New Contact'}
              </h2>
              <button
                type="button"
                onClick={() => setEditing(null)}
                aria-label="Close contact dialog"
                className="p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-medium mb-1">First name</label>
                  <input
                    type="text"
                    value={editing.firstName || ''}
                    onChange={(e) => setEditing({ ...editing, firstName: e.target.value })}
                    className="w-full h-8 px-2.5 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Last name</label>
                  <input
                    type="text"
                    value={editing.lastName || ''}
                    onChange={(e) => setEditing({ ...editing, lastName: e.target.value })}
                    className="w-full h-8 px-2.5 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                  />
                </div>
              </div>
              <div>
                <label className="block font-medium mb-1">Email address *</label>
                <input
                  required
                  type="email"
                  value={editing.email || ''}
                  onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                  className="w-full h-8 px-2.5 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-medium mb-1">Job title</label>
                  <input
                    type="text"
                    value={editing.jobTitle || ''}
                    onChange={(e) => setEditing({ ...editing, jobTitle: e.target.value })}
                    className="w-full h-8 px-2.5 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Company</label>
                  <input
                    type="text"
                    value={editing.company || ''}
                    onChange={(e) => setEditing({ ...editing, company: e.target.value })}
                    className="w-full h-8 px-2.5 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-medium mb-1">Phone</label>
                  <input
                    type="text"
                    value={editing.phone || ''}
                    onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                    className="w-full h-8 px-2.5 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Location</label>
                  <input
                    type="text"
                    value={editing.location || ''}
                    onChange={(e) => setEditing({ ...editing, location: e.target.value })}
                    className="w-full h-8 px-2.5 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                  />
                </div>
              </div>
              <div>
                <label className="block font-medium mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={editing.notes || ''}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                  className="w-full p-2 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                />
              </div>
            </div>

            <div className="px-4 py-3 bg-[#F8F8F8] dark:bg-[#1B1B1E] border-t border-neutral-200 dark:border-neutral-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="h-8 px-3 rounded border border-neutral-300 dark:border-neutral-700 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-8 px-4 rounded bg-[#0F6CBD] hover:bg-[#0D5CA3] text-white text-xs font-semibold"
              >
                Save contact
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
