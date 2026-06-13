import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, Eye, EyeOff, KeyRound, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatAge } from '@/lib/status';
import type { RetailerStaff, RetailerSubRole } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { CopyableId } from '@/components/ui/copyable-id';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StaffTempPasswordModal } from '@/components/retailer/staff-temp-password-modal';

const SUB_ROLE_LABEL: Record<RetailerSubRole, string> = {
  owner: 'Owner',
  manager: 'Manager',
  staff: 'Floor staff',
  delivery_agent: 'Delivery agent',
};

export default function RetailerStaffPage() {
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<RetailerStaff | null>(null);
  const [tempPasswordShown, setTempPasswordShown] = useState<{ email: string; tempPassword: string } | null>(null);
  const queryClient = useQueryClient();
  // Only owners can call /retailer/staff/:id/reset-password (staff.reset_password
  // permission). Hide the button otherwise rather than letting the user discover
  // a 403 at click time.
  const session = useAuth((s) => s.session);
  const subRole = session?.kind === 'retailer'
    ? (session.retailer as unknown as { subRole?: RetailerSubRole } | null)?.subRole
    : undefined;
  const canResetPasswords = subRole === 'owner';

  const staffQuery = useQuery({
    queryKey: ['retailer', 'staff'],
    queryFn: () => api<RetailerStaff[]>('/retailer/staff'),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => api(`/retailer/staff/deactivate/${id}`, { method: 'POST' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['retailer', 'staff'] });
      toast.success('Staff member terminated');
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed to deactivate'),
  });

  const reactivateMutation = useMutation({
    mutationFn: (id: string) => api(`/retailer/staff/reactivate/${id}`, { method: 'POST' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['retailer', 'staff'] });
      toast.success('Staff member reactivated');
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed to reactivate'),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (id: string) =>
      api<{ id: string; tempPassword: string }>(`/retailer/staff/${id}/reset-password`, { method: 'POST' }),
    onSuccess: (res) => {
      if (resetTarget) {
        setTempPasswordShown({ email: resetTarget.email, tempPassword: res.tempPassword });
      }
      setResetTarget(null);
      toast.success('Password reset · hand the temp password to the staff member');
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed to reset password'),
  });

  const visible = useMemo(() => {
    const list = staffQuery.data ?? [];
    if (filter === 'all') return list;
    if (filter === 'active') return list.filter((s) => s.status === 'active');
    return list.filter((s) => s.status !== 'active');
  }, [staffQuery.data, filter]);

  return (
    <Page>
      <PageHeader
        kicker="Identity & Access"
        title="Staff"
        description="Owner manages the people who can sign in to this store. Sub-role controls what each member can do."
        actions={
          <Button
            iconLeft={<UserPlus className="size-3.5" />}
            onClick={() => setInviteOpen(true)}
          >
            Add staff
          </Button>
        }
      />

      <div className="mb-4 flex items-center gap-1.5">
        {(['all', 'active', 'inactive'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={
              'rounded-full border px-3 py-1 text-[12px] capitalize transition-colors ' +
              (filter === f
                ? 'border-ink bg-ink text-bg'
                : 'border-line bg-bg text-ink-2 hover:border-line-2')
            }
          >
            {f}
          </button>
        ))}
        <span className="ml-auto text-[12px] text-ink-3">{visible.length} member{visible.length === 1 ? '' : 's'}</span>
      </div>

      {staffQuery.isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : visible.length === 0 ? (
        <Empty kicker="No members" title="No staff match this filter." />
      ) : (
        <ul className="space-y-2">
          {visible.map((s) => (
            <Card key={s.id}>
              <CardContent className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[14px] font-medium text-ink">{s.legalName}</span>
                    <Badge tone={s.status === 'active' ? 'success' : 'neutral'}>
                      {s.status === 'active' ? 'Active' : s.status.replace(/_/g, ' ')}
                    </Badge>
                    <Badge tone="info" flat>
                      {SUB_ROLE_LABEL[s.subRole]}
                    </Badge>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[12px] text-ink-3">
                    <span>{s.email}</span>
                    <span>·</span>
                    <CopyableId value={s.id} label="staff id" />
                  </div>
                  <div className="mt-1 text-[11.5px] text-ink-4">
                    Joined {formatAge(s.createdAt)}
                  </div>
                </div>
                {canResetPasswords && s.subRole !== 'owner' && s.status === 'active' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    iconLeft={<KeyRound className="size-3.5" />}
                    onClick={() => setResetTarget(s)}
                  >
                    Reset password
                  </Button>
                )}
                {s.subRole !== 'owner' && s.status === 'active' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={deactivateMutation.isPending && deactivateMutation.variables === s.id}
                    onClick={() => {
                      if (!window.confirm(`Deactivate ${s.legalName}? They will lose access immediately.`)) return;
                      deactivateMutation.mutate(s.id);
                    }}
                  >
                    Deactivate
                  </Button>
                )}
                {s.subRole !== 'owner' && s.status === 'terminated' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={reactivateMutation.isPending && reactivateMutation.variables === s.id}
                    onClick={() => reactivateMutation.mutate(s.id)}
                  >
                    Reactivate
                  </Button>
                )}
                <Button asChild variant="ghost" size="sm" iconRight={<ArrowUpRight className="size-3" />}>
                  <Link to={`/retailer/staff/${s.id}`}>Open</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </ul>
      )}
      <AddStaffDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onDone={() => void queryClient.invalidateQueries({ queryKey: ['retailer', 'staff'] })}
      />

      <Dialog open={resetTarget !== null} onOpenChange={(o) => { if (!o) setResetTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Force-reset password?</DialogTitle>
            <DialogDescription>
              Generates a fresh temporary password for{' '}
              <span className="font-medium text-ink">{resetTarget?.email ?? ''}</span>. Their current
              password stops working immediately. You'll see the new password once — hand it to them
              in person and tell them to change it after signing in.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResetTarget(null)}>Cancel</Button>
            <Button
              variant="ink"
              loading={resetPasswordMutation.isPending}
              onClick={() => resetTarget && resetPasswordMutation.mutate(resetTarget.id)}
            >
              Generate temp password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <StaffTempPasswordModal
        info={tempPasswordShown}
        onClose={() => setTempPasswordShown(null)}
      />
    </Page>
  );
}

function AddStaffDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; onDone: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [subRole, setSubRole] = useState<'manager' | 'staff' | 'delivery_agent'>('staff');

  function reset() { setName(''); setEmail(''); setPassword(''); setSubRole('staff'); }

  const create = useMutation({
    mutationFn: () =>
      api('/retailer/staff/create', { method: 'POST', body: { legalName: name.trim(), email, password, subRole } }),
    onSuccess: () => {
      toast.success(`${name.trim()} added — they can now log in`);
      onOpenChange(false);
      reset();
      onDone();
    },
    onError: (err: Error) => {
      toast.error(err.message?.includes('already') ? 'An account with this email already exists' : 'Failed to add staff');
    },
  });

  const canSubmit = name.trim().length > 0 && email.trim().length > 0 && password.length >= 6;

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add staff member</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="staff-name" required>Full name</Label>
            <Input id="staff-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Riya Sharma" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="staff-email" required>Email</Label>
            <Input id="staff-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="staff-pw" required>Password</Label>
            <div className="relative">
              <Input
                id="staff-pw"
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 6 characters"
                className="pr-9"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-2.5 flex items-center text-ink-3 hover:text-ink"
                onClick={() => setShowPw((p) => !p)}
              >
                {showPw ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={subRole} onValueChange={(v) => setSubRole(v as 'manager' | 'staff' | 'delivery_agent')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="staff">Floor staff</SelectItem>
                <SelectItem value="delivery_agent">Delivery agent</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => create.mutate()} loading={create.isPending} disabled={!canSubmit}>
            Add staff
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
