import { useState, useEffect, useMemo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Plus, Receipt, RefreshCw, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { formatPaise } from '@/lib/status';
import type { PricingBreakdown, Promotion } from '@/lib/types';
import { SectionHeading } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MultiSelect } from '@/components/ui/multi-select';

/**
 * Pricing simulator — feed a hypothetical cart + promotions + loyalty redemption,
 * see the full breakdown live (debounced). Useful for QAing a promo before publishing.
 *
 * Layout: cart builder on the left, receipt-style breakdown on the right.
 */
type LineState = {
  lineId: string;
  listingId: string;
  variantId: string;
  unitPricePaise: number;
  qty: number;
  gstRatePct: number;
};

export function PricingSimulatorPanel() {
  const [lines, setLines] = useState<LineState[]>([
    { lineId: 'L1', listingId: 'lst-x', variantId: 'var-x', unitPricePaise: 100000, qty: 1, gstRatePct: 5 },
  ]);
  const [consumerStateCode, setConsumerStateCode] = useState('27');
  const [storeStateCode, setStoreStateCode] = useState('27');
  const [deliveryMethod, setDeliveryMethod] = useState<'express' | 'standard' | 'pickup' | 'try_and_buy'>('standard');
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'card' | 'cod' | 'wallet' | 'gift_card'>('upi');
  const [promotionIds, setPromotionIds] = useState<string[]>([]);
  const promotions = useQuery({
    queryKey: ['admin', 'promotions', 'all'],
    queryFn: () => api<Promotion[]>('/admin/promotions'),
  });
  const promotionOptions = (promotions.data ?? []).map((p) => ({
    value: p.id,
    label: p.name,
    hint: p.id,
  }));
  const [couponCode, setCouponCode] = useState('');
  const [voucherCode, setVoucherCode] = useState('');
  const [pointsToRedeem, setPointsToRedeem] = useState('0');
  const [consumerLoyaltyBalance, setConsumerLoyaltyBalance] = useState('1000');

  const simulate = useMutation({
    mutationFn: () =>
      api<PricingBreakdown>('/admin/promotions/simulate', {
        method: 'POST',
        body: {
          cart: {
            consumerStateCode,
            storeStateCode,
            deliveryMethod,
            paymentMethod,
            lines,
          },
          promotionIds,
          ...(couponCode.trim() && { couponCode: couponCode.trim() }),
          ...(voucherCode.trim() && { voucherCode: voucherCode.trim() }),
          pointsToRedeem: Number(pointsToRedeem) || 0,
          consumerLoyaltyBalance: Number(consumerLoyaltyBalance) || 0,
        },
      }),
  });

  // Debounced auto-recompute on every change.
  const inputs = useMemo(
    () => JSON.stringify({
      lines,
      consumerStateCode,
      storeStateCode,
      deliveryMethod,
      paymentMethod,
      promotionIds,
      couponCode,
      voucherCode,
      pointsToRedeem,
      consumerLoyaltyBalance,
    }),
    [
      lines,
      consumerStateCode,
      storeStateCode,
      deliveryMethod,
      paymentMethod,
      promotionIds,
      couponCode,
      voucherCode,
      pointsToRedeem,
      consumerLoyaltyBalance,
    ],
  );
  useEffect(() => {
    const t = setTimeout(() => simulate.mutate(), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputs]);

  return (
    <div>
      <p className="mb-4 max-w-3xl text-[13px] text-ink-3 leading-relaxed">
        Build a hypothetical cart and watch the engine apply promotions, loyalty, taxes, and
        delivery in real time. The output matches what checkout will compute.
      </p>

      <div className="grid gap-12 lg:grid-cols-12">
        <section className="lg:col-span-7 space-y-7">
          <SectionHeading title="Cart" />
          <div className="space-y-3">
            {lines.map((line, i) => (
              <div key={line.lineId} className="grid grid-cols-12 items-end gap-3 border-b border-rule pb-3">
                <div className="col-span-12 sm:col-span-3">
                  <Label hint="any string">Line ID</Label>
                  <Input
                    mono
                    value={line.lineId}
                    onChange={(e) => updateLine(i, { lineId: e.target.value })}
                  />
                </div>
                <div className="col-span-12 sm:col-span-3">
                  <Label hint="any string">Listing ID</Label>
                  <Input
                    mono
                    value={line.listingId}
                    onChange={(e) => updateLine(i, { listingId: e.target.value })}
                  />
                </div>
                <div className="col-span-6 sm:col-span-2">
                  <Label hint="paise">Price</Label>
                  <Input
                    mono
                    type="number"
                    min={1}
                    value={line.unitPricePaise}
                    onChange={(e) => updateLine(i, { unitPricePaise: Number(e.target.value) || 0 })}
                  />
                </div>
                <div className="col-span-3 sm:col-span-1">
                  <Label>Qty</Label>
                  <Input
                    mono
                    type="number"
                    min={1}
                    value={line.qty}
                    onChange={(e) => updateLine(i, { qty: Number(e.target.value) || 1 })}
                  />
                </div>
                <div className="col-span-3 sm:col-span-2">
                  <Label hint="GST %">GST</Label>
                  <Input
                    mono
                    type="number"
                    min={0}
                    max={28}
                    value={line.gstRatePct}
                    onChange={(e) => updateLine(i, { gstRatePct: Number(e.target.value) || 0 })}
                  />
                </div>
                <div className="col-span-12 sm:col-span-1 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    iconLeft={<Trash2 className="size-3.5" />}
                    onClick={() => setLines(lines.filter((_, k) => k !== i))}
                    disabled={lines.length === 1}
                    aria-label="Remove line"
                  >
                    <span className="sr-only">Remove</span>
                  </Button>
                </div>
              </div>
            ))}
            <Button
              variant="outline"
              caps
              size="sm"
              iconLeft={<Plus className="size-3.5" />}
              onClick={() =>
                setLines([
                  ...lines,
                  {
                    lineId: `L${lines.length + 1}`,
                    listingId: 'lst-x',
                    variantId: 'var-x',
                    unitPricePaise: 50000,
                    qty: 1,
                    gstRatePct: 5,
                  },
                ])
              }
            >
              Add line
            </Button>
          </div>

          <SectionHeading title="Order context" />
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label hint="GST">Consumer state</Label>
              <Input mono value={consumerStateCode} onChange={(e) => setConsumerStateCode(e.target.value)} />
            </div>
            <div>
              <Label hint="GST — split by intra/inter-state">Store state</Label>
              <Input mono value={storeStateCode} onChange={(e) => setStoreStateCode(e.target.value)} />
            </div>
            <div>
              <Label>Delivery method</Label>
              <Select value={deliveryMethod} onValueChange={(v) => setDeliveryMethod(v as typeof deliveryMethod)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="express">Express</SelectItem>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="pickup">Pickup</SelectItem>
                  <SelectItem value="try_and_buy">Try-and-Buy</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Payment</Label>
              <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as typeof paymentMethod)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="cod">COD</SelectItem>
                  <SelectItem value="wallet">Wallet</SelectItem>
                  <SelectItem value="gift_card">Gift card</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <SectionHeading title="Promotions to apply" />
          <div>
            <Label hint="Pick one or more to auto-apply">Auto-applied promotions</Label>
            <MultiSelect
              options={promotionOptions}
              value={promotionIds}
              onChange={setPromotionIds}
              placeholder={promotions.isLoading ? 'Loading promotions…' : 'Pick promotions'}
              loading={promotions.isLoading}
            />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label hint="Use the promo's name">Coupon code</Label>
              <Input value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="e.g. WELCOME50" />
            </div>
            <div>
              <Label hint="single-use">Voucher code</Label>
              <Input mono value={voucherCode} onChange={(e) => setVoucherCode(e.target.value.toUpperCase())} placeholder="e.g. ABCDEFGH" />
            </div>
          </div>

          <SectionHeading title="Loyalty redemption" />
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label>Points to redeem</Label>
              <Input mono type="number" min={0} value={pointsToRedeem} onChange={(e) => setPointsToRedeem(e.target.value)} />
            </div>
            <div>
              <Label hint="Override consumer's actual balance">Available balance</Label>
              <Input mono type="number" min={0} value={consumerLoyaltyBalance} onChange={(e) => setConsumerLoyaltyBalance(e.target.value)} />
            </div>
          </div>
        </section>

        <aside className="lg:col-span-5">
          <BreakdownPanel data={simulate.data} loading={simulate.isPending} error={simulate.error} />
        </aside>
      </div>
    </div>
  );

  function updateLine(i: number, patch: Partial<LineState>) {
    setLines((prev) => prev.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  }
}

function BreakdownPanel({
  data,
  loading,
  error,
}: {
  data: PricingBreakdown | undefined;
  loading: boolean;
  error: unknown;
}) {
  return (
    <div className="sticky top-6">
      <div className="border border-ink bg-surface relative">
        <div aria-hidden className="absolute inset-0 translate-x-1.5 translate-y-1.5 bg-ink/85 -z-10" />
        <div className="relative bg-surface p-6 sm:p-7">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 kicker text-ink-3">
              <Receipt className="size-3.5" />
              Breakdown
            </div>
            {loading && <RefreshCw className="size-3.5 animate-spin text-ink-3" />}
          </div>

          {error ? (
            <div className="text-[13px] text-danger border border-danger/40 bg-danger-soft/40 px-3 py-2">
              {error instanceof ApiError ? error.message : 'Engine failed'}
            </div>
          ) : !data ? (
            <p className="text-[13px] text-ink-3 italic">Type a cart to compute…</p>
          ) : (
            <ReceiptTable data={data} />
          )}
        </div>
      </div>
    </div>
  );
}

function ReceiptTable({ data }: { data: PricingBreakdown }) {
  return (
    <div className="font-mono text-[13px] tabular-nums">
      <Row label="Line subtotal" value={formatPaise(data.lineSubtotalPaise)} />
      {data.retailerPromoDiscountPaise > 0 && (
        <Row label="− Retailer offer" value={`− ${formatPaise(data.retailerPromoDiscountPaise)}`} tone="success" />
      )}
      {data.platformPromoDiscountPaise > 0 && (
        <Row label="− Platform offer" value={`− ${formatPaise(data.platformPromoDiscountPaise)}`} tone="success" />
      )}
      {data.couponDiscountPaise > 0 && (
        <Row label="− Coupon" value={`− ${formatPaise(data.couponDiscountPaise)}`} tone="success" />
      )}
      {data.loyaltyDiscountPaise > 0 && (
        <Row
          label={`− Loyalty (${data.loyaltyRedeemedPoints} pts)`}
          value={`− ${formatPaise(data.loyaltyDiscountPaise)}`}
          tone="success"
        />
      )}
      <RowDivider />
      <Row label="Tax base" value={formatPaise(data.taxBasePaise)} />
      {data.cgstPaise > 0 && <Row label="+ CGST" value={`+ ${formatPaise(data.cgstPaise)}`} muted />}
      {data.sgstPaise > 0 && <Row label="+ SGST" value={`+ ${formatPaise(data.sgstPaise)}`} muted />}
      {data.igstPaise > 0 && <Row label="+ IGST" value={`+ ${formatPaise(data.igstPaise)}`} muted />}
      {data.deliveryFeePaise > 0 && (
        <Row label="+ Delivery" value={`+ ${formatPaise(data.deliveryFeePaise)}`} muted />
      )}
      {data.shippingSubsidyPaise > 0 && (
        <Row
          label="− Shipping subsidy"
          value={`− ${formatPaise(data.shippingSubsidyPaise)}`}
          tone="success"
        />
      )}
      {data.handlingFeePaise > 0 && <Row label="+ Handling" value={`+ ${formatPaise(data.handlingFeePaise)}`} muted />}
      {data.convenienceFeePaise > 0 && <Row label="+ Convenience" value={`+ ${formatPaise(data.convenienceFeePaise)}`} muted />}
      <RowDivider thick />
      <div className="flex items-baseline justify-between py-3">
        <span className="font-display italic text-[20px] not-italic text-ink-3 kicker">Total</span>
        <span className="font-display italic text-[36px] text-ink leading-none">
          {formatPaise(data.totalPaise)}
        </span>
      </div>
      {data.tcsPaise > 0 && (
        <p className="text-[10.5px] uppercase tracking-[0.16em] text-ink-3">
          + TCS {formatPaise(data.tcsPaise)} withheld from retailer payout
        </p>
      )}
      {data.loyaltyEarnedPoints > 0 && (
        <p className="mt-3 border-t border-rule pt-3 text-[12px] text-ink-2">
          Consumer would earn{' '}
          <strong className="text-ink">{data.loyaltyEarnedPoints} pts</strong> at delivery.
        </p>
      )}
      {data.appliedPromotions.length > 0 && (
        <div className="mt-3 border-t border-rule pt-3 space-y-1">
          <div className="kicker text-ink-3 mb-1">Applied</div>
          {data.appliedPromotions.map((p) => (
            <div key={p.promotionId} className="text-[11.5px] text-ink-2">
              · {p.mechanism} → {formatPaise(p.amountPaise)}
              <span className="text-ink-4 ml-1 font-mono">{p.promotionId.slice(0, 12)}…</span>
            </div>
          ))}
        </div>
      )}
      {data.excludedPromotions.length > 0 && (
        <div className="mt-3 border-t border-rule pt-3 space-y-1">
          <div className="kicker text-ink-3 mb-1">Skipped</div>
          {data.excludedPromotions.map((p) => (
            <div key={p.promotionId} className="text-[11.5px] text-danger">
              · <span className="font-mono">{p.promotionId.slice(0, 12)}…</span> — {p.reason}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  tone,
  muted,
}: {
  label: string;
  value: string;
  tone?: 'success';
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between py-1.5">
      <span className={muted ? 'text-ink-3' : 'text-ink-2'}>{label}</span>
      <span className={tone === 'success' ? 'text-success' : muted ? 'text-ink-3' : 'text-ink'}>
        {value}
      </span>
    </div>
  );
}
function RowDivider({ thick }: { thick?: boolean }) {
  return <hr className={`my-1 border-t ${thick ? 'border-ink' : 'border-rule'}`} />;
}
