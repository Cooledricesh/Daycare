'use client';

import { create } from 'zustand';
import { format } from 'date-fns';

interface ScheduleStore {
  // Tab
  activeTab: 'patterns' | 'daily';

  // Patterns Tab
  patternsSearch: string;
  patternsPage: number;
  selectedPatientId: string | null;
  isPatternModalOpen: boolean;

  // Daily Tab
  selectedDate: string;
  dailyFilters: {
    source: 'all' | 'auto' | 'manual';
    status: 'all' | 'active' | 'cancelled';
  };
  isManualAddModalOpen: boolean;

  // Actions
  setActiveTab: (tab: 'patterns' | 'daily') => void;
  setPatternsSearch: (search: string) => void;
  setPatternsPage: (page: number) => void;
  openPatternModal: (patientId: string) => void;
  closePatternModal: () => void;
  setSelectedDate: (date: string) => void;
  setDailyFilters: (filters: Partial<ScheduleStore['dailyFilters']>) => void;
  openManualAddModal: () => void;
  closeManualAddModal: () => void;
}

export const useScheduleStore = create<ScheduleStore>((set) => ({
  activeTab: 'patterns',

  patternsSearch: '',
  patternsPage: 1,
  selectedPatientId: null,
  isPatternModalOpen: false,

  selectedDate: format(new Date(), 'yyyy-MM-dd'),
  dailyFilters: {
    source: 'all',
    status: 'all',
  },
  isManualAddModalOpen: false,

  setActiveTab: (tab) => set({ activeTab: tab }),

  setPatternsSearch: (search) => set({ patternsSearch: search, patternsPage: 1 }),

  setPatternsPage: (page) => set({ patternsPage: page }),

  openPatternModal: (patientId) =>
    set({ isPatternModalOpen: true, selectedPatientId: patientId }),

  closePatternModal: () =>
    set({ isPatternModalOpen: false, selectedPatientId: null }),

  setSelectedDate: (date) => set({ selectedDate: date }),

  setDailyFilters: (filters) =>
    set((state) => ({
      dailyFilters: { ...state.dailyFilters, ...filters },
    })),

  openManualAddModal: () => set({ isManualAddModalOpen: true }),

  closeManualAddModal: () => set({ isManualAddModalOpen: false }),
}));
