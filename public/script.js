// Your channels (removed breachdetector as requested)
const channels = [
    {
        name: 'MBS Rsi98',
        username: 'MBSRsi98',
        container: 'mbsrsi98-container'
    },
    {
        name: 'N12 Chat',
        username: 'N12chat',
        container: 'n12chat-container'
    },
    {
        name: 'News IL 2022',
        username: 'newsil2022',
        container: 'newsil2022-container'
    },
    {
        name: 'Kodkod News IL',
        username: 'kodkod_news_il',
        container: 'kodkod-container'
    },
    {
        name: 'Real Time Security',
        username: 'Realtimesecurity1',
        container: 'realtimesecurity-container'
    },
    {
        name: 'Abu Ali Express',
        username: 'abualiexpress',
        container: 'abuali-container'
    }
];

// OPTIMIZATION: Caching system
const messageCache = new Map();
const translationCache = new Map();
const CACHE_DURATION = 6 * 60 * 1000; // 6 minutes cache
const TRANSLATION_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours for translations
const MAX_CACHE_SIZE = 100; // Prevent memory issues

// Translation state for each channel
const channelTranslationState = {};

// OPTIMIZATION: Reduced rate limiting for better performance
const rateLimitTracker = {
    requests: [],
    maxRequests: 20, // Reduced from 30
    isAllowed() {
        const now = Date.now();
        const oneMinuteAgo = now - 60000;
        
        // Clean old requests
        this.requests = this.requests.filter(time => time > oneMinuteAgo);
        
        // Check if under limit
        if (this.requests.length >= this.maxRequests) {
            return false;
        }
        
        this.requests.push(now);
        return true;
    }
};

// OPTIMIZATION: Cache management
function cleanupCache() {
    const now = Date.now();
    
    // Clean message cache
    for (const [key, value] of messageCache.entries()) {
        if (now - value.timestamp > CACHE_DURATION) {
            messageCache.delete(key);
        }
    }
    
    // Clean translation cache
    for (const [key, value] of translationCache.entries()) {
        if (now - value.timestamp > TRANSLATION_CACHE_DURATION) {
            translationCache.delete(key);
        }
    }
    
    // Limit cache size
    if (messageCache.size > MAX_CACHE_SIZE) {
        const oldestKeys = Array.from(messageCache.keys()).slice(0, messageCache.size - MAX_CACHE_SIZE);
        oldestKeys.forEach(key => messageCache.delete(key));
    }
    
    if (translationCache.size > MAX_CACHE_SIZE) {
        const oldestKeys = Array.from(translationCache.keys()).slice(0, translationCache.size - MAX_CACHE_SIZE);
        oldestKeys.forEach(key => translationCache.delete(key));
    }
}

// Run cache cleanup every 10 minutes
setInterval(cleanupCache, 10 * 60 * 1000);

// SECURITY: Input validation
function validateChannelUsername(username) {
    if (!username || typeof username !== 'string') {
        return false;
    }
    
    // Only allow alphanumeric characters and underscores
    const validPattern = /^[a-zA-Z0-9_]+$/;
    if (!validPattern.test(username)) {
        return false;
    }
    
    // Check against allowed channels
    const allowedChannels = ['MBSRsi98', 'N12chat', 'newsil2022', 'kodkod_news_il', 'Realtimesecurity1', 'abualiexpress'];
    return allowedChannels.includes(username);
}

