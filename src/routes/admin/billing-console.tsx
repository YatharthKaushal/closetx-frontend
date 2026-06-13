import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Lock, Play } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { formatAge, formatPaise } from '@/lib/status';
import type { BillingMonthSummary } from '@/lib/types';
import { SectionHeading } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

const TONE: Record<BillingMonthSummary['status'], 'warning' | 'info' | 'success'> = {
  open: 'warning',
  closing: 'info',
  closed: 'success',
};

export function BillingPanel() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'billing-console'],
    queryFn: () => api<BillingMonthSummary[]>('/admin/billing-console'),
  });
  const months = data ?? [];
  const current = months.find((m) => m.status === 'open');
  const closing = months.find((m) => m.status === 'closing');

  const close = useMutation({
    mutationFn: (period: string) =>
      api('/admin/billing/close', { method: 'POST', body: { period } }),
    onSuccess: () => {
      toast.success('Month close started');
      void qc.invalidateQueries({ queryKey: ['admin', 'billing-console'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Close failed'),
  });

  return (
    <div>
      <p className="mb-4 max-w-3xl text-[13px] text-ink-3 leading-relaxed">
        This month's billing, past months, and whether each month's GST file is ready. Closing the
        open month is final — you can't reopen it once closed.
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="p-6">
            <SectionHeading kicker="Open month" title={current?.period ?? '—'} />
            {!current ? (
              <p className="text-[12.5px] text-ink-3 italic">No open month.</p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <Stat label="Stores" value={String(current.storesIncluded)} />
                  <Stat label="Gross" value={formatPaise(current.totalGrossPaise)} />
                  <Stat label="Net" value={formatPaise(current.totalNetPaise)} />
                </div>
                <Button
                  variant="accent"
                  iconLeft={<Play className="size-3.5" />}
                  loading={close.isPending}
                  onClick={() => {
                    if (!confirm(`Close billing for ${current.period}? This is irreversible.`)) return;
                    close.mutate(current.period);
                  }}
                >
                  Trigger month close
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <SectionHeading kicker="Closing" title={closing?.period ?? 'Nothing closing'} />
            {!closing ? (
              <p className="text-[12.5px] text-ink-3 italic">No month is mid-close.</p>
            ) : (
              <>
                <p className="mb-3 text-[13px] text-ink-2">
                  Statements being generated for {closing.storesIncluded} stores. Total commission {formatPaise(closing.totalCommissionPaise)}.
                </p>
                <Badge tone="info"><Lock className="size-3 mr-1 inline" />New activity is locked out of this period</Badge>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <h2 className="mt-10 mb-3 text-[15px] font-semibold text-ink">Prior months</h2>
      {isLoading ? <Skeleton className="h-32" /> : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-[12.5px]">
              <thead className="bg-bg-2/40">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-ink-3">Period</th>
                  <th className="px-3 py-2 text-left font-medium text-ink-3">Status</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Stores</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Gross</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Commission</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Net</th>
                  <th className="px-3 py-2 text-left font-medium text-ink-3">Closed</th>
                  <th className="px-3 py-2 text-left font-medium text-ink-3">GST file</th>
                </tr>
              </thead>
              <tbody>
                {months.map((m) => (
                  <tr key={m.period} className="border-t border-line">
                    <td className="px-3 py-2 text-ink font-mono">{m.period}</td>
                    <td className="px-3 py-2"><Badge tone={TONE[m.status]}>{m.status}</Badge></td>
                    <td className="px-3 py-2 text-right">{m.storesIncluded}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatPaise(m.totalGrossPaise)}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatPaise(m.totalCommissionPaise)}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatPaise(m.totalNetPaise)}</td>
                    <td className="px-3 py-2 text-[11.5px] text-ink-3">{m.closedAt ? formatAge(m.closedAt) : '—'}</td>
                    <td className="px-3 py-2"><Badge tone={m.gstReturnStatus === 'ready' ? 'success' : 'warning'}>{m.gstReturnStatus}</Badge></td>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-bg-2/30 p-3">
      <div className="kicker mb-1">{label}</div>
      <div className="text-[16px] font-semibold text-ink">{value}</div>
    </div>
  );
}
