// ============================================================
//  iWorkPDF — pages.js (outil « Extraire des pages »)
//  Charger APRÈS security.js et shared.js.
//  Complémentaire de delete/split : ici on GARDE une sélection et on produit
//  UN seul PDF, au lieu de retirer des pages ou d'éclater le document.
// ============================================================

function buildPagesUI(){
  const saveBlock=`<p class="form-label" style="margin-bottom:8px">${t('dest')}</p><div class="save-mode"><div class="save-opt active" id="so-local" onclick="setSave('local')"><div class="save-opt-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M12 3v12M7 10l5 5 5-5"/></svg></div><div class="save-opt-title">${t('localmode')}</div><div class="save-opt-sub">${t('direct')}</div></div><div class="save-opt" id="so-cloud" onclick="setSave('cloud')"><div class="save-opt-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 16a4 4 0 0 1 .4-8A5.5 5.5 0 0 1 17.5 9.5"/><rect x="13" y="13.5" width="9" height="7.5" rx="1.8"/><path d="M15.2 13.5V12a2.3 2.3 0 0 1 4.6 0v1.5"/></svg></div><div class="save-opt-title">${t('savemode')}</div><div class="save-opt-sub">${t('cloudsub')}</div></div></div>`;
  const bottom=`<div class="status-box" id="ts"></div><div class="prog-wrap" id="tp"><div class="prog-bg"><div class="prog-fill" id="pf"></div></div><div class="prog-text" id="pt"></div></div><div class="share-box" id="share-result"><p style="font-size:13px;font-weight:600">🔗 ${t('signedlink')}</p><div class="share-row"><input class="share-inp" id="share-link-inp" readonly/><button class="btn-primary" style="padding:8px 14px;font-size:13px" onclick="copyLink()">${t('copylink')}</button></div><p class="share-exp" id="share-exp-txt"></p></div>`;
  return `
    <div class="drop-zone" id="dz">
      <input type="file" accept=".pdf" onchange="onPick(event,'pages')"/>
      <p class="drop-text">${t('drop')}</p>
      <button class="drop-btn"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> ${t('browse')}</button>
    </div>
    <div class="form-group">
      <label class="form-label" for="pg-range">${t('pages_lbl')}</label>
      <input class="form-input" type="text" id="pg-range" placeholder="1,3,5-8" maxlength="200" autocomplete="off" oninput="updatePagesInfo()"/>
      <p class="form-hint" style="margin-top:8px;font-size:12px;color:var(--tx3)">${t('pages_hint')}</p>
      <div id="pg-info" style="margin-top:8px;font-size:12px;color:var(--tx2)"></div>
    </div>
    ${saveBlock}${bottom}
    <div class="flex-end"><button class="btn-primary" onclick="run('pages')">${t('pages_btn')}</button></div>`;
}

// Nombre de pages du fichier courant, mis en cache : recharger le PDF à chaque
// frappe dans le champ serait inutilement coûteux sur un gros document.
let _pagesTotal = 0, _pagesTotalFor = null;
async function pagesTotalCount(){
  const f = activeFiles[0];
  if(!f) return 0;
  if(_pagesTotalFor === f) return _pagesTotal;
  const buf = await f.arrayBuffer();
  try{
    const doc = await PDFLib.PDFDocument.load(buf, {ignoreEncryption:true});
    _pagesTotal = doc.getPageCount();
    _pagesTotalFor = f;
  }catch{ _pagesTotal = 0; _pagesTotalFor = null; }
  Security.wipeMemory(buf);
  return _pagesTotal;
}

// Retour immédiat : l'utilisateur voit combien de pages seront extraites AVANT
// de lancer, au lieu de découvrir un résultat vide après coup.
async function updatePagesInfo(){
  const info = document.getElementById('pg-info');
  const inp = document.getElementById('pg-range');
  if(!info || !inp) return;
  const total = await pagesTotalCount();
  if(!total){ info.textContent=''; return; }
  const raw = inp.value.trim();
  if(!raw){
    info.textContent = `${total} ${t('pages_total')}`;
    info.style.color = 'var(--tx2)';
    return;
  }
  const sel = Security.parsePages(raw, total);
  info.textContent = `${sel.size} / ${total} ${t('pages_selected')}`;
  info.style.color = sel.size ? 'var(--tx2)' : 'var(--er)';
}

// runPages() -> {result, filename} | null  (null = erreur déjà signalée)
async function runPages(activeFiles){
  const raw = (document.getElementById('pg-range')?.value || '').trim();
  if(!raw){ earlyReturn(t('nopages')); return null; }

  const buf = await activeFiles[0].arrayBuffer();
  const {PDFDocument} = PDFLib;
  const src = await PDFDocument.load(buf);
  const total = src.getPageCount();
  const sel = Security.parsePages(raw, total);
  if(!sel.size){ Security.wipeMemory(buf); earlyReturn(t('nopages')); return null; }

  setProgress(50, t('processing'));
  // Ordre croissant : « 5-8,1 » doit produire 1,5,6,7,8 et non l'ordre de
  // saisie, qui surprendrait sur un outil d'extraction.
  const idx = [...sel].sort((a,b)=>a-b);
  const out = await PDFDocument.create();
  const copied = await out.copyPages(src, idx);
  copied.forEach(p => out.addPage(p));

  const result = await out.save({useObjectStreams:true});
  Security.wipeMemory(buf);
  const base = activeFiles[0].name.replace(/\.pdf$/i,'');
  return {result, filename:`${base}_pages.pdf`};
}
