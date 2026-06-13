import { useRef, useState } from 'react';
import { Link, NavLink, Outlet, useOutletContext } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { uploadMedia } from '@/lib/upload';
import { storeStatusMeta } from '@/lib/status';
import type { RetailerFeeView, RetailerProfile, Store } from '@/lib/types';
import { Page, PageHeader, SectionHeading } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MetaList } from '@/components/ui/meta-list';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { usePermission } from '@/lib/use-permission';
import { KycReverificationPanel } from './kyc';
import { cn } from '@/lib/cn';
import type { StoreVisibilityWhilePaused } from '@/lib/types';

type StoreWithPause = Store & {
  pauseReason: string | null;
  pauseUntil: string | null;
  pauseVisibility: StoreVisibilityWhilePaused | null;
};
type MeResponse = { retailer: RetailerProfile; store: StoreWithPause | null };

/** Outlet context shared with every store-settings section page. */
type StoreCtx = { store: StoreWithPause };
function useStore() {
  return useOutletContext<StoreCtx>().store;
}

/**
 * Store settings is a routed hub: each section (Basics, Photos, …, KYC, Status)
 * lives on its own page under `/retailer/store/*`, switched by the tab strip
 * below the header. Replaced the former single-scroll anchor-nav so each area
 * is a focused page rather than one long scroll.
 */
export default function RetailerStorePage() {
  const { data, isLoading } = useQuery({
    queryKey: ['retailer', 'me'],
    queryFn: () => api<MeResponse>('/retailer/me'),
  });

  if (isLoading) {
    return (
      <Page>
        <PageHeader title="Store settings" />
        <Skeleton className="h-72 w-full" />
      </Page>
    );
  }

  const store = (data?.store as StoreWithPause | null) ?? null;

  if (!store) {
    return (
      <Page>
        <PageHeader title="Store settings" />
        <div className="mx-auto max-w-md py-16 text-center space-y-3">
          <p className="text-[14px] font-medium text-ink">Store not provisioned yet</p>
          <p className="text-[13px] text-ink-3">
            Your store is created automatically when Trendzo approves your application.
            Check back after you receive the approval email.
          </p>
        </div>
      </Page>
    );
  }

  const meta = storeStatusMeta(store.status);
  return (
    <Page>
      <PageHeader
        title={<em>{store.legalName}</em>}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={meta.tone}>{meta.label}</Badge>
            <Button asChild variant="outline" size="sm">
              <Link to="/retailer/change-requests">Edit details</Link>
            </Button>
          </div>
        }
      />

      <StoreTabNav />

      <Outlet context={{ store } satisfies StoreCtx} />
    </Page>
  );
}

const TABS: ReadonlyArray<{ to: string; label: string; end?: boolean }> = [
  { to: '/retailer/store', label: 'Basics', end: true },
  { to: '/retailer/store/photos', label: 'Photos' },
  { to: '/retailer/store/hours', label: 'Hours' },
  { to: '/retailer/store/address', label: 'Address' },
  { to: '/retailer/store/bank', label: 'Legal & Bank' },
  { to: '/retailer/store/kyc', label: 'KYC' },
  { to: '/retailer/store/status', label: 'Status' },
];

