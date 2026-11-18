#!/usr/bin/env node
'use strict';
const {request} = require('./rpc.cjs');

// Fixed introspection only: no native invocation, memory, IPC or save writes.
const PROBE = [
  'local l = type(love)=="table" and love.ffi or nil',
  'local a = package.loaded["bl.app"]',
  'local f = pcall(require,"ffi")',
  'return "lua="..tostring(_VERSION)',
  ' .. ";jit="..tostring(jit and jit.version or "unavailable")',
  ' .. ";ffi_module_loaded="..tostring(f)',
  ' .. ";native_declare="..tostring(type(l)=="table" and type(l.declare)=="function")',
  ' .. ";native_invoke="..tostring(type(l)=="table" and type(l.invoke)=="function")',
  ' .. ";sdk_base_present="..tostring(type(a)=="table" and type(a.info)=="table" and a.info.sdk_base~=nil)',
].join('\n');
const EXPECTED = new Set(['lua', 'jit', 'ffi_module_loaded', 'native_declare', 'native_invoke', 'sdk_base_present']);
function parse(reply) {
  if (typeof reply !== 'string' || !reply.startsWith('-> ')) throw Error('Unexpected Balatro RPC response');
  const values = {};
  for (const segment of reply.slice(3).trim().split(';')) {
    const index = segment.indexOf('=');
    if (index < 1) throw Error('Malformed capability field');
    const key = segment.slice(0, index);
    if (!EXPECTED.has(key) || Object.hasOwn(values, key)) throw Error('Unexpected or duplicate capability field');
    const raw = segment.slice(index + 1);
    values[key] = ['true', 'false'].includes(raw) ? raw === 'true' : raw;
  }
  if (Object.keys(values).length !== EXPECTED.size) throw Error('Missing capability fields');
  return values;
}
async function audit(host, options = {}) {
  const reply = await request({host, lua: PROBE, ...options});
  return {
    backend: 'balatro',
    source: 'Balatro TCP Lua RPC introspection',
    capabilities: parse(reply),
    iz2s: {ready: false, nativeOperationsVerified: false, privilegedSessionVerified: false},
  };
}
async function main() {
  const [host, portArg] = process.argv.slice(2);
  if (!host || process.argv.includes('--help')) {
    console.log('Usage: node diagnose.cjs <switch-ip> [port]');
    process.exitCode = host ? 0 : 2;
    return;
  }
  try {
    const result = await audit(host, {port: portArg ? Number(portArg) : 9026});
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(JSON.stringify({backend: 'balatro', ready: false, error: error.message}));
    process.exitCode = 1;
  }
}
if (require.main === module) main();
module.exports = {PROBE, parse, audit};
