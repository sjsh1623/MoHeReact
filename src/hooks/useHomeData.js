import { useState, useEffect, useRef } from 'react';
import { useGeolocation, useLocationStorage } from '@/hooks/useGeolocation';
import { weatherService, contextualRecommendationService, bookmarkService, addressService, guestRecommendationService, placeService, homeService } from '@/services/apiService';
import { authService } from '@/services/authService';
import { formatPlaceAddress, formatDisplayAddress } from '@/utils/addressUtils';
import { normalizePlaceImages } from '@/utils/image';

// ── sessionStorage 캐시 (30분 TTL) ───
const CACHE_KEY = 'mohe_home_cache';
const CACHE_TTL = 10 * 60 * 1000; // 10분

function saveCache(data) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ...data, _ts: Date.now() }));
  } catch { /* quota exceeded 등 무시 */ }
}

function loadCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed._ts > CACHE_TTL) {
      sessionStorage.removeItem(CACHE_KEY);
      return null;
    }
    return parsed;
  } catch { return null; }
}

function clearCache() {
  sessionStorage.removeItem(CACHE_KEY);
}

/**
 * Custom hook that manages all data loading for the HomePage.
 * - sessionStorage 캐시로 뒤로가기 시 즉시 렌더
 * - 30분 초과 또는 새로고침(F5) 시 API 재호출
 * - 위치 변경 시에만 데이터 갱신
 */
