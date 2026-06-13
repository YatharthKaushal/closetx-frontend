import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { api } from '@/lib/api';
import { useServerCsv } from '@/lib/csv';
import { unwrapMeta } from '@/lib/report';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { FreshnessLabel } from '@/components/ui/freshness-label';

type Step = { label: string; count: number; dropoffPctFromPrevious: number };
type FunnelResp = { windowDays: number; steps: Step[] };

export default function AdminReportFunnel() {
  const path = '/admin/reports/funnel';
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'reports', 'funnel'],
    queryFn: () => api<FunnelResp>(path),
  });
  const meta = unwrapMeta(data);
  const steps = data?.steps ?? [];
  const top = steps[0]?.count ?? 1;
  const exportCsv = useServerCsv('funnel', path);

  return (
    <Page>
      <PageHeader
        kicker="Reports"
        title="Shopper journey"
        description="Search → product → bag → checkout → delivered. Find where the most shoppers drop off."
        actions={
          <>
            <FreshnessLabel generatedAtIst={meta?.generatedAtIst} />
            <Button variant="outline" size="sm" iconLeft={<Download className="size-3.5" />} onClick={() => exportCsv()}>
              Export CSV
            </Button>
          </>
        }
      />

      {isLoading ? (
        <Skeleton className="h-40" />
      ) : (
        <Card>
          <CardContent className="p-6 space-y-3">
            {steps.map((r, i) => {
              const widthPct = (r.count / top) * 100;
              return (
                <div key={r.label}>
                  <div className="mb-1 flex items-baseline justify-between text-[12.5px]">
                    <span className="text-ink">{i + 1}. {r.label}</span>
                    <span className="font-mono text-ink-2">
                      {r.count.toLocaleString('en-IN')}
                      {i > 0 && <span className="ml-2 text-warning">−{r.dropoffPctFromPrevious.toFixed(1)}%</span>}
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-bg-2/60 overflow-hidden">
                    <div className="h-full bg-accent/80" style={{ width: `${widthPct}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </Page>
  );
}
