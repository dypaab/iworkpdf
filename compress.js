// ============================================================
//  iWorkPDF — compress.js (logique spécifique à l'outil Compress)
//  Charger APRÈS security.js et shared.js.
//  État local: compQuality, _compScan (scope page, pas partagé).
// ============================================================

let compQuality=0.75; // 0..1, default = "recommended"
let _compScan=null; // cache du dernier scan {imgCount, totalBytes, imgShare}

function buildCompressUI(){
  const bottom=`<div class="status-box" id="ts"></div><div class="prog-wrap" id="tp"><div class="prog-bg"><div class="prog-fill" id="pf"></div></div><div class="prog-text" id="pt"></div></div><div class="share-box" id="share-result"><p style="font-size:13px;font-weight:600">🔗 ${t('signedlink')}</p><div class="share-row"><input class="share-inp" id="share-link-inp" readonly/><button class="btn-primary" style="padding:8px 14px;font-size:13px" onclick="copyLink()">${t('copylink')}</button></div><p class="share-exp" id="share-exp-txt"></p><p class="share-exp" style="color:var(--tx3);margin-top:4px">🔒 URL expires 1h after generation</p></div>`;
  const saveBlock=`<p class="form-label" style="margin-bottom:8px">${t('dest')}</p><div class="save-mode"><div class="save-opt active" id="so-local" onclick="setSave('local')"><div class="save-opt-icon">💾</div><div class="save-opt-title">${t('localmode')}</div><div class="save-opt-sub">${t('direct')}</div></div><div class="save-opt" id="so-cloud" onclick="setSave('cloud')"><div class="save-opt-icon">☁️ 🔒</div><div class="save-opt-title">Cloud 48h</div><div class="save-opt-sub">${t('cloudsub')}</div></div></div>`;
  return `
    <div class="drop-zone" id="dz">
      <input type="file" accept=".pdf" onchange="onPick(event,'compress')"/>
      <p class="drop-text">${t('drop')}</p>
      <button class="drop-btn"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> ${t('browse')}</button>
    </div>
    <div class="file-list" id="fl"></div>
    <div id="comp-estimate"></div>
    <div class="form-group">
      <label class="form-label">${t('comp_quality')}</label>
      <div class="radio-group" id="rg-comp">
        <button class="rbn" onclick="setCompQ(this,0.4)">${t('comp_low')}</button>
        <button class="rbn active" onclick="setCompQ(this,0.75)">${t('comp_med')}</button>
        <button class="rbn" onclick="setCompQ(this,0.9)">${t('comp_high')}</button>
      </div>
    </div>
    <div id="comp-result" style="font-size:13px;color:var(--ok);margin-bottom:10px"></div>
    ${saveBlock}${bottom}
    <div class="flex-end"><button class="btn-primary" onclick="run('compress')">${t('comp_btn')}</button></div>`;
}

