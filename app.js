'use strict';
const DEFAULT_GROUPS=[
  {name:'마감재',cats:['바닥재','벽지','천장지','걸레받이','몰딩']},
  {name:'타일',cats:['욕실 1','욕실 2','주방 타일','현관 타일','발코니 타일']},
  {name:'가구·도어 색상',cats:['가구 색상','중문 색상','문 색상','문틀 색상']},
  {name:'주방',cats:['싱크볼','싱크수전','후드']},
  {name:'욕실',cats:['변기','세면대','세면수전','욕실장','슬라이드바','휴지걸이','수건걸이','환풍기']},
  {name:'전기',cats:['콘센트','스위치','조명','등 색상','조명 종류']},
  {name:'기타',cats:['도어락','월패드','실링팬','시스템 에어컨']}
];
let GROUPS=structuredClone(DEFAULT_GROUPS);
const DEFAULT_SETTINGS={title:'Material Library',subtitle:'보고, 담고, 함께 그려보는 우리 집의 재료들.',columns:3,sort:'manual',brandSize:14,brandSpacing:5,titleFont:'montserrat',titleSize:48,titleMobileSize:32,titleWeight:300,titleSpacing:-2,titleGap:12,steps:['실제 자재를 등록해요.','고객별로 가볍게 담아요.','제안서에 바로 건네요.']};
const allCats=()=>GROUPS.flatMap(g=>g.cats),ROOMS=['미지정','공통','거실','주방','안방','침실','공용 욕실','안방 욕실','현관','발코니'];
const $=id=>document.getElementById(id),escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>crypto.randomUUID(),safeName=s=>String(s).replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').slice(0,70)||'YUHIHA';
let state={version:1,materials:[],deletedMaterials:[],projects:[],deletedProjects:[],active:'',favorites:[],groups:structuredClone(DEFAULT_GROUPS),settings:structuredClone(DEFAULT_SETTINGS)},db,group=0,subcategory='전체',brand='전체',series='전체',query='',filter='all',imageDraft='',cabinetColorDraft=null,cabinetColorsBusy=false,saveChain=Promise.resolve(),toastTimer;
const samples=[];
let consultationDraft=null,consultationLoadedId=null;
const todaySeoul=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date());
function newConsultationDraft(){return {id:uid(),name:'새 상담',customer:'',phone:'',address:'',housing:'아파트',area:'',budget:'',constructionDate:'',note:'',date:todaySeoul(),items:[]}}

