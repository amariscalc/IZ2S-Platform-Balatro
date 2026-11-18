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
function create({probe = audit} = {}) {
  let inFlight = null;
  async function run(host) {
    validateTarget(host);
    if (inFlight) throw Error('Balatro audit already in progress');
    const job = Promise.resolve().then(() => probe(host, {port:9026, timeoutMs:5000}));
    inFlight = job;
    try {
      const result = await job;
      return {backend:'balatro', mode:'diagnostic-only', capabilities:result.capabilities,
        iz2s:{ready:false,nativeOperationsVerified:false,privilegedSessionVerified:false}};
    } finally {if (inFlight === job) inFlight = null;}
  }
  return {run};
}
module.exports = {create,validateTarget};
