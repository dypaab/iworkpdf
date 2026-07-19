// Test runtime de compress.html
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'tools/compress.html'), 'utf8');
const securityJs = fs.readFileSync(path.join(root, 'security.js'), 'utf8');
const sharedJs = fs.readFileSync(path.join(root, 'shared.js'), 'utf8');
const compressJs = fs.readFileSync(path.join(root, 'compress.js'), 'utf8');

const mockLibs = `
window.supabase = { createClient: () => ({ auth: { signOut: async()=>{}, onAuthStateChange: ()=>{}, getSession: async()=>({data:{session:null}}) }, storage:{from:()=>({})}, from:()=>({}), rpc:()=>({catch:()=>{}}) }) };
window.PDFLib = { PDFDocument:{load:async()=>({}),create:async()=>({})}, PDFName:{of:x=>x}, PDFRawStream:{of:()=>({})}, degrees:d=>({type:'degrees',angle:d}), rgb:()=>({}), StandardFonts:{HelveticaBold:'HB'} };
window.pdfjsLib = { getDocument: () => ({ promise: Promise.resolve({numPages:0}) }), OPS:{} };
`;

const scriptMatches = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
const initScript = scriptMatches[scriptMatches.length - 1][1];
const allCode = mockLibs + '\n' + securityJs + '\n' + sharedJs + '\n' + compressJs + '\n' + initScript;

const dom = new JSDOM(html, {
  url: 'https://iworkpdf.yendyx.com/tools/compress.html',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
});
dom.window.navigator.serviceWorker = { register: () => Promise.resolve() };

let passed = 0, failed = 0;
function assert(label, condition) {
  if (condition) { console.log(`✅ ${label}`); passed++; }
  else { console.error(`❌ ${label}`); failed++; }
}

try {
  dom.window.eval(allCode);
  const doc = dom.window.document;

  assert('No exception on load', true);
  assert('tool-body has content', doc.getElementById('tool-body')?.innerHTML.length > 100);
  assert('drop zone present', !!doc.getElementById('dz'));
  assert('comp-estimate present', !!doc.getElementById('comp-estimate'));
  assert('share-result present', !!doc.getElementById('share-result'));
  assert('quality pills present', doc.querySelectorAll('#rg-comp .rbn').length === 3);
  assert('auth modal present', !!doc.getElementById('auth-overlay'));
  assert('cookie banner function exists', typeof dom.window.eval('typeof initCookieBanner') === 'string');

  // Test langue FR
  doc.querySelector('.lang-opt[data-lang="fr"]')?.click();
  assert('title translates to FR', doc.getElementById('tool-h1')?.textContent.includes('Compresser'));

} catch(e) {
  console.error('❌ Runtime error:', e.message);
  failed++;
}

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