async function exportFontsReady(){const fonts=document.fonts;if(fonts.load)await Promise.all([400,500,600].map(weight=>fonts.load(weight+' 24px Pretendard')));await fonts.ready}
function setSaveStatus(message){$('saveState').textContent=message;for(const node of document.querySelectorAll('.project-save-status'))node.textContent=message}
function toast(msg){$('toast').textContent=msg;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3300)}
function swatch(color,kind,seed=1){const c=document.createElement('canvas');c.width=640;c.height=580;const x=c.getContext('2d');x.fillStyle=color;x.fillRect(0,0,640,580);let n=seed+32;const rand=()=>{n=(n*1664525+1013904223)>>>0;return n/4294967296};for(let i=0;i<22000;i++){x.fillStyle=rand()>.5?'rgba(255,255,255,.12)':'rgba(30,30,20,.045)';const a=rand()*640,b=rand()*580;x.fillRect(a,b,kind==='wood'?rand()*90+3:rand()*2+1,kind==='linen'?2:1)}if(kind==='wood'){for(let i=0;i<60;i++){x.strokeStyle=`rgba(62,42,20,${rand()*.13})`;x.lineWidth=rand()*2+.3;x.beginPath();let yy=rand()*580;x.moveTo(0,yy);x.bezierCurveTo(180,yy+rand()*30,450,yy-rand()*30,640,yy+rand()*15);x.stroke()}x.strokeStyle='#765d3530';x.beginPath();x.moveTo(0,194);x.lineTo(640,194);x.moveTo(0,388);x.lineTo(640,388);x.stroke()}if(kind==='tile'){x.strokeStyle='#ffffff99';x.lineWidth=3;x.beginPath();x.moveTo(320,0);x.lineTo(320,580);x.moveTo(0,290);x.lineTo(640,290);x.stroke()}if(kind==='linen'){x.fillStyle='#ffffff16';for(let i=0;i<640;i+=4)x.fillRect(i,0,1,580);for(let i=0;i<580;i+=4)x.fillRect(0,i,640,1)}return c.toDataURL('image/jpeg',.87)}
function makeSamples(){state.materials=[['벽지','아이보리 벽지','#eee9df','linen'],['바닥재','오크 바닥','#c6ad86','wood'],['가구 색상','크림 도어','#e7e1d6','linen'],['주방 타일','주방 타일','#ddd7ce','tile'],['욕실 1','욕실 타일','#c8c6c0','tile'],['몰딩','몰딩','#dad5cc','wood']].map(([cat,name,color,kind],i)=>({id:'review-demo-'+i,name:'검토용 '+name+' (실제품 아님)',cat,brand:'가상 검토 샘플',model:'DEMO-'+i,spec:'실제 규격 없음',note:'운영 자재와 무관한 가상 자료입니다.',url:'',sample:false,image:swatch(color,kind,i+1)}));}
function validGroups(groups){if(!Array.isArray(groups)||!groups.length||groups.length>20)return null;const seen=new Set(),clean=[];for(const item of groups){const name=String(item?.name||'').trim(),cats=Array.isArray(item?.cats)?item.cats.map(c=>String(c).trim()).filter(Boolean):[];if(!name||name.length>30||!cats.length||cats.length>30||seen.has(name))return null;const unique=[...new Set(cats)];for(const cat of unique){if(cat.length>40||seen.has('cat:'+cat))return null;seen.add('cat:'+cat)}seen.add(name);clean.push({name,cats:unique})}return clean}
function applyGroups(data){GROUPS=validGroups(data?.groups)||structuredClone(DEFAULT_GROUPS);data.groups=structuredClone(GROUPS);group=Math.min(group,GROUPS.length-1);if(subcategory!=='전체'&&!allCats().includes(subcategory))subcategory='전체';return data}
function applySettings(data){const input=data?.settings||{},steps=Array.isArray(input.steps)?input.steps.map(s=>String(s).trim()).filter(Boolean).slice(0,3):[],storedTitle=String(input.title||DEFAULT_SETTINGS.title),legacyTitles=['공간을 채울, 좋은 선택.','YUHIHA Material Library'],num=(value,fallback,min,max)=>Math.min(max,Math.max(min,Number.isFinite(Number(value))?Number(value):fallback));data.settings={title:(legacyTitles.includes(storedTitle)?DEFAULT_SETTINGS.title:storedTitle).slice(0,70),subtitle:String(input.subtitle||DEFAULT_SETTINGS.subtitle).slice(0,120),columns:[2,3,4].includes(Number(input.columns))?Number(input.columns):3,sort:['manual','favorite','name','category'].includes(input.sort)?input.sort:'manual',brandSize:num(input.brandSize,14,8,40),brandSpacing:num(input.brandSpacing,5,-2,20),titleFont:['montserrat','pretendard'].includes(input.titleFont)?input.titleFont:'montserrat',titleSize:num(input.titleSize,48,20,120),titleMobileSize:num(input.titleMobileSize,32,18,72),titleWeight:[300,400,500,600].includes(Number(input.titleWeight))?Number(input.titleWeight):300,titleSpacing:num(input.titleSpacing,-2,-10,20),titleGap:num(input.titleGap,12,0,80),steps:[...steps,...DEFAULT_SETTINGS.steps].slice(0,3)};return data}
function migrateCategories(data){data=applySettings(applyGroups(data));data.deletedMaterials=Array.isArray(data.deletedMaterials)?data.deletedMaterials:[];const old={'필름':'가구 색상','타일':'욕실 1','마루':'바닥재','싱크대':'싱크볼','슬라이딩장':'욕실장','욕조수전':'세면수전','터닝도어':'문 색상'};for(const m of [...(data.materials||[]),...data.deletedMaterials]){if(allCats().includes(m.cat))continue;const previous=m.cat;m.cat=old[previous]||'가구 색상';m.note=`[이전 분류: ${previous} · 새 품목 확인 필요]${m.note?'\n'+m.note:''}`;}data.materials=(data.materials||[]).filter(m=>!m.sample&&!String(m.id).startsWith('sample-'));data.deletedMaterials=data.deletedMaterials.filter(m=>!m.sample&&!String(m.id).startsWith('sample-'));const activeIds=new Set(data.materials.map(m=>m.id));data.favorites=(data.favorites||[]).filter(id=>activeIds.has(id));for(const p of [...(data.projects||[]),...(data.deletedProjects||[])])p.items=(p.items||[]).filter(i=>!String(i.materialId).startsWith('sample-'));return data}
function materials(){return state.materials}
function material(id){return state.materials.find(x=>x.id===id)||(state.deletedMaterials||[]).find(x=>x.id===id)}
function selectionMaterial(item,lookup=material){
  const m=lookup(item.materialId);if(!m||!item.color)return m;
  return {...m,name:m.name+' · '+item.color,image:item.colorImage||m.colorImages?.[item.color]||m.image};
}
// Official MW variants only: retain the approved PNG and carry the finish into selections.
function vivantMilkWhite(m){
  const model=String(m.model||'').toUpperCase().replace(/[\s()_-]/g,'');
  return m.brand==='비반트'&&((m.cat==='세면수전'&&model==='CA340MW')||(m.cat==='샤워수전'&&model==='P1600MW'));
}
const FONTANA_ADDED_PALETTES={"TF-L4010":{"브러시드 니켈":[[15,15,14],[62,62,59],[91,90,85],[141,140,136],[164,163,158],[187,186,179],[204,203,195],[212,211,203],[247,245,234]],"블랙":[[0,0,0],[24,24,24],[39,39,39],[72,72,72],[87,87,87],[96,96,96],[100,100,100],[104,104,104],[234,217,185]],"골드":[[0,0,0],[2,2,1],[42,38,28],[176,167,143],[200,191,166],[235,216,160],[245,225,167],[248,233,193],[255,255,244]]},"TF-L4017":{"크롬":[[0,0,0],[14,14,14],[27,27,27],[102,103,104],[186,187,188],[227,229,229],[239,241,241],[243,244,244],[255,255,255]],"브러시드 골드":[[10,10,7],[74,68,55],[101,93,74],[129,128,127],[180,169,146],[217,203,171],[229,217,190],[244,226,185],[255,254,249]]}};
function fontanaAddedModel(m){return m.cat==='세면수전'&&m.brand==='폰타나'&&['TF-L4010','TF-L4017'].includes(String(m.model||'').trim().toUpperCase())?String(m.model).trim().toUpperCase():''}
function fontanaAddedPalette(m,name){return FONTANA_ADDED_PALETTES[fontanaAddedModel(m)]?.[name]||null}
function baseMaterialColor(m){
 if(m.cat==='샤워수전'&&!vivantMilkWhite(m))return SHOWER_BASE_FINISH[m.id]||SHOWER_FINISHES[m.id]?.colors[0]||'';
  if(m.cat==='싱크수전')return m.approvedImageFinish||'';
  if(isMonSatinHolder(m))return '사틴';
  if(m.cat==='욕실장')return Object.keys(m.colorImages||{})[0]||'';
  if(fontanaAddedModel(m))return fontanaAddedModel(m)==='TF-L4017'?'브러시드 니켈':'크롬';
  if(vivantMilkWhite(m))return '밀크화이트';
  if(['수건걸이','휴지걸이'].includes(m.cat))return accessoryColorName(accessoryFinish(m)?.image_color||'');
  if(m.cat==='세면수전')return BASIN_FAUCET_BASE_FINISH[m.id]||BASIN_FAUCET_FINISHES[m.id]?.[0]||'';
  if(m.cat==='슬라이드바')return slidebarFinishOptions(m)[0]||'';
  return '';
}
function nickelFirst(names){return [...names].sort((a,b)=>Number(/니켈/.test(b))-Number(/니켈/.test(a)))}
function materialFinishOptions(m){
 if(m.cat==='싱크수전')return Array.isArray(m.confirmedFinishes)?m.confirmedFinishes:[];
 if(fontanaAddedModel(m))return fontanaAddedModel(m)==='TF-L4017'?['브러시드 니켈','크롬','브러시드 골드']:['브러시드 니켈','크롬','블랙','골드'];
 if(vivantMilkWhite(m))return ['밀크화이트'];
 if(m.cat==='세면수전')return BASIN_FAUCET_FINISHES[m.id]||[];
 if(m.cat==='슬라이드바')return slidebarFinishOptions(m);
 if(m.cat==='샤워수전')return SHOWER_FINISHES[m.id]?.colors||[];
 if(['수건걸이','휴지걸이'].includes(m.cat))return accessoryFinish(m)?.sales_colors.map(accessoryColorName)||[];
 return Object.keys(m.colorImages||{});
}
function defaultMaterialColor(m){if(m.cat==='싱크수전'&&/니켈/.test(baseMaterialColor(m)))return baseMaterialColor(m);return materialFinishOptions(m).find(name=>/니켈/.test(name))||baseMaterialColor(m)}
async function defaultFinishImage(m){
 const name=defaultMaterialColor(m);if(!name||name===baseMaterialColor(m))return m.image;
 if(usesBasePngTint(m))return basePngFinish(m,name);
 return m.colorImages?.[name]||m.image;
}
function applyCatalogDefaultFinishes(){
 if(typeof document.querySelectorAll!=='function')return;
 document.querySelectorAll('#catalog .material-image[data-detail]').forEach(host=>{
  const m=material(host.dataset.detail),img=host.querySelector('img');if(!m||!img)return;
  defaultFinishImage(m).then(src=>{if(host.isConnected){img.src=src;img.alt=m.name+' · '+(m.cat==='싱크수전'&&!m.colorImages?.[defaultMaterialColor(m)]?baseMaterialColor(m):defaultMaterialColor(m))}}).catch(()=>{});
 });
}
function project(){return consultationDraft||state.projects.find(p=>p.id===state.active)}
async function initDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open('yuhiha-material-review-only',1);r.onupgradeneeded=()=>r.result.createObjectStore('data');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function readDB(){return new Promise((resolve,reject)=>{const r=db.transaction('data').objectStore('data').get('state');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
function save(){const snapshot=structuredClone(state);setSaveStatus('저장 중…');saveChain=saveChain.catch(()=>{}).then(()=>new Promise((resolve,reject)=>{if(!db){reject(Error('Storage unavailable'));return}const tx=db.transaction('data','readwrite');tx.objectStore('data').put(snapshot,'state');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})).then(()=>{setSaveStatus('● 이 기기에 저장됨')}).catch(()=>{setSaveStatus('저장 실패 · 백업 필요');toast('브라우저 저장 공간을 확인해 주세요. 백업으로 현재 자료를 보관할 수 있습니다.')});return saveChain}
function renderGroups(){if($('categoryNumber'))$('categoryNumber').textContent=String(group+1).padStart(2,'0');$('groups').innerHTML=GROUPS.map((g,i)=>`<button class="${group===i?'active':''}" data-group="${i}" aria-pressed="${group===i}"><span class="group-no">0${i+1}</span>${g.name}</button>`).join('');$('subcats').innerHTML=['전체',...GROUPS[group].cats].map(c=>`<button class="${subcategory===c?'active':''}" data-cat="${c}" aria-pressed="${subcategory===c}">${c}</button>`).join('');renderBrandChips()}
const BRAND_SERIES={'벽지|LX Z:IN':['디아망','베스트']};
const BRAND_ALIASES={'대림':'대림바스','대림바스':'대림바스','백조':'백조씽크','백조씽크':'백조씽크','르그랑legrand':'르그랑','르그랑':'르그랑'};
function canonicalBrand(value){const name=String(value||'').trim();return BRAND_ALIASES[name.toLowerCase().replace(/\s+/g,'')]||name}
// Presentation only: preserve manufacturer SKU and measurement precision in source data.
function displayModel(m){
 let value=String(m.model||'').trim();
 if(['비반트','폰타나','에떼르노','아메리칸스탠다드','제이리빙','도무스','필로토'].includes(m.brand))
  value=value.replace(/\s*[·/]\s*(?:메트실버|메트그레이|사틴 헤어라인|브러쉬드 니켈|브러시드 니켈|니켈|화이트|크롬|블랙|골드)\s*$/,'');
 if(m.brand==='비반트')value=value.replace(/\((?:MS|MW|MG|CG|CB|CR)\)\s*$/,'').replace(/\s+(?:MS|MW|MG|CG|CB|CR)$/,'');
 if(m.brand==='폰타나'&&/^TF-AC7100B\s+BN$/.test(value))value='TF-AC7100B';
 if(m.brand==='필로토'&&value==='빅토리아샤워301 니켈')value='빅토리아샤워301';
 return value;
}
function displayBrandName(m){const brand=canonicalBrand(m.brand);return brand==='대림바스'?'대림':brand}
function standardDimensionText(value){
 let text=String(value||'').trim();if(!text||/^(?:규격|치수|색상 정보).*?(?:확인 중|미입력)$/.test(text))return '';
 // Convert length units before rounding; never round 15.6 metres to 16 metres.
 text=text.replace(/(\d+(?:\.\d+)?)\s*(cm|m)(?=\s*(?:\([WDLHT]\)|[×xX/]|$))/g,(_,n,u)=>String(Number(n)*(u==='cm'?10:1000)));
 text=text.replace(/(\d+(?:\.\d+)?)\s*\(([WDLHT])\)/g,'$2 $1').replace(/\b([WDLHT])\s*(?=\d)/g,'$1 ')
 .replace(/\s*[×xX]\s*(?=\d|[WDLHT]\s*\d)/g,' × ').replace(/\s*\/\s*/g,' / ').replace(/\s*mm\b/g,'').replace(/[ØΦøφ]\s*(?=\d)/g,'Ø ');
 text=text.replace(/(\d+(?:\.\d+)?)\s*×\s*(\d+(?:\.\d+)?)\s*×\s*(\d+(?:\.\d+)?)\s*\(폭×길이×두께\)/g,'W $1 × L $2 × T $3');
 return integerDimensionText(text).replace(/ +/g,' ').trim();
}
function isYounglimFilm(m){return canonicalBrand(m.brand)==='영림'&&['우드 필름','일반 필름'].includes(m.cat)&&Boolean(String(m.model||'').trim())}
function normalizeMaterialName(m){
  if(isYounglimFilm(m)){
    const model=String(m.model).trim(),original=String(m.name||'').trim();
    const product=original.replace(/^영림[\s_]+/,'').trim();
    if(!m.productName&&product&&product!==model)m.productName=product;
    const next='영림_'+model;
    if(next!==original){if(!m.originalName)m.originalName=original;m.name=next}
    return m;
  }
  const brand=canonicalBrand(m.brand),displayBrand=brand==='대림바스'?'대림':brand;
  if(!displayBrand)return m;
  const original=String(m.name||'').trim();
  const aliases=[brand,displayBrand,...Object.keys(BRAND_ALIASES).filter(k=>BRAND_ALIASES[k]===brand)];
  if(brand==='LX Z:IN')aliases.push('LX');
  if(brand==='아메리칸스탠다드')aliases.push('아메스','American Standard');
  let product=original;
  for(const prefix of aliases.sort((a,b)=>b.length-a.length)){
    if(product.toLowerCase().startsWith(prefix.toLowerCase())&&/^[\s_*]/.test(product.slice(prefix.length))){product=product.slice(prefix.length).replace(/^[\s_*]+/,'');break}
  }
  const model=displayModel(m);
  if(m.brand==='비반트')product=product.replace(/\s+(?:MS|MW|MG|CG|CB|CR)(?=\s|$)/g,'');
  if(model&&product.toLowerCase().endsWith(model.toLowerCase())){
    const before=product.slice(0,-model.length);
    if(/[\s_*]$/.test(before)&&before.replace(/[\s_*]+$/,'').trim())product=before.replace(/[\s_*]+$/,'');
  }
  product=product.replace(/[_*]+/g,' ').replace(/\s+/g,' ').trim();
  const next=displayBrand+'_'+(product||model||original);
  if(next!==original){if(!m.originalName)m.originalName=original;m.name=next}
  return m;
}
function compareBrands(a,b){return canonicalBrand(a).localeCompare(canonicalBrand(b),'ko')}
function orderBrandsAlphabetically(items){
 const groups=new Map();for(const m of items){if(!groups.has(m.cat))groups.set(m.cat,[]);groups.get(m.cat).push(m)}
 for(const list of groups.values())list.sort((a,b)=>compareBrands(a.brand,b.brand));
 const positions=new Map();return items.map(m=>{const i=positions.get(m.cat)||0;positions.set(m.cat,i+1);return groups.get(m.cat)[i]});
}
function brandOf(m){return canonicalBrand(m.brand)||'브랜드 미입력'}
function brandActive(){return true}
function brandScope(m){return !!query||(GROUPS[group].cats.includes(m.cat)&&(subcategory==='전체'||m.cat===subcategory))}
function seriesList(){return brandActive()&&brand!=='전체'?BRAND_SERIES[subcategory+'|'+brand]||null:null}
function seriesOf(m,list){return list.find(n=>String(m.name).includes(n))||'기타'}
function chipRow(label,key,current,entries){return `<span class="chip-label">${label}</span>`+entries.map(([n,c])=>`<button type="button" class="${current===n?'active':''}" data-${key}="${escapeHTML(n)}" aria-pressed="${current===n}">${escapeHTML(n)}<span class="chip-count">${c}</span></button>`).join('')}
function renderBrandChips(){
 const row=$('brandChips'),srow=$('seriesChips'),select=$('brandFilter');if(!select||!srow)return;
 if(row){row.hidden=true;row.innerHTML=''}
 const counts=new Map();for(const m of materials())if(brandScope(m))counts.set(brandOf(m),(counts.get(brandOf(m))||0)+1);
 const names=[...counts.keys()].sort((a,b)=>compareBrands(a,b));
 if(brand!=='전체'&&!counts.has(brand))brand='전체';
 select.innerHTML='<option value="전체">전체 브랜드</option>'+names.map(n=>`<option value="${escapeHTML(n)}">${escapeHTML(n)}</option>`).join('');select.value=brand;
 const sl=seriesList();if(!sl){series='전체';srow.hidden=true;srow.innerHTML='';return}
 const sc=new Map();for(const m of materials())if(brandScope(m)&&brandOf(m)===brand){const k=seriesOf(m,sl);sc.set(k,(sc.get(k)||0)+1)}
 const snames=[...sl,'기타'].filter(n=>sc.has(n));if(series!=='전체'&&!sc.has(series))series='전체';
 srow.hidden=false;srow.innerHTML=chipRow('SERIES','series',series,[['전체',snames.reduce((t,n)=>t+sc.get(n),0)],...snames.map(n=>[n,sc.get(n)])])
}
let catalogViewKey='',catalogViewOrder=[];
function firstDimensionMm(spec){const match=String(spec||'').replace(/,/g,'').match(/(\d+(?:\.\d+)?)\s*(?:mm)?\s*[×xX*]/);const value=Number(match?.[1]);return Number.isFinite(value)&&value>0?value:null}
const TOILET_IMAGE_METRICS=[
  ['LC-2200',.75,0,.0575],['LC-2100',.75,-.0005,.0575],['LC-3200',.75,-.0005,.0575],['LC-3100',.75,-.0005,.0575],
  ["CC-733",0.851,-0.003554,-0.005050,true],["CC-735",0.842,-0.000246,-0.019117,true],["아르노 라운드",0.823,-0.002740,0.001234,true],["아르노 스퀘어",0.827,0.003586,0.000771,true],
  ["CC-282",0.804,0.001185,0.006109,true],["CC-283",0.809,-0.000928,0.009049,true],["CC-214",0.693,-0.000951,0.084430,true],["SMARTLET 660N",0.723,0.000728,0.053839,true],
  ["SMARTLET 4500",0.63,0.027357,0.111151,true],["SMARTLET 550",0.638,0.005994,0.121571,true],["WAVE S 2PC",0.6383333333333333,0.006065,-0.056017,true],["WAVE R 2PC",0.6383333333333333,0.00797,-0.053425,true],
  ["SIGNATURE 2PC",0.7171428571428572,-0.02721,-0.057217,true],["WAVE S 1PC",0.642,-0.000509,-0.0584,true],["WAVE R 1PC",0.624,-0.005918,-0.051542,true],["CHOICE 1PC",0.6383333333333333,-0.008508,-0.044298,true],
  ["PLAT G",0.6085714285714285,-0.000209,-0.085225,true],["PLAT C",0.5785714285714286,-0.008614,-0.077419,true]
];
function dimensionsMm(spec){const clean=String(spec||'').replace(/,/g,''),numbers=(clean.match(/\d+(?:\.\d+)?/g)||[]).map(Number),pick=label=>Number(clean.match(new RegExp('(?:^|[×xX*]\\s*)'+label+'\\s*(\\d+(?:\\.\\d+)?)','i'))?.[1])||null;return {length:pick('L')||pick('D')||numbers[0]||null,width:pick('W')||numbers[1]||null,height:pick('H')||numbers[2]||null}}
function toiletImageMetric(m){const text=[m?.name,m?.model].join(' '),row=TOILET_IMAGE_METRICS.find(([key])=>text.includes(key));return row?{bboxH:row[1],centerX:row[2],centerY:row[3],currentBounds:row[4]===true}:null}
// Version-specific PNG bounds and visible mixer-body datum, measured without changing PNGs.
const SHOWER_CARD_METRICS = [{"image":"03c7fb2390520a72fef03ec3b1711df38f5cfca55f3e6d487537298913339dd3","width":0.3225,"height":0.86,"x":0,"y":0,"kind":"rain"},{"image": "33ec87ed56da3bee16b6ae3bb8cbf2f8d8b95ece97df44bebd0168cacf3c6b37", "width": 0.6355661881977671, "height": 0.8532695374800638, "x": 0.016347687400319, "y": 0.0031897926634768536, "kind": "mixer", "body": 0.405, "axis": 0.455, "officialMm": 242, "referenceSpan": 0.405}, {"image": "a3c59316b33f841f7227a56ee198648e79f866436d182272009b349804efc171", "width": 0.6921850079744817, "height": 0.8078149920255183, "x": -0.023125996810207328, "y": -0.006778309409888383, "kind": "mixer", "body": 0.4875, "axis": 0.39, "officialMm": 255, "referenceSpan": 0.4875}, {"image": "23b04ca53162dccffd6da9efe4ff58b18de8013d9116c3b8d59384a583eef784", "width": 0.7025518341307815, "height": 0.8213716108452951, "x": -0.02432216905901119, "y": -0.009569377990430616, "kind": "mixer", "body": 0.495, "axis": 0.38, "officialMm": 254, "referenceSpan": 0.495}, {"image": "d1043138832e3fe98bbce997a36ca2e780078547a56c3127ca808a461b6ed12c", "width": 0.6650717703349283, "height": 0.879585326953748, "x": -0.006379585326953763, "y": -0.0003987240829346206, "kind": "mixer", "body": 0.435, "axis": 0.4275, "officialMm": 266, "referenceSpan": 0.435}, {"image": "df7136aa0c8e005a07d91d60a352d84b22a52e616a0ada4b6fa12be6b472c267", "width": 0.740829346092504, "height": 0.9202551834130781, "x": -0.006778309409888383, "y": 0.0015948963317384823, "kind": "mixer", "body": 0.5, "axis": 0.425, "officialMm": 150, "referenceSpan": 0.385}, {"image": "65483d6e63ab5722d52713fd4bbf713ff9c07d61c32443827ccd8c13d5ce731c", "width": 0.6738437001594896, "height": 0.84688995215311, "x": -0.0019936204146730474, "y": 0.00877192982456143, "kind": "mixer", "body": 0.475, "axis": 0.4075, "officialMm": 272, "referenceSpan": 0.475}, {"image": "f43da7fc9a8f7a3e24c3e31c174a6f33ce1557c428f4db73f8f91f9c3a77e710", "width": 0.7081339712918661, "height": 0.9003189792663477, "x": -0.00797448165869219, "y": -0.009968102073365237, "kind": "mixer", "body": 0.495, "axis": 0.425, "officialMm": 272, "referenceSpan": 0.495}, {"image": "3ee1cb00459502fa3a0b84f1a7fe8a939067df664641ac905f56c82e6ae03d10", "width": 0.6738437001594896, "height": 0.9059011164274322, "x": 0.0035885167464114742, "y": 0.006379585326953707, "kind": "mixer", "body": 0.4225, "axis": 0.46}, {"image": "207845e0b45e14e1e329e10ec3b8ec6028709d162f3b3693d6fc7132ce035f5b", "width": 0.6578947368421053, "height": 0.8668261562998405, "x": 0.009968102073365182, "y": -0.009968102073365237, "kind": "mixer", "body": 0.3825, "axis": 0.415}, {"image": "1d7ecdca95a23dc6ce5a192fa54ccde87bca1c8410ef408e148f14346276a95d", "width": 0.6953748006379585, "height": 0.7926634768740032, "x": -0.025518341307814996, "y": 0.010366826156299802, "kind": "mixer", "body": 0.45, "axis": 0.3925}, {"image": "429a28fe92512072fcaafbfa56d3f1d63174e578b508bae5238ebaf55b074515", "width": 0.4864433811802233, "height": 0.8971291866028708, "x": 0.011961722488038284, "y": 0.006778309409888328, "kind": "mixer", "body": 0.475, "axis": 0.46}, {"image": "bb1b038cccace01230e48bb7eeb6a4c78890ae4d384c8a73c6922fbde52011d8", "width": 0.3963317384370016, "height": 0.9234449760765551, "x": -0.009968102073365237, "y": 0.0031897926634768536, "kind": "rain"}, {"image": "fee50a1d6a87aee64f23a459895c55e794dba950750156ff58340aa18b6749a7", "width": 0.19696969696969696, "height": 0.9362041467304625, "x": 0.006778309409888328, "y": 0.0, "kind": "rain"}, {"image": "bb4f7e7e0f0037be72e6396198fac894c9af536ddf2a4ca981533c314782343e", "width": 0.8086124401913876, "height": 0.9633173843700159, "x": -0.009569377990430616, "y": 0.003987240829346095, "kind": "concealed"}, {"image": "138dadf4d571c625c6459c56074e8015172082220f831915c84de89f24924cdc", "width": 0.4920255183413078, "height": 0.9712918660287081, "x": -0.014752791068580517, "y": 0.0, "kind": "rain"}, {"image": "b3744a29276aa33d9391ede440c7330c423f136b7c19b6f21d3e2349f23bf4e7", "width": 0.5342902711323764, "height": 0.9736842105263158, "x": -0.015151515151515138, "y": 0.0003987240829346206, "kind": "concealed"}, {"image": "f26a9f5d-77c3-478e-ab3d-d843ae3e0242-front32-v20261105?v=legacy-20261112", "width": 0.193359375, "height": 0.78125, "x": 0.0, "y": 0.0, "kind": "rain"}, {"image": "yuhiha-userpng-8a3a5b042211dc977d7b-centerpng-v20261105?v=legacy-20261112", "width": 0.525390625, "height": 0.78125, "x": 0.0, "y": 0.0, "kind": "mixer", "body": 0.3, "axis": 0.4575}, {"image": "yuhiha-userpng-d2a8d3a628fc68732947-centerpng-v20261105?v=legacy-20261112", "width": 0.587890625, "height": 0.78125, "x": 0.0, "y": 0.0, "kind": "mixer", "body": 0.405, "axis": 0.375}, {"image": "bath-source-100724-approved-mirror?v=legacy-20261112", "width": 0.3447265625, "height": 0.7724609375, "x": 0.00341796875, "y": 0.00244140625, "kind": "concealed"}, {"image": "bath-source-100726-approved-mirror?v=legacy-20261112", "width": 0.30859375, "height": 0.8017578125, "x": 0.0009765625, "y": -0.00048828125, "kind": "rain"}, {"image": "yuhiha-userpng-6e95c9fe5037ded72fff-centerpng-v20261105?v=legacy-20261112", "width": 0.640625, "height": 0.78125, "x": 0.0, "y": 0.0, "kind": "mixer", "body": 0.405, "axis": 0.44}, {"image": "bath-source-1766538698-hose?v=legacy-20261112", "width": 0.21484375, "height": 0.8095703125, "x": 0.001953125, "y": 0.00146484375, "kind": "concealed"}, {"image": "bath-source-1713148071-hose?v=legacy-20261112", "width": 0.3310546875, "height": 0.7880859375, "x": -0.02685546875, "y": -0.00048828125, "kind": "concealed"}, {"image": "bath-source-1713146351-approved-mirror?v=legacy-20261112", "width": 0.4765625, "height": 0.8623046875, "x": -0.0537109375, "y": 0.01513671875, "kind": "rain"}, {"image": "02f61745-0871-4254-9199-763b85e6172f-centerpng-v20261105?v=legacy-20261112", "width": 0.6669921875, "height": 0.78125, "x": -0.00048828125, "y": 0.0, "kind": "mixer", "body": 0.5, "axis": 0.445}, {"image": "d4ba3c25d159eb1a119e781044294aa9b87fddeeefd7a4b6f2948ee4ffefc26c", "width": 0.48625, "height": 0.86, "x": 0, "y": 0, "kind": "rain"}, {"image": "9e592e27195506d4ea6179b1b205fbbf0c273cb6e194fbcf59c654a3e2bc57f5", "width": 0.4, "height": 0.86, "x": 0, "y": 0, "kind": "rain"}];
function showerCardLayout(m){
  const row=SHOWER_CARD_METRICS.find(r=>String(m.image||'').endsWith(r.image));
  if(!row)return {scale:.88,x:'0%',y:'0%'};
  if(row.kind==='mixer'){
    // One visible body width and one body centreline; preserve each product's proportions.
    const axis=.46,pad=.025;
    const targetBody=Math.min(.43,...SHOWER_CARD_METRICS.filter(r=>r.kind==='mixer').map(r=>{
      const top=r.y+.5-r.height/2,bottom=r.y+.5+r.height/2;
      return Math.min((axis-pad)*r.body/(r.axis-top),(1-pad-axis)*r.body/(bottom-r.axis),1.13*(1-2*pad)*r.body/r.width);
    }));
    // Calibrate AS wall mixers to one drawing-based px/mm ratio. Keep other brands unchanged.
    // Rain/concealed sets retain their separate installation framing.
    const physicalUnit=Math.min(targetBody/255,...SHOWER_CARD_METRICS.filter(r=>r.officialMm).map(r=>{
      const top=r.y+.5-r.height/2,bottom=r.y+.5+r.height/2;
      return Math.min((axis-pad)/(r.axis-top),(1-pad-axis)/(bottom-r.axis),1.13*(1-2*pad)/r.width)*r.referenceSpan/r.officialMm;
    }));
    const scale=row.officialMm?physicalUnit*row.officialMm/row.referenceSpan:targetBody/row.body;
    return {scale,x:`${-row.x*100/1.13}%`,y:`${((axis-.5)/scale-(row.axis-.5))*100}%`};
  }
  // Tall rain sets and concealed controls use their own whole-assembly frame.
  const scale=(row.kind==='rain'?.92:.86)/Math.max(row.width,row.height);
  return {scale,x:`${-row.x*100/1.13}%`,y:`${-row.y*100}%`};
}
// Approved washbasin PNG alpha bounds (alpha > 15), keyed by image version.
const BASIN_IMAGE_METRICS = [{"hash":"426e028cfc112b1a7fbbefba5ecd75b1b891c405d0ebbd4d5c5bf53a07093ba1","width":0.8015625,"height":0.65234375,"x":0,"y":-0.0003906249999999778},{"hash":"e6ab3da0f1686fcc0f33e59cf70eeacf11c047e9c27527429028bedb4e00bb7d","width":0.803125,"height":0.63359375,"x":0,"y":-0.0003906249999999778},{"hash":"483b9f9489437f73c26d73a130e794c82a43472db7caf5fc62181f23ce470e73","width":0.80234375,"height":0.63125,"x":0.0003906249999999778,"y":0},{"hash":"d49269f21455e37e6c68d428b85a5195c6de92171e46635e53f73946defb11fb","width":0.803125,"height":0.64453125,"x":0,"y":-0.0003906249999999778},{"hash":"064a7a473671b0415a471c0590c5a9335756b35017cb10dedb2d510d6f959829","width":0.638755980861244,"height":0.6363636363636364,"x":0.001993620414672992,"y":0.052631578947368474},{"hash":"11eb09b1a6c0051b759edd46f57dac9ca09bf6e3369dd4545251daa8c6ee3d8a","width":0.8532695374800638,"height":0.4154704944178628,"x":0.0007974481658692412,"y":-0.028309409888357284},{"hash":"e717b8ac354b10720539f2c611a3654db2ccc5ca3e57eba171f24158ba21cb78","width":0.8125996810207337,"height":0.46730462519936206,"x":-0.0003987240829346206,"y":-0.03668261562998404},{"hash":"468b99b975faeb7d54d8c61e50411d3d9ea75940d3d13868ef93a62a65171be7","width":0.7878787878787878,"height":0.7838915470494418,"x":-0.0015948963317384268,"y":0.0003987240829346206},{"hash":"747326801c01a94b28eae5924cdcf33026f683d0609692f1afd37311731b0d7e","width":0.835725677830941,"height":0.42822966507177035,"x":0,"y":-0.04425837320574161},{"hash":"660874333bc2afbaae7aff28a496e4bde655b71b30683afdb2768e7c650f8ea9","width":0.6236044657097288,"height":0.7177033492822966,"x":0,"y":0.037480063795853225},{"hash":"b682ef6965effe989c154a6f069f34113f6bab375c2a1265837195194c7b366b","width":0.803125,"height":0.3703125,"x":0,"y":0},{"hash":"0255b094a37a2b0f252780595cb40c51aea885fad91dd19b930639f5271f6f9f","width":0.8015625,"height":0.6796875,"x":0,"y":0},{"hash":"1bde58af274d6b3a6dcfdbce8f16aa6753af96306b387476609aaa7697302008","width":0.8015625,"height":0.6421875,"x":0,"y":0}];
function bathroomDimensions(m){
 if(!['변기','세면대'].includes(m.cat))return null;
 const raw=String(m.spec||'').split('·')[0].replace(/,/g,''),n=(raw.match(/\d+(?:\.\d+)?/g)||[]).map(Number);
 if(n.length!==3)return null;
 const axis=k=>Number(raw.match(new RegExp('\\b'+k+'\\s*(\\d+(?:\\.\\d+)?)','i'))?.[1])||null;
 let width=axis('W'),depth=axis('D'),height=axis('H')||n[2];
 // Acacia Supasleek uses L for its lateral span; Flat uses W.
 if(m.cat==='세면대'&&/아카시아|CCASF[- ]?421/i.test([m.name,m.model].join(' '))&&axis('L')&&!depth){width=axis('L');depth=axis('W');}
 else if(width){depth=depth||axis('L')||n.find((v,i)=>i<2&&v!==width)||n[1];}
 else if(m.cat==='변기'){width=n[1];depth=depth||axis('L')||n[0];}
 else {width=axis('L')||n[0];depth=depth||n[1];}
 return width&&depth&&height?{width,depth,height}:null;
}
function bathroomSpec(m){
 const d=bathroomDimensions(m);if(!d)return m.spec||'';
 const extra=String(m.spec).split('·').slice(1).map(s=>s.trim()).filter(Boolean);
 return `W ${d.width} × D ${d.depth} × H ${d.height} mm`+(extra.length?' · '+extra.join(' · '):'');
}
function basinCardLayout(m){
 const row=BASIN_IMAGE_METRICS.find(row=>String(m.image).includes(row.hash)),d=bathroomDimensions(m);
 if(!row||!d)return null;
 const cohort=materials().filter(item=>item.cat==='세면대').map(item=>({d:bathroomDimensions(item),row:BASIN_IMAGE_METRICS.find(row=>String(item.image).includes(row.hash))})).filter(item=>item.row&&item.d);
 const pixelsPerMm=Math.min(.78/Math.max(...cohort.map(item=>item.d.width)),.795/Math.max(...cohort.map(item=>item.d.width*item.row.height/item.row.width)));
 return {scale:pixelsPerMm*d.width/row.width,x:`${-row.x*100}%`,y:`${-row.y*100}%`,imageStyle:'position:absolute;inset:auto;left:50%;top:50%;width:100%;height:auto;max-width:none;max-height:none;object-fit:contain;transform:translate(-50%,-50%) scale(var(--physical-scale,1)) translate(var(--physical-x,0%),var(--physical-y,0%))'};
}
// Holder images share one mm scale, measured from visible product pixels, not canvas margins.
// Image keys are immutable, so measured bounds are kept across visits (stored server images only).
const BOUNDS_STORE='yuhiha-image-bounds-v1';
const BOUNDS_IMAGE_PATH=['','api','image',''].join('/');
function boundsStoreKey(src){const s=String(src||'');const i=s.indexOf(BOUNDS_IMAGE_PATH);return i<0?'':s.slice(i)}
function boundsStoreRead(kind,src){const key=boundsStoreKey(src);if(!key)return undefined;try{const all=JSON.parse(localStorage.getItem(BOUNDS_STORE)||'{}');return all[kind+'|'+key]}catch{return undefined}}
function boundsStoreWrite(kind,src,value){const key=boundsStoreKey(src);if(!key)return;try{const all=JSON.parse(localStorage.getItem(BOUNDS_STORE)||'{}');all[kind+'|'+key]=value;localStorage.setItem(BOUNDS_STORE,JSON.stringify(all))}catch{}}
const holderBoundsCache=new Map();
async function holderImageBounds(src){
 if(holderBoundsCache.has(src))return holderBoundsCache.get(src);
 const stored=boundsStoreRead('holder',src);if(stored&&stored.width){holderBoundsCache.set(src,Promise.resolve(stored));return stored;}
 // Scan a reduced copy: bounds only need ~0.2% precision, full-size scans froze the page.
 const task=(async()=>{const img=await imageOf(src),ratio=Math.min(1,500/Math.max(img.naturalWidth,img.naturalHeight)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.naturalWidth*ratio));c.height=Math.max(1,Math.round(img.naturalHeight*ratio));
 const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,c.width,c.height);const data=ctx.getImageData(0,0,c.width,c.height).data;
 const rows=new Uint32Array(c.height),cols=new Uint32Array(c.width);
 for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(data[(y*c.width+x)*4+3]>=128){rows[y]++;cols[x]++;}
 // Isolated edge speckles must not determine the product's apparent size or center.
 const xs=Array.from(cols,(n,i)=>n>=Math.max(2,c.height*.005)?i:-1).filter(i=>i>=0),ys=Array.from(rows,(n,i)=>n>=Math.max(2,c.width*.005)?i:-1).filter(i=>i>=0);
 if(!xs.length||!ys.length)throw Error('제품 영역을 확인할 수 없습니다.');
 const left=xs[0],right=xs[xs.length-1]+1,top=ys[0],bottom=ys[ys.length-1]+1;
 const sx=img.naturalWidth/c.width,sy=img.naturalHeight/c.height;
 const result={width:(right-left)*sx,height:(bottom-top)*sy,cx:(left+right)/2*sx,cy:(top+bottom)/2*sy,nw:img.naturalWidth,nh:img.naturalHeight};boundsStoreWrite('holder',src,result);return result;})();
 holderBoundsCache.set(src,task);try{return await task}catch(e){holderBoundsCache.delete(src);throw e;}
}
async function holderScaleCohort(){
 return (await Promise.all(materials().filter(m=>m.cat==='휴지걸이').map(async m=>{
 const width=Number(holderCardSize(m).match(/^W\s*([\d.]+)/)?.[1]);if(!width)return null;
 try{return {id:m.id,width,bounds:await holderImageBounds(m.image)}}catch{return null;}
 }))).filter(Boolean);
}
function positionHolderImage(img,row,cohort){
 const frame=img.parentElement;if(!img.isConnected||!frame.clientWidth||!frame.clientHeight)return;
 const unit=.80*Math.min(frame.clientWidth/Math.max(...cohort.map(r=>r.width)),frame.clientHeight/Math.max(...cohort.map(r=>r.width*r.bounds.height/r.bounds.width)));
 const b=row.bounds,k=unit*row.width/b.width;
 Object.assign(img.style,{position:'absolute',inset:'auto',left:'50%',top:'50%',width:(b.nw*k)+'px',height:(b.nh*k)+'px',maxWidth:'none',maxHeight:'none',objectFit:'contain',transform:`translate(${-b.cx/b.nw*100}%,${-b.cy/b.nh*100}%)`,translate:'none'});
 img.dataset.holderScale='true';img.dataset.pixelsPerMm=unit.toFixed(6);
}
let holderCatalogObserver=null;
async function alignHolderCatalog(){
 holderCatalogObserver?.disconnect();const cohort=await holderScaleCohort();if(!cohort.length)return;
 const entries=[];document.querySelectorAll('#catalog .material-image[data-detail]').forEach(frame=>{
 const row=cohort.find(r=>r.id===frame.dataset.detail),img=frame.querySelector('img');if(!row||!img)return;
 entries.push({frame,img,row});img.dataset.holderScale='true';img.addEventListener('load',()=>positionHolderImage(img,row,cohort));positionHolderImage(img,row,cohort);
 });
 if(typeof ResizeObserver!=='undefined'){holderCatalogObserver=new ResizeObserver(()=>entries.forEach(({img,row})=>positionHolderImage(img,row,cohort)));entries.forEach(({frame})=>holderCatalogObserver.observe(frame));}
}
// Width represented by the approved hood PNG, not the hidden installation body.
const HOOD_VISIBLE_WIDTHS={'RGM350-06PAA':518,'GRUPPO INCASSO PLUS 90':771,'LEVEL INVISIBLE 90':769,'BUILT-IN MAX':771,'STELLA PLUS 90':973,'IB90S-HZ':899,'IB60S':598,'ERA C 600':535,'ERA C 800':735};
// Approved presentation scale: comparable occupancy, compressed real-size differences.
// This deliberately is not a common px/mm scale across products.
function kitchenDisplayDimension(m){
 if(m.cat==='후드')return HOOD_VISIBLE_WIDTHS[m.model]||0;
 const axis=m.cat==='싱크볼'?'W':'H';
 return Number(String(m.spec||'').match(new RegExp('\\b'+axis+'\\s*(\\d+(?:\\.\\d+)?)','i'))?.[1])||0;
}
function kitchenDisplayOccupancy(size,reference){
 return Math.max(.68,Math.min(.78,.73*Math.pow((size||reference)/reference,.22)));
}
function positionKitchenImage(img,row){
 const frame=img.parentElement;if(!img.isConnected||!frame.clientWidth||!frame.clientHeight)return;
 const b=row.bounds,k=row.occupancy*Math.min(frame.clientWidth/b.width,frame.clientHeight/b.height);
 Object.assign(img.style,{position:'absolute',inset:'auto',left:'50%',top:'50%',width:(b.nw*k)+'px',height:(b.nh*k)+'px',maxWidth:'none',maxHeight:'none',objectFit:'contain',transform:`translate(${-b.cx/b.nw*100}%,${-b.cy/b.nh*100}%)`,translate:'none'});
 img.dataset.kitchenScale='balanced';img.dataset.visibleOccupancy=row.occupancy.toFixed(6);
 img.dataset.visibleWidth=(b.width*k).toFixed(3);img.dataset.visibleHeight=(b.height*k).toFixed(3);
}
let kitchenCatalogObserver=null,kitchenLayoutVersion=0;
async function alignKitchenCatalog(){
 const version=++kitchenLayoutVersion;kitchenCatalogObserver?.disconnect();
 const products=materials().filter(m=>['싱크볼','싱크수전','후드'].includes(m.cat));
 const references={};for(const cat of ['싱크볼','싱크수전','후드']){
  const sizes=products.filter(m=>m.cat===cat).map(kitchenDisplayDimension).filter(Boolean).sort((a,b)=>a-b);
  references[cat]=sizes.length?sizes[Math.floor(sizes.length/2)]:1;
 }
 const entries=[];document.querySelectorAll('#catalog .material-image[data-detail]').forEach(frame=>{
  const m=products.find(m=>m.id===frame.dataset.detail),img=frame.querySelector('img');if(!m||!img)return;
  img.dataset.holderScale='true';
  const row={occupancy:kitchenDisplayOccupancy(kitchenDisplayDimension(m),references[m.cat])};
  const place=async()=>{const src=img.currentSrc||img.src;try{const bounds=await holderImageBounds(src);if(version!==kitchenLayoutVersion||!img.isConnected||src!==(img.currentSrc||img.src))return;row.bounds=bounds;positionKitchenImage(img,row)}catch{}};
  entries.push({frame,img,row});img.addEventListener('load',place);place();
 });
 if(typeof ResizeObserver!=='undefined'){kitchenCatalogObserver=new ResizeObserver(()=>entries.forEach(({img,row})=>{if(row.bounds)positionKitchenImage(img,row)}));entries.forEach(({frame})=>kitchenCatalogObserver.observe(frame))}
}
let holderDetailObserver=null;
async function alignHolderDetail(m){
 holderDetailObserver?.disconnect();if(m.cat!=='휴지걸이')return;
 const img=$('detailContent').querySelector('.detail-image');if(!img)return;
 const height=img.getBoundingClientRect().height||300,frame=document.createElement('div');
 Object.assign(frame.style,{position:'relative',height:height+'px',overflow:'hidden',background:getComputedStyle(img).backgroundColor,marginBottom:getComputedStyle(img).marginBottom});
 img.before(frame);frame.append(img);img.dataset.holderScale='true';
 const cohort=await holderScaleCohort(),row=cohort.find(r=>r.id===m.id);if(!row||!img.isConnected)return;
 const place=()=>positionHolderImage(img,row,cohort);img.addEventListener('load',place);place();
 if(typeof ResizeObserver!=='undefined'){holderDetailObserver=new ResizeObserver(place);holderDetailObserver.observe(frame);}
}

// Approved sink alpha bounds: use one width-based physical scale, never texture cover.
const SINK_IMAGE_METRICS = [{"hash":"167a2fec84ce952bb5ccf3cbbdab01f5da31ae5f468a58385d014a554477814a","width":0.8359639233370914,"height":0.4346110484780158,"x":-0.0002818489289740933,"y":-0.0011273957158962622},{"hash":"3fe6ff87d98819930c3ac474700c5c78eefadf3bee7680f0d6bc0c6bc0399a6c","width":0.9143179255918827,"height":0.39627959413754227,"x":-0.0005636978579481311,"y":0.0},{"hash":"85f4895d829045b71d3f8fea98b7ce2e77adb4f609c4118872d48d2da90740a1","width":0.8613303269447576,"height":0.40529875986471253,"x":0.0,"y":0.0},{"hash":"9fa07a71794edd80fba5ce526226e4504739c665ab311384de111ddccd04cec6","width":0.9244644870349493,"height":0.4092446448703495,"x":0.0,"y":-0.0005636978579481311},{"hash":"b9f3a3deb1902172048e77b8d970237eb90f632ffa963420be741da6677f59ba","width":0.9289740698985344,"height":0.41431792559188274,"x":0.0,"y":0.0},{"hash":"3cd0e40ef599b7ae706b18f36d9d1e9933efde8b8aea6a49313a5bece326310d","width":0.8765501691093573,"height":0.4560315670800451,"x":-0.0008455467869222244,"y":-0.0011273957158962622}];
function sinkCardLayout(m){
 const metric=item=>SINK_IMAGE_METRICS.find(r=>String(item.image).includes(r.hash));
 const width=item=>Number(String(item.spec||'').match(/\bW\s*(\d+(?:\.\d+)?)/i)?.[1]);
 const row=metric(m),w=width(m);if(!row||!w)return null;
 const cohort=materials().filter(item=>item.cat==='싱크볼').map(item=>({row:metric(item),w:width(item)})).filter(item=>item.row&&item.w);
 const unit=Math.min(.80/Math.max(...cohort.map(item=>item.w)),(.80/1.13)/Math.max(...cohort.map(item=>item.w*item.row.height/item.row.width)));
 return {scale:unit*w/row.width,x:`${-row.x*100}%`,y:`${-row.y*100}%`,imageStyle:'position:absolute;inset:auto;left:50%;top:50%;width:100%;height:auto;max-width:none;max-height:none;object-fit:contain;transform:translate(-50%,-50%) scale(var(--physical-scale,1)) translate(var(--physical-x,0%),var(--physical-y,0%))'};
}

function materialCardLayout(m){
  if(['싱크볼','싱크수전','후드'].includes(m?.cat))return null;
  if(m?.cat==='슬라이드바'){
    return {scale:.92,x:'0%',y:'0%'};
  }
  if(m?.cat==='샤워수전')return showerCardLayout(m);
  if(m?.cat==='변기'){
    const metric=toiletImageMetric(m),height=dimensionsMm(m.spec).height,reference=Math.max(...materials().filter(item=>item.cat==='변기').map(item=>dimensionsMm(item.spec).height).filter(Boolean));
    if(metric&&height&&reference){const scale=.795*(height/reference)/metric.bboxH;const centerY=metric.currentBounds?metric.centerY+.0575/scale:metric.centerY;return {scale,x:`${(-metric.centerX*100).toFixed(3)}%`,y:`${(-centerY*100).toFixed(3)}%`};}
  }
  if(m?.cat==='세면대'){
    const calibrated=basinCardLayout(m);if(calibrated)return calibrated;
    const dimension=firstDimensionMm(m.spec),reference=Math.max(510,...materials().filter(item=>item.cat==='세면대').map(item=>firstDimensionMm(item.spec)).filter(Boolean));
    if(dimension)return {scale:Math.max(.65,Math.min(1,dimension/reference)),x:'0%',y:'0%'};
  }
  return null;
}
const ACCESSORY_FINISH_DATA=[{"name": "JN 화이트 수건걸이", "category": "수건걸이", "model": "JN 화이트 수건걸이", "image_color": "화이트", "sales_colors": ["화이트"], "card_color": "화이트", "spec": "W600 × D66 mm", "source_url": "", "note": "사용자 제공 판매 상세자료: https://store.ohou.se/goods/3542867 · 제조사 개별 공식주소 미확인"},{"name": "JN 화이트 휴지걸이", "category": "휴지걸이", "model": "JN 화이트 휴지걸이", "image_color": "화이트", "sales_colors": ["화이트"], "card_color": "화이트", "spec": "W160 × D100 × H70 mm", "source_url": "", "note": "사용자 제공 판매 상세자료: https://store.ohou.se/goods/3542867 · 제조사 개별 공식주소 미확인"},{"name": "수건걸이 TC04A", "category": "수건걸이", "model": "TC04A(MS)", "image_color": "메트실버(MS)", "sales_colors": ["크롬(CR)", "메트실버(MS)", "샴페인골드(CG)", "화이트(WH)", "메트그레이(MG)", "로얄블랙(RB)"], "spec": "570(W) × 74.5(D) × 76.5(H) mm", "source": "https://trandgroup.com/product/tc04ams/1114/", "note": "저장된 공식자료에서 확인된 마감. 현재 재고 여부는 별도 확인.", "card_color": "메트실버(MS) · 판매 마감 6종"}, {"name": "플랫 수건걸이 FH1051", "category": "수건걸이", "model": "FH1051-0KAK460AH", "image_color": "사틴 헤어라인", "sales_colors": ["사틴 헤어라인"], "spec": "600(W) × 52(D) × 25(H) mm", "source": "https://www.americanstandard.co.kr/main/product.do?proc_type=view&v_cate1=7&v_cate2=34&v_product=348", "note": "저장된 공식자료에서 확인된 마감. 현재 재고 여부는 별도 확인.", "card_color": "사틴 헤어라인"}, {"name": "수건걸이 ESS-100", "category": "수건걸이", "model": "ESS-100", "image_color": "니켈", "sales_colors": ["니켈"], "spec": "640(W) × 65.5(D) × 49.5(H) mm", "source": "https://www.eterno.zone/shop_view/?idx=182", "note": "저장된 공식자료에서 확인된 마감. 현재 재고 여부는 별도 확인.", "card_color": "니켈"}, {"name": "수건걸이 N01A", "category": "수건걸이", "model": "N01A(MS)", "image_color": "메트실버(MS)", "sales_colors": ["메트실버(MS)", "메트그레이(MG)"], "spec": "650(W) × 70(D) × 49.5(H) mm", "source": "https://trandgroup.com/product/n01ams/1142/", "note": "저장된 공식자료에서 확인된 마감. 현재 재고 여부는 별도 확인.", "card_color": "메트실버(MS) · 메트그레이(MG)"}, {"name": "2단 수건선반 N01AA", "category": "수건걸이", "model": "N01AA(MS)", "image_color": "메트실버(MS)", "sales_colors": ["메트실버(MS)", "메트그레이(MG)"], "spec": "610(W) × 191(D) × 127(H) mm", "source": "https://trandgroup.com/product/n01aams/1128/", "note": "저장된 공식자료에서 확인된 마감. 현재 재고 여부는 별도 확인.", "card_color": "메트실버(MS) · 메트그레이(MG)"}, {"name": "수건걸이 N02A", "category": "수건걸이", "model": "N02A(MS)", "image_color": "메트실버(MS)", "sales_colors": ["메트실버(MS)", "메트그레이(MG)"], "spec": "570(W) × 65(D) × 19(H) mm", "source": "https://trandgroup.com/product/n02ams/1082/", "note": "저장된 공식자료에서 확인된 마감. 현재 재고 여부는 별도 확인.", "card_color": "메트실버(MS) · 메트그레이(MG)"}, {"name": "매립형 휴지걸이 · 휴대폰 거치 FH1048", "category": "휴지걸이", "model": "FH1048-0KAK500AJ", "image_color": "사틴 헤어라인", "sales_colors": ["사틴 헤어라인"], "spec": "전면 폭 230.2 × 높이 302.8 mm. 측면 치수 43.8 / 104.8 / 10.5 / 77 mm는 도면 기준점 참조.", "source": "https://www.americanstandard.co.kr/main/product.do?proc_type=view&v_product=600&v_cate1=7&v_cate2=35", "note": "사틴 헤어라인 확인. FH1048-0GAK500AJ/ZJ도 공식 카탈로그에 있으나 마감명 미표기로 추가 색상 확정 보류. 공식 페이지 첨부 도면 표제는 FH1048-0GAK500ZJ로 사틴 품번과 다름. 공용도면 여부 미확인. 매립박스 M1BH56.", "card_color": "사틴 헤어라인"}, {"name": "2단 수건선반 ROUND FH1017", "category": "수건걸이", "model": "FH1017-0KAK400AY", "image_color": "사틴 헤어라인", "sales_colors": ["사틴 헤어라인"], "spec": "폭 520 × 도면 깊이 202 × 높이 110 mm. 좌우 중심 간격 500 mm. 봉 Ø10.2 / Ø20.", "source": "https://www.americanstandard.co.kr/main/product.do?proc_type=view&v_product=353&v_cate1=7&v_cate2=36", "note": "사틴 헤어라인 확인. 이 모델의 다른 마감 미확인. FH1013·FH1014 색상과 구분. 깊이 202는 도면에 표시된 기준점 사이 치수. 전체 돌출과 혼동하지 않음.", "card_color": "사틴 헤어라인"}, {"name": "가변형 수건걸이 FH1018", "category": "수건걸이", "model": "FH1018-0KAK400AZ", "image_color": "사틴 헤어라인", "sales_colors": ["사틴 헤어라인", "크롬"], "spec": "길이 630 mm; 봉 Ø22; 벽받침 Ø58; 고정부 Ø34; 측면 깊이 69.5 mm; 설치 간격 ~595 mm.", "source": "https://www.americanstandard.co.kr/main/product.do?proc_type=view&v_product=426&v_cate1=7&v_cate2=36", "note": "사틴 헤어라인 FH1018-0KAK400AZ · 크롬 FH1018-0GAK400AZ (2024 공식 카탈로그). 현재 재고·판매 지속 여부는 별도 미확인. ~595는 도면 표기 그대로. 최소 설치 간격 명시 없음.", "card_color": "사틴 헤어라인 · 크롬"}, {"name": "매립형 휴지걸이 EBA-908A", "category": "휴지걸이", "model": "EBA-908A", "image_color": "니켈", "sales_colors": ["니켈"], "spec": "173 × 186 mm (판매처 표기)", "source": "https://bathday.com/product/detail.html?product_no=1338", "note": "판매처 자료. 제조사 공식성 미확인", "card_color": "니켈 (판매처 표기)"}, {"name": "비반트 TC04B 휴지걸이", "category": "휴지걸이", "model": "TC04B MS", "image_color": "메트실버", "sales_colors": ["크롬(CR)", "메트실버(MS)", "샴페인골드(CG)", "화이트(WH)", "메트그레이(MG)", "CB (색상명 미확인)", "로얄블랙(RB)"], "spec": "150W × 95D mm, 도면 높이98 및 가동시140 표기", "source": "https://trandgroup.com/product/tc04bms/1121/", "note": "공식", "card_color": "메트실버 · 판매 마감 7종"}, {"name": "아메리칸스탠다드 액티브 FH1058 휴지걸이", "category": "휴지걸이", "model": "FH1058-0KAK450AW", "image_color": "사틴 헤어라인", "sales_colors": ["사틴 헤어라인"], "spec": "125W × 90D × 82H mm", "source": "https://www.americanstandard.co.kr/main/product.do?proc_type=view&v_product=349", "note": "공식", "card_color": "사틴 헤어라인"}, {"name": "에떼르노 ESH-100 휴지걸이", "category": "휴지걸이", "model": "ESH-100", "image_color": "니켈", "sales_colors": ["니켈", "다크 그레이"], "spec": "폭150, 도면 치수113.38 / 95 / 123.65mm 참조", "source": "https://www.eterno.zone/shop_view/?idx=181", "note": "공식", "card_color": "니켈 · 다크 그레이"}, {"name": "폰타나 TF-AC7100B 휴지걸이", "category": "휴지걸이", "model": "TF-AC7100B BN", "image_color": "브러쉬드 니켈", "sales_colors": [], "spec": "130W × 93D × 70H mm (기존 사이트값, 도면 미확보)", "source": "https://www.yungsong.co.kr/fontana_accessory02/?idx=170", "note": "공식 수입사 제품 이미지 확보. BN 색상·규격 추가 근거 대조 필요", "card_color": "이미지: 브러쉬드 니켈 · 판매색상 확인 중"}];
function accessoryFinish(m){
 if(!['수건걸이','휴지걸이'].includes(m.cat))return null;
 const key=v=>String(v||'').split('·')[0].trim().toUpperCase().replace(/[\s()]/g,'');
 return ACCESSORY_FINISH_DATA.filter(r=>r.category===m.cat).sort((a,b)=>b.model.length-a.model.length).find(r=>key(r.model)===key(m.model)||key(r.model).replace(/MS$/,'')===key(m.model).replace(/MS$/,''))||null;
}
function accessoryColorName(v){return String(v||'').replace(/\((?:MS|CR|CG|WH|MG|RB)\)/g,'').trim()}
function isMonSatinHolder(m){return m.cat==='휴지걸이'&&/몬세라믹/.test(m.brand+' '+m.name)&&/슬림.*사틴.*매립/.test(m.name+' '+m.model)}
// Dimensions in mm; official drawings or linked seller drawings. FH1048 depth = 43.8 + 104.8.
function holderCardSize(m){
 const key=String(m.model||'')+' '+String(m.name||'');
 let dims=isMonSatinHolder(m)?[170,85,185]:/JN.*화이트.*휴지걸이/.test(key)?[160,100,70]:/TC04B/.test(key)?[150,95,140]:/FH1058/.test(key)?[125,90,82]:/FH1048/.test(key)?[230.2,148.6,302.8]:/ESH-100/.test(key)?[150,123.65,113.38]:/TF-AC7100B/.test(key)?[130,93,70]:null;
 if(dims)return `W ${dims[0]} × D ${dims[1]} × H ${dims[2]}`;
 return dimensionLabelSpacing(m.spec||accessoryFinish(m)?.spec||'');
}
function dimensionLabelSpacing(value){return String(value).replace(/(\d+(?:\.\d+)?)\s*\(([WDLH])\)/g,'$2 $1').replace(/\b([WDLH])\s*(?=\d)/g,'$1 ').replace(/\s*×\s*/g,' × ');}
function holderDetailMarkup(m){
 const r=accessoryFinish(m),mon=isMonSatinHolder(m),names=mon?['사틴']:(r?.sales_colors||[]).filter(n=>!n.includes('미확인')).map(accessoryColorName);
 return `<dt style="align-self:start;line-height:36px;padding-top:4px">색상</dt><dd>${basinFaucetColorMarkup(m,names)}</dd>`+(names.length?'':`<dt>규격</dt><dd>${escapeHTML(holderCardSize(m))}</dd>`);
}
function formatVentDrainSpec(m){
 const raw=String(m.spec||'').trim();if(!raw||/^(규격|치수).*확인 중$/.test(raw))return '';
 if(m.cat==='환풍기'){const panel=raw.split('패널').pop(),w=panel.match(/(\d+(?:\.\d+)?)\s*\(W\)/),d=panel.match(/(\d+(?:\.\d+)?)\s*\(D\)/);if(w&&d)return integerDimensionText('W '+w[1]+' × D '+d[1]);}
 return integerDimensionText(raw.replace(/(\d+(?:\.\d+)?)\s*\(([WDLH])\)/g,'$2 $1').replace(/\b([WDLH])\s*(?=\d)/g,'$1 ').replace(/\s*[×xX]\s*(?=\d|[WDLH]\s*\d)/g,' × ').replace(/\s*\/\s*/g,' / ').replace(/\s*mm\b/g,'').replace(/[ØΦøφ]\s*(?=\d)/g,'Ø ').replace(/ +/g,' ').trim());
}
// Verified basin faucet dimensions, independent of finish selection.
const BASIN_FAUCET_DIMENSIONS=[{"brand":"대림바스","model":"DL-L4210LN","id":"80c0ab7f-e12f-4fef-964c-be329fe1fbdd","card":"D165 × H152 mm","detail":"본체 Ø42 / 깊이 165 × 높이 152 / 토수거리 123 (mm 기준)"},{"brand":"대림바스","model":"DL-L4310LN","id":"32c3a86c-1e80-4c7c-8ae6-eec5d8b13925","card":"D162 × H150 mm","detail":"본체 폭 36 · 받침 폭 45 / 깊이 162 × 높이 150 / 토수거리 125 (mm 기준)"},{"brand":"라우체","model":"2375","id":"bath-source-1684288489","card":"토수거리 200 mm","detail":"벽면→토수구 중심 200 / 토수각 10° (mm 기준)"},{"brand":"비반트","model":"S-VAR340 MS","id":"2a022693-9d0f-4651-9e38-e5ebff2965e3","card":"H174 mm · 토수거리 134 mm","detail":"높이 174 / 받침 Ø52 / 토수거리 134 / 토수높이 61 (mm 기준)"},{"brand":"아메리칸스탠다드","model":"FA1731-0KAKB11AA","id":"be2445f7-de3a-4137-a347-35f6b84dc6ce","card":"D162 × H154.5 mm","detail":"깊이 162 × 높이 154.5 / 토수거리 115.5 / 토수높이 108 (mm 기준)"},{"brand":"아메리칸스탠다드","model":"FA1730-0KAKB11AA","id":"59488e3b-5e4e-49d6-aada-6f610106c3c3","card":"D162 × H154.5 mm","detail":"깊이 162 × 높이 154.5 / 토수거리 115.5 / 토수높이 108 (mm 기준)"},{"brand":"아메리칸스탠다드","model":"FA1614-0KAKA11AA","id":"16c080ce-886f-4da1-a1e4-ba94d503d947","card":"W50(받침) × D185.5 × H159 mm","detail":"받침 폭 50 × 깊이 185.5 × 높이 159 / 토수거리 108 (mm 기준)"},{"brand":"아메리칸스탠다드","model":"FA1661-0KAKB11AA","id":"ae4edcbf-30fc-42c8-a812-f2e7e4db86ca","card":"D139 × H125 mm","detail":"깊이 139 × 높이 125 / 토수거리 94.4 / 토수높이 68 (mm 기준)"},{"brand":"아메리칸스탠다드","model":"FA4551-0KAKE11AA","id":"9ff26a44-1a56-4bd8-85f7-c598f7e5f283","card":"돌출 216.5 mm · 토수거리 207 mm","detail":"벽면→토수구 중심 207 / 전체 돌출 216.5 / 중심 간격 100 (mm 기준)"},{"brand":"아메리칸스탠다드","model":"FA1310-0GAK121AA","id":"ada3c42c-f4aa-4388-8d4d-ab01f86e0812","card":"치수 확인 중","detail":"치수 확인 중"},{"brand":"아메리칸스탠다드","model":"FA1603-0GAK121AA","id":"916fd5d0-1fb0-4f71-89a7-7fef92630308","card":"D173 × H150 mm","detail":"깊이 173 × 높이 150 / 토수거리 129.5 / 토수높이 93 / 홀 간격 100+100 (mm 기준)"},{"brand":"아메리칸스탠다드","model":"FA1668-0KAKA11AA","id":"48087652-f8be-4fdc-8ae2-e748acf20538","card":"H147 mm · 토수거리 97 mm","detail":"받침 Ø50 / 높이 147 / 토수거리 97 (mm 기준)"},{"brand":"아메리칸스탠다드","model":"FA3129-0GAK121AA","id":"978eb191-04cc-46b0-a009-4c2745bb151b","card":"토수거리 130 mm · 토수높이 111 mm","detail":"토수거리 130 / 토수높이 111 / 손잡이 중심 간격 170~300 (mm 기준)"},{"brand":"아메리칸스탠다드","model":"FA1612-0KAKB11AA","id":"f8faf75b-272f-40cc-9e8a-1f9f9f8cbe1d","card":"W50 × D154.5 × H141.5 mm","detail":"폭 50 × 깊이 154.5 × 높이 141.5 / 토수거리 98.5 (mm 기준)"},{"brand":"에떼르노","model":"E7-1001","id":"yuhiha-userpng-6e8403bf9de9bbe0144c","card":"H165 mm · 받침 Ø50 mm","detail":"높이 165 / 받침 Ø50 / 도면 자세의 토수거리 65.5 · 토수높이 68.8 (mm 기준)"},{"brand":"에떼르노","model":"R2-1001","id":"yuhiha-userpng-b26ebfda40183880a9eb","card":"W50(받침) × D165 × H134.4 mm","detail":"받침 폭 50 × 깊이 165 × 높이 134.4 / 토수거리 111.3 · 토수높이 110.3 (mm 기준)"},{"brand":"폰타나","model":"TF-L5317","id":"basin-wall-faucet-5317","card":"토수거리 205 mm · 중심간격 100 mm","detail":"벽면→토수구 중심 205 / 중심 간격 100 / 매립깊이 45~65 (mm 기준)"},{"brand":"폰타나","model":"TF-L5310","id":"basin-wall-faucet-5310","card":"토수거리 200 mm · 중심간격 100 mm","detail":"벽면→토수구 중심 200 / 중심 간격 100 / 매립깊이 45~65 (mm 기준)"},{"brand":"필로토","model":"5503","id":"basin-wall-faucet-5503","card":"토수거리 183~203","detail":"토수거리 183~203 / 매립깊이 45~65 / 중심간격 120 / 덮개 Ø68 (mm 기준, 공식 도면 산출 범위)"},{"brand":"필로토","model":"5506","id":"basin-wall-faucet-5506","card":"토수거리 183~203","detail":"토수거리 183~203 / 매립깊이 45~65 / 중심간격 120 / 덮개 Ø68 (mm 기준, 공식 도면 산출 범위)"},{"brand":"한스그로헤","model":"76050000","id":"euroceramic-595","card":"토수 돌출거리 228 mm","detail":"공식 토수 돌출거리 228 / 연결 DN15 (mm 기준)"},{"brand":"폰타나","model":"TF-L4010","card":"H134 mm · 토수거리 121 mm","detail":"높이 134 mm · 토수높이 86 mm · 토수거리 121 mm"},{"brand":"폰타나","model":"TF-L4017","card":"H166 mm · 토수거리 129 mm","detail":"높이 166 mm · 토수높이 69 mm · 토수거리 129 mm · 본체 Ø38 mm · 받침 Ø50 mm"},{"brand":"비반트","model":"CA340MW","card":"D161 × H146 mm","detail":"깊이 161 mm · 높이 146 mm · 토수높이 84 mm · 토수거리 131 mm · 본체 Ø42 mm · 받침 Ø52 mm · 타공 Ø33 mm"}];
function basinFaucetDimensions(m,detail=false){const norm=s=>String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'');const model=norm(m.model);const row=BASIN_FAUCET_DIMENSIONS.find(r=>r.id&&r.id===m.id)||BASIN_FAUCET_DIMENSIONS.find(r=>(r.brand===m.brand||(r.brand==='대림바스'&&m.brand==='대림'))&&model&&model.startsWith(norm(r.model)));if(row)return detail?row.detail:row.card;const parts=String(m.spec||'').split(/\s*[·/]\s*/).filter(s=>/\d/.test(s)&&/(?:mm|[WDH]\s*\d|높이|깊이|토수|돌출|간격|Ø)/i.test(s));return parts.join(' · ')||'치수 확인 중'}
// Shower-only information formatting; preserve images and installation measurements.
function showerSpecParts(m){return String(m.spec||'').replace(/\s*mm\s*·\s*[^0-9]*$/,' mm').split(/\s*[;\/|·]\s*/).filter(v=>/\d/.test(v)&&!/^\s*(?:크롬|니켈|사틴|밀크화이트|메트실버)/.test(v)).map(v=>{v=v.trim().replace(/[–~]/g,'–').replace(/\s*×\s*/g,' × ').replace(/\b([WDHL])\s*(?=\d)/g,'$1 ').replace(/(\d)\s*mm\b/g,'$1 mm');return /\bmm\b/.test(v)?v:v+' mm';});}
function showerSpecMarkup(m){const parts=showerSpecParts(m);return parts.length?parts.map(v=>`<span style="display:block;line-height:1.65;overflow-wrap:anywhere">${escapeHTML(faucetDimensionStyle(v))}</span>`).join(''):'치수 확인 중';}
function showerCardSpec(m){
 const key=String(m.model||'').toUpperCase(),brand=String(m.brand||'');
 if(['대림','대림바스'].includes(brand)&&key.includes('DL-B4111SN'))return '레인헤드 200 × 200 / 급수 중심→상단 약 1100';
 if(brand==='필로토'&&(/VICTORIA.*301|빅토리아.*301/.test(key)||m.id==='yuhiha-userpng-d1e08d5924d4f2b38cc3'))return '본체 폭 220';
 if(brand==='라우체'&&['7075','7078'].includes(key))return '매립형 · 핸드샤워';
 if(brand==='라우체'&&key==='7115')return '매립형 · 레인샤워';
 if(brand==='필로토'&&key==='1701')return '매립형 · 스파우트 + 핸드샤워';
 if(brand==='필로토'&&key==='1702')return '매립형 · 레인샤워';
 if(key.includes('FB2120'))return /MGEA003|레인/.test(key+' '+m.name)?'매립형 · 레인샤워':'매립형 · 스파우트 + 핸드샤워';
 if(key.includes('FC2110'))return '매립형 · 핸드샤워';
 if(key.includes('FB5782'))return '일체형 · 레인샤워';
 if(key.includes('FC5768'))return '레인헤드 Ø 200 / 상부 높이 1100–1300';
 if(key.includes('FC5797'))return '선반 폭 500 / 레인헤드 W 300 × D 200';
 const widths=[[/FB2668/,150],[/E7-1005/,235.5],[/R2-1005/,255.2],[/DL-B4213|DL-B4313/,185],[/P1-600/,429],[/S-VAR600/,220],[/XA600/,230],[/FB273[01]/,272],[/FB2614/,254],[/FB2661/,266],[/FC2192/,242],[/FB2612/,255]];
 const row=widths.find(([pattern])=>pattern.test(key));
 return row?'본체 폭 '+row[1]+(/S-VAR600/.test(key)?' (손잡이 제외)':''):'';
}
function basinFaucetCardSummary(m){
 const detail=basinFaucetDimensions(m,true),card=basinFaucetDimensions(m);
 const height=detail.match(/(?:^|[\s/×·])높이\s*(\d+(?:\.\d+)?)/)?.[1]||card.match(/\bH\s*(\d+(?:\.\d+)?)/i)?.[1];
 const reach=detail.match(/(?:토수거리|토수 돌출거리|벽면→토수구 중심)\s*(\d+(?:\.\d+)?(?:\s*[~–-]\s*\d+(?:\.\d+)?)?)/)?.[1];
 return [height?'높이 '+height:'',reach?'토수거리 '+reach:''].filter(Boolean).join(' / ');
}
function towelCardDimensions(m){
 const key=String(m.model||'')+' '+String(m.name||'');
 // Official drawing dimensions in installed orientation; unknown overall axes stay omitted.
 const row=[[/TC04A/,[570,74.5,76.5]],[/FH1051/,[600,52,25]],[/ESS-100/,[640,65.5,49.5]],[/N01AA/,[610,191,127]],[/N01A/,[650,70,49.5]],[/N02A/,[570,65,19]],[/FH1018/,[630,69.5,58]],[/FH1017/,[520,null,110]],[/JN.*화이트/,[600,66,null]]].find(([pattern])=>pattern.test(key));
 return row?row[1].map((value,i)=>value==null?'':['W','D','H'][i]+' '+value).filter(Boolean).join(' × '):'';
}
// Display-only dimensions in mm, matching W 410 × D 700 × H 700.
function faucetDimensionStyle(value){return dimensionLabelSpacing(String(value||'')).replace(/\(mm 기준\)/g,'').replace(/\s*mm\b/g,'').replace(/\s*[~–]\s*/g,'–').replace(/\s*·\s*/g,' / ').trim();}
// Existing verified slidebar drawings; absent overall widths are not inferred from rod diameter.
function slidebarCardDimensions(m){
 const key=String(m.model||'').toUpperCase();
 const rows=[[/TB307/,680],[/ESSB-100/,640],[/ESSB-200/,630],[/N01S|VA307/,650]];
 const row=rows.find(([pattern])=>pattern.test(key));return row?'높이 '+row[1]:'';
}
// Round dimension labels only; retain source measurements for physical image scaling.
function integerDimensionText(value){return String(value||'').replace(/\d+\.\d+/g,n=>String(Math.round(Number(n))))}
function mirrorDimensionText(m){
 const raw=String(m.spec||'').split('·')[0].trim();
 if(!raw||/확인|미입력/.test(raw))return '';
 return raw.split(/\s*\/\s*/).map(part=>{
  const circle=part.match(/[ØΦøφ]\s*(\d+(?:\.\d+)?)/);
  if(circle)return 'Ø '+Math.round(Number(circle[1]));
  const pair=part.match(/(?:W\s*)?(\d+(?:\.\d+)?)\s*[×xX*]\s*(?:H\s*)?(\d+(?:\.\d+)?)/);
  return pair?'W '+Math.round(Number(pair[1]))+' × H '+Math.round(Number(pair[2])):integerDimensionText(part);
 }).join(' / ');
}
function displayedDimensions(m,value){return standardDimensionText(value)}
function catalogSubtitle(m){return m.cat==='거울'?mirrorDimensionText(m):displayedDimensions(m,catalogSubtitleExact(m))}
function catalogSubtitleExact(m){if(m.cat==='싱크수전')return m.spec||'';if(m.cat==='슬라이드바')return slidebarCardDimensions(m);if(m.cat==='욕실장')return bathroomSpec(m)||'치수 확인 중';if(m.cat==='수건걸이')return towelCardDimensions(m);if(m.cat==='세면수전')return basinFaucetCardSummary(m);if(['환풍기','배수구'].includes(m.cat))return formatVentDrainSpec(m);if(['변기','세면대'].includes(m.cat))return bathroomSpec(m)||'규격 정보 미입력';if(m.cat==='휴지걸이')return holderCardSize(m);if(m.cat==='샤워수전')return showerCardSpec(m);if(vivantMilkWhite(m))return '밀크화이트';const r=accessoryFinish(m);return r?(m.cat==='수건걸이'?r.sales_colors.map(accessoryColorName).join(' · '):accessoryColorName(r.card_color)):['수건걸이','휴지걸이'].includes(m.cat)?'색상 정보 확인 중':m.spec||'규격 정보 미입력'}
function accessoryDetailMarkup(m){
 if(m.cat==='휴지걸이')return holderDetailMarkup(m);
 const r=accessoryFinish(m);if(!r)return `<dt>색상</dt><dd>확인 중</dd><dt>규격</dt><dd><details><summary>규격 보기</summary>${escapeHTML(m.cat==='거울'?mirrorDimensionText(m):displayedDimensions(m,bathroomSpec(m))||'미입력')}</details></dd>`;
 if(['수건걸이','휴지걸이'].includes(m.cat))return `<dt style="align-self:start;line-height:36px;padding-top:4px">색상</dt><dd>${basinFaucetColorMarkup(m,r.sales_colors.filter(name=>m.cat!=='휴지걸이'||!name.includes('미확인')).map(accessoryColorName))}</dd>`+(m.cat==='수건걸이'&&r.sales_colors.length?'':`<dt>규격</dt><dd><details><summary>규격 보기</summary>${escapeHTML(m.spec||r.spec||'미입력')}</details></dd>`);
 const sales=r.sales_colors.map(accessoryColorName).join(' · ')||'확인 중';
 return `<dt>이미지 적용색</dt><dd>${escapeHTML(accessoryColorName(r.image_color))}</dd><dt>확인된 판매색상</dt><dd>${escapeHTML(sales)}<small style="display:block;margin-top:8px;font-size:11px;color:var(--muted)">${escapeHTML(r.note)}</small></dd><dt>규격</dt><dd><details><summary>규격 보기</summary><p>${escapeHTML(m.spec||r.spec||'미입력')}</p>${m.spec&&m.spec!==r.spec?`<p>자료표: ${escapeHTML(r.spec)}</p>`:''}</details></dd>`;
}
function orderBasinFaucets(items){
 const brand=m=>String(m.brand||'').replace(/^대림바스$/,'대림');
 const type=m=>/매립|TF-L531[07]|76050000|550[36]/i.test([m.name,m.model].join(' '))?2:/3홀/.test([m.name,m.spec].join(' '))?1:0;
 const sorted=items.filter(m=>m.cat==='세면수전').sort((a,b)=>brand(a).localeCompare(brand(b),'ko')||type(a)-type(b)||a.name.localeCompare(b.name,'ko',{numeric:true})||a.id.localeCompare(b.id));
 let i=0;return items.map(m=>m.cat==='세면수전'?sorted[i++]:m);
}
// Center the visible product bounds, not the transparent canvas or visual mass.
// Keep the existing scale and horizontal placement for every product category.
const productVerticalBoundsCache=new Map();
let productVerticalObserver=null;
function productVerticalBounds(img){
  const key=img.currentSrc||img.src;
  if(productVerticalBoundsCache.has(key))return productVerticalBoundsCache.get(key);
  const stored=boundsStoreRead('vertical',key);if(stored!==undefined){productVerticalBoundsCache.set(key,stored);return stored;}
  const canvas=document.createElement('canvas'),ratio=Math.min(1,320/Math.max(img.naturalWidth,img.naturalHeight));
  canvas.width=Math.max(1,Math.round(img.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(img.naturalHeight*ratio));
  let result=null;
  try{
    const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,canvas.width,canvas.height);
    const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
    let top=canvas.height,bottom=-1,transparent=false;
    for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
      const alpha=pixels[(y*canvas.width+x)*4+3];
      if(alpha<128)transparent=true;
      else {top=Math.min(top,y);bottom=Math.max(bottom,y);}
    }
    if(transparent&&bottom>=top)result={top:top/canvas.height,bottom:(bottom+1)/canvas.height};
  }catch{/* Opaque textures and cross-origin images retain their existing layout. */}
  productVerticalBoundsCache.set(key,result);boundsStoreWrite('vertical',key,result);return result;
}
function centerProductVertically(img){
  if(img.dataset.holderScale||!img.isConnected||!img.complete||!img.naturalWidth)return;
  const bounds=productVerticalBounds(img);if(!bounds)return;
  const style=getComputedStyle(img);if(style.objectFit!=='contain')return;
  img.style.translate='none';
  const frame=img.parentElement,box=frame.getBoundingClientRect(),rect=img.getBoundingClientRect();
  if(!box.width||!rect.height)return;
  const paintedHeight=Math.min(rect.width/img.naturalWidth,rect.height/img.naturalHeight)*img.naturalHeight;
  const productCenter=rect.top+(rect.height-paintedHeight)/2+paintedHeight*(bounds.top+bounds.bottom)/2;
  const zoom=box.width/frame.offsetWidth;
  const shift=(box.top+box.height/2-productCenter)/zoom;
  img.style.translate=`0 ${shift.toFixed(3)}px`;
}
function alignCatalogProductPadding(){
  productVerticalObserver?.disconnect();if(typeof ResizeObserver==="undefined")return;
  productVerticalObserver=new ResizeObserver(entries=>{for(const entry of entries){const img=entry.target.querySelector('img');if(img)centerProductVertically(img);}});
  document.querySelectorAll('#catalog .material-image>img').forEach(img=>{
    img.addEventListener('load',()=>centerProductVertically(img));
    productVerticalObserver.observe(img.parentElement);centerProductVertically(img);
  });
}

