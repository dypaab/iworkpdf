// ============================================================
//  iWorkPDF — pagenums.js (logique spécifique à l'outil Add Page Numbers)
//  Charger APRÈS security.js et shared.js.
// ============================================================

let pnPos='bc', pnFmt='num';

function buildPageNumsUI(){
  const saveBlock=`<p class="form-label" style="margin-bottom:8px">${t('dest')}</p><div class="save-mode"><div class="save-opt active" id="so-local" onclick="setSave('local')"><div class="save-opt-icon">💾</div><div class="save-opt-title">${t('localmode')}</div><div class="save-opt-sub">${t('direct')}</div></div><div class="save-opt" id="so-cloud" onclick="setSave('cloud')"><div class="save-opt-icon">☁️ 🔒</div><div class="save-opt-title">Cloud 48h</div><div class="save-opt-sub">${t('cloudsub')}</div></div></div>`;
  const bottom=`<div class="status-box" id="ts"></div><div class="prog-wrap" id="tp"><div class="prog-bg"><div class="prog-fill" id="pf"></div></div><div class="prog-text" id="pt"></div></div><div class="share-box" id="share-result"><p style="font-size:13px;font-weight:600">🔗 ${t('signedlink')}</p><div class="share-row"><input class="share-inp" id="share-link-inp" readonly/><button class="btn-primary" style="padding:8px 14px;font-size:13px" onclick="copyLink()">${t('copylink')}</button></div><p class="share-exp" id="share-exp-txt"></p></div>`;

  const positions=[
    {id:'tl',lbl:t('pos_tl')},{id:'tc',lbl:t('pos_tc')},{id:'tr',lbl:t('pos_tr')},
    {id:'bl',lbl:t('pos_bl')},{id:'bc',lbl:t('pos_bc')},{id:'br',lbl:t('pos_br')},
  ];
  const formats=[
    {id:'num',lbl:t('fmt_num')},
    {id:'page',lbl:t('fmt_page')},
    {id:'of',lbl:t('fmt_of')},
    {id:'dash',lbl:t('fmt_dash')},
  ];

  return `
    <div class="drop-zone" id="dz">
      <input type="file" accept=".pdf,.pptx" onchange="onPick(event,'pagenums')"/>
      <p class="drop-text">${t('drop')}</p>
      <button class="drop-btn"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> ${t('browse')}</button>
    </div>
    <div class="file-list" id="fl"></div>

    <div class="form-group">
      <label class="form-label">${t('pn_format')}</label>
      <div class="radio-group" id="rg-fmt">
        ${formats.map(f=>`<button class="rbn${f.id==='num'?' active':''}" onclick="setPnFmt(this,'${f.id}')">${f.lbl}</button>`).join('')}
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">${t('pn_pos')}</label>
      <div class="pn-pos-grid" id="rg-pos">
        ${positions.map(p=>`<button class="pn-pos-btn${p.id==='bc'?' active':''}" onclick="setPnPos(this,'${p.id}')">${p.lbl}</button>`).join('')}
      </div>
    </div>

    <div class="pn-grid">
      <div class="pn-field">
        <label>${t('pn_start')}</label>
        <input class="form-input" type="number" id="pn-start" value="1" min="1" max="9999" oninput="updatePnPreview()"/>
      </div>
      <div class="pn-field">
        <label>${t('pn_fontsize')} (pt)</label>
        <input class="form-input" type="number" id="pn-size" value="12" min="6" max="48" oninput="updatePnPreview()"/>
      </div>
      <div class="pn-field">
        <label>${t('pn_prefix')}</label>
        <input class="form-input" type="text" id="pn-prefix" placeholder="" maxlength="20" oninput="updatePnPreview()"/>
      </div>
      <div class="pn-field">
        <label>${t('pn_suffix')}</label>
        <input class="form-input" type="text" id="pn-suffix" placeholder="" maxlength="20" oninput="updatePnPreview()"/>
      </div>
      <div class="pn-field">
        <label>${t('pn_color')}</label>
        <input type="color" id="pn-color" value="#000000" style="width:100%;height:42px;border-radius:var(--r2);border:1px solid var(--bd);cursor:pointer;background:none" oninput="updatePnPreview()"/>
      </div>
    </div>

    <label class="form-label">${t('pn_preview')}</label>
    <div class="pn-preview-box" id="pn-preview-box">
      <div class="pn-preview-lines">
        <div class="pn-preview-line"></div>
        <div class="pn-preview-line"></div>
        <div class="pn-preview-line"></div>
      </div>
      <div class="pn-preview-num" id="pn-preview-num">1</div>
    </div>

    ${saveBlock}${bottom}
    <div class="flex-end"><button class="btn-primary" onclick="run('pagenums')">${t('pn_apply')}</button></div>`;
}

