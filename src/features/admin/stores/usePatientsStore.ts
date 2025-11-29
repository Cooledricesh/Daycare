'use client';

import { create } from 'zustand';

interface PatientsFilters {
  search: string;
  status: 'all' | 'active' | 'discharged' | 'suspended';
  coordinator_id: string;
}

interface PatientsStore {
  filters: PatientsFilters;
  page: number;
  limit: number;
  selectedPatientId: string | null;
  isFormModalOpen: boolean;
  formMode: 'create' | 'edit';

  setFilters: (filters: Partial<PatientsFilters>) => void;
  setPage: (page: number) => void;
  openCreateModal: () => void;
  openEditModal: (patientId: string) => void;
  closeModal: () => void;
}

export const usePatientsStore = create<PatientsStore>((set) => ({
  filters: {
    search: '',
    status: 'all',
    coordinator_id: '',
  },
  page: 1,
  limit: 20,
  selectedPatientId: null,
  isFormModalOpen: false,
  formMode: 'create',

  setFilters: (filters) =>
    set((state) => ({
      filters: { ...state.filters, ...filters },
      page: 1, // 필터 변경 시 첫 페이지로
    })),

  setPage: (page) => set({ page }),

  openCreateModal: () =>
    set({
      isFormModalOpen: true,
      formMode: 'create',
      selectedPatientId: null,
    }),

  openEditModal: (patientId) =>
    set({
      isFormModalOpen: true,
      formMode: 'edit',
      selectedPatientId: patientId,
    }),

  closeModal: () =>
    set({
      isFormModalOpen: false,
      selectedPatientId: null,
    }),
}));
