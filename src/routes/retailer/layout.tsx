import { useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, BarChart3, Bell, Building2, CalendarDays, FileText, LayoutDashboard, Package, Pencil, Receipt, ScanLine, Sparkles, SlidersHorizontal, Tag, Users, Wallet, Warehouse } from 'lucide-react';
import { api } from '@/lib/api';
import {
  SidebarShell,
  filterSidebarGroups,
  type SidebarGroup,
} from '@/components/shell/SidebarShell';
import { RoleGate } from '@/components/shell/RoleGate';
import { AiQuotaChip } from '@/components/shell/AiQuotaChip';
import { ImpersonationBanner } from '@/components/shell/ImpersonationBanner';
import { ComplianceFloorBanner } from '@/components/shell/ComplianceFloorBanner';
import { useRetailerBanners } from '@/lib/banner-triggers';
import { useAuth } from '@/lib/auth';
import type { RetailerProfile, Store } from '@/lib/types';

type MeResponse = { retailer: RetailerProfile; store: Store | null };

/**
 * Storefront sits in the sidebar while the retailer still needs to act on it
 * (pre-submission and during admin review). Once the store is approved, it
 * falls out of the daily workflow and we hide it — "View storefront" remains
 * one click away from the Overview page when needed.
 *
 * Brands link is hidden from the sidebar — retailers reach the brand library
 * inline from the New Listing wizard. Route is still registered for that path.
 */
function buildGroups(store: Store | null): SidebarGroup[] {
  const showStorefront = !store || store.status !== 'active';
  const showOrders = store && (store.status === 'active' || store.status === 'paused');
  return [
    {
      label: 'Workspace',
      items: [
        { to: '/retailer/dashboard', label: 'Overview', end: true, icon: LayoutDashboard },
        { to: '/retailer/store', label: showStorefront ? 'Storefront' : 'Store settings', end: true, icon: Building2, action: 'store.view_profile' },
      ],
    },
    ...(showOrders
      ? [
          {
            label: 'Orders',
            items: [
              { to: '/retailer/orders', label: 'Orders', end: false, icon: Receipt, action: 'orders.view' },
              { to: '/retailer/disputes', label: 'Disputes', end: true, icon: AlertTriangle, action: 'disputes.view' },
            ],
          },
          {
            label: 'Counter',
            items: [
              { to: '/retailer/pos', label: 'Register', end: false, icon: ScanLine, action: 'pos.sell' },
            ],
          },
        ]
      : []),
    {
      label: 'Catalog',
      items: [
        { to: '/retailer/listings', label: 'Products', end: false, icon: Package, action: 'listings.view' },
        { to: '/retailer/inventory', label: 'Inventory', end: true, icon: Warehouse, action: 'inventory.view' },
        { to: '/retailer/pricing', label: 'Pricing', end: true, icon: Tag, action: 'listings.view' },
        { to: '/retailer/attribute-templates', label: 'Attribute templates', end: false, icon: SlidersHorizontal, action: 'attribute_templates.view' },
        { to: '/retailer/ai-catalog', label: 'AI catalog', end: false, icon: Sparkles, action: 'ai_catalog.generate' },
      ],
    },
    {
      label: 'Marketing',
      items: [
        { to: '/retailer/voucher-batch', label: 'Voucher batches', end: true, icon: Tag, action: 'vouchers.view' },
      ],
    },
    {
      label: 'Finance',
      items: [
        // Two top-level items; sub-pages absorbed via tabs on the hub pages.
        // Fees moved into Store settings → KYC. Direct routes (tax-invoices,
        // commission-invoices, billing-statements, payouts/upcoming,
        // early-disbursement) stay registered so cross-links and bookmarks work.
        { to: '/retailer/invoices', label: 'Invoices', end: true, icon: FileText, action: 'invoicing.view' },
        { to: '/retailer/payouts', label: 'Payouts', end: true, icon: Wallet, action: 'payouts.view' },
      ],
    },
    {
      label: 'Analytics',
      items: [
        // Single sidebar entry. The hub holds every report as a chart-first
        // tab; old per-report routes redirect in so bookmarks keep working.
        { to: '/retailer/reports', label: 'Analytics', end: true, icon: BarChart3, action: 'reports.view' },
      ],
    },
    {
      // Consolidated under one heading: store ops, compliance, team, and
      // notifications/holidays/pickup config. These are configure-once items
      // not in the daily flow. Inbox is reachable via the top-bar bell.
      label: 'Settings',
      items: [
        { to: '/retailer/staff', label: 'Staff', end: true, icon: Users, action: 'staff.list' },
        { to: '/retailer/change-requests', label: 'Change requests', end: true, icon: Pencil, action: 'change_requests.view' },
        { to: '/retailer/inbox', label: 'Notifications', end: true, icon: Bell, action: 'notifications.read' },
        { to: '/retailer/holiday-calendar', label: 'Holiday calendar', end: true, icon: CalendarDays, action: 'store.holidays_edit' },
        // Pickup slots hidden for now (route still registered). Uncomment to restore.
        // { to: '/retailer/pickup-slots', label: 'Pickup slots', end: true, icon: CalendarDays, action: 'store.edit_profile' },
      ],
    },
  ];
}

export default function RetailerLayout() {
  // Reuses the same query key as dashboard.tsx — React Query dedups, so this adds
  // no extra network round-trip when both are mounted.
  const { data } = useQuery({
    queryKey: ['retailer', 'me'],
    queryFn: () => api<MeResponse>('/retailer/me'),
  });
  const permissions = useAuth((s) =>
    s.session?.kind === 'retailer' ? s.session.permissions : undefined,
  );
  const setPermissions = useAuth((s) => s.setPermissions);
  // Re-fetch permissions on every layout mount so admin sub-role matrix edits
  // take effect on the next nav without forcing a fresh sign-in. Login flow
  // hydrates these once; this query keeps them current with a 5-minute stale
  // window so we don't hammer the endpoint on tab switches.
  useQuery({
    queryKey: ['retailer', 'me', 'permissions'],
    queryFn: async () => {
      const res = await api<{ permissions: Record<string, boolean> }>('/retailer/me/permissions');
      setPermissions(res.permissions);
      return res.permissions;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnMount: 'always',
  });
  const subRole = useAuth((s) =>
    s.session?.kind === 'retailer' ? s.session.retailer.subRole : undefined,
  );
  const groups = useMemo(() => {
    const built = buildGroups(data?.store ?? null);
    return filterSidebarGroups(built, permissions);
  }, [data?.store, permissions]);
  useRetailerBanners();

  // Delivery agents never use the full store dashboard — bounce them to their
  // focused delivery surface (hooks above still run; this guard is after them).
  if (subRole === 'delivery_agent') {
    return <Navigate to="/retailer/deliveries" replace />;
  }

  return (
    <RoleGate kind="retailer">
      <ImpersonationBanner />
      <ComplianceFloorBanner />
      <SidebarShell
        kindLabel="Retailer"
        groups={groups}
        searchHint="Search pages, products, orders…"
        sidebarFooter={AiQuotaChip}
        paletteScope="retailer"
      />
    </RoleGate>
  );
}
