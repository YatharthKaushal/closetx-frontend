import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Receipt } from 'lucide-react';
import { api } from '@/lib/api';
import { formatPaise } from '@/lib/status';
import { usePermission } from '@/lib/use-permission';
import type { PosSaleListRow } from '@/lib/pos-types';
import { Page, PageHeader } from '@/components/ui/page';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Empty } from '@/components/ui/empty';
import { Button } from '@/components/ui/button';
import { DateRangePicker, type DateRangeValue } from '@/components/ui/date-range-picker';

export default function PosSales() {
  const canView = usePermission('pos.view');
  const [q, setQ] = useState('');
  const [range, setRange] = useState<DateRangeValue>({ from: null, to: null });

  // `to` covers the whole day — push the end to 23:59:59 unless the picker already set a time.
  const fromIso = range.from ? range.from.toISOString() : '';
  const toIso = range.to ? endOfDay(range.to).toISOString() : '';

  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (fromIso) params.set('from', fromIso);
  if (toIso) params.set('to', toIso);

  const { data } = useQuery({
    queryKey: ['retailer', 'pos', 'sales', q, fromIso, toIso],
    queryFn: () => api<{ rows: PosSaleListRow[]; total: number }>(`/retailer/pos/sales?${params}`),
    enabled: canView,
  });

  if (!canView) return <Page><Empty title="Not authorized" description="You don't have access to counter sales." /></Page>;

  const rows = data?.rows ?? [];

  return (
    <Page>
      <PageHeader title="Counter sales" description="Offline in-store bills" />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input placeholder="Invoice no…" value={q} onChange={(e) => setQ(e.target.value)} className="w-48" />
        <div className="w-72">
          <DateRangePicker value={range} onChange={setRange} withTime={false} placeholder="Filter by date" />
        </div>
        <Link to="/retailer/pos" className="ml-auto">
          <Button variant="accent" size="sm">Open register</Button>
        </Link>
      </div>

      {rows.length === 0 ? (
        <Empty icon={<Receipt className="size-5" />} title="No sales yet" description="Counter bills will appear here." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-bg">
          <table className="w-full text-[13px]">
            <thead className="bg-bg-2 text-[11px] uppercase text-ink-4">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Invoice</th>
                <th className="px-3 py-2 text-left font-medium">Customer</th>
                <th className="px-3 py-2 text-left font-medium">When</th>
                <th className="px-3 py-2 text-right font-medium">Amount</th>
                <th className="px-3 py-2 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-line hover:bg-bg-2">
                  <td className="px-3 py-2">
                    <Link to={`/retailer/pos/sales/${r.id}`} className="font-medium text-accent hover:underline">
                      {r.invoiceNumber ?? r.id.slice(0, 10)}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-ink-3">{r.customerName || r.customerPhone || 'Walk-in'}</td>
                  <td className="px-3 py-2 text-ink-4">
                    {r.completedAt ? new Date(r.completedAt).toLocaleString('en-IN') : ''}
                  </td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums">{formatPaise(r.payablePaise)}</td>
                  <td className="px-3 py-2 text-right">
                    {r.status === 'voided' ? (
                      <Badge tone="danger">Voided</Badge>
                    ) : r.isReturn ? (
                      <Badge tone="warning">Return</Badge>
                    ) : (
                      <Badge tone="success">Paid</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Page>
  );
}

function endOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(23, 59, 59, 999);
  return out;
}
