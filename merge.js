// ============================================================
//  iWorkPDF — merge.js (logique spécifique à l'outil Merge PDFs)
//  Charger APRÈS security.js et shared.js.
//
//  Modèle "1 carte = 1 DOCUMENT" (style iLovePDF) :
//  - aperçu de la 1re page, ↻ pour pivoter le document, ✕ pour le retirer,
//    glisser-déposer pour réordonner les documents.
//  - mergeDocs[i] correspond à activeFiles[i] : {rotation, pages}
// ============================================================

let mergeDocs = [];
let dragSrcDoc = null;

function buildMergeUI(){
  const saveBlock=`<p class="form-label" style="margin-bottom:8px">${t('dest')}</p><div class="save-mode"><div class="save-opt active" id="so-local" onclick="setSave('local')"><div class="save-opt-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M12 3v12M7 10l5 5 5-5"/></svg></div><div class="save-opt-title">${t('localmode')}</div><div class="save-opt-sub">${t('direct')}</div></div><div class="save-opt" id="so-cloud" onclick="setSave('cloud')"><div class="save-opt-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 16a4 4 0 0 1 .4-8A5.5 5.5 0 0 1 17.5 9.5"/><rect x="13" y="13.5" width="9" height="7.5" rx="1.8"/><path d="M15.2 13.5V12a2.3 2.3 0 0 1 4.6 0v1.5"/></svg></div><div class="save-opt-title">${t('savemode')}</div><div class="save-opt-sub">${t('cloudsub')}</div></div></div>`;
  const bottom=`<div class="status-box" id="ts"></div><div class="prog-wrap" id="tp"><div class="prog-bg"><div class="prog-fill" id="pf"></div></div><div class="prog-text" id="pt"></div></div><div class="share-box" id="share-result"><p style="font-size:13px;font-weight:600">🔗 ${t('signedlink')}</p><div class="share-row"><input class="share-inp" id="share-link-inp" readonly/><button class="btn-primary" style="padding:8px 14px;font-size:13px" onclick="copyLink()">${t('copylink')}</button></div><p class="share-exp" id="share-exp-txt"></p></div>`;
  return `
    <div class="drop-zone" id="dz">
      <input type="file" accept=".pdf" multiple onchange="onPick(event,'merge')"/>
      <p class="drop-text">${t('drop')}</p>
      <button class="drop-btn"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> ${t('browse')}</button>
    </div>
    <div class="merge-toolbar" id="merge-toolbar" style="display:none">
      <span class="merge-count" id="merge-count"></span>
      <div style="display:flex;gap:6px">
        <button class="btn-sm" onclick="mergeReset()">🗑 ${lang==='fr'?'Vider':'Clear all'}</button>
      </div>
    </div>
    <div class="pg-card-tip" id="merge-tip" style="display:none">↔️ ${lang==='fr'?'Glissez pour réordonner · ↻ pour pivoter · ✕ pour retirer un document':'Drag to reorder · ↻ to rotate · ✕ to remove a document'}</div>
    <div class="merge-docs-grid" id="merge-grid">
      <div class="merge-empty">${lang==='fr'?'Ajoutez des PDFs':'Add PDFs'}</div>
    </div>
    ${saveBlock}${bottom}
    <div class="flex-end"><button class="btn-primary" onclick="run('merge')">${t('merge_btn')}</button></div>`;
}

// Synchronise mergeDocs avec activeFiles (ajouts en fin de liste).
function syncMergeDocs(){
  while(mergeDocs.length<activeFiles.length) mergeDocs.push({rotation:0,pages:0});
  if(mergeDocs.length>activeFiles.length) mergeDocs.length=activeFiles.length;
}