// SECURITY: Enhanced HTML sanitization (but preserve newlines)
function sanitizeText(text) {
    if (!text || typeof text !== 'string') {
        return '';
    }
    
    // Remove potentially dangerous content but preserve basic formatting
    const cleanText = text
        .replace(/<script[^>]*>.*?<\/script>/gi, '')
        .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
        .replace(/<object[^>]*>.*?<\/object>/gi, '')
        .replace(/<embed[^>]*>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .replace(/vbscript:/gi, '');
    
    return cleanText;
}

// SECURITY: Safe HTML escaping that preserves newlines for display
function escapeHtml(text) {
    if (!text) return '';
    
    const div = document.createElement('div');
    div.textContent = sanitizeText(text);
    return div.innerHTML.replace(/\n/g, '<br>');
}

// SECURITY: Safe DOM manipulation for translation-friendly content
function safeSetInnerHTML(element, htmlContent) {
    if (!element || !htmlContent) return;
    
    // For translation content, be less aggressive with sanitization
    if (element.classList.contains('translated-text') || element.classList.contains('announcements-container')) {
        element.innerHTML = htmlContent;
        return;
    }
    
    // Create a temporary div to parse HTML safely
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    
    // Remove any potentially dangerous elements
    const dangerousElements = tempDiv.querySelectorAll('script, iframe, object, embed, link, style');
    dangerousElements.forEach(el => el.remove());
    
    // Remove dangerous attributes but preserve data attributes needed for translation
    const allElements = tempDiv.querySelectorAll('*');
    allElements.forEach(el => {
        const attributes = [...el.attributes];
        attributes.forEach(attr => {
            if ((attr.name.startsWith('on') || 
                attr.name === 'href' && attr.value.startsWith('javascript:') ||
                attr.name === 'src' && attr.value.startsWith('javascript:')) &&
                !attr.name.startsWith('data-')) {
                el.removeAttribute(attr.name);
            }
        });
    });
    
    element.innerHTML = tempDiv.innerHTML;
}

// SECURITY: Enhanced error handling
function handleError(error, context = '') {
    console.error(`Error in ${context}:`, error.message);
    
    // Don't expose sensitive information
    const sanitizedError = error.message.includes('fetch') 
        ? 'Network error occurred' 
        : 'An error occurred';
    
    return sanitizedError;
}

// OPTIMIZATION: Check if cache is fresh
function isCacheFresh(cacheEntry, duration = CACHE_DURATION) {
    return cacheEntry && (Date.now() - cacheEntry.timestamp < duration);
}

// OPTIMIZATION: Update cache indicators
function updateCacheIndicator(containerId, isFromCache) {
    const wrapper = document.querySelector(`#${containerId}`).closest('.channel-wrapper');
    if (!wrapper) return;
    
    let cacheIndicator = wrapper.querySelector('.cache-indicator');
    if (!cacheIndicator) {
        cacheIndicator = document.createElement('span');
        cacheIndicator.className = 'cache-indicator';
        const refreshInfo = wrapper.querySelector('.refresh-info');
        if (refreshInfo) {
            refreshInfo.appendChild(cacheIndicator);
        }
    }
    
    if (isFromCache) {
        cacheIndicator.textContent = ' (cached)';
        cacheIndicator.style.opacity = '0.7';
    } else {
        cacheIndicator.textContent = '';
    }
}

async function fetchChannelMessages(channelUsername, containerId, forceRefresh = false) {
    // SECURITY: Validate inputs
    if (!validateChannelUsername(channelUsername)) {
        console.error('Invalid channel username:', channelUsername);
        return;
    }
    
    const container = document.getElementById(containerId);
    if (!container) {
        console.error('Container not found:', containerId);
        return;
    }
    
    // OPTIMIZATION: Check cache first
    const cacheKey = channelUsername;
    const cached = messageCache.get(cacheKey);
    
    if (!forceRefresh && isCacheFresh(cached)) {
        console.log(`📋 Using cached data for @${channelUsername}`);
        
        // Store cached messages
        window[`${channelUsername}_messages`] = cached.data;
        
        // Display cached messages
        displayMessages(cached.data, container, channelUsername);
        
        // Update refresh time with cache indicator
        updateLastRefresh(containerId);
        updateCacheIndicator(containerId, true);
        return;
    }
    
    // OPTIMIZATION: Rate limiting check
    if (!rateLimitTracker.isAllowed()) {
        console.warn('Rate limit exceeded, using cache if available');
        if (cached) {
            window[`${channelUsername}_messages`] = cached.data;
            displayMessages(cached.data, container, channelUsername);
            updateCacheIndicator(containerId, true);
        }
        return;
    }
    
    try {
        console.log(`🔄 Fetching fresh data for @${channelUsername}...`);
        
        // Show loading state
        safeSetInnerHTML(container, '<div class="loading"><div class="spinner"></div><p>Loading messages...</p></div>');
        
        // SECURITY: Validate URL before making request
        const apiUrl = `/api/fetch-telegram?channel=${encodeURIComponent(channelUsername)}`;
        
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            // SECURITY: Timeout to prevent hanging requests
            signal: AbortSignal.timeout(15000)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        // SECURITY: Validate response data
        if (!Array.isArray(data)) {
            throw new Error('Invalid response format');
        }
        
        if (data.length === 0) {
            safeSetInnerHTML(container, '<div class="no-messages">📭 No recent messages found</div>');
            return;
        }
        
        // SECURITY: Validate and sanitize each message (but preserve original text for translation)
        const sanitizedMessages = data.map(msg => ({
            ...msg,
            text: sanitizeText(msg.text || ''), // Keep original text for translation
            originalText: msg.text || '', // Store unescaped version for translation
            id: String(msg.id || '').replace(/[^a-zA-Z0-9]/g, ''),
            channel: validateChannelUsername(msg.channel) ? msg.channel : channelUsername,
            dateISO: new Date(msg.dateISO).toISOString() // Validate date
        })).filter(msg => msg.text.length > 0);
        
        // OPTIMIZATION: Cache the results
        messageCache.set(cacheKey, {
            data: sanitizedMessages,
            timestamp: Date.now()
        });
        
        // Store sanitized messages
        window[`${channelUsername}_messages`] = sanitizedMessages;
        
        // Display messages
        displayMessages(sanitizedMessages, container, channelUsername);
        
        // Update last refresh time
        updateLastRefresh(containerId);
        updateCacheIndicator(containerId, false);
        
    } catch (error) {
        const errorMessage = handleError(error, 'fetchChannelMessages');
        console.error(`Error fetching ${channelUsername}:`, error);
        
        // OPTIMIZATION: Fallback to cache on error
        if (cached) {
            console.log(`📋 Falling back to cached data for @${channelUsername}`);
            window[`${channelUsername}_messages`] = cached.data;
            displayMessages(cached.data, container, channelUsername);
            updateCacheIndicator(containerId, true);
            return;
        }
        
        const errorHtml = `
            <div class="error-message">
                <div class="error-icon">⚠️</div>
                <p class="error-title">Failed to load @${escapeHtml(channelUsername)}</p>
                <p class="error-details">${escapeHtml(errorMessage)}</p>
                <button onclick="fetchChannelMessages('${escapeHtml(channelUsername)}', '${escapeHtml(containerId)}', true)" class="retry-btn">
                    🔄 Try Again
                </button>
            </div>
        `;
        
        safeSetInnerHTML(container, errorHtml);
    }
}

function displayMessages(messages, container, channelUsername) {
    if (!Array.isArray(messages) || !container || !validateChannelUsername(channelUsername)) {
        return;
    }
    
    const isTranslated = channelTranslationState[channelUsername] || false;
    
    const messagesHtml = messages.map((message, index) => {
        // SECURITY: Validate message data
        if (!message || typeof message !== 'object') {
            return '';
        }
        
        // Format date using user's local timezone
        let localDate = 'Invalid date';
        try {
            const date = new Date(message.dateISO);
            if (!isNaN(date.getTime())) {
                localDate = date.toLocaleString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                });
            }
        } catch (e) {
            console.warn('Invalid date:', message.dateISO);
        }
        
        const messageId = String(message.id || index).replace(/[^a-zA-Z0-9]/g, '');
        const messageText = escapeHtml(message.text || '');
        const channelName = channelUsername;
        
        return `
        <div class="announcement-block" data-message-id="${messageId}">
            <div class="message-content">
                <div class="original-text ${isTranslated ? 'hidden' : ''}" data-original-text="${encodeURIComponent(message.originalText || message.text || '')}">
                    ${messageText}
                </div>
                <div class="translated-text ${isTranslated ? '' : 'hidden'}" data-translated="">
                    <div class="translation-loading">🔄 Translating...</div>
                </div>
            </div>
            <div class="message-footer">
                <span class="date">📅 ${localDate}</span>
                <div class="message-actions">
                    <div class="translate-dropdown">
                        <button class="translate-btn" onclick="toggleTranslateOptions(this)" 
                                title="Translate this message">
                            🌐
                        </button>
                        <div class="translate-options">
                            <button onclick="translateSingleMessage('${channelName}', ${index}, this, 'en')" 
                                    class="lang-option">🇺🇸 EN</button>
                            <button onclick="translateSingleMessage('${channelName}', ${index}, this, 'ar')" 
                                    class="lang-option">🇸🇦 AR</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        `;
    }).filter(html => html.length > 0).join('');
    
    safeSetInnerHTML(container, messagesHtml);
}

