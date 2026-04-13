const { neon } = require('@neondatabase/serverless');

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

    try {
        const { message, userId, history = [] } = JSON.parse(event.body);
        if (!message) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Message required' }) };

        // Load books from DB to make AISHA aware of them
        let booksContext = '';
        if (process.env.DATABASE_URL) {
            try {
                const sql = neon(process.env.DATABASE_URL);
                const books = await sql`SELECT title, author, subject, description FROM books`;
                if (books.length > 0) {
                    booksContext = `\n\nBooks available in the library:\n${books.map(b => `- "${b.title}" by ${b.author || 'Unknown'} (Subject: ${b.subject})${b.description ? ': ' + b.description : ''}`).join('\n')}`;
                }
            } catch (e) { /* skip if DB fails */ }
        }

        const systemPrompt = `You are AISHA, a friendly, smart, and encouraging AI tutor for students. You speak in a warm, supportive, and engaging tone.

Your capabilities:
1. TEACH any subject clearly with simple explanations and real examples
2. QUIZ students interactively - when asked, give one question at a time, wait for their answer, then give feedback and the next question
3. DISCUSS books - you know all the books in the library and can help students understand them
4. TRACK topics - remember what was discussed in this conversation and build on it
5. SUGGEST topics - if a student doesn't know what to study, ask them what subject or book they want to explore

How to give quizzes:
- Ask "What subject or topic do you want to be quizzed on?"
- Give ONE question at a time (multiple choice or short answer)
- After their answer, say if it's correct, explain why, then ask the next question
- Keep score and tell them at the end
- Make it fun and encouraging!

Rules:
- Always be positive and encouraging, never discouraging
- If a student is struggling, simplify your explanation
- Use emojis occasionally to keep things fun 😊
- Keep responses clear and not too long
- If asked about a book, reference the actual books in the library${booksContext}`;

        // Call Groq API
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                max_tokens: 1024,
                temperature: 0.7,
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...history.map(h => ({ role: h.role, content: h.content })),
                    { role: 'user', content: message }
                ]
            })
        });

        if (!groqRes.ok) {
            const err = await groqRes.text();
            throw new Error(`Groq API error: ${err}`);
        }

        const groqData = await groqRes.json();
        const response = groqData.choices[0].message.content;

        // Save to DB if userId provided
        if (userId && process.env.DATABASE_URL) {
            try {
                const sql = neon(process.env.DATABASE_URL);
                await sql`INSERT INTO chat_messages (user_id, role, content) VALUES (${userId}::uuid, 'user', ${message})`;
                await sql`INSERT INTO chat_messages (user_id, role, content) VALUES (${userId}::uuid, 'assistant', ${response})`;
            } catch (e) { /* skip if DB fails */ }
        }

        return { statusCode: 200, headers, body: JSON.stringify({ success: true, response }) };
    } catch (err) {
        console.error('Chat error:', err.message);
        return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
};
