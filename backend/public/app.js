/**
 * Prometheus AI 助手 - 獨立 Web 介面 JavaScript
 */

class PromAIAssistant {
    constructor() {
        // 後端 URL - 從當前頁面推斷
        this.backendUrl = window.location.origin;

        // Session 管理
        this.sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.conversationHistory = [];

        // 當前狀態
        this.currentMode = 'query';
        this.currentPromQL = '';
        this.currentYaml = '';

        this.init();
    }

    init() {
        this.cacheElements();
        this.bindEvents();
        this.checkBackendStatus();
    }

    cacheElements() {
        // Tabs
        this.tabs = document.querySelectorAll('.tab');
        this.modeContents = document.querySelectorAll('.mode-content');

        // Query Mode
        this.queryInput = document.querySelector('.query-input');
        this.submitQueryBtn = document.querySelector('.submit-query');
        this.queryLoading = document.querySelector('.query-mode .loading');
        this.queryError = document.querySelector('.query-mode .error');
        this.queryResult = document.querySelector('.query-result');
        this.promqlCode = document.querySelector('.promql-code');
        this.explanationText = document.querySelector('.explanation-text');
        this.copyPromqlBtn = document.querySelector('.copy-promql');
        this.analyzeBtn = document.querySelector('.analyze-btn');
        this.diagnoseBtn = document.querySelector('.diagnose-btn');
        this.insightsSection = document.querySelector('.insights-section');
        this.insightsList = document.querySelector('.insights-list');

        // History
        this.historySection = document.querySelector('.history-section');
        this.historyList = document.querySelector('.history-list');
        this.clearHistoryBtn = document.querySelector('.clear-history');

        // Diagnosis Mode
        this.diagnosisInput = document.querySelector('.diagnosis-input');
        this.submitDiagnosisBtn = document.querySelector('.submit-diagnosis');
        this.submitDeepDiagnosisBtn = document.querySelector('.submit-deep-diagnosis');
        this.includeRelatedCheckbox = document.querySelector('.include-related');
        this.diagnosisLoading = document.querySelector('.diagnosis-loading');
        this.diagnosisLoadingText = document.querySelector('.diagnosis-loading-text');
        this.diagnosisError = document.querySelector('.diagnosis-error');
        this.diagnosisResult = document.querySelector('.diagnosis-result');
        this.diagnosisContent = document.querySelector('.diagnosis-content');
        this.issuesList = document.querySelector('.issues-list');
        this.relatedMetricsSection = document.querySelector('.related-metrics-section');
        this.relatedMetricsList = document.querySelector('.related-metrics-list');
        this.deepAnalysisSection = document.querySelector('.deep-analysis-section');
        this.rootCauseContent = document.querySelector('.root-cause-content');
        this.remediationContent = document.querySelector('.remediation-content');

        // Alert Mode
        this.alertInput = document.querySelector('.alert-input');
        this.severitySelect = document.querySelector('.severity');
        this.submitAlertBtn = document.querySelector('.submit-alert');
        this.alertLoading = document.querySelector('.alert-loading');
        this.alertError = document.querySelector('.alert-error');
        this.alertResult = document.querySelector('.alert-result');
        this.alertName = document.querySelector('.alert-name');
        this.alertSeverityBadge = document.querySelector('.alert-severity-badge');
        this.alertExpr = document.querySelector('.alert-expr');
        this.alertExplanation = document.querySelector('.alert-explanation');
        this.yamlCode = document.querySelector('.yaml-code');
        this.copyYamlBtn = document.querySelector('.copy-yaml');

        // Template Mode
        this.categoryBtns = document.querySelectorAll('.category-btn');
        this.templateList = document.querySelector('.template-list');

        // Status
        this.backendStatus = document.querySelector('.backend-status');

        // Logs Mode - 初始化日誌元素
        this.cacheLogsElements();
    }

