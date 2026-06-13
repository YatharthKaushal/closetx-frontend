/**
 * Helpers for the time-boxed order cards (acceptance window / try-on door window).
 * Used by both the depleting CountdownBar and the column sort comparators.
 */
import type { OrderListRow, OrderStatus } from '@/lib/types';

/** The deadline that governs a card in a given column, if any. */
export function cardDeadline(o: OrderListRow): string | null {
  if (o.status === 'routing') return o.acceptanceDeadlineAt ?? null;
  if (o.status === 'at_door') return o.doorWindowExpiresAt ?? null;
  return null;
}

export function remainingMs(deadlineAt: string | null | undefined, now = Date.now()): number {
  if (!deadlineAt) return Infinity;
  return new Date(deadlineAt).getTime() - now;
}

/** Expired AND the deadline fell on today's date (so it resets each day). */
export function isExpiredToday(deadlineAt: string | null | undefined, now = Date.now()): boolean {
  if (!deadlineAt) return false;
  const t = new Date(deadlineAt).getTime();
  if (t > now) return false;
  return new Date(t).toDateString() === new Date(now).toDateString();
}

const EXCEPTION_STATUSES: OrderStatus[] = ['undelivered', 'returning_to_store', 'returned_to_store'];
export function isException(o: OrderListRow): boolean {
  return EXCEPTION_STATUSES.includes(o.status);
}
