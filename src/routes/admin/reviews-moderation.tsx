import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Edit, Star, Trash2, UserX } from 'lucide-react';
import { api } from '@/lib/api';
import { formatAge } from '@/lib/status';
import type { ReviewFlag } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';

export function ReviewsModerationPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'reviews-moderation'],
    queryFn: () => api<ReviewFlag[]>('/admin/reviews-moderation'),
  });
  const list = (data ?? []).filter((r) => r.status === 'open');

  return (
    <div>
      <p className="mb-4 max-w-2xl text-[13px] text-ink-3 leading-relaxed">
        Flagged product reviews. Approve to keep, edit to scrub PII, take down to hide, or ban the
        author from reviewing further.
      </p>

      {isLoading ? <Skeleton className="h-32" /> : list.length === 0 ? (
        <Empty kicker="All clear" title="No flagged reviews." />
      ) : (
        <ul className="space-y-2">
          {list.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[14px] font-semibold text-ink">{r.listingName}</span>
                      <span className="inline-flex items-center text-warning">
                        {Array.from({ length: r.rating }, (_, i) => <Star key={i} className="size-3 fill-current" />)}
                      </span>
                      <Badge tone="warning" pulse>{r.reason}</Badge>
                    </div>
                    <div className="mt-1 text-[12px] text-ink-3">By {r.consumerLabel} · reported {formatAge(r.reportedAt)}</div>
                    <p className="mt-2 rounded border border-line bg-bg-2/30 px-3 py-2 text-[12.5px] text-ink-2 italic">"{r.excerpt}"</p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-1.5 shrink-0">
                    <Button size="sm" variant="outline" iconLeft={<Check className="size-3.5" />} onClick={() => toast.success('Approved (mock)')}>Approve</Button>
                    <Button size="sm" variant="ghost" iconLeft={<Edit className="size-3.5" />} onClick={() => toast.success('Opened editor (mock)')}>Edit</Button>
                    <Button size="sm" variant="outline" className="text-warning border-warning/40 hover:bg-warning/5" iconLeft={<Trash2 className="size-3.5" />} onClick={() => toast.success('Taken down (mock)')}>Take down</Button>
                    <Button size="sm" variant="outline" className="text-danger border-danger/40 hover:bg-danger/5" iconLeft={<UserX className="size-3.5" />} onClick={() => toast.success(`${r.consumerLabel} reviews-banned (mock)`)}>Ban author</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </ul>
      )}
    </div>
  );
}
