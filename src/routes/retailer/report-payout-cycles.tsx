import { Fragment, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, ChevronDown, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';
import { formatPaise } from '@/lib/status';
import { useServerCsv } from '@/lib/csv';
import { unwrapMeta, unwrapRows } from '@/lib/report';
import { useStoreScope } from '@/lib/store-scope';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Empty } from '@/components/ui/empty';
import { FreshnessLabel } from '@/components/ui/freshness-label';
import { BarChart } from '@/components/ui/bar-chart';
import { ViewToggle, type ReportView } from '@/components/ui/view-toggle';

type Cycle = {
  id: string;
  status: string;
  cycleStart: string;
  cycleEnd: string;
  grossPaise: number;
  commissionPaise: number;
  refundsHeldPaise: number;
  adjustmentsPaise: number;
  disputeHoldPaise: number;
  netPaise: number;
  breakdown: Record<string, number>;
};

const fmtRupees = (n: number) => `₹${Math.round(n / 100).toLocaleString('en-IN')}`;

/** Payout cycles — net payout per cycle as bars; cycle detail in the table. */
export function PayoutCyclesPanel() {
  const scope = useStoreScope();
  const path = `${scope.basePath}/payouts/cycles`;
  const params = { limit: '24' };
  const [view, setView] = useState<ReportView>('chart');

  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'payout-cycles', scope.basePath],
    queryFn: () => api<unknown>(`${path}?limit=24`),
  });
  const rows = unwrapRows<Cycle>(data);
  const meta = unwrapMeta(data);
  const exportCsv = useServerCsv('payout_cycles', path, params);

  const [expanded, setExpanded] = useState<string | null>(null);

  // Oldest → newest so the bars read left-to-right like a timeline.
  const chronological = [...rows].sort(
    (a, b) => new Date(a.cycleEnd).getTime() - new Date(b.cycleEnd).getTime(),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <FreshnessLabel generatedAtIst={meta?.generatedAtIst} />
        <ViewToggle value={view} onChange={setView} />
        <Button variant="outline" size="sm" iconLeft={<Download className="size-3.5" />} onClick={() => exportCsv()}>
          CSV
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-40" />
      ) : rows.length === 0 ? (
        <Empty kicker="No cycles" title="No payout cycles found." />
      ) : view === 'chart' ? (
        <Card>
          <CardContent className="p-5">
            <div className="kicker mb-3">Net payout per cycle</div>
            <BarChart
              labels={chronological.map((r) =>
                new Date(r.cycleEnd).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
              )}
              values={chronological.map((r) => r.netPaise)}
              formatY={fmtRupees}
              color="var(--color-success)"
              height={260}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-[12.5px]">
              <thead className="bg-bg-2/40">
                <tr>
                  <th className="px-3 py-2 w-6"></th>
                  <th className="px-3 py-2 text-left font-medium text-ink-3">Cycle</th>
                  <th className="px-3 py-2 text-left font-medium text-ink-3">Status</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Gross</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Commission</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Refunds held</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Dispute hold</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Adjustments</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Net</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const open = expanded === r.id;
                  return (
                    <Fragment key={r.id}>
                      <tr
                        className="border-t border-line cursor-pointer hover:bg-bg-2/20"
                        onClick={() => setExpanded(open ? null : r.id)}
                      >
                        <td className="px-3 py-2 text-ink-3">
                          {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                        </td>
                        <td className="px-3 py-2 font-mono text-ink-2 text-[11.5px]">
                          {new Date(r.cycleStart).toLocaleDateString('en-IN')} → {new Date(r.cycleEnd).toLocaleDateString('en-IN')}
                        </td>
                        <td className="px-3 py-2"><Badge tone="neutral" flat>{r.status}</Badge></td>
                        <td className="px-3 py-2 text-right font-mono">{formatPaise(r.grossPaise)}</td>
                        <td className="px-3 py-2 text-right font-mono text-warning">−{formatPaise(r.commissionPaise)}</td>
                        <td className="px-3 py-2 text-right font-mono text-warning">−{formatPaise(r.refundsHeldPaise)}</td>
                        <td className="px-3 py-2 text-right font-mono text-warning">−{formatPaise(r.disputeHoldPaise)}</td>
                        <td className="px-3 py-2 text-right font-mono">{formatPaise(r.adjustmentsPaise)}</td>
                        <td className="px-3 py-2 text-right font-mono text-success">{formatPaise(r.netPaise)}</td>
                      </tr>
                      {open && (
                        <tr className="border-t border-line bg-bg-2/20">
                          <td></td>
                          <td colSpan={8} className="px-3 py-3">
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-[11.5px]">
                              {Object.entries(r.breakdown).map(([k, v]) => (
                                <div key={k} className="font-mono">
                                  <div className="text-ink-3">{k}</div>
                                  <div className={v < 0 ? 'text-warning' : 'text-ink'}>{formatPaise(v)}</div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/** Standalone page wrapper — kept for the admin store-scoped report routes. */
export default function ReportPayoutCycles() {
  return (
    <Page>
      <PageHeader
        kicker="Analytics"
        title="Payout cycles"
        description="Total sales, fees, money held for refunds and disputes, adjustments, and the final amount, for each payout."
      />
      <PayoutCyclesPanel />
    </Page>
  );
}
