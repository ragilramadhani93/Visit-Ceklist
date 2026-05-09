import { generatePresignedUrl, UploadConfig } from './uploadHandler';

// Extract bucket and path from URL
export function parseReportUrl(url: string): { bucket: string; path: string } | null {
    try {
        const urlObj = new URL(url);
        
        // 1. Handle custom domains (any r2.dev or mapped domain)
        // If it's a known R2 public bucket URL or custom domain, the path is everything after the first slash
        if (url.includes('r2.dev') || url.includes('vercel.app') || !url.includes('cloudflarestorage.com')) {
            const path = urlObj.pathname.substring(1); // Remove leading slash
            // Default bucket if not specified in hostname
            return { bucket: process.env.VITE_R2_BUCKET_NAME || 'field-ops-photos', path };
        }

        // 2. Handle standard R2 API URL: https://<bucket>.<accountid>.r2.cloudflarestorage.com/<path>
        if (url.includes('r2.cloudflarestorage.com')) {
            const parts = urlObj.hostname.split('.');
            if (parts.length >= 4) {
                const bucket = parts[0];
                const path = urlObj.pathname.substring(1);
                return { bucket, path };
            }
        }

        // Fallback: just try to get the path
        const fallbackPath = urlObj.pathname.substring(1);
        if (fallbackPath) {
            return { bucket: process.env.VITE_R2_BUCKET_NAME || 'field-ops-photos', path: fallbackPath };
        }

        return null;
    } catch (e) {
        console.error('Failed to parse report URL:', url, e);
        // Last resort: if it's just a path or we can't parse as URL, return as is
        if (url && !url.startsWith('http')) {
            return { bucket: process.env.VITE_R2_BUCKET_NAME || 'field-ops-photos', path: url.replace(/^\/+/, '') };
        }
        return null;
    }
}

export async function handleReportDownloadRequest(
    method: string | undefined,
    body: any,
    config: UploadConfig
): Promise<{ status: number; payload: unknown }> {
    if (method !== 'POST') {
        return { status: 405, payload: { error: 'Method not allowed' } };
    }

    if (!config.accountId || !config.accessKeyId || !config.secretAccessKey) {
        return { status: 500, payload: { error: 'R2 configuration incomplete on server' } };
    }

    try {
        const reportUrl = typeof body?.reportPath === 'string' ? body.reportPath.trim() : '';

        if (!reportUrl) {
            return { status: 400, payload: { error: 'Missing reportPath' } };
        }

        const parsed = parseReportUrl(reportUrl);
        if (!parsed) {
            return { status: 400, payload: { error: 'Invalid report URL format' } };
        }

        const { bucket, path: fileName } = parsed;

        // Generate a presigned URL that expires in 2 hours
        const presignedUrl = await generatePresignedUrl(
            config as any,
            bucket,
            fileName,
            'application/pdf',
            2 * 3600 // 2 hours expiry
        );

        return { status: 200, payload: { presignedUrl } };
    } catch (error: any) {
        console.error('Failed to generate presigned download URL:', error);
        return { status: 500, payload: { error: error?.message || 'Failed to generate download URL' } };
    }
}

// Vercel serverless handler
type ApiRequest = {
    method?: string;
    body?: any;
};

type ApiResponse = {
    status: (code: number) => { json: (payload: unknown) => void };
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
    const { status, payload } = await handleReportDownloadRequest(
        req.method,
        req.body,
        {
            accountId: process.env.VITE_R2_ACCOUNT_ID,
            accessKeyId: process.env.VITE_R2_ACCESS_KEY_ID,
            secretAccessKey: process.env.VITE_R2_SECRET_ACCESS_KEY,
        }
    );

    return res.status(status).json(payload);
}
