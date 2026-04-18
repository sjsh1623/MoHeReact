import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import styles from '@/styles/components/ui/modals/search-modal.module.css';
import { unifiedSearchService } from '@/services/apiService';
import { buildImageUrl } from '@/utils/image';
import { getDefaultPlaceImage } from '@/utils/defaultPlaceImage';
import { useGeolocation } from '@/hooks/useGeolocation';

export default function SearchModal({ isOpen, onClose }) {
  const navigate = useNavigate();
  const { location } = useGeolocation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('recentSearches');
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse recent searches:', e);
      }
    }
  }, []);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
    if (!isOpen) {
      setQuery('');
      setResults([]);
    }
  }, [isOpen]);

  // Block body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [isOpen]);

  // Debounced search using unified search API (Embedding + keyword hybrid)
  const searchPlaces = useCallback(async (searchQuery) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    try {
      // Use unified search API with location if available
      const lat = location?.latitude;
      const lon = location?.longitude;
      const response = await unifiedSearchService.search(searchQuery, lat, lon, { limit: 8 });

      if (response.success && response.data) {
        const places = response.data.places || response.data || [];
        setResults(places);
      } else {
        setResults([]);
      }
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [location]);

  // Handle input change with debounce
  const handleInputChange = (e) => {
    const value = e.target.value;
    setQuery(value);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      searchPlaces(value);
    }, 300);
  };

  // Save to recent searches
  const saveRecentSearch = (searchTerm) => {
    const updated = [searchTerm, ...recentSearches.filter(s => s !== searchTerm)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('recentSearches', JSON.stringify(updated));
  };

  // Handle place click
  const handlePlaceClick = (place) => {
    saveRecentSearch(place.name || place.title);
    onClose();
    navigate(`/place/${place.id}`);
  };

  // Handle recent search click
  const handleRecentClick = (searchTerm) => {
    setQuery(searchTerm);
    searchPlaces(searchTerm);
  };

  // Remove single recent search
  const removeRecentSearch = (e, term) => {
    e.stopPropagation();
    const updated = recentSearches.filter(s => s !== term);
    setRecentSearches(updated);
    localStorage.setItem('recentSearches', JSON.stringify(updated));
  };

  // Handle search submit
  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) {
      saveRecentSearch(query.trim());
      onClose();
      navigate(`/search-results?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const popularCategories = [
    { label: '카페' },
    { label: '맛집' },
    { label: '혼밥' },
    { label: '데이트' },
    { label: '힐링' },
    { label: '인스타' },
  ];

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className={styles.backdrop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className={styles.modal}
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          >
            {/* Search Input */}
            <form onSubmit={handleSubmit} className={styles.searchForm}>
              <div className={styles.inputWrapper}>
                <svg className={styles.inputIcon} width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <circle cx="11" cy="11" r="7" stroke="#333" strokeWidth="1.8"/>
                  <path d="M16 16L20 20" stroke="#333" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
                <input
                  ref={inputRef}
                  type="text"
                  className={styles.input}
                  placeholder="장소, 지역 검색"
                  value={query}
                  onChange={handleInputChange}
                  autoComplete="off"
                />
                {query ? (
                  <button
                    type="button"
                    className={styles.clearBtn}
                    onClick={() => { setQuery(''); setResults([]); inputRef.current?.focus(); }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" fill="#D1D1D6"/>
                      <path d="M15 9L9 15M9 9L15 15" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </button>
                ) : (
                  <button type="button" className={styles.cancelBtn} onClick={onClose}>
                    취소
                  </button>
                )}
              </div>
            </form>

            {/* Content */}
            <div className={styles.content}>
              {/* Loading */}
              {isLoading && (
                <div className={styles.loading}>
                  <div className={styles.spinner} />
                </div>
              )}

              {/* Results */}
              {!isLoading && results.length > 0 && (
                <div className={styles.results}>
                  {results.map((place) => (
                    <div
                      key={place.id}
                      className={styles.resultItem}
                      onClick={() => handlePlaceClick(place)}
                    >
                      <div className={styles.resultThumb}>
                        {(() => {
                          const fallback = getDefaultPlaceImage(place.category || place.type);
                          const src = buildImageUrl(place.imageUrl || place.image) || fallback;
                          return (
                            <img
                              src={src}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              onError={(e) => { if (e.target.src !== fallback) e.target.src = fallback; }}
                            />
                          );
                        })()}
                      </div>
                      <div className={styles.resultInfo}>
                        <span className={styles.resultName}>{place.name || place.title}</span>
                        <span className={styles.resultAddr}>{place.shortAddress || place.address || ''}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* No Results */}
              {!isLoading && query && results.length === 0 && (
                <div className={styles.empty}>
                  <p>검색 결과가 없습니다</p>
                </div>
              )}

              {/* Recent Searches */}
              {!query && recentSearches.length > 0 && (
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>최근 검색</h3>
                  <div className={styles.recentList}>
                    {recentSearches.map((term, idx) => (
                      <div
                        key={idx}
                        className={styles.recentItem}
                        onClick={() => handleRecentClick(term)}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="9" stroke="#333" strokeWidth="1.5"/>
                          <path d="M12 7V12L15 14" stroke="#333" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                        <span>{term}</span>
                        <button
                          className={styles.removeBtn}
                          onClick={(e) => removeRecentSearch(e, term)}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <path d="M18 6L6 18M6 6L18 18" stroke="#333" strokeWidth="2" strokeLinecap="round"/>
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Popular Categories */}
              {!query && (
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>인기 검색</h3>
                  <div className={styles.categories}>
                    {popularCategories.map((cat) => (
                      <button
                        key={cat.label}
                        className={styles.categoryBtn}
                        onClick={() => handleRecentClick(cat.label)}
                      >
                        <span className={styles.categoryLabel}>{cat.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
