'use strict';
const net = require('node:net');

// One Lua chunk per connection, terminated by TCP write half-close.
// This is not a native-operation or privileged IPC adapter.
function request({host, port = 9026, lua, timeoutMs = 5000, maxReplyBytes = 16384}) {
  if (typeof host !== 'string' || !host.length || /\s/.test(host)) throw Error('Invalid Balatro host');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('Invalid Balatro port');
  if (typeof lua !== 'string' || !lua.length || Buffer.byteLength(lua) > 8192) throw Error('Invalid Lua request');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000) throw Error('Invalid RPC timeout');
  return new Promise((resolve, reject) => {
    const sock = net.connect({host, port});
    let finished = false, size = 0;
    const chunks = [];
    function finish(error, value) {
      if (finished) return;
      finished = true;
      sock.destroy();
      if (error) reject(error); else resolve(value);
    }
    sock.setTimeout(timeoutMs, () => finish(Error('Balatro RPC timed out; request not retried')));
    sock.on('connect', () => sock.end(lua));
    sock.on('data', chunk => {
      size += chunk.length;
      if (size > maxReplyBytes) return finish(Error('Balatro RPC reply exceeded size limit'));
      chunks.push(chunk);
    });
    sock.on('error', error => finish(error));
    sock.on('end', () => finish(null, Buffer.concat(chunks).toString('utf8')));
    sock.on('close', () => {
      if (!finished) finish(Error('Balatro RPC connection closed before response completed'));
    });
  });
}
module.exports = {request};
