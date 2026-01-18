/**
 * Prometheus AI Assistant Widget
 * 可拖曳的浮動 AI 助手視窗
 */

class PromAIWidget {
    constructor() {
        this.container = null;
        this.panel = null;
        this.isOpen = false;
        this.backendUrl = 'http://localhost:3001';
        this.currentPromQL = '';

        // 對話歷史支援
        this.sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.conversationHistory = [];

        this.init();
    }

    async init() {
        // 從 storage 載入設定
        await this.loadSettings();

        // 建立 Widget DOM
        this.createWidget();

        // 綁定事件
        this.bindEvents();
    }

    async loadSettings() {
        try {
            const result = await chrome.storage.local.get(['backendUrl']);
            if (result.backendUrl) {
                this.backendUrl = result.backendUrl;
            }
        } catch (e) {
            console.log('使用預設後端位址');
        }
    }

    createWidget() {
        // 建立容器
        this.container = document.createElement('div');
        this.container.id = 'prom-ai-assistant-widget';

        this.container.innerHTML = `
      <button class="prom-ai-trigger" title="開啟 AI 助手">
        🤖
      </button>
      
      <div class="prom-ai-panel">
        <div class="prom-ai-header">
          <h3>🤖 AI 助手</h3>
          <button class="prom-ai-close">×</button>
        </div>
        
        <!-- 模式切換 Tab -->
        <div class="prom-ai-tabs">
          <button class="prom-ai-tab active" data-mode="query">📊 查詢</button>
          <button class="prom-ai-tab" data-mode="alert">🔔 告警</button>
          <button class="prom-ai-tab" data-mode="template">📋 模板</button>
        </div>
        
        <div class="prom-ai-content">
          <!-- 查詢模式內容 -->
          <div class="prom-ai-mode-content prom-ai-query-mode active">
            <!-- 對話歷史區域 -->
            <div class="prom-ai-history" style="display: none;">
              <div class="prom-ai-history-header">
                <span class="prom-ai-history-label">💬 對話歷史</span>
                <button class="prom-ai-btn prom-ai-btn-small prom-ai-clear-history">🗑️ 清除</button>
              </div>
              <div class="prom-ai-history-list"></div>
            </div>
            
            <div class="prom-ai-input-section">
              <div class="prom-ai-input-wrapper">
                <textarea 
                  class="prom-ai-input" 
                  placeholder="用自然語言描述你想查詢的內容...&#10;例如：過去1小時哪些服務的錯誤率超過1%&#10;💡 支援上下文對話：可以說「那記憶體呢？」"
                  rows="2"
                ></textarea>
                <button class="prom-ai-submit" title="送出查詢">→</button>
              </div>
            </div>
            
            <div class="prom-ai-loading">
              <div class="prom-ai-spinner"></div>
            </div>
            
            <div class="prom-ai-error"></div>
            
            <div class="prom-ai-result">
              <div class="prom-ai-promql-card">
                <div class="prom-ai-promql-label">生成的 PromQL</div>
                <div class="prom-ai-promql-code"></div>
                <div class="prom-ai-promql-actions">
                  <button class="prom-ai-btn prom-ai-btn-primary prom-ai-execute">▶ 執行查詢</button>
                  <button class="prom-ai-btn prom-ai-btn-secondary prom-ai-copy">📋 複製</button>
                  <button class="prom-ai-btn prom-ai-btn-secondary prom-ai-analyze">💡 分析見解</button>
                </div>
              </div>
              
              <div class="prom-ai-explanation">
                <div class="prom-ai-explanation-label">說明</div>
                <div class="prom-ai-explanation-text"></div>
              </div>
              
              <div class="prom-ai-insights" style="display: none;">
                <div class="prom-ai-insights-label">見解分析</div>
                <div class="prom-ai-insights-list"></div>
              </div>
              
              <div class="prom-ai-next-steps" style="display: none;">
                <div class="prom-ai-next-steps-label">💡 建議下一步</div>
                <div class="prom-ai-next-steps-list"></div>
              </div>
            </div>
          </div>
          
          <!-- 告警模式內容 -->
          <div class="prom-ai-mode-content prom-ai-alert-mode">
            <div class="prom-ai-input-section">
              <div class="prom-ai-input-wrapper">
                <textarea 
                  class="prom-ai-alert-input" 
                  placeholder="描述你想建立的告警規則...&#10;例如：當 CPU 使用率超過 80% 持續 5 分鐘時發出警告"
                  rows="2"
                ></textarea>
                <button class="prom-ai-alert-submit" title="生成告警規則">→</button>
              </div>
            </div>
            
            <div class="prom-ai-severity-select">
              <label>嚴重等級：</label>
              <select class="prom-ai-severity">
                <option value="">自動判斷</option>
                <option value="info">ℹ️ Info</option>
                <option value="warning">⚠️ Warning</option>
                <option value="critical">🚨 Critical</option>
              </select>
            </div>
            
            <div class="prom-ai-loading prom-ai-alert-loading">
              <div class="prom-ai-spinner"></div>
            </div>
            
            <div class="prom-ai-error prom-ai-alert-error"></div>
            
            <div class="prom-ai-alert-result">
              <div class="prom-ai-alert-card">
                <div class="prom-ai-alert-info">
                  <span class="prom-ai-alert-name"></span>
                  <span class="prom-ai-alert-severity-badge"></span>
                </div>
                <div class="prom-ai-alert-expr"></div>
                <div class="prom-ai-alert-explanation"></div>
              </div>
              
              <div class="prom-ai-yaml-section">
                <div class="prom-ai-yaml-label">YAML 告警規則</div>
                <pre class="prom-ai-yaml-code"></pre>
                <button class="prom-ai-btn prom-ai-btn-primary prom-ai-copy-yaml">📋 複製 YAML</button>
              </div>
            </div>
          </div>
          
          <!-- 模板模式內容 -->
          <div class="prom-ai-mode-content prom-ai-template-mode">
            <div class="prom-ai-template-categories">
              <button class="prom-ai-category-btn active" data-category="">全部</button>
              <button class="prom-ai-category-btn" data-category="cpu">CPU</button>
              <button class="prom-ai-category-btn" data-category="memory">記憶體</button>
              <button class="prom-ai-category-btn" data-category="http">HTTP</button>
              <button class="prom-ai-category-btn" data-category="kubernetes">K8s</button>
              <button class="prom-ai-category-btn" data-category="disk">磁碟</button>
            </div>
            <div class="prom-ai-template-list"></div>
          </div>
        </div>
      </div>
    `;

        document.body.appendChild(this.container);

        // 快取 DOM 元素
        this.panel = this.container.querySelector('.prom-ai-panel');
        this.trigger = this.container.querySelector('.prom-ai-trigger');
        this.closeBtn = this.container.querySelector('.prom-ai-close');
        this.input = this.container.querySelector('.prom-ai-input');
        this.submitBtn = this.container.querySelector('.prom-ai-submit');
        this.loading = this.container.querySelector('.prom-ai-loading');
        this.error = this.container.querySelector('.prom-ai-error');
        this.result = this.container.querySelector('.prom-ai-result');
        this.promqlCode = this.container.querySelector('.prom-ai-promql-code');
        this.explanationText = this.container.querySelector('.prom-ai-explanation-text');
        this.insightsSection = this.container.querySelector('.prom-ai-insights');
        this.insightsList = this.container.querySelector('.prom-ai-insights-list');
        this.nextStepsSection = this.container.querySelector('.prom-ai-next-steps');
        this.nextStepsList = this.container.querySelector('.prom-ai-next-steps-list');

        // 對話歷史相關元素
        this.historySection = this.container.querySelector('.prom-ai-history');
        this.historyList = this.container.querySelector('.prom-ai-history-list');

        // 告警相關元素
        this.alertInput = this.container.querySelector('.prom-ai-alert-input');
        this.alertSubmitBtn = this.container.querySelector('.prom-ai-alert-submit');
        this.alertLoading = this.container.querySelector('.prom-ai-alert-loading');
        this.alertError = this.container.querySelector('.prom-ai-alert-error');
        this.alertResult = this.container.querySelector('.prom-ai-alert-result');
        this.severitySelect = this.container.querySelector('.prom-ai-severity');
        this.yamlCode = this.container.querySelector('.prom-ai-yaml-code');

        // 模板相關元素
        this.templateList = this.container.querySelector('.prom-ai-template-list');

        // 當前模式
        this.currentMode = 'query';
    }

