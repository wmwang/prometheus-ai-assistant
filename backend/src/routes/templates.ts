import { Router, Request, Response } from 'express';
import { templates, getTemplatesByCategory, getTemplateById, getCategories } from '../data/templates.js';

const router = Router();

/**
 * GET /api/templates
 * 取得所有模板（可依分類篩選）
 */
router.get('/', (req: Request, res: Response) => {
    const category = req.query.category as string | undefined;

    const filteredTemplates = getTemplatesByCategory(category);

    res.json({
        success: true,
        count: filteredTemplates.length,
        categories: getCategories(),
        templates: filteredTemplates,
    });
});

/**
 * GET /api/templates/categories
 * 取得所有模板分類
 */
router.get('/categories', (_req: Request, res: Response) => {
    const categories = getCategories();

    const categoryInfo = categories.map(cat => ({
        id: cat,
        name: getCategoryName(cat),
        count: templates.filter(t => t.category === cat).length,
    }));

    res.json({
        success: true,
        categories: categoryInfo,
    });
});

/**
 * GET /api/templates/:id
 * 取得單一模板
 */
router.get('/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const template = getTemplateById(id);

    if (template) {
        res.json({
            success: true,
            template,
        });
    } else {
        res.status(404).json({
            success: false,
            error: `模板 ${id} 不存在`,
        });
    }
});

/**
 * POST /api/templates/:id/apply
 * 套用模板並替換變數
 */
router.post('/:id/apply', (req: Request, res: Response) => {
    const { id } = req.params;
    const variables = req.body.variables || {};

    const template = getTemplateById(id);

    if (!template) {
        res.status(404).json({
            success: false,
            error: `模板 ${id} 不存在`,
        });
        return;
    }

    // 替換變數
    let promql = template.promql;
    if (template.variables) {
        for (const v of template.variables) {
            const value = variables[v.name] || v.default;
            promql = promql.replace(new RegExp(`{{${v.name}}}`, 'g'), value);
        }
    }

    res.json({
        success: true,
        template: {
            ...template,
            promql,
        },
    });
});

/**
 * 取得分類的中文名稱
 */
function getCategoryName(category: string): string {
    const names: Record<string, string> = {
        cpu: 'CPU',
        memory: '記憶體',
        network: '網路',
        http: 'HTTP',
        kubernetes: 'Kubernetes',
        disk: '磁碟',
        general: '通用',
    };
    return names[category] || category;
}

export default router;
