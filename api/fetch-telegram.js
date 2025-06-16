// Whitelist of allowed channels - SECURITY IMPROVEMENT
const ALLOWED_CHANNELS = [
    'MBSRsi98', 'N12chat', 'newsil2022', 
    'kodkod_news_il', 'Realtimesecurity1', 'abualiexpress'
];

// Rate limiting store (in production, use Redis)
const rateLimitStore = new Map();

export default async function handler(request, response) {
    // SECURITY: Restrict CORS to your domain only
    const allowedOrigins = [
        'https://your-app-name.vercel.app',
        'http://localhost:3000' // for development
    ];
    
    const origin = request.headers.origin;
    if (allowedOrigins.includes(origin)) {
        response.setHeader('Access-Control-Allow-Origin', origin);
    }
    
    response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (request.method === 'OPTIONS') {
        return response.status(200).end();
    }

    if (request.method !== 'GET') {
        return response.status(405).json({ error: 'Method not allowed' });
    }

    // SECURITY: Rate limiting
    const clientIP = request.headers['x-forwarded-for'] || request.connection.remoteAddress;
    const now = Date.now();
    const rateLimit = rateLimitStore.get(clientIP) || { count: 0, resetTime: now };
    
    if (now > rateLimit.resetTime) {
        rateLimit.count = 0;
        rateLimit.resetTime = now + 60000; // 1 minute window
    }
    
    if (rateLimit.count >= 10) { // 10 requests per minute
        return response.status(429).json({ error: 'Rate limit exceeded' });
    }
    
    rateLimit.count++;
    rateLimitStore.set(clientIP, rateLimit);

    // SECURITY: Input validation
    const channelUsername = request.query.channel;
    if (!channelUsername) {
        return response.status(400).json({ error: 'Channel required' });
    }

    // SECURITY: Whitelist validation
    if (!ALLOWED_CHANNELS.includes(channelUsername)) {
        return response.status(403).json({ error: 'Channel not allowed' });
    }

    // SECURITY: Input sanitization
    const sanitizedChannel = channelUsername.replace(/[^a-zA-Z0-9_]/g, '');
    if (sanitizedChannel !== channelUsername) {
        return response.status(400).json({ error: 'Invalid channel format' });
    }

    try {
        // SECURITY: Controlled URL construction
        const channelUrl = `https://t.me/s/${sanitizedChannel}`;
        
        const pageResponse = await fetch(channelUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)'
            },
            // SECURITY: Timeout to prevent hanging requests
            signal: AbortSignal.timeout(10000) // 10 second timeout
        });

        if (!pageResponse.ok) {
            if (pageResponse.status === 404) {
                return response.status(404).json({ error: 'Channel not found' });
            }
            // SECURITY: Generic error message
            return response.status(500).json({ error: 'Service unavailable' });
        }

        const html = await pageResponse.text();
        
        // SECURITY: Limit response size
        if (html.length > 1000000) { // 1MB limit
            return response.status(413).json({ error: 'Response too large' });
        }
        
        const messages = parseChannelMessages(html, sanitizedChannel);
        
        response.status(200).json(messages);

    } catch (error) {
        console.error('Scraping error:', error.message); // Log without details
        // SECURITY: Generic error response
        response.status(500).json({ error: 'Service temporarily unavailable' });
    }
}

function parseChannelMessages(html, channelUsername) {
    const messages = [];
    
    try {
        const messagePattern = /<div class="tgme_widget_message_wrap[^>]*>(.*?)<\/div>\s*(?=<div class="tgme_widget_message_wrap|<\/div>\s*<\/div>\s*<\/div>)/gs;
        const messageMatches = [...html.matchAll(messagePattern)];
        
        for (const match of messageMatches.slice(-15)) {
            const messageHtml = match[1];
            
            const textMatch = messageHtml.match(/<div class="tgme_widget_message_text[^>]*>(.*?)<\/div>/s);
            let messageText = '';
            
            if (textMatch) {
                messageText = cleanHtmlText(textMatch[1]);
            }
            
            if (!messageText) {
                const captionMatch = messageHtml.match(/<div class="tgme_widget_message_caption[^>]*>(.*?)<\/div>/s);
                if (captionMatch) {
                    messageText = cleanHtmlText(captionMatch[1]);
                }
            }
            
            if (!messageText || messageText.trim().length === 0) {
                continue;
            }

            // SECURITY: Limit message length
            if (messageText.length > 5000) {
                messageText = messageText.substring(0, 5000) + '...';
            }
            
            const dateMatch = messageHtml.match(/<time[^>]*datetime="([^"]*)"[^>]*>/);
            let dateStr = new Date().toISOString();
            
            if (dateMatch) {
                dateStr = dateMatch[1];
                // SECURITY: Validate date format
                if (isNaN(new Date(dateStr).getTime())) {
                    dateStr = new Date().toISOString();
                }
            }
            
            const idMatch = messageHtml.match(/data-post="[^/]*\/(\d+)"/);
            const messageId = idMatch ? idMatch[1] : Math.random().toString(36).substr(2, 9);
            
            messages.push({
                id: messageId,
                text: messageText,
                dateISO: dateStr,
                timestamp: new Date(dateStr).getTime(),
                channel: channelUsername,
                url: `https://t.me/${channelUsername}/${messageId}`
            });
        }
        
        return messages
            .filter(msg => msg.text.length > 10)
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 10);
            
    } catch (error) {
        console.error('Error parsing messages:', error.message);
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
