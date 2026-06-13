import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PauseCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { formatPaise } from '@/lib/status';
import { usePosCart } from '@/lib/pos-cart-store';
import type { HeldBill, PosSaleDetail } from '@/lib/pos-types';
import { Page, PageHeader } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';

export default function PosHeld() {
  const navigate = useNavigate();
  const cart = usePosCart();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['retailer', 'pos', 'held'],
    queryFn: () => api<HeldBill[]>('/retailer/pos/held'),
  });

  async function resume(id: string) {
    const sale = await qc.fetchQuery({
      queryKey: ['retailer', 'pos', 'sale', id],
      queryFn: () => api<PosSaleDetail>(`/retailer/pos/sales/${id}`),
    });
    cart.loadFromHeld(
      id,
      sale.items.map((it) => ({
        variantId: it.variantId,
        listingId: it.listingId,
        name: it.listingNameSnap,
        brand: it.brandSnap,
        attributesLabel: it.attributesLabelSnap,
        sku: it.skuSnap,
        unitMrpPaise: it.unitMrpPaise,
        qty: it.qty,
        lineDiscountPaise: it.lineDiscountPaise,
        availableQty: 9999,
      })),
      {
        name: sale.customerNameSnap,
        phone: sale.customerPhoneSnap,
        gstin: sale.customerGstinSnap,
      },
      sale.billDiscountPaise,
    );
    navigate('/retailer/pos');
  }

  const rows = data ?? [];

  return (
    <Page>
      <PageHeader title="Held bills" description="Parked counter bills waiting to be settled" />
      {rows.length === 0 ? (
        <Empty icon={<PauseCircle className="size-5" />} title="No held bills" description="Park a bill from the register to resume it later." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((b) => (
            <div key={b.id} className="rounded-xl border border-line bg-bg p-4">
              <div className="text-[13px] font-medium text-ink">{b.customerName || 'Walk-in'}</div>
              <div className="text-[11px] text-ink-4">
                {b.itemCount} item{b.itemCount === 1 ? '' : 's'}
                {b.note ? ` · ${b.note}` : ''}
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[15px] font-semibold tabular-nums">{formatPaise(b.payablePaise)}</span>
                <Button size="sm" variant="accent" onClick={() => resume(b.id)}>Resume</Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Page>
  );
}
