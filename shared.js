// ============================================================
//  iWorkPDF — shared.js (commun à toutes les pages)
//  Auth, historique cloud, trust/privacy, thème, dictionnaire i18n,
//  dispatch run() générique. Charger APRÈS security.js, AVANT le JS
//  spécifique de chaque page (ex: compress.js).
// ============================================================


const SUPABASE_URL='https://iispzrdathkixcgriyrr.supabase.co';
const SUPABASE_KEY='sb_publishable_quzgA4pxNzzzqntQOF6WoQ_3ZnFB36C';
// ROBUSTESSE MOBILE : si le CDN supabase-js n'a pas chargé (réseau mobile,
// data-saver, SW offline), on continue SANS cloud/auth au lieu de crasher
// tout shared.js (avant : ReferenceError → grille d'outils vide, site mort).
const sb=(window.supabase&&window.supabase.createClient)
  ?window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true}})
  :null;
if(!sb)console.warn('[iWorkPDF] supabase-js absent — outils locaux OK, cloud/auth désactivés');

let lang='en',user=null,saveMode='local';
let activeFiles=[],rotateAngle=90,secMode='protect';
let isProcessing=false;
// BUG D FIX: garder le userId avant que onAuthStateChange le vide
let _lastUserId=null;
let isDark=false; // mode clair par défaut
let netRequestCount=0,netIsActive=false,netTimer=null;
let privacyMode=false;

// Listener global d'état d'auth — enregistré une seule fois au chargement de shared.js.
// Était dans le bloc global non-fonction de l'original → absent lors de la migration
// → bouton "Création du compte…" bloqué indéfiniment (signUp() ne terminait jamais côté UI).
if(sb)sb.auth.onAuthStateChange(async(event,session)=>{
  const prevUserId=_lastUserId;
  user=session?.user||null;
  _lastUserId=user?.id||null;
  updateAuthUI();
  if(event==='PASSWORD_RECOVERY'){
    // L'utilisateur a cliqué le lien de réinitialisation → écran nouveau mot de passe
    if(typeof openNewPasswordModal==='function') openNewPasswordModal();
  }
  if(event==='SIGNED_IN'&&user){
    await audit('login',null,{email:user.email});
    closeAuth();
  }
  if(event==='SIGNED_OUT'&&prevUserId){
    try{ await sb.from('audit_logs').insert({user_id:prevUserId,action:'logout',metadata:{ua:navigator.userAgent.substring(0,80)}}); }catch(_){}
  }
});

const T={
  en:{illu_pc:'Your computer',illu_local:'Local processing',illu_dl:'Download',illu_nosrv:'No server',demo_drop:'Drop a PDF here to try',demo_pick:'Now pick a tool for your PDF 👇',why:'Why iWorkPDF?',badge:'Secured & Private',h1:'Your PDFs,',h2:'secured.',sub:'Processed locally in your browser — nothing uploaded unless you choose to share. Shared files are automatically deleted after 48h.',cta1:'Get started',cta2:'Create account',sb1:'Encrypted in transit',sb2:'Signed URLs (1h)',sb3:'Auto-delete 48h',sb4:'Audit logs',sb5:'RLS isolation',st1:'PDF Tools',st2:'Local by default',st3:'Cloud: auto-deleted 48h',st4:'Files processed',ttl:'What do you want to do?',tsub:'Click a tool to get started',signin:'Sign in',register:'Register',logout:'Sign out',myacc:'My account',myfiles:'My files',actlog:'Activity log',histtitle:'My files',vfy:'Check your email to activate your account.',logininfo:'Your credentials are encrypted and never stored in plain text.',reginfo:'A confirmation email will be sent. Your account will be active after verification.',firstname:'First name',password:'Password',pwdmin:'Password (8 chars min.)',confirmpwd:'Confirm password',loading:'Loading…',nofiles:'No shared files',noactivity:'No activity yet',expiresin:'Expires in',deleteon:'File deleted on',linkvalid:'Link valid until',signedlink:'Secure link (valid 1h):',copylink:'Copy',linkcopied:'Link copied!',localmode:'Local',savemode:'Save file',cloudsub:'Saved 48h in your account',footer:'100% local processing · Signed URLs · Auto-delete 48h · Audit logs',merge:'Merge PDFs',delete:'Delete pages',split:'Split PDF',rotate:'Rotate',compress:'Compress',security:'Security',watermark:'Watermark',img2pdf:'Images → PDF',dmerge:'Combine multiple PDFs',ddelete:'Remove specific pages',dsplit:'Export each page as PDF',drotate:'Rotate pages 90°, 180°…',dcompress:'Reduce PDF file size',dsecurity:'Protect or unlock a PDF',dwatermark:'Add diagonal watermark',dimg2pdf:'Convert JPG/PNG to PDF',drop:'Drag your PDFs here',dropimg:'Drag your images here',browse:'or click to browse',max:'Max 50 MB per file',pagesdel:'Pages to delete (e.g. 1,3,5-8):',pwdlbl:'Password:',wmlbl:'Watermark text:',angle:'Angle:',dest:'Destination:',direct:'Direct download',merge_btn:'🔀 Merge',del_btn:'🗑 Delete',split_btn:'✂️ Split',rot_btn:'🔄 Apply',comp_btn:'🗜 Compress',comp_quality:'Compression level',comp_low:'⚡ Max compression',comp_med:'✅ Recommended',comp_high:'💎 Light',comp_scanning:'Analyzing PDF…',comp_est_title:'Estimate before compressing',comp_est_max:'Max possible',comp_est_rec:'Recommended (quality kept)',comp_est_images:'images detected',comp_est_none:'No compressible images found — gain will be limited.',comp_optimizing:'Recompressing images…',sec_btn:'Apply',wm_btn:'💧 Apply',img_btn:'🖼 Convert',protect:'🔒 Protect',unlock:'🔓 Unlock',processing:'Processing…',reading:'Reading…',done:'Done! File downloaded.',uploading:'Secure upload…',uploaded:'File uploaded successfully.',splitinfo:'Each page will be downloaded separately.',secnote:'🔒 Real AES-256 encryption — runs 100% in your browser.',nofile:'Please add a file.',nopages:'Enter page numbers.',nopwd:'Enter a password.',nowm:'Enter watermark text.',alldeleted:'Cannot delete all pages.',signedin:'Signing in…',creatingacc:'Creating account…',accreated:'✅ Account created! Check your email to activate it.',download:'⬇ Download',
    sign:'Sign PDF',dsign:'Add handwritten signature to PDF',extract:'Extract Images',dextract:'Extract embedded photos at original resolution',
    repair:'Repair PDF',drepair:'Fix corrupted or damaged PDF files',
    crop:'Crop PDF',dcrop:'Remove margins or crop pages to a specific area',
    crop_margin:'Margin to remove (mm)',crop_all:'Apply to all pages',
    crop_apply:'✂ Crop',repair_apply:'🔧 Repair',
    repair_ok:'PDF repaired successfully',
    dragging_hint:'Drop a PDF here to start',
    shortcut_hint:'⌨️ Shortcuts: Ctrl+1-9 to open tools',
    file_info:'File info',
    recent:'Recent files',no_recent:'No recent files',
    tool_count:'Files processed',

    pagenums:'Page Numbers',dpagenums:'Add page numbers to PDF or PPTX',
    pdf2jpg:'PDF → JPG',dpdf2jpg:'Export each page as JPG image',
    pn_format:'Number format',pn_pos:'Position',pn_start:'Start from',
    pn_fontsize:'Font size',pn_color:'Color',pn_prefix:'Prefix',pn_suffix:'Suffix',
    pn_apply:'🔢 Apply',pn_preview:'Preview',
    pn_file:'File (PDF or PPTX)',
    pos_bc:'Bottom center',pos_br:'Bottom right',pos_bl:'Bottom left',
    pos_tc:'Top center',pos_tr:'Top right',pos_tl:'Top left',
    fmt_num:'1  2  3',fmt_page:'Page 1',fmt_of:'Page 1 of N',fmt_dash:'— 1 —',
    pdf2jpg_apply:'🖼 Export JPG',pdf2jpg_quality:'Quality',
    pdf2jpg_done:'JPG files saved',
},
  fr:{illu_pc:'Votre ordinateur',illu_local:'Traitement local',illu_dl:'Téléchargement',illu_nosrv:'Aucun serveur',demo_drop:'Déposez un PDF ici pour essayer',demo_pick:'Choisissez maintenant un outil pour votre PDF 👇',why:'Pourquoi iWorkPDF ?',badge:'Sécurisé & Privé',h1:'Vos PDFs,',h2:'en sécurité.',sub:'Traitement local dans votre navigateur — rien n\'est envoyé sauf si vous choisissez de partager. Les fichiers partagés sont supprimés automatiquement après 48h.',cta1:'Commencer',cta2:'Créer un compte',sb1:'Chiffrement en transit',sb2:'URLs signées (1h)',sb3:'Suppression auto 48h',sb4:'Audit logs',sb5:'Isolation RLS',st1:'Outils PDF',st2:'Local par défaut',st3:'Cloud: supprimé après 48h',st4:'Fichiers traités',ttl:'Que voulez-vous faire ?',tsub:'Cliquez sur un outil pour commencer',signin:'Connexion',register:'Inscription',logout:'Se déconnecter',myacc:'Mon compte',myfiles:'Mes fichiers',actlog:"Journal d'activité",histtitle:'Mes fichiers',vfy:'Vérifiez votre email pour activer votre compte.',logininfo:'Vos identifiants sont chiffrés et jamais stockés en clair.',reginfo:'Un email de confirmation vous sera envoyé. Votre compte sera actif après vérification.',firstname:'Prénom',password:'Mot de passe',pwdmin:'Mot de passe (8 car. min.)',confirmpwd:'Confirmer le mot de passe',loading:'Chargement…',nofiles:'Aucun fichier partagé',noactivity:'Aucune activité',expiresin:'Expire dans',deleteon:'Fichier supprimé le',linkvalid:"Lien valide jusqu'à",signedlink:'Lien sécurisé (valide 1h) :',copylink:'Copier',linkcopied:'Lien copié !',localmode:'Local',savemode:'Sauvegarder',cloudsub:'Enregistré 48h dans votre compte',footer:'Traitement 100% local · URLs signées · Suppression auto 48h · Audit logs',merge:'Fusionner',delete:'Supprimer pages',split:'Diviser',rotate:'Rotation',compress:'Compresser',security:'Sécurité',watermark:'Filigrane',img2pdf:'Images → PDF',dmerge:'Combinez plusieurs PDFs',ddelete:'Supprimez des pages précises',dsplit:'Exportez chaque page en PDF',drotate:'Pivotez les pages à 90°, 180°…',dcompress:'Réduisez la taille du PDF',dsecurity:'Protégez ou déverrouillez un PDF',dwatermark:'Ajoutez un filigrane diagonal',dimg2pdf:'Convertissez JPG/PNG en PDF',drop:'Glissez vos PDFs ici',dropimg:'Glissez vos images ici',browse:'ou cliquez pour parcourir',max:'Max 50 Mo par fichier',pagesdel:'Pages à supprimer (ex: 1,3,5-8) :',pwdlbl:'Mot de passe :',wmlbl:'Texte du filigrane :',angle:'Angle :',dest:'Destination :',direct:'Téléchargement direct',merge_btn:'🔀 Fusionner',del_btn:'🗑 Supprimer',split_btn:'✂️ Diviser',rot_btn:'🔄 Appliquer',comp_btn:'🗜 Compresser',comp_quality:'Niveau de compression',comp_low:'⚡ Compression max',comp_med:'✅ Recommandé',comp_high:'💎 Léger',comp_scanning:'Analyse du PDF…',comp_est_title:'Estimation avant compression',comp_est_max:'Maximum possible',comp_est_rec:'Recommandé (qualité préservée)',comp_est_images:'images détectées',comp_est_none:'Aucune image compressible détectée — le gain sera limité.',comp_optimizing:'Recompression des images…',sec_btn:'Appliquer',wm_btn:'💧 Appliquer',img_btn:'🖼 Convertir',protect:'🔒 Protéger',unlock:'🔓 Déverrouiller',processing:'Traitement…',reading:'Lecture…',done:'Terminé ! Fichier téléchargé.',uploading:'Upload sécurisé…',uploaded:'Fichier uploadé avec succès.',splitinfo:'Chaque page sera téléchargée séparément en local.',secnote:'🔒 Chiffrement AES-256 réel — 100% dans votre navigateur.',nofile:'Ajoutez un fichier.',nopages:'Entrez les numéros de pages.',nopwd:'Entrez un mot de passe.',nowm:'Entrez le texte du filigrane.',alldeleted:'Impossible de supprimer toutes les pages.',signedin:'Connexion…',creatingacc:'Création du compte…',accreated:'✅ Compte créé ! Vérifiez votre email pour l\'activer.',download:'⬇ Télécharger',
    sign:'Signer PDF',dsign:'Ajoutez une signature manuscrite au PDF',extract:'Extraire Images',dextract:'Extrait les photos intégrées en résolution d\'origine',
    repair:'Réparer PDF',drepair:'Réparez un fichier PDF corrompu ou endommagé',
    crop:'Rogner PDF',dcrop:'Supprimez les marges ou rognez les pages',
    crop_margin:'Marge à supprimer (mm)',crop_all:'Appliquer à toutes les pages',
    crop_apply:'✂ Rogner',repair_apply:'🔧 Réparer',
    repair_ok:'PDF réparé avec succès',
    dragging_hint:'Déposez un PDF ici pour commencer',
    shortcut_hint:'⌨️ Raccourcis: Ctrl+1-9 pour ouvrir les outils',
    file_info:'Infos fichier',
    recent:'Fichiers récents',no_recent:'Aucun fichier récent',
    tool_count:'Fichiers traités',

    pagenums:'Numérotation',dpagenums:'Numéroter les pages PDF ou PPTX',
    pdf2jpg:'PDF → JPG',dpdf2jpg:'Exporter chaque page en image JPG',
    pn_format:'Format du numéro',pn_pos:'Position',pn_start:'Commencer à',
    pn_fontsize:'Taille police',pn_color:'Couleur',pn_prefix:'Préfixe',pn_suffix:'Suffixe',
    pn_apply:'🔢 Appliquer',pn_preview:'Aperçu',
    pn_file:'Fichier (PDF ou PPTX)',
    pos_bc:'Bas centre',pos_br:'Bas droite',pos_bl:'Bas gauche',
    pos_tc:'Haut centre',pos_tr:'Haut droite',pos_tl:'Haut gauche',
    fmt_num:'1  2  3',fmt_page:'Page 1',fmt_of:'Page 1 sur N',fmt_dash:'— 1 —',
    pdf2jpg_apply:'🖼 Exporter JPG',pdf2jpg_quality:'Qualité',
    pdf2jpg_done:'Fichiers JPG enregistrés',
}
};

