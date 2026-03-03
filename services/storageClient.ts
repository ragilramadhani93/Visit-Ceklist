const accountId = (import.meta as any).env?.VITE_R2_ACCOUNT_ID as string | undefined;
const accessKeyId = (import.meta as any).env?.VITE_R2_ACCESS_KEY_ID as string | undefined;
const secretAccessKey = (import.meta as any).env?.VITE_R2_SECRET_ACCESS_KEY as string | undefined;
const publicUrlBase = (import.meta as any).env?.VITE_R2_PUBLIC_URL as string | undefined;
const bucketName = (import.meta as any).env?.VITE_R2_BUCKET_NAME as string | undefined;

// Note: R2 uploads are now handled server-side via /api/upload endpoint to bypass CORS issues

// Normalize old R2 public URL to new URL (migrates DB-stored URLs automatically)
const OLD_R2_BASE = 'https://pub-bc5cd7b3f4094a7aa7797b4a64ad9295.r2.dev';
const NEW_R2_BASE = 'https://pub-9d01db2ebda64069a7e7fd1f530e753e.r2.dev';

export function normalizeR2Url(url: string): string {
    if (url.startsWith(OLD_R2_BASE)) {
        return NEW_R2_BASE + url.slice(OLD_R2_BASE.length);
    }
    return url;
}

// Efficient base64 encoding that handles large files without call stack overflow
function bufferToBase64(buffer: Uint8Array): string {
    const CHUNK_SIZE = 4096; // Small chunks to avoid apply() overflow
    let result = '';
    
    for (let i = 0; i < buffer.length; i += CHUNK_SIZE) {
        const chunk = buffer.subarray(i, Math.min(i + CHUNK_SIZE, buffer.length));
        // Use a loop instead of apply() to avoid call stack overflow
        for (let j = 0; j < chunk.length; j++) {
            result += String.fromCharCode(chunk[j]);
        }
    }
    
    return btoa(result);
}

export const uploadPublic = async (_bucket: string, file: Blob | File, fileName: string): Promise<string> => {
    try {
        console.log(`[Storage] Starting upload: ${fileName} (${file.size} bytes)`);

        // Use explicit bucket param if provided, otherwise fall back to VITE_R2_BUCKET_NAME
        const bucket = _bucket || bucketName;
        if (!bucket) {
            throw new Error('No R2 bucket specified. Provide a bucket param or set VITE_R2_BUCKET_NAME in env.');
        }

        if (!publicUrlBase) {
            console.warn('[Storage] VITE_R2_PUBLIC_URL is not set; uploaded file URL may be incorrect.');
        }

        console.log(`[Storage] Using bucket: ${bucket}, publicUrlBase: ${publicUrlBase || 'undefined'}`);

        // Convert file to base64 for transmission - uses safe loop encoding for large files
        const arrayBuffer = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        
        console.log(`[Storage] Converting to base64... (${bytes.length} bytes)`);
        const bodyBase64 = bufferToBase64(bytes);
        
        console.log(`[Storage] Base64 encoded (${bodyBase64.length} bytes). Uploading...`);

        // Upload via Vercel API route (server-side) to avoid CORS issues
        const uploadResponse = await fetch('/api/upload', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                fileName,
                bucket,
                contentType: file.type || 'application/octet-stream',
                bodyBase64,
            }),
        });

        if (!uploadResponse.ok) {
            const errorData = await uploadResponse.json().catch(() => ({}));
            throw new Error(errorData.error || `Upload failed (HTTP ${uploadResponse.status})`);
        }

        const result = await uploadResponse.json();
        console.log('[Storage] Upload successful, URL:', result.url);
        return result.url;
    } catch (error: any) {
        console.error('[Storage] Upload error:', error);
        throw new Error(`Photo upload failed: ${error?.message || String(error)}`);
    }
};
