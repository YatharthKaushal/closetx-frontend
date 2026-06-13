import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, ArrowLeft, Clock } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MetaList } from '@/components/ui/meta-list';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MediaGallery } from '@/components/ui/media-gallery';

interface ReturnRow {
  id: string;
  kind: 'door_return' | 'standard_return';
  storeDecision: 'pending' | 'accepted' | 'rejected';
  openedAt: string;
  storeDecidedAt: string | null;
  reasonText: string | null;
  reasonCategory: string | null;
  agentDisposition: 'kept' | 'returned' | 'refused' | null;
  verificationWindowExpiresAt: string | null;
  photos: string[];
  consumerPhotos: string[];
  storeRejectPhotos: string[];
  orderItem: { id: string; listingNameSnap: string; attributesLabelSnap: string; order: { id: string } };
  heldItems?: Array<{ id: string; status: string; holdingWindowExpiresAt: string }>;
}

type VerifyInput = {
  decision: 'accepted' | 'rejected';
  rejectPhotos?: string[] | undefined;
  reasonNote?: string | undefined;
};

export default function RetailerReturnDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['retailer', 'return', id],
    queryFn: () => api<ReturnRow>(`/retailer/returns/${id}`),
    enabled: Boolean(id),
  });

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectPhotos, setRejectPhotos] = useState<string[]>([]);
  const [rejectNote, setRejectNote] = useState('');

  const verify = useMutation({
    mutationFn: (input: VerifyInput) =>
      api(`/retailer/returns/${id}/verify`, { method: 'POST', body: input }),
    onSuccess: (_d, input) => {
      toast.success(`Return ${input.decision}`);
      setRejectOpen(false);
      setRejectPhotos([]);
      setRejectNote('');
      void qc.invalidateQueries({ queryKey: ['retailer', 'return', id] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Verify failed'),
  });

  if (isLoading) return <Page><Skeleton className="h-60" /></Page>;
  if (!data) return <Page><PageHeader title="Return not found" /></Page>;

  const agentTone =
    data.agentDisposition === 'refused'
      ? 'danger'
      : data.agentDisposition === 'returned'
        ? 'warning'
        : 'info';

  return (
    <Page>
      <PageHeader
        kicker="Return"
        title={`Return ${data.id}`}
        description={`Order ${data.orderItem.order.id} · ${data.orderItem.listingNameSnap}`}
        actions={
          <Button asChild variant="ghost" size="sm" iconLeft={<ArrowLeft className="size-3.5" />}>
            <Link to="/retailer/returns">Back to returns</Link>
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={data.kind === 'door_return' ? 'info' : 'neutral'}>{data.kind === 'door_return' ? 'Returned at door' : data.kind.replace(/_/g, ' ')}</Badge>
        <Badge tone={data.storeDecision === 'accepted' ? 'success' : data.storeDecision === 'rejected' ? 'danger' : 'warning'}>
          {data.storeDecision}
        </Badge>
        {data.reasonCategory && <Badge tone="neutral">{data.reasonCategory.replace('_', ' ')}</Badge>}
        {data.agentDisposition && (
          <Badge tone={agentTone}>Delivery agent: {data.agentDisposition.replace(/_/g, ' ')}</Badge>
        )}
      </div>

      {data.storeDecision === 'pending' && data.verificationWindowExpiresAt && (
        <VerificationCountdown deadline={data.verificationWindowExpiresAt} />
      )}

      <Card>
        <CardContent className="p-6">
          <MetaList
            cols={2}
            items={[
              { label: 'Listing', value: data.orderItem.listingNameSnap },
              { label: 'Variant', value: data.orderItem.attributesLabelSnap },
              { label: 'Opened at', value: new Date(data.openedAt).toLocaleString('en-IN') },
              { label: 'Decided at', value: data.storeDecidedAt ? new Date(data.storeDecidedAt).toLocaleString('en-IN') : '—' },
            ]}
          />

          {data.reasonText && (
            <div className="mt-4 rounded border border-line bg-surface p-3 text-[13px]">
              <div className="kicker mb-1">Reason</div>
              <div className="text-fg">{data.reasonText}</div>
            </div>
          )}

          {data.consumerPhotos.length > 0 && (
            <div className="mt-6">
              <div className="kicker mb-2">Consumer photos</div>
              <div className="flex flex-wrap gap-2">
                {data.consumerPhotos.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noreferrer">
                    <img src={url} alt={`consumer photo ${i + 1}`} className="size-24 rounded border border-line object-cover" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {data.photos.length > 0 && (
            <div className="mt-6">
              <div className="kicker mb-2">Agent / counter photos</div>
              <div className="flex flex-wrap gap-2">
                {data.photos.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noreferrer">
                    <img src={url} alt={`agent photo ${i + 1}`} className="size-24 rounded border border-line object-cover" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {data.storeRejectPhotos.length > 0 && (
            <div className="mt-6">
              <div className="kicker mb-2">Store rejection evidence</div>
              <div className="flex flex-wrap gap-2">
                {data.storeRejectPhotos.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noreferrer">
                    <img src={url} alt={`store reject photo ${i + 1}`} className="size-24 rounded border border-line object-cover" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {data.heldItems && data.heldItems.length > 0 && (
            <div className="mt-6 rounded border border-warning/40 bg-warning/5 p-3 text-[13px]">
              <div className="font-medium text-warning">Items held</div>
              <ul className="mt-1 space-y-1">
                {data.heldItems.map((h) => (
                  <li key={h.id} className="font-mono">
                    {h.id} · {h.status} · expires {new Date(h.holdingWindowExpiresAt).toLocaleDateString('en-IN')}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.storeDecision === 'pending' && (
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                className="text-danger border-danger/40"
                onClick={() => setRejectOpen(true)}
              >
                Reject return
              </Button>
              <Button
                variant="ink"
                loading={verify.isPending && verify.variables?.decision === 'accepted'}
                onClick={() => verify.mutate({ decision: 'accepted' })}
              >
                Accept return (refund consumer)
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={rejectOpen} onOpenChange={(o) => !verify.isPending && setRejectOpen(o)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Reject return</DialogTitle>
            <DialogDescription>
              Attach evidence photos (recommended). Up to 5 images. These are kept on the return record for any future dispute.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <div className="kicker mb-2">Evidence photos</div>
              <MediaGallery
                urls={rejectPhotos}
                onChange={setRejectPhotos}
                uploadFolder={`returns/${data.id}`}
                purpose="listing-gallery"
                maxImages={5}
                busy={verify.isPending}
              />
            </div>

            <div>
              <label className="kicker mb-1 block" htmlFor="rejectNote">Note (optional)</label>
              <textarea
                id="rejectNote"
                className="w-full rounded border border-line bg-surface p-2 text-[13px]"
                rows={3}
                maxLength={500}
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                placeholder="What was wrong with the returned item?"
              />
              <div className="mt-1 text-right text-[11px] text-fg-muted">{rejectNote.length}/500</div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectOpen(false)} disabled={verify.isPending}>
              Cancel
            </Button>
            <Button
              variant="outline"
              className="text-danger border-danger/40"
              loading={verify.isPending}
              onClick={() =>
                verify.mutate({
                  decision: 'rejected',
                  rejectPhotos: rejectPhotos.length > 0 ? rejectPhotos : undefined,
                  reasonNote: rejectNote.trim() ? rejectNote.trim() : undefined,
                })
              }
            >
              Reject return
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}

function VerificationCountdown({ deadline }: { deadline: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const remaining = new Date(deadline).getTime() - now;
  const expired = remaining <= 0;
  const totalSec = Math.max(0, Math.floor(remaining / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const display = expired ? 'Auto-accept fired' : h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;
  const urgent = remaining < 60 * 60 * 1000; // last hour
  return (
    <div
      className={`mb-4 flex items-center gap-3 rounded border px-3 py-2 text-[13px] ${
        expired
          ? 'border-danger/40 bg-danger/5 text-danger'
          : urgent
            ? 'border-warning/40 bg-warning/5 text-warning'
            : 'border-line bg-surface text-ink-2'
      }`}
    >
      {expired ? <AlertTriangle className="size-4" /> : <Clock className="size-4" />}
      <div>
        <div className="font-medium">
          Verification window {expired ? 'expired' : 'closes in'}
        </div>
        <div className="font-mono text-[12.5px]">
          {display} · deadline {new Date(deadline).toLocaleString('en-IN')}
        </div>
      </div>
    </div>
  );
}
