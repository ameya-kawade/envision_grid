import { create } from 'zustand';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export const useStore = create((set) => ({
    activeZone: null,
    setActiveZone: (zone) => set({ activeZone: zone }),
    horizon: '24h', // '24h', '72h', '7d'
    setHorizon: (horizon) => set({ horizon }),
    // Per-horizon session cache: { '24h': { data: [...], fetchedAt: timestamp } }
    horizonCache: {},
    setHorizonCache: (horizon, data) =>
        set((state) => ({
            horizonCache: {
                ...state.horizonCache,
                [horizon]: data ? { data, fetchedAt: Date.now() } : null,
            },
        })),
    // Force-invalidate a horizon's cache so DeckGLMap will re-fetch
    invalidateHorizonCache: (horizon) =>
        set((state) => ({
            horizonCache: {
                ...state.horizonCache,
                [horizon]: null,
            },
        })),
    isCacheValid: (horizon) => (state) => {
        const entry = state.horizonCache[horizon];
        return entry && Date.now() - entry.fetchedAt < CACHE_TTL_MS;
    },
    city: 'Mumbai, India',
    setCity: (city) => set({ city }),
    viewState: {
        latitude: 19.07,
        longitude: 72.88,
        zoom: 10,
        pitch: 0,
        bearing: 0,
    },
    setViewState: (viewState) => set({ viewState }),
}));

// Helper used by components — checks 5-min TTL
export const horizonCacheTTL = CACHE_TTL_MS;