function setCompQ(btn,q){
  compQuality=q;
  document.querySelectorAll('#rg-comp .rbn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
}

async function scanPdfImages(file){
  await ensurePdfJs();
  const buf=await file.arrayBuffer();
  const doc=await pdfjsLib.getDocument({data:buf.slice(0)}).promise;
  let imgCount=0, imgPixels=0;
  const pagesToScan=Math.min(doc.numPages,15); // limite raisonnable pour rester rapide
  for(let i=1;i<=pagesToScan;i++){
    try{
      const page=await doc.getPage(i);
      const ops=await page.getOperatorList();
      const seen=new Set();
      for(let j=0;j<ops.fnArray.length;j++){
        if(ops.fnArray[j]===pdfjsLib.OPS.paintImageXObject || ops.fnArray[j]===pdfjsLib.OPS.paintJpegXObject){
          const name=ops.argsArray[j][0];
          if(seen.has(name))continue;
          seen.add(name);
          try{
            const img=await page.objs.get(name);
            if(img && img.width && img.height){
              imgCount++;
              imgPixels+=img.width*img.height;
            }
          }catch(_){/* objet pas encore résolu, on ignore */}
        }
      }
    }catch(_){/* page illisible, on continue */}
  }
  Security.wipeMemory(buf);
  // Estimation du poids actuel des images : on suppose un encodage proche de PNG/JPEG
  // qualité élevée, soit ~3 octets/pixel en moyenne pour des images non optimisées.
  const estImgBytes=imgPixels*3;
  const totalBytes=file.size;
  const imgShare=totalBytes>0?Math.min(estImgBytes/totalBytes,0.95):0;
  return{imgCount,totalBytes,imgShare,scannedAllPages:pagesToScan===doc.numPages};
}

async function renderCompressEstimate(){
  const el=document.getElementById('comp-estimate');
  if(!el || !activeFiles.length)return;
  el.innerHTML=`<div class="status-box info">${t('comp_scanning')}</div>`;
  try{
    const file=activeFiles[0];
    const scan=await scanPdfImages(file);
    _compScan=scan;
    if(scan.imgCount===0 || scan.imgShare<0.05){
      el.innerHTML=`<div class="status-box info">${t('comp_est_none')}</div>`;
      return;
    }
    // Pas de pourcentage prédictif (trop imprécis, cf. retour utilisateur) :
    // le gain RÉEL s'affiche pendant/après la compression, comme iLovePDF.
    el.innerHTML=`
      <div class="status-box info">
        ${scan.imgCount} ${t('comp_est_images')} — ${lang==='fr'?'le gain réel s\'affichera pendant la compression.':'actual savings will be shown during compression.'}
      </div>`;
  }catch(e){
    el.innerHTML='';
  }
}

// runCompress(activeFiles, compQuality, compScan) -> {result, filename}
// Recompresse les images du PDF "en place" (préserve texte, liens, sommaire/outline).
// Reçoit l'état nécessaire en paramètres plutôt que de dépendre de variables globales,
// pour pouvoir être appelée depuis run() (shared.js) sans dépendance directe au DOM compress.
async function runCompress(activeFiles, compQuality, compScan){
  const orig=activeFiles[0].size;
      const buf=await activeFiles[0].arrayBuffer();
      const{PDFDocument,PDFName,PDFRawStream,PDFNumber}=PDFLib;
      const src=await PDFDocument.load(buf,{ignoreEncryption:true,updateMetadata:false});
      // Décision sur les FLUX RÉELS du document (le scan heuristique sous-estimait)
      const _indirect=[...src.context.enumerateIndirectObjects()];
      const _imgStreams=_indirect.filter(([ref,obj])=>{
        if(!(obj instanceof PDFRawStream))return false;
        const st=obj.dict.get(PDFName.of('Subtype'));
        return st && st.toString()==='/Image';
      });
      const hasImages=_imgStreams.length>0;
      if(!hasImages){
        // Pas d'images significatives : optimisation de structure seule, sans perte.
        setProgress(50,'Optimizing…');
        result=await src.save({useObjectStreams:true});
      }else{
        // Recompression "en place" : on remplace le flux de chaque image XObject par
        // une version JPEG ré-encodée, SANS reconstruire le document. Le texte, les
        // liens, les champs de formulaire et le sommaire (outline) ne sont jamais
        // touchés puisqu'on ne modifie que les streams d'images dans le contexte
        // PDF existant — contrairement à un rendu "page = image" qui les détruirait.
        await ensurePdfJs();
        const pdfJsDoc=await pdfjsLib.getDocument({data:buf.slice(0)}).promise;
        const imageStreams=_imgStreams;
        let processed=0;
        const total=imageStreams.length||1;
        // Cache des images décodées par PDF.js, indexées par (page,nom) — on doit
        // parcourir les pages pour que PDF.js résolve les objets image dans son
        // propre cache interne (page.objs), point d'entrée fiable de décodage.
        const decodedByRef=new Map();
        const nPagesJs=pdfJsDoc.numPages;
        for(let p=1;p<=nPagesJs && decodedByRef.size<imageStreams.length;p++){
          try{
            const page=await pdfJsDoc.getPage(p);
            const ops=await page.getOperatorList();
            for(let j=0;j<ops.fnArray.length;j++){
              if(ops.fnArray[j]===pdfjsLib.OPS.paintImageXObject || ops.fnArray[j]===pdfjsLib.OPS.paintJpegXObject){
                const name=ops.argsArray[j][0];
                try{
                  const img=await page.objs.get(name);
                  if(img && img.width && img.height && !decodedByRef.has(name)){
                    decodedByRef.set(name,img);
                  }
                }catch(_){}
              }
            }
          }catch(_){}
        }
        // Profils de compression : qualité JPEG + résolution max (côté le plus long).
        // C'est le DOWNSCALE qui produit les vrais gains (méthode iLovePDF) :
        // un scan 300dpi n'a pas besoin de plus de ~150dpi à l'écran/impression bureau.
        const QPROF={
          '0.4':{q:0.42,maxDim:1000},   // compression max (~72-100dpi, niveau iLovePDF extrême)
          '0.75':{q:0.65,maxDim:1600},  // recommandé (~150dpi)
          '0.9':{q:0.82,maxDim:2400},   // léger (qualité quasi intacte)
        };
        const prof=QPROF[String(compQuality)]||{q:compQuality,maxDim:1800};
        // Pour chaque XObject Image du document pdf-lib, on retrouve les pixels
        // décodés (par dimensions W/H), on REDIMENSIONNE si trop grand, on
        // recompresse en JPEG, et on remplace le flux en conservant la référence.
        const decodedList=[...decodedByRef.values()];
        for(const [ref,obj] of imageStreams){
          processed++;
          setProgress(5+((processed)/total)*85,`${t('comp_optimizing')} ${processed}/${total}`);
          const dict=obj.dict;
          const wObj=dict.get(PDFName.of('Width'));
          const hObj=dict.get(PDFName.of('Height'));
          const w=wObj?wObj.asNumber():0;
          const h=hObj?hObj.asNumber():0;
          if(!w||!h)continue;
          // Les masques (SMask) sont référencés par d'autres images : ne pas les
          // convertir en JPEG couleur, on les laisse intacts.
          const isMask=dict.get(PDFName.of('ImageMask'));
          if(isMask && isMask.toString()==='true')continue;
          try{
            // 1) Reconstituer les pixels dans un canvas source.
            //    a) JPEG (DCTDecode) : décodage DIRECT des octets du flux via
            //       createImageBitmap — couvre 100% des JPEG sans dépendre de
            //       l'appariement par dimensions (qui en laissait passer).
            //    b) Sinon : pixels décodés par PDF.js (.bitmap ou .data).
            const srcCanvas=document.createElement('canvas');
            srcCanvas.width=w;srcCanvas.height=h;
            const sctx=srcCanvas.getContext('2d');
            let painted=false;
            const fObj=dict.get(PDFName.of('Filter'));
            const fstr=fObj?fObj.toString():'';
            if(fstr.indexOf('DCTDecode')!==-1 && obj.contents && obj.contents.length){
              try{
                const bmp=await createImageBitmap(new Blob([obj.contents],{type:'image/jpeg'}));
                sctx.drawImage(bmp,0,0,w,h);
                if(bmp.close)bmp.close();
                painted=true;
              }catch(_){/* JPEG exotique (CMYK...) : on tentera via PDF.js */}
            }
            if(!painted){
              const match=decodedList.find(im=>im.width===w && im.height===h);
              if(!match)continue; // pas de correspondance fiable : image laissée telle quelle
              if(match.bitmap){
                sctx.drawImage(match.bitmap,0,0,w,h);painted=true;
              }else if(match.data){
                const imgData=sctx.createImageData(w,h);
                const src8=match.data;
                if(src8.length===w*h*4){
                  imgData.data.set(src8);
                }else if(src8.length===w*h*3){
                  for(let px=0,o=0;px<w*h;px++,o+=3){
                    imgData.data[px*4]=src8[o];imgData.data[px*4+1]=src8[o+1];imgData.data[px*4+2]=src8[o+2];imgData.data[px*4+3]=255;
                  }
                }else{continue;}
                sctx.putImageData(imgData,0,0);painted=true;
              }
            }
            if(!painted)continue;
            // 2) Downscale si l'image dépasse la résolution cible du profil.
            let tw=w,th=h,outCanvas=srcCanvas;
            const maxSide=Math.max(w,h);
            if(maxSide>prof.maxDim){
              const k=prof.maxDim/maxSide;
              tw=Math.max(1,Math.round(w*k));th=Math.max(1,Math.round(h*k));
              outCanvas=document.createElement('canvas');
              outCanvas.width=tw;outCanvas.height=th;
              const octx=outCanvas.getContext('2d');
              octx.imageSmoothingEnabled=true;octx.imageSmoothingQuality='high';
              octx.drawImage(srcCanvas,0,0,tw,th);
            }
            // 3) Ré-encoder en JPEG au niveau de qualité du profil.
            // toBlob et non fetch(dataURL) : la CSP connect-src n'autorise pas
            // data: -> le fetch échouait en silence pour CHAQUE image (cause
            // racine du "0% de gain" depuis le début).
            const jpegBlob=await new Promise(res=>outCanvas.toBlob(res,'image/jpeg',prof.q));
            if(!jpegBlob)continue;
            const jpegBytes=new Uint8Array(await jpegBlob.arrayBuffer());
            // Ne remplace que si on gagne réellement de la place sur cette image
            const oldLen=obj.contents?obj.contents.length:0;
            if(oldLen && jpegBytes.length>=oldLen)continue;
            const newEntries={
              Type:PDFName.of('XObject'),Subtype:PDFName.of('Image'),
              Width:tw,Height:th,ColorSpace:PDFName.of('DeviceRGB'),
              BitsPerComponent:8,Filter:PDFName.of('DCTDecode'),Length:jpegBytes.length,
            };
            const newDict=src.context.obj(newEntries);
            // Préserver la transparence : le SMask est indépendant en dimensions
            // (mappé sur le carré unité), on peut le garder tel quel.
            const sm=dict.get(PDFName.of('SMask'));
            if(sm)newDict.set(PDFName.of('SMask'),sm);
            const newStream=PDFRawStream.of(newDict,jpegBytes);
            src.context.assign(ref,newStream);
            srcCanvas.width=0;srcCanvas.height=0;
            if(outCanvas!==srcCanvas){outCanvas.width=0;outCanvas.height=0;}
          }catch(_){/* image individuelle non recompressable : on la laisse intacte */}
        }
        // Nettoyage sans perte : métadonnées XMP volumineuses.
        try{src.catalog.delete(PDFName.of('Metadata'));}catch(_){}
        try{src.catalog.delete(PDFName.of('PieceInfo'));}catch(_){}
        setProgress(92,'Finalizing…');
        result=await src.save({useObjectStreams:true});
      }
      Security.wipeMemory(buf);
      const gain=((1-result.byteLength/orig)*100).toFixed(1);
      const cr=document.getElementById('comp-result');
      if(cr){
        if(parseFloat(gain)<=0){
          cr.style.color='var(--wa)';
          cr.textContent=`⚠️ ${(orig/1024).toFixed(0)} Ko → ${(result.byteLength/1024).toFixed(0)} Ko (+${Math.abs(parseFloat(gain))}% — ${lang==='fr'?'déjà optimisé':'already optimized'})`;
        }else{
          cr.style.color='var(--ok)';
          cr.textContent=`${(orig/1024).toFixed(0)} Ko → ${(result.byteLength/1024).toFixed(0)} Ko  (−${gain}%)`;
        }
      }
      filename=activeFiles[0].name.replace('.pdf','')+'_compressed.pdf';
  return {result, filename};
}
