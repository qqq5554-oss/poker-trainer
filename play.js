/* 牌局 */
const BBV=2,SBV=1,START=200;
const POSN=['BTN','SB','BB','UTG','HJ','CO'];
const POSZ={BTN:'莊家',SB:'小盲',BB:'大盲',UTG:'前位',HJ:'中位',CO:'切位'};
const STN=['翻牌前','翻牌','轉牌','河牌','攤牌'];
const BOTS=[
 {name:'阿明',style:'緊凶',d:'牌好才玩，一玩就下重注',loose:-1,aggr:.75,bluff:.08,cadj:.05},
 {name:'小美',style:'鬆凶',d:'什麼牌都想玩，常加注、也常虛張聲勢',loose:2,aggr:.8,bluff:.2,cadj:-.02},
 {name:'老王',style:'跟注站',d:'幾乎都跟注，很少加注也很少蓋牌',loose:3,aggr:.12,bluff:.02,cadj:-.14},
 {name:'阿華',style:'緊弱',d:'很保守，他一下注通常就是大牌',loose:-1.5,aggr:.25,bluff:.02,cadj:.08},
 {name:'小芳',style:'平衡',d:'打法中規中矩',loose:0,aggr:.5,bluff:.1,cadj:0}
];
let G={phase:'idle',P:[],board:[],log:[],dec:[]};
const posOf=i=>POSN[(i-G.btn+6)%6];
const isLate=p=>p==='CO'||p==='BTN';
const potT=()=>G.P.reduce((a,p)=>a+p.total,0);
const live=()=>G.P.filter(p=>!p.folded);
const canAct=p=>!p.folded&&!p.allin;
const needs=i=>{const p=G.P[i];return canAct(p)&&(!p.acted||p.bet<G.curBet)};
const nextFrom=i=>{for(let k=1;k<=6;k++){const j=(i+k)%6;if(needs(j))return j}return -1};
const lg=(t,k='')=>G.log.push({t,k});
function put(i,x){const p=G.P[i];x=Math.min(x,p.stack);p.stack-=x;p.bet+=x;p.total+=x;if(p.stack===0)p.allin=true;return x}
function limpers(){const sb=(G.btn+1)%6,bb=(G.btn+2)%6;return G.P.filter(p=>p.i!==sb&&p.i!==bb&&!p.folded&&p.bet===BBV).length}

function eqMC(hole,board,opp,N){
  const kn=[...hole,...board],d=[];for(let i=0;i<52;i++)if(!kn.includes(i))d.push(i);
  const nb=5-board.length,need=nb+2*opp;let s=0;
  for(let it=0;it<N;it++){
    for(let k=0;k<need;k++){const j=k+rnd(d.length-k);const x=d[k];d[k]=d[j];d[j]=x}
    const bd=board.concat(d.slice(0,nb)),me=ev(hole.concat(bd));let best=-1,cnt=0;
    for(let o=0;o<opp;o++){const q=nb+o*2;const v=ev([d[q],d[q+1],...bd]);if(v>best){best=v;cnt=1}else if(v===best)cnt++}
    if(me>best)s++;else if(me===best)s+=1/(cnt+1);
  }
  return s/N;
}
function drawInfo(hole,board){
  if(board.length<3||board.length>=5)return null;
  const kn=[...hole,...board];if(catOf(ev(kn))>=4)return null;
  let fl=0,sr=0;
  for(let c=0;c<52;c++){
    if(kn.includes(c))continue;
    const v=catOf(ev([...kn,c]));if(v<4||v===6||v===7)continue;
    const b=[...board,c];if(b.length>=5&&catOf(ev(b))>=4)continue;
    if(v===5||v===8)fl++;else sr++;
  }
  const o=fl+sr;if(!o)return null;
  return {o,kind:fl&&sr?'同花或順子':fl?'同花':'順子',p:board.length===3?Math.min(o*4,99):Math.min(o*2,99),rule:board.length===3?'outs×4，算到河牌':'outs×2，只剩河牌一張'};
}
function chen(l){
  const v=r=>({A:10,K:8,Q:7,J:6})[r]??(RK.indexOf(r)+2)/2;
  const a=l[0],b=l[1];let s=v(a);
  if(a===b)return Math.max(5,s*2);
  if(l[2]==='s')s+=2;
  const g=RK.indexOf(a)-RK.indexOf(b)-1;
  s-=[0,1,2,4][g]??5;
  if(g<=1&&RK.indexOf(a)<RK.indexOf('Q'))s+=1;
  return Math.ceil(s);
}

