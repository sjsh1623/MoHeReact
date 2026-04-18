import React, { useMemo } from 'react';
import styles from '@/styles/components/cards/bookmark-place-card.module.css';
import { buildImageUrl } from '@/utils/image';
import { getDefaultPlaceImage } from '@/utils/defaultPlaceImage';

export default function BookmarkPlaceCard({ name, location, image, rating, category, onClick }) {
  const fallbackImage = useMemo(() => getDefaultPlaceImage(category), [category]);
  return (
    <div className={styles.card} onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <div className={styles.imageContainer}>
        <img
          src={buildImageUrl(image) || fallbackImage}
          alt={name}
          className={styles.image}
          loading="lazy"
          decoding="async"
          onError={(e) => { if (e.target.src !== fallbackImage) e.target.src = fallbackImage; }}
        />
      </div>
      
      <div className={styles.content}>
        <h3 className={styles.name}>{name}</h3>
        
        <div className={styles.locationRow}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="8" cy="7.33325" r="2" stroke="#7D848D" strokeWidth="1.5"/>
            <path d="M14 7.25918C14 10.532 10.25 14.6666 8 14.6666C5.75 14.6666 2 10.532 2 7.25918C2 3.98638 4.68629 1.33325 8 1.33325C11.3137 1.33325 14 3.98638 14 7.25918Z" stroke="#7D848D" strokeWidth="1.5"/>
          </svg>
          <span className={styles.location}>{location}</span>
        </div>
        
        <div className={styles.ratingRow}>
          <div className={styles.stars}>
            <svg width="15.4" height="14.12" viewBox="0 0 13 12" fill="none">
              <path d="M5.59149 0.345492C5.74042 -0.115164 6.38888 -0.115164 6.53781 0.345491L7.62841 3.71885C7.69501 3.92486 7.88603 4.06434 8.10157 4.06434H11.6308C12.1128 4.06434 12.3132 4.68415 11.9233 4.96885L9.06803 7.0537C8.89366 7.18102 8.82069 7.4067 8.8873 7.61271L9.9779 10.9861C10.1268 11.4467 9.60222 11.8298 9.21232 11.5451L6.35708 9.46024C6.18271 9.33291 5.94659 9.33291 5.77222 9.46024L2.91698 11.5451C2.52708 11.8298 2.00247 11.4467 2.1514 10.9861L3.242 7.61271C3.30861 7.4067 3.23564 7.18102 3.06127 7.0537L0.206033 4.96885C-0.183869 4.68415 0.0165137 4.06434 0.49846 4.06434H4.02773C4.24326 4.06434 4.43428 3.92486 4.50089 3.71885L5.59149 0.345492Z" fill="#FFD336"/>
            </svg>
            <svg width="15.4" height="14.12" viewBox="0 0 13 12" fill="none">
              <path d="M5.59149 0.345492C5.74042 -0.115164 6.38888 -0.115164 6.53781 0.345491L7.62841 3.71885C7.69501 3.92486 7.88603 4.06434 8.10157 4.06434H11.6308C12.1128 4.06434 12.3132 4.68415 11.9233 4.96885L9.06803 7.0537C8.89366 7.18102 8.82069 7.4067 8.8873 7.61271L9.9779 10.9861C10.1268 11.4467 9.60222 11.8298 9.21232 11.5451L6.35708 9.46024C6.18271 9.33291 5.94659 9.33291 5.77222 9.46024L2.91698 11.5451C2.52708 11.8298 2.00247 11.4467 2.1514 10.9861L3.242 7.61271C3.30861 7.4067 3.23564 7.18102 3.06127 7.0537L0.206033 4.96885C-0.183869 4.68415 0.0165137 4.06434 0.49846 4.06434H4.02773C4.24326 4.06434 4.43428 3.92486 4.50089 3.71885L5.59149 0.345492Z" fill="#FFD336"/>
            </svg>
            <svg width="15.4" height="14.12" viewBox="0 0 13 12" fill="none">
              <path d="M5.59149 0.345492C5.74042 -0.115164 6.38888 -0.115164 6.53781 0.345491L7.62841 3.71885C7.69501 3.92486 7.88603 4.06434 8.10157 4.06434H11.6308C12.1128 4.06434 12.3132 4.68415 11.9233 4.96885L9.06803 7.0537C8.89366 7.18102 8.82069 7.4067 8.8873 7.61271L9.9779 10.9861C10.1268 11.4467 9.60222 11.8298 9.21232 11.5451L6.35708 9.46024C6.18271 9.33291 5.94659 9.33291 5.77222 9.46024L2.91698 11.5451C2.52708 11.8298 2.00247 11.4467 2.1514 10.9861L3.242 7.61271C3.30861 7.4067 3.23564 7.18102 3.06127 7.0537L0.206033 4.96885C-0.183869 4.68415 0.0165137 4.06434 0.49846 4.06434H4.02773C4.24326 4.06434 4.43428 3.92486 4.50089 3.71885L5.59149 0.345492Z" fill="#FFD336"/>
            </svg>
          </div>
          <span className={styles.ratingText}>{rating}</span>
        </div>
      </div>
    </div>
  );
}
