import { useEffect, useRef } from 'react';

interface UseKeyboardShortcutsOptions {
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  onSave?: () => void;
  onNavigatePrev?: () => void;
  onNavigateNext?: () => void;
  onTabSwitch?: (tabIndex: number) => void;
  onEnterInSearch?: () => void;
  onShowHelp?: () => void;
}

export function useKeyboardShortcuts({
  searchInputRef,
  onSave,
  onNavigatePrev,
  onNavigateNext,
  onTabSwitch,
  onEnterInSearch,
  onShowHelp,
}: UseKeyboardShortcutsOptions) {
  const onSaveRef = useRef(onSave);
  const onNavigatePrevRef = useRef(onNavigatePrev);
  const onNavigateNextRef = useRef(onNavigateNext);
  const onTabSwitchRef = useRef(onTabSwitch);
  const onEnterInSearchRef = useRef(onEnterInSearch);
  const onShowHelpRef = useRef(onShowHelp);

  useEffect(() => {
    onSaveRef.current = onSave;
    onNavigatePrevRef.current = onNavigatePrev;
    onNavigateNextRef.current = onNavigateNext;
    onTabSwitchRef.current = onTabSwitch;
    onEnterInSearchRef.current = onEnterInSearch;
    onShowHelpRef.current = onShowHelp;
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      // Ctrl+F / Cmd+F: focus search (always works)
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        searchInputRef?.current?.focus();
        searchInputRef?.current?.select();
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

      // When typing in search input, handle ArrowUp/Down for patient navigation
      if (isTyping) {
        const isSearchInput = target === searchInputRef?.current;

        if (isSearchInput) {
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            onNavigatePrevRef.current?.();
            return;
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            onNavigateNextRef.current?.();
            return;
          }
          if (e.key === 'Enter') {
            e.preventDefault();
            onEnterInSearchRef.current?.();
            return;
          }
        }

        if (e.key === 'Escape') {
          (target as HTMLElement).blur();
        }
        return;
      }

      // / : focus search
      if (e.key === '/') {
        e.preventDefault();
        searchInputRef?.current?.focus();
        searchInputRef?.current?.select();
        return;
      }

      // Escape: blur search
      if (e.key === 'Escape') {
        searchInputRef?.current?.blur();
        return;
      }

      // ? : show help modal
      if (e.key === '?') {
        e.preventDefault();
        onShowHelpRef.current?.();
        return;
      }

      // Arrow Up: previous patient
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        onNavigatePrevRef.current?.();
        return;
      }

      // Arrow Down: next patient
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        onNavigateNextRef.current?.();
        return;
      }

      // Enter: confirm selection
      if (e.key === 'Enter') {
        e.preventDefault();
        onEnterInSearchRef.current?.();
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
