// Type shim for the 'leaflet.heat' package: it is a plain script (no bundled
// typings, no UMD wrapper) that patches the global Leaflet `L` with a
// `heatLayer()` factory at runtime — see frontend/components/ViolationHeatmap.tsx.
declare module 'leaflet.heat';
