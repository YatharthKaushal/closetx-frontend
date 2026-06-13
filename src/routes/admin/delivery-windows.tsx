// MOCK_DEPENDENCY: §9 — delivery windows save endpoint pending (§12 fee config backend)
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { DeliveryMethod } from '@/lib/types';
import { deliveryMethodLabel } from '@/lib/status';
import { SectionHeading } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { RoleGate } from '@/components/shell/RoleGate';
import { MockDataBadge } from '@/components/ui/mock-data-badge';

type DeliveryWindowConfig = {
  serviceableRadiusKm: number;
  surgeMultiplier: number;
  fees: Record<DeliveryMethod, { baseFeePaise: number; perKmFeePaise: number }>;
};

export function DeliveryWindowsPanel() {
  return (
    <RoleGate kind="admin" subRole="super_admin">
      <Inner />
    </RoleGate>
  );
}

function Inner() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'delivery-windows'],
    queryFn: () => api<DeliveryWindowConfig>('/admin/delivery-windows'),
  });
  const [draft, setDraft] = useState<DeliveryWindowConfig | null>(null);
  if (data && !draft) setDraft(data);

  if (isLoading || !draft) {
    return <Skeleton className="h-72" />;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-[13px] text-ink-3 leading-relaxed">
          Delivery area, surge pricing, and the fee for each delivery method. Super-admin only — fee
          changes apply from the next order.
        </p>
        <div className="flex items-center gap-2">
          <MockDataBadge label="Mock data · backend wiring pending" />
          <Button variant="accent" onClick={() => toast.info('Config saving not yet wired')}>Save</Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="p-6 space-y-4">
            <SectionHeading kicker="Coverage" title="Service area" />
            <div>
              <Label htmlFor="radius" required>Serviceable radius (km)</Label>
              <Input
                id="radius"
                type="number"
                min="1"
                max="50"
                value={draft.serviceableRadiusKm}
                onChange={(e) => setDraft({ ...draft, serviceableRadiusKm: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label htmlFor="surge" required hint="1.0 = no surge">Surge multiplier</Label>
              <Input
                id="surge"
                type="number"
                step="0.1"
                min="1"
                max="5"
                value={draft.surgeMultiplier}
                onChange={(e) => setDraft({ ...draft, surgeMultiplier: Number(e.target.value) })}
              />
              <p className="mt-1.5 text-[11.5px] text-ink-3">Applied multiplicatively to base + per-km fees during surge windows.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <SectionHeading kicker="Fees" title="Per delivery method" />
            <div className="overflow-hidden rounded-md border border-line">
              <table className="w-full text-[12.5px]">
                <thead className="bg-bg-2/40">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-ink-3">Method</th>
                    <th className="px-3 py-2 text-right font-medium text-ink-3">Base fee (₹)</th>
                    <th className="px-3 py-2 text-right font-medium text-ink-3">Per km (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {(Object.keys(draft.fees) as DeliveryMethod[]).map((m) => {
                    const f = draft.fees[m];
                    return (
                      <tr key={m} className="border-t border-line">
                        <td className="px-3 py-2 text-ink">{deliveryMethodLabel(m)}</td>
                        <td className="px-3 py-1.5">
                          <input
                            type="number"
                            min="0"
                            value={f.baseFeePaise / 100}
                            onChange={(e) =>
                              setDraft({ ...draft, fees: { ...draft.fees, [m]: { ...f, baseFeePaise: Math.round(Number(e.target.value) * 100) } } })
                            }
                            className="w-full rounded border border-line-2 bg-bg px-2 py-1 text-right font-mono text-[12px]"
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            type="number"
                            min="0"
                            value={f.perKmFeePaise / 100}
                            onChange={(e) =>
                              setDraft({ ...draft, fees: { ...draft.fees, [m]: { ...f, perKmFeePaise: Math.round(Number(e.target.value) * 100) } } })
                            }
                            className="w-full rounded border border-line-2 bg-bg px-2 py-1 text-right font-mono text-[12px]"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
