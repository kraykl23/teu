// Channel configurations with their usernames
const channels = [
    {
        name: 'N12 Chat',
        username: 'N12Chat',  // Replace with actual username
        container: 'n12chat-container'
    },
    {
        name: 'Kodkod News IL',
        username: 'kodkodnews',  // Replace with actual username
        container: 'kodkod-container'
    },
    {
        name: 'Abu Ali Express',
        username: 'abualiexpress',  // Replace with actual username
        container: 'abuali-container'
    },
    {
        name: 'News IL 2022',
        username: 'newsil2022',  // Replace with actual username
        container: 'newsil-container'
    },
    {
        name: 'Real Time Security',
        username: 'realtimesecurity',  // Replace with actual username
        container: 'realtimesecurity-container'
    }
];

async function fetchChannelMessages(channelUsername, containerId) {
    const container = document.getElementById(containerId);
    
    try {
        console.log(`Fetching messages for ${channelUsername}...`);
        
        const response = await fetch(`/api/fetch-telegram?channel=${channelUsername}`);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to fetch messages');
        }
        
        if (!data || data.length === 0) {
            container.innerHTML = '<p class="error">No messages found for this channel.</p>';
            return;
        }
        
        // Display messages
        container.innerHTML = data.map(message => `
            <div class="announcement-block">
                <p>${escapeHtml(message.text)}</p>
                <div class="date">${message.date}</div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error(`Error fetching ${channelUsername}:`, error);
        container.innerHTML = `<p class="error">Error: ${error.message}</p>`;
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Load all channels when page loads
document.addEventListener('DOMContentLoaded', () => {
    channels.forEach(channel => {
        fetchChannelMessages(channel.username, channel.container);
    });
    
    // Refresh every 5 minutes
    setInterval(() => {
        channels.forEach(channel => {
            fetchChannelMessages(channel.username, channel.container);
        });
    }, 5 * 60 * 1000);
});
