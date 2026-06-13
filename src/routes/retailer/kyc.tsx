import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, CheckCircle2, FileText, Loader2, Paperclip, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { uploadMedia } from '@/lib/upload';
import { kycReverificationStatusMeta } from '@/lib/status';
import type { KycReverification, RequiredDocumentType } from '@/lib/types';
import { SectionHeading } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { MetaList } from '@/components/ui/meta-list';

// Mirrors the signup `application.tsx` upload step exactly — same row layout,
// same label-htmlFor trigger pattern, same status chips. Only the slot kinds
// differ (these match the canonical kyc_document enum the server seeds).
const DOC_SLOTS: { kind: RequiredDocumentType; label: string }[] = [
  { kind: 'gstin_certificate', label: 'GSTIN certificate' },
  { kind: 'pan_card', label: 'PAN card' },
  { kind: 'address_proof', label: 'Address proof' },
  { kind: 'cancelled_cheque', label: 'Cancelled cheque' },
  { kind: 'shop_act_license', label: 'Shop-act license' },
];

type LocalUpload = { url: string; filename: string };

/**
 * KYC re-verification cycle (annual / compliance-triggered). Rendered as a
 * section inside the Store settings → KYC page, alongside the compliance
 * documents and fees. No `Page`/`PageHeader` of its own — the host section
 * supplies the heading.
 */
