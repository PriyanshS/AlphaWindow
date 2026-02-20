/* ═══════════════════════════════════════════════════════
   ALPHAWINDOW — Shared JS Engine
   Works across all separate HTML pages via localStorage
   for currentTicker state.
═══════════════════════════════════════════════════════ */

/* ── CURRENT TICKER ───────────────────────────────── */
function getTicker(){ return localStorage.getItem('aw_ticker')||'NVDA'; }
function setTicker(t){
  localStorage.setItem('aw_ticker',t);
  document.querySelectorAll('.g-ticker').forEach(el=>el.textContent=t);
}

/* ── ASSETS ────────────────────────────────────────── */
const ASSETS=[
  {t:'NVDA',n:'NVIDIA Corporation',s:'Technology',i:'NV'},
  {t:'TSLA',n:'Tesla, Inc.',s:'Automotive',i:'TS'},
  {t:'AAPL',n:'Apple Inc.',s:'Technology',i:'AP'},
  {t:'MSFT',n:'Microsoft Corporation',s:'Technology',i:'MS'},
  {t:'AMZN',n:'Amazon.com, Inc.',s:'Consumer',i:'AM'},
  {t:'META',n:'Meta Platforms',s:'Technology',i:'ME'},
  {t:'GOOG',n:'Alphabet Inc.',s:'Technology',i:'GO'},
  {t:'BTC', n:'Bitcoin',s:'Crypto',i:'BT'},
  {t:'ETH', n:'Ethereum',s:'Crypto',i:'ET'},
  {t:'AMD', n:'Advanced Micro Devices',s:'Technology',i:'AD'},
];
window.ASSETS=ASSETS;

const BASE={NVDA:875.50,TSLA:248.30,AAPL:189.90,MSFT:415.20,AMZN:192.75,META:530.40,GOOG:173.80,BTC:67250,ETH:3820,AMD:178.90};

/* ── DATA GENERATION ───────────────────────────────── */
const _cache={};
function getData(t){
  if(_cache[t]) return _cache[t];
  const base=BASE[t]||100;
  const vol=(t==='BTC'||t==='ETH')?0.009:0.003;
  const prices=[]; const now=Date.now();
  let p=base*(0.93+Math.random()*.1), trend=(Math.random()-.48)*.001;
  for(let i=96;i>=0;i--){
    const ts=now-i*300000;
    trend=trend*.95+(Math.random()-.5)*.0002;
    const d=trend+(Math.random()-.5)*vol;
    p=Math.max(p*(1+d),base*.6);
    const o=p, c=p*(1+(Math.random()-.5)*vol*.5);
    prices.push({ts,o,h:Math.max(o,c)*(1+Math.random()*vol*.3),l:Math.min(o,c)*(1-Math.random()*vol*.3),c,v:Math.floor(Math.random()*5e6+5e5)});
    p=c;
  }
  const sentiment=prices.map((bar,i)=>{
    const ahead=Math.min(i+Math.floor(Math.random()*3+1),prices.length-1);
    const ld=(prices[ahead].c-bar.c)/bar.c;
    const sc=Math.max(-1,Math.min(1,ld*40+(Math.random()-.5)*.3));
    const bp=Math.max(0,Math.min(100,50+sc*40+(Math.random()-.5)*8));
    return {ts:bar.ts,score:sc,bull_pct:bp,bear_pct:100-bp};
  });
  const last=prices[prices.length-1], prev=prices[prices.length-2];
  const chg=last.c-prev.c, chgp=(chg/prev.c)*100;
  const sv=sentiment[sentiment.length-1];
  const pearson=+((0.4+Math.random()*0.45).toFixed(3));
  const sig=sv.score>.15?'BULLISH':sv.score<-.15?'BEARISH':'NEUTRAL';
  _cache[t]={t,prices,sentiment,
    headlines:makeHeadlines(t),social:makeSocial(t),heatmap:makeHeatmap(),
    sum:{price:+last.c.toFixed(2),chg:+chg.toFixed(2),chgp:+chgp.toFixed(2),
         v:last.v,pearson,lag:+(Math.random()*5+.5).toFixed(1),
         sc:+sv.score.toFixed(3),bp:+sv.bull_pct.toFixed(1),sig,
         h24:+Math.max(...prices.slice(-8).map(p=>p.h)).toFixed(2),
         l24:+Math.min(...prices.slice(-8).map(p=>p.l)).toFixed(2)}};
  return _cache[t];
}
window.getData=getData;