function gStart(){
  const gs=ST.game;clearTimeout(G.timer);
  if(gs.stacks[0]<BBV){render();return}
  G={phase:'play',board:[],log:[],dec:[],street:0,fast:false,runout:false,lastFb:null,raiseOpen:false};
  G.btn=gs.btn<0?rnd(6):(gs.btn+1)%6;gs.btn=G.btn;
  G.P=[];
  for(let i=0;i<6;i++){
    let s=gs.stacks[i];
    if(i>0&&s<BBV){s=START;lg(`${BOTS[i-1].name} 輸光了，重新買入 ${START} 籌碼。`,'sys')}
    G.P.push({i,name:i?BOTS[i-1].name:'你',bot:i?BOTS[i-1]:null,stack:s,start:s,hole:[],bet:0,total:0,folded:false,allin:false,acted:false,last:'',show:i===0});
  }
  G.deck=deal(52);
  for(let r=0;r<2;r++)for(let k=1;k<=6;k++)G.P[(G.btn+k)%6].hole.push(G.deck.pop());
  G.no=ST.play.hands+1;
  const sb=(G.btn+1)%6,bb=(G.btn+2)%6;
  put(sb,SBV);G.P[sb].last='小盲 '+G.P[sb].bet;
  put(bb,BBV);G.P[bb].last='大盲 '+G.P[bb].bet;
  G.curBet=BBV;G.lastRaise=BBV;
  lg(`第 ${G.no} 手。你坐在 ${posOf(0)}（${POSZ[posOf(0)]}），莊家是${G.P[G.btn].name}。`,'sys');
  lg(`${G.P[sb].name}下小盲 ${SBV}，${G.P[bb].name}下大盲 ${BBV}。`);
  lg('翻牌前：每人拿到兩張手牌，從大盲左邊的人開始行動。','st');
  G.cur=nextFrom(bb);
  step();
}
function step(){
  clearTimeout(G.timer);G.pending=false;
  if(live().length===1)return winFold();
  if(G.cur<0)return endStreet();
  if(G.cur===0){
    G.hint=coach();G.raiseOpen=false;G.hintOpen=ST.game.hint==='auto';
    G.raiseTo=G.hint.to||raiseOpts().o[0][1];render();return;
  }
  render();
  if(tab!=='play'){G.pending=true;return}
  G.timer=setTimeout(()=>{const i=G.cur,d=botDecide(i);doAct(i,d.type,d.to)},G.fast?260:800);
}
function doAct(i,type,to){
  const p=G.P[i],call=G.curBet-p.bet;let txt;
  if(type==='raise'&&p.stack<=call)type='call';
  if(type==='check'&&call>0)type='call';
  if(type==='call'&&call===0)type='check';
  if(type==='fold'){p.folded=true;p.foldSt=G.street;txt='蓋牌'}
  else if(type==='check')txt='過牌';
  else if(type==='call'){const x=put(i,call);txt=p.allin?`全下跟注 ${x}`:`跟注 ${x}`}
  else{
    const max=p.bet+p.stack;to=Math.min(Math.max(Math.round(to),G.curBet+G.lastRaise),max);
    const was=G.curBet;put(i,to-p.bet);
    if(to-was>=G.lastRaise)G.lastRaise=to-was;
    G.curBet=Math.max(was,to);
    G.P.forEach(q=>{if(q!==p&&canAct(q))q.acted=false});
    txt=(p.allin?'全下，':'')+(was===0?`下注 ${to}`:`加注到 ${to}`);
  }
  p.acted=true;p.last=txt;
  lg(`${p.name} ${txt}`,i===0?'mine':'');
  G.cur=nextFrom(i);
  step();
}
function endStreet(){
  G.P.forEach(p=>{p.bet=0;p.acted=false;if(!p.folded&&!p.allin)p.last=''});
  G.curBet=0;G.lastRaise=BBV;
  if(G.street===3)return showdown();
  G.street++;
  const n=G.street===1?3:1;for(let k=0;k<n;k++)G.board.push(G.deck.pop());
  lg(['','翻牌：翻開 3 張公共牌，翻牌後從莊家左邊開始行動。','轉牌：翻開第 4 張公共牌。','河牌：翻開最後一張公共牌，這是最後一輪下注。'][G.street],'st');
  if(G.P.filter(canAct).length<=1){
    if(!G.runout){G.runout=true;live().forEach(p=>p.show=true);lg('已經沒有人能再下注，直接發完公共牌比大小。','sys')}
    render();G.timer=setTimeout(endStreet,1000);return;
  }
  G.cur=nextFrom(G.btn);step();
}
function winFold(){
  const w=live()[0],pot=potT();w.stack+=pot;
  lg(`其他人都蓋牌了，${w.name}不用亮牌，直接贏得底池 ${pot}。`,'win');
  finish([{amt:pot,w:[w.i]}]);
}
function showdown(){
  G.street=4;const L=live();
  L.forEach(p=>{p.show=true;p.val=ev([...p.hole,...G.board])});
  lg('攤牌：還在局裡的人亮牌比大小。','st');
  L.forEach(p=>lg(`${p.name}：${handName(p.val)}`,'sys'));
  const lv=[...new Set(L.map(p=>p.total))].sort((a,b)=>a-b);
  let prev=0;const pots=[];
  lv.forEach((l,k)=>{
    let amt=0;G.P.forEach(p=>{amt+=Math.max(0,Math.min(p.total,k===lv.length-1?Infinity:l)-prev)});
    const el=L.filter(p=>p.total>=l);prev=l;if(!amt)return;
    const best=Math.max(...el.map(p=>p.val));
    const ws=el.filter(p=>p.val===best).sort((a,b)=>((a.i-G.btn+5)%6)-((b.i-G.btn+5)%6));
    const sh=Math.floor(amt/ws.length);let rem=amt-sh*ws.length;
    ws.forEach(p=>{p.stack+=sh+(rem>0?1:0);rem--});
    pots.push({amt,w:ws.map(p=>p.i),best});
  });
  pots.forEach((x,k)=>{
    const lab=pots.length>1?(k?`邊池${pots.length>2?k:''}`:'主池'):'底池';
    const nm=x.w.map(i=>G.P[i].name).join('、');
    lg(x.w.length>1?`${nm} 都是${handName(x.best)}，平分${lab} ${x.amt}。`:`${nm}以${handName(x.best)}贏得${lab} ${x.amt}。`,'win');
  });
  finish(pots);
}
function finish(pots){
  G.phase='done';G.cur=-1;G.pots=pots;
  G.P.forEach(p=>ST.game.stacks[p.i]=p.stack);
  const me=G.P[0];G.net=me.stack-me.start;
  ST.play.hands++;ST.play.net+=G.net;if(pots.some(x=>x.w.includes(0)))ST.play.won++;
  G.dec.forEach(d=>{ST.play.dec.t++;if(d.ok)ST.play.dec.c++});
  save();render();
}