const TOOLS=[
  {id:'merge',    icon:'🔀',nk:'merge',    dk:'dmerge', migrated:true},
  {id:'delete',   icon:'🗑',nk:'delete',   dk:'ddelete', migrated:true},
  {id:'split',    icon:'✂️',nk:'split',    dk:'dsplit', migrated:true},
  {id:'rotate',   icon:'🔄',nk:'rotate',   dk:'drotate', migrated:true},
  {id:'compress', icon:'🗜',nk:'compress', dk:'dcompress', migrated:true},
  {id:'security', icon:'🔒',nk:'security', dk:'dsecurity', migrated:true},
  {id:'watermark',icon:'💧',nk:'watermark',dk:'dwatermark', migrated:true},
  {id:'img2pdf',  icon:'🖼',nk:'img2pdf',  dk:'dimg2pdf', migrated:true},
  {id:'pagenums', icon:'🔢',nk:'pagenums', dk:'dpagenums', migrated:true},
  {id:'pdf2jpg',  icon:'🖼',nk:'pdf2jpg',  dk:'dpdf2jpg', migrated:true},
  {id:'repair',   icon:'🔧',nk:'repair',   dk:'drepair', migrated:true},
  {id:'crop',     icon:'✂',nk:'crop',     dk:'dcrop', migrated:true},
  {id:'sign',     icon:'✍️',nk:'sign',     dk:'dsign', migrated:true},
  {id:'extract',  icon:'🖼',nk:'extract',  dk:'dextract', migrated:true},
];
// ── ICÔNES D'OUTILS (style iLovePDF : page PDF + action, tuile colorée) ──
// Style "document coloré" (iLovePDF) : contour + remplissage teinté en
// currentColor, l'action en currentColor. La couleur vient de la CATÉGORIE
// (une seule table CAT_COLORS ci-dessous) → changer une couleur = 1 modif.
const CAT_COLORS={org:'#E1483A',opt:'#12965A',conv:'#1E7BE0',edit:'#6D53E0',sec:'#1A5FD0'};
const TOOL_CAT={merge:'org',split:'org',delete:'org',extract:'org',compress:'opt',repair:'opt',img2pdf:'conv',pdf2jpg:'conv',rotate:'edit',watermark:'edit',sign:'edit',crop:'edit',pagenums:'edit',security:'sec'};
// Style "duo solide" (variante B validée) : aplats pleins sans contour,
// action en creux couleur du fond (var(--sf)), glyphes fins (1.5-1.7).
const TOOL_ICONS={
  merge:'<rect x="5" y="11" width="13" height="16" rx="2.5" fill="currentColor" fill-opacity=".3"/><rect x="14" y="5" width="13" height="16" rx="2.5" fill="currentColor"/><path d="M20.5 10.8v4.4M18.3 13h4.4" stroke="var(--sf)" stroke-width="1.7"/>',
  split:'<rect x="6" y="5" width="20" height="18" rx="2.5" fill="currentColor"/><path d="M16 7.5v13" stroke="var(--sf)" stroke-width="1.6" stroke-dasharray="2.6 2.6"/><path d="M14.3 25.8l3.4-4.6M17.7 25.8l-3.4-4.6" stroke="currentColor" stroke-width="1.5"/><circle cx="13.1" cy="27.1" r="1.9" stroke="currentColor" stroke-width="1.5"/><circle cx="18.9" cy="27.1" r="1.9" stroke="currentColor" stroke-width="1.5"/>',
  compress:'<rect x="7" y="5" width="18" height="22" rx="2.5" fill="currentColor"/><path d="M16 9.5v4.5M16 14l-2.2-2.2M16 14l2.2-2.2M16 22.5V18M16 18l-2.2 2.2M16 18l2.2 2.2" stroke="var(--sf)" stroke-width="1.6"/>',
  rotate:'<rect x="8" y="12" width="15" height="15" rx="2.5" fill="currentColor"/><path d="M24.5 11.5a8.5 8.5 0 0 0-14-4.7" stroke="currentColor" stroke-width="1.7"/><path d="M10.2 3.6v4.5h4.5" stroke="currentColor" stroke-width="1.7"/>',
  delete:'<rect x="9.5" y="7.6" width="13" height="2.6" rx="1.3" fill="currentColor" fill-opacity=".3"/><path d="M13.4 7.4a2.1 2.1 0 0 1 2-1.4h1.2a2.1 2.1 0 0 1 2 1.4" stroke="currentColor" stroke-width="1.6"/><path d="M11 11.6h10l-.7 12.2a2 2 0 0 1-2 1.9h-4.6a2 2 0 0 1-2-1.9z" fill="currentColor"/><path d="M14.2 14.8v6.8M17.8 14.8v6.8" stroke="var(--sf)" stroke-width="1.5"/>',
  watermark:'<rect x="7" y="5" width="18" height="22" rx="2.5" fill="currentColor"/><path d="M16 11.2c2.6 3 3.9 5.1 3.9 7a3.9 3.9 0 1 1-7.8 0c0-1.9 1.3-4 3.9-7z" fill="var(--sf)"/>',
  img2pdf:'<rect x="5" y="6" width="13" height="11" rx="2" fill="currentColor" fill-opacity=".3"/><circle cx="9.2" cy="9.4" r="1.2" fill="currentColor"/><path d="M7.3 14.6l2.7-3 2 2.2 1.5-1.7 2.4 2.5" stroke="currentColor" stroke-width="1.4"/><rect x="14" y="11" width="13" height="16" rx="2.5" fill="currentColor"/><path d="M17.6 19h6M20.8 16.2L23.6 19l-2.8 2.8" stroke="var(--sf)" stroke-width="1.6"/>',
  sign:'<rect x="7" y="5" width="18" height="22" rx="2.5" fill="currentColor"/><path d="M11 20.8c1.7-3.8 2.9-6 3.7-5.5.8.5-.6 3.8.3 4.2.9.4 1.7-2.3 2.5-2 .7.2.4 1.6 1.3 1.8.6.1 1.4-.4 2.2-1.1" stroke="var(--sf)" stroke-width="1.6"/><path d="M11 24.3h10" stroke="var(--sf)" stroke-width="1.3"/>',
  security:'<rect x="6" y="5" width="14" height="18" rx="2.5" fill="currentColor" fill-opacity=".3"/><path d="M18.3 15.4v-2.5a2.7 2.7 0 0 1 5.4 0v2.5" stroke="currentColor" stroke-width="1.7"/><rect x="15" y="15.4" width="12" height="11.2" rx="2.5" fill="currentColor"/><circle cx="21" cy="20.2" r="1.6" fill="var(--sf)"/><path d="M21 21.4v2.1" stroke="var(--sf)" stroke-width="1.5"/>',
  repair:'<rect x="7" y="5" width="18" height="22" rx="2.5" fill="currentColor"/><path d="M17.8 8.5L14.2 14h4.4l-3.8 5.5" stroke="var(--sf)" stroke-width="1.6"/><path d="M13.2 23.2l1.9 1.9 3.7-4" stroke="var(--sf)" stroke-width="1.6"/>',
  pdf2jpg:'<rect x="5" y="5" width="13" height="16" rx="2.5" fill="currentColor" fill-opacity=".3"/><rect x="13" y="12" width="14" height="12" rx="2" fill="currentColor"/><circle cx="17.3" cy="15.7" r="1.3" fill="var(--sf)"/><path d="M15 21.6l3-3.4 2.1 2.3 1.8-2 3.1 3.1" stroke="var(--sf)" stroke-width="1.6"/>',
  crop:'<path d="M9.5 4v15a2.5 2.5 0 0 0 2.5 2.5h15" stroke="currentColor" stroke-width="1.8"/><path d="M4 9.5h15A2.5 2.5 0 0 1 21.5 12v15" stroke="currentColor" stroke-width="1.8"/><rect x="12.5" y="12.5" width="6.5" height="6.5" rx="1" fill="currentColor" fill-opacity=".3"/>',
  pagenums:'<rect x="7" y="5" width="18" height="22" rx="2.5" fill="currentColor"/><path d="M11 10.5h10M11 14.2h7" stroke="var(--sf)" stroke-width="1.6"/><circle cx="16" cy="21.6" r="3.5" fill="var(--sf)"/><path d="M15 20.6l1.4-1.3v4.4" stroke="currentColor" stroke-width="1.5"/>',
  extract:'<rect x="6" y="5" width="14" height="18" rx="2.5" fill="currentColor" fill-opacity=".3"/><rect x="12.5" y="13" width="14" height="12" rx="2" fill="currentColor"/><circle cx="16.8" cy="16.7" r="1.3" fill="var(--sf)"/><path d="M14.5 22.6l3-3.4 2.1 2.3 1.8-2 3.1 3.1" stroke="var(--sf)" stroke-width="1.6"/><path d="M23.2 8.2L27 4.4M27 7.6V4.4h-3.2" stroke="currentColor" stroke-width="1.6"/>',
};
function toolIconHTML(id,px){
  const g=TOOL_ICONS[id];
  const size=px||44;
  if(!g){const e=(TOOLS.find(t=>t.id===id)||{}).icon||'';return `<span aria-hidden="true" style="font-size:${Math.round(size*0.6)}px">${e}</span>`;}
  const col=CAT_COLORS[TOOL_CAT[id]]||'#1E7BE0';
  return `<span class="tic" style="color:${col};width:${size}px;height:${size}px" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none" stroke-linejoin="round" stroke-linecap="round">${g}</svg></span>`;
}

// Migration progressive vers pages dédiées /tools/<id>.html (SEO + perf).
// Tant que migrated n'est pas vrai pour un outil, renderTools() garde l'ancien
// comportement (ouverture du modal in-page) pour ne rien casser.

// ── Constantes manquées lors du découpage initial (référencées par les
// fonctions d'historique/audit/FAQ/cache de miniatures) ──
const AC={login:'#10B981',logout:'#8B9CB6',upload:'#00B4D8',download:'#0077FF',delete:'#EF4444',login_failed:'#F59E0B',auto_cleanup:'#6B7280'};
const RECENT_KEY='iworkpdf_recent';
const MAX_RECENT=5;
const _thumbPdfCache = new WeakMap();

const TRUST_I18N = {
  en:{
    tb1:"Zero upload", tb1s:"by default", tb2:"compliant",
    tb3:"Open architecture", tb4:"Auto-delete 48h", tb5:"No ads, no tracking",
    privacy_btn:"Privacy Policy",
    sb1:"Your files stay on your device", sb2:"No account required",
    sb3:"No ads, no tracking", sb4:"Free forever", sb5:"Open and transparent",
    pr1:"100% In-browser", pr1s:"pdf-lib.js processes files locally",
    pr2:"No server processing", pr2s:"Files never touch our servers",
    pr3:"Auto-deleted", pr3s:"Cloud files deleted after 48h",
    pr4:"Transparent", pr4s:"Architecture fully documented",
    pr5:"Always free", pr5s:"No hidden fees, no premium wall",
    faq_title:"Questions about your privacy",
    faq_sub:"Honest answers, no marketing speak",
    net_safe:"No network activity", net_active:"Sending data...",
    cert_title:"Your file never left your device",
    cert_sub:"This operation was 100% local. Nothing was uploaded.",
    pm_label:"Maximum Privacy Mode", pm_sub:"Cloud features disabled. No auth. Local only.",
    footer_made:"Made with love by Yendyx",
    faqs:[
      {q:"Do my files get uploaded to your servers?",
       a:"No. By default, every PDF operation runs entirely in your browser using pdf-lib.js. Your files never leave your device. The only exception is if you explicitly choose Cloud 48h to share a file, and even then, it is deleted automatically after 48 hours."},
      {q:"Do you track what I do or what files I process?",
       a:"No. We have zero analytics, no cookies, no advertising trackers. We do not know what files you process, how many pages they have, or anything about their content. Your activity stays entirely private."},
      {q:"Can I use iWorkPDF without creating an account?",
       a:"Yes, completely. All 14 tools work without any account. The account is only needed if you want to save a cloud link for 48h sharing. You can ignore it entirely."},
      {q:"What happens if I use the Cloud 48h option?",
       a:"Your processed file is uploaded to our secure Supabase storage, encrypted in transit via HTTPS. A unique signed URL is generated that expires after 1 hour. The file itself is automatically deleted after 48 hours. Only you can access it via the signed URL."},
      {q:"Is iWorkPDF really free? What is the catch?",
       a:"Yes, completely free. No premium tier, no file size limit beyond technical constraints of 50MB, no watermark added to your files. Yendyx is building this as a showcase of their technology. We may add optional paid features in the future but the core tools will always be free."},
      {q:"How can I verify that my files are not being sent anywhere?",
       a:"Watch the network monitor in the bottom-left corner of your screen. It shows 0 requests during any local operation. On desktop, you can also open DevTools with F12 and check the Network tab while processing a file. You will see no outgoing requests to our servers. On mobile, the network counter stays at 0 during local operations."}
    ]
  },
  fr:{
    tb1:"Zero envoi", tb1s:"par defaut", tb2:"conforme",
    tb3:"Architecture ouverte", tb4:"Suppression auto 48h", tb5:"Sans pub, sans tracking",
    privacy_btn:"Politique de confidentialite",
    sb1:"Vos fichiers restent sur votre appareil", sb2:"Sans compte requis",
    sb3:"Sans pub, sans tracking", sb4:"Gratuit pour toujours", sb5:"Ouvert et transparent",
    pr1:"100% dans le navigateur", pr1s:"pdf-lib.js traite localement",
    pr2:"Aucun serveur", pr2s:"Vos fichiers ne touchent jamais nos serveurs",
    pr3:"Auto-supprime", pr3s:"Fichiers cloud supprimes apres 48h",
    pr4:"Transparent", pr4s:"Architecture entierement documentee",
    pr5:"Toujours gratuit", pr5s:"Sans frais caches, sans mur premium",
    faq_title:"Questions sur votre confidentialite",
    faq_sub:"Des reponses honnetes, sans marketing",
    net_safe:"Aucune activite reseau", net_active:"Envoi de donnees...",
    cert_title:"Votre fichier est reste sur votre appareil",
    cert_sub:"Cette operation etait 100% locale. Rien ne fut envoye.",
    pm_label:"Mode Confidentialite Maximale", pm_sub:"Cloud desactive. Sans auth. Local uniquement.",
    footer_made:"Fait avec amour par Yendyx",
    faqs:[
      {q:"Mes fichiers sont-ils envoyes sur vos serveurs ?",
       a:"Non. Par defaut, chaque operation PDF fonctionne entierement dans votre navigateur via pdf-lib.js. Vos fichiers ne quittent jamais votre appareil. La seule exception est si vous choisissez explicitement Cloud 48h pour partager un fichier. Meme dans ce cas, il est supprime automatiquement apres 48 heures."},
      {q:"Tracez-vous ce que je fais ou quels fichiers je traite ?",
       a:"Non. Nous avons zero analytics, aucun cookie, aucun tracker publicitaire. Nous ne savons pas quels fichiers vous traitez, combien de pages ils ont, ni rien sur leur contenu. Votre activite reste entierement privee."},
      {q:"Puis-je utiliser iWorkPDF sans creer de compte ?",
       a:"Oui, completement. Les 14 outils fonctionnent sans compte. Le compte est necessaire uniquement si vous voulez sauvegarder un lien cloud de partage 48h. Vous pouvez totalement ignorer cette option."},
      {q:"Que se passe-t-il avec le mode Cloud 48h ?",
       a:"Votre fichier traite est uploade dans notre stockage Supabase securise, chiffre en transit via HTTPS. Une URL signee unique est generee et expire apres 1 heure. Le fichier lui-meme est automatiquement supprime apres 48 heures. Seul vous pouvez y acceder via cette URL signee."},
      {q:"iWorkPDF est-il vraiment gratuit ? Quel est le piege ?",
       a:"Oui, entierement gratuit. Pas de version premium, pas de limite de taille au-dela des contraintes techniques de 50 Mo, aucun filigrane ajoute a vos fichiers. Yendyx developpe ceci comme une vitrine de sa technologie. Nous pourrons ajouter des fonctionnalites payantes optionnelles plus tard, mais les outils de base seront toujours gratuits."},
      {q:"Comment verifier que mes fichiers ne sont pas envoyes quelque part ?",
       a:"Regardez le moniteur reseau en bas a gauche de votre ecran. Il affiche 0 requete pendant toute operation locale. Sur ordinateur, vous pouvez aussi ouvrir les DevTools avec F12 et verifier dans onglet Reseau pendant le traitement. Vous ne verrez aucune requete sortante vers nos serveurs. Sur mobile, le compteur reste a 0 pendant les operations locales."}
    ]
  }
};


