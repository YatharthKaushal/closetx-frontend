import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Plus, Search, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import {
  discountTypeLabel,
  formatDiscount,
  formatPaise,
  formatAge,
  mechanismLabel,
  promotionStatusMeta,
} from '@/lib/status';
import type { DiscountType, Mechanism, Promotion, PromotionAnomaly, PromotionPerformance, PromotionStatus, TargetedDrop } from '@/lib/types';
import { StoreCombobox } from '@/components/ui/store-combobox';
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
  { value: 'exhausted', label: 'Exhausted' },
  { value: 'revoked', label: 'Revoked' },
];

const DISCOUNT_TYPE_OPTIONS: ReadonlyArray<{ value: DiscountType | 'all'; label: string }> = [
  { value: 'all', label: 'All discount types' },
  { value: 'flat_amount', label: 'Flat amount' },
  { value: 'percent', label: 'Percent' },
  { value: 'percent_upto', label: 'Percent up to' },
  { value: 'bogo', label: 'BOGO' },
  { value: 'bxgy', label: 'BXGY' },
  { value: 'bundle', label: 'Bundle' },
  { value: 'tiered_cart', label: 'Tiered cart' },
  { value: 'free_shipping', label: 'Free shipping' },
];

export default function AdminPromotions() {
  return (
    <Page>
      <PageHeader
        title={<>Promotions</>}
        description={
          <>
            Offers (auto-applied), coupons (consumer enters code), and vouchers (single-use codes).
            Approved retailers can also issue offers for their own catalogue.
          </>
        }
        actions={
          <Button asChild variant="ink" caps iconLeft={<Plus className="size-3.5" />}>
            <Link to="/admin/promotions/new">New promotion</Link>
          </Button>
        }
      />

      <Tabs defaultValue="offers">
        <TabsList className="overflow-x-auto whitespace-nowrap">
          <TabsTrigger value="all">All promotions</TabsTrigger>
          <TabsTrigger value="drops">Targeted drops</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="anomalies">Anomalies</TabsTrigger>
        </TabsList>

        <TabsContent value="all"><AllPromotionsList /></TabsContent>
        <TabsContent value="drops"><DropsTab /></TabsContent>
        <TabsContent value="performance"><PerformanceTab /></TabsContent>
        <TabsContent value="anomalies"><AnomaliesTab /></TabsContent>
      </Tabs>
    </Page>
  );
}

const MECHANISM_CHIPS: ReadonlyArray<{ value: Mechanism | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'offer', label: 'Offer' },
  { value: 'coupon', label: 'Coupon' },
  { value: 'voucher', label: 'Voucher' },
];

function AllPromotionsList() {
  const [mechanism, setMechanism] = useState<Mechanism | 'all'>('all');
  const [status, setStatus] = useState<PromotionStatus | 'all'>('all');
  const [discountType, setDiscountType] = useState<DiscountType | 'all'>('all');
  const [storeId, setStoreId] = useState<string>('all');
  const [q, setQ] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'promotions', 'all', status, discountType, storeId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (status !== 'all') params.set('status', status);
      if (discountType !== 'all') params.set('discountType', discountType);
      if (storeId === '__platform__') params.set('platformOnly', 'true');
      else if (storeId !== 'all') params.set('storeId', storeId);
      return api<Promotion[]>(`/admin/promotions?${params.toString()}`);
    },
  });

  const filtered = (data ?? [])
    .filter((p) => mechanism === 'all' || p.mechanism === mechanism)
    .filter((p) => (q.trim() ? p.name.toLowerCase().includes(q.toLowerCase()) || p.id.toLowerCase().includes(q.toLowerCase()) : true));

  function clearFilters() {
    setMechanism('all');
    setStatus('all');
    setDiscountType('all');
    setStoreId('all');
    setQ('');
  }
  const hasFilters =
    mechanism !== 'all' || status !== 'all' || discountType !== 'all' || storeId !== 'all' || q.trim().length > 0;

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
              className={cn(
                'rounded-full border px-3 py-1 text-[12px] transition-colors',
                active
                  ? 'border-ink bg-ink text-bg'
                  : 'border-line bg-bg text-ink-3 hover:text-ink hover:bg-bg-2',
              )}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-1 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <Input placeholder="Search by name or ID…" value={q} onChange={(e) => setQ(e.target.value)} className="!pl-7" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={status} onValueChange={(v) => setStatus(v as PromotionStatus | 'all')}>
            <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={discountType} onValueChange={(v) => setDiscountType(v as DiscountType | 'all')}>
            <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DISCOUNT_TYPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="sm:w-56">
            <StoreCombobox
              value={storeId}
              onChange={setStoreId}
              placeholder="All retailers"
              extraOptions={[
                { value: 'all', label: 'All retailers' },
                { value: '__platform__', label: 'Platform-wide only' },
              ]}
            />
          </div>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-px border-y border-rule" data-stagger>
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : isError ? (
        <Empty kicker="Connection lost" title="Couldn't load promotions" action={<Button variant="outline" onClick={() => refetch()}>Retry</Button>} />
      ) : filtered.length === 0 ? (
        <Empty kicker="None" title="No promotions match this filter." />
      ) : (
        <ol className="border-y border-rule divide-y divide-rule" data-stagger>
          {filtered.map((p, i) => <PromotionRow key={p.id} promo={p} ord={i + 1} />)}
        </ol>
      )}
    </>
  );
}

function DropsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'promotions', 'drops'],
    queryFn: () => api<TargetedDrop[]>('/admin/promotions/targeted-drops'),
  });
  const list = data ?? [];
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[12.5px] text-ink-3">{list.length} drop{list.length === 1 ? '' : 's'}</span>
        <Button asChild iconLeft={<Plus className="size-3.5" />}>
          <Link to="/admin/targeted-drops">New drop</Link>
        </Button>
      </div>
      {isLoading ? <Skeleton className="h-32" /> : list.length === 0 ? (
        <Empty kicker="No drops" title="No targeted drops sent." />
      ) : (
        <ul className="space-y-2">
          {list.map((d) => (
            <Card key={d.id}>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-semibold text-ink">{d.name}</div>
                    <div className="mt-1 text-[12px] text-ink-3">
                      Promo {d.promotionName} · group {d.cohortKind.replace(/_/g, ' ')} · {d.audienceSize.toLocaleString('en-IN')} people
                    </div>
                    <div className="mt-1 text-[11.5px] text-ink-4">Pushed {formatAge(d.pushedAt)} · {d.redemptionCount} redemptions</div>
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

type ComparisonRow = {
  key: string;
  promoCount: number;
  redemptions: number;
  totalDiscountPaise: number;
  gmvInfluencedPaise: number;
  uniqueConsumers: number;
};

function PerformanceTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'promotions', 'performance'],
    queryFn: () => api<PromotionPerformance[]>('/admin/promotions/performance'),
  });
  const byMech = useQuery({
    queryKey: ['admin', 'promotions', 'performance', 'by-mechanism'],
    queryFn: () => api<ComparisonRow[]>('/admin/promotions/performance/by-mechanism'),
  });
  const byType = useQuery({
    queryKey: ['admin', 'promotions', 'performance', 'by-discount-type'],
    queryFn: () => api<ComparisonRow[]>('/admin/promotions/performance/by-discount-type'),
  });
  const list = data ?? [];
  return (
    <div className="space-y-6">
      <ComparisonGrid title="By mechanism" rows={byMech.data ?? []} loading={byMech.isLoading} />
      <ComparisonGrid title="By discount type" rows={byType.data ?? []} loading={byType.isLoading} />
      {isLoading ? <Skeleton className="h-40" /> : list.length === 0 ? (
        <Empty kicker="No data" title="No promotion metrics yet." />
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-[12.5px]">
              <thead className="bg-bg-2/40">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-ink-3">Promotion</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Redemptions</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Sales influenced</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Order size lift</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Refund rate</th>
                  <th className="px-3 py-2 text-center font-medium text-ink-3">Anomaly</th>
                </tr>
              </thead>
              <tbody>
                {list.map((m) => (
                  <tr key={m.promotionId} className="border-t border-line">
                    <td className="px-3 py-2 text-ink">{m.name}</td>
                    <td className="px-3 py-2 text-right font-mono">{m.redemptions.toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatPaise(m.gmvInfluencePaise)}</td>
                    <td className={`px-3 py-2 text-right font-mono ${m.aovLiftBp > 0 ? 'text-success' : m.aovLiftBp < 0 ? 'text-danger' : 'text-ink-3'}`}>
                      {m.aovLiftBp > 0 ? '+' : ''}
                      {(m.aovLiftBp / 100).toFixed(2)}%
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{(m.refundRateBp / 100).toFixed(2)}%</td>
                    <td className="px-3 py-2 text-center">
                      {m.anomalyFlagged ? <Badge tone="danger" pulse><Sparkles className="size-3 mr-1 inline" />Flagged</Badge> : <span className="text-ink-4">—</span>}
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

function ComparisonGrid({ title, rows, loading }: { title: string; rows: ComparisonRow[]; loading: boolean }) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="border-b border-line bg-bg-2/40 px-3 py-2 text-[12.5px] font-medium text-ink-3">{title}</div>
        {loading ? (
          <Skeleton className="h-32" />
        ) : rows.length === 0 ? (
          <Empty kicker="No data" title="No redemptions yet." />
        ) : (
          <table className="w-full text-[12.5px]">
            <thead className="bg-bg-2/20">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-ink-3">{title.toLowerCase().includes('mechanism') ? 'Mechanism' : 'Discount type'}</th>
                <th className="px-3 py-2 text-right font-medium text-ink-3">Promos</th>
                <th className="px-3 py-2 text-right font-medium text-ink-3">Redemptions</th>
                <th className="px-3 py-2 text-right font-medium text-ink-3">Unique consumers</th>
                <th className="px-3 py-2 text-right font-medium text-ink-3">Discount given</th>
                <th className="px-3 py-2 text-right font-medium text-ink-3">Sales influenced</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-t border-line">
                  <td className="px-3 py-2 text-ink">{r.key.replace(/_/g, ' ')}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.promoCount.toLocaleString('en-IN')}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.redemptions.toLocaleString('en-IN')}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.uniqueConsumers.toLocaleString('en-IN')}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatPaise(r.totalDiscountPaise)}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatPaise(r.gmvInfluencedPaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

function AnomaliesTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'promotions', 'anomalies'],
    queryFn: () => api<PromotionAnomaly[]>('/admin/promotions/anomalies'),
  });
  const list = data ?? [];
  return (
    <div className="space-y-3">
      {isLoading ? <Skeleton className="h-32" /> : list.length === 0 ? (
        <Empty kicker="All clear" title="No promotion anomalies." />
      ) : (
        <ul className="space-y-2">
          {list.map((a) => (
            <Card key={a.id} className={a.severity === 'high' ? 'border-danger/40' : a.severity === 'medium' ? 'border-warning/40' : ''}>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[14px] font-semibold text-ink">{a.promotionName}</span>
                      <Badge tone={a.severity === 'high' ? 'danger' : a.severity === 'medium' ? 'warning' : 'neutral'}>{a.severity}</Badge>
                      <Badge tone="neutral" flat>{a.kind.replace(/_/g, ' ')}</Badge>
                      <Badge tone={a.status === 'open' ? 'warning' : a.status === 'acknowledged' ? 'info' : 'success'}>{a.status}</Badge>
                    </div>
                    <div className="mt-1 text-[12px] text-ink-3">
                      {a.metric}: <span className="font-mono">{a.value}</span> (threshold <span className="font-mono">{a.threshold}</span>) · {a.consumersInvolved} consumer{a.consumersInvolved === 1 ? '' : 's'} involved · detected {formatAge(a.detectedAt)}
                    </div>
                  </div>
                  <Button asChild variant="outline" size="sm" iconRight={<ArrowUpRight className="size-3.5" />}>
                    <Link to={`/admin/promotions/anomalies/${a.id}`}>Investigate</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </ul>
      )}
    </div>
  );
}

function PromotionRow({ promo, ord }: { promo: Promotion; ord: number }) {
  const meta = promotionStatusMeta(promo.effectiveStatus);
  const cap =
    promo.totalUses != null
      ? `${promo.redeemedCount.toLocaleString('en-IN')} / ${promo.totalUses.toLocaleString('en-IN')}`
      : `${promo.redeemedCount.toLocaleString('en-IN')} / ∞`;
  return (
    <li>
      <Link
        to={`/admin/promotions/${promo.id}`}
        className="grid grid-cols-12 gap-4 px-2 py-5 hover:bg-surface/40 transition-colors group"
      >
        <div className="col-span-12 lg:col-span-1">
          <span className="font-mono text-[11px] tracking-wider text-ink-3">
            № {String(ord).padStart(3, '0')}
          </span>
        </div>
        <div className="col-span-12 lg:col-span-5 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display italic text-[22px] leading-tight text-ink truncate">
              {promo.name}
            </h3>
            <Badge tone={meta.tone}>{meta.label}</Badge>
            <Badge flat>{mechanismLabel(promo.mechanism)}</Badge>
          </div>
          <p className="mt-1 text-[12px] uppercase tracking-[0.14em] text-ink-3">
            {promo.storeId ? 'Store-scoped' : 'Platform-wide'} · {discountTypeLabel(promo.discountType)}
          </p>
        </div>
        <div className="col-span-6 lg:col-span-3">
          <div className="kicker text-ink-3">Discount</div>
          <div className="font-mono text-[14px] text-ink mt-0.5">
            {formatDiscount(promo.discountType, promo.config)}
          </div>
        </div>
        <div className="col-span-5 lg:col-span-2">
          <div className="kicker text-ink-3">Redeemed</div>
          <div className="font-mono text-[14px] text-ink mt-0.5 tabular-nums">{cap}</div>
        </div>
        <div className="col-span-1 lg:col-span-1 flex items-center justify-end">
          <ArrowUpRight className="size-4 text-ink-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink" />
        </div>
      </Link>
    </li>
  );
}
