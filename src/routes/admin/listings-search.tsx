import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArchiveX, ArrowUpRight, Search } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { Listing } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Input } from '@/components/ui/input';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Th, Td, useSort, sortRows, sortProps } from '@/components/ui/table';
import { BulkActionBar } from '@/components/admin/bulk-action-bar';
import { bulkResultToast, runBulk } from '@/components/admin/bulk-result-toast';
import { useBulkSelect } from '@/hooks/useBulkSelect';

type Status = 'all' | 'draft' | 'active' | 'retired' | 'taken_down';

export default function AdminListingsSearch() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<Status>('all');

  const params = new URLSearchParams();
  if (q.trim()) params.set('q', q.trim());
  if (status !== 'all') params.set('status', status);
  params.set('limit', '100');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'listings', q, status],
    queryFn: () =>
      api<Array<Listing & { storeName?: string }>>(`/admin/listings?${params.toString()}`),
  });

  const rows = data ?? [];
  const { sort, toggle } = useSort<'name' | 'status' | 'rating'>(null);
  const sorted = sortRows(rows, sort, (r, key) => {
    if (key === 'name') return r.name;
    if (key === 'status') return r.status;
    if (key === 'rating') return r.ratingAvg ?? 0;
    return null;
  });

  const retirableRows = useMemo(
    () => sorted.filter((l) => l.status !== 'retired' && l.status !== 'taken_down'),
    [sorted],
  );
  const bulk = useBulkSelect(retirableRows);

  const bulkRetire = useMutation({
    mutationFn: (ids: string[]) =>
      runBulk(
        ids.map((id) => ({
          id,
          run: () =>
            api(`/admin/catalog/listings/${id}/retire`, { method: 'POST', body: {} }),
        })),
      ),
    onSuccess: (result) => {
      const byId = new Map(rows.map((l) => [l.id, l.name]));
      bulkResultToast({
        result,
        verb: 'retired',
        describe: (id) => byId.get(id) ?? id.slice(0, 8),
      });
      qc.invalidateQueries({ queryKey: ['admin', 'listings'] });
    },
  });

  return (
    <Page>
      <PageHeader
        kicker="Catalog"
        title="Listings search"
        description="Find any listing across every store. Click through to manage it inside its owning store context."
      />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or description…"
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="retired">Retired</SelectItem>
            <SelectItem value="taken_down">Taken down</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : rows.length === 0 ? (
        <Empty kicker="No matches" title="No listings match your filters." />
      ) : (
        <div className="border-t border-b border-ink/80 overflow-x-auto">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="border-b border-rule">
                <Th className="w-8">
                  <input
                    type="checkbox"
                    className="size-3.5 accent-ink"
                    checked={bulk.isAllSelected}
                    onChange={bulk.toggleAll}
                    aria-label="Select all retirable listings"
                  />
                </Th>
                <Th className="w-[40%]" {...sortProps(sort, 'name', toggle)}>Listing</Th>
                <Th className="w-[25%]">Store</Th>
                <Th className="w-[15%]" {...sortProps(sort, 'status', toggle)}>Status</Th>
                <Th className="w-[10%] text-right" {...sortProps(sort, 'rating', toggle)}>Rating</Th>
                <Th className="w-[10%] text-right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {sorted.map((l) => {
                const canRetire = l.status !== 'retired' && l.status !== 'taken_down';
                return (
                <tr key={l.id} className="hover:bg-surface/40">
                  <Td>
                    {canRetire && (
                      <input
                        type="checkbox"
                        className="size-3.5 accent-ink"
                        checked={bulk.isSelected(l.id)}
                        onChange={() => bulk.toggle(l.id)}
                        aria-label={`Select ${l.name}`}
                      />
                    )}
                  </Td>
                  <Td>
                    <div className="font-medium text-ink truncate">{l.name}</div>
                    <div className="mt-0.5 text-[12px] text-ink-3 font-mono">{l.id}</div>
                  </Td>
                  <Td>
                    <div className="text-ink">{l.storeName ?? '—'}</div>
                    <div className="mt-0.5 font-mono text-[11px] text-ink-3">{l.storeId}</div>
                  </Td>
                  <Td>
                    <Badge tone={statusTone(l.status)} flat>
                      {l.status}
                    </Badge>
                  </Td>
                  <Td className="text-right font-mono text-[13.5px] tabular-nums text-ink-3">
                    {l.ratingCount > 0 ? `${l.ratingAvg} (${l.ratingCount})` : '—'}
                  </Td>
                  <Td className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {l.status !== 'retired' && l.status !== 'taken_down' && (
                        <RetireAction listing={l} />
                      )}
                      <Link
                        to={`/admin/retailers/_/stores/${l.storeId}/listings/${l.id}`}
                        className="inline-flex items-center gap-1 text-[13px] text-ink-2 hover:text-ink"
                      >
                        Open
                        <ArrowUpRight className="size-3.5" />
                      </Link>
                    </div>
                  </Td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <BulkActionBar
        selectedCount={bulk.selectedCount}
        onClear={bulk.clear}
        actions={[
          {
            label: 'Retire selected',
            danger: true,
            loading: bulkRetire.isPending,
            onClick: () => {
              if (!window.confirm(`Retire ${bulk.selectedCount} listing(s) platform-wide?`)) return;
              bulkRetire.mutate(bulk.selectedIds, { onSettled: () => bulk.clear() });
            },
          },
        ]}
      />
    </Page>
  );
}

function statusTone(s: string) {
  if (s === 'active') return 'success' as const;
  if (s === 'taken_down') return 'danger' as const;
  if (s === 'retired') return 'warning' as const;
  return 'neutral' as const;
}

function RetireAction({ listing }: { listing: Listing }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const retire = useMutation({
    mutationFn: () =>
      api(`/admin/catalog/listings/${listing.id}/retire`, {
        method: 'POST',
        body: { note: note.trim() || undefined },
      }),
    onSuccess: () => {
      toast.success(`${listing.name} retired platform-wide`);
      setOpen(false);
      setNote('');
      qc.invalidateQueries({ queryKey: ['admin', 'listings'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to retire'),
  });
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="text-ink-3 hover:text-danger"
        iconLeft={<ArchiveX className="size-3.5" />}
        onClick={() => setOpen(true)}
        title="Retire platform-wide"
      >
        Retire
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Retire {listing.name} platform-wide?</DialogTitle>
            <DialogDescription>
              The listing will be hidden from every consumer surface immediately.
              Retailer keeps inventory rows but cannot un-retire without admin help.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="kicker text-ink-3" htmlFor="retire-note">Note (optional)</label>
            <Input
              id="retire-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Compliance / quality reason shown to retailer"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="danger" loading={retire.isPending} onClick={() => retire.mutate()}>
              Retire platform-wide
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

