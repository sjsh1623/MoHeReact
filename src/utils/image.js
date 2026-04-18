// Build the safest available image origin.
// 1) Prefer explicitly provided VITE_IMAGE_BASE_URL.
// 2) Fallback to current origin + /image/ so HTTPS deployments don't mix content.
// 3) Upgrade any http:// base to https:// when the site itself is served over HTTPS.
const ABSOLUTE_URL_REGEX = /^https?:\/\//i;

const ensureTrailingSlash = (value = '') =>
  value.endsWith('/') ? value : `${value}/`;

// Default image base URLs - use Caddy proxy path
const DEFAULT_PROD_IMAGE_BASE = 'https://mohe.today/image/';
const DEFAULT_DEV_IMAGE_BASE = '/image/';

// Log configuration for debugging
const logImageConfig = (baseUrl, source) => {
  if (typeof window !== 'undefined' && !window.__IMAGE_CONFIG_LOGGED__) {
    console.log(`🖼️ Image Base URL: ${baseUrl} (source: ${source})`);
    console.log(`🔒 Protocol: ${window.location.protocol}`);
    console.log(`🌐 Hostname: ${window.location.hostname}`);
    window.__IMAGE_CONFIG_LOGGED__ = true;
  }
};

const buildDefaultBaseUrl = () => {
  if (typeof window === 'undefined') {
    return DEFAULT_PROD_IMAGE_BASE;
  }

  const { hostname, protocol, host } = window.location;

  // Production domains use Caddy proxy path
  // This ensures HTTPS images on HTTPS sites (prevents mixed content blocking)
  if (hostname.endsWith('mohe.today')) {
    const baseUrl = DEFAULT_PROD_IMAGE_BASE;
    logImageConfig(baseUrl, 'production domain');
    return baseUrl;
  }

  // For all other deployments (dev server, local preview, Docker), use
  // same-origin proxy path. IMPORTANT: use `host` (includes port) not
  // `hostname`, otherwise dev URLs collapse to `http://localhost/image/`
  // which is intercepted by Caddy's IP-block rule (returns 403).
  // Dev: Vite proxies /image → localhost:5200 (see vite.config.js)
  // Prod: Caddy proxies /image/* → moheimageprocessor
  const baseUrl = `${protocol}//${host}/image/`;
  logImageConfig(baseUrl, 'same-origin proxy');
  return baseUrl;
};

const upgradeProtocolIfNeeded = (base) => {
  const normalizedBase = ensureTrailingSlash(base);

  if (typeof window === 'undefined') {
    return normalizedBase;
  }

  if (window.location.protocol === 'https:' && normalizedBase.startsWith('http://')) {
    try {
      const url = new URL(normalizedBase, window.location.origin);
      url.protocol = 'https:';
      return ensureTrailingSlash(url.toString());
    } catch (error) {
      console.warn('Failed to normalize image base URL, keeping original value.', error);
      return ensureTrailingSlash(normalizedBase.replace(/^http:/, 'https:'));
    }
  }

  return normalizedBase;
};

const resolveImageBaseUrl = () => {
  const envValue = import.meta.env.VITE_IMAGE_BASE_URL?.trim();
  if (envValue) {
    return upgradeProtocolIfNeeded(envValue);
  }
  return buildDefaultBaseUrl();
};

const IMAGE_BASE_URL = resolveImageBaseUrl();

export const buildImageUrl = (path) => {
  if (!path || typeof path !== 'string') {
    return '';
  }

  const trimmed = path.trim();
  if (!trimmed) {
    return '';
  }

  if (ABSOLUTE_URL_REGEX.test(trimmed)) {
    // If it's already a full URL, decode once to fix double encoding
    try {
      return decodeURIComponent(trimmed);
    } catch {
      return trimmed;
    }
  }

  const withoutLeadingSlashes = trimmed.replace(/^\/+/, '');
  const withoutImagesPrefix = withoutLeadingSlashes.replace(/^(images?|Images?)\//, '');

  // Decode first to handle potentially pre-encoded paths, then encode properly
  // This fixes double-encoding issues from backend
  let decodedPath = withoutImagesPrefix;
  try {
    decodedPath = decodeURIComponent(withoutImagesPrefix);
  } catch {
    // If decode fails, use original path
    decodedPath = withoutImagesPrefix;
  }

  // Encode URI component to handle Korean characters and special characters
  // Split by '/' to encode each path segment separately
  const encodedPath = decodedPath.split('/').map(encodeURIComponent).join('/');

  return `${IMAGE_BASE_URL}${encodedPath}`;
};

export const buildImageUrlList = (paths = []) => {
  if (!Array.isArray(paths)) {
    return [];
  }

  const seen = new Set();
  const resolved = [];

  paths.forEach((path) => {
    const url = buildImageUrl(path);
    if (url && !seen.has(url)) {
      seen.add(url);
      resolved.push(url);
    }
  });

  return resolved;
};

export const normalizePlaceImages = (place = {}) => {
  if (!place || typeof place !== 'object') {
    return place;
  }

  const gallerySources = [];
  if (Array.isArray(place.images)) {
    gallerySources.push(...place.images);
  }
  if (Array.isArray(place.gallery)) {
    gallerySources.push(...place.gallery);
  }

  const normalizedGallery = buildImageUrlList(gallerySources);
  const primaryImage = buildImageUrl(
    place.image || place.imageUrl || normalizedGallery[0] || ''
  );

  const resolvedImages = normalizedGallery.length
    ? normalizedGallery
    : primaryImage
      ? [primaryImage]
      : [];

  return {
    ...place,
    image: primaryImage || '',
    imageUrl: primaryImage || '',
    images: resolvedImages,
    gallery: normalizedGallery.length ? normalizedGallery : place.gallery
  };
};

export { IMAGE_BASE_URL };
