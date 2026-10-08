/* 對手範圍：依每個電腦對手的打法和這手的每個動作，推算他可能拿什麼牌 */
// 1326 種兩張牌組合；G.R[i][k] 是第 i 位玩家拿第 k 種組合的相對可能性
const CB=[];for(let a=0;a<52;a++)for(let b=a+1;b<52;b++)CB.push([a,b]);
let CHEN=null;
const chenOf=k=>{if(!CHEN){CHEN=new Float32Array(CB.length);CB.forEach(([a,b],j)=>CHEN[j]=chen(lab(a,b)))}return CHEN[k]};
const sig=x=>1/(1+Math.exp(-x/.05)),u01=x=>Math.min(1,Math.max(0,(x+1)/2));
const OPEN={UTG:9,HJ:8,CO:7,BTN:6,SB:7.5,BB:7};

function rangeInit(){G.R=G.P.map(()=>new Float32Array(CB.length).fill(1));G.hs={}}

// 粗估兩張手牌的聽牌 outs（同花 9、每種能成順的點數 4，最多 15）
function drawOuts(h,b){
  const sc=[0,0,0,0];let rm=0;[...h,...b].forEach(c=>{sc[c&3]++;rm|=1<<(c>>2)});
  let o=0;for(let s=0;s<4;s++)if(sc[s]===4&&h.some(c=>(c&3)===s))o+=9;
  if(sh(rm)<0){let r=0;for(let k=0;k<13;k++)if(!(rm>>k&1)&&sh(rm|1<<k)>=0)r++;o+=Math.min(2,r)*4}
  return Math.min(o,15);
}
// 這條街每種組合的牌力（0–1，對一手隨機牌的勝率估計，含聽牌），每條街算一次
function hsTable(){
  const st=G.street;if(G.hs[st])return G.hs[st];
  const b=G.board,used=new Uint8Array(52);b.forEach(c=>used[c]=1);
  const v=new Float64Array(CB.length).fill(-1),list=[];
  CB.forEach(([x,y],k)=>{if(used[x]||used[y])return;v[k]=ev([x,y,...b]);list.push(v[k])});
  list.sort((p,q)=>p-q);
  const n=list.length,E=new Float32Array(CB.length).fill(-1);
  const pos=(x,le)=>{let l=0,h=n;while(l<h){const m=(l+h)>>1;if(le?list[m]<=x:list[m]<x)l=m+1;else h=m}return l};
  CB.forEach(([x,y],k)=>{
    if(v[k]<0)return;const a=pos(v[k],0),c=pos(v[k],1);let s=(a+(c-a)/2)/n;
    if(b.length<5){const o=drawOuts([x,y],b);if(o)s+=(1-s)*Math.min(.6,o*(b.length===3?4:2)/100)}
    E[k]=s;
  });
  return G.hs[st]=E;
}
// 電腦玩家 i 做了動作 type 之後，依 botDecide() 的規則更新他的範圍（在動作生效前呼叫）
function rangeUpd(i,type){
  const p=G.P[i],b=p.bot,W=G.R&&G.R[i];if(!b||!W||type==='fold')return;
  const call=G.curBet-p.bet;
  if(G.street===0){
    const pos=posOf(i),open=OPEN[pos];
    for(let k=0;k<CB.length;k++){
      if(!W[k])continue;const c=chenOf(k)+b.loose;let L;
      if(G.curBet<=BBV){
        const po=u01(c-open),pr=.35+b.aggr*.6,pl=(b.aggr<.4||pos==='SB')?u01(c-open+2):0;
        L=type==='raise'?po*pr:type==='call'?po*(1-pr)+(1-po)*pl:1-po*pr;
      }else{
        const p3=u01(c-(12-b.loose*.3)),r=p3+(1-p3)*u01(c-9.5)*b.aggr*.35;
        const pc=(1-r)*Math.max(u01(c-(8-b.loose))*(call<=p.stack*.12?1:u01(c-10)),call<=BBV?u01(c-5):0);
        L=type==='raise'?r:pc;
      }
      W[k]*=Math.max(L,.02);
    }
    return;
  }
  const E=hsTable(),n=Math.max(1,live().length-1),pot=potT(),po=call/(pot+call);
  for(let k=0;k<CB.length;k++){
    if(!W[k])continue;if(E[k]<0){W[k]=0;continue}
    const eq=Math.pow(E[k],n);let L;
    if(call===0){
      const p1=sig(eq-.62)*(.45+.5*b.aggr),p2=sig(eq-.45)*b.aggr*.35,pb=1-(1-p1)*(1-p2)*(1-b.bluff);
      L=type==='raise'?pb:1-pb;
    }else{
      const s7=sig(eq-.72)*b.aggr,pr=s7+(1-s7)*b.bluff*.25,pc=(1-pr)*sig(eq-(po+b.cadj));
      L=type==='raise'?pr:pc;
    }
    W[k]*=Math.max(L,.02);
  }
}
// 你對「還沒蓋牌的對手推算出來的牌」的勝率（蒙地卡羅 N 次）
function eqRange(N){
  const me=G.P[0],used=new Uint8Array(52);[...me.hole,...G.board].forEach(c=>used[c]=1);
  const cum=live().filter(q=>q.i!==0).map(q=>{
    const W=G.R[q.i],c=new Float64Array(CB.length);let s=0;
    for(let k=0;k<CB.length;k++){const [a,b]=CB[k];if(!used[a]&&!used[b])s+=W[k];c[k]=s}
    return c;
  });
  const pick=c=>{const t=c[c.length-1];if(!(t>0))return rnd(CB.length);const r=Math.random()*t;let l=0,h=c.length-1;while(l<h){const m=(l+h)>>1;if(c[m]<r)l=m+1;else h=m}return l};
  let win=0;
  for(let it=0;it<N;it++){
    const u=used.slice(),hs=[];
    for(const c of cum){
      let k,t=0;do{k=pick(c);t++}while((u[CB[k][0]]||u[CB[k][1]])&&t<30);
      while(u[CB[k][0]]||u[CB[k][1]])k=rnd(CB.length);
      u[CB[k][0]]=u[CB[k][1]]=1;hs.push(CB[k]);
    }
    const bd=G.board.slice();while(bd.length<5){const c=rnd(52);if(!u[c]){u[c]=1;bd.push(c)}}
    const mv=ev([...me.hole,...bd]);let best=-1,cnt=0;
    for(const h of hs){const v=ev([...h,...bd]);if(v>best){best=v;cnt=1}else if(v===best)cnt++}
    if(mv>best)win++;else if(mv===best)win+=1/(cnt+1);
  }
  return win/N;
}
// 給人看的範圍摘要：大約前幾 % 的牌、常見手牌、翻牌後各類牌的比例
function rangeView(i){
  const W=G.R[i],b=G.board,used=new Uint8Array(52);[...G.P[0].hole,...b].forEach(c=>used[c]=1);
  let tot=0,max=0,cnt=0;const lw={},ln={},B=[0,0,0,0],bc=b.length>=3?catOf(ev(b)):0;
  for(let k=0;k<CB.length;k++){
    const [x,y]=CB[k];if(used[x]||used[y])continue;const w=W[k];cnt++;tot+=w;if(w>max)max=w;
    const l=lab(x,y);lw[l]=(lw[l]||0)+w;ln[l]=(ln[l]||0)+1;
    if(b.length>=3&&w>0){const c=catOf(ev([x,y,...b]));B[c>=3||(c===2&&bc===0)?0:c>bc?1:(b.length<5&&drawOuts([x,y],b)>=8)?2:3]+=w}
  }
  // 範圍裡（可能性至少是最高的一半）的牌，依強弱排：最強幾手、最弱幾手
  const dm=Math.max(...Object.keys(lw).map(l=>lw[l]/ln[l])),cs=l=>chen(l)+(tierOf(l)?(4-tierOf(l))*.1:0);
  const inR=Object.keys(lw).filter(l=>lw[l]/ln[l]>=dm*.5).sort((a,b)=>cs(b)-cs(a));
  return {pct:Math.max(1,Math.round(tot/(max*cnt||1)*100)),top:inR.slice(0,3),low:inR.length>6?inR.slice(-2):[],
    B:B.map(x=>tot?Math.round(x/tot*100):0),paired:bc>=1};
}
