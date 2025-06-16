export default async function handler(request, response) {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (request.method === 'OPTIONS') {
        return response.status(200).end();
    }

    const channelUsername = request.query.channel;
    if (!channelUsername) {
        return response.status(400).json({ 
            error: 'Channel username is required' 
        });
    }

    try {
        console.log(`Scraping messages for channel: ${channelUsername}`);

        // Fetch the public channel page
        const channelUrl = `https://t.me/s/${channelUsername}`;
        const pageResponse = await fetch(channelUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        if (!pageResponse.ok) {
            if (pageResponse.status === 404) {
                return response.status(404).json({ 
                    error: `Channel @${channelUsername} not found or is private` 
                });
            }
            throw new Error(`HTTP ${pageResponse.status}: ${pageResponse.statusText}`);
        }

        const html = await pageResponse.text();
        
        // Parse the HTML to extract messages
        const messages = parseChannelMessages(html, channelUsername);
        
        console.log(`Found ${messages.length} messages for @${channelUsername}`);
        
        response.status(200).json(messages);

    } catch (error) {
        console.error('Scraping error:', error);
        response.status(500).json({ 
            error: `Failed to fetch channel: ${error.message}`
        });
    }
}

function parseChannelMessages(html, channelUsername) {
    const messages = [];
    
    try {
        // Extract message blocks using regex
        const messagePattern = /<div class="tgme_widget_message_wrap[^>]*>(.*?)<\/div>\s*(?=<div class="tgme_widget_message_wrap|<\/div>\s*<\/div>\s*<\/div>)/gs;
        const messageMatches = [...html.matchAll(messagePattern)];
        
        for (const match of messageMatches.slice(-15)) { // Get last 15 messages
            const messageHtml = match[1];
            
            // Extract message text
            const textMatch = messageHtml.match(/<div class="tgme_widget_message_text[^>]*>(.*?)<\/div>/s);
            let messageText = '';
            
            if (textMatch) {
                messageText = cleanHtmlText(textMatch[1]);
            }
            
            // If no text, check for media caption
            if (!messageText) {
                const captionMatch = messageHtml.match(/<div class="tgme_widget_message_caption[^>]*>(.*?)<\/div>/s);
                if (captionMatch) {
                    messageText = cleanHtmlText(captionMatch[1]);
                }
            }
            
            // Skip if no text content
            if (!messageText || messageText.trim().length === 0) {
                continue;
            }
            
            // Extract date/time and return ISO string for client-side formatting
            const dateMatch = messageHtml.match(/<time[^>]*datetime="([^"]*)"[^>]*>/);
            let dateStr = new Date().toISOString();
            
            if (dateMatch) {
                dateStr = dateMatch[1];
            }
            
            // Extract message ID
            const idMatch = messageHtml.match(/data-post="[^/]*\/(\d+)"/);
            const messageId = idMatch ? idMatch[1] : Math.random().toString(36).substr(2, 9);
            
            messages.push({
                id: messageId,
                text: messageText,
                dateISO: dateStr, // Send ISO string for client-side formatting
                timestamp: new Date(dateStr).getTime(),
                channel: channelUsername,
                url: `https://t.me/${channelUsername}/${messageId}`
            });
        }
        
        // Sort by timestamp (newest first) and limit to 10
        return messages
            .filter(msg => msg.text.length > 10) // Filter out very short messages
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 10);
            
    } catch (error) {
        console.error('Error parsing messages:', error);
        return [];
    }
}

function cleanHtmlText(html) {
    return html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<p[^>]*>/gi, '')
        .replace(/<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, '$2')
        .replace(/<strong[^>]*>([^<]*)<\/strong>/gi, '$1')
        .replace(/<em[^>]*>([^<]*)<\/em>/gi, '$1')
        .replace(/<[^>]*>/g, '')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
        .replace(/\s+/g, ' ')
        .trim();
}
