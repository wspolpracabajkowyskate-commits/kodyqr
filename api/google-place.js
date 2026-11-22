// Resolves a public Google Maps profile URL or place name to a Place ID.
// Uses a fixed upstream endpoint; this is not a general-purpose proxy.
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ success: false, error: { message: 'Method not allowed' } });
  }

  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!query || query.length > 2048) {
    return res.status(400).json({ success: false, error: { message: 'Paste a Google Maps profile link or a place name.' } });
  }

  try {
    const upstream = new URL('https://znajdzplaceid.pl/api/search');
    upstream.searchParams.set('query', query);
    const response = await fetch(upstream, {
      headers: { Accept: 'application/json', 'User-Agent': 'KodyQR/1.0' },
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) {
      return res.status(502).json({ success: false, error: { message: 'The place lookup service is temporarily unavailable.' } });
    }
    const payload = await response.json();
    const place = payload && payload.data;
    if (!payload.success || !place || !place.place_id) {
      return res.status(404).json({ success: false, error: { message: 'No matching Google place was found.' } });
    }
    return res.status(200).json({
      success: true,
      data: {
        place_id: place.place_id,
        name: place.name || '',
        address: place.address || '',
        alternatives: Array.isArray(place.alternatives) ? place.alternatives : []
      }
    });
  } catch (error) {
    return res.status(502).json({ success: false, error: { message: 'Could not reach the place lookup service. Try again or use the official Google review link.' } });
  }
};
