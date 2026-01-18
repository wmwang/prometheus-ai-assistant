/**
 * Service Worker - 背景腳本
 * 處理跨域請求和快取管理
 */

// 安裝事件
chrome.runtime.onInstalled.addListener(() => {
    console.log('🤖 Prometheus AI Assistant 已安裝');

    // 設定預設值
    chrome.storage.local.get(['backendUrl'], (result) => {
        if (!result.backendUrl) {
            chrome.storage.local.set({
                backendUrl: 'http://localhost:3001'
            });
        }
    });
});

// 監聽來自 content script 或 popup 的訊息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'API_REQUEST') {
        handleApiRequest(message)
            .then(sendResponse)
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // 保持訊息通道開啟
    }
});

// 處理 API 請求
async function handleApiRequest(message) {
    const { endpoint, method = 'POST', body, backendUrl } = message;

    try {
        const response = await fetch(`${backendUrl}${endpoint}`, {
            method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: body ? JSON.stringify(body) : undefined,
        });

        const data = await response.json();
        return { success: true, data };
    } catch (error) {
        return { success: false, error: error.message };
    }
}
