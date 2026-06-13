import { LegacyReportRedirect } from '@/components/retailer/legacy-report-redirect';

export default function RetailerReportSalesLegacy() {
  return (
    <LegacyReportRedirect
      legacyTitle="Sales (legacy)"
      replacementTitle="Sales detail"
      replacementPath="/retailer/reports/sales-detailed"
    />
  );
}
