# Prometheus AI Assistant

🤖 一個整合於 Prometheus UI 的 AI 助手，提供自然語言查詢轉換與指標見解分析。

![demo](docs/demo.png)

## ✨ 功能特色

- **自然語言轉 PromQL** - 用白話文描述你想查詢的內容，AI 自動生成 PromQL
- **指標見解分析** - 分析查詢結果，提供趨勢、異常、效能見解
- **下一步建議** - 根據當前分析，建議相關的進階查詢
- **無縫整合** - 透過 Chrome 擴充功能直接嵌入 Prometheus UI

## 📋 系統需求

- Node.js 18+
- Chrome 瀏覽器
- Prometheus 伺服器 (預設 `http://localhost:9090`)
- OpenAI API Key

## 🚀 快速開始

### 1. 設定後端

```bash
# 進入後端目錄
cd backend

# 安裝依賴
npm install

# 複製環境變數範本
cp .env.example .env

# 編輯 .env 設定你的 OpenAI API Key
# OPENAI_API_KEY=your-api-key-here

# 啟動服務
npm run dev
```

後端會在 `http://localhost:3001` 啟動。

### 2. 安裝 Chrome 擴充功能

1. 開啟 Chrome，前往 `chrome://extensions`
2. 開啟右上角的「開發人員模式」
3. 點擊「載入未封裝項目」
4. 選擇本專案的 `extension` 資料夾
5. 完成！擴充功能已安裝

### 3. 開始使用

1. 開啟 Prometheus UI (`http://localhost:9090/graph`)
2. 你會看到右下角出現一個 🤖 按鈕
3. 點擊按鈕開啟 AI 助手
4. 輸入自然語言查詢，例如：「過去1小時哪些服務的錯誤率超過1%」
5. AI 會生成對應的 PromQL 並提供說明

## 📖 使用範例

### 自然語言查詢範例

| 輸入 | 生成的 PromQL |
|------|--------------|
| 顯示所有節點的 CPU 使用率 | `100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)` |
| 過去1小時錯誤率超過1%的服務 | `rate(http_requests_total{status=~"5.."}[1h]) / rate(http_requests_total[1h]) > 0.01` |
| 記憶體使用超過80%的節點 | `(node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes > 0.8` |
| P95 請求延遲 | `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))` |

## 🏗️ 專案結構

```
prometheus-ai-assistant/
├── backend/                 # 後端 API 服務
│   ├── src/
│   │   ├── index.ts        # Express 伺服器
│   │   ├── config.ts       # 設定管理
│   │   ├── routes/         # API 路由
│   │   ├── services/       # 服務層
│   │   └── prompts/        # LLM 提示詞
│   └── package.json
│
├── extension/               # Chrome 擴充功能
│   ├── manifest.json       # 擴充功能設定
│   ├── popup/              # 彈出式視窗
│   ├── content/            # Content Script
│   └── background/         # Service Worker
│
└── docs/                    # 文件
```

## 🔧 API 端點

| 端點 | 方法 | 說明 |
|------|------|------|
| `/api/promql` | POST | 自然語言轉 PromQL |
| `/api/promql/execute` | POST | 生成並執行 PromQL |
| `/api/insights` | POST | 分析指標見解 |
| `/api/insights/query` | POST | 查詢並分析見解 |
| `/api/metrics` | GET | 獲取可用指標列表 |
| `/api/query` | POST | 執行 PromQL 查詢 |
| `/health` | GET | 健康檢查 |

## 📝 授權

MIT License
