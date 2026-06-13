import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Send } from 'lucide-react';
import { api } from '@/lib/api';
import { formatAge, formatPaise } from '@/lib/status';
import type { EarlyDisbursementRequest } from '@/lib/types';
import { Page, PageHeader, SectionHeading } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/input';

export default function RetailerEarlyDisbursement() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['retailer', 'early-disbursement'],
    queryFn: () => api<EarlyDisbursementRequest[]>('/retailer/early-disbursement'),
  });
  const list = data ?? [];

  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    const amountRupees = Number(amount);
    if (!Number.isFinite(amountRupees) || amountRupees <= 0) { toast.error('Enter a positive amount'); return; }
    if (reason.trim().length < 5) { toast.error('Reason must be at least 5 characters'); return; }
    setSubmitting(true);
    try {
      await api('/retailer/early-disbursement', {
        method: 'POST',
        body: { amountPaise: Math.round(amountRupees * 100), reason: reason.trim() },
      });
      toast.success('Request submitted. Admin reviews within 1 business day.');
      setAmount('');
      setReason('');
      void queryClient.invalidateQueries({ queryKey: ['retailer', 'early-disbursement'] });
    } catch {
      toast.error('Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Page>
      <PageHeader
        kicker="Payouts"
        title="Early payout"
        description="Take part of your available balance before your next scheduled payout. Needs admin approval and a small fee for releasing it early."
      />

      <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
        <Card>
          <CardContent className="p-6 space-y-3">
            <SectionHeading kicker="New request" title="Compose" />
            <div>
              <Label htmlFor="amount" required>Amount (₹)</Label>
              <Input id="amount" type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="reason" required>Reason</Label>
              <Textarea id="reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. inventory restock for festival sale" />
            </div>
            <Button variant="accent" iconLeft={<Send className="size-3.5" />} onClick={() => void submit()} disabled={submitting}>Submit request</Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <SectionHeading kicker="History" title={`${list.length} past request${list.length === 1 ? '' : 's'}`} />
            {isLoading ? <Skeleton className="h-32" /> : list.length === 0 ? (
              <Empty kicker="None" title="No early payout requests yet." />
            ) : (
              <ul className="space-y-2">
                {list.map((r) => (
                  <li key={r.id} className="rounded-md border border-line bg-bg-2/30 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[13px] text-ink">{formatPaise(r.amountPaise)}</span>
                      <Badge tone={r.status === 'approved' ? 'success' : r.status === 'rejected' ? 'danger' : 'warning'}>{r.status}</Badge>
                    </div>
                    <p className="mt-1 text-[12px] text-ink-2">{r.reason}</p>
                    <div className="mt-1 text-[11.5px] text-ink-4">
                      Requested {formatAge(r.requestedAt)}
                      {r.decidedAt && <> · Decided {formatAge(r.decidedAt)}</>}
                    </div>
                    {r.decisionNote && <p className="mt-1 text-[11.5px] italic text-ink-3">{r.decisionNote}</p>}
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
