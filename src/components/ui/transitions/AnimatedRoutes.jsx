import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Routes, Route, useLocation, useNavigationType, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useMotionValue, useTransform } from 'framer-motion';
import { initializeDeepLinkListener } from '@/utils/capacitorDeepLink';

// Global scroll position store
const scrollPositions = new Map();

import { ProtectedRoute } from '@/components/auth';
import AuthPage from '@/pages/auth/index.jsx';
import LoginPage from '@/pages/auth/LoginPage.jsx';
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage.jsx';
import EmailSignupPage from '@/pages/auth/EmailSignupPage.jsx';
import EmailVerificationPage from '@/pages/auth/EmailVerificationPage.jsx';
import NicknameSetupPage from '@/pages/auth/NicknameSetupPage.jsx';
import TermsAgreementPage from '@/pages/auth/TermsAgreementPage.jsx';
import PasswordSetupPage from '@/pages/auth/PasswordSetupPage.jsx';
import OAuthCallbackPage from '@/pages/auth/OAuthCallbackPage.jsx';
import HomePage from '@/pages/HomePage.jsx';
import PlacesListPage from '@/pages/PlacesListPage.jsx';
import PlaceDetailPage from '@/pages/PlaceDetailPage.jsx';
import ProfileSettingsPage from '@/pages/ProfileSettingsPage.jsx';
import ProfileEditPage from '@/pages/ProfileEditPage.jsx';
import AgeRangeSelectionPage from '@/pages/AgeRangeSelectionPage.jsx';
import MBTISelectionPage from '@/pages/MBTISelectionPage.jsx';
import MBTIEditPage from '@/pages/MBTIEditPage.jsx';
import SpacePreferenceSelectionPage from '@/pages/SpacePreferenceSelectionPage.jsx';
import TransportationSelectionPage from '@/pages/TransportationSelectionPage.jsx';
import HelloPage from '@/pages/HelloPage.jsx';
import BookmarksPage from '@/pages/BookmarksPage.jsx';
import MyPlacesPage from '@/pages/MyPlacesPage.jsx';
import RecentViewPage from '@/pages/RecentViewPage.jsx';
import SearchResultsPage from '@/pages/SearchResultsPage.jsx';
import ImageTestPage from '@/pages/ImageTestPage.jsx';
import WriteReviewPage from '@/pages/WriteReviewPage.jsx';
import MenuListPage from '@/pages/MenuListPage.jsx';
import LocationTestPage from '@/pages/LocationTestPage.jsx';

// Navigation flow hierarchy (lower = earlier in flow)
const ROUTE_HIERARCHY = {
  '/': 0,
  '/login': 1,
  '/forgot-password': 2,
  '/signup': 1,
  '/verify-email': 2,
  '/nickname-setup': 3,
  '/terms': 4,
  '/password-setup': 5,
  '/age-range': 6,
  '/mbti-selection': 7,
  '/space-preference': 8,
  '/transportation-selection': 9,
  '/hello': 10,
  '/home': 11,
  '/profile-settings': 12,
  '/profile-edit': 13,
  '/mbti-edit': 13,
  '/bookmarks': 13,
  '/my-places': 13,
  '/recent-view': 13,
  '/places': 14,
  '/search-results': 14,
  '/place': 15,
  '/menu': 16,
  '/review/write': 17,
  '/image-test': 18,
};

// Routes that only render standalone auth/onboarding screens.
const AUTH_ROUTES = new Set([
  '/',
  '/login',
  '/forgot-password',
  '/signup',
  '/verify-email',
  '/nickname-setup',
  '/terms',
  '/password-setup'
]);

// Routes where swipe back should be disabled (root level pages)
const NO_SWIPE_BACK_ROUTES = new Set([
  '/',
  '/login',
  '/home',
  '/hello',
]);

