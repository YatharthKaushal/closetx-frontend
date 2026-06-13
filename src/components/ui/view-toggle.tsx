import { BarChart3, Table2 } from 'lucide-react';
import { Segmented } from '@/components/ui/segmented';

export type ReportView = 'chart' | 'table';

/** Chart ⇄ table switch used by every analytics panel; chart is the default. */
export function ViewToggle({
  value,
  onChange,
}: {
  value: ReportView;
  onChange: (v: ReportView) => void;
}) {
  return (
    <Segmented<ReportView>
      value={value}
      onChange={onChange}
      options={[
        {
          value: 'chart',
          label: (
            <span className="flex items-center gap-1.5">
              <BarChart3 className="size-3.5" /> Chart
            </span>
          ),
        },
        {
          value: 'table',
          label: (
            <span className="flex items-center gap-1.5">
              <Table2 className="size-3.5" /> Table
            </span>
          ),
        },
      ]}
    />
  );
}
