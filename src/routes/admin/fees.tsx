import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { deliveryMethodLabel, formatPaise } from '@/lib/status';
import type { DeliveryMethod, FeesConfig } from '@/lib/types';
import { SectionHeading } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MetaList } from '@/components/ui/meta-list';

type Draft = {
  baseDeliveryFee: Record<DeliveryMethod, number>;
  surgeMultiplier: number;
  tcsRateBp: number;
};

function buildDraft(d: FeesConfig): Draft {
  return {
    baseDeliveryFee: {
      express: d.delivery.express?.baseFeePaise ?? 0,
      standard: d.delivery.standard?.baseFeePaise ?? 0,
      pickup: d.delivery.pickup?.baseFeePaise ?? 0,
      try_and_buy: d.delivery.try_and_buy?.baseFeePaise ?? 0,
    },
    surgeMultiplier: d.surgeMultiplier,
    tcsRateBp: d.tcsRateBp,
  };
}

function diffDraft(server: Draft, draft: Draft) {
  const out: {
    baseDeliveryFee?: Partial<Record<DeliveryMethod, number>>;
    surgeMultiplier?: number;
    tcsRateBp?: number;
  } = {};
  const fee: Partial<Record<DeliveryMethod, number>> = {};
  for (const m of Object.keys(server.baseDeliveryFee) as DeliveryMethod[]) {
    if (server.baseDeliveryFee[m] !== draft.baseDeliveryFee[m]) fee[m] = draft.baseDeliveryFee[m];
  }
  if (Object.keys(fee).length > 0) out.baseDeliveryFee = fee;
  if (server.surgeMultiplier !== draft.surgeMultiplier) out.surgeMultiplier = draft.surgeMultiplier;
  if (server.tcsRateBp !== draft.tcsRateBp) out.tcsRateBp = draft.tcsRateBp;
  return out;
}

function formatChanged(meta?: { at: string; by: string | null } | undefined): string | null {
  if (!meta) return null;
  const when = new Date(meta.at).toLocaleString('en-IN');
  return meta.by ? `Last edited by ${meta.by} on ${when}` : `Last edited on ${when}`;
}