/* ── HEADLINE TEMPLATES ────────────────────────────── */
const HL_TPL={
  NVDA:[
    {h:'NVIDIA GPU demand surges as AI infrastructure spending accelerates',s:.82,src:'Bloomberg'},
    {h:'Data center revenue beats estimates — H100 backlog extends into Q3',s:.76,src:'Reuters'},
    {h:'Jensen Huang: "We are at the iPhone moment of AI computing"',s:.71,src:'CNBC'},
    {h:'NVIDIA faces export restriction headwinds in key Asian markets',s:-.58,src:'WSJ'},
    {h:'Blackwell architecture launch could redefine inference economics',s:.65,src:'TechCrunch'},
    {h:'Short interest in NVDA spikes amid stretched valuation concerns',s:-.44,src:'FT'},
    {h:'Q2 preview: Wall Street sets high bar for AI chipmaker earnings',s:.30,src:"Barron's"},
    {h:'NVIDIA partners with sovereign AI programs across six nations',s:.55,src:'Bloomberg'},
  ],
  TSLA:[
    {h:'Tesla FSD 12.4 shows dramatic improvement in edge case scenarios',s:.70,src:'Electrek'},
    {h:'Delivery numbers miss estimates — production ramp slower than expected',s:-.65,src:'Reuters'},
    {h:'Elon Musk hints at Robotaxi launch date at shareholder event',s:.60,src:'Bloomberg'},
    {h:'Tesla price cuts pressure margins across all vehicle lines',s:-.52,src:'WSJ'},
    {h:'Energy division surpasses auto revenue for the first time',s:.68,src:'FT'},
    {h:'Cybertruck reservation cancellations exceed analyst projections',s:-.45,src:'CNBC'},
    {h:'Full autonomy timeline pulled forward as regulatory clarity improves',s:.58,src:'Bloomberg'},
    {h:'Q2 margins to face pressure from aggressive global pricing strategy',s:-.38,src:'Reuters'},
  ],
  DEFAULT:[
    {h:'Earnings beat consensus by 8% — full-year guidance raised',s:.70,src:'Bloomberg'},
    {h:'Institutional ownership increases — Goldman initiates with Buy',s:.60,src:'Reuters'},
    {h:'Management shakeup raises questions about strategic direction',s:-.55,src:'WSJ'},
    {h:'Market share gains in core business driving analyst upgrades',s:.65,src:'CNBC'},
    {h:'Regulatory headwind intensifies — DOJ inquiry formally confirmed',s:-.60,src:'FT'},
    {h:'Activist investor discloses 5% stake, pushes for board changes',s:.35,src:'Bloomberg'},
    {h:'Free cash flow generation hits record high, buyback expanded',s:.72,src:"Barron's"},
    {h:'Supply chain disruption threatens next quarter production targets',s:-.48,src:'Reuters'},
  ]
};
function makeHeadlines(t){
  const tp=HL_TPL[t]||HL_TPL.DEFAULT, now=Date.now();
  return tp.map((h,i)=>({
    id:`hl_${t}_${i}`,ts:now-(i*2.5+Math.random()*1.5)*3600000,
    headline:h.h,sentiment:h.s+(Math.random()-.5)*.08,
    source:h.src,lag:+(Math.random()*4+.5).toFixed(1),
    tags:[h.s>.2?'bullish':h.s<-.2?'bearish':'neutral','fundamental','macro']
  }));
}
function makeSocial(t){
  const now=Date.now();
  return [
    {txt:`$${t} breaking out of that triangle — target +18% if holds above resistance`,s:.75,plt:'X',usr:'@quant_alpha',fol:42300},
    {txt:`Loaded up on $${t} calls into earnings. Risk/reward is exceptional here`,s:.65,plt:'X',usr:'@options_desk',fol:28100},
    {txt:`$${t} thesis is broken. Exit before the real pain starts`,s:-.80,plt:'Reddit',usr:'u/ValueHunter',up:1240},
    {txt:`Institutional block in $${t} — 500k shares at market. Somebody knows something`,s:.55,plt:'X',usr:'@tape_reader',fol:15600},
    {txt:`$${t} short interest at 18-month high. Squeeze incoming or smart money knows`,s:.20,plt:'Reddit',usr:'u/WSB_Prophet',up:3280},
    {txt:`PCE + $${t} earnings = catalyst stack. Staying long over the event`,s:.60,plt:'X',usr:'@macro_edge',fol:89200},
    {txt:`$${t} chart looks like a disaster. H&S on the weekly. Not touching this`,s:-.70,plt:'X',usr:'@chart_surgeon',fol:34100},
    {txt:`Added to my $${t} position on this dip. Conviction unchanged`,s:.55,plt:'Reddit',usr:'u/LongOnlyMike',up:876},
    {txt:`$${t} went dark on social. Usually precedes a major announcement`,s:.40,plt:'X',usr:'@alt_data',fol:12400},
    {txt:`Rotation out of $${t} into bonds accelerating. Risk-off signal`,s:-.40,plt:'X',usr:'@flows_watch',fol:22800},
  ].map((p,i)=>({...p,id:`s_${t}_${i}`,ts:now-(i*1.2+Math.random()*.8)*3600000}));
}
function makeHeatmap(){
  const d=[], now=Date.now();
  for(let day=6;day>=0;day--)
    for(let h=0;h<24;h++){
      const ts=now-day*86400000-(23-h)*3600000;
      const mkt=h>=9&&h<=16;
      const int=Math.min(5,mkt?Math.floor(Math.random()*4)+(Math.random()>.5?1:0):Math.floor(Math.random()*3));
      d.push({ts,day,h,int});
    }
  return d;
}

