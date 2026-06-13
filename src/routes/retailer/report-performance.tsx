import { LegacyReportRedirect } from '@/components/retailer/legacy-report-redirect';

export default function RetailerReportPerformanceLegacy() {
  return (
    <LegacyReportRedirect
      legacyTitle="Performance (legacy)"
      replacementTitle="Revenue summary"
      replacementPath="/retailer/reports/revenue-summary"
    />
  );
}
