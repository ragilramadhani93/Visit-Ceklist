const accountId = (import.meta as any).env?.VITE_R2_ACCOUNT_ID as string | undefined;
const accessKeyId = (import.meta as any).env?.VITE_R2_ACCESS_KEY_ID as string | undefined;
const secretAccessKey = (import.meta as any).env?.VITE_R2_SECRET_ACCESS_KEY as string | undefined;
const publicUrlBase = (import.meta as any).env?.VITE_R2_PUBLIC_URL as string | undefined;
const bucketName = (import.meta as any).env?.VITE_R2_BUCKET_NAME as string | undefined;

// Note: R2 uploads are now handled server-side via /api/upload endpoint to bypass CORS issues

// Normalize old R2 public URL to new URL (migrates DB-stored URLs automatically)
const OLD_R2_BASE = 'https://pub-bc5cd7b3f4094a7aa7797b4a64ad9295.r2.dev';
const NEW_R2_BASE = 'https://pub-9d01db2ebda64069a7e7fd1f530e753e.r2.dev';
const FALLBACK_UPLOAD_LIMIT_BYTES = 4.2 * 1024 * 1024; // Vercel 4.5MB limit minus headers
const IMAGE_FALLBACK_TARGET_BYTES = 3.8 * 1024 * 1024; // Keep headroom for request overhead

const canvasToBlob = (canvas: HTMLCanvasElement, mimeType: string, quality?: number): Promise<Blob | null> => {
    return new Promise(resolve => {
        canvas.toBlob(resolve, mimeType, quality);
    });
};

const compressImageForUpload = async (file: Blob | File): Promise<Blob | File> => {
    const isImage = (file.type || '').startsWith('image/');
    if (!isImage || file.size <= IMAGE_FALLBACK_TARGET_BYTES) {
        return file;
    }

    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    const loaded = await new Promise<boolean>((resolve) => {
        image.onload = () => resolve(true);
        image.onerror = () => resolve(false);
        image.src = objectUrl;
    });

    if (!loaded) {
        URL.revokeObjectURL(objectUrl);
        return file;
    }

    const scales = [1, 0.85, 0.7, 0.55, 0.45];
    const qualities = [0.82, 0.72, 0.64, 0.56, 0.5];
    let smallestBlob: Blob | null = null;

    for (const scale of scales) {
        const targetWidth = Math.max(1, Math.round(image.width * scale));
        const targetHeight = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            continue;
        }

        ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

        for (const quality of qualities) {
            const compressedBlob = await canvasToBlob(canvas, 'image/jpeg', quality);
            if (!compressedBlob) {
                continue;
            }

            if (!smallestBlob || compressedBlob.size < smallestBlob.size) {
                smallestBlob = compressedBlob;
            }

            if (compressedBlob.size <= IMAGE_FALLBACK_TARGET_BYTES) {
                URL.revokeObjectURL(objectUrl);
                return compressedBlob;
            }
        }
    }

    URL.revokeObjectURL(objectUrl);
    return smallestBlob || file;
};

export function normalizeR2Url(url: string): string {
    if (url.startsWith(OLD_R2_BASE)) {
        return NEW_R2_BASE + url.slice(OLD_R2_BASE.length);
    }
    return url;
}

const uploadViaServerFallback = async (bucket: string, file: Blob | File, fileName: string, contentType: string): Promise<string> => {
    const uploadCandidate = await compressImageForUpload(file);
    const effectiveContentType = uploadCandidate.type || contentType;

    if (uploadCandidate.size > FALLBACK_UPLOAD_LIMIT_BYTES) {
        throw new Error(`File size (${Math.round(uploadCandidate.size / (1024 * 1024))} MB) exceeds maximum upload size (4 MB). Please compress the file or use a smaller file.`);
    }

    console.warn(`[Storage] Falling back to server-side upload for ${fileName} (${uploadCandidate.size} bytes)`);

    // Use raw binary upload (no base64 overhead) to maximise file size support
    const params = new URLSearchParams({ fileName, bucket, contentType: effectiveContentType });
    const fallbackResponse = await fetch(`/api/upload?${params.toString()}`, {
        method: 'PUT',
        headers: { 'Content-Type': effectiveContentType },
        body: uploadCandidate,
    }).catch(err => {
        console.error('[Storage] Network error on fallback upload request:', err);
        throw new Error(`Network error on fallback upload: ${err?.message || err}`);
    });

    if (!fallbackResponse.ok) {
        const errorText = await fallbackResponse.text();
        console.error('[Storage] Fallback upload failed:', { status: fallbackResponse.status, error: errorText });
        throw new Error(errorText || `Fallback upload failed (HTTP ${fallbackResponse.status})`);
    }

    const { publicUrl } = await fallbackResponse.json();
    if (!publicUrl) {
        throw new Error('Fallback upload did not return a public URL');
    }

    console.log('[Storage] Fallback upload successful, URL:', publicUrl);
    return publicUrl;
};

export const uploadPublic = async (_bucket: string, file: Blob | File, fileName: string): Promise<string> => {
    try {
        const preparedFile = await compressImageForUpload(file);
        const uploadWasCompressed = preparedFile !== file;
        if (uploadWasCompressed) {
            console.log(`[Storage] Image compressed before upload: ${file.size} -> ${preparedFile.size} bytes`);
        }

        console.log(`[Storage] Starting upload: ${fileName} (${preparedFile.size} bytes)`);

        const bucket = _bucket || bucketName;
        if (!bucket) {
            throw new Error('No R2 bucket specified. Provide a bucket param or set VITE_R2_BUCKET_NAME in env.');
        }

        if (!publicUrlBase) {
            console.warn('[Storage] VITE_R2_PUBLIC_URL is not set; uploaded file URL may be incorrect.');
        }

        const contentType = preparedFile.type || file.type || 'application/octet-stream';

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
        console.log(`[Storage] Uploading ${preparedFile.size} bytes directly to R2...`);
        
        const uploadResponse = await fetch(presignedUrl, {
            method: 'PUT',
            headers: { 
                'Content-Type': contentType,
            },
            body: preparedFile,
            mode: 'cors',
        }).catch(err => {
            console.error('[Storage] Network error on R2 upload:', err);
            console.error('[Storage] This is likely a CORS issue or network connectivity problem.');
            return null;
        });

        if (!uploadResponse) {
            return await uploadViaServerFallback(bucket, preparedFile, fileName, contentType);
        }

        if (!uploadResponse.ok) {
            const errText = await uploadResponse.text();
            console.error('[Storage] R2 upload failed:', { status: uploadResponse.status, error: errText });
            throw new Error(`Direct R2 upload failed (HTTP ${uploadResponse.status}): ${errText}`);
        }

        console.log('[Storage] Upload successful, URL:', publicUrl);
        return publicUrl;
    } catch (error: any) {
        console.error('[Storage] Upload error:', error);
        throw new Error(`Upload failed for ${fileName} (${Math.round(file.size / 1024)} KB): ${error?.message || String(error)}`);
    }
};