    bindEvents() {
        // 開關面板
        this.trigger.addEventListener('click', () => this.togglePanel());
        this.closeBtn.addEventListener('click', () => this.closePanel());

        // 送出查詢
        this.submitBtn.addEventListener('click', () => this.submitQuery());

        // Enter 送出 (Shift+Enter 換行)
        this.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.submitQuery();
            }
        });

        // 執行查詢按鈕
        this.container.querySelector('.prom-ai-execute').addEventListener('click', () => {
            this.executePromQL(this.currentPromQL);
        });

        // 複製按鈕
        this.container.querySelector('.prom-ai-copy').addEventListener('click', () => {
            this.copyToClipboard(this.currentPromQL);
        });

        // 分析見解按鈕
        this.container.querySelector('.prom-ai-analyze').addEventListener('click', () => {
            this.analyzeInsights(this.currentPromQL);
        });

        // 清除對話歷史按鈕
        this.container.querySelector('.prom-ai-clear-history').addEventListener('click', () => {
            this.clearHistory();
        });

        // 模式切換 Tab
        this.container.querySelectorAll('.prom-ai-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchMode(e.target.dataset.mode);
            });
        });

        // 告警送出
        this.alertSubmitBtn.addEventListener('click', () => this.submitAlertRule());
        this.alertInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.submitAlertRule();
            }
        });

        // 複製 YAML
        this.container.querySelector('.prom-ai-copy-yaml').addEventListener('click', () => {
            this.copyToClipboard(this.currentYaml);
        });

        // 模板分類
        this.container.querySelectorAll('.prom-ai-category-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.container.querySelectorAll('.prom-ai-category-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.loadTemplates(e.target.dataset.category);
            });
        });

        // 監聽設定更新
        chrome.runtime.onMessage.addListener((message) => {
            if (message.type === 'SETTINGS_UPDATED') {
                this.backendUrl = message.backendUrl;
            }
        });
    }

    /**
     * 切換模式
     */
    switchMode(mode) {
        this.currentMode = mode;

        // 更新 Tab 樣式
        this.container.querySelectorAll('.prom-ai-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.mode === mode);
        });

        // 更新內容顯示
        this.container.querySelectorAll('.prom-ai-mode-content').forEach(content => {
            content.classList.remove('active');
        });

        if (mode === 'query') {
            this.container.querySelector('.prom-ai-query-mode').classList.add('active');
        } else if (mode === 'alert') {
            this.container.querySelector('.prom-ai-alert-mode').classList.add('active');
        } else if (mode === 'template') {
            this.container.querySelector('.prom-ai-template-mode').classList.add('active');
            this.loadTemplates('');
        }
    }

    togglePanel() {
        if (this.isOpen) {
            this.closePanel();
        } else {
            this.openPanel();
        }
    }

    openPanel() {
        this.isOpen = true;
        this.panel.classList.add('open');
        this.trigger.classList.add('active');
        this.input.focus();
    }

    closePanel() {
        this.isOpen = false;
        this.panel.classList.remove('open');
        this.trigger.classList.remove('active');
    }

    showLoading() {
        this.loading.classList.add('show');
        this.result.classList.remove('show');
        this.error.classList.remove('show');
        this.submitBtn.disabled = true;
    }

    hideLoading() {
        this.loading.classList.remove('show');
        this.submitBtn.disabled = false;
    }

    showError(message) {
        this.error.textContent = message;
        this.error.classList.add('show');
    }

    hideError() {
        this.error.classList.remove('show');
    }

    async submitQuery() {
        const query = this.input.value.trim();
        if (!query) return;

        this.showLoading();
        this.hideError();

        try {
            // 使用帶對話歷史的 API
            const response = await fetch(`${this.backendUrl}/api/promql/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query,
                    sessionId: this.sessionId
                }),
            });

            const data = await response.json();

            if (data.success) {
                this.currentPromQL = data.promql;
                this.promqlCode.textContent = data.promql;
                this.explanationText.textContent = data.explanation;

                // 更新對話歷史
                this.conversationHistory.push({ role: 'user', content: query });
                this.conversationHistory.push({
                    role: 'assistant',
                    content: data.promql,
                    explanation: data.explanation
                });
                this.renderHistory();

                // 清空輸入框
                this.input.value = '';

                // 隱藏見解區塊（需要手動觸發分析）
                this.insightsSection.style.display = 'none';
                this.nextStepsSection.style.display = 'none';

                this.result.classList.add('show');
            } else {
                this.showError(data.error || '生成失敗，請稍後再試');
            }
        } catch (error) {
            this.showError(`無法連線到後端服務: ${this.backendUrl}`);
        } finally {
            this.hideLoading();
        }
    }

    /**
     * 渲染對話歷史
     */
    renderHistory() {
        if (this.conversationHistory.length === 0) {
            this.historySection.style.display = 'none';
            return;
        }

        this.historySection.style.display = 'block';

        // 只顯示最近 6 條記錄
        const recentHistory = this.conversationHistory.slice(-6);

        this.historyList.innerHTML = recentHistory.map(msg => {
            if (msg.role === 'user') {
                return `<div class="prom-ai-history-item prom-ai-history-user">
                    <span class="prom-ai-history-icon">👤</span>
                    <span class="prom-ai-history-text">${this.escapeHtml(msg.content)}</span>
                </div>`;
            } else {
                return `<div class="prom-ai-history-item prom-ai-history-assistant">
                    <span class="prom-ai-history-icon">🤖</span>
                    <code class="prom-ai-history-code">${this.escapeHtml(msg.content)}</code>
                </div>`;
            }
        }).join('');
    }

    /**
     * 清除對話歷史
     */
    clearHistory() {
        this.conversationHistory = [];
        this.sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.historySection.style.display = 'none';
        this.historyList.innerHTML = '';

        // 通知後端清除（可選）
        fetch(`${this.backendUrl}/api/promql/history/${this.sessionId}`, {
            method: 'DELETE'
        }).catch(() => { });
    }

    /**
     * HTML 跳脫
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async analyzeInsights(promql) {
        this.showLoading();

        try {
            const response = await fetch(`${this.backendUrl}/api/insights/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query: promql }),
            });

            const data = await response.json();

            if (data.success) {
                // 顯示見解
                if (data.insights && data.insights.length > 0) {
                    this.insightsList.innerHTML = data.insights.map(insight => `
            <div class="prom-ai-insight-card ${insight.severity}">
              <div class="prom-ai-insight-title">${insight.title}</div>
              <div class="prom-ai-insight-desc">${insight.description}</div>
            </div>
          `).join('');
                    this.insightsSection.style.display = 'block';
                }

                // 顯示下一步建議
                if (data.nextSteps && data.nextSteps.length > 0) {
                    this.nextStepsList.innerHTML = data.nextSteps.map(step => `
            <div class="prom-ai-next-step" data-promql="${step.promql || ''}">
              <span class="prom-ai-next-step-icon">→</span>
              <span class="prom-ai-next-step-text">${step.description}</span>
            </div>
          `).join('');

                    // 綁定點擊事件
                    this.nextStepsList.querySelectorAll('.prom-ai-next-step').forEach(el => {
                        el.addEventListener('click', () => {
                            const stepPromQL = el.dataset.promql;
                            if (stepPromQL) {
                                this.currentPromQL = stepPromQL;
                                this.promqlCode.textContent = stepPromQL;
                                this.executePromQL(stepPromQL);
                            }
                        });
                    });

                    this.nextStepsSection.style.display = 'block';
                }
            } else {
                this.showError(data.error || '分析失敗');
            }
        } catch (error) {
            this.showError('分析見解時發生錯誤');
        } finally {
            this.hideLoading();
        }
    }

    executePromQL(promql) {
        // 先複製到剪貼簿
        this.copyToClipboard(promql);

        let filled = false;

        // 方法 1: Prometheus 新版 UI (React + CodeMirror 6)
        const cmEditor = document.querySelector('.cm-editor');
        if (cmEditor) {
            const cmContent = cmEditor.querySelector('.cm-content');
            if (cmContent) {
                try {
                    cmContent.focus();

                    // 清空現有內容
                    document.execCommand('selectAll', false, null);

                    // 嘗試使用 InputEvent 模擬貼上
                    const inputEvent = new InputEvent('beforeinput', {
                        inputType: 'insertFromPaste',
                        data: promql,
                        bubbles: true,
                        cancelable: true,
                    });
                    cmContent.dispatchEvent(inputEvent);

                    // 如果 InputEvent 不行，嘗試 insertText
                    if (cmContent.textContent === '' || cmContent.textContent === '\n') {
                        document.execCommand('insertText', false, promql);
                    }

                    // 驗證是否填入成功
                    setTimeout(() => {
                        if (cmContent.textContent.includes(promql.substring(0, 10))) {
                            filled = true;
                        }
                    }, 50);

                    filled = true;
                } catch (e) {
                    console.log('CodeMirror 填入失敗，請手動貼上', e);
                }
            }
        }

        // 方法 2: 嘗試找 textarea（舊版 Prometheus UI）
        if (!filled) {
            const textarea = document.querySelector('textarea[class*="expression"]') ||
                document.querySelector('.expression-input textarea') ||
                document.querySelector('textarea');
            if (textarea) {
                textarea.focus();
                textarea.value = promql;
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
                textarea.dispatchEvent(new Event('change', { bubbles: true }));
                filled = true;
            }
        }

        // 方法 3: 嘗試 input 元素
        if (!filled) {
            const input = document.querySelector('input[name="expr"]') ||
                document.querySelector('input[placeholder*="Expression"]');
            if (input) {
                input.focus();
                input.value = promql;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                filled = true;
            }
        }

        // 延遲點擊執行按鈕
        setTimeout(() => {
            const executeBtn = Array.from(document.querySelectorAll('button')).find(btn =>
                btn.textContent.includes('Execute') ||
                btn.textContent.includes('執行') ||
                btn.textContent.includes('Run')
            ) ||
                document.querySelector('button[type="submit"]') ||
                document.querySelector('button.execute-btn');

            if (executeBtn) {
                executeBtn.click();
            }
        }, 300);

        // 顯示狀態給使用者
        const executeButton = this.container.querySelector('.prom-ai-execute');
        const originalText = executeButton.textContent;

        // 真實狀態：由於 CodeMirror 的限制，提示用戶手動貼上更可靠
        executeButton.textContent = '📋 已複製（Ctrl+V 貼上）';
        setTimeout(() => {
            executeButton.textContent = originalText;
        }, 3000);
    }

    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);

            // 顯示複製成功 - 動態找按鈕
            let copyBtn = this.container.querySelector('.prom-ai-copy');
            if (this.currentMode === 'alert') {
                copyBtn = this.container.querySelector('.prom-ai-copy-yaml');
            }
            if (copyBtn) {
                const originalText = copyBtn.textContent;
                copyBtn.textContent = '✓ 已複製';
                setTimeout(() => {
                    copyBtn.textContent = originalText;
                }, 1500);
            }
        } catch (error) {
            this.showError('複製失敗');
        }
    }

    /**
     * 送出告警規則生成請求
     */
    async submitAlertRule() {
        const description = this.alertInput.value.trim();
        if (!description) return;

        this.alertLoading.classList.add('show');
        this.alertError.classList.remove('show');
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
                // 顯示告警資訊
                this.container.querySelector('.prom-ai-alert-name').textContent = data.rule.alert;
                this.container.querySelector('.prom-ai-alert-severity-badge').textContent =
                    data.rule.labels?.severity || 'unknown';
                this.container.querySelector('.prom-ai-alert-severity-badge').className =
                    `prom-ai-alert-severity-badge severity-${data.rule.labels?.severity || 'info'}`;
                this.container.querySelector('.prom-ai-alert-expr').textContent = data.rule.expr;
                this.container.querySelector('.prom-ai-alert-explanation').textContent = data.rule.explanation;

                // 顯示 YAML
                this.yamlCode.textContent = data.yaml;
                this.currentYaml = data.yaml;

                this.alertResult.classList.add('show');
            } else {
                this.alertError.textContent = data.error || '生成失敗';
                this.alertError.classList.add('show');
            }
        } catch (error) {
            this.alertError.textContent = `無法連線到後端服務: ${this.backendUrl}`;
            this.alertError.classList.add('show');
        } finally {
            this.alertLoading.classList.remove('show');
        }
    }

    /**
     * 載入模板列表
     */
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
            this.templateList.innerHTML = '<div class="prom-ai-error">無法載入模板</div>';
        }
    }

    /**
     * 渲染模板列表
     */
    renderTemplates(templates) {
        if (templates.length === 0) {
            this.templateList.innerHTML = '<div class="prom-ai-no-templates">沒有符合的模板</div>';
            return;
        }

        this.templateList.innerHTML = templates.map(t => `
            <div class="prom-ai-template-item" data-id="${t.id}" data-promql="${this.escapeHtml(t.promql)}">
                <div class="prom-ai-template-header">
                    <span class="prom-ai-template-name">${t.name}</span>
                    <span class="prom-ai-template-category">${t.category}</span>
                </div>
                <div class="prom-ai-template-desc">${t.description}</div>
                <code class="prom-ai-template-promql">${this.escapeHtml(t.promql)}</code>
            </div>
        `).join('');

        // 綁定點擊事件
        this.templateList.querySelectorAll('.prom-ai-template-item').forEach(item => {
            item.addEventListener('click', () => {
                this.useTemplate(item.dataset.promql);
            });
        });
    }

    /**
     * 使用模板
     */
    useTemplate(promql) {
        this.currentPromQL = promql;
        this.switchMode('query');
        this.promqlCode.textContent = promql;
        this.explanationText.textContent = '從模板載入的查詢';
        this.result.classList.add('show');

        // 自動執行
        this.executePromQL(promql);
    }
}

// 匯出給 content.js 使用
window.PromAIWidget = PromAIWidget;

