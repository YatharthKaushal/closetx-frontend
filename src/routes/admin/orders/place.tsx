import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Minus, Plus, Sparkles, Trash2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { formatPaise } from '@/lib/status';
import type {
  AdminRetailerView,
  ConsumerSummary,
  PlaceOrderResult,
  Store,
  TestConsumerCreated,
  Variant,
  Listing,
} from '@/lib/types';

type AdminAddress = {
  id: string;
  consumerId: string;
  label: string | null;
  line1: string;
  line2: string | null;
  city: string;
  pincode: string;
  stateCode: string;
  isDefault: boolean;
};
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { CopyableId } from '@/components/ui/copyable-id';
import { MockDataBadge } from '@/components/ui/mock-data-badge';
import { RoleGate } from '@/components/shell/RoleGate';

type AdminStore = Store & { id: string };
type CartLine = { variantId: string; qty: number };

export function PlaceTestOrderPanel() {
  // Dev-only QA tool — gated behind super-admin sub-role + import.meta.env.DEV
  // so production admin sessions cannot accidentally place test orders against
  // real consumer data.
  return (
    <RoleGate kind="admin" subRole="super_admin">
      {import.meta.env.DEV ? <PlaceTestOrderInner /> : <DevOnlyBlock />}
    </RoleGate>
  );
}

function DevOnlyBlock() {
  return (
    <div>
      <div className="mb-4 flex justify-end"><MockDataBadge label="DEV-ONLY" /></div>
      <Card>
        <CardContent className="p-6 text-[13px] text-ink-3">
          Production admins should not place orders against live consumer data. Spin up the dashboard
          with `npm run dev` to use this tool.
        </CardContent>
      </Card>
    </div>
  );
}

