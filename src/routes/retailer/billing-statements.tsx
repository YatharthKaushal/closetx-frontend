import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight } from 'lucide-react';
import { api } from '@/lib/api';
import { formatPaise } from '@/lib/status';
import type { BillingStatement } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';

const STATUS_TONE: Record<BillingStatement['status'], 'warning' | 'info' | 'success'> = {
  open: 'warning',
  closing: 'info',
  closed: 'success',
};

/** Body-only renderer (see TaxInvoicesBody for the rationale). */
export function BillingStatementsBody() {
  const { data, isLoading } = useQuery({
    queryKey: ['retailer', 'billing-statements'],
    queryFn: () => api<BillingStatement[]>('/retailer/billing-statements'),
  });
  const list = data ?? [];

  return (
    <>
      {isLoading ? <Skeleton className="h-32" /> : list.length === 0 ? (
        <Empty kicker="None" title="No statements yet." />
      ) : (
        <ul className="space-y-2">
          {list.map((s) => (
            <Card key={s.id}>
              <CardContent className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[15px] font-semibold text-ink">{s.period}</span>
                    <Badge tone={STATUS_TONE[s.status]}>{s.status}</Badge>
                    <Badge tone="neutral" flat>{s.ordersCount} orders</Badge>
                  </div>
                  <div className="mt-1 text-[12.5px] text-ink-3">
                    Gross {formatPaise(s.grossPaise)} · Commission {formatPaise(s.commissionPaise)} · TCS {formatPaise(s.tcsPaise)} · Refunds {formatPaise(s.refundsPaise)}
                  </div>
                  <div className="mt-1 text-[13px] font-mono text-ink">Net {formatPaise(s.netPaise)}</div>
                </div>
                <Button asChild variant="outline" size="sm" iconRight={<ArrowUpRight className="size-3.5" />}>
                  <Link to={`/retailer/billing-statements/${s.id}`}>Open</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </ul>
      )}
    </>
  );
}

export default function RetailerBillingStatements() {
  return (
    <Page>
      <PageHeader
        kicker="Payouts"
        title="Billing statements"
        description="Your monthly summary of orders, fees, TCS, refunds, money held back, and adjustments. Click a row to see the details."
      />
      <BillingStatementsBody />
    </Page>
  );
}
