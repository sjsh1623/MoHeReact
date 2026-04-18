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
// Order matters: more specific patterns first.
//   - Korean single-syllable "바" (bar) collides with brand names
//     like "폴바셋" → put cafe brand names BEFORE the bar entry so they win.
const KEYWORD_MAP = [
  // 1순위: 카페 프랜차이즈/브랜드 이름 — 다른 규칙보다 먼저 매칭 (예: 폴바셋이 "바"에 오탐되지 않도록)
  [[
    '스타벅스', 'starbucks', '투썸', 'twosome', '폴바셋', 'paul bassett', 'paulbassett',
    '이디야', 'ediya', '매머드', 'mammoth', '펠트', 'felt', '커피빈', 'coffeebean',
    '블루보틀', 'bluebottle', '메가커피', 'mega coffee', '컴포즈', 'compose',
    '할리스', 'hollys', '엔젤리너스', 'angelinus', '카페베네', 'caffebene',
    '탐앤탐스', 'tomntoms', '파스쿠찌', 'pascucci', 'tim hortons',
    '공차', 'gong cha', 'gongcha', '버블티', 'bubble tea',
  ], 'cafe'],
  // 서점 / 책 관련
  [['서점', 'bookstore', 'bookshop', '책방', '북카페'], 'bookstore'],
  // 갤러리 / 전시 / 박물관 / 문화·예술
  [['갤러리', 'gallery', '전시', 'exhibition', '박물관', 'museum', '미술관', '문화', '예술', 'art', '공연', '극장', '영화관', 'cinema', 'theater'], 'gallery'],
  // 공원 / 자연
  [['공원', 'park', '산책', '정원', 'garden', '수목원', '식물원', '캠핑', 'camp'], 'park'],
  // 바 / 주점 / 펍 — 한국어 "바" 단독 매칭은 위의 카페 브랜드가 먼저 걸러낸 뒤에만 발동
  [['바', 'pub', '펍', '술집', '주점', '포차', '이자카야', 'izakaya', 'cocktail', '칵테일', '와인바', 'wine_bar', 'wine bar', '루프탑바', 'rooftop_bar'], 'bar'],
  // 베이커리 (순수 빵집 — 'dessert' 는 카페 우선)
  [['베이커리', 'bakery', '빵집', '제과점'], 'bakery'],
  // 카페 일반 키워드
  [[
    '카페', 'cafe', 'coffee', '커피', 'brunch', '브런치',
    'bingsu', '빙수', '티룸', 'tearoom', 'tea_room', '티카페', 'tea', '녹차',
  ], 'cafe'],
  // 디저트 전문
  [['dessert', '디저트', '케이크', 'cake', '베이글', 'bagel', '도넛', 'donut', '마카롱', 'macaron'], 'bakery'],
  // 식당 전반
  [[
    '레스토랑', 'restaurant', '음식점', '식당', '맛집', 'diner',
    '한식', 'korean', 'korean_food',
    '양식', 'western', 'western_food',
    '중식', 'chinese', 'chinese_food',
    '일식', 'japanese', 'japanese_food',
    '아시안', 'asian', 'asian_food',
    '뷔페', 'buffet',
    '퓨전', 'fusion', '퓨전요리',
    'italian', '이탈리안', 'pasta', '파스타', 'pizza', '피자',
    'mediterranean', '지중해',
    '분식', 'snack_bar',
    'meat', '고기', '삼겹살', '갈비', 'bbq', '바베큐', '정육',
    'seafood', '해산물', '횟집', '초밥', 'sushi',
    'noodle', '면', '국수', 'ramen', '라멘', '우동', 'udon', '쌀국수',
    'stew', '찌개', '전골', 'hotpot', '샤브', 'shabu',
    '죽', 'porridge',
    'salad', '샐러드',
    'sandwich', '샌드위치', '토스트', 'toast',
    'chicken', '치킨',
    'gopchang', '곱창', '막창',
    'burger', '버거', '햄버거',
    '국밥', '탕', 'soup',
    'vegan', '비건',
    'juice', '주스',
  ], 'restaurant'],
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
 * Accepts multiple candidate strings (e.g. category + place name) and uses
 * the first one that matches a known keyword. This helps when the backend
 * returns overly-generic categories like "음식점" for a place that is
 * clearly a cafe based on its name (e.g. "스타벅스 무교동점").
 *
 * @param {...(string|null|undefined)} candidates - category, type, name, etc.
 * @returns {string} image URL (Vite-hashed asset path)
 */
export function getDefaultPlaceImage(...candidates) {
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'string') continue;
    const normalized = candidate.toLowerCase().trim();
    for (const [keywords, key] of KEYWORD_MAP) {
      if (keywords.some(kw => normalized.includes(kw.toLowerCase()))) {
        return DEFAULTS[key] || DEFAULTS.place;
      }
    }
  }
  return DEFAULTS.place;
}

/**
 * Generic brand-styled fallback (the 3D cluster image) — used when no category context is available.
 */
export const GENERIC_FALLBACK_IMAGE = DEFAULTS.default;
