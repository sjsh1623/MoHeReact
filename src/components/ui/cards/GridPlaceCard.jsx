import React, { useState, useEffect, useMemo } from 'react';
import styles from '@/styles/components/cards/grid-place-card.module.css';
import StarRating from '@/components/ui/indicators/StarRating';
import { buildImageUrl } from '@/utils/image';
import { getDefaultPlaceImage } from '@/utils/defaultPlaceImage';

export default function GridPlaceCard({
  title,
  rating,
  location,
  image,
  category,
  isBookmarked = false,
  onBookmarkToggle,
  onClick
}) {
  const [bookmarked, setBookmarked] = useState(isBookmarked);
  const [imageError, setImageError] = useState(false);
  const fallbackImage = useMemo(() => getDefaultPlaceImage(title, category), [title, category]);

  useEffect(() => {
    setBookmarked(isBookmarked);
  }, [isBookmarked]);

  const handleBookmarkClick = (e) => {
    e.stopPropagation();
    const newBookmarked = !bookmarked;
    setBookmarked(newBookmarked);
    if (onBookmarkToggle) {
      onBookmarkToggle(newBookmarked);
    }
  };

  const handleImageError = (e) => {
    if (e?.target && e.target.src !== fallbackImage) {
      e.target.src = fallbackImage;
      return;
    }
    setImageError(true);
  };

  const handleCardClick = () => {
    if (onClick) {
      onClick();
    }
  };

  return (
    <div className={styles.card} onClick={handleCardClick}>
      <div className={styles.imageContainer}>
        {imageError ? (
          <div className={styles.imagePlaceholder}>
            <div className={styles.placeholderText}>이미지를 불러올 수 없습니다</div>
          </div>
        ) : (
          <img
            src={buildImageUrl(image) || fallbackImage}
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
        <h3 className={styles.title}>{title}</h3>
        
        <div className={styles.locationRow}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="8" cy="7.33325" r="2" stroke="#7D848D" strokeWidth="1.5"/>
            <path d="M14 7.25918C14 10.532 10.25 14.6666 8 14.6666C5.75 14.6666 2 10.532 2 7.25918C2 3.98638 4.68629 1.33325 8 1.33325C11.3137 1.33325 14 3.98638 14 7.25918Z" stroke="#7D848D" strokeWidth="1.5"/>
          </svg>
          <span className={styles.location}>{location}</span>
        </div>

        <StarRating rating={rating} size="medium" />
      </div>
    </div>
  );
}
