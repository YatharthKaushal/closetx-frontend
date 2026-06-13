import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowUpRight, ImageOff, Plus, Search } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { canPublishProducts, deriveGate } from '@/lib/gate';
import { listingStatusMeta } from '@/lib/status';
import type { Listing, ListingStatus, RetailerProfile, Store } from '@/lib/types';
import { GateNotice } from '@/components/retailer/gate-notice';
import { Page, PageHeader } from '@/components/ui/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const STATUS_OPTIONS: ReadonlyArray<{ value: ListingStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All products' },
  { value: 'active', label: 'Active' },
  { value: 'draft', label: 'Draft' },
  { value: 'retired', label: 'Retired' },
];

type MeResponse = { retailer: RetailerProfile; store: Store | null };

export default function RetailerListings() {
  const [status, setStatus] = useState<ListingStatus | 'all'>('all');
  const [q, setQ] = useState('');
  const [bulkMode, setBulkMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Drives the gate banner. Only mutations on this page are gated server-side, but
  // we mirror the rule client-side so the user knows in advance.
  const me = useQuery({
    queryKey: ['retailer', 'me'],
    queryFn: () => api<MeResponse>('/retailer/me'),
  });
  const gate = deriveGate(me.data?.retailer, me.data?.store);
  const canPublish = canPublishProducts(gate);

  const qc = useQueryClient();
  const bulkStatus = useMutation({
    mutationFn: (body: { ids: string[]; status: 'active' | 'draft' | 'retired' }) =>
      api<{ updated: number; skipped: number }>('/retailer/listings/bulk-status', { method: 'POST', body }),
    onSuccess: (data) => {
      toast.success(`Updated ${data.updated} product${data.updated === 1 ? '' : 's'}${data.skipped > 0 ? ` · ${data.skipped} skipped` : ''}`);
      setSelected(new Set());
      setBulkMode(false);
      void qc.invalidateQueries({ queryKey: ['retailer', 'listings'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Bulk update failed'),
  });

  const listings = useQuery({
    queryKey: ['retailer', 'listings', status],
    queryFn: () => {
      const params = new URLSearchParams({ sort: 'updated_desc' });
      if (status !== 'all') params.set('status', status);
      return api<Listing[]>(`/retailer/listings?${params}`);
    },
    enabled: canPublish,
  });

  const toggleStatus = useMutation({
    mutationFn: ({ id, next }: { id: string; next: 'active' | 'draft' }) =>
      api('/retailer/listings/bulk-status', { method: 'POST', body: { ids: [id], status: next } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['retailer', 'listings'] }),
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Update failed'),
  });

  const deleteListing = useMutation({
    mutationFn: (id: string) => api(`/retailer/listings/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Listing deleted');
      setSelected(new Set());
      void qc.invalidateQueries({ queryKey: ['retailer', 'listings'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Delete failed'),
  });

  const filtered = (listings.data ?? []).filter((l) => {
    if (!q.trim()) return true;
    const n = q.toLowerCase();
    return l.name.toLowerCase().includes(n) || (l.brand?.name.toLowerCase().includes(n) ?? false);
  });

  return (
    <Page>
      <PageHeader
        title={<>Products</>}
        description={
          <>
            Each row is a product. Variants (size, colour, SKU, stock) live inside each
            one — open it to manage them.
          </>
        }
        actions={
          canPublish ? (
            <div className="flex items-center gap-2">
              <Button
                variant={bulkMode ? 'ink' : 'outline'}
                size="sm"
                onClick={() => {
                  setBulkMode((b) => !b);
                  setSelected(new Set());
                }}
              >
                {bulkMode ? 'Exit bulk mode' : 'Bulk select'}
              </Button>
              <Button asChild variant="ink" caps iconLeft={<Plus className="size-3.5" />}>
                <Link to="/retailer/listings/new">New product</Link>
              </Button>
            </div>
          ) : undefined
        }
      />

      {!canPublish ? (
        <GateNotice gate={gate} />
      ) : (
        <>
          <div className="mb-6 flex flex-col gap-3 border-b border-rule pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="relative max-w-md flex-1">
              <Search className="pointer-events-none absolute left-1 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
              <Input
                placeholder="Search by name or brand…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="!pl-7"
              />
            </div>
            <div className="flex items-center gap-3">
              <span className="kicker text-ink-3 hidden sm:inline">Filter</span>
              <Select value={status} onValueChange={(v) => setStatus(v as ListingStatus | 'all')}>
                <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {listings.isLoading ? (
            <div className="overflow-hidden rounded border border-rule">
              {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-[52px] rounded-none" />)}
            </div>
          ) : listings.isError ? (
            <Empty
              kicker="Connection lost"
              title="Couldn't load products."
              description={listings.error instanceof ApiError ? listings.error.message : 'Try again.'}
              action={<Button variant="outline" onClick={() => listings.refetch()}>Retry</Button>}
            />
          ) : filtered.length === 0 ? (
            <Empty
              kicker={q ? 'No matches' : 'No products yet'}
              title={q ? 'Nothing matches that search.' : 'No products yet.'}
              description={
                q
                  ? 'Try a different keyword or clear the filter.'
                  : 'Add your first product to begin selling.'
              }
              action={
                !q && (
                  <Button asChild variant="ink" caps iconLeft={<Plus className="size-3.5" />}>
                    <Link to="/retailer/listings/new">Add first product</Link>
                  </Button>
                )
              }
            />
          ) : (
            <div className="overflow-hidden rounded border border-rule">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-rule bg-bg-2/60">
                    {bulkMode && (
                      <th className="w-10 px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={selected.size === filtered.length && filtered.length > 0}
                          onChange={(e) =>
                            setSelected(e.target.checked ? new Set(filtered.map((l) => l.id)) : new Set())
                          }
                          className="size-4 cursor-pointer accent-accent"
                        />
                      </th>
                    )}
                    <th className="w-14 py-2.5 pl-4 pr-2" />
                    <th className="py-2.5 pr-4 text-left kicker text-ink-3">Product</th>
                    <th className="py-2.5 pr-4 text-left kicker text-ink-3 w-28">Status</th>
                    <th className="py-2.5 pr-4 text-right kicker text-ink-3 w-20">Variants</th>
                    <th className="py-2.5 pr-4 text-right kicker text-ink-3 w-24">Stock</th>
                    <th className="w-36 py-2.5 pr-4" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule">
                  {filtered.map((l) => (
                    <ListingRow
                      key={l.id}
                      listing={l}
                      bulkMode={bulkMode}
                      selected={selected.has(l.id)}
                      onSelectChange={(checked) =>
                        setSelected((s) => {
                          const next = new Set(s);
                          if (checked) next.add(l.id);
                          else next.delete(l.id);
                          return next;
                        })
                      }
                      onToggleStatus={(next) => toggleStatus.mutate({ id: l.id, next })}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {bulkMode && selected.size > 0 && (
        <BulkActionBar
          count={selected.size}
          ids={[...selected]}
          allDraft={[...selected].every((id) => filtered.find((l) => l.id === id)?.status === 'draft')}
          onActivate={() => bulkStatus.mutate({ ids: [...selected], status: 'active' })}
          onDraft={() => bulkStatus.mutate({ ids: [...selected], status: 'draft' })}
          onArchive={() => bulkStatus.mutate({ ids: [...selected], status: 'retired' })}
          onDelete={() => {
            if (!window.confirm('Delete all selected draft listings? This cannot be undone.')) return;
            Promise.all([...selected].map((id) => deleteListing.mutateAsync(id))).catch(() => null);
          }}
          pending={bulkStatus.isPending || deleteListing.isPending}
        />
      )}
    </Page>
  );
}

function BulkActionBar({ count, ids: _ids, allDraft, onActivate, onDraft, onArchive: _onArchive, onDelete, pending }: {
  count: number; ids: string[]; allDraft: boolean;
  onActivate: () => void; onDraft: () => void; onArchive: () => void; onDelete: () => void; pending?: boolean;
}) {
  return (
    <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-full border border-line bg-bg/95 backdrop-blur px-3 py-2 shadow-lg flex items-center gap-2">
      <span className="text-[12.5px] text-ink-2 px-2">{count} selected</span>
      <Button size="sm" variant="outline" disabled={pending} onClick={onDraft}>Move to draft</Button>
      <Button size="sm" variant="accent" loading={pending ?? false} onClick={onActivate}>Make active</Button>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => _onArchive()}>Archive</Button>
      {allDraft && (
        <Button size="sm" variant="danger" disabled={pending} onClick={onDelete}>Delete</Button>
      )}
    </div>
  );
}

function ListingRow({ listing, bulkMode, selected, onSelectChange, onToggleStatus }: {
  listing: Listing;
  bulkMode: boolean;
  selected: boolean;
  onSelectChange: (checked: boolean) => void;
  onToggleStatus?: (next: 'active' | 'draft') => void;
}) {
  const navigate = useNavigate();
  const meta = listingStatusMeta(listing.status);
  const variantCount = listing.variants?.length ?? 0;
  const totalStock = listing.variants?.reduce((acc, v) => acc + v.stock, 0) ?? 0;
  const hero =
    listing.galleryUrls?.[0] ??
    listing.variants?.find((v) => v.imageUrls && v.imageUrls.length > 0)?.imageUrls[0] ??
    null;

  return (
    <tr
      className={`group cursor-pointer transition-colors ${selected ? 'bg-accent/5' : 'hover:bg-bg-2/40'}`}
      onClick={() => navigate(`/retailer/listings/${listing.id}`)}
    >
      {bulkMode && (
        <td className="w-10 px-3" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onSelectChange(e.target.checked)}
            className="size-4 cursor-pointer accent-accent"
          />
        </td>
      )}
      <td className="w-14 py-2 pl-4 pr-2">
        <div className="size-9 overflow-hidden rounded-xs border border-rule bg-paper-2 shrink-0">
          {hero ? (
            <img
              src={hero}
              alt=""
              loading="lazy"
              className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="grid size-full place-items-center text-ink-4">
              <ImageOff className="size-3.5" />
            </div>
          )}
        </div>
      </td>
      <td className="py-2 pr-4">
        <div className="flex flex-col">
          <span className="font-display italic text-[15px] leading-snug text-ink truncate max-w-xs">
            {listing.name}
          </span>
          <span className="mt-0.5 text-[11px] text-ink-3 truncate">
            <span className="font-medium text-ink-2">{listing.brand?.name ?? 'Unbranded'}</span>
            {' · '}{listing.category?.label ?? listing.categoryId}
            {' · '}<span className="capitalize">{listing.gender}</span>
          </span>
        </div>
      </td>
      <td className="py-2 pr-4 w-28">
        <Badge tone={meta.tone}>{meta.label}</Badge>
        {listing.status === 'taken_down' && listing.takedownReason && (
          <div className="mt-1 text-[11px] text-warning truncate max-w-[14rem]" title={listing.takedownReason}>
            {listing.takedownReason}
          </div>
        )}
      </td>
      <td className="py-2 pr-4 w-20 text-right">
        <span className="font-mono tabular-nums text-[12.5px] text-ink">{String(variantCount).padStart(2, '0')}</span>
      </td>
      <td className="py-2 pr-4 w-24 text-right">
        <span className="font-mono tabular-nums text-[12.5px] text-ink">{String(totalStock).padStart(3, '0')}</span>
      </td>
      <td className="py-2 pr-4 w-36 text-right">
        <div className="flex items-center justify-end gap-2">
          {onToggleStatus && (listing.status === 'active' || listing.status === 'draft') && (
            <Button
              size="sm"
              variant={listing.status === 'active' ? 'outline' : 'accent'}
              onClick={(e) => {
                e.stopPropagation();
                const next = listing.status === 'active' ? 'draft' : 'active';
                if (next === 'active') {
                  const missing: string[] = [];
                  if (!listing.variants?.length) missing.push('at least one variant');
                  if (!listing.galleryUrls?.length) missing.push('at least one image');
                  if (missing.length > 0) {
                    toast.error(`Can't publish — add ${missing.join(' and ')} first. Open product to add.`);
                    return;
                  }
                }
                onToggleStatus(next);
              }}
            >
              {listing.status === 'active' ? 'Unpublish' : 'Publish'}
            </Button>
          )}
          <ArrowUpRight className="size-3.5 text-ink-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink" />
        </div>
      </td>
    </tr>
  );
}
