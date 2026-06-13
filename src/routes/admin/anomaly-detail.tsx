import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Flag, PauseCircle, ShieldAlert, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { formatAge } from '@/lib/status';
import type { PromotionAnomaly } from '@/lib/types';
import { Page, PageHeader, SectionHeading } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MetaList } from '@/components/ui/meta-list';
import { ReasonActionDialog } from '@/components/admin/reason-action-dialog';

export default function AdminAnomalyDetail() {
  const { id } = useParams<{ id: string }>();
  const [pausing, setPausing] = useState(false);
  const [revoking, setRevoking] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'promotions', 'anomalies', id],
    queryFn: () => api<PromotionAnomaly>(`/admin/promotions/anomalies/${id}`),
    enabled: Boolean(id),
  });

  if (isLoading) return <Page><Skeleton className="h-72" /></Page>;
  if (!data) return <Page><PageHeader title="Anomaly not found" /></Page>;

  return (
    <Page>
      <PageHeader
        kicker="Anomaly"
        title={data.promotionName}
        description={`Detected ${formatAge(data.detectedAt)} · ${data.kind.replace(/_/g, ' ')}`}
        actions={
          <Button asChild variant="ghost" size="sm" iconLeft={<ArrowLeft className="size-3.5" />}>
            <Link to="/admin/promotions">Back</Link>
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={data.severity === 'high' ? 'danger' : data.severity === 'medium' ? 'warning' : 'neutral'} pulse={data.severity === 'high'}>
          <ShieldAlert className="size-3 mr-1 inline" />
          {data.severity} severity
        </Badge>
        <Badge tone={data.status === 'open' ? 'warning' : data.status === 'acknowledged' ? 'info' : 'success'}>{data.status}</Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="p-6">
            <SectionHeading kicker="Why flagged" title="What we noticed" />
            <MetaList
              cols={1}
              items={[
                { label: 'Metric', value: data.metric },
                { label: 'Observed', value: data.value, mono: true },
                { label: 'Threshold', value: data.threshold, mono: true },
                { label: 'Consumers involved', value: data.consumersInvolved.toLocaleString('en-IN') },
                { label: 'Promotion ID', value: data.promotionId, mono: true },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <SectionHeading kicker="Actions" title="Mitigate" />
            <p className="mb-3 text-[12.5px] text-ink-3">
              Pause to halt new redemptions while you investigate. Revoke is irreversible — outstanding
              codes stop working immediately. Flagging consumers triggers fraud review.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" iconLeft={<PauseCircle className="size-3.5" />} onClick={() => setPausing(true)}>
                Pause promotion
              </Button>
              <Button variant="outline" className="text-danger border-danger/40 hover:bg-danger/5" iconLeft={<XCircle className="size-3.5" />} onClick={() => setRevoking(true)}>
                Revoke promotion
              </Button>
              <Button variant="ghost" iconLeft={<Flag className="size-3.5" />} onClick={() => toast.success(`${data.consumersInvolved} consumer(s) flagged for review (mock)`)}>
                Flag involved consumers
              </Button>
              <Button variant="ghost" onClick={() => toast.success('Marked acknowledged (mock)')}>
                Mark acknowledged
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <ReasonActionDialog
        open={pausing}
        title="Pause this promotion?"
        description="Halts new redemptions immediately. You can resume after investigating."
        confirmLabel="Pause"
        onClose={() => setPausing(false)}
        onConfirm={(reason) => { toast.success(`Paused (mock): ${reason}`); setPausing(false); }}
      />
      <ReasonActionDialog
        open={revoking}
        title="Revoke this promotion?"
        description="Irreversible. All outstanding codes stop working immediately and the promotion is marked revoked in audit."
        confirmLabel="Revoke"
        danger
        onClose={() => setRevoking(false)}
        onConfirm={(reason) => { toast.success(`Revoked (mock): ${reason}`); setRevoking(false); }}
      />
    </Page>
  );
}
