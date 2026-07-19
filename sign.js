// ============================================================
//  iWorkPDF — sign.js (logique spécifique à l'outil Sign PDF)
//  Charger APRÈS security.js et shared.js.
// ============================================================

let signDrawing=false, signCtx=null, signPos='br';

function buildSignUI(){
  const saveBlock=`<p class="form-label" style="margin-bottom:8px">${t('dest')}</p><div class="save-mode"><div class="save-opt active" id="so-local" onclick="setSave('local')"><div class="save-opt-icon">💾</div><div class="save-opt-title">${t('localmode')}</div><div class="save-opt-sub">${t('direct')}</div></div><div class="save-opt" id="so-cloud" onclick="setSave('cloud')"><div class="save-opt-icon">☁️ 🔒</div><div class="save-opt-title">Cloud 48h</div><div class="save-opt-sub">${t('cloudsub')}</div></div></div>`;
  const bottom=`<div class="status-box" id="ts"></div><div class="prog-wrap" id="tp"><div class="prog-bg"><div class="prog-fill" id="pf"></div></div><div class="prog-text" id="pt"></div></div><div class="share-box" id="share-result"><p style="font-size:13px;font-weight:600">🔗 ${t('signedlink')}</p><div class="share-row"><input class="share-inp" id="share-link-inp" readonly/><button class="btn-primary" style="padding:8px 14px;font-size:13px" onclick="copyLink()">${t('copylink')}</button></div><p class="share-exp" id="share-exp-txt"></p></div>`;
  return `
    <div class="drop-zone" id="dz">
      <input type="file" accept=".pdf" onchange="onPick(event,'sign')"/>
      <p class="drop-text">${t('drop')}</p>
      <button class="drop-btn"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> ${t('browse')}</button>
    </div>
    <div class="file-list" id="fl"></div>
    <div class="form-group">
      <label class="form-label">${lang==='fr'?'Dessinez votre signature :':'Draw your signature:'}</label>
      <div style="position:relative;margin-bottom:8px">
        <canvas id="sign-canvas" width="600" height="160"
          style="width:100%;height:160px;background:#fff;border-radius:var(--r2);border:2px solid var(--bd);cursor:crosshair;touch-action:none;display:block"></canvas>
        <button onclick="clearSignature()" style="position:absolute;top:8px;right:8px;background:var(--sf2);border:1px solid var(--bd);color:var(--tx2);padding:4px 10px;border-radius:var(--r2);font-size:11px;cursor:pointer">
          ${lang==='fr'?'Effacer':'Clear'}
        </button>
      </div>
      <div style="display:flex;gap:10px;align-items:center;margin-bottom:8px">
        <label style="font-size:12px;color:var(--tx2)">${lang==='fr'?'Couleur:':'Color:'}</label>
        <input type="color" id="sign-color" value="#000080" style="width:40px;height:32px;border:1px solid var(--bd);border-radius:var(--r2);cursor:pointer"/>
        <label style="font-size:12px;color:var(--tx2)">${lang==='fr'?'Épaisseur:':'Thickness:'}</label>
        <input type="range" id="sign-size" min="1" max="8" value="2" style="width:80px"/>
        <label style="font-size:12px;color:var(--tx2)">${lang==='fr'?'Position:':'Position:'}</label>
        <div class="radio-group" id="rg-sign-pos" style="margin:0">
          <button class="rbn active" onclick="setRbn('rg-sign-pos',this,'br','signpos')">${lang==='fr'?'Bas D':'Bot R'}</button>
          <button class="rbn" onclick="setRbn('rg-sign-pos',this,'bc','signpos')">${lang==='fr'?'Bas C':'Bot C'}</button>
          <button class="rbn" onclick="setRbn('rg-sign-pos',this,'bl','signpos')">${lang==='fr'?'Bas G':'Bot L'}</button>
        </div>
      </div>
      <div style="font-size:11px;color:var(--tx3)">
        ${lang==='fr'?'La signature sera appliquée sur la dernière page du document.':'Signature will be applied to the last page of the document.'}
      </div>
    </div>
    ${saveBlock}${bottom}
    <div class="flex-end"><button class="btn-primary" onclick="run('sign')">${lang==='fr'?'✍️ Signer':'✍️ Sign'}</button></div>`;
}

