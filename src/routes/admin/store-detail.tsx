import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ArrowUpRight,
  Boxes,
  ChevronDown,
  CircleDot,
  Coins,
  CalendarClock,
  Package,
  PackageX,
  Pencil,
  ShoppingCart,
  ShieldAlert,
  Tag,
  Undo2,
  Users,
  X,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Page, PageHeader, SectionHeading } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { CopyableId } from '@/components/ui/copyable-id';
import { ReasonActionDialog } from '@/components/admin/reason-action-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AccountsOnStoreCard } from '@/components/admin/accounts-on-store-card';
import { PermissionGate } from '@/components/shell/PermissionGate';
import { cn } from '@/lib/cn';

interface AdminStoreView {
  id: string;
  legalEntityId: string;
  legalName: string;
  gstin: string;
  address: string;
  stateCode: string;
  status: string;
  permanentSuspend?: boolean;
  suspendReason?: string | null;
  contactPhone?: string | null;
  managerName?: string | null;
  platformFeeBp: number;
  payoutCadenceDays: number;
  pauseVisibility?: 'visible' | 'hidden' | null;
  pauseReason?: string | null;
  pauseUntil?: string | null;
  createdAt: string;
}

type EditDraft = {
  legalName: string;
  address: string;
  stateCode: string;
  contactPhone: string;
  managerName: string;
  platformFeeBp: number;
  payoutCadenceDays: number;
  /** §12 F3a — required when platformFeeBp changes. Recorded on the audit row. */
  platformFeeReason: string;
};

type StatusTone = 'success' | 'warning' | 'danger' | 'neutral';

