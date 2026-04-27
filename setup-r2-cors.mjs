import { createHash, createHmac } from 'node:crypto';

const ACCOUNT_ID = 'dfcb9a70877400b4f29c4e0f79da30e2';
const ACCESS_KEY_ID = 'd057a35dcd58ececc8ec558d3ea939ea';
const SECRET_ACCESS_KEY = '0662da96112c05a037844f7a22ee1a2215bf4e2aa853750d8a50ae1e0745a620';

const BUCKETS = ['field-ops-photos'];

const CORS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<CORSConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <CORSRule>
    <AllowedOrigin>https://visit-ceklist.vercel.app</AllowedOrigin>
    <AllowedMethod>PUT</AllowedMethod>
    <AllowedMethod>GET</AllowedMethod>
    <AllowedMethod>HEAD</AllowedMethod>
    <AllowedHeader>*</AllowedHeader>
    <ExposeHeader>ETag</ExposeHeader>
    <MaxAgeSeconds>3600</MaxAgeSeconds>
  </CORSRule>
  <CORSRule>
    <AllowedOrigin>*</AllowedOrigin>
    <AllowedMethod>GET</AllowedMethod>
    <AllowedMethod>HEAD</AllowedMethod>
    <AllowedHeader>*</AllowedHeader>
    <MaxAgeSeconds>3600</MaxAgeSeconds>
  </CORSRule>
</CORSConfiguration>`;

function hmacSha256(key, message) {
    return createHmac('sha256', key).update(message, 'utf8').digest();
}
function sha256Hex(data) {
    return createHash('sha256').update(typeof data === 'string' ? data : data, 'utf8').digest('hex');
}
function sha256HexBuf(buf) {
    return createHash('sha256').update(buf).digest('hex');
}

async function setCors(bucket) {
    const region = 'auto';
    const service = 's3';
    const host = `${ACCOUNT_ID}.r2.cloudflarestorage.com`;
    const bodyBuf = Buffer.from(CORS_XML, 'utf8');
    const payloadHash = sha256HexBuf(bodyBuf);

    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.substring(0, 8);

    const canonicalUri = `/${bucket}`;
    const canonicalQueryString = 'cors=';
    const canonicalHeaders = `content-type:application/xml\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';

    const canonicalRequest = [
        'PUT',
        canonicalUri,
        canonicalQueryString,
        canonicalHeaders,
        signedHeaders,
        payloadHash,
    ].join('\n');

    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${sha256Hex(canonicalRequest)}`;

    const kDate = hmacSha256(`AWS4${SECRET_ACCESS_KEY}`, dateStamp);
    const kRegion = hmacSha256(kDate, region);
    const kService = hmacSha256(kRegion, service);
    const kSigning = hmacSha256(kService, 'aws4_request');
    const signature = hmacSha256(kSigning, stringToSign).toString('hex');

    const authorization = `AWS4-HMAC-SHA256 Credential=${ACCESS_KEY_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const url = `https://${host}/${bucket}?cors=`;
    const resp = await fetch(url, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/xml',
            'Host': host,
            'x-amz-content-sha256': payloadHash,
            'x-amz-date': amzDate,
            'Authorization': authorization,
        },
        body: bodyBuf,
    });

    const text = await resp.text();
    if (resp.ok || resp.status === 200) {
        console.log(`✓ CORS configured for bucket: ${bucket} (${resp.status})`);
    } else {
        console.error(`✗ Failed for bucket ${bucket}: HTTP ${resp.status}`);
        console.error(text);
    }
}

for (const bucket of BUCKETS) {
    await setCors(bucket);
}
