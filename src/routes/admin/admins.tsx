import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Copy, KeyRound, Pencil, RotateCcw, UserPlus } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { formatAge } from '@/lib/status';
import type { AdminSubRole, AdminTeamMember } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { CopyableId } from '@/components/ui/copyable-id';
import { PermissionGate } from '@/components/shell/PermissionGate';
import { NotAuthorized } from '@/components/shell/NotAuthorized';
import { usePermission } from '@/lib/use-permission';
import { Input } from '@/components/ui/input';
import { Label, FieldError } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const SUB_ROLE_LABEL: Record<AdminSubRole, string> = {
  super_admin: 'Super admin',
  ops_admin: 'Ops admin',
  support: 'Support',
};

export function AdminTeamPanel() {
  const canList = usePermission('team.list');
  if (!canList) return <NotAuthorized action="team.list" />;
  return <AdminTeamPanelInner />;
}

function AdminTeamPanelInner() {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminTeamMember | null>(null);
  const [resetTarget, setResetTarget] = useState<AdminTeamMember | null>(null);
  const [tempPasswordShown, setTempPasswordShown] = useState<{ email: string; pw: string } | null>(
    null,
  );

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'team'],
    queryFn: () => api<AdminTeamMember[]>('/admin/team'),
  });
  const list = data ?? [];

  const revoke = useMutation({
    mutationFn: (id: string) => api(`/admin/team/${id}/revoke`, { method: 'POST', body: {} }),
    onSuccess: () => {
      toast.success('Admin revoked');
      void qc.invalidateQueries({ queryKey: ['admin', 'team'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Revoke failed'),
  });

  const reinstate = useMutation({
    mutationFn: (id: string) => api(`/admin/team/${id}/reinstate`, { method: 'POST', body: {} }),
    onSuccess: () => {
      toast.success('Admin reinstated');
      void qc.invalidateQueries({ queryKey: ['admin', 'team'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Reinstate failed'),
  });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-[13px] text-ink-3 leading-relaxed">
          Manage the platform admin roster. Each member's sub-role decides which queues and
          overrides are visible.
        </p>
        <PermissionGate action="team.create">
          <Button iconLeft={<UserPlus className="size-3.5" />} onClick={() => setAddOpen(true)}>
            Add admin
          </Button>
        </PermissionGate>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : list.length === 0 ? (
        <Empty kicker="No admins" title="No admin accounts on this platform." />
      ) : (
        <ul className="space-y-2">
          {list.map((m) => {
            const active = m.status === 'active';
            return (
              <Card key={m.id}>
                <CardContent className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[14px] font-medium text-ink">{m.email}</span>
                      <Badge tone={active ? 'success' : 'neutral'}>
                        {active ? 'Active' : 'Revoked'}
                      </Badge>
                      <Badge tone={m.subRole === 'super_admin' ? 'danger' : 'info'} flat>
                        {SUB_ROLE_LABEL[m.subRole]}
                      </Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[12px] text-ink-3">
                      <CopyableId value={m.id} label="admin id" />
                    </div>
                    <div className="mt-1 text-[11.5px] text-ink-4">
                      Joined {formatAge(m.createdAt)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {active && (
                      <PermissionGate action="team.update">
                        <Button
                          variant="outline"
                          size="sm"
                          iconLeft={<Pencil className="size-3.5" />}
                          onClick={() => setEditTarget(m)}
                        >
                          Edit
                        </Button>
                      </PermissionGate>
                    )}
                    {active && (
                      <PermissionGate action="team.reset_password">
                        <Button
                          variant="outline"
                          size="sm"
                          iconLeft={<KeyRound className="size-3.5" />}
                          onClick={() => setResetTarget(m)}
                        >
                          Reset password
                        </Button>
                      </PermissionGate>
                    )}
                    {active && (
                      <PermissionGate action="team.revoke">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-danger border-danger/40"
                          onClick={() => revoke.mutate(m.id)}
                          loading={revoke.isPending && revoke.variables === m.id}
                        >
                          Revoke
                        </Button>
                      </PermissionGate>
                    )}
                    {!active && (
                      <PermissionGate action="team.reinstate">
                        <Button
                          variant="outline"
                          size="sm"
                          iconLeft={<RotateCcw className="size-3.5" />}
                          onClick={() => reinstate.mutate(m.id)}
                          loading={reinstate.isPending && reinstate.variables === m.id}
                        >
                          Reinstate
                        </Button>
                      </PermissionGate>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </ul>
      )}

      <AddAdminDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={() => {
          setAddOpen(false);
          void qc.invalidateQueries({ queryKey: ['admin', 'team'] });
        }}
      />
      <EditAdminDialog
        target={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={() => {
          setEditTarget(null);
          void qc.invalidateQueries({ queryKey: ['admin', 'team'] });
        }}
      />
      <ResetPasswordConfirm
        target={resetTarget}
        onClose={() => setResetTarget(null)}
        onDone={(email, pw) => {
          setResetTarget(null);
          setTempPasswordShown({ email, pw });
        }}
      />
      <TempPasswordModal
        info={tempPasswordShown}
        onClose={() => setTempPasswordShown(null)}
      />
    </div>
  );
}

function AddAdminDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [subRole, setSubRole] = useState<AdminSubRole>('support');

  const create = useMutation({
    mutationFn: () =>
      api('/admin/team', {
        method: 'POST',
        body: { email: email.trim(), password, subRole },
      }),
    onSuccess: () => {
      toast.success(`Admin created: ${email}`);
      setEmail(''); setPassword(''); setPasswordConfirm(''); setSubRole('support');
      onCreated();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Create failed'),
  });

  const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const pwValid = password.length >= 4;
  const pwMatch = password === passwordConfirm;
  const canSubmit = emailValid && pwValid && pwMatch;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setEmail(''); setPassword(''); setPasswordConfirm(''); setSubRole('support');
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add admin</DialogTitle>
          <DialogDescription>
            Direct create. The admin is active immediately and can sign in with these credentials.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="email" required>Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <FieldError>{email && !emailValid ? 'Invalid email' : ''}</FieldError>
          </div>
          <div>
            <Label htmlFor="password" required>Password</Label>
            <PasswordInput
              id="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <FieldError>{password && !pwValid ? 'Min 4 characters' : ''}</FieldError>
          </div>
          <div>
            <Label htmlFor="passwordConfirm" required>Confirm password</Label>
            <PasswordInput
              id="passwordConfirm"
              autoComplete="new-password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
            />
            <FieldError>{passwordConfirm && !pwMatch ? 'Passwords do not match' : ''}</FieldError>
          </div>
          <div>
            <Label htmlFor="subRole" required>Sub-role</Label>
            <Select value={subRole} onValueChange={(v) => setSubRole(v as AdminSubRole)}>
              <SelectTrigger id="subRole"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="super_admin">Super admin — full platform control</SelectItem>
                <SelectItem value="ops_admin">Ops admin — operations + moderation</SelectItem>
                <SelectItem value="support">Support — read + customer support</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              setEmail(''); setPassword(''); setPasswordConfirm(''); setSubRole('support');
              onClose();
            }}
          >
            Cancel
          </Button>
          <Button
            variant="ink"
            disabled={!canSubmit}
            loading={create.isPending}
            onClick={() => create.mutate()}
          >
            Create admin
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditAdminDialog({
  target,
  onClose,
  onSaved,
}: {
  target: AdminTeamMember | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [email, setEmail] = useState('');
  const [subRole, setSubRole] = useState<AdminSubRole>('support');

  useEffect(() => {
    if (target) {
      setEmail(target.email);
      setSubRole(target.subRole);
    }
  }, [target]);

  const save = useMutation({
    mutationFn: () => {
      if (!target) throw new Error('no target');
      const body: { email?: string; subRole?: AdminSubRole } = {};
      if (email.trim() !== target.email) body.email = email.trim();
      if (subRole !== target.subRole) body.subRole = subRole;
      if (Object.keys(body).length === 0) {
        return Promise.resolve(target);
      }
      return api(`/admin/team/${target.id}`, { method: 'PATCH', body });
    },
    onSuccess: () => {
      toast.success('Admin updated');
      onSaved();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Update failed'),
  });

  const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const dirty = target ? email.trim() !== target.email || subRole !== target.subRole : false;

  return (
    <Dialog open={target !== null} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit admin</DialogTitle>
          <DialogDescription>
            Change the email or sub-role for {target?.email ?? ''}. Sub-role changes take effect on
            their next sign-in (the JWT carries the prior value until then).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="edit-email" required>Email</Label>
            <Input
              id="edit-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <FieldError>{!emailValid && email ? 'Invalid email' : ''}</FieldError>
          </div>
          <div>
            <Label htmlFor="edit-subRole" required>Sub-role</Label>
            <Select value={subRole} onValueChange={(v) => setSubRole(v as AdminSubRole)}>
              <SelectTrigger id="edit-subRole"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="super_admin">Super admin</SelectItem>
                <SelectItem value="ops_admin">Ops admin</SelectItem>
                <SelectItem value="support">Support</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="ink"
            disabled={!dirty || !emailValid}
            loading={save.isPending}
            onClick={() => save.mutate()}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordConfirm({
  target,
  onClose,
  onDone,
}: {
  target: AdminTeamMember | null;
  onClose: () => void;
  onDone: (email: string, tempPassword: string) => void;
}) {
  const reset = useMutation({
    mutationFn: () => {
      if (!target) throw new Error('no target');
      return api<{ id: string; tempPassword: string }>(
        `/admin/team/${target.id}/reset-password`,
        { method: 'POST', body: {} },
      );
    },
    onSuccess: (data) => {
      if (!target) return;
      onDone(target.email, data.tempPassword);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Reset failed'),
  });

  return (
    <Dialog open={target !== null} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>
            Generates a new temporary password for {target?.email ?? ''}. The current password is
            invalidated immediately. Share the temp password out-of-band.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="ink"
            loading={reset.isPending}
            onClick={() => reset.mutate()}
          >
            Generate temp password
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TempPasswordModal({
  info,
  onClose,
}: {
  info: { email: string; pw: string } | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copyToClipboard() {
    if (!info) return;
    await navigator.clipboard.writeText(info.pw);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog open={info !== null} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Temporary password</DialogTitle>
          <DialogDescription>
            This password will not be shown again. Share it with {info?.email ?? ''} out-of-band
            so they can sign in and change it.
          </DialogDescription>
        </DialogHeader>
        {info && (
          <div className="rounded-md border border-line bg-bg-2/40 px-3 py-2 flex items-center justify-between gap-2">
            <code className="font-mono text-[13px] text-ink break-all">{info.pw}</code>
            <Button size="sm" variant="outline" iconLeft={copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} onClick={copyToClipboard}>
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        )}
        <DialogFooter>
          <Button variant="ink" onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
