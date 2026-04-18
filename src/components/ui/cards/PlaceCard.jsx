import React, { useState, useMemo, useEffect } from 'react';
import styles from '@/styles/components/cards/place-card.module.css';
import { buildImageUrl, buildImageUrlList } from '@/utils/image';
import { getDefaultPlaceImage } from '@/utils/defaultPlaceImage';

function formatDistance(dist) {
  if (dist == null || dist <= 0) return null;
  return `${dist < 0.1 ? dist.toFixed(2) : dist.toFixed(1)}km`;
}

export default function PlaceCard({
  title,
  rating,
  reviewCount,
  distance,
  location,
  image,
  images = [],
  category,
  isBookmarked = false,
  onBookmarkToggle,
  className = '',
}) {
  const [bookmarked, setBookmarked] = useState(isBookmarked);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setBookmarked(isBookmarked);
  }, [isBookmarked]);

  // Extract location string safely
  const getLocationString = () => {
    if (typeof location === 'string') {
      return location;
    } else if (location && typeof location === 'object') {
      // If location is an object (e.g., {latitude, longitude}), show a fallback
      console.warn('PlaceCard received location object instead of string:', location);
      return '위치 정보 없음';
    }
    return '위치 정보 없음';
  };

  const locationStr = getLocationString();

  // Category-aware brand fallback image
  const fallbackImage = useMemo(() => getDefaultPlaceImage(category), [category]);

  const displayedImage = useMemo(() => {
    const normalizedImages = buildImageUrlList(images);
    if (normalizedImages.length > 0) {
      return normalizedImages[0];
    }

    const primaryImage = buildImageUrl(image);
    if (primaryImage) {
      return primaryImage;
    }

    return fallbackImage;
  }, [image, images, fallbackImage]);

  const handleBookmarkClick = (e) => {
    e.stopPropagation();
    const newBookmarked = !bookmarked;
    setBookmarked(newBookmarked);
    if (onBookmarkToggle) {
      onBookmarkToggle(newBookmarked);
    }
  };

  const handleImageError = (e) => {
    // Swap to category-aware default; only hide if that also fails.
    if (e?.target && e.target.src !== fallbackImage) {
      e.target.src = fallbackImage;
      return;
    }
    setImageError(true);
  };

  const cardClassName = [styles.card, className].filter(Boolean).join(' ');

  return (
    <div className={cardClassName}>
      <div className={styles.imageContainer}>
        {imageError ? (
          <div className={styles.imagePlaceholder}>
            <div className={styles.placeholderText}>이미지를 불러올 수 없습니다</div>
          </div>
        ) : (
          <img
            src={displayedImage}
            alt={title}
            className={styles.image}
            onError={handleImageError}
            loading="lazy"
            decoding="async"
          />
        )}
        <button
          className={`${styles.bookmarkButton} ${bookmarked ? styles.bookmarked : ''}`}
          onClick={handleBookmarkClick}
          aria-label={bookmarked ? '북마크 제거' : '북마크 추가'}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M19 21L12 16L5 21V5C5 4.46957 5.21071 3.96086 5.58579 3.58579C5.96086 3.21071 6.46957 3 7 3H17C17.5304 3 18.0391 3.21071 18.4142 3.58579C18.7893 3.96086 19 4.46957 19 5V21Z"
              stroke={bookmarked ? '#FF385C' : 'white'}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill={bookmarked ? '#FF385C' : 'none'}
            />
          </svg>
        </button>
      </div>

      <div className={styles.content}>
        <div className={styles.header}>
          <h3 className={styles.title}>{title}</h3>
          <div className={styles.rating}>
            {rating && Number(rating) > 0 ? (
              <>
                <svg width="13" height="12" viewBox="0 0 13 12" fill="none">
                  <path d="M5.59149 0.345492C5.74042 -0.115164 6.38888 -0.115164 6.53781 0.345491L7.62841 3.71885C7.69501 3.92486 7.88603 4.06434 8.10157 4.06434H11.6308C12.1128 4.06434 12.3132 4.68415 11.9233 4.96885L9.06803 7.0537C8.89366 7.18102 8.82069 7.4067 8.8873 7.61271L9.9779 10.9861C10.1268 11.4467 9.60222 11.8298 9.21232 11.5451L6.35708 9.46024C6.18271 9.33291 5.94659 9.33291 5.77222 9.46024L2.91698 11.5451C2.52708 11.8298 2.00247 11.4467 2.1514 10.9861L3.242 7.61271C3.30861 7.4067 3.23564 7.18102 3.06127 7.0537L0.206033 4.96885C-0.183869 4.68415 0.0165137 4.06434 0.49846 4.06434H4.02773C4.24326 4.06434 4.43428 3.92486 4.50089 3.71885L5.59149 0.345492Z" fill="#FFD336"/>
                </svg>
                <span>{Number(rating).toFixed(1)}</span>
                {reviewCount > 0 && <span className={styles.reviewCount}>({reviewCount})</span>}
              </>
            ) : (
              <>
                <svg width="13" height="12" viewBox="0 0 13 12" fill="none">
                  <path d="M5.59149 0.345492C5.74042 -0.115164 6.38888 -0.115164 6.53781 0.345491L7.62841 3.71885C7.69501 3.92486 7.88603 4.06434 8.10157 4.06434H11.6308C12.1128 4.06434 12.3132 4.68415 11.9233 4.96885L9.06803 7.0537C8.89366 7.18102 8.82069 7.4067 8.8873 7.61271L9.9779 10.9861C10.1268 11.4467 9.60222 11.8298 9.21232 11.5451L6.35708 9.46024C6.18271 9.33291 5.94659 9.33291 5.77222 9.46024L2.91698 11.5451C2.52708 11.8298 2.00247 11.4467 2.1514 10.9861L3.242 7.61271C3.30861 7.4067 3.23564 7.18102 3.06127 7.0537L0.206033 4.96885C-0.183869 4.68415 0.0165137 4.06434 0.49846 4.06434H4.02773C4.24326 4.06434 4.43428 3.92486 4.50089 3.71885L5.59149 0.345492Z" fill="none" stroke="#ccc" strokeWidth="0.8" strokeDasharray="2 1"/>
                </svg>
              </>
            )}
          </div>
        </div>

        <div className={styles.locationRow}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="7.33325" r="2" stroke="#7D848D" strokeWidth="1.5"/>
            <path d="M14 7.25918C14 10.532 10.25 14.6666 8 14.6666C5.75 14.6666 2 10.532 2 7.25918C2 3.98638 4.68629 1.33325 8 1.33325C11.3137 1.33325 14 3.98638 14 7.25918Z" stroke="#7D848D" strokeWidth="1.5"/>
          </svg>
          <span className={styles.location}>{locationStr}</span>
          {formatDistance(distance) && <span className={styles.distance}>{formatDistance(distance)}</span>}
        </div>
      </div>
    </div>
  );
}
