import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, ArrowUpRight, Check, ChevronDown, Edit3, ImageOff, Plus, Power, Save, Trash2, X } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { MediaGallery } from '@/components/ui/media-gallery';
import { VariantImagePicker } from '@/components/ui/variant-image-picker';
import { listingStatusMeta, formatPaise, mechanismLabel, formatDiscount, promotionStatusMeta } from '@/lib/status';
import type {
  AiListingQuota,
  AiSubmission,
  AttributeAxisType,
  AttributeTemplate,
  Listing,
  Promotion,
  SizeScale,
  Store,
  Variant,
  VariantGroup,
} from '@/lib/types';
import { ColorSwatchPicker } from '@/components/retailer/product-wizard/color-swatch-picker';
import { AgeRangeChips } from '@/components/retailer/age-range-chips';
import { Page, PageHeader, SectionHeading } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Empty } from '@/components/ui/empty';
import { Input, Textarea } from '@/components/ui/input';
import { FieldError, Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ListingAuditList } from '@/components/retailer/listing-audit-list';
import { RichTextView } from '@/components/ui/rich-text-view';
import { cn } from '@/lib/cn';

// Tiptap is heavy — load the editor only when the Details tab renders.
const RichTextEditor = lazy(() =>
  import('@/components/ui/rich-text-editor').then((m) => ({ default: m.RichTextEditor })),
);
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Stock has its own home in the Inventory tab — this dialog handles the slow-
// changing facts of a variant (price, SKU, images). If stock ever needs to ride
// along again, add it back here AND remove the read-only chip in the variant row.
const InventoryPatchSchema = z.object({
  pricePaise: z.coerce.number().int().positive(),
  sku: z.string().trim().min(1).max(64).optional().or(z.literal('').transform(() => undefined)),
});
type InventoryPatchValues = z.infer<typeof InventoryPatchSchema>;

/** A single (option name → value) row in the variant builder, e.g. `{ name: 'Size', value: 'M' }`. */
type AxisState = {
  name: string;
  type: AttributeAxisType;
  allowedValues: string[];
  selectedValues: string[];
};

type RowFields = { price: string; stock: string; sku: string };

function cartesian(axesValues: string[][]): string[][] {
  return axesValues.reduce<string[][]>(
    (acc, values) => acc.flatMap((combo) => values.map((v) => [...combo, v])),
    [[]],
  );
}

export default function ListingDetail() {
  const { id = '' } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const listing = useQuery({
    queryKey: ['retailer', 'listing', id],
    queryFn: async () => {
      const all = await api<Listing[]>('/retailer/listings');
      const found = all.find((l) => l.id === id);
      if (!found) throw new ApiError(404, 'not_found', 'Listing not found');
      return found;
    },
  });

  if (listing.isLoading) {
    return (
      <Page>
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="mt-4 h-72" />
      </Page>
    );
  }
  if (listing.isError || !listing.data) {
    return (
      <Page>
        <Empty
          kicker="Not found"
          title="Couldn't find this product."
          description={listing.error instanceof ApiError ? listing.error.message : 'Unknown error'}
          action={<Button asChild variant="outline"><Link to="/retailer/listings">Back to products</Link></Button>}
        />
      </Page>
    );
  }

  const l = listing.data;
  const meta = listingStatusMeta(l.status);

  return (
    <Page>
      <Link
        to="/retailer/listings"
        className="mb-4 inline-flex items-center gap-1.5 text-[12px] uppercase tracking-[0.16em] text-ink-3 hover:text-ink"
      >
        <ArrowLeft className="size-3.5" />
        All products
      </Link>

      <QuickEditNameDialog
        listing={l}
        onChanged={() => qc.invalidateQueries({ queryKey: ['retailer'] })}
      >
        {(open) => (
          <PageHeader
            kicker={`${l.brand?.name ?? 'Unbranded'} · ${l.category?.label ?? l.categoryId}`}
            title={
              <span className="group/title flex items-center gap-2">
                <em>{l.name}</em>
                <button
                  type="button"
                  onClick={open}
                  className="opacity-0 group-hover/title:opacity-100 transition-opacity text-ink-3 hover:text-ink"
                >
                  <Edit3 className="size-3.5" />
                </button>
              </span>
            }
            actions={
              <div className="flex items-center gap-2">
                <Badge tone={meta.tone}>{meta.label}</Badge>
                <Button variant="ghost" size="sm" iconLeft={<Edit3 className="size-3.5" />} onClick={open}>
                  Edit
                </Button>
              </div>
            }
          />
        )}
      </QuickEditNameDialog>

      <PublishPanel
        listing={l}
        onChanged={() => qc.invalidateQueries({ queryKey: ['retailer'] })}
      />

      {/*
       * Cross-links: products / inventory / pricing / orders are tightly
       * related but live on separate sidebar pages. These chips deep-link
       * straight to the relevant filtered view for the current product so the
       * operator doesn't have to navigate back and re-filter.
       */}
      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          to={`/retailer/inventory?productId=${l.id}`}
          className="inline-flex items-center gap-1 rounded-full border border-line bg-bg-2 px-2.5 py-1 text-[12px] text-ink-3 hover:text-ink hover:bg-bg-3"
        >
          Inventory for this product
        </Link>
        <Link
          to={`/retailer/pricing?productId=${l.id}`}
          className="inline-flex items-center gap-1 rounded-full border border-line bg-bg-2 px-2.5 py-1 text-[12px] text-ink-3 hover:text-ink hover:bg-bg-3"
        >
          Edit pricing
        </Link>
        <Link
          to={`/retailer/orders?listingId=${l.id}`}
          className="inline-flex items-center gap-1 rounded-full border border-line bg-bg-2 px-2.5 py-1 text-[12px] text-ink-3 hover:text-ink hover:bg-bg-3"
        >
          Orders with this product
        </Link>
      </div>

      <ListingDetailTabs listing={l} onInvalidate={() => qc.invalidateQueries({ queryKey: ['retailer'] })} />
    </Page>
  );
}

function QuickEditNameDialog({
  listing,
  onChanged,
  children,
}: {
  listing: Listing;
  onChanged: () => void;
  children: (open: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(z.object({
      name: z.string().trim().min(1).max(200),
      description: z.string().trim().max(5000).optional().or(z.literal('').transform(() => undefined)),
    })),
    defaultValues: { name: listing.name, description: listing.description ?? '' },
  });

  const save = useMutation({
    mutationFn: (v: { name: string; description?: string | undefined }) =>
      api<Listing>(`/retailer/listings/${listing.id}`, { method: 'PATCH', body: v }),
    onSuccess: () => { toast.success('Saved'); setOpen(false); onChanged(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Save failed'),
  });

  function handleOpen() {
    reset({ name: listing.name, description: listing.description ?? '' });
    setOpen(true);
  }

  return (
    <>
      {children(handleOpen)}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit product info</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit((v) => save.mutate(v))} className="space-y-4 py-1">
            <div>
              <Label htmlFor="qe-name" required>Name</Label>
              <Input id="qe-name" {...register('name')} />
              <FieldError>{errors.name?.message}</FieldError>
            </div>
            <div>
              <Label htmlFor="qe-desc" hint="Optional">Description</Label>
              <Textarea id="qe-desc" rows={5} {...register('description')} placeholder="Describe this product…" />
              <FieldError>{errors.description?.message}</FieldError>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" loading={isSubmitting || save.isPending}>Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Phase 3.4 — primary tabs in frequency order (Overview, Variants, Details,
 * Promotions). Reference-only tabs (AI generations, Audit log) live behind a
 * "More" dropdown so the strip stays mobile-friendly and the operator's eye
 * lands on action tabs first.
 */
const PRIMARY_TABS = ['overview', 'variants', 'details', 'promotions'] as const;
const OVERFLOW_TABS = ['ai', 'audit'] as const;
type ListingTabKey = (typeof PRIMARY_TABS)[number] | (typeof OVERFLOW_TABS)[number];

const TAB_LABEL: Record<ListingTabKey, string> = {
  overview: 'Overview',
  variants: 'Variants & inventory',
  details: 'Details',
  promotions: 'Promotions',
  ai: 'AI generations',
  audit: 'Audit log',
};

const ALL_TABS = [...PRIMARY_TABS, ...OVERFLOW_TABS] as ReadonlyArray<ListingTabKey>;

function parseListingTab(v: string | null): ListingTabKey {
  return ALL_TABS.includes(v as ListingTabKey) ? (v as ListingTabKey) : 'overview';
}

function ListingDetailTabs({
  listing,
  onInvalidate,
}: {
  listing: Listing;
  onInvalidate: () => void;
}) {
  // Tab bound to `?tab=` so refresh and share-URL preserve the operator's
  // selection. Default `overview` is omitted from the URL to keep links tidy.
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = parseListingTab(searchParams.get('tab'));
  const setTab = (v: ListingTabKey) => {
    setSearchParams(
      (prev) => {
        const sp = new URLSearchParams(prev);
        if (v === 'overview') sp.delete('tab');
        else sp.set('tab', v);
        return sp;
      },
      { replace: true },
    );
  };
  const overflowActive = (OVERFLOW_TABS as ReadonlyArray<string>).includes(tab);
  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as ListingTabKey)}>
      <TabsList className="overflow-x-auto whitespace-nowrap">
        {PRIMARY_TABS.map((k) => (
          <TabsTrigger key={k} value={k}>
            {TAB_LABEL[k]}
          </TabsTrigger>
        ))}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                'inline-flex items-center gap-1 px-3 py-1.5 text-[12.5px] font-medium transition-colors',
                overflowActive ? 'text-ink' : 'text-ink-3 hover:text-ink',
              )}
              aria-haspopup="menu"
            >
              {overflowActive ? TAB_LABEL[tab as 'ai' | 'audit'] : 'More'}
              <ChevronDown className="size-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {OVERFLOW_TABS.map((k) => (
              <DropdownMenuItem key={k} onSelect={() => setTab(k)}>
                {TAB_LABEL[k]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </TabsList>

      <TabsContent value="overview">
        <OverviewTab listing={listing} />
      </TabsContent>
      <TabsContent value="variants">
        <VariantsTab listing={listing} onChanged={onInvalidate} />
      </TabsContent>
      <TabsContent value="details">
        <DetailsTab listing={listing} onChanged={onInvalidate} />
      </TabsContent>
      <TabsContent value="promotions">
        <PromotionsTab listing={listing} />
      </TabsContent>
      <TabsContent value="ai">
        <AiGenerationsTab listing={listing} />
      </TabsContent>
      <TabsContent value="audit">
        <AuditLogTab listing={listing} />
      </TabsContent>
    </Tabs>
  );
}

