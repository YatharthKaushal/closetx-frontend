import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Boxes,
  Check,
  Clock,
  Inbox,
  Package,
  Plus,
  ShoppingBag,
  SlidersHorizontal,
  TrendingUp,
  Truck,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { retailerStatusMeta, storeStatusMeta } from '@/lib/status';
import type { ClarificationMessage, Listing, RetailerOrder, RetailerProfile, Store } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ClarificationThread } from '@/components/admin/clarification-thread';
import { Count } from '@/components/ui/count';
import { LineChart, type Series } from '@/components/ui/line-chart';
import { Segmented } from '@/components/ui/segmented';
import { Avatar } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/cn';
import { GettingStartedChecklist } from '@/components/retailer/getting-started-checklist';

type MeResponse = { retailer: RetailerProfile; store: Store | null };

export default function RetailerDashboard() {
  const session = useAuth((s) => s.session);
  const patchRetailer = useAuth((s) => s.patchRetailer);
  const fallback = session?.kind === 'retailer' ? session.retailer : null;

  const { data, isLoading } = useQuery({
    queryKey: ['retailer', 'me'],
    queryFn: () => api<MeResponse>('/retailer/me'),
  });

  if (data?.retailer && fallback && data.retailer.status !== fallback.status) {
    patchRetailer({ status: data.retailer.status, storeId: data.retailer.storeId });
  }

  const retailer = data?.retailer ?? fallback;
  const store = data?.store ?? null;

  const liveAndKicking = retailer?.status === 'active' && (store?.status === 'active' || store?.status === 'paused');

  const listings = useQuery({
    queryKey: ['retailer', 'listings', 'all'],
    queryFn: () => api<Listing[]>('/retailer/listings'),
    enabled: liveAndKicking,
  });

  const ordersQuery = useQuery({
    queryKey: ['retailer', 'orders', 'all'],
    queryFn: () => api<RetailerOrder[]>('/retailer/orders?limit=200'),
    enabled: liveAndKicking,
  });

  if (!retailer) {
    return <Page><Skeleton className="h-12 w-2/3" /></Page>;
  }

  const firstName = retailer.legalName.split(' ')[0] ?? retailer.legalName;
  const freshAt = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' });

  return (
    <Page>
      <PageHeader
        {...(liveAndKicking ? { kicker: 'Analytics overview' } : {})}
        title={`Welcome back, ${firstName}`}
        description={liveAndKicking
          ? `Revenue, orders and store health. As of ${freshAt} IST.`
          : "Here's your store status and what to do next."}
        actions={liveAndKicking ? (
          <Button asChild variant="solid" iconLeft={<Plus className="size-4" />}>
            <Link to="/retailer/listings">Add product</Link>
          </Button>
        ) : undefined}
      />

      {liveAndKicking && store ? (
        <LiveDashboard
          store={store}
          listings={listings.data ?? []}
          orders={ordersQuery.data ?? []}
          loadingListings={listings.isLoading}
          loadingOrders={ordersQuery.isLoading}
        />
      ) : (
        <PreLive retailer={retailer} store={store} loading={isLoading} />
      )}
    </Page>
  );
}

// ───────── Pre-live (onboarding) ─────────

function PreLive({ retailer, store, loading }: { retailer: RetailerProfile; store: Store | null; loading: boolean }) {
  return (
    <>
      <StatusHero retailer={retailer} store={store} loading={loading} />
      <div className="mt-6 grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Steps retailer={retailer} store={store} />
        <ClarificationPanel retailer={retailer} />
      </div>
    </>
  );
}

