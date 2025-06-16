export default async function handler(request, response) {
    const channelId = request.query.channel;

    if (!channelId) {
        return response.status(400).json({ error: 'Channel username is required' });
    }

    // This securely gets the bot token you will set up in Vercel.
    // The token is NOT in the code.
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const MESSAGE_LIMIT = 10; // Get the 10 most recent messages

    const url = `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=-${MESSAGE_LIMIT}&chat_id=${channelId}`;

    try {
        const apiResponse = await fetch(url);
        if (!apiResponse.ok) {
            const errorData = await apiResponse.json();
            return response.status(apiResponse.status).json({ error: errorData.description || 'Failed to fetch from Telegram.' });
        }
        const data = await apiResponse.json();

        const messages = data.result
            .filter(update => update.channel_post && update.channel_post.text)
            .map(update => ({
                text: update.channel_post.text,
                date: new Date(update.channel_post.date * 1000).toUTCString(),
            }))
            .slice(-MESSAGE_LIMIT)
            .reverse();

        response.status(200).json(messages);

    } catch (error) {
        response.status(500).json({ error: 'The serverless function encountered an error.' });
    }
}