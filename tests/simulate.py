"""牌局引擎自動測試：用 Playwright 開啟網站，隨機替「你」做決定，連續打幾百手牌。

檢查項目：
  - 所有籌碼和下注都是 10 的倍數（不會出現 1、5 這種零頭）
  - 籌碼守恆：每一刻「所有人籌碼 + 已下注」等於這手開始時的總籌碼
  - 沒有負籌碼、每手都能正常結束（不會卡住）
  - 教練建議每個欄位都有內容，沒有 undefined、NaN 之類的錯字
  - 牌局中的速算練習每題都有正確答案，作答完會出現結論
  - 每次輪到你都有勝率條、速算小抄顯示正常
  - 2 到 6 人桌輪流打，打法隨機；對手名字有 HTML 特殊字元也能正常顯示
  - 每次教練建議都有專家分析；推算的對手範圍合理（緊的玩家加注後 AA 遠比 72s 可能），推算勝率夠快
  - 每手都有記到牌局紀錄，「紀錄 → 牌局分析」能正常顯示
  - Outs 練習出 1000 題：outs 數和逐張檢查一致、每步選項有正確答案、說明沒有錯字
  - 頁面沒有 JavaScript 錯誤

用法：python tests/simulate.py [手數，預設 300]
需要：pip install playwright（Chromium 用系統已安裝的，或 playwright install chromium）
"""
import functools
import http.server
import os
import sys
import threading

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HANDS = int(sys.argv[1]) if len(sys.argv) > 1 else 300

# 讓 setTimeout 立刻執行，電腦思考不用等 0.8 秒
FAST_TIMERS = """
const _st = window.setTimeout;
window.setTimeout = (fn, ms, ...a) => _st(fn, 0, ...a);
"""

