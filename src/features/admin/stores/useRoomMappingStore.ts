'use client';

import { create } from 'zustand';

interface RoomMappingStore {
  selectedRoomPrefix: string | null;
  isFormModalOpen: boolean;
  formMode: 'create' | 'edit';
  isDeleteDialogOpen: boolean;

  openCreateModal: () => void;
  openEditModal: (roomPrefix: string) => void;
  openDeleteDialog: (roomPrefix: string) => void;
  closeModal: () => void;
  closeDeleteDialog: () => void;
}

export const useRoomMappingStore = create<RoomMappingStore>((set) => ({
  selectedRoomPrefix: null,
  isFormModalOpen: false,
  formMode: 'create',
  isDeleteDialogOpen: false,

  openCreateModal: () =>
    set({
      isFormModalOpen: true,
      formMode: 'create',
      selectedRoomPrefix: null,
    }),

  openEditModal: (roomPrefix) =>
    set({
      isFormModalOpen: true,
      formMode: 'edit',
      selectedRoomPrefix: roomPrefix,
    }),

  openDeleteDialog: (roomPrefix) =>
    set({
      isDeleteDialogOpen: true,
      selectedRoomPrefix: roomPrefix,
    }),

  closeModal: () =>
    set({
      isFormModalOpen: false,
      selectedRoomPrefix: null,
    }),

  closeDeleteDialog: () =>
    set({
      isDeleteDialogOpen: false,
      selectedRoomPrefix: null,
    }),
}));
