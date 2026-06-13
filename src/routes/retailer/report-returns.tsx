import { LegacyReportRedirect } from '@/components/retailer/legacy-report-redirect';

export default function RetailerReportReturnsLegacy() {
  return (
    <LegacyReportRedirect
      legacyTitle="Returns (legacy)"
      replacementTitle="Top returns"
      replacementPath="/retailer/reports/returns/top-listings"
    />
  );
}
