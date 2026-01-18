import dotenv from 'dotenv';

dotenv.config();

export const config = {
    // OpenAI 設定
    openai: {
        apiKey: process.env.OPENAI_API_KEY || '',
        model: process.env.OPENAI_MODEL || 'gpt-4',
        baseUrl: process.env.OPENAI_BASE_URL, // Optional: for custom LLM endpoints
    },

    // Prometheus 設定
    prometheus: {
        url: process.env.PROMETHEUS_URL || 'http://localhost:9090',
        headers: (() => {
            // Priority 1: Custom Headers JSON
            if (process.env.PROMETHEUS_HEADERS) {
                try {
                    return JSON.parse(process.env.PROMETHEUS_HEADERS);
                } catch (e) {
                    console.warn('⚠️ PROMETHEUS_HEADERS format error, using default');
                }
            }
            // Priority 2: Basic Auth
            if (process.env.PROMETHEUS_USERNAME && process.env.PROMETHEUS_PASSWORD) {
                const token = Buffer.from(`${process.env.PROMETHEUS_USERNAME}:${process.env.PROMETHEUS_PASSWORD}`).toString('base64');
                return { 'Authorization': `Basic ${token}` };
            }
            return {};
        })(),
    },

    // Elasticsearch 設定（選用）
    elasticsearch: {
        // 若環境變數未設定，則視為未啟用 (空字串)
        url: process.env.ELASTICSEARCH_URL || '',
        auth: {
            username: process.env.ELASTICSEARCH_USERNAME,
            password: process.env.ELASTICSEARCH_PASSWORD,
            apiKey: process.env.ELASTICSEARCH_API_KEY,
        },
    },

    // 伺服器設定
    server: {
        port: parseInt(process.env.PORT || '3001', 10),
    },
};

// 驗證必要設定
export function validateConfig(): void {
    if (!config.openai.apiKey) {
        console.warn('⚠️ 警告: OPENAI_API_KEY 未設定，AI 功能將無法使用');
    }

    // Elasticsearch 為選用功能，顯示配置狀態
    if (config.elasticsearch.url) {
        console.info(`ℹ️ Elasticsearch URL: ${config.elasticsearch.url}`);
    }
}
