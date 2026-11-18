'use strict';
const net = require('node:net');
const {audit} = require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/diagnose.cjs');
function validateTarget(host) {
  if (typeof host !== 'string' || net.isIP(host) !== 4) throw Error('Expected a private IPv4 console address');
  const a = host.split('.').map(Number);
  const privateLan = a[0] === 10 || (a[0] === 172 && a[1] >= 16 && a[1] <= 31) ||
    (a[0] === 192 && a[1] === 168);
  if (!privateLan || a[3] === 0 || a[3] === 255) throw Error('Console address must be on a private LAN');
  return host;
}
function create({probe = audit, clock = () => new Date().toISOString()} = {}) {
  let inFlight = null;
  let state = {phase:'idle', backend:'balatro', mode:'diagnostic-only', ready:false,
    nativeOperationsVerified:false, privilegedSessionVerified:false};
  const snapshot = () => ({...state});
  async function run(host) {
    validateTarget(host);
    if (inFlight) throw Error('Balatro audit already in progress');
    state = {phase:'checking', backend:'balatro', mode:'diagnostic-only', ready:false,
      nativeOperationsVerified:false, privilegedSessionVerified:false};
    const job = Promise.resolve().then(() => probe(host, {port:9026, timeoutMs:5000}));
    inFlight = job;
    try {
      const result = await job;
      const capabilities = result.capabilities;
      if (!capabilities || typeof capabilities !== 'object' || Array.isArray(capabilities))
        throw Error('Malformed Balatro capability response');
      state = {phase:'connected', backend:'balatro', mode:'diagnostic-only', checkedAt:clock(),
        ready:false,nativeOperationsVerified:false,privilegedSessionVerified:false};
      return {...snapshot(),capabilities,iz2s:{ready:false,
        nativeOperationsVerified:false,privilegedSessionVerified:false}};
    } catch (error) {
      state = {phase:'unavailable', backend:'balatro', mode:'diagnostic-only', checkedAt:clock(),
        ready:false,nativeOperationsVerified:false,privilegedSessionVerified:false,
        message:'Balatro RPC diagnostic failed'};
      throw error;
    } finally {if (inFlight === job) inFlight = null;}
  }
  return {run,snapshot};
}
module.exports = {create,validateTarget};
