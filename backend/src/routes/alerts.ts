import { Router, Request, Response } from 'express';
import { generateAlertRule, AlertRule } from '../services/openai.js';
import * as yaml from 'yaml';

const router = Router();

interface AlertGenerateRequest {
    description: string;
    severity?: 'info' | 'warning' | 'critical';
}

/**
 * POST /api/alerts/generate
 * 根據自然語言描述生成告警規則
 */
router.post('/generate', async (req: Request, res: Response) => {
    try {
        const { description, severity } = req.body as AlertGenerateRequest;

        if (!description || typeof description !== 'string') {
            res.status(400).json({
                success: false,
                error: '請提供告警描述',
            });
            return;
        }

        const rule = await generateAlertRule(description, severity);

        // 生成 YAML 格式
        const yamlRule = generateYaml(rule);

        res.json({
            success: true,
            rule,
            yaml: yamlRule,
        });
    } catch (error) {
        console.error('告警規則生成 API 錯誤:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : '伺服器內部錯誤',
        });
    }
});

/**
 * 將告警規則轉換為 YAML 格式
 */
function generateYaml(rule: AlertRule): string {
    const alertSpec = {
        groups: [
            {
                name: 'ai-generated-alerts',
                rules: [
                    {
                        alert: rule.alert,
                        expr: rule.expr,
                        for: rule.for,
                        labels: rule.labels,
                        annotations: rule.annotations,
                    },
                ],
            },
        ],
    };

    return yaml.stringify(alertSpec);
}

/**
 * GET /api/alerts/examples
 * 取得告警規則範例
 */
router.get('/examples', (_req: Request, res: Response) => {
    const examples = [
        {
            description: '當 CPU 使用率超過 80% 持續 5 分鐘時發出警告',
            severity: 'warning',
        },
        {
            description: '當記憶體使用率超過 90% 時發出緊急告警',
            severity: 'critical',
        },
        {
            description: '當 Pod 在 15 分鐘內重啟超過 3 次時告警',
            severity: 'critical',
        },
        {
            description: '當 HTTP 5xx 錯誤率超過 5% 時發出警告',
            severity: 'warning',
        },
        {
            description: '當磁碟使用率超過 85% 時告警',
            severity: 'warning',
        },
        {
            description: '當監控目標無法連線時發出緊急告警',
            severity: 'critical',
        },
    ];

    res.json({
        success: true,
        examples,
    });
});

export default router;
