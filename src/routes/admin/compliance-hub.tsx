import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Application, ChangeRequest } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import { Page } from '@/components/ui/page';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CompliancePanel, useComplianceData } from './compliance';
import { ChangeRequestsPanel } from './change-requests';
import { PolicyEnforcementPanel } from './policy-enforcement';
import { ApplicationsPanel } from './applications';

function TabCount({ count }: { count: number | undefined }) {
  if (!count) return null;
  return (
    <Badge tone="neutral" flat className="ml-1.5">
      {count}
    </Badge>
  );
}

/**
 * Compliance hub — one desk for KYC, change requests, performance breaches,
 * GDPR exports, account deletions and the enforcement ladder. The three former
 * sidebar entries (Compliance queue / Change requests / Policy enforcement) are
 * now URL-synced tabs (`?tab=`). Tabs the session can't access are hidden; the
 * first permitted tab is the default. Detail routes (`compliance/:id`,
 * `change-requests/:id`) are unchanged and still deep-link in.
 */
export default function AdminComplianceHub() {
  const [params, setParams] = useSearchParams();
  const perms = useAuth((s) => s.session?.permissions);

  // Shared with CompliancePanel by query key — single fetch, badge stays in sync.
  const compliance = useComplianceData();
  const pendingChanges = useQuery({
    queryKey: ['admin', 'change-requests', 'pending'],
    queryFn: () => api<ChangeRequest[]>('/admin/compliance/change-requests?status=pending'),
    staleTime: 60_000,
  });
  // Shares the query key with ApplicationsPanel (status='pending', its default).
  const pendingApps = useQuery({
    queryKey: ['admin', 'applications', 'pending'],
    queryFn: () => api<Application[]>('/admin/applications?limit=50&status=pending'),
    staleTime: 60_000,
  });

  const tabs = useMemo(
    () =>
      [
        {
          key: 'applications',
          label: 'Applications',
          show: !perms || perms['applications.view'] === true,
          count: pendingApps.data?.length,
          Panel: ApplicationsPanel,
        },
        {
          key: 'queue',
          label: 'KYC',
          show: !perms || perms['kyc.review'] === true,
          count: compliance.total,
          Panel: CompliancePanel,
        },
        {
          key: 'change-requests',
          label: 'Change requests',
          show: !perms || perms['change_requests.view'] === true,
          count: pendingChanges.data?.length,
          Panel: ChangeRequestsPanel,
        },
        {
          key: 'policy',
          label: 'Policy enforcement',
          show: !perms || perms['moderation.view'] === true,
          count: compliance.counts.floor,
          Panel: PolicyEnforcementPanel,
        },
      ].filter((t) => t.show),
    [
      perms,
      compliance.total,
      compliance.counts.floor,
      pendingChanges.data?.length,
      pendingApps.data?.length,
    ],
  );

  const fallback = tabs[0]?.key ?? 'queue';
  const active = tabs.some((t) => t.key === params.get('tab')) ? params.get('tab')! : fallback;

  function setTab(key: string) {
    const next = new URLSearchParams(params);
    if (key === fallback) next.delete('tab');
    else next.set('tab', key);
    setParams(next);
  }

  return (
    <Page>
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
