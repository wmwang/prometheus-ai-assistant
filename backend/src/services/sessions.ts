/**
 * Session 管理服務
 * 維護對話歷史，支援多 session 並行
 */

export interface ConversationMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
}

export interface Session {
    id: string;
    messages: ConversationMessage[];
    createdAt: number;
    lastActiveAt: number;
}

// 記憶體中的 session 儲存
const sessions = new Map<string, Session>();

// 每個 session 最多保留的訊息數量
const MAX_MESSAGES_PER_SESSION = 20;

// Session 過期時間 (1 小時)
const SESSION_EXPIRY_MS = 60 * 60 * 1000;

/**
 * 取得或建立 session
 */
export function getOrCreateSession(sessionId: string): Session {
    let session = sessions.get(sessionId);

    if (!session) {
        session = {
            id: sessionId,
            messages: [],
            createdAt: Date.now(),
            lastActiveAt: Date.now(),
        };
        sessions.set(sessionId, session);
    }

    session.lastActiveAt = Date.now();
    return session;
}

/**
 * 新增訊息到 session
 */
export function addMessage(
    sessionId: string,
    role: 'user' | 'assistant',
    content: string
): void {
    const session = getOrCreateSession(sessionId);

    session.messages.push({
        role,
        content,
        timestamp: Date.now(),
    });

    // 限制訊息數量
    if (session.messages.length > MAX_MESSAGES_PER_SESSION) {
        session.messages = session.messages.slice(-MAX_MESSAGES_PER_SESSION);
    }
}

/**
 * 取得 session 的對話歷史
 */
export function getHistory(sessionId: string): ConversationMessage[] {
    const session = sessions.get(sessionId);
    return session?.messages || [];
}

/**
 * 清除 session 的對話歷史
 */
export function clearHistory(sessionId: string): void {
    const session = sessions.get(sessionId);
    if (session) {
        session.messages = [];
    }
}

/**
 * 刪除 session
 */
export function deleteSession(sessionId: string): void {
    sessions.delete(sessionId);
}

/**
 * 清理過期的 sessions
 */
export function cleanupExpiredSessions(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [id, session] of sessions.entries()) {
        if (now - session.lastActiveAt > SESSION_EXPIRY_MS) {
            sessions.delete(id);
            cleaned++;
        }
    }

    return cleaned;
}

/**
 * 取得所有 session 統計
 */
export function getStats(): { totalSessions: number; totalMessages: number } {
    let totalMessages = 0;
    for (const session of sessions.values()) {
        totalMessages += session.messages.length;
    }

    return {
        totalSessions: sessions.size,
        totalMessages,
    };
}

// 每 10 分鐘清理一次過期 sessions
setInterval(cleanupExpiredSessions, 10 * 60 * 1000);
