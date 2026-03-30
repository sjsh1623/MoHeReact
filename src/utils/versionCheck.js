/**
 * 버전 체크 및 캐시 버스팅 유틸리티
 * iOS WebView에서 새 버전 배포 시 자동으로 캐시를 무효화합니다.
 */

const VERSION_STORAGE_KEY = 'app_version';
const LAST_CHECK_KEY = 'app_version_last_check';
const CHECK_INTERVAL = 60 * 1000; // 1분마다 체크

/**
 * 현재 앱 버전 (빌드 시 주입됨)
 */
export const getCurrentVersion = () => {
  // eslint-disable-next-line no-undef
  return typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
};

/**
 * 저장된 버전 가져오기
 */
export const getStoredVersion = () => {
  try {
    return localStorage.getItem(VERSION_STORAGE_KEY);
  } catch {
    return null;
  }
};

/**
 * 버전 저장
 */
export const setStoredVersion = (version) => {
  try {
    localStorage.setItem(VERSION_STORAGE_KEY, version);
  } catch {
    // localStorage 접근 실패 시 무시
  }
};

/**
 * 서버에서 최신 버전 정보 가져오기
 */
export const fetchLatestVersion = async () => {
  try {
    // 캐시 무시를 위해 타임스탬프 추가
    const response = await fetch(`/version.json?t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.version;
  } catch {
    return null;
  }
};

/**
 * 앱 캐시 초기화 및 새로고침
 */
export const clearCacheAndReload = async () => {
  try {
    // Service Worker 캐시 삭제
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map((cacheName) => caches.delete(cacheName))
      );
    }

    // localStorage의 버전 정보 업데이트
    const latestVersion = await fetchLatestVersion();
    if (latestVersion) {
      setStoredVersion(latestVersion);
    }

    // 강제 새로고침 (캐시 무시)
    window.location.reload();
  } catch {
    // 실패 시에도 새로고침 시도
    window.location.reload();
  }
};

/**
 * 버전 업데이트 확인 및 처리
 * @param {boolean} forceCheck - 강제 체크 여부
 * @returns {Promise<boolean>} - 업데이트가 필요한 경우 true
 */
export const checkForUpdates = async (forceCheck = false) => {
  try {
    // 마지막 체크 시간 확인 (너무 자주 체크하지 않도록)
    if (!forceCheck) {
      const lastCheck = localStorage.getItem(LAST_CHECK_KEY);
      if (lastCheck && Date.now() - parseInt(lastCheck, 10) < CHECK_INTERVAL) {
        return false;
      }
    }

    localStorage.setItem(LAST_CHECK_KEY, Date.now().toString());

    const currentVersion = getCurrentVersion();
    const storedVersion = getStoredVersion();
    const latestVersion = await fetchLatestVersion();

    // 개발 모드에서는 버전 체크 건너뛰기
    if (currentVersion === 'dev') {
      return false;
    }

    // 최초 실행 시 버전 저장
    if (!storedVersion) {
      setStoredVersion(currentVersion);
      return false;
    }

    // 서버 버전과 현재 버전이 다르면 업데이트 필요
    if (latestVersion && latestVersion !== currentVersion) {
      console.log(`[Version Check] New version available: ${latestVersion} (current: ${currentVersion})`);
      return true;
    }

    // 저장된 버전과 현재 버전이 다르면 (앱 업데이트 후 첫 실행)
    if (storedVersion !== currentVersion) {
      console.log(`[Version Check] App updated: ${storedVersion} -> ${currentVersion}`);
      setStoredVersion(currentVersion);
      return false;
    }

    return false;
  } catch {
    return false;
  }
};

/**
 * 버전 체크 초기화
 * 앱 시작 시 호출하여 버전 확인 및 자동 업데이트 처리
 */
export const initializeVersionCheck = async () => {
  const currentVersion = getCurrentVersion();
  const storedVersion = getStoredVersion();

  console.log(`[Version Check] Current: ${currentVersion}, Stored: ${storedVersion}`);

  // 저장된 버전과 다르면 새 버전으로 업데이트됨
  if (storedVersion && storedVersion !== currentVersion && currentVersion !== 'dev') {
    console.log('[Version Check] New version detected, clearing old cache...');

    // 새 버전 저장
    setStoredVersion(currentVersion);

    // Service Worker 캐시 삭제
    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
        console.log('[Version Check] Cache cleared successfully');
      } catch {
        console.log('[Version Check] Failed to clear cache');
      }
    }
  } else if (!storedVersion && currentVersion !== 'dev') {
    // 최초 실행 시 버전 저장
    setStoredVersion(currentVersion);
  }

  // 주기적 버전 체크 (1분마다) — 새 버전 발견 시 자동 새로고침
  setInterval(async () => {
    const needsUpdate = await checkForUpdates();
    if (needsUpdate) {
      console.log('[Version Check] Auto-refreshing to new version...');
      setStoredVersion(await fetchLatestVersion());
      window.location.reload();
    }
  }, CHECK_INTERVAL);
};

export default {
  getCurrentVersion,
  getStoredVersion,
  setStoredVersion,
  fetchLatestVersion,
  checkForUpdates,
  clearCacheAndReload,
  initializeVersionCheck,
};
