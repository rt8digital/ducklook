import { useState } from 'react';
import { getAvatarColor, getInitials } from '../utils/formatters';

interface AvatarProps {
  name: string;
  email?: string;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const SIZE_CLASSES: Record<'sm' | 'md' | 'lg' | 'xl', string> = {
  sm: 'w-7 h-7 text-[11px]',
  md: 'w-9 h-9 text-xs',
  lg: 'w-11 h-11 text-sm',
  xl: 'w-16 h-16 text-lg',
};

export function Avatar({ name, email, src, size = 'md' }: AvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const initials = getInitials(name || email || '?');
  const bg = getAvatarColor(email || name || 'ducklook');

  if (src && !imgFailed) {
    return (
      <img
        src={src}
        alt={name}
        referrerPolicy="no-referrer"
        onError={() => setImgFailed(true)}
        className={`${SIZE_CLASSES[size]} rounded-full object-cover shrink-0 bg-neutral-200 dark:bg-neutral-700`}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      style={{ backgroundColor: bg }}
      className={`${SIZE_CLASSES[size]} rounded-full shrink-0 inline-flex items-center justify-center font-semibold text-white select-none`}
    >
      {initials}
    </span>
  );
}
