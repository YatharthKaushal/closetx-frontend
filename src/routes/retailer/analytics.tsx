import { useMemo, type ComponentType } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Page, PageHeader } from '@/components/ui/page';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Segmented } from '@/components/ui/segmented';
import { RevenueSummaryPanel } from './report-revenue-summary';
import { SalesTrendPanel } from './report-sales-detailed';
import { BestSellersPanel } from './report-best-sellers';
import { ListingRevenuePanel } from './report-listing-revenue';
import { VariantConversionPanel } from './report-variant-conversion';
import { DeadStockPanel } from './report-dead-stock';
import { TopReturnsPanel } from './report-returns-top';
import { CompliancePanel } from './report-compliance';
import { PayoutCyclesPanel } from './report-payout-cycles';
import { GstSummaryPanel, GstHsnPanel } from './report-gst';

type SubTab = { key: string; label: string; blurb: string; Panel: ComponentType };
type TopTab = { key: string; label: string; subs: SubTab[] };

/**
 * Analytics hub — the old Reports card launcher folded into one page.
 * Two-level navigation: top tabs are the domains (`?tab=`), inner Segmented
 * picks the report (`?sub=`). Every report renders its chart first with a
 * chart ⇄ table toggle inside the panel.
 */
const TABS: TopTab[] = [
  {
    key: 'sales',
    label: 'Sales',
    subs: [
      {
        key: 'summary',
        label: 'Revenue summary',
        blurb: 'Total sales, refunds, fees, TCS, and the money you keep.',
        Panel: RevenueSummaryPanel,
      },
      {
        key: 'trend',
        label: 'Sales trend',
        blurb: 'Gross revenue over time — by status, delivery method, or category.',
        Panel: SalesTrendPanel,
      },
    ],
  },
  {
    key: 'products',
    label: 'Products',
    subs: [
      {
        key: 'best-sellers',
        label: 'Best sellers',
        blurb: 'Top listings by units sold — reorder candidates surface here first.',
        Panel: BestSellersPanel,
      },
      {
        key: 'revenue',
        label: 'Listing revenue',
        blurb: 'Top revenue contributors and the long tail.',
        Panel: ListingRevenuePanel,
      },
      {
        key: 'conversion',
        label: 'Conversion',
        blurb: 'View → bag → delivered conversion per variant. Spot the drop-offs.',
        Panel: VariantConversionPanel,
      },
      {
        key: 'dead-stock',
        label: 'Dead stock',
        blurb: 'Healthy stock, zero sales — markdown candidates.',
        Panel: DeadStockPanel,
      },
    ],
  },
  {
    key: 'operations',
    label: 'Operations',
    subs: [
      {
        key: 'returns',
        label: 'Returns',
        blurb: 'Listings driving the most returns and why.',
        Panel: TopReturnsPanel,
      },
      {
        key: 'compliance',
        label: 'Compliance',
        blurb: 'Acceptance, fulfilment, disputes, and returns vs the platform floors.',
        Panel: CompliancePanel,
      },
      {
        key: 'payouts',
        label: 'Payouts',
        blurb: 'What each payout cycle actually paid, and what was held back.',
        Panel: PayoutCyclesPanel,
      },
    ],
  },
  {
    key: 'gst',
    label: 'GST',
    subs: [
      {
        key: 'summary',
        label: 'Tax summary',
        blurb: 'Output GST by rate slab with B2B/B2C split — counter + online, for GSTR-1 / GSTR-3B.',
        Panel: GstSummaryPanel,
      },
      {
        key: 'hsn',
        label: 'HSN summary',
        blurb: 'HSN-wise quantity, taxable value and tax across both channels — GSTR-1 Table 12.',
        Panel: GstHsnPanel,
      },
    ],
  },
];

export default function RetailerAnalytics() {
  const [params, setParams] = useSearchParams();

  const activeTab = TABS.find((t) => t.key === params.get('tab')) ?? TABS[0]!;
  const activeSub =
    activeTab.subs.find((s) => s.key === params.get('sub')) ?? activeTab.subs[0]!;

  function setTab(key: string) {
    const next = new URLSearchParams(params);
    if (key === TABS[0]!.key) next.delete('tab');
    else next.set('tab', key);
    next.delete('sub'); // each domain opens on its first report
    setParams(next);
  }

  function setSub(key: string) {
    const next = new URLSearchParams(params);
    if (key === activeTab.subs[0]!.key) next.delete('sub');
    else next.set('sub', key);
    setParams(next);
  }

  const subOptions = useMemo(
    () => activeTab.subs.map((s) => ({ value: s.key, label: s.label })),
    [activeTab],
  );

  const Panel = activeSub.Panel;

  return (
    <Page>
      <PageHeader
        kicker="Analytics"
        title="Analytics"
        description="Sales, catalog, and operational metrics — charts first, tables a click away. Data refreshes nightly unless noted."
      />

      <Tabs value={activeTab.key} onValueChange={setTab}>
        <TabsList className="overflow-x-auto whitespace-nowrap">
          {TABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {TABS.map((t) => (
          <TabsContent key={t.key} value={t.key}>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              {t.subs.length > 1 && (
                <Segmented
                  value={activeSub.key}
                  onChange={setSub}
                  options={subOptions}
                />
              )}
              <p className="max-w-xl text-[12.5px] text-ink-3">{activeSub.blurb}</p>
            </div>
            {t.key === activeTab.key && <Panel />}
          </TabsContent>
        ))}
      </Tabs>
    </Page>
  );
}
