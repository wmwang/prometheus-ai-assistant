import OpenAI from 'openai';
import { config } from '../config.js';
import {
    PROMQL_GENERATOR_SYSTEM_PROMPT,
    PROMQL_GENERATOR_USER_PROMPT,
} from '../prompts/promql-generator.js';
import {
    INSIGHTS_ANALYZER_SYSTEM_PROMPT,
    INSIGHTS_ANALYZER_USER_PROMPT,
} from '../prompts/insights-analyzer.js';
import {
    ALERT_GENERATOR_SYSTEM_PROMPT,
    ALERT_GENERATOR_USER_PROMPT,
} from '../prompts/alert-generator.js';
import {
    DIAGNOSIS_SYSTEM_PROMPT,
    DIAGNOSIS_PHASE1_PROMPT,
    DIAGNOSIS_PHASE2_PROMPT,
    QUICK_DIAGNOSIS_PROMPT,
} from '../prompts/diagnosis.js';
import {
    NL2QueryDSL_SYSTEM_PROMPT,
    NL2QueryDSL_USER_PROMPT,
    NL2KQL_SYSTEM_PROMPT,
    NL2KQL_USER_PROMPT,
    LOG_DIAGNOSIS_SYSTEM_PROMPT,
    LOG_DIAGNOSIS_USER_PROMPT,
} from '../prompts/elasticsearch.js';

// 初始化 OpenAI 客戶端
const openai = new OpenAI({
    apiKey: config.openai.apiKey,
    baseURL: config.openai.baseUrl, // Core: Support for custom endpoints
});

// PromQL 生成結果介面
export interface PromQLResult {
    promql: string;
    explanation: string;
    suggestions: string[];
}

// 見解分析結果介面
export interface InsightItem {
    type: 'trend' | 'anomaly' | 'performance' | 'resource';
    severity: 'info' | 'warning' | 'critical';
    title: string;
    description: string;
}

export interface NextStep {
    description: string;
    promql?: string;
}

export interface InsightsResult {
    summary: string;
    insights: InsightItem[];
    nextSteps: NextStep[];
}

/**
 * 將自然語言轉換為 PromQL 查詢
 */
export async function generatePromQL(
    naturalLanguage: string,
    availableMetrics?: string[]
): Promise<PromQLResult> {
    try {
        const response = await openai.chat.completions.create({
            model: config.openai.model,
            messages: [
                {
                    role: 'system',
                    content: PROMQL_GENERATOR_SYSTEM_PROMPT,
                },
                {
                    role: 'user',
                    content: PROMQL_GENERATOR_USER_PROMPT(naturalLanguage, availableMetrics),
                },
            ],
            temperature: 0.3, // 較低的溫度以獲得更一致的輸出
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error('OpenAI 回應為空');
        }

        // 嘗試解析 JSON，如果失敗則嘗試擷取 JSON 部分
        let jsonContent = content;
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            jsonContent = jsonMatch[0];
        }

        const result = JSON.parse(jsonContent) as PromQLResult;
        return result;
    } catch (error) {
        console.error('生成 PromQL 時發生錯誤:', error);
        throw error;
    }
}

/**
 * 分析 Prometheus 查詢結果，提供見解
 */
export async function analyzeInsights(
    query: string,
    data: any,
    timeRange?: string
): Promise<InsightsResult> {
    try {
        const response = await openai.chat.completions.create({
            model: config.openai.model,
            messages: [
                {
                    role: 'system',
                    content: INSIGHTS_ANALYZER_SYSTEM_PROMPT,
                },
                {
                    role: 'user',
                    content: INSIGHTS_ANALYZER_USER_PROMPT(query, data, timeRange),
                },
            ],
            temperature: 0.5,
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error('OpenAI 回應為空');
        }

        // 嘗試解析 JSON，如果失敗則嘗試擷取 JSON 部分
        let jsonContent = content;
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            jsonContent = jsonMatch[0];
        }

        const result = JSON.parse(jsonContent) as InsightsResult;
        return result;
    } catch (error) {
        console.error('分析見解時發生錯誤:', error);
        throw error;
    }
}

// 對話歷史訊息介面
export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

/**
 * 帶有對話歷史的 PromQL 生成
 * 讓 AI 能理解之前的對話上下文
 */
