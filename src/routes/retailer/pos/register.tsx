import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Minus, Plus, ScanLine, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { formatPaise } from '@/lib/status';
import { usePosCart } from '@/lib/pos-cart-store';
import type { PosLookupResult, PosQuote, PosSaleResult, Tender, TenderMethod } from '@/lib/pos-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Empty } from '@/components/ui/empty';

const TENDERS: { value: TenderMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'upi', label: 'UPI' },
];

export default function PosRegister() {
  const cart = usePosCart();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const scanRef = useRef<HTMLInputElement>(null);
  const [scanValue, setScanValue] = useState('');
  const [searchResults, setSearchResults] = useState<PosLookupResult['results']>([]);
  const [result, setResult] = useState<PosSaleResult | null>(null);

  // Stable idempotency key per bill — regenerated on reset via billNonce.
  const idempotencyKey = useMemo(
    () => `possale-${cart.billNonce}-${crypto.randomUUID()}`,
    [cart.billNonce],
  );

  // ── Server-authoritative quote ──
  const quoteBody = useMemo(
    () => ({
      lines: cart.lines.map((l) => ({
        variantId: l.variantId,
        qty: l.qty,
        lineDiscountPaise: l.lineDiscountPaise,
      })),
      billDiscountPaise: cart.billDiscountPaise,
      pricingMode: cart.pricingMode,
    }),
    [cart.lines, cart.billDiscountPaise, cart.pricingMode],
  );
  const { data: quote, isFetching: quoting } = useQuery({
    queryKey: ['retailer', 'pos', 'quote', quoteBody],
    queryFn: () => api<PosQuote>('/retailer/pos/quote', { method: 'POST', body: quoteBody }),
    enabled: cart.lines.length > 0,
    staleTime: 0,
    placeholderData: (prev) => prev,
  });

  const payable = quote?.payablePaise ?? 0;

  // ── Scan / search ──
  async function handleScan(code: string) {
    const q = code.trim();
    if (!q) return;
    try {
      const res = await api<PosLookupResult>(`/retailer/pos/lookup?q=${encodeURIComponent(q)}`);
      if (res.exact) {
        cart.addRow(res.exact);
        setScanValue('');
        setSearchResults([]);
        scanRef.current?.focus();
      } else if (res.results.length === 1 && res.results[0]) {
        cart.addRow(res.results[0]);
        setScanValue('');
        setSearchResults([]);
      } else if (res.results.length === 0) {
        toast.error(`No product for "${q}"`);
        scanRef.current?.select();
      } else {
        setSearchResults(res.results);
      }
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Lookup failed');
    }
  }

  // Live search-as-you-type (debounced), separate from the Enter/scan path.
  useEffect(() => {
    const q = scanValue.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await api<PosLookupResult>(`/retailer/pos/lookup?q=${encodeURIComponent(q)}`);
        setSearchResults(res.exact ? [res.exact] : res.results);
      } catch {
        /* ignore transient search errors */
      }
    }, 220);
    return () => clearTimeout(t);
  }, [scanValue]);

  // ── Tenders ──
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [tenderMethod, setTenderMethod] = useState<TenderMethod>('cash');
  const [cashGiven, setCashGiven] = useState('');
  const tenderedTotal = tenders.reduce((s, t) => s + t.amountPaise, 0);
  const remaining = payable - tenderedTotal;

  function addTender(full: boolean) {
    const amt = full ? remaining : Math.min(remaining, Math.round(Number(cashGiven || '0') * 100));
    if (amt <= 0) return;
    const tendered = tenderMethod === 'cash' && cashGiven ? Math.round(Number(cashGiven) * 100) : amt;
    setTenders((prev) => [...prev, { method: tenderMethod, amountPaise: amt, tenderedPaise: tendered }]);
    setCashGiven('');
  }
  const changeDue = Math.max(
    0,
    tenders.reduce((s, t) => s + ((t.tenderedPaise ?? t.amountPaise) - t.amountPaise), 0),
  );

  // ── Mutations ──
  const complete = useMutation({
    mutationFn: () =>
      api<PosSaleResult>('/retailer/pos/sales', {
        method: 'POST',
        body: {
          idempotencyKey,
          ...(cart.heldSaleId && { holdSaleId: cart.heldSaleId }),
          customer: cart.customer,
          pricingMode: cart.pricingMode,
          billDiscountPaise: cart.billDiscountPaise,
          lines: quoteBody.lines,
          tenders,
        },
      }),
    onSuccess: (res) => {
      setResult(res);
      setTenders([]);
      qc.invalidateQueries({ queryKey: ['retailer', 'pos', 'sales'] });
      qc.invalidateQueries({ queryKey: ['retailer', 'pos', 'day-summary'] });
      qc.invalidateQueries({ queryKey: ['retailer', 'inventory'] });
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'order_stock_unavailable') {
        toast.error('Stock changed — re-check item availability.');
        qc.invalidateQueries({ queryKey: ['retailer', 'pos', 'quote'] });
      } else {
        toast.error(e instanceof ApiError ? e.message : 'Could not complete sale');
      }
    },
  });

  const hold = useMutation({
    mutationFn: () =>
      api<{ saleId: string }>('/retailer/pos/sales/hold', {
        method: 'POST',
        body: {
          idempotencyKey,
          customer: cart.customer,
          pricingMode: cart.pricingMode,
          billDiscountPaise: cart.billDiscountPaise,
          lines: quoteBody.lines,
        },
      }),
    onSuccess: () => {
      toast.success('Bill held');
      cart.reset();
      setTenders([]);
      qc.invalidateQueries({ queryKey: ['retailer', 'pos', 'held'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not hold bill'),
  });

  function newSale() {
    setResult(null);
    cart.reset();
    setTenders([]);
    scanRef.current?.focus();
  }

  // Hotkeys: F9 complete, F7 hold, Esc clear scan.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (result) return;
      if (e.key === 'F9' && quote && remaining === 0 && tenders.length > 0) {
        e.preventDefault();
        complete.mutate();
      } else if (e.key === 'F7' && cart.lines.length > 0) {
        e.preventDefault();
        hold.mutate();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const offline = typeof navigator !== 'undefined' && !navigator.onLine;
  const canComplete = !offline && cart.lines.length > 0 && payable > 0 && remaining === 0 && tenders.length > 0;

  return (
    <div className="grid gap-4 p-4 lg:grid-cols-[1fr_400px]">
      {/* Left: scan + cart */}
      <div className="flex min-h-0 flex-col gap-3">
        <div className="relative">
          <ScanLine className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-4" />
          <Input
            ref={scanRef}
            autoFocus
            value={scanValue}
            placeholder="Scan barcode or search by name / SKU…"
            className="pl-9"
            onChange={(e) => setScanValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleScan(scanValue);
              }
            }}
          />
          {searchResults.length > 0 && (
            <div className="absolute z-10 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-line bg-bg shadow-lg">
              {searchResults.map((r) => (
                <button
                  key={r.variantId}
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[13px] hover:bg-bg-2"
                  onClick={() => {
                    cart.addRow(r);
                    setScanValue('');
                    setSearchResults([]);
                    scanRef.current?.focus();
                  }}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink">{r.name}</span>
                    <span className="block truncate text-[11px] text-ink-4">
                      {r.attributesLabel}
                      {r.sku ? ` · ${r.sku}` : ''} · {r.availableQty} in stock
                    </span>
                  </span>
                  <span className="shrink-0 font-medium">{formatPaise(r.pricePaise)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-line bg-bg">
          {cart.lines.length === 0 ? (
            <Empty title="Scan to start" description="Scan a barcode or search to add items to the bill." />
          ) : (
            <table className="w-full text-[13px]">
              <thead className="sticky top-0 bg-bg-2 text-[11px] uppercase text-ink-4">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Item</th>
                  <th className="px-2 py-2 text-center font-medium">Qty</th>
                  <th className="px-2 py-2 text-right font-medium">Price</th>
                  <th className="px-2 py-2 text-right font-medium">Disc</th>
                  <th className="px-3 py-2 text-right font-medium">Total</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {cart.lines.map((l) => {
                  const lineTotal = l.unitMrpPaise * l.qty - l.lineDiscountPaise;
                  const over = l.qty > l.availableQty;
                  return (
                    <tr key={l.variantId} className="border-t border-line">
                      <td className="px-3 py-2">
                        <div className="font-medium text-ink">{l.name}</div>
                        <div className="text-[11px] text-ink-4">
                          {l.attributesLabel}
                          {l.sku ? ` · ${l.sku}` : ''}
                          {over && <span className="ml-1 text-danger">· only {l.availableQty} left</span>}
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="outline" size="icon-sm" onClick={() => cart.setQty(l.variantId, l.qty - 1)}>
                            <Minus className="size-3" />
                          </Button>
                          <span className="w-6 text-center tabular-nums">{l.qty}</span>
                          <Button variant="outline" size="icon-sm" onClick={() => cart.setQty(l.variantId, l.qty + 1)}>
                            <Plus className="size-3" />
                          </Button>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{formatPaise(l.unitMrpPaise)}</td>
                      <td className="px-2 py-2 text-right">
                        <input
                          className="w-16 rounded border border-line bg-bg px-1.5 py-1 text-right text-[12px] tabular-nums"
                          value={l.lineDiscountPaise ? (l.lineDiscountPaise / 100).toString() : ''}
                          placeholder="0"
                          onChange={(e) =>
                            cart.setLineDiscount(l.variantId, Math.round(Number(e.target.value || '0') * 100))
                          }
                        />
                      </td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">{formatPaise(lineTotal)}</td>
                      <td className="pr-2">
                        <Button variant="ghost" size="icon-sm" onClick={() => cart.removeLine(l.variantId)}>
                          <Trash2 className="size-3.5 text-ink-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Right rail: customer + totals + payment */}
      <div className="flex flex-col gap-3">
        <CustomerCard />

        <div className="rounded-xl border border-line bg-bg p-4">
          <div className="space-y-1.5 text-[13px]">
            <Row label="Items" value={formatPaise(quote?.itemsGrossPaise ?? 0)} />
            {(quote?.lineDiscountPaise ?? 0) > 0 && (
              <Row label="Line discounts" value={`− ${formatPaise(quote!.lineDiscountPaise)}`} />
            )}
            <div className="flex items-center justify-between">
              <span className="text-ink-3">Bill discount</span>
              <input
                className="w-24 rounded border border-line bg-bg px-2 py-1 text-right text-[12px] tabular-nums"
                value={cart.billDiscountPaise ? (cart.billDiscountPaise / 100).toString() : ''}
                placeholder="0"
                onChange={(e) => cart.setBillDiscount(Math.round(Number(e.target.value || '0') * 100))}
              />
            </div>
            <Row label="Taxable value" value={formatPaise(quote?.taxableValuePaise ?? 0)} />
            <Row label="CGST" value={formatPaise(quote?.cgstPaise ?? 0)} />
            <Row label="SGST" value={formatPaise(quote?.sgstPaise ?? 0)} />
            {(quote?.roundOffPaise ?? 0) !== 0 && (
              <Row label="Round off" value={formatPaise(quote!.roundOffPaise)} />
            )}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
            <span className="text-[15px] font-semibold text-ink">Payable</span>
            <span className="text-[20px] font-bold tabular-nums text-ink">
              {quoting && !quote ? '…' : formatPaise(payable)}
            </span>
          </div>
        </div>

        {/* Payment */}
        <div className="rounded-xl border border-line bg-bg p-4">
          <Segmented options={TENDERS} value={tenderMethod} onChange={setTenderMethod} className="w-full" />
          <div className="mt-2 flex gap-2">
            {tenderMethod === 'cash' && (
              <Input
                type="number"
                inputMode="decimal"
                placeholder="Cash given ₹"
                value={cashGiven}
                onChange={(e) => setCashGiven(e.target.value)}
                className="flex-1"
              />
            )}
            <Button variant="outline" size="sm" className="shrink-0" disabled={remaining <= 0} onClick={() => addTender(true)}>
              Add {formatPaise(Math.max(0, remaining))}
            </Button>
            {tenderMethod === 'cash' && (
              <Button variant="outline" size="sm" disabled={!cashGiven} onClick={() => addTender(false)}>
                Add cash
              </Button>
            )}
          </div>
          {tenders.length > 0 && (
            <div className="mt-2 space-y-1 text-[12px]">
              {tenders.map((t, i) => (
                <div key={i} className="flex items-center justify-between rounded bg-bg-2 px-2 py-1">
                  <span className="uppercase text-ink-3">{t.method}</span>
                  <span className="flex items-center gap-2 tabular-nums">
                    {formatPaise(t.amountPaise)}
                    <button onClick={() => setTenders((p) => p.filter((_, j) => j !== i))}>
                      <X className="size-3 text-ink-4" />
                    </button>
                  </span>
                </div>
              ))}
              <div className="flex justify-between px-2 text-ink-3">
                <span>Remaining</span>
                <span className={remaining === 0 ? 'text-success' : 'text-danger'}>{formatPaise(remaining)}</span>
              </div>
              {changeDue > 0 && (
                <div className="flex justify-between px-2 font-medium text-ink">
                  <span>Change due</span>
                  <span className="tabular-nums">{formatPaise(changeDue)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {offline && (
          <div className="rounded-lg bg-danger/10 px-3 py-2 text-[12px] text-danger">
            You are offline. Reconnect to complete the sale.
          </div>
        )}

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            disabled={cart.lines.length === 0 || hold.isPending}
            onClick={() => hold.mutate()}
          >
            Hold (F7)
          </Button>
          <Button
            variant="accent"
            className="flex-[2]"
            disabled={!canComplete}
            loading={complete.isPending}
            onClick={() => complete.mutate()}
          >
            Complete · {formatPaise(payable)} (F9)
          </Button>
        </div>
      </div>

      {/* Result */}
      <Dialog open={!!result} onOpenChange={(o) => !o && newSale()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sale completed</DialogTitle>
          </DialogHeader>
          {result && (
            <div className="space-y-3">
              <div className="rounded-lg bg-success/10 p-3 text-center">
                <div className="text-[12px] text-ink-4">Invoice {result.invoiceNumber}</div>
                <div className="text-[22px] font-bold text-ink">{formatPaise(result.payablePaise)}</div>
                {result.changePaise > 0 && (
                  <div className="text-[13px] text-ink-3">Change: {formatPaise(result.changePaise)}</div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => navigate(`/retailer/pos/sales/${result.saleId}`)}>
                  View / print
                </Button>
                <Button variant="accent" autoFocus onClick={newSale}>
                  New sale (Enter)
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-3">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function CustomerCard() {
  const cart = usePosCart();
  const [open, setOpen] = useState(false);
  const [b2b, setB2b] = useState(false);
  return (
    <div className="rounded-xl border border-line bg-bg p-3">
      <button
        type="button"
        className="flex w-full items-center justify-between text-[13px] font-medium text-ink"
        onClick={() => setOpen((o) => !o)}
      >
        <span>{cart.customer.name || cart.customer.phone || 'Add customer (optional)'}</span>
        <span className="text-[11px] text-ink-4">{open ? 'Hide' : 'Edit'}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          <Input
            placeholder="Name"
            value={cart.customer.name ?? ''}
            onChange={(e) => cart.setCustomer({ ...cart.customer, name: e.target.value })}
          />
          <Input
            placeholder="Phone"
            value={cart.customer.phone ?? ''}
            onChange={(e) => cart.setCustomer({ ...cart.customer, phone: e.target.value })}
          />
          <label className="flex items-center gap-2 text-[12px] text-ink-3">
            <input type="checkbox" checked={b2b} onChange={(e) => setB2b(e.target.checked)} />
            B2B — add GSTIN to invoice
          </label>
          {b2b && (
            <Input
              placeholder="Customer GSTIN"
              value={cart.customer.gstin ?? ''}
              onChange={(e) => cart.setCustomer({ ...cart.customer, gstin: e.target.value.toUpperCase() })}
            />
          )}
        </div>
      )}
    </div>
  );
}
