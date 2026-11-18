-- IZ2S ORBIT FOCUS: partial Lua/LÖVE port of the upstream canonical menu.
-- Uses shared geometry/navigation from canonical-focus-model.lua injected by PC.
-- Read-only presentation: no fabricated catalog, install or native launch.
local OP="status"
local Model=(function()
-- __MODEL_SOURCE__
end)()
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
  local ox=(w-Model.width*scale)/2
  local oy=(h-Model.height*scale)/2
  g.translate(ox,oy);g.scale(scale)
  local C=Model.colors
  g.setColor(C.background);g.rectangle("fill",0,0,1920,1080)
  -- Orbit positioning and curved rail derive from original focus-layout.glsl.
  g.setColor(0.14,0.19,0.16,0.6)
  for i=0,28 do
   local x=140+i*59
   local y=Model.railY(x)
   g.circle("fill",x,y,3)
  end
  g.setColor(C.ink);g.print("IZ2S",96,68,0,3.2,3.2)
  g.setColor(C.muted);g.print("ORBIT FOCUS",100,178,0,1.3,1.3)
  local hasApps=app.model.installed>0
  if app.model.picking then
   g.setColor(C.ink);g.print("BROWSE PACKAGES",115,286,0,2.0,2.0)
   g.setColor(C.muted);g.print("NO VERIFIED PACKAGE SOURCE",115,354,0,1.25,1.25)
   g.print("B  BACK",110,977,0,1.35,1.35)
  else
   local hx,hy=535,400
   g.setColor(C.panel);g.rectangle("fill",hx-180,hy-184,360,368,29,29)
   g.setColor(C.accent);g.rectangle("line",hx-180,hy-184,360,368,29,29)
   g.print(" + ",hx-78,hy-110,0,5.0,5.0)
   g.setColor(C.ink);g.print("ADD",hx-60,hy+70,0,2.2,2.2)
   if hasApps then
    for i=1,app.model.installed do
     local x,y=Model.cardCenter(i-1,app.model.flow)
     if x>280 and x<1870 then
      g.setColor(C.panel);g.rectangle("fill",x-105,y-109,210,218,14,14)
      g.setColor(i==app.model.selected and C.accent or C.muted)
      g.rectangle("line",x-105,y-109,210,218,14,14)
      g.print("APP "..tostring(i),x-73,y+54,0,1.5,1.5)
     end
    end
   end
   g.setColor(C.muted)
   if not hasApps then
    g.print("NO VERIFIED APPLICATIONS",784,425,0,1.4,1.4)
   end
   g.setColor(C.accent);g.rectangle("line",780,475,245,78,38,38)
   g.print("A  BROWSE",803,495,0,1.4,1.4)
   g.setColor(C.ink);g.print("1 / "..tostring(app.model.installed+1),115,950,0,1.3,1.3)
   g.setColor(C.muted);g.print("LEFT / RIGHT  SELECT     A  OPEN",110,1008,0,1.25,1.25)
  end
  g.setColor(C.muted)
  g.print("IZ2S LUA PORT - NATIVE OFFLINE",955,1015,0,1.0,1.0)
  if app.model.notice then g.setColor(C.accent);g.print(app.model.notice,115,895,0,1.2,1.2) end
 end)
 pcall(g.pop)
 if ok then countEvents("frames") else countEvents("errors") end
end
local function navigate(action)
 if not app then return end
 local model=app.model
 if action=="left" then Model.step(model,-1)
 elseif action=="right" then Model.step(model,1)
 elseif action=="back" then Model.back(model);model.notice=nil
 elseif action=="select" then
  local result=Model.select(model)
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
   local result=old(...)
   if rawget(_G,KEY)==app then
    local worked=pcall(draw)
    if not worked then countEvents("errors") end
   end
   return result
  end
  app.previousDraw=old;app.drawHook=wrapper;c.draw=wrapper
 end
 if type(love)=="table" and not app.loveDrawHook then
  local prev=love.draw
  app.previousLoveDraw=prev
  app.loveDrawHook=function(...)
   if type(prev)=="function" then prev(...) end
   if rawget(_G,KEY)==app then pcall(draw) end
  end
  love.draw=app.loveDrawHook
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
 if type(love)=="table" and love.draw==app.loveDrawHook then love.draw=app.previousLoveDraw end
 local h=love and love.handlers
 if type(h)=="table" then
  for name,hook in pairs(app.hooks or {}) do
   if h[name]==hook.wrapper then h[name]=hook.original end
  end
 end
 rawset(_G,KEY,nil);app=nil
end
if OP=="start" then
 if not app and (type(rawget(_G,"__IZ2S_BALATRO_APP_V1"))=="table" or
                 type(rawget(_G,"__IZ2S_BALATRO_LAUNCHER_V1"))=="table") then
  return "IZ2S_FOCUS_V1;phase=blocked;view=conflict;selected=0;installed=0;frames=0;inputs=0;errors=0;drawhook=0;inputhook=0;callbacks=0"
 end
 if not app then
  app={model=Model.new(0,0),frames=0,inputs=0,errors=0,callbacks=0}
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
 return "IZ2S_FOCUS_V1;phase=idle;view=none;selected=0;installed=0;frames=0;inputs=0;errors=0;drawhook=0;inputhook=0;callbacks=0"
end
local hookOk=false
local good,console=pcall(require,"bl.console")
if good and type(console)=="table" and app.drawHook and console.draw==app.drawHook then hookOk=true end
if type(love)=="table" and app.loveDrawHook and love.draw==app.loveDrawHook then hookOk=true end
local inputOk=false
local handlers=love and love.handlers
if type(handlers)=="table" and type(app.hooks)=="table" then
 for name,hook in pairs(app.hooks) do
  if handlers[name]==hook.wrapper then inputOk=true end
 end
end
return "IZ2S_FOCUS_V1;phase=running;view="..(app.model.picking and "picker" or "home")..
 ";selected="..tostring(app.model.selected)..";installed="..tostring(app.model.installed)..
 ";frames="..tostring(app.frames)..";inputs="..tostring(app.inputs)..
 ";errors="..tostring(app.errors)..";drawhook="..(hookOk and "1" or "0")..
 ";inputhook="..(inputOk and "1" or "0")..";callbacks="..tostring(app.callbacks)
