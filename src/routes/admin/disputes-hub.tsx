import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Page, PageHeader } from '@/components/ui/page';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DisputesPanel } from './issues';
import { RefundsPanel } from './refund-reconciliation';

/**
 * Disputes & refunds hub — the two post-order resolution surfaces merged behind
 * one entry as URL-synced tabs (`?tab=`). Tabs the session can't access are
 * hidden; the first permitted tab is the default. The dispute detail route
 * (`disputes/:id`) is unchanged and still deep-links in.
 */
export default function AdminDisputesHub() {
  const [params, setParams] = useSearchParams();
  const perms = useAuth((s) => s.session?.permissions);

  const tabs = useMemo(
    () =>
      [
        {
          key: 'disputes',
          label: 'Disputes',
          show: !perms || perms['disputes.view'] === true,
          Panel: DisputesPanel,
        },
        {
          key: 'refunds',
          label: 'Refunds',
          show: !perms || perms['refunds.view'] === true,
          Panel: RefundsPanel,
        },
      ].filter((t) => t.show),
    [perms],
  );

  const fallback = tabs[0]?.key ?? 'disputes';
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
        kicker="Orders"
        title="Disputes & refunds"
        description="Resolve order and return disputes, and track the refunds they trigger — one desk for everything that happens after something goes wrong with an order."
      />

      <Tabs value={active} onValueChange={setTab}>
        <TabsList>
          {tabs.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>
              {t.label}
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