function renderCatalog(){let items=materials().filter(m=>(query||GROUPS[group].cats.includes(m.cat))&&(subcategory==='전체'||query||m.cat===subcategory)&&(!brandActive()||brand==='전체'||brandOf(m)===brand)&&(!seriesList()||series==='전체'||seriesOf(m,seriesList())===series)&&(!query||[m.name,m.productName,m.brand,m.model,m.cat,m.spec].join(' ').toLowerCase().includes(query.toLowerCase()))&&(filter!=='mine'||!m.sample)&&(filter!=='favorite'||state.favorites.includes(m.id)));if(state.settings.sort==='favorite')items.sort((a,b)=>Number(state.favorites.includes(b.id))-Number(state.favorites.includes(a.id)));if(state.settings.sort==='name')items.sort((a,b)=>a.name.localeCompare(b.name,'ko'));if(state.settings.sort==='category')items.sort((a,b)=>a.cat.localeCompare(b.cat,'ko')||a.name.localeCompare(b.name,'ko'));const viewKey=JSON.stringify([group,subcategory,brand,series,query,filter,state.settings.sort,state.materials.map(m=>m.id)]);if(viewKey!==catalogViewKey){catalogViewKey=viewKey;catalogViewOrder=items.map(m=>m.id)}const order=new Map(catalogViewOrder.map((id,i)=>[id,i]));items.sort((a,b)=>(order.get(a.id)??Infinity)-(order.get(b.id)??Infinity));items=orderBrandsAlphabetically(orderBasinFaucets(items));$('categoryTitle').textContent=query?'검색 결과':subcategory==='전체'?GROUPS[group].name:[subcategory,brandActive()&&brand!=='전체'?brand:'',seriesList()&&series!=='전체'?series:''].filter(Boolean).join(' · ');$('resultCount').textContent=`${items.length} materials`;$('catalog').innerHTML=items.map(m=>{const added=project().items.some(i=>i.materialId===m.id),layout=materialCardLayout(m);return `<article class="material"><div class="material-image${layout?' physical-scale':''}" data-detail="${m.id}" role="button" tabindex="0" aria-label="${escapeHTML(m.name)} 상세 보기"${layout?` style="--physical-scale:${layout.scale.toFixed(4)};--physical-x:${layout.x};--physical-y:${layout.y}"`:''}><img src="${m.image}" alt="${escapeHTML(m.name)}" loading="lazy"${layout?.imageStyle?` style="${layout.imageStyle}"`:['슬라이드바','샤워수전','싱크볼','싱크수전','후드'].includes(m.cat)?' style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain"':''}>${m.sample?'<span class="sample-tag">EXAMPLE</span>':''}<button type="button" class="fav ${state.favorites.includes(m.id)?'active':''}" data-fav="${m.id}" aria-label="${escapeHTML(m.name)} 즐겨찾기" aria-pressed="${state.favorites.includes(m.id)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg></button><button type="button" class="add ${added?'added':''}" data-add="${m.id}" aria-label="${escapeHTML(m.name)} ${added?'담김':'담기'}">${added?'✓':'＋'}</button></div><div class="material-meta" data-detail="${m.id}" role="button" tabindex="0"><span class="kind">${escapeHTML(m.cat)}${m.brand?' / '+escapeHTML(m.brand):''}</span><h3>${escapeHTML(m.name)}</h3><p>${escapeHTML(catalogSubtitle(m))}</p></div></article>`}).join('');$('emptyCatalog').hidden=items.length>0;alignCatalogProductPadding();applyCatalogDefaultFinishes();alignHolderCatalog();alignKitchenCatalog()}
function renderSelection(){const p=project();if(!p)return;syncWorkspaceContext();syncConsultationForm(p);$('projectSelect').innerHTML=(consultationDraft?`<option value="" selected>${escapeHTML(consultationDraft.customer?consultationDraft.customer+' 고객님 상담':'작성 중인 새 상담')}</option>`:'')+state.projects.map(s=>`<option value="${s.id}" ${s.id===p.id?'selected':''}>${escapeHTML(s.name)}</option>`).join('');$('projectMeta').textContent=[p.customer||'새로운 공간을 위한 기록',p.date].filter(Boolean).join(' · ');const count=p.items.length;$('selectedCount').textContent=count;$('mobileCount').textContent=count;$('exportSummary').textContent=count?`${count}개의 선택, 하나의 공간`:'선택한 자재를 제안서로';$('finishListBtn').disabled=!count;$('emptySelection').hidden=!!count;const cover=p.items.slice(0,3).map(i=>selectionMaterial(i));$('coverTiles').innerHTML=(cover.length?cover:materials().slice(0,3)).map(m=>`<img src="${m.image}" alt="${escapeHTML(m.name)}">`).join('');$('selectedItems').innerHTML=p.items.map((i,index)=>{const m=selectionMaterial(i);return `<div class="selected-item" data-item="${i.id}"><div class="selected-main"><img src="${m.image}" alt="${escapeHTML(m.name)}"><div class="info"><small>${String(index+1).padStart(2,'0')} / ${escapeHTML(m.cat)}${m.sample?' · 예시':''}</small><b>${escapeHTML(m.name)}</b><small>${escapeHTML(m.model||m.brand)}</small></div><button class="remove-item" data-remove="${i.id}" aria-label="${escapeHTML(m.name)} 셀렉션에서 빼기">×</button></div><details class="selection-item-details"><summary>적용 공간 · 메모</summary><div class="item-controls"><select data-field="room" aria-label="${escapeHTML(m.name)} 적용 공간">${ROOMS.map(r=>`<option ${r===i.room?'selected':''}>${r}</option>`).join('')}</select><select data-field="status" aria-label="${escapeHTML(m.name)} 결정 상태">${['후보','확정','보류'].map(s=>`<option ${s===i.status?'selected':''}>${s}</option>`).join('')}</select></div><label class="item-location">적용부위<input data-field="application" list="applicationOptions" maxlength="80" value="${escapeHTML(i.application||'')}" aria-label="${escapeHTML(m.name)} 적용부위" placeholder="예: 벽 / 바닥 / 천장 / 싱크대"></label><input class="item-note" data-field="note" maxlength="240" value="${escapeHTML(i.note)}" aria-label="${escapeHTML(m.name)} 상담 메모" placeholder="적용 위치 / 고객 의견 남기기"></details></div>`}).join('')}
function applySiteSettings(){const heading=document.querySelector?.('.reference-title');if(heading){if(['material library','yuhiha material library'].includes(state.settings.title.toLowerCase().trim()))heading.textContent='MATERIAL LIBRARY';else heading.textContent=state.settings.title;}$('heroTitle').textContent=state.settings.title;$('heroSubtitle').textContent=state.settings.subtitle;const root=document.documentElement.style;root.setProperty('--hero-brand-size',state.settings.brandSize+'px');root.setProperty('--hero-brand-spacing',state.settings.brandSpacing+'px');root.setProperty('--hero-title-font',state.settings.titleFont==='pretendard'?"Pretendard, sans-serif":"Montserrat, sans-serif");root.setProperty('--hero-title-size',state.settings.titleSize+'px');root.setProperty('--hero-title-mobile-size',state.settings.titleMobileSize+'px');root.setProperty('--hero-title-weight',state.settings.titleWeight);root.setProperty('--hero-title-spacing',state.settings.titleSpacing+'px');root.setProperty('--hero-title-gap',state.settings.titleGap+'px');$('catalog').style.setProperty('--catalog-columns',state.settings.columns);state.settings.steps.forEach((step,i)=>{$('processStep'+(i+1)).textContent=step})}
function render(){applySiteSettings();renderGroups();renderCatalog();renderSelection()}
function toggleFavorite(id){
 const pageX=window.scrollX,pageY=window.scrollY,rail=$('consultationRail'),railScroll=rail.scrollTop;
 state.favorites=state.favorites.includes(id)?state.favorites.filter(x=>x!==id):[...state.favorites,id];save();
 for(const button of document.querySelectorAll('[data-fav]')){if(button.dataset.fav!==id)continue;const active=state.favorites.includes(id);button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active))}
 rail.scrollTop=railScroll;window.scrollTo({left:pageX,top:pageY,behavior:'instant'});
}
async function add(id,color=defaultMaterialColor(material(id)),previewImage=''){
  const m=material(id);if(!m)return;
  if(!previewImage&&color&&color!==baseMaterialColor(m)&&color===defaultMaterialColor(m)){try{previewImage=await defaultFinishImage(m)}catch(e){toast('기본 색상 이미지를 불러오지 못했어요.');return}}
  if(project().items.some(i=>i.materialId===id&&(i.color||'')===color)){toast('이미 같은 색상으로 담긴 자재예요.');return}
  project().items.push({id:uid(),materialId:id,color,colorImage:color?(previewImage||(usesBasePngTint(m)?m.image:m.colorImages?.[color])||m.image):'',room:'미지정',status:'후보',note:''});
  saveSelection();const rail=$('consultationRail'),railScroll=rail.scrollTop;renderSelection();rail.scrollTop=railScroll;
  for(const button of document.querySelectorAll('[data-add]')){if(button.dataset.add!==id)continue;const card=button.classList.contains('add');button.classList.add('added');button.textContent=card?'✓':'✓ 셀렉션에 담았어요';button.setAttribute('aria-label',m.name+' 담김');button.setAttribute('aria-pressed','true')}
  toast(color?color+' 색상으로 셀렉션에 담았어요.':'셀렉션에 담았어요.');
}
function removeSelectionItem(id){
 const p=project(),item=p.items.find(i=>i.id===id);if(!item)return;
 const rail=$('consultationRail'),railScroll=rail.scrollTop,pageX=window.scrollX,pageY=window.scrollY;
 p.items=p.items.filter(i=>i.id!==id);saveSelection();
 // Leave catalog images in place so removing a selection cannot collapse the page.
 for(const button of document.querySelectorAll('[data-add]')){
  if(button.dataset.add!==item.materialId)continue;
  button.classList.remove('added');button.textContent=button.classList.contains('add')?'＋':'+ 셀렉션에 담기';
  button.setAttribute('aria-label',selectionMaterial(item).name+' 담기');button.setAttribute('aria-pressed','false');
 }
 renderSelection();rail.scrollTop=railScroll;
 window.scrollTo({left:pageX,top:pageY,behavior:'instant'});
}
function showConsultation(){document.body.classList.add('consultation-open');document.body.classList.remove('consultation-closed');document.querySelector('.selection').classList.add('mobile-show')}
let customerProjectsTrashMode=false;
function renderCustomerProjects(){
  const query=String($('customerProjectsSearch').value||'').trim().toLocaleLowerCase(),trash=state.deletedProjects||[];
  const all=customerProjectsTrashMode?trash:state.projects,projects=all.filter(p=>[p.customer,p.name,p.date].filter(Boolean).join(' ').toLocaleLowerCase().includes(query));
  $('customerProjectsCount').textContent=query?`${all.length}개 중 ${projects.length}개 프로젝트`:`${customerProjectsTrashMode?'삭제한':'저장된'} 프로젝트 ${all.length}개`;
  $('customerProjectsIntro').textContent=customerProjectsTrashMode?'삭제한 프로젝트를 다시 복원할 수 있어요.':'저장된 상담과 선택 자재를 확인하세요.';
  $('customerProjectsList').innerHTML=projects.map(p=>`<div class="saved-project-entry"><button type="button" class="saved-project-row" ${customerProjectsTrashMode?'data-restore-project':'data-open-project'}="${escapeHTML(p.id)}" aria-label="${escapeHTML(consultationHeading(p))} ${customerProjectsTrashMode?'복원':'열기'}"><span class="saved-project-name"><strong>${escapeHTML(consultationHeading(p))}</strong><small>${escapeHTML(p.customer||'고객명 미입력')}</small></span><time>${escapeHTML(p.date||'날짜 미입력')}</time><span class="saved-project-count">자재 ${p.items.length}개</span><span aria-hidden="true">${customerProjectsTrashMode?'복원':'↗'}</span></button>${customerProjectsTrashMode?'':`<details class="project-row-menu"><summary aria-label="${escapeHTML(consultationHeading(p))} 더보기">⋯</summary><div><button type="button" class="project-delete-btn" data-delete-project="${escapeHTML(p.id)}" aria-label="${escapeHTML(consultationHeading(p))} 삭제">프로젝트 삭제</button></div></details>`}</div>`).join('');
  $('customerProjectsEmpty').hidden=!!projects.length;$('customerProjectsEmpty').textContent=all.length?'검색한 프로젝트가 없어요.':customerProjectsTrashMode?'삭제한 프로젝트가 없어요.':'저장된 프로젝트가 없어요. 새 상담을 저장하면 여기에 표시됩니다.';
  $('projectTrashToggle').hidden=!trash.length&&!customerProjectsTrashMode;$('projectTrashToggle').textContent=customerProjectsTrashMode?'저장된 프로젝트로 돌아가기':`삭제한 프로젝트 ${trash.length}개 보기`;
}
function showCustomerProjects(){
  customerProjectsTrashMode=false;$('customerProjectsSearch').value='';renderCustomerProjects();
  if(!$('customerProjectsDialog').open)$('customerProjectsDialog').showModal();
}
function openSavedCustomerProject(id){
  if(!state.projects.some(p=>p.id===id)){renderCustomerProjects();toast('프로젝트 목록을 다시 확인해 주세요.');return}
  $('projectSelect').value=id;$('projectSelect').onchange({target:{value:id}});
  $('customerProjectsDialog').close();showConsultation();showProjectDetail();
}
let pendingProjectDelete=null;
function requestDeleteCustomerProject(id){
  const p=state.projects.find(p=>p.id===id);if(!p)return;pendingProjectDelete=id;
  $('deleteProjectName').textContent=consultationHeading(p);$('deleteProjectDialog').showModal();
}
async function deleteCustomerProject(id){
  const p=state.projects.find(p=>p.id===id);if(!p)return;
  state.deletedProjects=[{...structuredClone(p),deletedAt:new Date().toISOString()},...(state.deletedProjects||[])];state.projects=state.projects.filter(p=>p.id!==id);
  if(state.active===id){state.active=state.projects[0]?.id||'';consultationLoadedId=null;if(!consultationDraft&&!state.active){consultationDraft=newConsultationDraft();persistConsultationDraft()}}
  render();renderCustomerProjects();await save();
  if(!$('saveState').textContent.includes('실패'))toast('프로젝트를 삭제했어요. 삭제한 프로젝트 목록에서 복원할 수 있습니다.');
}
async function restoreCustomerProject(id){
  const p=(state.deletedProjects||[]).find(p=>p.id===id);if(!p||state.projects.some(p=>p.id===id))return;
  const restored=structuredClone(p);delete restored.deletedAt;state.projects.unshift(restored);state.deletedProjects=state.deletedProjects.filter(p=>p.id!==id);if(!state.active)state.active=id;
  render();renderCustomerProjects();await save();if(!$('saveState').textContent.includes('실패'))toast('프로젝트를 복원했어요.');
}
$('deleteProjectCancelBtn').onclick=()=>{$('deleteProjectDialog').close();pendingProjectDelete=null};
$('deleteProjectConfirmBtn').onclick=async()=>{const id=pendingProjectDelete;if(!id)return;pendingProjectDelete=null;$('deleteProjectDialog').close();await deleteCustomerProject(id)};
$('deleteProjectDialog').addEventListener('close',()=>{pendingProjectDelete=null});
$('customerProjectsSearch').addEventListener('input',renderCustomerProjects);
$('projectTrashToggle').onclick=()=>{customerProjectsTrashMode=!customerProjectsTrashMode;$('customerProjectsSearch').value='';renderCustomerProjects()};
$('customerProjectsList').addEventListener('click',e=>{const button=e.target.closest('button');if(!button)return;if(button.dataset.deleteProject)return requestDeleteCustomerProject(button.dataset.deleteProject);if(button.dataset.restoreProject)return restoreCustomerProject(button.dataset.restoreProject);if(button.dataset.openProject)openSavedCustomerProject(button.dataset.openProject)});
let pendingMaterialDelete=null;
function renderMaterialTrash(){
  const items=state.deletedMaterials||[];$('materialTrashCount').textContent=`삭제한 자재 ${items.length}개`;
  $('materialTrashList').innerHTML=items.map(m=>`<article class="material-trash-entry"><img src="${m.image}" alt="${escapeHTML(m.name)}"><div><strong>${escapeHTML(m.name)}</strong><small>${escapeHTML([m.cat,m.brand,m.model].filter(Boolean).join(' · '))}</small></div><button type="button" data-restore-material="${escapeHTML(m.id)}">복원</button></article>`).join('');
  $('materialTrashEmpty').hidden=!!items.length;
}
function showMaterialTrash(){renderMaterialTrash();$('materialTrashDialog').showModal()}
function requestDeleteMaterial(id){
  const m=state.materials.find(m=>m.id===id);if(!m)return;pendingMaterialDelete=id;
  $('deleteMaterialName').textContent=m.name;$('materialDialog').close();$('deleteMaterialDialog').showModal();
}
async function deleteMaterial(id){
  const m=state.materials.find(m=>m.id===id);if(!m)return;
  state.deletedMaterials=[{...structuredClone(m),deletedAt:new Date().toISOString()},...(state.deletedMaterials||[])];
  state.materials=state.materials.filter(m=>m.id!==id);state.favorites=state.favorites.filter(materialId=>materialId!==id);
  render();renderMaterialTrash();await save();
  if(!$('saveState').textContent.includes('실패'))toast('자재를 삭제했어요. 기존 프로젝트 기록은 유지됩니다.');
}
async function restoreMaterial(id){
  const m=(state.deletedMaterials||[]).find(m=>m.id===id);if(!m||state.materials.some(m=>m.id===id))return;
  const restored=structuredClone(m);delete restored.deletedAt;state.materials.unshift(restored);state.deletedMaterials=state.deletedMaterials.filter(m=>m.id!==id);
  render();renderMaterialTrash();await save();if(!$('saveState').textContent.includes('실패'))toast('자재를 라이브러리로 복원했어요.');
}
$('deleteMaterialBtn').onclick=()=>requestDeleteMaterial($('materialId').value);
$('deleteMaterialCancelBtn').onclick=()=>{$('deleteMaterialDialog').close();pendingMaterialDelete=null};
$('deleteMaterialConfirmBtn').onclick=async()=>{const id=pendingMaterialDelete;if(!id)return;pendingMaterialDelete=null;$('deleteMaterialDialog').close();await deleteMaterial(id)};
$('deleteMaterialDialog').addEventListener('close',()=>{pendingMaterialDelete=null});
$('materialTrashBtn').onclick=showMaterialTrash;
$('materialTrashList').addEventListener('click',e=>{const button=e.target.closest('[data-restore-material]');if(button)restoreMaterial(button.dataset.restoreMaterial)});
function openProject(isNew=false){if(isNew){consultationDraft=newConsultationDraft();consultationLoadedId=null;persistConsultationDraft()}showConsultation();renderCatalog();renderSelection();$('consultationRail').scrollTop=0;$('customerName').focus();if(consultationDraft)setSaveStatus('작성 중 · 프로젝트 만들기를 눌러 주세요')}
const consultationFields={customerName:'customer',customerPhone:'phone',customerAddress:'address',housingType:'housing',customerArea:'area',customerBudget:'budget',constructionDate:'constructionDate',projectNote:'note'};
function consultationHeading(p){const customer=p.customer?.trim();return customer?customer+(/고객님$/.test(customer)?' 상담':' 고객님 상담'):(consultationDraft?'새로운 공간의 시작':p.name||'첫 번째 상담')}
function syncConsultationHeadings(p){syncWorkspaceContext();const heading=consultationHeading(p);$('consultationTitle').textContent=heading;$('consultationDate').textContent='상담 날짜  '+(p.date||todaySeoul());$('selectionCustomer').textContent=p.customer?heading:'우리 집의 재료들';$('createProjectBtn').hidden=!consultationDraft;$('createProjectBtn').innerHTML='프로젝트 만들기 <span>↗</span>';$('projectDetailBtn').hidden=!!consultationDraft}
function syncConsultationForm(p){if(consultationLoadedId!==p.id||!$('projectForm').contains(document.activeElement)){$('projectForm').reset();$('projectId').value=consultationDraft?'':p.id;$('projectName').value=p.name||'';for(const [id,key] of Object.entries(consultationFields))$(id).value=p[key]||(key==='housing'?'아파트':'');consultationLoadedId=p.id}syncConsultationHeadings(p);}
function persistConsultationDraft(){try{if(consultationDraft)sessionStorage.setItem('yuhiha-review-draft',JSON.stringify(consultationDraft));else sessionStorage.removeItem('yuhiha-review-draft')}catch{}}
function saveSelection(){persistConsultationDraft();if(consultationDraft){setSaveStatus('작성 중 · 프로젝트 만들기를 눌러 주세요');return Promise.resolve()}return save()}
function showProjectDetail(){const p=project();if(!p)return;finishInlineMaterials();$('projectDetailTitle').textContent=consultationHeading(p);const fields=[['상담 날짜',p.date],['고객명',p.customer],['연락처',p.phone],['현장 주소',p.address],['주거 유형',p.housing],['면적',p.area? p.area+'평':''],['예산',p.budget],['희망 공사일',p.constructionDate],['상담 메모',p.note]];$('projectDetailContent').innerHTML='<div class="project-materials-heading"><h3>고객 정보</h3><button type="button" data-edit-project-info>정보 수정</button></div><div id="projectInfoEditor" hidden></div><dl class="project-information">'+fields.map(([k,v])=>`<div><dt>${k}</dt><dd>${escapeHTML(v||'—')}</dd></div>`).join('')+'</dl><div class="project-materials-heading"><h3>선택한 자재 · '+p.items.length+'</h3><button type="button" data-edit-project-materials>자재 수정 ↗</button></div><div class="project-detail-materials">'+p.items.map(i=>{const m=selectionMaterial(i);if(!m)return '';return `<article><img src="${m.image}" alt="${escapeHTML(m.name)}"><div><b>${escapeHTML(m.name)}</b><p>${escapeHTML([m.brand,m.model,i.room,i.status].filter(Boolean).join(' · '))}</p><p>${escapeHTML(i.note)}</p></div></article>`}).join('')+'</div>';$('detailExportBtn').disabled=!p.items.length;if(!$('projectDetailDialog').open)$('projectDetailDialog').showModal();setSaveStatus($('saveState').textContent)}

