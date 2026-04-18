import { useState, useEffect, useRef } from 'react';
import { categoryService, bookmarkService } from '@/services/apiService';
import { authService } from '@/services/authService';
import { formatPlaceAddress } from '@/utils/addressUtils';
import { normalizePlaceImages } from '@/utils/image';
import { getTimeBasedSortedCategories } from '@/constants/categoryData';

const INITIAL_CATEGORIES_COUNT = 5;
const CATEGORIES_BATCH_SIZE = 5;

// ── sessionStorage 캐시 (10분 TTL) ───
// v2: place transform에 category 필드 추가 — 구버전 캐시는 자동 무효화
const CATEGORIES_CACHE_KEY = 'mohe_home_categories_cache_v2';
const CATEGORIES_CACHE_TTL = 10 * 60 * 1000;

function saveCategoriesCache(data) {
  try {
    sessionStorage.setItem(
      CATEGORIES_CACHE_KEY,
      JSON.stringify({ ...data, _ts: Date.now() })
    );
  } catch { /* quota exceeded 등 무시 */ }
}

function loadCategoriesCache() {
  try {
    const raw = sessionStorage.getItem(CATEGORIES_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed._ts > CATEGORIES_CACHE_TTL) {
      sessionStorage.removeItem(CATEGORIES_CACHE_KEY);
      return null;
    }
    return parsed;
  } catch { return null; }
}

/**
 * Custom hook that manages category loading and lazy-loading for the HomePage.
 *
 * @param {Object|null} currentLocation - { latitude, longitude, address }
 * @returns {Object} Category data, loading states, and refs
 */
