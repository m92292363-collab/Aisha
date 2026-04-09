import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

const sql = neon(process.env.DATABASE_URL);

export const handler = async (event) => {
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
    
    // REGISTER - saves user to Neon database
    if (pathname.includes('/register') && event.httpMethod === 'POST') {
        try {
            const { email, password, full_name } = JSON.parse(event.body);
            
            // Check if user exists in Neon
            const existing = await sql`SELECT id FROM users WHERE email = ${email}`;
            if (existing.length > 0) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email already registered' }) };
            }
            
            // Hash password
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            
            // Save to Neon database
            const [user] = await sql`
                INSERT INTO users (email, password_hash, full_name, role)
                VALUES (${email}, ${hashedPassword}, ${full_name}, 'student')
                RETURNING id, email, full_name, role
            `;
            
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, user }) };
        } catch (error) {
            console.error('Register error:', error);
            return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
        }
    }
    
    // LOGIN - checks user in Neon database
    if (pathname.includes('/login') && event.httpMethod === 'POST') {
        try {
            const { email, password } = JSON.parse(event.body);
            
            // Get user from Neon
            const [user] = await sql`SELECT * FROM users WHERE email = ${email}`;
            if (!user) {
                return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid credentials' }) };
            }
            
            // Verify password
            const valid = await bcrypt.compare(password, user.password_hash);
            if (!valid) {
                return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid credentials' }) };
            }
            
            // Return user without password
            delete user.password_hash;
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, user }) };
        } catch (error) {
            console.error('Login error:', error);
            return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
        }
    }
    
    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not found' }) };
};
