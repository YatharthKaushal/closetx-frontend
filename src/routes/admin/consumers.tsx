import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { consumerStatusMeta } from '@/lib/status';
import type { ConsumerStatus, ConsumerSummary } from '@/lib/types';
import { Empty } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
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

const STATUS_OPTIONS: ReadonlyArray<{ value: ConsumerStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All consumers' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'closed', label: 'Closed' },
];

export function ConsumersPanel() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<ConsumerStatus | 'all'>('all');
  const [signupRange, setSignupRange] = useState<'all' | '7d' | '30d' | '90d'>('all');
  const [banFilter, setBanFilter] = useState<'all' | 'community' | 'reviews' | 'rewards'>('all');
  // Load the full directory on mount (empty filter) instead of gating behind a
  // search — admins expect to see all consumers when they open the tab.
  const [submitted, setSubmitted] = useState<{ q?: string; status?: ConsumerStatus } | null>({});

  const { data, isFetching } = useQuery({
    queryKey: ['admin', 'consumers', submitted],
    queryFn: () => {
      const params = new URLSearchParams();
      if (submitted?.q) params.set('q', submitted.q);
      if (submitted?.status) params.set('status', submitted.status);
      return api<ConsumerSummary[]>(`/admin/consumers?${params}`);
    },
    enabled: submitted !== null,
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted({
      ...(q.trim() ? { q: q.trim() } : {}),
      ...(status !== 'all' ? { status } : {}),
    });
  }

  function onStatusChange(v: string) {
    const newStatus = v as ConsumerStatus | 'all';
    setStatus(newStatus);
    setSubmitted({
      ...(q.trim() ? { q: q.trim() } : {}),
      ...(newStatus !== 'all' ? { status: newStatus } : {}),
    });
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-[13px] text-ink-3 leading-relaxed">
          Search by name, email, or phone. Click a row to view the full profile, wallet, loyalty,
          and account actions.
        </p>
        <NewConsumerButton onCreated={() => setSubmitted({})} />
      </div>

      <form onSubmit={onSubmit} className="mb-6 flex flex-wrap items-end gap-3 border-b border-rule pb-4">
        <div className="relative flex-1 min-w-48">
          <Search className="pointer-events-none absolute left-1 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, email or phone"
            className="!pl-7"
          />
        </div>
        <Select value={status} onValueChange={onStatusChange}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={signupRange} onValueChange={(v) => setSignupRange(v as typeof signupRange)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All signups</SelectItem>
            <SelectItem value="7d">Signed up · last 7d</SelectItem>
            <SelectItem value="30d">Signed up · last 30d</SelectItem>
            <SelectItem value="90d">Signed up · last 90d</SelectItem>
          </SelectContent>
        </Select>
        <Select value={banFilter} onValueChange={(v) => setBanFilter(v as typeof banFilter)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All flags</SelectItem>
            <SelectItem value="community">Community-banned</SelectItem>
            <SelectItem value="reviews">Reviews-banned</SelectItem>
            <SelectItem value="rewards">Rewards-banned</SelectItem>
          </SelectContent>
        </Select>
      </form>

      {submitted === null ? (
        <Empty
          kicker="Search above"
          title="Find a consumer"
          description="Type a name, email, or phone number to begin. Use the status filter to scope results."
        />
      ) : isFetching ? (
        <Skeleton className="h-32" />
      ) : !data || data.length === 0 ? (
        <Empty kicker="No matches" title="No consumers found." />
      ) : (
        <ul className="border-y border-rule divide-y divide-rule" data-stagger>
          {data
            .filter((c) => {
              if (signupRange === 'all') return true;
              const ageMs = Date.now() - new Date(c.signupAt).getTime();
              const days = ageMs / (1000 * 60 * 60 * 24);
              return signupRange === '7d' ? days <= 7 : signupRange === '30d' ? days <= 30 : days <= 90;
            })
            .filter(() => banFilter === 'all' || true /* MOCK §20: no ban field on API yet */)
            .map((c) => {
            const meta = consumerStatusMeta(c.status);
            return (
              <li key={c.id}>
                <Link
                  to={`/admin/consumers/${c.id}`}
                  className="flex items-center justify-between gap-4 px-2 py-4 hover:bg-surface/40 transition-colors group"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-display italic text-[18px] leading-tight text-ink">{c.name}</span>
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[12px] text-ink-2">
                      <span>{c.email}</span>
                      <span className="text-ink-4">·</span>
                      <span>{c.phone}</span>
                    </div>
                    <div className="mt-0.5 font-mono text-[10px] tracking-wider text-ink-4">
                      {c.id} · joined {new Date(c.signupAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                  <ArrowUpRight className="size-4 shrink-0 text-ink-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function NewConsumerButton({ onCreated }: { onCreated?: () => void }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    email: '',
    phone: '',
    name: '',
    password: '',
    genderPreference: '' as '' | 'her' | 'him' | 'unisex',
  });

  const create = useMutation({
    mutationFn: () =>
      api<{ id: string; email: string; name: string }>('/admin/consumers', {
        method: 'POST',
        body: {
          email: form.email.trim(),
          phone: form.phone.trim(),
          name: form.name.trim(),
          ...(form.password ? { password: form.password } : {}),
          ...(form.genderPreference ? { genderPreference: form.genderPreference } : {}),
        },
      }),
    onSuccess: (r) => {
      toast.success(`Consumer created · ${r.email}`);
      setOpen(false);
      setForm({ email: '', phone: '', name: '', password: '', genderPreference: '' });
      void qc.invalidateQueries({ queryKey: ['admin', 'consumers'] });
      onCreated?.();
    },
    onError: (e) => {
      const code = e instanceof ApiError ? e.code : '';
      toast.error(
        code === 'email_already_taken'
          ? 'Email already in use.'
          : code === 'invalid_state'
            ? 'Phone already in use.'
            : e instanceof Error
              ? e.message
              : 'Create failed',
      );
    },
  });

  const valid = form.email.includes('@') && form.phone.length >= 10 && form.name.trim().length >= 2;

  return (
    <>
      <Button variant="ink" iconLeft={<Plus className="size-3.5" />} onClick={() => setOpen(true)}>
        New consumer
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create consumer</DialogTitle>
            <DialogDescription>
              Mints a real consumer account with the email + phone you supply. Password defaults to{' '}
              <span className="font-mono text-[12px]">ChangeMe!1</span> when left blank.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="nc-name" required>Name</Label>
              <Input
                id="nc-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Riya Mehta"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="nc-email" required>Email</Label>
                <Input
                  id="nc-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="riya@example.com"
                />
              </div>
              <div>
                <Label htmlFor="nc-phone" required>Phone</Label>
                <Input
                  id="nc-phone"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+919812345678"
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="nc-pwd">Password (optional)</Label>
                <Input
                  id="nc-pwd"
                  type="text"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="defaults to ChangeMe!1"
                />
              </div>
              <div>
                <Label htmlFor="nc-gender">Gender preference</Label>
                <Select
                  value={form.genderPreference || 'none'}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, genderPreference: v === 'none' ? '' : (v as 'her' | 'him' | 'unisex') }))
                  }
                >
                  <SelectTrigger id="nc-gender">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— none —</SelectItem>
                    <SelectItem value="her">Her</SelectItem>
                    <SelectItem value="him">Him</SelectItem>
                    <SelectItem value="unisex">Unisex</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              variant="ink"
              loading={create.isPending}
              disabled={!valid}
              onClick={() => create.mutate()}
            >
              Create consumer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
