import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import styles from '@/styles/components/ui/modals/menu-fullscreen-modal.module.css';
import { buildImageUrl } from '@/utils/image';

export default function MenuFullscreenModal({
  isOpen,
  onClose,
  menus = [],
  initialIndex = 0
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [touchStartX, setTouchStartX] = useState(0);
  const [touchEndX, setTouchEndX] = useState(0);

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex, isOpen]);

  useEffect(() => {
    const restoreScroll = () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';

      // Restore page containers to their default scroll behavior
      const pageContainers = document.querySelectorAll('[data-page-container]');
      pageContainers.forEach(container => {
        container.style.overflow = 'auto';
        container.style.overflowY = 'auto';
        container.style.touchAction = '';
      });
    };

    if (isOpen) {
      // Block all scrolling
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';

      // Also block scroll on page containers
      const pageContainers = document.querySelectorAll('[data-page-container]');
      pageContainers.forEach(container => {
        container.style.overflow = 'hidden';
        container.style.touchAction = 'none';
      });
    } else {
      restoreScroll();
    }

    return () => {
      restoreScroll();
    };
  }, [isOpen]);

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < menus.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handleTouchStart = (e) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchMove = (e) => {
    setTouchEndX(e.touches[0].clientX);
  };

  const handleTouchEnd = () => {
    const threshold = 50;
    const diff = touchStartX - touchEndX;

    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        handleNext();
      } else {
        handlePrev();
      }
    }
    setTouchStartX(0);
    setTouchEndX(0);
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const currentMenu = menus[currentIndex] || null;

  return createPortal(
    <AnimatePresence>
      {isOpen && currentMenu && (
        <motion.div
          className={styles.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={handleBackdropClick}
        >
          {/* Close Button */}
          <button className={styles.closeButton} onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6L18 18" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {/* Image Counter */}
          <div className={styles.counter}>
            {currentIndex + 1} / {menus.length}
          </div>

          {/* Image Container */}
          <motion.div
            className={styles.imageContainer}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            key={currentIndex}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            <img
              src={buildImageUrl(currentMenu.imagePath)}
              alt={currentMenu.name || '메뉴'}
              className={styles.fullImage}
              draggable={false}
            />
          </motion.div>

          {/* Menu Info */}
          <motion.div
            className={styles.menuInfo}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <h3 className={styles.menuName}>{currentMenu.name || '메뉴'}</h3>
            <p className={styles.menuPrice}>{currentMenu.price || ''}</p>
            {currentMenu.description && (
              <p className={styles.menuDescription}>{currentMenu.description}</p>
            )}
          </motion.div>

          {/* Navigation Arrows */}
          {currentIndex > 0 && (
            <button className={`${styles.navButton} ${styles.prevButton}`} onClick={handlePrev}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M15 18L9 12L15 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
          {currentIndex < menus.length - 1 && (
            <button className={`${styles.navButton} ${styles.nextButton}`} onClick={handleNext}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M9 18L15 12L9 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}

          {/* Indicator Dots */}
          <div className={styles.indicators}>
            {menus.map((_, index) => (
              <div
                key={index}
                className={`${styles.indicator} ${index === currentIndex ? styles.active : ''}`}
                onClick={() => setCurrentIndex(index)}
              />
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
