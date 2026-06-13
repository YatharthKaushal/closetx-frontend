import { create } from 'zustand';
import type { CartLine, PosCustomer, PosLookupRow, PricingMode, Tender } from './pos-types';

/**
 * The draft counter-bill. Long-lived client UI state mutated by many sibling components
 * (scan input, line rows, totals, payment panel, hotkeys), so it lives in a dedicated
 * Zustand store rather than component state or React Query. Totals are NOT computed here —
 * a server /quote call is the source of truth (see useQuote).
 */
type PosCartState = {
  lines: CartLine[];
  billDiscountPaise: number;
  customer: PosCustomer;
  tenders: Tender[];
  pricingMode: PricingMode;
  /** Set when the cart was resumed from a parked bill, so completion finalises that row. */
  heldSaleId: string | null;
  /** Bumped on reset so a fresh idempotency key is generated per bill. */
  billNonce: number;

  addRow: (row: PosLookupRow) => void;
  setQty: (variantId: string, qty: number) => void;
  setLineDiscount: (variantId: string, paise: number) => void;
  removeLine: (variantId: string) => void;
  setBillDiscount: (paise: number) => void;
  setCustomer: (c: PosCustomer) => void;
  setTenders: (t: Tender[]) => void;
  setPricingMode: (m: PricingMode) => void;
  loadFromHeld: (heldSaleId: string, lines: CartLine[], customer: PosCustomer, billDiscountPaise: number) => void;
  reset: () => void;
  isEmpty: () => boolean;
};

export const usePosCart = create<PosCartState>((set, get) => ({
  lines: [],
  billDiscountPaise: 0,
  customer: {},
  tenders: [],
  pricingMode: 'tax_inclusive',
  heldSaleId: null,
  billNonce: 1,

  addRow: (row) =>
    set((s) => {
      const existing = s.lines.find((l) => l.variantId === row.variantId);
      if (existing) {
        return {
          lines: s.lines.map((l) =>
            l.variantId === row.variantId ? { ...l, qty: l.qty + 1 } : l,
          ),
        };
      }
      const line: CartLine = {
        variantId: row.variantId,
        listingId: row.listingId,
        name: row.name,
        brand: row.brand,
        attributesLabel: row.attributesLabel,
        sku: row.sku,
        unitMrpPaise: row.pricePaise,
        qty: 1,
        lineDiscountPaise: 0,
        availableQty: row.availableQty,
      };
      return { lines: [...s.lines, line] };
    }),

  setQty: (variantId, qty) =>
    set((s) => ({
      lines: s.lines.flatMap((l) =>
        l.variantId === variantId ? (qty <= 0 ? [] : [{ ...l, qty }]) : [l],
      ),
    })),

  setLineDiscount: (variantId, paise) =>
    set((s) => ({
      lines: s.lines.map((l) =>
        l.variantId === variantId ? { ...l, lineDiscountPaise: Math.max(0, paise) } : l,
      ),
    })),

  removeLine: (variantId) =>
    set((s) => ({ lines: s.lines.filter((l) => l.variantId !== variantId) })),

  setBillDiscount: (paise) => set({ billDiscountPaise: Math.max(0, paise) }),
  setCustomer: (customer) => set({ customer }),
  setTenders: (tenders) => set({ tenders }),
  setPricingMode: (pricingMode) => set({ pricingMode }),

  loadFromHeld: (heldSaleId, lines, customer, billDiscountPaise) =>
    set({ heldSaleId, lines, customer, billDiscountPaise, tenders: [] }),

  reset: () =>
    set((s) => ({
      lines: [],
      billDiscountPaise: 0,
      customer: {},
      tenders: [],
      heldSaleId: null,
      billNonce: s.billNonce + 1,
    })),

  isEmpty: () => get().lines.length === 0,
}));
