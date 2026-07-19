// ============================================================
//  iWorkPDF — pdf-security.js (outil Security : protéger / déverrouiller)
//  Nommé différemment de security.js (module de sécurité générique)
//  pour éviter toute confusion. Charger APRÈS security.js et shared.js.
//
//  ── Vrai chiffrement 100% local via qpdf-wasm ──
//  pdf-lib ne sait pas chiffrer. On utilise QPDF compilé en WebAssembly
//  (@neslinesli93/qpdf-wasm) qui tourne entièrement dans le navigateur :
//  aucun upload, parité iLovePDF, AES-256 réel.
//  Le module (~1.3 Mo) est chargé une seule fois depuis le CDN puis mis
//  en cache par le Service Worker (offline OK après le 1er usage).
//
//  Note: cet outil n'a pas de buildXxxUI() dédiée — son HTML est généré
//  inline dans buildUI() (shared.js).
// ============================================================

// AUTO-HÉBERGÉ dans /vendor/qpdf/ (plus de dépendance CDN — cohérent avec
// le "100% local", et le CDN posait 2 problèmes : le dist n'expose PAS
// window.createModule (il expose window.Module, d'où l'échec systématique
// "Check your connection"), et certains réseaux bloquent jsdelivr.
const QPDF_JS   = '/vendor/qpdf/qpdf.js';
const QPDF_WASM = '/vendor/qpdf/qpdf.wasm';

// Charge le glue-script qpdf.js une seule fois. Le dist Emscripten (UMD)
// expose la factory sous window.Module (var top-level du script classique).
let _qpdfScriptPromise = null;
let _qpdfFactory = null;
function loadQpdfScript(){
  if(_qpdfFactory) return Promise.resolve(_qpdfFactory);
  if(_qpdfScriptPromise) return _qpdfScriptPromise;
  _qpdfScriptPromise = new Promise((res, rej)=>{
    const s = document.createElement('script');
    s.src = QPDF_JS;
    s.onload = ()=>{
      const f = window.createModule || window.Module;
      if(typeof f === 'function'){ _qpdfFactory = f; res(f); }
      else rej(new Error('qpdf: factory introuvable après chargement'));
    };
    s.onerror = ()=> rej(new Error('qpdf: échec du chargement du script'));
    document.head.appendChild(s);
  });
  return _qpdfScriptPromise;
}

// Instancie une NOUVELLE instance qpdf à chaque opération.
// qpdf appelle exit() après callMain → le runtime Emscripten est marqué
// terminé et ne peut pas être réutilisé. On repart donc d'une instance
// fraîche (le .wasm est déjà en cache HTTP/SW, donc c'est rapide).
async function createQpdf(onStderr){
  const factory = await loadQpdfScript();
  return factory({
    locateFile: ()=> QPDF_WASM,
    noInitialRun: true,
    print: ()=>{},
    printErr: (msg)=>{ if(onStderr) onStderr(String(msg)); },
  });
}

// runSecurity(activeFiles, secMode, pwd) -> {result, filename} | null
async function runSecurity(activeFiles, secMode, pwd){
  if(!pwd){ earlyReturn(t('nopwd')); return null; }

  setProgress(15, lang==='fr' ? 'Chargement du module de chiffrement…'
                              : 'Loading encryption module…');
  let mod, stderr = '';
  try{
    mod = await createQpdf(s => { stderr += s + '\n'; });
  }catch(e){
    earlyReturn(lang==='fr'
      ? 'Impossible de charger le module de chiffrement (rechargez la page et réessayez).'
      : 'Could not load the encryption module (reload the page and try again).');
    return null;
  }
  setProgress(40, lang==='fr' ? 'Module chargé ✓' : 'Module loaded ✓');

  const IN = '/in.pdf', OUT = '/out.pdf';
  setProgress(48, lang==='fr' ? 'Lecture du fichier…' : 'Reading file…');
  const buf = await activeFiles[0].arrayBuffer();
  try{ mod.FS.writeFile(IN, new Uint8Array(buf)); }
  catch(e){ Security.wipeMemory(buf); earlyReturn('FS error: ' + e.message); return null; }
  Security.wipeMemory(buf);

  // qpdf reçoit argv SANS argv[0] (le nom du programme est implicite).
  // Protéger : chiffrement AES-256, mot de passe utilisateur = propriétaire.
  // Déverrouiller : retire la protection en fournissant le mot de passe actuel.
  const args = secMode === 'protect'
    ? ['--encrypt', pwd, pwd, '256', '--', IN, OUT]
    : ['--password=' + pwd, '--decrypt', IN, OUT];

  setProgress(55, lang==='fr'
    ? (secMode==='protect' ? 'Chiffrement…' : 'Déverrouillage…')
    : (secMode==='protect' ? 'Encrypting…'  : 'Unlocking…'));

  let code = 0;
  try{ code = mod.callMain(args); }
  catch(e){ code = (e && typeof e.status === 'number') ? e.status : 1; }
  setProgress(85, lang==='fr' ? 'Finalisation…' : 'Finalizing…');

  let out = null;
  try{ out = mod.FS.readFile(OUT); }catch(_){ out = null; }
  try{ mod.FS.unlink(IN); }catch(_){}
  try{ mod.FS.unlink(OUT); }catch(_){}

  // qpdf : code 0 = OK, 3 = OK avec warnings, 2 = erreur.
  if(!out || out.length === 0 || (code && code !== 3)){
    if(secMode === 'unlock'){
      earlyReturn(lang==='fr'
        ? "Mot de passe incorrect, ou ce PDF n'est pas protégé."
        : 'Wrong password, or this PDF is not protected.');
    }else{
      const already = /already encrypted|is encrypted/i.test(stderr);
      earlyReturn(already
        ? (lang==='fr' ? "Ce PDF est déjà protégé. Déverrouillez-le d'abord."
                       : 'This PDF is already protected. Unlock it first.')
        : (lang==='fr' ? 'Échec de la protection du PDF.' : 'Failed to protect the PDF.'));
    }
    return null;
  }

  const base = activeFiles[0].name.replace(/\.pdf$/i, '');
  const filename = secMode === 'protect'
    ? base + '_protected.pdf'
    : base + '_unlocked.pdf';
  return { result: new Uint8Array(out), filename };
}