    bindEvents() {
        // Tab 切換
        this.tabs.forEach(tab => {
            tab.addEventListener('click', () => this.switchMode(tab.dataset.mode));
        });

        // 查詢送出
        this.submitQueryBtn.addEventListener('click', () => this.submitQuery());
        this.queryInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.submitQuery();
            }
        });

        // 複製 PromQL
        this.copyPromqlBtn.addEventListener('click', () => this.copyToClipboard(this.currentPromQL, this.copyPromqlBtn));

        // 分析見解
        this.analyzeBtn.addEventListener('click', () => this.analyzeInsights());

        // 診斷按鈕（在查詢結果中）
        if (this.diagnoseBtn) {
            this.diagnoseBtn.addEventListener('click', () => this.diagnoseCurrentPromQL());
        }

        // 清除歷史
        this.clearHistoryBtn.addEventListener('click', () => this.clearHistory());

        // 診斷模式 - 快速診斷
        if (this.submitDiagnosisBtn) {
            this.submitDiagnosisBtn.addEventListener('click', () => this.submitDiagnosis());
        }
        // 診斷模式 - 深度分析
        if (this.submitDeepDiagnosisBtn) {
            this.submitDeepDiagnosisBtn.addEventListener('click', () => this.submitDeepDiagnosis());
        }
        if (this.diagnosisInput) {
            this.diagnosisInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.submitDiagnosis();
                }
            });
        }

        // 告警送出
        this.submitAlertBtn.addEventListener('click', () => this.submitAlert());
        this.alertInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.submitAlert();
            }
        });

        // 複製 YAML
        this.copyYamlBtn.addEventListener('click', () => this.copyToClipboard(this.currentYaml, this.copyYamlBtn));

        // 模板分類
        this.categoryBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.categoryBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.loadTemplates(btn.dataset.category);
            });
        });

        // 日誌模式事件綁定
        this.bindLogsEvents();
    }

    switchMode(mode) {
        this.currentMode = mode;

        this.tabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.mode === mode);
        });

        this.modeContents.forEach(content => {
            content.classList.remove('active');
        });

        document.querySelector(`.${mode}-mode`).classList.add('active');

        if (mode === 'template') {
            this.loadTemplates('');
        } else if (mode === 'diagnosis') {
            this.loadCommonIssues();
        } else if (mode === 'logs') {
            this.loadElasticsearchIndices();
        }
    }

    async checkBackendStatus() {
        try {
            const response = await fetch(`${this.backendUrl}/health`);
            const data = await response.json();

            if (data.status === 'ok') {
                this.backendStatus.textContent = '✅ 已連線';
                this.backendStatus.className = 'backend-status connected';
            } else {
                throw new Error('Backend not ok');
            }
        } catch (error) {
            this.backendStatus.textContent = '❌ 無法連線';
            this.backendStatus.className = 'backend-status disconnected';
        }
    }

    // ==================== 查詢功能 ====================

    async submitQuery() {
        const query = this.queryInput.value.trim();
        if (!query) return;

        this.showLoading(this.queryLoading);
        this.hideError(this.queryError);
        this.queryResult.classList.remove('show');

        try {
            const response = await fetch(`${this.backendUrl}/api/promql/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query, sessionId: this.sessionId }),
            });

            const data = await response.json();

            if (data.success) {
                this.currentPromQL = data.promql;
                this.promqlCode.textContent = data.promql;
                this.explanationText.textContent = data.explanation;

                // 更新歷史
                this.conversationHistory.push({ role: 'user', content: query });
                this.conversationHistory.push({ role: 'assistant', content: data.promql });
                this.renderHistory();

                // 清空輸入
                this.queryInput.value = '';

                // 隱藏見解
                this.insightsSection.style.display = 'none';

                this.queryResult.classList.add('show');
            } else {
                this.showError(this.queryError, data.error || '生成失敗');
            }
        } catch (error) {
            this.showError(this.queryError, `無法連線到後端服務`);
        } finally {
            this.hideLoading(this.queryLoading);
        }
    }

    async analyzeInsights() {
        if (!this.currentPromQL) return;

        this.showLoading(this.queryLoading);

        try {
            const response = await fetch(`${this.backendUrl}/api/insights/query`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ promql: this.currentPromQL }),
            });

            const data = await response.json();

            if (data.success && data.insights) {
                this.renderInsights(data.insights);
                this.insightsSection.style.display = 'block';
            }
        } catch (error) {
            console.error('分析見解失敗:', error);
        } finally {
            this.hideLoading(this.queryLoading);
        }
    }

    diagnoseCurrentPromQL() {
        if (!this.currentPromQL) return;

        // 切換到診斷模式並填入當前 PromQL
        this.switchMode('diagnosis');
        this.diagnosisInput.value = this.currentPromQL;
        this.submitDiagnosis();
    }

    renderInsights(insights) {
        if (!insights.length) {
            this.insightsList.innerHTML = '<p>無可用的見解分析</p>';
            return;
        }

        this.insightsList.innerHTML = insights.map(insight => `
            <div class="insight-card ${insight.severity}">
                <div class="insight-title">${insight.title}</div>
                <div class="insight-desc">${insight.description}</div>
            </div>
        `).join('');
    }

    renderHistory() {
        if (this.conversationHistory.length === 0) {
            this.historySection.style.display = 'none';
            return;
        }

        this.historySection.style.display = 'block';

        const recentHistory = this.conversationHistory.slice(-6);
        this.historyList.innerHTML = recentHistory.map(msg => {
            if (msg.role === 'user') {
                return `<div class="history-item history-user">👤 ${this.escapeHtml(msg.content)}</div>`;
            } else {
                return `<div class="history-item history-assistant">🤖 <code>${this.escapeHtml(msg.content)}</code></div>`;
            }
        }).join('');
    }

    clearHistory() {
        this.conversationHistory = [];
        this.sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.historySection.style.display = 'none';
        this.historyList.innerHTML = '';
    }

    // ==================== 診斷功能 ====================

    async loadCommonIssues() {
        try {
            const response = await fetch(`${this.backendUrl}/api/diagnosis/common-issues`);
            const data = await response.json();

            if (data.success && data.issues) {
                this.renderCommonIssues(data.issues);
            }
        } catch (error) {
            console.error('載入常見問題失敗:', error);
        }
    }

    renderCommonIssues(issues) {
        this.issuesList.innerHTML = issues.map(issue => `
            <div class="issue-item" data-checks='${JSON.stringify(issue.suggestedChecks)}'>
                <div class="issue-pattern">${issue.pattern}</div>
                <div class="issue-desc">${issue.description}</div>
            </div>
        `).join('');

        // 綁定點擊事件
        this.issuesList.querySelectorAll('.issue-item').forEach(item => {
            item.addEventListener('click', () => {
                const checks = JSON.parse(item.dataset.checks);
                if (checks && checks.length > 0) {
                    this.diagnosisInput.value = checks[0];
                }
            });
        });
    }

    async submitDiagnosis() {
        const input = this.diagnosisInput.value.trim();
        if (!input) return;

        const includeRelated = this.includeRelatedCheckbox?.checked ?? true;

        this.diagnosisLoadingText.textContent = 'AI 正在分析...';
        this.showLoading(this.diagnosisLoading);
        this.hideError(this.diagnosisError);
        this.diagnosisResult.classList.remove('show');
        this.relatedMetricsSection.style.display = 'none';
        this.deepAnalysisSection.style.display = 'none';

        try {
            const response = await fetch(`${this.backendUrl}/api/diagnosis/quick`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ promql: input, includeRelated }),
            });

            const data = await response.json();

            if (data.success) {
                this.renderDiagnosisResult(data);
                this.diagnosisResult.classList.add('show');
            } else {
                this.showError(this.diagnosisError, data.error || '診斷失敗');
            }
        } catch (error) {
            this.showError(this.diagnosisError, `無法連線到後端服務`);
        } finally {
            this.hideLoading(this.diagnosisLoading);
        }
    }

    async submitDeepDiagnosis() {
        const input = this.diagnosisInput.value.trim();
        if (!input) return;

        this.diagnosisLoadingText.textContent = 'AI 正在進行深度根因分析（可能需要 30 秒）...';
        this.showLoading(this.diagnosisLoading);
        this.hideError(this.diagnosisError);
        this.diagnosisResult.classList.remove('show');
        this.relatedMetricsSection.style.display = 'none';
        this.deepAnalysisSection.style.display = 'none';

        try {
            const response = await fetch(`${this.backendUrl}/api/diagnosis/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    metric: input,
                    description: '指標出現異常',
                    timeRange: '1h'
                }),
            });

            const data = await response.json();

            if (data.success) {
                this.renderDeepAnalysisResult(data.analysis);
                this.diagnosisResult.classList.add('show');
            } else {
                this.showError(this.diagnosisError, data.error || '深度分析失敗');
            }
        } catch (error) {
            this.showError(this.diagnosisError, `無法連線到後端服務`);
        } finally {
            this.hideLoading(this.diagnosisLoading);
        }
    }

    renderDiagnosisResult(data) {
        const { diagnosis, context } = data;

        // 渲染相關指標
        if (context?.relatedMetrics && context.relatedMetrics.length > 0) {
            this.renderRelatedMetrics(context.relatedMetrics);
            this.relatedMetricsSection.style.display = 'block';
        }

        let html = `<div class="diagnosis-text">${this.formatDiagnosisText(diagnosis)}</div>`;

        if (context && context.metricType) {
            html += `
                <div class="diagnosis-context">
                    <div class="context-item">
                        <span class="context-label">指標類型：</span>
                        <span class="context-value">${context.metricType}</span>
                    </div>
                </div>
            `;
        }

        this.diagnosisContent.innerHTML = html;
    }

    renderRelatedMetrics(metrics) {
        this.relatedMetricsList.innerHTML = metrics.map(m => `
            <div class="related-metric-item">
                <div class="related-metric-purpose">${m.purpose}</div>
                <code class="related-metric-promql">${m.promql}</code>
            </div>
        `).join('');
    }

    renderDeepAnalysisResult(analysis) {
        // 渲染相關查詢
        if (analysis.relatedQueries && analysis.relatedQueries.length > 0) {
            this.renderRelatedMetrics(analysis.relatedQueries);
            this.relatedMetricsSection.style.display = 'block';
        }

        // 渲染可能原因
        let summaryHtml = '';
        if (analysis.possibleCauses && analysis.possibleCauses.length > 0) {
            summaryHtml += '<div class="possible-causes"><strong>可能原因：</strong><ul>';
            analysis.possibleCauses.forEach(c => {
                summaryHtml += `<li><strong>${c.cause}</strong> (可能性: ${c.probability})<br><span class="cause-explanation">${c.explanation}</span></li>`;
            });
            summaryHtml += '</ul></div>';
        }

        // 渲染立即檢查項目
        if (analysis.immediateChecks && analysis.immediateChecks.length > 0) {
            summaryHtml += '<div class="immediate-checks"><strong>立即檢查：</strong><ul>';
            analysis.immediateChecks.forEach(c => {
                summaryHtml += `<li>${c}</li>`;
            });
            summaryHtml += '</ul></div>';
        }

        this.diagnosisContent.innerHTML = summaryHtml || '<p>分析完成</p>';

        // 渲染根因分析
        if (analysis.rootCause) {
            let rootCauseHtml = `
                <div class="root-cause-summary">
                    <strong>${analysis.rootCause.summary}</strong>
                    <span class="confidence-badge">${analysis.rootCause.confidence} 信心度</span>
                </div>
                <p>${analysis.rootCause.details}</p>
            `;
            if (analysis.rootCause.evidence && analysis.rootCause.evidence.length > 0) {
                rootCauseHtml += '<div class="evidence"><strong>證據：</strong><ul>';
                analysis.rootCause.evidence.forEach(e => {
                    rootCauseHtml += `<li>${e}</li>`;
                });
                rootCauseHtml += '</ul></div>';
            }
            this.rootCauseContent.innerHTML = rootCauseHtml;
        }

        // 渲染修復建議
        if (analysis.remediation) {
            let remediationHtml = '';
            if (analysis.remediation.immediate && analysis.remediation.immediate.length > 0) {
                remediationHtml += '<div class="remediation-immediate"><strong>🚨 立即執行：</strong><ul>';
                analysis.remediation.immediate.forEach(r => {
                    remediationHtml += `<li>${r.action}`;
                    if (r.command) remediationHtml += `<br><code>${r.command}</code>`;
                    remediationHtml += `</li>`;
                });
                remediationHtml += '</ul></div>';
            }
            if (analysis.remediation.shortTerm && analysis.remediation.shortTerm.length > 0) {
                remediationHtml += '<div class="remediation-short"><strong>📋 短期措施：</strong><ul>';
                analysis.remediation.shortTerm.forEach(r => {
                    remediationHtml += `<li>${r}</li>`;
                });
                remediationHtml += '</ul></div>';
            }
            if (analysis.remediation.longTerm && analysis.remediation.longTerm.length > 0) {
                remediationHtml += '<div class="remediation-long"><strong>🔧 長期預防：</strong><ul>';
                analysis.remediation.longTerm.forEach(r => {
                    remediationHtml += `<li>${r}</li>`;
                });
                remediationHtml += '</ul></div>';
            }
            this.remediationContent.innerHTML = remediationHtml;
        }

        this.deepAnalysisSection.style.display = 'block';
    }

    formatDiagnosisText(text) {
        // 將 markdown 格式轉換為 HTML
        return text
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/^/, '<p>')
            .replace(/$/, '</p>');
    }

    // ==================== 告警功能 ====================

    async submitAlert() {
        const description = this.alertInput.value.trim();
        if (!description) return;

        this.showLoading(this.alertLoading);
        this.hideError(this.alertError);
        this.alertResult.classList.remove('show');

        try {
            const severity = this.severitySelect.value || undefined;

            const response = await fetch(`${this.backendUrl}/api/alerts/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ description, severity }),
            });

            const data = await response.json();

            if (data.success) {
                this.alertName.textContent = data.rule.alert;

                const sev = data.rule.labels?.severity || 'info';
                this.alertSeverityBadge.textContent = sev;
                this.alertSeverityBadge.className = `alert-severity-badge severity-${sev}`;

                this.alertExpr.textContent = data.rule.expr;
                this.alertExplanation.textContent = data.rule.explanation;

                this.yamlCode.textContent = data.yaml;
                this.currentYaml = data.yaml;

                this.alertResult.classList.add('show');
            } else {
                this.showError(this.alertError, data.error || '生成失敗');
            }
        } catch (error) {
            this.showError(this.alertError, `無法連線到後端服務`);
        } finally {
            this.hideLoading(this.alertLoading);
        }
    }

    // ==================== 模板功能 ====================

    async loadTemplates(category) {
        try {
            let url = `${this.backendUrl}/api/templates`;
            if (category) {
                url += `?category=${category}`;
            }

            const response = await fetch(url);
            const data = await response.json();

            if (data.success) {
                this.renderTemplates(data.templates);
            }
        } catch (error) {
            this.templateList.innerHTML = '<div class="error show">無法載入模板</div>';
        }
    }

    renderTemplates(templates) {
        if (templates.length === 0) {
            this.templateList.innerHTML = '<p style="text-align:center;color:#666;padding:30px;">沒有符合的模板</p>';
            return;
        }

        this.templateList.innerHTML = templates.map(t => `
            <div class="template-item" data-promql="${this.escapeHtml(t.promql)}">
                <div class="template-header">
                    <span class="template-name">${t.name}</span>
                    <span class="template-category">${t.category}</span>
                </div>
                <div class="template-desc">${t.description}</div>
                <code class="template-promql">${this.escapeHtml(t.promql)}</code>
            </div>
        `).join('');

        // 綁定點擊事件
        this.templateList.querySelectorAll('.template-item').forEach(item => {
            item.addEventListener('click', () => this.useTemplate(item.dataset.promql));
        });
    }

    useTemplate(promql) {
        this.currentPromQL = promql;
        this.switchMode('query');
        this.promqlCode.textContent = promql;
        this.explanationText.textContent = '從模板載入的查詢';
        this.insightsSection.style.display = 'none';
        this.queryResult.classList.add('show');
    }

    // ==================== 工具函數 ====================

    showLoading(el) {
        if (el) el.classList.add('show');
    }

    hideLoading(el) {
        if (el) el.classList.remove('show');
    }

    showError(el, message) {
        if (el) {
            el.textContent = message;
            el.classList.add('show');
        }
    }

    hideError(el) {
        if (el) el.classList.remove('show');
    }

    async copyToClipboard(text, btn) {
        try {
            await navigator.clipboard.writeText(text);
            const originalText = btn.textContent;
            btn.textContent = '✓ 已複製';
            setTimeout(() => {
                btn.textContent = originalText;
            }, 1500);
        } catch (error) {
            console.error('複製失敗:', error);
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ==================== Elasticsearch 日誌功能 ====================

    /**
     * 初始化日誌模式的元素快取（在 cacheElements 中調用）
     */
    cacheLogsElements() {
        // Logs Mode
        this.logsInput = document.querySelector('.logs-input');
        this.logsIndex = document.querySelector('.logs-index');
        this.logsQueryLanguage = document.querySelector('.logs-query-language');
        this.logsTimeRange = document.querySelector('.logs-time-range');
        this.submitLogsQueryBtn = document.querySelector('.submit-logs-query');
        this.submitLogsDiagnosisBtn = document.querySelector('.submit-logs-diagnosis');
        this.logsLoading = document.querySelector('.logs-loading');
        this.logsLoadingText = document.querySelector('.logs-loading-text');
        this.logsError = document.querySelector('.logs-error');
        this.logsResult = document.querySelector('.logs-result');
        this.generatedQuerySection = document.querySelector('.generated-query-section');
        this.generatedQueryCode = document.querySelector('.generated-query-code');
        this.queryLanguageBadge = document.querySelector('.query-language-badge');
        this.copyQueryBtn = document.querySelector('.copy-query');
        this.executeQueryBtn = document.querySelector('.execute-query');
        this.logsSearchResults = document.querySelector('.logs-search-results');
        this.logsCount = document.querySelector('.logs-count');
        this.logsList = document.querySelector('.logs-list');
        this.logsDiagnosisSection = document.querySelector('.logs-diagnosis-section');
        this.logsDiagnosisContent = document.querySelector('.logs-diagnosis-content');
        this.possibleCausesSection = document.querySelector('.possible-causes-section');
        this.possibleCausesList = document.querySelector('.possible-causes-list');
        this.remediationSection2 = document.querySelector('.logs-diagnosis-section .remediation-section');
        this.remediationContent2 = document.querySelector('.logs-diagnosis-section .remediation-content');
    }

    /**
     * 綁定日誌模式的事件（在 bindEvents 中調用）
     */
    bindLogsEvents() {
        // 日誌查詢送出
        if (this.submitLogsQueryBtn) {
            this.submitLogsQueryBtn.addEventListener('click', () => this.submitLogsQuery());
        }
        // 日誌診斷送出
        if (this.submitLogsDiagnosisBtn) {
            this.submitLogsDiagnosisBtn.addEventListener('click', () => this.submitLogsDiagnosis());
        }
        // Enter 鍵提交
        if (this.logsInput) {
            this.logsInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.submitLogsQuery();
                }
            });
        }
        // 複製查詢
        if (this.copyQueryBtn) {
            this.copyQueryBtn.addEventListener('click', () => {
                const queryText = this.generatedQueryCode.textContent;
                this.copyToClipboard(queryText, this.copyQueryBtn);
            });
        }
        // 執行查詢
        if (this.executeQueryBtn) {
            this.executeQueryBtn.addEventListener('click', () => this.executeGeneratedQuery());
        }
    }

    /**
     * 載入 Elasticsearch 索引列表
     */
    async loadElasticsearchIndices() {
        try {
            const response = await fetch(`${this.backendUrl}/api/elasticsearch/indices`);
            const data = await response.json();

            if (data.success && data.indices) {
                this.logsIndex.innerHTML = data.indices.map(index =>
                    `<option value="${index}">${index}</option>`
                ).join('');

                if (data.indices.length > 0) {
                    this.logsIndex.value = data.indices[0];
                }
            } else {
                this.logsIndex.innerHTML = '<option value="">無可用索引</option>';
            }
        } catch (error) {
            console.error('載入索引列表失敗:', error);
            this.logsIndex.innerHTML = '<option value="">載入失敗</option>';
        }
    }

    /**
     * 提交日誌查詢
     */
    async submitLogsQuery() {
        const query = this.logsInput.value.trim();
        const queryLanguage = this.logsQueryLanguage.value;
        const index = this.logsIndex.value;

        if (!query) {
            return;
        }

        if (!index) {
            this.showError(this.logsError, '請選擇索引');
            return;
        }

        this.logsLoadingText.textContent = 'AI 正在生成查詢...';
        this.showLoading(this.logsLoading);
        this.hideError(this.logsError);
        this.generatedQuerySection.style.display = 'none';
        this.logsSearchResults.style.display = 'none';
        this.logsDiagnosisSection.style.display = 'none';

        try {
            let result;

            if (queryLanguage === 'nl') {
                // 自然語言轉查詢
                const response = await fetch(`${this.backendUrl}/api/elasticsearch/nl2query`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        query,
                        format: 'kql', // 預設生成 KQL
                        index,
                        execute: false // 先不執行，讓用戶確認
                    }),
                });

                result = await response.json();

                if (result.success) {
                    // 顯示生成的查詢
                    this.displayGeneratedQuery(result);
                    this.currentGeneratedQuery = result.query;
                    this.currentQueryLanguage = result.queryLanguage;
                } else {
                    this.showError(this.logsError, result.error || '查詢生成失敗');
                }
            } else {
                // 直接執行 KQL 或 Query DSL
                this.currentGeneratedQuery = query;
                this.currentQueryLanguage = queryLanguage;
                await this.executeGeneratedQuery();
            }
        } catch (error) {
            this.showError(this.logsError, `無法連線到後端服務`);
        } finally {
            this.hideLoading(this.logsLoading);
        }
    }

    /**
     * 顯示生成的查詢語法
     */
    displayGeneratedQuery(result) {
        const languageName = result.queryLanguage === 'kql' ? 'KQL' : 'Query DSL';
        this.queryLanguageBadge.textContent = languageName;
        this.queryLanguageBadge.className = `query-language-badge ${result.queryLanguage}`;

        if (typeof result.query === 'object') {
            this.generatedQueryCode.textContent = JSON.stringify(result.query, null, 2);
        } else {
            this.generatedQueryCode.textContent = result.query;
        }

        this.generatedQuerySection.style.display = 'block';
    }

    /**
     * 執行生成的查詢
     */
    async executeGeneratedQuery() {
        const index = this.logsIndex.value;

        if (!index || !this.currentGeneratedQuery) {
            return;
        }

        this.logsLoadingText.textContent = '正在搜尋日誌...';
        this.showLoading(this.logsLoading);
        this.hideError(this.logsError);
        this.logsSearchResults.style.display = 'none';

        try {
            const requestBody = {
                index,
                size: 50
            };

            if (this.currentQueryLanguage === 'kql') {
                requestBody.kql = this.currentGeneratedQuery;
            } else {
                requestBody.queryDSL = this.currentGeneratedQuery;
            }

            const response = await fetch(`${this.backendUrl}/api/elasticsearch/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
            });

            const result = await response.json();

            if (result.success) {
                this.displayLogsResults(result);
            } else {
                this.showError(this.logsError, result.error || '查詢執行失敗');
            }
        } catch (error) {
            this.showError(this.logsError, `查詢執行失敗`);
        } finally {
            this.hideLoading(this.logsLoading);
        }
    }

    /**
     * 顯示日誌搜尋結果
     */
    displayLogsResults(result) {
        this.logsCount.textContent = `(共 ${result.total} 筆)`;

        if (result.hits && result.hits.length > 0) {
            this.logsList.innerHTML = result.hits.map((hit, index) => `
                <div class="log-item">
                    <div class="log-header">
                        <span class="log-index">#${index + 1}</span>
                        <span class="log-id">${hit.id}</span>
                        <span class="log-score">score: ${hit.score?.toFixed(2) || 'N/A'}</span>
                    </div>
                    <pre class="log-content">${this.escapeHtml(JSON.stringify(hit.source, null, 2))}</pre>
                </div>
            `).join('');
        } else {
            this.logsList.innerHTML = '<div class="no-logs">未找到符合條件的日誌</div>';
        }

        this.logsSearchResults.style.display = 'block';
    }

    /**
     * 提交日誌診斷
     */
    async submitLogsDiagnosis() {
        const query = this.logsInput.value.trim();
        const queryLanguage = this.logsQueryLanguage.value;
        const index = this.logsIndex.value;

        if (!query) {
            return;
        }

        if (!index) {
            this.showError(this.logsError, '請選擇索引');
            return;
        }

        this.logsLoadingText.textContent = 'AI 正在診斷日誌...';
        this.showLoading(this.logsLoading);
        this.hideError(this.logsError);
        this.generatedQuerySection.style.display = 'none';
        this.logsSearchResults.style.display = 'none';
        this.logsDiagnosisSection.style.display = 'none';

        try {
            let requestBody;

            if (queryLanguage === 'nl' || queryLanguage === 'kql') {
                // 使用 KQL 查詢日誌並診斷
                requestBody = {
                    index,
                    kql: queryLanguage === 'nl' ? query : query,
                };
            } else {
                // 直接診斷輸入的內容
                requestBody = {
                    logContent: query,
                };
            }

            const response = await fetch(`${this.backendUrl}/api/elasticsearch/diagnose`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                // 嘗試讀取錯誤訊息
                try {
                    const data = await response.json();
                    throw new Error(data.error || '日誌診斷失敗');
                } catch (e) {
                    throw new Error(`HTTP Error: ${response.status}`);
                }
            }

            // 處理 SSE 串流
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullContent = '';

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    const lines = chunk.split('\n');

                    for (const line of lines) {
                        if (line.trim().startsWith('data: ')) {
                            const dataContent = line.trim().slice(6);

                            if (dataContent === '[DONE]') continue;

                            try {
                                const parsed = JSON.parse(dataContent);

                                if (parsed.error) throw new Error(parsed.error);

                                // 累積 JSON 字串片段
                                if (typeof parsed === 'string') {
                                    fullContent += parsed;
                                    // 更新載入文字以顯示進度
                                    this.logsLoadingText.textContent = `AI 正在診斷... (已接收 ${fullContent.length} 字元)`;
                                } else if (typeof parsed === 'object') {
                                    // 這不應該發生，除非後端直接發送了物件而不是字串片段
                                    // 如果發生了，假設它是完整的結果 (fallback)
                                    fullContent = JSON.stringify(parsed);
                                }
                            } catch (e) {
                                console.warn('解析 SSE 區塊失敗:', e);
                            }
                        }
                    }
                }
            } catch (streamError) {
                console.error('串流讀取錯誤:', streamError);
                throw new Error('讀取診斷結果時發生中斷');
            }

            // 解析完整的 JSON 結果
            try {
                // 有時候 fullContent 可能包含一些轉義字元問題，嘗試修正
                const diagnosis = JSON.parse(fullContent);
                this.displayLogsDiagnosisResult(diagnosis);
            } catch (e) {
                console.error('JSON 解析失敗:', e, fullContent);
                throw new Error('無法解析診斷結果，格式可能錯誤');
            }

        } catch (error) {
            this.showError(this.logsError, error.message || `日誌診斷失敗`);
        } finally {
            this.hideLoading(this.logsLoading);
        }
    }

    /**
     * 顯示日誌診斷結果
     */
    displayLogsDiagnosisResult(diagnosis) {
        // 顯示摘要
        const summaryHtml = `
            <div class="diagnosis-summary">
                <div class="severity-badge ${diagnosis.severity}">${diagnosis.severity}</div>
                <h3>${diagnosis.errorType}</h3>
                <p>${diagnosis.summary}</p>
            </div>
        `;
        this.logsDiagnosisContent.innerHTML = summaryHtml;

        // 顯示可能原因
        if (diagnosis.possibleCauses && diagnosis.possibleCauses.length > 0) {
            this.possibleCausesList.innerHTML = diagnosis.possibleCauses.map(cause => `
                <div class="cause-item">
                    <div class="cause-header">
                        <strong>${cause.cause}</strong>
                        <span class="probability-badge ${cause.probability}">${cause.probability}</span>
                    </div>
                    <p class="cause-explanation">${cause.explanation}</p>
                </div>
            `).join('');
            this.possibleCausesSection.style.display = 'block';
        }

        // 顯示修復建議
        if (diagnosis.remediation) {
            let remediationHtml = '';

            if (diagnosis.remediation.immediate && diagnosis.remediation.immediate.length > 0) {
                remediationHtml += '<div class="remediation-immediate"><strong>🚨 立即執行：</strong><ul>';
                diagnosis.remediation.immediate.forEach(r => {
                    remediationHtml += `<li>${r.action}`;
                    if (r.command) remediationHtml += `<br><code>${r.command}</code>`;
                    remediationHtml += `</li>`;
                });
                remediationHtml += '</ul></div>';
            }

            if (diagnosis.remediation.shortTerm && diagnosis.remediation.shortTerm.length > 0) {
                remediationHtml += '<div class="remediation-short"><strong>📋 短期措施：</strong><ul>';
                diagnosis.remediation.shortTerm.forEach(r => {
                    remediationHtml += `<li>${r}</li>`;
                });
                remediationHtml += '</ul></div>';
            }

            if (diagnosis.remediation.longTerm && diagnosis.remediation.longTerm.length > 0) {
                remediationHtml += '<div class="remediation-long"><strong>🔧 長期預防：</strong><ul>';
                diagnosis.remediation.longTerm.forEach(r => {
                    remediationHtml += `<li>${r}</li>`;
                });
                remediationHtml += '</ul></div>';
            }

            this.remediationContent2.innerHTML = remediationHtml;
            this.remediationSection2.style.display = 'block';
        }

        this.logsDiagnosisSection.style.display = 'block';
    }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    window.promAI = new PromAIAssistant();
});

