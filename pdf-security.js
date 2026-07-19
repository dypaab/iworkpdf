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

const QPDF_VERSION = '0.3.0';
const QPDF_JS   = `https://cdn.jsdelivr.net/npm/@neslinesli93/qpdf-wasm@${QPDF_VERSION}/dist/qpdf.js`;
const QPDF_WASM = `https://cdn.jsdelivr.net/npm/@neslinesli93/qpdf-wasm@${QPDF_VERSION}/dist/qpdf.wasm`;

// Charge le glue-script qpdf.js une seule fois (expose window.createModule).
let _qpdfScriptPromise = null;
function loadQpdfScript(){
  if(window.createModule) return Promise.resolve();
  if(_qpdfScriptPromise) return _qpdfScriptPromise;
  _qpdfScriptPromise = new Promise((res, rej)=>{
    const s = document.createElement('script');
    s.src = QPDF_JS;
    s.onload = ()=> window.createModule ? res()
      : rej(new Error('qpdf: createModule introuvable après chargement'));
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
  await loadQpdfScript();
  return window.createModule({
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
      ? 'Impossible de charger le module de chiffrement. Vérifiez votre connexion.'
      : 'Could not load the encryption module. Check your connection.');
    return null;
  }

  const IN = '/in.pdf', OUT = '/out.pdf';
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
