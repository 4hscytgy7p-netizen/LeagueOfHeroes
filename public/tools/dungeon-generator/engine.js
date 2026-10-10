/* Dungeon engine. Pure data and no THREE dependencies. Browser JS with TypeScript-compatible JSDoc contracts. */
'use strict';
/** @typedef {{seed:number,roomCount?:number,loopChance?:number,decorDensity?:number,theme?:string}} Params */
/** @typedef {{id:number,cx:number,cy:number,w:number,h:number,shape:string,type:string,depth:number,difficulty:number,degree:number,area:number,tint:number[]}} Room */
/** @typedef {{a:number,b:number,isLoop:boolean,isCritical:boolean,weight:number}} Edge */
/** @typedef {{x:number,y:number}} Cell */
/** @typedef {{kind:string,x:number,y:number,rot:number,scale:number,roomId:number}} Prop */
/** @typedef {{x:number,y:number,tier:string,roomId:number}} Spawn */
/** @typedef {{params:Params,name:string,W:number,H:number,grid:Uint8Array,bfs:Int16Array,rooms:Room[],edges:Edge[],doorways:Cell[],corridorCells:Cell[],props:Prop[],spawns:Spawn[],stats:Object}} Dungeon */
const DungeonEngine = (() => {
 const VOID=0,FLOOR=1,WALL=2;
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 class RNG {
  constructor(seed){this.state=seed>>>0;}
  next(){let t=this.state=(this.state+0x6D2B79F5)>>>0;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;}
  float(a=0,b=1){return a+(b-a)*this.next();}
  int(a,b){return a+Math.floor(this.next()*(b-a+1));}
  pick(a){return a[this.int(0,a.length-1)];}
  chance(p){return this.next()<p;}
  gaussian(mu=0,sigma=1){return mu+sigma*Math.sqrt(-2*Math.log(Math.max(this.next(),1e-12)))*Math.cos(2*Math.PI*this.next());}
 }
 function hash(seed,a=0,b=0){let n=(seed^Math.imul(a+1,0x9e3779b1)^Math.imul(b+1,0x85ebca6b))>>>0;n=Math.imul(n^(n>>>16),0x7feb352d);n=Math.imul(n^(n>>>15),0x846ca68b);return (n^(n>>>16))>>>0;}
 function normalize(p={}){
  if(!Number.isInteger(Number(p.seed??1977)))throw Error('Код генерации должен быть конечным целым числом.');
  for(const key of ['roomCount','loopChance','decorDensity'])if(p[key]!==undefined&&!Number.isFinite(Number(p[key])))throw Error(key+' должен быть конечным числом.');
  return {seed:Number(p.seed??1977)|0,roomCount:clamp(Math.round(p.roomCount??42),12,80),loopChance:clamp(Number(p.loopChance??.15),0,1),decorDensity:clamp(Number(p.decorDensity??.6),0,1),theme:Object.hasOwn(DungeonPresets,p.theme)?p.theme:'crypt',layoutStyle:['mixed','rectangular','rounded'].includes(p.layoutStyle)?p.layoutStyle:'mixed'};
 }
 function scatter(p,rng){
  const count=Math.ceil(p.roomCount*1.4),radius=Math.sqrt(p.roomCount)*7.2,rooms=[];
  for(let i=0;i<count;i++){
   const k=i<2?.99:rng.next(),min=k<.45?5:k<.85?8:13,max=k<.45?7:k<.85?12:18;
   const shapeRoll=rng.next(),angle=rng.float(0,Math.PI*2),rad=Math.sqrt(rng.next());
   rooms.push({id:i,cx:Math.cos(angle)*rad*radius,cy:Math.sin(angle)*rad*radius*.72,w:rng.int(min,max),h:rng.int(min,max),shape:p.layoutStyle==='rectangular'?'rectangle':p.layoutStyle==='rounded'?(shapeRoll<.7?'ellipse':'octagon'):shapeRoll<.6?'rectangle':shapeRoll<.82?'ellipse':'octagon'});
  }
  return rooms;
 }
 function separate(candidates,p,rng){
  const rooms=candidates.map(r=>({...r}));let iterations=0;
  for(;iterations<300;iterations++){
   let overlaps=0;
   for(let i=0;i<rooms.length;i++)for(let j=i+1;j<rooms.length;j++){
    const a=rooms[i],b=rooms[j],dx=b.cx-a.cx,dy=b.cy-a.cy,ox=(a.w+b.w)/2+3-Math.abs(dx),oy=(a.h+b.h)/2+3-Math.abs(dy);
    if(ox>0&&oy>0){overlaps++;if(ox<oy){const v=(dx===0?(i%2?1:-1):Math.sign(dx))*(ox/2+.02);a.cx-=v;b.cx+=v;}else{const v=(dy===0?(j%2?1:-1):Math.sign(dy))*(oy/2+.02);a.cy-=v;b.cy+=v;}}
   }
   if(!overlaps)break;
  }
  rooms.sort((a,b)=>b.w*b.h-a.w*a.h||a.id-b.id);rooms.length=p.roomCount;rooms.sort((a,b)=>a.id-b.id);
  rooms.forEach((r,i)=>{r.sourceId=r.id;r.id=i;r.cx=Math.round(r.cx);r.cy=Math.round(r.cy);r.depth=0;r.difficulty=0;r.type='combat';r.degree=0;});
  // Integer snap can consume one padding cell; original 3-cell margin preserves the required two.
  for(let i=0;i<rooms.length;i++)for(let j=i+1;j<rooms.length;j++){
   const a=rooms[i],b=rooms[j];if(Math.abs(a.cx-b.cx)<(a.w+b.w)/2+2&&Math.abs(a.cy-b.cy)<(a.h+b.h)/2+2)throw Error('Не удалось разделить помещения.');
  }
  return {rooms,iterations};
 }
 function delaunay(rooms){
  const pts=rooms.map(r=>({x:r.cx,y:r.cy}));let m=1;for(const p of pts)m=Math.max(m,Math.abs(p.x),Math.abs(p.y));m*=8;
  const n=pts.length;pts.push({x:-m,y:-m},{x:0,y:m},{x:m,y:-m});
  function triangle(a,b,c){const p=pts[a],q=pts[b],r=pts[c],d=2*(p.x*(q.y-r.y)+q.x*(r.y-p.y)+r.x*(p.y-q.y));if(Math.abs(d)<1e-8)return null;
   const pp=p.x*p.x+p.y*p.y,qq=q.x*q.x+q.y*q.y,rr=r.x*r.x+r.y*r.y,cx=(pp*(q.y-r.y)+qq*(r.y-p.y)+rr*(p.y-q.y))/d,cy=(pp*(r.x-q.x)+qq*(p.x-r.x)+rr*(q.x-p.x))/d;
   return {a,b,c,cx,cy,r2:(p.x-cx)**2+(p.y-cy)**2};}
  let tris=[triangle(n,n+1,n+2)];
  for(let i=0;i<n;i++){
   const p=pts[i],boundary=[];const keep=[];
   for(const t of tris){if((p.x-t.cx)**2+(p.y-t.cy)**2<=t.r2+1e-7){for(const [a0,b0]of[[t.a,t.b],[t.b,t.c],[t.c,t.a]]){const a=Math.min(a0,b0),b=Math.max(a0,b0),j=boundary.findIndex(e=>e.a===a&&e.b===b);if(j>=0)boundary.splice(j,1);else boundary.push({a,b});}}else keep.push(t);}
   boundary.sort((a,b)=>a.a-b.a||a.b-b.b);for(const e of boundary){const t=triangle(e.a,e.b,i);if(t)keep.push(t);}tris=keep;
  }
  const seen=new Uint8Array(n*n),edges=[];
  for(const t of tris){if(t.a>=n||t.b>=n||t.c>=n)continue;for(const [a0,b0]of[[t.a,t.b],[t.b,t.c],[t.c,t.a]]){const a=Math.min(a0,b0),b=Math.max(a0,b0);if(!seen[a*n+b]){seen[a*n+b]=1;edges.push({a,b,weight:Math.hypot(pts[a].x-pts[b].x,pts[a].y-pts[b].y)});}}}
  edges.sort((a,b)=>a.a-b.a||a.b-b.b);return edges;
 }
 function graph(rooms,p,rng){
  const all=delaunay(rooms),n=rooms.length,visited=new Uint8Array(n),mst=[],used=new Uint8Array(n*n);visited[0]=1;
  for(let step=1;step<n;step++){
   let best=null;for(const e of all)if(visited[e.a]!==visited[e.b]&&(!best||e.weight<best.weight-1e-8||(Math.abs(e.weight-best.weight)<1e-8&&(e.a<best.a||(e.a===best.a&&e.b<best.b)))))best=e;
   if(!best)throw Error('Схема связей содержит изолированные помещения.');visited[best.a]=visited[best.b]=1;used[best.a*n+best.b]=1;mst.push({...best,isLoop:false,isCritical:false});rooms[best.a].degree++;rooms[best.b].degree++;
  }
  const mean=mst.reduce((s,e)=>s+e.weight,0)/mst.length,edges=mst.slice();let leaves=rooms.filter(r=>r.degree===1).length;
  const possible=all.filter(e=>!used[e.a*n+e.b]&&e.weight<=2.2*mean);
  const canAdd=e=>leaves-(rooms[e.a].degree===1?1:0)-(rooms[e.b].degree===1?1:0)>=Math.min(3,n-3);
  function add(e){leaves-=(rooms[e.a].degree===1?1:0)+(rooms[e.b].degree===1?1:0);rooms[e.a].degree++;rooms[e.b].degree++;edges.push({...e,isLoop:true,isCritical:false});}
  for(const e of possible)if(rng.chance(p.loopChance)&&canAdd(e))add(e);
  if(!edges.some(e=>e.isLoop)){const e=possible.find(e=>canAdd(e));if(!e)throw Error('Не удалось сохранить обходной маршрут и три ответвления.');add(e);}
  edges.sort((a,b)=>a.a-b.a||a.b-b.b);return {edges,all,mst,mean};
 }
 function graphBFS(n,edges,start){const dist=new Int16Array(n).fill(-1),parent=new Int16Array(n).fill(-1),q=new Int16Array(n);let h=0,t=1;q[0]=start;dist[start]=0;while(h<t){const a=q[h++];for(const e of edges){const b=e.a===a?e.b:e.b===a?e.a:-1;if(b>=0&&dist[b]<0){dist[b]=dist[a]+1;parent[b]=a;q[t++]=b;}}}return {dist,parent};}
 function contains(r,x,y){const dx=x-r.cx,dy=y-r.cy,ax=Math.floor(r.w/2),ay=Math.floor(r.h/2);if(Math.abs(dx)>ax||Math.abs(dy)>ay)return false;if(r.shape==='ellipse')return dx*dx/(ax+.35)**2+dy*dy/(ay+.35)**2<=1;if(r.shape==='octagon'){const cut=Math.max(1,Math.floor(Math.min(ax,ay)*.45));return Math.abs(dx)+Math.abs(dy)<=ax+ay-cut;}return true;}
 function semantics(rooms,edges,rng){
  for(const r of rooms){let a=0;for(let y=r.cy-Math.floor(r.h/2);y<=r.cy+Math.floor(r.h/2);y++)for(let x=r.cx-Math.floor(r.w/2);x<=r.cx+Math.floor(r.w/2);x++)if(contains(r,x,y))a++;r.area=a;}
  const boss=rooms.slice().sort((a,b)=>b.area-a.area||a.id-b.id)[0],fromBoss=graphBFS(rooms.length,edges,boss.id);
  const leaves=rooms.filter(r=>r.degree===1&&r.id!==boss.id).sort((a,b)=>fromBoss.dist[b.id]-fromBoss.dist[a.id]||a.id-b.id),entrance=leaves[0];
  if(!entrance||fromBoss.dist[entrance.id]<3)throw Error('Вход слишком близко к главному противнику.');
  const {dist,parent}=graphBFS(rooms.length,edges,entrance.id),maxDepth=Math.max(...dist);const path=[];for(let a=boss.id;a!==-1;a=parent[a])path.push(a);path.reverse();const onPath=new Uint8Array(rooms.length);path.forEach(id=>onPath[id]=1);
  for(const e of edges){for(let i=1;i<path.length;i++)if((e.a===path[i]&&e.b===path[i-1])||(e.b===path[i]&&e.a===path[i-1]))e.isCritical=true;}
  const palette=[[.43,.39,.50],[.31,.47,.43],[.53,.38,.26],[.32,.40,.54],[.45,.35,.35]];
  for(const r of rooms){r.depth=dist[r.id];r.difficulty=.15+.85*r.depth/maxDepth;r.tint=rng.pick(palette).slice();}
  entrance.type='entrance';boss.type='boss';boss.difficulty=1;
  const reward=rooms.filter(r=>r.degree===1&&!onPath[r.id]).sort((a,b)=>b.depth-a.depth||a.id-b.id);reward.slice(0,4).forEach(r=>r.type='treasure');
  // Optional secrets are explicit off-path leaf chambers, with a hidden threshold marker.
  reward.slice(4,6).forEach(r=>r.type='secret');
  const mid=rooms.filter(r=>!onPath[r.id]&&r.type==='combat'&&r.depth/maxDepth>=.25&&r.depth/maxDepth<=.8);for(let i=0;i<Math.min(mid.length,rng.int(1,2));i++){const j=rng.int(i,mid.length-1);[mid[i],mid[j]]=[mid[j],mid[i]];mid[i].type='shrine';}
  const elite=path.slice(1,-1).map(id=>rooms[id]).filter(r=>r.depth/boss.depth>=.55&&r.depth/boss.depth<=.85);elite.slice(-2).forEach(r=>r.type='elite');
  if(!elite.length&&path.length>=4)rooms[path[Math.max(1,Math.floor((path.length-1)*.7))]].type='elite';
  return {boss:boss.id,entrance:entrance.id,path,maxDepth};
 }
 function carve(rooms,edges,semantic,rng){
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;for(const r of rooms){minX=Math.min(minX,r.cx-Math.floor(r.w/2)-5);minY=Math.min(minY,r.cy-Math.floor(r.h/2)-5);maxX=Math.max(maxX,r.cx+Math.floor(r.w/2)+5);maxY=Math.max(maxY,r.cy+Math.floor(r.h/2)+5);}
  const W=maxX-minX+1,H=maxY-minY+1,grid=new Uint8Array(W*H),owner=new Int16Array(W*H).fill(-1),corridor=new Uint8Array(W*H);
  rooms.forEach(r=>{r.cx-=minX;r.cy-=minY;});
  for(const r of rooms)for(let y=r.cy-Math.floor(r.h/2);y<=r.cy+Math.floor(r.h/2);y++)for(let x=r.cx-Math.floor(r.w/2);x<=r.cx+Math.floor(r.w/2);x++)if(contains(r,x,y)){grid[y*W+x]=FLOOR;owner[y*W+x]=r.id;}
  function stamp(x,y,width){const low=-Math.floor((width-1)/2),high=Math.floor(width/2);for(let dy=low;dy<=high;dy++)for(let dx=low;dx<=high;dx++){const a=x+dx,b=y+dy;if(a>0&&a<W-1&&b>0&&b<H-1){const i=b*W+a;grid[i]=FLOOR;corridor[i]=1;}}}
  const routes=[];
  for(const e of edges){const a=rooms[e.a],b=rooms[e.b],width=e.isCritical?3:(a.type==='treasure'||b.type==='treasure'||a.type==='secret'||b.type==='secret')?1:2;let points;
   const xlo=Math.max(a.cx-Math.floor(a.w/2)+2,b.cx-Math.floor(b.w/2)+2),xhi=Math.min(a.cx+Math.floor(a.w/2)-2,b.cx+Math.floor(b.w/2)-2),ylo=Math.max(a.cy-Math.floor(a.h/2)+2,b.cy-Math.floor(b.h/2)+2),yhi=Math.min(a.cy+Math.floor(a.h/2)-2,b.cy+Math.floor(b.h/2)-2);
   if(xlo<=xhi){const x=clamp(Math.round((a.cx+b.cx)/2),xlo,xhi);points=[[a.cx,a.cy],[x,a.cy],[x,b.cy],[b.cx,b.cy]];}
   else if(ylo<=yhi){const y=clamp(Math.round((a.cy+b.cy)/2),ylo,yhi);points=[[a.cx,a.cy],[a.cx,y],[b.cx,y],[b.cx,b.cy]];}
   else points=rng.chance(.5)?[[a.cx,a.cy],[b.cx,a.cy],[b.cx,b.cy]]:[[a.cx,a.cy],[a.cx,b.cy],[b.cx,b.cy]];
   for(let k=1;k<points.length;k++){let [x,y]=points[k-1];const [tx,ty]=points[k],dx=Math.sign(tx-x),dy=Math.sign(ty-y);stamp(x,y,width);while(x!==tx||y!==ty){x+=dx;y+=dy;stamp(x,y,width);}}
   routes.push({a:e.a,b:e.b,width,points});
  }
  return {W,H,grid,owner,corridor,routes,offset:{x:minX,y:minY}};
 }
 function flood(grid,W,H,start){const bfs=new Int16Array(grid.length).fill(-1),q=new Int32Array(grid.length);let h=0,t=1;bfs[start]=0;q[0]=start;let max=0;
  while(h<t){const i=q[h++],d=bfs[i]+1;for(const j of[i-1,i+1,i-W,i+W]){if(j<0||j>=grid.length||grid[j]!==FLOOR||bfs[j]>=0)continue;if((j===i-1||j===i+1)&&Math.floor(j/W)!==Math.floor(i/W))continue;if(d>32766)throw Error('Превышена допустимая длина маршрута.');bfs[j]=d;max=Math.max(max,d);q[t++]=j;}}
  return {bfs,reached:t,max};
 }
 function rasterize(r,rooms,s){const {W,H,grid,owner,corridor}=r,door=new Uint8Array(grid.length),doorways=[],corridorCells=[];
  for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){const i=y*W+x;if(grid[i]===VOID){let floor=false;for(let dy=-1;dy<=1&&!floor;dy++)for(let dx=-1;dx<=1;dx++)if(grid[i+dy*W+dx]===FLOOR){floor=true;break;}if(floor)grid[i]=WALL;}
   else if(grid[i]===FLOOR&&corridor[i]){if(owner[i]<0)corridorCells.push({x,y});for(const j of[i-1,i+1,i-W,i+W])if(grid[j]===FLOOR&&((owner[i]<0&&owner[j]>=0)||(owner[i]>=0&&owner[j]<0))){door[i]=1;break;}if(door[i])doorways.push({x,y});}}
  const entrance=rooms[s.entrance],f=flood(grid,W,H,entrance.cy*W+entrance.cx);return {...r,...f,door,doorways,corridorCells};
 }
 function decorate(r,rooms,s,p,rng){
  const {grid,W,H,door,owner}=r,props=[],spawns=[],occupied=new Uint8Array(grid.length),torchMask=new Uint8Array(grid.length);
  const valid=(x,y)=>x>0&&x<W-1&&y>0&&y<H-1&&grid[y*W+x]===FLOOR&&!door[y*W+x]&&!occupied[y*W+x];
  const safe=(x,y)=>{for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)if(door[(y+dy)*W+x+dx])return false;return true;};
  function add(kind,x,y,id,scale=1,rot=0,extra={}){if(!valid(x,y))return false;occupied[y*W+x]=1;props.push({kind,x,y,rot,scale,roomId:id,...extra});return true;}
  function central(kind,room,scale=1){for(let radius=0;radius<=5;radius++)for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){const x=room.cx+dx,y=room.cy+dy;if(owner[y*W+x]===room.id&&add(kind,x,y,room.id,scale))return {x,y};}return null;}
  for(const room of rooms){if(room.type==='entrance')central('portal',room,1.25);if(room.type==='treasure'||room.type==='secret')central('chest',room);if(room.type==='shrine')central('crystal',room,1.2);
   if(room.type==='boss'){for(let k=0;k<8;k++){const a=k*Math.PI/4;add('brazier',Math.round(room.cx+Math.cos(a)*room.w*.32),Math.round(room.cy+Math.sin(a)*room.h*.32),room.id,1.1);}central('sigil',room,1.4);}
   if(room.area>=150)for(let y=room.cy-Math.floor(room.h/2)+3;y<=room.cy+Math.floor(room.h/2)-3;y+=4)for(let x=room.cx-Math.floor(room.w/2)+3;x<=room.cx+Math.floor(room.w/2)-3;x+=4){let ok=owner[y*W+x]===room.id&&safe(x,y);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(grid[(y+dy)*W+x+dx]!==FLOOR)ok=false;if(ok&&Math.abs(x-room.cx)+Math.abs(y-room.cy)>2)add('pillar',x,y,room.id,rng.float(.8,1.15));}
  }
  // Torches are anchored to a floor cell; bracket offset places them on its facing wall.
  for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){
   if(!valid(x,y)||!safe(x,y))continue;const i=y*W+x;let wall=-1;for(let k=0;k<4;k++)if(grid[i+[-W,1,W,-1][k]]===WALL){wall=k;break;}if(wall<0)continue;
   let near=false;for(let dy=-3;dy<=3&&!near;dy++)for(let dx=-3;dx<=3;dx++){if(x+dx>=0&&x+dx<W&&y+dy>=0&&y+dy<H&&torchMask[(y+dy)*W+x+dx]){near=true;break;}}if(!near){add('torch',x,y,owner[i],1,wall*Math.PI/2,{wallDir:wall});torchMask[i]=1;}
  }
  for(const room of rooms){
   const available=[];for(let y=room.cy-Math.floor(room.h/2);y<=room.cy+Math.floor(room.h/2);y++)for(let x=room.cx-Math.floor(room.w/2);x<=room.cx+Math.floor(room.w/2);x++)if(owner[y*W+x]===room.id&&valid(x,y)&&safe(x,y))available.push({x,y});
   for(let i=available.length-1;i>0;i--){const j=rng.int(0,i);[available[i],available[j]]=[available[j],available[i]];}
   const spawnCount=room.type==='combat'||room.type==='elite'?Math.round(room.area/18*(.5+room.difficulty)):room.type==='boss'?1:0;
   let cursor=0;for(let i=0;i<spawnCount&&cursor<available.length;i++){const c=available[cursor++];occupied[c.y*W+c.x]=1;spawns.push({...c,tier:room.type==='boss'?'boss':room.type==='elite'&&i===0?'elite':room.difficulty>.7?'veteran':'normal',roomId:room.id});}
   const debris=Math.round(room.area*p.decorDensity*.027*(1.4-room.difficulty));for(let i=0;i<debris&&cursor<available.length;i++){const c=available[cursor++];add('debris',c.x,c.y,room.id,rng.float(.4,1),rng.float(0,Math.PI*2));}
  }
  // At least one secret cache stays off the critical path even when all leaves are treasure.
  if(!rooms.some(room=>room.type==='secret')){const off=rooms.filter(room=>!s.path.includes(room.id)&&room.type==='combat').sort((a,b)=>b.depth-a.depth||a.id-b.id);if(off.length){const c=central('cache',off[0],.7);if(c)props[props.length-1].secret=true;}}
  return {props,spawns,occupied};
 }
 function selectLights(props,rooms,s,budget=12){
  const lights=[],add=(x,y,color,intensity,role)=>{if(lights.length<budget)lights.push({x,y,height:2.2,color,intensity,distance:9,role});};
  const entrance=rooms[s.entrance],boss=rooms[s.boss];add(entrance.cx,entrance.cy,0x58dace,2.2,'entrance');add(boss.cx,boss.cy,0xff602f,2.8,'boss');
  for(const room of rooms)if(room.type==='shrine')add(room.cx,room.cy,0x79aaff,2.2,'shrine');
  const candidates=props.filter(prop=>prop.kind==='torch'||prop.kind==='brazier'),picked=new Uint8Array(candidates.length);
  while(lights.length<budget&&lights.length<4+candidates.length){let bi=-1,bd=-1;for(let i=0;i<candidates.length;i++){if(picked[i])continue;const p=candidates[i];let d=Infinity;for(const l of lights)d=Math.min(d,(p.x-l.x)**2+(p.y-l.y)**2);if(d>bd){bd=d;bi=i;}}if(bi<0)break;const p=candidates[bi];picked[bi]=1;add(p.x,p.y,0xff8c3a,2.7,'torch');}
  return lights;
 }
 function checksum(d){let h=2166136261;for(const a of[d.grid,new Uint8Array(d.bfs.buffer),new Uint8Array(d.roomIds.buffer)])for(let i=0;i<a.length;i++)h=Math.imul(h^a[i],16777619)>>>0;const data=JSON.stringify({params:d.params,name:d.name,rooms:d.rooms,edges:d.edges,props:d.props,spawns:d.spawns,lights:d.lights,doorways:d.doorways,routes:d.routes});for(let i=0;i<data.length;i++)h=Math.imul(h^data.charCodeAt(i),16777619)>>>0;return h.toString(16).padStart(8,'0');}
 function validate(d){
  const entrance=d.rooms[d.entranceId],boss=d.rooms[d.bossId],f=flood(d.grid,d.W,d.H,entrance.cy*d.W+entrance.cx),floor=d.grid.reduce((s,v)=>s+(v===FLOOR),0),max=f.max,bossDistance=f.bfs[boss.cy*d.W+boss.cx];let placement=true;const occupied=new Uint8Array(d.grid.length);
  for(const p of[...d.props,...d.spawns]){const i=p.y*d.W+p.x;if(d.grid[i]!==FLOOR||d.doorMask[i]||occupied[i])placement=false;occupied[i]=1;}
  const loops=d.edges.length-d.rooms.length+1,leaf=d.rooms.filter(r=>r.degree===1).length;
  const checks=[{name:'Связность карты',pass:f.reached===floor,value:`${f.reached} / ${floor} (100%)`},{name:'Удалённость главного противника',pass:bossDistance>=.6*max,value:`${bossDistance} / ${max} клеток (${Math.round(100*bossDistance/max)}%)`},{name:'Отдельный вход',pass:entrance.degree===1&&!d.edges.some(e=>(e.a===d.entranceId&&e.b===d.bossId)||(e.b===d.entranceId&&e.a===d.bossId)),value:`связей: ${entrance.degree}`},{name:'Боковые ответвления',pass:d.rooms.length<40||leaf>=3,value:`${leaf} ответвлений`},{name:'Обходные маршруты',pass:loops>=1&&loops===d.edges.filter(e=>e.isLoop).length&&loops===d.stats.loops,value:`E - V + 1 = ${loops}`},{name:'Размещение декора и противников',pass:placement,value:`${d.props.length+d.spawns.length} объектов`},{name:'Число источников света',pass:d.lights.length<=12,value:`${d.lights.length} / 12`}];
  return checks;
 }
 function generateDungeon(params={}){
  const p=normalize(params),start=performance.now();let lastError='';
  for(let attempt=0;attempt<5;attempt++){
   try{
    const derived=attempt===0?p.seed:hash(p.seed,attempt,0x57),rng=new RNG(derived),candidates=scatter(p,rng),sep=separate(candidates,p,rng),rooms=sep.rooms,g=graph(rooms,p,rng),s=semantics(rooms,g.edges,rng),r=rasterize(carve(rooms,g.edges,s,rng),rooms,s),decor=decorate(r,rooms,s,p,rng);
    const adj=rng.pick(['Ashen','Hollow','Forgotten','Silent','Sundered','Obsidian','Drowned']),noun=rng.pick(['Vaults','Catacombs','Sanctum','Halls','Crypts']),lord=rng.pick(['Vor','Mal','Khar','Vel','Asha'])+"'"+rng.pick(['gul','oth','ra','ven','mor']);
    let floorTiles=0,wallTiles=0;for(const v of r.grid){floorTiles+=v===FLOOR;wallTiles+=v===WALL;}
    const d={params:p,name:`${rng.pick(DungeonPresets[p.theme].names)} ${Math.abs(p.seed % 1000)}`,W:r.W,H:r.H,grid:r.grid,bfs:r.bfs,rooms,edges:g.edges,doorways:r.doorways,corridorCells:r.corridorCells,props:decor.props,spawns:decor.spawns,roomIds:r.owner,corridorMask:r.corridor,doorMask:r.door,lights:selectLights(decor.props,rooms,s).map(light=>({...light,color:light.role==='torch'?DungeonPresets[p.theme].lamp:light.color})),routes:r.routes,delaunay:g.all,entranceId:s.entrance,bossId:s.boss,criticalPath:s.path,maxBfs:r.max,effectiveSeed:derived,attempt:attempt+1,stages:{scatter:candidates.map(a=>({...a,cx:a.cx-r.offset.x,cy:a.cy-r.offset.y})),separated:rooms.map(a=>({...a})),iterations:sep.iterations},stats:{rooms:rooms.length,edges:g.edges.length,loops:g.edges.length-rooms.length+1,criticalLength:s.path.length,floorTiles,wallTiles,props:decor.props.length,genMs:0}};
    const failures=validate(d).filter(c=>!c.pass);if(failures.length)throw Error(failures.map(c=>c.name+': '+c.value).join('; '));
    d.stats.genMs=performance.now()-start;return d;
   }catch(error){lastError=error.message;}
  }
  throw Error(`Не удалось создать корректную карту за 5 попыток. ${lastError}`);
 }
 function runAcceptance(d,log=true){
  const checks=validate(d),a=generateDungeon(d.params),b=generateDungeon(d.params),fingerprints=[checksum(d),checksum(a),checksum(b)];checks.push({name:'Повторяемость данных × 3',pass:fingerprints.every(s=>s===fingerprints[0]),value:fingerprints.join(' / ')});
  // Measured on this device after a warm-up; elapsed time is telemetry, never a seed input.
  generateDungeon({...d.params,roomCount:60});const times=[];for(let i=0;i<5;i++)times.push(generateDungeon({...d.params,roomCount:60}).stats.genMs);times.sort((a,b)=>a-b);checks.push({name:'Создание 60 помещений',pass:times[4]<50,value:`${times[2].toFixed(2)} мс медиана; максимум ${times[4].toFixed(2)} мс`});
  if(log){console.group(`Проверка карты · код ${d.params.seed}`);console.table(checks);console.groupEnd();}return checks;
 }
 return {VOID,FLOOR,WALL,RNG,hash,normalize,scatter,separate,delaunay,graph,semantics,carve,rasterize,decorate,flood,selectLights,generateDungeon,validate,checksum,runAcceptance};
})();
if(typeof globalThis!=='undefined'){globalThis.DungeonEngine=DungeonEngine;globalThis.generateDungeon=DungeonEngine.generateDungeon;}
