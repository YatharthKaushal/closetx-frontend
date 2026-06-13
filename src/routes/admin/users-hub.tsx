import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { AdminRetailerView } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import { Page, PageHeader } from '@/components/ui/page';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RetailersPanel } from './retailers';
import { ConsumersPanel } from './consumers';

function TabCount({ count }: { count: number | undefined }) {
  if (!count) return null;
  return (
    <Badge tone="neutral" flat className="ml-1.5">
      {count}
    </Badge>
  );
}

/**
 * Users hub — every person on the platform (selling retailers + buying
 * consumers) behind one sidebar entry, as URL-synced tabs (`?tab=`). Detail
 * routes (`retailers/:id`, `consumers/:id`) and the retailer onboarding wizard
 * (`retailers/new`) are unchanged and still deep-link in. The Retailers tab
 * badge surfaces how many sign-ups are awaiting approval.
 */
export default function AdminUsersHub() {
  const [params, setParams] = useSearchParams();
  const perms = useAuth((s) => s.session?.permissions);

  // Shares the query key with RetailersPanel — one fetch, badge stays in sync.
  const retailers = useQuery({
    queryKey: ['admin', 'retailers', 'all'],
    queryFn: () => api<AdminRetailerView[]>('/admin/retailers'),
    staleTime: 60_000,
  });
  const pendingRetailers = (retailers.data ?? []).filter(
    (r) => r.status === 'pending_approval',
  ).length;

  const tabs = useMemo(
    () =>
      [
        {
          key: 'retailers',
          label: 'Retailers',
          show: !perms || perms['applications.view'] === true,
          count: pendingRetailers,
          Panel: RetailersPanel,
        },
        {
          key: 'consumers',
          label: 'Consumers',
          show: !perms || perms['consumers.view'] === true,
          count: undefined as number | undefined,
          Panel: ConsumersPanel,
        },
      ].filter((t) => t.show),
    [perms, pendingRetailers],
  );

  const fallback = tabs[0]?.key ?? 'retailers';
  const active = tabs.some((t) => t.key === params.get('tab')) ? params.get('tab')! : fallback;

  function setTab(key: string) {
    const next = new URLSearchParams(params);
    if (key === fallback) next.delete('tab');
    else next.set('tab', key);
    // Drop list-local filter params so switching person-type starts clean.
    next.delete('status');
    next.delete('q');
    setParams(next);
  }

  return (
    <Page>
      <PageHeader
        kicker="Users"
        title="Users"
        description="Everyone on the platform — selling retailers and buying consumers. Approve sign-ups, search the directory, and drill into any account."
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
