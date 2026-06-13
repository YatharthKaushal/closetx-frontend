import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, ExternalLink, FileText, MessageSquare, ShieldAlert } from 'lucide-react';
import { api } from '@/lib/api';
import { applicationStatusMeta, formatAge } from '@/lib/status';
import type { Application, ApplicationDocument, ClarificationMessage } from '@/lib/types';
import { Page, PageHeader, SectionHeading } from '@/components/ui/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { MetaList } from '@/components/ui/meta-list';
import { CopyableId } from '@/components/ui/copyable-id';
import { ClarificationRequestDialog } from '@/components/admin/clarification-request-dialog';
import { ClarificationThread } from '@/components/admin/clarification-thread';
import { RejectApplicationDialog } from '@/components/admin/reject-application-dialog';
import type { ApplicationDocumentKind } from '@/lib/types';

const FIELD_OPTIONS = [
  { value: 'legal_name', label: 'Legal name' },
  { value: 'gstin', label: 'GSTIN' },
  { value: 'pan', label: 'PAN' },
  { value: 'address', label: 'Address' },
  { value: 'bank', label: 'Bank account' },
  { value: 'documents', label: 'Documents' },
];

type ApplicationDetail = Application & { messages?: ClarificationMessage[]; documents?: ApplicationDocument[] };

export default function AdminApplicationsDetail() {
  const { id } = useParams<{ id: string }>();
  const [rejecting, setRejecting] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const queryClient = useQueryClient();

  const appQuery = useQuery({
    queryKey: ['admin', 'applications', id],
    queryFn: () => api<ApplicationDetail>(`/admin/applications/${id}`),
    enabled: Boolean(id),
  });

  const approveMutation = useMutation({
    mutationFn: () => api(`/admin/applications/${id}/approve`, { method: 'POST', body: {} }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'applications', id] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'applications'] });
      toast.success('Application approved.');
    },
    onError: () => toast.error('Failed to approve application.'),
  });

  const rejectMutation = useMutation({
    mutationFn: (body: { reason: string; mustReuploadDocKinds: ApplicationDocumentKind[] }) =>
      api(`/admin/applications/${id}/reject`, { method: 'POST', body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'applications', id] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'applications'] });
      toast.success('Application rejected.');
      setRejecting(false);
    },
    onError: () => toast.error('Failed to reject application.'),
  });

  const clarifyMutation = useMutation({
    mutationFn: ({ fieldKey, question }: { fieldKey: string; question: string }) =>
      api(`/admin/applications/${id}/clarifications`, { method: 'POST', body: { fieldKey, question } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'applications', id] });
      toast.success('Clarification request sent.');
      setRequesting(false);
    },
    onError: () => toast.error('Failed to send clarification request.'),
  });

  if (!id) return <Page><PageHeader title="Missing id" /></Page>;
  if (appQuery.isLoading) return <Page><Skeleton className="h-60" /></Page>;
  if (!appQuery.data) {
    return (
      <Page>
        <PageHeader title="Application not found" />
        <Card><CardContent className="p-6 text-[13px] text-ink-3">No application matches this id.</CardContent></Card>
      </Page>
    );
  }

  const a = appQuery.data;
  const meta = applicationStatusMeta(a.status);
  const messages: ClarificationMessage[] = a.messages ?? [];

  return (
    <Page>
      <PageHeader
        kicker="Onboarding"
        title={a.legalName}
        description={`Submitted ${formatAge(a.submittedAt)} · ${a.email} · ${a.phone}`}
        actions={
          <Button asChild variant="ghost" size="sm" iconLeft={<ArrowLeft className="size-3.5" />}>
            <Link to="/admin/compliance?tab=applications">Back to queue</Link>
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={meta.tone} pulse={a.status === 'pending' || a.status === 'docs_requested'}>{meta.label}</Badge>
        <CopyableId value={a.id} label="application id" />
        <Badge tone={a.pennyDropResult === 'matched' ? 'success' : 'warning'} flat>
          Penny drop: {a.pennyDropResult.replace(/_/g, ' ')}
        </Badge>
        <Badge tone={a.gstinVerification === 'valid' ? 'success' : a.gstinVerification === 'invalid' ? 'danger' : 'warning'} flat>
          GSTIN: {a.gstinVerification}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
        <Card>
          <CardContent className="p-6">
            <SectionHeading kicker="Profile" title="Submitted details" />
            <MetaList
              cols={1}
              items={[
                { label: 'Legal name', value: a.legalName },
                { label: 'Email', value: a.email },
                { label: 'Phone', value: a.phone },
                { label: 'GSTIN', value: a.gstin, mono: true },
                { label: 'PAN', value: a.pan ?? '—', mono: true },
                { label: 'Address', value: `${a.addressLine}, ${a.pincode}` },
                { label: 'State code', value: a.stateCode, mono: true },
                { label: 'Documents', value: `${a.documentsCount}/5 uploaded` },
              ]}
            />
            {a.documents && a.documents.length > 0 && (
              <div className="mt-5">
                <div className="kicker mb-2">Uploaded documents</div>
                <ul className="space-y-1.5">
                  {a.documents.map((doc) => (
                    <li key={doc.id}>
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-md border border-line bg-bg-2/40 px-3 py-2 text-[13px] text-ink hover:border-line-strong hover:bg-bg-2 transition-colors"
                      >
                        <FileText className="size-3.5 shrink-0 text-ink-3" />
                        <span className="flex-1 capitalize">{doc.kind.replace(/_/g, ' ')}</span>
                        <ExternalLink className="size-3 text-ink-4" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-2">
              <Button
                variant="accent"
                disabled={approveMutation.isPending}
                onClick={() => approveMutation.mutate()}
              >
                Approve
              </Button>
              <Button
                variant="outline"
                iconLeft={<MessageSquare className="size-3.5" />}
                onClick={() => setRequesting(true)}
              >
                Request clarification
              </Button>
              <Button
                variant="outline"
                iconLeft={<ShieldAlert className="size-3.5" />}
                className="text-danger border-danger/40 hover:bg-danger/5"
                onClick={() => setRejecting(true)}
              >
                Reject
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <SectionHeading
              kicker="Clarification"
              title="Conversation with applicant"
              hint={messages.length ? `${messages.length} messages` : undefined}
            />
            <ClarificationThread messages={messages} />
          </CardContent>
        </Card>
      </div>

      <RejectApplicationDialog
        open={rejecting}
        loading={rejectMutation.isPending}
        onClose={() => setRejecting(false)}
        onConfirm={({ reason, mustReuploadDocKinds }) =>
          rejectMutation.mutate({ reason, mustReuploadDocKinds })
        }
      />
      <ClarificationRequestDialog
        open={requesting}
        fields={FIELD_OPTIONS}
        onClose={() => setRequesting(false)}
        onConfirm={({ fieldKey, question }) => clarifyMutation.mutate({ fieldKey, question })}
      />
    </Page>
  );
}
