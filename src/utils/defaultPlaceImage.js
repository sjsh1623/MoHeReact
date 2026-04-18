// Category-aware default place images.
// Used as fallback when a place has no image or image fails to load.
import defaultImg from '@/assets/image/defaults/default.png';
import cafeImg from '@/assets/image/defaults/cafe.png';
import restaurantImg from '@/assets/image/defaults/restaurant.png';
import barImg from '@/assets/image/defaults/bar.png';
import bakeryImg from '@/assets/image/defaults/bakery.png';
import galleryImg from '@/assets/image/defaults/gallery.png';
import bookstoreImg from '@/assets/image/defaults/bookstore.png';
import parkImg from '@/assets/image/defaults/park.png';
import placeImg from '@/assets/image/defaults/place.png';

// Map of canonical keys → image asset
const DEFAULTS = {
  default: defaultImg,
  cafe: cafeImg,
  restaurant: restaurantImg,
  bar: barImg,
  bakery: bakeryImg,
  gallery: galleryImg,
  bookstore: bookstoreImg,
  park: parkImg,
  place: placeImg,
};

// Keyword → canonical key. First match wins.
// Matches against lowercase Korean/English category text.
const KEYWORD_MAP = [
  [['카페', 'cafe', 'coffee', '커피'], 'cafe'],
  [['베이커리', 'bakery', '빵집', '디저트', 'dessert'], 'bakery'],
  [['바', 'pub', '펍', '술집', '주점', '포차', '이자카야', 'bar'], 'bar'],
  [['레스토랑', 'restaurant', '음식점', '식당', '맛집', '한식', '양식', '중식', '일식'], 'restaurant'],
  [['갤러리', 'gallery', '전시', '박물관', 'museum', 'exhibition', '미술관'], 'gallery'],
  [['서점', 'bookstore', 'book', '책방', '북카페'], 'bookstore'],
  [['공원', 'park', '산책', '정원', 'garden'], 'park'],
];

/**
 * Resolve a category/type string to a canonical default-image key.
 * @param {string|null|undefined} raw - category, type, or freeform label
 * @returns {string} one of the DEFAULTS keys
 */
export function resolveDefaultKey(raw) {
  if (!raw || typeof raw !== 'string') return 'place';
  const normalized = raw.toLowerCase().trim();
  for (const [keywords, key] of KEYWORD_MAP) {
    if (keywords.some(kw => normalized.includes(kw.toLowerCase()))) {
      return key;
    }
  }
  return 'place';
}

/**
 * Get the default image URL for a place based on its category/type.
 * Falls back to the generic "place" image if no match.
 * @param {string|null|undefined} category
 * @returns {string} image URL (Vite-hashed asset path)
 */
export function getDefaultPlaceImage(category) {
  return DEFAULTS[resolveDefaultKey(category)] || DEFAULTS.place;
}

/**
 * Generic brand-styled fallback (the 3D cluster image) — used when no category context is available.
 */
export const GENERIC_FALLBACK_IMAGE = DEFAULTS.default;
