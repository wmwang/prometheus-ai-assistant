/**
 * Content Script - 注入 Prometheus UI
 * 偵測頁面並初始化 AI Widget
 */

(function () {
    'use strict';

    // 避免重複初始化
    if (window.__promAIAssistantInitialized) {
        return;
    }
    window.__promAIAssistantInitialized = true;

    console.log('🤖 Prometheus AI Assistant: 載入中...');

    // 等待 DOM 準備就緒
    function initWidget() {
        // 檢查是否為 Prometheus 頁面
        const isPrometheusPage =
            document.title.includes('Prometheus') ||
            document.querySelector('.navbar-brand')?.textContent?.includes('Prometheus') ||
            window.location.pathname.includes('/graph') ||
            document.querySelector('[class*="prometheus"]');

        if (!isPrometheusPage) {
            console.log('🤖 Prometheus AI Assistant: 非 Prometheus 頁面，跳過載入');
            return;
        }

        // 初始化 Widget
        if (typeof window.PromAIWidget === 'function') {
            window.__promAIWidget = new window.PromAIWidget();
            console.log('🤖 Prometheus AI Assistant: 已啟動');
        } else {
            console.error('🤖 Prometheus AI Assistant: Widget 類別未載入');
        }
    }

    // 監聽來自 popup 的訊息
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'SETTINGS_UPDATED') {
            if (window.__promAIWidget) {
                window.__promAIWidget.backendUrl = message.backendUrl;
            }
            sendResponse({ success: true });
        }
        return true;
    });

    // 等待頁面載入完成
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initWidget);
    } else {
        // 延遲一點時間確保 widget.js 已載入
        setTimeout(initWidget, 100);
    }
})();
