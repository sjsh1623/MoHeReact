import { useState, useEffect, useCallback } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

/**
 * Custom hook for handling geolocation with permission management
 * Uses Capacitor Geolocation for native platforms (iOS/Android) and falls back to web API
 */
export const useGeolocation = (options = {}) => {
  const [location, setLocation] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [permission, setPermission] = useState(null);

  const defaultOptions = {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 300000, // 5 minutes
    ...options
  };

  // Check geolocation permission status
  const checkPermission = useCallback(async () => {
    // Use Capacitor for native platforms
    if (Capacitor.isNativePlatform()) {
      try {
        const permissionStatus = await Geolocation.checkPermissions();
        const state = permissionStatus.location;
        setPermission(state);
        return state;
      } catch (err) {
        console.warn('Capacitor permission check failed:', err);
        return 'prompt';
      }
    }

    // Fallback to web API
    if (!navigator.permissions) {
      return 'unsupported';
    }

    try {
      const result = await navigator.permissions.query({ name: 'geolocation' });
      setPermission(result.state);

      // Listen for permission changes
      result.onchange = () => {
        setPermission(result.state);
      };

      return result.state;
    } catch (err) {
      console.warn('Permission API not supported:', err);
      return 'unsupported';
    }
  }, []);

  /**
   * Extract coordinates from various position object formats
   * Handles both Capacitor native and Web Geolocation API formats
   * @param {object} position - Position object from Geolocation API
   * @returns {object|null} - Normalized location data or null if invalid
   */
  const extractCoordinates = useCallback((position) => {
    if (!position) return null;

    let latitude = null;
    let longitude = null;
    let accuracy = null;
    let timestamp = Date.now();

    // Try to extract coords from standard structure
    const coords = position.coords;

    if (coords) {
      // Standard Web/Capacitor format: position.coords.latitude/longitude
      if (coords.latitude !== undefined && coords.longitude !== undefined) {
        latitude = coords.latitude;
        longitude = coords.longitude;
        accuracy = coords.accuracy;
      }
      // Alternative format: coords might be an array [lat, lng] or {lat, lng}
      else if (coords.lat !== undefined && coords.lng !== undefined) {
        latitude = coords.lat;
        longitude = coords.lng;
        accuracy = coords.accuracy;
      }
      else if (coords.lat !== undefined && coords.lon !== undefined) {
        latitude = coords.lat;
        longitude = coords.lon;
        accuracy = coords.accuracy;
      }
      else if (Array.isArray(coords) && coords.length >= 2) {
        latitude = coords[0];
        longitude = coords[1];
        accuracy = coords[2] || null;
      }
    }

    // Fallback: Try direct properties on position object
    if (latitude === null || longitude === null) {
      if (position.latitude !== undefined && position.longitude !== undefined) {
        latitude = position.latitude;
        longitude = position.longitude;
        accuracy = position.accuracy;
      }
      else if (position.lat !== undefined && position.lng !== undefined) {
        latitude = position.lat;
        longitude = position.lng;
        accuracy = position.accuracy;
      }
      else if (position.lat !== undefined && position.lon !== undefined) {
        latitude = position.lat;
        longitude = position.lon;
        accuracy = position.accuracy;
      }
    }

    // Get timestamp
    if (position.timestamp) {
      timestamp = position.timestamp;
    }

    // Convert to numbers and validate
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    const acc = accuracy !== null ? parseFloat(accuracy) : null;

    // Validate coordinates are valid numbers within range
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return null;
    }

    return {
      latitude: lat,
      longitude: lng,
      accuracy: acc && !isNaN(acc) ? acc : null,
      timestamp: timestamp,
      address: null
    };
  }, []);

  // Get current position
  const getCurrentPosition = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const isNative = Capacitor.isNativePlatform();

      // Use Capacitor for native platforms
      if (isNative) {
        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: defaultOptions.enableHighAccuracy,
          timeout: defaultOptions.timeout,
          maximumAge: defaultOptions.maximumAge
        });

        // Use flexible coordinate extraction
        const locationData = extractCoordinates(position);

        if (!locationData) {
          throw new Error('Invalid coordinates received from Capacitor Geolocation');
        }

        setLocation(locationData);
        setLoading(false);
        return locationData;
      }

      // Fallback to web API
      if (!navigator.geolocation) {
        const err = {
          code: 'GEOLOCATION_NOT_SUPPORTED',
          message: '이 브라우저에서는 위치 서비스가 지원되지 않습니다.'
        };
        setError(err);
        setLoading(false);
        throw err;
      }

      return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            // Use flexible coordinate extraction
            const locationData = extractCoordinates(position);

            if (!locationData) {
              const error = {
                code: 'INVALID_COORDS',
                message: 'Invalid coordinates received from Web Geolocation'
              };
              setError(error);
              setLoading(false);
              reject(error);
              return;
            }

            setLocation(locationData);
            setLoading(false);
            resolve(locationData);
          },
          (err) => {
            const errorInfo = {
              code: err.code,
              message: getGeolocationErrorMessage(err.code)
            };
            setError(errorInfo);
            setLoading(false);
            reject(errorInfo);
          },
          defaultOptions
        );
      });
    } catch (err) {
      const errorInfo = {
        code: err.code || 'UNKNOWN',
        message: err.message || (err.code ? getGeolocationErrorMessage(err.code) : '위치 정보를 가져올 수 없습니다.')
      };
      setError(errorInfo);
      setLoading(false);
      throw errorInfo;
    }
  }, [defaultOptions, extractCoordinates]);

  // Request location permission and get position
  const requestLocation = useCallback(async () => {
    try {
      // For native platforms, request permission first
      if (Capacitor.isNativePlatform()) {
        const permissionStatus = await Geolocation.requestPermissions();

        if (permissionStatus.location === 'denied') {
          const err = {
            code: 'PERMISSION_DENIED',
            message: '위치 권한이 거부되었습니다. 설정에서 위치 권한을 허용해주세요.'
          };
          setError(err);
          throw err;
        }

        setPermission(permissionStatus.location);
      } else {
        // For web, check permission first
        const permissionState = await checkPermission();

        if (permissionState === 'denied') {
          const err = {
            code: 'PERMISSION_DENIED',
            message: '위치 권한이 거부되었습니다. 브라우저 설정에서 위치 권한을 허용해주세요.'
          };
          setError(err);
          throw err;
        }
      }

      // Get current position
      return await getCurrentPosition();
    } catch (err) {
      setError(err);
      throw err;
    }
  }, [checkPermission, getCurrentPosition]);

  // Watch position changes
  const watchPosition = useCallback(() => {
    if (!navigator.geolocation) {
      setError({
        code: 'GEOLOCATION_NOT_SUPPORTED',
        message: '이 브라우저에서는 위치 서비스가 지원되지 않습니다.'
      });
      return null;
    }

    setLoading(true);
    setError(null);

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const locationData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
          address: null
        };
        
        setLocation(locationData);
        setLoading(false);
      },
      (err) => {
        const errorInfo = {
          code: err.code,
          message: getGeolocationErrorMessage(err.code)
        };
        setError(errorInfo);
        setLoading(false);
      },
      defaultOptions
    );

    return watchId;
  }, [defaultOptions]);

  // Clear watch
  const clearWatch = useCallback((watchId) => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  // Initialize permission check on mount
  useEffect(() => {
    checkPermission();
  }, [checkPermission]);

  return {
    location,
    error,
    loading,
    permission,
    getCurrentPosition,
    requestLocation,
    watchPosition,
    clearWatch,
    checkPermission
  };
};

