'use strict';
// Pure, data-only planning for Balatro's documented love.ffi.declare(ret,args,address).
// Does not resolve address symbols, construct Lua payloads or invoke native code.
const MAX_INTEGER_ARGS=8;
const MAX_FLOAT_ARGS=8;
const MAX_PARAMS=MAX_INTEGER_ARGS+MAX_FLOAT_ARGS;
const SIGNATURE=Object.freeze({
  declare:Object.freeze(['returnType','argumentTypes','address']),
  invoke:Object.freeze(['target','...arguments']),
});
const ALIASES=Object.freeze({
  i32:'int32_t',u32:'uint32_t',i64:'int64_t',u64:'uint64_t',
  pointer:'void *',f32:'float',f64:'double',
});
const GP_TYPES=Object.freeze([
  'bool','char','signed char','unsigned char','short','unsigned short',
  'int','unsigned','unsigned int','long','unsigned long','long long',
  'unsigned long long','int8_t','uint8_t','int16_t','uint16_t',
  'int32_t','uint32_t','int64_t','uint64_t','intptr_t','uintptr_t',
  'size_t','ssize_t','ptrdiff_t','void *','const void *','char *',
  'const char *','uint8_t *','const uint8_t *',
]);
const FP_TYPES=Object.freeze(['float','double']);
const SUPPORTED_TYPES=Object.freeze([...new Set([
  'void',...GP_TYPES,...FP_TYPES,...Object.keys(ALIASES)
])]);
function normalizeType(type){
  if(typeof type!=='string'||!SUPPORTED_TYPES.includes(type))
    throw Error('Unsupported FFI type');
  return ALIASES[type]||type;
}
function validateDeclaration(input){
  if(!input||typeof input!=='object'||Array.isArray(input))
    throw Error('Declaration descriptor must be an object');
  if(Object.keys(input).some(key=>!['returnType','argumentTypes','address'].includes(key)))
    throw Error('Unexpected declaration descriptor field');
  if(!SUPPORTED_TYPES.includes(input.returnType))
    throw Error('Unrecognized return type');
  if(!Array.isArray(input.argumentTypes)||input.argumentTypes.length>MAX_PARAMS||
     input.argumentTypes.some(t=>!SUPPORTED_TYPES.includes(t)||t==='void'))
    throw Error('Unsupported argument type list');
  const nativeArguments=input.argumentTypes.map(normalizeType);
  const nativeReturn=normalizeType(input.returnType);
  const floating=nativeArguments.filter(t=>FP_TYPES.includes(t)).length;
  const integer=nativeArguments.length-floating;
  if(integer>MAX_INTEGER_ARGS||floating>MAX_FLOAT_ARGS)
    throw Error('Candidate AArch64 register class limit exceeded');
  // This label is never interpreted as a raw address.
  if(typeof input.address!=='string'||!/^sdk:[a-z][a-z0-9_-]{0,63}$/.test(input.address))
    throw Error('Expected symbolic SDK reference (never a raw address)');
  return Object.freeze({
    returnType:input.returnType,
    argumentTypes:Object.freeze([...input.argumentTypes]),
    address:input.address,
    ffiReturnType:nativeReturn,
    ffiArgumentTypes:Object.freeze(nativeArguments),
    registers:Object.freeze({integer,floating}),
  });
}
function assessProfile(profile,declaration){
  const descriptor=validateDeclaration(declaration);
  if(!profile||profile.backend!=='balatro'||profile.mode!=='read-only-ffi-profile')
    throw Error('Expected Balatro FFI profile');
  const declare=profile.declare,invoke=profile.invoke;
  if(!declare||!invoke)throw Error('Incomplete FFI profile');
  const shapeMatches=declare.implementation==='Lua'&&declare.parameters===3&&
    declare.varargs===false&&invoke.implementation==='Lua'&&
    invoke.parameters===1&&invoke.varargs===true;
  return {
    backend:'balatro',mode:'ffi-declaration-planning',
    declaration:descriptor,observedSignatureMatches:shapeMatches,
    sourceTypeModel:'Luminger/balatro-switch-rce/src/bl/ffi_call.lua',
    declarationTypeVocabularyVerified:false,
    functionAddressVerified:false,invocationVerified:false,
    memoryTransportVerified:false,nativeCoreReady:false,
    executionAttempted:false,ready:false,
    reason:shapeMatches
      ? 'Wrapper arity matches source; source-backed C type mapping is planned but unverified on this console.'
      : 'Wrapper arity differs from the source implementation.',
  };
}
module.exports={MAX_PARAMS,MAX_INTEGER_ARGS,MAX_FLOAT_ARGS,SIGNATURE,ALIASES,
  GP_TYPES,FP_TYPES,SUPPORTED_TYPES,normalizeType,validateDeclaration,assessProfile};
