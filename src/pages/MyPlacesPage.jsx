import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import BookmarkPlaceCard from '@/components/ui/cards/BookmarkPlaceCard';
import BookmarksSkeleton from '@/components/ui/skeletons/BookmarksSkeleton';
import ErrorMessage from '@/components/ui/alerts/ErrorMessage';
import { activityService } from '@/services/apiService';
import { authService } from '@/services/authService';
import styles from '@/styles/pages/my-places-page.module.css';

export default function MyPlacesPage() {
  const { t } = useTranslation();
  const [myPlaces, setMyPlaces] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadMyPlaces = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const user = authService.getCurrentUser();
        if (!user || user.isGuest) {
          setMyPlaces([]);
          return;
        }

        const response = await activityService.getMyPlaces();
        if (response.success) {
          const places = response.data?.places || [];
          const mapped = places.map(place => ({
            id: place.id || place.place?.id,
            name: place.name || place.title || place.place?.title,
            title: place.title || place.place?.title,
            location: place.location || place.address || place.place?.location,
            image: place.imageUrl || place.image || place.place?.imageUrl,
            rating: place.rating || place.place?.rating
          }));
          setMyPlaces(mapped);
        } else {
          setError(t('myPlaces.errors.loadFailed'));
        }
      } catch (err) {
        console.error('Failed to load my places:', err);
        setError(t('myPlaces.errors.loadError'));
      } finally {
        setIsLoading(false);
      }
    };

    loadMyPlaces();
  }, []);

  return (
    <>
      <header className={styles.header}>
        <h1 className={styles.title}>{t('myPlaces.title')}</h1>
      </header>

      <main className={styles.main}>
        {error && (
          <ErrorMessage message={error} />
        )}

        {isLoading ? (
          <BookmarksSkeleton />
        ) : myPlaces.length === 0 ? (
          <div className={styles.emptyState}>
            {t('myPlaces.emptyState').split('\n').map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        ) : (
          <div className={styles.placesList}>
            {myPlaces.map((place) => (
              <BookmarkPlaceCard
                key={place.id}
                name={place.name || place.title}
                location={place.location}
                image={place.image || place.imageUrl}
                category={place.category || place.type}
                rating={place.rating}
              />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
