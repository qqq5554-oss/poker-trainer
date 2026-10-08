/* 牌局 */
// 籌碼單位 10：小盲 10、大盲 20、起始 2000（100 個大盲）；所有下注金額都是 10 的倍數
const BBV=20,SBV=10,START=2000,U=10;
const r10=v=>Math.round(v/U)*U;
const POSZ={BTN:'莊家',SB:'小盲',BB:'大盲',UTG:'前位',HJ:'中位',CO:'切位'};
const STN=['翻牌前','翻牌','轉牌','河牌','攤牌'];
// 電腦對手的 5 種打法；說明文字用名字，不用代名詞（名字可以自己改）
const BSTY={
 tag:{style:'精明果斷',term:'緊凶',d:'牌好才玩，一玩就下重注',loose:-1,aggr:.75,bluff:.08,cadj:.05,bluffable:true,
  pre:n=>`加注的是${n}，${n}牌好才玩，加注通常代表牌不錯`,bet:n=>`下注的是${n}，有好牌或強聽牌都會下注，要尊重，但不一定是最大牌`,tip:n=>`${n}沒中牌時會蓋牌，你主動下注有機會讓對方放棄`},
 lag:{style:'衝動愛冒險',term:'鬆凶',d:'什麼牌都想玩，常加注、也常虛張聲勢',loose:2,aggr:.8,bluff:.2,cadj:-.02,wild:true,
  pre:n=>`加注的是${n}，${n}什麼牌都愛加注，加注不代表牌好`,bet:n=>`下注的是${n}，${n}常虛張聲勢，下注的牌可能很普通，中等的牌可以多跟一點`,tip:n=>`別對${n}虛張聲勢，${n}不愛蓋牌；有好牌就讓${n}自己下注`},
 sta:{style:'好奇不服輸',term:'跟注站',d:'總想看最後一張牌，幾乎都跟注，很少加注也很少蓋牌',loose:3,aggr:.12,bluff:.02,cadj:-.14,honest:true,station:true,
  pre:n=>`加注的是${n}，${n}很少加注，但玩的牌很多，加注時牌不一定很大，通常至少是還不錯的牌`,bet:n=>`下注的是${n}，${n}幾乎只會跟注，主動下注通常是真的有牌`,tip:n=>`${n}什麼都跟：有好牌就多下注讓對方付錢，沒牌千萬別虛張聲勢`},
 nit:{style:'膽小謹慎',term:'緊弱',d:'很保守、怕輸，一下注通常就是大牌',loose:-1.5,aggr:.25,bluff:.02,cadj:.08,honest:true,bluffable:true,
  pre:n=>`加注的是${n}，${n}很保守，加注通常是大牌`,bet:n=>`下注的是${n}，${n}很少下注，一下注通常就是大牌，中等的牌就放棄吧`,tip:n=>`${n}很容易被嚇跑，你下注常常就能讓對方蓋牌`},
 bal:{style:'冷靜理性',term:'平衡',d:'打法中規中矩，看情況做決定',loose:0,aggr:.5,bluff:.1,cadj:0,bluffable:true,
  pre:n=>`加注的是${n}，${n}打法中規中矩，照起手牌表判斷就好`,bet:n=>`下注的是${n}，${n}打法平衡，照勝率和底池賠率判斷就好`,tip:n=>`${n}打法平衡，用正常打法應對就好`}
};
const OPP0=[{n:'阿明',s:'tag'},{n:'小美',s:'lag'},{n:'老王',s:'sta'},{n:'阿華',s:'nit'},{n:'小芳',s:'bal'}];
const esc=t=>String(t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const oppList=()=>{const o=ST.game.opp;return Array.isArray(o)&&o.length>=1&&o.length<=5?o:OPP0};
// 依設定組出這桌的電腦對手（名字、打法參數、教練引用的說明）
const BOTS=()=>oppList().map(o=>{const t=BSTY[o.s]||BSTY.bal,n=esc(o.n||'電腦');return Object.assign({},t,{name:n,pre:t.pre(n),bet:t.bet(n),tip:t.tip(n)})});
// 座位名稱：莊家、小盲、大盲，其餘從後往前是切位、中位、前位；兩人對打時莊家同時是小盲
const POSL={2:['BTN','BB'],3:['BTN','SB','BB'],4:['BTN','SB','BB','UTG'],5:['BTN','SB','BB','UTG','CO'],6:['BTN','SB','BB','UTG','HJ','CO']};
let G={phase:'idle',P:[],board:[],log:[],dec:[]};
const NP=()=>G.P.length;
const posOf=i=>POSL[NP()][(i-G.btn+NP())%NP()];
const posZ=i=>POSZ[posOf(i)]+(NP()===2&&posOf(i)==='BTN'?'（小盲）':'');
const SBi=()=>NP()===2?G.btn:(G.btn+1)%NP(),BBi=()=>(SBi()+1)%NP();
const isLate=p=>p==='CO'||p==='BTN';
const potT=()=>G.P.reduce((a,p)=>a+p.total,0);
const live=()=>G.P.filter(p=>!p.folded);
const canAct=p=>!p.folded&&!p.allin;
const needs=i=>{const p=G.P[i];return canAct(p)&&(!p.acted||p.bet<G.curBet)};
const nextFrom=i=>{const n=NP();for(let k=1;k<=n;k++){const j=(i+k)%n;if(needs(j))return j}return -1};
const lg=(t,k='')=>G.log.push({t,k});
function put(i,x){const p=G.P[i];x=Math.min(x,p.stack);p.stack-=x;p.bet+=x;p.total+=x;if(p.stack===0)p.allin=true;return x}
function limpers(){const sb=SBi(),bb=BBi();return G.P.filter(p=>p.i!==sb&&p.i!==bb&&!p.folded&&p.bet===BBV).length}

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
    const b=[...board,c];if(b.length>=5&&ev(b)>=ev([...kn,c]))continue;
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
  const gs=ST.game,bots=BOTS(),N=bots.length+1;clearTimeout(G.timer);
  if(!Array.isArray(gs.stacks)||gs.stacks.length!==N){gs.stacks=Array(N).fill(START);gs.btn=-1}
  if(gs.stacks[0]<BBV){render();return}
  G={phase:'play',board:[],log:[],dec:[],street:0,ag:[-1,-1,-1,-1],fast:false,runout:false,lastFb:null,raiseOpen:false};
  G.btn=gs.btn<0?rnd(N):(gs.btn+1)%N;gs.btn=G.btn;
  G.P=[];
  for(let i=0;i<N;i++){
    let s=gs.stacks[i];
    if(i>0&&s<BBV){s=START;lg(`${bots[i-1].name} 輸光了，重新買入 ${START} 籌碼。`,'sys')}
    G.P.push({i,name:i?bots[i-1].name:'你',bot:i?bots[i-1]:null,stack:s,start:s,hole:[],bet:0,total:0,folded:false,allin:false,acted:false,last:'',show:i===0});
  }
  rangeInit();G.lb=null;
  G.deck=deal(52);
  for(let r=0;r<2;r++)for(let k=1;k<=N;k++)G.P[(G.btn+k)%N].hole.push(G.deck.pop());
  G.no=ST.play.hands+1;
  const sb=SBi(),bb=BBi();
  put(sb,SBV);G.P[sb].last='小盲 '+G.P[sb].bet;
  put(bb,BBV);G.P[bb].last='大盲 '+G.P[bb].bet;
  G.curBet=BBV;G.lastRaise=BBV;
  lg(`第 ${G.no} 手。你坐在 ${posOf(0)}（${posZ(0)}），莊家是${G.P[G.btn].name}${N===2?'（兩人對打時，莊家同時是小盲）':''}。`,'sys');
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
    G.hint=coach();G.qz={a:[]};G.raiseOpen=false;G.hintOpen=ST.game.hint==='auto';
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
  if(i>0)rangeUpd(i,type);
  if(type==='fold'){p.folded=true;p.foldSt=G.street;txt='蓋牌'}
  else if(type==='check')txt='過牌';
  else if(type==='call'){const x=put(i,call);txt=p.allin?`全下跟注 ${x}`:`跟注 ${x}`}
  else{
    const max=p.bet+p.stack;to=Math.min(Math.max(r10(to),G.curBet+G.lastRaise),max);
    const was=G.curBet,pb=potT(),x=to-p.bet;put(i,x);G.lb={i,st:G.street,x,pb};
    if(to-was>=G.lastRaise)G.lastRaise=to-was;
    G.curBet=Math.max(was,to);G.ag[G.street]=i;
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
    const ws=el.filter(p=>p.val===best).sort((a,b)=>ORD(a.i)-ORD(b.i));
    // 平分時以 10 為單位，零頭依翻牌後的順序給前面的人
    const sh=Math.floor(amt/ws.length/U)*U;let rem=amt-sh*ws.length;
    ws.forEach(p=>{const x=rem>0?Math.min(U,rem):0;p.stack+=sh+x;rem-=x});
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
  const won=pots.some(x=>x.w.includes(0)),pre=G.dec.filter(d=>d.si===0),sd=G.street===4&&!me.folded;
  ST.hist.push({no:G.no,pos:posOf(0),net:G.net,won,sd,wsd:sd&&won,
    sf:G.board.length>=3&&!(me.folded&&me.foldSt===0),
    vp:pre.some(d=>d.u==='a'||d.u==='p'&&d.fc),pr:pre.some(d=>d.u==='a'),
    d:G.dec.map(d=>[d.si,d.u,d.c,d.k,d.ok?1:0])});
  if(ST.hist.length>500)ST.hist.splice(0,ST.hist.length-500);
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
    if(eq>.62&&R<.45+b.aggr*.5)return {type:'raise',to:Math.max(BBV,r10(pot*(Math.random()<.5?.5:.66)))};
    if(eq>.45&&R<b.aggr*.35)return {type:'raise',to:Math.max(BBV,r10(pot*.5))};
    if(Math.random()<b.bluff)return {type:'raise',to:Math.max(BBV,r10(pot*.5))};
    return {type:'check'};
  }
  const po=call/(pot+call);
  if(eq>.72&&R<b.aggr)return {type:'raise',to:G.curBet+Math.max(G.lastRaise,r10((pot+call)*.7))};
  if(eq>=po+b.cadj)return {type:'call'};
  if(Math.random()<b.bluff*.25)return {type:'raise',to:G.curBet+Math.max(G.lastRaise,r10((pot+call)*.6))};
  return {type:'fold'};
}

