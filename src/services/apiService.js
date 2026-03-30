import { Capacitor } from '@capacitor/core';

// Determine API base URL based on platform
// - Native apps (iOS/Android): Must use absolute URL since app runs from local files
// - Web browser: Can use relative paths (leverages Vite proxy in dev, same-origin in prod)
const getApiBaseUrl = () => {
  // For native platforms, always use absolute URL
  if (Capacitor.isNativePlatform()) {
    // Production API server
    return 'https://mohe.today';
  }

  // For web, use environment variable or empty string for relative paths
  return import.meta.env.VITE_API_BASE_URL !== undefined
    ? import.meta.env.VITE_API_BASE_URL
    : '';
};

const API_BASE_URL = getApiBaseUrl();

// Debug: Log the API base URL being used
console.log('🔧 API Base URL:', API_BASE_URL || '(empty - using relative paths)',
  '| Platform:', Capacitor.getPlatform());

/**
 * Base API service with common functionality
 */
class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
    // Completely remove caching to prevent refresh issues
    // this.requestCache = new Map(); // Simple request deduplication
    // this.requestTimestamps = new Map(); // Rate limiting
  }

  /**
   * Get auth token from storage (checks both localStorage and sessionStorage)
   */
  getAuthToken() {
    return localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
  }

  /**
   * Handle 401 responses by attempting token refresh
   */
  async handleUnauthorized() {
    try {
      const { authService } = await import('./authService.js');
      await authService.refreshAccessToken();
      return true;
    } catch (error) {
      console.warn('[ApiService] Token refresh failed:', error.message);
      // Don't clear auth data or redirect here - let the UI handle it
      // The AuthContext will handle the state update
      return false;
    }
  }

  /**
   * Get common headers for API requests
   */
  getHeaders(includeAuth = false) {
    const headers = {
      'Content-Type': 'application/json',
    };

    if (includeAuth) {
      const token = this.getAuthToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    }

    return headers;
  }

  /**
   * Check if request should be rate limited
   */
  isRateLimited(endpoint, method = 'GET') {
    // Disable ALL rate limiting for now to prevent 429 errors
    return false;
  }

  /**
   * Create request cache key
   */
  createCacheKey(endpoint, method, body) {
    return `${method}:${endpoint}:${body ? JSON.stringify(body) : ''}`;
  }

  /**
   * Ensure token is valid before making authenticated requests
   */
  async ensureValidToken() {
    try {
      const { authService } = await import('./authService.js');
      const token = authService.getToken();

      if (!token) {
        return false;
      }

      // Check if token is expired or expiring soon
      if (authService.isTokenExpired(token) || authService.isTokenExpiringSoon(token)) {
        console.log('[ApiService] Token expired/expiring, attempting refresh');
        await authService.refreshAccessToken();
        return true;
      }

      return true;
    } catch (error) {
      console.error('[ApiService] Token validation failed:', error);
      return false;
    }
  }

  /**
   * Generic fetch wrapper with error handling
   */
  async request(endpoint, options = {}) {
    const method = options.method || 'GET';
    console.log(`🚀 Making request: ${method} ${endpoint}`);

    // Try to ensure valid token for authenticated requests (but don't fail if refresh fails)
    if (options.requireAuth) {
      await this.ensureValidToken();
      // Don't throw error here - let the actual request fail with 401 if needed
      // The 401 handler will attempt refresh and retry
    }

    const url = `${this.baseURL}${endpoint}`;
    const config = {
      ...options,
      method,
      headers: {
        ...this.getHeaders(options.requireAuth),
        ...options.headers,
      },
    };

    // Execute request directly without caching
    return this.executeRequest(url, config);
  }

  /**
   * Execute the actual HTTP request
   */
  async executeRequest(url, config) {
    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        // Handle 401 unauthorized only (not 403 - that's a permission issue)
        if (response.status === 401 && config.requireAuth) {
          console.log('[ApiService] Got 401, attempting token refresh');
          const refreshed = await this.handleUnauthorized();
          if (refreshed) {
            // Retry the request with new token
            const newConfig = {
              ...config,
              headers: {
                ...this.getHeaders(config.requireAuth),
                ...config.headers,
              },
            };
            console.log('[ApiService] Retrying request with refreshed token');
            const retryResponse = await fetch(url, newConfig);
            if (!retryResponse.ok) {
              const errorData = await retryResponse.json().catch(() => ({}));
              throw new ApiError(
                retryResponse.status,
                errorData.message || `HTTP Error ${retryResponse.status}`,
                errorData.code,
                errorData.path
              );
            }
            return await retryResponse.json();
          }
        }

        const errorData = await response.json().catch(() => ({}));

        // Handle common backend issues with friendly messages
        let errorMessage = errorData.message || `HTTP Error ${response.status}`;

        if (response.status === 500) {
          if (errorData.message?.includes('not yet implemented') || errorData.message?.includes('Implementation needed')) {
            errorMessage = '이 기능은 현재 개발 중입니다. 곧 사용할 수 있습니다.';
          } else if (errorData.message?.includes('column') && errorData.message?.includes('does not exist')) {
            errorMessage = '데이터베이스 스키마 업데이트가 필요합니다.';
          } else {
            errorMessage = '서버에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.';
          }
        } else if (response.status === 404) {
          errorMessage = '요청한 데이터를 찾을 수 없습니다.';
        } else if (response.status === 401) {
          errorMessage = '로그인이 필요합니다.';
        } else if (response.status === 403) {
          errorMessage = '접근 권한이 없습니다.';
        }

        throw new ApiError(
          response.status,
          errorMessage,
          errorData.code,
          errorData.path
        );
      }

      const data = await response.json();
      return data;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(0, error.message || 'Network error occurred');
    }
  }

  /**
   * GET request
   */
  async get(endpoint, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'GET',
    });
  }

  /**
   * POST request
   */
  async post(endpoint, data = null, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : null,
    });
  }

  /**
   * PUT request
   */
  async put(endpoint, data = null, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : null,
    });
  }

  /**
   * DELETE request
   */
  async delete(endpoint, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'DELETE',
    });
  }
}

