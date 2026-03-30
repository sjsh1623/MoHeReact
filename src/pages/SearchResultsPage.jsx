import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import styles from '@/styles/pages/search-results-page.module.css';

import { placeService, bookmarkService, searchChatService, weatherService } from '@/services/apiService';
import { authService } from '@/services/authService';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useConversationHistory } from '@/hooks/useConversationHistory';
import { buildImageUrl, normalizePlaceImages } from '@/utils/image';
import LoginRequiredSheet from '@/components/ui/modals/LoginRequiredSheet';

const CARD_DELAY = 0.45;
const MAX_CARDS = 3;
const MIN_LOADING_MS = 3000;

// 시간대 × 날씨별 환영 멘트
const WELCOME_POOL = {
  morning: {
    sunny: [
      '화창한 아침이에요! ☀️\n테라스 있는 브런치 카페 어때요?',
      '날씨 좋은 아침!\n산책하면서 커피 한 잔 하러 갈까요? 🚶‍♂️',
      '맑은 아침이에요~ ☀️\n야외에서 아침 먹기 딱 좋은 날이에요',
      '오늘 아침 햇살이 좋네요!\n기분 좋게 시작해볼까요? ☕',
    ],
    cloudy: [
      '흐린 아침이에요 ☁️\n따뜻한 카페에서 모닝커피 어때요?',
      '구름 낀 아침이네요~\n포근한 실내에서 브런치 하러 가요',
      '흐릿한 아침이지만!\n맛있는 빵 냄새 맡으러 갈까요? 🥐',
      '오늘 좀 흐리네요~\n아늑한 곳에서 하루 시작해요 ☕',
    ],
    rainy: [
      '비 오는 아침이에요 🌧️\n창가 자리에서 커피 한 잔 어때요?',
      '비 소리 들으며 브런치 어때요?\n분위기 있는 곳 찾아드릴게요 ☔',
      '비 오는 날 아침엔\n따뜻한 죽 한 그릇이 최고죠 🍲',
      '우산 챙기셨죠? 🌂\n비 와도 가기 좋은 곳 알려드릴게요',
    ],
    snowy: [
      '눈 오는 아침이에요! ❄️\n따뜻한 곳에서 핫초코 어때요?',
      '눈이 내리네요~ ☃️\n포근한 카페에서 눈 구경할까요?',
      '하얀 아침이에요!\n따뜻한 빵이랑 커피 생각나지 않아요? 🥖',
    ],
    default: [
      '좋은 아침이에요! 🌤️\n오늘 하루 어떻게 시작할까요?',
      '모닝 커피 한 잔 어때요? ☕\n좋은 곳 찾아드릴게요',
      '굿모닝! ✨\n오늘 아침은 뭐 먹고 싶으세요?',
    ],
  },
  afternoon: {
    sunny: [
      '햇살 좋은 오후에요! ☀️\n테라스에서 점심 어때요?',
      '날씨 좋은데 밖에서 먹을까요?\n야외 맛집 찾아드릴게요 🌿',
      '화창한 오후!\n공원 근처 카페 어떠세요? 🌳',
      '이 날씨에 실내에만 있기 아깝죠?\n바람 맞으며 먹어요 ☀️',
    ],
    cloudy: [
      '흐린 오후네요 ☁️\n실내에서 맛있는 거 먹을까요?',
      '구름 많은 오후~\n갤러리 카페 같은 데 어때요? 🎨',
      '흐릿한 날엔 실내가 최고!\n뭐 먹고 싶으세요? 🍽️',
      '나른한 오후에요~\n달달한 디저트 하나 어때요? 🍰',
    ],
    rainy: [
      '비 오는 오후에요 🌧️\n파전에 막걸리 생각나지 않아요?',
      '비 오는 날엔 따끈한 국물이죠!\n뭐 먹을까요? 🍲',
      '비 소리 들으며 카페에서\n여유로운 오후 보내요 ☕',
      '비 오는 날 딱 좋은 곳\n찾아드릴게요 ☔',
    ],
    snowy: [
      '눈 오는 오후에요! ❄️\n뜨끈한 찌개 먹으러 갈까요?',
      '눈 내리는 날엔\n따뜻한 실내가 최고예요 ☃️',
      '하얀 눈 보면서 라멘 한 그릇 어때요? 🍜',
    ],
    default: [
      '점심 뭐 먹을지 고민이죠? 🍽️\n제가 도와드릴게요',
      '오후에 어디 갈지 정하셨어요?\n말만 하세요! ✨',
      '달달한 디저트가 땡기는 오후네요 🍰',
      '나른한 오후, 카페 갈까요? ☕',
    ],
  },
  evening: {
    sunny: [
      '노을이 예쁜 저녁이에요 🌅\n루프탑에서 한 잔 할까요?',
      '맑은 저녁!\n야경 보면서 저녁 먹어요 🌆',
      '저녁놀이 예쁜 날이에요~\n뷰 좋은 곳 알려드릴까요? ✨',
      '퇴근길 날씨가 좋네요!\n어디 들러볼까요? 🌇',
    ],
    cloudy: [
      '흐린 저녁이에요~\n분위기 있는 곳에서 저녁 어때요? 🕯️',
      '구름 낀 저녁!\n와인바에서 한 잔 할까요? 🍷',
      '퇴근하셨어요? 수고했어요! 🙌\n맛있는 거 먹으러 가요',
      '흐린 저녁엔 실내가 좋아요\n뭐 먹고 싶으세요?',
    ],
    rainy: [
      '비 오는 저녁이네요 🌧️\n얼큰한 국물 어때요?',
      '비 오는 밤에 이자카야 어때요?\n따뜻한 사케 한 잔 🍶',
      '비 소리 들으며 와인 한 잔?\n분위기 있는 곳 찾아볼게요 🍷',
      '비 오는 저녁엔\n매운 거 먹고 싶지 않아요? 🌶️',
    ],
    snowy: [
      '눈 오는 저녁이에요! ❄️\n뜨끈한 샤브샤브 어때요?',
      '눈 내리는 밤~\n따뜻한 곳에서 고기 구워먹어요 🥩',
      '하얀 눈 보면서 저녁 먹어요 ☃️\n어떤 게 땡기세요?',
    ],
    default: [
      '오늘 저녁은 뭐 먹을까요? 🌙\n맛있는 곳 찾아볼게요',
      '오늘 하루도 고생했어요!\n맛있는 걸로 보상해요 ✨',
      '저녁 약속 있으세요?\n괜찮은 곳 추천해드릴까요?',
      '뭔가 먹고 싶은데\n뭘 먹을지 모르겠죠? 도와드릴게요!',
    ],
  },
  night: {
    sunny: [
      '맑은 밤이에요 🌙\n야경 보러 갈까요?',
      '별이 보이는 밤!\n루프탑 바 어때요? ✨',
      '맑은 밤하늘 아래\n한 잔 하러 갈까요? 🍺',
    ],
    cloudy: [
      '늦은 밤이네요~\n아직 열린 곳 찾아볼까요? 🌃',
      '밤이 깊어가요\n야식 먹을까요? 🍜',
      '이 시간에도 갈 곳 있어요!\n뭘 찾으세요? ✨',
    ],
    rainy: [
      '비 오는 밤이에요 🌧️\n포차에서 한 잔 할까요?',
      '비 오는 밤에 라멘 어때요?\n따끈한 국물이 생각나요 🍜',
      '비 소리 들으며 바에서\n조용히 한 잔 어때요? 🥃',
    ],
    snowy: [
      '눈 오는 밤이에요! ❄️\n따뜻한 곳 찾아드릴게요',
      '하얀 밤이네요~ ☃️\n뜨끈한 어묵탕 어때요?',
    ],
    default: [
      '이 밤에 뭐 먹을까요? 🌃\n야식 찾아드릴게요',
      '밤에 출출하죠?\n맛있는 야식 추천해드릴게요 🍜',
      '잠이 안 오시나요?\n카페나 바 어때요? 🍸',
    ],
  },
};

