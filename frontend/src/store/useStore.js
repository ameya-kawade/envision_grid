import { create } from 'zustand';

export const useStore = create((set) => ({
    activeZone: null,
    setActiveZone: (zone) => set({ activeZone: zone }),
    horizon: '24h', // '24h', '72h', '7d'
    setHorizon: (horizon) => set({ horizon }),
    city: 'San Francisco, CA',
    setCity: (city) => set({ city }),
    viewState: {
        latitude: 37.7749,
        longitude: -122.4194,
        zoom: 12,
        pitch: 45,
        bearing: 0
    },
    setViewState: (viewState) => set({ viewState }),
}));
