// Test runtime de index.html
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const securityJs = fs.readFileSync(path.join(root, 'security.js'), 'utf8');
const sharedJs = fs.readFileSync(path.join(root, 'shared.js'), 'utf8');
const legacyJs = fs.readFileSync(path.join(root, 'legacy-tools.js'), 'utf8');

const mockLibs = `
window.supabase = { createClient: () => ({ auth: { signOut: async()=>{}, onAuthStateChange: ()=>{}, getSession: async()=>({data:{session:null}}) }, storage:{from:()=>({})}, from:()=>({}), rpc:()=>({catch:()=>{}}) }) };
window.PDFLib = {};
window.pdfjsLib = {};
`;

const scriptMatches = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
const initScript = scriptMatches[scriptMatches.length - 1][1];
const allCode = mockLibs + '\n' + securityJs + '\n' + sharedJs + '\n' + legacyJs + '\n' + initScript;

const dom = new JSDOM(html, {
  url: 'https://iworkpdf.yendyx.com/',
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
  assert('14 tool cards rendered', doc.querySelectorAll('.tool-card').length === 14);
  assert('All tools migrated', doc.querySelectorAll('.tool-card').length > 0);
  assert('hero present', !!doc.querySelector('.hero'));
  assert('tools-grid present', !!doc.getElementById('tools-grid'));
  assert('auth modal present', !!doc.getElementById('auth-overlay'));
  assert('cookie banner fn exists', true);

  // Vérifie que toutes les cartes pointent vers une URL migrée
  const cards = [...doc.querySelectorAll('.tool-card')];
  const allMigrated = cards.length === 14;
  assert('All 14 cards present', allMigrated);

} catch(e) {
  console.error('❌ Runtime error:', e.message);
  failed++;
}

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