function StoreTabNav() {
  return (
    <div className="sticky top-0 z-10 -mx-1 mb-6 overflow-x-auto bg-bg/90 backdrop-blur supports-[backdrop-filter]:bg-bg/70">
      <nav className="flex gap-1 border-b border-line px-1 py-2 whitespace-nowrap">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end ?? false}
            className={({ isActive }) =>
              cn(
                'rounded-full px-3 py-1 text-[12.5px] transition-colors',
                isActive ? 'bg-ink text-bg' : 'text-ink-3 hover:text-ink hover:bg-bg-2',
              )
            }
          >
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

/* ── Section pages ─────────────────────────────────────────────────────── */

export function StoreBasicsSection() {
  const store = useStore();
  return (
    <div className="space-y-6">
      <section>
        <SectionHeading title="Profile basics" />
        <MetaList
          cols={2}
          items={[
            { label: 'Legal name', value: store.legalName },
            { label: 'Store ID', value: store.id, mono: true },
            { label: 'GSTIN', value: store.gstin, mono: true },
            { label: 'State code', value: store.stateCode, mono: true, hint: 'GST place-of-supply' },
            { label: 'Contact phone', value: store.contactPhone ?? '—' },
            { label: 'Manager name', value: store.managerName ?? '—' },
          ]}
        />
        <div className="mt-4 rounded-lg border border-line bg-bg-2/40 px-4 py-3 text-[13px] text-ink-2">
          Legal details (name, GSTIN, address) are KYC-protected.{' '}
          <Link to="/retailer/change-requests" className="text-accent underline underline-offset-2">
            Submit a change request
          </Link>{' '}
          to update them.
        </div>
      </section>
      <section>
        <SectionHeading title="Contact info" />
        <ContactInfoPanel store={store} />
      </section>
      <section>
        <SectionHeading title="GST &amp; billing" />
        <TaxSchemePanel store={store} />
      </section>
    </div>
  );
}

export function StorePhotosSection() {
  const store = useStore();
  return (
    <section>
      <SectionHeading title="Store photos" />
      <StoreGalleryPanel store={store} />
    </section>
  );
}

export function StoreHoursSection() {
  return (
    <section>
      <SectionHeading title="Operating hours" />
      <StoreHoursPanel />
    </section>
  );
}

export function StoreAddressSection() {
  const store = useStore();
  return (
    <section>
      <SectionHeading title="Location" />
      <MetaList
        cols={2}
        items={[
          { label: 'Address', value: store.address },
          { label: 'Coordinates', value: `${store.lat.toFixed(5)}, ${store.lng.toFixed(5)}`, mono: true },
          { label: 'State code', value: store.stateCode, mono: true },
        ]}
      />
    </section>
  );
}

export function StoreBankSection() {
  const store = useStore();
  return (
    <section>
      <SectionHeading title="Legal entity &amp; bank" />
      <BankAccountPanel platformFeeBp={store.platformFeeBp} payoutCadenceDays={store.payoutCadenceDays} gstin={store.gstin} />
    </section>
  );
}

/**
 * KYC page — compliance documents (formerly the "Documents" tab) plus the fees
 * view that used to live at `/retailer/fees`, merged here so all the
 * regulator-facing / fee info sits on one page.
 */
export function StoreKycSection() {
  const canSeeFees = usePermission('fees.view');
  const canSeeCompliance = usePermission('compliance.view');
  return (
    <div className="space-y-10">
      <section>
        <SectionHeading title="Compliance documents" />
        <StoreDocumentsPanel />
      </section>
      {canSeeCompliance && (
        <section>
          <SectionHeading title="KYC re-verification" />
          <KycReverificationPanel />
        </section>
      )}
      {canSeeFees && (
        <section>
          <SectionHeading title="Fees affecting your store" />
          <StoreFeesPanel />
        </section>
      )}
    </div>
  );
}

export function StoreStatusSection() {
  const store = useStore();
  const meta = storeStatusMeta(store.status);
  return (
    <section>
      <SectionHeading title="Status" />
      <div className="rounded-lg border border-line bg-bg p-5">
        <Badge tone={meta.tone}>{meta.label}</Badge>
        <p className="mt-3 text-[13px] text-ink-2">
          {store.status === 'onboarding'
            ? 'Your store is active — add inventory and go live.'
            : store.status === 'active'
              ? 'Live to consumers. Pause from the panel below to take a temporary break.'
              : store.status === 'paused'
                ? 'Storefront is paused. Customers cannot place orders. Resume below when ready.'
                : `Storefront is ${store.status}. Contact admin to restore.`}
        </p>
      </div>
      {(store.status === 'active' || store.status === 'paused') && (
        <div className="mt-6">
          <SectionHeading title={store.status === 'paused' ? 'Resume storefront' : 'Pause storefront'} />
          <PausePanel store={store} />
        </div>
      )}
    </section>
  );
}

/* ── Panels ────────────────────────────────────────────────────────────── */

function StoreFeesPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['retailer', 'fees'],
    queryFn: () => api<RetailerFeeView>('/retailer/fees'),
  });

  if (isLoading || !data) return <Skeleton className="h-48" />;

  return (
    <Card>
      <CardContent className="p-6">
        <SectionHeading kicker="Marketplace" title="Set by admin" />
        <MetaList
          cols={1}
          items={[
            { label: 'Platform fee', value: `${(data.platformFeeBp / 100).toFixed(2)}%`, hint: 'Taken off each order before payout' },
            { label: "How often you're paid", value: `Every ${data.payoutCadenceDays} days` },
            { label: 'GST rate', value: `${(data.gstRateBp / 100).toFixed(2)}%`, hint: 'Statutory' },
            { label: 'TCS rate', value: `${(data.tcsRateBp / 100).toFixed(2)}%`, hint: 'Statutory' },
          ]}
        />
      </CardContent>
    </Card>
  );
}

