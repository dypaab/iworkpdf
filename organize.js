// ============================================================
//  iWorkPDF — organize.js (logique spécifique à l'outil Organize PDF)
//  Charger APRÈS security.js et shared.js.
//
//  Modèle "1 carte = 1 PAGE" (style iLovePDF Organize) :
//  - miniature de chaque page, ↻ pour pivoter la page, ✕ pour la retirer,
//    glisser-déposer (desktop) + flèches ‹ › (tactile) pour réordonner.
//  - organizePages[k] = {origIdx, rotation} → l'ordre du tableau = l'ordre final.
//  Réordonner impose une reconstruction (copyPages) : le sommaire/bookmarks
//  ne sont pas préservés (inhérent à la réorganisation, comme iLovePDF).
// ============================================================

let organizePages = [];   // [{origIdx:Number, rotation:0|90|180|270}]
let dragSrcPage = null;

function buildOrganizeUI(){
  const saveBlock=`<p class="form-label" style="margin-bottom:8px">${t('dest')}</p><div class="save-mode"><div class="save-opt active" id="so-local" onclick="setSave('local')"><div class="save-opt-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M12 3v12M7 10l5 5 5-5"/></svg></div><div class="save-opt-title">${t('localmode')}</div><div class="save-opt-sub">${t('direct')}</div></div><div class="save-opt" id="so-cloud" onclick="setSave('cloud')"><div class="save-opt-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 16a4 4 0 0 1 .4-8A5.5 5.5 0 0 1 17.5 9.5"/><rect x="13" y="13.5" width="9" height="7.5" rx="1.8"/><path d="M15.2 13.5V12a2.3 2.3 0 0 1 4.6 0v1.5"/></svg></div><div class="save-opt-title">${t('savemode')}</div><div class="save-opt-sub">${t('cloudsub')}</div></div></div>`;
  const bottom=`<div class="status-box" id="ts"></div><div class="prog-wrap" id="tp"><div class="prog-bg"><div class="prog-fill" id="pf"></div></div><div class="prog-text" id="pt"></div></div><div class="share-box" id="share-result"><p style="font-size:13px;font-weight:600">🔗 ${t('signedlink')}</p><div class="share-row"><input class="share-inp" id="share-link-inp" readonly/><button class="btn-primary" style="padding:8px 14px;font-size:13px" onclick="copyLink()">${t('copylink')}</button></div><p class="share-exp" id="share-exp-txt"></p></div>`;
  return `
    <div class="drop-zone" id="dz">
      <input type="file" accept=".pdf" onchange="onPick(event,'organize')"/>
      <p class="drop-text">${t('drop')}</p>
      <button class="drop-btn"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> ${t('browse')}</button>
    </div>
    <div class="merge-toolbar" id="org-toolbar" style="display:none">
      <span class="merge-count" id="org-count"></span>
      <div style="display:flex;gap:6px">
        <button class="btn-sm" onclick="organizeReset()">🗑 ${lang==='fr'?'Vider':'Clear all'}</button>
      </div>
    </div>
    <div class="pg-card-tip" id="org-tip" style="display:none">↔️ ${lang==='fr'?'Glissez pour réordonner · ↻ pour pivoter · ✕ pour retirer une page':'Drag to reorder · ↻ to rotate · ✕ to remove a page'}</div>
    <div class="merge-docs-grid" id="org-grid">
      <div class="merge-empty">${lang==='fr'?'Ajoutez un PDF':'Add a PDF'}</div>
    </div>
    ${saveBlock}${bottom}
    <div class="flex-end"><button class="btn-primary" onclick="run('organize')">${t('org_btn')}</button></div>`;
}