function t(k){return(T[lang]||T.en)[k]||k;}

// ── PUCES DE CATÉGORIES (style iLovePDF) ──────────────────
let _catFilter='all';
const CAT_LABELS={
  fr:{all:'Tout',org:'Organiser PDF',opt:'Optimiser le PDF',conv:'Convertir PDF',edit:'Modifier PDF',sec:'Sécurité PDF'},
  en:{all:'All',org:'Organize PDF',opt:'Optimize PDF',conv:'Convert PDF',edit:'Edit PDF',sec:'PDF Security'}
};
function renderCatChips(){
  const grid=document.getElementById('tools-grid');
  if(!grid)return;
  document.getElementById('cat-chips')?.remove();
  const L=CAT_LABELS[lang]||CAT_LABELS.en;
  const wrap=document.createElement('div');
  wrap.id='cat-chips';wrap.className='cat-chips';
  ['all','org','opt','conv','edit','sec'].forEach(cat=>{
    const b=document.createElement('button');
    b.className='cat-chip'+(cat===_catFilter?' active':'');
    b.textContent=L[cat];
    b.addEventListener('click',()=>{_catFilter=cat;renderCatChips();renderTools();});
    wrap.appendChild(b);
  });
  grid.parentNode.insertBefore(wrap,grid);
}

function renderTools(){
  const grid=document.getElementById('tools-grid');
  if(!grid)return; // page outil dédiée : pas de grille à rendre ici
  renderCatChips();
  grid.innerHTML='';
  TOOLS.filter(tool=>_catFilter==='all'||TOOL_CAT[tool.id]===_catFilter).forEach((tool,idx)=>{
    const c=document.createElement('div');
    c.className='tool-card';
    c.setAttribute('role','button');
    c.setAttribute('tabindex','0');
    const realIdx=TOOLS.indexOf(tool);
    const kbdNum=realIdx+1<=9?`<span class="kbd">Ctrl+${realIdx+1}</span>`:'';
    c.innerHTML=`${toolIconHTML(tool.id,58)}<div class="tool-name">${t(tool.nk)}</div><div class="tool-desc">${t(tool.dk)}</div><span class="tool-badge">LOCAL</span>${kbdNum}`;
    const go=()=>{ if(tool.migrated){ window.location.href=`/tools/${tool.id}`; } else { openTool(tool.id); } };
    c.onclick=go;
    c.onkeydown=e=>{if(e.key==='Enter'||e.key===' ')go();};
    grid.appendChild(c);
  });
}

// ── BARRE D'OUTILS HORIZONTALE (pages outils uniquement) ──
// 4 outils mis en avant + menu déroulant « Tous les outils PDF » (14 outils).
// Injectée par JS → aucune édition des 14 pages HTML. Style: .tools-nav (tool-theme.css)
const FEATURED_TOOLS=['merge','split','compress','img2pdf']; // pages outils : 4 + menu
const FEATURED_HOME=['merge','split','compress','rotate','delete','watermark','img2pdf','sign']; // accueil : répartis pleine largeur
function isToolPage(){return /\/tools\/[^/]+/.test(location.pathname);}
function isHomePage(){return !isToolPage() && !!document.getElementById('tools-grid');}
function renderToolsNav(){
  const nav=document.querySelector('nav');
  if(!nav)return;
  const home=isHomePage();
  if(!isToolPage() && !home)return;
  document.getElementById('tools-nav')?.remove();
  const curId=(location.pathname.match(/\/tools\/([^./]+)/)||[])[1]||null;
  const list=home?FEATURED_HOME:FEATURED_TOOLS;
  const links=list.map(id=>{
    const tl=TOOLS.find(x=>x.id===id);
    if(!tl)return'';
    return `<a class="tn-link${id===curId?' active':''}" href="/tools/${id}">${t(tl.nk)}</a>`;
  }).join('');
  const items=TOOLS.map(tl=>`<a class="tn-item" href="/tools/${tl.id}">${toolIconHTML(tl.id,30)}${t(tl.nk)}</a>`).join('');
  const bar=document.createElement('div');
  bar.id='tools-nav';bar.className='tools-nav'+(home?' tools-nav--home':'');
  bar.innerHTML=`<div class="tn-links">${links}</div>`+
    `<div class="tn-all"><button class="tn-all-btn" id="tn-all-btn" aria-haspopup="true" aria-expanded="false">`+
    `${lang==='fr'?'Tous les outils PDF':'All PDF tools'} <span aria-hidden="true">▾</span></button>`+
    `<div class="tn-menu" id="tn-menu">${items}</div></div>`;
  nav.insertAdjacentElement('afterend',bar);
  if(home) document.body.classList.add('home-toolsnav');
  const btn=bar.querySelector('#tn-all-btn'),menu=bar.querySelector('#tn-menu');
  btn.addEventListener('click',e=>{e.stopPropagation();const o=menu.classList.toggle('open');btn.setAttribute('aria-expanded',o?'true':'false');});
  document.addEventListener('click',e=>{if(!bar.contains(e.target))menu.classList.remove('open');});
}
// En-tête animé : document central + tuiles d'outils qui flottent en boucle.
function renderHeroVisual(){
  const el=document.getElementById('hero-visual');
  if(!el)return;
  const feat=['merge','compress','img2pdf','sign','security','split'];
  const pos=['top:4px;left:9%','top:0;right:13%','bottom:24px;left:1%','bottom:6px;right:7%','top:42%;left:-1%','top:38%;right:0'];
  const tiles=feat.map((id,i)=>`<div class="hv-tile" style="${pos[i]};animation-delay:${(i*0.35).toFixed(2)}s">${toolIconHTML(id,30)}</div>`).join('');
  el.innerHTML=`${tiles}<div class="hv-doc"><span></span><span></span><span></span><b>PDF</b></div>`;
}

// Déplace le bandeau confiance en bas de page (infos secondaires sous l'action).
function relocateTrustBanner(){
  if(!isToolPage())return;
  const tb=document.querySelector('.trust-banner'),ft=document.querySelector('footer');
  if(tb&&ft&&!tb.classList.contains('relocated')){
    tb.classList.add('relocated');
    ft.parentNode.insertBefore(tb,ft);
  }
}

function applyLang(){
  document.documentElement.lang=lang;
  // BUG G FIX: auth-modal-title → 'myacc' pas 'myfiles'
  const ids={'h-badge':'badge','h-title1':'h1','h-title2':'h2','h-sub':'sub','h-cta1':'cta1','h-cta2':'cta2','illu-pc':'illu_pc','illu-local':'illu_local','illu-dl':'illu_dl','illu-nosrv':'illu_nosrv','demo-drop-txt':'demo_drop','why-title':'why','sb1':'sb1','sb2':'sb2','sb3':'sb3','sb4':'sb4','sb5':'sb5','st1':'st1','st2':'st2','st3':'st3','st4':'st4','tools-title':'ttl','tools-sub':'tsub','auth-btn-txt':'signin','auth-modal-title':'myacc','atab-login':'signin','atab-register':'register','login-info':'logininfo','reg-info':'reginfo','l-pwd-lbl':'password','reg-name-lbl':'firstname','reg-pwd-lbl':'pwdmin','reg-pwd2-lbl':'confirmpwd','login-btn':'signin','reg-btn':'register','htab-files':'myfiles','htab-audit':'actlog','hist-title':'histtitle','logout-btn':'logout','vfy-txt':'vfy','footer-txt':'footer'};
  Object.entries(ids).forEach(([id,key])=>{const el=document.getElementById(id);if(el)el.textContent=t(key);});
  renderTools();
  const sh=document.getElementById('shortcut-hint');
  if(sh) sh.textContent=t('shortcut_hint');
  const st4el=document.getElementById('st4');
  if(st4el) st4el.textContent=t('tool_count');
  renderRecent();
  renderToolsNav();
  // Mettre à jour les textes confiance
  if(typeof applyTrustLang==='function') applyTrustLang();
}

function openLangMenu(){
  const menu=document.getElementById('lang-menu');
  menu.classList.toggle('open');
}

function setLang(l){
  lang=l;
  document.getElementById('lang-lbl').textContent=l.toUpperCase();
  document.querySelectorAll('.lang-opt').forEach(b=>b.classList.toggle('active',b.dataset.lang===l));
  document.getElementById('lang-menu').classList.remove('open');
  applyLang();
}

function scrollToTop(){window.scrollTo({top:0,behavior:'smooth'});}

function scrollToTools(){document.getElementById('tools-section').scrollIntoView({behavior:'smooth'});}

function updateAuthUI(){
  const btn=document.getElementById('auth-btn');
  const av=document.getElementById('avatar');
  const vb=document.getElementById('vfy-banner');
  if(user){
    btn.classList.add('hidden');
    av.style.display='flex';
    av.textContent=(user.user_metadata?.name||user.email||'U')[0].toUpperCase();
    if(vb)vb.classList.toggle('show',!user.email_confirmed_at);
  }else{
    btn.classList.remove('hidden');
    av.style.display='none';
    if(vb)vb.classList.remove('show');
  }
  // Affiche/masque l'option de sauvegarde cloud selon l'état de connexion.
  updateSaveAuthGate();
}

function updatePwdStrength(){
  const pwd=document.getElementById('r-pwd')?.value||'';
  const s=Security.checkPasswordStrength(pwd);
  const f=document.getElementById('pwd-fill'),l=document.getElementById('pwd-label');
  if(f){f.style.width=(s.score/5*100)+'%';f.style.background=s.color;}
  if(l){l.textContent=pwd?s.label:'';l.style.color=s.color;}
}

async function doLogin(){
  const rawEmail=document.getElementById('l-email').value;
  const pwd=document.getElementById('l-pwd').value;
  const st=document.getElementById('l-status');
  const btn=document.getElementById('login-btn');
  try{
    if(!sb)throw new Error(lang==='fr'?'Connexion indisponible (hors ligne). Les outils PDF restent utilisables.':'Sign-in unavailable (offline). PDF tools still work.');
    const email=Security.validateEmail(rawEmail);
    Security.checkRateLimit(email);
    st.className='status-box info';st.textContent=t('signedin');
    btn.disabled=true;
    const{error}=await sb.auth.signInWithPassword({email,password:pwd});
    if(error){
      // audit login_failed via function edge ou direct si policy le permet
      try{ await sb.from('audit_logs').insert({user_id:null,action:'login_failed',metadata:{email,ua:navigator.userAgent.substring(0,80)}}); }catch(_){}
      throw new Error(error.message);
    }
    Security.resetRateLimit(email);
  }catch(e){
    st.className='status-box err';st.textContent=e.message;
  }finally{btn.disabled=false;}
}

async function doRegister(){
  const name=Security.sanitizeText(document.getElementById('r-name').value);
  const rawEmail=document.getElementById('r-email').value;
  const pwd=document.getElementById('r-pwd').value;
  const st=document.getElementById('r-status');
  const btn=document.getElementById('reg-btn');
  try{
    if(!sb)throw new Error(lang==='fr'?'Création de compte indisponible (hors ligne).':'Registration unavailable (offline).');
    if(!name)throw new Error(lang==='fr'?'Entrez votre prénom.':'Enter your first name.');
    const email=Security.validateEmail(rawEmail);
    const strength=Security.checkPasswordStrength(pwd);
    if(!strength.ok)throw new Error(lang==='fr'?'Mot de passe trop faible.':'Password too weak (8+ chars, uppercase, number).');
    const pwd2=document.getElementById('r-pwd2')?.value||'';
    if(pwd!==pwd2)throw new Error(lang==='fr'?'Les mots de passe ne correspondent pas.':'Passwords do not match.');
    st.className='status-box info';st.textContent=t('creatingacc');
    btn.disabled=true;
    const{error}=await sb.auth.signUp({email,password:pwd,options:{data:{name},emailRedirectTo:window.location.origin+'/confirmed.html'}});
    if(error)throw new Error(error.message);
    st.className='status-box ok';st.textContent=t('accreated');
  }catch(e){
    st.className='status-box err';st.textContent=e.message;
  }finally{btn.disabled=false;}
}

