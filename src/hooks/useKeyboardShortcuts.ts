import { useEffect, useRef } from 'react';

interface UseKeyboardShortcutsOptions {
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  onSave?: () => void;
  onNavigatePrev?: () => void;
  onNavigateNext?: () => void;
  onTabSwitch?: (tabIndex: number) => void;
}

export function useKeyboardShortcuts({
  searchInputRef,
  onSave,
  onNavigatePrev,
  onNavigateNext,
  onTabSwitch,
}: UseKeyboardShortcutsOptions) {
  // Store callbacks in refs to avoid re-registering listeners
  const onSaveRef = useRef(onSave);
  const onNavigatePrevRef = useRef(onNavigatePrev);
  const onNavigateNextRef = useRef(onNavigateNext);
  const onTabSwitchRef = useRef(onTabSwitch);

  onSaveRef.current = onSave;
  onNavigatePrevRef.current = onNavigatePrev;
  onNavigateNextRef.current = onNavigateNext;
  onTabSwitchRef.current = onTabSwitch;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      // Ctrl+K / Cmd+K: focus search (always works)
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef?.current?.focus();
        return;
      }

      // Ctrl+S / Cmd+S: save (works even when typing)
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        onSaveRef.current?.();
        return;
      }

      // Ctrl+Enter: same as save (works even when typing)
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        onSaveRef.current?.();
        return;
      }

      // When typing, skip remaining shortcuts
      if (isTyping) {
        // Escape: blur search input
        if (e.key === 'Escape') {
          (target as HTMLElement).blur();
        }
        return;
      }

      // / : focus search
      if (e.key === '/') {
        e.preventDefault();
        searchInputRef?.current?.focus();
        return;
      }

      // Escape: blur search
      if (e.key === 'Escape') {
        searchInputRef?.current?.blur();
        return;
      }

      // Arrow Up / j: previous patient
      if (e.key === 'ArrowUp' || e.key === 'j') {
        e.preventDefault();
        onNavigatePrevRef.current?.();
        return;
      }

      // Arrow Down / k: next patient
      if (e.key === 'ArrowDown' || e.key === 'k') {
        e.preventDefault();
        onNavigateNextRef.current?.();
        return;
      }

      // 1/2/3: switch filter tabs
      if (e.key === '1') { e.preventDefault(); onTabSwitchRef.current?.(0); return; }
      if (e.key === '2') { e.preventDefault(); onTabSwitchRef.current?.(1); return; }
      if (e.key === '3') { e.preventDefault(); onTabSwitchRef.current?.(2); return; }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [searchInputRef]);
}
