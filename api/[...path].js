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

  // Use req.url directly — e.g. /api/upload/image, /api/prompt, /api/job/xxx/status
  const fullPath = req.url;
  console.log(`[Proxy] ${req.method} ${fullPath}`);

  // Forward headers + inject API key directly
  const forwardHeaders = {};
  const allowedHeaders = ['content-type', 'content-length'];
  Object.entries(req.headers).forEach(([k, v]) => {
    if (allowedHeaders.includes(k.toLowerCase())) {
      forwardHeaders[k] = v;
    }
  });
  forwardHeaders['host'] = 'cloud.comfy.org';
  forwardHeaders['X-API-Key'] = 'comfyui-28d7e20a77cbf2174ca868e4c7408bc362525e12ba0f3e3179be7440d7c6dc90';

  const options = {
    hostname: 'cloud.comfy.org',
    path: fullPath,
    method: req.method,
    headers: forwardHeaders,
  };

  const proxyReq = https.request(options, (proxyRes) => {
    const contentType = proxyRes.headers['content-type'] || 'application/json';
    const responseHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Expose-Headers': 'Content-Disposition, Content-Length',
      'Content-Type': contentType,
    };
    if (proxyRes.headers['content-length']) {
      responseHeaders['Content-Length'] = proxyRes.headers['content-length'];
    }
    // Add download header for image requests
    if (fullPath.includes('/api/view') && contentType.startsWith('image/')) {
      const fname = new URL('https://x.com' + fullPath).searchParams.get('filename') || 'image.png';
      responseHeaders['Content-Disposition'] = `attachment; filename="${fname}"`;
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
