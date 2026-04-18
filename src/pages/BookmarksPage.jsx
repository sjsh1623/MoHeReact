import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import BookmarkPlaceCard from '@/components/ui/cards/BookmarkPlaceCard';
import BookmarksSkeleton from '@/components/ui/skeletons/BookmarksSkeleton';
import BackButton from '@/components/ui/buttons/BackButton';
import { bookmarkService } from '@/services/apiService';
import { authService } from '@/services/authService';
import styles from '@/styles/pages/bookmarks-page.module.css';
import useAuthGuard from '@/hooks/useAuthGuard';

function BookmarksPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  useAuthGuard(true); // Protect this page
  const [bookmarkedPlaces, setBookmarkedPlaces] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadBookmarks = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const user = authService.getCurrentUser();
        if (!user || user.isGuest) {
          // No bookmarks for guest users
          setBookmarkedPlaces([]);
          return;
        }

        // Load user's bookmarks from backend
        const response = await bookmarkService.getUserBookmarks();
        if (response.success) {
          const bookmarksRaw = response.data?.bookmarks ?? response.data ?? [];
          // Transform bookmark data structure: { id, place: {...}, createdAt } -> place object with placeId
          const bookmarks = bookmarksRaw.map(bookmark => {
            const placeData = bookmark.place || bookmark;
            return {
              id: placeData.id || bookmark.id,
              name: placeData.name,
              location: placeData.location,
              image: placeData.image,
              rating: placeData.rating,
              createdAt: bookmark.createdAt
            };
          });
          setBookmarkedPlaces(bookmarks);
        } else {
          setError(t('bookmarks.errors.loadFailed'));
        }
      } catch (err) {
        console.error('Failed to load bookmarks:', err);
        setError(t('bookmarks.errors.loadError'));
      } finally {
        setIsLoading(false);
      }
    };

    loadBookmarks();
  }, []);

  return (
    <>
      <header className={styles.header}>
        <BackButton />
        <h1 className={styles.title}>{t('bookmarks.title')}</h1>
      </header>

      <main className={styles.main}>
        {isLoading ? (
          <BookmarksSkeleton />
        ) : error ? (
          <div className={styles.centerMessage}>
            <p className={styles.errorText}>데이터를 불러오는중에 오류가 발생했습니다.</p>
          </div>
        ) : bookmarkedPlaces.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIconWrapper}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19 21L12 16L5 21V5C5 4.46957 5.21071 3.96086 5.58579 3.58579C5.96086 3.21071 6.46957 3 7 3H17C17.5304 3 18.0391 3.21071 18.4142 3.58579C18.7893 3.96086 19 4.46957 19 5V21Z" stroke="#DDDDDD" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h2 className={styles.emptyTitle}>저장한 장소가 없습니다</h2>
            <p className={styles.emptyDescription}>
              마음에 드는 장소를 발견하면<br />
              하트를 눌러 저장해보세요
            </p>
            <button
              className={styles.exploreButton}
              onClick={() => navigate('/places')}
            >
              장소 둘러보기
            </button>
          </div>
        ) : (
          <div className={styles.placesList}>
            {bookmarkedPlaces.map((place) => (
              <BookmarkPlaceCard
                key={place.id}
                name={place.name || place.title}
                location={place.location}
                image={place.image || place.imageUrl}
                category={place.category || place.type}
                rating={place.rating}
                onClick={() => navigate(`/place/${place.id}`)}
              />
            ))}
          </div>
        )}
      </main>
    </>
  );
}

export default BookmarksPage;
