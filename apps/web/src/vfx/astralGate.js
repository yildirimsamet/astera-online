/* eslint-disable */
/*!
00GameDevs exported assets — original code only
This license applies only to original code delivered by the VFX, Shader and Object copy/download functions. Website UI code, branding, avatars and promotional images are not licensed by this notice. Third-party code retains its own copyright and license.

The MIT License

Copyright (c) 2026 00GameDevs (@00vchannel)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

Third-party dependency: Three.js (including its addons).
Keep the notices supplied with each dependency when distributing your game.
The notice below does not replace any additional notices in imported modules.

The MIT License

Copyright © 2010-2026 three.js authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/
// 星紋之門 / Gate of Astral Tracery
// Three.js 0.187.0 / WebGL2 / SRGBColorSpace / NoToneMapping
// 將 group 加入場景，在既有遊戲循環呼叫 update(deltaSeconds)，結束時 dispose()。
// 建立後起始 → 持續；由遊戲碰撞呼叫 hit(worldPosition?, worldNormal?)，或 stop() 自然收尾。
// hit() 預設從彈體前端觸發；指定世界座標時將前端對準接觸點，根物件中心可能偏移。
// 持續 update 至 finished 後 dispose()；phase 提供階段。reset() 保留目前位置。
// 單次效果自行結束；不包含碰撞判斷或網站自動展示排程。
// size 控制核心或草葉尺寸；speed 控制視覺動畫速度；detail 控制裝飾或筆觸強度。
// quantity 僅用於支援款的主體總數／每輪數量；density 控制裝飾粒子或植被密度。
// spread 僅用於支援款的散布範圍，預設值見 defaultOptions；不改主體大小、數量或演出時間。
// 無外部貼圖；Fireball 的 render 包含光暈合成，其他素材依各自說明。不同渲染設定可能影響外觀。

function upgradeFireball(THREE,fx){
const T=THREE;
const presets=[
 {name:'1 · 現況',flash:1,burst:1,arc:1,crack:1,energy:1,note:'A 原本體＋第 3 級光暈'},
 {name:'2 · 加強',flash:1.5,burst:1.25,arc:1.15,crack:1.1,energy:1.2,note:'＋快速破散的橙金衝擊環'},
 {name:'3 · 強烈',flash:2,burst:1.5,arc:1.3,crack:1.2,energy:1.4,note:'＋六束短促放射亮焰'},
 {name:'4 · 猛烈',flash:3,burst:1.8,arc:1.5,crack:1.35,energy:1.65,note:'＋八條亮頭、衰減尾跡的火星'},
 {name:'5 · 極誇張',flash:4,burst:2.2,arc:1.75,crack:1.5,energy:1.9,note:'＋七塊分離燃燒碎焰'},
 {name:'6 · 爆裂',flash:5,burst:2.6,arc:2,crack:1.65,energy:2.1,note:'＋五團翻捲上飄煙塵'},
 {name:'7 · 超載',flash:6,burst:3,arc:2.3,crack:1.85,energy:2.3,note:'＋六塊旋轉焦黑碎片'},
 {name:'8 · 極限',flash:8,burst:3.6,arc:2.7,crack:2.1,energy:2.6,note:'先行火花／持久白熱爆閃／牆面餘熱'}
];
function patch(m,stage,a,b){if(m[stage].split(a).length!==2)throw Error('Non-unique shader patch: '+a);m[stage]=m[stage].replace(a,b);m.needsUpdate=true;}
const f=n=>Number(n).toFixed(4);
function upgrade(){
 const level=6;
 const p=presets[level],hit=fx.group.getObjectByName('lifecycle-impact'),glow=fx.group.getObjectByName('lifecycle-contact-glow'),aux=fx.group.getObjectByName('lifecycle-impact-wisps');
 patch(hit.material,'vertexShader','(.10+.25*grow)*(1.0-smoothstep(.07,.17,t))',`(.10+.25*smoothstep(0.0,.06,t))*(1.0-smoothstep(.06,.18,t))*${f(p.flash)}`);
 patch(hit.material,'vertexShader','float reach=(.85+seed*.8)*grow',`float reach=(.85+seed*.8)*grow*${f(p.burst)}`);
 patch(hit.material,'vertexShader','float radius=(.32+.75*open+max(t-.1,0.0)*.13)',`float radius=${f(p.arc)}*(.32+.75*open+max(t-.1,0.0)*.13)`);
 patch(hit.material,'fragmentShader','heat=.96;alpha=1.0-smoothstep(.075,.15,t);','heat=.96;alpha=1.0-smoothstep(.06,.18,t);');
 patch(hit.material,'fragmentShader','if(alpha<.005)discard;',`if(vPart<.5)c*=${f(p.energy)};if(alpha<.005)discard;`);
 patch(aux.material,'vertexShader','(right*position.x+up*position.y)*1.8',`(right*position.x+up*position.y)*1.8*${f(p.crack)}`);
 patch(glow.material,'vertexShader','position.xy*uSize',`position.xy*${f(p.flash)}*uSize`);
 patch(glow.material,'fragmentShader','float flash=exp(-r*32.0)*(1.0-smoothstep(.055,.11,t));',`float flash=exp(-r*32.0)*(.25+.75*smoothstep(0.0,.06,t))*(1.0-smoothstep(.06,.18,t));`);
 patch(glow.material,'fragmentShader','exp(-r*5.8)',`exp(-r*5.8*${f(p.flash*p.flash)})`);
 patch(glow.material,'fragmentShader','gl_FragColor=vec4(c,flash*.95+halo);',`gl_FragColor=vec4(c*${f(p.energy)},flash*.95+halo);`);
 if(level>=6){
  // Instant, non-solid energy: straight moving streaks, no petal core.
  patch(hit.material,'vertexShader','grow=1.0-exp(-t*34.0)','grow=1.0');
  // Preserve the early impulse while bringing supporting shapes into the same scale.
  patch(hit.material,'vertexShader',`float radius=${f(p.arc)}*`,`float radius=${f(p.arc*1.35)}*`);
  patch(aux.material,'vertexShader',`(right*position.x+up*position.y)*1.8*${f(p.crack)}`,`(right*position.x+up*position.y)*1.8*${f(p.crack*1.35)}`);
  patch(hit.material,'vertexShader',`float reach=(.85+seed*.8)*grow*${f(p.burst)}`,`float reach=(.85+seed*.8)*.80*${f(p.burst)}`);
  patch(hit.material,'vertexShader','float width=sin(pow(h,.7)*3.141593)*(.10+seed*.035)*retire','float width=(.035+seed*.026)*sin(h*3.141593)');
  patch(hit.material,'vertexShader','ray*(h*reach)+side*sin(h*3.141593)*.035*sin(aPart+t*14.0)','ray*(h*reach+t*(7.0+seed*4.0))');
  patch(hit.material,'fragmentShader','*smoothstep(0.0,.015,t)','');
  patch(hit.material,'fragmentShader','1.0-smoothstep(.085,.20,t)','1.0-smoothstep(.02,.09,t)');
  patch(hit.material,'vertexShader','+t*.26+h*span','+t*(id<1.5?4.5:-3.8)+h*span');
  patch(glow.material,'fragmentShader','(.25+.75*smoothstep(0.0,.06,t))*(1.0-smoothstep(.06,.18,t))','(1.0-smoothstep(.012,.12,t))');
  patch(glow.material,'vertexShader','(.5+(1.0-exp(-uImpactProgress*68.0))*.5)','1.0');
  glow.material.uniforms.uPreviewBloomPass={value:0};
  glow.material.fragmentShader='uniform float uPreviewBloomPass;\n'+glow.material.fragmentShader;
  patch(glow.material,'fragmentShader','flash*.95+halo','flash*.55*mix(1.0,.25,uPreviewBloomPass)+halo');
  // This preview revision deliberately starts with sparks, then the approved flash.
  patch(glow.material,'fragmentShader','(1.0-smoothstep(.012,.12,t))','step(.05,t)*(1.0-smoothstep(.11,.35,t))');
  patch(glow.material,'fragmentShader','(1.0-smoothstep(.06,.20,t))','step(.05,t)*(1.0-smoothstep(.11,.35,t))');
  // The compact rays belong to the flash silhouette, not the traveling sparks.
  patch(hit.material,'fragmentShader','1.0-smoothstep(.02,.09,t)','step(.05,t)*(1.0-smoothstep(.11,.22,t))');
  patch(hit.material,'vertexShader','ray*(h*reach+t*(7.0+seed*4.0))','ray*(h*reach+max(t-.11,0.0)*(.09/.24)*(7.0+seed*4.0))');
  patch(hit.material,'vertexShader','p=vec3(recoil,0,0)+ray*','p=vec3(.05+max(max(t-.11,0.0)*(.09/.24)-.015,0.0)*1.2,0,0)+ray*');
  // Retiming preserves each seed's path and short tail; only outward travel scales.
  patch(aux.material,'vertexShader','float age=max(0.0,t-.015);','float begin=seed*.035,end=.85+seed*.25;float age=max(0.0,t-begin)*(.385+seed*.40)/(end-begin);');
  patch(aux.material,'vertexShader','age*(4.0+seed*2.5)/(1.0+age*2.0)','1.25*age*(4.0+seed*2.5)/(1.0+age*2.0)');
  patch(aux.material,'fragmentShader','*smoothstep(.015,.045,t)*(1.0-smoothstep(.20+seed*.25,.40+seed*.40,t))','*smoothstep(seed*.035,seed*.035+.015,t)*(1.0-smoothstep(.185+seed*.25,.385+seed*.40,max(0.0,t-seed*.035)*(.385+seed*.40)/(.85+seed*.25-seed*.035)))');
  patch(aux.material,'fragmentShader','float cooling=smoothstep(1.1,2.0,t),retire=1.0-smoothstep(1.35+r*.22,2.0,t);','float cooling=smoothstep(.60,2.0,t),retire=1.0-smoothstep(1.35+r*.22,2.0,t);');
  patch(aux.material,'fragmentShader','c=mix(c,vec3(1.0,.86,.40),pow(heat,4.0));',`c=mix(c,vec3(1.0,.86,.40),pow(heat,4.0));
            // Irregular heat conducts away from the cracks, not a uniform red decal.
            float grain=noise2(q*6.0+vec2(3.7,8.2)),fine=noise2(q*17.0+vec2(2.1,4.9));
            float spread=exp(-min(mainLine,twig)*(5.0+grain*5.0));
            float area=(1.0-smoothstep(.48,.83,r+(grain-.5)*.18))*spread*(.32+.68*grain);
            float hotReveal=smoothstep(.12+r*.14,.42+r*.18,t);
            float coolMask=1.0-smoothstep(.60+grain*.30,1.75+grain*.25,t);
            float heated=area*hotReveal*coolMask;
            float spot=pow(grain,3.0)*exp(-min(mainLine,twig)*23.0)*(1.0-cooling);
            vec3 heatColor=mix(vec3(.32,.008,.001),vec3(1.0,.19,.015),1.0-cooling);
            heatColor=mix(heatColor,vec3(1.0,.63,.12),spot);
            float heatAlpha=heated*(1.10+.30*fine);
            c=(c*alpha+heatColor*heatAlpha)/max(alpha+heatAlpha,.0001);
            alpha=min(1.0,alpha+heatAlpha);`);
  // Surface flashes lie just in front of the contact plane. Air hits still billboard.
  glow.material.uniforms.uImpactSurface=hit.material.uniforms.uImpactSurface;glow.material.uniforms.uImpactPlaneNormal=hit.material.uniforms.uImpactPlaneNormal;
  glow.material.vertexShader='uniform float uImpactSurface;uniform vec3 uImpactPlaneNormal;\n'+glow.material.vertexShader;
  patch(glow.material,'vertexShader','void main(){vUv=uv;vec4 mv=',`void main(){vUv=uv;if(uImpactSurface>.5){vec3 n=normalize(uImpactPlaneNormal),helper=abs(n.y)<.9?vec3(0,1,0):vec3(0,0,1);vec3 right=normalize(cross(helper,n)),up=cross(n,right);vec3 surfacePosition=(right*position.x+up*position.y)*${f(p.flash)}*uSize*(.35+.65*uLifeOrigin)+n*.035*uSize;gl_Position=projectionMatrix*modelViewMatrix*vec4(surfacePosition,1.0);return;}vec4 mv=`);
 }
 const volume=level>=6?makeFlashVolume(glow,p):null;
 const core=level>=6?removeCore(hit):null;
 const extra=createLayers(level,hit.material.uniforms,p);fx.group.add(extra);
 // Do not submit groups after their authored alpha has reached zero.
 // Keep the index buffer and all materials stable across replay and seeking.
 const extraGroups=extra.geometry.groups.map(g=>({start:g.start,count:g.count}));
 const indices=extra.geometry.index,types=extra.geometry.attributes.aKind;
 let sparkStart=extraGroups[0].start;
 while(sparkStart<extraGroups[0].start+extraGroups[0].count&&types.getX(indices.getX(sparkStart))<1.5)sparkStart+=3;

 const inverse=new T.Matrix4(),linearInverse=new T.Matrix3(),forward=new T.Vector3(),side=new T.Vector3(),worldUp=new T.Vector3(0,1,0);
 const sync=()=>{if(level===6){
  const t=hit.material.uniforms.uImpactProgress.value*2.0,groups=extra.geometry.groups;
  groups[0].start=t>=.40?sparkStart:extraGroups[0].start;
  groups[0].count=t>=1.10?0:extraGroups[0].start+extraGroups[0].count-groups[0].start;
  groups[1].count=t>=.38&&t<1.40?extraGroups[1].count:0;
  groups[2].count=t>=.13&&t<.825?extraGroups[2].count:0;
  for(let i=0;i<groups.length;i++)extra.material[i].visible=groups[i].count>0;
 }
 extra.position.copy(hit.position);extra.quaternion.copy(hit.quaternion);extra.visible=hit.material.uniforms.uImpact.value>.5&&hit.material.uniforms.uImpactProgress.value<(level>=6?.72:.55);
  if(level>=6){const u=hit.material.uniforms;glow.visible=hit.visible&&u.uImpact.value>.5&&u.uImpactProgress.value>=.05/2&&u.uImpactProgress.value<.35/2;}
  if(level>=6&&extra.visible){
   glow.quaternion.copy(hit.quaternion);
   extra.updateWorldMatrix(true,false);inverse.copy(extra.matrixWorld).invert();linearInverse.setFromMatrix4(inverse);
   forward.set(1,0,0).transformDirection(extra.matrixWorld);
   side.crossVectors(worldUp,forward);if(side.lengthSq()<1e-8)side.set(0,0,1);else side.normalize();
   const u=extra.material[0].uniforms;u.uDebrisSlope.value=forward.y;u.uDebrisForward.value.copy(forward).applyMatrix3(linearInverse);u.uDebrisSide.value.copy(side).applyMatrix3(linearInverse);u.uDebrisUp.value.copy(worldUp).applyMatrix3(linearInverse);
  }
 };
 const update=fx.update.bind(fx),hitEvent=fx.hit.bind(fx);fx.update=dt=>{update(dt);sync();};fx.hit=(...args)=>{hitEvent(...args);sync();};sync();
 if(level>=6){const setOptions=fx.setOptions.bind(fx);fx.setOptions=(...args)=>{setOptions(...args);sync();};const reset=fx.reset.bind(fx),stop=fx.stop.bind(fx);fx.reset=(...args)=>{reset(...args);sync();};fx.stop=()=>{stop();sync();};}
 // Children share the hit transform and world recoil; their materials own no lifecycle clock.
 const originalDispose=fx.dispose.bind(fx);let disposed=false;fx.dispose=()=>{if(level>=6&&disposed)return;disposed=true;if(volume)volume.dispose();if(core)core.dispose();extra.removeFromParent();extra.geometry.dispose();for(const m of extra.material)m.dispose();originalDispose();};
 applyFireballPalette(fx);
 attachFireballGlow(T,fx);
 return fx;
}
// A clipped Gaussian light field, not an opaque surface or layered fire petals.
// The back faces bound the integration and remain depth-tested against the wall.
function makeFlashVolume(glow,preset){
 const material=glow.material,geometry=new T.BoxGeometry(2,2,2);
 glow.geometry=geometry;material.side=T.BackSide;material.forceSinglePass=true;
 material.uniforms.uFlashCameraToLocal={value:new T.Matrix4()};material.uniforms.uFlashOrthographic={value:0};
 glow.onBeforeRender=(_renderer,_scene,camera)=>{material.uniforms.uFlashCameraToLocal.value.copy(camera.matrixWorldInverse).multiply(glow.matrixWorld).invert();material.uniforms.uFlashOrthographic.value=camera.isOrthographicCamera?1:0;material.uniformsNeedUpdate=true;};
 const radius=1.6*preset.flash,depth=radius*.32;
 material.vertexShader=`uniform float uSize,uLifeOrigin,uImpactSurface,uFlashOrthographic;uniform vec3 uImpactPlaneNormal;uniform mat4 uFlashCameraToLocal;
 varying vec3 vVolumeOrigin,vVolumeRay;
 void main(){
  vec3 n=uImpactSurface>.5?normalize(uImpactPlaneNormal):vec3(1,0,0),helper=abs(n.y)<.9?vec3(0,1,0):vec3(0,0,1);
  vec3 right=normalize(cross(helper,n)),up=cross(n,right);
  float scale=uSize*(.35+.65*uLifeOrigin),bottom=uImpactSurface>.5?.035:-${f(depth)},top=${f(depth)};
  vec3 local=right*position.x*${f(radius)}+up*position.y*${f(radius)}+n*mix(bottom,top,position.z*.5+.5);
  vec4 view=modelViewMatrix*vec4(local*scale,1.0);
  if(uFlashOrthographic>.5){vVolumeOrigin=(uFlashCameraToLocal*vec4(view.xy,0,1)).xyz/scale;vVolumeRay=(uFlashCameraToLocal*vec4(0,0,-1,0)).xyz;}
  else{vVolumeOrigin=(uFlashCameraToLocal*vec4(0,0,0,1)).xyz/scale;vVolumeRay=local-vVolumeOrigin;}
  gl_Position=projectionMatrix*view;
 }`;
 const field=`uniform float uImpactSurface;uniform vec3 uImpactPlaneNormal;varying vec3 vVolumeOrigin,vVolumeRay;
 float erfLight(float x){float a=abs(x),q=1.0/(1.0+.3275911*a);float y=1.0-(((((1.061405429*q-1.453152027)*q)+1.421413741)*q-.284496736)*q+.254829592)*q*exp(-a*a);return sign(x)*y;}
 float lightIntegral(vec3 o,vec3 d,float nearT,float farT,float radial){
  vec3 weight=vec3(sqrt(radial)/${f(radius)},sqrt(radial)/${f(radius)},2.0/${f(depth)});
  vec3 a=o*weight,b=d*weight;float aa=dot(b,b),ab=dot(a,b),closest=ab/aa;
  float perpendicular=max(0.0,dot(a,a)-ab*ab/aa);
  float integral=erfLight(sqrt(aa)*(farT+closest))-erfLight(sqrt(aa)*(nearT+closest));
  float normalization=uImpactSurface>.5?(.5+.5*abs(d.z))/erfLight(2.0*(1.0-.035/${f(depth)})):.5/erfLight(2.0);
  return clamp(exp(-perpendicular)*integral*normalization,0.0,1.0);
 }
 void volumeRay(out vec3 o,out vec3 d,out float nearT,out float farT){
  vec3 n=uImpactSurface>.5?normalize(uImpactPlaneNormal):vec3(1,0,0),helper=abs(n.y)<.9?vec3(0,1,0):vec3(0,0,1);
  vec3 right=normalize(cross(helper,n)),up=cross(n,right),ray=normalize(vVolumeRay);
  o=vec3(dot(vVolumeOrigin,right),dot(vVolumeOrigin,up),dot(vVolumeOrigin,n));d=vec3(dot(ray,right),dot(ray,up),dot(ray,n));
  float bottom=uImpactSurface>.5?.035:-${f(depth)};
  vec3 safeDirection=mix(vec3(-1),vec3(1),step(vec3(0),d))*max(abs(d),vec3(.000001));
  vec3 a=(vec3(-${f(radius)},-${f(radius)},bottom)-o)/safeDirection,b=(vec3(${f(radius)},${f(radius)},${f(depth)})-o)/safeDirection;
  vec3 entry=min(a,b),leave=max(a,b);nearT=max(0.0,max(entry.x,max(entry.y,entry.z)));farT=min(leave.x,min(leave.y,leave.z));
  // Match the approved front profile at the contact boundary.
  if(uImpactSurface>.5)o.z-=.035;
 }
 `;
 material.fragmentShader=field+material.fragmentShader;
 patch(material,'fragmentShader','vec2 q=vUv*2.0-1.0;float t=uImpactProgress*2.0,r=dot(q,q);','vec3 o,d;float nearT,farT;volumeRay(o,d,nearT,farT);if(farT<=nearT)discard;float t=uImpactProgress*2.0;');
 patch(material,'fragmentShader','exp(-r*32.0)','lightIntegral(o,d,nearT,farT,32.0)');
 patch(material,'fragmentShader',`exp(-r*5.8*${f(preset.flash*preset.flash)})`,`lightIntegral(o,d,nearT,farT,${f(5.8*preset.flash*preset.flash)})`);
 material.fragmentShader=material.fragmentShader.replace('varying vec2 vUv;','');
 material.needsUpdate=true;
 return {dispose:()=>{glow.onBeforeRender=()=>{};geometry.dispose();}};
}
function removeCore(hit){
 const old=hit.geometry,positions=[],uvs=[],parts=[],indices=[],map=new Map();
 for(let i=0;i<old.attributes.aPart.count;i++)if(old.attributes.aPart.getX(i)>=.5){map.set(i,parts.length);positions.push(old.attributes.position.getX(i),old.attributes.position.getY(i),old.attributes.position.getZ(i));uvs.push(old.attributes.uv.getX(i),old.attributes.uv.getY(i));parts.push(old.attributes.aPart.getX(i));}
 for(let i=0;i<old.index.count;i+=3){const a=old.index.getX(i),b=old.index.getX(i+1),c=old.index.getX(i+2);if(map.has(a)&&map.has(b)&&map.has(c))indices.push(map.get(a),map.get(b),map.get(c));}
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geo.setAttribute('aPart',new T.Float32BufferAttribute(parts,1));geo.setIndex(indices);hit.geometry=geo;
 // Runtime owns the original geometry; this wrapper owns its replacement.
 return {dispose:()=>geo.dispose()};
}
function createLayers(level,shared,preset){
 const positions=[],uv=[],kind=[],ids=[],ix=[],groups=[];
 function surface(k,id,rows,sides){const start=kind.length;for(let j=0;j<=rows;j++)for(let c=0;c<=sides;c++){positions.push(0,0,0);uv.push(j/rows,c/sides);kind.push(k);ids.push(id);}for(let j=0;j<rows;j++)for(let c=0;c<sides;c++){const n=start+j*(sides+1)+c;ix.push(n,n+1,n+sides+1,n+1,n+sides+2,n+sides+1);}}
 surface(0,0,96,6);if(level>=2)for(let i=0;i<6;i++)surface(1,i,16,6);if(level>=3)for(let i=0;i<8;i++)surface(2,i,16,4);if(level>=4)for(let i=0;i<7;i++)surface(3,i,18,8);
 groups.push([0,ix.length,0]);let start=ix.length;if(level>=5)for(let i=0;i<5;i++)surface(4,i,1,1);groups.push([start,ix.length-start,1]);start=ix.length;if(level>=6)for(let i=0;i<(level===6?30:6);i++)surface(5,i,2,3);groups.push([start,ix.length-start,2]);
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('aKind',new T.Float32BufferAttribute(kind,1));g.setAttribute('aId',new T.Float32BufferAttribute(ids,1));g.setIndex(ix);for(const [start,count,mat] of groups)if(count)g.addGroup(start,count,mat);
 const uniforms={uHidden:{value:-1},uOnly:{value:-1},uProgress:shared.uImpactProgress,uSurface:shared.uImpactSurface,uNormal:shared.uImpactPlaneNormal,uSize:shared.uSize,uOrigin:shared.uLifeOrigin};
 let vertexShader=`attribute float aKind,aId;uniform float uProgress,uSize,uOrigin;uniform vec3 uNormal;varying vec2 vUv;varying float vKind,vId,vFade,vSurface;const float PI=3.14159265;
 void main(){float t=uProgress*2.0,h=uv.x,a=uv.y*PI*2.0,seed=fract(sin(aId*18.31+4.7)*4318.3);vec3 p;float fade=0.0;vUv=uv;vKind=aKind;vId=aId;
 if(aKind<.5){float age=clamp((t-.03)/.25,0.0,1.0),grow=1.0-pow(1.0-age,3.0),angle=h*PI*2.0;
 float radius=.25+grow*${f(1.25*preset.arc)},width=.075*(1.0-age);float ripple=sin(angle*7.0-age*13.0)*.025;
 p=vec3(.09+age*.5,cos(angle)*(radius+ripple),sin(angle)*(radius+ripple));p+=vec3(sin(a)*width*.55,cos(a)*cos(angle)*width,cos(a)*sin(angle)*width);
 fade=smoothstep(.03,.055,t)*(1.0-smoothstep(.13,.28,t));
 }else if(aKind<2.5){float begin=aKind<1.5?.02:.05+seed*.05,end=aKind<1.5?.22:.50+seed*.15;float age=max(0.0,t-begin);float angle=aId*2.39996+.43;vec3 ray=normalize(vec3(.38+seed*.4,cos(angle),sin(angle))),side=normalize(cross(ray,vec3(1,0,0))),up=cross(ray,side);float width;
 if(aKind<1.5){float grow=1.0-exp(-age*45.0);float reach=(1.25+seed*.8)*${f(preset.burst)}*grow;float travel=.1+age*1.6;p=vec3(travel,0,0)+ray*(h*reach);width=pow(max(0.0,sin(h*PI)),.8)*(.04+seed*.02)*(1.0-smoothstep(.09,.22,t));p+=side*sin(h*PI)*.10*sin(aId+age*12.0);}
 else{float distance=age*(4.0+seed*2.0)/(1.0+age*1.4),tail=.28+age*.5;float along=max(0.0,distance-tail*(1.0-h));p=vec3(.1,0,0)+ray*along+vec3(0,-age*age*.5,0);width=(.008+.021*pow(h,5.0))*smoothstep(0.0,.08,h);}
 p+=(side*cos(a)+up*sin(a))*width;fade=smoothstep(begin,begin+.015,t)*(1.0-smoothstep(end-.13,end,t));
 }else{float angle=aId*2.399963+.7;vec3 ray=normalize(vec3(.45+seed*.5,cos(angle),sin(angle))),side=normalize(cross(ray,vec3(1,0,0))),up=cross(ray,side);
 if(aKind<3.5){float age=max(0.0,t-.08),travel=.4+age*(3.2+seed*2.5)/(1.0+age);vec3 center=vec3(.12,0,0)+ray*travel;float radius=pow(max(0.0,sin(h*PI)),.7)*(.12+seed*.09)*(1.0+.25*sin(a*3.0+h*12.0+t*18.0));p=center+ray*((h-.3)*(.50+seed*.35))+side*sin(h*PI)*.18*sin(aId+t*10.0)+(side*cos(a)+up*sin(a))*radius;fade=smoothstep(.08,.12,t)*(1.0-smoothstep(.27+seed*.10,.55,t));}
 else if(aKind<4.5){float age=max(0.0,t-.13);vec3 center=vec3(.22,0,0)+ray*(.35+age*(1.0+seed*.7))+vec3(0,age*.85,0);float size=.55+age*1.4+seed*.25;vec4 mv=modelViewMatrix*vec4(center*uSize,1.0);mv.xy+=(uv*2.0-1.0)*size*uSize;vSurface=dot(center,uNormal);vFade=smoothstep(.13,.23,t)*(1.0-smoothstep(.58+seed*.1,1.05,t));gl_Position=projectionMatrix*mv;return;}
 else{float age=max(0.0,t-.06);vec3 center=vec3(.15,0,0)+ray*(.3+age*(2.2+seed*2.0))+vec3(0,-age*age*3.2,0);float spin=a+age*(7.0+seed*5.0),r=sin(h*PI)*(.14+seed*.09);p=center+ray*((h-.5)*(.35+seed*.3))+(side*cos(spin)+up*sin(spin))*r;fade=smoothstep(.06,.08,t)*(1.0-smoothstep(.55+seed*.10,.95,t));}
 }
 vFade=fade;vSurface=dot(p,uNormal);gl_Position=projectionMatrix*modelViewMatrix*vec4(p*uSize*(.35+.65*uOrigin),1.0);}`;
 let fragmentShader=`uniform float uProgress,uSurface,uOnly,uHidden;varying vec2 vUv;varying float vKind,vId,vFade,vSurface;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
 void main(){if(uHidden>=0.0&&abs(vKind-uHidden)<.1)discard;if(uOnly>=0.0&&abs(vKind-uOnly)>.1)discard;if(vFade<.002||(uSurface>.5&&vSurface<-.012))discard;float t=uProgress*2.0;float hot=pow(abs(sin(vUv.y*6.283185)),2.0);vec3 c=mix(vec3(1.0,.12,.015),vec3(1.0,.68,.13),hot);float alpha=vFade;
 if(vKind<.5){float tear=.5+.5*sin(vUv.x*62.83185+sin(vUv.x*25.13)*1.4);alpha*=1.0-smoothstep(.65,1.0,(t-.06)*5.0+tear*.55);}
 else if(vKind<1.5){c=mix(vec3(1.0,.24,.025),vec3(1.0,.95,.70),pow(1.0-vUv.x,1.5));alpha*=1.0-smoothstep(.8,1.0,vUv.x);}
 else if(vKind<2.5){c=mix(vec3(1.0,.18,.01),vec3(1.0,.98,.82),pow(vUv.x,5.0));alpha*=pow(vUv.x,1.4);}
 else if(vKind<3.5){float flow=noise(vec2(vUv.x*7.0-t*8.0,vUv.y*10.0+vId));float heat=sin(vUv.x*3.14159)*(.4+.6*hot)+flow*.25;c=mix(vec3(.95,.075,.005),vec3(1.0,.89,.42),smoothstep(.3,.9,heat));if(flow<.2+(1.0-vFade)*.5)discard;}
 else if(vKind<4.5){vec2 q=vUv*2.0-1.0;float n=noise(q*3.5+vec2(vId*4.0,-t*1.5)),n2=noise(q*7.0+vec2(t*.8,vId));float edge=length(q)+(n-.5)*.36;alpha*= (1.0-smoothstep(.42,.98,edge))*(.25+n*.35+n2*.15);c=mix(vec3(.065,.045,.035),vec3(.29,.23,.18),n*.65+(.5+.5*q.y)*.35);}
 else{float face=.3+.7*abs(sin(vUv.y*6.283185+vId));c=mix(vec3(.018,.014,.010),vec3(.11,.085,.060),face);c+=vec3(.3,.035,.002)*smoothstep(.82,.98,vUv.x)*pow(face,5.0)*(1.0-smoothstep(.12,.45,t));}
 if(alpha<.002)discard;gl_FragColor=vec4(c,alpha);
 #include <colorspace_fragment>
 }`;
 // Staging changes apply only to levels 7/8; earlier tiers retain their shaders.
 if(level>=6){
  const replace=(source,a,b)=>{if(source.split(a).length!==2)throw Error('Non-unique staging patch: '+a);return source.replace(a,b);};
  for(const [a,b] of [
   ['(t-.03)/.25','(t-.095)/.305'],
   ['smoothstep(.03,.055,t)*(1.0-smoothstep(.13,.28,t))','smoothstep(.095,.135,t)*(1.0-smoothstep(.24,.40,t))'],
   ['aKind<1.5?.02:.05+seed*.05,end=aKind<1.5?.22:.50+seed*.15','aKind<1.5?.075:.16+seed*.06,end=aKind<1.5?.28:.72+seed*.16'],
   ['smoothstep(.09,.22,t)','smoothstep(.16,.28,t)'],
   ['tail=.28+age*.5','tail=.52+age*.65'],
   ['float angle=aId*2.39996+.43','float angle=aId*2.39996+.43+(aKind>1.5?1.1:0.0)'],
   ['distance=age*(4.0+seed*2.0)/(1.0+age*1.4)','distance=.3+age*(9.0+seed*5.0)/(1.0+age*1.4)'],
   ['(.008+.021*pow(h,5.0))','(.012+.033*pow(h,5.0))'],
   ['float age=max(0.0,t-.08),travel=.4+age*(3.2+seed*2.5)/(1.0+age)','float begin=.20+seed*.07,age=max(0.0,t-begin),travel=1.45+age*(4.0+seed*2.5)/(1.0+age)'],
   ['(.12+seed*.09)','(.22+seed*.10)'],
   ['(.50+seed*.35)','(.70+seed*.40)'],
   ['smoothstep(.08,.12,t)*(1.0-smoothstep(.27+seed*.10,.55,t))','smoothstep(begin,begin+.065,t)*(1.0-smoothstep(.42+seed*.08,.78,t))'],
   ['float age=max(0.0,t-.13);vec3 center=vec3(.22,0,0)+ray*(.35+age*(1.0+seed*.7))+vec3(0,age*.85,0);float size=.55+age*1.4+seed*.25','float begin=.38+seed*.09,age=max(0.0,t-begin);vec3 center=vec3(.45,0,0)+ray*(1.45+age*(.8+seed*.6))+vec3(0,.55+age*1.2,0);float size=.42+age*.65+seed*.22'],
   ['smoothstep(.13,.23,t)*(1.0-smoothstep(.58+seed*.1,1.05,t))','smoothstep(begin,begin+.13,t)*(1.0-smoothstep(.96+seed*.08,1.4,t))'],
   ['float age=max(0.0,t-.06);vec3 center=vec3(.15,0,0)+ray*(.3+age*(2.2+seed*2.0))+vec3(0,-age*age*3.2,0)','float begin=.13+seed*.045,age=max(0.0,t-begin);vec3 center=vec3(.15,0,0)+ray*(.9+age*(3.5+seed*2.0))+vec3(0,.35+age*.9-age*age*3.2,0)'],
   ['(.14+seed*.09)','(.34+seed*.16)'],
   ['(.35+seed*.3)','(.55+seed*.35)'],
   ['smoothstep(.06,.08,t)*(1.0-smoothstep(.55+seed*.10,.95,t))','smoothstep(begin,begin+.035,t)*(1.0-smoothstep(.88+seed*.10,1.25,t))']
  ])vertexShader=replace(vertexShader,a,b);
  for(const [a,b] of [
   ['(t-.06)*5.0','(t-.14)*3.8'],
   ['vec3(1.0,.89,.42)','vec3(1.0,.55,.11)'],
   ['(.25+n*.35+n2*.15)','(.40+n*.40+n2*.15)'],
   ['vec3(.065,.045,.035),vec3(.29,.23,.18)','vec3(.12,.075,.045),vec3(.45,.33,.22)'],
   ['vec3(.018,.014,.010),vec3(.11,.085,.060)','vec3(.055,.040,.028),vec3(.46,.33,.21)'],
   ['vec3(.3,.035,.002)*smoothstep(.82,.98,vUv.x)','vec3(.65,.14,.015)*smoothstep(.74,.98,vUv.x)'],
   ['smoothstep(.12,.45,t)','smoothstep(.28,.78,t)']
  ])fragmentShader=replace(fragmentShader,a,b);
 }
 if(level>=6){
  const change=(a,b)=>{if(vertexShader.split(a).length!==2)throw Error('Non-unique impulse patch: '+a);vertexShader=vertexShader.replace(a,b);};
  change('aKind<1.5?.075:.16+seed*.06','aKind<1.5?0.0:.16+seed*.06');
  const begin=vertexShader.indexOf('if(aKind<1.5){float grow='),end=vertexShader.indexOf('else{float distance=',begin);
  if(begin<0||end<0)throw Error('Missing ray branch');
  vertexShader=vertexShader.slice(0,begin)+`if(aKind<1.5){float reach=(1.25+seed*.8)*${f(preset.burst)}*.70;float travel=.1+age*(9.0+seed*5.0);p=vec3(.1,0,0)+ray*(travel+h*reach);width=(.035+seed*.030)*sin(h*PI);}
 `+vertexShader.slice(end);
  change('fade=smoothstep(begin,begin+.015,t)*(1.0-smoothstep(end-.13,end,t))','fade=aKind<1.5?(1.0-smoothstep(.02,.10,t)):smoothstep(begin,begin+.015,t)*(1.0-smoothstep(end-.13,end,t))');
  const fragmentStart=vertexShader.indexOf('if(aKind<3.5){'),fragmentEnd=vertexShader.indexOf('else if(aKind<4.5)',fragmentStart);
  if(fragmentStart<0||fragmentEnd<0)throw Error('Missing fragment branch');
  vertexShader=vertexShader.slice(0,fragmentStart)+`if(aKind<3.5){float begin=.20+seed*.07,age=max(0.0,t-begin),travel=1.45+age*(7.0+seed*4.0)/(1.0+age);float tail=.8+seed*.65+age*.6;float along=max(0.0,travel-tail*(1.0-h));float width=(.010+.035*pow(h,6.0))*smoothstep(0.0,.12,h);p=vec3(.12,0,0)+ray*along+(side*cos(a)+up*sin(a))*width;fade=smoothstep(begin,begin+.025,t)*(1.0-smoothstep(.42+seed*.08,.78,t));}
 `+vertexShader.slice(fragmentEnd);
  uniforms.uDebrisSlope={value:0};uniforms.uDebrisForward={value:new T.Vector3(1,0,0)};uniforms.uDebrisSide={value:new T.Vector3(0,0,-1)};uniforms.uDebrisUp={value:new T.Vector3(0,1,0)};
  vertexShader='uniform float uDebrisSlope;uniform vec3 uDebrisForward,uDebrisSide,uDebrisUp;\n'+vertexShader;
  // Directions are world vectors transformed into hit-local space: parent scale
  // cannot rotate gravity, and horizontal impacts receive no artificial lift.
  change('vec3 center=vec3(.15,0,0)+ray*(.9+age*(3.5+seed*2.0))+vec3(0,.35+age*.9-age*age*3.2,0)',
   'float spread=(seed-.5)*1.1,drop=.05+seed*.06;float unitLength=sqrt(1.0+spread*spread+drop*drop-2.0*drop*uDebrisSlope);vec3 launch=(uDebrisForward+uDebrisSide*spread-uDebrisUp*drop)/unitLength;float speed=(4.4+seed*2.0)*2.5;vec3 center=uDebrisForward*.9+uDebrisSide*((seed-.5)*.45)-uDebrisUp*.08+launch*(age*speed)-uDebrisUp*(age*age*3.2)');
 }
 if(level>=6){
  const change=(a,b)=>{if(vertexShader.split(a).length!==2)throw Error('Non-unique spark timing patch: '+a);vertexShader=vertexShader.replace(a,b);};
  change('aKind<1.5?0.0:.16+seed*.06,end=aKind<1.5?.28:.72+seed*.16;float age=max(0.0,t-begin);','aKind<1.5?.05:(aId<.5?0.0:seed*.035),end=aKind<1.5?.35:.85+seed*.25;float age=aKind<1.5?max(t-.11,0.0)*(.10/.24):max(0.0,t-begin)*(.56+seed*.10)/(end-begin);');
  change('distance=.3+age*(9.0+seed*5.0)/(1.0+age*1.4)','distance=.3+1.25*age*(9.0+seed*5.0)/(1.0+age*1.4)');
  change('1.0-smoothstep(.02,.10,t)','step(.05,t)*(1.0-smoothstep(.11,.22,t))');
  change('1.0-smoothstep(end-.13,end,t)','1.0-smoothstep(.43+seed*.10,.56+seed*.10,age)');
  change(':smoothstep(begin,begin+.015,t)*(1.0-smoothstep(.43+seed*.10,.56+seed*.10,age))',':(aId<.5?step(begin,t):smoothstep(begin,begin+.015,t))*(1.0-smoothstep(.43+seed*.10,.56+seed*.10,age))');
  change('float begin=.20+seed*.07,age=max(0.0,t-begin),travel=1.45+age*(7.0+seed*4.0)/(1.0+age)','float begin=seed*.035,end=.85+seed*.25,age=max(0.0,t-begin)*(.58-seed*.07)/(end-begin),travel=1.45+1.25*age*(7.0+seed*4.0)/(1.0+age)');
  change('smoothstep(begin,begin+.025,t)*(1.0-smoothstep(.42+seed*.08,.78,t))','smoothstep(begin,begin+.015,t)*(1.0-smoothstep(.22+seed*.01,.58-seed*.07,age))');
 }
 if(level===6){
  // Fixed mean dimensions of the six pre-change rocks; size seed is independent of motion.
  const previous='r=sin(h*PI)*(.34+seed*.16);p=center+ray*((h-.5)*(.55+seed*.35))+(side*cos(spin)+up*sin(spin))*r;';
  const smaller='r=sin(h*PI)*0.4171958472;float sizeSeed=fract(sin(aId*47.17+19.73)*15731.743),rockScale=.1+.2*sizeSeed;p=center+(ray*((h-.5)*0.7188659157)+(side*cos(spin)+up*sin(spin))*r)*rockScale;';
  if(vertexShader.split(previous).length!==2)throw Error('Non-unique level7 debris size patch');
  vertexShader=vertexShader.replace(previous,smaller);
  const oldFan='float spread=(seed-.5)*1.1,drop=.05+seed*.06;';
  const newFan='float yawSeed=fract(sin(aId*31.71+8.13)*21731.17),pitchSeed=fract(sin(aId*63.19+2.47)*9371.63);float scatterBand=mod(aId,5.0);float spread=(yawSeed-.5)*(scatterBand<3.0?.90:1.75);float drop=scatterBand<3.0?(.035+.24*pitchSeed):(.24+.32*pitchSeed);';
  if(vertexShader.split(oldFan).length!==2)throw Error('Non-unique level7 debris fan patch');
  vertexShader=vertexShader.replace(oldFan,newFan);
  const oldLife='smoothstep(begin,begin+.035,t)*(1.0-smoothstep(.88+seed*.10,1.25,t))';
  if(vertexShader.split(oldLife).length!==2)throw Error('Non-unique level7 debris lifetime patch');
  vertexShader=vertexShader.replace(oldLife,'smoothstep(0.0,.035,age)*(1.0-smoothstep(.35,.65,age))');
 }
 const materials=[T.AdditiveBlending,T.NormalBlending,T.NormalBlending].map(blending=>new T.ShaderMaterial({uniforms,vertexShader,fragmentShader,transparent:true,depthWrite:false,side:T.DoubleSide,forceSinglePass:true,blending}));
 if(level>=6)for(const m of materials.slice(1))m.userData.previewNonEmissive=true;
 const mesh=new T.Mesh(g,materials);mesh.name='preview-added-impact-layers';mesh.frustumCulled=false;mesh.renderOrder=6;return mesh;
}

return upgrade();
}

function attachFireballGlow(T,fx){
 fx.group.userData.fireballGlow=true;
 const pipelines=new Map();let dead=false;
 function create(renderer){
  let W=1,H=1;const resources=[];
  const packedGlow=renderer.extensions.has('EXT_color_buffer_float');
  function target(w,h,depthBuffer=false,packed=packedGlow){const r=new T.WebGLRenderTarget(w,h,{type:packed?T.UnsignedInt101111Type:T.HalfFloatType,format:packed?T.RGBFormat:T.RGBAFormat,depthBuffer});r.texture.colorSpace=T.LinearSRGBColorSpace;resources.push(r);return r;}
  const base=target(1,1,true,false),emission=target(1,1,true),blurs=[0,1,2].map(()=>[target(1,1),target(1,1)]);
  const screenScene=new T.Scene(),screenCamera=new T.OrthographicCamera(-1,1,1,-1,0,1),quad=new T.Mesh(new T.PlaneGeometry(2,2));quad.frustumCulled=false;screenScene.add(quad);resources.push(quad.geometry);
const vertex='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0,1);}';
function material(fragment,uniforms){const m=new T.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,uniforms,depthTest:false,depthWrite:false});resources.push(m);return m;}
const blurMaterial=material(`uniform sampler2D source;uniform vec2 stepSize,prefilter;uniform float extractLight;varying vec2 vUv;
vec3 lightAt(vec2 uv){vec3 c=texture2D(source,uv).rgb;float l=max(c.r,max(c.g,c.b));return c*mix(1.0,smoothstep(.12,.55,l),extractLight);}
vec3 sampleGlow(vec2 uv){if(prefilter.x==0.0)return lightAt(uv);return (lightAt(uv+prefilter*vec2(-.5,-.5))+lightAt(uv+prefilter*vec2(.5,-.5))+lightAt(uv+prefilter*vec2(-.5,.5))+lightAt(uv+prefilter*vec2(.5,.5)))*.25;}
void main(){vec3 c=sampleGlow(vUv)*.227027;c+=(sampleGlow(vUv+stepSize*1.384615)+sampleGlow(vUv-stepSize*1.384615))*.316216;c+=(sampleGlow(vUv+stepSize*3.230769)+sampleGlow(vUv-stepSize*3.230769))*.070270;gl_FragColor=vec4(c,1.0);}`,{extractLight:{value:0},source:{value:null},stepSize:{value:new T.Vector2()},prefilter:{value:new T.Vector2()}});

const composite=material(`uniform sampler2D baseImage,tightGlow,mediumGlow,wideGlow;uniform vec3 weights;varying vec2 vUv;
void main(){vec3 c=texture2D(baseImage,vUv).rgb+texture2D(tightGlow,vUv).rgb*weights.x+texture2D(mediumGlow,vUv).rgb*weights.y+texture2D(wideGlow,vUv).rgb*weights.z;gl_FragColor=vec4(max(c,vec3(0.0)),1.0);
#include <colorspace_fragment>
}`,{baseImage:{value:base.texture},tightGlow:{value:blurs[0][1].texture},mediumGlow:{value:blurs[1][1].texture},wideGlow:{value:blurs[2][1].texture},weights:{value:new T.Vector3()}});

  // Fire Ball-specific level 2, matching the frozen five-level calibration.
  composite.uniforms.weights.value.set(.6,.24,.06);
  const black=new T.MeshBasicMaterial({color:0,side:T.DoubleSide});resources.push(black);
  const size=new T.Vector2(),viewport=new T.Vector4(),scissor=new T.Vector4(),clear=new T.Color();
  const originals=[],hidden=[],bloom=[];
  function pass(m,rt){quad.material=m;renderer.setRenderTarget(rt);renderer.render(screenScene,screenCamera);}
  function resize(w,h){if(w===W&&h===H)return;W=w;H=h;base.setSize(w,h);emission.setSize(Math.max(1,w>>1),Math.max(1,h>>1));for(let i=0;i<3;i++){const bw=Math.max(1,Math.round(w/(3*2**i))),bh=Math.max(1,Math.round(h/(3*2**i)));for(const t of blurs[i])t.setSize(bw,bh);}}
  return {render(scene,camera){
   const output=renderer.getRenderTarget(),face=renderer.getActiveCubeFace(),mip=renderer.getActiveMipmapLevel();renderer.getDrawingBufferSize(size);resize(output?.width??size.x,output?.height??size.y);
   renderer.getViewport(viewport);renderer.getScissor(scissor);renderer.getClearColor(clear);const alpha=renderer.getClearAlpha(),scissorTest=renderer.getScissorTest(),auto=renderer.autoClear,xr=renderer.xr.enabled,tone=renderer.toneMapping,colorSpace=renderer.outputColorSpace,bg=scene.background;
   originals.length=hidden.length=bloom.length=0;
   const restoreMaterials=()=>{for(const [o,m] of originals)o.material=m;for(let i=hidden.length-1;i>=0;i--){const [o,v]=hidden[i];o.visible=v;}for(let i=bloom.length-1;i>=0;i--){const [u,v]=bloom[i];u.value=v;}scene.background=bg;};
   try{
    renderer.xr.enabled=false;renderer.autoClear=true;renderer.setScissorTest(false);renderer.toneMapping=T.NoToneMapping;renderer.outputColorSpace=T.SRGBColorSpace;
    renderer.setRenderTarget(base);renderer.render(scene,camera);
    scene.traverse(o=>{let owned=false;for(let parent=o;parent;parent=parent.parent)if(parent.userData.fireballGlow){owned=true;break;}
     if(owned){for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[]){if(m.userData?.previewNonEmissive){hidden.push([m,m.visible]);m.visible=false;}const u=m.uniforms?.uPreviewBloomPass;if(u){bloom.push([u,u.value]);u.value=1;}}}
     else if(o.isMesh){originals.push([o,o.material]);o.material=black;}
     else if(o.isLine||o.isPoints||o.isSprite){hidden.push([o,o.visible]);o.visible=false;}
    });
    scene.background=null;renderer.setClearColor(0,1);renderer.setRenderTarget(emission);renderer.render(scene,camera);restoreMaterials();
    let source=emission.texture,sw=emission.width,sh=emission.height;
    for(const [h,v] of blurs){blurMaterial.uniforms.extractLight.value=source===emission.texture?1:0;blurMaterial.uniforms.source.value=source;blurMaterial.uniforms.prefilter.value.set(1/sw,1/sh);blurMaterial.uniforms.stepSize.value.set(1/h.width,0);pass(blurMaterial,h);blurMaterial.uniforms.extractLight.value=0;blurMaterial.uniforms.source.value=h.texture;blurMaterial.uniforms.prefilter.value.set(0,0);blurMaterial.uniforms.stepSize.value.set(0,1/v.height);pass(blurMaterial,v);source=v.texture;sw=v.width;sh=v.height;}
    renderer.setRenderTarget(output,face,mip);renderer.setViewport(output?output.viewport:viewport);renderer.setScissor(output?output.scissor:scissor);renderer.setScissorTest(output?output.scissorTest:scissorTest);quad.material=composite;renderer.render(screenScene,screenCamera);
   }finally{restoreMaterials();renderer.setRenderTarget(null);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);renderer.setClearColor(clear,alpha);renderer.autoClear=auto;renderer.xr.enabled=xr;renderer.toneMapping=tone;renderer.outputColorSpace=colorSpace;renderer.setRenderTarget(output,face,mip);}
  },dispose(){for(const resource of resources)resource.dispose();}};
 }
 fx.render=(renderer,scene,camera)=>{if(dead)return;let p=pipelines.get(renderer);if(!p){p=create(renderer);pipelines.set(renderer,p);}p.render(scene,camera);};
 const dispose=fx.dispose.bind(fx);fx.dispose=()=>{if(dead)return;dead=true;for(const p of pipelines.values())p.dispose();pipelines.clear();dispose();};
}

// Rotate the authored heat palette with the user's hue; default orange is unchanged.
function applyFireballPalette(fx){
 const hit=fx.group.getObjectByName('lifecycle-impact'),extra=fx.group.getObjectByName('preview-added-impact-layers');
 const colors=['1.0,.68,.16','1.0,.96,.76','1.0,.48,.12','1.0,.68,.18','.40,.10,.03','1.0,.56,.10','1.0,.86,.40','1.0,.90,.55','.32,.008,.001','1.0,.19,.015','1.0,.63,.12','1.0,.94,.73','1.0,.12,.015','1.0,.68,.13','1.0,.24,.025','1.0,.95,.70','1.0,.18,.01','1.0,.98,.82','.95,.075,.005','1.0,.55,.11','.65,.14,.015'];
 const Color=hit.material.uniforms.uColor.value.constructor,reference=new Color('#ff823e').getHSL({}),current={};
 const palette=colors.map(rgb=>{const source=new Color().setRGB(...rgb.split(',').map(Number));return {source,hsl:source.getHSL({}),uniform:{value:source.clone()}};});
 function sync(){hit.material.uniforms.uColor.value.getHSL(current);const delta=current.h-reference.h,saturation=reference.s>0?current.s/reference.s:0;for(const p of palette){if(Math.abs(delta)<1e-9&&Math.abs(saturation-1)<1e-9)p.uniform.value.copy(p.source);else p.uniform.value.setHSL(p.hsl.h+delta,Math.min(1,p.hsl.s*saturation),p.hsl.l);}}
 for(const object of [hit,fx.group.getObjectByName('lifecycle-impact-wisps'),fx.group.getObjectByName('lifecycle-contact-glow'),extra])for(const m of Array.isArray(object.material)?object.material:[object.material]){
  m.uniforms.uColor=hit.material.uniforms.uColor;let shader=m.fragmentShader;
  for(let i=0;i<colors.length;i++){const token='vec3('+colors[i]+')';if(shader.includes(token)){const name='uFirePalette'+i;m.uniforms[name]=palette[i].uniform;shader='uniform vec3 '+name+';\n'+shader.split(token).join(name);}}
  m.fragmentShader=shader;m.needsUpdate=true;
 }
 const setOptions=fx.setOptions.bind(fx);fx.setOptions=(...args)=>{const result=setOptions(...args);sync();return result;};sync();
}

// Shared website/download asset. +Y up, XZ ground; all authored dimensions are local units.
// H=3, impact=1.35, healing pulses=3.35+2n (n=0..4), each 1.6s, finished=13.
function createSacredRelicEffect(T, spec, options = {}) {
  const group=new T.Group(),root=new T.Group(),body=new T.Group();
  group.name=spec.id;root.name='relic-vfx-root';body.name='sacred-relic-body';group.add(root);root.add(body);
  const geometries=new Set(),materials=new Set();
  let time=0,stopTime=-1,disposed=false,settings;
  const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
  const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
  const u={uTime:{value:0},uEmitTime:{value:0},uImpactAge:{value:-1},uPulseAge:{value:-1},uRadius:{value:0},uMaxRadius:{value:9},uCancel:{value:1},uBodyFade:{value:0},uSize:{value:1},uDetail:{value:1},uLightGain:{value:5},uSmokeThickness:{value:5},uColor:{value:new T.Color()}};
  const uniforms='uniform float uTime,uEmitTime,uImpactAge,uPulseAge,uRadius,uMaxRadius,uCancel,uBodyFade,uSize,uDetail,uLightGain,uSmokeThickness;uniform vec3 uColor;';
  const output='\n#include <colorspace_fragment>\n';
  // Authoring gain is linear light: additive premultiplication retains the hollow center.
  const magicOutput='gl_FragColor.rgb*=gl_FragColor.a*uLightGain;gl_FragColor.a=0.;'+output;
  // Smoke overlaps many sprites: premultiply after display conversion so feathered
  // low-density edges do not each acquire a separate gamma boost and turn solid white.
  const smokeOutput='gl_FragColor.rgb*=uLightGain;'+output+'gl_FragColor.rgb*=gl_FragColor.a;gl_FragColor.a=0.;';
  // Continuous world-plane caustic ribbons; advection follows radial propagation.
  const waterGLSL=`float relicWater(vec2 p,float t){float r=length(p);vec2 q=p*3.7; q+=vec2(sin(q.y*.8-t*2.4),sin(q.x*.7+t*1.8))*.5;float w=sin(q.x+sin(q.y*.7-t*2.))+sin(q.y+sin(q.x*.8+t*1.4));float veins=1.-smoothstep(.06,.30+fwidth(w),abs(w));float ripple=.5+.5*sin(r*18.-t*14.+sin(q.x+q.y)*1.7);return clamp(veins*.78+pow(ripple,5.)*.35,0.,1.);}`;
  const planeVertex='varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }';
  function mesh(name,g,vertex,fragment,parent=root){
    const m=new T.ShaderMaterial({uniforms:{...u},vertexShader:uniforms+vertex,fragmentShader:uniforms+fragment,transparent:true,depthWrite:false,side:T.DoubleSide,forceSinglePass:true,toneMapped:false});
    if(['relic-sigil','relic-impact','relic-healing-wave','relic-healing-echo','relic-magic-smoke-ring'].includes(name)){m.blending=T.CustomBlending;m.blendSrc=T.OneFactor;m.blendDst=T.OneFactor;m.blendSrcAlpha=T.ZeroFactor;m.blendDstAlpha=T.OneFactor;}
    geometries.add(g);materials.add(m);const o=new T.Mesh(g,m);o.name=name;o.frustumCulled=false;parent.add(o);return o;
  }
  function floor(name,width,fragment,y=.02){const o=mesh(name,new T.PlaneGeometry(width,width),planeVertex,fragment);o.rotation.x=-Math.PI/2;o.position.y=y;return o;}
  // Closed triangular pyramid: equilateral top, three side faces and one downward tip.
  // Baked facet shading keeps the white/gold solid readable without host-scene lights.
  const gold=new T.MeshBasicMaterial({color:0xe2b45a,transparent:true,vertexColors:true}),white=new T.MeshBasicMaterial({color:0xfff7e6,transparent:true,vertexColors:true});materials.add(gold);materials.add(white);
  // Cut the built-in solid at the effect's local ground, including grid-only previews.
  const burialDepth={value:0};
  for(const material of [gold,white]){
    material.onBeforeCompile=shader=>{
      shader.uniforms.uRelicBurialDepth=burialDepth;
      shader.vertexShader='varying float vRelicHeight;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvRelicHeight=position.y;');
      shader.fragmentShader='varying float vRelicHeight;uniform float uRelicBurialDepth;\n'+shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(vRelicHeight<uRelicBurialDepth)discard;');
    };
    material.customProgramCacheKey=()=> 'sacred-relic-local-ground-cut-v1';
  }
  const vertices=[new T.Vector3(0,0,0),new T.Vector3(0,3,1.1316),new T.Vector3(-.98,3,-.5658),new T.Vector3(.98,3,-.5658)];
  const center=new T.Vector3(0,2.25,0),light=new T.Vector3(-.6,1,1).normalize();
  const shellPositions=[],panelPositions=[],shellColors=[],panelColors=[];
  for(const indices of [[0,1,2],[0,2,3],[0,3,1],[1,3,2]]){
    let [a,b,c]=indices.map(i=>vertices[i]);
    const normal=new T.Vector3().crossVectors(b.clone().sub(a),c.clone().sub(a)).normalize();
    if(normal.dot(a.clone().add(b).add(c).multiplyScalar(1/3).sub(center))<0){[b,c]=[c,b];normal.negate();}
    const ab=a.distanceTo(b),bc=b.distanceTo(c),ca=c.distanceTo(a),perimeter=ab+bc+ca;
    const incenter=a.clone().multiplyScalar(bc).addScaledVector(b,ca).addScaledVector(c,ab).multiplyScalar(1/perimeter);
    const inradius=new T.Vector3().crossVectors(b.clone().sub(a),c.clone().sub(a)).length()/perimeter;
    const insetScale=1-.055/inradius,shade=.65+.35*Math.max(0,normal.dot(light));
    for(const v of [a,b,c]){
      shellPositions.push(...v.toArray());shellColors.push(shade,shade,shade);
      const inset=v.clone().sub(incenter).multiplyScalar(insetScale).add(incenter).addScaledVector(normal,.002);
      panelPositions.push(...inset.toArray());panelColors.push(shade,shade,shade);
    }
  }
  for(const [name,positions,colors,material]of [['relic-triangle-border',shellPositions,shellColors,gold],['relic-triangle-face',panelPositions,panelColors,white]]){
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();geometries.add(geometry);
    const solid=new T.Mesh(geometry,material);solid.name=name;body.add(solid);
  }
  const trail=mesh('relic-descent-trail',new T.PlaneGeometry(1.25,6),planeVertex,`varying vec2 vUv;void main(){float x=vUv.x*2.-1.;float streak=exp(-x*x*32.)+.24*exp(-pow((abs(x)-.36)*22.,2.));float a=streak*pow(1.-vUv.y,2.)*smoothstep(1.,1.08,uTime)*(1.-smoothstep(1.35,1.48,uTime))*uCancel;gl_FragColor=vec4(mix(uColor,vec3(1.),.55),a*.65);${output}}`,body);trail.position.set(0,5.25,-.09);
  // Five independently readable layers on one ground plane. Angles are sampled from
  // the shared visual clock; clockwise means clockwise when viewed from +Y.
  const sigil=floor('relic-sigil',4.9,`
    varying vec2 vUv;
    const float PI=3.141592654,TAU=6.283185307;
    vec2 turn(vec2 p,float a){float c=cos(a),s=sin(a);return vec2(c*p.x-s*p.y,s*p.x+c*p.y);}
    float segment(vec2 p,vec2 a,vec2 b){vec2 v=b-a;return length(p-a-v*clamp(dot(p-a,v)/max(dot(v,v),.000001),0.,1.));}
    float trace(vec2 p,vec2 a,vec2 b,float progress){return segment(p,a,mix(a,b,clamp(progress,0.,1.)));}
    float ink(float d,float w,float pixel){return 1.-smoothstep(w,w+pixel,d);}
    float stroke(float d,float w,float pixel){return ink(d,w,pixel)+.09*exp(-d*d/.00005);}
    vec2 polar(float a,float r){return vec2(cos(a),sin(a))*r;}
    float glyph(vec2 q,float id){
      float k=mod(id,8.);
      float d=segment(q,vec2(-.15,-.72),vec2(-.15,.72));
      if(k<1.){d=min(d,segment(q,vec2(-.15,.65),vec2(.60,.26)));d=min(d,segment(q,vec2(.60,.26),vec2(-.15,-.05)));d=min(d,segment(q,vec2(-.52,-.25),vec2(.4,-.25)));}
      else if(k<2.){d=min(d,segment(q,vec2(-.6,.35),vec2(.55,.35)));d=min(d,segment(q,vec2(.55,.35),vec2(.2,-.55)));d=min(d,segment(q,vec2(-.6,-.4),vec2(.2,-.55)));}
      else if(k<3.){d=min(d,segment(q,vec2(-.65,.5),vec2(.5,-.45)));d=min(d,segment(q,vec2(-.65,-.45),vec2(.5,.5)));}
      else if(k<4.){d=min(d,abs(length(q-vec2(.13,.25))-.43));d=min(d,segment(q,vec2(-.55,-.6),vec2(.50,-.6)));}
      else if(k<5.){d=min(d,segment(q,vec2(-.6,.6),vec2(.5,.6)));d=min(d,segment(q,vec2(.5,.6),vec2(.5,-.1)));d=min(d,segment(q,vec2(-.15,-.1),vec2(.5,-.1)));}
      else if(k<6.){d=min(d,segment(q,vec2(-.62,.15),vec2(.52,-.3)));d=min(d,segment(q,vec2(.52,-.3),vec2(.52,.65)));d=min(d,length(q-vec2(-.52,-.6))-.08);}
      else if(k<7.){d=min(d,segment(q,vec2(-.62,.25),vec2(.10,.7)));d=min(d,segment(q,vec2(.10,.7),vec2(.62,.25)));d=min(d,segment(q,vec2(-.55,-.35),vec2(.5,-.35)));}
      else{d=min(d,abs(length(q-vec2(0.,-.15))-.48));d=min(d,segment(q,vec2(-.5,.65),vec2(.5,.65)));}
      return max(0.,d);
    }
    float emblem(vec2 q,float id){
      float r=length(q),a=atan(q.y,q.x),d=10.;
      if(id<.5){ // sun: open center and twelve detached rays
        d=abs(r-.38);float t=mod(a+PI/12.,TAU/12.)-PI/12.;vec2 v=vec2(cos(t),sin(t))*r;
        d=min(d,segment(v,vec2(.53,0.),vec2(.87,0.)));
      }else if(id<1.5){ // eight-point light star
        float t=mod(a+PI/8.,TAU/8.)-PI/8.;vec2 v=polar(abs(t),r);
        d=segment(v,vec2(.96,0.),polar(PI/8.,.34));
        d=min(d,abs(r-.18));
      }else if(id<2.5){ // luminous drop, with an open inner highlight
        d=min(segment(q,vec2(0.,.95),vec2(-.46,-.08)),segment(q,vec2(0.,.95),vec2(.46,-.08)));
        if(q.y<-.08)d=min(d,abs(length(q-vec2(0.,-.08))-.46));
        d=min(d,segment(q,vec2(-.14,-.05),vec2(-.14,-.31)));
      }else{ // sprout: stem and two pointed leaves
        d=segment(q,vec2(0.,-.85),vec2(0.,.38));
        d=min(d,segment(q,vec2(0.,-.02),vec2(-.65,.18)));
        d=min(d,segment(q,vec2(-.65,.18),vec2(-.72,.68)));
        d=min(d,segment(q,vec2(-.72,.68),vec2(-.16,.5)));
        d=min(d,segment(q,vec2(-.16,.5),vec2(0.,-.02)));
        d=min(d,segment(q,vec2(0.,.22),vec2(.66,.38)));
        d=min(d,segment(q,vec2(.66,.38),vec2(.72,.86)));
        d=min(d,segment(q,vec2(.72,.86),vec2(.16,.7)));
        d=min(d,segment(q,vec2(.16,.7),vec2(0.,.22)));
      }
      return d;
    }
    void main(){
      vec2 p=vUv*2.-1.;float r=length(p),a=atan(p.y,p.x);
      float pixel=max(length(fwidth(p))*.65,.00035),time=uTime;
      float fine=(1.-smoothstep(.006,.025,pixel))*min(uDetail,1.);
      float extra=clamp(uDetail-1.,0.,1.);
      float form=smoothstep(0.,.3,time),sweep=smoothstep(-.025,.025,form*TAU-mod(a+PI*.5+TAU,TAU))*step(.0001,form);
      float frameD=min(abs(r-.94),abs(r-.905));
      float frame=stroke(frameD,.0022,pixel)*sweep;
      float tickAngle=mod(a+PI/72.,TAU/72.)-PI/72.;vec2 tick=polar(tickAngle,r);
      frame=max(frame,ink(segment(tick,vec2(.915,0.),vec2(.929,0.)),.0012,pixel)*fine*sweep*.60);
      // Coordinates rotate opposite the pattern: outer clockwise +4 deg/s,
      // inner counterclockwise -6, web clockwise +2, badges counterclockwise -3.
      vec2 op=turn(p,time*PI/45.);float oa=mod(atan(op.y,op.x)+TAU,TAU),slot=floor(oa/(TAU/48.)+.5);
      float localAngle=mod(oa+PI/48.,TAU/48.)-PI/48.;vec2 oq=vec2(sin(localAngle)*r,cos(localAngle)*r-.846);
      float outerD;
      if(mod(slot,4.)<.5){outerD=min(abs(length(oq)-.026),emblem(oq/.019,mod(floor(slot/4.),4.))*.019);}
      else{outerD=glyph(oq/vec2(.023,.035),slot+floor(slot/4.))*.023;}
      float outerReveal=smoothstep(.15+slot/48.*.42,.30+slot/48.*.45,time);
      float outer=stroke(outerD,.00125,pixel)*outerReveal*fine;
      outer=max(outer,ink(min(abs(r-.793),abs(r-.891)),.0014,pixel)*smoothstep(.15,.65,time)*.55);
      vec2 ip=turn(p,-time*PI/30.);float ia=mod(atan(ip.y,ip.x)+TAU,TAU),islot=floor(ia/(TAU/32.)+.5);
      float ilocal=mod(ia+PI/32.,TAU/32.)-PI/32.;vec2 iq=vec2(sin(ilocal)*r,cos(ilocal)*r-.508);
      float innerReveal=smoothstep(.20+islot/32.*.35,.35+islot/32.*.40,time);
      float inner=stroke(glyph(iq/vec2(.021,.028),islot*3.+2.)*.021,.0012,pixel)*fine*innerReveal;
      inner=max(inner,ink(min(abs(r-.464),abs(r-.552)),.0015,pixel)*smoothstep(.15,.70,time)*.65);
      vec2 bp=turn(p,-time*PI/60.);float ba=atan(bp.y,bp.x),bid=mod(floor((ba+PI*.25)/(PI*.5))+4.,4.);
      vec2 bq=turn(bp,-bid*PI*.5)-vec2(.637,0.);float br=length(bq);
      float badgeReveal=smoothstep(.55+bid*.055,.82+bid*.06,time);
      float badgeD=min(abs(br-.106),abs(br-.088));
      float badge=stroke(badgeD,.0022,pixel);
      badge=max(badge,stroke(emblem(vec2(-bq.y,bq.x)/.071,bid)*.071,.0017,pixel));
      badge*=badgeReveal;
      float clearance=smoothstep(.108,.118,br); // only removes other sigil lines, never the ground
      vec2 gp=turn(p,time*PI/90.);float webD=10.;
      for(int i=0;i<12;i++){
        float fi=float(i),theta=fi*TAU/12.;vec2 v=polar(theta,.774);
        float grow=clamp((time-(.15+fi*.018))/.36,0.,1.);
        webD=min(webD,trace(gp,v,polar(theta+TAU/12.,.774),grow));
        webD=min(webD,trace(gp,v,polar(theta+TAU*4./12.,.774),grow));
        webD=min(webD,trace(gp,v,polar(theta+TAU*5./12.,.774),grow));
      }
      float web=stroke(webD,.00095,pixel)*smoothstep(.15,.22,time)*smoothstep(.39,.41,r)*fine*(1.-smoothstep(.451,.464,r)*(1.-smoothstep(.552,.565,r)));
      // Central diamonds and concentric sun remain anchored to the contact point.
      float coreD=min(abs(r-.397),min(abs(r-.34),abs(r-.178)));
      float diamond=abs(abs(p.x)+abs(p.y)-.31)*.7071;
      vec2 cp=turn(p,PI*.25);diamond=min(diamond,abs(abs(cp.x)+abs(cp.y)-.31)*.7071);
      coreD=min(coreD,diamond);
      coreD=min(coreD,emblem(p/.115,0.)*.115);
      float core=stroke(coreD,.0018,pixel)*sweep;
      float pulse=1.+.25*smoothstep(0.,.08,uPulseAge)*(1.-smoothstep(.08,.35,uPulseAge));
      float fade=(1.-smoothstep(11.35,12.2,time))*uCancel;
      float sustain=mix(1.,.44,smoothstep(1.4,2.9,time));
      float major=max(frame*.34,max(core*.32*pulse,badge*.40*pulse));
      float minor=max(outer*.30,inner*.27)*pulse;
      float alpha=max(major,max(minor,web*(.115+extra*.04))*clearance)*fade*sustain;
      vec3 color=mix(uColor,vec3(1.,.985,.92),clamp(max(core,badge)*.55,0.,.55));
      gl_FragColor=vec4(color,alpha);${magicOutput}
    }`);
  const impact=floor('relic-impact',10,`${waterGLSL}varying vec2 vUv;void main(){float age=max(0.,uImpactAge);vec2 p=(vUv*2.-1.)*5.;float r=length(p),a=atan(p.y,p.x);float front=.1+4.4*(1.-pow(1.-clamp(age/.65,0.,1.),3.));float ring=exp(-pow((r-front)/.11,2.))*(1.-smoothstep(.3,.65,age));float water=relicWater(p,age);ring*=mix(1.,.12+.88*water,clamp(uDetail,0.,1.));float wake=exp(-pow((r-front+.22)/.24,2.))*(1.-smoothstep(.25,.65,age))*water*.24;for(int j=1;j<5;j++){float k=float(j);float behind=front*(1.-k*.11);float pressure=exp(-pow((r-behind)/(.055+k*.016),2.));wake+=pressure*(.23-k*.027)*(.22+.78*relicWater(p,age-k*.018))*(1.-smoothstep(.22,.65,age))*smoothstep(.015,.07,age);}float peak=smoothstep(0.,.045,age)*(1.-smoothstep(.08,.2,age));float flash=exp(-r*r*3.5)*peak;float rays=pow(max(0.,cos(a*9.+.7)),18.)*exp(-r*1.7)*peak;float valid=step(0.,uImpactAge);gl_FragColor=vec4(mix(uColor,vec3(1.),clamp(flash+rays,0.,1.)),(ring*.8+wake+flash+rays)*valid*uCancel);${magicOutput}}`,.045);
  // A tessellated radial strip gives the wave a real low crest; empty center costs no full-screen plane.
  const waveVertex=`varying vec2 vUv;varying float vClip;void main(){vUv=uv;float age=max(0.,uPulseAge),p=clamp(age/1.6,0.,1.),a=uv.x*6.283185;float width=mix(1.2,.6,p);float r=uRadius-(1.-uv.y)*width;vClip=smoothstep(0.,.15,r);float ripple=(sin(a*11.-age*6.)+sin(a*19.+age*4.))*.018;float crest=pow(max(0.,sin(uv.y*3.141593)),1.7)*.36*(1.-p*.6);vec3 q=vec3(cos(a)*(max(0.,r)+ripple),.055+crest,sin(a)*(max(0.,r)+ripple));gl_Position=projectionMatrix*modelViewMatrix*vec4(q,1.);}`;
  const wave=mesh('relic-healing-wave',new T.PlaneGeometry(1,1,160,16),waveVertex,`${waterGLSL}varying vec2 vUv;varying float vClip;void main(){float t=max(0.,uPulseAge),p=t/1.6,x=vUv.x*6.283185,y=vUv.y;float fade=smoothstep(0.,.075,t)*(1.-smoothstep(1.05,1.6,t))*step(0.,uPulseAge);float edge=exp(-pow((y-.76)/.11,2.));float body=pow(max(0.,sin(y*3.141593)),.8);float feather=smoothstep(0.,.32,y)*(1.-smoothstep(.64,1.,y));float flow=pow(.5+.5*sin(y*32.-t*10.+sin(x*13.-t*3.)*.55),6.)*.13*uDetail;float breakup=.88+.12*sin(x*23.-t*5.);vec2 wp=vec2(cos(x),sin(x))*(uRadius-(1.-y)*mix(1.2,.6,p));float water=relicWater(wp,t);float liquid=mix(1.,.10+.90*water,clamp(uDetail,0.,1.));float alpha=(body*(.29+flow)*liquid+edge*.62*(.28+.72*water))*pow(feather,1.6)*fade*vClip*breakup*uCancel;vec3 color=mix(uColor,vec3(1.,.99,.91),edge*.9);gl_FragColor=vec4(color,alpha);${magicOutput}}`);
  const echo=mesh('relic-healing-echo',new T.PlaneGeometry(1,1,128,4),`varying vec2 vUv;void main(){vUv=uv;float a=uv.x*6.283185;float r=max(0.,uRadius*.81-(1.-uv.y)*.38);gl_Position=projectionMatrix*modelViewMatrix*vec4(cos(a)*r,.035,sin(a)*r,1.);}`,`${waterGLSL}varying vec2 vUv;void main(){float theta=vUv.x*6.283185;float water=relicWater(vec2(cos(theta),sin(theta))*(uRadius*.81-(1.-vUv.y)*.38),uPulseAge);float a=pow(max(0.,sin(vUv.y*3.14159)),3.)*smoothstep(0.,.24,vUv.y)*(1.-smoothstep(.72,1.,vUv.y))*smoothstep(.1,.3,uPulseAge)*(1.-smoothstep(.8,1.55,uPulseAge))*.23;gl_FragColor=vec4(uColor,a*uCancel*mix(1.,.18+.82*water,clamp(uDetail,0.,1.)));${magicOutput}}`);
  
  // Stable seeded geometry; changing density never changes the impact or five authored pulses.
  let seed=spec.seed>>>0;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
  function instances(count,streamCount=count){const base=new T.PlaneGeometry(1,1),g=new T.InstancedBufferGeometry();g.setIndex(base.index.clone());for(const k of Object.keys(base.attributes))g.setAttribute(k,base.attributes[k].clone());base.dispose();const seeds=new Float32Array(count*4);let followingSeed=seed;for(let i=0;i<seeds.length;i++){seeds[i]=random();if(i===streamCount*4-1)followingSeed=seed;}seed=followingSeed;g.setAttribute('aSeed',new T.InstancedBufferAttribute(seeds,4));return g;}
  const crackPositions=[],crackUvs=[];
  function fissure(x1,z1,x2,z2,w,progress){const dx=x2-x1,dz=z2-z1,length=Math.hypot(dx,dz),nx=-dz/length*w,nz=dx/length*w;
    const v=[[x1+nx,.025,z1+nz],[x1-nx,.025,z1-nz],[x2-nx*.55,.025,z2-nz*.55],[x2+nx*.55,.025,z2+nz*.55]];
    for(const i of [0,1,2,0,2,3]){crackPositions.push(...v[i]);crackUvs.push(i===0||i===3?0:1,progress+(i>=2?.15:0));}}
  for(let i=0;i<13;i++){let angle=i*Math.PI*2/13+random()*.12,radius=.1,x=Math.cos(angle)*radius,z=Math.sin(angle)*radius;
    for(let j=0;j<6;j++){const nextR=radius+.2+random()*.3,a=angle+(random()-.5)*.3,nx=Math.cos(a)*nextR,nz=Math.sin(a)*nextR;fissure(x,z,nx,nz,.035*(1-j/8),j/7);
      if(j===2||j===4){const ba=a+(random()>.5?.6:-.6),br=nextR+.35;fissure(nx,nz,Math.cos(ba)*br,Math.sin(ba)*br,.018,j/7+.08);}x=nx;z=nz;radius=nextR;}}
  const cg=new T.BufferGeometry();cg.setAttribute('position',new T.Float32BufferAttribute(crackPositions,3));cg.setAttribute('uv',new T.Float32BufferAttribute(crackUvs,2));
  const cracks=mesh('relic-ground-cracks',cg,planeVertex,`varying vec2 vUv;void main(){float t=uImpactAge,edge=abs(vUv.x-.5)*2.;float reveal=smoothstep(vUv.y*.17,vUv.y*.17+.035,t);float fade=1.-smoothstep(.65,1.5,t);float center=1.-smoothstep(.55,1.,edge);vec3 col=mix(vec3(.32,.25,.17),vec3(.035,.025,.018),center);gl_FragColor=vec4(col,reveal*fade*uCancel*.86);${output}}`);
  const debris=mesh('relic-impact-debris',instances(240,48),`attribute vec4 aSeed;varying vec2 vUv;varying float vFade,vShade;void main(){vUv=uv*2.-1.;float age=max(0.,uImpactAge),delay=aSeed.w*.045,t=max(0.,age-delay),a=aSeed.x*6.283185;float lifetime=.65+aSeed.y*.75;float speed=2.+aSeed.z*3.3,vy=2.3+aSeed.y*2.3;vec3 p=vec3(cos(a)*(.15+speed*t),.06+vy*t-4.9*t*t,sin(a)*(.15+speed*t));vFade=step(delay,age)*step(0.,uImpactAge)*(1.-smoothstep(lifetime*.65,lifetime,t))*smoothstep(-.12,.04,p.y);p.y=max(.025,p.y);vShade=.4+aSeed.z*.5;vec4 mv=modelViewMatrix*vec4(p,1.);float rot=aSeed.z*6.283+t*(3.+aSeed.y*5.);vec2 q=mat2(cos(rot),-sin(rot),sin(rot),cos(rot))*position.xy;mv.xy+=q*vec2(.11+aSeed.w*.18,.07+aSeed.z*.14)*uSize;gl_Position=projectionMatrix*mv;}`,`varying vec2 vUv;varying float vFade,vShade;void main(){float d=max(abs(vUv.x)*.80+abs(vUv.y)*.39,max(abs(vUv.y)*.86,abs(vUv.x+vUv.y*.38)*.77));float mask=1.-smoothstep(.65,.70,d);float top=step(vUv.x*.38-.12,vUv.y);float side=step(-.12,vUv.x+vUv.y*.25);float grain=.94+.06*sin(vUv.x*37.+vUv.y*51.);vec3 c=mix(vec3(.08,.065,.05),vec3(.48,.41,.31),.18+top*.44+side*.12+vShade*.13)*grain;gl_FragColor=vec4(c,mask*vFade*uCancel);${output}}`);
  const dust=mesh('relic-impact-dust',instances(32),`attribute vec4 aSeed;varying vec2 vUv;varying float vAge,vSeed,vFade;void main(){vUv=uv*2.-1.;float age=max(0.,uImpactAge),delay=.035+aSeed.z*.09,t=max(0.,age-delay),a=aSeed.x*6.283185;float radius=.35+(1.-exp(-t*3.2))*(2.4+aSeed.y*1.2);vec3 p=vec3(cos(a)*radius,.15+sin(min(t/1.5,1.)*3.14159)*(.25+aSeed.w*.32),sin(a)*radius);vAge=t;vSeed=aSeed.y*31.;vFade=smoothstep(delay,delay+.08,age)*(1.-smoothstep(.5,1.5,age))*step(0.,uImpactAge);float grow=.3+(1.-exp(-t*5.))*(.85+aSeed.w*.55);vec4 mv=modelViewMatrix*vec4(p,1.);mv.xy+=position.xy*vec2(grow,grow*.6)*uSize;gl_Position=projectionMatrix*mv;}`,`varying vec2 vUv;varying float vAge,vSeed,vFade;float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}void main(){vec2 p=vUv;float turn=vAge*.7;vec2 q=mat2(cos(turn),-sin(turn),sin(turn),cos(turn))*p;float n=noise(q*3.+vec2(vSeed,-vAge*.9))*.65+noise(q*7.+vSeed+vAge*.5)*.35;float shape=1.-smoothstep(.32,.98,length(p)+(.5-n)*.35);float erosion=smoothstep(.15+vAge*.15,.6,n);float alpha=shape*erosion*vFade*uCancel*.43;vec3 col=mix(vec3(.17,.15,.12),vec3(.46,.40,.32),n*.65+(p.y+.5)*.15);gl_FragColor=vec4(col,alpha);${output}}`);
  // The raised treatment wave is a fixed batch of overlapping soft smoke sprites.
  // Its local anchor stays at half the placeholder height; decoration density never removes it.
  const smoke=mesh('relic-magic-smoke-ring',instances(48),`attribute vec4 aSeed;varying vec2 vUv,vRingPos;varying float vSeed,vRoll;void main(){vUv=uv*2.-1.;float t=max(0.,uPulseAge),p=clamp(t/1.6,0.,1.);float a=aSeed.x*6.283185;float r=uRadius*.85;float radialRoll=sin(t*7.+aSeed.z*6.283)*.16*sin(p*3.14159);vec3 center=vec3(cos(a)*(r+radialRoll),sin(a*5.+t*5.)*.13+sin(t*6.+aSeed.y*6.283)*.12,sin(a)*(r+radialRoll));float width=min(r*.58,1.8+aSeed.z*.65)*(1.-p*.25);float height=(.45+aSeed.w*.55)*smoothstep(0.,.16,t)*(1.-p*.28);vec3 right=normalize(vec3(modelViewMatrix[0][0],modelViewMatrix[1][0],modelViewMatrix[2][0]));vec3 up=normalize(vec3(modelViewMatrix[0][1],modelViewMatrix[1][1],modelViewMatrix[2][1]));height*=sqrt(pow(uSmokeThickness*up.y,2.)+max(0.,1.-up.y*up.y));vec3 q=center+right*position.x*width+up*position.y*height;vRingPos=q.xz;vSeed=aSeed.y*27.;vRoll=aSeed.z*6.283+t*(1.2+aSeed.w);gl_Position=projectionMatrix*modelViewMatrix*vec4(q,1.);}`,`varying vec2 vUv,vRingPos;varying float vSeed,vRoll;float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}void main(){float t=max(0.,uPulseAge);vec2 p=vUv;float angle=vRoll+length(p)*1.2;vec2 q=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*p;float n=noise(q*2.7+vec2(vSeed,-t*1.4))*.6+noise(q*6.3+vec2(-t*.8,vSeed))*.28+noise(q*11.+vSeed)*.12;float envelope=pow(1.-smoothstep(.12,1.08,length(p)+(.5-n)*.22),1.5);float cloud=smoothstep(.22,.66,n);float curl=exp(-pow((n-.52)/.07,2.))*(.55+.45*uDetail);float radius=length(vRingPos),inner=max(.72,uRadius*.85-.88);float hole=smoothstep(inner,inner+.32,radius)*(1.-smoothstep(uMaxRadius-.3,uMaxRadius,radius));float fade=smoothstep(.04,.18,t)*(1.-smoothstep(.95,1.6,t))*step(0.,uPulseAge);float alpha=envelope*(cloud*.10+curl*.065)*hole*fade*uCancel;vec3 color=mix(uColor,vec3(1.,.98,.9),clamp(curl*.45+cloud*.25,0.,.65));gl_FragColor=vec4(color,alpha);${smokeOutput}}`);smoke.position.y=1.5;smoke.geometry.instanceCount=48;const smokeSeeds=smoke.geometry.getAttribute('aSeed');for(let i=0;i<48;i++)smokeSeeds.setX(i,(i+.5+(smokeSeeds.getX(i)-.5)*.4)/48);
  const motes=mesh('relic-motes',instances(96),`attribute vec4 aSeed;varying vec2 vUv;varying float vFade;void main(){vUv=uv*2.-1.;float a=aSeed.x*6.283185;vec3 p;float fade=0.;if(uEmitTime<1.35){float t=clamp(uTime/1.35,0.,1.);float r=(1.-t)*(.6+aSeed.y*1.6);p=vec3(cos(a)*r,.08+aSeed.z*.45*(1.-t),sin(a)*r);fade=sin(t*3.14159)*.55;}else{float birth=floor(uEmitTime*.6+aSeed.y)/.6-aSeed.y/.6;float age=max(0.,uTime-birth),life=1.35;float r=.2+aSeed.z*1.6;p=vec3(cos(a)*r,.15+age*(.45+aSeed.w),sin(a)*r);fade=sin(clamp(age/life,0.,1.)*3.14159)*.36;if(uPulseAge>=0.){float pt=uPulseAge,pr=uRadius*(.8+aSeed.z*.15);p=vec3(cos(a)*pr,.08+pt*(.3+aSeed.w*.6),sin(a)*pr);fade=smoothstep(0.,.12,pt)*(1.-smoothstep(.5,1.5,pt))*.65;}}vFade=fade*(1.-smoothstep(11.5,12.7,uTime));vec4 mv=modelViewMatrix*vec4(p,1.);mv.xy+=position.xy*vec2(.028+aSeed.w*.032,.06+aSeed.z*.06)*uSize;gl_Position=projectionMatrix*mv;}`,`varying vec2 vUv;varying float vFade;void main(){float d=abs(vUv.x)+abs(vUv.y);float a=(1.-smoothstep(.15,1.,d))*vFade*uCancel;gl_FragColor=vec4(mix(uColor,vec3(1.),.6),a);${output}}`);

  let mounted=null;
  const worldToRoot={value:new T.Matrix4()};
  function releaseMounted(entry){
    if(!entry)return;entry.wrapper.removeFromParent();
    for(const record of entry.materials)record.material.dispose();
    for(const skeleton of entry.skeletons)skeleton.dispose();
    entry.model.traverse(o=>{if(o.isInstancedMesh)o.dispose();});
  }
  function setObject(source,configuration={}){
    if(disposed)throw new Error('Cannot replace a disposed effect.');
    if(source===null){releaseMounted(mounted);mounted=null;sync();return null;}
    if(!source?.isObject3D)throw new TypeError('setObject expects a loaded Three.js Object3D, such as gltf.scene.');
    const height=configuration.height??3,rotation=configuration.rotation??[0,0,0];
    if(!Number.isFinite(height)||height<=0||!Array.isArray(rotation)||rotation.length!==3||!rotation.every(Number.isFinite))throw new TypeError('height must be positive; rotation must contain three radians.');
    let meshCount=0;const originals=[];
    source.traverse(o=>{
      originals.push(o);
      if(o===group||o===body)throw new TypeError('Cannot mount the effect inside itself.');
      if(o.isSprite||o.isPoints||o.isLine||o.isBatchedMesh)throw new TypeError('Use a mesh/group model; sprites, points, lines and batched meshes are not supported.');
      if(o.isMesh){meshCount++;for(const m of [o.material].flat()){
        if(!m||!(m.isMeshBasicMaterial||m.isMeshStandardMaterial||m.isMeshLambertMaterial||m.isMeshPhongMaterial||m.isMeshToonMaterial||m.isMeshMatcapMaterial)||m.onBeforeCompile.toString().slice(m.onBeforeCompile.toString().indexOf('{')+1,m.onBeforeCompile.toString().lastIndexOf('}')).trim()!=='')throw new TypeError('Use standard Three.js mesh materials without custom shader hooks.');
      }}
    });
    if(!meshCount)throw new TypeError('Model must contain at least one mesh.');
    const candidate={wrapper:new T.Group(),model:source.clone(true),materials:[],skeletons:new Set()};
    try{
      const copies=[];candidate.model.traverse(o=>copies.push(o));const map=new Map(originals.map((o,i)=>[o,copies[i]]));
      for(let i=0;i<originals.length;i++)if(originals[i].isSkinnedMesh){
        const original=originals[i],copy=copies[i];
        if(original.skeleton.bones.some(b=>!map.has(b)))throw new TypeError('Pass the full model including all skeleton bones.');
        copy.skeleton=original.skeleton.clone();candidate.skeletons.add(copy.skeleton);copy.skeleton.bones=original.skeleton.bones.map(b=>map.get(b));copy.bindMatrix.copy(original.bindMatrix);copy.bindMatrixInverse.copy(original.bindMatrixInverse);
      }
      const materialMap=new Map();candidate.model.traverse(o=>{
        if(!o.isMesh)return;o.castShadow=false;
        const adapt=original=>{
          if(materialMap.has(original))return materialMap.get(original);
          const m=original.clone();materialMap.set(original,m);candidate.materials.push({material:m,opacity:original.opacity,depthWrite:original.depthWrite});
          m.transparent=true;
          m.onBeforeCompile=shader=>{
            shader.uniforms.uRelicWorldToRoot=worldToRoot;
            shader.vertexShader='varying float vRelicGroundY;uniform mat4 uRelicWorldToRoot;\n'+shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
              vec4 relicLocal=vec4(transformed,1.);
              #ifdef USE_INSTANCING
                relicLocal=instanceMatrix*relicLocal;
              #endif
              vRelicGroundY=(uRelicWorldToRoot*modelMatrix*relicLocal).y;`);
            shader.fragmentShader='varying float vRelicGroundY;\n'+shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(vRelicGroundY<0.)discard;');
          };
          m.customProgramCacheKey=()=> 'sacred-relic-custom-model-ground-v1';return m;
        };
        o.material=Array.isArray(o.material)?o.material.map(adapt):adapt(o.material);
        o.onBeforeRender=()=>{root.updateWorldMatrix(true,false);worldToRoot.value.copy(root.matrixWorld).invert();};
      });
      // The source root's scene placement is irrelevant; preserve its authored rotation/scale.
      candidate.model.position.set(0,0,0);candidate.model.updateMatrix();
      candidate.wrapper.name='sacred-relic-custom-model';candidate.wrapper.add(candidate.model);
      candidate.wrapper.rotation.set(...rotation);candidate.wrapper.updateMatrixWorld(true);
      const bounds=new T.Box3().setFromObject(candidate.wrapper,true),extent=bounds.getSize(new T.Vector3());
      if(bounds.isEmpty()||!Number.isFinite(extent.y)||extent.y<1e-6)throw new TypeError('Model must have finite non-zero height.');
      const scale=height/extent.y;candidate.wrapper.scale.setScalar(scale);
      candidate.wrapper.position.set(-(bounds.min.x+bounds.max.x)*.5*scale,-bounds.min.y*scale,-(bounds.min.z+bounds.max.z)*.5*scale);
    }catch(error){releaseMounted(candidate);throw error;}
    releaseMounted(mounted);mounted=candidate;body.add(candidate.wrapper);sync();return candidate.model;
  }
  function phase(){return disposed||time>=13-1e-9||stopTime>=0&&time-stopTime>=.45-1e-9?'finished':stopTime>=0||time>=11.35-1e-9?'ending':time<1.35-1e-9?'starting':'active';}
  function sync(){
    const emitting=stopTime<0?time:Math.min(time,stopTime),cancel=stopTime<0?1:1-smooth(0,.45,time-stopTime);
    const impactAge=emitting>=1.35-1e-9?Math.max(0,time-1.35):null;
    let pulseIndex=-1,pulseAge=null;
    for(let i=0;i<5;i++){const born=3.35+i*2,age=time-born;if(emitting>=born-1e-9&&age>=-1e-9&&age<1.6-1e-9){pulseIndex=i;pulseAge=Math.max(0,age);}}
    const radius=pulseAge===null?0:(.12+(9*settings.spread-.12)*(1-Math.pow(1-pulseAge/1.6,2)));
    u.uTime.value=time;u.uEmitTime.value=emitting;u.uImpactAge.value=impactAge??-1;u.uPulseAge.value=pulseAge??-1;u.uRadius.value=radius;u.uMaxRadius.value=9*settings.spread;u.uCancel.value=cancel;
    root.scale.setScalar(settings.size);group.visible=phase()!=='finished';
    const fall=clamp((emitting-1)/.35,0,1);const penetration=clamp((emitting-1.35)/.08,0,1);body.position.y=7.5*(1-fall*fall)-.6*(1-Math.pow(1-penetration,3));burialDepth.value=Math.max(0,-body.position.y);body.visible=emitting>=1-1e-9&&time<12.2&&cancel>0;
    const fade=smooth(1,1.04,emitting)*(1-smooth(11.35,12.2,time))*cancel;u.uBodyFade.value=fade;gold.opacity=fade;white.opacity=fade;gold.depthWrite=fade>.98;white.depthWrite=fade>.98;
    for(const child of body.children)if(child.name==='relic-triangle-border'||child.name==='relic-triangle-face')child.visible=!mounted;
    if(mounted)for(const record of mounted.materials){record.material.opacity=record.opacity*fade;record.material.depthWrite=record.depthWrite&&fade>.98;}
    sigil.visible=time<12.2;trail.visible=emitting>=1&&time<1.48&&stopTime<0;impact.visible=impactAge!==null&&impactAge<.65;wave.visible=echo.visible=smoke.visible=pulseIndex>=0;
    cracks.visible=dust.visible=debris.visible=impactAge!==null&&impactAge<1.5;
    debris.geometry.instanceCount=Math.round(240*settings.density);dust.geometry.instanceCount=Math.round(32*settings.density);motes.geometry.instanceCount=Math.round(96*settings.density);motes.visible=time<12.7;
    group.userData.sacredRelicState={time,impactAge,pulseIndex,pulseAge,waveRadius:radius,smokeRadius:radius*.85,smokeHeight:1.5,smokeThickness:5,cancelFade:cancel};
  }
  function setOptions(next={}){
    if(disposed)return;
    const previous=settings??{color:spec.color,size:1,speed:1,detail:1,density:.5,spread:1};settings={...previous};
    // Only advertised controls belong to public settings; ignore unrelated options.
    for(const key of Object.keys(previous))if(Object.hasOwn(next,key))settings[key]=next[key];
    for(const key of ['size','speed','detail','density','spread']){const min=key==='density'?.125:key==='spread'?.5:.25,max=key==='density'?1:key==='spread'?1.5:2;settings[key]=clamp(Number.isFinite(settings[key])?settings[key]:previous[key],min,max);}
    if(!/^#[0-9a-f]{6}$/i.test(settings.color))settings.color=previous.color;
    u.uColor.value.set(settings.color);u.uSize.value=settings.size;u.uDetail.value=settings.detail;gold.color.set(settings.color).multiplyScalar(.82);sync();
  }
  setOptions(options);
  return {group,update(dt){if(disposed||phase()==='finished'||!Number.isFinite(dt)||dt<0)return;time+=dt*settings.speed;sync();},setOptions,setObject,
    hit(){this.stop();},stop(){if(disposed||stopTime>=0||phase()==='finished')return;stopTime=time;sync();},reset(){if(disposed)return;time=0;stopTime=-1;sync();},
    dispose(){if(disposed)return;releaseMounted(mounted);mounted=null;disposed=true;group.visible=false;group.removeFromParent();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();geometries.clear();materials.clear();group.clear();},
    get settings(){return {...settings};},get elapsed(){return time;},get phase(){return phase();},get finished(){return phase()==='finished';},get particleCount(){return smoke.geometry.instanceCount+debris.geometry.instanceCount+dust.geometry.instanceCount+motes.geometry.instanceCount;},get lifecycle(){return {start:1.35,end:1.65};}};
}

// Shared by website previews and standalone downloads. All durations are seconds.
function normalizeSpellIndicatorOptions(spec, options = {}) {
  const finite = (value, fallback, min, max) => Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
  return {
    color: /^#[0-9a-f]{6}$/i.test(options.color) ? options.color : spec.color,
    size: finite(options.size, 3, .25, 20),
    detail: finite(options.detail, 1, .25, 2),
    angleDeg: spec.indicatorShape === 'circle' ? 360 : finite(options.angleDeg, 90, 5, 360),
    warningDuration: finite(options.warningDuration, 2, .1, 30),
    progressMode: options.progressMode === 'manual' ? 'manual' : 'auto',
    // Compatibility fields are intentionally inert for these non-particle effects.
    speed: 1,
    density: .5,
  };
}

function createSpellIndicatorEffect(THREE, spec, options = {}) {
  const group = new THREE.Group(); group.name = spec.id;
  let settings = normalizeSpellIndicatorOptions(spec, options);
  let time = 0, progress = 0, endAge = 0, ending = null, disposed = false, finished = false;
  const uniforms = {
    uTime: {value: 0}, uProgress: {value: 0}, uHalfAngle: {value: Math.PI},
    uDetail: {value: 1}, uOpacity: {value: 1}, uFlash: {value: 0},
    uColor: {value: new THREE.Color()}, uEdgeColor: {value: new THREE.Color()},
  };
  // A small margin preserves antialiasing at the four cardinal points. The
  // fragment mask, not the square, defines the exact unit-radius boundary.
  const geometry = new THREE.PlaneGeometry(2.04, 2.04);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true, depthTest: true, depthWrite: false,
    side: THREE.DoubleSide, forceSinglePass: true,
    blending: THREE.NormalBlending, toneMapped: false,
    vertexShader: `varying vec2 vPoint;
      void main(){vPoint=position.xz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `
      uniform float uTime,uProgress,uHalfAngle,uDetail,uOpacity,uFlash;
      uniform vec3 uColor,uEdgeColor;
      varying vec2 vPoint;
      const float PI=3.14159265359;
      float rayDistance(vec2 p,vec2 direction){return length(p-direction*clamp(dot(p,direction),0.0,1.0));}
      void main(){
        vec2 p=vPoint;
        float radius=length(p);
        // Derivatives are evaluated for the whole quad before any discard.
        float aa=max(length(fwidth(p))*.65,.00015);
        float angle=atan(p.y,abs(p.x)+abs(p.y)<.000001?.000001:p.x);
        float boundary=1.0-radius;
        if(uHalfAngle<PI-.00001){
          vec2 ray=vec2(cos(uHalfAngle),sin(uHalfAngle));
          float side=min(rayDistance(p,ray),rayDistance(p,vec2(ray.x,-ray.y)));
          boundary=min(boundary,abs(angle)<=uHalfAngle?side:-side);
        }
        float coverage=smoothstep(-aa,aa,boundary);
        float edge=1.0-smoothstep(.007,.014+aa,boundary);
        float halo=1.0-smoothstep(.014,.075,boundary);
        float filled=(1.0-smoothstep(uProgress-aa,uProgress+aa,radius))*step(.000001,uProgress);
        float front=(1.0-smoothstep(.006,.020+aa,abs(radius-uProgress)))*step(.000001,uProgress)*(1.0-step(.99999,uProgress));
        // Sparse moving bands live inside the shape. They never displace a border.
        float wave=pow(.5+.5*sin(radius*28.0-angle*2.0-uTime*2.6),8.0);
        float flow=wave*(.35+.65*filled)*(.018*uDetail);
        float alpha=(.115+.19*filled+.12*halo+flow+.20*front+.54*edge)*coverage*uOpacity;
        vec3 color=uColor*(.65+.20*filled);
        color=mix(color,uEdgeColor,clamp(.30*halo+.75*edge+.44*front,0.0,1.0));
        color=mix(color,vec3(.055,.018,.023),.22*(1.0-edge)*halo);
        color=mix(color,mix(uEdgeColor,vec3(1.0),.35),uFlash*edge);
        alpha=min(1.0,alpha+uFlash*edge*.18*coverage*uOpacity);
        if(alpha<.001)discard;
        gl_FragColor=vec4(color,alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = spec.id + '-surface';
  mesh.position.y = .01;
  group.add(mesh);

  function syncAppearance() {
    mesh.scale.set(settings.size, 1, settings.size);
    uniforms.uHalfAngle.value = settings.angleDeg * Math.PI / 360;
    uniforms.uDetail.value = settings.detail;
    uniforms.uColor.value.set(settings.color);
    const hsl = {}; uniforms.uColor.value.getHSL(hsl);
    uniforms.uEdgeColor.value.setHSL((hsl.h + .045) % 1, hsl.s * .86, Math.min(.68, Math.max(.52, hsl.l)));
  }
  function syncTime() {
    uniforms.uTime.value = time % (Math.PI * 2 / 2.6);
    uniforms.uProgress.value = progress;
    uniforms.uFlash.value = ending === 'complete' && endAge < .06 ? 1 - .35 * endAge / .06 : 0;
    uniforms.uOpacity.value = finished ? 0 : ending === 'cancel' ? Math.max(0, 1 - endAge / .12)
      : ending === 'complete' ? Math.max(0, 1 - Math.max(0, endAge - .06) / .09) : 1;
    group.visible = !disposed && !finished;
  }
  function beginEnd(reason) { ending = reason; endAge = 0; syncTime(); }
  function update(dt) {
    if(disposed || finished || !Number.isFinite(dt) || dt < 0) return;
    let remaining = dt;
    if(!ending) {
      if(settings.progressMode === 'auto') {
        const advance = Math.min(remaining, Math.max(0, settings.warningDuration - time));
        time += advance; remaining -= advance;
        progress = Math.min(1, time / settings.warningDuration);
        if(time >= settings.warningDuration - 1e-10) { time = settings.warningDuration; progress = 1; beginEnd('complete'); }
      } else { time = Math.min(Number.MAX_SAFE_INTEGER, time + remaining); remaining = 0; }
    }
    if(ending) {
      const duration = ending === 'complete' ? .15 : .12;
      const advance = Math.min(remaining, Math.max(0, duration - endAge));
      time += advance; endAge += advance;
      if(endAge >= duration - 1e-10) { endAge = duration; finished = true; }
    }
    syncTime();
  }
  function setProgress(value) {
    if(disposed || finished || ending || settings.progressMode !== 'manual' || !Number.isFinite(value)) return;
    progress = Math.min(1, Math.max(0, value));
    if(progress === 1) beginEnd('complete');
    syncTime();
  }
  function reset() {
    if(disposed) return;
    time = 0; progress = 0; endAge = 0; ending = null; finished = false; syncTime();
  }
  function stop() { if(!disposed && !finished && !ending) beginEnd('cancel'); }
  function setOptions(next = {}) {
    if(disposed) return;
    const previous = settings;
    settings = normalizeSpellIndicatorOptions(spec, {...settings, ...next});
    syncAppearance();
    if(settings.warningDuration !== previous.warningDuration || settings.progressMode !== previous.progressMode) reset();
  }
  function dispose() {
    if(disposed) return;
    disposed = true; finished = true; group.visible = false; group.removeFromParent();
    geometry.dispose(); material.dispose(); group.clear();
  }
  syncAppearance(); syncTime();
  return {
    group, update, setProgress, setOptions, reset, stop, dispose,
    // Existing runtime union compatibility only; not advertised as capabilities.
    hit() {}, setDirection() {}, setEndpoints() {},
    get settings() { return {...settings}; },
    get progress() { return progress; },
    get elapsed() { return time; },
    get duration() { return settings.warningDuration + .15; },
    get lifecycle() { return {start: 0, end: .15}; },
    get particleCount() { return 0; },
    get phase() { return finished ? 'finished' : ending ? 'ending' : 'active'; },
    get finished() { return finished; },
  };
}

// One-shot airburst. All layers are shared by gallery and standalone export.
// The local origin is the explosion center; no ground plane or host lights required.
function buildBillowingAirburstEffect({THREE,spec,cap,uniforms,animated,mesh,instanced,shader,output,variation}) {
  if(spec.id!=='billowing-airburst')return false;
  // Local emissive radiance. This is not a full-screen Bloom postprocess.
  const emissiveGain=3;
  const explosionLightGain=.5; // Particle radiance is intentionally independent.
  let state=(spec.seed??829648)>>>0;
  const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  const field=`
    float hash3(vec3 p){p=fract(p*.3183099+vec3(.11,.17,.23));p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
    float noise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
      return mix(mix(mix(hash3(i),hash3(i+vec3(1,0,0)),f.x),mix(hash3(i+vec3(0,1,0)),hash3(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash3(i+vec3(0,0,1)),hash3(i+vec3(1,0,1)),f.x),mix(hash3(i+vec3(0,1,1)),hash3(i+vec3(1,1,1)),f.x),f.y),f.z);}
    float billow(vec3 p){return noise3(p)*.65+noise3(p*2.07+7.3)*.25+noise3(p*4.11-3.1)*.10;}
    float flameHeat(float age,float pattern){
      return 1.0-smoothstep(.26,.59,age*1.4+(.5-pattern)*.24);
    }
    vec3 heatColor(vec3 base,float heat){
      vec3 ember=base*vec3(.60,.025,.012);
      vec3 flame=mix(ember,base*vec3(1.05,.13,.06),smoothstep(.18,.72,heat));
      return mix(flame,vec3(1.0,.16,.025),smoothstep(.86,1.18,heat));
    }
  `;
  // Sample only at burst boundaries; retained jets stay stable when quantity changes.
  const jetPaths=Array.from({length:6},()=>new THREE.Vector4());
  const jetBends=Array.from({length:6},()=>new THREE.Vector4());
  const burstOffset=new THREE.Vector3();
  const burstUniforms={uJetPaths:{value:jetPaths},uJetBends:{value:jetBends},uBurstOffset:{value:burstOffset}};
  variation.reset=()=>{
    let v=(variation.seed^spec.seed)>>>0;
    const next=()=>{v=(Math.imul(v,1664525)+1013904223)>>>0;return v/4294967296;};
    for(let i=0;i<6;i++){
      let x,y,z,accepted=false;
      for(let attempt=0;attempt<64&&!accepted;attempt++){
        y=next()*1.84-.92;const a=next()*Math.PI*2,r=Math.sqrt(1-y*y);x=Math.cos(a)*r;z=Math.sin(a)*r;
        accepted=jetPaths.slice(0,i).every(d=>x*d.x+y*d.y+z*d.z<.78);
      }
      // A bounded random search must not silently accept overlapping directions.
      if(!accepted){
        let best=Infinity;
        for(let k=0;k<192;k++){
          const fy=1-2*(k+.5)/192,fa=k*2.399963,fr=Math.sqrt(1-fy*fy);
          const fx=Math.cos(fa)*fr,fz=Math.sin(fa)*fr;
          let score=-1;for(let j=0;j<i;j++)score=Math.max(score,fx*jetPaths[j].x+fy*jetPaths[j].y+fz*jetPaths[j].z);
          if(score<best){best=score;x=fx;y=fy;z=fz;}
        }
      }
      jetPaths[i].set(x,y,z,3.4+next()*1.2);
      jetBends[i].set((next()-.5)*.8,(next()-.5)*.65,next()*.035,.82+next()*.30);
    }
    burstOffset.set(next()*19,next()*19,next()*19);
  };
  variation.reset();
  // Bounded CPU-only template cache. Instances clone buffers so draw ranges,
  // disposal and quantity edits cannot affect another live explosion.
  const geometrySeed=(spec.seed??829648)>>>0;
  let template=buildBillowingAirburstEffect.geometryTemplate;
  if(!template||template.THREE!==THREE||template.seed!==geometrySeed){
    template={THREE,seed:geometrySeed,lobes:[],samples:[],states:[]};
    buildBillowingAirburstEffect.geometryTemplate=template;
  }
  const glowSamples=[];
  function lobeGeometry(jets){
    const slot=jets?1:0,cached=template.lobes[slot];
    if(cached){glowSamples.push(...template.samples[slot]);state=template.states[slot];return cached.clone();}
    const sampleStart=glowSamples.length;
    const sphere=new THREE.SphereGeometry(1,jets?20:40,jets?14:28);
    const positions=[],normals=[],lobes=[],data=[],indices=[];
    const lobesPerJet=24,total=jets?6*lobesPerJet:9;
    for(let i=0;i<total;i++){
      const jet=jets?Math.floor(i/lobesPerJet):-1,k=jets?i%lobesPerJet:i;
      const a=i*2.399963+(random()-.5)*.35,z=1-2*(i+.5)/total;
      const radial=Math.sqrt(Math.max(0,1-z*z));
      const u=jets?k/(lobesPerJet-1):0;
      const lobe=jets?[u,(random()-.5)*.30,(random()-.5)*.30,k===23?.33:.17+random()*.14]:i===0?[0,0,0,1.14]:[Math.cos(a)*radial*.86,z*.72,Math.sin(a)*radial*.86,.72+random()*.19];
      const seed=[random(),jet,u,random()];
      if(!jets||k%3===0||k===lobesPerJet-1)glowSamples.push({lobe,data:seed});
      const offset=positions.length/3;
      for(let v=0;v<sphere.attributes.position.count;v++){
        positions.push(sphere.attributes.position.array[v*3],sphere.attributes.position.array[v*3+1],sphere.attributes.position.array[v*3+2]);
        normals.push(sphere.attributes.normal.array[v*3],sphere.attributes.normal.array[v*3+1],sphere.attributes.normal.array[v*3+2]);
        lobes.push(...lobe);data.push(...seed);
      }
      for(const index of sphere.index.array)indices.push(offset+index);
    }
    const geometry=new THREE.BufferGeometry();
    for(const [name,array,size] of [['position',positions,3],['normal',normals,3],['aLobe',lobes,4],['aData',data,4]])geometry.setAttribute(name,new THREE.Float32BufferAttribute(array,size));
    geometry.setIndex(indices);
    if(jets)geometry.userData.jetIndexCount=sphere.index.count*lobesPerJet;
    sphere.dispose();template.states[slot]=state;template.lobes[slot]=geometry.clone();template.samples[slot]=glowSamples.slice(sampleStart);return geometry;
  }
  // Shared centers keep the light attached during random replay, seeking and quantity changes.
  const lobeMotion=`
    void lobeMotion(float t,out vec3 center,out float swell,out float age){
      age=t;
      if(aData.y>=0.0){
        vec4 path=uJetPaths[int(aData.y)],bend=uJetBends[int(aData.y)];
        float u=aData.z;age=max(0.0,t-.025-bend.z-u*.11);
        float travel=(1.0-exp(-max(0.0,t-.045)*6.5))*path.w;
        vec3 d=path.xyz,side=normalize(cross(d,vec3(.13,1.0,.07))),up=normalize(cross(side,d));
        center=d*(.65+travel*u);
        center+=side*(sin(u*3.141593)*bend.x+aLobe.y)+up*(sin(u*3.7)*bend.y+aLobe.z);
        float drift=max(0.0,t-.65);
        center+=side*(aData.x-.5)*drift*.32+up*(aData.w-.5)*drift*.22;
        center.y+=drift*(.12+.14*u);
        swell=(1.0-exp(-age*30.0))*(1.0+min(t,.8)*.36)*bend.w;
      }else{
        float launch=1.0-exp(-t*19.0);
        float c=cos(t*.23),s=sin(t*.23);
        center=vec3(c*aLobe.x+s*aLobe.z,aLobe.y,-s*aLobe.x+c*aLobe.z)*launch;
        center*=1.0+min(t,.65)*.27;
        center.y+=max(0.0,t-.55)*(.14+aData.w*.16);
        center+=normalize(aLobe.xyz+vec3(.001))*smoothstep(.8,2.0,t)*.23;
        swell=launch*(1.0+min(t,.6)*.22);
      }
    }
  `;
  const volumeVertex=`
    uniform float uTime,uDetail,uQuantity;
    attribute vec4 aLobe,aData;
    uniform vec4 uJetPaths[6],uJetBends[6];uniform vec3 uBurstOffset;
    varying vec3 vSurface,vNormal,vView;varying float vSeed,vJet,vAlong,vAge;
    ${field}
    ${lobeMotion}
    vec3 surface(vec3 p,float t){
      float turn=t*(.52+aData.w*.40),c=cos(turn),s=sin(turn);
      vec3 r=vec3(c*p.x+s*p.z,p.y,-s*p.x+c*p.z);
      float rolling=sin(r.x*3.1+t*.8+aData.x*6.0)*sin(r.y*3.4-t*.6+aData.w*5.0)*sin(r.z*2.6+t*.5);
      float broad=noise3(r*2.1+uBurstOffset+vec3(0,-t*.25,0));
      float curls=pow(.5+.5*sin(r.x*5.0+t*.55+aData.x*7.0)*cos(r.y*4.0-t*.45)*sin(r.z*4.5+t*.3),2.0);
      float shape=1.0+rolling*(.08+.045*uDetail)+(broad-.5)*.14+curls*(.13+.055*uDetail);
      return r*shape;
    }
    void main(){
      float t=uTime;vSeed=aData.x;vJet=aData.y;vAlong=aData.z;vAge=t;
      vec3 p=surface(position,t);
      vec3 tangent=normalize(cross(normal,abs(normal.y)>.98?vec3(1,0,0):vec3(0,1,0))),bitangent=cross(normal,tangent);
      vec3 dx=surface(normalize(position+tangent*.012),t)-p;
      vec3 dy=surface(normalize(position+bitangent*.012),t)-p;
      vec3 center;float swell,age;lobeMotion(t,center,swell,age);vAge=age;
      vec3 localNormal=normalize(cross(dx,dy));
      #if AIRBURST_JETS == 1
        vec3 d=uJetPaths[int(aData.y)].xyz;p=d*dot(p,d)*1.24+(p-d*dot(p,d));
        localNormal-=d*dot(localNormal,d)*(1.0-1.0/1.24);
      #else
        p*=vec3(1.08,.94,1.0);localNormal/=vec3(1.08,.94,1.0);
      #endif
      p=center+p*aLobe.w*swell;
      vSurface=p;vNormal=normalize(normalMatrix*normalize(localNormal));
      vec4 mv=modelViewMatrix*vec4(p*uSize,1.0);vView=mv.xyz;
      gl_Position=projectionMatrix*mv;
    }
  `;
  const volumeFragment=`
    uniform float uTime,uQuantity;uniform vec3 uColor,uBurstOffset;
    varying vec3 vSurface,vNormal,vView;varying float vSeed,vJet,vAlong,vAge;
    ${field}
    void main(){
      if(uTime<=0.0||uTime>=2.4)discard;
      #if AIRBURST_JETS == 1
        if(vJet>=uQuantity||vAge<=.001)discard;
      #endif
      float t=uTime;
      vec3 flow=vSurface*1.65+uBurstOffset+vec3(0,-t*.36,t*.12);
      float broad=billow(flow),fine=noise3(flow*3.0);
      float localTime=t-vSeed*.14-vAlong*.08;
      float erosion=smoothstep(.72,2.16,localTime);
      float matter=broad*.72+fine*.12+.22;
      float edge=matter-erosion;
      float coverage=smoothstep(-.035,.065,edge);
      coverage*=1.0-smoothstep(1.8,2.4,t);
      if(coverage<.48)discard;
      vec3 n=normalize(vNormal),view=normalize(-vView);
      vec3 light=normalize(mat3(viewMatrix)*vec3(-.45,.8,.45));
      float diffuse=max(0.0,dot(n,light));
      float rim=pow(1.0-max(0.0,dot(n,view)),1.65);
      float heatAge=t;
      #if AIRBURST_JETS == 1
        heatAge=t-vAlong*.157;
      #endif
      float burn=flameHeat(heatAge,broad);
      // Key lighting shapes cooler folds; it never multiplies white-hot emission.
      float hot=burn*(.78+(broad-.5)*1.0+rim*.17);
      float whiteHot=pow(smoothstep(.84,1.10,hot),2.2);
      vec3 soot=mix(vec3(.002,.0025,.004),vec3(.022,.025,.033),pow(diffuse,1.1));
      soot*=.80+broad*.30;
      // Compress emissive energy before the LDR output clips away the hot folds.
      vec3 warmSurface=heatColor(uColor,.24+hot*.52)*(.8+burn*1.6)*(.30+.70*diffuse)*${explosionLightGain.toFixed(1)};
      vec3 hotEmission=vec3(1.0,.46,.075)*(1.0+burn*${emissiveGain.toFixed(1)})*${explosionLightGain.toFixed(1)};
      vec3 thermalMix=vec3(whiteHot,whiteHot,pow(whiteHot,2.0));
      vec3 fire=mix(vec3(1.0)-exp(-warmSurface),vec3(1.0)-exp(-hotEmission),thermalMix);
      vec3 color=mix(soot,fire,smoothstep(.20,.72,burn));
      float residual=(1.0-smoothstep(.40,1.08,heatAge*1.4))*(1.0-burn);
      float seams=pow(smoothstep(.35,.72,broad),1.35);
      float hotEdges=(rim*1.35+pow(max(0.0,broad-.48)*2.0,3.0)*.45)*seams;
      vec3 edgeLight=heatColor(uColor,.60+hotEdges*.20)*hotEdges*residual*${(emissiveGain*explosionLightGain).toFixed(1)};
      color+=(vec3(1.0)-color)*(vec3(1.0)-exp(-edgeLight));
      // A solid, dark billow first; irregular holes open before the last thin wisps fade.
      gl_FragColor=vec4(color,1.0);${output}
    }
  `;
  function volumeMaterial(jets){
    const mat=shader(volumeFragment,volumeVertex,burstUniforms,false,{AIRBURST_JETS:jets?1:0});
    mat.transparent=false;mat.depthWrite=true;mat.blending=THREE.NoBlending;mat.side=THREE.FrontSide;
    return mat;
  }
  const core=mesh(lobeGeometry(false),volumeMaterial(false),1);core.name='airburst-core';
  const jets=mesh(lobeGeometry(true),volumeMaterial(true),1);jets.name='airburst-jets';
  // One merged draw: soft camera-facing lobes follow both the core and each jet.
  const glowPositions=[],glowUvs=[],glowLobes=[],glowData=[],glowIndices=[];
  for(const {lobe,data} of glowSamples){
    const offset=glowPositions.length/3;
    for(const [x,y] of [[-1,-1],[1,-1],[-1,1],[1,1]]){
      glowPositions.push(x,y,0);glowUvs.push((x+1)/2,(y+1)/2);glowLobes.push(...lobe);glowData.push(...data);
    }
    glowIndices.push(offset,offset+1,offset+2,offset+2,offset+1,offset+3);
  }
  const glowGeometry=new THREE.BufferGeometry();
  for(const [name,array,size] of [['position',glowPositions,3],['uv',glowUvs,2],['aLobe',glowLobes,4],['aData',glowData,4]])glowGeometry.setAttribute(name,new THREE.Float32BufferAttribute(array,size));
  glowGeometry.setIndex(glowIndices);
  glowGeometry.userData.coreIndexCount=glowSamples.filter(s=>s.data[1]<0).length*6;
  glowGeometry.userData.jetIndexCount=glowSamples.filter(s=>s.data[1]===0).length*6;
  const glowMaterial=shader(`
    uniform vec3 uColor;varying vec2 vUv;varying float vHeat,vJet,vHot;
    void main(){
      float r=length((vUv-.5)*2.0);
      if(r>=1.0)discard; // Outside the original zero-alpha footprint.
      // Center-weighted soft falloff: no flat bright band around the silhouette.
      float softHalo=exp(-r*r*5.0)*.6+exp(-r*r*2.0)*.4;
      float alpha=softHalo*(1.0-smoothstep(.65,1.0,r));
      alpha*=vHeat*(vJet>=0.0?.085:.065)*${(emissiveGain*explosionLightGain).toFixed(1)};
      if(alpha<.002)discard;
      vec3 tint=uColor*vec3(.72,.12,.06);
      tint=mix(tint,vec3(.85,.045,.008),vHot*exp(-r*r*8.0)*.12);
      gl_FragColor=vec4(tint,alpha);${output}
    }`,`
    uniform float uTime,uQuantity;uniform vec4 uJetPaths[6],uJetBends[6];uniform vec3 uBurstOffset;
    attribute vec4 aLobe,aData;varying vec2 vUv;varying float vHeat,vJet,vHot;
    ${field}
    ${lobeMotion}
    void main(){
      vUv=uv;vJet=aData.y;vec3 center;float swell,age;lobeMotion(uTime,center,swell,age);
      float heatAge=uTime-(aData.y>=0.0?aData.z*.157:0.0);
      float pattern=billow(center*1.65+uBurstOffset+vec3(0,-uTime*.36,uTime*.12));
      vHot=flameHeat(heatAge,pattern);
      float cooling=1.0-smoothstep(.40,1.08,heatAge*1.4);
      vHeat=(1.0-exp(-age*30.0))*(vHot+cooling*(1.0-vHot)*.30);
      if(aData.y>=uQuantity||age<=0.0)vHeat=0.0;
      // Maximum fragment alpha occurs at the center. Skip an entire quad only
      // when even its center is below the existing fragment discard threshold.
      if(vHeat*(vJet>=0.0?.085:.065)*${(emissiveGain*explosionLightGain).toFixed(1)}<.00199){gl_Position=vec4(2,2,2,1);return;}
      float bodyRadius=aLobe.w*swell*1.2;
      float radius=bodyRadius+(aData.y>=0.0?1.05:1.8)*min(1.0,swell);
      vec4 mv=modelViewMatrix*vec4(center*uSize,1.0);
      float scale=length(modelMatrix[1].xyz)*uSize;
      mv.xy+=position.xy*radius*scale;
      gl_Position=projectionMatrix*mv;
    }`,burstUniforms,true);
  glowMaterial.blending=THREE.AdditiveBlending;glowMaterial.forceSinglePass=true;
  // Draw additive scatter before opaque volumes. Depth testing alone cannot prevent
  // one lobe billboard from bleaching a neighboring lobe behind its center plane.
  glowMaterial.transparent=false;glowMaterial.depthTest=true;glowMaterial.depthWrite=false;
  const glow=mesh(glowGeometry,glowMaterial,0);glow.name='airburst-glow';
  const syncJets=()=>{
    const count=Math.round(uniforms.uQuantity.value);
    jets.geometry.setDrawRange(0,jets.geometry.userData.jetIndexCount*count);
    glowGeometry.setDrawRange(0,glowGeometry.userData.coreIndexCount+glowGeometry.userData.jetIndexCount*count);
  };
  jets.onBeforeRender=syncJets;glow.onBeforeRender=syncJets;
  // The launch flash and pressure front have separate lifetimes from the rolling fire.
  const flashMaterial=shader(
    `uniform float uTime;uniform vec3 uColor;varying vec2 vLocal;
    void main(){
      float t=uTime,r=length(vLocal);
      float burst=smoothstep(0.0,.012,t)*(1.0-smoothstep(.028,.090,t));
      float disk=exp(-pow(r/1.13,6.0));
      float halo=exp(-r*r*.8)*.16;
      float alpha=(disk+halo)*burst;
      if(alpha<.002)discard;
      vec3 color=mix(mix(uColor,vec3(1.0,.63,.18),.7),vec3(1.0,.88,.56),disk);
      gl_FragColor=vec4(color*1.65*${explosionLightGain.toFixed(1)},clamp(alpha,0.0,1.0));${output}
    }`,
    `varying vec2 vLocal;void main(){
      vLocal=position.xy*vec2(6.4,4.4);
      float scale=length(modelMatrix[1].xyz)*uSize;
      vec4 mv=modelViewMatrix*vec4(0,0,0,1);mv.z+=1.35*scale;
      mv.xy+=vLocal*scale;gl_Position=projectionMatrix*mv;
    }`,{},true);
  flashMaterial.blending=THREE.AdditiveBlending;flashMaterial.forceSinglePass=true;
  const flash=mesh(new THREE.PlaneGeometry(1,1),flashMaterial,4);flash.name='airburst-flash';
  const waveMaterial=shader(
    `uniform float uTime;uniform vec3 uBurstOffset;varying vec2 vWave;
    void main(){
      float r=length(vWave);if(r<.70||r>1.02)discard;
      float a=atan(vWave.y,vWave.x);
      float contour=.88+sin(a*11.0+uBurstOffset.x)*.042+sin(a*19.0+uBurstOffset.y)*.021+sin(a*5.0+uBurstOffset.z)*.027;
      float width=(.027+.008*sin(a*7.0+uBurstOffset.y))/1.5;
      float band=1.0-smoothstep(width*.4,width,abs(r-contour));
      float life=smoothstep(.035,.055,uTime)*(1.0-smoothstep(.045,.250,uTime));
      float alpha=band*life*.50;
      if(alpha<.003)discard;
      gl_FragColor=vec4(vec3(.27,.29,.34),alpha);${output}
    }`,
    `uniform float uTime;varying vec2 vWave;
    void main(){
      float t=max(0.0,uTime-.035),radius=1.5*min(5.8,.58+t*28.0);
      vWave=position.xy*2.0;vec4 mv=modelViewMatrix*vec4(0,0,0,1);
      mv.xy+=vWave*radius*uSize*length(modelMatrix[1].xyz);gl_Position=projectionMatrix*mv;
    }`,burstUniforms,false);
  waveMaterial.forceSinglePass=true;
  const wave=mesh(new THREE.PlaneGeometry(1,1),waveMaterial,2);wave.name='airburst-shockwave';

  const arcPositions=[],arcUvs=[],arcIds=[],arcIndices=[];
  for(let id=0;id<2;id++){
    const offset=arcPositions.length/3;
    for(let i=0;i<=96;i++)for(let edge=0;edge<2;edge++){arcPositions.push(0,0,0);arcUvs.push(i/96,edge);arcIds.push(id);}
    for(let i=0;i<96;i++){const a=offset+i*2;arcIndices.push(a,a+2,a+1,a+1,a+2,a+3);}
  }
  const arcGeometry=new THREE.BufferGeometry();arcGeometry.setAttribute('position',new THREE.Float32BufferAttribute(arcPositions,3));arcGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(arcUvs,2));arcGeometry.setAttribute('aArc',new THREE.Float32BufferAttribute(arcIds,1));arcGeometry.setIndex(arcIndices);
  const arcMaterial=shader(`
    uniform float uTime;uniform vec3 uColor,uBurstOffset;varying vec2 vUv;varying float vArc;
    ${field}
    void main(){
      float t=uTime-vArc*.035;
      float folds=noise3(vec3(vUv.x*15.0,vUv.y*1.9,uTime*1.8)+uBurstOffset+vArc*5.0);
      float tear=smoothstep(mix(.58,.34,vArc),mix(1.06,.85,vArc),t);
      float matter=folds*.65+sin(vUv.x*3.141593)*.35;
      float coverage=smoothstep(tear-.05,tear+.065,matter);
      float edge=abs(vUv.y-.5)*2.0;
      float alpha=(1.0-smoothstep(.62,1.0,edge))*pow(max(0.0,sin(vUv.x*3.141593)),.42)*coverage;
      alpha*=smoothstep(.055,.15,t)*(1.0-smoothstep(.75,1.08,t));
      if(alpha<.005)discard;
      float crease=pow(.5+.5*sin(vUv.x*33.0-uTime*7.0+vArc*4.0),2.0);
      vec3 tint=uColor*vec3(1.0,.16,.08);
      tint=mix(tint,vec3(1.0,.20,.025),crease*.30*(1.0-smoothstep(.15,.48,uTime)));
      gl_FragColor=vec4(tint*(1.25+folds*.65)*(1.0-vArc*.18)*${explosionLightGain.toFixed(1)},alpha);${output}
    }`,`
    uniform float uTime;uniform vec3 uBurstOffset;attribute float aArc;varying vec2 vUv;varying float vArc;
    vec3 ribbon(float u,float t){
      float phase=aArc*3.8+uBurstOffset.x*.11;
      float angle=u*(3.35-aArc*.45)+aArc*2.6+t*.55;
      float launch=1.0-exp(-max(0.0,t-.035)*24.0);
      float r=(2.02+aArc*.16+.20*sin(u*13.0-t*3.4+phase)+.10*sin(u*29.0+t*5.0))*launch;
      vec3 p=vec3(cos(angle)*r,sin(u*9.0-t*3.8+phase)*.30+sin(u*19.0+t*4.0)*.11,sin(angle)*r);
      float tilt=.35+aArc*.86;float y=p.y*cos(tilt)-p.z*sin(tilt);p.z=p.y*sin(tilt)+p.z*cos(tilt);p.y=y;
      p.y+=aArc*.16-(1.0-aArc)*(u-.5)*.85;return p;
    }
    void main(){
      vUv=uv;vArc=aArc;float t=max(0.0,uTime-aArc*.035);
      vec4 mv=modelViewMatrix*vec4(ribbon(uv.x,t)*uSize,1.0);
      vec4 next=modelViewMatrix*vec4(ribbon(uv.x+.004,t)*uSize,1.0);
      vec2 tangent=next.xy-mv.xy;tangent=length(tangent)>.0001?normalize(tangent):vec2(1,0);
      float width=(.10+.34*pow(max(0.0,sin(uv.x*3.141593)),.7))*(.68+.32*sin(uv.x*23.0-t*6.0+aArc));
      width*=1.0-smoothstep(.5,1.0,t)*.55;
      float twist=uv.x*10.0-t*4.0+aArc*.9;width*=(.65+.35*sin(twist))*mix(1.0,.24,aArc);
      mv.z+=(uv.y-.5)*width*sin(twist)*uSize*length(modelMatrix[1].xyz);
      mv.xy+=vec2(-tangent.y,tangent.x)*(uv.y-.5)*width*uSize*length(modelMatrix[1].xyz);
      gl_Position=projectionMatrix*mv;
    }`,burstUniforms,false);
  arcMaterial.forceSinglePass=true;
  const arcs=mesh(arcGeometry,arcMaterial,3);arcs.name='airburst-arcs';

  // Heads and path-sampled trails share one allocation and one draw call.
  // Samples come from absolute age, so rewind and variable update rates stay identical.
  const emberPositions=[],emberUvs=[],emberParts=[],emberIndices=[];
  for(let i=0;i<=28;i++)for(let edge=0;edge<2;edge++){
    emberPositions.push(0,0,0);emberUvs.push(i/28,edge);emberParts.push(0);
  }
  for(let i=0;i<28;i++){const a=i*2;emberIndices.push(a,a+2,a+1,a+1,a+2,a+3);}
  const headOffset=emberPositions.length/3;
  for(const [x,y] of [[-.5,-.5],[.5,-.5],[-.5,.5],[.5,.5]]){emberPositions.push(x,y,0);emberUvs.push(x+.5,y+.5);emberParts.push(1);}
  emberIndices.push(headOffset,headOffset+1,headOffset+2,headOffset+2,headOffset+1,headOffset+3);
  const emberGeometry=new THREE.BufferGeometry();
  emberGeometry.setAttribute('position',new THREE.Float32BufferAttribute(emberPositions,3));emberGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(emberUvs,2));emberGeometry.setAttribute('aPart',new THREE.Float32BufferAttribute(emberParts,1));emberGeometry.setIndex(emberIndices);
  const sparkMaterial=shader(`
    uniform vec3 uColor;varying vec2 vUv;varying float vFade,vPart,vLong;
    void main(){
      float alpha;vec3 color;vec3 particleColor=uColor;
      if(vPart>.5){
        float r=length((vUv-.5)*2.0);
        float core=exp(-r*r*28.0),halo=exp(-r*r*4.0)*(1.0-smoothstep(.65,1.0,r));
        alpha=(core*.98+halo*.48)*vFade;
        color=particleColor*(.5*${emissiveGain.toFixed(1)});
      }else{
        if(vLong<.5)discard;
        float edge=abs(vUv.y-.5)*2.0;
        alpha=exp(-edge*edge*3.5)*smoothstep(0.0,.16,vUv.x)*(.35+.50*vUv.x)*vFade;
        color=mix(vec3(.24,.20,.23),particleColor,pow(vUv.x,10.0));
      }
      if(alpha<.003)discard;
      gl_FragColor=vec4(color,alpha);${output}
    }`,`
    attribute vec4 seed;attribute float aPart;uniform float uTime;uniform vec3 uBurstOffset;
    varying vec2 vUv;varying float vFade,vPart,vLong;
    vec3 emberPath(float age,float isLong){
      // Fixed launch heading; drag slows expansion without steering the particle.
      float launchAngle=seed.x*6.283185+uBurstOffset.x*.17;
      float launchY=seed.y*1.82-.91;
      float horizontal=sqrt(max(0.0,1.0-launchY*launchY));
      vec3 launchDirection=vec3(cos(launchAngle)*horizontal,launchY,sin(launchAngle)*horizontal);
      float outwardDistance=(1.0-exp(-age*mix(3.8,2.5,isLong)))*mix(2.7+seed.z*2.0,5.15+seed.w*.15,isLong);
      float gravityDrop=age*age*(1.1+seed.w*.2);
      return launchDirection*(.12+outwardDistance)-vec3(0,gravityDrop,0);
    }
    void main(){
      vUv=uv;vPart=aPart;vLong=step(.90,seed.z);
      if(aPart<.5&&vLong<.5){vFade=0.0;gl_Position=vec4(2,2,2,1);return;}
      float age=max(0.0,uTime-.015-seed.w*.11);
      float life=mix(.55+seed.w*.5,1.38+seed.w*.28,vLong);
      vFade=smoothstep(0.0,.025,age)*(1.0-smoothstep(life*.54,life,age));
      vFade*=.88+.12*sin(age*(18.0+seed.y*15.0)+seed.x*11.0);
      float sampleAge=age;
      if(aPart<.5){sampleAge=max(0.0,age-(1.0-uv.x)*(.48+seed.w*.28));vFade*=smoothstep(0.0,.055,sampleAge)*vLong;}
      vec4 mv=modelViewMatrix*vec4(emberPath(sampleAge,vLong)*uSize,1.0);
      vec4 next=modelViewMatrix*vec4(emberPath(sampleAge+.008,vLong)*uSize,1.0);
      float scale=uSize*length(modelMatrix[1].xyz);
      // Perspective division also handles motion toward the camera.
      vec4 clip=projectionMatrix*mv,nextClip=projectionMatrix*next;
      vec2 projectedDelta=(nextClip.xy/max(nextClip.w,.0001)-clip.xy/max(clip.w,.0001))/vec2(projectionMatrix[0][0],projectionMatrix[1][1]);
      float projectedSpeed=length(projectedDelta)*max(-mv.z,.0001)/max(.008*scale,.0001);
      float directionWeight=smoothstep(.02,.20,projectedSpeed);
      vec2 tangent=length(projectedDelta)>.000001?normalize(projectedDelta):vec2(1,0);
      vec2 side=vec2(-tangent.y,tangent.x);
      if(aPart>.5){
        float diameter=1.5*mix(.105+seed.w*.075,.36+seed.w*.12,vLong);
        float streak=1.0+(1.0-vLong)*(1.0-smoothstep(.025,.22,age))*1.7*directionWeight;
        mv.xy+=(tangent*position.x*diameter*streak+side*position.y*diameter)*scale;
      }else{
        float width=1.5*(.045+seed.w*.035)*(.25+.75*uv.x);
        mv.xy+=side*(uv.y-.5)*width*scale*directionWeight;
      }
      gl_Position=projectionMatrix*mv;
    }`,burstUniforms,false);
  sparkMaterial.forceSinglePass=true;
  const embers=instanced(emberGeometry,cap,1,sparkMaterial,4);embers.name='airburst-embers';
  animated.push(()=>{
    const t=Math.round(uniforms.uTime.value*1e8)/1e8;syncJets();
    // At 2.11s the maximum possible smoke coverage is below .48:
    // 1-smoothstep(1.8,2.4,2.11) < .48. Every fragment was already discarded.
    // Keep the public 2.4s lifecycle; only stop submitting invisible volumes.
    core.visible=t>0&&t<2.11;jets.visible=t>0&&t<2.11;
    glow.visible=t>0&&t<1.30;flash.visible=t>0&&t<.090;wave.visible=t>.035&&t<.250;
    arcs.visible=t>.055&&t<1.10;embers.visible=t>.015&&t<1.80;
  });
  return true;
}

// Reference-driven, three-dimensional combustion burst. This module also ships
// inside standalone exports. No texture fetches or host post-processing required.
function buildInkExplosionEffect({THREE,spec,cap,uniforms,animated,mesh,instanced,shader,noise,output}) {
  if(spec.id!=='fire-explosion'||spec.renderStyle!=='toon')return false;
  let state=(spec.seed??119431)>>>0;
  const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  const field=`
    float hash3(vec3 p){p=fract(p*.3183099+vec3(.11,.17,.23));p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
    float field3(vec3 p){
      vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
      return mix(mix(mix(hash3(i),hash3(i+vec3(1,0,0)),f.x),mix(hash3(i+vec3(0,1,0)),hash3(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash3(i+vec3(0,0,1)),hash3(i+vec3(1,0,1)),f.x),mix(hash3(i+vec3(0,1,1)),hash3(i+vec3(1,1,1)),f.x),f.y),f.z);
    }
    float turbulence(vec3 p){return field3(p)*.64+field3(p*2.03+5.1)*.26+field3(p*4.01-2.7)*.10;}
    vec3 hotColor(vec3 base,float heat){
      vec3 flame=min(base*(1.2+max(0.0,heat)*3.0),vec3(1.0));
      return mix(flame,vec3(1.0,.97,.85),smoothstep(.75,1.10,heat));
    }
  `;
  function opaque(material){material.transparent=false;material.depthWrite=true;material.blending=THREE.NoBlending;material.side=THREE.FrontSide;return material;}
  function additive(material){material.blending=THREE.AdditiveBlending;material.depthWrite=false;material.forceSinglePass=true;return material;}
  function patch(count,steps,sides,flatFirst=false){
    const positions=[],uvs=[],seeds=[],indices=[];
    for(let id=0;id<count;id++){
      const offset=positions.length/3,seed=[id,random(),random(),random()];
      const rows=flatFirst&&id===0?1:steps,columns=flatFirst&&id===0?1:sides;
      for(let u=0;u<=rows;u++)for(let v=0;v<=columns;v++){positions.push(0,0,0);uvs.push(u/rows,v/columns);seeds.push(...seed);}
      for(let u=0;u<rows;u++)for(let v=0;v<columns;v++){const a=offset+u*(columns+1)+v,b=a+columns+1;indices.push(a,b,a+1,a+1,b,b+1);}
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
    geometry.setAttribute('aSeed',new THREE.Float32BufferAttribute(seeds,4));geometry.setIndex(indices);return geometry;
  }
  // Unequal overlapping lobes roll and rise as one turbulent mass. The cloud is
  // not a collection of uniformly scaled, uniformly colored balls.
  const positions=[],normals=[],lobes=[],seeds=[],indices=[],lobeSpecs=[];
  const sphere=new THREE.SphereGeometry(1,24,18);
  for(let id=0;id<18;id++){
    const lower=id<8,middle=id<15,angle=id*2.399963+random()*.35;
    const radius=lower?1.12+random()*.2:middle?.75+random()*.25:.35;
    const height=lower?.61+random()*.13:middle?1.22+random()*.18:1.75+random()*.2;
    const size=lower?.69+random()*.18:middle?.65+random()*.18:.65+random()*.15;
    const params=[Math.cos(angle)*radius,height,Math.sin(angle)*radius,size],seed=[random(),random(),random(),id],offset=positions.length/3;
    lobeSpecs.push(params);
    for(let v=0;v<sphere.attributes.position.count;v++){
      positions.push(...sphere.attributes.position.array.slice(v*3,v*3+3));
      normals.push(...sphere.attributes.normal.array.slice(v*3,v*3+3));lobes.push(...params);seeds.push(...seed);
    }
    for(const index of sphere.index.array)indices.push(offset+index);
  }
  sphere.dispose();
  const volumeGeometry=new THREE.BufferGeometry();
  for(const [name,values,size]of [['position',positions,3],['normal',normals,3],['aLobe',lobes,4],['aSeed',seeds,4]])volumeGeometry.setAttribute(name,new THREE.Float32BufferAttribute(values,size));
  volumeGeometry.setIndex(indices);
  const volume=opaque(shader(`
    uniform float uTime;uniform vec3 uColor;
    varying vec3 vLocal,vNormal,vView;varying float vHeight,vSeed;
    ${field}
    void main(){
      if(uTime<=0.0||uTime>=1.95)discard;
      vec3 flow=vLocal*2.5+vec3(vSeed*19.0,-uTime*.95,0.0);
      float broad=turbulence(flow),grain=field3(flow*3.4);
      // Holes open from below, then through the lifted crown. Shared 3D noise
      // keeps erosion attached to the volume as the viewing angle changes.
      float burn=smoothstep(.45,2.10,uTime)*.95+(1.0-smoothstep(.0,3.2,vHeight))*.40;
      if(broad+.19<burn)discard;
      vec3 n=normalize(vNormal),view=normalize(-vView);
      float rim=pow(1.0-max(0.0,dot(n,view)),2.4);
      float heat=1.20-uTime*1.9+(vHeight-1.2)*.30+rim*.65+(broad-.5)*.25+vSeed*.05;
      heat-=sin(clamp((uTime-.15)/.80,0.0,1.0)*3.141593)*.12;
      float flame=smoothstep(.32,.68,heat);
      float light=.45+.55*max(0.0,dot(n,normalize(vec3(-.35,.8,.5))));
      vec3 soot=mix(vec3(.003,.0035,.005),vec3(.022,.023,.028),light*(.65+broad*.35));
      soot*=.86+grain*.16*uDetail;
      vec3 color=mix(soot,hotColor(uColor,heat),flame);
      color=mix(color,vec3(1.0,.98,.88),smoothstep(.96,1.23,heat));
      float edge=(1.0-smoothstep(.0,.045,broad+.19-burn))*step(.60,uTime)*(1.0-smoothstep(.65,1.05,uTime));
      color=mix(color,hotColor(uColor,.55),edge*.6);
      gl_FragColor=vec4(color,1.0);${output}
    }`, `
    uniform float uTime;attribute vec4 aLobe,aSeed;
    varying vec3 vLocal,vNormal,vView;varying float vHeight,vSeed;
    ${field}
    vec3 lobeSurface(vec3 point,float t,vec4 seed,mat3 roll){
      float wrinkle=turbulence(point*2.5+seed.x*19.0+vec3(0.0,-t*.95,0.0));
      vec3 local=roll*point,shape=local*vec3(1.05,.88,1.0);
      shape.x+=local.y*local.y*(seed.y-.5)*.35;
      return shape*(.60+wrinkle*.88);
    }
    void main(){
      float t=uTime,launch=1.0-exp(-t*56.0),spread=1.0-exp(-t*32.0);
      float turn=t*(.65+aSeed.x*.55)*(aSeed.z>.5?1.0:-1.0),c=cos(turn),s=sin(turn);
      mat3 roll=mat3(c,s,0.0,-s,c,0.0,0.0,0.0,1.0);
      vLocal=position;vSeed=aSeed.x;
      float swell=(.78+launch*.22)*(1.0+min(t,.9)*.19);
      vec3 center=aLobe.xyz*vec3(spread,launch,spread);
      center.xz*=1.0+min(t,.9)*.12;
      center.y+=max(0.0,t-.3)*(.48+aSeed.y*.4);
      vec3 surface=lobeSurface(position,t,aSeed,roll);
      vec3 tangent=normalize(cross(normal,abs(normal.y)>.99?vec3(1,0,0):vec3(0,1,0))),bitangent=cross(normal,tangent);
      vec3 dx=lobeSurface(normalize(position+tangent*.012),t,aSeed,roll)-surface;
      vec3 dy=lobeSurface(normalize(position+bitangent*.012),t,aSeed,roll)-surface;
      vec3 p=center+surface*aLobe.w*swell;
      p.y=max(.025,p.y);vHeight=p.y;p*=uSize;p.y-=1.35;
      vec4 mv=modelViewMatrix*vec4(p,1.0);vView=mv.xyz;vNormal=normalMatrix*normalize(cross(dx,dy));
      gl_Position=projectionMatrix*mv;
    }`,{},false));
  const cloud=mesh(volumeGeometry,volume,1);cloud.name='fire-explosion-billowing-volume';

  // Per-lobe emission halos and one wider spill share one small batch. They give
  // the hot folds a soft fringe without depending on host Bloom or HDR clipping.
  const halo=additive(shader(`
    uniform float uTime;uniform vec3 uColor;varying vec2 vUv;varying float vHeat,vWide;
    void main(){
      float d=length((vUv-.5)*2.0);
      float fade=smoothstep(.0,.018,uTime)*smoothstep(.0,.7,vHeat);
      float alpha=exp(-d*d*mix(5.5,4.8,vWide))*(1.0-smoothstep(.72,1.0,d))*fade*mix(.22,.36,vWide);
      if(alpha<.001)discard;
      gl_FragColor=vec4(min(uColor*2.8,vec3(1.0)),alpha);${output}
    }`, `
    uniform float uTime;attribute vec4 aLobe,aSeed;varying vec2 vUv;varying float vHeat,vWide;
    void main(){
      vUv=uv;float t=uTime,launch=1.0-exp(-t*56.0);vWide=step(17.5,aSeed.x);
      vec3 center=aLobe.xyz*vec3(1.0-exp(-t*32.0),launch,1.0-exp(-t*32.0));
      center.xz*=1.0+min(t,.9)*.12;center.y+=max(0.0,t-.3)*.65;
      center*=uSize;center.y-=1.35;
      vec4 mv=modelViewMatrix*vec4(center,1.0);
      float radius=aLobe.w*(1.0+min(t,.9)*.19)*launch;
      mv.z+=radius*.62*uSize*length(modelMatrix[1].xyz);
      mv.xy+=(uv-.5)*radius*3.6*uSize*length(modelMatrix[1].xyz);
      vHeat=1.0-t*1.8+(aLobe.y-1.2)*.18;
      gl_Position=projectionMatrix*mv;
    }`,{},true));
  const haloGeometry=patch(19,1,1),haloCenters=[];
  for(const params of [...lobeSpecs,[0,1.15,0,1.9]])for(let i=0;i<4;i++)haloCenters.push(...params);
  haloGeometry.setAttribute('aLobe',new THREE.Float32BufferAttribute(haloCenters,4));
  const glow=mesh(haloGeometry,halo,3);glow.name='fire-explosion-local-glow';

  const groundMaterial=shader(`
    uniform float uTime;uniform vec3 uColor;varying vec2 vUv;varying vec4 vSeed;
    ${field}${noise}
    void main(){
      float kind=vSeed.x,t=uTime,alpha;vec3 color;
      if(kind<.5){
        vec2 p=(vUv-.5)*2.0;float r=length(p);
        float dist=r+(noise2(p*3.5)-.5)*.24;
        vec2 cells=p*3.0,cell=floor(cells),f=fract(cells);
        float first=10.0,second=10.0;
        for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
          vec2 at=vec2(float(x),float(y)),id=cell+at;
          vec2 jitter=vec2(hash3(vec3(id,1.0)),hash3(vec3(id,2.0)))*.7+.15;
          float d=length(at+jitter-f);
          if(d<first){second=first;first=d;}else if(d<second)second=d;
        }
        float lava=(1.0-smoothstep(.025,.11,second-first))*(1.0-smoothstep(.3,1.0,dist));
        float heat=1.0-smoothstep(.65,2.8,t);
        color=mix(vec3(.012,.010,.009),hotColor(uColor,.6),lava*heat);
        alpha=(1.0-smoothstep(.7,1.0,dist))*(1.0-smoothstep(2.25,2.8,t))*.85;
      }else if(kind<2.5){
        float edge=sin(vUv.y*3.141593);
        float rough=noise2(vec2(vUv.x*24.0-kind*9.0,vUv.y*6.0-t*.4));
        float fade=1.0-smoothstep(.45,1.05,t);
        alpha=smoothstep(.0,.22,edge)*(.45+rough*.40)*fade*smoothstep(.0,.035,t);
        if(rough+.15<smoothstep(.30,1.4,t)*.6)discard;
        color=mix(vec3(.23,.24,.26),hotColor(uColor,.65),1.0-smoothstep(.30,.68,t));
      }else{
        float rip=noise2(vec2(vUv.x*18.0-kind*7.0,vUv.y*2.0-t*1.8));
        if(rip<.20)discard;
        alpha=sin(vUv.y*3.141593)*.85*smoothstep(.0,.035,t)*(1.0-smoothstep(.22,.56,t));
        color=hotColor(uColor,.85);
      }
      if(alpha<.005)discard;gl_FragColor=vec4(color,alpha);${output}
    }`, `
    uniform float uTime;attribute vec4 aSeed;varying vec2 vUv;varying vec4 vSeed;
    void main(){
      vUv=uv;vSeed=aSeed;vec3 p;
      if(aSeed.x<.5)p=vec3((uv.x-.5)*3.35,.022,(uv.y-.5)*3.35);
      else if(aSeed.x<2.5){
        float t=uTime,angle=uv.x*6.283185;
        float wave=sin(angle*9.0+t*2.0+aSeed.x)*.14+sin(angle*17.0-.7+aSeed.x)*.08+sin(angle*5.0)*.10;
        float radius=(1.0-exp(-t*13.0))*(1.70+aSeed.x*.46)+min(t,1.5)*.62;
        radius+=(uv.y-.5)*(.32+aSeed.x*.15)+wave;
        p=vec3(cos(angle)*radius,.04+sin(uv.y*3.141593)*.025,sin(angle)*radius);
      }else{
        float t=uTime,angle=uv.x*6.283185+t*2.6;
        float r=(1.0-exp(-t*48.0))*(2.12-(aSeed.x-3.0)*.42)+t*.28;
        r+=sin(angle*7.0+aSeed.x)*.045+sin(angle*13.0)*.035;
        p=vec3(cos(angle)*r,.55+(aSeed.x-3.0)*.88+sin(angle*3.0+t*3.0)*.08+(uv.y-.5)*.12,sin(angle)*r);
      }
      p*=uSize;p.y-=1.35;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);
    }`,{},false);
  groundMaterial.forceSinglePass=true;
  const ground=mesh(patch(5,128,4,true),groundMaterial,2);ground.name='fire-explosion-pressure-and-scorch';

  // Ballistic 3D tubes carry hot heads and cooling, curling smoke tails.
  const pathFunction=`
    vec3 path(float age,vec4 seed){
      float angle=seed.x*2.399963+seed.y*.8;
      float travel=(1.0-exp(-age*8.0))*(2.5+seed.z*.8);
      float lift=(1.0-exp(-age*10.0))*(1.4+seed.w*2.6)-age*age*2.8;
      vec3 p=vec3(cos(angle)*travel,max(.055,lift+.35),sin(angle)*travel);
      float curl=sin(age*15.0+seed.y*13.0)*age*.12;
      p+=vec3(-sin(angle)*curl,cos(age*11.0+seed.z*9.0)*age*.06,cos(angle)*curl);
      return p;
    }
  `;
  const trailMaterial=shader(`
    uniform float uTime;uniform vec3 uColor;varying vec2 vUv;varying vec4 vSeed;
    ${field}
    void main(){
      float alpha=smoothstep(.0,.025,uTime)*(1.0-smoothstep(.55,1.70,uTime));
      float head=smoothstep(.94,.98,vUv.x),heat=max(head,1.0-smoothstep(.08,.27,uTime));
      alpha*=mix(.28,.95,heat)*smoothstep(.0,.20,vUv.x);
      if(alpha<.005)discard;
      gl_FragColor=vec4(mix(vec3(.19,.19,.20),hotColor(uColor,.70),heat),alpha);${output}
    }`, `
    uniform float uTime;attribute vec4 aSeed;varying vec2 vUv;varying vec4 vSeed;
    ${pathFunction}
    void main(){
      vUv=uv;vSeed=aSeed;
      float t=max(0.0,uTime-aSeed.y*.025),tail=max(0.0,t-.5),age=mix(tail,t,uv.x);
      vec3 p=path(age,aSeed),direction=normalize(path(age+.002,aSeed)-p);
      vec3 side=normalize(cross(direction,vec3(0.0,1.0,.01))),up=cross(side,direction);
      float width=mix(.020,.055,smoothstep(.95,1.0,uv.x))*(.5+sin(uv.x*3.141593)*.5);
      p+=(side*cos(uv.y*6.283185)+up*sin(uv.y*6.283185))*width;
      p*=uSize;p.y-=1.35;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);
    }`,{},false);
  trailMaterial.forceSinglePass=true;
  const trails=mesh(patch(11,32,4),trailMaterial,2);trails.name='fire-explosion-ballistic-trails';

  const sparks=additive(shader(`
    uniform vec3 uColor;varying vec2 vUv;varying float vFade,vSeed;
    ${field}
    void main(){
      vec2 p=(vUv-.5)*2.0;float d=abs(p.x)+abs(p.y);
      float core=1.0-smoothstep(.08,.48,d),halo=exp(-d*d*4.0)*(1.0-smoothstep(.7,1.0,d));
      float alpha=(core+halo*.45)*vFade;
      if(alpha<.005)discard;
      gl_FragColor=vec4(mix(hotColor(uColor,.65),vec3(1.0,.98,.87),core),alpha);${output}
    }`, `
    attribute vec4 seed;uniform float uTime;varying vec2 vUv;varying float vFade,vSeed;
    void main(){
      vUv=uv;vSeed=seed.w;float t=max(0.0,uTime-seed.y*.08);
      float angle=seed.x*6.283185,travel=(1.0-exp(-t*12.0))*(1.2+seed.z*2.3);
      vec3 p=vec3(cos(angle)*travel,max(.04,(1.0-exp(-t*8.0))*(.25+seed.w*1.7)-t*t*1.4),sin(angle)*travel);
      vec3 velocity=vec3(cos(angle)*exp(-t*5.0),.4+seed.w-t*2.0,sin(angle)*exp(-t*5.0));
      vec2 axis=(modelViewMatrix*vec4(velocity,0.0)).xy;
      float len=length(axis);axis=len>.0001?axis/len:vec2(1,0);
      vec2 side=vec2(-axis.y,axis.x);
      p*=uSize;p.y-=1.35;vec4 mv=modelViewMatrix*vec4(p,1.0);
      float streakLength=(.18+seed.z*.38)*(1.0-smoothstep(.12,.55,t))+.09;
      float width=.08+seed.w*.07;
      mv.xy+=(axis*position.x*streakLength+side*position.y*width)*uSize*length(modelMatrix[1].xyz);
      vFade=smoothstep(.0,.015,t)*(1.0-smoothstep(.40,1.4+seed.w*.6,t));
      gl_Position=projectionMatrix*mv;
    }`,{},true));
  const embers=instanced(new THREE.PlaneGeometry(1,1),cap,1,sparks,3);embers.name='fire-explosion-embers';
  animated.push(()=>{
    const t=uniforms.uTime.value;
    cloud.visible=t>0&&t<1.95;glow.visible=t>0&&t<.68;
    ground.visible=t>0&&t<2.8;trails.visible=t>0&&t<1.70;embers.visible=t>0&&t<2.1;
    // Discarded bands must stop consuming vertex work. Only the two-triangle
    // scorch remains after the ground smoke ends; buffers are reused on replay.
    ground.geometry.setDrawRange(0,6+(t<.56?4:t<1.05?2:0)*128*4*6);
  });
  return true;
}

// Local +X points forward. The tip is shared by the asset and preview contact test.
function electricArrowTip(size) { return 1.7 * size; }

function createElectricArrowEffect(T, spec, options = {}) {
  const group = new T.Group(); group.name = spec.id;
  const lifecycle = {start: spec.lifecycle?.start ?? 1.2, end: spec.lifecycle?.end ?? 1.4};
  let settings, time = 0, ending = -1, impact = false, disposed = false, travelSpeed = 0, count = 0;
  let sourceLocked = false;
  // A cast seed is separate from the stable catalog seed. No per-frame randomness.
  let variationSeed = (Math.random() * 4294967296) >>> 0;
  const noise = (key, salt = 0) => {
    let x = (variationSeed ^ spec.seed ^ Math.imul(key + 1, 0x9e3779b1) ^ Math.imul(salt + 1, 0x85ebca6b)) >>> 0;
    x = Math.imul(x ^ (x >>> 16), 0x7feb352d); x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
    return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
  };
  const direction = new T.Vector3(1,0,0), axis = new T.Vector3(1,0,0);
  const sourceWorld = new T.Matrix4(), inverse = new T.Matrix4(), scratch = new T.Vector3();
  const geometries = new Set(), materials = new Set();
  const u = {uTime:{value:0},uCharge:{value:0},uEnd:{value:-1},uImpact:{value:0},uFlight:{value:0},uSize:{value:1},uDetail:{value:1},uColor:{value:new T.Color(spec.color)}};
  const common = `uniform float uTime,uCharge,uEnd,uImpact,uFlight,uSize,uDetail;uniform vec3 uColor;
    float hash(float n){return fract(sin(n*127.1+311.7)*43758.5453);}
    float fade(){return uEnd<0.0?1.0:1.0-smoothstep(0.0,uImpact>.5?.10:1.0,uEnd);}
    float charged(){return smoothstep(0.0,.2,uCharge);}
    // Fivefold instantaneous discharge energy, draining within 90ms; no range change.
    float contactPunch(float age){return 1.0+4.0*(1.0-smoothstep(.012,.09,max(0.0,age)));}
    const float PI=3.14159265359;`;
  const output = '\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n';
  function material(vertex,fragment,extra={},additive=true) {
    const m=new T.ShaderMaterial({uniforms:{...u,...extra},vertexShader:common+vertex,fragmentShader:common+fragment,
      transparent:true,depthWrite:false,depthTest:true,side:T.DoubleSide,forceSinglePass:true,
      blending:additive?T.AdditiveBlending:T.NormalBlending,toneMapped:false});
    materials.add(m);return m;
  }
  function mesh(name,g,m,order=2){geometries.add(g);const o=new T.Mesh(g,m);o.name=name;o.renderOrder=order;o.frustumCulled=false;group.add(o);return o;}
  // A narrow white core and four closed, detached blade prisms. Empty space
  // between blades is real geometry, so the spearhead stays open from any view.
  function arrowGeometry(){
    const p=[],idx=[],layers=[];const rings=[[-1.7,0],[-1.48,.045],[.40,.055],[1.18,.09],[1.7,0]];
    rings.forEach(([x,r])=>{for(let j=0;j<4;j++){const a=j*Math.PI/2+Math.PI/4;p.push(x,Math.cos(a)*r,Math.sin(a)*r);}});
    layers.push(...Array(p.length/3).fill(0));
    for(let i=0;i<rings.length-1;i++)for(let j=0;j<4;j++){const a=i*4+j,b=i*4+(j+1)%4;idx.push(a,b,a+4,b,b+4,a+4);}
    for(let j=0;j<4;j++){
      const a=j*Math.PI/2+Math.PI/4,c=Math.cos(a),s=Math.sin(a),n=p.length/3;
      // Swept-back hooked blades: an open inner edge exposes the energy core.
      const outline=[[.18,.49],[.60,.46],[1.60,.055],[.89,.21],[.46,.24]];
      for(const side of [-1,1])for(const [x,r] of outline){const w=(.035+.055*Math.min(1,r/.3))*side;p.push(x,c*r-s*w,s*r+c*w);layers.push(1);}
      for(let k=1;k<4;k++)idx.push(n,n+k+1,n+k,n+5,n+5+k,n+6+k);
      for(let k=0;k<5;k++){const b=(k+1)%5;idx.push(n+k,n+b,n+k+5,n+b,n+b+5,n+k+5);}
    }
    for(let j=0;j<4;j++){const a=j*Math.PI/2,c=Math.cos(a),s=Math.sin(a),n=p.length/3;p.push(-1.62,c*.06,s*.06,-1.48,c*.18,s*.18,-.92,c*.06,s*.06,-1.45,c*.06-s*.035,s*.06+c*.035);layers.push(1,1,1,1);idx.push(n,n+1,n+3,n+1,n+2,n+3,n+2,n,n+3,n,n+2,n+1);}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('aBlade',new T.Float32BufferAttribute(layers,1));g.setIndex(idx);const flat=g.toNonIndexed();g.dispose();flat.computeVertexNormals();return flat;
  }
  const bodyVertex=`attribute float aBlade;varying float vBlade;varying vec3 vN,vV,vP;
    void main(){vec3 p=position*uSize;p.yz*=mix(.06,1.0,smoothstep(.05,.78,uCharge));
    vBlade=aBlade;vP=position;vec4 mv=modelViewMatrix*vec4(p,1);vN=normalize(normalMatrix*normal);vV=-mv.xyz;gl_Position=projectionMatrix*mv;}`;
  const bodyFragment=`varying float vBlade;varying vec3 vN,vV,vP;
    void main(){float rim=pow(1.0-abs(dot(normalize(vN),normalize(vV))),1.4);
    float reveal=smoothstep(-.2,.15,uCharge*3.8-(vP.x+1.7));float stripe=pow(.5+.5*sin(vP.x*24.0-uTime*15.0),14.0);
    float a=reveal*charged()*fade();
    // Contact erodes the arrow from tip to tail instead of fading a solid card.
    if(uImpact>.5){float age=max(0.0,uEnd)*${lifecycle.end.toFixed(4)};float cell=hash(floor(vP.x*23.0)+floor(atan(vP.z,vP.y)*5.0)*37.0);
      a*=1.0-smoothstep(.03,.10,age+(vP.x+1.7)*.010+cell*.015);}
    if(a<.003)discard;
    float head=smoothstep(.35,.62,vP.x),center=exp(-length(vP.yz)*26.0);
    float tip=smoothstep(1.08,1.7,vP.x),ridge=pow(rim,2.0);
    float tension=smoothstep(.86,1.0,uCharge)*.14;
    vec3 gold=uColor*(.48+.30*abs(normalize(vN).y));
    float hot=clamp((1.0-vBlade)*.90+center*.45+tip*.65+ridge*.22+stripe*.04+tension*tip,0.0,.95);
    vec3 col=mix(gold,vec3(1.0,.99,.88),hot);
    gl_FragColor=vec4(col,a*.94);${output}}`;
  mesh('projectile-core',arrowGeometry(),material(bodyVertex,bodyFragment,{},false));
  const hg=new T.BufferGeometry(),hp=[],hu=[],hi=[];
  for(let k=0;k<3;k++){const a=k*Math.PI/3,c=Math.cos(a),s=Math.sin(a),n=hp.length/3;hp.push(-2.0,-c*.95,-s*.95,1.9,-c*.95,-s*.95,1.9,c*.95,s*.95,-2.0,c*.95,s*.95);hu.push(0,0,1,0,1,1,0,1);hi.push(n,n+1,n+2,n,n+2,n+3);}
  hg.setAttribute('position',new T.Float32BufferAttribute(hp,3));hg.setAttribute('uv',new T.Float32BufferAttribute(hu,2));hg.setIndex(hi);
  mesh('electric-arrow-halo',hg,material(`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position*uSize,1);}`,
    `varying vec2 vUv;void main(){float x=vUv.x,y=abs(vUv.y*2.0-1.0);float head=exp(-pow((x-.76)*7.0,2.0));float w=.08+head*.25;
    float core=exp(-pow(y/w,2.0)*3.0),halo=exp(-pow(y/(w+.25),2.0)*4.0);float taper=pow(max(0.0,sin(x*PI)),.6);
    float pulse=.94+.06*sin(uTime*13.0+x*8.0);float a=(core*.20+halo*.11)*taper*charged()*fade()*pulse*min(uDetail,1.5);
    if(a<.002)discard;gl_FragColor=vec4(uColor,a);${output}}`),3);
  // Fixed-capacity ribbon pools: two event banks per channel allow a dying
  // discharge to coexist with its successor, without adding meshes or resources.
  function pool(channels, forks, segments, rings = 0) {
    const paths = [], indices = [];
    let vertices = 0;
    for (let i = 0; i < channels * 2 * (forks + 1) + rings; i++) {
      const ring = i >= channels * 2 * (forks + 1), n = ring ? 64 : segments;
      paths.push({offset:vertices, segments:n, points:new Float32Array((n+1)*3)});
      for(let j=0;j<n;j++){const a=vertices+j*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
      vertices += (n+1)*2;
    }
    const geometry=new T.BufferGeometry();
    for(const [name,n] of [['position',3],['aTangent',3],['aWidth',1],['aEvent',4],['uv',2]]) {
      geometry.setAttribute(name,new T.BufferAttribute(new Float32Array(vertices*n),n).setUsage(T.DynamicDrawUsage));
    }
    geometry.setIndex(indices);
    const cache=new Float64Array(channels*2);cache.fill(NaN);
    return {geometry,paths,channels,forks,cache,mode:-1,seed:-1,dirty:false};
  }
  const ribbonVertex=`attribute vec3 aTangent;attribute float aWidth;attribute vec4 aEvent;
    uniform float uClock,uCutoff,uAttack;varying float vF,vAcross,vEnergy,vRing,vAge;
    void main(){vF=uv.x;vAcross=uv.y;vRing=step(1.5,aEvent.w);vec3 p=position;
      float age=uClock-aEvent.x,life=max(.001,aEvent.y);vAge=age;
      float growth=smoothstep(0.0,uAttack,age);
      float live=smoothstep(0.0,.005,age)*pow(max(0.0,1.0-max(0.0,age)/life),.48);
      float ember=.10*exp(-max(0.0,age-life)*70.0)*step(life,age)*step(age,life+.04);
      vEnergy=(live+ember)*aEvent.z*smoothstep(vF-.07,vF+.015,growth);
      if(uCutoff>=0.0&&aEvent.x>uCutoff)vEnergy=0.0;
      if(vRing>.5){float t=max(0.0,age);p*=1.0-exp(-t*11.0);vEnergy=smoothstep(0.0,.025,age)*(1.0-smoothstep(.22,1.15,age))*aEvent.z;}
      vec4 mv=modelViewMatrix*vec4(p*uSize,1);vec2 tangent=(modelViewMatrix*vec4(aTangent,0)).xy;
      vec2 n=normalize(vec2(-tangent.y,tangent.x)+vec2(.00001,0));mv.xy+=n*uv.y*aWidth*uSize;
      gl_Position=projectionMatrix*mv;}`;
  function dischargeMaterial(clock,kind){
    return material(ribbonVertex,`uniform float uClock;varying float vF,vAcross,vEnergy,vRing,vAge;
      void main(){float core=exp(-abs(vAcross)*mix(7.0,20.0,vRing)),halo=pow(max(0.0,1.0-abs(vAcross)),3.0);
      float energy=vEnergy*${kind==='impact'?'mix(contactPunch(uClock),1.0,vRing)':kind==='trail'?'smoothstep(.55,1.0,uCharge)*fade()*uFlight':'charged()*fade()'};
      float band=1.0;
      if(vRing>.5){float sector=floor(vF*23.0),edge=fract(vF*23.0);
        float breakTime=.19+hash(sector+7.0)*.48;
        band=(.46+.20*sin(vF*PI*18.0-uTime*5.0))*(1.0-smoothstep(breakTime,breakTime+.20,vAge));
        band*=mix(1.0,smoothstep(.02,.12,edge)*(1.0-smoothstep(.82,.98,edge)),smoothstep(.12,.42,vAge));}
    float a=(core*.95+halo*.32)*energy*band*min(1.35,.65+uDetail*.35);
      if(a<.002)discard;vec3 color=mix(uColor,vec3(1.0,.99,.87),core*(vRing>.5?.20:.82));
      gl_FragColor=vec4(color,a);${output}}`,{uClock:clock,uAttack:{value:kind==='impact'?.012:.024},uCutoff:kind==='impact'?{value:-1}:stopClock});
  }
  const arrowClock={value:0},impactClock={value:0},stopClock={value:-1};
  const arcPool=pool(4,3,32),trailPool=pool(3,0,16),blastPool=pool(8,3,32,2);
  mesh('electric-arrow-arcs',arcPool.geometry,dischargeMaterial(arrowClock,'arrow'),4);
  // Scalar scratch buffers are reused by midpoint subdivision and branch generation.
  const startPoint=new Float64Array(3),endPoint=new Float64Array(3);
  function fracture(path,start,end,key,amplitude,limit=0){
    const p=path.points,n=path.segments;
    for(let c=0;c<3;c++){p[c]=start[c];p[n*3+c]=end[c];}
    for(let stride=n;stride>1;stride/=2){
      const half=stride/2,amp=amplitude*Math.pow(stride/n,.72);
      for(let i=half;i<n;i+=stride)for(let c=0;c<3;c++){
        p[i*3+c]=(p[(i-half)*3+c]+p[(i+half)*3+c])*.5+(noise(key,i*3+c)-.5)*2*amp*(c===0?.55:1);
      }
    }
    for(let i=0;i<=n;i++){
      const j=i*3;
      if(limit){const r=Math.hypot(p[j],p[j+1],p[j+2]);if(r>limit)for(let c=0;c<3;c++)p[j+c]*=limit/r;}
      else {p[j]=T.MathUtils.clamp(p[j],-4.2,1.72);const r=Math.hypot(p[j+1],p[j+2]);if(r>1.35){p[j+1]*=1.35/r;p[j+2]*=1.35/r;}}
    }
  }
  function uploadPath(batch,index,birth,life,power,width,kind=0){
    const path=batch.paths[index],p=path.points,n=path.segments,a=batch.geometry.attributes;
    for(let i=0;i<=n;i++){
      const before=Math.max(0,i-1)*3,after=Math.min(n,i+1)*3;
      const tx=p[after]-p[before],ty=p[after+1]-p[before+1],tz=p[after+2]-p[before+2],inv=1/(Math.hypot(tx,ty,tz)||1);
      for(let side=0;side<2;side++){
        const v=path.offset+i*2+side;
        a.position.setXYZ(v,p[i*3],p[i*3+1],p[i*3+2]);a.aTangent.setXYZ(v,tx*inv,ty*inv,tz*inv);
        a.aWidth.setX(v,width*(kind===2?1:1-i/n*.82));a.uv.setXY(v,i/n,side?1:-1);
        a.aEvent.setXYZW(v,birth,life,power,kind);
      }
    }
    batch.dirty=true;
  }
  function generateEvent(batch,channel,event,bank,birth,mode){
    const isBlast=batch===blastPool,isTrail=batch===trailPool;
    const family=isBlast?10000:isTrail?20000:0,key=family+channel*701+event*47;
    // A quarter of alternate strokes revisit their preceding channel, with
    // different pulse energy; the remaining strokes choose new directions.
    const routeEvent=event>0&&event%2===1&&noise(key,99)<.5?event-1:event;
    const route=family+channel*701+routeEvent*47,first=(channel*2+bank)*(batch.forks+1);
    const life=.09+noise(key,1)*.05;
    // Four unequal outward leaders, with secondary surface crawlers between
    // them. Their lobes turn for each cast; they never form an eight-ray star.
    const angle=isBlast?noise(432,2)*Math.PI*2+[.0,.85,2.70,4.15][channel%4]+(noise(route,2)-.5)*.68:noise(route,2)*Math.PI*2;
    const charge=Math.min(1,Math.max(0,birth)/lifecycle.start);
    let power=1.05+noise(key,5)*.40,width=.235,amplitude=.40;
    if(isBlast){
      const secondary=channel>=4;
      const z=secondary?(noise(route,3)-.5)*.18:.15+noise(route,3)*.68,r=Math.sqrt(1-z*z),reach=secondary?1.60+noise(route,4)*1.25:2.45+noise(route,4)*.80;
      startPoint.fill(0);endPoint[0]=z*reach;endPoint[1]=Math.cos(angle)*r*reach;endPoint[2]=Math.sin(angle)*r*reach;
      amplitude=secondary?.28:.52;width=secondary?.11:.25;
      power*=secondary?Math.max(0,1-Math.max(0,birth-.22)/.55)*.42:birth<.45?1.12:0;
    }else if(isTrail){
      startPoint[0]=-1.2;startPoint[1]=Math.cos(angle)*.06;startPoint[2]=Math.sin(angle)*.06;
      endPoint[0]=-2.0-noise(route,4)*2.1;endPoint[1]=Math.cos(angle+.6)*.36;endPoint[2]=Math.sin(angle+.6)*.36;
      amplitude=.16;width=.095;power*=.58;
    }else{
      const tight=1-.72*T.MathUtils.smoothstep(charge,.875,1),radius=(.38+noise(route,3)*.65)*tight;
      startPoint[0]=charge<.3?-1.7:-1.6+noise(route,6)*.9;
      startPoint[1]=Math.cos(angle)*(charge<.3?.88:radius);startPoint[2]=Math.sin(angle)*(charge<.3?.88:radius);
      endPoint[0]=charge<.3?-.55+charge*3:.90+noise(route,7)*.72;
      endPoint[1]=Math.cos(angle+noise(route,8)*2)*.10;endPoint[2]=Math.sin(angle+noise(route,8)*2)*.10;
      amplitude=(.36+noise(route,10)*.38)*tight;
      power*=charge<.25?(channel<2?.65:0):charge<.5?(channel<3?.85:0):1;
      if(mode===1){startPoint[0]-=.85;startPoint[1]*=1.25;startPoint[2]*=1.25;amplitude=.34+noise(route,10)*.2;}
    }
    if(event<0||birth<0)power=0;
    const main=batch.paths[first];fracture(main,startPoint,endPoint,route,amplitude,isBlast?3.25:0);
    uploadPath(batch,first,birth,life,power,width);
    for(let branch=1;branch<=batch.forks;branch++){
      const bkey=route+branch*151,root=5+Math.floor(noise(bkey,12)*19),j=root*3;
      for(let c=0;c<3;c++)startPoint[c]=main.points[j+c];
      const a=noise(bkey,13)*Math.PI*2,reach=(isBlast?.6:.30)+noise(bkey,14)*(isBlast?.8:.66);
      endPoint[0]=startPoint[0]+(isBlast?(noise(bkey,15)-.25)*reach:mode===1?-.3-reach*.6:.16+noise(bkey,15)*.45);
      endPoint[1]=startPoint[1]+Math.cos(a)*reach;endPoint[2]=startPoint[2]+Math.sin(a)*reach;
      if(!isBlast&&charge>.86&&mode===0){endPoint[1]*=.65;endPoint[2]*=.65;}
      fracture(batch.paths[first+branch],startPoint,endPoint,bkey,.14+reach*.16,isBlast?3.25:0);
      // Forks appear only once the leader has reached their actual connection.
      const strength=noise(key,30+branch)<.18?0:power*(.38+noise(bkey,31)*.30);
      uploadPath(batch,first+branch,birth+root/main.segments*(isBlast?.012:.024),life*.65,strength,width*.50,1);
    }
  }
  function syncPool(batch,clock,mode=0){
    const period=batch===blastPool?.15:batch===trailPool?.16:.145;
    if(batch.seed!==variationSeed||batch.mode!==mode){batch.cache.fill(NaN);batch.seed=variationSeed;batch.mode=mode;}
    for(let c=0;c<batch.channels;c++){
      const offset=batch===blastPool?(c<4?c*.002:.035+(c-4)*.022):c*period/batch.channels;
      const current=Math.floor((clock-offset+1e-9)/period);
      for(let bank=0;bank<2;bank++){
        const event=current-bank,index=c*2+bank;
        if(batch.cache[index]===event)continue;
        batch.cache[index]=event;
        const birth=event*period+offset+(batch===blastPool&&event===0&&c<4?0:noise(c+event*47,batch===blastPool?700:300)*.012);
        generateEvent(batch,c,event,bank,birth,mode);
      }
    }
    if(batch.dirty){for(const attr of Object.values(batch.geometry.attributes))attr.needsUpdate=true;batch.dirty=false;}
  }
  // Sigil is a real plane perpendicular to the arrow, frozen in world space on release.
  const sigil=mesh('electric-arrow-sigil',new T.PlaneGeometry(2.6,2.6),material(`varying vec2 vUv;void main(){vUv=uv*2.0-1.0;gl_Position=projectionMatrix*modelViewMatrix*vec4(position*uSize,1);}`,
    `varying vec2 vUv;float line(float d,float w){return 1.0-smoothstep(w,w+max(fwidth(d),.001),abs(d));}
    void main(){float r=length(vUv),a=atan(vUv.y,vUv.x)+uTime*.23;float rings=line(r-.89,.004)+line(r-.82,.002)+line(r-.57,.003);
    float sector=fract(a/(2.0*PI)*20.0),x=(sector-.5)*2.0,y=(r-.7)/.08;
    float rune=max(line(x,.085)*step(abs(y),.8),line(y-x*.65,.10)*step(abs(x),.65))*step(abs(y),1.0);
    float ticks=line(sin(a*32.0),.12)*step(.91,r)*step(r,.95);
    float t=max(0.0,uTime-${lifecycle.start.toFixed(4)});float alive=charged()*(1.0-smoothstep(0.0,.42,t))*fade();
    float spokes=line(sin(a*6.0),.03)*step(.3,r)*step(r,.52);float bloom=exp(-pow((r-.87)*25.0,2.0))*.21+exp(-r*r*5.0)*.10;
    float focus=mix(1.0,.43,smoothstep(.25,.9,uCharge));
    float alpha=(rings*.9+rune*.8+ticks*.7+spokes*.4+bloom)*alive*focus; if(r>1.0||alpha<.003)discard;gl_FragColor=vec4(uColor,alpha*min(uDetail,1.4));${output}}`),1);
  sigil.rotation.y=Math.PI/2;
  mesh('projectile-trails',trailPool.geometry,dischargeMaterial(arrowClock,'trail'),3);
  // Rings occupy two persistent paths in the same impact draw as the event pool.
  for(let k=0;k<2;k++){
    const index=blastPool.paths.length-2+k,path=blastPool.paths[index],r=3.25-k*.45;
    for(let i=0;i<=path.segments;i++){const a=i/path.segments*Math.PI*2,j=i*3;path.points[j]=k?Math.sin(a)*r*.58:0;path.points[j+1]=Math.cos(a)*r;path.points[j+2]=Math.sin(a)*r*(k?.82:1);}
    uploadPath(blastPool,index,.08+k*.10,1.1,.44,.13,2);
  }
  const hitMesh=mesh('lifecycle-impact',blastPool.geometry,dischargeMaterial(impactClock,'impact'),4);
  const glow=mesh('lifecycle-contact-glow',new T.PlaneGeometry(2,2),material(`varying vec2 vUv;void main(){vUv=uv*2.0-1.0;vec4 center=modelViewMatrix*vec4(0,0,0,1);center.xy+=position.xy*uSize*(.65+(1.0-exp(-max(uEnd,0.0)*14.0))*1.9);gl_Position=projectionMatrix*center;}`,
    `varying vec2 vUv;void main(){float t=uEnd*${lifecycle.end.toFixed(4)},r=length(vUv),a=atan(vUv.y,vUv.x);
    float hot=exp(-r*r*55.0)*exp(-t*27.0);
    float horizontal=exp(-abs(vUv.y)*90.0)*exp(-abs(vUv.x)*5.0);
    float vertical=exp(-abs(vUv.x)*120.0)*exp(-abs(vUv.y)*9.0);
    float rays=(horizontal+vertical*.45)*exp(-t*24.0);
    float cloud=exp(-r*r*12.0)*exp(-t*7.0);
    // The brief contact peak yields to the lightning web and two shock rings.
    float alpha=((hot*1.15+rays*.85)*contactPunch(t)+cloud*.24)*(1.0-smoothstep(.72,1.0,r));
    if(alpha<.003)discard;gl_FragColor=vec4(mix(uColor,vec3(1.0,.99,.86),clamp(hot*1.3+rays,0.0,.95)),alpha);${output}}`),5);
  const base=new T.PlaneGeometry(1,1),pg=new T.InstancedBufferGeometry();pg.setIndex(base.index.clone());for(const key of Object.keys(base.attributes))pg.setAttribute(key,base.attributes[key].clone());base.dispose();
  const seeds=new Float32Array(spec.maxParticles*4);let seed=spec.seed;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};for(let i=0;i<seeds.length;i++)seeds[i]=random();pg.setAttribute('aSeed',new T.InstancedBufferAttribute(seeds,4));
  const particles=mesh('electric-arrow-particles',pg,material(`attribute vec4 aSeed;uniform vec3 uContact;varying vec2 vUv;varying float vFade;
    void main(){vUv=uv*2.0-1.0;float a=aSeed.x*PI*2.0,z=aSeed.y*2.0-1.0;vec3 dir=vec3(z,sqrt(1.0-z*z)*cos(a),sqrt(1.0-z*z)*sin(a));vec3 p;
    if(uImpact>.5){float age=max(0.0,uEnd)*${lifecycle.end.toFixed(4)};float t=max(0.0,age-aSeed.w*.14);p=uContact+dir*(.1+(1.0-exp(-t*3.0))*(2.2+aSeed.z*.8))*uSize;p.y-=t*t*.16*uSize;vFade=smoothstep(0.0,.04,t)*(1.0-smoothstep(.30+aSeed.z*.3,1.35,t));}
    else{float f=fract(aSeed.z+uTime*.5);p=vec3(-2.2+f*3.6,dir.y,dir.z)*(1.0-f*.65)*uSize;vFade=sin(f*PI)*charged()*fade()*.6;}
    vec4 mv=modelViewMatrix*vec4(p,1);mv.xy+=position.xy*(.017+aSeed.w*.027)*uSize;gl_Position=projectionMatrix*mv;}`,
    `varying vec2 vUv;varying float vFade;void main(){float d=abs(vUv.x)+abs(vUv.y);float a=(1.0-smoothstep(.4,1.0,d))*vFade;if(a<.003)discard;gl_FragColor=vec4(mix(uColor,vec3(1),.35),a);${output}}`,{uContact:{value:new T.Vector3()}}),4);
  function phase(){return disposed||ending>=0&&time-ending>=lifecycle.end-1e-9?'finished':ending>=0?'ending':time>=lifecycle.start-1e-9?'active':'starting';}
  function sync(){
    u.uTime.value=time;u.uCharge.value=Math.min(1,(ending<0?time:ending)/lifecycle.start);u.uEnd.value=ending<0?-1:(time-ending)/lifecycle.end;u.uImpact.value=impact?1:0;
    u.uFlight.value=travelSpeed>0?1:0;arrowClock.value=time;impactClock.value=Math.max(0,time-ending);stopClock.value=ending;
    const lastEventTime=ending<0?time:ending;
    syncPool(arcPool,lastEventTime,travelSpeed>0?1:0);syncPool(trailPool,lastEventTime);
    if(impact)syncPool(blastPool,Math.min(.70,time-ending));
    group.visible=phase()!=='finished';hitMesh.visible=impact&&phase()==='ending';glow.visible=hitMesh.visible&&u.uEnd.value<.65;
    sigil.visible=time<lifecycle.start+.42&&phase()!=='finished';
    if(sourceLocked){group.updateWorldMatrix(true,false);inverse.copy(group.matrixWorld).invert();sigil.matrix.multiplyMatrices(inverse,sourceWorld);sigil.matrix.decompose(sigil.position,sigil.quaternion,sigil.scale);}
    else{sigil.position.set(-1.7*settings.size,0,0);sigil.rotation.set(0,Math.PI/2,0);sigil.scale.set(1,1,1);}
  }
  function setOptions(next={}){
    if(disposed)return;const previous=settings??{color:spec.color,size:1,speed:1,detail:1,density:spec.defaultDensity??.5};settings={...previous,...next};
    delete settings.quantity;delete settings.spread;delete settings.panelCount;
    for(const key of ['size','speed','detail','density']){const min=key==='density'?.125:.25,max=key==='density'?1:2;settings[key]=T.MathUtils.clamp(Number.isFinite(settings[key])?settings[key]:previous[key],min,max);}
    if(!/^#[0-9a-f]{6}$/i.test(settings.color))settings.color=spec.color;
    u.uColor.value.set(settings.color);u.uSize.value=settings.size;u.uDetail.value=settings.detail;count=Math.round(spec.maxParticles*settings.density);pg.instanceCount=count;sync();
  }
  function lockSource(){if(sourceLocked)return;group.updateWorldMatrix(true,true);sourceWorld.copy(sigil.matrixWorld);sourceLocked=true;}
  function update(dt){
    if(disposed||phase()==='finished'||!Number.isFinite(dt)||dt<0)return;
    if(ending<0&&(travelSpeed>0||time+dt*settings.speed>=lifecycle.start))lockSource();
    time+=dt*settings.speed;if(ending<0&&travelSpeed>0)group.position.addScaledVector(direction,dt*travelSpeed);sync();
  }
  function stop(){if(disposed||ending>=0)return;lockSource();ending=time;sync();}
  function hit(position,normal){
    if(disposed||ending>=0||position&&![position.x,position.y,position.z].every(Number.isFinite))return;
    lockSource();hitMesh.position.set(electricArrowTip(settings.size),0,0);
    if(position){scratch.copy(position);if(group.parent){group.parent.updateWorldMatrix(true,false);group.parent.worldToLocal(scratch);}const offset=hitMesh.position.clone().multiply(group.scale).applyQuaternion(group.quaternion);group.position.copy(scratch).sub(offset);}
    glow.position.copy(hitMesh.position);particles.material.uniforms.uContact.value.copy(hitMesh.position);
    group.updateWorldMatrix(true,false);inverse.copy(group.matrixWorld).invert();scratch.copy(normal??axis.clone().transformDirection(group.matrixWorld).negate());
    if(!Number.isFinite(scratch.lengthSq())||scratch.lengthSq()<1e-10)scratch.copy(axis).transformDirection(group.matrixWorld).negate();
    scratch.transformDirection(inverse);hitMesh.quaternion.setFromUnitVectors(axis,scratch);impact=true;stop();
  }
  function reset(replay={}){
    if(disposed)return;
    if(replay.variationSeed!==undefined&&(!Number.isInteger(replay.variationSeed)||replay.variationSeed<0||replay.variationSeed>4294967295))throw new RangeError('variationSeed must be an unsigned 32-bit integer');
    variationSeed=replay.variationSeed??((variationSeed+0x9e3779b9)>>>0);
    time=0;ending=-1;impact=false;sourceLocked=false;hitMesh.position.set(0,0,0);glow.position.set(0,0,0);hitMesh.quaternion.identity();sync();
  }
  function dispose(){if(disposed)return;disposed=true;group.visible=false;group.removeFromParent();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();geometries.clear();materials.clear();group.clear();}
  setOptions(options);
  return {group,update,setOptions,hit,stop,reset,dispose,setEndpoints(){},
    setDirection(vector,speed=4){if(disposed||ending>=0||!vector||!Number.isFinite(vector.lengthSq())||vector.lengthSq()===0)return;direction.copy(vector).normalize();travelSpeed=Number.isFinite(speed)?Math.max(0,speed):0;group.quaternion.setFromUnitVectors(axis,direction);},
    get variationSeed(){return variationSeed;},get settings(){return {...settings};},get elapsed(){return time;},get phase(){return phase();},get finished(){return phase()==='finished';},get particleCount(){return count;},get lifecycle(){return {...lifecycle};}};
}

// Shared with the original grass effect. Keep the wind and brush equations stable.
function painterlyWindGLSL(){return `
 float grassHash(float n) { return fract(sin(n * 127.1 + 311.7) * 43758.5453); }
 vec2 windAt(vec2 root, float phase) {
   float wave = sin(dot(root, vec2(1.1, .7)) - uTime * 1.45);
   float gust = .5 + .5 * sin(dot(root, vec2(.48, -.31)) - uTime * .63);
   float flutter = sin(uTime * 2.6 + phase + root.x * 3.0) * .025;
   return vec2(.12 + wave * .11 + gust * .13, .035 + wave * .045 + flutter);
 }
`;}
function painterlyBrushGLSL(){return `
 float brushStreak(float h, float seed) {
   return sin(h * 23.0 + sin(h * 9.0 + seed * 11.0) * 2.2 + seed * 31.0);
 }
`;}

import * as THREE from 'three';

// 預覽與單檔匯出共用；全部材質以程式生成，不依賴外部貼圖或後製。
export function createEffect(spec, options = {}) {
  if(spec.supportVfxKind)return createSupportVfxEffect(spec,options);
  if(spec.id==='sacred-relic-descent')return createSacredRelicEffect(THREE,spec,options);
  if(spec.indicatorShape)return createSpellIndicatorEffect(THREE,spec,options);
  if(spec.renderMode==='postprocess')throw new Error('Postprocess effects require createImpactFramePass and an EffectComposer, not createEffect or scene.add(group).');
  if(spec.id==='electric-magic-arrow-strike')return createElectricArrowEffect(THREE,spec,options);
  if(['weapon-smear','spatial-smear'].includes(spec.id))return createWeaponSmearEffect(THREE,spec,options);
  const kind = spec.kind;
  const variant = spec.variant;
  const quantityDefault = ({"0:3":3,"1:1":4,"1:3":6,"3:1":12,"3:3":9,"3:4":5,"2:4":9,"2:5":3,"2:6":4,"2:7":3,"3:7":10,"2:8":7,"3:8":13,"7:0":7,"7:1":4,"1:5":9,"3:9":14,"3:10":9,"1:6":8})[`${kind}:${variant}`] ?? 1;
  const toon = spec.renderStyle === 'toon' && (kind === 3 || kind === 4);
  // Golden Chain retains its original 512-slot density distribution; only
  // rising crack chips multiply their allocation, keeping erosion chips intact.
  const cap = spec.id==='golden-chain-rain'?512:Math.min(kind === 5 ? 128 : 1024, Math.max(1, spec.maxParticles));
  const group = new THREE.Group();
  group.name = spec.id;
  let settings = { ...(spec.id==='golden-chain-rain'?{spriteChains:true}:{}), color: spec.color, size: spec.sizeRange?.default??1, density: spec.defaultDensity ?? 0.5, speed: 1, detail: spec.detailRange?.default??1, ...(spec.quantity ? {quantity:spec.quantity.default} : {}), ...(spec.spread ? {spread:spec.spread.default} : {}), ...(spec.crackBloomSpread ? {crackBloomSpread:spec.crackBloomSpread.default} : {}), ...(spec.crackBloom ? {crackBloom:spec.crackBloom.default} : {}), ...(spec.textureDensity ? {textureDensity:spec.textureDensity.default} : {}), ...(spec.panelCount ? {panelCount:spec.panelCount.default} : {}), ...options };
  let time = 0, disposed = false, travelSpeed = 0, endpoints = null, count = 0;
  const direction = new THREE.Vector3(1, 0, 0);
  const axis = new THREE.Vector3(1, 0, 0);
  const scratch = new THREE.Vector3();
  const geometries = new Set();
  const materials = new Set();
  const allocations = [];
  const animated = [];
  const variation = spec.id==='billowing-airburst' ? {seed:(Math.random()*4294967296)>>>0,reset:null} : null;
  const coreParts=[];
  const stagePlanes=[];
  const stageOpaque=[];
  function corePart(object,axes="xyz",pivot=0){coreParts.push({object,axes,pivot,scale:object.scale.clone(),position:object.position.clone()});return object;}
  const uniforms = {
    uTime: { value: 0 }, uColor: { value: new THREE.Color() },
    uCrackBloomSpread: {value:spec.crackBloomSpread?.default??1}, uCrackBloom: {value:spec.crackBloom?.default??.15}, uSpriteChains: {value:0}, uTextureDensity: {value:spec.textureDensity?.default??1}, uPanelCount: { value: spec.panelCount?.default??0 }, uQuantity: { value: quantityDefault }, uSpread: { value: 1 }, uStretch: { value: 1 }, uSize: {value:1}, uDetail:{value:1}, uDensity:{value:.5},
  };
  // Lifecycle time is visual time. World travel remains in unscaled seconds.
  const durations = {0:[.35,.8],1:[variant===2?1.6:.4,.6],2:[.7,1],4:[1.1,1.4],5:[.5,1.2]};
  const fallback = spec.burst ? [spec.duration*.1,spec.duration*.45] : durations[kind] ?? [.3,.8];
  const lifecycle = {start:Math.max(.001,Number(spec.lifecycle?.start)||fallback[0]),end:Math.max(.001,Number(spec.lifecycle?.end)||fallback[1])};
  if(Number.isFinite(spec.lifecycle?.hitEnd)&&spec.lifecycle.hitEnd>0)lifecycle.hitEnd=spec.lifecycle.hitEnd;
  let phase='starting', endTime=0, stopTime=-1, endStart=1, impact=false;
  const lifeUniforms={uLifeStage:{value:0},uLifeStart:{value:0},uLifeEnd:{value:0},uLifeOrigin:{value:1},uStopTime:{value:-1},uEndDuration:{value:lifecycle.end},uImpact:{value:0},uImpactAge:{value:0},uImpactProgress:{value:0},uEmitterTime:{value:0}};
  const clipToGroup=new THREE.Matrix4(),groupToClip=new THREE.Matrix4();
  let lastRenderFrame=-1,lastCamera=null;
  // Stage deformation is applied to the already animated surface in group space.
  // The active path returns immediately, retaining the original shader output.
  const lifeVertex=`
    uniform float uLifeStage,uLifeStart,uLifeEnd,uLifeOrigin;
    uniform mat4 uClipToGroup,uGroupToClip;
    varying vec3 vStagePosition;varying float vStagePart;
    vec3 stageShape(vec3 p,float s,float e,float part){
      float grow=s*s*(3.0-2.0*s),curl=(1.0-grow);
      #if KIND == 0
        float tail=1.0-smoothstep(-1.4,.25,p.x);
        #if VARIANT == 0
          p.yz*=mix(.22,1.0,grow);p.x=mix(p.x*.38-.16,p.x,grow);
          p.y+=sin(p.x*4.5+s*7.0)*curl*.15;
        #elif VARIANT == 1
          p.x*=mix(1.3,1.0,grow);p.yz*=mix(.08,1.0,grow);
        #elif VARIANT == 2 || VARIANT == 4
          float assemble=ceil((atan(p.z,p.y)+3.14159)*3.0)*.028;
          p.yz*=1.0+curl*(.8+assemble);p.x-=curl*(.2+assemble);
        #elif VARIANT == 3
          p.yz*=1.0+curl*.8;p.x+=sin(p.y*7.0)*curl*.4;
        #elif VARIANT == 5
          p.z+=sin(p.x*4.0)*curl*.75;p.x-=curl*.5;
        #else
          p.yz*=1.0+curl*.85;float turn=curl*2.4;
          p.yz=mat2(cos(turn),-sin(turn),sin(turn),cos(turn))*p.yz;
        #endif
        p.x-=e*tail*1.6;p.yz*=1.0-e*.75;
      #elif KIND == 1
        // Range is revealed in fragments; endpoints never change coordinates.
        p.yz*=mix(.35,1.0,grow)*(1.0-e*.7);
      #elif KIND == 2
        float r=length(p.xz),a=atan(p.z,p.x);
        float cell=floor((a+3.14159)*3.0);float stagger=smoothstep(.04+fract(part*.37+cell*.13)*.2,.9,e);
        #if VARIANT == 0
          p.y+=curl*(.15+sin(a*5.0)*.08);float returnTime=smoothstep(.0,.72,e);float turn=returnTime*.8;p.xz=mat2(cos(turn),-sin(turn),sin(turn),cos(turn))*p.xz;p.xz*=1.0-returnTime*.95;p.y=mix(p.y,.06,returnTime)+sin(returnTime*3.14159)*.32;
        #elif VARIANT == 1
          p.y*=grow*(1.0-stagger*.8);p.y+=sin(stagger*3.14159)*.16;p.xz*=1.0+stagger*.1;
        #elif VARIANT == 2
          vec2 cellCenter=(floor(p.xz*2.5)+.5)/2.5;vec2 local=p.xz-cellCenter;float tumble=stagger*(1.0+fract(cell*.71)*2.0);p.xz=cellCenter*(1.0+stagger*.65)+local*cos(tumble);p.y+=local.x*sin(tumble)+sin(stagger*3.14159)*(.25+fract(cell*.71)*.45)-stagger*stagger*.35;p.xz*=mix(.7,1.0,grow);
        #elif VARIANT == 3
          p.y*=grow;float release=smoothstep(fract(cell*.37)*.2,.72,e);p*=1.0+release*.4;p.y+=release*(.12+max(0.0,p.y)*.4);
        #elif VARIANT == 4
          p.y*=grow;p.xz*=1.0+stagger*.32;p.y-=stagger*stagger*max(0.0,p.y)*.9;p.x+=sin(part*3.1)*stagger*.18;
        #elif VARIANT == 5
          p.y*=grow;float release=smoothstep(.02+fract(part*.31)*.2,.72,e);float loosen=release*(.4+max(0.0,p.y)*.7);p.xz+=vec2(cos(part*2.4),sin(part*2.4))*loosen;p.y+=sin(release*3.14159)*.28-release*release*.55;
        #elif VARIANT == 6
          float height=max(0.0,p.y);float retract=smoothstep(.0,.9,e);float bend=retract*height*2.1;float turn=curl*2.7+retract*.4;
          p.xz=mat2(cos(turn),-sin(turn),sin(turn),cos(turn))*p.xz;p.xz*=1.0-retract*.3;p.xz+=vec2(cos(a),sin(a))*(cos(bend)-1.0)*height*.45;
          p.y=grow*(height*cos(bend)*(1.0-retract*.5)+min(p.y,0.0));
        #elif VARIANT == 7
          float slide=smoothstep(.04+(.5+.5*sin(a*3.0))*.25,.9,e);p.y*=grow*(1.0-slide);p.y+=sin(slide*3.14159)*(.08+.06*sin(a*2.0));p.xz*=1.0-slide*.83;
        #else
          float pop=smoothstep(.08+fract(part*.41)*.25,.65+fract(part*.41)*.25,e);p.y*=grow*(1.0-pop*.85);p.xz*=mix(.55,1.0,grow)*(1.0+sin(pop*3.14159)*.65);
        #endif
      #elif KIND == 3
        float radius=length(p.xz),angle=atan(p.z,p.x);
        #if VARIANT == 2
          float crest=sin(radius*5.0-e*5.0+sin(angle*5.0));p.y+=crest*sin(e*3.14159)*.18;p.xz*=1.0+e*.12;
        #elif VARIANT == 4
          float h=max(0.0,p.y+1.3);p.z+=sin(h*4.0-e*6.0)*e*.4;p.y+=cos(h*3.5-e*5.0)*e*.24;p.x*=1.0+e*.2;
        #elif VARIANT == 5
          p.x+=sin(p.y*25.0+floor(e*17.0))*e*.07;p.z+=sin(p.y*18.0-floor(e*13.0))*e*.06;
        #elif VARIANT == 6
          float h=max(0.0,p.y+1.3);float roll=e*3.8+radius*2.0;p.y+=sin(roll)*h*.7;p.xz*=1.0+sin(roll)*h*.15;
        #elif VARIANT == 7
          float ray=length(p);p*=1.0-e*.22;p.y+=sin(ray*7.0+e*8.0)*e*.04;
        #endif
      #elif KIND == 4
        float h=clamp((p.y+1.4)/3.4,0.0,1.0);
        // 大範圍捲流向內聚攏；正常持續及收尾（s=1）保持原來的變形。
        float gather=curl*(1.0-smoothstep(0.0,.6,e));
        p.y=-1.4+(p.y+1.4)*(1.0+gather*.10);
        float turn=gather*(1.0-h)*.55-e*.45;p.xz=mat2(cos(turn),-sin(turn),sin(turn),cos(turn))*p.xz;p.xz*=1.0+gather*.45+e*.18;
        #if VARIANT == 1
          p.y=max(-1.38,p.y-e*e*h*.7);
        #endif
      #elif KIND == 5
        #if VARIANT == 1
          p.xz*=mix(.18,1.0,grow)*(1.0+e*.18);
        #else
          p.y=-1.4+(p.y+1.4)*mix(.2,1.0,grow);
        #endif
      #endif
      return p;
    }
  `;
  const lifeFragment=`
    uniform float uLifeStage,uLifeStart,uLifeEnd,uLifeOrigin,uImpact;
    varying vec3 vStagePosition;varying float vStagePart;
    float phaseCoverage(vec3 p){
      float s=uLifeStart,e=uLifeEnd;
      float a=atan(p.z,p.x),r=length(p.xz);
      float start=1.0,end=1.0;
      #if KIND == 0
        #if VARIANT == 0
          float curl=sin(p.x*6.0+p.y*5.0+s*9.0)*.06;
          start=smoothstep(0.0,.18,s)*smoothstep(-.12,.12,s-(.15+clamp(-p.x,0.0,3.0)*.2+curl));
        #elif VARIANT == 1
          start=smoothstep(.0,.12,s)*smoothstep(-.1,.1,s-abs(p.x)*.24);
        #elif VARIANT == 2 || VARIANT == 4
          start=smoothstep(-.08,.08,s-(.12+fract(atan(p.z,p.y)*1.7)*.56));
        #elif VARIANT == 3
          start=smoothstep(-.12,.12,s-(.1+fract(p.x*.8+p.y)*.55));
        #elif VARIANT == 5
          start=smoothstep(-.13,.13,s-(.15+clamp(-p.x,0.0,2.0)*.25));
        #else
          start=smoothstep(-.13,.13,s-(.1+fract(atan(p.z,p.y)*.5-p.x*.3)*.6));
        #endif
        end=1.0-smoothstep(0.0,uImpact>.5?.28:.9,e);
      #elif KIND == 1
        float x=clamp((p.x+2.4)/4.8,0.0,1.0);
        start=smoothstep(-.08,.08,s*1.16-.08-x);
        end=smoothstep(-.14,.05,x-e*1.22+.12)*(1.0-smoothstep(.78,1.0,e));
      #elif KIND == 2
        float pattern=0.0;
        #if VARIANT == 0
          pattern=.1+r*.25+sin(a*5.0)*.08;
        #elif VARIANT == 1
          pattern=.12+fract(a/6.28318*5.0)*.22+r*.2;
        #elif VARIANT == 2
          pattern=.1+r*.25+abs(sin(a*3.0))*.1;
        #elif VARIANT == 3
          pattern=.12+max(abs(p.x),abs(p.z))*.27+max(0.0,p.y)*.18;
        #elif VARIANT == 4
          pattern=.1+fract(floor(p.x*3.0)+floor(p.z*3.0)*.38)*.35+max(0.0,p.y)*.2;
        #elif VARIANT == 5
          pattern=.14+fract(a/6.28318*3.0)*.3+max(0.0,p.y)*.2;
        #elif VARIANT == 6
          pattern=.08+r*.18+max(0.0,p.y)*.25;
        #elif VARIANT == 7
          pattern=.1+(1.7-r)*.25+abs(sin(a*1.5))*.12;
        #else
          pattern=.12+r*.2+sin(a*3.0)*.1;
        #endif
        pattern=clamp(pattern,.08,.75);
        start=smoothstep(-.08,.08,s-pattern);
        end=1.0-smoothstep(-.12,.12,e-(.18+pattern*.75));
        #if VARIANT == 0
          end=1.0-smoothstep(.64,.98,e);
        #elif VARIANT == 5 || VARIANT == 6 || VARIANT == 7
          end=1.0-smoothstep(.55,.98,e);
        #endif
        if(e>0.0){
          #if VARIANT == 1
            float ash=.5+.5*sin(p.x*31.0+p.z*23.0+sin(p.x*17.0)*3.0);end*=smoothstep(e*.7-.1,e*.7+.12,ash);
          #elif VARIANT == 3
            float sector=fract(a*1.4324);float gap=smoothstep(.03,.38,e)*.22;end*=smoothstep(gap,gap+.025,sector)*(1.0-smoothstep(1.0-gap-.025,1.0-gap,sector));
          #elif VARIANT == 2 || VARIANT == 4
            vec2 tile=abs(fract(p.xz*2.5)-.5);float crack=max(tile.x,tile.y);end*=1.0-smoothstep(.5-e*.25,.51-e*.25,crack);
          #elif VARIANT == 7
            float grain=.5+.5*sin(p.x*19.0+sin(p.z*15.0)*2.0);end*=mix(1.0,smoothstep(e*.65-.12,e*.65+.15,grain),smoothstep(.5,.9,e));
          #elif VARIANT == 8
            float pop=smoothstep(.08+fract(vStagePart*.41)*.25,.65+fract(vStagePart*.41)*.25,e);end*=1.0-smoothstep(.015,.08,max(0.0,p.y)-(.9-pop*1.5));
          #endif
        }
      #elif KIND == 3
        if(e>0.0){
          #if VARIANT == 2
            float breakUp=.5+.5*sin(a*7.0+sin(a*3.0)+p.y*5.0);end=smoothstep(e*.6-.1,e*.6+.12,breakUp);
          #elif VARIANT == 4
            float flame=.5+.5*sin(p.x*7.0+sin(p.y*5.0-e*9.0)*2.0+p.z*3.0);end=smoothstep(e*.82-.08,e*.82+.09,flame);
          #elif VARIANT == 5
            float segment=floor(p.y*3.0);float discharge=.5+.5*sin(segment*4.7+floor(e*13.0)*2.9);end=mix(smoothstep(.32,.55,discharge)*(1.0-smoothstep(.1,.55,e)),1.0,1.0-smoothstep(-.9,-.3,p.y));
          #elif VARIANT == 6
            float foam=.5+.5*sin(a*11.0+sin(p.y*9.0+e*8.0)+r*4.0);end=smoothstep(e*.88-.08,e*.88+.12,foam);
          #elif VARIANT == 7
            float ray=length(p);float streak=.5+.5*sin(a*9.0+floor(e*9.0)*2.4);end=1.0-smoothstep((1.0-e)*3.0+.2,(1.0-e)*3.0+.5,ray);end*=mix(.2,1.0,streak);
          #endif
        }
      #elif KIND == 4
        float h=clamp((p.y+1.4)/3.4,0.0,1.0);
        start=smoothstep(0.0,.13,s);
        end=1.0-smoothstep(.45,1.0,e);
      #elif KIND == 5
        start=smoothstep(.0,.25,s);
        end=1.0-smoothstep(.35,1.0,e);
      #endif
      return start*end;
    }
  `;
  function installLifecycle(){
    if(spec.burst&&!(kind===3&&variant===2))return;
    for(const material of materials){
      if(material.userData.ownLifecycle)continue;
      if(kind===0&&!material.transparent)stageOpaque.push(material);
      const part=material.vertexShader.includes('attribute float aPhase')?'aPhase':material.vertexShader.includes('attribute vec4 seed')?'seed.x*37.0':'0.0';
      const freezeEmitter=kind===2&&[0,2,3,5,6,7,8].includes(variant);
      if(freezeEmitter){material.vertexShader=material.vertexShader.replace(/\buTime\b/g,'uEmitterTime');material.fragmentShader=material.fragmentShader.replace(/\buTime\b/g,'uEmitterTime');}
      const vertex=material.vertexShader.replace(/void\s+main\s*\(\s*\)/,'void steadyMain()');
      const fragment=material.fragmentShader.replace(/void\s+main\s*\(\s*\)/,'void steadyMain()');
      material.uniforms={...material.uniforms,...lifeUniforms,uClipToGroup:{value:clipToGroup},uGroupToClip:{value:groupToClip}};
      material.vertexShader=lifeVertex+vertex+`
        void main(){steadyMain();vStagePosition=vec3(0.0);vStagePart=${part};if(uLifeStage==1.0)return;
          vec4 p=uClipToGroup*gl_Position;p/=p.w;vStagePosition=p.xyz;
          gl_Position=uGroupToClip*vec4(stageShape(p.xyz,uLifeStart,uLifeEnd,vStagePart),1.0);
        }`;
      material.fragmentShader=lifeFragment+fragment+`
        void main(){steadyMain();if(uLifeStage==1.0)return;
          float coverage=phaseCoverage(vStagePosition);
          if(coverage<.004)discard;gl_FragColor.a*=coverage;
          #if KIND == 1 && VARIANT == 4
            float radius=length(vStagePosition.yz);float core=1.0-smoothstep(.04,.22,radius);float atEnd=smoothstep(1.65,2.05,abs(vStagePosition.x));
            float petal=floor((atan(vStagePosition.z,vStagePosition.y)+3.14159)*.955);float release=smoothstep(.15+fract(petal*.381)*.3,.85,uLifeEnd);
            gl_FragColor.rgb=mix(gl_FragColor.rgb,vec3(1.0,.97,.81),core*.75);
            gl_FragColor.a*=mix(.55+.45*core,1.0-release,atEnd);
            gl_FragColor.a*=1.0-atEnd*smoothstep(.35,.9,uLifeEnd)*smoothstep(.05,.55,radius);
          #elif KIND == 2 && VARIANT == 1
            gl_FragColor.rgb*=1.0-uLifeEnd*.75;
          #elif KIND == 4 && VARIANT == 2
            gl_FragColor.rgb*=1.0-uLifeEnd*.6;
          #elif KIND == 3 && VARIANT == 6
            gl_FragColor.rgb=mix(gl_FragColor.rgb,vec3(.8,.94,1.0),uLifeEnd*.65);
          #endif
        }`;
    }
    if(kind===2)for(const object of group.children){
      if(object.geometry.type==='PlaneGeometry'){
        const old=object.geometry,p=old.parameters,split=new THREE.PlaneGeometry(p.width,p.height,24,24),combined=new THREE.BufferGeometry();
        const offset=old.attributes.position.count;
        for(const key of ['position','normal','uv'])combined.setAttribute(key,new THREE.Float32BufferAttribute([...old.attributes[key].array,...split.attributes[key].array],old.attributes[key].itemSize));
        combined.setIndex([...old.index.array,...Array.from(split.index.array,x=>x+offset)]);
        stagePlanes.push({geometry:combined,steady:old.index.count,transition:split.index.count});
        object.geometry=combined;geometries.delete(old);old.dispose();split.dispose();geometries.add(combined);
      }
    }
    for(const object of group.children){object.onBeforeRender=(renderer,scene,camera)=>{
      if(phase==='active')return;
      if(lastRenderFrame!==renderer.info.render.frame||lastCamera!==camera){
        groupToClip.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).multiply(group.matrixWorld);
        clipToGroup.copy(groupToClip).invert();lastRenderFrame=renderer.info.render.frame;lastCamera=camera;
      }
      object.material.uniformsNeedUpdate=true;
    };}
  }

  const noise = `
    float hash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
    float noise2(vec2 p) {
      vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
      return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);
    }
    float fbm(vec2 p) { return noise2(p)*0.57+noise2(p*2.07+3.1)*0.29+noise2(p*4.13-1.7)*0.14; }
    float band(float x,float width) { return 1.0-smoothstep(width,width+0.004,abs(x)); }
    #define PI 3.14159265359
  `;
  // 投射物專用的三段自發光 Toon 色階；不變更其餘種類的材質。
  const projectileToon=`
    float toonStep(float edge,float x){float aa=max(fwidth(x),.008);return smoothstep(edge-aa,edge+aa,x);}
    vec3 toonShade(vec3 tint,float light){
      vec3 c=mix(tint*.28,tint*1.08,toonStep(.40,light));
      return mix(c,mix(tint,vec3(1.0),.53)*1.15,toonStep(.69,light));
    }
  `;
  // 解析雜訊梯度用於旋度流場與煙霧受光，避免有限差分重複取樣。
  const flow = `
    vec3 noiseGradient(vec2 p){
      vec2 i=floor(p),f=fract(p),u=f*f*(3.0-2.0*f),du=6.0*f*(1.0-f);
      float a=hash(i),b=hash(i+vec2(1,0)),c=hash(i+vec2(0,1)),d=hash(i+vec2(1,1));
      return vec3(mix(mix(a,b,u.x),mix(c,d,u.x),u.y),du.x*mix(b-a,d-c,u.y),du.y*mix(c-a,d-b,u.x));
    }
    vec3 curlFlow(vec3 p,float t){
      // A=(N(y,z),N(z,x),N(x,y)) 的解析 curl；所有元件取樣同一空間。
      vec3 ax=noiseGradient(p.yz+vec2(7.3-t*0.22,1.7+t*0.11));
      vec3 ay=noiseGradient(p.zx+vec2(13.1+t*0.13,5.4-t*0.19));
      vec3 az=noiseGradient(p.xy+vec2(2.9-t*0.16,17.2+t*0.14));
      return vec3(az.z-ay.y,ax.z-az.y,ay.z-ax.y)*0.65;
    }
  `;
  // 參考官方火焰的 UV 扭曲、雙層侵蝕與色階映射；全部採程式雜訊。
  const flame = `
    vec3 flameErosion(vec2 uv,float t,float seed){
      vec2 p=vec2(uv.x+uv.y*0.65,uv.y);
      float warp=noise2(p*vec2(3.1,2.7)+vec2(seed,t*-0.31));
      p.x+=(warp-0.5)*0.6;
      float broad=noise2(p*vec2(4.0,2.2)+vec2(seed*3.7,-t*0.85));
      float fine=noise2(p*vec2(10.5,5.0)+vec2(seed*7.1,-t*1.35));
      float erosion=broad*0.72+fine*0.28;
      float interior=1.0-abs(uv.x*2.0-1.0);
      float shape=interior-(1.0-erosion)*0.67;
      float aa=max(fwidth(shape)*0.8,0.018);
      float mask=smoothstep(-aa,aa+0.07,shape);
      float heat=clamp(shape*0.9+broad*0.25,0.0,1.0);
      float edge=exp(-abs(shape)*24.0)*smoothstep(0.28,0.58,erosion);
      return vec3(mask,heat,edge);
    }
    vec3 flameColor(vec3 tint,float heat){
      vec3 c=mix(tint*0.065,tint*1.35,smoothstep(0.06,0.48,heat));
      return mix(c,tint*1.6+vec3(1.0,0.85,0.50),smoothstep(0.48,0.84,heat));
    }
  `;
  const smokeLight = `
    vec2 smokeOptics(vec2 q,vec2 densityGradient,float density,vec3 lightDir){
      float dome=sqrt(max(0.015,1.0-dot(q,q)));
      vec3 n=normalize(vec3(q-densityGradient*0.13,dome));
      float wrap=clamp(dot(n,lightDir)*0.7+0.3,0.0,1.0);
      float thickness=dome*(0.3+density*1.1);
      float transmission=exp(-thickness*1.7);
      float rim=pow(1.0-dome,2.0)*wrap*0.20;
      return vec2((0.16+wrap*0.70)*mix(0.55,1.0,transmission)+rim,1.0-exp(-thickness*1.8));
    }
  `;
  const output = `
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  `;
  const surfaceVertex = `
    varying vec2 vUv;
    void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}
  `;
  // 新版材質僅供獨立 Toon 爆炸／旋風使用，原款不改色彩或透明度路徑。
  const styleToon = `
    float styleStep(float edge,float value){float aa=max(fwidth(value),.012);return smoothstep(edge-aa,edge+aa,value);}
    vec3 styleColor(vec3 tint,float light){
      vec3 c=mix(tint*.22,tint*.72,styleStep(.38,light));
      return mix(c,mix(tint,vec3(1.0),.38)*1.04,styleStep(.70,light));
    }
    vec3 styleHeat(vec3 tint,float heat){
      vec3 c=mix(tint*.24,tint*1.05,styleStep(.38,heat));
      return mix(c,mix(tint,vec3(1.0,.88,.51),.62),styleStep(.70,heat));
    }
  `;
  function shader(fragmentShader, vertexShader = surfaceVertex, extra = {}, additive = true, defines = {}) {
    const material = new THREE.ShaderMaterial({
      uniforms: { ...uniforms, ...lifeUniforms, ...extra },
      defines: { KIND: kind, VARIANT: variant, TOON: toon ? 1 : 0, ...defines },
      vertexShader: "uniform float uSize;\n"+vertexShader, fragmentShader: "uniform float uDetail;\n"+(toon?styleToon:"")+fragmentShader, transparent: true, depthWrite: false,
      side: THREE.DoubleSide,
      blending: additive && !toon ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    materials.add(material);
    return material;
  }
  function mesh(geometry, material, order = 1) {
    geometries.add(geometry);
    const object = new THREE.Mesh(geometry, material);
    object.frustumCulled = false;
    object.renderOrder = order;
    group.add(object);
    return object;
  }
  // Emissive color with partial background coverage: bright on dark surfaces,
  // while preserving a blue silhouette against light backgrounds.
  function electricBlend(material){
    material.blending=THREE.CustomBlending;material.blendSrc=THREE.OneFactor;material.blendDst=THREE.OneMinusSrcAlphaFactor;
    return material;
  }
  function instanced(base, maximum, weight, material, order = 1) {
    const geometry = new THREE.InstancedBufferGeometry();
    if (base.index) geometry.setIndex(base.index.clone());
    for (const key of Object.keys(base.attributes)) geometry.setAttribute(key,base.attributes[key].clone());
    base.dispose();
    const seeds = new Float32Array(maximum*4);
    // index 僅相容舊版傳入的 spec；新目錄與匯出一律使用明確 seed。
    let state = (spec.seed ?? ((spec.index ?? 0)+1)*9187) + allocations.length*311;
    for(let i=0;i<seeds.length;i++) {
      state=(state*1664525+1013904223)>>>0;
      seeds[i]=state/4294967296;
    }
    geometry.setAttribute('seed',new THREE.InstancedBufferAttribute(seeds,4));
    allocations.push({geometry,weight,maximum});
    return mesh(geometry,material,order);
  }
  const particleVertex = `
    attribute vec4 seed;
    uniform float uStopTime,uEndDuration,uQuantity,uSpread;
    uniform float uTime;
    uniform float uStretch;
    varying vec2 vUv;
    varying float vAlpha;
    varying float vSeed;
    varying float vLife;
    varying float vLight;
    ${noise}
    ${flow}
    varying vec3 vKeyLight;
    void main(){
      vKeyLight=normalize(mat3(viewMatrix)*vec3(-0.45,0.8,0.55));
      vUv=uv;vSeed=seed.w;vLight=1.0;
      float t=uTime,a=seed.x*PI*2.0,r=sqrt(seed.z);
      float life=fract(seed.y+t*0.35);
      vec3 p=vec3(0.0);vec2 shape=vec2(1.0);
      float size=0.05+seed.w*0.06;
      vAlpha=0.8;vLife=life;
      #if CLOUD == 1
        #if KIND == 3
          float age=clamp(t/2.8,0.0,1.0);
          float rise=1.0-exp(-t*4.0);
          float crown=step(0.35,seed.y);
          float expansion=(0.25+rise*1.2)*(0.25+seed.z*0.75);
          p=vec3(cos(a)*expansion*crown,-1.36+rise*(0.5+seed.y*2.45)+age*0.3,sin(a)*expansion*crown);
          p.xz+=vec2(sin(t*1.5+a),cos(t*1.7+a))*age*0.25;
          size=(0.3+rise*0.85)*(0.6+seed.w*0.7);
          vAlpha=smoothstep(0.02,0.18,t)*pow(1.0-age,1.2)*0.72;
          vLife=age;vLight=max(0.0,1.0-t*0.65)*(1.0-crown*seed.y*0.5);
          #if VARIANT == 1
            p=vec3(cos(a)*r*(0.3+age*1.5),-1.3+rise*(seed.y*0.6)+age*0.4,sin(a)*r*(0.3+age*1.5));size*=0.6;vAlpha*=0.28;
            #if TOON == 1
              float expand=smoothstep(.02,.34,t);p=vec3(cos(a)*r*expand*2.2,-1.24+seed.y*.35*expand,sin(a)*r*expand*2.2);p.y=-1.2+(p.y+1.2)*uSize;p.xz*=uSize;
              size=.6+seed.w*.8;shape=vec2(1.4,.65);vAlpha=smoothstep(.01,.13,t)*(1.0-smoothstep(.3,.85,t))*.12;
            #endif
          #elif VARIANT == 2
            float front=(1.0-exp(-t*2.3))*2.55;float scatter=front*(0.35+seed.z*0.7);p=vec3(cos(a)*scatter,-1.35+sin(age*PI)*(0.12+seed.y*0.40),sin(a)*scatter);size*=0.65;shape=vec2(1.7,0.65);vAlpha*=0.42;
          #elif VARIANT == 3
            p.xz*=1.5;p.y=-1.3+age*0.6+seed.y*0.35;size*=0.75;vAlpha*=0.55;
          #endif
        #else
          float h=uStopTime<0.0?fract(seed.y+t*0.15):min(1.0,fract(seed.y+uStopTime*0.15)+(t-uStopTime)/uEndDuration);
          float spread=0.18+pow(h,0.8)*0.7;
          p=vec3(cos(a+h*4.0)*r*spread+sin(h*5.0+t*0.4)*0.25,h*3.5-1.4,sin(a+h*4.0)*r*spread);
          size=(0.48+h*0.95)*(0.75+seed.w*0.45);
          vAlpha=sin(h*PI)*0.5;vLife=h;
          #if VARIANT == 1
            p=vec3(cos(a+t*0.08)*r*2.0,-1.12+seed.y*0.45,sin(a+t*0.08)*r*1.6);
            size=0.9+seed.w*1.0;shape=vec2(1.5,0.6);vAlpha=0.23;vLife=seed.y;
          #elif VARIANT == 2
            h=uStopTime<0.0?fract(seed.y+t*0.48):min(1.0,fract(seed.y+uStopTime*0.48)+(t-uStopTime)/uEndDuration);
            p=vec3(cos(a+h*7.0)*h*h*0.85,h*3.6-1.4,sin(a+h*7.0)*h*h*0.65);
            size=0.18+h*0.9;shape=vec2(1.0,1.25);vAlpha=sin(h*PI)*0.34;vLife=h;
          #elif VARIANT == 3
            float age=clamp(t/3.5,0.0,1.0),expand=1.0-exp(-t*3.2);
            p=vec3(cos(a)*r*expand*1.55,-0.8+seed.y*expand*1.6+age*0.6,sin(a)*r*expand*1.55);
            size=(0.3+expand*0.85)*(0.6+seed.w*0.6);
            vAlpha=smoothstep(0.0,0.15,t)*pow(1.0-age,1.5)*0.6;vLife=age;
          #endif
        #endif
      #else
        #if KIND == 0
          life=fract(seed.y+t*0.65);
          p=vec3(0.85-life*3.6,sin(a)*r*(0.05+life*0.38),cos(a)*r*(0.05+life*0.38));
          size=0.04+seed.w*0.1;vAlpha=pow(1.0-life,1.5);shape=vec2(2.6,0.6);
          #if VARIANT == 0
            p=vec3(0.65-life*(2.8+seed.z*0.7),sin(a)*r*(0.16+life*0.50),cos(a)*r*(0.16+life*0.50));p.y+=sin(life*9.0-t*5.0+a)*life*0.24;size=0.018+seed.w*0.052;vAlpha=sin(life*PI)*pow(1.0-life,1.2)*0.65;shape=vec2(2.3,0.45);
          #elif VARIANT == 1
            p.yz*=0.9;shape=vec2(4.8,0.3);p.yz+=vec2(cos(a),sin(a))*sin(life*PI)*0.14;vAlpha*=0.2+0.8*step(0.45,sin(life*24.0+t*12.0+seed.z*9.0));
          #elif VARIANT == 2
            shape=vec2(2.2,0.6);p.yz*=1.25;p.y-=life*life*0.4;size*=0.42;vAlpha*=0.35+0.35*pow(max(0.0,sin(t*4.0+seed.z*31.0)),6.0);
          #else
            float spiral=life*12.0-t*3.0+(uQuantity==3.0?floor(seed.x*3.0)*2.094:floor(seed.x*uQuantity)*6.283185307/uQuantity);
            p.yz=vec2(cos(spiral),sin(spiral))*((0.26*mix(uSize,1.0,smoothstep(0.0,0.35,life))+life*0.16)*uSpread)+p.yz*0.07;
            shape=vec2(2.0,0.6);
          #endif
        #elif KIND == 1
          float phase=fract(seed.y+t*1.7);
          if(seed.x<0.26){
            p=vec3(-2.4+phase*0.45/uStretch,cos(a)*phase*0.4,sin(a)*phase*0.4);
            vAlpha=1.0-phase;size=0.04;shape=vec2(2.0,0.65);
          }else if(seed.x>0.58){
            float spread=phase*(0.3+seed.z*0.8);
            p=vec3(2.4-phase*(0.2+seed.w*0.65)/uStretch,cos(a)*spread,sin(a)*spread);
            vAlpha=pow(1.0-phase,1.3);shape=vec2(1.0,3.0);size=0.025+seed.w*0.045;
          }else{
            p=vec3((phase-0.5)*4.8,cos(a+t*4.0)*0.12*r,sin(a+t*4.0)*0.12*r);
            vAlpha=0.6;shape=vec2(2.7,0.5);
          }
          #if VARIANT == 2
            float cycle=t,charge=min(cycle/1.52,1.0),release=smoothstep(1.52,1.60,cycle);
            if(seed.x<0.58){float incoming=fract(seed.y+t*(0.45+charge*0.6));float radius=(1.0-incoming)*(0.35+seed.z*0.75);float angle=a-t*2.0;p=vec3(-2.4-(1.0-incoming)*0.7/uStretch,cos(angle)*radius*uSize,sin(angle)*radius*uSize);vAlpha=sin(incoming*PI)*(0.25+charge*0.75)*(1.0-release*0.4);shape=vec2(2.2,0.5);}
            else{vAlpha*=release;size*=0.7+release*0.6;p.yz*=1.0+release*0.35;}
          #elif VARIANT == 3
            // Short, staggered needles leave the electrodes; density never removes the main current.
            float end=seed.x<.32?-1.0:1.0;
            phase=fract(seed.y+t*(1.1+seed.w*.8));
            float travel=phase*(.45+seed.z*.75)*uSize;
            p=vec3(end*2.4-end*travel*.28/uStretch,cos(a)*travel,sin(a)*travel);
            size=(.025+seed.z*.045)*uSize;shape=vec2(.38,4.2);
            vAlpha=pow(1.0-phase,2.0)*smoothstep(.0,.055,phase)*(1.0-step(.10,seed.w));
          #endif
      #elif KIND == 2
          float spin=a+t*0.15;
          p=vec3(cos(spin)*r*1.85,life*1.4,sin(spin)*r*1.85);
          vAlpha=sin(life*PI)*0.55;size=0.04+seed.w*0.055;
          #if VARIANT == 1
            p.y=life*(0.3+r*0.7);p.xz+=vec2(sin(t*2.0+a),cos(t*2.3+a))*life*0.12;shape=vec2(0.8,3.6);size=0.07+seed.w*0.10;
          #elif VARIANT == 2
            p.y=0.08+life*0.4;p.xz*=0.88+0.12*sin(life*PI);shape=vec2(1.0);vAlpha*=0.5+0.5*pow(max(0.0,sin(t*2.0+seed.z*29.0)),4.0);
          #elif VARIANT == 3
            p=vec3(cos(spin)*sin(seed.y*PI*0.5),cos(seed.y*PI*0.5),sin(spin)*sin(seed.y*PI*0.5))*1.85;
            vAlpha=0.25+0.2*sin(t*2.0+seed.z*6.0);
          #endif
        #elif KIND == 3
          float age=clamp(t/2.8,0.0,1.0);
          float dt=max(0.0,t-seed.w*0.1);
          float speed=0.4+seed.z*1.6;
          p=vec3(cos(a)*speed*dt,-1.35+(2.5+seed.y*3.3)*dt-2.5*dt*dt,sin(a)*speed*dt);
          p.y=max(-1.36,p.y);vAlpha=pow(1.0-age,1.7)*0.65;size=0.018+seed.w*0.045;shape=vec2(0.6,2.5);
          #if VARIANT == 1
            float ray=floor(seed.x*8.0)/8.0*PI*2.0;p=vec3(cos(ray)*dt*speed*0.8,-1.35+dt*(3.0+seed.y*3.5),sin(ray)*dt*speed*0.8);shape=vec2(0.3,6.0);vAlpha*=1.0-smoothstep(0.35,1.25,t);
            #if TOON == 1
              vec3 discharge=normalize(vec3(cos(a),.6+seed.y*1.8,sin(a)));
              p=discharge*(.15+(1.0-exp(-dt*4.0))*(.8+seed.z*2.4))*uSize;p.y-=1.2;vAlpha*=1.0-step(.16,seed.w);
              shape=vec2(3.2,.3);size*=uSize;vAlpha*=smoothstep(.06,.13,t);
            #endif
          #elif VARIANT == 2
            p.xz*=1.7;p.y=-1.35+(1.2+seed.y*2.2)*dt-2.5*dt*dt;p.y=max(-1.36,p.y);size*=0.8;shape=vec2(1.0);vAlpha*=0.4;
          #elif VARIANT == 3
            size*=0.85;shape=vec2(0.7,1.8);
          #endif
        #elif KIND == 4
          float h=uStopTime<0.0?fract(seed.y+t*.3):min(1.0,fract(seed.y+uStopTime*.3)+(t-uStopTime)*.55),spin=h*9.6-t*5.28+a;
          float radius=0.09+pow(h,1.45)*1.05+pow(h,4.0)*0.65;
          #if TOON == 1
            radius+=.22*(1.0-smoothstep(.08,.55,h));
          #endif
          p=vec3(cos(spin)*radius,h*3.6-1.4,sin(spin)*radius);
          p.x+=sin(h*2.6+t*0.5)*h*0.35;
          size=0.025+seed.w*0.04;shape=vec2(4.0,0.45);vAlpha=sin(h*PI)*0.5;
          #if VARIANT == 0
            shape=vec2(7.0,0.23);size*=0.8;vAlpha*=0.65;
          #elif VARIANT == 1
            radius+=seed.z*0.4;p.xz=vec2(cos(spin),sin(spin))*radius;size=0.012+seed.w*0.035;shape=vec2(1.0,0.8);vAlpha*=0.75;
          #elif VARIANT == 2
            spin=a-t*2.4;float drift=pow(h,3.0)*(0.3+seed.z*0.8);p=vec3(cos(spin)*(radius+drift),h*3.8-1.4,sin(spin)*(radius+drift));size=0.016+seed.w*0.04;shape=vec2(0.8,2.7);vAlpha=sin(h*PI)*(0.45+0.45*sin(t*13.0+seed.z*19.0));
          #else
            h=floor(seed.y*6.0)/6.0+0.08;spin=a-t*2.4;radius=0.15+pow(h,1.2)*1.8;p=vec3(cos(spin)*radius,h*3.5-1.4+sin(spin*3.0)*0.07,sin(spin)*radius);size=0.018+seed.w*0.03;shape=vec2(1.0);vAlpha=0.25+pow(max(0.0,sin(seed.z*20.0+t*3.0)),4.0)*0.6;
          #endif
        #endif
      #endif
      #if KIND == 4 || KIND == 5
        vec3 field=curlFlow(vec3(p.x,p.y+1.4,p.z)*1.1,t);
        p+=field*(KIND==4?0.12:0.16)*smoothstep(0.0,0.25,p.y+1.4);
      #endif
      #if CLOUD == 1
        size*=uSize;
      #endif
      #if KIND == 4
        p.xz*=uSize;p.y=(p.y+1.4)*uSize-1.4;
      #endif
      vLife=clamp(vLife,0.0,1.0);
      vec4 mv=modelViewMatrix*vec4(p,1.0);
      float scale=length(modelMatrix[1].xyz);
      #if KIND == 0 && VARIANT == 2
        float spin=t*(1.0+seed.z*3.0)+a;vec3 shard=position*vec3(2.0,.55,.65)*size;
        shard.xy=mat2(cos(spin),-sin(spin),sin(spin),cos(spin))*shard.xy;
        mv=modelViewMatrix*vec4(p+shard,1.0);
      #elif TOON == 1 && KIND == 3 && VARIANT == 1 && CLOUD == 0
        vec3 direction=normalize(vec3(cos(a),.6+seed.y*1.8,sin(a)));
        vec2 along=normalize((modelViewMatrix*vec4(direction,0.0)).xy+vec2(.0001));
        mv.xy+=(along*position.x*shape.x+vec2(-along.y,along.x)*position.y*shape.y)*size*scale;
      #elif KIND == 4
        vec2 tangent=normalize((modelViewMatrix*vec4(-sin(spin),0.1,cos(spin),0.0)).xy);vec2 crossFlow=vec2(-tangent.y,tangent.x);
        mv.xy+=(tangent*position.x*shape.x+crossFlow*position.y*shape.y)*size*scale;
      #else
        mv.xy+=position.xy*size*shape*scale;
      #endif
      gl_Position=projectionMatrix*mv;
    }
  `;
  const particleFragment = `
    uniform vec3 uColor;uniform float uTime;
    varying vec2 vUv;varying float vAlpha;varying float vSeed;varying float vLife;varying float vLight;
    ${noise}${flow}${smokeLight}${flame}
    ${kind===0?projectileToon:""}
    varying vec3 vKeyLight;
    void main(){
      vec2 q=vUv*2.0-1.0;float d=length(q);
      #if !(KIND == 0 && VARIANT == 2)
        if(d>1.0)discard;
      #endif
      float alpha=exp(-d*d*5.0)*(1.0-smoothstep(0.65,1.0,d));
      vec3 color=mix(uColor,vec3(1.0),pow(1.0-d,8.0)*0.35);
      #if CLOUD == 1
        vec2 original=q;
        float angle=vSeed*6.28+uTime*0.18;
        mat2 rotation=mat2(cos(angle),-sin(angle),sin(angle),cos(angle));q=rotation*q;
        vec3 coarse=noiseGradient(q*2.8+vec2(vSeed*17.0,-uTime*0.18));
        #if TOON == 1
          vec3 fine=coarse;
        #else
          vec3 fine=noiseGradient(q*5.7+vec2(vSeed*31.0,-uTime*0.31));
        #endif
        float n=coarse.x*0.72+fine.x*0.28;
        vec2 gradient=mat2(cos(angle),sin(angle),-sin(angle),cos(angle))*(coarse.yz*2.8*0.72+fine.yz*5.7*0.28);
        float puff=1.0-smoothstep(0.43,1.0,d+(n-0.5)*0.43);
        float body=smoothstep(0.14,0.76,n+(1.0-d)*0.55);
        vec2 optics=smokeOptics(original,gradient,n,vKeyLight);
        float light=optics.x;
        color=uColor*light*1.15;
        alpha=puff*body*optics.y*1.35;
        #if KIND == 3
          float hot=vLight*(0.4+body*0.6);
          #if VARIANT == 0
            color=mix(uColor*(0.06+light*0.13),uColor*(1.8+hot*2.4)+vec3(pow(hot,3.0)*0.8),smoothstep(0.10,0.65,hot));
          #elif VARIANT == 1
            color=mix(uColor*0.35,uColor*1.7,hot);
          #elif VARIANT == 2
            color=uColor*(0.10+light*0.85);
          #else
            color=uColor*(0.18+light*0.95);
          #endif
        #else
          #if VARIANT == 2
            color=uColor*(0.40+light*0.65);
          #endif
        #endif
        #if TOON == 1
          color=styleColor(uColor,.20+light*.65+n*.18);
          alpha=(1.0-smoothstep(.68,.98,d+(n-.5)*.35))*smoothstep(.18,.42,n+(1.0-d)*.35)*.82;
          #if VARIANT == 0
            color=mix(styleColor(uColor*.28,light),styleHeat(uColor,hot*.65+n*.3),smoothstep(.10,.65,hot));
            #if KIND == 3
              color=mix(vec3(.04,.05,.065),vec3(.20,.22,.25),clamp(light,0.0,1.0));
            #endif
          #elif VARIANT == 1
            alpha=exp(-d*d*5.0)*(1.0-smoothstep(.7,1.0,d));color=uColor*(.6+body*.4);
          #endif
        #endif
      #elif KIND == 2
        #if VARIANT == 0
          float crossShape=min(max(abs(q.x)-0.20,abs(q.y)-0.66),max(abs(q.x)-0.66,abs(q.y)-0.20));
          alpha=1.0-smoothstep(-0.02,0.08,crossShape);color=uColor*1.2;
        #elif VARIANT == 1
          vec3 burn=flameErosion(vec2(vUv.x,vUv.y*1.3),uTime*1.8,vSeed*9.0);
          alpha=burn.x*pow(max(0.0,1.0-vUv.y),0.7)*smoothstep(0.0,0.2,vUv.y);color=flameColor(uColor,burn.y*0.7+(1.0-vUv.y)*0.3);
        #elif VARIANT == 2
          float a=atan(q.y,q.x);float spoke=pow(abs(cos(a*3.0)),28.0);
          alpha=(spoke*(1.0-smoothstep(0.4,0.85,d))+exp(-d*d*45.0))*0.85;
        #else
          alpha=band(max(abs(q.x),abs(q.y))-0.52,0.07);color=uColor*1.3;
        #endif
      #elif KIND == 0 && VARIANT == 3
        alpha=band(abs(q.x)+abs(q.y)-0.64,0.05)+exp(-d*d*35.0)*0.4;
      #elif KIND == 0 && VARIANT == 2
        alpha=0.8;color*=0.35+0.65*vUv.y;
      #elif (KIND == 3 && VARIANT == 3) || (KIND == 4 && VARIANT == 3)
        alpha=1.0-smoothstep(0.7,1.0,abs(q.x)+abs(q.y));
        color*=0.7+step(q.x,0.0)*0.5;
      #endif
      #if KIND == 0
        color=toonShade(uColor,.46+(1.0-d)*.4);
      #endif
      #if TOON == 1 && CLOUD == 0
        color=styleColor(uColor,.28+(1.0-d)*.5+vLight*.1);
        #if KIND == 3 && VARIANT == 1
          alpha=exp(-q.y*q.y*35.0)*(1.0-smoothstep(.6,1.0,abs(q.x)));color=uColor*1.3+vec3(pow(1.0-d,3.0)*1.4);
        #elif KIND == 4 && VARIANT == 1
          color=styleColor(uColor*.55,.3+vSeed*.5);
        #elif (KIND == 3 && VARIANT == 0) || (KIND == 4 && VARIANT == 2)
          color=styleHeat(uColor,.50+(1.0-d)*.35);
        #endif
      #endif
      gl_FragColor=vec4(color,alpha*vAlpha*uDetail);
      ${output}
    }
  `;
  // 新系別法術：明確 kind/variant 接線，與舊 0–3 分支隔離。
  function buildSchoolSpell() {
    const spell = ({'3:4':0,'0:4':1,'2:4':2,'3:5':3,'1:4':4,'2:5':5,'2:6':6,'0:5':7,'3:6':8,'2:7':9,'3:7':10,'0:6':11,'2:8':12})[`${kind}:${variant}`];
    if(spell===undefined) throw new Error(`Unsupported effect variant: ${kind}:${variant}`);
    const pieces=[];
    const TAU=Math.PI*2;
    // 所有形體一次配置並合併；aPart/phase 控制 GPU 動畫，主要輪廓不受密度削減。
    function add(g,part=0,phase=0,unit=-1){
      const n=g.attributes.position.count;
      g.setAttribute('aPart',new THREE.Float32BufferAttribute(new Float32Array(n).fill(part),1));
      g.setAttribute('aPhase',new THREE.Float32BufferAttribute(new Float32Array(n).fill(phase),1));
      g.setAttribute('aUnit',new THREE.Float32BufferAttribute(new Float32Array(n).fill(unit),1));pieces.push(g);return g;
    }
    function surface(fn,us=32,vs=8,part=0,phase=0,unit=-1){
      const p=[],uv=[],ix=[];
      for(let i=0;i<=us;i++)for(let j=0;j<=vs;j++){p.push(...fn(i/us,j/vs));uv.push(i/us,j/vs);}
      for(let i=0;i<us;i++)for(let j=0;j<vs;j++){const a=i*(vs+1)+j,b=a+vs+1;ix.push(a,b,a+1,a+1,b,b+1);}
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();return add(g,part,phase,unit);
    }
    function tube(fn,r=.035,steps=24,sides=5,part=0,phase=0,unit=-1){
      return surface((u,v)=>{const c=new THREE.Vector3(...fn(u)),t=new THREE.Vector3(...fn(Math.min(1,u+.001))).sub(new THREE.Vector3(...fn(Math.max(0,u-.001)))).normalize();
        const b=new THREE.Vector3().crossVectors(t,Math.abs(t.y)>.9?new THREE.Vector3(1,0,0):new THREE.Vector3(0,1,0)).normalize(),n=new THREE.Vector3().crossVectors(t,b);
        const radius=typeof r==='function'?r(u):r;c.addScaledVector(b,Math.cos(v*TAU)*radius).addScaledVector(n,Math.sin(v*TAU)*radius);return c.toArray();},steps,sides,part,phase,unit);
    }
    function gem(x,y,z,sx,sy,sz,phase=0,part=0,unit=-1){const g=new THREE.OctahedronGeometry(1);g.scale(sx,sy,sz);g.rotateZ(phase);g.translate(x,y,z);return add(g,part,phase,unit);}
    function ring(radius,y,part=0,phase=0){return tube(u=>[Math.cos(u*TAU)*radius,y,Math.sin(u*TAU)*radius],.026,48,4,part,phase);}
    if(spell===0){
      for(let k=0;k<10;k++)surface((u,v)=>[u,v,k],k<3?28:16,k<3?16:10,0,k,k);
      for(let k=0;k<12;k++)surface((u,v)=>[u,v,k],1,1,2,k,Math.floor(k*5/12));
    }else if(spell===1){
      surface((u,v)=>{const a=u*TAU,b=v*TAU,r=.65+.16*Math.cos(b);return [r*Math.cos(a),r*Math.sin(a),.13*Math.sin(b)];},56,8);
      for(let i=0;i<9;i++){const a=i*TAU/9,r=.8;gem(Math.cos(a)*r,Math.sin(a)*r,.02,.12,.19+(i%3)*.035,.13,a-Math.PI/2);}
    }else if(spell===2){
      for(let i=-2;i<=2;i++){tube(u=>[u*2.6-1.3,.08,i*.65],.018,2,4);tube(u=>[i*.65,.08,u*2.6-1.3],.018,2,4);}
      for(let i=0;i<18;i++){const extra=[[.425,.425],[-.425,.425],[.425,-.425],[-.425,-.425],[0,.425],[0,-.425],[.425,0],[-.425,0],[.425,.85]];const [x,z]=i<9?[(i%3-1)*.85,(Math.floor(i/3)-1)*.85]:extra[i-9];gem(x,.45+(i%3)*.22,z,.09,.15,.09,i*.6,1,i);tube(u=>[x+Math.cos(u*TAU)*.24,.42+(i%3)*.22,z+Math.sin(u*TAU)*.24],.018,4,4,1,i*.6,i);}
    }else if(spell===3){
      // A coherent strike, connected air forks and arcing ground discharges.
      for(let id=34;id>=0;id--){
        const steps=id<3?96:id<11?40:id<23?48:20,p=[],uv=[],ix=[];
        for(let j=0;j<steps;j++){const base=p.length/3;for(const [u,v]of [[0,0],[1,0],[0,1],[1,1]]){p.push(j/steps,(j+1)/steps,id);uv.push(u,v);}ix.push(base,base+1,base+2,base+2,base+1,base+3);}
        const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();add(g,id<3?0:id<11?1:2,id);
      }
      for(let id=0;id<2;id++)surface((u,v)=>[u-.5,v-.5,0],1,1,3,id);
      surface((u,v)=>[u-.5,0,v-.5],1,1,4,0);
      surface((u,v)=>[u-.5,0,v-.5],1,1,5,0);
    }else if(spell===4){
      for(const [radius,part]of [[.042,0],[.11,2]])surface((u,v)=>{const a=v*TAU;return [u*4.8-2.4,Math.cos(a)*radius,Math.sin(a)*radius];},32,10,part);
      for(const end of [-1,1]){
        tube(u=>[end*2.4,Math.cos(u*TAU)*.42,Math.sin(u*TAU)*.42],.012,48,4,1,end);
        for(let k=0;k<7;k++)surface((u,v)=>{const a=k*TAU/7,rr=.08+u*(end<0?.58:.85),w=Math.sin(u*Math.PI)*.12*Math.sin(v*Math.PI);const side=Math.cos(v*Math.PI);return [end*2.4+Math.sin(u*Math.PI)*.22,Math.cos(a)*rr-Math.sin(a)*w*side,Math.sin(a)*rr+Math.cos(a)*w*side];},18,6,1,k+end*.1);
      }
    }else if(spell===5){
      for(let i=0;i<6;i++){const a=i*TAU/(i<3?3:6);tube(u=>{const b=a+u*2.7,r=.4+Math.sin(u*Math.PI)*.8;return [Math.cos(b)*r,.12+Math.sin(u*Math.PI)*1.65,Math.sin(b)*r];},u=>.045+.035*Math.sin(u*Math.PI),36,6,1,i*2.1,i);}
    }else if(spell===6){
      for(let k=0;k<8;k++){const a=k*TAU/(k<4?4:8);
        tube(u=>{const r=.8+Math.sin(u*3.8)*.3,b=a+u*1.7;return [Math.cos(b)*r,u*1.65,Math.sin(b)*r];},u=>.065*(1-u*.6),30,6,1,k,k);
        for(let j=0;j<3;j++){const h=.35+j*.43,b=a+h,r=1.05;surface((u,v)=>{const w=Math.sin(u*Math.PI)*.18*(v*2-1),l=u*.55;return [Math.cos(b)*(r+l)-Math.sin(b)*w,h+Math.sin(u*2.5)*.25+Math.abs(w)*.3,Math.sin(b)*(r+l)+Math.cos(b)*w];},10,4,2,k,k);gem(Math.cos(b)*.94,h,Math.sin(b)*.94,.08,.2,.08,k,2,k);}
      }
      for(let k=0;k<7;k++){const a=k*TAU/7;surface((u,v)=>{const r=.12+u*.55,w=Math.sin(u*Math.PI)*.18*(v*2-1);return [Math.cos(a)*r-Math.sin(a)*w,.65+u*.3+v*(1-v)*.15,Math.sin(a)*r+Math.cos(a)*w];},10,4,3,k);}
    }else if(spell===7){
      for(let k=0;k<4;k++)surface((u,v)=>{const a=(u-.5)*4.9,b=v*TAU,r=.72+Math.cos(b)*Math.sin(u*Math.PI)*.18;return [Math.sin(a)*r,Math.cos(a)*r-.2,Math.sin(b)*.16*Math.sin(u*Math.PI)];},40,6,k,k*.5);
    }else if(spell===8){
      surface((u,v)=>[u,v,0],64,20,0,0);
      surface((u,v)=>[u,.37+v*.26,0],64,4,1,0);
      for(let k=0;k<12;k++)surface((u,v)=>[u,v,k],1,1,2,k);
    }else if(spell===9){
      // Each dune crest and its sliding packet share one quantity unit.
      for(let k=0;k<6;k++)surface((u,v)=>[u,v,k],24,10,1,k,k%3);
      for(let k=3;k<6;k++){surface((u,v)=>[u,v,k],24,10,1,k,k);surface((u,v)=>[u,v,k+6],24,10,1,k+6,k);}
    }else if(spell===10){
      for(let k=0;k<3;k++){const tilt=k*TAU/3;tube(u=>{const a=u*TAU,x=Math.cos(a)*1.4,y=Math.sin(a)*.8;return [x*Math.cos(tilt),y,x*Math.sin(tilt)];},.022,64,4,0,k);}
      const stars=[];for(let i=0;i<12;i++){const a=i*2.4,r=.75+(i%3)*.25,p=[Math.cos(a)*r,Math.sin(i*1.8)*.8,Math.sin(a)*r];stars.push(p);gem(...p,.07,.13,.07,a,1);if(i)tube(u=>stars[i-1].map((v,k)=>v+(p[k]-v)*u),.012,2,3,1,i);}
      for(let i=0;i<20;i++){const a=i*2.4;tube(u=>[Math.cos(a)*u*2.1,Math.sin(i*2)*u*1.7,Math.sin(a)*u*2.1],u=>.055*Math.sin(u*Math.PI),12,4,2,i*.5,i);}
    }else if(spell===11){
      for(let k=0;k<7;k++)surface((u,v)=>{const a=u*(3.2+(k%3)*.45)+k*2.39996,b=v*TAU,r=.025+.46*Math.pow(Math.sin(u*Math.PI*.85),1.2),w=Math.sin(u*Math.PI)*(.026+(k%3)*.013);return [.98-u*(1.6+(k%3)*.35),Math.cos(a)*(r+Math.cos(b)*w),Math.sin(a)*(r+Math.cos(b)*w)+Math.sin(b)*w];},24,6,0,k);
    }else if(spell===12){
      for(let i=0;i<14;i++){const a=i*2.4,r=i?(.55+(i%2)*.35):0;const g=new THREE.SphereGeometry(.24+(i%3)*.07,16,10,0,TAU,0,Math.PI*.5);g.translate(Math.cos(a)*r,.04,Math.sin(a)*r);add(g,1,i*1.4,i);}
    }
    function merged(){
      const attrs={position:[],normal:[],uv:[],aPart:[],aPhase:[],aUnit:[]},indices=[];let offset=0;
      for(const g of pieces){for(const key of Object.keys(attrs))attrs[key].push(...g.attributes[key].array);if(g.index)for(const i of g.index.array)indices.push(i+offset);else for(let i=0;i<g.attributes.position.count;i++)indices.push(i+offset);offset+=g.attributes.position.count;g.dispose();}
      pieces.length=0;const g=new THREE.BufferGeometry();for(const [key,data] of Object.entries(attrs))g.setAttribute(key,new THREE.Float32BufferAttribute(data,key==='position'||key==='normal'?3:key==='uv'?2:1));g.setIndex(indices);return g;
    }
    const lifeGLSL=spec.burst?`float life=clamp(uTime/${spec.duration.toFixed(1)},0.0,1.0);float alive=smoothstep(0.0,.025,life)*(1.0-smoothstep(.70,1.0,life));`:'float life=0.0;float alive=1.0;';
    const mainVertex=`uniform float uRetire,uOpening,uStopTime,uQuantity;varying float vPart;attribute float aPart;attribute float aPhase;attribute float aUnit;uniform float uTime;uniform float uStretch;varying vec2 vUv;varying vec3 vN;varying vec3 vP;varying float vFade;varying float vPhase;varying float vSandMass;${noise}
      mat2 rot(float a){return mat2(cos(a),-sin(a),sin(a),cos(a));}
      #if SPELL == 3
        varying vec2 vStroke;varying float vHalfLength;
        float lightningNoise(float h,float cells,float seed){float f=h*cells,i=floor(f);return mix(hash(vec2(i,seed)),hash(vec2(i+1.0,seed)),fract(f))*2.0-1.0;}
        vec3 thunderMain(float h){float f=floor(uTime*18.0);vec2 bend=vec2(lightningNoise(h,7.0,f),lightningNoise(h,6.0,f+17.0))*.42+vec2(lightningNoise(h,83.0,f+31.0),lightningNoise(h,79.0,f+49.0))*.045;return vec3(bend.x*sin(h*PI),4.05-h*5.4,bend.y*sin(h*PI));}
        vec3 thunderGround(float h,float id){float a=id*2.39996,f=floor(uTime*(13.0+mod(id,3.0)))+id*17.0,j=lightningNoise(h,27.0,f)*sin(h*PI),reach=2.15+hash(vec2(id,7.0))*1.2;return vec3(cos(a)*h*reach,-1.30+sin(h*PI)*(.16+hash(vec2(id,11.0))*.8),sin(a)*h*reach)+vec3(-sin(a),.3,cos(a))*j*.14;}
        vec3 thunderPoint(float h,float id){
          if(id<.5)return thunderMain(h);
          float a=id*2.39996,f=floor(uTime*16.0)+id*17.0,j=lightningNoise(h,31.0,f)*sin(h*PI);
          if(id<2.5)return thunderMain(h)+vec3(cos(a),.12,sin(a))*sin(h*PI)*(.22+.25*sin(h*8.0+id))+vec3(j*.10,0,-j*.08);
          if(id<10.5){float root=(18.0+(id-3.0)*7.0)/96.0,reach=1.2+hash(vec2(id,2.0))*1.5;return thunderMain(root)+vec3(cos(a)*h*reach,-h*(.7+reach*.4),sin(a)*h*reach)+vec3(-sin(a),.3,cos(a))*j*.18;}
          if(id<22.5)return thunderGround(h,id);
          return thunderGround(.5,id-12.0)+vec3(cos(a+.8)*h*.8,sin(h*PI)*.25,sin(a+.8)*h*.8)+vec3(-sin(a),.4,cos(a))*j*.11;
        }
        float lightningPulse(float t,float begin,float end){return smoothstep(begin,begin+.025,t)*(1.0-smoothstep(end-.065,end,t));}
      #endif
      void main(){vUv=uv;vPhase=aPhase;vPart=aPart;vSandMass=1.0;vec3 p=position;vec3 n=normal;${lifeGLSL}vFade=alive;
        // Early clipping also covers branches that replace vFade or return early.
        if(aUnit>=uQuantity){vFade=0.0;vP=vec3(0);vN=vec3(0,1,0);gl_Position=vec4(2,2,2,1);return;}
        #if SPELL == 0
          if(aPart>1.5){
            float seed=fract(aPhase*.618034),age=max(0.0,life-seed*.10),grow=smoothstep(.0,.20,age);
            float lane=mod(aPhase,4.0)-1.5,h=.25+floor(aPhase/4.0)*.22;
            if(abs(uQuantity-5.0)>.1)lane=uQuantity<1.5?0.0:(aUnit/(uQuantity-1.0)*2.0-1.0)*1.5;
            float turn=h*(1.5+age*1.0)+age*.12;
            p=vec3(lane*(.18+h*.64)*grow,-1.25+sin(turn)*1.35*grow+h*.3*grow,(1.0-cos(turn))*.95*grow+age*.65);
            p.y+=smoothstep(.55,.98,age)*.48;p.y=-1.3+(p.y+1.3)*uSize;p.xz*=uSize;
            vec4 mv=modelViewMatrix*vec4(p,1.0);float width=(.15+grow*.66)*(1.0-smoothstep(.62,.99,age)*.55);
            mv.xy+=(uv-.5)*width*uSize*vec2(1.15,1.25)*length(modelMatrix[1].xyz);
            vFade=smoothstep(.0,.07,age)*(1.0-smoothstep(.82,1.0,age));vP=p;vN=normalize(mat3(viewMatrix)*vec3(-.45,.8,.55));gl_Position=projectionMatrix*mv;return;
          }
          float seed=fract(aPhase*.618034),lane=aPhase<3.0?aPhase-1.0:(aPhase-3.5)*1.5;
          if(abs(uQuantity-5.0)>.1)lane=uQuantity<1.5?0.0:aUnit/(uQuantity-1.0)*2.0-1.0;
          float age=max(0.0,life-seed*.10),grow=smoothstep(.0,.20,age),h=uv.x;
          float curl=h*(1.5+age*1.0)+age*.12,bulk=(aPhase<3.0?1.0:.66)*grow;
          float height=bulk*(1.30+seed*.25),width=pow(max(0.0,sin(h*PI)),.65)*(.36+seed*.12)*bulk;
          width*=1.0-smoothstep(.55,.96,age)*.7;
          float around=uv.y*PI*2.0,wrinkle=1.0+sin(h*13.0-age*8.0+around*3.0+aPhase)*.12;
          vec3 center=vec3(lane*(.38+h*.78)*grow,-1.26+sin(curl)*height+h*.3*grow,(1.0-cos(curl))*height*.70+age*.65);
          p=center+vec3(cos(around)*width*wrinkle,-sin(around)*sin(curl)*width*.55,sin(around)*cos(curl)*width*.55);
          p.y+=smoothstep(.60,.95,age)*h*.45;vFade=smoothstep(.0,.04,age)*(1.0-smoothstep(.90,1.0,age));
        #elif SPELL == 1
          p.xy=rot(uTime*4.0)*p.xy;n.xy=rot(uTime*4.0)*n.xy;p.yz=rot(.15*sin(uTime*2.0))*p.yz;
        #elif SPELL == 2
          if(aPart>.5){
            if(abs(uQuantity-9.0)>.1){
              vec2 from=vec2(mod(aUnit,3.0)-1.0,floor(aUnit/3.0)-1.0)*.85;
              if(aUnit>8.5){float e=aUnit-9.0;from=e<.5?vec2(.425,.425):e<1.5?vec2(-.425,.425):e<2.5?vec2(.425,-.425):e<3.5?vec2(-.425,-.425):e<4.5?vec2(0,.425):e<5.5?vec2(0,-.425):e<6.5?vec2(.425,0):e<7.5?vec2(-.425,0):vec2(.425,.85);}
              float columns=ceil(sqrt(uQuantity)),rows=ceil(uQuantity/columns),row=floor(aUnit/columns),inRow=min(columns,uQuantity-row*columns);
              vec2 to=vec2(inRow<1.5?0.0:(mod(aUnit,columns)/(inRow-1.0)*2.0-1.0)*.85,rows<1.5?0.0:(row/(rows-1.0)*2.0-1.0)*.85);p.xz+=to-from;
            }
            p.y+=.18*sin(uTime*1.4+aPhase);float turn=uTime*.18;float angle=(floor(turn)+smoothstep(.25,.75,fract(turn)))*PI*.5;p.xz=rot(angle)*p.xz;if(abs(uQuantity-9.0)>.1)n.xz=rot(angle)*n.xz;
          }
        #elif SPELL == 3
          float h=mix(position.x,position.y,uv.x),id=aPhase,head=clamp((uTime-.08)/.16,0.0,1.0),primary=1.0-smoothstep(.64,.86,uTime);
          if(aPart>3.5){
            float sky=1.0-step(4.5,aPart),growth=smoothstep(0.0,.17,uTime);
            p=position*(sky>0.5?6.2:7.0)*(sky>0.5?.35+growth*.65:.6+smoothstep(.22,.55,uTime)*.4);p.y=sky>0.5?4.05+p.z*.42:-1.32;
            p.y=-1.35+(p.y+1.35)*uSize;p.xz*=uSize;
            vFade=sky>0.5?smoothstep(0.0,.06,uTime)*(1.0-smoothstep(.46,.88,uTime)):lightningPulse(uTime,.22,.85);
            vP=p;vN=vec3(0,1,0);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1);return;
          }
          if(aPart>2.5){
            vFade=id<.5?lightningPulse(uTime,.22,.72)+lightningPulse(uTime,1.02,1.22)*.3+lightningPulse(uTime,1.65,1.83)*.18:lightningPulse(uTime,.015,.65);
            p=vec3(0,-1.35+(id<.5?.13:5.4)*uSize,0);vec4 mv=modelViewMatrix*vec4(p,1);
            mv.xy+=position.xy*(id<.5?4.4:4.8)*uSize*length(modelMatrix[1].xyz);vP=p;vN=vec3(0,0,1);gl_Position=projectionMatrix*mv;return;
          }
          float root=(18.0+(id-3.0)*7.0)/96.0,reveal=step(aPart<.5?h:root,head)*step(.081,uTime);
          vFade=primary*reveal*(id<.5?1.0:id<2.5?.7:.48+.3*hash(vec2(id,floor(uTime*17.0))));
          if(aPart>1.5){float delay=hash(vec2(id,3.0));float growth=clamp((uTime-.17-delay*.025)*8.0,0.0,1.0);
            vFade=lightningPulse(uTime,.23+delay*.035,.72+delay*.15);
            vFade+=lightningPulse(uTime,.96+delay*.18,1.16+delay*.18)*.67+lightningPulse(uTime,1.58+delay*.2,1.78+delay*.2)*.45;
            vFade*=step(h,growth)*(1.0-smoothstep(.7,1.0,h));
          }
          vec3 p0=thunderPoint(position.x,id),p1=thunderPoint(position.y,id);p0.y=-1.35+(p0.y+1.35)*uSize;p1.y=-1.35+(p1.y+1.35)*uSize;p0.xz*=uSize;p1.xz*=uSize;
          vec4 m0=modelViewMatrix*vec4(p0,1),m1=modelViewMatrix*vec4(p1,1);vec2 delta=m1.xy-m0.xy;float len=length(delta);vec2 along=len<.0001?vec2(1,0):delta/len;
          float mid=(position.x+position.y)*.5,width=id<.5?.40:id<2.5?.16:id<10.5?.12:id<22.5?.19:.065;width*=aPart<.5?.5+.5*sin(mid*PI):1.0-mid*.82;width*=uSize*length(modelMatrix[1].xyz);
          vec4 mv=mix(m0,m1,uv.x);mv.xy+=(along*(uv.x*2.0-1.0)+vec2(-along.y,along.x)*(uv.y*2.0-1.0))*width;
          vHalfLength=len/max(width,.00001)*.5;vStroke=vec2((uv.x*2.0-1.0)*(vHalfLength+1.0),uv.y*2.0-1.0);vP=mix(p0,p1,uv.x);vN=vec3(0,0,1);gl_Position=projectionMatrix*mv;return;
        #elif SPELL == 4
          if(aPart<.5||aPart>1.5){p.yz*=.92+.08*sin(uTime*3.0+position.x*4.0);p.yz*=uSize;}else{p.yz=rot(uTime*.35)*p.yz*uSize;p.x=sign(p.x)*2.4+(p.x-sign(p.x)*2.4)*uSize/max(uStretch,.001);}vFade*=smoothstep(0.0,.25,uTime);
        #elif SPELL == 5
          float cycle=fract(uTime*.52+aPhase*.15915),tight=smoothstep(.05,.15,cycle)*(1.0-smoothstep(.38,.83,cycle));
          float release=smoothstep(.0,.66,uRetire),h=uv.x,a=aPhase/2.1*2.094395;
          if(abs(uQuantity-3.0)>.1)a=aUnit*PI*2.0/uQuantity;
          float hook=smoothstep(.70,1.0,h),b=a+h*1.1+hook*(2.7-release*2.1);
          float r=(.28+sin(h*PI)*1.04)*(1.0-tight*.63)+release*h*.85;
          float width=(.062+.045*sin(h*PI))*(1.0-smoothstep(.86,1.0,h)*.7),side=uv.y*PI*2.0;
          p=vec3(cos(b)*(r+cos(side)*width),.06+sin(h*PI)*1.55+hook*.25+sin(side)*width*.35,sin(b)*(r+cos(side)*width));
          p.y*=smoothstep(.0,.85,uOpening);p.y-=release*release*h*.45;
          vFade*=1.0-smoothstep(.62,.98,uRetire);
        #elif SPELL == 6
          float delay=fract(aPhase*.37)*.18;float retract=smoothstep(delay,.95,uRetire);float h=max(0.0,position.y);float root=aPhase*PI*.5;
          if(aUnit>=0.0&&abs(uQuantity-4.0)>.1){float original=aUnit*PI*2.0/(aUnit<3.5?4.0:8.0);root=aUnit*PI*2.0/uQuantity;p.xz=rot(original-root)*p.xz;n.xz=rot(original-root)*n.xz;}
          vec2 leafRadial=normalize(p.xz+vec2(.0001)),base=vec2(cos(root),sin(root))*.8;
          float bend=retract*(1.3+h*1.3),arc=h*max(.12,1.0-retract*.65);p.xz=base+(p.xz-base)*(1.0-retract*.55);
          p.xz+=vec2(cos(root),sin(root))*(1.0-cos(bend))*arc*.45;p.y=max(.025,arc*sin(bend+.001)/(bend+.001));
          if(aPart>1.5){float fold=smoothstep(.0,.7,retract);float attach=.35+floor(max(0.0,h-.35)/.43)*.43;float blade=uv.x*.55;vec2 radial=leafRadial;p.xz-=radial*blade*fold;p.y+=blade*sin(fold*PI*.8)*.35;}
          p.y*=smoothstep(.0,.85,uOpening);vFade*=1.0-smoothstep(.78,1.0,uRetire);
        #elif SPELL == 7
          p.yz=rot(uTime*2.7-aPhase)*p.yz;n.yz=rot(uTime*2.7-aPhase)*n.yz;if(aPart>.5){p.x-=aPart*.45;p.y+=sin(uTime*3.0-aPart)*.12;vFade*=.23*(1.0-aPart*.18);}
        #elif SPELL == 8
          float across=uv.x*2.0-1.0,a=across*1.6;
          float age=max(0.0,life-abs(across)*.12),grow=smoothstep(.0,.15,age),crash=smoothstep(.27,.58,age);
          float height=(.5+pow(max(0.0,1.0-across*across),.6)*.8)*grow;
          height*=1.0+sin(across*12.0-age*7.0)*.14+sin(across*23.0+age*4.0)*.07;
          float theta=position.y*PI*2.0,radial=.85+life*2.2;
          float roll=crash*1.35,yy=(1.0-cos(theta))*height*.5,rr=sin(theta)*(.25+height*.22);
          float y=yy*cos(roll)-rr*sin(roll),r=radial+yy*sin(roll)+rr*cos(roll);
          float breaking=smoothstep(.27+.04*sin(across*9.0),.61+.035*sin(across*13.0),age);
          float crown=pow(max(0.0,sin(position.y*PI)),2.0);y-=breaking*height*.95*crown;r+=breaking*crown*.35;vSandMass=max(0.0,y)/max(.01,height);
          p=vec3(sin(a)*r,-1.3+max(.025,y),cos(a)*r-.5);if(aPart>.5)p.y+=.016;
          n=normalize(vec3(sin(a)*sin(theta+roll),-cos(theta+roll),cos(a)*sin(theta+roll)));
          vFade*=1.0-smoothstep(.42,.67,age);
          if(aPart>1.5){
            float side=(aPhase/11.0)*2.0-1.0,born=.27+abs(side)*.12+sin(aPhase*2.4)*.025,local=max(0.0,life-born),on=smoothstep(.0,.055,local);
            float angle=side*1.6,rr=.85+life*2.2+local*.75;
            p=vec3(sin(angle)*rr,-1.3+max(.035,.82+local*.6-local*local*8.0),cos(angle)*rr-.5);
            p.y=-1.3+(p.y+1.3)*uSize;p.xz*=uSize;
            vec4 mv=modelViewMatrix*vec4(p,1.0);float width=(.42+local*.90)*on;
            mv.xy+=(uv-.5)*width*uSize*length(modelMatrix[1].xyz);vP=p;vN=normalize(mat3(viewMatrix)*vec3(-.45,.8,.55));vFade=on*(1.0-smoothstep(.32,.60,local));gl_Position=projectionMatrix*mv;return;
          }
        #elif SPELL == 9
          float bank=aUnit,origin=uStopTime<0.0?uTime:uStopTime;
          float cycle=fract(origin*.24+bank*.31);if(uRetire>0.0)cycle=min(.999,cycle+uRetire*.9);
          float packet=aUnit<2.5?step(2.5,aPhase):step(5.5,aPhase),side=pow(sin(uv.x*PI),.65);
          float local=clamp((cycle-.10-uv.x*.25)*2.4,0.0,1.0);
          float slide=smoothstep(.02,.88,local),build=smoothstep(.0,.16,cycle);
          float angle=bank*PI*2.0/uQuantity+.32+(uv.x-.5)*1.55;
          if(uQuantity>3.5)angle=bank*PI*2.0/uQuantity+.32+(uv.x-.5)*1.55*3.0/uQuantity;
          float crest=.82-slide*.52,radial=.12+uv.y*1.25;
          float profile=max(0.0,min(uv.y/max(.08,crest),(1.0-uv.y)/(1.0-crest)));
          float scar=exp(-pow((uv.y-crest)*6.0,2.0))*sin(slide*PI);
          float height=profile*side*(.17+build*.25)*(1.0-scar*.85)*(1.0-slide*.55);
          height+=sin(uv.x*19.0+bank)*.025*profile;
          if(packet>.5){radial=.18+(1.0-slide)*.66+(uv.y-.5)*.28;
            height=sin(uv.y*PI)*side*.20*sin(slide*PI);vFade*=sin(slide*PI);}
          p=vec3(cos(angle)*radial,.025+height*smoothstep(.0,.75,uOpening),sin(angle)*radial);
          float sink=smoothstep(.04+uv.y*.30,.86,uRetire);p.xz*=.72*(1.0-sink*(1.0-uv.y)*.85);vSandMass=height*(1.0-sink);p.y=.025+vSandMass;
          n=normalize(vec3(cos(angle)*(uv.y<crest?-1.3:1.0),1.0,sin(angle)*(uv.y<crest?-1.3:1.0)));
          vFade*=1.0-smoothstep(.74,.99,uRetire);
        #elif SPELL == 10
          if(aPart<1.5){float gather=1.0-smoothstep(0.0,.36,life)*.82;p*=gather;p.xz=rot(uTime*(1.0+life*3.0))*p.xz;vFade*=1.0-smoothstep(.35,.50,life);}else{float start=.31+fract(aPhase*.37)*.065;float age=max(0.0,life-start);float release=smoothstep(.0,.08,age);float a=aPhase*4.8;vec3 direction=normalize(vec3(cos(a),sin(aPhase*4.0)*.8,sin(a)));
          if(abs(uQuantity-10.0)>.1){float y=uQuantity<1.5?0.0:((aUnit+.5)/uQuantity*2.0-1.0)*.8;float azimuth=aUnit*2.399963;float radial=sqrt(1.0-y*y);direction=vec3(cos(azimuth)*radial,y,sin(azimuth)*radial);}
          vec3 side=normalize(cross(direction,vec3(0,1,0))),up=cross(direction,side);if(abs(uQuantity-10.0)>.1)n=side*cos(uv.y*PI*2.0)+up*sin(uv.y*PI*2.0);
          float head=exp(-pow((uv.x-.86)*13.0,2.0));float radius=(head*.052+uv.x*.006)*(1.0-smoothstep(.12,.30,age));p=direction*(age*8.0+uv.x*(1.30-age*2.8))+(side*cos(uv.y*PI*2.0)+up*sin(uv.y*PI*2.0))*radius;vFade*=release*(1.0-smoothstep(.15,.34,age));}
        #elif SPELL == 11
          float turn=-uTime*2.4+aPhase*.1;p.yz=rot(turn)*p.yz;n.yz=rot(turn)*n.yz;p.yz*=1.0+.08*sin(uv.x*12.0-uTime*5.0+aPhase);
        #elif SPELL == 12
          if(abs(uQuantity-7.0)>.1){float r=aUnit<.5?0.0:.55+mod(aUnit,2.0)*.35;float angle=(aUnit-1.0)*PI*2.0/max(1.0,uQuantity-1.0);p.xz+=(vec2(cos(angle),sin(angle))-vec2(cos(aUnit*2.4),sin(aUnit*2.4)))*r;}
          float pop=uRetire>0.0?clamp(uRetire*1.55-fract(aPhase*.23)*.3,0.0,1.0):fract(uTime*.24+aPhase*.17);p.y*=.8+sin(pop*PI)*.5;p.y*=smoothstep(.0,.6,uOpening);vFade*=1.0-smoothstep(.91,1.0,pop);
        #endif
        #if SPELL != 4
          #if KIND == 3
            p.y=-1.3+(p.y+1.3)*uSize;p.xz*=uSize;
          #else
            p*=uSize;
          #endif
        #endif
        vP=p;vN=normalize(normalMatrix*n);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);
      }`;
    const mainFragment=`uniform float uRetire;varying float vPart;uniform vec3 uColor;uniform float uTime;varying vec2 vUv;varying vec3 vN;varying vec3 vP;varying float vFade;varying float vPhase;varying float vSandMass;${noise}${flow}${smokeLight}${projectileToon}
      #if SPELL == 3
        varying vec2 vStroke;varying float vHalfLength;
      #endif
      void main(){
        #if SPELL == 3
          vec3 cyan=pow(uColor,vec3(.55))*vec3(.65,1.4,1.0);
          if(vPart>3.5){
            vec2 q=vUv*2.0-1.0;float r=length(q),a=atan(q.y,q.x),t=uTime,n=noise2(vec2(cos(a),sin(a))*5.0+t*.8);
            float energy=0.0;
            if(vPart<4.5){
              float warped=r+(n-.5)*.10+(noise2(vec2(cos(a),sin(a))*17.0-t*2.0)-.5)*.025;
              float flicker=.25+.75*smoothstep(.24,.72,noise2(vec2(cos(a),sin(a))*4.0+floor(t*16.0)));
              float rim=(exp(-pow((warped-.68)*80.0,2.0))+exp(-pow((warped-.59)*110.0,2.0))*.65)*flicker;
              float swirl=pow(max(0.0,sin(a*3.0+log(max(.08,r))*13.0-t*11.0)),30.0)*(1.0-smoothstep(.12,.7,r));
              energy=rim*.8+swirl*.4+exp(-pow((warped-.63)*8.0,2.0))*(.08+n*.19)+exp(-r*r*12.0)*.16;
            }else{
              float front=.2+min(t,.75)*.75;
              float ripple=exp(-pow((r-front-(n-.5)*.04)*70.0,2.0));
              energy=exp(-r*r*9.0)*.25+ripple*.16+exp(-pow((r-front)*12.0,2.0))*.08;
            }
            gl_FragColor=vec4(cyan+vec3(pow(energy,3.0)),energy*vFade*(1.0-smoothstep(.82,1.0,r)));${output}gl_FragColor.rgb*=min(1.0,gl_FragColor.a);gl_FragColor.a=min(1.0,gl_FragColor.a)*.6;return;
          }
          if(vPart>2.5){vec2 q=vUv*2.0-1.0;float r=length(q),hot=exp(-r*r*145.0),inner=exp(-r*r*35.0),halo=exp(-r*r*4.5),streak=exp(-q.y*q.y*1400.0-abs(q.x)*4.0);
            gl_FragColor=vec4(mix(uColor,cyan,inner)+vec3(hot*2.0),(hot+inner*.6+halo*.22+streak*.42)*vFade*(1.0-smoothstep(.8,1.0,r)));${output}gl_FragColor.rgb*=min(1.0,gl_FragColor.a);gl_FragColor.a=min(1.0,gl_FragColor.a)*.6;return;}
          float edge=length(vec2(max(0.0,abs(vStroke.x)-vHalfLength),vStroke.y)),core=exp(-edge*edge*180.0),sheath=exp(-edge*edge*40.0),halo=exp(-edge*edge*6.0);
          gl_FragColor=vec4(mix(uColor,cyan,sheath)+vec3(core*1.5),(core+sheath*.65+halo*.18)*(1.0-smoothstep(.8,1.0,edge))*vFade);${output}gl_FragColor.rgb*=min(1.0,gl_FragColor.a);gl_FragColor.a=min(1.0,gl_FragColor.a)*.6;return;
        #endif
        #if SPELL == 0
          if(vPart>1.5){
            float age=max(0.0,uTime/3.0-fract(vPhase*.618034)*.10);vec2 q=vUv*2.0-1.0;
            float spin=age*3.0+vPhase;q=mat2(cos(spin),-sin(spin),sin(spin),cos(spin))*q;
            vec3 n=noiseGradient(q*2.5+vec2(vPhase*7.0,-age*2.0));float d=length(q)+(n.x-.5)*.30;
            vec2 lit=smokeOptics(q,n.yz*2.5,n.x,vN);float burn=smoothstep(.45,.96,age);
            float alpha=(1.0-smoothstep(.76,.98,d))*smoothstep(.05+burn*.65,.20+burn*.65,n.x+(1.0-d)*.5)*vFade;
            float heat=.12+n.x*.39+(1.0-d)*.30+lit.x*.16;
            vec3 c=mix(uColor*.23,uColor*1.08,toonStep(.4,heat));c=mix(c,vec3(1,.91,.53),toonStep(.67,heat));
            if(alpha<.005)discard;gl_FragColor=vec4(c,alpha);${output}return;
          }
        #endif
        #if SPELL == 8
          if(vPart>1.5){vec2 q=vUv*2.0-1.0;vec3 nn=noiseGradient(q*2.7+vec2(vPhase*6.0,-uTime*.8));float d=length(q)+(nn.x-.5)*.32;
            float alpha=(1.0-smoothstep(.62,.98,d))*smoothstep(.05,.23,nn.x+(1.0-d)*.25)*vFade;
            vec2 optic=smokeOptics(q,nn.yz*2.7,nn.x,vN);vec3 c=mix(uColor*.7,vec3(.83,.96,1),toonStep(.42,optic.x*.5+nn.x*.3+.2));
            if(alpha<.004)discard;gl_FragColor=vec4(c,alpha);${output}return;}
        #endif
        vec3 shadingNormal=normalize(vN);
        #if SPELL == 0 || SPELL == 5 || SPELL == 6 || SPELL == 11
          shadingNormal=normalize(cross(dFdx(vP),dFdy(vP)));
        #endif
        float shade=.25+.65*abs(dot(shadingNormal,normalize(vec3(-.4,.8,.5))));float alpha=vFade;float ink=0.0;
        #if SPELL == 0
          float age=max(0.0,uTime/3.0-fract(vPhase*.618034)*.10);
          float n=noise2(vec2(vUv.x*6.0-age*4.0,vUv.y*3.0+vPhase*1.7));
          float curl=noise2(vec2(vUv.x*12.0-age*6.0,vUv.y*5.0+vPhase));
          float burn=smoothstep(.43,.93,age)*(1.0-vUv.x*.4);
          float tear=n*.65+curl*.20+sin(vUv.x*PI)*.25-burn*1.35;
          alpha*=smoothstep(.01,.09,tear)*(1.0-smoothstep(.64,.86,age));
          shade=.13+n*.27+shade*.20+pow(max(0.0,sin(vUv.y*PI*2.0+vUv.x*4.0-age*3.0)),3.0)*.35;
        #elif SPELL == 3
          shade=.52+.35*pow(abs(cos(vUv.y*6.283)),3.0);
        #elif SPELL == 4
          float axial=pow(max(0.0,cos(vP.x*7.0-uTime*8.0)),10.0);shade=vPart<.5?.93:.6+axial*.3;
          alpha*=vPart>1.5?.16+.12*axial:vPart>.5?sin(vUv.x*3.14159)*(.55+.3*axial):.94;
        #elif SPELL == 5 || SPELL == 7
          #if SPELL == 5
            alpha*=1.0-smoothstep(.87,1.0,uRetire);
            float curse=fract(vUv.x*8.0-uTime*.9+vPhase*.17);
            float etch=1.0-smoothstep(.04,.13,abs(curse-.5));
            float stain=noise2(vec2(vUv.x*5.0-uTime*1.1,vUv.y*2.0+vPhase));
            shade=mix(.14,.47,smoothstep(.51,.67,stain));shade=max(shade,etch*.77*pow(abs(sin(vUv.y*PI*2.0)),7.0));
            alpha*=smoothstep(uRetire*.8-.12,uRetire*.8+.08,stain+vUv.x*.18);
            alpha*=smoothstep(.0,.06,vUv.x);
          #endif
          #if SPELL == 7
            shade*=.64;
          #endif
          #if SPELL == 7
            shade+=.22*pow(max(0.0,sin(vUv.x*14.0-uTime*3.0)),8.0);
          #endif
        #elif SPELL == 8
          float foam=noise2(vec2(vUv.x*23.0,vUv.y*5.0-uTime*1.8));float age=max(.0,uTime/3.2-abs(vUv.x*2.0-1.0)*.17);
          float crest=pow(vUv.y,5.0),breakup=smoothstep(.29,.62,age);
          alpha*=smoothstep(.0,.08,sin(vUv.x*PI))*smoothstep(.015,.10,vSandMass);
          shade=.16+.42*max(0.0,dot(shadingNormal,normalize(vec3(-.4,.8,.5))))+foam*.17;
          if(vPart>1.5){shade=.18+shade*.65;float top=sin(vUv.y*PI*2.0);shade=max(shade,smoothstep(.52,.8,top)*.93);alpha*=smoothstep(.0,.12,sin(vUv.x*PI));}
          else if(vPart>.5){shade=.94;alpha*=smoothstep(.35,.64,foam)*.88;}
          else{float torn=foam+(1.0-vUv.y)*.20;alpha*=smoothstep(breakup*.52-.08,breakup*.52+.08,torn);}
        #elif SPELL == 9
          float grain=noise2(vec2(vUv.x*34.0,vUv.y*13.0+uTime*4.0));float slide=pow(.5+.5*sin(vUv.y*39.0+uTime*13.0+sin(vUv.x*28.0)*2.0),16.0);
          shade=.18+max(.0,dot(shadingNormal,normalize(vec3(-.65,.65,.35))))*.28+noise2(vec2(vUv.x*10.0,vUv.y*14.0+uTime*4.0))*.20;alpha*=smoothstep(.015,.065,vSandMass);alpha*=smoothstep(.0,.12,sin(vUv.x*PI))*smoothstep(.0,.10,sin(vUv.y*PI));alpha*=1.0-smoothstep(.61+vUv.y*.15,.80+vUv.y*.15,uRetire);
        #elif SPELL == 10
          shade=vPart>1.5?mix(.44,.98,smoothstep(.72,.84,vUv.x)):.75;alpha*=vPart>1.5?pow(vUv.x,1.4)*.95:1.0;
        #elif SPELL == 11
          float flow=noise2(vec2(vUv.x*8.0+uTime*1.6,vPhase*3.4+vUv.y*2.0));alpha*=smoothstep(.0,.06,vUv.x)*(1.0-smoothstep(.8,1.0,vUv.x))*smoothstep(.05,.20,flow)*.85;shade=.19+shade*.30+pow(max(0.0,sin(vUv.y*PI*2.0)),4.0)*.27+pow(max(0.0,sin(vUv.x*12.0+uTime*6.0+vPhase)),8.0)*.16;
        #endif
        #if SPELL == 12
          float pop=uRetire>0.0?clamp(uRetire*1.55-fract(vPhase*.23)*.3,0.0,1.0):fract(uTime*.24+vPhase*.17);float hole=smoothstep(.62,.81,pop);float edge=1.0-hole-vUv.y+sin(vUv.x*31.4+vPhase)*hole*.045;alpha*=smoothstep(-.015,.03,edge);float rim=1.0-smoothstep(.0,.07,abs(edge));float membrane=pow(1.0-abs(dot(shadingNormal,vec3(0,0,1))),2.0);shade=.10+shade*.30+max(rim,membrane)*.55;alpha*=.22+max(rim,membrane)*.65;
        #elif SPELL == 6
          if(vPart>1.5)alpha*=1.0-smoothstep(.48-uRetire*.42,.52-uRetire*.42,abs(vUv.y-.5));
        #endif
        #if SPELL != 0 && SPELL != 3 && SPELL != 4 && SPELL != 8 && SPELL != 9 && SPELL != 10 && SPELL != 11 && SPELL != 12
          float edge=abs(dot(normalize(vN),vec3(0,0,1)));ink=1.0-smoothstep(.04,.13+fwidth(edge),edge);
        #endif
        vec3 c=mix(toonShade(uColor,shade),uColor*.09,ink*.8);
        #if SPELL == 0
          c=mix(uColor*.25,uColor*1.08,toonStep(.36,shade));c=mix(c,vec3(1.0,.92,.58),toonStep(.65,shade));
        #elif SPELL == 8
          if(vPart>.5&&vPart<1.5)c=vec3(.83,.96,1.0);
          if(vPart>1.5)c=mix(c,vec3(.83,.96,1.0),smoothstep(.55,.85,sin(vUv.y*PI*2.0)));
        #endif
        if(alpha<.003)discard;gl_FragColor=vec4(c,alpha);${output}
      }`;
    const body=mesh(merged(),shader(mainFragment,mainVertex,{uRetire:lifeUniforms.uLifeEnd,uOpening:lifeUniforms.uLifeStart},false,{SPELL:spell}),2);body.name='school-body';body.material.depthWrite=spell!==0&&spell!==3&&spell!==4&&spell!==10&&spell!==11&&spell!==12;if(spell===12)body.material.side=THREE.FrontSide;
    if(spell===3)electricBlend(body.material);
    if([0,3,5,6,8,9,10,12].includes(spell))body.material.userData.ownLifecycle=true; // 遮住背面及自交疊，避免透明排序條紋。
    // 五種法陣使用不同的解析圖形。所有符文同一繪製，不用貼圖。
    if(kind===2){
      const sigil=shader(`uniform vec3 uColor;uniform float uTime;
        #if SPELL == 9
          uniform float uLifeStart,uLifeEnd;
        #endif
        varying vec2 vUv;${noise}${projectileToon}
        float line(vec2 p,vec2 a,vec2 b,float w){vec2 v=b-a;return 1.0-smoothstep(w,w+.006,length(p-a-v*clamp(dot(p-a,v)/dot(v,v),0.0,1.0)));}
        void main(){vec2 p=(vUv-.5)*3.5;float r=length(p),a=atan(p.y,p.x),m=0.0;float inner=0.0;
          #if SPELL == 2
            float box=max(abs(p.x),abs(p.y));m=band(box-1.3,.018)+band(box-1.43,.012);vec2 cell=abs(fract((p+.325)/.65)-.5);m+=max(band(cell.x-.45,.015),band(cell.y-.45,.015))*step(box,1.3)*.35;
          #elif SPELL == 5
            for(int i=0;i<3;i++){float t=float(i)*2.094;vec2 q=mat2(cos(t),-sin(t),sin(t),cos(t))*p;m+=line(q,vec2(.18,-.08),vec2(1.2,.28),.055)+line(q,vec2(1.2,.28),vec2(.93,.58),.055)+line(q,vec2(.93,.58),vec2(.76,.3),.055);}m+=band(r-.6,.024)*(.5+.5*cos(a*9.0));m*=1.2+.5*sin(uTime*2.5-a*3.0);inner=(1.0-smoothstep(0.0,1.4,r))*.08;
          #elif SPELL == 6
            float leaf=.9+.27*cos(a*6.0);m=band(r-leaf,.025)+band(r-1.42,.014);m+=band(sin(a*3.0)*r,.018)*step(r,1.15);inner=step(r,leaf)*.07;
          #elif SPELL == 9
            for(int i=0;i<3;i++){float t=float(i)*2.094;vec2 b=vec2(cos(t),sin(t))*1.68,c=vec2(cos(t+2.094),sin(t+2.094))*1.68;m+=line(p,b,c,.026)+line(p,b*.74,c*.74,.012);}m+=band(r-.38,.018);inner=exp(-r*r*2.0)*.15;
          #elif SPELL == 12
            float lobes=1.04+.21*cos(a*3.0);m=band(r-lobes,.032)+band(r-lobes*.76,.015);float ripple=fract(r*2.5-uTime*.45);m+=band(ripple-.5,.035)*step(r,lobes)*.25;inner=step(r,lobes)*.14;
          #endif
          float sweep=.45+.55*pow(.5+.5*sin(a*2.0-uTime*1.5+r*3.0),3.0);float alpha=clamp(m*sweep+inner,0.0,.92);
          #if SPELL == 9
            alpha*=smoothstep(.0,.75,uLifeStart)*(1.0-smoothstep(.76,1.0,uLifeEnd));
          #endif
          if(alpha<.003)discard;gl_FragColor=vec4(toonShade(uColor,.35+sweep*.5),alpha);${output}}`,surfaceVertex,{},false,{SPELL:spell});
      if(spell===9)sigil.userData.ownLifecycle=true;
      const disk=mesh(new THREE.PlaneGeometry(3.5,3.5),sigil,0);disk.rotation.x=-Math.PI/2;disk.position.y=.018;corePart(disk);
    }
    // 固定長度尾跡：接合端依核心大小移動，長度與飛行速度分開。
    if(kind===0){
      for(let k=0;k<(spell===7?3:4);k++)surface((u,v)=>{const a=k*TAU/4+u*3.0,r=(1-u)*.3,w=Math.sin(u*Math.PI)*.065*(v*2-1);return [-u*2.8,Math.cos(a)*r+w,Math.sin(a)*r+w*.3];},24,2,0,k);
      const trail=shader(`uniform vec3 uColor;uniform float uTime;varying vec2 vUv;varying float vPhase;${projectileToon}
        void main(){float broken=smoothstep(.1,.3,.5+.5*sin(vUv.x*29.0+uTime*5.0+vPhase));float a=pow(1.0-vUv.x,1.6)*sin(vUv.y*3.14159)*broken*uDetail;gl_FragColor=vec4(toonShade(uColor,.62),a*.75);${output}}`, `attribute float aPhase;uniform float uTime;varying vec2 vUv;varying float vPhase;
        void main(){vUv=uv;vPhase=aPhase;vec3 p=position;p.x-=.38*uSize;float a=uTime*1.4+aPhase;p.yz=mat2(cos(a),-sin(a),sin(a),cos(a))*p.yz;p.yz+=sin(uv.x*12.0-uTime*4.0+aPhase)*uv.x*.06;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}`,{},false);
      mesh(merged(),trail,1).name='school-trail';
    }
    const particle=shader(`uniform vec3 uColor;varying vec2 vUv;varying float vFade;varying float vLight;${projectileToon}
      void main(){vec2 q=vUv*2.0-1.0;float a=1.0-smoothstep(.45,1.0,length(q));
        #if SPELL == 1 || SPELL == 2 || SPELL == 10
          a=1.0-smoothstep(.5,.9,abs(q.x)+abs(q.y));
        #elif SPELL == 3
          a=exp(-q.y*q.y*35.0)*(1.0-smoothstep(.4,1.0,abs(q.x)));
        #elif SPELL == 7 || SPELL == 11
          a=(1.0-smoothstep(.1,.7,abs(q.y)))*(1.0-smoothstep(.65,1.0,abs(q.x)));
        #endif
        vec3 color=toonShade(uColor,vLight);
        #if SPELL == 3
          color=uColor*1.3+vec3(exp(-dot(q,q)*14.0)*1.8);
        #endif
        if(a*vFade<.003)discard;gl_FragColor=vec4(color,a*vFade*uDetail);${output}}`,
      `attribute vec4 seed;uniform float uTime,uStopTime,uQuantity;
#if SPELL == 12 || SPELL == 9
uniform float uLifeEnd,uLifeStart;
#endif
uniform float uStretch;varying vec2 vUv;varying float vFade;varying float vLight;${noise}
      void main(){vUv=uv;${lifeGLSL}float f=fract(seed.x+uTime*(.25+seed.w*.3)),a=seed.y*6.283;vec3 p=vec3(0);float scale=.035+seed.w*.055;vFade=sin(f*PI)*alive*.7;vLight=.45+seed.w*.4;
        #if SPELL == 0
          float t=max(0.0,uTime-seed.x*.6);p=vec3((seed.y-.5)*(1.0+t),-1.25+t*(1.4+seed.z)-t*t*.2,(seed.z-.5)*(.4+t*.5));scale*=.6;vFade*=1.0-smoothstep(.55,1.0,life);
        #elif SPELL == 1 || SPELL == 7 || SPELL == 11
          p=vec3(-.38*uSize-f*2.8,cos(a)*(f*.4+.1),sin(a)*(f*.4+.1));scale*=1.0-f*.5;
          #if SPELL == 11
            p.yz*=uSize;scale*=.23*uSize;
          #endif
        #elif SPELL == 2
          p=vec3((floor(seed.y*5.0)-2.0)*.65,f*1.2,(floor(seed.z*5.0)-2.0)*.65);scale*=.6;
        #elif SPELL == 3
          float t=max(0.0,uTime-.23-seed.x*.1),r=(1.0-exp(-t*4.0))*(.8+seed.z*2.8);p=vec3(cos(a)*r,-1.3+sin(min(t,1.0)*PI)*seed.z*1.35,sin(a)*r);vFade*=smoothstep(.0,.04,t)*(1.0-smoothstep(.35,.95,t))*(1.0-step(.13,seed.w));scale*=uSize*1.4;
        #elif SPELL == 4
          float end=seed.x<.5?-1.0:1.0;p=vec3(end*2.4+end*f*.2/max(uStretch,.001),cos(a)*(.3+f*.7)*uSize,sin(a)*(.3+f*.7)*uSize);vFade*=smoothstep(0.0,.25,uTime);
        #elif SPELL == 5
          p=vec3(cos(a+uTime*.3)*(.3+f),f*1.3,sin(a+uTime*.3)*(.3+f))*uSize;scale*=.42*uSize;vLight=.35;
        #elif SPELL == 6
          p=vec3(cos(a)*(.3+seed.z),f*1.8,sin(a)*(.3+seed.z));scale*=.7;
        #elif SPELL == 8
          float across=seed.y*2.0-1.0,delay=abs(across)*.17+sin(across*7.0)*.025;
          float born=(.34+delay)*3.2+seed.x*.26,t=max(0.0,uTime-born),r=.7+born/3.2*2.1+.4+t*1.2;
          p=vec3(sin(across*1.6)*r,max(-1.27,-.55+t*(.35+seed.z*.7)-t*t*2.4),cos(across*1.6)*r-.5);
          vLight=.8+seed.w*.18;vFade=smoothstep(.0,.06,t)*(1.0-smoothstep(.40,1.0,t))*.88;
          scale=seed.x<.18?.08+seed.w*.08:.035+seed.w*.045;scale*=1.0+step(p.y,-1.26)*.55;
        #elif SPELL == 9
          float bank=floor(seed.y*uQuantity),angle=bank*PI*2.0/uQuantity+.32+(seed.z-.5)*1.55;
          if(uQuantity>3.5)angle=bank*PI*2.0/uQuantity+.32+(seed.z-.5)*1.55*3.0/uQuantity;
          float cycle=fract((uStopTime<0.0?uTime:uStopTime)*.24+bank*.31);if(uStopTime>=0.0)cycle=min(.999,cycle+uLifeEnd*.90);
          float local=clamp((cycle-.10-seed.z*.25)*2.4,0.0,1.0),fall=smoothstep(.02,.88,local),crest=.82-.52*fall;
          float v=crest*(1.0-f),r=.10+v*1.23,bankHeight=pow(sin(seed.z*PI),.65)*(.17+smoothstep(.0,.16,cycle)*.25);
          p=vec3(cos(angle)*r*.72,.035+bankHeight*(1.0-f)*(1.0-fall*.85),sin(angle)*r*.72);
          scale=.025+seed.w*.025;vLight=.45+seed.w*.35;vFade*=smoothstep(.27,.4,cycle)*(1.0-smoothstep(.82,.99,cycle))*smoothstep(.0,.7,uLifeStart)*(1.0-smoothstep(.7,1.0,uLifeEnd));
        #elif SPELL == 10
          float outAge=max(.0,life-.36),r=life<.36?(1.0-life/.36)*1.6:outAge*(2.8+seed.w*2.1);
          float sy=seed.z*2.0-1.0,radial=sqrt(max(.0,1.0-sy*sy));a+=outAge*(.6+seed.w);
          p=vec3(cos(a)*radial*r,sy*r,sin(a)*radial*r);vLight=.72+seed.w*.25;vFade*=1.0-smoothstep(.64+seed.x*.13,.83+seed.x*.15,life);
        #elif SPELL == 12
          float bubble=floor(seed.y*uQuantity),ba=bubble*2.4,br=bubble<.5?0.0:.55+mod(bubble,2.0)*.35;
          if(abs(uQuantity-7.0)>.1)ba=(bubble-1.0)*PI*2.0/max(1.0,uQuantity-1.0);
          float flight=uStopTime<0.0?fract(uTime*.24+bubble*.238-.65):max(0.0,uLifeEnd*1.55-fract(bubble*1.4*.23)*.3-.62);
          float splash=flight*4.0,angle=seed.x*PI*2.0;p=vec3(cos(ba)*br+cos(angle)*splash*.3,max(.04,.16+splash*.5-splash*splash*.7),sin(ba)*br+sin(angle)*splash*.3);
          scale*=.6;vLight=.6+seed.w*.3;vFade=smoothstep(.0,.025,flight)*(1.0-smoothstep(.15,.28,flight))*smoothstep(.0,.3,uLifeStart)*(1.0-smoothstep(.85,1.0,uLifeEnd));
        #endif
        #if SPELL == 0 || SPELL == 3 || SPELL == 8 || SPELL == 10
          p.y=-1.3+(p.y+1.3)*uSize;p.xz*=uSize;
        #elif SPELL == 9
          p*=uSize;
        #endif
        vec4 mv=modelViewMatrix*vec4(p,1.0);vec2 card=position.xy*scale;
        #if SPELL == 3
          vec2 along=(modelViewMatrix*vec4(cos(a),.5,sin(a),0)).xy;along=length(along)<.0001?vec2(1,0):normalize(along);card=along*card.x*4.0+vec2(-along.y,along.x)*card.y*.8;
        #endif
        #if SPELL == 7 || SPELL == 11
          card.x*=2.5;
        #endif
        mv.xy+=card;gl_Position=projectionMatrix*mv;
      }`,{},false,{SPELL:spell});
    instanced(new THREE.PlaneGeometry(1,1),cap,1,particle,3).name='school-particles';if(spell===12||spell===9)particle.userData.ownLifecycle=true;
    if(spell===12){
      const mist=shader(`uniform vec3 uColor;uniform float uTime;varying vec2 vUv;varying float vFade;${noise}${projectileToon}
        void main(){vec2 q=vUv*2.0-1.0;float cloud=(1.0-smoothstep(.35,1.0,length(q)))*smoothstep(.2,.7,noise2(q*2.0+uTime*.3));gl_FragColor=vec4(toonShade(uColor,.28),cloud*vFade*.65*uDetail);${output}}`,
        `attribute vec4 seed;uniform float uTime,uStopTime,uLifeStart,uLifeEnd;varying vec2 vUv;varying float vFade;
        void main(){vUv=uv;float f=uStopTime<0.0?fract(seed.x+uTime*.16):min(1.0,fract(seed.x+uStopTime*.16)+uLifeEnd*.65),a=seed.y*6.283+uTime*.25;vec3 p=vec3(cos(a)*(.3+seed.z),.12+f*.35,sin(a)*(.3+seed.z));vec4 mv=modelViewMatrix*vec4(p,1.0);mv.xy+=position.xy*vec2(.65,.28);vFade=sin(f*3.14159)*smoothstep(.0,.5,uLifeStart)*(1.0-smoothstep(.65,1.0,uLifeEnd));gl_Position=projectionMatrix*mv;}`,{},false);
      instanced(new THREE.PlaneGeometry(1,1),32,.0625,mist,4).name='school-mist';mist.userData.ownLifecycle=true;
    }

  }

  if(buildBillowingAirburstEffect({THREE,spec,cap,uniforms,animated,mesh,instanced,shader,output,variation})||buildInkExplosionEffect({THREE,spec,cap,uniforms,animated,mesh,instanced,shader,noise,output})||buildDarkchainEffect({THREE,spec,cap,uniforms,materials,animated,mesh,instanced,shader,output})||buildGoldenChainEffect({THREE,spec,cap,uniforms,geometries,materials,animated,mesh,instanced,shader,output})||buildSpatialSweepEffect({THREE,spec,cap,uniforms,lifeUniforms,materials,mesh,instanced,shader,output})||buildAzureSweepEffect({THREE,spec,cap,mesh,instanced,shader,output})||buildBlackHoleEffect({THREE,kind,variant,cap,uniforms,lifeUniforms,materials,mesh,instanced,shader,output})||buildGrassEffect({THREE,kind,variant,instanced,shader,output})||buildUtilityEffect({THREE,spec,kind,variant,cap,group,uniforms,lifeUniforms,geometries,materials,allocations,animated,mesh,instanced,corePart,shader,noise,output})){}else if(variant>=4){buildSchoolSpell();}else{
  if(kind===5){
    instanced(new THREE.PlaneGeometry(1,1),cap,1,shader(particleFragment,particleVertex,{},false,{CLOUD:1}),0);
  }else{
    instanced(kind===0&&variant===2?new THREE.OctahedronGeometry(0.7):new THREE.PlaneGeometry(1,1),cap,kind===3?0.86:1,shader(particleFragment,particleVertex,{},true,{CLOUD:0}),3);
    if(kind===3)instanced(new THREE.PlaneGeometry(1,1),Math.min(variant===0?116:128,Math.ceil(cap*0.14)),0.14,shader(particleFragment,particleVertex,{},false,{CLOUD:1}),0);
  }
  const billboardVertex=`varying vec2 vUv;void main(){vUv=uv;vec4 mv=modelViewMatrix*vec4(0.0,0.0,0.0,1.0);mv.xy+=position.xy*length(modelMatrix[1].xyz);gl_Position=projectionMatrix*mv;}`;
  function flare(x,width,role){
    const material=shader(`
      uniform vec3 uColor;uniform float uTime;uniform float uRole;
      varying vec2 vUv;${noise}
      void main(){
        vec2 p=vUv*2.0-1.0;float r=length(p),a=atan(p.y,p.x);
        float rays=pow(abs(sin(a*(uRole<0.5?6.0:9.0)+uTime*2.0)),20.0);
        float halo=exp(-r*r*7.5)*0.5;
        float core=exp(-r*r*75.0);
        float crown=band(r-(0.38+sin(uTime*9.0)*0.025),0.012)*(0.4+0.6*pow(abs(sin(a*8.0-uTime*3.0)),4.0));
        float alpha=(halo+core*0.8+rays*exp(-r*5.0)*0.7+crown*0.4)*(1.0-smoothstep(0.8,1.0,r));
        #if KIND == 1
          #if VARIANT == 0
            float aperture=band(r-0.34,0.022)*(0.45+0.55*pow(abs(cos(a*3.0-uTime*1.4)),8.0));
            float splash=pow(max(0.0,cos(a*7.0+sin(a*11.0+uTime*6.0))),14.0)*exp(-r*4.2);
            alpha=core+halo*0.65+(uRole<0.5?aperture:splash)*0.7;
          #elif VARIANT == 1
            float cycle=fract(uTime*1.2-uRole*0.38);
            alpha=core*0.6+halo*0.35+band(r-cycle*0.85,0.026)*(1.0-cycle)*0.85;
            alpha+=pow(max(0.0,cos(a*4.0-uTime)),18.0)*exp(-r*5.0)*0.35;
          #elif VARIANT == 2
            float phase=uTime,release=smoothstep(1.52,1.60,phase),impact=smoothstep(1.61,1.65,phase);
            if(uRole<0.5){
              float intake=fract(r*2.5+phase*1.1);
              float iris=pow(max(0.0,cos(a*5.0-r*9.0+phase*2.5)),12.0);
              alpha=(core*1.2+halo*0.65+iris*exp(-r*3.5)*0.65+band(intake-0.5,0.055)*(1.0-r)*0.25)*(0.1+min(phase/1.52,1.0));
            }else{
              float turbulence=noise2(p*7.0+vec2(phase*2.0,-phase*3.0));
              float corona=exp(-pow((r-0.28-(turbulence-0.5)*0.14)*12.0,2.0));
              float shock=fract(max(0.0,phase-1.62)*1.7);
              alpha=(core*1.5+halo*0.5+corona*0.5+band(r-shock*0.88,0.026)*sin(shock*PI)*0.65)*impact;
            }
          #else
            float jitter=noise2(vec2(cos(a),sin(a))*7.0+floor(uTime*18.0));
            float forks=pow(max(0.0,cos(a*(uRole<0.5?5.0:11.0)+jitter*4.0)),24.0);
            core=exp(-r*r*100.0);
            halo=exp(-r*r*5.5);
            float streak=exp(-p.y*p.y*1100.0)*exp(-abs(p.x)*5.0);
            alpha=core+halo*.42+forks*exp(-r*9.0)*.55+streak*.18;
          #endif
          alpha*=1.0-smoothstep(0.85,1.0,r);
        #endif
        vec3 color=uColor*(1.1+core)+vec3(core*0.45);
        #if KIND == 1 && VARIANT == 3
          color=uColor*(.9+core)+vec3(core*1.7);
        #endif
        gl_FragColor=vec4(color,alpha*(0.88+sin(uTime*17.0)*0.12)*uDetail);${output}
      }`,billboardVertex,{uRole:{value:role}});
    const object=mesh(new THREE.PlaneGeometry(width,width),material,4);object.position.x=x;return object;
  }
  if(kind===0){
    if(variant===0){
      // 一個連續、可變形的火焰體：不使用鏡頭朝向面片、球核或固定箭尖。
      // 尾端到燃燒前緣共用表面；尺寸權重只影響主燃燒區。
      const points=[],uvs=[],indices=[],rings=48,sides=20;
      for(let j=0;j<=rings;j++)for(let k=0;k<=sides;k++){
        const h=j/rings,a=k/sides*Math.PI*2,r=Math.pow(Math.sin(h*Math.PI),.6)*(.12+.5*h);
        points.push(-2.65+h*4.05,Math.cos(a)*r,Math.sin(a)*r);uvs.push(h,k/sides);
      }
      for(let j=0;j<rings;j++)for(let k=0;k<sides;k++){const n=j*(sides+1)+k;indices.push(n,n+1,n+sides+1,n+1,n+sides+2,n+sides+1);}
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);
      const material=shader(`uniform float uTime;uniform vec3 uColor;varying vec2 vUv;varying vec3 vN;varying vec3 vView;${noise}${projectileToon}
        void main(){float h=vUv.x,a=vUv.y*PI*2.0,t=uTime;
          vec2 flowUV=vec2(h*8.0+t*2.7,cos(a)*1.6+sin(a)*2.1);
          float roll=noise2(flowUV),curl=noise2(flowUV*1.71+vec2(t*.9,3.7));
          // 只在前緣和尾端做大塊侵蝕，中央保持連續；不靠碎片堆出主體。
          float tear=roll*.68+curl*.32;
          float front=smoothstep(.78,1.0,h),back=1.0-smoothstep(.04,.40,h);
          if(tear<.16+front*.29+back*.34+sin(a*3.0+h*9.0+t*4.0)*back*.10)discard;
          vec3 n=normalize(vN),eye=normalize(vView);float roundness=abs(dot(n,eye));
          float turn=.5+.5*dot(n,normalize(vec3(-.3,.75,.6)));
          float heat=.10+roundness*.20+turn*.26+roll*.34+sin(h*10.0+a*2.0+t*6.0)*.10;
          // Keep the existing shape and three Toon bands; concentrate heat at the head.
          float headHeat=smoothstep(.40,.86,h);
          heat+=mix(-.04,.04,headHeat);
          vec3 c=mix(uColor*.38,uColor*mix(.90,1.12,headHeat),toonStep(.40,heat));
          c=mix(c,mix(uColor,vec3(1.0,.88,.46),.6)*1.2,toonStep(.64+.12*(1.0-headHeat),heat));
          gl_FragColor=vec4(c,1.0);${output}}`,`${noise}
        uniform float uTime;varying vec2 vUv;varying vec3 vN;varying vec3 vView;
        vec3 flamePoint(float h,float a){
          float t=uTime,body=smoothstep(.28,.68,h),scale=mix(1.0,uSize,body);
          float wave=sin(h*12.0+a*3.0+t*6.5),eddy=sin(h*8.0-a*2.0+t*4.1);
          float capAngle=clamp((h-.8)/.2,0.0,1.0)*PI*.5;
          float capFade=h>=1.0?0.0:cos(capAngle);
          float r=h>.8?pow(sin(.8*PI),.6)*.52*capFade:pow(max(.00001,sin(h*PI)),.6)*(.12+.5*h);
          r*=1.0+(wave*.28+eddy*.20)*mix(1.0,capFade,smoothstep(.78,.9,h));
          float spin=a+h*2.7+sin(h*6.0+t*3.2)*.30;
          float x=h>.8?.59+.52*sin(capAngle):-2.65+h*4.05;
          x+=(sin(a*3.0+t*5.5)*.07+eddy*.06)*smoothstep(.60,.82,h)*capFade*capFade;
          x+=sin(t*4.1)*.035*smoothstep(.78,1.0,h);
          x+=sin(a*3.0+h*8.0+t*5.0)*.35*(1.0-smoothstep(.05,.48,h));
          // 軸向接合比截面縮放更晚開始，避免最大尺寸把尾部折回自身。
          x+=(x-.65)*(uSize-1.0)*smoothstep(.55,.90,h);
          vec2 bend=vec2(sin(h*5.0+t*3.0),cos(h*7.0+t*2.7))*(.04+(.9-h)*.10);
          vec2 crossSection=vec2(cos(spin),sin(spin))*r+bend;
          return vec3(x,crossSection*scale);
        }
        void main(){vUv=uv;float h=clamp(uv.x,.001,1.0),a=uv.y*PI*2.0;vec3 p=flamePoint(h,a);
          float nh=min(h,.998);
          vec3 dh=flamePoint(min(nh+.001,1.0),a)-flamePoint(max(nh-.001,0.0),a);
          vec3 da=flamePoint(nh,a+.003)-flamePoint(nh,a-.003);
          vN=normalMatrix*normalize(cross(da,dh));vec4 mv=modelViewMatrix*vec4(p,1.0);vView=-mv.xyz;gl_Position=projectionMatrix*mv;}`,{},false);
      material.side=THREE.DoubleSide;material.transparent=false;material.depthWrite=true;
      const fire=mesh(g,material,2);fire.name='projectile-core';
    }else if(variant===1){
      // Plasma flight: volumetric charged tip plus five connected ribbon trails.
      const positions=[],uvs=[],indices=[],rings=12,sides=8;
      for(let j=0;j<=rings;j++)for(let k=0;k<=sides;k++){
        const h=j/rings,a=k/sides*Math.PI*2,r=.16*Math.pow(Math.sin(h*Math.PI),.8)*(1+.32*Math.sin(j*2.7+k*1.9));
        positions.push((h*2-1)*.85,Math.cos(a)*r,Math.sin(a)*r);uvs.push(h,k/sides);
      }
      for(let j=0;j<rings;j++)for(let k=0;k<sides;k++){const n=j*(sides+1)+k;indices.push(n,n+1,n+sides+1,n+1,n+sides+2,n+sides+1);}
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);
      const body=shader(`uniform vec3 uColor;uniform float uTime;varying vec2 vUv;
        void main(){float charge=.5+.5*sin(vUv.x*17.0+uTime*12.0),streak=pow(.5+.5*cos(vUv.y*18.8496+sin(vUv.x*17.0-uTime*9.0)*1.7),5.0);
          gl_FragColor=vec4(uColor*vec3(.25,.85,1.7)+vec3(streak*1.8),(.04+streak*.36)*(.6+charge*.4));${output}}`,
        `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`);
      const core=mesh(geometry,body,2);core.name='projectile-core';core.position.x=.85;corePart(core);
      function plasmaRibbons(envelope){
        const p=[],uv=[],roles=[],index=[];
        for(let id=0;id<(envelope?6:5);id++)for(let role=0;role<(envelope?2:1);role++){
          const steps=role?10:32,start=p.length/3;
          for(let j=0;j<=steps;j++)for(let side=0;side<2;side++){p.push(j/steps,id,side*2-1);uv.push(j/steps,side);roles.push(role);}
          for(let j=0;j<steps;j++){const n=start+j*2;index.push(n,n+1,n+2,n+1,n+3,n+2);}
        }
        const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('aBranch',new THREE.Float32BufferAttribute(roles,1));g.setIndex(index);return g;
      }
      const electricFragment=`uniform vec3 uColor;varying vec2 vUv;varying float vFade;
        void main(){float d=abs(vUv.y*2.0-1.0),core=1.0-smoothstep(.12,.28,d),edge=exp(-d*d*12.0),halo=exp(-d*d*3.5);
          float a=max(core,edge*.65+halo*.38)*(1.0-smoothstep(.75,1.0,d))*vFade;
          vec3 blue=pow(uColor,vec3(2.2))*vec3(.12,.65,2.2);gl_FragColor=vec4(mix(blue,vec3(.75,.95,1.0)*1.5,core),a*uDetail);${output}}`;
      function plasmaElectrical(envelope){
        const material=shader(electricFragment,`${noise}uniform float uTime;attribute float aBranch;varying vec2 vUv;varying float vFade;
          vec3 mainPoint(float h,float id){float a=id*1.256637+${envelope?'h*1.8':'h*.5'},tick=floor(uTime*12.0+id*.7),cell=h*22.0;
            float j=mix(hash(vec2(floor(cell),tick+id)),hash(vec2(floor(cell)+1.0,tick+id)),fract(cell))-.5;
            float coarse=h*6.0,bend=mix(hash(vec2(floor(coarse)+id*11.0,tick)),hash(vec2(floor(coarse)+1.0+id*11.0,tick)),fract(coarse))-.5;
            float r=sin(h*PI)*(${envelope?'.42':'.34+id*.095'}+bend*.75+j*.14);
            ${envelope?'return vec3(.79-h*1.52,cos(a)*r,sin(a)*r);':'float attach=mix(uSize,1.0,smoothstep(0.0,.65,h));return vec3(.85+.65*uSize-h*(3.0+sin(id*3.1)*.35)-.65*(uSize-1.0)*smoothstep(0.0,1.0,h),cos(a)*r*attach,sin(a)*r*attach);'}
          }
          vec3 pointAt(float h,float id){if(aBranch<.5)return mainPoint(h,id);float root=.36+mod(id,3.0)*.12,a=id*1.256637+root*1.8;return mainPoint(root,id)+vec3(-.65*h,cos(a)*h*.55,sin(a)*h*.55)+vec3(0,sin(h*19.0+floor(uTime*14.0)+id)*.08,sin(h*23.0+id)*.065)*sin(h*PI);}
          void main(){vUv=uv;float h=position.x,id=position.y;vec4 mv=modelViewMatrix*vec4(pointAt(h,id),1);
            vec4 p0=modelViewMatrix*vec4(pointAt(max(0.0,h-.002),id),1),p1=modelViewMatrix*vec4(pointAt(min(1.0,h+.002),id),1);vec2 delta=p1.xy-p0.xy;
            vec2 side=length(delta)<.00001?vec2(0,1):normalize(vec2(-delta.y,delta.x));float width=${envelope?'id<2.0?.30:.16':'id<.5?.48:.23'};
            width*=mix(1.0,.12,h)*(.8+.2*sin(h*39.0+id));if(aBranch>.5)width*=.38*(1.0-h*.8);
            mv.xy+=side*position.z*width*${envelope?'length(modelMatrix[1].xyz)':'mix(uSize,1.0,smoothstep(0.0,.65,h))*length(modelMatrix[1].xyz)'};
            float pulse=.65+.35*pow(max(0.0,cos(h*24.0-uTime*13.0+id)),8.0);
            vFade=${envelope?'(id<2.0?.85:.5)*(.6+.4*hash(vec2(id,floor(uTime*15.0+id))))':'(id<.5?1.0:.55)*pulse'}*(1.0-smoothstep(.65,1.0,h));if(aBranch>.5)vFade*=.3+.7*step(.4,hash(vec2(id,floor(uTime*12.0+id))));
            gl_Position=projectionMatrix*mv;}`);
        material.side=THREE.DoubleSide;return mesh(plasmaRibbons(envelope),material,3);
      }
      plasmaElectrical(false).name='projectile-trails';const arcs=plasmaElectrical(true);arcs.name='projectile-envelope';arcs.position.x=.85;corePart(arcs);
      const haloMaterial=shader(`uniform vec3 uColor;varying vec2 vUv;void main(){vec2 q=vUv*2.0-1.0;float a=exp(-q.y*q.y*5.0)*pow(max(0.0,1.0-q.x*q.x),1.8)*.32;gl_FragColor=vec4(uColor*vec3(.06,.25,1.8),a*uDetail);${output}}`,
        `varying vec2 vUv;void main(){vUv=uv;vec4 mv=modelViewMatrix*vec4(position.x,0,0,1);vec2 axis=(modelViewMatrix*vec4(1,0,0,0)).xy;vec2 side=length(axis)<.00001?vec2(0,1):normalize(vec2(-axis.y,axis.x));mv.xy+=side*position.y*length(modelMatrix[1].xyz);gl_Position=projectionMatrix*mv;}`);
      haloMaterial.side=THREE.DoubleSide;const halo=mesh(new THREE.PlaneGeometry(2.2,1.6),haloMaterial,1);halo.name='plasma-core-halo';halo.position.x=.85;corePart(halo);
    }else if(variant<3){
      // 電漿／冰晶的尖鋒主體與立體流束，不改共用火焰或其他種類。
      function lance(length,radius,sides=6,steps=8){
        const p=[],uv=[],indices=[];
        for(let j=0;j<=steps;j++){
          const h=j/steps,profile=Math.pow(Math.sin(h*Math.PI),0.9)*(0.65+0.35*h);
          for(let k=0;k<=sides;k++){
            const a=k/sides*Math.PI*2,uneven=1+0.13*Math.sin(a*3+0.8);
            p.push((h*2-1)*length,Math.cos(a)*radius*profile*uneven,Math.sin(a)*radius*profile);
            uv.push(h,k/sides);
          }
        }
        for(let j=0;j<steps;j++)for(let k=0;k<sides;k++){const n=j*(sides+1)+k;indices.push(n,n+1,n+sides+1,n+1,n+sides+2,n+sides+1);}
        const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
      }
      // 合併成一次繪製的非等距流束，橫截面有厚度，沒有交叉面片。
      function streams(paths,steps=28,sides=5){
        const p=[],uv=[],data=[],indices=[];
        for(const path of paths){const start=p.length/3;
          for(let j=0;j<=steps;j++)for(let k=0;k<=sides;k++){p.push(j/steps,Math.cos(k/sides*Math.PI*2),Math.sin(k/sides*Math.PI*2));uv.push(j/steps,k/sides);data.push(...path);}
          for(let j=0;j<steps;j++)for(let k=0;k<sides;k++){const n=start+j*(sides+1)+k;indices.push(n,n+1,n+sides+1,n+1,n+sides+2,n+sides+1);}
        }
        const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('aStream',new THREE.Float32BufferAttribute(data,4));g.setIndex(indices);return g;
      }
      const body=shader(`uniform vec3 uColor;uniform float uTime;varying vec2 vUv;varying vec3 vN;varying vec3 vV;varying vec3 vP;${noise}${projectileToon}
        void main(){float rim=pow(1.0-abs(dot(normalize(vN),normalize(vV))),2.0);vec3 c;float alpha=0.97;
          #if VARIANT == 1
            float charge=pow(max(0.0,sin(vP.x*13.0+uTime*9.0)),12.0);
            float stripe=pow(abs(cos(vUv.y*18.85+vP.x*2.0)),20.0);
            c=toonShade(uColor,.24+rim*.40+stripe*.31+charge*.21);
          #else
            float lit=max(0.0,dot(normalize(vN),normalize(vec3(-0.35,0.8,0.5))));
            float edge=pow(abs(cos(vUv.y*18.85)),24.0);
            float sweep=pow(max(0.0,sin(vP.x*3.0-uTime*2.4)),24.0);
            float fracture=1.0-smoothstep(0.02,0.065,abs(sin(vP.x*16.0+vP.y*26.0+vP.z*19.0)));
            c=toonShade(uColor,.18+lit*.53+rim*.17+sweep*.24);
          #endif
          gl_FragColor=vec4(c,alpha);${output}}`,`uniform float uTime;varying vec2 vUv;varying vec3 vN;varying vec3 vV;varying vec3 vP;
        void main(){vUv=uv;vec3 p=position;vP=p;
          #if VARIANT == 1
            p.yz*=0.88+0.12*sin(uTime*9.0-p.x*5.0);
          #endif
          vec4 mv=modelViewMatrix*vec4(p,1.0);vN=normalMatrix*normal;vV=-mv.xyz;gl_Position=projectionMatrix*mv;}`,{},false);
      body.side=THREE.FrontSide;body.depthWrite=true;body.transparent=false;
      let bodyGeometry=lance(.85,.22,6,2);
      if(variant===2){
        bodyGeometry.dispose();const p=[],n=[],uv=[];
        // 不對稱六面晶簇；每片有獨立切面，不是三片平板。
        for(const [length,radius,x,y,z,tilt,spin] of [[.85,.23,.08,0,0,0,.2],[.65,.15,-.30,.23,.08,-.27,.8],[.49,.13,-.46,-.17,.17,.35,2.0],[.58,.14,-.36,-.03,-.24,.16,4.1],[.30,.10,-.62,.20,-.16,-.5,1.6]]){
          const indexed=lance(length,radius,6,2),g=indexed.toNonIndexed();indexed.dispose();g.rotateX(spin);g.rotateZ(tilt);g.translate(x,y,z);g.computeVertexNormals();
          p.push(...g.attributes.position.array);n.push(...g.attributes.normal.array);uv.push(...g.attributes.uv.array);g.dispose();
        }
        bodyGeometry=new THREE.BufferGeometry();bodyGeometry.setAttribute('position',new THREE.Float32BufferAttribute(p,3));bodyGeometry.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));bodyGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
      }
      const core=mesh(bodyGeometry,body,2);core.position.x=.85;core.name='projectile-core';corePart(core);
      if(variant===2)animated.push(()=>{core.rotation.x=Math.sin(time*.7)*.12;});
      const streamVertex=`uniform float uTime;attribute vec4 aStream;varying vec2 vUv;varying float vPhase;varying float vFace;
        void main(){float h=position.x,t=uTime,phase=aStream.w;vUv=uv;vPhase=phase;
          float a=aStream.x;float radius=aStream.z;float width;vec3 p;
          #if VARIANT == 1
            float tick=floor(t*18.0);a+=h*.65;
            float j=sin(floor(h*13.0)*17.0+tick+phase)*.055*sin(h*PI);
            radius=radius*sin(h*PI)+j;width=.009+sin(h*PI)*.012;
            p=vec3(.85+.65*uSize-h*aStream.y,cos(a)*radius,sin(a)*radius);
          #else
            radius*=sin(h*PI);a+=h*.7+sin(t*.6+phase)*.12;width=.009+sin(h*PI)*.025;
            p=vec3(.85-.3*uSize-h*aStream.y,cos(a)*radius,sin(a)*radius);
          #endif
          float attach=mix(uSize,1.0,smoothstep(0.0,.65,h));p.yz*=attach;
          // 尾端位置固定，只有近彈體的接合範圍隨核心尺寸改變。
          #if VARIANT == 1
            p.x-=.65*(uSize-1.0)*smoothstep(0.0,1.0,h);
          #else
            p.x+=.3*(uSize-1.0)*smoothstep(0.0,1.0,h);
          #endif
          vec3 normal=vec3(0.0,position.y,position.z);p+=normal*width*attach;
          vec4 mv=modelViewMatrix*vec4(p,1.0);vFace=abs(dot(normalize(normalMatrix*normal),normalize(-mv.xyz)));gl_Position=projectionMatrix*mv;}`;
      const streamFragment=`uniform vec3 uColor;uniform float uTime;varying vec2 vUv;varying float vPhase;varying float vFace;${noise}${projectileToon}
        void main(){float h=vUv.x,t=uTime,alpha;vec3 c;
          #if VARIANT == 1
            float packet=pow(max(0.0,sin(h*26.0+t*14.0+vPhase)),10.0);
            alpha=(.18+.75*toonStep(.35,packet))*sin(h*PI);c=toonShade(uColor,.50+packet*.35);
          #else
            float frost=noise2(vec2(h*19.0+t*1.8,vUv.y*7.0+vPhase));
            alpha=pow(1.0-h,1.5)*smoothstep(0.0,.14,h)*(.12+.18*toonStep(.5,frost));c=toonShade(uColor,.53);
          #endif
          gl_FragColor=vec4(c,alpha*uDetail);${output}}`;
      const streamMaterial=shader(streamFragment,`${noise}${streamVertex}`,{},false);
      const paths=variant===1?[[.1,3.0,.26,.3],[1.5,2.65,.38,1.7],[2.8,3.4,.21,3.2],[4.2,2.8,.34,4.6],[5.4,3.15,.25,5.8]]:[[.5,2.6,.34,.3],[2.7,2.0,.40,1.7],[4.8,2.35,.28,3.2]];
      const trails=mesh(streams(paths,24,5),streamMaterial,3);trails.name='projectile-trails';

      if(variant===1){
        // 短促分岔電弧沿尖鋒排列；固定包覆彈體，沒有環狀束環。
        const arcMaterial=shader(`uniform vec3 uColor;uniform float uTime;varying vec2 vUv;varying float vPhase;${noise}${projectileToon}
          void main(){float cut=noise2(vec2(floor(vUv.x*9.0),floor(uTime*16.0)+vPhase));float flash=.35+.65*step(.36,cut);float a=sin(vUv.x*PI)*flash;gl_FragColor=vec4(toonShade(uColor,.74),a*uDetail);${output}}`,`${noise}uniform float uTime;attribute vec4 aStream;varying vec2 vUv;varying float vPhase;
          void main(){vUv=uv;vPhase=aStream.w;float h=position.x;float tick=floor(uTime*16.0);float a=aStream.x;
            float jitter=sin(floor(h*10.0)*18.0+tick+aStream.w)*.08;float r=sin(h*PI)*(aStream.z+jitter);
            vec3 p=vec3(.72-h*aStream.y,cos(a)*r,sin(a)*r);p.yz+=position.yz*.012;
            gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}`,{},false);
        const arcs=mesh(streams([[.4,1.5,.38,.1],[1.8,1.2,.46,1.2],[3.2,1.6,.39,2.7],[4.7,1.35,.42,4.1],[.7,.8,.52,5.3],[3.6,.9,.54,6.9]],20,3),arcMaterial,4);arcs.position.x=.85;arcs.name='projectile-envelope';corePart(arcs);
      }
    }else{
      // 固定配置六枚容量；數量只改顯示與軌道分布，晶核和尾帶成對同步。
      const pos=[],norm=[],orbit=[];
      for(let i=0;i<6;i++){const g=new THREE.OctahedronGeometry(0.13);for(let k=0;k<g.attributes.position.count;k++){pos.push(...g.attributes.position.array.slice(k*3,k*3+3));norm.push(...g.attributes.normal.array.slice(k*3,k*3+3));orbit.push(i);}g.dispose();}
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(norm,3));g.setAttribute('aOrbit',new THREE.Float32BufferAttribute(orbit,1));g.setAttribute('aUnit',new THREE.Float32BufferAttribute(orbit,1));
      const gem=shader(`uniform vec3 uColor;varying vec3 vN;varying float vQuantityFade;${projectileToon}void main(){if(vQuantityFade<.5)discard;float l=abs(dot(normalize(vN),normalize(vec3(-0.5,0.8,0.4))));gl_FragColor=vec4(toonShade(uColor,.2+l*.75),1.0);${output}}`,`uniform float uTime,uQuantity,uSpread;attribute float aOrbit;varying vec3 vN;varying float vQuantityFade;
        void main(){vQuantityFade=step(aOrbit,uQuantity-.5);float a=aOrbit*(uQuantity==3.0?2.094395:6.283185307/uQuantity)-uTime*3.0;vec3 p=position*vec3(1.4,0.6,0.6);p+=vec3(sin(a*2.0)*0.09,cos(a)*0.26*uSpread,sin(a)*0.26*uSpread);vN=normalMatrix*normal;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}`,{},false);
      const gems=mesh(g,gem,3);gems.name='arcane-missile-cores';gems.position.x=0.85;corePart(gems);
      const p=[],uv=[],indices=[];
      for(let arm=0;arm<6;arm++){const start=p.length/3;for(let j=0;j<=64;j++)for(let side=0;side<2;side++){p.push(j/64,arm,side*2-1);uv.push(j/64,side);}for(let j=0;j<64;j++){const i=start+j*2;indices.push(i,i+1,i+2,i+1,i+3,i+2);}}
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setAttribute('aUnit',new THREE.Float32BufferAttribute(p.filter((_,i)=>i%3===1),1));geo.setIndex(indices);
      const spiral=shader(`uniform vec3 uColor;uniform float uTime;varying vec2 vUv;varying float vQuantityFade;${projectileToon}void main(){if(vQuantityFade<.5)discard;float edge=abs(vUv.y*2.0-1.0);float a=(1.0-toonStep(.78,edge))*pow(1.0-vUv.x,1.2);float rune=pow(max(0.0,cos(vUv.x*44.0+uTime*5.0)),10.0);float packet=0.32+0.55*rune+0.13*sin(vUv.x*32.0+uTime*6.0);gl_FragColor=vec4(toonShade(uColor,.45+packet*.4),a*(.5+.5*toonStep(.55,packet))*uDetail);${output}}`,`uniform float uTime,uQuantity,uSpread;varying vec2 vUv;varying float vQuantityFade;
        void main(){vUv=uv;vQuantityFade=step(position.y,uQuantity-.5);float h=position.x,a=position.y*(uQuantity==3.0?2.094395:6.283185307/uQuantity)-uTime*3.0+h*12.0;float r=(0.26*mix(uSize,1.0,smoothstep(0.0,0.35,h))+h*0.16)*uSpread;vec3 p=vec3(0.85-h*3.5,cos(a)*r,sin(a)*r);vec4 mv=modelViewMatrix*vec4(p,1.0);mv.y+=position.z*(0.02+(1.0-h)*0.045)*length(modelMatrix[1].xyz);gl_Position=projectionMatrix*mv;}`,{},false);
      mesh(geo,spiral,2).name='arcane-missile-trails';
    }
  }
  if(kind===1){
    flare(-2.4,variant===2?2.1:variant===3?1.8:1.0,0);flare(2.4,variant===2?2.6:variant===3?2.5:1.4,1);
    // Core and halo share one ribbon and one draw call. Forks carry their own envelope.
    const arcFragment=`varying vec2 vUv;varying float vArcFade;uniform vec3 uColor;
      void main(){float edge=abs(vUv.y*2.0-1.0),core=exp(-edge*edge*130.0),sheath=exp(-edge*edge*26.0),halo=exp(-edge*edge*5.0);
        float alpha=(core+sheath*.5+halo*.23)*(1.0-smoothstep(.75,1.0,edge))*vArcFade;
        gl_FragColor=vec4(uColor*(.9+sheath*.65)+vec3(core*1.8),alpha);${output}}`;
    function arcGeometry(units,segments,forks=0){
      const p=[],uv=[],unit=[],role=[],idx=[];
      // Draw faint branches first so their translucent halos cannot cover the hero core.
      for(let id=units-1;id>=0;id--)for(let branch=forks;branch>=0;branch--){
        const first=p.length/3,steps=branch?24:segments;
        for(let j=0;j<=steps;j++)for(let side=0;side<2;side++){p.push(j/steps,id,side*2-1);uv.push(j/steps,side);unit.push(id);role.push(branch);}
        for(let j=0;j<steps;j++){const n=first+j*2;idx.push(n,n+1,n+2,n+1,n+3,n+2);}
      }
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('aUnit',new THREE.Float32BufferAttribute(unit,1));g.setAttribute('aRole',new THREE.Float32BufferAttribute(role,1));g.setIndex(idx);return g;
    }
    if(variant<2){
      const body=shader(`varying vec2 vUv;varying vec3 vN;varying vec3 vV;uniform float uTime,uQuantity;uniform vec3 uColor;${noise}
        void main(){float v=vUv.y,t=uTime;float alpha=0.6;vec3 c=uColor*1.2;
        #if VARIANT == 0
          float filament=pow(max(0.0,cos(vUv.x*PI*8.0-v*31.0+t*8.0)),20.0);
          float facing=abs(dot(normalize(vN),normalize(vV)));alpha=0.48+filament*0.35;c+=vec3(0.35)+uColor*filament*0.6+vec3(pow(facing,6.0)*0.3);
        #elif VARIANT == 1
          float packet=pow(max(0.0,cos(uQuantity==4.0?v*PI*8.0-t*8.0:v*6.283185307*uQuantity-t*8.0*(uQuantity/4.0))),12.0);float fins=pow(abs(cos(vUv.x*PI*4.0)),6.0);alpha=0.035+packet*(0.55+fins*0.45);c+=vec3(packet*0.8);
        #endif
        gl_FragColor=vec4(c,alpha);${output}}`, `varying vec2 vUv;varying vec3 vN;varying vec3 vV;uniform float uTime,uQuantity;
        void main(){vUv=uv;vec3 p=position;
        #if VARIANT == 1
          float packet=pow(max(0.0,cos(uQuantity==4.0?uv.y*25.13274-uTime*8.0:uv.y*6.283185307*uQuantity-uTime*8.0*(uQuantity/4.0))),6.0);p.xz*=0.35+packet*0.9;
        #endif
        p.xz*=uSize;vec4 mv=modelViewMatrix*vec4(p,1.0);vN=normalMatrix*normal;vV=-mv.xyz;gl_Position=projectionMatrix*mv;}`);
      const radius=variant===1?0.12:0.045;
      const beam=mesh(new THREE.CylinderGeometry(radius,radius,4.8,12,48,true),body,2);beam.rotation.z=-Math.PI/2;if(variant===1)beam.name='pulse-body';
      if(variant===0){
        const sheath=shader(`varying vec2 vUv;uniform vec3 uColor;uniform float uTime;${noise}
          void main(){float filament=pow(max(0.0,cos(vUv.x*PI*6.0-vUv.y*24.0+uTime*3.0)),24.0);gl_FragColor=vec4(uColor,0.08+filament*0.28);${output}}`);
        const tube=mesh(new THREE.CylinderGeometry(0.13,0.13,4.8,24,64,true),sheath,1);tube.rotation.z=-Math.PI/2;corePart(tube,'xz');
      }else{
        const ringMaterial=shader(`varying float vFade;uniform vec3 uColor;void main(){gl_FragColor=vec4(uColor*1.7,vFade*uDetail);${output}}`, `attribute vec4 seed;uniform float uTime;uniform float uStretch;varying float vFade;
          void main(){float life=fract(seed.x+uTime*0.38);vec3 p=vec3(position.z,position.y,position.x);float x;
            x=-2.4+life*4.8;p.yz*=uSize*(0.7+sin(life*3.14159)*0.6);vFade=sin(life*3.14159)*0.85;
          p.x/=uStretch;p.x+=x;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}`);
        instanced(new THREE.TorusGeometry(0.26,0.012,5,32),12,0.025,ringMaterial,3);
      }
    }else if(variant===3){
      const lightning=shader(arcFragment,`varying vec2 vUv;varying float vArcFade;attribute float aRole;uniform float uTime,uQuantity,uStretch;${noise}
        float jag(float h,float cells,float seed){float x=h*cells,k=floor(x);return mix(hash(vec2(k,seed)),hash(vec2(k+1.0,seed)),fract(x))*2.0-1.0;}
        vec3 current(float h,float id){float f=floor(uTime*18.0)+id*31.0,env=sin(h*PI);
          vec2 bend=vec2(jag(h,8.0,f),jag(h,7.0,f+23.0))*(id<.5?.40:.48);
          bend+=vec2(jag(h,72.0,f+71.0),jag(h,68.0,f+121.0))*.075;
          return vec3(h*4.8-2.4,bend*env*uSize);}
        vec3 point(float h,float id,float role){if(role<.5)return current(h,id);
          float root=.16+(role-1.0)*.26+hash(vec2(id,role))*.08,angle=id*2.4+role*2.1;
          vec3 p=current(root,id);float f=floor(uTime*15.0)+id*17.0+role*9.0;
          p+=vec3(h*(.45+hash(vec2(id,role+9.0))*.45)/uStretch,cos(angle)*h*.62,sin(angle)*h*.62)*uSize;
          p.yz+=vec2(jag(h,14.0,f),jag(h,17.0,f+7.0))*sin(h*PI)*.10*uSize;return p;}
        void main(){vUv=uv;float h=position.x,id=position.y,role=aRole;
          float gate=step(id,uQuantity-.5),spark=.3+.7*step(.32,hash(vec2(floor(uTime*13.0),id*7.0+role*11.0)));
          vArcFade=gate*(role<.5?(id<.5?1.0:.48):spark*.55)*(role<.5?1.0:1.0-smoothstep(.65,1.0,h));
          float width=(role<.5?(id<.5?.34:.080):.065*(1.0-h*.82))*uSize;
          vec4 mv=modelViewMatrix*vec4(point(h,id,role),1.0);
          vec4 ahead=modelViewMatrix*vec4(point(min(1.0,h+.035),id,role),1.0),behind=modelViewMatrix*vec4(point(max(0.0,h-.035),id,role),1.0);
          vec2 tangent=ahead.xy-behind.xy;float len=length(tangent);vec2 normal=len>.00001?vec2(-tangent.y,tangent.x)/len:vec2(0.0,1.0);
          mv.xy+=normal*position.z*width*length(modelMatrix[1].xyz);gl_Position=projectionMatrix*mv;}`,{},false);
      mesh(arcGeometry(12,96,3),lightning,3).name='arc-ray-branches';
    }
    if(variant===2){
      // 只在啟動時蓄力；完成後持續輸出，reset 才重新蓄力。
      const pos=[],uvs=[],idx=[];
      for(let blade=0;blade<5;blade++){
        const start=pos.length/3;
        for(let j=0;j<=64;j++)for(let side=0;side<2;side++){pos.push(j/64,side*2-1,blade);uvs.push(j/64,side);}
        for(let j=0;j<64;j++){const i=start+j*2;idx.push(i,i+1,i+2,i+1,i+3,i+2);}
      }
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(idx);
      const lance=shader(`uniform vec3 uColor;uniform float uTime;varying vec2 vUv;varying float vBlade;${noise}
        void main(){float phase=uTime,h=vUv.x,edge=abs(vUv.y*2.0-1.0);float release=smoothstep(1.52,1.60,phase);
          float head=clamp((phase-1.52)*10.0,0.0,1.08);float gate=1.0-smoothstep(head-0.035,head,h);
          float fiber=0.6+0.4*noise2(vec2(h*24.0-uTime*25.0,edge*5.0+vBlade));float core=exp(-edge*edge*24.0);
          float a=(1.0-smoothstep(0.55,1.0,edge))*fiber*release*gate;
          if(vBlade<0.5)a=max(a,exp(-edge*edge*90.0)*0.09);
          gl_FragColor=vec4(uColor*(1.5+core*0.5)+vec3(core*0.65),a*(vBlade<0.5?0.95:0.5));${output}}`,`uniform float uTime;varying vec2 vUv;varying float vBlade;
        void main(){vUv=uv;float h=position.x,id=position.z;vBlade=id;float phase=uTime;float release=smoothstep(1.52,1.60,phase);
          float a=id*1.256637+uTime*0.25;float profile=pow(max(0.0,sin(h*3.14159)),0.55);float diamonds=pow(abs(sin(h*12.56637-phase*3.0)),3.0);
          float width=(id<0.5?0.035:0.05+profile*(0.12+diamonds*0.14))*uSize;
          if(id>0.5)width*=release;float bend=sin(h*15.0-id+uTime*9.0)*0.035*profile*release*uSize;
          vec3 p=vec3(h*4.8-2.4,cos(a)*(position.y*width+bend),sin(a)*(position.y*width+bend));gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}`);
      mesh(g,lance,3);
      const charge=shader(`uniform vec3 uColor;uniform float uTime;varying vec2 vUv;varying float vFade;void main(){float edge=abs(vUv.y*2.0-1.0);float core=exp(-edge*edge*16.0);gl_FragColor=vec4(uColor*1.8+vec3(core*0.35),core*vFade*uDetail);${output}}`,`attribute vec4 seed;uniform float uTime;uniform float uStretch;varying vec2 vUv;varying float vFade;
        void main(){vUv=uv;float phase=uTime,h=uv.x;float charge=min(phase/1.52,1.0);float a=seed.x*6.28318-h*2.6-uTime*2.1;
          float r=(1.0-h)*(0.35+charge*0.65);vec3 p=vec3(-2.4-(1.0-h)*(0.3+seed.y*0.55)/uStretch,cos(a)*r*uSize,sin(a)*r*uSize);
          p.yz+=vec2(cos(a),sin(a))*position.y*0.028*uSize;
          vFade=sin(h*3.14159)*(0.15+charge*0.8)*(1.0-smoothstep(1.55,1.75,phase)*0.40);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}`);
      instanced(new THREE.PlaneGeometry(1,1,32,1),7,0.016,charge,3);
    }
    for(const end of [-1,1]){
      if(variant===3){
        const corona=shader(arcFragment,`varying vec2 vUv;varying float vArcFade;uniform float uTime,uEnd,uStretch;${noise}
          vec3 point(float h,float id){float frame=floor(uTime*15.0+id*.3),angle=id*2.39996+uEnd*.7;
            float reach=(uEnd<0.0?.62:1.05)*(.55+hash(vec2(id,uEnd))* .6)*uSize;
            float cell=h*18.0,k=floor(cell),j=mix(hash(vec2(k,frame+id*13.0)),hash(vec2(k+1.0,frame+id*13.0)),fract(cell))-.5;
            float r=h*reach;return vec3(uEnd*2.4+(sin(id*4.7)*r*.38+j*.10*uSize*sin(h*PI))/uStretch,cos(angle)*r+j*.16*uSize*sin(h*PI),sin(angle)*r+j*.13*uSize*sin(h*PI));}
          void main(){vUv=uv;float h=position.x,id=position.y;
            float pulse=.2+.8*step(.38,hash(vec2(floor(uTime*12.0+id*.3),id+uEnd*12.0)));
            vArcFade=pulse*(1.0-smoothstep(.55,1.0,h));
            vec4 mv=modelViewMatrix*vec4(point(h,id),1.0),a=modelViewMatrix*vec4(point(min(1.0,h+.04),id),1.0),b=modelViewMatrix*vec4(point(max(0.0,h-.04),id),1.0);
            vec2 d=a.xy-b.xy;float len=length(d);vec2 n=len>.00001?vec2(-d.y,d.x)/len:vec2(0.0,1.0);
            mv.xy+=n*position.z*(.115*(1.0-h*.85))*uSize*length(modelMatrix[1].xyz);gl_Position=projectionMatrix*mv;}`,{uEnd:{value:end}},false);
        mesh(arcGeometry(9,24),corona,2).name=end<0?'arc-source-corona':'arc-impact-corona';
        continue;
      }
      const ringMaterial=shader(`uniform vec3 uColor;uniform float uTime;uniform float uEnd;varying vec2 vUv;${noise}
        void main(){vec2 p=vUv*2.0-1.0;float r=length(p),a=atan(p.y,p.x);float alpha;
        #if VARIANT == 0
          alpha=band(r-0.58,0.018)+band(r-0.76,0.008)*step(0.65,sin(a*8.0-uTime));
        #elif VARIANT == 1
          float wave=fract(uTime*1.2);alpha=band(r-wave*0.92,0.024)*(1.0-wave)+band(r-0.3,0.018);
        #elif VARIANT == 2
          float phase=uTime,charge=min(phase/1.52,1.0),release=smoothstep(1.61,1.65,phase);
          if(uEnd<0.0){float iris=pow(max(0.0,cos(a*5.0-r*6.0-uTime*2.5)),10.0);alpha=(band(r-0.48,0.016)+iris*band(r-0.64,0.09))*charge+exp(-r*r*18.0)*(0.1+charge*0.6);}
          else{float pulse=fract(max(0.0,phase-1.62)*1.7);alpha=(band(r-0.48,0.02)*0.65+band(r-pulse*0.94,0.035)*(1.0-pulse)+pow(max(0.0,cos(a*9.0+uTime*5.0)),12.0)*exp(-r*4.0))*release;}
        #else
          float n=noise2(vec2(a*12.0,floor(uTime*16.0)));alpha=band(r-0.55-n*0.18,0.018)+pow(max(0.0,sin(a*11.0+uTime*5.0)),32.0)*exp(-r*2.0)*0.5;
        #endif
        gl_FragColor=vec4(uColor*1.4,alpha*0.8*uDetail);${output}}`,surfaceVertex,{uEnd:{value:end}});
      const disc=mesh(new THREE.PlaneGeometry(end<0?1.0:1.3,end<0?1.0:1.3),ringMaterial,2);disc.rotation.y=Math.PI/2;disc.position.x=end*2.4;
    }
  }
  if(kind===2){
    const sigil=shader(`
      uniform vec3 uColor;uniform float uTime;varying vec2 vUv;${noise}
      float segment(vec2 p,vec2 a,vec2 b){vec2 d=b-a;return length(p-a-d*clamp(dot(p-a,d)/dot(d,d),0.0,1.0));}
      float ink(float d,float w){return band(d,w)+exp(-abs(d)*120.0)*0.12;}
      float polygon(vec2 p,float sides,float radius,float rotation){float a=atan(p.y,p.x)+rotation;float sector=2.0*PI/sides;return cos(floor(0.5+a/sector)*sector-a)*length(p)-radius;}
      void main(){
        vec2 p=(vUv-0.5)*2.0;float r=length(p),a=atan(p.y,p.x),t=uTime;
        if(r>0.99)discard;
        float inkSum=ink(r-0.94,0.003)+ink(r-0.9,0.0018)+ink(r-0.74,0.003);
        float spin=a-t*0.09;
        float cells=(spin+PI)/6.28318*36.0;
        vec2 q=vec2((fract(cells)-0.5)*1.8,(r-0.821)*16.0);
        float id=floor(cells);
        float rune=segment(q,vec2(-0.22,-0.42),vec2(-0.22,0.42));
        rune=min(rune,segment(q,vec2(-0.22,0.31),vec2(0.27,0.10+mod(id,3.0)*0.10)));
        rune=min(rune,segment(q,vec2(-0.22,-0.15),vec2(0.28,-0.35)));
        if(mod(id,2.0)<1.0)rune=min(rune,segment(q,vec2(0.25,-0.35),vec2(0.25,0.34)));
        inkSum+=ink(rune,0.035)*step(0.77,r)*(1.0-step(0.875,r));
        float outerTicks=pow(abs(sin(a*48.0+t*0.12)),32.0)*band(r-0.968,0.012);
        inkSum+=outerTicks*0.7;
        #if VARIANT == 0
          // 花瓣與四向治療十字。
          float petals=0.35+0.16*cos(a*8.0+t*0.12);
          inkSum+=ink(r-petals,0.004)+ink(r-0.6,0.002);
          inkSum+=ink(r-0.17,0.004);
          inkSum+=ink(segment(p,vec2(-0.12,0),vec2(0.12,0)),0.022);
          inkSum+=ink(segment(p,vec2(0,-0.12),vec2(0,0.12)),0.022);
          float ang=floor((a+PI/4.0)/(PI/2.0))*PI/2.0;
          vec2 c=vec2(cos(ang),sin(ang))*0.65;
          vec2 d=p-c;
          inkSum+=ink(segment(d,vec2(-0.035,0),vec2(0.035,0)),0.009)+ink(segment(d,vec2(0,-0.035),vec2(0,0.035)),0.009);
        #elif VARIANT == 1
          // 五向炎輪：長短分明的火刃，避免交疊三角形造成雜亂。
          float sector=2.0*PI/5.0;float angle=mod(a-t*0.055+sector*0.5,sector)-sector*0.5;
          vec2 f=vec2(cos(angle),sin(angle))*r;
          float curve=0.12*sin((f.x-0.18)*7.0);
          float blade=ink(f.y-curve,0.008)*smoothstep(0.14,0.24,f.x)*(1.0-smoothstep(0.54,0.65,f.x));
          float echo=ink(f.y+0.055-curve*0.6,0.003)*smoothstep(0.23,0.32,f.x)*(1.0-smoothstep(0.48,0.60,f.x));
          inkSum+=blade+echo;
          inkSum+=ink(r-0.115,0.005)+ink(polygon(p,5.0,0.075,t*0.055),0.007);
          inkSum+=ink(r-0.67,0.003)*step(0.05,cos(a*5.0-t*0.275));
          inkSum+=ink(polygon(p,5.0,0.60,t*0.055),0.0015)*0.6;
        #elif VARIANT == 2
          // 六角冰晶主幹、分枝與雙層六角結界。
          inkSum+=ink(polygon(p,6.0,0.64,0.0),0.004)+ink(polygon(p,6.0,0.53,PI/6.0),0.002);
          float sector=PI/3.0;float local=mod(a+sector*0.5,sector)-sector*0.5;
          vec2 f=vec2(cos(local),sin(local))*r;
          inkSum+=ink(segment(f,vec2(0.08,0),vec2(0.63,0)),0.005);
          inkSum+=ink(segment(f,vec2(0.30,0),vec2(0.42,0.13)),0.004)+ink(segment(f,vec2(0.30,0),vec2(0.42,-0.13)),0.004);
          inkSum+=ink(segment(f,vec2(0.46,0),vec2(0.55,0.09)),0.003)+ink(segment(f,vec2(0.46,0),vec2(0.55,-0.09)),0.003);
          inkSum+=ink(polygon(p,6.0,0.10,0.0),0.008);
        #else
          // 交錯方印、八角邊界與斷續防禦刻度。
          inkSum+=ink(polygon(p,4.0,0.40,t*0.08),0.004)+ink(polygon(p,4.0,0.40,PI/4.0+t*0.08),0.004);
          inkSum+=ink(polygon(p,8.0,0.65,0.0),0.004)+ink(polygon(p,4.0,0.13,-t*0.15),0.01);
          inkSum+=band(r-0.69,0.012)*step(0.1,sin(a*16.0-t*0.3));
        #endif
        float pulse=0.85+sin(t*1.2)*0.15;float accent=0.0;
        #if VARIANT == 0
          float growth=fract(t*0.26);accent=exp(-pow((r-growth)*22.0,2.0))*sin(growth*PI);pulse=0.68+0.24*pow(0.5+0.5*sin(t*1.5),2.0);
        #elif VARIANT == 1
          float sectorHeat=0.5+0.5*sin(a*5.0-t*2.0);accent=sectorHeat*noise2(p*9.0-t*0.7);pulse=0.72+accent*0.3;
        #elif VARIANT == 2
          float freeze=fract(t*0.14);accent=exp(-pow((r-freeze)*30.0,2.0))*sin(freeze*PI);pulse=0.82;
        #else
          accent=pow(max(0.0,cos(a*4.0-t*1.2-r*5.0)),16.0);pulse=0.76;
        #endif
        float alpha=min(inkSum*(0.72+accent*0.65),1.0)*pulse;
        gl_FragColor=vec4(uColor*1.4+vec3(0.04),alpha*uDetail);${output}
      }`);
    const circle=mesh(new THREE.PlaneGeometry(4.5,4.5),sigil,1);circle.rotation.x=-Math.PI/2;circle.position.y=0.025;corePart(circle);
    const aura=shader(`
      uniform vec3 uColor;uniform float uTime;varying vec2 vUv;${noise}
      void main(){vec2 p=vUv*2.0-1.0;float r=length(p),t=uTime;float a=0.0;vec3 c=uColor;
        #if VARIANT == 0
          float wave=fract(t*0.26);a=exp(-r*r*5.0)*0.035+exp(-pow((r-wave)*18.0,2.0))*sin(wave*PI)*0.12;
        #elif VARIANT == 1
          float n=noise2(p*7.0+vec2(t*0.3,-t*0.4));float vein=pow(1.0-abs(sin(p.x*19.0+p.y*11.0+n*7.0)),7.0);a=(0.025+vein*0.15)*(1.0-smoothstep(0.2,0.87,r));c=uColor*(0.6+n*0.8);
        #elif VARIANT == 2
          float crystal=pow(abs(cos(atan(p.y,p.x)*3.0)),18.0);a=(crystal*0.06+noise2(p*18.0)*0.025)*(1.0-smoothstep(0.4,0.9,r));
        #else
          a=band(r-0.78,0.014)*(0.08+0.07*sin(t*2.0))+exp(-r*r*5.0)*0.025;
        #endif
        gl_FragColor=vec4(c,a*uDetail);${output}}
    `);
    const ground=mesh(new THREE.PlaneGeometry(4.8,4.8),aura,0);ground.rotation.x=-Math.PI/2;ground.position.y=0.015;
    if(variant===3){
      const shield=shader(`
        uniform vec3 uColor;uniform float uTime;varying vec2 vUv;${noise}
        void main(){
          vec2 grid=vec2(vUv.x*24.0,vUv.y*12.0);grid.x+=mod(floor(grid.y),2.0)*0.5;vec2 cell=abs(fract(grid)-0.5);
          float tile=band(max(cell.x*0.866+cell.y*0.5,cell.y)-0.44,0.018);
          float latitude=sin(vUv.y*PI*0.5);float scan=exp(-pow((vUv.y-fract(uTime*0.17))*20.0,2.0));
          float alpha=(tile*(0.11+scan*0.22)+scan*0.04)*latitude;
          gl_FragColor=vec4(uColor*(1.0+scan*0.6),alpha*uDetail);${output}}
      `);
      corePart(mesh(new THREE.SphereGeometry(1.85,40,20,0,Math.PI*2,0,Math.PI/2),shield,2));
    }
  }
  if(kind===3){
    // 向上膨脹的雲冠、短促噴流與壓力波構成爆炸主體。
    if(variant===0){
      const fire=shader(`varying vec2 vUv;varying float vSeed;uniform vec3 uColor;uniform float uTime;${noise}${flame}
        void main(){vec2 p=vUv*2.0-1.0;float t=uTime;float angle=vSeed*6.28+t*0.45;p=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*p;
          float n=fbm(p*3.2+vec2(vSeed*17.0,-t*1.0));float fine=noise2(p*9.0+n*3.0);float d=length(p)+(n-0.5)*0.28;
          float body=smoothstep(0.18,0.70,n+(1.0-d)*0.35);float heat=max(0.0,1.0-t*0.7);
          vec2 fireUv=vec2(vUv.x+sin(vUv.y*8.0-t*4.0)*0.055,vUv.y*vUv.y);
          vec3 burn=flameErosion(fireUv,t*1.3,vSeed*7.0);
          vec3 ember=flameColor(uColor,clamp(n*0.65+burn.y*0.5,0.0,1.0))*mix(0.7,1.1,fine);
          vec3 color=mix(vec3(0.045,0.035,0.028),ember,smoothstep(0.0,0.6,heat));
          float alpha=(1.0-smoothstep(0.45,1.0,d))*body*smoothstep(0.0,0.08,t)*(1.0-smoothstep(0.8,2.0,t));
          alpha*=mix(1.0,0.35+burn.x*0.65,heat);
          #if TOON == 1
            color=mix(styleColor(uColor*.23,.2+n*.65),styleHeat(uColor,.12+n*.33+(1.0-d)*.38+burn.y*.18-p.y*.08),smoothstep(.0,.6,heat));
            alpha=(1.0-smoothstep(.72,.94,d))*smoothstep(.24,.42,n+(1.0-d)*.35)*smoothstep(.0,.08,t)*(1.0-smoothstep(.8,2.0,t));
          #endif
          gl_FragColor=vec4(color,alpha*(TOON==1?.68:.85));${output}}`, `attribute vec4 seed;uniform float uTime;varying vec2 vUv;varying float vSeed;
        void main(){vUv=uv;vSeed=seed.w;float t=uTime,rise=1.0-exp(-t*6.0),a=seed.x*6.28318;
          vec3 p=vec3(cos(a)*rise*(0.15+seed.y*0.65),rise*(0.4+seed.y*1.5)+t*0.2,sin(a)*rise*(0.15+seed.y*0.65))*uSize;p.y-=1.35;
          vec4 mv=modelViewMatrix*vec4(p,1.0);mv.xy+=position.xy*(0.3+rise*1.5)*(0.8+seed.z*0.4)*uSize*length(modelMatrix[1].xyz);gl_Position=projectionMatrix*mv;}`,{},false);
      instanced(new THREE.PlaneGeometry(1,1),12,0.025,fire,1);
    }
    if(variant===1){
      if(toon){
        // 每條主放電連同兩個分岔一起增減；裝飾密度不影響主電弧。
        const positions=[],uvs=[],units=[],roles=[],indices=[];
        for(let branch=71;branch>=0;branch--){
          const role=Math.floor((branch%36)/12),unit=branch%12+(branch>=36?12:0);
          const steps=role===0?64:16,start=positions.length/3;
          for(let j=0;j<steps;j++){const i=start+j*4;for(const [u,v]of [[0,0],[1,0],[0,1],[1,1]]){positions.push(j/steps,(j+1)/steps,branch);uvs.push(u,v);units.push(unit);roles.push(role);}indices.push(i,i+1,i+2,i+2,i+1,i+3);}
        }
        const arcs=new THREE.BufferGeometry();arcs.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));arcs.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));arcs.setAttribute('aUnit',new THREE.Float32BufferAttribute(units,1));arcs.setAttribute('aRole',new THREE.Float32BufferAttribute(roles,1));arcs.setIndex(indices);
        const electric=shader(
          `uniform vec3 uColor;varying vec2 vStroke;varying float vHalfLength;varying float vFade;
          void main(){float edge=length(vec2(max(0.0,abs(vStroke.x)-vHalfLength),vStroke.y)),core=exp(-edge*edge*180.0),sheath=exp(-edge*edge*40.0),halo=exp(-edge*edge*6.0);
            vec3 cyan=pow(uColor,vec3(.55))*vec3(.65,1.4,1.0),c=mix(uColor,cyan,sheath)+vec3(core*1.5);
            float alpha=(core+sheath*.65+halo*.18)*(1.0-smoothstep(.8,1.0,edge))*vFade;
            gl_FragColor=vec4(c,alpha);${output}gl_FragColor.rgb*=min(1.0,gl_FragColor.a);gl_FragColor.a=min(1.0,gl_FragColor.a)*.6;}`, 
          `uniform float uTime,uQuantity;attribute float aUnit,aRole;varying vec2 vStroke;varying float vHalfLength;varying float vFade;${noise}
          vec3 direction(float id){float a=id*2.39996;return normalize(vec3(cos(a),.12+pow(hash(vec2(id,3.0)),2.0)*1.5,sin(a)));}
          vec3 pointOnArc(float id,float h){vec3 dir=direction(id);vec3 side=normalize(cross(dir,vec3(0,1,0)));vec3 up=cross(side,dir);
            float cell=h*8.0,i=floor(cell),f=fract(cell),frame=floor(uTime*18.0);
            float j=mix(hash(vec2(id*3.0+frame,i)),hash(vec2(id*3.0+frame,i+1.0)),f)-.5;
            float k=mix(hash(vec2(id*7.0+frame,i+13.0)),hash(vec2(id*7.0+frame,i+14.0)),f)-.5;
            float fine=h*64.0,fi=floor(fine);float micro=(mix(hash(vec2(id+frame,fi)),hash(vec2(id+frame,fi+1.0)),fract(fine))-.5)*.04;
            return dir*h*(2.4+hash(vec2(id,9.0))*1.25)+(side*(j*.65+micro)+up*k*.40)*sin(h*PI*.9)+vec3(0,sin(h*PI)*(.25+hash(vec2(id,12.0))*.55),0);}
          float pulse(float t,float start,float end){return smoothstep(start,start+.035,t)*(1.0-smoothstep(end-.06,end,t));}
          vec3 branchPoint(float id,float branch,float role,float h,float growth){
            if(role<.5)return pointOnArc(id,h*growth);
            float fork=role<1.5?.3125:.625,offset=role<1.5?1.0:-1.0;vec3 dir=direction(id),side=normalize(cross(dir,vec3(0,1,0))),split=normalize(dir*.5+side*offset*.85+vec3(0,.28,0));
            float child=clamp((growth-fork)/(1.0-fork),0.0,1.0),lengthBranch=.5+hash(vec2(branch,7.0))*.85,cell=h*13.0,i=floor(cell),frame=floor(uTime*15.0)+branch;
            float jag=mix(hash(vec2(frame,i)),hash(vec2(frame,i+1.0)),fract(cell))-.5;
            return pointOnArc(id,fork*growth)+split*h*lengthBranch*child+side*jag*.22*sin(h*PI)*child;
          }
          void main(){float branch=position.z,id=aUnit,h=(position.x+position.y)*.5,t=uTime;
            float delay=.035+hash(vec2(id,5.0))*.085;float growth=clamp((t-delay)*6.5,0.0,1.0);
            vec3 p0=branchPoint(id,branch,aRole,position.x,growth),p1=branchPoint(id,branch,aRole,position.y,growth);float width=.17+hash(vec2(id,2.0))*.08;
            if(aRole>.5)width*=.48*(1.0-h*.75);
            float main=pulse(t,delay,.58+hash(vec2(id,4.0))*.22);
            float echo=pulse(t,.78+hash(vec2(id,8.0))*.27,.93+hash(vec2(id,8.0))*.27)*.8;
            echo+=pulse(t,1.28+hash(vec2(id,6.0))*.34,1.41+hash(vec2(id,6.0))*.34)*.6;
            echo+=pulse(t,1.85+hash(vec2(id,11.0))*.12,1.97+hash(vec2(id,11.0))*.12)*step(.72,hash(vec2(id,12.0)))*.4;
            float flicker=aRole<.5?1.0:.45+.45*hash(vec2(branch,floor(t*(14.0+aRole*3.0))));
            vFade=max(main,echo)*growth*step(aUnit,uQuantity-.5)*flicker*min(1.0,sqrt(12.0/uQuantity));width*=1.0-smoothstep(.88,1.0,h)*.78;
            p0*=uSize;p0.y-=1.20;p1*=uSize;p1.y-=1.20;vec4 m0=modelViewMatrix*vec4(p0,1),m1=modelViewMatrix*vec4(p1,1);vec2 delta=m1.xy-m0.xy;float len=length(delta);vec2 along=len<.0001?vec2(1,0):delta/len;
            width*=uSize*length(modelMatrix[1].xyz);vec4 mv=mix(m0,m1,uv.x);mv.xy+=(along*(uv.x*2.0-1.0)+vec2(-along.y,along.x)*(uv.y*2.0-1.0))*width;
            vHalfLength=len/max(width,.00001)*.5;vStroke=vec2((uv.x*2.0-1.0)*(vHalfLength+1.0),uv.y*2.0-1.0);
            gl_Position=projectionMatrix*mv;}`,{},false);
        electricBlend(electric);mesh(arcs,electric,2).name='energy-burst-arcs';
        const fragments=shader(
          `uniform vec3 uColor;varying vec2 vUv;varying float vFade;
          void main(){vec2 q=vUv*2.0-1.0;float core=exp(-q.y*q.y*90.0),halo=exp(-q.y*q.y*8.0),tip=1.0-smoothstep(.2,1.0,abs(q.x));
            gl_FragColor=vec4(uColor*1.3+vec3(core*1.8),(core+halo*.25)*tip*vFade*uDetail);${output}}`,
          `attribute vec4 seed;uniform float uTime;varying vec2 vUv;varying float vFade;${noise}
          void main(){vUv=uv;float t=uTime,a=seed.x*PI*2.0,dt=max(0.0,t-.09-seed.w*.09);vec3 dir=normalize(vec3(cos(a),.4+seed.y*1.8,sin(a)));
            vec3 p=dir*(.35+(1.0-exp(-dt*3.0))*(1.2+seed.z*1.8));p*=uSize;p.y-=1.2;
            vec4 mv=modelViewMatrix*vec4(p,1);vec2 along=normalize((modelViewMatrix*vec4(dir,0)).xy+vec2(.0001));vec2 side=vec2(-along.y,along.x);
            float jag=(hash(vec2(seed.w*71.0,floor(uv.x*4.0+.01)))-.5)*sin(uv.x*PI);
            mv.xy+=(along*position.x*(.22+seed.z*.45)+side*(jag*.05+position.y*.16))*uSize*length(modelMatrix[1].xyz);
            vFade=smoothstep(.0,.07,dt)*(1.0-smoothstep(.28+seed.z*.15,.65+seed.z*.3,dt));gl_Position=projectionMatrix*mv;}`,{},false);
        instanced(new THREE.PlaneGeometry(1,1,4,1),36,.06,fragments,3);
      }else{
      // 不使用半球或圓柱：不等長的折線鋒芒從中心向上撕裂。
      const pos=[],uvs=[],idx=[];
      for(let ray=0;ray<18;ray++){
        const start=pos.length/3;
        for(let j=0;j<=24;j++)for(let side=0;side<2;side++){pos.push(j/24,side*2-1,ray);uvs.push(j/24,side);}
        for(let j=0;j<24;j++){const i=start+j*2;idx.push(i,i+1,i+2,i+1,i+3,i+2);}
      }
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(idx);
      const lances=shader(`uniform vec3 uColor;uniform float uTime;varying vec2 vUv;varying float vFade;varying float vRay;${noise}
        void main(){float edge=abs(vUv.y*2.0-1.0);float core=exp(-edge*edge*28.0);float n=noise2(vec2(vUv.x*21.0,vRay*3.1));
          float erosion=smoothstep(0.08,0.30,n-uTime*0.22+0.25);float front=exp(-pow((vUv.x-fract(uTime*1.6+vRay*0.13))*16.0,2.0));
          float broken=(0.25+0.75*erosion)*(0.6+front*0.7);float alpha=(1.0-smoothstep(0.6,1.0,edge))*vFade*broken;vec3 c=uColor*(1.3+core)+vec3(core*.85);
          #if TOON == 1
            c=styleColor(uColor,.28+core*.55+front*.12);alpha=(1.0-smoothstep(.78,1.0,edge))*vFade*(.35+.65*erosion);
          #endif
          gl_FragColor=vec4(c,alpha);${output}}`,`uniform float uTime;varying vec2 vUv;varying float vFade;varying float vRay;${noise}
        void main(){vUv=uv;float id=position.z;vRay=id;float h=position.x,t=uTime,dt=max(0.0,t-0.04-hash(vec2(id,5.0))*0.055);float a=id*2.39996;
          float growth=1.0-exp(-dt*11.0);float lengthRay=(1.5+hash(vec2(id,7.0))*1.8)*growth;
          float outward=0.3+hash(vec2(id,4.0))*0.9;
          vec3 dir=normalize(vec3(cos(a)*outward,0.65+hash(vec2(id,3.0)),sin(a)*outward));
          float bend=sin(h*PI)*sin(floor(h*8.0)*1.7+id)*0.11;
          vec3 p=dir*(h*lengthRay+max(0.0,t-0.3)*0.55);p.xz+=vec2(-sin(a),cos(a))*bend;
          float width=pow(max(0.0,sin(h*PI)),1.2)*(0.09+hash(vec2(id,1.0))*0.13)*growth;
          p.xz+=vec2(-sin(a),cos(a))*position.y*width;p*=uSize;p.y-=1.20;
          vFade=smoothstep(0.04,0.12,t)*(1.0-smoothstep(0.22+hash(vec2(id,9.0))*0.2,0.85,t));
          gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}`);
      mesh(g,lances,2);
      const fragments=shader(`uniform vec3 uColor;varying float vFade;varying vec2 vUv;void main(){vec2 q=vUv*2.0-1.0;float w=0.045+(1.0-vUv.y)*0.25;float d=abs(q.x+q.y*0.32);float rim=(1.0-smoothstep(0.015,0.07,abs(d-w)))+(1.0-smoothstep(w*0.5,w,d))*0.18;rim*=sin(vUv.y*3.14159);vec3 c=uColor*1.8+vec3(.2);
          #if TOON == 1
            c=styleColor(uColor,.38+vUv.y*.42);rim=smoothstep(.12,.25,rim);
          #endif
          gl_FragColor=vec4(c,rim*vFade*uDetail);${output}}`,`attribute vec4 seed;uniform float uTime;varying float vFade;varying vec3 vN;varying vec2 vUv;
        void main(){vUv=uv;float t=max(0.0,uTime-0.09),a=seed.x*6.28318,flight=1.0-exp(-t*3.5);vec3 p=position*vec3(1.0,1.6,1.0)*(0.6+seed.z);
          float b=t*(2.0+seed.z*4.0)+a;mat2 rot=mat2(cos(b),-sin(b),sin(b),cos(b));p.xy=rot*p.xy;vec3 n=normal;n.xy=rot*n.xy;vN=normalMatrix*n;
          p+=vec3(cos(a)*flight*(0.4+seed.z*1.6),flight*(0.6+seed.y*2.2)-t*t*0.35,sin(a)*flight*(0.4+seed.z*1.6));p*=uSize;p.y-=1.25;vFade=smoothstep(0.04,0.16,uTime)*(1.0-smoothstep(0.55,1.65,uTime));gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}`,{},false);
      instanced(new THREE.PlaneGeometry(0.32,0.32),36,0.06,fragments,3);
      }
      const flash=shader(`uniform float uTime;uniform vec3 uColor;varying vec2 vUv;${noise}
        void main(){vec2 p=vUv*2.0-1.0;float r=length(p),a=atan(p.y,p.x),t=uTime;float hot=exp(-r*r*160.0),inner=exp(-r*r*40.0),halo=exp(-r*r*5.0);float spokes=pow(abs(cos(a*3.0)),35.0)*exp(-r*6.0)+exp(-p.y*p.y*1500.0-abs(p.x)*4.0);float fade=smoothstep(0.0,0.035,t)*(1.0-smoothstep(.18,.52,t));vec3 c=mix(uColor,pow(uColor,vec3(.55))*vec3(.65,1.4,1.0),inner)+vec3(hot*2.0);
          gl_FragColor=vec4(c,(hot+inner*.6+halo*.22+spokes*.32)*fade);${output}
          #if TOON == 1
            gl_FragColor.rgb*=min(1.0,gl_FragColor.a);gl_FragColor.a=min(1.0,gl_FragColor.a)*.6;
          #endif
        }`,`uniform float uTime;varying vec2 vUv;
        void main(){vUv=uv;vec4 mv=modelViewMatrix*vec4(0,-1.20+uSize*0.12,0,1);mv.xy+=position.xy*uSize*(1.1+min(uTime,.25)*3.6)*length(modelMatrix[1].xyz);gl_Position=projectionMatrix*mv;}`);
      if(toon)electricBlend(flash);
      mesh(new THREE.PlaneGeometry(2,2),flash,4);
    }
    if(variant===2){
      // Seven preallocated volume billows replace the hard radial wall.
      const pos=[],uvs=[],idx=[];for(let k=0;k<7;k++){const base=pos.length/3;for(const [u,v]of [[0,0],[1,0],[0,1],[1,1]]){pos.push(u-.5,v-.5,k);uvs.push(u,v);}idx.push(base,base+1,base+2,base+2,base+1,base+3);}
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(idx);
      const roll=shader(`uniform vec3 uColor;uniform float uTime;varying vec2 vUv;varying float vFade,vSeed;varying vec3 vKeyLight;${noise}${flow}${smokeLight}
        void main(){vec2 q=vUv*2.0-1.0;float turn=uTime*(.9+fract(vSeed*.37)) +vSeed*2.4;q=mat2(cos(turn),-sin(turn),sin(turn),cos(turn))*q;
          vec3 n=noiseGradient(q*2.6+vec2(vSeed*17.0,-uTime*.65));float d=length(q)+(n.x-.5)*.30;vec2 optics=smokeOptics(q,n.yz*2.6,n.x,vKeyLight);
          float a=(1.0-smoothstep(.68,.96,d))*smoothstep(.13,.40,n.x)*vFade;
          vec3 c=uColor*(.12+optics.x*.4);
          #if TOON == 1
            c=styleColor(uColor*.52,.16+optics.x*.55+n.x*.18);
          #endif
          gl_FragColor=vec4(c,a*.86);${output}
        }`,`uniform float uTime;varying vec2 vUv;varying float vFade,vSeed;varying vec3 vKeyLight;
        void main(){vUv=uv;float id=position.z;vSeed=id;float seed=fract(id*.618034),t=max(.0,uTime-seed*.14);
          float a=id*2.39996-t*.25,grow=1.0-exp(-t*6.0),roll=t*(1.5+seed*.4);
          float r=.16+grow*(1.05+seed*.45)+t*.28;
          vec3 p=vec3(cos(a)*r,-1.35+(sin(min(roll,3.14159))*.58+.08)*grow,sin(a)*r);p.y=-1.35+(p.y+1.35)*uSize;p.xz*=uSize;
          vec4 mv=modelViewMatrix*vec4(p,1.0);mv.xy+=position.xy*vec2(1.15+seed*.5,.85+seed*.3)*grow*(1.0+t*.25)*uSize*length(modelMatrix[1].xyz);
          vFade=smoothstep(.0,.08,t)*(1.0-smoothstep(.80+seed*.25,1.65+seed*.2,t));vKeyLight=normalize(mat3(viewMatrix)*vec3(-.45,.8,.55));gl_Position=projectionMatrix*mv;
        }`,{},false);
      const cloud=mesh(g,roll,1);cloud.material.userData.ownLifecycle=true;
      const fans=shader(`uniform vec3 uColor;uniform float uTime;varying vec2 vUv;varying float vFade;varying float vSeed;${noise}
        void main(){vec2 q=vUv*2.0-1.0;float n=fbm(vec2(q.x*3.0+vSeed*15.0,q.y*4.0-uTime));float width=(0.3+vUv.y*0.5)*(0.55+n*0.6);float a=(1.0-smoothstep(width*0.5,width,abs(q.x)))*sin(vUv.y*PI)*smoothstep(0.22,0.62,n);vec3 c=uColor*(.13+n*.34);
          #if TOON == 1
            c=styleColor(uColor*.7,.20+n*.70);a=(1.0-smoothstep(width*.75,width,abs(q.x)))*sin(vUv.y*PI)*smoothstep(.22,.42,n);
          #endif
          gl_FragColor=vec4(c,a*vFade*.42);${output}}`,`attribute vec4 seed;uniform float uTime;varying vec2 vUv;varying float vFade;varying float vSeed;
        void main(){vUv=uv;vSeed=seed.w;float t=uTime,dt=max(0.0,t-seed.w*0.10),a=seed.x*6.28318;float rise=1.0-exp(-dt*8.0),h=uv.y;
          float r=h*rise*(0.35+seed.z*1.0)+dt*0.2;vec3 p=vec3(cos(a)*r,h*rise*(.7+seed.y*1.0)-h*dt*dt*0.75,sin(a)*r);
          p*=uSize;p.y-=1.34;vec4 mv=modelViewMatrix*vec4(p,1.0);mv.x+=position.x*(0.16+h*0.75)*rise*uSize*length(modelMatrix[1].xyz);
          vFade=smoothstep(0.01,0.10,dt)*(1.0-smoothstep(0.25+seed.y*0.15,1.2,dt));gl_Position=projectionMatrix*mv;}`,{},false,{CLOUD:1});
      instanced(new THREE.PlaneGeometry(1,1,1,12),18,0.045,fans,2);
      const chips=shader(`uniform vec3 uColor;varying float vFade;varying vec3 vN;void main(){float l=0.3+max(0.0,dot(normalize(vN),normalize(vec3(-0.5,0.8,0.3))));vec3 c=uColor*l*.25;
          #if TOON == 1
            c=styleColor(uColor*.35,l*.65);
          #endif
          gl_FragColor=vec4(c,vFade*uDetail);${output}}`,`attribute vec4 seed;uniform float uTime;varying float vFade;varying vec3 vN;
        void main(){float t=uTime,a=seed.x*6.28318;vec3 p=position*vec3(1.3,0.4,0.8)*(0.4+seed.w);float spin=a+t*7.0;mat2 rot=mat2(cos(spin),-sin(spin),sin(spin),cos(spin));p.xy=rot*p.xy;vec3 n=normal;n.xy=rot*n.xy;vN=normalMatrix*n;
          p+=vec3(cos(a)*t*(0.8+seed.z),max(0.02,(1.8+seed.y*1.8)*t-3.0*t*t),sin(a)*t*(0.8+seed.z));p*=uSize;p.y-=1.35;vFade=smoothstep(0.0,0.05,t)*(1.0-smoothstep(0.55,1.5,t));gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}`,{},false);
      instanced(new THREE.TetrahedronGeometry(0.075),28,0.055,chips,3);
    }
    if(variant===3){
      const pos=[],centers=[],seeds=[],units=[];
      // Keep the original nine crystals; extra units occupy the same fixed radius.
      for(let i=0;i<18;i++){
        const seed=i<9?i/9:(i-9+.5)/9;
        const a=seed*Math.PI*2,r=i===0?0:0.25+(i%3)*0.12,h=1.3+(i%4)*0.35;
        const c=[Math.cos(a)*r,0,Math.sin(a)*r];
        const points=[[0,-0.12,0],[0.19,0.4,0],[0,0.4,0.19],[-0.19,0.4,0],[0,0.4,-0.19],[Math.cos(a)*0.35,h,Math.sin(a)*0.35]];
        for(const tri of [[0,2,1],[0,3,2],[0,4,3],[0,1,4],[5,1,2],[5,2,3],[5,3,4],[5,4,1]])for(const k of tri){pos.push(...points[k]);centers.push(...c);seeds.push(seed);units.push(i);}
      }
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('aCenter',new THREE.Float32BufferAttribute(centers,3));g.setAttribute('aSeed',new THREE.Float32BufferAttribute(seeds,1));g.setAttribute('aUnit',new THREE.Float32BufferAttribute(units,1));g.computeVertexNormals();
      const crystal=shader(`uniform vec3 uColor;uniform float uTime;varying vec3 vN;varying vec3 vCrystal;varying float vFade;${noise}
        void main(){float light=0.3+max(dot(normalize(vN),normalize(vec3(-0.6,0.8,0.3))),0.0);
          float n=noise2(vCrystal.xy*8.0+vCrystal.z*5.0);float crack=1.0-smoothstep(0.03,0.12,abs(sin(vCrystal.y*17.0+vCrystal.x*23.0+n*4.0)));
          #if TOON == 1
            crack=1.0-smoothstep(.04,.13,abs(sin(vCrystal.y*7.0+vCrystal.x*9.0+n)));
          #endif
          float fracture=smoothstep(0.10,0.35,uTime)*crack;float dissolve=smoothstep(0.0,0.14,n-(uTime-0.8)*0.65);
          vec3 c=uColor*(0.3+light*0.6+fracture*0.8)+vec3(pow(light,6.0)*0.3);
#if TOON == 1
            c=styleColor(uColor,.14+light*.55+fracture*.22);
          #endif
          gl_FragColor=vec4(c,vFade*dissolve);${output}}`,`attribute vec3 aCenter;attribute float aSeed,aUnit;uniform float uTime,uQuantity;varying vec3 vN;varying vec3 vCrystal;varying float vFade;
        void main(){vCrystal=position;float t=uTime,growth=smoothstep(0.0,0.16,t),flight=max(0.0,t-0.24);vec3 p=position*growth*uSize;float a=aSeed*6.28318;float spin=flight*(aSeed-0.5)*2.0;mat2 rot=mat2(cos(spin),-sin(spin),sin(spin),cos(spin));p.xy=rot*p.xy;vec3 n=normal;n.xy=rot*n.xy;vN=normalMatrix*n;
          p+=aCenter+vec3(cos(a)*flight*1.5,-1.35+flight*(1.3+aSeed)-flight*flight*2.0,sin(a)*flight*1.5);vFade=(1.0-smoothstep(0.8,1.7,t))*step(aUnit,uQuantity-.5);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}`,{},false);
      mesh(g,crystal,2).name='ice-shatter-crystals';
    }

    if(variant===3){
      const shards=shader(`uniform vec3 uColor;varying float vFade;varying vec3 vN;void main(){float light=0.35+max(dot(normalize(vN),normalize(vec3(-0.6,0.8,0.4))),0.0);vec3 c=uColor*(.7+light);
        #if TOON == 1
          c=styleColor(uColor,light*.7);
        #endif
        gl_FragColor=vec4(c,vFade*uDetail);${output}}`,`
        attribute vec4 seed;uniform float uTime;varying float vFade;varying vec3 vN;
        void main(){float t=uTime,a=seed.x*6.28318;float dt=max(0.0,t-seed.w*0.1);float speed=0.5+seed.z*1.4;vec3 c=vec3(cos(a)*dt*speed,max(-1.32,-1.32+(2.0+seed.y*3.8)*dt-2.4*dt*dt),sin(a)*dt*speed);vec3 p=position;p.y*=2.2;float spin=a+t*2.0;mat2 rot=mat2(cos(spin),-sin(spin),sin(spin),cos(spin));p.xy=rot*p.xy;p*=0.6+seed.z;vN=normalMatrix*normal;vFade=pow(max(0.0,1.0-t/2.8),1.3);gl_Position=projectionMatrix*modelViewMatrix*vec4(c+p,1.0);}
      `,{},false);
      instanced(new THREE.OctahedronGeometry(0.12),Math.ceil(cap*0.08),0.08,shards,2);
    }
    const positions=[],uvs=[],indices=[];
    for(let ray=0;ray<10;ray++){
      const start=positions.length/3;
      for(let j=0;j<=16;j++)for(let side=0;side<2;side++){
        positions.push(side*2-1,j/16,ray/10*2*Math.PI);uvs.push(side,j/16);
      }
      for(let j=0;j<16;j++){const i=start+j*2;indices.push(i,i+1,i+2,i+1,i+3,i+2);}
    }
    const jets=new THREE.BufferGeometry();jets.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));jets.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));jets.setIndex(indices);
    const jetMaterial=shader(`
      uniform vec3 uColor;uniform float uTime;varying vec2 vUv;${noise}
      void main(){float t=uTime;float side=1.0-smoothstep(0.1,1.0,abs(vUv.x*2.0-1.0));float n=fbm(vec2(vUv.x*4.0,vUv.y*8.0-t*4.0));float mask=smoothstep(0.2,0.75,n+side*0.3);float life=smoothstep(0.0,0.1,t)*(1.0-smoothstep(0.15,0.75,t));vec3 c=uColor*1.5;
      #if TOON == 1
        c=styleHeat(uColor,.25+n*.6);mask=smoothstep(.32,.46,n+side*.3);
      #endif
      gl_FragColor=vec4(c,side*mask*life*(1.0-vUv.y)*0.6);${output}}
    `,`
      uniform float uTime;varying vec2 vUv;
      void main(){vUv=uv;float t=uTime,h=position.y,a=position.z;float growth=1.0-exp(-t*7.0);float height=2.0+sin(a*7.1)*0.7;float rad=h*growth*(0.55+sin(a*4.0)*0.18);
        vec3 p=vec3(cos(a)*rad,-1.35+h*height*growth,sin(a)*rad);float width=(1.0-h)*0.35*growth;
        p.xz+=vec2(-sin(a),cos(a))*position.x*width;p.y-=max(0.0,t-0.5)*h*0.6;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}
    `,{},variant!==2);
    if(variant===0)corePart(mesh(jets,jetMaterial,2),"xyz",-1.35);else jets.dispose();
    const wave=shader(`
      uniform vec3 uColor;uniform float uTime;varying vec2 vUv;${noise}
      void main(){vec2 p=vUv*2.0-1.0;float r=length(p),t=uTime;float radius=(1.0-exp(-t*3.5))*0.82;float wave=exp(-pow((r-radius)*45.0,2.0));float dust=exp(-pow((r-radius+0.07)*14.0,2.0))*fbm(p*8.0)*0.45;float fade=pow(max(0.0,1.0-t/2.4),2.0);float alpha=(wave*0.7+dust)*fade;
        #if VARIANT == 0
          alpha*=0.22;
        #elif VARIANT == 1
          alpha=(wave*.22+dust*.28+exp(-r*r*12.0)*.18)*smoothstep(.0,.08,t)*(1.0-smoothstep(.32,.8,t));
        #elif VARIANT == 2
          float corrugation=noise2(p*14.0);float compress=pow(max(0.0,cos((r-radius)*110.0+corrugation*2.0)),12.0);
          float wake=exp(-pow((r-radius+0.055)*20.0,2.0));alpha=(wave*0.24+compress*wake*0.20)*fade*(1.0-smoothstep(0.4,1.1,t));
        #else
          float a=atan(p.y,p.x);alpha=(wave*0.35+band(r-radius*0.55,0.004)*step(0.1,cos(a*12.0)))*fade;
        #endif
        vec3 c=uColor*(.7+wave);
        #if TOON == 1
          c=styleColor(uColor,.35+wave*.5);
          #if VARIANT == 1
            c=pow(uColor,vec3(.55))*vec3(.65,1.4,1.0)+vec3(wave*.2);
          #endif
        #endif
        gl_FragColor=vec4(c,alpha);${output}}
    `);
    const disc=mesh(new THREE.PlaneGeometry(7,7),wave,2);disc.rotation.x=-Math.PI/2;disc.position.y=-1.36;if(variant===1){wave.blending=THREE.AdditiveBlending;corePart(disc,'xz');}
  }
  if(kind===4){
    // 氣流有獨立壽命、半徑和上升斜率，交錯穿過不同深度，而非等距螺旋。
    const positions=[],uvs=[],indices=[];
    const windReference=toon&&(variant===2||variant===3);
    const bladeCount=toon?(variant===0?16:variant===3?18:22):(variant===0?30:variant===3?28:44);
    const volumes=toon&&variant===1;
    const steps=volumes?1:toon?20:36,crossSteps=volumes?1:toon?6:2;
    for(let blade=0;blade<(volumes?bladeCount*2:bladeCount);blade++){
      const steps=windReference&&variant===3?18:volumes&&blade>=bladeCount?20:volumes?1:toon?20:36,crossSteps=windReference&&variant===3?5:volumes&&blade>=bladeCount?6:volumes?1:toon?6:2;
      const start=positions.length/3;
      for(let j=0;j<=steps;j++)for(let k=0;k<=crossSteps;k++){
        positions.push(j/steps,k/crossSteps*2-1,blade);uvs.push(j/steps,k/crossSteps);
      }
      for(let j=0;j<steps;j++)for(let k=0;k<crossSteps;k++){const stride=crossSteps+1,i=start+j*stride+k;indices.push(i,i+1,i+stride,i+1,i+stride+1,i+stride);}
    }
    const ribbons=new THREE.BufferGeometry();ribbons.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));ribbons.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));ribbons.setIndex(indices);
    const ribbonVertex=`uniform float uTime,uRetire,uOpening,uStoppedAt;varying float vVolume;varying vec2 vUv;varying float vLight;varying float vSeed;varying float vFade;varying float vHeight;${noise}${flow}
      void main(){vUv=uv;vVolume=0.0;float s=position.x,id=position.z;
        #if TOON == 1 && (VARIANT == 1 || VARIANT == 2)
          vVolume=id<22.0?1.0:0.0;id=mod(id,22.0);
        #endif
        vSeed=id;float t=uStoppedAt<0.0?uTime:uStoppedAt+1.4*(uRetire-.35*uRetire*uRetire);
        float r1=hash(vec2(id,1.0)),r2=hash(vec2(id,3.0)),r3=hash(vec2(id,7.0));float phase=r1;
        #if TOON == 1 && (VARIANT == 1 || VARIANT == 2)
        if(vVolume>.5){ float born=fract(hash(vec2(id,23.7))+(uStoppedAt<0.0?uTime:uStoppedAt)*(.14+r2*.035));
          float h=born,spin=id*2.399963-uTime*(2.0+r2*.3)+h*3.0;
          float radius=.30+pow(h,1.3)*1.45+.22*(1.0-smoothstep(.05,.55,h));
          vec3 p=vec3(cos(spin)*radius,h*3.5,sin(spin)*radius);
          float release=smoothstep(r2*.16,.95,uRetire);
          #if VARIANT == 1
            p.y-=release*release*(1.7+h*2.4);p.xz*=1.0+release*.22;
          #else
            p.y+=release*(.8+h*.6);p.xz+=vec2(-sin(spin),cos(spin))*release*.6;
          #endif
          // 沙團先沿外側切線捲入，略早於主柱就位，避免懸浮外圈與中柱脫節。
          float gather=(1.0-smoothstep(.02,.78,uOpening))*(1.0-smoothstep(0.0,.6,uRetire));
          p.xz+=vec2(-sin(spin),cos(spin))*gather*(1.2+h*1.5);p.xz*=1.0+gather*.38;p.y+=gather*h*.35;
          p*=uSize;p.y-=1.4;
          float width=(.65+h*.75)*( .88+r3*.24)*(1.0+gather*.15);
          vec4 mv=modelViewMatrix*vec4(p,1.0);vec2 tangent=normalize((modelViewMatrix*vec4(-sin(spin),.48,cos(spin),0.0)).xy+vec2(.0001));
          mv.xy+=mat2(tangent.x,tangent.y,-tangent.y,tangent.x)*(uv-.5)*width*uSize*vec2(1.55,VARIANT==2?.40:.56)*length(modelMatrix[1].xyz);
          vLight=spin;vHeight=h;vFade=smoothstep(0.0,.12,uOpening)*smoothstep(.0,.09,h)*(1.0-smoothstep(.88,1.0,h))*(1.0-smoothstep(.72,1.0,uRetire));
          #if VARIANT == 1
            vFade*=smoothstep(-1.5,-1.12,p.y);
          #endif
          gl_Position=projectionMatrix*mv;return; }
        #endif
        #if VARIANT == 1 || VARIANT == 2
          float exitAge=smoothstep(.02+r2*.34,.92,uRetire);s=mix(s,.24+r3*.45,exitAge*(VARIANT==1?.24:.12));
        #endif
        float life=fract(r1+t*(0.065+r2*0.055));
        float h=0.025+life*0.77+s*(0.12+r3*0.23);
        #if TOON == 1
          // Adjacent sheets share a large eddy; unequal lengths keep their ends from lining up.
          float family=id,lane=0.0;
          phase=fract(id*.6180339);
          #if VARIANT != 0
            phase=hash(vec2(id,23.7));
          #endif
          life=fract(phase+(uStoppedAt<0.0?t:uStoppedAt)*(.072+hash(vec2(family,8.0))*.025));if(uStoppedAt>=0.0)life=min(1.0,life+uRetire*.27);
          h=.025+life*.68+s*(.18+r3*.13);
          #if VARIANT != 0
            life=fract(phase+(uStoppedAt<0.0?t:uStoppedAt)*(.10+r2*.025));
            h=.02+life*.52+s*(.27+r3*.21);
            if(mod(id,5.0)<.5)h=.025+s*.40;
          #endif
        #endif
        float lean=sin(h*3.0+t*0.45)*h*0.22;
        #if TOON == 1 && VARIANT == 3
          s=mix(s,.2+r2*.5,smoothstep(.02+r3*.12,.85,uRetire)*.80);
        #endif
        float pitch=1.2+r2*3.1;
        float a=r3*PI*2.0+s*pitch-t*(2.0+r2*0.65)+sin(s*5.0+t*0.7+id)*0.18;
        #if TOON == 1
          // Keep azimuth separate from lifetime phase: adding both golden angles collapses every start onto the same side.
          a=family*2.39996323+s*(3.5+r2*1.2)-t*(2.05+phase*.2)+lane*.16;
          a+=sin(h*5.0-t*.65)*.28+sin(s*PI)*sin(s*4.0-t*.8+phase*6.28)*.22;
          #if VARIANT == 1 || VARIANT == 2
            a-=exitAge*(.2+r3*1.3);
          #endif
        #endif
        float taper=pow(max(0.0,sin(s*PI)),0.55+r2*0.8);
        float width=(0.045+h*(0.10+r1*0.17))*taper;
        if(mod(id,6.0)<0.5)width*=1.8;
        #if TOON == 1
          width*=1.8+(.5+.5*sin(id*2.3))*.25;
          #if VARIANT != 0
            width+=.08*taper*(1.0-h*.6);
          #endif
        #endif
        #if VARIANT == 0
          width*=0.75;
        #elif VARIANT == 1
          width*=1.2;
        #elif VARIANT == 3
          width*=0.65;a+=sin(s*9.0+id)*0.12;
        #endif
        float tear=(sin(s*47.0+t*3.0+id)*0.022+sin(s*97.0-t*4.0)*0.008)*taper;
        float curl=sin(s*PI)*sin(s*6.0+t*0.8+id)*0.15;
        float y=h*3.55+curl+position.y*(width+tear*abs(position.y));
        float radius=(0.08+pow(h,1.35)*1.2+pow(h,4.0)*0.65)*(0.72+r3*0.40);
        radius+=sin(s*9.0-t*0.9+id)*0.07*h+position.y*width*0.4;
        #if TOON == 1
          radius+=.22*(1.0-smoothstep(.08,.55,h));
          #if VARIANT != 0
            radius-=pow(h,4.0)*.25;
            radius+=sin(h*5.0-t*.9+id*.6)*.10*sin(s*PI);
          #endif
          // Roll each cross-section into an open crescent, instead of a flat strip.
          float roll=sin(h*4.5-t*.9+phase*2.0)*.65+sin(s*PI)*.5;
          #if VARIANT == 1 || VARIANT == 2
            roll+=exitAge*(1.8+r3)*sin(s*PI);
          #endif
          float across=position.y*1.9+roll;
          float center=cos(roll),edge=cos(across);
          radius+=(edge-center)*width*.95+sin(h*7.0-t*.8)*.08*sin(s*PI);
          #if VARIANT == 1 || VARIANT == 2
            float roundExit=smoothstep(.04,.55,uRetire);
            radius=mix(radius,radius-(edge-center)*width*.95+cos(position.y*PI+roll)*width*.7,roundExit);
          #endif
          y=h*3.55+curl+(sin(across)-sin(roll))*width*1.3;
          #if VARIANT == 1 || VARIANT == 2
            y=mix(y,h*3.55+curl+sin(position.y*PI+roll)*width*.7,roundExit);
          #endif
          y+=sin(h*4.0-t*.9+phase*2.0)*.10*sin(s*PI);
          #if VARIANT == 3
            radius+=(cos(position.y*PI)-1.0)*width*.42;
            y=h*3.55+curl+sin(position.y*PI)*width*.42;
          #endif
          a+=lane*.035*(1.0-smoothstep(.4,1.0,h));
        #endif
        vec3 p=vec3(cos(a)*radius+lean,y,sin(a)*radius);
        p.z+=sin(h*4.0+t*0.31)*h*0.10;
        vec3 eddy=curlFlow(p*1.1,t);
        p+=eddy*(0.07+h*0.12);
        vLight=clamp(0.5+0.5*sin(a-0.8)+eddy.y*0.12,0.0,1.0);
        #if TOON == 1
          vec3 surfaceNormal=vec3(cos(a)*cos(across),-sin(across),sin(a)*cos(across));
          vLight=clamp(.45+dot(surfaceNormal,vec3(-.38,.58,.72))*.52+eddy.y*.08,0.0,1.0);
        #endif
        float peel=smoothstep(phase*.09,.85,uRetire);vec2 tangent=vec2(-sin(a),cos(a));
        #if VARIANT == 1 || VARIANT == 2
          p.xz+=tangent*exitAge*(.12+r2*.32);
        #else
          p.xz+=tangent*peel*(.8+h*1.15);p.xz*=1.0+peel*.38;p.y+=peel*h*.35;
        #endif
        #if VARIANT == 1
          float collapse=exitAge;
          float sag=smoothstep(.0,.7,collapse)*(.35+.65*pow(s,1.5));
          p.y-=collapse*collapse*(2.4+r3*2.4)+sag*width;
          p.xz*=1.0+collapse*.12;p.y-=position.y*width*collapse*.5;
        #elif VARIANT == 2
          p.y+=exitAge*(.85+phase*.9);p.xz*=1.0+exitAge*.12;
        #endif
        vHeight=h;float gather=(1.0-smoothstep(.04,1.0,uOpening))*(1.0-smoothstep(0.0,.6,uRetire));
        // 重用收尾的切向鬆散形態，從外圍捲回；旋轉時間繼續向前，不倒播。
        p.xz+=tangent*gather*(.8+h*1.15);p.xz*=1.0+gather*.38;p.y+=gather*h*.35;
        p*=uSize;p.y-=1.4;
        vFade=smoothstep(0.0,.12,uOpening)*smoothstep(0.0,0.10,life)*(1.0-smoothstep(0.85,1.0,life));vFade*=1.0-smoothstep(.48+phase*.18,.88+phase*.1,uRetire);
        #if VARIANT == 1
          vFade*=smoothstep(-1.4,-1.1,p.y);
        #endif
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}`;
    const ribbonFragment=`uniform vec3 uColor;uniform float uTime,uRetire,uOpening;uniform float uGlow;varying float vVolume;varying vec2 vUv;varying float vLight;varying float vSeed;varying float vFade;varying float vHeight;${noise}${flow}${smokeLight}${flame}
      void main(){
        #if TOON == 1 && (VARIANT == 1 || VARIANT == 2)
        if(vVolume>.5){ vec2 q=vUv*2.0-1.0;float spin=-uTime*.8+vSeed*.7;q=mat2(cos(spin),-sin(spin),sin(spin),cos(spin))*q;
          vec3 n=noiseGradient(q*2.4+vec2(vSeed*9.0,-uTime*.45));float d=length(q)+(n.x-.5)*.35;
          vec3 key=vec3(-.45,.8,.55);vec2 optics=smokeOptics(q,n.yz*2.4,n.x,key);
          float a=(1.0-smoothstep(.73,.98,d))*smoothstep(.02,.18,n.x+(1.0-d)*.3)*vFade;
          vec3 c=styleColor(uColor*.8,.20+optics.x*.44+n.x*.10);
          #if VARIANT == 2
            float burn=smoothstep(.08,.95,uRetire),heat=.16+optics.x*.15+n.x*.20+pow(max(0.0,1.0-abs(q.y)),1.4)*.43;
            a*=smoothstep(.10+burn*.50,.23+burn*.48,n.x+(1.0-d)*.35);
            c=styleHeat(uColor,heat);c=mix(c,uColor*vec3(.26,.075,.03),burn*.65);
          #endif
          a*=VARIANT==2?.46:.42;if(a<.004)discard;gl_FragColor=vec4(c,a);${output}return; }
        #endif
        float s=vUv.x,w=vUv.y;
        vec2 skew=vec2(s+w*0.28,w+s*0.16);
        float warp=noise2(skew*vec2(8.0,3.0)+vec2(-uTime*0.55,vSeed*2.3));
        #if TOON == 1
          float family=vSeed;
          float n=noise2(vec2(s*7.0-uTime*.95,w*2.1+family*3.7+warp*.6));
        #else
          float n=fbm(vec2(s*25.0-uTime*(1.2+fract(vSeed*0.13)),w*5.0+vSeed*3.7+warp*1.5));
        #endif
        float fiber=noise2(vec2(s*10.0-uTime*2.0,w*31.0+vSeed));
        float rim=abs(w*2.0-1.0);
        float silhouette=1.0-smoothstep(0.56+n*0.3,0.72+n*0.28,rim);
        float split=smoothstep(0.20,0.46,n+sin(w*29.0+s*7.0)*0.09);
        #if TOON == 1
          split=smoothstep(.18,.36,n);
          #if VARIANT == 1
            split=smoothstep(.28,.47,n);
          #endif
        #endif
        float tip=smoothstep(0.0,0.04,s)*(1.0-smoothstep(0.80,1.0,s));
        float departure=smoothstep(uRetire*.85-.15,uRetire*.85+.08,n*.55+(1.0-s)*.45);float alpha=silhouette*split*tip*vFade*departure;
        #if VARIANT == 2
          float delay=fract(vSeed*.381966)*.24+vHeight*.16;
          float exitBurn=smoothstep(.04+delay,.80+delay*.25,uRetire);
          float flameFront=n*.60+sin(s*PI)*.4-exitBurn*.82;alpha*=smoothstep(-.03,.10,flameFront);
          alpha*=1.0-smoothstep(.60,.95,uRetire+fract(vSeed*.23)*.15);
        #elif VARIANT == 1
          float grain=noise2(vec2(s*21.0,w*34.0-uTime*2.0+vSeed));
          alpha*=mix(1.0,smoothstep(.18,.40,grain),smoothstep(.10,.55,uRetire));
          alpha*=smoothstep(uRetire*.55-.08,uRetire*.55+.12,n);
        #endif
        float crest=exp(-pow((w-0.68-(n-0.5)*0.32)*18.0,2.0));
        float streak=pow(max(0.0,sin(w*48.0+n*6.0+s*3.0)),16.0);
        vec3 c;float lum=0.25+vLight*0.75;
        #if VARIANT == 0
          c=uColor*(0.12+lum*0.6+crest*0.8);alpha*=0.6;
        #elif VARIANT == 1
          c=uColor*(0.09+lum*0.4+fiber*0.13);alpha*=0.85;
        #elif VARIANT == 2
          #if TOON == 1
            float fireNoise=noise2(vec2(w*4.0+vSeed,s*11.0-uTime*2.4));
            vec3 burn=vec3(smoothstep(.20,.40,fireNoise),fireNoise,styleStep(.68,fireNoise)*.5);
          #else
            vec3 burn=flameErosion(vec2(w,s*2.0),uTime*1.3,vSeed*0.37);
          #endif
          alpha*=burn.x;
          c=flameColor(uColor,burn.y*0.90+lum*0.08)*(0.40+lum*0.6);
          if(!gl_FrontFacing)c*=0.38;
          c+=uColor*burn.z*0.55;
          crest=max(crest*0.45,burn.z*0.7);
        #else
          float gaps=step(0.12,fract(s*7.0+vSeed*0.3));
          #if TOON == 0
            alpha*=gaps;
          #endif
          c=uColor*(0.1+lum*0.7+crest*1.2);
        #endif
        #if TOON == 1
          c=styleColor(uColor,.15+vLight*.6+n*.18+crest*.16);
          #if VARIANT == 1
            c=styleColor(uColor*.82,.20+vLight*.37+n*.12+crest*.08);
          #elif VARIANT == 2
            float warmth=.19+vLight*.32+n*.33+crest*.11;
            c=styleHeat(uColor,warmth);if(!gl_FrontFacing)c*=.70;
          #elif VARIANT == 3
            float packet=pow(max(0.0,sin(s*12.0-uTime*4.5+vSeed*1.3)),6.0);
            c=styleColor(uColor,.20+vLight*.36+packet*.33+crest*.12);
          #endif
        #endif
        if(uGlow>0.5){
          alpha*=crest*(0.25+lum*0.75)+streak*0.10;
          if(!gl_FrontFacing)alpha*=0.3;
          #if VARIANT == 1
            alpha*=0.12;
          #elif VARIANT == 0
            alpha*=0.35;
          #endif
          c=uColor*1.7+vec3(0.3,0.19,0.07)*crest;alpha*=uDetail*0.8;
        }
        #if TOON == 1
          if(uGlow>.5){c=styleColor(uColor,.82);alpha*=.28;}
          // In-material contour ink: screen-space width, no outline mesh or full-screen pass.
          float contour=.65+n*.28-rim;
          contour=min(contour,min(s*5.0,(1.0-s)*2.0));
          float pixel=max(fwidth(contour),.002);
          float ink=1.0-smoothstep(pixel*.5,pixel*1.9,contour);
          float edgeCoverage=smoothstep(-pixel,pixel,contour);
          alpha*=edgeCoverage;
          vec3 inkColor=mix(vec3(.012,.016,.022),uColor*.055,.65);
          c=mix(c,inkColor,ink*(VARIANT==0?.55:.25)*(1.0-uRetire*.7));
          #if VARIANT == 2
            c=mix(c,uColor*vec3(.22,.045,.012),smoothstep(.35,.9,uRetire)*.82);
          #endif
        #endif
        #if TOON == 1 && (VARIANT == 1 || VARIANT == 2)
          alpha*=VARIANT==2?.90:.62;
        #endif
        #if TOON == 1 && VARIANT == 3
          // 亮紋沿捲曲表面的縱向傳遞，避免插值光量跨三角形形成大片亮折面。
          float track=.49+.15*sin(s*5.0-uTime*.6+vSeed*1.3);
          float stripe=1.0-smoothstep(.035,.15,abs(w-track));
          float chargePhase=fract(s*2.4-uTime*.8+vSeed*.23);
          float pulse=smoothstep(.05,.24,chargePhase)*(1.0-smoothstep(.68,.94,chargePhase));
          float light=.29+vLight*.13+stripe*(.24+pulse*.33);
          c=styleColor(uColor,light);
          float cut=smoothstep(.08,.8,uRetire);float islands=smoothstep(.15+cut*.40,.27+cut*.42,noise2(vec2(s*9.0-uTime*.6,vSeed*2.7)));
          alpha=silhouette*split*tip*vFade*departure*(.84+stripe*.10)*islands;
        #endif
        gl_FragColor=vec4(c,alpha);${output}}`;
    // 火／能量沿用風旋已驗收的捲曲截面與流向；只加寬、增厚及重新分配細分。
    // FLOW_VARIANT 僅控制此兩款的柱體幾何；材質、粒子與生命週期仍使用實際 VARIANT。
    const columnVertex=windReference?ribbonVertex.replaceAll('VARIANT','FLOW_VARIANT')
      .replace('width*=0.75;',variant===2?'width*=1.10;':'width*=1.23;')
      .replace('vHeight=h;float gather=','p.xz*=1.20;p.y*=1.08;vHeight=h;float gather='):ribbonVertex;
    const column=mesh(ribbons,shader(ribbonFragment,columnVertex,{uGlow:{value:0},uRetire:lifeUniforms.uLifeEnd,uOpening:lifeUniforms.uLifeStart,uStoppedAt:lifeUniforms.uStopTime},false,windReference?{FLOW_VARIANT:0}:{}),2);column.name='vortex-column';column.material.userData.ownLifecycle=true;
    if(!toon)mesh(ribbons.clone(),shader(ribbonFragment,ribbonVertex,{uGlow:{value:1},uRetire:lifeUniforms.uLifeEnd,uOpening:lifeUniforms.uLifeStart,uStoppedAt:lifeUniforms.uStopTime}),3);
    // 獨立低空煙塵：從外圍吸入、捲起，範圍不跟隨核心大小縮放。
    const dust=shader(`uniform vec3 uColor;uniform float uTime;varying vec2 vUv;varying float vSeed;varying float vFade;varying float vInner;varying vec3 vKeyLight;${noise}${flow}${smokeLight}
      void main(){vec2 q=vUv*2.0-1.0;vec2 original=q;float spin=vSeed*6.28-uTime*(0.4+vSeed*0.3);
        q=mat2(cos(spin),-sin(spin),sin(spin),cos(spin))*q;
        vec3 broad=noiseGradient(q*2.8+vec2(vSeed*27.0,-uTime*0.25));
        #if TOON == 1
          vec3 fine=broad;
        #else
          vec3 fine=noiseGradient(q*6.1+vec2(vSeed*11.0,-uTime*0.5));
        #endif
        float n=broad.x*0.72+fine.x*0.28;
        vec2 gradient=mat2(cos(spin),sin(spin),-sin(spin),cos(spin))*(broad.yz*2.8*0.72+fine.yz*6.1*0.28);
        float d=length(q)+(n-0.5)*0.45;
        vec2 optics=smokeOptics(original,gradient,n,vKeyLight);
        float a=(1.0-smoothstep(0.30,1.0,d))*smoothstep(0.15,0.65,n)*optics.y*vFade*1.35;
        vec3 c=uColor*(0.05+optics.x*0.6);
        #if VARIANT == 2
          float illumination=vInner*(0.3+max(0.0,-original.y)*0.7);
          c=vec3(0.028,0.025,0.023)*(0.4+optics.x)+uColor*illumination*(0.2+optics.y*0.45);
        #elif VARIANT == 3
          c+=uColor*vInner*0.13;a*=0.45;
        #endif
        #if TOON == 1
          c=styleColor(uColor*.48,.16+optics.x*.60+n*.2);
          #if VARIANT == 2
            c=mix(styleColor(vec3(.12,.09,.065),optics.x),styleHeat(uColor,.35+vInner*.4)*.48,vInner*.7);
          #elif VARIANT == 3
            c=styleColor(uColor*.55,.18+optics.x*.6+vInner*.2);
          #endif
          a=(1.0-smoothstep(.62,.94,d))*smoothstep(.20,.40,n)*vFade*.80;
          #if VARIANT != 0
            a=(1.0-smoothstep(.70,.98,d))*smoothstep(.05,.22,n+(1.0-d)*.25)*vFade*.73;
          #endif
          #if VARIANT == 3
            a*=.45;
          #endif
        #endif
        gl_FragColor=vec4(c,a*uDetail);${output}}`,`attribute vec4 seed;uniform float uTime,uStopTime;varying vec2 vUv;varying float vSeed;varying float vFade;varying float vInner;varying vec3 vKeyLight;${noise}${flow}
      void main(){vUv=uv;vSeed=seed.w;vKeyLight=normalize(mat3(viewMatrix)*vec3(-0.45,0.8,0.55));
        float rate=.15+seed.w*.08;float life=uStopTime<0.0?fract(seed.y+uTime*rate):min(1.0,fract(seed.y+uStopTime*rate)+(uTime-uStopTime)*.55),a=seed.x*6.28318-uTime*1.2-life*3.0;
        float roll=life*6.28318+seed.z*3.14159;
        float r=(2.2-life*1.7)*(0.7+seed.z*0.5)+cos(roll)*(0.16+seed.w*0.18);
        #if TOON == 1
          r*=1.25;
        #endif
        float lift=(0.22+sin(roll)*0.20)*sin(life*3.14159)+life*life*(0.7+seed.z*0.9);
        vec3 p=vec3(cos(a)*r,lift,sin(a)*r);p+=curlFlow(p*1.1,uTime)*0.17*sin(life*3.14159);p.y-=1.36;
        vInner=exp(-r*r*0.7)*(1.0-life*0.4);
        vec4 mv=modelViewMatrix*vec4(p,1.0);float size=(0.60+sin(life*3.14159)*0.65)*(0.8+seed.w*0.4);
        mv.xy+=position.xy*size*vec2(1.25,1.05)*length(modelMatrix[1].xyz);vFade=sin(life*3.14159)*0.85;
        #if VARIANT == 0
          vFade*=0.55;
        #endif
        gl_Position=projectionMatrix*mv;}`,{},false,{CLOUD:1});
    instanced(new THREE.PlaneGeometry(1,1),96,0.16,dust,1);
    const debris=shader(`uniform vec3 uColor;varying vec2 vUv;varying float vFade;${noise}
      void main(){vec2 q=vUv*2.0-1.0;float a=1.0-smoothstep(0.65,0.95,abs(q.y)+q.x*q.x);vec3 c=uColor*(0.20+vUv.y*0.30);
        #if VARIANT == 0
          c=mix(vec3(0.08,0.12,0.04),uColor*0.45,vUv.y);a*=step(abs(q.y),0.7*(1.0-q.x*q.x));
        #elif VARIANT == 1
          a=step(abs(q.x)+abs(q.y)*0.7,0.9);c=uColor*(0.12+step(q.y,0.0)*0.18);
        #elif VARIANT == 2
          c=mix(uColor*0.04,uColor*2.5+vec3(0.35),pow(vUv.y,6.0));
        #else
          a=band(abs(q.x)+abs(q.y)-0.65,0.09);c=uColor*1.8;
        #endif
        #if TOON == 1
          c=styleColor(uColor*.65,.2+vUv.y*.65);
          #if VARIANT == 0
            c=styleColor(mix(vec3(.2,.3,.08),uColor,.4),.22+vUv.y*.6);
          #elif VARIANT == 2
            c=styleHeat(uColor,.16+vUv.y*.75);
          #elif VARIANT == 3
            c=styleColor(uColor,.8);
          #endif
        #endif
        gl_FragColor=vec4(c,a*vFade*uDetail);${output}}`,`attribute vec4 seed;uniform float uTime,uStopTime;varying vec2 vUv;varying float vFade;
      void main(){vUv=uv;float life=uStopTime<0.0?fract(seed.y+uTime*.16):min(1.0,fract(seed.y+uStopTime*.16)+(uTime-uStopTime)*.6),a=seed.x*6.28318-uTime*2.4,r=0.25+life*1.9;

        #if TOON == 1
          r+=.22*(1.0-smoothstep(.08,.55,life));
        #endif
        vec3 p=vec3(cos(a)*r,-1.25+life*3.1,sin(a)*r);vec4 mv=modelViewMatrix*vec4(p,1.0);
        float spin=a+uTime;mat2 rot=mat2(cos(spin),-sin(spin),sin(spin),cos(spin));vec2 card=position.xy;
        #if VARIANT == 0
          card*=vec2(1.0,0.45);
        #elif VARIANT == 1
          card*=0.5;
        #elif VARIANT == 2
          card*=vec2(0.4,1.4);
        #endif
        mv.xy+=rot*card*(VARIANT==3?(.14+seed.w*.15):(.08+seed.w*.13))*length(modelMatrix[1].xyz);vFade=sin(life*3.14159);gl_Position=projectionMatrix*mv;}`,{},false);
    instanced(new THREE.PlaneGeometry(1,1),40,0.055,debris,4);
    const ground=shader(`uniform vec3 uColor;uniform float uTime;varying vec2 vUv;${noise}
      void main(){vec2 p=vUv*2.0-1.0;float r=length(p),a=atan(p.y,p.x);float turn=a-uTime*1.7+r*4.0;vec2 polar=vec2(cos(turn),sin(turn));
        float broad=noise2(polar*(2.0+r*3.0)+vec2(r*4.0,uTime*0.2));
        float detail=noise2(vec2(cos(a-uTime*2.4+r*7.0),sin(a-uTime*2.4+r*7.0))*(5.0+r*7.0));
        float mask=exp(-pow((r-0.42)*4.0,2.0))*smoothstep(0.18,0.50,broad*detail);vec3 c=uColor*.06;
        #if TOON == 1
          c=styleColor(uColor*.12,.18+broad*.65);
        #endif
        gl_FragColor=vec4(c,mask*.30);${output}}`,surfaceVertex,{},false);
    const groundMesh=mesh(new THREE.PlaneGeometry(toon?7.25:5.8,toon?7.25:5.8),ground,0);groundMesh.rotation.x=-Math.PI/2;groundMesh.position.y=-1.38;
  }
  }
  let impactMesh=null,impactGlow=null,impactWisps=null;
  const fireFlightParts=kind===0&&variant===0?group.children.slice():[];
  function buildImpact(){
    if(kind!==0)return;
    if(variant===0){
      // Brief volumetric flare and three open arc tubes, all in the recoil frame (+X).
      const positions=[],uvs=[],parts=[],indices=[];
      function patch(part,rows,sides){
        const base=parts.length;
        for(let j=0;j<=rows;j++)for(let k=0;k<=sides;k++){positions.push(0,0,0);uvs.push(j/rows,k/sides);parts.push(part);}
        for(let j=0;j<rows;j++)for(let k=0;k<sides;k++){const n=base+j*(sides+1)+k;indices.push(n,n+1,n+sides+1,n+1,n+sides+2,n+sides+1);}
      }
      patch(0,6,12);for(let id=1;id<=9;id++)patch(id,4,4);for(let id=10;id<=15;id++)patch(id,32,4);
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
      geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geo.setAttribute('aPart',new THREE.Float32BufferAttribute(parts,1));geo.setIndex(indices);
      const spatial={uImpactUp:{value:new THREE.Vector3(0,1,0)},uImpactSurface:{value:0},uImpactPlaneNormal:{value:new THREE.Vector3(1,0,0)}};
      const vertex=`attribute float aPart;uniform float uImpactProgress,uLifeOrigin;uniform vec3 uImpactPlaneNormal;
        varying vec2 vUv;varying float vPart,vSurface;
        void main(){float t=uImpactProgress*2.0,h=uv.x,a=uv.y*6.283185;vec3 p;
          float grow=1.0-exp(-t*34.0),recoil=.05+max(t-.015,0.0)*1.2;
          if(aPart<.5){float theta=h*3.141593;float radius=(.10+.25*grow)*(1.0-smoothstep(.07,.17,t));
            p=vec3(recoil,0,0)+vec3(cos(theta)*.7,sin(theta)*cos(a),sin(theta)*sin(a))*radius;
          }else if(aPart<9.5){
            float seed=fract(sin(aPart*17.13+2.8)*4375.3),angle=aPart*2.399963+seed*.4;
            vec3 ray=normalize(vec3(.18+seed*.45,cos(angle),sin(angle))),side=normalize(cross(ray,vec3(1,0,0))),up=cross(ray,side);
            float reach=(.85+seed*.8)*grow,retire=1.0-smoothstep(.085,.20,t);
            float width=sin(pow(h,.7)*3.141593)*(.10+seed*.035)*retire;
            p=vec3(recoil,0,0)+ray*(h*reach)+side*sin(h*3.141593)*.035*sin(aPart+t*14.0);
            p+=(side*cos(a)+up*sin(a))*width;
          }else{
            float id=mod(aPart-10.0,3.0),open=1.0-exp(-max(t-.045,0.0)*24.0);
            float span=(id<.5?1.8:id<1.5?1.25:1.05)*(1.0-smoothstep(.25,.70,t));
            float angle=(id<.5?-.85:id<1.5?2.65:2.72)+t*.26+h*span;
            float radius=(.32+.75*open+max(t-.1,0.0)*.13)*(id<.5?1.0:id<1.5?.94:1.05);
            float thickness=(.022+.028*sin(h*3.141593))*(1.0-smoothstep(.45,.72,t))*(aPart>12.5?2.2:1.0);
            p=vec3(recoil+.035*sin(angle*2.0+id),cos(angle)*radius,sin(angle)*radius);
            p+=vec3(sin(a),cos(a)*cos(angle),cos(a)*sin(angle))*thickness;
          }
          vUv=uv;vPart=aPart;vSurface=dot(p,uImpactPlaneNormal);
          gl_Position=projectionMatrix*modelViewMatrix*vec4(p*uSize*(.35+.65*uLifeOrigin),1.0);
        }`;
      const fragment=`uniform vec3 uColor;uniform float uImpactProgress,uImpactSurface;varying vec2 vUv;varying float vPart,vSurface;
        void main(){float t=uImpactProgress*2.0;if(uImpactSurface>.5&&vSurface<-.012)discard;
          float heat,alpha;
          if(vPart<.5){heat=.96;alpha=1.0-smoothstep(.075,.15,t);}
          else if(vPart<9.5){heat=(1.0-vUv.x)*.8+.14+sin(vUv.y*6.283185)*.06;alpha=(1.0-smoothstep(.085,.20,t))*smoothstep(0.0,.015,t);}
          else{heat=.35+.55*sin(vUv.x*3.141593);alpha=smoothstep(.045,.09,t)*(1.0-smoothstep(.42,.72,t));}
          vec3 c=mix(uColor*.55,mix(uColor,vec3(1.0,.68,.16),.8),smoothstep(.05,.55,heat));
          c=mix(c,vec3(1.0,.96,.76),smoothstep(.50,.95,heat));
          if(vPart>9.5){float rim=pow(abs(sin(vUv.y*6.283185)),6.0);c=mix(uColor*vec3(1.0,.48,.12),vec3(1.0,.68,.18),rim*.65);if(vPart>12.5){alpha*=.16;c=uColor;}}
          if(alpha<.005)discard;gl_FragColor=vec4(c,alpha);${output}}
      `;
      impactMesh=mesh(geo,shader(fragment,vertex,spatial,false),5);impactMesh.name='lifecycle-impact';impactMesh.visible=false;
      impactMesh.material.forceSinglePass=true;
      // Four thin wisps, twelve embers, and one contact-plane crack patch share a draw.
      const p=[],uv=[],ids=[],ix=[];
      for(let id=0;id<17;id++){const base=ids.length;for(const [x,y] of [[0,0],[1,0],[0,1],[1,1]]){p.push(x-.5,y-.5,0);uv.push(x,y);ids.push(id);}ix.push(base,base+1,base+2,base+1,base+3,base+2);}
      const aux=new THREE.BufferGeometry();aux.setAttribute('position',new THREE.Float32BufferAttribute(p,3));aux.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));aux.setAttribute('aPart',new THREE.Float32BufferAttribute(ids,1));aux.setIndex(ix);
      impactWisps=mesh(aux,shader(`uniform vec3 uColor;uniform float uImpactProgress,uDensity,uImpactSurface;varying vec2 vUv;varying float vPart,vSurface;
        ${noise}
        float segmentDistance(vec2 p,vec2 a,vec2 b){vec2 v=b-a;return length(p-a-v*clamp(dot(p-a,v)/max(dot(v,v),.00001),0.0,1.0));}
        void main(){float t=uImpactProgress*2.0,seed=fract(sin(vPart*17.13+2.8)*4375.3);vec2 q=vUv*2.0-1.0;float alpha;vec3 c;
          if(vPart>15.5){
            if(uImpactSurface<.5)discard;
            float r=length(q),mainLine=10.0,twig=10.0;
            for(int i=0;i<7;i++){
              float id=float(i),rnd=fract(sin(id*17.13+4.1)*4375.3),angle=id*.897598+(rnd-.5)*.38;
              vec2 d=vec2(cos(angle),sin(angle)),side=vec2(-d.y,d.x);
              vec2 a=d*.045,b=d*(.22+rnd*.08)+side*(rnd-.5)*.12,c=d*(.43+rnd*.09)-side*(rnd-.5)*.14,end=d*(.61+rnd*.21)+side*(rnd-.5)*.20;
              mainLine=min(mainLine,min(segmentDistance(q,a,b),min(segmentDistance(q,b,c),segmentDistance(q,c,end))));
              vec2 fork=c+side*(.16+rnd*.09)+d*.09;
              twig=min(twig,min(segmentDistance(q,b,b-side*.18+d*.15),segmentDistance(q,c,fork)));
              twig=min(twig,segmentDistance(q,fork,fork+d*.12-side*.07));
            }
            float width=mix(.019,.006,smoothstep(.05,.8,r));
            float line=1.0-smoothstep(width*.45,width,mainLine);
            line=max(line,(1.0-smoothstep(.003,.008,twig))*.7);
            float glow=exp(-min(mainLine,twig)*45.0)*.28;
            float mask=(1.0-smoothstep(.70,.88,r))*smoothstep(.015,.06,r);
            float cooling=smoothstep(1.1,2.0,t),retire=1.0-smoothstep(1.35+r*.22,2.0,t);
            float reveal=smoothstep(r*.09,r*.09+.035,t);
            alpha=(line+glow)*mask*reveal*retire;
            float heat=line*(1.0-cooling)*(.65+.35*(1.0-r));
            c=mix(uColor*vec3(.40,.10,.03),vec3(1.0,.56,.10),heat);
            c=mix(c,vec3(1.0,.86,.40),pow(heat,4.0));
          }else if(vPart<4.0){float f=noise2(q*3.0+vec2(vPart*3.1,-t*.35));float r=length(q)+(f-.5)*.28;
            alpha=(1.0-smoothstep(.4,.95,r))*smoothstep(.14,.30,t)*(1.0-smoothstep(.5,1.2,t))*.12;
            c=mix(vec3(.09,.06,.04),vec3(.24,.17,.11),f);
          }else{float enabled=1.0-step(floor(3.0+clamp(uDensity,0.0,1.0)*9.0),vPart-4.0);
            alpha=(1.0-smoothstep(.15,1.0,abs(q.x)))*sin(vUv.y*3.141593)*smoothstep(.015,.045,t)*(1.0-smoothstep(.20+seed*.25,.40+seed*.40,t))*enabled;
            c=mix(uColor*.65,vec3(1.0,.90,.55),vUv.y);
          }
          if(vPart<15.5)alpha*=mix(1.0,smoothstep(-.02,.06,vSurface),uImpactSurface);
          if(alpha<.005)discard;gl_FragColor=vec4(c,alpha);${output}}`,
        `attribute float aPart;uniform float uImpactProgress,uLifeOrigin;uniform vec3 uImpactUp,uImpactPlaneNormal;varying vec2 vUv;varying float vPart,vSurface;
        void main(){float t=uImpactProgress*2.0,seed=fract(sin(aPart*17.13+2.8)*4375.3),angle=aPart*2.399963;vec3 ray=normalize(vec3(.35+seed*.5,cos(angle),sin(angle)));
          vPart=aPart;vUv=uv;float scale=uSize*(.35+.65*uLifeOrigin);
          if(aPart>15.5){vec3 n=normalize(uImpactPlaneNormal),helper=abs(n.y)<.9?vec3(0,1,0):vec3(0,0,1);
            vec3 right=normalize(cross(helper,n)),up=cross(n,right);vec3 pos=(right*position.x+up*position.y)*1.8+n*.012;
            vSurface=0.0;gl_Position=projectionMatrix*modelViewMatrix*vec4(pos*scale,1.0);
          }else{vec3 center;vec2 offset;
            if(aPart<4.0){center=vec3(.18,0,0)+ray*(.25+t*.25)+uImpactUp*max(t-.35,0.0)*.18;offset=position.xy*(.45+seed*.15+t*.20);}
            else{float age=max(0.0,t-.015);center=vec3(.08,0,0)+ray*(.12+age*(4.0+seed*2.5)/(1.0+age*2.0))-uImpactUp*age*age*.45;offset=position.xy*vec2(.018+seed*.014,.12+seed*.10);}
            vSurface=dot(center,uImpactPlaneNormal);vec4 mv=modelViewMatrix*vec4(center*scale,1.0);
            vec3 motion=(modelViewMatrix*vec4(ray,0.0)).xyz;vec2 along=length(motion.xy)>.001?normalize(motion.xy):vec2(0,1),across=vec2(along.y,-along.x);
            mv.xy+=(aPart<4.0?offset:across*offset.x+along*offset.y)*scale*length(modelMatrix[1].xyz);gl_Position=projectionMatrix*mv;
          }}`,spatial,false),6);
      impactWisps.name='lifecycle-impact-wisps';impactWisps.visible=false;impactWisps.material.forceSinglePass=true;
      impactGlow=mesh(new THREE.PlaneGeometry(3.2,3.2),shader(`uniform vec3 uColor;uniform float uImpactProgress;varying vec2 vUv;
        void main(){vec2 q=vUv*2.0-1.0;float t=uImpactProgress*2.0,r=dot(q,q);
          float flash=exp(-r*32.0)*(1.0-smoothstep(.055,.11,t));
          float halo=exp(-r*5.8)*(1.0-smoothstep(.06,.20,t))*.28;
          vec3 c=mix(uColor,vec3(1.0,.94,.73),flash);gl_FragColor=vec4(c,flash*.95+halo);${output}}`,
        `uniform float uImpactProgress,uLifeOrigin;varying vec2 vUv;void main(){vUv=uv;vec4 mv=modelViewMatrix*vec4(0,0,0,1);
          mv.xy+=position.xy*uSize*(.35+.65*uLifeOrigin)*(.5+(1.0-exp(-uImpactProgress*68.0))*.5)*length(modelMatrix[1].xyz);gl_Position=projectionMatrix*mv;}`),7);
      impactGlow.name='lifecycle-contact-glow';impactGlow.visible=false;impactGlow.material.forceSinglePass=true;return;
    }
    if(variant===1){
      // Twelve connected bolts and six sparks share one preallocated draw.
      // Keep the impact small enough to coexist with the original plasma flight mesh.
      const p=[],uv=[],parts=[],index=[];
      for(let id=0;id<30;id++){
        const steps=id<12?6:id<24?3:1,start=p.length/3;
        for(let j=0;j<=steps;j++)for(let side=0;side<2;side++){p.push(j/steps,side*2-1,0);uv.push(j/steps,side);parts.push(id);}
        for(let j=0;j<steps;j++){const n=start+j*2;index.push(n,n+1,n+2,n+1,n+3,n+2);}
      }
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setAttribute('aPart',new THREE.Float32BufferAttribute(parts,1));geo.setIndex(index);
      const vertex=`attribute float aPart;uniform float uLifeEnd,uLifeOrigin;varying vec2 vUv;varying float vFade;${noise}
        vec3 bolt(float h,float id,float age){float a=id*2.399963,l=.8+hash(vec2(id,3.0))*.8;
          float cell=h*6.0,tick=floor(age*24.0+id*.31),j=mix(hash(vec2(floor(cell)+id*13.0,tick)),hash(vec2(floor(cell)+1.0+id*13.0,tick)),fract(cell))-.5;
          float r=h*l;vec2 radial=vec2(cos(a),sin(a)),side=vec2(-sin(a),cos(a));
          return vec3(.025+h*(.12+hash(vec2(id,5.0))*.35),radial*r+side*j*.48*sin(h*PI));}
        vec3 pointAt(float h,float part,float age){float id=mod(part,12.0),growth=smoothstep(0.0,.08,age);
          if(part<12.0)return bolt(h*growth,id,age);
          if(part<24.0){float root=.42+mod(id,3.0)*.09,a=id*2.399963+.65;return bolt(root*growth,id,age)+vec3(h*.12,cos(a)*h*.58,sin(a)*h*.58)*growth;}
          float a=(part-24.0)*2.399963+.4,r=.15+age*3.5+h*.3;return vec3(.08+age*.4,cos(a)*r,sin(a)*r);}
        void main(){vUv=uv;float age=uLifeEnd*.8,id=mod(aPart,12.0),scale=uSize*(.35+.65*uLifeOrigin),h=position.x;
          vec4 mv=modelViewMatrix*vec4(pointAt(h,aPart,age)*scale,1.0);
          vec4 a=modelViewMatrix*vec4(pointAt(max(0.0,h-.004),aPart,age)*scale,1.0),b=modelViewMatrix*vec4(pointAt(min(1.0,h+.004),aPart,age)*scale,1.0);
          vec2 delta=b.xy-a.xy,side=length(delta)<.00001?vec2(0,1):normalize(vec2(-delta.y,delta.x));
          float width=(id<3.0?.22:.105)*(1.0-h*.8);if(aPart>=12.0)width*=.48;if(aPart>=24.0)width=.045*sin(h*PI)+.008;
          mv.xy+=side*position.y*width*scale*length(modelMatrix[1].xyz);
          float end=.42+hash(vec2(id,7.0))*.34;
          vFade=smoothstep(0.0,.016,age)*(1.0-smoothstep(.35,end,age));
          if(aPart>=12.0)vFade*=.35+.65*step(.35,hash(vec2(id,floor(age*25.0+id))));
          if(aPart>=24.0)vFade*=1.0-smoothstep(.12,.36,age);
          gl_Position=projectionMatrix*mv;}`;
      const fragment=`uniform vec3 uColor;varying vec2 vUv;varying float vFade;void main(){float d=abs(vUv.y*2.0-1.0),core=1.0-smoothstep(.12,.27,d),edge=exp(-d*d*13.0),halo=exp(-d*d*4.0);
        vec3 blue=pow(uColor,vec3(2.2))*vec3(.12,.65,2.2),c=mix(blue,vec3(.8,.96,1.0)*1.5,core);
        float alpha=max(core,edge*.65+halo*.3)*(1.0-smoothstep(.75,1.0,d))*vFade;
        gl_FragColor=vec4(c,alpha);${output}}`;
      impactMesh=mesh(geo,shader(fragment,vertex,{},true),5);impactMesh.name='lifecycle-impact';impactMesh.visible=false;
      impactMesh.material.side=THREE.DoubleSide;impactMesh.material.depthWrite=false;
      impactGlow=mesh(new THREE.PlaneGeometry(2.4,2.4),shader(`uniform vec3 uColor;uniform float uLifeEnd;varying vec2 vUv;void main(){vec2 q=vUv*2.0-1.0;float age=uLifeEnd*.8,r=length(q),a=atan(q.y,q.x);
        float core=exp(-r*r*100.0),sheath=exp(-r*r*24.0),halo=exp(-r*r*5.0),spikes=pow(abs(cos(a*3.0+sin(a*5.0)*.4)),28.0)*exp(-r*7.0);
        float fade=smoothstep(0.0,.012,age)*(1.0-smoothstep(.06,.22,age));
        vec3 blue=pow(uColor,vec3(2.2))*vec3(.1,.65,2.2);gl_FragColor=vec4(mix(blue,vec3(.8,.97,1.0)*1.7,clamp(core+sheath,0.0,1.0)),(core+sheath*.6+halo*.3+spikes*.4)*fade);${output}}`,
        `uniform float uLifeEnd,uLifeOrigin;varying vec2 vUv;void main(){vUv=uv;vec4 mv=modelViewMatrix*vec4(0,0,0,1);mv.xy+=position.xy*uSize*(.35+.65*uLifeOrigin)*(.65+smoothstep(0.0,.1,uLifeEnd)*.35)*length(modelMatrix[1].xyz);gl_Position=projectionMatrix*mv;}`),4);
      impactGlow.name='lifecycle-contact-glow';impactGlow.visible=false;return;
    }
    const positions=[],centers=[],ids=[],indices=[],impactUvs=[];
    function patch(rows,cols,id,center,point){
      const base=positions.length/3;
      for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
        const p=point(i/cols,j/rows);positions.push(...p);centers.push(...center);ids.push(id);impactUvs.push(i/cols,j/rows);
      }
      for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const a=base+j*(cols+1)+i,b=a+cols+1;indices.push(a,b,a+1,b,b+1,a+1);}
    }
    function crystal(center,id,length,width){
      const ray=new THREE.Vector3(.25+Math.sin(id*2.4)*.45,Math.cos(id*2.39996),Math.sin(id*2.39996)).normalize();
      const q=new THREE.Quaternion().setFromUnitVectors(axis,ray);
      function turn(p){const v=new THREE.Vector3(...p).sub(new THREE.Vector3(...center)).applyQuaternion(q).add(new THREE.Vector3(...center));return v.toArray();}
      patch(1,4,id,center,(u,v)=>{const a=u*Math.PI*2;return turn([center[0]+(v?length:0),center[1]+(v?0:Math.cos(a)*width),center[2]+(v?0:Math.sin(a)*width)]);});
      patch(1,4,id,center,(u,v)=>{const a=u*Math.PI*2;return turn([center[0]-(v?width:0),center[1]+(v?0:Math.cos(a)*width),center[2]+(v?0:Math.sin(a)*width)]);});
    }
    if(variant===1){
      for(let i=0;i<12;i++){const a=i*2.39996,l=.6+(i%4)*.18;
        patch(7,3,i,[0,0,0],(u,v)=>{const k=Math.round(v*7),jitter=Math.sin(k*17+i*3)*.14,ang=a+jitter;
          const rad=v*l,w=(i%3===0?.052:.026)*(1-v*.7),q=u*Math.PI*2;
          return [.04+v*(.25+(i%5)*.27)+Math.cos(q)*w,Math.cos(ang)*rad+Math.sin(q)*w,Math.sin(ang)*rad+Math.sin(v*9+i)*.06];});
      }
    }else if(variant===2){
      for(let i=0;i<13;i++){const a=i*2.39996,r=.15+((i*7)%13)/13*.45;crystal([.08+((i*5)%13)/13*.7,Math.cos(a)*r,Math.sin(a)*r],i,.28+(i%4)*.12,.09+(i%3)*.018);}
    }else if(variant===3){
      for(let i=0;i<7;i++){const a=i*2.39996,r=.3+(i%3)*.13,c=[(i%3)*.33,Math.cos(a)*r,Math.sin(a)*r];
        const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(i*.63,i*.77,i*.4));
        const lines=[[[-.15,-.2],[-.15,.2]],[[-.15,.12],[.13,-.02]],[[-.15,-.08],[.1,-.2]]];
        if(i%2===0)lines.push([[.1,-.2],[.1,.12]]);
        for(const [from,to] of lines)patch(1,1,i,c,(u,v)=>{const y=from[0]+(to[0]-from[0])*u+(v-.5)*.025,z=from[1]+(to[1]-from[1])*u;
          return new THREE.Vector3(0,y,z).applyQuaternion(q).add(new THREE.Vector3(...c)).toArray();});
        crystal(c,i,.11,.055);
      }
    }else if(variant===4){
      for(let i=0;i<7;i++)patch(3,8,i,[.08+(i%3)*.22,Math.cos(i*.897)*.5,Math.sin(i*.897)*.5],(u,v)=>{
        const a=i*.897+u*.63,r=.48+v*.18;return [.08+(i%3)*.22+Math.sin(v*3.14159)*.13+Math.sin(a*2+i)*.12,Math.cos(a)*r,Math.sin(a)*r];});
    }else if(variant===5){
      for(let i=0;i<3;i++)patch(4,24,i,[0,0,0],(u,v)=>{const a=(u-.5)*1.8+i*.25,r=.55+i*.16+v*.16*Math.sin(u*Math.PI);
        return [(i-1)*.24+u*.65+v*.09,Math.cos(a)*r-.6,Math.sin(a)*r];});
    }else{
      for(let i=0;i<8;i++)patch(4,12,i,[0,0,0],(u,v)=>[u,v,i]);
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geo.setAttribute('uv',new THREE.Float32BufferAttribute(impactUvs,2));geo.setAttribute('aCenter',new THREE.Float32BufferAttribute(centers,3));geo.setAttribute('aPart',new THREE.Float32BufferAttribute(ids,1));geo.setIndex(indices);geo.computeVertexNormals();
    const vertex=`attribute vec3 aCenter;attribute float aPart;uniform float uLifeEnd,uLifeOrigin;varying vec3 vP;varying vec3 vImpactNormal;varying vec2 vFlow;varying float vPart;
      void main(){vFlow=uv;vImpactNormal=normal;float t=uLifeEnd;float open=1.0-exp(-t*7.0);vec3 p=position;vPart=aPart;
        #if VARIANT == 1
          p*=.12+open*1.35;p.x+=sin(floor(t*22.0)+aPart*3.0)*.035;
        #elif VARIANT == 2 || VARIANT == 4
          p-=aCenter;float spin=t*(1.5+mod(aPart,3.0));p.yz=mat2(cos(spin),-sin(spin),sin(spin),cos(spin))*p.yz;
          p.xz=mat2(cos(spin*.7),-sin(spin*.7),sin(spin*.7),cos(spin*.7))*p.xz;p+=aCenter*(.25+open*2.0);p.x+=t*(.2+mod(aPart,4.0)*.25);p.y-=t*t*.7;
        #elif VARIANT == 3
          p-=aCenter;p*=.25+sin(t*3.14159)*.8;p+=aCenter*(.2+open*2.0);p.x+=t*.5;
        #elif VARIANT == 5
          float spin=t*1.4;p.yz=mat2(cos(spin),-sin(spin),sin(spin),cos(spin))*p.yz;p*=.35+open*1.1;p.x+=t*1.3;p.z+=(t-.35)*(1.1+aPart*.3);
        #else
          float age=max(0.0,t-aPart*.025),h=uv.x,spin=aPart*2.399963-age*(4.0+mod(aPart,3.0))+h*2.7;
          float pulse=sin(h*3.14159265),head=age*(3.4+mod(aPart,3.0)*.35);
          float radius=(.05+age*.95)*(.5+pulse*.5)*( .7+mod(aPart,3.0)*.17);
          float width=(.015+pulse*.07)*(1.0-smoothstep(.45,.95,age)),tube=uv.y*6.2831853;
          p=vec3(.04+head+h*(.35+age*.7)+cos(tube)*width,cos(spin)*(radius+sin(tube)*width),sin(spin)*(radius+sin(tube)*width));
        #endif
        p*=uSize*(.35+.65*uLifeOrigin);vP=p;
gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);
      }`;
    const fragment=`uniform vec3 uColor;uniform float uLifeEnd;varying vec3 vP;varying vec3 vImpactNormal;varying vec2 vFlow;varying float vPart;${noise}${flow}${smokeLight}${projectileToon}
      void main(){float t=uLifeEnd;float fade=smoothstep(.0,.07,t)*(1.0-smoothstep(.52,1.0,t));
        vec3 n=normalize(cross(dFdx(vP),dFdy(vP)));

        float light=.35+abs(dot(n,normalize(vec3(.7,1,.5))))*.45;float mask=1.0;
        #if VARIANT == 1
          float charge=.5+.5*sin(vPart*4.7+floor(t*16.0)*2.1);mask=mix(.2,1.0,smoothstep(.15,.45,charge));mask*=1.0-smoothstep(.35+mod(vPart,3.0)*.13,.6+mod(vPart,3.0)*.13,t);light=mod(vPart,3.0)<.5?.82:.57;
        #elif VARIANT == 3
          mask=1.0-smoothstep(.5,.9,t+vPart*.025);light=.65;
        #elif VARIANT == 5
          mask=1.0-smoothstep(.22,.85,t+vPart*.09);light=.2+light*.55;
        #elif VARIANT == 6
          float flow=noise2(vec2(vFlow.x*8.0-t*5.0,vPart*2.3));mask=smoothstep(t*.6-.15,t*.6+.10,flow)*sin(vFlow.x*PI);fade*=1.0-smoothstep(.45,.96,t+vPart*.018);light=.35+.35*abs(dot(n,normalize(vec3(.4,.8,.5))))+.16*pow(vFlow.x,.6);
        #endif
        if(mask*fade<.006)discard;
        vec3 c=toonShade(uColor,light);
        gl_FragColor=vec4(c,mask*fade);${output}
      }`;
    impactMesh=mesh(geo,shader(fragment,vertex,{},false),5);impactMesh.name='lifecycle-impact';impactMesh.visible=false;
    impactGlow=mesh(new THREE.PlaneGeometry(1.8,1.8),shader(`uniform vec3 uColor;uniform float uLifeEnd;varying vec2 vUv;
      void main(){vec2 q=vUv*2.0-1.0;float t=uLifeEnd;float a=exp(-dot(q,q)*5.5)*(1.0-smoothstep(.0,.28,t))*smoothstep(.0,.025,t)*.24;
        gl_FragColor=vec4(uColor,a);${output}}`, `uniform float uLifeEnd;varying vec2 vUv;
      void main(){vUv=uv;vec4 mv=modelViewMatrix*vec4(0,0,0,1);mv.xy+=position.xy*uSize*(.5+uLifeEnd*2.0);gl_Position=projectionMatrix*mv;}`),4);
    impactGlow.name='lifecycle-contact-glow';impactGlow.visible=false;
  }
  installLifecycle();buildImpact();

  function setOptions(next={}){
    if(disposed)return;
    settings={...settings,...next};
    if(spec.quantity) {
      const q=spec.quantity;
      settings.quantity=Number.isFinite(settings.quantity)?THREE.MathUtils.clamp(Math.round(settings.quantity),q.min,q.max):q.default;
    } else delete settings.quantity;
    uniforms.uQuantity.value=settings.quantity??quantityDefault;
    if(spec.panelCount){
      const p=spec.panelCount;
      settings.panelCount=Number.isFinite(settings.panelCount)?THREE.MathUtils.clamp(Math.round(settings.panelCount),p.min,p.max):p.default;
    }else delete settings.panelCount;
    uniforms.uPanelCount.value=settings.panelCount??0;
    if(spec.spread) {
      const spread=spec.spread;
      settings.spread=Number.isFinite(settings.spread)?THREE.MathUtils.clamp(settings.spread,spread.min,spread.max):spread.default;
    } else delete settings.spread;
    uniforms.uSpread.value=settings.spread??1;
    if(spec.crackBloomSpread){const b=spec.crackBloomSpread;settings.crackBloomSpread=Number.isFinite(settings.crackBloomSpread)?THREE.MathUtils.clamp(settings.crackBloomSpread,b.min,b.max):b.default;}else delete settings.crackBloomSpread;
    uniforms.uCrackBloomSpread.value=settings.crackBloomSpread??1;
    if(spec.crackBloom){const b=spec.crackBloom;settings.crackBloom=Number.isFinite(settings.crackBloom)?THREE.MathUtils.clamp(settings.crackBloom,b.min,b.max):b.default;}else delete settings.crackBloom;
    uniforms.uCrackBloom.value=settings.crackBloom??1;
    if(spec.textureDensity){const t=spec.textureDensity;settings.textureDensity=Number.isFinite(settings.textureDensity)?THREE.MathUtils.clamp(settings.textureDensity,t.min,t.max):t.default;}else delete settings.textureDensity;
    uniforms.uTextureDensity.value=settings.textureDensity??1;
    if(spec.id==='golden-chain-rain')settings.spriteChains=typeof settings.spriteChains==='boolean'?settings.spriteChains:true;else delete settings.spriteChains;
    uniforms.uSpriteChains.value=settings.spriteChains?1:0;
    settings.size=spec.sizeRange
      ?THREE.MathUtils.clamp(Number.isFinite(settings.size)?settings.size:spec.sizeRange.default,spec.sizeRange.min,spec.sizeRange.max)
      :THREE.MathUtils.clamp(Number(settings.size)||1,.25,2);
    settings.density=THREE.MathUtils.clamp(Number(settings.density)||0.125,0.125,1);
    if(!/^#[0-9a-f]{6}$/i.test(settings.color))settings.color=spec.color;
    uniforms.uColor.value.set(settings.color);
    const desired=Math.max(1,Math.round(cap*settings.density));
    const fixedBillows=kind===3&&variant===2?7:kind===3&&(variant===4||variant===6)?12:kind===4&&toon&&variant===1?22:0;
    let remaining=desired-fixedBillows;count=fixedBillows;
    for(let i=allocations.length-1;i>=0;i--){
      const item=allocations[i];
      if(spec.id==='golden-chain-rain'&&item.geometry.userData.goldenChainImpactChips){
        item.geometry.instanceCount=3*settings.quantity*Math.round(24*settings.density);
        count+=item.geometry.instanceCount;continue;
      }
      const n=i===0?remaining:Math.min(item.maximum,Math.round(desired*item.weight));
      const instances=spec.id==='golden-chain-rain'&&item.geometry.userData.goldenChainCrackChips?n*8:n;
      item.geometry.instanceCount=instances;remaining-=n;count+=instances;
    }
    settings.speed=THREE.MathUtils.clamp(Number(settings.speed)||1,0.25,2);
    settings.detail=spec.detailRange
      ?THREE.MathUtils.clamp(Number.isFinite(settings.detail)?settings.detail:spec.detailRange.default,spec.detailRange.min,spec.detailRange.max)
      :THREE.MathUtils.clamp(Number(settings.detail)||0.25,0.25,2);
    uniforms.uSize.value=settings.size;uniforms.uDetail.value=settings.detail;uniforms.uDensity.value=settings.density;
    for(const item of coreParts){
      item.object.scale.copy(item.scale);
      for(const axis of item.axes)item.object.scale[axis]*=settings.size;
      item.object.position.copy(item.position);
      if(item.pivot)item.object.position.y+=item.pivot*(1-settings.size);
    }
    if(endpoints)applyEndpoints();
    if(spec.id==='golden-chain-rain')for(const animate of animated)animate();
    syncLifecycle();
  }
  function applyEndpoints(){
    scratch.subVectors(endpoints.end,endpoints.start);const length=scratch.length();
    group.position.copy(endpoints.start).add(endpoints.end).multiplyScalar(0.5);
    if(length>0)group.quaternion.setFromUnitVectors(axis,scratch.normalize());
    group.scale.set(length/4.8,1,1);
    uniforms.uStretch.value=Math.max(0.001,length/4.8);
    group.visible=length>0;
  }
  function syncLifecycle(){
    if(spec.burst){
      phase=time+1e-9>=spec.duration?'finished':time+1e-9>=spec.duration-lifecycle.end?'ending':time+1e-9>=lifecycle.start?'active':'starting';
    }else if(stopTime>=0){phase=endTime+1e-9>=(impact?(lifecycle.hitEnd??lifecycle.end):lifecycle.end)?'finished':'ending';}
    else phase=time+1e-9>=lifecycle.start?'active':'starting';
    const start=stopTime>=0?endStart:Math.min(1,time/lifecycle.start);
    lifeUniforms.uEmitterTime.value=stopTime>=0?stopTime:time;
    lifeUniforms.uLifeStart.value=start;lifeUniforms.uLifeEnd.value=spec.burst?Math.max(0,Math.min(1,(time-(spec.duration-lifecycle.end))/lifecycle.end)):stopTime>=0?Math.min(1,endTime/lifecycle.end):0;
    lifeUniforms.uLifeStage.value=phase==='active'?1:phase==='starting'?0:2;
    lifeUniforms.uImpactAge.value=endTime;
    lifeUniforms.uImpactProgress.value=Math.min(1,endTime/(lifecycle.hitEnd??lifecycle.end));
    lifeUniforms.uLifeOrigin.value=endStart;lifeUniforms.uStopTime.value=stopTime;lifeUniforms.uImpact.value=impact?1:0;
    for(const m of stageOpaque){m.transparent=phase!=='active';m.depthWrite=phase==='active';}
    for(const p of stagePlanes)p.geometry.setDrawRange(phase==='active'?0:p.steady,phase==='active'?p.steady:p.transition);
    group.visible=phase!=='finished'&&(!endpoints||endpoints.start.distanceToSquared(endpoints.end)>0);
    if(impactMesh){impactMesh.visible=impact&&phase==='ending';impactGlow.visible=impact&&phase==='ending'&&(variant===0?lifeUniforms.uImpactProgress.value<.20/2.0:endTime/lifecycle.end<.28);}
    if(kind===0&&variant===0){
      for(const part of fireFlightParts)part.visible=phase!=='finished'&&(stopTime<0||endTime<lifecycle.end);
      impactMesh.visible=impact&&phase==='ending'&&lifeUniforms.uImpactProgress.value<.72/2.0;
      impactWisps.visible=impact&&phase==='ending';
    }
  }
  function stop(){
    if(disposed||phase==='ending'||phase==='finished'||spec.burst)return;
    endStart=Math.min(1,time/lifecycle.start);stopTime=time;endTime=0;syncLifecycle();
  }
  const hitPoint=new THREE.Vector3(),hitNormal=new THREE.Vector3(),worldToHit=new THREE.Matrix4(),hitPlaneMatrix=new THREE.Matrix3();
  // Default contact is the animated leading surface, not the group origin.
  // Evaluated only on hit: no per-frame geometry walk or particle updates.
  function projectileContact(out){
    const size=settings.size;
    if(variant===0){
      out.set(.65+(.46+Math.sin(time*4.1)*.035)*size,Math.sin(5+time*3)*.03*size,Math.cos(7+time*2.7)*.03*size);
    }else if(variant===1)out.set(.85+.85*size,0,0);
    else if(variant===2)out.set(.85+.93*size,0,0);
    else if(variant===3){
      // Select the actual foremost surface, including side tips during assembly.
      const quantity=settings.quantity??3,spread=settings.spread??1;
      const start=Math.min(1,time/lifecycle.start),curl=1-start*start*(3-2*start);
      let best=-Infinity;
      for(let i=0;i<quantity;i++){
        const a=i*(quantity===3?2.094395:Math.PI*2/quantity)-time*3;
        const cx=.85+Math.sin(a*2)*.09*size,cy=Math.cos(a)*.26*size*spread,cz=Math.sin(a)*.26*size*spread;
        for(let tip=0;tip<6;tip++){
          const axis=Math.floor(tip/2),sign=tip%2?-1:1;
          let x=cx+(axis===0?sign*.182*size:0),y=cy+(axis===1?sign*.078*size:0),z=cz+(axis===2?sign*.078*size:0);
          y*=1+curl*.8;z*=1+curl*.8;x+=Math.sin(y*7)*curl*.4;
          if(x>best){best=x;out.set(x,y,z);}
        }
      }
      return out;
    }else if(variant===4){
      // Rotating crystal wheel: select the foremost tooth, or the outer rim.
      out.set(.81*size,0,0);
      for(let i=0;i<9;i++){const a=i*Math.PI*2/9-time*4,r=.99+(i%3)*.035,x=Math.cos(a)*r*size;if(x>out.x)out.set(x,Math.sin(a)*r*size,.02*size);}
      const turn=-.15*Math.sin(time*2),y=out.y;out.y=y*Math.cos(turn);out.z+=y*Math.sin(turn);
    }else if(variant===5)out.set(.9*size,-.2*size*Math.cos(time*2.7),.2*size*Math.sin(time*2.7));
    else if(variant===6)out.set(1.11*size,0,0);
    else out.set(size,0,0);
    if(time<lifecycle.start){
      const start=time/lifecycle.start,grow=start*start*(3-2*start),curl=1-grow;
      if(variant===0){out.y*=.22+.78*grow;out.z*=.22+.78*grow;out.x=(out.x*.38-.16)*(1-grow)+out.x*grow;out.y+=Math.sin(out.x*4.5+start*7)*curl*.15;}
      else if(variant===1){out.x*=1.3-.3*grow;out.y*=.08+.92*grow;out.z*=.08+.92*grow;}
      else if(variant===2||variant===4){const assemble=Math.ceil((Math.atan2(out.z,out.y)+Math.PI)*3)*.028;out.y*=1+curl*(.8+assemble);out.z*=1+curl*(.8+assemble);out.x-=curl*(.2+assemble);}
      else if(variant===3){out.y*=1+curl*.8;out.z*=1+curl*.8;out.x+=Math.sin(out.y*7)*curl*.4;}
      else if(variant===5){out.z+=Math.sin(out.x*4)*curl*.75;out.x-=curl*.5;}
    }
    return out;
  }
  function hit(position,normal){
    if(kind!==0||disposed||phase==='ending'||phase==='finished')return;
    if(position&&(!Number.isFinite(position.x)||!Number.isFinite(position.y)||!Number.isFinite(position.z)))return;
    projectileContact(impactMesh.position);
    if(position){
      hitPoint.copy(position);if(group.parent){group.parent.updateWorldMatrix(true,false);group.parent.worldToLocal(hitPoint);}
      scratch.copy(impactMesh.position).multiply(group.scale).applyQuaternion(group.quaternion);
      group.position.copy(hitPoint).sub(scratch);
    }
    impactGlow.position.copy(impactMesh.position);
    group.updateWorldMatrix(true,false);worldToHit.copy(group.matrixWorld).invert();
    if(normal)hitNormal.copy(normal);else hitNormal.copy(axis).transformDirection(group.matrixWorld).negate();
    if(!Number.isFinite(hitNormal.lengthSq())||hitNormal.lengthSq()<1e-10)hitNormal.copy(axis).transformDirection(group.matrixWorld).negate();
    hitNormal.transformDirection(worldToHit);
    // Fire recoil follows the incoming projectile, independently of the surface normal.
    impactMesh.quaternion.setFromUnitVectors(axis,variant===0?scratch.set(-1,0,0):hitNormal);
    if(variant===0){
      const hasSurface=normal&&Number.isFinite(normal.x)&&Number.isFinite(normal.y)&&Number.isFinite(normal.z)&&(normal.x*normal.x+normal.y*normal.y+normal.z*normal.z)>1e-10;
      impactWisps.position.copy(impactMesh.position);impactWisps.quaternion.copy(impactMesh.quaternion);
      impactMesh.material.uniforms.uImpactSurface.value=hasSurface?1:0;
      impactMesh.updateWorldMatrix(true,false);worldToHit.copy(impactMesh.matrixWorld).invert();
      impactMesh.material.uniforms.uImpactUp.value.set(0,1,0).transformDirection(worldToHit);
      if(hasSurface){hitPlaneMatrix.setFromMatrix4(impactMesh.matrixWorld).transpose();impactMesh.material.uniforms.uImpactPlaneNormal.value.copy(normal).applyMatrix3(hitPlaneMatrix).normalize();}
    }
    impact=true;stop();
  }
  function update(dt){
    if(disposed||!Number.isFinite(dt)||dt<0||phase==='finished')return;
    const visual=dt*settings.speed;
    // One-shot airbursts finish at a finite boundary, even for a huge finite dt.
    time=spec.id==='billowing-airburst'?Math.min(spec.duration,time+visual):time+visual;uniforms.uTime.value=time;
    if(stopTime>=0)endTime+=visual;
    if(kind===0&&travelSpeed&&stopTime<0)group.position.addScaledVector(direction,dt*travelSpeed);
    for(const animate of animated)animate();syncLifecycle();
  }
  function reset(replay={}){
    if(disposed)return;
    if(variation){
      if(replay.variationSeed!==undefined&&(!Number.isInteger(replay.variationSeed)||replay.variationSeed<0||replay.variationSeed>4294967295))throw new RangeError('variationSeed must be an unsigned 32-bit integer');
      variation.seed=replay.variationSeed??((variation.seed+0x9e3779b9)>>>0);variation.reset();
    }
    time=0;endTime=0;stopTime=-1;impact=false;endStart=1;phase='starting';
    uniforms.uTime.value=0;if(impactMesh){impactMesh.position.set(0,0,0);impactGlow.position.set(0,0,0);}syncLifecycle();update(0);
  }
  // Prepare during loading with the playback renderer; reset reuses this instance.
  function prewarm(renderer,camera){
    if(disposed||!variation)return;
    const visible=[];group.traverse(o=>{visible.push([o,o.visible]);o.visible=true;});
    const previousTime=uniforms.uTime.value,target=renderer.getRenderTarget();
    const face=renderer.getActiveCubeFace(),mip=renderer.getActiveMipmapLevel();
    const autoClear=renderer.autoClear,xr=renderer.xr.enabled;
    const scratchTarget=new THREE.WebGLRenderTarget(1,1);
    try{
      uniforms.uTime.value=.08;group.updateWorldMatrix(true,true);
      renderer.xr.enabled=false;
      // Compile for the real output; the offscreen draw also uploads all buffers.
      renderer.compile(group,camera);
      renderer.setRenderTarget(scratchTarget);renderer.autoClear=true;
      renderer.render(group,camera);
    }finally{
      uniforms.uTime.value=previousTime;
      for(const [object,value] of visible)object.visible=value;
      renderer.setRenderTarget(target,face,mip);renderer.autoClear=autoClear;renderer.xr.enabled=xr;
      scratchTarget.dispose();
    }
  }
  function dispose(){
    if(disposed)return;disposed=true;phase='finished';group.visible=false;group.removeFromParent();
    for(const geometry of geometries)geometry.dispose();
    for(const material of materials)material.dispose();
    geometries.clear();materials.clear();group.clear();
  }
  setOptions(settings);update(0);
  const result = {
    group,update,setOptions,reset,dispose,stop,hit,
    ...(variation?{prewarm}:{}),
    get variationSeed(){return variation?.seed;},
    get settings(){return {...settings};},get particleCount(){return count;},
    get elapsed(){return time;},get phase(){return phase;},get finished(){return phase==='finished';},
    get lifecycle(){return {...lifecycle};},
    setDirection(vector,speed=4){
      if(kind!==0||disposed||phase==='ending'||phase==='finished'||!vector||!Number.isFinite(vector.lengthSq())||vector.lengthSq()===0)return;
      direction.copy(vector).normalize();travelSpeed=Math.max(0,Number(speed)||0);
      group.quaternion.setFromUnitVectors(axis,direction);
    },
    setEndpoints(start,end){
      if(kind!==1||disposed||phase==='ending'||phase==='finished')return;
      endpoints={start:start.clone(),end:end.clone()};applyEndpoints();
    },
  };
  return spec.id==='fireball'?upgradeFireball(THREE,result):result;
}

// Shared by the live gallery and standalone exports. No external textures or CPU particle loop.
function buildUtilityEffect(ctx) {
  const { THREE, kind, variant, cap, mesh, instanced, shader, output } = ctx;
  const key = `${kind}:${variant}`;
  const keys = ['6:0','3:8','7:0','7:1','8:0','1:5','3:9','3:10','1:6',null,'6:1'];
  const effect = keys.indexOf(key);
  if (effect < 0) return false;
  const TAU = Math.PI * 2;
  const parts = [];
  const add = (geometry, center = [0,0,0], data = [0,0,0,0], unit = -1) => {
    geometry.translate(...center); parts.push({geometry,center,data,unit});
  };
  function merged(source = parts) {
    const positions=[], normals=[], uvs=[], centers=[], data=[], units=[];
    for (const item of source) {
      const geo=item.geometry.index ? item.geometry.toNonIndexed() : item.geometry;
      const pos=geo.attributes.position, norm=geo.attributes.normal, uv=geo.attributes.uv;
      for(let i=0;i<pos.count;i++) {
        positions.push(pos.getX(i),pos.getY(i),pos.getZ(i));
        normals.push(norm.getX(i),norm.getY(i),norm.getZ(i));
        uvs.push(uv?.getX(i)??0,uv?.getY(i)??0);
        centers.push(...item.center);data.push(...item.data);units.push(item.unit??-1);
      }
      if(geo!==item.geometry)geo.dispose();item.geometry.dispose();
    }
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geo.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
    geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
    geo.setAttribute('aCenter',new THREE.Float32BufferAttribute(centers,3));
    geo.setAttribute('aData',new THREE.Float32BufferAttribute(data,4));
    geo.setAttribute('aUnit',new THREE.Float32BufferAttribute(units,1));
    return geo;
  }
  function facet(sx,sy,sz) { return new THREE.OctahedronGeometry(1,0).scale(sx,sy,sz); }
  function arc(inner,outer,start,end,height,depth,segments=32,vertical=false) {
    const pos=[],uv=[];
    const point=(r,a,y)=>vertical?[y,Math.cos(a)*r*height,Math.sin(a)*r]:[Math.cos(a)*r,y,Math.sin(a)*r];
    const tri=(a,b,c,ua,ub,uc)=>{pos.push(...a,...b,...c);uv.push(...ua,...ub,...uc);};
    for(let i=0;i<segments;i++) {
      const t=i/segments,n=(i+1)/segments,a=start+(end-start)*t,b=start+(end-start)*n;
      const a0=point(inner,a,-depth/2),a1=point(outer,a,-depth/2),a2=point(outer,a,depth/2),a3=point(inner,a,depth/2);
      const b0=point(inner,b,-depth/2),b1=point(outer,b,-depth/2),b2=point(outer,b,depth/2),b3=point(inner,b,depth/2);
      for(const [q,r,s,v] of [[a0,b0,b1,a1],[a1,b1,b2,a2],[a2,b2,b3,a3],[a3,b3,b0,a0]]) {
        tri(q,r,s,[t,0],[n,0],[n,1]);tri(q,s,v,[t,0],[n,1],[t,1]);
      }
      if(i===0){tri(a0,a1,a2,[t,0],[t,1],[t,1]);tri(a0,a2,a3,[t,0],[t,1],[t,0]);}
      if(i===segments-1){tri(b0,b2,b1,[n,0],[n,1],[n,1]);tri(b0,b3,b2,[n,0],[n,0],[n,1]);}
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.computeVertexNormals();return geo;
  }
  function segment(a,b,r=.025,sides=5) {
    const va=new THREE.Vector3(...a),vb=new THREE.Vector3(...b),d=vb.clone().sub(va);
    const geo=new THREE.CylinderGeometry(r,r,d.length(),sides,1,false);
    geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()));
    geo.translate(...va.add(vb).multiplyScalar(.5).toArray());return geo;
  }
  const common = `
    uniform float uTime,uLifeStart,uLifeEnd,uLifeOrigin,uStopTime,uEndDuration,uStretch,uQuantity,uSpread;
    float sat(float a){return clamp(a,0.0,1.0);}
    float ease(float a){a=sat(a);return 1.0-pow(1.0-a,3.0);}
    float fadeEnd(){return 1.0-smoothstep(.58,1.0,uLifeEnd);}
    float grow(){return smoothstep(0.0,1.0,uLifeStart);}
    mat2 turn(float a){return mat2(cos(a),-sin(a),sin(a),cos(a));}
    float rand(float n){return fract(sin(n*127.1+311.7)*43758.5453);}
  `;
  function material(deform,fragment='',additive=false) {
    const vertex=`${common}
      attribute vec3 aCenter;attribute vec4 aData;attribute float aUnit;
      varying vec2 vUv;varying vec3 vN,vP;varying float vAlpha,vTone,vPart;
      void main(){
        vec3 p=position,c=aCenter,q=p-c;vec3 n=normal;
        vUv=uv;vAlpha=1.0;vTone=aData.w;vPart=aData.x;
        ${deform}
        vP=p;vN=normalize(normalMatrix*n);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);
      }`;
    const frag=`${common}
      uniform float uSize;uniform vec3 uColor;varying vec2 vUv;varying vec3 vN,vP;varying float vAlpha,vTone,vPart;
      void main(){
        float light=dot(normalize(vN),normalize(mat3(viewMatrix)*vec3(-.4,.8,.55)))*.5+.5;
        float shade=mix(.28,.82,smoothstep(.38,.41,light));shade=mix(shade,1.16,smoothstep(.7,.73,light));
        vec3 color=mix(uColor*shade,mix(uColor,vec3(1.0),.7),clamp(vTone,0.0,1.0));
        if(vTone<0.0)color=mix(uColor*.13,vec3(.10,.12,.14),.65)*(.65+shade*.4);
        float alpha=vAlpha;
        ${fragment}
        if(alpha<.003)discard;
        gl_FragColor=vec4(color,clamp(alpha,0.0,1.0));${output}
      }`;
    const mat=shader(frag,vertex,{},additive);mat.userData.ownLifecycle=true;return mat;
  }
  function body(deform,fragment='',name='utility-body',source=parts,additive=false) {
    const obj=mesh(merged(source),material(deform,fragment,additive),1);obj.name=name;return obj;
  }
  // Every effect keeps its structural silhouette independent of the density slider.
  if(effect===10) {
    // Stretch-out and the 3D impact share one trigger, including standalone exports.
    const impactTiming='const float REND_RELEASE=1.0; const float REND_EXIT=1.2;';
    // Shared deterministic path functions keep the cuts, halos and debris aligned.
    // Solid rifts occupy 3D space; the soft halos align with the view around each cut axis.
    const paths=`
      ${impactTiming}
      uniform float uTime,uQuantity,uSpread,uPanelCount;
      float rh(float n){return fract(sin(n*127.1+${((ctx.spec.seed%997)/997*73).toFixed(8)})*43758.5453);}
      float rl(float i){return 1.35+rh(i+71.0)*2.05;}
      float rw(float i){return .036+rh(i+89.0)*.024;}
      // Seeded per-cut height and apex skew: narrow needles, broad wedges and
      // oblique triangles, independently scattered without animated jitter.
      vec2 rendPanel(float i,float x,float side){
        float taper=(1.0-x)*.5;
        float height=(rw(i)*18.0+.18)*mix(.117,.5,rh(i+151.0));
        float skew=mix(-.65,1.65,rh(i+173.0));
        return vec2(x+side*taper*skew,side*taper*height);
      }
      float rb(float i){return .2+.36*i/max(1.0,uQuantity-1.0);}
      mat3 rf(float i){
        float a=i<.5?.38:rh(i+109.0)*6.283185;
        float tilt=i<.5?.12:(rh(i+93.0)-.5)*2.4,twist=(rh(i+19.0)-.5)*2.6;
        vec3 d=normalize(vec3(cos(a),sin(a),tilt)),s=normalize(cross(vec3(0.0,0.0,1.0),d)),n=cross(d,s);
        s=s*cos(twist)+n*sin(twist);return mat3(d,s,cross(d,s));
      }
      vec3 rc(float i){
        vec3 c=vec3(rh(i+11.0)-.5,0.0,rh(i+57.0)-.5)*vec3(3.6,0.0,2.8)*uSpread;
        if(i<.5)c.xz=vec2(0.0);
        // The local origin is the ground anchor. Each cut's lower end stays
        // close to it, including when the caller changes size or spread.
        c.y=abs(rf(i)[0].y)*rl(i)*uSize+(i<.5?.04*uSize:.10*uSize+rh(i+31.0)*.45*uSpread);
        return c;
      }
      // Separate seeded positions: panels no longer share a blade's anchor.
      vec3 rendPanelCenter(float i){
        vec3 c=vec3((rh(i+211.0)-.5)*3.6,0.0,(rh(i+239.0)-.5)*2.8)*uSpread;
        c.y=abs(rf(i)[0].y)*rl(i)*uSize+(.03+rh(i+263.0)*.42)*uSize;
        return c;
      }
      // Independent, lifetime-stable triangle proportions for each debris seed.
      float rendShardScale(vec4 seed){
        return seed.w<.58?mix(.9,1.2,seed.z):mix(.2,.4,seed.z);
      }
      vec3 rendShardShape(vec4 seed){
        float lengthScale=mix(.65,2.4,rh(seed.x*997.0+307.0));
        float widthScale=mix(.2,1.4,rh(seed.y*997.0+331.0));
        float apex=mix(-1.4,1.4,rh(seed.z*997.0+359.0))*.577350269*lengthScale;
        return vec3(lengthScale,widthScale,apex);
      }
      // Positive top width gives a convex trapezoid; zero merges the top
      // corners into the original triangular apex. Seed choice never changes.
      vec3 rendShardVertex(vec2 corner,vec3 shape,vec4 seed){
        float top=step(0.0,corner.y);
        float topWidth=seed.x<.5?0.0:mix(.35,1.1,rh(seed.w*997.0+383.0));
        return vec3(corner.x*shape.x*mix(1.0,topWidth,top)+top*shape.z,corner.y*shape.y,0.0);
      }
      float rendShardRadius(vec3 shape,vec4 seed){
        float h=.577350269;
        return max(max(length(rendShardVertex(vec2(-h,-h),shape,seed)),length(rendShardVertex(vec2(h,-h),shape,seed))),
          max(length(rendShardVertex(vec2(h,h),shape,seed)),length(rendShardVertex(vec2(-h,h),shape,seed))));
      }
      vec3 rendCenter(){
        vec3 center=vec3(0.0);
        // Keep the index uniform-driven like the cuts. Some drivers fold sin()
        // differently for literal loop indices, which changes the seeded hash.
        for(int j=0;j<32;j++){float index=uQuantity-1.0-float(j);if(index<0.0)break;center+=rc(index);}
        return center/max(1.0,uQuantity);
      }
    `;
    // MeshPhysicalMaterial opts into Three.js' shared opaque-scene transmission
    // pass. Only the GLSL is replaced; the renderer owns its texture and lifetime.
    // Keep readable shader fields for the source inspector and standalone builder.
    function spatialMaterial(fragmentShader,vertexShader,defines={}) {
      const mat=new THREE.MeshPhysicalMaterial({transmission:1,roughness:0,metalness:0,transparent:true,depthWrite:false,side:THREE.FrontSide});
      mat.uniforms={...ctx.uniforms,...ctx.lifeUniforms};
      mat.defines={...mat.defines,...defines};
      mat.vertexShader='uniform float uSize;\n'+vertexShader;
      mat.fragmentShader='uniform float uDetail;\n'+fragmentShader;
      mat.onBeforeCompile=program=>{Object.assign(program.uniforms,mat.uniforms);program.vertexShader=mat.vertexShader;program.fragmentShader=mat.fragmentShader;mat.userData.transmissionUniforms=program.uniforms;};
      mat.customProgramCacheKey=()=>mat.vertexShader+'\n'+mat.fragmentShader;
      mat.userData.ownLifecycle=true;ctx.materials.add(mat);return mat;
    }
    const spatialSampling=`
      uniform sampler2D transmissionSamplerMap;uniform vec2 transmissionSamplerSize;
      varying vec4 vScreen;varying vec2 vShift;
      vec4 displacedScene(float strength){
        vec2 uv=vScreen.xy/vScreen.w*.5+.5;
        vec2 resolution=max(transmissionSamplerSize,vec2(1.0));
        vec2 direction=vShift*resolution;
        direction=length(direction)>.0001?normalize(direction):vec2(1.0,0.0);
        // A bounded screen-space shift fades near viewport edges instead of
        // clamping a whole strip to one pixel. No wrapping or feedback sampling.
        vec2 inset=.5/resolution;
        float edge=max(0.0,min(min(uv.x-inset.x,1.0-inset.x-uv.x),min(uv.y-inset.y,1.0-inset.y-uv.y)));
        float amount=.032*clamp(uDetail,.25,2.0)*strength;
        // Larger offsets need a wider viewport guard; stay inside the sampled
        // scene instead of stretching the last row/column across a shard.
        amount*=smoothstep(0.0,max(.08,abs(amount)*1.25),edge);
        vec2 delta=direction*min(resolution.x,resolution.y)/resolution*amount;
        return texture2D(transmissionSamplerMap,clamp(uv+delta,inset,1.0-inset));
      }
    `;
    const vertex=`${paths}
      attribute float aUnit;attribute vec4 aData;varying float vEcho;varying float vBand,vTaper,vAlong,vAlpha,vAge,vExit;varying vec2 vUv;varying vec4 vScreen;varying vec2 vShift;
      void main(){
        float i=aUnit,localTime=uTime;vEcho=0.0;
        #if REND_GLOW == 1
          vEcho=aData.x;localTime-=vEcho*.12;
          // Hold the closing pose while the single trace fades independently.
          if(vEcho>.5)localTime=min(localTime,REND_RELEASE+.10);
        #endif
        float age=localTime-rb(i),sweep=smoothstep(0.0,.06,age),exitProgress=smoothstep(REND_RELEASE,REND_EXIT,localTime);
        float activeCount=uQuantity;
        #if REND_GLOW == 0
          activeCount=uPanelCount;age=uTime-(.2+.36*i/max(1.0,uPanelCount-1.0));sweep=smoothstep(0.0,.06,age);
        #endif
        float alive=step(i+.5,activeCount)*step(0.0,age)*(1.0-step(REND_EXIT,localTime));
        vUv=uv;vBand=position.y;vAlong=(position.x+1.0)*.5;vAge=age;vExit=exitProgress;vAlpha=alive;
        vec3 q=position;
        #if REND_GLOW == 1
          float guide=step(i+.5,uQuantity)*step(i,2.0)*smoothstep(.01,.10,uTime)*(1.0-smoothstep(.14,.2,uTime));
          guide*=1.0-step(.5,vEcho);
          vAlpha=max(alive,guide*.24);
          if(vEcho>.5){vAlpha*=smoothstep(.98,1.03,uTime)*.65;vExit=smoothstep(1.15,1.9,uTime);}
          if(age<0.0)sweep=1.0;
        #endif
        q.x=mix(-1.0,sweep*2.0-1.0,vAlong);
        float taper=pow(max(0.0,1.0-q.x*q.x),.7);
        // The light keeps its needle profile. The distortion window has three
        // straight edges and an independently scattered position.
        float spatialTaper=(1.0-q.x)*.5;
        vBand=position.y*taper;vTaper=taper;
        #if REND_GLOW == 0
          vBand=(position.y+1.0)*spatialTaper;
        #endif
        mat3 frame=rf(i);
        float anchor=frame[0].y>=0.0?-1.0:1.0;
        #if REND_GLOW == 0
          q.xy=rendPanel(i,q.x,position.y+1.0);
        #endif
        q.x=(anchor+(q.x-anchor)*(1.0+.8*exitProgress))*rl(i);
        #if REND_GLOW == 1
          q.yz*=rw(i)*5.5*.375*taper;if(vEcho>.5)q.yz*=1.5;if(age<0.0)q.yz*=.10;
        #else
          q.z*=.008*spatialTaper;q*=2.0;
        #endif
        #if REND_GLOW == 1
          // Only the soft halo faces the camera; its axis and depth follow the 3D cut.
          vec4 mv=modelViewMatrix*vec4(rc(i)+(frame[0]*q.x)*uSize,1.0);
          vec3 direction=mat3(modelViewMatrix)*frame[0];vec2 across=normalize(vec2(-direction.y,direction.x)+vec2(.00001,0.0));
          mv.xy+=across*q.y*uSize*length(modelViewMatrix[1].xyz);gl_Position=projectionMatrix*mv;
        #else
          gl_Position=projectionMatrix*modelViewMatrix*vec4(rendPanelCenter(i)+rf(i)*q*uSize,1.0);
        #endif
        vScreen=gl_Position;vShift=(projectionMatrix*vec4(mat3(modelViewMatrix)*frame[0],0.0)).xy;
      }`;
    for(let i=0;i<32;i++)add(new THREE.BoxGeometry(2,2,2,16,1,1),[0,0,0],[0,0,0,0],i);
    const coreMaterial=spatialMaterial(`${spatialSampling}
      varying float vAlpha,vAge,vExit;
      void main(){
        if(vAlpha<.003)discard;
        float reveal=smoothstep(0.0,.04,vAge),fade=1.0-vExit;
        vec4 background=displacedScene(2.0*reveal*fade);
        float alpha=vAlpha*fade*fade;
        if(alpha<.003)discard;
        // This pass only displaces the opaque background. All blade light is
        // supplied by the existing additive glow mesh in the transmission input.
        gl_FragColor=vec4(background.rgb,alpha*background.a);${output}
      }`,vertex,{REND_GLOW:0});
    mesh(merged(),coreMaterial,0).name='utility-rend-cuts';
    // One delayed trace stays on the original blade axis and shares its draw pass.
    const halos=[];for(let echo=0;echo<2;echo++)for(let i=0;i<32;i++)halos.push({geometry:new THREE.PlaneGeometry(2,2,echo?8:16,1),center:[0,0,0],data:[echo,0,0,0],unit:i});
    const glowMaterial=shader(`uniform vec3 uColor;varying float vEcho,vBand,vTaper,vAlpha,vAge,vExit;
      void main(){if(vAlpha<.003)discard;float radial=abs(vBand)/max(.00001,vTaper)*5.5;
        float halo=(exp(-pow((radial-1.02)*1.3,2.0))*.60+exp(-pow((radial-1.0)*.53,2.0))*.16)*smoothstep(.73,1.10,radial);
        // The blade and halo are captured together for spatial sampling.
        // Opaque foreground geometry still depth-occludes the light.
        float distanceToBlade=abs(vBand)-(.65/5.5)*max(vTaper,0.0);
        float aa=clamp(fwidth(distanceToBlade),.0001,.5/5.5);
        float blade=(1.0-smoothstep(-aa,aa,distanceToBlade))*step(.001,vTaper);
        float alpha=max(halo*(.55+.45*uDetail),blade)*vAlpha*pow(1.0-vExit,vEcho>.5?1.0:2.0);
        vec3 color=mix(uColor,mix(uColor,vec3(1.0),vEcho>.5?.55:.88)*1.35,blade);
        if(alpha<.003)discard;gl_FragColor=vec4(color,alpha);${output}
      }`,vertex,{},true,{REND_GLOW:1});glowMaterial.userData.ownLifecycle=true;
    // Join the opaque-scene capture without becoming a solid surface: Three.js
    // still applies AdditiveBlending, while depthWrite remains false. This lets
    // the native transmission texture contain the blade and halo themselves.
    glowMaterial.transparent=false;
    mesh(merged(halos),glowMaterial,1).name='utility-rend-glow';
    const debris=spatialMaterial(`${spatialSampling}
      uniform vec3 uColor;varying float vAlpha,vTone;
      void main(){
        if(vAlpha<.003)discard;
        vec4 background=displacedScene(5.0*(.65+.65*vTone)*vAlpha);
        // Only the shifted background is visible: no tint, surface lighting or
        // unshifted image blended into the slice. Alpha is for lifetime fade only.
        gl_FragColor=vec4(background.rgb,vAlpha*background.a);${output}
      }`,`${paths}
      attribute vec4 seed;varying float vAlpha,vTone;varying vec4 vScreen;varying vec2 vShift;
      void main(){
        float i=floor(seed.x*uQuantity),impulseAge=max(0.0,uTime-REND_RELEASE),kick=1.0-exp(-5.0*impulseAge);
        vTone=seed.w;vAlpha=smoothstep(0.0,.045,impulseAge)*(1.0-smoothstep(2.2+seed.z*.15,3.4,uTime));
        float shardScale=rendShardScale(seed);
        vec3 shape=rendShardShape(seed);
        vec3 q=rendShardVertex(position.xy,shape,seed)*shardScale;
        float growth=1.0+.65*smoothstep(0.0,.10,impulseAge);q*=growth;
        float a=seed.y*6.283185+(seed.x<.5?-1.0:1.0)*(.7+.5*seed.z)*kick;
        q.xy=mat2(cos(a),-sin(a),sin(a),cos(a))*q.xy;
        mat3 frame=rf(i);
        vec3 p=rc(i)+frame*vec3((seed.y*2.0-1.0)*rl(i),(seed.z-.5)*.15,(seed.w-.5)*.15)*uSize;
        // Reserve the full rotating shard radius at birth. No moving floor clamp,
        // gravity or downward drift: shards hang in space as their impulse slows.
        float radius=rendShardRadius(shape,seed)*shardScale*1.65;
        p.y=max(p.y,(.02+radius)*uSize);
        vec3 direction=p-rendCenter();direction.y=max(0.0,direction.y);
        if(length(direction)<.01*uSize)direction=vec3(cos(seed.x*6.283185),0.0,sin(seed.x*6.283185));
        p+=normalize(direction)*2.2*uSize*kick;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p+frame*q*uSize,1.0);
        vScreen=gl_Position;vShift=(projectionMatrix*vec4(mat3(modelViewMatrix)*frame[0],0.0)).xy*(seed.w<.5?-1.0:1.0);
      }`);
    // Shared quad, two front triangles plus reverse windings. Triangle seeds
    // merge the two top corners, making one triangle degenerate per side.
    // FrontSide ensures only one side contributes to the transmission output.
    const shardGeometry=new THREE.BufferGeometry();
    const h=1/Math.sqrt(3),a=[-h,-h,0],b=[h,-h,0],c=[h,h,0],d=[-h,h,0];
    shardGeometry.setAttribute('position',new THREE.Float32BufferAttribute([...a,...b,...c,...a,...c,...d,...c,...b,...a,...d,...c,...a],3));
    shardGeometry.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,1,1,0,0,1,1,0,1,1,1,1,0,0,0,0,1,1,1,0,0],2));
    shardGeometry.computeVertexNormals();
    const shards=instanced(shardGeometry,Math.min(cap,128),1,debris,1);shards.name='utility-rend-particles';
    const cuts=ctx.group.getObjectByName('utility-rend-cuts'),light=ctx.group.getObjectByName('utility-rend-glow');
    ctx.animated.push(()=>{cuts.visible=ctx.uniforms.uPanelCount.value>0&&ctx.uniforms.uTime.value>=.2&&ctx.uniforms.uTime.value<1.2;light.visible=ctx.uniforms.uTime.value>0&&ctx.uniforms.uTime.value<1.9;shards.visible=ctx.uniforms.uTime.value>1.0&&ctx.uniforms.uTime.value<3.4;});
    // Only a brief local spark is added. The existing irregular shards carry
    // the explosion; there is no expanding sphere or planar shock ring.
    const impact=shader(`
      uniform vec3 uColor;
      varying vec2 vLocal;varying float vAlpha;
      void main(){
        if(vAlpha<.003)discard;
        float diamond=abs(vLocal.x)+abs(vLocal.y)*1.15;
        float core=1.0-smoothstep(.03,.28,diamond);
        float halo=pow(max(0.0,1.0-diamond),2.0);
        float alpha=vAlpha*(core*.75+halo*.65)*(.75+.25*uDetail);
        vec3 color=mix(uColor,vec3(1.0),core*.86);
        if(alpha<.003)discard;gl_FragColor=vec4(color,clamp(alpha,0.0,1.0));${output}
      }`,`
      ${paths}
      varying vec2 vLocal;varying float vAlpha;
      void main(){
        vLocal=position.xy;
        vAlpha=smoothstep(REND_RELEASE,REND_RELEASE+.025,uTime)*(1.0-smoothstep(REND_RELEASE+.08,REND_RELEASE+.18,uTime));
        vec4 mv=modelViewMatrix*vec4(rendCenter(),1.0);
        mv.xy+=position.xy*.8*uSize*length(modelViewMatrix[1].xyz);
        gl_Position=projectionMatrix*mv;
      }`,{},true);
    impact.userData.ownLifecycle=true;
    mesh(new THREE.PlaneGeometry(2,2),impact,1).name='utility-rend-impact';
    return true;
  }
  if(effect===0) {
    // Joined while cutting; individual thick sections peel away from the trailing edge.
    for(let i=0;i<9;i++) {
      const a=-1.15+i*2.3/9,b=-1.15+(i+1)*2.3/9,m=(a+b)/2;
      const center=[Math.cos(m)*1.7,.1,Math.sin(m)*1.7];
      for(const [inner,outer,depth,tone] of [[1.35,2.02,.13,.16],[1.95,2.07,.09,.88]]) {
        const geometry=arc(inner,outer,a,b,1,depth,5).translate(0,.1,0);
        parts.push({geometry,center,data:[i/8,m,0,tone]});
      }
      if(i<7){const geometry=arc(1.10,1.19,a,b,1,.055,4).translate(0,.25,0);parts.push({geometry,center:[Math.cos(m)*1.15,.25,Math.sin(m)*1.15],data:[i/8,m,1,.55]});}
    }
    body(`
      float t=uTime/.65,sw=ease(t/.62),angle=-1.10+sw*1.82;
      float release=.27+aData.x*.17,peel=ease((uTime-release)/.16);
      p=c+q*(1.0-peel*.68);p.xz+=vec2(cos(aData.y),sin(aData.y))*peel*.32;
      p.y-=peel*peel*.34;p.y+=sin((aData.x+vUv.x/9.0)*3.14159)*.12;
      p.xz=turn(angle-peel*.13)*p.xz;n.xz=turn(angle-peel*.13)*n.xz;p*=uSize;
      float along=(aData.x*8.0+vUv.x)/9.0;
      vAlpha=smoothstep(-.04,.04,sw-along*.72)*smoothstep(0.0,.055,t)*(1.0-smoothstep(release+.09,release+.20,uTime));
    `,`color+=uColor*.055*pow(.5+.5*sin((vPart+vUv.x/9.0)*(16.0+uDetail*26.0)),10.0);`);
  } else if(effect===1) {
    for(let i=0;i<13;i++) {
      const x=-2.25+i*.36,z=Math.sin(i*2.2)*.19+Math.sin(i*.79)*.14;
      const next=[x+.37,.016,Math.sin((i+1)*2.2)*.19+Math.sin((i+1)*.79)*.14];
      const strip=segment([x,.016,z],next,.038+(i%3)*.007,4);add(strip,[0,0,0],[i/12,0,0,.8]);
      for(let side=-1;side<=1;side+=2) {
        const salt=i*2+(side===1?1:0), jitter=Math.sin(salt*7.3)*.11;
        const geo=new THREE.DodecahedronGeometry(1,0).scale(.15+(salt%4)*.045,.12+(salt%3)*.055,.18+(salt%5)*.035);
        geo.rotateZ(jitter*2.3);geo.rotateY(salt*1.71);geo.rotateX(jitter*1.5);
        add(geo,[x+jitter,.09,z+side*(.22+(salt%3)*.095)],[i/12,side,1,-1],i);
        if((i+side)%3!==0){
          const tip=[.10+jitter,.026,side*(.30+(salt%4)*.12)];
          add(segment([0,0,0],tip,.018,4),[x,.033,z],[i/12,side,2,.65]);
          if(i%2===0)add(segment(tip,[tip[0]+.14,tip[1],tip[2]+side*.10],.012,4),[x,.033,z],[i/12,side,2,.55]);
        }
      }
    }
    // Additional rock pairs share the fixed crack path; the crack itself stays intact.
    for(let i=13;i<26;i++)for(let side=-1;side<=1;side+=2) {
      const x=-2.25+i*.36,z=Math.sin(i*2.2)*.19+Math.sin(i*.79)*.14;
      const salt=i*2+(side===1?1:0),jitter=Math.sin(salt*7.3)*.11;
      const geo=new THREE.DodecahedronGeometry(1,0).scale(.15+(salt%4)*.045,.12+(salt%3)*.055,.18+(salt%5)*.035);
      geo.rotateZ(jitter*2.3);geo.rotateY(salt*1.71);geo.rotateX(jitter*1.5);
      add(geo,[x+jitter,.09,z+side*(.22+(salt%3)*.095)],[i/12,side,1,-1],i);
    }
    body(`
      float path=aData.x;
      if(aUnit>=0.0&&uQuantity!=13.0)path=aUnit/max(1.0,uQuantity-1.0);
      float arrival=.1+path*.62,age=uTime-arrival;
      float hit=ease(age/.11),settle=smoothstep(.12,.75,age);
      if(aData.z>.5&&aData.z<1.5){q.xz=turn(aData.y*hit*(1.0-settle)*.27)*q.xz;p=c+q;
        p.y+=sin(sat(age/.72)*3.14159)*(.36+rand(path)*.2);p.z+=aData.y*hit*(1.0-settle)*.15;
        if(uQuantity!=13.0){float index=path*12.0;
          p.x+=(index-aUnit)*.36;
          p.z+=sin(index*2.2)*.19+sin(index*.79)*.14-sin(aUnit*2.2)*.19-sin(aUnit*.79)*.14;}
      }
      p.z*=uSize;p.y*=uSize;
      vAlpha=smoothstep(-.02,.055,age)*(1.0-smoothstep(1.28,1.8,uTime));
      if(aUnit>=0.0)vAlpha*=step(aUnit+.5,uQuantity);
    `,`if(vTone>=0.0){color=mix(uColor,vec3(1.0,.89,.4),.45+.35*sin(vP.x*(5.0+3.0*uDetail)-uTime*9.0));alpha*=.8+.2*sin(vP.x*13.0+uTime*3.0);}`);
  } else if(effect===2||effect===3) {
    const tiles=effect===2?7:4;
    for(let i=0;i<tiles;i++) {
      const angle=(i-1)*TAU/6,rad=i===0?0:.98;
      const front=Math.sqrt(1.18*1.18-rad*rad),normal=new THREE.Vector3(front,Math.cos(angle)*rad,Math.sin(angle)*rad).normalize();
      const center=[front-.28,.9+Math.cos(angle)*rad,Math.sin(angle)*rad];
      const orient=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),normal);
      const geo=new THREE.CylinderGeometry(.51,.51,.17,6,1,false);geo.applyQuaternion(orient);
      add(geo,center,[i/(tiles-1),angle,0,.08],i);
      const inset=new THREE.CylinderGeometry(.425,.425,.026,6,1,false);inset.applyQuaternion(orient);
      add(inset,[center[0]+normal.x*.10,center[1]+normal.y*.10,center[2]+normal.z*.10],[i/(tiles-1),angle,1,.42],i);
    }
    if(effect===3)for(let i=0;i<9;i++) {
      const a=i*TAU/9;const c=[.8,.9+Math.cos(a)*.25,Math.sin(a)*.25];
      const g=facet(.07,.22,.07);g.rotateX(a);add(g,c,[i/9,a,2,.9]);
    }
    if(effect===3){
      add(segment([1.01,.54,0],[1.01,1.26,0],.014,4),[0,0,0],[0,0,3,1]);
      add(segment([1.01,.83,-.31],[1.01,.97,.31],.012,4),[0,0,0],[0,0,3,1]);
    }
    body(effect===2?`
      float start=smoothstep(aData.x*.38,aData.x*.38+.60,uLifeStart);
      float close=smoothstep(aData.x*.16,.83+aData.x*.16,uLifeEnd);
      float visible=start*(1.0-close);
      p=c+q*(.78+.22*visible);p.x+=(1.0-start)*.45+close*.32;
      p.y+=(1.0-start)*cos(aData.y)*.17;p.z+=(1.0-start)*sin(aData.y)*.17;
      p*=uSize;vAlpha=visible*fadeEnd()*step(aUnit+.5,uQuantity);
    `:`
      float t=uTime/.55,pressure=sin(sat(t/.34)*3.14159);
      float rebound=sin(sat((t-.34)/.27)*3.14159);
      float strength=aData.x<.01?.54:.16*(1.0-aData.x*.45);
      p.x-=pressure*strength;p.x+=rebound*strength*.27;
      if(aData.z<1.5){p.y+=(c.y-.9)*pressure*.10;p.z+=c.z*pressure*.10;}
      if(aData.z>1.5&&aData.z<2.5){float spread=ease((t-.25)/.65);p=c+q*(1.0-spread*.6);p.y+=cos(aData.y)*spread*1.0;p.z+=sin(aData.y)*spread*1.0;p.x+=spread*.35;}
      p*=uSize;vAlpha=smoothstep(0.0,.06,t)*(1.0-smoothstep(.52,1.0,t));
      if(aData.z>2.5)vAlpha*=1.0-smoothstep(.08,.22,t);
      if(aUnit>=0.0)vAlpha*=step(aUnit+.5,uQuantity);
    `,effect===2?`float line=pow(.5+.5*sin((vP.y+vP.z*.6)*(10.0+uDetail*8.0)),24.0);color+=uColor*line*.10;`:`color=mix(color,vec3(1.0),.48*(1.0-smoothstep(0.0,.23,uTime)));color+=uColor*.08*pow(.5+.5*sin(vP.y*(10.0+uDetail*12.0)+vP.z*11.0),12.0);`);
  } else if(effect===4) {
    for(let i=0;i<16;i++) {
      const a=i*TAU/16,b=(i+.80)*TAU/16;
      add(arc(.92,1.08,a,b,1.35,.18,3,true),[0,1.45,0],[i/16,a,0,.18]);
      add(arc(.975,1.01,a+.025,b-.025,1.35,.025,3,true),[.107,1.45,0],[i/16,a,1,.92]);
    }
    body(`
      float s=smoothstep(aData.x*.3,aData.x*.3+.64,uLifeStart);
      float e=smoothstep(aData.x*.15,.82+aData.x*.15,uLifeEnd);
      float fold=(1.0-s)*.17+e*.15;p.y-=1.45;p.yz*=1.0+fold;p.y+=1.45;
      p.x+=(1.0-s)*sin(aData.y*2.0)*.28;p*=uSize;
      vAlpha=s*(1.0-e)*fadeEnd();
    `,`color+=uColor*.10*sin(vPart*25.13-uTime*1.4);`,'utility-gate-frame');
    const membrane=new THREE.CircleGeometry(.94,48);membrane.rotateY(Math.PI/2);membrane.scale(1,1.35,1);
    const mp=[{geometry:membrane.translate(0,1.45,0),center:[0,1.45,0],data:[0,0,0,0]}];
    body(`
      float s=grow(),close=1.0-smoothstep(0.0,.82,uLifeEnd);
      p.y-=1.45;p.z*=max(.012,s*close);p.y*=.7+.3*s*close;p.y+=1.45;p*=uSize;
      vAlpha=s*close*fadeEnd();
    `,`
      vec2 q=(vUv-.5)*2.0;float r=length(q);float a=atan(q.y,q.x);
      float swirl=.5+.5*sin(r*(10.0+uDetail*5.0)-a*3.0-uTime*3.25);
      vec2 starUv=(q+vec2(sin(uTime*.08)*.1,uTime*.009))*(12.0+uDetail*2.0);
      vec2 grid=floor(starUv);
      vec2 cell=fract(starUv)-.5;
      float cross=max(pow(max(0.0,1.0-abs(cell.x)*13.0),3.0)*max(0.0,1.0-abs(cell.y)*3.2),pow(max(0.0,1.0-abs(cell.y)*13.0),3.0)*max(0.0,1.0-abs(cell.x)*3.2));
      float star=step(.963,rand(dot(grid,vec2(1.0,71.0))))*cross*(.72+.28*sin(uTime+grid.x));
      color=mix(uColor*.035,uColor*.23,swirl*.17+smoothstep(.55,1.0,r)*.55);
      color+=mix(uColor,vec3(1.0),.8)*star*2.0;alpha*=.50*(1.0-smoothstep(.96,1.0,r));
    `,'utility-star-membrane',mp);
  } else if(effect===5||effect===8) {
    // Canonical endpoints stay at +/-2.4. Only the cross-section responds to size.
    if(effect===5) {
      for(let strand=0;strand<3;strand++) {
        const tube=new THREE.CylinderGeometry(.011,.011,4.8,5,36,true);tube.rotateZ(Math.PI/2);
        add(tube,[0,0,0],[strand/3,strand*TAU/3,0,.25]);
      }
      // Fixed capacity; quantity changes only select and phase the paired heads/tails.
      for(let i=0;i<18;i++) {
        const a=(i%3)*TAU/3;
        const g=new THREE.SphereGeometry(1,8,5);g.scale(.22,.15,.15);add(g,[0,0,0],[i/9,a,1,.68]);
        const tail=new THREE.ConeGeometry(.12,.44,5,1,true);tail.rotateZ(-Math.PI/2);tail.translate(.24,0,0);
        add(tail,[0,0,0],[i/9,a,2,.16]);
      }
      for(let end=0;end<2;end++)for(let i=0;i<5;i++) {
        add(arc(end===0?.27:.16,end===0?.31:.19,i*TAU/5,(i+.7)*TAU/5,1,.035,4,true),[end===0?-2.4:2.4,0,0],[i/5,i*TAU/5,3+end,.5]);
      }
      body(`
        float travel=.60,t=uTime/travel,a=aData.y;
        if(aData.z<.5){
          float f=(p.x+2.4)/4.8;float envelope=sin(f*3.14159);
          p.y+=sin(f*3.0+a)*.34*envelope;p.z+=cos(f*3.0+a)*.34*envelope;
          float front=smoothstep(-.04,.06,uTime/.35-(1.0-f));
          float stoppedFor=max(0.0,uTime-uStopTime);
          float drain=smoothstep(-.05,.08,1.0-f-stoppedFor/travel);
          float end=uStopTime<0.0?1.0:mix(1.0,drain,smoothstep(0.0,.08,stoppedFor));
          vAlpha=front*end*grow()*fadeEnd()*.28;
        }else if(aData.z>2.5){
          p=c+q*vec3(uSize/max(uStretch,.001),uSize,uSize);p.yz/=uSize;
          vAlpha=grow()*fadeEnd()*(1.0-smoothstep(.35,1.0,uLifeEnd))*.65;
        }else{
          float index=floor(aData.x*9.0+.5);
          float offset=uQuantity==9.0?aData.x:index/uQuantity;
          float cycle=t+offset,phase=fract(cycle),birth=(floor(cycle)-offset)*travel;
          float f=1.0-phase;float envelope=sin(phase*3.14159);
          float live=step(0.0,birth)*(uStopTime<0.0?1.0:1.0-step(uStopTime+.00001,birth));
          p.x=p.x*uSize/max(uStretch,.001)+(f-.5)*4.8;
          p.y+=sin(f*3.0+a)*.34*envelope;p.z+=cos(f*3.0+a)*.34*envelope;
          vAlpha=live*smoothstep(0.0,.08,phase)*(1.0-smoothstep(.82,1.0,phase))*fadeEnd()*step(index+.5,uQuantity);
        }
        p.yz*=uSize;
      `,`if(vTone>.5)color=mix(uColor*.7,vec3(.86,1.0,.93),.62)*(.92+.08*sin((vP.x*28.0+vP.y*19.0)*uDetail));`);
    } else {
      // Closed teardrop slugs have rounded heads and narrow trailing necks.
      // No fragment slicing: every visible gap separates complete liquid volumes.
      for(let i=0;i<16;i++) {
        const phase=(i/8+Math.sin(i*2.3)*.018+1)%1;
        add(new THREE.SphereGeometry(1,10,7),[0,0,0],[phase,i*2.37,0,.14+(i%3)*.035]);
      }
      // A few detached droplets accompany the main jet, independent of density.
      for(let i=0;i<5;i++) {
        const drop=new THREE.SphereGeometry(1,7,5);drop.scale(.09,.065,.065);
        add(drop,[0,0,0],[i/5+.03,i*2.19,2,.26]);
      }
      function splashTongue() {
        const pos=[],uv=[],rings=[];
        for(let row=0;row<=8;row++) {
          const h=row/8,ring=[],width=.17*Math.pow(1-h,.72)+.006,thickness=.065*(1-h)+.004;
          for(let side=0;side<6;side++){const a=side*TAU/6;ring.push([h,Math.cos(a)*width,Math.sin(a)*thickness]);}
          rings.push(ring);
        }
        const tri=(a,b,c)=>{pos.push(...a,...b,...c);uv.push(a[0],a[1]+.5,b[0],b[1]+.5,c[0],c[1]+.5);};
        for(let row=0;row<8;row++)for(let side=0;side<6;side++){const n=(side+1)%6;tri(rings[row][side],rings[row+1][side],rings[row+1][n]);tri(rings[row][side],rings[row+1][n],rings[row][n]);}
        for(let side=0;side<6;side++){const n=(side+1)%6;tri([0,0,0],rings[0][n],rings[0][side]);tri([1,0,0],rings[8][side],rings[8][n]);}
        const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.computeVertexNormals();return g;
      }
      const directions=[-.4,.65,1.8,3.05,4.65];
      for(let i=0;i<5;i++) {
        const phase=(i*.213+.07)%1,a=directions[i];
        add(splashTongue(),[0,0,0],[phase,a,1,.24]);
        const drop=new THREE.SphereGeometry(1,8,6);drop.scale(.10+(i%2)*.025,.12+(i%3)*.018,.10+(i%2)*.025);
        add(drop,[0,0,0],[phase,a,3,.36]);
      }
      body(`
        if(aData.z<.5){
          float index=floor(aData.y/2.37+.5);
          float offset=uQuantity==8.0?aData.x:fract(aData.x+index*(1.0/uQuantity-1.0/8.0));
          float travel=.25,cycle=uTime/travel+offset,phase=fract(cycle),birth=(floor(cycle)-offset)*travel;
          float live=step(0.0,birth)*(uStopTime<0.0?1.0:1.0-step(uStopTime+.00001,birth));
          float bulb=smoothstep(-1.0,.35,q.x),envelope=pow(max(0.0,sin(phase*3.14159)),.28);
          float radius=(.075+phase*.24)*(.87+.13*sin(aData.y))*envelope;
          float neck=.25+.75*bulb,irregular=1.0+.095*sin(q.x*5.0+aData.y+phase*3.0);
          float length=min(.43+.07*rand(aData.y),min(phase,1.0-phase)*4.55);
          p.x=-2.4+phase*4.8+q.x*length;
          p.y=q.y*radius*neck*irregular+sin(phase*5.0+aData.y)*.045*envelope;
          p.z=q.z*radius*neck*irregular+cos(phase*6.0+aData.y)*.035*envelope;
          vAlpha=live*smoothstep(0.0,.045,phase)*(1.0-smoothstep(.95,1.0,phase))*fadeEnd()*step(index+.5,uQuantity);
        }else if(aData.z>1.5&&aData.z<2.5){
          float travel=.25,cycle=uTime/travel+aData.x,phase=fract(cycle),birth=(floor(cycle)-aData.x)*travel;
          float live=step(0.0,birth)*(uStopTime<0.0?1.0:1.0-step(uStopTime+.00001,birth));
          p.x=-2.4+phase*4.8+q.x*min(1.0,phase*12.0)*min(1.0,(1.0-phase)*12.0);
          float radial=(.12+phase*.38)*sin(phase*3.14159);
          p.y=q.y+cos(aData.y)*radial-.10*phase*phase;p.z=q.z+sin(aData.y)*radial;
          vAlpha=live*smoothstep(.02,.10,phase)*(1.0-smoothstep(.84,1.0,phase))*fadeEnd();
        }else if(aData.z<1.5){
          float period=.38,cycle=(uTime-.25)/period+aData.x,phase=fract(cycle);
          float source=(floor(cycle)-aData.x)*period;
          float live=step(0.0,source)*(uStopTime<0.0?1.0:1.0-step(uStopTime+.00001,source));
          float h=q.x,extend=ease(phase/.40),retreat=smoothstep(.43,.82,phase);
          float reach=.59+.16*rand(aData.y),radial=.13+reach*h*extend;
          float width=1.0-retreat*.68;
          float bow=.13*sin(h*3.14159)-.23*h*h;
          p.x=2.30+(bow+q.z)*uSize/max(uStretch,.001);
          p.y=cos(aData.y)*radial-q.y*width*sin(aData.y);
          p.z=sin(aData.y)*radial+q.y*width*cos(aData.y);
          n=normalize(vec3(normal.z,normal.y*cos(aData.y)-normal.x*sin(aData.y),normal.y*sin(aData.y)+normal.x*cos(aData.y)));
          float rootRetreat=smoothstep(-.06,.06,h-retreat*1.16);
          vAlpha=live*smoothstep(0.0,.08,phase)*(1.0-smoothstep(.67,.83,phase))*rootRetreat*(1.0-smoothstep(.78,1.0,uLifeEnd));
        }else{
          // A drop is born at the tongue tip, then moves independently under gravity.
          float period=.38,cycle=(uTime-.36)/period+aData.x,phase=fract(cycle),age=phase*period;
          float source=(floor(cycle)-aData.x)*period;
          float live=step(0.0,source)*(uStopTime<0.0?1.0:1.0-step(uStopTime+.00001,source));
          float reach=.59+.16*rand(aData.y),radial=.13+reach+age*(.90+.20*rand(aData.y+1.0));
          p.x=2.07+(q.x+age*.22)*uSize/max(uStretch,.001);
          p.y=q.y+cos(aData.y)*radial+.20*age-6.0*age*age;
          p.z=q.z+sin(aData.y)*radial;
          vAlpha=live*smoothstep(0.0,.018,age)*(1.0-smoothstep(.20,.30,age))*(1.0-smoothstep(.94,1.0,uLifeEnd));
        }
        p.yz*=uSize;
      `,`
        float streak=.5+.5*sin(vP.x*(7.0+uDetail*5.0)+vP.y*8.0-uTime*8.0);
        color=mix(color,mix(uColor,vec3(.93,1.0,.35),.52),smoothstep(.67,.86,streak)*.26);
      `);
    }
  } else if(effect===6) {
    function petal() {
      const positions=[],uv=[],vertices=[];
      for(let i=0;i<=9;i++) {
        const h=i/9,width=.46*Math.pow(Math.sin(h*Math.PI),.75)+.012;
        vertices.push([[-width,h,-.045],[width,h,-.045],[-width,h,.045],[width,h,.045]]);
      }
      const tri=(a,b,c)=>{positions.push(...a,...b,...c);uv.push(a[0]+.5,a[1],b[0]+.5,b[1],c[0]+.5,c[1]);};
      for(let i=0;i<9;i++){const a=vertices[i],b=vertices[i+1];for(const [j,k] of [[0,1],[1,3],[3,2],[2,0]]){tri(a[j],b[j],b[k]);tri(a[j],b[k],a[k]);}}
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.computeVertexNormals();return g;
    }
    for(let ring=0;ring<2;ring++)for(let i=0;i<14;i++) {
      const a=(i+ring*.5)*TAU/7;add(petal(),[0,0,0],[i/7,a,ring,.21+ring*.18],i*2+ring);
    }
    for(let i=0;i<5;i++) {const a=i*TAU/5;add(facet(.06,.14,.06),[Math.cos(a)*.28,.10,Math.sin(a)*.28],[i/5,a,2,.75]);}
    body(`
      float phase=aData.x,angle=aData.y;
      if(aUnit>=0.0&&uQuantity!=14.0){
        float ringCount=max(1.0,floor((uQuantity+1.0-aData.z)/2.0));
        float index=floor(aUnit/2.0);phase=index/ringCount;
        angle=(index+aData.z*.5)*6.28318530718/ringCount;
      }
      float t=uTime/2.2,gather=ease(t/.17),rise=ease((t-.12)/.46),open=ease((t-.26-phase*.035)/.38);
      float dissolve=smoothstep(.68,1.0,t);
      if(aData.z<1.5){
        float h=q.y,spread=.11+open*(.94-aData.z*.20),bend=.25*open;
        float radial=(1.0-gather)*.43+.10+h*spread+h*h*bend;
        float height=.05+rise*.29+h*(.11+rise*1.65)-h*h*.38*open;
        float dr=spread+2.0*h*bend,dy=.11+rise*1.65-h*.76*open;
        vec2 normalProfile=normalize(vec2(dy,-dr));
        radial+=q.z*normalProfile.x;height+=q.z*normalProfile.y;
        float widthScale=.34+rise*.66;
        if(uQuantity>14.0){
          float ringCount=max(1.0,floor((uQuantity+1.0-aData.z)/2.0));
          float halfGap=(radial-q.z*normalProfile.x)*tan(3.14159265359/ringCount)*.82;
          widthScale=min(widthScale*7.0/ringCount,halfGap/max(abs(q.x),.012));
        }
        p=vec3(cos(angle)*radial-q.x*widthScale*sin(angle),height+dissolve*.32,sin(angle)*radial+q.x*widthScale*cos(angle));
        n=normalize(vec3(cos(angle)*normalProfile.x,normalProfile.y,sin(angle)*normalProfile.x)*normal.z+vec3(-sin(angle),0.0,cos(angle))*normal.x+vec3(cos(angle)*dr,dy,sin(angle)*dr)*normal.y);
        vAlpha=smoothstep(0.0,.08,t)*(1.0-dissolve)*step(aUnit+.5,uQuantity);
      }else{p.y+=rise*2.05+dissolve*.2;p.xz*=1.0+rise*.25;vAlpha=smoothstep(.23,.39,t)*(1.0-smoothstep(.7,.98,t));}
      p*=uSize;
    `,`color=mix(color,vec3(1.0,.98,.69),smoothstep(.3,2.0,vP.y/uSize)*.32);float vein=pow(.5+.5*cos((vP.x+vP.z)*(10.0+uDetail*9.0)),18.0);color+=uColor*vein*.07;`);
  } else if(effect===7) {
    // A selected landing owns its lance, three shards and frost patch together.
    // Spread moves landing centers only; lance size and local impact motion stay independent.
    for(let i=0;i<18;i++) {
      const a=i*2.39996,r=i===0?0:.55+(.8*(i%3)/2),c=[Math.cos(a)*r,0,Math.sin(a)*r];
      const lance=facet(.13,.64,.13);lance.translate(0,.64,0);add(lance,c,[i/9,a,0,.27]);
      for(let j=0;j<3;j++) {
        const shard=facet(.075,.15,.075);shard.rotateZ((j-1)*.8);add(shard,c,[i/9,a+j*TAU/3,1,.67]);
      }
      const patch=new THREE.CylinderGeometry(.25,.31,.045,6,1,false);add(patch,[c[0],.025,c[2]],[i/9,a,2,.12]);
    }
    body(`
      float index=floor(aData.x*9.0+.5);
      float offset=uQuantity==9.0?aData.x:index/uQuantity;
      float impact=.43+offset*1.05,age=uTime-impact;
      if(aData.z<.5){float fall=sat((age+.34)/.34);float y=(1.0-fall*fall)*2.55;
        p=c+q*uSize;p.y+=y;
        vAlpha=smoothstep(-.37,-.30,age)*(1.0-smoothstep(.015,.12,age));
      }else if(aData.z<1.5){float a=sat(age/.48);p=c+q*uSize*(1.0-a*.55);
        p.x+=cos(aData.y)*a*.43*uSize;p.z+=sin(aData.y)*a*.43*uSize;p.y+=sin(a*3.14159)*.40*uSize;
        vAlpha=smoothstep(0.0,.025,age)*(1.0-smoothstep(.20,.48,age));
      }else{p=c+q*uSize;float a=ease(age/.15);p.xz=c.xz+(p.xz-c.xz)*a;vAlpha=smoothstep(0.0,.04,age)*(1.0-smoothstep(.35,.85,age));}
      p.xz+=(uSpread-1.0)*c.xz;
      vAlpha*=(1.0-smoothstep(2.12,2.4,uTime))*step(index+.5,uQuantity);
    `,`color=mix(color,vec3(.86,.97,1.0),.19);color+=uColor*.08*pow(.5+.5*sin(vP.y*(12.0+uDetail*13.0)+vP.x*19.0),16.0);`);
  }
  // One deterministic GPU allocation: all 512 slots fit in 2,048 triangles.
  // The hero meshes above never depend on allocation count or random selection.
  const particleVertex=`${common}
    attribute vec4 seed;varying vec3 vN;varying float vAlpha,vTone;
    void main(){
      vec3 p=vec3(0.0);float size=.009+seed.w*.016;float a=seed.x*6.283185;
      float t=uTime,age=0.0;vAlpha=1.0;vTone=seed.w;
      #if UTILITY == 0
        float f=sat(t/.65);float spread=ease(f/.7);float angle=-1.7+seed.x*2.7+spread*.9;
        p=vec3(cos(angle)*(1.15+seed.z*1.2),.1+(seed.y-.5)*.5,sin(angle)*(1.15+seed.z*1.2));
        p*=uSize;vAlpha=smoothstep(.02,.13,f)*(1.0-smoothstep(.25+seed.y*.3,1.0,f));size*=1.0-f*.6;
      #elif UTILITY == 1
        float x=-2.2+seed.x*4.4;age=t-(.1+seed.x*.62);
        p=vec3(x,.05+max(0.0,age)*(1.3+seed.y)-max(0.0,age)*max(0.0,age)*2.2,sin(seed.x*27.0)*.20+(seed.z-.5)*age*.8);
        p.yz*=uSize;vAlpha=smoothstep(0.0,.08,age)*(1.0-smoothstep(.3,.85,age))*(1.0-smoothstep(1.5,1.8,t));
      #elif UTILITY == 2 || UTILITY == 4
        float f=fract(seed.y+t*.30);float radial=1.1+seed.z*.28;
        #if UTILITY == 2
          p=vec3(.7+seed.z*.1,.9+cos(a)*radial,sin(a)*radial);
        #elif UTILITY == 4
          p=vec3((seed.z-.5)*.25,1.45+cos(a)*1.4,sin(a)*1.04);
        #endif
        p*=uSize;vAlpha=sin(f*3.14159)*grow()*fadeEnd()*(1.0-uLifeEnd)*.7;
      #elif UTILITY == 3
        float f=sat(t/.55);float r=.15+ease(f)*(.45+seed.y*.9);
        p=vec3(.6+f*seed.z,.9+cos(a)*r,sin(a)*r);p*=uSize;
        vAlpha=smoothstep(0.0,.07,f)*(1.0-smoothstep(.25+seed.z*.25,1.0,f));
      #elif UTILITY == 5 || UTILITY == 8
        float travel=.62,cycle=t/travel+seed.y,f=fract(cycle),birth=(floor(cycle)-seed.y)*travel;
        float live=step(0.0,birth)*(uStopTime<0.0?1.0:1.0-step(uStopTime+.00001,birth));
        #if UTILITY == 5
          float path=1.0-f,lane=floor(seed.z*3.0)*2.0944;p.x=2.4-f*4.8;p.y=sin(path*3.0+lane)*sin(f*3.14159)*.34;p.z=cos(path*3.0+lane)*sin(f*3.14159)*.34;size*=.6;
        #else
          p.x=-2.4+f*4.8;p.y=cos(a)*(.08+f*.46)*seed.z;p.z=sin(a)*(.08+f*.46)*seed.z;size*=1.2;
        #endif
        p.yz*=uSize;vAlpha=live*smoothstep(0.0,.08,f)*(1.0-smoothstep(.78,1.0,f))*fadeEnd();
      #elif UTILITY == 6
        float f=sat(t/2.2);float rise=ease((f-seed.y*.22)/.7),r=(.2+seed.z*.9)*sin(rise*2.1);
        p=vec3(cos(a+rise)*r,rise*(1.5+seed.y*1.2),sin(a+rise)*r)*uSize;
        vAlpha=smoothstep(seed.y*.15,seed.y*.15+.13,f)*(1.0-smoothstep(.48+seed.z*.15,1.0,f));
      #elif UTILITY == 7
        // Keep decoration per landing sparse when fewer than nine lances are selected.
        float cell=floor(seed.x*max(9.0,uQuantity)),phi=cell*2.39996,r=cell<.5?0.0:.55+.8*mod(cell,3.0)/2.0;
        age=t-(.43+cell/uQuantity*1.05);float f=sat(age/.55);
        p=vec3(cos(phi)*r,0.0,sin(phi)*r)+vec3(cos(a)*f*.65,sin(f*3.14159)*(.2+seed.y*.5),sin(a)*f*.65)*uSize;
        p.xz+=(uSpread-1.0)*vec2(cos(phi)*r,sin(phi)*r);
        vAlpha=smoothstep(0.0,.03,age)*(1.0-smoothstep(.2,.55,age))*step(cell+.5,uQuantity);
      #endif
      vAlpha*=smoothstep(.42,.90,seed.w);
      #if UTILITY == 2 || UTILITY == 4
        size*=.52;vAlpha*=.38;
      #elif UTILITY == 5
        vAlpha*=.45;
      #elif UTILITY == 8
        vAlpha*=.55;
      #endif
      vec3 q=position*size*uSize;
      #if UTILITY == 0
        q.x*=3.2;q.y*=.35;q.z*=.65;q.xz=turn(-1.7+seed.x*2.7+ease(sat(uTime/.65)/.7)*.9+1.5708)*q.xz;
      #elif UTILITY == 1
        q.xz*=.55;q.y*=2.2;
      #elif UTILITY == 3 || UTILITY == 7
        q.y*=2.0;
      #elif UTILITY == 6
        q.xz*=.6;q.y*=1.6;
      #endif
      #if UTILITY == 5 || UTILITY == 8
        q.x/=max(uStretch,.001);
      #endif
      p+=q;vN=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);
    }`;
  const particleFragment=`uniform vec3 uColor;varying vec3 vN;varying float vAlpha,vTone;
    void main(){if(vAlpha<.003)discard;float light=dot(normalize(vN),normalize(vec3(-.4,.8,.55)))*.5+.5;
      vec3 color=mix(uColor*.65,mix(uColor,vec3(1.0),.65),step(.48,light));
      gl_FragColor=vec4(color,vAlpha*.82);${output}}
  `;
  const pm=shader(particleFragment,particleVertex,{},false,{UTILITY:effect});pm.userData.ownLifecycle=true;
  const particles=instanced(new THREE.TetrahedronGeometry(1,0),cap,1,pm,2);particles.name='utility-detail-particles';
  return true;
}


// Painterly vegetation: fixed allocation, local-space roots, no texture dependencies.
function buildGrassEffect(ctx) {
  const { THREE, kind, variant, instanced, shader, output } = ctx;
  if (kind !== 10 || variant !== 0) return false;

  function geometry(flowers) {
    const positions = [], uvs = [], indices = [];
    const pieces = flowers ? 6 : 3;
    for (let piece = 0; piece < pieces; piece++) {
      const segments = flowers ? 1 : 3, start = positions.length / 3;
      for (let j = 0; j <= segments; j++) for (let side = 0; side < 2; side++) {
        positions.push(side * 2 - 1, j / segments, piece);
        uvs.push(side, j / segments);
      }
      for (let j = 0; j < segments; j++) {
        const i = start + j * 2;
        indices.push(i, i + 1, i + 2, i + 1, i + 3, i + 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(indices);
    return g;
  }

  const vertex = `
    attribute vec4 seed;
    uniform float uTime, uLifeStart, uLifeEnd;
    varying vec2 vUv;
    varying float vShade, vSeed, vPetal, vGrowth;
    ${painterlyWindGLSL()}
    void main() {
      vUv = uv; vSeed = seed.w; vPetal = 0.0;
      vGrowth = smoothstep(0.0, 1.0, uLifeStart) * (1.0 - smoothstep(0.0, 1.0, uLifeEnd));
      vec2 root = (seed.xy * 2.0 - 1.0) * 1.85;
      root *= sqrt(1.0 - .27 * root.yx * root.yx / 3.4225);
      float id = position.z, h = position.y;
      float angle = seed.w * 6.283185 + id * 2.39996;
      vec2 along = vec2(cos(angle), sin(angle));
      vec2 across = vec2(-along.y, along.x);
      vec3 p;
      float patchTone = .5 + .5 * sin(root.x * 2.3 + sin(root.y * 1.8) * 1.4);
      #if FLOWERS == 1
        float height = .48 + seed.z * .45;
        vec2 wind = windAt(root, seed.w * 6.283185);
        if (id < .5) {
          p = vec3(across.x * position.x * .009, h * height, across.y * position.x * .009);
          p.xz += wind * h * h;
        } else {
          vPetal = 1.0;
          float a = (id - 1.0) * 1.256637 + seed.w * 6.283185;
          vec2 radial = vec2(cos(a), sin(a)), tangent = vec2(-radial.y, radial.x);
          float lengthPetal = .12 + grassHash(id + seed.z * 91.0) * .085;
          vec2 petal = radial * (.012 + h * lengthPetal) + tangent * position.x * (.045 + seed.z * .025);
          p = vec3(petal.x, height + .018 + h * .035 + dot(petal, across) * .65, petal.y);
          p.xz += wind;
        }
        vShade = .4 + seed.z * .3;
      #else
        float shape = grassHash(seed.z * 103.0 + id * 7.0);
        float height = (.30 + pow(seed.z, .7) * .82) * (.72 + shape * .38);
        float width = (.065 + grassHash(seed.w * 53.0 + id) * .10) * mix(1.25, .72, seed.z);
        float taper = .22 + .78 * pow(max(0.0, sin(h * 2.85 + .23)), .72);
        float lean = (.12 + shape * .27) * h * h;
        vec2 leaf = across * position.x * width * taper + along * lean;
        leaf += windAt(root, seed.w * 6.283185 + id * .23) * h * h;
        p = vec3(leaf.x, h * height - lean * .16, leaf.y);
        vShade = .12 + patchTone * .35 + shape * .28 + seed.z * .05;
      #endif
      p *= uSize * vGrowth;
      p.xz += root;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }
  `;
  const fragment = `
    ${painterlyBrushGLSL()}
    uniform vec3 uColor;
    varying vec2 vUv;
    varying float vShade, vSeed, vPetal, vGrowth;
    void main() {
      if (vGrowth < .002) discard;
      float x = vUv.x * 2.0 - 1.0, h = vUv.y;
      vec3 color;
      if (vPetal > .5) {
        float edge = .74 + .09 * sin(h * 19.0 + vSeed * 17.0);
        float cap = pow(abs((h - .46) / .57), 4.0);
        if (x*x + cap > edge) discard;
        color = mix(vec3(.69,.74,.70), vec3(.86,.89,.82), step(.43, vShade + x * .09));
      } else {
        #if FLOWERS == 0
          float streak = brushStreak(h, vSeed);
          float rim = .89 + streak * .028 * uDetail;
          float tip = 1.0 - smoothstep(.70, 1.03, h);
          if (abs(x + .12 * sin(h * 5.0 + vSeed * 9.0)) > rim * tip) discard;
          float notch = step(.94, sin(h * 21.0 + vSeed * 47.0)) * .065 * uDetail;
          if (abs(x) > rim * tip - notch && h > .2) discard;
        #endif
        float light = vShade + h * .16;
        color = mix(uColor * .37, uColor * .77, step(.36, light));
        color = mix(color, uColor * 1.13, step(.57, light));
        color = mix(color, mix(uColor, vec3(.70,.70,.22), .55), step(.76, light));
        float stroke = step(.64, sin(h * 10.0 + vSeed * 37.0 + x * 2.3));
        color *= 1.0 + (stroke - .5) * .10 * uDetail;
      }
      gl_FragColor = vec4(color, 1.0);
      ${output}
    }
  `;
  for (const flowers of [false, true]) {
    const material = shader(fragment, vertex, {}, false, { FLOWERS: flowers ? 1 : 0 });
    material.transparent = false;
    material.depthWrite = true;
    material.userData.ownLifecycle = true;
    const object = instanced(geometry(flowers), flowers ? 32 : 480, flowers ? 1 / 16 : 15 / 16, material, 0);
    object.name = flowers ? 'grass-white-flowers' : 'grass-brush-clumps';
  }
  return true;
}

// Shared game asset: native Three.js transmission, no host render step or extra loop.
function buildBlackHoleEffect(ctx) {
  const {THREE,kind,variant,uniforms,lifeUniforms,materials,mesh,instanced,shader,output,cap}=ctx;
  if(kind!==2||variant!==9)return false;
  const motion=`
    uniform float uTime,uLifeStart,uLifeEnd;
    float bhGrowth(){return smoothstep(0.0,1.0,uLifeStart)*(1.0-smoothstep(.05,1.0,uLifeEnd));}
    float bhFade(){return smoothstep(0.0,.28,uLifeStart)*(1.0-smoothstep(.6,1.0,uLifeEnd));}
    vec3 bhCenter(){return vec3(0.0,1.5,0.0)*uSize;}
  `;
  const turbulence=`
    float bhHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float bhNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
      return mix(mix(bhHash(i),bhHash(i+vec2(1,0)),f.x),mix(bhHash(i+vec2(0,1)),bhHash(i+vec2(1,1)),f.x),f.y);}
    float bhFbm(vec2 p){return bhNoise(p)*.57+bhNoise(p*2.03+17.0)*.28+bhNoise(p*4.11-9.0)*.15;}
    vec3 bhSpectrum(float t){return .5+.5*cos(6.283185*t+vec3(0.0,2.1,4.2));}
  `;
  // Both lenses share the same displacement law; the outer lens applies half strength. The
  // support differs: a central sphere versus a flattened ellipsoid.
  const gravity=`
    vec2 bhBackgroundOffset(vec2 uv,vec2 direction,float r,float spiral,float noise,vec2 radius,vec2 inset){
      const float BH_BACKGROUND_DISTORTION=5.0;
      vec2 tangent=vec2(-direction.y,direction.x);
      float bend=.48*pow(1.0-r,2.0)/max(r,.24);
      float shear=.045*sin(spiral*2.0+(noise-.5)*2.0)*pow(1.0-r,1.5);
      vec2 delta=(-direction*min(bend,.70)+tangent*shear)*BH_BACKGROUND_DISTORTION*radius*uDetail;
      float edge=max(0.0,min(min(uv.x-inset.x,1.0-inset.x-uv.x),min(uv.y-inset.y,1.0-inset.y-uv.y)));
      return delta*smoothstep(0.0,max(.015,length(delta)*1.25),edge);
    }
  `;
  // Only the two upper junctions receive a tapered stream. The original
  // irregular coloured halo and physical disk retain their own appearance.
  const colorJunction=`
    float bhHaloShape(float angle){
      float shapeNoise=bhFbm(vec2(cos(angle-uTime*.16),sin(angle-uTime*.16))*3.0);
      return .045*sin(angle*3.0-uTime*.32)+.008*sin(angle*5.0+uTime*.23)+.005*(shapeNoise-.5);
    }
    vec2 bhJoinPoint(float t,vec2 end){
      vec2 a=vec2(.97,.0),b=vec2(.77,.0),c=end+vec2(.16,-.18);
      float u=1.0-t;
      return u*u*u*a+3.0*u*u*t*b+3.0*u*t*t*c+t*t*t*end;
    }
    float bhJunction(vec2 q,float overhead){
      if(q.y<-.04||abs(q.x)<.30||overhead>=.999)return 0.0;
      float angle=q.x>0.0?.82:3.141593-.82;
      vec2 end=vec2(abs(cos(angle)),sin(angle))*.58*(1.0+bhHaloShape(angle));
      vec2 p=vec2(abs(q.x),q.y),last=bhJoinPoint(0.0,end);
      float distance=10.0,along=0.0;
      for(int i=1;i<=12;i++){
        float t=float(i)/12.0;vec2 next=bhJoinPoint(t,end),d=next-last;
        float h=clamp(dot(p-last,d)/max(dot(d,d),.000001),0.0,1.0);
        float candidate=length(p-last-d*h);
        if(candidate<distance){distance=candidate;along=(float(i)-1.0+h)/12.0;}
        last=next;
      }
      float width=mix(.018,.012,along),aa=max(fwidth(q.x),fwidth(q.y));
      float mask=1.0-smoothstep(width*.35,width+aa,distance);
      mask*=smoothstep(0.0,.12,along)*(1.0-smoothstep(.80,1.0,along));
      return mask*(.55+.45*pow(.5+.5*sin(along*24.0-uTime*1.2),2.0))*(1.0-overhead);
    }
  `;
  const brushStrokes=`
    // Periodic, advected brush coordinates. Neighbour cells contribute whole
    // strokes, so cell boundaries never cut a curved mark into rectangular chips.
    vec3 bhStrokeSeed(vec2 p){
      vec3 h=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));
      h+=dot(h,h.yxz+33.33);
      return fract((h.xxy+h.yzz)*h.zyx);
    }
    vec3 bhBrushPaint(float r,float angle,float inner,float mask){
      float t=uTime*1.5;
      const float radialDensity=13.0;
      // Advect the spiral's radial coordinate too: inward motion must not
      // secretly add angular speed in one direction and subtract in the other.
      float flowRadius=r+t*.032;
      vec2 p=vec2((angle+log(flowRadius+.14)*1.6+t*mix(.8,-.8,inner))*16.0/6.283185,flowRadius*radialDensity);
      // Derivatives are measured before cell selection. Width is in radius
      // units, independent of angular density, stroke length and light intensity.
      float pixel=max(length(vec2(dFdx(p.y),dFdy(p.y)))/radialDensity,.0003);
      // Derivatives above remain uniform across neighbouring fragments.
      if(mask<=0.0 && pixel<.005)return vec3(0.0);
      float wash=0.0,shade=0.0,scratch=0.0;
      // Five independently seeded fields increase density without shortening
      // or widening the existing marks. Their coverage is combined, not added.
      for(int layer=0;layer<5;layer++){
        float field=float(layer);
        vec2 fieldPosition=p+vec2(field*1.37,field*.417);
        vec2 cell=floor(fieldPosition),local=fract(fieldPosition);
        for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
          vec2 offset=vec2(float(x),float(y));
          vec2 id=cell+offset;id.x=mod(id.x,16.0);
          id+=vec2(field*19.0,field*43.0);
          vec3 seed=bhStrokeSeed(id),shape=bhStrokeSeed(id+vec2(37.0,71.0));
          // These candidates had exactly zero coverage in the original field.
          if(shape.z<.28)continue;
          vec2 d=local-offset-seed.xy;
          float halfLength=mix(.07,.94,shape.x*shape.x);
          float u=d.x/halfLength;
          if(abs(u)>1.0)continue;
          // A single inward spiral follows each field's rotation. Randomness
          // changes its length and pitch magnitude, never its bend direction.
          float direction=mix(-1.0,1.0,inner);
          float pitch=-direction*mix(.009,.015,shape.y);
          float cross=d.y/radialDensity-d.x*pitch;
          // taper and grain never exceed one; include the complete AA fringe.
          if(abs(cross)>.006+pixel*.5)continue;
          float alongFlow=u*direction;
          float taper=pow(max(0.0,1.0-abs(u)),.65)*(1.0-.35*max(0.0,alongFlow));
          float width=mix(.0022,.006,seed.z*seed.z)*taper;
          // Longitudinal pigment grain stays attached to the mark; it never
          // resamples in time. Sparse gaps keep the result from becoming a ring.
          float grain=.82+.18*sin(u*16.0+shape.y*23.0)*sin(u*7.0+seed.z*31.0);
          float edge=abs(cross)-width*grain;
          float coverage=(1.0-smoothstep(-pixel*.5,pixel*.5,edge))*step(abs(u),1.0);
          coverage*=step(.28,shape.z);
          float split=abs(cross-width*.34)-width*.11;
          float dryGap=mix(1.0,smoothstep(-pixel*.22,pixel*.22,split),step(.68,seed.x));
          coverage*=dryGap;
          float pigment=.15+.55*seed.z+.12*sin(u*4.0+seed.x*9.0);
          if(coverage>wash){wash=coverage;shade=pigment;}
          scratch=max(scratch,coverage*step(.78,seed.y));
        }
      }
      return vec3(wash,shade,scratch);
    }
  `;
  // Both layers share one physical disk with complementary depth weights.
  // The rear enters native transmission; the front overlays the event horizon.
  const diskVertex=`${motion}${turbulence}
    varying vec2 vDisk;varying vec3 vPoint,vCenter;
    varying vec4 vDiskScreen,vDiskCenterClip;varying vec2 vDiskRadius;
    void main(){
      vDisk=position.xy;float scale=uSize*max(.0001,bhGrowth());
      float r=length(position.xy),a=atan(position.y,position.x),spin=uTime*.72;
      vec2 flow=vec2(cos(a-spin/(r+.25)),sin(a-spin/(r+.25)))*r;
      float n=bhFbm(flow*2.7);
      // Keep a closed annulus: bounded radial scaling cannot fold across its centre.
      // Surface texture carries the fast infall; the silhouette moves more slowly.
      float ringShape=.045*sin(a*3.0-uTime*.32)+.025*sin(a*5.0+uTime*.23)+.015*(n-.5);
      float radius=r*(1.0+ringShape);
      float twist=.10*sin(a*3.0+r*1.8-uTime*.35)/(r+.3);
      vec2 disk=vec2(cos(a+twist),sin(a+twist))*radius;
      float thickness=position.z*(.34+.08*n);
      float lift=.06*sin(a*3.0-r*2.0+uTime*.32)*smoothstep(.7,1.7,r);
      float height=(thickness+lift)*.125;
      vec3 q=vec3(disk.x,height,disk.y)*scale;
      vPoint=(modelViewMatrix*vec4(bhCenter()+q,1.0)).xyz;
      vCenter=(modelViewMatrix*vec4(bhCenter(),1.0)).xyz;
      gl_Position=projectionMatrix*vec4(vPoint,1.0);
      vDiskScreen=gl_Position;vDiskCenterClip=projectionMatrix*vec4(vCenter,1.0);
      float projectedRadius=2.15*scale*length(modelViewMatrix[0].xyz)/max(.01,-vCenter.z);
      vDiskRadius=vec2(projectionMatrix[0][0],projectionMatrix[1][1])*projectedRadius*.5;
    }`;
  const diskFragment=`uniform float uSize;${motion}${turbulence}${brushStrokes}
    uniform vec3 uColor;varying vec2 vDisk;varying vec3 vPoint,vCenter;
    void main(){
      float nearSide=dot(vPoint-vCenter,normalize(-vCenter));
      // Complementary depth weights remove the screen-wide hard split between
      // the native transmission capture and the foreground overlay.
      float frontWeight=smoothstep(-.45*uSize,.45*uSize,nearSide);
      #if BH_FRONT == 1
        float layerWeight=frontWeight;
      #else
        float layerWeight=1.0-frontWeight;
      #endif
      if(layerWeight<.0001)discard;
      float r=length(vDisk),a=atan(vDisk.y,vDisk.x),spin=uTime*.9;
      // Positive time in log-radius coordinates carries the pattern inward.
      // The changing angular speed stretches each stream as it approaches the core.
      float advected=a+log(r+.12)*2.4+spin;
      vec2 flow=vec2(cos(advected),sin(advected))*vec2(3.0,3.0);
      float n=bhFbm(flow+vec2(r*4.0+uTime*1.15,r*1.5)),large=bhFbm(flow*.55+r);
      float warped=r+5.0*((n-.5)*.055+sin(a*5.0-r*3.0+spin)*.016);
      float phase=advected*3.0+(n-.5)*3.0;
      float bands=pow(.5+.5*sin(phase),2.5);
      float fine=smoothstep(.38,.64,n);
      float envelope=smoothstep(.65,.88,r)*(1.0-smoothstep(2.05+large*.3,2.65,r));
      float torn=smoothstep(.12,.65,n)*(.3+.7*large);
      float hot=bands*(.55+.45*n);
      vec3 spectrum=bhSpectrum(warped*1.8+large*.7);
      vec3 color=mix(vec3(.02,.10,.9),spectrum*1.8,.7);
      color=mix(color,uColor,.18);
      color=mix(color,vec3(1.0,.97,.94)*2.8,smoothstep(.32,.82,hot));
      // Shared broken strokes carry through the outer disk and the inner halo.
      vec3 brush=bhBrushPaint(r/2.15,a,0.0,1.0);
      float ink=brush.z;
      float outerWeight=smoothstep(.68,.88,r);
      color*=mix(.55,1.0,step(.48,hot));

      float alpha=envelope*(.24+bands*.88+fine*.16)*torn*bhFade();
      if(alpha<.002)discard;
      // Light remains additive; ink also attenuates what is behind the disk,
      // so the bright lens cannot wash the outlines out.
      float inkCoverage=ink*outerWeight*envelope*bhFade()*.98;
      vec3 emission=color*2.4*uDetail*min(1.0,alpha)*(1.0-ink*outerWeight);
      // A hue-preserving highlight shoulder keeps pigment visible at default
      // intensity instead of clipping whole bands to white.
      emission/=1.0+max(emission.r,max(emission.g,emission.b))*1.2;
      float wash=brush.x*outerWeight*envelope*bhFade();
      vec3 pigment=mix(vec3(.008,.018,.055),mix(spectrum*.32,vec3(.08,.25,.40),.55),brush.y);
      // Coverage is geometric: bright HDR values must not inflate the edge.
      emission=mix(emission,pigment*(.75+.25*uDetail),wash)*(1.0-ink*outerWeight);
      inkCoverage=max(inkCoverage,wash*.98);
      emission*=layerWeight;inkCoverage*=layerWeight;
      gl_FragColor=vec4(emission+vec3(.002,.004,.012)*inkCoverage,inkCoverage);${output}
    }`;
  const diskGeometry=new THREE.TorusGeometry(1.65,1.0,12,160);
  for(const front of [0,1]){
    const mat=shader(diskFragment,diskVertex,{},true,{BH_FRONT:front});
    mat.transparent=!!front;mat.side=THREE.FrontSide;mat.userData.ownLifecycle=true;
    mat.blending=THREE.CustomBlending;mat.blendEquation=THREE.AddEquation;
    mat.blendSrc=THREE.OneFactor;mat.blendDst=THREE.OneMinusSrcAlphaFactor;
    mesh(front?diskGeometry.clone():diskGeometry,mat,front?3:0).name=front?'black-hole-front-disk':'black-hole-rear-disk';
  }
  // The native transmission pass supplies the real scene behind the lens.
  // Source fields also feed the site's shader inspector and standalone exports.
  const lens=new THREE.MeshPhysicalMaterial({transmission:1,roughness:0,metalness:0,transparent:true,depthWrite:false,side:THREE.FrontSide});
  lens.uniforms={...uniforms,...lifeUniforms};
  lens.vertexShader=`uniform float uSize;${motion}
    varying vec4 vScreen,vCenterClip;varying vec2 vRadius;varying float vLensInclination;
    void main(){
      float radius=2.15*uSize*max(.0001,bhGrowth());
      vec4 center=modelViewMatrix*vec4(bhCenter(),1.0);
      vec4 p=modelViewMatrix*vec4(bhCenter()+position*radius,1.0);
      vLensInclination=abs(dot(normalize(-center.xyz),normalize(modelViewMatrix[1].xyz)));
      vCenterClip=projectionMatrix*center;
      float worldScale=length(modelViewMatrix[0].xyz);
      float projectedRadius=radius*worldScale/max(.01,-center.z);
      vRadius=vec2(projectionMatrix[0][0],projectionMatrix[1][1])*projectedRadius*.5;
      gl_Position=projectionMatrix*p;vScreen=gl_Position;
    }`;
  lens.fragmentShader=`uniform float uSize,uDetail;${motion}${turbulence}${brushStrokes}${gravity}${colorJunction}
    uniform vec3 uColor;uniform sampler2D transmissionSamplerMap;uniform vec2 transmissionSamplerSize;
    varying vec4 vScreen,vCenterClip;varying vec2 vRadius;varying float vLensInclination;
    void main(){
      float fade=bhFade();if(fade<.001||vCenterClip.w<=0.0)discard;
      vec2 uv=vScreen.xy/vScreen.w*.5+.5,center=vCenterClip.xy/vCenterClip.w*.5+.5;
      vec2 radius=max(abs(vRadius),vec2(.00001));vec2 q=(uv-center)/radius;
      float r=length(q);if(r>=1.0)discard;
      float angle=atan(q.y,q.x),spin=uTime*.8;
      vec2 direction=q/max(r,.0001);
      float spiral=angle+2.6*log(r+.13)+spin;
      vec2 flow=vec2(cos(spiral),sin(spiral));
      float n=bhFbm(flow*4.0+vec2(r*8.0+uTime*.9,r*3.0));
      float large=bhFbm(vec2(cos(angle-spin*.4),sin(angle-spin*.4))*3.0);
      // One angular deformation shared by both annuli. Radius remains monotonic,
      // so neither ring can fold, branch, cross its neighbour or reach the black core.
      float ringShape=bhHaloShape(angle);
      float warped=r/(1.0+ringShape);
      vec2 inset=.5/max(transmissionSamplerSize,vec2(1.0));
      vec2 delta=bhBackgroundOffset(uv,direction,r,spiral,n,radius,inset);
      vec3 background=texture2D(transmissionSamplerMap,clamp(uv+delta,inset,1.0-inset)).rgb;
      float aa=max(fwidth(r),.0005),horizon=1.0-smoothstep(.275-aa,.275+aa,r);
      vec3 color=mix(background,vec3(0.0),horizon);
      float stream=pow(.5+.5*sin(spiral*3.0+(n-.5)*2.6),3.0);
      float corona=exp(-pow((warped-.50)/(.065+large*.02),2.0));
      // Avoid a second, evenly spaced radial stripe pattern underneath the brush.
      float filaments=.65+.35*stream;
      float continuity=.55+.45*stream;
      float inner=exp(-pow((warped-.35)/.016,2.0))*continuity;
      float fringe=exp(-pow((warped-.58)/.055,2.0))*continuity;
      vec3 cool=vec3(.018,.075,1.0),spectrum=bhSpectrum(warped*9.0+large*.8+n*.4);
      vec3 energy=vec3(1.0,.98,.96)*corona*filaments*continuity*(1.4+large);
      energy+=spectrum*fringe*1.9;
      energy+=cool*(exp(-abs(warped-.51)*8.0)*.38+exp(-abs(warped-.30)*38.0)*.24)*(.4+.6*stream);
      energy+=mix(uColor,vec3(1.0),.8)*inner*1.6;
      float stableRim=exp(-pow((r-.284)/max(.0018,aa*.65),2.0));
      const float BH_COLOR_JOIN=1.0;
      float junction=bhJunction(q,smoothstep(.40,.92,vLensInclination))*BH_COLOR_JOIN;
      vec3 joiningLight=mix(spectrum,uColor,.08)*junction*1.1;
      vec3 glow=(energy+joiningLight)*uDetail;
      glow/=1.0+max(glow.r,max(glow.g,glow.b))*1.2;
      color+=glow*smoothstep(.287,.32,r);
      color+=mix(uColor,vec3(1.0),.8)*stableRim*1.3*uDetail*(1.0-horizon);
      // Keep the pigment on circular flow coordinates; silhouette turbulence
      // must not bend individual strokes into radial hooks.
      float brushZone=smoothstep(.30,.34,r)*(1.0-smoothstep(.60,.68,warped));
      vec3 haloBrush=bhBrushPaint(r,angle,1.0,brushZone);
      vec3 pigment=mix(vec3(.008,.018,.055),mix(spectrum*.32,vec3(.08,.25,.40),.55),haloBrush.y);
      color=mix(color,pigment*(.75+.25*uDetail),haloBrush.x*brushZone);
      float innerInk=haloBrush.z*brushZone;
      color=mix(color,vec3(.002,.004,.012),innerInk*.98);
      float alpha=fade*(1.0-smoothstep(.91,1.0,r));
      gl_FragColor=vec4(color,alpha);${output}
    }`;
  lens.onBeforeCompile=program=>{Object.assign(program.uniforms,lens.uniforms);program.vertexShader=lens.vertexShader;program.fragmentShader=lens.fragmentShader;lens.userData.transmissionUniforms=program.uniforms;};
  lens.customProgramCacheKey=()=>lens.vertexShader+'\n'+lens.fragmentShader;
  lens.userData.ownLifecycle=true;materials.add(lens);
  mesh(new THREE.SphereGeometry(1,64,40),lens,1).name='black-hole-lens';
  const particles=shader(`uniform float uSize;${motion}
    uniform vec3 uColor;varying vec2 vUv;varying float vAlpha;
    varying vec4 vParticleScreen,vParticleCenter;varying vec2 vParticleRadius;
    void main(){vec2 q=vUv*2.0-1.0;float glow=exp(-dot(q,q)*5.0)*(1.0-smoothstep(.5,1.0,length(q)));
      vec2 screen=vParticleScreen.xy/vParticleScreen.w*.5+.5;
      vec2 center=vParticleCenter.xy/vParticleCenter.w*.5+.5;
      float coreRadius=length((screen-center)/max(abs(vParticleRadius),vec2(.00001)));
      float alpha=min(1.0,glow*2.0)*vAlpha*smoothstep(.285,.31,coreRadius);if(alpha<.002)discard;
      gl_FragColor=vec4(vec3(1.6)*uDetail,alpha);${output}
    }`,`${motion}
    attribute vec4 seed;varying vec2 vUv;varying float vAlpha;
    varying vec4 vParticleScreen,vParticleCenter;varying vec2 vParticleRadius;
    // Preserve the front-facing lensed arch. As the viewer moves above the
    // disk, blend onto its circular rim rather than keeping a raised arch.
    vec3 bhParticlePath(float age,vec3 right,vec3 toward,float overhead){
      float a=age*6.283185;
      float r=mix(2.65+seed.y*.30,.38,smoothstep(.48,1.0,age));
      float rear=max(0.0,sin(a));
      float hemisphere=seed.z<.5?-1.0:1.0;
      float lift=pow(rear,1.35)*r*.52*hemisphere;
      float depth=-sin(a)*r*mix(1.0,.18,smoothstep(0.0,.35,rear));
      vec3 arch=right*(-cos(a)*r*mix(1.0,.72,smoothstep(0.0,.75,rear)))+toward*depth+vec3(0.0,lift+(seed.z-.5)*.07*(1.0-age),0.0);
      float rimRadius=2.45+seed.y*.15;
      // Both paths share an angular basis so intermediate views cannot
      // collapse the orbit by blending two opposite directions.
      vec3 rim=right*(-cos(a)*rimRadius)+toward*(-sin(a)*rimRadius)+vec3(0.0,(seed.z-.5)*.025,0.0);
      return mix(arch,rim,overhead);
    }
    void main(){
      float age=fract(seed.x+uTime*(.11+seed.w*.04));
      float scale=uSize*max(.0001,bhGrowth());
      vec3 eye=-modelViewMatrix[3].xyz;
      vec3 localEye=vec3(dot(eye,modelViewMatrix[0].xyz)/dot(modelViewMatrix[0].xyz,modelViewMatrix[0].xyz),
        dot(eye,modelViewMatrix[1].xyz)/dot(modelViewMatrix[1].xyz,modelViewMatrix[1].xyz),
        dot(eye,modelViewMatrix[2].xyz)/dot(modelViewMatrix[2].xyz,modelViewMatrix[2].xyz));
      vec3 viewOffset=localEye-bhCenter();
      float overhead=smoothstep(.40,.92,abs(viewOffset.y)/max(length(viewOffset),.0001));
      // Project the camera's right axis onto the disk. Unlike the eye's
      // horizontal position this remains defined directly above the center.
      vec3 right=vec3(modelViewMatrix[0].x/dot(modelViewMatrix[0].xyz,modelViewMatrix[0].xyz),0.0,
        modelViewMatrix[2].x/dot(modelViewMatrix[2].xyz,modelViewMatrix[2].xyz));
      right=length(right)>.0001?normalize(right):vec3(1.0,0.0,0.0);
      vec3 toward=vec3(-right.z,0.0,right.x);
      vec3 q=bhParticlePath(age,right,toward,overhead);
      vec3 tangent=bhParticlePath(min(.9999,age+.001),right,toward,overhead)-bhParticlePath(max(0.0,age-.001),right,toward,overhead);
      vec4 mv=modelViewMatrix*vec4(bhCenter()+q*scale,1.0);
      vec2 along=normalize((modelViewMatrix*vec4(tangent,0.0)).xy+vec2(.00001));
      mv.xy+=(along*position.x*(.035+.125*seed.w)+vec2(-along.y,along.x)*position.y*.007)*scale*length(modelViewMatrix[0].xyz);
      vUv=uv;vAlpha=smoothstep(0.0,.07,age)*(1.0-smoothstep(.94,1.0,age))*bhFade();
      gl_Position=projectionMatrix*mv;vParticleScreen=gl_Position;
      vec4 center=modelViewMatrix*vec4(bhCenter(),1.0);vParticleCenter=projectionMatrix*center;
      float projectedRadius=2.15*scale*length(modelViewMatrix[0].xyz)/max(.01,-center.z);
      vParticleRadius=vec2(projectionMatrix[0][0],projectionMatrix[1][1])*projectedRadius*.5;
    }`,{},true);
  // Transparent particles are excluded from native transmission capture and
  // drawn after both lenses and the light disk. Opaque scene depth still occludes them.
  particles.transparent=true;particles.userData.ownLifecycle=true;
  instanced(new THREE.PlaneGeometry(1,1),cap,1,particles,4).name='black-hole-infall';
  // A separate, thick, colourless refraction volume surrounds the thin light
  // disk. It renders first so the central horizon and halo stay intact.
  const outerLens=new THREE.MeshPhysicalMaterial({transmission:1,roughness:0,metalness:0,transparent:true,depthWrite:false,side:THREE.FrontSide});
  outerLens.uniforms={...uniforms,...lifeUniforms};
  outerLens.vertexShader=`uniform float uSize;${motion}
    varying vec3 vLensPoint,vLensEye;
    varying vec4 vDiskScreen,vDiskCenterClip;varying vec2 vDiskRadius;
    void main(){
      const vec3 axes=vec3(3.05,.58,3.05);
      float scale=uSize*max(.0001,bhGrowth());
      vec3 eye=-modelViewMatrix[3].xyz;
      vec3 localEye=vec3(dot(eye,modelViewMatrix[0].xyz)/dot(modelViewMatrix[0].xyz,modelViewMatrix[0].xyz),
        dot(eye,modelViewMatrix[1].xyz)/dot(modelViewMatrix[1].xyz,modelViewMatrix[1].xyz),
        dot(eye,modelViewMatrix[2].xyz)/dot(modelViewMatrix[2].xyz,modelViewMatrix[2].xyz));
      vLensPoint=position/axes;vLensEye=(localEye-bhCenter())/(axes*scale);
      vec4 center=modelViewMatrix*vec4(bhCenter(),1.0);
      gl_Position=projectionMatrix*modelViewMatrix*vec4(bhCenter()+position*scale,1.0);
      vDiskScreen=gl_Position;vDiskCenterClip=projectionMatrix*center;
      float projectedRadius=2.15*scale*length(modelViewMatrix[0].xyz)/max(.01,-center.z);
      vDiskRadius=vec2(projectionMatrix[0][0],projectionMatrix[1][1])*projectedRadius*.5;
    }`;
  outerLens.fragmentShader=`uniform float uSize,uDetail;${motion}${turbulence}${gravity}
    uniform sampler2D transmissionSamplerMap;uniform vec2 transmissionSamplerSize;
    varying vec3 vLensPoint,vLensEye;varying vec4 vDiskScreen,vDiskCenterClip;varying vec2 vDiskRadius;
    void main(){
      float fade=bhFade();if(fade<.001||vDiskCenterClip.w<=0.0)discard;
      // Ray distance in unit-sphere space gives a continuous convex footprint.
      // There is no annular hole or angular deformation of the silhouette.
      vec3 ray=normalize(vLensPoint-vLensEye);
      float r=clamp(length(cross(vLensPoint,ray)),0.0,1.0);
      float coverage=(1.0-smoothstep(.96,1.0,r))*fade;
      if(coverage<.001)discard;
      vec2 uv=vDiskScreen.xy/vDiskScreen.w*.5+.5;
      vec2 center=vDiskCenterClip.xy/vDiskCenterClip.w*.5+.5;
      vec2 radius=max(abs(vDiskRadius),vec2(.00001));
      vec2 q=(uv-center)/radius,direction=q/max(length(q),.0001);
      float angle=atan(q.y,q.x);
      float spiral=angle+2.6*log(r+.13)+uTime*.8;
      float noise=bhFbm(vec2(cos(spiral),sin(spiral))*4.0+vec2(r*8.0+uTime*.9,r*3.0));
      // Halve outer displacement, retaining its footprint and smooth rim.
      // The central lens renders afterwards and protects the black horizon.
      float fieldDistance=mix(.25,.80,r*r);
      vec2 inset=.5/max(transmissionSamplerSize,vec2(1.0));
      vec2 delta=bhBackgroundOffset(uv,direction,fieldDistance,spiral,noise,radius,inset)*.5*(1.0-smoothstep(.85,1.0,r));
      vec3 background=texture2D(transmissionSamplerMap,clamp(uv+delta,inset,1.0-inset)).rgb;
      gl_FragColor=vec4(background,coverage);${output}
    }`;
  outerLens.onBeforeCompile=program=>{Object.assign(program.uniforms,outerLens.uniforms);program.vertexShader=outerLens.vertexShader;program.fragmentShader=outerLens.fragmentShader;outerLens.userData.transmissionUniforms=program.uniforms;};
  outerLens.customProgramCacheKey=()=>outerLens.vertexShader+'\n'+outerLens.fragmentShader;
  outerLens.userData.ownLifecycle=true;materials.add(outerLens);
  mesh(new THREE.SphereGeometry(1,96,48).scale(3.05,.58,3.05),outerLens,0).name='black-hole-outer-lens';
  return true;
}

// A single clockwise sweep. All layers share the same head/tail clock and arc.
function buildAzureSweepEffect({THREE,spec,cap,mesh,instanced,shader,output}) {
  if(spec.id!=='azure-sweep')return false;
  const motion=`
    uniform float uTime;
    varying vec2 vSweep;
    varying float vTaper,vSeed;
    float sweepHead(){return mix(.012,1.0,smoothstep(.08,.32,uTime));}
    float sweepTail(){return smoothstep(.42,.85,uTime);}
    float sweepTaper(float x){return pow(max(0.0,sin(x*3.14159265)),.45);}
  `;
  const vertex=`${motion}
    #if SWEEP_LAYER == 3
    attribute vec4 seed;
    #endif
    void main(){
      float tail=sweepTail(),head=sweepHead(),x=uv.x;
      float along=mix(tail,head,x),taper=sweepTaper(x);
      float angle=-2.35+along*5.235987756;
      float radius=3.0;
      vSeed=0.0;
      #if SWEEP_LAYER == 0
        radius-=(1.0-uv.y)*.9*taper;
      #elif SWEEP_LAYER == 1
        radius+=(uv.y-.5)*.48*taper;
      #elif SWEEP_LAYER == 2
        radius+=(uv.y-.5)*.056*taper;
      #else
        vSeed=seed.x;
        radius-=(.09+seed.x*.68)*taper;
        radius+=(uv.y-.5)*(.012+seed.y*.018)*taper;
        radius+=sin(along*19.0+seed.z*6.283-uTime*4.0)*.012*taper;
      #endif
      vec3 p=vec3(cos(angle)*radius,1.0,sin(angle)*radius);
      #if SWEEP_LAYER == 0
        p.y+=sin(x*3.14159265)*(1.0-uv.y)*.045;
      #elif SWEEP_LAYER == 3
        p.y+=.025;
      #endif
      vSweep=vec2(x,uv.y);vTaper=taper;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(p*uSize,1.0);
    }
  `;
  const fragment=`uniform float uTime;uniform vec3 uColor;
    varying vec2 vSweep;varying float vTaper,vSeed;
    void main(){
      float x=vSweep.x,y=vSweep.y;
      float fade=smoothstep(0.0,.04,uTime)*(1.0-smoothstep(.58,.85,uTime));
      float ends=smoothstep(0.0,.035,x)*(1.0-smoothstep(.985,1.0,x));
      float alpha=0.0;vec3 color=uColor;
      #if SWEEP_LAYER == 0
        float flow=y*49.0+x*8.0-uTime*5.0+sin(x*14.0)*.45;
        float grain=pow(.5+.5*sin(flow),10.0)*(1.0-smoothstep(.6,2.0,fwidth(flow)));
        float edge=smoothstep(0.0,.9,y);
        alpha=(.08+.35*edge+grain*.12*uDetail)*smoothstep(0.0,.22,y);
        color=mix(uColor*.68,uColor*1.1,edge);
      #elif SWEEP_LAYER == 1
        float d=abs(y-.5)*2.0;
        alpha=exp(-d*d*6.0)*(1.0-smoothstep(.72,1.0,d))*.34*uDetail;
        color=mix(uColor,vec3(.28,.85,1.0),.18);
      #elif SWEEP_LAYER == 2
        float d=abs(y-.5)*2.0;
        alpha=(1.0-smoothstep(.12,1.0,d))*.98;
        color=mix(uColor,vec3(.85,1.0,1.0),.80);
      #else
        float ribbon=1.0-smoothstep(.1,1.0,abs(y-.5)*2.0);
        float stream=smoothstep(.02+vSeed*.12,.25+vSeed*.12,x)*(1.0-smoothstep(.72+vSeed*.15,1.0,x));
        alpha=ribbon*stream*(.26+.16*uDetail);
        color=mix(uColor,vec3(.3,.8,1.0),.28);
      #endif
      alpha*=fade*ends;
      if(alpha<.002)discard;
      gl_FragColor=vec4(color,alpha);${output}
    }
  `;
  // Plane UVs describe a ribbon, not a world-facing quad. Reused for every frame.
  for(const [layer,name,order] of [[0,'blade',1],[1,'halo',2],[2,'edge',4]]){
    const material=shader(fragment,vertex,{},layer!==0,{SWEEP_LAYER:layer});
    material.userData.ownLifecycle=true;
    mesh(new THREE.PlaneGeometry(1,1,192,1),material,order).name='azure-sweep-'+name;
  }
  const streaks=shader(fragment,vertex,{},true,{SWEEP_LAYER:3});
  streaks.userData.ownLifecycle=true;
  instanced(new THREE.PlaneGeometry(1,1,192,1),cap,1,streaks,3).name='azure-sweep-streaks';
  return true;
}

// World-space blade history only: no sword mesh, input listeners, camera or animation loop.
function createWeaponSmearEffect(THREE,spec,options={}) {
  const spatial=spec.id==='spatial-smear';
  const group=new THREE.Group();group.name=spec.id;
  const capacity=64,lifetime=.18,positions=new Float32Array(capacity*6),uvs=new Float32Array(capacity*4),ages=new Float32Array(capacity*2),indices=[];
  const bases=Array.from({length:capacity},()=>new THREE.Vector3()),tips=Array.from({length:capacity},()=>new THREE.Vector3()),times=new Float64Array(capacity);
  for(let i=0;i<capacity;i++){uvs.set([i/(capacity-1),0,i/(capacity-1),1],i*4);if(i<capacity-1){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}}
  const inverse=new THREE.Matrix4(),base=new THREE.Vector3(),tip=new THREE.Vector3(),localBase=new THREE.Vector3(),localTip=new THREE.Vector3(0,1,0),a=new THREE.Vector3(),b=new THREE.Vector3();
  let weapon=null,count=0,time=0,stoppedAt=-1,disposed=false,settings;
  const uniforms={uColor:{value:new THREE.Color()},uDetail:{value:1},uDensity:{value:.5}};
  const vertex='attribute float aAge;varying vec2 vUv;varying float vAge;void main(){vUv=uv;vAge=aAge;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}';
  const fragment=`uniform vec3 uColor;uniform float uDetail,uDensity;varying vec2 vUv;varying float vAge;
    void main(){float age=clamp(vAge,0.0,1.0),y=vUv.y;float fade=pow(1.0-age,1.35);float alpha;vec3 color=uColor;
    #if SMEAR_LAYER == 0
      float lines=0.0;for(int i=0;i<8;i++){float f=float(i);float center=.12+f*.105;float aa=max(fwidth(y),.002);lines+=(1.0-smoothstep(.005,.005+aa,abs(y-center)))*step(f+.5,uDensity*8.0);}
      // Make the fresh leading face readable across the blade, not just at its tip.
      // Retain the actual weapon endpoints and the existing width control.
      float head=1.0-smoothstep(0.0,.28,age);
      float body=mix(.12+.35*y,.42+.12*y,head);
      alpha=(body+lines*.13*uDetail)*smoothstep(0.0,.08,y)*fade;
    #elif SMEAR_LAYER == 1
      alpha=exp(-pow((1.0-y)*7.5,2.0))*.48*uDetail*fade;
    #else
      float aa=max(fwidth(y),.002);alpha=(1.0-smoothstep(.01,.022+aa,1.0-y))*.95*fade;color=mix(uColor,vec3(.86,1.,1.),.8);
    #endif
    if(alpha<.002)discard;gl_FragColor=vec4(color,alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }`;
  const spatialVertex=vertex.replace('void main(){','varying vec4 vScreen;void main(){').replace('gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);','vScreen=projectionMatrix*modelViewMatrix*vec4(position,1.0);gl_Position=vScreen;');
  const refraction=`uniform float uDetail;varying vec2 vUv;varying float vAge;varying vec4 vScreen;
    uniform sampler2D transmissionSamplerMap;uniform vec2 transmissionSamplerSize;
    void main(){
      // Zero-thickness sheets must not sample the transmission capture while writing it.
      #ifdef FLIP_SIDED
        // uDetail is clamped to a positive value. Keep the original no-write
        // discard at runtime, but retain an output for ANGLE's validation.
        if(uDetail>=0.0)discard;
        gl_FragColor=vec4(0.0);
      #else
      float age=clamp(vAge,0.0,1.0),y=vUv.y;
      float coverage=pow(1.0-age,1.35)*smoothstep(0.0,.08,y)*(1.0-smoothstep(.96,1.0,y));
      if(coverage<.002||vScreen.w<=0.0)discard;
      vec2 screen=vScreen.xy/vScreen.w*.5+.5;
      // Screen derivatives follow the real ribbon, including arbitrary weapon rotations.
      vec2 dx=dFdx(vUv),dy=dFdy(vUv),pixel=vec2(dFdx(screen.x),dFdy(screen.y));
      float det=dx.x*dy.y-dx.y*dy.x;
      if(abs(det)<1e-10)discard;
      vec2 across=vec2(-dy.x,dx.x)/det*pixel,flow=vec2(dy.y,-dx.y)/det*pixel;
      flow=flow/max(length(flow),1e-6)*min(length(across)*.28,.09);
      float band=sin(y*66.0+sin(age*13.0)*1.25-age*19.0);
      float fine=sin(y*157.0+age*33.0)*.12;
      vec2 delta=(flow*(.35+.65*band+fine)+across*(band*.065+fine*.04))*uDetail*coverage;
      vec2 inset=.5/max(transmissionSamplerSize,vec2(1.0));
      float edge=max(0.0,min(min(screen.x-inset.x,1.0-inset.x-screen.x),min(screen.y-inset.y,1.0-inset.y-screen.y)));
      delta*=smoothstep(0.0,max(.04,length(delta)*1.35),edge);
      gl_FragColor=vec4(texture2D(transmissionSamplerMap,clamp(screen+delta,inset,1.0-inset)).rgb,coverage);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      #endif
    }`;
  // A neutral halo with sparse fine lines; density never changes the refractive face.
  const spatialGlow=fragment.replace('*.48*uDetail*fade','*.16*uDetail*fade').replace('if(alpha<.002)discard;',`
    #if SMEAR_LAYER == 1
      float lines=0.0;for(int i=0;i<8;i++){float f=float(i),center=.12+f*.105,aa=max(fwidth(y),.002);lines+=(1.0-smoothstep(.004,.004+aa,abs(y-center)))*step(f+.5,uDensity*8.0);}
      alpha+=lines*.055*uDetail*fade;
    #endif
    if(alpha<.002)discard;`);
  const geometries=[],materials=[];
  for(let layer=0;layer<3;layer++){
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('uv',new THREE.BufferAttribute(uvs,2));geometry.setAttribute('aAge',new THREE.BufferAttribute(ages,1).setUsage(THREE.DynamicDrawUsage));geometry.setIndex(indices);geometry.setDrawRange(0,0);geometries.push(geometry);
    let material;
    if(spatial&&layer===0){
      material=new THREE.MeshPhysicalMaterial({transmission:1,roughness:0,metalness:0,side:THREE.DoubleSide,transparent:true,depthTest:true,depthWrite:false});
      material.forceSinglePass=true;material.uniforms=uniforms;material.vertexShader=spatialVertex;material.fragmentShader=refraction;
      material.onBeforeCompile=program=>{Object.assign(program.uniforms,uniforms);program.vertexShader=material.vertexShader;program.fragmentShader=material.fragmentShader;material.userData.transmissionUniforms=program.uniforms;};
      material.customProgramCacheKey=()=>material.vertexShader+'\n'+material.fragmentShader;
    }else material=new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:spatial?spatialGlow:fragment,uniforms,defines:{SMEAR_LAYER:layer},side:THREE.DoubleSide,transparent:true,depthTest:true,depthWrite:false,blending:layer===0?THREE.NormalBlending:THREE.AdditiveBlending});
    materials.push(material);
    const mesh=new THREE.Mesh(geometry,material);mesh.name=spec.id+'-'+['blade','halo','edge'][layer];mesh.frustumCulled=false;mesh.renderOrder=layer+1;group.add(mesh);
  }
  function setOptions(next={}){
    if(disposed)return;settings={color:spec.color,size:1,speed:1,detail:1,density:.5,...settings,...next};
    delete settings.quantity;delete settings.spread;delete settings.panelCount;
    for(const key of ['size','speed','detail','density'])settings[key]=THREE.MathUtils.clamp(Number(settings[key])||(key==='density'?.125:.25),key==='density'?.125:.25,key==='density'||key==='size'?1:2);
    if(!/^#[0-9a-f]{6}$/i.test(settings.color))settings.color=spec.color;
    uniforms.uColor.value.set(settings.color);uniforms.uDetail.value=settings.detail;uniforms.uDensity.value=settings.density;rebuild();
  }
  function rebuild(){
    group.updateWorldMatrix(true,false);inverse.copy(group.matrixWorld).invert();
    for(let i=0;i<count;i++){b.copy(tips[i]);a.copy(tips[i]).lerp(bases[i],settings.size);a.applyMatrix4(inverse);b.applyMatrix4(inverse);a.toArray(positions,i*6);b.toArray(positions,i*6+3);ages[i*2]=ages[i*2+1]=Math.min(1,(time-times[i])/lifetime);}
    for(const g of geometries){g.attributes.position.needsUpdate=true;g.attributes.aAge.needsUpdate=true;g.setDrawRange(0,Math.max(0,count-1)*6);}
  }
  function removeFirst(){for(let i=1;i<count;i++){bases[i-1].copy(bases[i]);tips[i-1].copy(tips[i]);times[i-1]=times[i];}count--;}
  function update(dt){
    if(disposed||!Number.isFinite(dt)||dt<0||api.finished)return;
    time+=dt*settings.speed;while(count&&time-times[0]>lifetime)removeFirst();
    if(weapon&&stoppedAt<0){
      weapon.updateWorldMatrix(true,false);base.copy(localBase).applyMatrix4(weapon.matrixWorld);tip.copy(localTip).applyMatrix4(weapon.matrixWorld);
      const length=base.distanceTo(tip);if(Number.isFinite(length)&&length>1e-6){
        if(dt>.25||(count&&Math.max(base.distanceTo(bases[count-1]),tip.distanceTo(tips[count-1]))>length*3))count=0;
        if(!count||Math.max(base.distanceToSquared(bases[count-1]),tip.distanceToSquared(tips[count-1]))>length*length*1e-10){
          if(count===capacity)removeFirst();bases[count].copy(base);tips[count].copy(tip);times[count]=time;count++;
        }
      }else count=0;
    }
    rebuild();group.visible=!api.finished;
  }
  function reset(){if(disposed)return;count=0;time=0;stoppedAt=-1;group.visible=true;rebuild();}
  function stop(){if(!disposed&&stoppedAt<0)stoppedAt=time;}
  function attachWeapon(object,{base:root=[0,0,0],tip:end=[0,1,0]}={}){
    if(disposed)return api;if(!object?.isObject3D)throw new TypeError('attachWeapon requires a THREE.Object3D');
    const read=(value,target)=>{if(value?.isVector3)target.copy(value);else if(Array.isArray(value)&&value.length===3)target.fromArray(value);else throw new TypeError('Blade points must be Vector3 or [x,y,z]');if(![target.x,target.y,target.z].every(Number.isFinite))throw new TypeError('Blade points must be finite');};
    read(root,a);read(end,b);if(a.distanceToSquared(b)<1e-12)throw new RangeError('Blade base and tip must differ');
    localBase.copy(a);localTip.copy(b);weapon=object;reset();return api;
  }
  function detachWeapon(){weapon=null;stop();}
  function dispose(){if(disposed)return;disposed=true;weapon=null;count=0;group.visible=false;group.removeFromParent();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();group.clear();}
  const api={group,update,setOptions,reset,stop,dispose,attachWeapon,detachWeapon,hit(){},setDirection(){},setEndpoints(){},get settings(){return {...settings};},get elapsed(){return time;},get particleCount(){return 0;},get lifecycle(){return {start:.001,end:lifetime};},get phase(){return api.finished?'finished':stoppedAt>=0?'ending':time<.001?'starting':'active';},get finished(){return disposed||(stoppedAt>=0&&time-stoppedAt>=lifetime-1e-9);}};
  setOptions(options);return api;
}

// Native Three.js transmission captures the real opaque scene. No host render hook.
function buildSpatialSweepEffect({THREE,spec,cap,uniforms,lifeUniforms,materials,mesh,instanced,shader,output}) {
  if(spec.id!=='spatial-sweep')return false;
  const vertex=`uniform float uTime;
    varying vec2 vSweep;varying vec4 vScreen;varying vec2 vTangent,vRadial;varying float vSeed;
    #if SPATIAL_LAYER == 3
      attribute vec4 seed;
    #endif
    void main(){
      float head=mix(.012,1.0,smoothstep(.08,.32,uTime)),tail=smoothstep(.42,.85,uTime);
      float x=uv.x,along=mix(tail,head,x);
      // Broad leading edge covers 1.60 of the preview sword's 3.00 units.
      // Keep only the trailing end pointed; the head reaches the blade midsection.
      float taper=max(pow(max(0.0,sin(x*3.14159265)),.45),smoothstep(.72,.96,x));
      float angle=-2.35+along*5.235987756,radius=3.0;
      vSeed=0.0;
      #if SPATIAL_LAYER == 0
        radius-=(1.0-uv.y)*1.6*taper;
      #elif SPATIAL_LAYER == 1
        radius+=(uv.y-.5)*.32*taper;
      #elif SPATIAL_LAYER == 2
        radius+=(uv.y-.5)*.040*taper;
      #else
        vSeed=seed.x;radius-=(.12+seed.x*1.22)*taper;
        radius+=(uv.y-.5)*(.010+seed.y*.012)*taper;
        radius+=sin(along*22.0+seed.z*6.283-uTime*12.0)*.009*taper;
      #endif
      vec3 radial=vec3(cos(angle),0.0,sin(angle)),tangent=vec3(-sin(angle),0.0,cos(angle));
      vec3 p=radial*radius+vec3(0,1,0);
      vSweep=uv;
      vScreen=projectionMatrix*modelViewMatrix*vec4(p*uSize,1.0);
      vec4 tangentClip=projectionMatrix*modelViewMatrix*vec4((p+tangent*.65)*uSize,1.0);
      vec4 radialClip=projectionMatrix*modelViewMatrix*vec4((p+radial*.24)*uSize,1.0);
      vTangent=(tangentClip.xy/tangentClip.w-vScreen.xy/vScreen.w)*.5;
      vRadial=(radialClip.xy/radialClip.w-vScreen.xy/vScreen.w)*.5;
      gl_Position=vScreen;
    }`;
  const common=`uniform float uTime;varying vec2 vSweep;varying vec4 vScreen;
    varying vec2 vTangent,vRadial;varying float vSeed;
    float sweepFade(){return smoothstep(.0,.04,uTime)*(1.0-smoothstep(.58,.85,uTime));}
    float sweepEnds(){return smoothstep(.0,.035,vSweep.x)*(1.0-smoothstep(.985,1.0,vSweep.x));}
  `;
  const refraction=`uniform float uDetail;${common}
    uniform sampler2D transmissionSamplerMap;uniform vec2 transmissionSamplerSize;
    void main(){
      // Three.js draws DoubleSide transmission backs into its opaque capture.
      // This zero-thickness sheet must not sample that same target while writing it.
      #ifdef FLIP_SIDED
        // uDetail is clamped to a positive value. Keep the original no-write
        // discard at runtime, but retain an output for ANGLE's validation.
        if(uDetail>=0.0)discard;
        gl_FragColor=vec4(0.0);
      #else
      float fade=sweepFade(),ends=sweepEnds(),x=vSweep.x,y=vSweep.y;
      float feather=smoothstep(.0,.13,y)*(1.0-smoothstep(.90,1.0,y));
      float coverage=fade*ends*feather;
      if(coverage<.002||vScreen.w<=0.0)discard;
      vec2 uv=vScreen.xy/vScreen.w*.5+.5;
      float band=sin(y*66.0+sin(x*13.0-uTime*8.0)*1.25-uTime*19.0);
      float fine=sin(y*157.0+x*17.0-uTime*33.0)*.12;
      float shear=(.20+.80*smoothstep(.0,.95,x))*(.50+.50*band+fine);
      // Tangential displacement stretches the backdrop along the swing; a smaller
      // radial ripple breaks it into compressed, fast-moving pressure bands.
      vec2 delta=(vTangent*(.20+shear*.95)+vRadial*(band*.32+fine))*uDetail*coverage;
      vec2 resolution=max(transmissionSamplerSize,vec2(1.0)),inset=.5/resolution;
      float edge=max(0.0,min(min(uv.x-inset.x,1.0-inset.x-uv.x),min(uv.y-inset.y,1.0-inset.y-uv.y)));
      delta*=smoothstep(.0,max(.04,length(delta)*1.35),edge);
      vec3 background=texture2D(transmissionSamplerMap,clamp(uv+delta,inset,1.0-inset)).rgb;
      // Neutral refraction: no blue fill, dark tint, fixed screenshot or fake reflection.
      gl_FragColor=vec4(background,coverage);${output}
      #endif
    }`;
  const lens=new THREE.MeshPhysicalMaterial({transmission:1,roughness:0,metalness:0,transparent:true,depthWrite:false,depthTest:true,side:THREE.DoubleSide});
  lens.forceSinglePass=true;lens.uniforms={...uniforms,...lifeUniforms};lens.defines={...lens.defines,SPATIAL_LAYER:0};
  lens.vertexShader='uniform float uSize;\n'+vertex;lens.fragmentShader=refraction;
  lens.onBeforeCompile=program=>{Object.assign(program.uniforms,lens.uniforms);program.vertexShader=lens.vertexShader;program.fragmentShader=lens.fragmentShader;lens.userData.transmissionUniforms=program.uniforms;};
  lens.customProgramCacheKey=()=>lens.vertexShader+'\n'+lens.fragmentShader;lens.userData.ownLifecycle=true;materials.add(lens);
  mesh(new THREE.PlaneGeometry(1,1,192,8),lens,1).name='spatial-sweep-refraction';
  const glow=`uniform vec3 uColor;${common}
    void main(){
      float x=vSweep.x,y=vSweep.y,d=abs(y-.5)*2.0;
      float intensity=mix(.08,1.0,smoothstep(.05,.92,x));
      float alpha;vec3 color=uColor;
      #if SPATIAL_LAYER == 1
        alpha=exp(-d*d*7.0)*(1.0-smoothstep(.7,1.0,d))*.18*uDetail*intensity;
      #elif SPATIAL_LAYER == 2
        alpha=(1.0-smoothstep(.05,1.0,d))*.98*intensity;
        color=mix(uColor,vec3(1.0),.72);
      #else
        float stream=smoothstep(.04+vSeed*.2,.35+vSeed*.2,x)*(1.0-smoothstep(.78,1.0,x));
        alpha=(1.0-smoothstep(.0,1.0,d))*stream*.09*uDetail;
      #endif
      alpha*=sweepFade()*sweepEnds();if(alpha<.002)discard;
      gl_FragColor=vec4(color,alpha);${output}
    }`;
  for(const [layer,name]of [[1,'halo'],[2,'edge']])mesh(new THREE.PlaneGeometry(1,1,192,1),shader(glow,vertex,{},true,{SPATIAL_LAYER:layer}),layer+1).name='spatial-sweep-'+name;
  instanced(new THREE.PlaneGeometry(1,1,192,1),cap,1,shader(glow,vertex,{},true,{SPATIAL_LAYER:3}),3).name='spatial-sweep-streaks';
  return true;
}

// Internal motion model shared by geometry, live playback and focused tests.
// Standalone exporters remove these internal exports; createEffect's API is unchanged.
const DARKCHAIN = Object.freeze({plasmaLife:.14,ejectionLife:.5,glintLife:.50,flareLife:.075,pressureLife:1.0,compressionStart:3.47,compressionScale:.65/3,coreFlashLife:.06,duration:5.15,lowerRadius:2.3,upperRadius:6.21,baseY:.04,height:4.4,centerY:2.24,chains:12,maxLinks:48,chainStart:.45,chainEnd:.85,chainBend:1.05,chainSettle:.4,orbStart:1.15,burst:3.65,settle:.036,attack:.012,overshoot:1.1,restRadius:.2,blastRadius:4.2,blastExpand:.08,breakTravel:.12,orbWarp:.125,blastPieces:252,blastLife:1.3,warpLife:1.5,warpCycles:10,warpPower:.495,warpRadius:4.2,waveRadius:10.6,waveWidth:4.3,waveExpand:.8,waveLife:.8,waveHeight:.18,arcGroups:6,arcLife:.16,fragmentScale:.5,fragmentImpulse:6.4,fragmentSpread:.6,auraTrail:.56,inkTrail:.84,auraCount:16,inkCount:12,inkMinRadius:7.8,inkRadius:10.1,inkCoreRadius:.72,inkTurnsMin:1,inkTurnsMax:2,inkLead:.18,inkPullLead:.28,fieldArcs:36,fieldLife:1.3});
// Thirty scheduled absorption beats; terminal compression overrides the final three core pulses.
const dcMacroBeats=[[1.35,.38],[1.85,.58],[2.30,.80],[2.70,1.02],[3.05,1.24],[3.35,1.45]];
const DARKCHAIN_BEATS=Object.freeze(dcMacroBeats.flatMap(([time,radius],i)=>Array.from({length:5},(_,j)=>Object.freeze([time+((dcMacroBeats[i+1]?.[0]??3.65)-time)*j/5,(dcMacroBeats[i-1]?.[1]??.2)+(radius-(dcMacroBeats[i-1]?.[1]??.2))*(j+1)/5]))));
const dcClamp=x=>Math.max(0,Math.min(1,x));
const dcSmooth=(a,b,x)=>{const q=dcClamp((x-a)/(b-a));return q*q*(3-2*q);};
// Continuous intake starts immediately; time eases in without an orbit-only phase.
// The gentle spiral and radial motion share a clock independent of orb pulses.
function darkchainInkState(time,seed,start=.32,out={}) {
  const span=DARKCHAIN.burst-start,q=dcClamp((time-start)/span),turns=DARKCHAIN.inkTurnsMin+(DARKCHAIN.inkTurnsMax-DARKCHAIN.inkTurnsMin)*seed[2];
  out.turns=DARKCHAIN.inkLead*q+(turns-DARKCHAIN.inkLead)*q*q;
  out.angularSpeed=(DARKCHAIN.inkLead+2*(turns-DARKCHAIN.inkLead)*q)/span;
  out.pull=q*(DARKCHAIN.inkPullLead+(1-DARKCHAIN.inkPullLead)*q);
  const outer=DARKCHAIN.inkMinRadius+(DARKCHAIN.inkRadius-DARKCHAIN.inkMinRadius)*seed[3];
  out.radius=outer+(DARKCHAIN.inkCoreRadius-outer)*out.pull;
  out.inwardSpeed=(outer-DARKCHAIN.inkCoreRadius)*(DARKCHAIN.inkPullLead+2*(1-DARKCHAIN.inkPullLead)*q)/span;
  // Positive XZ azimuth is clockwise viewed from +Y. Vary elevation without
  // tilting the orbit axis through the horizon, which can reverse projected motion.
  const angle=(seed[0]+out.turns)*Math.PI*2,baseLatitude=(seed[1]*2-1)*.96;
  const tilt=.2+seed[3]*.25;
  const latitude=baseLatitude*Math.cos(tilt)+Math.sqrt(1-baseLatitude*baseLatitude)*Math.sin(tilt)*Math.sin(angle+seed[2]*Math.PI*2);
  const side=Math.sqrt(1-latitude*latitude);
  out.x=Math.cos(angle)*side*out.radius;out.y=DARKCHAIN.centerY+latitude*out.radius;out.z=Math.sin(angle)*side*out.radius;return out;
}
// Staggered 70–110ms field flashes: fixed path per event, no all-off group gate.
function darkchainFieldArcState(time,slot,out={}) {
  if(time>=DARKCHAIN.burst){
    const us=Math.round((time-DARKCHAIN.burst)*1e6),period=110000+(slot%5)*11000,phase=us+slot*19000;
    out.event=1000+Math.floor(phase/period);out.age=(phase%period)/1e6;out.duration=.045+(slot%3)*.01;
    out.alpha=(us<25000||out.age<out.duration?1:0)*(1-dcSmooth(.9,DARKCHAIN.fieldLife,us/1e6));return out;
  }
  const period=143000+(slot%7)*9000,offset=650000+slot*17000;
  const stamp=Math.round(Math.min(time,DARKCHAIN.burst)*1e6),event=Math.floor((stamp-offset)/period);
  out.event=Math.max(0,event);out.age=(stamp-offset-event*period)/1e6;out.duration=.07+((slot+Math.max(0,event)*3)%5)*.01;
  out.alpha=event>=0&&out.age<out.duration?1:0;
  return out;
}
function darkchainState(time,out={}) {
  const t=Number.isFinite(time)?Math.max(0,time):0;let radius=DARKCHAIN.restRadius,beat=0;
  const pulseTime=Math.min(t,DARKCHAIN.compressionStart);
  for(const [start,target] of DARKCHAIN_BEATS){
    if(pulseTime<start)break;
    const age=pulseTime-start,peak=target*DARKCHAIN.overshoot;
    if(age<DARKCHAIN.attack){const q=dcClamp(age/DARKCHAIN.attack);radius+=(peak-radius)*(1-Math.pow(1-q,3));beat=Math.sin(q*Math.PI*.5);break;}
    if(age<DARKCHAIN.attack+DARKCHAIN.settle){const q=dcClamp((age-DARKCHAIN.attack)/DARKCHAIN.settle);radius=peak+(target-peak)*(1-Math.pow(1-q,2));beat=1-dcSmooth(0,1,q);break;}
    radius=target;
  }
  // Only the core changes scale: legacy blast, wave and fragment radii remain independent.
  if(t>=DARKCHAIN.compressionStart){
    // Preserve the original absorption brightness clock for particles and chains.
    beat=0;
    for(const [start] of DARKCHAIN_BEATS){
      if(t<start)break;const age=t-start;
      if(age<DARKCHAIN.attack){beat=Math.sin(dcClamp(age/DARKCHAIN.attack)*Math.PI*.5);break;}
      if(age<DARKCHAIN.attack+DARKCHAIN.settle){beat=1-dcSmooth(0,1,dcClamp((age-DARKCHAIN.attack)/DARKCHAIN.settle));break;}
    }
    const anchor=radius;
    const q=dcClamp((t-DARKCHAIN.compressionStart)/(DARKCHAIN.burst-DARKCHAIN.compressionStart));
    radius=anchor*(1-(1-DARKCHAIN.compressionScale)*q*(.35+.65*q));
  }
  out.radius=radius*dcSmooth(DARKCHAIN.orbStart,DARKCHAIN.orbStart+.12,t);
  out.beat=beat;out.flow=Math.max(0,t-DARKCHAIN.orbStart)*.36;
  for(const [start]of DARKCHAIN_BEATS)out.flow+=.03*dcSmooth(start-.044,start+.012,t);
  out.orbAlive=dcSmooth(DARKCHAIN.orbStart,DARKCHAIN.orbStart+.1,t)*(t<DARKCHAIN.burst?1:0);
  out.blastRadius=DARKCHAIN_BEATS.at(-1)[1]+(DARKCHAIN.blastRadius-DARKCHAIN_BEATS.at(-1)[1])*(1-Math.pow(1-dcClamp((t-DARKCHAIN.burst)/DARKCHAIN.blastExpand),3));
  const jetQ=dcClamp((t-DARKCHAIN.burst-DARKCHAIN.blastExpand)/(DARKCHAIN.blastLife-DARKCHAIN.blastExpand));
  out.jetTravel=1.25*(1-Math.pow(1-jetQ,3));
  out.jetFade=Math.pow(1-dcClamp((t-DARKCHAIN.burst-.25)/(DARKCHAIN.blastLife-.25)),2);
  const warpAge=t-DARKCHAIN.burst,warpQ=dcClamp(warpAge/DARKCHAIN.warpLife);
  out.warpFade=warpAge>=0?Math.pow(1-warpQ,1.25):0;
  // Signed refraction rebounds in place; the lens radius stays constant.
  out.warpKick=warpAge>=0&&warpAge<DARKCHAIN.warpLife?Math.sin(warpQ*Math.PI*2*DARKCHAIN.warpCycles)*Math.exp(-warpQ*3):0;
  out.waveRadius=DARKCHAIN_BEATS.at(-1)[1]+(DARKCHAIN.waveRadius-DARKCHAIN_BEATS.at(-1)[1])*(1-Math.pow(1-dcClamp((t-DARKCHAIN.burst)/DARKCHAIN.waveExpand),5));
  return out;
}
// Discharge clocks are deterministic; each event keeps its path fixed throughout the flash.
function darkchainArcState(time,slot,out={}) {
  time=Math.round(time*1e6)/1e6;
  // Integer microseconds prevent different dt partitions choosing opposite sides of a flash boundary.
  const period=190000+slot*13000,offset=Math.round(DARKCHAIN.orbStart*1e6)+slot*27000;
  const stamp=Math.round(Math.min(time,DARKCHAIN.burst)*1e6),event=Math.floor((stamp-offset)/period);
  const age=(stamp-offset-event*period)/1e6,duration=(50+((event*7+slot*3)%5+5)%5*10)/1000;
  out.event=Math.max(0,event);out.age=age;out.duration=duration;
  out.alpha=time>=DARKCHAIN.burst?1-dcSmooth(.04,DARKCHAIN.arcLife,time-DARKCHAIN.burst):(event>=0&&age<duration?1:0);
  out.flash=time>=DARKCHAIN.burst?1-dcSmooth(.012,.04,time-DARKCHAIN.burst):0;return out;
}
function darkchainTension(time) {
  const q=dcClamp((time-DARKCHAIN.chainEnd)/DARKCHAIN.chainSettle);
  return Math.exp(-1.6*q)*Math.cos(q*Math.PI*2)*(1-dcSmooth(.75,1,q));
}
function sampleDarkchainChain(chain,u,time,out=[0,0,0]) {
  for(let k=0;k<3;k++)out[k]=chain.start[k]+(chain.end[k]-chain.start[k])*u;
  const bend=darkchainTension(time),radial=Math.sin(u*Math.PI)*DARKCHAIN.chainBend*bend,side=Math.sin(u*Math.PI*2)*.16*bend;
  out[0]+=Math.cos(chain.angle)*radial-Math.sin(chain.angle)*side;out[2]+=Math.sin(chain.angle)*radial+Math.cos(chain.angle)*side;
  return out;
}
function darkchainBreakTime(chain,u) {
  return chain.impactTime+Math.abs(u-chain.impactU)/Math.max(chain.impactU,1-chain.impactU)*DARKCHAIN.breakTravel;
}
function darkchainFragmentSpeed(scale,seed=0) {return (DARKCHAIN.fragmentImpulse+seed*DARKCHAIN.fragmentSpread)/Math.sqrt(scale);}
function darkchainLayout(seed) {
  let state=seed>>>0;const random=()=>{state=(state*1664525+1013904223)>>>0;return state/4294967296;};
  const chains=[],tau=Math.PI*2;
  for(let i=0;i<DARKCHAIN.chains;i++){
    const angle=(i+.5)*tau/DARKCHAIN.chains+(random()-.5)*.08,tier=i%2;
    const sourceRadius=tier?DARKCHAIN.upperRadius:DARKCHAIN.lowerRadius,targetRadius=tier?DARKCHAIN.lowerRadius:DARKCHAIN.upperRadius;
    const rootRadius=Math.sqrt(.04+random()*(.82*.82-.04))*sourceRadius,endAngle=angle+(random()-.5)*.10,endRadius=Math.sqrt(.04+random()*(.82*.82-.04))*targetRadius;
    const chain={tier,angle,phase:random()*tau,start:[0,DARKCHAIN.baseY+tier*DARKCHAIN.height,0],end:[0,DARKCHAIN.baseY+(1-tier)*DARKCHAIN.height,0],parameters:[],fragments:[],length:0,count:0,pitch:0};
    // Keep a straight strand clear of the orb by adjusting its anchors inside the sigils.
    // Never bend its middle or oscillate its endpoints to obtain clearance.
    for(let attempt=0;attempt<=20;attempt++){
      const blend=attempt/20,r0=rootRadius+(.82*sourceRadius-rootRadius)*blend,r1=endRadius+(.82*targetRadius-endRadius)*blend;
      chain.start[0]=Math.cos(angle)*r0;chain.start[2]=Math.sin(angle)*r0;chain.end[0]=Math.cos(endAngle)*r1;chain.end[2]=Math.sin(endAngle)*r1;
      const dx=chain.end[0]-chain.start[0],dy=chain.end[1]-chain.start[1],dz=chain.end[2]-chain.start[2];
      const u=dcClamp(-(chain.start[0]*dx+(chain.start[1]-DARKCHAIN.centerY)*dy+chain.start[2]*dz)/(dx*dx+dy*dy+dz*dz));
      if(Math.hypot(chain.start[0]+dx*u,chain.start[1]+dy*u-DARKCHAIN.centerY,chain.start[2]+dz*u)>=1.98)break;
    }
    chain.length=Math.hypot(...chain.end.map((v,k)=>v-chain.start[k]));
    chain.count=Math.min(DARKCHAIN.maxLinks,Math.max(16,Math.ceil(chain.length/.18)+1));chain.pitch=chain.length/(chain.count-1);
    for(let j=0;j<chain.count;j++)chain.parameters.push(j/(chain.count-1));
    const delta=chain.end.map((v,k)=>v-chain.start[k]);
    chain.impactU=dcClamp(-(chain.start[0]*delta[0]+(chain.start[1]-DARKCHAIN.centerY)*delta[1]+chain.start[2]*delta[2])/(chain.length*chain.length));
    const closest=sampleDarkchainChain(chain,chain.impactU,DARKCHAIN.burst),distance=Math.hypot(closest[0],closest[1]-DARKCHAIN.centerY,closest[2]);
    const fraction=dcClamp((distance-DARKCHAIN_BEATS.at(-1)[1])/(DARKCHAIN.blastRadius-DARKCHAIN_BEATS.at(-1)[1]));
    chain.impactTime=DARKCHAIN.burst+DARKCHAIN.blastExpand*(1-Math.cbrt(1-fraction));
    chains.push(chain);
  }
  // Deterministic single links and short/long chunks, each with its own debris scale.
  for(const chain of chains)for(let first=0;first<chain.count;){
    const count=Math.min(chain.count-first,[1,2,3,5][Math.floor(random()*4)]),scale=[.55,.75,1,1.25,1.5][Math.floor(random()*5)];
    chain.fragments.push({first,count,center:(first+(count-1)*.5)/(chain.count-1),scale});first+=count;
  }
  return chains;
}
// Original stroke alphabet inspired by the reference: 24 distinct glyphs, not a repeated tick.
// Each glyph has at most eight strokes. Coordinates form a compact square character cell.
const DARKCHAIN_GLYPHS = Object.freeze([
 [[-.5,-.8,-.5,.8],[-.5,.8,.5,.8],[-.5,.15,.35,.15],[.35,.15,.35,-.3]],
 [[-.5,.8,.5,.8],[.5,.8,-.4,0],[-.4,0,.45,-.15],[.45,-.15,-.4,-.8]],
 [[0,-.8,0,.75],[-.55,.45,0,.1],[.55,.65,0,.1],[-.55,.45,-.55,.8]],
 [[-.55,-.35,0,.8],[0,.8,.55,-.35],[.55,-.35,-.55,-.35],[0,-.35,0,-.8]],
 [[-.5,-.7,-.5,.1],[-.5,.1,.05,.7],[0,-.7,0,0],[0,0,.55,.6]],
 [[-.45,.8,.35,.35],[.35,.35,-.35,-.1],[-.35,-.1,.45,-.8]],
 [[-.55,-.8,.55,-.8],[.55,-.8,.55,.75],[.55,.75,-.5,.75],[-.5,.75,-.5,-.3],[-.5,-.3,.15,-.3],[.15,-.3,.15,.25]],
 [[0,.8,.5,.2],[.5,.2,0,-.4],[0,-.4,-.5,.2],[-.5,.2,0,.8],[0,-.4,.3,-.8]],
 [[-.5,.6,.05,0],[.05,0,-.5,-.6],[-.5,-.6,-.5,.6],[.05,0,.55,.6],[.55,.6,.55,-.6],[.55,-.6,.05,0]],
 [[-.45,-.8,-.45,.8],[.45,-.8,.45,.8],[-.45,.5,.45,.5],[-.45,0,.45,0],[-.45,-.5,.45,-.5]],
 [[-.55,-.6,-.35,.8],[-.2,-.7,0,.7],[.15,-.8,.35,.6],[.5,-.8,.6,.5]],
 [[-.55,.7,.55,.7],[.55,.7,0,.1],[0,.1,-.55,.7],[0,.1,0,-.8],[-.4,-.35,0,-.6]],
 [[-.5,.8,-.5,-.65],[-.5,-.65,.35,-.65],[.35,-.65,.35,.1],[.35,.1,-.05,.1],[-.05,.1,-.05,.55]],
 [[-.5,-.8,-.5,.8],[-.5,.8,.4,.5],[.4,.5,-.5,.1],[-.5,.1,.55,-.8]],
 [[-.55,.8,-.1,.45],[-.1,.45,-.5,.05],[-.5,.05,-.1,-.45],[.05,.45,.5,.05],[.5,.05,.1,-.45],[.1,-.45,.55,-.8]],
 [[0,.8,-.5,.35],[-.5,.35,0,-.1],[0,-.1,.5,.35],[.5,.35,0,.8],[0,-.1,0,-.8],[-.4,-.5,.4,-.5]],
 [[-.5,-.8,.5,.8],[-.5,.8,.5,-.8],[-.5,.8,-.5,.35],[.5,-.8,.5,-.35]],
 [[-.5,.65,.5,.65],[.5,.65,.1,.1],[.1,.1,.5,-.65],[.5,-.65,-.5,-.65],[-.5,-.65,-.1,-.1],[-.1,-.1,-.5,.65]],
 [[0,.8,0,-.8],[-.55,.45,0,.1],[.55,.45,0,.1],[-.55,-.2,0,-.55],[.55,-.2,0,-.55]],
 [[-.5,.8,.1,.8],[.1,.8,.5,.35],[.5,.35,-.4,.35],[-.4,.35,-.4,-.35],[-.4,-.35,.4,-.35],[.4,-.35,.4,-.8]],
 [[-.5,.75,-.1,.75],[-.1,.75,.4,.15],[.4,.15,0,-.65],[0,-.65,-.5,-.65],[-.5,-.65,-.5,.1],[-.5,.1,.4,.15]],
 [[-.5,.8,.45,.35],[.45,.35,-.5,-.1],[-.5,-.1,.45,-.55],[-.5,-.55,.1,-.8]],
 [[-.5,-.8,-.5,.4],[-.5,.4,0,.8],[0,.8,.5,.4],[.5,.4,.5,-.8],[0,-.5,0,.35],[-.5,-.1,.5,-.1]],
 [[-.55,.7,.55,.7],[-.55,.2,.55,.2],[-.55,-.3,.55,-.3],[-.55,-.8,.55,-.8],[.35,-.8,-.1,-.3]]
].map(glyph=>Object.freeze(glyph.map(stroke=>Object.freeze(stroke)))));
function buildDarkchainEffect({THREE,spec,cap,uniforms,materials,animated,mesh,instanced,shader,output}) {
  if(spec.id!=='darkchain-detonation')return false;
  const layout=darkchainLayout(spec.seed),motion={},stages=[];
  const shared={uJetTravel:{value:0},uJetFade:{value:1},uWarpKick:{value:0},uWarpFade:{value:0},uChainTension:{value:1},uFlow:{value:0},uOrbRadius:{value:0},uBeat:{value:0},uOrbAlive:{value:0},uBlastRadius:{value:DARKCHAIN_BEATS.at(-1)[1]},uWaveRadius:{value:DARKCHAIN_BEATS.at(-1)[1]}};
  const constants=Object.entries(DARKCHAIN).map(([key,value])=>`const float DC_${key}=${Number(value).toFixed(6)};`).join('\n');
  const releaseRadius=DARKCHAIN_BEATS.at(-1)[1];
  const coreReleaseRadius=darkchainState(DARKCHAIN.burst).radius;
  const common=`const float DC_coreReleaseRadius=${coreReleaseRadius.toFixed(6)};const float DC_releaseRadius=${releaseRadius.toFixed(6)};uniform float uJetTravel,uJetFade,uWarpKick,uWarpFade,uTime,uChainTension,uFlow,uOrbRadius,uBeat,uOrbAlive,uBlastRadius,uWaveRadius;const float TAU=6.28318530718;${constants}
    float hash21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise21(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),mix(hash21(i+vec2(0,1)),hash21(i+1.0),f.x),f.y);}
    float mist(vec2 p){return noise21(p)*.57+noise21(p*2.07+3.1)*.29+noise21(p*4.13-1.7)*.14;}
    float charge(){return smoothstep(DC_orbStart,DC_burst,uTime);}
    float hash31(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
    float noise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(hash31(i),hash31(i+vec3(1,0,0)),f.x),mix(hash31(i+vec3(0,1,0)),hash31(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash31(i+vec3(0,0,1)),hash31(i+vec3(1,0,1)),f.x),mix(hash31(i+vec3(0,1,1)),hash31(i+vec3(1,1,1)),f.x),f.y),f.z);}
  `;
  const material=(fragment,vertex,additive=true,extra={})=>{const m=shader(common+'uniform vec3 uColor;\n'+fragment,common+vertex,{...shared,...extra},additive);m.userData.ownLifecycle=true;m.forceSinglePass=true;return m;};
  const add=(geometry,m,name,order,start,end)=>{const object=mesh(geometry,m,order);object.name=name;stages.push({object,start,end});return object;};
  function instances(base,attributes,count){const g=new THREE.InstancedBufferGeometry();g.setIndex(base.index.clone());for(const [key,a]of Object.entries(base.attributes))g.setAttribute(key,a.clone());base.dispose();for(const [key,[values,n]]of Object.entries(attributes))g.setAttribute(key,new THREE.InstancedBufferAttribute(values,n));g.instanceCount=count;return g;}
  const sigilVertex=`varying vec2 vDisk;uniform float uTier;
    void main(){vDisk=position.xy;float t=clamp(uTime/DC_chainStart,0.0,1.0),pop=1.0-pow(1.0-t,3.0)+sin(t*3.14159265)*.18;vec3 p=vec3(position.x*mix(DC_lowerRadius,DC_upperRadius,uTier)*pop,DC_baseY+uTier*DC_height,position.y*mix(DC_lowerRadius,DC_upperRadius,uTier)*pop);gl_Position=projectionMatrix*modelViewMatrix*vec4(p*uSize,1.0);}`;
  const glyphStrokes=new Float32Array(24*8*4);for(let g=0;g<24;g++)for(let i=0;i<8;i++)glyphStrokes.set(DARKCHAIN_GLYPHS[g][i]??[4,4,4,4],(g*8+i)*4);
  const sigilFragment=`varying vec2 vDisk;uniform float uTier;uniform vec4 uGlyphs[192];
    vec2 line(float d,float w){float aa=max(fwidth(d),.001),distance=abs(d);return vec2(1.0-smoothstep(w,w+aa,distance),exp(-pow(distance/(w*3.4+aa*1.5),1.5)));}
    vec2 segment(vec2 p,vec2 a,vec2 b,float width){vec2 v=b-a;return line(length(p-a-v*clamp(dot(p-a,v)/max(dot(v,v),.000001),0.0,1.0)),width);}
    vec2 magicLetter(vec2 p,float glyph){vec2 ink=vec2(0);for(int i=0;i<8;i++){vec4 stroke=uGlyphs[int(glyph)*8+i];ink=max(ink,segment(p,stroke.xy,stroke.zw,.065));}return ink;}
    void main(){float r=length(vDisk),a=atan(vDisk.y,vDisk.x),turn=uTime*.44*(uTier*2.0-1.0);
      vec2 edge=line(r-.965,.0035)+line(r-.935,.0025)*.8;
      vec2 frame=line(r-.84,.0025),hub=line(r-.23,.0025)+line(r-.205,.0018)*.7,glyphs=vec2(0),ornament=line(r-.30,.0015)+line(r-.545,.0015)+line(r-.615,.0015);
      for(int i=0;i<3;i++){
        float angle=1.57079633+float(i)*TAU/3.0,next=angle+TAU/3.0;
        vec2 axis=vec2(cos(angle),sin(angle)),other=vec2(cos(next),sin(next)),vertex=axis*.84,node=axis*.42;
        frame=max(frame,segment(vDisk,vertex,other*.84,.0025));
        frame=max(frame,segment(vDisk,axis*.23,vertex,.002));
        float corner=length(vDisk-vertex);frame=max(frame,(line(corner-.34,.002)+line(corner-.395,.002))*(1.0-smoothstep(.838,.845,r)));
        float small=length(vDisk-node);hub=max(hub,line(small-.115,.003));ornament=max(ornament,line(small-.095,.0015));
        float ticksAround=atan(vDisk.y-vertex.y,vDisk.x-vertex.x);ornament=max(ornament,line(sin(ticksAround*24.0),.07)*smoothstep(.348,.353,corner)*(1.0-smoothstep(.381,.387,corner))*(1.0-smoothstep(.838,.845,r)));
        vec2 q=vDisk-node;float rotation=angle+turn;q=mat2(cos(rotation),-sin(rotation),sin(rotation),cos(rotation))*q;
        vec2 symbol=line(length(q-vec2(.012,0))-.035,.004)*(1.0-smoothstep(.05,.055,q.x));
        symbol=max(symbol,segment(q,vec2(-.018,-.025),vec2(-.05,-.065),.004));symbol=max(symbol,segment(q,vec2(-.01,.03),vec2(-.045,.065),.004));symbol=max(symbol,segment(q,vec2(.04,0),vec2(.073,0),.004));glyphs=max(glyphs,symbol);
        hub=max(hub,segment(vDisk,-axis*.195,axis*.195,.0018));
      }
      // Match the inner inscription ring speed, with the opposite direction.
      // Wrap before glyph lookup so rotation cannot produce negative glyph indices.
      float letterPosition=fract((a+turn*.35)/TAU+.5)*60.0,letterIndex=floor(letterPosition);
      float glyph=mod(letterIndex*7.0+floor(letterIndex/24.0)*5.0+uTier*11.0,24.0);
      vec2 runes=vec2(0);if(abs(r-.885)<.045)runes=magicLetter(vec2((fract(letterPosition)-.5)*2.0,(r-.885)/.035),glyph);
      vec2 ticks=line(sin(a*48.0),.08)*smoothstep(.242,.245,r)*(1.0-smoothstep(.258,.261,r));
      for(int i=0;i<6;i++){
        float angle=(float(i)+.5)*TAU/6.0;vec2 axis=vec2(cos(angle),sin(angle)),side=vec2(-axis.y,axis.x),local=vec2(dot(vDisk,axis)-.63,dot(vDisk,side));
        ornament=max(ornament,line(abs(local.x)+abs(local.y)-.032,.0018));
        ornament=max(ornament,segment(vDisk,axis*.667,axis*.79,.0014));
        ornament=max(ornament,line(length(vDisk-axis*.79)-.012,.0017));
      }
      float innerPosition=((a-turn*.35)/TAU+.5)*48.0,innerIndex=floor(innerPosition);vec2 script=vec2(0);
      if(abs(r-.579)<.027)script=magicLetter(vec2((fract(innerPosition)-.5)*2.0,(r-.579)/.019),mod(innerIndex*11.0+floor(innerIndex/24.0)*7.0+uTier*5.0+240.0,24.0));
      ornament=max(ornament,script*.8);
      vec2 ink=edge*.8+frame*.60+hub*.65+glyphs*.80+runes*.42+(ticks*.35+ornament*.45)*min(uDetail,1.25);
      float life=smoothstep(0.0,.18,uTime)*(1.0-smoothstep(DC_burst+.08,DC_burst+.60,uTime))*smoothstep(-.04,.12,uTime/.35-fract(a/TAU+.5)*.35);
      float dim=1.0-smoothstep(DC_orbStart,DC_orbStart+.35,uTime)*.35;
      float core=smoothstep(.08,.30,ink.x),halo=clamp(ink.y*.8-ink.x*.45,0.0,1.0)*dim;
      float alpha=max(core,halo*.85)*life;if(r>1.0||alpha<.002)discard;
      float hue=smoothstep(-.75,.75,dot(vDisk,vec2(.8,.6)));
      vec3 black=vec3(.00012,.00008,.0002),corona=mix(vec3(1.0,.002,.035),uColor,hue)*(.90+uBeat*.14);
      gl_FragColor=vec4(mix(corona,black,core),alpha);${output}}`;
  // No filled backing: black strokes and their red-to-violet corona share one analytical pass.
  for(let tier=0;tier<2;tier++)add(new THREE.PlaneGeometry(2,2),material(sigilFragment,sigilVertex,false,{uTier:{value:tier},uGlyphs:{value:glyphStrokes}}),'darkchain-sigil-'+tier,1,0,DARKCHAIN.burst+.6);
  const capacity=DARKCHAIN.chains*DARKCHAIN.maxLinks,attrs={aLink:[new Float32Array(capacity*4),4],aBreak:[new Float32Array(capacity*4),4],aStart:[new Float32Array(capacity*4),4],aEnd:[new Float32Array(capacity*3),3],aShock:[new Float32Array(capacity*3),3]};let count=0;
  for(const chain of layout)for(let piece=0;piece<chain.fragments.length;piece++){
    const fragment=chain.fragments[piece];
    for(let j=fragment.first;j<fragment.first+fragment.count;j++,count++){
      attrs.aLink[0].set([chain.parameters[j],j,chain.pitch/.18,chain.angle],count*4);
      attrs.aBreak[0].set([fragment.center,piece,chain.phase,fragment.scale],count*4);
      attrs.aStart[0].set([...chain.start,chain.phase],count*4);attrs.aEnd[0].set(chain.end,count*3);attrs.aShock[0].set([chain.impactU,chain.impactTime,Math.max(chain.impactU,1-chain.impactU)],count*3);
    }
  }
  // Camera-facing procedural sprites, shared by intact links and flying fragments.
  const links=instances(new THREE.PlaneGeometry(1,1),attrs,count);links.userData.darkchainLayout=layout;
  const linkVertex=`attribute vec4 aLink,aStart,aBreak;attribute vec3 aEnd,aShock;uniform float uHalo;varying float vAlive,vAlong,vFlight;varying vec2 vLink;
    vec3 path(float u){float tension=uChainTension;if(abs(tension)<.00001)return mix(aStart.xyz,aEnd,u);vec3 radial=vec3(cos(aLink.w),0,sin(aLink.w)),side=vec3(-sin(aLink.w),0,cos(aLink.w));return mix(aStart.xyz,aEnd,u)+(radial*sin(u*3.14159265)*DC_chainBend+side*sin(u*TAU)*.16)*tension;}
    vec3 spinFragment(vec3 v,vec3 axis,float angle){return v*cos(angle)+cross(axis,v)*sin(angle)+axis*dot(axis,v)*(1.0-cos(angle));}
    void main(){float u=aLink.x;vAlong=u;vLink=position.xy*vec2(.29,.41);
      float reach=mix(-.025,1.025,smoothstep(DC_chainStart,DC_chainEnd,uTime)),grow=smoothstep(u-.02,u+.02,reach)*step(DC_chainStart,uTime);
      vec3 center=path(u),delta=path(min(1.0,u+.002))-path(max(0.0,u-.002)),up=normalize(delta);
      float stretch=length(delta)/((min(1.0,u+.002)-max(0.0,u-.002))*length(aEnd-aStart.xyz));
      vec3 chunk=path(aBreak.x),radial=chunk-vec3(0,DC_centerY,0);float hitTime=aShock.y+abs(aBreak.x-aShock.x)/aShock.z*DC_breakTravel;vFlight=uTime-hitTime;
      float flight=max(0.0,vFlight),seed=fract(sin(aBreak.y*17.1+aBreak.z*31.7)*437.31),spin=flight*(4.0+seed*5.0),fragmentScale=mix(1.0,aBreak.w*DC_fragmentScale,smoothstep(0.0,.08,flight));
      vec3 axis=normalize(vec3(cos(seed*TAU),.35,sin(seed*TAU)));
      vec3 p=chunk+spinFragment((center-chunk)*fragmentScale,axis,spin)+normalize(radial)*((DC_fragmentImpulse+seed*DC_fragmentSpread)/sqrt(aBreak.w))*(1.0-exp(-flight*2.2))/2.2+vec3(0,-1.4*flight*flight,0);
      vec4 mv=modelViewMatrix*vec4(p*uSize,1.0);vec3 direction=(modelViewMatrix*vec4(spinFragment(up,axis,spin),0)).xyz;
      float perspective=1.0-step(.5,projectionMatrix[3][3]);vec2 projected=direction.xy-mv.xy*(direction.z/mv.z)*perspective;
      vec2 heading=normalize(projected+vec2(.000001,0)),across=vec2(heading.y,-heading.x);
      float foreshorten=clamp(length(projected)/max(length(direction),.000001),.22,1.0),narrow=mix(1.0,.58,mod(aLink.y,2.0));
      float scale=uSize*length(modelViewMatrix[0].xyz)*aLink.z*fragmentScale*grow;
      mv.xy+=(across*vLink.x*narrow+heading*vLink.y*stretch*foreshorten)*scale;
      vAlive=grow*(1.0-smoothstep(4.35,4.98,uTime));gl_Position=projectionMatrix*mv;
    }`;
  const linkFragment=`uniform float uHalo;varying float vAlive,vAlong,vFlight;varying vec2 vLink;
    void main(){if(vAlive<.005)discard;vec2 radii=vec2(.078,.1209),q=vLink/radii;float r=length(q);
      float d=(r-1.0)*r/max(length(vLink/(radii*radii)),.00001),aa=max(fwidth(d),.0005);
      float body=1.0-smoothstep(.017,.019+aa,abs(d));
      float running=1.0-step(DC_burst,uTime),head=fract(uFlow*.8),band=exp(-pow((vAlong-head)*22.0,2.0));
      float hit=step(0.0,vFlight)*(1.0-smoothstep(.008,.046,vFlight)),hot=band*(.02+uBeat*.02)*running+hit*.12;
      if(uHalo<.5){if(r<.001||hash21(gl_FragCoord.xy)>body*vAlive)discard;
        float light=.2+.8*max(0.0,dot(normalize(q),normalize(vec2(-.3,.8))));
        // Keep the solid link neutral black; all purple energy belongs to the halo.
        vec3 color=vec3(.00035)+vec3(.0008)*light+vec3(.0015)*hit;
        gl_FragColor=vec4(color,1.0);
      }else{float cardFade=(1.0-smoothstep(.125,.145,abs(vLink.x)))*(1.0-smoothstep(.180,.205,abs(vLink.y)));
        float halo=exp(-pow(abs(d)/.040,2.0))*(1.0-body)*cardFade,alpha=halo*(.72+hot*.35)*vAlive*(.75+.25*min(uDetail,1.5));
        if(r<.001||alpha<.003)discard;gl_FragColor=vec4(uColor,alpha);
      }
      ${output}
    }`;
  for(let halo=0;halo<2;halo++){const m=material(linkFragment,linkVertex,halo===1,{uHalo:{value:halo}});m.side=THREE.FrontSide;if(!halo){m.transparent=false;m.depthWrite=true;}add(links,m,halo?'darkchain-chain-glow':'darkchain-chain-body',halo?3:0,DARKCHAIN.chainStart,5);}
  // Each independent strand grows from its own source to a distinct point on the opposite sigil.
  const anchors=new Float32Array(layout.length*2*4),releases=new Float32Array(layout.length*2);layout.forEach((c,i)=>{anchors.set([...c.start,0],i*8);anchors.set([...c.end,1],i*8+4);releases[i*2]=darkchainBreakTime(c,c.fragments[0].center);releases[i*2+1]=darkchainBreakTime(c,c.fragments.at(-1).center);});
  const seals=instances(new THREE.PlaneGeometry(1,1),{aAnchor:[anchors,4],aRelease:[releases,1]},layout.length*2);
  add(seals,material(`varying vec2 vUv;varying float vArrival,vRelease;void main(){vec2 p=(vUv-.5)*2.0;float r=length(p),a=atan(p.y,p.x),ring=exp(-pow((r-.62)*18.0,2.0)),rays=pow(.5+.5*cos(a*6.0),12.0)*exp(-pow((r-.76)*10.0,2.0));float alpha=(ring*.7+rays*.4+exp(-r*r*9.0)*.25)*smoothstep(vArrival,vArrival+.12,uTime)*(1.0-smoothstep(vRelease,vRelease+.08,uTime))*(.55+step(vRelease,uTime)*.45);if(alpha<.003)discard;gl_FragColor=vec4(mix(uColor,vec3(.8,.62,1),ring*.25),alpha);${output}}`,`attribute vec4 aAnchor;attribute float aRelease;varying vec2 vUv;varying float vArrival,vRelease;void main(){vUv=uv;vRelease=aRelease;vArrival=mix(DC_chainStart,DC_chainEnd-.02,aAnchor.w);vec3 p=aAnchor.xyz+vec3(position.x*.4,.007,position.y*.4);gl_Position=projectionMatrix*modelViewMatrix*vec4(p*uSize,1.0);}`),'darkchain-root-seals',3,DARKCHAIN.chainStart,DARKCHAIN.burst+DARKCHAIN.blastExpand+DARKCHAIN.breakTravel+.08);
  const orbGeometry=new THREE.SphereGeometry(1,96,40);
  const orbVertex=`varying vec3 vLocal,vNormal,vView;void main(){vLocal=position;float warp=1.0+DC_orbWarp*sin(position.y*7.0+uFlow*2.0)*sin(position.x*5.0-position.z*4.0);vec3 p=position*uOrbRadius*warp+vec3(0,DC_centerY,0);vec4 mv=modelViewMatrix*vec4(p*uSize,1);vNormal=normalize(normalMatrix*normal);vView=-mv.xyz;gl_Position=projectionMatrix*mv;}`;
  // A rotating energy membrane surrounds dark cavities. Its field advects in 3D;
  // it is not tied to latitude and cannot become a band wound around the sphere.
  const orbFragment=`varying vec3 vLocal,vNormal,vView;
    void main(){if(uOrbAlive<.003)discard;vec3 p=normalize(vLocal);float energyTime=max(0.0,uTime-DC_orbStart),turn=-energyTime*.90;
      p.xz=mat2(cos(turn),-sin(turn),sin(turn),cos(turn))*p.xz;
      float tilt=sin(energyTime*1.4)*.28;p.yz=mat2(cos(tilt),-sin(tilt),sin(tilt),cos(tilt))*p.yz;
      vec3 churn=vec3(sin(p.y*3.1+energyTime*2.1),sin(p.z*2.7-energyTime*1.7),cos(p.x*3.4+energyTime*1.9))*.24;
      float field=noise3(p*2.35+churn+vec3(.4+energyTime*.16,energyTime*.32,1.7-energyTime*.21)),fine=noise3(p*4.3-churn*.7+vec3(6.2,1.3+energyTime*.23,-energyTime*.28));
      field+=(fine-.5)*.07;float aa=max(fwidth(field),.0015),boundary=abs(field-.515);
      float membrane=smoothstep(.36,.405,field)*(1.0-smoothstep(.505,.52,field));
      float edge=1.0-smoothstep(.003,.009+aa,boundary);
      float diffusion=exp(-boundary*38.0),pulse=.72+uBeat*.38;
      float hue=smoothstep(-.7,.7,p.x*.7+p.y*.4+sin(uFlow*.3)*.25);
      vec3 violet=uColor,crimson=vec3(1.0,.002,.035),energy=mix(crimson,violet,hue);
      // Broad translucent-looking masses are shaded on the existing opaque core;
      // dark cavities preserve depth and readability without scene refraction.
      vec3 color=vec3(.0008,.0003,.002)+uColor*.006;
      color+=energy*(membrane*.19+diffusion*.34)*pulse;
      color+=energy*1.35*edge*(1.05+uBeat*.55);
      float folded=dot(p,vec3(.7,.45,.4))+.21*abs(p.y*3.0-.4)-.19*abs(p.z*4.0+.7)-.12;
      float fissure=(1.0-smoothstep(.002,.006+fwidth(folded),abs(folded)))*smoothstep(.56,.68,fine);
      color+=mix(energy,vec3(1,.30,.38),.15)*fissure*(.10+uBeat*.4)*min(uDetail,1.25);
      // Broad traveling energy outline stays on the opaque core: no extra shell or draw.
      vec3 surface=normalize(vLocal);float facing=abs(dot(normalize(vNormal),normalize(vView)));
      float outlineWave=sin(dot(surface,vec3(5.0,7.0,-4.0))-energyTime*6.0)+.35*sin(dot(surface,vec3(-8.0,3.0,6.0))+energyTime*9.0);
      float width=clamp(.52+outlineWave*.475,.20,.78),band=1.0-smoothstep(width-.09,width+.035,facing);
      color=mix(color,vec3(.00010,.00006,.00016),band);
      if(hash21(gl_FragCoord.xy)>uOrbAlive)discard;gl_FragColor=vec4(color,1);${output}}`;
  const coreMaterial=material(orbFragment,orbVertex,false);coreMaterial.side=THREE.FrontSide;coreMaterial.transparent=false;coreMaterial.depthWrite=true;
  add(orbGeometry,coreMaterial,'darkchain-orb-body',0,DARKCHAIN.orbStart,DARKCHAIN.burst);
  // A two-triangle halo behind the opaque core adds soft bloom without a post-process.
  const coreHaloVertex=`varying vec2 vHalo;void main(){vHalo=uv*2.0-1.0;vec4 center=modelViewMatrix*vec4(vec3(0,DC_centerY,0)*uSize,1);center.xy+=position.xy*(uTime>=DC_burst?DC_releaseRadius:uOrbRadius)*2.9*uSize*length(modelViewMatrix[0].xyz);gl_Position=projectionMatrix*center;}`;
  const coreHaloFragment=`varying vec2 vHalo;void main(){float r=length(vHalo)*1.45;
      if(uTime>=DC_burst){float age=uTime-DC_burst,fade=1.0-smoothstep(.008,DC_coreFlashLife,age),light=exp(-r*r*5.5)*(1.0-smoothstep(.65,1.2,r));if(light*fade<.003)discard;vec3 corona=mix(vec3(.8,.001,.06),uColor,smoothstep(.12,.85,r));vec3 hot=mix(corona,vec3(1.0,.42,.68),1.0-smoothstep(.08,.36,r));gl_FragColor=vec4(hot*8.0,light*fade*.95);${output} return;}if(uOrbAlive<.003||r>1.45)discard;float glow=exp(-pow((r-.98)/.20,2.0))*(1.0-smoothstep(1.18,1.45,r));float alpha=glow*(.52+uBeat*.18)*uOrbAlive*(.8+.2*min(uDetail,1.5));if(alpha<.003)discard;gl_FragColor=vec4(uColor,alpha);${output}}`;
  const coreHaloMaterial=material(coreHaloFragment,coreHaloVertex,true);coreHaloMaterial.side=THREE.FrontSide;
  add(new THREE.PlaneGeometry(1,1),coreHaloMaterial,'darkchain-orb-halo',2,DARKCHAIN.orbStart,DARKCHAIN.burst+DARKCHAIN.coreFlashLife);
  // Six short discharges, each with one fork, remain separate from the soft halo.
  const arcSlots=new Float32Array(24),arcValues=new Float32Array(24),arcState={};
  for(let i=0;i<6;i++)for(let branch=0;branch<2;branch++)arcSlots.set([i,branch],(i*2+branch)*2);
  const arcs=instances(new THREE.PlaneGeometry(1,1,12,1),{aArc:[arcSlots,2]},12);
  const arcVertex=`attribute vec2 aArc;uniform vec4 uArcs[6];uniform float uArcSeed;varying vec2 vUv;varying float vAlpha,vFlash,vFork;
    vec3 arcPoint(float u,float event,float fork){
      float seed=uArcSeed+aArc.x*19.0+event*13.0,longitude=aArc.x*TAU/6.0+hash21(vec2(seed,1))*.75,latitude=(hash21(vec2(seed,2))-.5)*1.65;
      vec3 axis=vec3(cos(longitude)*cos(latitude),sin(latitude),sin(longitude)*cos(latitude)),side=normalize(cross(axis,vec3(0,1,0))),up=cross(side,axis);
      float tilt=hash21(vec2(seed,3))*TAU;vec3 along=side*cos(tilt)+up*sin(tilt),across=cross(along,axis);
      float v=mix(u,.5+u*.36,fork),k=v*12.0,index=floor(k),jitter=mix(hash21(vec2(seed,index)),hash21(vec2(seed,index+1.0)),fract(k))-.5;
      return normalize(axis+along*((v-.5)*1.40)+across*(jitter*.32*sin(v*3.14159265)+fork*u*.46));
    }
    void main(){vUv=uv;vec4 state=uArcs[int(aArc.x)];vAlpha=state.x;vFlash=state.z;vFork=aArc.y;
      if(vAlpha<.001){gl_Position=vec4(0,0,2,1);return;}
      float b=max(0.0,uTime-DC_burst),radius=uOrbRadius*(1.035+smoothstep(0.0,.16,b)*.58);
      vec3 center=vec3(0,DC_centerY,0);
      vec4 mv=modelViewMatrix*vec4((arcPoint(uv.x,state.y,aArc.y)*radius+center)*uSize,1),a=modelViewMatrix*vec4((arcPoint(min(1.0,uv.x+.005),state.y,aArc.y)*radius+center)*uSize,1),z=modelViewMatrix*vec4((arcPoint(max(0.0,uv.x-.005),state.y,aArc.y)*radius+center)*uSize,1);
      vec2 tangent=normalize(a.xy-z.xy+vec2(.00001,0));float width=mix(.052,.024,aArc.y)*(.8+state.z*.7);
      mv.xy+=vec2(-tangent.y,tangent.x)*position.y*width*uSize*length(modelViewMatrix[0].xyz);gl_Position=projectionMatrix*mv;
    }`;
  const arcFragment=`varying vec2 vUv;varying float vAlpha,vFlash,vFork;
    void main(){float q=abs(vUv.y*2.0-1.0),tip=smoothstep(0.0,.06,vUv.x)*(1.0-smoothstep(.83,1.0,vUv.x));
      float alpha=(1.0-smoothstep(.42,1.0,q))*tip*vAlpha*mix(1.0,.7,vFork);if(alpha<.003)discard;
      vec3 color=mix(uColor,vec3(.94,.83,1),(.46+vFlash*.4)*(1.0-smoothstep(.12,.65,q)));
      gl_FragColor=vec4(color*(1.0+vFlash*.35),alpha);${output}}`;
  add(arcs,material(arcFragment,arcVertex,true,{uArcs:{value:arcValues},uArcSeed:{value:(spec.seed>>>0)%4093}}),'darkchain-orb-arcs',4,DARKCHAIN.orbStart,DARKCHAIN.burst+DARKCHAIN.arcLife);
  // Thirty-six fine discharges fill the lower disc footprint, with area-distributed anchors.
  // The same strips become an omnidirectional lightning burst at release.
  // Black leaders keep violet coronas while charging; released bolts get seeded red/violet coronas.
  const fieldSlots=new Float32Array(DARKCHAIN.fieldArcs*4),fieldValues=new Float32Array(DARKCHAIN.fieldArcs*4),fieldState={};
  for(let i=0;i<DARKCHAIN.fieldArcs;i++)for(let fork=0;fork<2;fork++)fieldSlots.set([i,fork],(i*2+fork)*2);
  const fieldGeometry=instances(new THREE.PlaneGeometry(1,1,20,1),{aField:[fieldSlots,2]},DARKCHAIN.fieldArcs*2);
  const fieldVertex=`attribute vec2 aField;uniform vec4 uField[36];uniform float uFieldSeed;varying vec2 vUv;varying float vAlpha,vFieldRed;
    vec3 fieldPoint(float u,float event,float fork){
      vec3 point=vec3(0.0);
      float seed=uFieldSeed+aField.x*31.7+event*17.3,angle=(aField.x+.5)*TAU/DC_fieldArcs+(hash21(vec2(seed,1))-.5)*.36;
      if(uTime>=DC_burst){
        float latitude=1.0-2.0*(aField.x+.5)/DC_fieldArcs,longitude=aField.x*2.39996323;
        vec3 direction=vec3(cos(longitude)*sqrt(1.0-latitude*latitude),latitude,sin(longitude)*sqrt(1.0-latitude*latitude));
        vec3 side=normalize(cross(direction,vec3(0,1,0))),up=cross(side,direction);
        float v=mix(u,.38+u*.52,fork),k=v*6.0,j=floor(k),age=max(0.0,uTime-DC_burst);
        float jitter=mix(hash21(vec2(seed,j)),hash21(vec2(seed,j+1.0)),fract(k))-.5;
        float distance=3.1+hash21(vec2(aField.x,uFieldSeed)) *2.05,reach=mix(1.6,distance,1.0-pow(1.0-clamp(age/.10,0.0,1.0),3.0));
        float tilt=hash21(vec2(seed,8))*TAU;vec3 along=normalize(side*cos(tilt)+up*sin(tilt)+direction*.25),across=cross(direction,along);
        float span=.48+hash21(vec2(seed,9))*.62;
        point=vec3(0,DC_centerY,0)+direction*reach+along*((v-.5)*span)+across*(jitter*.24+fork*u*.22);
      }else{
      float v=mix(u,.35+u*.38,fork),k=v*20.0,j=floor(k);
      float jag=mix(hash21(vec2(seed,j)),hash21(vec2(seed,j+1.0)),fract(k))-.5;
      float bend=sin(v*3.14159265),r=DC_lowerRadius*mix(sqrt(.015+hash21(vec2(seed,2))*.88),sqrt(.015+hash21(vec2(seed,3))*.88),v);
      angle+=v*(hash21(vec2(seed,4))-.5)*1.1+jag*.38*bend+fork*u*.38;
      point=vec3(cos(angle)*r,DC_baseY+v*DC_height,sin(angle)*r);
      }return point;
    }
    void main(){vUv=uv;vec4 state=uField[int(aField.x)];vAlpha=state.x;vFieldRed=step(DC_burst,uTime)*step(.5,hash21(vec2(aField.x,uFieldSeed+47.0)));
      if(vAlpha<.001){gl_Position=vec4(0,0,2,1);return;}
      vec4 mv=modelViewMatrix*vec4(fieldPoint(uv.x,state.y,aField.y)*uSize,1);
      vec4 ahead=modelViewMatrix*vec4(fieldPoint(min(1.0,uv.x+.002),state.y,aField.y)*uSize,1),behind=modelViewMatrix*vec4(fieldPoint(max(0.0,uv.x-.002),state.y,aField.y)*uSize,1);
      vec3 velocity=ahead.xyz-behind.xyz;float perspective=1.0-step(.5,projectionMatrix[3][3]);vec2 tangent=normalize(velocity.xy-mv.xy*(velocity.z/mv.z)*perspective+vec2(.00001,0));
      float width=mix(.11,.055,aField.y)*(.85+hash21(vec2(aField.x,state.y))*.35)*(1.0+step(DC_burst,uTime)*.25);
      mv.xy+=vec2(-tangent.y,tangent.x)*position.y*width*uSize*length(modelViewMatrix[0].xyz);gl_Position=projectionMatrix*mv;
    }`;
  const fieldFragment=`varying vec2 vUv;varying float vAlpha,vFieldRed;
    void main(){float q=abs(vUv.y*2.0-1.0),tip=mix(.7,1.0,smoothstep(0.0,.08,vUv.x)*(1.0-smoothstep(.92,1.0,vUv.x)));
      float core=1.0-smoothstep(.28,.36,q),edge=exp(-pow((q-.43)*15.0,2.0)),corona=exp(-q*q*3.5);
      float alpha=max(core,max(edge,corona*.55))*vAlpha*tip;if(alpha<.005)discard;
      vec3 coronaColor=mix(mix(uColor,vec3(.67,.12,1),.25),vec3(.35,.0007,.01225),vFieldRed);
      vec3 color=mix(coronaColor*(.45+edge*.95),vec3(.0002,.0001,.0004),core);
      gl_FragColor=vec4(color,alpha);${output}}`;
  add(fieldGeometry,material(fieldFragment,fieldVertex,false,{uField:{value:fieldValues},uFieldSeed:{value:(spec.seed>>>0)%4093}}),'darkchain-field-lightning',4,.65,DARKCHAIN.burst+DARKCHAIN.fieldLife);
  // Two existing batches carry the brush aura. No extra glow pass or particles.
  // Broad black ink, dry bristles and a sparse violet edge share one analytic mask.
  const brushMask=`vec3 inkBrush(vec2 uv,float seed,float travel){
    float u=uv.x,q=uv.y*2.0-1.0;
    float grain=noise21(vec2(u*17.0-travel,seed*27.0));
    float profile=pow(max(0.0,sin(u*3.14159265)),.82)*(.84-u*.18);
    float edge=profile*(.91+grain*.07),aa=max(fwidth(q)*1.2,.012);
    float body=1.0-smoothstep(edge-aa,edge+aa,abs(q));
    float hairs=noise21(vec2(u*2.0-travel*.15,q*31.0+seed*39.0));
    float dry=smoothstep(.42,.72,hairs)*smoothstep(.04,.28,u)*smoothstep(.02,.20,abs(q));
    body*=1.0-dry*.08*min(uDetail,1.0);
    float rim=(1.0-smoothstep(.012,.065,abs(q-edge*.88)))*smoothstep(.36,.68,grain);
    return vec3(body,dry,rim);
  }`;

  // Open ink streaks are actual motion histories: tail = earlier trajectory point.
  // This also turns the head outwards during the release, without rotating a static hair card.
  const inkMotion=`
    float inkProgress(float time,float start){float q=(min(time,DC_burst)-start)/(DC_burst-start);return DC_inkPullLead*q+(1.0-DC_inkPullLead)*pow(max(0.0,q),2.0);}
    float inkTime(float progress,float start){float a=1.0-DC_inkPullLead,q=progress<0.0?progress/DC_inkPullLead:(-DC_inkPullLead+sqrt(DC_inkPullLead*DC_inkPullLead+4.0*a*progress))/(2.0*a);return start+q*(DC_burst-start);}
    vec3 inkPoint(float sampleTime,vec4 seed,float start){
      float q=clamp((sampleTime-start)/(DC_burst-start),0.0,1.0),pull=clamp(inkProgress(sampleTime,start),0.0,1.0);
      float budget=mix(DC_inkTurnsMin,DC_inkTurnsMax,seed.z),turns=DC_inkLead*q+(budget-DC_inkLead)*q*q,angle=seed.x*TAU+TAU*turns;
      float r=mix(mix(DC_inkMinRadius,DC_inkRadius,seed.w),DC_inkCoreRadius,pull);
      float baseLatitude=(seed.y*2.0-1.0)*.96,tilt=.2+seed.w*.25;
      float latitude=baseLatitude*cos(tilt)+sqrt(1.0-baseLatitude*baseLatitude)*sin(tilt)*sin(angle+seed.z*TAU);
      float side=sqrt(max(0.0,1.0-latitude*latitude));
      vec3 direction=vec3(cos(angle)*side,latitude,sin(angle)*side);
      vec3 center=vec3(0,DC_centerY,0),p=center+direction*r;
      return p+normalize(p-center)*(1.0-exp(-max(0.0,sampleTime-DC_burst)*18.0))*.85;
    }
    vec4 inkTrail(vec4 seed,float start,float span,float width,out float valid,out vec2 coreOffset){
      // Tail is an earlier inward position. Intake stays visible while heads enter the core.
      float turnBudget=mix(DC_inkTurnsMin,DC_inkTurnsMax,seed.z);
      // Keep the visible tail below 0.30 turn: one clean arc, never an S-shaped coil.
      float headQ=clamp((uTime-start)/(DC_burst-start),0.0,1.0),headTurn=DC_inkLead*headQ+(turnBudget-DC_inkLead)*headQ*headQ;
      float tailTurn=max(0.0,headTurn-.30),a=turnBudget-DC_inkLead;
      float tailQ=(-DC_inkLead+sqrt(DC_inkLead*DC_inkLead+4.0*a*tailTurn))/(2.0*a);
      float headProgress=inkProgress(uTime,start),minimumProgress=DC_inkPullLead*tailQ+(1.0-DC_inkPullLead)*tailQ*tailQ;
      float tailProgress=max(minimumProgress,headProgress-span*.75*min(1.0,.85/turnBudget));
      float progress=mix(tailProgress,headProgress,uv.x);
      float sampleTime=inkTime(progress,start)+max(0.0,uTime-DC_burst);valid=1.0;
      vec4 mv=modelViewMatrix*vec4(inkPoint(sampleTime,seed,start)*uSize,1);
      vec4 next=modelViewMatrix*vec4(inkPoint(sampleTime+.002,seed,start)*uSize,1);
      vec4 prior=modelViewMatrix*vec4(inkPoint(sampleTime-.002,seed,start)*uSize,1);
      float perspective=1.0-step(.5,projectionMatrix[3][3]);
      // Perspective derivative keeps the narrow stroke perpendicular to visible motion.
      vec3 velocity=next.xyz-prior.xyz;vec2 tangent=normalize(velocity.xy-mv.xy*(velocity.z/mv.z)*perspective+vec2(.00001,0));
      mv.xy+=vec2(-tangent.y,tangent.x)*position.y*width*uSize*length(modelViewMatrix[0].xyz);
      vec4 core=modelViewMatrix*vec4(0,DC_centerY*uSize,0,1);
      coreOffset=(mv.xy-core.xy*(mv.z/core.z))/(mix(.3,1.45,charge())*uSize*length(modelViewMatrix[0].xyz));
      return mv;
    }
  `;
  function inkAttributes(count,name){
    const seeds=new Float32Array(count*4);
    let state=((spec.seed>>>0)^(name==='aAura'?0x391b47:0x7a23d1))>>>0;
    const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
    for(let i=0;i<count;i++)seeds.set([(i+random()*.65)/count,random(),random(),random()],i*4);
    return {[name]:[seeds,4]};
  }
  const haze=instances(new THREE.PlaneGeometry(1,1,24,1),inkAttributes(DARKCHAIN.auraCount,'aAura'),DARKCHAIN.auraCount);
  add(haze,material(brushMask+`varying vec2 vUv,vCoreOffset;varying float vSeed,vValid;
    void main(){vec3 brush=inkBrush(vUv,vSeed,uTime*.6);float b=max(0.0,uTime-DC_burst);
      float life=smoothstep(.32,.65,uTime)*(1.0-smoothstep(.04,.24,b))*(.60+.40*charge());
      float gap=smoothstep(.85,1.10,length(vCoreOffset)),alpha=brush.x*life*gap*vValid*.98;if(alpha<.003)discard;
      float flash=step(DC_burst,uTime)*(1.0-smoothstep(.008,.065,b));
      vec3 tint=mix(vec3(1.0,.003,.012),uColor,smoothstep(.25,.75,fract(vSeed*3.17)));
      float pigment=smoothstep(.16,.48,vSeed)*smoothstep(.06,.78,vUv.x);
      vec3 ink=mix(vec3(.00015,.0001,.0003),tint*.045,pigment);
      vec3 edge=tint*brush.z*(.035+flash*.10)*min(uDetail,1.5);
      gl_FragColor=vec4(ink+edge,alpha);${output}}`,inkMotion+`attribute vec4 aAura;varying vec2 vUv,vCoreOffset;varying float vSeed,vValid;
    void main(){vUv=uv;vSeed=aAura.z;vec4 mv=inkTrail(aAura,.32,DC_auraTrail,.065+aAura.w*.025,vValid,vCoreOffset);gl_Position=projectionMatrix*mv;}`,false),'darkchain-black-aura',2,.32,DARKCHAIN.burst+.24);
  const ribbons=instances(new THREE.PlaneGeometry(1,1,32,1),inkAttributes(DARKCHAIN.inkCount,'aStream'),DARKCHAIN.inkCount);
  add(ribbons,material(brushMask+`varying vec2 vUv,vCoreOffset;varying float vSeed,vValid;
    void main(){vec3 brush=inkBrush(vUv,vSeed,uTime*.9);float b=max(0.0,uTime-DC_burst);
      float life=smoothstep(.65,1.15,uTime)*(1.0-smoothstep(.025,.16,b))*(.60+.40*charge());
      float alpha=brush.x*.98*life*vValid*smoothstep(.82,1.02,length(vCoreOffset));if(alpha<.003)discard;
      float flash=step(DC_burst,uTime)*(1.0-smoothstep(.01,.07,b));
      vec3 tint=mix(vec3(1.0,.003,.012),uColor,smoothstep(.25,.75,fract(vSeed*3.17)));
      float pigment=smoothstep(.16,.48,vSeed)*smoothstep(.06,.78,vUv.x);
      vec3 ink=mix(vec3(.00015,.0001,.0003),tint*.045,pigment);
      vec3 edge=tint*brush.z*(.04+pow(vUv.x,3.0)*.06+flash*.12)*min(uDetail,1.5);
      gl_FragColor=vec4(ink+edge,alpha);${output}}`,inkMotion+`attribute vec4 aStream;varying vec2 vUv,vCoreOffset;varying float vSeed,vValid;
    void main(){vUv=uv;vSeed=aStream.z;vec4 mv=inkTrail(aStream,.65,DC_inkTrail,.08+aStream.w*.03,vValid,vCoreOffset);gl_Position=projectionMatrix*mv;}`,false),'darkchain-inward-ribbons',2,.65,DARKCHAIN.burst+.16);
  const shardFragment=`varying vec2 vUv;varying float vAlpha,vSeed,vHot;
    void main(){vec2 p=(vUv*2.0-1.0)*2.2;float shape=abs(p.x)+abs(p.y);
      float core=1.0-smoothstep(.82,1.0,shape);
      float halo=exp(-shape*shape*.52)*(1.0-smoothstep(1.65,2.15,shape));
      float alpha=max(core,halo*.98)*vAlpha;if(alpha<.003)discard;
      vec3 corona=mix(uColor,vec3(1.0,.002,.035),step(.65,vSeed));
      vec3 color=mix(corona*(1.65+vHot*.45),vec3(.00010,.00006,.00016),core);gl_FragColor=vec4(color,alpha);${output}}`;
  const incoming=instanced(new THREE.PlaneGeometry(1,1),Math.round(cap*2/3),2/3,material(shardFragment,`attribute vec4 seed;varying vec2 vUv;varying float vAlpha,vSeed,vHot;
    void main(){vUv=uv;vSeed=seed.z;float q=fract(max(0.0,uTime-DC_orbStart)*.55+charge()*charge()*.35+seed.x),a=seed.y*TAU+(1.0-q)*2.4,r=mix(3.5,.08,pow(q,.8));vec3 p=vec3(cos(a)*r,DC_centerY+(seed.w-.5)*3.7*(1.0-q),sin(a)*r);vHot=(.2+charge()*.5)*pow(q,3.0);vAlpha=smoothstep(DC_orbStart,1.4,uTime)*smoothstep(0.0,.12,q)*(1.0-smoothstep(.88,1.0,q))*.8;vec4 mv=modelViewMatrix*vec4(p*uSize,1);float size=(.035+seed.z*.065)*2.2;float dr=-3.42*.8*pow(max(q,.001),-.2);vec3 velocity=vec3(cos(a)*dr+sin(a)*r*2.4,-(seed.w-.5)*3.7,sin(a)*dr-cos(a)*r*2.4);vec3 viewVelocity=(modelViewMatrix*vec4(velocity*uSize,0)).xyz;float perspective=1.0-step(.5,projectionMatrix[3][3]);vec2 heading=normalize(viewVelocity.xy-mv.xy*(viewVelocity.z/mv.z)*perspective+vec2(.00001,0)),side=vec2(-heading.y,heading.x);mv.xy+=(side*position.x*.6+heading*position.y*1.6)*size*uSize*length(modelViewMatrix[0].xyz);gl_Position=projectionMatrix*mv;}`,false),5);incoming.name='darkchain-inward-particles';stages.push({object:incoming,start:DARKCHAIN.orbStart,end:DARKCHAIN.burst});
  // Black shard body masks its red/purple corona in the existing particle pass.
  const debrisFragment=`varying vec2 vUv;varying float vAlpha,vSeed,vHot;
    void main(){vec2 p=vUv*2.0-1.0;float shape=abs(p.x)+abs(p.y),core=1.0-smoothstep(.68,.76,shape);
      float halo=exp(-shape*shape*2.1)*(1.0-smoothstep(1.55,1.9,shape)),alpha=max(core,halo*.90)*vAlpha;if(alpha<.003)discard;
      vec3 corona=mix(uColor,vec3(1.0,.002,.035),step(.5,vSeed));
      vec3 color=mix(corona*(1.35+vHot*.30),vec3(.00010,.00006,.00016),core);
      gl_FragColor=vec4(color,alpha);${output}}`;
  const debris=instanced(new THREE.PlaneGeometry(1,1),Math.round(cap/3),1/3,material(debrisFragment,`attribute vec4 seed;varying vec2 vUv;varying float vAlpha,vSeed,vHot;
    void main(){vUv=uv;vSeed=seed.z;float b=max(0.0,uTime-DC_burst),radius=DC_releaseRadius+(2.6+seed.x*.4)*(1.0-exp(-b*3.2));vec3 direction=normalize(vec3(cos(seed.y*TAU),seed.w*1.7-.85,sin(seed.y*TAU)));vec3 p=vec3(0,DC_centerY,0)+direction*radius;p.y-=b*b*.45;vAlpha=smoothstep(0.0,.035,b)*(1.0-smoothstep(.35,1.15,b));vHot=(1.0-smoothstep(.05,.65,b))*.85;vec4 mv=modelViewMatrix*vec4(p*uSize,1);vec3 velocity=direction*(2.6+seed.x*.4)*3.2*exp(-b*3.2)+vec3(0,-b*.9,0);vec3 viewVelocity=(modelViewMatrix*vec4(velocity*uSize,0)).xyz;float perspective=1.0-step(.5,projectionMatrix[3][3]);vec2 heading=normalize(viewVelocity.xy-mv.xy*(viewVelocity.z/mv.z)*perspective+vec2(.00001,0)),side=vec2(-heading.y,heading.x);mv.xy+=(side*position.x*.7+heading*position.y*1.8*(.9+.3*seed.x))*(.06+seed.z*.15)*uSize*length(modelViewMatrix[0].xyz);gl_Position=projectionMatrix*mv;}`,false),5);debris.name='darkchain-debris';stages.push({object:debris,start:DARKCHAIN.burst,end:5});
  // Long, open flow ribbons replace solid crystal wedges. Curvature, ragged edges and
  // tail catch-up create moving black energy rather than a faceted flying object.
  // Each jet has a 3D path and a camera-facing narrow cross section, so side views stay readable.
  const jetBase=new THREE.PlaneGeometry(1,1,1,32);
  const burstDirections=new Float32Array(DARKCHAIN.blastPieces*4),burstShapes=new Float32Array(DARKCHAIN.blastPieces*4),burstStrengths=new Float32Array(DARKCHAIN.blastPieces);
  for(let i=0;i<DARKCHAIN.blastPieces;i++){
    const seed=(i*17%29)/29,y=1-2*(i+.5)/DARKCHAIN.blastPieces,angle=i*2.399963229728653+spec.seed*.001,r=Math.sqrt(1-y*y);
    burstDirections.set([Math.cos(angle)*r,y,Math.sin(angle)*r,seed],i*4);
    const primary=(i%28)%5===0;burstStrengths[i]=primary?1:.35+seed*.15;burstShapes.set([(primary?3.4+seed*.3:2.0+seed*.7)*.2,(primary?.38+seed*.06:.12+seed*.06)*.25,i*1.73,(i%2?1:-1)*(.8+seed)],i*4);
  }
  const burstGeometry=instances(jetBase,{aBurst:[burstDirections,4],aShape:[burstShapes,4],aStrength:[burstStrengths,1]},DARKCHAIN.blastPieces);
  const blastVertex=`attribute vec4 aBurst,aShape;attribute float aStrength;varying vec2 vUv;varying float vSeed,vStrength;
    void main(){float t=max(0.0,uTime-DC_burst),u=uv.y;vUv=uv;vSeed=aBurst.w;vStrength=aStrength;
      float shrink=.45+.55*uJetFade,stretch=1.0+.16*smoothstep(0.0,.035,t);
      float head=uBlastRadius*mix(.84,1.0,aBurst.w)+uJetTravel;
      float jetLength=min(aShape.x*stretch,head-.12)*shrink;
      vec3 axis=aBurst.xyz,side=normalize(cross(axis,abs(axis.y)>.9?vec3(1,0,0):vec3(0,1,0))),up=cross(side,axis);
      float bend=sin(u*3.14159265),wave=u*8.0-t*38.0+aShape.z;
      vec3 p=axis*(head-(1.0-u)*jetLength)+side*sin(wave)*bend*(.045+aBurst.w*.045)*shrink+up*sin(wave*.67+aShape.w)*bend*.035*shrink+vec3(0,DC_centerY,0);
      vec4 mv=modelViewMatrix*vec4(p*uSize,1.0);vec2 direction=(modelViewMatrix*vec4(axis,0)).xy,screenSide=normalize(vec2(-direction.y,direction.x)+vec2(.00001,0));
      float profile=pow(max(0.0,sin(u*3.14159265)),.65)*(1.0-u*.72);
      mv.xy+=screenSide*position.x*aShape.y*profile*shrink*uSize*length(modelViewMatrix[0].xyz);gl_Position=projectionMatrix*mv;}
  `;
  const blastFragment=`uniform float uBlastLayer;varying vec2 vUv;varying float vSeed,vStrength;
    void main(){float t=uTime-DC_burst,u=vUv.y,q=(vUv.x-.5)*2.0,flash=1.0-smoothstep(.006,.035,t),life=uJetFade;
      float flow=mist(vec2(u*13.0-t*30.0,vSeed*19.0)),edgeLimit=.78+flow*.20;
      float coverage=1.0-smoothstep(edgeLimit-.15,edgeLimit,abs(q));
      float slit=(1.0-smoothstep(.025,.10,abs(q+.24)))*smoothstep(.48,.76,flow)*smoothstep(.025,.08,t);
      float alpha=coverage*(1.0-slit*.82)*life*smoothstep(0.0,.055,u)*vStrength;if(alpha<.003)discard;
      float fray=exp(-pow((q-edgeLimit+.075)*25.0,2.0))*smoothstep(.38,.67,flow);
      float thread=(1.0-smoothstep(.025,.09,abs(q+sin(u*7.0-t*40.0+vSeed*6.0)*.34)))*flow;
      vec3 ink=vec3(.0003,.0001,.0007)+uColor*(.001+flow*.002);
      vec3 edgeColor=mix(uColor,vec3(.75,.001,.045),step(.78,vSeed)*.8);
      vec3 glow=mix(edgeColor,vec3(.94,.80,1),flash*.75);
      if(uBlastLayer>.5)alpha*=fray*.30+thread*.07*min(uDetail,1.5)+flash*.72*smoothstep(.25,.80,u);
      if(alpha<.003)discard;gl_FragColor=vec4(uBlastLayer<.5?ink:glow,alpha);${output}}
  `;
  for(let layer=0;layer<2;layer++){const m=material(blastFragment,blastVertex,layer===1,{uBlastLayer:{value:layer}});m.side=THREE.DoubleSide;add(burstGeometry,m,layer?'darkchain-blast':'darkchain-blast-ink',layer?6:4,DARKCHAIN.burst,DARKCHAIN.burst+DARKCHAIN.blastLife);}
  // Open spherical pressure strips, with a traveling bright edge and a catching tail.
  // Directions are fixed in effect space: orbiting the camera cannot rotate the texture.
  const pressureShape=new Float32Array(16),pressureRotation=new Float32Array(16);
  const pressureAngles=[[.42,.15,-.55],[-.72,1.82,.32],[1.14,3.75,-.28],[-.24,5.16,1.03]];
  for(let i=0;i<4;i++){
    pressureShape.set([(i%2?.12:-.15),THREE.MathUtils.degToRad([128,106,140,116][i]),THREE.MathUtils.degToRad([30,23,35,26][i]),i*.006],i*4);
    const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(...pressureAngles[i]));
    pressureRotation.set([q.x,q.y,q.z,q.w],i*4);
  }
  const pressureGeometry=instances(new THREE.PlaneGeometry(1,1,32,8),{aPressureShape:[pressureShape,4],aPressureRotation:[pressureRotation,4]},4);
  const pressureMotion=`
    float pressureRadius(float t){
      if(t<.08){float q=clamp(t/.08,0.0,1.0);return mix(DC_coreReleaseRadius,4.2,1.0-pow(1.0-q,3.0));}
      float q=clamp((t-.08)/(DC_pressureLife-.08),0.0,1.0);return 4.2+.4*(1.0-(1.0-q)*(1.0-q));
    }
    vec3 pressureRotate(vec3 p,vec4 q){return p+2.0*cross(q.xyz,cross(q.xyz,p)+q.w*p);}
  `;
  const pressureVertex=`attribute vec4 aPressureShape,aPressureRotation;uniform float uPressureGlow;
    varying vec2 vPressureUV;varying vec3 vPressureLocal;varying float vPressureAge;
    `+pressureMotion+`
    void main(){float globalAge=uTime-DC_burst,age=max(0.0,globalAge-aPressureShape.w);
      float radius=pressureRadius(age),catchup=smoothstep(.045,DC_pressureLife*.92,age);
      float inner=mix(DC_coreReleaseRadius*.28,radius-.10,catchup),u=uv.x,v=uv.y;
      float angle=(u-.5)*aPressureShape.y+aPressureShape.x;
      float latitude=(v-.5)*aPressureShape.z;
      float r=mix(inner,radius,v);
      vec3 direction=vec3(cos(angle)*cos(latitude),sin(latitude),sin(angle)*cos(latitude));
      vec3 local=pressureRotate(direction*r,aPressureRotation);
      vPressureUV=uv;vPressureLocal=local;vPressureAge=globalAge-aPressureShape.w;
      // Broad, open energy surfaces. The inner boundary catches the outward front.
      if(uPressureGlow>.5)local=pressureRotate(direction*(r+(v-.5)*.08),aPressureRotation);
      gl_Position=projectionMatrix*modelViewMatrix*vec4((local*1.12+vec3(0,DC_centerY,0))*uSize,1.0);}
  `;
  const pressureFragment=`uniform float uPressureGlow;
    varying vec2 vPressureUV;varying vec3 vPressureLocal;varying float vPressureAge;
    void main(){float globalAge=uTime-DC_burst,t=vPressureAge;if(t<0.0||globalAge>=DC_pressureLife)discard;
      float u=vPressureUV.x,v=vPressureUV.y;
      // Coherent local-space texture travels radially; no camera-dependent pattern.
      vec3 flow=vPressureLocal*exp(-t*1.3);
      float coarse=noise3(flow*1.05),grain=noise3(flow*3.1);
      float erosion=smoothstep(.30,DC_pressureLife,globalAge);
      float holes=smoothstep(.31+erosion*.48,.53+erosion*.43,coarse*.8+grain*.2);
      float sideGrain=noise3(vec3(u*7.0,v*.8-t*3.0,2.7));
      float sideCut=.08+(1.0-v)*.10+(grain-.5)*.12;
      float ends=smoothstep(sideCut,sideCut+.13,u)*(1.0-smoothstep(1.0-sideCut-.16,1.0-sideCut,u));
      ends*=smoothstep(.24,.55,sideGrain)*(1.0-smoothstep(.90+(grain-.5)*.10,1.0,v));
      float rim=.88+(grain-.5)*.10;
      float crest=exp(-pow((v-rim)/.065,2.0));
      float surface=smoothstep(0.0,.16,v)*(1.0-smoothstep(.84,1.0,v));
      float fade=pow(1.0-smoothstep(.18,DC_pressureLife,globalAge),1.15);
      float alpha=surface*.88*ends*holes*fade;
      vec3 energy=mix(uColor,vec3(.95,.002,.055),smoothstep(.25,.75,coarse));
      energy=pow(energy/max(max(energy.r,energy.g),max(energy.b,.001)),vec3(1.3));
      // Keep pigment black. Only the separate rim pass emits red/violet light.
      vec3 color=vec3(.00018,.00008,.00024);
      if(uPressureGlow>.5){alpha=crest*.35*ends*holes*fade*smoothstep(.65,.78,v)*(1.0-smoothstep(.92,1.0,v));color=energy*2.25;}
      if(alpha<.003)discard;gl_FragColor=vec4(color,alpha);${output}}
  `;
  const pressureBody=material(pressureFragment,pressureVertex,false,{uPressureGlow:{value:0}});
  add(pressureGeometry,pressureBody,'darkchain-energy-surface',5,DARKCHAIN.burst,DARKCHAIN.burst+DARKCHAIN.pressureLife);
  const pressureGlow=material(pressureFragment,pressureVertex,true,{uPressureGlow:{value:1}});
  add(pressureGeometry,pressureGlow,'darkchain-energy-surface-glow',6,DARKCHAIN.burst,DARKCHAIN.burst+DARKCHAIN.pressureLife);
  // Connected short energy ejection. All roots begin at the core; tails catch up
  // only after the launch. View-facing width preserves slim 3D velocity streaks.
  const ejectionDirections=new Float32Array(32*4),ejectionSeeds=new Float32Array(32*4);
  for(let i=0;i<32;i++){
    const seed=((spec.seed+i*43)%127)/127,y=1-2*(i+.5)/32,a=i*2.39996323+seed*.24,r=Math.sqrt(1-y*y);
    ejectionDirections.set([Math.cos(a)*r,y,Math.sin(a)*r,2.7+seed*2.0],i*4);
    ejectionSeeds.set([seed,i%5===0?.46:.10+seed*.09,i%3*.004,i%5===0?1:.65],i*4);
  }
  const ejectionGeometry=instances(new THREE.PlaneGeometry(1,1,12,1),{aEjectDirection:[ejectionDirections,4],aEjectSeed:[ejectionSeeds,4]},32);
  const ejectionVertex=`attribute vec4 aEjectDirection,aEjectSeed;
    varying vec2 vEject;varying vec4 vEjectSeed;varying float vEjectAge;
    void main(){float age=(uTime-DC_burst)/DC_ejectionLife-aEjectSeed.z,t=max(age,0.0),u=uv.x;
      float tip=1.0+aEjectDirection.w*(1.0-exp(-t*34.0));
      float root=tip*smoothstep(.15,1.0,t),r=mix(root,tip,u);
      vec3 local=aEjectDirection.xyz*r;
      vec4 mv=modelViewMatrix*vec4((local+vec3(0,DC_centerY,0))*uSize,1.0);
      vec3 velocity=mat3(modelViewMatrix)*aEjectDirection.xyz;
      float projectedLength=length(velocity.xy);
      vec2 across=projectedLength>.001?vec2(-velocity.y,velocity.x)/projectedLength:vec2(1,0);
      float envelope=.28+.72*pow(max(0.0,sin(u*3.14159265)),.65);
      float width=aEjectSeed.y*envelope*(1.0-.55*smoothstep(.04,1.0,t));
      mv.xy+=across*(uv.y-.5)*width*4.0*uSize*length(modelViewMatrix[0].xyz);
      vEject=uv;vEjectSeed=aEjectSeed;vEjectAge=age;gl_Position=projectionMatrix*mv;}
  `;
  const ejectionFragment=`varying vec2 vEject;varying vec4 vEjectSeed;varying float vEjectAge;
    void main(){float age=(uTime-DC_burst)/DC_ejectionLife,t=vEjectAge;if(t<0.0||age>=1.0)discard;
      float u=vEject.x,v=(vEject.y-.5)*2.0;
      float grain=noise3(vec3(u*6.0-t*18.0,v*2.0,vEjectSeed.x*17.0));
      float width=.14+.12*grain;
      float filament=1.0-smoothstep(width*.3,width,abs(v));
      float glow=exp(-v*v*9.0)*.35+exp(-v*v*4.0)*.35*(1.0-smoothstep(.15,.65,u));
      float ends=smoothstep(0.0,.05,u)*(1.0-smoothstep(.80,1.0,u));
      float breaks=smoothstep(.13+smoothstep(.45,1.0,age)*.65,.36+smoothstep(.45,1.0,age)*.65,grain);
      float fade=pow(1.0-clamp(age,0.0,1.0),2.0),heat=1.0-smoothstep(.025,.095,age);
      vec3 energy=mix(uColor,vec3(1.0,.001,.055),vEjectSeed.x);
      vec3 color=mix(energy*2.4,vec3(1.0,.55,.76)*3.0,filament*heat*(1.0-u)*(1.0-u));
      // Only the trailing third sheds sparks; the head and leading shaft remain continuous.
      float separate=smoothstep(.18,.45,age),sparks=0.0;
      for(int j=0;j<4;j++){
        float seed=hash21(vec2(vEjectSeed.x*53.0,float(j)+11.0));
        float scatter=hash21(vec2(vEjectSeed.x*71.0,float(j)+29.0));
        float sizeSeed=hash21(vec2(vEjectSeed.x*97.0,float(j)+47.0));
        float released=max(0.0,age-(.18+sizeSeed*.09));
        float drift=1.0-exp(-released*(3.0+scatter*3.0));
        // Fixed seeds: uneven release positions and lateral drift, never frame-to-frame jitter.
        float center=.045+seed*.19+drift*(scatter-.4)*.09;
        float lateral=(scatter*2.0-1.0)*.66*drift;
        float halfLength=mix(.038,.008+.017*sizeSeed,separate),halfWidth=.075+sizeSeed*.13;
        vec2 spark=vec2((u-center)/halfLength,(v-lateral)/halfWidth);
        float solid=1.0-smoothstep(.15,1.0,length(spark));
        float halo=exp(-dot(spark,spark)*.85)*.55;
        sparks+=(solid+halo)*(.65+sizeSeed*.55)*smoothstep(0.0,.055,released);
      }
      float line=(filament+glow)*breaks;
      float tailOnly=1.0-smoothstep(.27,.42,u);
      float alpha=mix(line,sparks,separate*tailOnly)*ends*fade*vEjectSeed.w;
      if(alpha<.003)discard;gl_FragColor=vec4(color,alpha);${output}}
  `;
  add(ejectionGeometry,material(ejectionFragment,ejectionVertex,true),'darkchain-core-ejection',6,DARKCHAIN.burst,DARKCHAIN.burst+DARKCHAIN.ejectionLife);
  // A short lived connected release mass, distinct from the outgoing pressure surfaces.
  // This is local 3D geometry, not a camera-facing explosion silhouette.
  const plasmaVertex=`varying vec3 vPlasmaLocal,vPlasmaNormal,vPlasmaView;
    void main(){float t=max(0.0,uTime-DC_burst),q=clamp(t/.055,0.0,1.0);
      float radius=mix(DC_coreReleaseRadius*.92,2.15,1.0-pow(1.0-q,3.0));
      vec3 n=normalize(position);float grain=noise3(n*3.3+vec3(t*9.0,0,-t*7.0));
      float lobes=sin(n.x*8.0+n.y*3.0)*sin(n.z*7.0-n.y*5.0);
      vec3 local=n*radius*(.88+grain*.23+lobes*.08);
      vec4 mv=modelViewMatrix*vec4((local*1.14+vec3(0,DC_centerY,0))*uSize,1.0);
      vPlasmaLocal=local;vPlasmaNormal=normalize(normalMatrix*normal);vPlasmaView=-mv.xyz;
      gl_Position=projectionMatrix*mv;}
  `;
  const plasmaFragment=`varying vec3 vPlasmaLocal,vPlasmaNormal,vPlasmaView;
    void main(){float t=uTime-DC_burst;if(t<0.0||t>=DC_plasmaLife)discard;
      vec3 flow=vPlasmaLocal*(1.7-t*5.0);
      float coarse=noise3(flow),grain=noise3(flow*2.1+vec3(t*12.0,0,0));
      float tear=smoothstep(.035,DC_plasmaLife,t),field=coarse*.75+grain*.25;
      float coverage=1.0-smoothstep(field-.06,field+.06,tear);
      float fade=1.0-smoothstep(.075,DC_plasmaLife,t);
      float facing=abs(dot(normalize(vPlasmaNormal),normalize(vPlasmaView)));
      float fissure=1.0-smoothstep(.025,.11,abs(field-.52));
      float heat=1.0-smoothstep(.015,.055,t);
      // Color travels across the curved volume independently of its erosion/alpha.
      float rim=pow(1.0-facing,.65);
      vec3 red=vec3(.95,.002,.045),violet=uColor*1.35;
      vec3 energy=mix(vec3(.035,.0005,.085),red,smoothstep(.04,.46,rim));
      energy=mix(energy,violet,smoothstep(.28,.60,rim));
      vec3 color=energy*(.65+.55*smoothstep(.25,.75,field));
      color=mix(color,vec3(2.8,1.1,1.6),heat*pow(facing,10.0)*.85);
      color+=energy*fissure*(1.0-heat)*.45;
      // A broad clear center grades into the colored outer volume, independent of erosion.
      float projectedRadius=sqrt(max(0.0,1.0-facing*facing))*1.14;
      float radialOpacity=smoothstep(.55,.82,projectedRadius)*(1.0-smoothstep(.80,1.08,projectedRadius));
      float corona=exp(-pow((projectedRadius-.88)/.16,2.0))*smoothstep(.56,.74,projectedRadius)*(1.0-smoothstep(.92,1.12,projectedRadius));
      float alpha=coverage*fade*(radialOpacity*.52+corona*.22);
      color+=mix(red,violet,smoothstep(.68,.90,projectedRadius))*corona*.65;
      if(alpha<.003)discard;
      gl_FragColor=vec4(color,alpha);${output}}
  `;
  const plasmaMaterial=material(plasmaFragment,plasmaVertex,false);plasmaMaterial.side=THREE.FrontSide;
  add(new THREE.SphereGeometry(1,24,16),plasmaMaterial,'darkchain-release-plasma',3,DARKCHAIN.burst,DARKCHAIN.burst+DARKCHAIN.plasmaLife);
  // The two central flare axes and peripheral glints share one preallocated batch.
  // A tapered four-point star flashes for 75ms; the separate radial ejection light owns the one-second tail.
  const glintSeeds=new Float32Array(20*4);
  for(let j=0;j<20;j++)glintSeeds.set([j,((spec.seed+j*31)%113)/113,((spec.seed+j*67)%127)/127,((spec.seed+j*17)%97)/97],j*4);
  const glintGeometry=instances(new THREE.PlaneGeometry(1,1),{aGlint:[glintSeeds,4]},20);
  const glintVertex=`attribute vec4 aGlint;varying vec2 vGlintUV;varying vec4 vGlintSeed;varying float vGlintAlpha;
    void main(){float t=uTime-DC_burst;vGlintUV=uv;vGlintSeed=aGlint;vec3 local=vec3(0);float span,width;
      if(aGlint.x<2.0){float life=1.0-smoothstep(.015,DC_flareLife,t);vGlintAlpha=life;span=mix(4.0,12.5,1.0-exp(-max(t,0.0)*70.0));width=1.2;}
      else{float delay=.045+aGlint.y*.07,age=max(0.0,t-delay),y=1.0-2.0*(aGlint.x-1.5)/18.0,angle=aGlint.x*2.39996323+aGlint.y;
        vec3 dir=vec3(cos(angle)*sqrt(max(0.0,1.0-y*y)),y,sin(angle)*sqrt(max(0.0,1.0-y*y)));
        float travel=1.0-exp(-age*10.0);local=dir*mix(1.8,3.6+aGlint.z*2.6,travel);
        float flicker=pow(max(0.0,sin(age*(28.0+aGlint.w*30.0)+1.0)),4.0);
        vGlintAlpha=step(delay,t)*(1.0-smoothstep(.23,DC_glintLife,t))*(.18+.82*flicker);
        span=(.13+aGlint.z*.21)*(1.0-age*.6);width=span;}
      vec4 mv=modelViewMatrix*vec4((local+vec3(0,DC_centerY,0))*uSize,1.0);
      vec2 p=position.xy;if(aGlint.x<2.0){if(aGlint.x<.5)p*=vec2(span,width);else p*=vec2(width,span*.76);}else p*=span;
      mv.xy+=p*uSize*length(modelViewMatrix[0].xyz);gl_Position=projectionMatrix*mv;}
  `;
  const glintFragment=`varying vec2 vGlintUV;varying vec4 vGlintSeed;varying float vGlintAlpha;
    void main(){vec2 p=abs(vGlintUV*2.0-1.0);float shape;
      if(vGlintSeed.x<2.0){float along=vGlintSeed.x<.5?p.x:p.y,across=vGlintSeed.x<.5?p.y:p.x;float taper=.012+.48*pow(1.0-along,2.8);shape=exp(-pow(across/taper,2.0)*3.0)*pow(1.0-along,1.4);}
      else shape=exp(-p.x*28.0-p.y*3.0)+exp(-p.y*28.0-p.x*3.0)+exp(-dot(p,p)*18.0)*.35;
      float alpha=shape*vGlintAlpha;if(alpha<.003)discard;
      vec3 color=mix(uColor,vec3(1.0,.005,.06),vGlintSeed.y)*2.2;
      color=mix(color,vec3(2.5,1.2,1.8),exp(-dot(p,p)*16.0)*.85);
      if(vGlintSeed.x<2.0)color*=5.4;gl_FragColor=vec4(color,alpha);${output}}
  `;
  add(glintGeometry,material(glintFragment,glintVertex,true),'darkchain-impact-glints',7,DARKCHAIN.burst,DARKCHAIN.burst+Math.max(DARKCHAIN.glintLife,DARKCHAIN.flareLife));
  // One preallocated batch of soft peripheral smoke; no frame-time allocations.
  const smokeGeometry=instances(new THREE.PlaneGeometry(1,1),inkAttributes(24,'aSmoke'),24);
  const smokeVertex=`attribute vec4 aSmoke;varying vec2 vSmokeUV,vSmokeOffset;varying float vSmokeSeed,vSmokeAge;
    void main(){float age=uTime-DC_burst;vSmokeAge=age;vSmokeSeed=aSmoke.z;vSmokeUV=uv;
      float q=clamp(age/(DC_duration-DC_burst),0.0,1.0),travel=1.0-pow(1.0-q,3.0);
      float angle=aSmoke.x*TAU,latitude=(aSmoke.y*2.0-1.0)*.85,side=sqrt(1.0-latitude*latitude);
      vec3 direction=vec3(cos(angle)*side,latitude,sin(angle)*side);
      vec3 p=vec3(0,DC_centerY,0)+direction*mix(1.9,4.1,travel);p.y+=q*(.25+aSmoke.w*.5);
      vec4 mv=modelViewMatrix*vec4(p*uSize,1.0),center=modelViewMatrix*vec4(0,DC_centerY*uSize,0,1);
      float span=mix(1.6,2.8,travel)*(.75+aSmoke.w*.45),scale=uSize*length(modelViewMatrix[0].xyz);
      vec2 card=position.xy;float turn=aSmoke.z*TAU+age*(aSmoke.w-.5)*.45;
      card=mat2(cos(turn),-sin(turn),sin(turn),cos(turn))*card;
      mv.xy+=card*span*scale;
      vSmokeOffset=(mv.xy-center.xy*(mv.z/center.z))/max(scale,.0001);
      gl_Position=projectionMatrix*mv;}
  `;
  const smokeFragment=`varying vec2 vSmokeUV,vSmokeOffset;varying float vSmokeSeed,vSmokeAge;
    void main(){float age=vSmokeAge;if(age<.06||uTime>=DC_duration)discard;
      vec2 p=vSmokeUV*2.0-1.0;float radial=length(p);
      float cloud=mist(p*2.4+vec2(vSmokeSeed*31.0-age*.38,age*.28));
      float billow=1.0-smoothstep(.28+cloud*.24,.86+cloud*.10,radial);
      float texture=.35+.65*smoothstep(.20,.75,cloud);
      float life=smoothstep(.06,.32,age)*pow(1.0-smoothstep(.62,DC_duration-DC_burst,age),.65);
      float centerGap=.10+.90*smoothstep(.8,2.3,length(vSmokeOffset));
      float alpha=billow*texture*life*centerGap*.34;if(alpha<.003)discard;
      vec3 black=vec3(.00025,.00012,.00035),red=vec3(.075,.0007,.004),purple=vec3(.027,.0007,.065);
      vec3 pigment=vSmokeSeed<.34?black:(vSmokeSeed<.67?red:purple);
      vec3 color=mix(black,pigment,smoothstep(.18,.72,cloud));
      gl_FragColor=vec4(color,alpha);${output}}
  `;
  add(smokeGeometry,material(smokeFragment,smokeVertex,false),'darkchain-after-smoke',3,DARKCHAIN.burst+.06,DARKCHAIN.duration);
  // Local neutral refraction: Three.js captures opaque scene content only.
  // It cannot refract transparent chains/particles; no host render hook or full-screen pass.
  const lens=new THREE.MeshPhysicalMaterial({transmission:1,roughness:0,metalness:0,transparent:true,depthWrite:false,depthTest:true,side:THREE.FrontSide});
  lens.uniforms={...uniforms,...shared};lens.userData.ownLifecycle=true;lens.forceSinglePass=true;
  lens.vertexShader=common+`uniform float uSize;varying vec2 vLens;varying vec4 vScreen,vCenter;
    void main(){vLens=position.xy*2.0;vec4 center=modelViewMatrix*vec4(0,DC_centerY*uSize,0,1);vCenter=projectionMatrix*center;
      float scale=uSize*length(modelViewMatrix[0].xyz);center.xy+=position.xy*(DC_warpRadius*2.0)*scale;vScreen=projectionMatrix*center;gl_Position=vScreen;}`;
  lens.fragmentShader=common+`varying vec2 vLens;varying vec4 vScreen,vCenter;uniform sampler2D transmissionSamplerMap;uniform vec2 transmissionSamplerSize;
    void main(){float r=length(vLens);if(r>=1.0)discard;
      vec2 uv=vScreen.xy/vScreen.w*.5+.5,center=vCenter.xy/vCenter.w*.5+.5;
      // Broad C1-continuous radial falloff, with zero slope at the outer boundary.
      // Fade through each pulse zero instead of switching an entire refracted patch.
      float feather=1.0-smoothstep(.08,1.0,r);vec2 delta=(uv-center)*uWarpKick*DC_warpPower*feather;
      vec2 inset=.5/max(transmissionSamplerSize,vec2(1));vec3 sceneColor=texture2D(transmissionSamplerMap,clamp(uv+delta,inset,1.0-inset)).rgb;
      float coverage=feather*feather*uWarpFade*smoothstep(0.0,.12,abs(uWarpKick));
      gl_FragColor=vec4(sceneColor,coverage);`+output+` }`;
  lens.onBeforeCompile=program=>{Object.assign(program.uniforms,lens.uniforms);program.vertexShader=lens.vertexShader;program.fragmentShader=lens.fragmentShader;lens.userData.transmissionUniforms=program.uniforms;};
  lens.customProgramCacheKey=()=>lens.vertexShader+'\n'+lens.fragmentShader;materials.add(lens);
  add(new THREE.PlaneGeometry(1,1),lens,'darkchain-impact-refraction',0,DARKCHAIN.burst,DARKCHAIN.burst+DARKCHAIN.warpLife);
  // A shallow pressure sheet. Continuous directional noise cuts the visible edge into torn brush strokes; no polar seam.
  const wavePositions=[],waveUvs=[],waveIndices=[],section=[[0,-.5],[0,.5],[.24,.5],[1,0],[.24,-.5],[0,-.5]],segments=160;
  for(let i=0;i<=segments;i++){const angle=i/segments*Math.PI*2;for(const [q,h]of section){const r=DARKCHAIN.waveRadius-DARKCHAIN.waveWidth*(1-q);wavePositions.push(Math.cos(angle)*r,DARKCHAIN.centerY+h*DARKCHAIN.waveHeight,Math.sin(angle)*r);waveUvs.push(q,h);}}
  for(let i=0;i<segments;i++)for(let j=0;j<section.length-1;j++){const a=i*section.length+j,b=a+section.length;waveIndices.push(a,b,a+1,b,b+1,a+1);}
  const waveGeometry=new THREE.BufferGeometry();waveGeometry.setAttribute('position',new THREE.Float32BufferAttribute(wavePositions,3));waveGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(waveUvs,2));waveGeometry.setIndex(waveIndices);
  const pressureWave=add(waveGeometry,material(`varying float vAcross,vHeight;varying vec2 vRing;
    void main(){float t=max(0.0,uTime-DC_burst),life=1.0-smoothstep(.08,DC_waveLife,t);
      float across=clamp(vAcross,0.0,1.0);vec2 direction=normalize(vRing);
      float grain=noise3(vec3(direction*18.0,across*4.0-t*.5)),bristles=noise3(vec3(direction*110.0,across*.85));
      float brush=.68+.32*smoothstep(.20,.72,grain),dry=smoothstep(.42,.70,bristles);
      float tears=noise3(vec3(direction*6.0,1.7)),edge=.57+.27*noise3(vec3(direction*16.0,2.3))+.16*bristles;
      float broken=smoothstep(.31,.49,tears)*(1.0-smoothstep(edge-.025,edge,across));
      float pressure=pow(smoothstep(0.0,.82,across),.75),trailingFade=smoothstep(0.0,.24,across),rimFade=broken;
      // Pure black pigment, retaining the previous brush opacity and broken edge.
      float inkOpacity=(.65+pressure*.33)*brush*(1.0-dry*.32)*trailingFade*rimFade;
      vec3 color=vec3(.0002,.0001,.0004);
      if(life*inkOpacity<.003)discard;gl_FragColor=vec4(color,life*inkOpacity);${output}}`,`varying float vAcross,vHeight;varying vec2 vRing;
    void main(){float t=max(0.0,uTime-DC_burst),shrink=1.0-smoothstep(.32,DC_waveLife,t);vAcross=uv.x;vHeight=uv.y;
      float width=min(uWaveRadius*.8,DC_waveWidth)*shrink,r=uWaveRadius-width*(1.0-uv.x);vec2 direction=normalize(position.xz);vRing=direction;
      vec3 p=vec3(direction.x*r,DC_centerY+uv.y*DC_waveHeight*shrink,direction.y*r);
      gl_Position=projectionMatrix*modelViewMatrix*vec4(p*uSize,1.0);}`,false),'darkchain-shock-ring',7,DARKCHAIN.burst,DARKCHAIN.burst+DARKCHAIN.waveLife);
  pressureWave.material.side=THREE.FrontSide;
  // One softly graded puff per direction; a single intake with no replenishment.
  // Positions are absolute-time evaluations, so seeking/replay never carry old emission state.
  const groundData={aGround0:[[],3],aGround1:[[],3],aGround2:[[],3],aGroundTiming:[[],4]};
  let groundSeed=((spec.seed>>>0)^0x639ac1)>>>0;
  const groundRandom=()=>{groundSeed=(Math.imul(groundSeed,1664525)+1013904223)>>>0;return groundSeed/4294967296;};
  const groundPaths=Array.from({length:6},(_,i)=>{
    const angle=i*Math.PI/3,radius=8;
    const bend=.75+groundRandom()*.35;
    const startY=.15;
    return {start:[Math.cos(angle)*radius,startY,Math.sin(angle)*radius],
      low:[Math.cos(angle+bend)*radius*.86,startY,Math.sin(angle+bend)*radius*.86],
      high:[Math.cos(angle+bend*1.35)*1.2,startY,Math.sin(angle+bend*1.35)*1.2],
      duration:1.15+groundRandom()*.30};
  });
  for(const route of groundPaths){
    groundData.aGround0[0].push(...route.start);groundData.aGround1[0].push(...route.low);groundData.aGround2[0].push(...route.high);
    groundData.aGroundTiming[0].push(0,route.duration,route.duration,(.65+groundRandom()*.35));
  }
  for(const value of Object.values(groundData))value[0]=new Float32Array(value[0]);
  const groundGeometry=instances(new THREE.PlaneGeometry(1,1),groundData,6);
  groundGeometry.userData.groundPaths=groundPaths;
  const smokeEnd=Math.max(...groundPaths.map(route=>route.duration))/.325;
  // Head and trail sample exactly the same path: ground first, central lift last.
  const smokePath=`vec3 smokePoint(float age){float t=clamp(age,0.0,1.0),ground=clamp(t/.60,0.0,1.0);
    float p=ground*ground*(3.0-2.0*ground),q=1.0-p;
    vec3 point=q*q*q*aGround0+3.0*q*q*p*aGround1+3.0*q*p*p*aGround2+p*p*p*vec3(0,DC_centerY,0);
    point.y=mix(aGround0.y,DC_centerY,smoothstep(.60,1.0,t));return point;}`;
  const groundVertex=`attribute vec3 aGround0,aGround1,aGround2;attribute vec4 aGroundTiming;
    varying vec2 vGroundUv,vGroundOffset;varying float vGroundFade,vGroundSeed;
    ${smokePath}
    void main(){float clock=uTime*.325,elapsed=clock-aGroundTiming.x;
      float progress=clamp(elapsed/aGroundTiming.z,0.0,1.0);
      vec3 center=smokePoint(progress);
      float absorb=1.0-smoothstep(.86,1.0,progress);
      float width=(2.145+aGroundTiming.w*.91)*(.65+.35*sin(progress*3.14159))*mix(.2,1.0,absorb);
      vGroundFade=step(0.0,elapsed)*smoothstep(0.0,.13,progress)*absorb*(1.0-smoothstep(DC_burst,DC_burst+.6,uTime));
      vec4 viewCenter=modelViewMatrix*vec4(center*uSize,1.0);
      vec4 viewCore=modelViewMatrix*vec4(0,DC_centerY*uSize,0,1);
      float scale=uSize*length(modelViewMatrix[0].xyz);
      float angle=aGroundTiming.w*6.28318+clock*.32;
      vec2 card=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*position.xy*width;
      vGroundOffset=(viewCenter.xy-viewCore.xy)/max(scale,.001)+card;
      viewCenter.xy+=card*scale;gl_Position=projectionMatrix*viewCenter;
      vGroundUv=uv;vGroundSeed=aGroundTiming.w;}`;
  const groundFragment=`varying vec2 vGroundUv,vGroundOffset;varying float vGroundFade,vGroundSeed;
    void main(){vec2 q=vGroundUv*2.0-1.0;
      float noise=mist(q*2.2+vec2(vGroundSeed*17.0,-uTime*.48));
      float soft=1.0-smoothstep(.30,1.0,length(q)+.14*(noise-.5));
      soft*=1.0-smoothstep(.88,1.0,max(abs(q.x),abs(q.y)));
      float cloud=mix(.68,1.0,smoothstep(.18,.72,noise)*clamp(uDetail,0.0,1.0));
      float clearCore=.24+.76*smoothstep(.35,1.25,length(vGroundOffset));
      float alpha=soft*cloud*vGroundFade*clearCore*.40;if(alpha<.002)discard;
      float edge=smoothstep(.10,.78,1.0-soft);
      float redBlend=smoothstep(.28,.72,.5+.4*sin(q.x*1.7+q.y*.7+vGroundSeed*6.28318)+.1*(noise-.5));
      vec3 edgePigment=mix(vec3(.018,.0005,.030),vec3(.030,.0004,.003),redBlend);
      vec3 pigment=edgePigment*edge;
      gl_FragColor=vec4(pigment,alpha);${output}}`;
  add(groundGeometry,material(groundFragment,groundVertex,false),'darkchain-ground-smoke',2,0,smokeEnd);
  // Eight overlapping camera-facing sprites per trail avoid wide-ribbon folds.
  // They sample one puff's past path, not repeated emission or respawning particles.
  const tailPositions=[],tailUvs=[],tailSamples=[],tailIndices=[];
  for(let i=0;i<8;i++){
    const base=i*4;
    for(const [x,y,u,v]of [[-.5,-.5,0,0],[.5,-.5,1,0],[.5,.5,1,1],[-.5,.5,0,1]]){
      tailPositions.push(x,y,0);tailUvs.push(u,v);tailSamples.push(i/7);
    }
    tailIndices.push(base,base+1,base+2,base,base+2,base+3);
  }
  const tailCards=new THREE.BufferGeometry();tailCards.setIndex(tailIndices);
  tailCards.setAttribute('position',new THREE.Float32BufferAttribute(tailPositions,3));
  tailCards.setAttribute('uv',new THREE.Float32BufferAttribute(tailUvs,2));
  tailCards.setAttribute('aTrailSample',new THREE.Float32BufferAttribute(tailSamples,1));
  const tailGeometry=instances(tailCards,groundData,6);
  const tailVertex=`attribute vec3 aGround0,aGround1,aGround2;attribute vec4 aGroundTiming;attribute float aTrailSample;
    varying vec2 vGroundUv,vGroundOffset;varying float vGroundFade,vGroundSeed;
    ${smokePath}
    void main(){float clock=uTime*.325,head=(clock-aGroundTiming.x)/aGroundTiming.z;
      float lag=(1.0-aTrailSample)*.23,age=head-lag;
      vec4 center=modelViewMatrix*vec4(smokePoint(age)*uSize,1);
      float absorb=1.0-smoothstep(.86,1.0,age),headAge=clamp(head,0.0,1.0);
      float width=(2.145+aGroundTiming.w*.91)*.8*(.65+.35*sin(headAge*3.14159))*mix(.2,1.0,1.0-smoothstep(.86,1.0,headAge));
      float scale=uSize*length(modelViewMatrix[0].xyz);
      float angle=aGroundTiming.w*6.28318+aTrailSample*1.7+clock*.32;
      vec2 offset=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*position.xy*width;
      vec4 core=modelViewMatrix*vec4(0,DC_centerY*uSize,0,1);
      vGroundOffset=(center.xy-core.xy)/max(scale,.001)+offset;
      center.xy+=offset*scale;gl_Position=projectionMatrix*center;
      vGroundUv=uv;vGroundSeed=aGroundTiming.w;
      float tailFade=smoothstep(0.0,.30,aTrailSample)*(1.0-smoothstep(.85,1.0,aTrailSample));
      vGroundFade=smoothstep(0.0,.13,age)*absorb*smoothstep(0.0,.10,head)*tailFade*(1.0-smoothstep(DC_duration-.4,DC_duration,uTime));
    }`;
  const tailFragment=groundFragment.replace('vGroundFade*clearCore*.40','vGroundFade*clearCore*.26');
  add(tailGeometry,material(tailFragment,tailVertex,false),'darkchain-smoke-tails',1,0,Math.min(DARKCHAIN.duration,smokeEnd+1.04));
  // One bounded callback; no per-frame object/buffer allocation and no hidden draws.
  animated.push(()=>{const time=Math.round(uniforms.uTime.value*1e6)/1e6;darkchainState(time,motion);shared.uJetTravel.value=motion.jetTravel;shared.uJetFade.value=motion.jetFade;shared.uWarpKick.value=motion.warpKick;shared.uWarpFade.value=motion.warpFade;shared.uChainTension.value=darkchainTension(time);shared.uFlow.value=motion.flow;shared.uOrbRadius.value=motion.radius;shared.uBeat.value=motion.beat;shared.uOrbAlive.value=motion.orbAlive;shared.uBlastRadius.value=motion.blastRadius;shared.uWaveRadius.value=motion.waveRadius;for(let i=0;i<DARKCHAIN.arcGroups;i++){darkchainArcState(time,i,arcState);arcValues[i*4]=arcState.alpha;arcValues[i*4+1]=arcState.event;arcValues[i*4+2]=arcState.flash;arcValues[i*4+3]=arcState.age;}for(let i=0;i<DARKCHAIN.fieldArcs;i++){darkchainFieldArcState(time,i,fieldState);fieldValues[i*4]=fieldState.alpha;fieldValues[i*4+1]=fieldState.event;fieldValues[i*4+2]=fieldState.age;fieldValues[i*4+3]=fieldState.duration;}for(const part of stages)part.object.visible=time>=part.start&&time<part.end;});
  return true;
}

// A deterministic three-wave performance. All distances are local scene units.
const GOLDEN_CHAIN = Object.freeze({duration:7.5,groundDuration:3,risingLifetime:1.95,waves:3,waveGap:1.1,stagger:.4,flight:.35,hold:.75,dissolve:.75,tail:.35,maxQuantity:12,pitch:.265,maxLinks:72,height:6,radius:3});
const gcClamp = value => Math.max(0,Math.min(1,value));
function gcRandomValues(seed){
  const values=new Float64Array(GOLDEN_CHAIN.waves*GOLDEN_CHAIN.maxQuantity*4);let state=seed>>>0;
  for(let i=0;i<values.length;i++){state=(Math.imul(state,1664525)+1013904223)>>>0;values[i]=state/4294967296;}
  return values;
}
function gcConfigureChain(values,wave,slot,quantity,spread,out){
  const k=(wave*GOLDEN_CHAIN.maxQuantity+slot)*4,a=values[k],b=values[k+1],c=values[k+2],d=values[k+3];
  const angle=(slot+.5)*Math.PI*2/quantity+wave*.59+(a-.5)*.18;
  const endRadius=GOLDEN_CHAIN.radius*(.52+.48*b)*spread;
  const sourceAngle=angle+Math.PI*(.60+.36*c),sourceRadius=(2.4+.7*d)*spread;
  out.wave=wave;out.slot=slot;out.birth=wave*GOLDEN_CHAIN.waveGap+(quantity>1?slot/(quantity-1):.5)*GOLDEN_CHAIN.stagger;
  out.start[0]=Math.cos(sourceAngle)*sourceRadius;out.start[1]=5.7+.6*c;out.start[2]=Math.sin(sourceAngle)*sourceRadius;
  out.end[0]=Math.cos(angle)*endRadius;out.end[1]=0;out.end[2]=Math.sin(angle)*endRadius;
  out.length=Math.hypot(out.end[0]-out.start[0],out.end[1]-out.start[1],out.end[2]-out.start[2]);
  out.pitch=GOLDEN_CHAIN.pitch;out.count=Math.min(GOLDEN_CHAIN.maxLinks,Math.ceil(out.length/out.pitch)+1);out.seed=a;out.active=true;
  return out;
}
function goldenChainLayout(seed,quantity=8,spread=1){
  quantity=Math.max(1,Math.min(GOLDEN_CHAIN.maxQuantity,Math.round(Number.isFinite(quantity)?quantity:8)));
  spread=Math.max(.5,Math.min(2,Number.isFinite(spread)?spread:1));
  const values=gcRandomValues(seed),chains=[];
  for(let wave=0;wave<GOLDEN_CHAIN.waves;wave++)for(let slot=0;slot<quantity;slot++)chains.push(gcConfigureChain(values,wave,slot,quantity,spread,{start:[0,0,0],end:[0,0,0]}));
  return chains;
}
function goldenChainState(time,birth,out={}){
  const age=Math.round(((Number.isFinite(time)?time:0)-birth)*1e6)/1e6;
  out.age=age;out.travel=Math.pow(gcClamp(age/GOLDEN_CHAIN.flight),1.5);out.impactAge=age-GOLDEN_CHAIN.flight;
  out.dissolve=gcClamp((age-GOLDEN_CHAIN.flight-GOLDEN_CHAIN.hold)/GOLDEN_CHAIN.dissolve);
  out.chainVisible=age>=0&&age<GOLDEN_CHAIN.flight+GOLDEN_CHAIN.hold+GOLDEN_CHAIN.dissolve;
  out.visible=age>=0&&age<GOLDEN_CHAIN.flight+.60+2*GOLDEN_CHAIN.risingLifetime;
  return out;
}

function buildGoldenChainEffect({THREE,spec,cap,uniforms,geometries,animated,mesh,instanced,shader,output}){
  if(spec.id!=='golden-chain-rain')return false;
  const maxChains=GOLDEN_CHAIN.waves*GOLDEN_CHAIN.maxQuantity,maxLinks=maxChains*GOLDEN_CHAIN.maxLinks;
  const randomValues=gcRandomValues(spec.seed),layout=goldenChainLayout(spec.seed,GOLDEN_CHAIN.maxQuantity,1);
  // One oval tube with six-sided cross-section; adjacent instances turn ninety degrees.
  function gcLinkGeometry(){
    const positions=[],normals=[],uvs=[],indices=[],around=24,tube=6;
    for(let i=0;i<=around;i++){
      const angle=i/around*Math.PI*2,ca=Math.cos(angle),sa=Math.sin(angle),nx=ca/.095,ny=sa/.17,nl=Math.hypot(nx,ny);
      for(let j=0;j<=tube;j++){
        const t=j/tube*Math.PI*2,ct=Math.cos(t),st=Math.sin(t);
        positions.push(ca*.095+nx/nl*.031*ct,sa*.17+ny/nl*.031*ct,.031*st);
        normals.push(nx/nl*ct,ny/nl*ct,st);uvs.push(i/around,j/tube);
        if(i<around&&j<tube){const n=i*(tube+1)+j;indices.push(n,n+tube+1,n+1,n+1,n+tube+1,n+tube+2);}
      }
    }
    const geometry=new THREE.BufferGeometry();geometry.setIndex(indices);geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));return geometry;
  }
  function gcInstances(base,maximum){
    const geometry=new THREE.InstancedBufferGeometry();if(base.index)geometry.setIndex(base.index.clone());
    for(const [key,value]of Object.entries(base.attributes))geometry.setAttribute(key,value.clone());base.dispose();
    geometry.setAttribute('aStart',new THREE.InstancedBufferAttribute(new Float32Array(maximum*3),3));
    geometry.setAttribute('aEnd',new THREE.InstancedBufferAttribute(new Float32Array(maximum*3),3));
    geometry.setAttribute('aTime',new THREE.InstancedBufferAttribute(new Float32Array(maximum*2),2));
    geometry.instanceCount=0;return geometry;
  }
  const chainGeometry=gcInstances(gcLinkGeometry(),maxLinks);
  chainGeometry.setAttribute('aLink',new THREE.InstancedBufferAttribute(new Float32Array(maxLinks*4),4));
  chainGeometry.userData.goldenChainLayout=layout;
  const spriteGeometry=gcInstances(new THREE.PlaneGeometry(.32,.48),maxLinks);
  spriteGeometry.setAttribute('aLink',new THREE.InstancedBufferAttribute(new Float32Array(maxLinks*4),4));
  spriteGeometry.userData.goldenChainLayout=layout;
  geometries.add(spriteGeometry);
  // Shared by links, arrowheads and erosion chips: all distances are along the flight axis.
  const gcMotion=`
    float gcPenetration(float age){float t=clamp((age-.35)/.08,0.0,1.0);return .32*(1.0-pow(1.0-t,3.0));}
    float gcTipDistance(float age,float span){return pow(clamp(age/.35,0.0,1.0),1.5)*span+gcPenetration(age);}
  `;
  const gcChainVertex=`${gcMotion}
    varying vec2 vChainClip;
    attribute vec3 aStart,aEnd;attribute vec2 aTime;attribute vec4 aLink;
    uniform float uTime;
    varying vec3 vNormal,vViewPosition,vLocal;varying vec2 vRingUv;
    varying float vAge,vRoute,vDissolve,vAlive,vSeed;
    #ifdef GC_SPRITE
      varying vec2 vSpritePlane;varying vec2 vSpriteHeading;varying float vSpriteWidth;
    #endif
    void main(){
      float age=uTime-aTime.x,travel=pow(clamp(age/.35,0.0,1.0),1.5);
      vec3 delta=aEnd-aStart;float span=length(delta);vec3 forward=delta/span;
      vec3 right=normalize(cross(forward,vec3(0,1,0))),side=normalize(cross(right,forward));
      float tipDistance=gcTipDistance(age,span),headSetback=.83;
      float distance=tipDistance-headSetback-aLink.x*aLink.z;
      float route=clamp(distance/span,0.0,1.0),impact=max(0.0,age-.35);
      float bend=.085*(1.0-travel)+.72*exp(-impact*17.0)*sin(impact*52.0)*step(.35,age);
      bend*=min(aLink.x*.5,1.0); // The first link stays pinned to the arrow tail.
      vec3 tangent=normalize(forward+right*(bend*3.14159265/span*cos(route*3.14159265)));
      vec3 across=normalize(cross(tangent,side));
      float turn=mod(aLink.x,2.0)*1.57079632679;
      vec3 p=position,n=normal;
      #ifdef GC_HALO
        p+=normal*.023;
      #endif
      p.xz=mat2(cos(turn),-sin(turn),sin(turn),cos(turn))*p.xz;
      n.xz=mat2(cos(turn),-sin(turn),sin(turn),cos(turn))*n.xz;
      vec3 center=aStart+forward*distance+right*sin(route*3.14159265)*bend;
      #ifdef GC_SPRITE
        vec4 view=modelViewMatrix*vec4(center*uSize,1.0);
        vec3 direction=mat3(modelViewMatrix)*tangent;
        vec2 projected=direction.xy;
        if(!isOrthographic)projected-=view.xy*(direction.z/min(view.z,-.00001));
        float projectedLength=length(projected)/max(length(direction),.00001);
        // A ring has no directional head: canonicalize the axis before easing
        // to screen-up near the viewing axis. This avoids a zero normalization.
        vec2 heading=projected/max(length(projected),.00001);
        if(heading.y<0.0)heading=-heading;
        heading=normalize(mix(vec2(0,1),heading,smoothstep(.005,.08,projectedLength)));
        // Match the directed length axis so the plane keeps front-facing
        // winding even when the chain projects downward on the screen.
        if(dot(projected,heading)<0.0)heading=-heading;
        vec2 lateral=vec2(heading.y,-heading.x);
        float width=mix(1.0,.48,mod(aLink.x,2.0));
        // Keep length and depth along the real chain, rotating only its width
        // toward the camera. A full screen-aligned quad stretched across the
        // source/arrow planes, while the old clipping used a different position.
        vec3 lateralView=vec3(lateral,0),headingView=vec3(heading,0);
        vec3 lateralLocal=normalize(vec3(dot(normalMatrix[0],lateralView),dot(normalMatrix[1],lateralView),dot(normalMatrix[2],lateralView)));
        vec3 headingLocal=normalize(vec3(dot(normalMatrix[0],headingView),dot(normalMatrix[1],headingView),dot(normalMatrix[2],headingView)));
        vec3 lengthAxis=normalize(tangent+headingLocal*.08*(1.0-smoothstep(0.0,.08,projectedLength)));
        vec3 local=center+lengthAxis*position.y+lateralLocal*position.x*width;
        // Adjacent axial quads otherwise share the same plane when taut.
        // A tiny alternating depth separation prevents overlap z-fighting.
        local+=normalize(cross(lateralLocal,lengthAxis))*(mod(aLink.x,2.0)-.5)*.0015;
        view=modelViewMatrix*vec4(local*uSize,1.0);
        vSpritePlane=position.xy;vSpriteHeading=heading;vSpriteWidth=width;
        vLocal=local;vNormal=vec3(0,0,1);vViewPosition=-view.xyz;
      #else
      vec3 local=center+across*p.x+tangent*p.y+side*p.z;
      vLocal=local;vNormal=normalize(normalMatrix*(across*n.x+tangent*n.y+side*n.z));
      vec4 view=modelViewMatrix*vec4(local*uSize,1.0);vViewPosition=-view.xyz;
      #endif
      float axial=dot(vLocal-aStart,forward);
      vChainClip=vec2(axial,tipDistance-.64-axial);
      vAge=age;vRoute=route;vDissolve=clamp((age-1.10)/.75,0.0,1.0);vSeed=aLink.w;vRingUv=uv;
      vAlive=step(0.0,age)*(1.0-step(1.85,age));
      gl_Position=projectionMatrix*view;
    }`;
  const gcChainFragment=`
    #ifndef GC_ARROW
      varying vec2 vChainClip;
    #endif
    uniform vec3 uColor;
    uniform float uTextureDensity;
    varying vec3 vNormal,vViewPosition,vLocal;varying vec2 vRingUv;
    varying float vAge,vRoute,vDissolve,vAlive,vSeed;
    #ifdef GC_SPRITE
      varying vec2 vSpritePlane;varying vec2 vSpriteHeading;varying float vSpriteWidth;
    #endif
    #ifdef GC_ARROW
      varying float vSourceDistance;varying vec3 vArrowSurface;
    #endif
    float gcHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float gcLiquidHash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
    float gcLiquidNoise(vec3 p){
      vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
      return mix(mix(mix(gcLiquidHash(i),gcLiquidHash(i+vec3(1,0,0)),f.x),mix(gcLiquidHash(i+vec3(0,1,0)),gcLiquidHash(i+vec3(1,1,0)),f.x),f.y),
        mix(mix(gcLiquidHash(i+vec3(0,0,1)),gcLiquidHash(i+vec3(1,0,1)),f.x),mix(gcLiquidHash(i+vec3(0,1,1)),gcLiquidHash(i+vec3(1,1,1)),f.x),f.y),f.z);
    }
    void main(){
      if(vAlive<.5||vLocal.y<0.0)discard;
      #ifndef GC_ARROW
        if(min(vChainClip.x,vChainClip.y)<0.0)discard;
      #endif
      vec2 ringUv=vRingUv;vec3 surfaceNormal=vNormal;float spriteHalo=1.0;
      #ifdef GC_SPRITE
        vec2 ellipse=vSpritePlane/vec2(.095,.17);
        float ellipseRadius=length(ellipse);
        vec2 radial=ellipse/max(ellipseRadius,.00001);
        float tubeDistance=(ellipseRadius-1.0)/max(length(radial/vec2(.095,.17)),.00001);
        float tube=clamp(tubeDistance/.031,-1.0,1.0);
        #ifdef GC_HALO
          if(abs(tubeDistance)<.031||abs(tubeDistance)>.054)discard;
          spriteHalo=1.0-smoothstep(.031,.054,abs(tubeDistance));
        #else
          if(abs(tubeDistance)>.031)discard;
        #endif
        ringUv=vec2(fract(atan(ellipse.y,ellipse.x)/6.283185),acos(tube)/6.283185);
        vec2 radialNormal=normalize(radial/vec2(.095*vSpriteWidth,.17));
        vec2 lateral=vec2(vSpriteHeading.y,-vSpriteHeading.x);
        surfaceNormal=vec3((lateral*radialNormal.x+vSpriteHeading*radialNormal.y)*tube,sqrt(max(0.0,1.0-tube*tube)));
      #endif
      #ifdef GC_ARROW
        if(vSourceDistance<0.0)discard;
      #endif
      float grain=gcHash(floor(ringUv*vec2(24.0,6.0))+vSeed*83.0);
      float threshold=vRoute*.78+grain*.22;
      if(vDissolve>threshold)discard;
      float edge=step(.001,vDissolve)*(1.0-smoothstep(0.0,.045,threshold-vDissolve));
      #ifdef GC_HALO
        gl_FragColor=vec4(uColor*1.10,(.035+edge*.18)*uDetail*spriteHalo);
      #else
        vec3 n=normalize(surfaceNormal),viewDirection=isOrthographic?vec3(0,0,1):normalize(vViewPosition),light=normalize(vec3(-.35,.8,.65));
        float diffuse=clamp(dot(n,light)*.65+.35,0.0,1.0);
        float shine=pow(max(0.0,dot(n,normalize(light+viewDirection))),38.0);
          // Embed the ring UVs on a torus so both seams stay continuous. Advect
          // a warped noise field; its contours form irregular liquid caustics.
          vec3 gold=mix(uColor*vec3(.075,.065,.025),uColor*vec3(.32,.28,.12),smoothstep(.13,.82,diffuse));
          gold+=uColor*shine*.22;
          #ifdef GC_ARROW
            // Model-space sampling stays continuous across the arrow facets and cap.
            vec3 liquid=vArrowSurface*13.5*.65*uTextureDensity;
          #else
          vec2 angle=ringUv*6.283185;
          float radius=2.2+.45*cos(angle.y);
          vec3 liquid=vec3(cos(angle.x)*radius,sin(angle.x)*radius,.45*sin(angle.y))*.65*uTextureDensity;
          #endif
          liquid+=vec3(-vAge*.58*uTextureDensity,vSeed*3.7,vAge*.26*uTextureDensity);
          vec3 warp=vec3(gcLiquidNoise(liquid*.73+vec3(0,0,vAge*.16)),
            gcLiquidNoise(liquid*.73+vec3(13.7,5.2,-vAge*.19)),gcLiquidNoise(liquid*.73+vec3(2.4,19.1,8.3)));
          float field=gcLiquidNoise(liquid+warp*2.1)*.88+gcLiquidNoise(liquid*2.07+warp)*.12;
          float stream=pow(.5+.5*sin(field*36.0),5.0);
          float filament=pow(.5+.5*sin(field*72.0+warp.x*2.0),12.0);
          float water=(stream*1.38+filament*.34)*(.6+.4*diffuse)*min(uDetail,1.4);
          gold+=uColor*vec3(.90,.80,.40)*water;
        float impact=exp(-max(0.0,vAge-.35)*18.0)*step(.35,vAge);
        gold+=uColor*impact*.08;
        gold+=mix(uColor,vec3(1.0,.97,.85),.4)*edge*.85*min(uDetail,1.3);
        gl_FragColor=vec4(gold,1.0);
      #endif
      ${output}
    }`;
  const bodyMaterial=shader(gcChainFragment,gcChainVertex,{},false);
  bodyMaterial.transparent=false;bodyMaterial.depthWrite=true;bodyMaterial.side=THREE.FrontSide;bodyMaterial.userData.ownLifecycle=true;
  const body=mesh(chainGeometry,bodyMaterial,1);body.name='golden-chain-body';
  const haloMaterial=shader(gcChainFragment,gcChainVertex,{},true,{GC_HALO:1});haloMaterial.side=THREE.BackSide;haloMaterial.userData.ownLifecycle=true;
  const halo=mesh(chainGeometry,haloMaterial,2);halo.name='golden-chain-halo';
  const spriteBodyMaterial=shader(gcChainFragment,gcChainVertex,{},false,{GC_SPRITE:1});
  spriteBodyMaterial.transparent=false;spriteBodyMaterial.depthWrite=true;spriteBodyMaterial.side=THREE.FrontSide;spriteBodyMaterial.userData.ownLifecycle=true;
  const spriteHaloMaterial=shader(gcChainFragment,gcChainVertex,{},true,{GC_SPRITE:1,GC_HALO:1});
  spriteHaloMaterial.side=THREE.FrontSide;spriteHaloMaterial.userData.ownLifecycle=true;

  // Only the aerial source has a water surface; landing points are dry cracks.
  const rippleGeometry=gcInstances(new THREE.PlaneGeometry(2,2),maxChains);
  const rippleVertex=`attribute vec3 aStart,aEnd;attribute vec2 aTime;uniform float uTime;
    varying vec2 vRipple;varying float vAge,vFade,vSeed;
    void main(){
      float age=uTime-aTime.x,localAge=age;
      vFade=smoothstep(0.0,.085,localAge)*(1.0-smoothstep(1.10,1.55,age));
      float open=1.0-pow(1.0-clamp(localAge/.16,0.0,1.0),3.0);
      float radius=.82*(.45+.55*open);
      vec3 forward=normalize(aEnd-aStart),right=normalize(cross(forward,vec3(0,1,0))),side=normalize(cross(right,forward));
      vec3 across=right,up=side,center=aStart;
      float extent=1.0;
      #ifdef GC_RIPPLE_GLOW
        extent=1.9;
        // Move the halo just toward the viewer instead of relying on a
        // coplanar depth bias, which varied at a few MSAA edge samples.
        vec3 planeNormal=normalize(cross(across,up));
        vec3 viewNormal=mat3(modelViewMatrix)*planeNormal;
        vec3 viewCenter=(modelViewMatrix*vec4(center*uSize,1.0)).xyz;
        center+=planeNormal*.004*sign(dot(viewNormal,-viewCenter));
      #endif
      #ifdef GC_RIPPLE_FEATHER
        extent=1.2;
      #endif
      // Keep the established opening; retirement fades without collapsing the water disc.
      radius*=mix(.48,1.0,sqrt(smoothstep(0.0,.085,localAge)));
      vec3 p=center+(across*position.x+up*position.y)*radius*extent;
      vRipple=position.xy*extent;vAge=localAge;vSeed=aTime.y;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(p*uSize,1.0);
    }`;
  // Small, independently drifting variations break up the rings like moving
  // water. Avoid a shared angular sine: it turns every ring into the same flower.
  const rippleNoise=`
    float grHash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
    float grNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
      return mix(mix(grHash(i),grHash(i+vec2(1,0)),f.x),mix(grHash(i+vec2(0,1)),grHash(i+vec2(1,1)),f.x),f.y);}
  `;
  const rippleFragment=`uniform vec3 uColor;${rippleNoise}
    varying vec2 vRipple;varying float vAge,vFade,vSeed;
    void main(){
      if(vFade<=0.0)discard;
      vec2 q=vRipple,drift=vec2(vAge*.23,-vAge*.17)+vSeed*17.0;
      float r=length(q),flow=grNoise(q*7.0+drift),fine=grNoise(q*23.0-drift*.8);
      float warped=r+(flow-.5)*.045+(fine-.5)*.012;
      float phase=warped*52.0-vAge*8.5+sin(atan(q.y,q.x)*2.0+r*13.0-vAge*1.7)*.3;
      float crest=pow(.5+.5*cos(phase),5.5);
      float softCrest=pow(.5+.5*cos(phase),1.6);
      float threads=pow(.5+.5*cos(warped*91.0-vAge*6.4+flow*3.0),14.0);
      float broken=smoothstep(.18,.80,grNoise(q*vec2(11.0,16.0)+drift*.45));
      float edge=.64+(flow-.5)*.025;
      float alpha=1.0;
      #ifdef GC_RIPPLE_FEATHER
        // During retirement this existing transparent layer also carries the core.
        if((vAge<=1.10&&r<edge-.005)||r>1.16)discard;
        alpha=(1.0-smoothstep(edge,1.16,r))*(vAge>1.10?vFade:1.0);
      #else
        if(r>edge||vAge>1.10)discard;
      #endif
      vec2 hot=(q+vec2(.075,-.02))*vec2(1.7,1.0);
      float core=exp(-dot(hot,hot)*26.0);
      float reflection=exp(-pow((q.x+.10)*8.0,2.0)-pow(q.y*2.4,2.0))*.35;
      vec3 trough=uColor*vec3(.40,.43,.48)*(.75+flow*.5);
      vec3 waveColor=mix(uColor,vec3(1.0,.94,.73),.72);
      float waves=(crest*1.02+softCrest*.22+threads*.14*min(uDetail,1.4))*(.18+broken*.82);
      vec3 gold=trough+waveColor*waves;
      gold+=vec3(1.0,.96,.79)*(core*4.0+reflection*1.4);
      // The core stays opaque while held, then joins the feather layer for a smooth fade.
      gl_FragColor=vec4(gold*(.8+.2*vFade),alpha);${output}
    }`;
  const rippleMaterial=shader(rippleFragment,rippleVertex,{},false);
  rippleMaterial.transparent=false;rippleMaterial.depthWrite=true;
  rippleMaterial.userData.ownLifecycle=true;

  // Broad local bloom, shared by website and downloads without scene capture.
  const rippleBloomMaterial=shader(`uniform vec3 uColor;${rippleNoise}
    varying vec2 vRipple;varying float vAge,vFade,vSeed;
    void main(){
      float r=length(vRipple);if(vFade<=0.0||r>=1.9)discard;
      float mist=grNoise(vRipple*4.2+vec2(vAge*.17,-vAge*.13)+vSeed*11.0);
      float haze=.7+.3*mist;
      float bloom=exp(-r*r*1.05)*.54+exp(-r*r*5.0)*.18;
      float bloomSpread=.22+.78*smoothstep(.28,1.10,r);
      float alpha=bloom*haze*bloomSpread*(1.0-smoothstep(1.35,1.9,r))*vFade*(.8+.2*min(uDetail,1.5));
      if(alpha<.002)discard;
      vec3 color=mix(uColor,vec3(1.0,.88,.55),.25)*1.8;
      gl_FragColor=vec4(color,alpha);${output}
    }`,rippleVertex,{},true,{GC_RIPPLE_GLOW:1});
  rippleBloomMaterial.userData.ownLifecycle=true;

  // One branched ribbon pattern, instanced per landing. Seeded rotation and
  // radial variation distinguish contacts without allocating geometry per frame.
  const crackSegments=[];
  function gcCrackGeometry(){
    const positions=[],uvs=[];let state=0x63ab91;
    const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
    function strip(a,b,width,r0,r1){
      crackSegments.push({a,b,r0,r1});
      const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),nx=-dz/length,nz=dx/length;
      const v=[[a[0]+nx*width,a[1]+nz*width,-1,r0],[a[0]-nx*width,a[1]-nz*width,1,r0],
        [b[0]+nx*width*.55,b[1]+nz*width*.55,-1,r1],[b[0]-nx*width*.55,b[1]-nz*width*.55,1,r1]];
      for(const i of [0,2,1,1,2,3]){positions.push(v[i][0],.012,v[i][1]);uvs.push(v[i][2],v[i][3]);}
    }
    for(let ray=0;ray<8;ray++){
      const angle=ray*Math.PI/4+(random()-.5)*.34,reach=.78+random()*.22;let previous=[0,0];
      for(let segment=1;segment<=6;segment++){
        const radius=segment/6*reach,turn=angle+(random()-.5)*.35;
        const next=[Math.cos(turn)*radius,Math.sin(turn)*radius];
        strip(previous,next,.034*(1-segment/8),(segment-1)/6,segment/6);
        if(segment===2||segment===4){
          const fork=turn+(random()>.5?1:-1)*(.45+random()*.5),length=.12+random()*.13;
          strip(next,[next[0]+Math.cos(fork)*length,next[1]+Math.sin(fork)*length],.012,segment/6,Math.min(1,segment/6+.22));
        }
        previous=next;
      }
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));return g;
  }
  const crackGeometry=gcInstances(gcCrackGeometry(),maxChains);
  const gcCrackTransform=`
    vec2 gcCrackPoint(vec2 q,float seed){
      float radius=length(q),angle=seed*6.283185;
      q*=.88+.12*sin((radius>0.0?atan(q.y,q.x):0.0)*3.0+seed*37.0+radius*4.0);
      return mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*q;
    }
  `;
  const crackMaterial=shader(`uniform vec3 uColor;varying vec2 vCrack;varying float vAge;
    void main(){
      float reveal=smoothstep(vCrack.y*.15,vCrack.y*.15+.03,vAge-.35);
      float fade=1.0-smoothstep(3.05,3.35,vAge); // Three seconds from contact, including the final 0.3s fade.
      float edge=1.0-smoothstep(.72,1.0,abs(vCrack.x));
      float alpha=reveal*fade*edge;if(alpha<.004)discard;
      // A yellow-gold luminous core, not a brown surface multiplied into white.
      float core=1.0-smoothstep(.08,.72,abs(vCrack.x));
      vec3 color=mix(uColor*vec3(1.0,.72,.12),mix(uColor,vec3(1.0,.92,.44),.35)*1.5,core);
      gl_FragColor=vec4(color,alpha);${output}
    }`,`${gcCrackTransform}attribute vec3 aEnd;attribute vec2 aTime;uniform float uTime;varying vec2 vCrack;varying float vAge;
    void main(){
      vec2 q=gcCrackPoint(position.xz,aTime.y);
      vec3 p=aEnd+vec3(q.x,position.y,q.y);vCrack=uv;vAge=uTime-aTime.x;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(p*uSize,1.0);
    }`,{},false);
  crackMaterial.userData.ownLifecycle=true;
  const cracks=mesh(crackGeometry,crackMaterial,0);cracks.name='golden-chain-ground-cracks';

  // Decorative streams alone use the shared density allocation pool.
  const gcParticleVertex=`${gcMotion}
    attribute vec4 seed;attribute float aArrow;attribute vec3 aStart,aEnd;attribute vec2 aTime;
    uniform float uTime;varying vec2 vUv;varying float vFade,vHeat,vGround;
    void main(){
      vec3 delta=aEnd-aStart;float span=length(delta);
      vec3 axis=delta/span,right=normalize(cross(axis,vec3(0,1,0))),side=normalize(cross(right,axis));
      float settledTip=gcTipDistance(1.10,span),tail=settledTip-.64;
      float distance=mix(tail*(.02+seed.y*.96),settledTip-.64+seed.y*.30,aArrow);
      float route=clamp(distance/span,0.0,1.0);
      float age=uTime-aTime.x-1.10-(route*.78+seed.z*.22)*.75;
      float angle=seed.w*6.28318;vec3 radial=right*cos(angle)+side*sin(angle);
      vec3 velocity=radial*(.7+seed.z*.7)+vec3(0,.45+seed.w*.5,0);
      float drift=max(age,0.0);
      vec3 p=aStart+axis*distance+radial*mix(.105,.22*(1.0-seed.y*.47),aArrow)+velocity*drift;
      p.y-=1.4*drift*drift;vGround=p.y;
      float scale=(.085+seed.w*.065)*(1.0-smoothstep(.12,.35,age));
      vFade=step(0.0,age)*(1.0-smoothstep(.08,.35,age));vHeat=1.0-clamp(age/.35,0.0,1.0);
      vec4 view=modelViewMatrix*vec4(p*uSize,1.0);
      float spin=seed.x*6.28318+drift*(seed.z-.5)*15.0;
      vec2 direction=vec2(cos(spin),sin(spin));
      float parentScale=length(modelViewMatrix[0].xyz);
      vec2 offset=(direction*position.x*1.5+vec2(-direction.y,direction.x)*position.y*.58)*scale;
      // Clip the actual billboard surface against local ground, including host rotation.
      vec3 localOffset=vec3(dot(normalMatrix[0],vec3(offset,0)),dot(normalMatrix[1],vec3(offset,0)),dot(normalMatrix[2],vec3(offset,0)))*parentScale;
      vGround+=localOffset.y;
      view.xy+=offset*uSize*parentScale;vUv=uv;gl_Position=projectionMatrix*view;
    }`;
  const gcParticleFragment=`uniform vec3 uColor;varying vec2 vUv;varying float vFade,vHeat,vGround;
    void main(){
      if(vGround<0.0)discard;
      vec2 q=vUv*2.0-1.0;
      float edge=max(max(-q.y-.55,q.x*.92+q.y*.5-.30),-q.x*.75+q.y*.55-.34);
      float chip=1.0-smoothstep(-.045,.025,edge);
      float halo=exp(-pow(max(edge,0.0)*9.0,2.0))*.27*(1.0-smoothstep(.45,1.0,length(q)));
      float alpha=(chip*.85+halo)*vFade*min(1.0,uDetail);if(alpha<.004)discard;
      vec3 gold=uColor*(.85+vUv.y*.7)+vec3(.45,.34,.10)*exp(-abs(edge)*60.0)*vHeat;
      gl_FragColor=vec4(gold,alpha);${output}}`;
  const dissolveMaterial=shader(gcParticleFragment,gcParticleVertex,{},true);dissolveMaterial.userData.ownLifecycle=true;
  const motes=instanced(new THREE.PlaneGeometry(1,1),cap,.5,dissolveMaterial,4);motes.name='golden-chain-dissolve-motes';
  // Layer IDs are mapped explicitly by the shader catalog generator.
  const ripples=mesh(rippleGeometry,rippleMaterial,2);ripples.name='golden-chain-endpoint-ripples';
  const rippleBloom=mesh(rippleGeometry,rippleBloomMaterial,3);rippleBloom.name='golden-chain-endpoint-bloom';
  // Contact keeps the arrow visible; half its axial length eases below ground.
  const arrowBase=new THREE.ConeGeometry(.22,.64,4,1);
  const arrowFacets=arrowBase.toNonIndexed();arrowBase.dispose();arrowFacets.computeVertexNormals();
  const arrowGeometry=gcInstances(arrowFacets,maxChains);
  const arrowMaterial=shader(gcChainFragment,`${gcMotion}
    attribute vec3 aStart,aEnd;attribute vec2 aTime;uniform float uTime;
    varying vec3 vNormal,vViewPosition,vLocal,vArrowSurface;varying vec2 vRingUv;
    varying float vAge,vRoute,vDissolve,vAlive,vSeed,vSourceDistance;
    void main(){
      float age=uTime-aTime.x;
      vec3 delta=aEnd-aStart;float span=length(delta);vec3 forward=delta/span;
      vec3 right=normalize(cross(forward,vec3(0,1,0))),side=normalize(cross(right,forward));
      vec3 local=aStart+forward*(gcTipDistance(age,span)-.32+position.y)+right*position.x+side*position.z;
      vLocal=local;vNormal=normalize(normalMatrix*(forward*normal.y+right*normal.x+side*normal.z));
      vec4 view=modelViewMatrix*vec4(local*uSize,1.0);vViewPosition=-view.xyz;
      vArrowSurface=position;vRingUv=uv;vAge=age;vRoute=clamp(dot(local-aStart,forward)/span,0.0,1.0);vDissolve=clamp((age-1.10)/.75,0.0,1.0);vSeed=aTime.y;
      vSourceDistance=gcTipDistance(age,span)-.32+position.y;
      vAlive=step(0.0,age)*(1.0-step(1.85,age));
      gl_Position=projectionMatrix*view;
    }`,{},false,{GC_ARROW:1});
  arrowMaterial.transparent=false;arrowMaterial.depthWrite=true;arrowMaterial.side=THREE.FrontSide;arrowMaterial.userData.ownLifecycle=true;
  const arrowheads=mesh(arrowGeometry,arrowMaterial,1);arrowheads.name='golden-chain-arrowheads';
  const rippleFeatherMaterial=shader(rippleFragment,rippleVertex,{},false,{GC_RIPPLE_FEATHER:1});
  rippleFeatherMaterial.userData.ownLifecycle=true;
  const rippleFeather=mesh(rippleGeometry,rippleFeatherMaterial,2);rippleFeather.name='golden-chain-endpoint-feather';
  // A small separate stream rises from the actual branched crack segments.
  // It shares chip shading; its former density allocation is multiplied by eight, without taking erosion chips.
  const crackChipMaterial=shader(gcParticleFragment,`${gcCrackTransform}
    attribute vec4 seed;attribute vec3 aEnd,aCrackA,aCrackB;attribute vec2 aTime;uniform float uTime;
    varying vec2 vUv;varying float vFade,vHeat,vGround;
    void main(){
      float along=.15+seed.x*.70;
      vec2 q=mix(gcCrackPoint(aCrackA.xy,aTime.y),gcCrackPoint(aCrackB.xy,aTime.y),along);
      float reveal=mix(aCrackA.z,aCrackB.z,along)*.15+.03;
      float contactAge=uTime-aTime.x-.35;
      float delay=reveal+seed.z*.42,elapsed=contactAge-delay;
      // Reuse each slot only after its 1.95s life; freeze the final birth before 3s.
      // Its existing chip can then finish naturally after the ground has faded.
      float cycle=min(floor(max(elapsed,0.0)/1.95),floor((3.0-delay-.0001)/1.95));
      float age=elapsed-cycle*1.95,drift=max(age,0.0);
      float angle=seed.w*6.283185;
      // A second 50% reduction gives one quarter of the original translational velocity.
      vec3 p=aEnd+vec3(q.x,.012,q.y)+vec3(cos(angle)*.14,(.48+seed.y*.38)*2.0,sin(angle)*.14)*drift*.25;
      p.y+=.13*drift*drift*2.0*.25;
      // Keep the established entrance, then hold size and light through 1.6s.
      // Only opacity retires over the final 0.35s; movement and spin stay independent.
      vFade=step(0.0,elapsed)*smoothstep(0.0,.105,age)*(1.0-smoothstep(1.6,1.95,age));
      vHeat=1.0;
      float scale=.035+seed.y*.045,spin=angle+drift*(seed.x-.5)*5.0;
      vec2 direction=vec2(cos(spin),sin(spin));
      vec2 offset=(direction*position.x*1.5+vec2(-direction.y,direction.x)*position.y*.58)*scale;
      float parentScale=length(modelViewMatrix[0].xyz);
      vec3 localOffset=vec3(dot(normalMatrix[0],vec3(offset,0)),dot(normalMatrix[1],vec3(offset,0)),dot(normalMatrix[2],vec3(offset,0)))*parentScale;
      vGround=p.y+localOffset.y;vec4 view=modelViewMatrix*vec4(p*uSize,1.0);
      view.xy+=offset*uSize*parentScale;vUv=uv;gl_Position=projectionMatrix*view;
    }`,{},true);
  crackChipMaterial.userData.ownLifecycle=true;
  const crackChipCapacity=Math.round(cap*.30)*8;
  const crackChips=instanced(new THREE.PlaneGeometry(1,1),crackChipCapacity,.30,crackChipMaterial,4);
  crackChips.geometry.userData.goldenChainCrackChips=true;crackChips.name='golden-chain-crack-chips';
  for(const name of ['aCrackA','aCrackB'])crackChips.geometry.setAttribute(name,new THREE.InstancedBufferAttribute(new Float32Array(crackChipCapacity*3),3));
  for(let i=0;i<crackChipCapacity;i++){
    const segment=crackSegments[Math.min(crackSegments.length-1,Math.floor(crackChips.geometry.attributes.seed.getY(i)*crackSegments.length))];
    crackChips.geometry.attributes.aCrackA.setXYZ(i,segment.a[0],segment.a[1],segment.r0);
    crackChips.geometry.attributes.aCrackB.setXYZ(i,segment.b[0],segment.b[1],segment.r1);
  }
  // Rounded glow ribbons cover only the neighborhoods of the real fissures.
  // One batch adds soft local bloom without a screen capture or full-screen pass.
  const glowPositions=[],glowA=[],glowB=[];
  for(const segment of crackSegments)for(const corner of [[-1,-1],[1,-1],[-1,1],[-1,1],[1,-1],[1,1]]){
    glowPositions.push(corner[0],corner[1],0);
    glowA.push(segment.a[0],segment.a[1],segment.r0);glowB.push(segment.b[0],segment.b[1],segment.r1);
  }
  const glowBase=new THREE.BufferGeometry();glowBase.setAttribute('position',new THREE.Float32BufferAttribute(glowPositions,3));
  glowBase.setAttribute('aCrackA',new THREE.Float32BufferAttribute(glowA,3));glowBase.setAttribute('aCrackB',new THREE.Float32BufferAttribute(glowB,3));
  const crackGlowGeometry=gcInstances(glowBase,maxChains);
  const crackGlowMaterial=shader(`uniform float uCrackBloom,uCrackBloomSpread;uniform vec3 uColor;varying vec2 vGlow;varying vec2 vReveal;
    varying float vAge,vLength;
    void main(){
      float along=clamp((vGlow.x+vLength*.5)/max(vLength,.0001),0.0,1.0);
      float progress=mix(vReveal.x,vReveal.y,along);
      float reveal=smoothstep(progress*.15,progress*.15+.03,vAge-.35);
      float fade=1.0-smoothstep(3.05,3.35,vAge); // Three seconds from contact, including the final 0.3s fade.
      float distance=length(vec2(max(abs(vGlow.x)-vLength*.5,0.0),vGlow.y))/uCrackBloomSpread;
      // Both lobes fade to zero before the geometry edge; no rectangular rim.
      float glow=(exp(-distance*distance/ .0036)*.46+exp(-distance*distance/ .0144)*.24);
      float alpha=glow*(1.0-smoothstep(.13,.20,distance))*reveal*fade*uCrackBloom;
      if(alpha<.001)discard;
      gl_FragColor=vec4(uColor*vec3(2.3,1.8,.65),alpha);${output}
    }`,`${gcCrackTransform}
    attribute vec3 aEnd,aCrackA,aCrackB;attribute vec2 aTime;uniform float uTime,uCrackBloomSpread;
    varying vec2 vGlow,vReveal;varying float vAge,vLength;
    void main(){
      vec2 a=gcCrackPoint(aCrackA.xy,aTime.y),b=gcCrackPoint(aCrackB.xy,aTime.y),delta=b-a;
      float lengthAB=length(delta);vec2 direction=delta/max(lengthAB,.0001),across=vec2(-direction.y,direction.x);
      float reach=.20*uCrackBloomSpread;
      vGlow=position.xy*vec2(lengthAB*.5+reach,reach);vLength=lengthAB;vReveal=vec2(aCrackA.z,aCrackB.z);vAge=uTime-aTime.x;
      vec2 q=(a+b)*.5+direction*vGlow.x+across*vGlow.y;
      vec3 p=aEnd+vec3(q.x,.014,q.y);gl_Position=projectionMatrix*modelViewMatrix*vec4(p*uSize,1.0);
    }`,{},true);
  crackGlowMaterial.userData.ownLifecycle=true;
  // Draw glow before the narrow core so the core stays gold instead of washing white.
  const crackGlow=mesh(crackGlowGeometry,crackGlowMaterial,-1);crackGlow.name='golden-chain-crack-bloom';
  motes.geometry.setAttribute('aArrow',new THREE.InstancedBufferAttribute(new Float32Array(cap),1));
  // A separate contact burst never borrows the existing erosion/rising-chip budget.
  const impactMaterial=shader(gcParticleFragment.replace(
    'gl_FragColor=vec4(gold,alpha);',
    'float facet=smoothstep(-.025,.025,q.x+q.y*.32); gold=uColor*mix(.38,1.55,facet)+uColor*.35*vHeat*exp(-abs(edge)*40.0); gl_FragColor=vec4(gold,alpha);'
  ),`
    attribute vec4 seed;attribute vec3 aEnd;attribute vec2 aTime;
    uniform float uTime;varying vec2 vUv;varying float vFade,vHeat,vGround;
    void main(){
      float age=uTime-aTime.x-.35-seed.w*.025,t=max(age,0.0);
      float angle=seed.x*6.283185,apex=mix(.30,.50,seed.y),gravity=12.0;
      float vy=sqrt(2.0*gravity*apex),land=(vy+sqrt(vy*vy+2.0*gravity*.025))/gravity;
      float radius=mix(.60,1.30,seed.z),progress=(1.0-exp(-3.0*t))/(1.0-exp(-3.0*land));
      vec3 p=aEnd+vec3(cos(angle)*radius*progress,.025+vy*t-.5*gravity*t*t,sin(angle)*radius*progress);
      vFade=step(0.0,age)*(1.0-smoothstep(land-.07,land,age))*(1.0-step(.65,age));
      vHeat=1.0-clamp(t/.30,0.0,1.0);vUv=uv;
      float spin=angle+t*mix(8.0,17.0,seed.z),flip=mix(.4,1.0,abs(cos(t*11.0+angle)));
      // The procedural shard occupies about 0.58 of the quad along its long axis.
      float scale=mix(.04,.08,seed.y)/.58;
      vec2 direction=vec2(cos(spin),sin(spin));
      vec2 offset=(direction*position.y+vec2(-direction.y,direction.x)*position.x*.72*flip)*scale;
      float parentScale=length(modelViewMatrix[0].xyz);
      vec3 localOffset=vec3(dot(normalMatrix[0],vec3(offset,0)),dot(normalMatrix[1],vec3(offset,0)),dot(normalMatrix[2],vec3(offset,0)))*parentScale;
      vGround=p.y+localOffset.y;vec4 view=modelViewMatrix*vec4(p*uSize,1.0);
      view.xy+=offset*uSize*parentScale;gl_Position=projectionMatrix*view;
    }`,{},false);
  impactMaterial.userData.ownLifecycle=true;
  const impactChips=instanced(new THREE.PlaneGeometry(1,1),maxChains*24,0,impactMaterial,4);
  impactChips.name='golden-chain-impact-chips';impactChips.geometry.userData.goldenChainImpactChips=true;
  const decorative=[motes.geometry,crackChips.geometry,impactChips.geometry];
  for(const geometry of decorative){
    const capacity=geometry.attributes.seed.count;
    geometry.setAttribute('aStart',new THREE.InstancedBufferAttribute(new Float32Array(capacity*3),3));
    geometry.setAttribute('aEnd',new THREE.InstancedBufferAttribute(new Float32Array(capacity*3),3));
    geometry.setAttribute('aTime',new THREE.InstancedBufferAttribute(new Float32Array(capacity*2),2));
  }
  function gcWrite(geometry,index,chain){
    geometry.attributes.aStart.setXYZ(index,chain.start[0],chain.start[1],chain.start[2]);
    geometry.attributes.aEnd.setXYZ(index,chain.end[0],chain.end[1],chain.end[2]);
    geometry.attributes.aTime.setXY(index,chain.birth,chain.seed);
  }
  function gcDirty(geometry){geometry.attributes.aStart.needsUpdate=true;geometry.attributes.aEnd.needsUpdate=true;geometry.attributes.aTime.needsUpdate=true;}
  let configuredQuantity=-1,configuredSpread=-1;
  function gcSynchronizeLayout(){
    const quantity=Math.max(1,Math.min(GOLDEN_CHAIN.maxQuantity,Math.round(uniforms.uQuantity.value))),spread=uniforms.uSpread.value;
    if(quantity!==configuredQuantity||spread!==configuredSpread){
      configuredQuantity=quantity;configuredSpread=spread;let chainIndex=0,linkIndex=0;
      for(let wave=0;wave<GOLDEN_CHAIN.waves;wave++)for(let slot=0;slot<quantity;slot++,chainIndex++){
        const chain=gcConfigureChain(randomValues,wave,slot,quantity,spread,layout[chainIndex]);gcWrite(crackGeometry,chainIndex,chain);gcWrite(crackGlowGeometry,chainIndex,chain);gcWrite(arrowGeometry,chainIndex,chain);
        gcWrite(rippleGeometry,chainIndex,chain);
        for(let link=0;link<chain.count;link++,linkIndex++){
          gcWrite(chainGeometry,linkIndex,chain);chainGeometry.attributes.aLink.setXYZW(linkIndex,link,chain.count,chain.pitch,chain.seed+link*.173);
        }
      }
      for(let i=chainIndex;i<layout.length;i++)layout[i].active=false;
      chainGeometry.instanceCount=linkIndex;crackGeometry.instanceCount=crackGlowGeometry.instanceCount=chainIndex;gcDirty(crackGlowGeometry);
      arrowGeometry.instanceCount=chainIndex;gcDirty(arrowGeometry);
      rippleGeometry.instanceCount=chainIndex;gcDirty(rippleGeometry);
      gcDirty(chainGeometry);chainGeometry.attributes.aLink.needsUpdate=true;gcDirty(crackGeometry);
      for(const name of ['aStart','aEnd','aTime','aLink']){
        spriteGeometry.attributes[name].array.set(chainGeometry.attributes[name].array);
        spriteGeometry.attributes[name].needsUpdate=true;
      }
      spriteGeometry.instanceCount=linkIndex;
      for(const geometry of decorative){
        for(let i=0;i<geometry.attributes.seed.count;i++){gcWrite(geometry,i,layout[i%chainIndex]);if(geometry===motes.geometry)geometry.attributes.aArrow.setX(i,Math.floor(i/chainIndex)%4===0?1:0);}
        if(geometry===motes.geometry)geometry.attributes.aArrow.needsUpdate=true;
        gcDirty(geometry);
      }
    }
  }
  let configuredSprite;
  function gcSynchronize(){
    gcSynchronizeLayout();
    const sprite=uniforms.uSpriteChains.value===1;
    if(sprite!==configuredSprite){
      configuredSprite=sprite;
      body.geometry=halo.geometry=sprite?spriteGeometry:chainGeometry;
      body.material=sprite?spriteBodyMaterial:bodyMaterial;
      halo.material=sprite?spriteHaloMaterial:haloMaterial;
    }
    const time=uniforms.uTime.value;
    body.visible=halo.visible=time>0&&time<4.45;
    ripples.visible=rippleBloom.visible=rippleFeather.visible=time>0&&time<4.15;
    arrowheads.visible=time>0&&time<4.45;
    cracks.visible=crackGlow.visible=time>=.35&&time<(GOLDEN_CHAIN.waves-1)*GOLDEN_CHAIN.waveGap+GOLDEN_CHAIN.stagger+GOLDEN_CHAIN.flight+GOLDEN_CHAIN.groundDuration;
    // Latest contact 2.95s + maximum first-birth delay .60s + two 1.95s lives.
    crackChips.visible=time>=.35&&time<(GOLDEN_CHAIN.waves-1)*GOLDEN_CHAIN.waveGap+GOLDEN_CHAIN.stagger+GOLDEN_CHAIN.flight+.60+2*GOLDEN_CHAIN.risingLifetime;
    impactChips.visible=time>=.35&&time<3.625;
    motes.visible=time>=1.10&&time<4.8;
  }
  // The runtime invokes this on option changes and updates, including paused
  // changes. No per-layer render hooks are needed to resynchronize the layout.
  animated.push(gcSynchronize);gcSynchronize();
  return true;
}


const preset = {
  "id": "astral-gate",
  "lifecycle": {
    "start": 0.8,
    "end": 0.8
  },
  "name": "星紋之門",
  "english": "Gate of Astral Tracery",
  "category": "portal",
  "color": "#c1b8ff",
  "description": "發光門框一段段展開，門內星光流動，停止使用後慢慢關上。",
  "tags": "門 傳送 空間 星界 Astral 星隙門扉 Astral gate",
  "maxParticles": 512,
  "kind": 8,
  "variant": 0,
  "duration": 5,
  "burst": false,
  "seed": 385854,
  "schools": [
    "astral"
  ],
  "previewTime": 1.4,
  "thumbnailTime": 1.4
};
export const defaultOptions = {
  "speed": 1,
  "detail": 1,
  "color": "#c1b8ff",
  "size": 1,
  "density": 0.5
};
export default function createVFX(options = {}) {
  return createEffect(preset, { ...defaultOptions, ...options });
}
