function formatBelop(verdi) {
  return Number(verdi || 0).toLocaleString("no-NO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function tryggFilnavn(tekst) {
  return String(tekst || "fil")
    .toLowerCase()
    .replace(/[æ]/g, "ae")
    .replace(/[ø]/g, "o")
    .replace(/[å]/g, "a")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function formatDatoISO(dato) {
  return dato.toISOString().slice(0, 10);
}

function leggTilDager(dato, dager) {
  const nyDato = new Date(dato);
  nyDato.setDate(nyDato.getDate() + dager);
  return nyDato;
}

window.formatBelop = formatBelop;
window.tryggFilnavn = tryggFilnavn;
window.formatDatoISO = formatDatoISO;
window.leggTilDager = leggTilDager;