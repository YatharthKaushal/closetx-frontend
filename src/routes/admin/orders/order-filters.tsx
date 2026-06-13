import { type ReactNode } from 'react';
import {
  Activity,
  Clock,
  CreditCard,
  type LucideIcon,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Store,
  Truck,
  Wallet,
  X,
} from 'lucide-react';
import type { OrderStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StoreCombobox } from '@/components/ui/store-combobox';

// ── Option lists (shared filter source for the orders list) ──

export const STATUS_OPTIONS: ReadonlyArray<{ value: OrderStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'routing', label: 'Routing (needs accept)' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'packed', label: 'Packed' },
  { value: 'picked_up', label: 'Picked up' },
  { value: 'out_for_delivery', label: 'Out for delivery' },
  { value: 'undelivered', label: 'Undelivered' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'closed', label: 'Closed' },
  { value: 'payment_failed', label: 'Payment failed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const PAYMENT_METHOD_OPTIONS = [
  { value: 'all', label: 'Any payment method' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'cod', label: 'Cash on delivery' },
  { value: 'wallet', label: 'Wallet' },
  { value: 'gift_card', label: 'Gift card' },
] as const;

export const DELIVERY_METHOD_OPTIONS = [
  { value: 'all', label: 'Any delivery method' },
  { value: 'express', label: 'Express' },
  { value: 'standard', label: 'Standard' },
  { value: 'pickup', label: 'Pickup' },
  { value: 'try_and_buy', label: 'Try and buy' },
] as const;

export const AGE_OPTIONS = [
  { value: 'all', label: 'Any age' },
  { value: '1', label: 'Older than 1h' },
  { value: '6', label: 'Older than 6h' },
  { value: '24', label: 'Older than 24h' },
  { value: '168', label: 'Older than a week' },
] as const;

export const PAYMENT_STATE_OPTIONS = [
  { value: 'all', label: 'Any payment state' },
  { value: 'paid', label: 'Paid' },
  { value: 'unpaid', label: 'Pending' },
  { value: 'failed', label: 'Failed' },
] as const;

export const DISPUTE_OPTIONS = [
  { value: 'all', label: 'Any dispute state' },
  { value: 'open', label: 'Open disputes' },
  { value: 'none', label: 'No disputes' },
] as const;

type Opt = { value: string; label: string };

type FacetKey =
  | 'status'
  | 'paymentMethod'
  | 'deliveryMethod'
  | 'ageHours'
  | 'paymentState'
  | 'disputeFlag';

/** The six constant-option facets. Retailer is special (searchable, dynamic). */
const FACETS: { key: FacetKey; label: string; icon: LucideIcon; options: ReadonlyArray<Opt> }[] = [
  { key: 'status', label: 'Status', icon: Activity, options: STATUS_OPTIONS },
  { key: 'paymentMethod', label: 'Payment method', icon: CreditCard, options: PAYMENT_METHOD_OPTIONS },
  { key: 'deliveryMethod', label: 'Delivery method', icon: Truck, options: DELIVERY_METHOD_OPTIONS },
  { key: 'ageHours', label: 'Order age', icon: Clock, options: AGE_OPTIONS },
  { key: 'paymentState', label: 'Payment state', icon: Wallet, options: PAYMENT_STATE_OPTIONS },
  { key: 'disputeFlag', label: 'Dispute state', icon: ShieldAlert, options: DISPUTE_OPTIONS },
];

export type OrderFilterValues = Record<FacetKey | 'storeId', string>;

export type FiltersProps = {
  values: OrderFilterValues;
  setParam: (key: string, value: string) => void;
  clearAll: () => void;
  q: string;
  setQ: (v: string) => void;
  resultLabel: ReactNode;
};

const RETAILER_EXTRA = [{ value: 'all', label: 'Any retailer' }];

function countActive(values: OrderFilterValues): number {
  let n = values.storeId !== 'all' ? 1 : 0;
  for (const f of FACETS) if (values[f.key] !== 'all') n += 1;
  return n;
}

/**
 * Orders filter bar: a prominent search + a "Filters (n)" button that opens a
 * right-side sheet holding every facet. Filters apply live (each change writes
 * straight to the URL via setParam), so the sheet is a focused workspace rather
 * than a staged form — "Done" just closes it.
 */
export function FiltersSheet({ values, setParam, clearAll, q, setQ, resultLabel }: FiltersProps) {
  const n = countActive(values);
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 items-center gap-2">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-3" />
          <Input
            placeholder="Search id, customer, or store…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="!pl-9"
          />
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" iconLeft={<SlidersHorizontal className="size-3.5" />}>
              Filters
              {n > 0 && (
                <span className="ml-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-ink px-1 text-[10px] font-mono text-bg">
                  {n}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-96">
            <SheetHeader className="flex items-center justify-between">
              <span className="text-[15px] font-semibold text-ink">Filters</span>
              <SheetClose className="rounded-md p-1 text-ink-3 hover:bg-bg-2 hover:text-ink">
                <X className="size-4" />
              </SheetClose>
            </SheetHeader>
            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              <SheetField label="Retailer" icon={Store}>
                <StoreCombobox
                  value={values.storeId}
                  onChange={(v) => setParam('storeId', v)}
                  extraOptions={RETAILER_EXTRA}
                  placeholder="Any retailer"
                />
              </SheetField>
              {FACETS.map((f) => (
                <SheetField key={f.key} label={f.label} icon={f.icon}>
                  <Select value={values[f.key]} onValueChange={(v) => setParam(f.key, v)}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {f.options.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </SheetField>
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-line px-5 py-3">
              <button
                type="button"
                onClick={clearAll}
                className="text-[12.5px] text-ink-3 hover:text-ink"
              >
                Clear all
              </button>
              <SheetClose asChild>
                <Button variant="ink" size="sm">Done</Button>
              </SheetClose>
            </div>
          </SheetContent>
        </Sheet>
      </div>
      <span className="hidden shrink-0 sm:inline text-[12px] text-ink-3">{resultLabel}</span>
    </div>
  );
}

function SheetField({ label, icon: Icon, children }: { label: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-medium text-ink-2">
        <Icon className="size-3.5 text-ink-3" />
        {label}
      </div>
      {children}
    </div>
  );
}
