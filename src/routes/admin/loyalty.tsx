import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { formatPaise } from '@/lib/status';
import type { LoyaltyConfig } from '@/lib/types';
import { SectionHeading } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label, FieldError } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type FormValues = {
  loyalty_point_value_paise: number;
  loyalty_earn_rate_bp: number;
  min_redeemable_points: number;
  max_redeem_fraction_bp: number;
  welcome_points: number;
  referrer_points: number;
  referred_points: number;
  quiz_completion_points: number;
};

export function LoyaltyPanel() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'loyalty', 'config'],
    queryFn: () => api<LoyaltyConfig>('/admin/loyalty/config'),
  });

  const form = useForm<FormValues>();
  const { register, handleSubmit, reset, watch, formState: { errors, isDirty, isSubmitting } } = form;

  // Hydrate from server.
  useEffect(() => {
    if (!data) return;
    reset({
      loyalty_point_value_paise: Number(data.loyalty_point_value_paise?.value ?? 100),
      loyalty_earn_rate_bp: Number(data.loyalty_earn_rate_bp?.value ?? 10000),
      min_redeemable_points: Number(data.min_redeemable_points?.value ?? 100),
      max_redeem_fraction_bp: Number(data.max_redeem_fraction_bp?.value ?? 10000),
      welcome_points: Number(data.welcome_points?.value ?? 100),
      referrer_points: Number(data.referrer_points?.value ?? 200),
      referred_points: Number(data.referred_points?.value ?? 100),
      quiz_completion_points: Number(data.quiz_completion_points?.value ?? 50),
    });
  }, [data, reset]);

  const save = useMutation({
    mutationFn: (v: FormValues) => api<{ updated: string[] }>('/admin/loyalty/config', { method: 'PATCH', body: v }),
    onSuccess: (res) => {
      toast.success(`Updated ${res.updated.length} setting${res.updated.length === 1 ? '' : 's'}`);
      void qc.invalidateQueries({ queryKey: ['admin', 'loyalty'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed'),
  });

  // Live-preview values.
  const pointValue = Number(watch('loyalty_point_value_paise')) || 0;
  const earnRateBp = Number(watch('loyalty_earn_rate_bp')) || 0;
  const minPoints = Number(watch('min_redeemable_points')) || 0;
  const maxFractionBp = Number(watch('max_redeem_fraction_bp')) || 0;

  return (
    <div>
      <p className="mb-6 max-w-2xl text-[13px] text-ink-3 leading-relaxed">
        Earn rate, point value, redemption caps, and acquisition bonuses. Changes take effect
        immediately.
      </p>

      {isLoading ? (
        <Skeleton className="h-96" />
      ) : (
        <form
          onSubmit={handleSubmit((v) => save.mutate(v))}
          className="grid gap-12 lg:grid-cols-12"
          noValidate
        >
          <section className="lg:col-span-8 space-y-7">
            <SectionHeading title="Earning & redemption" />
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Label required hint="paise per point (100 = ₹1)">Point value</Label>
                <Input mono type="number" min={1} {...register('loyalty_point_value_paise', { valueAsNumber: true, required: true })} />
                <FieldError>{errors.loyalty_point_value_paise?.message}</FieldError>
              </div>
              <div>
                <Label required hint="bp (10000 = 1 point per ₹1)">Earn rate</Label>
                <Input mono type="number" min={0} {...register('loyalty_earn_rate_bp', { valueAsNumber: true, required: true })} />
                <FieldError>{errors.loyalty_earn_rate_bp?.message}</FieldError>
              </div>
              <div>
                <Label required hint="floor per redemption">Min points to redeem</Label>
                <Input mono type="number" min={0} {...register('min_redeemable_points', { valueAsNumber: true, required: true })} />
              </div>
              <div>
                <Label required hint="bp (10000 = 100% of eligible)">Max redeem fraction</Label>
                <Input mono type="number" min={0} max={10000} {...register('max_redeem_fraction_bp', { valueAsNumber: true, required: true })} />
              </div>
            </div>

            <SectionHeading title="Acquisition bonuses" />
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Label hint="points">Welcome bonus</Label>
                <Input mono type="number" min={0} {...register('welcome_points', { valueAsNumber: true })} />
              </div>
              <div>
                <Label hint="points to the referrer">Referrer bonus</Label>
                <Input mono type="number" min={0} {...register('referrer_points', { valueAsNumber: true })} />
              </div>
              <div>
                <Label hint="points to the referred">Referred bonus</Label>
                <Input mono type="number" min={0} {...register('referred_points', { valueAsNumber: true })} />
              </div>
              <div>
                <Label hint="first style-quiz completion">Style quiz</Label>
                <Input mono type="number" min={0} {...register('quiz_completion_points', { valueAsNumber: true })} />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-rule pt-6">
              <Button type="submit" variant="ink" caps loading={isSubmitting || save.isPending} disabled={!isDirty}>
                Save changes
              </Button>
            </div>
          </section>

          <aside className="lg:col-span-4 space-y-5">
            <Card>
              <CardHeader><CardTitle>Live preview</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <Preview
                  label="On a ₹1,000 order, the consumer earns"
                  value={`${earnedFor(100000, earnRateBp, pointValue)} pts`}
                />
                <Preview
                  label="Redeeming 100 pts gives off"
                  value={formatPaise(100 * pointValue)}
                />
                <Preview
                  label="Min redemption"
                  value={`${minPoints} pts (${formatPaise(minPoints * pointValue)})`}
                />
                <Preview
                  label="Max redeem fraction"
                  value={`${(maxFractionBp / 100).toFixed(2)}% of eligible`}
                />
              </CardContent>
            </Card>
            <p className="text-[12px] text-ink-3 leading-relaxed">
              Earn rate: <strong className="text-ink">{(earnRateBp / 10000).toFixed(2)} pts per ₹1</strong>{' '}
              spent (post-discount, pre-tax). Tunable; default 1 pt per ₹1.
            </p>
          </aside>
        </form>
      )}
    </div>
  );
}

function Preview({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-rule pt-3 first:border-t-0 first:pt-0">
      <div className="kicker text-ink-3">{label}</div>
      <div className="font-display italic text-[22px] leading-tight mt-1">{value}</div>
    </div>
  );
}

function earnedFor(paise: number, earnRateBp: number, pointValuePaise: number): number {
  if (paise <= 0 || pointValuePaise <= 0) return 0;
  return Math.floor((paise * earnRateBp) / 10000 / pointValuePaise);
}
