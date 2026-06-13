import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { api } from '@/lib/api';
import { formatPaise } from '@/lib/status';
import { useServerCsv } from '@/lib/csv';
import { unwrapMeta, unwrapRows } from '@/lib/report';
import { useStoreScope } from '@/lib/store-scope';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DateRangePicker, type DateRangeValue } from '@/components/ui/date-range-picker';
import { Empty } from '@/components/ui/empty';
import { FreshnessLabel } from '@/components/ui/freshness-label';
import { HBarChart } from '@/components/ui/hbar-chart';
import { ViewToggle, type ReportView } from '@/components/ui/view-toggle';

type Row = {
  listingId: string;
  listingName: string;
  itemsSold: number;
  ordersCount: number;
  grossPaise: number;
};

/** Listing revenue — ranked gross-revenue bars per listing. */
export function ListingRevenuePanel() {
  const scope = useStoreScope();
  const [range, setRange] = useState<DateRangeValue>({ from: null, to: null });
  const [view, setView] = useState<ReportView>('chart');

  const params = useMemo(() => {
    const p: Record<string, string> = { limit: '50' };
    if (range.from) p.since = range.from.toISOString();
    if (range.to) p.until = range.to.toISOString();
    return p;
  }, [range]);

  const path = `${scope.basePath}/listings/revenue`;
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'listings-revenue', scope.basePath, params],
    queryFn: () => api<unknown>(`${path}?${new URLSearchParams(params).toString()}`),
  });
  const rows = unwrapRows<Row>(data);
  const meta = unwrapMeta(data);
  const exportCsv = useServerCsv('listing_revenue', path, params);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="w-full max-w-xs">
          <DateRangePicker value={range} onChange={setRange} placeholder="Last 30 days" />
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
        <Empty kicker="No sales" title="No listings sold in this window." />
      ) : view === 'chart' ? (
        <Card>
          <CardContent className="p-5">
            <div className="kicker mb-3">Gross revenue by listing (top {Math.min(rows.length, 20)})</div>
            <HBarChart
              rows={[...rows]
                .sort((a, b) => b.grossPaise - a.grossPaise)
                .slice(0, 20)
                .map((r) => ({
                  label: r.listingName,
                  value: r.grossPaise,
                  display: formatPaise(r.grossPaise),
                  sub: `${r.itemsSold} items · ${r.ordersCount} orders`,
                }))}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-[12.5px]">
              <thead className="bg-bg-2/40">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-ink-3">Listing</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Items sold</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Orders</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Gross</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.listingId} className="border-t border-line">
                    <td className="px-3 py-2 text-ink">{r.listingName}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.itemsSold.toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.ordersCount.toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatPaise(r.grossPaise)}</td>
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
export default function ReportListingRevenue() {
  return (
    <Page>
      <PageHeader
        kicker="Analytics"
        title="Per-listing revenue"
        description="Top listings by gross revenue in the selected window. Spot under-performers vs. impressions."
      />
      <ListingRevenuePanel />
    </Page>
  );
}
