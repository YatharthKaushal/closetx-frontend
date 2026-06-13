import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, CircleAlert, Rocket } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import type { Listing } from '@/lib/types';
import { formatPaise } from '@/lib/status';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { WizardFormValues } from './types';

type Requirement = { label: string; met: boolean };

export function PublishBar({
  listing,
  listingId,
  values,
  gallery,
  onPublished,
}: {
  listing: Listing | null;
  listingId: string | null;
  values: WizardFormValues;
  gallery: string[];
  onPublished: () => void;
}) {
  const qc = useQueryClient();
  const [reviewOpen, setReviewOpen] = useState(false);

  const variants = listing?.variants ?? [];
  const hasCompleteActive = variants.some(
    (v) =>
      v.isActive &&
      v.pricePaise > 0 &&
      !!v.sku &&
      (v.imageUrls.length > 0 || gallery.length > 0),
  );

  const reqs: Requirement[] = [
    { label: 'Product name', met: !!values.name?.trim() },
    { label: 'Short description', met: !!values.description?.trim() },
    { label: 'Full description', met: !!values.descriptionLong?.trim() },
    { label: 'At least one image', met: gallery.length > 0 },
    { label: 'Return policy', met: !!values.listingPolicy },
    { label: 'A complete, active variant', met: hasCompleteActive },
  ];
  const ready = reqs.every((r) => r.met);
  const isPublished = listing?.status === 'active';

  const publish = useMutation({
    mutationFn: () =>
      api<Listing>(`/retailer/listings/${listingId}`, { method: 'PATCH', body: { status: 'active' } }),
    onSuccess: () => {
      toast.success('Product published');
      void qc.invalidateQueries({ queryKey: ['retailer', 'listings'] });
      setReviewOpen(false);
      onPublished();
    },
    onError: (e) => {
      const msg = e instanceof ApiError ? e.message : 'Could not publish';
      toast.error(msg);
    },
  });

  const unpublish = useMutation({
    mutationFn: () =>
      api<Listing>(`/retailer/listings/${listingId}`, { method: 'PATCH', body: { status: 'draft' } }),
    onSuccess: () => {
      toast.success('Moved to draft');
      void qc.invalidateQueries({ queryKey: ['retailer', 'listings'] });
      onPublished();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not unpublish'),
  });

  if (!listingId) {
    return (
      <div className="rounded-lg border border-dashed border-rule px-4 py-3 text-[12.5px] text-ink-3">
        Fill in the basics — a draft is created automatically, then you can publish.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-rule bg-paper-2/30 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-semibold text-ink">
              {isPublished ? 'Live' : 'Draft'}
            </span>
            <Badge tone={isPublished ? 'success' : 'neutral'}>{isPublished ? 'Active' : 'Not published'}</Badge>
          </div>
          <p className="text-[12px] text-ink-3">
            {isPublished ? 'Shoppers can buy active variants.' : ready ? 'Ready to publish.' : 'Complete the checklist to publish.'}
          </p>
        </div>
        {isPublished ? (
          <Button variant="outline" size="sm" loading={unpublish.isPending} onClick={() => unpublish.mutate()}>
            Move to draft
          </Button>
        ) : (
          <Button
            variant="accent"
            iconLeft={<Rocket className="size-3.5" />}
            disabled={!ready}
            onClick={() => setReviewOpen(true)}
          >
            Review &amp; publish
          </Button>
        )}
      </div>

      {!isPublished && (
        <ul className="mt-3 grid gap-1 sm:grid-cols-2">
          {reqs.map((r) => (
            <li key={r.label} className="flex items-center gap-1.5 text-[12px]">
              {r.met ? (
                <Check className="size-3.5 text-success" />
              ) : (
                <CircleAlert className="size-3.5 text-ink-4" />
              )}
              <span className={r.met ? 'text-ink-2' : 'text-ink-4'}>{r.label}</span>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review before publishing</DialogTitle>
            <DialogDescription>Confirm the details — this makes the product live.</DialogDescription>
          </DialogHeader>

          <dl className="space-y-2 text-[13px]">
            <Row label="Name" value={values.name} />
            <Row label="Brand" value={listing?.brand?.name ?? '—'} />
            <Row label="Category" value={listing?.category?.label ?? '—'} />
            <Row label="Policy" value={values.listingPolicy} />
            <Row label="Images" value={`${gallery.length}`} />
          </dl>

          {variants.length > 0 && (
            <div className="mt-4 overflow-hidden rounded-md border border-rule">
              <table className="w-full text-[12px]">
                <thead className="bg-bg-2/60 text-ink-3">
                  <tr>
                    <th className="px-2 py-1.5 text-left">Variant</th>
                    <th className="px-2 py-1.5 text-left">SKU</th>
                    <th className="px-2 py-1.5 text-right">Selling price</th>
                    <th className="px-2 py-1.5 text-right">Stock</th>
                    <th className="px-2 py-1.5 text-center">Live</th>
                  </tr>
                </thead>
                <tbody>
                  {variants.map((v) => (
                    <tr key={v.id} className="border-t border-rule/60">
                      <td className="px-2 py-1.5">{v.attributesLabel}</td>
                      <td className="px-2 py-1.5 font-mono text-[11px] text-ink-2">{v.sku ?? '—'}</td>
                      <td className="px-2 py-1.5 text-right">
                        {formatPaise(v.pricePaise)}
                        {v.compareAtPrice ? (
                          <span className="ml-1 text-ink-4 line-through">{formatPaise(v.compareAtPrice)}</span>
                        ) : null}
                      </td>
                      <td className="px-2 py-1.5 text-right">{v.stock}</td>
                      <td className="px-2 py-1.5 text-center">
                        <span className={cn('inline-block size-2 rounded-full', v.isActive ? 'bg-success' : 'bg-ink-4')} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <DialogFooter className="mt-5">
            <Button variant="ghost" size="sm" onClick={() => setReviewOpen(false)}>
              Keep editing
            </Button>
            <Button
              variant="accent"
              size="sm"
              loading={publish.isPending}
              iconLeft={<Rocket className="size-3.5" />}
              onClick={() => publish.mutate()}
            >
              Publish now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-rule/50 pb-1.5">
      <dt className="text-ink-3">{label}</dt>
      <dd className="font-medium text-ink capitalize">{value}</dd>
    </div>
  );
}