export function useHomeCategories(currentLocation) {
  // 캐시 복원 — 뒤로가기·재마운트 시 즉시 렌더, 첫 진입 이후 빠른 복귀
  const cachedRef = useRef(loadCategoriesCache());
  const cached = cachedRef.current;
  const hasCachedCategories = !!(cached && cached.categories && cached.categories.length > 0);

  const [fixedCategories, setFixedCategories] = useState(() =>
    cached?.fixedCategories || getTimeBasedSortedCategories()
  );
  const [mbtiRow, setMbtiRow] = useState(cached?.mbtiRow || null);
  const [categories, setCategories] = useState(cached?.categories || []);
  const [categoriesPlaces, setCategoriesPlaces] = useState(cached?.categoriesPlaces || {});
  const [loadedCategoryCount, setLoadedCategoryCount] = useState(
    cached?.loadedCategoryCount || INITIAL_CATEGORIES_COUNT
  );
  const [isLoadingMoreCategories, setIsLoadingMoreCategories] = useState(false);
  const categoryLoaderRef = useRef(null);

  // 캐시가 있으면 로딩 상태 false로 시작
  const [categoriesLoading, setCategoriesLoading] = useState(!hasCachedCategories);
  // 초기 카테고리를 이번 마운트에서 이미 로드했는지 추적 (캐시 적중 시 재fetch 방지)
  const initialCategoriesLoadedRef = useRef(hasCachedCategories);

  // Load a single category's places
  const loadCategoryPlaces = async (category, latitude, longitude) => {
    try {
      const placesResponse = await categoryService.getPlacesByCategory(
        category.key,
        latitude,
        longitude,
        { limit: 10 }
      );

      if (placesResponse.success && placesResponse.data.length > 0) {
        const transformedPlaces = placesResponse.data.map(place => {
          const addressStr = place.shortAddress || place.address || '';
          const formattedLocation = formatPlaceAddress(addressStr);

          return normalizePlaceImages({
            id: place.id,
            name: place.name || place.title,
            title: place.title || place.name,
            rating: place.rating,
            reviewCount: place.reviewCount,
            distance: place.distance,
            location: formattedLocation,
            image: place.imageUrl || place.image,
            images: place.images || [],
            isBookmarked: place.isBookmarked || false,
            // 카테고리 행의 key를 주입하여 이미지 폴백이 올바른 기본 이미지를 쓰도록 함
            category: place.category || place.type || category.key,
          });
        });

        return { ...category, places: transformedPlaces };
      }
      return { ...category, places: [] };
    } catch (error) {
      console.warn(`Failed to load places for category ${category.key}:`, error);
      return { ...category, places: [] };
    }
  };

  // Fetch backend category order (즉시 응답, DB 미사용)
  useEffect(() => {
    const fetchHomeCategories = async () => {
      if (!currentLocation) return;
      try {
        const response = await categoryService.getHomeCategories(
          currentLocation.latitude, currentLocation.longitude
        );
        if (response?.data?.categoryRows) {
          const backendOrder = response.data.categoryRows.map(r => r.key);
          const baseCats = getTimeBasedSortedCategories();
          const catMap = {};
          baseCats.forEach(c => { catMap[c.key] = c; });

          const ordered = [];
          const seen = new Set();
          backendOrder.forEach(key => {
            if (catMap[key] && !seen.has(key)) {
              const backendRow = response.data.categoryRows.find(r => r.key === key);
              ordered.push({
                ...catMap[key],
                // 백엔드에서 제공하는 displayTitle 우선 사용
                title: backendRow?.displayTitle || catMap[key].title
              });
              seen.add(key);
            }
          });
          baseCats.forEach(c => {
            if (!seen.has(c.key)) {
              ordered.push(c);
              seen.add(c.key);
            }
          });
          setFixedCategories(ordered);
        }
      } catch (e) {
        console.debug('Home categories API failed, using client-side sorting');
      }
    };
    fetchHomeCategories();
  }, [currentLocation]);

  // Fetch MBTI row separately (DB 사용, 느릴 수 있음)
  useEffect(() => {
    const fetchMbtiRow = async () => {
      if (!currentLocation) return;
      const user = authService.getCurrentUser();
      const mbti = user?.mbti;
      if (!mbti) return;
      try {
        const response = await categoryService.getHomeMbtiRow(
          currentLocation.latitude, currentLocation.longitude, mbti
        );
        if (response?.data?.title) {
          setMbtiRow(response.data);
        }
      } catch (e) {
        console.debug('MBTI row API failed');
      }
    };
    fetchMbtiRow();
  }, [currentLocation]);

  // Load initial categories
  useEffect(() => {
    let isMounted = true;

    const loadInitialCategories = async () => {
      if (!currentLocation || !isMounted) return;
      // 캐시 적중 시 초기 fetch 스킵 (이미 state에 주입됨)
      if (initialCategoriesLoadedRef.current) return;
      initialCategoriesLoadedRef.current = true;

      try {
        console.log('Loading initial categories for location:', currentLocation);

        const initialCategories = fixedCategories.slice(0, INITIAL_CATEGORIES_COUNT);
        const placesPromises = initialCategories.map(category =>
          loadCategoryPlaces(category, currentLocation.latitude, currentLocation.longitude)
        );

        const placesResults = await Promise.all(placesPromises);

        if (isMounted) {
          const categoriesWithPlaces = placesResults.filter(r => r.places.length > 0);
          setCategories(categoriesWithPlaces);

          const placesMap = {};
          categoriesWithPlaces.forEach(result => {
            placesMap[result.key] = {
              title: result.title,
              places: result.places,
            };
          });

          setCategoriesPlaces(placesMap);
          setCategoriesLoading(false);
          console.log('Initial categories loaded:', categoriesWithPlaces.length);

          if (authService.isAuthenticated()) {
            const allPlaces = categoriesWithPlaces.flatMap(r => r.places);
            if (allPlaces.length > 0) {
              bookmarkService.applyBookmarkStatus(allPlaces).then(placesWithBookmarks => {
                if (isMounted) {
                  const bookmarkMap = new Map(placesWithBookmarks.map(p => [p.id, p.isBookmarked]));
                  const updatedPlacesMap = {};
                  categoriesWithPlaces.forEach(result => {
                    updatedPlacesMap[result.key] = {
                      title: result.title,
                      places: result.places.map(place => ({
                        ...place,
                        isBookmarked: bookmarkMap.get(place.id) || false,
                      })),
                    };
                  });
                  setCategoriesPlaces(updatedPlacesMap);
                }
              });
            }
          }
        }
      } catch (error) {
        console.warn('Failed to load initial category recommendations:', error);
        if (isMounted) {
          setCategories([]);
          setCategoriesPlaces({});
          setCategoriesLoading(false);
        }
      }
    };

    if (currentLocation) {
      loadInitialCategories();
    }

    return () => {
      isMounted = false;
    };
  }, [currentLocation]);

  // Load more categories when user scrolls down (IntersectionObserver)
  useEffect(() => {
    if (!categoryLoaderRef.current || !currentLocation) return;

    let isMounted = true;

    const observer = new IntersectionObserver(
      async (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !isLoadingMoreCategories && loadedCategoryCount < fixedCategories.length) {
          setIsLoadingMoreCategories(true);

          const nextBatch = fixedCategories.slice(loadedCategoryCount, loadedCategoryCount + CATEGORIES_BATCH_SIZE);
          if (nextBatch.length === 0) {
            setIsLoadingMoreCategories(false);
            return;
          }

          console.log(`Loading more categories: ${loadedCategoryCount} to ${loadedCategoryCount + nextBatch.length}`);

          try {
            const placesPromises = nextBatch.map(category =>
              loadCategoryPlaces(category, currentLocation.latitude, currentLocation.longitude)
            );

            const placesResults = await Promise.all(placesPromises);
            const newCategoriesWithPlaces = placesResults.filter(r => r.places.length > 0);

            if (newCategoriesWithPlaces.length > 0) {
              const updatedPlacesMap = { ...categoriesPlaces };
              newCategoriesWithPlaces.forEach(result => {
                updatedPlacesMap[result.key] = {
                  title: result.title,
                  places: result.places,
                };
              });

              setCategories(prev => [...prev, ...newCategoriesWithPlaces]);
              setCategoriesPlaces(updatedPlacesMap);

              if (authService.isAuthenticated()) {
                const allPlaces = newCategoriesWithPlaces.flatMap(r => r.places);
                if (allPlaces.length > 0) {
                  bookmarkService.applyBookmarkStatus(allPlaces).then(placesWithBookmarks => {
                    if (isMounted) {
                      const bookmarkMap = new Map(placesWithBookmarks.map(p => [p.id, p.isBookmarked]));
                      setCategoriesPlaces(prev => {
                        const updated = { ...prev };
                        newCategoriesWithPlaces.forEach(result => {
                          if (updated[result.key]) {
                            updated[result.key] = {
                              ...updated[result.key],
                              places: updated[result.key].places.map(place => ({
                                ...place,
                                isBookmarked: bookmarkMap.get(place.id) || false,
                              })),
                            };
                          }
                        });
                        return updated;
                      });
                    }
                  });
                }
              }
            }

            setLoadedCategoryCount(prev => prev + CATEGORIES_BATCH_SIZE);
          } catch (error) {
            console.warn('Failed to load more categories:', error);
          } finally {
            setIsLoadingMoreCategories(false);
          }
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(categoryLoaderRef.current);

    return () => {
      isMounted = false;
      observer.disconnect();
    };
  }, [currentLocation, loadedCategoryCount, isLoadingMoreCategories, fixedCategories, categoriesPlaces]);

  // 캐시 자동 저장
  useEffect(() => {
    if (!categories.length) return;
    saveCategoriesCache({
      fixedCategories,
      mbtiRow,
      categories,
      categoriesPlaces,
      loadedCategoryCount,
    });
  }, [fixedCategories, mbtiRow, categories, categoriesPlaces, loadedCategoryCount]);

  return {
    fixedCategories,
    mbtiRow,
    categories,
    categoriesPlaces,
    loadedCategoryCount,
    isLoadingMoreCategories,
    categoryLoaderRef,
    sectionsLoading: { categories: categoriesLoading },
  };
}