async function doLogout(){if(sb)await sb.auth.signOut();closeHistory();}

async function audit(action,resourceId=null,meta={}){
  if(!user||!sb)return;
  try{await sb.from('audit_logs').insert({user_id:user.id,action,resource_id:resourceId,metadata:{...meta,ua:navigator.userAgent.substring(0,80)}});}
  catch(e){console.warn('Audit:',e.message);}
}

function openHistory(){document.getElementById('hist-overlay').classList.add('active');loadFiles();}

function closeHistory(){document.getElementById('hist-overlay').classList.remove('active');}

function histTab(tab){
  document.querySelectorAll('#hist-tabs .tab-btn').forEach((b,i)=>b.classList.toggle('active',(tab==='files'&&i===0)||(tab==='audit'&&i===1)));
  document.getElementById('pane-files').classList.toggle('hidden',tab!=='files');
  document.getElementById('pane-audit').classList.toggle('hidden',tab!=='audit');
  if(tab==='audit')loadAudit();
}

function authTab(tab){
  document.querySelectorAll('#auth-tabs .tab-btn').forEach((b,i)=>b.classList.toggle('active',(tab==='login'&&i===0)||(tab==='register'&&i===1)));
  document.getElementById('pane-login').classList.toggle('hidden',tab!=='login');
  document.getElementById('pane-register').classList.toggle('hidden',tab!=='register');
}

async function loadFiles(){
  if(!user)return;
  const el=document.getElementById('pane-files');
  el.innerHTML=`<p style="color:var(--tx2);text-align:center;padding:24px">${t('loading')}</p>`;
  const{data,error}=await sb.from('shared_files').select('*').eq('user_id',user.id).gt('expires_at',new Date().toISOString()).order('created_at',{ascending:false});
  if(error||!data?.length){el.innerHTML=`<p style="color:var(--tx2);text-align:center;padding:24px">${t('nofiles')}</p>`;return;}
  // BUG C FIX: utiliser dataset + event delegation au lieu de onclick inline avec strings
  const container=document.createElement('div');
  data.forEach(f=>{
    const h=Math.max(0,Math.round((new Date(f.expires_at)-Date.now())/3600000));
    const item=document.createElement('div');
    item.className='h-item';
    item.innerHTML=`<div>📄</div><div class="h-info"><div class="h-name">${Security.escHtml(f.filename)}</div><div class="h-meta">${Security.escHtml(f.tool_used)} · ${(f.file_size/1024).toFixed(0)} Ko</div><div class="h-exp">⏱ ${t('expiresin')} ${h}h</div></div><button class="btn-dl">${t('download')}</button>`;
    item.querySelector('.btn-dl').addEventListener('click',()=>dlSigned(f.file_path,f.filename,f.id));
    container.appendChild(item);
  });
  el.innerHTML='';el.appendChild(container);
}

async function loadAudit(){
  if(!user)return;
  const el=document.getElementById('pane-audit');
  el.innerHTML=`<p style="color:var(--tx2);text-align:center;padding:24px">${t('loading')}</p>`;
  const{data}=await sb.from('audit_logs').select('*').eq('user_id',user.id).order('created_at',{ascending:false}).limit(50);
  if(!data?.length){el.innerHTML=`<p style="color:var(--tx2);text-align:center;padding:24px">${t('noactivity')}</p>`;return;}
  el.innerHTML=data.map(l=>{
    const c=AC[l.action]||'#8B9CB6';
    const meta=l.metadata?Object.entries(l.metadata).filter(([k])=>k!=='ua').map(([k,v])=>`${k}:${Security.escHtml(String(v))}`).join(' · '):'';
    return`<div class="audit-item"><span class="audit-action" style="color:${c};border-color:${c}40">${Security.escHtml(l.action)}</span><span class="audit-meta">${meta}</span><span class="audit-time">${new Date(l.created_at).toLocaleString()}</span></div>`;
  }).join('');
}

async function dlSigned(path,filename,fileId){
  // BUG 11 FIX: utiliser showSaveFilePicker comme dlBytes
  try{
    const{data,error}=await sb.storage.from('pdf-files').createSignedUrl(path,3600);
    if(error)throw error;
    // Télécharger le contenu puis ouvrir le dialogue natif
    const resp=await fetch(data.signedUrl);
    if(!resp.ok) throw new Error(`Download failed: ${resp.status}`);
    const bytes=await resp.arrayBuffer();
    await dlBytes(new Uint8Array(bytes), filename);
    try{ await sb.rpc('increment_downloads',{file_id:fileId}); }catch(_){}
    await audit('download',fileId,{filename});
    showToast(`⬇ ${filename}`, 'ok');
  }catch(e){
    // AbortError = utilisateur a annulé le dialogue → silence
    if(e.name!=='AbortError') showToast(e.message, 'err');
  }
}

// Injecte le champ "confirmer le mot de passe" dans le formulaire d'inscription.
// Le formulaire est dupliqué dans 15 pages → injection JS pour rester DRY.
function ensureRegisterConfirm(){
  const pwd=document.getElementById('r-pwd');
  if(!pwd||document.getElementById('r-pwd2'))return;
  const grp=pwd.closest('.form-group');
  if(!grp)return;
  const wrap=document.createElement('div');
  wrap.className='form-group';
  wrap.innerHTML=`<label class="form-label" id="reg-pwd2-lbl">${t('confirmpwd')}</label><input class="form-input" type="password" id="r-pwd2" autocomplete="new-password" placeholder="••••••••"/>`;
  grp.insertAdjacentElement('afterend',wrap);
}

function openAuth(){ensureRegisterConfirm();document.getElementById('auth-overlay').classList.add('active');}

function closeAuth(){document.getElementById('auth-overlay').classList.remove('active');}

function resetToolState(){
  activeFiles=[];
  saveMode='local';
  rotateAngle=90;
  secMode='protect';
  if(typeof mergeDocs!=='undefined')mergeDocs=[];
  if(typeof dragSrc!=='undefined')dragSrc=null;
  if(typeof deleteSelectedPages!=='undefined')deleteSelectedPages=new Set();
  if(typeof splitSelectedPages!=='undefined')splitSelectedPages=new Set();
  if(typeof rotateSelected!=='undefined')rotateSelected=new Set();
  if(typeof imgDragSrc!=='undefined')imgDragSrc=null;
  // BUG F FIX: reset pagenums et pdf2jpg state
  if(typeof pnPos!=='undefined')pnPos='bc';
  if(typeof pnFmt!=='undefined')pnFmt='num';
  if(typeof jpgQuality!=='undefined')jpgQuality=0.9;
  if(typeof signPos!=='undefined')signPos='br';
  if(typeof signCtx!=='undefined')signCtx=null;
  if(typeof signDrawing!=='undefined')signDrawing=false;
  if(typeof compQuality!=='undefined')compQuality=0.75;
  if(typeof _compScan!=='undefined')_compScan=null;
  document.getElementById('tool-body')?.classList.remove('has-files');
}

function openTool(id){
  if(isProcessing)return;
  resetToolState();
  // BUG 3 FIX: reset compteur réseau à chaque outil
  netRequestCount=0;
  setNetActive(false);
  const tool=TOOLS.find(x=>x.id===id);
  if(!tool)return;
  document.getElementById('ws-title').textContent=`${tool.icon}  ${t(tool.nk)}`;
  document.getElementById('ws-body').innerHTML=buildUI(id);
  document.getElementById('ws-overlay').classList.add('active');
  setupDrop(id);
}

function closeWs(){
  if(isProcessing)return;
  resetToolState();
  document.getElementById('ws-overlay').classList.remove('active');
  document.getElementById('ws-body').innerHTML='';
}

function buildUI(id){
  const isImg=id==='img2pdf';
  const multi=['merge','img2pdf'].includes(id);
  // Privacy mode bar toujours visible en haut du modal
  const pmBar=buildPrivacyModeBar();
  const drop=`<div class="drop-zone" id="dz">
      <input type="file" accept="${isImg?'.jpg,.jpeg,.png,.webp,.bmp':'.pdf'}" ${multi?'multiple':''} onchange="onPick(event,'${id}')"/>
      <p class="drop-text">${t('drop')}</p>
      <button class="drop-btn"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> ${t('browse')}</button>
    </div><div class="file-list" id="fl"></div>`;
  const saveBlock=`<p class="form-label" style="margin-bottom:8px">${t('dest')}</p><div class="save-mode"><div class="save-opt active" id="so-local" onclick="setSave('local')"><div class="save-opt-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M12 3v12M7 10l5 5 5-5"/></svg></div><div class="save-opt-title">${t('localmode')}</div><div class="save-opt-sub">${t('direct')}</div></div><div class="save-opt" id="so-cloud" onclick="setSave('cloud')"><div class="save-opt-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 16a4 4 0 0 1 .4-8A5.5 5.5 0 0 1 17.5 9.5"/><rect x="13" y="13.5" width="9" height="7.5" rx="1.8"/><path d="M15.2 13.5V12a2.3 2.3 0 0 1 4.6 0v1.5"/></svg></div><div class="save-opt-title">${t('savemode')}</div><div class="save-opt-sub">${t('cloudsub')}</div></div></div>`;
  const bottom=`<div class="status-box" id="ts"></div><div class="prog-wrap" id="tp"><div class="prog-bg"><div class="prog-fill" id="pf"></div></div><div class="prog-text" id="pt"></div></div><div class="share-box" id="share-result"><p style="font-size:13px;font-weight:600">🔗 ${t('signedlink')}</p><div class="share-row"><input class="share-inp" id="share-link-inp" readonly/><button class="btn-primary" style="padding:8px 14px;font-size:13px" onclick="copyLink()">${t('copylink')}</button></div><p class="share-exp" id="share-exp-txt"></p><p class="share-exp" style="color:var(--tx3);margin-top:4px">🔒 URL expires 1h after generation</p></div>`;
  // Évaluation paresseuse : on n'appelle que le buildXxxUI() de l'outil demandé.
  // Important pour les pages dédiées (ex: compress.html) qui ne chargent que le JS
  // de leur propre outil — appeler tous les buildXxxUI() d'un coup (ancien objet
  // littéral cfg={...}) provoquerait une ReferenceError sur les fonctions absentes.
  let body='';
  switch(id){
    case 'merge': body=typeof buildMergeUI==='function'?buildMergeUI():''; break;
    case 'delete': body=typeof buildDeleteUI==='function'?buildDeleteUI():''; break;
    case 'split': body=typeof buildSplitUI==='function'?buildSplitUI():''; break;
    case 'rotate': body=typeof buildRotateUI==='function'?buildRotateUI():''; break;
    case 'compress': body=typeof buildCompressUI==='function'?buildCompressUI():''; break;
    case 'security': body=`${drop}<div class="form-group"><div class="radio-group" id="rg-sec"><button class="rbn active" onclick="setRbn('rg-sec',this,'protect','sec')">${t('protect')}</button><button class="rbn" onclick="setRbn('rg-sec',this,'unlock','sec')">${t('unlock')}</button></div><label class="form-label">${t('pwdlbl')}</label><input class="form-input" type="password" id="sp" placeholder="••••••••" maxlength="128"/><p class="form-hint" style="margin-top:8px;font-size:12px;color:var(--tx3)">${t('secnote')}</p></div>${saveBlock}${bottom}<div class="flex-end"><button class="btn-primary" onclick="run('security')">${t('sec_btn')}</button></div>`; break;
    case 'watermark': body=typeof buildWatermarkUI==='function'?buildWatermarkUI():''; break;
    case 'img2pdf': body=typeof buildImg2PdfUI==='function'?buildImg2PdfUI():''; break;
    case 'pagenums': body=typeof buildPageNumsUI==='function'?buildPageNumsUI():''; break;
    case 'pdf2jpg': body=typeof buildPdf2JpgUI==='function'?buildPdf2JpgUI():''; break;
    case 'repair': body=typeof buildRepairUI==='function'?buildRepairUI():''; break;
    case 'crop': body=typeof buildCropUI==='function'?buildCropUI():''; break;
    case 'sign': body=typeof buildSignUI==='function'?buildSignUI():''; break;
    case 'extract': body=typeof buildExtractUI==='function'?buildExtractUI():''; break;
  }
  // La barre "Privacy Mode" passe SOUS l'action (info secondaire, comme iLovePDF)
  // pour que la zone de dépôt + le bouton restent visibles d'un coup d'œil.
  return (body?body+pmBar:'')
}

function setRbn(gid,btn,val,type){
  document.querySelectorAll(`#${gid} .rbn`).forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  if(type==='angle')rotateAngle=val;
  else if(type==='sec')secMode=val;
  else if(type==='signpos')signPos=val; // BUG FIX : position de signature jamais appliquée
}

function setSave(m){
  // Garde-fou : un visiteur non connecté ne peut pas passer en mode cloud.
  if(m==='cloud' && !user){ openAuth(); return; }
  saveMode=m;
  document.getElementById('so-local')?.classList.toggle('active',m==='local');
  document.getElementById('so-cloud')?.classList.toggle('active',m==='cloud');
}

// Réserve la sauvegarde/partage cloud (lien 48h) aux utilisateurs INSCRITS et connectés.
// Non connecté → le sélecteur de destination disparaît : téléchargement local direct uniquement.
// Appelée à chaque changement d'état d'auth (updateAuthUI) et après chaque rendu d'outil (setupDrop).
function updateSaveAuthGate(){
  const loggedIn = !!user;
  document.querySelectorAll('.save-mode').forEach(sm=>{
    const lbl = sm.previousElementSibling; // libellé "Destination :" qui précède le bloc
    sm.style.display = loggedIn ? '' : 'none';
    if(lbl && lbl.classList && lbl.classList.contains('form-label')) lbl.style.display = loggedIn ? '' : 'none';
    const cloud = sm.querySelector('#so-cloud'); // masqué aussi en mode confidentialité
    if(cloud) cloud.style.display = (loggedIn && !privacyMode) ? '' : 'none';
  });
  // Filet de sécurité : jamais de mode cloud sans compte connecté.
  if(!loggedIn && saveMode==='cloud'){
    saveMode='local';
    document.querySelectorAll('#so-local').forEach(el=>el.classList.add('active'));
    document.querySelectorAll('#so-cloud').forEach(el=>el.classList.remove('active'));
  }
}