export default function AdminStoreDetail() {
  const { id: retailerId, storeId } = useParams<{ id: string; storeId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const TAB_KEYS = ['overview', 'compliance', 'accounts', 'operations'] as const;
  type TabKey = (typeof TAB_KEYS)[number];
  function parseTab(v: string | null): TabKey {
    return TAB_KEYS.includes(v as TabKey) ? (v as TabKey) : 'overview';
  }
  const activeTab = parseTab(searchParams.get('tab'));
  function setActiveTab(v: string) {
    const next = parseTab(v);
    setSearchParams(
      (prev) => {
        const sp = new URLSearchParams(prev);
        if (next === 'overview') sp.delete('tab');
        else sp.set('tab', next);
        return sp;
      },
      { replace: true },
    );
  }
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<null | 'pause' | 'suspend' | 'terminate' | 'reverify'>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<EditDraft | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'stores', storeId],
    queryFn: () => api<AdminStoreView>(`/admin/stores/${storeId!}`),
    enabled: Boolean(storeId),
  });

  // Accounts count drives a KPI tile + a deep-link button — fetched here so the
  // card and the headline number stay in sync, since the AccountsOnStoreCard
  // query is keyed identically and shares the React-Query cache.
  const accountsQ = useQuery({
    queryKey: ['admin', 'retailers', retailerId, 'staff'],
    queryFn: () => api<Array<{ id: string; subRole: string; status: string }>>(`/admin/retailers/${retailerId}/staff`),
    enabled: Boolean(retailerId),
  });

  const action = useMutation({
    mutationFn: ({ verb, reason }: { verb: 'pause' | 'resume' | 'suspend' | 'unsuspend' | 'ban' | 'unban'; reason?: string }) =>
      api(`/admin/stores/${storeId}/${verb}`, { method: 'POST', body: reason ? { reason } : {} }),
    onSuccess: (_d, vars) => {
      toast.success(`Store ${vars.verb}`);
      setDialog(null);
      void qc.invalidateQueries({ queryKey: ['admin', 'stores'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Action failed'),
  });

  const reverifyMut = useMutation({
    mutationFn: (reason: string) =>
      api<{ cycleId: string; storeId: string }>(
        `/admin/compliance/stores/${storeId}/reverify`,
        { method: 'POST', body: { reason } },
      ),
    onSuccess: () => {
      toast.success('KYC re-verification opened · retailer will see the banner');
      setDialog(null);
      void qc.invalidateQueries({ queryKey: ['admin', 'compliance', 'kyc'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'stores', storeId] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Re-KYC failed'),
  });

  const saveMut = useMutation({
    mutationFn: (d: EditDraft) => {
      const feeChanged = data && d.platformFeeBp !== data.platformFeeBp;
      return api(`/admin/stores/${storeId}`, {
        method: 'PATCH',
        body: {
          storeName: d.legalName,
          address: d.address,
          stateCode: d.stateCode,
          contactPhone: d.contactPhone || null,
          managerName: d.managerName || null,
          platformFeeBp: d.platformFeeBp,
          payoutCadenceDays: d.payoutCadenceDays,
          ...(feeChanged ? { platformFeeReason: d.platformFeeReason } : {}),
        },
      });
    },
    onSuccess: () => {
      toast.success('Store profile updated');
      setEditing(false);
      setDraft(null);
      void qc.invalidateQueries({ queryKey: ['admin', 'stores', storeId] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Save failed'),
  });

  if (!storeId) return <Page><PageHeader title="Missing storeId" /></Page>;
  if (isLoading) {
    return (
      <Page>
        <Skeleton className="h-24 mb-4" />
        <div className="grid grid-cols-4 gap-3 mb-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}
        </div>
        <Skeleton className="h-64" />
      </Page>
    );
  }
  if (isError || !data) {
    return (
      <Page>
        <PageHeader title="Store not found" actions={
          <Button variant="outline" onClick={() => void refetch()}>Retry</Button>
        } />
      </Page>
    );
  }

  const s = data;
  const tone: StatusTone =
    s.permanentSuspend ? 'danger'
    : s.status === 'active' ? 'success'
    : s.status === 'paused' ? 'warning'
    : s.status === 'suspended' ? 'danger'
    : 'neutral';
  const statusLabel = s.status === 'terminated' || s.permanentSuspend ? 'terminated' : s.status;
  const accountsCount = accountsQ.data?.length ?? 0;
  const activeStaffCount = (accountsQ.data ?? []).filter((a) => a.status === 'active').length;

  function startEdit() {
    setDraft({
      legalName: s.legalName,
      address: s.address,
      stateCode: s.stateCode,
      contactPhone: s.contactPhone ?? '',
      managerName: s.managerName ?? '',
      platformFeeBp: s.platformFeeBp,
      platformFeeReason: '',
      payoutCadenceDays: s.payoutCadenceDays,
    });
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setDraft(null);
  }

  return (
    <Page>
      <PageHeader
        kicker="Store"
        title={
          <span className="flex items-center gap-3 flex-wrap">
            <span>{s.legalName}</span>
            <Badge tone={tone as never}>
              <CircleDot className="size-3" /> {statusLabel}
            </Badge>
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink-3">
            <CopyableId value={s.id} label="store id" />
            <span className="text-ink-4">·</span>
            <span className="font-mono">{s.gstin}</span>
            <span className="text-ink-4">·</span>
            <span>{s.address}, {s.stateCode}</span>
            <span className="text-ink-4">·</span>
            <span>created {new Date(s.createdAt).toLocaleDateString()}</span>
          </span>
        }
        actions={
          <Button asChild variant="ghost" size="sm" iconLeft={<ArrowLeft className="size-3.5" />}>
            <Link to={`/admin/retailers/${retailerId}`}>Back to retailer</Link>
          </Button>
        }
      />

      {/* KPI strip — one-glance store health.
          Numbers in tabular so columns line up across tiles. */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiTile
          icon={<Coins className="size-3.5" />}
          label="Platform fee"
          value={`${(s.platformFeeBp / 100).toFixed(2)}%`}
        />
        <KpiTile
          icon={<CalendarClock className="size-3.5" />}
          label="Pays out"
          value={`every ${s.payoutCadenceDays}d`}
        />
        <KpiTile
          icon={<Users className="size-3.5" />}
          label="Accounts"
          value={accountsCount.toString()}
          hint={`${activeStaffCount} active`}
        />
        <KpiTile
          icon={<CircleDot className="size-3.5" />}
          label="Lifecycle"
          value={statusLabel}
          tone={tone}
        />
      </div>

      {/* Action ribbon — full-width row of lifecycle controls. Keeps Pause/Suspend/
          Terminate one click away regardless of where the operator is on the page,
          rather than tucking them at the bottom of a profile card. */}
      <Card className="mb-5">
        <CardContent className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-[12.5px] text-ink-3">
            {s.status === 'active' && 'Store is fulfilling orders. Pause briefly for downtime, suspend to block until policy review, terminate to end the relationship.'}
            {s.status === 'paused' && (
              <>
                <span className="text-warning font-medium">Paused.</span>{' '}
                {s.pauseReason ?? 'No reason recorded'}
                {s.pauseVisibility === 'hidden' && ' · hidden from consumer catalog'}
              </>
            )}
            {s.status === 'suspended' && !s.permanentSuspend && (
              <>
                <span className="text-danger font-medium">Suspended.</span>{' '}
                {s.suspendReason ?? 'No reason recorded'}
              </>
            )}
            {s.permanentSuspend && (
              <>
                <span className="text-danger font-medium">Terminated.</span>{' '}
                {s.suspendReason ?? 'No reason recorded'}
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {s.status === 'active' && (
              <>
                <PermissionGate action="store_management.edit">
                  <Button variant="ink" size="sm" onClick={() => setDialog('pause')}>
                    Pause
                  </Button>
                </PermissionGate>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" iconRight={<ChevronDown className="size-3.5" />}>
                      More
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onSelect={() => setDialog('suspend')}>
                      <ShieldAlert className="size-3.5 text-warning" />
                      Suspend store
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setDialog('terminate')}>
                      <X className="size-3.5 text-danger" />
                      Terminate store
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
            {s.status === 'paused' && (
              <PermissionGate action="store_management.edit">
                <Button variant="ink" size="sm" onClick={() => action.mutate({ verb: 'resume' })}>
                  Resume store
                </Button>
              </PermissionGate>
            )}
            {s.status === 'suspended' && !s.permanentSuspend && (
              <PermissionGate action="retailer.reinstate">
                <Button variant="ink" size="sm" onClick={() => action.mutate({ verb: 'unsuspend' })}>
                  Lift suspension
                </Button>
              </PermissionGate>
            )}
            {s.permanentSuspend && (
              <PermissionGate action="retailer.reinstate">
                <Button variant="ink" size="sm" onClick={() => action.mutate({ verb: 'unban' })}>
                  Reinstate store
                </Button>
              </PermissionGate>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="operations">Operations</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardContent className="p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <SectionHeading kicker="Identity" title="Profile" />
                {!editing && (
                  <PermissionGate action="store_management.edit">
                    <Button
                      variant="outline"
                      size="sm"
                      iconLeft={<Pencil className="size-3" />}
                      onClick={startEdit}
                    >
                      Edit
                    </Button>
                  </PermissionGate>
                )}
              </div>

              {editing && draft ? (
                <EditForm
                  draft={draft}
                  gstin={s.gstin}
                  serverPlatformFeeBp={s.platformFeeBp}
                  onChange={setDraft}
                  onCancel={cancelEdit}
                  onSave={() => {
                    if (!draft) return;
                    const feeChanged = draft.platformFeeBp !== s.platformFeeBp;
                    if (feeChanged && draft.platformFeeReason.trim().length < 3) {
                      toast.error('Reason (≥3 chars) is required when changing the platform fee.');
                      return;
                    }
                    saveMut.mutate(draft);
                  }}
                  saving={saveMut.isPending}
                />
              ) : (
                <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                  <ProfileRow label="Legal name" value={s.legalName} />
                  <ProfileRow label="GSTIN" value={s.gstin} mono />
                  <ProfileRow label="Address" value={s.address} />
                  <ProfileRow label="State" value={s.stateCode} mono />
                  <ProfileRow label="Contact phone" value={s.contactPhone ?? '—'} mono />
                  <ProfileRow label="Manager" value={s.managerName ?? '—'} />
                </dl>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compliance">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-2">
                <SectionHeading kicker="Risk" title="Compliance" />
                <PermissionGate action="kyc.review">
                  <Button
                    variant="outline"
                    size="sm"
                    iconLeft={<ShieldAlert className="size-3.5" />}
                    onClick={() => setDialog('reverify')}
                  >
                    Ask for KYC again
                  </Button>
                </PermissionGate>
              </div>
              <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                <ProfileRow
                  label="Pause reason"
                  value={s.pauseReason ?? '—'}
                  tone={s.pauseReason ? 'warning' : 'neutral'}
                />
                <ProfileRow
                  label="Pause mode"
                  value={
                    s.status === 'paused'
                      ? s.pauseVisibility === 'hidden' ? 'Hidden from catalog' : 'Blocking new orders'
                      : '—'
                  }
                />
                <ProfileRow
                  label="Suspend reason"
                  value={s.suspendReason ?? '—'}
                  tone={s.suspendReason ? 'danger' : 'neutral'}
                />
                <ProfileRow
                  label="Permanent ban"
                  value={s.permanentSuspend ? 'Yes' : 'No'}
                  tone={s.permanentSuspend ? 'danger' : 'neutral'}
                />
                <ProfileRow
                  label="Pause until"
                  value={s.pauseUntil ? new Date(s.pauseUntil).toLocaleString() : '—'}
                />
              </dl>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="accounts">
          {retailerId && <AccountsOnStoreCard retailerId={retailerId} />}
        </TabsContent>

        <TabsContent value="operations">
          <div>
            <SectionHeading kicker="Operations" title="Manage this store" />
            <p className="mt-1 text-[12.5px] text-ink-3">
              Each entry deep-links into the admin operator view scoped to this store.
            </p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <OpsTile icon={Package}     label="Listings"   href={`/admin/retailers/${retailerId}/stores/${storeId}/listings`} />
            <OpsTile icon={Boxes}       label="Inventory"  href={`/admin/retailers/${retailerId}/stores/${storeId}/inventory`} />
            <OpsTile icon={ShoppingCart} label="Orders"    href={`/admin/retailers/${retailerId}/stores/${storeId}/orders`} />
            <OpsTile icon={Undo2}       label="Returns"    href={`/admin/retailers/${retailerId}/stores/${storeId}/returns`} />
            <OpsTile icon={PackageX}    label="Held items" href={`/admin/retailers/${retailerId}/stores/${storeId}/held-items`} />
            <OpsTile icon={Tag}         label="Promotions" href={`/admin/retailers/${retailerId}/stores/${storeId}/promotions`} />
          </div>
        </TabsContent>
      </Tabs>

      <ReasonActionDialog
        open={dialog === 'pause'}
        title="Pause store"
        description="Pauses fulfilment temporarily. You can resume from this screen at any time."
        confirmLabel="Pause"
        onClose={() => setDialog(null)}
        onConfirm={(reason) => action.mutate({ verb: 'pause', reason })}
        loading={action.isPending}
      />
      <ReasonActionDialog
        open={dialog === 'suspend'}
        title="Suspend store"
        description="Temporary admin block. Retailer sees a banner and inbox message. Lift at any time."
        confirmLabel="Suspend"
        onClose={() => setDialog(null)}
        onConfirm={(reason) => action.mutate({ verb: 'suspend', reason })}
        loading={action.isPending}
      />
      <ReasonActionDialog
        open={dialog === 'terminate'}
        title="Terminate store"
        description="Permanently ends the relationship with this store. The retailer is signed out and barred. Can only be reversed by an admin with reinstate permission."
        confirmLabel="Terminate"
        danger
        onClose={() => setDialog(null)}
        onConfirm={(reason) => action.mutate({ verb: 'ban', reason })}
        loading={action.isPending}
      />
      <ReasonActionDialog
        open={dialog === 'reverify'}
        title="Trigger re-KYC"
        description="Opens a fresh 14-day KYC re-verification cycle for this store. The retailer sees a banner + KYC page until they re-upload the 5 required documents. Reason is recorded in the audit log."
        confirmLabel="Trigger re-KYC"
        onClose={() => setDialog(null)}
        onConfirm={(reason) => reverifyMut.mutate(reason)}
        loading={reverifyMut.isPending}
      />
    </Page>
  );
}

function KpiTile({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: StatusTone;
}) {
  const toneCls =
    tone === 'success'
      ? 'border-success/30 bg-success-soft/40'
      : tone === 'warning'
        ? 'border-warning/30 bg-warning-soft/40'
        : tone === 'danger'
          ? 'border-danger/30 bg-danger/5'
          : 'border-line bg-bg';
  const valueCls =
    tone === 'success' ? 'text-success-strong'
    : tone === 'warning' ? 'text-warning'
    : tone === 'danger' ? 'text-danger'
    : 'text-ink';

  return (
    <div className={cn('rounded-lg border px-3 py-2.5', toneCls)}>
      <div className="flex items-center gap-1.5 text-ink-3">
        {icon}
        <span className="kicker">{label}</span>
      </div>
      <div className={cn('mt-1 font-mono tabular-nums text-[20px] leading-none capitalize', valueCls)}>
        {value}
      </div>
      {hint && <div className="mt-1 text-[11.5px] text-ink-3">{hint}</div>}
    </div>
  );
}

function ProfileRow({
  label,
  value,
  mono,
  tone,
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: StatusTone;
}) {
  return (
    <div>
      <dt className="kicker">{label}</dt>
      <dd
        className={cn(
          'mt-0.5 text-[13px] text-ink',
          mono && 'font-mono',
          tone === 'warning' && 'text-warning',
          tone === 'danger' && 'text-danger',
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function OpsTile({
  icon: Icon,
  label,
  href,
}: {
  icon: typeof Package;
  label: string;
  href: string;
}) {
  return (
    <Link
      to={href}
      className="group flex items-center justify-between gap-2 rounded-lg border border-line bg-bg px-3 py-3 transition-colors hover:border-line-2 hover:bg-bg-2/60"
    >
      <span className="flex items-center gap-2">
        <span className="rounded-md border border-line bg-bg-2 p-1.5">
          <Icon className="size-3.5 text-ink-2" />
        </span>
        <span className="text-[13px] font-medium text-ink">{label}</span>
      </span>
      <ArrowUpRight className="size-3.5 text-ink-3 transition-colors group-hover:text-ink" />
    </Link>
  );
}

function EditForm({
  draft,
  gstin,
  serverPlatformFeeBp,
  onChange,
  onCancel,
  onSave,
  saving,
}: {
  draft: EditDraft;
  gstin: string;
  serverPlatformFeeBp: number;
  onChange: (updater: (d: EditDraft | null) => EditDraft | null) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  const feeChanged = draft.platformFeeBp !== serverPlatformFeeBp;
  return (
    <>
      <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="ed-name">Legal name</Label>
          <Input
            id="ed-name"
            value={draft.legalName}
            onChange={(e) => onChange((d) => (d ? { ...d, legalName: e.target.value } : d))}
          />
        </div>
        <div>
          <Label>
            GSTIN
            <span className="ml-1.5 text-[11px] font-normal text-ink-3">(KYC-protected, change via request)</span>
          </Label>
          <p className="mt-1 rounded-md border border-line bg-bg-3 px-3 py-[7px] font-mono text-[13px] text-ink-3 select-none">
            {gstin}
          </p>
        </div>
        <div>
          <Label htmlFor="ed-address">Address</Label>
          <Input
            id="ed-address"
            value={draft.address}
            onChange={(e) => onChange((d) => (d ? { ...d, address: e.target.value } : d))}
          />
        </div>
        <div>
          <Label htmlFor="ed-state">State code</Label>
          <Input
            id="ed-state"
            value={draft.stateCode}
            maxLength={3}
            placeholder="e.g. MH"
            onChange={(e) => onChange((d) => (d ? { ...d, stateCode: e.target.value.toUpperCase() } : d))}
          />
        </div>
        <div>
          <Label htmlFor="ed-phone">Contact phone</Label>
          <Input
            id="ed-phone"
            value={draft.contactPhone}
            placeholder="9876543210"
            onChange={(e) => onChange((d) => (d ? { ...d, contactPhone: e.target.value } : d))}
          />
        </div>
        <div>
          <Label htmlFor="ed-manager">Manager name</Label>
          <Input
            id="ed-manager"
            value={draft.managerName}
            placeholder="Ramesh Patel"
            onChange={(e) => onChange((d) => (d ? { ...d, managerName: e.target.value } : d))}
          />
        </div>
        <div>
          <Label htmlFor="ed-fee">Platform fee (%)</Label>
          <Input
            id="ed-fee"
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={draft.platformFeeBp / 100}
            onChange={(e) => {
              const pct = parseFloat(e.target.value);
              if (!isNaN(pct)) onChange((d) => (d ? { ...d, platformFeeBp: Math.round(pct * 100) } : d));
            }}
          />
          {feeChanged && (
            <div className="mt-2">
              <Label htmlFor="ed-fee-reason">Reason for override</Label>
              <textarea
                id="ed-fee-reason"
                rows={2}
                maxLength={500}
                placeholder="e.g. launch promo for Q3"
                value={draft.platformFeeReason}
                onChange={(e) =>
                  onChange((d) => (d ? { ...d, platformFeeReason: e.target.value } : d))
                }
                className="mt-1 w-full rounded border border-line-2 bg-bg px-2 py-1 text-[13px]"
              />
              <p className="mt-1 text-[11px] text-ink-4">
                Recorded on the audit row; retailer accounts get an inbox notification.
              </p>
            </div>
          )}
        </div>
        <div>
          <Label htmlFor="ed-payout">Payout cadence (days)</Label>
          <Input
            id="ed-payout"
            type="number"
            min="1"
            max="30"
            value={draft.payoutCadenceDays}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (!isNaN(v)) onChange((d) => (d ? { ...d, payoutCadenceDays: v } : d));
            }}
          />
        </div>
      </div>

      <div className="mt-6 flex gap-2">
        <Button variant="ink" loading={saving} onClick={onSave}>
          Save changes
        </Button>
        <Button variant="outline" iconLeft={<X className="size-3.5" />} onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </>
  );
}
