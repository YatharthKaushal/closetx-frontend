import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Gift, IndianRupee, Sparkles } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { consumerStatusMeta, formatPaise } from '@/lib/status';
import type {
  ConsumerProfile,
  ConsumerWallet,
  LoyaltyTier,
  LoyaltyTransaction,
  WalletTransaction,
} from '@/lib/types';
import { Page, PageHeader, SectionHeading } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input, Textarea } from '@/components/ui/input';
import { Label, FieldError } from '@/components/ui/label';

type WalletPayload = { wallet: ConsumerWallet | null; transactions: WalletTransaction[] };
type LoyaltyPayload = {
  balancePoints: number;
  lifetimeEarned: number;
  tier: LoyaltyTier;
  transactions: LoyaltyTransaction[];
};

export default function AdminConsumerDetail() {
  const { id = '' } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [adjusting, setAdjusting] = useState<'wallet' | 'loyalty' | null>(null);
  const [action, setAction] = useState<'suspend' | 'unsuspend' | 'close' | null>(null);

  const profile = useQuery({
    queryKey: ['admin', 'consumer-profile', id],
    queryFn: () => api<ConsumerProfile>(`/admin/consumers/${id}`),
  });
  const wallet = useQuery({
    queryKey: ['admin', 'consumer-wallet', id],
    queryFn: () => api<WalletPayload>(`/admin/loyalty/consumers/${id}/wallet`),
  });
  const loyalty = useQuery({
    queryKey: ['admin', 'consumer-loyalty', id],
    queryFn: () => api<LoyaltyPayload>(`/admin/loyalty/consumers/${id}/loyalty`),
  });

  const refetchAll = () => {
    void qc.invalidateQueries({ queryKey: ['admin', 'consumer-profile', id] });
    void qc.invalidateQueries({ queryKey: ['admin', 'consumer-wallet', id] });
    void qc.invalidateQueries({ queryKey: ['admin', 'consumer-loyalty', id] });
    void qc.invalidateQueries({ queryKey: ['admin', 'consumers'] });
  };

  const consumer = profile.data;
  const statusMeta = consumer ? consumerStatusMeta(consumer.status) : null;

  return (
    <Page>
      <Link
        to="/admin/users?tab=consumers"
        className="mb-3 inline-flex items-center gap-1.5 text-[12px] uppercase tracking-[0.16em] text-ink-3 hover:text-ink"
      >
        <ArrowLeft className="size-3.5" />
        All consumers
      </Link>

      {profile.isLoading ? (
        <Skeleton className="h-20 mb-6" />
      ) : consumer ? (
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="font-display italic text-[28px] leading-none text-ink">{consumer.name}</h1>
              {statusMeta && <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-ink-2">
              <span>{consumer.email}</span>
              <span className="text-ink-4">·</span>
              <span>{consumer.phone}</span>
              {consumer.genderPreference && (
                <>
                  <span className="text-ink-4">·</span>
                  <span className="capitalize">{consumer.genderPreference}</span>
                </>
              )}
            </div>
            <div className="mt-1 font-mono text-[10.5px] tracking-wider text-ink-3">
              {consumer.id} · joined {new Date(consumer.signupAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
          </div>

          {/* Account actions */}
          <div className="flex flex-wrap gap-2">
            {consumer.status === 'active' && (
              <Button variant="outline" size="sm" caps onClick={() => setAction('suspend')}>
                Suspend
              </Button>
            )}
            {consumer.status === 'suspended' && (
              <Button variant="outline" size="sm" caps onClick={() => setAction('unsuspend')}>
                Unsuspend
              </Button>
            )}
            {consumer.status !== 'closed' && (
              <Button variant="outline" size="sm" caps className="text-danger border-danger/40 hover:bg-danger/5" onClick={() => setAction('close')}>
                Close account
              </Button>
            )}
          </div>
        </div>
      ) : (
        <PageHeader title={<>Consumer</>} description={<span className="font-mono text-[13px]">{id}</span>} />
      )}

      {/* Wallet + Loyalty + Gift Card cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Wallet</CardTitle>
              <p className="text-[12px] text-ink-3 mt-0.5">Cash balance, in paise</p>
            </div>
            <IndianRupee className="size-5 text-ink-3" />
          </CardHeader>
          <CardContent>
            {wallet.isLoading ? (
              <Skeleton className="h-12 w-32" />
            ) : (
              <>
                <div className="font-display italic text-[44px] leading-none text-ink">
                  {formatPaise(wallet.data?.wallet?.balancePaise ?? 0)}
                </div>
                <div className="mt-3 text-[11.5px] uppercase tracking-[0.16em] text-ink-3">
                  Wallet ID{' '}
                  <span className="font-mono normal-case tracking-normal">
                    {wallet.data?.wallet?.id ?? '—'}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  caps
                  className="mt-4"
                  onClick={() => setAdjusting('wallet')}
                >
                  Adjust balance
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Loyalty</CardTitle>
              <p className="text-[12px] text-ink-3 mt-0.5">Points + tier</p>
            </div>
            <Sparkles className="size-5 text-ink-3" />
          </CardHeader>
          <CardContent>
            {loyalty.isLoading ? (
              <Skeleton className="h-12 w-32" />
            ) : (
              <>
                <div className="flex items-baseline gap-3">
                  <div className="font-display italic text-[44px] leading-none text-ink">
                    {(loyalty.data?.balancePoints ?? 0).toLocaleString('en-IN')}
                  </div>
                  <Badge tone="info" className="!transform-none">
                    {loyalty.data?.tier ?? 'bronze'}
                  </Badge>
                </div>
                <div className="mt-3 text-[11.5px] uppercase tracking-[0.16em] text-ink-3">
                  Lifetime earned{' '}
                  <span className="font-mono normal-case tracking-normal">
                    {(loyalty.data?.lifetimeEarned ?? 0).toLocaleString('en-IN')}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  caps
                  className="mt-4"
                  onClick={() => setAdjusting('loyalty')}
                >
                  Adjust points
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <GiftCardBalanceCard consumerId={id} />
      </div>

      <Tabs defaultValue="orders" className="mt-10">
        <TabsList className="overflow-x-auto whitespace-nowrap">
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="returns">Returns</TabsTrigger>
          <TabsTrigger value="refunds">Refunds</TabsTrigger>
          <TabsTrigger value="issues">Issues</TabsTrigger>
          <TabsTrigger value="posts">Posts / reviews</TabsTrigger>
          <TabsTrigger value="bans">Flags / bans</TabsTrigger>
          <TabsTrigger value="audit">Wallet + loyalty + audit</TabsTrigger>
        </TabsList>

        <TabsContent value="orders">
          <RelatedLink title={`All orders by this consumer`} href={`/admin/orders?consumerId=${id}`} />
        </TabsContent>
        <TabsContent value="returns">
          <RelatedLink title="Returns filed by this consumer" href={`/admin/orders?consumerId=${id}&hasReturn=1`} />
        </TabsContent>
        <TabsContent value="refunds">
          <RelatedLink title="Refunds for this consumer" href={`/admin/refund-reconciliation?consumerId=${id}`} />
        </TabsContent>
        <TabsContent value="issues">
          <RelatedLink title="Disputes opened by or against this consumer" href={`/admin/disputes?consumerId=${id}`} />
        </TabsContent>
        <TabsContent value="posts">
          <div className="space-y-2">
            <RelatedLink title="Community posts" href="/admin/customers?tab=community" />
            <RelatedLink title="Product reviews" href="/admin/customers?tab=reviews" />
          </div>
        </TabsContent>
        <TabsContent value="bans">
          <div className="space-y-6">
            <AbuseFlagsCard consumerId={id} />
            <BanFlagsCard consumerId={id} />
          </div>
        </TabsContent>
        <TabsContent value="audit">
          <SectionHeading title="Wallet transactions" hint={`${wallet.data?.transactions.length ?? 0} recent`} />
          <TransactionsTable
            loading={wallet.isLoading}
            rows={(wallet.data?.transactions ?? []).map((t) => ({
              id: t.id,
              when: t.at,
              kind: t.kind,
              amount: formatPaise(t.amountPaise),
              balance: formatPaise(t.balanceAfterPaise),
              note: t.note,
            }))}
          />

          <div className="mt-12">
            <SectionHeading
              title="Loyalty transactions"
              hint={`${loyalty.data?.transactions.length ?? 0} recent`}
            />
          </div>
          <TransactionsTable
            loading={loyalty.isLoading}
            rows={(loyalty.data?.transactions ?? []).map((t) => ({
              id: t.id,
              when: t.at,
              kind: t.kind,
              amount: `${t.points > 0 ? '+' : ''}${t.points} pts`,
              balance: `${t.balanceAfterPoints} pts`,
              note: t.note,
            }))}
          />
        </TabsContent>
      </Tabs>

      {adjusting && (
        <AdjustDialog
          kind={adjusting}
          consumerId={id}
          onClose={() => setAdjusting(null)}
          onDone={refetchAll}
        />
      )}
      {action && (
        <AccountActionDialog
          action={action}
          consumerId={id}
          onClose={() => setAction(null)}
          onDone={refetchAll}
        />
      )}
    </Page>
  );
}

// MOCK_DEPENDENCY: §20 — independent ban toggles + related-link tab targets

function RelatedLink({ title, href }: { title: string; href: string }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4 text-[13px]">
        <span className="text-ink-2">{title}</span>
        <Link to={href} className="text-accent hover:underline">Open →</Link>
      </CardContent>
    </Card>
  );
}

type ConsumerFlag = {
  id: string;
  consumerId: string;
  kind: 'promo_abuse' | 'dispute_pattern' | 'rewards_ban' | 'other';
  reason: string;
  createdByAdminId: string | null;
  createdAt: string;
  resolvedAt: string | null;
  resolvedByAdminId: string | null;
  resolvedNote: string | null;
};

function AbuseFlagsCard({ consumerId }: { consumerId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<ConsumerFlag['kind']>('promo_abuse');
  const [reason, setReason] = useState('');

  const flagsQuery = useQuery({
    queryKey: ['admin', 'consumer-flags', consumerId, 'all'],
    queryFn: () => api<ConsumerFlag[]>(`/admin/consumers/${consumerId}/flags?includeResolved=true`),
  });

  const create = useMutation({
    mutationFn: () =>
      api<ConsumerFlag>(`/admin/consumers/${consumerId}/flags`, {
        method: 'POST',
        body: { kind, reason: reason.trim() },
      }),
    onSuccess: () => {
      toast.success('Flag recorded');
      setOpen(false);
      setReason('');
      setKind('promo_abuse');
      void qc.invalidateQueries({ queryKey: ['admin', 'consumer-flags', consumerId] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed to record flag'),
  });

  const resolve = useMutation({
    mutationFn: (flagId: string) =>
      api(`/admin/consumers/${consumerId}/flags/${flagId}/resolve`, { method: 'POST', body: {} }),
    onSuccess: () => {
      toast.success('Flag resolved');
      void qc.invalidateQueries({ queryKey: ['admin', 'consumer-flags', consumerId] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed to resolve'),
  });

  const flags = flagsQuery.data ?? [];
  const openFlags = flags.filter((f) => !f.resolvedAt);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            Abuse flags
            {openFlags.length > 0 && (
              <Badge tone="danger" pulse>
                {openFlags.length} open
              </Badge>
            )}
          </CardTitle>
          <p className="mt-0.5 text-[12px] text-ink-3">
            Recorded notes about promo abuse / dispute patterns. Surface in future dispute reviews.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          Flag consumer
        </Button>
      </CardHeader>
      <CardContent>
        {flagsQuery.isLoading ? (
          <Skeleton className="h-20" />
        ) : flags.length === 0 ? (
          <p className="text-[12.5px] text-ink-3 italic">No flags yet.</p>
        ) : (
          <ul className="space-y-2">
            {flags.map((f) => (
              <li
                key={f.id}
                className="flex items-start justify-between gap-3 rounded-md border border-line bg-bg-2/30 px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={f.resolvedAt ? 'neutral' : 'danger'} flat>
                      {f.kind.replace(/_/g, ' ')}
                    </Badge>
                    {f.resolvedAt && (
                      <Badge tone="success" flat>
                        resolved
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1 text-[13px] text-ink">{f.reason}</div>
                  <div className="mt-0.5 text-[11px] text-ink-4">
                    {new Date(f.createdAt).toLocaleString('en-IN')}
                    {f.resolvedAt && ` · resolved ${new Date(f.resolvedAt).toLocaleDateString('en-IN')}`}
                  </div>
                </div>
                {!f.resolvedAt && (
                  <Button
                    size="xs"
                    variant="ghost"
                    loading={resolve.isPending && resolve.variables === f.id}
                    onClick={() => resolve.mutate(f.id)}
                  >
                    Resolve
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={(o) => !create.isPending && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Flag consumer</DialogTitle>
            <DialogDescription>
              Recorded on the audit log + surfaced in future dispute reviews. Choose a kind and
              describe the abuse pattern.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="flag-kind" required>Kind</Label>
              <select
                id="flag-kind"
                value={kind}
                onChange={(e) => setKind(e.target.value as ConsumerFlag['kind'])}
                className="mt-1 w-full rounded border border-line-2 bg-bg px-2 py-1.5 text-[13px]"
              >
                <option value="promo_abuse">Promo abuse</option>
                <option value="dispute_pattern">Dispute pattern</option>
                <option value="rewards_ban">Rewards ban</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <Label htmlFor="flag-reason" required>Reason</Label>
              <textarea
                id="flag-reason"
                rows={4}
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. used 6 burner accounts on FIRST50 coupon"
                className="mt-1 w-full rounded border border-line-2 bg-bg px-2 py-1 text-[13px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={create.isPending}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={create.isPending}
              disabled={reason.trim().length < 3}
              onClick={() => create.mutate()}
            >
              Record flag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function BanFlagsCard({ consumerId }: { consumerId: string }) {
  const [bans, setBans] = useState({ community: false, rewards: false, reviews: false });
  const toggle = (k: keyof typeof bans) => {
    setBans((b) => {
      const next = { ...b, [k]: !b[k] };
      toast.success(`${k} ban ${next[k] ? 'enabled' : 'lifted'} (mock)`);
      return next;
    });
    void consumerId;
  };
  const items: Array<{ key: keyof typeof bans; label: string; hint: string }> = [
    { key: 'community', label: 'Community ban', hint: 'Cannot post to community feed; existing posts hidden.' },
    { key: 'reviews', label: 'Reviews ban', hint: 'Cannot post product reviews; existing reviews hidden.' },
    { key: 'rewards', label: 'Rewards ban', hint: 'Cannot earn new loyalty points; refund credit-back still proceeds.' },
  ];
  return (
    <Card>
      <CardContent className="p-6 space-y-3">
        <SectionHeading title="Surface-specific bans" />
        <p className="text-[12.5px] text-ink-3">Independent of global suspend / close. Use these to throttle behaviour without blocking purchase.</p>
        {items.map((it) => (
          <div key={it.key} className="flex items-center justify-between rounded-md border border-line bg-bg-2/30 px-3 py-2.5">
            <div>
              <div className="text-[13.5px] font-medium text-ink">{it.label}</div>
              <div className="text-[11.5px] text-ink-3">{it.hint}</div>
            </div>
            <input
              type="checkbox"
              checked={bans[it.key]}
              onChange={() => toggle(it.key)}
              className="size-4 cursor-pointer accent-accent"
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function GiftCardBalanceCard({ consumerId }: { consumerId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'consumer-gift-cards', consumerId],
    queryFn: () =>
      api<{ totalPaise: number; cards: Array<{ id: string; code: string; balancePaise: number; expiresOn: string }> }>(
        `/admin/consumers/${consumerId}/gift-cards`,
      ),
  });
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            Gift cards
          </CardTitle>
          <p className="text-[12px] text-ink-3 mt-0.5">Active cards + expiry</p>
        </div>
        <Gift className="size-5 text-ink-3" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-12 w-32" />
        ) : (
          <>
            <div className="font-display italic text-[44px] leading-none text-ink">
              {formatPaise(data?.totalPaise ?? 0)}
            </div>
            <ul className="mt-3 space-y-1.5">
              {(data?.cards ?? []).map((c) => (
                <li key={c.id} className="flex items-center justify-between text-[12px] text-ink-3">
                  <span className="font-mono">{c.code}</span>
                  <span>
                    {formatPaise(c.balancePaise)} · exp {new Date(c.expiresOn).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function TransactionsTable({
  loading,
  rows,
}: {
  loading: boolean;
  rows: Array<{
    id: string;
    when: string;
    kind: string;
    amount: string;
    balance: string;
    note: string | null;
  }>;
}) {
  if (loading) return <Skeleton className="h-32" />;
  if (rows.length === 0) {
    return (
      <p className="border border-dashed border-rule-strong py-8 text-center text-[13px] text-ink-3 italic">
        No transactions yet.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto border border-rule">
      <table className="w-full text-[13px]">
        <thead className="bg-paper-2/40">
          <tr>
            <th className="px-3 py-2 text-left kicker text-ink-3">When</th>
            <th className="px-3 py-2 text-left kicker text-ink-3">Kind</th>
            <th className="px-3 py-2 text-right kicker text-ink-3">Amount</th>
            <th className="px-3 py-2 text-right kicker text-ink-3">Balance after</th>
            <th className="px-3 py-2 text-left kicker text-ink-3">Note</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-rule">
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="px-3 py-2.5 text-ink-2">{new Date(r.when).toLocaleString('en-IN')}</td>
              <td className="px-3 py-2.5">
                <span className="kicker text-ink-3">{r.kind.replace(/_/g, ' ')}</span>
              </td>
              <td className="px-3 py-2.5 text-right font-mono tabular-nums text-ink">{r.amount}</td>
              <td className="px-3 py-2.5 text-right font-mono tabular-nums text-ink-2">{r.balance}</td>
              <td className="px-3 py-2.5 text-ink-2">{r.note ?? <span className="text-ink-4">—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AdjustDialog({
  kind,
  consumerId,
  onClose,
  onDone,
}: {
  kind: 'wallet' | 'loyalty';
  consumerId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const submit = useMutation({
    mutationFn: () => {
      const path =
        kind === 'wallet'
          ? `/admin/loyalty/consumers/${consumerId}/wallet/adjust`
          : `/admin/loyalty/consumers/${consumerId}/loyalty/adjust`;
      const body =
        kind === 'wallet'
          ? { amountPaise: Number(amount), note: note.trim() }
          : { points: Number(amount), note: note.trim() };
      return api(path, { method: 'POST', body });
    },
    onSuccess: () => {
      toast.success(`${kind === 'wallet' ? 'Wallet' : 'Loyalty'} adjusted`);
      onClose();
      onDone();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Failed'),
  });

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust {kind === 'wallet' ? 'wallet' : 'loyalty'} balance</DialogTitle>
          <DialogDescription>
            Positive credits, negative debits. {kind === 'wallet' ? 'Amount in paise.' : 'Points.'} A note is required.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label required>{kind === 'wallet' ? 'Amount (paise)' : 'Points'}</Label>
            <Input
              mono
              type="number"
              placeholder={kind === 'wallet' ? 'e.g. 10000 or -5000' : 'e.g. 100 or -50'}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <Label required>Note</Label>
            <Textarea rows={2} placeholder="Why this adjustment?" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <FieldError>{error}</FieldError>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="ink"
            caps
            loading={submit.isPending}
            disabled={!amount || !note.trim()}
            onClick={() => submit.mutate()}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AccountActionDialog({
  action,
  consumerId,
  onClose,
  onDone,
}: {
  action: 'suspend' | 'unsuspend' | 'close';
  consumerId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const titles = {
    suspend: 'Suspend account',
    unsuspend: 'Lift suspension',
    close: 'Close account',
  };
  const descriptions = {
    suspend: 'The consumer will not be able to place orders or log in while suspended.',
    unsuspend: 'Restores the consumer to active status. They can log in and order again.',
    close: 'This is irreversible. The account will be permanently closed. Provide a reason.',
  };

  const submit = useMutation({
    mutationFn: () => {
      const body = action === 'unsuspend' ? {} : { reason: reason.trim() };
      return api(`/admin/consumers/${consumerId}/${action}`, { method: 'POST', body });
    },
    onSuccess: () => {
      const msg = { suspend: 'Account suspended', unsuspend: 'Suspension lifted', close: 'Account closed' }[action];
      toast.success(msg);
      onClose();
      onDone();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Action failed'),
  });

  const needsReason = action !== 'unsuspend';

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titles[action]}</DialogTitle>
          <DialogDescription>{descriptions[action]}</DialogDescription>
        </DialogHeader>
        {needsReason && (
          <div className="space-y-3">
            <div>
              <Label required>Reason</Label>
              <Textarea
                rows={3}
                placeholder="Internal reason (not shown to consumer)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <FieldError>{error}</FieldError>
          </div>
        )}
        {!needsReason && error && <FieldError>{error}</FieldError>}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant={action === 'close' ? 'ink' : 'ink'}
            caps
            loading={submit.isPending}
            disabled={needsReason && !reason.trim()}
            onClick={() => submit.mutate()}
            className={action === 'close' ? 'bg-danger text-paper hover:bg-danger/90 border-transparent' : ''}
          >
            {action === 'unsuspend' ? 'Lift suspension' : action === 'suspend' ? 'Suspend' : 'Close account'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
