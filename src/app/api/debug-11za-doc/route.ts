/**
 * Debug endpoint for testing 11za document sending
 * Usage: POST /api/debug-11za-doc
 * 
 * Payload: {
 *   phone: "919596946803",
 *   driveLink: "https://drive.google.com/file/d/1-qsADUMekRfoDFbCibrA2d5QmO0WSkrq/view"
 * }
 */

const WHATSAPP_API_URL = "https://api.11za.in/apis/sendMessage/sendMessages";

function convertGoogleDriveToDirectDownload(link: string): string {
    const match = link.match(/\/d\/(.*?)\//);
    if (!match) return link;
    return `https://drive.google.com/uc?export=download&id=${match[1]}`;
}

async function tryDocumentSending(phoneNumber: string, downloadUrl: string, authToken: string, originWebsite: string) {
    const attempts = [
        {
            name: "Method 1: contentType='document' + myfile",
            payload: {
                sendto: phoneNumber,
                authToken: authToken,
                originWebsite: originWebsite.trim(),
                contentType: "document",
                myfile: downloadUrl,
            }
        },
        {
            name: "Method 2: contentType='document' + file",
            payload: {
                sendto: phoneNumber,
                authToken: authToken,
                originWebsite: originWebsite.trim(),
                contentType: "document",
                file: downloadUrl,
            }
        },
        {
            name: "Method 3: contentType='document' + document",
            payload: {
                sendto: phoneNumber,
                authToken: authToken,
                originWebsite: originWebsite.trim(),
                contentType: "document",
                document: downloadUrl,
            }
        },
        {
            name: "Method 4: contentType='media' + myfile",
            payload: {
                sendto: phoneNumber,
                authToken: authToken,
                originWebsite: originWebsite.trim(),
                contentType: "media",
                myfile: downloadUrl,
            }
        },
        {
            name: "Method 5: contentType='file' + myfile",
            payload: {
                sendto: phoneNumber,
                authToken: authToken,
                originWebsite: originWebsite.trim(),
                contentType: "file",
                myfile: downloadUrl,
            }
        },
        {
            name: "Method 6: contentType='document' + myfile + caption",
            payload: {
                sendto: phoneNumber,
                authToken: authToken,
                originWebsite: originWebsite.trim(),
                contentType: "document",
                myfile: downloadUrl,
                caption: "Study Material",
            }
        },
    ];

    const results: unknown[] = [];

    for (const attempt of attempts) {
        console.log(`\n🧪 Testing: ${attempt.name}`);
        console.log(`   Payload keys: ${Object.keys(attempt.payload).join(", ")}`);

        try {
            const response = await fetch(WHATSAPP_API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(attempt.payload),
            });

            const data = await response.json();

            results.push({
                method: attempt.name,
                httpStatus: response.status,
                success: response.ok && data.status !== "error" && data.status !== 0,
                response: data,
            });

            console.log(`   Status: ${response.status}`);
            console.log(`   Response:`, JSON.stringify(data).substring(0, 200));
        } catch (error) {
            results.push({
                method: attempt.name,
                error: error instanceof Error ? error.message : String(error),
            });
            console.log(`   ❌ Error:`, error instanceof Error ? error.message : error);
        }
    }

    return results;
}

export async function POST(request: Request) {
    try {
        const { phone, driveLink } = await request.json();

        const authToken = process.env.WHATSAPP_11ZA_AUTH_TOKEN;
        const originWebsite = process.env.WHATSAPP_11ZA_ORIGIN;

        if (!phone || !driveLink) {
            return Response.json({
                error: "Missing phone or driveLink parameter",
            }, { status: 400 });
        }

        if (!authToken || !originWebsite) {
            return Response.json({
                error: "Missing 11za credentials in environment",
            }, { status: 500 });
        }

        console.log(`\n${'='.repeat(60)}`);
        console.log("🔍 11za Document Sending Debug Test");
        console.log(`${'='.repeat(60)}`);
        console.log(`Phone: ${phone}`);
        console.log(`Drive Link: ${driveLink}`);

        const downloadUrl = convertGoogleDriveToDirectDownload(driveLink);
        console.log(`Download URL: ${downloadUrl}`);

        const results = await tryDocumentSending(phone, downloadUrl, authToken, originWebsite);

        return Response.json({
            phone,
            driveLink,
            downloadUrl,
            testResults: results,
            summary: {
                totalAttempts: results.length,
                successCount: results.filter((r: unknown) => (r as Record<string, unknown>).success).length,
                failedCount: results.filter((r: unknown) => !(r as Record<string, unknown>).success).length,
            },
        });
    } catch (error) {
        console.error("Debug endpoint error:", error);
        return Response.json({
            error: error instanceof Error ? error.message : String(error),
        }, { status: 500 });
    }
}
