/**
 * 預設查詢模板
 * 常用的 PromQL 查詢範本
 */

export interface QueryTemplate {
    id: string;
    name: string;
    description: string;
    category: 'cpu' | 'memory' | 'network' | 'http' | 'kubernetes' | 'disk' | 'general';
    promql: string;
    variables?: {
        name: string;
        description: string;
        default: string;
        options?: string[];
    }[];
}

export const templates: QueryTemplate[] = [
    // === CPU 相關 ===
    {
        id: 'cpu-usage-by-node',
        name: 'CPU 使用率 (按節點)',
        description: '顯示每個節點的 CPU 使用率百分比',
        category: 'cpu',
        promql: '100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)',
    },
    {
        id: 'cpu-usage-by-pod',
        name: 'CPU 使用率 (按 Pod)',
        description: '顯示每個 Pod 的 CPU 使用率',
        category: 'cpu',
        promql: 'sum by (pod) (rate(container_cpu_usage_seconds_total{container!=""}[5m]))',
    },
    {
        id: 'cpu-high-usage',
        name: 'CPU 使用率超過閾值的節點',
        description: '找出 CPU 使用率超過指定閾值的節點',
        category: 'cpu',
        promql: '100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > {{threshold}}',
        variables: [
            { name: 'threshold', description: 'CPU 使用率閾值 (%)', default: '80' }
        ],
    },

    // === 記憶體相關 ===
    {
        id: 'memory-usage-by-node',
        name: '記憶體使用率 (按節點)',
        description: '顯示每個節點的記憶體使用率百分比',
        category: 'memory',
        promql: '(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100',
    },
    {
        id: 'memory-usage-by-pod',
        name: '記憶體使用量 (按 Pod)',
        description: '顯示每個 Pod 的記憶體使用量 (MB)',
        category: 'memory',
        promql: 'sum by (pod) (container_memory_usage_bytes{container!=""}) / 1024 / 1024',
    },
    {
        id: 'memory-high-usage',
        name: '記憶體使用率超過閾值的節點',
        description: '找出記憶體使用率超過指定閾值的節點',
        category: 'memory',
        promql: '(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100 > {{threshold}}',
        variables: [
            { name: 'threshold', description: '記憶體使用率閾值 (%)', default: '80' }
        ],
    },

    // === HTTP 相關 ===
    {
        id: 'http-request-rate',
        name: 'HTTP 請求速率',
        description: '每秒 HTTP 請求數',
        category: 'http',
        promql: 'sum(rate(http_requests_total[5m]))',
    },
    {
        id: 'http-error-rate',
        name: 'HTTP 錯誤率',
        description: 'HTTP 5xx 錯誤佔總請求的百分比',
        category: 'http',
        promql: 'sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) * 100',
    },
    {
        id: 'http-latency-p95',
        name: 'HTTP P95 延遲',
        description: 'HTTP 請求的第 95 百分位延遲',
        category: 'http',
        promql: 'histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket[5m])))',
    },
    {
        id: 'http-latency-p99',
        name: 'HTTP P99 延遲',
        description: 'HTTP 請求的第 99 百分位延遲',
        category: 'http',
        promql: 'histogram_quantile(0.99, sum by (le) (rate(http_request_duration_seconds_bucket[5m])))',
    },

    // === Kubernetes 相關 ===
    {
        id: 'pod-restarts',
        name: 'Pod 重啟次數',
        description: '過去 1 小時內各 Pod 的重啟次數',
        category: 'kubernetes',
        promql: 'sum by (pod, namespace) (increase(kube_pod_container_status_restarts_total[1h]))',
    },
    {
        id: 'pod-not-ready',
        name: '未就緒的 Pod',
        description: '目前狀態不是 Ready 的 Pod',
        category: 'kubernetes',
        promql: 'kube_pod_status_ready{condition="false"}',
    },
    {
        id: 'deployment-replicas',
        name: 'Deployment 副本狀態',
        description: '各 Deployment 的期望與實際副本數',
        category: 'kubernetes',
        promql: 'kube_deployment_status_replicas_available / kube_deployment_spec_replicas',
    },

    // === 磁碟相關 ===
    {
        id: 'disk-usage',
        name: '磁碟使用率',
        description: '各節點的磁碟使用率百分比',
        category: 'disk',
        promql: '(1 - (node_filesystem_avail_bytes{fstype!~"tmpfs|overlay"} / node_filesystem_size_bytes{fstype!~"tmpfs|overlay"})) * 100',
    },
    {
        id: 'disk-io-read',
        name: '磁碟讀取 IOPS',
        description: '每秒磁碟讀取操作數',
        category: 'disk',
        promql: 'sum by (instance) (rate(node_disk_reads_completed_total[5m]))',
    },
    {
        id: 'disk-io-write',
        name: '磁碟寫入 IOPS',
        description: '每秒磁碟寫入操作數',
        category: 'disk',
        promql: 'sum by (instance) (rate(node_disk_writes_completed_total[5m]))',
    },

    // === 網路相關 ===
    {
        id: 'network-receive',
        name: '網路接收流量',
        description: '每秒網路接收位元組數',
        category: 'network',
        promql: 'sum by (instance) (rate(node_network_receive_bytes_total[5m]))',
    },
    {
        id: 'network-transmit',
        name: '網路發送流量',
        description: '每秒網路發送位元組數',
        category: 'network',
        promql: 'sum by (instance) (rate(node_network_transmit_bytes_total[5m]))',
    },

    // === 通用 ===
    {
        id: 'up-targets',
        name: '監控目標狀態',
        description: '顯示所有監控目標的健康狀態',
        category: 'general',
        promql: 'up',
    },
    {
        id: 'topk-memory',
        name: '記憶體使用 Top K',
        description: '記憶體使用量最高的前 K 個 Pod',
        category: 'general',
        promql: 'topk({{k}}, sum by (pod) (container_memory_usage_bytes{container!=""}))',
        variables: [
            { name: 'k', description: '顯示前幾名', default: '10' }
        ],
    },
];

/**
 * 根據分類取得模板
 */
export function getTemplatesByCategory(category?: string): QueryTemplate[] {
    if (!category) return templates;
    return templates.filter(t => t.category === category);
}

/**
 * 根據 ID 取得模板
 */
export function getTemplateById(id: string): QueryTemplate | undefined {
    return templates.find(t => t.id === id);
}

/**
 * 取得所有分類
 */
export function getCategories(): string[] {
    return [...new Set(templates.map(t => t.category))];
}
