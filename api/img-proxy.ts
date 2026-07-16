// api/img-proxy.ts
// Proxies images from R2 through the Vercel domain via GET requests.
// This is needed because <img> tags loading directly from R2 can fail
// due to SSL certificate trust issues on some browsers/devices.

import type { VercelRequest, VercelResponse } from '@vercel/node';

const ALLOWED_CONTENT_TYPES = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'video/webm', 'video/mp4',
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const imageUrl = typeof req.query.url === 'string' ? req.query.url.trim() : '';

    if (!imageUrl) {
        res.status(400).send('Missing image URL');
        return;
    }

    // Security: only allow known storage domains
    const allowedDomains = ['r2.dev', 'cloudflarestorage.com', 'supabase.co'];
    const isAllowed = allowedDomains.some(d => imageUrl.includes(d));
    if (!isAllowed) {
        res.status(403).send('Invalid image source');
        return;
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(imageUrl, {
            signal: controller.signal,
            headers: { 'Accept': 'image/*, video/*, */*' },
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            res.status(502).send(`Failed to fetch image: ${response.statusText}`);
            return;
        }

        const contentType = response.headers.get('content-type') || 'image/jpeg';
        
        // Validate content type
        const isAllowedType = ALLOWED_CONTENT_TYPES.some(t => contentType.includes(t));
        if (!isAllowedType) {
            res.status(400).send('Invalid content type');
            return;
        }

        const buffer = await response.arrayBuffer();

        // Cache for 1 hour on CDN, 1 day on browser
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=3600');
        res.setHeader('Access-Control-Allow-Origin', '*');

        res.status(200).send(Buffer.from(buffer));
    } catch (error: any) {
        console.error('Image proxy error:', error);
        if (error.name === 'AbortError') {
            res.status(504).send('Image proxy timed out');
        } else {
            res.status(500).send(`Image proxy error: ${error.message}`);
        }
    }
}
