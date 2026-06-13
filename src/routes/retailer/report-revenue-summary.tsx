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
import { DateRangePicker, type DateRangeValue } from '@/components/ui/date-range-picker';
import { FreshnessLabel } from '@/components/ui/freshness-label';
import { WaterfallChart } from '@/components/ui/waterfall-chart';
import { ViewToggle, type ReportView } from '@/components/ui/view-toggle';

type RevenueSummary = {
  windowStart: string;
  windowEnd: string;
  ordersCount: number;
  refundsCount: number;
  grossPaise: number;
  refundsPaise: number;
  commissionPaise: number;
  tcsPaise: number;
  netOfRefundsPaise: number;
  netOfCommissionPaise: number;
  netMoneyInPaise: number;
};

/** Revenue summary — headline KPIs plus a gross → net waterfall. */
export function RevenueSummaryPanel() {
  const scope = useStoreScope();
  const [range, setRange] = useState<DateRangeValue>({ from: null, to: null });
  const [view, setView] = useState<ReportView>('chart');

  const params = useMemo(() => {
    const p: Record<string, string> = {};
    if (range.from) p.since = range.from.toISOString();
    if (range.to) p.until = range.to.toISOString();
    return p;
  }, [range]);

  const path = `${scope.basePath}/revenue-summary`;
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'revenue-summary', scope.basePath, params],
    queryFn: () =>
      api<RevenueSummary>(
        `${path}${Object.keys(params).length ? `?${new URLSearchParams(params).toString()}` : ''}`,
      ),
  });
  const meta = unwrapMeta(data);
  const exportCsv = useServerCsv('revenue_summary', path, params);

  const tableRows: Array<{ label: string; value: string; hint?: string }> = data
    ? [
        { label: 'Orders', value: data.ordersCount.toLocaleString('en-IN') },
        { label: 'Gross sales', value: formatPaise(data.grossPaise) },
        { label: 'Refunds', value: `−${formatPaise(data.refundsPaise)}`, hint: `${data.refundsCount} refunds` },
        { label: 'Commission', value: `−${formatPaise(data.commissionPaise)}` },
        { label: 'TCS', value: `−${formatPaise(data.tcsPaise)}` },
        { label: 'Net of refunds', value: formatPaise(data.netOfRefundsPaise) },
        { label: 'Net of commission', value: formatPaise(data.netOfCommissionPaise) },
        { label: 'Net money in', value: formatPaise(data.netMoneyInPaise) },
      ]
    : [];

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

      {isLoading || !data ? (
        <Skeleton className="h-60" />
      ) : view === 'chart' ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Orders" value={data.ordersCount.toLocaleString('en-IN')} />
            <Kpi label="Gross" value={formatPaise(data.grossPaise)} />
            <Kpi label="Refunds" value={formatPaise(data.refundsPaise)} sub={`${data.refundsCount} refunds`} />
            <Kpi label="Net money in" value={formatPaise(data.netMoneyInPaise)} accent />
          </div>
          <Card>
            <CardContent className="p-5">
              <div className="kicker mb-3">Where the money goes</div>
              <WaterfallChart
                steps={[
                  { label: 'Gross sales', amountPaise: data.grossPaise, kind: 'start' },
                  { label: 'Refunds', amountPaise: -data.refundsPaise, kind: 'deduction' },
                  { label: 'Commission', amountPaise: -data.commissionPaise, kind: 'deduction' },
                  { label: 'TCS', amountPaise: -data.tcsPaise, kind: 'deduction' },
                  { label: 'Net money in', amountPaise: data.netMoneyInPaise, kind: 'total' },
                ]}
              />
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-[12.5px]">
              <tbody>
                {tableRows.map((r) => (
                  <tr key={r.label} className="border-t border-line first:border-t-0">
                    <td className="px-4 py-2.5 text-ink-2">{r.label}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-ink">
                      {r.value}
                      {r.hint && <span className="ml-2 font-sans text-[11px] text-ink-4">{r.hint}</span>}
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

function Kpi({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-[11.5px] uppercase tracking-wide text-ink-3">{label}</div>
        <div className={`mt-1 font-mono text-[18px] leading-none ${accent ? 'text-success' : 'text-ink'}`}>{value}</div>
        {sub && <div className="mt-1 text-[11px] text-ink-4">{sub}</div>}
      </CardContent>
    </Card>
  );
}

/** Standalone page wrapper — kept for the admin store-scoped report routes. */
export default function ReportRevenueSummary() {
  return (
    <Page>
      <PageHeader
        kicker="Analytics"
        title="Revenue summary"
        description="Total sales, refunds, fees, TCS, and the money you keep, for the period you choose."
      />
      <RevenueSummaryPanel />
    </Page>
  );
}
