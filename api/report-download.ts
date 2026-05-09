import { createHash, createHmac } from 'node:crypto';

// --- Shared S3/R2 Signing Logic (Node.js compatible) ---

function hmacSha256(key: Buffer | string, message: string): Buffer {
    return createHmac('sha256', key).update(message, 'utf8').digest();
}

function sha256(data: string): string {
    return createHash('sha256').update(data, 'utf8').digest('hex');
}

async function getSignatureKey(key: string, dateStamp: string, region: string, service: string): Promise<Buffer> {
    const kDate = hmacSha256(`AWS4${key}`, dateStamp);
    const kRegion = hmacSha256(kDate, region);
    const kService = hmacSha256(kRegion, service);
    return hmacSha256(kService, 'aws4_request');
}

function encodeKey(key: string): string {
    return key.split('/').map(segment => encodeURIComponent(segment)).join('/');
}

export type UploadConfig = {
    accountId?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    publicUrlBase?: string;
};

async function generatePresignedUrl(config: Required<UploadConfig>, bucket: string, fileName: string, contentType: string, expiresIn = 3600): Promise<string> {
    const region = 'auto';
    const service = 's3';
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.substring(0, 8);

    const host = `${config.accountId}.r2.cloudflarestorage.com`;
    const encodedKey = encodeKey(fileName);
    const canonicalUri = `/${bucket}/${encodedKey}`;
    const endpoint = `https://${host}${canonicalUri}`;
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const credential = `${config.accessKeyId}/${credentialScope}`;

    const queryParams = new URLSearchParams({
        'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
        'X-Amz-Credential': credential,
        'X-Amz-Date': amzDate,
        'X-Amz-Expires': String(expiresIn),
        'X-Amz-SignedHeaders': 'host', // For GET downloads, only sign host
    });

    const sortedQuery = Array.from(queryParams.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join('&');

    const canonicalHeaders = `host:${host}\n`;
    const signedHeaders = 'host';

    const canonicalRequest = [
        'GET', // Reports are downloaded via GET
        canonicalUri,
        sortedQuery,
        canonicalHeaders,
        signedHeaders,
        'UNSIGNED-PAYLOAD',
    ].join('\n');

    const canonicalRequestHash = sha256(canonicalRequest);
    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${canonicalRequestHash}`;
    const signingKey = await getSignatureKey(config.secretAccessKey, dateStamp, region, service);
    const signature = hmacSha256(signingKey, stringToSign).toString('hex');

    return `${endpoint}?${sortedQuery}&X-Amz-Signature=${signature}`;
}

// --- Report Specific Logic ---

export function parseReportUrl(url: string): { bucket: string; path: string } | null {
    try {
        const urlObj = new URL(url);
        
        if (url.includes('r2.dev') || url.includes('vercel.app') || !url.includes('cloudflarestorage.com')) {
            const path = urlObj.pathname.substring(1); 
            return { bucket: process.env.VITE_R2_BUCKET_NAME || 'field-ops-photos', path };
        }

        if (url.includes('r2.cloudflarestorage.com')) {
            const parts = urlObj.hostname.split('.');
            if (parts.length >= 4) {
                const bucket = parts[0];
                const path = urlObj.pathname.substring(1);
                return { bucket, path };
            }
        }

        const fallbackPath = urlObj.pathname.substring(1);
        if (fallbackPath) {
            return { bucket: process.env.VITE_R2_BUCKET_NAME || 'field-ops-photos', path: fallbackPath };
        }

        return null;
    } catch (e) {
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

        const presignedUrl = await generatePresignedUrl(
            config as Required<UploadConfig>,
            bucket,
            fileName,
            'application/pdf',
            2 * 3600 
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