/**
 * Custom API Error class
 */
export class ApiError extends Error {
  constructor(status, message, code = null, path = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.path = path;
  }

  isNetworkError() {
    return this.status === 0;
  }

  isServerError() {
    return this.status >= 500;
  }

  isClientError() {
    return this.status >= 400 && this.status < 500;
  }
}

/**
 * Weather API service
 */
export class WeatherService extends ApiService {
  /**
   * Get current weather data for coordinates
   */
  async getCurrentWeather(latitude, longitude) {
    return this.get(`/api/weather/current?lat=${latitude}&lon=${longitude}`, {
      requireAuth: false
    });
  }

  /**
   * Get weather context for recommendations
   */
  async getWeatherContext(latitude, longitude) {
    return this.getCurrentWeather(latitude, longitude);
  }
}

/**
 * Contextual Recommendation API service
 */
export class ContextualRecommendationService extends ApiService {
  /**
   * Get contextual recommendations based on query and location
   */
  async getContextualRecommendations(query, latitude, longitude, options = {}) {
    const params = new URLSearchParams({
      lat: latitude.toString(),
      lon: longitude.toString(),
      limit: (options.limit || 10).toString()
    });

    if (query) {
      params.append('query', query);
    }

    return this.get(`/api/recommendations/contextual?${params.toString()}`, {
      requireAuth: false
    });
  }

  /**
   * Get good-to-visit recommendations based on location
   * Returns { dynamicMessage, weatherCondition, timeContext, searchKeywords, places }
   */
  async getGoodToVisitRecommendations(latitude, longitude, options = {}) {
    const params = new URLSearchParams({
      lat: latitude.toString(),
      lon: longitude.toString(),
      limit: (options.limit || 10).toString()
    });

    const url = `/api/recommendations/good-to-visit?${params.toString()}`;
    console.log('🌐 API Call:', url);

    return this.get(url, {
      requireAuth: false
    });
  }

