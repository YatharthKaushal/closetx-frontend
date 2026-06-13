import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowUpRight,
  Check,
  Download,
  FileWarning,
  Power,
  Search,
  Upload,
  X,
} from 'lucide-react';
import { api, ApiError, BASE } from '@/lib/api';
import { getToken } from '@/lib/auth';
import {
  LOW_STOCK_THRESHOLD,
  availableOf,
  importReasonLabel,
  parseInventoryCsv,
  stockToneOf,
  type ParsedImportRow,
  type ParseError,
} from '@/lib/inventory';
import { listingStatusMeta, formatPaise } from '@/lib/status';
import type {
  Category,
  InventoryAdjustment,
  InventoryImportPlanEntry,
  InventoryImportResult,
  InventoryImportSummary,
  InventoryRow,
  ListingStatus,
  Variant,
} from '@/lib/types';

type InventoryPage = {
  rows: InventoryRow[];
  total: number;
  page: number;
  pageSize: number;
  lowStockThreshold: number;
};

type Reservation = {
  id: string;
  qty: number;
  ownerKind: string;
  ownerId: string;
  reservedAt: string;
  expiresAt: string | null;
};
import { cn } from '@/lib/cn';
import { Page, PageHeader, SectionHeading } from '@/components/ui/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type StatusFilter = ListingStatus | 'all';
type FlagFilter = 'all' | 'low' | 'out' | 'oversold' | 'in_stock';

const STATUS_OPTIONS: ReadonlyArray<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'draft', label: 'Draft' },
  { value: 'retired', label: 'Retired' },
  { value: 'taken_down', label: 'Taken down' },
];

