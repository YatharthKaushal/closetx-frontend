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
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Empty } from '@/components/ui/empty';
import { DateRangePicker, type DateRangeValue } from '@/components/ui/date-range-picker';
import { FreshnessLabel } from '@/components/ui/freshness-label';
import { HBarChart } from '@/components/ui/hbar-chart';
import { ViewToggle, type ReportView } from '@/components/ui/view-toggle';

type Row = {
  listingId: string;
  listingName: string;
  returnsCount: number;
  itemsSold: number;
  returnRateBp: number;
  reasonBreakdown: Record<string, number>;
};

function bp(n: number) { return `${(n / 100).toFixed(1)}%`; }

function topReason(breakdown: Record<string, number>): string | null {
  const entries = Object.entries(breakdown);
  if (entries.length === 0) return null;
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0]![0];
}

/** Top returns — ranked return-rate bars; dominant reason as the sub-label. */
export function TopReturnsPanel() {
  const scope = useStoreScope();
  const [range, setRange] = useState<DateRangeValue>({ from: null, to: null });
  const [view, setView] = useState<ReportView>('chart');

  const params = useMemo(() => {
    const p: Record<string, string> = { limit: '20' };
    if (range.from) p.since = range.from.toISOString();
    if (range.to) p.until = range.to.toISOString();
    return p;
  }, [range]);

  const path = `${scope.basePath}/returns/top-listings`;
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'returns-top', scope.basePath, params],
    queryFn: () => api<unknown>(`${path}?${new URLSearchParams(params).toString()}`),
  });
  const rows = unwrapRows<Row>(data);
  const meta = unwrapMeta(data);
  const exportCsv = useServerCsv('returns_top', path, params);

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
        <Empty kicker="No returns" title="No returns recorded in this window." />
      ) : view === 'chart' ? (
        <Card>
          <CardContent className="p-5">
            <div className="kicker mb-3">Return rate by listing</div>
            <HBarChart
              rows={[...rows]
                .sort((a, b) => b.returnRateBp - a.returnRateBp)
                .map((r) => {
                  const reason = topReason(r.reasonBreakdown);
                  return {
                    label: r.listingName,
                    value: r.returnRateBp,
                    display: bp(r.returnRateBp),
                    sub: `${r.returnsCount}/${r.itemsSold} returned${reason ? ` · mostly "${reason}"` : ''}`,
                  };
                })}
              color="var(--color-danger)"
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
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Returns</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Items sold</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Return rate</th>
                  <th className="px-3 py-2 text-left font-medium text-ink-3">Reasons</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.listingId} className="border-t border-line align-top">
                    <td className="px-3 py-2 text-ink">{r.listingName}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.returnsCount}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.itemsSold}</td>
                    <td className="px-3 py-2 text-right font-mono text-warning">{bp(r.returnRateBp)}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(r.reasonBreakdown).map(([reason, count]) => (
                          <Badge key={reason} tone="neutral" flat>
                            {reason} · {count}
                          </Badge>
                        ))}
                        {Object.keys(r.reasonBreakdown).length === 0 && (
                          <span className="text-ink-4 text-[11px]">—</span>
                        )}
                      </div>
                    </td>
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
export default function ReportReturnsTop() {
  return (
    <Page>
      <PageHeader
        kicker="Analytics"
        title="Top-returned listings"
        description="Listings driving the most returns + the dominant reasons. Fix sizing or quality at the source."
      />
      <TopReturnsPanel />
    </Page>
  );
}
