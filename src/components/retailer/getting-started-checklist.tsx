import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronRight, X } from 'lucide-react';
import type { Listing, Store } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

const SHOW_FOR_DAYS = 7;

type StepKey = 'products' | 'photos' | 'hours' | 'pickup' | 'share';

type Step = {
  key: StepKey;
  label: string;
  description: string;
  to: string;
  /** Manually confirmable steps need a "Mark done" button — no data signal. */
  manual?: boolean;
};

const STEPS: ReadonlyArray<Step> = [
  {
    key: 'products',
    label: 'Add your first 5 products',
    description: 'Live storefronts convert faster with at least a small catalogue.',
    to: '/retailer/listings',
  },
  {
    key: 'photos',
    label: 'Upload store photos',
    description: 'Hero, interior, and packaging shots build customer trust.',
    to: '/retailer/store/photos',
  },
  {
    key: 'hours',
    label: 'Set store hours',
    description: 'Hours drive accept/cut-off windows and pickup eligibility.',
    to: '/retailer/store/hours',
    manual: true,
  },
  {
    key: 'pickup',
    label: 'Configure pickup slots',
    description: 'Tell the courier when your store can hand over packed orders.',
    to: '/retailer/pickup-slots',
    manual: true,
  },
  {
    key: 'share',
    label: 'Share your store link',
    description: 'Post the link on WhatsApp / Instagram to drive your first orders.',
    to: '/retailer/store',
    manual: true,
  },
];

const activationKey = (storeId: string) => `retailer.gettingStarted.firstSeenActive.${storeId}`;
const dismissKey = (storeId: string) => `retailer.gettingStarted.dismissed.${storeId}`;
const manualDoneKey = (storeId: string, step: StepKey) =>
  `retailer.gettingStarted.manualDone.${storeId}.${step}`;

/**
 * Boolean flag persisted in `localStorage`. SSR-safe: initialised from storage
 * on first read, falls back to `false` when storage is unavailable. Subscribes
 * to the cross-tab `storage` event so flips in another tab are reflected here
 * without manual reload.
 */
function useLocalBool(key: string): [boolean, (next: boolean) => void] {
  const [value, setValue] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem(key) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    function onStorage(e: StorageEvent) {
      if (e.key !== key) return;
      setValue(e.newValue === '1');
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [key]);

  const set = useCallback(
    (next: boolean) => {
      setValue(next);
      if (typeof window === 'undefined') return;
      try {
        if (next) window.localStorage.setItem(key, '1');
        else window.localStorage.removeItem(key);
      } catch {
        // Quota exceeded — keep the in-memory state so the UI still reacts.
      }
    },
    [key],
  );

  return [value, set];
}

/**
 * Timestamp persisted in `localStorage`. On first read after mount, if the
 * slot is empty, lazily write "now" so the SHOW_FOR_DAYS window has a well-
 * defined origin from the operator's first visit to a live store. Returns
 * `null` only while storage is unavailable.
 */
function useFirstSeenDate(key: string): Date | null {
  const [iso, setIso] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (iso !== null || typeof window === 'undefined') return;
    const now = new Date().toISOString();
    try {
      window.localStorage.setItem(key, now);
      setIso(now);
    } catch {
      // Storage unavailable — without a persisted timestamp the checklist
      // hides itself (the parent treats `null` as "no window started").
    }
  }, [iso, key]);

  return iso ? new Date(iso) : null;
}

/**
 * Dismissible checklist rendered on the LiveDashboard for the first 7 days
 * after the store first goes active. Auto-derives completion from data
 * already on the dashboard (listings count, store photos). Steps without a
 * data signal (hours, pickup slots, share link) are user-confirmable and
 * persist in localStorage so they survive reload.
 *
 * Returns null when:
 *  - The store hasn't been active long enough to track (no first-seen mark yet).
 *  - The 7-day window has elapsed.
 *  - The operator explicitly dismissed it.
 *  - Every step is complete.
 */
export function GettingStartedChecklist({
  store,
  listings,
}: {
  store: Store;
  listings: Listing[];
}) {
  const storeId = store.id;
  const firstSeenAt = useFirstSeenDate(activationKey(storeId));
  const [dismissed, setDismissed] = useLocalBool(dismissKey(storeId));
  const [hoursDone, setHoursDone] = useLocalBool(manualDoneKey(storeId, 'hours'));
  const [pickupDone, setPickupDone] = useLocalBool(manualDoneKey(storeId, 'pickup'));
  const [shareDone, setShareDone] = useLocalBool(manualDoneKey(storeId, 'share'));

  const productsCount = listings.filter((l) => l.status === 'active').length;
  const productsDone = productsCount >= 5;
  const photosDone = (store.galleryImageUrls?.length ?? 0) > 0;

  const completion: Record<StepKey, boolean> = {
    products: productsDone,
    photos: photosDone,
    hours: hoursDone,
    pickup: pickupDone,
    share: shareDone,
  };

  const manualSetters: Record<StepKey, ((v: boolean) => void) | null> = {
    products: null,
    photos: null,
    hours: setHoursDone,
    pickup: setPickupDone,
    share: setShareDone,
  };

  const elapsedDays = firstSeenAt
    ? (Date.now() - firstSeenAt.getTime()) / (1000 * 60 * 60 * 24)
    : 0;
  const allDone = STEPS.every((s) => completion[s.key]);

  if (dismissed || !firstSeenAt || elapsedDays > SHOW_FOR_DAYS || allDone) {
    return null;
  }

  const doneCount = STEPS.filter((s) => completion[s.key]).length;

  return (
    <Card className="border-accent/30 bg-gradient-to-br from-bg to-bg-2">
      <CardContent className="p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">
              Getting started
            </div>
            <h2 className="text-[16px] font-semibold text-ink mt-1">
              Welcome aboard — let's set you up for sales.
            </h2>
            <p className="mt-1 text-[12.5px] text-ink-3">
              {doneCount} of {STEPS.length} done · {Math.max(0, Math.ceil(SHOW_FOR_DAYS - elapsedDays))} days left
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="-m-1 p-1 text-ink-3 hover:text-ink"
            aria-label="Dismiss checklist"
          >
            <X className="size-4" />
          </button>
        </div>

        <ul className="space-y-2">
          {STEPS.map((step) => {
            const done = completion[step.key];
            const markDone = manualSetters[step.key];
            return (
              <li
                key={step.key}
                className={cn(
                  'flex items-center gap-3 rounded-md border px-3 py-2.5',
                  done ? 'border-success/30 bg-success-soft/30' : 'border-line bg-bg',
                )}
              >
                <span
                  className={cn(
                    'grid place-items-center size-5 rounded-full border shrink-0',
                    done ? 'border-success bg-success text-bg' : 'border-line-strong text-ink-4',
                  )}
                  aria-hidden
                >
                  {done && <Check className="size-3" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className={cn('text-[13px] font-medium', done ? 'text-ink-3 line-through' : 'text-ink')}>
                    {step.label}
                  </div>
                  <div className="text-[11.5px] text-ink-3">{step.description}</div>
                </div>
                {!done && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    {step.manual && markDone && (
                      <Button variant="ghost" size="sm" onClick={() => markDone(true)}>
                        Mark done
                      </Button>
                    )}
                    <Button asChild variant="outline" size="sm" iconRight={<ChevronRight className="size-3.5" />}>
                      <Link to={step.to}>{step.manual ? 'Open' : 'Start'}</Link>
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
