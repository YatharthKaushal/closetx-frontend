import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, Info, Pause, Play, Plus, Search, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import {
  discountTypeLabel,
  formatDiscount,
  formatPaise,
  mechanismLabel,
  promotionStatusMeta,
} from '@/lib/status';
import type { DiscountType, Mechanism, Promotion, PromotionPerformance, PromotionStatus } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const STATUS_OPTIONS: ReadonlyArray<{ value: PromotionStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'paused', label: 'Paused' },
  { value: 'draft', label: 'Draft' },
  { value: 'expired', label: 'Expired' },
];

export default function RetailerPromotions() {
  return (
    <Page>
      <PageHeader
        title={<>Promotions</>}
        description={
          <>
            Promotions you run on your own catalogue. Offers (auto-apply) are open by default;
            coupons and vouchers are admin-restricted at launch.
          </>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" iconRight={<ArrowUpRight className="size-3.5" />}>
              <Link to="/retailer/pricing">Variant pricing</Link>
            </Button>
            <Button asChild variant="ink" caps iconLeft={<Plus className="size-3.5" />}>
              <Link to="/retailer/promotions/new">New offer</Link>
            </Button>
          </div>
        }
      />

      <div className="mb-6 flex items-start gap-3 border border-rule bg-paper-2/50 px-4 py-3 text-[12.5px] text-ink-2">
        <Info className="size-4 mt-0.5 text-ink-3 shrink-0" />
        <span>
          You can issue <strong className="text-ink">offers</strong> for your own products.{' '}
          <strong className="text-ink">Coupons</strong> and{' '}
          <strong className="text-ink">vouchers</strong> are restricted at launch — contact admin
          to enable them on your store.
        </span>
      </div>

      <ClubbingPolicyCard />

      <Tabs defaultValue="all">
        <TabsList className="overflow-x-auto whitespace-nowrap">
          <TabsTrigger value="all">All promotions</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="platform-impact">Platform impact</TabsTrigger>
        </TabsList>

        <TabsContent value="all"><AllPromotionsList /></TabsContent>
        <TabsContent value="performance"><PerformanceTab /></TabsContent>
        <TabsContent value="platform-impact"><PlatformImpactTab /></TabsContent>
      </Tabs>
    </Page>
  );
}

const MECHANISM_CHIPS: ReadonlyArray<{ value: Mechanism | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'offer', label: 'Offers' },
  { value: 'coupon', label: 'Coupons' },
  { value: 'voucher', label: 'Vouchers' },
];

/**
 * Phase 4.1 — single unified promotion list with a Mechanism chip filter
 * replacing the previous 3 mechanism-scoped tabs. Reuses one query for all
 * mechanisms so toggling chips is instant (no refetch).
 */
function AllPromotionsList() {
  const [mechanism, setMechanism] = useState<Mechanism | 'all'>('all');
  const [status, setStatus] = useState<PromotionStatus | 'all'>('all');
  const [q, setQ] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['retailer', 'promotions', status],
    queryFn: () => {
      const params = new URLSearchParams();
      if (status !== 'all') params.set('status', status);
      const qs = params.toString();
      return api<Promotion[]>(`/retailer/promotions${qs ? `?${qs}` : ''}`);
    },
  });

  const filtered = (data ?? [])
    .filter((p) => mechanism === 'all' || p.mechanism === mechanism)
    .filter((p) => (q.trim() ? p.name.toLowerCase().includes(q.toLowerCase()) : true));

  const counts: Record<Mechanism | 'all', number> = {
    all: data?.length ?? 0,
    offer: (data ?? []).filter((p) => p.mechanism === 'offer').length,
    coupon: (data ?? []).filter((p) => p.mechanism === 'coupon').length,
    voucher: (data ?? []).filter((p) => p.mechanism === 'voucher').length,
  };

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {MECHANISM_CHIPS.map((c) => {
          const active = mechanism === c.value;
          return (
            <button
              key={c.value}
              type="button"
              onClick={() => setMechanism(c.value)}
              aria-pressed={active}
              className={cn(
                'rounded-full border px-3 py-1 text-[12px] transition-colors inline-flex items-center gap-1.5',
                active
                  ? 'border-ink bg-ink text-bg'
                  : 'border-line bg-bg text-ink-3 hover:text-ink hover:bg-bg-2',
              )}
            >
              {c.label}
              {counts[c.value] > 0 && (
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-[10.5px] font-mono',
                    active ? 'bg-bg/20 text-bg' : 'bg-bg-3 text-ink-2',
                  )}
                >
                  {counts[c.value]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-1 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <Input placeholder="Search by name…" value={q} onChange={(e) => setQ(e.target.value)} className="!pl-7" />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as PromotionStatus | 'all')}>
          <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Skeleton className="h-32" />
      ) : filtered.length === 0 ? (
        <Empty
          kicker="None"
          title={mechanism === 'all' ? 'No promotions yet.' : `No ${mechanism}s match this filter.`}
          description={
            mechanism === 'all'
              ? 'Create your first offer to drive purchases and reward repeat buyers.'
              : undefined
          }
          action={
            <Button asChild variant="ink" caps iconLeft={<Plus className="size-3.5" />}>
              <Link
                to={`/retailer/promotions/new${mechanism === 'all' ? '' : `?mechanism=${mechanism}`}`}
              >
                {mechanism === 'all' ? 'New offer' : `New ${mechanism}`}
              </Link>
            </Button>
          }
        />
      ) : (
        <ol className="border-y border-rule divide-y divide-rule" data-stagger>
          {filtered.map((p, i) => <PromoRow key={p.id} promo={p} ord={i + 1} />)}
        </ol>
      )}
    </>
  );
}

