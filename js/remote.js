document.addEventListener('DOMContentLoaded', function() {
    // Theme management
    const themeManager = {
        currentTheme: 'default',
        themeButtons: document.querySelectorAll('.theme-btn'),
        
        init: function() {
            // Check if a theme preference is stored in localStorage
            const savedTheme = localStorage.getItem('remote-theme');
            if (savedTheme) {
                this.applyTheme(savedTheme);
            }
            
            // Add event listeners to theme buttons
            this.themeButtons.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const themeId = e.target.id.replace('theme-', '');
                    this.applyTheme(themeId);
                    
                    // Emit theme change event if socket is connected
                    if (remoteControl.socket && remoteControl.socket.connected) {
                        remoteControl.socket.emit('themeChanged', { theme: themeId });
                    }
                });
            });
        },
        
        applyTheme: function(theme) {
            // Remove all theme classes from body
            document.body.classList.remove('theme-mocha', 'theme-frappe');
            
            // Update active button state
            this.themeButtons.forEach(btn => {
                btn.classList.remove('active');
                if (btn.id === `theme-${theme}`) {
                    btn.classList.add('active');
                }
            });
            
            // Apply new theme if not default
            if (theme !== 'default') {
                document.body.classList.add(`theme-${theme}`);
            }
            
            // Save theme preference
            localStorage.setItem('remote-theme', theme);
            this.currentTheme = theme;
        }
    };
    
    // Remote control functionality
    const remoteControl = {
        // DOM elements
        prevSlideBtn: document.getElementById('prev-slide'),
        nextSlideBtn: document.getElementById('next-slide'),
        currentSlideSpan: document.getElementById('current-slide'),
        totalSlidesSpan: document.getElementById('total-slides'),
        currentSlideTitle: document.getElementById('current-slide-title'),
        statusIndicator: document.getElementById('status-indicator'),
        statusText: document.getElementById('status-text'),
        slideThumbnails: document.querySelectorAll('.slide-thumbnail'),
        noteSlides: document.querySelectorAll('.note-slide'),
        
        // Current state
        currentSlide: 1,
        totalSlides: 12, // Mis à jour pour refléter le nombre total de diapositives (incluant la nouvelle "À propos de moi")
        lastScrollTime: 0,
        scrollCooldown: 500, // Cooldown period in milliseconds to prevent accidental scroll navigation
        
        // Initialize the remote control
        init: function() {
            // Setup event listeners
            this.setupEventListeners();
            
            // Initialize Socket.io connection
            this.setupSocketConnection();
            
            // Initialize theme manager
            themeManager.init();

            // Prevent wheel events from affecting slide navigation
            this.preventScrollNavigation();
        },
        
        // Setup event listeners
        setupEventListeners: function() {
            // Navigation buttons
            this.prevSlideBtn.addEventListener('click', () => {
                this.sendCommand('prevSlide');
            });
            
            this.nextSlideBtn.addEventListener('click', () => {
                this.sendCommand('nextSlide');
            });
            
            // Slide thumbnails
            this.slideThumbnails.forEach(thumbnail => {
                thumbnail.addEventListener('click', () => {
                    const slideNumber = parseInt(thumbnail.dataset.slide, 10);
                    this.goToSlide(slideNumber);
                });
            });
            
            // Swipe detection for mobile
            let touchStartX = 0;
            let touchEndX = 0;
            let touchStartY = 0;
            let touchEndY = 0;
            
            document.addEventListener('touchstart', (e) => {
                touchStartX = e.changedTouches[0].screenX;
                touchStartY = e.changedTouches[0].screenY;
            }, false);
            
            document.addEventListener('touchend', (e) => {
                touchEndX = e.changedTouches[0].screenX;
                touchEndY = e.changedTouches[0].screenY;
                this.handleSwipe(touchStartX, touchEndX, touchStartY, touchEndY);
            }, false);
            
            this.handleSwipe = (startX, endX, startY, endY) => {
                const swipeThreshold = 50;
                const verticalMovement = Math.abs(endY - startY);
                const horizontalMovement = Math.abs(endX - startX);
                
                // Only treat as horizontal swipe if horizontal movement is greater than vertical
                // This prevents slide changes when user is trying to scroll vertically
                if (horizontalMovement > verticalMovement && horizontalMovement > swipeThreshold) {
                    if (endX < startX) {
                        // Swipe left
                        this.sendCommand('nextSlide');
                    } else if (endX > startX) {
                        // Swipe right
                        this.sendCommand('prevSlide');
                    }
                }
            };
        },
        
        // Prevent scroll events from triggering slide navigation
        preventScrollNavigation: function() {
            // Prevent mousewheel events from triggering slide navigation
            document.addEventListener('wheel', (e) => {
                // Do nothing - this prevents wheel events from being treated as navigation
                // We completely block wheel events from affecting slide navigation
                e.stopPropagation();
            }, { passive: false });
            
            // Add event listeners to specific scrollable areas to ensure they work as expected
            const scrollableElements = document.querySelectorAll('.slides-list, .speaker-notes');
            scrollableElements.forEach(element => {
                element.addEventListener('wheel', (e) => {
                    // Allow default scrolling behavior in scrollable containers
                    // but prevent it from triggering slide navigation
                    e.stopPropagation();
                }, { passive: true });
            });
        },
        
        // Setup Socket.io connection
        setupSocketConnection: function() {
            // For a real application, you would use your server URL
            const serverUrl = window.location.hostname + ':3000';
            
            try {
                // Create socket connection
                this.socket = io(serverUrl);
                
                // Socket event handlers
                this.socket.on('connect', () => {
                    console.log('Connected to server as remote');
                    this.statusIndicator.classList.add('connected');
                    this.statusText.textContent = 'Connecté au serveur';
                    
                    // Register as remote control
                    this.socket.emit('register', { type: 'remote' });
                });
                
                this.socket.on('disconnect', () => {
                    console.log('Disconnected from server');
                    this.statusIndicator.classList.remove('connected');
                    this.statusText.textContent = 'Déconnecté du serveur';
                });
                
                // Receive slide changes from presentation
                this.socket.on('slideChanged', (data) => {
                    this.updateSlideInfo(data);
                });
                
                // Receive theme changes from presentation
                this.socket.on('themeChanged', (data) => {
                    themeManager.applyTheme(data.theme);
                });
                
                this.socket.on('presentationConnected', () => {
                    console.log('Presentation connected');
                    this.statusText.textContent = 'Connecté à la présentation';
                    
                    // Request current slide info
                    this.socket.emit('getSlideInfo');
                });
                
                this.socket.on('presentationDisconnected', () => {
                    console.log('Presentation disconnected');
                    this.statusText.textContent = 'Présentation déconnectée';
                });
                
            } catch (error) {
                console.error('Failed to connect to socket server:', error);
                this.statusText.textContent = 'Erreur de connexion au serveur';
            }
        },
        
        // Update slide info on the remote control
        updateSlideInfo: function(data) {
            this.currentSlide = data.currentSlide;
            this.totalSlides = data.totalSlides;
            
            // Update UI
            this.currentSlideSpan.textContent = data.currentSlide;
            this.totalSlidesSpan.textContent = data.totalSlides;
            this.currentSlideTitle.textContent = data.slideTitle;
            
            // Update active thumbnail
            this.slideThumbnails.forEach(thumbnail => {
                const slideNum = parseInt(thumbnail.dataset.slide, 10);
                thumbnail.classList.toggle('active', slideNum === data.currentSlide);
            });
            
            // Update visible note
            this.noteSlides.forEach(note => {
                const slideNum = parseInt(note.dataset.slide, 10);
                note.style.display = slideNum === data.currentSlide ? 'block' : 'none';
            });
        },
        
        // Send command to presentation
        sendCommand: function(command, data = {}) {
            // Add cooldown check for scroll-triggered commands
            const now = Date.now();
            if (now - this.lastScrollTime < this.scrollCooldown) {
                return; // Ignore command if within cooldown period
            }
            
            this.lastScrollTime = now;
            
            if (this.socket && this.socket.connected) {
                this.socket.emit(command, data);
            } else {
                console.warn('Not connected to presentation');
                this.statusText.textContent = 'Non connecté à la présentation';
                
                // Attempt reconnect
                if (this.socket) {
                    this.socket.connect();
                }
            }
        },
        
        // Go to specific slide
        goToSlide: function(slideNumber) {
            this.sendCommand('goToSlide', { slide: slideNumber });
        }
    };
    
    // Make remoteControl available globally
    window.remoteControl = remoteControl;
    
    // Initialize remote control
    remoteControl.init();
    
    // Fallback when Socket.io server is not available
    window.addEventListener('error', function(e) {
        if (e.message === "Failed to construct 'WebSocket'" || 
            e.message.includes('socket.io') || 
            e.message.includes('io is not defined')) {
            
            console.warn('Socket.io connection failed. Remote control requires a server to function.');
            
            const statusIndicator = document.getElementById('status-indicator');
            const statusText = document.getElementById('status-text');
            
            statusIndicator.classList.remove('connected');
            statusText.textContent = 'Serveur non disponible';
            
            // Show offline message
            const offlineMessage = document.createElement('div');
            offlineMessage.className = 'offline-message';
            offlineMessage.innerHTML = `
                <div class="alert alert-warning" role="alert">
                    <h4><i class="fas fa-exclamation-triangle"></i> Serveur non disponible</h4>
                    <p>Pour utiliser la télécommande, vous devez démarrer le serveur Socket.io sur le port 3000.</p>
                    <p>Instructions:</p>
                    <ol>
                        <li>Installez Node.js</li>
                        <li>Installez Socket.io: <code>npm install socket.io</code></li>
                        <li>Créez un fichier server.js avec le code de configuration du serveur</li>
                        <li>Lancez le serveur: <code>node server.js</code></li>
                    </ol>
                </div>
            `;
            document.querySelector('.remote-container').appendChild(offlineMessage);
            
            e.preventDefault();
        }
    }, true);
});