# 在頁面裡跑的駕駛程式：輪到你就隨機行動，每手結束檢查籌碼
DRIVER = """
async (hands) => {
  const wait = () => new Promise(r => setTimeout(r, 0));
  const errs = [];
  const sum = a => a.reduce((x, y) => x + y, 0);
  ST.game.stacks = Array(6).fill(START); ST.game.btn = -1; save();
  go('play');
  let rangeMs = 0, qzSeen = 0, osSeen = 0, coachSeen = 0, played = 0, rebuys = 0, showdowns = 0, splits = 0, sidePots = 0, idle = 0;
  // 每 40 手換一種桌子：2 到 6 人、隨機打法，其中一位名字有 HTML 特殊字元（要正常顯示、不能變成標籤）
  const sizes = {};
  const setTable = k => {
    const ks = Object.keys(BSTY);
    ST.game.opp = Array.from({length: k}, (_, j) => ({n: j === 0 ? '<b>&小' : '電腦' + (j + 1), s: ks[Math.floor(Math.random() * ks.length)]}));
    ST.game.stacks = Array(k + 1).fill(START); ST.game.btn = -1;
  };
  while (played < hands) {
    if (played % 40 === 0) setTable([5, 1, 2, 3, 4][(played / 40) % 5]);
    if (ST.game.stacks[0] < BBV) { gRebuy(); rebuys++; }
    gStart();
    const startTotal = sum(G.P.map(p => p.start));
    let steps = 0;
    while (G.phase === 'play') {
      if (++steps > 5000) { errs.push(`第 ${G.no} 手卡住：phase=${G.phase} cur=${G.cur} street=${G.street}`); break; }
      const now = sum(G.P.map(p => p.stack + p.total));
      if (now !== startTotal) { errs.push(`第 ${G.no} 手籌碼不守恆：${now} ≠ ${startTotal}`); break; }
      if (G.P.some(p => p.stack % U || p.bet % U || p.total % U)) { errs.push(`第 ${G.no} 手出現不是 ${U} 倍數的籌碼：${G.P.map(p => p.stack + '/' + p.bet).join(' ')}`); break; }
      if (G.P.some(p => p.stack < 0)) { errs.push(`第 ${G.no} 手出現負籌碼`); break; }
      if (G.cur === 0) {
        // 速算練習：每題都有正確答案，全部作答後出現結論
        let cp = calcPanel();
        if (G.qz.Q) {
          if (G.qz.Q.some(x => x.r < 0)) { errs.push(`第 ${G.no} 手速算練習選項裡沒有正確答案：${JSON.stringify(G.qz.Q)}`); break; }
          G.qz.Q.forEach((x, i) => qzAns(i, Math.random() < .5 ? x.r : 0));
          cp += calcPanel();
          if (G.qz.Q.length && !cp.includes('class="qr"')) { errs.push(`第 ${G.no} 手速算練習作答完沒有結論`); break; }
          qzSeen++;
        }
        const h = G.hint, txt = [h.title, h.why, h.next, h.dir && h.dir.t, ...(h.sit || []), ...h.info, outsGame(h), cp, eqBar(), ...(h.xp || []).map(x => x.t + x.h)].join('|');
        if (!eqBar().includes('class="eb"')) { errs.push(`第 ${G.no} 手沒有勝率條`); break; }
        if (!h.xp || !h.xp.length) { errs.push(`第 ${G.no} 手教練沒有專家分析`); break; }
        if (h.eq != null && !(h.eq >= 0 && h.eq <= 100)) { errs.push(`第 ${G.no} 手推算勝率不合理：${h.eq}`); break; }
        if (h.os) {
          const dr = drawInfo(G.P[0].hole, G.board);
          if (!dr || dr.o !== h.os.n) { errs.push(`第 ${G.no} 手教練的 outs ${h.os.n} 和 drawInfo ${dr && dr.o} 不一致`); break; }
          osSeen++;
        }
        if (!h.title || !h.why || !h.next || !h.dir || !h.sit || !h.sit.length || /undefined|NaN|null|Infinity/.test(txt)) {
          errs.push(`第 ${G.no} 手教練建議不完整：${txt}`); break;
        }
        coachSeen++;
        const p = G.P[0], call = G.curBet - p.bet, r = Math.random();
        if (r < 0.25) uAct('fold');
        else if (r < 0.7 || p.stack <= call) uAct(call > 0 ? 'call' : 'check');
        else {
          const o = raiseOpts().o;
          setRT(Math.random() < 0.3 ? o[Math.floor(Math.random() * o.length)][1]
                : raiseOpts().min + Math.floor(Math.random() * (raiseOpts().max - raiseOpts().min + 1)));
          uAct('raise');
        }
        idle = 0;
      } else {
        // 等電腦行動或發牌；等很久紀錄都沒有變化就是卡住了
        const n = G.log.length;
        await wait();
        idle = G.log.length === n ? idle + 1 : 0;
        if (idle > 200) { errs.push(`第 ${G.no} 手沒有人在行動（cur=${G.cur}）`); break; }
      }
    }
    if (errs.length) break;
    const end = sum(G.P.map(p => p.stack));
    if (end !== startTotal) { errs.push(`第 ${G.no} 手結束時籌碼 ${end} ≠ 開始時 ${startTotal}`); break; }
    if (sum(G.pots.map(x => x.amt)) !== sum(G.P.map(p => p.total))) {
      errs.push(`第 ${G.no} 手底池分配總額 ${sum(G.pots.map(x => x.amt))} ≠ 下注總額 ${sum(G.P.map(p => p.total))}`); break;
    }
    if (G.street === 4) showdowns++;
    if (G.pots.length > 1) sidePots++;
    if (G.pots.some(x => x.w.length > 1)) splits++;
    sizes[G.P.length] = (sizes[G.P.length] || 0) + 1;
    if (oppList()[0].n === '<b>&小' && document.querySelector('.tbl .nm b')) { errs.push('對手名字裡的 HTML 被當成標籤'); break; }
    played++;
  }
  // 三人平分：公共牌就是同花大順，大家都平手；底池 50 要分成 20、20、10，不能有零頭
  if (!errs.length) {
    const keep = JSON.stringify(ST);
    ST.game.opp = [{n: '甲', s: 'bal'}, {n: '乙', s: 'bal'}]; ST.game.stacks = [START, START, START]; ST.game.btn = -1;
    gStart(); clearTimeout(G.timer);
    G.board = [48, 44, 40, 36, 32]; G.P.forEach((p, k) => { p.folded = false; p.total = [20, 20, 10][k]; p.stack = 100; });
    const before = G.P.map(p => p.stack); showdown();
    const got = G.P.map((p, k) => p.stack - before[k]);
    if (got.reduce((a, b) => a + b, 0) !== 50 || got.some(x => x % U)) errs.push(`三人平分底池 50 分錯了：${got}`);
    G.phase = 'idle'; ST = JSON.parse(keep); save();
  }
  // 兩人對打：莊家下小盲、翻牌前先行動；翻牌後大盲先行動
  if (!errs.length) {
    ST.game.opp = [{n: '電腦', s: 'bal'}]; ST.game.stacks = [START, START]; ST.game.btn = -1;
    for (let k = 0; k < 6 && !errs.length; k++) {
      ST.game.stacks = [START, START]; gStart(); clearTimeout(G.timer);
      if (G.P[G.btn].total !== SBV || G.P[1 - G.btn].total !== BBV) errs.push(`兩人對打盲注錯：莊家下 ${G.P[G.btn].total}`);
      if (G.cur !== G.btn) errs.push(`兩人對打翻牌前應該莊家先行動，現在是座位 ${G.cur}`);
      if (ORD(BBi()) !== 0 || ORD(G.btn) !== 1) errs.push('兩人對打翻牌後應該大盲先行動');
      G.phase = 'idle';
    }
  }
  ST.game.opp = OPP0.map(o => Object.assign({}, o)); ST.game.stacks = Array(6).fill(START); ST.game.btn = -1;
  // 牌局分析：每手都有紀錄，分析頁顯示正常
  if (!errs.length) {
    const want = Math.min(played, 500), last = ST.hist[ST.hist.length - 1];
    if (ST.hist.length !== want) errs.push(`牌局紀錄 ${ST.hist.length} 筆 ≠ 應有 ${want} 筆`);
    if (last && last.no !== ST.play.hands) errs.push(`最後一筆紀錄是第 ${last.no} 手，應該是第 ${ST.play.hands} 手`);
    const decs = ST.hist.reduce((a, x) => a + x.d.length, 0);
    if (played <= 500 && decs !== ST.play.dec.t) errs.push(`紀錄裡的決定 ${decs} 次 ≠ 統計 ${ST.play.dec.t} 次`);
    go('rec'); REC = 'an';
    for (const r of ['all', '50']) {
      SR = r; render();
      const html = M.innerHTML;
      if (/undefined|NaN|null|Infinity/.test(html)) errs.push(`牌局分析（${r}）出現錯字：${html.match(/.{40}(undefined|NaN|null|Infinity).{40}/)}`);
      if (!html.includes('籌碼走勢') || !html.includes('打法風格')) errs.push(`牌局分析（${r}）缺少圖表`);
    }
    go('play');
  }
  // Outs 練習：題目的 outs 數和逐張暴力檢查一致，每一步的選項有正確答案、說明沒有錯字
  const kinds = {};
  if (!errs.length) {
    // 對手範圍：阿明（緊）在前位加注後，AA 的可能性要遠高於 72s；教練一次思考要夠快
    {
      ST.game.stacks[0] = START; gStart(); const i = 1, W = G.R[i], idx = (a, b) => CB.findIndex(([x, y]) => x === Math.min(a, b) && y === Math.max(a, b));
      G.cur = -1; clearTimeout(G.timer);
      rangeUpd(i, 'raise');
      const aa = W[idx(48, 49)], s72 = W[idx(20, 0)];
      if (!(aa > s72 * 10)) errs.push(`範圍推算不合理：阿明加注後 AA 權重 ${aa}，72s 權重 ${s72}`);
      const t0 = performance.now(); for (let k = 0; k < 5; k++) eqRange(1500); const ms = (performance.now() - t0) / 5;
      if (ms > 400) errs.push(`推算勝率太慢：一次 ${Math.round(ms)} 毫秒`);
      rangeMs = Math.round(ms);
      // 公共牌有一對（7♠ 7♦ K♣ 2♥ 9♣）、範圍全部一樣時：用手牌配成兩對的牌要算在中間那一類，不是強牌
      G.board = [20, 22, 47, 1, 31]; G.street = 3; G.R[1].fill(1); G.P[0].hole = [0, 4];
      const B = rangeView(1).B;
      if (!(B[1] > 20 && B[0] < 20)) errs.push(`公共牌有一對時範圍分類不合理：${B}`);
    }
    { const t = rTips(); if (/undefined|NaN|null|Infinity/.test(t) || !t.includes('到河牌')) errs.push('速算小抄內容有錯'); }
    go('eq'); EQM = 'outs';
    // 固定題：使用者回報的牌。手牌 7♥ 8♥，公共牌 10♠ A♠ Q♥ K♥。
    // 任何 J 都讓公共牌自己成順子（不算），但 J♥ 讓你成同花（要算），所以是 13 − 4 = 9 張
    const fx = [
      {h: [21, 25], b: [32, 48, 41, 45], n: 9, kind: 'flush'},
      // 公共牌 5 6 8 9，手上有 10：7 讓公共牌成 5–9 順子，但你有更大的 6–10 順子，要算
      {h: [33, 3], b: [12, 18, 27, 29], n: 4, kind: 'gut'}
    ];
    for (const f of fx) {
      const o = outsInfo(f.h, f.b);
      if (!o || o.outs !== f.n || o.kind !== f.kind) errs.push(`固定題 ${f.h}|${f.b}：應該是 ${f.kind} ${f.n} 張，算出 ${o && o.kind} ${o && o.outs} 張`);
      const d = drawInfo(f.h, f.b);
      if (!d || d.o !== f.n) errs.push(`固定題 ${f.h}|${f.b}：drawInfo 算出 ${d && d.o} 張，應該是 ${f.n}`);
    }
    for (let k = 0; k < 1000 && !errs.length; k++) {
      newOQ(); const q = OQ, kn = [...q.h, ...q.b];
      kinds[q.kind] = (kinds[q.kind] || 0) + 1;
      let n = 0;
      for (let c = 0; c < 52; c++) {
        if (kn.includes(c)) continue;
        const v = catOf(ev([...kn, c])), nb = [...q.b, c];
        if ((v === 4 || v === 5 || v === 8) && !(nb.length >= 5 && ev(nb) >= ev([...kn, c]))) n++;
      }
      if (n !== q.n) { errs.push(`Outs 題目 outs 數 ${q.n} ≠ 逐張檢查 ${n}：${kn}`); break; }
      if (q.fl.length && q.fl.length !== 13 - q.seen) errs.push(`同花 outs ${q.fl.length} 張和「13 − ${q.seen}」對不上：${kn}`);
      if (catOf(ev(kn)) >= 2) errs.push(`Outs 題目已經是${handName(ev(kn))}，不該出題`);
      const need = Math.round(q.B / (q.P + 2 * q.B) * 100);
      if (need !== q.need) errs.push(`Outs 題目需要勝率 ${q.need} ≠ ${need}`);
      for (let i = 0; i < 5; i++) {
        if (oRight(i) < 0) { errs.push(`Outs 第 ${i + 1} 步選項裡沒有正確答案：${JSON.stringify(q.opts[i])}`); break; }
        oAns(i % 2 ? oRight(i) : (oRight(i) + 1) % q.opts[i].length);
        const html = M.innerHTML;
        if (/undefined|NaN|null|Infinity/.test(html)) { errs.push(`Outs 第 ${i + 1} 步出現錯字：${html.match(/.{40}(undefined|NaN|null|Infinity).{40}/)}`); break; }
        oNext();
      }
      if (!/整理/.test(M.innerHTML)) errs.push('Outs 題目做完沒有出現整理');
    }
    go('play');
  }
  return {sizes, rangeMs, qzSeen, osSeen, kinds, coachSeen, played, rebuys, showdowns, splits, sidePots, errs, stacks: ST.game.stacks, stats: ST.play};
}
"""