export function FeesPanel() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'fees'],
    queryFn: () => api<FeesConfig>('/admin/fees'),
  });
  const [draft, setDraft] = useState<Draft | null>(null);

  useEffect(() => {
    if (data && !draft) setDraft(buildDraft(data));
  }, [data, draft]);

  const save = useMutation({
    mutationFn: (body: ReturnType<typeof diffDraft>) =>
      api<{ updated: string[] }>('/admin/fees', { method: 'PATCH', body }),
    onSuccess: (res) => {
      toast.success(`Updated ${res.updated.length} setting${res.updated.length === 1 ? '' : 's'}`);
      void qc.invalidateQueries({ queryKey: ['admin', 'fees'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Save failed'),
  });

  if (isLoading || !data || !draft) {
    return <div><Skeleton className="h-72" /></div>;
  }

  const serverDraft = buildDraft(data);
  const diff = diffDraft(serverDraft, draft);
  const dirty = Object.keys(diff).length > 0;

  const submit = () => {
    if (!dirty) return;
    if (draft.tcsRateBp !== serverDraft.tcsRateBp) {
      const ok = window.confirm(
        'Confirm the TCS rate change. Every new order will use this rate on its invoice.',
      );
      if (!ok) return;
    }
    save.mutate(diff);
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-3xl text-[13px] text-ink-3 leading-relaxed">
          Marketplace-wide fees. Every change is recorded and takes effect at the next checkout.
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="ghost" disabled={!dirty || save.isPending} onClick={() => setDraft(buildDraft(data))}>
            Reset
          </Button>
          <Button variant="accent" loading={save.isPending} disabled={!dirty} onClick={submit}>
            Save changes
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="p-6">
            <SectionHeading kicker="Platform" title="Default platform fee" />
            <div className="text-[28px] font-semibold text-ink leading-none">{(data.defaultPlatformFeeBp / 100).toFixed(2)}%</div>
            <p className="mt-2 text-[12.5px] text-ink-3">Applied per order to every retailer unless an override is set.</p>
            <div className="mt-5">
              <div className="kicker mb-2">Per-retailer overrides</div>
              {data.platformFeeOverrides.length === 0 ? (
                <p className="text-[12.5px] text-ink-3 italic">None.</p>
              ) : (
                <ul className="space-y-2">
                  {data.platformFeeOverrides.map((o) => (
                    <li key={o.retailerId} className="rounded-md border border-line bg-bg-2/30 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[13px] font-medium text-ink truncate">{o.retailerName}</span>
                        <Badge tone={o.platformFeeBp < data.defaultPlatformFeeBp ? 'success' : 'warning'}>
                          {(o.platformFeeBp / 100).toFixed(2)}%
                        </Badge>
                      </div>
                      <div className="text-[11.5px] text-ink-3 italic mt-0.5">{o.reason}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <SectionHeading kicker="Tax" title="GST + TCS" />
            <MetaList
              cols={1}
              items={[
                { label: 'GST rate', value: `${(data.gstRateBp / 100).toFixed(2)}%`, hint: 'Read-only — set by tax authority' },
                { label: 'Intra-state split', value: `CGST ${(data.intraStateSplit.cgstBp / 100).toFixed(2)}% + SGST ${(data.intraStateSplit.sgstBp / 100).toFixed(2)}%` },
                { label: 'Inter-state split', value: `IGST ${(data.interStateSplit.igstBp / 100).toFixed(2)}%` },
              ]}
            />
            <div className="mt-5">
              <label className="kicker mb-1 block" htmlFor="tcs-rate">TCS rate (%)</label>
              <input
                id="tcs-rate"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={(draft.tcsRateBp / 100).toString()}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (!Number.isFinite(v)) return;
                  setDraft({ ...draft, tcsRateBp: Math.round(v * 100) });
                }}
                className="w-32 rounded border border-line-2 bg-bg px-2 py-1 text-right font-mono text-[13px]"
              />
              {formatChanged(data.lastChanged.tcs_rate_bp) && (
                <p className="mt-1 text-[11px] text-ink-4">{formatChanged(data.lastChanged.tcs_rate_bp)}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardContent className="p-6">
            <div className="mb-3 flex items-center justify-between">
              <SectionHeading kicker="Logistics" title="Delivery fee table" />
              <div className="flex items-center gap-2 text-[12px] text-ink-3">
                <label htmlFor="surge" className="kicker">Surge ×</label>
                <input
                  id="surge"
                  type="number"
                  step="0.05"
                  min="0.1"
                  max="10"
                  value={draft.surgeMultiplier.toString()}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!Number.isFinite(v)) return;
                    setDraft({ ...draft, surgeMultiplier: v });
                  }}
                  className="w-20 rounded border border-line-2 bg-bg px-2 py-1 text-right font-mono"
                />
              </div>
            </div>
            <div className="overflow-hidden rounded-md border border-line">
              <table className="w-full text-[12.5px]">
                <thead className="bg-bg-2/40">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-ink-3">Method</th>
                    <th className="px-3 py-2 text-right font-medium text-ink-3">Base fee (₹)</th>
                    <th className="px-3 py-2 text-right font-medium text-ink-3">Per km</th>
                  </tr>
                </thead>
                <tbody>
                  {(Object.keys(data.delivery) as DeliveryMethod[]).map((m) => {
                    const f = data.delivery[m];
                    return (
                      <tr key={m} className="border-t border-line">
                        <td className="px-3 py-2 text-ink">{deliveryMethodLabel(m)}</td>
                        <td className="px-3 py-1.5 text-right">
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            value={(draft.baseDeliveryFee[m] / 100).toString()}
                            onChange={(e) => {
                              const v = parseFloat(e.target.value);
                              if (!Number.isFinite(v)) return;
                              setDraft({
                                ...draft,
                                baseDeliveryFee: {
                                  ...draft.baseDeliveryFee,
                                  [m]: Math.round(v * 100),
                                },
                              });
                            }}
                            className="w-28 rounded border border-line-2 bg-bg px-2 py-1 text-right font-mono"
                          />
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-ink-3">{formatPaise(f.perKmFeePaise)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-col gap-1 text-[11.5px] text-ink-3">
              <p>
                Base fee changes feed the pricing engine and how each order's money is split. The per-km column is set in Delivery windows.
              </p>
              {formatChanged(data.lastChanged.base_delivery_fee_table) && (
                <p className="text-ink-4">{formatChanged(data.lastChanged.base_delivery_fee_table)}</p>
              )}
              {formatChanged(data.lastChanged.surge_multiplier) && (
                <p className="text-ink-4">Surge — {formatChanged(data.lastChanged.surge_multiplier)}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
