import { lazy, Suspense, useEffect, useRef, useState, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronDown, Eye, EyeOff, Loader2, MapPin, Paperclip, Search, Sparkles } from 'lucide-react';
import type { ResubmitSnapshot } from '@/lib/types';
import { Page } from '@/components/ui/page';
import { CopyableId } from '@/components/ui/copyable-id';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label, FieldError } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { api } from '@/lib/api';
import { uploadMedia } from '@/lib/upload';
import { lookupPincode, type PincodeLookup } from '@/lib/pincode';
import { geocodeLocation } from '@/lib/geocode';
import { StoreHoursPicker, DEFAULT_HOURS, hoursConfigToRecord, type HoursConfig } from '@/components/ui/store-hours-picker';

const MapPicker = lazy(() => import('@/components/ui/map-picker'));

// GST state codes (2-digit numeric prefix on GSTIN)
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

type Step = 'identity' | 'business' | 'storefront' | 'bank' | 'docs';

const STEPS: { key: Step; label: string }[] = [
  { key: 'identity', label: '1 · Identity' },
  { key: 'business', label: '2 · Business' },
  { key: 'storefront', label: '3 · Storefront' },
  { key: 'bank', label: '4 · Bank' },
  { key: 'docs', label: '5 · Documents' },
];

type FormState = {
  legalName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  gstin: string;
  pan: string;
  storeName: string;
  contactPhone: string;
  managerName: string;
  hours: HoursConfig;
  address: string;
  pincode: string;
  city: string;
  stateCode: string;
  lat: number;
  lng: number;
  categories: string;
  brandsCarried: string;
  sampleSkus: string;
  accountHolderName: string;
  accountNumber: string;
  ifsc: string;
  bankName: string;
};

const initial: FormState = {
  legalName: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
  gstin: '',
  pan: '',
  storeName: '',
  contactPhone: '',
  managerName: '',
  hours: DEFAULT_HOURS,
  address: '',
  pincode: '',
  city: '',
  stateCode: '',
  lat: 20.5937,
  lng: 78.9629,
  categories: '',
  brandsCarried: '',
  sampleSkus: '',
  accountHolderName: '',
  accountNumber: '',
  ifsc: '',
  bankName: '',
};

type DocKind = 'gst_certificate' | 'pan' | 'address_proof' | 'bank_proof' | 'other';
type UploadedDoc = { url: string; filename: string };

const DOC_SLOTS: { kind: DocKind; label: string }[] = [
  { kind: 'gst_certificate', label: 'GSTIN certificate' },
  { kind: 'pan', label: 'PAN card' },
  { kind: 'address_proof', label: 'Address proof' },
  { kind: 'bank_proof', label: 'Cancelled cheque' },
  { kind: 'other', label: 'Shop-act license' },
];

/**
 * Known-good Cloudinary assets already in our media library — used by the
 * one-click "Fill with mock documents" dev helper so testers don't have to
 * pick 5 real files. URLs cycle across the 5 slots.
 */
const MOCK_DOC_URLS = [
  'https://res.cloudinary.com/dwroh4zkk/image/upload/v1780580209/closetx/applications/q0yea7kfy3wx4qqt91xo.png',
  'https://res.cloudinary.com/dwroh4zkk/image/upload/v1780580212/closetx/applications/my0ia6frucqyaxgfd7u8.png',
  'https://res.cloudinary.com/dwroh4zkk/image/upload/v1780580215/closetx/applications/qgdomrjyzf3khlysg0uo.png',
] as const;

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^(\+91[-\s]?)?[6-9]\d{9}$/;
const PINCODE_RE = /^\d{6}$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

type FieldErrors = Record<string, string>;

