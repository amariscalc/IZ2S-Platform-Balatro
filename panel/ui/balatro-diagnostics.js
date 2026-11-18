'use strict';
(() => {
  const btn = document.getElementById('balatro-audit-run');
  const host = document.getElementById('balatro-audit-host');
  const result = document.getElementById('balatro-audit-result');
  if (!btn || !host || !result) return;
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    result.textContent = 'Checking Balatro Lua RPC…';
    try {
      const response = await fetch('/api/balatro/diagnose', {
        method: 'POST',
        headers: {'content-type': 'application/json', 'x-iz-key': location.hash.slice(1)},
        body: JSON.stringify({host: host.value.trim()}),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || 'Diagnostic failed');
      result.textContent = JSON.stringify(data,null,2);
    } catch (error) {
      result.textContent = 'Diagnostic unavailable: ' + error.message;
    } finally {btn.disabled = false;}
  });
})();
