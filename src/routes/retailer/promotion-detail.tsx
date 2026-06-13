import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Pause, Play, X } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import {
  discountTypeLabel,
  formatDiscount,
  mechanismLabel,
  promotionStatusMeta,
} from '@/lib/status';
import type { Promotion } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { MetaList } from '@/components/ui/meta-list';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function RetailerPromotionDetail() {
  const { id = '' } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const promo = useQuery({
    queryKey: ['retailer', 'promotion', id],
    queryFn: () => api<Promotion>(`/retailer/promotions/${id}`),
  });

  const lifecycle = useMutation({
    mutationFn: ({ action, reason }: { action: 'pause' | 'resume' | 'revoke' | 'activate'; reason?: string | undefined }) =>
      api<Promotion>(`/retailer/promotions/${id}/${action}`, {
        method: 'POST',
        body: reason ? { reason } : {},
      }),
    onSuccess: (p) => {
      toast.success(promotionStatusMeta(p.effectiveStatus).label);
      setReasonDialog(null);
      setReasonText('');
      void qc.invalidateQueries({ queryKey: ['retailer', 'promotion', id] });
      void qc.invalidateQueries({ queryKey: ['retailer', 'promotions'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed'),
  });

  const [reasonDialog, setReasonDialog] = useState<null | 'pause' | 'revoke'>(null);
  const [reasonText, setReasonText] = useState('');

  if (promo.isLoading) {
    return (
      <Page>
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="mt-4 h-72" />
      </Page>
    );
  }
  if (promo.isError || !promo.data) {
    return (
      <Page>
        <Empty
          kicker="Not found"
          title="Couldn't find this promotion."
          action={<Button asChild variant="outline"><Link to="/retailer/promotions">Back</Link></Button>}
        />
      </Page>
    );
  }

  const p = promo.data;
  const meta = promotionStatusMeta(p.effectiveStatus);
  const canPause = p.effectiveStatus === 'active' || p.effectiveStatus === 'scheduled';
  const canResume = p.effectiveStatus === 'paused';
  const canRevoke = !['expired', 'exhausted', 'revoked'].includes(p.effectiveStatus);
  const canActivate = p.effectiveStatus === 'draft';

  return (
    <Page>
      <Link
        to="/retailer/promotions"
        className="mb-3 inline-flex items-center gap-1.5 text-[12px] uppercase tracking-[0.16em] text-ink-3 hover:text-ink"
      >
        <ArrowLeft className="size-3.5" />
        All promotions
      </Link>

      <PageHeader
        kicker={`${mechanismLabel(p.mechanism)} · ${discountTypeLabel(p.discountType)}`}
        title={<em>{p.name}</em>}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={meta.tone}>{meta.label}</Badge>
          </div>
        }
      />

      <div className="-mt-2 mb-8 flex flex-wrap items-center gap-2 border-b border-rule pb-4">
        {canActivate && (
          <Button
            variant="ink"
            size="sm"
            caps
            iconLeft={<Play className="size-3.5" />}
            onClick={() => lifecycle.mutate({ action: 'activate' })}
            loading={lifecycle.isPending && lifecycle.variables?.action === 'activate'}
          >
            Activate
          </Button>
        )}
        {canPause && (
          <Button
            variant="outline"
            size="sm"
            caps
            iconLeft={<Pause className="size-3.5" />}
            onClick={() => setReasonDialog('pause')}
            loading={lifecycle.isPending && lifecycle.variables?.action === 'pause'}
          >
            Pause
          </Button>
        )}
        {canResume && (
          <Button
            variant="ink"
            size="sm"
            caps
            iconLeft={<Play className="size-3.5" />}
            onClick={() => lifecycle.mutate({ action: 'resume' })}
            loading={lifecycle.isPending && lifecycle.variables?.action === 'resume'}
          >
            Resume
          </Button>
        )}
        {canRevoke && (
          <Button
            variant="danger"
            size="sm"
            caps
            iconLeft={<X className="size-3.5" />}
            onClick={() => setReasonDialog('revoke')}
            loading={lifecycle.isPending && lifecycle.variables?.action === 'revoke'}
          >
            Revoke
          </Button>
        )}
        <span className="ml-auto font-mono text-[11px] tracking-wider text-ink-3">{p.id}</span>
      </div>

      <div className="grid gap-12 md:grid-cols-2">
        <MetaList
          items={[
            { label: 'Discount', value: formatDiscount(p.discountType, p.config) },
            {
              label: 'Validity',
              value: `${new Date(p.validFrom).toLocaleString('en-IN')} → ${new Date(p.validUntil).toLocaleString('en-IN')}`,
            },
            {
              label: 'Total redemptions',
              value:
                p.totalUses != null
                  ? `${p.redeemedCount.toLocaleString('en-IN')} / ${p.totalUses.toLocaleString('en-IN')}`
                  : `${p.redeemedCount.toLocaleString('en-IN')} / ∞`,
              mono: true,
            },
            {
              label: 'Per consumer',
              value: p.perConsumerLimit != null ? String(p.perConsumerLimit) : '∞',
              mono: true,
            },
          ]}
        />
        <div className="space-y-5">
          <div>
            <h3 className="kicker text-ink-3 mb-2">Advanced settings</h3>
            <pre className="rounded-xs border border-rule bg-paper-2/40 p-4 text-[12px] font-mono overflow-auto leading-relaxed text-ink-2">
              {JSON.stringify(p.config, null, 2)}
            </pre>
          </div>
          {Object.keys(p.scope).length > 0 && (
            <div>
              <h3 className="kicker text-ink-3 mb-2">Who it applies to</h3>
              <pre className="rounded-xs border border-rule bg-paper-2/40 p-4 text-[12px] font-mono overflow-auto leading-relaxed text-ink-2">
                {JSON.stringify(p.scope, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>

      <Dialog
        open={reasonDialog !== null}
        onOpenChange={(o) => !lifecycle.isPending && !o && setReasonDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{reasonDialog === 'revoke' ? 'Revoke promotion' : 'Pause promotion'}</DialogTitle>
            <DialogDescription>
              {reasonDialog === 'revoke'
                ? 'Revocation is permanent. The reason is recorded on the audit log.'
                : 'Why are you pausing? Optional, but recorded if provided.'}
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="reason" required={reasonDialog === 'revoke'}>Reason</Label>
            <textarea
              id="reason"
              rows={3}
              maxLength={500}
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              placeholder="e.g. stockout — pausing while we restock"
              className="mt-1 w-full rounded border border-line-2 bg-bg px-2 py-1 text-[13px]"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReasonDialog(null)} disabled={lifecycle.isPending}>Cancel</Button>
            <Button
              variant={reasonDialog === 'revoke' ? 'danger' : 'ink'}
              loading={lifecycle.isPending}
              disabled={reasonDialog === 'revoke' && reasonText.trim().length < 3}
              onClick={() =>
                lifecycle.mutate({
                  action: reasonDialog!,
                  reason: reasonText.trim() ? reasonText.trim() : undefined,
                })
              }
            >
              {reasonDialog === 'revoke' ? 'Revoke' : 'Pause'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
