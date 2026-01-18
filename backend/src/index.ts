import express from 'express';
import cors from 'cors';
import path from 'path';
import { config, validateConfig } from './config.js';
import promqlRouter from './routes/promql.js';
import insightsRouter from './routes/insights.js';
import autocompleteRouter from './routes/autocomplete.js';
import templatesRouter from './routes/templates.js';
import alertsRouter from './routes/alerts.js';
import diagnosisRouter from './routes/diagnosis.js';
import elasticsearchRouter from './routes/elasticsearch.js';
import { createProxyMiddleware } from 'http-proxy-middleware';
import * as prometheus from './services/prometheus.js';
import * as elasticsearch from './services/elasticsearch.js';

// 驗證設定
validateConfig();

const app = express();

// 中介軟體
app.use(cors());
app.use(express.json());

// ==========================================
// Prometheus 反向代理 (解決 iframe 認證問題)
// ==========================================
const proxyOptions: any = {
    target: config.prometheus.url,
    changeOrigin: true,
    ws: true, // 支援 WebSocket
    // http-proxy-middleware v3.x 事件處理寫法
    on: {
        // 自動注入認證 Headers
        proxyReq: (proxyReq: any, req: any, res: any) => {
            // [Debug] 顯示正在轉發的請求
            console.log(`[Proxy] Forwarding ${req.method} ${req.url} -> ${config.prometheus.url}`);

            if (config.prometheus.headers) {
                console.log('[Proxy] Injecting Headers:', JSON.stringify(config.prometheus.headers));
                Object.entries(config.prometheus.headers).forEach(([key, value]) => {
                    proxyReq.setHeader(key, value as string);
                });
            }
        },
        // 錯誤處理
        error: (err: any, req: any, res: any) => {
            console.error('Proxy Error:', err);
            res.status(500).send('Prometheus Proxy Error');
        }
    }
};

const prometheusProxy = createProxyMiddleware(proxyOptions);

// 代理 Prometheus UI 相關路徑 - 改用底部 Catch-All 處理
// app.use(['/graph', ...], prometheusProxy); 移除此行

// 提供靜態檔案（獨立 Web 介面）
// 使用 process.cwd() 確保從專案根目錄解析路徑
app.use(express.static(path.join(process.cwd(), 'public')));

// 健康檢查
app.get('/health', async (_req, res) => {
    const prometheusHealthy = await prometheus.checkHealth();
    const elasticsearchHealthy = await elasticsearch.checkElasticsearchHealth();

    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        services: {
            prometheus: prometheusHealthy ? 'connected' : 'disconnected',
            elasticsearch: elasticsearchHealthy ? 'connected' : 'disconnected',
            openai: config.openai.apiKey ? 'configured' : 'not configured',
        },
    });
});

// API 路由
app.use('/api/promql', promqlRouter);
app.use('/api/insights', insightsRouter);
app.use('/api/autocomplete', autocompleteRouter);
app.use('/api/templates', templatesRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/diagnosis', diagnosisRouter);
app.use('/api/elasticsearch', elasticsearchRouter);

// 獲取可用指標列表
app.get('/api/metrics', async (_req, res) => {
    try {
        const metrics = await prometheus.getMetrics();
        res.json({
            success: true,
            count: metrics.length,
            metrics: metrics,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : '獲取指標失敗',
        });
    }
});

// 執行 PromQL 查詢代理
app.post('/api/query', async (req, res) => {
    try {
        const { promql } = req.body;

        if (!promql) {
            res.status(400).json({
                success: false,
                error: '請提供 promql 參數',
            });
            return;
        }

        const result = await prometheus.query(promql);
        res.json({
            success: result.status === 'success',
            ...result,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : '查詢失敗',
        });
    }
});

// 獲取可用指標列表
app.get('/api/metrics', async (_req, res) => {
    try {
        const metrics = await prometheus.getMetrics();
        res.json({
            success: true,
            count: metrics.length,
            metrics: metrics,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : '獲取指標失敗',
        });
    }
});

// 全域 Catch-All Proxy: 所有未被處理的請求都轉送給 Prometheus
// 這能確保 /graph, /query, /assets 等所有 UI 資源都能正確載入
app.use(prometheusProxy);

// 啟動伺服器
app.listen(config.server.port, () => {
    console.log(`
🚀 Prometheus AI Assistant 後端服務已啟動
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📡 服務位址: http://localhost:${config.server.port}
📊 Prometheus: ${config.prometheus.url}
📋 Elasticsearch: ${config.elasticsearch.url}
🤖 OpenAI: ${config.openai.apiKey ? '已設定' : '❌ 未設定'}
🔑 Headers: ${config.prometheus.headers ? JSON.stringify(config.prometheus.headers) : '無'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

API 端點:
  [Prometheus]
  POST /api/promql          - 自然語言轉 PromQL
  POST /api/promql/chat     - 帶對話歷史的 PromQL 生成
  POST /api/promql/execute  - 生成並執行 PromQL
  POST /api/insights        - 分析指標見解
  POST /api/diagnosis       - 指標診斷
  
  [Elasticsearch]
  POST /api/elasticsearch/nl2query    - 自然語言轉 Query DSL/KQL
  POST /api/elasticsearch/execute     - 執行 ES 查詢
  POST /api/elasticsearch/search      - 日誌搜尋
  POST /api/elasticsearch/diagnose    - 日誌診斷
  GET  /api/elasticsearch/indices     - 獲取索引列表
  
  [通用]
  GET  /api/metrics         - 獲取可用指標列表
  POST /api/query           - 執行 PromQL 查詢
  GET  /health              - 健康檢查
  `);
});

