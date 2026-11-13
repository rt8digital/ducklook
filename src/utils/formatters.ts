export const CATEGORY_COLORS: Record<string, string> = {
  Engineering: '#0F6CBD',
  Security: '#C50F1F',
  Finance: '#107C10',
  Meetings: '#8764B8',
  Design: '#038387',
  Legal: '#CA5010',
  Executive: '#4F6BED',
};

export function getCategoryColor(cat: string): string {
  return CATEGORY_COLORS[cat] || '#616161';
}

export function formatListTimestamp(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  const diffDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays < 6 && diffDays >= 0) {
    return date.toLocaleDateString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });
  }

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function formatFullTimestamp(ts: number): string {
  return new Date(ts).toLocaleString([], {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getInitials(name: string): string {
  const cleaned = name.replace(/<[^>]+>/g, '').trim();
  if (!cleaned) return '?';
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

const AVATAR_PALETTE = [
  '#0F6CBD',
  '#038387',
  '#8764B8',
  '#107C10',
  '#CA5010',
  '#4F6BED',
  '#8E562E',
  '#7A7574',
];

export function getAvatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}