/* ── FORMATTERS ────────────────────────────────────── */
const f=(n,d=2)=>n==null?'—':n.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
const fp=n=>`${n>=0?'+':''}${n.toFixed(2)}%`;
const fv=v=>v>=1e9?`${(v/1e9).toFixed(1)}B`:v>=1e6?`${(v/1e6).toFixed(1)}M`:v>=1e3?`${(v/1e3).toFixed(0)}K`:v;
const ft=ts=>new Date(ts).toLocaleTimeString('en-US',{hour12:false,hour:'2-digit',minute:'2-digit'});
const fd=ts=>new Date(ts).toLocaleDateString('en-US',{month:'short',day:'numeric'});
const sc=s=>s>.15?'bull':s<-.15?'bear':'neu';
const sl=s=>s>.5?'STRONG BULL':s>.15?'BULLISH':s<-.5?'STRONG BEAR':s<-.15?'BEARISH':'NEUTRAL';
window.f=f; window.fp=fp; window.fv=fv; window.ft=ft; window.fd=fd; window.sc=sc; window.sl=sl;

/* ── SPARKLINE CANVAS ──────────────────────────────── */
function spark(canvas,data,opts={}){
  if(!canvas||!data||data.length<2) return;
  const {color='#c5a059',fill=.15,lw=1.5,grid=false,type='line'}=opts;
  const dpr=window.devicePixelRatio||1;
  const r=canvas.getBoundingClientRect();
  if(!r.width) return;
  canvas.width=r.width*dpr; canvas.height=r.height*dpr;
  const ctx=canvas.getContext('2d'); ctx.scale(dpr,dpr);
  const W=r.width,H=r.height,pd=3;
  const mn=Math.min(...data),mx=Math.max(...data),rng=mx-mn||1;
  const tx=i=>pd+i*(W-pd*2)/(data.length-1);
  const ty=v=>H-pd-((v-mn)/rng)*(H-pd*2);
  ctx.clearRect(0,0,W,H);
  if(grid){
    ctx.strokeStyle='rgba(197,160,89,0.06)';ctx.lineWidth=1;
    [0,1,2,3].forEach(g=>{const y=pd+(H-pd*2)*(g/3);ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();});
  }
  if(type==='bar'){
    const bw=Math.max(1,(W-pd*2)/data.length-.8);
    data.forEach((v,i)=>{
      const bh=((v-mn)/rng)*(H-pd*2);
      ctx.fillStyle=color+'55';
      ctx.fillRect(tx(i)-bw/2,H-pd-bh,bw,bh);
    }); return;
  }
  const g2=ctx.createLinearGradient(0,0,0,H);
  const fh=Math.floor(fill*255).toString(16).padStart(2,'0');
  g2.addColorStop(0,color+fh); g2.addColorStop(.7,color+'0a'); g2.addColorStop(1,color+'00');
  ctx.beginPath(); ctx.moveTo(tx(0),ty(data[0]));
  data.forEach((v,i)=>{if(i>0)ctx.lineTo(tx(i),ty(v));});
  ctx.lineTo(tx(data.length-1),H); ctx.lineTo(tx(0),H); ctx.closePath();
  ctx.fillStyle=g2; ctx.fill();
  ctx.beginPath(); ctx.moveTo(tx(0),ty(data[0]));
  data.forEach((v,i)=>{if(i>0)ctx.lineTo(tx(i),ty(v));});
  ctx.strokeStyle=color; ctx.lineWidth=lw; ctx.lineJoin='round'; ctx.stroke();
  ctx.beginPath(); ctx.arc(tx(data.length-1),ty(data[data.length-1]),3,0,Math.PI*2);
  ctx.fillStyle=color; ctx.fill();
}
window.spark=spark;