/**
 * Get human-readable error message for geolocation errors
 */
function getGeolocationErrorMessage(errorCode) {
  switch (errorCode) {
    case 1: // PERMISSION_DENIED
      return '위치 권한이 거부되었습니다. 브라우저 설정에서 위치 권한을 허용해주세요.';
    case 2: // POSITION_UNAVAILABLE
      return '현재 위치를 찾을 수 없습니다. 네트워크 연결을 확인해주세요.';
    case 3: // TIMEOUT
      return '위치 정보를 가져오는데 시간이 초과되었습니다. 다시 시도해주세요.';
    default:
      return '위치 정보를 가져오는 중 오류가 발생했습니다.';
  }
}

/**
 * Hook for reverse geocoding (address from coordinates)
 * Vworld API (국토부) 를 통해 좌표 → 행정구역 주소 변환
 */
export const useReverseGeocoding = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const getAddressFromCoordinates = useCallback(async (latitude, longitude) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/location/reverse-geocode?lat=${latitude}&lng=${longitude}`
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const json = await response.json();

      if (json.success && json.data && !json.data.isEmpty) {
        setLoading(false);
        return {
          sido: json.data.sido,
          sigungu: json.data.sigungu,
          dong: json.data.dong,
          fullAddress: json.data.fullAddress,
        };
      }

      setLoading(false);
      return null;
    } catch (err) {
      setError({
        code: 'REVERSE_GEOCODING_FAILED',
        message: '주소를 가져오는데 실패했습니다.',
      });
      setLoading(false);
      return null;
    }
  }, []);

  return {
    getAddressFromCoordinates,
    loading,
    error,
  };
};

/**
 * Hook for location persistence in localStorage
 */
export const useLocationStorage = () => {
  const STORAGE_KEY = 'mohe_user_location';

  const saveLocation = useCallback((location) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        ...location,
        savedAt: Date.now()
      }));
    } catch (err) {
      console.warn('Failed to save location to localStorage:', err);
    }
  }, []);

  const getStoredLocation = useCallback(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;

      const parsed = JSON.parse(stored);
      const maxAge = 30 * 60 * 1000; // 30 minutes

      if (Date.now() - parsed.savedAt > maxAge) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }

      return parsed;
    } catch (err) {
      console.warn('Failed to get stored location:', err);
      return null;
    }
  }, []);

  const clearStoredLocation = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.warn('Failed to clear stored location:', err);
    }
  }, []);

  return {
    saveLocation,
    getStoredLocation,
    clearStoredLocation
  };
};

export default useGeolocation;