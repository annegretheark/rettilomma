window.AGK_MODULER = {
  timer: true,
  kunder: true,
  ansatte: true,
  firma: true,

  faktura: true,
  kreditnota: true,
  purring: true,

  varer: false,
  lager: false,
  lonn: false,

  hovslager: true
};
window.modulAktiv = function(navn) {
    return !!window.AGK_MODULER[navn];
};