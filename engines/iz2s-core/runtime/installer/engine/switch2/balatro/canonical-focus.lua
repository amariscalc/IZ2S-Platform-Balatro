-- IZ2S ORBIT FOCUS: partial Lua/LÖVE port of the upstream canonical menu.
-- Uses shared geometry/navigation from canonical-focus-model.lua injected by PC.
-- Read-only presentation: no fabricated catalog, install or native launch.
local OP="status"
local Model=rawget(_G,"__IZ2S_CANONICAL_FOCUS_MODEL_V1")
local KEY="__IZ2S_CANONICAL_FOCUS_LUA_V1"
local app=rawget(_G,KEY)
local function countEvents(field)
 app[field]=math.min(999999999,(app[field] or 0)+1)
end
local function draw()
 if not app or rawget(_G,KEY)~=app then return end
 app.callbacks=math.min(999999999,(app.callbacks or 0)+1)
 local g=love and love.graphics
 if type(g)~="table" or type(g.push)~="function" then return end
 if not pcall(g.push,"all") then return end
 local ok=pcall(function()
  local w,h=g.getDimensions()
  local scale=math.min(w/Model.width,h/Model.height)
  g.translate((w-Model.width*scale)/2,(h-Model.height*scale)/2)
  g.scale(scale)
  local scene=rawget(_G,"__IZ2S_FOCUS_SCENE_V1")
  local painted=false
  if type(scene)=="function" then
   painted=pcall(scene,app,g)
   if not painted then countEvents("errors") end
  end
  if not painted then
   g.setColor(Model.colors.background)
   g.rectangle("fill",0,0,1920,1080)
   g.setColor(Model.colors.ink);g.print("IZ2S",96,68,0,3.2,3.2)
   g.setColor(Model.colors.accent)
   g.print("ORBIT FOCUS",100,178,0,1.4,1.4)
   if app.detail then g.print(app.detail.name,130,390,0,2,2)
   elseif app.model.picking then
    g.print("BROWSE PACKAGES",115,286,0,2,2)
    if not app.catalog or #app.catalog==0 then g.print("NO VERIFIED PACKAGE SOURCE",115,354) end
    for i,p in ipairs(app.catalog or {}) do
     local x,y=Model.cardCenter(i-1,app.model.flow)
     if x>280 and x<1870 then
      g.rectangle("line",x-105,y-109,210,218)
      g.print(p.name,x-90,y+40)
     end
    end
   else
    g.print("NO VERIFIED APPLICATIONS",782,420,0,1.2,1.2)
    g.print("A  BROWSE",535,500,0,1.6,1.6)
   end
  end
 end)
 pcall(g.pop)
 if ok then countEvents("frames") else
  countEvents("errors")
  app.drawLastError="renderer-failed"
 end
end
local function navigate(action)
 if not app then return end
 local model=app.model
 if app.detail then
  if action=="back" then app.detail=nil;model.notice=nil
  elseif action=="select" and app.detail.id=="book-reader" then
   app.bookReaderLaunchRequests=math.min(999999999,(app.bookReaderLaunchRequests or 0)+1)
   -- Deliver exactly one armed Book Reader request directly to the retained title worker.
   local s=rawget(_G,"__IZ2S_BOOK_READER_STATE_CRC_WORKER_V1")
   local stateCrcMode=type(s)=="table"
   if not stateCrcMode then s=rawget(_G,"__IZ2S_BOOK_READER_HEADER_WORKER_V1") end
   local headerMode=type(s)=="table" and not stateCrcMode
   if not headerMode then s=rawget(_G,"__IZ2S_BOOK_READER_CONTROLLER_BRIDGE_V1") end
   if type(s)=="table" and s.phase=="started" and s.armedAt>=0 and not s.dispatched and
      app.bookReaderLaunchRequests==s.armedAt+1 then
    s.dispatched=true
    local ok=pcall(function()
     if stateCrcMode then s.input:push("header:"..s.header..":"..s.stateHex)
     elseif headerMode then s.input:push("header:"..s.header)
     else s.input:push("book-reader:1") end
    end)
    if not ok then s.phase="send-uncertain" end
   end
   model.notice="BOOK READER: NATIVE LAUNCH NOT AVAILABLE"
  elseif action=="select" then app.detail=nil end
  return
 end
 if action=="left" then Model.step(model,-1)
 elseif action=="right" then Model.step(model,1)
 elseif action=="back" then Model.back(model);model.notice=nil
 elseif action=="select" then
  local result=Model.select(model)
  if result=="preview-detail" then
   app.detail=app.catalog and app.catalog[model.selected+1] or nil
   if not app.detail then model.notice="NO VERIFIED PACKAGES" end
   return
  end
  if result=="install-unavailable" or result=="launch-unavailable" then
   model.notice="NATIVE ACTION NOT AVAILABLE"
  elseif result=="empty-picker" then
   model.notice="NO VERIFIED PACKAGES"
  else model.notice=nil end
 end