function initSignCanvas(){
  const canvas=document.getElementById('sign-canvas');
  if(!canvas) return;
  signCtx=canvas.getContext('2d');
  signCtx.lineCap='round';
  signCtx.lineJoin='round';

  function getPos(e){
    const rect=canvas.getBoundingClientRect();
    const scaleX=canvas.width/rect.width;
    const scaleY=canvas.height/rect.height;
    const src=e.touches?e.touches[0]:e;
    return{x:(src.clientX-rect.left)*scaleX,y:(src.clientY-rect.top)*scaleY};
  }
  function start(e){
    e.preventDefault();
    signDrawing=true;
    const p=getPos(e);
    signCtx.beginPath();
    signCtx.moveTo(p.x,p.y);
  }
  function draw(e){
    e.preventDefault();
    if(!signDrawing) return;
    const color=document.getElementById('sign-color')?.value||'#000080';
    const size=parseInt(document.getElementById('sign-size')?.value||'2');
    signCtx.strokeStyle=color;
    signCtx.lineWidth=size;
    const p=getPos(e);
    signCtx.lineTo(p.x,p.y);
    signCtx.stroke();
  }
  function stop(){signDrawing=false;}

  canvas.addEventListener('mousedown',start);
  canvas.addEventListener('mousemove',draw);
  canvas.addEventListener('mouseup',stop);
  canvas.addEventListener('mouseleave',stop);
  canvas.addEventListener('touchstart',start,{passive:false});
  canvas.addEventListener('touchmove',draw,{passive:false});
  canvas.addEventListener('touchend',stop);
}

function clearSignature(){
  if(!signCtx) return;
  const canvas=document.getElementById('sign-canvas');
  if(canvas) signCtx.clearRect(0,0,canvas.width,canvas.height);
}

// runSign(activeFiles, signPos) -> {result, filename} | null
async function runSign(activeFiles, signPos){
  let result, filename;
  const canvas=document.getElementById('sign-canvas');
      if(!canvas) { earlyReturn(lang==='fr'?'Canvas non trouvé.':'Canvas not found.'); return null; }
      // Vérifier que la signature n'est pas vide
      const imgData=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height);
      const hasDrawing=imgData.data.some((v,i)=>i%4===3&&v>0);
      if(!hasDrawing) { earlyReturn(lang==="fr"?"Dessinez votre signature d'abord.":'Please draw your signature first.'); return null; }
      const buf=await activeFiles[0].arrayBuffer();
      const{PDFDocument}=PDFLib;
      const src=await PDFDocument.load(buf,{ignoreEncryption:true});
      setProgress(40,'Embedding signature…');
      // Convertir le canvas en PNG
      const pngDataUrl=canvas.toDataURL('image/png');
      const pngBase64=pngDataUrl.split(',')[1];
      const pngBytes=Uint8Array.from(atob(pngBase64),c=>c.charCodeAt(0));
      const pngImg=await src.embedPng(pngBytes);
      // Appliquer sur la dernière page
      const pages=src.getPages();
      const lastPage=pages[pages.length-1];
      const{width,height}=lastPage.getSize();
      const sigW=width*0.3, sigH=sigW*(canvas.height/canvas.width);
      const margin=20;
      const posMap={
        br:{x:width-sigW-margin,y:margin},
        bc:{x:(width-sigW)/2,y:margin},
        bl:{x:margin,y:margin},
      };
      const sigPos=posMap[signPos]||posMap.br;
      lastPage.drawImage(pngImg,{x:sigPos.x,y:sigPos.y,width:sigW,height:sigH,opacity:1});
      result=await src.save();
      Security.wipeMemory(buf);
      filename=activeFiles[0].name.replace('.pdf','')+'_signed.pdf';
  return {result, filename};
}
