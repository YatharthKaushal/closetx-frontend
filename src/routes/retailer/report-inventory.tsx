import { LegacyReportRedirect } from '@/components/retailer/legacy-report-redirect';

export default function RetailerReportInventoryHealthLegacy() {
  return (
    <LegacyReportRedirect
      legacyTitle="Inventory health (legacy)"
      replacementTitle="Dead stock"
      replacementPath="/retailer/reports/listings/dead-stock"
    />
  );
}
