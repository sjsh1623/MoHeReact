import { useState, useEffect, useRef } from 'react';
import { categoryService, bookmarkService } from '@/services/apiService';
import { authService } from '@/services/authService';
import { formatPlaceAddress } from '@/utils/addressUtils';
import { normalizePlaceImages } from '@/utils/image';
import { getTimeBasedSortedCategories } from '@/constants/categoryData';

const INITIAL_CATEGORIES_COUNT = 10;
const CATEGORIES_BATCH_SIZE = 5;

/**
 * Custom hook that manages category loading and lazy-loading for the HomePage.
 *
 * @param {Object|null} currentLocation - { latitude, longitude, address }
 * @returns {Object} Category data, loading states, and refs
 */
export function useHomeCategories(currentLocation) {
  const [fixedCategories, setFixedCategories] = useState(() => getTimeBasedSortedCategories());
  const [mbtiRow, setMbtiRow] = useState(null);
  const [categories, setCategories] = useState([]);
  const [categoriesPlaces, setCategoriesPlaces] = useState({});
  const [loadedCategoryCount, setLoadedCategoryCount] = useState(INITIAL_CATEGORIES_COUNT);
  const [isLoadingMoreCategories, setIsLoadingMoreCategories] = useState(false);
  const categoryLoaderRef = useRef(null);

  const [categoriesLoading, setCategoriesLoading] = useState(true);

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
