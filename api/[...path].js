import https from 'https';

export const config = { api: { bodyParser: false } };

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-API-Key, Content-Type, Content-Length');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const fullPath = req.url;
  const forwardHeaders = {};
  ['content-type', 'content-length'].forEach(k => {
    if (req.headers[k]) forwardHeaders[k] = req.headers[k];
  });
  forwardHeaders['host'] = 'cloud.comfy.org';
  forwardHeaders['X-API-Key'] = 'comfyui-28d7e20a77cbf2174ca868e4c7408bc362525e12ba0f3e3179be7440d7c6dc90';

  const proxyReq = https.request(
    { hostname: 'cloud.comfy.org', path: fullPath, method: req.method, headers: forwardHeaders },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode, {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': proxyRes.headers['content-type'] || 'application/json',
      });
      proxyRes.pipe(res);
    }
  );
  proxyReq.on('error', err => res.status(502).json({ error: err.message }));
  proxyReq.setTimeout(120000, () => { proxyReq.destroy(); res.status(504).json({ error: 'Timeout' }); });
  req.pipe(proxyReq);
}
