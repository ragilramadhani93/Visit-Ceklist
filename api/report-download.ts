import { generatePresignedUrl, UploadConfig } from './uploadHandler';

// Extract bucket and path from old custom domain URL
export function parseReportUrl(url: string): { bucket: string; path: string } | null {
    try {
        // Handle old custom domain: https://pub-9d01db2ebda64069a7e7fd1f530e753e.r2.dev/reports/...
        if (url.includes('pub-9d01db2ebda64069a7e7fd1f530e753e.r2.dev')) {
            const path = new URL(url).pathname.substring(1); // Remove leading slash
            return { bucket: 'field-ops-photos', path };
        }

        // Handle standard R2 URL: https://field-ops-photos.dfcb9a70877400b4f29c4e0f79da30e2.r2.cloudflarestorage.com/reports/...
        if (url.includes('r2.cloudflarestorage.com')) {
            const urlObj = new URL(url);
            const match = urlObj.hostname.match(/^([a-z0-9-]+)\.dfcb9a70877400b4f29c4e0f79da30e2\.r2\.cloudflarestorage\.com$/);
            if (match) {
                const bucket = match[1];
                const path = urlObj.pathname.substring(1); // Remove leading slash
                return { bucket, path };
            }
        }

        return null;
    } catch (e) {
        console.error('Failed to parse report URL:', url, e);
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
