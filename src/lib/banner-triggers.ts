import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useBannerStack } from '@/lib/banners';
import type { ComplianceFloorRow, KycReverification, Notification, RetailerProfile, Store } from '@/lib/types';

export function useKycBanner() {
  const pushBanner = useBannerStack((s) => s.pushBanner);
  const clearByKind = useBannerStack((s) => s.clearByKind);

  const { data } = useQuery({
    queryKey: ['retailer', 'kyc'],
    queryFn: () => api<KycReverification | null>('/retailer/kyc'),
  });

  useEffect(() => {
    if (!data) {
      clearByKind('kyc');
      return;
    }
    const dueAt = new Date(data.dueAt).getTime();
    const graceEndsAt = new Date(data.gracePeriodEndsAt).getTime();
    const now = Date.now();

    // Approved / submitted: nothing for the retailer to do right now.
    if (data.status === 'approved' || data.status === 'submitted') {
      clearByKind('kyc');
      return;
    }

    const gracePassed = now > graceEndsAt;

    if (gracePassed || data.status === 'overdue') {
      pushBanner({
        id: 'kyc-overdue',
        kind: 'kyc',
        tone: 'danger',
        title: 'KYC re-verification overdue',
        body: 'Your store will auto-pause if documents are not submitted now.',
        cta: { label: 'Open KYC checklist', href: '/retailer/kyc' },
        dismissible: false,
        portal: 'retailer',
      });
      return;
    }

    // Any open pending cycle (admin-triggered or annual) gets a warning.
    if (data.status === 'pending') {
      pushBanner({
        id: 'kyc-due-soon',
        kind: 'kyc',
        tone: 'warning',
        title: 'KYC re-verification required',
        body: `Submit refreshed documents before ${new Date(dueAt).toLocaleDateString()} (grace ends ${new Date(graceEndsAt).toLocaleDateString()}).`,
        cta: { label: 'Open KYC checklist', href: '/retailer/kyc' },
        dismissible: true,
        portal: 'retailer',
      });
      return;
    }
    clearByKind('kyc');
  }, [data, pushBanner, clearByKind]);
}

export function useHolidayBanner() {
  const clearByKind = useBannerStack((s) => s.clearByKind);
  useEffect(() => () => clearByKind('maintenance'), [clearByKind]);
}

export function useOrderSlaBanner() {
  const clearByKind = useBannerStack((s) => s.clearByKind);
  useEffect(() => () => clearByKind('floor_breach'), [clearByKind]);
}

export function useRetailerPayoutBanner() {
  const pushBanner = useBannerStack((s) => s.pushBanner);
  const clearByKind = useBannerStack((s) => s.clearByKind);
  const { data } = useQuery({
    queryKey: ['retailer', 'inbox', 'banner'],
    queryFn: () => api<Notification[]>('/retailer/inbox?limit=50'),
    refetchInterval: 120_000,
  });
  useEffect(() => {
    if (!data) return;
    const failedPayout = data.find((n) => !n.readAt && n.kind === 'payout' && /failed|retried/i.test(n.title));
    if (failedPayout) {
      pushBanner({
        id: 'retailer-payout-failed',
        kind: 'maintenance',
        tone: 'warning',
        title: failedPayout.title,
        body: failedPayout.body,
        cta: { label: 'Open payouts', href: '/retailer/payouts' },
        dismissible: true,
        portal: 'retailer',
      });
    } else {
      clearByKind('maintenance');
    }
  }, [data, pushBanner, clearByKind]);
}

export function useAdminPayoutBanner() {
  const pushBanner = useBannerStack((s) => s.pushBanner);
  const clearByKind = useBannerStack((s) => s.clearByKind);
  const { data } = useQuery({
    queryKey: ['admin', 'inbox', 'banner'],
    queryFn: () => api<Notification[]>('/admin/inbox?limit=50'),
    refetchInterval: 120_000,
  });
  useEffect(() => {
    if (!data) return;
    const failed = data.find((n) => !n.readAt && /failed/i.test(n.title));
    if (failed) {
      pushBanner({
        id: 'admin-failed-payouts',
        kind: 'maintenance',
        tone: 'warning',
        title: failed.title,
        body: failed.body,
        cta: { label: 'Open payouts pipeline', href: '/admin/payouts-pipeline' },
        dismissible: true,
        portal: 'admin',
      });
    } else {
      clearByKind('maintenance');
    }
  }, [data, pushBanner, clearByKind]);
}

