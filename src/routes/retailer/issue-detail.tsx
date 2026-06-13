import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, ArrowUpRight, Send } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { formatAge, issueStatusMeta } from '@/lib/status';
import type { IssueDetail } from '@/lib/types';
import { Page, PageHeader, SectionHeading } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MetaList } from '@/components/ui/meta-list';
import { CopyableId } from '@/components/ui/copyable-id';
import { MediaGallery } from '@/components/ui/media-gallery';
import { AttachmentThumbs } from '@/components/ui/attachment-thumbs';
import { Textarea } from '@/components/ui/input';

function formatPaise(paise: number) {
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

const AWAITING_TONE: Record<string, 'warning' | 'info' | 'success' | 'neutral'> = {
  retailer: 'warning',
  admin: 'info',
  consumer: 'success',
};

export default function RetailerIssueDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const [replyBody, setReplyBody] = useState('');
  const [replyAttachmentUrls, setReplyAttachmentUrls] = useState<string[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ['retailer', 'issues', id],
    queryFn: () => api<IssueDetail>(`/retailer/issues/${id}`),
    enabled: Boolean(id),
  });

  const sendMessage = useMutation({
    mutationFn: () =>
      api(`/retailer/issues/${id}/messages`, {
        method: 'POST',
        body: {
          body: replyBody.trim(),
          attachments: replyAttachmentUrls,
        },
      }),
    onSuccess: () => {
      toast.success('Message sent');
      setReplyBody('');
      setReplyAttachmentUrls([]);
      void qc.invalidateQueries({ queryKey: ['retailer', 'issues', id] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed to send message'),
  });

  const handBack = useMutation({
    mutationFn: () => api(`/retailer/issues/${id}/hand-back`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Handed back to admin');
      void qc.invalidateQueries({ queryKey: ['retailer', 'issues', id] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Hand-back failed'),
  });

  if (isLoading || !data) return <Page><Skeleton className="h-72" /></Page>;
  const meta = issueStatusMeta(data.status);

  const messages = [...(data.messages ?? [])].sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
  );

  return (
    <Page>
      <PageHeader
        kicker="Disputes"
        title={`Dispute · ${data.id.slice(0, 12)}…`}
        description={`Opened ${formatAge(data.createdAt)} · ${data.orderId ? `Order ${data.orderId}` : data.returnId ? `Return ${data.returnId}` : ''}`}
        actions={
          <Button asChild variant="ghost" size="sm" iconLeft={<ArrowLeft className="size-3.5" />}>
            <Link to="/retailer/disputes">Back</Link>
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={meta.tone}>{meta.label}</Badge>
        {data.awaitingParty && (
          <Badge tone={AWAITING_TONE[data.awaitingParty] ?? 'neutral'} flat>
            Awaiting {data.awaitingParty}
          </Badge>
        )}
        <CopyableId value={data.id} label="dispute id" />
        {data.orderId && (
          <Link
            to={`/retailer/orders/${data.orderId}`}
            className="ml-2 inline-flex items-center gap-1 text-[12px] text-ink-3 hover:text-ink"
          >
            Open order <ArrowUpRight className="size-3" />
          </Link>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        {/* Left column */}
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6 space-y-4">
              <SectionHeading kicker="Description" title="Consumer's account" />
              <p className="text-[13.5px] text-ink-2">{data.description || '—'}</p>

              {data.evidence.length > 0 && (
                <div>
                  <div className="mb-2 text-[11.5px] font-medium uppercase tracking-wider text-ink-4">Evidence files</div>
                  <AttachmentThumbs urls={data.evidence} />
                </div>
              )}

              {data.decisionNote && (
                <div>
                  <div className="mb-1 text-[11.5px] font-medium uppercase tracking-wider text-ink-4">Admin decision note</div>
                  <p className="rounded-md bg-bg-2 px-3 py-2 text-[13px] text-ink-2">{data.decisionNote}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Message thread */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <SectionHeading kicker="Thread" title="Messages" />
              {messages.length === 0 ? (
                <p className="text-[13px] text-ink-3">No messages yet.</p>
              ) : (
                <ul className="space-y-3">
                  {messages.map((m) => (
                    <li key={m.id} className="rounded-md border border-line px-3 py-2">
                      <div className="flex items-center gap-2 text-[11.5px]">
                        <Badge tone={m.senderType === 'retailer' ? 'success' : m.senderType === 'admin' ? 'info' : 'neutral'} flat>
                          {m.senderType}
                        </Badge>
                        <span className="text-ink-3 font-mono text-[11px]">{m.senderId}</span>
                        <span className="ml-auto text-ink-4">{formatAge(m.at)}</span>
                      </div>
                      <p className="mt-1 text-[13px] text-ink-2 whitespace-pre-wrap">{m.body}</p>
                      {m.attachments.length > 0 && (
                        <AttachmentThumbs urls={m.attachments} size="sm" className="mt-1.5" />
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {/* Reply form */}
              <div className="space-y-2 border-t border-line pt-4">
                <Textarea
                  rows={3}
                  placeholder="Type your reply..."
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                />
                <div>
                  <div className="kicker mb-1 text-ink-3">Attach photos (optional)</div>
                  <MediaGallery
                    urls={replyAttachmentUrls}
                    onChange={setReplyAttachmentUrls}
                    uploadFolder={`issues/${id}`}
                    purpose="listing-gallery"
                    maxImages={5}
                    busy={sendMessage.isPending}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="accent"
                    size="sm"
                    disabled={replyBody.trim().length < 1}
                    loading={sendMessage.isPending}
                    iconLeft={<Send className="size-3.5" />}
                    onClick={() => sendMessage.mutate()}
                  >
                    Send
                  </Button>
                  {data.awaitingParty === 'retailer' && (
                    <Button
                      variant="outline"
                      size="sm"
                      loading={handBack.isPending}
                      onClick={() => handBack.mutate()}
                    >
                      Hand back to admin
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <Card>
          <CardContent className="p-6">
            <SectionHeading kicker="Status" title="Resolution" />
            <MetaList
              cols={1}
              items={[
                { label: 'Status', value: <Badge tone={meta.tone}>{meta.label}</Badge> },
                ...(data.awaitingParty
                  ? [{
                      label: 'Awaiting',
                      value: (
                        <Badge tone={AWAITING_TONE[data.awaitingParty] ?? 'neutral'} flat>
                          {data.awaitingParty}
                        </Badge>
                      ),
                    }]
                  : []),
                { label: 'Decision', value: data.decision ?? '—' },
                { label: 'Decided at', value: data.decidedAt ? formatAge(data.decidedAt) : '—' },
                { label: 'Order', value: data.orderId ?? '—', mono: true },
                { label: 'Return', value: data.returnId ?? '—', mono: true },
                ...(data.payoutAdjustmentPaise != null
                  ? [{ label: 'Payout adjustment', value: formatPaise(data.payoutAdjustmentPaise) }]
                  : []),
              ]}
            />
            <p className="mt-3 text-[12px] text-ink-3">
              Contact platform support if you need to respond to this dispute or submit additional evidence.
            </p>
          </CardContent>
        </Card>
      </div>
    </Page>
  );
}
