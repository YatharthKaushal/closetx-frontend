import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Download, Upload } from 'lucide-react';
import { api, ApiError, BASE } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label, FieldError } from '@/components/ui/label';
import { BulkActionBar } from '@/components/admin/bulk-action-bar';
import { useBulkSelect } from '@/hooks/useBulkSelect';

interface InventoryRow {
  id: string;
  listingId: string;
  listingName: string;
  listingStatus: string;
  brandName: string | null;
  sku: string | null;
  attributesLabel: string;
  pricePaise: number;
  stock: number;
  reserved: number;
  isActive: boolean;
}

export default function AdminStoreInventory() {
  const { id: retailerId, storeId } = useParams<{ id: string; storeId: string }>();
  const qc = useQueryClient();
  const [adjusting, setAdjusting] = useState<InventoryRow | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'store-inventory', storeId],
    queryFn: () => api<InventoryRow[]>(`/admin/stores/${storeId}/inventory`),
    enabled: Boolean(storeId),
  });
  const rows = data ?? [];
  const bulk = useBulkSelect(rows);

  const bulkDeactivate = useMutation({
    mutationFn: () =>
      api<{ updated: number; skipped: number }>(`/admin/stores/${storeId}/inventory/bulk-deactivate-variants`, {
        method: 'POST',
        body: { variantIds: bulk.selectedIds },
      }),
    onSuccess: (r) => {
      toast.success(`${r.updated} deactivated, ${r.skipped} skipped`);
      bulk.clear();
      void qc.invalidateQueries({ queryKey: ['admin', 'store-inventory', storeId] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Bulk deactivate failed'),
  });

  async function downloadExport() {
    const token = getToken();
    const res = await fetch(`${BASE}/admin/stores/${storeId}/inventory/export`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      toast.error('Export failed');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-${storeId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Page>
      <PageHeader
        kicker="Store"
        title="Inventory"
        description="Stock per variant. Adjustments recorded with admin actor. CSV import / export mirrors retailer flow."
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" iconLeft={<ArrowLeft className="size-3.5" />}>
              <Link to={`/admin/retailers/${retailerId}/stores/${storeId}`}>Back</Link>
            </Button>
            <Button variant="outline" size="sm" iconLeft={<Download className="size-3.5" />} onClick={() => void downloadExport()}>
              Export CSV
            </Button>
            <Button variant="ink" size="sm" iconLeft={<Upload className="size-3.5" />} onClick={() => setImportOpen(true)}>
              Import CSV
            </Button>
          </div>
        }
      />

      <div className="mb-3 flex items-center gap-3 text-[12.5px] text-ink-3">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={bulk.isAllSelected}
            onChange={bulk.toggleAll}
            className="accent-accent"
          />
          Select all
        </label>
        <span>{rows.length} variants</span>
      </div>

      {isLoading ? (
        <Skeleton className="h-40" />
      ) : rows.length === 0 ? (
        <Card><CardContent className="p-6"><p className="text-[13px] text-ink-3 italic">No inventory.</p></CardContent></Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-[13px]">
              <thead className="bg-bg-2/40 border-b border-line">
                <tr>
                  <Th className="w-10"></Th>
                  <Th>Product</Th>
                  <Th>Variant</Th>
                  <Th>SKU</Th>
                  <Th className="text-right">Stock</Th>
                  <Th className="text-right">Reserved</Th>
                  <Th className="text-right">Price</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.id} className={bulk.isSelected(r.id) ? 'bg-bg-2/40' : undefined}>
                    <Td>
                      <input
                        type="checkbox"
                        className="accent-accent"
                        checked={bulk.isSelected(r.id)}
                        onChange={() => bulk.toggle(r.id)}
                      />
                    </Td>
                    <Td>
                      <div className="font-medium text-ink">{r.listingName}</div>
                      <div className="text-[11.5px] text-ink-3">{r.brandName ?? 'Unbranded'}</div>
                    </Td>
                    <Td>{r.attributesLabel}</Td>
                    <Td className="font-mono">{r.sku ?? '—'}</Td>
                    <Td className="text-right font-mono">{r.stock}</Td>
                    <Td className="text-right font-mono text-ink-3">{r.reserved}</Td>
                    <Td className="text-right font-mono">₹{(r.pricePaise / 100).toFixed(2)}</Td>
                    <Td className="text-right">
                      <Button variant="outline" size="sm" onClick={() => setAdjusting(r)}>Adjust</Button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <BulkActionBar
        selectedCount={bulk.selectedCount}
        onClear={bulk.clear}
        actions={[
          {
            label: 'Deactivate variants',
            danger: true,
            onClick: () => bulkDeactivate.mutate(),
            loading: bulkDeactivate.isPending,
          },
        ]}
      />

      <AdjustDialog
        target={adjusting}
        storeId={storeId ?? ''}
        onClose={() => setAdjusting(null)}
        onAdjusted={() => {
          setAdjusting(null);
          void qc.invalidateQueries({ queryKey: ['admin', 'store-inventory', storeId] });
        }}
      />

      <ImportDialog
        open={importOpen}
        storeId={storeId ?? ''}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          setImportOpen(false);
          void qc.invalidateQueries({ queryKey: ['admin', 'store-inventory', storeId] });
        }}
      />
    </Page>
  );
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-3 ${className ?? ''}`}>{children}</th>;
}
function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-top ${className ?? ''}`}>{children}</td>;
}

function AdjustDialog({
  target,
  storeId,
  onClose,
  onAdjusted,
}: {
  target: InventoryRow | null;
  storeId: string;
  onClose: () => void;
  onAdjusted: () => void;
}) {
  const [delta, setDelta] = useState('');
  const [note, setNote] = useState('');
  const adjust = useMutation({
    mutationFn: () =>
      api(`/admin/stores/${storeId}/inventory/adjust`, {
        method: 'POST',
        body: { variantId: target?.id, delta: parseInt(delta, 10) || 0, note: note.trim() || undefined },
      }),
    onSuccess: () => {
      toast.success('Inventory adjusted');
      setDelta(''); setNote('');
      onAdjusted();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Adjust failed'),
  });
  const parsed = parseInt(delta, 10);
  const valid = !Number.isNaN(parsed) && parsed !== 0;

  return (
    <Dialog open={Boolean(target)} onOpenChange={(o) => { if (!o) { setDelta(''); setNote(''); onClose(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust stock</DialogTitle>
          <DialogDescription>
            {target ? `${target.listingName} · ${target.attributesLabel} · current stock ${target.stock}` : ''}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="delta" required>Change (use + to add, − to remove)</Label>
            <Input id="delta" value={delta} onChange={(e) => setDelta(e.target.value)} placeholder="e.g. -3 or 10" />
            <FieldError>{delta && !valid ? 'Enter a non-zero integer' : ''}</FieldError>
          </div>
          <div>
            <Label htmlFor="note">Note (optional)</Label>
            <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => { setDelta(''); setNote(''); onClose(); }}>Cancel</Button>
          <Button variant="ink" disabled={!valid} loading={adjust.isPending} onClick={() => adjust.mutate()}>
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportDialog({
  open,
  storeId,
  onClose,
  onImported,
}: {
  open: boolean;
  storeId: string;
  onClose: () => void;
  onImported: () => void;
}) {
  const [csvText, setCsvText] = useState('');
  const [errorLog, setErrorLog] = useState<{ row: number; sku: string; reason: string }[]>([]);

  function parseRows(text: string): { sku: string; stock: number }[] {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return [];
    const header = lines[0]!.toLowerCase();
    const start = header.includes('sku') ? 1 : 0;
    const out: { sku: string; stock: number }[] = [];
    for (let i = start; i < lines.length; i++) {
      const cells = lines[i]!.split(',');
      const sku = (cells[0] ?? '').trim().replace(/^"|"$/g, '');
      const stockStr = (cells[1] ?? '').trim();
      const stock = parseInt(stockStr, 10);
      if (!sku || Number.isNaN(stock)) continue;
      out.push({ sku, stock });
    }
    return out;
  }

  const importMut = useMutation({
    mutationFn: (rows: { sku: string; stock: number }[]) =>
      api<{ applied: number }>(`/admin/stores/${storeId}/inventory/import`, {
        method: 'POST',
        body: { rows },
      }),
    onSuccess: (r) => {
      toast.success(`Applied ${r.applied} rows`);
      setCsvText('');
      setErrorLog([]);
      onImported();
    },
    onError: (e) => {
      if (e instanceof ApiError && e.details && Array.isArray(e.details)) {
        setErrorLog(e.details as { row: number; sku: string; reason: string }[]);
        toast.error(`${e.details.length} rows failed validation`);
      } else {
        toast.error(e instanceof ApiError ? e.message : 'Import failed');
      }
    },
  });

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    f.text().then(setCsvText).catch(() => toast.error('Could not read file'));
  }

  const parsed = parseRows(csvText);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setCsvText(''); setErrorLog([]); onClose(); } }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Import inventory CSV</DialogTitle>
          <DialogDescription>
            Columns: <code>sku,stock</code>. It's all or nothing — if any row has an error, nothing is changed.
            Max 5 000 rows.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <input type="file" accept=".csv,text/csv" onChange={onFile} className="text-[12.5px]" />
          <textarea
            className="h-40 w-full rounded-md border border-line bg-bg p-2 font-mono text-[12px]"
            placeholder="sku,stock&#10;SKU001,5&#10;SKU002,12"
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
          />
          <div className="text-[12.5px] text-ink-3">{parsed.length} rows parsed</div>
          {errorLog.length > 0 && (
            <div className="max-h-40 overflow-y-auto rounded border border-danger/40 bg-danger/5 p-2 text-[12px]">
              <div className="font-medium text-danger">Validation errors:</div>
              <ul className="mt-1 space-y-0.5">
                {errorLog.slice(0, 50).map((er, i) => (
                  <li key={i} className="font-mono">row {er.row} · {er.sku} · {er.reason}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => { setCsvText(''); setErrorLog([]); onClose(); }}>Cancel</Button>
          <Button
            variant="ink"
            disabled={parsed.length === 0}
            loading={importMut.isPending}
            onClick={() => importMut.mutate(parsed)}
          >
            Apply {parsed.length || ''} rows
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
