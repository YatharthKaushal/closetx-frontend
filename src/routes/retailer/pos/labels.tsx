import { useState } from 'react';
import { Printer, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { formatPaise } from '@/lib/status';
import { usePermission } from '@/lib/use-permission';
import { barcodeSvg } from '@/lib/pos-barcode';
import type { PosLookupResult, PosLookupRow } from '@/lib/pos-types';
import { Page, PageHeader } from '@/components/ui/page';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Segmented } from '@/components/ui/segmented';

type LabelSize = 'sm' | 'md' | 'lg';
const SIZES: Record<LabelSize, { label: string; w: number; h: number }> = {
  sm: { label: '38×25mm', w: 38, h: 25 },
  md: { label: '50×25mm', w: 50, h: 25 },
  lg: { label: '65×38mm', w: 65, h: 38 },
};

type Pick = PosLookupRow & { count: number };

export default function PosLabels() {
  const canLabels = usePermission('pos.labels');
  const [q, setQ] = useState('');
  const [results, setResults] = useState<PosLookupRow[]>([]);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [size, setSize] = useState<LabelSize>('md');

  async function search() {
    if (q.trim().length < 2) return;
    const res = await api<PosLookupResult>(`/retailer/pos/lookup?q=${encodeURIComponent(q.trim())}`);
    setResults(res.exact ? [res.exact] : res.results);
  }

  function add(r: PosLookupRow) {
    setPicks((p) =>
      p.find((x) => x.variantId === r.variantId)
        ? p.map((x) => (x.variantId === r.variantId ? { ...x, count: x.count + 1 } : x))
        : [...p, { ...r, count: 1 }],
    );
  }

  function print() {
    const dim = SIZES[size];
    const cells = picks
      .flatMap((p) => {
        const code = p.barcode || p.sku;
        if (!code) {
          toast.error(`"${p.name}" has no barcode or SKU — skipped`);
          return [];
        }
        const svg = barcodeSvg(code, { height: dim.h > 30 ? 42 : 30, moduleWidth: 1.3 });
        return Array.from({ length: p.count }, () => `
          <div class="label">
            <div class="name">${escapeHtml(p.name)}</div>
            <div class="attr">${escapeHtml(p.attributesLabel)}</div>
            <div class="bc">${svg}</div>
            <div class="row"><span class="code">${escapeHtml(code)}</span><span class="price">${formatPaise(p.pricePaise)}</span></div>
          </div>`);
      })
      .join('');
    if (!cells) {
      toast.error('Nothing to print');
      return;
    }
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Labels</title>
    <style>
      @page { margin: 5mm; }
      * { font-family: Arial, sans-serif; box-sizing: border-box; }
      body { margin: 0; display: flex; flex-wrap: wrap; gap: 2mm; }
      .label { width: ${dim.w}mm; height: ${dim.h}mm; border: 1px solid #eee; padding: 1mm 1.5mm; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; }
      .name { font-size: 8px; font-weight: 700; line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .attr { font-size: 7px; color: #555; }
      .bc { flex: 1; display: flex; align-items: center; }
      .bc svg { width: 100%; height: auto; }
      .row { display: flex; justify-content: space-between; align-items: baseline; }
      .code { font-size: 6.5px; color: #444; }
      .price { font-size: 10px; font-weight: 700; }
    </style></head><body>${cells}</body></html>`;
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => iframe.remove(), 1000);
    }, 200);
  }

  if (!canLabels) return <Page><Empty title="Not authorized" description="You don't have access to label printing." /></Page>;

  return (
    <Page>
      <PageHeader title="Barcode labels" description="Print scannable price/barcode labels for your products" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <div className="flex gap-2">
            <Input
              placeholder="Search products by name / SKU…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && search()}
            />
            <Button variant="outline" onClick={search}>Search</Button>
          </div>
          <div className="mt-2 space-y-1">
            {results.map((r) => (
              <button
                key={r.variantId}
                onClick={() => add(r)}
                className="flex w-full items-center justify-between rounded-lg border border-line bg-bg px-3 py-2 text-left text-[13px] hover:bg-bg-2"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-ink">{r.name}</span>
                  <span className="text-[11px] text-ink-4">{r.attributesLabel}{r.sku ? ` · ${r.sku}` : ''}</span>
                </span>
                <span className="font-medium">{formatPaise(r.pricePaise)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-line bg-bg p-4">
          <div className="mb-3 flex items-center justify-between">
            <Segmented
              options={(Object.keys(SIZES) as LabelSize[]).map((k) => ({ value: k, label: SIZES[k].label }))}
              value={size}
              onChange={setSize}
            />
            <Button variant="accent" size="sm" iconLeft={<Printer className="size-4" />} disabled={picks.length === 0} onClick={print}>
              Print sheet
            </Button>
          </div>
          {picks.length === 0 ? (
            <Empty title="No labels selected" description="Search and add products to build a label sheet." />
          ) : (
            <div className="space-y-1.5">
              {picks.map((p) => (
                <div key={p.variantId} className="flex items-center gap-2 text-[13px]">
                  <span className="min-w-0 flex-1 truncate">{p.name} · {p.attributesLabel}</span>
                  <Input
                    type="number"
                    min={1}
                    value={p.count}
                    onChange={(e) =>
                      setPicks((prev) =>
                        prev.map((x) => (x.variantId === p.variantId ? { ...x, count: Math.max(1, Number(e.target.value)) } : x)),
                      )
                    }
                    className="w-16"
                  />
                  <Button variant="ghost" size="icon-sm" onClick={() => setPicks((prev) => prev.filter((x) => x.variantId !== p.variantId))}>
                    <Trash2 className="size-3.5 text-ink-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Page>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
}
