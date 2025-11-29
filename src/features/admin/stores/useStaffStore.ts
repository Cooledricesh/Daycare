'use client';

import { create } from 'zustand';

interface StaffFilters {
  role: 'all' | 'doctor' | 'coordinator' | 'nurse' | 'admin';
  status: 'all' | 'active' | 'inactive';
}

interface StaffStore {
  filters: StaffFilters;
  page: number;
  limit: number;
  selectedStaffId: string | null;
  isFormModalOpen: boolean;
  isPasswordResetModalOpen: boolean;
  formMode: 'create' | 'edit';

  setFilters: (filters: Partial<StaffFilters>) => void;
  setPage: (page: number) => void;
  openCreateModal: () => void;
  openEditModal: (staffId: string) => void;
  openPasswordResetModal: (staffId: string) => void;
  closeModal: () => void;
}

export const useStaffStore = create<StaffStore>((set) => ({
  filters: {
    role: 'all',
    status: 'all',
  },
  page: 1,
  limit: 20,
  selectedStaffId: null,
  isFormModalOpen: false,
  isPasswordResetModalOpen: false,
  formMode: 'create',

  setFilters: (filters) =>
    set((state) => ({
      filters: { ...state.filters, ...filters },
      page: 1,
    })),

  setPage: (page) => set({ page }),

  openCreateModal: () =>
    set({
      isFormModalOpen: true,
      formMode: 'create',
      selectedStaffId: null,
    }),

  openEditModal: (staffId) =>
    set({
      isFormModalOpen: true,
      formMode: 'edit',
      selectedStaffId: staffId,
    }),

  openPasswordResetModal: (staffId) =>
    set({
      isPasswordResetModalOpen: true,
      selectedStaffId: staffId,
    }),

  closeModal: () =>
    set({
      isFormModalOpen: false,
      isPasswordResetModalOpen: false,
      selectedStaffId: null,
    }),
}));
