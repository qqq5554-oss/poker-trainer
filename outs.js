/* Outs 練習（勝率分頁） */
let EQM='calc',OQ=null;
const OKIND=['flush','oe','gut','combo'];
const OKN={flush:'同花聽牌',oe:'兩頭順子聽牌',gut:'卡順',combo:'同花＋順子聽牌'};
const OSTEP=['看牌型','數 outs','乘 2 或 4','算底池賠率','做決定'];
const cn=c=>`${SU[c&3]}${rd(c>>2)}`;

// 只算「下一張成同花或順子」的 outs；目前要是高牌或一對，公共牌自己成牌的不算
function outsInfo(h,b){
  const kn=[...h,...b];if(catOf(ev(kn))>=2)return null;
  const sc=[0,0,0,0];let rm=0;kn.forEach(c=>{sc[c&3]++;rm|=1<<(c>>2)});
  if(sh(rm)>=0)return null;
  const fl=[],st=[];
  for(let c=0;c<52;c++){
    if(kn.includes(c))continue;
    const f=sc[c&3]>=4,s=sh(rm|1<<(c>>2))>=0;if(!f&&!s)continue;
    const nb=[...b,c];if(nb.length>=5&&catOf(ev(nb))>=4)continue;
    if(f)fl.push(c);if(s)st.push(c);
  }
  const ranks=[...new Set(st.map(c=>c>>2))].sort((a,b)=>a-b);
  if(ranks.length>2)return null;
  const kind=fl.length&&ranks.length?'combo':fl.length?'flush':ranks.length===2?'oe':ranks.length===1?'gut':null;
  if(!kind)return null;
  const fs=fl.length?fl[0]&3:-1,ov=fl.filter(c=>st.includes(c));
  return {kind,fl,st,ov,ranks,fs,seen:fs<0?0:sc[fs],hs:fs<0?0:h.filter(c=>(c&3)===fs).length,outs:[...new Set([...fl,...st])].length};
}
function newOQ(){
  const want=OKIND[rnd(4)],turn=Math.random()<.4,nb=turn?4:3;let q=null;
  for(let k=0;k<30000&&!q;k++){
    const d=deal(2+nb),h=d.slice(0,2),b=d.slice(2);
    if(new Set(b.map(c=>c>>2)).size<nb)continue;
    const o=outsInfo(h,b);if(o&&o.kind===want)q=Object.assign({h,b},o);
  }
  if(!q)return newOQ();
  const n=q.outs,allin=!turn&&Math.random()<.4,mult=!turn&&allin?4:2,est=Math.min(n*mult,100);
  const exact=Math.round((turn?n/46:allin?1-(47-n)*(46-n)/(47*46):n/47)*1000)/10;
  let P,B,need;
  for(let k=0;k<50;k++){
    P=(2+rnd(9))*10;B=Math.max(2,Math.round(P*[1/3,1/2,2/3,1,1.5][rnd(5)]));need=Math.round(B/(P+2*B)*100);
    if(Math.abs(est-need)>=4)break;
  }
  // 第 2 步的選項：正確答案加上常見錯誤
  const oc=new Set([n]);
  if(q.fl.length)oc.add(13);
  if(q.kind==='combo'){oc.add(q.fl.length+q.st.length);oc.add(q.fl.length)}
  if(q.kind==='oe')oc.add(4);if(q.kind==='gut')oc.add(8);
  for(const x of [8,9,4,12,15,6,2])if(oc.size<4)oc.add(x);
  // 第 4 步的選項
  const pc=new Set([need,Math.min(95,Math.round(B/P*100)),Math.round(B/(P+B)*100)]);
  for(const x of [need+10,need-10,need+20])if(pc.size<4&&x>0&&x<100)pc.add(x);
  OQ=Object.assign(q,{turn,allin,mult,n,est,exact,P,B,need,T:P+2*B,step:0,ans:[],
    opts:[[OKN.flush,OKN.oe,OKN.gut,OKN.combo],[...oc].sort((a,b)=>a-b),['×2','×4'],[...pc].sort((a,b)=>a-b),['跟注','蓋牌']]});
}
function oRight(i){const q=OQ;return [OKIND.indexOf(q.kind),q.opts[1].indexOf(q.n),q.mult===4?1:0,q.opts[3].indexOf(q.need),q.est>=q.need?0:1][i]}
function oAns(k){const q=OQ;if(q.ans[q.step]!=null)return;q.ans[q.step]=k;rec('outs',k===oRight(q.step));render()}
function oNext(){OQ.step++;render();window.scrollTo(0,0)}
function oNew(){newOQ();render();window.scrollTo(0,0)}

