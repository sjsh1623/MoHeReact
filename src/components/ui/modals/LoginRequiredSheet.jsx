import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import styles from '@/styles/components/ui/login-required-sheet.module.css';

export default function LoginRequiredSheet({ visible, onClose, onLogin }) {
  useEffect(() => {
    if (visible) {
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
  }, [visible]);

  return createPortal(
    <AnimatePresence>
      {visible && (
        <>
          <motion.div
            className={styles.overlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            className={styles.sheet}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.32, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <div className={styles.handle} />
            <div className={styles.iconWrap}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="11" width="18" height="11" rx="2" stroke="#6C63FF" strokeWidth="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="#6C63FF" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <h3 className={styles.title}>로그인이 필요해요</h3>
            <p className={styles.desc}>
              이 기능을 이용하려면{'\n'}로그인해주세요
            </p>
            <button className={styles.primary} onClick={onLogin}>
              로그인하기
            </button>
            <button className={styles.secondary} onClick={onClose}>
              나중에
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
