import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import styles from '@/styles/pages/search-results-page.module.css';

import { placeService, bookmarkService, searchChatService } from '@/services/apiService';
import { authService } from '@/services/authService';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useConversationHistory } from '@/hooks/useConversationHistory';
import { buildImageUrl, normalizePlaceImages } from '@/utils/image';
import LoginRequiredSheet from '@/components/ui/modals/LoginRequiredSheet';

const CARD_DELAY = 0.45;
const MAX_CARDS = 3;
const MIN_LOADING_MS = 3000;

const WELCOME_MESSAGES = [
  '오늘은 어떤 기분인가요?',
  '어떤 곳을 찾고 계신가요?',
  '오늘 뭐 먹을지 고민이세요?',
  '어디 가고 싶으세요?',
  '기분에 맞는 장소를 찾아드릴게요!',
  '오늘 하루 어떻게 보내고 싶으세요?',
  '특별한 곳을 찾고 계신가요?',
  '맛있는 거 먹으러 갈까요?',
  '어떤 분위기를 원하세요?',
  '편하게 말씀해주세요 :)',
];

const getLoadingMessages = (query) => query
  ? [`"${query}" 살펴보는 중`, '관련 장소 찾는 중...', '딱 맞는 곳 고르는 중', '거의 다 됐어요']
  : ['주변을 살펴보는 중이에요', '딱 맞는 장소 고르는 중...', '마음에 드실 것 같아요', '거의 다 됐어요'];

let msgIdCounter = 0;
function nextMsgId() { return `msg-${Date.now()}-${++msgIdCounter}`; }

function getSessionId() {
  let id = localStorage.getItem('mohe_session_id');
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('mohe_session_id', id); }
  return id;
}

