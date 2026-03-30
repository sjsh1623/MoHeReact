import { useState, useCallback, useEffect } from 'react';
import { searchChatService } from '@/services/apiService';

const STORAGE_KEY = 'mohe_conversation_history';

function getSessionId() {
  let id = localStorage.getItem('mohe_session_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('mohe_session_id', id);
  }
  return id;
}

// localStorage fallback for offline/error
function loadLocalHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalHistory(history) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, 20)));
  } catch {}
}

export function useConversationHistory() {
  const [history, setHistory] = useState(() => loadLocalHistory());
  const [dbLoaded, setDbLoaded] = useState(false);

  // DB에서 대화 목록 로드
  useEffect(() => {
    const loadFromDb = async () => {
      try {
        const sessionId = getSessionId();
        const response = await searchChatService.getConversations(sessionId);
        if (response.success && response.data) {
          const dbHistory = response.data.map(conv => ({
            id: conv.id,
            query: conv.title,
            timestamp: conv.updatedAt,
            messageCount: conv.messageCount,
            placeCount: conv.placeCount || 0,
            fromDb: true
          }));
          if (dbHistory.length > 0) {
            setHistory(dbHistory);
            setDbLoaded(true);
          }
        }
      } catch {
        // DB 실패 시 localStorage fallback 유지
      }
    };
    loadFromDb();
  }, []);

  const addConversation = useCallback(({ query, aiMessage, resultPreviews }) => {
    if (!query) return;
    setHistory(prev => {
      const filtered = prev.filter(e => e.query !== query);
      const newEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        query,
        aiMessage,
        resultPreviews: (resultPreviews || []).slice(0, 3),
        timestamp: new Date().toISOString(),
      };
      const next = [newEntry, ...filtered].slice(0, 20);
      saveLocalHistory(next);
      return next;
    });
  }, []);

  const removeEntry = useCallback(async (id) => {
    // DB에서 삭제 시도
    if (typeof id === 'number') {
      try {
        await searchChatService.deleteConversation(id);
      } catch {}
    }
    setHistory(prev => {
      const next = prev.filter(e => e.id !== id);
      saveLocalHistory(next);
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    saveLocalHistory([]);
  }, []);

  return { history, addConversation, removeEntry, clearHistory };
}