function getWelcomeMessage(weatherText) {
  const hour = new Date().getHours();

  let timeSlot;
  if (hour >= 6 && hour < 12) timeSlot = 'morning';
  else if (hour >= 12 && hour < 18) timeSlot = 'afternoon';
  else if (hour >= 18 && hour < 23) timeSlot = 'evening';
  else timeSlot = 'night';

  // 날씨 텍스트에서 조건 매칭
  let weather = 'default';
  if (weatherText) {
    const w = weatherText.toLowerCase();
    if (w.includes('눈') || w.includes('snow')) weather = 'snowy';
    else if (w.includes('비') || w.includes('rain') || w.includes('소나기')) weather = 'rainy';
    else if (w.includes('흐') || w.includes('구름') || w.includes('cloud')) weather = 'cloudy';
    else if (w.includes('맑') || w.includes('clear') || w.includes('sun') || w.includes('晴')) weather = 'sunny';
  }

  const pool = WELCOME_POOL[timeSlot]?.[weather] || WELCOME_POOL[timeSlot]?.default || WELCOME_POOL.afternoon.default;
  return pool[Math.floor(Math.random() * pool.length)];
}

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
  const [viewportHeight, setViewportHeight] = useState('100dvh');

  // 키보드 올라오면 컨테이너 높이 조정 + body 스크롤 차단
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const onResize = () => {
      // visualViewport.height = 키보드 제외한 실제 보이는 영역
      setViewportHeight(`${vv.height}px`);
      // body가 밀리지 않도록 고정
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      // 키보드 올라왔으면 채팅 맨 아래로
      if (vv.height < window.innerHeight - 100) {
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'auto' }), 50);
      }
    };

    // body 스크롤 막기 (이 페이지에서만)
    const origOverflow = document.body.style.overflow;
    const origPosition = document.body.style.position;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';

    vv.addEventListener('resize', onResize);
    vv.addEventListener('scroll', onResize);

    return () => {
      vv.removeEventListener('resize', onResize);
      vv.removeEventListener('scroll', onResize);
      document.body.style.overflow = origOverflow;
      document.body.style.position = origPosition;
      document.body.style.width = '';
    };
  }, []);

  const { location } = useGeolocation();
  const { history, addConversation, removeEntry } = useConversationHistory();

  const user = authService.getCurrentUser();
  const isGuest = !user || user.isGuest;
  const userName = user && !user.isGuest ? (user.nickname || '사용자') : null;

  const loadingMessages = getLoadingMessages(loadingQuery);

  // 랜덤 환영 메시지 (마운트 시 1회)
  const [weatherText, setWeatherText] = useState(null);
  const welcomeMessage = useMemo(() => getWelcomeMessage(weatherText), [weatherText]);

  // 날씨 가져오기 (환영 멘트용)
  useEffect(() => {
    if (!location) return;
    weatherService.getCurrentWeather(location.latitude, location.longitude)
      .then(res => {
        if (res?.data?.conditionText) setWeatherText(res.data.conditionText);
      }).catch(() => {});
  }, [location]);

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
        // 위치: geolocation 우선, 없으면 저장된 위치, 최후에 기본 서울
        const stored = JSON.parse(localStorage.getItem('mohe_user_location') || 'null');
        let lat = location?.latitude || stored?.latitude || 37.5665;
        let lon = location?.longitude || stored?.longitude || 126.9780;

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
    <div className={styles.pageContainer} style={{ height: viewportHeight }}>
      {/* Header */}
      <header className={styles.header}>
        <button className={styles.backButton} onClick={() => navigate(-1)} aria-label="뒤로 가기">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className={styles.headerSpacer} />
        <button
          className={styles.historyHeaderButton}
          onClick={() => isGuest ? setShowLoginSheet(true) : setShowHistory(!showHistory)}
          aria-label="대화 목록"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M12 8v4l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
          </svg>
        </button>
      </header>

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

        {/* Welcome message — AI 메시지처럼 스트리밍 */}
        {!hasMessages && !isLoading && !loginRequired && (
          <motion.div
            className={styles.aiMessageRow}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <div className={styles.aiAvatar}>M</div>
            <div className={styles.aiBubble}>
              <StreamText text={welcomeMessage} speed={30} startDelay={0.5} />
            </div>
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

      {/* Floating input — 키보드에 맞춰 올라감 */}
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
