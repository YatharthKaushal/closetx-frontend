import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { api } from '@/lib/api';
import { useServerCsv } from '@/lib/csv';
import { unwrapMeta } from '@/lib/report';
import { useStoreScope } from '@/lib/store-scope';
import {
  type ComplianceResponse,
  type ComplianceVerdict,
  verdictTone,
} from '@/lib/compliance-floors';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { FreshnessLabel } from '@/components/ui/freshness-label';
import { ViewToggle, type ReportView } from '@/components/ui/view-toggle';

function bp(n: number) { return `${(n / 100).toFixed(1)}%`; }
function msDuration(ms: number) {
  if (ms <= 0) return '—';
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

type MetricRow = {
  label: string;
  valueBp: number;
  /** Threshold and its direction: floor = stay above, ceiling = stay below. */
  thresholdBp: number | null;
  direction: 'floor' | 'ceiling';
  sub: string;
  verdict: ComplianceVerdict;
};

/** Compliance scorecard — each metric drawn against its floor/ceiling marker. */
export function CompliancePanel() {
  const scope = useStoreScope();
  const path = `${scope.basePath}/compliance`;
  const [view, setView] = useState<ReportView>('chart');

  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'compliance', scope.basePath],
    queryFn: () => api<ComplianceResponse>(path),
  });
  const meta = unwrapMeta(data);
  const exportCsv = useServerCsv('compliance', path);

  const metrics: MetricRow[] = data
    ? [
        {
          label: 'Acceptance',
          valueBp: data.metrics.acceptance.valueBp,
          thresholdBp: data.metrics.acceptance.floorBp ?? null,
          direction: 'floor',
          sub: `avg accept ${msDuration(data.metrics.acceptance.avgAcceptMs ?? 0)}`,
          verdict: data.metrics.acceptance.verdict,
        },
        {
          label: 'Fulfilment',
          valueBp: data.metrics.fulfilment.valueBp,
          thresholdBp: data.metrics.fulfilment.floorBp ?? null,
          direction: 'floor',
          sub: `avg end-to-end ${msDuration(data.metrics.fulfilment.avgEndToEndMs ?? 0)}`,
          verdict: data.metrics.fulfilment.verdict,
        },
        {
          label: 'Dispute rate',
          valueBp: data.metrics.disputeRate.valueBp,
          thresholdBp: data.metrics.disputeRate.ceilBp ?? null,
          direction: 'ceiling',
          sub: `${data.metrics.disputeRate.count ?? 0} disputes`,
          verdict: data.metrics.disputeRate.verdict,
        },
        {
          label: 'Return rate',
          valueBp: data.metrics.returnRate.valueBp,
          thresholdBp: data.metrics.returnRate.ceilBp ?? null,
          direction: 'ceiling',
          sub: `${data.metrics.returnRate.count ?? 0} returns`,
          verdict: data.metrics.returnRate.verdict,
        },
      ]
    : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <FreshnessLabel generatedAtIst={meta?.generatedAtIst} />
        <ViewToggle value={view} onChange={setView} />
        <Button variant="outline" size="sm" iconLeft={<Download className="size-3.5" />} onClick={() => exportCsv()}>
          CSV
        </Button>
      </div>

      {isLoading || !data ? (
        <Skeleton className="h-60" />
      ) : view === 'chart' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {metrics.map((m) => (
            <MetricGauge key={m.label} m={m} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-[12.5px]">
              <thead className="bg-bg-2/40">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-ink-3">Metric</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Value</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Required</th>
                  <th className="px-3 py-2 text-left font-medium text-ink-3">Detail</th>
                  <th className="px-3 py-2 text-left font-medium text-ink-3">Verdict</th>
                </tr>
              </thead>
              <tbody>
                {metrics.map((m) => (
                  <tr key={m.label} className="border-t border-line">
                    <td className="px-3 py-2 text-ink">{m.label}</td>
                    <td className="px-3 py-2 text-right font-mono">{bp(m.valueBp)}</td>
                    <td className="px-3 py-2 text-right font-mono text-ink-3">
                      {m.thresholdBp != null
                        ? `${m.direction === 'floor' ? '≥' : '≤'} ${bp(m.thresholdBp)}`
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-ink-3">{m.sub}</td>
                    <td className="px-3 py-2"><Badge tone={verdictTone(m.verdict)} flat>{m.verdict}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {data && (
        <div className="text-[11.5px] text-ink-4">
          Window: {new Date(data.windowStart).toLocaleDateString('en-IN')} →{' '}
          {new Date(data.windowEnd).toLocaleDateString('en-IN')} · {data.ordersTotal} orders ·{' '}
          {data.itemsTotal} items.
        </div>
      )}
    </div>
  );
}

/** Big number + a bullet bar with the floor/ceiling tick so "how close to the
 *  line am I" reads at a glance. */
function MetricGauge({ m }: { m: MetricRow }) {
  const tone = verdictTone(m.verdict);
  // Scale the bar to the larger of value/threshold with headroom; both fit.
  const scaleBp = Math.max(m.valueBp, m.thresholdBp ?? 0, 1) * 1.25;
  const valuePct = Math.min(100, (m.valueBp / scaleBp) * 100);
  const tickPct = m.thresholdBp != null ? Math.min(100, (m.thresholdBp / scaleBp) * 100) : null;
  const barColor =
    tone === 'success' ? 'var(--color-success)' : tone === 'warning' ? 'var(--color-warning)' : 'var(--color-danger)';

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="text-[11.5px] uppercase tracking-wide text-ink-3">{m.label}</div>
          <Badge tone={tone} flat>{m.verdict}</Badge>
        </div>
        <div className="mt-1.5 font-mono text-[22px] leading-none text-ink">{bp(m.valueBp)}</div>
        <div className="relative mt-3 h-2.5 overflow-visible rounded-full bg-bg-3">
          <div
            className="h-full rounded-full transition-[width] duration-500 ease-out"
            style={{ width: `${Math.max(1.5, valuePct)}%`, background: barColor, opacity: 0.9 }}
          />
          {tickPct != null && (
            <div
              className="absolute -top-1 bottom-[-4px] w-0.5 rounded bg-ink"
              style={{ left: `${tickPct}%` }}
              title={`${m.direction === 'floor' ? 'Floor' : 'Ceiling'} ${bp(m.thresholdBp!)}`}
            />
          )}
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-ink-4">
          <span>{m.sub}</span>
          {m.thresholdBp != null && (
            <span className="font-mono">
              {m.direction === 'floor' ? 'stay above' : 'stay below'} {bp(m.thresholdBp)}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/** Standalone page wrapper — kept for the admin store-scoped report routes. */
export default function ReportCompliance() {
  return (
    <Page>
      <PageHeader
        kicker="Analytics"
        title="Compliance — trailing 30 days"
        description="How you're doing on accepting orders, on-time delivery, disputes, and returns, against the minimum required."
      />
      <CompliancePanel />
    </Page>
  );
}