  /**
   * Parse good-to-visit response to extract dynamic message and places
   */
  parseGoodToVisitResponse(response) {
    if (!response.success || !response.data) {
      return { dynamicMessage: '지금 가기 좋은 플레이스', places: [] };
    }

    const data = response.data;

    // New response format with dynamicMessage
    if (data.dynamicMessage) {
      return {
        dynamicMessage: data.dynamicMessage,
        weatherCondition: data.weatherCondition,
        timeContext: data.timeContext,
        searchKeywords: data.searchKeywords || [],
        places: data.places || []
      };
    }

    // Fallback for old response format (array of places)
    if (Array.isArray(data)) {
      return {
        dynamicMessage: '지금 가기 좋은 플레이스',
        places: data
      };
    }

    return { dynamicMessage: '지금 가기 좋은 플레이스', places: [] };
  }


}

/**
 * Traditional Recommendation API service (existing)
 */
export class RecommendationService extends ApiService {
  /**
   * Get personalized recommendations
   */
  async getPersonalizedRecommendations(options = {}) {
    const params = new URLSearchParams({
      limit: (options.limit || 10).toString(),
      excludeBookmarked: (!options.includeBookmarked).toString()
    });

    return await this.get(`/api/recommendations/enhanced?${params}`, {
      requireAuth: true
    });
  }

  /**
   * Get enhanced recommendations
   */
  async getEnhancedRecommendations(userId, options = {}) {
    const params = new URLSearchParams({
      userId: userId.toString(),
      limit: (options.limit || 10).toString(),
      includeExplanation: (options.includeExplanation || true).toString()
    });

    return this.get(`/api/recommendations/enhanced?${params}`, {
      requireAuth: true
    });
  }
}

/**
 * Places API service
 */
export class PlaceService extends ApiService {
  /**
   * Get place details by ID
   */
  async getPlaceById(placeId) {
    return this.get(`/api/places/${placeId}`, {
      requireAuth: false
    });
  }

  /**
   * Search places (legacy endpoint)
   */
  async searchPlaces(query, options = {}) {
    const params = new URLSearchParams({
      page: (options.page || 0).toString(),
      size: (options.size || 10).toString(),
      ...(options.sort && { sort: options.sort })
    });

    if (query) {
      params.set('q', query);
    }

    return this.get(`/api/places/search?${params}`, {
      requireAuth: false
    });
  }

  /**
   * Get places near a set of coordinates
   */
  async getNearbyPlaces(latitude, longitude, options = {}) {
    const params = new URLSearchParams({
      lat: latitude.toString(),
      lon: longitude.toString(),
      radius: (options.radius || 3000).toString(),
      limit: (options.limit || 20).toString()
    });

    return this.get(`/api/places/nearby?${params}`, {
      requireAuth: false
    });
  }

  

  /**
   * Get general recommendations (guest-friendly)
   */
  async getRecommendations() {
    return await this.get(`/api/places/recommendations`, {
      requireAuth: false
    });
  }

  /**
   * Get bookmark-based recommendations
   */
  async getBookmarkBasedRecommendations(latitude, longitude, options = {}) {
    const params = new URLSearchParams({
      lat: latitude.toString(),
      lon: longitude.toString(),
      distance: (options.distance || 20.0).toString(),
      limit: (options.limit || 15).toString()
    });

    return await this.get(`/api/recommendations/bookmark-based?${params}`, {
      requireAuth: false
    });
  }

  /**
   * Get popular places
   */
  async getPopularPlaces(latitude, longitude, options = {}) {
    const params = new URLSearchParams({
      lat: latitude.toString(),
      lon: longitude.toString(),
      limit: (options.limit || 10).toString(),
      maxDistance: (options.maxDistance || 55000).toString(), // Default 15km
    });

    return await this.get(`/api/places/popular?${params}`, {
      requireAuth: false
    });
  }
  
  /**
   * Get paginated places list
   */
  async getPlacesList(options = {}) {
    const params = new URLSearchParams({
      page: (options.page || 0).toString(),
      limit: (options.limit || 10).toString(),
      sort: options.sort || 'popularity'
    });
    
    return this.get(`/api/places/list?${params}`, {
      requireAuth: false
    });
  }
  
