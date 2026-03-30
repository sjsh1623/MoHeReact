import { useState, useEffect } from 'react';
import { useGeolocation, useLocationStorage } from '@/hooks/useGeolocation';
import { weatherService, contextualRecommendationService, bookmarkService, addressService, guestRecommendationService, placeService, homeService } from '@/services/apiService';
import { authService } from '@/services/authService';
import { formatPlaceAddress, formatDisplayAddress } from '@/utils/addressUtils';
import { normalizePlaceImages } from '@/utils/image';

/**
 * Custom hook that manages all data loading for the HomePage.
 * Handles user initialization, location, weather, recommendations,
 * popular places, nearby places, home images, and bookmarks.
 *
 * @param {Object|null} currentLocation - { latitude, longitude, address }
 * @param {Function} setCurrentLocation - state setter for currentLocation
 * @returns {Object} All home page data and loading states
 */
export function useHomeData(currentLocation, setCurrentLocation) {
  const { requestLocation, loading: locationLoading } = useGeolocation();
  const { saveLocation, getStoredLocation } = useLocationStorage();

  const [weather, setWeather] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [locationPermissionRequested, setLocationPermissionRequested] = useState(false);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(() => authService.getCurrentUser());
  const [popularPlaces, setPopularPlaces] = useState([]);
  const [homeImages, setHomeImages] = useState([]);
  const [nearbyPlaces, setNearbyPlaces] = useState([]);
  const [addressLoading, setAddressLoading] = useState(!getStoredLocation()?.address);
  const [dynamicMessage, setDynamicMessage] = useState('지금 가기 좋은 플레이스');
  const [showLoginSheet, setShowLoginSheet] = useState(false);

  // Section-level loading states for progressive rendering
  const [sectionsLoading, setSectionsLoading] = useState({
    recommendations: true,
    nearby: true,
    popular: true,
    homeImages: true,
  });

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

  // Initialize app only once on mount
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
        } else {
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

      if (!locationPermissionRequested) {
        setLocationPermissionRequested(true);
        setAddressLoading(true);
        try {
          const locationData = await requestLocation();

          if (locationData &&
              typeof locationData.latitude === 'number' &&
              typeof locationData.longitude === 'number' &&
              isMounted) {
            setCurrentLocation(locationData);
            fetch(`/api/location/register-user-area?lat=${locationData.latitude}&lng=${locationData.longitude}`, { method: 'POST' })
              .catch(() => {});
            await resolveAddress(locationData.latitude, locationData.longitude);
            await loadWeatherData(locationData.latitude, locationData.longitude);
          } else if (isMounted) {
            throw new Error('Invalid location data received');
          }
        } catch (error) {
          console.warn('Failed to get location:', error);
          const defaultLocation = {
            latitude: 37.5665,
            longitude: 126.9780,
            address: null,
          };
          if (isMounted) {
            setCurrentLocation(defaultLocation);
            await resolveAddress(defaultLocation.latitude, defaultLocation.longitude);
            await loadWeatherData(defaultLocation.latitude, defaultLocation.longitude);
          }
        }
      }
    };

    initializeApp();

    return () => {
      isMounted = false;
    };
  }, []);

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
              { limit: 10, maxDistance: 55000 }
            );

            console.log('HomePage: Guest response received:', guestResponse);
            console.log('HomePage: Guest response success:', guestResponse.success);
            console.log('HomePage: Guest response data length:', guestResponse.data?.length);

            if (guestResponse.dynamicMessage && isMounted) {
              setDynamicMessage(guestResponse.dynamicMessage);
              console.log('🎨 Guest dynamic message set:', guestResponse.dynamicMessage);
            }

            if (guestResponse.success && guestResponse.data.length > 0) {
              console.log('HomePage: Processing guest recommendations, count:', guestResponse.data.length);

              recommendationsData = guestResponse.data.map(place => {
                const addressStr = place.shortAddress || place.address || '';
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
                  reasonWhy: place.description,
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

        if (isMounted) {
          console.log('HomePage: About to set recommendations with data:', recommendationsData);
          setRecommendations(recommendationsData);
          setSectionsLoading(prev => ({ ...prev, recommendations: false }));
          console.log('HomePage: Successfully set recommendations');
        }

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

      console.log('🎯 Calling good-to-visit API with location:', {
        lat: currentLocation.latitude,
        lon: currentLocation.longitude,
      });

      const response = await contextualRecommendationService.getGoodToVisitRecommendations(
        currentLocation.latitude,
        currentLocation.longitude,
        { limit: 10 }
      );

      console.log('✅ Good-to-visit API response:', response);

      const parsed = contextualRecommendationService.parseGoodToVisitResponse(response);
      console.log('📝 Parsed response:', parsed);

      if (parsed.dynamicMessage) {
        setDynamicMessage(parsed.dynamicMessage);
        console.log('🎨 Dynamic message set:', parsed.dynamicMessage);
      }

      if (parsed.places && parsed.places.length > 0) {
        return parsed.places.map(place => {
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
            reasonWhy: place.reasonWhy,
          });
        });
      }
      return [];
    };

    const loadGeneralRecommendations = async () => {
      const response = await placeService.getRecommendations();

      if (response.success && response.data.recommendations && response.data.recommendations.length > 0) {
        return response.data.recommendations.map(place => {
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
            reasonWhy: place.reasonWhy || null,
          });
        });
      }
      return [];
    };

    const loadBookmarkStatus = async (places) => {
      if (user.isGuest || !places.length || !authService.isAuthenticated()) {
        console.log('Skipping bookmark status checks for guest user or unauthenticated state');
        return places.map(place => ({ ...place, isBookmarked: false }));
      }

      try {
        console.log('Loading bookmark status for', places.length, 'places');
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

  // Load bookmark-based popular places
  useEffect(() => {
    let isMounted = true;

    const loadBookmarkBasedPlaces = async () => {
      if (!currentLocation || !isMounted) return;

      try {
        console.log('Loading bookmark-based places for location:', currentLocation);
        const response = await placeService.getBookmarkBasedRecommendations(
          currentLocation.latitude,
          currentLocation.longitude,
          { limit: 15, distance: 50.0 }
        );

        if (response.success && isMounted) {
          console.log('✅ Bookmark-based places loaded:', response.data.length);
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
            });
          });

          setPopularPlaces(transformedPlaces);
          setSectionsLoading(prev => ({ ...prev, popular: false }));

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
          { radius: 3000, limit: 10 }
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
              distance: place.distance,
            });
          });

          setNearbyPlaces(transformedPlaces);
          setSectionsLoading(prev => ({ ...prev, nearby: false }));

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

  // Load MBTI or weather/time recommendations based on login status
  useEffect(() => {
    let isMounted = true;

    const loadHomeRecommendations = async () => {
      try {
        console.log('Loading recommendations based on user status...');

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
  }, [user]);

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
            location: formattedLocation,
          });
        });

        setHomeImages(transformedPlaces);
        setSectionsLoading(prev => ({ ...prev, homeImages: false }));

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

  // Bookmark toggle handler
  const handleBookmarkToggle = async (placeId, isBookmarked) => {
    try {
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

  // Retry function for error handling
  const handleRetry = () => {
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
