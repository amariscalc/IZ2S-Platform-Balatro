-- Reusable ORBIT FOCUS drawing primitives. CivSwitch shader geometry is the source.
local Model=rawget(_G,"__IZ2S_CANONICAL_FOCUS_MODEL_V1")
if type(Model)~="table" then return "IZ2S_VISUAL_V1;stage=base;ok=0" end
local V={model=Model,ink=Model.colors.ink,lime=Model.colors.accent,
 muted=Model.colors.muted,back=Model.colors.background,panel=Model.colors.panel}
V.atlas={
 title={2,2,458,59},add={2,162,402,60},browse={2,227,314,22},
 packages={2,349,154,12},empty={2,437,240,22},
 ready={2,86,290,33},library={2,332,123,12},
 select={2,847,74,14},back={2,866,62,14},
}
function V.color(g,t,a)
 g.setColor(t[1],t[2],t[3],a or 1)
end
function V.box(g,x,y,w,h,r,outline)
 g.rectangle(outline and "line" or "fill",x,y,w,h,r or 0,r or 0)
end
function V.text(g,a,key,x,y,fallback,size,scale)
 local atlas=a.images and a.images.type
 local r=V.atlas[key]
 if atlas and r and g.newQuad then
  local q=V.quads and V.quads[key]
  if not q then
   V.quads=V.quads or {}
   local ok,result=pcall(g.newQuad,r[1],r[2],r[3],r[4],768,1216)
   if ok then q=result;V.quads[key]=q end
  end
  if q then
   local ok=pcall(g.draw,atlas,q,x,y,0,scale or 1,scale or 1)
   if ok then return end
  end
 end
 g.print(fallback,x,y,0,size or 1,size or 1)
end
function V.icon(g,a,id,x,y,size)
 local image=a.images and a.images[id]
 if not image then return false end
 local ok,w,h=pcall(function() return image:getDimensions() end)
 if not ok or not w or w<=0 or not h or h<=0 then return false end
 local scale=math.min(size/w,size/h)
 local painted=pcall(g.draw,image,x,y,0,scale,scale,w/2,h/2)
 return painted
end
function V.motion(a)
 a.motion=a.motion or {flow=0,tick=0,page=0}
 local m=a.motion
 m.flow=m.flow+(a.model.flow-m.flow)*0.18
 if math.abs(m.flow-a.model.flow)<0.002 then m.flow=a.model.flow end
 m.tick=m.tick+1
 return m
end
rawset(_G,"__IZ2S_FOCUS_VISUAL_V1",V)
return "IZ2S_VISUAL_V1;stage=base;ok=1"
