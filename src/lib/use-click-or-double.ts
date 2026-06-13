/**
 * Disambiguate single vs double click on a card/row: single → onClick (open
 * sheet), double → onDoubleClick (navigate to page). Single click is deferred
 * briefly; a second click within the window cancels it and fires double.
 * Keyboard: Enter = single (sheet), Shift+Enter = double (page).
 */
import { useEffect, useRef, type KeyboardEventHandler, type MouseEventHandler } from 'react';

export function useClickOrDouble<T extends HTMLElement>(opts: {
  onClick: () => void;
  onDoubleClick: () => void;
  delay?: number;
}) {
  const { onClick, onDoubleClick, delay = 220 } = opts;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // Clicks that originate on an interactive child (button, link, menu item,
  // form control, or anything opted out via [data-no-card-nav]) must not drive
  // card navigation — so the whole card stays clickable without each child
  // having to stopPropagation.
  const fromInteractive = (e: { target: EventTarget | null }) =>
    e.target instanceof Element &&
    !!e.target.closest('button,a,input,textarea,select,[role="menuitem"],[data-no-card-nav]');

  const handleClick: MouseEventHandler<T> = (e) => {
    if (fromInteractive(e)) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      onClick();
    }, delay);
  };
  const handleDoubleClick: MouseEventHandler<T> = (e) => {
    if (fromInteractive(e)) return;
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    onDoubleClick();
  };
  const handleKeyDown: KeyboardEventHandler<T> = (e) => {
    // Only the card itself activates on Enter/Space — never a focused child
    // (typing a space in a nested textarea/input must not open the sheet).
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (e.shiftKey) onDoubleClick();
      else onClick();
    }
  };

  return {
    onClick: handleClick,
    onDoubleClick: handleDoubleClick,
    onKeyDown: handleKeyDown,
    role: 'button' as const,
    tabIndex: 0,
  };
}
