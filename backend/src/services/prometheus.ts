import { config } from '../config.js';

// Prometheus 查詢結果介面
export interface PrometheusQueryResult {
    status: 'success' | 'error';
    data?: {
        resultType: 'vector' | 'matrix' | 'scalar' | 'string';
        result: any[];
    };
    error?: string;
    errorType?: string;
}

// Prometheus 指標資訊
export interface MetricInfo {
    name: string;
    labels: string[];
}

/**
 * 執行 Prometheus 即時查詢
 */
export async function query(promql: string): Promise<PrometheusQueryResult> {
    try {
        const url = new URL('/api/v1/query', config.prometheus.url);
        url.searchParams.set('query', promql);

        const response = await fetch(url.toString());
        const data = await response.json();

        return data as PrometheusQueryResult;
    } catch (error) {
        console.error('Prometheus 查詢失敗:', error);
        return {
            status: 'error',
            error: error instanceof Error ? error.message : '未知錯誤',
        };
    }
}

/**
 * 執行 Prometheus 範圍查詢
 */
export async function queryRange(
    promql: string,
    start: string,
    end: string,
    step: string
): Promise<PrometheusQueryResult> {
    try {
        const url = new URL('/api/v1/query_range', config.prometheus.url);
        url.searchParams.set('query', promql);
        url.searchParams.set('start', start);
        url.searchParams.set('end', end);
        url.searchParams.set('step', step);

        const response = await fetch(url.toString());
        const data = await response.json();

        return data as PrometheusQueryResult;
    } catch (error) {
        console.error('Prometheus 範圍查詢失敗:', error);
        return {
            status: 'error',
            error: error instanceof Error ? error.message : '未知錯誤',
        };
    }
}

/**
 * 獲取所有可用的指標名稱
 */
export async function getMetrics(): Promise<string[]> {
    try {
        const url = new URL('/api/v1/label/__name__/values', config.prometheus.url);

        const response = await fetch(url.toString());
        const data = await response.json() as { status: string; data?: string[] };

        if (data.status === 'success' && data.data) {
            return data.data;
        }
        return [];
    } catch (error) {
        console.error('獲取指標列表失敗:', error);
        return [];
    }
}

/**
 * 獲取指定標籤的所有值
 */
export async function getLabelValues(labelName: string): Promise<string[]> {
    try {
        const url = new URL(`/api/v1/label/${labelName}/values`, config.prometheus.url);

        const response = await fetch(url.toString());
        const data = await response.json() as { status: string; data?: string[] };

        if (data.status === 'success' && data.data) {
            return data.data;
        }
        return [];
    } catch (error) {
        console.error(`獲取標籤 ${labelName} 的值失敗:`, error);
        return [];
    }
}

/**
 * 檢查 Prometheus 連線狀態
 */
export async function checkHealth(): Promise<boolean> {
    try {
        const url = new URL('/-/healthy', config.prometheus.url);
        const response = await fetch(url.toString());
        return response.ok;
    } catch (error) {
        return false;
    }
}