// ── LAYOUT PLEIN ÉCRAN (style iLovePDF) ───────────────────
// Sépare #tool-body en 2 colonnes : zone de travail à gauche (drop zone,
// aperçus, grilles) et panneau d'action à droite (options, destination,
// bouton). Générique : s'applique aux 14 outils sans éditer leurs pages.
function layoutToolPage(){
  if(!isToolPage())return;
  const body=document.getElementById('tool-body');
  if(!body||body.querySelector(':scope>.tp-left'))return;
  const LEFT_SEL='#dz,.drop-zone,#fl,.file-list,[id*="preview"],#merge-toolbar,#merge-tip,#merge-grid,#comp-estimate,.pg-card-tip';
  const left=document.createElement('div');left.className='tp-left';
  const right=document.createElement('div');right.className='tp-right';
  [...body.children].forEach(el=>{
    try{ (el.matches(LEFT_SEL)?left:right).appendChild(el); }
    catch(_){ right.appendChild(el); }
  });
  body.appendChild(left);body.appendChild(right);
  body.classList.add('tp-split');
}

function setupDrop(id){
  layoutToolPage();
  updateSaveAuthGate(); // cacher la sauvegarde cloud aux non-inscrits dès le rendu de l'outil
  if(id==='pagenums') setTimeout(updatePnPreview, 50);
  if(id==='crop') setTimeout(updateCropPreview, 50);
  if(id==='sign') setTimeout(initSignCanvas, 80);
  // BUG 1+2 FIX: wirer le checkbox privacy mode après insertion DOM
  setTimeout(()=>{
    const cb=document.getElementById('pm-checkbox');
    if(cb) cb.addEventListener('change', e=>togglePrivacyMode(e.target.checked));
  }, 10);
  setTimeout(()=>{
    // merge uses 'dz' id too (merge-drop zone)
    const dz=document.getElementById('dz');
    if(!dz)return;
    dz.addEventListener('dragover',e=>{
      // Only handle file drops on the drop zone, not page card drags
      if(e.dataTransfer.types.includes('Files')){e.preventDefault();dz.classList.add('dragover');}
    });
    dz.addEventListener('dragleave',()=>dz.classList.remove('dragover'));
    dz.addEventListener('drop',async e=>{
      if(!e.dataTransfer.types.includes('Files'))return;
      e.preventDefault();dz.classList.remove('dragover');
      await handleFiles([...e.dataTransfer.files],id);
    });
  },80);
}

function onPick(e,id){handleFiles([...e.target.files],id);}

async function handleFiles(files,id){
  // repair bypass magic bytes (PDF peut être corrompu) + pagenums accepte PDF/PPTX
  const type = (id==='img2pdf') ? 'image' : (id==='pagenums'||id==='repair') ? 'any' : 'pdf';
  const single=!['merge','img2pdf'].includes(id);
  for(const f of files){
    try{
      if(type!=='any') await Security.validateFile(f,type);
      else {
        // Validation manuelle pour pagenums (PDF/PPTX) et repair (PDF potentiellement corrompu)
        const ext=f.name.split('.').pop().toLowerCase();
        if(id==='pagenums' && !['pdf','pptx'].includes(ext))
          throw new Error(`Unsupported file: ${f.name}. Use PDF or PPTX.`);
        if(id==='repair' && ext!=='pdf')
          throw new Error(`Only PDF files can be repaired: ${f.name}`);
        if(f.size>50*1024*1024) throw new Error(`File too large: ${f.name}`);
        if(f.size===0) throw new Error(`Empty file: ${f.name}`);
      }
      if(single)activeFiles=[f];else activeFiles.push(f);
    }catch(e){setStatus(e.message,'err');return;}
  }
  if(id==='merge')        await renderMergePages();
  else if(id==='delete')  await renderDeletePreview();
  else if(id==='split')   await renderSplitPreview();
  else if(id==='rotate')  await renderRotatePreview();
  else if(id==='img2pdf') renderImgGrid();
  else if(id==='compress'){renderFiles();await renderCompressEstimate();}
  else if(id==='crop'){renderFiles();await renderCropPagePreview();}
  else renderFiles();
  syncHasFiles();
}

// Affiche les options secondaires (destination) seulement après ajout d'un fichier.
function syncHasFiles(){
  document.getElementById('tool-body')?.classList.toggle('has-files', activeFiles.length>0);
}

function renderFiles(){
  const el=document.getElementById('fl');
  if(!el)return;
  el.innerHTML='';
  activeFiles.forEach((f,i)=>{
    const item=document.createElement('div');
    item.className='file-item';
    // Infos fichier enrichies
    const sizeStr=f.size>1024*1024?`${(f.size/1024/1024).toFixed(1)} MB`:`${(f.size/1024).toFixed(0)} KB`;
    item.innerHTML=`<span class="file-icon">📄</span><span class="file-name">${Security.escHtml(f.name)}</span><span class="file-size" title="${f.size} bytes">${sizeStr}</span>`;
    const rmBtn=document.createElement('button');
    rmBtn.className='file-rm';rmBtn.setAttribute('aria-label','Remove');rmBtn.textContent='✕';
    rmBtn.addEventListener('click',()=>{activeFiles.splice(i,1);renderFiles();syncHasFiles();});
    item.appendChild(rmBtn);
    el.appendChild(item);
  });
}

function rmFile(i){activeFiles.splice(i,1);renderFiles();const ce=document.getElementById('comp-estimate');if(ce)ce.innerHTML='';if(typeof _compScan!=='undefined')_compScan=null;}

function setStatus(msg,type='info'){const el=document.getElementById('ts');if(!el)return;el.textContent=msg;el.className=`status-box ${type}`;}

function setProgress(pct,txt){document.getElementById('tp')?.classList.add('show');const f=document.getElementById('pf'),p=document.getElementById('pt');if(f)f.style.width=pct+'%';if(p)p.textContent=(txt?txt+' ':'')+Math.round(pct)+'%';}

// Spinner inline sur le(s) bouton(s) d'action (ceux qui appellent run()).
function toggleActionSpinner(on){
  const host=document.getElementById('tool-body')||document.getElementById('ws-body');
  if(!host)return;
  host.querySelectorAll('.btn-primary').forEach(b=>{
    const oc=b.getAttribute('onclick')||'';
    if(!oc.includes('run(')) return; // ignorer copyLink & autres
    if(on){ if(b.dataset.label==null) b.dataset.label=b.innerHTML; b.innerHTML=`<span class="spin" aria-hidden="true"></span>${t('processing')}`; }
    else if(b.dataset.label!=null){ b.innerHTML=b.dataset.label; delete b.dataset.label; }
  });
}

// Écran de succès persistant avec re-téléchargement (parité iLovePDF).
let _lastResult=null; // {bytes:Uint8Array, filename}
function showResultScreen(id, bytes, filename, metaLine){
  _lastResult={bytes, filename};
  const host=document.getElementById('tool-body')||document.getElementById('ws-body');
  if(!host)return;
  host.innerHTML=`<div class="result-screen">
    <div class="result-check" aria-hidden="true">✅</div>
    <div class="result-title">${lang==='fr'?'Fichier prêt':'Your file is ready'}</div>
    <div class="result-meta">${Security.escHtml(filename)}${metaLine?' · '+Security.escHtml(metaLine):''}</div>
    <div class="result-cert">🛡️ ${lang==='fr'?'Traité 100% sur votre appareil':'Processed 100% on your device'}</div>
    <div class="result-actions">
      <button class="btn-primary" id="res-dl">⬇ ${lang==='fr'?'Télécharger à nouveau':'Download again'}</button>
      ${user?`<button class="btn-primary" id="res-save">💾 ${lang==='fr'?'Sauvegarder en ligne (48h)':'Save online (48h)'}</button>`:''}
      <button class="btn-ghost-lg" id="res-new">↺ ${lang==='fr'?'Nouveau fichier':'New file'}</button>
    </div>
    <div id="res-save-out" style="margin-top:12px"></div>
  </div>`;
  document.getElementById('res-dl').addEventListener('click',()=>{
    if(_lastResult) dlBytes(_lastResult.bytes.slice(), _lastResult.filename).catch(()=>{});
  });
  document.getElementById('res-save')?.addEventListener('click',()=>saveResultOnline(id));
  document.getElementById('res-new').addEventListener('click',()=>resetToolUI(id));
}

// Propose à un utilisateur connecté de sauvegarder en ligne (48h) le fichier
// qu'il vient de traiter, directement depuis l'écran de résultat.
async function saveResultOnline(id){
  if(!sb||!user){ openAuth(); return; }
  if(!user.email_confirmed_at){ showToast(lang==='fr'?'Vérifiez votre email d\'abord.':'Please verify your email first.','err'); return; }
  if(!_lastResult) return;
  const btn=document.getElementById('res-save');
  const out=document.getElementById('res-save-out');
  try{
    if(btn){ btn.disabled=true; btn.textContent=lang==='fr'?'Sauvegarde…':'Saving…'; }
    const {bytes, filename}=_lastResult;
    const path=Security.buildStoragePath(user.id,filename);
    const mimeType=filename.endsWith('.pptx')
      ?'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      :'application/pdf';
    const blob=new Blob([bytes],{type:mimeType});
    const{error:upErr}=await sb.storage.from('pdf-files').upload(path,blob,{contentType:mimeType,upsert:false});
    if(upErr)throw upErr;
    const{data:signedData,error:signErr}=await sb.storage.from('pdf-files').createSignedUrl(path,3600);
    if(signErr)throw signErr;
    const expiresAt=new Date(Date.now()+48*3600*1000).toISOString();
    const{data:dbRow,error:dbErr}=await sb.from('shared_files').insert({user_id:user.id,file_path:path,filename,tool_used:id,file_size:bytes.byteLength,expires_at:expiresAt}).select().single();
    if(dbErr)throw dbErr;
    await audit('upload',dbRow?.id,{filename,tool:id,size:bytes.byteLength});
    if(out){
      out.innerHTML=`<p style="font-size:13px;font-weight:600;margin-bottom:6px">🔗 ${lang==='fr'?'Lien sécurisé (valide 1h) :':'Secure link (valid 1h):'}</p><div class="share-row"><input class="share-inp" id="res-share-inp" readonly/><button class="btn-primary" style="padding:8px 14px;font-size:13px" id="res-share-copy">${t('copylink')}</button></div><p class="share-exp" style="color:var(--tx3);margin-top:4px">${lang==='fr'?'Enregistré 48h dans votre compte':'Saved 48h in your account'}</p>`;
      const inp=document.getElementById('res-share-inp');
      if(inp) inp.value=signedData.signedUrl;
      document.getElementById('res-share-copy')?.addEventListener('click',()=>{
        navigator.clipboard?.writeText(signedData.signedUrl).then(()=>showToast(t('linkcopied'),'ok'),()=>{});
      });
    }
    if(btn) btn.style.display='none';
    showToast(lang==='fr'?'✅ Sauvegardé en ligne (48h)':'✅ Saved online (48h)','ok');
  }catch(e){
    if(btn){ btn.disabled=false; btn.textContent='💾 '+(lang==='fr'?'Sauvegarder en ligne (48h)':'Save online (48h)'); }
    showToast(e.message||'error','err');
  }
}

// Réinitialise l'outil (page dédiée #tool-body ou modal #ws-body).
function resetToolUI(id){
  resetToolState();
  const page=document.getElementById('tool-body');
  const host=page||document.getElementById('ws-body');
  if(!host)return;
  host.innerHTML=buildUI(id);
  setupDrop(id);
}

function hideProg(){document.getElementById('tp')?.classList.remove('show');}

