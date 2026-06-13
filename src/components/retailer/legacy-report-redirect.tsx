import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, AlertCircle } from 'lucide-react';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const REDIRECT_MS = 5000;

/**
 * Renders a banner explaining that the legacy report has been replaced by a
 * newer one and auto-navigates after 5 seconds. The CTA is rendered as a Link
 * so the operator can jump straight away. Pause-on-hover is omitted on
 * purpose — the redirect is short and the explicit CTA is always available.
 */
export function LegacyReportRedirect({
  legacyTitle,
  replacementTitle,
  replacementPath,
}: {
  legacyTitle: string;
  replacementTitle: string;
  replacementPath: string;
}) {
  const navigate = useNavigate();
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(REDIRECT_MS / 1000));

  useEffect(() => {
    const tick = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    const timer = setTimeout(() => navigate(replacementPath, { replace: true }), REDIRECT_MS);
    return () => {
      clearInterval(tick);
      clearTimeout(timer);
    };
  }, [navigate, replacementPath]);

  return (
    <Page>
      <PageHeader kicker="Reports" title={legacyTitle} />
      <Card>
        <CardContent className="p-6 flex flex-col items-start gap-4">
          <div className="flex items-center gap-2 text-warning">
            <AlertCircle className="size-4" />
            <span className="text-[13px] font-medium">This report has been replaced.</span>
          </div>
          <p className="text-[13.5px] text-ink-2">
            The new <span className="font-medium text-ink">{replacementTitle}</span> report covers the
            same data with a refreshed layout. Redirecting in {secondsLeft}…
          </p>
          <Button asChild variant="ink" iconRight={<ArrowRight className="size-3.5" />}>
            <Link to={replacementPath}>Open {replacementTitle} now</Link>
          </Button>
        </CardContent>
      </Card>
    </Page>
  );
}
