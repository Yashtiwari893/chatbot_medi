# 11za Document Sending - Debugging Guide

## Problem

Bot is sending **text with Drive links** instead of **PDF attachments** via WhatsApp.

```
❌ Current: "Maaf kijiye, ye file direct link se download kar sakte hain:\nhttps://drive.google.com/..."
✅ Expected: PDF file attachment in WhatsApp
```

## Root Cause Analysis

When bot receives a message requesting a document:

1. **Text message sent** ✅ — "Yeh lijiye aapka requested material! 😊"
2. **PDF document send attempted** ❌ — Fails silently
3. **Fallback text sent** ✅ — "Maaf kijiye, ye file direct link se download kar sakte hain:..."

The `sendWhatsAppDocument()` function is returning `success: false`, but we're not seeing exactly WHY 11za is rejecting the request.

## Debug Steps

### Step 1: Run Debug Test Script

This tests 6 different ways to call 11za's API to find which format works:

```bash
# Terminal 1: Start dev server
npm run dev

# Terminal 2: Run debug test
node test-11za-document.js "919596946803" "https://drive.google.com/file/d/1-qsADUMekRfoDFbCibrA2d5QmO0WSkrq/view"
```

**Output will show:**
- ✅ Successful methods (if any)
- ❌ Failed methods with error details
- 11za's actual response for each attempt

### Step 2: Check Server Logs

When you send a WhatsApp message, check the server logs for detailed output:

```
📄 Sending WhatsApp PDF document to 919596946803...
   Original URL: https://drive.google.com/file/d/1-qsADUMekRfoDFbCibrA2d5QmO0WSkrq/view
   Converted URL: https://drive.google.com/uc?export=download&id=1-qsADUMekRfoDFbCibrA2d5QmO0WSkrq
   HTTP Status: [status_code]
   11za Response: { ... }
```

Look for:
- What HTTP status 11za returned
- What the JSON response says
- Whether 11za accepted/rejected it

### Step 3: Check 11za Credentials

Ensure your `.env.local` has valid credentials:

```bash
# .env.local
WHATSAPP_11ZA_AUTH_TOKEN=your_actual_token_here
WHATSAPP_11ZA_ORIGIN=https://medistudygo.com/
```

### Step 4: Possible Solutions Based on Debug Results

#### Scenario A: One of the 6 methods works ✅

**If Method 2, 3, 4, or 5 works**, I'll update the code to use that method.

#### Scenario B: None of the methods work ❌

Possible reasons:

1. **11za doesn't support sending files via `/sendMessage` endpoint**
   - Solution: Check if 11za has a separate file upload endpoint
   - Might need to upload file first, then send by reference

2. **URL format is wrong**
   - Try: `https://drive.google.com/uc?export=download&id=FILE_ID&confirm=t`
   - Or: Use Supabase storage URLs instead of Drive

3. **11za credentials are invalid**
   - Verify token hasn't expired
   - Check if account has WhatsApp API access

4. **11za account doesn't have file sending enabled**
   - Check 11za dashboard if file sending is available in your plan

## Recommended Test Sequence

### Quick Test (5 minutes)

```bash
# 1. Start server
npm run dev

# 2. In another terminal, run debug
node test-11za-document.js "919596946803" "https://drive.google.com/file/d/1-qsADUMekRfoDFbCibrA2d5QmO0WSkrq/view"

# 3. Share output with findings
```

### Full Test (10 minutes)

1. Run quick test above
2. Send WhatsApp message requesting document
3. Check server logs for detailed 11za response
4. Share both debug output and server logs

## Next Steps After Debugging

Once we identify what works:

1. Update `sendWhatsAppDocument()` function to use correct format
2. Test with real WhatsApp message
3. Verify PDF is delivered (not just link)

## Alternative Solutions If 11za File Sending Doesn't Work

### Option 1: Use Supabase Storage
```typescript
// Upload PDF to Supabase when processing
const { data, error } = await supabase.storage
  .from('pdfs')
  .upload(`${fileName}.pdf`, file);

// Send Supabase URL via 11za
const supabaseUrl = data.fullPath;
await sendWhatsAppDocument(phone, supabaseUrl);
```

### Option 2: Download from Drive and Re-host
```typescript
// Keep Drive link but also host on own server
// Send our server URL to 11za instead
```

### Option 3: User Downloads from Link
```typescript
// If file sending truly doesn't work,
// auto-convert Drive links to direct download
// and include clear download instructions
```

## Questions to Help Diagnose

Please run the test and share:

1. **What does the debug test show?** (Which methods succeeded/failed)
2. **What HTTP status does 11za return?**
3. **What error message does 11za include?**
4. **Do you see anything special in the 11za dashboard?**
5. **What's your 11za subscription plan?** (Free, Pro, etc.)

## Files Modified for Debugging

- `src/lib/whatsappSender.ts` — Enhanced logging
- `src/lib/autoResponder.ts` — Try alternative methods
- `src/app/api/debug-11za-doc/route.ts` — Debug endpoint (NEW)
- `test-11za-document.js` — Test script (NEW)

---

**Run the debug test and share results to proceed!** 🔍