// Handle channel-level translation dropdown
function toggleChannelTranslateOptions(button) {
    if (!button || !button.closest) return;
    
    const dropdown = button.closest('.channel-translate-dropdown');
    if (!dropdown) return;
    
    const options = dropdown.querySelector('.channel-translate-options');
    if (!options) return;
    
    // Close all other channel dropdowns
    document.querySelectorAll('.channel-translate-options.show').forEach(opt => {
        if (opt !== options) opt.classList.remove('show');
    });
    
    options.classList.toggle('show');
}

// Handle individual message translation dropdown
function toggleTranslateOptions(button) {
    if (!button || !button.closest) return;
    
    const dropdown = button.closest('.translate-dropdown');
    if (!dropdown) return;
    
    const options = dropdown.querySelector('.translate-options');
    if (!options) return;
    
    // Close all other dropdowns
    document.querySelectorAll('.translate-options.show').forEach(opt => {
        if (opt !== options) opt.classList.remove('show');
    });
    
    options.classList.toggle('show');
}

// Close dropdowns when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.translate-dropdown') && !e.target.closest('.channel-translate-dropdown')) {
        document.querySelectorAll('.translate-options.show, .channel-translate-options.show').forEach(opt => {
            opt.classList.remove('show');
        });
    }
});

async function translateChannelMessages(channelUsername, button, targetLang = 'en') {
    // SECURITY: Validate inputs
    if (!validateChannelUsername(channelUsername) || !button) {
        return;
    }
    
    if (!['en', 'ar'].includes(targetLang)) {
        console.error('Invalid target language:', targetLang);
        return;
    }
    
    const container = document.getElementById(`${channelUsername.toLowerCase().replace(/[^a-z0-9]/g, '')}-container`);
    const messages = window[`${channelUsername}_messages`];
    
    if (!messages || !Array.isArray(messages)) return;
    
    // Close dropdown
    const dropdown = button.closest('.channel-translate-dropdown');
    if (dropdown) {
        const options = dropdown.querySelector('.channel-translate-options');
        if (options) options.classList.remove('show');
    }
    
    const mainButton = dropdown ? dropdown.querySelector('.translate-channel-btn') : button;
    const currentState = channelTranslationState[channelUsername];
    
    if (currentState && currentState.lang === targetLang) {
        // Switch back to original
        channelTranslationState[channelUsername] = null;
        container.querySelectorAll('.original-text').forEach(el => el.classList.remove('hidden'));
        container.querySelectorAll('.translated-text').forEach(el => el.classList.add('hidden'));
        mainButton.textContent = '🌐 Translate All';
        mainButton.classList.remove('translated');
        return;
    }
    
    // Start translation
    mainButton.textContent = '🔄 Translating...';
    mainButton.disabled = true;
    
    try {
        // Get original texts for translation
        const textsToTranslate = messages.map(msg => msg.originalText || msg.text || '');
        const translatedMessages = await translateMessages(textsToTranslate, targetLang);
        
        // Update display with translated messages
        translatedMessages.forEach((translatedText, index) => {
            if (index < messages.length) {
                const messageId = String(messages[index].id || index).replace(/[^a-zA-Z0-9]/g, '');
                const messageBlock = container.querySelector(`[data-message-id="${messageId}"]`);
                if (messageBlock) {
                    const originalDiv = messageBlock.querySelector('.original-text');
                    const translatedDiv = messageBlock.querySelector('.translated-text');
                    
                    if (originalDiv && translatedDiv) {
                        translatedDiv.innerHTML = escapeHtml(translatedText);
                        originalDiv.classList.add('hidden');
                        translatedDiv.classList.remove('hidden');
                    }
                }
            }
        });
        
        channelTranslationState[channelUsername] = { lang: targetLang };
        mainButton.textContent = '🔤 Show Original';
        mainButton.classList.add('translated');
        
    } catch (error) {
        const errorMessage = handleError(error, 'translateChannelMessages');
        console.error('Translation error:', error);
        mainButton.textContent = '❌ Translation Failed';
        setTimeout(() => {
            mainButton.textContent = '🌐 Translate All';
            mainButton.disabled = false;
        }, 2000);
    } finally {
        mainButton.disabled = false;
    }
}

