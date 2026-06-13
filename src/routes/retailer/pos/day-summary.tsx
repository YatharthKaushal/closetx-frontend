import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatPaise } from '@/lib/status';
import type { PosDaySummary } from '@/lib/pos-types';
import { Page, PageHeader } from '@/components/ui/page';
import { Input } from '@/components/ui/input';

export default function PosDaySummaryPage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const { data } = useQuery({
    queryKey: ['retailer', 'pos', 'day-summary', date],
    queryFn: () => api<PosDaySummary>(`/retailer/pos/summary?date=${date}`),
  });

  return (
    <Page>
      <PageHeader
        title="Day summary"
        description="Counter takings — a Z-report style close-of-day view"
        actions={<Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />}
      />
      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Sales" value={String(data.saleCount)} />
            <Stat label="Items sold" value={String(data.itemCount)} />
            <Stat label="Gross takings" value={formatPaise(data.grossPayablePaise)} />
            <Stat label="Tax collected" value={formatPaise(data.taxPaise)} />
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-line bg-bg p-4">
              <h3 className="mb-3 text-[13px] font-semibold text-ink">By tender</h3>
              <div className="space-y-1.5 text-[13px]">
                {(['cash', 'card', 'upi'] as const).map((m) => (
                  <div key={m} className="flex justify-between">
                    <span className="uppercase text-ink-3">{m}</span>
                    <span className="tabular-nums">{formatPaise(data.byTender[m] ?? 0)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-line bg-bg p-4">
              <h3 className="mb-3 text-[13px] font-semibold text-ink">Adjustments</h3>
              <div className="space-y-1.5 text-[13px]">
                <div className="flex justify-between"><span className="text-ink-3">Taxable value</span><span className="tabular-nums">{formatPaise(data.taxableValuePaise)}</span></div>
                <div className="flex justify-between"><span className="text-ink-3">Returns / refunds</span><span className="tabular-nums">{formatPaise(data.refundsPaise)}</span></div>
                <div className="flex justify-between"><span className="text-ink-3">Return count</span><span className="tabular-nums">{data.returnCount}</span></div>
              </div>
            </div>
          </div>
        </>
      )}
    </Page>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-bg p-4">
      <div className="text-[11px] uppercase text-ink-4">{label}</div>
      <div className="mt-1 text-[20px] font-semibold tabular-nums text-ink">{value}</div>
    </div>
  );
}