function oExplain(i){
  const q=OQ,mini=a=>`<div class="cards mini ow">${a.map(c=>cardH(c)).join('')}</div>`,rs=q.ranks.map(rd);
  const cur=handName(ev([...q.h,...q.b]));
  if(i===0){
    const f=`你的 ${SU[q.fs]} 有 4 張（手牌 ${q.hs} 張、公共牌 ${q.seen-q.hs} 張）。同花要 5 張同花色，再來一張 ${SU[q.fs]} 就成了，這叫「同花聽牌」。`;
    const s=q.ranks.length===2?`再來一張 ${rs[0]} 或 ${rs[1]}，就能湊成 5 張連續的順子。兩種點數都可以，這叫「兩頭順子聽牌」。`:`只有再來一張 ${rs[0]} 才能湊成順子，只有一種點數能幫你，這叫「卡順」（缺中間一張，或是只能往一邊接）。機會比兩頭少一半。`;
    return `<p>你現在只有「${cur}」，還不夠強，要靠下一張牌。</p><p>${q.fl.length?f:''}${q.fl.length&&q.ranks.length?'<br>':''}${q.ranks.length?s:''}</p>${q.kind==='combo'?'<p>兩種都在聽，叫「同花＋順子聽牌」，是很強的聽牌。</p>':''}`;
  }
  if(i===1){
    let h='<p>outs 就是「下一張出來，你就成牌」的牌。一張一張數：</p>';
    if(q.fl.length)h+=`<p><b>同花的 outs</b>：${SU[q.fs]} 一共有 13 張，你已經看到 ${q.seen} 張（手牌加公共牌），剩下 13 − ${q.seen} = <b>${q.fl.length}</b> 張。</p>${mini(q.fl)}`;
    if(q.st.length)h+=`<p><b>順子的 outs</b>：${rs.join(' 或 ')} 都能成順。每種點數有 4 張（♠♥♦♣ 四種花色），${q.ranks.length} × 4 = <b>${q.st.length}</b> 張。</p>${mini(q.st)}`;
    if(q.ov.length)h+=`<p><b>重複的要扣掉</b>：${q.ov.map(cn).join('、')} 同時是同花和順子的 outs，只能算一次：${q.fl.length} + ${q.st.length} − ${q.ov.length} = <b>${q.n}</b> 張。</p>`;
    h+=`<p>所以你的 outs 一共 <b>${q.n}</b> 張。${q.fl.length&&q.ans[1]!=null&&q.opts[1][q.ans[1]]===13?'常見錯誤是直接算 13 張，忘了扣掉已經看得到的同花色牌。':''}</p>`;
    return h;
  }
  if(i===2){
    const why=q.turn?`現在是轉牌，只剩河牌一張還沒發，所以用 <b>×2</b>。`:q.allin?`現在是翻牌，還有轉牌、河牌兩張。對手已經全下，你跟注後一定能看完兩張，所以用 <b>×4</b>。`:`現在是翻牌，還有兩張牌，但對手只是下注、還沒全下。轉牌後他可能再下注，你不一定能免費看到河牌，所以保守一點只算下一張，用 <b>×2</b>。`;
    return `<p>${why}</p><p>${q.n} × ${q.mult} = <b>約 ${q.est}%</b>（精確算出來是 ${q.exact}%，速算${Math.abs(q.est-q.exact)<=3?'很接近':'稍微高估了一點'}）。</p><p class="cap">口訣：還有兩張、而且一定看得到 → ×4；只看下一張 → ×2。</p>`;
  }
  if(i===3){
    const a=q.ans[3]!=null?q.opts[3][q.ans[3]]:null;
    return `<p>需要的勝率 ＝ 你要跟的錢 ÷ 跟完之後底池的總數。</p><p>跟完之後的底池 ＝ 原本 ${q.P} ＋ 對手 ${q.B} ＋ 你 ${q.B} ＝ ${q.T}</p><p>${q.B} ÷ ${q.T} ＝ <b>約 ${q.need}%</b></p>${a!==q.need&&a===Math.min(95,Math.round(q.B/q.P*100))?`<p class="cap">常見錯誤是算 ${q.B} ÷ ${q.P}，忘了把雙方下的錢都加進底池。</p>`:''}<p class="cap">好記的數字：對手下半個底池 → 25%；下 2/3 個底池 → 約 29%；下一整個底池 → 33%。</p>`;
  }
  const win=q.est>=q.need;
  return `<p>你中牌的機率約 <b>${q.est}%</b>，跟注需要 <b>${q.need}%</b>。</p><p>${win?`${q.est}% 比 ${q.need}% 高，長期來看跟注是賺的 → <b>跟注</b>。`:`${q.est}% 比 ${q.need}% 低，長期跟注會虧錢 → <b>蓋牌</b>。`}</p>${!win&&q.need-q.est<=8?'<p class="cap">差得不多時，如果中牌後還能從對手身上多贏很多，有些人還是會跟，這叫「隱含賠率」。新手先照數字打就好。</p>':''}`;
}
function oSum(i){
  const q=OQ;return [OKN[q.kind],`${q.n} 個 outs`,`×${q.mult} ≈ ${q.est}%`,`需要 ${q.need}%`,q.est>=q.need?'跟注':'蓋牌'][i];
}
function rOuts(){
  if(!OQ)newOQ();
  const q=OQ,s=q.step;
  let h=`<span class="score">答對 ${ST.outs.c} / ${ST.outs.t} 步</span>
  <div class="lbl">你的手牌</div><div class="cards">${q.h.map(c=>cardH(c)).join('')}</div>
  <div class="lbl">公共牌（${q.turn?'轉牌，還剩河牌一張':'翻牌，還剩兩張'}）</div><div class="cards">${[0,1,2,3,4].map(k=>cardH(q.b[k])).join('')}</div>
  <div class="need">底池原本 <b>${q.P}</b>，對手${q.allin?'全下':'下注'} <b>${q.B}</b>，輪到你決定</div>
  <div class="stp">${OSTEP.map((t,i)=>`<span class="${i<s||i===s&&q.ans[i]!=null?(q.ans[i]===oRight(i)?'ok':'no'):i===s?'cur':''}">${i+1}<small>${t}</small></span>`).join('')}</div>`;
  for(let i=0;i<Math.min(s,5);i++){const ok=q.ans[i]===oRight(i);h+=`<div class="dc"><span class="${ok?'ok-t':'bad-t'}">${ok?'✓':'✗'}</span>　第 ${i+1} 步 ${OSTEP[i]}：<b>${oSum(i)}</b></div>`}
  if(s<5){
    const Q=['你在聽什麼牌？','有幾張 outs？（下一張出來你就成牌的牌）','要乘以 2 還是 4？',`對手下注 ${q.B}，你至少要多少勝率，跟注才划算？`,'要跟注還是蓋牌？'][s];
    const a=q.ans[s],R=oRight(s),done=a!=null;
    h+=`<div class="lbl" style="margin-top:14px">第 ${s+1} 步：${OSTEP[s]}</div><p style="margin:0 0 8px">${Q}</p>
    <div class="${q.opts[s].length===4?'grid2':'grid2'}">${q.opts[s].map((o,k)=>`<button class="${done?(k===R?'right':k===a?'wrong':''):''}" onclick="oAns(${k})">${s===1?o+' 張':s===3?o+'%':o}</button>`).join('')}</div>`;
    if(done)h+=`<div class="fb ${a===R?'ok':'bad'} ox"><b class="${a===R?'ok-t':'bad-t'}">${a===R?'答對了':'答錯了'}</b>${oExplain(s)}</div><button class="pri full" onclick="oNext()">${s<4?'下一步':'看整理'}</button>`;
    else if(s===0)h+=`<p class="cap" style="margin-top:10px">這個練習只算「下一張成同花或順子」的 outs。</p>`;
  }else{
    const c=q.ans.filter((a,i)=>a===oRight(i)).length;
    h+=`<div class="fb ${c===5?'ok':''}"><b>整理</b>　5 步答對 ${c} 步<p style="margin:8px 0 0">${OKN[q.kind]} → ${q.n} 個 outs → ×${q.mult} ≈ ${q.est}% ${q.est>=q.need?'＞':'＜'} 需要的 ${q.need}% → <b>${q.est>=q.need?'跟注':'蓋牌'}</b></p></div>
    <button class="pri full" onclick="oNew()">下一題</button>`;
  }
  return h;
}
