// ============================================================
//  iWorkPDF — extract.js (outil Extract Images)
//  Charger APRÈS security.js et shared.js.
//
//  ≠ PDF→JPG : ici on extrait les IMAGES INTÉGRÉES au PDF (les photos
//  d'origine, à leur résolution native, sans le texte ni la mise en page).
//
//  v2 — Filtre "anti-rectangles noirs" : chaque image candidate est
//  DÉCODÉE et analysée pixel par pixel. On rejette les aplats noirs,
//  les masques, les zones transparentes/blanches et les images quasi
//  uniformes. Chaque image conservée reçoit un score de LISIBILITÉ (%).
// ============================================================

let _extractUrls = [];   // object URLs à révoquer entre deux extractions
let _extractKept = [];   // images conservées (mutable : ✕ retire, ⬇ télécharge)
let _extractStem = '';
let _extractSkipped = 0;

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
      ?'Extrait les photos et images INTÉGRÉES au PDF, à leur résolution d\'origine. Les aplats noirs, masques et images illisibles sont automatiquement écartés. Pour convertir chaque page entière en image, utilisez PDF → JPG.'
      :'Extracts the photos and images EMBEDDED in the PDF, at their original resolution. Black fills, masks and unreadable images are automatically filtered out. To convert full pages to images, use PDF → JPG.'}</span></div>
    ${bottom}
    <div class="flex-end"><button class="btn-primary" onclick="run('extract')">${lang==='fr'?'🖼 Extraire les images':'🖼 Extract images'}</button></div>`;
}

// ── Analyse pixel : renvoie {score 0-100, drop, reason, stats} ────────────
// Rejette : quasi-transparent (masque), quasi-noir (rectangle noir),
// quasi-blanc (page vide) et quasi-uniforme (aplat de couleur).
function analyzeRGBA(data,w,h){
  const n=w*h;
  if(!n||data.length<n*4) return {score:0,drop:true,reason:'empty'};
  let sum=0,sumSq=0,black=0,white=0,trans=0;
  const buckets=new Set();
  const lum=new Float32Array(n);
  for(let i=0;i<n;i++){
    const a=data[i*4+3];
    const r=data[i*4],g=data[i*4+1],b=data[i*4+2];
    const L=0.299*r+0.587*g+0.114*b;
    lum[i]=L;
    if(a<16){trans++; continue;}
    sum+=L; sumSq+=L*L;
    if(L<16)black++;
    else if(L>240)white++;
    buckets.add(((r>>4)<<8)|((g>>4)<<4)|(b>>4)); // ~4096 teintes possibles
  }
  const opaque=n-trans;
  const transFrac=trans/n;
  if(opaque<1) return {score:0,drop:true,reason:'transparent'};
  const mean=sum/opaque;
  const std=Math.sqrt(Math.max(0,sumSq/opaque-mean*mean));
  const blackFrac=black/opaque;
  const whiteFrac=white/opaque;
  const uniq=buckets.size;

  // ── ÉNERGIE DE CONTOUR (texture) : différence moyenne de luminance avec les
  // voisins de droite et du bas. C'est LE discriminant "vraie photo" : une photo
  // est riche en détails (énergie élevée) ; un aplat noir / masque / dégradé
  // lisse est quasi plat (énergie ~0), un graphique vectoriel est intermédiaire.
  let edge=0,edgeN=0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const i=y*w+x;
    if(x+1<w){ edge+=Math.abs(lum[i]-lum[i+1]); edgeN++; }
    if(y+1<h){ edge+=Math.abs(lum[i]-lum[i+w]); edgeN++; }
  }
  const edgeEnergy=edgeN?edge/edgeN:0;

  let drop=false,reason='';
  if(transFrac>0.97){drop=true;reason='mask';}
  else if(blackFrac>0.90){drop=true;reason='black';}
  else if(whiteFrac>0.985){drop=true;reason='blank';}
  else if(edgeEnergy<1.4 && uniq<24){drop=true;reason='flat';} // aplat / dégradé lisse
  else if(std<5 && uniq<6){drop=true;reason='flat2';}

  // Score de lisibilité : texture (edge, poids fort) + contraste (std)
  // + diversité de couleurs (uniq) − pénalité si dominé par une couleur extrême.
  let score = Math.min(edgeEnergy/22,1)*45
            + Math.min(std/55,1)*30
            + Math.min(uniq/300,1)*20
            + (1-Math.max(blackFrac,whiteFrac,transFrac))*5;
  score=Math.round(Math.max(0,Math.min(100,score)));
  if(!drop && score<22){drop=true;reason='lowscore';}
  return {score,drop,reason,std,uniq,edgeEnergy,blackFrac,whiteFrac,transFrac};
}

// Décode des octets JPEG en bitmap (createImageBitmap, fallback <img>).
async function bitmapFromBytes(bytes){
  const blob=new Blob([bytes],{type:'image/jpeg'});
  try{ return await createImageBitmap(blob); }
  catch(_){
    return await new Promise((res,rej)=>{
      const u=URL.createObjectURL(blob);
      const im=new Image();
      im.onload=()=>{URL.revokeObjectURL(u);res(im);};
      im.onerror=()=>{URL.revokeObjectURL(u);rej(new Error('decode'));};
      im.src=u;
    });
  }
}

// runExtract est "self-contained" : gère son propre rendu + téléchargements.
async function runExtract(activeFiles){
  // Nettoyage d'un rendu précédent
  _extractUrls.forEach(u=>{try{URL.revokeObjectURL(u);}catch(_){}}); _extractUrls=[];
  _extractKept=[];
  const _prevBox=document.getElementById('extract-results');
  if(_prevBox){_prevBox.style.display='none';_prevBox.innerHTML='';}

  let buf=null;
  try{
  buf=await activeFiles[0].arrayBuffer();
  const{PDFDocument,PDFName,PDFRawStream}=PDFLib;
  const src=await PDFDocument.load(buf,{ignoreEncryption:true,updateMetadata:false});
  const stem=activeFiles[0].name.replace(/\.pdf$/i,'');

  // Tous les flux XObject /Image du document
  const streams=[...src.context.enumerateIndirectObjects()].filter(([r,o])=>{
    if(!(o instanceof PDFRawStream))return false;
    const st=o.dict.get(PDFName.of('Subtype'));
    return st && st.toString()==='/Image';
  });

  // Masques (SMask + /Mask référencé) : à exclure, ce ne sont pas des photos.
  const maskRefs=new Set();
  streams.forEach(([r,o])=>{
    const sm=o.dict.get(PDFName.of('SMask'));
    if(sm && sm.toString) maskRefs.add(sm.toString());
    const mk=o.dict.get(PDFName.of('Mask'));
    if(mk && mk.toString && /^\d+ \d+ R$/.test(mk.toString())) maskRefs.add(mk.toString());
  });

  // Décodage PDF.js paresseux (images non-JPEG)
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

  // Canvas d'analyse réutilisé (échantillon 48×48)
  const AS=96; // résolution d'analyse (plus fine = score plus précis)
  const ac=document.createElement('canvas');ac.width=AS;ac.height=AS;
  const actx=ac.getContext('2d',{willReadFrequently:true});
  actx.imageSmoothingEnabled=false; // garde les détails/contours (mieux pour la texture)
  function sampleOf(drawable){
    actx.clearRect(0,0,AS,AS);
    try{actx.drawImage(drawable,0,0,AS,AS);}catch(_){return null;}
    return actx.getImageData(0,0,AS,AS).data;
  }

  let idx=0,aborted=false,skipped=0;
  const kept=[]; // {name,data,score}
  for(const [ref,obj] of streams){
    idx++;
    if(maskRefs.has(ref.toString()))continue;
    const dict=obj.dict;
    const w=(dict.get(PDFName.of('Width'))?.asNumber?.())||0;
    const h=(dict.get(PDFName.of('Height'))?.asNumber?.())||0;
    if(w<64||h<64)continue; // icônes/puces : sans intérêt
    const isMask=dict.get(PDFName.of('ImageMask'));
    if(isMask&&isMask.toString()==='true')continue;
    if(obj.contents&&obj.contents.length<3000)continue;
    setProgress(5+idx/streams.length*80,`Image ${idx}/${streams.length}…`);

    const f=dict.get(PDFName.of('Filter'));
    const fs=f?f.toString():'';
    const cs=dict.get(PDFName.of('ColorSpace'));
    const csStr=cs?cs.toString():'';
    const rawJpgOk=fs.indexOf('DCTDecode')!==-1 && csStr.indexOf('CMYK')===-1;

    try{
      let outBytes=null, sample=null;
      if(rawJpgOk&&obj.contents&&obj.contents.length){
        // JPEG natif : on garde les octets d'origine (qualité native) mais on
        // DÉCODE quand même pour l'analyse anti-rectangle-noir.
        const bytes=new Uint8Array(obj.contents);
        let bmp=null;
        try{ bmp=await bitmapFromBytes(bytes); sample=sampleOf(bmp); }
        catch(_){ sample=null; }
        finally{ if(bmp&&bmp.close)bmp.close(); }
        outBytes=bytes;
      }else{
        // Autres encodages : pixels décodés par PDF.js → JPEG ré-encodé.
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
          }else{canvas.width=0;canvas.height=0;continue;}
          ctx.putImageData(im,0,0);
        }else{canvas.width=0;canvas.height=0;continue;}
        sample=sampleOf(canvas);
        const blob=await new Promise(res=>canvas.toBlob(res,'image/jpeg',0.95));
        canvas.width=0;canvas.height=0;
        if(!blob)continue;
        outBytes=new Uint8Array(await blob.arrayBuffer());
      }

      if(!outBytes)continue;
      // Verdict anti-rectangle-noir
      const verdict=sample?analyzeRGBA(sample,AS,AS):{score:60,drop:false,reason:'unverified'};
      if(verdict.drop){skipped++;continue;}
      kept.push({name:`${stem}_img${kept.length+1}.jpg`,data:outBytes,score:verdict.score});
    }catch(_){/* image illisible : on continue */}
  }

  Security.wipeMemory(buf);
  setProgress(100,'✅');hideProg();

  const saved=kept.length;
  if(saved){
    renderExtractResults(kept,stem,skipped);
    setStatus(`${saved} ${lang==='fr'?'image(s) lisible(s) extraite(s)':'readable image(s) extracted'}${skipped?` · ${skipped} ${lang==='fr'?'écartée(s)':'filtered out'}`:''}`,'ok');
    showToast(`${saved} ${lang==='fr'?'images extraites':'images extracted'}`,'ok');
  }else{
    setStatus(skipped
      ?(lang==='fr'?`Aucune image lisible : ${skipped} élément(s) écarté(s) (aplats noirs / masques). Pour convertir les pages, utilisez PDF → JPG.`:`No readable image: ${skipped} item(s) filtered out (black fills / masks). To convert pages, use PDF → JPG.`)
      :(lang==='fr'?'Aucune image intégrée trouvée dans ce PDF. Pour convertir les pages en images, utilisez PDF → JPG.':'No embedded images found in this PDF. To convert pages to images, use PDF → JPG.'),'info');
  }

  addRecent(activeFiles[0].name,'extract',activeFiles[0].size);
  incrementStats();
  }catch(e){
    console.error(e);
    try{ if(buf)Security.wipeMemory(buf); }catch(_){}
    hideProg();
    setStatus(lang==='fr'
      ?'❌ Une erreur est survenue pendant l\'extraction. Réessayez (relancez l\'outil).'
      :'❌ An error occurred during extraction. Please try again (re-run the tool).','err');
  }finally{
    isProcessing=false;
    document.querySelectorAll('#ws-body .btn-primary, #tool-body .btn-primary').forEach(b=>b.disabled=false);
  }
  return;
}

// ── Conteneur de résultats PLEINE LARGEUR, placé EN BAS (hors des 2 colonnes) ──
function getExtractResultsBox(){
  let box=document.getElementById('extract-results');
  const host=document.querySelector('main.tool-page')||document.body;
  if(!box){ box=document.createElement('div'); box.id='extract-results'; box.style.marginTop='24px'; }
  if(box.parentElement!==host){ host.appendChild(box); } // sous les colonnes = pleine largeur
  return box;
}

function removeExtractImage(idx){
  if(idx<0||idx>=_extractKept.length) return;
  _extractKept.splice(idx,1);
  renderExtractResults(_extractKept,_extractStem,_extractSkipped);
  if(!_extractKept.length){
    setStatus(lang==='fr'?'Toutes les images ont été retirées.':'All images removed.','info');
  }
}

// Grille horizontale sur plusieurs lignes ; ⬇ télécharge, ✕ retire.
function renderExtractResults(kept,stem,skipped){
  _extractKept=kept; _extractStem=stem; _extractSkipped=skipped;
  _extractUrls.forEach(u=>{try{URL.revokeObjectURL(u);}catch(_){}}); _extractUrls=[];
  const box=getExtractResultsBox();
  box.innerHTML='';
  if(!kept.length){ box.style.display='none'; return; }
  box.style.display='block';

  const head=document.createElement('div');
  head.className='merge-toolbar'; head.style.display='flex';
  const cnt=document.createElement('span');
  cnt.className='merge-count';
  cnt.textContent=lang==='fr'
    ?`${kept.length} image${kept.length>1?'s':''}${skipped?` · ${skipped} écartée${skipped>1?'s':''}`:''}`
    :`${kept.length} image${kept.length>1?'s':''}${skipped?` · ${skipped} filtered`:''}`;
  const dlAll=document.createElement('button');
  dlAll.className='btn-primary'; dlAll.style.cssText='padding:8px 14px;font-size:13px';
  dlAll.textContent=kept.length>1
    ?(lang==='fr'?'Tout télécharger (ZIP)':'Download all (ZIP)')
    :(lang==='fr'?'Télécharger':'Download');
  dlAll.addEventListener('click',async()=>{
    try{
      if(_extractKept.length===1) await dlJpg(_extractKept[0].data,_extractKept[0].name);
      else await dlZip(_extractKept.map(k=>({name:k.name,data:k.data})),`${stem}_images.zip`);
    }catch(e){ if(e.name!=='AbortError') setStatus('❌ '+e.message,'err'); }
  });
  head.appendChild(cnt); head.appendChild(dlAll);
  box.appendChild(head);

  const tip=document.createElement('div');
  tip.className='pg-card-tip';
  tip.textContent=lang==='fr'
    ?'Score = probabilité que l\'image soit une vraie photo lisible. Icône de gauche : retirer · icône de droite : télécharger.'
    :'Score = likelihood the image is a real, readable photo. Left icon: remove · right icon: download.';
  box.appendChild(tip);

  const grid=document.createElement('div');
  grid.style.cssText='display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:16px;margin-top:12px';
  kept.forEach((k,idx)=>{
    const url=URL.createObjectURL(new Blob([k.data],{type:'image/jpeg'}));
    _extractUrls.push(url);
    const card=document.createElement('div');
    card.style.cssText='position:relative;border:1px solid var(--il-bd-card,var(--bd));border-radius:12px;overflow:hidden;background:var(--il-bg-card,var(--sf));box-shadow:0 2px 10px #00000012';
    const img=document.createElement('img');
    img.src=url; img.loading='lazy';
    img.style.cssText='width:100%;height:150px;object-fit:contain;display:block;background:repeating-conic-gradient(#00000008 0% 25%,transparent 0% 50%) 0/16px 16px';
    const X_SVG='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    const DL_SVG='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v11M8 10l4 4 4-4M5 20h14"/></svg>';
    // ✕ retirer (haut GAUCHE)
    const rm=document.createElement('button');
    rm.className='md-btn'; rm.style.left='8px'; rm.innerHTML=X_SVG;
    rm.title=lang==='fr'?'Retirer cette image':'Remove this image';
    rm.addEventListener('click',e=>{ e.stopPropagation(); removeExtractImage(idx); });
    // Télécharger (haut DROITE)
    const dl=document.createElement('button');
    dl.className='md-btn'; dl.style.right='8px'; dl.innerHTML=DL_SVG;
    dl.title=lang==='fr'?'Télécharger cette image':'Download this image';
    dl.addEventListener('click',async e=>{ e.stopPropagation();
      try{ await dlJpg(k.data,k.name); }catch(err){ if(err.name!=='AbortError') setStatus('❌ '+err.message,'err'); }
    });
    // Badge lisibilité (bas de l'image)
    const col=k.score>=70?'#12965A':(k.score>=40?'#C77700':'#B4371F');
    const badge=document.createElement('span');
    badge.textContent=(lang==='fr'?'Lisibilité ':'Readability ')+k.score+'%';
    badge.style.cssText=`position:absolute;bottom:38px;left:8px;background:${col};color:#fff;font-size:11px;font-weight:600;padding:3px 8px;border-radius:20px;box-shadow:0 2px 6px #0003;pointer-events:none`;
    const foot=document.createElement('div');
    foot.textContent=k.name;
    foot.style.cssText='font-size:11px;color:var(--tx2);padding:6px 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
    card.appendChild(img); card.appendChild(dl); card.appendChild(rm); card.appendChild(badge); card.appendChild(foot);
    grid.appendChild(card);
  });
  box.appendChild(grid);
}
