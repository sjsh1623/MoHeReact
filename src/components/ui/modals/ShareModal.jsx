import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { AnimatePresence, motion } from 'framer-motion';
import styles from '@/styles/components/ui/modals/share-modal.module.css';

/**
 * ShareModal - Instagram-style share modal
 *
 * Features:
 * - Copy URL to clipboard
 * - Share to KakaoTalk (mobile)
 * - Share to Instagram Stories (mobile)
 * - Native share API fallback
 */
export default function ShareModal({
  isOpen,
  onClose,
  title,
  description,
  url,
  imageUrl,
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [isOpen]);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = url;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (e) {
        console.error('Copy failed:', e);
      }
      document.body.removeChild(textArea);
    }
  };

  const handleKakaoShare = () => {
    // KakaoTalk share via URL scheme (mobile)
    const kakaoShareUrl = `https://story.kakao.com/share?url=${encodeURIComponent(url)}`;

    // Try Kakao SDK first if available
    if (window.Kakao?.isInitialized?.()) {
      window.Kakao.Share.sendDefault({
        objectType: 'feed',
        content: {
          title: title,
          description: description,
          imageUrl: imageUrl,
          link: {
            mobileWebUrl: url,
            webUrl: url,
          },
        },
        buttons: [
          {
            title: '자세히 보기',
            link: {
              mobileWebUrl: url,
              webUrl: url,
            },
          },
        ],
      });
    } else {
      // Fallback to KakaoTalk URL scheme
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile) {
        // Try to open KakaoTalk app with share intent
        const kakaoTalkUrl = `kakaotalk://web/share?url=${encodeURIComponent(url)}`;
        window.location.href = kakaoTalkUrl;

        // Fallback to web share after timeout
        setTimeout(() => {
          window.open(kakaoShareUrl, '_blank');
        }, 1500);
      } else {
        window.open(kakaoShareUrl, '_blank');
      }
    }
  };

  const handleInstagramShare = () => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (isMobile) {
      // Copy URL first, then prompt user to paste in Instagram
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        setTimeout(() => {
          setCopied(false);
          // Open Instagram app
          window.location.href = 'instagram://';
        }, 500);
      }).catch(() => {
        // Still try to open Instagram
        window.location.href = 'instagram://';
      });
    } else {
      // Desktop: just copy URL
      handleCopyUrl();
    }
  };

  const handleNativeShare = async () => {
    const shareData = {
      title: title,
      text: description,
      url: url,
    };

    try {
      if (navigator.share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
        onClose();
      } else {
        // Fallback to copy URL
        handleCopyUrl();
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Share failed:', err);
      }
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={styles.backdrop}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={handleBackdropClick}
        >
          <motion.div
            className={styles.modal}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 400 }}
          >
            <div className={styles.handle} />

            <h3 className={styles.title}>공유하기</h3>

            <div className={styles.shareOptions}>
              {/* Copy URL */}
              <button className={styles.shareOption} onClick={handleCopyUrl}>
                <div className={styles.iconWrapper}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2"/>
                    <path d="M5 15H4C2.89543 15 2 14.1046 2 13V4C2 2.89543 2.89543 2 4 2H13C14.1046 2 15 2.89543 15 4V5" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                </div>
                <span>{copied ? '복사됨!' : 'URL 복사'}</span>
              </button>

              {/* KakaoTalk */}
              <button className={styles.shareOption} onClick={handleKakaoShare}>
                <div className={`${styles.iconWrapper} ${styles.kakao}`}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M12 3C6.477 3 2 6.463 2 10.731C2 13.494 3.862 15.928 6.636 17.275L5.636 21.293C5.578 21.52 5.82 21.702 6.018 21.573L10.71 18.405C11.134 18.451 11.564 18.475 12 18.475C17.523 18.475 22 15.012 22 10.731C22 6.463 17.523 3 12 3Z" fill="#3C1E1E"/>
                  </svg>
                </div>
                <span>카카오톡</span>
              </button>

              {/* Instagram */}
              <button className={styles.shareOption} onClick={handleInstagramShare}>
                <div className={`${styles.iconWrapper} ${styles.instagram}`}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <rect x="2" y="2" width="20" height="20" rx="5" stroke="currentColor" strokeWidth="2"/>
                    <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2"/>
                    <circle cx="18" cy="6" r="1.5" fill="currentColor"/>
                  </svg>
                </div>
                <span>인스타그램</span>
              </button>

              {/* More (Native Share) */}
              <button className={styles.shareOption} onClick={handleNativeShare}>
                <div className={styles.iconWrapper}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <circle cx="6" cy="12" r="2" fill="currentColor"/>
                    <circle cx="12" cy="12" r="2" fill="currentColor"/>
                    <circle cx="18" cy="12" r="2" fill="currentColor"/>
                  </svg>
                </div>
                <span>더보기</span>
              </button>
            </div>

            <button className={styles.cancelButton} onClick={onClose}>
              취소
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

ShareModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  title: PropTypes.string,
  description: PropTypes.string,
  url: PropTypes.string.isRequired,
  imageUrl: PropTypes.string,
};

ShareModal.defaultProps = {
  title: 'Mohe',
  description: 'Mohe에서 발견한 장소',
  imageUrl: '',
};
