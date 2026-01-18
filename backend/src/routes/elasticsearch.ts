/**
 * Elasticsearch API 路由
 * 提供自然語言轉查詢、日誌診斷等功能
 */

import express, { Request, Response } from 'express';
import {
    getIndices,
    queryElasticsearch,
    executeKQL,
    checkElasticsearchHealth,
    searchLogs,
} from '../services/elasticsearch.js';
import {
    generateQueryDSL,
    generateKQL,
    diagnoseLog,
    diagnoseLogStream,
    LogDiagnosisResult,
} from '../services/openai.js';

const router = express.Router();

/**
 * GET /api/elasticsearch/indices
 * 獲取可用的索引列表
 */
router.get('/indices', async (req: Request, res: Response) => {
    try {
        const indices = await getIndices();
        res.json({
            success: true,
            indices,
        });
    } catch (error: any) {
        console.error('獲取索引列表失敗:', error);
        res.status(500).json({
            success: false,
            error: error.message || '獲取索引列表失敗',
        });
    }
});

/**
 * GET /api/elasticsearch/health
 * 檢查 Elasticsearch 連線狀態
 */
router.get('/health', async (req: Request, res: Response) => {
    try {
        const isHealthy = await checkElasticsearchHealth();
        res.json({
            success: true,
            healthy: isHealthy,
            status: isHealthy ? 'connected' : 'disconnected',
        });
    } catch (error: any) {
        console.error('健康檢查失敗:', error);
        res.status(500).json({
            success: false,
            healthy: false,
            error: error.message || 'Elasticsearch 連線失敗',
        });
    }
});

/**
 * POST /api/elasticsearch/nl2query
 * 自然語言轉 Elasticsearch 查詢
 * 
 * Body:
 * - query: 自然語言查詢
 * - format: "dsl" | "kql" (預設: "dsl")
 * - index: 目標索引 (選用)
 * - execute: 是否直接執行查詢 (預設: false)
 */
router.post('/nl2query', async (req: Request, res: Response) => {
    try {
        const { query, format = 'dsl', index, execute = false } = req.body;

        if (!query) {
            return res.status(400).json({
                success: false,
                error: '缺少 query 參數',
            });
        }

        let result: any;

        if (format === 'kql') {
            // 生成 KQL
            const { kql, explanation } = await generateKQL(query);
            result = {
                queryLanguage: 'kql',
                query: kql,
                explanation,
            };

            // 如果需要執行查詢
            if (execute && index) {
                const queryResult = await executeKQL(index, kql);
                result.executionResult = queryResult;
            }
        } else {
            // 生成 Query DSL
            const { queryDSL, explanation } = await generateQueryDSL(query);
            result = {
                queryLanguage: 'dsl',
                query: queryDSL,
                explanation,
            };

            // 如果需要執行查詢
            if (execute && index) {
                const queryResult = await queryElasticsearch(index, queryDSL);
                result.executionResult = queryResult;
            }
        }

        res.json({
            success: true,
            ...result,
        });
    } catch (error: any) {
        console.error('NL2Query 失敗:', error);
        res.status(500).json({
            success: false,
            error: error.message || '查詢生成失敗',
        });
    }
});

/**
 * POST /api/elasticsearch/execute
 * 執行 Elasticsearch 查詢
 * 
 * Body:
 * - index: 目標索引
 * - queryDSL: Query DSL JSON (選用)
 * - kql: KQL 字串 (選用)
 * - size: 返回結果數量 (預設: 100)
 */
router.post('/execute', async (req: Request, res: Response) => {
    try {
        const { index, queryDSL, kql, size = 100 } = req.body;

        if (!index) {
            return res.status(400).json({
                success: false,
                error: '缺少 index 參數',
            });
        }

        let result: any;

        if (kql) {
            // 執行 KQL 查詢
            result = await executeKQL(index, kql, { size });
        } else if (queryDSL) {
            // 執行 Query DSL 查詢
            result = await queryElasticsearch(index, queryDSL, { size });
        } else {
            return res.status(400).json({
                success: false,
                error: '必須提供 queryDSL 或 kql',
            });
        }

        res.json({
            success: true,
            ...result,
        });
    } catch (error: any) {
        console.error('執行查詢失敗:', error);
        res.status(500).json({
            success: false,
            error: error.message || '查詢執行失敗',
        });
    }
});

