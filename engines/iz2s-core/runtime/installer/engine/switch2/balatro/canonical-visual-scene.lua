-- Faithful geometric composition derived from CivSwitch ORBIT FOCUS shaders.
local V=rawget(_G,"__IZ2S_FOCUS_VISUAL_V1")
if type(V)~="table" then return "IZ2S_VISUAL_V1;stage=scene;ok=0" end
local M=V.model
local pi=math.pi
local function circle(g,x,y,r,mode) g.circle(mode or "fill",x,y,r) end
local function glow(g,x,y,r,c,alpha)
 for i=5,1,-1 do V.color(g,c,alpha*(6-i)/5);circle(g,x,y,r*(i/2.6)) end
end
local function orbit(g,t)
 V.color(g,V.ink,.055)
 for i=0,112 do
  local a=i*2*pi/112+.045
  local x=640+1170*math.cos(a)
  local y=400+210*math.sin(a)+.045*(x-640)
  if x>0 and x<1920 and y>0 and y<1080 then
   circle(g,x,y,1.7)
  end
 end
 V.color(g,V.ink,.25)
 for i=0,80 do
  local x=120+i*20
  local y=M.railY(x)
  if y<1070 then circle(g,x,y,1.4) end
 end
 glow(g,1854,413,19,V.ink,.025)
 V.color(g,V.ink,.22);circle(g,1854,413,41,"line")
 V.color(g,V.ink,.14);circle(g,1840,404,8)
end
local function frame(g,x,y,w,h,selected)
 V.color(g,V.panel,.90);V.box(g,x,y,w,h,16,false)
 V.color(g,selected and V.lime or V.muted,selected and .9 or .55)
 g.setLineWidth(selected and 2.7 or 1.4)
 V.box(g,x,y,w,h,16,true)
end
local function station(g,x,y,selected)
 local c=selected and V.lime or V.ink
 V.color(g,c,selected and .30 or .12)
 circle(g,x,y,12)
 V.color(g,c,selected and .80 or .32)
 circle(g,x,y,4,"line")
end
local function card(g,a,p,i,flow,t)
 local cx,cy=M.cardCenter(i-1,flow)
 if cx<240 or cx>1930 then return end
 local selected=a.model.selected==i-1
 local zoom=selected and 1.06 or 1
 local w,h=198*zoom,230*zoom
 local x,y=cx-w/2,cy-h/2
 if selected then glow(g,cx,cy,22,V.lime,.009) end
 frame(g,x,y,w,h,selected)
 V.color(g,V.ink,.13)
 g.rectangle("fill",x+14,y+13,w-28,126,10,10)
 local success=V.icon(g,a,p.id,cx,cy-35,108)
 if not success then
  V.color(g,V.lime,selected and .6 or .3)
  V.box(g,cx-32,cy-72,64,68,7,true)
  V.color(g,V.ink);g.print(p.id:sub(1,2):upper(),cx-18,cy-53,0,1.6,1.6)
 end
 V.color(g,selected and V.lime or V.ink)
 g.print(p.name:sub(1,23),x+13,y+h-55,0,1,1)
 V.color(g,V.muted);g.print(p.version,x+13,y+h-29)
 local rail=M.railY(cx)
 V.color(g,selected and V.lime or V.ink,.33)
 g.rectangle("fill",cx-1,y+h,2,math.max(0,rail-(y+h)))
 station(g,cx,rail,selected)
end
local function chrome(g,a)
 V.color(g,V.ink)
 V.text(g,a,"title",93,62,"IZ2S",3.0,0.61)
 V.color(g,V.muted)
 g.print("ORBIT FOCUS",100,177,0,1.3,1.3)
 g.print("SOURCE-BASED EXPLORER  /  BALATRO LUA",94,232,0,.9,.9)
 V.color(g,V.muted,.38)
 g.rectangle("fill",92,266,1680,1)
 g.rectangle("fill",92,970,1680,1)
end
local function footer(g,a,label)
 V.color(g,V.lime)
 g.print(label,100,995,0,1.1,1.1)
 V.color(g,V.muted)
 g.print("NATIVE CORE OFFLINE",1460,1001,0,.95,.95)