export function useHomeData(currentLocation, setCurrentLocation) {
  const { requestLocation, loading: locationLoading } = useGeolocation();
  const { saveLocation, getStoredLocation } = useLocationStorage();

  // 캐시 복원
  const cached = useRef(loadCache());
  // 캐시에 실제 데이터가 있는지 확인 (빈 배열만 있으면 무효)
  const hasCachedData = cached.current !== null &&
    ((cached.current.recommendations?.length > 0) || (cached.current.popularPlaces?.length > 0));

  const [weather, setWeather] = useState(cached.current?.weather || null);
  const [recommendations, setRecommendations] = useState(cached.current?.recommendations || []);
  const [locationPermissionRequested, setLocationPermissionRequested] = useState(false);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(() => authService.getCurrentUser());
  const [popularPlaces, setPopularPlaces] = useState(cached.current?.popularPlaces || []);
  const [homeImages, setHomeImages] = useState(cached.current?.homeImages || []);
  const [nearbyPlaces, setNearbyPlaces] = useState(cached.current?.nearbyPlaces || []);
  const [addressLoading, setAddressLoading] = useState(!getStoredLocation()?.address);
  const [dynamicMessage, setDynamicMessage] = useState(cached.current?.dynamicMessage || '지금 가기 좋은 플레이스');
  const [showLoginSheet, setShowLoginSheet] = useState(false);

  const [sectionsLoading, setSectionsLoading] = useState({
    recommendations: !hasCachedData,
    nearby: !hasCachedData,
    popular: !hasCachedData,
    homeImages: !hasCachedData,
  });

  // 각 섹션별 독립적인 loaded 플래그 (race condition 방지)
  const recommendationsLoadedRef = useRef(hasCachedData);
  const nearbyLoadedRef = useRef(hasCachedData);
  const popularLoadedRef = useRef(hasCachedData);
  const homeImagesLoadedRef = useRef(hasCachedData);

  // ── 캐시 자동 저장 ───
  useEffect(() => {
    if (!recommendations.length && !popularPlaces.length && !nearbyPlaces.length) return;
    saveCache({
      weather,
      recommendations,
      popularPlaces,
      nearbyPlaces,
      homeImages,
      dynamicMessage,
    });
  }, [weather, recommendations, popularPlaces, nearbyPlaces, homeImages, dynamicMessage]);

  // Resolve address from coordinates
  const resolveAddress = async (latitude, longitude) => {
    if (typeof latitude !== 'number' || typeof longitude !== 'number' ||
        isNaN(latitude) || isNaN(longitude) ||
        latitude < -90 || latitude > 90 ||
        longitude < -180 || longitude > 180) {
      setAddressLoading(false);
      return null;
    }

    setAddressLoading(true);
    try {
      const addressResponse = await addressService.reverseGeocode(Number(latitude), Number(longitude));
      if (addressResponse.success) {
        const formattedAddress = formatDisplayAddress(addressResponse.data);
        setCurrentLocation(prev => {
          const nextLocation = {
            ...(prev || {}),
            latitude,
            longitude,
            address: formattedAddress,
          };
          saveLocation(nextLocation);
          return nextLocation;
        });
        return addressResponse.data;
      }
      throw new Error('주소를 불러오지 못했습니다.');
    } catch (error) {
      console.warn('Failed to resolve address:', error);
      setCurrentLocation(prev => {
        const nextLocation = {
          ...(prev || {}),
          latitude,
          longitude,
          address: null,
        };
        saveLocation(nextLocation);
        return nextLocation;
      });
      return null;
    } finally {
      setAddressLoading(false);
    }
  };

  // Load weather data for location
  const loadWeatherData = async (latitude, longitude) => {
    if (typeof latitude !== 'number' || typeof longitude !== 'number' ||
        isNaN(latitude) || isNaN(longitude)) {
      return;
    }

    try {
      const weatherResponse = await weatherService.getWeatherContext(Number(latitude), Number(longitude));
      if (weatherResponse.success) {
        setWeather(weatherResponse.data);
      }
    } catch (error) {
      console.warn('Failed to load weather data:', error);
    }
  };

  // Prevent back navigation to login page
  useEffect(() => {
    const preventBackToLogin = () => {
      window.history.pushState(null, '', window.location.pathname);
    };

    window.history.pushState(null, '', window.location.pathname);
    window.addEventListener('popstate', preventBackToLogin);

    return () => {
      window.removeEventListener('popstate', preventBackToLogin);
    };
  }, []);

  // ── Initialize app ───
  useEffect(() => {
    let isMounted = true;

    const initializeApp = async () => {
      if (!isMounted) return;

      try {
        setError(null);

        let currentUser = authService.getCurrentUser();
        if (!currentUser) {
          if (authService.isAuthenticated()) {
            try {
              currentUser = await authService.getUserProfile();
            } catch (error) {
              console.warn('Failed to get user profile:', error);
              currentUser = await authService.createGuestSession();
            }
          } else {
            currentUser = await authService.createGuestSession();
          }
        }

        if (!isMounted) return;
        setUser(currentUser);

        if (!currentLocation) {
          await initializeLocationData();
        } else if (!weather) {
          loadWeatherData(currentLocation.latitude, currentLocation.longitude);
        }
      } catch (error) {
        if (isMounted) {
          console.error('Failed to initialize app:', error);
          setError('앱 초기화 중 오류가 발생했습니다.');
        }
      }
    };

    const initializeLocationData = async () => {
      if (!isMounted || locationPermissionRequested) return;
      setLocationPermissionRequested(true);
      setAddressLoading(true);

      // 1단계: 캐시된 위치로 즉시 데이터 로드 시작
      const cachedLoc = getStoredLocation();
      if (cachedLoc?.latitude && cachedLoc?.longitude) {
        setCurrentLocation(cachedLoc);
        if (cachedLoc.address) setAddressLoading(false);
      }

      // 2단계: 새 위치 요청
      try {
        const locationData = await requestLocation();
        if (!isMounted) return;

        if (locationData?.latitude && locationData?.longitude) {
          const isSame = cachedLoc &&
            Math.abs(locationData.latitude - cachedLoc.latitude) < 0.001 &&
            Math.abs(locationData.longitude - cachedLoc.longitude) < 0.001;

          if (!isSame) {
            // 위치 변경 → 캐시 무효화, 데이터 새로 로드
            clearCache();
            recommendationsLoadedRef.current = false;
            nearbyLoadedRef.current = false;
            popularLoadedRef.current = false;
            homeImagesLoadedRef.current = false;
            setCurrentLocation(locationData);
          }
          saveLocation(locationData);
          Promise.all([
            resolveAddress(locationData.latitude, locationData.longitude),
            loadWeatherData(locationData.latitude, locationData.longitude),
            fetch(`/api/location/register-user-area?lat=${locationData.latitude}&lng=${locationData.longitude}`, { method: 'POST' }).catch(() => {}),
          ]);
        } else {
          throw new Error('Invalid location data');
        }
      } catch (error) {
        console.warn('Failed to get location:', error);
        if (!cachedLoc && isMounted) {
          const fallback = { latitude: 37.5665, longitude: 126.9780, address: null };
          setCurrentLocation(fallback);
          Promise.all([
            resolveAddress(fallback.latitude, fallback.longitude),
            loadWeatherData(fallback.latitude, fallback.longitude),
          ]);
        }
      }
    };

    initializeApp();

    return () => { isMounted = false; };
  }, []);

  // ── Load recommendations ───
  useEffect(() => {
    let isMounted = true;

    const loadRecommendations = async () => {
      if (!currentLocation || !user || !isMounted) return;
      // 이미 로드 완료했으면 스킵
      if (recommendationsLoadedRef.current) return;

      setSectionsLoading(prev => ({ ...prev, recommendations: true }));

      try {
        let recommendationsData = [];

        if (user.isGuest) {
          try {
            const guestResponse = await guestRecommendationService.getGuestRecommendations(
              currentLocation.latitude,
              currentLocation.longitude,
              { limit: 10, maxDistance: 55000 }
            );

            if (guestResponse.dynamicMessage && isMounted) {
              setDynamicMessage(guestResponse.dynamicMessage);
            }

            if (guestResponse.success && guestResponse.data.length > 0) {
              recommendationsData = guestResponse.data.map(place => {
                const addressStr = place.shortAddress || place.address || '';
                return normalizePlaceImages({
                  id: place.id,
                  title: place.name,
                  rating: place.rating,
                  reviewCount: place.reviewCount,
                  distance: place.distance,
                  location: formatPlaceAddress(addressStr),
                  image: place.image,
                  imageUrl: place.imageUrl,
                  images: place.images,
                  isBookmarked: place.isBookmarked,
                  weatherSuitability: place.weatherSuitability,
                  reasonWhy: place.description,
                });
              });
            }
          } catch (error) {
            console.warn('Guest recommendations failed:', error);
          }
        } else {
          const [goodToVisitData, generalData] = await Promise.all([
            loadGoodToVisitRecommendations().catch(() => []),
            loadGeneralRecommendations().catch(() => []),
          ]);
          recommendationsData = goodToVisitData.length > 0 ? goodToVisitData : generalData;
        }

        if (!isMounted) return;

        setRecommendations(recommendationsData);
        setSectionsLoading(prev => ({ ...prev, recommendations: false }));
        recommendationsLoadedRef.current = true;

        if (!user.isGuest && recommendationsData.length > 0) {
          loadBookmarkStatus(recommendationsData).then(withBookmarks => {
            if (isMounted) setRecommendations(withBookmarks);
          });
        }
      } catch (error) {
        if (isMounted) {
          console.error('Failed to load recommendations:', error);
          setRecommendations([]);
          setSectionsLoading(prev => ({ ...prev, recommendations: false }));
          recommendationsLoadedRef.current = true;
          if (!user.isGuest) {
            setError(error.message?.includes('403')
              ? '인증이 필요합니다. 다시 로그인해주세요.'
              : '추천 장소를 불러오는데 실패했습니다.');
          }
        }
      }
    };

    const loadGoodToVisitRecommendations = async () => {
      if (!currentLocation) return [];
      const response = await contextualRecommendationService.getGoodToVisitRecommendations(
        currentLocation.latitude, currentLocation.longitude, { limit: 10 }
      );
      const parsed = contextualRecommendationService.parseGoodToVisitResponse(response);
      if (parsed.dynamicMessage) setDynamicMessage(parsed.dynamicMessage);
      if (parsed.places?.length > 0) {
        return parsed.places.map(place => normalizePlaceImages({
          id: place.id,
          title: place.name,
          rating: place.rating,
          reviewCount: place.reviewCount,
          distance: place.distance,
          location: formatPlaceAddress(place.shortAddress || place.address || ''),
          image: place.imageUrl || place.images?.[0],
          images: place.images,
          isBookmarked: false,
          weatherSuitability: place.weatherSuitability,
          reasonWhy: place.reasonWhy,
        }));
      }
      return [];
    };

    const loadGeneralRecommendations = async () => {
      const response = await placeService.getRecommendations();
      if (response.success && response.data.recommendations?.length > 0) {
        return response.data.recommendations.map(place => normalizePlaceImages({
          id: place.id,
          title: place.name,
          rating: place.rating,
          reviewCount: place.reviewCount,
          distance: place.distance,
          location: formatPlaceAddress(place.shortAddress || place.address || ''),
          image: place.imageUrl || place.image,
          images: place.images,
          isBookmarked: false,
          score: place.score || null,
          reasonWhy: place.reasonWhy || null,
        }));
      }
      return [];
    };

    const loadBookmarkStatus = async (places) => {
      if (user.isGuest || !places.length || !authService.isAuthenticated()) {
        return places.map(place => ({ ...place, isBookmarked: false }));
      }
      try {
        return await bookmarkService.applyBookmarkStatus(places);
      } catch {
        return places;
      }
    };

    if (currentLocation && user) {
      loadRecommendations();
    }

    return () => { isMounted = false; };
  }, [currentLocation, user]);

  // ── Load bookmark-based popular places ───
  useEffect(() => {
    let isMounted = true;

    const loadBookmarkBasedPlaces = async () => {
      if (!currentLocation || !isMounted) return;
      if (popularLoadedRef.current) return;

      setSectionsLoading(prev => ({ ...prev, popular: true }));
      try {
        const response = await placeService.getBookmarkBasedRecommendations(
          currentLocation.latitude, currentLocation.longitude,
          { limit: 15, distance: 50.0 }
        );

        if (response.success && isMounted) {
          const transformedPlaces = response.data.map(place => normalizePlaceImages({
            id: place.id,
            name: place.name || place.title,
            title: place.title || place.name,
            rating: place.rating,
            location: formatPlaceAddress(place.shortAddress || place.address || ''),
            image: place.imageUrl || place.image,
            images: place.images || [],
            isBookmarked: place.isBookmarked || false,
          }));

          setPopularPlaces(transformedPlaces);
          setSectionsLoading(prev => ({ ...prev, popular: false }));
          popularLoadedRef.current = true;

          if (authService.isAuthenticated()) {
            bookmarkService.applyBookmarkStatus(transformedPlaces).then(withBookmarks => {
              if (isMounted) setPopularPlaces(withBookmarks);
            });
          }
        } else if (isMounted) {
          setPopularPlaces([]);
          setSectionsLoading(prev => ({ ...prev, popular: false }));
          popularLoadedRef.current = true;
        }
      } catch {
        if (isMounted) {
          setPopularPlaces([]);
          setSectionsLoading(prev => ({ ...prev, popular: false }));
          popularLoadedRef.current = true;
        }
      }
    };

    if (currentLocation) loadBookmarkBasedPlaces();
    return () => { isMounted = false; };
  }, [currentLocation]);

  // ── Load nearby places ───
  useEffect(() => {
    let isMounted = true;

    const loadNearbyPlaces = async () => {
      if (!currentLocation || !isMounted) return;
      if (nearbyLoadedRef.current) return;

      setSectionsLoading(prev => ({ ...prev, nearby: true }));
      try {
        const response = await placeService.getNearbyPlaces(
          currentLocation.latitude, currentLocation.longitude,
          { radius: 3000, limit: 10 }
        );

        if (response.success && isMounted && response.data?.length > 0) {
          const transformedPlaces = response.data.map(place => normalizePlaceImages({
            id: place.id,
            name: place.name || place.title,
            title: place.title || place.name,
            rating: place.rating,
            location: formatPlaceAddress(place.shortAddress || place.address || ''),
            image: place.imageUrl || place.image,
            images: place.images || [],
            isBookmarked: place.isBookmarked || false,
            distance: place.distance,
          }));

          setNearbyPlaces(transformedPlaces);
          setSectionsLoading(prev => ({ ...prev, nearby: false }));
          nearbyLoadedRef.current = true;

          if (authService.isAuthenticated()) {
            bookmarkService.applyBookmarkStatus(transformedPlaces).then(withBookmarks => {
              if (isMounted) setNearbyPlaces(withBookmarks);
            });
          }
        } else if (isMounted) {
          setNearbyPlaces([]);
          setSectionsLoading(prev => ({ ...prev, nearby: false }));
          nearbyLoadedRef.current = true;
        }
      } catch {
        if (isMounted) {
          setNearbyPlaces([]);
          setSectionsLoading(prev => ({ ...prev, nearby: false }));
          nearbyLoadedRef.current = true;
        }
      }
    };

    if (currentLocation) loadNearbyPlaces();
    return () => { isMounted = false; };
  }, [currentLocation]);

  // ── Load home images (MBTI or weather) ───
  useEffect(() => {
    let isMounted = true;

    const loadHomeRecommendations = async () => {
      if (homeImagesLoadedRef.current) {
        setSectionsLoading(prev => ({ ...prev, homeImages: false }));
        return;
      }

      const isLoggedIn = user && user.id && user.id !== 'guest';

      if (isLoggedIn) {
        try {
          const response = await homeService.getHomeImages();
          if (response.success && response.data.length > 0 && isMounted) {
            const transformedPlaces = response.data.map(place => normalizePlaceImages({
              ...place,
              location: formatPlaceAddress(place.shortAddress || place.address || ''),
            }));
            setHomeImages(transformedPlaces);
            setSectionsLoading(prev => ({ ...prev, homeImages: false }));
            homeImagesLoadedRef.current = true;

            if (authService.isAuthenticated()) {
              bookmarkService.applyBookmarkStatus(transformedPlaces).then(withBookmarks => {
                if (isMounted) setHomeImages(withBookmarks);
              });
            }
          } else if (isMounted) {
            setHomeImages([]);
            setSectionsLoading(prev => ({ ...prev, homeImages: false }));
            homeImagesLoadedRef.current = true;
          }
        } catch {
          if (isMounted) {
            setHomeImages([]);
            setSectionsLoading(prev => ({ ...prev, homeImages: false }));
            homeImagesLoadedRef.current = true;
          }
        }
      } else {
        if (isMounted) {
          setHomeImages([]);
          setSectionsLoading(prev => ({ ...prev, homeImages: false }));
          homeImagesLoadedRef.current = true;
        }
      }
    };

    loadHomeRecommendations();
    return () => { isMounted = false; };
  }, [user]);

  // Bookmark toggle handler
  const handleBookmarkToggle = async (placeId, isBookmarked) => {
    try {
      if (!user || user.isGuest) {
        setShowLoginSheet(true);
        return;
      }

      let response;
      if (isBookmarked) {
        response = await bookmarkService.addBookmark(placeId);
      } else {
        response = await bookmarkService.removeBookmark(placeId);
      }

      if (response.success) {
        setRecommendations(prev =>
          prev.map(p => p.id === placeId ? { ...p, isBookmarked } : p)
        );
      }
    } catch (error) {
      console.error('Error toggling bookmark:', error);
    }
  };

  // 새로고침 시 캐시 클리어 + 리로드
  const handleRetry = () => {
    clearCache();
    recommendationsLoadedRef.current = false;
    nearbyLoadedRef.current = false;
    popularLoadedRef.current = false;
    homeImagesLoadedRef.current = false;
    setError(null);
    setSectionsLoading({
      recommendations: true,
      nearby: true,
      popular: true,
      homeImages: true,
    });
    window.location.reload();
  };

  return {
    weather,
    recommendations,
    popularPlaces,
    nearbyPlaces,
    homeImages,
    dynamicMessage,
    sectionsLoading,
    error,
    setError,
    user,
    addressLoading,
    locationLoading,
    handleBookmarkToggle,
    handleRetry,
    showLoginSheet,
    setShowLoginSheet,
  };
}