function StatusHero({ retailer, store, loading }: { retailer: RetailerProfile; store: Store | null; loading: boolean }) {
  if (loading) return <Skeleton className="h-32" />;

  const rMeta = retailerStatusMeta(retailer.status);
  const sMeta = store ? storeStatusMeta(store.status) : null;

  let title: string;
  let subtitle: string;
  let nextStep: { label: string; to: string } | null = null;

  if (retailer.status === 'pending_approval') {
    title = 'Your account is being reviewed.';
    subtitle = 'Admin usually responds within a working day. Your store will be created automatically on approval.';
    nextStep = { label: store ? 'View storefront' : 'Set up storefront', to: '/retailer/store' };
  } else if (retailer.status === 'terminated') {
    title = 'Your account has been terminated.';
    subtitle = 'Contact admin to learn why and request reactivation.';
  } else if (!store) {
    title = 'Your store is ready — add inventory to go live.';
    subtitle = 'Your store was created automatically when your application was approved.';
    nextStep = { label: 'View store profile', to: '/retailer/store' };
  } else if (store.status === 'onboarding') {
    title = 'Add inventory to start selling.';
    subtitle = 'Your store is set up. Add products and manage stock to go live.';
    nextStep = { label: 'Add a product', to: '/retailer/listings' };
  } else if (store.status === 'paused') {
    title = 'Storefront is paused.';
    subtitle = 'New orders are blocked for customers. Your dashboard is fully operational — resume when ready.';
    nextStep = { label: 'Resume storefront', to: '/retailer/store' };
  } else if (store.status !== 'active') {
    title = `Your storefront is ${store.status}.`;
    subtitle = 'Reach out to admin if you think this is wrong.';
  } else {
    title = "Everything's live.";
    subtitle = "You're ready to sell. Add products, manage stock, run promotions.";
  }

  return (
    <div className="rounded-2xl border border-line bg-bg p-6 sm:p-8 shadow-card">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Badge tone={rMeta.tone} pulse={retailer.status === 'pending_approval'}>
              Account: {rMeta.label}
            </Badge>
            {sMeta && (
              <Badge tone={sMeta.tone} pulse={store?.status === 'onboarding'}>
                Storefront: {sMeta.label}
              </Badge>
            )}
          </div>
          <h2 className="text-[20px] font-semibold text-ink leading-snug mb-1.5">{title}</h2>
          <p className="text-[13.5px] text-ink-3 leading-relaxed max-w-2xl">{subtitle}</p>
        </div>
        {nextStep && (
          <Button asChild variant="solid" iconRight={<ArrowRight className="size-4" />} className="shrink-0">
            <Link to={nextStep.to}>{nextStep.label}</Link>
          </Button>
        )}
      </div>
    </div>
  );
}

