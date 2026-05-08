#!/bin/bash

# Test script to verify 11za document sending flow

echo "🧪 Testing 11za PDF Sending Flow"
echo "=================================="

# Configuration
PHONE_NUMBER="919876543210"  # Test phone number
PDF_URL="http://localhost:3000/api/process-pdf"
11ZA_TOKEN="YOUR_11ZA_AUTH_TOKEN"
ORIGIN="https://medistudygo.com"
TEST_PDF_WITH_LINKS="test_with_drive_links.pdf"

echo ""
echo "1️⃣  Creating test PDF with Drive link..."
# In real usage, you'd have an actual PDF file

echo ""
echo "2️⃣  Uploading to process-pdf endpoint..."
curl -X POST $PDF_URL \
  -F "file=@./${TEST_PDF_WITH_LINKS}" \
  -F "phone_numbers=${PHONE_NUMBER}" \
  -F "auth_token=${11ZA_TOKEN}" \
  -F "origin=${ORIGIN}" \
  -H "Content-Type: multipart/form-data" \
  2>/dev/null | jq '.'

echo ""
echo "3️⃣  Expected flow:"
echo "  ✅ Extract Drive links from PDF"
echo "  ✅ Store Drive link reference in database"
echo "  ✅ Return drive_links_found count"
echo ""
echo "4️⃣  When user sends WhatsApp message:"
echo "  ✅ Auto-responder retrieves PDF link"
echo "  ✅ Sends PDF via 11za using myfile URL"
echo "  📄 PDF delivered to user"
