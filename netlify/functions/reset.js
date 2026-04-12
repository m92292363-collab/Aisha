const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };

    // Only allow GET for security (visit URL in browser)
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    try {
        const sql = neon(process.env.DATABASE_URL);

        // Hash the new password
        const newPassword = 'admin123';
        const hash = await bcrypt.hash(newPassword, 10);

        // Check if admin exists
        const existing = await sql`SELECT id, email, full_name FROM users WHERE role = 'admin'`;

        if (existing.length > 0) {
            // Update existing admin password
            await sql`UPDATE users SET password_hash = ${hash}, is_active = true WHERE role = 'admin'`;
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'Admin password reset successfully',
                    admins: existing.map(u => ({ email: u.email, name: u.full_name })),
                    newPassword: newPassword,
                    note: 'DELETE this function after use for security!'
                })
            };
        } else {
            // Create admin from scratch
            await sql`
                INSERT INTO users (email, password_hash, full_name, role, is_active)
                VALUES ('admin@aisha.com', ${hash}, 'AISHA Admin', 'admin', true)
            `;
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'Admin account created',
                    email: 'admin@aisha.com',
                    newPassword: newPassword
                })
            };
        }
    } catch (err) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
};
