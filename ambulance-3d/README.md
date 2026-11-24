# 救護行動｜3D 場景編輯器

互動場景以短片為參考，包含夜間藍色網格、兩幢起火大廈及紅、黃、綠傷者分流區。救護車和制服按香港消防處公開照片製作成低多邊形模型。

- 把物件拖入場景，或點選物件庫後再點選場景地面。
- 點選場內物件，或由「場內物件」清單選取。用方向控制轉向，救護車另有車速與行駛開關。
- 用滑鼠拖曳或單指拖動旋轉鏡頭，亦可切換全景、俯視、地面視角。
- 「重設場景」會還原預設擺位。

## 本機執行

在這個資料夾執行 `python3 -m http.server 8000`，再開啟 `http://localhost:8000/`。需使用支援 WebGL 2 的瀏覽器。網站為靜態檔案，可直接由 GitHub Pages 發佈。

- `models.js` 提供 `createAmbulance()` 與 `createCrew({officer})`。模型以米為單位，底部為 Y=0，正面朝 +Z。
- `environment.js` 提供場景環境及火光動畫。
- `app.js` 管理鏡頭、物件放置和車輛行駛。
- `vendor/` 包含 Three.js 及其授權。

外觀參考 [香港消防處救護車圖輯](https://www.hkfsd.gov.hk/eng/aboutus/gallery/fireappliances/AMB.html)及[香港政府救護演練照片](https://www.info.gov.hk/gia/general/202403/08/P2024030800461.htm)。
