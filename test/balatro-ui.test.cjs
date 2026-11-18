'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname,'../panel/ui/panel.html'),'utf8');
const source = fs.readFileSync(path.join(__dirname,'../panel/ui/balatro-diagnostics.js'),'utf8');
const server = fs.readFileSync(path.join(__dirname,'../panel/http.cjs'),'utf8');

test('Balatro browser code is served and loaded after DOM exists', () => {
  assert.match(html, /<script[^>]+src="\/balatro-diagnostics\.js\?v=/);
  assert.match(server, /['"]\/balatro-diagnostics\.js['"]\s*:/);
});
test('experimental selector is created and opens only diagnostic view', () => {
  assert.match(source, /balatro\.id\s*=\s*['"]game-balatro['"]/);
  assert.match(source, /details\.open\s*=\s*true/);
  assert.match(source, /balatroExperimental|balatro-experimental/);
  assert.match(source, /aria-pressed/);
});
test('no launch commands or native calls in Balatro browser code', () => {
  assert.doesNotMatch(source, /\/api\/start\b|\/api\/launch-settings\b|native_invoke\s*\(|love\.ffi\.invoke\s*\(/);
});
test('diagnostics stay authenticated via application token', () => {
  assert.match(source, /['"]x-iz-key['"]\s*:\s*location\.hash\.slice\(1\)/);
  assert.match(server, /req\.headers\[['"]x-iz-key['"]\]/);
});

test('selector has no mutation observer or native launch actions', () => {
  assert.doesNotMatch(source, /new\s+MutationObserver\s*\(/);
  assert.match(source, /function selectBalatro\s*\(/);
  assert.match(source, /function leaveBalatro\s*\(/);
  assert.doesNotMatch(source, /\/api\/start\b|\/api\/launch-settings\b/);
});
test('Balatro mode isolates its own dashboard from original controls', () => {
  const css = fs.readFileSync(path.join(__dirname,'../panel/ui/balatro-diagnostics.css'),'utf8');
  assert.match(css, /#setup\.balatro-experimental > :not\(\.game-selector\):not\(#balatro-diagnostic-panel\)/);
  assert.match(source, /dashboard\.className = 'balatro-dashboard'/);
  assert.match(source, /capabilities\.className = 'balatro-caps'/);
});
test('technical JSON is collapsible and not the default view', () => {
  assert.match(source, /technical\.className = 'balatro-technical'/);
  assert.match(source, /technical\.open = false/);
  assert.match(source, /technical\.append\(technicalTitle, result\)/);
});

test('Balatro CSS is CSP-compatible and served by the panel', () => {
  assert.match(html, /href="\/balatro-diagnostics\.css\?v=2"/);
  assert.match(server, /['"]\/balatro-diagnostics\.css['"]\s*:/);
  assert.doesNotMatch(source, /document\.createElement\(['"]style['"]\)/);
});

test('read-only state route and controls belong to Balatro dashboard', () => {
  assert.match(server, /\/api\/balatro\/status/);
  assert.match(source, /fetch\('\/api\/balatro\/status'/);
  assert.match(source, /controls\.append\(host, btn\)/);
  assert.match(source, /dashboard\.append\(heading, notice, controls, status, capabilities\)/);
  const css=fs.readFileSync(path.join(__dirname,'../panel/ui/balatro-diagnostics.css'),'utf8');
  assert.match(css, /\.balatro-controls/);
});

test('exclusive Balatro visual highlight overrides core engine selection', () => {
 const css=fs.readFileSync(path.join(__dirname,'../panel/ui/balatro-diagnostics.css'),'utf8');
 assert.match(css, /#setup\.balatro-experimental \.game-selector #game-sm4\.selected/);
 assert.match(css, /#setup\.balatro-experimental \.game-selector #game-balatro/);
 assert.match(source, /smilebasic\.setAttribute\('aria-pressed', 'false'\)/);
});
test('clearing Balatro session uses authenticated no-payload API', () => {
 assert.match(source, /\/api\/balatro\/disconnect/);
 assert.match(server, /\/api\/balatro\/disconnect/);
 assert.match(source, /disconnectButton\.addEventListener\('click'/);
});
