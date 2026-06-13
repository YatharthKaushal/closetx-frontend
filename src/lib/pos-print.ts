import { BASE } from './api';
import { getToken } from './auth';
import { formatPaise } from './status';
import type { PosSaleDetail } from './pos-types';

/**
 * Counter-sale printing. Two browser-print formats (A4 GST invoice + 80mm thermal receipt)
 * rendered as self-contained HTML in a hidden iframe — no new dependency, pixel-faithful, and
 * the cashier drives the print dialog. A PDF download fallback hits the server-rendered invoice.
 */

function esc(s: string | null | undefined): string {
  return String(s ?? '').replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string,
  );
}

function printHtml(html: string): void {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (!doc) return;
  doc.open();
  doc.write(html);
  doc.close();
  const win = iframe.contentWindow!;
  win.focus();
  // Give the browser a tick to lay out before invoking print, then clean up.
  setTimeout(() => {
    win.print();
    setTimeout(() => iframe.remove(), 1000);
  }, 150);
}

function lineRows(sale: PosSaleDetail): string {
  return sale.items
    .map((it) => {
      const cgst = Math.floor(it.gstPaise / 2);
      const sgst = it.gstPaise - cgst;
      return `<tr>
        <td>${esc(it.listingNameSnap)}<div class="sub">${esc(it.attributesLabelSnap)}${it.skuSnap ? ' · ' + esc(it.skuSnap) : ''}</div></td>
        <td class="r">${esc(it.hsnSnap)}</td>
        <td class="r">${it.qty}</td>
        <td class="r">${formatPaise(it.unitMrpPaise)}</td>
        <td class="r">${formatPaise(it.taxableValuePaise)}</td>
        <td class="r">${(it.gstRateBp / 100).toFixed(0)}%</td>
        <td class="r">${formatPaise(cgst)}</td>
        <td class="r">${formatPaise(sgst)}</td>
        <td class="r">${formatPaise(it.netLinePaise)}</td>
      </tr>`;
    })
    .join('');
}

