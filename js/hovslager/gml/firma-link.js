
window.HOV_FIRMA_LINK = new URLSearchParams(location.search).get('firma') || '';
window.hentFirmaFraLink = function(){ return window.HOV_FIRMA_LINK; };
console.log('Firma fra link:', window.HOV_FIRMA_LINK);
