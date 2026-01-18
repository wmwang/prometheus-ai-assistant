import { Router, Request, Response } from 'express';
import * as prometheus from '../services/prometheus.js';

const router = Router();

// 指標快取
let metricsCache: string[] = [];
let cacheTimestamp = 0;
const CACHE_TTL = 60000; // 1 分鐘快取

/**
 * 取得指標列表（帶快取）
 */
async function getMetricsWithCache(): Promise<string[]> {
    const now = Date.now();
    if (metricsCache.length === 0 || now - cacheTimestamp > CACHE_TTL) {
        metricsCache = await prometheus.getMetrics();
        cacheTimestamp = now;
    }
    return metricsCache;
}

/**
 * GET /api/autocomplete/metrics
 * 根據前綴搜尋指標
 */
router.get('/metrics', async (req: Request, res: Response) => {
    try {
        const prefix = (req.query.prefix as string || '').toLowerCase();
        const limit = parseInt(req.query.limit as string || '20', 10);

        const allMetrics = await getMetricsWithCache();

        let filtered: string[];
        if (prefix) {
            filtered = allMetrics
                .filter(m => m.toLowerCase().includes(prefix))
                .slice(0, limit);
        } else {
            // 無前綴時返回常用指標類型
            const commonPrefixes = [
                'node_', 'container_', 'kube_', 'http_', 'go_',
                'process_', 'prometheus_', 'up'
            ];
            filtered = allMetrics
                .filter(m => commonPrefixes.some(p => m.startsWith(p)))
                .slice(0, limit);
        }

        res.json({
            success: true,
            prefix,
            count: filtered.length,
            metrics: filtered,
        });
    } catch (error) {
        console.error('指標自動補全錯誤:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : '伺服器內部錯誤',
        });
    }
});

/**
 * GET /api/autocomplete/labels/:metric
 * 取得指定指標的標籤
 */
router.get('/labels/:metric', async (req: Request, res: Response) => {
    try {
        const { metric } = req.params;

        // 查詢該指標的標籤
        const result = await prometheus.query(`${metric}`);

        if (result.status === 'success' && result.data && result.data.result && result.data.result.length > 0) {
            // 收集所有標籤名稱
            const labelSet = new Set<string>();
            for (const item of result.data.result) {
                if (item.metric) {
                    Object.keys(item.metric).forEach(key => {
                        if (key !== '__name__') {
                            labelSet.add(key);
                        }
                    });
                }
            }

            res.json({
                success: true,
                metric,
                labels: Array.from(labelSet).sort(),
            });
        } else {
            res.json({
                success: true,
                metric,
                labels: [],
            });
        }
    } catch (error) {
        console.error('標籤查詢錯誤:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : '伺服器內部錯誤',
        });
    }
});

/**
 * POST /api/autocomplete/refresh
 * 強制重新整理指標快取
 */
router.post('/refresh', async (_req: Request, res: Response) => {
    try {
        metricsCache = await prometheus.getMetrics();
        cacheTimestamp = Date.now();

        res.json({
            success: true,
            message: '指標快取已重新整理',
            count: metricsCache.length,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : '重新整理失敗',
        });
    }
});

export default router;
