import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { api } from '@/lib/api';
import { useServerCsv } from '@/lib/csv';
import { unwrapMeta, unwrapRows } from '@/lib/report';
import { useStoreScope } from '@/lib/store-scope';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Empty } from '@/components/ui/empty';
import { FreshnessLabel } from '@/components/ui/freshness-label';
import { HBarChart } from '@/components/ui/hbar-chart';
import { ViewToggle, type ReportView } from '@/components/ui/view-toggle';

type Row = {
  variantId: string;
  listingId: string;
  label: string;
  views: number;
  cartAdds: number;
  cartQty: number;
  deliveredItems: number;
  viewToCartBp: number;
  cartToDeliveredBp: number;
  viewToDeliveredBp: number;
};

function bp(n: number) { return `${(n / 100).toFixed(1)}%`; }

/** Variant conversion — ranked view → delivered conversion bars per variant. */
export function VariantConversionPanel() {
  const scope = useStoreScope();
  const [listingId, setListingId] = useState('');
  const [view, setView] = useState<ReportView>('chart');
  const params = useMemo(() => {
    const p: Record<string, string> = { limit: '100' };
    if (listingId.trim()) p.listingId = listingId.trim();
    return p;
  }, [listingId]);

  const path = `${scope.basePath}/listings/conversion`;
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'variant-conversion', scope.basePath, params],
    queryFn: () => api<unknown>(`${path}?${new URLSearchParams(params).toString()}`),
  });
  const rows = unwrapRows<Row>(data);
  const meta = unwrapMeta(data);
  const exportCsv = useServerCsv('variant_conversion', path, params);

  // Chart ranks the variants shoppers actually convert on (top 20 by view→delivered).
  const chartRows = useMemo(
    () =>
      [...rows]
        .sort((a, b) => b.viewToDeliveredBp - a.viewToDeliveredBp)
        .slice(0, 20)
        .map((r) => ({
          label: r.label,
          value: r.viewToDeliveredBp,
          display: bp(r.viewToDeliveredBp),
          sub: `${r.views.toLocaleString('en-IN')} views · ${r.deliveredItems} delivered`,
        })),
    [rows],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="w-full max-w-sm">
          <Input
            placeholder="Filter by listing ID (optional)"
            value={listingId}
            onChange={(e) => setListingId(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <FreshnessLabel generatedAtIst={meta?.generatedAtIst} />
          <ViewToggle value={view} onChange={setView} />
          <Button variant="outline" size="sm" iconLeft={<Download className="size-3.5" />} onClick={() => exportCsv()}>
            CSV
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-40" />
      ) : rows.length === 0 ? (
        <Empty kicker="No data" title="No variant events in this window." />
      ) : view === 'chart' ? (
        <Card>
          <CardContent className="p-5">
            <div className="kicker mb-3">View → delivered conversion (top {chartRows.length})</div>
            <HBarChart rows={chartRows} color="var(--color-info)" />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-[12.5px]">
              <thead className="bg-bg-2/40">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-ink-3">Variant</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Views</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Cart adds</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Delivered</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">View → Cart</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Cart → Delivered</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">View → Delivered</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.variantId} className="border-t border-line">
                    <td className="px-3 py-2 text-ink">{r.label}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.views.toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.cartAdds.toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.deliveredItems.toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2 text-right font-mono">{bp(r.viewToCartBp)}</td>
                    <td className="px-3 py-2 text-right font-mono">{bp(r.cartToDeliveredBp)}</td>
                    <td className="px-3 py-2 text-right font-mono">{bp(r.viewToDeliveredBp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/** Standalone page wrapper — kept for the admin store-scoped report routes. */
export default function ReportVariantConversion() {
  return (
    <Page>
      <PageHeader
        kicker="Analytics"
        title="Variant conversion"
        description="How many shoppers saw a product, added it to the bag, and received it — per variant. See where they drop off."
      />
      <VariantConversionPanel />
    </Page>
  );
}