export function useAdminDisputeBanner() {
  const pushBanner = useBannerStack((s) => s.pushBanner);
  const clearByKind = useBannerStack((s) => s.clearByKind);
  const { data } = useQuery({
    queryKey: ['admin', 'inbox', 'dispute-banner'],
    queryFn: () => api<Notification[]>('/admin/inbox?limit=50'),
    refetchInterval: 180_000,
  });
  useEffect(() => {
    if (!data) return;
    const idleDisputes = data.find((n) => !n.readAt && n.kind === 'issue');
    if (idleDisputes) {
      pushBanner({
        id: 'admin-disputes-idle',
        kind: 'floor_breach',
        tone: 'info',
        title: idleDisputes.title,
        body: idleDisputes.body,
        cta: { label: 'Triage disputes', href: '/admin/disputes?status=awaiting_admin' },
        dismissible: true,
        portal: 'admin',
      });
    } else {
      clearByKind('floor_breach');
    }
  }, [data, pushBanner, clearByKind]);
}

export function useAdminFloorBreachBanner() {
  const pushBanner = useBannerStack((s) => s.pushBanner);
  const clearByKind = useBannerStack((s) => s.clearByKind);
  const { data } = useQuery({
    queryKey: ['admin', 'reports', 'compliance', 'banner'],
    queryFn: () => api<ComplianceFloorRow[]>('/admin/reports/compliance'),
  });
  useEffect(() => {
    if (!data) return;
    if (data.length > 0) {
      pushBanner({
        id: 'admin-floor-breach',
        kind: 'suspended',
        tone: 'warning',
        title: `${data.length} retailer${data.length === 1 ? '' : 's'} below performance floor`,
        body: 'Issue a warning or suspend the store from the policy enforcement screen.',
        cta: { label: 'Open compliance report', href: '/admin/reports/compliance' },
        dismissible: true,
        portal: 'admin',
      });
    } else {
      clearByKind('suspended');
    }
  }, [data, pushBanner, clearByKind]);
}

export function useAdminBanActivityBanner() {
  useEffect(() => undefined, []);
}

/**
 * Surfaces admin-driven account/store state changes (ban / suspend / pause)
 * as a top-of-screen banner the retailer cannot miss. Hits the same
 * `/retailer/me` payload every layout already polls so this adds no extra
 * round-trip beyond what react-query dedups.
 */
export function useAdminActionBanner() {
  const pushBanner = useBannerStack((s) => s.pushBanner);
  const clearByKind = useBannerStack((s) => s.clearByKind);
  const { data } = useQuery({
    queryKey: ['retailer', 'me'],
    queryFn: () => api<{ retailer: RetailerProfile; store: Store | null }>('/retailer/me'),
    refetchInterval: 60_000,
  });
  useEffect(() => {
    if (!data) return;
    const { retailer, store } = data;
    const accountBanned = Boolean(retailer.permanentSuspend);
    const storeBanned = Boolean(store?.permanentSuspend);
    const suspended = store?.status === 'suspended' && !storeBanned;
    const paused = store?.status === 'paused';

    if (accountBanned || storeBanned) {
      pushBanner({
        id: 'admin-ban',
        kind: 'banned',
        tone: 'danger',
        title: 'Account permanently banned',
        body:
          retailer.suspendReason ??
          store?.suspendReason ??
          'Your account has been banned by Trendzo admin. Contact support to appeal.',
        dismissible: false,
        portal: 'retailer',
      });
      clearByKind('suspended');
      clearByKind('paused_by_admin');
      return;
    }
    clearByKind('banned');

    if (suspended) {
      pushBanner({
        id: 'admin-suspend',
        kind: 'suspended',
        tone: 'danger',
        title: 'Store suspended by admin',
        body: store?.suspendReason ?? 'Fulfilment is paused. Contact Trendzo support.',
        dismissible: false,
        portal: 'retailer',
      });
    } else {
      clearByKind('suspended');
    }

    if (paused) {
      pushBanner({
        id: 'admin-paused',
        kind: 'paused_by_admin',
        tone: 'warning',
        title: 'Store paused',
        body: store?.pauseReason ?? 'Your store is paused.',
        cta: { label: 'Open store settings', href: '/retailer/store' },
        dismissible: true,
        portal: 'retailer',
      });
    } else {
      clearByKind('paused_by_admin');
    }
  }, [data, pushBanner, clearByKind]);
}

/**
 * Composite mount points for layouts. Each clears the other portal's banners
 * on mount so stale cross-portal banners never bleed through.
 */
export function useRetailerBanners() {
  const clearByPortal = useBannerStack((s) => s.clearByPortal);
  useEffect(() => { clearByPortal('admin'); }, [clearByPortal]);
  useKycBanner();
  useHolidayBanner();
  useOrderSlaBanner();
  useRetailerPayoutBanner();
  useAdminActionBanner();
}

export function useAdminBanners() {
  const clearByPortal = useBannerStack((s) => s.clearByPortal);
  useEffect(() => { clearByPortal('retailer'); }, [clearByPortal]);
  useAdminPayoutBanner();
  useAdminDisputeBanner();
  useAdminFloorBreachBanner();
  useAdminBanActivityBanner();
}
