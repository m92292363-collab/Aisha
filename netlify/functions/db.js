const { neon } = require('@neondatabase/serverless');

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };

    const sql = neon(process.env.DATABASE_URL);
    const pathParts = (event.path || '').split('/').filter(Boolean);
    const lastSegment = pathParts[pathParts.length - 1];
    const isUUID = /^[0-9a-f-]{36}$/i.test(lastSegment);

    // Health check: GET /api/db/health
    if (event.httpMethod === 'GET' && lastSegment === 'health') {
        try {
            const result = await sql`SELECT NOW()`;
            return { statusCode: 200, headers, body: JSON.stringify({ status: 'connected', time: result[0].now }) };
        } catch (err) {
            return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
        }
    }

    // GET all students + attempts: GET /api/db/users
    if (event.httpMethod === 'GET' && lastSegment === 'users') {
        try {
            const users = await sql`SELECT id, email, full_name, role, is_active, created_at FROM users WHERE role = 'student' ORDER BY created_at DESC`;
            const attempts = await sql`SELECT * FROM quiz_attempts ORDER BY completed_at DESC`;
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, users, attempts }) };
        } catch (err) {
            return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
        }
    }

    // PATCH toggle user active: PATCH /api/db/:uuid
    if (event.httpMethod === 'PATCH' && isUUID) {
        try {
            const { is_active } = JSON.parse(event.body);
            await sql`UPDATE users SET is_active = ${is_active} WHERE id = ${lastSegment}::uuid`;
            return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
        } catch (err) {
            return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
        }
    }

    // DELETE user: DELETE /api/db/:uuid
    if (event.httpMethod === 'DELETE' && isUUID) {
        try {
            await sql`DELETE FROM users WHERE id = ${lastSegment}::uuid`;
            return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
        } catch (err) {
            return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
        }
    }

    // GET user progress: GET /api/db/progress?userId=UUID
    if (event.httpMethod === 'GET' && lastSegment === 'progress') {
        try {
            const userId = event.queryStringParameters?.userId;
            if (!userId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'userId required' }) };
            const progress = await sql`SELECT * FROM user_progress WHERE user_id = ${userId}::uuid`;
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, progress }) };
        } catch (err) {
            return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
        }
    }

    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not found' }) };
};
