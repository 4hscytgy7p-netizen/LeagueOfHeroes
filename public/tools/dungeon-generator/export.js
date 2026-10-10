/* Player-facing exports. No room types, spawn markers, diagnostic layers or secret props. */
'use strict';
globalThis.DungeonExport = (() => {
 const encoder=new TextEncoder(), MAX_FILE=9*1024*1024;
 const pause=()=>new Promise(resolve=>setTimeout(resolve,0));
 function download(blob,filename) {
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
 }
 function playerProps(d) { return d.props.filter(p=>!p.secret && p.kind!=='cache' && d.rooms[p.roomId]?.type!=='secret'); }
 function drawTopdown(d,region,pixels,grid=true) {
  const canvas=document.createElement('canvas');canvas.width=region.w*pixels;canvas.height=region.h*pixels;
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('Браузер не поддерживает Canvas 2D.');
  const preset=DungeonPresets[d.params.theme],technical=preset.family!=='fantasy';
  ctx.fillStyle=preset.background;ctx.fillRect(0,0,canvas.width,canvas.height);
  for(let y=region.y;y<region.y+region.h;y++) for(let x=region.x;x<region.x+region.w;x++) {
   const tile=d.grid[y*d.W+x];if(!tile)continue;
   const px=(x-region.x)*pixels,py=(y-region.y)*pixels;
   ctx.fillStyle=tile===1?preset.floor:preset.wall;ctx.fillRect(px,py,pixels,pixels);
   if(tile===1) {
    if(grid) {ctx.strokeStyle=technical?'#ffffff14':'#00000018';ctx.lineWidth=Math.max(.5,pixels/70);ctx.strokeRect(px+.5,py+.5,pixels-1,pixels-1);}
    if(technical && (x+y)%4===0) {ctx.fillStyle=preset.accent+'44';ctx.fillRect(px+pixels*.1,py+pixels*.1,pixels*.8,pixels*.035);}
   }
  }
  // Clip prop silhouettes to their own cells, so adjacent PNG parts join exactly.
  for(const p of playerProps(d)) {
   if(p.x<region.x || p.y<region.y || p.x>=region.x+region.w || p.y>=region.y+region.h)continue;
   const x=(p.x-region.x+.5)*pixels,y=(p.y-region.y+.5)*pixels,s=Math.min(.9,p.scale*.6)*pixels;
   ctx.save();ctx.beginPath();ctx.rect((p.x-region.x)*pixels,(p.y-region.y)*pixels,pixels,pixels);ctx.clip();ctx.translate(x,y);ctx.rotate(p.rot||0);
   ctx.strokeStyle='#101820';ctx.lineWidth=Math.max(1,pixels*.025);
   if(p.kind==='pillar') {ctx.fillStyle=technical?'#86949b':'#8b8f81';ctx.fillRect(-s/2,-s/2,s,s);ctx.strokeRect(-s/2,-s/2,s,s);}
   else if(p.kind==='chest') {ctx.fillStyle=technical?'#647a86':'#b98d51';ctx.fillRect(-s/2,-s*.3,s,s*.6);ctx.strokeRect(-s/2,-s*.3,s,s*.6);}
   else if(p.kind==='debris') {ctx.fillStyle=technical?'#475762':'#3e493d';ctx.fillRect(-s*.3,-s*.2,s*.6,s*.4);}
   else if(p.kind==='torch' || p.kind==='brazier') {ctx.fillStyle=preset.accent;ctx.beginPath();ctx.arc(0,0,s*.15,0,Math.PI*2);ctx.fill();}
   else if(p.kind==='crystal' || p.kind==='portal' || p.kind==='sigil') {
    ctx.fillStyle=technical?preset.accent:'#8dc8e0';
    if(technical)ctx.fillRect(-s*.4,-s*.25,s*.8,s*.5);
    else {ctx.beginPath();ctx.arc(0,0,s*.3,0,Math.PI*2);ctx.fill();}
   }
   ctx.restore();
  }
  return canvas;
 }
 function png(canvas) {
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>{
   canvas.width=1;canvas.height=1;
   if(!blob)reject(Error('Браузер не смог создать PNG.'));
   else if(blob.size>MAX_FILE)reject(Error('PNG больше 9 МБ. Уменьшите число помещений.'));
   else resolve(blob);
  },'image/png'));
 }
 function base64(blob) {
  return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=()=>reject(Error('Не удалось прочитать изображение.'));reader.readAsDataURL(blob);});
 }
 // Merge collinear floor boundaries. Coordinates describe cell corners, in grid units.
 function wallSegments(d) {
  const horizontal=new Map(),vertical=new Map();
  const add=(map,line,pos)=>{if(!map.has(line))map.set(line,[]);map.get(line).push(pos);};
  const floor=(x,y)=>x>=0 && y>=0 && x<d.W && y<d.H && d.grid[y*d.W+x]===1;
  for(let y=0;y<d.H;y++)for(let x=0;x<d.W;x++)if(floor(x,y)) {
   if(!floor(x,y-1))add(horizontal,y,x);if(!floor(x,y+1))add(horizontal,y+1,x);
   if(!floor(x-1,y))add(vertical,x,y);if(!floor(x+1,y))add(vertical,x+1,y);
  }
  const lines=[];
  for(const [map,isHorizontal] of [[horizontal,true],[vertical,false]]) for(const [fixed,values] of map) {
   values.sort((a,b)=>a-b);let start=values[0],end=start+1;
   const emit=()=>lines.push(isHorizontal?[{x:start,y:fixed},{x:end,y:fixed}]:[{x:fixed,y:start},{x:fixed,y:end}]);
   for(let i=1;i<values.length;i++) {if(values[i]===end)end++;else {emit();start=values[i];end=start+1;}}emit();
  }
  return lines;
 }
 function uvttData(d,image,pixels) {
  return {
   format:0.3,software:'League of Heroes Cartographer',
   resolution:{map_origin:{x:0,y:0},map_size:{x:d.W,y:d.H},pixels_per_grid:pixels},
   line_of_sight:wallSegments(d),
   objects_line_of_sight:playerProps(d).filter(p=>p.kind==='pillar').map(p=>{
    const s=Math.min(.45,.34*p.scale),x=p.x+.5,y=p.y+.5;
    return [{x:x-s,y:y-s},{x:x+s,y:y-s},{x:x+s,y:y+s},{x:x-s,y:y+s},{x:x-s,y:y-s}];
   }),
   portals:[],environment:{baked_lighting:false,ambient_light:'ff404040'},
   lights:d.lights.map(light=>({position:{x:light.x+.5,y:light.y+.5},range:light.distance,intensity:Math.min(1,light.intensity/3),color:'ff'+light.color.toString(16).padStart(6,'0'),shadows:true})),
   image,
  };
 }
 function regions(d,max=56) {
  const result=[];
  for(let y=0;y<d.H;y+=max)for(let x=0;x<d.W;x+=max)result.push({x,y,w:Math.min(max,d.W-x),h:Math.min(max,d.H-y),filename:`map-r${Math.floor(y/max)+1}-c${Math.floor(x/max)+1}.png`});
  return result;
 }
 const crcTable=Array.from({length:256},(_,i)=>{for(let k=0;k<8;k++)i=i&1?0xedb88320^(i>>>1):i>>>1;return i>>>0;});
 function crc32(data) {let c=0xffffffff;for(const b of data)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
 // ZIP STORE needs no library and avoids recompressing already compressed PNGs.
 async function zip(files) {
  const parts=[],directory=[];let offset=0,dirSize=0;
  for(const file of files) {
   const name=encoder.encode(file.name),data=file.data instanceof Blob?new Uint8Array(await file.data.arrayBuffer()):encoder.encode(file.data);
   const crc=crc32(data),local=new Uint8Array(30),lv=new DataView(local.buffer);
   lv.setUint32(0,0x04034b50,true);lv.setUint16(4,20,true);lv.setUint16(6,0x800,true);lv.setUint16(12,33,true);lv.setUint32(14,crc,true);lv.setUint32(18,data.length,true);lv.setUint32(22,data.length,true);lv.setUint16(26,name.length,true);
   const central=new Uint8Array(46),cv=new DataView(central.buffer);
   cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0x800,true);cv.setUint16(14,33,true);cv.setUint32(16,crc,true);cv.setUint32(20,data.length,true);cv.setUint32(24,data.length,true);cv.setUint16(28,name.length,true);cv.setUint32(42,offset,true);
   parts.push(local,name,data);directory.push(central,name);offset+=local.length+name.length+data.length;dirSize+=central.length+name.length;
  }
  const end=new Uint8Array(22),ev=new DataView(end.buffer);ev.setUint32(0,0x06054b50,true);ev.setUint16(8,files.length,true);ev.setUint16(10,files.length,true);ev.setUint32(12,dirSize,true);ev.setUint32(16,offset,true);
  return new Blob([...parts,...directory,end],{type:'application/zip'});
 }
 async function isometric(d) {
  const clean={...d,props:playerProps(d),spawns:[]},group=buildDungeonScene(clean);
  let renderer;
  try {
   renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(1);
   renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.22;renderer.setClearColor(DungeonPresets[d.params.theme].background);
   const worldWidth=(d.W+d.H)*Math.SQRT1_2+8,worldHeight=(d.W+d.H)/Math.sqrt(6)+10;
   const max=Math.min(4096,renderer.capabilities.maxTextureSize,renderer.getContext().getParameter(renderer.getContext().MAX_RENDERBUFFER_SIZE));
   const width=Math.floor(max),height=Math.max(1,Math.floor(width*worldHeight/worldWidth));renderer.setSize(width,height,false);
   const camera=new THREE.OrthographicCamera(-worldWidth/2,worldWidth/2,worldHeight/2,-worldHeight/2,.1,1300);
   camera.position.set(250,250,250);camera.lookAt(0,0,0);camera.updateMatrixWorld();
   const scene=new THREE.Scene();scene.add(group);group.userData.finishBuild();renderer.render(scene,camera);
   return {image:await new Promise((resolve,reject)=>renderer.domElement.toBlob(b=>b?resolve(b):reject(Error('Не удалось создать изображение.')),'image/png')),width,height};
  } finally {group.dispose();renderer?.dispose();renderer?.forceContextLoss();}
 }
 async function create(d,format,progress=()=>{}) {
  const prefix=`map-${d.params.theme}-${d.params.seed}`;
  progress('Подготовка экспорта…');await pause();
  if(format==='uvtt') {
   // Bound both canvas dimensions and memory; preserve exact cells at any resolution.
   const pixels=Math.max(1,Math.min(35,Math.floor(4096/Math.max(d.W,d.H))));
   const image=await base64(await png(drawTopdown(d,{x:0,y:0,w:d.W,h:d.H},pixels,false)));
   const blob=new Blob([JSON.stringify(uvttData(d,image,pixels))],{type:'application/json'});
   if(blob.size>MAX_FILE)throw Error('UVTT больше 9 МБ. Уменьшите число помещений или используйте PNG сверху.');
   return {blob,filename:prefix+'.uvtt'};
  }
  if(format==='isometric') {
   const {image,width,height}=await isometric(d);
   if(image.size>MAX_FILE)throw Error('PNG больше 9 МБ. Используйте экспорт сверху.');
   const readme=`Изометрическая карта: ${d.name}\n\nЗагрузите map-isometric.png на слой Map & Background в Roll20 Jumpgate.\nОтключите сетку (Grid: Off); привязка и точные измерения по квадратной сетке для этого изображения не предусмотрены.\nРазмер изображения: ${width} × ${height} px. Размер страницы: ${Math.ceil(width/70)} × ${Math.ceil(height/70)} стандартных клеток; задайте картинке исходные размеры в Set Dimensions.\nДля квадратной сетки, точных расстояний и стен Dynamic Lighting используйте UVTT или PNG сверху.\n`;
   return {blob:await zip([{name:'map-isometric.png',data:image},{name:'README.txt',data:readme}]),filename:prefix+'-isometric.zip'};
  }
  if(format!=='topdown')throw Error('Неизвестный формат экспорта.');
  const chunks=regions(d),files=[];
  for(let i=0;i<chunks.length;i++) {
   progress(`Создаём PNG: ${i+1} / ${chunks.length}`);await pause();
   files.push({name:chunks[i].filename,data:await png(drawTopdown(d,chunks[i],70))});
  }
  const settings={page:{width:d.W,height:d.H,grid:'square',pixelsPerCell:70},images:chunks.map(r=>({file:r.filename,width:r.w*70,height:r.h*70,left:(r.x+r.w/2)*70,top:(r.y+r.h/2)*70,x:r.x*70,y:r.y*70}))};
  const readme=`Карта: ${d.name}\n\n1. Распакуйте ZIP. Создайте страницу в Roll20 Jumpgate: ${d.W} × ${d.H} клеток.\n2. Выберите квадратную сетку (Square), размер клетки 70 px (множитель 1). Масштаб в футах/метрах задайте по вашей игре.\n3. Загрузите PNG на слой Map & Background. Для каждого фрагмента задайте размер через Set Dimensions.\n4. Разместите фрагменты без промежутков. Координаты ниже — от верхнего левого угла страницы; left/top — центр изображения. При перемещении удерживайте Alt, чтобы временно отключить привязку.\n5. Размеры и центры также записаны в settings.json для справки; это не файл импорта Roll20. Стены и свет автоматически переносит только экспорт UVTT.\n\n${settings.images.map(r=>`${r.file}: ${r.width} × ${r.height} px; угол x=${r.x}, y=${r.y}; центр left=${r.left}, top=${r.top}`).join('\n')}\n\nPNG не содержит обозначений секретов, мест противников и слоёв мастера.\n`;
  files.push({name:'README.txt',data:readme},{name:'settings.json',data:JSON.stringify(settings,null,2)});
  progress('Собираем архив…');await pause();
  return {blob:await zip(files),filename:prefix+'-topdown.zip'};
 }
 return {create,download,wallSegments,uvttData,regions,zip,drawTopdown,playerProps};
})();
