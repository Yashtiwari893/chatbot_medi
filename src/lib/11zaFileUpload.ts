/**
 * 11za File Upload & Storage Manager
 * Handles uploading PDFs to 11za and managing file IDs
 */

const ELEVENZA_API_BASE = "https://api.11za.in/apis";

export type ElevenZaUploadResult = {
    success: boolean;
    fileId?: string;
    fileName?: string;
    fileUrl?: string;
    error?: string;
    response?: unknown;
};

/**
 * Download PDF from Google Drive
 */
export async function downloadFromGoogleDrive(driveLink: string): Promise<Buffer | null> {
    try {
        // Extract Drive file ID from various Drive link formats
        const fileIdMatch = driveLink.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (!fileIdMatch) {
            console.error("Invalid Google Drive link format:", driveLink);
            return null;
        }

        const fileId = fileIdMatch[1];
        // Direct download URL for Google Drive
        const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;

        // Use AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        try {
            const response = await fetch(downloadUrl, {
                redirect: "follow",
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                console.error(`Failed to download from Drive: ${response.status} ${response.statusText}`);
                return null;
            }

            const buffer = await response.arrayBuffer();
            return Buffer.from(buffer);
        } finally {
            clearTimeout(timeoutId);
        }
    } catch (error) {
        console.error("Error downloading from Google Drive:", error);
        return null;
    }
}

/**
 * Upload PDF file to 11za and get file ID
 * 
 * @param fileBuffer - The PDF file as a Buffer
 * @param fileName - Name for the file
 * @param authToken - 11za API auth token
 * @param originWebsite - Origin website for 11za API
 * @returns File ID and metadata from 11za
 */
export async function uploadPdfTo11za(
    fileBuffer: Buffer,
    fileName: string,
    authToken: string,
    originWebsite: string
): Promise<ElevenZaUploadResult> {
    try {
        if (!authToken || !originWebsite) {
            return {
                success: false,
                error: "11za auth token and origin website are required",
            };
        }

        // Create FormData for file upload
        const formData = new FormData();
        formData.append("authToken", authToken);
        formData.append("originWebsite", originWebsite.trim());
        
        // Convert Buffer to Uint8Array for Blob compatibility
        const uint8Array = new Uint8Array(fileBuffer);
        const blob = new Blob([uint8Array], { type: "application/pdf" });
        formData.append("file", blob, fileName);

        console.log(`📤 Uploading ${fileName} to 11za...`);

        // Try file upload endpoint (common pattern for WhatsApp APIs)
        const response = await fetch(`${ELEVENZA_API_BASE}/file/uploadFile`, {
            method: "POST",
            headers: {
                "Accept": "application/json",
            },
            body: formData,
        });

        const responseData = await response.json();

        if (!response.ok) {
            console.error("11za upload error:", responseData);
            return {
                success: false,
                error: `11za API returned ${response.status}`,
                response: responseData,
            };
        }

        // Extract file ID from response (varies by 11za API version)
        // Common response patterns:
        // { file_id: "...", fileId: "...", id: "...", success: true, data: { file_id: "..." } }
        const fileId =
            responseData.file_id ||
            responseData.fileId ||
            responseData.id ||
            responseData.data?.file_id ||
            responseData.data?.fileId ||
            null;

        if (!fileId) {
            console.error("No file ID returned from 11za:", responseData);
            return {
                success: false,
                error: "11za did not return a file ID",
                response: responseData,
            };
        }

        console.log(`✅ File uploaded to 11za with ID: ${fileId}`);

        return {
            success: true,
            fileId: fileId as string,
            fileName: fileName,
            response: responseData,
        };
    } catch (error) {
        console.error("Error uploading to 11za:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

/**
 * Process a Google Drive link:
 * 1. Download PDF from Drive
 * 2. Upload to 11za
 * 3. Return 11za file ID
 */
export async function processDriveLinkTo11za(
    driveLink: string,
    fileName: string,
    authToken: string,
    originWebsite: string
): Promise<ElevenZaUploadResult> {
    try {
        // Step 1: Download from Drive
        console.log(`⬇️  Downloading PDF from Drive: ${driveLink}`);
        const pdfBuffer = await downloadFromGoogleDrive(driveLink);

        if (!pdfBuffer) {
            return {
                success: false,
                error: "Failed to download PDF from Google Drive",
            };
        }

        console.log(`✅ Downloaded PDF (${pdfBuffer.length} bytes)`);

        // Step 2: Upload to 11za
        const uploadResult = await uploadPdfTo11za(
            pdfBuffer,
            fileName,
            authToken,
            originWebsite
        );

        return uploadResult;
    } catch (error) {
        console.error("Error processing Drive link to 11za:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

/**
 * Extract Google Drive file links from text
 */
export function extractGoogleDriveLinks(text: string): string[] {
    // Match common Google Drive file and folder patterns
    const regex =
        /https:\/\/drive\.google\.com\/(?:file\/d\/|drive\/folders\/|open\?id=)([A-Za-z0-9_-]+)[^\s]*/gi;
    return text.match(regex) || [];
}
