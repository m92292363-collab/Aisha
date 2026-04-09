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
    
    // GET all books
    if (event.httpMethod === 'GET') {
        try {
            const books = await sql`SELECT * FROM books ORDER BY created_at DESC`;
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, books }) };
        } catch (err) {
            return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
        }
    }
    
    // POST new book
    if (event.httpMethod === 'POST') {
        try {
            const { title, author, subject, content } = JSON.parse(event.body);
            const [book] = await sql`
                INSERT INTO books (title, author, subject, content)
                VALUES (${title}, ${author}, ${subject}, ${content})
                RETURNING *
            `;
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, book }) };
        } catch (err) {
            return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
        }
    }
    
    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not found' }) };
};