async function renderOrganizePreview(){
  const grid=document.getElementById('org-grid');
  const toolbar=document.getElementById('org-toolbar');
  const tip=document.getElementById('org-tip');
  if(!grid) return;
  if(!activeFiles[0]){
    organizePages=[];
    grid.innerHTML=`<div class="merge-empty">${lang==='fr'?'Ajoutez un PDF':'Add a PDF'}</div>`;
    if(toolbar)toolbar.style.display='none';
    if(tip)tip.style.display='none';
    if(typeof syncHasFiles==='function') syncHasFiles();
    return;
  }
  grid.innerHTML=`<p style="color:var(--tx2);font-size:12px;padding:8px">${lang==='fr'?'Génération des aperçus…':'Generating previews…'}</p>`;
  const n=await getPdfPageCount(activeFiles[0]);
  // Nouveau fichier chargé → on repart d'un ordre neuf (1..n, sans rotation).
  // Le réordonnancement/rotation en cours passe par renderOrganizeGrid(), pas ici.
  organizePages=Array.from({length:n},(_,i)=>({origIdx:i,rotation:0}));
  renderOrganizeGrid();
}

function renderOrganizeGrid(){
  const grid=document.getElementById('org-grid');
  const toolbar=document.getElementById('org-toolbar');
  const tip=document.getElementById('org-tip');
  if(!grid) return;
  const file=activeFiles[0];
  if(!file||!organizePages.length){
    grid.innerHTML=`<div class="merge-empty">${lang==='fr'?'Ajoutez un PDF':'Add a PDF'}</div>`;
    if(toolbar)toolbar.style.display='none';
    if(tip)tip.style.display='none';
    if(typeof syncHasFiles==='function') syncHasFiles();
    return;
  }
  grid.innerHTML='';
  organizePages.forEach((pg,k)=>{
    const card=document.createElement('div');
    card.className='md-card';
    card.draggable=true;
    card.dataset.idx=k;
    const canvas=document.createElement('canvas');
    canvas.className='md-thumb';
    card.appendChild(canvas);
    // ↻ pivoter la page
    const rot=document.createElement('button');
    rot.className='md-btn md-rotate';
    rot.innerHTML='↻';
    rot.title=lang==='fr'?'Pivoter la page (90°)':'Rotate page (90°)';
    rot.addEventListener('click',e=>{
      e.stopPropagation();
      pg.rotation=(pg.rotation+90)%360;
      renderOrganizeThumb(canvas,file,pg.origIdx,pg.rotation);
    });
    card.appendChild(rot);
    // ✕ retirer la page
    const del=document.createElement('button');
    del.className='md-btn md-del';
    del.innerHTML='✕';
    del.title=lang==='fr'?'Retirer cette page':'Remove this page';
    del.addEventListener('click',e=>{
      e.stopPropagation();
      organizePages.splice(k,1);
      renderOrganizeGrid();
    });
    card.appendChild(del);
    // Libellé : n° d'origine
    const foot=document.createElement('div');
    foot.className='md-name';
    foot.textContent=`p.${pg.origIdx+1}`;
    card.appendChild(foot);
    // Flèches (tactile) — le drag HTML5 ne marche pas au tactile
    const mv=document.createElement('div');
    mv.className='md-move';
    const swap=(a,b)=>{
      const it=organizePages.splice(a,1)[0];
      organizePages.splice(b,0,it);
      renderOrganizeGrid();
    };
    const bl=document.createElement('button');bl.className='md-mv';bl.textContent='‹';
    bl.setAttribute('aria-label',lang==='fr'?'Déplacer avant':'Move earlier');
    bl.disabled=k===0;
    bl.addEventListener('click',e=>{e.stopPropagation();if(k>0)swap(k,k-1);});
    const br=document.createElement('button');br.className='md-mv';br.textContent='›';
    br.setAttribute('aria-label',lang==='fr'?'Déplacer après':'Move later');
    br.disabled=k===organizePages.length-1;
    br.addEventListener('click',e=>{e.stopPropagation();if(k<organizePages.length-1)swap(k,k+1);});
    mv.appendChild(bl);mv.appendChild(br);
    card.appendChild(mv);
    // Drag & drop réordonnement (pages)
    card.addEventListener('dragstart',e=>{dragSrcPage=k;card.classList.add('dragging');e.dataTransfer.effectAllowed='move';});
    card.addEventListener('dragend',()=>{card.classList.remove('dragging');document.querySelectorAll('#org-grid .md-card').forEach(c=>c.classList.remove('drag-over'));});
    card.addEventListener('dragover',e=>{e.preventDefault();document.querySelectorAll('#org-grid .md-card').forEach(c=>c.classList.remove('drag-over'));card.classList.add('drag-over');});
    card.addEventListener('drop',e=>{
      e.preventDefault();
      if(dragSrcPage===null||dragSrcPage===k)return;
      const it=organizePages.splice(dragSrcPage,1)[0];
      organizePages.splice(k,0,it);
      dragSrcPage=null;
      renderOrganizeGrid();
    });
    grid.appendChild(card);
    renderOrganizeThumb(canvas,file,pg.origIdx,pg.rotation);
  });
  updateOrganizeCount();
  if(toolbar)toolbar.style.display='flex';
  if(tip)tip.style.display='block';
  if(typeof syncHasFiles==='function') syncHasFiles();
}

