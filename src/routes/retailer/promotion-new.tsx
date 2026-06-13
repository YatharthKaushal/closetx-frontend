import { Link, useNavigate } from 'react-router-dom';
import { FormProvider, useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Lock } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Page, PageHeader, SectionHeading } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldError, Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Brand, Category, Listing, Mechanism, Promotion } from '@/lib/types';
import { DiscountConfigForm } from '@/components/promotion/DiscountConfigForm';
import { EligibilitySection, buildScopePayload } from '@/components/promotion/EligibilitySection';
import { StackingPreview } from '@/components/promotion/StackingPreview';
import { MultiSelect, type MultiSelectOption } from '@/components/ui/multi-select';

type DiscountType =
  | 'flat_amount' | 'percent' | 'percent_upto' | 'bogo' | 'bxgy' | 'bundle' | 'tiered_cart' | 'free_shipping';

type FormValues = {
  name: string;
  mechanism: Mechanism;
  discountType: string;
  config: Record<string, unknown>;
  validFrom: string;
  validUntil: string;
  totalUses?: number | null;
  perConsumerLimit?: number | null;
  status: 'draft' | 'scheduled' | 'active';
  scope: Record<string, unknown>;
  stackableWith: string[];
  nonStackable: string[];
};

export default function RetailerPromotionNew() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const form = useForm<FormValues>({
    defaultValues: {
      name: '',
      mechanism: 'offer', // only mechanism the retailer can issue without admin permission
      discountType: 'percent',
      config: { percent: 10 },
      validFrom: new Date().toISOString().slice(0, 16),
      validUntil: new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 16),
      totalUses: null,
      perConsumerLimit: null,
      status: 'active',
      scope: {},
      stackableWith: [],
      nonStackable: [],
    },
  });

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = form;

  const listings = useQuery({
    queryKey: ['retailer', 'listings'],
    queryFn: () => api<Listing[]>('/retailer/listings'),
  });
  const brands = useQuery({
    queryKey: ['catalog', 'brands'],
    queryFn: () => api<Brand[]>('/catalog/brands'),
  });
  const categories = useQuery({
    queryKey: ['catalog', 'categories'],
    queryFn: () => api<Category[]>('/catalog/categories'),
  });
  const listingItems = (listings.data ?? []).map((l) => ({ id: l.id, name: l.name }));
  const brandItems = (brands.data ?? []).map((b) => ({ id: b.id, name: b.name }));
  const categoryItems = (categories.data ?? []).map((c) => ({ id: c.id, label: c.label }));

  const ownPromos = useQuery({
    queryKey: ['retailer', 'promotions'],
    queryFn: () => api<Promotion[]>('/retailer/promotions'),
  });
  const promoOptions: MultiSelectOption[] = (ownPromos.data ?? []).map((p) => ({
    value: p.id,
    label: p.name,
    hint: p.mechanism,
  }));
  const stackableWith = watch('stackableWith') ?? [];
  const nonStackable = watch('nonStackable') ?? [];

  const create = useMutation({
    mutationFn: (v: FormValues) => {
      const payload: Record<string, unknown> = {
        name: v.name,
        mechanism: v.mechanism,
        discountType: v.discountType,
        config: v.config,
        validFrom: new Date(v.validFrom).toISOString(),
        validUntil: new Date(v.validUntil).toISOString(),
        status: v.status,
      };
      if (v.totalUses != null) payload.totalUses = v.totalUses;
      if (v.perConsumerLimit != null) payload.perConsumerLimit = v.perConsumerLimit;
      const scopePayload = buildScopePayload(v.scope);
      if (Object.keys(scopePayload).length) payload.scope = scopePayload;
      if (v.stackableWith.length) payload.stackableWith = v.stackableWith;
      if (v.nonStackable.length) payload.nonStackable = v.nonStackable;
      return api<Promotion>('/retailer/promotions', { method: 'POST', body: payload });
    },
    onSuccess: (p) => {
      void qc.invalidateQueries({ queryKey: ['retailer', 'promotions'] });
      toast.success(`Created · ${p.name}`);
      navigate(`/retailer/promotions/${p.id}`);
    },
    onError: (e) => {
      const msg =
        e instanceof ApiError && e.code === 'forbidden'
          ? 'Coupons and vouchers are admin-restricted on your store. Contact admin.'
          : e instanceof ApiError
            ? e.message
            : 'Could not create';
      toast.error(msg);
    },
  });

  const { data: delegationModes } = useQuery({
    queryKey: ['retailer', 'promotions', 'delegation-modes'],
    queryFn: () => api<{ offers: 'open' | 'locked'; coupons: 'open' | 'locked'; vouchers: 'open' | 'locked' }>('/retailer/promotions/delegation-modes'),
  });

  const mechanism = watch('mechanism');
  const isLockedMechanism =
    (mechanism === 'coupon' && (delegationModes?.coupons ?? 'locked') === 'locked') ||
    (mechanism === 'voucher' && (delegationModes?.vouchers ?? 'locked') === 'locked');

  return (
    <Page>
      <Link
        to="/retailer/promotions"
        className="mb-3 inline-flex items-center gap-1.5 text-[12px] uppercase tracking-[0.16em] text-ink-3 hover:text-ink"
      >
        <ArrowLeft className="size-3.5" />
        All promotions
      </Link>
      <PageHeader
        title={<>New <em>promotion</em></>}
        description="Create an offer that auto-applies to your products at checkout when conditions match."
      />

      <FormProvider {...form}>
        <form onSubmit={handleSubmit((v) => create.mutate(v))} className="space-y-7" noValidate>
          <SectionHeading title="Basics" />
          <div className="max-w-md">
            <Label required>Name</Label>
            <Input placeholder="e.g. Summer 10% off" {...register('name', { required: 'Required' })} />
            <FieldError>{errors.name?.message}</FieldError>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 max-w-2xl">
            <div>
              <Label required>Mechanism</Label>
              <Select value={mechanism} onValueChange={(v) => setValue('mechanism', v as Mechanism)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="offer">Offer (auto-apply)</SelectItem>
                  <SelectItem
                    value="coupon"
                    disabled={(delegationModes?.coupons ?? 'locked') === 'locked'}
                  >
                    Coupon{(delegationModes?.coupons ?? 'locked') === 'locked' ? ' (locked — admin enables)' : ''}
                  </SelectItem>
                  <SelectItem
                    value="voucher"
                    disabled={(delegationModes?.vouchers ?? 'locked') === 'locked'}
                  >
                    Voucher{(delegationModes?.vouchers ?? 'locked') === 'locked' ? ' (locked — admin enables)' : ''}
                  </SelectItem>
                </SelectContent>
              </Select>
              {isLockedMechanism && (
                <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-warning">
                  <Lock className="size-3" />
                  Restricted at launch — contact admin to enable.
                </p>
              )}
            </div>
            <div>
              <Label required>Initial status</Label>
              <Select value={watch('status')} onValueChange={(v) => setValue('status', v as 'draft' | 'scheduled' | 'active')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <SectionHeading title="Discount" />
          <DiscountConfigForm listings={listingItems} listingsLoading={listings.isLoading} />

          <SectionHeading title="Validity & caps" />
          <div className="grid gap-5 sm:grid-cols-2 max-w-2xl">
            <div>
              <Label required>Valid from</Label>
              <Input type="datetime-local" {...register('validFrom', { required: 'Required' })} />
            </div>
            <div>
              <Label required>Valid until</Label>
              <Input type="datetime-local" {...register('validUntil', { required: 'Required' })} />
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 max-w-2xl">
            <div>
              <Label hint="Leave blank for unlimited">Total redemptions</Label>
              <Input mono type="number" min={0} placeholder="∞" {...register('totalUses', { setValueAs: nullableInt })} />
            </div>
            <div>
              <Label hint="Per consumer; blank for unlimited">Per-consumer limit</Label>
              <Input mono type="number" min={0} placeholder="∞" {...register('perConsumerLimit', { setValueAs: nullableInt })} />
            </div>
          </div>

          <EligibilitySection
            listings={listingItems}
            listingsLoading={listings.isLoading}
            categories={categoryItems}
            categoriesLoading={categories.isLoading}
            brands={brandItems}
            brandsLoading={brands.isLoading}
          />

          <SectionHeading
            title="Combining with other offers"
            hint="Override the standard offer-combining rules, just for this promotion"
          />
          <div className="grid gap-5 sm:grid-cols-2 max-w-2xl">
            <div>
              <Label hint="Allow this offer to be combined with these promotions">Can combine with</Label>
              <MultiSelect
                options={promoOptions}
                value={stackableWith}
                onChange={(next) => setValue('stackableWith', next)}
                placeholder={ownPromos.isLoading ? 'Loading…' : 'Pick promotions'}
                loading={ownPromos.isLoading}
              />
            </div>
            <div>
              <Label hint="Block stacking with these promos">Non-stackable with</Label>
              <MultiSelect
                options={promoOptions}
                value={nonStackable}
                onChange={(next) => setValue('nonStackable', next)}
                placeholder={ownPromos.isLoading ? 'Loading…' : 'Pick promotions'}
                loading={ownPromos.isLoading}
              />
            </div>
          </div>

          <StackingPreview
            mechanism={watch('mechanism')}
            discountType={watch('discountType') as DiscountType}
            issuer="retailer"
            stackableWith={stackableWith}
            nonStackable={nonStackable}
            policyEndpoint="/retailer/promotions/clubbing-policy"
            promosEndpoint="/retailer/promotions"
          />

          <div className="flex items-center justify-end gap-3 border-t border-rule pt-6">
            <Button asChild variant="ghost"><Link to="/retailer/promotions">Cancel</Link></Button>
            <Button type="submit" variant="ink" caps loading={isSubmitting || create.isPending} disabled={isLockedMechanism}>
              Create promotion
            </Button>
          </div>
        </form>
      </FormProvider>
    </Page>
  );
}

function nullableInt(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
