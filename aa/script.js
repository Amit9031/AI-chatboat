class VoiceChatbot {
    constructor() {
        this.recognition = null;
        this.synthesis = window.speechSynthesis;
        this.isListening = false;
        this.apiKey = 'AIzaSyDRaVJAIzdpuvms242NBB9ZX3aycYLsxVw';
        this.apiEndpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
        this.voiceEnabled = true;
        
        // Initialize speech recognition
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            this.recognition = new (window.webkitSpeechRecognition || window.SpeechRecognition)();
            this.setupSpeechRecognition();
        } else {
            console.error('Speech recognition not supported');
        }

        this.setupEventListeners();
        this.addWelcomeMessage();
        this.setupDashboard();
        this.setupVoiceControls();

        // Test API connection on startup
        this.testApiConnection();

        // Load voices when they are available
        if (this.synthesis.onvoiceschanged !== undefined) {
            this.synthesis.onvoiceschanged = () => {
                const voices = this.synthesis.getVoices();
                if (voices.length > 0) {
                    this.showToast(`${voices.length} voices available`, 'info');
                }
            };
        }

        // Voice Changer Functionality
        const voiceOptions = document.querySelectorAll('.voice-option');
        let currentVoice = 'male';

        voiceOptions.forEach(option => {
            option.addEventListener('click', () => {
                // Remove active class from all options
                voiceOptions.forEach(opt => opt.classList.remove('active'));
                
                // Add active class to clicked option
                option.classList.add('active');
                
                // Update current voice
                currentVoice = option.dataset.voice;
                
                // Play sound effect
                playSound('click');
                
                // Show toast notification
                showToast(`Voice changed to ${currentVoice}`);
            });
        });
    }

    async testApiConnection() {
        try {
            console.log('Testing API connection...');
            const response = await this.getAIResponse("Hello, can you hear me?");
            if (response.success) {
                console.log("API connection successful");
                this.showToast("AI service connected successfully", "info");
            } else {
                console.error("API test failed:", response.error);
                this.showToast(`API test failed: ${response.error}`, "error");
            }
        } catch (error) {
            console.error("API test failed:", error);
            this.showToast(`API test failed: ${error.message}`, "error");
        }
    }

    async getAIResponse(message) {
        try {
            const requestBody = {
                contents: [{
                    parts: [{
                        text: `[Current Date: ${new Date().toLocaleDateString()}] ${message}`
                    }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 1024,
                },
                safetySettings: [
                    {
                        category: "HARM_CATEGORY_HARASSMENT",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    },
                    {
                        category: "HARM_CATEGORY_HATE_SPEECH",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    },
                    {
                        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    },
                    {
                        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    }
                ]
            };

            console.log('Sending request to API with key:', this.apiKey);
            console.log('Request body:', JSON.stringify(requestBody, null, 2));

            const response = await fetch(`${this.apiEndpoint}?key=${this.apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            });

            console.log('API Response status:', response.status);
            console.log('API Response headers:', response.headers);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('API Error Response:', errorText);
                this.showToast(`API Error: ${response.status} ${response.statusText}`, 'error');
                return {
                    success: false,
                    error: `API Error: ${response.status} ${response.statusText} - ${errorText}`
                };
            }

            const data = await response.json();
            console.log('API Response data:', JSON.stringify(data, null, 2));

            if (data.candidates && data.candidates[0] && data.candidates[0].content) {
                const responseText = data.candidates[0].content.parts[0].text;
                console.log('Generated response:', responseText);
                return {
                    success: true,
                    text: responseText + `\n\n[Information retrieved on: ${new Date().toLocaleString()}]`
                };
            } else {
                console.error('Invalid API response format:', data);
                this.showToast('Invalid response format from AI service', 'error');
                return {
                    success: false,
                    error: 'Invalid API response format'
                };
            }
        } catch (error) {
            console.error('API Request failed:', error);
            this.showToast(`API Request failed: ${error.message}`, 'error');
            return {
                success: false,
                error: error.message
            };
        }
    }

    setupDashboard() {
        // Theme toggle
        const themeToggle = document.getElementById('theme-toggle');
        themeToggle.addEventListener('click', () => this.toggleTheme());

        // Navigation
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.switchTab(link.dataset.tab);
            });
        });

        // Mobile menu
        const mobileMenuBtn = document.getElementById('mobile-menu-btn');
        const sidebar = document.getElementById('sidebar');
        mobileMenuBtn.addEventListener('click', () => {
            sidebar.classList.toggle('active');
        });

        // Quick commands
        const commandBtns = document.querySelectorAll('.command-btn');
        commandBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const command = btn.dataset.command;
                this.handleQuickCommand(command);
            });
        });

        // Chat actions
        document.getElementById('clear-chat').addEventListener('click', () => this.showConfirmationModal('clear'));
        document.getElementById('download-chat').addEventListener('click', () => this.downloadChat());
        document.getElementById('share-chat').addEventListener('click', () => this.shareChat());

        // Auto-resize textarea
        const textarea = document.getElementById('user-input');
        textarea.addEventListener('input', () => {
            textarea.style.height = 'auto';
            textarea.style.height = textarea.scrollHeight + 'px';
        });
    }

    toggleTheme() {
        const html = document.documentElement;
        const isDark = html.getAttribute('data-theme') === 'dark';
        html.setAttribute('data-theme', isDark ? 'light' : 'dark');
        
        const icon = document.querySelector('#theme-toggle i');
        icon.className = isDark ? 'fas fa-moon' : 'fas fa-sun';
        
        this.showToast(`Switched to ${isDark ? 'light' : 'dark'} theme`);
    }

    switchTab(tabId) {
        // Hide all sections
        document.querySelectorAll('section').forEach(section => {
            section.classList.add('hidden');
        });
        
        // Show selected section
        document.getElementById(`${tabId}-section`).classList.remove('hidden');
        
        // Update active nav item
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabId}"]`).parentElement.classList.add('active');
    }

    handleQuickCommand(command) {
        const commandMessages = {
            weather: "What's the weather like in your location?",
            news: "Show me the latest news",
            translate: "What would you like to translate?",
            calculate: "What would you like to calculate?"
        };

        const message = commandMessages[command];
        if (message) {
            document.getElementById('user-input').value = message;
            this.sendMessage();
        }
    }

    showConfirmationModal(action) {
        const modal = document.getElementById('confirmation-modal');
        const message = document.getElementById('modal-message');
        const confirmBtn = modal.querySelector('.modal-confirm');
        const cancelBtn = modal.querySelector('.modal-cancel');

        message.textContent = 'Are you sure you want to clear all messages?';
        modal.removeAttribute('aria-hidden');

        confirmBtn.onclick = () => {
            if (action === 'clear') {
                this.clearChat();
            }
            modal.setAttribute('aria-hidden', 'true');
        };

        cancelBtn.onclick = () => {
            modal.setAttribute('aria-hidden', 'true');
        };
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;

        const container = document.getElementById('toast-container');
        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('show');
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }, 100);
    }

    clearChat() {
        const messages = document.getElementById('chat-messages');
        messages.innerHTML = '';
        this.addWelcomeMessage();
        this.showToast('Chat cleared successfully');
    }

    downloadChat() {
        const messages = document.getElementById('chat-messages');
        const text = Array.from(messages.children).map(msg => {
            const content = msg.querySelector('.message-content').textContent;
            return `${msg.classList.contains('user') ? 'You' : 'Bot'}: ${content}`;
        }).join('\n\n');

        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'chat-history.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showToast('Chat history downloaded');
    }

    shareChat() {
        if (navigator.share) {
            navigator.share({
                title: 'Chat with AI Assistant',
                text: 'Check out my conversation with the AI Assistant!',
                url: window.location.href
            })
            .then(() => this.showToast('Chat shared successfully'))
            .catch(() => this.showToast('Failed to share chat', 'error'));
        } else {
            this.showToast('Sharing is not supported on this device', 'warning');
        }
    }

    addWelcomeMessage() {
        const welcomeDiv = document.createElement('div');
        welcomeDiv.className = 'welcome-message';
        welcomeDiv.innerHTML = `
            <div class="welcome-icon">
                <i class="fas fa-robot"></i>
            </div>
            <h3>Welcome to your AI Assistant</h3>
            <p>How can I help you today?</p>
        `;
        document.getElementById('chat-messages').appendChild(welcomeDiv);
    }

    setupSpeechRecognition() {
        if (!this.recognition) return;

        // Configure recognition settings
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.lang = 'en-US';

        // Recognition start event
        this.recognition.onstart = () => {
            this.isListening = true;
            this.updateStatus('Listening...', true);
            const voiceBtn = document.getElementById('voice-btn');
            voiceBtn.classList.add('listening');
            voiceBtn.innerHTML = '<i class="fas fa-stop"></i>';
            this.showToast('Listening...', 'info');
        };

        // Recognition end event
        this.recognition.onend = () => {
            this.isListening = false;
            this.updateStatus('Online');
            const voiceBtn = document.getElementById('voice-btn');
            voiceBtn.classList.remove('listening');
            voiceBtn.innerHTML = '<i class="fas fa-microphone"></i>';
        };

        // Recognition result event
        this.recognition.onresult = (event) => {
            const last = event.results.length - 1;
            const text = event.results[last][0].transcript.trim();
            
            if (text) {
                document.getElementById('user-input').value = text;
                this.sendMessage();
            }
        };

        // Recognition error event
        this.recognition.onerror = (event) => {
            this.isListening = false;
            this.updateStatus('Error: ' + event.error);
            const voiceBtn = document.getElementById('voice-btn');
            voiceBtn.classList.remove('listening');
            voiceBtn.innerHTML = '<i class="fas fa-microphone"></i>';
            this.showToast('Error: ' + event.error, 'error');
        };
    }

    toggleVoiceRecognition() {
        if (!this.recognition) {
            this.showToast('Speech recognition is not supported in your browser', 'error');
            return;
        }

        if (this.isListening) {
            this.recognition.stop();
        } else {
            try {
                this.recognition.start();
            } catch (error) {
                if (error.name === 'NotAllowedError') {
                    this.showToast('Please allow microphone access to use voice input', 'error');
                } else {
                    this.showToast('Error starting voice recognition: ' + error.message, 'error');
                }
            }
        }
    }

    setupEventListeners() {
        // Voice button click event
        const voiceBtn = document.getElementById('voice-btn');
        voiceBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.toggleVoiceRecognition();
        });

        // Send button click event
        document.getElementById('send-btn').addEventListener('click', (e) => {
            e.preventDefault();
            this.sendMessage();
        });
        
        // Enter key press event
        const userInput = document.getElementById('user-input');
        userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Emoji and attachment buttons
        document.querySelector('.emoji-btn').addEventListener('click', () => {
            this.showToast('Emoji picker coming soon!', 'info');
        });

        document.querySelector('.attachment-btn').addEventListener('click', () => {
            this.showToast('File attachment coming soon!', 'info');
        });
    }

    updateStatus(message, isTyping = false) {
        const status = document.getElementById('status');
        status.textContent = message;
        status.className = isTyping ? 'typing' : '';
    }

    addMessage(text, isUser = false) {
        const messagesDiv = document.getElementById('chat-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isUser ? 'user' : 'bot'}`;
        
        if (!isUser) {
            const avatar = document.createElement('div');
            avatar.className = 'bot-avatar';
            avatar.textContent = 'AR';
            messageDiv.appendChild(avatar);
        }

        const content = document.createElement('div');
        content.className = 'message-content';

        // Apply word-by-word animation only for bot messages (API responses)
        if (!isUser) {
            content.classList.add('typing');
            const words = text.split(' ');
            words.forEach((word, index) => {
                const wordSpan = document.createElement('span');
                wordSpan.textContent = word + ' '; // Add space after each word
                wordSpan.style.setProperty('--word-index', index); // Set custom property for delay
                content.appendChild(wordSpan);
            });
            // Remove typing class after animation
            setTimeout(() => {
                content.classList.remove('typing');
            }, words.length * 200 + 300); // Total delay based on number of words
        } else {
            content.textContent = text; // Display user message as is
        }

        const timestamp = document.createElement('div');
        timestamp.className = 'timestamp';
        timestamp.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        messageDiv.appendChild(content);
        messageDiv.appendChild(timestamp);
        messagesDiv.appendChild(messageDiv);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    speak(text) {
        if (this.synthesis.speaking) {
            this.synthesis.cancel();
        }

        const utterance = new SpeechSynthesisUtterance(text);
        
        // Enhanced voice settings
        utterance.rate = 1.0;      // Speech rate (0.1 to 10)
        utterance.pitch = 1.1;     // Voice pitch (0 to 2)
        utterance.volume = 0.9;    // Volume (0 to 1)
        
        // Get available voices and set a preferred voice
        const voices = this.synthesis.getVoices();
        const preferredVoice = voices.find(voice => 
            voice.lang === 'en-US' && voice.name.includes('Female')
        ) || voices.find(voice => 
            voice.lang === 'en-US'
        ) || voices[0];
        
        if (preferredVoice) {
            utterance.voice = preferredVoice;
        }

        // Add voice events
        utterance.onstart = () => {
            this.showToast('Speaking...', 'info');
            document.getElementById('voice-btn').classList.add('speaking');
        };

        utterance.onend = () => {
            document.getElementById('voice-btn').classList.remove('speaking');
        };

        utterance.onerror = (event) => {
            this.showToast('Error in speech synthesis: ' + event.error, 'error');
            document.getElementById('voice-btn').classList.remove('speaking');
        };

        this.synthesis.speak(utterance);
    }

    // Add voice control methods
    setupVoiceControls() {
        // Voice toggle button
        const voiceToggle = document.createElement('button');
        voiceToggle.className = 'voice-toggle action-btn';
        voiceToggle.innerHTML = '<i class="fas fa-volume-up"></i>';
        voiceToggle.title = 'Toggle Voice Response';
        
        // Voice settings
        this.voiceEnabled = true;
        
        voiceToggle.addEventListener('click', () => {
            this.voiceEnabled = !this.voiceEnabled;
            voiceToggle.innerHTML = `<i class="fas fa-volume-${this.voiceEnabled ? 'up' : 'mute'}"></i>`;
            this.showToast(`Voice response ${this.voiceEnabled ? 'enabled' : 'disabled'}`, 'info');
        });
        
        // Add to chat actions
        const chatActions = document.querySelector('.chat-actions');
        chatActions.insertBefore(voiceToggle, chatActions.firstChild);
    }

    async processMessage(message) {
        const lowerMessage = message.toLowerCase();
        
        // Show typing indicator
        this.updateStatus('Assistant is thinking...', true);
        document.getElementById('typing-indicator').style.display = 'block';

        try {
            // Check for greeting
            if (lowerMessage === 'hi' || lowerMessage === 'hello') {
                return "Welcome to Amit Ranjan chatbot! How can I help you today?";
            }

            // First try the API
            const aiResponse = await this.getAIResponse(message);
            
            // Hide typing indicator
            document.getElementById('typing-indicator').style.display = 'none';
            this.updateStatus('Online');

            if (aiResponse.success) {
                return aiResponse.text;
            }

            // If API fails, use fallback responses
            console.warn('Using fallback response due to API failure:', aiResponse.error);
            
            // Fallback responses
            if (lowerMessage.includes('weather')) {
                return '🌤️ I am sorry, but I need your location to provide weather information. This feature will be available soon!';
            } else if (lowerMessage.includes('news')) {
                return '📰 I will be able to fetch the latest news for you soon. This feature is under development.';
            } else if (lowerMessage.includes('translate')) {
                return '🌐 Translation feature is coming soon! Please specify the text and target language when it\'s available.';
            } else if (lowerMessage.includes('calculate')) {
                return '🔢 I can help you with calculations. Please specify the mathematical expression.';
            } else if (lowerMessage.includes('thank')) {
                return '😊 You\'re welcome! Is there anything else you need help with?';
            } else {
                return '🤔 I understand you\'re trying to communicate. How can I assist you better?';
            }

        } catch (error) {
            console.error('Error in processMessage:', error);
            document.getElementById('typing-indicator').style.display = 'none';
            this.updateStatus('Error occurred');
            this.showToast('An error occurred while processing your message', 'error');
            return 'I apologize, but I encountered an error. Please try again.';
        }
    }

    // Add error handling method
    handleApiError(error) {
        console.error('API Error:', error);
        this.showToast('Error connecting to AI service. Please try again later.', 'error');
        this.updateStatus('Error');
        return '🚫 I apologize, but I\'m having trouble connecting to my AI service. Please try again later.';
    }

    async sendMessage() {
        const input = document.getElementById('user-input');
        const message = input.value.trim();
        
        if (message) {
            // Clear input and adjust height
            this.addMessage(message, true);
            input.value = '';
            input.style.height = 'auto';

            try {
                // Process message and get response
                const response = await this.processMessage(message);
                
                // Add response with slight delay for natural feel
                setTimeout(() => {
                    this.addMessage(response);
                    if (this.voiceEnabled) {
                        this.speak(response);
                    }
                }, 500);

            } catch (error) {
                console.error('Error in sendMessage:', error);
                this.showToast('Failed to process message', 'error');
                this.addMessage('I apologize, but something went wrong. Please try again.');
            }
        }
    }
}

// Initialize the chatbot when the page loads
window.addEventListener('DOMContentLoaded', () => {
    new VoiceChatbot();
});

// Function to get voice settings
function getVoiceSettings() {
    const voiceOptions = document.querySelectorAll('.voice-option');
    let currentVoice = 'male';

    voiceOptions.forEach(option => {
        if (option.classList.contains('active')) {
            currentVoice = option.dataset.voice;
        }
    });

    return {
        voice: currentVoice,
        // Add more voice settings here if needed
    };
}