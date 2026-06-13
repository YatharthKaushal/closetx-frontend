import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { api } from '@/lib/api';
import { formatPaise } from '@/lib/status';
import { useServerCsv } from '@/lib/csv';
import { unwrapMeta } from '@/lib/report';
import { useStoreScope } from '@/lib/store-scope';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DateRangePicker, type DateRangeValue } from '@/components/ui/date-range-picker';
import { Segmented } from '@/components/ui/segmented';
import { FreshnessLabel } from '@/components/ui/freshness-label';
import { BarChart } from '@/components/ui/bar-chart';
import { HBarChart } from '@/components/ui/hbar-chart';
import { ViewToggle, type ReportView } from '@/components/ui/view-toggle';

type Money = { taxableValuePaise: number; taxPaise: number; saleCount: number };
type Slab = {
  ratePct: number;
  gstRateBp: number;
  qty: number;
  taxableValuePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  taxPaise: number;
};
type GstSummary = {
  period: { since: string; until: string };
  byRate: Slab[];
  supplyType: { b2b: Money; b2c: Money };
  creditNotes: { taxableValuePaise: number; taxPaise: number; count: number };
  totals: {
    taxableValuePaise: number;
    cgstPaise: number;
    sgstPaise: number;
    igstPaise: number;
    taxPaise: number;
  };
};

type HsnRow = {
  hsn: string;
  ratePct: number;
  totalQty: number;
  taxableValuePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  taxPaise: number;
};
type GstHsnSummary = { period: { since: string; until: string }; rows: HsnRow[] };

type Channel = 'all' | 'pos' | 'online';
const CHANNEL_OPTS: { value: Channel; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pos', label: 'Counter' },
  { value: 'online', label: 'Online' },
];

function usePeriodParams(range: DateRangeValue, channel: Channel) {
  return useMemo(() => {
    const p: Record<string, string> = {};
    if (range.from) p.since = range.from.toISOString();
    if (range.to) p.until = range.to.toISOString();
    if (channel !== 'all') p.channel = channel;
    return p;
  }, [range, channel]);
}

function withQuery(path: string, params: Record<string, string>) {
  return `${path}${Object.keys(params).length ? `?${new URLSearchParams(params).toString()}` : ''}`;
}

/** GSTR-1 / GSTR-3B liability summary — per-slab tax, B2B/B2C split, credit notes. */
export function GstSummaryPanel() {
  const scope = useStoreScope();
  const [range, setRange] = useState<DateRangeValue>({ from: null, to: null });
  const [channel, setChannel] = useState<Channel>('all');
  const [view, setView] = useState<ReportView>('chart');
  const params = usePeriodParams(range, channel);

  const path = `${scope.basePath}/gst/summary`;
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'gst-summary', scope.basePath, params],
    queryFn: () => api<GstSummary>(withQuery(path, params)),
  });
  const meta = unwrapMeta(data);
  const exportCsv = useServerCsv('gst_summary', path, params);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-full max-w-xs">
            <DateRangePicker value={range} onChange={setRange} placeholder="This month" />
          </div>
          <Segmented options={CHANNEL_OPTS} value={channel} onChange={setChannel} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <FreshnessLabel generatedAtIst={meta?.generatedAtIst} />
          <ViewToggle value={view} onChange={setView} />
          <Button variant="outline" size="sm" iconLeft={<Download className="size-3.5" />} onClick={() => exportCsv()}>
            CSV
          </Button>
        </div>
      </div>

      {isLoading || !data ? (
        <Skeleton className="h-60" />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Taxable value" value={formatPaise(data.totals.taxableValuePaise)} />
            <Kpi label="GST collected" value={formatPaise(data.totals.taxPaise)} accent />
            <Kpi
              label="B2C sales"
              value={formatPaise(data.supplyType.b2c.taxableValuePaise)}
              sub={`${data.supplyType.b2c.saleCount} bills`}
            />
            <Kpi
              label="B2B sales"
              value={formatPaise(data.supplyType.b2b.taxableValuePaise)}
              sub={`${data.supplyType.b2b.saleCount} bills`}
            />
          </div>

          {view === 'chart' ? (
            <Card>
              <CardContent className="p-5">
                <div className="kicker mb-3">GST collected by rate slab</div>
                {data.byRate.length === 0 ? (
                  <EmptyHint />
                ) : (
                  <BarChart
                    labels={data.byRate.map((s) => `${s.ratePct}%`)}
                    values={data.byRate.map((s) => s.taxPaise)}
                    formatY={formatPaise}
                    color="var(--color-accent)"
                  />
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="border-b border-line text-left text-ink-3">
                      <Th>Rate</Th>
                      <Th right>Qty</Th>
                      <Th right>Taxable</Th>
                      <Th right>CGST</Th>
                      <Th right>SGST</Th>
                      <Th right>Total GST</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byRate.map((s) => (
                      <tr key={s.gstRateBp} className="border-t border-line first:border-t-0">
                        <Td>{s.ratePct}%</Td>
                        <Td right>{s.qty.toLocaleString('en-IN')}</Td>
                        <Td right mono>{formatPaise(s.taxableValuePaise)}</Td>
                        <Td right mono>{formatPaise(s.cgstPaise)}</Td>
                        <Td right mono>{formatPaise(s.sgstPaise)}</Td>
                        <Td right mono>{formatPaise(s.taxPaise)}</Td>
                      </tr>
                    ))}
                    {data.byRate.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-6 text-center text-ink-3">No sales in this period.</td></tr>
                    )}
                  </tbody>
                  {data.byRate.length > 0 && (
                    <tfoot>
                      <tr className="border-t-2 border-line font-medium">
                        <Td>Total</Td>
                        <Td right>—</Td>
                        <Td right mono>{formatPaise(data.totals.taxableValuePaise)}</Td>
                        <Td right mono>{formatPaise(data.totals.cgstPaise)}</Td>
                        <Td right mono>{formatPaise(data.totals.sgstPaise)}</Td>
                        <Td right mono>{formatPaise(data.totals.taxPaise)}</Td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </CardContent>
            </Card>
          )}

          {data.creditNotes.count > 0 && (
            <p className="text-[11.5px] text-ink-3">
              Excludes {data.creditNotes.count} credit note(s) / return(s) in this period
              ({formatPaise(data.creditNotes.taxableValuePaise)} taxable, {formatPaise(data.creditNotes.taxPaise)} GST) —
              net these against output liability when filing.
            </p>
          )}
        </>
      )}
    </div>
  );
}

