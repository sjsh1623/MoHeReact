import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { contextualRecommendationService } from '@/services/apiService';
import { authService } from '@/services/authService';
import { useGeolocation } from '@/hooks/useGeolocation';
import styles from '@/styles/components/layout/global-message-input.module.css';

const VISIBLE_ROUTES = []; // search-results는 자체 채팅 입력 사용

export default function GlobalMessageInput() {
  const location = useLocation();
  const navigate = useNavigate();
  const [showMessageBox, setShowMessageBox] = useState(false);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { location: userLocation } = useGeolocation();

  const shouldShow = VISIBLE_ROUTES.includes(location.pathname);

  useEffect(() => {
    if (shouldShow) {
      const timer = setTimeout(() => setShowMessageBox(true), 500);
      return () => clearTimeout(timer);
    } else {
      setShowMessageBox(false);
    }
  }, [shouldShow]);

  const handleSendMessage = async () => {
    if (!message.trim() || isLoading) return;

    // Non-authenticated users get redirected to login prompt in the chat
    const user = authService.getCurrentUser();
    const isGuest = !user || user.isGuest;
    if (isGuest) {
      navigate('/search-results', {
        state: {
          loginRequired: true,
          query: message.trim(),
        }
      });
      setMessage('');
      return;
    }

    try {
      setIsLoading(true);

      let latitude = 37.5665;
      let longitude = 126.9780;
      if (userLocation) {
        latitude = userLocation.latitude;
        longitude = userLocation.longitude;
      }

      const response = await contextualRecommendationService.getContextualRecommendations(
        message.trim(),
        latitude,
        longitude,
        { limit: 20 }
      );

      if (response.success) {
        navigate('/search-results', {
          state: {
            query: message.trim(),
            results: response.data.places,
            searchContext: response.data.searchContext,
            isContextualSearch: true
          }
        });
      } else {
        navigate('/search-results', {
          state: {
            query: message.trim(),
            results: [],
            error: response.message || '검색에 실패했습니다.'
          }
        });
      }

      setMessage('');
    } catch (error) {
      console.error('Error performing contextual search:', error);
      navigate('/search-results', {
        state: {
          query: message.trim(),
          results: [],
          error: '검색 중 오류가 발생했습니다. 다시 시도해주세요.'
        }
      });
      setMessage('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') handleSendMessage();
  };

  if (!shouldShow) return null;

  return (
    /* Outer div handles fixed positioning — width controlled purely by CSS left/right */
    <div className={styles.messageOuter}>
      <AnimatePresence>
        {showMessageBox && (
          <motion.div
            className={styles.messageContainer}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <div className={styles.messageInputWrapper}>
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="어떤 장소를 찾고 계신가요?"
                className={styles.messageInput}
              />
              <button
                className={`${styles.sendButton} ${message.trim() && !isLoading ? styles.sendButtonActive : ''}`}
                onClick={handleSendMessage}
                disabled={!message.trim() || isLoading}
              >
                {isLoading ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="40 20">
                      <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite"/>
                    </circle>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
