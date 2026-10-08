/* 牌局分析（紀錄分頁） */
let SR='all',CH=null;
const sgn=n=>n>0?'+'+n:n<0?'−'+(-n):'0';
const pc=(a,b)=>b?Math.round(a/b*100):null;
// 決定紀錄 d = [街 0–3, 你的動作 f/p/a, 教練的動作 f/p/a, 方向 agg/mid/con, 符合 1/0]
const ERR=[
 {t:'該蓋牌卻跟注',f:d=>d[1]==='p'&&d[2]==='f',adv:'面對下注先算底池賠率，勝率比需要的低就蓋牌；翻牌前不在起手牌表上的牌別跟。'},
 {t:'不該下注卻下注',f:d=>d[1]==='a'&&d[2]!=='a',adv:'下注要有理由：牌夠好（價值下注），或有強聽牌（半詐唬）。牌普通時過牌或跟注就好。'},
 {t:'該下注卻沒下',f:d=>d[1]==='p'&&d[2]==='a',adv:'牌好就要主動下注，讓比你差的牌付錢。好牌只過牌，等於少贏。'},
 {t:'不該蓋牌卻蓋掉',f:d=>d[1]==='f'&&d[2]!=='f',adv:'別太怕：勝率高於底池賠率時，跟注長期是賺的；沒人下注時過牌免費，不要蓋牌。'}
];
const STY=[
 {t:'入池率',d:'翻牌前主動放錢進底池的比例',lo:15,hi:30,
  v:H=>[H.filter(x=>x.vp).length,H.length],low:'很謹慎。在後位（切位、莊家）可以多玩一些牌。',high:'玩太多手牌了，多蓋掉不在起手牌表上的牌。',ok:'入池的手牌數量剛好。'},
 {t:'翻牌前加注率',d:'翻牌前用加注入池的比例',lo:10,hi:25,
  v:H=>[H.filter(x=>x.pr).length,H.length],low:'太常只跟注。決定要玩的牌，多用加注入池。',high:'加注很頻繁，注意牌力是否真的夠好。',ok:'加注的頻率剛好。'},
 {t:'攤牌率',d:'看到翻牌後，打到最後亮牌的比例',lo:20,hi:35,
  v:H=>[H.filter(x=>x.sd).length,H.filter(x=>x.sf).length],low:'常在中途放棄，可能太容易被對手下注嚇跑。',high:'常常打到最後，可能跟注太多了。',ok:'打到最後的比例剛好。'},
 {t:'攤牌勝率',d:'打到亮牌比大小時，贏的比例',lo:50,hi:100,
  v:H=>[H.filter(x=>x.wsd).length,H.filter(x=>x.sd).length],low:'亮牌時常輸，代表跟到最後的牌不夠好。',high:'',ok:'打到最後的牌夠好。'}
];
const POSO=['UTG','HJ','CO','BTN','SB','BB'];

