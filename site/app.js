const menu=document.querySelector('.menu-toggle');
const sidebar=document.querySelector('#sidebar');
function closeMenu(){sidebar.classList.remove('open');menu.setAttribute('aria-expanded','false');}
menu.addEventListener('click',()=>{const expanded=menu.getAttribute('aria-expanded')!=='true';sidebar.classList.toggle('open',expanded);menu.setAttribute('aria-expanded',String(expanded));});
sidebar.querySelectorAll('a').forEach(a=>a.addEventListener('click',closeMenu));
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu();});
let timer;
document.querySelectorAll('.copy-code').forEach(button=>button.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(button.closest('.code-block').querySelector('code').textContent);const status=document.querySelector('#copy-status');status.textContent='코드를 복사했어요.';status.classList.add('visible');clearTimeout(timer);timer=setTimeout(()=>status.classList.remove('visible'),1800);}catch{button.textContent='직접 선택해 복사하세요';}}));
const tocLinks=[...document.querySelectorAll('.page-toc a')];
const observer=new IntersectionObserver(entries=>{const active=entries.filter(e=>e.isIntersecting).sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top)[0];if(!active)return;tocLinks.forEach(a=>a.classList.toggle('active',decodeURIComponent(a.hash.slice(1))===active.target.id));},{rootMargin:'-70px 0px -65% 0px'});
document.querySelectorAll('article h2').forEach(h=>observer.observe(h));
const themeToggle=document.querySelector('#theme-toggle');
const systemTheme=matchMedia('(prefers-color-scheme: dark)');
let savedTheme;
try { savedTheme=localStorage.getItem('mtls-theme'); } catch {}
let explicitTheme=savedTheme==='light'||savedTheme==='dark';
function updateThemeControl(){
  const dark=document.documentElement.dataset.theme==='dark';
  themeToggle.setAttribute('aria-pressed',String(dark));
  themeToggle.title=dark?'밝은 모드로 전환':'어두운 모드로 전환';
}
updateThemeControl();
const diagrams=[...document.querySelectorAll('.mermaid-diagram')].map(element=>({element,source:element.textContent}));
let mermaidPromise;
let renderQueue=Promise.resolve();
let generation=0;
function renderDiagrams(){
  if(!diagrams.length)return;
  renderQueue=renderQueue.catch(()=>{}).then(async()=>{
    const theme=document.documentElement.dataset.theme;
    const serial=++generation;
    try {
      mermaidPromise??=import('./vendor/mermaid/mermaid.esm.min.mjs');
      const {default:mermaid}=await mermaidPromise;
      mermaid.initialize({startOnLoad:false,securityLevel:'strict',theme:theme==='dark'?'dark':'neutral',look:'classic',fontFamily:'-apple-system, BlinkMacSystemFont, sans-serif'});
      for(const[i,{element,source}]of diagrams.entries()){
        const result=await mermaid.render(`diagram-${serial}-${i}`,source);
        element.innerHTML=result.svg;
        element.removeAttribute('aria-busy');
      }
    } catch {
      diagrams.forEach(({element,source})=>{element.textContent=source;element.classList.add('diagram-fallback');element.removeAttribute('aria-busy');});
    }
  });
}
themeToggle.addEventListener('click',()=>{
  const mode=document.documentElement.dataset.theme==='dark'?'light':'dark';
  document.documentElement.dataset.theme=mode;
  explicitTheme=true;
  try { localStorage.setItem('mtls-theme',mode); } catch {}
  updateThemeControl();
  renderDiagrams();
});
systemTheme.addEventListener('change',event=>{
  if(explicitTheme)return;
  document.documentElement.dataset.theme=event.matches?'dark':'light';
  updateThemeControl();
  renderDiagrams();
});
renderDiagrams();
