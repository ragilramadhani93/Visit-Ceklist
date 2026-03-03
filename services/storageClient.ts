const accountId = (import.meta as any).env?.VITE_R2_ACCOUNT_ID as string | undefined;
const accessKeyId = (import.meta as any).env?.VITE_R2_ACCESS_KEY_ID as string | undefined;
const secretAccessKey = (import.meta as any).env?.VITE_R2_SECRET_ACCESS_KEY as string | undefined;
const publicUrlBase = (import.meta as any).env?.VITE_R2_PUBLIC_URL as string | undefined;
const bucketName = (import.meta as any).env?.VITE_R2_BUCKET_NAME as string | undefined;

// Note: R2 uploads are now handled server-side via /api/upload endpoint to bypass CORS issues

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

        // Convert file to base64 for transmission - uses chunked encoding for large files
        const arrayBuffer = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        const bodyBase64 = bufferToBase64(bytes);

        // Upload via Vercel API route (server-side) to avoid CORS issues
        const uploadResponse = await fetch('/api/upload', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                fileName,
                bucket: _bucket,
                contentType: file.type || 'application/octet-stream',
                bodyBase64,
            }),
        });

        if (!uploadResponse.ok) {
            const errorData = await uploadResponse.json();
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
