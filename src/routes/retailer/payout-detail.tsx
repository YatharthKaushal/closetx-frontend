import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';
import { formatAge, formatPaise } from '@/lib/status';
import type { PayoutCycle } from '@/lib/types';
import { Page, PageHeader, SectionHeading } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MetaList } from '@/components/ui/meta-list';

type Deductions = {
  payoutId: string;
  cycle: { start: string; end: string };
  breakdown: {
    grossPaise: number;
    commissionPaise: number;
    commissionTaxPaise: number;
    refundsHeldPaise: number;
    tcsPaise: number;
    priorOverPayoutsPaise: number;
    disputeHoldPaise: number;
    adjustmentsPaise: number;
    netPaise: number;
  };
  holds: Array<{ id: string; disputeId: string; amountPaise: number; reason: string; status: string }>;
  adjustments: Array<{ id: string; direction: 'debit' | 'credit'; amountPaise: number; reason: string }>;
  recoveries: Array<{ id: string; refundId: string; orderId: string; refundedPaise: number; plannedDebitPaise: number; reason: string; status: string }>;
};

export default function RetailerPayoutDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useQuery({
    queryKey: ['retailer', 'payouts', id],
    queryFn: () => api<PayoutCycle>(`/retailer/payouts/${id}`),
    enabled: Boolean(id),
  });

  const { data: deductions } = useQuery({
    queryKey: ['retailer', 'payouts', id, 'deductions'],
    queryFn: () => api<Deductions>(`/retailer/payouts/${id}/deductions`),
    enabled: Boolean(id),
  });

  if (isLoading) return <Page><Skeleton className="h-72" /></Page>;
  if (!data) return <Page><PageHeader title="Payout not found" /></Page>;

  return (
    <Page>
      <PageHeader
        kicker="Settlement"
        title={`Payout · ${data.period}`}
        actions={
          <Button asChild variant="ghost" size="sm" iconLeft={<ArrowLeft className="size-3.5" />}>
            <Link to="/retailer/payouts">Back</Link>
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={data.status === 'paid' ? 'success' : data.status === 'failed' ? 'danger' : 'warning'}>
          {data.status}
        </Badge>
        <Badge tone="neutral" flat>{formatPaise(data.amountPaise)}</Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="p-6">
            <SectionHeading kicker="Bank" title="Paid to" />
            <MetaList
              cols={1}
              items={[
                { label: 'Account', value: data.bankAccountMasked },
                { label: 'UTR / confirmation', value: data.bankConfirmationRef ?? '—', mono: true },
                { label: 'Retries', value: String(data.retryCount) },
                ...(data.initiatedAt ? [{ label: 'Initiated', value: `${new Date(data.initiatedAt).toLocaleString('en-IN')} · ${formatAge(data.initiatedAt)}` }] : []),
                ...(data.settledAt ? [{ label: 'Settled', value: `${new Date(data.settledAt).toLocaleString('en-IN')} · ${formatAge(data.settledAt)}` }] : []),
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <SectionHeading kicker="Deductions" title="Itemised breakdown" />
            {deductions ? (
              <ul className="divide-y divide-line">
                <Row label="Gross" amount={deductions.breakdown.grossPaise} />
                <Row label="Platform commission" amount={-deductions.breakdown.commissionPaise} />
                <Row label="Commission GST" amount={-deductions.breakdown.commissionTaxPaise} />
                <Row label="TCS" amount={-deductions.breakdown.tcsPaise} />
                <Row label="Refunds held back" amount={-deductions.breakdown.refundsHeldPaise} />
                <Row label="Money overpaid earlier" amount={-deductions.breakdown.priorOverPayoutsPaise} />
                <Row label="Money held for disputes" amount={-deductions.breakdown.disputeHoldPaise} />
                <Row label="Adjustments" amount={deductions.breakdown.adjustmentsPaise} />
                <li className="flex items-center justify-between py-2 text-[13px] font-semibold">
                  <span className="text-ink">Net payout</span>
                  <span className="font-mono text-success">{formatPaise(deductions.breakdown.netPaise)}</span>
                </li>
              </ul>
            ) : (
              <Skeleton className="h-40" />
            )}
          </CardContent>
        </Card>

        {deductions && deductions.holds.length > 0 && (
          <Card className="lg:col-span-2">
            <CardContent className="p-6">
              <SectionHeading kicker="Held" title="Money held for disputes this payout" />
              <table className="w-full text-[12.5px]">
                <thead className="bg-bg-2/40">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-ink-3">Dispute</th>
                    <th className="px-3 py-2 text-right font-medium text-ink-3">Amount</th>
                    <th className="px-3 py-2 text-left font-medium text-ink-3">Reason</th>
                    <th className="px-3 py-2 text-left font-medium text-ink-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {deductions.holds.map((h) => (
                    <tr key={h.id} className="border-t border-line">
                      <td className="px-3 py-2 font-mono text-ink-2">{h.disputeId.slice(0, 8)}…</td>
                      <td className="px-3 py-2 text-right font-mono text-warning">−{formatPaise(h.amountPaise)}</td>
                      <td className="px-3 py-2 text-ink-3">{h.reason}</td>
                      <td className="px-3 py-2"><Badge tone={h.status === 'active' ? 'warning' : 'neutral'}>{h.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {deductions && deductions.adjustments.length > 0 && (
          <Card className="lg:col-span-2">
            <CardContent className="p-6">
              <SectionHeading kicker="Adjustments" title="Manual adjustments on this cycle" />
              <table className="w-full text-[12.5px]">
                <thead className="bg-bg-2/40">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-ink-3">Type</th>
                    <th className="px-3 py-2 text-right font-medium text-ink-3">Amount</th>
                    <th className="px-3 py-2 text-left font-medium text-ink-3">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {deductions.adjustments.map((a) => (
                    <tr key={a.id} className="border-t border-line">
                      <td className="px-3 py-2">
                        <Badge tone={a.direction === 'debit' ? 'danger' : 'success'} flat>{a.direction === 'debit' ? 'Deduction' : 'Credit'}</Badge>
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {a.direction === 'debit' ? '−' : '+'}{formatPaise(a.amountPaise)}
                      </td>
                      <td className="px-3 py-2 text-ink-3">{a.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {deductions && deductions.recoveries.length > 0 && (
          <Card className="lg:col-span-2">
            <CardContent className="p-6">
              <SectionHeading kicker="Recoveries" title="Recovering money overpaid earlier" />
              <table className="w-full text-[12.5px]">
                <thead className="bg-bg-2/40">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-ink-3">Refund</th>
                    <th className="px-3 py-2 text-left font-medium text-ink-3">Order</th>
                    <th className="px-3 py-2 text-right font-medium text-ink-3">Refunded</th>
                    <th className="px-3 py-2 text-right font-medium text-ink-3">Planned deduction</th>
                    <th className="px-3 py-2 text-left font-medium text-ink-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {deductions.recoveries.map((r) => (
                    <tr key={r.id} className="border-t border-line">
                      <td className="px-3 py-2 font-mono text-ink-2">{r.refundId.slice(0, 8)}…</td>
                      <td className="px-3 py-2 font-mono text-ink-2">{r.orderId.slice(0, 8)}…</td>
                      <td className="px-3 py-2 text-right font-mono">{formatPaise(r.refundedPaise)}</td>
                      <td className="px-3 py-2 text-right font-mono text-warning">−{formatPaise(r.plannedDebitPaise)}</td>
                      <td className="px-3 py-2"><Badge tone="neutral" flat>{r.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    </Page>
  );
}

function Row({ label, amount }: { label: string; amount: number }) {
  return (
    <li className="flex items-center justify-between py-2 text-[13px]">
      <span className="text-ink-2">{label}</span>
      <span className={`font-mono ${amount < 0 ? 'text-warning' : 'text-ink'}`}>
        {amount < 0 ? '−' : ''}
        {formatPaise(Math.abs(amount))}
      </span>
    </li>
  );
}
