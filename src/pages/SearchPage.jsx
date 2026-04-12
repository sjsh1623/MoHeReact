import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '@/styles/pages/search-page.module.css';
import { unifiedSearchService } from '@/services/apiService';
import { buildImageUrl } from '@/utils/image';
import { useGeolocation } from '@/hooks/useGeolocation';

function formatDist(d) {
  if (!d || d <= 0) return null;
  return d < 0.1 ? `${(d * 1000).toFixed(0)}m` : `${d.toFixed(1)}km`;
}

export default function SearchPage() {
  const navigate = useNavigate();
  const { location, requestLocation } = useGeolocation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => { requestLocation(); }, []); // eslint-disable-line

  useEffect(() => {
    const saved = localStorage.getItem('mohe_recent_searches');
    if (saved) try { setRecentSearches(JSON.parse(saved)); } catch {}
  }, []);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 200);
  }, []);

  const searchPlaces = useCallback(async (q) => {
    if (!q.trim()) { setResults([]); setHasSearched(false); return; }
    setIsLoading(true);
    setHasSearched(true);
    try {
      const lat = location?.latitude;
      const lon = location?.longitude;
      const response = await unifiedSearchService.search(q, lat, lon, { limit: 20 });
      if (response.success && response.data) {
        setResults(response.data.places || response.data || []);
      } else {
        setResults([]);
      }
    } catch {
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [location]);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchPlaces(value), 300);
  };

  const saveRecent = (term) => {
    const updated = [term, ...recentSearches.filter(s => s !== term)].slice(0, 8);
    setRecentSearches(updated);
    localStorage.setItem('mohe_recent_searches', JSON.stringify(updated));
  };

  const handlePlaceClick = (place) => {
    saveRecent(place.name || place.title);
    navigate(`/place/${place.id}`, { state: { preloadedData: place } });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) {
      saveRecent(query.trim());
      searchPlaces(query.trim());
    }
  };

  const removeRecent = (e, term) => {
    e.stopPropagation();
    const updated = recentSearches.filter(s => s !== term);
    setRecentSearches(updated);
    localStorage.setItem('mohe_recent_searches', JSON.stringify(updated));
  };

  const popularTags = ['카페', '맛집', '데이트', '혼밥', '브런치', '힐링', '인스타', '바'];

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate(-1)}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M15 18L9 12L15 6" stroke="#333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <form onSubmit={handleSubmit} className={styles.searchForm}>
          <svg className={styles.searchIcon} width="18" height="18" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="7" stroke="#999" strokeWidth="1.8"/>
            <path d="M16 16L20 20" stroke="#999" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          <input
            ref={inputRef}
            type="text"
            className={styles.searchInput}
            placeholder="장소, 메뉴, 지역 검색"
            value={query}
            onChange={handleInputChange}
            autoComplete="off"
          />
          {query && (
            <button type="button" className={styles.clearBtn} onClick={() => { setQuery(''); setResults([]); setHasSearched(false); inputRef.current?.focus(); }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" fill="#D1D1D6"/>
                <path d="M15 9L9 15M9 9L15 15" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          )}
        </form>
      </header>

      {/* Content */}
      <div className={styles.content}>
        {/* Loading */}
        {isLoading && (
          <div className={styles.loadingWrap}>
            <div className={styles.spinner} />
          </div>
        )}

        {/* Results */}
        {!isLoading && results.length > 0 && (
          <div className={styles.resultList}>
            {results.map((place) => (
              <div key={place.id} className={styles.resultItem} onClick={() => handlePlaceClick(place)}>
                <div className={styles.resultThumb}>
                  {(place.imageUrl || place.image || place.images?.[0]) ? (
                    <img src={buildImageUrl(place.imageUrl || place.image || place.images?.[0])} alt="" />
                  ) : (
                    <div className={styles.thumbEmpty}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <path d="M21 10C21 17 12 23 12 23C12 23 3 17 3 10C3 5 7 1 12 1C17 1 21 5 21 10Z" stroke="#CCC" strokeWidth="1.5"/>
                        <circle cx="12" cy="10" r="3" stroke="#CCC" strokeWidth="1.5"/>
                      </svg>
                    </div>
                  )}
                </div>
                <div className={styles.resultInfo}>
                  <span className={styles.resultName}>{place.name || place.title}</span>
                  <span className={styles.resultMeta}>
                    {place.category && <span>{place.category}</span>}
                    {place.shortAddress && <span> · {place.shortAddress}</span>}
                  </span>
                </div>
                <div className={styles.resultRight}>
                  {place.rating > 0 && (
                    <span className={styles.resultRating}>
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                        <path d="M6 0L7.35 4.15H11.71L8.18 6.71L9.53 10.85L6 8.29L2.47 10.85L3.82 6.71L0.29 4.15H4.65L6 0Z" fill="#FFD336"/>
                      </svg>
                      {Number(place.rating).toFixed(1)}
                    </span>
                  )}
                  {formatDist(place.distance) && (
                    <span className={styles.resultDist}>{formatDist(place.distance)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* No results */}
        {!isLoading && hasSearched && results.length === 0 && (
          <div className={styles.empty}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="7" stroke="#ddd" strokeWidth="1.5"/>
              <path d="M16 16L20 20" stroke="#ddd" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <p>'{query}'에 대한 검색 결과가 없어요</p>
            <span>다른 키워드로 검색해보세요</span>
          </div>
        )}

        {/* Default state: recent + popular */}
        {!hasSearched && !isLoading && (
          <>
            {recentSearches.length > 0 && (
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>최근 검색</h3>
                <div className={styles.recentList}>
                  {recentSearches.map((term, i) => (
                    <div key={i} className={styles.recentItem} onClick={() => { setQuery(term); searchPlaces(term); }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="9" stroke="#bbb" strokeWidth="1.5"/>
                        <path d="M12 7V12L15 14" stroke="#bbb" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                      <span>{term}</span>
                      <button className={styles.removeBtn} onClick={(e) => removeRecent(e, term)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                          <path d="M18 6L6 18M6 6L18 18" stroke="#ccc" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>인기 검색어</h3>
              <div className={styles.tags}>
                {popularTags.map(tag => (
                  <button key={tag} className={styles.tag} onClick={() => { setQuery(tag); searchPlaces(tag); }}>
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
