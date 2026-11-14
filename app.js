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
let state={version:1,materials:[],deletedMaterials:[],projects:[],deletedProjects:[],active:'',favorites:[],groups:structuredClone(DEFAULT_GROUPS),settings:structuredClone(DEFAULT_SETTINGS)},db,group=0,subcategory='전체',brand='전체',series='전체',query='',filter='all',imageDraft='',saveChain=Promise.resolve(),toastTimer;
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
function project(){return consultationDraft||state.projects.find(p=>p.id===state.active)}
async function initDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open('yuhiha-material-review-only',1);r.onupgradeneeded=()=>r.result.createObjectStore('data');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function readDB(){return new Promise((resolve,reject)=>{const r=db.transaction('data').objectStore('data').get('state');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
function save(){const snapshot=structuredClone(state);setSaveStatus('저장 중…');saveChain=saveChain.catch(()=>{}).then(()=>new Promise((resolve,reject)=>{if(!db){reject(Error('Storage unavailable'));return}const tx=db.transaction('data','readwrite');tx.objectStore('data').put(snapshot,'state');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})).then(()=>{setSaveStatus('● 이 기기에 저장됨')}).catch(()=>{setSaveStatus('저장 실패 · 백업 필요');toast('브라우저 저장 공간을 확인해 주세요. 백업으로 현재 자료를 보관할 수 있습니다.')});return saveChain}
function renderGroups(){if($('categoryNumber'))$('categoryNumber').textContent=String(group+1).padStart(2,'0');$('groups').innerHTML=GROUPS.map((g,i)=>`<button class="${group===i?'active':''}" data-group="${i}" aria-pressed="${group===i}"><span class="group-no">0${i+1}</span>${g.name}</button>`).join('');$('subcats').innerHTML=['전체',...GROUPS[group].cats].map(c=>`<button class="${subcategory===c?'active':''}" data-cat="${c}" aria-pressed="${subcategory===c}">${c}</button>`).join('');renderBrandChips()}
const BRAND_CATS=['벽지','마루'],BRAND_SERIES={'벽지|LX Z:IN':['디아망','베스트']};
function brandOf(m){return m.brand||'브랜드 미입력'}
function brandActive(){return BRAND_CATS.includes(subcategory)&&!query}
function seriesList(){return brandActive()&&brand!=='전체'?BRAND_SERIES[subcategory+'|'+brand]||null:null}
function seriesOf(m,list){return list.find(n=>String(m.name).includes(n))||'기타'}
function chipRow(label,key,current,entries){return `<span class="chip-label">${label}</span>`+entries.map(([n,c])=>`<button type="button" class="${current===n?'active':''}" data-${key}="${escapeHTML(n)}" aria-pressed="${current===n}">${escapeHTML(n)}<span class="chip-count">${c}</span></button>`).join('')}
function renderBrandChips(){const row=$('brandChips'),srow=$('seriesChips');if(!row||!srow)return;if(!brandActive()){brand='전체';series='전체';row.hidden=srow.hidden=true;row.innerHTML=srow.innerHTML='';return}const counts=new Map();for(const m of materials())if(m.cat===subcategory)counts.set(brandOf(m),(counts.get(brandOf(m))||0)+1);const names=[...counts.keys()].sort((a,b)=>counts.get(b)-counts.get(a)||a.localeCompare(b,'ko'));if(brand!=='전체'&&!counts.has(brand))brand='전체';const total=names.reduce((t,n)=>t+counts.get(n),0);row.hidden=false;row.innerHTML=chipRow('BRAND','brand',brand,[['전체',total],...names.map(n=>[n,counts.get(n)])]);const sl=seriesList();if(!sl){series='전체';srow.hidden=true;srow.innerHTML='';return}const sc=new Map();for(const m of materials())if(m.cat===subcategory&&brandOf(m)===brand){const k=seriesOf(m,sl);sc.set(k,(sc.get(k)||0)+1)}const snames=[...sl,'기타'].filter(n=>sc.has(n));if(series!=='전체'&&!sc.has(series))series='전체';srow.hidden=false;srow.innerHTML=chipRow('SERIES','series',series,[['전체',snames.reduce((t,n)=>t+sc.get(n),0)],...snames.map(n=>[n,sc.get(n)])])}
let catalogViewKey='',catalogViewOrder=[];
function firstDimensionMm(spec){const match=String(spec||'').replace(/,/g,'').match(/(\d+(?:\.\d+)?)\s*(?:mm)?\s*[×xX*]/);const value=Number(match?.[1]);return Number.isFinite(value)&&value>0?value:null}
const TOILET_IMAGE_METRICS=[
  ['CC-733',.615,.001,.0375],['CC-735',.609,0,.0325],['아르노 라운드',.594,-.001,.043],['아르노 스퀘어',.599,.0045,.0425],
  ['CC-282',.581,-.0005,.0455],['CC-283',.586,0,.048],['CC-214',.501,-.0005,.0955],['SMARTLET 660N',.523,.0025,.0775],
  ['SMARTLET 4500',.455,.017,.1115],['SMARTLET 550',.461,.003,.1125],['WAVE S 2PC',.831667,.015833,.000833],['WAVE R 2PC',.831667,.0175,.000833],
  ['SIGNATURE 2PC',.935221,-.016795,.002159],['WAVE S 1PC',.838,.012,.007],['WAVE R 1PC',.814,.004,.011],['CHOICE 1PC',.833333,.0075,.008333],
  ['PLAT G',.795106,-.00024,.002159],['PLAT C',.756238,-.003119,.00144]
];
function dimensionsMm(spec){const clean=String(spec||'').replace(/,/g,''),numbers=(clean.match(/\d+(?:\.\d+)?/g)||[]).map(Number),pick=label=>Number(clean.match(new RegExp('(?:^|[×xX*]\\s*)'+label+'\\s*(\\d+(?:\\.\\d+)?)','i'))?.[1])||null;return {length:pick('L')||pick('D')||numbers[0]||null,width:pick('W')||numbers[1]||null,height:pick('H')||numbers[2]||null}}
function toiletImageMetric(m){const text=[m?.name,m?.model].join(' '),row=TOILET_IMAGE_METRICS.find(([key])=>text.includes(key));return row?{bboxH:row[1],centerX:row[2],centerY:row[3]}:null}
function materialCardLayout(m){
  if(m?.cat==='슬라이드바'){
    return {scale:.92,x:'0%',y:'0%'};
  }
 if(m?.cat==='샤워수전'&&/DL-B4213LN|DL-B4313LN|VICTORIA301|빅토리아샤워301/.test([m.name,m.model].join(' ')))return {scale:1,x:'0%',y:'0%'};
  if(m?.cat==='변기'){
    const metric=toiletImageMetric(m),height=dimensionsMm(m.spec).height,reference=Math.max(...materials().filter(item=>item.cat==='변기').map(item=>dimensionsMm(item.spec).height).filter(Boolean));
    if(metric&&height&&reference)return {scale:.90*(height/reference)/metric.bboxH,x:`${(-metric.centerX*100).toFixed(3)}%`,y:`${(-metric.centerY*100).toFixed(3)}%`};
  }
  if(m?.cat==='세면대'){
    const dimension=firstDimensionMm(m.spec),reference=Math.max(510,...materials().filter(item=>item.cat==='세면대').map(item=>firstDimensionMm(item.spec)).filter(Boolean));
    if(dimension)return {scale:Math.max(.65,Math.min(1,dimension/reference)),x:'0%',y:'0%'};
  }
  return null;
}
function renderCatalog(){let items=materials().filter(m=>(query||GROUPS[group].cats.includes(m.cat))&&(subcategory==='전체'||query||m.cat===subcategory)&&(!brandActive()||brand==='전체'||brandOf(m)===brand)&&(!seriesList()||series==='전체'||seriesOf(m,seriesList())===series)&&(!query||[m.name,m.brand,m.model,m.cat,m.spec].join(' ').toLowerCase().includes(query.toLowerCase()))&&(filter!=='mine'||!m.sample)&&(filter!=='favorite'||state.favorites.includes(m.id)));if(state.settings.sort==='favorite')items.sort((a,b)=>Number(state.favorites.includes(b.id))-Number(state.favorites.includes(a.id)));if(state.settings.sort==='name')items.sort((a,b)=>a.name.localeCompare(b.name,'ko'));if(state.settings.sort==='category')items.sort((a,b)=>a.cat.localeCompare(b.cat,'ko')||a.name.localeCompare(b.name,'ko'));const viewKey=JSON.stringify([group,subcategory,brand,series,query,filter,state.settings.sort,state.materials.map(m=>m.id)]);if(viewKey!==catalogViewKey){catalogViewKey=viewKey;catalogViewOrder=items.map(m=>m.id)}const order=new Map(catalogViewOrder.map((id,i)=>[id,i]));items.sort((a,b)=>(order.get(a.id)??Infinity)-(order.get(b.id)??Infinity));$('categoryTitle').textContent=query?'검색 결과':subcategory==='전체'?GROUPS[group].name:[subcategory,brandActive()&&brand!=='전체'?brand:'',seriesList()&&series!=='전체'?series:''].filter(Boolean).join(' · ');$('resultCount').textContent=`${items.length} materials`;$('catalog').innerHTML=items.map(m=>{const added=project().items.some(i=>i.materialId===m.id),layout=materialCardLayout(m);return `<article class="material"><div class="material-image${layout?' physical-scale':''}" data-detail="${m.id}" role="button" tabindex="0" aria-label="${escapeHTML(m.name)} 상세 보기"${layout?` style="--physical-scale:${layout.scale.toFixed(4)};--physical-x:${layout.x};--physical-y:${layout.y}"`:''}><img src="${m.image}" alt="${escapeHTML(m.name)}" loading="lazy"${m.cat==='슬라이드바'?' style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain"':''}>${m.sample?'<span class="sample-tag">EXAMPLE</span>':''}<button type="button" class="fav ${state.favorites.includes(m.id)?'active':''}" data-fav="${m.id}" aria-label="${escapeHTML(m.name)} 즐겨찾기" aria-pressed="${state.favorites.includes(m.id)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg></button><button type="button" class="add ${added?'added':''}" data-add="${m.id}" aria-label="${escapeHTML(m.name)} ${added?'담김':'담기'}">${added?'✓':'＋'}</button></div><div class="material-meta" data-detail="${m.id}" role="button" tabindex="0"><span class="kind">${escapeHTML(m.cat)}${m.brand?' / '+escapeHTML(m.brand):''}</span><h3>${escapeHTML(m.name)}</h3><p>${escapeHTML(m.spec||'규격 정보 미입력')}</p></div></article>`}).join('');$('emptyCatalog').hidden=items.length>0}
function renderSelection(){const p=project();if(!p)return;syncWorkspaceContext();syncConsultationForm(p);$('projectSelect').innerHTML=(consultationDraft?`<option value="" selected>${escapeHTML(consultationDraft.customer?consultationDraft.customer+' 고객님 상담':'작성 중인 새 상담')}</option>`:'')+state.projects.map(s=>`<option value="${s.id}" ${s.id===p.id?'selected':''}>${escapeHTML(s.name)}</option>`).join('');$('projectMeta').textContent=[p.customer||'새로운 공간을 위한 기록',p.date].filter(Boolean).join(' · ');const count=p.items.length;$('selectedCount').textContent=count;$('mobileCount').textContent=count;$('exportSummary').textContent=count?`${count}개의 선택, 하나의 공간`:'선택한 자재를 제안서로';$('finishListBtn').disabled=!count;$('emptySelection').hidden=!!count;const cover=p.items.slice(0,3).map(i=>material(i.materialId));$('coverTiles').innerHTML=(cover.length?cover:materials().slice(0,3)).map(m=>`<img src="${m.image}" alt="${escapeHTML(m.name)}">`).join('');$('selectedItems').innerHTML=p.items.map((i,index)=>{const m=material(i.materialId);return `<div class="selected-item" data-item="${i.id}"><div class="selected-main"><img src="${m.image}" alt="${escapeHTML(m.name)}"><div class="info"><small>${String(index+1).padStart(2,'0')} / ${escapeHTML(m.cat)}${m.sample?' · 예시':''}</small><b>${escapeHTML(m.name)}</b><small>${escapeHTML(m.model||m.brand)}</small></div><button class="remove-item" data-remove="${i.id}" aria-label="${escapeHTML(m.name)} 셀렉션에서 빼기">×</button></div><details class="selection-item-details"><summary>적용 공간 · 메모</summary><div class="item-controls"><select data-field="room" aria-label="${escapeHTML(m.name)} 적용 공간">${ROOMS.map(r=>`<option ${r===i.room?'selected':''}>${r}</option>`).join('')}</select><select data-field="status" aria-label="${escapeHTML(m.name)} 결정 상태">${['후보','확정','보류'].map(s=>`<option ${s===i.status?'selected':''}>${s}</option>`).join('')}</select></div><label class="item-location">적용부위<input data-field="application" list="applicationOptions" maxlength="80" value="${escapeHTML(i.application||'')}" aria-label="${escapeHTML(m.name)} 적용부위" placeholder="예: 벽 / 바닥 / 천장 / 싱크대"></label><input class="item-note" data-field="note" maxlength="240" value="${escapeHTML(i.note)}" aria-label="${escapeHTML(m.name)} 상담 메모" placeholder="적용 위치 / 고객 의견 남기기"></details></div>`}).join('')}
function applySiteSettings(){const heading=document.querySelector?.('.reference-title');if(heading){if(['material library','yuhiha material library'].includes(state.settings.title.toLowerCase().trim()))heading.textContent='MATERIAL LIBRARY';else heading.textContent=state.settings.title;}$('heroTitle').textContent=state.settings.title;$('heroSubtitle').textContent=state.settings.subtitle;const root=document.documentElement.style;root.setProperty('--hero-brand-size',state.settings.brandSize+'px');root.setProperty('--hero-brand-spacing',state.settings.brandSpacing+'px');root.setProperty('--hero-title-font',state.settings.titleFont==='pretendard'?"Pretendard, sans-serif":"Montserrat, sans-serif");root.setProperty('--hero-title-size',state.settings.titleSize+'px');root.setProperty('--hero-title-mobile-size',state.settings.titleMobileSize+'px');root.setProperty('--hero-title-weight',state.settings.titleWeight);root.setProperty('--hero-title-spacing',state.settings.titleSpacing+'px');root.setProperty('--hero-title-gap',state.settings.titleGap+'px');$('catalog').style.setProperty('--catalog-columns',state.settings.columns);state.settings.steps.forEach((step,i)=>{$('processStep'+(i+1)).textContent=step})}
function render(){applySiteSettings();renderGroups();renderCatalog();renderSelection()}
function toggleFavorite(id){
 const pageX=window.scrollX,pageY=window.scrollY,rail=$('consultationRail'),railScroll=rail.scrollTop;
 state.favorites=state.favorites.includes(id)?state.favorites.filter(x=>x!==id):[...state.favorites,id];save();
 for(const button of document.querySelectorAll('[data-fav]')){if(button.dataset.fav!==id)continue;const active=state.favorites.includes(id);button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active))}
 rail.scrollTop=railScroll;window.scrollTo({left:pageX,top:pageY,behavior:'instant'});
}
function add(id){if(project().items.some(i=>i.materialId===id)){toast('이미 셀렉션에 담긴 자재예요.');return}project().items.push({id:uid(),materialId:id,room:'미지정',status:'후보',note:''});saveSelection();const rail=$('consultationRail'),railScroll=rail.scrollTop;renderSelection();rail.scrollTop=railScroll;for(const button of document.querySelectorAll('[data-add]')){if(button.dataset.add!==id)continue;const card=button.classList.contains('add');button.classList.add('added');button.textContent=card?'✓':'✓ 셀렉션에 담았어요';button.setAttribute('aria-label',material(id).name+' 담김');button.setAttribute('aria-pressed','true')}toast('셀렉션에 담았어요.')}
function removeSelectionItem(id){
 const p=project(),item=p.items.find(i=>i.id===id);if(!item)return;
 const rail=$('consultationRail'),railScroll=rail.scrollTop,pageX=window.scrollX,pageY=window.scrollY;
 p.items=p.items.filter(i=>i.id!==id);saveSelection();
 // Leave catalog images in place so removing a selection cannot collapse the page.
 for(const button of document.querySelectorAll('[data-add]')){
  if(button.dataset.add!==item.materialId)continue;
  button.classList.remove('added');button.textContent=button.classList.contains('add')?'＋':'+ 셀렉션에 담기';
  button.setAttribute('aria-label',material(item.materialId).name+' 담기');button.setAttribute('aria-pressed','false');
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
function showProjectDetail(){const p=project();if(!p)return;finishInlineMaterials();$('projectDetailTitle').textContent=consultationHeading(p);const fields=[['상담 날짜',p.date],['고객명',p.customer],['연락처',p.phone],['현장 주소',p.address],['주거 유형',p.housing],['면적',p.area? p.area+'평':''],['예산',p.budget],['희망 공사일',p.constructionDate],['상담 메모',p.note]];$('projectDetailContent').innerHTML='<div class="project-materials-heading"><h3>고객 정보</h3><button type="button" data-edit-project-info>정보 수정</button></div><div id="projectInfoEditor" hidden></div><dl class="project-information">'+fields.map(([k,v])=>`<div><dt>${k}</dt><dd>${escapeHTML(v||'—')}</dd></div>`).join('')+'</dl><div class="project-materials-heading"><h3>선택한 자재 · '+p.items.length+'</h3><button type="button" data-edit-project-materials>자재 수정 ↗</button></div><div class="project-detail-materials">'+p.items.map(i=>{const m=material(i.materialId);if(!m)return '';return `<article><img src="${m.image}" alt="${escapeHTML(m.name)}"><div><b>${escapeHTML(m.name)}</b><p>${escapeHTML([m.brand,m.model,i.room,i.status].filter(Boolean).join(' · '))}</p><p>${escapeHTML(i.note)}</p></div></article>`}).join('')+'</div>';$('detailExportBtn').disabled=!p.items.length;if(!$('projectDetailDialog').open)$('projectDetailDialog').showModal();setSaveStatus($('saveState').textContent)}

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
    const m=material(item.materialId);if(!m)return '';
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
  if(projectMaterialReplacement){const item=projectMaterialsEdit.items.find(i=>i.id===projectMaterialReplacement);if(!item)return;item.materialId=id}
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

function openMaterial(id){$('materialForm').reset();const m=id?state.materials.find(item=>item.id===id):null;$('materialId').value=m?.id||'';imageDraft=m?.image||'';$('imagePreview').src=imageDraft;$('imagePreview').hidden=!imageDraft;$('uploadHint').hidden=!!imageDraft;$('materialFormTitle').textContent=m?'자재 정보 수정':'새로운 재료를 만나보세요.';$('deleteMaterialBtn').hidden=!m;$('materialCat').innerHTML=allCats().map(c=>`<option>${c}</option>`).join('');$('materialCat').value=m?.cat||(subcategory!=='전체'?subcategory:GROUPS[group].cats[0]);for(const [f,k]of [['materialName','name'],['materialBrand','brand'],['materialModel','model'],['materialSpec','spec'],['materialUrl','url'],['materialNote','note']])$(f).value=m?.[k]||'';$('formError').textContent='';$('materialDialog').showModal()}
function renderCategoryManager(){$('categoryList').innerHTML=GROUPS.map((g,i)=>`<section><b><span>${String(i+1).padStart(2,'0')} ${escapeHTML(g.name)}</span><i><button type="button" data-group-move="${i}:-1" aria-label="${escapeHTML(g.name)} 앞으로">↑</button><button type="button" data-group-move="${i}:1" aria-label="${escapeHTML(g.name)} 뒤로">↓</button></i></b><div>${g.cats.map((cat,j)=>`<span>${escapeHTML(cat)}<button type="button" data-cat-move="${i}:${j}:-1" aria-label="${escapeHTML(cat)} 앞으로">‹</button><button type="button" data-cat-move="${i}:${j}:1" aria-label="${escapeHTML(cat)} 뒤로">›</button><button type="button" data-remove-cat="${escapeHTML(cat)}" aria-label="${escapeHTML(cat)} 삭제">×</button></span>`).join('')}</div></section>`).join('');$('categoryGroupOptions').innerHTML=GROUPS.map(g=>`<option value="${escapeHTML(g.name)}"></option>`).join('')}
function openCategories(){$('categoryForm').reset();$('categoryError').textContent='';renderCategoryManager();$('categoryDialog').showModal()}
function openSiteSettings(){$('siteTitle').value=state.settings.title;$('siteSubtitle').value=state.settings.subtitle;$('siteColumns').value=state.settings.columns;$('siteSort').value=state.settings.sort;for(const key of ['brandSize','brandSpacing','titleFont','titleSize','titleMobileSize','titleWeight','titleSpacing','titleGap'])$('site'+key[0].toUpperCase()+key.slice(1)).value=state.settings[key];state.settings.steps.forEach((s,i)=>$('siteStep'+(i+1)).value=s);$('siteSettingsDialog').showModal()}
// Slide bars show available manufacturer finishes, never sampled PNG colors.
function slidebarFinishOptions(m){
  if(m.cat!=='슬라이드바')return [];
  return [...new Set(String(m.spec||'').split('·')[0].split(/\s*[/,]\s*/).map(v=>v.trim()).filter(Boolean))];
}
function slidebarColorMarkup(m){
  const tones={'메트실버(MS)':'#bfc1c2','메트실버':'#bfc1c2','크롬(Chrome)':'linear-gradient(135deg,#aaaeb1,#f5f6f7 45%,#b2b6b9 70%,#e7e9eb)','크롬':'linear-gradient(135deg,#aaaeb1,#f5f6f7 45%,#b2b6b9 70%,#e7e9eb)','니켈':'#b8b5ac','다크 그레이':'#55585a'};
  const options=slidebarFinishOptions(m);
  if(!options.length)return '색상 미확인';
  return `<span style="display:flex;flex-wrap:wrap;gap:10px 18px">${options.map(name=>`<span style="display:inline-flex;align-items:center;gap:8px"><span aria-hidden="true" style="display:inline-block;flex:0 0 16px;width:16px;height:16px;border-radius:50%;border:1px solid #aaa;background:${tones[name]||'transparent'}"></span><span>${escapeHTML(name)}</span></span>`).join('')}</span>`;
}
function materialDetailMarkup(m){
  const rows=[['브랜드',m.brand],['모델명',m.model]];
  const base=rows.map(([label,value])=>`<dt>${label}</dt><dd>${escapeHTML(value||'미입력')}</dd>`).join('');
  return base+(m.cat==='슬라이드바'?`<dt>색상</dt><dd>${slidebarColorMarkup(m)}</dd>`:`<dt>규격</dt><dd>${escapeHTML(m.spec||'미입력')}</dd>`);
}
function detail(id){const m=material(id);$('detailContent').innerHTML=`<div class="dialog-head"><div><h2>${escapeHTML(m.name)}</h2></div><button class="close icon-btn" aria-label="닫기">×</button></div><img class="detail-image" src="${m.image}" alt="${escapeHTML(m.name)}"><dl class="detail-data">${materialDetailMarkup(m)}</dl>${m.url?`<a class="source-link" href="${escapeHTML(m.url)}" target="_blank" rel="noopener noreferrer">제품 상세 페이지 ↗</a>`:''}<p class="detail-disclaimer">본 화면은 실제 제품과 다소 차이가 있을 수 있으니 반드시 상담 후 선택 부탁드립니다.</p><div class="detail-actions">${!m.sample?`<button data-edit="${m.id}">정보 수정</button>`:''}<button class="dark" data-add="${m.id}">＋ 셀렉션에 담기</button></div>`;$('detailDialog').showModal()}
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
async function cardPNG(p,item,index){const m=material(item.materialId),[c,x]=canvas(1200,1600);x.drawImage(await imageOf('assets/logo-yuhiha.png'),65,20,195,80);text(x,'MATERIAL SELECTION',775,83,18);x.strokeStyle='#d8dcd0';x.beginPath();x.moveTo(65,113);x.lineTo(1135,113);x.stroke();text(x,`${String(index+1).padStart(2,'0')} / ${m.cat}`,65,171,23);text(x,m.sample?'EXAMPLE · 실제 제품 아님':item.status,875,171,18);drawImageFit(x,await imageOf(m.image),65,210,1070,820,materialImageMode(m));wrap(x,m.name,65,1103,1070,44,54,2);text(x,[m.brand,m.model].filter(Boolean).join(' / ')||'제품 정보 미입력',65,1220,23);wrap(x,m.spec,65,1265,1070,22,32,2);wrap(x,`${item.room} · ${item.status}${item.note?' / '+item.note:''}`,65,1355,1070,24,35,3);text(x,p.name,65,1516,25);text(x,'공간 유희하',970,1516,20);return c}
async function boardCanvases(p){const pages=[];for(let start=0;start<p.items.length;start+=12){const subset=p.items.slice(start,start+12),rows=Math.ceil(subset.length/3),[c,x]=canvas(1800,380+rows*535);x.drawImage(await imageOf('assets/logo-yuhiha.png'),65,20,170,70);text(x,'THE MATERIAL EDIT',1200,80,22);wrap(x,p.name,65,165,1660,46,56,2);text(x,[p.customer,p.date,`${p.items.length} MATERIALS`,`${Math.floor(start/12)+1} / ${Math.ceil(p.items.length/12)}`].filter(Boolean).join('   /   '),65,265,20);for(let j=0;j<subset.length;j++){const item=subset[j],m=material(item.materialId),px=65+(j%3)*560,py=310+Math.floor(j/3)*535;drawImageFit(x,await imageOf(m.image),px,py,510,330,materialImageMode(m));text(x,`${String(start+j+1).padStart(2,'0')} / ${m.cat}${m.sample?' · 예시':''}`,px,py+361,18);wrap(x,m.name,px,py+400,510,27,33,1);wrap(x,[m.brand,m.model,item.room,item.status].filter(Boolean).join(' · '),px,py+434,510,17,22,2);wrap(x,item.note||'',px,py+485,510,17,23,2)}text(x,'공간 유희하 — SELECT WITH INTENTION.',65,c.height-25,16);pages.push(c)}return pages}
const pngBlob=c=>new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(Error('PNG 생성 실패')),'image/png'));
// Standards-compliant, uncompressed ZIP. UTF-8 names, CRC32, no external library.
const crcTable=Array.from({length:256},(_,i)=>{let c=i;for(let j=0;j<8;j++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0});
function crc32(a){let c=0xffffffff;for(const b of a)c=crcTable[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0}
async function zipFiles(files){const parts=[],central=[];let offset=0;const enc=new TextEncoder();for(const file of files){const name=enc.encode(file.name),data=new Uint8Array(await file.blob.arrayBuffer()),crc=crc32(data),local=new Uint8Array(30+name.length),l=new DataView(local.buffer);l.setUint32(0,0x04034b50,true);l.setUint16(4,20,true);l.setUint16(6,0x800,true);l.setUint32(14,crc,true);l.setUint32(18,data.length,true);l.setUint32(22,data.length,true);l.setUint16(26,name.length,true);local.set(name,30);parts.push(local,data);const cen=new Uint8Array(46+name.length),v=new DataView(cen.buffer);v.setUint32(0,0x02014b50,true);v.setUint16(4,20,true);v.setUint16(6,20,true);v.setUint16(8,0x800,true);v.setUint32(16,crc,true);v.setUint32(20,data.length,true);v.setUint32(24,data.length,true);v.setUint16(28,name.length,true);v.setUint32(42,offset,true);cen.set(name,46);central.push(cen);offset+=local.length+data.length}const end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,files.length,true);v.setUint16(10,files.length,true);v.setUint32(12,central.reduce((n,c)=>n+c.length,0),true);v.setUint32(16,offset,true);return new Blob([...parts,...central,end],{type:'application/zip'})}
let exporting=false;
async function exportPackage(){await exportFontsReady();if(exporting||!project().items.length)return;exporting=true;const p=structuredClone(project()),button=$('exportBtn');button.disabled=true;$('boardExportBtn').disabled=true;try{const files=[],metadata={project:p.name,customer:p.customer,date:p.date,notes:p.note,exportedAt:new Date().toISOString(),materials:[]};for(let n=0;n<p.items.length;n++){button.textContent=`PNG 준비 중 ${n+1} / ${p.items.length}`;const item=p.items[n],m=material(item.materialId),base=`${String(n+1).padStart(2,'0')}_${safeName(m.cat)}_${safeName(m.name)}`;files.push({name:`01_개별자재/${base}.png`,blob:await pngBlob(await cardPNG(p,item,n))});const imageResponse=await fetch(m.image);if(!imageResponse.ok)throw Error('제품 이미지를 불러오지 못했습니다.');const imageBlob=await imageResponse.blob(),imageExtension=({'image/png':'png','image/webp':'webp'})[imageBlob.type.split(';')[0]]||'jpg',imageFile=`03_제품이미지/${base}.${imageExtension}`;files.push({name:imageFile,blob:imageBlob});const {image,...info}=m;metadata.materials.push({...info,...item,cardFile:`01_개별자재/${base}.png`,imageFile})}const boards=await boardCanvases(p);for(let i=0;i<boards.length;i++)files.push({name:`02_전체보드/셀렉션_${String(i+1).padStart(2,'0')}.png`,blob:await pngBlob(boards[i])});files.push({name:'제품정보.json',blob:new Blob([JSON.stringify(metadata,null,2)],{type:'application/json'})});files.push({name:'읽어주세요.txt',blob:new Blob(['YUHIHA MATERIAL ROOM\n\n01: 자재별 제안서 카드 PNG\n02: 전체 셀렉션 보드 PNG (12개씩 페이지 분리)\n03: 웹용 제품 이미지 (PNG 투명도와 저장 형식 유지)\n제품정보.json: 브랜드, 모델, 규격, 제품 링크, 적용 공간, 상태, 메모\n\nEXAMPLE 표시는 실제 판매 제품이 아닌 예시입니다.\n화면 색상은 실물과 다를 수 있으니 최종 결정은 제조사 견본을 확인하세요.\n이 ZIP을 제안서 제작 담당자 또는 이 대화에 전달하세요.'],{type:'text/plain;charset=utf-8'})});download(await zipFiles(files),`${safeName(p.name)}_유희하_셀렉션.zip`);toast('PNG 패키지를 다운로드했어요. ZIP을 제안서 작업에 전달하세요.')}catch(e){toast('내보내기에 실패했어요. '+e.message)}finally{exporting=false;button.innerHTML='PNG 패키지 내보내기 <span>↗</span>';button.disabled=!project().items.length;$('boardExportBtn').disabled=false}}
async function showBoard(){await exportFontsReady();if(!project().items.length)return;$('boardPreview').textContent='보드를 준비하고 있어요…';$('boardDialog').showModal();try{$('boardPreview').replaceChildren(...await boardCanvases(structuredClone(project())))}catch(e){$('boardPreview').textContent='이미지를 불러오지 못했습니다. '+e.message}}
function validBackup(data){
  if(!data||typeof data!=='object')throw Error('유희하 백업 파일이 아닙니다.');
  data=migrateCategories(data);
  if(data?.version!==1||!Array.isArray(data.materials)||!Array.isArray(data.deletedMaterials)||!Array.isArray(data.projects)||!Array.isArray(data.favorites))throw Error('유희하 백업 파일이 아닙니다.');
  const ids=new Set(samples.map(m=>m.id));
  for(const m of [...data.materials,...data.deletedMaterials]){
    if(typeof m.id!=='string'||ids.has(m.id)||!allCats().includes(m.cat)||typeof m.name!=='string'||!m.name.trim()||typeof m.image!=='string'||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(m.image)||m.image.length>12000000)throw Error('자재 정보 형식이 올바르지 않습니다.');
    for(const k of ['brand','model','spec','note','url'])if(typeof m[k]!=='string')throw Error('제품 정보 누락');
    if(m.url&&!/^https?:\/\//i.test(m.url))throw Error('제품 링크 형식 오류');ids.add(m.id);
  }
  if(data.deletedProjects===undefined)data.deletedProjects=[];
  if(!Array.isArray(data.deletedProjects))throw Error('삭제한 프로젝트 형식 오류');
  const pids=new Set();
  for(const p of [...data.projects,...data.deletedProjects]){if(typeof p.id!=='string'||pids.has(p.id)||typeof p.name!=='string'||!Array.isArray(p.items)||p.items.length>500)throw Error('프로젝트 형식 오류');pids.add(p.id);for(const i of p.items)if(!ids.has(i.materialId)||typeof i.id!=='string'||!ROOMS.includes(i.room)||!['후보','확정','보류'].includes(i.status)||typeof i.note!=='string')throw Error('셀렉션 정보 형식 오류')}
  for(const p of [...data.projects,...data.deletedProjects])for(const i of p.items)if(i.application!==undefined&&(typeof i.application!=='string'||i.application.length>80))throw Error('적용부위는 80자 이내로 입력해 주세요.');
  if(!data.projects.some(p=>p.id===data.active))data.active=data.projects[0]?.id||'';return data;
}
document.addEventListener('click',e=>{const b=e.target.closest('button');if(b?.classList.contains('close')){b.closest('dialog').close();return}if(b?.dataset.groupMove){const [from,delta]=b.dataset.groupMove.split(':').map(Number),to=from+delta;if(to>=0&&to<GROUPS.length){[GROUPS[from],GROUPS[to]]=[GROUPS[to],GROUPS[from]];group=to;state.groups=structuredClone(GROUPS);save();render();renderCategoryManager()}return}if(b?.dataset.catMove){const [gi,from,delta]=b.dataset.catMove.split(':').map(Number),cats=GROUPS[gi].cats,to=from+delta;if(to>=0&&to<cats.length){[cats[from],cats[to]]=[cats[to],cats[from]];state.groups=structuredClone(GROUPS);save();render();renderCategoryManager()}return}if(b?.dataset.removeCat){const cat=b.dataset.removeCat;let fallback=GROUPS.flatMap(g=>g.cats).find(c=>c!==cat)||'미분류';const owner=GROUPS.find(g=>g.cats.includes(cat));owner.cats=owner.cats.filter(c=>c!==cat);GROUPS=GROUPS.filter(g=>g.cats.length);if(!GROUPS.length){GROUPS=[{name:'기타',cats:['미분류']}];fallback='미분류'}for(const m of state.materials)if(m.cat===cat)m.cat=fallback;state.groups=structuredClone(GROUPS);group=Math.min(group,GROUPS.length-1);subcategory='전체';save();render();renderCategoryManager();toast('품목을 삭제하고 연결된 자재를 '+fallback+'로 옮겼어요.');return}if(b?.dataset.group!==undefined){group=Number(b.dataset.group);subcategory='전체';brand='전체';series='전체';query='';$('search').value='';renderGroups();renderCatalog();return}if(b?.dataset.brand!==undefined){brand=b.dataset.brand;series='전체';renderBrandChips();renderCatalog();return}if(b?.dataset.series!==undefined){series=b.dataset.series;renderBrandChips();renderCatalog();return}if(b?.dataset.cat){subcategory=b.dataset.cat;brand='전체';series='전체';renderGroups();renderCatalog();return}if(b?.dataset.add){add(b.dataset.add);return}if(b?.dataset.fav){e.preventDefault();toggleFavorite(b.dataset.fav);return}if(b?.dataset.remove){removeSelectionItem(b.dataset.remove);return}if(b?.dataset.edit){$('detailDialog').close();openMaterial(b.dataset.edit);return}if(b?.dataset.mobile){document.querySelectorAll('[data-mobile]').forEach(t=>t.classList.toggle('active',t===b));document.querySelector('.library').classList.toggle('mobile-hide',b.dataset.mobile==='selection');document.querySelector('.selection').classList.toggle('mobile-show',b.dataset.mobile==='selection');return}const d=e.target.closest('[data-detail]');if(d)detail(d.dataset.detail)});
document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-detail]')){e.preventDefault();detail(e.target.dataset.detail)}});
$('search').addEventListener('input',e=>{query=e.target.value.trim();renderBrandChips();renderCatalog()});$('catalogFilter').onchange=e=>{filter=e.target.value;renderCatalog()};$('projectSelect').onchange=e=>{if(!e.target.value)return;persistConsultationDraft();consultationDraft=null;state.active=e.target.value;consultationLoadedId=null;persistConsultationDraft();save();renderCatalog();renderSelection()};$('newMaterialBtn').onclick=()=>openMaterial();$('manageCategoriesBtn').onclick=openCategories;$('siteEditBtn').onclick=openSiteSettings;$('emptyAdd').onclick=()=>openMaterial();$('newProjectBtn').onclick=()=>openProject(true);$('editProjectBtn').onclick=()=>openProject();$('helpBtn').onclick=()=>$('helpDialog').showModal();$('finishListBtn').onclick=showFinishList;$('finishListDialog').addEventListener('close',()=>{finishPreviewToken++;clearFinishPreview()});
$('selectedItems').addEventListener('input',e=>{const key=e.target.dataset.field;if(!key)return;const i=project().items.find(i=>i.id===e.target.closest('[data-item]').dataset.item);i[key]=e.target.value;saveSelection()});
$('imageFile').onchange=async e=>{if(!e.target.files[0])return;$('formError').textContent='이미지를 준비하고 있어요…';try{imageDraft=await fileToImage(e.target.files[0]);$('imagePreview').src=imageDraft;$('imagePreview').hidden=false;$('uploadHint').hidden=true;$('formError').textContent=''}catch(err){$('formError').textContent=err.message}};
$('materialForm').onsubmit=e=>{e.preventDefault();if(!imageDraft){$('formError').textContent='제품 이미지를 올려주세요.';return}const name=$('materialName').value.trim(),url=$('materialUrl').value.trim();if(!name){$('formError').textContent='자재명을 입력해 주세요.';return}if(url&&!/^https?:\/\//i.test(url)){$('formError').textContent='제품 링크는 http 또는 https 주소를 입력해 주세요.';return}const id=$('materialId').value||uid(),m={id,name,cat:$('materialCat').value,brand:$('materialBrand').value.trim(),model:$('materialModel').value.trim(),spec:$('materialSpec').value.trim(),url,note:$('materialNote').value.trim(),image:imageDraft,sample:false};state.materials=state.materials.filter(x=>x.id!==id);state.materials.unshift(m);group=GROUPS.findIndex(g=>g.cats.includes(m.cat));subcategory=m.cat;query='';filter='all';$('search').value='';$('catalogFilter').value='all';save();render();$('materialDialog').close();toast('자재를 저장했어요.')};
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
  const rows=p.items.map(i=>{const m=lookup(i.materialId),room=['벽지','마루'].includes(m?.cat)?'공용':(i.room||'미지정');return {room:room,image:m?.image||'',imageMode:materialImageMode(m),cells:[room,[m?.cat||'품목 미입력',i.application||''].filter(Boolean).join('\n'),m?.brand||'—',[(m?.name||'제품 정보 없음').replace(/_/g,' '),m?.model&&!String(m?.name||'').includes(m.model)?m.model:'',m?.sample?'예시 제품':''].filter(Boolean).join('\n'),m?.spec||'—','',[i.status||'',i.note||''].filter(Boolean).join('\n')]}});
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


function restoreConsultationDraft(){try{const saved=JSON.parse(sessionStorage.getItem('yuhiha-review-draft')||'null');if(saved&&typeof saved.id==='string'&&Array.isArray(saved.items)&&typeof saved.customer==='string'){saved.items=saved.items.filter(i=>material(i.materialId));consultationDraft=saved;return}}catch{}consultationDraft=newConsultationDraft()}
let boardPngExporting=false;
async function exportBoardPNG(){if(boardPngExporting||!project()?.items.length)return;boardPngExporting=true;const p=structuredClone(project());try{await exportFontsReady();const pages=await boardCanvases(p);for(let i=0;i<pages.length;i++)download(await pngBlob(pages[i]),`${safeName(consultationHeading(p))}_자재보드_${i+1}.png`);toast('자재 보드 PNG를 저장했어요.')}catch(e){toast('PNG를 만들지 못했어요. '+e.message)}finally{boardPngExporting=false}}

init();