async function ensurePdfJs(){
  if(window.pdfjsLib) return;
  await new Promise((res,rej)=>{
    const s=document.createElement('script');
    s.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload=()=>{pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';res();}
    s.onerror=rej;document.head.appendChild(s);
  });
}

async function renderThumb(canvas, file, pageIdx, scale=0.22){
  try{
    await ensurePdfJs();
    let pdfDoc=_thumbPdfCache.get(file);
    if(!pdfDoc){
      const buf=await file.arrayBuffer();
      pdfDoc=await pdfjsLib.getDocument({data:buf.slice(0)}).promise;
      _thumbPdfCache.set(file, pdfDoc);
      Security.wipeMemory(buf);
    }
    const page=await pdfDoc.getPage(pageIdx+1);
    const vp=page.getViewport({scale});
    canvas.width=vp.width; canvas.height=vp.height;
    await page.render({canvasContext:canvas.getContext('2d'),viewport:vp}).promise;
  }catch(e){
    const ctx=canvas.getContext('2d');
    canvas.width=80;canvas.height=90;
    ctx.fillStyle='#1E2D45';ctx.fillRect(0,0,80,90);
    ctx.fillStyle='#8B9CB6';ctx.font='10px sans-serif';ctx.textAlign='center';
    ctx.fillText('PDF',40,48);
  }
}

async function getPdfPageCount(file){
  await ensurePdfJs();
  const buf=await file.arrayBuffer();
  const doc=await pdfjsLib.getDocument({data:buf.slice(0)}).promise;
  const n=doc.numPages;
  Security.wipeMemory(buf);
  return n;
}

function showToast(msg, type='info', duration=3500){
  let container=document.getElementById('toast-container');
  if(!container){
    container=document.createElement('div');
    container.id='toast-container';
    document.body.appendChild(container);
  }
  const toast=document.createElement('div');
  toast.className=`toast ${type}`;
  const icon={ok:'✅',err:'❌',info:'ℹ️'}[type]||'ℹ️';
  toast.innerHTML=`<span>${icon}</span><span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(()=>{
    toast.style.animation='toastOut .3s ease forwards';
    setTimeout(()=>toast.remove(),300);
  },duration);
}

function getRecent(){
  try{return JSON.parse(localStorage.getItem(RECENT_KEY)||'[]');}catch{return[];}
}

function addRecent(name, toolId, size){
  const list=getRecent();
  const item={name:Security.sanitizeFilename(name),tool:toolId,size,ts:Date.now()};
  const filtered=list.filter(r=>r.name!==item.name||r.tool!==item.tool);
  filtered.unshift(item);
  filtered.splice(MAX_RECENT);
  try{localStorage.setItem(RECENT_KEY,JSON.stringify(filtered));}catch{}
  renderRecent();
}

function removeRecent(idx){
  const list=getRecent();
  list.splice(idx,1);
  try{localStorage.setItem(RECENT_KEY,JSON.stringify(list));}catch{}
  renderRecent();
}

function renderRecent(){
  const bar=document.getElementById('recent-bar');
  if(!bar) return;
  const list=getRecent();
  // BUG 7 FIX: label section + BUG 4 FIX: chips cliquables
  if(!list.length){
    bar.innerHTML=''; return;
  }
  bar.innerHTML=`<span style="font-size:11px;color:var(--tx3);font-weight:600;text-transform:uppercase;letter-spacing:1px;margin-right:4px">${t('recent')} ·</span>`+
    list.map((r,i)=>{
      const chip=document.createElement('div');
      return `<div class="recent-chip" data-tool="${Security.escHtml(r.tool)}" title="${Security.escHtml(r.name)} · ${Security.escHtml(r.tool)}">
        <span>📄</span>
        <span>${Security.escHtml(r.name.substring(0,18))}${r.name.length>18?'…':''}</span>
        <span class="rc-rm" data-idx="${i}" title="Remove">✕</span>
      </div>`;
    }).join('');
  // addEventListener au lieu de onclick inline
  bar.querySelectorAll('.recent-chip').forEach(chip=>{
    const toolId=chip.dataset.tool;
    chip.addEventListener('click',e=>{
      if(e.target.classList.contains('rc-rm')){
        e.stopPropagation();
        removeRecent(parseInt(e.target.dataset.idx));
        return;
      }
      if(toolId) openTool(toolId);
    });
  });
}

function incrementStats(){
  try{
    const stored=parseInt(localStorage.getItem('iworkpdf_count')||'0')+1;
    localStorage.setItem('iworkpdf_count',stored);
    const el=document.getElementById('stat-count');
    if(el) el.textContent=stored;
  }catch{}
}

// Injecte le JSON-LD structured data (SoftwareApplication + WebPage) dans le <head>.
// Appelé sur chaque page outil au chargement. Améliore le SEO Google directement.
function injectJsonLd(toolId, titleEn, descEn){
  const tool = TOOLS.find(t=>t.id===toolId);
  if(!tool) return;
  const url = `https://iworkpdf.yendyx.com/tools/${toolId}`;
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": url,
        "url": url,
        "name": titleEn + " — iWorkPDF",
        "description": descEn,
        "inLanguage": ["en","fr"],
        "isPartOf": { "@id": "https://iworkpdf.yendyx.com" },
        "breadcrumb": {
          "@type": "BreadcrumbList",
          "itemListElement": [
            {"@type":"ListItem","position":1,"name":"iWorkPDF","item":"https://iworkpdf.yendyx.com"},
            {"@type":"ListItem","position":2,"name":titleEn,"item":url}
          ]
        }
      },
      {
        "@type": "SoftwareApplication",
        "name": "iWorkPDF — " + titleEn,
        "url": url,
        "applicationCategory": "UtilitiesApplication",
        "operatingSystem": "Any",
        "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
        "description": descEn,
        "featureList": [
          "100% local processing — files never leave your device",
          "No account required",
          "Free forever",
          "Works in any modern browser"
        ],
        "provider": {
          "@type": "Organization",
          "name": "Yendyx",
          "url": "https://yendyx.com"
        }
      }
    ]
  };
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(data);
  document.head.appendChild(script);
}

function initStats(){
  try{
    const stored=parseInt(localStorage.getItem('iworkpdf_count')||'0');
    const el=document.getElementById('stat-count');
    if(el) el.textContent=stored||'0';
  }catch{}
}

function toggleTheme(){
  isDark=!isDark;
  const html=document.documentElement;
  html.classList.toggle('dark', isDark);
  html.classList.toggle('light', !isDark);
  const btn=document.getElementById('theme-btn');
  if(btn) btn.textContent=isDark?'☀️':'🌙';
  try{localStorage.setItem('iworkpdf_theme',isDark?'dark':'light');}catch{}
}

function initTheme(){
  try{
    const saved=localStorage.getItem('iworkpdf_theme');
    // Mode clair par défaut ; dark uniquement si l'utilisateur l'a choisi.
    isDark = (saved==='dark');
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.classList.toggle('light', !isDark);
    const btn=document.getElementById('theme-btn');
    if(btn) btn.textContent = isDark ? '☀️' : '🌙';
  }catch{}
}

function initNetworkMonitor(){
  // Intercepter fetch
  const originalFetch = window.fetch;
  // BUG 8 FIX: ignorer les requêtes init (fonts, CDN scripts) pendant les 3 premières secondes
  const initTime = Date.now();
  window.fetch = function(...args){
    const url = typeof args[0]==='string' ? args[0] : args[0]?.url || '';
    const isInit = Date.now() - initTime < 3000;
    const isLocal = url.startsWith('blob:') || url.startsWith('data:');
    const isCdn = url.includes('fonts.') || url.includes('cdn.jsdelivr') || url.includes('cdnjs.cloud');
    if(!isLocal && !isInit && !isCdn){
      netRequestCount++;
      setNetActive(true);
    }
    return originalFetch.apply(this, args).finally(()=>{
      // Revenir à safe après 2s sans activité
      clearTimeout(netTimer);
      netTimer = setTimeout(()=>setNetActive(false), 2000);
    });
  };

  // Intercepter XHR
  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(...args){
    netRequestCount++;
    setNetActive(true);
    clearTimeout(netTimer);
    netTimer = setTimeout(()=>setNetActive(false), 2000);
    return origOpen.apply(this, args);
  };
}

function setNetActive(active){
  netIsActive = active;
  const monitor = document.getElementById('net-monitor');
  const dot = document.getElementById('net-dot');
  const text = document.getElementById('net-text');
  const count = document.getElementById('net-count');
  const T = TRUST_I18N[lang] || TRUST_I18N.en;
  if(!monitor) return;
  if(active){
    monitor.classList.remove('safe');
    monitor.classList.add('active');
    if(dot) dot.classList.add('active');
    if(text) text.textContent = T.net_active;
  } else {
    monitor.classList.add('safe');
    monitor.classList.remove('active');
    if(dot) dot.classList.remove('active');
    if(text) text.textContent = T.net_safe;
  }
  if(count) count.textContent = `${netRequestCount} req`;
}

function showLocalCert(){
  const body = document.getElementById('ws-body');
  // BUG 4 FIX: vérifier que le modal est encore ouvert
  if(!body || !document.getElementById('ws-overlay')?.classList.contains('active')) return;
  const T = TRUST_I18N[lang] || TRUST_I18N.en;
  // Supprimer un ancien cert s'il existe
  document.getElementById('local-cert')?.remove();
  const cert = document.createElement('div');
  cert.className = 'local-cert show';
  cert.id = 'local-cert';
  cert.innerHTML = `
    <div class="cert-icon">🛡️</div>
    <div>
      <div class="cert-title">✅ ${T.cert_title}</div>
      <div class="cert-sub">${T.cert_sub}</div>
    </div>`;
  body.appendChild(cert);
}

function renderFaq(){
  const list = document.getElementById('faq-list');
  if(!list) return;
  const T = TRUST_I18N[lang] || TRUST_I18N.en;
  const ft = document.getElementById('faq-title');
  const fs = document.getElementById('faq-sub');
  if(ft) ft.textContent = T.faq_title;
  if(fs) fs.textContent = T.faq_sub;
  list.innerHTML = '';
  T.faqs.forEach((faq, i) => {
    const item = document.createElement('div');
    item.className = 'faq-item';
    item.innerHTML = `
      <div class="faq-q" data-idx="${i}">
        <span>${faq.q}</span>
        <span class="faq-chevron">▼</span>
      </div>
      <div class="faq-a"><div class="faq-a-inner">${faq.a}</div></div>`;
    item.querySelector('.faq-q').addEventListener('click', ()=>{
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(el=>el.classList.remove('open'));
      if(!isOpen) item.classList.add('open');
    });
    list.appendChild(item);
  });
}

function openPrivacy(){
  const T = TRUST_I18N[lang] || TRUST_I18N.en;
  const body = document.getElementById('privacy-body');
  const title = document.getElementById('privacy-title');
  if(title) title.textContent = `🔒 ${T.privacy_btn}`;
  if(body){
    body.innerHTML = lang==='fr' ? getPrivacyFR() : getPrivacyEN();
  }
  document.getElementById('privacy-overlay')?.classList.add('active');
}

function closePrivacy(){
  document.getElementById('privacy-overlay')?.classList.remove('active');
}

function getPrivacyEN(){
  return `
    <div class="privacy-section">
      <h3>📋 Summary</h3>
      <p>iWorkPDF is a free PDF tool built with privacy as its core principle. <strong>We don't collect, store, or share your files or personal data</strong> during normal use.</p>
    </div>

    <div class="privacy-section">
      <h3>🖥 What happens to your files?</h3>
      <table class="privacy-table">
        <tr><th>Operation</th><th>Where it runs</th><th>Data sent?</th></tr>
        <tr><td>Merge, Split, Rotate…</td><td>Your browser</td><td><span class="green-pill">Never</span></td></tr>
        <tr><td>Compress, Watermark…</td><td>Your browser</td><td><span class="green-pill">Never</span></td></tr>
        <tr><td>Sign, Crop, Repair…</td><td>Your browser</td><td><span class="green-pill">Never</span></td></tr>
        <tr><td>Cloud share (48h) ★</td><td>Supabase storage</td><td><span style="color:var(--wa);font-size:11px;font-weight:600">Only if you choose</span></td></tr>
      </table>
      <p>★ Cloud sharing is entirely optional. Files are encrypted in transit, accessible only via a signed URL, and automatically deleted after 48 hours.</p>
    </div>

    <div class="privacy-section">
      <h3>📊 Data we collect</h3>
      <table class="privacy-table">
        <tr><th>Data type</th><th>Collected?</th><th>Why</th></tr>
        <tr><td>File content</td><td><span class="green-pill">Never</span></td><td>—</td></tr>
        <tr><td>File names</td><td><span class="green-pill">Never (local)</span></td><td>—</td></tr>
        <tr><td>IP address</td><td><span class="green-pill">Never stored</span></td><td>—</td></tr>
        <tr><td>Cookies</td><td><span class="green-pill">None</span></td><td>—</td></tr>
        <tr><td>Analytics</td><td><span class="green-pill">None</span></td><td>—</td></tr>
        <tr><td>Email (account)</td><td><span style="color:var(--wa);font-size:11px;font-weight:600">Only if you register</span></td><td>Authentication only</td></tr>
      </table>
    </div>

    <div class="privacy-section">
      <h3>🇪🇺 GDPR Compliance</h3>
      <p>iWorkPDF is designed to be GDPR-compliant by default:</p>
      <ul>
        <li>No personal data collected during normal use</li>
        <li>Account data (email) can be deleted at any time</li>
        <li>Cloud files are automatically deleted after 48 hours</li>
        <li>No third-party advertising or tracking</li>
        <li>Data stored in Supabase EU region</li>
      </ul>
    </div>

    <div class="privacy-section">
      <h3>🔧 Third-party services</h3>
      <p><strong>Supabase</strong> — Authentication and optional cloud storage. Privacy policy: supabase.com/privacy<br>
      <strong>Google Fonts</strong> — Typography (Space Grotesk). Font files loaded from Google servers.<br>
      <strong>pdf-lib.js / PDF.js</strong> — Loaded from CDN once, runs locally in your browser.</p>
    </div>

    <div class="privacy-section">
      <h3>📬 Contact</h3>
      <p>Questions about your privacy? Contact us at <a href="mailto:privacy@yendyx.com" style="color:var(--cy)">privacy@yendyx.com</a></p>
      <p style="margin-top:8px;color:var(--tx3);font-size:11px">Last updated: June 2025 · iWorkPDF by Yendyx</p>
    </div>`;
}

function getPrivacyFR(){
  return `
    <div class="privacy-section">
      <h3>📋 Résumé</h3>
      <p>iWorkPDF est un outil PDF gratuit construit avec la confidentialité comme principe fondateur. <strong>Nous ne collectons, ne stockons ni ne partageons vos fichiers ou données personnelles</strong> lors d'une utilisation normale.</p>
    </div>

    <div class="privacy-section">
      <h3>🖥 Que se passe-t-il avec vos fichiers ?</h3>
      <table class="privacy-table">
        <tr><th>Opération</th><th>Où ça s'exécute</th><th>Données envoyées ?</th></tr>
        <tr><td>Fusionner, Diviser, Rotation…</td><td>Votre navigateur</td><td><span class="green-pill">Jamais</span></td></tr>
        <tr><td>Compresser, Filigrane…</td><td>Votre navigateur</td><td><span class="green-pill">Jamais</span></td></tr>
        <tr><td>Signer, Rogner, Réparer…</td><td>Votre navigateur</td><td><span class="green-pill">Jamais</span></td></tr>
        <tr><td>Partage cloud (48h) ★</td><td>Stockage Supabase</td><td><span style="color:var(--wa);font-size:11px;font-weight:600">Seulement si vous choisissez</span></td></tr>
      </table>
      <p>★ Le partage cloud est entièrement optionnel. Les fichiers sont chiffrés en transit, accessibles uniquement via une URL signée, et automatiquement supprimés après 48 heures.</p>
    </div>

    <div class="privacy-section">
      <h3>📊 Données que nous collectons</h3>
      <table class="privacy-table">
        <tr><th>Type de données</th><th>Collecté ?</th><th>Pourquoi</th></tr>
        <tr><td>Contenu des fichiers</td><td><span class="green-pill">Jamais</span></td><td>—</td></tr>
        <tr><td>Noms de fichiers</td><td><span class="green-pill">Jamais (local)</span></td><td>—</td></tr>
        <tr><td>Adresse IP</td><td><span class="green-pill">Jamais stockée</span></td><td>—</td></tr>
        <tr><td>Cookies</td><td><span class="green-pill">Aucun</span></td><td>—</td></tr>
        <tr><td>Analytics</td><td><span class="green-pill">Aucune</span></td><td>—</td></tr>
        <tr><td>Email (compte)</td><td><span style="color:var(--wa);font-size:11px;font-weight:600">Seulement si inscription</span></td><td>Authentification uniquement</td></tr>
      </table>
    </div>

    <div class="privacy-section">
      <h3>🇪🇺 Conformité RGPD</h3>
      <p>iWorkPDF est conçu pour être conforme au RGPD par défaut :</p>
      <ul>
        <li>Aucune donnée personnelle collectée lors d'une utilisation normale</li>
        <li>Les données de compte (email) peuvent être supprimées à tout moment</li>
        <li>Les fichiers cloud sont automatiquement supprimés après 48 heures</li>
        <li>Aucune publicité ni tracking tiers</li>
        <li>Données stockées dans la région EU de Supabase</li>
      </ul>
    </div>

    <div class="privacy-section">
      <h3>🔧 Services tiers</h3>
      <p><strong>Supabase</strong> — Authentification et stockage cloud optionnel. Politique de confidentialité : supabase.com/privacy<br>
      <strong>Google Fonts</strong> — Typographie (Space Grotesk). Fichiers de polices chargés depuis les serveurs Google.<br>
      <strong>pdf-lib.js / PDF.js</strong> — Chargés depuis CDN une fois, s'exécutent localement dans votre navigateur.</p>
    </div>

    <div class="privacy-section">
      <h3>📬 Contact</h3>
      <p>Questions sur votre confidentialité ? Contactez-nous à <a href="mailto:privacy@yendyx.com" style="color:var(--cy)">privacy@yendyx.com</a></p>
      <p style="margin-top:8px;color:var(--tx3);font-size:11px">Dernière mise à jour : Juin 2025 · iWorkPDF by Yendyx</p>
    </div>`;
}

