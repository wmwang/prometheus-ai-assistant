import dotenv from 'dotenv';

dotenv.config();

export const config = {
    // OpenAI 設定
    openai: {
        apiKey: process.env.OPENAI_API_KEY || '',
        model: process.env.OPENAI_MODEL || 'gpt-4',
    },

    // Prometheus 設定
    prometheus: {
        url: process.env.PROMETHEUS_URL || 'http://localhost:9090',
    },

    // Elasticsearch 設定（選用）
    elasticsearch: {
        url: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
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
