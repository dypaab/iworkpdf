// ============================================================
//  iWorkPDF — metadata.js (outil « Métadonnées PDF »)
//  Charger APRÈS security.js et shared.js.
//
//  Un PDF transporte presque toujours plus que son contenu : nom de l'auteur,
//  logiciel utilisé, dates de création et de modification. C'est une fuite
//  d'information discrète que l'utilisateur ne voit jamais. Cet outil la lui
//  MONTRE d'abord, puis lui laisse corriger ou tout effacer.
// ============================================================

const META_FIELDS = [
  ['title',    'meta_title'],
  ['author',   'meta_author'],
  ['subject',  'meta_subject'],
  ['keywords', 'meta_keywords'],
  ['creator',  'meta_creator'],
  ['producer', 'meta_producer'],
];

function buildMetadataUI(){
  const saveBlock=`<p class="form-label" style="margin-bottom:8px">${t('dest')}</p><div class="save-mode"><div class="save-opt active" id="so-local" onclick="setSave('local')"><div class="save-opt-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M12 3v12M7 10l5 5 5-5"/></svg></div><div class="save-opt-title">${t('localmode')}</div><div class="save-opt-sub">${t('direct')}</div></div><div class="save-opt" id="so-cloud" onclick="setSave('cloud')"><div class="save-opt-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 16a4 4 0 0 1 .4-8A5.5 5.5 0 0 1 17.5 9.5"/><rect x="13" y="13.5" width="9" height="7.5" rx="1.8"/><path d="M15.2 13.5V12a2.3 2.3 0 0 1 4.6 0v1.5"/></svg></div><div class="save-opt-title">${t('savemode')}</div><div class="save-opt-sub">${t('cloudsub')}</div></div></div>`;
  const bottom=`<div class="status-box" id="ts"></div><div class="prog-wrap" id="tp"><div class="prog-bg"><div class="prog-fill" id="pf"></div></div><div class="prog-text" id="pt"></div></div><div class="share-box" id="share-result"><p style="font-size:13px;font-weight:600">🔗 ${t('signedlink')}</p><div class="share-row"><input class="share-inp" id="share-link-inp" readonly/><button class="btn-primary" style="padding:8px 14px;font-size:13px" onclick="copyLink()">${t('copylink')}</button></div><p class="share-exp" id="share-exp-txt"></p></div>`;
  const fields = META_FIELDS.map(([k,lbl]) =>
    `<div class="pn-field"><label for="meta-${k}">${t(lbl)}</label>
       <input class="form-input" type="text" id="meta-${k}" maxlength="500" autocomplete="off"/></div>`).join('');
  return `
    <div class="drop-zone" id="dz">
      <input type="file" accept=".pdf" onchange="onPick(event,'metadata')"/>
      <p class="drop-text">${t('drop')}</p>
      <button class="drop-btn"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> ${t('browse')}</button>
    </div>
    <div id="meta-panel" style="display:none">
      <div id="meta-found" class="status-box" style="display:block;margin-bottom:14px"></div>
      <div class="form-group">
        <div class="radio-group" id="rg-meta">
          <button class="rbn active" type="button" onclick="setMetaMode('edit',this)">${t('meta_mode_edit')}</button>
          <button class="rbn" type="button" onclick="setMetaMode('strip',this)">${t('meta_mode_strip')}</button>
        </div>
      </div>
      <div id="meta-form">
        <div class="pn-grid">${fields}</div>
        <p class="form-hint" style="font-size:12px;color:var(--tx3)">${t('meta_hint')}</p>
      </div>
      <div id="meta-strip-note" style="display:none">
        <p class="form-hint" style="font-size:13px;color:var(--tx2);line-height:1.6">${t('meta_strip_note')}</p>
      </div>
    </div>
    ${saveBlock}${bottom}
    <div class="flex-end"><button class="btn-primary" onclick="run('metadata')">${t('meta_btn')}</button></div>`;
}

let metaMode = 'edit';
function setMetaMode(m, btn){
  metaMode = m;
  document.querySelectorAll('#rg-meta .rbn').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  const form = document.getElementById('meta-form');
  const note = document.getElementById('meta-strip-note');
  if(form) form.style.display = m==='strip' ? 'none' : '';
  if(note) note.style.display = m==='strip' ? '' : 'none';
}

function fmtMetaDate(d){
  if(!d || isNaN(d.getTime())) return null;
  try{ return d.toLocaleString(lang==='fr'?'fr-FR':'en-US'); }catch{ return d.toISOString(); }
}