def main():
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass

    handler = functools.partial(Quiet, directory=ROOT)
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{srv.server_address[1]}/index.html"

    page_errs = []
    with sync_playwright() as pw:
        exe = "/opt/pw-browsers/chromium" if os.path.exists("/opt/pw-browsers/chromium") else None
        try:
            browser = pw.chromium.launch()
        except Exception:
            browser = pw.chromium.launch(executable_path=exe)
        ctx = browser.new_context(service_workers="block")
        ctx.add_init_script(FAST_TIMERS)
        page = ctx.new_page()
        page.on("pageerror", lambda e: page_errs.append(str(e)))
        page.goto(url)
        page.evaluate("localStorage.clear()")
        page.reload()
        res = page.evaluate(DRIVER, HANDS)
        browser.close()
    srv.shutdown()

    print(f"打了 {res['played']} 手：攤牌 {res['showdowns']}、有邊池 {res['sidePots']}、"
          f"平分 {res['splits']}、你重新買入 {res['rebuys']} 次、檢查教練建議 {res['coachSeen']} 次")
    print(f"牌局中遇到聽牌、檢查 Outs 計算 {res['osSeen']} 次；速算練習出現 {res['qzSeen']} 次")
    print(f"各種人數打的手數：{', '.join(f'{k} 人 {v} 手' for k, v in sorted(res['sizes'].items()))}")
    print(f"推算對手範圍的勝率（1500 次模擬）一次約 {res['rangeMs']} 毫秒")
    print(f"Outs 練習出了 {sum(res['kinds'].values())} 題：{res['kinds']}")
    print(f"最後籌碼：{res['stacks']}")
    errs = res["errs"] + [f"JS 錯誤：{e}" for e in page_errs]
    if errs:
        print("失敗：")
        for e in errs:
            print("  -", e)
        sys.exit(1)
    print("通過：籌碼守恆、每手都正常結束、教練建議完整、牌局分析正常、Outs 練習題目正確、沒有 JS 錯誤")


if __name__ == "__main__":
    main()
