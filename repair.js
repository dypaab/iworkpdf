// ============================================================
//  iWorkPDF — repair.js (logique spécifique à l'outil Repair PDF)
//  Charger APRÈS security.js et shared.js.
// ============================================================

function buildRepairUI(){
  const saveBlock=`<p class="form-label" style="margin-bottom:8px">${t('dest')}</p><div class="save-mode"><div class="save-opt active" id="so-local" onclick="setSave('local')"><div class="save-opt-icon">💾</div><div class="save-opt-title">${t('localmode')}</div><div class="save-opt-sub">${t('direct')}</div></div><div class="save-opt" id="so-cloud" onclick="setSave('cloud')"><div class="save-opt-icon">☁️ 🔒</div><div class="save-opt-title">Cloud 48h</div><div class="save-opt-sub">${t('cloudsub')}</div></div></div>`;
  const bottom=`<div class="status-box" id="ts"></div><div class="prog-wrap" id="tp"><div class="prog-bg"><div class="prog-fill" id="pf"></div></div><div class="prog-text" id="pt"></div></div><div class="share-box" id="share-result"><p style="font-size:13px;font-weight:600">🔗 ${t('signedlink')}</p><div class="share-row"><input class="share-inp" id="share-link-inp" readonly/><button class="btn-primary" style="padding:8px 14px;font-size:13px" onclick="copyLink()">${t('copylink')}</button></div><p class="share-exp" id="share-exp-txt"></p></div>`;
  return `
    <div class="drop-zone" id="dz">
      <input type="file" accept=".pdf" onchange="onPick(event,'repair')"/>
      <p class="drop-text">${t('drop')}</p>
      <button class="drop-btn"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> ${t('browse')}</button>
    </div>
    <div class="file-list" id="fl"></div>
    <div class="sec-info">🔧 <span>${lang==='fr'?'pdf-lib tente de lire et reconstruire la structure interne du fichier. Fonctionne sur la plupart des fichiers partiellement corrompus.':'pdf-lib attempts to read and rebuild the internal file structure. Works on most partially corrupted files.'}</span></div>
    ${saveBlock}${bottom}
    <div class="flex-end"><button class="btn-primary" onclick="run('repair')">${t('repair_apply')}</button></div>`;
}

// runRepair(activeFiles) -> {result, filename}
async function runRepair(activeFiles){
  let result, filename;
  const buf=await activeFiles[0].arrayBuffer();
      const{PDFDocument}=PDFLib;
      setProgress(40,'Repairing…');
      // pdf-lib.load avec ignoreEncryption et throwOnInvalidObject:false pour max tolérance
      let src;
      try{
        src=await PDFDocument.load(buf,{ignoreEncryption:true,throwOnInvalidObject:false});
      }catch(e){
        Security.wipeMemory(buf);
        { earlyReturn(`${lang==='fr'?'PDF trop endommagé pour être réparé':'PDF too damaged to repair'}: ${e.message}`); return null; }
      }
      setProgress(70,'Rebuilding…');
      result=await src.save({useObjectStreams:false}); // sans compression pour max compatibilité
      Security.wipeMemory(buf);
      const pageCount=src.getPageCount();
      filename=activeFiles[0].name.replace('.pdf','')+'_repaired.pdf';
      // Afficher le nombre de pages récupérées
      // BUG 7 FIX: setStatus direct, pas setTimeout
      setStatus(`✅ ${lang==='fr'?'Réparé':'Repaired'} — ${pageCount} ${lang==='fr'?'pages récupérées':'pages recovered'}`, 'ok');
  return {result, filename};
}
