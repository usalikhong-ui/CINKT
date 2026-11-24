# 一問 · 求籤與答案之書

這是一份可獨立保存、轉移及部署的完整網站備份。使用繁體中文介面，包含求籤機、答案之書、2,000 個原創答案、音效、動畫、主畫面安裝功能及自訂圖示。網站毋須建置、安裝套件、API 金鑰或後端服務。

## 檔案

- `dist/`：完整可發佈網站，保留全部檔案及目錄結構。
- `dist/index.html`：網站入口；求籤與答案之書在同一頁即時切換。
- `dist/book.html`：答案之書的直接入口。
- `dist/answers.json`：全部 2,000 個答案。
- `dist/icons/`：自訂主畫面圖示及 SVG 原稿。
- `dist/manifest.webmanifest`、`dist/sw.js`：主畫面安裝所需檔案。
- `firebase.json`：可直接使用的 Firebase Hosting 設定。

## 在自己電腦預覽

在這個資料夾執行：

```sh
python3 -m http.server 8000 --directory dist
```

然後打開 `http://localhost:8000/`。音效會在按下求籤或撕頁按鈕後播放。

## 部署到自己的 Firebase

先安裝 Firebase CLI，並在自己的 Firebase 帳戶建立或選擇一個項目。在這個資料夾執行：

```sh
firebase login
firebase projects:list
firebase deploy --only hosting --project YOUR_FIREBASE_PROJECT_ID
```

把 `YOUR_FIREBASE_PROJECT_ID` 改成自己的項目 ID。`firebase.json` 已將 `dist/` 設為發佈目錄；這份備份沒有綁定任何帳戶或項目。部署成功後，Firebase CLI 會顯示網站網址。

## 保存到自己的 GitHub

把這個資料夾的全部內容上傳到自己的 GitHub 倉庫，即可保存可編輯的完整網站來源。若使用 GitHub Pages，將 `dist/` 的內容作為發佈根目錄，並保留其相對路徑。網站使用相對網址，可放於自己的網域或專案子路徑。

## 網站功能

- 求籤音效、落籤動畫及隨機結果。
- 答案之書隨機撕頁、撕紙聲及 2,000 個獨特答案。
- 即時切換兩種模式，保留已抽出的結果。
- 共用靜音設定、鍵盤切換及減少動態效果支援。
- 手機主畫面安裝與自訂圖示。

主畫面安裝需要 HTTPS 或 localhost；不同瀏覽器的安裝方式會略有不同。音效及互動程式皆在瀏覽器內執行。字型在連線時可使用 Google Fonts，亦有本機字型後備。Service Worker 目前使用網路讀取模式。

這份備份只包含網站檔案與可攜設定，沒有原託管平台的項目識別、遠端倉庫認證、登入資訊或私密金鑰。
