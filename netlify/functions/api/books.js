import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

export const handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }
    
    const { title, author, subject, content } = JSON.parse(event.body);
    
    // Store book in database
    const [book] = await sql`
        INSERT INTO books (title, author, subject, content)
        VALUES (${title}, ${author}, ${subject}, ${content})
        RETURNING id
    `;
    
    return {
        statusCode: 200,
        body: JSON.stringify({ 
            success: true, 
            bookId: book.id,
            message: `"${title}" has been added to AISHA's brain! 📚`
        })
    };
};