async function translateSingleMessage(channelUsername, messageIndex, button, targetLang) {
    // SECURITY: Validate inputs
    if (!validateChannelUsername(channelUsername) || !button) {
        return;
    }
    
    if (!['en', 'ar'].includes(targetLang)) {
        console.error('Invalid target language:', targetLang);
        return;
    }
    
    const messages = window[`${channelUsername}_messages`];
    if (!messages || !Array.isArray(messages) || messageIndex < 0 || messageIndex >= messages.length) {
        return;
    }
    
    const messageBlock = button.closest('.announcement-block');
    if (!messageBlock) return;
    
    const originalDiv = messageBlock.querySelector('.original-text');
    const translatedDiv = messageBlock.querySelector('.translated-text');
    const translateBtn = messageBlock.querySelector('.translate-btn');
    
    if (!originalDiv || !translatedDiv || !translateBtn) return;
    
    // Close dropdown
    const options = button.closest('.translate-options');
    if (options) options.classList.remove('show');
    
    const isCurrentlyOriginal = !originalDiv.classList.contains('hidden');
    
    if (!isCurrentlyOriginal) {
        // Switch back to original
        originalDiv.classList.remove('hidden');
        translatedDiv.classList.add('hidden');
        translateBtn.textContent = '🌐';
        translateBtn.title = 'Translate this message';
        return;
    }
    
    // Check if already translated to this language
    const existingTranslation = translatedDiv.getAttribute(`data-translated-${targetLang}`);
    if (existingTranslation) {
        originalDiv.classList.add('hidden');
        translatedDiv.classList.remove('hidden');
        translatedDiv.innerHTML = decodeURIComponent(existingTranslation);
        
        const langFlag = targetLang === 'en' ? '🇺🇸' : '🇸🇦';
        translateBtn.textContent = langFlag;
        translateBtn.title = 'Show original';
        return;
    }
    
    // Translate
    translateBtn.textContent = '🔄';
    try {
        const originalText = decodeURIComponent(originalDiv.getAttribute('data-original-text') || '') || 
                           messages[messageIndex].originalText || 
                           messages[messageIndex].text || '';
        
        if (!originalText) {
            throw new Error('No text to translate');
        }
        
        const translatedText = await translateText(originalText, targetLang);
        const escapedTranslation = escapeHtml(translatedText);
        
        translatedDiv.setAttribute(`data-translated-${targetLang}`, encodeURIComponent(escapedTranslation));
        translatedDiv.innerHTML = escapedTranslation;
        originalDiv.classList.add('hidden');
        translatedDiv.classList.remove('hidden');
        
        const langFlag = targetLang === 'en' ? '🇺🇸' : '🇸🇦';
        translateBtn.textContent = langFlag;
        translateBtn.title = 'Show original';
        
    } catch (error) {
        const errorMessage = handleError(error, 'translateSingleMessage');
        console.error('Translation error:', error);
        translateBtn.textContent = '❌';
        setTimeout(() => {
            translateBtn.textContent = '🌐';
        }, 2000);
    }
}

