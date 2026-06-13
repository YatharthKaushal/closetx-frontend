import { useCallback, useState } from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/cn';

export type SortDir = 'asc' | 'desc';

export type SortState<K extends string = string> = {
  key: K;
  dir: SortDir;
};

/**
 * Hook for managing single-column sort state with toggle behaviour:
 * click same column flips direction, click other column starts ascending.
 * `clear()` resets to the initial value (null unless provided).
 */
export function useSort<K extends string>(initial: SortState<K> | null = null) {
  const [sort, setSort] = useState<SortState<K> | null>(initial);
  const toggle = useCallback((key: K) => {
    setSort((cur) => {
      if (!cur || cur.key !== key) return { key, dir: 'asc' };
      return { key, dir: cur.dir === 'asc' ? 'desc' : 'asc' };
    });
  }, []);
  const clear = useCallback(() => setSort(initial), [initial]);
  return { sort, toggle, setSort, clear };
}

/**
 * Sort an array of rows by a key, given current sort state and a getter that
 * returns a sortable primitive (string | number | Date | null) per row.
 * Stable: nullish values sink to the bottom regardless of direction.
 */
export function sortRows<T, K extends string>(
  rows: T[],
  sort: SortState<K> | null,
  getValue: (row: T, key: K) => string | number | Date | null | undefined,
): T[] {
  if (!sort) return rows;
  const copy = [...rows];
  copy.sort((a, b) => {
    const va = getValue(a, sort.key);
    const vb = getValue(b, sort.key);
    const na = va === null || va === undefined;
    const nb = vb === null || vb === undefined;
    if (na && nb) return 0;
    if (na) return 1;
    if (nb) return -1;
    let cmp = 0;
    if (va instanceof Date && vb instanceof Date) cmp = va.getTime() - vb.getTime();
    else if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb;
    else cmp = String(va).localeCompare(String(vb));
    return sort.dir === 'asc' ? cmp : -cmp;
  });
  return copy;
}

export function Th({
  children,
  className,
  sortable,
  sortKey,
  active,
  direction,
  onSort,
  ariaSort,
}: {
  children?: React.ReactNode;
  className?: string;
  sortable?: boolean;
  sortKey?: string;
  active?: boolean;
  direction?: SortDir | undefined;
  onSort?: (key: string) => void;
  ariaSort?: 'ascending' | 'descending' | 'none';
}) {
  const base = 'px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-3';
  if (!sortable) {
    return <th className={cn(base, className)}>{children}</th>;
  }
  return (
    <th className={cn(base, className)} aria-sort={ariaSort ?? 'none'}>
      <button
        type="button"
        onClick={() => sortKey && onSort?.(sortKey)}
        className={cn(
          'inline-flex items-center gap-1 hover:text-ink',
          active && 'text-ink',
        )}
        aria-label={
          sortKey
            ? `Sort by ${typeof children === 'string' ? children : sortKey}, currently ${ariaSort ?? 'unsorted'}`
            : undefined
        }
      >
        {children}
        {active ? (
          direction === 'asc' ? (
            <ChevronUp className="size-3" aria-hidden />
          ) : (
            <ChevronDown className="size-3" aria-hidden />
          )
        ) : (
          <ChevronsUpDown className="size-3 opacity-50" aria-hidden />
        )}
      </button>
    </th>
  );
}

export function Td({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return <td className={cn('px-4 py-3 align-top', className)}>{children}</td>;
}

/**
 * Helper to compute Th sort props from a sort state. Includes aria-sort
 * so the table announces sort state to screen readers.
 */
export function sortProps<K extends string>(
  sort: SortState<K> | null,
  key: K,
  onSort: (key: K) => void,
) {
  const active = sort?.key === key;
  const direction = active ? sort?.dir : undefined;
  const ariaSort: 'ascending' | 'descending' | 'none' = active
    ? sort?.dir === 'asc'
      ? 'ascending'
      : 'descending'
    : 'none';
  return {
    sortable: true,
    sortKey: key,
    active,
    direction,
    ariaSort,
    onSort: onSort as (key: string) => void,
  };
}
