import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { ArrowLeft, Copy, Download, Pause, Play, Plus, X } from 'lucide-react';
import { api, ApiError, BASE } from '@/lib/api';
import { getToken } from '@/lib/auth';
import {
  discountTypeLabel,
  formatDiscount,
  mechanismLabel,
  promotionStatusMeta,
} from '@/lib/status';
import type { AdminStoreView, Brand, Category, Listing, Promotion, VoucherCode } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MetaList } from '@/components/ui/meta-list';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label, FieldError } from '@/components/ui/label';
import { EligibilitySection, buildScopePayload } from '@/components/promotion/EligibilitySection';

export default function AdminPromotionDetail() {
  const { id = '' } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const promo = useQuery({
    queryKey: ['admin', 'promotion', id],
    queryFn: () => api<Promotion>(`/admin/promotions/${id}`),
  });

  const lifecycle = useMutation({
    mutationFn: ({ action, reason }: { action: 'pause' | 'resume' | 'revoke' | 'activate'; reason?: string | undefined }) =>
      api<Promotion>(`/admin/promotions/${id}/${action}`, {
        method: 'POST',
        body: reason ? { reason } : {},
      }),
    onSuccess: (p) => {
      toast.success(`${promotionStatusMeta(p.effectiveStatus).label}`);
      setReasonDialog(null);
      setReasonText('');
      void qc.invalidateQueries({ queryKey: ['admin', 'promotion', id] });
      void qc.invalidateQueries({ queryKey: ['admin', 'promotions'] });
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
          description={promo.error instanceof ApiError ? promo.error.message : 'Unknown error'}
          action={<Button asChild variant="outline"><Link to="/admin/promotions">Back to promotions</Link></Button>}
        />
      </Page>
    );
  }

  const p = promo.data;
  const meta = promotionStatusMeta(p.effectiveStatus);
  const isVoucher = p.mechanism === 'voucher';
  const canPause = p.effectiveStatus === 'active' || p.effectiveStatus === 'scheduled';
  const canResume = p.effectiveStatus === 'paused';
  const canRevoke = !['expired', 'exhausted', 'revoked'].includes(p.effectiveStatus);
  const canActivate = p.effectiveStatus === 'draft';

  return (
    <Page>
      <Link
        to="/admin/promotions"
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
            {p.storeId ? <Badge flat>Store-scoped</Badge> : <Badge flat>Platform-wide</Badge>}
          </div>
        }
      />

      {p.storeId && (
        <div className="-mt-2 mb-4 flex flex-wrap gap-2">
          <Link
            to={`/admin/stores?storeId=${p.storeId}`}
            className="inline-flex items-center gap-1 rounded-full border border-line bg-bg-2 px-2 py-0.5 text-[11.5px] text-ink-3 hover:text-ink hover:bg-bg-3"
          >
            Open store
          </Link>
        </div>
      )}

      {/* Lifecycle action bar */}
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

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          {isVoucher && <TabsTrigger value="codes">Voucher codes</TabsTrigger>}
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-12 md:grid-cols-2">
            <div>
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
                  { label: 'Issued by', value: p.issuerType },
                  { label: 'Clubbing slot', value: p.appliedTo },
                ]}
              />
            </div>
            <div>
              <h3 className="kicker text-ink-3 mb-2">Raw config</h3>
              <pre className="rounded-xs border border-rule bg-paper-2/40 p-4 text-[12px] font-mono overflow-auto leading-relaxed text-ink-2">
                {JSON.stringify(p.config, null, 2)}
              </pre>
              {Object.keys(p.scope).length > 0 && (
                <>
                  <h3 className="kicker text-ink-3 mt-6 mb-2">Scope / eligibility</h3>
                  <pre className="rounded-xs border border-rule bg-paper-2/40 p-4 text-[12px] font-mono overflow-auto leading-relaxed text-ink-2">
                    {JSON.stringify(p.scope, null, 2)}
                  </pre>
                </>
              )}
            </div>
          </div>
        </TabsContent>

        {isVoucher && (
          <TabsContent value="codes">
            <VoucherCodesPanel promotionId={p.id} />
          </TabsContent>
        )}

        <TabsContent value="settings">
          <ScopeEditPanel promotionId={p.id} storeId={p.storeId ?? null} onSaved={() => qc.invalidateQueries({ queryKey: ['admin', 'promotion', id] })} />
        </TabsContent>
      </Tabs>

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
              placeholder="e.g. anomaly detected — investigating"
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

// ─── Scope edit panel ───

