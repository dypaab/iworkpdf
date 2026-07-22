// ============================================================
//  iWorkPDF — ocr.js (outil OCR — reconnaissance de texte)
//  Charger APRÈS security.js et shared.js.
//
//  100% LOCAL : tesseract.js (moteur + modèle de langue) est téléchargé
//  depuis un CDN open-source, EXACTEMENT comme pdf-lib. Le PDF/l'image de
//  l'utilisateur, lui, ne quitte JAMAIS le navigateur — l'OCR s'exécute
//  entièrement sur l'appareil. Sortie : un PDF CHERCHABLE (image d'origine
//  + calque de texte invisible) généré par le renderer PDF de Tesseract,
//  puis fusionné avec pdf-lib.
// ============================================================

let ocrLang = 'eng+fra';   // défaut : anglais + français

// Chemins jsdelivr (déjà autorisés par la CSP : script-src / connect-src).
const TESS_VER='5';
const TESS_PATHS={
  workerPath:`https://cdn.jsdelivr.net/npm/tesseract.js@${TESS_VER}/dist/worker.min.js`,
  corePath:`https://cdn.jsdelivr.net/npm/tesseract.js-core@${TESS_VER}`,
  langPath:'https://cdn.jsdelivr.net/gh/naptha/tessdata@gh-pages/4.0.0'
};

async function ensureTesseract(){
  if(window.Tesseract) return;
  await new Promise((res,rej)=>{
    const s=document.createElement('script');
    s.src=`https://cdn.jsdelivr.net/npm/tesseract.js@${TESS_VER}/dist/tesseract.min.js`;
    s.onload=()=>res();
    s.onerror=()=>rej(new Error(lang==='fr'?'Impossible de charger le moteur OCR (hors ligne ?).':'Failed to load the OCR engine (offline?).'));
    document.head.appendChild(s);
  });
}

function buildOcrUI(){
  const saveBlock=`<p class="form-label" style="margin-bottom:8px">${t('dest')}</p><div class="save-mode"><div class="save-opt active" id="so-local" onclick="setSave('local')"><div class="save-opt-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M12 3v12M7 10l5 5 5-5"/></svg></div><div class="save-opt-title">${t('localmode')}</div><div class="save-opt-sub">${t('direct')}</div></div><div class="save-opt" id="so-cloud" onclick="setSave('cloud')"><div class="save-opt-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 16a4 4 0 0 1 .4-8A5.5 5.5 0 0 1 17.5 9.5"/><rect x="13" y="13.5" width="9" height="7.5" rx="1.8"/><path d="M15.2 13.5V12a2.3 2.3 0 0 1 4.6 0v1.5"/></svg></div><div class="save-opt-title">${t('savemode')}</div><div class="save-opt-sub">${t('cloudsub')}</div></div></div>`;
  const bottom=`<div class="status-box" id="ts"></div><div class="prog-wrap" id="tp"><div class="prog-bg"><div class="prog-fill" id="pf"></div></div><div class="prog-text" id="pt"></div></div><div class="share-box" id="share-result"><p style="font-size:13px;font-weight:600">🔗 ${t('signedlink')}</p><div class="share-row"><input class="share-inp" id="share-link-inp" readonly/><button class="btn-primary" style="padding:8px 14px;font-size:13px" onclick="copyLink()">${t('copylink')}</button></div><p class="share-exp" id="share-exp-txt"></p></div>`;
  const L=(fr,en)=>lang==='fr'?fr:en;
  return `
    <div class="drop-zone" id="dz">
      <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onchange="onPick(event,'ocr')"/>
      <p class="drop-text">${L('Déposez un PDF scanné ou une image','Drop a scanned PDF or an image')}</p>
      <button class="drop-btn"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> ${t('browse')}</button>
    </div>
    <div class="file-list" id="fl"></div>
    <div class="form-group">
      <label class="form-label">${L('Langue du document','Document language')}</label>
      <div class="radio-group" id="rg-ocr">
        <button class="rbn active" onclick="setRbn('rg-ocr',this,'eng+fra','ocrlang')">${L('Auto (EN+FR)','Auto (EN+FR)')}</button>
        <button class="rbn" onclick="setRbn('rg-ocr',this,'eng','ocrlang')">English</button>
        <button class="rbn" onclick="setRbn('rg-ocr',this,'fra','ocrlang')">Français</button>
      </div>
    </div>
    <div class="sec-info">🔒 <span>${L(
      'Le texte est reconnu 100% dans votre navigateur (moteur open-source tesseract.js). Votre fichier n\'est jamais envoyé. Résultat : un PDF cherchable et copiable. L\'OCR peut prendre quelques secondes par page.',
      'Text is recognized 100% in your browser (open-source tesseract.js engine). Your file is never uploaded. Result: a searchable, copyable PDF. OCR may take a few seconds per page.')}</span></div>
    <div id="ocr-results" style="display:none;margin-top:12px"></div>
    ${saveBlock}${bottom}
    <div class="flex-end"><button class="btn-primary" onclick="run('ocr')">${L('🔎 Lancer l\'OCR','🔎 Run OCR')}</button></div>`;
}