function togglePrivacyMode(val){
  privacyMode = val;
  // En mode confidentialité max: cacher les options cloud
  document.querySelectorAll('#so-cloud').forEach(el=>{
    el.style.display = privacyMode ? 'none' : '';
  });
  if(privacyMode && saveMode==='cloud'){
    saveMode='local';
    document.querySelectorAll('#so-local').forEach(el=>el.classList.add('active'));
  }
  try{ localStorage.setItem('iworkpdf_privacy_mode', privacyMode?'1':'0'); }catch{}
  showToast(privacyMode
    ? (lang==='fr'?'🔒 Mode confidentialité activé':'🔒 Privacy mode enabled')
    : (lang==='fr'?'Mode standard activé':'Standard mode enabled'), 'info');
}

function applyTrustLang(){
  const T = TRUST_I18N[lang] || TRUST_I18N.en;
  const ids = {
    'tb1':T.tb1, 'tb1s':T.tb1s, 'tb2':T.tb2,
    'tb3':T.tb3, 'tb4':T.tb4, 'tb5':T.tb5,
    'sb1':T.sb1, 'sb2':T.sb2, 'sb3':T.sb3, 'sb4':T.sb4, 'sb5':T.sb5,
    'pr1':T.pr1, 'pr1s':T.pr1s, 'pr2':T.pr2, 'pr2s':T.pr2s,
    'pr3':T.pr3, 'pr3s':T.pr3s, 'pr4':T.pr4, 'pr4s':T.pr4s,
    'pr5':T.pr5, 'pr5s':T.pr5s,
    'footer-made':T.footer_made,

  };
  Object.entries(ids).forEach(([id,val])=>{
    const el=document.getElementById(id);
    if(el) el.textContent=val;
  });
  // Privacy buttons
  document.querySelectorAll('#privacy-btn, #footer-privacy-btn').forEach(btn=>{
    if(btn.tagName==='BUTTON') btn.textContent=T.privacy_btn;
  });
  // Net monitor
  setNetActive(netIsActive);
  renderFaq();
}

function buildPrivacyModeBar(){
  const T = TRUST_I18N[lang]||TRUST_I18N.en;
  // BUG 1+2 FIX: pas d'onchange inline → wiré via setupDrop
  return `<div class="privacy-mode-bar" id="pm-bar">
    <div>
      <div class="pm-label">🔒 ${T.pm_label}</div>
      <div class="pm-sub">${T.pm_sub}</div>
    </div>
    <label class="pm-toggle">
      <input type="checkbox" id="pm-checkbox" ${privacyMode?'checked':''}/>
      <span class="pm-slider"></span>
    </label>
  </div>`;
}

// ── COOKIE BANNER RGPD ─────────────────────────────────────
// iWorkPDF ne pose aucun cookie de tracking, mais la bannière est
// requise par le RGPD même pour informer de l'absence de tracking.
function initCookieBanner(){
  try{ if(localStorage.getItem('iworkpdf_cookie_ok')) return; }catch{}
  const banner = document.createElement('div');
  banner.id = 'cookie-banner';
  banner.innerHTML = `
    <div class="ck-inner">
      <div class="ck-text">
        <span class="ck-icon">🍪</span>
        <div>
          <strong>${lang==='fr'?'Cookies & Confidentialité':'Cookies & Privacy'}</strong>
          <p>${lang==='fr'
            ? 'iWorkPDF utilise uniquement des cookies techniques essentiels (thème, langue, historique local). Aucun cookie publicitaire ni de tracking.'
            : 'iWorkPDF only uses essential technical cookies (theme, language, local history). No advertising or tracking cookies.'
          }</p>
        </div>
      </div>
      <div class="ck-actions">
        <button class="ck-details" onclick="openPrivacy()">${lang==='fr'?'En savoir plus':'Learn more'}</button>
        <button class="ck-accept" onclick="acceptCookies()">${lang==='fr'?'J\'accepte':'Accept'}</button>
      </div>
    </div>`;
  document.body.appendChild(banner);
  // Animate in
  requestAnimationFrame(()=>requestAnimationFrame(()=>banner.classList.add('show')));
}

function acceptCookies(){
  try{ localStorage.setItem('iworkpdf_cookie_ok','1'); }catch{}
  const b = document.getElementById('cookie-banner');
  if(b){ b.classList.remove('show'); setTimeout(()=>b.remove(), 400); }
}

function initTrust(){
  // Privacy mode depuis localStorage
  try{
    if(localStorage.getItem('iworkpdf_privacy_mode')==='1'){
      privacyMode=true;
    }
  }catch{}

  // Network monitor
  initNetworkMonitor();

  // Event listeners confiance
  document.getElementById('privacy-btn')?.addEventListener('click', openPrivacy);
  document.getElementById('footer-privacy-btn')?.addEventListener('click', openPrivacy);
  document.getElementById('privacy-close-btn')?.addEventListener('click', closePrivacy);
  document.getElementById('privacy-overlay')?.addEventListener('click', e=>{
    if(e.target===e.currentTarget) closePrivacy();
  });

  // FAQ
  renderFaq();

  // Apply trust i18n
  applyTrustLang();
}

function earlyReturn(msg,type='err'){
  setStatus(msg,type);
  isProcessing=false;
  toggleActionSpinner(false);
  document.querySelectorAll('#ws-body .btn-primary, #tool-body .btn-primary').forEach(b=>b.disabled=false);
}

async function run(id){
  if(isProcessing)return;
  if(!activeFiles.length){setStatus(t('nofile'),'err');return;}
  isProcessing=true;
  document.querySelectorAll('#ws-body .btn-primary, #tool-body .btn-primary').forEach(b=>b.disabled=true);
  toggleActionSpinner(true);
  setStatus(t('processing'),'info');
  setProgress(5,t('reading'));
  document.title = `⏳ ${t('processing')} — iWorkPDF`;
  let result=null,filename='output.pdf';
  try{
    if(id==='merge'){
      const r=await runMerge(activeFiles, mergeDocs);
      if(!r)return; // earlyReturn déjà géré dans runMerge
      result=r.result; filename=r.filename;
    }
    else if(id==='delete'){
      const r=await runDelete(activeFiles, deleteSelectedPages);
      if(!r)return; // earlyReturn déjà géré dans runDelete
      result=r.result; filename=r.filename;
    }
    else if(id==='split'){
      await runSplit(activeFiles, typeof splitSelectedPages!=='undefined'?splitSelectedPages:new Set());
      return;
    }
    else if(id==='rotate'){
      const r=await runRotate(activeFiles, rotateAngle, rotateSelected);
      result=r.result; filename=r.filename;
    }
    else if(id==='compress'){
      const r=await runCompress(activeFiles, typeof compQuality!=='undefined'?compQuality:0.75, typeof _compScan!=='undefined'?_compScan:null);
      result=r.result; filename=r.filename;
    }
    else if(id==='security'){
      const r=await runSecurity(activeFiles, secMode, document.getElementById('sp')?.value);
      if(!r)return; // earlyReturn déjà géré dans runSecurity
      result=r.result; filename=r.filename;
    }
    else if(id==='watermark'){
      const r=await runWatermark(activeFiles, document.getElementById('wt')?.value);
      if(!r)return; // earlyReturn déjà géré dans runWatermark
      result=r.result; filename=r.filename;
    }
    else if(id==='img2pdf'){
      const r=await runImg2Pdf(activeFiles);
      result=r.result; filename=r.filename;
    }

    else if(id==='pagenums'){
      const r=await runPageNums(activeFiles, pnPos, pnFmt);
      result=r.result; filename=r.filename;
    }
    else if(id==='pdf2jpg'){
      await runPdf2Jpg(activeFiles, typeof jpgQuality!=='undefined'?jpgQuality:0.9);
      return;
    }

    else if(id==='repair'){
      const r=await runRepair(activeFiles);
      if(!r)return; // earlyReturn déjà géré dans runRepair
      result=r.result; filename=r.filename;
    }
    else if(id==='crop'){
      const r=await runCrop(activeFiles);
      result=r.result; filename=r.filename;
    }

    else if(id==='sign'){
      const r=await runSign(activeFiles, typeof signPos!=='undefined'?signPos:'br');
      if(!r)return; // earlyReturn déjà géré dans runSign
      result=r.result; filename=r.filename;
    }
    else if(id==='extract'){
      await runExtract(activeFiles);
      return;
    }

    if(!result)throw new Error('Processing failed: no output generated.');
    setProgress(90,'Finalizing…');

            const resultSize=result.byteLength||0;
    if(saveMode==='cloud'&&user){
      await uploadCloud(result,filename,id);
      Security.wipeMemory(result);
    }else{
      // Copie conservée pour l'écran de résultat / re-téléchargement.
      const keep=result.slice();
      Security.wipeMemory(result);
      // Dialogue de sauvegarde natif : si l'utilisateur annule, on affiche
      // quand même l'écran de résultat (il peut re-télécharger). BUG fluidité.
      try{ await dlBytes(keep.slice(), filename); }
      catch(e){ if(e.name!=='AbortError') throw e; }
      setProgress(100,'✅');hideProg();
      await audit(id,null,{filename,size:resultSize});
      addRecent(filename, id, resultSize);
      incrementStats();
      showToast(`✅ ${filename}`, 'ok');
      showResultScreen(id, keep, filename);
    }
  }catch(e){
    console.error(e);
    setStatus(`❌ ${e.message}`,'err');
    hideProg();
  }finally{
    isProcessing=false;
    toggleActionSpinner(false);
    document.querySelectorAll('#ws-body .btn-primary, #tool-body .btn-primary').forEach(b=>b.disabled=false);
    document.title = 'iWorkPDF — by Yendyx';
  }
}

function convertImgToPng(url){
  return new Promise((resolve,reject)=>{
    const img=new Image();
    img.onload=()=>{
      const c=document.createElement('canvas');
      c.width=img.naturalWidth;c.height=img.naturalHeight;
      c.getContext('2d').drawImage(img,0,0);
      c.toBlob(blob=>{if(!blob){reject(new Error('Canvas conversion failed'));return;}blob.arrayBuffer().then(resolve).catch(reject);},'image/png');
    };
    img.onerror=()=>reject(new Error('Image load failed'));
    img.src=url;
  });
}

async function uploadCloud(bytes,filename,toolId){
  if(!sb){throw new Error(lang==='fr'?'Cloud indisponible (hors ligne).':'Cloud unavailable (offline).');}
  if(!user){throw new Error(lang==='fr'?'Connectez-vous pour utiliser le cloud.':'Sign in to use cloud storage.');}
  if(!user.email_confirmed_at){throw new Error(lang==='fr'?'Vérifiez votre email d\'abord.':'Please verify your email first.');}
  setProgress(92,t('uploading'));
  const path=Security.buildStoragePath(user.id,filename);
  // BUG 6 FIX: MIME type dynamique selon l'extension du fichier
  const mimeType=filename.endsWith('.pptx')
    ?'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    :'application/pdf';
  const blob=new Blob([bytes],{type:mimeType});
  const{error:upErr}=await sb.storage.from('pdf-files').upload(path,blob,{contentType:mimeType,upsert:false});
  if(upErr)throw upErr;
  const{data:signedData,error:signErr}=await sb.storage.from('pdf-files').createSignedUrl(path,3600);
  if(signErr)throw signErr;
  const expiresAt=new Date(Date.now()+48*3600*1000).toISOString();
  const{data:dbRow,error:dbErr}=await sb.from('shared_files').insert({user_id:user.id,file_path:path,filename,tool_used:toolId,file_size:bytes.byteLength,expires_at:expiresAt}).select().single();
  if(dbErr)throw dbErr;
  await audit('upload',dbRow?.id,{filename,tool:toolId,size:bytes.byteLength});
  setProgress(100,'✅');hideProg();
  setStatus(`✅ ${t('uploaded')}`,'ok');
  const box=document.getElementById('share-result');
  if(box){
    box.classList.add('show');
    document.getElementById('share-link-inp').value=signedData.signedUrl;
    document.getElementById('share-exp-txt').textContent=`⏱ ${t('linkvalid')} ${new Date(Date.now()+3600000).toLocaleString()} · ${t('deleteon')} ${new Date(expiresAt).toLocaleString()}`;
  }
}

async function dlJpg(bytes, filename){
  if(window.showSaveFilePicker){
    try{
      const handle=await window.showSaveFilePicker({
        suggestedName:filename,
        types:[{description:'JPEG Image',accept:{'image/jpeg':['.jpg','.jpeg']}}]
      });
      const writable=await handle.createWritable();
      await writable.write(new Blob([bytes],{type:'image/jpeg'}));
      await writable.close();
      return;
    }catch(e){
      if(e.name==='AbortError') throw e;
    }
  }
  const url=URL.createObjectURL(new Blob([bytes],{type:'image/jpeg'}));
  const a=document.createElement('a');
  a.href=url;a.download=filename;a.rel='noopener noreferrer';
  document.body.appendChild(a);a.click();document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url),5000);
}

