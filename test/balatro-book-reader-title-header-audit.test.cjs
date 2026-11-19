'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {luaFor}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/book-reader-title-header-audit.cjs');
test('only 512 header bytes accepted',()=>{
 assert.throws(()=>luaFor('00'),/512/);
 const code=luaFor('00'.repeat(512));
 assert.match(code,/u32\(9\)==2/);
 assert.match(code,/id=="book-reader"/);
 assert.match(code,/u32\(157\)>0/);
 assert.doesNotMatch(code,/newThread|worker:wait|ffi|mapCode|loadstring|os.execute/);
 assert.ok(Buffer.byteLength(code)<8192);
});