function syncWorkspaceContext(){const p=project();if(!p)return;$('currentCustomer').textContent=p.customer||'새 상담 작성 중';$('currentMaterialCount').textContent='자재 '+p.items.length+'개'}
function finishInlineMaterials(){$('projectDetailDialog').classList.remove('editing-materials');if($('projectMaterialsForm').parentElement!==$('projectMaterialsDialog'))$('projectMaterialsDialog').append($('projectMaterialsForm'));$('projectInlineEditor').hidden=true;projectMaterialsEdit=null;projectMaterialReplacement=null}
function commitInlineMaterials(){if(!projectMaterialsEdit)return Promise.resolve();const p=state.projects.find(p=>p.id===projectMaterialsEdit.id);if(!p)return Promise.resolve();p.items=structuredClone(projectMaterialsEdit.items);syncWorkspaceContext();renderSelection();$('detailExportBtn').disabled=!p.items.length;return save()}
function renderPickerCategories(){const gi=$('projectMaterialGroup').value,cats=gi===''?allCats():GROUPS[Number(gi)].cats;$('projectMaterialCategory').innerHTML='<option value="">전체 품목</option>'+cats.map(cat=>`<option value="${escapeHTML(cat)}">${escapeHTML(cat)}</option>`).join('');$('projectMaterialCategory').value=''}
$('projectMaterialGroup').onchange=()=>{renderPickerCategories();renderProjectMaterialPicker()};$('projectMaterialCategory').onchange=renderProjectMaterialPicker;
function openProjectInfoEditor(){const p=project(),host=$('projectInfoEditor');host.hidden=!host.hidden;if(host.hidden)return;host.innerHTML='<form id="inlineCustomerForm" class="form-grid">'+Object.entries(consultationFields).map(([id,key])=>{const label={customer:'고객명',phone:'연락처',address:'현장 주소',housing:'주거 유형',area:'면적 (평)',budget:'예산',constructionDate:'희망 공사일',note:'상담 메모'}[key];const value=escapeHTML(p[key]||'');return `<label>${label}${key==='housing'?`<select data-customer-field="${key}">${['아파트','빌라','단독주택','오피스텔','상업공간','기타'].map(v=>`<option ${v===p[key]?'selected':''}>${v}</option>`).join('')}</select>`:`<input data-customer-field="${key}" type="${key==='constructionDate'?'date':'text'}" maxlength="${key==='note'?400:key==='address'?200:key==='budget'?60:40}" value="${value}" ${key==='customer'?'required':''}>`}</label>`}).join('')+'<button type="button" id="customerEditDoneBtn">수정 마치기</button></form>';host.querySelector('form').onsubmit=e=>e.preventDefault();host.querySelector('form').oninput=e=>{const key=e.target.dataset.customerField;if(!key)return;if(key==='customer'&&!e.target.value.trim()){e.target.setCustomValidity('고객명을 입력해 주세요.');e.target.reportValidity();return}e.target.setCustomValidity('');p[key]=e.target.value;if(key==='customer')p.name=p.customer.trim()+' 고객님 상담';$('projectDetailTitle').textContent=consultationHeading(p);consultationLoadedId=null;syncConsultationForm(p);syncWorkspaceContext();save()};$('customerEditDoneBtn').onclick=showProjectDetail}
$('topNewProjectBtn').onclick=()=>openProject(true);$('listNewProjectBtn').onclick=()=>{$('customerProjectsDialog').close();openProject(true)};$('currentProjectBtn').onclick=()=>{if(consultationDraft)openProject();else showProjectDetail()};

