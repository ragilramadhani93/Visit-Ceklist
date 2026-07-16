// api/image-proxy.ts
// Server-side image proxy to avoid CORS issues when fetching images for PDF generation.
// On Vercel, the server can fetch from R2 without CORS restrictions.

type ApiRequest = {
    method?: string;
    body?: any;
};

type ApiResponse = {
    status: (code: number) => { json: (payload: unknown) => void };
};

export async function handleImageProxyRequest(
    method: string | undefined,
    body: any
): Promise<{ status: number; payload: unknown }> {
    if (method !== 'POST') {
        return { status: 405, payload: { error: 'Method not allowed' } };
    }

    try {
        const imageUrl = typeof body?.url === 'string' ? body.url.trim() : '';

        if (!imageUrl) {
            return { status: 400, payload: { error: 'Missing url' } };
        }

        // Only proxy allowed domains for security
        const allowedDomains = ['r2.dev', 'cloudflarestorage.com', 'supabase.co'];
        const isAllowed = allowedDomains.some(d => imageUrl.includes(d));
        if (!isAllowed) {
            return { status: 403, payload: { error: 'Domain not allowed' } };
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
            const response = await fetch(imageUrl, {
                signal: controller.signal,
                headers: {
                    'Accept': 'image/*, video/*, */*',
                },
            });
            clearTimeout(timeoutId);

            if (!response.ok) {
                return { status: response.status, payload: { error: `Upstream fetch failed: ${response.statusText}` } };
            }

            const contentType = response.headers.get('content-type') || 'image/jpeg';
            const blob = await response.blob();

            // Convert blob to base64 data URI
            const buffer = await blob.arrayBuffer();
            const base64 = Buffer.from(buffer).toString('base64');
            const dataUri = `data:${contentType};base64,${base64}`;

            return { status: 200, payload: { dataUri, contentType } };
        } catch (fetchError: any) {
            clearTimeout(timeoutId);
            return { status: 502, payload: { error: `Failed to fetch image: ${fetchError?.message || 'Unknown error'}` } };
        }
    } catch (error: any) {
        return { status: 500, payload: { error: error?.message || 'Image proxy failed' } };
    }
}

// Vercel serverless handler
export default async function handler(req: ApiRequest, res: ApiResponse) {
    const { status, payload } = await handleImageProxyRequest(
        req.method,
        req.body,
    );

    return res.status(status).json(payload);
}

export const config = {
    api: {
        bodyParser: true, // Use default JSON body parser
    },
};
