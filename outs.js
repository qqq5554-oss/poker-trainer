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
  let bm=0;b.forEach(c=>bm|=1<<(c>>2));
  const fl=[],st=[],bo=new Set(),five=b.length+1>=5;
  for(let c=0;c<52;c++){
    if(kn.includes(c))continue;
    const r=c>>2,uh=sh(rm|1<<r),bh=five?sh(bm|1<<r):-1;
    // 公共牌自己就成順子：只有你的順子比公共牌的大才算；你成同花另外算
    if(bh>=0&&uh<=bh&&!(bm>>r&1))bo.add(r);
    const f=sc[c&3]>=4,s=uh>=0&&uh>bh;if(!f&&!s)continue;
    const nb=[...b,c];if(nb.length>=5&&ev(nb)>=ev([...kn,c]))continue;
    if(f)fl.push(c);if(s)st.push(c);
  }
  const ranks=[...new Set(st.map(c=>c>>2))].sort((a,b)=>a-b);
  if(ranks.length>2)return null;
  const kind=fl.length&&ranks.length?'combo':fl.length?'flush':ranks.length===2?'oe':ranks.length===1?'gut':null;
  if(!kind)return null;
  const fs=fl.length?fl[0]&3:-1,ov=fl.filter(c=>st.includes(c));
  return {kind,fl,st,ov,ranks,fs,bo:[...bo].sort((a,b)=>a-b),seen:fs<0?0:sc[fs],hs:fs<0?0:h.filter(c=>(c&3)===fs).length,outs:[...new Set([...fl,...st])].length};
}
function boNote(q,short){
  if(!q.bo||!q.bo.length)return '';
  const rs=q.bo.map(rd).join('、'),keep=q.fl.filter(c=>q.bo.includes(c>>2));
  if(short)return `（${rs} 會讓公共牌自己成順子，大家都有，不算順子的 outs${keep.length?`；${keep.map(cn).join('、')} 讓你成同花，還是算`:''}）`;
  return `<p class="cap">注意：再來一張 ${rs}，公共牌自己就湊成順子，桌上每個人都有，所以這種牌不算順子的 outs。${keep.length?`不過 ${keep.map(cn).join('、')} 同時讓你成同花，同花比順子大，所以還是算在同花的 outs 裡。`:''}</p>`;
}
function outsOpts(q){
  const n=q.outs,oc=new Set([n]);
  if(q.fl.length)oc.add(13);
  if(q.kind==='combo'){oc.add(q.fl.length+q.st.length);oc.add(q.fl.length)}
  if(q.kind==='oe')oc.add(4);if(q.kind==='gut')oc.add(8);
  for(const x of [8,9,4,12,15,6,2])if(oc.size<4)oc.add(x);
  return [...oc].sort((a,b)=>a-b);
}
function needOpts(need,call,pot){
  const pc=new Set([need,Math.min(95,Math.round(call/pot*100))]);
  for(const x of [need+10,need-10,need+20])if(pc.size<4&&x>0&&x<100)pc.add(x);
  return [...pc].sort((a,b)=>a-b);
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
  const oc=outsOpts(q);
  // 第 4 步的選項
  OQ=Object.assign(q,{turn,allin,mult,n,est,exact,P,B,need,T:P+2*B,step:0,ans:[],
    opts:[[OKN.flush,OKN.oe,OKN.gut,OKN.combo],oc,['×2','×4'],needOpts(need,B,P+B),['跟注','蓋牌']]});
}
function oRight(i){const q=OQ;return [OKIND.indexOf(q.kind),q.opts[1].indexOf(q.n),q.mult===4?1:0,q.opts[3].indexOf(q.need),q.est>=q.need?0:1][i]}
function oAns(k){const q=OQ;if(q.ans[q.step]!=null)return;q.ans[q.step]=k;rec('outs',k===oRight(q.step));render()}
function oNext(){OQ.step++;render();toTop()}
function oNew(){newOQ();render();toTop()}

