import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { SidebarGroup } from '@/components/shell/SidebarShell';

type EntityResult = {
  id: string;
  title: string;
  subtitle?: string;
  to: string;
  group: 'Retailers' | 'Stores' | 'Products' | 'Orders' | 'Staff';
};

type PageResult = {
  to: string;
  label: string;
  group: string;
};

type Result =
  | { kind: 'page'; data: PageResult }
  | { kind: 'entity'; data: EntityResult };

const DEBOUNCE_MS = 250;

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

function fuzzyMatch(query: string, target: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (t.includes(q)) return true;
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

export function CommandPalette({
  open,
  onClose,
  groups,
  scope,
}: {
  open: boolean;
  onClose: () => void;
  groups: SidebarGroup[];
  scope: 'admin' | 'retailer';
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounced(query, DEBOUNCE_MS);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Page results use the debounced query too — keeps the result list and
  // activeIndex stable while the user is typing fast (no flicker / re-jump).
  const pageResults: PageResult[] = useMemo(() => {
    const q = debouncedQuery.trim();
    if (!q) return [];
    const out: PageResult[] = [];
    for (const g of groups) {
      for (const it of g.items) {
        if (fuzzyMatch(q, it.label) || fuzzyMatch(q, g.label)) {
          out.push({ to: it.to, label: it.label, group: g.label });
        }
      }
    }
    return out.slice(0, 12);
  }, [debouncedQuery, groups]);

  const entityEnabled = debouncedQuery.trim().length >= 2;

  /**
   * Gate each entity search on the active session's permission for that
   * surface. Matches the `undefined permissions → allow` convention used by
   * `filterSidebarGroups`, so the gate fails *closed* only when the auth
   * store has explicitly observed a permission map (post-login).
   */
  const permissions = useAuth((s) => {
    if (!s.session) return undefined;
    return s.session.permissions;
  });
  const can = (action: string) => !permissions || permissions[action] === true;
  const canSearchListings = can('listings.view');
  const canSearchOrders = can('orders.view');
  const canSearchStaff = can('staff.list');
  const canSearchRetailers = can('applications.view');
  const canSearchAdminStores = can('store_management.view');

  // Admin scope: retailers + stores.
  const retailersQuery = useQuery({
    queryKey: ['cmdk', 'admin', 'retailers', debouncedQuery],
    queryFn: async ({ signal }) => {
      const rows = await api<Array<{ id: string; legalName: string; email: string }>>(
        `/admin/retailers?limit=50`,
        { signal },
      );
      const q = debouncedQuery.toLowerCase();
      return rows.filter(
        (r) =>
          r.legalName.toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q) ||
          r.id.toLowerCase().includes(q),
      );
    },
    enabled: scope === 'admin' && entityEnabled && canSearchRetailers,
    staleTime: 30_000,
  });

  const adminStoresQuery = useQuery({
    queryKey: ['cmdk', 'admin', 'stores', debouncedQuery],
    queryFn: async ({ signal }) => {
      const rows = await api<Array<{ id: string; legalName: string; retailer: { id: string } | null }>>(
        `/admin/stores?limit=200`,
        { signal },
      );
      const q = debouncedQuery.toLowerCase();
      return rows.filter(
        (s) => s.legalName.toLowerCase().includes(q) || s.id.toLowerCase().includes(q),
      );
    },
    enabled: scope === 'admin' && entityEnabled && canSearchAdminStores,
    staleTime: 30_000,
  });

  // Retailer scope: products + orders + staff. Each search hits the same
  // endpoint the corresponding list page already calls, filters client-side
  // by the typed term. React Query dedups against the list page's cache when
  // the user has those open.
  const productsQuery = useQuery({
    queryKey: ['cmdk', 'retailer', 'products', debouncedQuery],
    queryFn: async ({ signal }) => {
      const rows = await api<Array<{ id: string; name: string; status: string }>>(
        `/retailer/listings?limit=100`,
        { signal },
      );
      const q = debouncedQuery.toLowerCase();
      return rows.filter(
        (l) => l.name.toLowerCase().includes(q) || l.id.toLowerCase().includes(q),
      );
    },
    enabled: scope === 'retailer' && entityEnabled && canSearchListings,
    staleTime: 30_000,
  });

  const ordersQuery = useQuery({
    queryKey: ['cmdk', 'retailer', 'orders', debouncedQuery],
    queryFn: async ({ signal }) => {
      // No `q` server param; fetch a sensible window and filter client-side.
      const rows = await api<Array<{ id: string; consumerNameSnap?: string | null; status: string }>>(
        `/retailer/orders?limit=50`,
        { signal },
      );
      const q = debouncedQuery.toLowerCase();
      return rows.filter(
        (o) =>
          o.id.toLowerCase().includes(q) ||
          (o.consumerNameSnap ?? '').toLowerCase().includes(q),
      );
    },
    enabled: scope === 'retailer' && entityEnabled && canSearchOrders,
    staleTime: 30_000,
  });

  const staffQuery = useQuery({
    queryKey: ['cmdk', 'retailer', 'staff', debouncedQuery],
    queryFn: async ({ signal }) => {
      const rows = await api<Array<{ id: string; legalName: string; email: string }>>(
        `/retailer/staff?limit=50`,
        { signal },
      );
      const q = debouncedQuery.toLowerCase();
      return rows.filter(
        (s) =>
          s.legalName.toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q),
      );
    },
    enabled: scope === 'retailer' && entityEnabled && canSearchStaff,
    staleTime: 30_000,
  });

  const entityResults: EntityResult[] = useMemo(() => {
    const out: EntityResult[] = [];
    if (scope === 'admin') {
      if (retailersQuery.data) {
        for (const r of retailersQuery.data.slice(0, 5)) {
          out.push({
            id: r.id,
            title: r.legalName,
            subtitle: r.email,
            to: `/admin/retailers/${r.id}`,
            group: 'Retailers',
          });
        }
      }
      if (adminStoresQuery.data) {
        for (const s of adminStoresQuery.data.slice(0, 5)) {
          out.push({
            id: s.id,
            title: s.legalName,
            subtitle: s.id.slice(0, 8),
            to: s.retailer ? `/admin/retailers/${s.retailer.id}/stores/${s.id}` : `/admin/stores`,
            group: 'Stores',
          });
        }
      }
    } else {
      if (productsQuery.data) {
        for (const p of productsQuery.data.slice(0, 5)) {
          out.push({
            id: p.id,
            title: p.name,
            subtitle: p.status,
            to: `/retailer/listings/${p.id}`,
            group: 'Products',
          });
        }
      }
      if (ordersQuery.data) {
        for (const o of ordersQuery.data.slice(0, 5)) {
          out.push({
            id: o.id,
            title: o.id,
            subtitle: o.consumerNameSnap ?? o.status,
            to: `/retailer/orders/${o.id}`,
            group: 'Orders',
          });
        }
      }
      if (staffQuery.data) {
        for (const s of staffQuery.data.slice(0, 5)) {
          out.push({
            id: s.id,
            title: s.legalName,
            subtitle: s.email,
            to: `/retailer/staff/${s.id}`,
            group: 'Staff',
          });
        }
      }
    }
    return out;
  }, [scope, retailersQuery.data, adminStoresQuery.data, productsQuery.data, ordersQuery.data, staffQuery.data]);

  const results: Result[] = useMemo(() => {
    const out: Result[] = [];
    for (const p of pageResults) out.push({ kind: 'page', data: p });
    for (const e of entityResults) out.push({ kind: 'entity', data: e });
    return out;
  }, [pageResults, entityResults]);

  useEffect(() => {
    if (activeIndex >= results.length) setActiveIndex(0);
  }, [results.length, activeIndex]);

  function go(to: string) {
    navigate(to);
    onClose();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const r = results[activeIndex];
      if (r) go(r.data.to);
    }
  }

  const pageGroup = pageResults.length > 0;
  const entityGroup = entityResults.length > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl p-0 gap-0 overflow-hidden">
        <div className="flex items-center gap-2 border-b border-line px-3 py-2">
          <Search className="size-4 text-ink-4 shrink-0" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={scope === 'admin' ? 'Pages, retailers, stores...' : 'Pages, products, orders...'}
            className="border-0 h-9 !pl-0 shadow-none focus:ring-0 text-[13.5px]"
          />
          <kbd className="kbd shrink-0">esc</kbd>
        </div>
        <div className="max-h-[420px] overflow-y-auto py-1">
          {results.length === 0 && (
            <div className="px-3 py-8 text-center text-[12.5px] text-ink-4">
              {query.trim() ? 'No matches.' : 'Type to search pages and entities.'}
            </div>
          )}
          {pageGroup && (
            <div>
              <div className="px-3 pt-2 pb-1 text-[10.5px] font-semibold uppercase tracking-wider text-ink-4">
                Pages
              </div>
              {pageResults.map((p, i) => {
                const active = activeIndex === i;
                return (
                  <button
                    key={`p-${p.to}`}
                    type="button"
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => go(p.to)}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[13px]',
                      active && 'bg-bg-2',
                    )}
                  >
                    <span className="text-ink">{p.label}</span>
                    <span className="text-[11px] text-ink-4">{p.group}</span>
                  </button>
                );
              })}
            </div>
          )}
          {entityGroup && (
            <div>
              <div className="px-3 pt-2 pb-1 text-[10.5px] font-semibold uppercase tracking-wider text-ink-4">
                Entities
              </div>
              {entityResults.map((e, i) => {
                const idx = pageResults.length + i;
                const active = activeIndex === idx;
                return (
                  <button
                    key={`e-${e.group}-${e.id}`}
                    type="button"
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => go(e.to)}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[13px]',
                      active && 'bg-bg-2',
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      <span className="text-ink">{e.title}</span>
                      {e.subtitle && (
                        <span className="ml-2 text-[11.5px] text-ink-4">{e.subtitle}</span>
                      )}
                    </span>
                    <span className="text-[11px] text-ink-4">{e.group}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="border-t border-line px-3 py-1.5 text-[10.5px] text-ink-4 flex gap-3">
          <span><kbd className="kbd">↑↓</kbd> navigate</span>
          <span><kbd className="kbd">↵</kbd> open</span>
          <span><kbd className="kbd">esc</kbd> close</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
