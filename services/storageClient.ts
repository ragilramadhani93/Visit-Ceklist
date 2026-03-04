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

export const uploadPublic = async (_bucket: string, file: Blob | File, fileName: string): Promise<string> => {
    try {
        console.log(`[Storage] Starting upload: ${fileName} (${file.size} bytes)`);

        const bucket = _bucket || bucketName;
        if (!bucket) {
            throw new Error('No R2 bucket specified. Provide a bucket param or set VITE_R2_BUCKET_NAME in env.');
        }

        if (!publicUrlBase) {
            console.warn('[Storage] VITE_R2_PUBLIC_URL is not set; uploaded file URL may be incorrect.');
        }

        console.log(`[Storage] Using bucket: ${bucket}, publicUrlBase: ${publicUrlBase || 'undefined'}`);

        // Send file as raw binary (no base64 encoding) - avoids 33% overhead and Vercel 4.5MB JSON limit
        const contentType = file.type || 'application/octet-stream';
        const params = new URLSearchParams({ fileName, bucket, contentType });

        console.log(`[Storage] Uploading binary (${file.size} bytes)...`);

        const uploadResponse = await fetch(`/api/upload?${params.toString()}`, {
            method: 'POST',
            headers: {
                'Content-Type': contentType,
            },
            body: file,
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
