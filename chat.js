// === KONEKSI KE SUPABASE ===
const SUPABASE_URL = "https://sjdytaaatjndhgjfsxfc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqZHl0YWFhdGpuZGhnamZzeGZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1NzI2NDIsImV4cCI6MjA3NTE0ODY0Mn0.-EYx3sDrtfdJAweZO_V_gPHyD-Cqdg6YczuaXzl2J1E";
const { createClient } = window.supabase;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// === ELEMEN DOM ===
const messagesArea = document.getElementById('messagesArea');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const charCount = document.getElementById('charCount');
const messageCount = document.getElementById('messageCount');
const messageLimitInfo = document.getElementById('messageLimitInfo');
const ipInfo = document.getElementById('ipInfo');
const onlineCount = document.getElementById('onlineCount');
const infoBtn = document.getElementById('infoBtn');
const infoModal = document.getElementById('infoModal');
const closeInfo = document.getElementById('closeInfo');

// === VARIABEL GLOBAL ===
let currentUser = null;
let isSubscribed = false;
let userIP = null;
let todaysMessageCount = 0;
const MAX_MESSAGES_PER_DAY = 50;
let messageCleanupInterval = null;

// === INISIALISASI ===
document.addEventListener('DOMContentLoaded', async () => {
    await initializeChat();
    setupEventListeners();
    await loadMessages();
    subscribeToMessages();
    startMessageCleanupChecker();
});

// === DAPATKAN IP PENGUNJUNG ===
async function getUserIP() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip;
    } catch (error) {
        console.error('Error getting IP:', error);
        return 'unknown_' + Math.random().toString(36).substr(2, 8);
    }
}

// === INISIALISASI CHAT ===
async function initializeChat() {
    // Dapatkan IP pengguna
    userIP = await getUserIP();
    
    // Generate user ID berdasarkan IP
    const userId = 'user_' + userIP.replace(/[^a-zA-Z0-9]/g, '_');
    
    // Generate nama pengguna acak berdasarkan IP (agar konsisten)
    const usernames = ['Kultivator', 'Pencari Tao', 'Dewa Muda', 'Immortal', 'Xianxia Fan', 'Cultivation Lover'];
    const seed = userIP.split('.').reduce((a, b) => a + parseInt(b), 0);
    const randomName = usernames[seed % usernames.length] + '_' + userIP.split('.').pop();
    
    currentUser = {
        id: userId,
        name: randomName,
        avatar: '👤',
        ip: userIP
    };
    
    // Update IP info di UI
    if (ipInfo) {
        ipInfo.textContent = `IP: ${userIP}`;
    }
    
    // Hitung pesan hari ini
    await countTodaysMessages();
    updateMessageLimitUI();
    
    console.log('User initialized:', currentUser);
}

// === HITUNG PESAN HARI INI ===
async function countTodaysMessages() {
    try {
        const today = new Date().toISOString().split('T')[0];
        const { data: messages, error } = await supabase
            .from('chat_messages')
            .select('id', { count: 'exact' })
            .eq('user_ip', userIP)
            .gte('created_at', today + 'T00:00:00Z')
            .lt('created_at', today + 'T23:59:59Z');
            
        if (error) throw error;
        
        todaysMessageCount = messages ? messages.length : 0;
        
    } catch (error) {
        console.error('Error counting messages:', error);
        todaysMessageCount = 0;
    }
}

// === UPDATE UI BATAS PESAN ===
function updateMessageLimitUI() {
    if (!messageCount) return;
    
    messageCount.textContent = `${todaysMessageCount}/${MAX_MESSAGES_PER_DAY} pesan hari ini`;
    
    // Update warna berdasarkan jumlah pesan
    if (todaysMessageCount >= MAX_MESSAGES_PER_DAY) {
        messageLimitInfo.classList.add('danger');
        messageLimitInfo.classList.remove('warning');
    } else if (todaysMessageCount >= MAX_MESSAGES_PER_DAY * 0.8) {
        messageLimitInfo.classList.add('warning');
        messageLimitInfo.classList.remove('danger');
    } else {
        messageLimitInfo.classList.remove('warning', 'danger');
    }
}

