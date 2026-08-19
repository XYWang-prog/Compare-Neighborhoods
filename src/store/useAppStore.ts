import { create } from 'zustand'
import type { UserPreferences, FilterState, LivingArea } from '../data/types'
import { DEFAULT_FILTERS } from '../data/constants'

interface AppState {
  preferences: UserPreferences | null
  isOnboarded: boolean
  filters: FilterState
  livingAreas: LivingArea[]
  selectedAreaId: string | null
  hoveredAreaId: string | null

  setPreferences: (prefs: UserPreferences) => void
  updateFilter: (partial: Partial<FilterState>) => void
  setLivingAreas: (areas: LivingArea[]) => void
  selectArea: (id: string | null) => void
  hoverArea: (id: string | null) => void
  resetAll: () => void
}

export const useAppStore = create<AppState>()((set) => ({
  preferences: null,
  isOnboarded: false,
  filters: DEFAULT_FILTERS,
  livingAreas: [],
  selectedAreaId: null,
  hoveredAreaId: null,

  setPreferences: (prefs) => set({ preferences: prefs, isOnboarded: true }),
  updateFilter: (partial) => set((state) => ({ filters: { ...state.filters, ...partial } })),
  setLivingAreas: (areas) => set({ livingAreas: areas }),
  selectArea: (id) => set({ selectedAreaId: id }),
  hoverArea: (id) => set({ hoveredAreaId: id }),
  resetAll: () => set({
    preferences: null, isOnboarded: false, filters: DEFAULT_FILTERS,
    selectedAreaId: null, hoveredAreaId: null,
  }),
}))
