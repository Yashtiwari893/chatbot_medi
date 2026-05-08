# 11za File Upload & Drive Link Integration

## Overview

Implemented complete Google Drive → 11za file upload flow. PDFs containing Google Drive links are now automatically downloaded from Drive and uploaded to 11za, enabling direct file delivery via WhatsApp without relying on Drive's bandwidth.

## How It Works

### Flow Diagram

```
User uploads PDF with Drive links
    ↓
Process-PDF API extracts all Google Drive links from PDF content
    ↓
For each unique link: Download PDF from Drive
    ↓
Upload downloaded PDF to 11za API → Get elevenza_file_id
    ↓
Store mapping: Drive URL → elevenza_file_id in database
    ↓
When WhatsApp message requests that document:
    - Auto-responder checks for elevenza_file_id
    - If available: Send using 11za file ID (preferred, direct from 11za)
    - If not available: Send using Drive URL (fallback)
```

## New Components

### 1. **`src/lib/11zaFileUpload.ts`** — 11za File Management
- `downloadFromGoogleDrive(driveLink)` — Downloads PDF from Drive
- `uploadPdfTo11za(buffer, fileName, authToken, origin)` — Uploads to 11za API
- `processDriveLinkTo11za(...)` — Combined operation (download + upload)
- `extractGoogleDriveLinks(text)` — Extracts Drive links from text

### 2. **`src/lib/whatsappSender.ts`** — New Send Method
- `sendWhatsAppDocument11zaFileId(phoneNumber, fileId, ...)` — Send using 11za file ID
  - Prefers 11za file IDs for better performance
  - Falls back to Drive URL if needed

### 3. **`src/app/api/process-pdf/route.ts`** — Enhanced PDF Processing
- Now extracts all Google Drive links from uploaded PDF
- Downloads each unique Drive link
- Uploads to 11za API
- Stores `elevenza_file_id` mappings in database
- Returns upload summary in API response

### 4. **`src/lib/autoResponder.ts`** — Smart Document Sending
- Queries database for available `elevenza_file_id` when sending documents
- Prefers 11za file IDs (direct, no Drive dependency)
- Falls back to Drive URL if 11za ID not available
- Both send methods logged for debugging

### 5. **Database Migration** — `migrations/add_11za_file_tracking.sql`
New columns added to Supabase:
```sql
-- rag_files table
elevenza_file_id TEXT         -- 11za file ID after upload
elevenza_auth_token TEXT      -- 11za credentials
elevenza_origin TEXT          -- Origin website for 11za
source_drive_link TEXT        -- Original Drive link

-- rag_chunks table
elevenza_file_id TEXT         -- For individual chunk tracking
source_drive_link TEXT        -- Source Drive link

-- phone_document_mapping table
elevenza_file_id TEXT         -- Direct 11za file reference

-- New view
phone_elevenza_mappings       -- Query 11za-enabled mappings easily
```

## Setup & Configuration

### 1. Apply Database Migration
Run this in Supabase SQL Editor:
```sql
-- In Supabase dashboard → SQL Editor
-- Paste contents of migrations/add_11za_file_tracking.sql
```

### 2. Environment Variables (Already in `.env.local`)
```env
WHATSAPP_11ZA_AUTH_TOKEN=your_11za_auth_token
WHATSAPP_11ZA_ORIGIN=https://your-domain.com
```

### 3. API Endpoint Input Format
When uploading PDF to `/api/process-pdf`:
```bash
curl -X POST http://localhost:3000/api/process-pdf \
  -F "file=@document_with_links.pdf" \
  -F "phone_numbers=919876543210" \
  -F "auth_token=YOUR_11ZA_TOKEN" \
  -F "origin=https://your-domain.com"
```

**Response includes:**
```json
{
  "message": "PDF processed successfully",
  "file_id": "...",
  "chunks": 42,
  "drive_links_found": 3,
  "elevenza_files_uploaded": 3,
  "elevenza_mapping": {
    "https://drive.google.com/file/d/ABC123/view": "11za-file-id-1",
    "https://drive.google.com/file/d/XYZ789/view": "11za-file-id-2",
    ...
  }
}
```

## Usage Examples

### Example 1: PDF with Embedded Drive Links
Your PDF content:
```
Anatomy Bundle:
- Bones: https://drive.google.com/file/d/ABC123/view
- Muscles: https://drive.google.com/file/d/XYZ789/view
```

