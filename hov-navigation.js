function visSide(sideId) {
  return window.__hovVisSide ? window.__hovVisSide(sideId) : false;
}
window.visSide = visSide;
