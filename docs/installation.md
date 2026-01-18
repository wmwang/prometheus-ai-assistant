# 安裝指南

本文件說明如何安裝與設定 Prometheus AI Assistant。

## 系統需求

- **Node.js**: 18.0 或更高版本
- **npm**: 9.0 或更高版本
- **Chrome 瀏覽器**: 88 或更高版本（支援 Manifest V3）
- **Prometheus**: 任何版本
- **OpenAI API Key**: 需要 GPT-4 存取權限

## 後端安裝

### 步驟 1: 安裝依賴

```bash
cd prometheus-ai-assistant/backend
npm install
```

### 步驟 2: 設定環境變數

複製範本檔案：

```bash
cp .env.example .env
```

編輯 `.env` 檔案，設定你的 API Key：

```env
# OpenAI API Key（必填）
OPENAI_API_KEY=sk-your-api-key-here

# Prometheus 伺服器位址（預設 http://localhost:9090）
PROMETHEUS_URL=http://localhost:9090

# 後端服務 Port（預設 3001）
PORT=3001
```

### 步驟 3: 啟動服務

開發模式（熱重載）：

```bash
npm run dev
```

生產模式：

```bash
npm run build
npm start
```

服務會在 `http://localhost:3001` 啟動。

### 步驟 4: 驗證安裝

```bash
curl http://localhost:3001/health
```

預期回應：

```json
{
  "status": "ok",
  "services": {
    "prometheus": "connected",
    "openai": "configured"
  }
}
```

## Chrome 擴充功能安裝

由於這是內部開發的擴充功能，我們使用「開發者模式」載入，不需要透過 Chrome 商店。

### 步驟 1: 開啟擴充功能管理頁面

1. 開啟 Chrome 瀏覽器
2. 在網址列輸入 `chrome://extensions` 並按 Enter
3. 你會看到擴充功能管理頁面

### 步驟 2: 啟用開發者模式

找到頁面右上角的「開發人員模式」開關，將其開啟。

### 步驟 3: 載入擴充功能

1. 點擊「載入未封裝項目」按鈕
2. 在檔案選擇器中，導覽到專案的 `extension` 資料夾
3. 選擇該資料夾並點擊「選取」

### 步驟 4: 確認安裝

安裝成功後，你會在擴充功能列表中看到「Prometheus AI Assistant」。

如果擴充功能圖示顯示為預設圖示（灰色拼圖），這是正常的，因為我們尚未建立圖示檔案。

### 步驟 5: 設定後端位址

1. 點擊工具列中的擴充功能圖示（或拼圖圖示 → Prometheus AI Assistant）
2. 在彈出視窗中確認後端 API 位址為 `http://localhost:3001`
3. 點擊「儲存設定」

## 驗證安裝

1. 確保後端服務已啟動
2. 確保 Prometheus 正在運行（`http://localhost:9090`）
3. 開啟 Prometheus UI (`http://localhost:9090/graph`)
4. 你應該會看到頁面右下角出現一個 🤖 按鈕
5. 點擊按鈕開啟 AI 助手
6. 輸入測試查詢：「顯示所有指標」
7. 如果成功生成 PromQL，安裝完成！

## 疑難排解

### 看不到 AI 助手按鈕

1. 確認擴充功能已啟用
2. 重新整理 Prometheus 頁面
3. 檢查瀏覽器開發者工具的 Console 是否有錯誤訊息

### 無法連線到後端

1. 確認後端服務正在運行
2. 確認 Port 設定正確
3. 檢查防火牆設定
4. 在彈出視窗中確認後端 URL 設定正確

### OpenAI API 錯誤

1. 確認 API Key 正確
2. 確認帳戶有足夠的額度
3. 確認有 GPT-4 的存取權限

## 更新擴充功能

當有新版本時：

1. 前往 `chrome://extensions`
2. 找到 Prometheus AI Assistant
3. 點擊「重新載入」按鈕 (↻)
