import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatAge } from '@/lib/status';
import type { RetailerStaff, RetailerSubRole } from '@/lib/types';
import { Page, PageHeader, SectionHeading } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MetaList } from '@/components/ui/meta-list';
import { CopyableId } from '@/components/ui/copyable-id';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { StaffTempPasswordModal } from '@/components/retailer/staff-temp-password-modal';

const SUB_ROLE_LABEL: Record<RetailerSubRole, string> = {
  owner: 'Owner',
  manager: 'Manager',
  staff: 'Floor staff',
  delivery_agent: 'Delivery agent',
};

export default function RetailerStaffDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const session = useAuth((s) => s.session);
  const currentUser = session?.kind === 'retailer' ? session.retailer : null;
  const currentSubRole = (currentUser as unknown as { subRole?: RetailerSubRole } | null)?.subRole;
  const isOwner = currentSubRole === 'owner';

  const { data, isLoading } = useQuery({
    queryKey: ['retailer', 'staff', id],
    queryFn: () => api<RetailerStaff>(`/retailer/staff/${id}`),
    enabled: Boolean(id),
  });

  const [newSubRole, setNewSubRole] = useState<'manager' | 'staff' | 'delivery_agent'>('staff');

  const changeRole = useMutation({
    mutationFn: (subRole: 'manager' | 'staff' | 'delivery_agent') =>
      api(`/retailer/staff/${id}`, { method: 'PATCH', body: { subRole } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['retailer', 'staff', id] });
      void qc.invalidateQueries({ queryKey: ['retailer', 'staff'] });
      toast.success('Role updated');
    },
    onError: () => toast.error('Failed to update role'),
  });

  const deactivate = useMutation({
    mutationFn: () =>
      api(`/retailer/staff/deactivate/${id}`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Staff member terminated');
      navigate('/retailer/staff');
    },
    onError: () => toast.error('Failed to deactivate'),
  });

  const [confirmReset, setConfirmReset] = useState(false);
  const [tempPasswordShown, setTempPasswordShown] = useState<{ email: string; tempPassword: string } | null>(null);

  const resetPassword = useMutation({
    mutationFn: () =>
      api<{ id: string; tempPassword: string }>(`/retailer/staff/${id}/reset-password`, { method: 'POST' }),
    onSuccess: (res) => {
      if (data) setTempPasswordShown({ email: data.email, tempPassword: res.tempPassword });
      setConfirmReset(false);
      toast.success('Password reset · share the temp password with the staff member');
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed to reset password'),
  });

  return (
    <Page>
      <PageHeader
        kicker="Identity & Access"
        title={data?.legalName ?? 'Staff member'}
        description={data ? `${SUB_ROLE_LABEL[data.subRole]} · ${data.email}` : undefined}
        actions={
          <Button asChild variant="ghost" size="sm" iconLeft={<ArrowLeft className="size-3.5" />}>
            <Link to="/retailer/staff">Back to staff</Link>
          </Button>
        }
      />

      {isLoading ? (
        <Skeleton className="h-40" />
      ) : !data ? (
        <Card><CardContent className="p-6 text-[13px] text-ink-3">Staff member not found.</CardContent></Card>
      ) : (
        <>
          <Card>
            <CardContent className="p-6">
              <MetaList
                cols={2}
                items={[
                  { label: 'Sub-role', value: <Badge tone="info" flat>{SUB_ROLE_LABEL[data.subRole]}</Badge> },
                  { label: 'Status', value: <Badge tone={data.status === 'active' ? 'success' : 'neutral'}>{data.status.replace(/_/g, ' ')}</Badge> },
                  { label: 'Email', value: data.email },
                  { label: 'Phone', value: data.phone },
                  { label: 'Joined', value: formatAge(data.createdAt) },
                  { label: 'Identifier', value: <CopyableId value={data.id} label="staff id" />, mono: true },
                ]}
              />
            </CardContent>
          </Card>

          {isOwner && data.subRole !== 'owner' && (
            <>
              <div className="mt-6">
                <SectionHeading title="Change role" />
                <Card>
                  <CardContent className="p-4 flex items-end gap-3">
                    <div className="flex-1 space-y-1.5">
                      <span className="text-[12px] text-ink-3">New role</span>
                      <Select
                        value={newSubRole}
                        onValueChange={(v) => setNewSubRole(v as 'manager' | 'staff' | 'delivery_agent')}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="staff">Floor staff</SelectItem>
                          <SelectItem value="delivery_agent">Delivery agent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      onClick={() => {
                        if (!window.confirm(`Change role to ${SUB_ROLE_LABEL[newSubRole]}?`)) return;
                        changeRole.mutate(newSubRole);
                      }}
                      loading={changeRole.isPending}
                    >
                      Change role
                    </Button>
                  </CardContent>
                </Card>
              </div>

              <div className="mt-6">
                <SectionHeading title="Account actions" />
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    iconLeft={<KeyRound className="size-3.5" />}
                    onClick={() => setConfirmReset(true)}
                  >
                    Force-reset password
                  </Button>
                  {currentUser?.id !== id && (
                    <Button
                      variant="danger"
                      loading={deactivate.isPending}
                      onClick={() => {
                        if (!window.confirm('Deactivate this staff member? They will no longer be able to sign in.')) return;
                        deactivate.mutate();
                      }}
                    >
                      Deactivate member
                    </Button>
                  )}
                </div>
              </div>

              <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Force-reset password?</DialogTitle>
                    <DialogDescription>
                      Generates a fresh temporary password for{' '}
                      <span className="font-medium text-ink">{data.email}</span>. The current
                      password is invalidated immediately. You'll see the new password once;
                      hand it to them in person.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setConfirmReset(false)}>Cancel</Button>
                    <Button variant="ink" loading={resetPassword.isPending} onClick={() => resetPassword.mutate()}>
                      Generate temp password
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <StaffTempPasswordModal
                info={tempPasswordShown}
                onClose={() => setTempPasswordShown(null)}
              />
            </>
          )}
        </>
      )}
    </Page>
  );
}
