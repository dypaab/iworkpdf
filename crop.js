// ============================================================
//  iWorkPDF — crop.js (logique spécifique à l'outil Crop PDF)
//  Charger APRÈS security.js et shared.js.
// ============================================================

function buildCropUI(){
  const saveBlock=`<p class="form-label" style="margin-bottom:8px">${t('dest')}</p><div class="save-mode"><div class="save-opt active" id="so-local" onclick="setSave('local')"><div class="save-opt-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M12 3v12M7 10l5 5 5-5"/></svg></div><div class="save-opt-title">${t('localmode')}</div><div class="save-opt-sub">${t('direct')}</div></div><div class="save-opt" id="so-cloud" onclick="setSave('cloud')"><div class="save-opt-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 16a4 4 0 0 1 .4-8A5.5 5.5 0 0 1 17.5 9.5"/><rect x="13" y="13.5" width="9" height="7.5" rx="1.8"/><path d="M15.2 13.5V12a2.3 2.3 0 0 1 4.6 0v1.5"/></svg></div><div class="save-opt-title">${t('savemode')}</div><div class="save-opt-sub">${t('cloudsub')}</div></div></div>`;
  const bottom=`<div class="status-box" id="ts"></div><div class="prog-wrap" id="tp"><div class="prog-bg"><div class="prog-fill" id="pf"></div></div><div class="prog-text" id="pt"></div></div><div class="share-box" id="share-result"><p style="font-size:13px;font-weight:600">🔗 ${t('signedlink')}</p><div class="share-row"><input class="share-inp" id="share-link-inp" readonly/><button class="btn-primary" style="padding:8px 14px;font-size:13px" onclick="copyLink()">${t('copylink')}</button></div><p class="share-exp" id="share-exp-txt"></p></div>`;
  return `
    <div class="drop-zone" id="dz">
      <input type="file" accept=".pdf" onchange="onPick(event,'crop')"/>
      <p class="drop-text">${t('drop')}</p>
      <button class="drop-btn"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> ${t('browse')}</button>
    </div>
    <div class="file-list" id="fl"></div>
    <div class="crop-grid">
      <div class="pn-field">
        <label>${lang==='fr'?'Haut (mm)':'Top (mm)'}</label>
        <input class="form-input" type="number" id="crop-top" value="10" min="0" max="200" oninput="updateCropPreview()"/>
      </div>
      <div class="pn-field">
        <label>${lang==='fr'?'Bas (mm)':'Bottom (mm)'}</label>
        <input class="form-input" type="number" id="crop-bottom" value="10" min="0" max="200" oninput="updateCropPreview()"/>
      </div>
      <div class="pn-field">
        <label>${lang==='fr'?'Gauche (mm)':'Left (mm)'}</label>
        <input class="form-input" type="number" id="crop-left" value="10" min="0" max="200" oninput="updateCropPreview()"/>
      </div>
      <div class="pn-field">
        <label>${lang==='fr'?'Droite (mm)':'Right (mm)'}</label>
        <input class="form-input" type="number" id="crop-right" value="10" min="0" max="200" oninput="updateCropPreview()"/>
      </div>
    </div>
    <div id="crop-page-preview" style="text-align:center">
      <label class="form-label" style="text-align:left">${t('pn_preview')}</label>
      <div id="crop-stage" style="position:relative;display:inline-block;max-width:100%;overflow:hidden;border-radius:8px">
        <canvas id="crop-canvas" style="display:block;max-width:100%;height:auto;background:#fff;border:1px solid #d8dde5"></canvas>
        <div class="crop-inner" id="crop-inner" style="inset:8%"></div>
      </div>
      <p id="crop-empty-hint" style="font-size:13px;color:var(--tx3);padding:14px 0">${lang==='fr'?'Ajoutez un PDF pour voir la première page et la position du cadre.':'Add a PDF to preview the first page and the crop frame.'}</p>
    </div>
    ${saveBlock}${bottom}
    <div class="flex-end"><button class="btn-primary" onclick="run('crop')">${t('crop_apply')}</button></div>`;
}

// Dimensions réelles de la 1re page (mm) — remplies par renderCropPagePreview.
let _cropPageDims=null;

// Rend la PREMIÈRE PAGE du PDF dans l'aperçu, avec le cadre par-dessus.
async function renderCropPagePreview(){
  const canvas=document.getElementById('crop-canvas');
  const hint=document.getElementById('crop-empty-hint');
  if(!canvas||!activeFiles[0])return;
  try{
    await ensurePdfJs();
    const buf=await activeFiles[0].arrayBuffer();
    const doc=await pdfjsLib.getDocument({data:buf.slice(0)}).promise;
    const page=await doc.getPage(1);
    const vp0=page.getViewport({scale:1});
    const scale=Math.min(460/vp0.width,380/vp0.height);
    const vp=page.getViewport({scale});
    canvas.width=vp.width;canvas.height=vp.height;
    await page.render({canvasContext:canvas.getContext('2d'),viewport:vp}).promise;
    // 1 point PDF = 1/2.8346 mm
    _cropPageDims={wmm:vp0.width/2.8346,hmm:vp0.height/2.8346};
    Security.wipeMemory(buf);
    if(hint)hint.style.display='none';
    updateCropPreview();
  }catch(e){ if(hint)hint.textContent='⚠️ '+e.message; }
}

