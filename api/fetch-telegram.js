export default async function handler(request, response) {
    // Enable CORS for frontend requests
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (request.method === 'OPTIONS') {
        return response.status(200).end();
    }

    const channelUsername = request.query.channel;

    if (!channelUsername) {
        return response.status(400).json({ 
            error: 'Channel username is required. Use: /api/fetch-telegram?channel=channelname' 
        });
    }

    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    
    if (!BOT_TOKEN) {
        return response.status(500).json({ 
            error: 'Bot token not configured in Vercel environment variables' 
        });
    }

    try {
        console.log(`Fetching messages for channel: ${channelUsername}`);

        // First, get the chat ID for the channel
        const chatResponse = await fetch(
            `https://api.telegram.org/bot${BOT_TOKEN}/getChat?chat_id=@${channelUsername}`
        );
        
        if (!chatResponse.ok) {
            const chatError = await chatResponse.json();
            console.error('Chat error:', chatError);
            return response.status(400).json({ 
                error: `Cannot access channel @${channelUsername}. Make sure: 1) Channel username is correct, 2) Bot is added as admin to the channel, 3) Channel is public or bot has access. Details: ${chatError.description}` 
            });
        }
        
        const chatData = await chatResponse.json();
        const chatId = chatData.result.id;
        
        console.log(`Found chat ID: ${chatId} for @${channelUsername}`);

        // Get recent updates
        const updatesResponse = await fetch(
            `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?limit=100`
        );
        
        if (!updatesResponse.ok) {
            const updatesError = await updatesResponse.json();
            return response.status(updatesResponse.status).json({ 
                error: updatesError.description || 'Failed to fetch updates from Telegram' 
            });
        }
        
        const updatesData = await updatesResponse.json();
        
        // Filter messages from the specific channel
        const channelMessages = updatesData.result
            .filter(update => {
                return update.channel_post && 
                       update.channel_post.chat.id === chatId &&
                       (update.channel_post.text || update.channel_post.caption);
            })
            .map(update => {
                const post = update.channel_post;
                return {
                    id: post.message_id,
                    text: post.text || post.caption || '',
                    date: new Date(post.date * 1000).toLocaleString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZoneName: 'short'
                    }),
                    timestamp: post.date
                };
            })
            .sort((a, b) => b.timestamp - a.timestamp) // Most recent first
            .slice(0, 10); // Get latest 10 messages

        console.log(`Found ${channelMessages.length} messages for @${channelUsername}`);

        if (channelMessages.length === 0) {
            return response.status(200).json([]);
        }

        response.status(200).json(channelMessages);

    } catch (error) {
        console.error('Server error:', error);
        response.status(500).json({ 
            error: 'Internal server error. Check server logs for details.' 
        });
    }
}
