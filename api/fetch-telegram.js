// Corrected File: api/fetch-telegram.js

// This uses the 'module.exports' syntax which is more broadly compatible.
module.exports = async (request, response) => {
    const channelId = request.query.channel;

    if (!channelId) {
        return response.status(400).json({ error: 'Channel username is required' });
    }

    // This securely gets the bot token you set up in Vercel.
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const MESSAGE_LIMIT = 10; // Get the 10 most recent messages

    // If the BOT_TOKEN is missing, stop immediately and show an error.
    if (!BOT_TOKEN) {
        console.error("TELEGRAM_BOT_TOKEN is not set in Vercel Environment Variables.");
        return response.status(500).json({ error: 'Server configuration error: Missing API Token.' });
    }

    const url = `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=-${MESSAGE_LIMIT}&chat_id=${channelId}`;

    try {
        const apiResponse = await fetch(url);
        const data = await apiResponse.json();

        // Check if Telegram returned an error (e.g., chat not found)
        if (!data.ok) {
            console.error(`Telegram API Error for channel ${channelId}:`, data.description);
            return response.status(404).json({ error: data.description });
        }

        const messages = data.result
            .filter(update => update.channel_post && update.channel_post.text)
            .map(update => ({
                text: update.channel_post.text,
                date: new Date(update.channel_post.date * 1000).toUTCString(),
            }))
            .slice(-MESSAGE_LIMIT)
            .reverse();

        // Set caching headers to tell browsers (and Vercel) to cache the response for 5 minutes (300 seconds)
        response.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
        
        response.status(200).json(messages);

    } catch (error) {
        console.error('Catch Block Error:', error);
        response.status(500).json({ error: 'The serverless function encountered an exception.' });
    }
};
