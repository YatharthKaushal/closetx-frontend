import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowUpRight,
  BadgePercent,
  Check,
  Clock,
  Download,
  Filter,
  Inbox,
  IndianRupee,
  MoreHorizontal,
  RotateCcw,
  ShieldAlert,
  ShoppingBag,
  SlidersHorizontal,
  Store,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { retailerStatusMeta } from '@/lib/status';
import type { AdminPayoutRow, AdminRetailerView, KycReverification, Store as StoreT } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Count } from '@/components/ui/count';
import { LineChart, type Series } from '@/components/ui/line-chart';
import { Segmented } from '@/components/ui/segmented';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/cn';

/**
 * Admin overview — single-pane operator console. The dark KPI card carries the
 * highest-attention metric (whichever queue currently demands action), the
 * chart shows recent marketplace activity, the right rail surfaces top
 * retailers, and the table lists latest applications with one-click triage
 * affordances.
 */
export default function AdminDashboard() {
  const session = useAuth((s) => s.session);
  const admin = session?.kind === 'admin' ? session.admin : null;

  const pendingRetailers = useQuery({
    queryKey: ['admin', 'retailers', 'pending_approval'],
    queryFn: () => api<AdminRetailerView[]>('/admin/retailers?status=pending_approval'),
  });
  const activeRetailers = useQuery({
    queryKey: ['admin', 'retailers', 'active'],
    queryFn: () => api<AdminRetailerView[]>('/admin/retailers?status=active'),
  });
  const onboardingStores = useQuery({
    queryKey: ['admin', 'stores', 'onboarding'],
    queryFn: () => api<StoreT[]>('/admin/stores?status=onboarding'),
  });
  const activeStores = useQuery({
    queryKey: ['admin', 'stores', 'active'],
    queryFn: () => api<StoreT[]>('/admin/stores?status=active'),
  });
  const failedPayouts = useQuery({
    queryKey: ['admin', 'payouts-pipeline'],
    queryFn: () => api<AdminPayoutRow[]>('/admin/payouts'),
    select: (rows) => rows.filter((p) => p.status === 'failed'),
  });
  const overdueKyc = useQuery({
    queryKey: ['admin', 'compliance', 'kyc'],
    queryFn: () => api<KycReverification[]>('/admin/compliance/kyc'),
    select: (rows) => rows.filter((k) => new Date(k.dueAt).getTime() < Date.now()),
  });

  const oldestRetailerAge = ageOfOldest(pendingRetailers.data, 'createdAt');
  const firstName = admin?.email.split('@')[0] ?? 'there';

  // Real time-series — bucket retailer createdAt timestamps over the last 7 months
  // and split into Active vs Pending. (Store doesn't have createdAt, so we keep
  // the chart honest by leaving it out.)
  const series = useMemo(() => {
    return buildActivitySeries(
      activeRetailers.data ?? [],
      pendingRetailers.data ?? [],
    );
  }, [pendingRetailers.data, activeRetailers.data]);

  const pendingCount = pendingRetailers.data?.length;
  const activeRetailerCount = activeRetailers.data?.length;
  const activeStoreCount = activeStores.data?.length;

  const topApplications = (pendingRetailers.data ?? []).slice(0, 6);

  return (
    <Page>
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description="Here's the live state of the marketplace — review what's waiting and triage from one place."
      />

      {/* Hero KPI strip — actionable: things that drive immediate action. */}
      <div className="grid gap-4 md:grid-cols-3 mb-4">
        <FeaturedKpi
          icon={<Inbox className="size-4" />}
          label="Pending applications"
          value={pendingCount}
          loading={pendingRetailers.isLoading}
          deltaText={oldestRetailerAge ? `Oldest ${oldestRetailerAge}` : 'All clear'}
          deltaTone={oldestRetailerAge ? 'danger' : 'success'}
          to="/admin/compliance?tab=applications"
          cta="Review"
        />
        <FeaturedKpi
          icon={<Wallet className="size-4" />}
          label="Failed payouts"
          value={failedPayouts.data?.length}
          loading={failedPayouts.isLoading}
          deltaText={(failedPayouts.data?.length ?? 0) > 0 ? 'Retry from pipeline' : 'All clear'}
          deltaTone={(failedPayouts.data?.length ?? 0) > 0 ? 'danger' : 'success'}
          to="/admin/payouts-pipeline"
          cta="Retry"
          variant="warning"
        />
        <FeaturedKpi
          icon={<ShieldAlert className="size-4" />}
          label="Overdue KYC"
          value={overdueKyc.data?.length}
          loading={overdueKyc.isLoading}
          deltaText={(overdueKyc.data?.length ?? 0) > 0 ? 'Past due date' : 'All clear'}
          deltaTone={(overdueKyc.data?.length ?? 0) > 0 ? 'danger' : 'success'}
          to="/admin/compliance"
          cta="Review"
          variant="warning"
        />
      </div>

      {/* Secondary KPI strip — informational: roll-up state. */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Kpi
          icon={<Users className="size-4" />}
          label="Active retailers"
          value={activeRetailerCount}
          loading={activeRetailers.isLoading}
          delta={changePctish(activeRetailers.data?.length, pendingRetailers.data?.length)}
          to="/admin/users?tab=retailers"
        />
        <Kpi
          icon={<Store className="size-4" />}
          label="Active storefronts"
          value={activeStoreCount}
          loading={activeStores.isLoading}
          delta={changePctish(activeStores.data?.length, onboardingStores.data?.length)}
          to="/admin/stores"
        />
        <Kpi
          icon={<Clock className="size-4" />}
          label="Onboarding stores"
          value={onboardingStores.data?.length}
          loading={onboardingStores.isLoading}
          to="/admin/stores"
        />
      </div>

      {/* §21 Marketplace KPIs (MOCK_DEPENDENCY: §21) */}
      <MarketplaceKpiStrip />

      {/* Chart + top retailers */}
      <div className="grid gap-4 lg:grid-cols-3 mb-6">
        <ChartCard series={series} className="lg:col-span-2" />
        <TopRetailersCard
          retailers={(activeRetailers.data ?? []).slice(0, 4)}
          loading={activeRetailers.isLoading}
        />
      </div>

      {/* §21 Cohorts (MOCK_DEPENDENCY: §21) */}
      <CohortsCard />

      {/* Latest applications */}
      <LatestApplicationsCard
        items={topApplications}
        loading={pendingRetailers.isLoading}
      />
    </Page>
  );
}

// ─── §21 Marketplace KPIs (mocked) ───

function MarketplaceKpiStrip() {
  // MOCK_DEPENDENCY: §21 — wire to /admin/reports/marketplace-kpis
  const kpis: { label: string; value: string; tone: 'success' | 'danger' | 'neutral'; delta: string; icon: React.ReactNode }[] = [
    { label: 'Total sales (today)', value: '₹38.4L', tone: 'success', delta: '+12.4% vs last wk', icon: <IndianRupee className="size-4" /> },
    { label: 'Platform fee', value: '14.2%', tone: 'neutral', delta: 'Min 12%', icon: <BadgePercent className="size-4" /> },
    { label: 'Dispute-rate', value: '1.8%', tone: 'success', delta: '-0.3pt wow', icon: <ShieldAlert className="size-4" /> },
    { label: 'Refund-rate', value: '4.1%', tone: 'danger', delta: '+0.6pt wow', icon: <RotateCcw className="size-4" /> },
    { label: 'Payout volume (24h)', value: '₹61.2L', tone: 'neutral', delta: '7 failed', icon: <Wallet className="size-4" /> },
  ];
  return (
    <section className="mb-6">
      <div className="kicker mb-2">Marketplace KPIs · today</div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {kpis.map((k) => (
          <div key={k.label} className="surface-card p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11.5px] uppercase tracking-wide text-ink-3">{k.label}</span>
              <span className="grid size-7 place-items-center rounded-full bg-bg-3 text-ink-2">{k.icon}</span>
            </div>
            <div className="mt-2 font-mono text-[22px] text-ink leading-none">{k.value}</div>
            <div className={cn('mt-1.5 text-[11.5px]',
              k.tone === 'success' ? 'text-success' : k.tone === 'danger' ? 'text-danger' : 'text-ink-3')}>
              {k.delta}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── §21 Cohorts (mocked) ───

function CohortsCard() {
  // MOCK_DEPENDENCY: §21 — retailer-cohort retention by month
  const cohorts: { cohort: string; size: number; m1: number; m2: number; m3: number }[] = [
    { cohort: 'Feb 2026', size: 142, m1: 88, m2: 71, m3: 64 },
    { cohort: 'Mar 2026', size: 168, m1: 91, m2: 74, m3: 0 },
    { cohort: 'Apr 2026', size: 201, m1: 89, m2: 0, m3: 0 },
    { cohort: 'May 2026', size: 184, m1: 0, m2: 0, m3: 0 },
  ];
  return (
    <section className="surface-card mb-6 p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">Retailer retention</h2>
          <p className="text-[12.5px] text-ink-3">Active-retailer retention by signup month.</p>
        </div>
        <Link to="/admin/reports/leaderboard" className="text-[12px] text-ink-3 hover:text-ink">View leaderboard →</Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px]">
          <thead className="text-ink-3">
            <tr className="border-b border-line">
              <th className="px-3 py-2 text-left font-medium">Signed up</th>
              <th className="px-3 py-2 text-right font-medium">Size</th>
              <th className="px-3 py-2 text-right font-medium">M+1</th>
              <th className="px-3 py-2 text-right font-medium">M+2</th>
              <th className="px-3 py-2 text-right font-medium">M+3</th>
            </tr>
          </thead>
          <tbody>
            {cohorts.map((c) => (
              <tr key={c.cohort} className="border-b border-line/60">
                <td className="px-3 py-2 text-ink">{c.cohort}</td>
                <td className="px-3 py-2 text-right font-mono">{c.size}</td>
                <td className="px-3 py-2 text-right font-mono">{c.m1 ? `${c.m1}%` : '—'}</td>
                <td className="px-3 py-2 text-right font-mono">{c.m2 ? `${c.m2}%` : '—'}</td>
                <td className="px-3 py-2 text-right font-mono">{c.m3 ? `${c.m3}%` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ─── KPI cards ───

function FeaturedKpi({
  icon,
  label,
  value,
  loading,
  deltaText,
  deltaTone,
  to,
  cta,
  variant = 'default',
}: {
  icon: React.ReactNode;
  label: string;
  value: number | undefined;
  loading: boolean;
  deltaText?: string;
  deltaTone: 'success' | 'danger';
  to: string;
  cta?: string;
  variant?: 'default' | 'warning';
}) {
  const surface = variant === 'warning'
    ? 'bg-gradient-to-br from-[#3a1a09] to-[#2a1206] text-bg'
    : 'bg-ink text-bg';
  return (
    <Link
      to={to}
      className={cn(
        'group relative overflow-hidden rounded-2xl p-6 shadow-card transition-transform press',
        surface,
      )}
    >
      <div className="absolute inset-0 opacity-[0.06] [background-image:radial-gradient(circle_at_20%_20%,white_1px,transparent_1px)] [background-size:20px_20px]" />
      <div className="relative flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-medium uppercase tracking-wider text-bg/60">
            {label}
          </span>
          <span className="grid size-9 place-items-center rounded-full bg-bg/10 text-bg">
            {icon}
          </span>
        </div>
        <div className="leading-none">
          {loading ? (
            <Skeleton className="h-10 w-28 bg-bg/15" />
          ) : (
            <div className="font-mono text-[40px] font-semibold tracking-tight">
              <Count value={value} />
            </div>
          )}
        </div>
        <div className="flex items-center justify-between text-[12px] text-bg/70">
          <span className={cn(
            'inline-flex items-center gap-1.5',
            deltaTone === 'success' ? 'text-emerald-400' : 'text-rose-300',
          )}>
            <Clock className="size-3" />
            {deltaText}
          </span>
          <span className="inline-flex items-center gap-1 text-bg/90 group-hover:text-bg">
            {cta ?? 'Open'}
            <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}

function Kpi({
  icon,
  label,
  value,
  loading,
  delta,
  to,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | undefined;
  loading: boolean;
  delta?: { tone: 'success' | 'danger' | 'neutral'; text: string };
  to: string;
}) {
  return (
    <Link
      to={to}
      className="group surface-card p-6 transition-shadow press hover:shadow-md"
    >
      <div className="flex items-center justify-between mb-5">
        <span className="text-[12px] font-medium uppercase tracking-wider text-ink-3">
          {label}
        </span>
        <span className="grid size-9 place-items-center rounded-full bg-bg-3 text-ink-2">
          {icon}
        </span>
      </div>
      {loading ? (
        <Skeleton className="h-10 w-28" />
      ) : (
        <div className="font-mono text-[40px] font-semibold tracking-tight text-ink leading-none">
          <Count value={value} />
        </div>
      )}
      {delta && (
        <div className="mt-3 flex items-center justify-between text-[12px]">
          <span
            className={cn(
              delta.tone === 'success' ? 'text-success' :
              delta.tone === 'danger' ? 'text-danger' :
              'text-ink-3',
            )}
          >
            {delta.text}
          </span>
          <ArrowUpRight className="size-4 text-ink-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </div>
      )}
    </Link>
  );
}

// ─── Chart card ───

function ChartCard({ series, className }: { series: { labels: string[]; data: Series[] }; className?: string }) {
  const [view, setView] = useState<'all' | 'active' | 'pending'>('all');
  const visible: Series[] = series.data.filter((s) => {
    if (view === 'all') return true;
    if (view === 'active') return s.label === 'Active';
    return s.label === 'Pending';
  });

  return (
    <section className={cn('surface-card p-6', className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">Retailer signups</h2>
          <p className="text-[12.5px] text-ink-3">New retailer applications over the last 7 months.</p>
        </div>
        <Segmented<'all' | 'active' | 'pending'>
          options={[
            { value: 'all', label: 'All' },
            { value: 'active', label: 'Active' },
            { value: 'pending', label: 'Pending' },
          ]}
          value={view}
          onChange={setView}
        />
      </div>
      <LineChart
        labels={series.labels}
        series={visible}
        height={240}
        formatY={(n) => Math.round(n).toString()}
      />
    </section>
  );
}

// ─── Top retailers ───

function TopRetailersCard({ retailers, loading }: { retailers: AdminRetailerView[]; loading: boolean }) {
  return (
    <section className="surface-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[15px] font-semibold text-ink">Top retailers</h2>
        <Link to="/admin/users?tab=retailers" className="text-[12px] text-ink-3 hover:text-ink">View all →</Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}
        </div>
      ) : retailers.length === 0 ? (
        <EmptyHint icon={<TrendingUp className="size-4" />} text="No active retailers yet." />
      ) : (
        <ul className="space-y-3">
          {retailers.map((r) => (
            <li key={r.id} className="flex items-center gap-3">
              <Avatar name={r.legalName} />
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-medium text-ink truncate">{r.legalName}</div>
                <div className="text-[12px] text-ink-3 truncate">{r.email}</div>
              </div>
              <Badge tone="success" nodot>Active</Badge>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ─── Latest applications ───

function LatestApplicationsCard({
  items,
  loading,
}: {
  items: AdminRetailerView[];
  loading: boolean;
}) {
  const [columns, setColumns] = useState<{ company: boolean; email: boolean; createdAt: boolean; status: boolean }>({
    company: true,
    email: true,
    createdAt: true,
    status: true,
  });

  return (
    <section className="surface-card overflow-hidden">
      <div className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between border-b border-line">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">Latest applications</h2>
          <p className="text-[12.5px] text-ink-3">Retailers awaiting your review.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ColumnsMenu columns={columns} setColumns={setColumns} />
          <ToolbarButton icon={<Filter className="size-3.5" />}>Filter</ToolbarButton>
          <ToolbarButton icon={<Download className="size-3.5" />} onClick={() => exportCsv(items)}>Export</ToolbarButton>
        </div>
      </div>

      {loading ? (
        <div className="p-6 space-y-2">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="p-12 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-bg-3 mb-3">
            <Check className="size-5 text-success" />
          </div>
          <p className="text-[13.5px] font-medium text-ink">All caught up</p>
          <p className="text-[12.5px] text-ink-3 mt-1">No retailers waiting for review.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-[11.5px] uppercase tracking-wider text-ink-3 border-b border-line">
                <th className="py-3 px-6 font-medium">App. ID</th>
                {columns.company && <th className="py-3 font-medium">Company</th>}
                {columns.email && <th className="py-3 font-medium">Email</th>}
                {columns.createdAt && <th className="py-3 font-medium">Submitted</th>}
                {columns.status && <th className="py-3 font-medium">Status</th>}
                <th className="py-3 px-6 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {items.map((r) => {
                const meta = retailerStatusMeta(r.status);
                return (
                  <tr key={r.id} className="text-[13px] hover:bg-bg-2 transition-colors">
                    <td className="py-3.5 px-6 font-mono text-[12px] text-ink-2">#{r.id.slice(0, 8).toUpperCase()}</td>
                    {columns.company && (
                      <td className="py-3.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={r.legalName} size="sm" />
                          <span className="font-medium text-ink truncate max-w-[200px]">{r.legalName}</span>
                        </div>
                      </td>
                    )}
                    {columns.email && (
                      <td className="py-3.5 text-ink-2 truncate max-w-[220px]">{r.email}</td>
                    )}
                    {columns.createdAt && (
                      <td className="py-3.5 text-ink-3 whitespace-nowrap">{formatDate(r.createdAt)}</td>
                    )}
                    {columns.status && (
                      <td className="py-3.5">
                        <Badge tone={meta.tone} pulse>{meta.label}</Badge>
                      </td>
                    )}
                    <td className="py-3.5 px-6 text-right">
                      <RowActions retailer={r} />
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

function RowActions({ retailer }: { retailer: AdminRetailerView }) {
  const navigate = useNavigate();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Row actions"
          className="grid size-8 place-items-center rounded-md text-ink-3 hover:bg-bg-3 hover:text-ink press"
        >
          <MoreHorizontal className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[180px]">
        <DropdownMenuLabel>{retailer.legalName.slice(0, 24)}</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => navigate('/admin/retailers')}>
          <Inbox className="size-3.5 text-ink-3" />
          <span>Review application</span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate('/admin/retailers')}>
          <Check className="size-3.5 text-success" />
          <span>Approve</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigator.clipboard.writeText(retailer.email)}>
          <ShoppingBag className="size-3.5 text-ink-3" />
          <span>Copy email</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
    company: 'Company',
    email: 'Email',
    createdAt: 'Submitted',
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
            <span
              className={cn(
                'grid size-4 place-items-center rounded border',
                columns[key] ? 'bg-ink border-ink text-bg' : 'border-line-2',
              )}
            >
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

function ToolbarButton({
  icon,
  children,
  onClick,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className={toolbarBtn}>
      {icon}
      {children}
    </button>
  );
}

function EmptyHint({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 text-[13px] text-ink-3 py-6 justify-center">
      <span className="text-ink-4">{icon}</span>
      {text}
    </div>
  );
}

// ─── helpers ───

function ageOfOldest<T>(items: T[] | undefined, dateKey: keyof T): string | null {
  if (!items || items.length === 0) return null;
  const dates = items
    .map((it) => new Date(it[dateKey] as unknown as string).getTime())
    .filter((t) => !Number.isNaN(t));
  if (dates.length === 0) return null;
  const oldest = Math.min(...dates);
  return formatAge(Date.now() - oldest);
}

function formatAge(ms: number): string {
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function formatDate(input: string): string {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
    ', ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function changePctish(active: number | undefined, pending: number | undefined): { tone: 'success' | 'neutral'; text: string } {
  if (active == null || pending == null) return { tone: 'neutral', text: '—' };
  const total = active + pending;
  if (total === 0) return { tone: 'neutral', text: 'No data yet' };
  const pct = Math.round((active / total) * 100);
  return { tone: 'success', text: `${pct}% active` };
}

function buildActivitySeries(
  active: { createdAt: string }[],
  pending: { createdAt: string }[],
): { labels: string[]; data: Series[] } {
  const months = 7;
  const now = new Date();
  now.setDate(1);
  const buckets: { key: string; label: string; active: number; pending: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleDateString(undefined, { month: 'short' }),
      active: 0,
      pending: 0,
    });
  }
  const idxByKey = new Map(buckets.map((b, i) => [b.key, i] as const));
  const bump = (createdAt: string, field: 'active' | 'pending') => {
    const d = new Date(createdAt);
    if (Number.isNaN(d.getTime())) return;
    const k = `${d.getFullYear()}-${d.getMonth()}`;
    const i = idxByKey.get(k);
    if (i != null) {
      const bucket = buckets[i];
      if (bucket) bucket[field] += 1;
    }
  };
  active.forEach((r) => bump(r.createdAt, 'active'));
  pending.forEach((r) => bump(r.createdAt, 'pending'));

  return {
    labels: buckets.map((b) => b.label),
    data: [
      { label: 'Active', color: 'var(--color-ink)', values: buckets.map((b) => b.active) },
      { label: 'Pending', color: 'var(--color-ink-3)', values: buckets.map((b) => b.pending) },
    ],
  };
}

function exportCsv(items: AdminRetailerView[]) {
  const rows = [
    ['App ID', 'Company', 'Email', 'Status', 'Submitted'],
    ...items.map((r) => [r.id, r.legalName, r.email, r.status, r.createdAt]),
  ];
  const csv = rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `applications-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