function OverviewTab({ listing }: { listing: Listing }) {
  const variants = listing.variants ?? [];
  const totalStock = variants.reduce((sum, v) => sum + v.stock, 0);
  const totalReserved = variants.reduce((sum, v) => sum + v.reserved, 0);
  const totalAvailable = totalStock - totalReserved;
  const coverImage = (listing.galleryUrls ?? [])[0];
  const meta = listingStatusMeta(listing.status);

  function fmt(iso: string) {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-12">
      {/* Cover image */}
      <div className="lg:col-span-4">
        <div className="aspect-square overflow-hidden rounded-xs border border-rule bg-paper-2">
          {coverImage ? (
            <img src={coverImage} alt="" className="h-full w-full object-contain" loading="lazy" />
          ) : (
            <div className="grid h-full place-items-center text-ink-4">
              <ImageOff className="size-10" />
            </div>
          )}
        </div>
        <p className="mt-1.5 text-center text-[11px] uppercase tracking-[0.12em] text-ink-4">Cover image</p>
      </div>

      {/* Details column */}
      <div className="lg:col-span-8 space-y-7">
        {/* Basics */}
        <section>
          <div className="kicker mb-3 text-ink-3">Basics</div>
          <dl className="space-y-2.5">
            <OverviewRow label="Name" value={<span className="font-medium text-ink">{listing.name}</span>} />
            <OverviewRow label="Brand" value={listing.brand?.name ?? <em className="text-ink-3">Unbranded</em>} />
            <OverviewRow label="Category" value={listing.category?.label ?? listing.categoryId} />
            <OverviewRow label="Gender" value={<span className="capitalize">{listing.gender}</span>} />
            <OverviewRow label="Status" value={<Badge tone={meta.tone}>{meta.label}</Badge>} />
            <OverviewRow label="Policy" value={REVIEW_POLICY_LABEL[listing.listingPolicy]} />
            <OverviewRow label="Created" value={fmt(listing.createdAt)} />
            <OverviewRow label="Last updated" value={fmt(listing.updatedAt)} />
          </dl>
        </section>

        {/* Stock summary */}
        <section>
          <div className="kicker mb-3 text-ink-3">Stock summary</div>
          <div className="grid grid-cols-3 gap-3">
            <StockCard label="Total" value={totalStock} />
            <StockCard label="Reserved" value={totalReserved} />
            <StockCard label="Available" value={totalAvailable} warn={totalAvailable === 0 && variants.length > 0} />
          </div>
        </section>

        {/* Rich long description (sanitized server-side on write) */}
        {listing.descriptionLong && (
          <section>
            <div className="kicker mb-3 text-ink-3">Full description</div>
            <div className="rounded-md border border-rule bg-bg p-4">
              <RichTextView html={listing.descriptionLong} />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function OverviewRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 border-b border-rule/50 pb-2 last:border-b-0">
      <dt className="w-28 shrink-0 text-[11.5px] uppercase tracking-[0.08em] text-ink-3">{label}</dt>
      <dd className="min-w-0 flex-1 text-[13px] text-ink break-words">{value}</dd>
    </div>
  );
}

function StockCard({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className={`rounded-xs border px-4 py-3 text-center ${warn ? 'border-warning/40 bg-warning-soft/30' : 'border-rule bg-paper-2/40'}`}>
      <div className={`text-[22px] font-mono tabular-nums font-semibold ${warn ? 'text-warning' : 'text-ink'}`}>
        {value}
      </div>
      <div className="mt-0.5 text-[11px] uppercase tracking-[0.1em] text-ink-3">{label}</div>
    </div>
  );
}

function fmtPromoDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function PromotionsTab({ listing }: { listing: Listing }) {
  const qc = useQueryClient();
  const [pickerPromoId, setPickerPromoId] = useState('');

  const includedQuery = useQuery({
    queryKey: ['retailer', 'promotions', { listingId: listing.id }],
    queryFn: () => api<Promotion[]>(`/retailer/promotions?listingId=${listing.id}`),
  });
  const excludedQuery = useQuery({
    queryKey: ['retailer', 'promotions', { excludedListingId: listing.id }],
    queryFn: () => api<Promotion[]>(`/retailer/promotions?excludedListingId=${listing.id}`),
  });
  const allQuery = useQuery({
    queryKey: ['retailer', 'promotions'],
    queryFn: () => api<Promotion[]>('/retailer/promotions'),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['retailer', 'promotions'] });
  };

  const scopeMutation = useMutation({
    mutationFn: ({ promoId, action }: { promoId: string; action: 'include' | 'uninclude' | 'exclude' | 'unexclude' }) =>
      api(`/retailer/promotions/${promoId}/scope/listing`, {
        method: 'PATCH',
        body: { listingId: listing.id, action },
      }),
    onSuccess: (_, { action }) => {
      invalidate();
      const msg = action === 'include' ? 'Added to promotion' : action === 'uninclude' ? 'Removed from promotion' : action === 'exclude' ? 'Excluded from promotion' : 'Exclusion removed';
      toast.success(msg);
      setPickerPromoId('');
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed to update scope'),
  });

  const includedIds = new Set((includedQuery.data ?? []).map((p) => p.id));
  const excludedIds = new Set((excludedQuery.data ?? []).map((p) => p.id));
  const availableForPicker = (allQuery.data ?? []).filter((p) => !includedIds.has(p.id) && !excludedIds.has(p.id));

  const isLoading = includedQuery.isLoading || excludedQuery.isLoading;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <SectionHeading title="Promotion scope" hint="Which promotions include or exclude this listing" />
        <Button asChild variant="outline" size="sm" iconRight={<ArrowUpRight className="size-3.5" />}>
          <Link to="/retailer/promotions/new">New promotion</Link>
        </Button>
      </div>

      {/* Included */}
      <div className="space-y-2">
        <p className="text-[11.5px] font-medium uppercase tracking-[0.12em] text-ink-3">Included in</p>
        {isLoading ? (
          <Skeleton className="h-14" />
        ) : (includedQuery.data ?? []).length === 0 ? (
          <p className="text-[13px] text-ink-4 py-2">Not explicitly included in any promotion.</p>
        ) : (
          <ul className="space-y-1.5">
            {(includedQuery.data ?? []).map((p) => {
              const meta = promotionStatusMeta(p.effectiveStatus);
              const pending = scopeMutation.isPending && scopeMutation.variables?.promoId === p.id;
              return (
                <li key={p.id} className="flex items-center gap-3 rounded-lg border border-line bg-bg px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[13.5px] text-ink truncate">{p.name}</span>
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                      <Badge flat>{mechanismLabel(p.mechanism)}</Badge>
                    </div>
                    <div className="mt-0.5 text-[12px] text-ink-3">{formatDiscount(p.discountType, p.config)}</div>
                    <div className="mt-0.5 text-[11.5px] text-ink-4">
                      {fmtPromoDate(p.validFrom)} – {fmtPromoDate(p.validUntil)}
                      <span className="mx-1.5 text-ink-5">·</span>
                      {p.redeemedCount} redeemed{p.totalUses !== null ? ` / ${p.totalUses}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button variant="ghost" size="sm" loading={pending} onClick={() => scopeMutation.mutate({ promoId: p.id, action: 'exclude' })}>
                      Exclude
                    </Button>
                    <Button variant="ghost" size="sm" loading={pending} onClick={() => scopeMutation.mutate({ promoId: p.id, action: 'uninclude' })}>
                      Remove
                    </Button>
                    <Button asChild variant="ghost" size="sm" iconRight={<ArrowUpRight className="size-3" />}>
                      <Link to={`/retailer/promotions/${p.id}`}>Open</Link>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Excluded */}
      {((excludedQuery.data ?? []).length > 0 || excludedQuery.isLoading) && (
        <div className="space-y-2">
          <p className="text-[11.5px] font-medium uppercase tracking-[0.12em] text-ink-3">Explicitly excluded from</p>
          {excludedQuery.isLoading ? (
            <Skeleton className="h-14" />
          ) : (
            <ul className="space-y-1.5">
              {(excludedQuery.data ?? []).map((p) => {
                const meta = promotionStatusMeta(p.effectiveStatus);
                const pending = scopeMutation.isPending && scopeMutation.variables?.promoId === p.id;
                return (
                  <li key={p.id} className="flex items-center gap-3 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[13.5px] text-ink truncate">{p.name}</span>
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                        <Badge flat>{mechanismLabel(p.mechanism)}</Badge>
                      </div>
                      <div className="mt-0.5 text-[12px] text-ink-3">{formatDiscount(p.discountType, p.config)}</div>
                      <div className="mt-0.5 text-[11.5px] text-ink-4">
                        {fmtPromoDate(p.validFrom)} – {fmtPromoDate(p.validUntil)}
                        <span className="mx-1.5 text-ink-5">·</span>
                        {p.redeemedCount} redeemed{p.totalUses !== null ? ` / ${p.totalUses}` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button variant="ghost" size="sm" loading={pending} onClick={() => scopeMutation.mutate({ promoId: p.id, action: 'unexclude' })}>
                        Re-include
                      </Button>
                      <Button asChild variant="ghost" size="sm" iconRight={<ArrowUpRight className="size-3" />}>
                        <Link to={`/retailer/promotions/${p.id}`}>Open</Link>
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Add to scope */}
      <div className="space-y-2">
        <p className="text-[11.5px] font-medium uppercase tracking-[0.12em] text-ink-3">Add to a promotion</p>
        <div className="flex items-center gap-2">
          <Select value={pickerPromoId} onValueChange={setPickerPromoId}>
            <SelectTrigger className="max-w-xs flex-1">
              <SelectValue placeholder={allQuery.isLoading ? 'Loading…' : availableForPicker.length === 0 ? 'No promotions available' : 'Select promotion…'} />
            </SelectTrigger>
            <SelectContent>
              {availableForPicker.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            disabled={!pickerPromoId}
            loading={scopeMutation.isPending && scopeMutation.variables?.promoId === pickerPromoId && scopeMutation.variables.action === 'include'}
            onClick={() => pickerPromoId && scopeMutation.mutate({ promoId: pickerPromoId, action: 'include' })}
          >
            Include
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={!pickerPromoId}
            loading={scopeMutation.isPending && scopeMutation.variables?.promoId === pickerPromoId && scopeMutation.variables.action === 'exclude'}
            onClick={() => pickerPromoId && scopeMutation.mutate({ promoId: pickerPromoId, action: 'exclude' })}
          >
            Exclude
          </Button>
        </div>
      </div>
    </div>
  );
}

function AiGenerationsTab({ listing }: { listing: Listing }) {
  const quota = useQuery({
    queryKey: ['retailer', 'ai-catalog', 'quota', listing.id],
    queryFn: () =>
      api<AiListingQuota>(`/retailer/ai-catalog/quota?listingId=${encodeURIComponent(listing.id)}`),
  });
  const submissions = useQuery({
    queryKey: ['retailer', 'ai-catalog', 'by-listing', listing.id],
    queryFn: () =>
      api<AiSubmission[]>(`/retailer/ai-catalog?listingId=${encodeURIComponent(listing.id)}`),
  });

  const variants = listing.variants ?? [];
  const subsByVariant = new Map<string, AiSubmission>();
  let listingLatest: AiSubmission | undefined;
  for (const s of submissions.data ?? []) {
    if (s.parentSubmissionId) continue; // only root attempts
    if (s.targetVariantId) {
      if (!subsByVariant.has(s.targetVariantId)) subsByVariant.set(s.targetVariantId, s);
    } else if (!listingLatest) {
      listingLatest = s;
    }
  }
  const quotaExhausted = Boolean(quota.data && quota.data.remaining <= 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionHeading title="AI photo generations for this listing" />
        <div className="flex items-center gap-2">
          {quota.data && (
            <Badge tone={quotaExhausted ? 'danger' : 'neutral'} flat>
              {quota.data.usedAttempts}/{quota.data.variantCount} attempts used
            </Badge>
          )}
          <Button
            asChild
            variant="accent"
            size="sm"
            iconRight={<ArrowUpRight className="size-3.5" />}
            disabled={quotaExhausted || (quota.data?.variantCount ?? 0) === 0}
          >
            <Link to={`/retailer/ai-catalog/new?listingId=${listing.id}`}>Generate new</Link>
          </Button>
        </div>
      </div>

      {variants.length === 0 ? (
        <Empty
          kicker="No variants"
          title="Add a variant first"
          description="AI quota is one generation per variant. Add at least one variant to enable image generation."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {variants.map((v) => {
            const sub = subsByVariant.get(v.id);
            return <VariantSlotCard key={v.id} listingId={listing.id} variant={v} sub={sub} />;
          })}
        </div>
      )}

      {listingLatest && (
        <div>
          <div className="mb-2 mt-4 text-[11.5px] font-semibold uppercase tracking-wide text-ink-3">
            Listing-level generation
          </div>
          <VariantSlotCard listingId={listing.id} sub={listingLatest} />
        </div>
      )}
    </div>
  );
}

function VariantSlotCard({
  listingId,
  variant,
  sub,
}: {
  listingId: string;
  variant?: Variant | undefined;
  sub?: AiSubmission | undefined;
}) {
  const image = variant?.imageUrls?.[0] ?? sub?.outputUrls?.[0];
  return (
    <div className="rounded-md border border-line bg-bg-2/30 p-3">
      <div className="aspect-[3/4] overflow-hidden rounded-md border border-line bg-bg-2">
        {image ? (
          <img src={image} alt="" className="size-full object-cover" />
        ) : (
          <div className="grid size-full place-items-center text-ink-4">
            <ImageOff className="size-5" />
          </div>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[12.5px] font-semibold text-ink">
            {variant ? variant.attributesLabel : 'Listing gallery'}
          </div>
          {sub && (
            <div className="mt-0.5 text-[11px] text-ink-3">
              <Badge
                tone={
                  sub.status === 'ready_for_review'
                    ? 'warning'
                    : sub.status === 'accepted'
                      ? 'success'
                      : sub.status === 'failed'
                        ? 'danger'
                        : sub.status === 'processing' || sub.status === 'regenerating'
                          ? 'info'
                          : 'neutral'
                }
                flat
              >
                {sub.status.replace(/_/g, ' ')}
              </Badge>
            </div>
          )}
        </div>
        {sub ? (
          <Button asChild variant="outline" size="sm" iconRight={<ArrowUpRight className="size-3.5" />}>
            <Link to={`/retailer/ai-catalog/${sub.id}`}>Open</Link>
          </Button>
        ) : (
          <Button asChild variant="accent" size="sm">
            <Link
              to={`/retailer/ai-catalog/new?listingId=${listingId}${
                variant ? `&variantId=${variant.id}` : ''
              }`}
            >
              Generate
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}

// MOCK_DEPENDENCY: §5 — per-listing audit log

function AuditLogTab({ listing }: { listing: Listing }) {
  return <ListingAuditList listingId={listing.id} />;
}

function VariantsTab({ listing, onChanged }: { listing: Listing; onChanged: () => void }) {
  const [adding, setAdding] = useState(false);
  const [addingSize, setAddingSize] = useState(false);
  const [editing, setEditing] = useState<Variant | null>(null);
  const variants = listing.variants ?? [];

  const { data: templates } = useQuery({
    queryKey: ['retailer', 'attribute-templates'],
    queryFn: () => api<AttributeTemplate[]>('/retailer/attribute-templates'),
  });
  const activeTemplate = templates?.find((t) => t.id === listing.templateId);

  // Color-section rendering for the system color → size structure: order the
  // rows by group, and mark the first row of each group with its header.
  const isColorSize = listing.variantMode === 'color_size';
  const namedGroups = (listing.variantGroups ?? []).filter((g) => !g.isDefault);
  const { orderedVariants, headerBefore } = useMemo(() => {
    type Header = { name: string; colorHex: string | null; count: number; stock: number };
    if (!isColorSize || namedGroups.length === 0) {
      return { orderedVariants: variants, headerBefore: new Map<string, Header>() };
    }
    const ordered: Variant[] = [];
    const headers = new Map<string, Header>();
    const namedIds = new Set(namedGroups.map((g) => g.id));
    const sectionRows = namedGroups
      .map((g) => ({ name: g.name, colorHex: g.colorHex, rows: variants.filter((v) => v.groupId === g.id) }))
      .concat([{ name: 'Ungrouped', colorHex: null, rows: variants.filter((v) => !namedIds.has(v.groupId)) }])
      .filter((s) => s.rows.length > 0);
    for (const s of sectionRows) {
      headers.set(s.rows[0]!.id, {
        name: s.name,
        colorHex: s.colorHex,
        count: s.rows.length,
        stock: s.rows.reduce((sum, v) => sum + v.stock, 0),
      });
      ordered.push(...s.rows);
    }
    return { orderedVariants: ordered, headerBefore: headers };
  }, [isColorSize, namedGroups, variants]);

  return (
    <>
      <div className="mb-5 flex items-end justify-between gap-3">
        <SectionHeading
          title="Variants"
          hint={`${variants.length} on file`}
        />
        {activeTemplate && (
          <div className="flex items-center gap-1.5 text-[12px] text-ink-3">
            <span className="text-ink-4">Template:</span>
            <a
              href={`/retailer/attribute-templates/${activeTemplate.id}`}
              className="font-medium text-ink hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {activeTemplate.name}
            </a>
          </div>
        )}
      </div>
      <div className="-mt-4 mb-6 flex justify-end">
        {isColorSize ? (
          <Button variant="ink" caps iconLeft={<Plus className="size-3.5" />} onClick={() => setAddingSize(true)}>
            Add size
          </Button>
        ) : (
          <Button variant="ink" caps iconLeft={<Plus className="size-3.5" />} onClick={() => setAdding(true)}>
            New variant
          </Button>
        )}
      </div>

      {variants.length === 0 ? (
        <Empty
          kicker="No variants"
          title="No variants yet."
          description="Add a variant to start tracking inventory — size, colour, SKU, and stock."
          action={
            <Button variant="ink" caps iconLeft={<Plus className="size-3.5" />} onClick={() => setAdding(true)}>
              Add variant
            </Button>
          }
        />
      ) : (
        <div className="border-t border-b border-ink/80 overflow-x-auto">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="border-b border-rule">
                <Th className="w-[5%]">№</Th>
                <Th className="w-[8%]">Image</Th>
                <Th className="w-[27%]">Variant</Th>
                <Th className="w-[17%]">SKU</Th>
                <Th className="w-[12%] text-right">Price</Th>
                <Th className="w-[10%] text-right">Stock</Th>
                <Th className="w-[8%] text-right">Held</Th>
                <Th className="w-[8%] text-right">Avail</Th>
                <Th className="w-[5%] text-right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {orderedVariants.map((v, i) => (
                <React.Fragment key={v.id}>
                {headerBefore.has(v.id) && (
                  <tr className="bg-paper-2/60">
                    <td colSpan={9} className="px-3 py-2">
                      {headerBefore.get(v.id)!.colorHex && (
                        <span
                          className="mr-1.5 inline-block size-3 rounded-sm border border-line align-middle"
                          style={{ backgroundColor: headerBefore.get(v.id)!.colorHex! }}
                        />
                      )}
                      <span className="text-[12.5px] font-semibold text-ink">{headerBefore.get(v.id)!.name}</span>
                      <span className="ml-2 text-[11.5px] text-ink-3">
                        {headerBefore.get(v.id)!.count} size{headerBefore.get(v.id)!.count === 1 ? '' : 's'} · {headerBefore.get(v.id)!.stock} in stock
                      </span>
                    </td>
                  </tr>
                )}
                <tr
                  onClick={() => setEditing(v)}
                  className={`cursor-pointer hover:bg-surface/40 transition-opacity ${v.isActive ? '' : 'opacity-50'}`}
                >
                  <Td className="font-mono text-[11px] text-ink-3 align-middle">
                    {String(i + 1).padStart(2, '0')}
                  </Td>
                  <Td className="align-middle">
                    <VariantThumb urls={v.imageUrls ?? []} />
                  </Td>
                  <Td>
                    <div className={`font-medium text-ink ${v.isActive ? '' : 'line-through decoration-ink-3'}`}>
                      {v.attributesLabel}
                    </div>
                    <div className="mt-0.5 text-[12px] text-ink-3">
                      {Object.entries(v.attributes).length > 0
                        ? Object.entries(v.attributes).map(([k, val]) => `${k}: ${val}`).join(' · ')
                        : 'No options'}
                    </div>
                  </Td>
                  <Td className="font-mono text-[12.5px]">
                    {v.sku ?? <span className="text-ink-4">—</span>}
                  </Td>
                  <Td className="text-right font-mono text-[14px] tabular-nums">
                    {formatPaise(v.pricePaise)}
                  </Td>
                  <Td className="text-right" onClick={(e) => e.stopPropagation()}>
                    {/* Stock is read-only here on purpose — Inventory owns it.
                        Click jumps to the Inventory row pre-filtered by SKU (or
                        product name when no SKU is set). */}
                    <Link
                      to={`/retailer/inventory?q=${encodeURIComponent(v.sku ?? listing.name)}`}
                      className="group/stock inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[13.5px] tabular-nums text-ink-2 hover:bg-bg-3 hover:text-ink"
                      title="Edit stock in Inventory"
                    >
                      {v.stock}
                      <ArrowUpRight className="size-3 text-ink-4 transition-transform group-hover/stock:-translate-y-px group-hover/stock:translate-x-px" />
                    </Link>
                  </Td>
                  <Td className="text-right font-mono text-[13px] text-ink-3 tabular-nums">{v.reserved}</Td>
                  <Td className={`text-right font-mono text-[13px] tabular-nums ${v.stock - v.reserved === 0 ? 'text-warning' : 'text-ink-2'}`}>
                    {v.stock - v.reserved}
                  </Td>
                  <Td className="text-right" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      iconLeft={<Edit3 className="size-3.5" />}
                      onClick={() => setEditing(v)}
                    >
                      Edit
                    </Button>
                  </Td>
                </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isColorSize && (
        <AddSizeDialog
          open={addingSize}
          onOpenChange={setAddingSize}
          listing={listing}
          groups={namedGroups}
          onCreated={onChanged}
        />
      )}
      <CreateVariantsDialog
        open={adding}
        onOpenChange={setAdding}
        listingId={listing.id}
        currentTemplateId={listing.templateId ?? null}
        gallery={listing.galleryUrls ?? []}
        onCreated={onChanged}
      />
      <EditInventoryDialog
        target={editing}
        gallery={listing.galleryUrls ?? []}
        onClose={() => setEditing(null)}
        onSaved={onChanged}
      />
    </>
  );
}

/**
 * Quick add for the system color → size structure: pick an existing color (or
 * create a new one inline), name the size, set price / MRP / stock / SKU. The
 * server derives attributes and the "Color / Size" label.
 */
function AddSizeDialog({
  open,
  onOpenChange,
  listing,
  groups,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  listing: Listing;
  groups: VariantGroup[];
  onCreated: () => void;
}) {
  const [groupChoice, setGroupChoice] = useState<string>(groups[0]?.id ?? '__new');
  const [newColor, setNewColor] = useState('');
  const [newHex, setNewHex] = useState<string | null>(null);
  const [size, setSize] = useState('');
  const [price, setPrice] = useState('');
  const [mrp, setMrp] = useState('');
  const [stock, setStock] = useState('');
  const [sku, setSku] = useState('');

  // Category-aware size systems (UK/US/EU for footwear, Letter/Waist for apparel…).
  const scalesQ = useQuery({
    queryKey: ['catalog', 'size-scales', listing.categoryId],
    queryFn: () => api<SizeScale[]>(`/catalog/size-scales?categoryId=${listing.categoryId}`),
    enabled: open,
  });
  const [scaleId, setScaleId] = useState<string | null>(null);
  const activeScale = scalesQ.data?.find((s) => s.id === scaleId) ?? scalesQ.data?.[0];

  const toPaiseLocal = (v: string): number | null => {
    const n = Number(v);
    return v.trim() === '' || Number.isNaN(n) ? null : Math.round(n * 100);
  };

  const create = useMutation({
    mutationFn: async () => {
      const pricePaise = toPaiseLocal(price);
      if (pricePaise === null || pricePaise <= 0) throw new Error('Set a selling price');
      const compareAt = toPaiseLocal(mrp);
      if (compareAt !== null && compareAt <= pricePaise) throw new Error('MRP must exceed the selling price');
      if (!size.trim()) throw new Error('Enter a size');

      let groupId = groupChoice;
      if (groupChoice === '__new') {
        const name = newColor.trim();
        if (!name) throw new Error('Name the new color');
        const created = await api<VariantGroup>(`/retailer/listings/${listing.id}/groups`, {
          method: 'POST',
          body: { name, ...(newHex ? { colorHex: newHex } : {}) },
        });
        groupId = created.id;
      }
      await api(`/retailer/listings/${listing.id}/groups/${groupId}/variants`, {
        method: 'POST',
        body: {
          size: size.trim(),
          pricePaise,
          ...(compareAt !== null ? { compareAtPrice: compareAt } : {}),
          stock: stock.trim() === '' ? 0 : Number(stock) || 0,
          ...(sku.trim() ? { sku: sku.trim() } : {}),
          imageUrls: [],
        },
      });
    },
    onSuccess: () => {
      toast.success('Size added');
      onOpenChange(false);
      setSize('');
      setPrice('');
      setMrp('');
      setStock('');
      setSku('');
      setNewColor('');
      setNewHex(null);
      onCreated();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Could not add size'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add a size</DialogTitle>
          <DialogDescription>Pick a color and add one size under it.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label required>Color</Label>
            <Select value={groupChoice} onValueChange={setGroupChoice}>
              <SelectTrigger>
                <SelectValue placeholder="Pick a color" />
              </SelectTrigger>
              <SelectContent>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
                <SelectItem value="__new">New color…</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {groupChoice === '__new' && (
            <div className="space-y-2">
              <div>
                <Label required hint="your naming — Black, Midnight Green…">New color name</Label>
                <Input value={newColor} onChange={(e) => setNewColor(e.target.value)} placeholder="e.g. Navy" />
              </div>
              <ColorSwatchPicker
                value={newHex}
                onChange={setNewHex}
                onSuggestName={(n) => {
                  if (!newColor.trim()) setNewColor(n);
                }}
              />
            </div>
          )}
          <div>
            <Label required>Size</Label>
            {(scalesQ.data?.length ?? 0) > 1 && (
              <div className="mb-1.5 flex flex-wrap gap-1">
                {scalesQ.data!.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setScaleId(s.id)}
                    className={cn(
                      'rounded-full px-2.5 py-0.5 text-[11px] transition-colors',
                      s.id === (activeScale?.id ?? '') ? 'bg-ink text-paper' : 'bg-bg-3 text-ink-3 hover:text-ink',
                    )}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}
            {activeScale && (
              <div className="mb-1.5 flex flex-wrap gap-1.5">
                {activeScale.values.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setSize(v)}
                    className={cn(
                      'rounded-md border px-2.5 py-1 text-[12px] transition-colors',
                      size === v ? 'border-ink bg-ink text-paper' : 'border-line bg-bg text-ink-2 hover:border-ink-3',
                    )}
                  >
                    {v}
                  </button>
                ))}
              </div>
            )}
            <Input value={size} onChange={(e) => setSize(e.target.value)} placeholder="e.g. M, UK 8, 32" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label required>Selling price ₹</Label>
              <Input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="999" />
            </div>
            <div>
              <Label>MRP ₹</Label>
              <Input value={mrp} onChange={(e) => setMrp(e.target.value)} inputMode="decimal" placeholder="—" />
            </div>
            <div>
              <Label>Stock</Label>
              <Input value={stock} onChange={(e) => setStock(e.target.value)} inputMode="numeric" placeholder="0" />
            </div>
            <div>
              <Label hint="auto">SKU</Label>
              <Input value={sku} onChange={(e) => setSku(e.target.value)} mono placeholder="auto" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="ink" size="sm" loading={create.isPending} onClick={() => create.mutate()}>
            Add size
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={
        'kicker text-ink-3 px-3 py-3 text-left ' + (className ?? '')
      }
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className,
  onClick,
}: {
  children?: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLTableCellElement>) => void;
}) {
  return (
    <td className={'px-3 py-4 align-top ' + (className ?? '')} onClick={onClick}>
      {children}
    </td>
  );
}

function VariantThumb({ urls }: { urls: string[] }) {
  const primary = urls[0];
  if (!primary) {
    return (
      <div className="grid size-12 place-items-center rounded-xs border border-rule bg-paper-2 text-ink-4">
        <ImageOff className="size-4" />
      </div>
    );
  }
  return (
    <div className="relative size-12 overflow-hidden rounded-xs border border-rule bg-paper-2">
      <img src={primary} alt="" className="size-full object-contain" loading="lazy" />
      {urls.length > 1 ? (
        <span className="absolute right-0.5 bottom-0.5 rounded-xs bg-ink/85 px-1 font-mono text-[10px] text-paper">
          +{urls.length - 1}
        </span>
      ) : null}
    </div>
  );
}

function CreateVariantsDialog({
  open,
  onOpenChange,
  listingId,
  currentTemplateId,
  gallery,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  listingId: string;
  currentTemplateId: string | null;
  gallery: string[];
  onCreated: () => void;
}) {
  const qc = useQueryClient();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(currentTemplateId);
  const [axes, setAxes] = useState<AxisState[]>([]);
  const [rowOverrides, setRowOverrides] = useState<Record<string, RowFields>>({});
  const [bulkPrice, setBulkPrice] = useState('999');
  const [bulkStock, setBulkStock] = useState('0');
  const [globalImages, setGlobalImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { data: templates } = useQuery({
    queryKey: ['retailer', 'attribute-templates'],
    queryFn: () => api<AttributeTemplate[]>('/retailer/attribute-templates'),
    enabled: open,
  });

  // Reset on close
  useEffect(() => {
    if (open) return;
    setAxes([]);
    setRowOverrides({});
    setBulkPrice('999');
    setBulkStock('0');
    setGlobalImages([]);
    setError(null);
    setSelectedTemplateId(currentTemplateId);
  }, [open, currentTemplateId]);

  // Populate axes whenever template loads or selection changes
  useEffect(() => {
    if (!selectedTemplateId || !templates) return;
    const tpl = templates.find((t) => t.id === selectedTemplateId);
    if (tpl) {
      setAxes(tpl.axes.map((a) => ({ name: a.name, type: a.type, allowedValues: a.allowedValues, selectedValues: [] })));
      setRowOverrides({});
    }
  }, [selectedTemplateId, templates]);

  function handleSelectTemplate(tplId: string | null) {
    setSelectedTemplateId(tplId);
    setRowOverrides({});
    if (!tplId) {
      setAxes([]);
      return;
    }
    const tpl = templates?.find((t) => t.id === tplId);
    if (tpl) {
      setAxes(tpl.axes.map((a) => ({ name: a.name, type: a.type, allowedValues: a.allowedValues, selectedValues: [] })));
    }
  }

  function toggleEnumValue(axisIdx: number, value: string) {
    setAxes((prev) =>
      prev.map((a, i) => {
        if (i !== axisIdx) return a;
        const has = a.selectedValues.includes(value);
        return { ...a, selectedValues: has ? a.selectedValues.filter((v) => v !== value) : [...a.selectedValues, value] };
      }),
    );
    setRowOverrides({});
  }

  function setFreeValues(axisIdx: number, values: string[]) {
    setAxes((prev) => prev.map((a, i) => (i === axisIdx ? { ...a, selectedValues: values } : a)));
    setRowOverrides({});
  }

  function addManualAxis() {
    setAxes((prev) => [...prev, { name: '', type: 'free_text', allowedValues: [], selectedValues: [] }]);
  }

  function updateAxisName(axisIdx: number, name: string) {
    setAxes((prev) => prev.map((a, i) => (i === axisIdx ? { ...a, name } : a)));
  }

  function removeAxis(axisIdx: number) {
    setAxes((prev) => prev.filter((_, i) => i !== axisIdx));
    setRowOverrides({});
  }

  const activeAxes = axes.filter((a) => a.selectedValues.length > 0);

  const rows = useMemo(() => {
    if (activeAxes.length === 0) {
      return [{ key: '__default__', attrs: {} as Record<string, string>, label: 'Default' }];
    }
    return cartesian(activeAxes.map((a) => a.selectedValues)).map((combo) => ({
      key: combo.join('||'),
      attrs: Object.fromEntries(activeAxes.map((a, i) => [a.name.toLowerCase(), combo[i]!])),
      label: combo.join(' / '),
    }));
  }, [activeAxes]);

  function getRowFields(key: string): RowFields {
    return rowOverrides[key] ?? { price: bulkPrice, stock: bulkStock, sku: '' };
  }

  function updateRow(key: string, patch: Partial<RowFields>) {
    setRowOverrides((prev) => ({ ...prev, [key]: { ...getRowFields(key), ...patch } }));
  }

  // ── Mutation ────────────────────────────────────────────
  const create = useMutation({
    mutationFn: async () => {
      if (selectedTemplateId !== currentTemplateId) {
        await api(`/retailer/listings/${listingId}`, { method: 'PATCH', body: { templateId: selectedTemplateId } });
      }
      const payloads = rows.map((r) => {
        const rf = getRowFields(r.key);
        return {
          attributes: r.attrs,
          attributesLabel: r.label,
          pricePaise: Math.round(parseFloat(rf.price) * 100),
          stock: parseInt(rf.stock, 10),
          imageUrls: globalImages,
          ...(rf.sku.trim() ? { sku: rf.sku.trim().toUpperCase() } : {}),
        };
      });
      if (payloads.length === 1) {
        return api<Variant>(`/retailer/listings/${listingId}/variants`, { method: 'POST', body: payloads[0] });
      }
      return api(`/retailer/listings/${listingId}/variants/bulk`, { method: 'POST', body: { variants: payloads } });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['retailer', 'listing', listingId] });
      toast.success(rows.length === 1 ? 'Variant created' : `${rows.length} variants created`);
      onOpenChange(false);
      onCreated();
    },
    onError: (e) => {
      setError(
        e instanceof ApiError && e.code === 'sku_taken'
          ? 'One or more SKUs already exist on this product.'
          : e instanceof Error
            ? e.message
            : 'Could not create variants',
      );
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (axes.some((a) => a.selectedValues.length > 0 && !a.name.trim())) {
      setError('Each axis needs a name.');
      return;
    }
    for (const r of rows) {
      const rf = getRowFields(r.key);
      const price = parseFloat(rf.price);
      const stock = parseInt(rf.stock, 10);
      if (!Number.isFinite(price) || price < 0.01) {
        setError(`Price for "${r.label}" must be at least ₹0.01.`);
        return;
      }
      if (!Number.isFinite(stock) || stock < 0) {
        setError(`Stock for "${r.label}" must be 0 or more.`);
        return;
      }
    }
    create.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] max-w-3xl flex-col gap-0 p-0">
        <DialogHeader className="px-6 pb-4 pt-6">
          <DialogTitle>Add variants</DialogTitle>
          <DialogDescription>
            Select values per axis to generate combinations, then set price &amp; stock for each.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-6 overflow-y-auto px-6 pb-4">

            {/* Template picker */}
            {(templates?.length ?? 0) > 0 && (
              <section className="rounded-lg border border-line bg-bg-2/30 p-4">
                <Label hint="populates axes below">From template</Label>
                <Select
                  value={selectedTemplateId ?? '__none__'}
                  onValueChange={(v) => handleSelectTemplate(v === '__none__' ? null : v)}
                >
                  <SelectTrigger><SelectValue placeholder="No template — build manually" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No template — build manually</SelectItem>
                    {templates!.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}{t.isPlatformDefault ? ' · platform default' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </section>
            )}

            {/* Axis value editors */}
            {axes.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="kicker text-ink-3">Select values per axis</span>
                  <span className="text-[11px] uppercase tracking-widest text-ink-3">{activeAxes.length} active</span>
                </div>
                {axes.map((axis, i) => (
                  <AxisValueEditor
                    key={i}
                    axis={axis}
                    fromTemplate={Boolean(selectedTemplateId)}
                    onNameChange={(name) => updateAxisName(i, name)}
                    onToggleEnum={(v) => toggleEnumValue(i, v)}
                    onSetFree={(values) => setFreeValues(i, values)}
                    onRemove={() => removeAxis(i)}
                  />
                ))}
              </section>
            )}

            {!selectedTemplateId && (
              <button
                type="button"
                onClick={addManualAxis}
                className="text-[12px] uppercase tracking-[0.14em] text-ink-2 hover:text-ink"
              >
                + Add axis
              </button>
            )}

            {/* Combination matrix */}
            <section>
              <div className="mb-3 flex items-center justify-between">
                <span className="kicker text-ink-3">
                  {rows.length} variant{rows.length !== 1 ? 's' : ''} will be created
                </span>
                {rows.length > 1 && (
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-ink-3">Apply to all —</span>
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-ink-3">price ₹</span>
                      <Input
                        mono
                        type="number"
                        min={1}
                        value={bulkPrice}
                        onChange={(e) => { setBulkPrice(e.target.value); setRowOverrides({}); }}
                        className="h-7 w-24 text-[12px]"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-ink-3">stock</span>
                      <Input
                        mono
                        type="number"
                        min={0}
                        value={bulkStock}
                        onChange={(e) => { setBulkStock(e.target.value); setRowOverrides({}); }}
                        className="h-7 w-20 text-[12px]"
                      />
                    </div>
                  </div>
                )}
              </div>
              <div className="overflow-hidden rounded-lg border border-line">
                <table className="w-full text-[12.5px]">
                  <thead className="border-b border-line bg-bg-2/40">
                    <tr>
                      <Th>Variant</Th>
                      <Th>SKU <span className="font-normal normal-case tracking-normal text-ink-4">(optional)</span></Th>
                      <Th>Price (₹)</Th>
                      <Th>Stock</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const rf = getRowFields(row.key);
                      return (
                        <tr key={row.key} className="border-b border-line last:border-0">
                          <Td className="font-medium text-ink">{row.label}</Td>
                          <Td>
                            <Input
                              mono
                              placeholder="LIN-M-BLK"
                              value={rf.sku}
                              onChange={(e) => updateRow(row.key, { sku: e.target.value.toUpperCase() })}
                              className="h-7 text-[12px] uppercase"
                            />
                          </Td>
                          <Td>
                            <Input
                              mono
                              type="number"
                              min={1}
                              value={rf.price}
                              onChange={(e) => updateRow(row.key, { price: e.target.value })}
                              className="h-7 w-28 text-[12px]"
                            />
                          </Td>
                          <Td>
                            <Input
                              mono
                              type="number"
                              min={0}
                              value={rf.stock}
                              onChange={(e) => updateRow(row.key, { stock: e.target.value })}
                              className="h-7 w-20 text-[12px]"
                            />
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Images — applied to all variants created in this batch */}
            {gallery.length > 0 && (
              <section>
                <div className="kicker mb-2 text-ink-3">
                  Images <span className="font-normal normal-case tracking-normal text-ink-4">— applied to all variants</span>
                </div>
                <VariantImagePicker gallery={gallery} selected={globalImages} onChange={setGlobalImages} />
              </section>
            )}

            {error && <FieldError>{error}</FieldError>}
          </div>

          <div className="flex justify-end gap-2 border-t border-line px-6 py-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" variant="ink" caps loading={create.isPending}>
              Create {rows.length > 1 ? `${rows.length} variants` : 'variant'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AxisValueEditor({
  axis,
  fromTemplate,
  onNameChange,
  onToggleEnum,
  onSetFree,
  onRemove,
}: {
  axis: AxisState;
  fromTemplate: boolean;
  onNameChange: (name: string) => void;
  onToggleEnum: (value: string) => void;
  onSetFree: (values: string[]) => void;
  onRemove: () => void;
}) {
  const [freeInput, setFreeInput] = useState('');

  function addFreeValue() {
    const val = freeInput.trim();
    if (val && !axis.selectedValues.includes(val)) {
      onSetFree([...axis.selectedValues, val]);
    }
    setFreeInput('');
  }

  function handleFreeKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addFreeValue();
    } else if (e.key === 'Backspace' && !freeInput && axis.selectedValues.length > 0) {
      onSetFree(axis.selectedValues.slice(0, -1));
    }
  }

  return (
    <div className="rounded-lg border border-line bg-bg-2/20 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {fromTemplate ? (
            <div className="text-[13px] font-medium text-ink">{axis.name}</div>
          ) : (
            <Input
              placeholder="Axis name (e.g. Size)"
              value={axis.name}
              onChange={(e) => onNameChange(e.target.value)}
              className="h-7 text-[12px]"
            />
          )}
          <span className="text-[11px] capitalize text-ink-4">{axis.type.replace('_', ' ')}</span>
        </div>
        {!fromTemplate && (
          <button type="button" onClick={onRemove} className="mt-0.5 text-ink-3 hover:text-danger">
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {axis.type === 'enum' && axis.allowedValues.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {axis.allowedValues.map((v) => {
            const selected = axis.selectedValues.includes(v);
            return (
              <button
                key={v}
                type="button"
                onClick={() => onToggleEnum(v)}
                className={`rounded-md border px-2.5 py-1 text-[12px] transition-colors ${
                  selected
                    ? 'border-ink bg-ink text-paper'
                    : 'border-line bg-bg text-ink-2 hover:border-ink-3'
                }`}
              >
                {v}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex min-h-[36px] flex-wrap items-center gap-1.5 rounded-md border border-line bg-bg px-2 py-1.5">
          {axis.selectedValues.map((v, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-sm bg-ink/8 px-2 py-0.5 text-[12px] text-ink-2">
              {v}
              <button
                type="button"
                onClick={() => onSetFree(axis.selectedValues.filter((_, j) => j !== i))}
                className="ml-0.5 text-ink-4 hover:text-danger"
              >
                <X className="size-2.5" />
              </button>
            </span>
          ))}
          <input
            value={freeInput}
            onChange={(e) => setFreeInput(e.target.value)}
            onKeyDown={handleFreeKeyDown}
            placeholder={axis.selectedValues.length === 0 ? 'Type a value and press Enter' : '+ add'}
            className="min-w-16 flex-1 bg-transparent text-[12px] text-ink outline-none placeholder:text-ink-4"
          />
        </div>
      )}
    </div>
  );
}

function EditInventoryDialog({
  target,
  gallery,
  onClose,
  onSaved,
}: {
  target: Variant | null;
  gallery: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(InventoryPatchSchema),
    defaultValues: { pricePaise: 0, sku: '' },
    ...(target
      ? { values: { pricePaise: target.pricePaise, sku: target.sku ?? '' } }
      : {}),
  });

  // RHF's register hands us its own onChange — wrap it so the SKU uppercases as the
  // user types. Saved values match the displayed value, so the API and the cell render
  // both see "lin-01" → "LIN-01".
  const skuField = register('sku');

  // Image gallery is managed independently of the form fields — every change PATCHes
  // the variant immediately so the user can add/remove without hitting Save.
  const [imageUrls, setImageUrls] = useState<string[]>(target?.imageUrls ?? []);
  const [isActive, setIsActive] = useState<boolean>(target?.isActive ?? true);
  useEffect(() => {
    setImageUrls(target?.imageUrls ?? []);
    setIsActive(target?.isActive ?? true);
  }, [target]);

  const save = useMutation({
    mutationFn: (v: InventoryPatchValues) =>
      api<Variant>(`/retailer/variants/${target!.id}`, {
        method: 'PATCH',
        body: {
          pricePaise: v.pricePaise,
          ...(v.sku ? { sku: v.sku } : {}),
          imageUrls,
          isActive,
        },
      }),
    onSuccess: () => {
      toast.success('Variant updated');
      onClose();
      reset();
      onSaved();
    },
    onError: (e) => {
      const code = e instanceof ApiError ? e.code : '';
      toast.error(
        code === 'sku_taken'
          ? 'That SKU collides with another variant.'
          : e instanceof Error
            ? e.message
            : 'Could not save',
      );
    },
  });

  const [confirmDelete, setConfirmDelete] = useState(false);
  const del = useMutation({
    mutationFn: () =>
      api(`/retailer/variants/${target!.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Variant deleted');
      setConfirmDelete(false);
      onClose();
      onSaved();
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : 'Could not delete');
    },
  });

  return (
    <Dialog open={Boolean(target)} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit {target?.attributesLabel}</DialogTitle>
          <DialogDescription>
            Update price, SKU, or images. Stock lives on the{' '}
            <Link to="/retailer/inventory" className="text-ink underline underline-offset-2">
              Inventory
            </Link>{' '}
            tab.
          </DialogDescription>
        </DialogHeader>
        {target && (
          <form onSubmit={handleSubmit((v) => save.mutate(v))} className="space-y-6" noValidate>
            <div>
              <div className="kicker mb-2 text-ink-3">Pricing &amp; identity</div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <Label htmlFor="ePrice" required hint="paise">Price</Label>
                  <Input id="ePrice" mono type="number" min={1} {...register('pricePaise')} />
                  <FieldError>{errors.pricePaise?.message}</FieldError>
                </div>
                <div>
                  <Label htmlFor="eSku">SKU</Label>
                  <Input
                    id="eSku"
                    mono
                    className="uppercase"
                    {...skuField}
                    onChange={(e) => {
                      e.target.value = e.target.value.toUpperCase();
                      setValue('sku', e.target.value, { shouldDirty: true, shouldValidate: true });
                    }}
                  />
                  <FieldError>{errors.sku?.message}</FieldError>
                </div>
              </div>
              <p className="mt-2 text-[11.5px] uppercase tracking-[0.14em] text-ink-3">
                Stock <span className="text-ink font-mono normal-case">{target.stock}</span>{' '}
                · reserved <span className="text-ink font-mono normal-case">{target.reserved}</span>{' '}
                · edit on the Inventory tab.
              </p>
            </div>

            <div>
              <div className="kicker mb-2 text-ink-3">Images</div>
              <VariantImagePicker
                gallery={gallery}
                selected={imageUrls}
                onChange={setImageUrls}
              />
            </div>

            <div className="rounded-lg border border-line">
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <Power className={`size-3.5 ${isActive ? 'text-success' : 'text-ink-4'}`} />
                  <span className="text-[12.5px] font-medium text-ink">
                    {isActive ? 'Active' : 'Inactive'}
                  </span>
                  <span className="text-[11.5px] text-ink-4">
                    {isActive ? '— visible to buyers' : '— hidden from buyers'}
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isActive}
                  onClick={() => setIsActive((v) => !v)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 ${isActive ? 'bg-success' : 'bg-ink-4'}`}
                >
                  <span
                    className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${isActive ? 'translate-x-4' : 'translate-x-0'}`}
                  />
                </button>
              </div>
              {!isActive && target.reserved > 0 && (
                <div className="border-t border-warning/30 bg-warning-soft/40 px-4 py-2.5 text-[11.5px] text-warning">
                  Heads up — this variant has <span className="font-mono">{target.reserved}</span> unit{target.reserved === 1 ? '' : 's'} reserved by open orders. Existing reservations remain fulfillable; new buyers cannot add it to their cart once you save.
                </div>
              )}
            </div>

            <DialogFooter className="sm:justify-between">
              <Button
                type="button"
                variant="danger"
                iconLeft={<Trash2 className="size-3.5" />}
                onClick={() => setConfirmDelete(true)}
              >
                Delete
              </Button>
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
                <Button type="submit" variant="ink" caps loading={isSubmitting || save.isPending} iconLeft={<Save className="size-3.5" />}>
                  Save
                </Button>
              </div>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete variant?</DialogTitle>
            <DialogDescription>
              {target?.attributesLabel ?? 'This variant'} will be permanently removed.
              {target && target.reserved > 0
                ? ` Currently ${target.reserved} unit(s) reserved — delete will fail.`
                : ' This cannot be undone.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button variant="danger" loading={del.isPending} onClick={() => del.mutate()}>
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

const DetailsPatchSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().or(z.literal('').transform(() => undefined)),
  // Rich HTML from the editor; '' is mapped to null on save (clears the column).
  descriptionLong: z.string().optional(),
  listingPolicy: z.enum(['return', 'replace', 'final_sale']),
  // 'taken_down' is admin-set; we accept it in the form default so the field renders,
  // but the UI Select keeps it read-only — see the conditional below.
  status: z.enum(['draft', 'active', 'retired', 'taken_down']),
  occasion: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  ageGroups: z.array(z.string()).max(7).default([]),
});
type DetailsPatchValues = z.infer<typeof DetailsPatchSchema>;

const DETAIL_OCCASION_PRESETS = [
  'casual', 'formal', 'work', 'party', 'festive',
  'sports', 'ethnic', 'wedding', 'beach', 'lounge',
] as const;

function DetailsTab({ listing, onChanged }: { listing: Listing; onChanged: () => void }) {
  const [confirmFinalSale, setConfirmFinalSale] = useState(false);
  const [pendingPolicy, setPendingPolicy] = useState<string | null>(null);

  const meQuery = useQuery({
    queryKey: ['retailer', 'me'],
    queryFn: () => api<{ store: Store | null }>('/retailer/me'),
  });
  const delegationLocked = meQuery.data?.store?.delegationModeEnabled === true;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(DetailsPatchSchema),
    defaultValues: {
      name: listing.name,
      description: listing.description ?? '',
      descriptionLong: listing.descriptionLong ?? '',
      listingPolicy: listing.listingPolicy,
      status: listing.status,
      occasion: listing.occasion ?? [],
      ageGroups: listing.ageGroups ?? [],
    },
  });

  function handlePolicyChange(v: string) {
    if (v === 'final_sale' && listing.listingPolicy !== 'final_sale') {
      setPendingPolicy(v);
      setConfirmFinalSale(true);
      return;
    }
    setValue('listingPolicy', v as DetailsPatchValues['listingPolicy']);
  }

  const save = useMutation({
    mutationFn: (v: DetailsPatchValues) =>
      api<Listing>(`/retailer/listings/${listing.id}`, {
        method: 'PATCH',
        // Empty editor → null so the server clears the column.
        body: { ...v, descriptionLong: v.descriptionLong ? v.descriptionLong : null },
      }),
    onSuccess: () => {
      toast.success('Saved');
      onChanged();
    },
    onError: (e) => {
      const code = e instanceof ApiError ? e.code : '';
      toast.error(
        code === 'store_not_active'
          ? 'Store needs to be active to publish.'
          : e instanceof Error
            ? e.message
            : 'Save failed',
      );
    },
  });

  return (
    <form
      onSubmit={handleSubmit((v) => save.mutate(v))}
      className="grid gap-12 lg:grid-cols-12"
    >
      <section className="lg:col-span-7 space-y-7">
        <SectionHeading title="Product info" />
        <div>
          <Label htmlFor="dName" required>Name</Label>
          <Input id="dName" {...register('name')} />
          <FieldError>{errors.name?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="dDesc" hint="Optional">Short description</Label>
          <Textarea
            id="dDesc"
            rows={4}
            placeholder="One-liner for cards and search…"
            {...register('description')}
          />
          <FieldError>{errors.description?.message}</FieldError>
        </div>
        <div>
          <Label hint="Optional">Full description</Label>
          <p className="mb-1.5 text-[12px] text-ink-3">
            Rich formatting for the product page — headings, lists, tables, colours and images.
          </p>
          <Suspense
            fallback={
              <div className="flex h-[260px] items-center justify-center rounded-md border border-line-2 text-[12.5px] text-ink-4">
                Loading editor…
              </div>
            }
          >
            <RichTextEditor
              value={watch('descriptionLong') ?? ''}
              onChange={(html) => setValue('descriptionLong', html, { shouldDirty: true })}
              uploadFolder={`products/${listing.id}/description`}
            />
          </Suspense>
        </div>
      </section>

      <section className="lg:col-span-5 space-y-7">
        <SectionHeading title="Metadata" />
        <div>
          <Label hint="Publish via the panel above">Status</Label>
          <Select
            value={watch('status') === 'active' ? 'active' : watch('status')}
            onValueChange={(v) => setValue('status', v as DetailsPatchValues['status'])}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              {watch('status') === 'active' && <SelectItem value="active">Active</SelectItem>}
              <SelectItem value="retired">Retired</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Return policy</Label>
          {delegationLocked ? (
            <div title="Policy controlled by platform delegation settings">
              <Select value={watch('listingPolicy')} disabled>
                <SelectTrigger className="opacity-60 cursor-not-allowed"><SelectValue /></SelectTrigger>
              </Select>
              <p className="mt-1 text-[11.5px] text-ink-3">Controlled by platform delegation settings.</p>
            </div>
          ) : (
            <Select value={watch('listingPolicy')} onValueChange={handlePolicyChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="return">Returnable</SelectItem>
                <SelectItem value="replace">Replace only</SelectItem>
                <SelectItem value="final_sale">Final sale</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
        <div>
          <Label hint="Optional · multi-select · years">Age groups</Label>
          <AgeRangeChips
            value={watch('ageGroups') ?? []}
            onChange={(next) => setValue('ageGroups', next)}
          />
        </div>
        <div>
          <Label hint="Optional · multi-select">Occasion tags</Label>
          <div className="flex flex-wrap gap-1.5">
            {DETAIL_OCCASION_PRESETS.map((occ) => {
              const current = watch('occasion') ?? [];
              const selected = current.includes(occ);
              return (
                <button
                  key={occ}
                  type="button"
                  onClick={() => {
                    if (selected) {
                      setValue('occasion', current.filter((c) => c !== occ));
                    } else if (current.length < 10) {
                      setValue('occasion', [...current, occ]);
                    } else {
                      toast.error('At most 10 occasions allowed');
                    }
                  }}
                  className={
                    'rounded-full border px-3 py-1 text-[12px] capitalize transition-colors ' +
                    (selected
                      ? 'border-accent bg-accent text-accent-fg'
                      : 'border-line bg-bg text-ink-2 hover:border-line-2')
                  }
                >
                  {occ}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <div className="lg:col-span-12 flex items-center justify-end gap-2 border-t border-rule pt-6">
        <Button
          type="submit"
          variant="ink"
          caps
          loading={isSubmitting || save.isPending}
          iconLeft={<Save className="size-3.5" />}
        >
          Save changes
        </Button>
      </div>

      <Dialog open={confirmFinalSale} onOpenChange={setConfirmFinalSale}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Switch to Final sale?</DialogTitle>
            <DialogDescription>
              Shoppers will see <span className="font-medium text-ink">"No returns"</span> on this listing.
              Final sale removes return and replace rights for all future orders. Already-placed orders keep the policy they were bought under and are unaffected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setConfirmFinalSale(false); setPendingPolicy(null); }}>Cancel</Button>
            <Button variant="danger" onClick={() => {
              if (pendingPolicy) setValue('listingPolicy', pendingPolicy as DetailsPatchValues['listingPolicy']);
              setConfirmFinalSale(false);
              setPendingPolicy(null);
            }}>
              Confirm final sale
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}

/**
 * Publish-readiness panel — shown above the tabs on the listing detail page.
 *  - Mirrors the backend gate exactly: at least one variant + at least one gallery image
 *  - Owns the Publish action (so it can run readiness checks BEFORE the API hop)
 *  - Owns gallery-URL management (paste any image URL, no upload pipeline yet)
 *  - Once published, switches to a compact "Published" header with an Unpublish action
 */
function PublishPanel({ listing, onChanged }: { listing: Listing; onChanged: () => void }) {
  const variants = listing.variants ?? [];
  const images = listing.galleryUrls ?? [];
  const hasVariants = variants.length > 0;
  const hasImages = images.length > 0;
  const [reviewOpen, setReviewOpen] = useState(false);

  const isPublished = listing.status === 'active';

  const patch = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api<Listing>(`/retailer/listings/${listing.id}`, { method: 'PATCH', body }),
    onSuccess: () => {
      onChanged();
      setReviewOpen(false);
    },
    onError: (e) => {
      const code = e instanceof ApiError ? e.code : '';
      const msg =
        code === 'cannot_publish_incomplete'
          ? e instanceof ApiError ? e.message : 'Cannot publish — listing is incomplete.'
          : code === 'store_not_active'
            ? 'Your store is not active.'
            : code === 'retailer_not_approved'
              ? 'Your account needs admin approval first.'
              : e instanceof Error
                ? e.message
                : 'Update failed.';
      toast.error(msg);
    },
  });

  function openReview() {
    if (!hasVariants) {
      toast.error('Add at least one variant before publishing');
      return;
    }
    if (!hasImages) {
      toast.error('Add at least one image before publishing');
      return;
    }
    setReviewOpen(true);
  }

  function publishNow() {
    patch.mutate({ status: 'active' });
  }

  function unpublish() {
    patch.mutate({ status: 'draft' });
  }

  return (
    <section className="mb-8 border border-rule bg-surface p-5 sm:p-6 rounded-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="kicker text-ink-3">Publish status</div>
          <h2 className="font-display italic text-[22px] sm:text-[24px] leading-tight mt-1">
            {isPublished ? <>This product is <em>live</em>.</> : <>Get this product ready to publish.</>}
          </h2>
        </div>
        {isPublished ? (
          <Button
            variant="outline"
            size="sm"
            onClick={unpublish}
            loading={patch.isPending && (patch.variables as { status?: string } | undefined)?.status === 'draft'}
          >
            Unpublish (back to draft)
          </Button>
        ) : (
          <Button
            variant="ink"
            caps
            size="sm"
            disabled={!hasVariants || !hasImages}
            iconLeft={<Check className="size-3.5" />}
            onClick={openReview}
            title={
              !hasVariants
                ? 'Add at least one variant before publishing'
                : !hasImages
                  ? 'Add at least one gallery image before publishing'
                  : undefined
            }
          >
            Review & Publish
          </Button>
        )}
      </div>

      <ReviewPublishDialog
        open={reviewOpen}
        listing={listing}
        publishing={patch.isPending && (patch.variables as { status?: string } | undefined)?.status === 'active'}
        onClose={() => setReviewOpen(false)}
        onPublish={publishNow}
      />

      {/* Readiness checklist — only shown while drafting */}
      {!isPublished && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <ReadyItem
            ok={hasVariants}
            label="At least one variant"
            detail={
              hasVariants
                ? `${variants.length} on file (price + stock set)`
                : 'Add a variant in the tab below — it carries SKU, price, and stock.'
            }
          />
          <ReadyItem
            ok={hasImages}
            label="At least one image"
            detail={
              hasImages
                ? `${images.length} on file · drag in the gallery below to reorder`
                : 'Drop a file in the gallery below — crop, then we host it on the CDN.'
            }
          />
        </div>
      )}

      {/* Full media gallery — drag/drop, crop, sortable preview, URL fallback */}
      <div className="mt-6 border-t border-rule pt-5">
        <MediaGallery
          urls={images}
          uploadFolder={`products/${listing.id}`}
          purpose="listing-gallery"
          maxImages={10}
          busy={patch.isPending}
          onChange={(next) => patch.mutate({ galleryUrls: next })}
        />
      </div>
    </section>
  );
}

const REVIEW_POLICY_LABEL: Record<Listing['listingPolicy'], string> = {
  return: 'Returnable',
  replace: 'Replace only',
  final_sale: 'Final sale',
};


function ReviewPublishDialog({
  open,
  listing,
  publishing,
  onClose,
  onPublish,
}: {
  open: boolean;
  listing: Listing;
  publishing: boolean;
  onClose: () => void;
  onPublish: () => void;
}) {
  const variants = listing.variants ?? [];
  const images = listing.galleryUrls ?? [];
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review &amp; publish</DialogTitle>
          <DialogDescription>
            Read-only summary of everything that will go live. Edit any section by closing this dialog and using the tabs below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {/* Basics */}
          <ReviewBlock title="Basics">
            <ReviewRow label="Name" value={listing.name} />
            <ReviewRow label="Brand" value={listing.brand?.name ?? <em className="text-ink-3">Unbranded</em>} />
            <ReviewRow label="Category" value={listing.category?.label ?? <em className="text-ink-3">Uncategorised</em>} />
            <ReviewRow label="Cut for" value={<span className="capitalize">{listing.gender}</span>} />
            <ReviewRow
              label="Description"
              value={listing.description?.trim() || <em className="text-ink-3">none</em>}
            />
          </ReviewBlock>

          {/* Tags */}
          <ReviewBlock title="Tags">
            <ReviewRow
              label="Age groups"
              value={
                (listing.ageGroups ?? []).length > 0
                  ? `${listing.ageGroups.join(', ')} yrs`
                  : <em className="text-ink-3">unspecified</em>
              }
            />
            <ReviewRow
              label="Occasion"
              value={
                (listing.occasion?.length ?? 0) > 0
                  ? <span className="capitalize">{listing.occasion.join(', ')}</span>
                  : <em className="text-ink-3">none</em>
              }
            />
          </ReviewBlock>

          {/* Policy */}
          <ReviewBlock title="Policy">
            <ReviewRow label="Return policy" value={REVIEW_POLICY_LABEL[listing.listingPolicy]} />
            <ReviewRow
              label="HSN"
              value={listing.hsn?.trim() ? <span className="font-mono">{listing.hsn}</span> : <em className="text-ink-3">none</em>}
            />
          </ReviewBlock>

          {/* Variants */}
          <ReviewBlock title={`Variants · ${variants.length}`}>
            {variants.length === 0 ? (
              <p className="text-[13px] text-ink-3 italic px-1">No variants yet.</p>
            ) : (
              <div className="overflow-hidden rounded-xs border border-rule">
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="border-b border-rule bg-bg-2/60">
                      <th className="text-left py-2 px-3 kicker text-ink-3">Attributes</th>
                      <th className="text-left py-2 px-3 kicker text-ink-3">SKU</th>
                      <th className="text-right py-2 px-3 kicker text-ink-3">Price</th>
                      <th className="text-right py-2 px-3 kicker text-ink-3">Stock</th>
                      <th className="text-left py-2 px-3 kicker text-ink-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rule">
                    {variants.map((v) => (
                      <tr key={v.id} className="hover:bg-bg-2/40">
                        <td className="px-3 py-2 text-ink">{v.attributesLabel}</td>
                        <td className="px-3 py-2 text-ink-2 font-mono">{v.sku ?? '—'}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums text-ink">{formatPaise(v.pricePaise)}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums text-ink">{v.stock}</td>
                        <td className="px-3 py-2">
                          <Badge tone={v.isActive ? 'success' : 'neutral'} flat>
                            {v.isActive ? 'active' : 'inactive'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ReviewBlock>

          {/* Gallery */}
          <ReviewBlock title={`Gallery · ${images.length} ${images.length === 1 ? 'image' : 'images'}`}>
            {images.length === 0 ? (
              <p className="text-[13px] text-ink-3 italic px-1">No images.</p>
            ) : (
              <ul className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {images.map((url, i) => (
                  <li key={url} className="relative aspect-square overflow-hidden rounded-xs border border-rule bg-bg-2">
                    <img src={url} alt="" loading="lazy" className="size-full object-cover" />
                    {i === 0 && (
                      <span className="absolute left-1.5 top-1.5 rounded-xs bg-ink/90 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.12em] text-paper">
                        Cover
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </ReviewBlock>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={publishing}>
            Cancel
          </Button>
          <Button
            variant="ink"
            caps
            iconLeft={<Check className="size-3.5" />}
            onClick={onPublish}
            loading={publishing}
          >
            Publish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReviewBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xs border border-rule bg-paper-2/40 p-4">
      <h3 className="kicker text-ink-3 mb-2">{title}</h3>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

function ReviewRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 border-b border-rule/60 pb-1.5 last:border-b-0">
      <dt className="w-32 shrink-0 text-[11.5px] uppercase tracking-[0.08em] text-ink-3">{label}</dt>
      <dd className="min-w-0 flex-1 text-[13px] text-ink break-words">{value}</dd>
    </div>
  );
}

function ReadyItem({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div className="flex items-start gap-3 border border-rule rounded-xs px-3 py-2.5">
      <span
        className={
          ok
            ? 'mt-0.5 grid size-5 place-items-center rounded-full bg-success-soft text-success'
            : 'mt-0.5 grid size-5 place-items-center rounded-full bg-warning-soft text-warning'
        }
        aria-hidden
      >
        {ok ? <Check className="size-3" /> : <span className="size-1.5 bg-warning rounded-full" />}
      </span>
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-ink">{label}</div>
        <div className="mt-0.5 text-[12px] text-ink-3">{detail}</div>
      </div>
    </div>
  );
}

