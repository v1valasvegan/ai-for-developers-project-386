// jsdom has no layout engine or ResizeObserver. UI tests exercise real HTTP;
// actual scroll geometry and keyboard navigation are checked in layout.pw.mjs.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (media) => ({
    media,
    matches: false,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  });
}
if (typeof window !== "undefined" && typeof ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
