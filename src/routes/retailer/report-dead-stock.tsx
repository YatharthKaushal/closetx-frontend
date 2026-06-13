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
import { Input } from '@/components/ui/input';
import { FreshnessLabel } from '@/components/ui/freshness-label';
import { HBarChart } from '@/components/ui/hbar-chart';
import { ViewToggle, type ReportView } from '@/components/ui/view-toggle';

type Row = {
  listingId: string;
  listingName: string;
  status: string;
  totalStock: number;
  lastSoldAt: string | null;
};

/** Dead stock — stuck units per listing, oldest-sale first. */
export function DeadStockPanel() {
  const scope = useStoreScope();
  const [days, setDays] = useState(30);
  const [view, setView] = useState<ReportView>('chart');
  const params = useMemo(
    () => ({ daysWithoutSale: String(days), limit: '50' }),
    [days],
  );

  const path = `${scope.basePath}/listings/dead-stock`;
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'dead-stock', scope.basePath, params],
    queryFn: () => api<unknown>(`${path}?${new URLSearchParams(params).toString()}`),
  });
  const rows = unwrapRows<Row>(data);
  const meta = unwrapMeta(data);
  const exportCsv = useServerCsv('dead_stock', path, params);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label className="kicker text-ink-3">Days without sale</label>
          <Input
            type="number"
            min={1}
            value={days}
            onChange={(e) => setDays(Math.max(1, parseInt(e.target.value || '30', 10)))}
            className="w-20"
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
        <Empty kicker="Clean shelves" title="No dead stock at this threshold." />
      ) : view === 'chart' ? (
        <Card>
          <CardContent className="p-5">
            <div className="kicker mb-3">Units sitting without a sale</div>
            <HBarChart
              rows={[...rows]
                .sort((a, b) => b.totalStock - a.totalStock)
                .slice(0, 20)
                .map((r) => ({
                  label: r.listingName,
                  value: r.totalStock,
                  display: `${r.totalStock} units`,
                  sub: r.lastSoldAt
                    ? `last sold ${new Date(r.lastSoldAt).toLocaleDateString('en-IN')}`
                    : 'never sold',
                }))}
              color="var(--color-warning)"
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
                  <th className="px-3 py-2 text-left font-medium text-ink-3">Status</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Stock</th>
                  <th className="px-3 py-2 text-left font-medium text-ink-3">Last sold</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.listingId} className="border-t border-line">
                    <td className="px-3 py-2 text-ink">{r.listingName}</td>
                    <td className="px-3 py-2"><Badge tone="neutral" flat>{r.status}</Badge></td>
                    <td className="px-3 py-2 text-right font-mono">{r.totalStock}</td>
                    <td className="px-3 py-2 text-ink-3 font-mono text-[11.5px]">
                      {r.lastSoldAt ? new Date(r.lastSoldAt).toLocaleDateString('en-IN') : 'never'}
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
export default function ReportDeadStock() {
  return (
    <Page>
      <PageHeader
        kicker="Analytics"
        title="Dead stock"
        description="Listings with stock but no sales in the threshold window. Mark down or retire."
      />
      <DeadStockPanel />
    </Page>
  );
}
