import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Lock, Unlock } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

type DelegationRow = {
  capability: string;
  mode: 'open' | 'locked';
  isDefault: boolean;
};

const CAPABILITY_LABELS: Record<string, { label: string; description: string }> = {
  'promotions_issuance__offers': {
    label: 'Promotions — Offers',
    description: 'Auto-apply discount offers on checkout. Open by default.',
  },
  'promotions_issuance__coupons': {
    label: 'Promotions — Coupons',
    description: 'Coupon codes customers enter at checkout. Higher abuse risk.',
  },
  'promotions_issuance__vouchers': {
    label: 'Promotions — Vouchers',
    description: 'Bulk voucher code generation for campaigns.',
  },
  'listing_policy_choice': {
    label: 'Listing policy choice',
    description: 'Retailers can set return/exchange/final-sale policies per listing.',
  },
  'delivery_fee_override': {
    label: 'Delivery fee override',
    description: 'Retailers can override platform delivery fees.',
  },
  'handling_fee': {
    label: 'Handling fee',
    description: 'Retailers can set a per-order handling fee.',
  },
  'convenience_fee': {
    label: 'Convenience fee',
    description: 'Retailers can apply a convenience surcharge.',
  },
};

const QK = ['admin', 'platform', 'delegation-modes'];

export function FeatureControlsPanel() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: QK,
    queryFn: () => api<DelegationRow[]>('/admin/platform/delegation-modes'),
  });

  const toggle = useMutation({
    mutationFn: ({ capability, mode }: { capability: string; mode: 'open' | 'locked' }) =>
      api(`/admin/platform/delegation-modes/${capability}`, { method: 'PATCH', body: { mode } }),
    onSuccess: (_, { capability, mode }) => {
      void qc.invalidateQueries({ queryKey: QK });
      toast.success(`${CAPABILITY_LABELS[capability]?.label ?? capability} set to ${mode}`);
    },
    onError: () => toast.error('Failed to update'),
  });

  return (
    <div>
      <p className="mb-4 max-w-3xl text-[13px] text-ink-3 leading-relaxed">
        Toggle which capabilities retailers can use. Changes take effect immediately — no deploy
        needed.
      </p>

      {isLoading ? (
        <div className="space-y-2">{[0, 1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="border-b border-line bg-bg-2/60">
                  <th className="px-4 py-3 text-left kicker text-ink-3">Capability</th>
                  <th className="px-4 py-3 text-left kicker text-ink-3">Description</th>
                  <th className="px-4 py-3 text-right kicker text-ink-3">Status</th>
                  <th className="px-4 py-3 text-right kicker text-ink-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(data ?? []).map((row) => {
                  const meta = CAPABILITY_LABELS[row.capability];
                  const isOpen = row.mode === 'open';
                  return (
                    <tr key={row.capability} className="hover:bg-bg-2/40 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-ink">{meta?.label ?? row.capability}</div>
                        {row.isDefault && (
                          <span className="text-[11px] text-ink-4">platform default</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-ink-3 max-w-xs">
                        {meta?.description ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Badge
                          tone={isOpen ? 'success' : 'neutral'}
                          flat
                          nodot={false}
                        >
                          {isOpen ? 'Open' : 'Locked'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant={isOpen ? 'outline' : 'accent'}
                          iconLeft={isOpen
                            ? <Lock className="size-3.5" />
                            : <Unlock className="size-3.5" />}
                          loading={toggle.isPending && toggle.variables?.capability === row.capability}
                          onClick={() =>
                            toggle.mutate({ capability: row.capability, mode: isOpen ? 'locked' : 'open' })
                          }
                        >
                          {isOpen ? 'Lock' : 'Unlock'}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