async function dlBytes(bytes, filename){
  if(window.showSaveFilePicker){
    try{
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types:[{description:'PDF Document',accept:{'application/pdf':['.pdf']}}],
      });
      const writable = await handle.createWritable();
      await writable.write(new Blob([bytes],{type:'application/pdf'}));
      await writable.close();
      return;
    }catch(e){
      // BUG 3 FIX: propager AbortError pour que split puisse s'arrêter
      if(e.name==='AbortError') throw e;
      // Autre erreur → fallback classique
    }
  }
  const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
  const a=document.createElement('a');
  a.href=url;a.download=filename;a.rel='noopener noreferrer';
  document.body.appendChild(a);a.click();document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url),5000);
}

// ── EXPORT ZIP (sorties multiples → un seul téléchargement) ──
// Indispensable sur mobile : les navigateurs bloquent souvent les
// téléchargements multiples successifs.
async function ensureJSZip(){
  if(window.JSZip)return;
  await new Promise((res,rej)=>{
    const s=document.createElement('script');
    s.src='https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    s.onload=res;s.onerror=()=>rej(new Error('JSZip load failed'));
    document.head.appendChild(s);
  });
}
// files: [{name, data:Uint8Array}] → un seul .zip
// STORE (pas de recompression) : PDF/JPG sont déjà compressés.
async function dlZip(files,zipName){
  await ensureJSZip();
  const zip=new JSZip();
  files.forEach(f=>zip.file(f.name,f.data));
  const blob=await zip.generateAsync({type:'blob',compression:'STORE'});
  if(window.showSaveFilePicker){
    try{
      const handle=await window.showSaveFilePicker({suggestedName:zipName,types:[{description:'ZIP archive',accept:{'application/zip':['.zip']}}]});
      const w=await handle.createWritable();
      await w.write(blob);await w.close();
      return;
    }catch(e){
      if(e.name==='AbortError')throw e;
      // autre erreur → fallback lien classique
    }
  }
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download=zipName;a.rel='noopener noreferrer';
  document.body.appendChild(a);a.click();document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url),5000);
}

function copyLink(){
  navigator.clipboard?.writeText(document.getElementById('share-link-inp')?.value||'').catch(()=>{});
  setStatus(t('linkcopied'),'ok');
}
// ── ANALYTICS PRIVACY-FIRST ────────────────────────────────
// Zéro cookie, zéro fingerprinting, zéro tiers.
// Stocke uniquement : page URL (sans query), referrer domain, langue, outil.
// Conforme RGPD sans consentement (donnée non personnelle).
async function trackPageView(toolId){
  if(!sb)return;
  try{
    const payload={
      page: window.location.pathname,
      tool: toolId||null,
      referrer: document.referrer ? new URL(document.referrer).hostname : null,
      lang: navigator.language?.substring(0,2)||'en',
      ua_type: /Mobile|Android|iPhone/.test(navigator.userAgent)?'mobile':'desktop',
      ts: new Date().toISOString(),
    };
    // On utilise une fonction edge Supabase pour ne pas exposer la table directement
    await sb.functions.invoke('track-pageview', {body: payload}).catch(()=>{});
  }catch{}
}

// ── COMPTE : mot de passe oublié / suppression / CONTACT ──────
async function doForgotPassword(){
  const raw=document.getElementById('l-email')?.value||'';
  const st=document.getElementById('l-status');
  try{
    if(!sb)throw new Error(lang==='fr'?'Indisponible hors ligne.':'Unavailable offline.');
    const email=Security.validateEmail(raw);
    if(st){st.className='status-box info';st.textContent=lang==='fr'?'Envoi du lien…':'Sending link…';}
    const{error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin});
    if(error)throw new Error(error.message);
    if(st){st.className='status-box ok';st.textContent=lang==='fr'?'Email de réinitialisation envoyé. Vérifiez votre boîte (et les spams).':'Reset email sent. Check your inbox (and spam).';}
  }catch(e){ if(st){st.className='status-box err';st.textContent=e.message;} }
}

// Écran "nouveau mot de passe" après clic sur le lien de récupération.
function openNewPasswordModal(){
  if(document.getElementById('np-overlay'))return;
  const ov=document.createElement('div');
  ov.id='np-overlay';ov.className='overlay active';ov.setAttribute('role','dialog');
  ov.innerHTML=`<div class="modal" style="max-width:420px"><div class="modal-head"><h3 class="modal-title">🔑 ${lang==='fr'?'Nouveau mot de passe':'New password'}</h3></div><div class="modal-body"><div class="form-group"><label class="form-label">${lang==='fr'?'Nouveau mot de passe (8 car. min.)':'New password (8 chars min.)'}</label><input class="form-input" type="password" id="np-pwd" autocomplete="new-password" placeholder="••••••••"/></div><div class="form-group"><label class="form-label">${lang==='fr'?'Confirmer le mot de passe':'Confirm password'}</label><input class="form-input" type="password" id="np-pwd2" autocomplete="new-password" placeholder="••••••••"/></div><div class="status-box" id="np-status"></div><button class="btn-primary full" id="np-save">${lang==='fr'?'Enregistrer':'Save'}</button></div></div>`;
  document.body.appendChild(ov);
  document.getElementById('np-save').addEventListener('click',doSetNewPassword);
}
async function doSetNewPassword(){
  const pwd=document.getElementById('np-pwd')?.value||'';
  const st=document.getElementById('np-status');
  try{
    if(!sb)throw new Error(lang==='fr'?'Indisponible hors ligne.':'Unavailable offline.');
    const s=Security.checkPasswordStrength(pwd);
    if(!s.ok)throw new Error(lang==='fr'?'Mot de passe trop faible (8+ car., majuscule, chiffre).':'Password too weak (8+ chars, uppercase, number).');
    const pwd2=document.getElementById('np-pwd2')?.value||'';
    if(pwd!==pwd2)throw new Error(lang==='fr'?'Les mots de passe ne correspondent pas.':'Passwords do not match.');
    if(st){st.className='status-box info';st.textContent=lang==='fr'?'Mise à jour…':'Updating…';}
    const{error}=await sb.auth.updateUser({password:pwd});
    if(error)throw new Error(error.message);
    document.getElementById('np-overlay')?.remove();
    showToast(lang==='fr'?'✅ Mot de passe mis à jour':'✅ Password updated','ok');
  }catch(e){ if(st){st.className='status-box err';st.textContent=e.message;} }
}

async function doDeleteAccount(){
  if(!user)return;
  const ok=confirm(lang==='fr'
    ?'Supprimer définitivement votre compte et tous vos fichiers ? Action irréversible.'
    :'Permanently delete your account and all your files? This cannot be undone.');
  if(!ok)return;
  try{
    const{data:{session}}=await sb.auth.getSession();
    const token=session?.access_token;
    if(!token)throw new Error(lang==='fr'?'Session expirée.':'Session expired.');
    const res=await fetch(`${SUPABASE_URL}/functions/v1/delete-account`,{
      method:'POST',
      headers:{'Authorization':`Bearer ${token}`,'apikey':SUPABASE_KEY,'Content-Type':'application/json'}
    });
    if(!res.ok)throw new Error(lang==='fr'?'Échec de la suppression.':'Deletion failed.');
    await sb.auth.signOut();
    closeHistory();
    showToast(lang==='fr'?'Compte supprimé.':'Account deleted.','ok');
  }catch(e){ showToast(e.message,'err'); }
}

function openContact(){
  if(document.getElementById('ct-overlay')){document.getElementById('ct-overlay').classList.add('active');return;}
  const ov=document.createElement('div');
  ov.id='ct-overlay';ov.className='overlay active';ov.setAttribute('role','dialog');
  ov.innerHTML=`<div class="modal" style="max-width:460px"><div class="modal-head"><h3 class="modal-title">✉️ ${lang==='fr'?'Nous contacter':'Contact us'}</h3><button class="modal-close" id="ct-close" aria-label="Close">✕</button></div><div class="modal-body">
    <div class="form-group"><label class="form-label">${lang==='fr'?'Nom':'Name'}</label><input class="form-input" id="ct-name" maxlength="80" placeholder="${lang==='fr'?'Votre nom':'Your name'}"/></div>
    <div class="form-group"><label class="form-label">Email</label><input class="form-input" type="email" id="ct-email" maxlength="120" placeholder="you@example.com"/></div>
    <div class="form-group"><label class="form-label">Message</label><textarea class="form-input" id="ct-msg" rows="4" maxlength="4000" placeholder="${lang==='fr'?'Votre message…':'Your message…'}" style="resize:vertical"></textarea></div>
    <div class="status-box" id="ct-status"></div>
    <button class="btn-primary full" id="ct-send">${lang==='fr'?'Envoyer':'Send'}</button></div></div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click',e=>{if(e.target===ov)ov.classList.remove('active');});
  document.getElementById('ct-close').addEventListener('click',()=>ov.classList.remove('active'));
  document.getElementById('ct-send').addEventListener('click',sendContact);
}
async function sendContact(){
  const name=document.getElementById('ct-name')?.value||'';
  const email=document.getElementById('ct-email')?.value||'';
  const message=document.getElementById('ct-msg')?.value||'';
  const st=document.getElementById('ct-status');
  const btn=document.getElementById('ct-send');
  try{
    if(message.trim().length<5)throw new Error(lang==='fr'?'Message trop court.':'Message too short.');
    if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))throw new Error(lang==='fr'?'Email invalide.':'Invalid email.');
    if(st){st.className='status-box info';st.textContent=lang==='fr'?'Envoi…':'Sending…';}
    if(btn)btn.disabled=true;
    const res=await fetch(`${SUPABASE_URL}/functions/v1/contact`,{
      method:'POST',headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY},
      body:JSON.stringify({name,email,message})
    });
    if(!res.ok)throw new Error(lang==='fr'?'Échec de l\'envoi. Réessayez plus tard.':'Send failed. Try again later.');
    if(st){st.className='status-box ok';st.textContent=lang==='fr'?'✅ Message envoyé, merci !':'✅ Message sent, thank you!';}
    ['ct-name','ct-email','ct-msg'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  }catch(e){ if(st){st.className='status-box err';st.textContent=e.message;} }
  finally{ if(btn)btn.disabled=false; }
}

// Injecte les éléments manquants sur toutes les pages (sans éditer le HTML).
function initExtras(){
  const loginBtn=document.getElementById('login-btn');
  if(loginBtn && !document.getElementById('forgot-link')){
    const a=document.createElement('button');
    a.id='forgot-link';a.type='button';
    a.style.cssText='background:none;border:none;color:var(--cy);font-size:12px;cursor:pointer;margin-top:12px;text-decoration:underline;font-family:inherit;display:block';
    a.textContent=lang==='fr'?'Mot de passe oublié ?':'Forgot password?';
    a.addEventListener('click',doForgotPassword);
    loginBtn.insertAdjacentElement('afterend',a);
  }
  const logoutBtn=document.getElementById('logout-btn');
  if(logoutBtn && !document.getElementById('del-acct-btn')){
    const b=document.createElement('button');
    b.id='del-acct-btn';b.type='button';b.className='btn-ghost full';
    b.style.cssText='margin-top:8px;color:var(--er);border-color:#EF444455';
    b.textContent=lang==='fr'?'Supprimer mon compte':'Delete my account';
    b.addEventListener('click',doDeleteAccount);
    logoutBtn.insertAdjacentElement('afterend',b);
  }
  const fp=document.getElementById('footer-privacy-btn');
  if(fp && !document.getElementById('contact-link')){
    const c=document.createElement('button');
    c.id='contact-link';c.className=fp.className;c.style.cssText=fp.getAttribute('style')||'';
    c.textContent='Contact';
    c.addEventListener('click',openContact);
    fp.insertAdjacentElement('afterend',c);
  }
  // Mobile : Pricing/Blog masqués dans la nav (≤480px) → toujours accessibles au footer
  if(fp && !document.getElementById('footer-pricing-link')){
    const mk=(id,href,txt)=>{const a=document.createElement('a');a.id=id;a.href=href;a.textContent=txt;a.style.cssText='margin-left:10px;font-size:12px;color:var(--cy);text-decoration:none';return a;};
    const last=document.getElementById('contact-link')||fp;
    last.insertAdjacentElement('afterend',mk('footer-blog-link','/blog/','Blog'));
    last.insertAdjacentElement('afterend',mk('footer-pricing-link','/pricing','Pricing'));
  }
}

// ── MENU BURGER MOBILE (≤600px, style iLovePDF) ───────────
// La nav complète est cachée sur mobile ; le burger ouvre un panneau
// avec langue, thème, connexion, Pricing, Blog. Injecté par JS → 0 page éditée.
function injectBurger(){
  const nav=document.querySelector('nav');
  if(!nav||document.getElementById('nav-burger'))return;
  const b=document.createElement('button');
  b.id='nav-burger';b.setAttribute('aria-label','Menu');b.setAttribute('aria-expanded','false');
  b.textContent='☰';
  nav.appendChild(b);
  const close=()=>{document.body.classList.remove('nav-open');b.textContent='☰';b.setAttribute('aria-expanded','false');};
  b.addEventListener('click',e=>{
    e.stopPropagation();
    const o=document.body.classList.toggle('nav-open');
    b.textContent=o?'✕':'☰';b.setAttribute('aria-expanded',o?'true':'false');
  });
  document.addEventListener('click',e=>{
    if(!document.body.classList.contains('nav-open'))return;
    if(e.target===b)return;
    // clic sur un lien ou le bouton connexion → ferme ; ailleurs hors panneau → ferme
    if(e.target.closest('.nav-actions a,#auth-btn')||!e.target.closest('.nav-actions'))close();
  });
}

// Appelé automatiquement au chargement de chaque page
(function(){
  try{
    const tool = window.location.pathname.match(/\/tools\/([^./]+)/)?.[1]||null;
    // Mise en page des pages outils : barre horizontale + trust-banner en bas
    relocateTrustBanner();
    renderToolsNav();
    injectBurger();
    initExtras();
    // Grande icône d'en-tête = icône SVG de l'outil (remplace l'emoji)
    const _tid=(location.pathname.match(/\/tools\/([^./]+)/)||[])[1];
    if(_tid){const _big=document.querySelector('.tool-icon-big'); if(_big) _big.innerHTML=toolIconHTML(_tid,64);}
    // Délai pour ne pas bloquer le rendu
    setTimeout(()=>trackPageView(tool), 500);
  }catch{}
})();
