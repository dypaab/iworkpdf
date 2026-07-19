// ============================================================
//  iWorkPDF — merge.js (logique spécifique à l'outil Merge PDFs)
//  Charger APRÈS security.js et shared.js.
// ============================================================

let mergePages = [];
let dragSrc = null;

function buildMergeUI(){
  const saveBlock=`<p class="form-label" style="margin-bottom:8px">${t('dest')}</p><div class="save-mode"><div class="save-opt active" id="so-local" onclick="setSave('local')"><div class="save-opt-icon">💾</div><div class="save-opt-title">${t('localmode')}</div><div class="save-opt-sub">${t('direct')}</div></div><div class="save-opt" id="so-cloud" onclick="setSave('cloud')"><div class="save-opt-icon">☁️ 🔒</div><div class="save-opt-title">Cloud 48h</div><div class="save-opt-sub">${t('cloudsub')}</div></div></div>`;
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
        <button class="btn-sm" onclick="mergeSelectAll()">✅ ${lang==='fr'?'Tout inclure':'Include all'}</button>
        <button class="btn-sm" onclick="mergeReset()">🗑 ${lang==='fr'?'Vider':'Clear all'}</button>
      </div>
    </div>
    <div class="merge-pages-grid" id="merge-grid">
      <div class="merge-empty">${lang==='fr'?'Ajoutez des PDFs pour voir les pages':'Add PDFs to preview pages'}</div>
    </div>
    ${saveBlock}${bottom}
    <div class="flex-end"><button class="btn-primary" onclick="run('merge')">${t('merge_btn')}</button></div>`;
}

async function renderMergePages(){
  mergePages = [];
  const grid = document.getElementById('merge-grid');
  const toolbar = document.getElementById('merge-toolbar');
  if(!grid) return;
  grid.innerHTML = `<div class="merge-empty">${lang==='fr'?'Génération des aperçus…':'Generating previews…'}</div>`;

  // BUG 1 FIX: utiliser ensurePdfJs() partagé
  await ensurePdfJs();

  // Générer les miniatures pour chaque fichier
  for(let fi=0; fi<activeFiles.length; fi++){
    const file = activeFiles[fi];
    const label = file.name.replace('.pdf','').substring(0,15);
    const buf = await file.arrayBuffer();
    const pdfDoc = await pdfjsLib.getDocument({data: buf.slice(0)}).promise;
    for(let pi=0; pi<pdfDoc.numPages; pi++){
      mergePages.push({fileIdx:fi, pageIdx:pi, fileLabel:label, docLabel:`Doc ${fi+1}`, excluded:false});
    }
    Security.wipeMemory(buf);
  }

  updateMergeGrid();
  if(toolbar) toolbar.style.display='flex';
  if(typeof syncHasFiles==='function') syncHasFiles();
}

function updateMergeGrid(){
  const grid = document.getElementById('merge-grid');
  if(!grid) return;
  updateMergeCount();
  if(!mergePages.length){
    grid.innerHTML=`<div class="merge-empty">${lang==='fr'?'Aucune page':'No pages'}</div>`;
    return;
  }
  grid.innerHTML='';
  mergePages.forEach((pg, idx) => {
    const card = document.createElement('div');
    card.className = 'mp-card' + (pg.excluded?' excluded':'');
    card.draggable = true;
    card.dataset.idx = idx;
    card.dataset.fileIdx = pg.fileIdx;
    card.dataset.pageIdx = pg.pageIdx;

    // Canvas miniature
    const canvas = document.createElement('canvas');
    canvas.style.cssText='width:100%;height:110px;object-fit:contain;display:block;background:#f5f5f5';
    card.appendChild(canvas);

    // Badge document
    const docBadge = document.createElement('div');
    docBadge.className='mp-doc-sep';
    docBadge.textContent=pg.docLabel;
    card.appendChild(docBadge);

    // Footer
    const footer = document.createElement('div');
    footer.className='mp-footer';
    footer.innerHTML=`<span class="mp-label">${Security.escHtml(pg.fileLabel)}</span><span class="mp-num">p.${pg.pageIdx+1}</span>`;
    card.appendChild(footer);

    // Bouton supprimer
    const del = document.createElement('button');
    del.className='mp-del';
    del.innerHTML='✕';
    del.title=lang==='fr'?'Exclure cette page':'Exclude this page';
    del.addEventListener('click', e=>{e.stopPropagation(); toggleMergePage(idx);});
    card.appendChild(del);

    // Drag & Drop
    card.addEventListener('dragstart', e=>{
      dragSrc=idx;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed='move';
    });
    card.addEventListener('dragend', ()=>{
      card.classList.remove('dragging');
      document.querySelectorAll('.mp-card').forEach(c=>c.classList.remove('drag-over'));
    });
    card.addEventListener('dragover', e=>{
      e.preventDefault();
      e.dataTransfer.dropEffect='move';
      document.querySelectorAll('.mp-card').forEach(c=>c.classList.remove('drag-over'));
      card.classList.add('drag-over');
    });
    card.addEventListener('drop', e=>{
      e.preventDefault();
      if(dragSrc===null||dragSrc===idx)return;
      const moved=mergePages.splice(dragSrc,1)[0];
      mergePages.splice(idx,0,moved);
      dragSrc=null;
      updateMergeGrid();
      // Re-render thumbnails
      renderMergeThumbnails();
    });

    grid.appendChild(card);
  });

  renderMergeThumbnails();
}

async function renderMergeThumbnails(){
  if(!window.pdfjsLib) return;
  // BUG 2 FIX: cache pdfDoc par fileIdx pour ne pas recharger N fois le même fichier
  const pdfCache={};
  const cards=[...document.querySelectorAll('.mp-card')];
  for(let i=0;i<cards.length;i++){
    const card=cards[i];
    const idx=parseInt(card.dataset.idx);
    if(idx>=mergePages.length) continue;
    const pg=mergePages[idx];
    const canvas=card.querySelector('canvas');
    if(!canvas) continue;
    try{
      if(!pdfCache[pg.fileIdx]){
        const buf=await activeFiles[pg.fileIdx].arrayBuffer();
        pdfCache[pg.fileIdx]=await pdfjsLib.getDocument({data:buf.slice(0)}).promise;
        Security.wipeMemory(buf);
      }
      const pdfDoc=pdfCache[pg.fileIdx];
      const page=await pdfDoc.getPage(pg.pageIdx+1);
      const vp=page.getViewport({scale:0.25});
      canvas.width=vp.width;canvas.height=vp.height;
      await page.render({canvasContext:canvas.getContext('2d'),viewport:vp}).promise;
    }catch(e){
      const ctx=canvas.getContext('2d');
      canvas.width=90;canvas.height=110;
      ctx.fillStyle='#1E2D45';ctx.fillRect(0,0,90,110);
      ctx.fillStyle='#8B9CB6';ctx.font='10px sans-serif';ctx.textAlign='center';
      ctx.fillText('PDF',45,58);
    }
  }
}

function toggleMergePage(idx){
  if(idx>=mergePages.length)return;
  mergePages[idx].excluded=!mergePages[idx].excluded;
  const cards=document.querySelectorAll('.mp-card');
  const card=cards[idx];
  if(card) card.classList.toggle('excluded', mergePages[idx].excluded);
  updateMergeCount();
}

function mergeSelectAll(){
  mergePages.forEach(p=>p.excluded=false);
  document.querySelectorAll('.mp-card').forEach(c=>c.classList.remove('excluded'));
  updateMergeCount();
}

function mergeReset(){
  activeFiles=[];
  mergePages=[];
  const grid=document.getElementById('merge-grid');
  if(grid) grid.innerHTML=`<div class="merge-empty">${lang==='fr'?'Ajoutez des PDFs pour voir les pages':'Add PDFs to preview pages'}</div>`;
  const toolbar=document.getElementById('merge-toolbar');
  if(toolbar) toolbar.style.display='none';
  if(typeof syncHasFiles==='function') syncHasFiles();
}

function updateMergeCount(){
  const el=document.getElementById('merge-count');
  if(!el) return;
  const total=mergePages.length;
  const included=mergePages.filter(p=>!p.excluded).length;
  el.textContent=lang==='fr'
    ?`${included}/${total} pages incluses`
    :`${included}/${total} pages included`;
}

// runMerge(activeFiles, mergePages) -> {result, filename} | null
async function runMerge(activeFiles, mergePages){
  // BUG 12 FIX: lire mergePages directement (source de vérité), pas le DOM
  const toMerge=mergePages.filter(p=>!p.excluded);
  if(!toMerge.length){ earlyReturn(t('nofile')); return null; }
  const{PDFDocument}=PDFLib;
  const merged=await PDFDocument.create();
  // Cache pdfDoc par fileIdx (BUG 2 FIX déjà appliqué ici)
  const docCache={};
  // ⚠️ Les buffers ne doivent être wipés qu'APRÈS merged.save() : pdf-lib
  // garde des vues sur ces octets (flux copiés par référence) — les effacer
  // dans la boucle pouvait produire des pages corrompues/blanches.
  const bufs=[];
  for(let i=0;i<toMerge.length;i++){
    const pg=toMerge[i];
    setProgress(5+((i+1)/toMerge.length)*80,`Page ${i+1}/${toMerge.length}…`);
    if(!docCache[pg.fileIdx]){
      const buf=await activeFiles[pg.fileIdx].arrayBuffer();
      bufs.push(buf);
      docCache[pg.fileIdx]=await PDFDocument.load(buf,{ignoreEncryption:true});
    }
    const[page]=await merged.copyPages(docCache[pg.fileIdx],[pg.pageIdx]);
    merged.addPage(page);
  }
  const result=await merged.save();
  bufs.forEach(b=>Security.wipeMemory(b));
  const filename='fusion_'+activeFiles.map(f=>f.name.replace('.pdf','')).join('_').substring(0,40)+'.pdf';
  return {result, filename};
}
