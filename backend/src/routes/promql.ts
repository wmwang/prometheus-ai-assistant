import { Router, Request, Response } from 'express';
import { generatePromQL, generatePromQLWithHistory } from '../services/openai.js';
import * as prometheus from '../services/prometheus.js';
import * as sessions from '../services/sessions.js';

const router = Router();

interface PromQLRequest {
    query: string;
    sessionId?: string;
    context?: {
        availableMetrics?: string[];
    };
}

/**
 * POST /api/promql
 * 將自然語言轉換為 PromQL 查詢（無對話歷史）
 */
router.post('/', async (req: Request, res: Response) => {
    try {
        const { query, context } = req.body as PromQLRequest;

        if (!query || typeof query !== 'string') {
            res.status(400).json({
                success: false,
                error: '請提供有效的查詢字串',
            });
            return;
        }

        // 如果沒有提供可用指標，嘗試從 Prometheus 獲取
        let availableMetrics = context?.availableMetrics;
        if (!availableMetrics || availableMetrics.length === 0) {
            availableMetrics = await prometheus.getMetrics();
        }

        // 生成 PromQL
        const result = await generatePromQL(query, availableMetrics);

        res.json({
            success: true,
            ...result,
        });
    } catch (error) {
        console.error('PromQL 生成 API 錯誤:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : '伺服器內部錯誤',
        });
    }
});

/**
 * POST /api/promql/chat
 * 帶有對話歷史的 PromQL 生成
 */
router.post('/chat', async (req: Request, res: Response) => {
    try {
        const { query, sessionId, context } = req.body as PromQLRequest;

        if (!query || typeof query !== 'string') {
            res.status(400).json({
                success: false,
                error: '請提供有效的查詢字串',
            });
            return;
        }

        // 使用提供的 sessionId 或生成隨機 ID
        const sid = sessionId || `session_${Date.now()}`;

        // 取得對話歷史
        const history = sessions.getHistory(sid);

        // 獲取可用指標
        let availableMetrics = context?.availableMetrics;
        if (!availableMetrics || availableMetrics.length === 0) {
            availableMetrics = await prometheus.getMetrics();
        }

        // 生成 PromQL（帶歷史）
        const result = await generatePromQLWithHistory(query, history, availableMetrics);

        // 儲存對話歷史
        sessions.addMessage(sid, 'user', query);
        sessions.addMessage(sid, 'assistant', JSON.stringify(result));

        res.json({
            success: true,
            sessionId: sid,
            ...result,
            history: sessions.getHistory(sid),
        });
    } catch (error) {
        console.error('PromQL 對話 API 錯誤:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : '伺服器內部錯誤',
        });
    }
});

/**
 * GET /api/promql/history/:sessionId
 * 取得 session 的對話歷史
 */
router.get('/history/:sessionId', (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const history = sessions.getHistory(sessionId);

    res.json({
        success: true,
        sessionId,
        history,
    });
});

/**
 * DELETE /api/promql/history/:sessionId
 * 清除 session 的對話歷史
 */
router.delete('/history/:sessionId', (req: Request, res: Response) => {
    const { sessionId } = req.params;
    sessions.clearHistory(sessionId);

    res.json({
        success: true,
        message: '對話歷史已清除',
    });
});

/**
 * POST /api/promql/execute
 * 生成 PromQL 並執行查詢
 */
router.post('/execute', async (req: Request, res: Response) => {
    try {
        const { query, context } = req.body as PromQLRequest;

        if (!query || typeof query !== 'string') {
            res.status(400).json({
                success: false,
                error: '請提供有效的查詢字串',
            });
            return;
        }

        // 獲取可用指標
        let availableMetrics = context?.availableMetrics;
        if (!availableMetrics || availableMetrics.length === 0) {
            availableMetrics = await prometheus.getMetrics();
        }

        // 生成 PromQL
        const promqlResult = await generatePromQL(query, availableMetrics);

        // 執行查詢
        const queryResult = await prometheus.query(promqlResult.promql);

        res.json({
            success: true,
            ...promqlResult,
            queryResult: queryResult,
        });
    } catch (error) {
        console.error('PromQL 執行 API 錯誤:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : '伺服器內部錯誤',
        });
    }
});

export default router;
