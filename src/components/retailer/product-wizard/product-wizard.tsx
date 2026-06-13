/**
 * Shared 3-step product wizard for BOTH create (/retailer/listings/new) and
 * edit (/retailer/listings/:id).
 *
 *  Step 1 Basics & media → Step 2 Variants → Step 3 Details.
 *
 * A draft listing is created as soon as Step 1's required fields are filled;
 * thereafter scalar edits autosave (debounced PATCH) and gallery changes save
 * immediately. Variants persist from Step 2; publishing (whole listing or a
 * single variant) happens from the publish bar / variant rows behind a review.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { canPublishProducts, deriveGate } from '@/lib/gate';
import type { Category, Listing, RetailerProfile, Store } from '@/lib/types';
import { GateNotice } from '@/components/retailer/gate-notice';
import { Page, PageHeader } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StepIndicator } from './step-indicator';
import { StepBasicsMedia } from './step-basics-media';
import { StepVariants } from './step-variants';
import { StepMetadata } from './step-metadata';
import { PublishBar } from './publish-bar';
import {
  seedVariantState,
  WIZARD_STEPS,
  WizardFormSchema,
  type GroupDraft,
  type VariantDraft,
  type VariantMode,
  type WizardFormValues,
} from './types';

type MeResponse = { retailer: RetailerProfile; store: Store | null };

const STEP_FIELDS: Record<number, (keyof WizardFormValues)[]> = {
  0: ['name', 'brandId', 'categoryId', 'gender'],
  1: [],
  2: ['listingPolicy'],
};

function listingToForm(l: Listing): WizardFormValues {
  return {
    name: l.name,
    sku: '',
    description: l.description ?? '',
    descriptionLong: l.descriptionLong ?? '',
    brandId: l.brandId ?? '',
    categoryId: l.categoryId,
    gender: l.gender,
    occasion: l.occasion ?? [],
    ageGroups: l.ageGroups ?? [],
    listingPolicy: l.listingPolicy,
    hsn: l.hsn ?? '',
  };
}

export function ProductWizard({ mode }: { mode: 'create' | 'edit' }) {
  const { id: routeId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [listingId, setListingId] = useState<string | null>(mode === 'edit' ? routeId ?? null : null);
  const [step, setStep] = useState(0);
  const [maxStep, setMaxStep] = useState(mode === 'edit' ? WIZARD_STEPS.length - 1 : 0);
  const [gallery, setGallery] = useState<string[]>([]);
  const [variants, setVariants] = useState<VariantDraft[]>([]);
  const [groups, setGroups] = useState<GroupDraft[]>([]);
  const [variantMode, setVariantMode] = useState<VariantMode>('single');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const seeded = useRef(false);

  const me = useQuery({ queryKey: ['retailer', 'me'], queryFn: () => api<MeResponse>('/retailer/me') });
  const gate = deriveGate(me.data?.retailer, me.data?.store);
  const canPublish = canPublishProducts(gate);

  const categories = useQuery({
    queryKey: ['catalog', 'categories'],
    queryFn: () => api<Category[]>('/catalog/categories'),
  });

  const listingQ = useQuery({
    queryKey: ['retailer', 'listing', listingId],
    enabled: !!listingId,
    queryFn: () => api<Listing>(`/retailer/listings/${listingId}`),
  });

  const form = useForm<WizardFormValues>({
    resolver: zodResolver(WizardFormSchema),
    defaultValues: {
      name: '', sku: '', description: '', descriptionLong: '', brandId: '', categoryId: '',
      gender: 'unisex', occasion: [], ageGroups: [], listingPolicy: 'return', hsn: '',
    },
  });

  // Seed form + local state once the listing loads (edit, or after draft create).
  useEffect(() => {
    const l = listingQ.data;
    if (!l || seeded.current) return;
    form.reset(listingToForm(l));
    setGallery(l.galleryUrls ?? []);
    const seededState = seedVariantState(l);
    setVariantMode(seededState.mode);
    setGroups(seededState.groups);
    setVariants(seededState.variants);
    seeded.current = true;
  }, [listingQ.data, form]);

  // ── Draft create + autosave ────────────────────────────────────────────
  const createDraft = useMutation({
    mutationFn: (v: WizardFormValues) =>
      api<Listing>('/retailer/listings', {
        method: 'POST',
        body: {
          name: v.name,
          brandId: v.brandId,
          categoryId: v.categoryId,
          gender: v.gender,
          ...(v.description ? { description: v.description } : {}),
          ...(v.descriptionLong ? { descriptionLong: v.descriptionLong } : {}),
          listingPolicy: v.listingPolicy,
          galleryUrls: gallery,
          occasion: v.occasion,
          ageGroups: v.ageGroups ?? [],
          ...(v.hsn ? { hsn: v.hsn } : {}),
        },
      }),
    onSuccess: (l) => {
      seeded.current = true; // we already hold the freshest local state
      setListingId(l.id);
      setSavedAt(new Date().toISOString());
      qc.setQueryData(['retailer', 'listing', l.id], l);
      void qc.invalidateQueries({ queryKey: ['retailer', 'listings'] });
      // Move the URL to the canonical edit path without remounting.
      window.history.replaceState(null, '', `/retailer/listings/${l.id}`);
    },
    onError: (e) => {
      const code = e instanceof ApiError ? e.code : '';
      toast.error(
        code === 'retailer_not_approved'
          ? 'Your account needs admin approval first.'
          : e instanceof Error ? e.message : 'Could not create product',
      );
    },
  });

  // Debounced scalar autosave once a draft exists.
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function scheduleAutosave() {
    if (!listingId) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => void persistScalars(), 700);
  }
  async function persistScalars() {
    if (!listingId) return;
    const v = form.getValues();
    try {
      await api(`/retailer/listings/${listingId}`, {
        method: 'PATCH',
        body: {
          name: v.name,
          description: v.description ?? '',
          descriptionLong: v.descriptionLong ? v.descriptionLong : null,
          brandId: v.brandId,
          categoryId: v.categoryId,
          gender: v.gender,
          listingPolicy: v.listingPolicy,
          occasion: v.occasion,
          ageGroups: v.ageGroups ?? [],
          hsn: v.hsn ?? '',
        },
      });
      setSavedAt(new Date().toISOString());
      void qc.invalidateQueries({ queryKey: ['retailer', 'listing', listingId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Autosave failed');
    }
  }

  // Watch scalar changes → autosave.
  useEffect(() => {
    const sub = form.watch(() => scheduleAutosave());
    return () => sub.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, listingId]);

  // Gallery saves immediately.
  async function onGalleryChange(next: string[]) {
    setGallery(next);
    if (!listingId) return;
    try {
      await api(`/retailer/listings/${listingId}`, { method: 'PATCH', body: { galleryUrls: next } });
      setSavedAt(new Date().toISOString());
      void qc.invalidateQueries({ queryKey: ['retailer', 'listing', listingId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save images');
    }
  }

  // ── Step navigation ────────────────────────────────────────────────────
  async function ensureDraft(): Promise<boolean> {
    if (listingId) return true;
    const ok = await form.trigger(STEP_FIELDS[0]);
    if (!ok) return false;
    const l = await createDraft.mutateAsync(form.getValues());
    return !!l;
  }
  async function goNext() {
    const fields = STEP_FIELDS[step] ?? [];
    if (fields.length && !(await form.trigger(fields))) return;
    if (step === 0 && !(await ensureDraft())) return;
    const next = Math.min(step + 1, WIZARD_STEPS.length - 1);
    setStep(next);
    setMaxStep((m) => Math.max(m, next));
  }
  async function jumpTo(target: number) {
    if (target === step) return;
    if (target < step) return setStep(target);
    if (!(await form.trigger(STEP_FIELDS[0]))) return;
    if (!(await ensureDraft())) return;
    setStep(target);
    setMaxStep((m) => Math.max(m, target));
  }

  const uploadFolder = `products/${listingId ?? 'new'}`;

  if (mode === 'edit' && listingQ.isLoading) {
    return (
      <Page>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-4 h-96 w-full" />
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        kicker="Catalog"
        title={<>{mode === 'edit' ? form.watch('name') || 'Edit product' : 'New product'} · {WIZARD_STEPS[step]}</>}
        description={`Step ${step + 1} of ${WIZARD_STEPS.length}`}
        actions={
          <div className="flex items-center gap-3">
            {savedAt && (
              <span className="flex items-center gap-1 text-[11.5px] text-ink-3">
                <Check className="size-3 text-success" /> Saved
              </span>
            )}
            {mode === 'edit' && listingId && (
              <Button asChild variant="ghost" size="sm">
                <Link to={`/retailer/listings/${listingId}/manage`}>Promotions · AI · Audit</Link>
              </Button>
            )}
            <Button asChild variant="ghost" size="sm" iconLeft={<ArrowLeft className="size-3.5" />}>
              <Link to="/retailer/listings">Back to products</Link>
            </Button>
          </div>
        }
      />

      {!canPublish ? (
        <GateNotice gate={gate} />
      ) : (
        <div className="max-w-5xl">
          <StepIndicator steps={WIZARD_STEPS} step={step} maxStep={maxStep} onJump={jumpTo} />

          <div className="mt-4">
            {step === 0 && (
              <StepBasicsMedia
                form={form}
                categories={categories.data ?? []}
                gallery={gallery}
                onGalleryChange={onGalleryChange}
                uploadFolder={uploadFolder}
                onRequestAiGenerate={listingId ? () => navigate('/retailer/ai-catalog/new') : undefined}
              />
            )}
            {step === 1 && (
              <StepVariants
                listing={listingQ.data ?? null}
                listingId={listingId}
                gallery={gallery}
                mode={variantMode}
                setMode={setVariantMode}
                groups={groups}
                setGroups={setGroups}
                variants={variants}
                setVariants={setVariants}
                onReload={() => {
                  seeded.current = false;
                  void qc.invalidateQueries({ queryKey: ['retailer', 'listing', listingId] });
                }}
              />
            )}
            {step === 2 && (
              <div className="space-y-6">
                <StepMetadata form={form} />
                <PublishBar
                  listing={listingQ.data ?? null}
                  listingId={listingId}
                  values={form.getValues()}
                  gallery={gallery}
                  onPublished={() => {
                    seeded.current = false;
                    void qc.invalidateQueries({ queryKey: ['retailer', 'listing', listingId] });
                  }}
                />
              </div>
            )}
          </div>

          {/* Footer nav */}
          <div className="mt-8 flex items-center justify-between border-t border-rule pt-5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={step === 0}
              iconLeft={<ArrowLeft className="size-3.5" />}
              onClick={() => setStep((s) => Math.max(s - 1, 0))}
            >
              Back
            </Button>
            {step < WIZARD_STEPS.length - 1 ? (
              <Button
                type="button"
                variant="ink"
                onClick={goNext}
                iconRight={createDraft.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <ArrowRight className="size-3.5" />}
                disabled={createDraft.isPending}
              >
                {step === 0 ? 'Save & continue' : 'Continue'}
              </Button>
            ) : (
              <Button asChild variant="outline" size="sm">
                <Link to="/retailer/listings">Done</Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </Page>
  );
}
