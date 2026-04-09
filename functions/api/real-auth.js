import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

// Initialize Neon connection
const sql = neon(process.env.DATABASE_URL);

export const handler = async (event) => {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };
    
    // Handle preflight OPTIONS request
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }
    
    const url = new URL(event.rawUrl || `http://localhost${event.path}`);
    const pathname = url.pathname;
    
    // REGISTER - /register
    if (pathname.includes('/register') && event.httpMethod === 'POST') {
        try {
            const { email, password, full_name } = JSON.parse(event.body);
            
            console.log('Registering:', { email, full_name });
            
            // Check if user exists
            const existing = await sql`SELECT id FROM users WHERE email = ${email}`;
            if (existing.length > 0) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Email already registered' })
                };
            }
            
            // Hash password
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            
            // Create user
            const [user] = await sql`
                INSERT INTO users (email, password_hash, full_name, role)
                VALUES (${email}, ${hashedPassword}, ${full_name}, 'student')
                RETURNING id, email, full_name, role
            `;
            
            console.log('User created:', user);
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, user })
            };
            
        } catch (error) {
            console.error('Register error:', error);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Server error: ' + error.message })
            };
        }
    }
    
    // LOGIN - /login
    if (pathname.includes('/login') && event.httpMethod === 'POST') {
        try {
            const { email, password } = JSON.parse(event.body);
            
            console.log('Login attempt:', email);
            
            const [user] = await sql`SELECT * FROM users WHERE email = ${email}`;
            
            if (!user) {
                return {
                    statusCode: 401,
                    headers,
                    body: JSON.stringify({ error: 'Invalid credentials' })
                };
            }
            
            const validPassword = await bcrypt.compare(password, user.password_hash);
            if (!validPassword) {
                return {
                    statusCode: 401,
                    headers,
                    body: JSON.stringify({ error: 'Invalid credentials' })
                };
            }
            
            // Return user without password
            delete user.password_hash;
            
            console.log('Login success:', user.email);
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, user })
            };
            
        } catch (error) {
            console.error('Login error:', error);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Server error: ' + error.message })
            };
        }
    }
    
    return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Not found' })
    };
};
