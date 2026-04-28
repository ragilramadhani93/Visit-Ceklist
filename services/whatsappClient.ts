// services/whatsappClient.ts

export interface WhatsAppMessageOptions {
  targets: string[]; // Array of phone numbers
  message: string;
  fileUrl?: string; // Optional URL to a file (e.g. PDF report)
  token?: string; // Optional Fonnte token
}

export const sendWhatsAppMessage = async ({ targets, message, fileUrl, token: providedToken }: WhatsAppMessageOptions): Promise<boolean> => {
  const token = providedToken || (import.meta as any).env?.VITE_FONNTE_TOKEN;
  
  if (!token) {
    console.error('[WhatsApp Client] Fonnte token is missing from environment variables.');
    return false;
  }

  // Fonnte accepts targets comma-separated
  const targetString = targets.join(',');

  try {
    const formData = new FormData();
    formData.append('target', targetString);
    formData.append('message', message);
    if (fileUrl) {
      formData.append('url', fileUrl);
      // Fonnte recommends appending a filename for better display
      formData.append('filename', 'Audit_Report.pdf');
    }

    // Fonnte typing indicator delay (optional, makes it look more natural)
    // formData.append('delay', '2');

    const response = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        Authorization: token,
      },
      body: formData,
    });

    const responseData = await response.json();
    
    // Some Fonnte API responses use 'status' as a boolean, others as a string
    const isSuccess = responseData.status === true || responseData.status === 'true';

    if (isSuccess) {
      console.log('[WhatsApp Client] Message sent successfully:', responseData);
      return true;
    } else {
      const errorMsg = responseData.reason || responseData.message || JSON.stringify(responseData);
      console.error('[WhatsApp Client] Fonnte API Error:', errorMsg);
      throw new Error(errorMsg);
    }
  } catch (error: any) {
    console.error('[WhatsApp Client] Error:', error.message || error);
    throw error;
  }
};
