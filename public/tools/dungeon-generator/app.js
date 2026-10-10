'use strict';
(() => {
 const $ = id => document.getElementById(id), E = DungeonEngine;
 const viewport = $('viewport'), main = viewport.parentElement;
 const typeColors = {entrance:'#5db7a1',combat:'#738078',elite:'#c3914d',treasure:'#c4a16d',shrine:'#6d8db6',boss:'#c76e4b',secret:'#9a7db0'};
 const shapes = {rectangle:'Прямоугольник',ellipse:'Эллипс',octagon:'Восьмиугольник'};
 let dungeon, group, renderer, scene, camera, target, raycaster;
 let rotation=Math.PI/4, span=120, drag=null, pointer=null, building=false, buildStart=0, busy=false, exporting=false, selected=null, visible=true, lastHover=0;
 const roomLabel = type => DungeonRoomLabels[DungeonPresets[dungeon.params.theme].family][type];
 for (const [family,title] of Object.entries(DungeonFamilies)) {
  const optgroup=document.createElement('optgroup'); optgroup.label=title;
  for (const [id,preset] of Object.entries(DungeonPresets)) if(preset.family===family) optgroup.append(new Option(preset.title,id));
  $('theme').append(optgroup);
 }
 function error(message) { $('error-message').textContent=message; $('error').style.display='block'; }
 function resize() {
  if(!renderer || !viewport.clientWidth || !viewport.clientHeight) return;
  renderer.setSize(viewport.clientWidth,viewport.clientHeight,false); if(dungeon)fit();else updateCamera();
 }
 function updateCamera() {
  if(!camera) return;
  const aspect=viewport.clientWidth/Math.max(1,viewport.clientHeight);
  camera.left=-span*aspect/2; camera.right=span*aspect/2; camera.top=span/2; camera.bottom=-span/2;
  camera.position.set(target.x+Math.sin(rotation)*250,target.y+250*Math.tan(38*Math.PI/180),target.z+Math.cos(rotation)*250);
  camera.lookAt(target); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
 }
 function fit() {
  if(!dungeon || !camera) return;
  target.set(0,0,0); rotation=Math.PI/4;
  const width=(dungeon.W+dungeon.H)*Math.SQRT1_2, height=width*Math.sin(38*Math.PI/180)+6;
  span=Math.max(width/(viewport.clientWidth/Math.max(1,viewport.clientHeight))*1.13,height*1.26,40); updateCamera();
 }
 function zoom(factor) { span=Math.max(14,Math.min(700,span*factor)); updateCamera(); }
 function pickRoom() {
  if(!pointer || !dungeon || !raycaster) return null;
  raycaster.setFromCamera(new THREE.Vector2(pointer.nx,pointer.ny),camera);
  const point=new THREE.Vector3();
  if(!raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),point)) return null;
  const x=Math.round(point.x+dungeon.W/2), y=Math.round(point.z+dungeon.H/2);
  if(x<0 || y<0 || x>=dungeon.W || y>=dungeon.H) return null;
  const i=y*dungeon.W+x, id=dungeon.roomIds[i];
  return dungeon.grid[i]===E.FLOOR && id>=0 ? dungeon.rooms[id] : null;
 }
 function inspect(room) {
  selected=room.id; $('room-number').textContent=`ПОМЕЩЕНИЕ ${room.id+1}`;
  $('room-title').textContent=roomLabel(room.type);
  const enemies=dungeon.spawns.filter(s=>s.roomId===room.id).length;
  $('room-detail').textContent=`${shapes[room.shape]} · ${room.area} клеток\nГлубина маршрута: ${room.depth}\nУсловная сложность: ${Math.round(room.difficulty*100)}%\nСвязей: ${room.degree} · Мест противников: ${enemies}`;
  $('room-card').style.display='block'; drawMinimap();
 }
 function visit(room) {
  inspect(room);
  if(camera) { target.set(room.cx-dungeon.W/2,0,room.cy-dungeon.H/2); span=Math.max(room.w,room.h)*2.7; updateCamera(); }
 }
 function drawLegend() {
  $('legend').replaceChildren();
  for(const type of Object.keys(typeColors)) {
   const button=document.createElement('button'); button.style.setProperty('--c',typeColors[type]);
   button.append(document.createElement('i'),document.createTextNode(roomLabel(type))); let cursor=0;
   button.addEventListener('click',()=>{
    let rooms=dungeon.rooms.filter(r=>r.type===type);
    if(type==='secret' && !rooms.length) { const prop=dungeon.props.find(p=>p.secret); if(prop) rooms=[dungeon.rooms[prop.roomId]]; }
    if(rooms.length) visit(rooms[cursor++%rooms.length]);
    else { $('stage-label').textContent='На этой карте нет помещений такого типа'; }
   });
   $('legend').append(button);
  }
 }
 function drawMinimap() {
  if(!dungeon) return;
  const canvas=$('minimap'), ctx=canvas.getContext('2d'), d=dungeon, unit=Math.min((canvas.width-10)/d.W,(canvas.height-10)/d.H), ox=(canvas.width-d.W*unit)/2, oy=(canvas.height-d.H*unit)/2;
  ctx.clearRect(0,0,canvas.width,canvas.height); ctx.fillStyle=DungeonPresets[d.params.theme].floor;
  for(let y=0;y<d.H;y++) for(let x=0;x<d.W;x++) if(d.grid[y*d.W+x]===E.FLOOR) ctx.fillRect(ox+x*unit,oy+y*unit,Math.max(unit,1),Math.max(unit,1));
  for(const room of d.rooms) {
   ctx.fillStyle=typeColors[room.type]; ctx.beginPath(); ctx.arc(ox+(room.cx+.5)*unit,oy+(room.cy+.5)*unit,room.type==='boss'?3.3:2,0,Math.PI*2); ctx.fill();
   if(room.id===selected) { ctx.strokeStyle='#fff';ctx.beginPath();ctx.arc(ox+(room.cx+.5)*unit,oy+(room.cy+.5)*unit,5,0,Math.PI*2);ctx.stroke(); }
  }
  canvas.mapTransform={unit,ox,oy};
 }
 function bindCamera(canvas) {
  canvas.addEventListener('pointerdown',e=>{
   if(e.button!==0 && e.button!==1) return;
   canvas.setPointerCapture(e.pointerId); drag={x:e.clientX,y:e.clientY,target:target.clone(),moved:false}; $('tooltip').style.display='none';
  });
  canvas.addEventListener('pointermove',e=>{
   const bounds=canvas.getBoundingClientRect();
   pointer={x:e.clientX,y:e.clientY,nx:(e.clientX-bounds.left)/bounds.width*2-1,ny:-(e.clientY-bounds.top)/bounds.height*2+1};
   if(!drag) return;
   const dx=e.clientX-drag.x,dy=e.clientY-drag.y,unit=span/viewport.clientHeight,f=1/Math.sin(38*Math.PI/180);
   drag.moved ||= Math.abs(dx)+Math.abs(dy)>5;
   target.x=drag.target.x-dx*unit*Math.cos(rotation)-dy*unit*Math.sin(rotation)*f;
   target.z=drag.target.z+dx*unit*Math.sin(rotation)-dy*unit*Math.cos(rotation)*f; updateCamera();
  });
  canvas.addEventListener('pointerup',e=>{ if(drag && !drag.moved && !building) { const room=pickRoom();if(room) inspect(room); } drag=null;if(canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId); });
  for(const name of ['pointercancel','lostpointercapture']) canvas.addEventListener(name,()=>drag=null);
  canvas.addEventListener('pointerleave',()=>{pointer=null;$('tooltip').style.display='none';});
  canvas.addEventListener('wheel',e=>{e.preventDefault();zoom(Math.exp(Math.max(-100,Math.min(100,e.deltaY))*.0015));},{passive:false});
 }
 function initThree() {
  try {
   const canvas=document.createElement('canvas'),context=canvas.getContext('webgl2',{antialias:true,alpha:false});
   if(!context) throw Error('WebGL2');
   renderer=new THREE.WebGLRenderer({canvas,context,antialias:true}); renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
   renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.22;
   scene=new THREE.Scene(); camera=new THREE.OrthographicCamera(-100,100,100,-100,.1,1300); target=new THREE.Vector3(); raycaster=new THREE.Raycaster();
   viewport.append(canvas); new ResizeObserver(resize).observe(viewport);
   new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;}).observe(viewport);
   resize(); bindCamera(canvas); requestAnimationFrame(render);
  } catch {
   renderer?.dispose(); renderer=null;
   const note=document.createElement('p');note.className='webgl-note';note.textContent='3D-просмотр недоступен: включите WebGL2 в браузере. Мини-карта, генерация, экспорт UVTT и PNG сверху доступны.';viewport.append(note);
   const option=$('export-format').querySelector('[value="isometric"]'); option.disabled=true;
   $('replay').disabled=true;
  }
 }
 function checks() {
  if(!dungeon) return;
  const list=E.validate(dungeon); $('checks').replaceChildren();
  for(const check of list) {
   const div=document.createElement('div');div.className='check'+(check.pass?'':' fail');
   const title=document.createElement('b');title.textContent=(check.pass?'✓ ':'! ')+check.name;
   const value=document.createElement('small');value.textContent=check.value;div.append(title,value);$('checks').append(div);
  }
  $('check-total').textContent=`${list.filter(c=>c.pass).length} / ${list.length}`;
 }
 function getParams() {
  return {seed:Number($('seed').value),roomCount:Number($('roomCount').value),loopChance:Number($('loopChance').value)/100,decorDensity:Number($('decorDensity').value)/100,theme:$('theme').value,layoutStyle:$('layoutStyle').value};
 }
 function generate() {
  if(busy || exporting) return;
  if(!$('seed').checkValidity() || $('seed').value==='') { error('Введите целое число от −2147483648 до 2147483647.'); return; }
  busy=true;$('generate').disabled=true;$('generate').textContent='Создаём карту…';$('error').style.display='none';$('room-card').style.display='none';selected=null;
  requestAnimationFrame(()=>{
   try {
    const next=E.generateDungeon(getParams()), nextGroup=renderer?buildDungeonScene(next):null;
    if(group) { scene.remove(group);group.dispose(); } dungeon=next;group=nextGroup;
    const preset=DungeonPresets[dungeon.params.theme];
    if(group) {
     scene.add(group);renderer.setClearColor(preset.background);scene.fog=new THREE.FogExp2(preset.background,.002);
     document.querySelectorAll('[data-overlay]').forEach(el=>group.userData.setOverlay(el.dataset.overlay,el.checked));fit();
     if($('animateBuild').checked && !matchMedia('(prefers-reduced-motion: reduce)').matches) { buildStart=performance.now();group.userData.animateBuild(buildStart); }
    }
    $('dungeon-name').textContent=dungeon.name;$('theme-title').textContent=preset.title;
    $('subtitle').textContent=`КОД ${dungeon.params.seed} · ${dungeon.W} × ${dungeon.H} КЛЕТОК`;
    $('stat-rooms').textContent=dungeon.stats.rooms;$('stat-loops').textContent=dungeon.stats.loops;$('stat-floor').textContent=dungeon.stats.floorTiles.toLocaleString('ru-RU');$('stat-time').textContent=dungeon.stats.genMs.toFixed(1);
    $('stage-label').textContent='Все помещения связаны · Готово';$('export-status').textContent='';drawMinimap();drawLegend();checks();
    const p=dungeon.params, hash=new URLSearchParams({seed:p.seed,rooms:p.roomCount,loops:Math.round(p.loopChance*100),decor:Math.round(p.decorDensity*100),theme:p.theme,layout:p.layoutStyle});
    history.replaceState(null,'','#'+hash);
   } catch(e) { error(e.message); }
   finally {busy=false;$('generate').disabled=false;$('generate').textContent='Создать карту ↗';}
  });
 }
 function render(now) {
  requestAnimationFrame(render); if(!renderer || !visible || document.hidden) return;
  if(group) {
   const wasBuilding=building,state=group.update(now);building=state.building;
   if(building) $('stage-label').textContent=state.phase;
   else if(wasBuilding) $('stage-label').textContent='Все помещения связаны · Готово';
   $('build-progress').style.display=building?'block':'none'; if(building) $('build-bar').style.width=Math.min(100,(now-buildStart)/70)+'%';
   $('render-budget').textContent=`${group.userData.lights.length} источников света`;
  }
  if(pointer && !drag && !building && now-lastHover>90) {
   lastHover=now;const room=pickRoom(),tip=$('tooltip');
   if(room) {const b=main.getBoundingClientRect();tip.textContent=roomLabel(room.type);tip.style.left=Math.max(0,Math.min(main.clientWidth-215,pointer.x-b.left+15))+'px';tip.style.top=Math.min(main.clientHeight-50,pointer.y-b.top+12)+'px';tip.style.display='block';}else tip.style.display='none';
  }
  renderer.render(scene,camera);
 }
 for(const id of ['roomCount','loopChance','decorDensity']) {
  $(id).addEventListener('input',()=>$(id+'-out').textContent=$(id).value+(id==='roomCount'?'':'%'));$(id).addEventListener('change',generate);
 }
 $('theme').addEventListener('change',()=>{$('layoutStyle').value=DungeonPresets[$('theme').value].defaultLayout;generate();});
 $('layoutStyle').addEventListener('change',generate);$('generate').addEventListener('click',generate);
 $('seed').addEventListener('keydown',e=>{if(e.key==='Enter')generate();});
 $('dice').addEventListener('click',()=>{const a=new Uint32Array(1);crypto.getRandomValues(a);$('seed').value=a[0]&0x7fffffff;generate();});
 document.querySelectorAll('[data-overlay]').forEach(el=>el.addEventListener('change',()=>group?.userData.setOverlay(el.dataset.overlay,el.checked)));
 $('fit').addEventListener('click',fit);$('rotate').addEventListener('click',()=>{rotation+=Math.PI/2;updateCamera();});$('zoom-in').addEventListener('click',()=>zoom(.8));$('zoom-out').addEventListener('click',()=>zoom(1.25));
 $('replay').addEventListener('click',()=>{if(group){buildStart=performance.now();group.userData.animateBuild(buildStart);fit();}});
 $('test-again').addEventListener('click',checks);$('room-close').addEventListener('click',()=>{$('room-card').style.display='none';selected=null;drawMinimap();});$('error-close').addEventListener('click',()=>$('error').style.display='none');
 $('minimap').addEventListener('click',e=>{
  if(!dungeon) return;
  const canvas=$('minimap'),b=canvas.getBoundingClientRect(),m=canvas.mapTransform;
  const x=((e.clientX-b.left)*canvas.width/b.width-m.ox)/m.unit,y=((e.clientY-b.top)*canvas.height/b.height-m.oy)/m.unit;
  const room=dungeon.rooms.reduce((a,r)=>Math.hypot(r.cx-x,r.cy-y)<Math.hypot(a.cx-x,a.cy-y)?r:a);visit(room);
 });
 $('export').addEventListener('click',()=>{if(dungeon) DungeonExport.download(new Blob([JSON.stringify(dungeon,(_key,v)=>ArrayBuffer.isView(v)?Array.from(v):v,2)],{type:'application/json'}),`map-${dungeon.params.seed}.json`);});
 function exportHelp() { $('export-help').textContent={uvtt:'UVTT: меню страниц → Create Page → Upload Background. Стены и свет импортируются вместе с картой; работа Dynamic Lighting требует подписки Roll20. Проходы остаются открытыми, двери расставьте в Roll20.',topdown:'ZIP: PNG по 70 px на клетку и инструкция с размерами и координатами частей. Распакуйте и загрузите PNG на слой Map & Background с квадратной сеткой 70 px.',isometric:'ZIP: изометрический PNG без интерфейса и инструкция. В Roll20 отключите сетку: этот вид предназначен для свободного размещения токенов.'}[$('export-format').value]; }
 $('export-format').addEventListener('change',exportHelp);
 $('export-map').addEventListener('click',async()=>{
  if(!dungeon || exporting || busy) return;
  exporting=true;$('export-map').disabled=true;
  const controls=[...document.querySelectorAll('aside input, aside select, #generate, #dice')]; controls.forEach(el=>el.disabled=true);
  try {
   const format=$('export-format').value;
   const result=await DungeonExport.create(dungeon,format,message=>$('export-status').textContent=message);
   DungeonExport.download(result.blob,result.filename);$('export-status').textContent=`Готово · ${(result.blob.size/1024/1024).toFixed(1)} МБ`;
  } catch(e) { $('export-status').textContent='Не удалось экспортировать: '+e.message; }
  finally { exporting=false;$('export-map').disabled=false;controls.forEach(el=>el.disabled=false);if(!renderer)$('export-format').querySelector('[value="isometric"]').disabled=true; }
 });
 $('copy-link').addEventListener('click',async()=>{
  try {await navigator.clipboard.writeText(location.href);$('stage-label').textContent='Ссылка на карту скопирована';}
  catch {error('Не удалось скопировать ссылку. Скопируйте адрес этой страницы из адресной строки или откройте генератор в отдельной вкладке.');}
 });
 function closeAbout() {$('about').style.display='none';$('about-open').focus();}
 $('about-open').addEventListener('click',()=>{$('about').style.display='flex';$('about-close').focus();});$('about-close').addEventListener('click',closeAbout);$('about').addEventListener('click',e=>{if(e.target===$('about'))closeAbout();});
 document.addEventListener('keydown',e=>{
  if($('about').style.display==='flex') {
   if(e.key==='Escape')closeAbout();
   if(e.key==='Tab') {const nodes=$('about').querySelectorAll('button,a'),first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey && document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey && document.activeElement===last){e.preventDefault();first.focus();}}
   return;
  }
  if(/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;
  if(e.key==='Escape')$('room-card').style.display='none';
  if(e.key.toLowerCase()==='q'){rotation-=Math.PI/2;updateCamera();}if(e.key.toLowerCase()==='e'){rotation+=Math.PI/2;updateCamera();}
  if(e.key==='Home'){e.preventDefault();fit();}if(e.key==='+' || e.key==='=')zoom(.85);if(e.key==='-')zoom(1.18);
 });
 function restoreHash() {
  const hash=new URLSearchParams(location.hash.slice(1));
  const mapping={seed:'seed',rooms:'roomCount',loops:'loopChance',decor:'decorDensity',theme:'theme',layout:'layoutStyle'};
  $('theme').value='crypt';$('layoutStyle').value='mixed';
  for(const id of ['seed','roomCount','loopChance','decorDensity'])$(id).value=$(id).defaultValue;
  for(const [key,id] of Object.entries(mapping)) if(hash.has(key)) {
   const input=$(id),value=hash.get(key);
   if(input.tagName==='SELECT') {if([...input.options].some(o=>o.value===value))input.value=value;}
   else if(value.trim()!=='' && Number.isFinite(Number(value))) {input.value=value;if(!input.checkValidity())input.value=input.defaultValue;}
  }
  if(!hash.has('layout'))$('layoutStyle').value=DungeonPresets[$('theme').value].defaultLayout;
  for(const id of ['roomCount','loopChance','decorDensity']) $(id+'-out').textContent=$(id).value+(id==='roomCount'?'':'%');
 }
 restoreHash();window.addEventListener('hashchange',()=>{restoreHash();generate();});
 globalThis.getCurrentDungeon=()=>dungeon;globalThis.getDungeonScene=()=>group;
 initThree();generate();window.addEventListener('pagehide',()=>{group?.dispose();renderer?.dispose();});
})();
