import React from 'react';
import { SkeletonImage, SkeletonText, SkeletonBox, SkeletonCircle } from '@/components/ui/layout/SkeletonLoader';
import styles from '@/styles/components/skeletons/place-detail-skeleton.module.css';
import { buildImageUrl } from '@/utils/image';

export default function PlaceDetailSkeleton({ preloadedImage = null }) {
  const resolvedPreloadedImage = buildImageUrl(preloadedImage);
  return (
    <div className={styles.pageContainer}>
      {/* Hero Section */}
      <div className={styles.heroSection}>
        {resolvedPreloadedImage ? (
          <img
            src={resolvedPreloadedImage}
            alt=""
            className={styles.preloadedImage}
          />
        ) : (
          <SkeletonImage width="100%" height="100%" className={styles.heroImage} />
        )}
        <div className={styles.heroOverlay} />

        <div className={styles.imageIndicators}>
          {[...Array(5)].map((_, index) => (
            <SkeletonCircle key={index} size="8px" />
          ))}
        </div>

        <div className={styles.bottomHandle} />
      </div>

      {/* Content Section */}
      <div className={styles.contentSection}>
        <SkeletonBox width="40px" height="4px" borderRadius="2px" className={styles.dragIndicator} />

        {/* Title + Rating */}
        <div className={styles.header}>
          <SkeletonText width="65%" height="26px" className={styles.title} />
          <div className={styles.ratingContainer}>
            <SkeletonCircle size="14px" />
            <SkeletonText width="28px" height="16px" />
            <SkeletonText width="35px" height="14px" />
            <SkeletonText width="40px" height="14px" />
          </div>
        </div>

        {/* Info List (주소 + 영업시간 + 전화번호) */}
        <div className={styles.infoList}>
          <div className={styles.infoRow}>
            <SkeletonCircle size="18px" />
            <SkeletonText width="60%" height="14px" />
          </div>
          <div className={styles.infoRow}>
            <SkeletonCircle size="18px" />
            <SkeletonText width="45%" height="14px" />
          </div>
        </div>

        {/* Description */}
        <div className={styles.descriptionSection}>
          <SkeletonText width="50%" height="20px" className={styles.descriptionTitle} />
          <div className={styles.description}>
            <SkeletonText width="100%" height="16px" />
            <SkeletonText width="90%" height="16px" />
            <SkeletonText width="70%" height="16px" />
          </div>
        </div>

        {/* Reviews */}
        <div className={styles.descriptionSection}>
          <SkeletonText width="30%" height="20px" className={styles.descriptionTitle} />
          <div className={styles.description}>
            <SkeletonText width="95%" height="16px" />
            <SkeletonText width="80%" height="16px" />
          </div>
        </div>
      </div>
    </div>
  );
}