async function renderMergePages(){
  const grid=document.getElementById('merge-grid');
  const toolbar=document.getElementById('merge-toolbar');
  const tip=document.getElementById('merge-tip');
  if(!grid) return;
  syncMergeDocs();
  if(!activeFiles.length){
    grid.innerHTML=`<div class="merge-empty">${lang==='fr'?'Ajoutez des PDFs':'Add PDFs'}</div>`;
    if(toolbar)toolbar.style.display='none';
    if(tip)tip.style.display='none';
    if(typeof syncHasFiles==='function') syncHasFiles();
    return;
  }
  await ensurePdfJs();
  grid.innerHTML='';
  activeFiles.forEach((f,i)=>{
    const doc=mergeDocs[i];
    const card=document.createElement('div');
    card.className='md-card';
    card.draggable=true;
    card.dataset.idx=i;
    const canvas=document.createElement('canvas');
    canvas.className='md-thumb';
    card.appendChild(canvas);
    // Actions ↻ / ✕
    const rot=document.createElement('button');
    rot.className='md-btn md-rotate';
    rot.innerHTML='↻';
    rot.title=lang==='fr'?'Pivoter le document (90°)':'Rotate document (90°)';
    rot.addEventListener('click',e=>{
      e.stopPropagation();
      doc.rotation=(doc.rotation+90)%360;
      renderMergeThumb(canvas,i);
    });
    card.appendChild(rot);
    const del=document.createElement('button');
    del.className='md-btn md-del';
    del.innerHTML='✕';
    del.title=lang==='fr'?'Retirer ce document':'Remove this document';
    del.addEventListener('click',e=>{
      e.stopPropagation();
      activeFiles.splice(i,1);
      mergeDocs.splice(i,1);
      renderMergePages();
    });
    card.appendChild(del);
    // Nom + nb pages
    const foot=document.createElement('div');
    foot.className='md-name';
    foot.textContent=f.name;
    card.appendChild(foot);
    const meta=document.createElement('div');
    meta.className='md-meta';
    meta.id=`md-meta-${i}`;
    card.appendChild(meta);
    // Flèches de déplacement — le drag HTML5 ne marche pas au tactile
    // (affichées uniquement sur écrans tactiles via CSS @media(hover:none))
    const mv=document.createElement('div');
    mv.className='md-move';
    const swap=(a,b)=>{
      const f=activeFiles.splice(a,1)[0];activeFiles.splice(b,0,f);
      const d=mergeDocs.splice(a,1)[0];mergeDocs.splice(b,0,d);
      renderMergePages();
    };
    const bl=document.createElement('button');bl.className='md-mv';bl.textContent='‹';
    bl.setAttribute('aria-label',lang==='fr'?'Déplacer à gauche':'Move left');
    bl.disabled=i===0;
    bl.addEventListener('click',e=>{e.stopPropagation();if(i>0)swap(i,i-1);});
    const br=document.createElement('button');br.className='md-mv';br.textContent='›';
    br.setAttribute('aria-label',lang==='fr'?'Déplacer à droite':'Move right');
    br.disabled=i===activeFiles.length-1;
    br.addEventListener('click',e=>{e.stopPropagation();if(i<activeFiles.length-1)swap(i,i+1);});
    mv.appendChild(bl);mv.appendChild(br);
    card.appendChild(mv);
    // Drag & drop réordonnement (documents)
    card.addEventListener('dragstart',e=>{dragSrcDoc=i;card.classList.add('dragging');e.dataTransfer.effectAllowed='move';});
    card.addEventListener('dragend',()=>{card.classList.remove('dragging');document.querySelectorAll('.md-card').forEach(c=>c.classList.remove('drag-over'));});
    card.addEventListener('dragover',e=>{e.preventDefault();document.querySelectorAll('.md-card').forEach(c=>c.classList.remove('drag-over'));card.classList.add('drag-over');});
    card.addEventListener('drop',e=>{
      e.preventDefault();
      if(dragSrcDoc===null||dragSrcDoc===i)return;
      const mf=activeFiles.splice(dragSrcDoc,1)[0];
      activeFiles.splice(i,0,mf);
      const md=mergeDocs.splice(dragSrcDoc,1)[0];
      mergeDocs.splice(i,0,md);
      dragSrcDoc=null;
      renderMergePages();
    });
    grid.appendChild(card);
    renderMergeThumb(canvas,i);
  });
  updateMergeCount();
  if(toolbar)toolbar.style.display='flex';
  if(tip)tip.style.display='block';
  if(typeof syncHasFiles==='function') syncHasFiles();
}

