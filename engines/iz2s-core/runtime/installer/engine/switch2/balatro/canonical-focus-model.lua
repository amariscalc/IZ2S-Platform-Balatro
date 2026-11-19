-- Partial faithful Lua port of the canonical IZ2S ORBIT FOCUS menu model.
-- Sources: CivSwitch/launcher/app/shaders/{app.comp,focus-layout,launcher-layout}.glsl.
-- This module contains NO synthetic application entries or native launch.
local M={}
M.width=1920
M.height=1080
M.pageSize=5
M.maxInstalled=15
M.maxPicker=16
M.colors={
 ink={242/255,241/255,232/255},
 accent={213/255,1,0},
 muted={167/255,170/255,165/255},
 background={16/255,17/255,18/255},
 panel={25/255,27/255,29/255},
}
function M.railY(x)
 local dx=x-850
 local u=dx/1200
 return 560+300*math.sqrt(math.max(0.02,1-u*u))+0.018*dx
end
function M.cardCenter(index,flow)
 local x=402+(index-flow)*218
 return x,M.railY(x)-116
end
function M.new(installed,picker)
 assert(type(installed)=="number" and installed==math.floor(installed) and
  installed>=0 and installed<=M.maxInstalled,"Invalid installed count")
 assert(type(picker)=="number" and picker==math.floor(picker) and
  picker>=0 and picker<=M.maxPicker,"Invalid picker count")
 return {installed=installed,pickerCount=picker,picking=false,selected=0,
  flow=0,notice=nil}
end
function M.count(state)
 return state.picking and math.max(state.pickerCount,1) or state.installed+1
end
function M.step(state,delta)
 local count=M.count(state)
 assert(delta==1 or delta==-1,"Invalid direction")
 state.selected=(state.selected+delta+count)%count
 if state.picking then
  state.flow=math.max(0,state.selected-1)
 else
  state.flow=math.max(0,state.selected-2)
 end
 return state.selected
end
function M.back(state)
 if state.picking then
  state.picking=false;state.selected=0;state.flow=0
  return "home"
 end
 return "home"
end
function M.select(state)
 if state.picking then
  if state.pickerCount==0 then return "empty-picker" end
  return "preview-detail"
 end
 if state.selected==0 or state.installed==0 then
  state.picking=true;state.selected=0;state.flow=0
  return "picker"
 end
 return "launch-unavailable"
end
return M