// Lit et AFFICHE ce que le document contient déjà : c'est la partie utile de
// l'outil, avant même toute modification.
async function renderMetaPanel(){
  const panel = document.getElementById('meta-panel');
  const found = document.getElementById('meta-found');
  if(!panel || !activeFiles.length) return;
  let doc, buf;
  try{
    buf = await activeFiles[0].arrayBuffer();
    // updateMetadata:false est indispensable DÈS LA LECTURE : par défaut pdf-lib
    // réécrit Producer et ModDate au chargement, et on afficherait alors ses
    // propres valeurs à la place de celles réellement contenues dans le fichier.
    doc = await PDFLib.PDFDocument.load(buf, {ignoreEncryption:true, updateMetadata:false});
  }catch{
    if(buf) Security.wipeMemory(buf);
    setStatus(t('meta_unreadable'),'err');
    return;
  }
  const get = fn => { try{ return doc[fn]() || ''; }catch{ return ''; } };
  const vals = {
    title:doc.getTitle&&get('getTitle'), author:get('getAuthor'), subject:get('getSubject'),
    keywords:get('getKeywords'), creator:get('getCreator'), producer:get('getProducer'),
  };
  META_FIELDS.forEach(([k]) => {
    const el = document.getElementById('meta-'+k);
    if(el) el.value = vals[k] || '';
  });

  let created=null, modified=null;
  try{ created = fmtMetaDate(doc.getCreationDate()); }catch{}
  try{ modified = fmtMetaDate(doc.getModificationDate()); }catch{}

  // Résumé honnête : on annonce ce qui est réellement présent, pas une liste vide.
  const present = Object.entries(vals).filter(([,v])=>v && String(v).trim());
  const bits = present.map(([k,v]) => `<strong>${t('meta_'+k)}</strong> : ${Security.escHtml(String(v).slice(0,80))}`);
  if(created)  bits.push(`<strong>${t('meta_created')}</strong> : ${Security.escHtml(created)}`);
  if(modified) bits.push(`<strong>${t('meta_modified')}</strong> : ${Security.escHtml(modified)}`);
  found.innerHTML = bits.length
    ? `<div style="font-size:12px;line-height:1.8">⚠️ ${t('meta_found')}<br>${bits.join('<br>')}</div>`
    : `<div style="font-size:12px">✅ ${t('meta_none')}</div>`;

  Security.wipeMemory(buf);
  panel.style.display = '';
  setMetaMode(metaMode, document.querySelector('#rg-meta .rbn'+(metaMode==='strip'?':last-child':'')));
}

// runMetadata() -> {result, filename} | null
async function runMetadata(activeFiles){
  const buf = await activeFiles[0].arrayBuffer();
  const {PDFDocument} = PDFLib;
  // updateMetadata:false : sans ça, pdf-lib estampille Producer et ModDate avec
  // SES propres valeurs au chargement — un outil censé effacer les métadonnées
  // en réintroduirait donc discrètement, révélant la bibliothèque utilisée.
  const doc = await PDFDocument.load(buf, {updateMetadata:false});
  setProgress(50, t('processing'));

  const set = (fn, v) => { try{ doc[fn](v); }catch{} };
  if(metaMode === 'strip'){
    // Vider les champs via les setters laisserait des entrées vides ET une date
    // de création. On supprime directement les clés du dictionnaire Info : le
    // document ressort sans aucune entrée de métadonnée.
    try{
      const info = doc.context.lookup(doc.context.trailerInfo.Info);
      if(info && info.dict) [...info.dict.keys()].forEach(k => info.delete(k));
    }catch{
      // Repli si la structure interne diffère : au moins vider les champs connus.
      ['setTitle','setAuthor','setSubject','setCreator','setProducer'].forEach(fn => set(fn,''));
      set('setKeywords', []);
    }
  }else{
    META_FIELDS.forEach(([k]) => {
      const v = (document.getElementById('meta-'+k)?.value || '').trim();
      if(k === 'keywords') set('setKeywords', v ? v.split(',').map(x=>x.trim()).filter(Boolean) : []);
      else set('set'+k.charAt(0).toUpperCase()+k.slice(1), v);
    });
  }

  const result = await doc.save({useObjectStreams:true});
  Security.wipeMemory(buf);
  const base = activeFiles[0].name.replace(/\.pdf$/i,'');
  return {result, filename:`${base}_${metaMode==='strip'?'clean':'meta'}.pdf`};
}
