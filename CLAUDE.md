# 撲克練習（poker-trainer）

給德州撲克新手自己用的練習工具。手機優先的 PWA，部署在 Vercel，可加到 iPhone 主畫面當 App 用。使用者是第一次學德州撲克，所有介面文字都要淺白。

- 正式網址：https://poker-trainer-gray-six.vercel.app
- Vercel：team `team_YF2tr0rkXHRZRPtWGdRkT7bG`（qqq5554-oss' projects），project `prj_dnToXSCjyEs4FzbIb4EpaLNAjWnp`
- GitHub：`qqq5554-oss/poker-trainer`，`main` 分支推上去就部署

## 開發原則

- 介面一律**繁體中文**，不可混入簡體字。
- 純靜態網站：沒有框架、沒有建置步驟、沒有後端。直接改檔案、推上 GitHub 就部署。
- 練習紀錄只存在手機的 localStorage，沒有帳號系統。
- 手機版面優先，內容最寬 520px。
- 視覺沿用既有的設計變數（`:root` 裡的 `--felt` 牌桌綠、`--ivory` 牌面象牙白、`--brass` 黃銅色重點、`--red` 紅心紅等），不要另起一套。

## 每次更新都要做

1. **把 `sw.js` 第一行的快取版本號加 1**（目前是 `poker-v5`，下一版改 `poker-v6`）。不改的話，已加到主畫面的版本不會抓到新檔案。
2. 有新增檔案時，把檔名加進 `sw.js` 的 `A` 陣列（離線快取清單）。
3. 動到牌局引擎時跑一次 `python tests/simulate.py`，確認籌碼守恆、沒有卡住。

## 檔案說明

| 檔案 | 用途 |
|---|---|
| `index.html` | 全部 CSS、主要邏輯和五個分頁：規則、牌型、起手牌、勝率、紀錄 |
| `play.js` | 「牌局」分頁：模擬牌局引擎、電腦對手、教練建議 |
| `sw.js` | Service Worker：網路優先、失敗時讀快取，讓 App 離線也能用 |
| `manifest.json` | PWA 設定：App 名稱、圖示、主題色 |
| `icon-180.png` / `icon-192.png` / `icon-512.png` | App 圖示（綠底、象牙白卡片、使用者提供的手繪黑桃） |
| `tests/simulate.py` | 用 Playwright 自動打幾百手牌的測試（`pip install playwright`；可加手數參數，預設 300） |
| `.vercelignore` | 讓 CLAUDE.md 和 tests 不被部署上網站 |

**載入順序很重要**：`index.html` 先載入 `play.js`，再執行主程式。主程式的 `go()` 會用到 `play.js` 裡的 `G`，順序顛倒會出錯。`play.js` 裡呼叫的 `ev`、`deal`、`cardH`、`lab`、`tierOf` 等函式定義在 `index.html`，只在函式執行時才會用到，所以先載入沒問題。

## 核心資料格式

- **牌**：整數 0–51，`點數 × 4 + 花色`。點數 0–12 對應 `'23456789TJQKA'`，花色 0–3 對應 `♠♥♦♣`（1、2 是紅色）。
- **`ev(cards)`**：評估 5–7 張牌，回傳一個可以直接比大小的整數。`catOf(v)` 取出牌型 0–8（高牌…同花順），`handName(v)` 回傳中文牌型名稱。
- **`lab(a, b)`**：兩張手牌轉成起手牌標籤，例如 `AKs`、`72o`、`TT`。`tierOf(lab)` 回傳起手牌表的等級：1 必玩、2 可玩、3 後位才玩、0 蓋牌。
- **儲存**：localStorage 鍵 `pokerTrainer.v1`，結構見 `blank()`：
  - `name`、`vs`、`pre`：各練習的 `{c 答對, t 總題數}`
  - `eqN`：勝率計算次數；`wrong`：起手牌答錯次數
  - `play`：牌局統計 `{hands, won, net, dec:{c,t}}`
  - `game`：`{stacks: 6 人籌碼, btn: 莊家位置, hint: 'auto' | 'tap'}`
  - 舊資料用 `Object.assign(blank(), 舊資料)` 合併，所以新增欄位要放進 `blank()`。

