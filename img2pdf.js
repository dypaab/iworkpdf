// ============================================================
//  iWorkPDF — img2pdf.js (logique spécifique à l'outil Images to PDF)
//  Charger APRÈS security.js et shared.js.
// ============================================================

let imgDragSrc=null;

function buildImg2PdfUI(){
  const saveBlock=`<p class="form-label" style="margin-bottom:8px">${t('dest')}</p><div class="save-mode"><div class="save-opt active" id="so-local" onclick="setSave('local')"><div class="save-opt-icon">💾</div><div class="save-opt-title">${t('localmode')}</div><div class="save-opt-sub">${t('direct')}</div></div><div class="save-opt" id="so-cloud" onclick="setSave('cloud')"><div class="save-opt-icon">☁️ 🔒</div><div class="save-opt-title">Cloud 48h</div><div class="save-opt-sub">${t('cloudsub')}</div></div></div>`;
  const bottom=`<div class="status-box" id="ts"></div><div class="prog-wrap" id="tp"><div class="prog-bg"><div class="prog-fill" id="pf"></div></div><div class="prog-text" id="pt"></div></div><div class="share-box" id="share-result"><p style="font-size:13px;font-weight:600">🔗 ${t('signedlink')}</p><div class="share-row"><input class="share-inp" id="share-link-inp" readonly/><button class="btn-primary" style="padding:8px 14px;font-size:13px" onclick="copyLink()">${t('copylink')}</button></div><p class="share-exp" id="share-exp-txt"></p></div>`;
  return `
    <div class="drop-zone" id="dz">
      <input type="file" accept=".jpg,.jpeg,.png,.webp,.bmp" multiple onchange="onPick(event,'img2pdf')"/>
      <p class="drop-text">${t('dropimg')}</p>
      <button class="drop-btn"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> ${t('browse')}</button>
    </div>
    <div id="img-preview" style="display:none">
      <div class="pg-card-tip">↕️ ${lang==='fr'?'Glissez les images pour réordonner. ✕ pour supprimer':'Drag images to reorder. ✕ to remove'}</div>
      <div class="merge-toolbar">
        <span class="merge-count" id="img-count"></span>
        <button class="btn-sm" onclick="imgClearAll()">🗑 ${lang==='fr'?'Tout supprimer':'Remove all'}</button>
      </div>
      <div class="img-grid" id="img-grid"></div>
    </div>
    <label class="chk-line"><input type="checkbox" id="img2pdf-reverse"/><span>${lang==='fr'?'Ordre inversé (dernière image → première)':'Reverse order (last image → first)'}</span></label>
    ${saveBlock}${bottom}
    <div class="flex-end"><button class="btn-primary" onclick="run('img2pdf')">${t('img_btn')}</button></div>`;
}

