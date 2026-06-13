import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Printer, Receipt, RotateCcw, Ban } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { formatPaise } from '@/lib/status';
import { usePermission } from '@/lib/use-permission';
import { printInvoiceA4, printReceipt80mm, downloadSalePdf } from '@/lib/pos-print';
import type { PosSaleDetail } from '@/lib/pos-types';
import { Page, PageHeader } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Empty } from '@/components/ui/empty';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

export default function PosSaleDetailPage() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const canRefund = usePermission('pos.refund');
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [returnOpen, setReturnOpen] = useState(false);

  const { data: sale } = useQuery({
    queryKey: ['retailer', 'pos', 'sale', id],
    queryFn: () => api<PosSaleDetail>(`/retailer/pos/sales/${id}`),
  });

  const voidSale = useMutation({
    mutationFn: () =>
      api(`/retailer/pos/sales/${id}/void`, { method: 'POST', body: { reason: voidReason } }),
    onSuccess: () => {
      toast.success('Sale voided');
      setVoidOpen(false);
      qc.invalidateQueries({ queryKey: ['retailer', 'pos'] });
      qc.invalidateQueries({ queryKey: ['retailer', 'inventory'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not void'),
  });

  if (!sale) return <Page><Empty title="Loading…" /></Page>;

  const isReturn = Boolean(sale.originalSaleId);

  return (
    <Page>
      <PageHeader
        title={sale.invoice?.invoiceNumber ?? 'Counter sale'}
        description={sale.completedAt ? new Date(sale.completedAt).toLocaleString('en-IN') : ''}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" iconLeft={<Printer className="size-4" />} onClick={() => printInvoiceA4(sale)}>
              Invoice
            </Button>
            <Button variant="outline" size="sm" iconLeft={<Receipt className="size-4" />} onClick={() => printReceipt80mm(sale)}>
              Receipt
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                downloadSalePdf(sale.id, sale.invoice?.invoiceNumber ?? 'invoice').catch((e) => toast.error(e.message))
              }
            >
              PDF
            </Button>
            {canRefund && sale.status === 'completed' && !isReturn && (
              <>
                <Button variant="outline" size="sm" iconLeft={<RotateCcw className="size-4" />} onClick={() => setReturnOpen(true)}>
                  Return
                </Button>
                <Button variant="danger" size="sm" iconLeft={<Ban className="size-4" />} onClick={() => setVoidOpen(true)}>
                  Void
                </Button>
              </>
            )}
          </div>
        }
      />

      <div className="mb-4 flex items-center gap-2">
        {sale.status === 'voided' ? (
          <Badge tone="danger">Voided</Badge>
        ) : isReturn ? (
          <Badge tone="warning">Return</Badge>
        ) : (
          <Badge tone="success">Paid</Badge>
        )}
        <span className="text-[13px] text-ink-3">
          {sale.customerNameSnap || 'Walk-in customer'}
          {sale.customerPhoneSnap ? ` · ${sale.customerPhoneSnap}` : ''}
          {sale.customerGstinSnap ? ` · GSTIN ${sale.customerGstinSnap}` : ''}
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-bg">
        <table className="w-full text-[13px]">
          <thead className="bg-bg-2 text-[11px] uppercase text-ink-4">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Item</th>
              <th className="px-3 py-2 text-right font-medium">Qty</th>
              <th className="px-3 py-2 text-right font-medium">Rate</th>
              <th className="px-3 py-2 text-right font-medium">GST</th>
              <th className="px-3 py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((it) => (
              <tr key={it.id} className="border-t border-line">
                <td className="px-3 py-2">
                  <div className="font-medium text-ink">{it.listingNameSnap}</div>
                  <div className="text-[11px] text-ink-4">{it.attributesLabelSnap}{it.skuSnap ? ` · ${it.skuSnap}` : ''}</div>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{it.qty}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatPaise(it.unitMrpPaise)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatPaise(it.gstPaise)} ({it.gstRateBp / 100}%)</td>
                <td className="px-3 py-2 text-right font-medium tabular-nums">{formatPaise(it.netLinePaise)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-line p-3">
          <div className="ml-auto w-64 space-y-1 text-[13px]">
            <Tot label="Taxable" value={formatPaise(sale.taxableValuePaise)} />
            <Tot label="CGST" value={formatPaise(sale.cgstPaise)} />
            <Tot label="SGST" value={formatPaise(sale.sgstPaise)} />
            {sale.roundOffPaise !== 0 && <Tot label="Round off" value={formatPaise(sale.roundOffPaise)} />}
            <div className="flex justify-between border-t border-line pt-1 font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{formatPaise(sale.payablePaise)}</span>
            </div>
            {sale.payments.filter((p) => p.direction === 'collect').map((p) => (
              <Tot key={p.id} label={p.method.toUpperCase()} value={formatPaise(p.amountPaise)} muted />
            ))}
            {sale.changePaise > 0 && <Tot label="Change" value={formatPaise(sale.changePaise)} muted />}
          </div>
        </div>
      </div>

      <Dialog open={voidOpen} onOpenChange={setVoidOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Void this sale?</DialogTitle></DialogHeader>
          <p className="text-[13px] text-ink-3">Restores stock and issues a credit note. This cannot be undone.</p>
          <Input placeholder="Reason" value={voidReason} onChange={(e) => setVoidReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidOpen(false)}>Cancel</Button>
            <Button variant="danger" disabled={!voidReason} loading={voidSale.isPending} onClick={() => voidSale.mutate()}>
              Void sale
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {returnOpen && <ReturnDialog sale={sale} onClose={() => setReturnOpen(false)} />}
    </Page>
  );
}

function Tot({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`flex justify-between ${muted ? 'text-ink-4' : 'text-ink-3'}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function ReturnDialog({ sale, onClose }: { sale: PosSaleDetail; onClose: () => void }) {
  const qc = useQueryClient();
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [reason, setReason] = useState('');

  const refundPaise = sale.items.reduce((s, it) => {
    const q = qtys[it.id] ?? 0;
    return s + Math.round((it.netLinePaise * q) / it.qty);
  }, 0);

  const submit = useMutation({
    mutationFn: () =>
      api(`/retailer/pos/sales/${sale.id}/returns`, {
        method: 'POST',
        body: {
          idempotencyKey: `posret-${sale.id}-${crypto.randomUUID()}`,
          reason,
          lines: sale.items
            .filter((it) => (qtys[it.id] ?? 0) > 0)
            .map((it) => ({ originalSaleItemId: it.id, qty: qtys[it.id], restock: true })),
          refundTenders: [{ method: 'cash' as const, amountPaise: refundPaise }],
        },
      }),
    onSuccess: () => {
      toast.success('Return processed');
      onClose();
      qc.invalidateQueries({ queryKey: ['retailer', 'pos'] });
      qc.invalidateQueries({ queryKey: ['retailer', 'inventory'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Return failed'),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Return items</DialogTitle></DialogHeader>
        <div className="space-y-2">
          {sale.items.map((it) => (
            <div key={it.id} className="flex items-center justify-between gap-2 text-[13px]">
              <span className="min-w-0">
                <span className="block truncate font-medium text-ink">{it.listingNameSnap}</span>
                <span className="text-[11px] text-ink-4">bought {it.qty} · {formatPaise(it.netLinePaise)}</span>
              </span>
              <Input
                type="number"
                min={0}
                max={it.qty}
                value={qtys[it.id] ?? 0}
                onChange={(e) =>
                  setQtys((p) => ({ ...p, [it.id]: Math.max(0, Math.min(it.qty, Number(e.target.value))) }))
                }
                className="w-20"
              />
            </div>
          ))}
          <Input placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <DialogFooter>
          <span className="mr-auto text-[13px] font-medium">Refund: {formatPaise(refundPaise)}</span>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="accent" disabled={refundPaise <= 0 || !reason} loading={submit.isPending} onClick={() => submit.mutate()}>
            Refund cash
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
