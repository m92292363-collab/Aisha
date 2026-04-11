const { neon } = require('@neondatabase/serverless');

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    try {
        const { message, userId, history = [] } = JSON.parse(event.body);

        if (!message) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Message is required' }) };
        }

        // Build messages array for Claude
        const messages = [
            ...history.map(h => ({ role: h.role, content: h.content })),
            { role: 'user', content: message }
        ];

        // Call Claude API
        const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 1024,
                system: `You are AISHA, a friendly, encouraging, and fun AI tutor for students. 
You speak in a warm, enthusiastic, and supportive tone. You use emojis occasionally to make learning fun. 
You help students understand subjects like Math, Physics, Chemistry, Biology, History, and Literature.
You explain concepts clearly with simple analogies, and you always encourage students.
When asked about quizzes, suggest they visit the Quizzes page to practice.
Keep responses concise but helpful - usually 2-4 paragraphs max.`,
                messages
            })
        });

        if (!claudeRes.ok) {
            const errText = await claudeRes.text();
            throw new Error(`Claude API error: ${errText}`);
        }

        const claudeData = await claudeRes.json();
        const response = claudeData.content[0].text;

        // Save to DB if userId provided
        if (userId && process.env.DATABASE_URL) {
            try {
                const sql = neon(process.env.DATABASE_URL);
                await sql`INSERT INTO chat_messages (user_id, role, content) VALUES (${userId}, 'user', ${message})`;
                await sql`INSERT INTO chat_messages (user_id, role, content) VALUES (${userId}, 'assistant', ${response})`;
            } catch (dbErr) {
                console.error('DB save error:', dbErr.message);
                // Don't fail the request if DB save fails
            }
        }

        return { statusCode: 200, headers, body: JSON.stringify({ success: true, response }) };
    } catch (err) {
        console.error('Chat error:', err.message);
        return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
};
