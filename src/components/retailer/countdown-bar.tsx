/**
 * Full-width depleting countdown bar for time-boxed order cards. The fill shrinks
 * with the remaining time and shifts tone as it runs low. When the window has
 * expired *today* it shows an empty faint trail (the card is kept and sorted to
 * the column bottom by the board comparator); a deadline from a previous day
 * renders nothing.
 */
import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { isExpiredToday } from '@/lib/order-deadline';

export function CountdownBar({
  deadlineAt,
  windowMs = 180_000,
  className,
}: {
  deadlineAt: string | null | undefined;
  /** Total window length, for the fill fraction. Default 3 min (acceptance window). */
  windowMs?: number;
  className?: string;
}) {
  const expiresAt = deadlineAt ? new Date(deadlineAt).getTime() : null;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!expiresAt) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [expiresAt]);

  if (!expiresAt) return null;

  const remaining = expiresAt - now;
  const expired = remaining <= 0;

  // Past deadline but not today → treat as a normal (non-timed) card.
  if (expired && !isExpiredToday(deadlineAt, now)) return null;

  const frac = Math.max(0, Math.min(1, remaining / windowMs));
  const fill = expired
    ? 'bg-transparent'
    : frac > 0.5
      ? 'bg-success'
      : frac > 0.25
        ? 'bg-warning'
        : 'bg-danger';

  return (
    <div
      className={cn('h-1 w-full overflow-hidden rounded-t-[inherit] bg-bg-3', className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={Math.round(windowMs / 1000)}
      aria-valuenow={Math.max(0, Math.round(remaining / 1000))}
      title={expired ? 'Window expired' : `${Math.ceil(remaining / 1000)}s left`}
    >
      <div
        className={cn('h-full transition-[width] duration-1000 ease-linear', fill)}
        style={{ width: `${frac * 100}%` }}
      />
    </div>
  );
}
