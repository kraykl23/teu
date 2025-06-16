// Your channels
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

// Translation state for each channel
const channelTranslationState = {};

async function fetchChannelMessages(channelUsername, containerId) {
    const container = document.getElementById(containerId);
    
    try {
        console.log(`Fetching messages for @${channelUsername}...`);
        
        // Show loading state
        container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading messages...</p></div>';
        
        const response = await fetch(`/api/fetch-telegram?channel=${channelUsername}`);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to fetch messages');
        }
        
        if (!data || data.length === 0) {
            container.innerHTML = '<div class="no-messages">📭 No recent messages found</div>';
            return;
        }
        
        // Store original messages for translation
        window[`${channelUsername}_messages`] = data;
        
        // Display messages
        displayMessages(data, container, channelUsername);
        
        // Update last refresh time
        updateLastRefresh(containerId);
        
    } catch (error) {
        console.error(`Error fetching ${channelUsername}:`, error);
        container.innerHTML = `
            <div class="error-message">
                <div class="error-icon">⚠️</div>
                <p class="error-title">Failed to load @${channelUsername}</p>
                <p class="error-details">${error.message}</p>
                <button onclick="fetchChannelMessages('${channelUsername}', '${containerId}')" class="retry-btn">
                    🔄 Try Again
                </button>
            </div>
        `;
    }
}

