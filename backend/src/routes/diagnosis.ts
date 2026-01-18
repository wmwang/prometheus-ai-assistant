/**
 * 診斷 API 路由
 * 提供主動診斷 (Root Cause Analysis) 功能
 */

import express from 'express';
import { diagnosisChat, quickDiagnosis, DiagnosisPhase1Result, DiagnosisPhase2Result } from '../services/openai.js';
import * as prometheus from '../services/prometheus.js';

const router = express.Router();

// 定義相關查詢數據的類型
interface RelatedQueryData {
    purpose: string;
    promql: string;
    data: unknown;
    expectedPattern?: string;
    error?: string;
}

/**
 * POST /api/diagnosis/quick
 * 快速診斷 - 根據 PromQL 和當前數據快速分析，並自動查詢相關指標
 */
router.post('/quick', async (req, res) => {
    try {
        const { promql, includeRelated = true } = req.body;

        if (!promql) {
            return res.status(400).json({
                success: false,
                error: '請提供 PromQL 查詢'
            });
        }

        // 執行查詢獲取當前數據
        let currentValue = '無法獲取';
        let metricType = '未知';

        try {
            const queryResult = await prometheus.query(promql);
            if (queryResult && queryResult.data && Array.isArray(queryResult.data.result)) {
                currentValue = JSON.stringify(queryResult.data.result.slice(0, 5), null, 2);
            }

            // 嘗試判斷指標類型
            if (promql.includes('rate(') || promql.includes('increase(')) {
                metricType = 'Counter (計數器)';
            } else if (promql.includes('histogram_quantile')) {
                metricType = 'Histogram (直方圖)';
            } else if (promql.includes('_total')) {
                metricType = 'Counter (計數器)';
            } else if (promql.includes('_bucket')) {
                metricType = 'Histogram (直方圖)';
            } else {
                metricType = 'Gauge (量表) 或其他';
            }
        } catch (queryError) {
            console.error('查詢 Prometheus 失敗:', queryError);
        }

        // 自動查詢相關指標（根據常見模式）
        const relatedMetrics: RelatedQueryData[] = [];

        if (includeRelated) {
            // 根據指標類型自動查詢相關指標
            const relatedQueries = getRelatedQueries(promql);

            for (const rq of relatedQueries.slice(0, 3)) { // 最多 3 個相關查詢
                try {
                    const result = await prometheus.query(rq.promql);
                    const resultData = result?.data?.result;
                    if (resultData && Array.isArray(resultData) && resultData.length > 0) {
                        relatedMetrics.push({
                            purpose: rq.purpose,
                            promql: rq.promql,
                            data: resultData.slice(0, 3) // 限制數據量
                        });
                    }
                } catch (queryError) {
                    // 相關查詢失敗不影響主要診斷
                }
            }
        }

        // 使用 AI 進行快速診斷（包含相關指標數據）
        const enhancedCurrentValue = relatedMetrics.length > 0
            ? `主要指標數據:\n${currentValue}\n\n相關指標數據:\n${JSON.stringify(relatedMetrics, null, 2)}`
            : currentValue;

        const diagnosis = await quickDiagnosis(promql, metricType, enhancedCurrentValue);

        res.json({
            success: true,
            diagnosis,
            context: {
                promql,
                metricType,
                currentValue: currentValue === '無法獲取' ? null : JSON.parse(currentValue),
                relatedMetrics: relatedMetrics.length > 0 ? relatedMetrics : undefined
            }
        });
    } catch (error) {
        console.error('快速診斷失敗:', error);
        res.status(500).json({
            success: false,
            error: '診斷失敗，請稍後再試'
        });
    }
});

/**
 * 根據指標獲取相關查詢建議
 */
function getRelatedQueries(promql: string): Array<{ purpose: string; promql: string }> {
    const queries: Array<{ purpose: string; promql: string }> = [];

    // 健康狀態相關
    if (promql.includes('up') || promql.includes('health')) {
        queries.push(
            { purpose: '服務啟動時間', promql: 'process_start_time_seconds' },
            { purpose: '抓取持續時間', promql: 'scrape_duration_seconds' }
        );
    }

    // HTTP 相關
    if (promql.includes('http') || promql.includes('request')) {
        queries.push(
            { purpose: 'HTTP 錯誤率', promql: 'sum(rate(http_requests_total{status=~"5.."}[5m]))' },
            { purpose: 'HTTP 請求延遲 P99', promql: 'histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))' }
        );
    }

    // 記憶體相關
    if (promql.includes('memory') || promql.includes('mem')) {
        queries.push(
            { purpose: 'Container 記憶體使用', promql: 'sum(container_memory_usage_bytes) by (container)' },
            { purpose: 'Go Heap 分配', promql: 'go_memstats_heap_alloc_bytes' }
        );
    }

    // CPU 相關
    if (promql.includes('cpu')) {
        queries.push(
            { purpose: 'Container CPU 使用率', promql: 'sum(rate(container_cpu_usage_seconds_total[5m])) by (container)' },
            { purpose: 'Process CPU 使用', promql: 'rate(process_cpu_seconds_total[5m])' }
        );
    }

    // 預設：查詢基本健康指標
    if (queries.length === 0) {
        queries.push(
            { purpose: '服務健康狀態', promql: 'up' },
            { purpose: '抓取樣本數', promql: 'scrape_samples_scraped' }
        );
    }

    return queries;
}

