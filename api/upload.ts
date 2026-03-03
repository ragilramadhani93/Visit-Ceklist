import type { VercelRequest, VercelResponse } from '@vercel/node';

const accountId = process.env.VITE_R2_ACCOUNT_ID;
const accessKeyId = process.env.VITE_R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.VITE_R2_SECRET_ACCESS_KEY;
const publicUrlBase = process.env.VITE_R2_PUBLIC_URL;
const bucketName = process.env.VITE_R2_BUCKET_NAME || 'field-ops-photos';

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

export default async (req: VercelRequest, res: VercelResponse) => {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Validate credentials
    if (!accountId || !accessKeyId || !secretAccessKey || !publicUrlBase) {
        console.error('Missing R2 configuration:', { accountId: !!accountId, accessKeyId: !!accessKeyId, secretAccessKey: !!secretAccessKey, publicUrlBase: !!publicUrlBase });
        return res.status(500).json({ error: 'R2 configuration incomplete on server' });
    }

    try {
        const { fileName, contentType, bodyBase64 } = req.body;

        if (!fileName || !bodyBase64) {
            return res.status(400).json({ error: 'Missing fileName or file data' });
        }

        // Decode base64 to bytes
        const binaryString = atob(bodyBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        const endpoint = `https://${accountId}.r2.cloudflarestorage.com/${bucketName}/${fileName}`;

        const headers: Record<string, string> = {
            'content-type': contentType || 'application/octet-stream',
        };

        const signedHeaders = await signRequest('PUT', endpoint, headers, bytes);

        const uploadResponse = await fetch(endpoint, {
            method: 'PUT',
            headers: signedHeaders,
            body: bytes,
        });

        if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            console.error(`R2 upload failed (${uploadResponse.status}):`, errorText);
            return res.status(uploadResponse.status).json({ error: `R2 upload failed: ${errorText}` });
        }

        const base = publicUrlBase.endsWith('/') ? publicUrlBase.slice(0, -1) : publicUrlBase;
        const publicUrl = `${base}/${fileName}`;

        return res.status(200).json({ url: publicUrl });
    } catch (error: any) {
        console.error('Upload error:', error);
        return res.status(500).json({ error: error?.message || 'Upload failed' });
    }
};