// Aperçu 1re page du document i, avec la rotation choisie.
async function renderMergeThumb(canvas,i){
  try{
    const buf=await activeFiles[i].arrayBuffer();
    const pdfDoc=await pdfjsLib.getDocument({data:buf.slice(0)}).promise;
    mergeDocs[i].pages=pdfDoc.numPages;
    const meta=document.getElementById(`md-meta-${i}`);
    if(meta)meta.textContent=`${pdfDoc.numPages} page${pdfDoc.numPages>1?'s':''}`;
    updateMergeCount();
    const page=await pdfDoc.getPage(1);
    const base=page.getViewport({scale:1});
    const rotation=(base.rotation+(mergeDocs[i]?mergeDocs[i].rotation:0))%360;
    const vp0=page.getViewport({scale:1,rotation});
    const scale=Math.min(220/vp0.width,180/vp0.height);
    const vp=page.getViewport({scale,rotation});
    canvas.width=vp.width;canvas.height=vp.height;
    await page.render({canvasContext:canvas.getContext('2d'),viewport:vp}).promise;
    Security.wipeMemory(buf);
  }catch(e){
    const ctx=canvas.getContext('2d');
    canvas.width=140;canvas.height=170;
    ctx.fillStyle='#f5f5f5';ctx.fillRect(0,0,140,170);
    ctx.fillStyle='#8B9CB6';ctx.font='12px sans-serif';ctx.textAlign='center';
    ctx.fillText('PDF',70,88);
  }
}

function mergeReset(){
  activeFiles=[];
  mergeDocs=[];
  renderMergePages();
}

function updateMergeCount(){
  const el=document.getElementById('merge-count');
  if(!el) return;
  const nd=activeFiles.length;
  const np=mergeDocs.reduce((s,d)=>s+(d.pages||0),0);
  el.textContent=lang==='fr'
    ?`${nd} document${nd>1?'s':''} · ${np} page${np>1?'s':''}`
    :`${nd} document${nd>1?'s':''} · ${np} page${np>1?'s':''}`;
}

// runMerge(activeFiles, mergeDocs) -> {result, filename} | null
// Fusionne les documents dans l'ordre affiché, avec la rotation par document.
async function runMerge(activeFiles, mergeDocs){
  if(!activeFiles.length){ earlyReturn(t('nofile')); return null; }
  const{PDFDocument}=PDFLib;
  const degFn=PDFLib.degrees;
  const merged=await PDFDocument.create();
  // ⚠️ Les buffers ne sont wipés qu'APRÈS merged.save() : pdf-lib garde des
  // vues sur ces octets (flux copiés par référence).
  const bufs=[];
  for(let i=0;i<activeFiles.length;i++){
    setProgress(5+((i+1)/activeFiles.length)*80,`Document ${i+1}/${activeFiles.length}…`);
    const buf=await activeFiles[i].arrayBuffer();
    bufs.push(buf);
    const src=await PDFDocument.load(buf,{ignoreEncryption:true});
    const pages=await merged.copyPages(src,src.getPageIndices());
    const rot=(mergeDocs[i]&&mergeDocs[i].rotation)||0;
    pages.forEach(p=>{
      if(rot){
        const cur=p.getRotation().angle||0;
        p.setRotation(degFn(((cur+rot)%360+360)%360));
      }
      merged.addPage(p);
    });
  }
  const result=await merged.save();
  bufs.forEach(b=>Security.wipeMemory(b));
  const filename='fusion_'+activeFiles.map(f=>f.name.replace('.pdf','')).join('_').substring(0,40)+'.pdf';
  return {result, filename};
}
