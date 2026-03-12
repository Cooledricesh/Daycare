import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';

interface UsePatientListNavigationOptions<T extends { id: string }, F extends string> {
  patients: T[];
  filterTabKeys: readonly F[];
  onConfirmSelection?: () => void;
}

export function usePatientListNavigation<T extends { id: string }, F extends string>({
  patients,
  filterTabKeys,
  onConfirmSelection,
}: UsePatientListNavigationOptions<T, F>) {
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const filteredItemsRef = useRef<T[]>([]);
  const [filterTab, setFilterTab] = useState<F>(filterTabKeys[0]);
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);

  const onConfirmRef = useRef(onConfirmSelection);
  useEffect(() => { onConfirmRef.current = onConfirmSelection; });

  const selectedItem = useMemo(() => {
    if (!selectedPatientId) return null;
    return patients.find(p => p.id === selectedPatientId) || null;
  }, [patients, selectedPatientId]);

  const handleSelectItem = useCallback((item: T) => {
    setSelectedPatientId(item.id);
    onConfirmRef.current?.();
  }, []);

  const handleFilteredItemsChange = useCallback((list: T[]) => {
    filteredItemsRef.current = list;
  }, []);

  const handleNavigatePrev = useCallback(() => {
    const list = filteredItemsRef.current;
    if (list.length === 0) return;
    if (!selectedPatientId) {
      setSelectedPatientId(list[list.length - 1].id);
      return;
    }
    const idx = list.findIndex(p => p.id === selectedPatientId);
    if (idx > 0) setSelectedPatientId(list[idx - 1].id);
  }, [selectedPatientId]);

  const handleNavigateNext = useCallback(() => {
    const list = filteredItemsRef.current;
    if (list.length === 0) return;
    if (!selectedPatientId) {
      setSelectedPatientId(list[0].id);
      return;
    }
    const idx = list.findIndex(p => p.id === selectedPatientId);
    if (idx < list.length - 1) setSelectedPatientId(list[idx + 1].id);
  }, [selectedPatientId]);

  const handleEnterInSearch = useCallback(() => {
    const list = filteredItemsRef.current;
    if (list.length === 0) return;
    if (selectedPatientId && list.some(p => p.id === selectedPatientId)) {
      searchInputRef.current?.blur();
      onConfirmRef.current?.();
      return;
    }
    setSelectedPatientId(list[0].id);
    searchInputRef.current?.blur();
    onConfirmRef.current?.();
  }, [selectedPatientId]);

  const handleTabSwitch = useCallback((tabIndex: number) => {
    if (tabIndex >= 0 && tabIndex < filterTabKeys.length) {
      setFilterTab(filterTabKeys[tabIndex]);
    }
  }, [filterTabKeys]);

  useKeyboardShortcuts({
    searchInputRef,
    onNavigatePrev: handleNavigatePrev,
    onNavigateNext: handleNavigateNext,
    onEnterInSearch: handleEnterInSearch,
    onTabSwitch: handleTabSwitch,
    onShowHelp: () => setShowShortcutHelp(true),
  });

  return {
    selectedPatientId,
    setSelectedPatientId,
    selectedItem,
    searchInputRef,
    filteredItemsRef,
    filterTab,
    setFilterTab,
    showShortcutHelp,
    setShowShortcutHelp,
    handleSelectItem,
    handleFilteredItemsChange,
  };
}
