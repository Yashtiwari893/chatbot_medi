#!/usr/bin/env node

/**
 * Test 11za Document Sending Methods
 * 
 * Usage:
 *   node test-11za-document.js <phone_number> <drive_link>
 * 
 * Example:
 *   node test-11za-document.js "919596946803" "https://drive.google.com/file/d/1-qsADUMekRfoDFbCibrA2d5QmO0WSkrq/view"
 * 
 * This tests all different ways to call 11za for document sending to find which works.
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const phone = process.argv[2];
const driveLink = process.argv[3];

if (!phone || !driveLink) {
    console.error('❌ Usage: node test-11za-document.js <phone_number> <drive_link>');
    console.error('\nExample:');
    console.error('  node test-11za-document.js "919596946803" "https://drive.google.com/file/d/ABC123/view"');
    process.exit(1);
}

async function testDocumentSending() {
    console.log('\n' + '='.repeat(70));
    console.log('🧪 11za Document Sending Debug Test');
    console.log('='.repeat(70));
    console.log(`Phone: ${phone}`);
    console.log(`Drive Link: ${driveLink}`);
    console.log(`Base URL: ${BASE_URL}`);
    console.log('='.repeat(70) + '\n');

    try {
        console.log('📡 Sending debug request to /api/debug-11za-doc...\n');

        const response = await fetch(`${BASE_URL}/api/debug-11za-doc`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phone: phone,
                driveLink: driveLink,
            }),
        });

        const data = await response.json();

        console.log('\n📊 Test Results:');
        console.log('─'.repeat(70));

        if (data.error) {
            console.error('❌ Error:', data.error);
            return;
        }

        console.log(`✓ Converted Download URL: ${data.downloadUrl}`);
        console.log(`\n📈 Summary:`);
        console.log(`   Total Attempts: ${data.summary.totalAttempts}`);
        console.log(`   ✅ Successful: ${data.summary.successCount}`);
        console.log(`   ❌ Failed: ${data.summary.failedCount}`);

        console.log(`\n📋 Detailed Results:`);
        console.log('─'.repeat(70));

        data.testResults.forEach((result, index) => {
            const status = result.success ? '✅' : '❌';
            console.log(`\n${status} Method ${index + 1}: ${result.method}`);
            
            if (result.error) {
                console.log(`   Error: ${result.error}`);
            } else {
                console.log(`   HTTP Status: ${result.httpStatus}`);
                if (result.response) {
                    const respStr = JSON.stringify(result.response, null, 2);
                    const respLines = respStr.split('\n').slice(0, 5);
                    console.log(`   Response: ${respLines.join('\n   ')}`);
                    if (respStr.split('\n').length > 5) {
                        console.log(`   ... (truncated)`);
                    }
                }
            }
        });

        // Find successful method
        const successful = data.testResults.find(r => r.success);
        if (successful) {
            console.log('\n' + '='.repeat(70));
            console.log(`🎯 SUCCESS! Use this method: ${successful.method}`);
            console.log('='.repeat(70));
        } else {
            console.log('\n' + '='.repeat(70));
            console.log('⚠️  None of the standard methods worked.');
            console.log('Possible issues:');
            console.log('  1. 11za API might not support contentType="document"');
            console.log('  2. Different parameter names might be required');
            console.log('  3. 11za might need file upload first (separate endpoint)');
            console.log('  4. Your 11za credentials might be invalid');
            console.log('\nCheck your .env.local for:');
            console.log('  - WHATSAPP_11ZA_AUTH_TOKEN');
            console.log('  - WHATSAPP_11ZA_ORIGIN');
            console.log('='.repeat(70));
        }

    } catch (error) {
        console.error('❌ Error:', error instanceof Error ? error.message : error);
        console.error('\nMake sure:');
        console.error('  1. Server is running: npm run dev');
        console.error('  2. BASE_URL is correct (default: http://localhost:3000)');
        console.error('  3. .env.local has WHATSAPP_11ZA_AUTH_TOKEN and WHATSAPP_11ZA_ORIGIN');
    }
}

testDocumentSending();
