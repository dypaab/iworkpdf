// ============================================================
//  iWorkPDF — pdf2jpg.js (logique spécifique à l'outil PDF to JPG)
//  Charger APRÈS security.js et shared.js.
// ============================================================

let jpgQuality=0.9;

function buildPdf2JpgUI(){
  const bottom=`<div class="status-box" id="ts"></div><div class="prog-wrap" id="tp"><div class="prog-bg"><div class="prog-fill" id="pf"></div></div><div class="prog-text" id="pt"></div></div>`;
  return `
    <div class="drop-zone" id="dz">
      <input type="file" accept=".pdf" onchange="onPick(event,'pdf2jpg')"/>
      <p class="drop-text">${t('drop')}</p>
      <button class="drop-btn"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> ${t('browse')}</button>
    </div>
    <div class="file-list" id="fl"></div>
    <div class="form-group">
      <label class="form-label">${t('pdf2jpg_quality')}</label>
      <div class="radio-group" id="rg-jpg">
        <button class="rbn" onclick="setJpgQ(this,0.7)">⚡ Standard</button>
        <button class="rbn active" onclick="setJpgQ(this,0.9)">✅ High</button>
        <button class="rbn" onclick="setJpgQ(this,1.0)">💎 Max</button>
      </div>
    </div>
    <label class="chk-line"><input type="checkbox" id="pdf2jpg-reverse"/><span>${lang==='fr'?'Ordre inversé (dernière page → première)':'Reverse order (last page → first)'}</span></label>
    ${bottom}
    <div class="flex-end"><button class="btn-primary" onclick="run('pdf2jpg')">${t('pdf2jpg_apply')}</button></div>`;
}

function setJpgQ(btn, q){
  jpgQuality=q;
  document.querySelectorAll('#rg-jpg .rbn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
}

// runPdf2Jpg est "self-contained" : gère sa propre boucle de téléchargements.
async function runPdf2Jpg(activeFiles, jpgQuality){
  await ensurePdfJs();
      const buf=await activeFiles[0].arrayBuffer();
      const pdfDoc=await pdfjsLib.getDocument({data:buf.slice(0)}).promise;
      const n=pdfDoc.numPages;
      const stem=activeFiles[0].name.replace('.pdf','');
      // Échelle selon qualité: 0.7→1.5x, 0.9→2x, 1.0→3x
      const scaleMap={0.7:1.5,0.9:2,1.0:3};
      const scale=scaleMap[jpgQuality]||2;
      // Ordre d'export : premier → dernier, ou inversé si la case est cochée.
      const reverse=document.getElementById('pdf2jpg-reverse')?.checked===true;
      const order=[...Array(n).keys()];
      if(reverse)order.reverse();
      for(let k=0;k<order.length;k++){
        const i=order[k];
        setProgress(5+((k+1)/n)*90,`Page ${i+1}/${n}…`);
        const page=await pdfDoc.getPage(i+1);
        const vp=page.getViewport({scale});
        const canvas=document.createElement('canvas');
        canvas.width=vp.width;canvas.height=vp.height;
        await page.render({canvasContext:canvas.getContext('2d'),viewport:vp}).promise;
        const jpgFilename=`${stem}_p${i+1}.jpg`;
        // BUG C FIX: propager AbortError hors de la Promise canvas.toBlob
        let aborted=false;
        await new Promise((res,rej)=>{
          canvas.toBlob(async blob=>{
            if(!blob){res();return;}
            try{
              const ab=await blob.arrayBuffer();
              await dlJpg(new Uint8Array(ab),jpgFilename);
              res();
            }catch(e){
              if(e.name==='AbortError'){aborted=true;res();}
              else rej(e);
            }
          },'image/jpeg',jpgQuality);
        });
        if(aborted){
          Security.wipeMemory(buf);
          setProgress(100,'⚠️');hideProg();
          setStatus(`${k} ${lang==='fr'?'images enregistrées (annulé)':'images saved (cancelled)'}`, 'info');
          isProcessing=false;
          document.querySelectorAll('#ws-body .btn-primary').forEach(b=>b.disabled=false);
          return;
        }
        await new Promise(r=>setTimeout(r,80));
      }
      Security.wipeMemory(buf);
      setProgress(100,'✅');hideProg();
      setStatus(`${n} ${t('pdf2jpg_done')} ✅`,'ok');
      await audit('pdf2jpg',null,{pages:n,file:activeFiles[0].name});
      // BUG 10 FIX: stats + recent
      addRecent(`${activeFiles[0].name} (${n} JPG)`, 'pdf2jpg', activeFiles[0].size);
      incrementStats();
      showToast(`${n} ${lang==='fr'?'images JPG enregistrées':'JPG images saved'}`, 'ok');
      isProcessing=false;
      document.querySelectorAll('#ws-body .btn-primary').forEach(b=>b.disabled=false);
      return;
  return true;
}
