// ============================================================
//  iWorkPDF — extract.js (logique spécifique à l'outil Extract Images)
//  Charger APRÈS security.js et shared.js.
// ============================================================

function buildExtractUI(){
  const bottom=`<div class="status-box" id="ts"></div><div class="prog-wrap" id="tp"><div class="prog-bg"><div class="prog-fill" id="pf"></div></div><div class="prog-text" id="pt"></div></div>`;
  return `
    <div class="drop-zone" id="dz">
      <input type="file" accept=".pdf" onchange="onPick(event,'extract')"/>
      <p class="drop-text">${t('drop')}</p>
      <button class="drop-btn"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> ${t('browse')}</button>
    </div>
    <div class="file-list" id="fl"></div>
    <div class="sec-info">ℹ️ <span>${lang==='fr'?'Chaque page sera rendue en image JPG haute résolution. Similaire à PDF→JPG mais optimisé pour les documents image.':'Each page rendered as high-res JPG. Similar to PDF→JPG but optimized for image-heavy documents.'}</span></div>
    ${bottom}
    <div class="flex-end"><button class="btn-primary" onclick="run('extract')">${lang==='fr'?'🖼 Extraire':'🖼 Extract'}</button></div>`;
}

// runExtract est "self-contained" : gère ses propres téléchargements multiples.
async function runExtract(activeFiles){
  // Réutilise la logique pdf2jpg mais avec scale fixe haute qualité
      await ensurePdfJs();
      const buf=await activeFiles[0].arrayBuffer();
      const pdfDoc=await pdfjsLib.getDocument({data:buf.slice(0)}).promise;
      const n=pdfDoc.numPages;
      const stem=activeFiles[0].name.replace('.pdf','');
      const scale=2.5; // haute résolution fixe
      let saved=0;
      for(let i=0;i<n;i++){
        setProgress(5+((i+1)/n)*90,`${lang==='fr'?'Extraction':'Extracting'} ${i+1}/${n}…`);
        const page=await pdfDoc.getPage(i+1);
        const vp=page.getViewport({scale});
        const canvas=document.createElement('canvas');
        canvas.width=vp.width;canvas.height=vp.height;
        await page.render({canvasContext:canvas.getContext('2d'),viewport:vp}).promise;
        let aborted=false;
        await new Promise((res,rej)=>{
          canvas.toBlob(async blob=>{
            if(!blob){res();return;}
            try{
              const ab=await blob.arrayBuffer();
              await dlJpg(new Uint8Array(ab),`${stem}_img_${i+1}.jpg`);
              saved++;res();
            }catch(e){if(e.name==='AbortError'){aborted=true;res();}else rej(e);}
          },'image/jpeg',0.92);
        });
        if(aborted) break;
        await new Promise(r=>setTimeout(r,80));
      }
      Security.wipeMemory(buf);
      setProgress(100,'✅');hideProg();
      setStatus(`${saved} ${lang==='fr'?'images extraites':'images extracted'} ✅`,'ok');
      addRecent(activeFiles[0].name,id,activeFiles[0].size);
      incrementStats();
      showToast(`${saved} ${lang==='fr'?'images JPG extraites':'JPG images extracted'}`,'ok');
      isProcessing=false;
      document.querySelectorAll('#ws-body .btn-primary').forEach(b=>b.disabled=false);
      return;
  return true;
}
