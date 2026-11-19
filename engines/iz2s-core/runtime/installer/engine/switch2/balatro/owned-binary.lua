-- Bounded title-owned binary buffers. Not a process memory or native-IPC API.
local OP="status"
local TOKEN="none"
local ID=0
local DST_ID=0
local DST_OFFSET=0
local OFFSET=0
local LENGTH=0
local HEX=""
local KEY="__IZ2S_BALATRO_BINARY_V1"
local function reply(state,detail,value)
 return "IZ2S_BINARY_V1;state="..state..";detail="..detail..";value="..tostring(value or "0")
end
local state=rawget(_G,KEY)
if OP=="init" then
 if state then return reply("blocked","in_use") end
 local ok,ffi=pcall(require,"ffi")
 if not ok then return reply("blocked","ffi_missing") end
 state={token=TOKEN,next=1,buffers={},used=0,ffi=ffi}
 rawset(_G,KEY,state)
 return reply("ok","none")
end
if not state then return reply("blocked","not_initialized") end
if state.token~=TOKEN then return reply("blocked","session_mismatch") end
local function checked(id,off,len)
 local b=state.buffers[id]
 if not b then error("stale_handle") end
 if off<0 or len<0 or off>b.size or len>b.size-off then error("bounds") end
 return b
end
local function action()
 if OP=="status" then return tostring(state.used) end
 if OP=="alloc" then
  if LENGTH<1 or LENGTH>65536 or state.used+LENGTH>131072 then error("quota") end
  local count=0
  for _ in pairs(state.buffers) do count=count+1 end
  if count>=2 then error("quota") end
  local id=state.next
  state.next=id+1
  state.buffers[id]={data=state.ffi.new("uint8_t[?]",LENGTH),size=LENGTH}
  state.used=state.used+LENGTH
  return tostring(id)
 end
 if OP=="write" then
  if #HEX~=LENGTH*2 or LENGTH>1024 then error("bounds") end
  if HEX:find("[^0-9a-f]") then error("invalid_hex") end
  local b=checked(ID,OFFSET,LENGTH)
  for i=1,LENGTH do
   b.data[OFFSET+i-1]=tonumber(HEX:sub(2*i-1,2*i),16)
  end
  return tostring(LENGTH)
 end
 if OP=="copy" then
  if LENGTH<1 or LENGTH>1024 or ID==DST_ID then error("bounds") end
  local src=checked(ID,OFFSET,LENGTH)
  local dst=checked(DST_ID,DST_OFFSET,LENGTH)
  local bridge=type(love)=="table" and love.ffi or nil
  local app=package.loaded["bl.app"]
  local info=type(app)=="table" and app.info or nil
  if type(bridge)~="table" or type(bridge.native_ready)~="function" or
     type(bridge.declare)~="function" then error("native_unavailable") end
  local preflight,ready=pcall(bridge.native_ready)
  if not preflight or ready~=true then error("native_unavailable") end
  if type(info)~="table" or type(info.sdk_base)~="number" or
     type(info.off)~="table" or type(info.off.memcpy)~="number" then
    error("native_unavailable")
  end
  local declared,copy=pcall(bridge.declare,"void",
     {"void *","const void *","size_t"},info.sdk_base+info.off.memcpy)
  if not declared or type(copy)~="function" then error("native_unavailable") end
  local executed=pcall(copy,dst.data+DST_OFFSET,src.data+OFFSET,LENGTH)
  if not executed then error("native_call_failed") end
  return tostring(LENGTH)
 end
 if OP=="read" then
  if LENGTH>1024 then error("bounds") end
  local b=checked(ID,OFFSET,LENGTH)
  local out={}
  for i=0,LENGTH-1 do out[#out+1]=string.format("%02x",tonumber(b.data[OFFSET+i])) end
  return table.concat(out)
 end
 if OP=="release" then
  local b=checked(ID,0,0)
  state.ffi.fill(b.data,b.size,0)
  state.used=state.used-b.size
  state.buffers[ID]=nil
  return tostring(state.used)
 end
 if OP=="clear" then
  for id,b in pairs(state.buffers) do
   state.ffi.fill(b.data,b.size,0)
   state.buffers[id]=nil
  end
  state.used=0
  rawset(_G,KEY,nil)
  return "0"
 end
 error("invalid_operation")
end
local ok,result=pcall(action)
if not ok then
 local tag=tostring(result):match("([a-z_]+)$")
 for _,name in ipairs({"stale_handle","bounds","quota","invalid_hex","invalid_operation","native_unavailable","native_call_failed"}) do
  if tag==name then return reply("blocked",name) end
 end
 return reply("blocked","operation_failed")
end
return reply("ok","none",result)