export default function RetailerInventory() {
  // Filters live in the URL so refresh / share / back-button retains state.
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') ?? '';
  const status = (searchParams.get('status') ?? 'all') as StatusFilter;
  const flag = (searchParams.get('flag') ?? 'all') as FlagFilter;
  const categoryId = searchParams.get('categoryId') ?? '';
  // Optional product scope: when set (e.g. via the dashboard low-stock chip
  // or the listing detail cross-link), the visible rows are filtered to that
  // listing's variants only.
  const productIdFilter = searchParams.get('productId') ?? '';

  /**
   * A stale `page=N` carried over from a previous URL can land on an empty
   * page after a productId filter narrows results to one product. Drop the
   * page param as soon as the productId filter is active, so the filtered
   * view always starts from the top.
   */
  useEffect(() => {
    if (!productIdFilter) return;
    if (!searchParams.get('page')) return;
    const sp = new URLSearchParams(searchParams);
    sp.delete('page');
    setSearchParams(sp, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productIdFilter]);
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const pageSize = 50;

  function patchParams(next: Record<string, string | null>) {
    const sp = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(next)) {
      if (v === null || v === '' || v === 'all') sp.delete(k);
      else sp.set(k, v);
    }
    // Any filter change resets pagination (otherwise page 7 with a narrow filter shows empty).
    if (!('page' in next)) sp.delete('page');
    setSearchParams(sp, { replace: true });
  }
  // Local debounce buffer for the search input so typing doesn't fire a request
  // every keystroke. Push into URL after the user pauses.
  const [qDraft, setQDraft] = useState(q);
  useEffect(() => { setQDraft(q); }, [q]);
  useEffect(() => {
    const t = setTimeout(() => {
      if (qDraft !== q) patchParams({ q: qDraft });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qDraft]);

  const [importOpen, setImportOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const qc = useQueryClient();

  const bulkToggleActive = useMutation({
    mutationFn: ({ ids, isActive }: { ids: string[]; isActive: boolean }) =>
      Promise.all(ids.map((id) => api(`/retailer/variants/${id}`, { method: 'PATCH', body: { isActive } }))),
    onSuccess: (_, { isActive }) => {
      void qc.invalidateQueries({ queryKey: ['retailer', 'inventory'] });
      setSelected(new Set());
      toast.success(isActive ? 'Variants activated' : 'Variants deactivated');
    },
    onError: () => toast.error('Failed to update variants'),
  });

  // Category list for the filter dropdown — cached separately so the table query
  // doesn't refetch when we change pages.
  const categoriesQ = useQuery({
    queryKey: ['retailer', 'categories'],
    queryFn: () => api<Category[]>('/retailer/categories'),
  });

  const inventory = useQuery({
    queryKey: ['retailer', 'inventory', { q, status, flag, categoryId, page, pageSize }],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (q.trim()) params.set('q', q.trim());
      if (status !== 'all') params.set('status', status);
      if (flag !== 'all') params.set('flag', flag);
      if (categoryId) params.set('categoryId', categoryId);
      return api<InventoryPage>(`/retailer/inventory?${params}`);
    },
  });

  const rawRows = inventory.data?.rows ?? [];
  const all = productIdFilter
    ? rawRows.filter((r) => r.listingId === productIdFilter)
    : rawRows;
  const productFilterName = productIdFilter
    ? rawRows.find((r) => r.listingId === productIdFilter)?.listingName ?? null
    : null;
  const total = productIdFilter ? all.length : inventory.data?.total ?? 0;
  const threshold = inventory.data?.lowStockThreshold ?? LOW_STOCK_THRESHOLD;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Page-scoped aggregate stats — useful for the visible table but does NOT
  // reflect the full catalog. (For full-catalog tiles use the dedicated /reports
  // endpoint; out of scope for this page.)
  const stats = useMemo(() => {
    let totalVariants = total;
    let totalStock = 0;
    let lowCount = 0;
    let outCount = 0;
    for (const r of all) {
      totalStock += r.stock;
      const tone = stockToneOf(r);
      if (tone === 'out') outCount += 1;
      else if (tone === 'low') lowCount += 1;
    }
    return { totalVariants, totalStock, lowCount, outCount };
  }, [all, total]);

  return (
    <Page>
      <PageHeader
        title="Inventory"
        description={
          <>
            Stock counts across every variant in your catalog. Edit inline, or upload a
            CSV to update many SKUs at once.
          </>
        }
        actions={
          <div className="flex items-center gap-2">
            <ExportPopover filters={{ q, status, flag, categoryId }} />

            <Button
              variant="ink"
              caps
              size="sm"
              iconLeft={<Upload className="size-3.5" />}
              onClick={() => setImportOpen(true)}
            >
              Import
            </Button>
          </div>
        }
      />

      {productIdFilter && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-line bg-bg-2 px-3 py-2 text-[12.5px]">
          <span className="text-ink-3">Filtered to product:</span>
          <span className="text-ink font-medium">{productFilterName ?? productIdFilter}</span>
          <button
            type="button"
            onClick={() => patchParams({ productId: null })}
            className="ml-auto text-ink-3 hover:text-ink underline"
          >
            Clear
          </button>
        </div>
      )}

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="health">Health</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">

      {/* Stat tiles. Fixed-grid so the four numbers stay aligned regardless of
          width — a quick scan of the row tells the operator the state of the catalog
          before they even touch the table. */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Variants" value={stats.totalVariants} />
        <StatTile label="Units on hand" value={stats.totalStock} />
        <StatTile label="Low stock" value={stats.lowCount} tone={stats.lowCount > 0 ? 'warning' : 'neutral'} />
        <StatTile label="Out of stock" value={stats.outCount} tone={stats.outCount > 0 ? 'danger' : 'neutral'} />
      </div>

      {/* Filter row */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <Input
            placeholder="Search SKU, product, brand…"
            value={qDraft}
            onChange={(e) => setQDraft(e.target.value)}
            className="!pl-8"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <FlagPill label="All" value="all" current={flag} onSelect={(v) => patchParams({ flag: v })} count={total} />
          <FlagPill
            label="Low"
            value="low"
            current={flag}
            onSelect={(v) => patchParams({ flag: v })}
            count={stats.lowCount}
            tone="warning"
          />
          <FlagPill
            label="Out"
            value="out"
            current={flag}
            onSelect={(v) => patchParams({ flag: v })}
            count={stats.outCount}
            tone="danger"
          />
          <FlagPill
            label="Oversold"
            value="oversold"
            current={flag}
            onSelect={(v) => patchParams({ flag: v })}
            count={0}
            tone="danger"
          />
          <Select value={categoryId || '__all__'} onValueChange={(v) => patchParams({ categoryId: v === '__all__' ? null : v })}>
            <SelectTrigger className="sm:w-40"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All categories</SelectItem>
              {(categoriesQ.data ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => patchParams({ status: v })}>
            <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {inventory.isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12" />)}
        </div>
      ) : inventory.isError ? (
        <Empty
          kicker="Connection lost"
          title="Couldn't load inventory."
          description={inventory.error instanceof ApiError ? inventory.error.message : 'Try again.'}
          action={<Button variant="outline" onClick={() => inventory.refetch()}>Retry</Button>}
        />
      ) : all.length === 0 ? (
        <Empty
          kicker={total === 0 && !q && status === 'all' && flag === 'all' && !categoryId ? 'No variants yet' : 'No matches'}
          title={
            total === 0 && !q && status === 'all' && flag === 'all' && !categoryId
              ? 'Add a product with at least one variant to start tracking stock.'
              : 'Nothing matches your filters.'
          }
          description={
            total === 0 && !q && status === 'all' && flag === 'all' && !categoryId
              ? undefined
              : 'Try a different keyword or clear the filters.'
          }
          action={
            total === 0 && !q && status === 'all' && flag === 'all' && !categoryId ? (
              <Button variant="ink" caps asChild>
                <Link to="/retailer/listings">Go to products</Link>
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => setSearchParams({}, { replace: true })}
              >
                Clear filters
              </Button>
            )
          }
        />
      ) : (
        <>
          {selected.size > 0 && (
            <div className="mb-3 flex items-center gap-2 rounded-md border border-line bg-bg-2/60 px-3 py-2">
              <span className="flex-1 text-[12.5px] text-ink-2">{selected.size} selected</span>
              <Button
                size="sm"
                variant="outline"
                iconLeft={<Power className="size-3.5" />}
                loading={bulkToggleActive.isPending}
                onClick={() => bulkToggleActive.mutate({ ids: [...selected], isActive: true })}
              >
                Activate
              </Button>
              <Button
                size="sm"
                variant="outline"
                iconLeft={<Power className="size-3.5" />}
                loading={bulkToggleActive.isPending}
                onClick={() => bulkToggleActive.mutate({ ids: [...selected], isActive: false })}
              >
                Deactivate
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
            </div>
          )}
          <InventoryTable
            rows={all}
            threshold={threshold}
            selected={selected}
            onSelectChange={setSelected}
          />
          {/*
           * Hide pagination while a productId filter is active. The filter
           * narrows to one product's variants (always a handful) so a page
           * control is misleading — `total` is already `all.length` above.
           */}
          {!productIdFilter && (
            <Pagination
              page={page}
              totalPages={totalPages}
              total={total}
              pageSize={pageSize}
              onPage={(p) => patchParams({ page: p === 1 ? null : String(p) })}
            />
          )}
        </>
      )}

        </TabsContent>

        <TabsContent value="health">
          <HealthTab rows={all} savedThreshold={threshold} />
        </TabsContent>

        <TabsContent value="history">
          <HistoryTab />
        </TabsContent>
      </Tabs>

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => inventory.refetch()}
      />
    </Page>
  );
}

type BestSellerRow = { variantId: string; listingName: string; attributesLabel: string; sku: string | null; stock: number; unitsSold: number };

function HealthTab({ rows, savedThreshold }: { rows: InventoryRow[]; savedThreshold: number }) {
  const qc = useQueryClient();
  const [threshold, setThreshold] = useState(savedThreshold);
  useEffect(() => { setThreshold(savedThreshold); }, [savedThreshold]);

  const save = useMutation({
    mutationFn: (n: number) =>
      api<{ lowStockThreshold: number }>('/retailer/inventory/settings', {
        method: 'PATCH',
        body: { lowStockThreshold: n },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['retailer', 'inventory'] });
      toast.success(`Low-stock threshold saved · ${threshold} units`);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Save failed'),
  });

  const lowStock = rows.filter((r) => r.stock > 0 && r.stock <= threshold);
  const outOfStock = rows.filter((r) => r.stock === 0);
  const oversold = rows.filter((r) => r.reserved > r.stock);

  const bestSellersQ = useQuery({
    queryKey: ['retailer', 'inventory', 'best-sellers'],
    queryFn: () => api<BestSellerRow[]>('/retailer/inventory/reports/inventory-health/best-sellers?days=30&limit=10'),
  });

  // Dead stock: items with stock > 0 and no sales in last 30 days
  const sellerIds = new Set((bestSellersQ.data ?? []).map((b) => b.variantId));
  const deadStock = rows.filter((r) => r.stock > 0 && !sellerIds.has(r.id)).slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionHeading title="Inventory health" />
        <Button
          variant="outline"
          size="sm"
          iconLeft={<Download className="size-3.5" />}
          onClick={() => downloadInventoryCsv({ flag: 'low' })}
        >
          Export low-stock CSV
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <HealthStat label="Low stock" count={lowStock.length} tone="warning" />
        <HealthStat label="Out of stock" count={outOfStock.length} tone="danger" />
        <HealthStat label="Oversold" count={oversold.length} tone="danger" />
        <HealthStat label="Dead stock" count={deadStock.length} tone="neutral" />
      </div>

      <div className="flex items-center gap-2 text-[12.5px] text-ink-3">
        <span>Low-stock threshold:</span>
        <Input
          type="number"
          min={1}
          max={50}
          value={threshold}
          onChange={(e) => setThreshold(Number(e.target.value) || 5)}
          className="w-20 text-[12.5px]"
        />
        <span>units</span>
        {threshold !== savedThreshold && (
          <Button size="sm" variant="ink" caps loading={save.isPending} onClick={() => save.mutate(threshold)}>
            Save
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-line bg-bg">
          <div className="border-b border-line px-4 py-3 text-[13.5px] font-semibold text-ink">
            Best sellers (last 30 days)
          </div>
          {bestSellersQ.isLoading ? (
            <Skeleton className="h-32 m-4" />
          ) : (bestSellersQ.data ?? []).length === 0 ? (
            <div className="p-4 text-[12.5px] text-ink-3 italic">No sales data yet.</div>
          ) : (
            <ul className="divide-y divide-line">
              {(bestSellersQ.data ?? []).map((it) => (
                <li key={it.variantId} className="px-4 py-2.5">
                  <div className="text-[13px] text-ink">{it.listingName}</div>
                  <div className="text-[11.5px] text-ink-3">
                    {it.attributesLabel} · {it.unitsSold} sold · {it.stock} in stock
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <HealthCard title="Dead stock (no sales in 30 days)" items={deadStock.map((r) => ({ key: r.id, primary: r.listingName, secondary: `${r.attributesLabel} · ${r.stock} units` }))} />
      </div>
    </div>
  );
}

function HealthStat({ label, count, tone }: { label: string; count: number; tone: 'neutral' | 'warning' | 'danger' }) {
  const toneCls = tone === 'warning' ? 'text-warning' : tone === 'danger' ? 'text-danger' : 'text-ink';
  return (
    <div className="rounded-lg border border-line bg-bg p-4">
      <div className="kicker mb-1.5">{label}</div>
      <div className={`text-[26px] font-semibold leading-none ${toneCls}`}>{count}</div>
    </div>
  );
}

function HealthCard({ title, items }: { title: string; items: Array<{ key: string; primary: string; secondary: string }> }) {
  return (
    <div className="rounded-lg border border-line bg-bg">
      <div className="border-b border-line px-4 py-3 text-[13.5px] font-semibold text-ink">{title}</div>
      {items.length === 0 ? (
        <div className="p-4 text-[12.5px] text-ink-3 italic">Nothing to surface.</div>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((it) => (
            <li key={it.key} className="px-4 py-2.5">
              <div className="text-[13px] text-ink">{it.primary}</div>
              <div className="text-[11.5px] text-ink-3">{it.secondary}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function HistoryTab() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const params = new URLSearchParams({ limit: '200' });
  if (from) params.set('from', new Date(from).toISOString());
  if (to) params.set('to', new Date(to + 'T23:59:59').toISOString());

  const { data, isLoading } = useQuery({
    queryKey: ['retailer', 'inventory', 'adjustments', from, to],
    queryFn: () => api<InventoryAdjustment[]>(`/retailer/inventory/adjustments?${params}`),
  });
  const rows = data ?? [];

  function actorLabel(r: InventoryAdjustment) {
    if (r.actorKind === 'system') return 'System';
    if (r.actorKind === 'admin') return 'Admin';
    return 'Retailer';
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <SectionHeading title="Adjustment history" />
        <div className="flex items-center gap-2 ml-auto">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-36 text-[12.5px]" placeholder="From" />
          <span className="text-[12.5px] text-ink-3">to</span>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-36 text-[12.5px]" placeholder="To" />
          {(from || to) && (
            <Button variant="ghost" size="sm" onClick={() => { setFrom(''); setTo(''); }}>Clear</Button>
          )}
        </div>
      </div>
      {isLoading ? (
        <Skeleton className="h-40" />
      ) : rows.length === 0 ? (
        <Empty kicker="No history" title="No stock adjustments recorded yet." />
      ) : (
        <ol className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="flex items-start gap-3 rounded-md border border-line bg-bg-2/30 px-3 py-2.5">
              <span
                className={cn(
                  'font-mono text-sm font-semibold shrink-0 w-14 text-right',
                  r.delta > 0 ? 'text-success' : 'text-danger',
                )}
              >
                {r.delta > 0 ? `+${r.delta}` : r.delta}
              </span>
              <div className="min-w-0 flex-1 text-[12.5px] text-ink">
                <span className="font-medium">{r.reason.replace(/_/g, ' ')}</span>
                {r.note && <span className="ml-1 text-ink-3"> — {r.note}</span>}
                <div className="text-ink-4 mt-0.5 font-mono">
                  sku·{r.variantId.slice(-6)} → {r.newStock} in stock · {actorLabel(r)}
                </div>
              </div>
              <span className="text-[11.5px] text-ink-4 shrink-0">{new Date(r.at).toLocaleDateString()}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Stat tile
// ─────────────────────────────────────────────────────────────────────

function StatTile({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  tone?: 'neutral' | 'warning' | 'danger';
}) {
  return (
    <div className="surface-card px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="kicker text-ink-3">{label}</div>
        {tone === 'warning' && <span className="size-1.5 rounded-full bg-warning" aria-hidden />}
        {tone === 'danger' && <span className="size-1.5 rounded-full bg-danger pulse-dot" aria-hidden />}
      </div>
      <div
        className={cn(
          'mt-1 font-mono tabular text-[22px] leading-tight',
          tone === 'warning' ? 'text-warning' : tone === 'danger' ? 'text-danger' : 'text-ink',
        )}
      >
        {value.toLocaleString()}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Flag pill (All / Low / Out)
// ─────────────────────────────────────────────────────────────────────

function FlagPill({
  label,
  value,
  current,
  onSelect,
  count,
  tone = 'neutral',
}: {
  label: string;
  value: FlagFilter;
  current: FlagFilter;
  onSelect: (v: FlagFilter) => void;
  count: number;
  tone?: 'neutral' | 'warning' | 'danger';
}) {
  const active = current === value;
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] transition-colors press',
        active
          ? 'border-accent bg-accent text-accent-fg'
          : 'border-line bg-bg text-ink-2 hover:border-line-2 hover:text-ink',
      )}
    >
      {tone === 'warning' && !active && <span className="size-1.5 rounded-full bg-warning" />}
      {tone === 'danger' && !active && <span className="size-1.5 rounded-full bg-danger" />}
      {label}
      {count > 0 && (
        <span
          className={cn(
            'rounded-full px-1.5 py-0.5 font-mono text-[10.5px]',
            active ? 'bg-accent-fg/20 text-accent-fg' : 'bg-bg-3 text-ink-2',
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Table — row-tone via left rule, inline stock edit per row
// ─────────────────────────────────────────────────────────────────────

function InventoryTable({
  rows,
  threshold,
  selected,
  onSelectChange,
}: {
  rows: InventoryRow[];
  threshold: number;
  selected: Set<string>;
  onSelectChange: (s: Set<string>) => void;
}) {
  const allIds = rows.map((r) => r.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));

  function toggleAll() {
    if (allSelected) {
      onSelectChange(new Set());
    } else {
      onSelectChange(new Set(allIds));
    }
  }

  function toggleRow(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    onSelectChange(next);
  }

  return (
    <div className="surface-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[13.5px]">
          <thead className="bg-bg-2/70 sticky top-0 z-10 backdrop-blur">
            <tr className="border-b border-line">
              <Th className="w-[3%]">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="size-3.5 accent-ink cursor-pointer"
                />
              </Th>
              <Th className="w-[25%]">Product</Th>
              <Th className="w-[16%]">Variant</Th>
              <Th className="w-[11%]">SKU</Th>
              <Th className="w-[9%] text-right">Price</Th>
              <Th className="w-[9%] text-right">Stock</Th>
              <Th className="w-[7%] text-right">Reserved</Th>
              <Th className="w-[7%] text-right">Available</Th>
              <Th className="w-[6%] text-right">Status</Th>
              <Th className="w-[7%] text-right" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <InventoryRowEl
                key={r.id}
                row={r}
                threshold={threshold}
                checked={selected.has(r.id)}
                onCheck={() => toggleRow(r.id)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InventoryRowEl({ row, threshold, checked, onCheck }: { row: InventoryRow; threshold: number; checked: boolean; onCheck: () => void }) {
  const qc = useQueryClient();
  const tone = stockToneOf(row, threshold);
  const meta = listingStatusMeta(row.listingStatus);
  const available = availableOf(row);

  const toggleActive = useMutation({
    mutationFn: (isActive: boolean) =>
      api(`/retailer/variants/${row.id}`, { method: 'PATCH', body: { isActive } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['retailer', 'inventory'] });
      void qc.invalidateQueries({ queryKey: ['retailer', 'listing', row.listingId] });
    },
    onError: () => toast.error('Failed to update variant'),
  });

  return (
    <tr
      className={cn(
        'group hover:bg-bg-2/60 transition-colors',
        !row.isActive && 'opacity-50',
        tone === 'low' && 'border-l-2 border-l-warning',
        tone === 'out' && 'border-l-2 border-l-danger',
      )}
    >
      <Td>
        <input
          type="checkbox"
          checked={checked}
          onChange={onCheck}
          className="size-3.5 accent-ink cursor-pointer"
        />
      </Td>
      <Td>
        <Link
          to={`/retailer/listings/${row.listingId}`}
          className="group/link block truncate"
        >
          <span className="font-medium text-ink group-hover/link:underline underline-offset-2">
            {row.listingName}
          </span>
          <span className="ml-1.5 text-ink-3 transition-opacity opacity-0 group-hover/link:opacity-100">
            <ArrowUpRight className="inline size-3" />
          </span>
          {row.brandName && (
            <span className="block truncate text-[11.5px] text-ink-3">{row.brandName}</span>
          )}
        </Link>
      </Td>
      <Td>
        <span className="text-ink-2">{row.attributesLabel}</span>
      </Td>
      <Td className="font-mono text-[12.5px] text-ink-2">
        {row.sku ?? <span className="text-ink-4">—</span>}
      </Td>
      <Td className="text-right font-mono tabular">
        {formatPaise(row.pricePaise)}
      </Td>
      <Td className="text-right">
        <StockEditor row={row} />
      </Td>
      <Td className="text-right font-mono tabular text-ink-3">
        <ReservedCell variantId={row.id} reserved={row.reserved} />
      </Td>
      <Td className="text-right font-mono tabular">
        <span
          className={cn(
            tone === 'out' && 'text-danger font-semibold',
            tone === 'low' && 'text-warning font-semibold',
            tone === 'ok' && 'text-ink',
          )}
        >
          {available}
        </span>
      </Td>
      <Td className="text-right">
        <Badge tone={meta.tone} nodot>{meta.label}</Badge>
      </Td>
      <Td className="text-right">
        <Button
          size="sm"
          variant="ghost"
          title={row.isActive ? 'Deactivate variant' : 'Activate variant'}
          loading={toggleActive.isPending}
          onClick={() => toggleActive.mutate(!row.isActive)}
          className={row.isActive ? 'text-ink-3 hover:text-danger' : 'text-ink-3 hover:text-success'}
        >
          <Power className="size-3.5" />
        </Button>
      </Td>
    </tr>
  );
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={cn('kicker text-ink-3 px-3 py-2.5 text-left', className)}>
      {children}
    </th>
  );
}

function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn('px-3 py-3 align-middle', className)}>{children}</td>;
}

// ─────────────────────────────────────────────────────────────────────
// Inline stock editor — click-to-edit cell
// ─────────────────────────────────────────────────────────────────────

function StockEditor({ row }: { row: InventoryRow }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(row.stock));
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Re-sync the draft if the source value changes from elsewhere (e.g. CSV import).
  useEffect(() => {
    if (!editing) setDraft(String(row.stock));
  }, [row.stock, editing]);

  // US-6.2.2: click outside the editor cancels without saving. Mouse-/touch-down so
  // it fires before the browser's blur+rerender; capture phase so we beat any inner
  // stopPropagation. Skipped when the save mutation is mid-flight to avoid losing
  // the in-flight commit if the user clicks elsewhere on the page.
  useEffect(() => {
    if (!editing) return;
    function handlePointerDown(e: PointerEvent) {
      if (save.isPending) return;
      const target = e.target as Node | null;
      if (wrapperRef.current && target && !wrapperRef.current.contains(target)) {
        setDraft(String(row.stock));
        setEditing(false);
      }
    }
    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, row.stock]);

  const save = useMutation({
    mutationFn: (next: number) =>
      api<Variant>(`/retailer/variants/${row.id}`, {
        method: 'PATCH',
        body: { stock: next },
      }),
    onSuccess: () => {
      setEditing(false);
      // Refresh both surfaces — the inventory list and any open listing detail.
      void qc.invalidateQueries({ queryKey: ['retailer', 'inventory'] });
      void qc.invalidateQueries({ queryKey: ['retailer', 'listing', row.listingId] });
      toast.success(`Stock saved · ${row.attributesLabel}`);
    },
    onError: (e) => {
      const code = e instanceof ApiError ? e.code : '';
      toast.error(
        code === 'invalid_state'
          ? (e instanceof ApiError && e.message) || 'Cannot lower below reserved'
          : e instanceof Error
            ? e.message
            : 'Could not save stock',
      );
      // Snap the draft back so the operator can correct.
      setDraft(String(row.stock));
      inputRef.current?.focus();
    },
  });

  function commit() {
    const n = Number(draft);
    if (!Number.isInteger(n) || n < 0) {
      toast.error('Stock must be a non-negative integer');
      setDraft(String(row.stock));
      return;
    }
    if (n === row.stock) {
      setEditing(false);
      return;
    }
    save.mutate(n);
  }

  function cancel() {
    setDraft(String(row.stock));
    setEditing(false);
  }

  if (!editing) {
    const tone = stockToneOf(row);
    return (
      <button
        type="button"
        onClick={() => {
          setEditing(true);
          // Focus on the next paint so the input is mounted.
          requestAnimationFrame(() => {
            inputRef.current?.focus();
            inputRef.current?.select();
          });
        }}
        className={cn(
          'inline-flex min-w-[3.5rem] items-center justify-end rounded-md px-2 py-1 font-mono tabular',
          'hover:bg-bg-3 hover:ring-1 hover:ring-line-2 transition-colors press',
          tone === 'out' && 'text-danger font-semibold',
          tone === 'low' && 'text-warning font-semibold',
          tone === 'ok' && 'text-ink',
        )}
        aria-label={`Edit stock for ${row.attributesLabel}`}
      >
        {row.stock}
      </button>
    );
  }

  return (
    <div ref={wrapperRef} className="inline-flex items-center gap-1">
      <input
        ref={inputRef}
        type="number"
        min={0}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') cancel();
        }}
        disabled={save.isPending}
        className={cn(
          'h-8 w-20 rounded-md border border-line-2 bg-bg px-2 text-right font-mono tabular text-[13.5px] text-ink',
          'focus:border-ink focus:outline-none',
        )}
      />
      <button
        type="button"
        onClick={commit}
        disabled={save.isPending}
        className="grid size-7 place-items-center rounded-md bg-ink text-bg hover:bg-ink-2 press disabled:opacity-50"
        aria-label="Save stock"
      >
        <Check className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={cancel}
        disabled={save.isPending}
        className="grid size-7 place-items-center rounded-md border border-line text-ink-3 hover:bg-bg-3 press disabled:opacity-50"
        aria-label="Cancel edit"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// CSV import dialog — parse client-side, preview, then submit JSON.
// ─────────────────────────────────────────────────────────────────────

type DryRunResult = Extract<InventoryImportResult, { dryRun: true }>;
type ApplyResult = Extract<InventoryImportResult, { dryRun: false }>;

type ImportStage =
  | { kind: 'idle' }
  | { kind: 'parsed'; rows: ParsedImportRow[]; parseErrors: ParseError[]; skipped: number; fileName: string }
  | {
      kind: 'previewed';
      rows: ParsedImportRow[];
      parseErrors: ParseError[];
      skipped: number;
      fileName: string;
      dryRun: DryRunResult;
    }
  | { kind: 'done'; result: ApplyResult };

function escapeCsv(value: string | number | null | undefined): string {
  const v = value == null ? '' : String(value);
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function downloadCsv(filename: string, content: string) {
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 1000);
}

function downloadErrorReport(errors: Array<{ row: number; sku?: string; reason?: string; message?: string }>) {
  const header = 'row,sku,reason';
  const lines = errors.map((e) =>
    [escapeCsv(e.row), escapeCsv(e.sku ?? ''), escapeCsv(e.reason ?? e.message ?? '')].join(','),
  );
  downloadCsv(`inventory-import-errors-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...lines].join('\n'));
}

async function downloadInventoryTemplate() {
  try {
    const token = getToken();
    const res = await fetch(`${BASE}/retailer/inventory/template`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`Template fetch failed (${res.status})`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'inventory-template.csv';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 1000);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Template download failed');
  }
}

function ImportDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onImported: () => void;
}) {
  const [stage, setStage] = useState<ImportStage>({ kind: 'idle' });
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset whenever the dialog closes — never carry stale rows into a fresh attempt.
  useEffect(() => {
    if (!open) setStage({ kind: 'idle' });
  }, [open]);

  const dryRun = useMutation({
    mutationFn: (rows: ParsedImportRow[]) =>
      api<DryRunResult>('/retailer/inventory/import', {
        method: 'POST',
        body: { rows, dryRun: true },
      }),
    onSuccess: (result) => {
      setStage((s) =>
        s.kind === 'parsed'
          ? { kind: 'previewed', rows: s.rows, parseErrors: s.parseErrors, skipped: s.skipped, fileName: s.fileName, dryRun: result }
          : s,
      );
      const errs = result.errors ?? [];
      if (errs.length > 0) {
        toast.error(`${errs.length} row${errs.length === 1 ? '' : 's'} would fail`);
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Dry run failed'),
  });

  const submit = useMutation({
    mutationFn: (rows: ParsedImportRow[]) =>
      api<ApplyResult>('/retailer/inventory/import', {
        method: 'POST',
        body: { rows },
      }),
    onSuccess: (result) => {
      setStage({ kind: 'done', result });
      const a = result.applied;
      const total = a.stockUpdates + a.variantCreates + a.listingCreates;
      if (total > 0) {
        const parts: string[] = [];
        if (a.stockUpdates) parts.push(`${a.stockUpdates} stock update${a.stockUpdates === 1 ? '' : 's'}`);
        if (a.variantCreates) parts.push(`${a.variantCreates} new variant${a.variantCreates === 1 ? '' : 's'}`);
        if (a.listingCreates) parts.push(`${a.listingCreates} new listing${a.listingCreates === 1 ? '' : 's'}`);
        if (a.priceUpdates) parts.push(`${a.priceUpdates} price update${a.priceUpdates === 1 ? '' : 's'}`);
        toast.success(`Imported · ${parts.join(' · ')}`);
        onImported();
      } else {
        toast.success('Nothing to change — file matched current state');
      }
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : 'Import failed');
    },
  });

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      const parsed = parseInventoryCsv(text);
      setStage({
        kind: 'parsed',
        rows: parsed.rows,
        parseErrors: parsed.errors,
        skipped: parsed.skipped,
        fileName: file.name,
      });
    };
    reader.onerror = () => toast.error("Couldn't read that file");
    reader.readAsText(file);
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import stock from CSV</DialogTitle>
          <DialogDescription>
            Header row needs <code className="font-mono text-ink-2">sku</code> and{' '}
            <code className="font-mono text-ink-2">stock</code>. When a row's SKU is blank,
            we'll fall back to matching by{' '}
            <code className="font-mono text-ink-2">product_name</code> +{' '}
            <code className="font-mono text-ink-2">variant_label</code>. Unmatched or
            ambiguous rows are reported, never silently dropped.
          </DialogDescription>
        </DialogHeader>

        {stage.kind === 'idle' && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              'flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 text-center transition-colors',
              dragging
                ? 'border-ink bg-bg-2'
                : 'border-line bg-bg-2/40 hover:border-line-2',
            )}
          >
            <Upload className="size-7 text-ink-3" />
            <p className="mt-3 text-[13.5px] text-ink-2">
              Drop a CSV here, or pick a file.
            </p>
            <p className="mt-1 text-[11.5px] text-ink-3">
              Up to 5,000 rows. Empty lines are skipped.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => fileInputRef.current?.click()}
            >
              Choose file…
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                // Reset so picking the same file twice still re-fires onChange.
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => void downloadInventoryTemplate()}
              className="mt-3 inline-flex items-center gap-1 text-[11.5px] uppercase tracking-[0.12em] text-ink-3 hover:text-ink"
            >
              <Download className="size-3" />
              Need the template?
            </button>
          </div>
        )}

        {(stage.kind === 'parsed' || stage.kind === 'previewed') && (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-line bg-bg-2/60 px-3 py-2 text-[13px]">
              <div className="min-w-0 truncate">
                <span className="kicker mr-2">File</span>
                <span className="font-mono text-ink">{stage.fileName}</span>
              </div>
              <button
                type="button"
                onClick={() => setStage({ kind: 'idle' })}
                className="text-[12px] text-ink-3 hover:text-ink"
              >
                Replace
              </button>
            </div>

            {(() => {
              const sum: InventoryImportSummary | null =
                stage.kind === 'previewed' ? stage.dryRun.summary : null;
              const serverErrors = stage.kind === 'previewed' ? (stage.dryRun.errors ?? []).length : null;
              const previewed = stage.kind === 'previewed';
              return (
                <div
                  className={cn(
                    'grid gap-2 text-[12.5px]',
                    previewed ? 'grid-cols-3 sm:grid-cols-6' : 'grid-cols-2',
                  )}
                >
                  <Tile label="Parsed" value={stage.rows.length} />
                  <Tile
                    label="Parse errors"
                    value={stage.parseErrors.length}
                    tone={stage.parseErrors.length > 0 ? 'warning' : undefined}
                  />
                  {previewed && (
                    <>
                      <Tile
                        label="Server errors"
                        value={serverErrors ?? 0}
                        tone={(serverErrors ?? 0) > 0 ? 'danger' : 'success'}
                      />
                      <Tile
                        label="Stock updates"
                        value={sum ? sum.stockUpdates : 0}
                        tone={sum && sum.stockUpdates > 0 ? 'success' : undefined}
                      />
                      <Tile
                        label="New variants"
                        value={sum ? sum.variantCreates : 0}
                        tone={sum && sum.variantCreates > 0 ? 'info' : undefined}
                      />
                      <Tile
                        label="New listings"
                        value={sum ? sum.listingCreates : 0}
                        tone={sum && sum.listingCreates > 0 ? 'info' : undefined}
                      />
                    </>
                  )}
                </div>
              );
            })()}

            {stage.skipped > 0 && (
              <div className="rounded-lg border border-line bg-bg-2/40 px-3 py-2 text-[12px] text-ink-3">
                {stage.skipped} row{stage.skipped === 1 ? '' : 's'} skipped — neither a SKU nor a
                product&nbsp;name + variant&nbsp;label pair was present. Add a SKU column, or keep
                both <code className="font-mono text-ink-2">product_name</code> and
                {' '}<code className="font-mono text-ink-2">variant_label</code> populated so the row
                can be matched.
              </div>
            )}

            {stage.kind === 'parsed' && stage.rows.length === 0 && stage.parseErrors.length === 0 && (
              <div className="rounded-lg border border-warning/30 bg-warning-soft/40 px-3 py-2 text-[12.5px] text-warning">
                Nothing to import — every row in this file is missing both a SKU and a
                product&nbsp;name + variant&nbsp;label pair{stage.skipped > 0 ? ` (${stage.skipped} skipped)` : ''}.
              </div>
            )}

            {stage.parseErrors.length > 0 && (
              <ParseErrorList errors={stage.parseErrors} />
            )}

            {stage.kind === 'previewed' && (stage.dryRun.errors ?? []).length > 0 && (
              <div className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-[12.5px] font-medium text-danger">
                    <FileWarning className="size-3.5" />
                    {(stage.dryRun.errors ?? []).length} server-side error
                    {(stage.dryRun.errors ?? []).length === 1 ? '' : 's'} — fix and re-upload
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    iconLeft={<Download className="size-3" />}
                    onClick={() => downloadErrorReport(stage.dryRun.errors ?? [])}
                  >
                    Download errors
                  </Button>
                </div>
                <ul className="mt-2 max-h-32 overflow-y-auto space-y-0.5 text-[12px] text-ink-2">
                  {(stage.dryRun.errors ?? []).slice(0, 50).map((e, i) => (
                    <li key={i} className="font-mono">
                      <span className="text-ink-3">row {e.row}:</span> {e.sku}{' · '}
                      <span className="text-ink">{importReasonLabel(e.reason)}</span>
                    </li>
                  ))}
                  {(stage.dryRun.errors ?? []).length > 50 && (
                    <li className="text-ink-3 italic">
                      …and {(stage.dryRun.errors ?? []).length - 50} more
                    </li>
                  )}
                </ul>
              </div>
            )}

            {stage.kind === 'previewed' && stage.dryRun.plan.length > 0 && (
              <DryRunPreviewTable plan={stage.dryRun.plan} />
            )}
          </div>
        )}

        {stage.kind === 'done' && <ImportSummary result={stage.result} />}

        <DialogFooter>
          {stage.kind === 'parsed' && (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                variant="ink"
                caps
                disabled={stage.rows.length === 0 || stage.parseErrors.length > 0}
                loading={dryRun.isPending}
                onClick={() => dryRun.mutate(stage.rows)}
              >
                Run dry-run preview
              </Button>
            </>
          )}
          {stage.kind === 'previewed' && (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={() => dryRun.mutate(stage.rows)}
                loading={dryRun.isPending}
              >
                Re-run preview
              </Button>
              {(() => {
                const sum = stage.dryRun.summary;
                const writes = sum.stockUpdates + sum.variantCreates + sum.listingCreates;
                const serverErrors = (stage.dryRun.errors ?? []).length;
                const parts: string[] = [];
                if (sum.stockUpdates) parts.push(`${sum.stockUpdates} update${sum.stockUpdates === 1 ? '' : 's'}`);
                if (sum.variantCreates) parts.push(`${sum.variantCreates} new variant${sum.variantCreates === 1 ? '' : 's'}`);
                if (sum.listingCreates) parts.push(`${sum.listingCreates} new listing${sum.listingCreates === 1 ? '' : 's'}`);
                return (
                  <Button
                    variant="ink"
                    caps
                    disabled={stage.parseErrors.length > 0 || serverErrors > 0 || writes === 0}
                    loading={submit.isPending}
                    onClick={() => submit.mutate(stage.rows)}
                    title={
                      serverErrors > 0
                        ? 'Fix server errors first — apply requires zero errors'
                        : writes === 0
                          ? 'Nothing to change — every row matches current state'
                          : undefined
                    }
                  >
                    {writes === 0 ? 'Nothing to apply' : `Apply (${parts.join(' · ')})`}
                  </Button>
                );
              })()}
            </>
          )}
          {stage.kind === 'done' && (
            <Button variant="ink" caps onClick={() => onOpenChange(false)}>
              Done
            </Button>
          )}
          {stage.kind === 'idle' && (
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ParseErrorList({ errors }: { errors: ParseError[] }) {
  return (
    <div className="rounded-lg border border-warning/30 bg-warning-soft px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[12.5px] font-medium text-warning">
          <FileWarning className="size-3.5" />
          {errors.length} parse error{errors.length === 1 ? '' : 's'}
        </div>
        <Button
          size="sm"
          variant="outline"
          iconLeft={<Download className="size-3" />}
          onClick={() => downloadErrorReport(errors.map((e) => ({ row: e.row, reason: e.message })))}
        >
          Download errors
        </Button>
      </div>
      <ul className="mt-2 max-h-32 overflow-y-auto space-y-0.5 text-[12px] text-ink-2">
        {errors.slice(0, 50).map((e, i) => (
          <li key={i} className="font-mono">
            <span className="text-ink-3">row {e.row}:</span> {e.message}
          </li>
        ))}
        {errors.length > 50 && (
          <li className="text-ink-3 italic">…and {errors.length - 50} more</li>
        )}
      </ul>
    </div>
  );
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: 'success' | 'warning' | 'danger' | 'info' | undefined;
}) {
  const toneClass =
    tone === 'success'
      ? 'border-success/30 bg-success-soft text-success-strong'
      : tone === 'warning'
        ? 'border-warning/30 bg-warning-soft text-warning'
        : tone === 'danger'
          ? 'border-danger/30 bg-danger/10 text-danger'
          : tone === 'info'
            ? 'border-line-2 bg-bg-2 text-ink'
            : 'border-line text-ink';
  return (
    <div className={cn('rounded-lg border px-3 py-2', toneClass)}>
      <div className="kicker">{label}</div>
      <div className="mt-1 font-mono tabular text-[20px]">{value}</div>
    </div>
  );
}

const ACTION_BADGE: Record<
  InventoryImportPlanEntry['action'],
  { label: string; cls: string }
> = {
  stock_update: { label: 'Stock', cls: 'border-success/30 bg-success-soft text-success-strong' },
  variant_create: { label: 'New variant', cls: 'border-line-2 bg-bg-2 text-ink' },
  listing_create: { label: 'New listing', cls: 'border-ink/30 bg-bg text-ink' },
  no_change: { label: 'No change', cls: 'border-line bg-bg text-ink-3' },
  error: { label: 'Error', cls: 'border-danger/30 bg-danger/10 text-danger' },
};

function DryRunPreviewTable({ plan }: { plan: InventoryImportPlanEntry[] }) {
  const writes = plan.filter((p) => p.action !== 'no_change' && p.action !== 'error');
  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <div className="border-b border-line bg-bg-2/60 px-3 py-2 text-[12.5px] font-medium text-ink-2">
        Plan · {writes.length} write{writes.length === 1 ? '' : 's'} ·{' '}
        {plan.length - writes.length} no-op
      </div>
      <div className="max-h-72 overflow-y-auto">
        <table className="w-full text-[12.5px]">
          <thead className="sticky top-0 bg-bg-2/80 backdrop-blur">
            <tr>
              <th className="kicker px-3 py-2 text-left text-ink-3">Row</th>
              <th className="kicker px-3 py-2 text-left text-ink-3">Action</th>
              <th className="kicker px-3 py-2 text-left text-ink-3">Identifier</th>
              <th className="kicker px-3 py-2 text-left text-ink-3">Target</th>
              <th className="kicker px-3 py-2 text-right text-ink-3">Δ / +</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {plan.slice(0, 200).map((p, i) => {
              const meta = ACTION_BADGE[p.action];
              return (
                <tr key={i} className="hover:bg-bg-2/40">
                  <td className="px-3 py-1.5 font-mono text-ink-3">{p.row}</td>
                  <td className="px-3 py-1.5">
                    <span
                      className={cn(
                        'inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium',
                        meta.cls,
                      )}
                    >
                      {meta.label}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 font-mono text-ink-2">{p.identifier || '—'}</td>
                  <td className="px-3 py-1.5 text-ink">
                    {p.stockUpdate && (
                      <>
                        <span className="font-mono text-ink-3">{p.stockUpdate.currentStock}</span>
                        <span className="mx-1 text-ink-4">→</span>
                        <span className="font-mono text-ink">{p.stockUpdate.newStock}</span>
                        {p.stockUpdate.newPricePaise !== undefined && (
                          <span className="ml-2 text-[11.5px] text-ink-3">
                            · price {formatPaise(p.stockUpdate.newPricePaise)}
                          </span>
                        )}
                      </>
                    )}
                    {p.variantCreate && (
                      <span>
                        <span className="text-ink-3">{p.variantCreate.listingName}</span>
                        {' · '}
                        <span className="text-ink">{p.variantCreate.attributesLabel}</span>
                      </span>
                    )}
                    {p.listingCreate && (
                      <span>
                        <span className="text-ink">{p.listingCreate.listingName}</span>
                        {' · '}
                        <span className="text-ink-3">
                          {p.listingCreate.brandSlug} / {p.listingCreate.categoryLabel} /{' '}
                          {p.listingCreate.gender}
                        </span>
                      </span>
                    )}
                    {p.error && (
                      <span className="text-danger">{importReasonLabel(p.error.reason)}</span>
                    )}
                  </td>
                  <td
                    className={cn(
                      'px-3 py-1.5 text-right font-mono tabular',
                      p.stockUpdate &&
                        (p.stockUpdate.delta > 0
                          ? 'text-success'
                          : p.stockUpdate.delta < 0
                            ? 'text-danger'
                            : 'text-ink-4'),
                      (p.variantCreate || p.listingCreate) && 'text-ink',
                    )}
                  >
                    {p.stockUpdate
                      ? p.stockUpdate.delta > 0
                        ? `+${p.stockUpdate.delta}`
                        : p.stockUpdate.delta
                      : p.variantCreate
                        ? `+${p.variantCreate.stock}`
                        : p.listingCreate
                          ? `+${p.listingCreate.variant.stock}`
                          : ''}
                  </td>
                </tr>
              );
            })}
            {plan.length > 200 && (
              <tr>
                <td colSpan={5} className="px-3 py-1.5 text-[11.5px] text-ink-4 italic">
                  …and {plan.length - 200} more
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ImportSummary({ result }: { result: ApplyResult }) {
  const a = result.applied;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile label="Stock updates" value={a.stockUpdates} tone={a.stockUpdates > 0 ? 'success' : undefined} />
        <Tile label="New variants" value={a.variantCreates} tone={a.variantCreates > 0 ? 'info' : undefined} />
        <Tile label="New listings" value={a.listingCreates} tone={a.listingCreates > 0 ? 'info' : undefined} />
        <Tile label="Price updates" value={a.priceUpdates} tone={a.priceUpdates > 0 ? 'success' : undefined} />
      </div>

      {result.createdListings.length > 0 && (
        <div className="rounded-lg border border-line bg-bg-2/60 px-3 py-2">
          <div className="kicker mb-1.5 text-ink-2">New draft listings</div>
          <ul className="space-y-0.5 text-[12.5px]">
            {result.createdListings.map((l) => (
              <li key={l.listingId} className="flex items-center justify-between">
                <span className="truncate text-ink">{l.name}</span>
                <Link
                  to={`/retailer/listings/${l.listingId}`}
                  className="inline-flex items-center gap-1 text-[11.5px] uppercase tracking-[0.12em] text-ink-3 hover:text-ink"
                >
                  Open <ArrowUpRight className="size-3" />
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11.5px] text-ink-3">
            New listings land as drafts — add a gallery before publishing.
          </p>
        </div>
      )}

      {result.createdVariants.length > 0 && (
        <div className="rounded-lg border border-line bg-bg-2/60 px-3 py-2">
          <div className="kicker mb-1.5 text-ink-2">New variants</div>
          <ul className="space-y-0.5 font-mono text-[12px] text-ink-2">
            {result.createdVariants.slice(0, 8).map((v) => (
              <li key={v.variantId}>
                <span className="text-ink-3">row {v.row}</span> · {v.sku ?? '—'}
              </li>
            ))}
            {result.createdVariants.length > 8 && (
              <li className="text-ink-4 italic">
                …and {result.createdVariants.length - 8} more
              </li>
            )}
          </ul>
        </div>
      )}

      <p className="text-[11.5px] text-ink-3">
        Threshold for "low" stays at {LOW_STOCK_THRESHOLD} units of available stock.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Export column-picker popover. Single Export entry point that lets the
// operator narrow the exported columns and choose filtered vs. all rows.
// Selection persists in localStorage so a tweaked column set sticks across
// sessions on the same browser.
// ─────────────────────────────────────────────────────────────────────

type ExportColumnKey =
  | 'sku'
  | 'product_name'
  | 'variant_label'
  | 'attributes'
  | 'brand'
  | 'category'
  | 'gender'
  | 'price_paise'
  | 'stock'
  | 'reserved'
  | 'status';

const EXPORT_COLUMNS: ReadonlyArray<{ key: ExportColumnKey; label: string }> = [
  { key: 'sku', label: 'sku' },
  { key: 'product_name', label: 'product_name' },
  { key: 'variant_label', label: 'variant_label' },
  { key: 'attributes', label: 'attributes' },
  { key: 'brand', label: 'brand' },
  { key: 'category', label: 'category' },
  { key: 'gender', label: 'gender' },
  { key: 'price_paise', label: 'price_paise' },
  { key: 'stock', label: 'stock' },
  { key: 'reserved', label: 'reserved' },
  { key: 'status', label: 'status' },
];

const EXPORT_COLS_LS_KEY = 'retailer.inventory.exportCols';
const DEFAULT_EXPORT_COLS: ExportColumnKey[] = EXPORT_COLUMNS.map((c) => c.key);

function readSavedCols(): ExportColumnKey[] {
  try {
    const raw = localStorage.getItem(EXPORT_COLS_LS_KEY);
    if (!raw) return DEFAULT_EXPORT_COLS;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return DEFAULT_EXPORT_COLS;
    const set = new Set(DEFAULT_EXPORT_COLS);
    const filtered = parsed.filter((k): k is ExportColumnKey => typeof k === 'string' && set.has(k as ExportColumnKey));
    return filtered.length > 0 ? filtered : DEFAULT_EXPORT_COLS;
  } catch {
    return DEFAULT_EXPORT_COLS;
  }
}

function ExportPopover({
  filters,
}: {
  filters: { q?: string; status?: string; flag?: string; categoryId?: string };
}) {
  const [open, setOpen] = useState(false);
  const [cols, setCols] = useState<ExportColumnKey[]>(() => readSavedCols());
  const selected = useMemo(() => new Set(cols), [cols]);
  const filtersActive = Boolean(
    filters.q || (filters.status && filters.status !== 'all') || (filters.flag && filters.flag !== 'all') || filters.categoryId,
  );

  function toggle(k: ExportColumnKey) {
    setCols((prev) => {
      const next = prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k];
      try {
        localStorage.setItem(EXPORT_COLS_LS_KEY, JSON.stringify(next));
      } catch {
        /* localStorage full or blocked — fail silent, in-memory state still works */
      }
      return next;
    });
  }
  function selectAll() {
    setCols(DEFAULT_EXPORT_COLS);
    try {
      localStorage.setItem(EXPORT_COLS_LS_KEY, JSON.stringify(DEFAULT_EXPORT_COLS));
    } catch {/* see toggle */}
  }
  function resetDefault() {
    selectAll();
  }

  function download(useFilters: boolean) {
    if (selected.size === 0) {
      toast.error('Pick at least one column');
      return;
    }
    void downloadInventoryCsv({
      ...(useFilters ? filters : {}),
      cols,
    });
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" iconLeft={<Download className="size-3.5" />}>
          Export
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="end">
        <div className="flex items-center justify-between">
          <div className="kicker text-ink-2">Columns to include</div>
          <div className="flex items-center gap-2 text-[11px]">
            <button type="button" onClick={selectAll} className="text-ink-3 hover:text-ink">
              Select all
            </button>
            <span className="text-ink-4">·</span>
            <button type="button" onClick={resetDefault} className="text-ink-3 hover:text-ink">
              Reset
            </button>
          </div>
        </div>
        <ul className="mt-2 max-h-60 space-y-1 overflow-y-auto">
          {EXPORT_COLUMNS.map((c) => {
            const checked = selected.has(c.key);
            return (
              <li key={c.key}>
                <label className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[12.5px] hover:bg-bg-2">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(c.key)}
                    className="size-3.5 accent-ink"
                  />
                  <span className="font-mono text-ink">{c.label}</span>
                </label>
              </li>
            );
          })}
        </ul>
        <div className="mt-3 flex flex-col gap-1.5">
          {filtersActive && (
            <Button variant="outline" size="sm" onClick={() => download(true)}>
              Download filtered
            </Button>
          )}
          <Button variant="ink" caps size="sm" onClick={() => download(false)}>
            Download all
          </Button>
          <p className="text-[11px] text-ink-3">
            At least one identifier column (sku or product_name+variant_label) is always included for round-trip safety.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Reserved cell with hover-tooltip listing the order IDs holding stock.
// ─────────────────────────────────────────────────────────────────────

function ReservedCell({ variantId, reserved }: { variantId: string; reserved: number }) {
  const [open, setOpen] = useState(false);
  // Lazy fetch — only after the user hovers, never on every row.
  const { data, isLoading } = useQuery({
    queryKey: ['retailer', 'inventory', variantId, 'reservations'],
    queryFn: () => api<Reservation[]>(`/retailer/inventory/${variantId}/reservations?limit=5`),
    enabled: open && reserved > 0,
    staleTime: 30_000,
  });

  if (reserved === 0) return <span>0</span>;

  return (
    <span
      className="relative inline-block cursor-help"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      tabIndex={0}
    >
      <span className="underline decoration-dotted underline-offset-2">{reserved}</span>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-72 rounded-md border border-line bg-bg p-2.5 text-left shadow-md">
          <div className="kicker mb-1.5 text-ink-3">
            Held by {reserved} unit{reserved === 1 ? '' : 's'}
          </div>
          {isLoading ? (
            <div className="text-[11.5px] text-ink-3">Loading…</div>
          ) : (data ?? []).length === 0 ? (
            <div className="text-[11.5px] text-ink-3 italic">
              No active reservation rows — `reserved` may be stale.
            </div>
          ) : (
            <ul className="space-y-1">
              {(data ?? []).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 text-[11.5px]">
                  <span className="font-mono text-ink-2 truncate">
                    <span className="text-ink-4">{r.ownerKind}·</span>{r.ownerId.slice(-10)}
                  </span>
                  <span className="font-mono text-ink shrink-0">×{r.qty}</span>
                </li>
              ))}
              {reserved > (data ?? []).length && (
                <li className="text-[11px] text-ink-4 italic">…and more</li>
              )}
            </ul>
          )}
        </div>
      )}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Pagination — page number + prev/next. Server-driven.
// ─────────────────────────────────────────────────────────────────────

function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onPage,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPage: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="mt-3 flex items-center justify-between gap-3 text-[12.5px] text-ink-3">
      <div>
        Showing <span className="font-mono text-ink">{from}–{to}</span> of{' '}
        <span className="font-mono text-ink">{total}</span>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Prev
        </Button>
        <span className="font-mono text-ink">{page}</span>
        <span className="text-ink-4">/</span>
        <span className="font-mono text-ink">{totalPages}</span>
        <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// CSV export — hits the backend, lets the browser save the file.
// ─────────────────────────────────────────────────────────────────────

async function downloadInventoryCsv(filters: { q?: string; status?: string; flag?: string; categoryId?: string; cols?: string[] } = {}) {
  try {
    const params = new URLSearchParams();
    if (filters.q?.trim()) params.set('q', filters.q.trim());
    if (filters.status && filters.status !== 'all') params.set('status', filters.status);
    if (filters.flag && filters.flag !== 'all') params.set('flag', filters.flag);
    if (filters.categoryId) params.set('categoryId', filters.categoryId);
    if (filters.cols && filters.cols.length > 0) params.set('cols', filters.cols.join(','));
    const qs = params.toString() ? `?${params}` : '';
    // We hit fetch directly so we get the raw response (the `api` helper unwraps
    // the JSON envelope, which doesn't apply to CSV).
    const token = getToken();
    const res = await fetch(`${BASE}/retailer/inventory/export${qs}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      // Try to extract an error message from the JSON envelope; if it isn't JSON
      // (e.g. a proxy 502), fall back to the status code.
      let msg = `Export failed (${res.status})`;
      try {
        const body = await res.json();
        if (body?.error?.message) msg = body.error.message;
      } catch {
        /* not JSON; keep generic */
      }
      throw new Error(msg);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    // Defer cleanup. Revoking the blob URL synchronously after .click() races
    // against the browser's download dispatch — some browsers cancel the download
    // before they've started reading the blob. 1s is well after dispatch in every
    // engine but still polite about memory.
    setTimeout(() => {
      a.remove();
      URL.revokeObjectURL(url);
    }, 1000);
    toast.success('Inventory exported');
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Export failed');
  }
}
