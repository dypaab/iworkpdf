// ============================================================
//  iWorkPDF — extract.js (outil Extract Images)
//  Charger APRÈS security.js et shared.js.
//
//  ≠ PDF→JPG : ici on extrait les IMAGES INTÉGRÉES au PDF (les photos
//  d'origine, à leur résolution native, sans le texte ni la mise en page).
//  PDF→JPG, lui, rend chaque PAGE entière en image.
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
    <div class="sec-info">ℹ️ <span>${lang==='fr'
      ?'Extrait les photos et images INTÉGRÉES au PDF, à leur résolution d\'origine (sans le texte ni la mise en page). Pour convertir chaque page entière en image, utilisez PDF → JPG.'
      :'Extracts the photos and images EMBEDDED in the PDF, at their original resolution (without text or layout). To convert full pages to images, use PDF → JPG.'}</span></div>
    ${bottom}
    <div class="flex-end"><button class="btn-primary" onclick="run('extract')">${lang==='fr'?'🖼 Extraire les images':'🖼 Extract images'}</button></div>`;
}

// runExtract est "self-contained" : gère ses propres téléchargements multiples.
async function runExtract(activeFiles){
  const buf=await activeFiles[0].arrayBuffer();
  const{PDFDocument,PDFName,PDFRawStream}=PDFLib;
  const src=await PDFDocument.load(buf,{ignoreEncryption:true,updateMetadata:false});
  const stem=activeFiles[0].name.replace('.pdf','');
  // Tous les flux XObject /Image du document
  const streams=[...src.context.enumerateIndirectObjects()].filter(([r,o])=>{
    if(!(o instanceof PDFRawStream))return false;
    const st=o.dict.get(PDFName.of('Subtype'));
    return st && st.toString()==='/Image';
  });
  // Décodage PDF.js paresseux (uniquement si images non-JPEG rencontrées)
  let _decoded=null;
  async function getDecoded(){
    if(_decoded)return _decoded;
    _decoded=[];
    try{
      await ensurePdfJs();
      const d=await pdfjsLib.getDocument({data:buf.slice(0)}).promise;
      for(let p=1;p<=d.numPages;p++){
        try{
          const page=await d.getPage(p);
          const ops=await page.getOperatorList();
          for(let j=0;j<ops.fnArray.length;j++){
            if(ops.fnArray[j]===pdfjsLib.OPS.paintImageXObject){
              try{
                const img=await page.objs.get(ops.argsArray[j][0]);
                if(img&&img.width&&img.height)_decoded.push(img);
              }catch(_){}
            }
          }
        }catch(_){}
      }
    }catch(_){}
    return _decoded;
  }
  // Les MASQUES DE TRANSPARENCE (SMask) sont eux-mêmes des flux /Image :
  // exportés tels quels ils donnent des "images noires de 1 Ko". On repère
  // tous les flux référencés comme SMask pour les exclure.
  const smaskRefs=new Set();
  streams.forEach(([r,o])=>{
    const sm=o.dict.get(PDFName.of('SMask'));
    if(sm)smaskRefs.add(sm.toString());
  });
  let saved=0,idx=0,aborted=false;
  for(const [ref,obj] of streams){
    idx++;
    if(smaskRefs.has(ref.toString()))continue; // masque de transparence, pas une image
    const dict=obj.dict;
    const w=(dict.get(PDFName.of('Width'))?.asNumber?.())||0;
    const h=(dict.get(PDFName.of('Height'))?.asNumber?.())||0;
    if(w<64||h<64)continue; // icônes/puces/vignettes : sans intérêt
    const isMask=dict.get(PDFName.of('ImageMask'));
    if(isMask&&isMask.toString()==='true')continue;
    // Trop petit en octets = décoration/masque, pas une photo
    if(obj.contents&&obj.contents.length<3000)continue;
    setProgress(5+idx/streams.length*90,`Image ${idx}/${streams.length}…`);
    const f=dict.get(PDFName.of('Filter'));
    const fs=f?f.toString():'';
    // Les JPEG CMYK sortent inversés/noirs si sauvés bruts → décodage PDF.js
    const cs=dict.get(PDFName.of('ColorSpace'));
    const csStr=cs?cs.toString():'';
    const rawJpgOk=fs.indexOf('DCTDecode')!==-1&&csStr.indexOf('CMYK')===-1;
    try{
      if(rawJpgOk&&obj.contents&&obj.contents.length){
        // JPEG natif : octets d'origine, zéro ré-encodage, résolution native
        await dlJpg(new Uint8Array(obj.contents),`${stem}_img${saved+1}.jpg`);
        saved++;
      }else{
        // Autres encodages (Flate/PNG…) : via les pixels décodés par PDF.js
        const list=await getDecoded();
        const m=list.find(im=>im.width===w&&im.height===h);
        if(!m)continue;
        const canvas=document.createElement('canvas');
        canvas.width=w;canvas.height=h;
        const ctx=canvas.getContext('2d');
        if(m.bitmap){ctx.drawImage(m.bitmap,0,0,w,h);}
        else if(m.data){
          const im=ctx.createImageData(w,h);
          if(m.data.length===w*h*4)im.data.set(m.data);
          else if(m.data.length===w*h*3){
            for(let px=0,o=0;px<w*h;px++,o+=3){im.data[px*4]=m.data[o];im.data[px*4+1]=m.data[o+1];im.data[px*4+2]=m.data[o+2];im.data[px*4+3]=255;}
          }else continue;
          ctx.putImageData(im,0,0);
        }else continue;
        const blob=await new Promise(res=>canvas.toBlob(res,'image/jpeg',0.95));
        if(!blob)continue;
        await dlJpg(new Uint8Array(await blob.arrayBuffer()),`${stem}_img${saved+1}.jpg`);
        saved++;
      }
    }catch(e){
      if(e.name==='AbortError'){aborted=true;break;}
    }
    await new Promise(r=>setTimeout(r,60));
  }
  Security.wipeMemory(buf);
  setProgress(100,aborted?'⚠️':'✅');hideProg();
  if(!saved&&!aborted){
    setStatus(lang==='fr'
      ?'Aucune image intégrée trouvée dans ce PDF. Pour convertir les pages en images, utilisez PDF → JPG.'
      :'No embedded images found in this PDF. To convert pages to images, use PDF → JPG.','info');
  }else{
    setStatus(`${saved} ${lang==='fr'?'images extraites':'images extracted'} ${aborted?(lang==='fr'?'(annulé)':'(cancelled)'):'✅'}`,aborted?'info':'ok');
  }
  addRecent(activeFiles[0].name,'extract',activeFiles[0].size);
  incrementStats();
  if(saved)showToast(`${saved} ${lang==='fr'?'images extraites':'images extracted'}`,'ok');
  isProcessing=false;
  document.querySelectorAll('#ws-body .btn-primary').forEach(b=>b.disabled=false);
  return;
}