export function printInvoiceA4(sale: PosSaleDetail): void {
  const inv = sale.invoice;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(inv?.invoiceNumber ?? 'Invoice')}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; font-family: Arial, Helvetica, sans-serif; }
    body { margin: 0; color: #111; font-size: 12px; }
    h1 { font-size: 16px; text-align: center; margin: 0 0 2px; letter-spacing: .04em; }
    .muted { color: #666; }
    .head { display: flex; justify-content: space-between; gap: 16px; margin: 12px 0; }
    .box { border: 1px solid #ddd; border-radius: 6px; padding: 8px 10px; flex: 1; }
    .box h3 { margin: 0 0 4px; font-size: 11px; text-transform: uppercase; color: #888; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border: 1px solid #e3e3e3; padding: 5px 6px; text-align: left; vertical-align: top; }
    th { background: #f7f7f7; font-size: 10px; text-transform: uppercase; color: #666; }
    td.r, th.r { text-align: right; }
    .sub { color: #888; font-size: 10px; margin-top: 2px; }
    .totals { margin-top: 10px; margin-left: auto; width: 280px; }
    .totals tr td { border: 0; padding: 3px 0; }
    .totals .grand td { border-top: 1px solid #333; font-weight: 700; font-size: 14px; padding-top: 6px; }
    .foot { margin-top: 24px; text-align: center; color: #888; font-size: 10px; }
  </style></head><body>
  <h1>TAX INVOICE</h1>
  <div class="muted" style="text-align:center">${esc(inv?.invoiceNumber ?? '')} · ${sale.completedAt ? new Date(sale.completedAt).toLocaleString('en-IN') : ''}</div>
  <div class="head">
    <div class="box"><h3>Seller</h3><b>${esc(sale.storeLegalNameSnap)}</b><div>${esc(sale.storeAddressSnap)}</div><div>GSTIN: ${esc(sale.storeGstinSnap)}</div></div>
    <div class="box"><h3>Bill to</h3><b>${esc(sale.customerNameSnap || 'Walk-in customer')}</b>${sale.customerPhoneSnap ? `<div>${esc(sale.customerPhoneSnap)}</div>` : ''}${sale.customerGstinSnap ? `<div>GSTIN: ${esc(sale.customerGstinSnap)}</div>` : ''}</div>
  </div>
  <table>
    <thead><tr><th>Item</th><th class="r">HSN</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Taxable</th><th class="r">GST</th><th class="r">CGST</th><th class="r">SGST</th><th class="r">Amount</th></tr></thead>
    <tbody>${lineRows(sale)}</tbody>
  </table>
  <table class="totals">
    <tr><td>Taxable value</td><td class="r">${formatPaise(sale.taxableValuePaise)}</td></tr>
    <tr><td>CGST</td><td class="r">${formatPaise(sale.cgstPaise)}</td></tr>
    <tr><td>SGST</td><td class="r">${formatPaise(sale.sgstPaise)}</td></tr>
    <tr class="grand"><td>Total</td><td class="r">${formatPaise(sale.taxableValuePaise + sale.taxPaise)}</td></tr>
  </table>
  <div class="foot">This is a computer-generated invoice. Thank you for shopping with ${esc(sale.storeLegalNameSnap)}.</div>
  </body></html>`;
  printHtml(html);
}

export function printReceipt80mm(sale: PosSaleDetail): void {
  const inv = sale.invoice;
  const itemRows = sale.items
    .map(
      (it) => `<tr><td>${esc(it.listingNameSnap)}<div class="s">${esc(it.attributesLabelSnap)} × ${it.qty}</div></td><td class="r">${formatPaise(it.netLinePaise)}</td></tr>`,
    )
    .join('');
  const tenders = sale.payments
    .filter((p) => p.direction === 'collect')
    .map((p) => `<tr><td>${p.method.toUpperCase()}</td><td class="r">${formatPaise(p.amountPaise)}</td></tr>`)
    .join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Receipt</title>
  <style>
    @page { size: 80mm auto; margin: 2mm; }
    * { font-family: 'Courier New', monospace; box-sizing: border-box; }
    body { margin: 0; width: 76mm; color: #000; font-size: 11px; }
    .c { text-align: center; }
    .b { font-weight: 700; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 1px 0; vertical-align: top; }
    td.r { text-align: right; }
    .s { color: #444; font-size: 9px; }
    hr { border: 0; border-top: 1px dashed #000; margin: 4px 0; }
    .grand td { font-size: 13px; font-weight: 700; }
  </style></head><body>
  <div class="c b" style="font-size:13px">${esc(sale.storeLegalNameSnap)}</div>
  <div class="c s">${esc(sale.storeAddressSnap)}</div>
  <div class="c s">GSTIN: ${esc(sale.storeGstinSnap)}</div>
  <hr>
  <div class="s">Invoice: ${esc(inv?.invoiceNumber ?? '—')}</div>
  <div class="s">${sale.completedAt ? new Date(sale.completedAt).toLocaleString('en-IN') : ''}</div>
  ${sale.customerNameSnap ? `<div class="s">Customer: ${esc(sale.customerNameSnap)}</div>` : ''}
  <hr>
  <table>${itemRows}</table>
  <hr>
  <table>
    <tr><td>Taxable</td><td class="r">${formatPaise(sale.taxableValuePaise)}</td></tr>
    <tr><td>CGST</td><td class="r">${formatPaise(sale.cgstPaise)}</td></tr>
    <tr><td>SGST</td><td class="r">${formatPaise(sale.sgstPaise)}</td></tr>
    ${sale.roundOffPaise !== 0 ? `<tr><td>Round off</td><td class="r">${formatPaise(sale.roundOffPaise)}</td></tr>` : ''}
    <tr class="grand"><td>TOTAL</td><td class="r">${formatPaise(sale.payablePaise)}</td></tr>
  </table>
  <hr>
  <table>${tenders}${sale.changePaise > 0 ? `<tr><td>Change</td><td class="r">${formatPaise(sale.changePaise)}</td></tr>` : ''}</table>
  <hr>
  <div class="c s">Thank you! Visit again.</div>
  </body></html>`;
  printHtml(html);
}

/** Server-rendered PDF fallback — mirrors the orders downloadInvoice pattern. */
export async function downloadSalePdf(saleId: string, invoiceNumber: string): Promise<void> {
  const token = getToken();
  const res = await fetch(`${BASE}/retailer/pos/sales/${saleId}/invoice`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const json = await res.json();
  const pdfUrl = json?.data?.pdfUrl as string | undefined;
  if (!pdfUrl) throw new Error('PDF not ready yet — try again in a moment.');
  const a = document.createElement('a');
  a.href = pdfUrl;
  a.download = `${invoiceNumber}.pdf`;
  a.target = '_blank';
  a.click();
}
