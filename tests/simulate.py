"""牌局引擎自動測試：用 Playwright 開啟網站，隨機替「你」做決定，連續打幾百手牌。

檢查項目：
  - 籌碼守恆：每一刻「所有人籌碼 + 已下注」等於這手開始時的總籌碼
  - 沒有負籌碼、每手都能正常結束（不會卡住）
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
  ST.game.stacks = [200, 200, 200, 200, 200, 200]; ST.game.btn = -1; save();
  go('play');
  let played = 0, rebuys = 0, showdowns = 0, splits = 0, sidePots = 0, idle = 0;
  while (played < hands) {
    if (ST.game.stacks[0] < BBV) { gRebuy(); rebuys++; }
    gStart();
    const startTotal = sum(G.P.map(p => p.start));
    let steps = 0;
    while (G.phase === 'play') {
      if (++steps > 5000) { errs.push(`第 ${G.no} 手卡住：phase=${G.phase} cur=${G.cur} street=${G.street}`); break; }
      const now = sum(G.P.map(p => p.stack + p.total));
      if (now !== startTotal) { errs.push(`第 ${G.no} 手籌碼不守恆：${now} ≠ ${startTotal}`); break; }
      if (G.P.some(p => p.stack < 0)) { errs.push(`第 ${G.no} 手出現負籌碼`); break; }
      if (G.cur === 0) {
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
    played++;
  }
  return {played, rebuys, showdowns, splits, sidePots, errs, stacks: ST.game.stacks, stats: ST.play};
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
          f"平分 {res['splits']}、你重新買入 {res['rebuys']} 次")
    print(f"最後籌碼：{res['stacks']}")
    errs = res["errs"] + [f"JS 錯誤：{e}" for e in page_errs]
    if errs:
        print("失敗：")
        for e in errs:
            print("  -", e)
        sys.exit(1)
    print("通過：籌碼守恆、每手都正常結束、沒有 JS 錯誤")


if __name__ == "__main__":
    main()
