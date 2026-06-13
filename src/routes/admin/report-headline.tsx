import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { api } from '@/lib/api';
import { formatPaise } from '@/lib/status';
import { useServerCsv } from '@/lib/csv';
import { unwrapMeta } from '@/lib/report';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Empty } from '@/components/ui/empty';
import { FreshnessLabel } from '@/components/ui/freshness-label';

type Cohort = {
  cohortMonth: string;
  consumerCount: number;
  first30dSpendPaise: number;
  first30dOrders: number;
  first30dArpuPaise: number;
};

type Headline = {
  windowDays: number;
  grossMerchandiseValuePaise: number;
  orderCount: number;
  averageOrderValuePaise: number;
  commissionPaise: number;
  tcsPaise: number;
  takeRateBp: number;
  refundsPaise: number;
  refundCount: number;
  refundRateBp: number;
  newConsumers30d: number;
  totalConsumers: number;
  cohorts: Cohort[];
};

function bp(n: number) { return `${(n / 100).toFixed(2)}%`; }

export default function AdminReportHeadline() {
  const path = '/admin/reports/headline';
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'reports', 'headline'],
    queryFn: () => api<Headline>(path),
  });
  const meta = unwrapMeta(data);
  const exportCsv = useServerCsv('headline', path);

  return (
    <Page>
      <PageHeader
        kicker="Reports"
        title="Headline — last 30 days"
        description="Total sales, platform fee %, average order value, refund rate, and monthly signups — for leadership reviews."
        actions={
          <>
            <FreshnessLabel generatedAtIst={meta?.generatedAtIst} />
            <Button variant="outline" size="sm" iconLeft={<Download className="size-3.5" />} onClick={() => exportCsv()}>
              Export CSV
            </Button>
          </>
        }
      />

      {isLoading || !data ? (
        <Skeleton className="h-60" />
      ) : (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Total sales" value={formatPaise(data.grossMerchandiseValuePaise)} />
            <Kpi label="Orders" value={data.orderCount.toLocaleString('en-IN')} />
            <Kpi label="Avg order value" value={formatPaise(data.averageOrderValuePaise)} />
            <Kpi label="Platform fee" value={bp(data.takeRateBp)} />
            <Kpi label="Commission" value={formatPaise(data.commissionPaise)} />
            <Kpi label="TCS" value={formatPaise(data.tcsPaise)} />
            <Kpi label="Refunds" value={formatPaise(data.refundsPaise)} sub={`${data.refundCount} refunds · ${bp(data.refundRateBp)}`} />
            <Kpi label="Consumers (30d new)" value={data.newConsumers30d.toLocaleString('en-IN')} sub={`${data.totalConsumers.toLocaleString('en-IN')} total`} />
          </div>

          <div className="mb-3 text-[12.5px] font-medium text-ink-2">Monthly signups (last 12 months)</div>
          {data.cohorts.length === 0 ? (
            <Empty kicker="No signups" title="No signups in the last 12 months." />
          ) : (
            <Card>
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full text-[12.5px]">
                  <thead className="bg-bg-2/40">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-ink-3">Month</th>
                      <th className="px-3 py-2 text-right font-medium text-ink-3">Signups</th>
                      <th className="px-3 py-2 text-right font-medium text-ink-3">First-30d orders</th>
                      <th className="px-3 py-2 text-right font-medium text-ink-3">First-30d spend</th>
                      <th className="px-3 py-2 text-right font-medium text-ink-3">ARPU (30d)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.cohorts.map((c) => (
                      <tr key={c.cohortMonth} className="border-t border-line">
                        <td className="px-3 py-2 font-mono text-ink-2">{c.cohortMonth}</td>
                        <td className="px-3 py-2 text-right font-mono">{c.consumerCount.toLocaleString('en-IN')}</td>
                        <td className="px-3 py-2 text-right font-mono">{c.first30dOrders.toLocaleString('en-IN')}</td>
                        <td className="px-3 py-2 text-right font-mono">{formatPaise(c.first30dSpendPaise)}</td>
                        <td className="px-3 py-2 text-right font-mono">{formatPaise(c.first30dArpuPaise)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </Page>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-[11.5px] uppercase tracking-wide text-ink-3">{label}</div>
        <div className="mt-1 font-mono text-[18px] text-ink leading-none">{value}</div>
        {sub && <div className="mt-1 text-[11px] text-ink-4">{sub}</div>}
      </CardContent>
    </Card>
  );
}