function ScopeEditPanel({ promotionId, storeId, onSaved }: { promotionId: string; storeId: string | null; onSaved: () => void }) {
  const form = useForm({ defaultValues: { scope: {} as Record<string, unknown> } });

  const save = useMutation({
    mutationFn: (values: { scope: Record<string, unknown> }) => {
      const scopePayload = buildScopePayload(values.scope);
      return api(`/admin/promotions/${promotionId}`, {
        method: 'PATCH',
        body: { scope: scopePayload },
      });
    },
    onSuccess: () => {
      toast.success('Eligibility conditions saved');
      onSaved();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Save failed'),
  });

  const listings = useQuery({
    queryKey: ['admin', 'stores', storeId, 'listings'],
    queryFn: () => api<Listing[]>(`/admin/stores/${storeId}/listings`),
    enabled: Boolean(storeId),
  });
  const brands = useQuery({
    queryKey: ['catalog', 'brands'],
    queryFn: () => api<Brand[]>('/catalog/brands'),
  });
  const categories = useQuery({
    queryKey: ['catalog', 'categories'],
    queryFn: () => api<Category[]>('/catalog/categories'),
  });
  const stores = useQuery({
    queryKey: ['admin', 'stores', 'all'],
    queryFn: () => api<AdminStoreView[]>('/admin/stores'),
  });
  const listingItems = (listings.data ?? []).map((l) => ({ id: l.id, name: l.name }));
  const brandItems = (brands.data ?? []).map((b) => ({ id: b.id, name: b.name }));
  const categoryItems = (categories.data ?? []).map((c) => ({ id: c.id, label: c.label }));
  const storeItems = (stores.data ?? []).map((s) => ({ id: s.id, name: s.legalName }));

  return (
    <FormProvider {...form}>
      <form
        onSubmit={form.handleSubmit((v) => save.mutate(v))}
        className="space-y-6 max-w-2xl"
        noValidate
      >
        <p className="text-[13px] text-ink-3">
          Update eligibility conditions for this promotion. Fields left blank remain unrestricted.
          Saving overwrites the existing scope.
        </p>
        <EligibilitySection
          listings={listingItems}
          listingsLoading={listings.isLoading}
          categories={categoryItems}
          categoriesLoading={categories.isLoading}
          brands={brandItems}
          brandsLoading={brands.isLoading}
          stores={storeItems}
          storesLoading={stores.isLoading}
        />
        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" variant="ink" caps loading={save.isPending}>
            Save conditions
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}

// ─── Voucher codes panel ───

function VoucherCodesPanel({ promotionId }: { promotionId: string }) {
  const qc = useQueryClient();
  const [generating, setGenerating] = useState(false);

  const codes = useQuery({
    queryKey: ['admin', 'voucher-codes', promotionId],
    queryFn: () => api<VoucherCode[]>(`/admin/promotions/${promotionId}/voucher-codes`),
  });

  const downloadCsv = () => {
    const url = `${BASE}/admin/promotions/${promotionId}/voucher-codes/export`;
    const token = getToken();
    fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `vouchers-${promotionId}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch(() => toast.error('Could not download CSV'));
  };

  const allCodes = (codes.data ?? []).map((v) => v.code).join('\n');
  const copyAll = () => {
    void navigator.clipboard.writeText(allCodes);
    toast.success(`Copied ${codes.data?.length ?? 0} codes`);
  };

  return (
    <>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="font-display italic text-[20px] leading-tight">Voucher codes</h3>
          <p className="text-[12.5px] text-ink-3 mt-0.5">
            Each code is single-use globally. Generate in batches.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" iconLeft={<Copy className="size-3.5" />} onClick={copyAll} disabled={!codes.data?.length}>
            Copy all
          </Button>
          <Button variant="outline" size="sm" iconLeft={<Download className="size-3.5" />} onClick={downloadCsv} disabled={!codes.data?.length}>
            CSV
          </Button>
          <Button variant="ink" caps size="sm" iconLeft={<Plus className="size-3.5" />} onClick={() => setGenerating(true)}>
            Generate
          </Button>
        </div>
      </div>

      {codes.isLoading ? (
        <Skeleton className="h-32" />
      ) : !codes.data?.length ? (
        <Empty
          kicker="No codes yet"
          title="Bulk-generate to start."
          description="Pick a count and (optionally) a prefix. Codes are 8 chars from a 32-char alphabet (no 0/O, 1/I/L)."
          action={
            <Button variant="ink" caps iconLeft={<Plus className="size-3.5" />} onClick={() => setGenerating(true)}>
              Generate codes
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-px border border-rule bg-rule sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {codes.data.map((v) => {
            const used = v.totalUses != null && v.redeemedCount >= v.totalUses;
            return (
              <div
                key={v.id}
                className={`bg-paper p-3 text-center ${used ? 'opacity-40' : ''}`}
              >
                <div className="font-mono text-[13.5px] tracking-[0.15em] text-ink">{v.code}</div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-ink-3">
                  {v.redeemedCount} / {v.totalUses ?? '∞'}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <GenerateDialog
        open={generating}
        onOpenChange={setGenerating}
        promotionId={promotionId}
        onDone={() => qc.invalidateQueries({ queryKey: ['admin', 'voucher-codes', promotionId] })}
      />
    </>
  );
}

function GenerateDialog({
  open,
  onOpenChange,
  promotionId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  promotionId: string;
  onDone: () => void;
}) {
  const [count, setCount] = useState('25');
  const [prefix, setPrefix] = useState('');
  const [error, setError] = useState('');

  const generate = useMutation({
    mutationFn: () =>
      api<{ generated: number }>(
        `/admin/promotions/${promotionId}/voucher-codes/generate`,
        {
          method: 'POST',
          body: {
            count: Number(count),
            prefix: prefix.trim().toUpperCase() || undefined,
          },
        },
      ),
    onSuccess: (res) => {
      toast.success(`Generated ${res.generated} codes`);
      onOpenChange(false);
      setCount('25');
      setPrefix('');
      onDone();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Failed'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate voucher codes</DialogTitle>
          <DialogDescription>
            Bulk-create unique codes. Each is 8 chars from a 32-char alphabet (no 0/O, 1/I/L).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label required>Count</Label>
            <Input mono type="number" min={1} max={10_000} value={count} onChange={(e) => setCount(e.target.value)} />
          </div>
          <div>
            <Label hint="Optional, A-Z and 0-9 only">Prefix</Label>
            <Input mono placeholder="e.g. DROP24" value={prefix} onChange={(e) => setPrefix(e.target.value.toUpperCase())} />
          </div>
          <FieldError>{error}</FieldError>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="ink" caps loading={generate.isPending} onClick={() => generate.mutate()}>
            Generate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

