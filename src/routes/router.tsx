import { createBrowserRouter, Navigate, useSearchParams } from 'react-router-dom';
import Landing from './landing';
import AdminLogin from './admin/login';
import AdminLayout from './admin/layout';
import AdminDashboard from './admin/dashboard';
import AdminUsersHub from './admin/users-hub';
import AdminStores from './admin/stores';
import AdminCollections from './admin/collections';
import AdminCollectionDetail from './admin/collection-detail';
import AdminCategories from './admin/categories';
import AdminBrands from './admin/brands';
import RetailerLogin from './retailer/login';
import RetailerLayout from './retailer/layout';
import AgentLayout from './agent/AgentLayout';
import AgentDeliveries from './agent/deliveries';
import AgentDeliveryDetail from './agent/delivery-detail';
import { RoleGate } from '@/components/shell/RoleGate';
import RetailerDashboard from './retailer/dashboard';
import RetailerStorePage, {
  StoreBasicsSection,
  StorePhotosSection,
  StoreHoursSection,
  StoreAddressSection,
  StoreBankSection,
  StoreKycSection,
  StoreStatusSection,
} from './retailer/store';
import RetailerListings from './retailer/listings';
import { ProductWizard } from '@/components/retailer/product-wizard/product-wizard';
import RetailerListingDetail from './retailer/listing-detail';
import RetailerInventory from './retailer/inventory';
import RetailerBrands from './retailer/brands';
import AdminPromotions from './admin/promotions';
import AdminPromotionNew from './admin/promotion-new';
import AdminPromotionDetail from './admin/promotion-detail';
import AdminPlatformRulesHub from './admin/platform-rules-hub';
import AdminConsumerDetail from './admin/consumer-detail';
import RetailerPromotions from './retailer/promotions';
import RetailerPromotionNew from './retailer/promotion-new';
import RetailerPromotionDetail from './retailer/promotion-detail';
import AdminOrdersList from './admin/orders/list';
import AdminDeveloperHub from './admin/developer-hub';
import AdminOrderDetail from './admin/orders/detail';
import RetailerOrdersBoard from './retailer/orders/board';
import RetailerOrdersHistory from './retailer/orders/history';
import PosLayout from './retailer/pos/PosLayout';
import PosRegister from './retailer/pos/register';
import PosSales from './retailer/pos/sales';
import PosSaleDetail from './retailer/pos/sale-detail';
import PosHeld from './retailer/pos/held';
import PosDaySummary from './retailer/pos/day-summary';
import PosLabels from './retailer/pos/labels';
import RetailerOrderDetail from './retailer/orders/detail';
import AdminRefunds from './admin/refunds';
import AdminDisputesHub from './admin/disputes-hub';
import RetailerIssues from './retailer/issues';
import RetailerStaff from './retailer/staff';
import RetailerStaffDetail from './retailer/staff-detail';
import AdminIdentityHub from './admin/identity-hub';
import AdminApplicationsDetail from './admin/applications-detail';
import AdminRetailerDetail from './admin/retailer-detail';
import RetailerApplication from './retailer/application';
import RetailerApplicationStatus from './retailer/application-status';
import RetailerChangeRequests from './retailer/change-requests';
import AdminComplianceHub from './admin/compliance-hub';
import AdminComplianceDetail from './admin/compliance-detail';
import AdminChangeRequestDetail from './admin/change-request-detail';
import AdminDataExports from './admin/data-exports';
import AdminAccountDeletions from './admin/account-deletions';
import AdminCatalogModeration from './admin/catalog-moderation';
import AdminListingDetail from './admin/listing-detail';
import RetailerHolidayCalendar from './retailer/holiday-calendar';
import RetailerNotificationPrefs from './retailer/notification-prefs';
import RetailerInbox from './retailer/inbox';
import RetailerAttributeTemplates from './retailer/attribute-templates';
import RetailerAttributeTemplateEditor from './retailer/attribute-template-editor';
import RetailerAiCatalog from './retailer/ai-catalog';
import RetailerAiCatalogNew from './retailer/ai-catalog-new';
import RetailerAiCatalogReview from './retailer/ai-catalog-review';
import RetailerReturns from './retailer/returns';
import RetailerReturnDetail from './retailer/return-detail';
import RetailerPickupSlots from './retailer/pickup-slots';
import RetailerPricing from './retailer/pricing';
import AdminTargetedDrops from './admin/targeted-drops';
import AdminAnomalyDetail from './admin/anomaly-detail';
import RetailerVoucherBatch from './retailer/voucher-batch';
// §16-§22 (May 2026 frontend realignment)
import RetailerTaxInvoices from './retailer/tax-invoices';
import RetailerTaxInvoiceDetail from './retailer/tax-invoice-detail';
import RetailerCommissionInvoices from './retailer/commission-invoices';
import RetailerInvoices from './retailer/invoices';
import RetailerBillingStatements from './retailer/billing-statements';
import RetailerBillingStatementDetail from './retailer/billing-statement-detail';
import RetailerPayouts from './retailer/payouts';
import RetailerPayoutDetail from './retailer/payout-detail';
import RetailerEarlyDisbursement from './retailer/early-disbursement';
import AdminPayoutDetail from './admin/payout-detail';
import AdminIssueDetail from './admin/issue-detail';
import RetailerIssueDetail from './retailer/issue-detail';
import AdminInbox from './admin/inbox';
import RetailerReportSales from './retailer/report-sales';
import RetailerReportPerformance from './retailer/report-performance';
import RetailerReportReturns from './retailer/report-returns';
import RetailerReportInventory from './retailer/report-inventory';
import RetailerReportSalesDetailed from './retailer/report-sales-detailed';
import RetailerReportRevenueSummary from './retailer/report-revenue-summary';
import RetailerReportListingRevenue from './retailer/report-listing-revenue';
import RetailerReportVariantConversion from './retailer/report-variant-conversion';
import RetailerReportReturnsTop from './retailer/report-returns-top';
import RetailerReportCompliance from './retailer/report-compliance';
import RetailerReportBestSellers from './retailer/report-best-sellers';
import RetailerReportDeadStock from './retailer/report-dead-stock';
import RetailerReportPayoutCycles from './retailer/report-payout-cycles';
import RetailerAnalytics from './retailer/analytics';
import AdminReportLeaderboard from './admin/report-leaderboard';
import AdminReportFunnel from './admin/report-funnel';
import AdminReportFeatureUsage from './admin/report-feature-usage';
import AdminReportOperational from './admin/report-operational';
import AdminReportCompliance from './admin/report-compliance';
import AdminReportHeadline from './admin/report-headline';
import AdminReportsIndex from './admin/reports-index';
import AdminMoney from './admin/money';
import AdminReportBelowFloor from './admin/report-below-floor';
import RetailerPayoutsUpcoming from './retailer/payouts-upcoming';
import AdminRetailerNew from './admin/retailer-new';
import AdminStoreDetail from './admin/store-detail';
import AdminRetailerStaff from './admin/retailer-staff';
import AdminStoreListings from './admin/store-listings';
import AdminListingsSearch from './admin/listings-search';
import AdminStoreInventory from './admin/store-inventory';
import AdminStoreOrders from './admin/store-orders';
import AdminStoreReturns from './admin/store-returns';
import AdminStoreHeldItems from './admin/store-held-items';
import AdminStorePromotions from './admin/store-promotions';
import AdminStoreVoucherBatch from './admin/store-voucher-batch';