const ORD=i=>(i-G.btn+NP()-1)%NP();
function boardTex(b){
  const sc=[0,0,0,0],rs=new Set();b.forEach(c=>{sc[c&3]++;rs.add(c>>2)});
  const ms=Math.max(...sc),paired=rs.size<b.length,more=b.length<5;
  let run=0;for(let lo=-1;lo<=8;lo++){let k=0;for(let r=lo;r<lo+5;r++)if(rs.has(r<0?12:r))k++;run=Math.max(run,k)}
  const n=[];
  if(ms>=4)n.push('公共牌有 4 張同花色，手上只要有一張這個花色就是同花');
  else if(ms===3)n.push('公共牌有 3 張同花色，有人可能已經成同花');
  else if(ms===2&&more)n.push('公共牌有 2 張同花色，有人可能在聽同花');
  if(run>=4)n.push('公共牌非常連，很多牌都能湊成順子');
  else if(run===3)n.push('公共牌有 3 張點數靠得很近，有人可能有順子或在聽順子');
  if(paired)n.push('公共牌有一對，有人可能有三條或葫蘆');
  const wet=(ms>=2&&more)||ms>=3||run>=3;
  if(!wet&&!paired)n.push('公共牌很「乾」（不同花、不連），聽牌少，先下注的人常能直接拿下底池');
  return {n,wet};
}
function handRead(hole,board){
  const v=ev([...hole,...board]),c=catOf(v),br=board.map(x=>x>>2),hr=hole.map(x=>x>>2),top=Math.max(...br);
  if(board.length===5&&ev(board)===v)return {c,own:false,t:'你最好的五張牌全在公共牌上，大家都有，等於沒有牌'};
  if(c===0)return {c,own:false,t:'還沒成牌，只有高牌'};
  if(c===1){
    if(hr[0]===hr[1])return {c,t:hr[0]>top?'超對：手上的對子比公共牌都大，是一對裡最強的':'手上的對子比公共牌上的牌小，很容易被別人的對子壓過'};
    const pr=hr.find(r=>br.includes(r));
    if(pr==null)return {c,own:false,t:'對子在公共牌上，大家共用，等於只有高牌'};
    const kick=hr.find(r=>r!==pr);
    if(pr===top)return {c,t:`頂對（用公共牌最大的那張配成對）${kick>=10?'，踢腳也夠大':'，但踢腳偏小，遇到大注要小心'}`};
    return {c,t:'中對或小對：公共牌上還有比你大的牌，對手配到更大對子的機會不小'};
  }
  const bp=new Set(br).size<br.length;
  if(c===2)return {c,t:bp&&hr[0]!==hr[1]&&hr.filter(r=>br.includes(r)).length<2?'兩對，但其中一對是公共牌的，實際上只比一對強一點':'兩對，兩張手牌都有用上，牌力不錯'};
  if(c===3)return {c,t:hr[0]===hr[1]?'暗三條（手上的對子配中公共牌），很強又不容易被看穿':'三條，但有兩張在公共牌上，別人也可能有，要注意踢腳'};
  if(c===5){
    const all=[...hole,...board],fs=[0,1,2,3].find(s=>all.filter(x=>(x&3)===s).length>=5),mine=hole.filter(x=>(x&3)===fs);
    if(mine.length===1&&mine[0]>>2<10)return {c,t:'同花，但只用到一張不大的手牌，別人可能有更大的同花'};
  }
  return {c,t:`${handName(v)}，很強的牌`};
}
function coach(){
  const p=G.P[0],call=Math.min(G.curBet-p.bet,p.stack),pot=potT(),pos=posOf(0);
  const opps=live().filter(q=>q.i!==0),opp=opps.length;
  const cap=v=>Math.min(r10(v),p.bet+p.stack);
  const A=t=>({k:'agg',t}),Md=t=>({k:'mid',t}),C=t=>({k:'con',t});
  const agI=G.ag[G.street],ager=agI>0?G.P[agI]:null,sit=[];
  if(G.street===0){
    const l=lab(...p.hole),t=tierOf(l),late=isLate(pos),raised=G.curBet>BBV,lp=limpers(),blind=pos==='SB'||pos==='BB';
    const where=late?'後位':blind?'盲注位（翻牌後要先行動，算前位）':'前中位';
    const info=[`位置：${pos} ${POSZ[pos]}，屬於${where}`,`手牌：${dl(l)}，起手牌表上是「${TN[t]}」`];
    if(raised)info.push(`前面已經有人加注到 ${G.curBet}`);
    sit.push(late?`你在${POSZ[pos]}（後位），翻牌後大多比對手晚行動，可以多玩一些牌`:blind?`你在${POSZ[pos]}，翻牌後要比別人先行動，比較吃虧，牌要更好才玩`:`你在${POSZ[pos]}（前中位），翻牌後比很多人早行動，牌要夠好才玩`);
    if(raised&&ager)sit.push(ager.bot.pre);
    else if(lp)sit.push(`前面有 ${lp} 人只跟注、沒加注（叫「平跟」），他們的牌通常普通`);
    else if(late&&!raised)sit.push('前面的人都蓋牌了，只剩盲注還沒行動。在後位加注常能直接贏走盲注（叫「偷盲」），等熟悉起手牌表後可以多試');
    const behind=G.P.filter(q=>q.i!==0&&canAct(q)&&!q.acted).length;
    if(behind>=3)sit.push(`後面還有 ${behind} 人沒行動，任何一人都可能拿到大牌`);
    const bbs=Math.floor(p.stack/BBV);
    if(bbs<=15)sit.push(`你的籌碼只剩 ${bbs} 個大盲，好牌可以直接全下，不用分好幾次下注`);
    const xp=[],n1=opps.length;
    if(raised&&ager){const rv=rangeView(ager.i);xp.push({t:'對手範圍',h:`依${ager.name}的打法和位置，會這樣加注的牌大約是所有起手牌的前 ${rv.pct}%，${rv.low.length?`從 ${rv.top.map(dl).join('、')} 這種大牌，到 ${rv.low.map(dl).join('、')} 這種普通的牌都有可能`:`大多是 ${rv.top.map(dl).join('、')} 這類強牌`}。`})}
    const er=Math.round(eqRange(1000)*100),fair=Math.round(100/(n1+1));
    xp.push({t:'實際勝率',h:`${dl(l)} 對上還沒蓋牌的 ${n1} 位對手${raised?'（已經算進加注者的牌比較強）':''}，打到最後的勝率約 ${er}%。${n1+1} 個人平分的話每人是 ${fair}%，${er>=fair*1.3?'你明顯比平均好。':er>=fair*.9?'和平均差不多。':'比平均差。'}${t===0&&er>=fair*.9?`不過勝率不是全部：${dl(l)} 中了對子也常輸給踢腳更大的同類牌，翻牌後${late?'':'又沒位置，'}很難打，新手照起手牌表蓋掉比較穩。`:''}`});
    if(!raised&&behind)xp.push({t:'後面的人',h:`後面還有 ${behind} 人沒行動，其中有人拿到 AA、KK、QQ、JJ、AK 這類頂級牌的機率約 ${Math.round((1-Math.pow(1-44/1326,behind))*100)}%。後面的人越多，越要小心。`});
    const R=(o)=>Object.assign({sit,info,xp,eq:er},o);
    if(!raised){
      const to=cap(3*BBV+BBV*lp);
      if(t===1||t===2||(t===3&&late))return R({cat:'a',ok:['a'],to,title:`加注到 ${to}`,dir:A('積極：加注入池'),why:`${dl(l)} 屬於「${TN[t]}」${t===3?'，而你在後位，可以玩':''}。好牌要主動加注入池：逼走弱牌，讓底池裡的人變少，比只跟注更容易贏。${lp?`前面有 ${lp} 人只跟注，所以每多一人多加 1 個大盲。`:''}`,next:'翻牌後如果中了對子以上或強聽牌，繼續下注；沒中而對手下注，大多可以放棄。'});
      if(pos==='BB'&&call===0)return R({cat:'p',ok:['p'],title:'過牌',dir:Md('穩健：免費看翻牌'),why:`${dl(l)} 不是好牌，但你是大盲、前面沒人加注，不用再花錢就能看翻牌，過牌就好。`,next:'翻牌要中到牌（對子以上或聽牌）才繼續；沒中就過牌，對手下注就蓋牌。'});
      if(t===3)return R({cat:'f',ok:['f'],title:'蓋牌',dir:C('保守：蓋牌'),why:`${dl(l)} 是「後位才玩」的牌，你在${where}，後面還有很多人要行動，蓋牌。`,next:'等你輪到後位（切位、莊家）時，這種牌就可以玩了。'});
      return R({cat:'f',ok:['f'],title:'蓋牌',dir:C('保守：蓋牌'),why:`${dl(l)} 不在起手牌表裡。新手階段直接蓋牌，省下的籌碼就是賺到的。${pos==='SB'?'小盲雖然只要再補 ${SBV}，但翻牌後你最先行動，位置最差。':''}`,next:'蓋牌後看看其他人怎麼打，記住誰常加注、誰很少加注。'});
    }
    const wild=ager&&ager.bot.wild,tight=ager&&ager.bot.honest;
    const callNext='翻牌要中到牌（對子以上或強聽牌）才繼續；沒中而對手下注，就蓋牌。';
    if(['AA','KK','QQ','AKs','AKo'].includes(l)){const to=cap(G.curBet*3);return R({cat:'a',ok:['a','p'],to,title:`再加注到 ${to}`,dir:A('積極：再加注'),why:`${dl(l)} 是頂級起手牌。有人加注時再加注一次（叫「3-bet」），讓底池變大、對手付更多錢。`,next:'對手再加注回來的話，AA、KK 可以直接全下；其他牌跟注看翻牌就好。'})}
    if(t===1&&wild){const to=cap(G.curBet*3);return R({cat:'a',ok:['a','p'],to,title:`再加注到 ${to}，或跟注`,dir:A('積極：再加注'),why:`${dl(l)} 很強。${ager.name}什麼牌都愛加注，你的牌很可能比對方好，再加注可以多贏一點；只跟注也可以。`,next:callNext})}
    if(t===1)return R({cat:'p',ok:['p','a'],title:`跟注 ${call}`,dir:Md('穩健：跟注看翻牌'),why:`${dl(l)} 很強但還不到頂級，對手已經加注，跟注看翻牌比較穩。`,next:callNext});
    if(t===2&&tight)return R({cat:'f',ok:['f','p'],title:'蓋牌',dir:C('保守：蓋牌'),why:`${dl(l)} 平常可以玩，但${ager.name}很少加注，對方加注時你的牌很可能落後，蓋牌比較安全。`,next:'記住：同樣的牌，面對不同的人要有不同的打法。'});
    const lim=wild?.15:.1;
    if(t===2&&call<=p.stack*lim)return R({cat:'p',ok:['p','f'],title:`跟注 ${call}`,dir:Md('穩健：跟注看翻牌'),why:`${dl(l)} 是可玩的牌，跟注 ${call} 不到你籌碼的${wild?'一成半':'一成'}，可以跟進去看翻牌。${wild?`${ager.name}常常亂加注，可以放寬一點。`:''}`,next:callNext});
    if(t===2)return R({cat:'f',ok:['f','p'],title:'蓋牌',dir:C('保守：蓋牌'),why:`${dl(l)} 可以玩，但要跟 ${call} 太貴了（超過籌碼的${wild?'一成半':'一成'}），對手加這麼大通常牌很好。`,next:'蓋牌後看看對手最後亮什麼牌，下次更好判斷。'});
    const pp=l.length===2,deep=ager&&Math.min(p.stack,ager.stack)>=call*15;
    if(pp&&late&&deep&&call<=p.stack*.1&&(wild||lp+opps.length>=2))return R({cat:'p',ok:['p','f'],title:`跟注 ${call}，或蓋牌`,dir:Md('穩健：便宜看翻牌'),why:`${dl(l)} 這種小對子在後位，跟注的錢不多、雙方籌碼又夠深，可以跟進去「賭三條」：翻牌中三條的機會約 12%（大約 8 次中 1 次），中了常能從${ager.name}${wild?'很寬的加注範圍':'的大牌'}身上贏一個大底池。沒中就放棄。`,next:'翻牌沒中三條，對手下注就蓋牌；中了三條就積極下注或加注。'});
    return R({cat:'f',ok:['f'],title:'蓋牌',dir:C('保守：蓋牌'),why:pp?`有人加注，${dl(l)} 這種小對子沒中三條很難贏。跟注要夠便宜、籌碼要夠深（至少是跟注金額的 15 倍）才划算，現在不符合，蓋牌。`:`有人加注通常代表牌不錯。${dl(l)} 跟進去很容易被更大的同類牌壓制（例如對上踢腳更大的牌），蓋牌。`,next:'蓋牌後看看對手最後亮什麼牌，下次更好判斷。'});
  }
  const dr=drawInfo(p.hole,G.board),tex=boardTex(G.board),rd=handRead(p.hole,G.board);
  const eq=eqRange(1500),e=Math.round(eq*100),eRand=Math.round(eqMC(p.hole,G.board,opp,800)*100);
  const info=[`目前牌型：${handName(ev([...p.hole,...G.board]))}`];
  if(dr)info.push(`聽牌：差一張成${dr.kind}，有 ${dr.o} 張 outs，中的機率約 ${dr.p}%（${dr.rule}）`);
  info.push(`勝率：約 ${e}%（依 ${opp} 位對手的打法和動作，推算他們可能拿的牌）`);
  const ft='勝率是依每位對手的打法和這手的動作推算他可能拿的牌再模擬出來的。推算不一定完全準，但比把對手當成隨機牌更接近實際。';
  sit.push(rd.t,...tex.n.slice(0,2));
  if(opp===1)sit.push(`只剩${opps[0].name}一位對手，單挑時可以打得積極一點${call>0?'':'。'+opps[0].bot.tip}`);
  else if(opp>=3)sit.push(`還有 ${opp} 位對手，總有人中牌的機會很高，虛張聲勢很難成功，要靠真的有牌`);
  const acts=opps.filter(canAct);
  if(acts.length){
    if(acts.every(q=>ORD(q.i)<ORD(0)))sit.push('你最後行動（叫「有位置」），可以先看對手怎麼做再決定，這是很大的優勢');
    else if(acts.every(q=>ORD(q.i)>ORD(0)))sit.push('你要最先行動（叫「沒位置」），資訊比較少，中等的牌常用過牌來控制底池');
  }
  const pfr=G.ag[0];
  if(call===0&&G.street===1&&pfr===0)sit.push('你是翻牌前加注的人，對手會覺得你的牌比較好，你下注容易讓他們蓋牌');
  else if(call===0&&pfr>0&&!G.P[pfr].folded&&G.P[pfr].acted&&G.P[pfr].bet===0)sit.push(`翻牌前加注的${G.P[pfr].name}這輪過牌了，可能沒中牌`);
  if(call>0&&ager)sit.push(ager.bot.bet);
  const eff=Math.min(p.stack,Math.max(...opps.map(q=>q.stack))),spr=eff/pot;
  if(eff>0&&spr<=2&&rd.own!==false)sit.push('剩下的籌碼不到底池的 2 倍，有頂對以上的牌就準備打到底（全下），不用太猶豫');
  else if(spr>=8&&rd.c<=1)sit.push(`籌碼還很深（剩下的籌碼是底池的 ${Math.floor(spr)} 倍），只有一對的話，別把全部籌碼打進去`);
  let os=null;const oi=G.street<3?outsInfo(p.hole,G.board):null;
  if(oi){
    const n=oi.outs,turn=G.street===2,mult=!turn&&call>0&&(call>=p.stack||!opps.some(canAct))?4:2;
    os=Object.assign(oi,{h:p.hole,b:G.board,n,turn,mult,call,pot,est:Math.min(n*mult,100),
      exact:Math.round((turn?n/46:mult===4?1-(47-n)*(46-n)/(47*46):n/47)*1000)/10,need:call>0?Math.round(call/(pot+call)*100):null});
    const k=info.findIndex(x=>x.startsWith('聽牌：'));if(k>=0)info.splice(k,1);
  }
  const xp=[],pf=G.ag[0],tgt=call>0&&ager?ager:opp===1?opps[0]:(pf>0&&!G.P[pf].folded?G.P[pf]:null);
  if(tgt){const rv=rangeView(tgt.i),B=rv.B;xp.push({t:'對手範圍',h:`依${tgt.name}的打法和這手到目前的動作推算，可能的牌：強牌（${rv.paired?'三條以上':'兩對以上'}）${B[0]}%、${rv.paired?'兩對（一對在公共牌上）':'一對'} ${B[1]}%、${G.street<3?`聽牌 ${B[2]}%、`:''}沒中 ${B[3]}%。`})}
  xp.push({t:'實際勝率',h:`對上對手可能拿的牌，你的勝率約 ${e}%；如果把對手當成隨機牌是 ${eRand}%。${e<eRand-5?'對手的動作代表牌比隨機強，實際勝率比較低。':e>eRand+5?'對手的動作顯示牌偏弱，實際勝率比較高。':'兩種算法差不多。'}`});
  if(call>0){
    const evc=Math.round((eq*(pot+call)-call)*10)/10;
    xp.push({t:'期望值',h:`跟注 ${call}，長期平均每次${evc>=0?'賺':'賠'} ${Math.abs(evc)} 籌碼（勝率 ${e}% × 跟注後底池 ${pot+call} − 跟注 ${call}）。${evc>=0?'期望值是正的：就算這次輸了，同樣的情況打很多次，長期是賺的。':'期望值是負的：就算這次碰巧贏了，同樣的情況打很多次，長期是虧的。'}`});
    if(G.lb&&G.lb.st===G.street&&G.lb.i===agI&&ager&&G.lb.pb>0){
      const f=G.lb.x/G.lb.pb,be=Math.round(G.lb.x/(G.lb.pb+G.lb.x)*100);
      xp.push({t:'下注大小',h:`${ager.name}下了底池的 ${Math.round(f*100)}%。${f<.4?'小注通常是中等的牌想便宜看下一張，或是用小代價試探你。':f<=.8?'中等大小的下注，強牌和聽牌都常這樣下。':'大注通常是「兩極化」：要嘛很強，要嘛是詐唬，中等的牌很少下這麼大。'}`});
      xp.push({t:'對手的算盤',h:`這個下注只要你蓋牌的機會超過 ${be}%，${ager.name}就算拿爛牌詐唬也有賺。所以面對這種下注不能一律蓋牌，不然會被詐唬吃定。${eq<call/(pot+call)?'不過你這手牌太弱，蓋掉沒關係，要跟就用比較好的牌來跟。':'你這手牌夠好，正是該跟的那種牌。'}`});
    }
  }
  if(os&&call>0&&os.est<os.need&&G.street<3){
    const hp=os.n/(G.street===1?47:46),W=Math.max(0,Math.ceil(call/hp-(pot+call)));
    xp.push({t:'隱含賠率',h:`只看現在的底池，聽牌不夠划算。但如果中牌後還能從對手身上多贏 ${W} 籌碼以上，跟注就划算。${ager?`${ager.name}還有 ${ager.stack} 籌碼，${W>ager.stack?'就算全贏過來也不夠，應該蓋牌。':ager.bot.station?'他什麼都跟，中了比較容易拿到。':ager.bot.honest?'他很保守，你中了牌他可能就不付錢了。':'要看你中了之後他會不會付錢。'}`:''}`});
  }
  if(/踢腳偏小|只用到一張不大的手牌/.test(rd.t))xp.push({t:'反向隱含賠率',h:'你的牌看起來不錯，但遇到更大的同類牌時會輸很多（例如踢腳比人小、同花比人小）。被大注跟注或加注時要特別小心。'});
  const bsc=[0,0,0,0];G.board.forEach(c=>bsc[c&3]++);const fsu=bsc.findIndex(x=>x>=3);
  if(fsu>=0&&catOf(ev([...p.hole,...G.board]))<5){const bl=p.hole.filter(c=>(c&3)===fsu&&(c>>2)>=11);if(bl.length)xp.push({t:'阻擋牌',h:`公共牌有 ${bsc[fsu]} 張 ${SU[fsu]}，你手上有 ${bl.map(cn).join('、')}，對手就不可能有${bl.some(c=>c>>2===12)?'最大的 A 同花':'K 大的同花'}。這叫「阻擋牌」，你下注詐唬時會比較有說服力。`})}
  if(G.street===1&&pf>=0&&!G.P[pf].folded){
    const hi=Math.max(...G.board.map(c=>c>>2)),who=pf===0?'你':G.P[pf].name;
    if(hi>=10&&!tex.wet)xp.push({t:'牌面對誰有利',h:`公共牌有大牌又不連，對翻牌前加注的${who}有利：加注的人手上大牌比較多，比較容易中。${pf===0?'你可以多下注施壓。':'他下注時不一定有牌，但常常有。'}`});
    else if(hi<=7&&tex.wet)xp.push({t:'牌面對誰有利',h:`公共牌又小又連，對只跟注的人比較有利（小對子、同花連張常常跟注）。${pf===0?'你翻牌前加注、手上多半是大牌，這種牌面不一定中，要小心。':`${who}翻牌前加注，這種牌面不一定有中。`}`});
  }
  const R=(o)=>Object.assign({sit,info,ft,os,eq:e,xp},o);
  if(call===0){
    if(eq>=.6){
      let f=2/3,w2='下注約底池的 2/3，讓比你差的牌付錢，也讓聽牌的人不能免費看下一張。';
      if(opp===1&&opps[0].bot.station){f=.8;w2=`${opps[0].name}幾乎什麼都跟，可以下大一點，讓對方多付一點。`}
      else if(tex.wet&&G.street<3){f=.75;w2='公共牌容易成聽牌，下大一點，不讓聽牌的人便宜看下一張。'}
      const to=cap(Math.max(BBV,pot*f));
      return R({cat:'a',ok:['a'],to,title:`下注 ${to}`,dir:A('積極：價值下注'),why:`勝率約 ${e}%，你很可能領先，應該下注。${w2}`,next:G.street<3?'如果被加注，要重新想一想：對手加注通常代表牌很強。下一張如果出現同花或順子的牌，要放慢。':'河牌被加注的話，只有一對就要考慮蓋牌。'});
    }
    if(dr&&dr.o>=8&&G.street<3&&opp<=2&&!opps.some(q=>q.bot.station)){
      const to=cap(Math.max(BBV,pot/2));
      return R({cat:'a',ok:['a','p'],to,title:`下注 ${to}（半詐唬），或過牌`,dir:A('積極：半詐唬'),why:`你還沒成牌，但有 ${dr.o} 張 outs 的強聽牌。現在下注叫「半詐唬」：對手蓋牌你直接贏，被跟注也還有約 ${Math.min(dr.o*2,99)}% 的機會在下一張中牌。對手不多時特別好用。`,next:'中了牌就積極下注；沒中而對手下大注，就放棄。'});
    }
    if(G.street===1&&pfr===0&&opp===1&&!tex.wet&&opps[0].bot.bluffable){
      const to=cap(Math.max(BBV,pot*.4));
      return R({cat:'a',ok:['a','p'],to,title:`下小注 ${to}（持續下注），或過牌`,dir:A('積極：主動搶底池'),why:`勝率約 ${e}%，牌不算強。但你是翻牌前加注的人、只剩一位對手、公共牌也很乾，這時下一個小注（叫「持續下注」）常能讓對手直接蓋牌。`,next:'對手跟注或加注，代表有牌；轉牌沒進步就過牌，準備放棄。'});
    }
    if(eq>=.4)return R({cat:'p',ok:['p','a'],to:cap(Math.max(BBV,pot/3)),title:'過牌，或下小注',dir:Md('穩健：控制底池'),why:`勝率約 ${e}%，不上不下。過牌最安全；想主動一點可以下約底池 1/3 的小注。`,next:'對手下小注可以跟；下大注就要小心，用底池賠率決定。'});
    return R({cat:'p',ok:['p'],title:'過牌',dir:C('保守：免費看牌'),why:G.street===3?`勝率只有約 ${e}%。河牌已經沒有下一張，過牌，對手下注就考慮蓋牌。`:`勝率只有約 ${e}%，不用花錢就能看下一張牌，過牌${dr?'，你還有聽牌的機會':''}。`,next:G.street===3?'對手下注的話，大多應該蓋牌。':dr?'下一張中了聽牌就積極下注；沒中而對手下大注就放棄。':'下一張沒有幫助的話，對手下注就蓋牌。'});
  }
  const po=call/(pot+call),pp=Math.round(po*100);
  info.push(`底池賠率：跟注 ${call} ÷（底池 ${pot} + ${call}）＝ ${pp}%，勝率要高於這個才划算`);
  if(eq>=.7){const to=cap(G.curBet+Math.max(G.lastRaise,(pot+call)*.75));return R({cat:'a',ok:['a','p'],to,title:`加注到 ${to}`,dir:A('積極：加注'),why:`勝率約 ${e}%，遠高於需要的 ${pp}%。加注讓底池變大，從比你差的牌身上多贏一點。`,next:'對手再加注回來的話，代表牌非常強，要想清楚再繼續。'})}
  if(eq>=po){
    return R({cat:'p',ok:eq>=.55?['p','a']:['p'],title:`跟注 ${call}`,dir:Md('穩健：跟注看牌'),why:`勝率約 ${e}%，高於需要的 ${pp}%，長期來看跟注划算。${eq-po<.08?'不過差距不大，對手下注通常代表牌不差。':''}`,next:G.street===3?'跟注後就攤牌比大小了。':'下一張對你有幫助就可以主動一點；沒幫助而對手繼續下大注，要考慮放棄。'});
  }
  return R({cat:'f',ok:['f'],title:'蓋牌',dir:C('保守：放棄這手'),why:`勝率約 ${e}%，低於需要的 ${pp}%，長期跟注會虧。${dr?'就算算上聽牌也不夠划算。':''}`,next:'蓋牌不丟臉，省下的籌碼就是賺到的。'});
}
function raiseOpts(){
  const p=G.P[0],call=G.curBet-p.bet,pot=potT(),max=p.bet+p.stack,min=Math.min(G.curBet+G.lastRaise,max);
  let o;
  if(G.street===0&&G.curBet<=BBV){const l=BBV*limpers();o=[['3BB',3*BBV+l],['4BB',4*BBV+l],['5BB',5*BBV+l]]}
  else if(G.street===0)o=[['2.5倍',G.curBet*2.5],['3倍',G.curBet*3],['4倍',G.curBet*4]];
  else o=[['½池',.5],['⅔池',.66],['1池',1]].map(([n,f])=>[n,G.curBet+(pot+call)*f]);
  o=o.map(([n,v])=>[n,Math.max(min,Math.min(max,r10(v)))]);o.push(['全下',max]);
  return {o,min,max};
}
function uAct(type){
  if(G.phase!=='play'||G.cur!==0)return;
  const p=G.P[0],call=G.curBet-p.bet,h=G.hint;
  if(type==='raise'&&p.stack<=call)type='call';
  const cat=type==='fold'?'f':type==='raise'?'a':'p';
  const act=type==='fold'?'蓋牌':type==='check'||call===0&&type==='call'?'過牌':type==='call'?`跟注 ${Math.min(call,p.stack)}`:(G.curBet?`加注到 ${G.raiseTo}`:`下注 ${G.raiseTo}`);
  const ok=h.ok.includes(cat);
  const d={st:STN[G.street],act,ok,rec:h.title,why:h.why,dir:h.dir.t,si:G.street,u:cat,c:h.cat,k:h.dir.k,fc:call>0};
  if(type==='fold'&&call===0){d.ok=false;d.why='沒人下注時過牌是免費的，不需要蓋牌。'}
  G.dec.push(d);G.lastFb=d;
  if(type==='fold')G.fast=true;
  doAct(0,type,G.raiseTo);
}
function setRT(v){G.raiseTo=+v;const e=document.getElementById('rto');if(e)e.textContent=v;const s=document.getElementById('rsl');if(s)s.value=v}
function gReset(){if(!confirm(`所有人的籌碼回到 ${START}，重新開始？`))return;clearTimeout(G.timer);ST.game.stacks=Array(oppList().length+1).fill(START);ST.game.btn=-1;save();G={phase:'idle',P:[],board:[],log:[],dec:[]};render()}
function gRebuy(){ST.game.stacks[0]=START;save();render()}
function gHint(m){ST.game.hint=m;save();render()}
function gCalc(v){ST.game.calc=v;save();render()}
function gBar(v){ST.game.bar=v;save();render()}
// 對手設定：人數（1–5 位電腦）、名字、打法
function gOppN(d){
  const o=oppList().map(x=>Object.assign({},x)),n=Math.min(5,Math.max(1,o.length+d));if(n===o.length)return;
  if(ST.game.stacks.some(x=>x!==START)&&!confirm(`改變人數會讓所有人的籌碼回到 ${START}，確定嗎？`))return;
  if(n>o.length){const used=o.map(x=>x.n),nx=OPP0.find(x=>!used.includes(x.n));o.push(nx?Object.assign({},nx):{n:`電腦${n}`,s:'bal'})}else o.pop();
  ST.game.opp=o;ST.game.stacks=Array(n+1).fill(START);ST.game.btn=-1;save();render();
}
function gOppName(i,v){const o=oppList().map(x=>Object.assign({},x));v=String(v).trim().slice(0,6);o[i].n=v||(OPP0[i]?OPP0[i].n:`電腦${i+1}`);ST.game.opp=o;save();render()}
function gOppSty(i,v){const o=oppList().map(x=>Object.assign({},x));if(!BSTY[v])return;o[i].s=v;ST.game.opp=o;save();render()}