export async function generatePromQLWithHistory(
    naturalLanguage: string,
    history: ChatMessage[],
    availableMetrics?: string[]
): Promise<PromQLResult> {
    try {
        // 構建訊息陣列，包含歷史對話
        const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
            {
                role: 'system',
                content: PROMQL_GENERATOR_SYSTEM_PROMPT + `

## 對話上下文
你正在與使用者進行連續對話。請根據之前的對話上下文來理解當前的查詢。
例如，如果使用者之前問過 "CPU 使用率"，現在問 "那記憶體呢？"，你應該理解他想查詢記憶體使用率。
如果使用者說 "改成過去1小時" 或 "加上節點標籤"，請在之前生成的查詢基礎上修改。`,
            },
        ];

        // 加入歷史對話（限制最近 6 輪）
        const recentHistory = history.slice(-12);
        for (const msg of recentHistory) {
            messages.push({
                role: msg.role,
                content: msg.content,
            });
        }

        // 加入當前查詢
        messages.push({
            role: 'user',
            content: PROMQL_GENERATOR_USER_PROMPT(naturalLanguage, availableMetrics),
        });

        const response = await openai.chat.completions.create({
            model: config.openai.model,
            messages,
            temperature: 0.3,
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error('OpenAI 回應為空');
        }

        // 嘗試解析 JSON
        let jsonContent = content;
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            jsonContent = jsonMatch[0];
        }

        const result = JSON.parse(jsonContent) as PromQLResult;
        return result;
    } catch (error) {
        console.error('生成 PromQL (帶歷史) 時發生錯誤:', error);
        throw error;
    }
}

// 告警規則結果介面
export interface AlertRule {
    alert: string;
    expr: string;
    for: string;
    labels: Record<string, string>;
    annotations: Record<string, string>;
    explanation: string;
}

/**
 * 生成 Prometheus 告警規則
 */
export async function generateAlertRule(
    description: string,
    severity?: 'info' | 'warning' | 'critical'
): Promise<AlertRule> {
    try {
        const response = await openai.chat.completions.create({
            model: config.openai.model,
            messages: [
                {
                    role: 'system',
                    content: ALERT_GENERATOR_SYSTEM_PROMPT,
                },
                {
                    role: 'user',
                    content: ALERT_GENERATOR_USER_PROMPT(description, severity),
                },
            ],
            temperature: 0.3,
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error('OpenAI 回應為空');
        }

        // 嘗試解析 JSON
        let jsonContent = content;
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            jsonContent = jsonMatch[0];
        }

        const result = JSON.parse(jsonContent) as AlertRule;
        return result;
    } catch (error) {
        console.error('生成告警規則時發生錯誤:', error);
        throw error;
    }
}

// 診斷結果介面
export interface DiagnosisPhase1Result {
    possibleCauses: Array<{
        cause: string;
        probability: string;
        explanation: string;
    }>;
    relatedQueries: Array<{
        purpose: string;
        promql: string;
        expectedPattern: string;
    }>;
    immediateChecks: string[];
}

export interface DiagnosisPhase2Result {
    rootCause: {
        summary: string;
        details: string;
        confidence: string;
        evidence: string[];
    };
    timeline: Array<{
        time: string;
        event: string;
    }>;
    remediation: {
        immediate: Array<{
            action: string;
            command?: string;
            risk: string;
        }>;
        shortTerm: string[];
        longTerm: string[];
    };
    relatedAlerts: Array<{
        name: string;
        expr: string;
        description: string;
    }>;
}

/**
 * 快速診斷 - 根據 PromQL 快速分析
 */
