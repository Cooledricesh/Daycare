import { create } from 'zustand';

interface ScheduleStoreState {
  selectedPatientId: string | null;
  selectedPatientName: string | null;
  isModalOpen: boolean;
  openModal: (patientId: string, patientName: string) => void;
  closeModal: () => void;
}

export const useScheduleStore = create<ScheduleStoreState>((set) => ({
  selectedPatientId: null,
  selectedPatientName: null,
  isModalOpen: false,
  openModal: (patientId, patientName) =>
    set({ selectedPatientId: patientId, selectedPatientName: patientName, isModalOpen: true }),
  closeModal: () =>
    set({ selectedPatientId: null, selectedPatientName: null, isModalOpen: false }),
}));
