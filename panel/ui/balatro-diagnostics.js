'use strict';
(() => {
  // UI-only diagnostic selection. Never changes IZ2S launcher settings.
  const smilebasic = document.getElementById('game-sm4');
  const civilization = document.getElementById('game-civ7');
  const details = document.getElementById('balatro-diagnostic-panel');
  const btn = document.getElementById('balatro-audit-run');
  const host = document.getElementById('balatro-audit-host');
  const result = document.getElementById('balatro-audit-result');
  const setup = document.getElementById('setup');
  if (!smilebasic || !civilization || !details || !btn || !host || !result || !setup) return;

  const balatro = document.createElement('button');
  balatro.id = 'game-balatro';
  balatro.type = 'button';
  balatro.textContent = 'Balatro (experimental)';
  balatro.setAttribute('aria-pressed', 'false');
  civilization.before(balatro);

  const style = document.createElement('style');
  style.textContent = `
    #setup.balatro-experimental > :not(.game-selector):not(#balatro-diagnostic-panel) { display:none !important; }
    #setup.balatro-experimental #balatro-diagnostic-panel { display:block; }
    #setup.balatro-experimental #game-balatro { outline:2px solid #b0d838;outline-offset:-2px; }
    #setup.balatro-experimental #game-sm4,
    #setup.balatro-experimental #game-civ7 { outline:none; }
    #setup.balatro-experimental #game-sm4.selected,
    #setup.balatro-experimental #game-civ7.selected { background:transparent; }
  `;
  document.head.appendChild(style);

  function selectBalatro() {
    // No MutationObserver: IZ2S re-renders existing buttons frequently.
    // Avoid changing those buttons' classes, which previously caused a render loop.
    if (smilebasic.disabled && civilization.disabled) return;
    setup.classList.add('balatro-experimental');
    balatro.setAttribute('aria-pressed', 'true');
    details.open = true;
  }
  function leaveBalatro() {
    setup.classList.remove('balatro-experimental');
    balatro.setAttribute('aria-pressed', 'false');
  }
  balatro.addEventListener('click', selectBalatro);
  smilebasic.addEventListener('click', leaveBalatro, {capture:true});
  civilization.addEventListener('click', leaveBalatro, {capture:true});

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    result.textContent = 'Checking Balatro Lua RPC…';
    try {
      const response = await fetch('/api/balatro/diagnose', {
        method: 'POST',
        headers: {'content-type':'application/json', 'x-iz-key':location.hash.slice(1)},
        body: JSON.stringify({host:host.value.trim()}),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || 'Diagnostic failed');
      result.textContent = JSON.stringify(data,null,2);
    } catch (error) {
      result.textContent = 'Diagnostic unavailable: ' + error.message;
    } finally {btn.disabled = false;}
  });
})();
