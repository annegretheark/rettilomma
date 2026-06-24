
// Rollebasert visning av Sysadm-knapp
document.addEventListener('DOMContentLoaded', () => {
  const rolle = (window.innloggetRolle || '').toLowerCase();
  const btn = document.getElementById('sysadminModeKnapp');
  if (btn && (rolle === 'sysadmin' || rolle === 'systemadmin')) {
    btn.style.display = '';
    btn.classList.remove('skjult');
  }
});
