// Resolve a Google Maps URL or business name to a Google Place ID.
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ success: false, error: { message: 'Method not allowed' } });
  }
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!query || query.length > 2048) {
    return res.status(400).json({ success: false, error: { message: 'Wklej link do wizytówki Google lub nazwę firmy.' } });
  }

  // API v2 documents /all?url= as the universal resolver for URLs, names,
  // CIDs and Place IDs. /search?query= is retained as a fallback.
  const attempts = [
    { path: '/api/all', param: 'url' },
    { path: '/api/', param: 'url', endpoint: 'all' },
    { path: '/api/search', param: 'query' },
    { path: '/api/', param: 'query', endpoint: 'search' }
  ];
  let unavailable = false;
  for (const attempt of attempts) {
    try {
      const endpoint = new URL(attempt.path, 'https://znajdzplaceid.pl');
      if (attempt.endpoint) endpoint.searchParams.set('endpoint', attempt.endpoint);
      endpoint.searchParams.set(attempt.param, query);
      const response = await fetch(endpoint, {
        headers: { Accept: 'application/json', 'User-Agent': 'KodyQR/1.2' },
        signal: AbortSignal.timeout(9000)
      });
      if (!response.ok) {
        if (response.status === 429 || response.status >= 500) unavailable = true;
        continue;
      }
      const payload = await response.json();
      const data = payload && payload.data;
      const details = data && (data.details || data);
      const placeId = data && (data.place_id || data.placeId || (data.details && data.details.place_id));
      if (payload && payload.success && placeId) {
        return res.status(200).json({
          success: true,
          data: {
            place_id: placeId,
            name: (details && (details.name || details.nazwa_wizytowki)) || data.name || '',
            address: (details && (details.address || details.adres)) || data.address || '',
            alternatives: Array.isArray(data.alternatives) ? data.alternatives : []
          }
        });
      }
      if (payload && payload.success === false && payload.error && /nie znaleziono|not found/i.test(payload.error.message || '')) {
        // Try other endpoint variants; only return not-found if all complete.
        continue;
      }
    } catch (_) {
      unavailable = true;
    }
  }
  return res.status(unavailable ? 503 : 404).json({
    success: false,
    error: {
      code: unavailable ? 'PLACE_LOOKUP_UNAVAILABLE' : 'PLACE_NOT_FOUND',
      message: unavailable
        ? 'Baza miejsc Google jest chwilowo niedostępna. Spróbuj ponownie albo użyj oficjalnego linku Google.'
        : 'Nie znaleziono wizytówki. Wklej pełny link z Google Maps albo nazwę firmy i miasto.'
    }
  });
};
