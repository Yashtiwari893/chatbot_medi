
/**
 * WhatsApp Message Sender using 11za.in API
 */

const WHATSAPP_API_URL = "https://api.11za.in/apis/sendMessage/sendMessages";

export type SendMessageResult = {
    success: boolean;
    error?: string;
    response?: unknown;
};

/**
 * Format a WhatsApp message before sending PDF
 */
export function formatMaterialLinkMessage(subject: string): string {
    return `Study Material Found\n\nSubject: ${subject}\n\nMain aapko requested PDF document bhej raha hoon`;
}

/**
 * Convert Google Drive view link to direct downloadable link
 */
function convertGoogleDriveToDirectDownload(link: string): string {
    const match = link.match(/\/d\/(.*?)\//);
    if (!match) return link;
    return `https://drive.google.com/uc?export=download&id=${match[1]}`;
}

/**
 * Check if a link is a direct Google Drive file link (not a folder)
 */
export function isGoogleDriveFile(link: string): boolean {
    return link.includes('/file/d/') || link.includes('drive.google.com/uc');
}

/**
 * Send a text message via WhatsApp using 11za.in API
 */
export async function sendWhatsAppMessage(
    phoneNumber: string,
    message: string,
    authToken: string,
    originWebsite: string
): Promise<SendMessageResult> {
    try {
        if (!authToken || !originWebsite) {
            console.error("11za auth token and origin are required");
            return {
                success: false,
                error: "WhatsApp API credentials not provided",
            };
        }

        const payload = {
            sendto: phoneNumber,
            authToken: authToken,
            originWebsite: originWebsite.trim(),
            originWebsites: originWebsite.trim(),
            contentType: "text",
            text: message,
        };

        console.log(`Sending WhatsApp message to ${phoneNumber}...`);


        const response = await fetch(WHATSAPP_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("WhatsApp API error:", data);
            return {
                success: false,
                error: `WhatsApp API returned ${response.status}`,
                response: data,
            };
        }

        return {
            success: true,
            response: data,
        };
    } catch (error) {
        console.error("Error sending WhatsApp message:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

/**
 * Send a PDF document via WhatsApp using 11za.in API
 * Using direct download URL (works with 11za's myfile parameter)
 */
export async function sendWhatsAppDocument(
    phoneNumber: string,
    documentUrl: string,
    authToken: string,
    originWebsite: string
): Promise<SendMessageResult> {
    try {
        if (!authToken || !originWebsite) {
            return {
                success: false,
                error: "WhatsApp API credentials not provided",
            };
        }

        // Ensure we have a direct download URL
        const downloadUrl = convertGoogleDriveToDirectDownload(documentUrl);

        const payload = {
            sendto: phoneNumber,
            authToken: authToken,
            originWebsite: originWebsite.trim(),
            originWebsites: originWebsite.trim(),
            contentType: "document",
            myfile: downloadUrl,
        };

        console.log(`📄 Sending WhatsApp PDF document to ${phoneNumber}...`);
        console.log(`   URL: ${downloadUrl.substring(0, 80)}...`);

        const response = await fetch(WHATSAPP_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("❌ WhatsApp Document API error:", data);
            return {
                success: false,
                error: `WhatsApp API returned ${response.status}`,
                response: data,
            };
        }
        
        console.log("✅ 11za document sent successfully");
        return {
            success: true,
            response: data,
        };
    } catch (error) {
        console.error("Error sending WhatsApp document:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

/**
 * Send a PDF document directly using a Supabase storage URL
 * This is the preferred method for uploaded files
 */
export async function sendWhatsAppDocumentFromUrl(
    phoneNumber: string,
    fileUrl: string,
    authToken: string,
    originWebsite: string
): Promise<SendMessageResult> {
    try {
        if (!authToken || !originWebsite) {
            return {
                success: false,
                error: "WhatsApp API credentials not provided",
            };
        }

        // Ensure URL is accessible (add auth params if needed)
        const payload = {
            sendto: phoneNumber,
            authToken: authToken,
            originWebsite: originWebsite.trim(),
            originWebsites: originWebsite.trim(),
            contentType: "document",
            myfile: fileUrl,
        };

        console.log(`📤 Sending PDF from URL to ${phoneNumber}...`);
        console.log(`   URL: ${fileUrl.substring(0, 80)}...`);

        const response = await fetch(WHATSAPP_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("❌ 11za URL send error:", data);
            return {
                success: false,
                error: `11za API returned ${response.status}`,
                response: data,
            };
        }
        
        console.log("✅ PDF sent successfully via URL");
        return {
            success: true,
            response: data,
        };
    } catch (error) {
        console.error("Error sending document URL:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

/**
 * Send a template message via WhatsApp using 11za.in API
 */
export async function sendWhatsAppTemplate(
    phoneNumber: string,
    templateData: {
        templateId: string;
        parameters?: Record<string, string>;
    },
    authToken: string,
    originWebsite: string
): Promise<SendMessageResult> {
    try {
        if (!authToken || !originWebsite) {
            return {
                success: false,
                error: "WhatsApp API credentials not provided",
            };
        }

        const payload = {
            sendto: phoneNumber,
            authToken: authToken,
            originWebsite: originWebsite.trim(),
            originWebsites: originWebsite.trim(),
            templateId: templateData.templateId,
            parameters: templateData.parameters || {},
        };

        const response = await fetch("https://api.11za.in/apis/template/sendTemplate", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("WhatsApp Template API error:", data);
            return {
                success: false,
                error: `WhatsApp API returned ${response.status}`,
                response: data,
            };
        }

        return {
            success: true,
            response: data,
        };
    } catch (error) {
        console.error("Error sending WhatsApp template:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

