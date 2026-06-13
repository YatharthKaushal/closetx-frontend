import { useSearchParams } from 'react-router-dom';
import { Page, PageHeader } from '@/components/ui/page';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TaxInvoicesBody } from './tax-invoices';
import { CommissionInvoicesBody } from './commission-invoices';
import { BillingStatementsBody } from './billing-statements';

const TAB_KEYS = ['tax', 'commission', 'statements'] as const;
type TabKey = (typeof TAB_KEYS)[number];

function parseTab(v: string | null): TabKey {
  return TAB_KEYS.includes(v as TabKey) ? (v as TabKey) : 'tax';
}

/**
 * Invoices hub — merges Tax invoices, Commission invoices, and Billing
 * statements into a single page with three tabs. The standalone routes
 * (`/retailer/tax-invoices`, etc.) stay registered so existing deep-links and
 * cross-links from order pages keep working; this hub just gives the sidebar
 * a single entry-point and the operator a one-page comparison view.
 *
 * Tab is bound to `?tab=` so reloads and shared URLs land on the right view.
 */
export default function RetailerInvoices() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = parseTab(searchParams.get('tab'));

  function setActiveTab(v: string) {
    const next = parseTab(v);
    setSearchParams(
      (prev) => {
        const sp = new URLSearchParams(prev);
        if (next === 'tax') sp.delete('tab');
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
        title="Invoices"
        description="Consumer tax invoices, commission invoices issued to your store, and monthly billing statements — all in one place."
      />
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="tax">Tax invoices</TabsTrigger>
          <TabsTrigger value="commission">Commission</TabsTrigger>
          <TabsTrigger value="statements">Billing statements</TabsTrigger>
        </TabsList>
        <TabsContent value="tax"><TaxInvoicesBody /></TabsContent>
        <TabsContent value="commission"><CommissionInvoicesBody /></TabsContent>
        <TabsContent value="statements"><BillingStatementsBody /></TabsContent>
      </Tabs>
    </Page>
  );
}
