import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronDown, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import type { AdminStoreView } from '@/lib/types';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';

type Props = {
  value: string;
  onChange: (storeId: string) => void;
  /** Trigger label override; defaults to "Pick a store". */
  placeholder?: string;
  disabled?: boolean;
  /** Extra non-store options rendered above the store list (e.g. "All", "Platform-wide"). */
  extraOptions?: { value: string; label: string }[];
};

/**
 * Searchable store dropdown for admin dialogs that need a storeId. Fetches
 * /admin/stores once (React Query dedups across mounts) and renders a
 * popover with text filter so admins don't have to copy UUIDs around.
 */
export function StoreCombobox({ value, onChange, placeholder = 'Pick a store', disabled, extraOptions }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'stores', 'all'],
    queryFn: () => api<AdminStoreView[]>('/admin/stores'),
  });
  const stores = data ?? [];

  const extra = extraOptions ?? [];
  const selectedExtra = extra.find((o) => o.value === value);
  const selected = stores.find((s) => s.id === value);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return stores;
    return stores.filter((s) =>
      s.legalName.toLowerCase().includes(q) ||
      s.id.toLowerCase().includes(q) ||
      (s.retailer?.email.toLowerCase().includes(q) ?? false),
    );
  }, [query, stores]);

  /**
   * Visible extras: always include the currently-selected extra so users don't
   * "lose" their selection when they start typing. Then surface any that match
   * the query (substring on label). Order: selected first, then others matching.
   */
  const visibleExtras = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return extra;
    const matches = extra.filter((o) => o.label.toLowerCase().includes(q));
    if (!selectedExtra) return matches;
    return matches.some((o) => o.value === selectedExtra.value)
      ? matches
      : [selectedExtra, ...matches];
  }, [query, extra, selectedExtra]);

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery(''); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-line-2 bg-bg px-3 text-[13.5px]',
            'hover:border-line-strong focus:outline-none focus:border-ink focus:ring-2 focus:ring-accent/20',
            'disabled:cursor-not-allowed disabled:opacity-60',
            selected || selectedExtra ? 'text-ink' : 'text-ink-4',
          )}
        >
          {selectedExtra ? (
            <span className="truncate">{selectedExtra.label}</span>
          ) : selected ? (
            <span className="flex items-baseline gap-2 truncate">
              <span className="truncate">{selected.legalName}</span>
              <span className="font-mono text-[11px] text-ink-3">{selected.id.slice(0, 8)}…</span>
            </span>
          ) : (
            <span>{isLoading ? 'Loading stores…' : placeholder}</span>
          )}
          <ChevronDown className="size-4 text-ink-3 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-[320px] p-0">
        <div className="border-b border-line p-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-ink-4" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, email, or ID…"
              className="pl-7 h-8 text-[12.5px]"
            />
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto py-1">
          {visibleExtras.map((o) => {
            const active = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false); setQuery(''); }}
                className={cn(
                  'flex w-full items-start gap-2 px-3 py-2 text-left text-[12.5px] hover:bg-bg-2',
                  active && 'bg-bg-2',
                )}
              >
                <Check className={cn('size-3.5 mt-0.5 text-ink-3 shrink-0', !active && 'invisible')} />
                <div className="min-w-0 flex-1 text-ink">{o.label}</div>
              </button>
            );
          })}
          {visibleExtras.length > 0 && filtered.length > 0 && (
            <div className="my-1 border-t border-line" />
          )}
          {filtered.length === 0 && visibleExtras.length === 0 ? (
            <div className="px-3 py-6 text-center text-[12px] text-ink-4">
              {isLoading ? 'Loading…' : 'No stores match.'}
            </div>
          ) : filtered.length === 0 ? null : (
            filtered.map((s) => {
              const active = s.id === value;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => { onChange(s.id); setOpen(false); setQuery(''); }}
                  className={cn(
                    'flex w-full items-start gap-2 px-3 py-2 text-left text-[12.5px] hover:bg-bg-2',
                    active && 'bg-bg-2',
                  )}
                >
                  <Check className={cn('size-3.5 mt-0.5 text-ink-3 shrink-0', !active && 'invisible')} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-ink">{s.legalName}</div>
                    <div className="flex gap-2 text-[11px] text-ink-4">
                      <span className="font-mono">{s.id.slice(0, 8)}…</span>
                      {s.retailer && <span className="truncate">· {s.retailer.email}</span>}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