async function translateMessages(messages, targetLang = 'en') {
    if (!Array.isArray(messages) || !['en', 'ar'].includes(targetLang)) {
        return [];
    }
    
    const translations = [];
    
    for (const messageText of messages) {
        try {
            if (messageText && typeof messageText === 'string') {
                const translated = await translateText(messageText, targetLang);
                translations.push(translated);
            } else {
                translations.push('');
            }
            // OPTIMIZATION: Longer delay to reduce API load
            await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
            console.error('Error translating message:', error);
            translations.push(messageText || ''); // Fallback to original
        }
    }
    
    return translations;
}

async function translateText(text, targetLang = 'en') {
    // SECURITY: Validate inputs
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return text || '';
    }
    
    if (!['en', 'ar'].includes(targetLang)) {
        throw new Error('Invalid target language');
    }
    
    // SECURITY: Limit text length
    const maxLength = 5000;
    const textToTranslate = text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    
    // OPTIMIZATION: Check translation cache
    const cacheKey = `${textToTranslate}-${targetLang}`;
    const cached = translationCache.get(cacheKey);
    
    if (isCacheFresh(cached, TRANSLATION_CACHE_DURATION)) {
        console.log('📋 Using cached translation');
        return cached.data;
    }
    
    try {
        // Using Google Translate API through a proxy service
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(textToTranslate)}`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; TranslateBot/1.0)'
            },
            signal: AbortSignal.timeout(10000) // 10 second timeout
        });
        
        if (!response.ok) {
            throw new Error(`Translation service error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data && Array.isArray(data) && data[0] && Array.isArray(data[0])) {
            const translatedText = data[0]
                .filter(item => Array.isArray(item) && item[0])
                .map(item => item[0])
                .join('');
            
            // OPTIMIZATION: Cache the translation
            translationCache.set(cacheKey, {
                data: translatedText || textToTranslate,
                timestamp: Date.now()
            });
            
            return translatedText || textToTranslate;
        }
        
        throw new Error('Invalid translation response');
    } catch (error) {
        console.error('Translation API error:', error);
        return textToTranslate; // Return original if translation fails
    }
}

