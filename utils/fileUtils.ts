
export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        // remove the data:image/...;base64, part
        resolve(reader.result.split(',')[1]);
      } else {
        reject(new Error("FileReader result is not a string"));
      }
    };
    reader.readAsDataURL(blob);
  });
};

export const base64ToBlob = (base64: string, contentType: string = 'image/jpeg'): Blob => {
    // Check for "skipped_too_large" placeholder or empty string
    if (!base64 || base64 === 'skipped_too_large') {
        console.warn("base64ToBlob: Encountered empty or skipped data. Returning placeholder.");
        // Return a 1x1 transparent GIF as placeholder to prevent crash
        const placeholder = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        return base64ToBlob(placeholder, 'image/gif');
    }

    // Clean up base64 string: remove data URL prefix if present, and remove whitespaces
    let cleanBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
    cleanBase64 = cleanBase64.replace(/\s/g, '');

    // Handle URL encoding if present
    if (cleanBase64.includes('%')) {
        try {
            cleanBase64 = decodeURIComponent(cleanBase64);
        } catch (e) {
            console.warn("base64ToBlob: Failed to decode URI component", e);
        }
    }

    // Fix padding
    const padding = cleanBase64.length % 4;
    if (padding > 0) {
        cleanBase64 += '='.repeat(4 - padding);
    }

    try {
        const byteCharacters = atob(cleanBase64);
        const byteArrays = [];
        for (let offset = 0; offset < byteCharacters.length; offset += 512) {
            const slice = byteCharacters.slice(offset, offset + 512);
            const byteNumbers = new Array(slice.length);
            for (let i = 0; i < slice.length; i++) {
                byteNumbers[i] = slice.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            byteArrays.push(byteArray);
        }
        return new Blob(byteArrays, { type: contentType });
    } catch (error) {
        console.error("base64ToBlob failed:", error);
        // Fallback to placeholder if decoding fails completely
        const placeholder = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        const byteCharacters = atob(placeholder);
        const byteArrays = [];
        for (let offset = 0; offset < byteCharacters.length; offset += 512) {
            const slice = byteCharacters.slice(offset, offset + 512);
            const byteNumbers = new Array(slice.length);
            for (let i = 0; i < slice.length; i++) {
                byteNumbers[i] = slice.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            byteArrays.push(byteArray);
        }
        return new Blob(byteArrays, { type: 'image/gif' });
    }
};

export const resizeImage = (file: Blob, maxWidth = 1280, maxHeight = 1280, quality = 0.8): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
      const targetWidth = Math.round(width * ratio);
      const targetHeight = Math.round(height * ratio);
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url);
        if (blob) resolve(blob);
        else resolve(file);
      }, 'image/jpeg', quality);
    };
    img.onerror = (_e) => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
};
