import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Download } from 'lucide-react';
import { api } from '@/lib/api';
import { formatPaise } from '@/lib/status';
import type { TailOfCycleRow } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';

export function LeftoversPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'tail-of-cycle'],
    queryFn: () => api<TailOfCycleRow[]>('/admin/tail-of-cycle'),
  });
  const list = data ?? [];
  const total = list.reduce((n, r) => n + r.unreconciledPaise, 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-3xl text-[13px] text-ink-3 leading-relaxed">
          Amounts left over at the end of a payout cycle that haven't been matched to the bank yet.
          Check the hints for why, then re-run the matching on each row.
        </p>
        <Button variant="outline" size="sm" className="shrink-0" iconLeft={<Download className="size-3.5" />}>Export CSV</Button>
      </div>

      <div className="mb-4 inline-flex items-center gap-2 rounded-md border border-warning/40 bg-warning-soft/40 px-3 py-2">
        <span className="text-[12px] uppercase tracking-wide font-semibold text-warning">Total not yet matched</span>
        <span className="font-mono text-[14px] text-ink">{formatPaise(total)}</span>
      </div>

      {isLoading ? <Skeleton className="h-32" /> : list.length === 0 ? (
        <Empty kicker="All clear" title="Nothing left to match." />
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-[12.5px]">
              <thead className="bg-bg-2/40">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-ink-3">Store</th>
                  <th className="px-3 py-2 text-left font-medium text-ink-3">Period</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Not yet matched</th>
                  <th className="px-3 py-2 text-left font-medium text-ink-3">Hints</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={`${r.storeId}_${r.period}`} className="border-t border-line">
                    <td className="px-3 py-2 text-ink">{r.storeName}</td>
                    <td className="px-3 py-2 font-mono text-ink-2">{r.period}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatPaise(r.unreconciledPaise)}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {r.reasonHints.map((h) => <Badge key={h} tone="warning" flat>{h}</Badge>)}
                      </div>
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <Button asChild variant="outline" size="sm" iconRight={<ArrowUpRight className="size-3.5" />}>
                        <Link to={`/admin/money?tab=payouts&storeId=${r.storeId}&period=${r.period}`}>Investigate</Link>
                      </Button>
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
