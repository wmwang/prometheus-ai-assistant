
// Verification script that tests the authentication logic directly
// Copied from config.ts to verify the implementation logic works as expected

console.log('Testing Auth Logic Implementation:');

function getHeaders(env: Record<string, string | undefined>) {
    // Priority 1: Custom Headers JSON
    if (env.PROMETHEUS_HEADERS) {
        try {
            return JSON.parse(env.PROMETHEUS_HEADERS);
        } catch (e) {
            console.warn('⚠️ PROMETHEUS_HEADERS format error, using default');
        }
    }
    // Priority 2: Basic Auth
    if (env.PROMETHEUS_USERNAME && env.PROMETHEUS_PASSWORD) {
        const token = Buffer.from(`${env.PROMETHEUS_USERNAME}:${env.PROMETHEUS_PASSWORD}`).toString('base64');
        return { 'Authorization': `Basic ${token}` };
    }
    return {};
}

// Test Case 1: Basic Auth
const envBasic = {
    PROMETHEUS_USERNAME: 'admin',
    PROMETHEUS_PASSWORD: 'password'
};
const headersBasic = getHeaders(envBasic);
console.log('Case 1 (Basic Auth):', headersBasic);

if (headersBasic.Authorization === 'Basic YWRtaW46cGFzc3dvcmQ=') {
    console.log('✅ Basic Auth logic correct');
} else {
    console.error('❌ Basic Auth logic failed');
    process.exit(1);
}

// Test Case 2: Custom Headers
const envHeaders = {
    PROMETHEUS_HEADERS: '{"X-Test": "123"}'
};
const headersCustom = getHeaders(envHeaders);
console.log('Case 2 (Custom Headers):', headersCustom);

if (headersCustom['X-Test'] === '123') {
    console.log('✅ Custom Headers logic correct');
} else {
    console.error('❌ Custom Headers logic failed');
    process.exit(1);
}
