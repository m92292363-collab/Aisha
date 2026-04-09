import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

const sql = neon(process.env.DATABASE_URL);

export const handler = async (event) => {
    const { path, httpMethod } = event;
    
    // REGISTER
    if (path.includes('/auth/register') && httpMethod === 'POST') {
        const { email, password, full_name, role = 'student' } = JSON.parse(event.body);
        
        const existing = await sql`SELECT id FROM users WHERE email = ${email}`;
        if (existing.length > 0) {
            return { statusCode: 400, body: JSON.stringify({ error: 'User exists' }) };
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const [user] = await sql`
            INSERT INTO users (email, password_hash, full_name, role)
            VALUES (${email}, ${hashedPassword}, ${full_name}, ${role})
            RETURNING id, email, full_name, role
        `;
        
        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, user })
        };
    }
    
    // LOGIN
    if (path.includes('/auth/login') && httpMethod === 'POST') {
        const { email, password } = JSON.parse(event.body);
        
        const [user] = await sql`SELECT * FROM users WHERE email = ${email}`;
        
        if (!user) {
            return { statusCode: 401, body: JSON.stringify({ error: 'Invalid credentials' }) };
        }
        
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            return { statusCode: 401, body: JSON.stringify({ error: 'Invalid credentials' }) };
        }
        
        delete user.password_hash;
        
        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, user })
        };
    }
    
    return { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) };
};
