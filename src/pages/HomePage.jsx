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
import { getTimeBasedSortedCategories } from '@/constants/categoryData';

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

  const [fixedCategories, setFixedCategories] = useState(() => getTimeBasedSortedCategories());
  const [mbtiRow, setMbtiRow] = useState(null);

  // Fetch backend category order + MBTI row
  useEffect(() => {
    const fetchHomeCategories = async () => {
      if (!currentLocation) return;
      try {
        const user = authService.getUser();
        const mbti = user?.mbti || null;
        const response = await categoryService.getHomeCategories(
          currentLocation.latitude, currentLocation.longitude, mbti
        );
        if (response?.data) {
          const data = response.data;

          // MBTI 첫줄
          if (data.mbtiRow) {
            setMbtiRow(data.mbtiRow);
          }

          // 백엔드 카테고리 순서로 재정렬 (타이틀은 기존 프론트 것 유지)
          if (data.categoryRows) {
            const backendOrder = data.categoryRows.map(r => r.key);
            const baseCats = getTimeBasedSortedCategories();
            const catMap = {};
            baseCats.forEach(c => { catMap[c.key] = c; });

            // 백엔드 순서 우선 + 나머지
            const ordered = [];
            const seen = new Set();
            backendOrder.forEach(key => {
              if (catMap[key] && !seen.has(key)) {
                ordered.push(catMap[key]);
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
        }
      } catch (e) {
        // 실패해도 기존 프론트 정렬 유지
        console.debug('Home categories API failed, using client-side sorting');
      }
    };
    fetchHomeCategories();
  }, [currentLocation]);

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

          {/* MBTI-based Row (logged in users only) */}
          {mbtiRow && mbtiRow.places && mbtiRow.places.length > 0 && (
            renderPlacesSection(
              mbtiRow.title,
              mbtiRow.places.map(p => ({
                id: p.id,
                name: p.name,
                rating: p.rating,
                roadAddress: p.roadAddress,
                formattedAddress: p.roadAddress ? formatPlaceAddress(p.roadAddress) : '',
                distance: p.distance,
                primaryImageUrl: p.imageUrl ? buildImageUrl(p.imageUrl) : null,
                images: p.imageUrl ? [{ url: buildImageUrl(p.imageUrl) }] : [],
                category: p.category,
              })),
              { sectionKey: 'mbti-recommendations' }
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
