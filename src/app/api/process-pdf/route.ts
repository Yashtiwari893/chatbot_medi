import { NextResponse } from "next/server";
import { extractPdfText } from "@/lib/pdf";
import { chunkText } from "@/lib/chunk";
import { embedText } from "@/lib/embeddings";
import { supabase } from "@/lib/supabaseClient";
import { extractGoogleDriveLinks } from "@/lib/11zaFileUpload";

export const runtime = "nodejs";

export async function POST(req: Request) {
    let fileId: string | null = null;

    try {
        const form = await req.formData();
        const file = form.get("file") as File | null;
        const phoneNumbers = form.get("phone_numbers") as string | null;
        const authToken = form.get("auth_token") as string | null;
        const origin = form.get("origin") as string | null;

        if (!file) {
            return NextResponse.json({ error: "No PDF uploaded" }, { status: 400 });
        }

        if (!authToken || !origin) {
            return NextResponse.json({
                error: "11za auth_token and origin are required"
            }, { status: 400 });
        }

        const buffer = await file.arrayBuffer();
        const pdfName = file.name;

        // Parse phone numbers (comma-separated)
        const phoneNumberList = phoneNumbers
            ? phoneNumbers.split(",").map(num => num.trim()).filter(Boolean)
            : [];

        // 1) Create file record with 11za credentials
        const { data: fileRow, error: fileError } = await supabase
            .from("rag_files")
            .insert({
                name: pdfName,
                elevenza_auth_token: authToken,
                elevenza_origin: origin,
            })
            .select()
            .single();

        if (fileError) {
            throw fileError;
        }

        fileId = fileRow.id as string;

        // 1a) Upload PDF to Supabase Storage
        console.log("📤 Uploading PDF to Supabase Storage...");
        const fileExtension = pdfName.split('.').pop() || 'pdf';
        const storagePath = `pdfs/${fileId}_${Date.now()}.${fileExtension}`;
        
        // Ensure bucket exists
        const { data: buckets } = await supabase.storage.listBuckets();
        const bucketExists = buckets?.some(b => b.name === 'pdfs');
        
        if (!bucketExists) {
            console.log("📁 Creating 'pdfs' bucket in Supabase Storage...");
            try {
                await supabase.storage.createBucket('pdfs', { 
                    public: true,
                    allowedMimeTypes: ['application/pdf']
                });
                console.log("✅ Bucket created");
            } catch (bucketErr: unknown) {
                const errMsg = bucketErr instanceof Error ? bucketErr.message : String(bucketErr);
                if (!errMsg.includes('already exists')) {
                    console.warn("⚠️ Could not create bucket:", errMsg);
                }
            }
        }
        
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('pdfs')
            .upload(storagePath, new Uint8Array(buffer), {
                contentType: 'application/pdf',
                upsert: false,
            });

        let supabaseFileUrl = null;
        if (uploadError) {
            console.warn("⚠️ Could not upload to Supabase Storage:", uploadError.message);
        } else {
            console.log(`✅ File uploaded to: ${storagePath}`);
            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('pdfs')
                .getPublicUrl(storagePath);
            supabaseFileUrl = publicUrl;
            console.log(`📎 Public URL: ${supabaseFileUrl}`);
            
            // Store URL in database
            const { error: urlError } = await supabase
                .from("rag_files")
                .update({
                    supabase_storage_url: supabaseFileUrl,
                })
                .eq("id", fileId);

            if (urlError) {
                console.warn("⚠️ Could not store Supabase URL:", urlError);
            }
        }

        // 2) Extract text + chunk
        const text = await extractPdfText(buffer);
        const chunks = chunkText(text, 1500).filter((c) => c.trim().length > 0);

        if (chunks.length === 0) {
            throw new Error("No text chunks produced from PDF");
        }

        // 2a) Extract Drive links from PDF content
        console.log("🔍 Extracting Google Drive links from PDF...");
        const driveLinks = extractGoogleDriveLinks(text);
        console.log(`✅ Found ${driveLinks.length} Drive link(s) in PDF`);
        
        // Store the first Drive link as source reference
        if (driveLinks.length > 0) {
            const { error: updateError } = await supabase
                .from("rag_files")
                .update({
                    source_drive_link: driveLinks[0],
                })
                .eq("id", fileId);

            if (updateError) {
                console.warn("⚠️ Could not store Drive link reference:", updateError);
            }
        }

        // 3) Build embeddings + rows with batch processing
        const rows: {
            file_id: string;
            pdf_name: string;
            chunk: string;
            embedding: number[];
        }[] = [];

        // Process in batches of 55 to stay under rate limit (60/min with buffer)
        const BATCH_SIZE = 55;
        const BATCH_DELAY_MS = 61000; // Wait 61s between batches

        for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
            const batch = chunks.slice(i, i + BATCH_SIZE);
            const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
            const totalBatches = Math.ceil(chunks.length / BATCH_SIZE);

            console.log(`Processing batch ${batchNumber}/${totalBatches} (${batch.length} chunks)...`);

            // Process batch in parallel
            const embeddings = await Promise.all(
                batch.map((chunk) => embedText(chunk))
            );

            // Validate and add to rows
            for (let j = 0; j < batch.length; j++) {
                const embedding = embeddings[j];
                if (!embedding || !Array.isArray(embedding)) {
                    throw new Error(`Failed to generate embedding for chunk ${i + j + 1}`);
                }

                rows.push({
                    file_id: fileId,
                    pdf_name: pdfName,
                    chunk: batch[j],
                    embedding,
                });
            }

            // Wait before next batch (except for the last batch)
            if (i + BATCH_SIZE < chunks.length) {
                console.log(`Waiting ${BATCH_DELAY_MS / 1000}s before next batch to avoid rate limits...`);
                await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
            }
        }

        // 4) Insert all chunks in one go
        const { error: insertError } = await supabase
            .from("rag_chunks")
            .insert(rows);

        if (insertError) {
            throw insertError;
        }

        // 5) Map phone numbers to this document
        if (phoneNumberList.length > 0) {
            const mappingRows = phoneNumberList.map(phoneNumber => ({
                phone_number: phoneNumber,
                file_id: fileId,
            }));

            const { error: mappingError } = await supabase
                .from("phone_document_mapping")
                .insert(mappingRows);

            if (mappingError) {
                console.error("Phone mapping error:", mappingError);
                // Don't fail the whole request if mapping fails
            }
        }

        return NextResponse.json({
            message: "PDF processed successfully",
            file_id: fileId,
            chunks: chunks.length,
            phone_numbers_mapped: phoneNumberList.length,
            drive_links_found: driveLinks.length,
        });
    } catch (err: unknown) {
        console.error("PROCESS_PDF_ERROR:", err);
        if (err && typeof err === "object") {
            console.error("PROCESS_PDF_ERROR_DETAIL:", JSON.stringify(err));
        }

        // Clean up orphaned file rows when chunk insertion fails
        if (fileId) {
            // best-effort cleanup; ignore result to avoid masking original error
            void supabase.from("rag_files").delete().eq("id", fileId);
        }

        const message = err instanceof Error ? err.message : "Unknown error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
