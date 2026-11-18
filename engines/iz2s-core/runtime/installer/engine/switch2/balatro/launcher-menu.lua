-- IZ2S Platform Balatro: title-local launcher frontend.
-- Does not execute NROs or assert unavailable native services.
local OP="status"
local KEY="__IZ2S_BALATRO_LAUNCHER_V1"
local labels={"DASHBOARD","BALATRO RPC","MEMORY STATUS","NATIVE STATUS","ABOUT","EXIT"}
local app=rawget(_G,KEY)
local function draw()
 if rawget(_G,KEY)~=app or app.drawFault then return end
 local g=love and love.graphics
 if type(g)~="table" or type(g.push)~="function" then return end
 if not pcall(g.push,"all") then return end
 local ok=pcall(function()
  local sw,sh=g.getDimensions()
  local w=math.floor(math.min(690,sw*0.56))
  local h=370
  local x,y=math.floor(sw*0.045),math.floor(sh*0.18)
  g.setColor(0.07,0.10,0.14,0.97);g.rectangle("fill",x,y,w,h,8,8)
  g.setColor(0.45,0.86,0.96,1);g.rectangle("line",x,y,w,h,8,8)
  g.print("IZ2S PLATFORM  |  BALATRO",x+20,y+16)
  g.setColor(0.75,0.80,0.85,1)
  g.print("TITLE-LOCAL FRONTEND  -  NATIVE CORE OFFLINE",x+20,y+45)
  if app.page=="home" then
   for i,label in ipairs(labels) do
    if i==app.menu then g.setColor(0.47,0.92,1,1)
    else g.setColor(0.85,0.89,0.93,1) end
    g.print((i==app.menu and "> " or "  ")..label,x+20,y+63+i*35)
   end
  else
   g.setColor(1,1,1,1)
   g.print(app.page:upper(),x+20,y+102)
   local messages={
    dashboard={"BALATRO USERLAND READY","MENU / CONTROLLER / LUA RPC"},
    rpc={"TCP RPC :9026","LOCAL LUA COMMANDS VERIFIED"},
    memory={"OWNED BUFFERS VERIFIED","PERSISTENT HANDLES VERIFIED","ARBITRARY MEMORY: UNAVAILABLE"},
    native={"SDK GETTER + MEMCPY VERIFIED","PROCESS MEMORY / IPC: UNAVAILABLE","NRO / CORE: NOT READY"},
    about={"IZ2S PLATFORM BALATRO FRONTEND","NO PRIVILEGED LAUNCH IS ATTEMPTED"},
   }
   for i,line in ipairs(messages[app.page] or {}) do
    g.print(line,x+20,y+108+i*36)
   end
  end
  g.setColor(0.65,0.78,0.84,1)
  g.print("DPAD UP/DOWN    A SELECT    B BACK",x+20,y+315)
  g.print("BALATRO / LUA ONLY  -  CORE NOT STARTED",x+20,y+337)
 end)
 pcall(g.pop)
 if not ok then app.drawFault=true end
end
local function hookDraw()
 local good,c=pcall(require,"bl.console")
 if not good or type(c)~="table" or type(c.draw)~="function" then return false end
 if app.drawHook and c.draw==app.drawHook then return true end
 if app.drawHook then return false end
 local previous=c.draw
 local function wrapper(...)
  previous(...)
  if rawget(_G,KEY)==app then pcall(draw) end
 end
 app.previousDraw,app.drawHook=previous,wrapper;c.draw=wrapper;return true
end
local function stop()
 if not app then return end
 local ok,c=pcall(require,"bl.console")
 if ok and c and c.draw==app.drawHook then c.draw=app.previousDraw end
 local h=love and love.handlers
 if type(h)=="table" and app.hooks then
  for name,v in pairs(app.hooks) do
   if h[name]==v.wrapper then h[name]=v.original end
  end
 end
 rawset(_G,KEY,nil)
 app=nil
end
local function navigate(action)
 if not app then return end
 if action=="up" then
  if app.page=="home" then app.menu=((app.menu+4)%6)+1 else app.page="home" end
 elseif action=="down" then
  if app.page=="home" then app.menu=(app.menu%6)+1 else app.page="home" end
 elseif action=="back" then
  if app.page=="home" then stop() else app.page="home" end
 elseif action=="select" then
  if app.page~="home" then app.page="home";return end
  if app.menu==6 then stop()
  else app.page=({"dashboard","rpc","memory","native","about"})[app.menu] end
 end
end
local function hookInput()
 local handlers=love and love.handlers
 if type(handlers)~="table" then return false end
 app.hooks=app.hooks or {}
 local active=false
 local function add(name,map)
  local original=handlers[name]
  if type(original)~="function" then return end
  if app.hooks[name] and handlers[name]==app.hooks[name].wrapper then active=true;return end
  local function wrapper(a,b,...)
   local key=name=="gamepadpressed" and b or a
   local action=map[key]
   if action and rawget(_G,KEY)==app then
    local ok=pcall(navigate,action)
    if ok then return end
   end
   return original(a,b,...)
  end
  app.hooks[name]={original=original,wrapper=wrapper}
  handlers[name]=wrapper;active=true
 end
 add("gamepadpressed",{dpup="up",dpdown="down",a="select",b="back"})
 add("keypressed",{up="up",down="down",["return"]="select",escape="back"})
 return active
end
if OP=="start" then
 if not app then
  app={version=1,menu=1,page="home",drawFault=false}
  rawset(_G,KEY,app)
 end
 app.overlay=hookDraw()
 app.controls=hookInput()
elseif OP=="stop" then stop()
elseif OP=="up" or OP=="down" or OP=="select" or OP=="back" then
 navigate(OP)
end
if not app then return "IZ2S_LAUNCHER_V1;phase=idle;menu=0;page=none;overlay=false;controls=false" end
return "IZ2S_LAUNCHER_V1;phase=running;menu="..tostring(app.menu)..
 ";page="..tostring(app.page)..";overlay="..tostring(app.overlay==true)..
 ";controls="..tostring(app.controls==true)
