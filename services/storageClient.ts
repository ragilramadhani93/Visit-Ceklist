const accountId = (import.meta as any).env?.VITE_R2_ACCOUNT_ID as string | undefined;
const accessKeyId = (import.meta as any).env?.VITE_R2_ACCESS_KEY_ID as string | undefined;
const secretAccessKey = (import.meta as any).env?.VITE_R2_SECRET_ACCESS_KEY as string | undefined;
const publicUrlBase = (import.meta as any).env?.VITE_R2_PUBLIC_URL as string | undefined;
const bucketName = (import.meta as any).env?.VITE_R2_BUCKET_NAME as string | undefined;

const isConfigured = !!accountId && !!accessKeyId && !!secretAccessKey;

if (!isConfigured) {
    const missing = [];
    if (!accountId) missing.push('VITE_R2_ACCOUNT_ID');
    if (!accessKeyId) missing.push('VITE_R2_ACCESS_KEY_ID');
    if (!secretAccessKey) missing.push('VITE_R2_SECRET_ACCESS_KEY');
    console.error(`Cloudflare R2 configuration incomplete. Missing: ${missing.join(', ')}`);
}

// --- Lightweight S3-compatible signing for Cloudflare R2 ---
// Uses native Web Crypto API (no AWS SDK needed)

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
    let kDate = await hmacSha256(new TextEncoder().encode('AWS4' + key).buffer as ArrayBuffer, dateStamp);
    let kRegion = await hmacSha256(kDate, region);
    let kService = await hmacSha256(kRegion, service);
    let kSigning = await hmacSha256(kService, 'aws4_request');
    return kSigning;
}

function toHex(buffer: ArrayBuffer): string {
    return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function signRequest(method: string, url: string, headers: Record<string, string>, body: Uint8Array): Promise<Record<string, string>> {
    const parsedUrl = new URL(url);
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.substring(0, 8);
    const region = 'auto';
    const service = 's3';

    const payloadHash = await sha256(body);

    headers['x-amz-date'] = amzDate;
    headers['x-amz-content-sha256'] = payloadHash;
    headers['host'] = parsedUrl.host;

    const sortedHeaderKeys = Object.keys(headers).sort();
    const canonicalHeaders = sortedHeaderKeys.map(k => `${k.toLowerCase()}:${headers[k]}\n`).join('');
    const signedHeaders = sortedHeaderKeys.map(k => k.toLowerCase()).join(';');

    const canonicalRequest = [
        method,
        parsedUrl.pathname,
        parsedUrl.search ? parsedUrl.search.substring(1) : '',
        canonicalHeaders,
        signedHeaders,
        payloadHash
    ].join('\n');

    const canonicalRequestHash = await sha256(canonicalRequest);
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${canonicalRequestHash}`;

    const signingKey = await getSignatureKey(secretAccessKey!, dateStamp, region, service);
    const signature = toHex(await hmacSha256(signingKey, stringToSign));

    headers['Authorization'] = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return headers;
}

export const uploadPublic = async (_bucket: string, file: Blob | File, fileName: string): Promise<string> => {
    if (!isConfigured) {
        const missing = [];
        if (!accountId) missing.push('VITE_R2_ACCOUNT_ID');
        if (!accessKeyId) missing.push('VITE_R2_ACCESS_KEY_ID');
        if (!secretAccessKey) missing.push('VITE_R2_SECRET_ACCESS_KEY');
        throw new Error(`Photo upload failed: Cloudflare R2 not configured. Missing: ${missing.join(', ')}`);
    }

    if (!publicUrlBase) {
        throw new Error('Photo upload failed: Public URL base (VITE_R2_PUBLIC_URL) is not configured');
    }

    const bucket = bucketName || _bucket;
    const endpoint = `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${fileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const body = new Uint8Array(arrayBuffer);
    const contentType = file.type || 'application/octet-stream';

    const headers: Record<string, string> = {
        'content-type': contentType,
    };

    try {
        const signedHeaders = await signRequest('PUT', endpoint, headers, body);

        const response = await fetch(endpoint, {
            method: 'PUT',
            headers: signedHeaders,
            body: body,
            mode: 'cors',
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const base = publicUrlBase.endsWith('/') ? publicUrlBase.slice(0, -1) : publicUrlBase;
        return `${base}/${fileName}`;
    } catch (error: any) {
        // Diagnose the error
        if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
            // CORS or network error
            throw new Error(`Photo upload blocked - likely CORS issue with R2. Check that R2 bucket CORS is configured to allow cross-origin requests from ${window.location.origin}`);
        }
        throw new Error(`Photo upload error: ${error?.message || String(error)}`);
    }
};