// === SETUP EVENT LISTENERS ===
function setupEventListeners() {
    // Input message events
    messageInput.addEventListener('input', updateCharCount);
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    messageInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });
    
    sendBtn.addEventListener('click', sendMessage);
    
    // Info modal events
    infoBtn.addEventListener('click', toggleInfoModal);
    closeInfo.addEventListener('click', toggleInfoModal);
    
    // Close modal when clicking outside
    infoModal.addEventListener('click', (e) => {
        if (e.target === infoModal) {
            toggleInfoModal();
        }
    });
    
    // Focus input ketika halaman dimuat
    setTimeout(() => {
        if (todaysMessageCount < MAX_MESSAGES_PER_DAY) {
            messageInput.focus();
        }
    }, 500);
}

// === UPDATE CHARACTER COUNT ===
function updateCharCount() {
    const count = messageInput.value.length;
    charCount.textContent = `${count}/500`;
    
    if (count > 450) {
        charCount.style.color = '#ff4757';
    } else if (count > 400) {
        charCount.style.color = '#ffa502';
    } else {
        charCount.style.color = '#999';
    }
    
    sendBtn.disabled = count === 0 || count > 500 || todaysMessageCount >= MAX_MESSAGES_PER_DAY;
}

// === KIRIM PESAN ===
async function sendMessage() {
    if (todaysMessageCount >= MAX_MESSAGES_PER_DAY) {
        showSystemMessage(`Anda telah mencapai batas ${MAX_MESSAGES_PER_DAY} pesan per hari.`);
        return;
    }
    
    const content = messageInput.value.trim();
    
    if (!content || !currentUser) return;
    
    // Disable input sementara
    messageInput.disabled = true;
    sendBtn.disabled = true;
    
    try {
        const { data, error } = await supabase
            .from('chat_messages')
            .insert([
                {
                    user_id: currentUser.id,
                    user_name: currentUser.name,
                    user_avatar: currentUser.avatar,
                    user_ip: currentUser.ip,
                    content: content,
                    timestamp: new Date().toISOString()
                }
            ]);
            
        if (error) throw error;
        
        // Update counter
        todaysMessageCount++;
        updateMessageLimitUI();
        
        // Clear input dan reset height
        messageInput.value = '';
        messageInput.style.height = 'auto';
        updateCharCount();
        
    } catch (error) {
        console.error('Error sending message:', error);
        showSystemMessage('❌ Gagal mengirim pesan. Silakan coba lagi.');
        
    } finally {
        messageInput.disabled = false;
        if (todaysMessageCount < MAX_MESSAGES_PER_DAY) {
            messageInput.focus();
        }
    }
}

// === LOAD MESSAGES ===
async function loadMessages() {
    try {
        // Hapus pesan yang lebih dari 24 jam
        await deleteOldMessages();
        
        // Load pesan dari 24 jam terakhir
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        
        const { data: messages, error } = await supabase
            .from('chat_messages')
            .select('*')
            .gte('created_at', twentyFourHoursAgo)
            .order('created_at', { ascending: true });
            
        if (error) throw error;
        
        displayMessages(messages || []);
        
    } catch (error) {
        console.error('Error loading messages:', error);
        showSystemMessage('❌ Gagal memuat pesan. Silakan refresh halaman.');
    }
}

// === HAPUS PESAN LAMA ===
async function deleteOldMessages() {
    try {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        
        const { error } = await supabase
            .from('chat_messages')
            .delete()
            .lt('created_at', twentyFourHoursAgo);
            
        if (error) throw error;
        
        console.log('Old messages cleaned up');
        
    } catch (error) {
        console.error('Error deleting old messages:', error);
    }
}

// === DISPLAY MESSAGES ===
function displayMessages(messages) {
    messagesArea.innerHTML = '';
    
    if (messages.length === 0) {
        const welcomeMsg = createWelcomeMessage();
        messagesArea.appendChild(welcomeMsg);
        return;
    }
    
    // Kelompokkan pesan berdasarkan pengguna dan waktu
    let lastUser = null;
    let lastTime = null;
    
    messages.forEach(message => {
        const isOwnMessage = currentUser && message.user_id === currentUser.id;
        const messageTime = new Date(message.timestamp);
        
        // Tampilkan pemisah waktu jika selisih > 5 menit
        if (lastTime && (messageTime - lastTime) > 5 * 60 * 1000) {
            const timeDivider = createTimeDivider(messageTime);
            messagesArea.appendChild(timeDivider);
        }
        
        // Tampilkan nama pengguna jika berbeda dari pesan sebelumnya
        const showSender = lastUser !== message.user_id || !lastUser;
        
        const messageElement = createMessageElement(message, isOwnMessage, showSender);
        messagesArea.appendChild(messageElement);
        
        lastUser = message.user_id;
        lastTime = messageTime;
    });
    
    scrollToBottom();
}