function renderImgGrid(){
  const grid=document.getElementById('img-grid');
  const prev=document.getElementById('img-preview');
  if(!grid) return;
  if(prev) prev.style.display=activeFiles.length?'block':'none';
  const count=document.getElementById('img-count');
  if(count) count.textContent=lang==='fr'?`${activeFiles.length} image${activeFiles.length>1?'s':''}`:`${activeFiles.length} image${activeFiles.length>1?'s':''}`;
  grid.innerHTML='';
  activeFiles.forEach((f,i)=>{
    const card=document.createElement('div');
    card.className='img-card';
    card.draggable=true;
    card.dataset.idx=i;
    // Image preview
    const img=document.createElement('img');
    img.src=URL.createObjectURL(f);
    img.onload=()=>URL.revokeObjectURL(img.src);
    card.appendChild(img);
    // Numéro
    const num=document.createElement('div');
    num.className='img-card-num';
    num.textContent=i+1;
    card.appendChild(num);
    // Delete
    const del=document.createElement('button');
    del.className='img-card-del';
    del.innerHTML='✕';
    del.addEventListener('click',e=>{e.stopPropagation();activeFiles.splice(i,1);renderImgGrid();});
    card.appendChild(del);
    // Name
    const name=document.createElement('div');
    name.className='img-card-name';
    name.textContent=f.name;
    card.appendChild(name);
    // Flèches tactiles (le drag HTML5 ne marche pas au doigt)
    const mvL=document.createElement('button');
    mvL.className='img-mv img-mv-l';mvL.textContent='‹';
    mvL.disabled=i===0;
    mvL.addEventListener('click',e=>{e.stopPropagation();if(i>0){const m=activeFiles.splice(i,1)[0];activeFiles.splice(i-1,0,m);renderImgGrid();}});
    card.appendChild(mvL);
    const mvR=document.createElement('button');
    mvR.className='img-mv img-mv-r';mvR.textContent='›';
    mvR.disabled=i===activeFiles.length-1;
    mvR.addEventListener('click',e=>{e.stopPropagation();if(i<activeFiles.length-1){const m=activeFiles.splice(i,1)[0];activeFiles.splice(i+1,0,m);renderImgGrid();}});
    card.appendChild(mvR);
    // Drag
    card.addEventListener('dragstart',e=>{imgDragSrc=i;card.classList.add('dragging');e.dataTransfer.effectAllowed='move';});
    card.addEventListener('dragend',()=>{card.classList.remove('dragging');document.querySelectorAll('.img-card').forEach(c=>c.classList.remove('drag-over'));});
    card.addEventListener('dragover',e=>{e.preventDefault();document.querySelectorAll('.img-card').forEach(c=>c.classList.remove('drag-over'));card.classList.add('drag-over');});
    card.addEventListener('drop',e=>{
      e.preventDefault();
      if(imgDragSrc===null||imgDragSrc===i)return;
      const moved=activeFiles.splice(imgDragSrc,1)[0];
      activeFiles.splice(i,0,moved);
      imgDragSrc=null;
      renderImgGrid();
    });
    grid.appendChild(card);
  });
}

function imgClearAll(){activeFiles=[];renderImgGrid();}

// runImg2Pdf(activeFiles) -> {result, filename} | null
async function runImg2Pdf(activeFiles){
  let result, filename;
  const{PDFDocument}=PDFLib;
      const doc=await PDFDocument.create();
      // ⚠️ Ne PAS wiper les buffers avant doc.save() : embedJpg/embedPng gardent
      // des VUES sur ces octets — les effacer dans la boucle produisait des
      // pages blanches. On les efface après la sérialisation.
      const bufs=[];
      // Ordre : premier → dernier, ou inversé si la case est cochée.
      const files=(document.getElementById('img2pdf-reverse')?.checked===true)
        ?[...activeFiles].reverse():activeFiles;
      for(let i=0;i<files.length;i++){
        setProgress(5+((i+1)/files.length)*80,`Image ${i+1}/${files.length}…`);
        const buf=await files[i].arrayBuffer();
        bufs.push(buf);
        const ext=files[i].name.split('.').pop().toLowerCase();
        let img;
        if(['jpg','jpeg'].includes(ext))img=await doc.embedJpg(buf);
        else if(ext==='png')img=await doc.embedPng(buf);
        else{
          const blob=new Blob([buf],{type:`image/${ext==='bmp'?'bmp':'webp'}`}); /* files[i] */
          const url=URL.createObjectURL(blob);
          const pngBuf=await convertImgToPng(url);
          URL.revokeObjectURL(url);
          img=await doc.embedPng(pngBuf);
        }
        const page=doc.addPage([img.width,img.height]);
        page.drawImage(img,{x:0,y:0,width:img.width,height:img.height});
      }
      result=await doc.save();
      bufs.forEach(b=>Security.wipeMemory(b));
      filename='images_'+activeFiles[0].name.replace(/\.[^.]+$/,'').substring(0,30)+'.pdf';
  return {result, filename};
}