let projectMaterialsEdit=null,projectMaterialReplacement=null,projectMaterialsSaving=false;
function renderProjectMaterialsEditor(){
  if(!projectMaterialsEdit)return;
  $('projectMaterialsEditTitle').textContent='자재 수정 · '+consultationHeading(projectMaterialsEdit);
  $('projectMaterialsEditCount').textContent=`선택한 자재 ${projectMaterialsEdit.items.length}개 · 변경사항은 자동 저장됩니다.`;
  $('projectMaterialsEditItems').innerHTML=projectMaterialsEdit.items.map(item=>{
    const m=selectionMaterial(item);if(!m)return '';
    return `<article class="project-edit-item" data-edit-item="${escapeHTML(item.id)}"><div class="project-edit-material"><img src="${m.image}" alt="${escapeHTML(m.name)}"><div><strong>${escapeHTML(m.name)}</strong><small>${escapeHTML([m.cat,m.brand,m.model].filter(Boolean).join(' · '))}</small></div><button type="button" data-project-replace="${escapeHTML(item.id)}" aria-label="${escapeHTML(m.name)} 교체">교체</button><button type="button" data-project-remove="${escapeHTML(item.id)}" aria-label="${escapeHTML(m.name)} 프로젝트에서 삭제">삭제</button></div><div class="project-edit-fields"><label>적용 공간<select data-project-field="room">${ROOMS.map(room=>`<option ${room===item.room?'selected':''}>${escapeHTML(room)}</option>`).join('')}</select></label><label>결정 상태<select data-project-field="status">${['후보','확정','보류'].map(status=>`<option ${status===item.status?'selected':''}>${status}</option>`).join('')}</select></label><label>적용부위<input data-project-field="application" maxlength="80" value="${escapeHTML(item.application||'')}" placeholder="벽 / 바닥 / 상판 등"></label><label>메모<input data-project-field="note" maxlength="240" value="${escapeHTML(item.note||'')}" placeholder="이 프로젝트의 자재 메모"></label></div></article>`;
  }).join('');
  $('projectMaterialsEditEmpty').hidden=!!projectMaterialsEdit.items.length;
}
function openProjectMaterialsEditor(){
  const p=state.projects.find(p=>p.id===state.active);if(!p)return;
  projectMaterialsEdit=structuredClone(p);$('projectDetailDialog').classList.add('editing-materials');$('projectInlineEditor').append($('projectMaterialsForm'));$('projectInlineEditor').hidden=false;renderProjectMaterialsEditor();$('projectInlineEditor').scrollIntoView({block:'start',behavior:'smooth'});
}
function openProjectMaterialPicker(itemId=null){
  if(!projectMaterialsEdit)return;projectMaterialReplacement=itemId;$('projectMaterialSearch').value='';$('projectMaterialGroup').innerHTML='<option value="">전체 대분류</option>'+GROUPS.map((g,i)=>`<option value="${i}">${escapeHTML(g.name)}</option>`).join('');$('projectMaterialGroup').value='';renderPickerCategories();$('projectMaterialPickerTitle').textContent=itemId?'교체할 자재 선택':'자재 추가';renderProjectMaterialPicker();$('projectMaterialPickerDialog').showModal();
}
function renderProjectMaterialPicker(){
  if(!projectMaterialsEdit)return;
  const search=String($('projectMaterialSearch').value||'').trim().toLocaleLowerCase();
  const gi=$('projectMaterialGroup').value,cat=$('projectMaterialCategory').value;const found=materials().filter(m=>(gi===''||GROUPS[Number(gi)]?.cats.includes(m.cat))&&(!cat||m.cat===cat)&&[m.name,m.cat,m.brand,m.model,m.spec].join(' ').toLocaleLowerCase().includes(search));
  $('projectMaterialPickerCount').textContent=`자재 ${found.length}개`;
  $('projectMaterialPickerItems').innerHTML=found.map(m=>{
    const selected=projectMaterialsEdit.items.some(i=>i.materialId===m.id&&i.id!==projectMaterialReplacement);
    return `<button type="button" class="project-material-choice" data-project-choose="${escapeHTML(m.id)}" aria-label="${escapeHTML(m.name)} ${selected?'이미 선택됨':'선택'}" ${selected?'disabled':''}><img src="${m.image}" alt="" loading="lazy"><span><strong>${escapeHTML(m.name)}</strong><small>${escapeHTML([m.cat,m.brand,m.model].filter(Boolean).join(' · '))}</small></span><span>${selected?'선택됨':'선택 ↗'}</span></button>`;
  }).join('');
  $('projectMaterialPickerEmpty').hidden=!!found.length;
}
function chooseProjectMaterial(id){
  if(!projectMaterialsEdit||!material(id))return;
  if(projectMaterialsEdit.items.some(i=>i.materialId===id&&i.id!==projectMaterialReplacement)){toast('이미 선택한 자재예요.');return}
  if(projectMaterialReplacement){const item=projectMaterialsEdit.items.find(i=>i.id===projectMaterialReplacement);if(!item)return;item.materialId=id;delete item.color;delete item.colorImage}
  else{if(projectMaterialsEdit.items.length>=500){toast('한 프로젝트에는 자재를 500개까지 담을 수 있어요.');return}projectMaterialsEdit.items.push({id:uid(),materialId:id,room:'미지정',status:'후보',application:'',note:''})}
  $('projectMaterialPickerDialog').close();projectMaterialReplacement=null;renderProjectMaterialsEditor();commitInlineMaterials();
}
async function saveProjectMaterialEdits(){await commitInlineMaterials();if(!$('saveState').textContent.includes('失敗')&&!$('saveState').textContent.includes('실패'))showProjectDetail()}
$('projectDetailContent').addEventListener('click',e=>{if(e.target.closest('[data-edit-project-materials]'))openProjectMaterialsEditor();if(e.target.closest('[data-edit-project-info]'))openProjectInfoEditor()});
$('projectMaterialsAddBtn').onclick=()=>openProjectMaterialPicker();
$('projectMaterialsEditItems').addEventListener('input',e=>{
  const field=e.target.dataset.projectField;if(!['room','status','application','note'].includes(field)||!projectMaterialsEdit)return;
  const id=e.target.closest('[data-edit-item]')?.dataset.editItem,item=projectMaterialsEdit.items.find(i=>i.id===id);if(item){item[field]=e.target.value;commitInlineMaterials()}
});
$('projectMaterialsEditItems').addEventListener('click',e=>{
  const button=e.target.closest('button');if(!button||!projectMaterialsEdit)return;
  if(button.dataset.projectReplace)openProjectMaterialPicker(button.dataset.projectReplace);
  if(button.dataset.projectRemove){projectMaterialsEdit.items=projectMaterialsEdit.items.filter(i=>i.id!==button.dataset.projectRemove);renderProjectMaterialsEditor();commitInlineMaterials()}
});
$('projectMaterialSearch').addEventListener('input',renderProjectMaterialPicker);
$('projectMaterialPickerItems').addEventListener('click',e=>{const button=e.target.closest('[data-project-choose]');if(button)chooseProjectMaterial(button.dataset.projectChoose)});
$('projectMaterialsForm').onsubmit=e=>{e.preventDefault();saveProjectMaterialEdits()};
$('projectMaterialsCancelBtn').onclick=()=>showProjectDetail();$('inlineEditorDoneBtn').onclick=()=>showProjectDetail();
$('projectMaterialsDialog').addEventListener('cancel',e=>{if(projectMaterialsSaving)e.preventDefault()});
$('projectDetailDialog').addEventListener('close',finishInlineMaterials);

