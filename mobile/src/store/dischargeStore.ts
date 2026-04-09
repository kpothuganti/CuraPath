import { create } from 'zustand';
import { DischargeRecord, MedicationRecord } from '../types';

interface DischargeState {
  discharge: DischargeRecord | null;
  medications: MedicationRecord[];
  setDischarge: (discharge: DischargeRecord) => void;
  setMedications: (meds: MedicationRecord[]) => void;
  clear: () => void;
}

export const dischargeStore = create<DischargeState>((set) => ({
  discharge: null,
  medications: [],
  setDischarge: (discharge) => set({ discharge }),
  setMedications: (medications) => set({ medications }),
  clear: () => set({ discharge: null, medications: [] }),
}));
