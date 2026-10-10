/* Presentation only: owns THREE objects; deterministic geometry variations are indexed hashes. */
'use strict';
function buildDungeonScene(dungeon){
 const T=THREE,E=DungeonEngine,d=dungeon,preset=DungeonPresets[d.params.theme],technical=preset.family!=='fantasy',scifi=preset.family==='scifi',root=new T.Group();root.name='Dungeon';
 const meshes={},records={},resources=[],color=new T.Color(),matrix=new T.Matrix4(),position=new T.Vector3(),scale=new T.Vector3(),quat=new T.Quaternion(),axis=new T.Vector3(0,1,0);
 const h=(a,b=0)=>E.hash(d.effectiveSeed,a,b)/4294967296;
 const lit=new T.MeshLambertMaterial({color:0xffffff,flatShading:true}),unlit=new T.MeshBasicMaterial({color:0xffffff}),flameMat=new T.MeshBasicMaterial({color:0xffffff});resources.push(lit,unlit,flameMat);
 function merge(parts){const positions=[],normals=[];for(const [g,m]of parts){const a=g.index?g.toNonIndexed():g.clone();if(m)a.applyMatrix4(m);positions.push(...a.attributes.position.array);normals.push(...a.attributes.normal.array);a.dispose();g.dispose();}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));return g;}
 const translation=(x,y,z)=>new T.Matrix4().makeTranslation(x,y,z);
 const floorGeo=new T.BoxGeometry(.985,.22,.985),wallGeo=new T.BoxGeometry(.985,1,.985),pillarGeo=technical?merge([[new T.BoxGeometry(.68,1.9,.68),translation(0,.95,0)],[new T.BoxGeometry(.9,.14,.9),translation(0,1.95,0)]]):merge([[new T.CylinderGeometry(.35,.43,1.9,6),translation(0,.95,0)],[new T.BoxGeometry(.82,.2,.82),translation(0,.10,0)],[new T.BoxGeometry(.7,.18,.7),translation(0,1.95,0)]]),torchGeo=technical?merge([[new T.BoxGeometry(.22,.9,.22),translation(0,.65,0)],[new T.BoxGeometry(.48,.2,.3),translation(0,1.16,0)]]):merge([[new T.CylinderGeometry(.07,.09,.9,6),translation(0,.65,0)],[new T.CylinderGeometry(.23,.12,.18,7),translation(0,1.16,0)],[new T.BoxGeometry(.30,.1,.30),translation(0,.16,0)]]),flameGeo=technical?new T.BoxGeometry(.22,.14,.22):new T.OctahedronGeometry(.23,0),debrisGeo=new T.DodecahedronGeometry(.26,0),chestGeo=technical?merge([[new T.BoxGeometry(.8,.55,.6),translation(0,.28,0)],[new T.BoxGeometry(.1,.14,.03),translation(0,.38,.32)]]):merge([[new T.BoxGeometry(.7,.36,.47),translation(0,.18,0)],[new T.CylinderGeometry(.235,.235,.7,6,1,false,0,Math.PI),new T.Matrix4().makeRotationZ(Math.PI/2).setPosition(0,.36,0)],[new T.BoxGeometry(.08,.12,.025),translation(0,.32,.245)]]),markerGeo=new T.RingGeometry(.20,.27,8),crystalGeo=technical?new T.BoxGeometry(.65,1,.4):new T.OctahedronGeometry(.5,0);markerGeo.rotateX(-Math.PI/2);
 const defs={floor:[floorGeo,lit],wall:[wallGeo,lit],pillar:[pillarGeo,lit],torch:[torchGeo,lit],flame:[flameGeo,flameMat],debris:[debrisGeo,lit],chest:[chestGeo,lit],marker:[markerGeo,unlit],crystal:[crystalGeo,unlit]};for(const k of Object.keys(defs)){records[k]=[];resources.push(defs[k][0]);}
 const rgb=(r,g,b)=>[r,g,b],theme=d.params.theme,base=preset.base;
 function record(kind,x,y,z,sx,sy,sz,rot,c,extra={}){records[kind].push({x,y,z,sx,sy,sz,rot,c,...extra});}
 const offsets=[-d.W/2,-d.H/2];
 for(let y=1;y<d.H-1;y++)for(let x=1;x<d.W-1;x++){const i=y*d.W+x,v=d.grid[i];if(v===E.VOID)continue;const wx=x+offsets[0],wz=y+offsets[1];
  if(v===E.FLOOR){let walls=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)walls+=d.grid[i+dy*d.W+dx]===E.WALL;const value=(1-.09*Math.min(walls,4))*(.95+.1*h(i,9)),room=d.roomIds[i]>=0?d.rooms[d.roomIds[i]]:null,c=base.map((v,k)=>((room?v*.82+room.tint[k]*.18:v*.72)*value));record('floor',wx,-.11,wz,1,1,1,0,c,{cell:i,depth:d.bfs[i],roomId:room?.id??-1});}
  else {const height=technical?1.8:1.75+.5*h(i,18),v=.8+.25*h(i,11);record('wall',wx,height/2,wz,1,height,1,0,base.map(c=>c*v*1.09));}
 }
 records.floor.sort((a,b)=>a.depth-b.depth||a.cell-b.cell);
 for(let n=0;n<d.props.length;n++){const p=d.props[n],x=p.x+offsets[0],z=p.y+offsets[1],s=p.scale;
  if(p.kind==='pillar')record('pillar',x,0,z,s,s,s,p.rot,rgb(.38,.39,.37));
  if(p.kind==='debris')record('debris',x,.13*s,z,s,s*.6,s,p.rot,rgb(.26,.28,.26));
  if(p.kind==='chest'||p.kind==='cache')record('chest',x,.02,z,s,s,s,p.rot,p.secret?rgb(.42,.34,.56):rgb(.70,.45,.16));
  if(p.kind==='torch'||p.kind==='brazier'){let tx=x,tz=z;if(p.kind==='torch'){const dx=[0,1,0,-1][p.wallDir],dz=[-1,0,1,0][p.wallDir];tx+=dx*.36;tz+=dz*.36;}record('torch',tx,.02,tz,s,s,s,p.rot,rgb(.24,.20,.16));record('flame',tx,1.40*s,tz,s*.75,s*(technical?.4:1.6),s*.75,0,technical?new T.Color(preset.lamp).toArray():rgb(1,.37+.22*h(n,5),.055),{phase:h(n,2)*Math.PI*2});}
  if(p.kind==='crystal')record('crystal',x,technical?.55:.9,z,s*(technical?1:.5),s*(technical?1:1.6),s*.5,technical?0:Math.PI/4,rgb(.31,.64,.86));
  if(technical&&(p.kind==='portal'||p.kind==='sigil')){record('chest',x,.02,z,s*1.3,s*.5,s*1.3,0,scifi?rgb(.18,.65,.7):rgb(.42,.5,.44));record('crystal',x,.65,z,s*.7,s*.2,s*.5,0,scifi?rgb(.25,.9,.95):rgb(.7,.85,.7));}
  else if(p.kind==='portal'||p.kind==='sigil'){const c=p.kind==='portal'?rgb(.22,.85,.73):rgb(.95,.27,.15);for(let k=0;k<14;k++){const a=k*Math.PI*2/14;record('crystal',x+Math.cos(a)*s,.09,z+Math.sin(a)*s,.12,.13,.12,a,c);}if(p.kind==='portal')record('crystal',x,.45,z,.25,.75,.25,0,rgb(.35,.90,.77));}
 }
 for(const spawn of d.spawns){const c=spawn.tier==='boss'?rgb(1,.15,.10):spawn.tier==='elite'?rgb(.96,.52,.18):rgb(.64,.32,.29);record('marker',spawn.x+offsets[0],.035,spawn.y+offsets[1],1,1,1,0,c);}
 function write(mesh,index,r,syMultiplier=1){position.set(r.x,r.y,r.z);scale.set(r.sx,r.sy*syMultiplier,r.sz);quat.setFromAxisAngle(axis,r.rot);matrix.compose(position,quat,scale);mesh.setMatrixAt(index,matrix);}
 for(const k of Object.keys(defs)){const list=records[k];if(!list.length)continue;const mesh=new T.InstancedMesh(defs[k][0],defs[k][1],list.length);mesh.name=k;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);list.forEach((r,i)=>{write(mesh,i,r);color.setRGB(...r.c);mesh.setColorAt(i,color);});mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;mesh.userData.records=list;meshes[k]=mesh;root.add(mesh);}
 if(meshes.marker)meshes.marker.visible=false;
 const hemi=new T.HemisphereLight(technical?0xa6d8ff:0x768da9,0x252522,1.15),sun=new T.DirectionalLight(technical?0xe2f3ff:0xffd9b4,.65);sun.position.set(-30,50,20);root.add(hemi,sun);resources.push(hemi,sun);
 const lights=[];for(const l of d.lights){const light=new T.PointLight(l.color,l.intensity,l.distance,2);light.position.set(l.x+offsets[0],l.height,l.y+offsets[1]);light.castShadow=false;light.userData.baseIntensity=l.intensity;light.userData.phase=h(l.x,l.y)*6.28;root.add(light);lights.push(light);resources.push(light);}
 const overlayRoot=new T.Group();overlayRoot.name='Graph overlays';root.add(overlayRoot);const overlays={};
 function lines(key,edges,c,opacity,height=2.5){const positions=[];for(const e of edges){const a=d.rooms[e.a],b=d.rooms[e.b];positions.push(a.cx+offsets[0],height,a.cy+offsets[1],b.cx+offsets[0],height,b.cy+offsets[1]);}const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));const material=new T.LineBasicMaterial({color:c,transparent:true,opacity,depthTest:false});const object=new T.LineSegments(geometry,material);object.visible=false;object.renderOrder=20;overlayRoot.add(object);overlays[key]=object;resources.push(geometry,material);}
 lines('delaunay',d.delaunay,0x839b9c,.18);lines('mst',d.edges.filter(e=>!e.isLoop),0xe4ece5,.65);lines('loops',d.edges.filter(e=>e.isLoop),0x52dfd0,.9);lines('critical',d.edges.filter(e=>e.isCritical),0xff6b56,1,2.7);
 const ghostGeo=new T.BoxGeometry(1,.08,1),ghostMat=new T.MeshBasicMaterial({color:0x77938c,transparent:true,opacity:.22,depthWrite:false}),ghost=new T.InstancedMesh(ghostGeo,ghostMat,d.stages.scatter.length);ghost.frustumCulled=false;ghost.visible=false;root.add(ghost);resources.push(ghostGeo,ghostMat);
 const initial=d.stages.scatter,finalBySource={};for(const r of d.rooms)finalBySource[r.sourceId??r.id]=r;
 function showGhost(progress){ghost.visible=true;ghost.count=initial.length;initial.forEach((r,i)=>{const f=finalBySource[r.id],q=progress,s=f?1:1-progress;position.set((r.cx+(f?f.cx-r.cx:0)*q)+offsets[0],.15,(r.cy+(f?f.cy-r.cy:0)*q)+offsets[1]);scale.set((r.w+((f?.w??r.w)-r.w)*q)*s,.8,(r.h+((f?.h??r.h)-r.h)*q)*s);matrix.compose(position,quat.identity(),scale);ghost.setMatrixAt(i,matrix);});ghost.instanceMatrix.needsUpdate=true;}
 let animationStart=-1,animationPhase='Готово',heat=false,disposed=false;const userOverlays={delaunay:false,mst:false,loops:false,critical:false};
 function restore(){for(const [key,mesh]of Object.entries(meshes)){mesh.count=records[key].length;mesh.visible=key!=='marker'||root.userData.showSpawns;mesh.scale.set(1,1,1);}ghost.visible=false;for(const key of Object.keys(overlays))overlays[key].visible=userOverlays[key];lights.forEach(l=>l.visible=true);}
 root.userData={meshes,records,lights,overlays,geometryDrawCalls:Object.keys(meshes).length,showSpawns:false,
  animateBuild(now){animationStart=now;},
  finishBuild(){animationStart=-1;animationPhase='Готово';restore();},
  setOverlay(key,value){if(key==='heat'){heat=value;records.floor.forEach((r,i)=>{const room=r.roomId>=0?d.rooms[r.roomId]:null;if(heat&&room){const t=room.difficulty;color.setHSL((1-t)*.43,.6,.39);}else color.setRGB(...r.c);meshes.floor.setColorAt(i,color);});meshes.floor.instanceColor.needsUpdate=true;}else if(key==='spawns'){this.showSpawns=value;if(meshes.marker)meshes.marker.visible=value;}else if(overlays[key]){userOverlays[key]=value;overlays[key].visible=value;}},
  update(now){if(disposed)return;const t=now/1000;for(const l of lights){const phase=l.userData.phase;l.intensity=l.userData.baseIntensity*(.91+.07*Math.sin(t*6.1+phase)+.035*Math.sin(t*13.7+phase*2));}
   if(meshes.flame){records.flame.forEach((r,i)=>write(meshes.flame,i,r,.88+.11*Math.sin(t*8+r.phase)+.04*Math.sin(t*19+r.phase)));meshes.flame.instanceMatrix.needsUpdate=true;}
   if(animationStart>=0){const elapsed=(now-animationStart)/1000;for(const k of Object.keys(overlays))overlays[k].visible=false;for(const mesh of Object.values(meshes))mesh.visible=false;lights.forEach(l=>l.visible=false);
    if(elapsed<2.2){animationPhase=elapsed<.7?'01 · Размещение помещений':'02 · Разделение помещений';showGhost(Math.max(0,Math.min(1,(elapsed-.7)/1.5)));}
    else if(elapsed<3.5){showGhost(1);animationPhase=elapsed<2.8?'03 · Построение связей':'04 · Основные и обходные маршруты';overlays.delaunay.visible=elapsed<2.8;overlays.mst.visible=elapsed>=2.8;overlays.loops.visible=elapsed>=3.1;overlays.critical.visible=elapsed>=3.3;}
    else{ghost.visible=false;meshes.floor.visible=true;const tFloor=Math.min(1,(elapsed-3.5)/2),max=d.maxBfs*tFloor;let lo=0,hi=records.floor.length;while(lo<hi){const mid=(lo+hi)>>>1;if(records.floor[mid].depth<=max)lo=mid+1;else hi=mid;}meshes.floor.count=lo;animationPhase='05 · Прокладка проходов';
     if(elapsed>=5.5){animationPhase='06 · Построение стен';meshes.wall.visible=true;meshes.wall.scale.y=Math.min(1,(elapsed-5.5)/.7);}
     if(elapsed>=6.2){animationPhase='07 · Декор и освещение';for(const k of Object.keys(meshes))if(k!=='floor'&&k!=='wall'&&(k!=='marker'||this.showSpawns)){meshes[k].visible=true;meshes[k].count=Math.floor(records[k].length*Math.min(1,(elapsed-6.2)/.8));}lights.forEach(l=>l.visible=true);}
     if(elapsed>=7){animationStart=-1;animationPhase='Готово';restore();}
    }
   }return {phase:animationPhase,building:animationStart>=0};
  },
  dispose(){if(disposed)return;disposed=true;root.traverse(o=>{if(o.isInstancedMesh&&o.dispose)o.dispose();});for(const resource of resources)if(resource.dispose)resource.dispose();root.clear();}
 };root.dispose=root.userData.dispose;root.update=root.userData.update.bind(root.userData);return root;
}
globalThis.buildDungeonScene=buildDungeonScene;
