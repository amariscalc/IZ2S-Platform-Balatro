#!/usr/bin/env node
'use strict';
const {selectBackend} = require('./backend-selector.cjs');
function parseArgs(args) {
  const result = {};
  const allowed = new Set(['--backend', '--host', '--port']);
  if (args.includes('--help')) return {help: true};
  for (let i = 0; i < args.length; i += 2) {
    if (!allowed.has(args[i]) || !args[i + 1] || result[args[i]]) throw Error('Invalid arguments; use --help');
    result[args[i]] = args[i + 1];
  }
  if (!result['--backend']) throw Error('--backend is required');
  return {backend: result['--backend'], host: result['--host'],
    port: result['--port'] === undefined ? undefined : Number(result['--port'])};
}
async function main(argv = process.argv.slice(2)) {
  try {
    const args = parseArgs(argv);
    if (args.help) {
      console.log('Usage: node backend-status.cjs --backend balatro --host <switch-ip> [--port 9026]');
      console.log('       node backend-status.cjs --backend smilebasic');
      return 0;
    }
    const backend = selectBackend(args.backend, args);
    console.log(JSON.stringify(await backend.status(), null, 2));
    return 0;
  } catch (error) {
    console.error(JSON.stringify({ready: false, error: error.message}));
    return 1;
  }
}
if (require.main === module) main().then(code => {process.exitCode = code;});
module.exports = {parseArgs, main};