function validateStep(
  step: Step,
  form: FormState,
  docs: Partial<Record<DocKind, UploadedDoc>>,
  isReapply: boolean = false,
): FieldErrors {
  const e: FieldErrors = {};
  if (step === 'identity') {
    if (!form.legalName.trim() || form.legalName.trim().length < 2)
      e['legalName'] = 'Full name is required (min 2 characters).';
    if (!form.email.trim())
      e['email'] = 'Email is required.';
    else if (!EMAIL_RE.test(form.email.trim()))
      e['email'] = 'Enter a valid email address.';
    if (!form.phone.trim())
      e['phone'] = 'Phone number is required.';
    else if (!PHONE_RE.test(form.phone.trim()))
      e['phone'] = 'Enter a valid 10-digit Indian mobile number.';
    // Password fields are only collected on first-time signup. On re-apply, the password
    // is verified via the status page (re-entered there) and travels via sessionStorage.
    if (!isReapply) {
      if (!form.password)
        e['password'] = 'Password is required.';
      else if (form.password.length < 8)
        e['password'] = 'Password must be at least 8 characters.';
      if (!form.confirmPassword)
        e['confirmPassword'] = 'Please confirm your password.';
      else if (form.password !== form.confirmPassword)
        e['confirmPassword'] = 'Passwords do not match.';
    }
  }
  if (step === 'business') {
    if (!form.gstin.trim())
      e['gstin'] = 'GSTIN is required.';
    // else if (!GSTIN_RE.test(form.gstin.trim()))
    //   e['gstin'] = 'GSTIN must be 15 characters in format: 22AAAAA0000A1Z5.';
    if (!form.pan.trim())
      e['pan'] = 'PAN is required.';
    else if (!PAN_RE.test(form.pan.trim()))
      e['pan'] = 'PAN must be 10 characters in format: ABCDE1234F.';
  }
  if (step === 'storefront') {
    if (!form.storeName.trim() || form.storeName.trim().length < 2)
      e['storeName'] = 'Store name is required (min 2 characters).';
    if (!form.address.trim() || form.address.trim().length < 5)
      e['address'] = 'Street address is required (min 5 characters).';
    if (!form.pincode.trim())
      e['pincode'] = 'Pincode is required.';
    else if (!PINCODE_RE.test(form.pincode.trim()))
      e['pincode'] = 'Pincode must be exactly 6 digits.';
    if (!form.stateCode.trim())
      e['stateCode'] = 'State is required — enter pincode to auto-fill.';
    if (form.lat === 20.5937 && form.lng === 78.9629)
      e['location'] = 'Pin your store location on the map.';
  }
  if (step === 'bank') {
    if (!form.accountHolderName.trim() || form.accountHolderName.trim().length < 2)
      e['accountHolderName'] = 'Account holder name is required.';
    if (!form.accountNumber.trim())
      e['accountNumber'] = 'Account number is required.';
    else if (form.accountNumber.trim().length < 9 || form.accountNumber.trim().length > 18)
      e['accountNumber'] = 'Account number must be between 9 and 18 digits.';
    if (!form.ifsc.trim())
      e['ifsc'] = 'IFSC code is required.';
    else if (!IFSC_RE.test(form.ifsc.trim()))
      e['ifsc'] = 'IFSC must be 11 characters in format: SBIN0001234.';
  }
  if (step === 'docs') {
    const missing = DOC_SLOTS.filter(({ kind }) => !docs[kind]);
    if (missing.length > 0)
      e['docs'] = `Please upload: ${missing.map((s) => s.label).join(', ')}.`;
  }
  return e;
}

