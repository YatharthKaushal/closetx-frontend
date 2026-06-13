import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { CommunityFlag, ReviewFlag } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import { Page, PageHeader } from '@/components/ui/page';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClubbingPanel } from './clubbing';
import { FeatureControlsPanel } from './delegation-modes';
import { DeliveryWindowsPanel } from './delivery-windows';
import { LoyaltyPanel } from './loyalty';
import { CommunityModerationPanel } from './community-moderation';
import { ReviewsModerationPanel } from './reviews-moderation';

function TabCount({ count }: { count: number | undefined }) {
  if (!count) return null;
  return (
    <Badge tone="neutral" flat className="ml-1.5">
      {count}
    </Badge>
  );
}

/**
 * Platform rules hub — cross-platform policy knobs (promotion clubbing matrix,
 * per-capability feature toggles, delivery windows) merged with the engagement
 * levers (loyalty economics + the community / review moderation queues) behind
 * one entry as URL-synced tabs (`?tab=`). Tabs the session can't access are
 * hidden; open-flag counts surface as tab badges. The moderation queries share
 * keys with their panels so only one fetch happens.
 */
export default function AdminPlatformRulesHub() {
  const [params, setParams] = useSearchParams();
  const perms = useAuth((s) => s.session?.permissions);

  const community = useQuery({
    queryKey: ['admin', 'community-moderation'],
    queryFn: () => api<CommunityFlag[]>('/admin/community-moderation'),
    staleTime: 60_000,
  });
  const reviews = useQuery({
    queryKey: ['admin', 'reviews-moderation'],
    queryFn: () => api<ReviewFlag[]>('/admin/reviews-moderation'),
    staleTime: 60_000,
  });
  const communityOpen = (community.data ?? []).filter((f) => f.status === 'open').length;
  const reviewsOpen = (reviews.data ?? []).filter((r) => r.status === 'open').length;

  const tabs = useMemo(
    () =>
      [
        {
          key: 'clubbing',
          label: 'Clubbing matrix',
          show: !perms || perms['clubbing.view'] === true,
          count: undefined as number | undefined,
          Panel: ClubbingPanel,
        },
        {
          key: 'feature-controls',
          label: 'Feature controls',
          show: !perms || perms['platform_config.edit'] === true,
          count: undefined as number | undefined,
          Panel: FeatureControlsPanel,
        },
        {
          key: 'delivery-windows',
          label: 'Delivery windows',
          show: !perms || perms['platform_config.view'] === true,
          count: undefined as number | undefined,
          Panel: DeliveryWindowsPanel,
        },
        {
          key: 'loyalty',
          label: 'Loyalty config',
          show: !perms || perms['loyalty.view'] === true,
          count: undefined as number | undefined,
          Panel: LoyaltyPanel,
        },
        {
          key: 'community',
          label: 'Community',
          show: !perms || perms['community.moderate'] === true,
          count: communityOpen,
          Panel: CommunityModerationPanel,
        },
        {
          key: 'reviews',
          label: 'Reviews',
          show: !perms || perms['moderation.view'] === true,
          count: reviewsOpen,
          Panel: ReviewsModerationPanel,
        },
      ].filter((t) => t.show),
    [perms, communityOpen, reviewsOpen],
  );

  const fallback = tabs[0]?.key ?? 'clubbing';
  const active = tabs.some((t) => t.key === params.get('tab')) ? params.get('tab')! : fallback;

  function setTab(key: string) {
    const next = new URLSearchParams(params);
    if (key === fallback) next.delete('tab');
    else next.set('tab', key);
    setParams(next);
  }

  return (
    <Page>
      <PageHeader
        kicker="Platform"
        title="Platform rules"
        description="Cross-platform policy — how promotions stack, which features retailers can use, delivery windows — plus the loyalty, community, and review controls that shape customer behaviour."
      />

      <Tabs value={active} onValueChange={setTab}>
        <TabsList className="overflow-x-auto whitespace-nowrap">
          {tabs.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>
              {t.label}
              <TabCount count={t.count} />
            </TabsTrigger>
          ))}
        </TabsList>

        {tabs.map((t) => {
          const Panel = t.Panel;
          return (
            <TabsContent key={t.key} value={t.key}>
              <Panel />
            </TabsContent>
          );
        })}
      </Tabs>
    </Page>
  );
}