/* ── TEMPORAL CURSOR ───────────────────────────────── */
const TC={panels:[],
  reg(el){
    if(!el) return;
    this.panels.push(el);
    el.addEventListener('mousemove',e=>this.mv(e,el));
    el.addEventListener('mouseleave',()=>this.hide());
  },
  mv(e,src){
    const r=src.getBoundingClientRect();
    const rx=(e.clientX-r.left)/r.width;
    const ts=this.rx2ts(rx,src);
    this.show(ts);
  },
  rx2ts(rx,el){
    const s=+(el.dataset.ts0||(Date.now()-8*36e5));
    const e2=+(el.dataset.ts1||Date.now());
    return s+rx*(e2-s);
  },
  ts2rx(ts,el){
    const s=+(el.dataset.ts0||(Date.now()-8*36e5));
    const e2=+(el.dataset.ts1||Date.now());
    return Math.max(0,Math.min(1,(ts-s)/(e2-s)));
  },
  show(ts){
    this.panels.forEach(el=>{
      let cur=el.querySelector('.tcursor');
      if(!cur){
        cur=document.createElement('div'); cur.className='tcursor';
        const tip=document.createElement('div'); tip.className='ttip';
        cur.appendChild(tip); el.appendChild(cur);
      }
      const rx=this.ts2rx(ts,el);
      const w=el.getBoundingClientRect().width;
      cur.style.left=`${rx*w}px`; cur.classList.add('on');
      const tip=cur.querySelector('.ttip');
      if(tip){tip.textContent=ft(ts); tip.style.left=`${rx*w}px`;}
      el.querySelectorAll('[data-ts]').forEach(item=>{
        item.dataset.hi=Math.abs(+item.dataset.ts-ts)<1800000?'1':'0';
      });
    });
  },
  hide(){
    this.panels.forEach(el=>{
      const c=el.querySelector('.tcursor'); if(c)c.classList.remove('on');
      el.querySelectorAll('[data-ts]').forEach(i=>i.dataset.hi='0');
    });
  }
};
window.TC=TC;

/* ── CLOCK ─────────────────────────────────────────── */
function startClock(){
  const el=document.getElementById('nav-clk');
  if(!el) return;
  const u=()=>{
    const n=new Date();
    el.textContent=`NYSE ${n.toLocaleTimeString('en-US',{hour12:false})} ET`;
  };
  u(); setInterval(u,1000);
}
window.startClock=startClock;

/* ── LIVE TICK ──────────────────────────────────────── */
function startTick(onTick){
  setInterval(()=>{
    ASSETS.forEach(a=>{
      if(!_cache[a.t]) return;
      const d=_cache[a.t];
      const last=d.prices[d.prices.length-1];
      const prev=d.prices[d.prices.length-2];
      const nc=+(last.c*(1+(Math.random()-.495)*.002)).toFixed(2);
      d.prices[d.prices.length-1].c=nc;
      d.sum.price=nc;
      d.sum.chg=+(nc-prev.c).toFixed(2);
      d.sum.chgp=+((nc-prev.c)/prev.c*100).toFixed(2);
      if(onTick) onTick(a.t, d.sum);
    });
  },2500);
}
window.startTick=startTick;

/* ── NAV ACTIVE STATE ───────────────────────────────── */
function setNavActive(page){
  document.querySelectorAll('.nav-a').forEach(a=>{
    a.classList.toggle('active', a.dataset.page===page);
  });
}
window.setNavActive=setNavActive;

/* ── SHARED NAV HTML BUILDER ────────────────────────── */
function buildNav(activePage){
  const ticker=getTicker();
  return `
  <nav class="nav">
    <a class="nav-logo" href="AlphaWindow.html">⬡ AlphaWindow</a>
    <div class="nav-links">
      <a class="nav-a ${activePage==='dash'?'active':''}" href="AlphaWindow.html" data-page="dash">Command</a>
      <a class="nav-a ${activePage==='market'?'active':''}" href="market.html" data-page="market">Ticker Lab</a>
      <a class="nav-a ${activePage==='social'?'active':''}" href="social.html" data-page="social">Social Pulse</a>
      <a class="nav-a ${activePage==='media'?'active':''}" href="media.html" data-page="media">Media Oracle</a>
    </div>
    <div class="nav-r">
      <div class="ws-pill"><div class="ws-dot"></div>MOCK</div>
      <span class="nav-pill g-ticker">${ticker}</span>
      <div class="nav-dot"></div>
      <span class="nav-clk" id="nav-clk">NYSE 09:30:00 ET</span>
    </div>
  </nav>`;
}
window.buildNav=buildNav;
