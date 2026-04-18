import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import styles from '@/styles/pages/places-list-page.module.css';

import { Container } from '@/components/ui/layout';
import GridPlaceCard from '@/components/ui/cards/GridPlaceCard';
import PlacesListSkeleton from '@/components/ui/skeletons/PlacesListSkeleton';
import ErrorMessage from '@/components/ui/alerts/ErrorMessage';
import PrimaryButton from '@/components/ui/buttons/PrimaryButton';
import BackButton from '@/components/ui/buttons/BackButton';
import { placeService, bookmarkService } from '@/services/apiService';
import { authService } from '@/services/authService';
import { useGeolocation } from '@/hooks/useGeolocation';
import { normalizePlaceImages, buildImageUrl } from '@/utils/image';

export default function PlacesListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [places, setPlaces] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [hasMorePlaces, setHasMorePlaces] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [user, setUser] = useState(null);
  const { location, error: locationError } = useGeolocation();

  const PLACES_PER_PAGE = 20;

  // Initialize user state
  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    setUser(currentUser);
  }, []);

  // Load places function
  const loadPlaces = useCallback(async (page = 0, append = false) => {
    try {
      if (!append) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }
      setError(null);

      // Use the general places list endpoint with pagination
      const response = await placeService.getPlacesList({
        page: page,
        limit: PLACES_PER_PAGE,
        sort: 'popularity' // Default sort by popularity
      });

      if (response.success) {
        const data = response.data || {};
        const newPlaces = data.places || [];
        let normalizedPlaces = newPlaces.map(normalizePlaceImages);

        // Apply bookmark status for authenticated users
        const currentUser = authService.getCurrentUser();
        if (currentUser && !currentUser.isGuest && authService.isAuthenticated()) {
          normalizedPlaces = await bookmarkService.applyBookmarkStatus(normalizedPlaces);
        }

        if (append) {
          setPlaces(prev => [...prev, ...normalizedPlaces]);
        } else {
          setPlaces(normalizedPlaces);
        }

        const totalPagesValue = data.totalPages ?? data.pagination?.totalPages ?? 0;
        const currentPageValue = data.currentPage ?? data.pagination?.currentPage ?? page;

        setTotalPages(totalPagesValue);
        setHasMorePlaces(totalPagesValue > 0 && currentPageValue + 1 < totalPagesValue);
        setCurrentPage(currentPageValue);
      } else {
        setError(t('places.list.errors.loadFailed'));
      }
    } catch (err) {
      console.error('Failed to load places:', err);
      setError(t('places.list.errors.loadError'));
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadPlaces(0, false);
  }, [loadPlaces]);

  const handlePlaceClick = (placeId) => {
    console.log('Place clicked:', placeId);
    const selectedPlace = places.find(place => place.id === placeId);
    const preloadedImage = buildImageUrl(
      selectedPlace?.image || selectedPlace?.imageUrl || selectedPlace?.images?.[0]
    );
    navigate(`/place/${placeId}`, {
      state: { preloadedImage, preloadedData: selectedPlace }
    });
  };

  const handleBookmarkToggle = async (placeId, isBookmarked) => {
    try {
      if (!user || user.isGuest) {
        console.log('Guest user redirected to login for bookmarking');
        navigate('/login', {
          state: {
            from: '/places',
            message: t('bookmarks.loginRequired')
          }
        });
        return;
      }

      let response;
      if (isBookmarked) {
        response = await bookmarkService.addBookmark(placeId);
      } else {
        response = await bookmarkService.removeBookmark(placeId);
      }

      if (response.success) {
        setPlaces(prevPlaces =>
          prevPlaces.map(place =>
            place.id === placeId ? { ...place, isBookmarked } : place
          )
        );
      } else {
        console.error('Failed to toggle bookmark:', response.message);
      }
    } catch (err) {
      console.error('Failed to toggle bookmark:', err);
    }
  };

  const handleLoadMore = () => {
    if (hasMorePlaces && !isLoadingMore) {
      loadPlaces(currentPage + 1, true);
    }
  };

  return (
    <div className={styles.pageContainer}>
      {/* Header - Always shown immediately */}
      <header className={styles.header}>
        <BackButton className={styles.backButton} />
        <h1 className={styles.pageTitle}>{t('places.list.title')}</h1>
        <div className={styles.headerSpacer} />
      </header>

      {/* Main content */}
      <div className={styles.contentContainer}>
        <div className={styles.contentWrapper}>
          <h2 className={styles.sectionTitle}>{t('places.list.sectionTitle')}</h2>
          <p className={styles.sectionSubtitle}>{t('places.list.sectionSubtitle')}</p>

          {error && (
            <ErrorMessage message={error} />
          )}

          {/* Places Grid - Show skeleton while loading */}
          {isLoading ? (
            <PlacesListSkeleton />
          ) : places.length === 0 ? (
            <div className={styles.emptyState}>
              {t('places.list.emptyState').split('\n').map((line, index) => (
                <p key={index}>{line}</p>
              ))}
            </div>
          ) : (
            <>
              <div className={styles.placesGrid}>
                {places.map((place) => (
                  <GridPlaceCard
                    key={place.id}
                    title={place.title || place.name}
                    rating={place.rating}
                    location={place.location || place.category}
                    image={place.image || place.imageUrl}
                    category={place.category || place.type}
                    isBookmarked={place.isBookmarked || false}
                    onClick={() => handlePlaceClick(place.id)}
                    onBookmarkToggle={(isBookmarked) => handleBookmarkToggle(place.id, isBookmarked)}
                  />
                ))}
              </div>

              {/* Load More Button */}
              {hasMorePlaces && (
                <div className={styles.loadMoreContainer}>
                  <PrimaryButton
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                    className={styles.loadMoreButton}
                  >
                    {isLoadingMore ? t('places.list.loading') : t('places.list.loadMore')}
                  </PrimaryButton>
                </div>
              )}

              {/* Show current progress */}
              {totalPages > 1 && (
                <div className={styles.paginationInfo}>
                  <p>{t('places.list.pagination', { current: currentPage + 1, total: totalPages })}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