end
local function detail(g,a,d)
 V.color(g,V.ink);g.print("PACKAGE DETAILS",114,305,0,2,2)
 V.color(g,V.lime,.07);V.box(g,111,385,1425,380,20,false)
 frame(g,112,385,1425,380,true)
 if not V.icon(g,a,d.id,271,540,190) then
  V.color(g,V.lime);circle(g,271,540,64,"line")
 end
 V.color(g,V.ink);g.print(d.name,420,412,0,2,2)
 V.color(g,V.muted);g.print("VERSION   "..d.version,423,493,0,1.2,1.2)
 g.print("ID   "..d.id,423,543,0,1.2,1.2)
 g.print("SOURCE DESCRIPTOR SHA256",423,594)
 g.print(d.sha256:sub(1,32),423,628)
 g.print(d.sha256:sub(33),423,653)
 V.color(g,V.lime);g.print(a.catalogKind=="source" and "SOURCE ONLY - NOT INSTALLABLE" or "PC PREVIEW - NOT INSTALLED",115,811,0,1.2,1.2)
 footer(g,a,"B  BACK")
end
local function home(g,a)
 V.color(g,V.ink);g.print("LIBRARY",116,302,0,2,2)
 frame(g,354,320,362,366,true)
 V.color(g,V.lime)
 g.setLineWidth(6)
 g.line(535,426,535,532)
 g.line(482,479,588,479)
 V.color(g,V.ink);V.text(g,a,"add",410,603,"ADD",2.2,.6)
 V.color(g,V.muted)
 g.print("NO VERIFIED APPLICATIONS",817,428,0,1.4,1.4)
 g.print("AVAILABLE IN THE SOURCE INDEX: "..tostring(a.catalog and #a.catalog or 0),819,476,0,.95,.95)
 V.color(g,V.lime);V.box(g,816,523,244,79,39,true)
 V.color(g,V.lime);g.print("A  BROWSE",836,548,0,1.4,1.4)
 footer(g,a,"A  BROWSE     LEFT / RIGHT  NAVIGATE")
end
local function picker(g,a,m)
 local count=a.catalog and #a.catalog or 0
 V.color(g,V.ink);g.print("BROWSE PACKAGES",115,303,0,2,2)
 V.color(g,V.muted)
 g.print(a.catalogKind=="source" and "SOURCE INDEX - NOT INSTALLED" or "PC PREVIEW - NOT INSTALLED",117,364,0,1.2,1.2)
 if count==0 then
  g.print("NO VERIFIED PACKAGE SOURCE",117,515,0,1.5,1.5)
 else
  local active=a.catalog[a.model.selected+1]
  if active then
   frame(g,355,290,360,320,true)
   if not V.icon(g,a,active.id,535,444,210) then
    V.color(g,V.lime);circle(g,535,434,65,"line")
   end
   V.color(g,V.ink);g.print(active.name,782,340,0,1.95,1.95)
   V.color(g,V.muted);g.print("VERSION  "..active.version,787,424,0,1.15,1.15)
   g.print("SOURCE METADATA  /  READ ONLY",787,475,0,1,1)
   V.color(g,V.lime);V.box(g,785,535,254,65,31,true)
   g.print("A  DETAILS",810,558,0,1.1,1.1)
  end
  for i,p in ipairs(a.catalog) do card(g,a,p,i,m.flow,m.tick) end
  local page=math.min(a.model.selected+1,count)
  V.color(g,V.lime);g.print(tostring(page).." / "..tostring(count),114,929,0,1.2,1.2)
  V.color(g,V.muted);g.print("A  DETAILS",305,929,0,1.1,1.1)
 end
 footer(g,a,"LEFT / RIGHT  SELECT     A  DETAILS     B  BACK")
end
function V.draw(a,g)
 local m=V.motion(a)
 local page=a.detail and 2 or (a.model.picking and 1 or 0)
 if m.page~=page then m.page=page;m.fade=0 end
 m.fade=math.min(1,(m.fade or 0)+.12)
 local c=V.back
 V.color(g,c);g.rectangle("fill",0,0,1920,1080)
 local tick=m.tick
 for i=0,6 do
  local x=250+i*290+math.sin(tick*.009+i)*25
  glow(g,x,430+math.cos(tick*.006+i)*120,85,V.lime,.002)
 end
 orbit(g,tick)
 chrome(g,a)
 if a.detail then detail(g,a,a.detail)
 elseif a.model.picking then picker(g,a,m)
 else home(g,a) end
 if a.model.notice then V.color(g,V.lime);g.print(a.model.notice,114,880,0,1.15,1.15) end
 if m.fade<1 then V.color(g,V.back,1-m.fade);g.rectangle("fill",0,0,1920,1080) end
end
rawset(_G,"__IZ2S_FOCUS_SCENE_V1",V.draw)
return "IZ2S_VISUAL_V1;stage=scene;ok=1"