function botDecide(i){
  const p=G.P[i],b=p.bot,call=G.curBet-p.bet,pot=potT(),R=Math.random();
  if(G.street===0){
    const c=chen(lab(...p.hole))+b.loose+(Math.random()*2-1),pos=posOf(i);
    const open={UTG:9,HJ:8,CO:7,BTN:6,SB:7.5,BB:7}[pos];
    if(G.curBet<=BBV){
      if(c>=open)return R<.35+b.aggr*.6?{type:'raise',to:3*BBV+BBV*limpers()}:{type:'call'};
      if(call===0)return {type:'check'};
      if(c>=open-2&&(b.aggr<.4||pos==='SB'))return {type:'call'};
      return {type:'fold'};
    }
    if(c>=12-b.loose*.3||(c>=9.5&&R<b.aggr*.35))return {type:'raise',to:G.curBet*3};
    if(c>=8-b.loose&&(call<=p.stack*.12||c>=10))return {type:'call'};
    if(call<=BBV&&c>=5)return {type:'call'};
    return {type:'fold'};
  }
  const eq=eqMC(p.hole,G.board,live().length-1,300);
  if(call===0){
    if(eq>.62&&R<.45+b.aggr*.5)return {type:'raise',to:Math.max(BBV,Math.round(pot*(Math.random()<.5?.5:.66)))};
    if(eq>.45&&R<b.aggr*.35)return {type:'raise',to:Math.max(BBV,Math.round(pot*.5))};
    if(Math.random()<b.bluff)return {type:'raise',to:Math.max(BBV,Math.round(pot*.5))};
    return {type:'check'};
  }
  const po=call/(pot+call);
  if(eq>.72&&R<b.aggr)return {type:'raise',to:G.curBet+Math.max(G.lastRaise,Math.round((pot+call)*.7))};
  if(eq>=po+b.cadj)return {type:'call'};
  if(Math.random()<b.bluff*.25)return {type:'raise',to:G.curBet+Math.max(G.lastRaise,Math.round((pot+call)*.6))};
  return {type:'fold'};
}