/**
 * Redirect a legacy stand-alone Money page to its tab inside the Money hub,
 * preserving any incoming query params (storeId, period, orderId, …) so
 * deep links keep working after the consolidation.
 */
function RedirectToMoneyTab({ tab, sub }: { tab: string; sub?: string }) {
  const [params] = useSearchParams();
  const next = new URLSearchParams(params);
  next.set('tab', tab);
  if (sub) next.set('sub', sub);
  else next.delete('sub');
  return <Navigate to={`/admin/money?${next.toString()}`} replace />;
}

export const router = createBrowserRouter([
  { path: '/', element: <Landing /> },

  // Admin
  { path: '/admin/login', element: <AdminLogin /> },
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      { index: true, element: <Navigate to="dashboard" replace /> },
      { path: 'dashboard', element: <AdminDashboard /> },
      // Users hub — Retailers + Consumers merged behind one entry, URL-synced tabs.
      { path: 'users', element: <AdminUsersHub /> },
      { path: 'retailers', element: <Navigate to="/admin/users?tab=retailers" replace /> },
      { path: 'stores', element: <AdminStores /> },
      { path: 'retailers/new', element: <AdminRetailerNew /> },
      { path: 'retailers/:id', element: <AdminRetailerDetail /> },
      { path: 'retailers/:id/staff', element: <AdminRetailerStaff /> },
      { path: 'retailers/:id/stores/:storeId', element: <AdminStoreDetail /> },
      { path: 'retailers/:id/stores/:storeId/listings', element: <AdminStoreListings /> },
      { path: 'retailers/:id/stores/:storeId/inventory', element: <AdminStoreInventory /> },
      { path: 'retailers/:id/stores/:storeId/orders', element: <AdminStoreOrders /> },
      { path: 'retailers/:id/stores/:storeId/returns', element: <AdminStoreReturns /> },
      { path: 'retailers/:id/stores/:storeId/held-items', element: <AdminStoreHeldItems /> },
      { path: 'retailers/:id/stores/:storeId/promotions', element: <AdminStorePromotions /> },
      { path: 'retailers/:id/stores/:storeId/promotions/:promoId/vouchers', element: <AdminStoreVoucherBatch /> },
      { path: 'applications', element: <Navigate to="/admin/compliance?tab=applications" replace /> },
      { path: 'applications/:id', element: <AdminApplicationsDetail /> },
      { path: 'listings', element: <AdminListingsSearch /> },
      { path: 'collections', element: <AdminCollections /> },
      { path: 'collections/:id', element: <AdminCollectionDetail /> },
      // Catalog infra — listings depend on these as load-bearing data,
      // hidden from sidebar (super-admin reaches them via direct link).
      { path: 'catalog/categories', element: <AdminCategories /> },
      { path: 'catalog/brands', element: <AdminBrands /> },
      { path: 'promotions', element: <AdminPromotions /> },
      { path: 'promotions/new', element: <AdminPromotionNew /> },
      { path: 'promotions/:id', element: <AdminPromotionDetail /> },
      // Platform rules hub — Clubbing matrix + Feature controls.
      { path: 'platform-rules', element: <AdminPlatformRulesHub /> },
      { path: 'clubbing', element: <Navigate to="/admin/platform-rules?tab=clubbing" replace /> },
      // Engagement (Loyalty / Community / Reviews) merged into the Platform rules
      // hub. Old paths — including the dissolved Customers hub — redirect there;
      // consumers moved to the Users hub.
      { path: 'engagement', element: <Navigate to="/admin/platform-rules?tab=loyalty" replace /> },
      { path: 'customers', element: <Navigate to="/admin/platform-rules?tab=loyalty" replace /> },
      { path: 'loyalty', element: <Navigate to="/admin/platform-rules?tab=loyalty" replace /> },
      { path: 'consumers', element: <Navigate to="/admin/users?tab=consumers" replace /> },
      { path: 'consumers/:id', element: <AdminConsumerDetail /> },
      { path: 'promotion-preview', element: <Navigate to="/admin/developer?tab=pricing-simulator" replace /> },
      { path: 'platform/delegation-modes', element: <Navigate to="/admin/platform-rules?tab=feature-controls" replace /> },
      { path: 'orders', element: <AdminOrdersList /> },
      // Developer-only hub — Place test order + Pricing simulator.
      { path: 'developer', element: <AdminDeveloperHub /> },
      { path: 'orders/new', element: <Navigate to="/admin/developer?tab=place-test-order" replace /> },
      { path: 'orders/:id', element: <AdminOrderDetail /> },
      { path: 'refunds', element: <AdminRefunds /> },
      // Disputes & refunds hub — Disputes queue + Refunds, URL-synced tabs.
      { path: 'disputes', element: <AdminDisputesHub /> },
      // Identity hub — Admin team / Sub-roles merged behind one entry.
      { path: 'identity', element: <AdminIdentityHub /> },
      { path: 'admins', element: <Navigate to="/admin/identity?tab=team" replace /> },
      { path: 'sub-roles', element: <Navigate to="/admin/identity?tab=sub-roles" replace /> },
      // Compliance hub — Compliance queue / Change requests / Policy enforcement.
      { path: 'compliance', element: <AdminComplianceHub /> },
      { path: 'compliance/:id', element: <AdminComplianceDetail /> },
      { path: 'change-requests', element: <Navigate to="/admin/compliance?tab=change-requests" replace /> },
      { path: 'change-requests/:id', element: <AdminChangeRequestDetail /> },
      { path: 'policy-enforcement', element: <Navigate to="/admin/compliance?tab=policy" replace /> },
      { path: 'data-exports', element: <AdminDataExports /> },
      { path: 'account-deletions', element: <AdminAccountDeletions /> },
      { path: 'catalog-moderation', element: <AdminCatalogModeration /> },
      { path: 'listings/:id', element: <AdminListingDetail /> },
      { path: 'delivery-windows', element: <Navigate to="/admin/platform-rules?tab=delivery-windows" replace /> },
      { path: 'fees', element: <RedirectToMoneyTab tab="fees" /> },
      { path: 'targeted-drops', element: <AdminTargetedDrops /> },
      { path: 'promotions/anomalies/:id', element: <AdminAnomalyDetail /> },
      { path: 'wallet-payouts', element: <RedirectToMoneyTab tab="payouts" sub="wallet" /> },
      { path: 'payment-reconciliation', element: <RedirectToMoneyTab tab="reconcile" /> },
      { path: 'payment-failures', element: <RedirectToMoneyTab tab="reconcile" sub="failures" /> },
      // §16 Refunds
      { path: 'refund-reconciliation', element: <Navigate to="/admin/disputes?tab=refunds" replace /> },
      { path: 'post-payout-recovery', element: <Navigate to="/admin/disputes?tab=refunds" replace /> },
      // §17 Invoicing
      { path: 'invoice-numbering', element: <RedirectToMoneyTab tab="invoices" sub="numbering" /> },
      { path: 'gst-returns', element: <RedirectToMoneyTab tab="invoices" sub="returns" /> },
      // §18 Settlement / Money hub
      { path: 'money', element: <AdminMoney /> },
      { path: 'billing-console', element: <RedirectToMoneyTab tab="invoices" /> },
      { path: 'payouts-pipeline', element: <RedirectToMoneyTab tab="payouts" /> },
      { path: 'payouts/:id', element: <AdminPayoutDetail /> },
      { path: 'early-disbursement-decisions', element: <RedirectToMoneyTab tab="payouts" sub="early" /> },
      { path: 'tail-of-cycle', element: <RedirectToMoneyTab tab="payouts" sub="leftovers" /> },
      // §19 Disputes
      { path: 'disputes/:id', element: <AdminIssueDetail /> },
      // §20 Customer
      { path: 'community-moderation', element: <Navigate to="/admin/platform-rules?tab=community" replace /> },
      { path: 'reviews-moderation', element: <Navigate to="/admin/platform-rules?tab=reviews" replace /> },
      // §21 Reports
      { path: 'reports', element: <AdminReportsIndex /> },
      { path: 'reports/headline', element: <AdminReportHeadline /> },
      { path: 'reports/leaderboard', element: <AdminReportLeaderboard /> },
      { path: 'reports/funnel', element: <AdminReportFunnel /> },
      { path: 'reports/feature-usage', element: <AdminReportFeatureUsage /> },
      { path: 'reports/operational', element: <AdminReportOperational /> },
      { path: 'reports/compliance', element: <AdminReportCompliance /> },
      { path: 'reports/below-floor', element: <AdminReportBelowFloor /> },
      // §18 admin settlement ops
      { path: 'payout-holds', element: <RedirectToMoneyTab tab="payouts" sub="holds" /> },
      { path: 'payout-adjustments', element: <RedirectToMoneyTab tab="payouts" sub="adjustments" /> },
      { path: 'invoice-ops', element: <RedirectToMoneyTab tab="invoices" sub="fix" /> },
      // §21 Admin drill-into-retailer (reuses retailer pages via useStoreScope)
      { path: 'stores/:storeId/reports/sales-detailed', element: <RetailerReportSalesDetailed /> },
      { path: 'stores/:storeId/reports/revenue-summary', element: <RetailerReportRevenueSummary /> },
      { path: 'stores/:storeId/reports/listings/revenue', element: <RetailerReportListingRevenue /> },
      { path: 'stores/:storeId/reports/listings/conversion', element: <RetailerReportVariantConversion /> },
      { path: 'stores/:storeId/reports/returns/top-listings', element: <RetailerReportReturnsTop /> },
      { path: 'stores/:storeId/reports/compliance', element: <RetailerReportCompliance /> },
      { path: 'stores/:storeId/reports/listings/best-sellers', element: <RetailerReportBestSellers /> },
      { path: 'stores/:storeId/reports/listings/dead-stock', element: <RetailerReportDeadStock /> },
      { path: 'stores/:storeId/reports/payouts/cycles', element: <RetailerReportPayoutCycles /> },
      // §22 Notifications
      { path: 'inbox', element: <AdminInbox /> },
    ],
  },

  // Retailer
  // /retailer/signup retained as alias for backward-compat; both render the
  // doc-aligned Application form (signup.tsx removed during §2 cleanup).
  { path: '/retailer/signup', element: <RetailerApplication /> },
  { path: '/retailer/application', element: <RetailerApplication /> },
  { path: '/retailer/application-status', element: <RetailerApplicationStatus /> },
  { path: '/retailer/login', element: <RetailerLogin /> },
  // Delivery-agent surface — a separate, focused shell mounted at the more-specific
  // /retailer/deliveries path so it doesn't fall under the full retailer dashboard
  // (whose layout bounces delivery agents here). Gated to the delivery_agent sub-role.
  {
    path: '/retailer/deliveries',
    element: (
      <RoleGate kind="retailer" subRole="delivery_agent">
        <AgentLayout />
      </RoleGate>
    ),
    children: [
      { index: true, element: <AgentDeliveries /> },
      { path: ':id', element: <AgentDeliveryDetail /> },
    ],
  },
  // Full-screen POS — its own focused shell (like the agent surface), mounted at the
  // more-specific /retailer/pos path so it escapes the dashboard sidebar chrome. All POS
  // surfaces (register, sales, held, day-summary, labels) live here as internal tabs, so
  // the dashboard sidebar carries just one "Register" entry.
  {
    path: '/retailer/pos',
    element: (
      <RoleGate kind="retailer">
        <PosLayout />
      </RoleGate>
    ),
    children: [
      { index: true, element: <PosRegister /> },
      { path: 'new', element: <Navigate to="/retailer/pos" replace /> }, // back-compat
      { path: 'sales', element: <PosSales /> },
      { path: 'sales/:id', element: <PosSaleDetail /> },
      { path: 'held', element: <PosHeld /> },
      { path: 'day-summary', element: <PosDaySummary /> },
      { path: 'labels', element: <PosLabels /> },
    ],
  },
  {
    path: '/retailer',
    element: <RetailerLayout />,
    children: [
      { index: true, element: <Navigate to="dashboard" replace /> },
      { path: 'dashboard', element: <RetailerDashboard /> },
      {
        path: 'store',
        element: <RetailerStorePage />,
        children: [
          { index: true, element: <StoreBasicsSection /> },
          { path: 'photos', element: <StorePhotosSection /> },
          { path: 'hours', element: <StoreHoursSection /> },
          { path: 'address', element: <StoreAddressSection /> },
          { path: 'bank', element: <StoreBankSection /> },
          { path: 'kyc', element: <StoreKycSection /> },
          { path: 'status', element: <StoreStatusSection /> },
        ],
      },
      { path: 'listings', element: <RetailerListings /> },
      { path: 'listings/new', element: <ProductWizard mode="create" /> },
      { path: 'listings/:id', element: <ProductWizard mode="edit" /> },
      // Secondary management surface (promotions / AI catalog / audit log).
      { path: 'listings/:id/manage', element: <RetailerListingDetail /> },
      { path: 'inventory', element: <RetailerInventory /> },
      { path: 'brands', element: <RetailerBrands /> },
      { path: 'promotions', element: <RetailerPromotions /> },
      { path: 'promotions/new', element: <RetailerPromotionNew /> },
      { path: 'promotions/:id', element: <RetailerPromotionDetail /> },
      { path: 'orders', element: <RetailerOrdersBoard /> },
      { path: 'orders/history', element: <RetailerOrdersHistory /> },
      { path: 'orders/:id', element: <RetailerOrderDetail /> },
      { path: 'disputes', element: <RetailerIssues /> },
      { path: 'staff', element: <RetailerStaff /> },
      { path: 'staff/:id', element: <RetailerStaffDetail /> },
      { path: 'kyc', element: <Navigate to="/retailer/store/kyc" replace /> },
      { path: 'change-requests', element: <RetailerChangeRequests /> },
      { path: 'holiday-calendar', element: <RetailerHolidayCalendar /> },
      { path: 'notification-prefs', element: <RetailerNotificationPrefs /> },
      { path: 'inbox', element: <RetailerInbox /> },
      { path: 'attribute-templates', element: <RetailerAttributeTemplates /> },
      { path: 'attribute-templates/:id', element: <RetailerAttributeTemplateEditor /> },
      { path: 'ai-catalog', element: <RetailerAiCatalog /> },
      { path: 'ai-catalog/new', element: <RetailerAiCatalogNew /> },
      { path: 'ai-catalog/:id', element: <RetailerAiCatalogReview /> },
      { path: 'returns', element: <RetailerReturns /> },
      { path: 'returns/:id', element: <RetailerReturnDetail /> },
      { path: 'pickup-slots', element: <RetailerPickupSlots /> },
      { path: 'pricing', element: <RetailerPricing /> },
      { path: 'fees', element: <Navigate to="/retailer/store/kyc" replace /> },
      { path: 'voucher-batch', element: <RetailerVoucherBatch /> },
      // §17 Invoicing
      { path: 'invoices', element: <RetailerInvoices /> },
      { path: 'tax-invoices', element: <RetailerTaxInvoices /> },
      { path: 'tax-invoices/:id', element: <RetailerTaxInvoiceDetail /> },
      // §18 Settlement
      { path: 'commission-invoices', element: <RetailerCommissionInvoices /> },
      { path: 'billing-statements', element: <RetailerBillingStatements /> },
      { path: 'billing-statements/:id', element: <RetailerBillingStatementDetail /> },
      { path: 'payouts', element: <RetailerPayouts /> },
      { path: 'payouts/:id', element: <RetailerPayoutDetail /> },
      { path: 'early-disbursement', element: <RetailerEarlyDisbursement /> },
      // §19 Disputes
      { path: 'disputes/:id', element: <RetailerIssueDetail /> },
      // §21 Analytics (old Reports). The hub absorbs the 9 card reports;
      // their standalone paths redirect into the matching tab so bookmarks
      // and cross-links keep working.
      { path: 'reports/sales', element: <RetailerReportSales /> },
      { path: 'reports', element: <RetailerAnalytics /> },
      { path: 'reports/performance', element: <RetailerReportPerformance /> },
      { path: 'reports/returns', element: <RetailerReportReturns /> },
      { path: 'reports/inventory-health', element: <RetailerReportInventory /> },
      { path: 'reports/sales-detailed', element: <Navigate to="/retailer/reports?tab=sales&sub=trend" replace /> },
      { path: 'reports/revenue-summary', element: <Navigate to="/retailer/reports" replace /> },
      { path: 'reports/listings/revenue', element: <Navigate to="/retailer/reports?tab=products&sub=revenue" replace /> },
      { path: 'reports/listings/conversion', element: <Navigate to="/retailer/reports?tab=products&sub=conversion" replace /> },
      { path: 'reports/returns/top-listings', element: <Navigate to="/retailer/reports?tab=operations" replace /> },
      { path: 'reports/compliance', element: <Navigate to="/retailer/reports?tab=operations&sub=compliance" replace /> },
      { path: 'reports/listings/best-sellers', element: <Navigate to="/retailer/reports?tab=products" replace /> },
      { path: 'reports/listings/dead-stock', element: <Navigate to="/retailer/reports?tab=products&sub=dead-stock" replace /> },
      { path: 'reports/payouts/cycles', element: <Navigate to="/retailer/reports?tab=operations&sub=payouts" replace /> },
      // §18 upcoming payout
      { path: 'payouts/upcoming', element: <RetailerPayoutsUpcoming /> },
    ],
  },

  { path: '*', element: <Navigate to="/" replace /> },
]);
