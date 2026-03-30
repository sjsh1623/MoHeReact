/**
 * Format address to show district + detailed address
 * If outside current region, show only district
 * @param {string} fullAddress - Full address string
 * @returns {string} Formatted address
 */
export const formatPlaceAddress = (fullAddress) => {
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

export const formatDisplayAddress = (addressData = {}) => {
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
