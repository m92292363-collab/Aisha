const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');

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
    
    const url = new URL(event.rawUrl || `http://localhost${event.path}`);
    const pathname = url.pathname;
    
    // REGISTER - /register
    if (pathname === '/register' && event.httpMethod === 'POST') {
        try {
            const { email, password, full_name } = JSON.parse(event.body);
            
            const existing = await sql`SELECT id FROM users WHERE email = ${email}`;
            if (existing.length > 0) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email already registered' }) };
            }
            
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            
            const [user] = await sql`
                INSERT INTO users (email, password_hash, full_name, role)
                VALUES (${email}, ${hashedPassword}, ${full_name}, 'student')
                RETURNING id, email, full_name, role
            `;
            
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, user }) };
        } catch (err) {
            return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
        }
    }
    
    // LOGIN - /login
    if (pathname === '/login' && event.httpMethod === 'POST') {
        try {
            const { email, password } = JSON.parse(event.body);
            
            const [user] = await sql`SELECT * FROM users WHERE email = ${email}`;
            if (!user) {
                return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid credentials' }) };
            }
            
            const valid = await bcrypt.compare(password, user.password_hash);
            if (!valid) {
                return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid credentials' }) };
            }
            
            delete user.password_hash;
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, user }) };
        } catch (err) {
            return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
        }
    }
    
    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not found' }) };
};