function oExplain(i,q=OQ){
  const mini=a=>`<div class="cards mini ow">${a.map(c=>cardH(c)).join('')}</div>`,rs=q.ranks.map(rd);
  const cur=handName(ev([...q.h,...q.b]));
  if(i===0){
    const f=`你的 ${SU[q.fs]} 有 4 張（手牌 ${q.hs} 張、公共牌 ${q.seen-q.hs} 張）。同花要 5 張同花色，再來一張 ${SU[q.fs]} 就成了，這叫「同花聽牌」。`;
    const s=q.ranks.length===2?`再來一張 ${rs[0]} 或 ${rs[1]}，就能湊成 5 張連續的順子。兩種點數都可以，這叫「兩頭順子聽牌」。`:`只有再來一張 ${rs[0]} 才能湊成順子，只有一種點數能幫你，這叫「卡順」（缺中間一張，或是只能往一邊接）。機會比兩頭少一半。`;
    return `<p>你現在只有「${cur}」，還不夠強，要靠下一張牌。</p><p>${q.fl.length?f:''}${q.fl.length&&q.ranks.length?'<br>':''}${q.ranks.length?s:''}</p>${q.kind==='combo'?'<p>兩種都在聽，叫「同花＋順子聽牌」，是很強的聽牌。</p>':''}`;
  }
  if(i===1){
    let h='<p>outs 就是「下一張出來，你就成牌」的牌。一張一張數：</p>';
    if(q.fl.length)h+=`<p><b>同花的 outs</b>：${SU[q.fs]} 一共有 13 張，你已經看到 ${q.seen} 張（手牌加公共牌），剩下 13 − ${q.seen} = <b>${q.fl.length}</b> 張。</p>${mini(q.fl)}`;
    if(q.st.length)h+=`<p><b>順子的 outs</b>：${q.ranks.length>1?rs.join(' 或 ')+' 都能成順':rs[0]+' 能成順'}。每種點數有 4 張（♠♥♦♣ 四種花色），${q.ranks.length} × 4 = <b>${q.st.length}</b> 張。</p>${mini(q.st)}`;
    if(q.ov.length)h+=`<p><b>重複的要扣掉</b>：${q.ov.map(cn).join('、')} 同時是同花和順子的 outs，只能算一次：${q.fl.length} + ${q.st.length} − ${q.ov.length} = <b>${q.n}</b> 張。</p>`;
    h+=boNote(q);
    h+=`<p>所以你的 outs 一共 <b>${q.n}</b> 張。${q.fl.length&&q.ans&&q.ans[1]!=null&&q.opts[1][q.ans[1]]===13?'常見錯誤是直接算 13 張，忘了扣掉已經看得到的同花色牌。':''}</p>`;
    return h;
  }
  if(i===2){
    const why=q.turn?`現在是轉牌，只剩河牌一張還沒發，所以用 <b>×2</b>。`:q.allin?`現在是翻牌，還有轉牌、河牌兩張。對手已經全下，你跟注後一定能看完兩張，所以用 <b>×4</b>。`:`現在是翻牌，還有兩張牌，但對手只是下注、還沒全下。轉牌後他可能再下注，你不一定能免費看到河牌，所以保守一點只算下一張，用 <b>×2</b>。`;
    return `<p>${why}</p><p>${q.n} × ${q.mult} = <b>約 ${q.est}%</b>（精確算出來是 ${q.exact}%，速算${Math.abs(q.est-q.exact)<=3?'很接近':'稍微高估了一點'}）。</p><p class="cap">口訣：還有兩張、而且一定看得到 → ×4；只看下一張 → ×2。</p>`;
  }
  if(i===3){
    const a=q.ans[3]!=null?q.opts[3][q.ans[3]]:null;
    return `<p>需要的勝率 ＝ 你要跟的錢 ÷ 跟完之後底池的總數。</p><p>跟完之後的底池 ＝ 原本 ${q.P} ＋ 對手 ${q.B} ＋ 你 ${q.B} ＝ ${q.T}</p><p>${q.B} ÷ ${q.T} ＝ <b>約 ${q.need}%</b></p>${a!==q.need&&a===Math.min(95,Math.round(q.B/(q.P+q.B)*100))?`<p class="cap">常見錯誤是算 ${q.B} ÷ ${q.P+q.B}，忘了把你自己要跟的 ${q.B} 也加進底池。</p>`:''}<p class="cap">好記的數字：對手下半個底池 → 25%；下 2/3 個底池 → 約 29%；下一整個底池 → 33%。</p>`;
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

// 牌局中遇到聽牌：教練建議裡用這一手的實際數字跑一遍 5 個步驟
function outsGame(H){
  const q=H.os;if(!q)return '';
  const pair=catOf(ev([...q.h,...q.b]))>=1,go=q.est>=q.need;
  const s3=q.turn?'現在是轉牌，只剩河牌一張還沒發，所以用 <b>×2</b>。':q.mult===4?'現在是翻牌，你跟注後已經沒有人能再下注（有人全下了），一定能看完轉牌和河牌兩張，所以用 <b>×4</b>。':q.call>0?'現在是翻牌，但跟注後轉牌可能還要再付錢，你不一定能免費看到河牌，所以保守一點只算下一張，用 <b>×2</b>。':'現在是翻牌，先算下一張就中的機率，用 <b>×2</b>。';
  let s5;
  if(q.call>0){
    s5=`<p>只看聽牌：約 ${q.est}% 比需要的 ${q.need}% ${go?'高，跟注划算':'低，只靠聽牌跟注不划算'}。</p>`;
    if(go!==(H.cat!=='f'))s5+=`<p class="cap">教練的最後建議是「${H.title}」，和只看聽牌的結果不同：教練是用電腦模擬整手牌來算勝率，${pair?'還算進了你現在已經有的對子：就算沒中聽牌，也可能靠這對贏。':'除了順子和同花，還算進了「手上的牌配成對子也可能贏」的機會。不過對手下注時通常已經有對子以上，這部分常常靠不住；兩邊差很多時，照聽牌的算法保守一點也合理。'}</p>`;
  }else s5=`<p>沒人下注時，可以免費過牌看下一張。${q.n>=8?'你的聽牌很強（8 張以上 outs），也可以考慮下注（半詐唬）：對手蓋牌你直接贏，被跟注也還有機會中牌。':''}</p>`;
  const st=[[OSTEP[0],oExplain(0,q)],[OSTEP[1],oExplain(1,q)],
    [OSTEP[2],`<p>${s3}</p><p>${q.n} × ${q.mult} = <b>約 ${q.est}%</b>（精確算出來是 ${q.exact}%）</p>`],
    [OSTEP[3],q.call>0?`<p>需要的勝率 ＝ 你要跟的錢 ÷ 跟完之後底池的總數。</p><p>現在底池是 ${q.pot}（包含這一輪大家下的錢），你跟 ${q.call} 之後是 ${q.pot} ＋ ${q.call} ＝ ${q.pot+q.call}。</p><p>${q.call} ÷ ${q.pot+q.call} ＝ <b>約 ${q.need}%</b></p>`:'<p>現在沒有人下注，你可以免費看下一張，不用算底池賠率。</p>'],
    [OSTEP[4],s5]];
  return `<details class="os" ${G.osOpen?'open':''} ontoggle="G.osOpen=this.open"><summary>Outs 計算：${OKN[q.kind]}，${q.n} 張 outs，約 ${q.est}%${q.call>0?`，需要 ${q.need}%`:''}<span>點開看 5 個步驟</span></summary>${st.map((x,i)=>`<div class="ox"><div class="ch">第 ${i+1} 步：${x[0]}</div>${x[1]}</div>`).join('')}</details>`;
}

// 牌局中的速算練習：輪到你、翻牌後，在聽牌或面對下注時出現
function qzBuild(){
  const H=G.hint,q=H.os,p=G.P[0],call=Math.min(G.curBet-p.bet,p.stack),pot=potT(),Q=[];
  if(q){
    const o=outsOpts(q),parts=[];
    if(q.fl.length&&!q.st.length)parts.push(`${SU[q.fs]} 一共 13 張 − 看到的 ${q.seen} 張 ＝ ${q.fl.length} 張`);
    else if(q.st.length&&!q.fl.length)parts.push(`${q.ranks.map(rd).join('、')} ${q.ranks.length}種點數 × 4 張 ＝ ${q.st.length} 張`);
    else parts.push(`同花 ${q.fl.length} 張 ＋ 順子 ${q.st.length} 張${q.ov.length?` − 重複 ${q.ov.length} 張`:''} ＝ ${q.n} 張`);
    Q.push({t:`有幾張 outs？（${OKN[q.kind]}）`,o:o.map(x=>x+' 張'),r:o.indexOf(q.n),ex:parts[0]+boNote(q,1)});
    const po=[...new Set([q.n,q.n*2,q.n*4].map(x=>Math.min(x,100)))].sort((a,b)=>a-b);
    const why=q.turn?'轉牌只剩一張，×2':q.mult===4?'有人全下，一定看得到兩張，×4':call>0?'翻牌但對手沒全下，保守只算下一張，×2':'先算下一張，×2';
    Q.push({t:'中牌的機率大約多少？',o:po.map(x=>x+'%'),r:po.indexOf(q.est),ex:`${q.n} × ${q.mult} ＝ ${q.est}%（${why}）`});
  }
  if(call>0){
    const need=Math.round(call/(pot+call)*100),o=needOpts(need,call,pot);
    Q.push({t:`跟注 ${call}，至少要多少勝率才划算？`,o:o.map(x=>x+'%'),r:o.indexOf(need),ex:`${call} ÷（底池 ${pot} ＋ 跟注 ${call}）＝ ${need}%`,need});
  }
  return {Q,call,pot};
}
function qzAns(i,k){const Z=G.qz;if(!Z||Z.a[i]!=null||Z.show)return;Z.a[i]=k;rec('outs',k===Z.Q[i].r);render()}
function calcPanel(){
  const H=G.hint;if(G.street===0||ST.game.calc===false||!H)return '';
  const Z=G.qz;if(!Z.Q)Object.assign(Z,qzBuild());
  if(!Z.Q.length)return '';
  const q=H.os,all=Z.show||Z.a.length===Z.Q.length&&Z.a.every(x=>x!=null);
  let h=`<div class="qz"><div class="row"><b>速算練習</b><span class="muted">${Z.show?'答案':'先心算，再點答案'}</span></div>`;
  Z.Q.forEach((x,i)=>{
    if(i>0&&Z.a[i-1]==null&&!Z.show)return;
    const a=Z.a[i],d=a!=null||Z.show;
    h+=`<div class="qq">${i+1}. ${x.t}</div><div class="chips">${x.o.map((o,k)=>`<button class="${d?(k===x.r?'right':k===a?'wrong':''):''}" onclick="qzAns(${i},${k})">${o}</button>`).join('')}</div>${d?`<div class="qe">${a==null?'':a===x.r?'<span class="ok-t">✓</span> ':'<span class="bad-t">✗</span> '}${x.ex}</div>`:''}`;
  });
  if(all){
    const nd=Z.Q.find(x=>x.need!=null),need=nd&&nd.need;
    let r;
    if(q&&need!=null)r=`只看聽牌：約 ${q.est}% ${q.est>=need?'＞':'＜'} 需要 ${need}% → <b>${q.est>=need?'跟注划算':'跟注不划算'}</b>${H.eq!=null?`<br><span class="muted">教練模擬整手牌的勝率約 ${H.eq}%（還算進了配成對子等其他贏法）</span>`:''}`;
    else if(q)r=`沒人下注，可以免費看下一張，中牌機率約 ${q.est}%。`;
    else r=`勝率要高於 <b>${need}%</b> 才划算。教練模擬的勝率約 ${H.eq}% → <b>${H.eq>=need?'夠，跟注划算':'不夠，跟注不划算'}</b>`;
    h+=`<div class="qr">${r}</div>`;
    if(q)h+=outsGame(H);
  }else h+=`<button class="lnk" onclick="G.qz.show=true;render()">直接看答案</button>`;
  return h+'</div>';
}

// 牌局中的勝率條：長條是你的勝率；線是跟注需要的勝率（翻牌前是「大家平分」的勝率）
function eqBar(){
  const H=G.hint;if(!H||H.eq==null||ST.game.bar===false)return '';
  const p=G.P[0],call=Math.min(G.curBet-p.bet,p.stack),pot=potT(),n=live().length-1,pre=G.street===0,Z=G.qz;
  // 速算練習還沒答完時，先不畫出答案（聽牌機率和需要的勝率）
  const qPend=!pre&&ST.game.calc!==false&&(H.os||call>0)&&!(Z&&(Z.show||Z.Q&&Z.Q.every((x,i)=>Z.a[i]!=null)));
  const need=call>0?Math.round(call/(pot+call)*100):null,fair=Math.round(100/(n+1)),mk=pre?fair:qPend?null:need;
  const rows=[['整手勝率',H.eq]];if(H.os&&!qPend)rows.push(['只看聽牌',H.os.est]);
  let h=`<div class="eb"><div class="row"><b>你的勝率</b><span class="muted">對 ${n} 位對手</span></div>`;
  h+=rows.map(([t,v])=>`<div class="ebr"><span class="ebl">${t}</span><div class="ebt"><i style="width:${Math.max(v,1)}%"></i>${mk!=null?`<b style="left:${mk}%"></b>`:''}</div><span class="ebv">${v}%</span></div>`).join('');
  if(pre)h+=`<div class="ebn"><span class="tk"></span>線是 ${n+1} 人平分的 ${fair}%。超過線代表你的牌比平均好；但翻牌前還要看位置，照起手牌表打。</div>`;
  else if(call>0&&!qPend){const N=Math.round(pot/call*10)/10;h+=`<div class="ebn"><span class="tk"></span>線是跟注需要的 ${need}%：底池 ${pot} 是跟注 ${call} 的 ${N} 倍 → 1 ÷（${N} ＋ 1）≈ ${need}%。<b>${H.eq>=need?'長條超過線，跟注划算':'長條沒到線，跟注不划算'}</b></div>`}
  else if(call>0)h+=`<div class="ebn muted">跟注要多少勝率才划算？先在下方速算練習算算看，答完這裡會畫出線。</div>`;
  else h+=`<div class="ebn muted">沒人下注，不用付錢就能看下一張。</div>`;
  return h+'</div>';
}

// 勝率分頁的速算小抄：心算要背的數字（都用模擬或公式算過）
function rTips(){
  const bar=a=>`<div class="tr"><i style="width:${a}%"></i></div>`;
  const O=[['卡順',4],['兩頭順子',8],['同花聽牌',9],['同花＋卡順',12],['同花＋兩頭順子',15]];
  let h=`<div class="lbl" style="margin-top:16px">1. 下一張中牌的機率：outs × 2</div>
  <p class="cap">深色是下一張就中（×2），淺色是一路看到河牌（×4，對手全下時才用）。數字是精確值。</p>`;
  h+=O.map(([t,o])=>{const a=Math.round(o/47*1000)/10,b=Math.round((1-(47-o)*(46-o)/(47*46))*1000)/10;
    return `<div class="hb tb tw"><span class="hl">${t}<small>${o} 張 outs</small></span><div class="tr"><i class="lt" style="width:${b}%"></i><i style="width:${a}%"></i></div><span class="hv">${Math.round(a)}%<small>到河牌 ${Math.round(b)}%</small></span></div>`}).join('');
  h+=`<p class="cap" style="margin-top:6px">速算：9 張 × 2 = 18%（精確 19%）；× 4 = 36%（精確 35%）。outs 超過 8 張時 ×4 會算太高，例如 15 張算出 60%，其實只有 54%。</p>`;
  const B=[['底池的 1/3',20],['半個底池',25],['底池的 2/3',29],['底池的 3/4',30],['一整個底池',33],['底池的 2 倍',40]];
  h+=`<div class="lbl" style="margin-top:18px">2. 跟注需要多少勝率：看對手下多大</div>
  <p class="cap">公式：對手下注 ÷（原本底池 ＋ 2 × 對手下注）。下注越大，你需要的勝率越高。</p>`;
  h+=B.map(([t,v])=>`<div class="hb tw"><span class="hl">${t}</span>${bar(v)}<span class="hv">${v}%</span></div>`).join('');
  h+=`<p class="cap" style="margin-top:6px">更簡單的算法：看「底池（含對手下注）是你要跟的錢的幾倍」，叫它 N，需要的勝率就是 1 ÷（N ＋ 1）。<br>2 倍 → 33%　3 倍 → 25%　4 倍 → 20%　5 倍 → 17%</p>`;
  const V=[['KK','88',80],['AK','AQ',74],['QQ','AK',57],['22','AK',53],['AK','76',62],['87 同花','AA',23]];
  h+=`<div class="lbl" style="margin-top:18px">3. 翻牌前常見對戰（打到最後的勝率）</div>
  <p class="cap">左邊黃色是前面那手牌，右邊是後面那手。花色不同、不同花。</p>`;
  h+=V.map(([a,b,v])=>`<div class="vs"><span>${a}</span><div class="sp"><i style="width:${v}%"></i></div><span>${b}</span><span class="hv">${v} : ${100-v}</span></div>`).join('');
  h+=`<p class="cap" style="margin-top:6px">好記的說法：大對子對小對子約 80 : 20；同一張大牌、踢腳比人小約 25 : 75；對子對兩張比它大的牌，接近擲硬幣。</p>`;
  const M=[['AA',[85,73,64,56,49]],['KQ',[62,44,35,29,26]],['76 同花',[46,32,25,21,18]]];
  h+=`<div class="lbl" style="margin-top:18px">4. 對手越多，勝率越低（翻牌前，對手拿隨機牌）</div>
  <div class="mo"><span></span>${[1,2,3,4,5].map(n=>`<span class="muted">${n} 人</span>`).join('')}`;
  h+=M.map(([t,a])=>`<span>${t}</span>${a.map(v=>`<span class="mc"><i style="height:${v*.4}px"></i>${v}%</span>`).join('')}`).join('');
  h+=`</div><p class="cap" style="margin-top:6px">每多一位對手，勝率大約打 7 到 9 折：好牌（AA）掉得慢，普通的牌掉得快。人多時要用更好的牌才入池。</p>`;
  return h;
}
