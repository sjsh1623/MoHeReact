import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import styles from '@/styles/pages/home-page.module.css';

import PlaceCard from '@/components/ui/cards/PlaceCard';
import LocationPin from '@/components/ui/indicators/LocationPin';
import ProfileButton from '@/components/ui/buttons/ProfileButton';
import OutlineButton from '@/components/ui/buttons/OutlineButton';
import SearchBar from '@/components/ui/inputs/SearchBar';
import SectionSkeleton from '@/components/ui/skeletons/SectionSkeleton';
import ErrorMessage from '@/components/ui/alerts/ErrorMessage';
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed';
import bannerLeft from '@/assets/image/banner_left.png';
import logoHeader from '@/assets/image/logo-header.svg';
import { buildImageUrl } from '@/utils/image';
import { formatPlaceAddress } from '@/utils/addressUtils';
import { HomeSection, HomeHorizontalScroller, HomeBanner } from '@/components/ui/home';
import LoginRequiredSheet from '@/components/ui/modals/LoginRequiredSheet';

import { useHomeData } from '@/hooks/useHomeData';
import { useHomeCategories } from '@/hooks/useHomeCategories';

export default function HomePage() {
  const navigate = useNavigate();
  console.log('HomePage component loaded');

  // Check if running on iOS native platform
  const isIOS = Capacitor.getPlatform() === 'ios';

  const [currentLocation, setCurrentLocation] = useState(null);
  const { recentlyViewed, addRecentlyViewed } = useRecentlyViewed();

  // Data hooks
  const {
    recommendations,
    popularPlaces,
    nearbyPlaces,
    homeImages,
    dynamicMessage,
    sectionsLoading: dataSectionsLoading,
    error,
    setError,
    user,
    addressLoading,
    locationLoading,
    handleBookmarkToggle,
    handleRetry,
    showLoginSheet,
    setShowLoginSheet,
  } = useHomeData(currentLocation, setCurrentLocation);

  const {
    fixedCategories,
    mbtiRow,
    categories,
    categoriesPlaces,
    loadedCategoryCount,
    isLoadingMoreCategories,
    categoryLoaderRef,
    sectionsLoading: categorySectionsLoading,
  } = useHomeCategories(currentLocation);

  // Merge section loading states
  const sectionsLoading = {
    ...dataSectionsLoading,
    ...categorySectionsLoading,
  };

  // Event handlers
  const handleProfileClick = () => {
    if (!user || user.isGuest) {
      setShowLoginSheet(true);
      return;
    }
    navigate('/profile-settings');
  };

  const handleSeeMore = () => {
    console.log('See more places clicked');
    navigate('/places');
  };

  const handleBannerClick = () => {
    console.log('Banner clicked');
    if (!user || user.isGuest) {
      setShowLoginSheet(true);
      return;
    }

    const hasCompletedSurvey = user.mbti && user.ageRange && user.spacePreferences;
    if (hasCompletedSurvey) {
      navigate('/search-results');
    } else {
      navigate('/age-range');
    }
  };

  const handlePlaceClick = (placeId) => {
    console.log('Place clicked:', placeId);

    let selectedPlace = recommendations.find(place => place.id === placeId) ||
                       homeImages.find(place => place.id === placeId) ||
                       popularPlaces.find(place => place.id === placeId) ||
                       nearbyPlaces.find(place => place.id === placeId) ||
                       recentlyViewed.find(place => place.id === placeId);

    if (!selectedPlace) {
      for (const categoryData of Object.values(categoriesPlaces)) {
        if (categoryData.places) {
          selectedPlace = categoryData.places.find(place => place.id === placeId);
          if (selectedPlace) break;
        }
      }
    }

    if (!selectedPlace) {
      navigate(`/place/${placeId}`);
      return;
    }

    addRecentlyViewed(selectedPlace);

    console.log('Selected place data:', selectedPlace);
    const preloadedImage = buildImageUrl(
      selectedPlace.image || selectedPlace.imageUrl || selectedPlace.images?.[0]
    );
    navigate(`/place/${placeId}`, {
      state: {
        preloadedImage,
        preloadedData: selectedPlace,
      },
    });
  };

  const getDisplayLocation = () => {
    if (currentLocation?.address) {
      return currentLocation.address;
    }

    if (addressLoading || locationLoading) {
      return '';
    }

    if (currentLocation) {
      return '주소를 불러올 수 없습니다';
    }

    return '위치 정보를 확인할 수 없습니다';
  };

  const handleCardKeyDown = (event, placeId) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handlePlaceClick(placeId);
    }
  };

  const renderPlacesSection = (title, places, {
    description,
    emptyMessage,
    footer,
    bookmarkable = true,
    sectionKey,
  } = {}) => {
    const key = sectionKey || title;

    if (!places || places.length === 0) {
      if (!emptyMessage) {
        return null;
      }

      return (
        <HomeSection key={`${key}-empty`} title={title} description={description}>
          <div className={`${styles.placeholderMessage} ${styles.placeholderMessageDense}`}>
            {emptyMessage}
          </div>
        </HomeSection>
      );
    }

    return (
      <HomeSection
        key={key}
        title={title}
        description={description}
        paddedBody={false}
        footer={footer}
      >
        <HomeHorizontalScroller>
          {places.map((place) => (
            <div
              key={place.id}
              className={styles.cardLink}
              role="button"
              tabIndex={0}
              onClick={() => handlePlaceClick(place.id)}
              onKeyDown={(event) => handleCardKeyDown(event, place.id)}
            >
              <PlaceCard
                title={place.title || place.name}
                rating={place.rating}
                reviewCount={place.reviewCount}
                distance={place.distance}
                location={place.location || place.category}
                image={place.image || place.imageUrl}
                images={place.images || []}
                category={place.category || place.type}
                isBookmarked={place.isBookmarked || false}
                onBookmarkToggle={bookmarkable ? ((isBookmarked) => handleBookmarkToggle(place.id, isBookmarked)) : undefined}
              />
            </div>
          ))}
        </HomeHorizontalScroller>
      </HomeSection>
    );
  };

  return (
    <div className={`${styles.pageContainer} ${isIOS ? styles.iosDevice : ''}`}>
      {/* Header - Always shown immediately */}
      <header className={styles.header}>
        <img src={logoHeader} alt="MOHE" className={styles.logo} />
        <div className={styles.headerSpacer} />
        <SearchBar onClick={() => navigate('/search')} />
        <ProfileButton onClick={handleProfileClick} />
      </header>

      {/* Location indicator */}
      <div className={styles.locationSection}>
        <LocationPin
          location={getDisplayLocation()}
          size="medium"
          loading={addressLoading || locationLoading}
        />
      </div>

      {/* Error message */}
      {error && (
        <div className={styles.errorWrapper}>
          <ErrorMessage
            message={error}
            onRetry={handleRetry}
            onDismiss={() => setError(null)}
            variant="banner"
          />
        </div>
      )}

      {/* Main content - Progressive rendering with section-level skeletons */}
      <div className={styles.contentContainer}>
        <div className={styles.content}>
          {/* Primary Recommendations Section */}
          {sectionsLoading.recommendations && recommendations.length === 0 ? (
            <SectionSkeleton titleWidth="180px" />
          ) : (
            renderPlacesSection(dynamicMessage, recommendations, {
              sectionKey: 'primary-recommendations',
            })
          )}

          <div className={styles.bannerWrapper}>
            <HomeBanner
              title="지금 뭐하지?"
              description={`시간, 기분, 취향을 반영해서
당신에게 어울리는 곳을 골라봤어요.`}
              image={bannerLeft}
              onClick={handleBannerClick}
            />
          </div>

          {/* Nearby Places Section */}
          {sectionsLoading.nearby && nearbyPlaces.length === 0 ? (
            <SectionSkeleton titleWidth="120px" />
          ) : (
            nearbyPlaces.length > 0 && renderPlacesSection('내 주변 장소', nearbyPlaces, {
              description: '가까운 거리에 있는 장소들이에요',
              sectionKey: 'nearby-places',
            })
          )}

          {/* Home Images / Time Recommendations Section */}
          {sectionsLoading.homeImages && homeImages.length === 0 ? (
            <SectionSkeleton titleWidth="140px" />
          ) : (
            homeImages.length > 0 && renderPlacesSection(
              user && user.id && user.id !== 'guest' ? '당신을 위한 추천' : '지금 이 시간 추천',
              homeImages,
              { sectionKey: 'time-recommendations' }
            )
          )}

          {/* MBTI-based Row (logged in users only) */}
          {mbtiRow && mbtiRow.places && mbtiRow.places.length > 0 && (
            renderPlacesSection(
              mbtiRow.title,
              mbtiRow.places.map(p => ({
                id: p.id,
                name: p.name,
                rating: p.rating,
                roadAddress: p.roadAddress,
                formattedAddress: p.roadAddress ? formatPlaceAddress(p.roadAddress) : '',
                distance: p.distance,
                primaryImageUrl: p.imageUrl ? buildImageUrl(p.imageUrl) : null,
                images: p.imageUrl ? [{ url: buildImageUrl(p.imageUrl) }] : [],
                category: p.category,
              })),
              { sectionKey: 'mbti-recommendations' }
            )
          )}

          {/* Category-based Sections */}
          {sectionsLoading.categories && categories.length === 0 ? (
            <>
              <SectionSkeleton titleWidth="160px" />
              <SectionSkeleton titleWidth="140px" />
            </>
          ) : (
            categories.length > 0 && categories.map((category) => {
              const categoryData = categoriesPlaces[category.key];
              if (!categoryData || !categoryData.places || categoryData.places.length === 0) {
                return null;
              }
              return renderPlacesSection(
                categoryData.title || category.title,
                categoryData.places,
                {
                  sectionKey: `category-${category.key}`,
                }
              );
            })
          )}

          {/* Lazy load trigger for more categories */}
          {loadedCategoryCount < fixedCategories.length && (
            <div
              ref={categoryLoaderRef}
              className={styles.categoryLoader}
              style={{ height: '40px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
            >
              {isLoadingMoreCategories && (
                <span style={{ color: '#7D848D', fontSize: '13px' }}>더 많은 카테고리 로딩 중...</span>
              )}
            </div>
          )}

          {/* Fallback if no category sections loaded */}
          {!sectionsLoading.categories && categories.length === 0 && popularPlaces.length > 0 &&
            renderPlacesSection('오늘은 이런 곳 어떠세요?', popularPlaces, {
              footer: (
                <OutlineButton onClick={handleSeeMore}>
                  더 많은 장소 보기
                </OutlineButton>
              ),
              sectionKey: 'popular-places',
            })}
        </div>
      </div>

      {/* Login Required Sheet */}
      <LoginRequiredSheet
        visible={showLoginSheet}
        onClose={() => setShowLoginSheet(false)}
        onLogin={() => {
          setShowLoginSheet(false);
          navigate('/login', { state: { from: '/home' } });
        }}
      />

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <span className={styles.footerLogo}>MOHE</span>

          <div className={styles.footerLinks}>
            <a href="#" className={styles.footerLink}>서비스 이용약관</a>
            <a href="#" className={styles.footerLink}>개인정보처리방침</a>
            <a href="#" className={styles.footerLink}>문의하기</a>
          </div>

          <div className={styles.footerDivider} />

          <div className={styles.footerBottom}>
            <p className={styles.footerText}>&copy; 2025 MOHE. All rights reserved.</p>
            <a href="mailto:hello@mohe.app" className={styles.footerEmail}>hello@mohe.app</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
