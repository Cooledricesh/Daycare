'use client';

import { create } from 'zustand';

interface SyncStore {
  page: number;
  limit: number;
  selectedLogId: string | null;
  isDetailModalOpen: boolean;
  isUploadModalOpen: boolean;

  setPage: (page: number) => void;
  openDetailModal: (logId: string) => void;
  closeDetailModal: () => void;
  openUploadModal: () => void;
  closeUploadModal: () => void;
}

export const useSyncStore = create<SyncStore>((set) => ({
  page: 1,
  limit: 20,
  selectedLogId: null,
  isDetailModalOpen: false,
  isUploadModalOpen: false,

  setPage: (page) => set({ page }),

  openDetailModal: (logId) =>
    set({
      isDetailModalOpen: true,
      selectedLogId: logId,
    }),

  closeDetailModal: () =>
    set({
      isDetailModalOpen: false,
      selectedLogId: null,
    }),

  openUploadModal: () =>
    set({
      isUploadModalOpen: true,
    }),

  closeUploadModal: () =>
    set({
      isUploadModalOpen: false,
    }),
}));