export default function RetailerApplication() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const reapplyId = searchParams.get('reapply');
  const [step, setStep] = useState<Step>('identity');
  const [form, setForm] = useState<FormState>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [sameAsOwner, setSameAsOwner] = useState(false);
  const [docs, setDocs] = useState<Partial<Record<DocKind, UploadedDoc>>>({});
  const [uploading, setUploading] = useState<Partial<Record<DocKind, boolean>>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitted, setSubmitted] = useState<{ email: string; appId: string } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeKindRef = useRef<DocKind | null>(null);
  const [pincodeLookup, setPincodeLookup] = useState<PincodeLookup | null>(null);
  const [pincodeLooking, setPincodeLooking] = useState(false);
  const [pincodeErr, setPincodeErr] = useState<string | null>(null);
  const [storeImages, setStoreImages] = useState<string[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState<{ id: string; name: string; progress: number }[]>([]);

  // ===== Resubmission hydration =====
  // When `?reapply=<id>` is present we expect a ResubmitSnapshot stashed in sessionStorage
  // (written by the application-status page after the password prompt). Hydrate the form,
  // remember the original doc URLs so we can detect "must re-upload" violations on submit,
  // then drop the snapshot key from storage so a stale reload doesn't re-hydrate later.
  const [snapshot, setSnapshot] = useState<ResubmitSnapshot | null>(null);
  const [priorDocUrls, setPriorDocUrls] = useState<Partial<Record<DocKind, string>>>({});
  const mustReupload = useMemo(() => {
    return new Set<DocKind>(
      (snapshot?.application.mustReuploadDocKinds ?? []).filter(
        (k): k is DocKind => k !== 'storefront_photo',
      ) as DocKind[],
    );
  }, [snapshot]);

  useEffect(() => {
    if (!reapplyId) return;
    const raw = sessionStorage.getItem(`reapply:${reapplyId}`);
    if (!raw) return;
    try {
      const snap = JSON.parse(raw) as ResubmitSnapshot;
      setSnapshot(snap);
      const a = snap.application;
      const hoursAsConfig =
        a.hours && typeof a.hours === 'object'
          ? (a.hours as unknown as HoursConfig)
          : DEFAULT_HOURS;
      setForm({
        legalName: a.ownerName ?? a.legalName ?? '',
        email: a.ownerEmail,
        phone: a.ownerPhone,
        password: '',
        confirmPassword: '',
        gstin: a.gstin,
        pan: a.pan ?? '',
        storeName: a.storeName ?? '',
        contactPhone: '',
        managerName: '',
        hours: hoursAsConfig,
        address: a.addressLine,
        pincode: a.pincode,
        city: '',
        stateCode: a.stateCode,
        lat: a.lat ? Number(a.lat) : 20.5937,
        lng: a.lng ? Number(a.lng) : 78.9629,
        categories: (a.categories ?? []).join(', '),
        brandsCarried: (a.brands ?? []).join(', '),
        sampleSkus: '',
        accountHolderName: a.bankLegalName ?? '',
        accountNumber: a.bankAccountNumber ?? '',
        ifsc: a.bankIfsc ?? '',
        bankName: '',
      });
      const seedDocs: Partial<Record<DocKind, UploadedDoc>> = {};
      const seedPriorUrls: Partial<Record<DocKind, string>> = {};
      for (const d of snap.documents) {
        if (d.kind === 'storefront_photo') continue; // not in retailer DOC_SLOTS
        const k = d.kind as DocKind;
        seedDocs[k] = { url: d.url, filename: d.url.split('/').pop() ?? 'previously uploaded file' };
        seedPriorUrls[k] = d.url;
      }
      setDocs(seedDocs);
      setPriorDocUrls(seedPriorUrls);
      sessionStorage.removeItem(`reapply:${reapplyId}`);
    } catch {
      toast.error('Could not load your prior submission. Please re-apply from the status page.');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reapplyId]);

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
        if (!res) { setPincodeLookup(null); setPincodeErr('No location found for that PIN code.'); return; }
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
      .catch(() => { if (!cancelled) setPincodeErr("Couldn't reach PIN code service — try again."); })
      .finally(() => { if (!cancelled) setPincodeLooking(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.pincode]);

  const idx = STEPS.findIndex((s) => s.key === step);
  const isLast = idx === STEPS.length - 1;
  const isFirst = idx === 0;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => { const n = { ...e }; delete n[key]; return n; });
  }

  const [checkingIdentity, setCheckingIdentity] = useState(false);

  async function advance() {
    const errs = validateStep(step, form, docs, Boolean(reapplyId));
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      toast.error('Please fix the errors before continuing.');
      return;
    }

    // Identity-step pre-check: surface collisions before the user fills out 4 more steps.
    // Skip on reapply (the row is owned by the applicant already; submit will update in place).
    if (step === 'identity' && !reapplyId) {
      setCheckingIdentity(true);
      try {
        const params = new URLSearchParams({
          email: form.email.trim(),
          phone: form.phone.trim(),
        });
        const result = await api<{
          emailTaken: boolean;
          phoneTaken: boolean;
          accountExists: boolean;
          applicationStatus: string | null;
          applicationId: string | null;
        }>(`/applications/check-identity?${params.toString()}`);

        if (result.emailTaken || result.phoneTaken) {
          const fieldErrs: FieldErrors = {};
          if (result.accountExists) {
            const msg = 'An approved retailer account already exists with these details. Sign in instead.';
            if (result.emailTaken) fieldErrs['email'] = msg;
            if (result.phoneTaken) fieldErrs['phone'] = msg;
            toast.error(msg);
          } else if (result.applicationStatus === 'rejected') {
            const msg = 'A previous application was rejected. Use the status page to re-apply on the same record.';
            if (result.emailTaken) fieldErrs['email'] = msg;
            if (result.phoneTaken) fieldErrs['phone'] = msg;
            toast.error(msg);
          } else {
            const msg = 'An application with this email or phone is already on file. Check your status page.';
            if (result.emailTaken) fieldErrs['email'] = msg;
            if (result.phoneTaken) fieldErrs['phone'] = msg;
            toast.error(msg);
          }
          setErrors(fieldErrs);
          return;
        }
      } catch {
        toast.error('Could not verify email/phone availability. Try again.');
        return;
      } finally {
        setCheckingIdentity(false);
      }
    }

    setErrors({});
    const next = STEPS[idx + 1];
    if (next) setStep(next.key);
  }

  async function handleDocUpload(kind: DocKind, file: File) {
    setUploading((u) => ({ ...u, [kind]: true }));
    try {
      const result = await uploadMedia(file, { folder: 'applications' });
      setDocs((d) => ({ ...d, [kind]: { url: result.url, filename: result.filename } }));
      if (errors['docs']) setErrors((e) => { const n = { ...e }; delete n['docs']; return n; });
    } catch {
      toast.error(`Failed to upload ${file.name}. Please try again.`);
    } finally {
      setUploading((u) => ({ ...u, [kind]: false }));
    }
  }

  /**
   * Dev/test helper — fills the ACTIVE step with realistic, validation-passing
   * mock data in one click. Values land in the same controlled `form` state as
   * manual typing, so every field stays fully editable afterwards. Email and
   * phone carry a timestamp suffix so repeated runs never trip the duplicate
   * application / account collision checks at submit.
   */
  function fillMockStep() {
    if (step === 'docs') {
      fillMockDocs();
      return;
    }
    const stamp = Date.now();
    const phoneSuffix = String(stamp).slice(-9);
    if (step === 'identity') {
      setForm((f) => ({
        ...f,
        legalName: 'Asha Mehta',
        email: `asha.mehta+${stamp}@example.com`,
        phone: `9${phoneSuffix}`,
        ...(reapplyId ? {} : { password: 'Mock@1234', confirmPassword: 'Mock@1234' }),
      }));
    } else if (step === 'business') {
      setForm((f) => ({
        ...f,
        gstin: '27ABCDE1234F1Z5',
        pan: 'ABCDE1234F',
      }));
    } else if (step === 'storefront') {
      setForm((f) => ({
        ...f,
        storeName: 'Asha Fashion Studio',
        address: '42 Linking Road, Bandra West',
        pincode: '400050',
        city: 'Mumbai',
        stateCode: '27',
        // Bandra, Mumbai — distinct from the India-centroid default so the
        // "pin your location" validation passes.
        lat: 19.0596,
        lng: 72.8295,
        contactPhone: `9${phoneSuffix}`,
        managerName: 'Asha Mehta',
        categories: 'Apparel, Footwear',
        brandsCarried: 'House label',
      }));
    } else if (step === 'bank') {
      setForm((f) => ({
        ...f,
        // Penny-drop compares holder name to legal name — keep them aligned.
        accountHolderName: f.legalName.trim() || 'Asha Mehta',
        accountNumber: '123456789012',
        ifsc: 'HDFC0001234',
        bankName: 'HDFC Bank',
      }));
    }
    setErrors({});
    toast.success('Step filled with mock data — every field stays editable.');
  }

  /**
   * Dev/test helper — fills every empty (or stale-flagged) document slot with a
   * known-good Cloudinary asset in ONE click, so testers don't have to pick
   * five real files to reach Submit. Cycles across the mock URLs and stamps a
   * per-slot filename so each row reads distinctly in the UI and admin review.
   */
  function fillMockDocs() {
    // Cache-buster keeps each fill unique so a re-apply after a previous
    // mock-filled submission never trips the "old file shown" staleness check
    // (Cloudinary serves the asset regardless of unknown query params).
    const stamp = Date.now();
    setDocs(() => {
      const next: Partial<Record<DocKind, UploadedDoc>> = {};
      DOC_SLOTS.forEach(({ kind }, i) => {
        next[kind] = {
          url: `${MOCK_DOC_URLS[i % MOCK_DOC_URLS.length]!}?mock=${stamp}`,
          filename: `mock-${kind}.png`,
        };
      });
      return next;
    });
    if (errors['docs']) setErrors((e) => { const n = { ...e }; delete n['docs']; return n; });
    toast.success('All 5 documents filled with mock files.');
  }

  async function submit() {
    const anyUploading = Object.values(uploading).some(Boolean);
    if (anyUploading) {
      toast.info('Uploads in progress — please wait before submitting.');
      return;
    }
    const errs = validateStep('docs', form, docs, Boolean(reapplyId));
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      toast.error('Please fix the errors before submitting.');
      return;
    }

    // Resubmission: enforce that flagged kinds have *new* uploads, not the pre-filled prior URLs.
    if (reapplyId && mustReupload.size > 0) {
      const stillStale: string[] = [];
      for (const kind of mustReupload) {
        const current = docs[kind]?.url;
        const prior = priorDocUrls[kind];
        if (!current || (prior && current === prior)) {
          stillStale.push(DOC_SLOTS.find((s) => s.kind === kind)?.label ?? kind);
        }
      }
      if (stillStale.length > 0) {
        toast.error(
          `Admin asked you to replace these documents: ${stillStale.join(', ')}. Upload new files before resubmitting.`,
        );
        setStep('docs');
        return;
      }
    }

    setSubmitting(true);
    try {
      const documents = Object.entries(docs).map(([kind, d]) => ({ kind: kind as DocKind, url: d!.url }));
      const baseBody = {
        legalName: form.legalName.trim(),
        storeName: form.storeName.trim(),
        gstin: form.gstin.trim(),
        pan: form.pan.trim(),
        ownerName: form.legalName.trim(),
        ownerEmail: form.email.trim(),
        ownerPhone: form.phone.trim(),
        addressLine: form.address.trim(),
        pincode: form.pincode.trim(),
        stateCode: form.stateCode.trim(),
        lat: String(form.lat),
        lng: String(form.lng),
        hours: hoursConfigToRecord(form.hours),
        ...(form.contactPhone.trim() ? { contactPhone: form.contactPhone.trim() } : {}),
        ...(form.managerName.trim() ? { managerName: form.managerName.trim() } : {}),
        bankLegalName: form.accountHolderName.trim() || undefined,
        bankAccountNumber: form.accountNumber.trim() || undefined,
        bankIfsc: form.ifsc.trim() || undefined,
        documents,
      };

      let appId: string;
      if (reapplyId) {
        // Resubmit: identity proved with email+password (stashed by the status page).
        const password = sessionStorage.getItem(`reapply-pw:${reapplyId}`) ?? '';
        if (!password) {
          toast.error('Re-application session expired. Open the status page again to retry.');
          setSubmitting(false);
          return;
        }
        const result = await api<{ id: string; status: string }>(
          `/applications/${reapplyId}/resubmit`,
          {
            method: 'POST',
            body: { ...baseBody, email: form.email.trim(), password },
          },
        );
        sessionStorage.removeItem(`reapply-pw:${reapplyId}`);
        appId = result.id;
      } else {
        const result = await api<{ id: string }>('/applications', {
          method: 'POST',
          body: { ...baseBody, password: form.password },
        });
        appId = result.id;
      }
      setSubmitted({ email: form.email.trim(), appId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <Page>
        <div className="mx-auto max-w-lg py-16 text-center space-y-5">
          <div className="inline-grid size-14 place-items-center rounded-full bg-success/10 text-success mx-auto">
            <Check className="size-7" />
          </div>
          <h1 className="font-display italic text-[28px] text-ink">Application submitted</h1>
          <p className="text-[13.5px] text-ink-2">
            We received your application. The Trendzo compliance team will review your documents
            and reach out to <strong>{submitted.email}</strong> within 2–3 business days.
          </p>
          <div className="rounded-lg border border-info/30 bg-info-soft/20 px-4 py-3 text-left space-y-1.5">
            <p className="text-[13px] font-medium text-ink">What happens next?</p>
            <ul className="text-[12.5px] text-ink-2 space-y-1 list-disc list-inside">
              <li>Admin reviews your GSTIN, PAN, and bank details.</li>
              <li>You may receive a clarification request via email if anything needs correction.</li>
              <li>Once approved, your account is activated and you can log in with the password you just set.</li>
            </ul>
          </div>
          <Button variant="accent" className="mt-2" onClick={() => navigate('/retailer/login')}>
            Go to sign in
          </Button>

          {/* Submission reference */}
          <div className="rounded-lg border border-line bg-bg p-5 text-left space-y-3 mt-2">
            <p className="kicker text-ink-3">Submitted application</p>
            <div className="flex items-center justify-between gap-4">
              <span className="text-[11px] uppercase tracking-[0.12em] text-ink-3">Application ID</span>
              <CopyableId value={submitted.appId} label="application id" className="text-[12px] [&>span]:max-w-none" />
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-[11px] uppercase tracking-[0.12em] text-ink-3">Email</span>
              <span className="text-[13px] text-ink-2">{submitted.email}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-[11px] uppercase tracking-[0.12em] text-ink-3">Status</span>
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide bg-warning/10 text-warning">pending review</span>
            </div>
          </div>
        </div>
      </Page>
    );
  }

  return (
    <Page>
      {/* Top bar — only visible on mobile */}
      <div className="mb-6 flex items-center justify-between lg:hidden">
        <div>
          <div className="kicker text-ink-3">Onboarding</div>
          <h1 className="mt-0.5 font-display italic text-[22px] text-ink leading-tight">Retailer application</h1>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link to="/">Sign in</Link>
        </Button>
      </div>

      <div className="grid gap-10 lg:grid-cols-[280px_1fr] lg:gap-16 lg:items-start">
        {/* ── Left rail — editorial, sticky on desktop ── */}
        <aside className="hidden lg:block lg:sticky lg:top-8">
          <Button asChild variant="ghost" size="sm" className="mb-8 -ml-2 text-ink-3">
            <Link to="/">← Sign in</Link>
          </Button>

          <div className="kicker mb-4 text-ink-3 tracking-[0.18em]">Onboarding</div>
          <h1 className="editorial text-[52px] leading-[1.0] tracking-tight text-ink">
            Retailer<br /><em>application</em>
          </h1>

          <p className="mt-6 text-[13.5px] leading-relaxed text-ink-2 max-w-[220px]">
            Complete every step. Admin reviews each section and may request clarification — track responses on your dashboard.
          </p>

          {/* Step progress strip */}
          <div className="mt-10 space-y-1">
            {STEPS.map((s, i) => {
              const done = i < idx;
              const active = s.key === step;
              return (
                <div
                  key={s.key}
                  className={`flex items-center gap-3 rounded-md px-2.5 py-2 text-[12.5px] transition-colors ${active ? 'bg-ink/6 text-ink font-medium' : done ? 'text-ink-3' : 'text-ink-4'}`}
                >
                  <span
                    className={`inline-flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-mono transition-colors ${active ? 'border-ink bg-ink text-surface' : done ? 'border-success bg-success/10 text-success' : 'border-line-strong'}`}
                  >
                    {done ? '✓' : i + 1}
                  </span>
                  {s.label.split(' · ')[1]}
                </div>
              );
            })}
          </div>

          {/* Decorative vertical rule */}
          <div className="mt-10 h-px w-full bg-gradient-to-r from-ink/10 via-ink/5 to-transparent" />
          <p className="mt-4 text-[11px] uppercase tracking-[0.16em] text-ink-4">Trendzo Partner Portal</p>
        </aside>

        {/* ── Right side — the actual form ── */}
        <div>
      {reapplyId && snapshot && (
        <div className="mb-5 rounded-md border border-warning/40 bg-warning/5 px-4 py-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
            <div className="space-y-1.5">
              <div className="text-[13px] font-semibold text-ink">
                Re-applying — address the issues below before resubmitting
              </div>
              {snapshot.application.decisionReason && (
                <div className="text-[12.5px] text-ink-2 leading-relaxed">
                  <span className="text-ink-3">Prior rejection: </span>
                  <em>"{snapshot.application.decisionReason}"</em>
                </div>
              )}
              {mustReupload.size > 0 && (
                <div className="text-[12px] text-ink-2">
                  <span className="text-ink-3">Documents to replace: </span>
                  {Array.from(mustReupload)
                    .map((k) => DOC_SLOTS.find((s) => s.kind === k)?.label ?? k)
                    .join(', ')}
                </div>
              )}
              <div className="text-[11.5px] text-ink-3">
                Submission #{snapshot.application.resubmissionCount + 1} · password not required again
              </div>
            </div>
          </div>
        </div>
      )}
      <Tabs value={step} onValueChange={(v) => setStep(v as Step)}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList className="overflow-x-auto whitespace-nowrap">
            {STEPS.map((s) => <TabsTrigger key={s.key} value={s.key}>{s.label}</TabsTrigger>)}
          </TabsList>
          <button
            type="button"
            onClick={fillMockStep}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-dashed border-line-strong px-2.5 py-1 text-[12px] text-ink-3 transition-colors hover:bg-bg-3 hover:text-ink"
            title="Dev helper — fills this step with sample data; every field stays editable"
          >
            <Sparkles className="size-3" /> Fill step with mock data
          </button>
        </div>

        <TabsContent value="identity">
          <StepCard>
            <div>
              <Label htmlFor="ownerName" required>Owner full name</Label>
              <Input id="ownerName" value={form.legalName} onChange={(e) => update('legalName', e.target.value)} />
              <FieldError>{errors['legalName']}</FieldError>
            </div>
            <div>
              <Label htmlFor="email" required>Email</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} />
              <FieldError>{errors['email']}</FieldError>
            </div>
            <div>
              <Label htmlFor="phone" required>Phone</Label>
              <Input id="phone" value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="9876543210" />
              <FieldError>{errors['phone']}</FieldError>
            </div>
            {!reapplyId && (
              <>
                <div>
                  <Label htmlFor="password" required hint="min 8 characters">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={(e) => update('password', e.target.value)}
                      className="pr-9"
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
                  <FieldError>{errors['password']}</FieldError>
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
                  <FieldError>{errors['confirmPassword']}</FieldError>
                </div>
              </>
            )}
          </StepCard>
        </TabsContent>

        <TabsContent value="business">
          <StepCard>
            <div>
              <Label htmlFor="gstin" required>GSTIN</Label>
              <Input id="gstin" mono value={form.gstin} onChange={(e) => update('gstin', e.target.value.toUpperCase())} placeholder="22AAAAA0000A1Z5" />
              <FieldError>{errors['gstin']}</FieldError>
            </div>
            <div>
              <Label htmlFor="pan" required>PAN</Label>
              <Input id="pan" mono value={form.pan} onChange={(e) => update('pan', e.target.value.toUpperCase())} placeholder="ABCDE1234F" />
              <FieldError>{errors['pan']}</FieldError>
            </div>
          </StepCard>
        </TabsContent>

        <TabsContent value="storefront">
          <StepCard>
            <div>
              <Label htmlFor="sf-store-name" required hint="what customers see">Store name</Label>
              <Input id="sf-store-name" value={form.storeName} onChange={(e) => update('storeName', e.target.value)} placeholder="Patel Fashion" />
              <FieldError>{errors['storeName']}</FieldError>
            </div>
            <div>
              <Label htmlFor="sf-address" required>Street address</Label>
              <Input id="sf-address" value={form.address} onChange={(e) => update('address', e.target.value)} placeholder="42 Linking Rd, Bandra West" />
              <FieldError>{errors['address']}</FieldError>
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
                <FieldError>{errors['pincode'] ?? pincodeErr ?? undefined}</FieldError>
              </div>
              <div>
                <Label>City · State</Label>
                <div className={`flex h-10 items-center rounded-md border px-3 text-[13.5px] ${pincodeLookup ? 'border-success/40 text-ink' : 'border-line text-ink-3 italic'}`}>
                  {pincodeLookup
                    ? <><span className="font-medium">{pincodeLookup.city}</span><span className="mx-1.5 text-ink-4">·</span><span>{pincodeLookup.state}</span></>
                    : 'Auto-filled from pincode'}
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
              <FieldError>{errors['location']}</FieldError>
            </div>
            <div>
              <Label required>State (GST)</Label>
              <StateSelect value={form.stateCode} onChange={(code) => update('stateCode', code)} />
              <FieldError>{errors['stateCode']}</FieldError>
            </div>
            <div>
              <Label htmlFor="hours">Operating hours</Label>
              <StoreHoursPicker value={form.hours} onChange={(v) => update('hours', v)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <Label htmlFor="sf-contact-phone" hint="shown to customers" className="mb-0">Contact phone</Label>
                  {form.phone && form.contactPhone !== form.phone && (
                    <button
                      type="button"
                      className="shrink-0 text-[11px] text-info hover:underline"
                      onClick={() => update('contactPhone', form.phone)}
                    >
                      Use owner's number
                    </button>
                  )}
                </div>
                <Input id="sf-contact-phone" value={form.contactPhone} onChange={(e) => update('contactPhone', e.target.value)} placeholder="9876543210" />
              </div>
              <div>
                <Label htmlFor="sf-manager-name" hint="store manager">Manager name</Label>
                <Input id="sf-manager-name" value={form.managerName} onChange={(e) => update('managerName', e.target.value)} placeholder="Ramesh Patel" />
              </div>
            </div>
            <div className="rounded-md bg-info-soft/30 px-3 py-2 text-[12px] text-info">
              Contact phone and manager name are optional — you can update them later from the store settings.
            </div>
            <div>
              <Label hint="optional, add up to 5">Store photos</Label>
              <div className="space-y-2">
                {storeImages.map((url, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-md border border-line bg-bg-2/30 px-3 py-2">
                    <img src={url} alt={`Store photo ${i + 1}`} className="h-10 w-14 rounded object-cover" />
                    <span className="flex-1 truncate text-[12px] text-ink-2">{url.split('/').pop()}</span>
                    <button type="button" onClick={() => setStoreImages((imgs) => imgs.filter((_, j) => j !== i))} className="text-[11px] text-danger hover:underline">Remove</button>
                  </div>
                ))}
                {uploadingPhotos.map((u) => (
                  <div key={u.id} className="rounded-md border border-line bg-bg-2/30 px-3 py-2">
                    <div className="mb-1.5 flex items-center gap-2">
                      <div className="h-10 w-14 shrink-0 animate-pulse rounded bg-line" />
                      <span className="flex-1 truncate text-[12px] text-ink-3">{u.name}</span>
                      <span className="shrink-0 text-[11px] tabular-nums text-ink-3">{u.progress}%</span>
                    </div>
                    <div className="h-[3px] overflow-hidden rounded-full bg-line">
                      <div
                        className="h-full rounded-full bg-ink transition-[width] duration-200 ease-out"
                        style={{ width: `${u.progress}%` }}
                      />
                    </div>
                  </div>
                ))}
                {storeImages.length + uploadingPhotos.length < 5 && (
                  <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-line px-3 py-2.5 text-[13px] text-ink-3 hover:bg-bg-3">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const tempId = crypto.randomUUID();
                        setUploadingPhotos((prev) => [...prev, { id: tempId, name: file.name, progress: 0 }]);
                        try {
                          const { url } = await uploadMedia(file, {
                            folder: 'store-gallery',
                            onProgress: (pct) =>
                              setUploadingPhotos((prev) =>
                                prev.map((u) => (u.id === tempId ? { ...u, progress: pct } : u)),
                              ),
                          });
                          setStoreImages((imgs) => [...imgs, url]);
                        } catch {
                          toast.error('Image upload failed');
                        } finally {
                          setUploadingPhotos((prev) => prev.filter((u) => u.id !== tempId));
                          e.target.value = '';
                        }
                      }}
                    />
                    <Paperclip className="size-3.5" /> Add photo
                  </label>
                )}
                <p className="text-[11.5px] text-ink-4">
                  Photos help customers recognize your store. You can add or update them later in Store settings.
                </p>
              </div>
            </div>
          </StepCard>
        </TabsContent>

        {/* <TabsContent value="catalog">
          <StepCard>
            <div>
              <Label htmlFor="categories" hint="comma separated">Categories you sell</Label>
              <Input id="categories" value={form.categories} onChange={(e) => update('categories', e.target.value)} placeholder="kurta, sherwani, lehenga" />
            </div>
            <div>
              <Label htmlFor="brands" hint="comma separated">Brands carried</Label>
              <Input id="brands" value={form.brandsCarried} onChange={(e) => update('brandsCarried', e.target.value)} placeholder="Aurora, Indigo, Saffron" />
            </div>
            <div>
              <Label htmlFor="skus" hint="paste up to 10 SKU codes">Sample SKUs</Label>
              <Textarea id="skus" rows={4} value={form.sampleSkus} onChange={(e) => update('sampleSkus', e.target.value)} />
            </div>
          </StepCard>
        </TabsContent> */}

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
              <FieldError>{errors['accountHolderName']}</FieldError>
            </div>
            <div>
              <Label htmlFor="accountNumber" required>Account number</Label>
              <Input id="accountNumber" mono value={form.accountNumber} onChange={(e) => update('accountNumber', e.target.value)} />
              <FieldError>{errors['accountNumber']}</FieldError>
            </div>
            <div>
              <Label htmlFor="ifsc" required>IFSC</Label>
              <Input id="ifsc" mono value={form.ifsc} onChange={(e) => update('ifsc', e.target.value.toUpperCase())} placeholder="SBIN0001234" />
              <FieldError>{errors['ifsc']}</FieldError>
            </div>
            <div>
              <Label htmlFor="bankName">Bank name</Label>
              <Input id="bankName" value={form.bankName} onChange={(e) => update('bankName', e.target.value)} />
            </div>
            <p className="rounded-md bg-info-soft/30 px-3 py-2 text-[12px] text-info">
              Penny-drop verification runs after submit. If the name on the bank statement
              does not match your legal name, admin may request a clarification.
            </p>
          </StepCard>
        </TabsContent>

        <TabsContent value="docs">
          <StepCard>
            <p className="text-[13px] text-ink-2">
              Upload your GSTIN certificate, PAN card, address proof, cancelled cheque, and shop-act
              license. Each document is stored encrypted and reviewed by the compliance team.
            </p>
            {errors['docs'] && (
              <p className="text-[12.5px] text-danger">{errors['docs']}</p>
            )}
            <ul className="space-y-2">
              {DOC_SLOTS.map(({ kind, label }) => {
                const uploaded = docs[kind];
                const busy = uploading[kind];
                const flaggedForReplace = mustReupload.has(kind);
                const stillStale =
                  flaggedForReplace &&
                  uploaded != null &&
                  priorDocUrls[kind] === uploaded.url;
                return (
                  <li
                    key={kind}
                    className={`flex items-center justify-between rounded-md border px-3 py-2 ${
                      flaggedForReplace
                        ? 'border-warning/50 bg-warning/5'
                        : 'border-line bg-bg-2/30'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                      <span className="text-[13px] text-ink-2 shrink-0">{label}</span>
                      {flaggedForReplace && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wide text-warning">
                          <AlertTriangle className="size-3" /> must replace
                        </span>
                      )}
                      {uploaded && !stillStale && (
                        <span className="flex items-center gap-1 truncate text-[11.5px] text-success">
                          <CheckCircle2 className="size-3 shrink-0" />
                          <span className="truncate">{uploaded.filename}</span>
                        </span>
                      )}
                      {stillStale && (
                        <span className="text-[11.5px] text-warning">
                          Old file shown — upload a new one
                        </span>
                      )}
                    </div>
                    <label
                      htmlFor={busy ? undefined : 'doc-file-input'}
                      onMouseDown={() => { activeKindRef.current = kind; }}
                      aria-disabled={!!busy}
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-[12px] text-ink-2 transition-colors ${busy ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-bg-3'}`}
                    >
                      {busy ? (
                        <><Loader2 className="size-3 animate-spin" /> Uploading…</>
                      ) : uploaded ? (
                        <><Paperclip className="size-3" /> Replace</>
                      ) : (
                        <><Paperclip className="size-3" /> Upload</>
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>
          </StepCard>
        </TabsContent>
      </Tabs>

      {/* Mounted outside TabsContent so the browser retains the last-used directory
          regardless of tab navigation. Triggered via <label htmlFor> (native user
          gesture) so browsers restore the last-opened folder correctly. */}
      <input
        ref={fileInputRef}
        id="doc-file-input"
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          const kind = activeKindRef.current;
          if (file && kind) void handleDocUpload(kind, file);
          e.target.value = '';
          activeKindRef.current = null;
        }}
      />

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
          <Button variant="accent" loading={submitting} iconLeft={<Check className="size-4" />} onClick={() => void submit()}>
            {reapplyId ? 'Resubmit application' : 'Submit application'}
          </Button>
        ) : (
          <Button variant="ink" loading={checkingIdentity} iconRight={<ArrowRight className="size-3.5" />} onClick={() => void advance()}>
            Continue
          </Button>
        )}
        </div>

        </div> {/* end right col */}
      </div> {/* end grid */}

      <Suspense fallback={null}>
        {pickerOpen && (
          <MapPicker
            open={pickerOpen}
            initial={{ lat: form.lat, lng: form.lng }}
            onClose={() => setPickerOpen(false)}
            onConfirm={(newLat, newLng) => {
              update('lat', newLat);
              update('lng', newLng);
              if (errors['location']) setErrors((e) => { const n = { ...e }; delete n['location']; return n; });
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
          className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-line-2 bg-bg px-3 py-2 text-[13.5px] text-ink transition-colors hover:border-line-strong focus:outline-none focus:border-ink focus:ring-2 focus:ring-accent/20 data-[placeholder]:text-ink-4"
        >
          {selected ? (
            <span>{selected.name} <span className="font-mono text-ink-3 text-[12px]">({selected.code})</span></span>
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
                  onClick={() => { onChange(s.code); setOpen(false); setQuery(''); }}
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
