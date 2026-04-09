import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

export const handler = async (event) => {
    const { message, userId } = JSON.parse(event.body);
    
    // Smart pattern matching responses (FREE!)
    const lowerMessage = message.toLowerCase();
    
    let response = "";
    
    // Math questions
    if (lowerMessage.includes('algebra') || lowerMessage.includes('equation')) {
        response = "📐 Algebra is about solving for unknown values! For example: x + 5 = 10 means x = 5. Want to practice some equations together?";
    }
    else if (lowerMessage.includes('physics') || lowerMessage.includes('newton')) {
        response = "⚛️ Newton's First Law says an object stays at rest or moves unless a force acts on it! Think of a ball - it keeps rolling until friction stops it. Cool, right?";
    }
    else if (lowerMessage.includes('biology') || lowerMessage.includes('cell')) {
        response = "🧬 The cell is the basic unit of life! The mitochondria is the 'powerhouse' that gives cells energy. Want to learn more about how cells work?";
    }
    else if (lowerMessage.includes('chemistry') || lowerMessage.includes('atom')) {
        response = "🧪 Everything is made of tiny particles called atoms! Water is H2O - 2 hydrogen atoms and 1 oxygen atom. Amazing, isn't it?";
    }
    else if (lowerMessage.includes('quiz') || lowerMessage.includes('test')) {
        response = "📝 I'd love to quiz you! What subject would you like to practice? Math, Physics, Biology, or Chemistry?";
    }
    else if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
        response = "👋 Hello! I'm AISHA, your personal AI tutor. Ask me anything about your subjects, and I'll help you learn! What would you like to study today?";
    }
    else {
        // Try to find answer from uploaded books
        const searchTerm = message.split(' ').slice(0, 5).join(' ');
        const books = await sql`
            SELECT title, content FROM books 
            WHERE content ILIKE ${'%' + searchTerm + '%'} 
            LIMIT 1
        `;
        
        if (books.length > 0) {
            response = `📖 From "${books[0].title}":\n\n${books[0].content.substring(0, 300)}...\n\nWould you like me to explain this further?`;
        } else {
            response = "🤔 That's a great question! I'm still learning from your books. If you upload books on this topic, I can give you better answers. For now, would you like me to explain the basics?";
        }
    }
    
    // Store conversation (optional)
    await sql`
        INSERT INTO chat_messages (user_id, role, content)
        VALUES (${userId}, 'user', ${message})
    `;
    await sql`
        INSERT INTO chat_messages (user_id, role, content)
        VALUES (${userId}, 'assistant', ${response})
    `;
    
    return {
        statusCode: 200,
        body: JSON.stringify({ response, success: true })
    };
};
