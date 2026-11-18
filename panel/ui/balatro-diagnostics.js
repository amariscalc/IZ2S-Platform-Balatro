'use strict';
(() => {
  // Diagnostic-only UI selection; never modifies the main IZ2S loader setting.
  const games = document.querySelector('.game-selector .game-buttons');
  const smilebasic = document.getElementById('game-sm4');
  const civilization = document.getElementById('game-civ7');
  const details = document.getElementById('balatro-diagnostic-panel');
  const btn = document.getElementById('balatro-audit-run');
  const host = document.getElementById('balatro-audit-host');
  const result = document.getElementById('balatro-audit-result');
  const setup = document.getElementById('setup');
  if (!games || !smilebasic || !civilization || !details || !btn || !host || !result || !setup) return;

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
    #game-balatro.selected { outline:2px solid #b0d838; outline-offset:-2px; }
  `;
  document.head.appendChild(style);

  let active = false;
  function reflect() {
    // Existing application render calls may update selected game buttons.
    // Only touch attributes when needed to avoid mutation feedback loops.
    setup.classList.toggle('balatro-experimental', active);
    balatro.classList.toggle('selected', active);
    const pressed = String(active);
    if (balatro.getAttribute('aria-pressed') !== pressed) balatro.setAttribute('aria-pressed', pressed);
    if (active) for (const game of [smilebasic, civilization]) {
      game.classList.remove('selected');
      if (game.getAttribute('aria-pressed') !== 'false') game.setAttribute('aria-pressed', 'false');
    }
  }
  balatro.addEventListener('click', () => {
    if (smilebasic.disabled && civilization.disabled) return;
    active = true;
    details.open = true;
    reflect();
  });
  for (const game of [smilebasic, civilization]) game.addEventListener('click', () => {
    active = false;
    reflect();
  }, {capture: true});
  const observer = new MutationObserver(() => { if (active) reflect(); });
  observer.observe(smilebasic, {attributes:true,attributeFilter:['class','aria-pressed']});
  observer.observe(civilization, {attributes:true,attributeFilter:['class','aria-pressed']});

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
