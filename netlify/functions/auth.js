const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }

    // Parse the action from the path: /api/auth/login or /api/auth/register
    const pathParts = (event.path || '').split('/').filter(Boolean);
    const action = pathParts[pathParts.length - 1]; // last segment: "login" or "register"

    // INIT DB - create tables if they don't exist
    if (action === 'init' && event.httpMethod === 'GET') {
        try {
            const sql = neon(process.env.DATABASE_URL);
            await sql`
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    email TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    full_name TEXT,
                    role TEXT DEFAULT 'student',
                    is_active BOOLEAN DEFAULT true,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                )
            `;
            await sql`
                CREATE TABLE IF NOT EXISTS chat_messages (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER,
                    role TEXT,
                    content TEXT,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                )
            `;
            await sql`
                CREATE TABLE IF NOT EXISTS books (
                    id SERIAL PRIMARY KEY,
                    title TEXT NOT NULL,
                    author TEXT,
                    subject TEXT,
                    content TEXT,
                    difficulty INTEGER DEFAULT 1,
                    description TEXT,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                )
            `;
            await sql`
                CREATE TABLE IF NOT EXISTS quizzes (
                    id SERIAL PRIMARY KEY,
                    title TEXT NOT NULL,
                    subject TEXT,
                    difficulty INTEGER DEFAULT 1,
                    time_limit INTEGER DEFAULT 15,
                    is_active BOOLEAN DEFAULT true,
                    questions JSONB,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                )
            `;
            await sql`
                CREATE TABLE IF NOT EXISTS quiz_attempts (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER,
                    quiz_id INTEGER,
                    score INTEGER,
                    total INTEGER,
                    percentage INTEGER,
                    is_passed BOOLEAN,
                    subject TEXT,
                    completed_at TIMESTAMPTZ DEFAULT NOW()
                )
            `;
            // Seed admin account
            const existing = await sql`SELECT id FROM users WHERE email = 'admin@aisha.com'`;
            if (existing.length === 0) {
                const hash = await bcrypt.hash('admin123', 10);
                await sql`INSERT INTO users (email, password_hash, full_name, role) VALUES ('admin@aisha.com', ${hash}, 'Admin', 'admin')`;
            }
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'DB initialized' }) };
        } catch (err) {
            return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
        }
    }

    // REGISTER
    if (action === 'register' && event.httpMethod === 'POST') {
        try {
            const sql = neon(process.env.DATABASE_URL);
            const { email, password, full_name } = JSON.parse(event.body);
            if (!email || !password || !full_name) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'All fields required' }) };
            }
            const existing = await sql`SELECT id FROM users WHERE email = ${email}`;
            if (existing.length > 0) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email already registered' }) };
            }
            const hash = await bcrypt.hash(password, 10);
            const [user] = await sql`
                INSERT INTO users (email, password_hash, full_name, role)
                VALUES (${email}, ${hash}, ${full_name}, 'student')
                RETURNING id, email, full_name, role
            `;
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, user }) };
        } catch (err) {
            return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
        }
    }

    // LOGIN
    if (action === 'login' && event.httpMethod === 'POST') {
        try {
            const sql = neon(process.env.DATABASE_URL);
            const { email, password } = JSON.parse(event.body);
            if (!email || !password) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email and password required' }) };
            }
            const [user] = await sql`SELECT * FROM users WHERE email = ${email} AND is_active = true`;
            if (!user) {
                return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid credentials' }) };
            }
            const valid = await bcrypt.compare(password, user.password_hash);
            if (!valid) {
                return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid credentials' }) };
            }
            const safeUser = { id: user.id, email: user.email, full_name: user.full_name, role: user.role };
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, user: safeUser }) };
        } catch (err) {
            return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
        }
    }

    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not found' }) };
};
