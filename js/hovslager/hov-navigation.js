function visSide(sideId) {
  const sider = [
    "kundeSide",
    "hesterSide",
    "jobbSide",
    "fakturaSide",
    "firmaSide"
  ];

  sider.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add("skjult");
  });

  const valgt = document.getElementById(sideId);
  if (valgt) valgt.classList.remove("skjult");
}

window.visSide = visSide;