// Rend une page PDF en canvas (résolution adaptée à l'OCR).
async function ocrRenderPdfPage(pdfDoc,pageNum){
  const page=await pdfDoc.getPage(pageNum);
  const base=page.getViewport({scale:1});
  const target=2000; // côté le plus long visé (précision OCR vs mémoire)
  const scale=Math.min(3,Math.max(1.2,target/Math.max(base.width,base.height)));
  const vp=page.getViewport({scale});
  const canvas=document.createElement('canvas');
  canvas.width=Math.round(vp.width);canvas.height=Math.round(vp.height);
  await page.render({canvasContext:canvas.getContext('2d'),viewport:vp}).promise;
  return canvas;
}

// runOcr est "self-contained" : gère son propre rendu + téléchargement.
async function runOcr(activeFiles,lng){
  const box=document.getElementById('ocr-results');
  if(box){box.style.display='none';box.innerHTML='';}
  const file=activeFiles[0];
  const ext=(file.name.split('.').pop()||'').toLowerCase();
  const stem=file.name.replace(/\.(pdf|jpe?g|png|webp)$/i,'');

  setProgress(4,lang==='fr'?'Chargement du moteur OCR…':'Loading OCR engine…');
  await ensureTesseract();

  // 1) Constituer la liste des images-pages
  const sources=[]; // canvas | File
  let pdfBuf=null;
  if(ext==='pdf'){
    await ensurePdfJs();
    pdfBuf=await file.arrayBuffer();
    const doc=await pdfjsLib.getDocument({data:pdfBuf.slice(0)}).promise;
    for(let p=1;p<=doc.numPages;p++){
      setProgress(4+p/doc.numPages*8,lang==='fr'?`Préparation page ${p}/${doc.numPages}…`:`Preparing page ${p}/${doc.numPages}…`);
      sources.push(await ocrRenderPdfPage(doc,p));
    }
  }else{
    sources.push(file); // Tesseract lit directement une image
  }

  // 2) OCR page par page → PDF cherchable par page
  let worker=null;
  const pdfParts=[]; let confSum=0,confN=0;
  try{
    worker=await Tesseract.createWorker(lng||'eng+fra',1,{
      ...TESS_PATHS,
      logger:m=>{
        if(m&&m.status==='recognizing text'&&typeof m.progress==='number'){
          const base=15, span=70;
          const per=span/Math.max(1,sources.length);
          setProgress(Math.min(88,base+per*(_ocrPageIdx+m.progress)),
            lang==='fr'?`Reconnaissance ${_ocrPageIdx+1}/${sources.length}…`:`Recognizing ${_ocrPageIdx+1}/${sources.length}…`);
        }
      }
    });
    for(let i=0;i<sources.length;i++){
      _ocrPageIdx=i;
      const{data}=await worker.recognize(sources[i],{},{pdf:true});
      if(data&&data.pdf){
        pdfParts.push(data.pdf instanceof Uint8Array?data.pdf:new Uint8Array(data.pdf));
      }
      if(data&&typeof data.confidence==='number'){confSum+=data.confidence;confN++;}
      // libère le canvas
      if(sources[i]&&sources[i].width!==undefined){sources[i].width=0;sources[i].height=0;}
    }
  }finally{
    if(worker){try{await worker.terminate();}catch(_){}}
    if(pdfBuf)Security.wipeMemory(pdfBuf);
  }

  if(!pdfParts.length){
    setProgress(100,'⚠️');hideProg();
    setStatus(lang==='fr'?'Aucun texte reconnu. Le document est peut-être vide ou trop flou.':'No text recognized. The document may be blank or too blurry.','info');
    isProcessing=false;
    document.querySelectorAll('#ws-body .btn-primary, #tool-body .btn-primary').forEach(b=>b.disabled=false);
    return;
  }

  // 3) Fusion des pages en un seul PDF cherchable
  setProgress(92,lang==='fr'?'Assemblage du PDF cherchable…':'Assembling searchable PDF…');
  const{PDFDocument}=PDFLib;
  const out=await PDFDocument.create();
  for(const part of pdfParts){
    try{
      const src=await PDFDocument.load(part,{ignoreEncryption:true});
      const cp=await out.copyPages(src,src.getPageIndices());
      cp.forEach(pg=>out.addPage(pg));
    }catch(_){}
  }
  const result=await out.save({useObjectStreams:true});
  const conf=confN?Math.round(confSum/confN):null;
  const filename=`${stem}_ocr.pdf`;

  // 4) Téléchargement + confiance
  try{
    const keep=result.slice();
    Security.wipeMemory(result);
    try{ await dlBytes(keep.slice(),filename); }
    catch(e){ if(e.name!=='AbortError') throw e; }
    setProgress(100,'✅');hideProg();
    renderOcrResult(conf,filename);
    await audit('ocr',null,{filename,size:keep.byteLength});
    addRecent(filename,'ocr',file.size);
    incrementStats();
    showToast(lang==='fr'?'PDF cherchable prêt':'Searchable PDF ready','ok');
  }catch(e){
    hideProg();
    setStatus('❌ '+e.message,'err');
  }finally{
    isProcessing=false;
    document.querySelectorAll('#ws-body .btn-primary, #tool-body .btn-primary').forEach(b=>b.disabled=false);
  }
}
let _ocrPageIdx=0;

function renderOcrResult(conf,filename){
  const box=document.getElementById('ocr-results');
  const msg=conf==null?'':(lang==='fr'?`Confiance de lecture : ${conf}%`:`Reading confidence: ${conf}%`);
  setStatus((lang==='fr'?'✅ PDF cherchable créé. ':'✅ Searchable PDF created. ')+msg,'ok');
  if(!box)return;
  box.style.display='block';
  const col=conf==null?'#1E7BE0':(conf>=80?'#12965A':(conf>=55?'#C77700':'#B4371F'));
  box.innerHTML=`<div class="merge-toolbar" style="display:flex">
      <span class="merge-count">📄 ${filename}</span>
      ${conf==null?'':`<span style="background:${col};color:#fff;font-size:12px;font-weight:600;padding:4px 10px;border-radius:20px">${lang==='fr'?'Confiance':'Confidence'} ${conf}%</span>`}
    </div>
    <div class="pg-card-tip">${lang==='fr'?'Le texte est maintenant sélectionnable et cherchable dans le PDF téléchargé.':'Text is now selectable and searchable in the downloaded PDF.'}</div>`;
}