  /**
   * Get current time recommendations
   */
  async getCurrentTimeRecommendations(latitude, longitude, options = {}) {
    const params = new URLSearchParams({
      limit: (options.limit || 10).toString()
    });

    if (latitude && longitude) {
      params.append('lat', latitude.toString());
      params.append('lon', longitude.toString());
    }

    return this.get(`/api/places/current-time?${params}`, {
      requireAuth: false
    });
  }

  /**
   * Get reviews for a place (crawler-sourced reviews)
   */
  async getPlaceReviews(placeId, options = {}) {
    const params = new URLSearchParams({
      page: (options.page || 0).toString(),
      size: (options.size || 10).toString()
    });

    return this.get(`/api/places/${placeId}/reviews?${params}`, {
      requireAuth: false
    });
  }

  /**
   * Get menus for a place
   */
  async getPlaceMenus(placeId) {
    return this.get(`/api/places/${placeId}/menus`, {
      requireAuth: false
    });
  }
}

/**
 * Bookmarks API service
 */
export class BookmarkService extends ApiService {
  // Cache for bookmark IDs
  _bookmarkIdsCache = null;
  _cacheTimestamp = null;
  _cacheTTL = 60000; // 1 minute cache TTL

  /**
   * Toggle bookmark for a place
   */
  async toggleBookmark(placeId) {
    const result = await this.post(`/api/bookmarks/toggle`, { placeId }, {
      requireAuth: true
    });
    this._invalidateCache();
    return result;
  }

  /**
   * Get user bookmarks
   */
  async getUserBookmarks(options = {}) {
    const params = new URLSearchParams({
      page: (options.page || 0).toString(),
      size: (options.size || 10).toString()
    });

    return this.get(`/api/bookmarks?${params}`, {
      requireAuth: true
    });
  }

  /**
   * Add bookmark explicitly
   */
  async addBookmark(placeId) {
    const result = await this.post(`/api/bookmarks`, { placeId }, {
      requireAuth: true
    });
    this._invalidateCache();
    return result;
  }

  /**
   * Remove bookmark explicitly
   */
  async removeBookmark(placeId) {
    const result = await this.delete(`/api/bookmarks/${placeId}`, {
      requireAuth: true
    });
    this._invalidateCache();
    return result;
  }

  /**
   * Check bookmark status for a place
   */
  async isBookmarked(placeId) {
    return this.get(`/api/bookmarks/${placeId}`, {
      requireAuth: true
    });
  }

  /**
   * Get all bookmarked place IDs (with caching)
   * Returns a Set of place IDs for efficient lookup
   */
  async getBookmarkedIds() {
    // Check cache validity
    if (this._bookmarkIdsCache && this._cacheTimestamp) {
      const elapsed = Date.now() - this._cacheTimestamp;
      if (elapsed < this._cacheTTL) {
        return this._bookmarkIdsCache;
      }
    }

    try {
      // Fetch all bookmarks (use large size to get all)
      const response = await this.getUserBookmarks({ page: 0, size: 1000 });
      if (response.success) {
        const bookmarks = response.data?.bookmarks ?? response.data ?? [];
        const ids = new Set(bookmarks.map(b => b.id || b.placeId));
        this._bookmarkIdsCache = ids;
        this._cacheTimestamp = Date.now();
        return ids;
      }
    } catch (error) {
      console.warn('Failed to fetch bookmark IDs:', error);
    }

    return new Set();
  }

  /**
   * Apply bookmark status to a list of places
   * @param {Array} places - Array of place objects
   * @returns {Array} Places with isBookmarked field set
   */
  async applyBookmarkStatus(places) {
    if (!places || places.length === 0) return places;

    try {
      const bookmarkedIds = await this.getBookmarkedIds();
      return places.map(place => ({
        ...place,
        isBookmarked: bookmarkedIds.has(place.id)
      }));
    } catch (error) {
      console.warn('Failed to apply bookmark status:', error);
      return places;
    }
  }

  /**
   * Invalidate the cache (call after add/remove/toggle)
   */
  _invalidateCache() {
    this._bookmarkIdsCache = null;
    this._cacheTimestamp = null;
  }

  /**
   * Clear cache (call on logout)
   */
  clearCache() {
    this._invalidateCache();
  }
}