function coach(){
  const p=G.P[0],call=Math.min(G.curBet-p.bet,p.stack),pot=potT(),pos=posOf(0),opp=live().length-1;
  const cap=v=>Math.min(Math.round(v),p.bet+p.stack);
  if(G.street===0){
    const l=lab(...p.hole),t=tierOf(l),late=isLate(pos),raised=G.curBet>BBV;
    const where=late?'後位':(pos==='SB'||pos==='BB')?'盲注位（翻牌後要先行動，算前位）':'前中位';
    const info=[`位置：${pos} ${POSZ[pos]}，屬於${where}`,`手牌：${dl(l)}，起手牌表上是「${TN[t]}」`];
    if(raised)info.push(`前面已經有人加注到 ${G.curBet}`);
    if(!raised){
      const to=cap(3*BBV+BBV*limpers());
      if(t===1||t===2||(t===3&&late))return {cat:'a',ok:['a'],to,title:`加注到 ${to}`,why:`${dl(l)} 屬於「${TN[t]}」${t===3?'，而你在後位，可以玩':''}。好牌要主動加注入池：逼走弱牌，讓底池裡的人變少，比只跟注更容易贏。${limpers()?`前面有 ${limpers()} 人只跟注，所以每多一人多加 1 個大盲。`:''}`,info};
      if(pos==='BB'&&call===0)return {cat:'p',ok:['p'],title:'過牌',why:`${dl(l)} 不是好牌，但你是大盲、前面沒人加注，不用再花錢就能看翻牌，過牌就好。`,info};
      if(t===3)return {cat:'f',ok:['f'],title:'蓋牌',why:`${dl(l)} 是「後位才玩」的牌，你在${where}，後面還有很多人要行動，蓋牌。`,info};
      return {cat:'f',ok:['f'],title:'蓋牌',why:`${dl(l)} 不在起手牌表裡。新手階段直接蓋牌，省下的籌碼就是賺到的。${pos==='SB'?'小盲雖然只要補 1，但翻牌後你最先行動，位置最差。':''}`,info};
    }
    if(['AA','KK','QQ','AKs','AKo'].includes(l)){const to=cap(G.curBet*3);return {cat:'a',ok:['a','p'],to,title:`再加注到 ${to}`,why:`${dl(l)} 是頂級起手牌。有人加注時再加注一次（稱為 3-bet），讓底池變大、對手付更多錢。`,info}}
    if(t===1)return {cat:'p',ok:['p','a'],title:`跟注 ${call}`,why:`${dl(l)} 很強但還不到頂級，對手已經加注，跟注看翻牌比較穩。`,info};
    if(t===2&&call<=p.stack*.1)return {cat:'p',ok:['p','f'],title:`跟注 ${call}`,why:`${dl(l)} 是可玩的牌，跟注 ${call} 不到你籌碼的一成，可以跟進去看翻牌。`,info};
    if(t===2)return {cat:'f',ok:['f','p'],title:'蓋牌',why:`${dl(l)} 可以玩，但要跟 ${call} 太貴了（超過籌碼一成），對手加這麼大通常牌很好。`,info};
    return {cat:'f',ok:['f'],title:'蓋牌',why:`有人加注通常代表他的牌不錯。${dl(l)} 跟進去很容易被壓制，蓋牌。`,info};
  }
  const kn=[...p.hole,...G.board],made=handName(ev(kn)),dr=drawInfo(p.hole,G.board);
  const eq=eqMC(p.hole,G.board,opp,1500),e=Math.round(eq*100);
  const info=[`目前牌型：${made}`];
  if(dr)info.push(`聽牌：差一張成${dr.kind}，有 ${dr.o} 張 outs，中的機率約 ${dr.p}%（${dr.rule}）`);
  info.push(`勝率：約 ${e}%（對 ${opp} 位還沒蓋牌的對手）`);
  const ft='勝率是假設對手拿隨機手牌算的。對手下注越大，他的實際牌力通常越強，可以再保守一點。';
  if(call===0){
    const to=cap(Math.max(BBV,pot*2/3));
    if(eq>=.6)return {cat:'a',ok:['a'],to,title:`下注 ${to}`,why:`勝率約 ${e}%，你很可能領先。下注約底池的 2/3，讓比你差的牌付錢，也讓聽牌的人不能免費看下一張。`,info,ft};
    if(eq>=.4)return {cat:'p',ok:['p','a'],to:cap(Math.max(BBV,pot/3)),title:'過牌，或下小注',why:`勝率約 ${e}%，不上不下。過牌最安全；想主動一點可以下約底池 1/3 的小注。`,info,ft};
    return {cat:'p',ok:['p'],title:'過牌',why:G.street===3?`勝率只有約 ${e}%。河牌已經沒有下一張，過牌，對手下注就考慮蓋牌。`:`勝率只有約 ${e}%，不用花錢就能看下一張牌，過牌${dr?'，你還有聽牌的機會':''}。`,info,ft};
  }
  const po=call/(pot+call),pp=Math.round(po*100);
  info.push(`底池賠率：跟注 ${call} ÷（底池 ${pot} + ${call}）＝ ${pp}%，勝率要高於這個才划算`);
  if(eq>=.7){const to=cap(G.curBet+Math.max(G.lastRaise,(pot+call)*.75));return {cat:'a',ok:['a','p'],to,title:`加注到 ${to}`,why:`勝率約 ${e}%，遠高於需要的 ${pp}%。加注讓底池變大，從比你差的牌身上多贏一點。`,info,ft}}
  if(eq>=po)return {cat:'p',ok:eq>=.55?['p','a']:['p'],title:`跟注 ${call}`,why:`勝率約 ${e}%，高於需要的 ${pp}%，長期來看跟注划算。${eq-po<.08?'不過差距不大，對手下注通常代表牌不差。':''}`,info,ft};
  return {cat:'f',ok:['f'],title:'蓋牌',why:`勝率約 ${e}%，低於需要的 ${pp}%，長期跟注會虧。${dr?'就算算上聽牌也不夠划算。':''}`,info,ft};
}
function raiseOpts(){
  const p=G.P[0],call=G.curBet-p.bet,pot=potT(),max=p.bet+p.stack,min=Math.min(G.curBet+G.lastRaise,max);
  let o;
  if(G.street===0&&G.curBet<=BBV){const l=BBV*limpers();o=[['3BB',3*BBV+l],['4BB',4*BBV+l],['5BB',5*BBV+l]]}
  else if(G.street===0)o=[['2.5倍',G.curBet*2.5],['3倍',G.curBet*3],['4倍',G.curBet*4]];
  else o=[['½池',.5],['⅔池',.66],['1池',1]].map(([n,f])=>[n,G.curBet+(pot+call)*f]);
  o=o.map(([n,v])=>[n,Math.max(min,Math.min(max,Math.round(v)))]);o.push(['全下',max]);
  return {o,min,max};
}
function uAct(type){
  if(G.phase!=='play'||G.cur!==0)return;
  const p=G.P[0],call=G.curBet-p.bet,h=G.hint;
  if(type==='raise'&&p.stack<=call)type='call';
  const cat=type==='fold'?'f':type==='raise'?'a':'p';
  const act=type==='fold'?'蓋牌':type==='check'||call===0&&type==='call'?'過牌':type==='call'?`跟注 ${Math.min(call,p.stack)}`:(G.curBet?`加注到 ${G.raiseTo}`:`下注 ${G.raiseTo}`);
  const ok=h.ok.includes(cat);
  const d={st:STN[G.street],act,ok,rec:h.title,why:h.why};
  if(type==='fold'&&call===0){d.ok=false;d.why='沒人下注時過牌是免費的，不需要蓋牌。'}
  G.dec.push(d);G.lastFb=d;
  if(type==='fold')G.fast=true;
  doAct(0,type,G.raiseTo);
}
function setRT(v){G.raiseTo=+v;const e=document.getElementById('rto');if(e)e.textContent=v;const s=document.getElementById('rsl');if(s)s.value=v}
function gReset(){if(!confirm('所有人的籌碼回到 200，重新開始？'))return;clearTimeout(G.timer);ST.game.stacks=[START,START,START,START,START,START];ST.game.btn=-1;save();G={phase:'idle',P:[],board:[],log:[],dec:[]};render()}
function gRebuy(){ST.game.stacks[0]=START;save();render()}
function gHint(m){ST.game.hint=m;save();render()}