end
local function attach()
 local ok,c=pcall(require,"bl.console")
 if not ok or type(c)~="table" or type(c.draw)~="function" then return false end
 if app.drawHook and c.draw~=app.drawHook then
  -- Do not overwrite an unknown third-party owner; leave a visible signal.
  app.conflict=true
  return false
 end
 if not app.drawHook then
  local old=c.draw
  local function wrapper(...)
   local worked,result=pcall(old,...)
   if not worked then
    app.consoleFailures=math.min(999999999,(app.consoleFailures or 0)+1)
    app.consoleLastError=tostring(result):sub(1,180)
   end
   if rawget(_G,KEY)==app then
    app.consoleCalls=math.min(999999999,(app.consoleCalls or 0)+1)
    local painted=pcall(draw)
    if not painted then countEvents("errors") end
   end
   if worked then return result end
  end
  app.previousDraw=old;app.drawHook=wrapper;c.draw=wrapper
 end
 local h=love and love.handlers
 if type(h)=="table" then
  app.hooks=app.hooks or {}
  local function add(name,map)
   if type(h[name])~="function" then return end
   local original=h[name]
   local function wrapper(a,b,...)
    local key=name=="gamepadpressed" and b or a
    local action=map[key]
    if action and rawget(_G,KEY)==app then
     countEvents("inputs")
     pcall(navigate,action)
     return
    end
    return original(a,b,...)
   end
   app.hooks[name]={original=original,wrapper=wrapper};h[name]=wrapper
  end
  if not app.hooks.gamepadpressed then
   add("gamepadpressed",{dpleft="left",dpright="right",a="select",b="back"})
   add("keypressed",{left="left",right="right",["return"]="select",escape="back"})
  end
 end
 return true
end
local function stop()
 if not app then return end
 local ok,c=pcall(require,"bl.console")
 if ok and type(c)=="table" and c.draw==app.drawHook then c.draw=app.previousDraw end
 local h=love and love.handlers
 if type(h)=="table" then
  for name,hook in pairs(app.hooks or {}) do
   if h[name]==hook.wrapper then h[name]=hook.original end
  end
 end
 rawset(_G,KEY,nil);app=nil
end
if OP=="start" then
 if not Model then error("Canonical IZ2S focus model unavailable") end
 if not app and (type(rawget(_G,"__IZ2S_BALATRO_APP_V1"))=="table" or
                 type(rawget(_G,"__IZ2S_BALATRO_LAUNCHER_V1"))=="table") then
  return "IZ2S_FOCUS_V1;phase=blocked;view=conflict;selected=0;installed=0;frames=0;inputs=0;errors=0;drawhook=0;inputhook=0;callbacks=0;consolecalls=0;consolefailures=0;packages=0;source=0"
 end
 if not app then
  app={model=Model.new(0,0),frames=0,inputs=0,errors=0,callbacks=0,consoleCalls=0,consoleFailures=0}
  rawset(_G,KEY,app)
 end
 app.attached=attach()
elseif OP=="repair" then
 app.attached=attach()
elseif OP=="stop" then stop()
elseif OP=="left" or OP=="right" or OP=="select" or OP=="back" then
 navigate(OP)
end
if not app then
 return "IZ2S_FOCUS_V1;phase=idle;view=none;selected=0;installed=0;frames=0;inputs=0;errors=0;drawhook=0;inputhook=0;callbacks=0;consolecalls=0;consolefailures=0;packages=0;source=0"
end
local hookOk=false
local good,console=pcall(require,"bl.console")
if good and type(console)=="table" and app.drawHook and console.draw==app.drawHook then hookOk=true end
local inputOk=false
local handlers=love and love.handlers
if type(handlers)=="table" and type(app.hooks)=="table" then
 for name,hook in pairs(app.hooks) do
  if handlers[name]==hook.wrapper then inputOk=true end
 end
end
return "IZ2S_FOCUS_V1;phase=running;view="..(app.detail and "detail" or (app.model.picking and "picker" or "home"))..
 ";selected="..tostring(app.model.selected)..";installed="..tostring(app.model.installed)..
 ";frames="..tostring(app.frames)..";inputs="..tostring(app.inputs)..
 ";errors="..tostring(app.errors)..";drawhook="..(hookOk and "1" or "0")..
 ";inputhook="..(inputOk and "1" or "0")..";callbacks="..tostring(app.callbacks)..
 ";consolecalls="..tostring(app.consoleCalls)..";consolefailures="..tostring(app.consoleFailures)..
 ";packages="..tostring(app.catalogKind=="pc" and app.catalog and #app.catalog or 0)..
 ";source="..tostring(app.catalogKind=="source" and app.catalog and #app.catalog or 0)
