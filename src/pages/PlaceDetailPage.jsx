import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import styles from '@/styles/pages/place-detail-page.module.css';
import PlaceDetailSkeleton from '@/components/ui/skeletons/PlaceDetailSkeleton';
import ErrorMessage from '@/components/ui/alerts/ErrorMessage';
import { activityService, placeService, bookmarkService } from '@/services/apiService';
import { useAuth } from '@/contexts/AuthContext';
import { buildImageUrl, buildImageUrlList, normalizePlaceImages } from '@/utils/image';
import MenuFullscreenModal from '@/components/ui/modals/MenuFullscreenModal';
import ShareModal from '@/components/ui/modals/ShareModal';

// ============================================
// CONFIGURATION
// ============================================
const SHOW_HEADER_TITLE = false; // Set to true to show place name in sticky header
const BASE_HERO_HEIGHT = 420; // Base hero image height in pixels (excluding safe area)
const HEADER_HEIGHT = 56; // Sticky header height (excluding safe area)

const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}.${month}.${day}`;
};

const parseMarkdown = (text) => {
  const parts = [];
  let currentIndex = 0;
  let key = 0;
  const boldRegex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)/g;
  let match;

  while ((match = boldRegex.exec(text)) !== null) {
    if (match.index > currentIndex) {
      parts.push(text.slice(currentIndex, match.index));
    }
    const boldText = match[2] || match[4];
    parts.push(<strong key={key++}>{boldText}</strong>);
    currentIndex = match.index + match[0].length;
  }

  if (currentIndex < text.length) {
    parts.push(text.slice(currentIndex));
  }

  return parts.length > 0 ? parts : text;
};

export default function PlaceDetailPage({ place = null }) {
  const { t } = useTranslation();
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  // Memoize preloaded data to prevent infinite loops
  const hasPreloadedData = Boolean(location.state?.preloadedData);

  const [placeData, setPlaceData] = useState(() => {
    if (place) return normalizePlaceImages(place);
    if (location.state?.preloadedData) {
      const preloaded = normalizePlaceImages(location.state.preloadedData);
      let validDescription = null;
      if (preloaded.description?.length > 10 && preloaded.description !== preloaded.category) {
        validDescription = preloaded.description;
      } else if (preloaded.reasonWhy?.length > 10 && preloaded.reasonWhy !== preloaded.category) {
        validDescription = preloaded.reasonWhy;
      }
      return {
        ...preloaded,
        description: validDescription,
        address: preloaded.address || preloaded.location,
        location: preloaded.address || preloaded.location,
        name: preloaded.title || preloaded.name,
        // Ensure images array is properly set
        images: preloaded.images || (preloaded.image ? [preloaded.image] : null) ||
                (preloaded.imageUrl ? [preloaded.imageUrl] : null)
      };
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState(!place && !hasPreloadedData);
  const [error, setError] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [menus, setMenus] = useState([]);
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);
  const [selectedMenuIndex, setSelectedMenuIndex] = useState(0);
  const [showReviewsFullView, setShowReviewsFullView] = useState(false);
  const [focusedReviewId, setFocusedReviewId] = useState(null);
  const [showHoursSheet, setShowHoursSheet] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const modalContentRef = useRef(null);

  // Image slider refs
  const heroRef = useRef(null);
  const imageSliderRef = useRef(null);

  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isBookmarkLoading, setIsBookmarkLoading] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [maxVisibleMenus, setMaxVisibleMenus] = useState(5);
  const menuGalleryRef = useRef(null);

  // Scroll state - pure scroll position, no velocity/acceleration
  const [scrollTop, setScrollTop] = useState(0);
  const [portalContainer, setPortalContainer] = useState(null);
  const [safeAreaTop, setSafeAreaTop] = useState(0);

  // Get safe area inset on mount
  useEffect(() => {
    const updateSafeArea = () => {
      // Try to get safe area from CSS custom property --sat
      const satValue = getComputedStyle(document.documentElement).getPropertyValue('--sat').trim();
      if (satValue && satValue !== '0px') {
        const parsed = parseInt(satValue, 10);
        if (!isNaN(parsed) && parsed > 0) {
          setSafeAreaTop(parsed);
          return;
        }
      }
      // Fallback: check if Capacitor/iOS and estimate
      if (window.Capacitor?.isNativePlatform?.() || /iPhone|iPad/.test(navigator.userAgent)) {
        // Estimate safe area for iOS devices with notch (iPhone X and later)
        const isNotchDevice = window.screen.height >= 812 || window.screen.width >= 812;
        setSafeAreaTop(isNotchDevice ? 47 : 20);
      }
    };
    // Delay initial read to ensure CSS is applied
    const timer = setTimeout(updateSafeArea, 100);
    window.addEventListener('resize', updateSafeArea);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateSafeArea);
    };
  }, []);

  // Initialize portal container for fixed elements
  useEffect(() => {
    setPortalContainer(document.body);
    return () => {
      const portalElements = document.querySelectorAll('[data-place-detail-portal]');
      portalElements.forEach(el => el.remove());
    };
  }, []);

  // Simple scroll listener - NO custom physics, just read scrollTop
  // Uses location.pathname to find the correct container during page transitions
  useEffect(() => {
    const findScrollParent = () => {
      // During page transitions, multiple containers may exist
      // Find the one that matches the current route
      const currentRoute = location.pathname;
      const matchingContainer = document.querySelector(`[data-page-container][data-route="${currentRoute}"]`);
      if (matchingContainer) return matchingContainer;

      // Fallback: find any container with /place/ in its route
      const placeContainers = document.querySelectorAll('[data-page-container]');
      for (const container of placeContainers) {
        const route = container.getAttribute('data-route');
        if (route && route.startsWith('/place/')) {
          return container;
        }
      }

      // Last fallback
      return document.querySelector('[data-page-container]');
    };

    // Small delay to ensure the correct container is mounted during transitions
    const timer = setTimeout(() => {
      const scrollParent = findScrollParent();
      if (!scrollParent) return;

      const handleScroll = () => {
        // Just read the scroll position - no manipulation
        setScrollTop(scrollParent.scrollTop);
      };

      // Reset scroll to top for this page
      scrollParent.scrollTop = 0;
      setScrollTop(0);

      handleScroll();
      scrollParent.addEventListener('scroll', handleScroll, { passive: true });

      // Store cleanup function
      const cleanup = () => scrollParent.removeEventListener('scroll', handleScroll);
      scrollParent._placeDetailCleanup = cleanup;
    }, 50);

    return () => {
      clearTimeout(timer);
      // Clean up scroll listener from any container
      const containers = document.querySelectorAll('[data-page-container]');
      containers.forEach(container => {
        if (container._placeDetailCleanup) {
          container._placeDetailCleanup();
          delete container._placeDetailCleanup;
        }
      });
    };
  }, [location.pathname]);

  // ============================================
  // SCROLL-DRIVEN VISUAL STATES
  // Airbnb model: overlay covers image, then header takes over
  // CRITICAL: Only ONE white surface visible at any time to prevent double-white
  // ============================================

  // Dynamic hero height including safe area
  const HERO_HEIGHT = BASE_HERO_HEIGHT + safeAreaTop;
  const ATTACHMENT_SCROLL = HERO_HEIGHT - HEADER_HEIGHT;

  // Clamp scroll to hero region for visual calculations
  const heroScroll = Math.min(Math.max(0, scrollTop), HERO_HEIGHT);

  // Progress from 0 (top) to 1 (hero fully scrolled)
  const scrollProgress = heroScroll / HERO_HEIGHT;

  // Progress relative to attachment point (when bottom sheet meets header)
  const attachmentProgress = Math.min(1, heroScroll / ATTACHMENT_SCROLL);

  // HANDOFF POINT: When overlay reaches full opacity and header starts fading in
  // Overlay stays at 1 to keep image covered - it never fades out
  // Header fades in on TOP of the overlay (header is z-index 9999)
  // Higher value = image becomes white later (closer to header)
  const HANDOFF = 0.9;

  // Overlay: fades in from 0→1, then STAYS at 1 (never reveals image)
  const overlayOpacity = Math.min(1, attachmentProgress / HANDOFF);

  // Header: starts fading in at handoff point, on top of the overlay
  // Since header is above overlay in z-index, no double-white issue
  const headerBgOpacity = attachmentProgress > HANDOFF
    ? (attachmentProgress - HANDOFF) / (1 - HANDOFF)
    : 0;

  // Action buttons shadow: fades out as header becomes solid
  // When header is white, buttons don't need shadow anymore
  const buttonShadowOpacity = 1 - headerBgOpacity;

  // Hero image opacity: fades as overlay covers it
  const heroImageOpacity = Math.max(0, 1 - attachmentProgress);

  // Image indicators: fade out as overlay covers the image
  const indicatorOpacity = Math.max(0, 1 - attachmentProgress * 1.5);

  // After hero is fully scrolled, hero section is hidden
  const isHeroHidden = scrollProgress >= 1;

  useEffect(() => {
    const loadPlaceDetail = async () => {
      try {
        // Skip if place prop is provided (already set in initial state)
        if (place) return;

        if (!id) {
          setError(t('places.detail.errors.idRequired'));
          setIsLoading(false);
          return;
        }

        // Fetch full data from API (even if we have preloaded data for instant display)
        const response = await placeService.getPlaceById(id);
        if (response.success && response.data.place) {
          const normalizedPlace = normalizePlaceImages(response.data.place);
          setPlaceData(normalizedPlace);

          if (response.data.reviews?.length > 0) {
            setReviews(response.data.reviews);
          }

          try {
            const menusResponse = await placeService.getPlaceMenus(id);
            if (menusResponse.success && menusResponse.data) {
              setMenus(menusResponse.data.menus || []);
            }
          } catch (err) {
            console.warn('Failed to load menus:', err);
          }

          if (isAuthenticated) {
            try {
              await activityService.recordRecentView(id);
            } catch (err) {
              console.warn('Failed to record recent view:', err);
            }
          }
        } else if (!hasPreloadedData) {
          setError(t('places.detail.errors.notFound'));
        }
      } catch (err) {
        console.error('Failed to load place details:', err);
        if (!hasPreloadedData) {
          setError(t('places.detail.errors.loadFailed'));
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadPlaceDetail();
  }, [id, place, t, isAuthenticated]);

  useEffect(() => {
    const checkBookmarkStatus = async () => {
      if (!id || !isAuthenticated) return;
      try {
        // Use direct bookmark check API for this specific place
        const response = await bookmarkService.isBookmarked(id);
        if (response.success) {
          setIsBookmarked(response.data?.isBookmarked || false);
        }
      } catch (err) {
        console.warn('Failed to check bookmark status:', err);
        setIsBookmarked(false);
      }
    };
    checkBookmarkStatus();
  }, [id, isAuthenticated]);

  const calculateMaxMenus = useCallback(() => {
    if (!menuGalleryRef.current) return;
    const containerWidth = menuGalleryRef.current.offsetWidth;
    const minItemWidth = 60; // Minimum width per item
    const gap = 8;
    const maxItems = Math.floor((containerWidth + gap) / (minItemWidth + gap));
    setMaxVisibleMenus(Math.max(3, Math.min(5, maxItems)));
  }, []);

  useEffect(() => {
    // Delay calculation to ensure ref is mounted
    const timer = setTimeout(calculateMaxMenus, 100);
    window.addEventListener('resize', calculateMaxMenus);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', calculateMaxMenus);
    };
  }, [calculateMaxMenus, menus]);

  const handleToggleBookmark = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) {
      navigate('/login', { state: { from: `/place/${id}` } });
      return;
    }
    if (isBookmarkLoading) return;

    setIsBookmarkLoading(true);
    try {
      if (isBookmarked) {
        await bookmarkService.removeBookmark(id);
        setIsBookmarked(false);
      } else {
        await bookmarkService.addBookmark(id);
        setIsBookmarked(true);
      }
    } catch (err) {
      console.error('Failed to toggle bookmark:', err);
    } finally {
      setIsBookmarkLoading(false);
    }
  };

  const handleShare = () => {
    setIsShareModalOpen(true);
  };

  // Image slider scroll handler - update current index based on scroll position
  const handleImageSliderScroll = useCallback((e) => {
    const slider = e.target;
    const scrollLeft = slider.scrollLeft;
    const itemWidth = slider.offsetWidth;
    const newIndex = Math.round(scrollLeft / itemWidth);
    if (newIndex !== currentImageIndex) {
      setCurrentImageIndex(newIndex);
    }
  }, [currentImageIndex]);

  // Scroll to specific image when indicator is clicked
  const scrollToImage = useCallback((index) => {
    if (imageSliderRef.current) {
      const itemWidth = imageSliderRef.current.offsetWidth;
      imageSliderRef.current.scrollTo({
        left: index * itemWidth,
        behavior: 'smooth'
      });
    }
  }, []);

  if (isLoading) return <PlaceDetailSkeleton />;

  if (error || !placeData) {
    return (
      <div className={styles.errorContainer}>
        <ErrorMessage message={error || t('places.detail.errors.notFound')} />
      </div>
    );
  }

  const defaultImages = [
    'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=440&h=563&fit=crop&crop=center',
  ];

  const candidateImages = placeData.images?.length
    ? placeData.images
    : placeData.gallery?.length
      ? buildImageUrlList(placeData.gallery)
      : [];

  const images = candidateImages.length ? candidateImages : defaultImages;

  // Fixed elements rendered via portal to escape Framer Motion's transform
  const fixedElements = portalContainer && createPortal(
    <>
      {/* LAYER 1: Fixed Action Buttons */}
      <div className={styles.fixedActionsLayer} data-place-detail-portal>
        <button
          className={styles.actionButton}
          onClick={() => navigate(-1)}
          aria-label="뒤로 가기"
          style={{ boxShadow: `0 2px 8px rgba(0, 0, 0, ${0.12 * buttonShadowOpacity})` }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className={styles.actionButtonsRight}>
          <button
            type="button"
            className={styles.actionButton}
            onClick={handleShare}
            aria-label="공유하기"
            style={{ boxShadow: `0 2px 8px rgba(0, 0, 0, ${0.12 * buttonShadowOpacity})` }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M4 12V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="16,6 12,2 8,6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="12" y1="2" x2="12" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button
            type="button"
            className={`${styles.actionButton} ${isBookmarked ? styles.bookmarked : ''}`}
            onClick={handleToggleBookmark}
            disabled={isBookmarkLoading}
            aria-label={isBookmarked ? '북마크 해제' : '북마크'}
            style={{ boxShadow: `0 2px 8px rgba(0, 0, 0, ${0.12 * buttonShadowOpacity})` }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M19 21L12 16L5 21V5C5 4.46957 5.21071 3.96086 5.58579 3.58579C5.96086 3.21071 6.46957 3 7 3H17C17.5304 3 18.0391 3.21071 18.4142 3.58579C18.7893 3.96086 19 4.46957 19 5V21Z"
                stroke={isBookmarked ? '#FF385C' : '#222222'}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill={isBookmarked ? '#FF385C' : 'none'}
              />
            </svg>
          </button>
        </div>
      </div>

      {/* LAYER 2: Sticky Header - background transitions from transparent to white */}
      <div
        className={styles.stickyHeader}
        data-place-detail-portal
        style={{
          background: `rgba(255, 255, 255, ${headerBgOpacity})`,
          borderBottomColor: `rgba(240, 240, 240, ${headerBgOpacity})`,
        }}
      >
        <div
          className={styles.stickyHeaderContent}
          style={{ opacity: headerBgOpacity > 0.5 ? 1 : 0 }}
        >
          {SHOW_HEADER_TITLE && (
            <span className={styles.stickyHeaderTitle}>{placeData.name || placeData.title}</span>
          )}
        </div>
      </div>
    </>,
    portalContainer
  );

  return (
    <div className={styles.pageContainer}>
      {fixedElements}

      {/* HERO SECTION - Fixed position, content scrolls over it */}
      <div
        ref={heroRef}
        className={styles.heroSection}
        style={{
          opacity: isHeroHidden ? 0 : 1,
          visibility: isHeroHidden ? 'hidden' : 'visible',
        }}
      >
        {/* Horizontal scrollable image slider */}
        <div
          ref={imageSliderRef}
          className={styles.imageSlider}
          onScroll={handleImageSliderScroll}
        >
          {images.map((imgSrc, i) => (
            <div key={i} className={styles.imageSlide}>
              <img
                src={imgSrc}
                alt={`${placeData.name || placeData.title} ${i + 1}`}
                className={styles.heroImage}
                style={{ opacity: heroImageOpacity }}
                draggable={false}
                onError={(e) => {
                  e.target.style.background = '#ccc';
                }}
              />
            </div>
          ))}
        </div>

        {/* White overlay - fades in as you scroll */}
        <div
          className={styles.whiteOverlay}
          style={{ opacity: overlayOpacity }}
        />

        {/* Image indicators */}
        {images.length > 1 && (
          <div
            className={styles.imageDots}
            style={{ opacity: indicatorOpacity }}
          >
            {images.map((_, i) => (
              <button
                key={i}
                className={`${styles.imageDot} ${i === currentImageIndex ? styles.activeDot : ''}`}
                onClick={() => scrollToImage(i)}
                aria-label={`Image ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* CONTENT SECTION - Scrolls naturally over the hero */}
      <div className={styles.contentSection}>
        {placeData.tags?.length > 0 && (
          <div className={styles.tags}>
            {placeData.tags.map((tag, i) => (
              <span key={i} className={styles.tag}>#{tag}</span>
            ))}
          </div>
        )}

        <div className={styles.titleRow}>
          <h1 className={styles.title}>{placeData.name || placeData.title}</h1>
          <div className={styles.rating}>
            <svg width="14" height="14" viewBox="0 0 14 13" fill="none">
              <path d="M6.04914 0.927051C6.21045 0.429825 6.91123 0.429825 7.07254 0.927051L8.25254 4.57354C8.32461 4.79648 8.53119 4.94755 8.76531 4.94755H12.5832C13.1047 4.94755 13.3214 5.61782 12.8997 5.92484L9.81085 8.17764C9.62207 8.31511 9.54258 8.55947 9.61465 8.78241L10.7947 12.4289C10.956 12.9261 10.3841 13.3409 9.96241 13.0339L6.87355 10.7811C6.68478 10.6436 6.4369 10.6436 6.24813 10.7811L3.15927 13.0339C2.7376 13.3409 2.16566 12.9261 2.32697 12.4289L3.50697 8.78241C3.57904 8.55947 3.49955 8.31511 3.31078 8.17764L0.221913 5.92484C-0.199755 5.61782 0.0169654 4.94755 0.538474 4.94755H4.35637C4.59049 4.94755 4.79707 4.79648 4.86914 4.57354L6.04914 0.927051Z" fill="#FFD336"/>
            </svg>
            <span>{Number(placeData.rating).toFixed(1)}</span>
            <span className={styles.reviewCount}>({placeData.reviewCount || placeData.userRatingsTotal || 0})</span>
          </div>
        </div>

        <div className={styles.placeSubInfo}>
          <div className={styles.location}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="7.33325" r="2" stroke="#7D848D" strokeWidth="1.5"/>
              <path d="M14 7.25918C14 10.532 10.25 14.6666 8 14.6666C5.75 14.6666 2 10.532 2 7.25918C2 3.98638 4.68629 1.33325 8 1.33325C11.3137 1.33325 14 3.98638 14 7.25918Z" stroke="#7D848D" strokeWidth="1.5"/>
            </svg>
            <span>{placeData.location || placeData.address}</span>
          </div>
          {placeData.businessHours?.length > 0 && (() => {
            const koDays = ['일','월','화','수','목','금','토'];
            const today = koDays[new Date().getDay()];
            const todayHours = placeData.businessHours.find(h => h.day === today);
            const now = new Date();
            const nowStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
            const isOpen = todayHours?.open && todayHours?.close && nowStr >= todayHours.open && nowStr <= todayHours.close;

            return (
              <button className={styles.hoursChip} onClick={() => setShowHoursSheet(true)}>
                <span className={styles.hoursDot} style={{background: isOpen ? '#16a34a' : '#dc2626'}} />
                <span className={styles.hoursChipText}>{isOpen ? '영업 중' : '영업 종료'}</span>
                {todayHours?.open && <span className={styles.hoursChipTime}>{todayHours.open} - {todayHours.close}</span>}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                  <path d="M6 9l6 6 6-6" stroke="#bbb" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
              </button>
            );
          })()}
        </div>

        {/* Menu Gallery */}
        {(() => {
          const menusWithImages = menus.filter(m => m.imagePath);
          const totalMenuImages = menusWithImages.length;

          if (totalMenuImages === 0) return null;

          const shouldShowMoreButton = totalMenuImages > maxVisibleMenus;
          const visibleCount = shouldShowMoreButton ? maxVisibleMenus - 1 : Math.min(totalMenuImages, maxVisibleMenus);
          const displayMenus = menusWithImages.slice(0, visibleCount);

          return (
            <div className={styles.menuGallery} ref={menuGalleryRef}>
              <h3 className={styles.menuGalleryTitle}>메뉴</h3>
              <div className={styles.menuGalleryItems}>
                {displayMenus.map((menu, index) => (
                  <div
                    key={menu.id || index}
                    className={styles.menuGalleryItem}
                    onClick={() => { setSelectedMenuIndex(index); setIsMenuModalOpen(true); }}
                  >
                    <img
                      src={buildImageUrl(menu.imagePath)}
                      alt={menu.name || `메뉴 ${index + 1}`}
                      className={styles.menuGalleryImage}
                      draggable={false}
                    />
                    {menu.name && (
                      <span className={styles.menuName}>{menu.name}</span>
                    )}
                  </div>
                ))}
                {shouldShowMoreButton && (
                  <div
                    className={styles.menuGalleryItem}
                    onClick={() => navigate(`/place/${id}/menu`, { state: { menus: menusWithImages, placeName: placeData.name } })}
                  >
                    <div className={styles.menuMoreButton}>
                      <img
                        src={buildImageUrl(menusWithImages[visibleCount]?.imagePath)}
                        alt=""
                        className={styles.menuMoreButtonBg}
                        draggable={false}
                      />
                      <div className={styles.menuMoreButtonOverlay}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M12 5V19M5 12H19" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    </div>
                    <span className={styles.menuName}>더보기</span>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* AI Note */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Mohe AI 노트</h2>
          <p className={styles.sectionSub}>리뷰와 데이터를 읽고 AI가 정리했어요</p>
          <div className={styles.description}>
            {placeData.description?.length > 10 ? (
              placeData.description.split('\n').map((line, i) => (
                <span key={i}>{parseMarkdown(line)}{i < placeData.description.split('\n').length - 1 && <br />}</span>
              ))
            ) : (
              <p className={styles.placeholder}>리뷰를 작성하면 Mohe가 리뷰를 기반으로 장소 설명을 생성해요</p>
            )}
          </div>
        </div>

        {/* Reviews */}
        <div className={styles.section}>
          <div className={styles.reviewHeader}>
            <h2 className={styles.sectionTitle}>리뷰 <span className={styles.reviewCount}>{reviews.length}개</span></h2>
            <button className={styles.writeBtn} onClick={() => navigate(isAuthenticated ? `/place/${id}/review/write` : '/login', { state: { from: `/place/${id}/review/write` } })}>
              리뷰 쓰기
            </button>
          </div>
          <div className={styles.reviewList}>
            {reviews.length > 0 ? reviews.map((review) => (
              <div
                key={review.id}
                className={styles.reviewCard}
                onClick={() => {
                  setFocusedReviewId(review.id);
                  setShowReviewsFullView(true);
                }}
                style={{ cursor: 'pointer' }}
              >
                <p>{review.reviewText}</p>
                <div className={styles.reviewFooter}>
                  <span>{review.authorName || review.nickname || '익명'}</span>
                  <span>{formatDate(review.createdAt)}</span>
                </div>
              </div>
            )) : (
              <div className={styles.reviewCard}>
                <p>아직 리뷰가 없어요. 첫 번째 리뷰를 남겨보세요!</p>
              </div>
            )}
          </div>
          {reviews.length > 0 && (
            <button className={styles.viewAllBtn} onClick={() => setShowReviewsFullView(true)}>
              리뷰 모두 보기
            </button>
          )}
        </div>
      </div>

      {/* Reviews Full View Modal - rendered via portal */}
      {portalContainer && createPortal(
        <AnimatePresence>
          {showReviewsFullView && (
            <motion.div
              className={styles.modal}
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.25 }}
              data-place-detail-portal
              onAnimationComplete={() => {
                // Scroll to focused review after animation completes
                if (focusedReviewId && modalContentRef.current) {
                  const reviewElement = modalContentRef.current.querySelector(`[data-review-id="${focusedReviewId}"]`);
                  if (reviewElement) {
                    reviewElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }
                  // Clear focus after 1.5 seconds
                  setTimeout(() => {
                    setFocusedReviewId(null);
                  }, 1500);
                }
              }}
            >
              <div className={styles.modalHeader}>
                <button onClick={() => { setShowReviewsFullView(false); setFocusedReviewId(null); }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M15 18L9 12L15 6" stroke="#1B1E28" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <h2>리뷰 {reviews.length}개</h2>
                <div style={{ width: 40 }} />
              </div>
              <div className={styles.modalContent} ref={modalContentRef}>
                {reviews.map((review) => (
                  <div
                    key={review.id}
                    data-review-id={review.id}
                    className={`${styles.reviewCard} ${focusedReviewId === review.id ? styles.reviewCardFocused : ''}`}
                  >
                    <p>{review.reviewText}</p>
                    <div className={styles.reviewFooter}>
                      <span>{review.authorName || review.nickname || '익명'}</span>
                      <span>{formatDate(review.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        portalContainer
      )}

      {/* Menu Modal */}
      <MenuFullscreenModal
        isOpen={isMenuModalOpen}
        onClose={() => setIsMenuModalOpen(false)}
        menus={menus.filter(m => m.imagePath)}
        initialIndex={selectedMenuIndex}
      />

      {/* Share Modal */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        title={placeData?.name || placeData?.title || 'Mohe'}
        description={`${placeData?.name || placeData?.title} - Mohe에서 발견한 장소`}
        url={window.location.href}
        imageUrl={images[0]}
      />

      {/* Business Hours Bottom Sheet — Portal로 body에 직접 렌더 */}
      {showHoursSheet && placeData.businessHours?.length > 0 && createPortal(
        <>
          <div className={styles.sheetOverlay} onClick={() => setShowHoursSheet(false)} />
          <div className={styles.hoursSheet}>
            <div className={styles.sheetHandle} />
            <h3 className={styles.sheetTitle}>영업시간</h3>
            <div className={styles.hoursList}>
              {['월','화','수','목','금','토','일'].map(day => {
                const h = placeData.businessHours.find(bh => bh.day === day);
                const koDays = ['일','월','화','수','목','금','토'];
                const isToday = day === koDays[new Date().getDay()];
                if (!h) return (
                  <div key={day} className={`${styles.hoursRow} ${isToday ? styles.hoursToday : ''}`}>
                    <span className={styles.hoursDay}>{day}</span>
                    <span className={styles.hoursValue}>정보 없음</span>
                  </div>
                );
                const isClosed = h.description?.includes('휴무') || (!h.open && !h.close);
                return (
                  <div key={day} className={`${styles.hoursRow} ${isToday ? styles.hoursToday : ''}`}>
                    <span className={styles.hoursDay}>{day}{isToday ? ' (오늘)' : ''}</span>
                    <span className={`${styles.hoursValue} ${isClosed ? styles.hoursClosedText : ''}`}>
                      {isClosed ? (h.description || '휴무') : `${h.open || '?'} - ${h.close || '?'}`}
                    </span>
                    {h.lastOrderMinutes && (
                      <span className={styles.hoursLastOrder}>L.O {h.lastOrderMinutes}분 전</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
