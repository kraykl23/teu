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
    
    container.innerHTML = messages.map((message, index) => `
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
                <span class="date">📅 ${message.date}</span>
                <div class="message-actions">
                    <button class="translate-btn" onclick="translateSingleMessage('${channelUsername}', ${index}, this)" 
                            title="Translate this message">
                        🌐
                    </button>
                    <a href="${message.url}" target="_blank" class="view-link" title="View original">
                        📱
                    </a>
                </div>
            </div>
        </div>
    `).join('');
}

async function translateChannelMessages(channelUsername, button) {
    const container = document.getElementById(`${channelUsername.toLowerCase().replace(/[^a-z0-9]/g, '')}-container`);
    const messages = window[`${channelUsername}_messages`];
    
    if (!messages) return;
    
    const isCurrentlyTranslated = channelTranslationState[channelUsername];
    
    if (isCurrentlyTranslated) {
        // Switch back to original
        channelTranslationState[channelUsername] = false;
        container.querySelectorAll('.original-text').forEach(el => el.classList.remove('hidden'));
        container.querySelectorAll('.translated-text').forEach(el => el.classList.add('hidden'));
        button.innerHTML = '🌐 Translate All';
        button.classList.remove('translated');
        return;
    }
    
    // Start translation
    button.innerHTML = '🔄 Translating...';
    button.disabled = true;
    
    try {
        const translatedMessages = await translateMessages(messages);
        
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
        
        channelTranslationState[channelUsername] = true;
        button.innerHTML = '🔤 Show Original';
        button.classList.add('translated');
        
    } catch (error) {
        console.error('Translation error:', error);
        button.innerHTML = '❌ Translation Failed';
        setTimeout(() => {
            button.innerHTML = '🌐 Translate All';
            button.disabled = false;
        }, 2000);
    } finally {
        button.disabled = false;
    }
}

async function translateSingleMessage(channelUsername, messageIndex, button) {
    const messages = window[`${channelUsername}_messages`];
    if (!messages || !messages[messageIndex]) return;
    
    const messageBlock = button.closest('.announcement-block');
    const originalDiv = messageBlock.querySelector('.original-text');
    const translatedDiv = messageBlock.querySelector('.translated-text');
    
    const isCurrentlyOriginal = !originalDiv.classList.contains('hidden');
    
    if (!isCurrentlyOriginal) {
        // Switch back to original
        originalDiv.classList.remove('hidden');
        translatedDiv.classList.add('hidden');
        button.innerHTML = '🌐';
        button.title = 'Translate this message';
        return;
    }
    
    // Check if already translated
    const existingTranslation = translatedDiv.getAttribute('data-translated');
    if (existingTranslation) {
        originalDiv.classList.add('hidden');
        translatedDiv.classList.remove('hidden');
        translatedDiv.innerHTML = existingTranslation;
        button.innerHTML = '🔤';
        button.title = 'Show original';
        return;
    }
    
    // Translate
    button.innerHTML = '🔄';
    try {
        const originalText = messages[messageIndex].text;
        const translatedText = await translateText(originalText);
        
        translatedDiv.setAttribute('data-translated', escapeHtml(translatedText));
        translatedDiv.innerHTML = escapeHtml(translatedText);
        originalDiv.classList.add('hidden');
        translatedDiv.classList.remove('hidden');
        button.innerHTML = '🔤';
        button.title = 'Show original';
        
    } catch (error) {
        console.error('Translation error:', error);
        button.innerHTML = '❌';
        setTimeout(() => {
            button.innerHTML = '🌐';
        }, 2000);
    }
}

async function translateMessages(messages) {
    const translations = [];
    
    for (const message of messages) {
        try {
            const translated = await translateText(message.text);
            translations.push(translated);
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
            console.error('Error translating message:', error);
            translations.push(message.text); // Fallback to original
        }
    }
    
    return translations;
}

async function translateText(text) {
    // Using Google Translate API through a proxy service
    try {
        const response = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`);
        const data = await response.json();
        
        if (data && data[0] && data[0][0] && data[0][0][0]) {
            return data[0].map(item => item[0]).join('');
        }
        
        throw new Error('Translation failed');
    } catch (error) {
        console.error('Translation API error:', error);
        // Fallback to a simple replacement for common Hebrew/Arabic words (basic)
        return text; // Return original if translation fails
    }
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
    }, 4 * 60 * 1000); // Every 4 minutes
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
    console.log('🚀 Initializing Israel News Feed...');
    
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
        // Add visual feedback
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
