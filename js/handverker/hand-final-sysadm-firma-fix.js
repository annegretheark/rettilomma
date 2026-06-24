/* Disabled all-customer fallback. Tenant lock handles customer lists. */
(function(){ if (window.lastKunder) { try { window.lastKunder(); } catch(e) {} } })();