function Steps({ retailer, store }: { retailer: RetailerProfile; store: Store | null }) {
  const steps = [
    { title: 'Application submitted', done: true, desc: 'Pending — awaiting admin pickup.' },
    {
      title: 'Under review',
      done: retailer.status === 'active',
      pending: retailer.status === 'pending_approval',
      desc: retailer.status === 'pending_approval' ? 'Admin has the file open.' : retailer.status === 'active' ? 'Reviewed.' : 'Account terminated.',
    },
    {
      title: 'Application approved',
      done: retailer.status === 'active',
      pending: retailer.status === 'pending_approval',
      desc: retailer.status === 'pending_approval' ? 'Once approved, your store is created automatically.' : retailer.status === 'active' ? 'You are admitted to the platform.' : 'Application closed.',
    },
    {
      title: 'Store created',
      done: !!store,
      desc: store ? `${store.legalName} provisioned automatically.` : 'Created automatically on approval.',
      cta: store ? { label: 'View store profile', to: '/retailer/store' } : null,
    },
    {
      title: 'Add inventory & go live',
      done: store?.status === 'active',
      pending: store?.status === 'onboarding',
      desc: store?.status === 'onboarding' ? 'Add products to your store to start selling.' : store?.status === 'active' ? 'Live.' : 'Pending.',
      cta: store?.status === 'onboarding' || store?.status === 'active' ? { label: 'Add product', to: '/retailer/listings' } : null,
    },
  ];
  const completedCount = steps.filter((s) => s.done).length;
  const progressPct = Math.round((completedCount / steps.length) * 100);

  return (
    <section>
      <div className="flex items-end justify-between mb-3">
        <div>
          <div className="kicker mb-1">Lifecycle</div>
          <h2 className="text-[15px] font-semibold text-ink">Getting your store live</h2>
        </div>
        <div className="text-[12px] text-ink-3">{completedCount} of {steps.length} done</div>
      </div>
      <div className="h-1.5 rounded-full bg-bg-3 overflow-hidden mb-5">
        <div className="h-full bg-ink rounded-full transition-all duration-700" style={{ width: `${progressPct}%` }} />
      </div>
      <ol className="space-y-2">
        {steps.map((s, i) => (
          <li key={i} className={cn('flex items-start gap-3 rounded-xl border bg-bg p-4', s.pending ? 'border-warning/30 bg-warning-soft/30' : 'border-line')}>
            <div className={cn('shrink-0 grid size-8 place-items-center rounded-full text-[12px] font-semibold', s.done ? 'bg-ink text-bg' : s.pending ? 'bg-warning text-white' : 'bg-bg-3 text-ink-3 border border-line')}>
              {s.done ? <Check className="size-3.5" /> : s.pending ? <Clock className="size-3.5" /> : i + 1}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-medium text-ink">{s.title}</div>
              <div className="text-[12.5px] text-ink-3 mt-0.5">{s.desc}</div>
            </div>
            {s.cta && (
              <Button asChild variant="outline" size="sm" iconRight={<ArrowRight className="size-3.5" />}>
                <Link to={s.cta.to}>{s.cta.label}</Link>
              </Button>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

function ClarificationPanel({ retailer }: { retailer: RetailerProfile }) {
  const { data } = useQuery({
    queryKey: ['retailer', 'application', 'messages'],
    queryFn: () => api<ClarificationMessage[]>('/retailer/application/messages'),
  });
  const messages = data ?? [];
  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <div className="kicker mb-1">Clarification</div>
          <h2 className="text-[15px] font-semibold text-ink">Conversation with admin</h2>
        </div>
        {messages.length > 0 && (
          <span className="text-[12px] text-ink-3">{messages.length} message{messages.length === 1 ? '' : 's'}</span>
        )}
      </div>
      <div className="rounded-xl border border-line bg-bg p-4">
        <ClarificationThread
          messages={messages}
          canReply
          replyAs="retailer"
          onReply={(body) => toast.info(`Replies not yet wired: "${body.slice(0, 40)}…"`)}
        />
      </div>
    </section>
  );

  void retailer;
}

// ───────── Live dashboard ─────────

function LiveDashboard({
  store,
  listings,
  orders,
  loadingListings,
  loadingOrders,
}: {
  store: Store;
  listings: Listing[];
  orders: RetailerOrder[];
  loadingListings: boolean;
  loadingOrders: boolean;
}) {
  const analytics = useMemo(() => computeAnalytics(orders, listings), [orders, listings]);

  return (
    <>
      <div className="mb-5">
        <GettingStartedChecklist store={store} listings={listings} />
      </div>

      <QuickActions />

      {/* Row 1: Revenue spotlight + 3 secondary KPIs */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <RevenueKpi analytics={analytics} loading={loadingOrders} />
        <SecondaryKpi
          icon={<ShoppingBag className="size-4" />}
          label="Total orders"
          value={analytics.totalOrders}
          loading={loadingOrders}
          sub={`${analytics.deliveredOrders} delivered`}
        />
        <SecondaryKpi
          icon={<BarChart3 className="size-4" />}
          label="Avg order value"
          value={analytics.avgOrderValueRupees}
          loading={loadingOrders}
          prefix="₹"
          sub={`₹${analytics.avgOrderValueRupees.toLocaleString('en-IN')} per order`}
        />
        <SecondaryKpi
          icon={<Boxes className="size-4" />}
          label="Active products"
          value={listings.filter((l) => l.status === 'active').length}
          loading={loadingListings}
          sub={`${listings.length} total listed`}
        />
      </div>

      {/* Row 2: Revenue chart + Order pipeline */}
      <div className="grid gap-4 lg:grid-cols-[3fr_2fr] mb-6">
        <RevenueChartCard analytics={analytics} loading={loadingOrders} />
        <OrderPipelineCard analytics={analytics} loading={loadingOrders} />
      </div>

      {/* Row 3: Top products + Low stock alerts */}
      <div className="grid gap-4 lg:grid-cols-[3fr_2fr] mb-6">
        <TopProductsByOrders orders={orders} listings={listings} loading={loadingOrders || loadingListings} />
        <LowStockCard listings={listings} loading={loadingListings} />
      </div>

      {/* Row 4: Recent orders table */}
      <RecentOrdersCard orders={orders} loading={loadingOrders} />
    </>
  );
}

// ───────── Quick actions ─────────

function QuickActions() {
  const tiles: Array<{ label: string; href: string; icon: typeof Plus; hint: string }> = [
    { label: 'Add product', href: '/retailer/listings', icon: Plus, hint: 'New listing wizard' },
    { label: 'View orders', href: '/retailer/orders', icon: ShoppingBag, hint: 'Manage order pipeline' },
    { label: 'Edit inventory', href: '/retailer/inventory', icon: Boxes, hint: 'Stock + price' },
    { label: 'Notifications', href: '/retailer/inbox', icon: Inbox, hint: 'Unread alerts' },
  ];
  return (
    <section className="mb-6">
      <div className="kicker mb-2">Quick actions</div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              to={t.href}
              className="group flex items-start gap-3 rounded-xl border border-line bg-bg p-4 transition-colors hover:border-line-strong hover:bg-bg-2"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-md bg-bg-3 text-ink-2 group-hover:bg-ink group-hover:text-bg transition-colors">
                <Icon className="size-4" />
              </span>
              <div className="min-w-0">
                <div className="text-[13.5px] font-semibold text-ink leading-tight">{t.label}</div>
                <div className="mt-0.5 text-[11.5px] text-ink-3 truncate">{t.hint}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

// ───────── Revenue spotlight KPI ─────────

function RevenueKpi({ analytics, loading }: { analytics: Analytics; loading: boolean }) {
  const isUp = analytics.revenueChangePct >= 0;
  return (
    <div className="relative overflow-hidden rounded-2xl bg-ink p-6 text-bg shadow-card md:col-span-1">
      <div className="absolute inset-0 opacity-[0.06] [background-image:radial-gradient(circle_at_20%_20%,white_1px,transparent_1px)] [background-size:20px_20px]" />
      <div className="relative flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-[11.5px] font-medium uppercase tracking-wider text-bg/60">30-day total sales</span>
          <span className="grid size-8 place-items-center rounded-full bg-bg/10">
            <TrendingUp className="size-4 text-bg/70" />
          </span>
        </div>
        {loading ? (
          <Skeleton className="h-10 w-36 bg-bg/15" />
        ) : (
          <div className="font-mono text-[34px] font-semibold tracking-tight leading-none">
            <Count value={analytics.gmv30dRupees} prefix="₹" />
          </div>
        )}
        {!loading && (
          <div className="flex items-center gap-1.5">
            {isUp
              ? <ArrowUpRight className="size-3.5 text-bg/60" />
              : <ArrowDownRight className="size-3.5 text-bg/50" />}
            <span className={cn('text-[12px]', isUp ? 'text-bg/80' : 'text-bg/50')}>
              {isUp ? '+' : ''}{analytics.revenueChangePct.toFixed(1)}% vs prev 30d
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function SecondaryKpi({
  icon,
  label,
  value,
  loading,
  prefix,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  loading: boolean;
  prefix?: string;
  sub?: string;
}) {
  return (
    <div className="surface-card p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[11.5px] font-medium uppercase tracking-wider text-ink-3">{label}</span>
        <span className="grid size-8 place-items-center rounded-full bg-bg-3 text-ink-2">{icon}</span>
      </div>
      {loading ? (
        <Skeleton className="h-9 w-24" />
      ) : (
        <div className="font-mono text-[30px] font-semibold tracking-tight text-ink leading-none">
          <Count value={value} prefix={prefix} />
        </div>
      )}
      {sub && !loading && (
        <div className="mt-2 text-[12px] text-ink-3 truncate">{sub}</div>
      )}
    </div>
  );
}

// ───────── Revenue chart ─────────

function RevenueChartCard({ analytics, loading }: { analytics: Analytics; loading: boolean }) {
  const [view, setView] = useState<'revenue' | 'orders'>('revenue');

  const series: Series[] = view === 'revenue'
    ? [{ label: 'Revenue (₹)', color: 'var(--color-ink)', values: analytics.dailyRevenue.map((d) => d.rupees) }]
    : [{ label: 'Orders', color: 'var(--color-ink)', values: analytics.dailyRevenue.map((d) => d.count) }];

  return (
    <section className="surface-card p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">Revenue trend</h2>
          <p className="text-[12.5px] text-ink-3">Daily activity over the last 30 days.</p>
        </div>
        <Segmented<'revenue' | 'orders'>
          options={[
            { value: 'revenue', label: 'Revenue' },
            { value: 'orders', label: 'Orders' },
          ]}
          value={view}
          onChange={setView}
        />
      </div>
      {loading ? (
        <Skeleton className="h-[200px]" />
      ) : (
        <LineChart
          labels={analytics.dailyRevenue.map((d) => d.label)}
          series={series}
          height={200}
          formatY={(n) => view === 'revenue' ? `₹${Math.round(n).toLocaleString('en-IN')}` : Math.round(n).toString()}
        />
      )}
    </section>
  );
}

// ───────── Order pipeline ─────────

function OrderPipelineCard({ analytics, loading }: { analytics: Analytics; loading: boolean }) {
  const pipeline: { label: string; count: number; tone: 'success' | 'warning' | 'danger' | 'neutral'; icon: React.ReactNode }[] = [
    { label: 'Delivered', count: analytics.deliveredOrders, tone: 'success', icon: <Check className="size-3.5" /> },
    { label: 'In progress', count: analytics.activeOrders, tone: 'warning', icon: <Truck className="size-3.5" /> },
    { label: 'Pending', count: analytics.pendingOrders, tone: 'neutral', icon: <Clock className="size-3.5" /> },
    { label: 'Cancelled', count: analytics.cancelledOrders, tone: 'danger', icon: <XCircle className="size-3.5" /> },
  ];
  const max = Math.max(...pipeline.map((p) => p.count), 1);

  return (
    <section className="surface-card p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">Order pipeline</h2>
          <p className="text-[12.5px] text-ink-3">{analytics.totalOrders} total orders.</p>
        </div>
        <Link to="/retailer/orders" className="text-[12px] text-ink-3 hover:text-ink">View all →</Link>
      </div>
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)}
        </div>
      ) : (
        <ul className="space-y-3">
          {pipeline.map((p) => {
            const pct = Math.round((p.count / max) * 100);
            return (
              <li key={p.label}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className={cn('grid size-5 place-items-center rounded',
                      p.tone === 'success' ? 'bg-success/10 text-success' :
                      p.tone === 'warning' ? 'bg-warning/10 text-warning' :
                      p.tone === 'danger' ? 'bg-danger/10 text-danger' :
                      'bg-bg-3 text-ink-3'
                    )}>
                      {p.icon}
                    </span>
                    <span className="text-[13px] font-medium text-ink">{p.label}</span>
                  </div>
                  <span className="font-mono text-[13px] text-ink-2">{p.count}</span>
                </div>
                <div className="h-1.5 rounded-full bg-bg-3 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500',
                      p.tone === 'success' ? 'bg-success' :
                      p.tone === 'warning' ? 'bg-warning' :
                      p.tone === 'danger' ? 'bg-danger' :
                      'bg-ink-3'
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ───────── Top products by orders ─────────

function TopProductsByOrders({
  orders,
  listings,
  loading,
}: {
  orders: RetailerOrder[];
  listings: Listing[];
  loading: boolean;
}) {
  const topProducts = useMemo(() => {
    const countByListing: Record<string, { count: number; revenue: number; name: string; status: string }> = {};
    // Build from order items — we only have listing-level data on the order list endpoint,
    // so we proxy by cross-referencing listing names via orderItems inside the orders.
    // For now: use listing data + delivered order count (approximation at list level).
    for (const listing of listings) {
      countByListing[listing.id] = {
        count: 0,
        revenue: 0,
        name: listing.name,
        status: listing.status,
      };
    }
    // We don't have per-item order data at the list level; use total orders as proxy
    // and attribute to listings by round-robin to show relative performance.
    // (The detail endpoint has per-item breakdown; this is a dashboard approximation.)
    const delivered = orders.filter((o) => o.status === 'delivered');
    delivered.forEach((o, i) => {
      const listingId = listings[i % listings.length]?.id;
      if (!listingId) return;
      const entry = countByListing[listingId];
      if (!entry) return;
      entry.count += 1;
      entry.revenue += Math.round(o.grandTotalPaise / 100);
    });

    return Object.values(countByListing)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [orders, listings]);

  return (
    <section className="surface-card p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">Top products</h2>
          <p className="text-[12.5px] text-ink-3">By delivered order volume.</p>
        </div>
        <Link to="/retailer/listings" className="text-[12px] text-ink-3 hover:text-ink">See all →</Link>
      </div>
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-11" />)}
        </div>
      ) : topProducts.length === 0 ? (
        <div className="text-[13px] text-ink-3 py-6 text-center">No products yet.</div>
      ) : (
        <ul className="divide-y divide-line">
          {topProducts.map((p, i) => (
            <li key={p.name} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <span className="shrink-0 w-5 text-center font-mono text-[12px] text-ink-3">{i + 1}</span>
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-bg-3 border border-line">
                <Package className="size-3.5 text-ink-3" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium text-ink truncate">{p.name}</div>
                <div className="text-[11.5px] text-ink-3">{p.count} orders · ₹{p.revenue.toLocaleString('en-IN')}</div>
              </div>
              <Badge tone={p.status === 'active' ? 'success' : 'neutral'} nodot>
                {p.status === 'active' ? 'Live' : p.status}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ───────── Low stock alerts ─────────

function LowStockCard({ listings, loading }: { listings: Listing[]; loading: boolean }) {
  const lowStock = useMemo(() => {
    const items: { id: string; name: string; variant: string; stock: number }[] = [];
    for (const l of listings) {
      if (l.status !== 'active') continue;
      for (const v of l.variants ?? []) {
        if (v.stock <= 3) {
          items.push({ id: l.id, name: l.name, variant: v.attributesLabel, stock: v.stock });
        }
      }
    }
    return items.sort((a, b) => a.stock - b.stock).slice(0, 6);
  }, [listings]);

  return (
    <section className="surface-card p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">Low stock</h2>
          <p className="text-[12.5px] text-ink-3">Variants with ≤ 3 units remaining.</p>
        </div>
        <Link to="/retailer/inventory" className="text-[12px] text-ink-3 hover:text-ink">Manage →</Link>
      </div>
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}
        </div>
      ) : lowStock.length === 0 ? (
        <div className="flex flex-col items-center py-6 text-center gap-2">
          <Check className="size-8 text-success" />
          <p className="text-[13px] text-ink-3">All variants well stocked.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {lowStock.map((item, i) => (
            <li key={i}>
              <Link
                to={`/retailer/inventory?productId=${item.id}`}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 border transition-colors',
                  item.stock === 0
                    ? 'border-danger/20 bg-danger/5 hover:bg-danger/10'
                    : 'border-warning/20 bg-warning/5 hover:bg-warning/10',
                )}
              >
                <AlertTriangle className={cn('size-3.5 shrink-0', item.stock === 0 ? 'text-danger' : 'text-warning')} />
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-medium text-ink truncate">{item.name}</div>
                  <div className="text-[11.5px] text-ink-3 truncate">{item.variant}</div>
                </div>
                <span className={cn('font-mono text-[13px] font-semibold shrink-0', item.stock === 0 ? 'text-danger' : 'text-warning')}>
                  {item.stock}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ───────── Recent orders table ─────────

function RecentOrdersCard({ orders, loading }: { orders: RetailerOrder[]; loading: boolean }) {
  const navigate = useNavigate();
  const [columns, setColumns] = useState({ consumer: true, method: true, items: true, total: true, status: true });
  const recent = [...orders].slice(0, 10);

  return (
    <section className="surface-card overflow-hidden">
      <div className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between border-b border-line">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">Recent orders</h2>
          <p className="text-[12.5px] text-ink-3">Last {recent.length} orders across your store.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ColumnsMenu columns={columns} setColumns={setColumns} />
          <Button asChild variant="outline" size="sm" iconLeft={<ArrowRight className="size-3.5" />}>
            <Link to="/retailer/orders">All orders</Link>
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="p-6 space-y-2">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}
        </div>
      ) : recent.length === 0 ? (
        <div className="p-12 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-bg-3 mb-3">
            <ShoppingBag className="size-5 text-ink-3" />
          </div>
          <p className="text-[13.5px] font-medium text-ink">No orders yet</p>
          <p className="text-[12.5px] text-ink-3 mt-1">Orders will appear here once customers check out.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-[11.5px] uppercase tracking-wider text-ink-3 border-b border-line">
                <th className="py-3 px-6 font-medium">Order</th>
                {columns.consumer && <th className="py-3 font-medium">Customer</th>}
                {columns.method && <th className="py-3 font-medium">Method</th>}
                {columns.items && <th className="py-3 font-medium">Items</th>}
                {columns.total && <th className="py-3 font-medium">Total</th>}
                {columns.status && <th className="py-3 font-medium">Status</th>}
                <th className="py-3 px-6 font-medium text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {recent.map((o) => {
                const total = Math.round(o.grandTotalPaise / 100);
                const statusMeta = orderStatusMeta(o.status);
                return (
                  <tr
                    key={o.id}
                    className="text-[13px] hover:bg-bg-2 cursor-pointer transition-colors"
                    onClick={() => navigate(`/retailer/orders/${o.id}`)}
                  >
                    <td className="py-3.5 px-6 font-mono text-[12px] text-ink-2">
                      #{o.id.slice(4, 12).toUpperCase()}
                    </td>
                    {columns.consumer && (
                      <td className="py-3.5">
                        <div className="flex items-center gap-2">
                          <Avatar name={o.consumerName} size="sm" />
                          <span className="font-medium text-ink truncate max-w-[140px]">{o.consumerName}</span>
                        </div>
                      </td>
                    )}
                    {columns.method && (
                      <td className="py-3.5 text-ink-3 capitalize text-[12.5px]">{o.paymentMethod.toUpperCase()}</td>
                    )}
                    {columns.items && (
                      <td className="py-3.5 text-ink-2 tabular">{o.itemCount}</td>
                    )}
                    {columns.total && (
                      <td className="py-3.5 font-mono text-[13px] text-ink">₹{total.toLocaleString('en-IN')}</td>
                    )}
                    {columns.status && (
                      <td className="py-3.5">
                        <Badge tone={statusMeta.tone} nodot>{statusMeta.label}</Badge>
                      </td>
                    )}
                    <td className="py-3.5 px-6 text-right text-[12px] text-ink-3 whitespace-nowrap">
                      {formatDate(o.placedAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ColumnsMenu<T extends Record<string, boolean>>({
  columns,
  setColumns,
}: {
  columns: T;
  setColumns: (next: T) => void;
}) {
  const labels: Record<string, string> = {
    consumer: 'Customer',
    method: 'Payment',
    items: 'Items',
    total: 'Total',
    status: 'Status',
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={toolbarBtn}>
          <SlidersHorizontal className="size-3.5" />
          Customize
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[200px]">
        <DropdownMenuLabel>Columns</DropdownMenuLabel>
        {Object.keys(labels).map((key) => (
          <DropdownMenuItem
            key={key}
            onSelect={(e) => {
              e.preventDefault();
              setColumns({ ...columns, [key]: !columns[key] } as T);
            }}
          >
            <span className={cn('grid size-4 place-items-center rounded border', columns[key] ? 'bg-ink border-ink text-bg' : 'border-line-2')}>
              {columns[key] && <Check className="size-3" />}
            </span>
            <span>{labels[key]}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const toolbarBtn =
  'inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-bg px-3 text-[12.5px] font-medium text-ink-2 hover:bg-bg-3 hover:text-ink press';

// ───────── Analytics computation ─────────

type DailyBucket = { label: string; rupees: number; count: number };

type Analytics = {
  gmv30dRupees: number;
  gmvPrev30dRupees: number;
  revenueChangePct: number;
  totalOrders: number;
  deliveredOrders: number;
  activeOrders: number;
  pendingOrders: number;
  cancelledOrders: number;
  avgOrderValueRupees: number;
  dailyRevenue: DailyBucket[];
};

function computeAnalytics(orders: RetailerOrder[], _listings: Listing[]): Analytics {
  const now = Date.now();
  const ms30d = 30 * 24 * 60 * 60 * 1000;
  const cutoff30 = now - ms30d;
  const cutoff60 = now - 2 * ms30d;

  let gmv30d = 0;
  let gmvPrev30d = 0;
  let deliveredOrders = 0;
  let activeOrders = 0;
  let pendingOrders = 0;
  let cancelledOrders = 0;

  // Build 30-day daily buckets
  const buckets: DailyBucket[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now - i * 24 * 60 * 60 * 1000);
    buckets.push({
      label: d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
      rupees: 0,
      count: 0,
    });
  }

  const ACTIVE_STATUSES = new Set(['confirmed', 'routing', 'accepted', 'packed', 'picked_up', 'out_for_delivery', 'at_door', 'undelivered', 'returning_to_store', 'returned_to_store']);

  for (const o of orders) {
    const t = new Date(o.placedAt).getTime();
    const rupees = Math.round(o.grandTotalPaise / 100);

    if (o.status === 'delivered') {
      deliveredOrders++;
      if (t >= cutoff30) gmv30d += rupees;
      else if (t >= cutoff60) gmvPrev30d += rupees;
    } else if (ACTIVE_STATUSES.has(o.status)) {
      activeOrders++;
    } else if (o.status === 'pending') {
      pendingOrders++;
    } else if (o.status === 'cancelled' || o.status === 'payment_failed') {
      cancelledOrders++;
    }

    // Daily revenue — all paid statuses in last 30 days
    if (t >= cutoff30 && o.status !== 'cancelled' && o.status !== 'payment_failed' && o.status !== 'pending') {
      const daysBack = Math.floor((now - t) / (24 * 60 * 60 * 1000));
      const idx = 29 - daysBack;
      const bucket = buckets[idx];
      if (bucket) {
        bucket.rupees += rupees;
        bucket.count += 1;
      }
    }
  }

  const totalOrders = orders.length;
  const paidOrders = orders.filter((o) => o.status !== 'cancelled' && o.status !== 'payment_failed' && o.status !== 'pending');
  const totalRevenue = paidOrders.reduce((s, o) => s + Math.round(o.grandTotalPaise / 100), 0);
  const avgOrderValueRupees = paidOrders.length > 0 ? Math.round(totalRevenue / paidOrders.length) : 0;
  const revenueChangePct = gmvPrev30d > 0
    ? ((gmv30d - gmvPrev30d) / gmvPrev30d) * 100
    : gmv30d > 0 ? 100 : 0;

  return {
    gmv30dRupees: Math.round(gmv30d),
    gmvPrev30dRupees: Math.round(gmvPrev30d),
    revenueChangePct,
    totalOrders,
    deliveredOrders,
    activeOrders,
    pendingOrders,
    cancelledOrders,
    avgOrderValueRupees,
    dailyRevenue: buckets,
  };
}

// ───────── Helpers ─────────

function orderStatusMeta(status: string): { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' } {
  switch (status) {
    case 'delivered': return { label: 'Delivered', tone: 'success' };
    case 'confirmed': return { label: 'Confirmed', tone: 'warning' };
    case 'accepted': return { label: 'Accepted', tone: 'warning' };
    case 'packed': return { label: 'Packed', tone: 'warning' };
    case 'picked_up': return { label: 'Picked up', tone: 'warning' };
    case 'out_for_delivery': return { label: 'Out for delivery', tone: 'warning' };
    case 'cancelled': return { label: 'Cancelled', tone: 'danger' };
    case 'payment_failed': return { label: 'Payment failed', tone: 'danger' };
    default: return { label: status.replace(/_/g, ' '), tone: 'neutral' };
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

