import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { formatPaise } from '@/lib/status';
import type { TaxInvoice, TaxInvoiceKind } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const KIND_TONE: Record<TaxInvoiceKind, 'info' | 'warning' | 'neutral'> = {
  invoice: 'info',
  supplementary: 'warning',
  commission: 'neutral',
};

/**
 * Body-only renderer. Used both as the standalone Tax invoices page and as a
 * tab panel inside the merged `/retailer/invoices` hub. The page header /
 * Page wrapper lives in the default-export route component below so the hub
 * can supply its own header without nesting two of them.
 */
export function TaxInvoicesBody() {
  const [params] = useSearchParams();
  const initialOrderId = params.get('orderId') ?? '';
  const [q, setQ] = useState(initialOrderId);

  const { data, isLoading } = useQuery({
    queryKey: ['retailer', 'tax-invoices'],
    queryFn: () => api<TaxInvoice[]>('/retailer/invoices'),
  });
  const all = data ?? [];

  const filtered = useMemo(() => {
    if (!q.trim()) return all;
    const n = q.toLowerCase();
    return all.filter(
      (i) =>
        i.number.toLowerCase().includes(n) ||
        i.orderId.toLowerCase().includes(n) ||
        i.consumerName.toLowerCase().includes(n),
    );
  }, [all, q]);

  return (
    <>
      <div className="mb-4 relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-3" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search invoice number, order id, customer…"
          className="!pl-9"
        />
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All <span className="ml-1.5 text-ink-3">{filtered.length}</span></TabsTrigger>
          <TabsTrigger value="invoice">Invoices <span className="ml-1.5 text-ink-3">{filtered.filter((i) => i.kind === 'invoice').length}</span></TabsTrigger>
          <TabsTrigger value="supplementary">Supplementary <span className="ml-1.5 text-ink-3">{filtered.filter((i) => i.kind === 'supplementary').length}</span></TabsTrigger>
          <TabsTrigger value="commission">Commission <span className="ml-1.5 text-ink-3">{filtered.filter((i) => i.kind === 'commission').length}</span></TabsTrigger>
        </TabsList>

        {(['all', 'invoice', 'supplementary', 'commission'] as const).map((tab) => (
          <TabsContent key={tab} value={tab}>
            <List loading={isLoading} list={tab === 'all' ? filtered : filtered.filter((i) => i.kind === tab)} />
          </TabsContent>
        ))}
      </Tabs>
    </>
  );
}

export default function RetailerTaxInvoices() {
  return (
    <Page>
      <PageHeader
        kicker="Invoicing"
        title="Tax invoices"
        description="Every consumer-facing tax invoice issued for your orders. Supplementary invoices link back to the original."
      />
      <TaxInvoicesBody />
    </Page>
  );
}

function List({ loading, list }: { loading: boolean; list: TaxInvoice[] }) {
  if (loading) return <Skeleton className="h-32" />;
  if (list.length === 0) return <Empty kicker="None" title="No invoices match." />;
  return (
    <Card>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full text-[12.5px]">
          <thead className="bg-bg-2/40">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-ink-3">Number</th>
              <th className="px-3 py-2 text-left font-medium text-ink-3">Kind</th>
              <th className="px-3 py-2 text-left font-medium text-ink-3">Customer</th>
              <th className="px-3 py-2 text-left font-medium text-ink-3">Order</th>
              <th className="px-3 py-2 text-right font-medium text-ink-3">Total</th>
              <th className="px-3 py-2 text-left font-medium text-ink-3">Issued</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {list.map((i) => (
              <tr key={i.id} className="border-t border-line">
                <td className="px-3 py-2 font-mono text-ink">{i.number}</td>
                <td className="px-3 py-2"><Badge tone={KIND_TONE[i.kind]} flat>{i.kind}</Badge></td>
                <td className="px-3 py-2 text-ink-2">{i.consumerName}</td>
                <td className="px-3 py-2 font-mono text-[11.5px] text-ink-3">{i.orderId}</td>
                <td className="px-3 py-2 text-right font-mono">{formatPaise(i.totalPaise)}</td>
                <td className="px-3 py-2 text-[11.5px] text-ink-3">
                  {i.issuedAt ? new Date(i.issuedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                </td>
                <td className="px-3 py-1.5 text-right">
                  <Button asChild variant="outline" size="sm" iconRight={<ArrowUpRight className="size-3.5" />}>
                    <Link to={`/retailer/tax-invoices/${i.id}`}>Open</Link>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
