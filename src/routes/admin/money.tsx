import { useMemo, type ComponentType } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Page, PageHeader } from '@/components/ui/page';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Segmented } from '@/components/ui/segmented';
import { Empty } from '@/components/ui/empty';
import { PayoutsPipelinePanel } from './payouts-pipeline';
import { PayoutHoldsPanel } from './payout-holds';
import { PayoutAdjustmentsPanel } from './payout-adjustments';
import { EarlyPayoutsPanel } from './early-disbursement-decisions';
import { LeftoversPanel } from './tail-of-cycle';
import { WalletPayoutsPanel } from './wallet-payouts';
import { BillingPanel } from './billing-console';
import { InvoiceOpsPanel } from './invoice-ops';
import { InvoiceNumberingPanel } from './invoice-numbering';
import { GstReturnsPanel } from './gst-returns';
import { PaymentReconciliationPanel } from './payment-reconciliation';
import { PaymentFailuresPanel } from './payment-failures';
import { FeesPanel } from './fees';

/**
 * Money hub — the whole settlement / invoicing / reconciliation / fees domain
 * behind one sidebar entry. Top-level `Tabs` are the four groups; each group
 * holds an inner `Segmented` (pill) switcher for its sub-pages. URL-synced via
 * `?tab=<group>&sub=<subpage>`; any other query params (storeId, period,
 * orderId, …) are passed through untouched so deep-linked panels still read
 * them. Tabs the active session can't access are hidden, and groups with no
 * accessible sub-page disappear entirely.
 */

type SubTab = { key: string; label: string; show: boolean; Panel: ComponentType };
type TopTab = { key: string; label: string; subs: SubTab[] };

export default function AdminMoney() {
  const [params, setParams] = useSearchParams();
  const perms = useAuth((s) => (s.session?.kind === 'admin' ? s.session.permissions : undefined));
  const subRole = useAuth((s) => (s.session?.kind === 'admin' ? s.session.admin.subRole : undefined));

  const tabs = useMemo<TopTab[]>(() => {
    // When there is no session yet (perms undefined) show everything — matches
    // the old launcher, which gated purely on action keys.
    const can = (a: string) => !perms || perms[a] === true;
    const superOk = !perms || subRole === 'super_admin';

    const all: Array<TopTab> = [
      {
        key: 'payouts',
        label: 'Payouts',
        subs: [
          { key: 'runs', label: 'Payout runs', show: can('payouts.view'), Panel: PayoutsPipelinePanel },
          { key: 'holds', label: 'On hold', show: can('payouts.hold'), Panel: PayoutHoldsPanel },
          { key: 'adjustments', label: 'Adjustments', show: can('payouts.hold'), Panel: PayoutAdjustmentsPanel },
          { key: 'early', label: 'Early payout requests', show: can('early_disbursement.decide'), Panel: EarlyPayoutsPanel },
          { key: 'leftovers', label: 'Leftover to settle', show: can('payouts.view'), Panel: LeftoversPanel },
          { key: 'wallet', label: 'Customer wallet payouts', show: can('wallet_payouts.process'), Panel: WalletPayoutsPanel },
        ],
      },
      {
        key: 'invoices',
        label: 'Invoices & GST',
        subs: [
          { key: 'billing', label: 'Monthly billing', show: can('payouts.view') && superOk, Panel: BillingPanel },
          { key: 'fix', label: 'Fix invoices', show: can('invoicing.numbering.edit'), Panel: InvoiceOpsPanel },
          { key: 'numbering', label: 'Invoice numbering', show: can('invoicing.numbering.edit') && superOk, Panel: InvoiceNumberingPanel },
          { key: 'returns', label: 'GST returns', show: can('invoicing.gst_returns.generate'), Panel: GstReturnsPanel },
        ],
      },
      {
        key: 'reconcile',
        label: 'Bank matching',
        subs: [
          { key: 'payments', label: 'Match gateway statements', show: can('refunds.view'), Panel: PaymentReconciliationPanel },
          { key: 'failures', label: 'Failed payments', show: can('refunds.view'), Panel: PaymentFailuresPanel },
        ],
      },
      {
        key: 'fees',
        label: 'Fees',
        subs: [
          { key: 'fees', label: 'Fees & charges', show: can('platform_config.view') && superOk, Panel: FeesPanel },
        ],
      },
    ];

    // Drop hidden sub-tabs, then drop groups left with nothing.
    return all
      .map((t) => ({ ...t, subs: t.subs.filter((s) => s.show) }))
      .filter((t) => t.subs.length > 0);
  }, [perms, subRole]);

  if (tabs.length === 0) {
    return (
      <Page>
        <PageHeader kicker="Finance" title="Payouts" />
        <Empty
          kicker="No access"
          title="You don't have permission to view any money pages."
          description="Ask a super-admin to grant settlement / invoicing permissions on your sub-role."
        />
      </Page>
    );
  }

  const fallbackTop = tabs[0]!.key;
  const activeTop = tabs.some((t) => t.key === params.get('tab')) ? params.get('tab')! : fallbackTop;
  const group = tabs.find((t) => t.key === activeTop)!;

  const fallbackSub = group.subs[0]!.key;
  const activeSub = group.subs.some((s) => s.key === params.get('sub')) ? params.get('sub')! : fallbackSub;
  const ActivePanel = group.subs.find((s) => s.key === activeSub)!.Panel;

  function setTop(key: string) {
    const next = new URLSearchParams(params);
    if (key === fallbackTop) next.delete('tab');
    else next.set('tab', key);
    // Reset the sub-tab when switching groups — its keys don't carry across.
    next.delete('sub');
    setParams(next);
  }

  function setSub(key: string) {
    const next = new URLSearchParams(params);
    if (key === fallbackSub) next.delete('sub');
    else next.set('sub', key);
    setParams(next);
  }

  return (
    <Page>
      <PageHeader
        kicker="Finance"
        title="Payouts"
        description="Payouts to retailers, invoices and GST, matching payments against the bank, and platform fees — all in one place."
      />

      <Tabs value={activeTop} onValueChange={setTop}>
        <TabsList>
          {tabs.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {tabs.map((t) => (
          <TabsContent key={t.key} value={t.key}>
            {t.subs.length > 1 && (
              <Segmented
                className="mb-4"
                size="md"
                value={t.key === activeTop ? activeSub : t.subs[0]!.key}
                onChange={setSub}
                options={t.subs.map((s) => ({ value: s.key, label: s.label }))}
              />
            )}
            {t.key === activeTop && <ActivePanel />}
          </TabsContent>
        ))}
      </Tabs>
    </Page>
  );
}
