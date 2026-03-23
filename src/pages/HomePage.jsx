import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import styles from '@/styles/pages/home-page.module.css';

import PlaceCard from '@/components/ui/cards/PlaceCard';
import LocationPin from '@/components/ui/indicators/LocationPin';
import ProfileButton from '@/components/ui/buttons/ProfileButton';
import OutlineButton from '@/components/ui/buttons/OutlineButton';
import SearchBar from '@/components/ui/inputs/SearchBar';
import SearchModal from '@/components/ui/modals/SearchModal';
import SectionSkeleton from '@/components/ui/skeletons/SectionSkeleton';
import ErrorMessage from '@/components/ui/alerts/ErrorMessage';
import { useGeolocation, useLocationStorage } from '@/hooks/useGeolocation';
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed';
import { weatherService, contextualRecommendationService, bookmarkService, addressService, guestRecommendationService, placeService, homeService, categoryService } from '@/services/apiService';
import { authService } from '@/services/authService';
import bannerLeft from '@/assets/image/banner_left.png';
import logoHeader from '@/assets/image/logo-header.svg';
import { buildImageUrl, normalizePlaceImages } from '@/utils/image';
import { HomeSection, HomeHorizontalScroller, HomeBanner } from '@/components/ui/home';
import LoginRequiredSheet from '@/components/ui/modals/LoginRequiredSheet';

/**
 * Format address to show district + detailed address
 * If outside current region, show only district
 * @param {string} fullAddress - Full address string
 * @returns {string} Formatted address
 */
const formatPlaceAddress = (fullAddress) => {
  if (!fullAddress || typeof fullAddress !== 'string') {
    return '위치 정보 없음';
  }

  // Extract district (구/군) and detailed address
  // Korean address format: 시도 시군구 구 도로명 번지
  const addressParts = fullAddress.split(' ');

  // Find the index of district (구 or 군)
  const districtIndex = addressParts.findIndex(part =>
    part.endsWith('구') || part.endsWith('군')
  );

  if (districtIndex === -1) {
    // No district found, return city or full address
    return addressParts.slice(0, 2).join(' ') || fullAddress;
  }

  // Get district + detailed address (road name and number)
  const district = addressParts[districtIndex];
  const detailedParts = addressParts.slice(districtIndex + 1);

  // If there's detailed address, show "구 + 도로명 번지"
  if (detailedParts.length > 0) {
    // Limit to district + road name (max 2 parts after district)
    return `${district} ${detailedParts.slice(0, 2).join(' ')}`;
  }

  // Only district available
  return district;
};