/**
 * Activity API service
 */
export class ActivityService extends ApiService {
  async getRecentPlaces() {
    return this.get('/api/user/recent-places', {
      requireAuth: true
    });
  }

  async recordRecentView(placeId) {
    return this.post('/api/user/recent-places', { placeId }, {
      requireAuth: true
    });
  }

  async getMyPlaces() {
    return this.get('/api/user/my-places', {
      requireAuth: true
    });
  }
}

/**
 * User profile service
 */
export class UserService extends ApiService {
  async getProfile() {
    return this.get('/api/user/profile', {
      requireAuth: true
    });
  }

  async updateProfile(payload) {
    return this.put('/api/user/profile', payload, {
      requireAuth: true
    });
  }

  /**
   * Update user preferences (MBTI, age, space, transportation)
   */
  async updatePreferences(preferences) {
    return this.put('/api/user/preferences', preferences, {
      requireAuth: true
    });
  }

  /**
   * Complete onboarding process
   */
  async completeOnboarding(data) {
    return this.post('/api/user/onboarding/complete', data, {
      requireAuth: true
    });
  }

  /**
   * Save user agreements (terms, privacy, location, age)
   */
  async saveAgreements(agreements) {
    return this.post('/api/user/agreements', agreements, {
      requireAuth: true
    });
  }

  /**
   * Upload profile image
   * @param {File} file - Image file to upload
   * @returns {Promise<{success: boolean, data: {imageUrl: string}}>}
   */
  async uploadProfileImage(file) {
    const formData = new FormData();
    formData.append('image', file);

    const token = this.getAuthToken();
    const response = await fetch(`${this.baseURL}/api/user/profile/image`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Image upload failed');
    }

    return data;
  }
}

/**
 * Terms API service
 */
export class TermsService extends ApiService {
  async listTerms() {
    return this.get('/api/terms', { requireAuth: false });
  }

  async getTermDetail(termsId) {
    return this.get(`/api/terms/${termsId}`, { requireAuth: false });
  }
}

/**
 * Support/Contact API service
 */
export class SupportService extends ApiService {
  /**
   * Send contact/feedback message
   */
  async sendContactMessage(data) {
    return this.post('/api/support/contact', data, {
      requireAuth: true
    });
  }
}

// Export service instances
export const weatherService = new WeatherService();
export const contextualRecommendationService = new ContextualRecommendationService();
export const recommendationService = new RecommendationService();
export const placeService = new PlaceService();
export const activityService = new ActivityService();
export const userService = new UserService();
export const termsService = new TermsService();
export const supportService = new SupportService();
/**
 * Address API service for reverse geocoding
 */
export class AddressService extends ApiService {
  /**
   * Convert coordinates to address
   */
  async reverseGeocode(latitude, longitude) {
    return this.get(`/api/address/reverse?lat=${latitude}&lon=${longitude}`, {
      requireAuth: false
    });
  }
}

// Guest recommendation service for anonymous users
class GuestRecommendationService extends ApiService {
  constructor() {
    super();
  }

