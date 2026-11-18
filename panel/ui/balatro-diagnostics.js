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

  const style = document.createElement('style');
  style.textContent = [
    '#setup .game-selector .game-buttons {display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;}',
    '@media (max-width:740px){#setup .game-selector .game-buttons {grid-template-columns:1fr;}}',
    '#setup.balatro-experimental > :not(.game-selector):not(#balatro-diagnostic-panel) {display:none !important;}',
    '#setup.balatro-experimental #balatro-diagnostic-panel {display:block;margin-top:16px !important;}',
    '#setup.balatro-experimental #balatro-diagnostic-panel > summary {display:none;}',
    '#setup.balatro-experimental #game-balatro {outline:2px solid #b0d838;outline-offset:-2px;background:#28341f;}',
    '#setup.balatro-experimental #game-sm4.selected,#setup.balatro-experimental #game-civ7.selected {background:#1d261e;}',
    '#balatro-diagnostic-panel .balatro-dashboard {padding:10px 2px 22px;max-width:880px;}',
    '#balatro-diagnostic-panel .balatro-dashboard h2 {margin:0 0 8px;font-size:1.4rem;}',
    '#balatro-diagnostic-panel .balatro-dashboard .balatro-note {color:#abb7ad;line-height:1.5;}',
    '#balatro-diagnostic-panel .balatro-status {padding:14px 16px;margin:14px 0;border:1px solid #405044;border-radius:10px;background:#1b241e;}',
    '#balatro-diagnostic-panel .balatro-status strong {display:block;margin-bottom:5px;}',
    '#balatro-diagnostic-panel .balatro-caps {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:14px 0;}',
    '#balatro-diagnostic-panel .balatro-cap {border:1px solid #354137;border-radius:9px;padding:12px;background:#161d19;}',
    '#balatro-diagnostic-panel .balatro-cap span {display:block;color:#a9b6ab;font-size:.82rem;}',
    '#balatro-diagnostic-panel .balatro-cap strong {display:block;margin-top:4px;}',
    '#balatro-diagnostic-panel .balatro-technical pre {white-space:pre-wrap;overflow-wrap:anywhere;max-height:320px;overflow:auto;}',
    '@media (max-width:580px){#balatro-diagnostic-panel .balatro-caps {grid-template-columns:1fr;}}',
  ].join('\n');
  document.head.appendChild(style);

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
  dashboard.append(heading, notice, status, capabilities);
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

  function selectBalatro() {
    if (smilebasic.disabled && civilization.disabled) return;
    setup.classList.add('balatro-experimental');
    balatro.setAttribute('aria-pressed', 'true');
    details.open = true;
    if (!status.textContent) setStatus('Ready to check Balatro', 'Enter the console IP and select Check Balatro RPC.');
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
