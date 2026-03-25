export type UploadRequestBody = {
    fileName?: unknown;
    bucket?: unknown;
    contentType?: unknown;
};

export type UploadConfig = {
    accountId?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    publicUrlBase?: string;
};

type UploadResponse = {
    status: number;
    payload: unknown;
};

async function hmacSha256(key: ArrayBuffer | Uint8Array, message: string): Promise<ArrayBuffer> {
    const cryptoKey = await crypto.subtle.importKey('raw', key as ArrayBuffer, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
}

async function sha256(data: Uint8Array | ArrayBuffer | string): Promise<string> {
    const input = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    const hash = await crypto.subtle.digest('SHA-256', input as ArrayBuffer);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function getSignatureKey(key: string, dateStamp: string, region: string, service: string): Promise<ArrayBuffer> {
    const kDate = await hmacSha256(new TextEncoder().encode(`AWS4${key}`), dateStamp);
    const kRegion = await hmacSha256(kDate, region);
    const kService = await hmacSha256(kRegion, service);
    return hmacSha256(kService, 'aws4_request');
}

function toHex(buffer: ArrayBuffer): string {
    return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function encodeKey(key: string): string {
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

    const canonicalRequestHash = await sha256(canonicalRequest);
    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${canonicalRequestHash}`;

    const signingKey = await getSignatureKey(config.secretAccessKey, dateStamp, region, service);
    const signature = toHex(await hmacSha256(signingKey, stringToSign));

    return `${endpoint}?${sortedQuery}&X-Amz-Signature=${signature}`;
}

export async function handleUploadRequest(method: string | undefined, body: UploadRequestBody | undefined, config: UploadConfig): Promise<UploadResponse> {
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

        if (!fileName || !bucket) {
            return { status: 400, payload: { error: 'Missing fileName or bucket' } };
        }

        const presignedUrl = await generatePresignedUrl(config as Required<UploadConfig>, bucket, fileName, contentType);
        const base = config.publicUrlBase.endsWith('/') ? config.publicUrlBase.slice(0, -1) : config.publicUrlBase;
        const publicUrl = `${base}/${encodeKey(fileName)}`;

        return { status: 200, payload: { presignedUrl, publicUrl } };
    } catch (error: any) {
        return { status: 500, payload: { error: error?.message || 'Failed to generate presigned URL' } };
    }
}