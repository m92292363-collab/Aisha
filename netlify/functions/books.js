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
    const bookId = !isNaN(lastSegment) && lastSegment !== 'books' ? parseInt(lastSegment) : null;

    // GET all books
    if (event.httpMethod === 'GET' && !bookId) {
        try {
            const books = await sql`SELECT * FROM books ORDER BY uploaded_at DESC`;
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, books }) };
        } catch (err) {
            return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
        }
    }

    // POST new book
    if (event.httpMethod === 'POST') {
        try {
            const { title, author, subject, content, difficulty, description } = JSON.parse(event.body);
            if (!title || !subject) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Title and subject required' }) };
            }
            const [book] = await sql`
                INSERT INTO books (title, author, subject, content, difficulty, description)
                VALUES (${title}, ${author || ''}, ${subject}, ${content || ''}, ${difficulty || 1}, ${description || ''})
                RETURNING *
            `;
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, book }) };
        } catch (err) {
            return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
        }
    }

    // DELETE book by integer id
    if (event.httpMethod === 'DELETE' && bookId) {
        try {
            await sql`DELETE FROM books WHERE id = ${bookId}`;
            return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
        } catch (err) {
            return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
        }
    }

    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not found' }) };
};
