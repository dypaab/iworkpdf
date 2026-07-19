// ============================================================
//  iWorkPDF — delete.js (logique spécifique à l'outil Delete pages)
//  Charger APRÈS security.js et shared.js.
// ============================================================

let deleteSelectedPages=new Set();

function buildDeleteUI(){
  const saveBlock=`<p class="form-label" style="margin-bottom:8px">${t('dest')}</p><div class="save-mode"><div class="save-opt active" id="so-local" onclick="setSave('local')"><div class="save-opt-icon">💾</div><div class="save-opt-title">${t('localmode')}</div><div class="save-opt-sub">${t('direct')}</div></div><div class="save-opt" id="so-cloud" onclick="setSave('cloud')"><div class="save-opt-icon">☁️ 🔒</div><div class="save-opt-title">Cloud 48h</div><div class="save-opt-sub">${t('cloudsub')}</div></div></div>`;
  const bottom=`<div class="status-box" id="ts"></div><div class="prog-wrap" id="tp"><div class="prog-bg"><div class="prog-fill" id="pf"></div></div><div class="prog-text" id="pt"></div></div><div class="share-box" id="share-result"><p style="font-size:13px;font-weight:600">🔗 ${t('signedlink')}</p><div class="share-row"><input class="share-inp" id="share-link-inp" readonly/><button class="btn-primary" style="padding:8px 14px;font-size:13px" onclick="copyLink()">${t('copylink')}</button></div><p class="share-exp" id="share-exp-txt"></p></div>`;
  return `
    <div class="drop-zone" id="dz">
      <input type="file" accept=".pdf" onchange="onPick(event,'delete')"/>
      <p class="drop-text">${t('drop')}</p>
      <button class="drop-btn"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> ${t('browse')}</button>
    </div>
    <div id="delete-preview" style="display:none">
      <div class="pg-card-tip">🖱️ ${lang==='fr'?'Cliquez sur les pages à supprimer (elles s\'affichent en rouge)':'Click pages to delete (highlighted in red)'}</div>
      <div class="merge-toolbar">
        <span class="merge-count" id="del-count">${lang==='fr'?'0 page sélectionnée':'0 page selected'}</span>
        <div style="display:flex;gap:6px">
          <button class="btn-sm" onclick="deleteSelectAll()">${lang==='fr'?'Tout sélectionner':'Select all'}</button>
          <button class="btn-sm" onclick="deleteClearSel()">${lang==='fr'?'Désélectionner':'Clear'}</button>
        </div>
      </div>
      <div class="pages-grid" id="delete-grid"></div>
    </div>
    ${saveBlock}${bottom}
    <div class="flex-end"><button class="btn-primary" onclick="run('delete')">${t('del_btn')}</button></div>`;
}

async function renderDeletePreview(){
  deleteSelectedPages=new Set();
  const prev=document.getElementById('delete-preview');
  const grid=document.getElementById('delete-grid');
  if(!prev||!grid||!activeFiles[0]) return;
  prev.style.display='block';
  grid.innerHTML=`<p style="color:var(--tx2);font-size:12px;padding:8px">${lang==='fr'?'Génération des aperçus…':'Generating previews…'}</p>`;
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
      if(deleteSelectedPages.has(idx)){deleteSelectedPages.delete(idx);card.classList.remove('selected');}
      else{deleteSelectedPages.add(idx);card.classList.add('selected');}
      updateDeleteCount();
    });
    grid.appendChild(card);
    renderThumb(canvas,activeFiles[0],i);
  }
  updateDeleteCount();
}

function updateDeleteCount(){
  const el=document.getElementById('del-count');
  if(!el) return;
  const n=deleteSelectedPages.size;
  el.textContent=lang==='fr'?`${n} page${n>1?'s':''} sélectionnée${n>1?'s':''}`:`${n} page${n>1?'s':''} selected`;
}

function deleteSelectAll(){
  document.querySelectorAll('#delete-grid .pg-card').forEach((c,i)=>{deleteSelectedPages.add(i);c.classList.add('selected');});
  updateDeleteCount();
}

function deleteClearSel(){
  deleteSelectedPages.clear();
  document.querySelectorAll('#delete-grid .pg-card').forEach(c=>c.classList.remove('selected'));
  updateDeleteCount();
}

// runDelete(activeFiles, deleteSelectedPages) -> {result, filename} | null
// null = condition d'erreur déjà gérée via earlyReturn (run() ne doit rien faire de plus).
async function runDelete(activeFiles, deleteSelectedPages){
  if(!deleteSelectedPages.size){ earlyReturn(t('nopages')); return null; }
  const buf=await activeFiles[0].arrayBuffer();
  const{PDFDocument}=PDFLib;
  const src=await PDFDocument.load(buf);
  const keep=src.getPageIndices().filter(i=>!deleteSelectedPages.has(i));
  if(!keep.length){ Security.wipeMemory(buf); earlyReturn(t('alldeleted')); return null; }
  setProgress(50,'Deleting…');
  // Suppression EN PLACE (et non reconstruction par copyPages) : le sommaire
  // (outline/bookmarks) et les liens internes des pages conservées restent
  // intacts. Avant : document neuf -> sommaire perdu, liens cassés -> les
  // visionneuses projetaient tout vers la page 1.
  [...deleteSelectedPages].sort((a,b)=>b-a).forEach(i=>src.removePage(i));
  const result=await src.save({useObjectStreams:true});
  Security.wipeMemory(buf);
  const filename=`${activeFiles[0].name.replace('.pdf','')}_edited.pdf`;
  return {result, filename};
}
