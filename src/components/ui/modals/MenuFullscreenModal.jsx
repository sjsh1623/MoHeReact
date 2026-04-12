import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import styles from '@/styles/components/ui/modals/menu-fullscreen-modal.module.css';
import { buildImageUrl } from '@/utils/image';

export default function MenuFullscreenModal({
  isOpen,
  onClose,
  menus = [],
  initialIndex = 0
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const sheetY = useMotionValue(0);
  const backdropOpacity = useTransform(sheetY, [0, 400], [1, 0]);
  const dragRef = useRef(null);

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex, isOpen]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // 좌우 스와이프
  const [touchStartX, setTouchStartX] = useState(0);

  const handleTouchStart = (e) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e) => {
    const endX = e.changedTouches[0].clientX;
    const diff = touchStartX - endX;
    if (Math.abs(diff) > 50) {
      if (diff > 0 && currentIndex < menus.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else if (diff < 0 && currentIndex > 0) {
        setCurrentIndex(prev => prev - 1);
      }
    }
  };

  const handleDragEnd = (_, info) => {
    if (info.offset.y > 120 || info.velocity.y > 400) {
      animate(sheetY, 800, { duration: 0.25 });
      setTimeout(onClose, 250);
    } else {
      animate(sheetY, 0, { type: 'spring', stiffness: 400, damping: 35 });
    }
  };

  const currentMenu = menus[currentIndex] || null;

  return createPortal(
    <AnimatePresence>
      {isOpen && currentMenu && (
        <>
          {/* Backdrop */}
          <motion.div
            className={styles.backdrop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ opacity: backdropOpacity }}
            onClick={onClose}
          />

          {/* Bottom Sheet */}
          <motion.div
            className={styles.sheet}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 350 }}
            style={{ y: sheetY }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            ref={dragRef}
          >
            {/* Drag Handle */}
            <div className={styles.dragHandle}>
              <div className={styles.dragBar} />
            </div>

            {/* Header */}
            <div className={styles.sheetHeader}>
              <h3 className={styles.sheetTitle}>메뉴</h3>
              <span className={styles.sheetCounter}>{currentIndex + 1} / {menus.length}</span>
            </div>

            {/* Image */}
            <div
              className={styles.imageWrap}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              <AnimatePresence mode="wait">
                <motion.img
                  key={currentIndex}
                  src={buildImageUrl(currentMenu.imagePath)}
                  alt={currentMenu.name || '메뉴'}
                  className={styles.menuImage}
                  draggable={false}
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.2 }}
                />
              </AnimatePresence>
            </div>

            {/* Menu Info */}
            <div className={styles.menuInfo}>
              <h4 className={styles.menuName}>{currentMenu.name || '메뉴'}</h4>
              {currentMenu.price && <span className={styles.menuPrice}>{currentMenu.price}</span>}
              {currentMenu.description && <p className={styles.menuDesc}>{currentMenu.description}</p>}
            </div>

            {/* Dots */}
            {menus.length > 1 && (
              <div className={styles.dots}>
                {menus.map((_, i) => (
                  <div
                    key={i}
                    className={`${styles.dot} ${i === currentIndex ? styles.dotActive : ''}`}
                    onClick={() => setCurrentIndex(i)}
                  />
                ))}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