/** HSN-wise summary — GSTR-1 Table 12. */
export function GstHsnPanel() {
  const scope = useStoreScope();
  const [range, setRange] = useState<DateRangeValue>({ from: null, to: null });
  const [channel, setChannel] = useState<Channel>('all');
  const [view, setView] = useState<ReportView>('table');
  const params = usePeriodParams(range, channel);

  const path = `${scope.basePath}/gst/hsn-summary`;
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'gst-hsn', scope.basePath, params],
    queryFn: () => api<GstHsnSummary>(withQuery(path, params)),
  });
  const meta = unwrapMeta(data);
  const exportCsv = useServerCsv('gst_hsn_summary', path, params);
  const rows = data?.rows ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-full max-w-xs">
            <DateRangePicker value={range} onChange={setRange} placeholder="This month" />
          </div>
          <Segmented options={CHANNEL_OPTS} value={channel} onChange={setChannel} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <FreshnessLabel generatedAtIst={meta?.generatedAtIst} />
          <ViewToggle value={view} onChange={setView} />
          <Button variant="outline" size="sm" iconLeft={<Download className="size-3.5" />} onClick={() => exportCsv()}>
            CSV
          </Button>
        </div>
      </div>

      {isLoading || !data ? (
        <Skeleton className="h-60" />
      ) : view === 'chart' ? (
        <Card>
          <CardContent className="p-5">
            <div className="kicker mb-3">Taxable value by HSN</div>
            {rows.length === 0 ? (
              <EmptyHint />
            ) : (
              <HBarChart
                color="var(--color-accent)"
                rows={rows.map((r) => ({
                  label: `${r.hsn} · ${r.ratePct}%`,
                  value: r.taxableValuePaise,
                  display: formatPaise(r.taxableValuePaise),
                  sub: `${r.totalQty} units`,
                }))}
              />
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-line text-left text-ink-3">
                  <Th>HSN</Th>
                  <Th right>Rate</Th>
                  <Th right>Qty</Th>
                  <Th right>Taxable</Th>
                  <Th right>CGST</Th>
                  <Th right>SGST</Th>
                  <Th right>Total GST</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.hsn}-${r.ratePct}-${i}`} className="border-t border-line first:border-t-0">
                    <Td mono>{r.hsn}</Td>
                    <Td right>{r.ratePct}%</Td>
                    <Td right>{r.totalQty.toLocaleString('en-IN')}</Td>
                    <Td right mono>{formatPaise(r.taxableValuePaise)}</Td>
                    <Td right mono>{formatPaise(r.cgstPaise)}</Td>
                    <Td right mono>{formatPaise(r.sgstPaise)}</Td>
                    <Td right mono>{formatPaise(r.taxPaise)}</Td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-6 text-center text-ink-3">No sales in this period.</td></tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Kpi({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-[11.5px] uppercase tracking-wide text-ink-3">{label}</div>
        <div className={`mt-1 font-mono text-[18px] leading-none ${accent ? 'text-success' : 'text-ink'}`}>{value}</div>
        {sub && <div className="mt-1 text-[11px] text-ink-4">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function EmptyHint() {
  return <div className="py-10 text-center text-[13px] text-ink-3">No counter sales in this period.</div>;
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th className={`px-4 py-2.5 font-medium ${right ? 'text-right' : ''}`}>{children}</th>;
}
function Td({ children, right, mono }: { children: React.ReactNode; right?: boolean; mono?: boolean }) {
  return (
    <td className={`px-4 py-2.5 ${right ? 'text-right' : ''} ${mono ? 'font-mono' : ''} text-ink`}>{children}</td>
  );
}

/** Standalone page wrappers — kept for admin store-scoped report routes. */
export default function ReportGstSummary() {
  return (
    <Page>
      <PageHeader
        kicker="Analytics · GST"
        title="GST summary"
        description="Counter-sale output GST by rate slab, with B2B/B2C split — the figures for GSTR-1 / GSTR-3B."
      />
      <GstSummaryPanel />
    </Page>
  );
}

export function ReportGstHsn() {
  return (
    <Page>
      <PageHeader
        kicker="Analytics · GST"
        title="HSN summary"
        description="HSN-wise quantity, taxable value and tax — GSTR-1 Table 12, ready to export."
      />
      <GstHsnPanel />
    </Page>
  );
}