/**
 * POST /api/elasticsearch/search
 * 簡單的日誌搜尋（全文搜尋）
 * 
 * Body:
 * - index: 目標索引
 * - searchTerm: 搜尋關鍵字
 * - timeRange: 時間範圍 (例如: "1h", "24h")
 * - size: 返回結果數量
 */
router.post('/search', async (req: Request, res: Response) => {
    try {
        const { index, searchTerm, timeRange = '1h', size = 100 } = req.body;

        if (!index || !searchTerm) {
            return res.status(400).json({
                success: false,
                error: '缺少 index 或 searchTerm 參數',
            });
        }

        const result = await searchLogs(index, searchTerm, { size, timeRange });

        res.json({
            success: true,
            ...result,
        });
    } catch (error: any) {
        console.error('日誌搜尋失敗:', error);
        res.status(500).json({
            success: false,
            error: error.message || '日誌搜尋失敗',
        });
    }
});

/**
 * POST /api/elasticsearch/diagnose
 * 日誌診斷 - 分析日誌內容並提供修復建議 (SSE Streaming)
 * 
 * Body:
 * - logContent: 日誌內容（字串或 JSON）
 * - context: 額外上下文（選用）
 * - index: 索引名稱（選用，用於自動查詢相關日誌）
 * - kql: KQL 查詢（選用，用於取得日誌）
 */
router.post('/diagnose', async (req: Request, res: Response) => {
    try {
        let { logContent, context, index, kql } = req.body;

        // 如果提供了 index 和 kql，先查詢日誌
        if (index && kql && !logContent) {
            try {
                const queryResult = await executeKQL(index, kql, { size: 10 });

                if (queryResult.hits && queryResult.hits.length > 0) {
                    // 將查詢結果轉換為文本
                    logContent = queryResult.hits
                        .map((hit: any) => JSON.stringify(hit.source, null, 2))
                        .join('\n---\n');

                    context = `查詢到 ${queryResult.total} 筆日誌，以下是前 ${queryResult.hits.length} 筆`;
                } else {
                    return res.status(404).json({
                        success: false,
                        error: '未找到符合條件的日誌',
                    });
                }
            } catch (err: any) {
                return res.status(500).json({
                    success: false,
                    error: `查詢日誌失敗: ${err.message}`,
                });
            }
        }

        if (!logContent) {
            return res.status(400).json({
                success: false,
                error: '缺少 logContent 參數',
            });
        }

        // 如果 logContent 是物件，轉換為 JSON 字串
        if (typeof logContent === 'object') {
            logContent = JSON.stringify(logContent, null, 2);
        }

        // 設定 SSE Headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        try {
            const stream = diagnoseLogStream(logContent, context);

            for await (const chunk of stream) {
                // 將每個 chunk 包裝成 SSE 格式
                res.write(`data: ${JSON.stringify(chunk)}\n\n`);
            }

            res.write('data: [DONE]\n\n');
            res.end();
        } catch (streamError) {
            console.error('串流診斷失敗:', streamError);
            // 如果串流尚未開始或中途失敗，發送錯誤
            if (!res.headersSent) {
                res.status(500).json({
                    success: false,
                    error: `串流診斷失敗: ${streamError instanceof Error ? streamError.message : String(streamError)}`
                });
            } else {
                res.write(`data: ${JSON.stringify({ error: '串流中斷' })}\n\n`);
                res.end();
            }
        }

    } catch (error: any) {
        console.error('日誌診斷請求失敗:', error);
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                error: error.message || '日誌診斷失敗',
            });
        }
    }
});

export default router;
