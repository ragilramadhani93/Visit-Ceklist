// api/pdf-download.ts
// Proxies PDF download from R2 through the Vercel domain to avoid SSL certificate
// issues when users click R2 direct links from WhatsApp.

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Only allow GET requests
    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const reportUrl = typeof req.query.url === 'string' ? req.query.url.trim() : '';
    const checklistId = typeof req.query.id === 'string' ? req.query.id.trim() : '';

    let targetUrl = reportUrl;

    // If no URL but checklist ID provided, construct from R2 (fallback)
    if (!targetUrl && checklistId) {
        // This fallback won't know the exact filename, so we redirect to the app's reports page
        res.redirect(302, '/');
        return;
    }

    if (!targetUrl) {
        res.status(400).send('Missing report URL');
        return;
    }

    // Security: only allow R2 domains to prevent open redirect
    const allowedDomains = ['r2.dev', 'cloudflarestorage.com'];
    const isAllowed = allowedDomains.some(d => targetUrl.includes(d));
    if (!isAllowed) {
        res.status(403).send('Invalid file source');
        return;
    }

    try {
        // Fetch the PDF from R2 (server-side, no SSL issues)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const response = await fetch(targetUrl, {
            signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            res.status(502).send(`Failed to fetch PDF: ${response.statusText}`);
            return;
        }

        // Extract filename from URL or use default
        const urlPath = new URL(targetUrl).pathname;
        const filename = urlPath.split('/').pop() || 'audit-report.pdf';

        // Get the PDF data as ArrayBuffer
        const pdfBuffer = await response.arrayBuffer();

        // Set proper headers for PDF download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', pdfBuffer.byteLength);
        res.setHeader('Cache-Control', 'public, max-age=3600');

        // Send the PDF
        res.status(200).send(Buffer.from(pdfBuffer));
    } catch (error: any) {
        console.error('PDF download proxy error:', error);
        if (error.name === 'AbortError') {
            res.status(504).send('PDF download timed out');
        } else {
            res.status(500).send(`Failed to proxy PDF: ${error.message}`);
        }
    }
}
