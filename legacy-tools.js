// ============================================================
//  iWorkPDF — legacy-tools.js
//  TOUS les outils ont maintenant leur page dédiée (/tools/*.html).
//  Ce fichier ne contient plus que les déclarations d'état des outils,
//  chargé par index.html pour que le dispatch générique run() dans
//  shared.js puisse référencer ces variables de façon défensive.
//  Peut être supprimé à terme quand index.html aura son propre JS minimal.
// ============================================================

// État merge
let mergePages = [];
let dragSrc = null;

// État delete/rotate (migrés, gardés ici pour défense dans run() partagé)
let deleteSelectedPages=new Set();
let rotatePageAngles={};
let rotateSelected=new Set();

// État split
let splitSelectedPages=new Set();

// État img2pdf
let imgDragSrc=null;

// État pagenums
let pnPos='bc', pnFmt='num';

// État pdf2jpg
let jpgQuality=0.9;

// État sign
let signDrawing=false, signCtx=null, signPos='br';
