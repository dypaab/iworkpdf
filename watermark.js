// ============================================================
//  iWorkPDF — watermark.js (logique spécifique à l'outil Watermark)
//  Charger APRÈS security.js et shared.js.
// ============================================================

function buildWatermarkUI(){
  const saveBlock=`<p class="form-label" style="margin-bottom:8px">${t('dest')}</p><div class="save-mode"><div class="save-opt active" id="so-local" onclick="setSave('local')"><div class="save-opt-icon">💾</div><div class="save-opt-title">${t('localmode')}</div><div class="save-opt-sub">${t('direct')}</div></div><div class="save-opt" id="so-cloud" onclick="setSave('cloud')"><div class="save-opt-icon">☁️ 🔒</div><div class="save-opt-title">Cloud 48h</div><div class="save-opt-sub">${t('cloudsub')}</div></div></div>`;
  const bottom=`<div class="status-box" id="ts"></div><div class="prog-wrap" id="tp"><div class="prog-bg"><div class="prog-fill" id="pf"></div></div><div class="prog-text" id="pt"></div></div><div class="share-box" id="share-result"><p style="font-size:13px;font-weight:600">🔗 ${t('signedlink')}</p><div class="share-row"><input class="share-inp" id="share-link-inp" readonly/><button class="btn-primary" style="padding:8px 14px;font-size:13px" onclick="copyLink()">${t('copylink')}</button></div><p class="share-exp" id="share-exp-txt"></p></div>`;
  return `
    <div class="drop-zone" id="dz">
      <input type="file" accept=".pdf" onchange="onPick(event,'watermark')"/>
      <p class="drop-text">${t('drop')}</p>
      <button class="drop-btn"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> ${t('browse')}</button>
    </div>
    <div class="form-group">
      <label class="form-label">${t('wmlbl')}</label>
      <input class="form-input" id="wt" value="CONFIDENTIEL" maxlength="50" oninput="updateWmPreview()"/>
    </div>
    <div class="wm-preview" id="wm-preview">
      <div class="wm-preview-lines">
        <div class="wm-preview-line"></div>
        <div class="wm-preview-line"></div>
        <div class="wm-preview-line"></div>
      </div>
      <div class="wm-preview-txt" id="wm-preview-txt">CONFIDENTIEL</div>
    </div>
    ${saveBlock}${bottom}
    <div class="flex-end"><button class="btn-primary" onclick="run('watermark')">${t('wm_btn')}</button></div>`;
}

function updateWmPreview(){
  const el=document.getElementById('wm-preview-txt');
  const inp=document.getElementById('wt');
  if(el&&inp) el.textContent=inp.value||'WATERMARK';
}

// runWatermark(activeFiles, rawText) -> {result, filename} | null
async function runWatermark(activeFiles, rawText){
  const txt=Security.sanitizeText(rawText||'WATERMARK');
  if(!txt){ earlyReturn(t('nowm')); return null; }
  const buf=await activeFiles[0].arrayBuffer();
  const{PDFDocument,rgb,StandardFonts}=PDFLib;
  // BUG I FIX: degrees importé depuis PDFLib, pas destructuré séparément
  const degFn=PDFLib.degrees;
  const src=await PDFDocument.load(buf);
  const font=await src.embedFont(StandardFonts.HelveticaBold);
  setProgress(50,'Applying…');
  src.getPages().forEach(page=>{
    const{width,height}=page.getSize();
    page.drawText(txt,{x:width*.08,y:height*.43,size:Math.min(width,height)*.1,font,color:rgb(.6,.6,.6),opacity:.3,rotate:degFn(45)});
  });
  const result=await src.save();
  Security.wipeMemory(buf);
  const filename=activeFiles[0].name.replace('.pdf','')+'_watermarked.pdf';
  return {result, filename};
}
