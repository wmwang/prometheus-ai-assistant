import { Router, Request, Response } from 'express';
import { analyzeInsights } from '../services/openai.js';
import * as prometheus from '../services/prometheus.js';

const router = Router();

interface InsightsRequest {
    query: string;
    data?: any;
    timeRange?: string;
}

/**
 * POST /api/insights
 * 分析指標數據並提供見解
 */
router.post('/', async (req: Request, res: Response) => {
    try {
        const { query, data, timeRange } = req.body as InsightsRequest;

        if (!query || typeof query !== 'string') {
            res.status(400).json({
                success: false,
                error: '請提供有效的 PromQL 查詢',
            });
            return;
        }

        // 如果沒有提供數據，先執行查詢
        let queryData = data;
        if (!queryData) {
            const queryResult = await prometheus.query(query);
            if (queryResult.status === 'error') {
                res.status(400).json({
                    success: false,
                    error: `Prometheus 查詢失敗: ${queryResult.error}`,
                });
                return;
            }
            queryData = queryResult.data;
        }

        // 分析見解
        const result = await analyzeInsights(query, queryData, timeRange);

        res.json({
            success: true,
            ...result,
        });
    } catch (error) {
        console.error('見解分析 API 錯誤:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : '伺服器內部錯誤',
        });
    }
});

/**
 * POST /api/insights/query
 * 執行 PromQL 查詢並分析結果
 */
router.post('/query', async (req: Request, res: Response) => {
    try {
        const { query, timeRange } = req.body as InsightsRequest;

        if (!query || typeof query !== 'string') {
            res.status(400).json({
                success: false,
                error: '請提供有效的 PromQL 查詢',
            });
            return;
        }

        // 執行查詢
        const queryResult = await prometheus.query(query);
        if (queryResult.status === 'error') {
            res.status(400).json({
                success: false,
                error: `Prometheus 查詢失敗: ${queryResult.error}`,
            });
            return;
        }

        // 分析見解
        const insights = await analyzeInsights(query, queryResult.data, timeRange);

        res.json({
            success: true,
            queryResult: queryResult,
            ...insights,
        });
    } catch (error) {
        console.error('見解查詢 API 錯誤:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : '伺服器內部錯誤',
        });
    }
});

export default router;
