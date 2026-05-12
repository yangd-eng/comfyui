/**
 * Expression Studio - Vercel Proxy Function
 */

export const config = {
  api: { bodyParser: false },
};

const API_KEY = 'comfyui-28d7e20a77cbf2174ca868e4c7408bc362525e12ba0f3e3179be7440d7c6dc90';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-API-Key, Content-Type, Content-Length');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const targetUrl = `https://cloud.comfy.org${req.url}`;
  console.log(`[Proxy] ${req.method} ${req.url}`);

  // Read request body for POST
  let body = null;
  if (req.method === 'POST') {
    body = await new Promise((resolve) => {
      const chunks = [];
      req.on('data', c => chunks.push(c));
      req.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  // Forward to cloud.comfy.org using fetch (follows redirects automatically)
  const fetchRes = await fetch(targetUrl, {
    method: req.method,
    headers: {
      'Content-Type': req.headers['content-type'] || 'application/json',
      'X-API-Key': API_KEY,
    },
    body: body || undefined,
    redirect: 'follow',
  });

  // Stream response back
  const contentType = fetchRes.headers.get('content-type') || 'application/octet-stream';
  res.setHeader('Content-Type', contentType);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(fetchRes.status);

  const arrayBuffer = await fetchRes.arrayBuffer();
  res.send(Buffer.from(arrayBuffer));
}
