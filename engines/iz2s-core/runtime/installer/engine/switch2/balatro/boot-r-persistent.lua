-- Optional IZ2S R boot gate. No native calls and no SD access.
local M={}
local KEY="__IZ2S_R_BOOT_PERSISTENT_V1"
local function log(s)
 pcall(function() love.filesystem.append("bl_log.txt","[IZ2S/R] "..tostring(s):sub(1,160).."\n") end)
end
local function held()
 local js=love and love.joystick
 if type(js)~="table" or type(js.getJoysticks)~="function" then return false end
 local ok,devices=pcall(js.getJoysticks)
 if not ok or type(devices)~="table" then return false end
 for _,j in ipairs(devices) do
  local success,down=pcall(function() return j:isGamepadDown("rightshoulder") end)
  if success and down then return true end
 end
 return false
end
local function activate(state)
 if state.phase~="armed" then return end
 state.phase="loading"
 local ok,err=pcall(function()
  local model=require("iz2s.model")
  assert(type(model)=="table","no model")
  rawset(_G,"__IZ2S_CANONICAL_FOCUS_MODEL_V1",model)
  assert(require("iz2s.visual_base")=="IZ2S_VISUAL_V1;stage=base;ok=1","no visual base")
  assert(require("iz2s.visual_scene")=="IZ2S_VISUAL_V1;stage=scene;ok=1","no scene")
  local result=require("iz2s.focus")
  assert(type(result)=="string" and result:find("^IZ2S_FOCUS_V1;phase=running;"),"focus not running")
 end)
 state.phase=ok and "menu" or "error"
 log(ok and "ORBIT FOCUS started" or ("menu error: "..tostring(err)))
end
function M.install()
 local current=rawget(_G,KEY)
 if type(current)=="table" then return current end
 local ok,console=pcall(require,"bl.console")
 local timer=love and love.timer
 if not ok or type(console)~="table" or type(console.draw)~="function" or
    type(timer)~="table" or type(timer.getTime)~="function" then
  log("boot selector unavailable; normal launcher retained")
  return nil
 end
 local state={phase="armed",started=timer.getTime()}
 local original=console.draw
 local function wrapper(...)
  local success,result=pcall(original,...)
  if state.phase=="armed" then
   local good,now=pcall(timer.getTime)
   if good and type(now)=="number" and now-state.started>5 then
    state.phase="expired"
   elseif held() then activate(state) end
  end
  if not success then log("original console draw failed") end
  if success then return result end
 end
 state.original=original
 rawset(_G,KEY,state)
 console.draw=wrapper
 log("armed: hold R in first 5 seconds")
 return state
end
return M
