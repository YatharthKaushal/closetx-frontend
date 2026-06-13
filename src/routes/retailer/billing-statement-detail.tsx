import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Download } from 'lucide-react';
import { api } from '@/lib/api';
import { formatPaise } from '@/lib/status';
import type { BillingStatementDetail } from '@/lib/types';
import { Page, PageHeader, SectionHeading } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MetaList } from '@/components/ui/meta-list';

export default function RetailerBillingStatementDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useQuery({
    queryKey: ['retailer', 'billing-statements', id],
    queryFn: () => api<BillingStatementDetail>(`/retailer/billing-statements/${id}`),
    enabled: Boolean(id),
  });

  if (isLoading) return <Page><Skeleton className="h-72" /></Page>;
  if (!data) return <Page><PageHeader title="Statement not found" /></Page>;

  return (
    <Page>
      <PageHeader
        kicker="Settlement"
        title={`Statement · ${data.period}`}
        description={`${data.ordersCount} orders · status ${data.status}`}
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" iconLeft={<ArrowLeft className="size-3.5" />}>
              <Link to="/retailer/billing-statements">Back</Link>
            </Button>
            <Button variant="outline" size="sm" iconLeft={<Download className="size-3.5" />} disabled>
              Download PDF
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="p-6">
            <SectionHeading kicker="Summary" title="Money flow" />
            <MetaList
              cols={1}
              items={[
                { label: 'Gross', value: formatPaise(data.grossPaise), mono: true },
                { label: '− Commission', value: formatPaise(data.commissionPaise), mono: true },
                { label: '− TCS', value: formatPaise(data.tcsPaise), mono: true },
                { label: '− Refunds deducted', value: formatPaise(data.refundsPaise), mono: true },
                { label: '− Held back', value: formatPaise(data.holdsPaise), mono: true },
                { label: '± Adjustments', value: formatPaise(data.adjustmentsPaise), mono: true },
                { label: 'Net payout', value: <strong className="text-ink">{formatPaise(data.netPaise)}</strong>, mono: true },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="mb-3 flex items-center justify-between">
              <SectionHeading title="Dispute outcomes" hint={`${data.liabilityBookings.length} entries`} />
            </div>
            {data.liabilityBookings.length === 0 ? (
              <p className="text-[12.5px] text-ink-3 italic">No dispute decisions recorded this period.</p>
            ) : (
              <ul className="space-y-2">
                {data.liabilityBookings.map((b) => (
                  <li key={b.id} className="rounded-md border border-line bg-bg-2/30 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <Badge tone="warning" flat>Issue {b.issueId}</Badge>
                      <span className="font-mono text-[12.5px] text-ink">−{formatPaise(b.amountPaise)}</span>
                    </div>
                    <p className="mt-1 text-[12px] text-ink-2">{b.description}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </Page>
  );
}