const ANOMALY_LABEL: Record<PromotionPerformance['anomalyReasons'][number], string> = {
  velocity_spike: 'Sudden surge in redemptions',
  refund_spike: 'High refund rate',
  consumer_concentration: 'Mostly used by one customer',
};

function PerformanceTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['retailer', 'promotions', 'performance'],
    queryFn: () =>
      api<PromotionPerformance[]>('/retailer/promotions/performance'),
  });
  const list = data ?? [];
  return (
    <div className="space-y-3">
      {isLoading ? (
        <Skeleton className="h-40" />
      ) : list.length === 0 ? (
        <Empty kicker="No data" title="No promotion metrics yet." />
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-[12.5px]">
              <thead className="bg-bg-2/40">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-ink-3">Promotion</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Redemptions</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Unique consumers</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Discount given</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Sales influenced</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Refund rate</th>
                  <th className="px-3 py-2 text-center font-medium text-ink-3">Anomaly</th>
                </tr>
              </thead>
              <tbody>
                {list.map((m) => (
                  <tr key={m.promotionId} className="border-t border-line">
                    <td className="px-3 py-2 text-ink">{m.name}</td>
                    <td className="px-3 py-2 text-right font-mono">{m.redemptions.toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2 text-right font-mono">{m.uniqueConsumers.toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatPaise(m.totalDiscountPaise)}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatPaise(m.gmvInfluencedPaise)}</td>
                    <td className="px-3 py-2 text-right font-mono">{(m.refundRateBp / 100).toFixed(2)}%</td>
                    <td className="px-3 py-2 text-center">
                      {m.anomalyFlagged ? (
                        <Badge
                          tone="danger"
                          pulse
                          title={m.anomalyReasons.map((r) => ANOMALY_LABEL[r]).join(' · ')}
                        >
                          <Sparkles className="size-3 mr-1 inline" />
                          {m.anomalyReasons.map((r) => ANOMALY_LABEL[r]).join(' · ')}
                        </Badge>
                      ) : (
                        <span className="text-ink-4">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

type PlatformPromoImpactRow = {
  promotionId: string;
  promotionName: string;
  mechanism: 'offer' | 'coupon' | 'voucher' | null;
  discountType: string | null;
  orderCount: number;
  totalDiscountPaise: number;
  gmvInfluencedPaise: number;
  firstRedeemedAt: string;
  lastRedeemedAt: string;
};

function PlatformImpactTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['retailer', 'reports', 'platform-promo-commission'],
    queryFn: () =>
      api<{ rows: PlatformPromoImpactRow[]; meta?: { generatedAtIst?: string } }>(
        '/retailer/reports/platform-promo-commission',
      ),
  });
  const list: PlatformPromoImpactRow[] = Array.isArray(data)
    ? (data as PlatformPromoImpactRow[])
    : (data?.rows ?? []);
  const totalDiscount = list.reduce((s, r) => s + r.totalDiscountPaise, 0);
  const totalGmv = list.reduce((s, r) => s + r.gmvInfluencedPaise, 0);
  return (
    <div className="space-y-3">
      <p className="text-[12.5px] text-ink-3">
        Discount absorbed by your store from <strong>admin-issued, platform-wide</strong>
        {' '}promotions. Use this to budget impact and protest individual campaigns to ops.
      </p>
      {isLoading ? (
        <Skeleton className="h-40" />
      ) : list.length === 0 ? (
        <Empty kicker="None" title="No platform-wide promos have hit your orders yet." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <div className="kicker text-ink-3">Active platform promos</div>
                <div className="mt-1 text-[20px] font-semibold text-ink">{list.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="kicker text-ink-3">Discount absorbed</div>
                <div className="mt-1 text-[20px] font-mono text-ink">{formatPaise(totalDiscount)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="kicker text-ink-3">Sales influenced</div>
                <div className="mt-1 text-[20px] font-mono text-ink">{formatPaise(totalGmv)}</div>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-[12.5px]">
                <thead className="bg-bg-2/40">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-ink-3">Promotion</th>
                    <th className="px-3 py-2 text-left font-medium text-ink-3">Mechanism</th>
                    <th className="px-3 py-2 text-right font-medium text-ink-3">Orders impacted</th>
                    <th className="px-3 py-2 text-right font-medium text-ink-3">Discount absorbed</th>
                    <th className="px-3 py-2 text-right font-medium text-ink-3">Sales influenced</th>
                    <th className="px-3 py-2 text-left font-medium text-ink-3">First / last hit</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((r) => (
                    <tr key={r.promotionId} className="border-t border-line">
                      <td className="px-3 py-2 text-ink">{r.promotionName}</td>
                      <td className="px-3 py-2 text-ink-2">
                        {r.mechanism ? mechanismLabel(r.mechanism) : '—'}
                        {r.discountType && (
                          <span className="ml-2 text-[11px] uppercase tracking-wider text-ink-3">
                            {discountTypeLabel(r.discountType as DiscountType)}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{r.orderCount.toLocaleString('en-IN')}</td>
                      <td className="px-3 py-2 text-right font-mono">{formatPaise(r.totalDiscountPaise)}</td>
                      <td className="px-3 py-2 text-right font-mono">{formatPaise(r.gmvInfluencedPaise)}</td>
                      <td className="px-3 py-2 text-[11.5px] text-ink-3">
                        {new Date(r.firstRedeemedAt).toLocaleDateString('en-IN')} → {new Date(r.lastRedeemedAt).toLocaleDateString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

const APPLIED_TO_ORDER = ['retailer_promo', 'platform_promo', 'coupon', 'shipping', 'loyalty'] as const;
type AppliedTo = (typeof APPLIED_TO_ORDER)[number];
type ClubbingCell = {
  appliedToA: AppliedTo;
  appliedToB: AppliedTo;
  defaultValue: 'allowed' | 'disallowed' | 'always_allowed';
  note: string | null;
  seeded: boolean;
};

function ClubbingPolicyCard() {
  const [open, setOpen] = useState(false);
  const { data } = useQuery({
    queryKey: ['retailer', 'clubbing-policy'],
    queryFn: () => api<ClubbingCell[]>('/retailer/promotions/clubbing-policy'),
    enabled: open,
    staleTime: 5 * 60_000,
  });

  const lookup = new Map<string, ClubbingCell>();
  for (const c of data ?? []) lookup.set(`${c.appliedToA}:${c.appliedToB}`, c);
  const cellFor = (a: AppliedTo, b: AppliedTo) => {
    const ia = APPLIED_TO_ORDER.indexOf(a);
    const ib = APPLIED_TO_ORDER.indexOf(b);
    const [x, y] = ia <= ib ? [a, b] : [b, a];
    return lookup.get(`${x}:${y}`);
  };

  return (
    <Card className="mb-6">
      <CardContent className="p-4">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-2 text-left"
        >
          <div>
            <div className="kicker text-ink-3">Stacking</div>
            <div className="text-[14px] font-semibold text-ink">Platform clubbing policy</div>
          </div>
          <span className="text-[12px] text-ink-3">{open ? 'Hide' : 'Show'}</span>
        </button>
        {open && (
          <>
            <p className="mt-3 text-[12px] text-ink-3">
              Which mechanism pairs the engine stacks by default. Use the per-promotion
              <em> Stackable with </em> / <em> Non-stackable </em> overrides on each promo to deviate.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full border border-line text-[12px]">
                <thead className="bg-bg-2/40">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-medium text-ink-3"> </th>
                    {APPLIED_TO_ORDER.map((a) => (
                      <th key={a} className="px-2 py-1.5 text-center font-medium text-ink-3">
                        {prettyAppliedTo(a)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {APPLIED_TO_ORDER.map((a) => (
                    <tr key={a} className="border-t border-line">
                      <td className="px-2 py-1.5 font-medium text-ink-2">{prettyAppliedTo(a)}</td>
                      {APPLIED_TO_ORDER.map((b) => {
                        const c = cellFor(a, b);
                        const value = c?.defaultValue ?? 'allowed';
                        const tone =
                          value === 'always_allowed'
                            ? 'success'
                            : value === 'disallowed'
                              ? 'danger'
                              : 'neutral';
                        const label =
                          value === 'always_allowed' ? 'always' : value === 'disallowed' ? 'blocked' : 'allowed';
                        return (
                          <td key={`${a}-${b}`} className="px-2 py-1.5 text-center">
                            <Badge tone={tone} title={c?.note ?? ''}>{label}</Badge>
                            {c?.seeded && <div className="mt-0.5 text-[10px] text-ink-4">admin-set</div>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function prettyAppliedTo(v: AppliedTo): string {
  return v.replace('_', ' ');
}

function PromoRow({ promo, ord }: { promo: Promotion; ord: number }) {
  const meta = promotionStatusMeta(promo.effectiveStatus);
  const qc = useQueryClient();

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['retailer', 'promotions'] });

  const pauseMutation = useMutation({
    mutationFn: () => api(`/retailer/promotions/${promo.id}/pause`, { method: 'POST' }),
    onSuccess: () => { invalidate(); toast.success('Promotion paused'); },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed to pause'),
  });

  const resumeMutation = useMutation({
    mutationFn: () => api(`/retailer/promotions/${promo.id}/resume`, { method: 'POST' }),
    onSuccess: () => { invalidate(); toast.success('Promotion resumed'); },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed to resume'),
  });

  const revokeMutation = useMutation({
    mutationFn: () => api(`/retailer/promotions/${promo.id}/revoke`, { method: 'POST' }),
    onSuccess: () => { invalidate(); toast.success('Promotion revoked'); },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed to revoke'),
  });

  const canPause = promo.effectiveStatus === 'active' || promo.effectiveStatus === 'scheduled';
  const canResume = promo.effectiveStatus === 'paused';
  const canRevoke = promo.effectiveStatus !== 'expired' && promo.effectiveStatus !== 'revoked';

  return (
    <li className="group hover:bg-surface/40 transition-colors">
      <div className="grid grid-cols-12 gap-4 px-2 py-5">
        <div className="col-span-12 lg:col-span-1 flex items-center">
          <span className="font-mono text-[11px] tracking-wider text-ink-3">
            № {String(ord).padStart(3, '0')}
          </span>
        </div>
        <div className="col-span-12 lg:col-span-5 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display italic text-[22px] leading-tight text-ink truncate">{promo.name}</h3>
            <Badge tone={meta.tone}>{meta.label}</Badge>
            <Badge flat>{mechanismLabel(promo.mechanism)}</Badge>
          </div>
          <p className="mt-1 text-[12px] uppercase tracking-[0.14em] text-ink-3">
            {discountTypeLabel(promo.discountType)}
          </p>
        </div>
        <div className="col-span-6 lg:col-span-2 flex flex-col justify-center">
          <div className="kicker text-ink-3">Discount</div>
          <div className="font-mono text-[14px] text-ink mt-0.5">
            {formatDiscount(promo.discountType, promo.config)}
          </div>
        </div>
        <div className="col-span-4 lg:col-span-1 flex flex-col justify-center">
          <div className="kicker text-ink-3">Used</div>
          <div className="font-mono text-[14px] text-ink mt-0.5 tabular-nums">
            {promo.redeemedCount}
          </div>
        </div>
        <div className="col-span-12 lg:col-span-3 flex items-center justify-end gap-1.5">
          {canPause && (
            <Button
              variant="ghost"
              size="sm"
              iconLeft={<Pause className="size-3" />}
              loading={pauseMutation.isPending}
              onClick={() => pauseMutation.mutate()}
            >
              Pause
            </Button>
          )}
          {canResume && (
            <Button
              variant="ghost"
              size="sm"
              iconLeft={<Play className="size-3" />}
              loading={resumeMutation.isPending}
              onClick={() => resumeMutation.mutate()}
            >
              Resume
            </Button>
          )}
          {canRevoke && (
            <Button
              variant="ghost"
              size="sm"
              iconLeft={<Trash2 className="size-3" />}
              loading={revokeMutation.isPending}
              onClick={() => {
                if (!window.confirm(`Revoke "${promo.name}"? This cannot be undone.`)) return;
                revokeMutation.mutate();
              }}
            >
              Revoke
            </Button>
          )}
          <Button asChild variant="ghost" size="sm" iconRight={<ArrowUpRight className="size-3" />}>
            <Link to={`/retailer/promotions/${promo.id}`}>Open</Link>
          </Button>
        </div>
      </div>
    </li>
  );
}
