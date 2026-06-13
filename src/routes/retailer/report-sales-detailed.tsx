import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { api } from '@/lib/api';
import { formatPaise } from '@/lib/status';
import { useServerCsv } from '@/lib/csv';
import { unwrapMeta } from '@/lib/report';
import { useStoreScope } from '@/lib/store-scope';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Segmented } from '@/components/ui/segmented';
import { Empty } from '@/components/ui/empty';
import { FreshnessLabel } from '@/components/ui/freshness-label';
import { LineChart, type Series } from '@/components/ui/line-chart';
import { BarChart } from '@/components/ui/bar-chart';
import { ViewToggle, type ReportView } from '@/components/ui/view-toggle';

type Granularity = 'day' | 'week' | 'month';
type Breakdown = 'none' | 'status' | 'delivery_method' | 'category';

type Row = {
  bucket: string;
  key?: string;
  ordersCount?: number;
  itemsCount?: number;
  grossPaise: number;
};

const SERIES_COLORS = [
  'var(--color-ink)',
  'var(--color-info)',
  'var(--color-success)',
  'var(--color-warning)',
  'var(--color-danger)',
];

const fmtRupees = (n: number) => `₹${Math.round(n / 100).toLocaleString('en-IN')}`;

/** Sales trend — gross over time; line per breakdown key (top 5). */
export function SalesTrendPanel() {
  const scope = useStoreScope();
  const [granularity, setGranularity] = useState<Granularity>('day');
  const [breakdown, setBreakdown] = useState<Breakdown>('none');
  const [view, setView] = useState<ReportView>('chart');

  const params = useMemo(
    () => ({ granularity, ...(breakdown === 'none' ? {} : { breakdown }) }),
    [granularity, breakdown],
  );

  const path = `${scope.basePath}/sales-detailed`;
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'sales-detailed', scope.basePath, granularity, breakdown],
    queryFn: () =>
      api<{ granularity: Granularity; breakdown: string | null; rows: Row[] }>(
        `${path}?${new URLSearchParams(params as Record<string, string>).toString()}`,
      ),
  });

  const rows = data?.rows ?? [];
  const meta = unwrapMeta(data);
  const exportCsv = useServerCsv('sales_detailed', path, params);

  // Pivot rows into chart shape: buckets on x; one series per breakdown key
  // (top 5 by gross — the rest would only smear the chart).
  const chart = useMemo(() => {
    const buckets = [...new Set(rows.map((r) => r.bucket))];
    if (breakdown === 'none') {
      const values = buckets.map((b) =>
        rows.filter((r) => r.bucket === b).reduce((s, r) => s + r.grossPaise, 0),
      );
      return { buckets, series: [{ label: 'Gross', color: SERIES_COLORS[0]!, values }] as Series[] };
    }
    const byKey = new Map<string, number>();
    for (const r of rows) byKey.set(r.key ?? '—', (byKey.get(r.key ?? '—') ?? 0) + r.grossPaise);
    const topKeys = [...byKey.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k]) => k);
    const series: Series[] = topKeys.map((k, i) => ({
      label: k,
      color: SERIES_COLORS[i % SERIES_COLORS.length]!,
      values: buckets.map((b) =>
        rows.filter((r) => r.bucket === b && (r.key ?? '—') === k).reduce((s, r) => s + r.grossPaise, 0),
      ),
    }));
    return { buckets, series };
  }, [rows, breakdown]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Segmented<Granularity>
            value={granularity}
            onChange={setGranularity}
            options={[
              { value: 'day', label: 'Day' },
              { value: 'week', label: 'Week' },
              { value: 'month', label: 'Month' },
            ]}
          />
          <Segmented<Breakdown>
            value={breakdown}
            onChange={setBreakdown}
            options={[
              { value: 'none', label: 'Total' },
              { value: 'status', label: 'Status' },
              { value: 'delivery_method', label: 'Delivery' },
              { value: 'category', label: 'Category' },
            ]}
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
        <Skeleton className="h-60" />
      ) : rows.length === 0 ? (
        <Empty kicker="No data" title="No sales in this window." />
      ) : view === 'chart' ? (
        <Card>
          <CardContent className="p-5">
            {breakdown !== 'none' && (
              <div className="mb-3 flex flex-wrap items-center gap-3">
                {chart.series.map((s) => (
                  <span key={s.label} className="flex items-center gap-1.5 text-[11.5px] text-ink-3">
                    <span className="size-2 rounded-full" style={{ background: s.color }} />
                    {s.label}
                  </span>
                ))}
              </div>
            )}
            {chart.buckets.length <= 3 ? (
              <BarChart
                labels={chart.buckets}
                values={chart.series[0]?.values ?? []}
                formatY={fmtRupees}
                height={260}
              />
            ) : (
              <LineChart
                labels={chart.buckets}
                series={chart.series}
                formatY={fmtRupees}
                height={260}
                fillFirst={breakdown === 'none'}
              />
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-[12.5px]">
              <thead className="bg-bg-2/40">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-ink-3">Bucket</th>
                  {breakdown !== 'none' && (
                    <th className="px-3 py-2 text-left font-medium text-ink-3">
                      {breakdown === 'delivery_method' ? 'Delivery' : breakdown}
                    </th>
                  )}
                  {breakdown === 'category' ? (
                    <th className="px-3 py-2 text-right font-medium text-ink-3">Items</th>
                  ) : (
                    <th className="px-3 py-2 text-right font-medium text-ink-3">Orders</th>
                  )}
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Gross</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.bucket}-${r.key ?? ''}-${i}`} className="border-t border-line">
                    <td className="px-3 py-2 font-mono text-ink-2">{r.bucket}</td>
                    {breakdown !== 'none' && <td className="px-3 py-2 text-ink">{r.key ?? '—'}</td>}
                    <td className="px-3 py-2 text-right font-mono">
                      {(r.ordersCount ?? r.itemsCount ?? 0).toLocaleString('en-IN')}
                    </td>
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
export default function ReportSalesDetailed() {
  return (
    <Page>
      <PageHeader
        kicker="Analytics"
        title="Sales trend"
        description="Orders and gross revenue over time, broken down by status, delivery method, or category."
      />
      <SalesTrendPanel />
    </Page>
  );
}
