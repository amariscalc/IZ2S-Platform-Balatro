'use strict';
(() => {
  // Balatro is a distinct diagnostic-only view, not an IZ2S native launcher.
  // Never change the original loader settings or observe/modify its render loop.
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

  const dashboard = document.createElement('section');
  dashboard.className = 'balatro-dashboard';
  const heading = document.createElement('h2');
  heading.textContent = 'Balatro — experimental connection';
  const notice = document.createElement('p');
  notice.className = 'balatro-note';
  notice.textContent = 'This backend currently checks the Balatro Lua RPC. Native IZ2S launch, memory operations and privileged IPC are not implemented.';
  const status = document.createElement('div');
  status.className = 'balatro-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const capabilities = document.createElement('div');
  capabilities.className = 'balatro-caps';
  const technical = document.createElement('details');
  technical.className = 'balatro-technical';
  const technicalTitle = document.createElement('summary');
  technicalTitle.textContent = 'Technical JSON';
  technical.append(technicalTitle, result);
  const controls = document.createElement('div');
  controls.className = 'balatro-controls';
  const inputLabel = details.querySelector('label[for="balatro-audit-host"]');
  if (inputLabel) controls.append(inputLabel);
  controls.append(host, btn);
  dashboard.append(heading, notice, controls, status, capabilities);
  // Reuse original host input and audit button, but move the verbose JSON into
  // an explicitly collapsible technical section.
  const originalHint = details.querySelector('p.hint');
  if (originalHint) originalHint.hidden = true;
  details.append(dashboard, technical);

  const diagnostics = [
    ['Lua runtime','lua'], ['LuaJIT','jit'],
    ['FFI module','ffi_module_loaded'], ['Native declaration interface','native_declare'],
    ['Native invocation interface','native_invoke'], ['SDK base available','sdk_base_present'],
  ];
  function setStatus(title, message) {
    status.replaceChildren();
    const main = document.createElement('strong');
    main.textContent = title;
    const description = document.createElement('span');
    description.textContent = message;
    status.append(main, description);
  }
  function display(data) {
    capabilities.replaceChildren();
    for (const [label,key] of diagnostics) {
      const tile = document.createElement('div');
      tile.className = 'balatro-cap';
      const name = document.createElement('span');
      name.textContent = label;
      const value = document.createElement('strong');
      const item = data.capabilities?.[key];
      value.textContent = item === true ? 'Available' : item === false ? 'Unavailable' : String(item ?? 'Unknown');
      tile.append(name, value);
      capabilities.append(tile);
    }
    result.textContent = JSON.stringify(data, null, 2);
    technical.open = false;
    setStatus('Balatro RPC connected', 'Lua diagnostics completed. IZ2S native engine remains unavailable.');
  }

  async function restoreStatus() {
    try {
      const response = await fetch('/api/balatro/status', {
        method:'GET', headers:{'x-iz-key':location.hash.slice(1)},
      });
      if (!response.ok) return;
      const state = await response.json();
      if (state.phase === 'checking') setStatus('Checking Balatro RPC…', 'A diagnostic is already in progress.');
      else if (state.phase === 'connected') setStatus('Last check completed', 'Run Check Balatro RPC to verify current connectivity.');
      else if (state.phase === 'unavailable') setStatus('Previous check failed', 'Run a new check when Balatro RPC is listening.');
    } catch {
      // Optional snapshot is never a prerequisite for showing the screen.
    }
  }
  function selectBalatro() {
    if (smilebasic.disabled && civilization.disabled) return;
    setup.classList.add('balatro-experimental');
    balatro.setAttribute('aria-pressed', 'true');
    details.open = true;
    if (!status.textContent) setStatus('Ready to check Balatro', 'Enter the console IP and select Check Balatro RPC.');
    void restoreStatus();
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
    capabilities.replaceChildren();
    setStatus('Checking Balatro RPC…', 'Waiting for the diagnostic response.');
    try {
      const response = await fetch('/api/balatro/diagnose', {
        method: 'POST',
        headers: {'content-type':'application/json', 'x-iz-key':location.hash.slice(1)},
        body: JSON.stringify({host:host.value.trim()}),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || 'Diagnostic failed');
      display(data);
    } catch (error) {
      result.textContent = '';
      setStatus('Balatro RPC unavailable', error.message);
    } finally {btn.disabled = false;}
  });
})();
