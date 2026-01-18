// 預設設定
const DEFAULT_BACKEND_URL = 'http://localhost:3001';

// DOM 元素
const backendUrlInput = document.getElementById('backend-url');
const saveBtn = document.getElementById('save-btn');
const backendStatus = document.getElementById('backend-status');
const prometheusStatus = document.getElementById('prometheus-status');
const openaiStatus = document.getElementById('openai-status');

// 載入儲存的設定
async function loadSettings() {
    const result = await chrome.storage.local.get(['backendUrl']);
    const backendUrl = result.backendUrl || DEFAULT_BACKEND_URL;
    backendUrlInput.value = backendUrl;
    checkStatus(backendUrl);
}

// 儲存設定
async function saveSettings() {
    const backendUrl = backendUrlInput.value.trim() || DEFAULT_BACKEND_URL;

    await chrome.storage.local.set({ backendUrl });

    // 通知 content script 更新設定
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, {
            type: 'SETTINGS_UPDATED',
            backendUrl
        }).catch(() => {
            // 如果頁面沒有 content script，忽略錯誤
        });
    }

    // 重新檢查狀態
    checkStatus(backendUrl);

    // 顯示儲存成功
    saveBtn.textContent = '✓ 已儲存';
    setTimeout(() => {
        saveBtn.textContent = '儲存設定';
    }, 1500);
}

// 檢查連線狀態
async function checkStatus(backendUrl) {
    try {
        const response = await fetch(`${backendUrl}/health`);
        const data = await response.json();

        if (data.status === 'ok') {
            backendStatus.textContent = '已連線';
            backendStatus.className = 'status-badge connected';

            // Prometheus 狀態
            if (data.services?.prometheus === 'connected') {
                prometheusStatus.textContent = '已連線';
                prometheusStatus.className = 'status-badge connected';
            } else {
                prometheusStatus.textContent = '未連線';
                prometheusStatus.className = 'status-badge disconnected';
            }

            // OpenAI 狀態
            if (data.services?.openai === 'configured') {
                openaiStatus.textContent = '已設定';
                openaiStatus.className = 'status-badge configured';
            } else {
                openaiStatus.textContent = '未設定';
                openaiStatus.className = 'status-badge disconnected';
            }
        }
    } catch (error) {
        backendStatus.textContent = '未連線';
        backendStatus.className = 'status-badge disconnected';
        prometheusStatus.textContent = '未知';
        prometheusStatus.className = 'status-badge disconnected';
        openaiStatus.textContent = '未知';
        openaiStatus.className = 'status-badge disconnected';
    }
}

// 事件監聽
saveBtn.addEventListener('click', saveSettings);

// 按 Enter 儲存
backendUrlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        saveSettings();
    }
});

// 初始化
loadSettings();