// 牌桌上的座位：5 個位置，依電腦人數平均挑
const SEAT5=[[11,73],[11,29],[50,14],[89,29],[89,73]],BET5=[[30,76],[30,41],[50,35],[70,41],[70,76]];
const LAY={1:[2],2:[1,3],3:[1,2,3],4:[0,1,3,4],5:[0,1,2,3,4]};
const seatXY=i=>SEAT5[LAY[NP()-1][i-1]],betXY=i=>i?BET5[LAY[NP()-1][i-1]]:[50,89];
function seatH(p){
  const [x,y]=seatXY(p.i),done=G.phase==='done',act=G.cur===p.i&&G.phase==='play';
  const cards=(p.show||done)?`<div class="cards xs">${p.hole.map(c=>cardH(c,p.folded?'dim':'')).join('')}</div>`:p.folded?'':'<div class="cb"></div><div class="cb"></div>';
  const tag=act?'思考中…':p.folded?'蓋牌':(p.show&&p.val!=null&&G.street===4)?handName(p.val):p.allin?'全下':p.last;
  return `<div class="seat ${act?'act':''} ${p.folded?'out':''} ${x<50?'lf':''}" style="left:${x}%;top:${y}%"><div class="box">${p.i===G.btn?'<span class="dbtn">D</span>':''}<div class="nm">${p.name}</div><div class="stk">${p.stack}</div><div class="hc">${cards}</div></div><div class="tag">${tag||posOf(p.i)}</div></div>`;
}
function rPlay(){
  const gs=ST.game;
  if(G.phase==='idle'){
    const ol=oppList();
    let h=`<h1>牌局</h1><p class="sub">跟 ${ol.length} 位電腦對手打完整的一手，教練在你每次行動前給建議</p>
    <p class="muted" style="margin:0">每人 ${START} 籌碼，盲注 ${SBV}／${BBV}，所有下注都以 ${U} 為單位。籌碼會延續到下一手，莊家每手往左移一位。</p>
    <div class="row" style="margin-top:14px"><span>對手人數<span class="muted">　共 ${ol.length+1} 人一桌</span></span><div class="stepper"><button onclick="gOppN(-1)" aria-label="減少對手" ${ol.length<=1?'disabled':''}>−</button><span>${ol.length}</span><button onclick="gOppN(1)" aria-label="增加對手" ${ol.length>=5?'disabled':''}>+</button></div></div>
    <div class="lbl">對手的名字和打法</div>
    ${ol.map((o,i)=>{const t=BSTY[o.s]||BSTY.bal;return `<div class="opp"><input value="${esc(o.n)}" maxlength="6" onchange="gOppName(${i},this.value)" aria-label="第 ${i+1} 位對手的名字"><select onchange="gOppSty(${i},this.value)" aria-label="第 ${i+1} 位對手的打法">${Object.keys(BSTY).map(k=>`<option value="${k}" ${k===o.s?'selected':''}>${BSTY[k].style}</option>`).join('')}</select><div class="muted">${t.d}<br><span style="font-size:12px">撲克術語：${t.term}</span></div></div>`}).join('')}
    <p class="cap" style="margin-top:6px">改人數會讓所有人的籌碼回到 ${START}；改名字、打法不影響籌碼。人少時每個人玩的牌會變多，後位的範圍也更寬。</p>
    <div class="lbl">教練建議</div>
    <div class="seg"><button class="${gs.hint==='auto'?'on':''}" onclick="gHint('auto')">直接顯示</button><button class="${gs.hint!=='auto'?'on':''}" onclick="gHint('tap')">我先想，再點開看</button></div>
    <div class="lbl">勝率條（輪到你時，用長條看勝率夠不夠）</div>
    <div class="seg"><button class="${gs.bar!==false?'on':''}" onclick="gBar(true)">顯示</button><button class="${gs.bar===false?'on':''}" onclick="gBar(false)">不顯示</button></div>
    <div class="lbl">速算練習（翻牌後輪到你時，練算 outs 和底池賠率）</div>
    <div class="seg"><button class="${gs.calc!==false?'on':''}" onclick="gCalc(true)">顯示</button><button class="${gs.calc===false?'on':''}" onclick="gCalc(false)">不顯示</button></div>
    <div class="row" style="margin-top:16px"><span>你的籌碼</span><span class="big-n" style="font-size:30px">${gs.stacks[0]}</span></div>`;
    h+=gs.stacks[0]<BBV?`<p class="err">籌碼輸光了，重新買入就能繼續。</p><button class="pri full" onclick="gRebuy()">重新買入 ${START} 籌碼</button>`:`<button class="pri full" style="margin-top:12px" onclick="gStart()">發牌</button>`;
    if(ST.play.hands)h+=`<button class="full" style="margin-top:8px" onclick="gReset()">籌碼歸位，重新開始</button>`;
    M.innerHTML=h;return;
  }
  const me=G.P[0],my=G.cur===0&&G.phase==='play',pot=potT(),done=G.phase==='done';
  let h=`<div class="row"><h1>牌局</h1><span class="muted">第 ${G.no} 手　${STN[Math.min(G.street,4)]}</span></div>
  <div class="tbl"><div class="felt"></div>
  <div class="pot">底池 <b>${pot}</b></div>
  <div class="bd">${[0,1,2,3,4].map(k=>cardH(G.board[k])).join('')}</div>
  ${G.P.slice(1).map(seatH).join('')}
  ${G.P.filter(p=>p.bet>0).map(p=>`<div class="chip" style="left:${betXY(p.i)[0]}%;top:${betXY(p.i)[1]}%">${p.bet}</div>`).join('')}
  </div>`;
  const myHand=G.board.length>=3?handName(ev([...me.hole,...G.board])):null;
  h+=`<div class="me ${my?'act':''}"><div class="cards">${me.hole.map(c=>cardH(c,me.folded?'dim':'')).join('')}</div><div class="inf">
  <span class="pos" style="font-size:13px;padding:0 8px">${posOf(0)} ${posZ(0)}</span>${G.btn===0?' <span class="dbtn" style="position:static;display:inline-block">D</span>':''}
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
      ${R.max>R.min?`<input id="rsl" type="range" min="${R.min}" max="${R.max}" step="${U}" value="${G.raiseTo}" oninput="setRT(this.value)" aria-label="加注金額">`:''}
      <button class="pri full" onclick="uAct('raise')">${G.curBet?'加注到':'下注'} <span id="rto">${G.raiseTo}</span></button></div>`;
    }
    const H=G.hint;
    h+=eqBar()+calcPanel();
    if(G.hintOpen)h+=`<div class="fb coach"><b>教練建議：${H.title}</b><div><span class="dir ${H.dir.k}">${H.dir.t}</span></div><div>${H.why}</div>
    <div class="ch">局勢</div><ul>${H.sit.map(x=>`<li>${x}</li>`).join('')}</ul>
    ${H.xp&&H.xp.length?`<div class="ch">專家分析</div><ul class="xp">${H.xp.map(x=>`<li><b>${x.t}</b>　${x.h}</li>`).join('')}</ul>`:''}
    <div class="ch">接下來</div><div class="nx">${H.next}</div>${ST.game.calc===false?outsGame(H):''}
    <div class="ch">數字</div><ul>${H.info.map(x=>`<li>${x}</li>`).join('')}</ul>${H.ft?`<div class="ft">${H.ft}</div>`:''}</div>`;
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
    ${me.stack<BBV?`<button class="full" onclick="gRebuy();gStart()">重新買入 ${START} 籌碼，再來一手</button>`:''}
    <div class="lbl" style="margin-top:18px">復盤：所有人的手牌</div>
    ${G.P.map(p=>`<div class="rv"><span class="n">${p.name}<br><span class="muted" style="font-size:12px">${posOf(p.i)}</span></span><div class="cards mini">${p.hole.map(c=>cardH(c)).join('')}</div><span class="h">${p.folded?`${STN[p.foldSt]}蓋牌`:G.board.length===5?handName(ev([...p.hole,...G.board])):'沒到攤牌'}${G.pots.some(x=>x.w.includes(p.i))?'　<span class="ok-t">贏</span>':''}</span></div>`).join('')}
    <div class="lbl" style="margin-top:18px">你的決定</div>
    ${G.dec.length?G.dec.map(d=>`<div class="dc"><span class="${d.ok?'ok-t':'bad-t'}">${d.ok?'✓':'✗'}</span>　${d.st}：你${d.act}${d.ok?'':`<div class="w">教練建議${d.rec}（${d.dir}）。${d.why}</div>`}</div>`).join(''):'<p class="muted">這手沒輪到你做決定。</p>'}
    <button class="full" style="margin-top:14px" onclick="G.phase='idle';render()">回到牌局設定</button>`;
  }
  h+=`<div class="lbl" style="margin-top:18px">牌局紀錄</div><div class="log" id="glog">${G.log.map(l=>`<div class="${l.k}">${l.t}</div>`).join('')}</div>`;
  M.innerHTML=h;
  const L=document.getElementById('glog');if(L)L.scrollTop=L.scrollHeight;
}