function hbar(lab,a,b,note){
  const v=pc(a,b);
  return `<div class="hb"><span class="hl">${lab}</span><div class="tr">${v==null?'':`<i style="width:${Math.max(v,2)}%"></i>`}</div><span class="hv">${v==null?'—':v+'%'}<small>${b?`${a}/${b}`:'沒有紀錄'}</small></span></div>${note||''}`;
}
function trendSVG(H){
  let c=0;const ys=[0,...H.map(x=>c+=x.net)],n=ys.length-1;
  const W=340,Ht=160,pl=40,pr=12,pt=14,pb=22,mn=Math.min(0,...ys),mx=Math.max(0,...ys),rg=mx-mn||1;
  const X=i=>pl+(W-pl-pr)*i/n,Y=v=>pt+(Ht-pt-pb)*(mx-v)/rg;
  CH={ys,H,W,pl,pr,n,X:ys.map((_,i)=>X(i)),Y:ys.map(Y)};
  const d=ys.map((v,i)=>`${i?'L':'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join('');
  const tick=v=>`<line x1="${pl}" x2="${W-pr}" y1="${Y(v)}" y2="${Y(v)}" class="gl"/><text x="${pl-6}" y="${Y(v)+4}" text-anchor="end" class="ax">${sgn(v)}</text>`;
  const ex=ys[n];
  return `<div class="tc"><svg viewBox="0 0 ${W} ${Ht}" width="100%" role="img" aria-label="籌碼累計輸贏走勢，${H.length} 手後 ${sgn(ex)}" onpointermove="trendHover(event)" onpointerdown="trendHover(event)" onpointerleave="trendOut()">
  ${mx>0?tick(mx):''}${mn<0?tick(mn):''}
  <line x1="${pl}" x2="${W-pr}" y1="${Y(0)}" y2="${Y(0)}" class="zl"/><text x="${pl-6}" y="${Y(0)+4}" text-anchor="end" class="ax">0</text>
  <text x="${pl}" y="${Ht-5}" class="ax">第 ${H[0].no} 手</text><text x="${W-pr}" y="${Ht-5}" text-anchor="end" class="ax">第 ${H[H.length-1].no} 手</text>
  <path d="${d}" class="ln"/>
  <line id="tx" y1="${pt}" y2="${Ht-pb}" class="cx" style="display:none"/>
  <circle cx="${X(n)}" cy="${Y(ex)}" r="4.5" class="dt"/>
  <circle id="td" r="4.5" class="dt" style="display:none"/>
  <rect x="0" y="0" width="${W}" height="${Ht}" fill="transparent"/>
  </svg><div class="tip" id="tt"></div></div>`;
}
function trendHover(e){
  if(!CH)return;const s=e.currentTarget,r=s.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*CH.W;
  const i=Math.max(0,Math.min(CH.n,Math.round((x-CH.pl)/(CH.W-CH.pl-CH.pr)*CH.n)));
  const tx=document.getElementById('tx'),td=document.getElementById('td'),tt=document.getElementById('tt');
  tx.setAttribute('x1',CH.X[i]);tx.setAttribute('x2',CH.X[i]);tx.style.display='';
  td.setAttribute('cx',CH.X[i]);td.setAttribute('cy',CH.Y[i]);td.style.display='';
  const h=CH.H[i-1];
  tt.innerHTML=i?`第 ${h.no} 手（${h.pos} ${POSZ[h.pos]}）<br>這手 <b>${sgn(h.net)}</b>，累計 <b>${sgn(CH.ys[i])}</b>`:'開始：累計 <b>0</b>';
  tt.style.display='block';tt.style.left=Math.min(Math.max(CH.X[i]/CH.W*100,18),82)+'%';
}
function trendOut(){['tx','td','tt'].forEach(k=>{const e=document.getElementById(k);if(e)e.style.display='none'})}
function rngSet(v){SR=v;render()}

function statsH(){
  const P=ST.play,all=ST.hist,f50=SR==='50'&&all.length>50,H=f50?all.slice(-50):all;
  if(!P.hands)return `<p class="muted" style="margin-top:14px">還沒打過牌局。去「牌局」打幾手，這裡就會分析你的勝率和判斷能力。</p><button class="pri full" onclick="go('play')">去打牌局</button>`;
  const D=H.flatMap(x=>x.d);
  const hands=f50?H.length:P.hands,won=f50?H.filter(x=>x.won).length:P.won,net=f50?H.reduce((a,x)=>a+x.net,0):P.net;
  const dc=f50?D.filter(d=>d[4]).length:P.dec.c,dt=f50?D.length:P.dec.t;
  const tile=(l,v,s)=>`<div class="kp"><div class="kl">${l}</div><div class="kv">${v}</div><div class="ks">${s}</div></div>`;
  let h='';
  if(all.length>50)h+=`<div class="seg" style="margin-top:12px"><button class="${f50?'on':''}" onclick="rngSet('50')">最近 50 手</button><button class="${f50?'':'on'}" onclick="rngSet('all')">全部</button></div>`;
  h+=`<div class="kpi">${tile('贏下底池',pc(won,hands)+'%',`${won}／${hands} 手`)}${tile('判斷符合教練',dt?pc(dc,dt)+'%':'—',`${dc}／${dt} 次決定`)}${tile('累計輸贏',sgn(net),'籌碼')}${tile('平均每手',sgn(Math.round(net/hands*10)/10),'籌碼')}</div>`;
  if(!f50&&all.length<P.hands)h+=`<p class="muted" style="margin:8px 0 0">下面的分析從加入統計功能後開始記錄（目前 ${all.length} 手）。</p>`;
  if(H.length<5)return h+`<p class="muted" style="margin-top:14px">再打 ${5-H.length} 手，就能看到詳細分析。</p>`;

  h+=`<div class="lbl" style="margin-top:20px">籌碼走勢</div><p class="cap">每一手打完後的累計輸贏。手指按住圖表左右滑，可以看每一手的結果。</p>${trendSVG(H)}`;

  const st=[0,1,2,3].map(s=>{const x=D.filter(d=>d[0]===s);return [x.filter(d=>d[4]).length,x.length]});
  h+=`<div class="lbl" style="margin-top:20px">各階段的判斷</div><p class="cap">你的決定和教練建議一樣的比例</p>`;
  h+=STN.slice(0,4).map((n,s)=>hbar(n,...st[s])).join('');
  const weak=st.map((x,s)=>({s,v:x[1]>=5?x[0]/x[1]:2})).sort((a,b)=>a.v-b.v)[0];
  if(weak.v<2)h+=`<p class="cap" style="margin-top:6px">${weak.v>=.8?'每個階段都判斷得不錯。':`最需要加強：<b>${STN[weak.s]}</b>。`}</p>`;

  const dk=[['agg','積極時'],['mid','穩健時'],['con','保守時']].map(([k,n])=>{const x=D.filter(d=>d[3]===k);return [n,x.filter(d=>d[4]).length,x.length]});
  h+=`<div class="lbl" style="margin-top:20px">不同局勢的判斷</div><p class="cap">教練建議積極、穩健、保守打法時，你跟上的比例</p>`;
  h+=dk.map(x=>hbar(...x)).join('');
  const dw=dk.filter(x=>x[2]>=5).map(x=>({n:x[0],v:x[1]/x[2]})).sort((a,b)=>a.v-b.v)[0];
  if(dw&&dw.v<.7)h+=`<p class="cap" style="margin-top:6px">教練建議${dw.n.replace('時','')}打法時，你最容易做錯${dw.n.includes('積極')?'：好機會時要敢下注。':dw.n.includes('保守')?'：該放手時要捨得蓋牌。':'：牌不上不下時，過牌或跟注就好，別太衝也別太怕。'}</p>`;

  const bad=D.filter(d=>!d[4]),ec=ERR.map(e=>bad.filter(e.f).length),em=Math.max(1,...ec);
  h+=`<div class="lbl" style="margin-top:20px">最常犯的錯</div>`;
  if(!bad.length)h+=`<p class="muted">目前的決定都和教練建議一樣，很棒！</p>`;
  else{
    h+=ERR.map((e,k)=>`<div class="hb"><span class="hl w">${e.t}</span><div class="tr">${ec[k]?`<i style="width:${ec[k]/em*100}%"></i>`:''}</div><span class="hv">${ec[k]} 次</span></div>`).join('');
    const top=ec.indexOf(Math.max(...ec));
    h+=`<div class="fb" style="margin-top:10px"><b>建議</b>　你最常「${ERR[top].t}」。${ERR[top].adv}</div>`;
  }

  h+=`<div class="lbl" style="margin-top:20px">打法風格</div><p class="cap">淡色區塊是新手在 6 人桌建議的範圍</p>`;
  h+=STY.map(s=>{
    const [a,b]=s.v(H),v=pc(a,b),enough=b>=10;
    const vd=!enough?`再多打幾手才準（目前 ${b} 手）`:v<s.lo?s.low:v>s.hi?s.high:s.ok;
    const tag=!enough?'':v<s.lo?'偏低':v>s.hi?'偏高':'剛好';
    return `<div class="sty"><div class="row"><span>${s.t}<span class="muted">　${s.d}</span></span><span class="sv">${v==null?'—':v+'%'}</span></div>
    <div class="mt"><span class="band" style="left:${s.lo}%;width:${s.hi-s.lo}%"></span>${v==null?'':`<i style="left:${v}%"></i>`}</div>
    <div class="cap">${tag?`<b>${tag}</b>　`:''}${vd}</div></div>`;
  }).join('');

  const ps=POSO.map(p=>{const x=H.filter(y=>y.pos===p);return {p,n:x.length,v:x.reduce((a,y)=>a+y.net,0)}}),pm=Math.max(1,...ps.map(x=>Math.abs(x.v)));
  h+=`<div class="lbl" style="margin-top:20px">各位置的輸贏</div><p class="cap">依翻牌前的行動順序排列。往右是贏、往左是輸</p>`;
  h+=ps.filter(x=>x.n).map(x=>`<div class="dv"><span class="hl">${x.p}<small>${POSZ[x.p]}</small></span><div class="dz">${x.v?`<i class="${x.v>0?'pos':'neg'}" style="width:${Math.abs(x.v)/pm*50}%"></i>`:''}</div><span class="hv">${sgn(x.v)}<small>${x.n} 手</small></span></div>`).join('');
  const nb=ps.filter(x=>x.p!=='SB'&&x.p!=='BB'&&x.n>=3).sort((a,b)=>b.v-a.v);
  h+=`<p class="cap" style="margin-top:6px">盲注位輸錢很正常（每手都被迫先下注），重點是其他位置要贏。${nb.length?`你在 <b>${nb[0].p} ${POSZ[nb[0].p]}</b> 打得最好${nb.length>1&&nb[nb.length-1].v<0?`，在 <b>${nb[nb.length-1].p} ${POSZ[nb[nb.length-1].p]}</b> 輸最多，那個位置可以打緊一點`:''}。`:''}</p>`;
  return h;
}
