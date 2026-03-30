import React, { useState, useEffect, useRef, useCallback } from 'react';
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

const getLoadingMessages = (query) => query
  ? [
      `"${query}" 살펴보는 중`,
      '관련 장소 찾는 중...',
      '딱 맞는 곳 고르는 중',
      '거의 다 됐어요',
    ]
  : [
      '주변을 살펴보는 중이에요',
      '딱 맞는 장소 고르는 중...',
      '마음에 드실 것 같아요',
      '거의 다 됐어요',
    ];

let msgIdCounter = 0;
function nextMsgId() {
  return `msg-${Date.now()}-${++msgIdCounter}`;
}

function getSessionId() {
  let id = localStorage.getItem('mohe_session_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('mohe_session_id', id);
  }
  return id;
}

function formatHistoryDate(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return '방금';
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  if (diffDay < 7) return `${diffDay}일 전`;
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

// Character-by-character streaming text
function StreamText({ text, speed = 18, startDelay = 0, onComplete }) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!text) return;
    setDisplayed('');
    setDone(false);

    let interval;
    const delayTimer = setTimeout(() => {
      let i = 0;
      interval = setInterval(() => {
        i++;
        setDisplayed(text.slice(0, i));
        if (i >= text.length) {
          clearInterval(interval);
          setDone(true);
          onComplete?.();
        }
      }, speed);
    }, startDelay * 1000);

    return () => {
      clearTimeout(delayTimer);
      if (interval) clearInterval(interval);
    };
  }, [text, speed, startDelay]);

  return (
    <span style={{ whiteSpace: 'pre-line' }}>
      {displayed}
      {!done && text && <span className={styles.streamCursor} />}
    </span>
  );
}

