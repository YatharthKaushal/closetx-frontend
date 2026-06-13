import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  BarChart3,
  Filter,
  Funnel,
  GanttChart,
  ShieldAlert,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Empty } from '@/components/ui/empty';
import { useAuth } from '@/lib/auth';

type ReportCard = {
  to: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  group: 'Performance' | 'Adoption' | 'Compliance';
  /** Permission action key. Card is hidden when the active session lacks it. */
  action: string;
};

const REPORTS: ReadonlyArray<ReportCard> = [
  {
    to: '/admin/reports/headline',
    title: 'Headline · last 30 days',
    description: 'Total sales, platform fee %, average order value, refund rate, and monthly signups — for leadership reviews.',
    icon: BarChart3,
    group: 'Performance',
    action: 'reports.view',
  },
  {
    to: '/admin/reports/leaderboard',
    title: 'Retailer leaderboard',
    description: 'Best and worst performers across acceptance, fulfilment, returns, and disputes (30d).',
    icon: Trophy,
    group: 'Performance',
    action: 'reports.view',
  },
  {
    to: '/admin/reports/operational',
    title: 'Operational health',
    description: 'Throughput, fulfilment latency, payout volume, and disputes. Last 30 days.',
    icon: GanttChart,
    group: 'Performance',
    action: 'reports.view',
  },
  {
    to: '/admin/reports/funnel',
    title: 'Consumer funnel',
    description: 'Search → listing → bag → checkout → delivered. Locate the highest-leverage drop-off.',
    icon: Funnel,
    group: 'Adoption',
    action: 'reports.view',
  },
  {
    to: '/admin/reports/feature-usage',
    title: 'Feature usage',
    description: 'Adoption and cost for virtual try-on and AI catalog. Decide what to scale or sunset.',
    icon: Sparkles,
    group: 'Adoption',
    action: 'reports.view',
  },
  {
    to: '/admin/reports/below-floor',
    title: 'Below-floor retailers',
    description: 'Retailers under acceptance or over dispute floor with their current enforcement state.',
    icon: Filter,
    group: 'Compliance',
    action: 'reports.view',
  },
  {
    to: '/admin/reports/compliance',
    title: 'Performance-floor breaches',
    description: 'Retailers below the floor. Click to escalate via Policy Enforcement.',
    icon: ShieldAlert,
    group: 'Compliance',
    action: 'reports.view',
  },
];

const GROUP_ORDER: ReadonlyArray<ReportCard['group']> = ['Performance', 'Adoption', 'Compliance'];

export default function AdminReportsIndex() {
  const permissions = useAuth((s) =>
    s.session?.kind === 'admin' ? s.session.permissions : undefined,
  );
  // No permission map = treat as fully privileged (matches `filterSidebarGroups`).
  // Empty map (post-401 fallback) hides everything.
  const visibleReports = REPORTS.filter(
    (r) => !permissions || permissions[r.action] === true,
  );
  return (
    <Page>
      <PageHeader
        kicker="Reports"
        title="Reports"
        description="Marketplace performance, adoption, and compliance. Each report opens in its own page; data refreshes nightly unless noted otherwise."
      />

      {visibleReports.length === 0 ? (
        <Empty
          kicker="No access"
          title="You don't have permission to view any reports."
          description="Ask a super-admin to grant `reports.view` on your sub-role."
        />
      ) : (
      <div className="space-y-8">
        {GROUP_ORDER.map((group) => {
          const cards = visibleReports.filter((r) => r.group === group);
          if (cards.length === 0) return null;
          return (
            <div key={group}>
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-ink-3">
                {group}
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {cards.map((r) => (
                  <Link key={r.to} to={r.to} className="group">
                    <Card className="h-full transition-colors hover:border-line-strong">
                      <CardContent className="p-5">
                        <div className="mb-3 flex items-center justify-between">
                          <r.icon className="size-4 text-ink-3" />
                          <ArrowUpRight className="size-3.5 text-ink-4 transition-colors group-hover:text-ink" />
                        </div>
                        <div className="text-[14px] font-medium text-ink">{r.title}</div>
                        <div className="mt-1 text-[12.5px] text-ink-3 leading-snug">
                          {r.description}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      )}
    </Page>
  );
}