const SEATXY=[null,[11,73],[11,29],[50,14],[89,29],[89,73]];
const BETXY=[[50,89],[30,76],[30,41],[50,35],[70,41],[70,76]];
function seatH(p){
  const [x,y]=SEATXY[p.i],done=G.phase==='done',act=G.cur===p.i&&G.phase==='play';
  const cards=(p.show||done)?`<div class="cards xs">${p.hole.map(c=>cardH(c,p.folded?'dim':'')).join('')}</div>`:p.folded?'':'<div class="cb"></div><div class="cb"></div>';
  const tag=act?'思考中…':p.folded?'蓋牌':(p.show&&p.val!=null&&G.street===4)?handName(p.val):p.allin?'全下':p.last;
  return `<div class="seat ${act?'act':''} ${p.folded?'out':''} ${x<50?'lf':''}" style="left:${x}%;top:${y}%"><div class="box">${p.i===G.btn?'<span class="dbtn">D</span>':''}<div class="nm">${p.name}</div><div class="stk">${p.stack}</div><div class="hc">${cards}</div></div><div class="tag">${tag||posOf(p.i)}</div></div>`;
}
function rPlay(){
  const gs=ST.game;
  if(G.phase==='idle'){
    let h=`<h1>牌局</h1><p class="sub">跟 5 位電腦對手打完整的一手，教練在你每次行動前給建議</p>
    <p class="muted" style="margin:0">每人 200 籌碼，盲注 1／2。籌碼會延續到下一手，莊家每手往左移一位。</p>
    <div class="lbl">今天的對手</div>
    ${BOTS.map(b=>`<div class="stat"><span>${b.name}　<span class="muted">${b.d}</span></span><span class="pos" style="font-size:13px;padding:0 8px;white-space:nowrap">${b.style}</span></div>`).join('')}
    <div class="lbl">教練建議</div>
    <div class="seg"><button class="${gs.hint==='auto'?'on':''}" onclick="gHint('auto')">直接顯示</button><button class="${gs.hint!=='auto'?'on':''}" onclick="gHint('tap')">我先想，再點開看</button></div>
    <div class="row" style="margin-top:16px"><span>你的籌碼</span><span class="big-n" style="font-size:30px">${gs.stacks[0]}</span></div>`;
    h+=gs.stacks[0]<BBV?`<p class="err">籌碼輸光了，重新買入就能繼續。</p><button class="pri full" onclick="gRebuy()">重新買入 200 籌碼</button>`:`<button class="pri full" style="margin-top:12px" onclick="gStart()">發牌</button>`;
    if(ST.play.hands)h+=`<button class="full" style="margin-top:8px" onclick="gReset()">籌碼歸位，重新開始</button>`;
    M.innerHTML=h;return;
  }
  const me=G.P[0],my=G.cur===0&&G.phase==='play',pot=potT(),done=G.phase==='done';
  let h=`<div class="row"><h1>牌局</h1><span class="muted">第 ${G.no} 手　${STN[Math.min(G.street,4)]}</span></div>
  <div class="tbl"><div class="felt"></div>
  <div class="pot">底池 <b>${pot}</b></div>
  <div class="bd">${[0,1,2,3,4].map(k=>cardH(G.board[k])).join('')}</div>
  ${G.P.slice(1).map(seatH).join('')}
  ${G.P.filter(p=>p.bet>0).map(p=>`<div class="chip" style="left:${BETXY[p.i][0]}%;top:${BETXY[p.i][1]}%">${p.bet}</div>`).join('')}
  </div>`;
  const myHand=G.board.length>=3?handName(ev([...me.hole,...G.board])):null;
  h+=`<div class="me ${my?'act':''}"><div class="cards">${me.hole.map(c=>cardH(c,me.folded?'dim':'')).join('')}</div><div class="inf">
  <span class="pos" style="font-size:13px;padding:0 8px">${posOf(0)} ${POSZ[posOf(0)]}</span>${G.btn===0?' <span class="dbtn" style="position:static;display:inline-block">D</span>':''}
  <div><span class="stk">${me.stack}</span> <span class="muted">籌碼</span></div>
  <div class="muted">${me.folded?'你已蓋牌':me.allin?'你已全下':myHand?'目前：'+myHand:''}</div></div></div>`;

  if(my){
    const call=G.curBet-me.bet,cc=Math.min(call,me.stack),canR=me.stack>call;
    h+=`<div class="need">${call>0?`前面最高下到 <b>${G.curBet}</b>，你要補 <b>${cc}</b> 才能繼續`:'目前沒人下注，可以免費過牌'}</div>
    <div class="grid3"><button onclick="uAct('fold')">蓋牌</button>
    <button onclick="uAct('${call>0?'call':'check'}')">${call>0?(me.stack<=call?`全下跟注 ${cc}`:`跟注 ${cc}`):'過牌'}</button>
    ${canR?`<button class="${G.raiseOpen?'right':''}" onclick="G.raiseOpen=!G.raiseOpen;render()">${G.curBet?'加注…':'下注…'}</button>`:'<button disabled style="opacity:.35">加注</button>'}</div>`;
    if(G.raiseOpen&&canR){
      const R=raiseOpts();
      h+=`<div class="rp"><div class="grid4">${R.o.map(([n,v])=>`<button onclick="setRT(${v})">${n}</button>`).join('')}</div>
      ${R.max>R.min?`<input id="rsl" type="range" min="${R.min}" max="${R.max}" step="1" value="${G.raiseTo}" oninput="setRT(this.value)" aria-label="加注金額">`:''}
      <button class="pri full" onclick="uAct('raise')">${G.curBet?'加注到':'下注'} <span id="rto">${G.raiseTo}</span></button></div>`;
    }
    const H=G.hint;
    if(G.hintOpen)h+=`<div class="fb coach"><b>教練建議：${H.title}</b><div style="margin-top:4px">${H.why}</div><ul>${H.info.map(x=>`<li>${x}</li>`).join('')}</ul>${H.ft?`<div class="ft">${H.ft}</div>`:''}</div>`;
    else h+=`<button class="full" style="margin-top:10px" onclick="G.hintOpen=true;render()">看教練建議</button>`;
  }else if(!done){
    const w=G.cur>=0?G.P[G.cur]:null;
    h+=`<p class="need">${G.runout?'發完剩下的公共牌…':w?`等${w.name}行動…`:''}${me.folded?'　你已蓋牌，看看其他人怎麼打。':''}</p>`;
  }
  if(G.lastFb&&!done){const d=G.lastFb;h+=`<div class="fb ${d.ok?'ok':'bad'}" style="margin-top:8px"><b class="${d.ok?'ok-t':'bad-t'}">${d.ok?'和教練想的一樣':'和教練建議不同'}</b>　你${d.act}。${d.ok?'':`教練建議${d.rec}：${d.why}`}</div>`}

  if(done){
    const n=G.net;
    h+=`<div class="fb ${n>0?'ok':n<0?'bad':''}"><div class="res ${n>0?'ok-t':n<0?'bad-t':''}">${n>0?'+'+n:n===0?'±0':n}</div><div class="muted">${n>0?'這手你贏了':n<0?'這手你輸了':'這手打平'}，籌碼 ${me.start} → ${me.stack}</div></div>
    <button class="pri full" onclick="gStart()" ${me.stack<BBV?'disabled':''}>下一手</button>
    ${me.stack<BBV?'<button class="full" onclick="gRebuy();gStart()">重新買入 200 籌碼，再來一手</button>':''}
    <div class="lbl" style="margin-top:18px">復盤：所有人的手牌</div>
    ${G.P.map(p=>`<div class="rv"><span class="n">${p.name}<br><span class="muted" style="font-size:12px">${posOf(p.i)}</span></span><div class="cards mini">${p.hole.map(c=>cardH(c)).join('')}</div><span class="h">${p.folded?`${STN[p.foldSt]}蓋牌`:G.board.length===5?handName(ev([...p.hole,...G.board])):'沒到攤牌'}${G.pots.some(x=>x.w.includes(p.i))?'　<span class="ok-t">贏</span>':''}</span></div>`).join('')}
    <div class="lbl" style="margin-top:18px">你的決定</div>
    ${G.dec.length?G.dec.map(d=>`<div class="dc"><span class="${d.ok?'ok-t':'bad-t'}">${d.ok?'✓':'✗'}</span>　${d.st}：你${d.act}${d.ok?'':`<div class="w">教練建議${d.rec}。${d.why}</div>`}</div>`).join(''):'<p class="muted">這手沒輪到你做決定。</p>'}
    <button class="full" style="margin-top:14px" onclick="G.phase='idle';render()">回到牌局設定</button>`;
  }
  h+=`<div class="lbl" style="margin-top:18px">牌局紀錄</div><div class="log" id="glog">${G.log.map(l=>`<div class="${l.k}">${l.t}</div>`).join('')}</div>`;
  M.innerHTML=h;
  const L=document.getElementById('glog');if(L)L.scrollTop=L.scrollHeight;
}

