function visSide(sideId) {
  return window.__behVisSide ? window.__behVisSide(sideId) : false;
}
window.visSide = visSide;
