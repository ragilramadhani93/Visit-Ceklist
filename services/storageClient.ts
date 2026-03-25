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

        const contentType = file.type || 'application/octet-stream';

        // Step 1: Get presigned URL from server (tiny JSON request, no file data)
        console.log(`[Storage] Requesting presigned URL for ${bucket}/${fileName}...`);
        console.log(`[Storage] POST /api/upload (request body: fileName="${fileName}", bucket="${bucket}", contentType="${contentType}")`);
        
        const presignResponse = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileName, bucket, contentType }),
        }).catch(err => {
            console.error('[Storage] Network error on presign request:', err);
            throw new Error(`Network error requesting presigned URL: ${err?.message || err}`);
        });

        if (!presignResponse.ok) {
            let errorMessage = `Failed to get presigned URL (HTTP ${presignResponse.status})`;
            try {
                const text = await presignResponse.text();
                console.error('[Storage] Presign response error body:', text);
                try {
                    const errorData = JSON.parse(text);
                    errorMessage = errorData.error || errorMessage;
                } catch (e) {
                    // Response was not JSON, use the text as is
                    errorMessage = text || errorMessage;
                }
            } catch (e) {
                console.error('[Storage] Could not read presign error response:', e);
            }
            console.error('[Storage] Presign HTTP error:', { status: presignResponse.status, message: errorMessage });
            throw new Error(errorMessage);
        }

        const { presignedUrl, publicUrl } = await presignResponse.json();
        console.log('[Storage] Got presigned URL, uploading to R2...');
        console.log(`[Storage] Presigned URL: ${presignedUrl}`);
        console.log(`[Storage] Presigned URL host: ${new URL(presignedUrl).hostname}`);
        console.log(`[Storage] Presigned URL protocol: ${new URL(presignedUrl).protocol}`);

        // Step 2: Upload file DIRECTLY to R2 (bypasses Vercel completely - no size limit)
        console.log(`[Storage] Uploading ${file.size} bytes directly to R2...`);
        
        const uploadResponse = await fetch(presignedUrl, {
            method: 'PUT',
            headers: { 
                'Content-Type': contentType,
            },
            body: file,
            mode: 'cors',
        }).catch(err => {
            console.error('[Storage] Network error on R2 upload:', err);
            console.error('[Storage] This is likely a CORS issue or network connectivity problem.');
            console.error('[Storage] If using HTTP, try HTTPS tunnel or deploy to production HTTPS.');
            throw new Error(`Network error uploading to R2: ${err?.message || err}`);
        });

        if (!uploadResponse.ok) {
            const errText = await uploadResponse.text();
            console.error('[Storage] R2 upload failed:', { status: uploadResponse.status, error: errText });
            throw new Error(`Direct R2 upload failed (HTTP ${uploadResponse.status}): ${errText}`);
        }

        console.log('[Storage] Upload successful, URL:', publicUrl);
        return publicUrl;
    } catch (error: any) {
        console.error('[Storage] Upload error:', error);
        throw new Error(`Photo upload failed: ${error?.message || String(error)}`);
    }
};