// === CREATE MESSAGE ELEMENT ===
function createMessageElement(message, isOwnMessage, showSender = true) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isOwnMessage ? 'own' : 'other'}`;
    
    const time = new Date(message.timestamp).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit'
    });
    
    messageDiv.innerHTML = `
        <div class="message-bubble">
            ${!isOwnMessage && showSender ? `
                <div class="message-header">
                    <span class="message-sender">${escapeHtml(message.user_name)}</span>
                </div>
            ` : ''}
            <div class="message-content">${escapeHtml(message.content)}</div>
            <div class="message-header">
                <span class="message-time">${time}</span>
            </div>
        </div>
    `;
    
    return messageDiv;
}

// === CREATE WELCOME MESSAGE ===
function createWelcomeMessage() {
    const welcomeDiv = document.createElement('div');
    welcomeDiv.className = 'system-message';
    welcomeDiv.innerHTML = `
        <p>Selamat datang di Obrolan Group Dunia Kultivator!</p>
        <small>Pesan akan otomatis terhapus setelah 24 jam</small>
        <div style="margin-top: 10px; font-size: 0.8rem;">
            <strong>Batas:</strong> ${MAX_MESSAGES_PER_DAY} pesan/hari per pengguna
        </div>
    `;
    return welcomeDiv;
}

// === CREATE SYSTEM MESSAGE ===
function showSystemMessage(content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message info';
    messageDiv.innerHTML = `
        <div class="message-bubble">
            <div class="message-content">${content}</div>
        </div>
    `;
    messagesArea.appendChild(messageDiv);
    scrollToBottom();
}

// === CREATE TIME DIVIDER ===
function createTimeDivider(time) {
    const dividerDiv = document.createElement('div');
    dividerDiv.className = 'message status';
    dividerDiv.innerHTML = `
        <div class="message-bubble">
            <div class="message-content">
                ${time.toLocaleDateString('id-ID', { 
                    day: 'numeric', 
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                })}
            </div>
        </div>
    `;
    return dividerDiv;
}

// === SUBSCRIBE TO REAL-TIME MESSAGES ===
function subscribeToMessages() {
    if (isSubscribed) return;
    
    const subscription = supabase
        .channel('chat-messages')
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'chat_messages'
            },
            async (payload) => {
                const newMessage = payload.new;
                
                // Jika pesan dari user ini, update counter
                if (currentUser && newMessage.user_ip === currentUser.ip) {
                    const today = new Date().toISOString().split('T')[0];
                    const messageDate = new Date(newMessage.timestamp).toISOString().split('T')[0];
                    
                    if (messageDate === today) {
                        todaysMessageCount++;
                        updateMessageLimitUI();
                    }
                }
                
                const isOwnMessage = currentUser && newMessage.user_id === currentUser.id;
                const messageElement = createMessageElement(newMessage, isOwnMessage, true);
                messagesArea.appendChild(messageElement);
                scrollToBottom();
            }
        )
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                isSubscribed = true;
                console.log('Subscribed to real-time messages');
            }
        });
}

// === START MESSAGE CLEANUP CHECKER ===
function startMessageCleanupChecker() {
    // Cek setiap 5 menit untuk menghapus pesan lama
    messageCleanupInterval = setInterval(async () => {
        await deleteOldMessages();
    }, 5 * 60 * 1000); // 5 menit
}

// === SCROLL TO BOTTOM ===
function scrollToBottom() {
    setTimeout(() => {
        messagesArea.scrollTop = messagesArea.scrollHeight;
    }, 100);
}

// === TOGGLE INFO MODAL ===
function toggleInfoModal() {
    infoModal.classList.toggle('active');
}

// === UPDATE ONLINE COUNT ===
function updateOnlineCount() {
    // Simulasi online count (dalam implementasi real, hitung dari database)
    const randomCount = Math.floor(Math.random() * 50) + 10;
    if (onlineCount) {
        onlineCount.textContent = randomCount;
    }
}

// === UTILITY FUNCTIONS ===
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// === CLEANUP ===
window.addEventListener('beforeunload', () => {
    if (messageCleanupInterval) {
        clearInterval(messageCleanupInterval);
    }
});

// Update online count setiap 30 detik
setInterval(updateOnlineCount, 30000);
updateOnlineCount();