function setPnPos(btn, pos){
  pnPos=pos;
  document.querySelectorAll('.pn-pos-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  updatePnPreview();
}

function setPnFmt(btn, fmt){
  pnFmt=fmt;
  document.querySelectorAll('#rg-fmt .rbn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  updatePnPreview();
}

function pnLabelFromParams(pageNum, totalPages, fmt, startNum, prefix, suffix){
  const n = pageNum + startNum - 1;
  let core='';
  if(fmt==='num')  core=`${n}`;
  else if(fmt==='page') core=`${lang==='fr'?'Page':'Page'} ${n}`;
  else if(fmt==='of')   core=`${lang==='fr'?'Page':'Page'} ${n} ${lang==='fr'?'sur':'of'} ${totalPages}`;
  else if(fmt==='dash') core=`— ${n} —`;
  return `${prefix}${core}${suffix}`;
}

function getPnLabel(pageNum, totalPages){
  const prefix = document.getElementById('pn-prefix')?.value || '';
  const suffix = document.getElementById('pn-suffix')?.value || '';
  const start  = parseInt(document.getElementById('pn-start')?.value||'1');
  return pnLabelFromParams(pageNum, totalPages, pnFmt, start, prefix, suffix);
}

function updatePnPreview(){
  const el  = document.getElementById('pn-preview-num');
  const box = document.getElementById('pn-preview-box');
  if(!el||!box) return;
  el.textContent = getPnLabel(1, 10);
  const color = document.getElementById('pn-color')?.value || '#000000';
  el.style.color = color;
  const size = Math.max(8, Math.min(28, parseInt(document.getElementById('pn-size')?.value||'12')));
  el.style.fontSize = size + 'px';
  // Positionnement dans la preview
  const map = {
    tl:{top:'8px',left:'8px',right:'auto',bottom:'auto',transform:'none'},
    tc:{top:'8px',left:'50%',right:'auto',bottom:'auto',transform:'translateX(-50%)'},
    tr:{top:'8px',right:'8px',left:'auto',bottom:'auto',transform:'none'},
    bl:{bottom:'8px',left:'8px',right:'auto',top:'auto',transform:'none'},
    bc:{bottom:'8px',left:'50%',right:'auto',top:'auto',transform:'translateX(-50%)'},
    br:{bottom:'8px',right:'8px',left:'auto',top:'auto',transform:'none'},
  };
  const s = map[pnPos]||map.bc;
  Object.assign(el.style, s);
}

// runPageNums(activeFiles, pnPos, pnFmt) -> {result, filename} | null
async function runPageNums(activeFiles, pnPos, pnFmt){
  let result, filename;
  const file=activeFiles[0];
      const ext=file.name.split('.').pop().toLowerCase();
      const startNum=parseInt(document.getElementById('pn-start')?.value||'1');
      const fontSize=Math.max(6,Math.min(48,parseInt(document.getElementById('pn-size')?.value||'12')));
      const color=document.getElementById('pn-color')?.value||'#000000';

      if(ext==='pdf'){
        // ── PDF: numérotation via pdf-lib ──────────────────
        const buf=await file.arrayBuffer();
        const{PDFDocument,rgb,StandardFonts}=PDFLib;
        const src=await PDFDocument.load(buf,{ignoreEncryption:true});
        const font=await src.embedFont(StandardFonts.HelveticaBold);
        const pages=src.getPages();
        const total=pages.length;
        // Parser couleur hex → rgb
        const hr=parseInt(color.slice(1,3),16)/255;
        const hg=parseInt(color.slice(3,5),16)/255;
        const hb=parseInt(color.slice(5,7),16)/255;
        const pdfColor=rgb(hr,hg,hb);
        const pdfFontSize=fontSize;
        // BUG D FIX: extraire valeurs DOM avant boucle
        const pnPrefix=document.getElementById('pn-prefix')?.value||'';
        const pnSuffix=document.getElementById('pn-suffix')?.value||'';
        const pnStart=parseInt(document.getElementById('pn-start')?.value||'1');
        const pnFmtSnap=pnFmt; // snapshot de l'état au moment du lancement
        const pnPosSnap=pnPos;
        setProgress(40,'Numbering pages…');
        pages.forEach((page,i)=>{
          const{width,height}=page.getSize();
          const label=pnLabelFromParams(i+1,total,pnFmtSnap,pnStart,pnPrefix,pnSuffix);
          const textW=font.widthOfTextAtSize(label,pdfFontSize);
          const margin=20;
          // Calculer x,y selon position
          let x,y;
          const posMap={
            bl:{x:margin,       y:margin},
            bc:{x:(width-textW)/2, y:margin},
            br:{x:width-textW-margin, y:margin},
            tl:{x:margin,       y:height-pdfFontSize-margin},
            tc:{x:(width-textW)/2, y:height-pdfFontSize-margin},
            tr:{x:width-textW-margin, y:height-pdfFontSize-margin},
          };
          const pos=posMap[pnPosSnap]||posMap.bc;
          page.drawText(label,{x:pos.x,y:pos.y,size:pdfFontSize,font,color:pdfColor});
        });
        result=await src.save();
        Security.wipeMemory(buf);
        filename=file.name.replace('.pdf','')+'_numbered.pdf';

      } else if(ext==='pptx'){
        // ── PPTX: numérotation via manipulation XML ─────────
        setProgress(30,'Reading PPTX…');
        // Charger JSZip si absent
        if(!window.JSZip){
          await new Promise((res,rej)=>{
            const s=document.createElement('script');
            s.src='https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
            s.onload=res;s.onerror=rej;
            document.head.appendChild(s);
          });
        }
        const buf=await file.arrayBuffer();
        const zip=await JSZip.loadAsync(buf);
        // Lire presentation.xml pour connaître le nombre de slides
        const presXml=await zip.file('ppt/presentation.xml').async('string');
        // Activer la numérotation dans chaque slide via slidex.xml
        const slideFiles=Object.keys(zip.files).filter(f=>/^ppt\/slides\/slide\d+\.xml$/.test(f)).sort((a,b)=>{
          const na=parseInt(a.match(/\d+/)[0]);
          const nb=parseInt(b.match(/\d+/)[0]);
          return na-nb;
        });
        const total=slideFiles.length;
        setProgress(50,'Numbering slides…');
        // BUG A FIX: extraire les paramètres UNE FOIS avant la boucle
        const ooColor=color.replace('#','').toUpperCase();
        const ooSize=fontSize*100;
        const sw=9144000,sh=6858000;
        const boxW=2000000,boxH=380000;
        const posMap={
          bl:{cx:200000,cy:sh-boxH-150000},
          bc:{cx:(sw-boxW)/2,cy:sh-boxH-150000},
          br:{cx:sw-boxW-200000,cy:sh-boxH-150000},
          tl:{cx:200000,cy:150000},
          tc:{cx:(sw-boxW)/2,cy:150000},
          tr:{cx:sw-boxW-200000,cy:150000},
        };
        const pPos=posMap[pnPos]||posMap.bc;
        const algn=pnPos.endsWith('l')?'l':pnPos.endsWith('r')?'r':'ctr';

        for(let i=0;i<slideFiles.length;i++){
          const slidePath=slideFiles[i];
          let slideXml=await zip.file(slidePath).async('string');
          // BUG D FIX: label calculé depuis paramètres extraits (pas le DOM)
          const label=pnLabelFromParams(i+1,total,pnFmt,startNum,
            document.getElementById('pn-prefix')?.value||'',
            document.getElementById('pn-suffix')?.value||'');
          // BUG B FIX: sp sans placeholder (textbox ordinaire) pour éviter corruption XML
          const spId=90000+i; // ID très élevé pour éviter conflits
          const spXml=`<p:sp>`+
            `<p:nvSpPr>`+
              `<p:cNvPr id="${spId}" name="iWorkPDF_PageNum_${i}"/>`+
              `<p:cNvSpPr txBox="1"><a:spLocks noGrp="1"/></p:cNvSpPr>`+
              `<p:nvPr/>`+
            `</p:nvSpPr>`+
            `<p:spPr>`+
              `<a:xfrm><a:off x="${pPos.cx}" y="${pPos.cy}"/><a:ext cx="${boxW}" cy="${boxH}"/></a:xfrm>`+
              `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>`+
              `<a:noFill/><a:ln><a:noFill/></a:ln>`+
            `</p:spPr>`+
            `<p:txBody>`+
              `<a:bodyPr anchor="ctr"/><a:lstStyle/>`+
              `<a:p><a:pPr algn="${algn}"/>`+
                `<a:r><a:rPr lang="fr-FR" sz="${ooSize}" b="1" dirty="0">`+
                  `<a:solidFill><a:srgbClr val="${ooColor}"/></a:solidFill>`+
                `</a:rPr><a:t>${label}</a:t></a:r>`+
              `</a:p>`+
            `</p:txBody></p:sp>`;
          slideXml=slideXml.replace('</p:spTree>',spXml+'</p:spTree>');
          zip.file(slidePath,slideXml);
        }
        const outBuf=await zip.generateAsync({type:'uint8array',compression:'DEFLATE'});
        // Pour PPTX: dlBytes avec extension .pptx
        setProgress(90,'Finalizing…');
        Security.wipeMemory(buf);
        // Télécharger directement (PPTX, pas PDF)
        const pptxFilename=file.name.replace('.pptx','')+'_numbered.pptx';
        if(window.showSaveFilePicker){
          try{
            const handle=await window.showSaveFilePicker({
              suggestedName:pptxFilename,
              types:[{description:'PowerPoint',accept:{'application/vnd.openxmlformats-officedocument.presentationml.presentation':['.pptx']}}]
            });
            const writable=await handle.createWritable();
            await writable.write(new Blob([outBuf],{type:'application/vnd.openxmlformats-officedocument.presentationml.presentation'}));
            await writable.close();
          }catch(e){
            if(e.name==='AbortError'){isProcessing=false;document.querySelectorAll('#ws-body .btn-primary').forEach(b=>b.disabled=false);return;}
          }
        }else{
          const url=URL.createObjectURL(new Blob([outBuf]));
          const a=document.createElement('a');a.href=url;a.download=pptxFilename;
          document.body.appendChild(a);a.click();document.body.removeChild(a);
          setTimeout(()=>URL.revokeObjectURL(url),5000);
        }
        setProgress(100,'✅');hideProg();
        setStatus(`✅ PPTX ${lang==='fr'?'numéroté':'numbered'} — ${total} slides`,'ok');
        await audit('pagenums',null,{filename:pptxFilename,slides:total,type:'pptx'});
        isProcessing=false;
        document.querySelectorAll('#ws-body .btn-primary').forEach(b=>b.disabled=false);
        return;
      }
  return {result, filename};
}