// ── History Sidebar (Claude-style) ────────────────────────────────────────────
function HistorySidebar({ history, onClose, onItemClick, onDeleteEntry }) {
  return (
    <AnimatePresence>
      <motion.div
        className={styles.sidebarOverlay}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
      />
      <motion.div
        className={styles.sidebar}
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <div className={styles.sidebarHeader}>
          <span className={styles.sidebarTitle}>이전 대화</span>
          <button className={styles.sidebarClose} onClick={onClose} aria-label="닫기">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className={styles.sidebarList}>
          {history.length === 0 ? (
            <div className={styles.sidebarEmpty}>
              <div className={styles.sidebarEmptyIcon}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <path d="M12 8V12L15 15" stroke="#ccc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="12" cy="12" r="9" stroke="#ccc" strokeWidth="2"/>
                </svg>
              </div>
              <p className={styles.sidebarEmptyText}>아직 대화 기록이 없어요</p>
              <p className={styles.sidebarEmptySubtext}>검색하면 여기에 저장돼요</p>
            </div>
          ) : (
            history.map(entry => (
              <div key={entry.id} className={styles.sidebarItem}>
                <button
                  className={styles.sidebarItemMain}
                  onClick={() => onItemClick(entry.query)}
                >
                  <div className={styles.sidebarItemTop}>
                    <span className={styles.sidebarItemQuery}>{entry.query}</span>
                    <span className={styles.sidebarItemDate}>{formatHistoryDate(entry.timestamp)}</span>
                  </div>
                  {entry.resultPreviews.length > 0 && (
                    <div className={styles.sidebarItemThumbs}>
                      {entry.resultPreviews.map(p => (
                        <img
                          key={p.id}
                          src={buildImageUrl(p.imageUrl) || 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=80&h=80&fit=crop'}
                          alt={p.name}
                          className={styles.sidebarItemThumb}
                          onError={(e) => {
                            e.target.src = 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=80&h=80&fit=crop';
                          }}
                        />
                      ))}
                    </div>
                  )}
                </button>
                <button
                  className={styles.sidebarItemDelete}
                  onClick={() => onDeleteEntry(entry.id)}
                  aria-label="삭제"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
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

  // messages: array of { id, role: 'user'|'assistant', content, places, isStreaming }
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);
  const [loadingQuery, setLoadingQuery] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [showSidebar, setShowSidebar] = useState(false);
  const [showLoginSheet, setShowLoginSheet] = useState(false);

  const { location } = useGeolocation();
  const { history, addConversation, removeEntry } = useConversationHistory();

  const user = authService.getCurrentUser();
  const isGuest = !user || user.isGuest;
  const userName = user && !user.isGuest ? (user.nickname || '사용자') : null;

  const loadingMessages = getLoadingMessages(loadingQuery);

  // Build AI message text based on query and results
  const buildAiMessage = useCallback((query, results, error, searchMessage) => {
    if (error) return `${error}\n다시 검색해볼까요?`;
    if (results.length === 0) {
      return query
        ? `'${query}'에 맞는 곳을 못 찾았어요.\n다른 키워드나 분위기로 다시 찾아볼까요?`
        : '근처에 추천할 장소가 아직 없어요.\n원하는 분위기를 말해주시면 찾아드릴게요!';
    }
    if (!query) {
      return isGuest
        ? '이 근처 인기 있는 곳들이에요.\n어디 가고 싶은지 말해주시면 더 잘 찾아드릴게요!'
        : `${userName}님 취향에 맞을 것 같은 곳들이에요.\n오늘 어떤 분위기가 끌리세요?`;
    }
    const base = searchMessage || `'${query}'에 딱 맞는 곳들이에요.`;
    return `${base}\n마음에 드는 곳이 있나요? 조건을 더 알려주시면 바로 찾아드려요!`;
  }, [isGuest, userName]);

  // Core search function - appends messages
  const performSearch = useCallback(async (query, preloadedResults = null) => {
    // Add user message
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
        let lat = 37.5665;
        let lon = 126.9780;
        if (location) {
          lat = location.latitude;
          lon = location.longitude;
        }

        let response;
        if (query) {
          const sessionId = getSessionId();
          response = await searchChatService.searchChat(query, lat, lon, {
            limit: MAX_CARDS,
            sessionId,
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
      const remaining = MIN_LOADING_MS - elapsed;
      if (remaining > 0) {
        await new Promise(resolve => setTimeout(resolve, remaining));
      }

      const aiContent = buildAiMessage(query, results, fetchError, msgText);

      // Add assistant message
      setMessages(prev => [
        ...prev,
        {
          id: nextMsgId(),
          role: 'assistant',
          content: aiContent,
          places: results.slice(0, MAX_CARDS),
          isStreaming: true,
        },
      ]);

      // Save to conversation history
      if (query) {
        const previews = results.slice(0, MAX_CARDS).map(p => ({
          id: p.id,
          name: p.name || p.title,
          imageUrl: p.images?.[0] || p.image || p.imageUrl || '',
        }));
        addConversation({ query, aiMessage: aiContent, resultPreviews: previews });
      }
    } catch (err) {
      console.error('Failed to search places:', err);
      await new Promise(resolve => setTimeout(resolve, MIN_LOADING_MS));

      setMessages(prev => [
        ...prev,
        {
          id: nextMsgId(),
          role: 'assistant',
          content: '검색 중 오류가 발생했습니다.\n다시 검색해볼까요?',
          places: [],
          isStreaming: true,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [location, user, buildAiMessage, addConversation]);

  // Cycle loading messages
  useEffect(() => {
    if (!isLoading) return;
    setLoadingMsgIndex(0);
    const interval = setInterval(() => {
      setLoadingMsgIndex(prev => (prev + 1) % loadingMessages.length);
    }, 1100);
    return () => clearInterval(interval);
  }, [isLoading, loadingMessages.length]);

  // Initial search from URL query or preloaded results
  useEffect(() => {
    if (hasInitialSearched.current) return;
    if (loginRequired) return;

    hasInitialSearched.current = true;

    const preloaded = locationState?.results || null;
    performSearch(initialQuery, preloaded);
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll when new messages arrive or loading finishes
  useEffect(() => {
    const timer = setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 200);
    return () => clearTimeout(timer);
  }, [messages.length, isLoading]);

  const handleStreamComplete = useCallback((msgId) => {
    setMessages(prev =>
      prev.map(m => m.id === msgId ? { ...m, isStreaming: false } : m)
    );
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, []);

  const handleBookmarkToggle = async (placeId, shouldBookmark) => {
    try {
      if (isGuest) {
        navigate('/login', { state: { from: '/search-results' } });
        return;
      }
      if (shouldBookmark) {
        await bookmarkService.addBookmark(placeId);
      } else {
        await bookmarkService.removeBookmark(placeId);
      }
      // Update bookmark in all messages
      setMessages(prev =>
        prev.map(msg => ({
          ...msg,
          places: msg.places.map(p =>
            p.id === placeId ? { ...p, isBookmarked: shouldBookmark } : p
          ),
        }))
      );
    } catch (err) {
      console.error('Failed to bookmark place:', err);
    }
  };

  const handlePlaceClick = (place) => {
    navigate(`/place/${place.id}`, { state: { preloadedData: place } });
  };

  const handleHamburgerClick = () => {
    if (isGuest) {
      setShowLoginSheet(true);
    } else {
      setShowSidebar(true);
    }
  };

  const handleHistoryItemClick = (historyQuery) => {
    setShowSidebar(false);
    navigate(`/search-results?q=${encodeURIComponent(historyQuery)}`);
  };

  const handleSendMessage = () => {
    const trimmed = inputValue.trim();
    if (!trimmed || isLoading) return;
    setInputValue('');
    performSearch(trimmed);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Determine index of last assistant message (for streaming animation)
  const lastAssistantIdx = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return i;
    }
    return -1;
  })();

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

        <button className={styles.hamburgerButton} onClick={handleHamburgerClick} aria-label="대화 목록">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
          </svg>
        </button>
      </header>

      {/* Chat area */}
      <div className={styles.chatArea}>
        <div className={styles.spacer} />

        {/* Login required initial prompt */}
        {loginRequired && (
          <>
            <div className={styles.userMessageRow}>
              <div className={styles.userBubble}>
                {locationState?.query}
              </div>
            </div>
            <motion.div
              className={styles.aiMessageRow}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <div className={styles.aiAvatar}>M</div>
              <div className={styles.loginBubble}>
                <p className={styles.loginBubbleText}>
                  맞춤 추천을 위해 로그인이 필요해요.{'\n'}회원 데이터를 기반으로 더 잘 찾아드릴게요!
                </p>
                <button
                  className={styles.loginButton}
                  onClick={() => navigate('/login', { state: { from: '/search-results' } })}
                >
                  로그인하기
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </motion.div>
          </>
        )}

        {/* Render all accumulated messages */}
        {messages.map((msg, idx) => {
          if (msg.role === 'user') {
            return (
              <div key={msg.id} className={styles.userMessageRow}>
                <div className={styles.userBubble}>{msg.content}</div>
              </div>
            );
          }

          // Assistant message
          const isLatest = idx === lastAssistantIdx;
          const displayedCards = msg.places || [];
          const messageDelay = isLatest && msg.isStreaming ? displayedCards.length * CARD_DELAY : 0;

          return (
            <React.Fragment key={msg.id}>
              {displayedCards.map((place, cardIdx) => (
                <motion.div
                  key={place.id}
                  className={styles.cardWrapper}
                  initial={isLatest && msg.isStreaming ? { opacity: 0, y: 20 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: isLatest && msg.isStreaming ? cardIdx * CARD_DELAY : 0,
                    duration: 0.4,
                    ease: [0.25, 0.46, 0.45, 0.94],
                  }}
                >
                  <PlaceCard
                    place={place}
                    onBookmarkToggle={handleBookmarkToggle}
                    onClick={() => handlePlaceClick(place)}
                  />
                </motion.div>
              ))}

              <motion.div
                className={styles.aiMessageRow}
                initial={isLatest && msg.isStreaming ? { opacity: 0, y: 12 } : false}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: messageDelay,
                  duration: 0.35,
                  ease: [0.25, 0.46, 0.45, 0.94],
                }}
              >
                <div className={styles.aiAvatar}>M</div>
                <div className={styles.aiBubble}>
                  {isLatest && msg.isStreaming ? (
                    <StreamText
                      text={msg.content}
                      speed={18}
                      startDelay={messageDelay}
                      onComplete={() => handleStreamComplete(msg.id)}
                    />
                  ) : (
                    <span style={{ whiteSpace: 'pre-line' }}>{msg.content}</span>
                  )}
                </div>
              </motion.div>
            </React.Fragment>
          );
        })}

        {/* Loading indicator */}
        {isLoading && (
          <div className={styles.aiMessageRow}>
            <div className={styles.aiAvatar}>M</div>
            <div className={styles.loadingBubble}>
              <AnimatePresence mode="wait">
                <motion.span
                  key={loadingMsgIndex}
                  className={styles.loadingText}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.28, ease: 'easeOut' }}
                >
                  {loadingMessages[loadingMsgIndex]}
                </motion.span>
              </AnimatePresence>
              <span className={styles.loadingDots}>
                <span className={styles.dot} />
                <span className={styles.dot} />
                <span className={styles.dot} />
              </span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Chat input bar */}
      {!loginRequired && (
        <div className={styles.chatInputBar}>
          <input
            ref={inputRef}
            type="text"
            className={styles.chatInput}
            placeholder="더 찾고 싶은 게 있나요?"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
          />
          <button
            className={`${styles.sendButton} ${inputValue.trim() && !isLoading ? styles.sendButtonActive : ''}`}
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading}
            aria-label="전송"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      )}

      {/* History Sidebar */}
      {showSidebar && (
        <HistorySidebar
          history={history}
          onClose={() => setShowSidebar(false)}
          onItemClick={handleHistoryItemClick}
          onDeleteEntry={(id) => removeEntry(id)}
        />
      )}

      {/* Login Required Sheet */}
      <LoginRequiredSheet
        visible={showLoginSheet}
        onClose={() => setShowLoginSheet(false)}
        onLogin={() => {
          setShowLoginSheet(false);
          navigate('/login', { state: { from: '/search-results' } });
        }}
      />
    </div>
  );
}

function PlaceCard({ place, onBookmarkToggle, onClick }) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const sliderRef = useRef(null);

  const images = place.images?.length > 0
    ? place.images
    : place.image
      ? [place.image]
      : place.imageUrl
        ? [place.imageUrl]
        : ['https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&h=600&fit=crop'];

  const handleScroll = (e) => {
    const slider = e.target;
    const newIndex = Math.round(slider.scrollLeft / slider.offsetWidth);
    if (newIndex !== currentImageIndex) setCurrentImageIndex(newIndex);
  };

  const handleBookmarkClick = (e) => {
    e.stopPropagation();
    onBookmarkToggle(place.id, !place.isBookmarked);
  };

  return (
    <div className={styles.placeCard} onClick={onClick}>
      <div className={styles.imageContainer}>
        <div ref={sliderRef} className={styles.imageSlider} onScroll={handleScroll}>
          {images.slice(0, 5).map((imgSrc, index) => (
            <div key={index} className={styles.imageSlide}>
              <img
                src={buildImageUrl(imgSrc)}
                alt={`${place.name || place.title} ${index + 1}`}
                className={styles.placeImage}
                draggable={false}
                onError={(e) => {
                  e.target.src = 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&h=600&fit=crop';
                }}
              />
            </div>
          ))}
        </div>

        <button
          className={`${styles.bookmarkButton} ${place.isBookmarked ? styles.bookmarked : ''}`}
          onClick={handleBookmarkClick}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
              fill={place.isBookmarked ? '#FF385C' : 'rgba(0,0,0,0.45)'}
              stroke="white"
              strokeWidth="1.5"
            />
          </svg>
        </button>

        {images.length > 1 && (
          <div className={styles.imageIndicators}>
            {images.slice(0, 5).map((_, index) => (
              <span
                key={index}
                className={`${styles.indicator} ${index === currentImageIndex ? styles.active : ''}`}
              />
            ))}
          </div>
        )}
      </div>

      <div className={styles.placeInfo}>
        <div className={styles.placeHeader}>
          <h3 className={styles.placeName}>{place.name || place.title}</h3>
          <div className={styles.rating}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 0L7.34708 4.1459H11.7063L8.17963 6.7082L9.52671 10.8541L6 8.2918L2.47329 10.8541L3.82037 6.7082L0.293661 4.1459H4.65292L6 0Z" fill="#222222"/>
            </svg>
            <span>{Number(place.rating || 4.0).toFixed(1)}</span>
          </div>
        </div>
        <p className={styles.placeLocation}>{place.location || place.address || place.shortAddress}</p>
        {place.description && (
          <p className={styles.placeDescription}>{place.description}</p>
        )}
        {place.tags && place.tags.length > 0 && (
          <div className={styles.placeTags}>
            {place.tags.slice(0, 3).map((tag, index) => (
              <span key={index} className={styles.tag}>#{tag}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
