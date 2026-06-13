import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { api } from '@/lib/api';
import { formatPaise } from '@/lib/status';
import type { TaxInvoice } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { CopyableId } from '@/components/ui/copyable-id';

/** Body-only renderer (see TaxInvoicesBody for the rationale). */
export function CommissionInvoicesBody() {
  const { data, isLoading } = useQuery({
    queryKey: ['retailer', 'commission-invoices'],
    queryFn: () => api<TaxInvoice[]>('/retailer/invoices?kind=commission'),
  });
  const list = data ?? [];

  return (
    <>
      {isLoading ? <Skeleton className="h-32" /> : list.length === 0 ? (
        <Empty kicker="None" title="No commission invoices yet." />
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-[12.5px]">
              <thead className="bg-bg-2/40">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-ink-3">Number</th>
                  <th className="px-3 py-2 text-left font-medium text-ink-3">Order</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Commission</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">GST</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Total</th>
                  <th className="px-3 py-2 text-left font-medium text-ink-3">Issued</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {list.map((ci) => {
                  const gst = ci.cgstPaise + ci.sgstPaise + ci.igstPaise;
                  return (
                    <tr key={ci.id} className="border-t border-line">
                      <td className="px-3 py-2 font-mono text-ink">{ci.number}</td>
                      <td className="px-3 py-2"><CopyableId value={ci.orderId} label="order id" /></td>
                      <td className="px-3 py-2 text-right font-mono">{formatPaise(ci.taxableValuePaise)}</td>
                      <td className="px-3 py-2 text-right font-mono text-ink-3">{formatPaise(gst)}</td>
                      <td className="px-3 py-2 text-right font-mono text-ink">{formatPaise(ci.totalPaise)}</td>
                      <td className="px-3 py-2 text-[11.5px] text-ink-3">
                        {ci.issuedAt ? new Date(ci.issuedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <Button asChild size="sm" variant="outline" iconLeft={<Download className="size-3.5" />} disabled={!ci.pdfUrl}>
                          <a href={ci.pdfUrl ?? '#'} download={`${ci.number}.pdf`}>PDF</a>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </>
  );
}

export default function RetailerCommissionInvoices() {
  return (
    <Page>
      <PageHeader
        kicker="Settlement"
        title="Commission invoices"
        description="Trendzo issues a commission invoice per order. Each is GST-compliant and feeds your monthly billing statement."
      />
      <CommissionInvoicesBody />
    </Page>
  );
}