export function KycReverificationPanel() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['retailer', 'kyc'],
    queryFn: () => api<KycReverification | null>('/retailer/kyc'),
  });

  // Per-kind transient state. `local` holds the filename + URL captured right
  // after a successful upload so the row can show the green-check filename chip
  // (mirroring signup). When the cycle reloads, the server-side `documents` row
  // takes over and `local` is no longer consulted for that kind.
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [local, setLocal] = useState<Record<string, LocalUpload>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeKindRef = useRef<string | null>(null);

  const submit = useMutation({
    mutationFn: (id: string) => api(`/retailer/kyc/${id}/submit`, { method: 'POST' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['retailer', 'kyc'] });
      toast.success('KYC submitted for review.');
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Submission failed.'),
  });

  async function persistDoc(id: string, kind: string, url: string): Promise<void> {
    await api(`/retailer/kyc/${id}/documents`, { method: 'POST', body: { kind, url } });
    void qc.invalidateQueries({ queryKey: ['retailer', 'kyc'] });
  }

  async function handleFile(file: File): Promise<void> {
    const kind = activeKindRef.current;
    activeKindRef.current = null;
    if (!kind || !data) return;
    if (data.status !== 'pending') {
      toast.error('Cycle is not accepting uploads.');
      return;
    }
    const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowed.includes(file.type)) {
      toast.error('Use PDF, JPG, or PNG only.');
      return;
    }
    setBusy((b) => ({ ...b, [kind]: true }));
    try {
      const res = await uploadMedia(file, { folder: 'kyc-reverification' });
      setLocal((m) => ({ ...m, [kind]: { url: res.url, filename: file.name } }));
      await persistDoc(data.id, kind, res.url);
      toast.success('Document uploaded.');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : `Failed to upload ${file.name}.`);
    } finally {
      setBusy((b) => ({ ...b, [kind]: false }));
    }
  }

  if (isLoading) {
    return <Skeleton className="h-72" />;
  }

  if (!data) {
    return (
      <Empty
        kicker="All clear"
        title="No re-verification cycle right now."
        description="Trendzo will open a new cycle annually or if compliance flags your account."
      />
    );
  }

  const meta = kycReverificationStatusMeta(data.status);
  const dueIn = Math.round((new Date(data.dueAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const graceIn = Math.round((new Date(data.gracePeriodEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  // Index server docs by kind so the slot list (the canonical 5 from DOC_SLOTS)
  // is what the UI iterates, not whatever order the server returned. Guarantees
  // the same labels + order the retailer saw at signup.
  const serverByKind = new Map(data.documents.map((d) => [d.kind, d]));
  const allUploaded = DOC_SLOTS.every((s) => {
    const srv = serverByKind.get(s.kind);
    return srv ? srv.status !== 'missing' : local[s.kind] != null;
  });
  const canSubmit = data.status === 'pending' && allUploaded;
  const anyBusy = Object.values(busy).some(Boolean);

  return (
    <>
      <p className="mb-4 max-w-3xl text-[13px] text-ink-3 leading-relaxed">
        Annual compliance check. Upload current documents before the due date to avoid suspension.
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="p-6">
            <SectionHeading kicker="Status" title="Current re-verification cycle" />
            <div className="mb-4 flex items-center gap-2">
              <Badge tone={meta.tone}>{meta.label}</Badge>
              <span className="text-[12.5px] text-ink-3">
                <CalendarClock className="inline size-3.5 mr-1" />
                Due in {dueIn} day{dueIn === 1 ? '' : 's'} · Grace ends in {graceIn} days
              </span>
            </div>
            <MetaList
              cols={1}
              items={[
                { label: 'Last verified', value: data.lastVerifiedAt ? new Date(data.lastVerifiedAt).toLocaleDateString() : '—' },
                { label: 'Due date', value: new Date(data.dueAt).toLocaleDateString() },
                { label: 'Grace period ends', value: new Date(data.gracePeriodEndsAt).toLocaleDateString() },
              ]}
            />
            <div className="mt-6">
              <Button
                variant="accent"
                iconLeft={<ShieldCheck className="size-4" />}
                loading={submit.isPending}
                disabled={!canSubmit || anyBusy}
                title={!canSubmit ? 'Upload all required documents first.' : anyBusy ? 'Wait for uploads to finish.' : undefined}
                onClick={() => submit.mutate(data.id)}
              >
                Submit re-verification
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <SectionHeading kicker="Documents" title="Required uploads" />
            <p className="mt-1 text-[12.5px] text-ink-2">
              Upload your GSTIN certificate, PAN card, address proof, cancelled cheque, and shop-act
              license. Each document is stored encrypted and reviewed by the compliance team.
            </p>
            <ul className="mt-4 space-y-2">
              {DOC_SLOTS.map(({ kind, label }) => {
                const srv = serverByKind.get(kind);
                const localUp = local[kind];
                const isBusy = busy[kind] === true;
                const uploadedFilename = localUp?.filename;
                const serverHasFile = srv?.fileUrl != null;
                const statusTone =
                  srv?.status === 'verified' ? 'success'
                  : srv?.status === 'pending_review' ? 'warning'
                  : srv?.status === 'rejected' ? 'danger'
                  : 'neutral';
                return (
                  <li
                    key={kind}
                    className="flex items-center justify-between gap-3 rounded-md border border-line bg-bg-2/30 px-3 py-2"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2 flex-wrap">
                      <span className="text-[13px] text-ink-2 shrink-0">{label}</span>
                      {srv && (
                        <Badge tone={statusTone} flat>
                          {srv.status.replace(/_/g, ' ')}
                        </Badge>
                      )}
                      {uploadedFilename && (
                        <span className="flex items-center gap-1 truncate text-[11.5px] text-success">
                          <CheckCircle2 className="size-3 shrink-0" />
                          <span className="truncate">{uploadedFilename}</span>
                        </span>
                      )}
                      {!uploadedFilename && serverHasFile && (
                        <a
                          href={srv.fileUrl!}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 truncate text-[11.5px] text-ink-3 hover:text-ink hover:underline"
                        >
                          <FileText className="size-3 shrink-0" />
                          View existing file
                        </a>
                      )}
                    </div>
                    {/* Trigger uses <label htmlFor> rather than a programmatic click so the
                        file picker opens inside the original user gesture (Safari is strict
                        about this) and the browser restores the last-used directory. */}
                    <label
                      htmlFor={isBusy || data.status !== 'pending' ? undefined : 'kyc-doc-file-input'}
                      onMouseDown={() => {
                        activeKindRef.current = kind;
                      }}
                      aria-disabled={isBusy || data.status !== 'pending'}
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-[12px] text-ink-2 transition-colors ${
                        isBusy || data.status !== 'pending'
                          ? 'cursor-not-allowed opacity-50'
                          : 'cursor-pointer hover:bg-bg-3'
                      }`}
                    >
                      {isBusy ? (
                        <>
                          <Loader2 className="size-3 animate-spin" /> Uploading…
                        </>
                      ) : uploadedFilename || serverHasFile ? (
                        <>
                          <Paperclip className="size-3" /> Replace
                        </>
                      ) : (
                        <>
                          <Paperclip className="size-3" /> Upload
                        </>
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Single hidden input shared by every slot. activeKindRef (set by the row's
          label onMouseDown) remembers which slot to write the URL into. */}
      <input
        ref={fileInputRef}
        id="kyc-doc-file-input"
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          // Reset so re-picking the same file refires onChange.
          e.target.value = '';
        }}
      />
    </>
  );
}