function PlaceTestOrderInner() {
  const navigate = useNavigate();
  const [storeId, setStoreId] = useState<string>('');
  const [consumerId, setConsumerId] = useState<string>('');
  const [addressId, setAddressId] = useState<string>('');
  const [consumerName, setConsumerName] = useState<string>('');
  const [items, setItems] = useState<CartLine[]>([]);
  const [deliveryMethod, setDeliveryMethod] = useState<'standard' | 'express' | 'pickup' | 'try_and_buy'>('standard');
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'card' | 'cod' | 'wallet'>('upi');
  useEffect(() => {
    if (deliveryMethod === 'try_and_buy' && paymentMethod === 'cod') setPaymentMethod('upi');
  }, [deliveryMethod, paymentMethod]);
  const [paymentOutcome, setPaymentOutcome] = useState<'succeeded' | 'failed' | 'pending'>('succeeded');
  const [couponCode, setCouponCode] = useState<string>('');

  const stores = useQuery({
    queryKey: ['admin', 'stores', 'active-for-orders'],
    queryFn: () => api<AdminStore[]>('/admin/stores'),
  });
  const activeStores = (stores.data ?? []).filter((s) => s.status === 'active');

  // Fetch retailer accounts so we have a way to look at owners; not strictly needed
  // for placement but useful when seeding data.
  void useQuery<AdminRetailerView[]>({
    queryKey: ['admin', 'retailers', 'all'],
    queryFn: () => api<AdminRetailerView[]>('/admin/retailers'),
  });

  // Catalog for the chosen store. Backend admin endpoint returns listings + variants.
  const catalog = useQuery({
    queryKey: ['admin', 'place-order', 'catalog', storeId],
    queryFn: () => api<Listing[]>(`/admin/stores/${storeId}/catalog`),
    enabled: !!storeId,
  });

  // Existing consumers — searchable picker for the dev tool.
  const consumerList = useQuery({
    queryKey: ['admin', 'consumers', 'place-order'],
    queryFn: () => api<ConsumerSummary[]>('/admin/consumers?limit=200'),
  });
  // Addresses for the selected consumer.
  const addressList = useQuery({
    queryKey: ['admin', 'consumers', consumerId, 'addresses'],
    queryFn: () => api<AdminAddress[]>(`/admin/consumers/${consumerId}/addresses`),
    enabled: Boolean(consumerId),
  });

  // Mint test consumer mutation.
  const mint = useMutation({
    mutationFn: () =>
      api<TestConsumerCreated>('/admin/consumers/test', {
        method: 'POST',
        body: { storeId },
      }),
    onSuccess: (r) => {
      setConsumerId(r.consumer.id);
      setConsumerName(r.consumer.name);
      setAddressId(r.addressId);
      toast.success(`Minted ${r.consumer.name}`);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not mint consumer'),
  });

  const place = useMutation({
    mutationFn: () =>
      api<PlaceOrderResult>('/admin/test-orders', {
        method: 'POST',
        body: {
          storeId,
          consumerId,
          addressId: deliveryMethod === 'pickup' ? undefined : addressId || undefined,
          items,
          deliveryMethod,
          paymentMethod,
          paymentOutcome,
          ...(couponCode.trim() && { couponCode: couponCode.trim() }),
        },
      }),
    onSuccess: (r) => {
      toast.success(`Order placed · status ${r.status}`);
      navigate(`/admin/orders/${r.orderId}`);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Place order failed'),
  });

  // Flatten variants for picker.
  const variantOptions = useMemo(() => {
    const out: Array<{ variantId: string; listingName: string; attrs: string; price: number; available: number }> = [];
    for (const l of catalog.data ?? []) {
      for (const v of (l.variants ?? []) as Variant[]) {
        out.push({
          variantId: v.id,
          listingName: l.name,
          attrs: v.attributesLabel,
          price: v.pricePaise,
          available: v.stock - v.reserved,
        });
      }
    }
    return out;
  }, [catalog.data]);

  const itemsSubtotal = items.reduce((s, it) => {
    const v = variantOptions.find((vo) => vo.variantId === it.variantId);
    return s + (v ? v.price * it.qty : 0);
  }, 0);

  const canSubmit =
    !!storeId && !!consumerId && items.length > 0 && (deliveryMethod === 'pickup' || !!addressId);

  function addItem(variantId: string) {
    setItems((curr) => {
      const existing = curr.find((c) => c.variantId === variantId);
      if (existing) {
        return curr.map((c) => (c.variantId === variantId ? { ...c, qty: c.qty + 1 } : c));
      }
      return [...curr, { variantId, qty: 1 }];
    });
  }

  function setQty(variantId: string, qty: number) {
    if (qty <= 0) {
      setItems((curr) => curr.filter((c) => c.variantId !== variantId));
      return;
    }
    setItems((curr) => curr.map((c) => (c.variantId === variantId ? { ...c, qty } : c)));
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-[13px] text-ink-3 leading-relaxed">
          Walk an order through the lifecycle without a real consumer or payment gateway. Mint a
          synthetic customer, pick a store + items, choose how the payment should resolve.
        </p>
        <MockDataBadge label="DEV-ONLY" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left column: setup steps */}
        <div className="lg:col-span-2 space-y-4">
          {/* Step 1 — store */}
          <Card>
            <CardHeader><CardTitle>1 · Store</CardTitle></CardHeader>
            <CardContent>
              {stores.isLoading ? (
                <Skeleton className="h-9" />
              ) : (
                <Select value={storeId} onValueChange={(v) => { setStoreId(v); setItems([]); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an active store…" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeStores.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.legalName} · {s.stateCode}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {storeId && (
                <p className="mt-2 text-[12px] text-ink-3 flex items-center gap-2">
                  Store id: <CopyableId value={storeId} label="store id" />
                </p>
              )}
            </CardContent>
          </Card>

          {/* Step 2 — consumer */}
          <Card>
            <CardHeader>
              <CardTitle>2 · Customer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  iconLeft={<UserPlus className="size-3.5" />}
                  onClick={() => mint.mutate()}
                  disabled={!storeId}
                  loading={mint.isPending}
                >
                  Mint test consumer
                </Button>
                <span className="text-[12px] text-ink-3">
                  {storeId ? 'Creates a synthetic consumer + default address.' : 'Pick a store first.'}
                </span>
              </div>
              {consumerId && (
                <div className="rounded-md border border-line bg-bg-2/50 p-3 text-[12.5px]">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-medium text-ink">{consumerName}</div>
                      <div className="text-ink-3 mt-0.5">addressId: {addressId || '—'}</div>
                    </div>
                    <CopyableId value={consumerId} label="consumer id" />
                  </div>
                </div>
              )}
              <div>
                <Label htmlFor="cid">Or pick an existing consumer</Label>
                <Select
                  value={consumerId}
                  onValueChange={(v) => {
                    setConsumerId(v);
                    const c = (consumerList.data ?? []).find((x) => x.id === v);
                    setConsumerName(c?.name ?? '');
                    setAddressId('');
                  }}
                  disabled={consumerList.isLoading}
                >
                  <SelectTrigger id="cid">
                    <SelectValue placeholder={consumerList.isLoading ? 'Loading consumers…' : 'Pick a consumer'} />
                  </SelectTrigger>
                  <SelectContent>
                    {(consumerList.data ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="font-medium">{c.name || c.email}</span>
                        <span className="ml-2 font-mono text-[11px] text-ink-3">{c.email}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {deliveryMethod !== 'pickup' && (
                <div>
                  <Label htmlFor="aid">Address</Label>
                  <Select
                    value={addressId}
                    onValueChange={setAddressId}
                    disabled={!consumerId || addressList.isLoading}
                  >
                    <SelectTrigger id="aid">
                      <SelectValue placeholder={!consumerId ? 'Pick a consumer first' : addressList.isLoading ? 'Loading…' : (addressList.data ?? []).length === 0 ? 'No addresses on file' : 'Pick an address'} />
                    </SelectTrigger>
                    <SelectContent>
                      {(addressList.data ?? []).map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          <span className="font-medium">{a.label ?? 'Address'}</span>
                          <span className="ml-2 text-[11.5px] text-ink-3">{a.line1}, {a.city} {a.pincode}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 3 — items */}
          <Card>
            <CardHeader><CardTitle>3 · Items</CardTitle></CardHeader>
            <CardContent>
              {!storeId ? (
                <p className="text-[12.5px] text-ink-3">Pick a store to load its catalogue.</p>
              ) : catalog.isLoading ? (
                <Skeleton className="h-32" />
              ) : variantOptions.length === 0 ? (
                <p className="text-[12.5px] text-ink-3">This store has no published variants. Add one from the retailer side first.</p>
              ) : (
                <>
                  <div className="rounded-md border border-line max-h-72 overflow-auto divide-y divide-line">
                    {variantOptions.map((v) => {
                      const inCart = items.find((it) => it.variantId === v.variantId);
                      return (
                        <div key={v.variantId} className="flex items-center justify-between gap-3 px-3 py-2">
                          <div className="min-w-0">
                            <div className="text-[13px] font-medium text-ink truncate">{v.listingName}</div>
                            <div className="text-[11.5px] text-ink-3 mt-0.5">
                              {v.attrs} · {v.available} in stock
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono text-[12.5px] text-ink tabular-nums">{formatPaise(v.price)}</span>
                            {inCart ? (
                              <div className="inline-flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => setQty(v.variantId, inCart.qty - 1)}
                                ><Minus className="size-3" /></Button>
                                <span className="w-6 text-center font-mono text-[13px]">{inCart.qty}</span>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => setQty(v.variantId, inCart.qty + 1)}
                                  disabled={inCart.qty >= v.available}
                                ><Plus className="size-3" /></Button>
                              </div>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => addItem(v.variantId)}
                                disabled={v.available <= 0}
                              >Add</Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {items.length > 0 && (
                    <div className="mt-3 flex items-center justify-between text-[13px]">
                      <span className="text-ink-3">{items.reduce((s, i) => s + i.qty, 0)} item(s) in cart</span>
                      <span className="font-mono tabular-nums text-ink">{formatPaise(itemsSubtotal)}</span>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Step 4 — fulfilment + payment */}
          <Card>
            <CardHeader><CardTitle>4 · Fulfilment & payment</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <RadioRow
                label="Delivery method"
                value={deliveryMethod}
                options={[
                  ['standard', 'Standard'],
                  ['express', 'Express'],
                  ['try_and_buy', 'Try & buy'],
                  ['pickup', 'Pickup'],
                ]}
                onChange={(v) => setDeliveryMethod(v as typeof deliveryMethod)}
              />
              <RadioRow
                label="Payment method"
                value={paymentMethod}
                options={
                  deliveryMethod === 'try_and_buy'
                    ? [
                        ['upi', 'UPI'],
                        ['card', 'Card'],
                        ['wallet', 'Wallet'],
                      ]
                    : [
                        ['upi', 'UPI'],
                        ['card', 'Card'],
                        ['cod', 'Cash on delivery'],
                        ['wallet', 'Wallet'],
                      ]
                }
                onChange={(v) => setPaymentMethod(v as typeof paymentMethod)}
              />
              {deliveryMethod === 'try_and_buy' && (
                <p className="text-[12px] text-ink-3">Try-and-Buy is prepaid only — COD is not available.</p>
              )}
              <RadioRow
                label="Payment outcome (test)"
                value={paymentOutcome}
                options={[
                  ['succeeded', 'Succeeded → routing'],
                  ['failed', 'Failed → payment_failed'],
                  ['pending', 'Pending (no transition)'],
                ]}
                onChange={(v) => setPaymentOutcome(v as typeof paymentOutcome)}
              />
              <div>
                <Label htmlFor="coupon">Coupon code (optional)</Label>
                <Input
                  id="coupon"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder="e.g. WELCOME50"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column: review + place */}
        <div className="space-y-4">
          <Card className="accent-strip relative">
            <CardHeader>
              <CardTitle>Review</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-[13px]">
              <Row k="Store" v={activeStores.find((s) => s.id === storeId)?.legalName ?? '—'} />
              <Row k="Customer" v={consumerName || '—'} />
              <Row k="Items" v={`${items.reduce((s, i) => s + i.qty, 0)}`} />
              <Row k="Subtotal" v={<span className="font-mono tabular-nums">{formatPaise(itemsSubtotal)}</span>} />
              <Row k="Delivery" v={deliveryMethod} />
              <Row k="Payment" v={`${paymentMethod} → ${paymentOutcome}`} />
              {couponCode && <Row k="Coupon" v={couponCode} />}
              <hr className="border-line my-2" />
              <Button
                variant="accent"
                className="w-full"
                disabled={!canSubmit}
                loading={place.isPending}
                onClick={() => place.mutate()}
                iconLeft={<Sparkles className="size-4" />}
              >
                Place test order
              </Button>
              {!canSubmit && (
                <p className="text-[11.5px] text-ink-3">
                  Pick store, customer, at least one item, and address (unless pickup).
                </p>
              )}
            </CardContent>
          </Card>

          {items.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Cart</CardTitle></CardHeader>
              <CardContent>
                <ul className="divide-y divide-line text-[12.5px]">
                  {items.map((it) => {
                    const v = variantOptions.find((vo) => vo.variantId === it.variantId);
                    return (
                      <li key={it.variantId} className="flex items-center justify-between gap-2 py-2">
                        <div className="min-w-0">
                          <div className="truncate text-ink">{v?.listingName ?? it.variantId}</div>
                          <div className="text-[11.5px] text-ink-3">{v?.attrs} × {it.qty}</div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono tabular-nums">{formatPaise((v?.price ?? 0) * it.qty)}</span>
                          <Button variant="ghost" size="icon-sm" onClick={() => setQty(it.variantId, 0)}>
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function RadioRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: ReadonlyArray<readonly [string, string]>;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {options.map(([v, l]) => {
          const active = value === v;
          return (
            <button
              key={v}
              type="button"
              onClick={() => onChange(v)}
              className={
                'rounded-md border px-3 py-1.5 text-[12.5px] transition-colors ' +
                (active
                  ? 'border-accent bg-accent-soft text-accent'
                  : 'border-line bg-bg text-ink-2 hover:border-line-2 hover:text-ink')
              }
            >
              {l}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-ink-3">{k}</span>
      <span className="text-ink text-right truncate">{v}</span>
    </div>
  );
}
