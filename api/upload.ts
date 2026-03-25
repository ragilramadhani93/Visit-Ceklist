import { createHash, createHmac } from 'node:crypto';

type ApiRequest = {
    method?: string;
    body?: any;
};

type ApiResponse = {
    status: (code: number) => { json: (payload: unknown) => void };
};

type UploadConfig = {
    accountId?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    publicUrlBase?: string;
};

const FALLBACK_UPLOAD_LIMIT_BYTES = 3 * 1024 * 1024;

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
        'X-Amz-SignedHeaders': 'content-type;host',
    });

    const sortedQuery = Array.from(queryParams.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join('&');

    const canonicalHeaders = `content-type:${contentType}\nhost:${host}\n`;
    const signedHeaders = 'content-type;host';

    const canonicalRequest = [
        'PUT',
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

async function handleUploadRequest(method: string | undefined, body: any, config: UploadConfig) {
    if (method !== 'POST') {
        return { status: 405, payload: { error: 'Method not allowed' } };
    }

    if (!config.accountId || !config.accessKeyId || !config.secretAccessKey || !config.publicUrlBase) {
        return { status: 500, payload: { error: 'R2 configuration incomplete on server' } };
    }

    try {
        const fileName = typeof body?.fileName === 'string' ? body.fileName.replace(/^\/+/, '').trim() : '';
        const bucket = typeof body?.bucket === 'string' ? body.bucket.trim() : '';
        const contentType = typeof body?.contentType === 'string' && body.contentType ? body.contentType : 'application/octet-stream';
        const fileBase64 = typeof body?.fileBase64 === 'string' ? body.fileBase64 : '';

        if (!fileName || !bucket) {
            return { status: 400, payload: { error: 'Missing fileName or bucket' } };
        }

        const presignedUrl = await generatePresignedUrl(config as Required<UploadConfig>, bucket, fileName, contentType);
        const base = config.publicUrlBase.endsWith('/') ? config.publicUrlBase.slice(0, -1) : config.publicUrlBase;
        const publicUrl = `${base}/${encodeKey(fileName)}`;

        if (fileBase64) {
            const cleanBase64 = fileBase64.includes(',') ? fileBase64.split(',')[1] : fileBase64;
            const fileBuffer = Buffer.from(cleanBase64, 'base64');

            if (fileBuffer.length > FALLBACK_UPLOAD_LIMIT_BYTES) {
                return {
                    status: 413,
                    payload: {
                        error: `Fallback upload only supports files up to ${Math.round(FALLBACK_UPLOAD_LIMIT_BYTES / (1024 * 1024))} MB`,
                    },
                };
            }

            const uploadResponse = await fetch(presignedUrl, {
                method: 'PUT',
                headers: {
                    'Content-Type': contentType,
                },
                body: fileBuffer,
            });

            if (!uploadResponse.ok) {
                const errorText = await uploadResponse.text();
                return {
                    status: uploadResponse.status,
                    payload: {
                        error: `Server-side upload failed: ${errorText || uploadResponse.statusText}`,
                    },
                };
            }

            return { status: 200, payload: { publicUrl, uploadedVia: 'server-fallback' } };
        }

        return { status: 200, payload: { presignedUrl, publicUrl } };
    } catch (error: any) {
        return { status: 500, payload: { error: error?.message || 'Failed to generate presigned URL' } };
    }
}

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '4mb',
        },
    },
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
    try {
        if (req.method === 'GET') {
            return res.status(200).json({
                ok: true,
                env: {
                    accountId: Boolean(process.env.VITE_R2_ACCOUNT_ID),
                    accessKeyId: Boolean(process.env.VITE_R2_ACCESS_KEY_ID),
                    secretAccessKey: Boolean(process.env.VITE_R2_SECRET_ACCESS_KEY),
                    publicUrlBase: Boolean(process.env.VITE_R2_PUBLIC_URL),
                },
            });
        }

        const { status, payload } = await handleUploadRequest(req.method, req.body, {
            accountId: process.env.VITE_R2_ACCOUNT_ID,
            accessKeyId: process.env.VITE_R2_ACCESS_KEY_ID,
            secretAccessKey: process.env.VITE_R2_SECRET_ACCESS_KEY,
            publicUrlBase: process.env.VITE_R2_PUBLIC_URL,
        });

        return res.status(status).json(payload);
    } catch (error: any) {
        return res.status(500).json({
            error: error?.message || 'Unexpected upload handler failure',
            name: error?.name || 'Error',
        });
    }
}
