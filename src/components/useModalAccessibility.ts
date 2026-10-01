import { useEffect, useRef } from 'react';

/**
 * Modal accessibility.
 *
 * Every dialog in this app used to be a `<div>` with no focus handling at all,
 * which breaks three things a keyboard or screen-reader user depends on:
 *
 *  1. Focus never enters the dialog, so the first Tab jumps to a control behind
 *     the overlay — the dialog looks like an empty page.
 *  2. Focus is not trapped, so Tab walks through the studio underneath and the
 *     overlay appears to vanish.
 *  3. Escape does not close, so the only way out is finding the small × button.
 *
 * This hook moves focus in on open, keeps Tab inside, restores focus to whatever
 * opened the dialog, and closes on Escape.
 */
export function useModalAccessibility(isOpen: boolean, onClose: () => void) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const container = containerRef.current;
    // Whatever had focus before the dialog opened — restored on close so the
    // user is not dumped at the top of the document.
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Focus the first meaningful control rather than the dialog container, which
    // would only make screen readers announce the label and stop there.
    const focusables = () => {
      if (!container) return [] as HTMLElement[];
      return Array.from(
        container.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
    };

    const initial = focusables()[0] ?? container;
    // rAF lets the dialog paint before focus moves, so the scroll-into-view that
    // browsers do on focus does not fight the entry animation.
    const raf = requestAnimationFrame(() => {
      initial.focus();
      container?.scrollTo?.(0, 0);
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;

      // Wrap in both directions so Tab never escapes the dialog.
      if (event.shiftKey && (active === first || !container?.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    // Stop the page behind the overlay from scrolling while it is open.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused && document.contains(previouslyFocused)) previouslyFocused.focus();
    };
  }, [isOpen, onClose]);

  return containerRef;
}
