import { create } from 'zustand';
import { UIStrings } from '../hooks/useUITranslations';

interface TranslationsState {
  strings: UIStrings | null;
  languageVersion: number;
  setStrings: (strings: UIStrings) => void;
  bumpVersion: () => void;
}

export const translationsStore = create<TranslationsState>((set, get) => ({
  strings: null,
  languageVersion: 0,
  setStrings: (strings) => set({ strings }),
  bumpVersion: () => set({ languageVersion: get().languageVersion + 1 }),
}));
