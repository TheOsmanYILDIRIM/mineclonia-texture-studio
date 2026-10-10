// Coordinates transcribed from mineclonia-mirror/mineclonia, main tree b5677549.
// Node geometry only; collision boxes are deliberately excluded.
const post=[-.125,-.5,-.125,.125,.5,.125];
const connections={
 front:[[-.0625,.25,-.5,.0625,.4375,-.125],[-.0625,-.125,-.5,.0625,.0625,-.125]],
 back:[[-.0625,.25,.125,.0625,.4375,.5],[-.0625,-.125,.125,.0625,.0625,.5]],
 left:[[-.5,.25,-.0625,-.125,.4375,.0625],[-.5,-.125,-.0625,-.125,.0625,.0625]],
 right:[[.125,.25,-.0625,.5,.4375,.0625],[.125,-.125,-.0625,.5,.0625,.0625]]
};
const gate=[
 [-.5,-.1875,-.0625,-.375,.5,.0625],[.375,-.1875,-.0625,.5,.5,.0625],
 [-.125,-.125,-.0625,0,.4375,.0625],[0,-.125,-.0625,.125,.4375,.0625],
 [-.5,.25,-.0625,-.125,.4375,.0625],[-.5,-.125,-.0625,-.125,.0625,.0625],
 [.125,.25,-.0625,.5,.4375,.0625],[.125,-.125,-.0625,.5,.0625,.0625]
];
const stair=[[-.5,-.5,-.5,.5,0,.5],[-.5,0,0,.5,.5,.5]];
const slab=[[-.5,-.5,-.5,.5,0,.5]];
const door=[[-.5,-.5,-.5,.5,.5,-.3125]];
export function resolveNodeGeometry(filename,{connectionsTo=['front','back','left','right']}={}){
 const name=String(filename||'').toLowerCase();
 if(/fence_gate|fencegate/.test(name))return {kind:'fence_gate',boxes:gate,paramtype2:'facedir'};
 if(/fence/.test(name))return {kind:'connected',boxes:[post,...connectionsTo.flatMap(side=>connections[side]||[])],connectionSides:connectionsTo};
 if(/door/.test(name)&&!/trapdoor/.test(name))return {kind:'door_half',boxes:door,paramtype2:'facedir'};
 if(/stair/.test(name))return {kind:'stair',boxes:stair,paramtype2:'facedir'};
 if(/slab/.test(name))return {kind:'slab',boxes:slab};
 return null;
}