## 牌局引擎（play.js）

- 6 人桌，座位 0 是使用者，1–5 是電腦（`BOTS` 陣列定義名字和打法參數）。盲注 1／2，起始籌碼 200。
- `G` 是整局狀態，`G.P[i]` 是每位玩家：`stack`、`bet`（這一輪下的）、`total`（這一手總共下的）、`folded`、`allin`、`acted`。
- 流程：`gStart()` 發牌下盲注 → `step()` 決定誰行動 → `doAct()` 執行動作 → 這輪結束時 `endStreet()` 發下一條街 → `showdown()` 用 `total` 分層算主池和邊池，或 `winFold()` 處理其他人都蓋牌。最後 `finish()` 存籌碼和統計。
- 電腦決策 `botDecide()`：翻牌前用 Chen 公式加位置門檻；翻牌後用蒙地卡羅勝率（300 次）和底池賠率比較，再依打法參數（`loose`、`aggr`、`bluff`、`cadj`）調整。
- 教練 `coach()`：翻牌前用起手牌表加位置；翻牌後算勝率（1500 次）、底池賠率和聽牌 outs。回傳 `{cat, ok, title, why, info}`，其中 `ok` 是可接受的動作類別：`f` 蓋牌、`p` 過牌或跟注、`a` 下注或加注。使用者的每個決定會跟 `ok` 比對，記錄在 `G.dec`。
- 使用者切到別的分頁時電腦會暫停（`G.pending`），切回「牌局」才繼續。

## 未完成的部分

### 1. 新版還沒上線（最優先）
目前網站是**舊版**（舊圖示、沒有牌局分頁）。這個資料夾就是新版，原本用 Vercel MCP 上傳時卡住，所以改用 GitHub 部署：

1. 把這些檔案推到 GitHub 的 `qqq5554-oss/poker-trainer`。
2. 確認 Vercel 的 GitHub App 有這個 repo 的讀取權限（github.com/settings/installations → Vercel → Repository access）。
3. 在 Vercel 後台 poker-trainer 專案 → Settings → Git → Connect Git Repository，選這個 repo。**接到現有專案才能保留原網址**；另開新專案會換網址。
4. 部署完開正式網址確認：圖示是手繪黑桃、底部有「牌局」分頁。
5. 提醒使用者：iPhone 主畫面要刪掉舊捷徑，用 Safari 重新「加入主畫面」，才會出現新圖示。

### 2. 牌局引擎已知的簡化
這些都不影響正常遊玩，是刻意的簡化，之後可以改進：

- 不足額的全下加注（加注額小於最小加注）也會重新開放所有人的行動；正式規則下，已經行動過的人只能跟注或蓋牌。
- 勝率是假設對手拿隨機手牌算的，會高估面對大注時的實際勝率。教練說明裡已經用文字提醒。
- 電腦對手固定 5 位，輸光會自動重新買入；沒有人數或盲注設定。
- 一手牌打到一半關掉 App，這手就不見了（只保存每手結束後的籌碼）。
- 沒有保存歷史牌局，復盤只看得到剛打完的這一手。

### 3. 還沒做的功能（依原本規劃）
- Outs 計算練習：給手牌和公共牌，讓使用者數 outs，再對照 ×2／×4 法則。
- 位置判斷練習：單獨練「這個座位叫什麼、先行動還是後行動」。
- 牌局可調整電腦人數（2–6 人）和盲注大小。
- 保存最近幾手牌局，讓使用者回頭看。

## 部署注意事項

- 部署保護：專案設定是 `all_except_custom_domains`，正式網址可以直接打開。如果手機打開時要求登入 Vercel，到 Settings → Deployment Protection 關掉 Vercel Authentication。
- Vercel MCP 的 `upload_file` 上傳超過約 5KB 的檔案常常沒有回應，所以改用 Git 部署，不要再走 MCP 上傳。
