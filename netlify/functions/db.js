const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };
    
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }
    
    // Health check
    if (event.httpMethod === 'GET' && event.path === '/db/health') {
        try {
            const result = await sql`SELECT NOW()`;
            return { statusCode: 200, headers, body: JSON.stringify({ status: 'connected', time: result[0].now }) };
        } catch (err) {
            return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
        }
    }
    
    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not found' }) };
};
