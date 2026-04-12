const { neon } = require('@neondatabase/serverless');
const https = require('https');
const crypto = require('crypto');

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    try {
        const { file, fileName, fileType, title, author, subject, difficulty, description } = JSON.parse(event.body);

        if (!file) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'No file provided' }) };
        }

        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
        const apiKey = process.env.CLOUDINARY_API_KEY;
        const apiSecret = process.env.CLOUDINARY_API_SECRET;

        // Generate signature for Cloudinary upload
        const timestamp = Math.round(Date.now() / 1000);
        const folder = 'aisha_books';
        const publicId = `${folder}/${Date.now()}_${fileName?.replace(/[^a-z0-9]/gi, '_') || 'book'}`;

        const signatureStr = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
        const signature = crypto.createHash('sha256').update(signatureStr).digest('hex');

        // Upload to Cloudinary via their API
        const uploadData = new URLSearchParams({
            file: file, // base64 data URI
            api_key: apiKey,
            timestamp: timestamp.toString(),
            signature,
            folder,
            public_id: publicId,
            resource_type: 'raw' // for PDF/non-image files
        });

        const cloudinaryUrl = await new Promise((resolve, reject) => {
            const postData = uploadData.toString();
            const options = {
                hostname: 'api.cloudinary.com',
                path: `/v1_1/${cloudName}/raw/upload`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(postData)
                }
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.secure_url) resolve(parsed.secure_url);
                        else reject(new Error(parsed.error?.message || 'Upload failed'));
                    } catch (e) {
                        reject(new Error('Invalid Cloudinary response'));
                    }
                });
            });

            req.on('error', reject);
            req.write(postData);
            req.end();
        });

        // Save book to Neon DB with Cloudinary URL
        const sql = neon(process.env.DATABASE_URL);
        const [book] = await sql`
            INSERT INTO books (title, author, subject, difficulty, description, content)
            VALUES (${title}, ${author || ''}, ${subject}, ${difficulty || 1}, ${description || ''}, ${cloudinaryUrl})
            RETURNING *
        `;

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, book, fileUrl: cloudinaryUrl })
        };

    } catch (err) {
        console.error('Upload error:', err);
        return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
};
