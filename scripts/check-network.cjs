/**
 * Principal-Grade Network Integration Audit
 * This script hits the actual running preview server to verify proxy integrity.
 * Usage: node scripts/check-network.js
 */
const http = require('http');

const SERVER_URL = 'http://localhost:4173';
const API_PREFIX = '/economy/api';

async function checkEndpoint(path, expectedType) {
    return new Promise((resolve, reject) => {
        const url = `${SERVER_URL}${path}`;
        console.log(`[Audit] Testing ${url}...`);

        http.get(url, (res) => {
            const { statusCode } = res;
            const contentType = res.headers['content-type'];

            let error;
            if (statusCode !== 200) {
                error = new Error(`Request Failed. Status Code: ${statusCode}`);
            } else if (!contentType.includes(expectedType)) {
                error = new Error(`Invalid content-type.\nExpected ${expectedType} but received ${contentType}`);
            }

            if (error) {
                console.error(`[FAIL] ${path}: ${error.message}`);
                res.resume();
                return resolve(false);
            }

            res.setEncoding('utf8');
            let rawData = '';
            res.on('data', (chunk) => { rawData += chunk; });
            res.on('end', () => {
                if (rawData.trim().startsWith('<!doctype html>') || rawData.trim().startsWith('<html')) {
                    console.error(`[FAIL] ${path}: LEAKING BUG DETECTED - Server returned SPA HTML instead of Data.`);
                    return resolve(false);
                }

                if (expectedType === 'json') {
                    try {
                        JSON.parse(rawData);
                    } catch (e) {
                        console.error(`[FAIL] ${path}: JSON Parse Error.`);
                        return resolve(false);
                    }
                }

                console.log(`[PASS] ${path}: Correct format (${expectedType})`);
                resolve(true);
            });
        }).on('error', (e) => {
            console.error(`[ERROR] ${path}: Connection failed (is preview server running?). ${e.message}`);
            resolve(false);
        });
    });
}

async function runAudit() {
    console.log('--- US Economy Pulse: Network Integration Audit ---');

    const fredPass = await checkEndpoint(`${API_PREFIX}/fred/graph/fredgraph.csv?id=SP500`, 'text/csv');
    const yahooPass = await checkEndpoint(`${API_PREFIX}/yahoo/v8/finance/chart/GC=Y`, 'json');

    if (fredPass && yahooPass) {
        console.log('\n[SUCCESS] Principal Logic Verified: No proxy leakage detected.');
        process.exit(0);
    } else {
        console.error('\n[CRITICAL FAILURE] Architectural breach detected in Proxy layer.');
        process.exit(1);
    }
}

runAudit();