  /**
   * Get good-to-visit recommendations for guest users
   * Returns { dynamicMessage, places, ... }
   */
  async getGuestRecommendations(latitude, longitude, options = {}) {
    const { limit = 10 } = options;

    console.log('GuestRecommendationService: Starting guest recommendations', { latitude, longitude, limit });

    try {
      // Use good-to-visit recommendations API for guest users
      console.log('GuestRecommendationService: Making API call to good-to-visit');
      const response = await contextualRecommendationService.getGoodToVisitRecommendations(latitude, longitude, options);

      console.log('GuestRecommendationService: API response success:', response.success);
      console.log('GuestRecommendationService: API response data type:', typeof response.data);
      console.log('GuestRecommendationService: API response:', response);

      // Parse response using the new helper
      const parsed = contextualRecommendationService.parseGoodToVisitResponse(response);
      console.log('GuestRecommendationService: Parsed response:', parsed);

      // Extract places from parsed response
      const places = parsed.places || [];

      if (places.length > 0) {
        console.log('GuestRecommendationService: Processing places data, count:', places.length);

        const mappedPlaces = places.map(place => {
          // Use shortAddress field from backend
          const addressStr = place.shortAddress || place.address || place.category || '위치 정보 없음';

          return {
            id: place.id,
            name: place.name,
            rating: place.rating || 4.0,
            reviewCount: place.reviewCount || 0,
            location: addressStr,
            image: place.imageUrl || place.images?.[0],
            images: place.images || [],
            isBookmarked: false,
            category: place.category,
            description: place.reasonWhy || place.description || `${place.category}`,
            distance: place.distance || 0,
            weatherSuitability: place.weatherSuitability,
            reasonWhy: place.reasonWhy,
            shortAddress: place.shortAddress,
            address: place.address
          };
        });

        console.log('GuestRecommendationService: Mapped places count:', mappedPlaces.length);

        return {
          success: true,
          data: mappedPlaces,
          dynamicMessage: parsed.dynamicMessage || '지금 가기 좋은 플레이스',
          weatherCondition: parsed.weatherCondition,
          timeContext: parsed.timeContext,
          message: `${mappedPlaces.length}개의 추천 장소를 찾았습니다`
        };
      } else {
        console.log('GuestRecommendationService: No places in response');
      }

      return {
        success: true,
        data: [],
        dynamicMessage: parsed.dynamicMessage || '지금 가기 좋은 플레이스',
        message: '현재 추천 가능한 장소가 없습니다'
      };

    } catch (error) {
      console.error('Guest recommendations failed:', error);
      console.error('Error details:', error.message, error.status);
      throw error;
    }
  }
}

/**
 * Home API service for home page data
 */
export class HomeService extends ApiService {
  /**
   * Get home page images from real database
   */
  async getHomeImages() {
    return this.get('/api/home/images', {
      requireAuth: false
    });
  }
}

/**
 * Category API service for category-based recommendations
 */
export class CategoryService extends ApiService {
  /**
   * Get suggested categories based on current time and weather
   * Returns 5 recommended categories
   */
  async getSuggestedCategories(latitude, longitude) {
    const params = new URLSearchParams({
      lat: latitude.toString(),
      lon: longitude.toString()
    });

    return this.get(`/api/categories/suggested?${params}`, {
      requireAuth: false
    });
  }

  /**
   * Get places filtered by specific category
   * @param {string} category - Category name to filter by
   * @param {number} latitude - User's latitude
   * @param {number} longitude - User's longitude
   * @param {object} options - Additional options (limit, etc.)
   */
  /**
   * Get home categories with MBTI + time/weather based ordering
   */
  async getHomeCategories(latitude, longitude, mbti = null) {
    const params = new URLSearchParams({
      lat: latitude.toString(),
      lon: longitude.toString(),
      placesPerCategory: '10'
    });
    if (mbti) params.set('mbti', mbti);

    return this.get(`/api/categories/home?${params}`, {
      requireAuth: false
    });
  }

  async getPlacesByCategory(category, latitude, longitude, options = {}) {
    const params = new URLSearchParams({
      lat: latitude.toString(),
      lon: longitude.toString(),
      limit: (options.limit || 10).toString()
    });

    return this.get(`/api/categories/${encodeURIComponent(category)}/places?${params}`, {
      requireAuth: false
    });
  }
}

/**
 * Unified Search API service - Embedding 기반 의미론적 검색
 * 장소명, 지역명, 음식, 활동 등 다양한 검색 지원
 */
export class UnifiedSearchService extends ApiService {
  /**
   * 통합 검색 (Embedding + 키워드 하이브리드)
   * @param {string} query - 검색어 (장소명, 지역명, 음식, 활동, 분위기 등)
   * @param {number} latitude - 사용자 위도 (선택)
   * @param {number} longitude - 사용자 경도 (선택)
   * @param {object} options - 추가 옵션 (limit 등)
   */
  async search(query, latitude, longitude, options = {}) {
    const params = new URLSearchParams({
      q: query,
      limit: (options.limit || 20).toString()
    });

    if (latitude && longitude) {
      params.append('lat', latitude.toString());
      params.append('lon', longitude.toString());
    }

    return this.get(`/api/search?${params}`, {
      requireAuth: false
    });
  }