function updateLastRefresh(containerId) {
    if (!containerId || typeof containerId !== 'string') return;
    
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const wrapper = container.closest('.channel-wrapper');
    if (!wrapper) return;
    
    let refreshInfo = wrapper.querySelector('.refresh-info');
    
    if (!refreshInfo) {
        refreshInfo = document.createElement('span');
        refreshInfo.className = 'refresh-info';
        const header = wrapper.querySelector('.channel-header');
        if (header) {
            header.appendChild(refreshInfo);
        }
    }
    
    const now = new Date();
    refreshInfo.textContent = `Updated: ${now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
}

// OPTIMIZATION: Auto-refresh functionality with longer intervals
let refreshInterval;
let isRefreshing = false;

function startAutoRefresh() {
    if (refreshInterval) clearInterval(refreshInterval);
    
    // OPTIMIZATION: 8 minutes interval
    refreshInterval = setInterval(async () => {
        if (isRefreshing || document.hidden) return;
        
        console.log('🔄 Auto-refreshing channels...');
        isRefreshing = true;
        
        try {
            for (const channel of channels) {
                if (validateChannelUsername(channel.username)) {
                    await fetchChannelMessages(channel.username, channel.container);
                    // OPTIMIZATION: Longer delay between requests
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
        } catch (error) {
            console.error('Auto-refresh error:', error);
        } finally {
            isRefreshing = false;
        }
    }, 8 * 60 * 1000); // Every 8 minutes
}

function stopAutoRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }
}

async function refreshAll(forceRefresh = false) {
    if (isRefreshing) return;
    
    const refreshBtn = document.getElementById('refresh-all-btn');
    if (refreshBtn) {
        refreshBtn.disabled = true;
        refreshBtn.innerHTML = '<div class="btn-spinner"></div> Refreshing...';
    }
    
    isRefreshing = true;
    
    try {
        for (const channel of channels) {
            if (validateChannelUsername(channel.username)) {
                await fetchChannelMessages(channel.username, channel.container, forceRefresh);
                // OPTIMIZATION: Longer delay between requests
                await new Promise(resolve => setTimeout(resolve, 1500));
            }
        }
    } catch (error) {
        console.error('Refresh all error:', error);
    } finally {
        isRefreshing = false;
        if (refreshBtn) {
            refreshBtn.disabled = false;
            refreshBtn.innerHTML = '🔄 Refresh All';
        }
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Initializing News Feed...');
    
    // Add loading animation to page
    document.body.classList.add('loading-app');
    
    try {
        // Load initial messages
        for (const channel of channels) {
            if (validateChannelUsername(channel.username)) {
                await fetchChannelMessages(channel.username, channel.container);
                // OPTIMIZATION: Longer delay during initialization
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    } catch (error) {
        console.error('Initialization error:', error);
    } finally {
        document.body.classList.remove('loading-app');
    }
    
    // Start auto-refresh
    startAutoRefresh();
    
    // Handle page visibility changes
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            console.log('Page hidden, stopping auto-refresh');
        } else {
            console.log('Page visible, starting auto-refresh');
            startAutoRefresh();
        }
    });
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    stopAutoRefresh();
});

// Add swipe-to-refresh for mobile
let startY = 0;
let isAtTop = true;

document.addEventListener('touchstart', (e) => {
    if (e.touches && e.touches[0]) {
        startY = e.touches[0].clientY;
        isAtTop = window.scrollY === 0;
    }
});

document.addEventListener('touchmove', (e) => {
    if (!isAtTop || !e.touches || !e.touches[0]) return;
    
    const currentY = e.touches[0].clientY;
    const pullDistance = currentY - startY;
    
    if (pullDistance > 100 && !isRefreshing) {
        // Add visual feedback
        document.body.classList.add('pull-to-refresh');
    }
});

document.addEventListener('touchend', (e) => {
    document.body.classList.remove('pull-to-refresh');
    
    if (!isAtTop || !e.changedTouches || !e.changedTouches[0]) return;
    
    const currentY = e.changedTouches[0].clientY;
    const pullDistance = currentY - startY;
    
    if (pullDistance > 100 && !isRefreshing) {
        refreshAll(true); // Force refresh on manual pull
    }
});

// SECURITY: Global error handler
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    // Don't expose sensitive information
    event.preventDefault();
});

// SECURITY: Unhandled promise rejection handler
window.addEventListener('unhandled rejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    event.preventDefault();
});
