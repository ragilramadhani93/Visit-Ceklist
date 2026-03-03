const accountId = (import.meta as any).env?.VITE_R2_ACCOUNT_ID as string | undefined;
const accessKeyId = (import.meta as any).env?.VITE_R2_ACCESS_KEY_ID as string | undefined;
const secretAccessKey = (import.meta as any).env?.VITE_R2_SECRET_ACCESS_KEY as string | undefined;
const publicUrlBase = (import.meta as any).env?.VITE_R2_PUBLIC_URL as string | undefined;
const bucketName = (import.meta as any).env?.VITE_R2_BUCKET_NAME as string | undefined;

// Note: R2 uploads are now handled server-side via /api/upload endpoint to bypass CORS issues

export const uploadPublic = async (_bucket: string, file: Blob | File, fileName: string): Promise<string> => {
    try {
        // Convert file to base64 for transmission
        const arrayBuffer = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        const binaryString = String.fromCharCode.apply(null, Array.from(bytes));
        const bodyBase64 = btoa(binaryString);

        // Upload via Vercel API route (server-side) to avoid CORS issues
        const uploadResponse = await fetch('/api/upload', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                fileName,
                contentType: file.type || 'application/octet-stream',
                bodyBase64,
            }),
        });

        if (!uploadResponse.ok) {
            const errorData = await uploadResponse.json();
            throw new Error(errorData.error || `Upload failed (HTTP ${uploadResponse.status})`);
        }

        const result = await uploadResponse.json();
        return result.url;
    } catch (error: any) {
        throw new Error(`Photo upload failed: ${error?.message || String(error)}`);
    }
};