  /**
   * 음식 검색 (Embedding 특화)
   * @param {string} query - 음식/메뉴 검색어 (파스타, 라멘, 브런치 등)
   */
  async searchFood(query, latitude, longitude, options = {}) {
    const params = new URLSearchParams({
      q: query,
      limit: (options.limit || 20).toString()
    });

    if (latitude && longitude) {
      params.append('lat', latitude.toString());
      params.append('lon', longitude.toString());
    }

    return this.get(`/api/search/food?${params}`, {
      requireAuth: false
    });
  }

  /**
   * 활동 검색 (Embedding 특화)
   * @param {string} query - 활동/목적 검색어 (데이트, 혼밥, 모임 등)
   */
  async searchActivity(query, latitude, longitude, options = {}) {
    const params = new URLSearchParams({
      q: query,
      limit: (options.limit || 20).toString()
    });

    if (latitude && longitude) {
      params.append('lat', latitude.toString());
      params.append('lon', longitude.toString());
    }

    return this.get(`/api/search/activity?${params}`, {
      requireAuth: false
    });
  }

  /**
   * 지역 검색
   * @param {string} query - 지역명 검색어 (성수동, 강남역, 홍대 등)
   */
  async searchLocation(query, latitude, longitude, options = {}) {
    const params = new URLSearchParams({
      q: query,
      limit: (options.limit || 20).toString()
    });

    if (latitude && longitude) {
      params.append('lat', latitude.toString());
      params.append('lon', longitude.toString());
    }

    return this.get(`/api/search/location?${params}`, {
      requireAuth: false
    });
  }
}

/**
 * Search Chat API - 대화형 검색 + DB 히스토리
 */
export class SearchChatService extends ApiService {
  async searchChat(query, latitude, longitude, options = {}) {
    return this.post('/api/search/chat', {
      query,
      latitude,
      longitude,
      conversationId: options.conversationId || null,
      sessionId: options.sessionId || null,
      limit: options.limit || 10
    }, { requireAuth: false });
  }

  async getConversations(sessionId = null) {
    const params = sessionId ? `?sessionId=${sessionId}` : '';
    return this.get(`/api/search/chat/conversations${params}`, { requireAuth: false });
  }

  async getConversation(id) {
    return this.get(`/api/search/chat/conversations/${id}`, { requireAuth: false });
  }

  async deleteConversation(id) {
    return this.delete(`/api/search/chat/conversations/${id}`, { requireAuth: false });
  }
}

/**
 * Review API service for user-generated reviews
 * Uses the existing Comment API endpoints
 */
export class ReviewService extends ApiService {
  /**
   * Create a new review for a place
   */
  async createReview(placeId, reviewData) {
    // Map frontend fields to backend Comment API format
    const commentData = {
      content: reviewData.reviewText,
      rating: reviewData.rating
    };
    return this.post(`/api/places/${placeId}/comments`, commentData, {
      requireAuth: true
    });
  }

  /**
   * Get user's reviews
   */
  async getMyReviews(options = {}) {
    const params = new URLSearchParams({
      page: (options.page || 0).toString(),
      size: (options.size || 10).toString()
    });

    return this.get(`/api/user/comments?${params}`, {
      requireAuth: true
    });
  }

  /**
   * Delete a review
   */
  async deleteReview(reviewId) {
    return this.delete(`/api/comments/${reviewId}`, {
      requireAuth: true
    });
  }

  /**
   * Update a review
   */
  async updateReview(reviewId, reviewData) {
    const commentData = {
      content: reviewData.reviewText,
      rating: reviewData.rating
    };
    return this.put(`/api/comments/${reviewId}`, commentData, {
      requireAuth: true
    });
  }
}

// Export service instances
export const addressService = new AddressService();
export const bookmarkService = new BookmarkService();
export const guestRecommendationService = new GuestRecommendationService();
export const homeService = new HomeService();
export const categoryService = new CategoryService();
export const reviewService = new ReviewService();
export const unifiedSearchService = new UnifiedSearchService();
export const searchChatService = new SearchChatService();

export default ApiService;