// Miniature de la page origIdx avec la rotation choisie (cache pdfDoc partagé).
async function renderOrganizeThumb(canvas,file,origIdx,rotation){
  try{
    await ensurePdfJs();
    let pdfDoc=_thumbPdfCache.get(file);
    if(!pdfDoc){
      const buf=await file.arrayBuffer();
      pdfDoc=await pdfjsLib.getDocument({data:buf.slice(0)}).promise;
      _thumbPdfCache.set(file,pdfDoc);
      Security.wipeMemory(buf);
    }
    const page=await pdfDoc.getPage(origIdx+1);
    const base=page.getViewport({scale:1});
    const rot=((base.rotation+(rotation||0))%360+360)%360;
    const vp0=page.getViewport({scale:1,rotation:rot});
    const scale=Math.min(220/vp0.width,180/vp0.height);
    const vp=page.getViewport({scale,rotation:rot});
    canvas.width=vp.width;canvas.height=vp.height;
    await page.render({canvasContext:canvas.getContext('2d'),viewport:vp}).promise;
  }catch(e){
    const ctx=canvas.getContext('2d');
    canvas.width=140;canvas.height=170;
    ctx.fillStyle='#f5f5f5';ctx.fillRect(0,0,140,170);
    ctx.fillStyle='#8B9CB6';ctx.font='12px sans-serif';ctx.textAlign='center';
    ctx.fillText('PDF',70,88);
  }
}

function organizeReset(){
  activeFiles=[];
  organizePages=[];
  renderOrganizeGrid();
}

function updateOrganizeCount(){
  const el=document.getElementById('org-count');
  if(!el) return;
  const n=organizePages.length;
  el.textContent=lang==='fr'
    ?`${n} page${n>1?'s':''}`
    :`${n} page${n>1?'s':''}`;
}

// runOrganize(activeFiles, organizePages) -> {result, filename} | null
// Reconstruit le PDF dans l'ordre affiché, avec la rotation par page.
async function runOrganize(activeFiles, organizePages){
  if(!activeFiles.length){ earlyReturn(t('nofile')); return null; }
  if(!organizePages.length){ earlyReturn(t('alldeleted')); return null; }
  const{PDFDocument}=PDFLib;
  const degFn=PDFLib.degrees;
  const buf=await activeFiles[0].arrayBuffer();
  const src=await PDFDocument.load(buf,{ignoreEncryption:true});
  const out=await PDFDocument.create();
  setProgress(30,'Reordering…');
  const order=organizePages.map(p=>p.origIdx);
  const copied=await out.copyPages(src,order);
  copied.forEach((pg,k)=>{
    const rot=(organizePages[k]&&organizePages[k].rotation)||0;
    if(rot){
      const cur=pg.getRotation().angle||0;
      pg.setRotation(degFn(((cur+rot)%360+360)%360));
    }
    out.addPage(pg);
  });
  setProgress(70,'Saving…');
  const result=await out.save({useObjectStreams:true});
  Security.wipeMemory(buf);
  const filename=`${activeFiles[0].name.replace(/\.pdf$/i,'')}_organized.pdf`;
  return {result, filename};
}
