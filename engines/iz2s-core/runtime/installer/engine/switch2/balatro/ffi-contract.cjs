'use strict';
// Data-only FFI declaration compatibility planning.
// Signature is observed on the console; meanings of types/ABI remain unverified.
const MAX_INTEGER_ARGS=8;
const MAX_FLOAT_ARGS=8;
const MAX_PARAMS=MAX_INTEGER_ARGS+MAX_FLOAT_ARGS;
const SIGNATURE=Object.freeze({
  declare:Object.freeze(['returnType','argumentTypes','address']),
  invoke:Object.freeze(['...arguments']),
});
const SUPPORTED_TYPES=Object.freeze(['void','i32','u32','i64','u64','pointer','f32','f64']);
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
  const floating=input.argumentTypes.filter(t=>t==='f32'||t==='f64').length;
  const integer=input.argumentTypes.length-floating;
  if(integer>MAX_INTEGER_ARGS||floating>MAX_FLOAT_ARGS)
    throw Error('Candidate AArch64 register class limit exceeded');
  // This is a descriptive label only, not a raw function pointer.
  if(typeof input.address!=='string'||!/^sdk:[a-z][a-z0-9_-]{0,63}$/.test(input.address))
    throw Error('Expected symbolic SDK reference (never a raw address)');
  return Object.freeze({
    returnType:input.returnType,
    argumentTypes:Object.freeze([...input.argumentTypes]),
    address:input.address,
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
    declarationTypeVocabularyVerified:false,
    functionAddressVerified:false,invocationVerified:false,
    memoryTransportVerified:false,nativeCoreReady:false,
    executionAttempted:false,ready:false,
    reason:shapeMatches
      ? 'Wrapper arity matches the candidate contract, but accepted types and executable targets are not verified.'
      : 'Wrapper arity differs from the candidate contract; native adapter cannot assume this signature.',
  };
}
module.exports={MAX_PARAMS,MAX_INTEGER_ARGS,MAX_FLOAT_ARGS,SIGNATURE,SUPPORTED_TYPES,validateDeclaration,assessProfile};