/**
 * POST /api/diagnosis/analyze
 * 深度分析 - 根據異常描述進行多階段根因分析
 */
router.post('/analyze', async (req, res) => {
    try {
        const { metric, description, timeRange = '1h' } = req.body;

        if (!metric) {
            return res.status(400).json({
                success: false,
                error: '請提供指標名稱或 PromQL'
            });
        }

        // Phase 1: 分析可能原因並獲取相關查詢建議
        const phase1Result = await diagnosisChat('phase1', {
            metric,
            description: description || '指標出現異常',
            timeRange
        }) as DiagnosisPhase1Result;

        const relatedData: RelatedQueryData[] = [];

        // Phase 2: 執行建議的相關查詢
        if (phase1Result.relatedQueries && Array.isArray(phase1Result.relatedQueries)) {
            for (const query of phase1Result.relatedQueries.slice(0, 5)) { // 最多執行 5 個查詢
                try {
                    const result = await prometheus.query(query.promql);
                    const resultData = result?.data?.result;
                    relatedData.push({
                        purpose: query.purpose,
                        promql: query.promql,
                        data: Array.isArray(resultData) ? resultData.slice(0, 10) : [], // 限制返回數據量
                        expectedPattern: query.expectedPattern
                    });
                } catch (queryError) {
                    relatedData.push({
                        purpose: query.purpose,
                        promql: query.promql,
                        data: null,
                        error: '查詢失敗'
                    });
                }
            }
        }

        // Phase 3: 根據收集的數據進行根因分析
        const phase2Result = await diagnosisChat('phase2', {
            metric,
            description: description || '指標出現異常',
            relatedData: JSON.stringify(relatedData, null, 2)
        }) as DiagnosisPhase2Result;

        res.json({
            success: true,
            analysis: {
                possibleCauses: phase1Result.possibleCauses || [],
                immediateChecks: phase1Result.immediateChecks || [],
                relatedQueries: relatedData,
                rootCause: phase2Result.rootCause || null,
                timeline: phase2Result.timeline || [],
                remediation: phase2Result.remediation || null,
                relatedAlerts: phase2Result.relatedAlerts || []
            }
        });
    } catch (error) {
        console.error('深度分析失敗:', error);
        res.status(500).json({
            success: false,
            error: '分析失敗，請稍後再試'
        });
    }
});

/**
 * GET /api/diagnosis/common-issues
 * 獲取常見問題模式列表
 */
router.get('/common-issues', (_req, res) => {
    const commonIssues = [
        {
            pattern: '指標突然歸零',
            description: '服務可能崩潰或網路中斷',
            suggestedChecks: [
                'up{job="your-job"}',
                'kube_pod_status_phase{phase!="Running"}',
                'container_last_seen'
            ]
        },
        {
            pattern: '記憶體持續上升',
            description: '可能存在記憶體洩漏',
            suggestedChecks: [
                'container_memory_usage_bytes',
                'go_memstats_heap_alloc_bytes',
                'process_resident_memory_bytes'
            ]
        },
        {
            pattern: 'HTTP 錯誤率飆升',
            description: '後端服務或依賴可能有問題',
            suggestedChecks: [
                'rate(http_requests_total{status=~"5.."}[5m])',
                'histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))',
                'up{job="backend"}'
            ]
        },
        {
            pattern: '延遲突然增加',
            description: '可能是資源瓶頸或依賴變慢',
            suggestedChecks: [
                'histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))',
                'rate(container_cpu_usage_seconds_total[5m])',
                'container_memory_usage_bytes / container_spec_memory_limit_bytes'
            ]
        },
        {
            pattern: 'Pod 頻繁重啟',
            description: '可能是 OOM 或健康檢查失敗',
            suggestedChecks: [
                'kube_pod_container_status_restarts_total',
                'kube_pod_container_status_last_terminated_reason',
                'container_memory_usage_bytes'
            ]
        }
    ];

    res.json({
        success: true,
        issues: commonIssues
    });
});

export default router;
