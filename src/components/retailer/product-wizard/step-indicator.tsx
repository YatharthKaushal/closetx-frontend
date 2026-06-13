/** Wizard step chips. Steps up to `maxStep` (high-water mark) stay clickable. */
import { Check } from 'lucide-react';

export function StepIndicator({
  steps,
  step,
  maxStep,
  onJump,
}: {
  steps: readonly string[];
  step: number;
  maxStep: number;
  onJump: (n: number) => void;
}) {
  return (
    <nav aria-label="Wizard steps" className="mb-1 flex items-center gap-1.5 overflow-x-auto pb-2">
      {steps.map((label, i) => {
        const state = i < step ? 'done' : i === step ? 'active' : 'pending';
        const reachable = i <= maxStep;
        return (
          <button
            key={label}
            type="button"
            disabled={!reachable}
            onClick={() => onJump(i)}
            className={
              'group flex items-center gap-2 rounded-full border px-3 py-1 text-[12px] transition-colors ' +
              (state === 'active'
                ? 'border-ink bg-ink text-bg'
                : reachable
                  ? 'border-line bg-bg text-ink-2 hover:border-line-2 cursor-pointer'
                  : 'border-line bg-bg-2 text-ink-4 cursor-not-allowed')
            }
          >
            <span
              className={
                'grid size-4 place-items-center rounded-full text-[10px] font-mono ' +
                (state === 'active'
                  ? 'bg-bg text-ink'
                  : state === 'done'
                    ? 'bg-accent text-accent-fg'
                    : reachable
                      ? 'bg-bg-3 text-ink-2'
                      : 'bg-bg-3 text-ink-4')
              }
            >
              {state === 'done' ? <Check className="size-2.5" /> : i + 1}
            </span>
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