export default function AnimatedRoutes() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const navigate = useNavigate();
  const prevLocation = useRef(location.pathname);
  const currentContainerRef = useRef(null);

  // Swipe back gesture state
  const [isDragging, setIsDragging] = useState(false);
  const dragX = useMotionValue(0);
  const dragOpacity = useTransform(dragX, [0, 150], [0, 0.3]);

  // Touch tracking for edge swipe
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchStartTime = useRef(0);
  const isEdgeSwipe = useRef(false);
  const swipeThreshold = 80; // Minimum swipe distance to trigger back
  const edgeWidth = 40; // Width of edge detection zone (px)

  // Check if swipe back is allowed for current route
  const canSwipeBack = !NO_SWIPE_BACK_ROUTES.has(location.pathname);

  // Handle touch start - detect edge swipe
  const handleTouchStart = useCallback((e) => {
    if (!canSwipeBack) return;

    const touch = e.touches[0];
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
    touchStartTime.current = Date.now();

    // Only trigger edge swipe if touch starts within edge zone
    if (touch.clientX <= edgeWidth) {
      isEdgeSwipe.current = true;
      setIsDragging(true);
    } else {
      isEdgeSwipe.current = false;
    }
  }, [canSwipeBack]);

  // Handle touch move - track swipe progress
  const handleTouchMove = useCallback((e) => {
    if (!isEdgeSwipe.current || !canSwipeBack) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartX.current;
    const deltaY = Math.abs(touch.clientY - touchStartY.current);

    // If vertical movement is greater, cancel the swipe (user is scrolling)
    if (deltaY > Math.abs(deltaX) && deltaX < 30) {
      isEdgeSwipe.current = false;
      setIsDragging(false);
      dragX.set(0);
      return;
    }

    // Only allow right swipe (positive deltaX)
    if (deltaX > 0) {
      dragX.set(deltaX);
    }
  }, [canSwipeBack, dragX]);

  // Handle touch end - trigger navigation if threshold met
  const handleTouchEnd = useCallback(() => {
    if (!isEdgeSwipe.current || !canSwipeBack) {
      isEdgeSwipe.current = false;
      setIsDragging(false);
      dragX.set(0);
      return;
    }

    const currentDragX = dragX.get();
    const elapsed = Date.now() - touchStartTime.current;
    const velocity = currentDragX / (elapsed || 1); // px/ms

    if (currentDragX >= swipeThreshold || (velocity > 0.5 && currentDragX > 30)) {
      // Trigger back navigation
      navigate(-1);
    }

    // Reset state
    isEdgeSwipe.current = false;
    setIsDragging(false);
    dragX.set(0);
  }, [canSwipeBack, dragX, navigate, swipeThreshold]);

  // Initialize deep link listener for Capacitor
  useEffect(() => {
    initializeDeepLinkListener(navigate);
  }, [navigate]);

  // Determine slide direction based on browser navigation action
  const getSlideDirection = () => {
    // Use browser navigation type first (handles back/forward buttons)
    if (navigationType === 'POP') {
      // Browser back/forward was used - determine direction from hierarchy
      const getCurrentLevel = (path) => {
        if (path.includes('/review/write')) return ROUTE_HIERARCHY['/review/write'];
        if (path.includes('/menu')) return ROUTE_HIERARCHY['/menu'];
        if (path.startsWith('/place/')) return ROUTE_HIERARCHY['/place'];
        return ROUTE_HIERARCHY[path] || 0;
      };

      const currentLevel = getCurrentLevel(location.pathname);
      const prevLevel = getCurrentLevel(prevLocation.current);

      // If going to lower level, it's backward navigation
      return currentLevel < prevLevel ? 'backward' : 'forward';
    }

    // For PUSH/REPLACE navigation (programmatic navigation)
    // Handle dynamic routes like /place/:id
    const getCurrentLevel = (path) => {
      if (path.includes('/review/write')) return ROUTE_HIERARCHY['/review/write'];
      if (path.includes('/menu')) return ROUTE_HIERARCHY['/menu'];
      if (path.startsWith('/place/')) return ROUTE_HIERARCHY['/place'];
      return ROUTE_HIERARCHY[path] || 0;
    };

    const currentLevel = getCurrentLevel(location.pathname);
    const prevLevel = getCurrentLevel(prevLocation.current);

    // If going to a higher level (forward), slide left
    // If going to a lower level (back), slide right
    return currentLevel > prevLevel ? 'forward' : 'backward';
  };

  const slideDirection = getSlideDirection();
  
  useEffect(() => {
    // Save scroll position when route changes
    if (prevLocation.current !== location.pathname) {
      // Find the previous route container and save its scroll position
      const containers = document.querySelectorAll('[data-page-container]');
      containers.forEach(container => {
        if (container.getAttribute('data-route') === prevLocation.current) {
          const scrollTop = container.scrollTop;
          scrollPositions.set(prevLocation.current, scrollTop);
        }
      });
      prevLocation.current = location.pathname;
    }
    
    // Disable browser scroll restoration
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
  }, [location.pathname]);

  // Handle scroll tracking for current page
  const handleScroll = useCallback((event) => {
    const scrollTop = event.target.scrollTop;
    scrollPositions.set(location.pathname, scrollTop);
  }, [location.pathname]);

  // Handle immediate scroll restoration when page mounts
  const containerRef = useCallback((node) => {
    if (node) {
      // Restore scroll position immediately when container is created
      const savedPosition = scrollPositions.get(location.pathname) || 0;
      if (savedPosition > 0) {
        // Set scroll position immediately without animation
        node.scrollTop = savedPosition;
      }
    }
  }, [location.pathname]);

  // Disable animation for browser back/forward to avoid conflict with native swipe gestures
  const shouldAnimate = navigationType !== 'POP';

  const slideVariants = {
    initial: (direction) => ({
      x: shouldAnimate ? (direction === 'forward' ? '100%' : '-100%') : 0,
      opacity: 1,
      zIndex: 1
    }),
    animate: {
      x: 0,
      opacity: 1,
      zIndex: 2
    },
    exit: (direction) => ({
      x: shouldAnimate ? (direction === 'forward' ? '-100%' : '100%') : 0,
      opacity: 1,
      zIndex: 0
    })
  };

  const isAuthRoute = AUTH_ROUTES.has(location.pathname);
  const shellPaddingBottom = 'var(--app-shell-safe-bottom, 0px)';

  return (
    <div
      style={{
        position: 'relative',
        flex: 1,
        width: '100%',
        minHeight: '100%',
        display: 'flex',
        background: 'transparent',
        overflow: 'hidden'
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Swipe back indicator */}
      {isDragging && canSwipeBack && (
        <motion.div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: '100%',
            background: 'black',
            opacity: dragOpacity,
            zIndex: 9998,
            pointerEvents: 'none'
          }}
        />
      )}

      {/* Edge swipe hint indicator */}
      {isDragging && canSwipeBack && (
        <motion.div
          style={{
            position: 'absolute',
            left: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 4,
            height: 60,
            borderRadius: 2,
            background: 'rgba(0, 0, 0, 0.3)',
            x: dragX,
            zIndex: 9999,
            pointerEvents: 'none'
          }}
        />
      )}

      <AnimatePresence initial={false} custom={slideDirection}>
        <motion.div
          key={location.pathname}
          custom={slideDirection}
          variants={slideVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{
            duration: shouldAnimate ? 0.25 : 0,
            ease: [0.4, 0.0, 0.2, 1], // Material Design easing curve
            type: "tween" // Force tween for better WebView performance
          }}
          data-page-container
          data-route={location.pathname}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            minHeight: '100%',
            background: '#ffffff',
            overflowY: 'auto', // Allow individual pages to scroll
            willChange: 'transform',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            WebkitTransform: 'translate3d(0,0,0)',
            transform: 'translate3d(0,0,0)',
            WebkitOverflowScrolling: 'touch',
            paddingBottom: shellPaddingBottom,
            // Apply drag transform when swiping
            x: isDragging ? dragX : 0
          }}
          ref={containerRef}
          onScroll={handleScroll}
        >
          <Routes location={location}>
            <Route path="/" element={<AuthPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/signup" element={<EmailSignupPage />} />
            <Route path="/verify-email" element={<EmailVerificationPage />} />
            <Route path="/nickname-setup" element={<NicknameSetupPage />} />
            <Route path="/terms" element={<TermsAgreementPage />} />
            <Route path="/password-setup" element={<PasswordSetupPage />} />
            <Route path="/oauth/:provider/callback" element={<OAuthCallbackPage />} />
            <Route path="/home" element={<HomePage />} />
            <Route path="/age-range" element={<AgeRangeSelectionPage />} />
            <Route path="/mbti-selection" element={<MBTISelectionPage />} />
            <Route path="/space-preference" element={<SpacePreferenceSelectionPage />} />
            <Route path="/transportation-selection" element={<TransportationSelectionPage />} />
            <Route path="/hello" element={<HelloPage />} />
            <Route path="/profile-settings" element={<ProfileSettingsPage />} />
            <Route path="/profile-edit" element={<ProfileEditPage />} />
            <Route path="/mbti-edit" element={<MBTIEditPage />} />
            <Route path="/bookmarks" element={<BookmarksPage />} />
            <Route path="/my-places" element={<MyPlacesPage />} />
            <Route path="/recent-view" element={<RecentViewPage />} />
            <Route path="/places" element={<PlacesListPage />} />
            <Route path="/search-results" element={<SearchResultsPage />} />
            <Route path="/place/:id" element={<PlaceDetailPage />} />
            <Route path="/place/:id/menu" element={<MenuListPage />} />
            <Route path="/place/:id/review/write" element={<WriteReviewPage />} />
            <Route path="/image-test" element={<ImageTestPage />} />
            <Route path="/location-test" element={<LocationTestPage />} />
          </Routes>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
