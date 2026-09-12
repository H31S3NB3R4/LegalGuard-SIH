/**
 * Shared geocoding helper (address -> coordinates / country).
 *
 * The provider is isolated in this single file so it can be swapped without
 * touching any page. Current provider: OpenStreetMap Nominatim.
 *
 *  - Free, no API key (https://nominatim.openstreetmap.org).
 *  - Usage policy: max ~1 request/second. All requests below are serialized
 *    through a queue to respect that limit; browsers identify the app via the
 *    HTTP Referer they send automatically.
 *
 * To switch back to the Google Geocoding API, re-implement `geocodeAddress`
 * below only — the exported helper signatures stay the same.
 */

const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';
const MIN_REQUEST_INTERVAL_MS = 1100;

/** address -> normalized result, or null for known-unresolvable addresses */
const cache = new Map();

let lastRequestAt = 0;
let queue = Promise.resolve();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Serialize tasks so Nominatim never receives more than one request per
 * interval (its usage policy allows max ~1 request/second).
 */
function enqueue(task) {
  const run = queue.then(async () => {
    const waitMs = lastRequestAt + MIN_REQUEST_INTERVAL_MS - Date.now();
    if (waitMs > 0) await sleep(waitMs);
    lastRequestAt = Date.now();
    return task();
  });
  // Keep the queue usable even when a task rejects.
  queue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function normalize(result) {
  const address = result.address || {};
  return {
    lat: parseFloat(result.lat),
    lng: parseFloat(result.lon),
    formattedAddress: result.display_name || '',
    country: address.country || '',
    countryCode: (address.country_code || '').toUpperCase(),
  };
}

/**
 * Geocode a free-form address.
 *
 * @returns {Promise<
 *   | { lat: number, lng: number, formattedAddress: string, country: string, countryCode: string }
 *   | null
 * >} null when the address cannot be geocoded or the request fails.
 */
export async function geocodeAddress(address) {
  if (!address || typeof address !== 'string') return null;
  const trimmed = address.trim();
  if (!trimmed) return null;

  if (cache.has(trimmed)) return cache.get(trimmed);

  const outcome = await enqueue(async () => {
    try {
      const url =
        `${NOMINATIM_SEARCH_URL}?q=${encodeURIComponent(trimmed)}` +
        '&format=jsonv2&addressdetails=1&limit=1';
      const response = await fetch(url, { headers: { Accept: 'application/json' } });

      if (!response.ok) {
        // Rate limit / transient outage — do not cache, a retry may succeed.
        return { definitive: false, value: null };
      }

      const data = await response.json();
      if (!Array.isArray(data)) return { definitive: false, value: null };
      if (data.length === 0) return { definitive: true, value: null };
      return { definitive: true, value: normalize(data[0]) };
    } catch (error) {
      console.error('[GEOCODE ERROR]', trimmed, error);
      return { definitive: false, value: null };
    }
  });

  if (!outcome.definitive) return null;
  cache.set(trimmed, outcome.value); // negative results are cached too
  return outcome.value;
}

/**
 * Location compliance check used by the products page.
 *
 * @returns {Promise<
 *   | { isInIndia: boolean, formattedAddress: string, country: string, countryCode: string }
 *   | null
 * >}
 */
export async function checkAddressLocation(address) {
  const result = await geocodeAddress(address);
  if (!result) return null;
  return {
    isInIndia: result.countryCode === 'IN',
    formattedAddress: result.formattedAddress,
    country: result.country,
    countryCode: result.countryCode,
  };
}