function displayMessages(messages, container, channelUsername) {
    const isTranslated = channelTranslationState[channelUsername] || false;
    
    container.innerHTML = messages.map((message, index) => {
        // Format date using user's local timezone
        const date = new Date(message.dateISO);
        const localDate = date.toLocaleString([], {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
        
        return `
        <div class="announcement-block" data-message-id="${message.id}">
            <div class="message-content">
                <div class="original-text ${isTranslated ? 'hidden' : ''}" data-original="${escapeHtml(message.text)}">
                    ${escapeHtml(message.text)}
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
                            <button onclick="translateSingleMessage('${channelUsername}', ${index}, this, 'en')" 
                                    class="lang-option">🇺🇸 EN</button>
                            <button onclick="translateSingleMessage('${channelUsername}', ${index}, this, 'ar')" 
                                    class="lang-option">🇸🇦 AR</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    }).join('');
}

// Handle channel-level translation dropdown
function toggleChannelTranslateOptions(button) {
    const dropdown = button.closest('.channel-translate-dropdown');
    const options = dropdown.querySelector('.channel-translate-options');
    
    // Close all other channel dropdowns
    document.querySelectorAll('.channel-translate-options.show').forEach(opt => {
        if (opt !== options) opt.classList.remove('show');
    });
    
    options.classList.toggle('show');
}

// Handle individual message translation dropdown
function toggleTranslateOptions(button) {
    const dropdown = button.closest('.translate-dropdown');
    const options = dropdown.querySelector('.translate-options');
    
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
    console.log(`🔄 Translating all messages for ${channelUsername} to ${targetLang}`);
    
    const container = document.getElementById(`${channelUsername.toLowerCase().replace(/[^a-z0-9]/g, '')}-container`);
    const messages = window[`${channelUsername}_messages`];
    
    if (!messages) {
        console.error('No messages found for translation');
        return;
    }
    
    // Close dropdown
    const dropdown = button.closest('.channel-translate-dropdown');
    const options = dropdown.querySelector('.channel-translate-options');
    options.classList.remove('show');
    
    const mainButton = dropdown.querySelector('.translate-channel-btn');
    const currentState = channelTranslationState[channelUsername];
    
    if (currentState && currentState.lang === targetLang) {
        // Switch back to original
        channelTranslationState[channelUsername] = null;
        container.querySelectorAll('.original-text').forEach(el => el.classList.remove('hidden'));
        container.querySelectorAll('.translated-text').forEach(el => el.classList.add('hidden'));
        mainButton.innerHTML = `🌐 Translate All`;
        mainButton.classList.remove('translated');
        return;
    }
    
    // Start translation
    mainButton.innerHTML = '🔄 Translating...';
    mainButton.disabled = true;
    
    try {
        const translatedMessages = await translateMessages(messages, targetLang);
        
        // Update display with translated messages
        translatedMessages.forEach((translatedText, index) => {
            const messageBlock = container.querySelector(`[data-message-id="${messages[index].id}"]`);
            if (messageBlock) {
                const originalDiv = messageBlock.querySelector('.original-text');
                const translatedDiv = messageBlock.querySelector('.translated-text');
                
                translatedDiv.innerHTML = escapeHtml(translatedText);
                originalDiv.classList.add('hidden');
                translatedDiv.classList.remove('hidden');
            }
        });
        
        channelTranslationState[channelUsername] = { lang: targetLang };
        mainButton.innerHTML = `🔤 Show Original`;
        mainButton.classList.add('translated');
        
        console.log(`✅ Channel translation completed`);
        
    } catch (error) {
        console.error('Translation error:', error);
        mainButton.innerHTML = '❌ Translation Failed';
        setTimeout(() => {
            mainButton.innerHTML = '🌐 Translate All';
            mainButton.disabled = false;
        }, 2000);
    } finally {
        mainButton.disabled = false;
    }
}

async function translateSingleMessage(channelUsername, messageIndex, button, targetLang) {
    console.log(`🔄 Translating single message: ${channelUsername}[${messageIndex}] to ${targetLang}`);
    
    const messages = window[`${channelUsername}_messages`];
    if (!messages || !messages[messageIndex]) {
        console.error('Message not found for translation');
        return;
    }
    
    const messageBlock = button.closest('.announcement-block');
    const originalDiv = messageBlock.querySelector('.original-text');
    const translatedDiv = messageBlock.querySelector('.translated-text');
    const translateBtn = messageBlock.querySelector('.translate-btn');
    
    // Close dropdown
    button.closest('.translate-options').classList.remove('show');
    
    const isCurrentlyOriginal = !originalDiv.classList.contains('hidden');
    
    if (!isCurrentlyOriginal) {
        // Switch back to original
        originalDiv.classList.remove('hidden');
        translatedDiv.classList.add('hidden');
        translateBtn.innerHTML = '🌐';
        translateBtn.title = 'Translate this message';
        return;
    }
    
    // Check if already translated to this language
    const existingTranslation = translatedDiv.getAttribute(`data-translated-${targetLang}`);
    if (existingTranslation) {
        originalDiv.classList.add('hidden');
        translatedDiv.classList.remove('hidden');
        translatedDiv.innerHTML = existingTranslation;
        
        const langFlag = targetLang === 'en' ? '🇺🇸' : '🇸🇦';
        translateBtn.innerHTML = langFlag;
        translateBtn.title = 'Show original';
        return;
    }
    
    // Show loading state
    originalDiv.classList.add('hidden');
    translatedDiv.classList.remove('hidden');
    translatedDiv.innerHTML = '<div class="translation-loading">🔄 Translating...</div>';
    translateBtn.innerHTML = '🔄';
    
    try {
        const originalText = messages[messageIndex].text;
        console.log(`Translating: "${originalText.substring(0, 50)}..."`);
        
        const translatedText = await translateText(originalText, targetLang);
        
        const escapedTranslation = escapeHtml(translatedText);
        translatedDiv.setAttribute(`data-translated-${targetLang}`, escapedTranslation);
        translatedDiv.innerHTML = escapedTranslation;
        
        const langFlag = targetLang === 'en' ? '🇺🇸' : '🇸🇦';
        translateBtn.innerHTML = langFlag;
        translateBtn.title = 'Show original';
        
        console.log(`✅ Translation completed: "${translatedText.substring(0, 50)}..."`);
        
    } catch (error) {
        console.error('Translation error:', error);
        
        // Show error and revert
        translatedDiv.innerHTML = `<div style="color: #ef4444;">❌ Translation failed</div>`;
        translateBtn.innerHTML = '❌';
        
        setTimeout(() => {
            originalDiv.classList.remove('hidden');
            translatedDiv.classList.add('hidden');
            translateBtn.innerHTML = '🌐';
        }, 3000);
    }
}

async function translateMessages(messages, targetLang = 'en') {
    const translations = [];
    
    for (const message of messages) {
        try {
            const translated = await translateText(message.text, targetLang);
            translations.push(translated);
            // Small delay to avoid overwhelming the API
            await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
            console.error('Error translating message:', error);
            translations.push(message.text); // Fallback to original
        }
    }
    
    return translations;
}

// WORKING TRANSLATION FUNCTION using LibreTranslate (free, no CORS issues)
async function translateText(text, targetLang = 'en') {
    if (!text || text.trim().length === 0) {
        return text;
    }
    
    // Limit text length for better performance
    const maxLength = 500;
    const textToTranslate = text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    
    try {
        console.log(`🔄 Translating to ${targetLang}: "${textToTranslate.substring(0, 30)}..."`);
        
        // Using LibreTranslate API (free and supports CORS)
        const response = await fetch('https://libretranslate.de/translate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                q: textToTranslate,
                source: 'auto', // Auto-detect source language
                target: targetLang,
                format: 'text'
            })
        });
        
        if (!response.ok) {
            throw new Error(`Translation API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data && data.translatedText) {
            console.log(`✅ Translation successful`);
            return data.translatedText;
        } else {
            throw new Error('Invalid translation response');
        }
        
    } catch (error) {
        console.error('Translation API error:', error);
        
        // Fallback: Simple word replacements for common terms
        return applyFallbackTranslation(textToTranslate, targetLang);
    }
}

// Fallback translation for common words/phrases
function applyFallbackTranslation(text, targetLang) {
    if (targetLang === 'en') {
        const hebrewToEnglish = {
            'שלום': 'hello/peace',
            'תודה': 'thank you',
            'בוקר טוב': 'good morning',
            'לילה טוב': 'good night',
            'כן': 'yes',
            'לא': 'no',
            'מה שלומך': 'how are you',
            'ביטחון': 'security',
            'חדשות': 'news',
            'צהל': 'IDF',
            'ישראל': 'Israel',
            'פלסטין': 'Palestine',
            'עזה': 'Gaza',
            'חמאס': 'Hamas',
            'צרפת': 'France',
            'ארצות הברית': 'United States',
            'ירושלים': 'Jerusalem',
            'תל אביב': 'Tel Aviv'
        };
        
        const arabicToEnglish = {
            'السلام عليكم': 'peace be upon you',
            'شكرا': 'thank you',
            'صباح الخير': 'good morning',
            'تصبح على خير': 'good night',
            'نعم': 'yes',
            'لا': 'no',
            'أمن': 'security',
            'أخبار': 'news',
            'إسرائيل': 'Israel',
            'فلسطين': 'Palestine',
            'غزة': 'Gaza',
            'حماس': 'Hamas',
            'القدس': 'Jerusalem'
        };
        
        let translatedText = text;
        
        // Apply Hebrew translations
        for (const [hebrew, english] of Object.entries(hebrewToEnglish)) {
            translatedText = translatedText.replace(new RegExp(hebrew, 'gi'), `[${english}]`);
        }
        
        // Apply Arabic translations
        for (const [arabic, english] of Object.entries(arabicToEnglish)) {
            translatedText = translatedText.replace(new RegExp(arabic, 'gi'), `[${english}]`);
        }
        
        if (translatedText !== text) {
            return `[Partial Translation] ${translatedText}`;
        }
    }
    
    return `[Translation unavailable] ${text}`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/\n/g, '<br>');
}

function updateLastRefresh(containerId) {
    const wrapper = document.querySelector(`#${containerId}`).closest('.channel-wrapper');
    let refreshInfo = wrapper.querySelector('.refresh-info');
    
    if (!refreshInfo) {
        refreshInfo = document.createElement('span');
        refreshInfo.className = 'refresh-info';
        wrapper.querySelector('.channel-header').appendChild(refreshInfo);
    }
    
    const now = new Date();
    refreshInfo.textContent = `Updated: ${now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
}

// Auto-refresh functionality
let refreshInterval;
let isRefreshing = false;

function startAutoRefresh() {
    if (refreshInterval) clearInterval(refreshInterval);
    
    refreshInterval = setInterval(async () => {
        if (isRefreshing || document.hidden) return;
        
        console.log('🔄 Auto-refreshing channels...');
        isRefreshing = true;
        
        try {
            for (const channel of channels) {
                await fetchChannelMessages(channel.username, channel.container);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
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

async function refreshAll() {
    if (isRefreshing) return;
    
    const refreshBtn = document.getElementById('refresh-all-btn');
    if (refreshBtn) {
        refreshBtn.disabled = true;
        refreshBtn.innerHTML = '<div class="btn-spinner"></div> Refreshing...';
    }
    
    isRefreshing = true;
    
    try {
        for (const channel of channels) {
            await fetchChannelMessages(channel.username, channel.container);
            await new Promise(resolve => setTimeout(resolve, 800));
        }
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
            await fetchChannelMessages(channel.username, channel.container);
            await new Promise(resolve => setTimeout(resolve, 600));
        }
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
    startY = e.touches[0].clientY;
    isAtTop = window.scrollY === 0;
});

document.addEventListener('touchmove', (e) => {
    if (!isAtTop) return;
    
    const currentY = e.touches[0].clientY;
    const pullDistance = currentY - startY;
    
    if (pullDistance > 100 && !isRefreshing) {
        document.body.classList.add('pull-to-refresh');
    }
});

document.addEventListener('touchend', (e) => {
    document.body.classList.remove('pull-to-refresh');
    
    if (!isAtTop) return;
    
    const currentY = e.changedTouches[0].clientY;
    const pullDistance = currentY - startY;
    
    if (pullDistance > 100 && !isRefreshing) {
        refreshAll();
    }
});
