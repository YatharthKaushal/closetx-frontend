import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Check, ChevronDown, Eye, EyeOff, Loader2, MapPin, Search } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Page } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label, FieldError } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { lookupPincode, type PincodeLookup } from '@/lib/pincode';
import { geocodeLocation } from '@/lib/geocode';
import {
  StoreHoursPicker,
  DEFAULT_HOURS,
  hoursConfigToRecord,
  type HoursConfig,
} from '@/components/ui/store-hours-picker';

const MapPicker = lazy(() => import('@/components/ui/map-picker'));

// GST state codes (numeric prefix of GSTIN). Mirrors retailer signup form.
const INDIAN_STATES: { code: string; name: string }[] = [
  { code: '01', name: 'Jammu & Kashmir' },
  { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' },
  { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' },
  { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' },
  { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' },
  { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' },
  { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' },
  { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' },
  { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' },
  { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '24', name: 'Gujarat' },
  { code: '26', name: 'Dadra & Nagar Haveli and Daman & Diu' },
  { code: '27', name: 'Maharashtra' },
  { code: '28', name: 'Andhra Pradesh' },
  { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' },
  { code: '31', name: 'Lakshadweep' },
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '34', name: 'Puducherry' },
  { code: '35', name: 'Andaman & Nicobar Islands' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh (New)' },
  { code: '38', name: 'Ladakh' },
  { code: '97', name: 'Other Territory' },
  { code: '99', name: 'Centre Jurisdiction' },
];

type Step = 'identity' | 'business' | 'storefront' | 'bank' | 'platform';
const STEPS: { key: Step; label: string }[] = [
  { key: 'identity', label: '1 · Identity' },
  { key: 'business', label: '2 · Business' },
  { key: 'storefront', label: '3 · Storefront' },
  { key: 'bank', label: '4 · Bank' },
  { key: 'platform', label: '5 · Platform terms' },
];

interface FormState {
  legalName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  gstin: string;
  pan: string;
  storeName: string;
  hours: HoursConfig;
  address: string;
  pincode: string;
  city: string;
  stateCode: string;
  lat: number;
  lng: number;
  accountHolderName: string;
  accountNumber: string;
  ifsc: string;
  bankName: string;
  platformFeeBp: string;
  payoutCadenceDays: string;
}

const INITIAL: FormState = {
  legalName: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
  gstin: '',
  pan: '',
  storeName: '',
  hours: DEFAULT_HOURS,
  address: '',
  pincode: '',
  city: '',
  stateCode: '',
  lat: 20.5937,
  lng: 78.9629,
  accountHolderName: '',
  accountNumber: '',
  ifsc: '',
  bankName: '',
  platformFeeBp: '1500',
  payoutCadenceDays: '7',
};

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^(\+91[-\s]?)?[6-9]\d{9}$/;
const PINCODE_RE = /^\d{6}$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

type FieldErrors = Record<string, string>;

function validateStep(step: Step, form: FormState): FieldErrors {
  const e: FieldErrors = {};
  if (step === 'identity') {
    if (!form.legalName.trim() || form.legalName.trim().length < 2)
      e.legalName = 'Owner full name is required (min 2 characters).';
    if (!form.email.trim()) e.email = 'Email is required.';
    else if (!EMAIL_RE.test(form.email.trim())) e.email = 'Enter a valid email address.';
    if (!form.phone.trim()) e.phone = 'Phone number is required.';
    else if (!PHONE_RE.test(form.phone.trim())) e.phone = 'Enter a valid 10-digit Indian mobile number.';
    if (!form.password) e.password = 'Password is required.';
    else if (form.password.length < 8) e.password = 'Password must be at least 8 characters.';
    if (!form.confirmPassword) e.confirmPassword = 'Please confirm the password.';
    else if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match.';
  }
  if (step === 'business') {
    if (!form.gstin.trim()) e.gstin = 'GSTIN is required.';
    if (!form.pan.trim()) e.pan = 'PAN is required.';
    else if (!PAN_RE.test(form.pan.trim())) e.pan = 'PAN must be 10 characters, format ABCDE1234F.';
  }
  if (step === 'storefront') {
    if (!form.storeName.trim() || form.storeName.trim().length < 2)
      e.storeName = 'Store name is required (min 2 characters).';
    if (!form.address.trim() || form.address.trim().length < 5)
      e.address = 'Street address is required (min 5 characters).';
    if (!form.pincode.trim()) e.pincode = 'Pincode is required.';
    else if (!PINCODE_RE.test(form.pincode.trim())) e.pincode = 'Pincode must be exactly 6 digits.';
    if (!form.stateCode.trim()) e.stateCode = 'State is required.';
    if (form.lat === 20.5937 && form.lng === 78.9629) e.location = 'Pin the store location on the map.';
  }
  if (step === 'bank') {
    if (!form.accountHolderName.trim() || form.accountHolderName.trim().length < 2)
      e.accountHolderName = 'Account holder name is required.';
    if (!form.accountNumber.trim()) e.accountNumber = 'Account number is required.';
    else if (form.accountNumber.trim().length < 9 || form.accountNumber.trim().length > 18)
      e.accountNumber = 'Account number must be between 9 and 18 digits.';
    if (!form.ifsc.trim()) e.ifsc = 'IFSC code is required.';
    else if (!IFSC_RE.test(form.ifsc.trim())) e.ifsc = 'IFSC must be 11 characters, format SBIN0001234.';
  }
  if (step === 'platform') {
    const fee = parseInt(form.platformFeeBp, 10);
    if (Number.isNaN(fee) || fee < 0 || fee > 10000) e.platformFeeBp = 'Fee bp must be 0–10000.';
    const cad = parseInt(form.payoutCadenceDays, 10);
    if (Number.isNaN(cad) || cad < 1 || cad > 30) e.payoutCadenceDays = 'Cadence must be 1–30 days.';
  }
  return e;
}

/**
 * Convert the hours-picker record ({from, to, closed}) to the shape
 * `retailerStores.openingHours` expects: `Record<day, [{open, close}]>`.
 * Closed days are omitted.
 */
function hoursPickerToStoreSchema(
  rec: Record<string, { from: string; to: string; closed: boolean }>,
): Record<string, { open: string; close: string }[]> {
  return Object.fromEntries(
    Object.entries(rec)
      .filter(([, v]) => !v.closed)
      .map(([d, v]) => [d, [{ open: v.from, close: v.to }]]),
  );
}

export default function AdminRetailerNew() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('identity');
  const [form, setForm] = useState<FormState>(INITIAL);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [sameAsOwner, setSameAsOwner] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pincodeLookup, setPincodeLookup] = useState<PincodeLookup | null>(null);
  const [pincodeLooking, setPincodeLooking] = useState(false);
  const [pincodeErr, setPincodeErr] = useState<string | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) {
      setErrors((e) => {
        const n = { ...e };
        delete n[key];
        return n;
      });
    }
  }

  useEffect(() => {
    const pin = form.pincode.trim();
    if (!/^\d{6}$/.test(pin)) {
      setPincodeLookup(null);
      setPincodeErr(null);
      return;
    }
    let cancelled = false;
    setPincodeLooking(true);
    setPincodeErr(null);
    lookupPincode(pin)
      .then((res) => {
        if (cancelled) return;
        if (!res) {
          setPincodeLookup(null);
          setPincodeErr('No location found for that PIN code.');
          return;
        }
        setPincodeLookup(res);
        if (res.stateCode) update('stateCode', res.stateCode);
        update('city', res.city);
        geocodeLocation(`${res.city}, ${res.state}, ${res.country}`)
          .then((center) => {
            if (cancelled || !center) return;
            update('lat', center.lat);
            update('lng', center.lng);
          })
          .catch(() => {});
      })
      .catch(() => {
        if (!cancelled) setPincodeErr("Couldn't reach PIN code service — try again.");
      })
      .finally(() => {
        if (!cancelled) setPincodeLooking(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.pincode]);

  const idx = STEPS.findIndex((s) => s.key === step);
  const isLast = idx === STEPS.length - 1;
  const isFirst = idx === 0;

  function advance() {
    const errs = validateStep(step, form);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      toast.error('Fix the errors before continuing.');
      return;
    }
    setErrors({});
    const next = STEPS[idx + 1];
    if (next) setStep(next.key);
  }

  const create = useMutation({
    mutationFn: () =>
      api<{ retailerId: string; storeId: string; email: string }>(
        '/admin/retailers/create',
        {
          method: 'POST',
          body: {
            legalName: form.legalName.trim(),
            ownerEmail: form.email.trim(),
            ownerPhone: form.phone.trim(),
            password: form.password,
            gstin: form.gstin.trim().toUpperCase(),
            pan: form.pan.trim() ? form.pan.trim().toUpperCase() : undefined,
            store: {
              storeName: form.storeName.trim(),
              address: form.address.trim(),
              stateCode: form.stateCode.trim(),
              lat: form.lat,
              lng: form.lng,
              openingHours: hoursPickerToStoreSchema(hoursConfigToRecord(form.hours)),
              platformFeeBp: parseInt(form.platformFeeBp, 10) || 1500,
              payoutCadenceDays: parseInt(form.payoutCadenceDays, 10) || 7,
            },
            bank: {
              legalName: form.accountHolderName.trim(),
              accountNumber: form.accountNumber.trim(),
              ifsc: form.ifsc.trim().toUpperCase(),
            },
          },
        },
      ),
    onSuccess: (r) => {
      toast.success(`Store provisioned: ${r.email}`);
      navigate(`/admin/retailers/${r.retailerId}`);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed to create store'),
  });

  function submit() {
    // Run every step's validation pre-submit so the admin can't skip to the end.
    for (const s of STEPS) {
      const errs = validateStep(s.key, form);
      if (Object.keys(errs).length > 0) {
        setErrors(errs);
        setStep(s.key);
        toast.error(`Fix errors in step "${s.label.split(' · ')[1]}" before submitting.`);
        return;
      }
    }
    setErrors({});
    create.mutate();
  }

  return (
    <Page>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="kicker text-ink-3">Stores</div>
          <h1 className="mt-0.5 text-[22px] font-semibold text-ink leading-tight">Add new store</h1>
          <p className="mt-1 max-w-2xl text-[13.5px] text-ink-3">
            Provision a retailer + first store directly. Bypasses the retailer-submitted application
            flow. Same fields as the public signup form so the retailer record matches an organic signup.
          </p>
        </div>
        <Button asChild variant="ghost" size="sm" iconLeft={<ArrowLeft className="size-3.5" />}>
          <Link to="/admin/stores">Back</Link>
        </Button>
      </div>

      <Tabs value={step} onValueChange={(v) => setStep(v as Step)}>
        <TabsList className="overflow-x-auto whitespace-nowrap">
          {STEPS.map((s) => (
            <TabsTrigger key={s.key} value={s.key}>
              {s.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="identity">
          <StepCard>
            <div>
              <Label htmlFor="ownerName" required>Owner full name</Label>
              <Input id="ownerName" value={form.legalName} onChange={(e) => update('legalName', e.target.value)} />
              <FieldError>{errors.legalName}</FieldError>
            </div>
            <div>
              <Label htmlFor="email" required>Email</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} />
              <FieldError>{errors.email}</FieldError>
            </div>
            <div>
              <Label htmlFor="phone" required>Phone</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => update('phone', e.target.value)}
                placeholder="9876543210"
              />
              <FieldError>{errors.phone}</FieldError>
            </div>
            <div>
              <Label htmlFor="password" required hint="min 8 characters">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => update('password', e.target.value)}
                  className="pr-9"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-2.5 text-ink-3 hover:text-ink-2"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <FieldError>{errors.password}</FieldError>
            </div>
            <div>
              <Label htmlFor="confirmPassword" required>Confirm password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={form.confirmPassword}
                  onChange={(e) => update('confirmPassword', e.target.value)}
                  className="pr-9"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-2.5 text-ink-3 hover:text-ink-2"
                >
                  {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <FieldError>{errors.confirmPassword}</FieldError>
            </div>
          </StepCard>
        </TabsContent>

        <TabsContent value="business">
          <StepCard>
            <div>
              <Label htmlFor="gstin" required>GSTIN</Label>
              <Input
                id="gstin"
                mono
                value={form.gstin}
                onChange={(e) => update('gstin', e.target.value.toUpperCase())}
                placeholder="22AAAAA0000A1Z5"
              />
              <FieldError>{errors.gstin}</FieldError>
            </div>
            <div>
              <Label htmlFor="pan" required>PAN</Label>
              <Input
                id="pan"
                mono
                value={form.pan}
                onChange={(e) => update('pan', e.target.value.toUpperCase())}
                placeholder="ABCDE1234F"
              />
              <FieldError>{errors.pan}</FieldError>
            </div>
          </StepCard>
        </TabsContent>

        <TabsContent value="storefront">
          <StepCard>
            <div>
              <Label htmlFor="sf-store-name" required hint="what customers see">Store name</Label>
              <Input
                id="sf-store-name"
                value={form.storeName}
                onChange={(e) => update('storeName', e.target.value)}
                placeholder="Patel Fashion"
              />
              <FieldError>{errors.storeName}</FieldError>
            </div>
            <div>
              <Label htmlFor="sf-address" required>Street address</Label>
              <Input
                id="sf-address"
                value={form.address}
                onChange={(e) => update('address', e.target.value)}
                placeholder="42 Linking Rd, Bandra West"
              />
              <FieldError>{errors.address}</FieldError>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="sf-pincode" required hint="6 digits">Pincode</Label>
                <div className="relative">
                  <Input
                    id="sf-pincode"
                    mono
                    inputMode="numeric"
                    maxLength={6}
                    value={form.pincode}
                    onChange={(e) => update('pincode', e.target.value)}
                    placeholder="400001"
                  />
                  {pincodeLooking && (
                    <Loader2 className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-ink-3" />
                  )}
                </div>
                <FieldError>{errors.pincode ?? pincodeErr ?? undefined}</FieldError>
              </div>
              <div>
                <Label>City · State</Label>
                <div
                  className={`flex h-10 items-center rounded-md border px-3 text-[13.5px] ${
                    pincodeLookup ? 'border-success/40 text-ink' : 'border-line text-ink-3 italic'
                  }`}
                >
                  {pincodeLookup ? (
                    <>
                      <span className="font-medium">{pincodeLookup.city}</span>
                      <span className="mx-1.5 text-ink-4">·</span>
                      <span>{pincodeLookup.state}</span>
                    </>
                  ) : (
                    'Auto-filled from pincode'
                  )}
                </div>
              </div>
            </div>
            <div>
              <Label required>Store location</Label>
              <div className="flex flex-wrap items-center gap-3 rounded-md border border-line bg-bg-2/40 px-3 py-2.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  iconLeft={<MapPin className="size-3.5" />}
                  onClick={() => setPickerOpen(true)}
                >
                  {form.lat === 20.5937 && form.lng === 78.9629 ? 'Pin on map' : 'Adjust pin'}
                </Button>
                <span className="font-mono text-[12px] text-ink-2">
                  {form.lat.toFixed(5)}, {form.lng.toFixed(5)}
                </span>
                {form.lat !== 20.5937 || form.lng !== 78.9629 ? (
                  <Check className="size-3.5 text-success" />
                ) : null}
              </div>
              <FieldError>{errors.location}</FieldError>
            </div>
            <div>
              <Label required>State (GST)</Label>
              <StateSelect value={form.stateCode} onChange={(code) => update('stateCode', code)} />
              <FieldError>{errors.stateCode}</FieldError>
            </div>
            <div>
              <Label htmlFor="hours">Operating hours</Label>
              <StoreHoursPicker value={form.hours} onChange={(v) => update('hours', v)} />
            </div>
          </StepCard>
        </TabsContent>

        <TabsContent value="bank">
          <StepCard>
            <div>
              <Label htmlFor="accountName" required>Account holder name</Label>
              <Input
                id="accountName"
                value={sameAsOwner ? form.legalName : form.accountHolderName}
                disabled={sameAsOwner}
                onChange={(e) => update('accountHolderName', e.target.value)}
              />
              <label className="mt-1.5 flex cursor-pointer items-center gap-2 text-[12.5px] text-ink-3">
                <input
                  type="checkbox"
                  className="accent-accent"
                  checked={sameAsOwner}
                  onChange={(e) => {
                    setSameAsOwner(e.target.checked);
                    if (e.target.checked) update('accountHolderName', form.legalName);
                  }}
                />
                Same as owner name
                {form.legalName && <span className="text-ink-4">({form.legalName})</span>}
              </label>
              <FieldError>{errors.accountHolderName}</FieldError>
            </div>
            <div>
              <Label htmlFor="accountNumber" required>Account number</Label>
              <Input
                id="accountNumber"
                mono
                value={form.accountNumber}
                onChange={(e) => update('accountNumber', e.target.value)}
              />
              <FieldError>{errors.accountNumber}</FieldError>
            </div>
            <div>
              <Label htmlFor="ifsc" required>IFSC</Label>
              <Input
                id="ifsc"
                mono
                value={form.ifsc}
                onChange={(e) => update('ifsc', e.target.value.toUpperCase())}
                placeholder="SBIN0001234"
              />
              <FieldError>{errors.ifsc}</FieldError>
            </div>
            <div>
              <Label htmlFor="bankName">Bank name (optional)</Label>
              <Input
                id="bankName"
                value={form.bankName}
                onChange={(e) => update('bankName', e.target.value)}
              />
            </div>
          </StepCard>
        </TabsContent>

        <TabsContent value="platform">
          <StepCard>
            <p className="text-[13px] text-ink-3">
              Admin-only knobs. Defaults match the standard onboarding approval form.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="platformFeeBp" required hint="basis points · 1500 = 15%">
                  Platform fee
                </Label>
                <Input
                  id="platformFeeBp"
                  inputMode="numeric"
                  value={form.platformFeeBp}
                  onChange={(e) => update('platformFeeBp', e.target.value)}
                />
                <FieldError>{errors.platformFeeBp}</FieldError>
              </div>
              <div>
                <Label htmlFor="payoutCadence" required hint="1–30 days">
                  Payout cadence
                </Label>
                <Input
                  id="payoutCadence"
                  inputMode="numeric"
                  value={form.payoutCadenceDays}
                  onChange={(e) => update('payoutCadenceDays', e.target.value)}
                />
                <FieldError>{errors.payoutCadenceDays}</FieldError>
              </div>
            </div>
            <p className="rounded-md bg-info-soft/30 px-3 py-2 text-[12px] text-info">
              On submit, the retailer + store are created in the `active` state. The owner can sign
              in immediately with the credentials set in Step 1. A welcome notification lands in the
              retailer inbox.
            </p>
          </StepCard>
        </TabsContent>
      </Tabs>

      <div className="mt-6 flex items-center justify-between">
        <Button
          variant="ghost"
          disabled={isFirst}
          iconLeft={<ArrowLeft className="size-3.5" />}
          onClick={() => {
            setErrors({});
            const prev = STEPS[idx - 1];
            if (prev) setStep(prev.key);
          }}
        >
          Back
        </Button>
        {isLast ? (
          <Button
            variant="accent"
            loading={create.isPending}
            iconLeft={<Check className="size-4" />}
            onClick={submit}
          >
            Provision store
          </Button>
        ) : (
          <Button variant="ink" iconRight={<ArrowRight className="size-3.5" />} onClick={advance}>
            Continue
          </Button>
        )}
      </div>

      <Suspense fallback={null}>
        {pickerOpen && (
          <MapPicker
            open={pickerOpen}
            initial={{ lat: form.lat, lng: form.lng }}
            onClose={() => setPickerOpen(false)}
            onConfirm={(newLat, newLng) => {
              update('lat', newLat);
              update('lng', newLng);
              if (errors.location)
                setErrors((e) => {
                  const n = { ...e };
                  delete n.location;
                  return n;
                });
              setPickerOpen(false);
            }}
          />
        )}
      </Suspense>
    </Page>
  );
}

function StepCard({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="space-y-4 p-6">{children}</CardContent>
    </Card>
  );
}

function StateSelect({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = INDIAN_STATES.find((s) => s.code === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return INDIAN_STATES;
    return INDIAN_STATES.filter(
      (s) => s.name.toLowerCase().includes(q) || s.code.includes(q),
    );
  }, [query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-line-2 bg-bg px-3 py-2 text-[13.5px] text-ink transition-colors hover:border-line-strong focus:outline-none focus:border-ink focus:ring-2 focus:ring-accent/20"
        >
          {selected ? (
            <span>
              {selected.name}{' '}
              <span className="font-mono text-ink-3 text-[12px]">({selected.code})</span>
            </span>
          ) : (
            <span className="text-ink-4">Select state…</span>
          )}
          <ChevronDown className="size-4 shrink-0 text-ink-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <div className="flex items-center gap-2 border-b border-line px-3 py-2">
          <Search className="size-3.5 shrink-0 text-ink-3" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search state…"
            className="flex-1 bg-transparent text-[13px] text-ink placeholder:text-ink-4 outline-none"
          />
        </div>
        <ul className="max-h-56 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <li className="py-2 text-center text-[12.5px] text-ink-3">No states found</li>
          ) : (
            filtered.map((s) => (
              <li key={s.code}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(s.code);
                    setOpen(false);
                    setQuery('');
                  }}
                  className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-[13px] text-ink hover:bg-bg-3 focus:bg-bg-3 outline-none"
                >
                  <span>{s.name}</span>
                  <span className="font-mono text-[11.5px] text-ink-3">{s.code}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
