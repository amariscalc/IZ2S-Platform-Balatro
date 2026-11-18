-- Balatro title-local, bounded, persistent owned-buffer registry.
-- No raw address ingress or egress. RPC calls share _G in one title session.
local OP="status"
local A=0
local B=0
local C=0
local D=0
local KEY="__IZ2S_OWNED_REGISTRY_V1"
local function reply(state,detail,value)
 return "IZ2S_REG_V1;op="..OP..";state="..state..";detail="..detail..";value="..tostring(value or 0)
end
local ok,ffi=pcall(require,"ffi")
if not ok then return reply("blocked","ffi_missing",0) end
local registry=rawget(_G,KEY)
if OP=="init" then
 if registry then return reply("blocked","already_initialized",0) end
 registry={next=1,buffers={},used=0}
 rawset(_G,KEY,registry)
 return reply("ok","initialized",0)
end
if not registry then return reply("blocked","not_initialized",0) end
local function entry(id,off,len)
 if type(id)~="number" or id~=math.floor(id) then error("invalid_handle") end
 local buffer=registry.buffers[id]
 if not buffer then error("stale_handle") end
 if type(off)~="number" or type(len)~="number" or
    off~=math.floor(off) or len~=math.floor(len) or
    off<0 or len<0 or off>buffer.size or len>buffer.size-off then error("bounds") end
 return buffer
end
local function perform()
 if OP=="status" then return registry.used end
 if OP=="alloc" then
  if A<1 or A>128 or A~=math.floor(A) or registry.used+A>512 then error("quota") end
  local count=0
  for _ in pairs(registry.buffers) do count=count+1 end
  if count>=4 then error("quota") end
  local id=registry.next;registry.next=id+1
  registry.buffers[id]={data=ffi.new("uint8_t[?]",A),size=A}
  registry.used=registry.used+A
  return id
 end
 if OP=="write" then
  if C<0 or C>255 or C~=math.floor(C) then error("invalid_byte") end
  local b=entry(A,B,1);b.data[B]=C;return C
 end
 if OP=="read" then
  local b=entry(A,B,1);return tonumber(b.data[B])
 end
 if OP=="copy" then
  local dst=entry(A,B,D)
  local src=entry(C,0,D)
  if A==C then error("overlap_refused") end
  ffi.copy(dst.data+B,src.data,D)
  return D
 end
 if OP=="release" then
  local b=entry(A,0,0)
  ffi.fill(b.data,b.size,0)
  registry.used=registry.used-b.size
  registry.buffers[A]=nil
  return registry.used
 end
 if OP=="clear" then
  for id,b in pairs(registry.buffers) do ffi.fill(b.data,b.size,0);registry.buffers[id]=nil end
  registry.used=0
  rawset(_G,KEY,nil)
  return 0
 end
 error("invalid_operation")
end
local worked,result=pcall(perform)
if not worked then
 local errorName=tostring(result):match("(quota|stale_handle|bounds|invalid_byte|overlap_refused|invalid_handle|invalid_operation)")
 return reply("blocked",errorName or "operation_failed",0)
end
return reply("ok","none",result)
