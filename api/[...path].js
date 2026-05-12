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
    const contentType = proxyRes.headers['content-type'] || 'application/octet-stream';
    const responseHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Expose-Headers': 'Content-Disposition, Content-Length, Content-Type',
      'Content-Type': contentType,
    };
    // Pass through content-length for binary responses
    if (proxyRes.headers['content-length']) {
      responseHeaders['Content-Length'] = proxyRes.headers['content-length'];
    }
    // Pass through transfer-encoding
    if (proxyRes.headers['transfer-encoding']) {
      responseHeaders['Transfer-Encoding'] = proxyRes.headers['transfer-encoding'];
    }

    res.writeHead(proxyRes.statusCode, responseHeaders);

    // Stream binary data without any transformation
    proxyRes.on('data', (chunk) => res.write(chunk));
    proxyRes.on('end', () => res.end());
    proxyRes.on('error', (err) => { console.error('[ProxyRes Error]', err); res.end(); });
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