export async function quickDiagnosis(
    promql: string,
    metricType: string,
    currentValue: string
): Promise<string> {
    try {
        const prompt = QUICK_DIAGNOSIS_PROMPT
            .replace('{promql}', promql)
            .replace('{metricType}', metricType)
            .replace('{currentValue}', currentValue);

        const response = await openai.chat.completions.create({
            model: config.openai.model,
            messages: [
                {
                    role: 'system',
                    content: '你是一位 Prometheus 監控專家，專精於指標分析和故障診斷。請用繁體中文回答。',
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            temperature: 0.5,
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error('OpenAI 回應為空');
        }

        return content;
    } catch (error) {
        console.error('快速診斷時發生錯誤:', error);
        throw error;
    }
}

/**
 * 診斷對話 - 支援多階段分析
 */
export async function diagnosisChat(
    phase: 'phase1' | 'phase2',
    params: Record<string, string>
): Promise<DiagnosisPhase1Result | DiagnosisPhase2Result> {
    try {
        let userPrompt: string;

        if (phase === 'phase1') {
            userPrompt = DIAGNOSIS_PHASE1_PROMPT
                .replace('{metric}', params.metric || '')
                .replace('{description}', params.description || '')
                .replace('{timeRange}', params.timeRange || '1h');
        } else {
            userPrompt = DIAGNOSIS_PHASE2_PROMPT
                .replace('{metric}', params.metric || '')
                .replace('{description}', params.description || '')
                .replace('{relatedData}', params.relatedData || '無');
        }

        const response = await openai.chat.completions.create({
            model: config.openai.model,
            messages: [
                {
                    role: 'system',
                    content: DIAGNOSIS_SYSTEM_PROMPT,
                },
                {
                    role: 'user',
                    content: userPrompt,
                },
            ],
            temperature: 0.4,
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error('OpenAI 回應為空');
        }

        // 提取 JSON
        let jsonContent = content;
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            jsonContent = jsonMatch[0];
        }

        return JSON.parse(jsonContent);
    } catch (error) {
        console.error(`診斷 ${phase} 時發生錯誤:`, error);

        // 返回預設結構以避免崩潰
        if (phase === 'phase1') {
            return {
                possibleCauses: [{ cause: '分析失敗', probability: '未知', explanation: '請稍後再試' }],
                relatedQueries: [],
                immediateChecks: ['請手動檢查相關指標']
            };
        } else {
            return {
                rootCause: { summary: '分析失敗', details: '請稍後再試', confidence: '低', evidence: [] },
                timeline: [],
                remediation: { immediate: [], shortTerm: [], longTerm: [] },
                relatedAlerts: []
            };
        }
    }
}

// ==================== Elasticsearch 相關函數 ====================

/**
 * 自然語言轉 Elasticsearch Query DSL
 */
export async function generateQueryDSL(
    userInput: string,
    availableFields?: string[]
): Promise<{ queryDSL: any; explanation: string }> {
    try {
        const response = await openai.chat.completions.create({
            model: config.openai.model,
            messages: [
                {
                    role: 'system',
                    content: NL2QueryDSL_SYSTEM_PROMPT,
                },
                {
                    role: 'user',
                    content: NL2QueryDSL_USER_PROMPT(userInput, availableFields),
                },
            ],
            temperature: 0.3,
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error('OpenAI 回應為空');
        }

        // 提取 JSON
        let jsonContent = content;
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            jsonContent = jsonMatch[0];
        }

        const queryDSL = JSON.parse(jsonContent);

        return {
            queryDSL,
            explanation: `生成的 Elasticsearch Query DSL 查詢`
        };
    } catch (error) {
        console.error('生成 Query DSL 時發生錯誤:', error);
        throw error;
    }
}

/**
 * 自然語言轉 KQL (Kibana Query Language)
 */
export async function generateKQL(userInput: string): Promise<{ kql: string; explanation: string }> {
    try {
        const response = await openai.chat.completions.create({
            model: config.openai.model,
            messages: [
                {
                    role: 'system',
                    content: NL2KQL_SYSTEM_PROMPT,
                },
                {
                    role: 'user',
                    content: NL2KQL_USER_PROMPT(userInput),
                },
            ],
            temperature: 0.3,
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error('OpenAI 回應為空');
        }

        // KQL 通常是簡單字串，不需要 JSON 解析
        const kql = content.trim().replace(/^```.*\n|```$/g, '');

        return {
            kql,
            explanation: `生成的 KQL 查詢語法`
        };
    } catch (error) {
        console.error('生成 KQL 時發生錯誤:', error);
        throw error;
    }
}

// 日誌診斷結果介面
export interface LogDiagnosisResult {
    errorType: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    summary: string;
    possibleCauses: Array<{
        cause: string;
        probability: 'high' | 'medium' | 'low';
        explanation: string;
    }>;
    remediation: {
        immediate: Array<{
            action: string;
            command?: string;
        }>;
        shortTerm: string[];
        longTerm: string[];
    };
    relatedQueries: Array<{
        purpose: string;
        kql: string;
    }>;
}

/**
 * 日誌診斷 - 分析日誌內容並提供建議
 */
export async function diagnoseLog(
    logContent: string,
    context?: string
): Promise<LogDiagnosisResult> {
    try {
        const response = await openai.chat.completions.create({
            model: config.openai.model,
            messages: [
                {
                    role: 'system',
                    content: LOG_DIAGNOSIS_SYSTEM_PROMPT,
                },
                {
                    role: 'user',
                    content: LOG_DIAGNOSIS_USER_PROMPT(logContent, context),
                },
            ],
            temperature: 0.4,
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error('OpenAI 回應為空');
        }

        // 提取 JSON
        let jsonContent = content;
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            jsonContent = jsonMatch[0];
        }

        return JSON.parse(jsonContent) as LogDiagnosisResult;
    } catch (error) {
        console.error('日誌診斷時發生錯誤:', error);

        // 返回預設結構
        return {
            errorType: '分析失敗',
            severity: 'medium',
            summary: '無法分析日誌內容，請稍後再試',
            possibleCauses: [],
            remediation: {
                immediate: [],
                shortTerm: [],
                longTerm: []
            },
            relatedQueries: []
        };
    }
}

/**
 * 日誌診斷 (串流版) - 支援 SSE
 */
export async function* diagnoseLogStream(
    logContent: string,
    context?: string
): AsyncGenerator<string, void, unknown> {
    try {
        const stream = await openai.chat.completions.create({
            model: config.openai.model,
            messages: [
                {
                    role: 'system',
                    content: LOG_DIAGNOSIS_SYSTEM_PROMPT,
                },
                {
                    role: 'user',
                    content: LOG_DIAGNOSIS_USER_PROMPT(logContent, context),
                },
            ],
            temperature: 0.4,
            stream: true,
        });

        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
                yield content;
            }
        }
    } catch (error) {
        console.error('日誌診斷 (串流) 時發生錯誤:', error);
        throw error;
    }
}