function PausePanel({ store }: { store: StoreWithPause }) {
  const qc = useQueryClient();
  const paused = store.status === 'paused';
  const [reason, setReason] = useState('');
  const [visibility, setVisibility] = useState<StoreVisibilityWhilePaused>(
    store.pauseVisibility ?? 'block_orders_only',
  );

  const togglePause = useMutation({
    mutationFn: (next: boolean) =>
      next
        ? api('/retailer/store/pause', {
            method: 'POST',
            body: {
              ...(reason.trim() ? { reason: reason.trim() } : {}),
              visibility: visibility === 'block_orders_only' ? 'visible' : 'hidden',
            },
          })
        : api('/retailer/store/resume', { method: 'POST' }),
    onSuccess: (_, next) => {
      void qc.invalidateQueries({ queryKey: ['retailer', 'me'] });
      toast.success(next ? 'Storefront paused' : 'Storefront resumed');
      setReason('');
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to update store status'),
  });

  return (
    <div className="rounded-lg border border-line bg-bg p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[14px] font-semibold text-ink">{paused ? 'Paused' : 'Live'}</div>
          {paused && store.pauseUntil && (
            <div className="text-[12px] text-ink-3">Until {new Date(store.pauseUntil).toLocaleString('en-IN')}</div>
          )}
        </div>
        <Button
          variant={paused ? 'accent' : 'outline'}
          loading={togglePause.isPending}
          onClick={() => togglePause.mutate(!paused)}
        >
          {paused ? 'Resume storefront' : 'Pause storefront'}
        </Button>
      </div>
      <div>
        <div className="kicker mb-2">While paused, this storefront will</div>
        <div className="space-y-2">
          {(['block_orders_only', 'hide_from_catalog'] as const).map((v) => (
            <label key={v} className="flex items-start gap-2.5 rounded-md border border-line bg-bg-2/30 px-3 py-2 cursor-pointer hover:border-line-strong">
              <input
                type="radio"
                name="visibility"
                value={v}
                checked={visibility === v}
                onChange={() => setVisibility(v)}
                className="mt-0.5 accent-accent"
              />
              <div>
                <div className="text-[13px] text-ink font-medium">
                  {v === 'block_orders_only' ? 'Block new orders only' : 'Hide from catalog'}
                </div>
                <div className="text-[11.5px] text-ink-3">
                  {v === 'block_orders_only'
                    ? 'Listings stay visible; checkout is disabled with a "back soon" notice.'
                    : 'Listings are hidden from search and category browsing while paused.'}
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>
      {!paused && (
        <div>
          <Label htmlFor="pause-reason">Optional internal reason</Label>
          <Input id="pause-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. weekend stock-take" />
        </div>
      )}
    </div>
  );
}

type DaySlot = { from: string; to: string; closed: boolean };
type HoursMap = Record<string, DaySlot>;
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const DEFAULT_SLOT: DaySlot = { from: '09:00', to: '18:00', closed: false };

function StoreHoursPanel() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['retailer', 'store', 'hours'],
    queryFn: () => api<HoursMap>('/retailer/store/hours'),
  });
  const [draft, setDraft] = useState<HoursMap | null>(null);
  const hours: HoursMap = draft ?? data ?? {};

  const save = useMutation({
    mutationFn: (body: HoursMap) =>
      api('/retailer/store/hours', { method: 'PUT', body }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['retailer', 'store', 'hours'] });
      setDraft(null);
      toast.success('Hours saved');
    },
    onError: () => toast.error('Failed to save hours'),
  });

  if (isLoading) return <Skeleton className="h-40" />;

  function patch(day: string, update: Partial<DaySlot>) {
    const current = hours[day] ?? DEFAULT_SLOT;
    setDraft({ ...hours, [day]: { ...current, ...update } });
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border border-line bg-bg divide-y divide-line">
        {DAYS.map((d) => {
          const slot = hours[d] ?? DEFAULT_SLOT;
          return (
            <div key={d} className="flex items-center gap-3 px-4 py-3">
              <label className="flex items-center gap-2 cursor-pointer w-36">
                <input
                  type="checkbox"
                  checked={!slot.closed}
                  onChange={(e) => patch(d, { closed: !e.target.checked })}
                  className="accent-accent"
                />
                <span className="text-[13px] capitalize text-ink">{d}</span>
              </label>
              {slot.closed ? (
                <span className="text-[13px] text-ink-3 italic">Closed</span>
              ) : (
                <div className="flex items-center gap-2">
                  <Input
                    type="time"
                    value={slot.from}
                    onChange={(e) => patch(d, { from: e.target.value })}
                    className="w-28 font-mono text-[13px]"
                  />
                  <span className="text-ink-3 text-[13px]">to</span>
                  <Input
                    type="time"
                    value={slot.to}
                    onChange={(e) => patch(d, { to: e.target.value })}
                    className="w-28 font-mono text-[13px]"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <Button
        onClick={() => save.mutate(hours)}
        loading={save.isPending}
        disabled={!draft}
      >
        Save hours
      </Button>
    </div>
  );
}

function BankAccountPanel({ platformFeeBp, payoutCadenceDays, gstin }: { platformFeeBp: number; payoutCadenceDays: number; gstin: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['retailer', 'store', 'bank'],
    queryFn: () => api<{ accountHolderName: string; accountNumber: string; ifsc: string; bankName: string | null; pennyDropStatus: string; pennyDropAt: string | null } | null>('/retailer/store/bank'),
  });
  if (isLoading) return <Skeleton className="h-20" />;
  if (!data) return (
    <MetaList
      cols={2}
      items={[
        { label: 'GSTIN', value: gstin, mono: true },
        { label: 'Platform fee', value: platformFeeBp > 0 ? `${(platformFeeBp / 100).toFixed(2)}%` : 'Set on approval' },
        { label: 'Payout cadence', value: payoutCadenceDays > 0 ? `Every ${payoutCadenceDays} days` : 'Set on approval' },
        { label: 'Bank account', value: 'Not on file' },
      ]}
    />
  );
  return (
    <MetaList
      cols={2}
      items={[
        { label: 'GSTIN', value: gstin, mono: true },
        { label: 'Platform fee', value: platformFeeBp > 0 ? `${(platformFeeBp / 100).toFixed(2)}%` : 'Set on approval' },
        { label: 'Payout cadence', value: payoutCadenceDays > 0 ? `Every ${payoutCadenceDays} days` : 'Set on approval' },
        { label: 'Account holder', value: data.accountHolderName },
        { label: 'Account number', value: data.accountNumber, mono: true },
        { label: 'IFSC', value: data.ifsc, mono: true },
        ...(data.bankName ? [{ label: 'Bank', value: data.bankName }] : []),
        { label: 'Penny drop', value: data.pennyDropStatus.replace(/_/g, ' '), hint: data.pennyDropAt ? `Verified ${new Date(data.pennyDropAt).toLocaleDateString()}` : '' },
      ]}
    />
  );
}

type KycDoc = { id: string; kind: string; label: string; status: string; uploadedAt: string | null; fileUrl: string | null };

function StoreDocumentsPanel() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['retailer', 'store', 'documents'],
    queryFn: () => api<KycDoc[]>('/retailer/store/documents'),
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeDocRef = useRef<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [preview, setPreview] = useState<KycDoc | null>(null);
  // Doc whose file is being preloaded before the modal opens. While set, every
  // View button is disabled (the active one shows a spinner) so we don't kick
  // off a second load mid-flight or pop a modal that then reflows on image load.
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);

  const docs = data ?? [];

  function openPreview(d: KycDoc) {
    if (!d.fileUrl) return;
    const clean = d.fileUrl.split('?')[0]?.toLowerCase() ?? '';
    const isImage = /\.(png|jpe?g|gif|webp|avif|svg)$/.test(clean);
    // Non-images (PDF / other) render in an iframe that paints progressively —
    // no layout shift to guard against, so open immediately.
    if (!isImage) {
      setPreview(d);
      return;
    }
    setPreviewLoadingId(d.id);
    const img = new Image();
    const done = () => {
      setPreviewLoadingId(null);
      setPreview(d);
    };
    img.onload = done;
    img.onerror = done; // open anyway; the modal shows a broken-image / fallback
    img.src = d.fileUrl;
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const docId = activeDocRef.current;
    if (!file || !docId) return;
    setUploading(docId);
    try {
      const { url } = await uploadMedia(file, { folder: 'kyc' });
      await api(`/retailer/store/documents/${docId}/upload`, {
        method: 'POST',
        body: { url },
      });
      void qc.invalidateQueries({ queryKey: ['retailer', 'store', 'documents'] });
      toast.success('Document uploaded');
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(null);
      activeDocRef.current = null;
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  if (docs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-rule py-10 text-center text-[13px] text-ink-3">
        No compliance documents required at this time.
      </div>
    );
  }

  return (
    <>
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
      <ul className="space-y-2">
        {docs.map((d) => (
          <li key={d.id} className="flex items-center justify-between rounded-lg border border-line bg-bg px-4 py-3">
            <div>
              <div className="text-[13.5px] font-medium text-ink">{d.label}</div>
              <div className="text-[11.5px] text-ink-3">
                {d.uploadedAt ? `Uploaded ${new Date(d.uploadedAt).toLocaleDateString()}` : 'Not uploaded'}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={d.status === 'verified' ? 'success' : d.status === 'pending_review' ? 'warning' : d.status === 'rejected' ? 'danger' : 'neutral'}>
                {d.status.replace(/_/g, ' ')}
              </Badge>
              {d.fileUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  loading={previewLoadingId === d.id}
                  disabled={previewLoadingId !== null && previewLoadingId !== d.id}
                  onClick={() => openPreview(d)}
                >
                  View
                </Button>
              )}
              {(d.status === 'rejected' || d.status === 'missing') && (
                <Button
                  variant="outline"
                  size="sm"
                  loading={uploading === d.id}
                  onClick={() => {
                    activeDocRef.current = d.id;
                    fileInputRef.current?.click();
                  }}
                >
                  Re-upload
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <Dialog open={preview !== null} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{preview?.label}</DialogTitle>
          </DialogHeader>
          {preview?.fileUrl && <DocPreview url={preview.fileUrl} label={preview.label} />}
          <DialogFooter>
            {preview?.fileUrl && (
              <Button asChild variant="outline">
                <a href={preview.fileUrl} target="_blank" rel="noreferrer">Open in new tab</a>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** In-modal document preview: images inline, PDFs in an iframe, anything else
 *  falls back to the "Open in new tab" action in the footer. */
function DocPreview({ url, label }: { url: string; label: string }) {
  const clean = url.split('?')[0]?.toLowerCase() ?? '';
  const isImage = /\.(png|jpe?g|gif|webp|avif|svg)$/.test(clean);
  const isPdf = clean.endsWith('.pdf');

  if (isImage) {
    return (
      <div className="flex max-h-[70vh] justify-center overflow-auto rounded-md border border-line bg-bg-2/40 p-2">
        <img src={url} alt={label} className="max-h-[66vh] w-auto object-contain" />
      </div>
    );
  }
  if (isPdf) {
    return (
      <iframe
        src={url}
        title={label}
        className="h-[70vh] w-full rounded-md border border-line bg-bg-2/40"
      />
    );
  }
  return (
    <div className="rounded-md border border-dashed border-rule py-10 text-center text-[13px] text-ink-3">
      Preview not available for this file type. Use “Open in new tab”.
    </div>
  );
}

/**
 * GST scheme selector. Drives how counter (POS) bills are issued:
 *  - regular     → Tax Invoice, GST charged (CGST+SGST), HSN-coded lines.
 *  - composition → Bill of Supply, no GST charged, "composition taxable person" declaration.
 * The choice also flips tax computation server-side, so changing it re-prices future sales.
 */
function TaxSchemePanel({ store }: { store: StoreWithPause }) {
  const qc = useQueryClient();
  const [scheme, setScheme] = useState<'regular' | 'composition'>(store.gstScheme);

  const save = useMutation({
    mutationFn: (next: 'regular' | 'composition') =>
      api('/retailer/store/profile', { method: 'PATCH', body: { gstScheme: next } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['retailer', 'me'] });
      toast.success('GST scheme updated');
    },
    onError: (e) => {
      setScheme(store.gstScheme); // revert optimistic selection
      toast.error(e instanceof Error ? e.message : 'Failed to update GST scheme');
    },
  });

  const OPTIONS = [
    {
      value: 'regular' as const,
      title: 'Regular dealer',
      desc: 'Charges GST on every sale. Counter bills are Tax Invoices with CGST + SGST and HSN-coded lines.',
    },
    {
      value: 'composition' as const,
      title: 'Composition dealer',
      desc: 'Cannot charge GST. Counter bills are issued as a Bill of Supply with the composition declaration.',
    },
  ];

  return (
    <div className="rounded-lg border border-line bg-bg p-5 space-y-4">
      <div className="space-y-2">
        {OPTIONS.map((o) => (
          <label
            key={o.value}
            className="flex items-start gap-2.5 rounded-md border border-line bg-bg-2/30 px-3 py-2 cursor-pointer hover:border-line-strong"
          >
            <input
              type="radio"
              name="gst-scheme"
              value={o.value}
              checked={scheme === o.value}
              onChange={() => setScheme(o.value)}
              className="mt-0.5 accent-accent"
            />
            <div>
              <div className="text-[13px] text-ink font-medium">{o.title}</div>
              <div className="text-[11.5px] text-ink-3">{o.desc}</div>
            </div>
          </label>
        ))}
      </div>
      <Button
        onClick={() => save.mutate(scheme)}
        loading={save.isPending}
        disabled={scheme === store.gstScheme}
      >
        Save GST scheme
      </Button>
    </div>
  );
}

function ContactInfoPanel({ store }: { store: StoreWithPause }) {
  const qc = useQueryClient();
  const [contactPhone, setContactPhone] = useState(store.contactPhone ?? '');
  const [managerName, setManagerName] = useState(store.managerName ?? '');

  const save = useMutation({
    mutationFn: () =>
      api('/retailer/store/profile', {
        method: 'PATCH',
        body: {
          contactPhone: contactPhone.trim() || null,
          managerName: managerName.trim() || null,
        },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['retailer', 'me'] });
      toast.success('Contact info saved');
    },
    onError: () => toast.error('Failed to save contact info'),
  });

  const dirty =
    contactPhone.trim() !== (store.contactPhone ?? '') ||
    managerName.trim() !== (store.managerName ?? '');

  return (
    <div className="rounded-lg border border-line bg-bg p-5 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="contact-phone" hint="shown to customers">Contact phone</Label>
          <Input
            id="contact-phone"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            placeholder="9876543210"
          />
        </div>
        <div>
          <Label htmlFor="manager-name" hint="store manager">Manager name</Label>
          <Input
            id="manager-name"
            value={managerName}
            onChange={(e) => setManagerName(e.target.value)}
            placeholder="Ramesh Patel"
          />
        </div>
      </div>
      <Button
        onClick={() => save.mutate()}
        loading={save.isPending}
        disabled={!dirty}
      >
        Save contact info
      </Button>
    </div>
  );
}

function StoreGalleryPanel({ store }: { store: StoreWithPause }) {
  const qc = useQueryClient();
  const [images, setImages] = useState<string[]>(store.galleryImageUrls ?? []);
  const [uploading, setUploading] = useState(false);

  const save = useMutation({
    mutationFn: (urls: string[]) =>
      api('/retailer/store/profile', {
        method: 'PATCH',
        body: { galleryImageUrls: urls },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['retailer', 'me'] });
      toast.success('Gallery saved');
    },
    onError: () => toast.error('Failed to save gallery'),
  });

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await uploadMedia(file, { folder: 'store-gallery' });
      const next = [...images, url];
      setImages(next);
      save.mutate(next);
    } catch {
      toast.error('Image upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  function remove(idx: number) {
    const next = images.filter((_, i) => i !== idx);
    setImages(next);
    save.mutate(next);
  }

  return (
    <div className="space-y-4">
      <p className="text-[13px] text-ink-2">
        Add up to 5 photos of your storefront. These help customers recognize your store.
      </p>
      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((url, i) => (
            <div key={i} className="group relative overflow-hidden rounded-lg border border-line bg-bg-2">
              <img src={url} alt={`Store photo ${i + 1}`} className="h-32 w-full object-cover" />
              <button
                type="button"
                onClick={() => remove(i)}
                className="absolute right-1 top-1 rounded-md bg-surface/80 px-1.5 py-0.5 text-[11px] text-danger opacity-0 transition-opacity group-hover:opacity-100"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
      {images.length < 5 && (
        <label className={`flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-line px-4 py-3 text-[13px] text-ink-3 transition-colors hover:bg-bg-3 ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void handleUpload(e)}
            disabled={uploading}
          />
          {uploading ? 'Uploading…' : images.length === 0 ? 'Upload your first store photo' : 'Add another photo'}
        </label>
      )}
    </div>
  );
}
