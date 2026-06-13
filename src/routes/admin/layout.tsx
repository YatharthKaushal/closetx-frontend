import {
  BarChart3,
  Building2,
  Folder,
  GanttChart,
  Inbox,
  LayoutDashboard,
  Package,
  Receipt,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  Tag,
  Users,
  Wallet,
  Zap,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  SidebarShell,
  filterSidebarGroups,
  type SidebarGroup,
} from '@/components/shell/SidebarShell';
import { RoleGate } from '@/components/shell/RoleGate';
import { api } from '@/lib/api';
import { useAdminBanners } from '@/lib/banner-triggers';
import { useAuth } from '@/lib/auth';

/**
 * Admin sidebar groups. Architecture is built to scale — when a new admin domain ships
 * (compliance, payouts, config, audit, support tickets, etc.) it lands as a new group +
 * items here, and a route in `routes/router.tsx`. Nothing else needs to change.
 *
 * Notes on entries that look "missing":
 * - Storefronts is folded into Retailers (single queue with status filter); store
 *   detail nests under retailer detail.
 * - Brands and Categories are catalog infrastructure listings depend on. They live at
 *   /admin/catalog/{brands,categories} and are reached by direct link from listing
 *   surfaces — not via sidebar.
 */
const GROUPS: SidebarGroup[] = [
  {
    label: 'Operations',
    items: [
      { to: '/admin/dashboard', label: 'Dashboard', end: true, icon: LayoutDashboard },
      {
        to: '/admin/users',
        label: 'Users',
        end: false,
        icon: Users,
        anyAction: ['applications.view', 'consumers.view'],
        activeWhen: (l) =>
          l.pathname.startsWith('/admin/users') ||
          l.pathname.startsWith('/admin/retailers') ||
          l.pathname.startsWith('/admin/consumers'),
      },
      { to: '/admin/stores', label: 'Stores', end: true, icon: Building2, action: 'store_management.view' },
    ],
  },
  {
    label: 'Compliance',
    items: [
      {
        to: '/admin/compliance',
        label: 'KYC',
        end: false,
        icon: ShieldCheck,
        anyAction: ['kyc.review', 'change_requests.view', 'moderation.view', 'applications.view'],
        activeWhen: (l) =>
          l.pathname.startsWith('/admin/compliance') ||
          l.pathname.startsWith('/admin/change-requests') ||
          l.pathname.startsWith('/admin/policy-enforcement') ||
          l.pathname.startsWith('/admin/applications'),
      },
    ],
  },
  {
    label: 'Orders',
    items: [
      { to: '/admin/orders', label: 'All Orders', end: true, icon: Receipt, action: 'orders.view' },
      {
        // Disputes & refunds hub — the dispute queue plus the refunds those
        // disputes trigger, surfaced as tabs under one entry.
        to: '/admin/disputes',
        label: 'Disputes & refunds',
        end: false,
        icon: ShieldAlert,
        anyAction: ['disputes.view', 'refunds.view'],
        activeWhen: (l) =>
          l.pathname.startsWith('/admin/disputes') ||
          l.pathname.startsWith('/admin/refund-reconciliation'),
      },
    ],
  },
  {
    label: 'Payouts',
    items: [
      // Single sidebar entry — the Payouts hub opens straight into its tabs
      // (Payouts / Invoices & GST / Bank matching / Fees). Visible to anyone
      // with access to at least one of those surfaces.
      {
        to: '/admin/money',
        label: 'Payouts',
        end: false,
        icon: Wallet,
        anyAction: [
          'payouts.view',
          'payouts.hold',
          'early_disbursement.decide',
          'wallet_payouts.process',
          'invoicing.numbering.edit',
          'invoicing.gst_returns.generate',
          'refunds.view',
          'platform_config.view',
        ],
        activeWhen: (l) =>
          l.pathname.startsWith('/admin/money') ||
          l.pathname.startsWith('/admin/payouts') ||
          l.pathname.startsWith('/admin/payout-') ||
          l.pathname.startsWith('/admin/early-disbursement') ||
          l.pathname.startsWith('/admin/tail-of-cycle') ||
          l.pathname.startsWith('/admin/wallet-payouts') ||
          l.pathname.startsWith('/admin/billing-console') ||
          l.pathname.startsWith('/admin/invoice-') ||
          l.pathname.startsWith('/admin/gst-returns') ||
          l.pathname.startsWith('/admin/payment-') ||
          l.pathname.startsWith('/admin/fees'),
      },
    ],
  },
  {
    label: 'Promotions',
    items: [
      { to: '/admin/promotions', label: 'Promotions', end: false, icon: Tag, action: 'promotions.view' },
      { to: '/admin/targeted-drops', label: 'Targeted Drops', end: true, icon: Sparkles, action: 'promotions.create' },
    ],
  },
  {
    label: 'Platform',
    items: [
      {
        to: '/admin/platform-rules',
        label: 'Platform rules',
        end: false,
        icon: Sliders,
        anyAction: [
          'clubbing.view',
          'platform_config.edit',
          'platform_config.view',
          'loyalty.view',
          'community.moderate',
          'moderation.view',
        ],
        activeWhen: (l) =>
          l.pathname.startsWith('/admin/platform-rules') ||
          l.pathname.startsWith('/admin/clubbing') ||
          l.pathname.startsWith('/admin/platform/delegation-modes') ||
          l.pathname.startsWith('/admin/delivery-windows') ||
          l.pathname.startsWith('/admin/engagement') ||
          l.pathname.startsWith('/admin/customers') ||
          l.pathname.startsWith('/admin/loyalty') ||
          l.pathname.startsWith('/admin/community-moderation') ||
          l.pathname.startsWith('/admin/reviews-moderation'),
      },
    ],
  },
  {
    label: 'Developer',
    items: [
      {
        to: '/admin/developer',
        label: 'Developer only',
        end: false,
        icon: Zap,
        anyAction: ['simulate.run', 'promotions.view'],
        activeWhen: (l) =>
          l.pathname.startsWith('/admin/developer') ||
          l.pathname.startsWith('/admin/orders/new') ||
          l.pathname.startsWith('/admin/promotion-preview'),
      },
    ],
  },
  {
    label: 'Catalog',
    items: [
      { to: '/admin/listings', label: 'Listings Search', end: true, icon: Package, action: 'moderation.view' },
      { to: '/admin/collections', label: 'Featured Selections', end: false, icon: Folder, action: 'moderation.view' },
      { to: '/admin/catalog-moderation', label: 'Catalog Moderation', end: true, icon: ShieldAlert, action: 'moderation.decide' },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { to: '/admin/reports', label: 'Analytics', end: true, icon: BarChart3, action: 'reports.view' },
    ],
  },
  {
    label: 'Identity',
    items: [
      {
        to: '/admin/identity',
        label: 'Admin Team',
        end: false,
        icon: GanttChart,
        anyAction: ['team.list'],
        activeWhen: (l) =>
          l.pathname.startsWith('/admin/identity') ||
          l.pathname.startsWith('/admin/admins') ||
          l.pathname.startsWith('/admin/sub-roles'),
      },
    ],
  },
  {
    label: 'Inbox',
    items: [
      { to: '/admin/inbox', label: 'Notifications', end: true, icon: Inbox },
    ],
  },
];