function openMaterial(id){cabinetColorDraft=null;cabinetColorsBusy=false;$('cabinetColorEditor')?.remove?.();$('materialForm').reset();const m=id?state.materials.find(item=>item.id===id):null;$('materialId').value=m?.id||'';imageDraft=m?.image||'';$('imagePreview').src=imageDraft;$('imagePreview').hidden=!imageDraft;$('uploadHint').hidden=!!imageDraft;$('materialFormTitle').textContent=m?'자재 정보 수정':'새로운 재료를 만나보세요.';$('deleteMaterialBtn').hidden=!m;$('materialCat').innerHTML=allCats().map(c=>`<option>${c}</option>`).join('');$('materialCat').value=m?.cat||(subcategory!=='전체'?subcategory:GROUPS[group].cats[0]);for(const [f,k]of [['materialName','name'],['materialBrand','brand'],['materialModel','model'],['materialSpec','spec'],['materialUrl','url'],['materialNote','note']])$(f).value=m?.[k]||'';$('formError').textContent='';if(['욕실장','휴지걸이'].includes(m?.cat))cabinetColorEditor(m);$('materialDialog').showModal()}
function renderCategoryManager(){$('categoryList').innerHTML=GROUPS.map((g,i)=>`<section><b><span>${String(i+1).padStart(2,'0')} ${escapeHTML(g.name)}</span><i><button type="button" data-group-move="${i}:-1" aria-label="${escapeHTML(g.name)} 앞으로">↑</button><button type="button" data-group-move="${i}:1" aria-label="${escapeHTML(g.name)} 뒤로">↓</button></i></b><div>${g.cats.map((cat,j)=>`<span>${escapeHTML(cat)}<button type="button" data-cat-move="${i}:${j}:-1" aria-label="${escapeHTML(cat)} 앞으로">‹</button><button type="button" data-cat-move="${i}:${j}:1" aria-label="${escapeHTML(cat)} 뒤로">›</button><button type="button" data-remove-cat="${escapeHTML(cat)}" aria-label="${escapeHTML(cat)} 삭제">×</button></span>`).join('')}</div></section>`).join('');$('categoryGroupOptions').innerHTML=GROUPS.map(g=>`<option value="${escapeHTML(g.name)}"></option>`).join('')}
function openCategories(){$('categoryForm').reset();$('categoryError').textContent='';renderCategoryManager();$('categoryDialog').showModal()}
function openSiteSettings(){$('siteTitle').value=state.settings.title;$('siteSubtitle').value=state.settings.subtitle;$('siteColumns').value=state.settings.columns;$('siteSort').value=state.settings.sort;for(const key of ['brandSize','brandSpacing','titleFont','titleSize','titleMobileSize','titleWeight','titleSpacing','titleGap'])$('site'+key[0].toUpperCase()+key.slice(1)).value=state.settings[key];state.settings.steps.forEach((s,i)=>$('siteStep'+(i+1)).value=s);$('siteSettingsDialog').showModal()}
// Official finish codes; chip tones are screen approximations from manufacturer catalog imagery, not certified RGB values.
function slidebarFinishOptions(m){
  if(m.cat!=='슬라이드바')return [];
  // Only finish labels belong in chips; specification fragments must never become options.
  const known=new Set(['메트실버(MS)','메트실버','MS','CG','MG','CB','샴페인골드','메트그레이','콜드블랙','크롬(Chrome)','크롬','니켈','다크 그레이']);
  return [...new Set(String(m.spec||'').split(/[·/,]/).map(v=>v.trim()).filter(v=>known.has(v)))];
}
function slidebarColorMarkup(m){
  const tones={'메트실버(MS)':'#bfc1c2','메트실버':'#bfc1c2','MS':'#bfc1c2','CG':'#afa27a','MG':'#77787b','CB':'#252628','샴페인골드':'#afa27a','메트그레이':'#77787b','콜드블랙':'#252628','크롬(Chrome)':'linear-gradient(135deg,#aaaeb1,#f5f6f7 45%,#b2b6b9 70%,#e7e9eb)','크롬':'linear-gradient(135deg,#aaaeb1,#f5f6f7 45%,#b2b6b9 70%,#e7e9eb)','니켈':'#b8b5ac','다크 그레이':'#55585a'};
  const options=nickelFirst(slidebarFinishOptions(m));
  if(!options.length)return '색상 미확인';
  return `<div role="group" aria-label="색상 미리보기" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 12px;width:100%">${options.map((name,i)=>`<button type="button" data-slidebar-color="${escapeHTML(name)}" aria-pressed="${i===0}" style="display:grid;grid-template-columns:18px minmax(0,1fr);align-items:center;gap:8px;min-width:0;min-height:36px;padding:4px 0;text-align:left;border:0;border-radius:0;background:transparent;font:inherit;line-height:1.4"><span aria-hidden="true" style="display:block;width:18px;height:18px;border-radius:50%;border:1px solid #aaa;background:${tones[name]||'transparent'};${i===0?'outline:1px solid currentColor;outline-offset:3px':''}"></span><span style="overflow-wrap:anywhere">${escapeHTML(name)}</span></button>`).join('')}</div>`;

}
// Official available basin-faucet finishes, verified 2026-11-15. Swatch tones are illustrative screen approximations.
const BASIN_FAUCET_FINISHES = {
  "80c0ab7f-e12f-4fef-964c-be329fe1fbdd": [
    "크롬",
    "니켈",
    "건메탈"
  ],
  "32c3a86c-1e80-4c7c-8ae6-eec5d8b13925": [
    "크롬",
    "니켈",
    "건메탈"
  ],
  "bath-source-1684288489": [
    "니켈무광",
    "크롬",
    "블랙무광",
    "골드"
  ],
  "2a022693-9d0f-4651-9e38-e5ebff2965e3": [
    "메트실버",
    "메트그레이"
  ],
  "be2445f7-de3a-4137-a347-35f6b84dc6ce": [
    "사틴 헤어라인",
    "크롬"
  ],
  "59488e3b-5e4e-49d6-aada-6f610106c3c3": [
    "사틴 헤어라인",
    "크롬"
  ],
  "16c080ce-886f-4da1-a1e4-ba94d503d947": [
    "크롬",
    "그라파이트",
    "사틴 무광"
  ],
  "ae4edcbf-30fc-42c8-a812-f2e7e4db86ca": [
    "크롬",
    "그라파이트",
    "사틴 헤어라인"
  ],
  "9ff26a44-1a56-4bd8-85f7-c598f7e5f283": [
    "사틴 무광"
  ],
  "ada3c42c-f4aa-4388-8d4d-ab01f86e0812": [],
  "916fd5d0-1fb0-4f71-89a7-7fef92630308": [
    "크롬"
  ],
  "48087652-f8be-4fdc-8ae2-e748acf20538": [
    "사틴 무광",
    "크롬"
  ],
  "978eb191-04cc-46b0-a009-4c2745bb151b": [
    "크롬"
  ],
  "f8faf75b-272f-40cc-9e8a-1f9f9f8cbe1d": [
    "그라파이트",
    "크롬",
    "사틴 헤어라인"
  ],
  "yuhiha-userpng-6e8403bf9de9bbe0144c": [
    "니켈",
    "크롬",
    "다크 그레이",
    "골드"
  ],
  "yuhiha-userpng-b26ebfda40183880a9eb": [
    "니켈"
  ],
  "basin-wall-faucet-5317": [
    "크롬",
    "브러쉬드 니켈",
    "브러쉬드 골드"
  ],
  "basin-wall-faucet-5310": [
    "크롬",
    "브러쉬드 니켈",
    "골드"
  ],
  "basin-wall-faucet-5503": [
    "블랙크롬",
    "니켈",
    "무광골드"
  ],
  "basin-wall-faucet-5506": [
    "블랙크롬",
    "크롬",
    "니켈",
    "무광골드",
    "블랙"
  ],
  "euroceramic-595": [
    "크롬"
  ]
};
const BASIN_FAUCET_BASE_FINISH={"80c0ab7f-e12f-4fef-964c-be329fe1fbdd": "니켈", "32c3a86c-1e80-4c7c-8ae6-eec5d8b13925": "니켈", "bath-source-1684288489": "니켈무광", "2a022693-9d0f-4651-9e38-e5ebff2965e3": "메트실버", "be2445f7-de3a-4137-a347-35f6b84dc6ce": "사틴 헤어라인", "59488e3b-5e4e-49d6-aada-6f610106c3c3": "사틴 헤어라인", "16c080ce-886f-4da1-a1e4-ba94d503d947": "사틴 무광", "ae4edcbf-30fc-42c8-a812-f2e7e4db86ca": "사틴 헤어라인", "9ff26a44-1a56-4bd8-85f7-c598f7e5f283": "사틴 무광", "916fd5d0-1fb0-4f71-89a7-7fef92630308": "크롬", "48087652-f8be-4fdc-8ae2-e748acf20538": "사틴 무광", "978eb191-04cc-46b0-a009-4c2745bb151b": "크롬", "f8faf75b-272f-40cc-9e8a-1f9f9f8cbe1d": "사틴 헤어라인", "yuhiha-userpng-6e8403bf9de9bbe0144c": "니켈", "yuhiha-userpng-b26ebfda40183880a9eb": "니켈", "basin-wall-faucet-5317": "크롬", "basin-wall-faucet-5310": "크롬", "basin-wall-faucet-5503": "니켈", "basin-wall-faucet-5506": "니켈", "euroceramic-595": "크롬"};
function basinFaucetColorMarkup(m,names=materialFinishOptions(m)){
  names=nickelFirst(names);
  if(!names.length)return '공식 색상 확인 중';
  const tones={'무광니켈':'#b8b5ac','매트실버':'#bfc1c2','스테인리스 스틸 피니시':'#bfc1c2','니켈크롬':'#aeb2b3','블랙니켈무광':'#55585a','매트그레이':'#77787b','옐로우':'#d6b84c','오렌지':'#d78447','그린':'#62806b','그레이':'#888b8b','브라운':'#816957','블루':'#54788e','밀크화이트':'#eeece3','화이트':'#efefeb','로얄블랙':'#252628','샴페인골드':'#cdbb97','크롬':'linear-gradient(135deg,#aaaeb1,#f5f6f7 45%,#b2b6b9 70%,#e7e9eb)','니켈':'#b8b5ac','건메탈':'#66686a','니켈무광':'#b8b5ac','블랙무광':'#303132','골드':'#c3aa71','메트실버':'#bfc1c2','메트그레이':'#77787b','사틴 헤어라인':'#bcb9af','사틴 무광':'#c1beb6','그라파이트':'#55585a','다크 그레이':'#55585a','브러시드 니켈':'#b8b5ac','브러쉬드 니켈':'#b8b5ac','브러시드 골드':'#bda773','브러쉬드 골드':'#bda773','블랙크롬':'linear-gradient(135deg,#343637,#777b7e,#303233)','무광골드':'#bba572','블랙':'#252628','매트 블랙':'#303132','매트 화이트':'#f1f0ec','브러시드 브론즈':'#b79b7e','브러시드 블랙 크롬':'#55585a'};
  return `<div aria-label="출시 색상" style="${m.cat==='휴지걸이'?'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 12px;width:100%;padding:4px':'display:flex;flex-wrap:nowrap;align-items:center;gap:8px 14px;width:100%;overflow-x:auto;padding:4px'}">${names.map(name=>`<button type="button" data-slidebar-color="${escapeHTML(name)}" aria-label="${escapeHTML(name)}" aria-pressed="false" style="background:transparent;border:0;text-align:left;color:inherit;font:inherit;cursor:pointer;display:grid;grid-template-columns:18px minmax(0,1fr);align-items:center;gap:8px;flex:0 0 auto;white-space:nowrap;min-width:0;min-height:36px;line-height:1.4"><span aria-hidden="true" style="width:18px;height:18px;border-radius:50%;border:1px solid #aaa;background:${tones[name]||'transparent'}"></span><span style="white-space:nowrap">${escapeHTML(name)}</span></button>`).join('')}</div><small data-finish-preview-note hidden style="display:none;margin-top:8px;color:var(--muted);line-height:1.5"></small>`;
}
// Shower finish options from the product-specific desktop finish tables. Chip colors are illustrative, not certified color values.
const SHOWER_FINISHES={"fe24e1cf-0e8d-444f-920a-67642ffa0c26": {"name": "대림바스_아르노 라운드", "colors": ["크롬", "니켈 무광", "건메탈"], "note": ""}, "4abf3647-d457-43b0-bf37-0eb8830fccb7": {"name": "대림바스_아르노 스퀘어", "colors": ["크롬", "니켈 무광", "건메탈"], "note": ""}, "f26a9f5d-77c3-478e-ab3d-d843ae3e0242": {"name": "대림바스_DL-B4111SN 샤워수전", "colors": ["니켈 무광"], "note": ""}, "bath-source-1766538698": {"name": "라우체_뉴코인 7078", "colors": ["니켈 무광"], "note": ""}, "bath-source-1713148071": {"name": "라우체_코인 7075", "colors": ["니켈 무광"], "note": ""}, "bath-source-1713146351": {"name": "라우체_코인 7115", "colors": ["니켈 무광"], "note": ""}, "02f61745-0871-4254-9199-763b85e6172f": {"name": "비반트_S-VAR600 MS 샤워수전", "colors": ["메트실버"], "note": "보관된 색상표에서 확인된 마감입니다. 다른 출시 색상은 추가 확인이 필요합니다."}, "yuhiha-userpng-13c7b15d37bc077ee49e": {"name": "비반트_XA600", "colors": ["메트실버", "샴페인골드", "메트그레이"], "note": "크롬은 공식 2024 카탈로그 등재 마감이며 현행 판매 여부는 미확인입니다."}, "3808f80f-7b82-4335-8328-0137075e7d7d": {"name": "아메리칸스탠다드_레이크 R", "colors": ["크롬", "사틴 헤어라인"], "note": ""}, "8d9833c1-c140-44d5-9deb-e3b118109d4f": {"name": "아메리칸스탠다드_레이크 S", "colors": ["크롬", "사틴 헤어라인"], "note": ""}, "yuhiha-product-ba3ff4e2994a0dd961f8": {"name": "아메리칸스탠다드_리비어 샤워욕조수전", "colors": ["크롬", "사틴 무광", "그라파이트"], "note": ""}, "71d4cadc-a1b4-4b94-8a12-88f1d6176d0a": {"name": "아메리칸스탠다드_매스", "colors": ["크롬", "사틴 헤어라인", "그라파이트"], "note": ""}, "yuhiha-product-3f9fc990a622c027db0a": {"name": "아메리칸스탠다드_제이드 샤워수전", "colors": ["크롬"], "note": ""}, "36437bd2-1b96-465e-ab13-fcda69c9f240": {"name": "아메리칸스탠다드_피노", "colors": ["크롬", "사틴 무광"], "note": ""}, "yuhiha-product-2196a8cac1355c8abfc9": {"name": "아메리칸스탠다드_호라이즌 샤워욕조수전", "colors": ["크롬", "사틴 헤어라인", "그라파이트"], "note": ""}, "518d9ead-d845-4537-bd83-d14f2d1295ff": {"name": "아메리칸스탠다드_미니말 R 2구·핸드샤워", "colors": ["사틴 헤어라인"], "note": "동일한 매립 조합에서 확인된 마감입니다. 다른 구성의 색상은 포함하지 않았습니다."}, "c2ed65e7-1c03-454f-90a9-9c39dc3fc4d9": {"name": "아메리칸스탠다드_미니말 R 3구·스파우트+핸드샤워", "colors": ["사틴 헤어라인"], "note": "동일한 매립 조합에서 확인된 마감입니다. 다른 구성의 색상은 포함하지 않았습니다."}, "7f8e8560-c987-46e6-833b-1e54aa2711f1": {"name": "아메리칸스탠다드_미니말 R 3구·핸드샤워+레인헤드", "colors": ["사틴 헤어라인"], "note": "동일한 매립 조합에서 확인된 마감입니다. 다른 구성의 색상은 포함하지 않았습니다."}, "3f11f202-57a1-426a-ae0e-f1c2494eaca6": {"name": "아메리칸스탠다드_플랫 3WAY 선반형 레인샤워", "colors": ["크롬"], "note": ""}, "yuhiha-userpng-8a3a5b042211dc977d7b": {"name": "에떼르노_E7-1005", "colors": ["크롬", "니켈 무광", "다크그레이", "무광 골드"], "note": ""}, "yuhiha-userpng-d2a8d3a628fc68732947": {"name": "에떼르노_R2-1005", "colors": ["니켈 무광"], "note": ""}, "yuhiha-userpng-6e95c9fe5037ded72fff": {"name": "필로토_GRAZIA302", "colors": ["니켈 무광"], "note": "니켈은 카탈로그 사본에서 확인했습니다. 공식 개별 페이지와 다른 색상은 미확인입니다."}, "yuhiha-userpng-d1e08d5924d4f2b38cc3": {"name": "필로토_VICTORIA301", "colors": ["크롬", "니켈 무광", "매트그레이", "골드", "무광 골드", "로즈 골드", "블랙빈티지"], "note": ""}, "bath-source-100724": {"name": "필로토_하프 벽매립욕조 1701", "colors": ["크롬", "니켈 무광", "블랙크롬"], "note": ""}, "bath-source-100726": {"name": "필로토_하프 벽매립해바라기 1702", "colors": ["크롬", "니켈 무광", "블랙크롬"], "note": ""}, "36d706f9-4e43-4c88-9461-8b901f52b7a0": {"name": "아메리칸스탠다드_피노 레인샤워", "colors": ["사틴 무광", "크롬"], "note": ""}, "0da0b81f-62bb-4ba3-84f3-20a92da379b4": {"name": "아메리칸스탠다드_코드 R 2WAY 레인샤워", "colors": ["사틴 무광"], "note": "공식 제품명·도면의 마감명 기준입니다. 공식 웹 색상란은 사틴 헤어라인으로 표기가 달라 확인이 필요합니다."}};
const SHOWER_FINISH_TONES={"크롬": "linear-gradient(135deg,#aaaeb1,#f5f6f7 45%,#b2b6b9 70%,#e7e9eb)", "사틴 헤어라인": "#d3d0c9", "그라파이트": "#4b4d4d", "사틴 무광": "#d1ccc4", "니켈 무광": "#d2d1cd", "매트그레이": "#686c6c", "골드": "#d5ae65", "무광 골드": "#c7aa76", "로즈 골드": "#c99785", "블랙빈티지": "#443d33", "샴페인 골드": "#cdbb97", "화이트": "#efefeb", "블랙크롬": "#3d4043", "다크그레이": "#4e5255", "건메탈": "#66686a", "메트실버": "#bfc1c2", "메트그레이": "#77787b", "샴페인골드": "#cdbb97"};
// Approved PNG finishes are distinct from the default selected finish.
const SHOWER_BASE_FINISH={"fe24e1cf-0e8d-444f-920a-67642ffa0c26": "니켈 무광", "4abf3647-d457-43b0-bf37-0eb8830fccb7": "니켈 무광", "f26a9f5d-77c3-478e-ab3d-d843ae3e0242": "니켈 무광", "bath-source-1766538698": "니켈 무광", "bath-source-1713148071": "니켈 무광", "bath-source-1713146351": "니켈 무광", "02f61745-0871-4254-9199-763b85e6172f": "메트실버", "yuhiha-userpng-13c7b15d37bc077ee49e": "메트실버", "3808f80f-7b82-4335-8328-0137075e7d7d": "사틴 헤어라인", "8d9833c1-c140-44d5-9deb-e3b118109d4f": "사틴 헤어라인", "yuhiha-product-ba3ff4e2994a0dd961f8": "사틴 무광", "71d4cadc-a1b4-4b94-8a12-88f1d6176d0a": "사틴 헤어라인", "yuhiha-product-3f9fc990a622c027db0a": "크롬", "36437bd2-1b96-465e-ab13-fcda69c9f240": "사틴 무광", "yuhiha-product-2196a8cac1355c8abfc9": "사틴 헤어라인", "518d9ead-d845-4537-bd83-d14f2d1295ff": "사틴 헤어라인", "c2ed65e7-1c03-454f-90a9-9c39dc3fc4d9": "사틴 헤어라인", "7f8e8560-c987-46e6-833b-1e54aa2711f1": "사틴 헤어라인", "3f11f202-57a1-426a-ae0e-f1c2494eaca6": "크롬", "yuhiha-userpng-8a3a5b042211dc977d7b": "니켈 무광", "yuhiha-userpng-d2a8d3a628fc68732947": "니켈 무광", "yuhiha-userpng-6e95c9fe5037ded72fff": "니켈 무광", "yuhiha-userpng-d1e08d5924d4f2b38cc3": "니켈 무광", "bath-source-100724": "니켈 무광", "bath-source-100726": "니켈 무광", "36d706f9-4e43-4c88-9461-8b901f52b7a0": "사틴 무광", "0da0b81f-62bb-4ba3-84f3-20a92da379b4": "사틴 무광"};
// Approximate finish previews, not manufacturer color photographs. Preserve alpha/geometry.
function showerFinishPalette(m,name){
 if(m.cat!=='샤워수전'||!materialFinishOptions(m).includes(name))return null;
 const hex=SHOWER_FINISH_TONES[name];
 if(name==='크롬'||name==='블랙크롬')return KITCHEN_FINISH_PALETTES[name];
 if(!/^#[0-9a-f]{6}$/i.test(hex||''))return null;
 const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
 return [.14,.36,.55,.72,.88,1,1.10,1.19,1.29].map(f=>rgb.map(v=>Math.min(250,Math.round(v*f))));
}
function showerColorMarkup(m){
 if(vivantMilkWhite(m))return basinFaucetColorMarkup(m,['밀크화이트']);
 const record=SHOWER_FINISHES[m.id];if(!record)return '색상 정보 확인 중';
 return `<div aria-label="샤워수전 출시 색상" style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;width:100%">${nickelFirst(record.colors).map(name=>`<button type="button" data-slidebar-color="${escapeHTML(name)}" aria-pressed="${name===defaultMaterialColor(m)}" style="background:transparent;color:inherit;cursor:pointer;display:inline-flex;align-items:center;gap:10px;min-height:40px;padding:8px 14px;border:1px solid var(--line,#d9d1c3);box-sizing:border-box;line-height:1.4;white-space:nowrap;font:inherit"><span aria-hidden="true" style="display:block;flex:0 0 18px;width:18px;height:18px;border-radius:50%;border:1px solid #aaa;background:${SHOWER_FINISH_TONES[name]||'transparent'}"></span><span>${escapeHTML(name)}</span></button>`).join('')}</div><small data-finish-preview-note hidden></small>${record.note?`<small style="display:block;margin-top:8px;color:var(--muted);font-size:11px;line-height:1.6">${escapeHTML(record.note)}</small>`:''}`;
}
// Cabinet variants preserve the photographed glass, hardware, wood and alpha.
function cabinetColorMarkup(m){
 const palettes={"소안바스":{"화이트":"#ffffff","핑크":"#e2c9c2","다크그레이":"#686560","다크그린":"#184a2f","네이비":"#0d3b5c","버건디":"#702633","블랙":"#211715","스카이블루":"#bfd2d6","바이올렛":"#806181","퍼플그레이":"#978690","씨블루":"#337985","에메랄드":"#559392","아이보리":"#e1d4c3","머스터드":"#caa25c","퍼플":"#803d5e","라이트그레이":"#a5a196","올리브":"#76623f","레드브라운":"#875d5f","세미브라운":"#8e7769","리빙코랄":"#ea6f5f","핫핑크":"#d53f62","브라운":"#755326","블루그린":"#3b6162","다크바이올렛":"#3f2643","옐로우":"#f49a20","오렌지":"#d3683a","다크핑크":"#cbafa4","핫퍼플":"#ab1f5c","베이지":"#b8a88e","다크블루그린":"#1f3437","레몬":"#e7deb5","코코아그레이":"#736a63","밀크코코아":"#cbbbab"},"히든바스":{"화이트":"#ffffff","블랙":"#231f20","크림":"#ded6c9","그레이":"#404447","다크블루":"#014769","내추럴":"#cb9f84","라이트우드":"#d9bda8","미스트그레이":"#d6cfc8","그레이쉬브라운":"#897b6d","아이보리":"#dcd9d1"}};
 const tones={"아이보리": "#dcd9d1", "카멜": "#ac8c69", "블루그린": "#3b6162", "코랄": "#cb645b", "코코아그레이": "#736a63", "화이트": "#ffffff", "블랙": "#231f20", "크림": "#ded6c9", "미스트그레이": "#d6cfc8", "그레이쉬브라운": "#897b6d", "핑크": "#e2c9c2", "다크그레이": "#686560", "다크그린": "#184a2f", "네이비": "#0d3b5c", "버건디": "#702633", "스카이블루": "#bfd2d6", "바이올렛": "#806181", "퍼플그레이": "#978690", "씨블루": "#337985", "에메랄드": "#559392", "머스터드": "#caa25c", "퍼플": "#803d5e", "라이트그레이": "#a5a196", "올리브": "#76623f", "레드브라운": "#875d5f", "세미브라운": "#8e7769", "리빙코랄": "#ea6f5f", "핫핑크": "#d53f62", "브라운": "#755326", "다크바이올렛": "#3f2643", "옐로우": "#f49a20", "오렌지": "#d3683a", "다크핑크": "#cbafa4", "핫퍼플": "#ab1f5c", "베이지": "#b8a88e", "다크블루그린": "#1f3437", "레몬": "#e7deb5", "밀크코코아": "#cbbbab", "그레이": "#404447", "다크블루": "#014769", "내추럴": "#cb9f84", "라이트우드": "#d9bda8"};
 const palette=palettes[m.brand]||{};
 return `<div aria-label="욕실장 판매 색상" style="display:grid!important;grid-template-columns:repeat(auto-fill,minmax(min(100%,145px),1fr));gap:8px;min-width:0;width:100%;max-width:100%">${Object.keys(m.colorImages||{}).map(name=>`<button type="button" data-slidebar-color="${escapeHTML(name)}" aria-label="${escapeHTML(name)}" aria-pressed="false" style="display:flex;align-items:center;gap:8px;width:100%!important;min-width:0;padding:8px;white-space:normal;text-align:left"><span aria-hidden="true" style="display:block;flex:0 0 18px;width:18px;height:18px;border:1px solid #aaa;border-radius:50%;background:${palette[name.replace(/\s/g,'')]||tones[name]||'#ddd'}"></span>${escapeHTML(name)}</button>`).join('')}</div>`;
}
function cabinetColorEditor(m){
 const box=document.createElement('div');box.id='cabinetColorEditor';
 box.innerHTML='<label>색상별 PNG <input id="cabinetColorFiles" type="file" accept="image/png" multiple></label><small>파일명 끝에 _색상명을 넣어 선택하세요. 첫 색상이 기본값이며 기존 색상 목록을 교체합니다.</small><p id="cabinetColorStatus"></p>';
 $('materialForm').append(box);
 $('cabinetColorStatus').textContent=Object.keys(m.colorImages||{}).join(' · ')||'등록된 색상 이미지 없음';
 $('cabinetColorFiles').onchange=async e=>{
  const files=[...e.target.files];if(!files.length)return;
  cabinetColorsBusy=true;const draft={};
  try{
   for(const file of files){
    const name=file.name.normalize('NFC').replace(/\.png$/i,'').split('_').pop().trim();
    if(!name||Object.hasOwn(draft,name)||file.type!=='image/png')throw Error('색상명 중복 또는 PNG 형식 오류');
    let image=await fileToImage(file);
    if(typeof uploadDataImage==='function')image=await uploadDataImage(image,m.id+'-cabinet-'+Object.keys(draft).length);
    draft[name]=image;
   }
   cabinetColorDraft=draft;$('cabinetColorStatus').textContent=Object.keys(draft).join(' · ')+' — 저장하면 적용됩니다.';
  }catch(error){$('cabinetColorStatus').textContent=error.message;}
  finally{cabinetColorsBusy=false;}
 };
}

function singleVerifiedFinish(m){
 if(!['욕조','하드웨어','싱크수전','청소건'].includes(m.cat))return '';
 if(m.cat==='싱크수전'&&m.confirmedFinishes?.length)return '';
 const model=String(m.model||'');
 if(m.brand==='제이리빙'&&/ · 화이트$/.test(model))return '화이트';
 if(m.brand==='도무스'&&/ \/ 니켈$/.test(model))return '니켈';
 if(m.brand==='비반트'&&/ MS$/.test(model))return '메트실버';
 return '';
}
function singleFinishMarkup(m){const finish=singleVerifiedFinish(m);if(!finish)return '';const color=finish==='화이트'?'#f4f4f1':'#b8b8b0';return '<dt>색상</dt><dd><span style="display:inline-flex;align-items:center;gap:10px"><span aria-hidden="true" style="display:inline-block;width:22px;height:22px;border:1px solid #aaa;border-radius:50%;background:'+color+'"></span>'+escapeHTML(finish)+'</span></dd>'}
function materialDetailMarkup(m){
  const rows=[['브랜드',displayBrandName(m)],['모델명',displayModel(m)]];
  if(isYounglimFilm(m)&&m.productName)rows.splice(1,0,['제품명',m.productName]);
  const base=rows.map(([label,value])=>`<dt>${label}</dt><dd>${escapeHTML(value||'미입력')}</dd>`).join('')+singleFinishMarkup(m);
  if(m.cat==='싱크수전'&&materialFinishOptions(m).length)return base+`<dt>색상</dt><dd style="min-width:0">${basinFaucetColorMarkup(m)}</dd>`;
  if(m.cat==='욕실장'&&Object.keys(m.colorImages||{}).length)return base+`<dt>색상</dt><dd style="min-width:0">${cabinetColorMarkup(m)}</dd>`;
  if(['환풍기','배수구'].includes(m.cat))return base+`<dt>규격</dt><dd>${escapeHTML(formatVentDrainSpec(m))}</dd>`;
  if(['수건걸이','휴지걸이'].includes(m.cat))return base+accessoryDetailMarkup(m);
  if(m.cat==='샤워수전'){const hasColorChips=vivantMilkWhite(m)||Boolean(SHOWER_FINISHES[m.id]?.colors?.length);return base+`<dt style="align-self:start;line-height:40px;padding-top:0">색상</dt><dd style="min-width:0">${showerColorMarkup(m)}</dd>`+(hasColorChips?'':`<dt style="align-self:start;line-height:1.65">규격</dt><dd style="min-width:0;line-height:1.65">${showerSpecMarkup(m)}</dd>`);}
  if(m.cat==='세면수전')return base+`<dt style="align-self:start;line-height:36px;padding-top:4px">색상</dt><dd>${basinFaucetColorMarkup(m)}</dd>`+(materialFinishOptions(m).length?'':`<dt>규격</dt><dd>${escapeHTML(integerDimensionText(faucetDimensionStyle(basinFaucetDimensions(m,true))))}</dd>`);
  return base+(m.cat==='슬라이드바'?`<dt>색상</dt><dd>${slidebarColorMarkup(m)}</dd>`:`<dt>규격</dt><dd>${escapeHTML(m.cat==='거울'?mirrorDimensionText(m):displayedDimensions(m,bathroomSpec(m))||'미입력')}</dd>`);
}
// Official catalog product-area luminance palettes; never change base geometry or alpha.
const TOWEL_FINISH_PALETTES={"TC04A": {"크롬": [[77, 79, 83], [121, 123, 129], [131, 134, 141], [148, 151, 160], [165, 166, 172], [191, 192, 196], [208, 210, 215], [225, 226, 230], [233, 237, 239]], "샴페인골드": [[85, 74, 48], [152, 136, 113], [190, 176, 151], [198, 184, 163], [206, 192, 168], [213, 200, 177], [226, 220, 207], [241, 235, 225], [251, 249, 232]], "화이트": [[111, 111, 111], [153, 153, 153], [178, 178, 176], [189, 189, 186], [202, 202, 201], [214, 214, 214], [222, 222, 222], [229, 229, 229], [236, 238, 230]], "메트그레이": [[30, 25, 17], [73, 68, 62], [99, 91, 85], [116, 110, 105], [131, 122, 115], [140, 134, 129], [178, 173, 170], [224, 221, 218], [241, 239, 234]], "로얄블랙": [[17, 16, 14], [30, 28, 26], [45, 42, 38], [56, 52, 48], [68, 62, 57], [73, 69, 64], [82, 78, 73], [126, 122, 117], [166, 163, 160]]}, "N01A": {"메트그레이": [[10, 10, 10], [32, 35, 35], [53, 54, 55], [86, 83, 83], [115, 111, 112], [144, 141, 143], [166, 166, 169], [212, 211, 211], [233, 237, 239]]}, "N01AA": {"메트그레이": [[5, 7, 8], [36, 40, 41], [54, 57, 58], [90, 88, 89], [130, 126, 127], [166, 162, 163], [204, 203, 203], [227, 227, 228], [235, 238, 240]]}, "N02A": {"메트그레이": [[63, 62, 64], [93, 93, 94], [115, 113, 113], [131, 131, 133], [139, 140, 143], [147, 149, 152], [165, 165, 167], [219, 218, 220], [233, 237, 240]]}, "FH1018": {"크롬": [[58, 56, 56], [71, 70, 69], [92, 90, 90], [141, 140, 139], [181, 179, 179], [205, 203, 203], [221, 219, 219], [230, 229, 229], [236, 235, 234]]}};
function towelFinishPalette(m,name){
 if(m.cat==='휴지걸이'){
  const model=accessoryFinish(m)?.model||'';
  // TC04 series shares the official Vivant finish swatches used for TC04A.
  if(/TC04B/.test(model))return TOWEL_FINISH_PALETTES.TC04A[name]||null;
  // ESH-100 official color-view photograph, product pixels only (Dark Gray).
  if(/ESH-100/.test(model)&&name==='다크 그레이')return [[49,48,44],[90,87,80],[110,107,100],[116,113,104],[135,131,120],[175,172,167],[188,187,183],[191,190,186],[203,202,200]];
  return null;
 }
 if(m.cat!=='수건걸이')return null;
 const model=accessoryFinish(m)?.model||'';
 const key=Object.keys(TOWEL_FINISH_PALETTES).find(k=>model===k||model.startsWith(k+'(')||model.startsWith(k+'-'));
 return TOWEL_FINISH_PALETTES[key]?.[name]||null;
}
function transferTowelFinish(base,palette){
 const src=finishHistogram(base),out=new Uint8ClampedArray(base);if(!src.total)return out;
 const stops=[0,.05,.15,.3,.5,.7,.85,.95,1],lut=[];let sum=0;
 for(let y=0;y<256;y++){
  const q=(sum+src.bins[y].n/2)/src.total;sum+=src.bins[y].n;
  let j=0;while(j<stops.length-2&&q>stops[j+1])j++;
  const t=Math.max(0,Math.min(1,(q-stops[j])/(stops[j+1]-stops[j])));
  lut[y]=palette[j].map((v,k)=>v+(palette[j+1][k]-v)*t);
 }
 for(let i=0;i<out.length;i+=4){if(!out[i+3])continue;const y=Math.round(.2126*base[i]+.7152*base[i+1]+.0722*base[i+2]);for(let k=0;k<3;k++)out[i+k]=lut[y][k]}
 return out;
}

// Official kitchen finish swatches guide tint previews; these are not certified material color values.
const KITCHEN_FINISH_PALETTES={"무광니켈":[[44,43,42],[79,78,76],[114,112,109],[144,142,138],[176,173,168],[185,183,178],[200,198,194],[219,218,216],[247,247,246]],"크롬":[[71,72,76],[90,91,97],[145,147,154],[178,180,186],[215,216,217],[252,253,253],[255,255,255],[255,255,255],[255,255,255]],"매트그레이":[[26,26,25],[47,46,45],[68,67,64],[86,84,81],[105,103,99],[123,121,118],[150,149,146],[188,187,185],[240,240,239]],"무광골드":[[50,43,27],[91,77,48],[131,112,70],[166,141,88],[202,172,107],[208,182,125],[218,197,151],[231,218,188],[250,247,240]],"옐로우":[[62,54,29],[112,96,52],[161,139,75],[203,175,94],[248,214,115],[249,219,132],[250,226,157],[252,237,192],[254,251,241]],"오렌지":[[64,42,29],[115,75,52],[166,108,75],[209,136,94],[255,166,115],[255,177,132],[255,193,157],[255,215,192],[255,246,241]],"그린":[[43,52,35],[77,93,63],[112,135,90],[141,170,114],[172,207,139],[182,213,153],[197,221,174],[218,233,203],[247,250,243]],"그레이":[[58,58,58],[104,105,104],[151,151,151],[190,191,190],[232,233,232],[235,236,235],[239,240,239],[245,245,245],[253,253,253]],"브라운":[[30,22,15],[53,39,27],[77,56,39],[97,71,49],[118,86,60],[134,106,83],[159,137,118],[193,179,167],[241,238,236]],"블루":[[20,26,38],[37,46,68],[53,66,98],[67,84,124],[82,102,151],[103,120,163],[134,148,182],[177,186,208],[238,240,245]],"니켈크롬":[[52,48,45],[65,60,56],[118,113,109],[144,141,138],[181,177,172],[240,240,240],[255,255,255],[255,255,255],[255,255,255]],"블랙크롬":[[4,4,4],[6,6,6],[21,21,21],[48,48,48],[126,126,126],[217,217,217],[247,247,247],[255,255,255],[255,255,255]],"니켈":[[55,54,54],[99,98,97],[142,141,140],[180,178,176],[219,217,215],[223,222,220],[230,228,227],[239,238,237],[251,251,251]],"블랙니켈무광":[[20,20,19],[36,36,35],[52,52,50],[66,66,64],[80,80,78],[101,101,99],[132,132,130],[176,176,175],[237,237,237]]};
const PILOTO_PHOTO_PALETTES={"396":{"무광니켈":[[38,35,32],[64,60,56],[85,81,76],[119,113,107],[159,152,143],[193,186,177],[219,212,202],[233,225,215],[238,236,233]],"크롬":[[0,0,0],[0,0,0],[16,16,16],[91,91,91],[160,160,160],[212,212,212],[237,237,237],[255,255,255],[255,255,255]],"매트그레이":[[26,25,24],[43,39,37],[56,53,50],[84,81,78],[116,111,107],[142,136,132],[155,150,146],[187,185,184],[236,236,236]],"무광골드":[[63,44,11],[92,67,22],[114,86,36],[151,123,66],[182,156,101],[204,181,130],[213,192,144],[229,216,184],[246,242,224]],"옐로우":[[140,116,17],[186,154,7],[196,164,13],[206,175,31],[219,190,72],[228,200,86],[236,209,99],[246,222,132],[245,243,231]],"오렌지":[[128,50,22],[179,73,31],[202,85,37],[211,98,53],[219,113,73],[226,124,88],[237,137,102],[247,168,138],[242,237,236]],"그린":[[5,102,7],[0,133,4],[0,142,18],[1,154,38],[41,177,69],[69,191,88],[85,204,101],[119,228,129],[235,243,236]],"그레이":[[105,105,105],[142,142,142],[157,157,157],[168,168,168],[181,181,181],[191,191,191],[200,200,200],[214,214,214],[236,236,236]],"브라운":[[23,11,8],[31,16,13],[35,20,17],[47,35,33],[62,50,48],[81,70,68],[94,84,83],[135,128,127],[238,237,237]],"블루":[[19,22,65],[28,31,78],[36,41,87],[50,54,99],[69,72,117],[89,91,132],[103,106,150],[145,147,183],[236,236,239]]},"397":{"블랙크롬":[[2,2,3],[9,9,11],[23,23,23],[80,76,76],[119,115,115],[144,139,140],[165,161,161],[192,190,191],[236,235,236]],"매트그레이":[[11,11,11],[23,22,22],[37,37,35],[71,69,68],[109,106,105],[130,127,127],[142,138,138],[157,153,153],[235,235,235]],"무광골드":[[52,41,8],[87,69,15],[117,97,39],[159,138,80],[206,183,122],[237,213,150],[248,226,160],[252,235,178],[253,244,189]]},"80988":{"니켈크롬":[[0,0,0],[0,0,0],[33,35,31],[105,105,95],[164,163,153],[214,213,206],[236,235,230],[243,242,237],[251,250,246]],"블랙크롬":[[4,4,4],[11,12,12],[16,17,17],[43,44,43],[75,75,74],[112,112,109],[137,136,133],[167,166,162],[230,230,230]],"크롬":[[3,3,4],[13,14,16],[40,42,42],[114,116,117],[163,165,166],[209,210,211],[233,234,233],[249,249,248],[254,254,254]],"니켈":[[23,23,19],[41,39,34],[68,65,55],[111,107,94],[155,151,137],[193,189,177],[215,211,200],[228,223,212],[238,236,231]]},"80109":{"니켈크롬":[[0,0,0],[13,13,13],[48,48,48],[132,132,132],[193,193,193],[227,227,227],[235,235,235],[239,239,239],[250,250,250]],"블랙크롬":[[0,0,0],[2,2,2],[28,28,28],[65,65,65],[95,95,95],[127,127,127],[146,146,146],[161,161,161],[234,234,234]],"크롬":[[1,1,1],[20,20,20],[84,84,84],[149,149,149],[198,198,198],[228,228,228],[234,234,234],[239,239,239],[247,247,247]],"니켈":[[13,12,11],[30,28,27],[66,64,62],[139,135,132],[191,188,184],[220,217,213],[228,224,221],[235,232,229],[243,241,239]]}};
function pilotoPhotoPalette(m,name){return m.cat==='싱크수전'&&m.brand==='필로토'?PILOTO_PHOTO_PALETTES[String(m.model)]?.[name]||null:null}
function kitchenFinishPalette(m,name){return m.cat==='싱크수전'&&materialFinishOptions(m).includes(name)?pilotoPhotoPalette(m,name)||KITCHEN_FINISH_PALETTES[name]||null:null}
function transferKitchenFinish(m,base,palette,width,height,name){
 return kitchenTintPixels(String(m.model),!!pilotoPhotoPalette(m,materialFinishOptions(m)[0]),base,palette,width,height,name);
}
// Pure pixel step (no material lookups) so the same code also runs in the background tint worker.
function kitchenTintPixels(model,piloto,base,palette,width,height,name){
 if(!piloto)return transferTowelFinish(base,palette);
 const sample=new Uint8ClampedArray(base),preserved=[],hose=new Uint8ClampedArray(base.length);
 for(let i=0;i<base.length;i+=4){const x=(i/4%width)/width,y=Math.floor(i/4/width)/height,l=.2126*base[i]+.7152*base[i+1]+.0722*base[i+2];
  const fixed=model==='80109'&&((y<(x<.5?.38:.39)&&l<95)||(x>.665&&x<.70&&y>.65&&y<.79&&l<90))||model==='80988'&&x>.335&&x<.714&&y>.846&&y<.879&&l<120;
  if(fixed){sample[i+3]=0;preserved.push(i);if(model==='80109'&&name==='크롬'&&y<(x<.5?.38:.39))for(let c=0;c<4;c++)hose[i+c]=base[i+c]}
 }
 const out=transferTowelFinish(sample,palette);for(const i of preserved)for(let c=0;c<4;c++)out[i+c]=base[i+c];
 if(model==='80109'&&name==='크롬'){const white=transferTowelFinish(hose,[[150,150,148],[174,174,172],[190,190,188],[205,205,203],[218,218,216],[229,229,227],[237,237,235],[244,244,242],[250,250,248]]);for(const i of preserved)if(hose[i+3])for(let c=0;c<3;c++)out[i+c]=white[i+c]}return out;
}
// Keep the approved base PNG geometry; reference variants supply colors only.
function usesBasePngTint(m){return ['수건걸이','휴지걸이','싱크수전','샤워수전'].includes(m.cat)||(m.cat==='세면수전'&&/폰타나|한스그로헤/.test(m.brand||m.name))}
const basePngTintCache=new Map();
function finishHistogram(data){
 const bins=Array.from({length:256},()=>({n:0,r:0,g:0,b:0}));let total=0;
 for(let i=0;i<data.length;i+=4){if(data[i+3]<128)continue;const y=Math.round(.2126*data[i]+.7152*data[i+1]+.0722*data[i+2]),v=bins[y];v.n++;v.r+=data[i];v.g+=data[i+1];v.b+=data[i+2];total++}
 return {bins,total};
}
function transferFinishPixels(base,reference){
 const src=finishHistogram(base),ref=finishHistogram(reference);if(!src.total||!ref.total)throw Error('색상 보정에 필요한 제품 영역이 없습니다.');
 const palette=[];let sum=0;
 for(const v of ref.bins){if(!v.n)continue;palette.push({q:(sum+v.n/2)/ref.total,c:[v.r/v.n,v.g/v.n,v.b/v.n]});sum+=v.n}
 const lut=[];sum=0;let j=0;
 for(let y=0;y<256;y++){const q=(sum+src.bins[y].n/2)/src.total;sum+=src.bins[y].n;while(j<palette.length-1&&palette[j+1].q<q)j++;const a=palette[j],b=palette[Math.min(j+1,palette.length-1)],t=b.q>a.q?Math.max(0,Math.min(1,(q-a.q)/(b.q-a.q))):0;lut[y]=a.c.map((v,k)=>v+(b.c[k]-v)*t)}
 const out=new Uint8ClampedArray(base);
 for(let i=0;i<out.length;i+=4){if(!out[i+3])continue;const y=Math.round(.2126*base[i]+.7152*base[i+1]+.0722*base[i+2]);for(let k=0;k<3;k++)out[i+k]=lut[y][k]}
 return out;
}
// Finish tints: same pixel functions, but run in a background worker so the page never freezes,
// and the finished PNG is kept in IndexedDB (server image keys never change, so results stay valid).
const TINT_CACHE_VERSION='tint-v1';let tintDbPromise=null,tintWorkerRef=null,tintJobSeq=0;const tintJobs=new Map();
function tintDb(){if(tintDbPromise)return tintDbPromise;tintDbPromise=new Promise(res=>{try{if(typeof indexedDB==='undefined')return res(null);const r=indexedDB.open('yuhiha-tint-cache',1);r.onupgradeneeded=()=>r.result.createObjectStore('tints');r.onsuccess=()=>res(r.result);r.onerror=()=>res(null);r.onblocked=()=>res(null)}catch{res(null)}});return tintDbPromise}
async function tintCacheGet(key){if(!key)return null;const db=await tintDb();if(!db)return null;return new Promise(res=>{try{const q=db.transaction('tints').objectStore('tints').get(key);q.onsuccess=()=>res(typeof q.result==='string'?q.result:null);q.onerror=()=>res(null)}catch{res(null)}})}
async function tintCachePut(key,value){if(!key||!value)return;const db=await tintDb();if(!db)return;try{db.transaction('tints','readwrite').objectStore('tints').put(value,key)}catch{}}
function tintPersistKey(...parts){if(!boundsStoreKey(parts[0]))return '';if(parts.some(p=>typeof p==='string'&&p.startsWith('data:')))return '';return TINT_CACHE_VERSION+'|'+parts.map(p=>typeof p==='string'?p:JSON.stringify(p)).join('|')}
function tintWorker(){
 if(tintWorkerRef!==null)return tintWorkerRef;
 try{
  if(typeof Worker==='undefined'||typeof OffscreenCanvas==='undefined'||typeof createImageBitmap==='undefined'||typeof Blob==='undefined')return tintWorkerRef=false;
  const body=`self.onmessage=async e=>{const {id,mode,base,ref,palette,model,piloto,name}=e.data;try{const c=new OffscreenCanvas(base.width,base.height),x=c.getContext('2d',{willReadFrequently:true});x.drawImage(base,0,0);base.close();const p=x.getImageData(0,0,c.width,c.height);let out;if(mode==='palette')out=kitchenTintPixels(model,piloto,p.data,palette,c.width,c.height,name);else{const rc=new OffscreenCanvas(ref.width,ref.height),rx=rc.getContext('2d',{willReadFrequently:true});rx.drawImage(ref,0,0);ref.close();out=transferFinishPixels(p.data,rx.getImageData(0,0,rc.width,rc.height).data)}p.data.set(out);x.putImageData(p,0,0);self.postMessage({id,blob:await c.convertToBlob({type:'image/png'})})}catch(err){self.postMessage({id,error:String(err&&err.message||err)})}};`;
  const src=[finishHistogram,transferTowelFinish,transferFinishPixels,kitchenTintPixels].map(f=>f.toString()).join('\n')+'\n'+body;
  const w=new Worker(URL.createObjectURL(new Blob([src],{type:'text/javascript'})));
  w.onmessage=e=>{const job=tintJobs.get(e.data.id);if(!job)return;tintJobs.delete(e.data.id);if(e.data.error)job.reject(Error(e.data.error));else job.resolve(e.data.blob)};
  w.onerror=()=>{for(const job of tintJobs.values())job.reject(Error('worker'));tintJobs.clear();tintWorkerRef=false};
  return tintWorkerRef=w;
 }catch{return tintWorkerRef=false}
}
function blobToDataUrl(blob){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.readAsDataURL(blob)})}
// Returns the tinted PNG as a data URL, or null when the worker is unavailable (caller then tints on the page).
async function tintInWorker(job,baseImg,refImg){
 const w=tintWorker();if(!w)return null;
 try{
  const base=await createImageBitmap(baseImg),ref=refImg?await createImageBitmap(refImg):undefined,id=++tintJobSeq;
  const blob=await new Promise((resolve,reject)=>{tintJobs.set(id,{resolve,reject});w.postMessage({id,...job,base,ref},ref?[base,ref]:[base])});
  return await blobToDataUrl(blob);
 }catch(e){if(/색상 보정|제품 영역/.test(e.message||''))throw e;return null}
}
async function basePngFinish(m,name){
 if(['휴지걸이','샤워수전'].includes(m.cat)&&m.colorImages?.[name])return m.colorImages[name];
 if(name===baseMaterialColor(m))return m.image;
 const palette=showerFinishPalette(m,name)||kitchenFinishPalette(m,name)||fontanaAddedPalette(m,name)||towelFinishPalette(m,name);
 if(palette){
  const key=m.image+'|towel|'+name+'|'+JSON.stringify(palette);if(basePngTintCache.has(key))return basePngTintCache.get(key);
  const model=String(m.model),piloto=!!pilotoPhotoPalette(m,materialFinishOptions(m)[0]),persist=tintPersistKey(m.image,'palette',model,piloto,name,palette);
  const task=(async()=>{const stored=await tintCacheGet(persist);if(stored)return stored;const base=await imageOf(m.image);
  const fromWorker=await tintInWorker({mode:'palette',palette,model,piloto,name},base);if(fromWorker){tintCachePut(persist,fromWorker);return fromWorker}
  const c=document.createElement('canvas');c.width=base.naturalWidth;c.height=base.naturalHeight;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(base,0,0);const p=ctx.getImageData(0,0,c.width,c.height);p.data.set(transferKitchenFinish(m,p.data,palette,c.width,c.height,name));ctx.putImageData(p,0,0);const url=c.toDataURL('image/png');tintCachePut(persist,url);return url})();
  basePngTintCache.set(key,task);try{return await task}catch(e){basePngTintCache.delete(key);throw e}
 }
 const reference=m.colorImages?.[name];if(!reference)throw Error('이 색상의 보정 기준 이미지가 없습니다.');
 const key=m.image+'|'+reference;if(basePngTintCache.has(key))return basePngTintCache.get(key);
 const persist=tintPersistKey(m.image,'reference',reference);
 const task=(async()=>{const stored=await tintCacheGet(persist);if(stored)return stored;const [base,ref]=await Promise.all([imageOf(m.image),imageOf(reference)]);
 const fromWorker=await tintInWorker({mode:'reference'},base,ref);if(fromWorker){tintCachePut(persist,fromWorker);return fromWorker}
 const canvas=document.createElement('canvas');canvas.width=base.naturalWidth;canvas.height=base.naturalHeight;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(base,0,0);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
 const rc=document.createElement('canvas');rc.width=ref.naturalWidth;rc.height=ref.naturalHeight;const rx=rc.getContext('2d',{willReadFrequently:true});rx.drawImage(ref,0,0);
 pixels.data.set(transferFinishPixels(pixels.data,rx.getImageData(0,0,rc.width,rc.height).data));ctx.putImageData(pixels,0,0);const url=canvas.toDataURL('image/png');tintCachePut(persist,url);return url;})();
 basePngTintCache.set(key,task);try{return await task}catch(e){basePngTintCache.delete(key);throw e}
}
function bindSlidebarPreview(m){
  if(!['슬라이드바','세면수전','수건걸이','휴지걸이','욕실장','싱크수전','샤워수전'].includes(m.cat)&&!vivantMilkWhite(m))return;
  const host=$('detailContent'),img=host.querySelector('.detail-image'),addButton=host.querySelector('[data-add]');
  const buttons=[...host.querySelectorAll('[data-slidebar-color]')];
  const original=baseMaterialColor(m);
  let request=0;
  async function select(button){
    const ticket=++request;
    const name=button.dataset.slidebarColor,variant=m.colorImages?.[name],towelPalette=showerFinishPalette(m,name)||kitchenFinishPalette(m,name)||fontanaAddedPalette(m,name)||towelFinishPalette(m,name);
    for(const item of buttons){const active=item===button;item.setAttribute('aria-pressed',String(active));item.firstElementChild.style.outline=active?'1px solid currentColor':'none';item.firstElementChild.style.outlineOffset='3px'}
    img.style.filter='none';img.style.visibility='visible';img.style.background='';
    img.src=usesBasePngTint(m)?m.image:(variant||m.image);img.alt=m.name+' · '+(variant||name===original?name:original||'대표')+' 정면 이미지';
    addButton.dataset.color=name;addButton.textContent='＋ 셀렉션에 담기';addButton.setAttribute('aria-label',name+' 색상 셀렉션에 담기');addButton.classList.remove('added');addButton.setAttribute('aria-pressed','false');
    delete addButton.dataset.colorImage;addButton.disabled=false;
    const previewNote=host.querySelector('[data-finish-preview-note]');if(previewNote){const pending=!variant&&!towelPalette&&name!==original;previewNote.hidden=!pending;previewNote.style.display=pending?'block':'none';previewNote.textContent=pending?'해당 색상 이미지 준비 중 · 대표 이미지 표시':'';if(m.cat==='샤워수전'&&name!==original&&!variant&&towelPalette){previewNote.hidden=false;previewNote.style.display='block';previewNote.textContent='색상 참고용 보정 이미지 · 실제 마감과 차이가 있을 수 있습니다.'}}
    if(usesBasePngTint(m)&&(variant||towelPalette||name===original)){
      addButton.disabled=true;img.setAttribute('aria-busy','true');
      try{const result=await basePngFinish(m,name);if(ticket!==request)return;img.src=result;img.alt=m.name+' · '+name+' 색상 보정 이미지';addButton.dataset.colorImage=result;addButton.disabled=false}
      catch(e){if(ticket!==request)return;toast('색상 보정을 완료하지 못했어요. '+e.message)}
      finally{if(ticket===request)img.removeAttribute('aria-busy')}
    }
  }
  for(const button of buttons)button.onclick=()=>select(button);
  const initial=buttons.find(b=>b.dataset.slidebarColor===defaultMaterialColor(m))||buttons[0];if(initial)select(initial);
}
function detail(id){const m=material(id);$('detailContent').innerHTML=`<div class="dialog-head"><div><h2>${escapeHTML(m.name)}</h2></div><button class="close icon-btn" aria-label="닫기">×</button></div><img class="detail-image" src="${m.image}" alt="${escapeHTML(m.name)}"><dl class="detail-data">${materialDetailMarkup(m)}</dl><div class="detail-bottom" style="display:flex;align-items:flex-end;justify-content:space-between;gap:20px;flex-wrap:wrap;margin-top:24px"><div class="detail-footer" style="flex:1 1 280px;min-width:0;text-align:left">${m.url?`<a class="source-link" style="margin:0;justify-self:start" href="${escapeHTML(m.url)}" target="_blank" rel="noopener noreferrer">제품 상세 페이지 ↗</a>`:''}<p class="detail-disclaimer">본 화면은 실제 제품과 다소 차이가 있을 수 있으니 반드시 상담 후 선택 부탁드립니다.</p></div><div class="detail-actions" style="margin:0;flex:0 0 auto">${!m.sample?`<button data-edit="${m.id}">정보 수정</button>`:''}<button class="dark" data-add="${m.id}">＋ 셀렉션에 담기</button></div></div>`;bindSlidebarPreview(m);$('detailDialog').showModal();alignHolderDetail(m)}
function fileToImage(file){return new Promise((resolve,reject)=>{if(!['image/jpeg','image/png','image/webp'].includes(file.type))return reject(Error('JPG, PNG, WebP 이미지를 선택해 주세요.'));if(file.size>20*1024*1024)return reject(Error('이미지는 20MB 이하로 올려주세요.'));const url=URL.createObjectURL(file),img=new Image();img.onload=()=>{try{const ratio=Math.min(1,1400/Math.max(img.width,img.height));const c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*ratio));c.height=Math.max(1,Math.round(img.height*ratio));const x=c.getContext('2d'),keepAlpha=file.type==='image/png';if(!keepAlpha){x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height)}x.drawImage(img,0,0,c.width,c.height);resolve(keepAlpha?c.toDataURL('image/png'):c.toDataURL('image/jpeg',.9))}catch(e){reject(e)}finally{URL.revokeObjectURL(url)}};img.onerror=()=>{URL.revokeObjectURL(url);reject(Error('이미지를 읽을 수 없습니다. 다른 파일을 선택해 주세요.'))};img.src=url})}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000)}
async function imageOf(url){return new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(Error('이미지를 읽을 수 없습니다.'));i.src=url})}
function canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle='#f7f6f2';x.fillRect(0,0,w,h);return [c,x]}
function text(x,v,px,py,size=24,color='#20211f',weight=400){x.fillStyle=color;x.font=`${weight} ${size}px Pretendard, "Malgun Gothic", sans-serif`;x.fillText(v,px,py)}
function wrap(x,str,px,py,width,size=22,line=32,maxLines=3){x.font=`${size}px Pretendard, "Malgun Gothic", sans-serif`;x.fillStyle='#62665b';let current='',row=0;for(const ch of String(str||'')){if(x.measureText(current+ch).width>width||ch==='\n'){x.fillText(current,px,py+row*line);row++;current='';if(row>=maxLines){return py+row*line}}if(ch!=='\n')current+=ch}if(current)x.fillText(current,px,py+row++*line);return py+row*line}
function materialImageMode(m){return /상판/.test(m?.cat||'')?'cover':'contain'}
function drawImageFit(x,img,px,py,w,h,mode='contain',background='#eeeee7'){
  x.fillStyle=background;x.fillRect(px,py,w,h);
  if(mode==='cover'){
    const scale=Math.max(w/img.width,h/img.height),sw=w/scale,sh=h/scale;
    x.drawImage(img,(img.width-sw)/2,(img.height-sh)/2,sw,sh,px,py,w,h);
  }else{const scale=Math.min(w/img.width,h/img.height);x.drawImage(img,px+(w-img.width*scale)/2,py+(h-img.height*scale)/2,img.width*scale,img.height*scale)}
}
async function cardPNG(p,item,index){const m=selectionMaterial(item),[c,x]=canvas(1200,1600);x.drawImage(await imageOf('assets/logo-yuhiha.png'),65,20,195,80);text(x,'MATERIAL SELECTION',775,83,18);x.strokeStyle='#d8dcd0';x.beginPath();x.moveTo(65,113);x.lineTo(1135,113);x.stroke();text(x,`${String(index+1).padStart(2,'0')} / ${m.cat}`,65,171,23);text(x,m.sample?'EXAMPLE · 실제 제품 아님':item.status,875,171,18);drawImageFit(x,await imageOf(m.image),65,210,1070,820,materialImageMode(m));wrap(x,m.name,65,1103,1070,44,54,2);text(x,[m.brand,m.model].filter(Boolean).join(' / ')||'제품 정보 미입력',65,1220,23);wrap(x,bathroomSpec(m),65,1265,1070,22,32,2);wrap(x,`${item.room} · ${item.status}${item.note?' / '+item.note:''}`,65,1355,1070,24,35,3);text(x,p.name,65,1516,25);text(x,'공간 유희하',970,1516,20);return c}
async function boardCanvases(p){const pages=[];for(let start=0;start<p.items.length;start+=12){const subset=p.items.slice(start,start+12),rows=Math.ceil(subset.length/3),[c,x]=canvas(1800,380+rows*535);x.drawImage(await imageOf('assets/logo-yuhiha.png'),65,20,170,70);text(x,'THE MATERIAL EDIT',1200,80,22);wrap(x,p.name,65,165,1660,46,56,2);text(x,[p.customer,p.date,`${p.items.length} MATERIALS`,`${Math.floor(start/12)+1} / ${Math.ceil(p.items.length/12)}`].filter(Boolean).join('   /   '),65,265,20);for(let j=0;j<subset.length;j++){const item=subset[j],m=selectionMaterial(item),px=65+(j%3)*560,py=310+Math.floor(j/3)*535;drawImageFit(x,await imageOf(m.image),px,py,510,330,materialImageMode(m));text(x,`${String(start+j+1).padStart(2,'0')} / ${m.cat}${m.sample?' · 예시':''}`,px,py+361,18);wrap(x,m.name,px,py+400,510,27,33,1);wrap(x,[m.brand,m.model,item.room,item.status].filter(Boolean).join(' · '),px,py+434,510,17,22,2);wrap(x,item.note||'',px,py+485,510,17,23,2)}text(x,'공간 유희하 — SELECT WITH INTENTION.',65,c.height-25,16);pages.push(c)}return pages}
const pngBlob=c=>new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(Error('PNG 생성 실패')),'image/png'));
// Standards-compliant, uncompressed ZIP. UTF-8 names, CRC32, no external library.
const crcTable=Array.from({length:256},(_,i)=>{let c=i;for(let j=0;j<8;j++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0});
function crc32(a){let c=0xffffffff;for(const b of a)c=crcTable[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0}
async function zipFiles(files){const parts=[],central=[];let offset=0;const enc=new TextEncoder();for(const file of files){const name=enc.encode(file.name),data=new Uint8Array(await file.blob.arrayBuffer()),crc=crc32(data),local=new Uint8Array(30+name.length),l=new DataView(local.buffer);l.setUint32(0,0x04034b50,true);l.setUint16(4,20,true);l.setUint16(6,0x800,true);l.setUint32(14,crc,true);l.setUint32(18,data.length,true);l.setUint32(22,data.length,true);l.setUint16(26,name.length,true);local.set(name,30);parts.push(local,data);const cen=new Uint8Array(46+name.length),v=new DataView(cen.buffer);v.setUint32(0,0x02014b50,true);v.setUint16(4,20,true);v.setUint16(6,20,true);v.setUint16(8,0x800,true);v.setUint32(16,crc,true);v.setUint32(20,data.length,true);v.setUint32(24,data.length,true);v.setUint16(28,name.length,true);v.setUint32(42,offset,true);cen.set(name,46);central.push(cen);offset+=local.length+data.length}const end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,files.length,true);v.setUint16(10,files.length,true);v.setUint32(12,central.reduce((n,c)=>n+c.length,0),true);v.setUint32(16,offset,true);return new Blob([...parts,...central,end],{type:'application/zip'})}
let exporting=false;
async function exportPackage(){await exportFontsReady();if(exporting||!project().items.length)return;exporting=true;const p=structuredClone(project()),button=$('exportBtn');button.disabled=true;$('boardExportBtn').disabled=true;try{const files=[],metadata={project:p.name,customer:p.customer,date:p.date,notes:p.note,exportedAt:new Date().toISOString(),materials:[]};for(let n=0;n<p.items.length;n++){button.textContent=`PNG 준비 중 ${n+1} / ${p.items.length}`;const item=p.items[n],m=selectionMaterial(item),base=`${String(n+1).padStart(2,'0')}_${safeName(m.cat)}_${safeName(m.name)}`;files.push({name:`01_개별자재/${base}.png`,blob:await pngBlob(await cardPNG(p,item,n))});const imageResponse=await fetch(m.image);if(!imageResponse.ok)throw Error('제품 이미지를 불러오지 못했습니다.');const imageBlob=await imageResponse.blob(),imageExtension=({'image/png':'png','image/webp':'webp'})[imageBlob.type.split(';')[0]]||'jpg',imageFile=`03_제품이미지/${base}.${imageExtension}`;files.push({name:imageFile,blob:imageBlob});const {image,...info}=m;metadata.materials.push({...info,...item,cardFile:`01_개별자재/${base}.png`,imageFile})}const boards=await boardCanvases(p);for(let i=0;i<boards.length;i++)files.push({name:`02_전체보드/셀렉션_${String(i+1).padStart(2,'0')}.png`,blob:await pngBlob(boards[i])});files.push({name:'제품정보.json',blob:new Blob([JSON.stringify(metadata,null,2)],{type:'application/json'})});files.push({name:'읽어주세요.txt',blob:new Blob(['YUHIHA MATERIAL ROOM\n\n01: 자재별 제안서 카드 PNG\n02: 전체 셀렉션 보드 PNG (12개씩 페이지 분리)\n03: 웹용 제품 이미지 (PNG 투명도와 저장 형식 유지)\n제품정보.json: 브랜드, 모델, 규격, 제품 링크, 적용 공간, 상태, 메모\n\nEXAMPLE 표시는 실제 판매 제품이 아닌 예시입니다.\n화면 색상은 실물과 다를 수 있으니 최종 결정은 제조사 견본을 확인하세요.\n이 ZIP을 제안서 제작 담당자 또는 이 대화에 전달하세요.'],{type:'text/plain;charset=utf-8'})});download(await zipFiles(files),`${safeName(p.name)}_유희하_셀렉션.zip`);toast('PNG 패키지를 다운로드했어요. ZIP을 제안서 작업에 전달하세요.')}catch(e){toast('내보내기에 실패했어요. '+e.message)}finally{exporting=false;button.innerHTML='PNG 패키지 내보내기 <span>↗</span>';button.disabled=!project().items.length;$('boardExportBtn').disabled=false}}
async function showBoard(){await exportFontsReady();if(!project().items.length)return;$('boardPreview').textContent='보드를 준비하고 있어요…';$('boardDialog').showModal();try{$('boardPreview').replaceChildren(...await boardCanvases(structuredClone(project())))}catch(e){$('boardPreview').textContent='이미지를 불러오지 못했습니다. '+e.message}}
function validBackup(data){
  if(!data||typeof data!=='object')throw Error('유희하 백업 파일이 아닙니다.');
  data=migrateCategories(data);
  if(data?.version!==1||!Array.isArray(data.materials)||!Array.isArray(data.deletedMaterials)||!Array.isArray(data.projects)||!Array.isArray(data.favorites))throw Error('유희하 백업 파일이 아닙니다.');
  const ids=new Set(samples.map(m=>m.id));
  for(const m of [...data.materials,...data.deletedMaterials]){
    if(typeof m.id!=='string'||ids.has(m.id)||!allCats().includes(m.cat)||typeof m.name!=='string'||!m.name.trim()||typeof m.image!=='string'||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(m.image)||m.image.length>12000000)throw Error('자재 정보 형식이 올바르지 않습니다.');
    for(const k of ['brand','model','spec','note','url'])if(typeof m[k]!=='string')throw Error('제품 정보 누락');
    m.brand=canonicalBrand(m.brand);normalizeMaterialName(m);
    if(m.url&&!/^https?:\/\//i.test(m.url))throw Error('제품 링크 형식 오류');ids.add(m.id);
  }
  if(data.deletedProjects===undefined)data.deletedProjects=[];
  if(!Array.isArray(data.deletedProjects))throw Error('삭제한 프로젝트 형식 오류');
  const pids=new Set();
  for(const p of [...data.projects,...data.deletedProjects]){if(typeof p.id!=='string'||pids.has(p.id)||typeof p.name!=='string'||!Array.isArray(p.items)||p.items.length>500)throw Error('프로젝트 형식 오류');pids.add(p.id);for(const i of p.items)if(!ids.has(i.materialId)||typeof i.id!=='string'||!ROOMS.includes(i.room)||!['후보','확정','보류'].includes(i.status)||typeof i.note!=='string')throw Error('셀렉션 정보 형식 오류')}
  for(const p of [...data.projects,...data.deletedProjects])for(const i of p.items)if(i.application!==undefined&&(typeof i.application!=='string'||i.application.length>80))throw Error('적용부위는 80자 이내로 입력해 주세요.');
  if(!data.projects.some(p=>p.id===data.active))data.active=data.projects[0]?.id||'';return data;
}
// Keep filter controls in place when the catalog gets shorter or is replaced.
let catalogScrollFrame=0,catalogAnchorStyle;
function updateCatalogView(update){
 const x=window.scrollX,y=window.scrollY,root=document.documentElement,library=$('catalog').closest('.library');
 if(catalogScrollFrame)cancelAnimationFrame(catalogScrollFrame);else catalogAnchorStyle=root.style.overflowAnchor;
 const active=document.activeElement;
 const key=['group','cat','brand','series'].find(key=>active?.dataset?.[key]!==undefined),value=key?active.dataset[key]:null;
 root.style.overflowAnchor='none';
 if(library){
  const rect=library.getBoundingClientRect(),scale=rect.height/library.offsetHeight||1;
  // CSS zoom changes the rendered height; retain enough space below the current viewport.
  const required=Math.max(window.innerHeight,window.innerHeight-rect.top);
  library.style.minHeight=Math.ceil((required+2)/scale)+'px';
 }
 update();
 if(key){const replacement=[...document.querySelectorAll('[data-'+key+']')].find(node=>node.dataset[key]===value);replacement?.focus({preventScroll:true})}
 void root.offsetHeight;
 window.scrollTo({left:x,top:y,behavior:'instant'});
 catalogScrollFrame=requestAnimationFrame(()=>{window.scrollTo({left:x,top:y,behavior:'instant'});root.style.overflowAnchor=catalogAnchorStyle;catalogScrollFrame=0});
}
document.addEventListener('click',e=>{const b=e.target.closest('button');if(b?.classList.contains('close')){b.closest('dialog').close();return}if(b?.dataset.groupMove){const [from,delta]=b.dataset.groupMove.split(':').map(Number),to=from+delta;if(to>=0&&to<GROUPS.length){[GROUPS[from],GROUPS[to]]=[GROUPS[to],GROUPS[from]];group=to;state.groups=structuredClone(GROUPS);save();render();renderCategoryManager()}return}if(b?.dataset.catMove){const [gi,from,delta]=b.dataset.catMove.split(':').map(Number),cats=GROUPS[gi].cats,to=from+delta;if(to>=0&&to<cats.length){[cats[from],cats[to]]=[cats[to],cats[from]];state.groups=structuredClone(GROUPS);save();render();renderCategoryManager()}return}if(b?.dataset.removeCat){const cat=b.dataset.removeCat;let fallback=GROUPS.flatMap(g=>g.cats).find(c=>c!==cat)||'미분류';const owner=GROUPS.find(g=>g.cats.includes(cat));owner.cats=owner.cats.filter(c=>c!==cat);GROUPS=GROUPS.filter(g=>g.cats.length);if(!GROUPS.length){GROUPS=[{name:'기타',cats:['미분류']}];fallback='미분류'}for(const m of state.materials)if(m.cat===cat)m.cat=fallback;state.groups=structuredClone(GROUPS);group=Math.min(group,GROUPS.length-1);subcategory='전체';save();render();renderCategoryManager();toast('품목을 삭제하고 연결된 자재를 '+fallback+'로 옮겼어요.');return}if(b?.dataset.group!==undefined){updateCatalogView(()=>{group=Number(b.dataset.group);subcategory='전체';brand='전체';series='전체';query='';$('search').value='';renderGroups();renderCatalog();});return}if(b?.dataset.brand!==undefined){updateCatalogView(()=>{brand=b.dataset.brand;series='전체';renderBrandChips();renderCatalog();});return}if(b?.dataset.series!==undefined){updateCatalogView(()=>{series=b.dataset.series;renderBrandChips();renderCatalog();});return}if(b?.dataset.cat){updateCatalogView(()=>{subcategory=b.dataset.cat;brand='전체';series='전체';renderGroups();renderCatalog();});return}if(b?.dataset.add){add(b.dataset.add,b.dataset.color??defaultMaterialColor(material(b.dataset.add)),b.dataset.colorImage||'');return}if(b?.dataset.fav){e.preventDefault();toggleFavorite(b.dataset.fav);return}if(b?.dataset.remove){removeSelectionItem(b.dataset.remove);return}if(b?.dataset.edit){$('detailDialog').close();openMaterial(b.dataset.edit);return}if(b?.dataset.mobile){document.querySelectorAll('[data-mobile]').forEach(t=>t.classList.toggle('active',t===b));document.querySelector('.library').classList.toggle('mobile-hide',b.dataset.mobile==='selection');document.querySelector('.selection').classList.toggle('mobile-show',b.dataset.mobile==='selection');return}const d=e.target.closest('[data-detail]');if(d)detail(d.dataset.detail)});
document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-detail]')){e.preventDefault();detail(e.target.dataset.detail)}});
document.addEventListener('click',e=>{if(e.target.closest('a[href="#libraryStart"]')){filter='all';$('catalogFilter').value='all';renderCatalog()}});
$('search').addEventListener('input',e=>{updateCatalogView(()=>{query=e.target.value.trim();renderBrandChips();renderCatalog()});});$('brandFilter').onchange=e=>{updateCatalogView(()=>{brand=e.target.value;series='전체';renderBrandChips();renderCatalog()});};$('catalogFilter').onchange=e=>{updateCatalogView(()=>{filter=e.target.value;renderCatalog()});};$('projectSelect').onchange=e=>{if(!e.target.value)return;persistConsultationDraft();consultationDraft=null;state.active=e.target.value;consultationLoadedId=null;persistConsultationDraft();save();renderCatalog();renderSelection()};$('newMaterialBtn').onclick=()=>openMaterial();$('manageCategoriesBtn').onclick=openCategories;$('siteEditBtn').onclick=openSiteSettings;$('emptyAdd').onclick=()=>openMaterial();$('newProjectBtn').onclick=()=>openProject(true);$('editProjectBtn').onclick=()=>openProject();$('helpBtn').onclick=()=>$('helpDialog').showModal();$('finishListBtn').onclick=showFinishList;$('finishListDialog').addEventListener('close',()=>{finishPreviewToken++;clearFinishPreview()});
$('selectedItems').addEventListener('input',e=>{const key=e.target.dataset.field;if(!key)return;const i=project().items.find(i=>i.id===e.target.closest('[data-item]').dataset.item);i[key]=e.target.value;saveSelection()});
$('imageFile').onchange=async e=>{if(!e.target.files[0])return;$('formError').textContent='이미지를 준비하고 있어요…';try{imageDraft=await fileToImage(e.target.files[0]);$('imagePreview').src=imageDraft;$('imagePreview').hidden=false;$('uploadHint').hidden=true;$('formError').textContent=''}catch(err){$('formError').textContent=err.message}};
$('materialForm').onsubmit=e=>{e.preventDefault();if(cabinetColorsBusy){$('formError').textContent='색상 이미지 준비가 끝날 때까지 기다려 주세요.';return;}$('materialBrand').value=canonicalBrand($('materialBrand').value);if(!imageDraft){$('formError').textContent='제품 이미지를 올려주세요.';return}const name=$('materialName').value.trim(),url=$('materialUrl').value.trim();if(!name){$('formError').textContent='자재명을 입력해 주세요.';return}if(url&&!/^https?:\/\//i.test(url)){$('formError').textContent='제품 링크는 http 또는 https 주소를 입력해 주세요.';return}const id=$('materialId').value||uid(),m={id,name,cat:$('materialCat').value,brand:$('materialBrand').value.trim(),model:$('materialModel').value.trim(),spec:$('materialSpec').value.trim(),url,note:$('materialNote').value.trim(),image:imageDraft,sample:false};if(material(id)?.productName)m.productName=material(id).productName;normalizeMaterialName(m);if(material(id)?.colorImages)m.colorImages=structuredClone(material(id).colorImages);if(['욕실장','휴지걸이'].includes(m.cat)&&cabinetColorDraft)m.colorImages=structuredClone(cabinetColorDraft);state.materials=state.materials.filter(x=>x.id!==id);state.materials.unshift(m);group=GROUPS.findIndex(g=>g.cats.includes(m.cat));subcategory=m.cat;query='';filter='all';$('search').value='';$('catalogFilter').value='all';save();render();$('materialDialog').close();toast('자재를 저장했어요.')};
$('projectForm').addEventListener('input',e=>{const key=consultationFields[e.target.id];if(!key)return;const p=project();p[key]=e.target.value;if(key==='customer')p.name=p.customer.trim()?p.customer.trim()+' 고객님 상담':'새 상담';syncConsultationHeadings(p);$('projectMeta').textContent=[p.customer||'새로운 공간을 위한 기록',p.date].filter(Boolean).join(' · ');const activeOption=$('projectSelect').selectedOptions[0];if(activeOption)activeOption.textContent=consultationHeading(p);if(consultationDraft){persistConsultationDraft();setSaveStatus('작성 중 · 프로젝트 만들기를 눌러 주세요');const option=$('projectSelect').querySelector('option[value=""]');if(option)option.textContent=consultationHeading(p)}else save();});
$('projectForm').onsubmit=async e=>{e.preventDefault();const p=project();for(const [id,key] of Object.entries(consultationFields))p[key]=$(id).value.trim();if(!p.customer){$('customerName').focus();return}p.name=p.customer+' 고객님 상담';p.date=p.date||todaySeoul();if(consultationDraft){state.projects.unshift(p);state.active=p.id;consultationDraft=null;persistConsultationDraft()}consultationLoadedId=null;await save();render();showProjectDetail();toast('상담 프로젝트를 저장했어요.')};
$('closeConsultationBtn').onclick=()=>{document.body.classList.add('consultation-closed');document.body.classList.remove('consultation-open')};
$('projectDetailBtn').onclick=showProjectDetail;
let exportFromProject=false;$('detailExportBtn').onclick=()=>{exportFromProject=true;$('projectDetailDialog').close();showFinishList()};$('finishListDialog').addEventListener('close',()=>{if(exportFromProject){exportFromProject=false;showProjectDetail()}});
$('projectListBackBtn').onclick=()=>{$('projectDetailDialog').close();showCustomerProjects()};

$('categoryForm').onsubmit=e=>{e.preventDefault();const groupName=$('categoryGroup').value.trim(),catName=$('categoryName').value.trim();if(!groupName||!catName){$('categoryError').textContent='대분류와 세부 품목 이름을 모두 입력해 주세요.';return}if(groupName.length>30||catName.length>40){$('categoryError').textContent='카테고리 이름이 너무 깁니다.';return}if(allCats().includes(catName)){$('categoryError').textContent='이미 있는 세부 품목입니다.';return}let target=GROUPS.find(g=>g.name===groupName);if(!target){if(GROUPS.length>=20){$('categoryError').textContent='대분류는 20개까지 만들 수 있어요.';return}target={name:groupName,cats:[]};GROUPS.push(target)}target.cats.push(catName);state.groups=structuredClone(GROUPS);group=GROUPS.indexOf(target);subcategory=catName;save();render();renderCategoryManager();$('categoryForm').reset();$('categoryError').textContent='';toast('새 카테고리를 모두에게 추가했어요.')};
$('siteSettingsForm').onsubmit=e=>{e.preventDefault();state.settings=applySettings({settings:{...state.settings,title:$('siteTitle').value.trim()||DEFAULT_SETTINGS.title,subtitle:$('siteSubtitle').value.trim()||DEFAULT_SETTINGS.subtitle,columns:Number($('siteColumns').value),sort:$('siteSort').value,brandSize:$('siteBrandSize').value,brandSpacing:$('siteBrandSpacing').value,titleFont:$('siteTitleFont').value,titleSize:$('siteTitleSize').value,titleMobileSize:$('siteTitleMobileSize').value,titleWeight:$('siteTitleWeight').value,titleSpacing:$('siteTitleSpacing').value,titleGap:$('siteTitleGap').value,steps:[1,2,3].map(i=>$('siteStep'+i).value.trim()||DEFAULT_SETTINGS.steps[i-1])}}).settings;save();render();$('siteSettingsDialog').close();toast('사이트 구성과 글자 스타일을 모두에게 반영했어요.')};
$('backupBtn').onclick=()=>{download(new Blob([JSON.stringify(state)],{type:'application/json'}),`YUHIHA_전체백업_${new Date().toISOString().slice(0,10)}.json`);toast('자재와 모든 상담 프로젝트를 백업했어요.')};$('restoreBtn').onclick=()=>$('restoreFile').click();$('restoreFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>150*1024*1024)throw Error('150MB 이하 파일을 선택해 주세요.');const data=validBackup(JSON.parse(await f.text()));if(!confirm(`백업의 프로젝트 ${data.projects.length}개와 자재 ${data.materials.length}개로 현재 자료를 교체합니다. 현재 자료를 백업하셨나요?`))return;state=data;await save();render();toast('백업을 불러왔어요.')}catch(err){toast(err.message||'백업을 읽을 수 없습니다.')}finally{e.target.value=''}};
async function init(){makeSamples();try{db=await initDB();const previous=await readDB();if(previous){state=validBackup(previous);await save()}}catch(e){toast('저장된 자료를 읽지 못했습니다. 백업 파일을 확인해 주세요.');setSaveStatus('저장 연결 확인 필요')}if(!state.projects.length)state.active='';restoreConsultationDraft();render();$('year').textContent=new Date().getFullYear();if(db)setSaveStatus('● 이 기기에 저장됨')}
// Room-based finish schedule. Existing card exports and live records are untouched.
const FINISH_COLS=[160,270,210,500,340,400,280];
const FINISH_HEADS=['공간','품목 / 적용부위','브랜드','제품명 · 모델','규격','자재 사진','비고'];
const FINISH_W=2400,FINISH_H=1697,FINISH_LEFT=120,FINISH_START=410,FINISH_BOTTOM=1490;
// White paper; all other graphic colors come from reference-design.css.
const FINISH_PALETTE={paper:'#ffffff',band:'#f1eee5',ink:'#292621',muted:'#979082',line:'#d9d1c3',accent:'#a84425'};
let finishPreviewToken=0,finishPreviewUrls=[],finishExporting=false;
function finishRows(p,lookup=material){
  const rows=p.items.map(i=>{const m=selectionMaterial(i,lookup),room=['벽지','마루'].includes(m?.cat)?'공용':(i.room||'미지정');return {room:room,image:m?.image||'',imageMode:materialImageMode(m),cells:[room,[m?.cat||'품목 미입력',i.application||''].filter(Boolean).join('\n'),m?.brand||'—',[(m?.name||'제품 정보 없음').replace(/_/g,' '),m?.model&&!String(m?.name||'').includes(m.model)?m.model:'',m?.sample?'예시 제품':''].filter(Boolean).join('\n'),m?.spec||'—','',[i.status||'',i.note||''].filter(Boolean).join('\n')]}});
  // Stable within each room; unassigned entries remain visible at the end.
  const order=['공용',...ROOMS.filter(r=>r!=='미지정'),'미지정'];
  return rows.map((r,index)=>({...r,index})).sort((a,b)=>{const ai=order.indexOf(a.room),bi=order.indexOf(b.room);return (ai<0?order.length:ai)-(bi<0?order.length:bi)||a.index-b.index});
}
function finishLines(x,value,width,size=28){
  x.font=`${size}px Pretendard, "Malgun Gothic", sans-serif`;const lines=[];
  for(const paragraph of String(value??'').split('\n')){let line='';for(const char of paragraph){if(line&&x.measureText(line+char).width>width){lines.push(line);line=''}line+=char}lines.push(line)}
  return lines;
}
// The original seven-column finish schedule, with restrained editorial typography.
function finishLayout(rows,x){
  const pages=[];let page=[],y=FINISH_START,lastRoom=null;
  for(const row of rows){
    const fontSize=25,lineHeight=35;
    const lines=row.cells.map((v,i)=>i===5?[]:finishLines(x,v,FINISH_COLS[i]-40,i===4?22:fontSize));
    const height=Math.max(174,...lines.map(a=>a.length*lineHeight+44));
    if(height>FINISH_BOTTOM-FINISH_START)throw Error('한 자재의 설명이 너무 길어요. 상담 메모를 나누거나 줄여 주세요.');
    if(page.length&&y+height>FINISH_BOTTOM){pages.push(page);page=[];y=FINISH_START;lastRoom=null}
    page.push({...row,lines,height,fontSize,lineHeight,y,band:0,showRoom:row.room!==lastRoom});y+=height;lastRoom=row.room;
  }
  if(page.length)pages.push(page);return pages;
}
function finishRule(x,left,top,width,color=FINISH_PALETTE.line,weight=1){x.fillStyle=color;x.fillRect(left,top,width,weight)}
function finishImage(x,img,left,top,width,height,mode='contain'){drawImageFit(x,img,left,top,width,height,mode,FINISH_PALETTE.paper)}
async function* finishCanvases(p){
  const rows=finishRows(p),measure=document.createElement('canvas').getContext('2d'),pages=finishLayout(rows,measure);
  let logo=null;try{logo=await imageOf('assets/logo-yuhiha.png')}catch{}
  for(let n=0;n<pages.length;n++){
    const [c,x]=canvas(FINISH_W,FINISH_H);x.fillStyle=FINISH_PALETTE.paper;x.fillRect(0,0,FINISH_W,FINISH_H);
    if(logo)x.drawImage(logo,FINISH_LEFT,72,200,82);
    text(x,'FINISH SCHEDULE',1940,122,22,FINISH_PALETTE.muted);
    text(x,'공간별 마감재 리스트',FINISH_LEFT,246,62,FINISH_PALETTE.accent,600);
    const customer=String(p.customer||'').trim();
    const meta=[customer?(/고객님$/.test(customer)?customer:customer+' 고객님'):'고객명 미입력',p.date,'자재 '+rows.length+'개'].filter(Boolean).join('   /   ');
    text(x,meta,FINISH_LEFT,316,27,FINISH_PALETTE.muted);
    x.fillStyle=FINISH_PALETTE.band;x.fillRect(FINISH_LEFT,356,2160,54);
    let hx=FINISH_LEFT;FINISH_HEADS.forEach((h,i)=>{text(x,h,hx+20,390,23,FINISH_PALETTE.ink,600);hx+=FINISH_COLS[i]});
    for(const row of pages[n]){
      let left=FINISH_LEFT;
      // A subtle room column replaces bright blocks and repeated labels.
      x.fillStyle=FINISH_PALETTE.paper;x.fillRect(left,row.y,FINISH_COLS[0],row.height);
      for(let col=0;col<7;col++){
        const width=FINISH_COLS[col];
        if(col===5){try{finishImage(x,await imageOf(row.image),left+20,row.y+18,width-40,row.height-36,row.imageMode)}catch{text(x,'이미지 확인 필요',left+20,row.y+55,21,FINISH_PALETTE.muted)}}
        else if(col!==0||row.showRoom){row.lines[col].forEach((v,j)=>{
          const primary=col===0||col===3||(col===1&&j===0)||(col===6&&j===0);
          text(x,v,left+20,row.y+43+j*row.lineHeight,col===4?22:row.fontSize,FINISH_PALETTE.ink,primary?500:400);
        })}
        left+=width;
      }
      finishRule(x,FINISH_LEFT+FINISH_COLS[0],row.y+row.height,2160-FINISH_COLS[0]);
      if(row.showRoom&&row.y!==FINISH_START)finishRule(x,FINISH_LEFT,row.y,2160);
    }
    const bottom=pages[n].at(-1);if(bottom){finishRule(x,FINISH_LEFT,bottom.y+bottom.height,2160);let edge=FINISH_LEFT;finishRule(x,edge,356,1,FINISH_PALETTE.line,bottom.y+bottom.height-356);for(const width of FINISH_COLS){edge+=width;finishRule(x,edge,356,1,FINISH_PALETTE.line,bottom.y+bottom.height-356)}}
    text(x,'본 화면은 실제 제품과 다소 차이가 있을 수 있으니 반드시 상담 후 선택 부탁드립니다.',FINISH_LEFT,1593,21,FINISH_PALETTE.muted);
    text(x,'YUHIHA  /  MATERIAL LIBRARY',FINISH_LEFT,1635,18,FINISH_PALETTE.muted);
    text(x,String(n+1).padStart(2,'0')+'  /  '+String(pages.length).padStart(2,'0'),2160,1635,21,FINISH_PALETTE.muted);
    yield c;
  }
}
function clearFinishPreview(){for(const url of finishPreviewUrls)URL.revokeObjectURL(url);finishPreviewUrls=[];$('finishListPreview').replaceChildren()}
async function showFinishList(){
  if(!project().items.length)return;const token=++finishPreviewToken,p=structuredClone(project());clearFinishPreview();
  $('finishListTitle').textContent='마감재 내보내기 · '+consultationHeading(p);$('finishListStatus').textContent='이미지와 자재 정보를 준비하고 있어요…';$('materialDownloadBtn').disabled=true;$('materialExportFormat').disabled=true;
  if(!$('finishListDialog').open)$('finishListDialog').showModal();
  try{await exportFontsReady();let index=0;for await(const c of finishCanvases(p)){if(token!==finishPreviewToken)return;const url=URL.createObjectURL(await pngBlob(c));if(token!==finishPreviewToken){URL.revokeObjectURL(url);return}finishPreviewUrls.push(url);const img=document.createElement('img');img.src=url;img.alt=`${p.name} 마감재 리스트 ${++index}쪽`;img.className='finish-sheet';$('finishListPreview').append(img);await img.decode().catch(()=>{})}
    if(token!==finishPreviewToken)return;$('finishListStatus').textContent=`${p.items.length}개 자재 · ${index}쪽 · 적용부위는 담은 자재에서 입력할 수 있어요.`;$('materialDownloadBtn').disabled=false;$('materialExportFormat').disabled=false;
  }catch(e){if(token===finishPreviewToken)$('finishListStatus').textContent='리스트 준비에 실패했어요. '+e.message}
}
async function exportFinishList(){
  if(finishExporting||!project().items.length)return;finishExporting=true;const button=$('materialDownloadBtn'),p=structuredClone(project());button.disabled=true;
  try{await exportFontsReady();const files=[];let i=0;for await(const c of finishCanvases(p)){button.textContent=`리스트 PNG 준비 중 ${++i}`;files.push({name:`마감재리스트_${String(i).padStart(2,'0')}.png`,blob:await pngBlob(c)})}
    download(await zipFiles(files),`${safeName(p.name)}_마감재리스트.zip`);toast('공간별 마감재 리스트 PNG를 다운로드했어요.');
  }catch(e){toast('리스트 내보내기에 실패했어요. '+e.message)}finally{finishExporting=false;button.disabled=false;button.textContent='다운로드 ↗'}
}

// A4 landscape PDF, built locally from the same paginated sheets as PNG/print.
// JPEG image streams avoid external libraries, network uploads and font fallbacks.
async function finishPDF(p,onPage=()=>{}){
  const chunks=[],offsets=[0],pageIds=[],encode=s=>new TextEncoder().encode(s);let length=0,nextId=3;
  const append=part=>{chunks.push(part);length+=part.size??part.byteLength};
  const object=(id,body)=>{offsets[id]=length;append(encode(`${id} 0 obj\n${body}\nendobj\n`))};
  append(encode('%PDF-1.4\n'));
  let index=0;
  for await(const c of finishCanvases(p)){
    onPage(++index);const jpeg=await new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(Error('PDF 이미지를 만들지 못했어요.')),'image/jpeg',0.96));
    const pageId=nextId++,imageId=nextId++,contentId=nextId++;pageIds.push(pageId);
    offsets[imageId]=length;append(encode(`${imageId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${c.width} /Height ${c.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.size} >>\nstream\n`));append(jpeg);append(encode('\nendstream\nendobj\n'));
    const content=encode('q\n841.89 0 0 595.28 0 0 cm\n/Sheet Do\nQ\n');
    offsets[contentId]=length;append(encode(`${contentId} 0 obj\n<< /Length ${content.byteLength} >>\nstream\n`));append(content);append(encode('endstream\nendobj\n'));
    object(pageId,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 841.89 595.28] /Resources << /XObject << /Sheet ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`);
  }
  if(!pageIds.length)throw Error('내보낼 자재가 없어요.');
  object(1,'<< /Type /Catalog /Pages 2 0 R >>');object(2,`<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map(id=>id+' 0 R').join(' ')}] >>`);
  const start=length;append(encode(`xref\n0 ${nextId}\n0000000000 65535 f \n${offsets.slice(1).map(offset=>String(offset).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size ${nextId} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`));
  return new Blob(chunks,{type:'application/pdf'});
}
async function exportFinishPDF(){
  if(finishExporting||!project()?.items.length)return;finishExporting=true;const button=$('materialDownloadBtn'),p=structuredClone(project());button.disabled=true;
  try{await exportFontsReady();const pdf=await finishPDF(p,n=>button.textContent=`PDF 준비 중 ${n}쪽`);download(pdf,`${safeName(p.customer||p.name)}_공간별_마감재리스트.pdf`);toast('공간별 마감재 리스트 PDF를 다운로드했어요.')}
  catch(e){toast('PDF 내보내기에 실패했어요. '+e.message)}finally{finishExporting=false;button.disabled=!project()?.items.length;button.textContent='다운로드 ↗'}
}


let finishPptxLibrary=null;
function loadFinishPptxLibrary(){
  if(typeof globalThis.PptxGenJS==='function')return Promise.resolve(globalThis.PptxGenJS);
  if(finishPptxLibrary)return finishPptxLibrary;
  finishPptxLibrary=new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src='assets/vendor/pptxgenjs-4.0.1.bundle.js';
    script.onload=()=>typeof globalThis.PptxGenJS==='function'?resolve(globalThis.PptxGenJS):reject(Error('PPTX 도구를 불러오지 못했어요.'));
    script.onerror=()=>{script.remove();reject(Error('PPTX 도구를 불러오지 못했어요. 다시 시도해 주세요.'))};document.head.append(script);
  }).catch(error=>{finishPptxLibrary=null;throw error});return finishPptxLibrary;
}
async function finishPPTX(p,onPage=()=>{}){
  const Pptx=await loadFinishPptxLibrary(),pptx=new Pptx();
  const unit=11.6929133858/FINISH_W,U=value=>value*unit,pt=value=>U(value)*72,C=key=>FINISH_PALETTE[key].slice(1);
  pptx.defineLayout({name:'YUHIHA_A4',width:U(FINISH_W),height:U(FINISH_H)});pptx.layout='YUHIHA_A4';
  pptx.author='YUHIHA';pptx.subject='공간별 마감재 리스트';pptx.title=(p.customer||p.name)+' · 공간별 마감재 리스트';pptx.lang='ko-KR';
  pptx.theme={headFontFace:'Pretendard',bodyFontFace:'Pretendard',lang:'ko-KR'};
  const measure=document.createElement('canvas').getContext('2d'),rows=finishRows(p),pages=finishLayout(rows,measure),images=new Map();
  async function imageData(url){
    if(!images.has(url))images.set(url,(async()=>{const img=await imageOf(url),c=document.createElement('canvas');c.width=img.width;c.height=img.height;c.getContext('2d').drawImage(img,0,0);return {data:c.toDataURL('image/png'),width:img.width,height:img.height}})());
    return images.get(url);
  }
  const customer=String(p.customer||'').trim(),meta=[customer?(/고객님$/.test(customer)?customer:customer+' 고객님'):'고객명 미입력',p.date,'자재 '+rows.length+'개'].filter(Boolean).join('   /   ');
  for(let n=0;n<pages.length;n++){
    onPage(n+1);const slide=pptx.addSlide();slide.background={color:C('paper')};
    const addText=(value,left,baseline,width,size,color,bold=false)=>slide.addText(value,{x:U(left),y:U(baseline-size),w:U(width),h:U(size*1.7),fontFace:'Pretendard',fontSize:pt(size),color:C(color),bold,margin:0,breakLine:false,valign:'mid',fit:'resize'});
    try{const img=await imageData('assets/logo-yuhiha.png');slide.addImage({data:img.data,x:U(FINISH_LEFT),y:U(72),w:U(img.width),h:U(img.height),sizing:{type:'contain',w:U(200),h:U(82)}})}catch{}
    addText('FINISH SCHEDULE',1940,122,340,22,'muted');addText('공간별 마감재 리스트',FINISH_LEFT,246,1700,62,'accent',true);addText(meta,FINISH_LEFT,316,2160,27,'muted');
    const tableRows=[FINISH_HEADS.map(text=>({text,options:{fill:C('band'),bold:true,fontSize:pt(23)}})),...pages[n].map(row=>row.lines.map((lines,col)=>({text:col===5?'':col===0&&!row.showRoom?'':lines.join('\n'),options:{bold:col===0||col===3,fontSize:pt(col===4?22:25),fill:C('paper')}})))];
    slide.addTable(tableRows,{x:U(FINISH_LEFT),y:U(356),w:U(2160),colW:FINISH_COLS.map(U),rowH:[U(54),...pages[n].map(r=>U(r.height))],fontFace:'Pretendard',fontSize:pt(25),color:C('ink'),fill:C('paper'),border:{type:'solid',color:C('line'),pt:0.4},margin:[U(13),U(20),U(8),U(20)],valign:'top',align:'left',paraSpaceAfterPt:0,autoPage:false,verbose:false});
    for(const row of pages[n]){
      const left=FINISH_LEFT+FINISH_COLS.slice(0,5).reduce((a,b)=>a+b,0)+20,top=row.y+18,width=FINISH_COLS[5]-40,height=row.height-36;
      try{const img=await imageData(row.image);slide.addImage({data:img.data,x:U(left),y:U(top),w:U(img.width),h:U(img.height),sizing:{type:row.imageMode==='cover'?'cover':'contain',w:U(width),h:U(height)},altText:row.cells[3]})}catch{addText('이미지 확인 필요',left,top+36,width,21,'muted')}
    }
    addText('본 화면은 실제 제품과 다소 차이가 있을 수 있으니 반드시 상담 후 선택 부탁드립니다.',FINISH_LEFT,1593,2160,21,'muted');addText('YUHIHA  /  MATERIAL LIBRARY',FINISH_LEFT,1635,1900,18,'muted');addText(String(n+1).padStart(2,'0')+'  /  '+String(pages.length).padStart(2,'0'),2160,1635,150,21,'muted');
    slide.addNotes('제품 정보와 표는 편집 가능한 PowerPoint 개체입니다. 자재 사진은 원본 이미지를 포함합니다. 화면 색상은 실물과 다를 수 있으니 견본을 확인하세요.');
  }
  if(!pages.length)throw Error('내보낼 자재가 없어요.');
  return pptx.write({outputType:'blob',compression:true});
}
async function exportFinishPPTX(){
  if(finishExporting||!project()?.items.length)return;finishExporting=true;const button=$('materialDownloadBtn'),p=structuredClone(project());button.disabled=true;button.textContent='PPTX 도구 준비 중…';
  try{await exportFontsReady();const blob=await finishPPTX(p,n=>button.textContent=`PPTX 준비 중 ${n}쪽`);download(blob,`${safeName(p.customer||p.name)}_공간별_마감재리스트.pptx`);toast('편집 가능한 마감재 리스트 PPTX를 다운로드했어요.')}
  catch(e){toast('PPTX 내보내기에 실패했어요. '+e.message)}finally{finishExporting=false;button.disabled=!project()?.items.length;button.textContent='다운로드 ↗'}
}
async function exportFinishAll(){
  if(finishExporting||!project()?.items.length)return;finishExporting=true;
  const button=$('materialDownloadBtn'),p=structuredClone(project()),base=safeName(p.customer||p.name)+'_공간별_마감재리스트';button.disabled=true;
  try{
    await exportFontsReady();const files=[];let page=0;
    for await(const c of finishCanvases(p)){button.textContent=`PNG 준비 중 ${++page}쪽`;files.push({name:`PNG/${base}_${String(page).padStart(2,'0')}.png`,blob:await pngBlob(c)})}
    const pdf=await finishPDF(p,n=>button.textContent=`PDF 준비 중 ${n}쪽`);files.push({name:base+'.pdf',blob:pdf});
    const pptx=await finishPPTX(p,n=>button.textContent=`PPTX 준비 중 ${n}쪽`);files.push({name:base+'.pptx',blob:pptx});
    button.textContent='전체 파일 압축 중…';download(await zipFiles(files),base+'_전체.zip');toast('PNG·PDF·PPTX 전체 파일을 ZIP으로 다운로드했어요.');
  }catch(e){toast('전체 내보내기에 실패했어요. '+e.message)}
  finally{finishExporting=false;button.disabled=!project()?.items.length;button.textContent='다운로드 ↗'}
}
$('materialDownloadBtn').onclick=async()=>{
  if(finishExporting)return;const select=$('materialExportFormat'),format=select.value;select.disabled=true;
  try{if(format==='all')await exportFinishAll();else if(format==='pptx')await exportFinishPPTX();else if(format==='png')await exportFinishList();else await exportFinishPDF()}
  finally{select.disabled=false}
};


function restoreConsultationDraft(){try{const saved=JSON.parse(sessionStorage.getItem('yuhiha-review-draft')||'null');if(saved&&typeof saved.id==='string'&&Array.isArray(saved.items)&&typeof saved.customer==='string'){saved.items=saved.items.filter(i=>selectionMaterial(i));consultationDraft=saved;return}}catch{}consultationDraft=newConsultationDraft()}
let boardPngExporting=false;
async function exportBoardPNG(){if(boardPngExporting||!project()?.items.length)return;boardPngExporting=true;const p=structuredClone(project());try{await exportFontsReady();const pages=await boardCanvases(p);for(let i=0;i<pages.length;i++)download(await pngBlob(pages[i]),`${safeName(consultationHeading(p))}_자재보드_${i+1}.png`);toast('자재 보드 PNG를 저장했어요.')}catch(e){toast('PNG를 만들지 못했어요. '+e.message)}finally{boardPngExporting=false}}

init();
