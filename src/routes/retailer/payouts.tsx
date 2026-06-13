import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight } from 'lucide-react';
import { api } from '@/lib/api';
import { formatAge, formatPaise } from '@/lib/status';
import type { PayoutCycle, PayoutCycleStatus } from '@/lib/types';
import { useSearchParams } from 'react-router-dom';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import RetailerPayoutsUpcoming from './payouts-upcoming';
import RetailerEarlyDisbursement from './early-disbursement';

const TONE: Record<PayoutCycleStatus, 'warning' | 'info' | 'success' | 'danger'> = {
  pending: 'warning',
  processing: 'info',
  paid: 'success',
  failed: 'danger',
};

/** Body-only renderer for the settled history list. */
function PayoutHistoryBody() {
  const { data, isLoading } = useQuery({
    queryKey: ['retailer', 'payouts'],
    queryFn: () => api<PayoutCycle[]>('/retailer/payouts'),
  });
  const list = data ?? [];

  if (isLoading) return <Skeleton className="h-32" />;
  if (list.length === 0) return <Empty kicker="None" title="No payouts yet." />;
  return (
    <ul className="space-y-2">
      {list.map((p) => (
        <Card key={p.id}>
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[15px] font-semibold text-ink">{p.period}</span>
                <Badge tone={TONE[p.status]} pulse={p.status === 'failed' || p.status === 'pending'}>
                  {p.status}
                </Badge>
                <span className="font-mono text-[14px] text-ink">{formatPaise(p.amountPaise)}</span>
              </div>
              <div className="mt-1 text-[12px] text-ink-3">
                Bank {p.bankAccountMasked}
                {p.bankConfirmationRef && <> · UTR {p.bankConfirmationRef}</>}
                {p.retryCount > 0 && <> · {p.retryCount} retr{p.retryCount === 1 ? 'y' : 'ies'}</>}
              </div>
              {p.initiatedAt && (
                <div className="mt-1 text-[11.5px] text-ink-4">
                  Initiated {formatAge(p.initiatedAt)}
                  {p.settledAt && <> · Settled {formatAge(p.settledAt)}</>}
                </div>
              )}
            </div>
            <Button asChild variant="outline" size="sm" iconRight={<ArrowUpRight className="size-3.5" />}>
              <Link to={`/retailer/payouts/${p.id}`}>Open</Link>
            </Button>
          </CardContent>
        </Card>
      ))}
    </ul>
  );
}

const TAB_KEYS = ['history', 'upcoming', 'early'] as const;
type TabKey = (typeof TAB_KEYS)[number];

function parseTab(v: string | null): TabKey {
  return TAB_KEYS.includes(v as TabKey) ? (v as TabKey) : 'history';
}

/**
 * Payouts hub — absorbs Upcoming payout and Early disbursement into a tabbed
 * single page. The standalone routes (`/retailer/payouts/upcoming`,
 * `/retailer/early-disbursement`) stay registered so existing cross-links and
 * sidebar bookmarks from Phase 1 keep resolving; the sidebar simply collapses
 * to a single Payouts entry.
 */
export default function RetailerPayouts() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = parseTab(searchParams.get('tab'));

  function setActiveTab(v: string) {
    const next = parseTab(v);
    setSearchParams(
      (prev) => {
        const sp = new URLSearchParams(prev);
        if (next === 'history') sp.delete('tab');
        else sp.set('tab', next);
        return sp;
      },
      { replace: true },
    );
  }

  return (
    <Page>
      <PageHeader
        kicker="Settlement"
        title="Payouts"
        description="Each cycle settles to your bank on the cadence admin set. Failed disbursals retry automatically; persistent failures need bank-detail update."
      />
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="early">Early disbursement</TabsTrigger>
        </TabsList>
        <TabsContent value="history"><PayoutHistoryBody /></TabsContent>
        <TabsContent value="upcoming"><RetailerPayoutsUpcoming /></TabsContent>
        <TabsContent value="early"><RetailerEarlyDisbursement /></TabsContent>
      </Tabs>
    </Page>
  );
}