export default function HomePage() {
  const navigate = useNavigate();
  console.log('HomePage component loaded');

  // Check if running on iOS native platform
  const isIOS = Capacitor.getPlatform() === 'ios';

  // Location and weather state
  const { requestLocation, loading: locationLoading } = useGeolocation();
  const { saveLocation, getStoredLocation } = useLocationStorage();
  const [weather, setWeather] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [currentLocation, setCurrentLocation] = useState(() => getStoredLocation());
  const [locationPermissionRequested, setLocationPermissionRequested] = useState(false);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(() => authService.getCurrentUser());
  const [popularPlaces, setPopularPlaces] = useState([]);
  const [homeImages, setHomeImages] = useState([]);
  const [nearbyPlaces, setNearbyPlaces] = useState([]);
  const [addressLoading, setAddressLoading] = useState(!getStoredLocation()?.address);
  const [categories, setCategories] = useState([]);
  const [categoriesPlaces, setCategoriesPlaces] = useState({});
  const [dynamicMessage, setDynamicMessage] = useState('지금 가기 좋은 플레이스');
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [showLoginSheet, setShowLoginSheet] = useState(false);
  const { recentlyViewed, addRecentlyViewed } = useRecentlyViewed();

  // Section-level loading states for progressive rendering
  const [sectionsLoading, setSectionsLoading] = useState({
    recommendations: true,
    nearby: true,
    popular: true,
    categories: true,
    homeImages: true
  });

  // Prevent back navigation to login page
  useEffect(() => {
    const preventBackToLogin = () => {
      // Push current state to prevent going back
      window.history.pushState(null, '', window.location.pathname);
    };

    // Add state to history to block back navigation
    window.history.pushState(null, '', window.location.pathname);
    window.addEventListener('popstate', preventBackToLogin);

    return () => {
      window.removeEventListener('popstate', preventBackToLogin);
    };
  }, []);

  // Initialize app only once on mount
  useEffect(() => {
    let isMounted = true; // Cleanup flag

    const initializeApp = async () => {
      if (!isMounted) return;

      try {
        // Don't reset state if we already have data (coming back from detail page)
        setError(null);

        // Initialize user (authenticated or guest)
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

        // Initialize location only if not already set
        if (!currentLocation) {
          await initializeLocationData();
        } else {
          // Location already exists, just load weather if needed
          if (!weather) {
            loadWeatherData(currentLocation.latitude, currentLocation.longitude);
          }
        }

      } catch (error) {
        if (isMounted) {
          console.error('Failed to initialize app:', error);
          setError('앱 초기화 중 오류가 발생했습니다.');
        }
      }
    };

    const initializeLocationData = async () => {
      if (!isMounted) return;

      // Check for stored location first
      const storedLocation = getStoredLocation();
      if (storedLocation) {
        if (isMounted) {
          console.log('📍 Setting location from storage:', storedLocation);
          setCurrentLocation(storedLocation);

          if (storedLocation.address) {
            setAddressLoading(false);
          } else if (storedLocation.latitude && storedLocation.longitude) {
            await resolveAddress(storedLocation.latitude, storedLocation.longitude);
          }

          await loadWeatherData(storedLocation.latitude, storedLocation.longitude);
        }
        return;
      }

      // Request location only once
      if (!locationPermissionRequested) {
        setLocationPermissionRequested(true);
        setAddressLoading(true);
        try {
          const locationData = await requestLocation();

          // Validate location data before using
          if (locationData &&
              typeof locationData.latitude === 'number' &&
              typeof locationData.longitude === 'number' &&
              isMounted) {
            setCurrentLocation(locationData);
            // 사용자 위치 기반 크롤링 우선순위 등록 (비동기, 결과 무시)
            fetch(`/api/location/register-user-area?lat=${locationData.latitude}&lng=${locationData.longitude}`, { method: 'POST' })
              .catch(() => {});
            // Resolve address for the location
            await resolveAddress(locationData.latitude, locationData.longitude);
            await loadWeatherData(locationData.latitude, locationData.longitude);
          } else if (isMounted) {
            throw new Error('Invalid location data received');
          }
        } catch (error) {
          console.warn('Failed to get location:', error);
          // Use default location (Seoul City Hall) if geolocation fails
          const defaultLocation = {
            latitude: 37.5665,
            longitude: 126.9780,
            address: null // Will be resolved by address API
          };
          if (isMounted) {
            setCurrentLocation(defaultLocation);
            // Resolve address for default location
            await resolveAddress(defaultLocation.latitude, defaultLocation.longitude);
            await loadWeatherData(defaultLocation.latitude, defaultLocation.longitude);
          }
        }
      }
    };

    initializeApp();

    return () => {
      isMounted = false; // Cleanup
    };
  }, []); // Empty dependency array - run only once on mount

  // Resolve address from coordinates
  const resolveAddress = async (latitude, longitude) => {
    // Validate latitude and longitude are valid numbers
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
            address: formattedAddress
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
          address: null
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
    // Validate latitude and longitude before API call
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

  // Load recommendations when dependencies change
  useEffect(() => {
    let isMounted = true;
    
    const loadRecommendations = async () => {
      if (!currentLocation || !user || !isMounted) return;

      try {
        let recommendationsData = [];

        if (user.isGuest && isMounted) {
          try {
            const guestResponse = await guestRecommendationService.getGuestRecommendations(
              currentLocation.latitude,
              currentLocation.longitude,
              { limit: 10, maxDistance: 55000 } // 15km in meters
            );

            console.log('HomePage: Guest response received:', guestResponse);
            console.log('HomePage: Guest response success:', guestResponse.success);
            console.log('HomePage: Guest response data length:', guestResponse.data?.length);

            // Update dynamic message from guest response
            if (guestResponse.dynamicMessage && isMounted) {
              setDynamicMessage(guestResponse.dynamicMessage);
              console.log('🎨 Guest dynamic message set:', guestResponse.dynamicMessage);
            }

            if (guestResponse.success && guestResponse.data.length > 0) {
              console.log('HomePage: Processing guest recommendations, count:', guestResponse.data.length);

              recommendationsData = guestResponse.data.map(place => {
                // Use shortAddress field from backend
                // Backend sends: shortAddress = formatted address, address = full address
                const addressStr = place.shortAddress || place.address || '';

                // Format the address to show district + detailed address
                const formattedLocation = formatPlaceAddress(addressStr);

                return normalizePlaceImages({
                  id: place.id,
                  title: place.name,
                  rating: place.rating,
                  location: formattedLocation,
                  image: place.image,
                  imageUrl: place.imageUrl,
                  images: place.images,
                  isBookmarked: place.isBookmarked,
                  distance: 0,
                  weatherSuitability: place.weatherSuitability,
                  reasonWhy: place.description
                });
              });

              console.log('HomePage: Mapped recommendations data:', recommendationsData);
            } else {
              console.log('HomePage: Guest recommendations failed or empty');
            }
          } catch (error) {
            console.warn('Guest recommendations failed:', error);
          }
        } else {
          // For authenticated users, use good-to-visit recommendations
          if (isMounted) {
            try {
              const goodToVisitData = await loadGoodToVisitRecommendations();
              if (goodToVisitData.length > 0 && isMounted) {
                recommendationsData = goodToVisitData;
              }
            } catch (error) {
              console.warn('Good-to-visit recommendations failed:', error);
            }
          }

          // Fallback to general recommendations if good-to-visit fails
          if (recommendationsData.length === 0 && isMounted) {
            try {
              const generalData = await loadGeneralRecommendations();
              if (generalData.length > 0 && isMounted) {
                recommendationsData = generalData;
              }
            } catch (error) {
              console.warn('General recommendations failed:', error);
            }
          }
        }

        if (!isMounted) return;

        // Set data immediately for fast rendering
        if (isMounted) {
          console.log('HomePage: About to set recommendations with data:', recommendationsData);
          setRecommendations(recommendationsData);
          setSectionsLoading(prev => ({ ...prev, recommendations: false }));
          console.log('HomePage: Successfully set recommendations');
        }

        // Load bookmark status asynchronously after initial render
        if (!user.isGuest && recommendationsData.length > 0 && isMounted) {
          loadBookmarkStatus(recommendationsData).then(placesWithBookmarks => {
            if (isMounted) {
              setRecommendations(placesWithBookmarks);
            }
          });
        }

      } catch (error) {
        if (isMounted) {
          console.error('Failed to load recommendations:', error);
          setRecommendations([]);
          setSectionsLoading(prev => ({ ...prev, recommendations: false }));

          if (!user.isGuest) {
            if (error.message?.includes('403') || error.message?.includes('Forbidden')) {
              setError('인증이 필요합니다. 다시 로그인해주세요.');
            } else {
              setError('추천 장소를 불러오는데 실패했습니다.');
            }
          }
        }
      }
    };

    const loadGoodToVisitRecommendations = async () => {
      if (!currentLocation) return [];

      // Use good-to-visit API with user's current location
      console.log('🎯 Calling good-to-visit API with location:', {
        lat: currentLocation.latitude,
        lon: currentLocation.longitude
      });

      const response = await contextualRecommendationService.getGoodToVisitRecommendations(
        currentLocation.latitude,
        currentLocation.longitude,
        { limit: 10 }
      );

      console.log('✅ Good-to-visit API response:', response);

      // Parse the response to extract dynamic message and places
      const parsed = contextualRecommendationService.parseGoodToVisitResponse(response);
      console.log('📝 Parsed response:', parsed);

      // Update dynamic message state
      if (parsed.dynamicMessage) {
        setDynamicMessage(parsed.dynamicMessage);
        console.log('🎨 Dynamic message set:', parsed.dynamicMessage);
      }

      if (parsed.places && parsed.places.length > 0) {
        return parsed.places.map(place => {
          // Use shortAddress field from backend
          const addressStr = place.shortAddress || place.address || '';
          const formattedLocation = formatPlaceAddress(addressStr);

          return normalizePlaceImages({
            id: place.id,
            title: place.name,
            rating: place.rating,
            location: formattedLocation,
            image: place.imageUrl || place.images?.[0],
            images: place.images,
            isBookmarked: false,
            distance: place.distance || 0,
            weatherSuitability: place.weatherSuitability,
            reasonWhy: place.reasonWhy
          });
        });
      }
      return [];
    };

    const loadGeneralRecommendations = async () => {
      // Use general recommendations API that works for both guest and authenticated users
      const response = await placeService.getRecommendations();

      if (response.success && response.data.recommendations && response.data.recommendations.length > 0) {
        return response.data.recommendations.map(place => {
          // Use shortAddress field from backend
          const addressStr = place.shortAddress || place.address || '';
          const formattedLocation = formatPlaceAddress(addressStr);

          return normalizePlaceImages({
            id: place.id,
            title: place.name,
            rating: place.rating,
            location: formattedLocation,
            image: place.imageUrl || place.image,
            images: place.images,
            isBookmarked: false,
            distance: null,
            score: place.score || null,
            reasonWhy: place.reasonWhy || null
          });
        });
      }
      return [];
    };

    const loadBookmarkStatus = async (places) => {
      // Skip bookmark status loading for guest users and when no authentication
      if (user.isGuest || !places.length || !authService.isAuthenticated()) {
        console.log('Skipping bookmark status checks for guest user or unauthenticated state');
        return places.map(place => ({ ...place, isBookmarked: false }));
      }

      try {
        console.log('Loading bookmark status for', places.length, 'places');
        // Use efficient bulk bookmark status check
        return await bookmarkService.applyBookmarkStatus(places);
      } catch (error) {
        console.warn('Failed to load bookmark status:', error);
        return places;
      }
    };

    if (currentLocation && user) {
      loadRecommendations();
    }

    return () => {
      isMounted = false;
    };
  }, [currentLocation, user]);

  useEffect(() => {
    let isMounted = true;

    const loadBookmarkBasedPlaces = async () => {
      if (!currentLocation || !isMounted) return;

      try {
        console.log('Loading bookmark-based places for location:', currentLocation);
        const response = await placeService.getBookmarkBasedRecommendations(
          currentLocation.latitude,
          currentLocation.longitude,
          { limit: 15, distance: 50.0 } // 15 items, 20km radius
        );

        if (response.success && isMounted) {
          console.log('✅ Bookmark-based places loaded:', response.data.length);
          // Transform the data to match the expected format
          const transformedPlaces = response.data.map(place => {
            const addressStr = place.shortAddress || place.address || '';
            const formattedLocation = formatPlaceAddress(addressStr);

            return normalizePlaceImages({
              id: place.id,
              name: place.name || place.title,
              title: place.title || place.name,
              rating: place.rating,
              location: formattedLocation,
              image: place.imageUrl || place.image,
              images: place.images || [],
              isBookmarked: place.isBookmarked || false
            });
          });

          // Set data immediately for fast rendering
          setPopularPlaces(transformedPlaces);
          setSectionsLoading(prev => ({ ...prev, popular: false }));

          // Apply bookmark status asynchronously
          if (authService.isAuthenticated()) {
            bookmarkService.applyBookmarkStatus(transformedPlaces).then(placesWithBookmarks => {
              if (isMounted) {
                setPopularPlaces(placesWithBookmarks);
              }
            });
          }
        } else if (isMounted) {
          console.warn('⚠️ Bookmark-based places API returned no success:', response);
          setPopularPlaces([]);
          setSectionsLoading(prev => ({ ...prev, popular: false }));
        }
      } catch (error) {
        console.warn('⚠️ Bookmark-based places failed, continuing without them:', error);
        if (isMounted) {
          setPopularPlaces([]);
          setSectionsLoading(prev => ({ ...prev, popular: false }));
        }
      }
    };

    if (currentLocation) {
      loadBookmarkBasedPlaces();
    }

    return () => {
      isMounted = false;
    };
  }, [currentLocation]);

  // Load nearby places
  useEffect(() => {
    let isMounted = true;

    const loadNearbyPlaces = async () => {
      if (!currentLocation || !isMounted) return;

      try {
        console.log('Loading nearby places for location:', currentLocation);
        const response = await placeService.getNearbyPlaces(
          currentLocation.latitude,
          currentLocation.longitude,
          { radius: 3000, limit: 10 } // 3km radius
        );

        if (response.success && isMounted && response.data?.length > 0) {
          console.log('✅ Nearby places loaded:', response.data.length);
          const transformedPlaces = response.data.map(place => {
            const addressStr = place.shortAddress || place.address || '';
            const formattedLocation = formatPlaceAddress(addressStr);

            return normalizePlaceImages({
              id: place.id,
              name: place.name || place.title,
              title: place.title || place.name,
              rating: place.rating,
              location: formattedLocation,
              image: place.imageUrl || place.image,
              images: place.images || [],
              isBookmarked: place.isBookmarked || false,
              distance: place.distance
            });
          });

          // Set data immediately for fast rendering
          setNearbyPlaces(transformedPlaces);
          setSectionsLoading(prev => ({ ...prev, nearby: false }));

          // Apply bookmark status asynchronously
          if (authService.isAuthenticated()) {
            bookmarkService.applyBookmarkStatus(transformedPlaces).then(placesWithBookmarks => {
              if (isMounted) {
                setNearbyPlaces(placesWithBookmarks);
              }
            });
          }
        } else if (isMounted) {
          setNearbyPlaces([]);
          setSectionsLoading(prev => ({ ...prev, nearby: false }));
        }
      } catch (error) {
        console.warn('⚠️ Failed to load nearby places:', error);
        if (isMounted) {
          setNearbyPlaces([]);
          setSectionsLoading(prev => ({ ...prev, nearby: false }));
        }
      }
    };

    if (currentLocation) {
      loadNearbyPlaces();
    }

    return () => {
      isMounted = false;
    };
  }, [currentLocation]);

  // 시간대별 카테고리 우선순위 정의
  const getTimeBasedCategories = () => {
    const hour = new Date().getHours();

    // 시간대별 우선 카테고리 정의
    const timeSlots = {
      // 아침 (6-10시)
      morning: {
        hours: [6, 7, 8, 9],
        primary: ['brunch_cafe', 'bakery', 'cafe', 'toast', 'sandwich', 'porridge', 'salad', 'juice'],
        titles: {
          brunch_cafe: '아침을 여유롭게 브런치로 시작해요',
          bakery: '갓 구운 빵 냄새 맡으러 가요',
          cafe: '모닝 커피 한 잔 어때요?',
          toast: '든든한 토스트로 아침 시작해요',
          sandwich: '간단하게 샌드위치 한 입',
          porridge: '속 편하게 죽 한 그릇 먹어요',
          salad: '건강한 아침 샐러드 어때요?',
          juice: '생과일 주스로 상쾌하게 시작해요',
        }
      },
      // 늦은 아침/브런치 (10-11시)
      late_morning: {
        hours: [10],
        primary: ['brunch_cafe', 'cafe', 'bakery', 'dessert_cafe', 'salad', 'sandwich'],
        titles: {
          brunch_cafe: '늦은 아침, 브런치 타임이에요',
          cafe: '여유롭게 커피 한 잔 할까요?',
          bakery: '빵집 순례 떠나볼까요?',
          dessert_cafe: '달콤한 디저트로 기분 전환해요',
          salad: '가볍고 건강한 한 끼 어때요?',
          sandwich: '간단하게 샌드위치 먹어요',
        }
      },
      // 점심 (11-14시)
      lunch: {
        hours: [11, 12, 13],
        primary: ['korean_food', 'japanese_food', 'chinese_food', 'western_food', 'noodle', 'restaurant', 'stew', 'meat', 'asian_food', 'salad'],
        titles: {
          korean_food: '점심엔 역시 든든한 한식이죠',
          japanese_food: '오늘 점심은 일식 어때요?',
          chinese_food: '짜장면이 먹고 싶은 점심이에요',
          western_food: '파스타로 점심 해결해요',
          noodle: '시원한 면 요리 땡기는 날이에요',
          restaurant: '점심 뭐 먹을지 고민이에요',
          stew: '뜨끈한 찌개 한 그릇 어때요?',
          meat: '점심부터 고기 구워요!',
          asian_food: '이국적인 점심 먹어볼까요?',
          salad: '가볍게 샐러드로 점심 해결해요',
        }
      },
      // 오후 티타임 (14-16시)
      afternoon: {
        hours: [14, 15],
        primary: ['cafe', 'dessert_cafe', 'bakery', 'bingsu', 'tea', 'gallery', 'exhibition', 'bookstore', 'shopping_mall'],
        titles: {
          cafe: '오후의 여유로운 커피 타임이에요',
          dessert_cafe: '달콤한 디저트가 필요한 오후예요',
          bakery: '오후엔 빵 한 조각 어때요?',
          bingsu: '시원한 빙수 먹으러 가요',
          tea: '차 한 잔의 여유를 가져요',
          gallery: '오후엔 갤러리 나들이 어때요?',
          exhibition: '전시 보러 가볼까요?',
          bookstore: '오후의 책방 산책은 어때요?',
          shopping_mall: '쇼핑하면서 기분 전환해요',
        }
      },
      // 늦은 오후 (16-17시)
      late_afternoon: {
        hours: [16],
        primary: ['cafe', 'dessert_cafe', 'rooftop', 'park', 'shopping_mall', 'view'],
        titles: {
          cafe: '노을 보면서 커피 한 잔 해요',
          dessert_cafe: '오후 간식 타임이에요',
          rooftop: '노을 지는 루프탑 어때요?',
          park: '산책하기 딱 좋은 시간이에요',
          shopping_mall: '쇼핑하러 갈까요?',
          view: '뷰 맛집에서 노을 봐요',
        }
      },
      // 저녁 (17-20시)
      dinner: {
        hours: [17, 18, 19],
        primary: ['korean_food', 'meat', 'seafood', 'japanese_food', 'western_food', 'chinese_food', 'chicken', 'gopchang', 'shabu', 'italian', 'stew'],
        titles: {
          korean_food: '저녁엔 정갈한 한식 어때요?',
          meat: '저녁엔 고기 굽는 날이에요',
          seafood: '신선한 회 먹으러 갈까요?',
          japanese_food: '저녁에 일식 한 상 어때요?',
          western_food: '오늘 저녁은 스테이크 나잇이에요',
          chinese_food: '저녁엔 중식 한 상 푸짐하게',
          chicken: '저녁에 치킨 어떠세요?',
          gopchang: '곱창 먹으러 가볼까요?',
          shabu: '따끈한 샤브샤브 땡기는 저녁이에요',
          italian: '정통 이탈리안 디너 어때요?',
          stew: '뜨끈한 찌개 한 상 먹어요',
        }
      },
      // 밤 (20-22시)
      evening: {
        hours: [20, 21],
        primary: ['bar', 'wine_bar', 'craft_beer', 'izakaya', 'rooftop', 'pub', 'lounge_bar', 'chicken', 'jokbal', 'indoor_pocha'],
        titles: {
          bar: '하루 끝에 한 잔 어떠세요?',
          wine_bar: '와인 한 잔 하면서 하루 마무리해요',
          craft_beer: '시원한 맥주 한 잔 하러 가요',
          izakaya: '이자카야에서 한 잔 해요',
          rooftop: '야경 보면서 한 잔 할까요?',
          pub: '동네 펍에서 가볍게 한 잔해요',
          lounge_bar: '라운지에서 여유롭게 쉬어요',
          chicken: '치맥 한 판 어때요?',
          jokbal: '야식은 역시 족발이죠',
          indoor_pocha: '포차에서 분위기 있게 한 잔해요',
        }
      },
      // 심야 (22-24시)
      late_night: {
        hours: [22, 23],
        primary: ['bar', 'late_night', 'chicken', 'jokbal', 'gopchang', 'porridge', 'indoor_pocha', 'karaoke', 'late_night_food'],
        titles: {
          bar: '늦은 밤, 한 잔 더 할까요?',
          late_night: '심야에 갈 곳 찾고 있어요',
          chicken: '밤에 치킨 땡기지 않아요?',
          jokbal: '야식엔 역시 족발이죠',
          gopchang: '야식으로 곱창 어때요?',
          porridge: '해장이 필요한 밤이에요',
          indoor_pocha: '포차에서 마무리해요',
          karaoke: '노래 부르러 갈까요?',
          late_night_food: '늦은 밤 뭐 먹을지 고민이에요',
        }
      },
      // 새벽 (0-5시)
      dawn: {
        hours: [0, 1, 2, 3, 4, 5],
        primary: ['late_night', 'porridge', 'cafe', 'late_night_food'],
        titles: {
          late_night: '새벽에 열린 곳 찾고 있어요',
          porridge: '새벽엔 해장이 필요해요',
          cafe: '24시간 카페 어디 있나요?',
          late_night_food: '새벽에 뭐 먹지?',
        }
      }
    };

    // 현재 시간에 맞는 시간대 찾기
    let currentSlot = null;
    for (const [slotName, slot] of Object.entries(timeSlots)) {
      if (slot.hours.includes(hour)) {
        currentSlot = { name: slotName, ...slot };
        break;
      }
    }

    return { currentSlot, timeSlots };
  };

  // 시간대별로 정렬된 카테고리 생성
  const allCategories = (() => {
    const { currentSlot } = getTimeBasedCategories();

    // 기본 카테고리 풀 (key와 여러 문장형 타이틀)
    const baseCategories = [
      // 카페
      { key: 'cafe', titles: [
        '커피 한 잔 하러 갈까요?',
        '오늘은 카페에서 여유롭게',
        '향긋한 커피가 생각나는 오늘',
        '카페 가서 잠깐 쉬어요',
        '분위기 좋은 카페 어때요?',
        '작업하기 좋은 카페 찾아요',
        '요즘 핫한 카페 가볼까?',
      ]},
      // 음식점
      { key: 'restaurant', titles: [
        '오늘 뭐 먹을지 고민이에요',
        '맛있는 거 먹으러 가요',
        '배고픈데 뭐 먹지?',
        '맛집 탐방 갈까요?',
        '오늘은 외식하는 날',
        '뭔가 맛있는 게 땡겨요',
      ]},
      // 바/술집
      { key: 'bar', titles: [
        '오늘 한 잔 어떠세요?',
        '분위기 좋은 바 가고 싶어요',
        '가볍게 한 잔 할까요?',
        '칵테일 마시고 싶은 밤',
        '조용히 마실 수 있는 곳',
        '하루 끝에 술 한 잔',
      ]},
      // 베이커리
      { key: 'bakery', titles: [
        '갓 구운 빵 냄새가 그리워요',
        '빵지순례 떠나볼까요?',
        '오늘은 빵 먹는 날',
        '맛있는 빵집 찾고 있어요',
        '크루아상이 땡기는 하루',
        '소금빵 먹으러 갈까요?',
      ]},
      // 브런치
      { key: 'brunch_cafe', titles: [
        '여유로운 브런치 어때요?',
        '늦은 아침, 브런치 타임',
        '에그 베네딕트 먹고 싶어요',
        '주말엔 역시 브런치죠',
        '오늘은 브런치로 시작해요',
        '느긋하게 브런치 즐겨요',
      ]},
      // 디저트
      { key: 'dessert_cafe', titles: [
        '달콤한 디저트가 필요해요',
        '디저트 먹으러 가요',
        '오늘의 당 충전 타임',
        '케이크 한 조각 어때요?',
        '달달한 게 땡기는 오늘',
        '마카롱 맛집 가볼까요?',
        '아이스크림 먹고 싶어요',
      ]},
      // 와인바
      { key: 'wine_bar', titles: [
        '오늘은 와인 기분이에요',
        '와인 한 잔 할까요?',
        '분위기 있는 와인바 가요',
        '와인이랑 치즈 먹고 싶어요',
        '로맨틱한 와인바 어때요?',
      ]},
      // 수제맥주
      { key: 'craft_beer', titles: [
        '시원한 맥주 한 잔 어때요?',
        '수제맥주 마시러 가요',
        '맥주가 땡기는 날이에요',
        '다양한 맥주 맛보러 갈까요?',
        'IPA 마시고 싶은 날',
      ]},
      // 갤러리
      { key: 'gallery', titles: [
        '갤러리 나들이 갈까요?',
        '예술이 필요한 하루예요',
        '감성 충전하러 갤러리 가요',
        '오늘은 문화생활 어때요?',
        '작품 구경하고 싶어요',
      ]},
      // 박물관
      { key: 'museum', titles: [
        '박물관 탐방 어때요?',
        '역사 속으로 떠나볼까요?',
        '교양 충전하러 가요',
        '아이랑 박물관 가기 좋은 날',
      ]},
      // 전시
      { key: 'exhibition', titles: [
        '전시 보러 갈까요?',
        '요즘 핫한 전시 있대요',
        '팝업 전시 구경 갈래요?',
        '전시회 데이트 어때요?',
        '사진 찍기 좋은 전시 가요',
      ]},
      // 공방
      { key: 'workshop', titles: [
        '뭔가 만들어보고 싶어요',
        '원데이 클래스 들을까요?',
        '손으로 만드는 시간 가져요',
        '나만의 향수 만들어볼래요?',
        '도자기 빚으러 갈까요?',
        '오늘은 공방에서 힐링',
      ]},
      // 공원
      { key: 'park', titles: [
        '산책하기 딱 좋은 날이에요',
        '바람 쐬러 공원 갈까요?',
        '피크닉 가고 싶어요',
        '자연 속에서 힐링해요',
        '공원에서 여유로운 시간',
      ]},
      // 쇼핑몰
      { key: 'shopping_mall', titles: [
        '쇼핑하러 갈까요?',
        '윈도우 쇼핑이라도 해요',
        '오늘은 쇼핑 데이',
        '새 옷 사고 싶어요',
        '쇼핑몰 구경 가요',
      ]},
      // 영화관
      { key: 'cinema', titles: [
        '영화 한 편 어때요?',
        '팝콘이랑 영화 보러 가요',
        '요즘 뭐 볼 거 있나요?',
        '영화관 데이트 할까요?',
        '오늘은 영화 보는 날',
      ]},
      // 서점
      { key: 'bookstore', titles: [
        '책방 구경 가요',
        '책 향기 맡으러 갈까요?',
        '독립서점 투어 어때요?',
        '읽을 책 찾으러 가요',
        '조용히 책 구경하고 싶어요',
      ]},
      // 북카페
      { key: 'library_cafe', titles: [
        '책 읽으면서 커피 마셔요',
        '조용히 책 읽고 싶어요',
        '북카페에서 여유로운 시간',
        '커피랑 책, 완벽한 조합',
      ]},
      // 한식
      { key: 'korean_food', titles: [
        '한식이 땡기는 오늘',
        '집밥 같은 따뜻한 한 끼',
        '역시 밥은 한식이죠',
        '정갈한 백반 먹고 싶어요',
        '삼겹살 구워 먹을까요?',
        '뜨끈한 국밥 한 그릇',
        '오늘은 한정식 어때요?',
      ]},
      // 일식
      { key: 'japanese_food', titles: [
        '오늘은 일식 기분이에요',
        '스시 먹으러 갈까요?',
        '라멘이 땡기는 날',
        '오마카세 도전해볼까요?',
        '바삭한 돈카츠 먹고 싶어요',
        '우동 한 그릇 어때요?',
      ]},
      // 중식
      { key: 'chinese_food', titles: [
        '짜장면이 먹고 싶어요',
        '오늘은 중식 어때요?',
        '마라탕 먹을 사람?',
        '딤섬 파티 갈까요?',
        '짬뽕 한 그릇 때려요',
        '탕수육이 땡겨요',
      ]},
      // 양식
      { key: 'western_food', titles: [
        '파스타 먹고 싶어요',
        '스테이크 굽는 날이에요',
        '피자 한 판 먹을까요?',
        '버거 먹으러 갈래요?',
        '리조또 어떠세요?',
        '오늘은 양식 데이',
      ]},
      // 아시안
      { key: 'asian_food', titles: [
        '이국적인 맛이 그리워요',
        '쌀국수 먹으러 갈까요?',
        '태국 음식 탐방해요',
        '커리가 땡기는 날',
        '동남아 음식 먹고 싶어요',
        '반미 먹으러 가요',
      ]},
      // 펍
      { key: 'pub', titles: [
        '동네 펍에서 한 잔 해요',
        '아늑한 펍 찾고 있어요',
        '맥주랑 안주가 생각나요',
        '스포츠 보면서 한 잔',
      ]},
      // 라운지바
      { key: 'lounge_bar', titles: [
        '라운지에서 여유롭게 한 잔',
        '호텔 라운지 바 가볼까요?',
        '분위기 있는 곳 찾아요',
        '고급스럽게 한 잔 해요',
      ]},
      // 루프탑
      { key: 'rooftop', titles: [
        '루프탑에서 야경 볼까요?',
        '하늘 아래서 한 잔 해요',
        '노을 보러 루프탑 가요',
        '시원한 바람 맞으며 한 잔',
        '탁 트인 뷰가 그리워요',
      ]},
      // 스파
      { key: 'spa', titles: [
        '힐링이 필요한 오늘',
        '마사지 받고 싶어요',
        '스파에서 쉬어갈래요',
        '몸이 뻐근할 때는 스파죠',
        '오늘은 나를 위한 시간',
      ]},
      // 피트니스
      { key: 'fitness', titles: [
        '오늘은 운동하는 날이에요',
        '땀 흘리러 가볼까요?',
        '클라이밍 도전해볼래요?',
        '헬스장 가야 하는데...',
        '운동하면 기분이 좋아져요',
      ]},
      // 요가
      { key: 'yoga', titles: [
        '요가로 시작하는 하루',
        '필라테스 하러 갈까요?',
        '스트레칭이 필요해요',
        '마음을 가라앉히는 시간',
      ]},
      // 플라워카페
      { key: 'flower_cafe', titles: [
        '꽃과 함께하는 시간',
        '플라워 카페 가볼까요?',
        '예쁜 꽃 구경하고 싶어요',
        '향긋한 꽃향기 맡으러',
      ]},
      // 펫프렌들리
      { key: 'pet_friendly', titles: [
        '반려동물과 함께 가요',
        '펫 프렌들리 카페 찾아요',
        '우리 아이랑 갈 수 있는 곳',
        '고양이 카페 가볼까요?',
        '강아지랑 산책하기 좋은 곳',
      ]},
      // 사진
      { key: 'photo_studio', titles: [
        '인생샷 찍으러 가요',
        '사진 찍기 좋은 곳 있나요?',
        '포토존 있는 곳 찾아요',
        '오늘은 사진 찍는 날',
      ]},
      // 치킨
      { key: 'chicken', titles: [
        '치킨이 먹고 싶어요',
        '치맥 한 판 어때요?',
        '바삭한 치킨 땡기는 날',
        '오늘 저녁은 치킨이다',
        '양념이냐 후라이드냐',
      ]},
      // 해산물
      { key: 'seafood', titles: [
        '회 먹으러 갈까요?',
        '신선한 해산물이 땡겨요',
        '조개구이 먹고 싶어요',
        '오늘은 해산물 파티',
        '회 한 접시 어떠세요?',
      ]},
      // 고기
      { key: 'meat', titles: [
        '고기 굽고 싶은 날이에요',
        '소고기가 땡겨요',
        '삼겹살 먹으러 가요',
        '오늘은 BBQ 타임',
        '고기 앞에서 행복해져요',
      ]},
      // 면 요리
      { key: 'noodle', titles: [
        '면 요리가 땡기는 날',
        '칼국수 먹으러 갈까요?',
        '시원한 냉면 어때요?',
        '우동 한 그릇 후루룩',
        '쫄면이 먹고 싶어요',
      ]},
      // 분식
      { key: 'snack_bar', titles: [
        '분식 먹고 싶어요',
        '떡볶이 땡기는 날',
        '김밥 한 줄 말아요',
        '라볶이 먹으러 가요',
        '튀김이랑 떡볶이 조합',
      ]},
      // 죽/국밥
      { key: 'porridge', titles: [
        '따뜻한 국물이 생각나요',
        '해장이 필요할 때',
        '뜨끈한 죽 한 그릇',
        '국밥 먹으러 갈까요?',
        '속이 편한 게 좋아요',
      ]},
      // 샐러드
      { key: 'salad', titles: [
        '건강한 한 끼 먹어요',
        '오늘은 샐러드로 가볍게',
        '비건 맛집 찾고 있어요',
        '다이어트 중인데...',
        '신선한 채소가 필요해요',
      ]},
      // 이자카야
      { key: 'izakaya', titles: [
        '이자카야 가볼까요?',
        '사케 한 잔 어때요?',
        '일본식 선술집 가요',
        '안주가 맛있는 곳',
        '꼬치 먹으러 가요',
      ]},
      // 노포
      { key: 'pojangmacha', titles: [
        '추억의 맛집 가요',
        '오래된 그 집 알아요?',
        '노포 맛집 탐방',
        '옛날 맛 그대로',
      ]},
      // 테라스
      { key: 'terrace', titles: [
        '테라스에서 먹고 싶어요',
        '야외에서 식사해요',
        '바람 맞으며 밥 먹어요',
        '날씨 좋은데 테라스 가요',
      ]},
      // 심야
      { key: 'late_night', titles: [
        '늦은 밤 갈 곳 찾아요',
        '야식 먹으러 갈까요?',
        '이 밤에 배고파요',
        '심야 맛집 알려주세요',
        '밤에 열린 곳 어디 있나요?',
      ]},
      // 키즈
      { key: 'kids_friendly', titles: [
        '아이랑 함께 가기 좋은 곳',
        '키즈 카페 갈까요?',
        '가족 식사하기 좋은 곳',
        '아이가 좋아하는 곳 찾아요',
        '놀이시설 있는 식당',
      ]},
      // 뷰
      { key: 'view', titles: [
        '뷰 맛집 가고 싶어요',
        '야경 보러 갈까요?',
        '한강뷰 카페 찾아요',
        '전망 좋은 곳 알려주세요',
        '멋진 뷰 보면서 한 잔',
      ]},
      // 족발/보쌈
      { key: 'jokbal', titles: [
        '족발이 땡기는 밤',
        '보쌈 먹을 사람 있어요?',
        '야식은 역시 족발이죠',
        '쫀득한 족발 먹고 싶어요',
        '막국수랑 보쌈 조합',
      ]},
      // 곱창
      { key: 'gopchang', titles: [
        '곱창 먹으러 가요',
        '막창이 땡기는 날',
        '철판 곱창 어때요?',
        '곱창에 소주 한 잔',
      ]},
      // 탕/찌개
      { key: 'stew', titles: [
        '뜨끈한 찌개 먹어요',
        '탕이 생각나는 날',
        '김치찌개 먹고 싶어요',
        '순두부찌개 맛집 가요',
        '된장찌개 보글보글',
        '부대찌개 땡기는 날',
      ]},
      // 샤브샤브
      { key: 'shabu', titles: [
        '샤브샤브 어떠세요?',
        '훠궈 먹으러 갈까요?',
        '따끈한 국물이 땡겨요',
        '채소 듬뿍 샤브샤브',
      ]},
      // 뷔페
      { key: 'buffet', titles: [
        '오늘은 뷔페 가는 날',
        '맘껏 먹고 싶어요',
        '호텔 뷔페 어때요?',
        '가성비 뷔페 찾아요',
      ]},
      // 호프
      { key: 'hof', titles: [
        '호프집 가서 한 잔 해요',
        '맥주 한 잔 하러 갈까요?',
        '호프집 안주가 땡겨요',
        '생맥주 마시러 가요',
      ]},
      // 막걸리
      { key: 'makgeolli', titles: [
        '막걸리 한 잔 어때요?',
        '파전에 막걸리 최고죠',
        '전통주 바 가볼까요?',
        '비 오는 날엔 막걸리',
      ]},
      // 한옥
      { key: 'hanok', titles: [
        '한옥에서 쉬어가요',
        '한옥 카페 가볼까요?',
        '전통 분위기 느껴요',
        '고즈넉한 한옥 찾아요',
      ]},
      // 레트로
      { key: 'retro', titles: [
        '레트로 감성 어때요?',
        '복고풍 카페 가요',
        '뉴트로 핫플 탐방',
        '옛날 감성 좋아해요',
      ]},
      // 대형카페
      { key: 'large_cafe', titles: [
        '넓은 카페 찾고 있어요',
        '단체로 갈 카페 추천해요',
        '여유롭게 앉을 수 있는 곳',
        '좌석 넉넉한 카페',
      ]},
      // 프라이빗
      { key: 'private', titles: [
        '조용히 얘기할 곳 찾아요',
        '룸 있는 식당 있나요?',
        '단체 모임 장소 추천해요',
        '프라이빗한 공간 필요해요',
      ]},
      // 인스타감성
      { key: 'instagrammable', titles: [
        '인스타 감성 넘치는 곳',
        '요즘 핫플 가볼까요?',
        '사진 맛집 찾아요',
        '인스타에서 본 그 곳',
        'SNS 핫한 곳 알려줘요',
      ]},
      // 신상
      { key: 'new_place', titles: [
        '새로 생긴 곳 가볼까요?',
        '요즘 뜨는 곳 있나요?',
        '신상 맛집 탐방해요',
        '오픈한 지 얼마 안 된 곳',
      ]},
      // 가성비
      { key: 'value', titles: [
        '가성비 맛집 알려줘요',
        '저렴하고 맛있는 곳',
        '가격 대비 최고인 곳',
        '학생도 갈 수 있는 맛집',
      ]},
      // 파인다이닝
      { key: 'fine_dining', titles: [
        '특별한 날 어디 갈까요?',
        '파인다이닝 도전해요',
        '기념일 레스토랑 찾아요',
        '고급 식사 하고 싶어요',
        '오늘은 특별한 식사',
      ]},
      // 오므라이스
      { key: 'omurice', titles: [
        '폭신한 오므라이스 먹고 싶어요',
        '오므라이스 맛집 어디예요?',
        '계란이 촉촉한 그 맛',
      ]},
      // 카레
      { key: 'curry', titles: [
        '카레가 먹고 싶어요',
        '일본식 카레 땡기는 날',
        '진한 카레 향이 그리워요',
        '카츠카레 먹으러 가요',
      ]},
      // 멕시칸
      { key: 'mexican', titles: [
        '타코 파티 할까요?',
        '부리또 먹으러 가요',
        '멕시칸 음식 먹고 싶어요',
        '나쵸 먹으면서 한 잔',
      ]},
      // 지중해
      { key: 'mediterranean', titles: [
        '지중해 음식 어때요?',
        '건강하게 지중해식으로',
        '그릭 샐러드가 땡겨요',
        '올리브 오일 향 가득',
      ]},
      // 이탈리안
      { key: 'italian', titles: [
        '정통 이탈리안 먹어요',
        '트라토리아 가볼까요?',
        '이탈리안 레스토랑 추천',
        '와인이랑 파스타 조합',
      ]},
      // 프렌치
      { key: 'french', titles: [
        '프렌치 레스토랑 가요',
        '비스트로에서 식사해요',
        '프랑스 요리 먹고 싶어요',
        '코스 요리 어떠세요?',
      ]},
      // 보드게임
      { key: 'board_game', titles: [
        '보드게임 하러 갈까요?',
        '게임하면서 놀아요',
        '보드게임 카페 가요',
        '머리 쓰는 게임 좋아해요',
      ]},
      // 방탈출
      { key: 'escape_room', titles: [
        '방탈출 도전해볼까요?',
        '스릴 즐기러 가요',
        '방탈출 카페 어때요?',
        '추리 게임 좋아해요',
      ]},
      // 노래방
      { key: 'karaoke', titles: [
        '노래 부르러 갈까요?',
        '노래방 가고 싶어요',
        '스트레스 풀러 노래해요',
        '오늘은 노래방 가는 날',
      ]},
      // 볼링
      { key: 'bowling', titles: [
        '볼링 치러 가요',
        '스트라이크 칠 수 있을까?',
        '볼링장 가서 놀아요',
      ]},
      // 당구
      { key: 'billiards', titles: [
        '당구 한 게임 어때요?',
        '포켓볼 치러 갈까요?',
        '당구장 가요',
      ]},
      // 골프
      { key: 'golf', titles: [
        '스크린 골프 치러 가요',
        '골프 연습하고 싶어요',
        '스윙 연습해야 하는데',
      ]},
      // 수영
      { key: 'swimming', titles: [
        '수영하러 갈까요?',
        '물 속에서 힐링해요',
        '수영장 가고 싶어요',
      ]},
      // 테니스
      { key: 'tennis', titles: [
        '테니스 치러 가요',
        '라켓 스포츠 하고 싶어요',
        '테니스 코트 예약할까요?',
      ]},
      // 캠핑
      { key: 'camping', titles: [
        '캠핑 가고 싶어요',
        '글램핑 어때요?',
        '자연에서 하룻밤',
        '바베큐 하면서 캠핑',
      ]},
      // 펜션
      { key: 'pension', titles: [
        '펜션에서 쉬고 싶어요',
        '조용히 쉬러 갈까요?',
        '자연 속 펜션 찾아요',
      ]},
      // 호텔
      { key: 'hotel', titles: [
        '호캉스 갈까요?',
        '호텔에서 하룻밤',
        '럭셔리 호캉스 해요',
        '호텔 스파 가고 싶어요',
      ]},
      // 놀이공원
      { key: 'amusement_park', titles: [
        '놀이공원 가볼까요?',
        '롤러코스터 타고 싶어요',
        '신나게 놀러 가요',
      ]},
      // 동물원
      { key: 'zoo', titles: [
        '동물원 나들이 갈까요?',
        '귀여운 동물 보러 가요',
        '아이랑 동물원 가요',
      ]},
      // 아쿠아리움
      { key: 'aquarium', titles: [
        '아쿠아리움 가볼까요?',
        '물고기 구경 가요',
        '바다 생물 보고 싶어요',
      ]},
      // 식물원
      { key: 'botanical_garden', titles: [
        '식물원 산책 어때요?',
        '수목원에서 힐링해요',
        '초록초록한 곳 가고 싶어요',
        '꽃 구경 하러 가요',
      ]},
      // 등산
      { key: 'hiking', titles: [
        '등산 가볼까요?',
        '가벼운 트레킹 어때요?',
        '산에 가고 싶어요',
        '정상에서 풍경 보고 싶어요',
      ]},
      // 드라이브
      { key: 'drive', titles: [
        '드라이브 코스 추천해요',
        '야경 드라이브 갈까요?',
        '달리면서 힐링해요',
        '해안도로 드라이브',
      ]},
      // 전통시장
      { key: 'traditional_market', titles: [
        '시장 구경 갈까요?',
        '시장 먹거리 탐방',
        '전통시장의 맛',
        '시장에서 보물찾기',
      ]},
      // 백화점
      { key: 'department', titles: [
        '백화점 쇼핑 갈까요?',
        '아울렛 가볼까요?',
        '백화점 구경 가요',
        '세일 기간이래요',
      ]},
      // 빈티지
      { key: 'vintage', titles: [
        '빈티지샵 투어 해요',
        '구제 쇼핑 갈까요?',
        '유니크한 아이템 찾아요',
        '빈티지 감성 좋아해요',
      ]},
      // 네일
      { key: 'nail', titles: [
        '네일 받으러 갈까요?',
        '손톱 예쁘게 하고 싶어요',
        '네일샵 추천해주세요',
      ]},
      // 헤어
      { key: 'hair', titles: [
        '머리 하러 갈까요?',
        '스타일 바꾸고 싶어요',
        '바버샵 추천해주세요',
        '펌 하고 싶어요',
      ]},
      // 피부관리
      { key: 'skincare', titles: [
        '피부 관리 받고 싶어요',
        '피부 좋아지고 싶어요',
        '에스테틱 가볼까요?',
      ]},
      // 사우나
      { key: 'sauna', titles: [
        '찜질방 가고 싶어요',
        '사우나 하러 갈까요?',
        '땀 빼러 가요',
        '찜질방에서 계란 먹고 싶어요',
      ]},
      // 만화카페
      { key: 'manga_cafe', titles: [
        '만화책 읽으러 갈까요?',
        '만화카페에서 여유롭게',
        '밀린 만화 읽어야 해요',
      ]},
      // PC방
      { key: 'pc_room', titles: [
        '게임하러 갈까요?',
        'PC방 가서 놀아요',
        '같이 게임 한 판 해요',
      ]},
      // VR
      { key: 'vr', titles: [
        'VR 체험 해볼까요?',
        '가상현실 즐기러 가요',
        'VR 게임 하고 싶어요',
      ]},
      // 포차
      { key: 'indoor_pocha', titles: [
        '포차에서 한 잔 해요',
        '포차 감성 좋아해요',
        '실내포차 가볼까요?',
        '포장마차 분위기 즐겨요',
      ]},
      // 생선구이
      { key: 'grilled_fish', titles: [
        '생선구이 먹으러 갈까요?',
        '고등어 구이 땡기는 날',
        '밥이랑 생선 조합 최고',
      ]},
      // 장어
      { key: 'eel', titles: [
        '장어 먹으러 갈까요?',
        '보양식이 필요해요',
        '힘이 나는 장어 한 상',
      ]},
      // 닭요리
      { key: 'chicken_dish', titles: [
        '닭볶음탕 먹을까요?',
        '찜닭 어떠세요?',
        '삼계탕 먹으러 가요',
        '닭갈비 땡기는 날',
        '닭한마리 어때요?',
      ]},
      // 오리
      { key: 'duck', titles: [
        '오리고기 먹으러 갈까요?',
        '훈제오리 맛집 가요',
        '오리 한 마리 구워요',
      ]},
      // 양꼬치
      { key: 'lamb_skewer', titles: [
        '양꼬치 먹을까요?',
        '양꼬치에 칭따오 조합',
        '꼬치 구워 먹고 싶어요',
      ]},
      // 대창
      { key: 'beef_tripe', titles: [
        '대창 구워 먹어요',
        '대창 맛집 알려줘요',
        '불 위의 대창 보고 싶어요',
      ]},
      // 순대
      { key: 'sundae', titles: [
        '순대 먹으러 갈까요?',
        '뜨끈한 순대국 한 그릇',
        '순대볶음도 맛있어요',
      ]},
      // 야식
      { key: 'late_night_food', titles: [
        '야식 시킬까요?',
        '늦은 밤 뭐 먹지?',
        '야식 메뉴 고민 중이에요',
        '밤에 배고플 때',
      ]},
      // 샌드위치
      { key: 'sandwich', titles: [
        '샌드위치 한 입 어때요?',
        '간단하게 샌드위치',
        '든든한 샌드위치 먹어요',
      ]},
      // 핫도그
      { key: 'hotdog', titles: [
        '핫도그 먹으러 갈까요?',
        '바삭한 핫도그 땡겨요',
        '간식으로 핫도그',
      ]},
      // 토스트
      { key: 'toast', titles: [
        '토스트 맛집 가요',
        '고소한 토스트 먹고 싶어요',
        '아침엔 토스트죠',
      ]},
      // 만두
      { key: 'dumpling', titles: [
        '만두 먹으러 갈까요?',
        '군만두가 땡기는 날',
        '찐만두도 좋아요',
        '만둣국 먹고 싶어요',
      ]},
      // 떡
      { key: 'rice_cake', titles: [
        '떡 사러 갈까요?',
        '쫀득한 떡 먹고 싶어요',
        '떡집 추천해주세요',
      ]},
      // 주스
      { key: 'juice', titles: [
        '생과일 주스 마셔요',
        '스무디 마시러 갈까요?',
        '상큼한 주스 땡기는 날',
        '비타민 충전 시간',
      ]},
      // 차
      { key: 'tea', titles: [
        '차 한 잔의 여유',
        '찻집 가볼까요?',
        '따뜻한 차가 생각나요',
        '티타임 가져요',
      ]},
      // 빙수
      { key: 'bingsu', titles: [
        '빙수 먹으러 갈까요?',
        '시원한 게 먹고 싶어요',
        '팥빙수가 땡기는 날',
        '더운데 빙수 어때요?',
      ]},
      // 와플
      { key: 'waffle', titles: [
        '와플 먹으러 가요',
        '크로플 맛집 찾아요',
        '바삭한 와플 먹고 싶어요',
      ]},
      // 도넛
      { key: 'donut', titles: [
        '도넛 먹을까요?',
        '달콤한 도넛 땡기는 날',
        '도넛 맛집 가요',
      ]},
      // 타르트
      { key: 'tart', titles: [
        '타르트 먹으러 갈까요?',
        '에그타르트 맛집 가요',
        '과일타르트 먹고 싶어요',
      ]},
      // 초콜릿
      { key: 'chocolate', titles: [
        '핫초코 마시러 가요',
        '달달한 초콜릿 먹고 싶어요',
        '초콜릿 디저트 땡겨요',
      ]},
      // 쿠키
      { key: 'cookie', titles: [
        '쿠키 먹을까요?',
        '갓 구운 쿠키 냄새',
        '쿠키 맛집 가요',
      ]},
      // 스콘
      { key: 'scone', titles: [
        '스콘 맛집 찾아요',
        '스콘이랑 잼 조합',
        '바삭한 스콘 먹고 싶어요',
      ]},
      // 피자
      { key: 'pizza', titles: [
        '피자 먹으러 갈까요?',
        '피자 한 판 시킬까요?',
        '치즈 늘어나는 피자',
        '피자가 땡기는 밤',
      ]},
      // 버거
      { key: 'burger', titles: [
        '버거 먹으러 가요',
        '수제버거 맛집 찾아요',
        '육즙 가득 버거 먹고 싶어요',
        '햄버거가 땡기는 날',
      ]},
      // 타코야끼
      { key: 'takoyaki', titles: [
        '타코야끼 먹을까요?',
        '일본 간식 생각나요',
        '뜨끈한 타코야끼',
      ]},
      // 라면
      { key: 'ramen', titles: [
        '라멘 먹으러 갈까요?',
        '진한 육수가 땡겨요',
        '라멘 맛집 가요',
        '돈코츠 라멘 먹고 싶어요',
      ]},
      // 초밥
      { key: 'sushi', titles: [
        '스시 먹으러 갈까요?',
        '회전초밥 어때요?',
        '오마카세 도전해볼까요?',
        '신선한 초밥 먹고 싶어요',
      ]},
      // 야키토리
      { key: 'yakitori', titles: [
        '꼬치 구워 먹을까요?',
        '야키토리 가볼까요?',
        '닭꼬치 맛집 가요',
      ]},
      // 라이브바
      { key: 'live_bar', titles: [
        '라이브 음악 듣고 싶어요',
        '밴드 공연 보러 갈까요?',
        '음악이 있는 바',
      ]},
      // 재즈바
      { key: 'jazz_bar', titles: [
        '재즈바 가볼까요?',
        '재즈 들으면서 한 잔',
        '분위기 있는 재즈바',
      ]},
      // 클럽
      { key: 'club', titles: [
        '클럽 가서 놀까요?',
        '신나게 놀고 싶어요',
        '춤추러 갈까요?',
      ]},
      // 스터디카페
      { key: 'study_cafe', titles: [
        '공부하러 갈까요?',
        '조용히 작업할 곳 찾아요',
        '스터디카페 추천해요',
        '집중할 수 있는 곳',
      ]},
      // 코워킹스페이스
      { key: 'coworking', titles: [
        '일하기 좋은 곳 찾아요',
        '코워킹 스페이스 어때요?',
        '노트북 작업할 곳',
      ]},
      // 사진관
      { key: 'photo_booth', titles: [
        '사진 찍으러 갈까요?',
        '셀프사진관 가요',
        '추억 남기러 가요',
        '인생네컷 찍을까요?',
      ]},
      // 플리마켓
      { key: 'flea_market', titles: [
        '플리마켓 구경 갈까요?',
        '핸드메이드 제품 구경해요',
        '주말 마켓 어때요?',
      ]},
      // 브이로그맛집
      { key: 'vlog_spot', titles: [
        '브이로그에서 본 그 곳',
        '유튜버가 다녀간 맛집',
        '영상에서 봤던 곳 가요',
      ]},
      // 웨이팅맛집
      { key: 'waiting_spot', titles: [
        '웨이팅 해도 가치 있는 곳',
        '줄 서서 먹는 맛집',
        '기다려도 맛있는 곳',
      ]},
      // 혼밥
      { key: 'solo_dining', titles: [
        '혼밥하기 좋은 곳 찾아요',
        '혼자 먹기 편한 식당',
        '1인 식사 가능한 곳',
      ]},
      // 데이트
      { key: 'date_spot', titles: [
        '데이트하기 좋은 곳 어디예요?',
        '분위기 좋은 데이트 장소',
        '연인이랑 갈 곳 추천해요',
      ]},
      // 모임
      { key: 'group_dining', titles: [
        '단체 모임 장소 찾아요',
        '회식 장소 추천해주세요',
        '여러 명이 갈 곳 찾아요',
      ]},
      // 접대
      { key: 'business_dining', titles: [
        '비즈니스 미팅 장소 찾아요',
        '접대하기 좋은 식당',
        '중요한 자리에 어울리는 곳',
      ]},
    ];

    // 현재 시간대에 맞는 카테고리 우선 정렬
    if (currentSlot) {
      const primaryKeys = new Set(currentSlot.primary);
      const slotTitles = currentSlot.titles || {};

      // 우선순위 카테고리와 나머지 분리
      const priorityCategories = [];
      const otherCategories = [];

      baseCategories.forEach(cat => {
        // 랜덤하게 하나의 타이틀 선택
        const randomTitle = cat.titles[Math.floor(Math.random() * cat.titles.length)];

        if (primaryKeys.has(cat.key)) {
          // 시간대에 맞는 타이틀 사용 (있으면 시간대 타이틀, 없으면 랜덤)
          priorityCategories.push({
            key: cat.key,
            title: slotTitles[cat.key] || randomTitle
          });
        } else {
          otherCategories.push({
            key: cat.key,
            title: randomTitle
          });
        }
      });

      // 우선순위 카테고리를 시간대 정의 순서대로 정렬
      priorityCategories.sort((a, b) => {
        const aIndex = currentSlot.primary.indexOf(a.key);
        const bIndex = currentSlot.primary.indexOf(b.key);
        return aIndex - bIndex;
      });

      // 나머지는 랜덤 셔플
      const shuffledOthers = otherCategories.sort(() => Math.random() - 0.5);

      return [...priorityCategories, ...shuffledOthers];
    }

    // 시간대 정보가 없으면 랜덤 셔플
    return baseCategories.map(cat => ({
      key: cat.key,
      title: cat.titles[Math.floor(Math.random() * cat.titles.length)]
    })).sort(() => Math.random() - 0.5);
  })();

  // 시간대 기반으로 정렬된 카테고리 (중복 제거)
  const getTimeBasedSortedCategories = () => {
    // 이미 시간대별로 정렬된 allCategories 사용
    // 중복 key 제거 (첫 번째 항목만 유지)
    const seen = new Set();
    const unique = allCategories.filter(cat => {
      if (seen.has(cat.key)) return false;
      seen.add(cat.key);
      return true;
    });
    return unique;
  };

  const [fixedCategories] = useState(() => getTimeBasedSortedCategories());

  // Lazy loading state for categories
  const INITIAL_CATEGORIES_COUNT = 10; // Load 10 categories initially for better UX
  const CATEGORIES_BATCH_SIZE = 5; // Load 5 more categories when scrolling
  const [loadedCategoryCount, setLoadedCategoryCount] = useState(INITIAL_CATEGORIES_COUNT);
  const [isLoadingMoreCategories, setIsLoadingMoreCategories] = useState(false);
  const categoryLoaderRef = useRef(null);

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
            location: formattedLocation,
            image: place.imageUrl || place.image,
            images: place.images || [],
            isBookmarked: place.isBookmarked || false
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

  // Load initial categories (first 5 only)
  useEffect(() => {
    let isMounted = true;

    const loadInitialCategories = async () => {
      if (!currentLocation || !isMounted) return;

      try {
        console.log('Loading initial categories for location:', currentLocation);

        // Only load the first few categories initially
        const initialCategories = fixedCategories.slice(0, INITIAL_CATEGORIES_COUNT);
        const placesPromises = initialCategories.map(category =>
          loadCategoryPlaces(category, currentLocation.latitude, currentLocation.longitude)
        );

        const placesResults = await Promise.all(placesPromises);

        if (isMounted) {
          // Filter categories that have places
          const categoriesWithPlaces = placesResults.filter(r => r.places.length > 0);
          setCategories(categoriesWithPlaces);

          // Build placesMap immediately for fast rendering
          const placesMap = {};
          categoriesWithPlaces.forEach(result => {
            placesMap[result.key] = {
              title: result.title,
              places: result.places
            };
          });

          setCategoriesPlaces(placesMap);
          setSectionsLoading(prev => ({ ...prev, categories: false }));
          console.log('Initial categories loaded:', categoriesWithPlaces.length);

          // Apply bookmark status asynchronously
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
                        isBookmarked: bookmarkMap.get(place.id) || false
                      }))
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
          setSectionsLoading(prev => ({ ...prev, categories: false }));
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
              // Set data immediately for fast rendering
              const updatedPlacesMap = { ...categoriesPlaces };
              newCategoriesWithPlaces.forEach(result => {
                updatedPlacesMap[result.key] = {
                  title: result.title,
                  places: result.places
                };
              });

              setCategories(prev => [...prev, ...newCategoriesWithPlaces]);
              setCategoriesPlaces(updatedPlacesMap);

              // Apply bookmark status asynchronously
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
                                isBookmarked: bookmarkMap.get(place.id) || false
                              }))
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
      { rootMargin: '200px' } // Start loading before the element is visible
    );

    observer.observe(categoryLoaderRef.current);

    return () => {
      isMounted = false;
      observer.disconnect();
    };
  }, [currentLocation, loadedCategoryCount, isLoadingMoreCategories, fixedCategories, categoriesPlaces]);

  // Load recommendations based on login status
  useEffect(() => {
    let isMounted = true;

    const loadHomeRecommendations = async () => {
      try {
        console.log('Loading recommendations based on user status...');

        // Check if user is logged in
        const isLoggedIn = user && user.id && user.id !== 'guest';

        if (isLoggedIn) {
          console.log('👤 User is logged in, loading MBTI-based recommendations');
          await loadMBTIRecommendations(isMounted);
        } else {
          console.log('🌍 Guest user, loading weather/time-based recommendations');
          await loadWeatherTimeRecommendations(isMounted);
        }

      } catch (error) {
        console.warn('⚠️ Failed to load recommendations:', error);
        if (isMounted) {
          setHomeImages([]);
          setSectionsLoading(prev => ({ ...prev, homeImages: false }));
        }
      }
    };

    loadHomeRecommendations();

    return () => {
      isMounted = false;
    };
  }, [user]); // Reload when user changes

  const loadMBTIRecommendations = async (isMounted) => {
    try {
      const response = await homeService.getHomeImages();

      if (response.success && response.data.length > 0 && isMounted) {
        console.log('✅ MBTI recommendations loaded from database:', response.data.length);
        const transformedPlaces = response.data.map(place => {
          const addressStr = place.shortAddress || place.address || '';
          const formattedLocation = formatPlaceAddress(addressStr);

          return normalizePlaceImages({
            ...place,
            location: formattedLocation
          });
        });

        // Set data immediately for fast rendering
        setHomeImages(transformedPlaces);
        setSectionsLoading(prev => ({ ...prev, homeImages: false }));

        // Apply bookmark status asynchronously
        if (authService.isAuthenticated()) {
          bookmarkService.applyBookmarkStatus(transformedPlaces).then(placesWithBookmarks => {
            if (isMounted) {
              setHomeImages(placesWithBookmarks);
            }
          });
        }
      } else if (isMounted) {
        console.log('🎯 No backend data available, showing empty state');
        setHomeImages([]);
        setSectionsLoading(prev => ({ ...prev, homeImages: false }));
      }
    } catch {
      if (isMounted) {
        console.log('🎯 Backend unavailable, showing empty state');
        setHomeImages([]);
        setSectionsLoading(prev => ({ ...prev, homeImages: false }));
      }
    }
  };

  const loadWeatherTimeRecommendations = async (isMounted) => {
    try {
      console.log('🌤️ Weather recommendations unavailable, showing empty state');
      if (isMounted) {
        setHomeImages([]);
        setSectionsLoading(prev => ({ ...prev, homeImages: false }));
      }
    } catch {
      if (isMounted) {
        console.log('🌤️ Weather recommendations unavailable, showing empty state');
        setHomeImages([]);
        setSectionsLoading(prev => ({ ...prev, homeImages: false }));
      }
    }
  };



  const handleProfileClick = () => {
    if (!user || user.isGuest) {
      setShowLoginSheet(true);
      return;
    }
    navigate('/profile-settings');
  };

  const handleBookmarkToggle = async (placeId, isBookmarked) => {
    try {
      // Check if user is guest
      if (!user || user.isGuest) {
        setShowLoginSheet(true);
        return;
      }

      console.log(`Place ${placeId} bookmark toggled:`, isBookmarked);

      let response;
      if (isBookmarked) {
        response = await bookmarkService.addBookmark(placeId);
      } else {
        response = await bookmarkService.removeBookmark(placeId);
      }

      if (response.success) {
        setRecommendations(prevRecommendations =>
          prevRecommendations.map(place =>
            place.id === placeId
              ? { ...place, isBookmarked }
              : place
          )
        );
      } else {
        console.error('Failed to toggle bookmark:', response.message);
      }
    } catch (error) {
      console.error('Error toggling bookmark:', error);
    }
  };

  const handleSeeMore = () => {
    console.log('See more places clicked');
    navigate('/places');
  };

  const handleBannerClick = () => {
    console.log('Banner clicked');
    if (!user || user.isGuest) {
      setShowLoginSheet(true);
      return;
    }

    // Check if user has completed preference survey
    const hasCompletedSurvey = user.mbti && user.ageRange && user.spacePreferences;
    if (hasCompletedSurvey) {
      navigate('/search-results');
    } else {
      navigate('/age-range');
    }
  };

  const handlePlaceClick = (placeId) => {
    console.log('Place clicked:', placeId);

    // Find place in database arrays only - no fallback data
    let selectedPlace = recommendations.find(place => place.id === placeId) ||
                       homeImages.find(place => place.id === placeId) ||
                       popularPlaces.find(place => place.id === placeId) ||
                       nearbyPlaces.find(place => place.id === placeId) ||
                       recentlyViewed.find(place => place.id === placeId);

    // Also check category places
    if (!selectedPlace) {
      for (const categoryData of Object.values(categoriesPlaces)) {
        if (categoryData.places) {
          selectedPlace = categoryData.places.find(place => place.id === placeId);
          if (selectedPlace) break;
        }
      }
    }

    // If not found in any array, navigate without preloaded data
    if (!selectedPlace) {
      navigate(`/place/${placeId}`);
      return;
    }

    // Add to recently viewed
    addRecentlyViewed(selectedPlace);

    console.log('Selected place data:', selectedPlace);
    const preloadedImage = buildImageUrl(
      selectedPlace.image || selectedPlace.imageUrl || selectedPlace.images?.[0]
    );
    navigate(`/place/${placeId}`, {
      state: {
        preloadedImage,
        preloadedData: selectedPlace
      }
    });
  };

  // Get display location
  const getDisplayLocation = () => {
    if (currentLocation?.address) {
      return currentLocation.address;
    }

    if (addressLoading || locationLoading) {
      return '';
    }

    if (currentLocation) {
      return '주소를 불러올 수 없습니다';
    }

    return '위치 정보를 확인할 수 없습니다';
  };

  // Retry function for error handling
  const handleRetry = () => {
    setError(null);
    // Reset section loading states and reload
    setSectionsLoading({
      recommendations: true,
      nearby: true,
      popular: true,
      categories: true,
      homeImages: true
    });
    window.location.reload();
  };

  const handleCardKeyDown = (event, placeId) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handlePlaceClick(placeId);
    }
  };

  const renderPlacesSection = (title, places, {
    description,
    emptyMessage,
    footer,
    bookmarkable = true,
    sectionKey,
  } = {}) => {
    const key = sectionKey || title;

    if (!places || places.length === 0) {
      if (!emptyMessage) {
        return null;
      }

      return (
        <HomeSection key={`${key}-empty`} title={title} description={description}>
          <div className={`${styles.placeholderMessage} ${styles.placeholderMessageDense}`}>
            {emptyMessage}
          </div>
        </HomeSection>
      );
    }

    return (
      <HomeSection
        key={key}
        title={title}
        description={description}
        paddedBody={false}
        footer={footer}
      >
        <HomeHorizontalScroller>
          {places.map((place) => (
            <div
              key={place.id}
              className={styles.cardLink}
              role="button"
              tabIndex={0}
              onClick={() => handlePlaceClick(place.id)}
              onKeyDown={(event) => handleCardKeyDown(event, place.id)}
            >
              <PlaceCard
                title={place.title || place.name}
                rating={place.rating}
                location={place.location || place.category}
                image={place.image || place.imageUrl}
                images={place.images || []}
                isBookmarked={place.isBookmarked || false}
                onBookmarkToggle={bookmarkable ? ((isBookmarked) => handleBookmarkToggle(place.id, isBookmarked)) : undefined}
              />
            </div>
          ))}
        </HomeHorizontalScroller>
      </HomeSection>
    );
  };

  return (
    <div className={`${styles.pageContainer} ${isIOS ? styles.iosDevice : ''}`}>
      {/* Header - Always shown immediately */}
      <header className={styles.header}>
        <img src={logoHeader} alt="MOHE" className={styles.logo} />
        <div className={styles.headerSpacer} />
        <SearchBar onClick={() => setIsSearchModalOpen(true)} />
        <ProfileButton onClick={handleProfileClick} />
      </header>

      {/* Search Modal */}
      <SearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
      />

      {/* Location indicator */}
      <div className={styles.locationSection}>
        <LocationPin 
          location={getDisplayLocation()} 
          size="medium"
          loading={addressLoading || locationLoading}
        />
      </div>

      {/* Error message */}
      {error && (
        <div className={styles.errorWrapper}>
          <ErrorMessage 
            message={error}
            onRetry={handleRetry}
            onDismiss={() => setError(null)}
            variant="banner"
          />
        </div>
      )}

      {/* Main content - Progressive rendering with section-level skeletons */}
      <div className={styles.contentContainer}>
        <div className={styles.content}>
          {/* Primary Recommendations Section */}
          {sectionsLoading.recommendations && recommendations.length === 0 ? (
            <SectionSkeleton titleWidth="180px" />
          ) : (
            renderPlacesSection(dynamicMessage, recommendations, {
              sectionKey: 'primary-recommendations'
            })
          )}

          <div className={styles.bannerWrapper}>
            <HomeBanner
              title="지금 뭐하지?"
              description={`시간, 기분, 취향을 반영해서
당신에게 어울리는 곳을 골라봤어요.`}
              image={bannerLeft}
              onClick={handleBannerClick}
            />
          </div>

          {/* Nearby Places Section */}
          {sectionsLoading.nearby && nearbyPlaces.length === 0 ? (
            <SectionSkeleton titleWidth="120px" />
          ) : (
            nearbyPlaces.length > 0 && renderPlacesSection('내 주변 장소', nearbyPlaces, {
              description: '가까운 거리에 있는 장소들이에요',
              sectionKey: 'nearby-places'
            })
          )}

          {/* Home Images / Time Recommendations Section */}
          {sectionsLoading.homeImages && homeImages.length === 0 ? (
            <SectionSkeleton titleWidth="140px" />
          ) : (
            homeImages.length > 0 && renderPlacesSection(
              user && user.id && user.id !== 'guest' ? '당신을 위한 추천' : '지금 이 시간 추천',
              homeImages,
              { sectionKey: 'time-recommendations' }
            )
          )}

          {/* Category-based Sections */}
          {sectionsLoading.categories && categories.length === 0 ? (
            <>
              <SectionSkeleton titleWidth="160px" />
              <SectionSkeleton titleWidth="140px" />
            </>
          ) : (
            categories.length > 0 && categories.map((category) => {
              const categoryData = categoriesPlaces[category.key];
              if (!categoryData || !categoryData.places || categoryData.places.length === 0) {
                return null;
              }
              return renderPlacesSection(
                categoryData.title || category.title,
                categoryData.places,
                {
                  sectionKey: `category-${category.key}`,
                }
              );
            })
          )}

          {/* Lazy load trigger for more categories */}
          {loadedCategoryCount < fixedCategories.length && (
            <div
              ref={categoryLoaderRef}
              className={styles.categoryLoader}
              style={{ height: '40px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
            >
              {isLoadingMoreCategories && (
                <span style={{ color: '#7D848D', fontSize: '13px' }}>더 많은 카테고리 로딩 중...</span>
              )}
            </div>
          )}

          {/* Fallback if no category sections loaded */}
          {!sectionsLoading.categories && categories.length === 0 && popularPlaces.length > 0 &&
            renderPlacesSection('오늘은 이런 곳 어떠세요?', popularPlaces, {
              footer: (
                <OutlineButton onClick={handleSeeMore}>
                  더 많은 장소 보기
                </OutlineButton>
              ),
              sectionKey: 'popular-places',
            })}
        </div>
      </div>

      {/* Login Required Sheet */}
      <LoginRequiredSheet
        visible={showLoginSheet}
        onClose={() => setShowLoginSheet(false)}
        onLogin={() => {
          setShowLoginSheet(false);
          navigate('/login', { state: { from: '/home' } });
        }}
      />

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <span className={styles.footerLogo}>MOHE</span>

          <div className={styles.footerLinks}>
            <a href="#" className={styles.footerLink}>서비스 이용약관</a>
            <a href="#" className={styles.footerLink}>개인정보처리방침</a>
            <a href="#" className={styles.footerLink}>문의하기</a>
          </div>

          <div className={styles.footerDivider} />

          <div className={styles.footerBottom}>
            <p className={styles.footerText}>© 2025 MOHE. All rights reserved.</p>
            <a href="mailto:hello@mohe.app" className={styles.footerEmail}>hello@mohe.app</a>
          </div>
        </div>
      </footer>

    </div>
  );
}

const formatDisplayAddress = (addressData = {}) => {
  if (!addressData) return '';

  if (addressData.shortAddress) {
    return addressData.shortAddress;
  }

  if (addressData.fullAddress) {
    return addressData.fullAddress;
  }

  const hierarchy = [addressData.sido, addressData.sigungu, addressData.dong, addressData.eupMyeon, addressData.ri]
    .filter(Boolean)
    .join(' ');

  return hierarchy || '';
};
