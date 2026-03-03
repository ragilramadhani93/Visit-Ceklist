// services/whatsappClient.ts

export interface WhatsAppMessageOptions {
  targets: string[]; // Array of phone numbers
  message: string;
  fileUrl?: string; // Optional URL to a file (e.g. PDF report)
}

export const sendWhatsAppMessage = async ({ targets, message, fileUrl }: WhatsAppMessageOptions): Promise<boolean> => {
  const token = (import.meta as any).env?.VITE_FONNTE_TOKEN;
  
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

    if (responseData.status) {
      console.log('[WhatsApp Client] Message sent successfully:', responseData);
      return true;
    } else {
      console.error('[WhatsApp Client] Fonnte API Error:', responseData.reason || responseData);
      return false;
    }
  } catch (error) {
    console.error('[WhatsApp Client] Network Error while sending WhatsApp message:', error);
    return false;
  }
};
