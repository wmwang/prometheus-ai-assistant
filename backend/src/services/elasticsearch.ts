/**
 * Elasticsearch 服務
 * 提供 Elasticsearch 連線、查詢與索引管理功能
 */

import { Client } from '@elastic/elasticsearch';
import { config } from '../config.js';

// Elasticsearch 客戶端（延遲初始化）
let esClient: Client | null = null;

/**
 * 獲取 Elasticsearch 客戶端
 * 如果尚未初始化，則建立新連線
 */
export function getElasticsearchClient(): Client {
    if (!config.elasticsearch.url) {
        throw new Error('Elasticsearch URL 未設定');
    }

    if (!esClient) {
        const auth: any = {};

        // 優先使用 API Key
        if (config.elasticsearch.auth.apiKey) {
            auth.apiKey = config.elasticsearch.auth.apiKey;
        }
        // 其次使用用戶名 + 密碼
        else if (config.elasticsearch.auth.username && config.elasticsearch.auth.password) {
            auth.username = config.elasticsearch.auth.username;
            auth.password = config.elasticsearch.auth.password;
        }

        esClient = new Client({
            node: config.elasticsearch.url,
            auth: Object.keys(auth).length > 0 ? auth : undefined,
            // 允許自簽證書（開發環境）
            tls: {
                rejectUnauthorized: false,
            },
        });
    }

    return esClient;
}

/**
 * 檢查 Elasticsearch 連線狀態
 */
export async function checkElasticsearchHealth(): Promise<boolean> {
    if (!config.elasticsearch.url) {
        return false;
    }
    try {
        const client = getElasticsearchClient();
        const health = await client.cluster.health();
        return health.status === 'green' || health.status === 'yellow';
    } catch (error) {
        // 靜默失敗，避免刷屏
        return false;
    }
}

/**
 * 獲取可用的索引列表
 */
export async function getIndices(): Promise<string[]> {
    try {
        const client = getElasticsearchClient();
        const response = await client.cat.indices({ format: 'json' });

        // 過濾掉系統索引（以 . 開頭）
        return response
            .map((index: any) => index.index)
            .filter((name: string) => !name.startsWith('.'))
            .sort();
    } catch (error) {
        console.error('獲取索引列表失敗:', error);
        throw new Error('無法獲取 Elasticsearch 索引列表');
    }
}

/**
 * 執行 Elasticsearch Query DSL 查詢
 */
export async function queryElasticsearch(
    index: string,
    queryDSL: any,
    options: { size?: number; from?: number } = {}
): Promise<any> {
    try {
        const client = getElasticsearchClient();
        const { size = 100, from = 0 } = options;

        const response = await client.search({
            index,
            body: queryDSL,
            size,
            from,
        });

        return {
            total: (response.hits.total as any).value || 0,
            hits: response.hits.hits.map((hit: any) => ({
                id: hit._id,
                index: hit._index,
                source: hit._source,
                score: hit._score,
            })),
        };
    } catch (error: any) {
        console.error('Elasticsearch 查詢失敗:', error);
        throw new Error(`查詢執行失敗: ${error.message}`);
    }
}

/**
 * 執行 KQL (Kibana Query Language) 查詢
 * 注意：需要將 KQL 轉換為 Query DSL
 */
export async function executeKQL(
    index: string,
    kql: string,
    options: { size?: number; from?: number; timeField?: string; timeRange?: string } = {}
): Promise<any> {
    try {
        const { size = 100, from = 0, timeField = '@timestamp', timeRange = '15m' } = options;

        // 建立基本的 Query DSL
        const queryDSL: any = {
            query: {
                bool: {
                    must: [],
                    filter: [],
                },
            },
            sort: [
                { [timeField]: { order: 'desc' } },
            ],
        };

        // 簡單的 KQL 解析（僅支援基本語法）
        // 例如：message: "error" AND status: 500
        if (kql.trim()) {
            // 清理 KQL 中的時間範圍語法（這些應該由 filter 處理）
            // 移除類似 "@timestamp >= now()-1h" 這樣的語法
            let cleanKql = kql.replace(/@timestamp\s*(>=|<=|>|<)\s*now\(\)-?\w*/gi, '').trim();
            // 移除多餘的 AND/OR 運算符
            cleanKql = cleanKql.replace(/^\s*(AND|OR)\s+/i, '').replace(/\s+(AND|OR)\s*$/i, '').trim();

            // 如果清理後還有內容，才加入查詢
            if (cleanKql) {
                // 將 KQL 轉換為 query_string 查詢
                queryDSL.query.bool.must.push({
                    query_string: {
                        query: cleanKql,
                    },
                });
            }
        }

        // 加入時間範圍過濾
        if (timeRange) {
            queryDSL.query.bool.filter.push({
                range: {
                    [timeField]: {
                        gte: `now-${timeRange}`,
                        lte: 'now',
                    },
                },
            });
        }

        return await queryElasticsearch(index, queryDSL, { size, from });
    } catch (error: any) {
        console.error('KQL 查詢執行失敗:', error);
        throw new Error(`KQL 查詢執行失敗: ${error.message}`);
    }
}

/**
 * 搜尋日誌（簡單的全文搜尋）
 */
export async function searchLogs(
    index: string,
    searchTerm: string,
    options: { size?: number; timeRange?: string; timeField?: string } = {}
): Promise<any> {
    try {
        const { size = 100, timeRange = '1h', timeField = '@timestamp' } = options;

        const queryDSL = {
            query: {
                bool: {
                    must: [
                        {
                            multi_match: {
                                query: searchTerm,
                                fields: ['message', 'log', 'error', '*'],
                                type: 'best_fields',
                            },
                        },
                    ],
                    filter: [
                        {
                            range: {
                                [timeField]: {
                                    gte: `now-${timeRange}`,
                                    lte: 'now',
                                },
                            },
                        },
                    ],
                },
            },
            sort: [
                { [timeField]: { order: 'desc' } },
            ],
        };

        return await queryElasticsearch(index, queryDSL, { size });
    } catch (error: any) {
        console.error('日誌搜尋失敗:', error);
        throw new Error(`日誌搜尋失敗: ${error.message}`);
    }
}