// Positionne le cadre selon les marges (mm) rapportées à la taille RÉELLE de la page.
function updateCropPreview(){
  const inner=document.getElementById('crop-inner');
  if(!inner) return;
  const d=_cropPageDims||{wmm:210,hmm:297}; // défaut A4 avant chargement
  const val=id=>Math.max(0,parseFloat(document.getElementById(id)?.value||'0')||0);
  inner.style.top   =Math.min(48,val('crop-top')/d.hmm*100)+'%';
  inner.style.bottom=Math.min(48,val('crop-bottom')/d.hmm*100)+'%';
  inner.style.left  =Math.min(48,val('crop-left')/d.wmm*100)+'%';
  inner.style.right =Math.min(48,val('crop-right')/d.wmm*100)+'%';
}

function showGlobalDropPicker(file){
  // Outils applicables à un seul PDF
  const singleTools=['compress','delete','split','rotate','watermark','pagenums','repair','crop','pdf2jpg','security'];
  const applicable=TOOLS.filter(t=>singleTools.includes(t.id));
  // Créer un mini modal de sélection
  const overlay=document.createElement('div');
  overlay.className='overlay active';
  overlay.style.zIndex='600';
  const modal=document.createElement('div');
  modal.className='modal';
  modal.style.maxWidth='480px';
  modal.innerHTML=`
    <div class="modal-head">
      <h3 class="modal-title">📄 ${Security.escHtml(file.name)}</h3>
      <button class="modal-close" id="picker-close">✕</button>
    </div>
    <div class="modal-body">
      <p style="font-size:13px;color:var(--tx2);margin-bottom:16px">
        ${lang==='fr'?'Que voulez-vous faire avec ce fichier ?':'What do you want to do with this file?'}
      </p>
      <div class="tools-grid" id="picker-grid"></div>
    </div>`;
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const grid=modal.querySelector('#picker-grid');
  applicable.forEach(tool=>{
    const btn=document.createElement('div');
    btn.className='tool-card';
    btn.style.cssText='padding:16px;cursor:pointer';
    btn.innerHTML=`<span style="font-size:22px">${tool.icon}</span><div style="font-size:13px;font-weight:600;margin-top:6px">${t(tool.nk)}</div>`;
    btn.addEventListener('click',()=>{
      overlay.remove();
      openTool(tool.id);
      setTimeout(async()=>await handleFiles([file],tool.id),200);
    });
    grid.appendChild(btn);
  });

  modal.querySelector('#picker-close').addEventListener('click',()=>overlay.remove());
  overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove();});
}

// runCrop(activeFiles) -> {result, filename} | null
async function runCrop(activeFiles){
  let result, filename;
  const top   =Math.max(0,parseFloat(document.getElementById('crop-top')?.value||'10'));
      const bottom=Math.max(0,parseFloat(document.getElementById('crop-bottom')?.value||'10'));
      const left  =Math.max(0,parseFloat(document.getElementById('crop-left')?.value||'10'));
      const right =Math.max(0,parseFloat(document.getElementById('crop-right')?.value||'10'));
      // Convertir mm → points PDF (1mm = 2.8346 points)
      const mm2pt=mm=>mm*2.8346;
      const buf=await activeFiles[0].arrayBuffer();
      const{PDFDocument}=PDFLib;
      const src=await PDFDocument.load(buf,{ignoreEncryption:true});
      setProgress(50,'Cropping…');
      src.getPages().forEach(page=>{
        const{width,height}=page.getSize();
        const cropBox={
          x:mm2pt(left),
          y:mm2pt(bottom),
          width:Math.max(10,width-mm2pt(left)-mm2pt(right)),
          height:Math.max(10,height-mm2pt(top)-mm2pt(bottom)),
        };
        // BUG 9 FIX: définir CropBox + MediaBox + BleedBox + TrimBox
        // pour max compatibilité avec tous les viewers PDF
        page.setCropBox(cropBox.x,cropBox.y,cropBox.width,cropBox.height);
        page.setMediaBox(cropBox.x,cropBox.y,cropBox.width,cropBox.height);
        page.setBleedBox(cropBox.x,cropBox.y,cropBox.width,cropBox.height);
        page.setTrimBox(cropBox.x,cropBox.y,cropBox.width,cropBox.height);
      });
      result=await src.save();
      Security.wipeMemory(buf);
      filename=activeFiles[0].name.replace('.pdf','')+'_cropped.pdf';
  return {result, filename};
}