export default function AdminLayout() {
  useAdminBanners();
  const permissions = useAuth((s) =>
    s.session?.kind === 'admin' ? s.session.permissions : undefined,
  );
  const setPermissions = useAuth((s) => s.setPermissions);
  // Live-refresh perms on mount so sub-role matrix changes take effect on next
  // nav without forcing sign-out / sign-in.
  useQuery({
    queryKey: ['admin', 'me', 'permissions'],
    queryFn: async () => {
      const res = await api<{ permissions: Record<string, boolean> }>('/admin/me/permissions');
      setPermissions(res.permissions);
      return res.permissions;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnMount: 'always',
  });
  // Pending-dispute badge on the Disputes nav item (polled).
  const counts = useQuery({
    queryKey: ['admin', 'issues-counts'],
    queryFn: () => api<{ pendingDisputes: number; pendingIssues: number }>('/admin/issues-counts'),
    enabled: permissions?.['disputes.view'] === true,
    refetchInterval: 30_000,
  });
  // One Disputes queue now covers every kind, so the badge counts all pending
  // items awaiting admin (former disputes + queries + complaints).
  const pendingTotal = (counts.data?.pendingDisputes ?? 0) + (counts.data?.pendingIssues ?? 0);
  const groupsWithBadges = GROUPS.map((g) => ({
    ...g,
    items: g.items.map((it) =>
      it.to === '/admin/disputes' ? { ...it, badge: pendingTotal } : it,
    ),
  }));
  const visibleGroups = filterSidebarGroups(groupsWithBadges, permissions);
  return (
    <RoleGate kind="admin">
      <SidebarShell
        kindLabel="Admin"
        groups={visibleGroups}
        searchHint="Search pages, retailers, stores…"
        paletteScope="admin"
      />
    </RoleGate>
  );
}
