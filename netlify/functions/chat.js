const { neon } = require('@neondatabase/serverless');

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
    
    if (event.httpMethod === 'POST') {
        try {
            const { message, userId } = JSON.parse(event.body);
            
            // Save user message
            await sql`
                INSERT INTO chat_messages (user_id, role, content)
                VALUES (${userId}, 'user', ${message})
            `;
            
            // Simple response logic (you can expand this)
            let response = "Thanks for your message! I'm AISHA, your AI tutor. How can I help you learn today?";
            
            if (message.toLowerCase().includes('quiz')) {
                response = "Great! I can help you with quizzes. What subject would you like to practice?";
            } else if (message.toLowerCase().includes('hello') || message.toLowerCase().includes('hi')) {
                response = "Hello! I'm AISHA! Ready to learn something new today?";
            } else if (message.toLowerCase().includes('math')) {
                response = "Math is fun! What topic would you like to explore? Algebra, Geometry, or Calculus?";
            } else if (message.toLowerCase().includes('physics')) {
                response = "Physics explains how the universe works! Want to learn about Newton's Laws or Quantum Physics?";
            }
            
            // Save assistant response
            await sql`
                INSERT INTO chat_messages (user_id, role, content)
                VALUES (${userId}, 'assistant', ${response})
            `;
            
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, response }) };
        } catch (err) {
            return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
        }
    }
    
    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not found' }) };
};