function formatHistoryDate(isoString) {
  const date = new Date(isoString);
  const diffMin = Math.floor((Date.now() - date) / 60000);
  if (diffMin < 1) return '방금';
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}일 전`;
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

// Streaming text effect
function StreamText({ text, speed = 18, startDelay = 0, onComplete }) {
  const [displayed, setDisplayed] = useState('');
  useEffect(() => {
    if (!text) return;
    setDisplayed('');
    let i = 0, interval;
    const timer = setTimeout(() => {
      interval = setInterval(() => {
        i++;
        setDisplayed(text.slice(0, i));
        if (i >= text.length) { clearInterval(interval); onComplete?.(); }
      }, speed);
    }, startDelay * 1000);
    return () => { clearTimeout(timer); clearInterval(interval); };
  }, [text, speed, startDelay, onComplete]);
  return <span style={{ whiteSpace: 'pre-line' }}>{displayed}<span className={styles.cursor}>|</span></span>;
}

// ─────────────────────────────────────────────────────────────────────────────

export default function SearchResultsPage() {
  const [searchParams] = useSearchParams();
  const locationState = useLocation().state;
  const navigate = useNavigate();

  const initialQuery = searchParams.get('q') || locationState?.query || '';
  const loginRequired = locationState?.loginRequired ?? false;

  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const hasInitialSearched = useRef(false);

  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);
  const [loadingQuery, setLoadingQuery] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showLoginSheet, setShowLoginSheet] = useState(false);

  const { location } = useGeolocation();
  const { history, addConversation, removeEntry } = useConversationHistory();

  const user = authService.getCurrentUser();
  const isGuest = !user || user.isGuest;
  const userName = user && !user.isGuest ? (user.nickname || '사용자') : null;

  const loadingMessages = getLoadingMessages(loadingQuery);

  // 랜덤 환영 메시지 (마운트 시 1회)
  const welcomeMessage = useMemo(() =>
    WELCOME_MESSAGES[Math.floor(Math.random() * WELCOME_MESSAGES.length)], []);

  const buildAiMessage = useCallback((query, results, error, searchMessage) => {
    if (error) return `${error}\n다시 검색해볼까요?`;
    if (results.length === 0) {
      return query
        ? `'${query}'에 맞는 곳을 못 찾았어요.\n다른 키워드나 분위기로 다시 찾아볼까요?`
        : '근처에 추천할 장소가 아직 없어요.\n원하는 분위기를 말해주시면 찾아드릴게요!';
    }
    const base = searchMessage || `'${query}'에 딱 맞는 곳들이에요.`;
    return `${base}\n마음에 드는 곳이 있나요?`;
  }, []);

  // Core search
  const performSearch = useCallback(async (query, preloadedResults = null) => {
    if (query) {
      setMessages(prev => [...prev, { id: nextMsgId(), role: 'user', content: query, places: [] }]);
    }
    setIsLoading(true);
    setLoadingQuery(query);
    setLoadingMsgIndex(0);

    try {
      const startTime = Date.now();
      let results = [];
      let msgText = '';
      let fetchError = null;

      if (preloadedResults) {
        results = preloadedResults.map(normalizePlaceImages);
      } else {
        // 위치: geolocation 우선, 없으면 기본 서울
        let lat = location?.latitude || 37.5665;
        let lon = location?.longitude || 126.9780;

        let response;
        if (query) {
          response = await searchChatService.searchChat(query, lat, lon, {
            limit: MAX_CARDS, sessionId: getSessionId(),
          });
        } else {
          response = await placeService.getNearbyPlaces(lat, lon, { radius: 3000, limit: MAX_CARDS });
        }

        if (response.success) {
          const data = response.data?.places || response.data || [];
          results = (Array.isArray(data) ? data : []).map(normalizePlaceImages);
          if (user && !user.isGuest && authService.isAuthenticated()) {
            results = await bookmarkService.applyBookmarkStatus(results);
          }
          msgText = response.data?.message || '';
        } else {
          fetchError = '검색 결과를 불러오는데 실패했습니다.';
        }
      }

      const elapsed = Date.now() - startTime;
      if (elapsed < MIN_LOADING_MS) await new Promise(r => setTimeout(r, MIN_LOADING_MS - elapsed));

      const aiContent = buildAiMessage(query, results, fetchError, msgText);
      setMessages(prev => [...prev, {
        id: nextMsgId(), role: 'assistant', content: aiContent,
        places: results.slice(0, MAX_CARDS), isStreaming: true,
      }]);

      if (query) {
        addConversation({
          query, aiMessage: aiContent,
          resultPreviews: results.slice(0, MAX_CARDS).map(p => ({
            id: p.id, name: p.name || p.title,
            imageUrl: p.images?.[0] || p.image || p.imageUrl || '',
          })),
        });
      }
    } catch (err) {
      console.error('Search failed:', err);
      await new Promise(r => setTimeout(r, MIN_LOADING_MS));
      setMessages(prev => [...prev, {
        id: nextMsgId(), role: 'assistant',
        content: '검색 중 오류가 발생했습니다.\n다시 시도해주세요.', places: [], isStreaming: true,
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [location, user, buildAiMessage, addConversation]);

  // Loading message cycle
  useEffect(() => {
    if (!isLoading) return;
    setLoadingMsgIndex(0);
    const interval = setInterval(() => setLoadingMsgIndex(p => (p + 1) % loadingMessages.length), 1100);
    return () => clearInterval(interval);
  }, [isLoading, loadingMessages.length]);

  // Initial search — URL 쿼리가 있으면 검색 후 URL에서 제거 (새로고침 시 깨끗)
  useEffect(() => {
    if (hasInitialSearched.current || loginRequired) return;
    hasInitialSearched.current = true;
    if (!initialQuery && !locationState?.results) return;
    performSearch(initialQuery, locationState?.results || null);
    // URL에서 쿼리 파라미터 제거 (새로고침 시 빈 화면)
    if (initialQuery) {
      window.history.replaceState(null, '', '/search-results');
    }
  }, []); // eslint-disable-line

  // Auto-scroll
  useEffect(() => {
    const t = setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 200);
    return () => clearTimeout(t);
  }, [messages.length, isLoading]);

  const handleStreamComplete = useCallback((msgId) => {
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isStreaming: false } : m));
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, []);

  const handleBookmarkToggle = async (placeId, shouldBookmark) => {
    if (isGuest) { navigate('/login', { state: { from: '/search-results' } }); return; }
    try {
      if (shouldBookmark) await bookmarkService.addBookmark(placeId);
      else await bookmarkService.removeBookmark(placeId);
      setMessages(prev => prev.map(msg => ({
        ...msg, places: msg.places.map(p => p.id === placeId ? { ...p, isBookmarked: shouldBookmark } : p),
      })));
    } catch (err) { console.error('Bookmark failed:', err); }
  };

  const handlePlaceClick = (place) => navigate(`/place/${place.id}`, { state: { preloadedData: place } });

  const handleSendMessage = () => {
    const trimmed = inputValue.trim();
    if (!trimmed || isLoading) return;
    setInputValue('');
    performSearch(trimmed);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }
  };

  const handleHistoryItemClick = (q) => {
    setShowHistory(false);
    setMessages([]);
    performSearch(q);
  };

  const lastAssistantIdx = (() => {
    for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === 'assistant') return i;
    return -1;
  })();

  const hasMessages = messages.length > 0;

  return (
    <div className={styles.pageContainer}>
      {/* Header */}
      <header className={styles.header}>
        <button className={styles.backButton} onClick={() => navigate(-1)} aria-label="뒤로 가기">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className={styles.headerSpacer} />
      </header>

      {/* History button — 왼쪽 상단 동그라미 */}
      <button
        className={styles.historyButton}
        onClick={() => isGuest ? setShowLoginSheet(true) : setShowHistory(!showHistory)}
        aria-label="대화 목록"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M12 8v4l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
        </svg>
      </button>

      {/* History panel */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            className={styles.historyPanel}
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            <div className={styles.historyHeader}>
              <span>대화 목록</span>
              <button onClick={() => setShowHistory(false)} className={styles.historyClose}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            <div className={styles.historyList}>
              {history.length === 0 ? (
                <p className={styles.historyEmpty}>아직 대화가 없어요</p>
              ) : (
                history.map(entry => (
                  <div key={entry.id} className={styles.historyItem}>
                    <button className={styles.historyItemBtn} onClick={() => handleHistoryItemClick(entry.query)}>
                      <span className={styles.historyQuery}>{entry.query}</span>
                      <span className={styles.historyDate}>{formatHistoryDate(entry.timestamp)}</span>
                    </button>
                    <button className={styles.historyDelete} onClick={() => removeEntry(entry.id)}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                        <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                      </svg>
                    </button>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat area */}
      <div className={styles.chatArea}>
        <div className={styles.spacer} />

        {/* Welcome message — 대화 없을 때 */}
        {!hasMessages && !isLoading && !loginRequired && (
          <motion.div
            className={styles.welcomeContainer}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <div className={styles.welcomeAvatar}>M</div>
            <p className={styles.welcomeText}>{welcomeMessage}</p>
          </motion.div>
        )}

        {/* Login required */}
        {loginRequired && (
          <>
            <div className={styles.userMessageRow}>
              <div className={styles.userBubble}>{locationState?.query}</div>
            </div>
            <motion.div className={styles.aiMessageRow} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
              <div className={styles.aiAvatar}>M</div>
              <div className={styles.loginBubble}>
                <p className={styles.loginBubbleText}>맞춤 추천을 위해 로그인이 필요해요.</p>
                <button className={styles.loginButton} onClick={() => navigate('/login', { state: { from: '/search-results' } })}>
                  로그인하기
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </motion.div>
          </>
        )}

        {/* Messages */}
        {messages.map((msg, idx) => {
          if (msg.role === 'user') {
            return (
              <div key={msg.id} className={styles.userMessageRow}>
                <div className={styles.userBubble}>{msg.content}</div>
              </div>
            );
          }
          const isLatest = idx === lastAssistantIdx;
          const cards = msg.places || [];
          const delay = isLatest && msg.isStreaming ? cards.length * CARD_DELAY : 0;

          return (
            <React.Fragment key={msg.id}>
              {cards.map((place, ci) => (
                <motion.div key={place.id} className={styles.cardWrapper}
                  initial={isLatest && msg.isStreaming ? { opacity: 0, y: 20 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: isLatest && msg.isStreaming ? ci * CARD_DELAY : 0, duration: 0.4 }}>
                  <PlaceCard place={place} onBookmarkToggle={handleBookmarkToggle} onClick={() => handlePlaceClick(place)} />
                </motion.div>
              ))}
              <motion.div className={styles.aiMessageRow}
                initial={isLatest && msg.isStreaming ? { opacity: 0, y: 12 } : false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay, duration: 0.35 }}>
                <div className={styles.aiAvatar}>M</div>
                <div className={styles.aiBubble}>
                  {isLatest && msg.isStreaming ? (
                    <StreamText text={msg.content} speed={18} startDelay={delay} onComplete={() => handleStreamComplete(msg.id)} />
                  ) : (
                    <span style={{ whiteSpace: 'pre-line' }}>{msg.content}</span>
                  )}
                </div>
              </motion.div>
            </React.Fragment>
          );
        })}

        {/* Loading */}
        {isLoading && (
          <div className={styles.aiMessageRow}>
            <div className={styles.aiAvatar}>M</div>
            <div className={styles.loadingBubble}>
              <AnimatePresence mode="wait">
                <motion.span key={loadingMsgIndex} className={styles.loadingText}
                  initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.28 }}>
                  {loadingMessages[loadingMsgIndex]}
                </motion.span>
              </AnimatePresence>
              <span className={styles.loadingDots}>
                <span className={styles.dot}/><span className={styles.dot}/><span className={styles.dot}/>
              </span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Floating input */}
      {!loginRequired && (
        <div className={styles.chatInputBar}>
          <input ref={inputRef} type="text" className={styles.chatInput}
            placeholder={hasMessages ? '더 찾고 싶은 게 있나요?' : welcomeMessage}
            value={inputValue} onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown} disabled={isLoading} />
          <button
            className={`${styles.sendButton} ${inputValue.trim() && !isLoading ? styles.sendButtonActive : ''}`}
            onClick={handleSendMessage} disabled={!inputValue.trim() || isLoading} aria-label="전송">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      )}

      <LoginRequiredSheet visible={showLoginSheet} onClose={() => setShowLoginSheet(false)}
        onLogin={() => { setShowLoginSheet(false); navigate('/login', { state: { from: '/search-results' } }); }} />
    </div>
  );
}

// ── PlaceCard ────────────────────────────────────────────────────────────────

function PlaceCard({ place, onBookmarkToggle, onClick }) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const images = place.images?.length > 0 ? place.images
    : place.image ? [place.image] : place.imageUrl ? [place.imageUrl]
    : ['https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&h=600&fit=crop'];

  return (
    <div className={styles.placeCard} onClick={onClick}>
      <div className={styles.imageContainer}>
        <div className={styles.imageSlider} onScroll={e => {
          const idx = Math.round(e.target.scrollLeft / e.target.offsetWidth);
          if (idx !== currentImageIndex) setCurrentImageIndex(idx);
        }}>
          {images.slice(0, 5).map((src, i) => (
            <div key={i} className={styles.imageSlide}>
              <img src={buildImageUrl(src)} alt={`${place.name} ${i+1}`} className={styles.placeImage}
                draggable={false} onError={e => { e.target.src = 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&h=600&fit=crop'; }} />
            </div>
          ))}
        </div>
        <button className={`${styles.bookmarkButton} ${place.isBookmarked ? styles.bookmarked : ''}`}
          onClick={e => { e.stopPropagation(); onBookmarkToggle(place.id, !place.isBookmarked); }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
              fill={place.isBookmarked ? '#FF385C' : 'rgba(0,0,0,0.45)'} stroke="white" strokeWidth="1.5" />
          </svg>
        </button>
        {images.length > 1 && (
          <div className={styles.imageIndicators}>
            {images.slice(0, 5).map((_, i) => (
              <span key={i} className={`${styles.indicator} ${i === currentImageIndex ? styles.active : ''}`} />
            ))}
          </div>
        )}
      </div>
      <div className={styles.placeInfo}>
        <div className={styles.placeHeader}>
          <h3 className={styles.placeName}>{place.name || place.title}</h3>
          <div className={styles.rating}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 0L7.34708 4.1459H11.7063L8.17963 6.7082L9.52671 10.8541L6 8.2918L2.47329 10.8541L3.82037 6.7082L0.293661 4.1459H4.65292L6 0Z" fill="#222"/>
            </svg>
            <span>{Number(place.rating || 4.0).toFixed(1)}</span>
          </div>
        </div>
        <p className={styles.placeLocation}>{place.location || place.address || place.shortAddress}</p>
        {place.description && <p className={styles.placeDescription}>{place.description}</p>}
        {place.tags?.length > 0 && (
          <div className={styles.placeTags}>
            {place.tags.slice(0, 3).map((tag, i) => <span key={i} className={styles.tag}>#{tag}</span>)}
          </div>
        )}
      </div>
    </div>
  );
}
