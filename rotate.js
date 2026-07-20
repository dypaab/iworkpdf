// ============================================================
//  iWorkPDF — rotate.js (logique spécifique à l'outil Rotate)
//  Charger APRÈS security.js et shared.js.
// ============================================================

let rotateSelected=new Set();

function buildRotateUI(){
  const saveBlock=`<p class="form-label" style="margin-bottom:8px">${t('dest')}</p><div class="save-mode"><div class="save-opt active" id="so-local" onclick="setSave('local')"><div class="save-opt-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M12 3v12M7 10l5 5 5-5"/></svg></div><div class="save-opt-title">${t('localmode')}</div><div class="save-opt-sub">${t('direct')}</div></div><div class="save-opt" id="so-cloud" onclick="setSave('cloud')"><div class="save-opt-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 16a4 4 0 0 1 .4-8A5.5 5.5 0 0 1 17.5 9.5"/><rect x="13" y="13.5" width="9" height="7.5" rx="1.8"/><path d="M15.2 13.5V12a2.3 2.3 0 0 1 4.6 0v1.5"/></svg></div><div class="save-opt-title">${t('savemode')}</div><div class="save-opt-sub">${t('cloudsub')}</div></div></div>`;
  const bottom=`<div class="status-box" id="ts"></div><div class="prog-wrap" id="tp"><div class="prog-bg"><div class="prog-fill" id="pf"></div></div><div class="prog-text" id="pt"></div></div><div class="share-box" id="share-result"><p style="font-size:13px;font-weight:600">🔗 ${t('signedlink')}</p><div class="share-row"><input class="share-inp" id="share-link-inp" readonly/><button class="btn-primary" style="padding:8px 14px;font-size:13px" onclick="copyLink()">${t('copylink')}</button></div><p class="share-exp" id="share-exp-txt"></p></div>`;
  return `
    <div class="drop-zone" id="dz">
      <input type="file" accept=".pdf" onchange="onPick(event,'rotate')"/>
      <p class="drop-text">${t('drop')}</p>
      <button class="drop-btn"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> ${t('browse')}</button>
    </div>
    <div class="form-group">
      <label class="form-label">${t('angle')} <span style="color:var(--tx3);font-size:11px">(${lang==='fr'?'appliqué à toutes les pages ou aux pages sélectionnées':'applied to all or selected pages'})</span></label>
      <div class="radio-group" id="rg-angle">
        <button class="rbn active" onclick="setRbn('rg-angle',this,90,'angle')">90° →</button>
        <button class="rbn" onclick="setRbn('rg-angle',this,180,'angle')">180°</button>
        <button class="rbn" onclick="setRbn('rg-angle',this,270,'angle')">← 90°</button>
      </div>
    </div>
    <div id="rotate-preview" style="display:none">
      <div class="pg-card-tip">🖱️ ${lang==='fr'?'Cliquez sur les pages à pivoter. Aucune sélection = toutes les pages':'Click pages to rotate. No selection = all pages'}</div>
      <div class="merge-toolbar">
        <span class="merge-count" id="rotate-count">${lang==='fr'?'Toutes les pages':'All pages'}</span>
        <button class="btn-sm" onclick="rotateClearSel()">${lang==='fr'?'Tout désélectionner':'Clear selection'}</button>
      </div>
      <div class="pages-grid" id="rotate-grid"></div>
    </div>
    ${saveBlock}${bottom}
    <div class="flex-end"><button class="btn-primary" onclick="run('rotate')">${t('rot_btn')}</button></div>`;
}

async function renderRotatePreview(){
  rotateSelected=new Set();
  const prev=document.getElementById('rotate-preview');
  const grid=document.getElementById('rotate-grid');
  if(!prev||!grid||!activeFiles[0]) return;
  prev.style.display='block';
  grid.innerHTML=`<p style="color:var(--tx2);font-size:12px;padding:8px">${lang==='fr'?'Génération…':'Loading…'}</p>`;
  const n=await getPdfPageCount(activeFiles[0]);
  grid.innerHTML='';
  for(let i=0;i<n;i++){
    const card=document.createElement('div');
    card.className='pg-card';
    const canvas=document.createElement('canvas');
    card.appendChild(canvas);
    const foot=document.createElement('div');
    foot.className='pg-card-footer';
    foot.textContent=`p.${i+1}`;
    card.appendChild(foot);
    const idx=i;
    card.addEventListener('click',()=>{
      if(rotateSelected.has(idx)){rotateSelected.delete(idx);card.classList.remove('rotate-sel');}
      else{rotateSelected.add(idx);card.classList.add('rotate-sel');}
      updateRotateCount();
    });
    grid.appendChild(card);
    renderThumb(canvas,activeFiles[0],i);
  }
  updateRotateCount();
}

function updateRotateCount(){
  const el=document.getElementById('rotate-count');
  if(!el) return;
  el.textContent=rotateSelected.size===0
    ?(lang==='fr'?'Toutes les pages seront pivotées':'All pages will be rotated')
    :(lang==='fr'?`${rotateSelected.size} page${rotateSelected.size>1?'s':''} sélectionnée${rotateSelected.size>1?'s':''}`:`${rotateSelected.size} page${rotateSelected.size>1?'s':''} selected`);
}

function rotateClearSel(){
  rotateSelected.clear();
  document.querySelectorAll('#rotate-grid .pg-card').forEach(c=>c.classList.remove('rotate-sel'));
  updateRotateCount();
}

// runRotate(activeFiles, rotateAngle, rotateSelected) -> {result, filename}
async function runRotate(activeFiles, rotateAngle, rotateSelected){
  const buf=await activeFiles[0].arrayBuffer();
  const{PDFDocument}=PDFLib;
  const src=await PDFDocument.load(buf);
  setProgress(50,'Rotating…');
  const rotateFn=PDFLib.degrees||((deg)=>({type:'degrees',angle:deg}));
  // Si pages sélectionnées → rotation partielle, sinon toutes
  src.getPages().forEach((p,i)=>{
    if(rotateSelected.size===0||rotateSelected.has(i)){
      p.setRotation(rotateFn((p.getRotation().angle+rotateAngle)%360));
    }
  });
  const result=await src.save();
  Security.wipeMemory(buf);
  const filename=`${activeFiles[0].name.replace('.pdf','')}_rotated.pdf`;
  return {result, filename};
}
