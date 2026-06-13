import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Page, PageHeader } from '@/components/ui/page';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PlaceTestOrderPanel } from './orders/place';
import { PricingSimulatorPanel } from './promotion-preview';

/**
 * Developer-only hub — QA / simulation tools merged behind one entry as
 * URL-synced tabs (`?tab=`). Tabs the session can't access are hidden; the
 * first permitted tab is the default.
 */
export default function AdminDeveloperHub() {
  const [params, setParams] = useSearchParams();
  const perms = useAuth((s) => s.session?.permissions);

  const tabs = useMemo(
    () =>
      [
        {
          key: 'place-test-order',
          label: 'Place test order',
          show: !perms || perms['simulate.run'] === true,
          Panel: PlaceTestOrderPanel,
        },
        {
          key: 'pricing-simulator',
          label: 'Pricing simulator',
          show: !perms || perms['promotions.view'] === true,
          Panel: PricingSimulatorPanel,
        },
      ].filter((t) => t.show),
    [perms],
  );

  const fallback = tabs[0]?.key ?? 'place-test-order';
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
        kicker="Developer"
        title="Developer only"
        description="QA and simulation tools — place a test order through the full lifecycle, or model how the pricing engine resolves a cart."
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
