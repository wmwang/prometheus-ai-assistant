
// Using global fetch

// Since we are using tsx, we can use built-in fetch if Node version is recent enough, 
// or simpler, just use native fetch if available.

const BASE_URL = 'http://localhost:3001/api/elasticsearch';

async function testHealth() {
    console.log('Testing /health...');
    try {
        const res = await fetch(`${BASE_URL}/health`);
        const data = await res.json();
        console.log('Health:', data);
    } catch (e) {
        console.error('Health check failed:', e);
    }
}

async function testIndices() {
    console.log('Testing /indices...');
    try {
        const res = await fetch(`${BASE_URL}/indices`);
        const data = await res.json();
        console.log('Indices:', data);
        return data.indices?.[0];
    } catch (e) {
        console.error('Indices check failed:', e);
    }
}

async function testSSEDiagnosis() {
    console.log('Testing /diagnose SSE...');
    try {
        const res = await fetch(`${BASE_URL}/diagnose`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                logContent: 'Error: Connection refused at /src/main.ts:20'
            })
        });

        if (!res.ok) {
            console.error('Diagnosis failed:', res.status, await res.text());
            return;
        }

        console.log('Diagnosis response headers:', res.headers.get('content-type'));

        // Node-fetch or native fetch body stream
        const body = res.body;
        if (!body) {
            console.error('No body');
            return;
        }

        // Handle stream manually
        // For node-fetch, body is a Node stream
        // For native fetch, body is a ReadableStream

        // Let's assume native fetch in Node 18+ environment provided by `tsx`
        if (body.getReader) {
            const reader = body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value);
                console.log('Received chunk:', chunk);
            }
        } else {
            // Node stream (node-fetch or older node)
            for await (const chunk of body) {
                console.log('Received chunk:', chunk.toString());
            }
        }

    } catch (e) {
        console.error('SSE check failed:', e);
    }
}

async function main() {
    await testHealth();
    const index = await testIndices();
    if (index) {
        console.log(`Using index: ${index} for further tests if needed`);
        // We could test search here
    }
    await testSSEDiagnosis();
}

main().catch(console.error);