Process:
1. Upload PDF → System extracts both Drive links
2. Downloads both from Drive
3. Uploads both to 11za → Gets 2 file IDs
4. Stores mappings

Result: When user requests anatomy, WhatsApp receives file directly from 11za (not Drive)

### Example 2: Auto-responder Behavior
```
User: "Anatomy PDFs please"
    ↓
System retrieves context chunk containing Drive link
    ↓
Checks: Is elevenza_file_id available for this link?
    ✓ YES → Send via 11za file ID (fast, direct)
    ✗ NO → Send via Drive URL (compatibility fallback)
```

## API Endpoint Changes

### `/api/process-pdf` — Enhanced Response
**New fields in response:**
- `drive_links_found`: Number of Drive links extracted
- `elevenza_files_uploaded`: Number successfully uploaded to 11za
- `elevenza_mapping`: Object mapping Drive URLs → 11za file IDs

### `/api/webhook/whatsapp` — Automatic
- No changes needed
- Auto-responder automatically uses 11za IDs when available

## Database Queries

### Find All 11za-Enabled Documents
```sql
SELECT * FROM phone_elevenza_mappings
WHERE elevenza_file_id IS NOT NULL;
```

### Find Original Drive Link for a 11za File ID
```sql
SELECT source_drive_link, elevenza_file_id 
FROM rag_files 
WHERE elevenza_file_id = 'your-file-id';
```

## Error Handling

### Drive Download Fails
- Logged: `⚠️ Failed to upload {link}: {error}`
- Fallback: System continues processing other links
- Result: Those links remain as Drive URLs (not uploaded to 11za)

### 11za Upload Fails
- Logged: `❌ Error uploading Drive link`
- Fallback: Auto-responder still sends via Drive URL
- User gets document either way

### No 11za Credentials
- Error: `11za auth_token and origin are required`
- Process-PDF endpoint rejects request
- Admin must provide credentials in form data

## Monitoring & Debugging

### Check 11za Upload Success
```bash
# Look at console logs during process-pdf:
# ✅ File uploaded to 11za with ID: {fileId}
# OR
# ⚠️ Failed to upload: {error message}
```

### Check Document Sending
```bash
# Auto-responder logs show:
# 📤 Sending via 11za file ID (preferred)... ← Using 11za
# 📤 Sending via Drive URL (fallback)... ← Using Drive fallback
```

### Query Database Status
```sql
-- See file upload history
SELECT id, name, elevenza_file_id, source_drive_link 
FROM rag_files 
ORDER BY created_at DESC 
LIMIT 10;
```

## Performance Benefits

| Metric | Before | After |
|--------|--------|-------|
| **File Host** | Google Drive | 11za |
| **Delivery Speed** | Depends on Drive bandwidth | Direct from 11za |
| **Reliability** | Subject to Drive rate limits | 11za's infrastructure |
| **Link Persistence** | Fragile (Drive link may break) | Stable (11za file ID) |
| **Bandwidth** | Google Drive | 11za |

## Troubleshooting

### Files not uploading to 11za
1. Check `11za_auth_token` and `11za_origin` are correct
2. Verify 11za API is accessible: `curl https://api.11za.in/apis/file/uploadFile`
3. Check internet connection

### Auto-responder not sending documents
1. Verify `elevenza_file_id` exists in database: `SELECT elevenza_file_id FROM rag_files LIMIT 5;`
2. Check logs for Drive URL fallback
3. Ensure phone mapping exists for the number

### Drive link extraction not working
1. Verify PDF contains valid Drive links (format: `https://drive.google.com/file/d/...`)
2. Check PDF text extraction working: Look for "`🔍 Extracting Google Drive links from PDF...`" in logs
3. Ensure regex pattern matches your link format

## Future Enhancements

- [ ] Retry logic for failed 11za uploads
- [ ] Support for other cloud providers (OneDrive, Dropbox)
- [ ] Batch upload optimization
- [ ] 11za file lifecycle management (auto-cleanup old files)
- [ ] Integration with Supabase storage as alternative to 11za

## Support

For issues, check:
1. Build logs: `npm run build`
2. Database schema: `migrations/add_11za_file_tracking.sql`
3. 11za API docs: https://api.11za.in/
4. Supabase console for data verification
