
// ── SECURITY MODULE (inline) ──────────────────────────────
const Security=((()=>{
  const _att={};
  const MAX=5,LOCK=15*60*1000;
  function checkRateLimit(key){
    const now=Date.now();
    if(!_att[key])_att[key]={count:0,firstAt:now,lockedUntil:0};
    const a=_att[key];
    if(a.lockedUntil>now)throw new Error(`Too many attempts. Retry in ${Math.ceil((a.lockedUntil-now)/60000)} min.`);
    if(now-a.firstAt>LOCK){a.count=0;a.firstAt=now;}
    a.count++;
    if(a.count>=MAX){a.lockedUntil=now+LOCK;throw new Error(`Locked 15 min after ${MAX} failed attempts.`);}
  }
  function resetRateLimit(key){delete _att[key];}
  const PDF_MAGIC=[0x25,0x50,0x44,0x46];
  const IMG_MAGICS={jpg:[[0xFF,0xD8,0xFF]],png:[[0x89,0x50,0x4E,0x47]],webp:[[0x52,0x49,0x46,0x46]],bmp:[[0x42,0x4D]]};
  async function validateFile(file,type='pdf'){
    if(file.size>50*1024*1024)throw new Error(`File too large (max 50 MB): ${file.name}`);
    if(file.size===0)throw new Error(`Empty file: ${file.name}`);
    const ext=file.name.split('.').pop().toLowerCase();
    if(type==='pdf'&&ext!=='pdf')throw new Error(`Invalid extension: ${ext}`);
    if(type==='image'&&!['jpg','jpeg','png','webp','bmp'].includes(ext))throw new Error(`Invalid image: ${ext}`);
    const buf=await file.slice(0,12).arrayBuffer();
    const b=new Uint8Array(buf);
    if(type==='pdf'){
      if(!PDF_MAGIC.every((x,i)=>b[i]===x))throw new Error(`${file.name} is not a valid PDF.`);
    }else{
      const re=ext==='jpeg'?'jpg':ext;
      const magics=IMG_MAGICS[re]||[];
      let ok=magics.some(m=>m.every((x,i)=>b[i]===x));
      if(re==='webp'&&ok)ok=[0x57,0x45,0x42,0x50].every((x,i)=>b[8+i]===x);
      if(!ok)throw new Error(`${file.name} is not a valid image.`);
    }
  }
  function validateEmail(v){
    if(!v||!v.trim())throw new Error('Email is required.');
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()))throw new Error('Invalid email address.');
    return v.trim().toLowerCase();
  }
  function sanitizeFilename(n){return(String(n).replace(/[^a-zA-Z0-9._-]/g,'_').replace(/\.{2,}/g,'.').replace(/^[._-]+/,'').substring(0,80))||'file';}
  function sanitizeText(s,max=200){return typeof s==='string'?s.replace(/[<>"'`]/g,'').trim().substring(0,max):'';}
  function checkPasswordStrength(pwd){
    const c={len:pwd.length>=8,up:/[A-Z]/.test(pwd),lo:/[a-z]/.test(pwd),num:/[0-9]/.test(pwd),sym:/[^A-Za-z0-9]/.test(pwd)};
    const score=Object.values(c).filter(Boolean).length;
    return{score,label:score<2?'Weak':score<4?'Medium':'Strong',color:score<2?'#EF4444':score<4?'#F59E0B':'#10B981',ok:score>=3};
  }
  function buildStoragePath(uid,fn){return`${uid}/${crypto.randomUUID()}_${sanitizeFilename(fn)}`;}
  function wipeMemory(d){try{if(d instanceof Uint8Array)d.fill(0);else if(d instanceof ArrayBuffer)new Uint8Array(d).fill(0);}catch(e){}}
  function parsePages(txt,total){
    const s=new Set();
    if(!txt)return s;
    txt.split(',').forEach(p=>{
      p=p.trim();if(!p)return;
      if(p.includes('-')){
        const parts=p.split('-').map(x=>parseInt(x,10));
        if(parts.some(isNaN))return;
        const[a,b]=[Math.min(...parts),Math.max(...parts)];
        for(let i=a;i<=b;i++)s.add(i-1);
      }else{const n=parseInt(p,10);if(!isNaN(n))s.add(n-1);}
    });
    return new Set([...s].filter(i=>i>=0&&i<total));
  }
  // BUG C FIX: escAttr pour attributs onclick en plus de escHtml
  function escHtml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
  function escAttr(s){return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/"/g,'\\"');}
  return{checkRateLimit,resetRateLimit,validateFile,validateEmail,sanitizeFilename,sanitizeText,checkPasswordStrength,buildStoragePath,wipeMemory,parsePages,escHtml,escAttr};
}))();
