import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Send } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { formatAge, mechanismLabel } from '@/lib/status';
import type { ConsumerSummary, Promotion, TargetedDrop } from '@/lib/types';
import { Page, PageHeader, SectionHeading } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MultiSelect } from '@/components/ui/multi-select';

type Cohort = 'all' | 'loyalty_gold' | 'loyalty_silver' | 'specific_consumers';

export default function AdminTargetedDrops() {
  const qc = useQueryClient();

  const drops = useQuery({
    queryKey: ['admin', 'promotions', 'drops'],
    queryFn: () => api<TargetedDrop[]>('/admin/promotions/targeted-drops'),
  });

  const promos = useQuery({
    queryKey: ['admin', 'promotions', 'platform'],
    queryFn: () => api<Promotion[]>('/admin/promotions?page=1&pageSize=100'),
  });

  // filter to platform-wide coupon/voucher promos suitable for targeted drops
  const eligible = (promos.data ?? []).filter(
    (p) => !p.storeId && (p.mechanism === 'coupon' || p.mechanism === 'voucher') && p.effectiveStatus !== 'revoked' && p.effectiveStatus !== 'expired',
  );

  const [promoId, setPromoId] = useState('');
  const [cohort, setCohort] = useState<Cohort>('all');
  const [consumerIds, setConsumerIds] = useState<string[]>([]);

  const consumers = useQuery({
    queryKey: ['admin', 'consumers', 'targeted-drop'],
    queryFn: () => api<ConsumerSummary[]>('/admin/consumers?limit=200'),
    enabled: cohort === 'specific_consumers',
  });
  const consumerOptions = (consumers.data ?? []).map((c) => ({
    value: c.id,
    label: c.name || c.email,
    hint: c.email,
  }));

  const submit = useMutation({
    mutationFn: () => {
      return api('/admin/targeted-drops', {
        method: 'POST',
        body: {
          promotionId: promoId,
          cohort,
          ...(cohort === 'specific_consumers' && consumerIds.length ? { consumerIds } : {}),
        },
      });
    },
    onSuccess: () => {
      toast.success('Drop queued — consumers will receive it in their wallets');
      setPromoId('');
      setCohort('all');
      setConsumerIds([]);
      void qc.invalidateQueries({ queryKey: ['admin', 'promotions', 'drops'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed to queue drop'),
  });

  const list = drops.data ?? [];
  const canSubmit = !!promoId;

  return (
    <Page>
      <PageHeader
        kicker="Drops"
        title="Targeted drops"
        description="Push a coupon or voucher straight into selected consumer wallets — they redeem from their wallet without entering a code."
        actions={
          <Button asChild variant="ghost" size="sm" iconLeft={<ArrowLeft className="size-3.5" />}>
            <Link to="/admin/promotions">Back to promotions</Link>
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
        <Card>
          <CardContent className="p-6 space-y-4">
            <SectionHeading kicker="New drop" title="Compose" />
            <div>
              <Label required>Source promotion</Label>
              {promos.isLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : eligible.length === 0 ? (
                <p className="text-[12.5px] text-ink-3 italic mt-1">
                  No eligible platform-wide coupon/voucher promotions. Create one first.
                </p>
              ) : (
                <Select value={promoId} onValueChange={setPromoId}>
                  <SelectTrigger><SelectValue placeholder="Select a promotion…" /></SelectTrigger>
                  <SelectContent>
                    {eligible.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} <span className="ml-1 text-ink-3">· {mechanismLabel(p.mechanism)}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div>
              <Label required>Customer group</Label>
              <Select value={cohort} onValueChange={(v) => setCohort(v as Cohort)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All consumers</SelectItem>
                  <SelectItem value="loyalty_gold">Loyalty — Gold tier</SelectItem>
                  <SelectItem value="loyalty_silver">Loyalty — Silver tier</SelectItem>
                  <SelectItem value="specific_consumers">Specific consumers</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {cohort === 'specific_consumers' && (
              <div>
                <Label>Consumers</Label>
                <MultiSelect
                  options={consumerOptions}
                  value={consumerIds}
                  onChange={setConsumerIds}
                  placeholder={consumers.isLoading ? 'Loading consumers…' : 'Pick consumers'}
                  loading={consumers.isLoading}
                />
              </div>
            )}
            <Button
              variant="accent"
              iconLeft={<Send className="size-3.5" />}
              disabled={!canSubmit}
              loading={submit.isPending}
              onClick={() => submit.mutate()}
            >
              Push drop
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <SectionHeading kicker="History" title={`${list.length} past drop${list.length === 1 ? '' : 's'}`} />
            {drops.isLoading ? (
              <Skeleton className="h-32" />
            ) : list.length === 0 ? (
              <Empty kicker="None" title="No drops sent yet." />
            ) : (
              <ul className="space-y-2">
                {list.map((d) => (
                  <li key={d.id} className="rounded-md border border-line bg-bg-2/30 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-medium text-ink">{d.name}</span>
                      <Badge tone="info" flat>{d.cohortKind.replace(/_/g, ' ')}</Badge>
                    </div>
                    <div className="mt-0.5 text-[11.5px] text-ink-3">
                      {d.promotionName} · {d.audienceSize} pushed · {d.redemptionCount} redeemed · {formatAge(d.pushedAt)}
                    </div>
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
