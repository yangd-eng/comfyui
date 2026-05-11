/**
 * Expression Studio - Vercel Proxy Function
 * Forwards all /api/* requests to cloud.comfy.org
 */

import https from 'https';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default function handler(req, res) {
  // CORS preflight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-API-Key, Content-Type, Content-Length');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Build target path: /api/upload/image, /api/prompt, etc.
  const pathSegments = Array.isArray(req.query.path) ? req.query.path : [req.query.path];
  const targetPath = '/api/' + pathSegments.join('/');

  // Forward query string (except internal 'path' param)
  const originalUrl = new URL(req.url, 'http://localhost');
  const params = new URLSearchParams();
  originalUrl.searchParams.forEach((v, k) => {
    if (k !== 'path') params.set(k, v);
  });
  const queryString = params.toString();
  const fullPath = targetPath + (queryString ? '?' + queryString : '');

  // Forward headers
  const forwardHeaders = {};
  const allowedHeaders = ['x-api-key', 'content-type', 'content-length'];
  Object.entries(req.headers).forEach(([k, v]) => {
    if (allowedHeaders.includes(k.toLowerCase())) {
      forwardHeaders[k] = v;
    }
  });
  forwardHeaders['host'] = 'cloud.comfy.org';

  const options = {
    hostname: 'cloud.comfy.org',
    path: fullPath,
    method: req.method,
    headers: forwardHeaders,
  };

  const proxyReq = https.request(options, (proxyRes) => {
    const responseHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': proxyRes.headers['content-type'] || 'application/json',
    };
    if (proxyRes.headers['content-length']) {
      responseHeaders['Content-Length'] = proxyRes.headers['content-length'];
    }

    res.writeHead(proxyRes.statusCode, responseHeaders);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error('[Proxy Error]', err.message);
    res.status(502).json({ error: err.message });
  });

  proxyReq.setTimeout(120000, () => {
    proxyReq.destroy();
    res.status(504).json({ error: 'Timeout' });
  });

  req.pipe(proxyReq);
}
