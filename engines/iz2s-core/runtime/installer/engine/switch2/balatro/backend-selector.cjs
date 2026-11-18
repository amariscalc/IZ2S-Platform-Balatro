'use strict';
const {audit} = require('./diagnose.cjs');
const BACKENDS = Object.freeze(['smilebasic', 'balatro']);
const BLOCKED = Object.freeze(['call', 'callAddress', 'pair', 'read', 'write', 'query', 'verifyFunction', 'store64', 'batch', 'ipc', 'startCore']);
function selectBackend(name, options = {}) {
  if (!BACKENDS.includes(name)) throw Error('Unknown Switch 2 backend: ' + String(name));
  if (name === 'smilebasic') return Object.freeze({
    name, mode: 'existing-engine-unchanged', diagnosticOnly: false,
    async status() {return {backend: name, checked: false, ready: false,
      message: 'Original SmileBASIC startup is unchanged; no active session was queried.'};},
  });
  const host = options.host;
  if (typeof host !== 'string' || !host.trim()) throw Error('Balatro diagnostic backend requires --host');
  const port = options.port === undefined ? 9026 : options.port;
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('Invalid Balatro port');
  const diagnostic = options.audit || audit;
  const adapter = {
    name, mode: 'diagnostic-only', diagnosticOnly: true,
    async status() {
      const result = await diagnostic(host, {port});
      return {...result, backend: name, mode: 'diagnostic-only',
        iz2s: {...result.iz2s, ready: false, nativeOperationsVerified: false, privilegedSessionVerified: false}};
    },
  };
  for (const operation of BLOCKED) Object.defineProperty(adapter, operation, {
    enumerable: false,
    value: async () => {throw Error('Balatro native operation unavailable: ' + operation);},
  });
  return Object.freeze(adapter);
}
module.exports = {BACKENDS, BLOCKED, selectBackend};
