import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { api } from '@/lib/api';
import { formatPaise } from '@/lib/status';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';

type Upcoming = {
  storeId: string;
  nextCycleDate: string;
  payoutCadenceDays: number;
  outstandingPayable: number;
  grossPaise: number;
  commissionPaise: number;
  tcsPaise: number;
  heldPaise: number;
  pendingAdjustmentsPaise: number;
  orderBreakdown: Array<{ orderId: string; gross: number; commission: number; tcs: number; net: number }>;
  orderCount: number;
};

export default function RetailerPayoutsUpcoming() {
  const { data, isLoading } = useQuery({
    queryKey: ['retailer', 'payouts-upcoming'],
    queryFn: () => api<Upcoming>('/retailer/payouts/upcoming'),
  });

  return (
    <Page>
      <PageHeader
        kicker="Settlement"
        title="Upcoming payout"
        description="Outstanding payable, next scheduled cycle, and per-order breakdown contributing to it."
      />

      {isLoading || !data ? (
        <Skeleton className="h-60" />
      ) : (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Owed to you" value={formatPaise(data.outstandingPayable)} accent />
            <Kpi label="Total sales" value={formatPaise(data.grossPaise)} />
            <Kpi label="Platform fee" value={`−${formatPaise(data.commissionPaise)}`} tone="warn" />
            <Kpi label="TCS" value={`−${formatPaise(data.tcsPaise)}`} tone="warn" />
            <Kpi label="Held back" value={`−${formatPaise(data.heldPaise)}`} tone="warn" />
            <Kpi
              label="Adjustments pending"
              value={`${data.pendingAdjustmentsPaise >= 0 ? '+' : ''}${formatPaise(data.pendingAdjustmentsPaise)}`}
            />
            <Kpi label="Next payout" value={new Date(data.nextCycleDate).toLocaleDateString('en-IN')} sub={`every ${data.payoutCadenceDays} days`} />
            <Kpi label="Orders" value={data.orderCount.toLocaleString('en-IN')} />
          </div>

          {data.orderBreakdown.length === 0 ? (
            <Empty kicker="None" title="No orders contributing to next payout yet." />
          ) : (
            <Card>
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full text-[12.5px]">
                  <thead className="bg-bg-2/40">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-ink-3">Order</th>
                      <th className="px-3 py-2 text-right font-medium text-ink-3">Gross</th>
                      <th className="px-3 py-2 text-right font-medium text-ink-3">Commission</th>
                      <th className="px-3 py-2 text-right font-medium text-ink-3">TCS</th>
                      <th className="px-3 py-2 text-right font-medium text-ink-3">Net</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.orderBreakdown.map((o) => (
                      <tr key={o.orderId} className="border-t border-line">
                        <td className="px-3 py-2 font-mono text-ink-2">{o.orderId.slice(0, 8)}…</td>
                        <td className="px-3 py-2 text-right font-mono">{formatPaise(o.gross)}</td>
                        <td className="px-3 py-2 text-right font-mono text-warning">−{formatPaise(o.commission)}</td>
                        <td className="px-3 py-2 text-right font-mono text-warning">−{formatPaise(o.tcs)}</td>
                        <td className="px-3 py-2 text-right font-mono text-success">{formatPaise(o.net)}</td>
                        <td className="px-3 py-1.5 text-right">
                          <Button asChild variant="ghost" size="sm" iconRight={<ArrowUpRight className="size-3.5" />}>
                            <Link to={`/retailer/orders/${o.orderId}`}>Open</Link>
                          </Button>
                        </td>
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

function Kpi({ label, value, sub, tone, accent }: { label: string; value: string; sub?: string; tone?: 'warn'; accent?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-[11.5px] uppercase tracking-wide text-ink-3">{label}</div>
        <div
          className={`mt-1 font-mono text-[18px] leading-none ${
            accent ? 'text-success' : tone === 'warn' ? 'text-warning' : 'text-ink'
          }`}
        >
          {value}
        </div>
        {sub && <div className="mt-1 text-[11px] text-ink-4">{sub}</div>}
      </CardContent>
    </Card>
  );
}
