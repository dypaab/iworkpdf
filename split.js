// ============================================================
//  iWorkPDF — split.js (logique spécifique à l'outil Split PDF)
//  Charger APRÈS security.js et shared.js.
// ============================================================

let splitSelectedPages=new Set();

function buildSplitUI(){
  const saveBlock=`<p class="form-label" style="margin-bottom:8px">${t('dest')}</p><div class="save-mode"><div class="save-opt active" id="so-local" onclick="setSave('local')"><div class="save-opt-icon">💾</div><div class="save-opt-title">${t('localmode')}</div><div class="save-opt-sub">${t('direct')}</div></div><div class="save-opt" id="so-cloud" onclick="setSave('cloud')"><div class="save-opt-icon">☁️ 🔒</div><div class="save-opt-title">Cloud 48h</div><div class="save-opt-sub">${t('cloudsub')}</div></div></div>`;
  const bottom=`<div class="status-box" id="ts"></div><div class="prog-wrap" id="tp"><div class="prog-bg"><div class="prog-fill" id="pf"></div></div><div class="prog-text" id="pt"></div></div>`;
  return `
    <div class="drop-zone" id="dz">
      <input type="file" accept=".pdf" onchange="onPick(event,'split')"/>
      <p class="drop-text">${t('drop')}</p>
      <button class="drop-btn"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> ${t('browse')}</button>
    </div>
    <div id="split-preview" style="display:none">
      <div class="pg-card-tip">🖱️ ${lang==='fr'?'Sélectionnez les pages à extraire (toutes par défaut)':'Select pages to extract (all by default)'}</div>
      <div class="merge-toolbar">
        <span class="merge-count" id="split-count"></span>
        <div style="display:flex;gap:6px">
          <button class="btn-sm" onclick="splitSelectAll()">${lang==='fr'?'Toutes':'All'}</button>
          <button class="btn-sm" onclick="splitClearSel()">${lang==='fr'?'Aucune':'None'}</button>
        </div>
      </div>
      <div class="pages-grid" id="split-grid"></div>
    </div>
    ${saveBlock}
    <div class="flex-end"><button class="btn-primary" onclick="run('split')">${t('split_btn')}</button></div>`;
}

async function renderSplitPreview(){
  splitSelectedPages=new Set();
  const prev=document.getElementById('split-preview');
  const grid=document.getElementById('split-grid');
  if(!prev||!grid||!activeFiles[0]) return;
  prev.style.display='block';
  grid.innerHTML=`<p style="color:var(--tx2);font-size:12px;padding:8px">${lang==='fr'?'Génération…':'Loading…'}</p>`;
  const n=await getPdfPageCount(activeFiles[0]);
  grid.innerHTML='';
  for(let i=0;i<n;i++){
    splitSelectedPages.add(i); // toutes sélectionnées par défaut
    const card=document.createElement('div');
    card.className='pg-card rotate-sel'; // cyan = sélectionné pour split
    card.style.borderColor='var(--cy)';
    const canvas=document.createElement('canvas');
    card.appendChild(canvas);
    const foot=document.createElement('div');
    foot.className='pg-card-footer';
    foot.textContent=`p.${i+1}`;
    card.appendChild(foot);
    const idx=i;
    card.addEventListener('click',()=>{
      if(splitSelectedPages.has(idx)){
        splitSelectedPages.delete(idx);
        card.classList.remove('rotate-sel');
        card.style.borderColor='';
      }else{
        splitSelectedPages.add(idx);
        card.classList.add('rotate-sel');
        card.style.borderColor='var(--cy)';
      }
      updateSplitCount();
    });
    grid.appendChild(card);
    renderThumb(canvas,activeFiles[0],i);
  }
  updateSplitCount();
}

function updateSplitCount(){
  const el=document.getElementById('split-count');
  if(!el) return;
  el.textContent=lang==='fr'
    ?`${splitSelectedPages.size} page${splitSelectedPages.size>1?'s':''} sélectionnée${splitSelectedPages.size>1?'s':''}`
    :`${splitSelectedPages.size} page${splitSelectedPages.size>1?'s':''} selected`;
}

function splitSelectAll(){
  document.querySelectorAll('#split-grid .pg-card').forEach((c,i)=>{
    splitSelectedPages.add(i);c.classList.add('rotate-sel');c.style.borderColor='var(--cy)';
  });updateSplitCount();
}

function splitClearSel(){
  splitSelectedPages.clear();
  document.querySelectorAll('#split-grid .pg-card').forEach(c=>{c.classList.remove('rotate-sel');c.style.borderColor='';});
  updateSplitCount();
}

// runSplit est "self-contained" : gère son propre cycle (boucles de téléchargement
// multiples, cleanup). Retourne true si succès (run() ne doit rien faire de plus).
async function runSplit(activeFiles, splitSelectedPages){
  const pagesToSplit=splitSelectedPages.size>0
        ?[...splitSelectedPages].sort((a,b)=>a-b)
        :null; // null = toutes
      const buf=await activeFiles[0].arrayBuffer();
      const{PDFDocument}=PDFLib;
      const src=await PDFDocument.load(buf);
      const n=src.getPageCount();
      const indices=pagesToSplit||src.getPageIndices();
      const stem=activeFiles[0].name.replace('.pdf','');
      let savedCount=0;
      for(let i=0;i<indices.length;i++){
        const pageIdx=indices[i];
        setProgress(5+((i+1)/indices.length)*90,`Page ${pageIdx+1}/${n}…`);
        const out=await PDFDocument.create();
        const[p]=await out.copyPages(src,[pageIdx]);
        out.addPage(p);
        const b=await out.save();
        try{
          await dlBytes(b,`${stem}_p${pageIdx+1}.pdf`);
          savedCount++;
        }catch(e){
          // BUG 3 FIX: AbortError = utilisateur a annulé → stopper proprement
          if(e.name==='AbortError'){
            Security.wipeMemory(buf);
            setProgress(100,'⚠️');hideProg();
            setStatus(`${savedCount} ${lang==='fr'?'fichiers enregistrés (annulé)':'files saved (cancelled)'}`, 'info');
            isProcessing=false;
            document.querySelectorAll('#ws-body .btn-primary').forEach(b=>b.disabled=false);
            return;
          }
          throw e;
        }
        await new Promise(r=>setTimeout(r,80));
      }
      Security.wipeMemory(buf);
      setProgress(100,'✅');hideProg();
      setStatus(`${savedCount} ${lang==='fr'?'fichiers enregistrés':'files saved'} ✅`,'ok');
      await audit(id,null,{pages:savedCount});
      // BUG 10 FIX: stats + recent
      addRecent(`${activeFiles[0].name} (${savedCount} pages)`,id,activeFiles[0].size);
      incrementStats();
      showToast(`${savedCount} ${lang==='fr'?'fichiers PDF enregistrés':'PDF files saved'}`, 'ok');
      isProcessing=false;
      document.querySelectorAll('#ws-body .btn-primary').forEach(b=>b.disabled=false);
      return;
  return true;
}
