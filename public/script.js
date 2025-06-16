// Your exact channels from the Telegram web links
const channels = [
    {
        name: 'Breach Detector',
        username: 'breachdetector',
        container: 'breachdetector-container'
    },
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

async function fetchChannelMessages(channelUsername, containerId) {
    const container = document.getElementById(containerId);
    
    try {
        console.log(`Fetching messages for @${channelUsername}...`);
        
        // Show loading state
        container.innerHTML = '<p class="loading">📡 Loading messages...</p>';
        
        const response = await fetch(`/api/fetch-telegram?channel=${channelUsername}`);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to fetch messages');
        }
        
        if (!data || data.length === 0) {
            container.innerHTML = '<p class="no-messages">📭 No recent messages found</p>';
            return;
        }
        
        // Display messages
        container.innerHTML = data.map(message => `
            <div class="announcement-block">
                <div class="message-content">
                    ${escapeHtml(message.text)}
                </div>
                <div class="message-footer">
                    <span class="date">📅 ${message.date}</span>
                    <a href="${message.url}" target="_blank" class="view-link">
                        📱 View Original
                    </a>
                </div>
            </div>
        `).join('');
        
        // Update last refresh time
        updateLastRefresh(containerId);
        
    } catch (error) {
        console.error(`Error fetching ${channelUsername}:`, error);
        container.innerHTML = `
            <div class="error-message">
                <p>⚠️ Error loading @${channelUsername}</p>
                <p class="error-details">${error.message}</p>
                <button onclick="fetchChannelMessages('${channelUsername}', '${containerId}')" class="retry-btn">
                    🔄 Retry
                </button>
            </div>
        `;
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
        refreshInfo = document.createElement('div');
        refreshInfo.className = 'refresh-info';
        wrapper.querySelector('h2').appendChild(refreshInfo);
    }
    
    const now = new Date();
    refreshInfo.innerHTML = ` <span class="last-update">Last: ${now.toLocaleTimeString()}</span>`;
}

// Auto-refresh functionality
let refreshInterval;
let isRefreshing = false;

function startAutoRefresh() {
    if (refreshInterval) clearInterval(refreshInterval);
    
    refreshInterval = setInterval(async () => {
        if (isRefreshing) return;
        
        console.log('🔄 Auto-refreshing channels...');
        isRefreshing = true;
        
        try {
            // Refresh channels one by one to avoid rate limiting
            for (const channel of channels) {
                await fetchChannelMessages(channel.username, channel.container);
                // Wait 1 second between channels
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        } finally {
            isRefreshing = false;
        }
    }, 3 * 60 * 1000); // Every 3 minutes
}

function stopAutoRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }
}

// Manual refresh all channels
async function refreshAll() {
    if (isRefreshing) return;
    
    const refreshBtn = document.getElementById('refresh-all-btn');
    if (refreshBtn) {
        refreshBtn.disabled = true;
        refreshBtn.textContent = '🔄 Refreshing...';
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
            refreshBtn.textContent = '🔄 Refresh All';
        }
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Initializing Israel News Feed...');
    
    // Load initial messages
    for (const channel of channels) {
        await fetchChannelMessages(channel.username, channel.container);
        // Small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Start auto-refresh
    startAutoRefresh();
    
    // Handle page visibility changes
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            stopAutoRefresh();
        } else {
            startAutoRefresh();
        }
    });
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    stopAutoRefresh();
});
