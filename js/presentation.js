document.addEventListener('DOMContentLoaded', function() {
    // Theme management
    const themeManager = {
        currentTheme: 'default',
        themeButtons: document.querySelectorAll('.theme-btn'),
        
        init: function() {
            // Check if a theme preference is stored in localStorage
            const savedTheme = localStorage.getItem('presentation-theme');
            if (savedTheme) {
                this.applyTheme(savedTheme);
            }
            
            // Add event listeners to theme buttons
            this.themeButtons.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const themeId = e.target.id.replace('theme-', '');
                    this.applyTheme(themeId);
                    
                    // Emit theme change event if socket is connected
                    if (presentation.socket && presentation.socket.connected) {
                        presentation.socket.emit('themeChanged', { theme: themeId });
                    }
                });
            });
        },
        
        applyTheme: function(theme) {
            // Suppression de tous les thèmes possibles
            document.body.classList.remove('theme-mocha', 'theme-frappe', 'theme-latte');
            
            // Force une mise à jour du DOM
            void document.body.offsetWidth;
            
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
                
                // Force un repaint pour appliquer immédiatement les styles
                document.documentElement.style.display = 'none';
                void document.documentElement.offsetHeight; // Déclenche un reflow
                document.documentElement.style.display = '';
            }
            
            // Save theme preference
            localStorage.setItem('presentation-theme', theme);
            this.currentTheme = theme;
            
            // Mise à jour des couleurs d'interface immédiatement
            document.dispatchEvent(new Event('themeChanged'));
        }
    };
    
    // UI Controls Visibility Manager
    const uiVisibilityManager = {
        uiElements: [],
        mouseMoveTimer: null,
        inactivityTimeout: 5000, // 5 seconds
        
        init: function() {
            // Get UI elements
            this.uiElements = [
                document.querySelector('.theme-switcher'),
                document.querySelector('.controls'),
                document.querySelector('.connection-status')
            ];
            
            // Add ui-element class to all elements
            this.uiElements.forEach(element => {
                if (element) element.classList.add('ui-element');
            });
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Initial show
            this.showUIElements();
            
            // Start inactivity timer
            this.resetInactivityTimer();
        },
        
        setupEventListeners: function() {
            // Mouse movement detection
            document.addEventListener('mousemove', () => {
                this.showUIElements();
                this.resetInactivityTimer();
            });
            
            // Also show on touch for mobile devices
            document.addEventListener('touchstart', () => {
                this.showUIElements();
                this.resetInactivityTimer();
            });
            
            // Show on key press
            document.addEventListener('keydown', () => {
                this.showUIElements();
                this.resetInactivityTimer();
            });
        },
        
        showUIElements: function() {
            this.uiElements.forEach(element => {
                if (element) element.classList.remove('hidden');
            });
        },
        
        hideUIElements: function() {
            this.uiElements.forEach(element => {
                if (element) element.classList.add('hidden');
            });
        },
        
        resetInactivityTimer: function() {
            // Clear existing timer
            if (this.mouseMoveTimer) {
                clearTimeout(this.mouseMoveTimer);
            }
            
            // Set new timer
            this.mouseMoveTimer = setTimeout(() => {
                this.hideUIElements();
            }, this.inactivityTimeout);
        }
    };
    
    // Initialize presentation
    const presentation = {
        slides: Array.from(document.querySelectorAll('.slide')),
        currentSlideIndex: 0,
        totalSlides: 0,
        
        // DOM elements
        prevBtn: document.getElementById('prev-btn'),
        nextBtn: document.getElementById('next-btn'),
        slideNumber: document.getElementById('slide-number'),
        loadingScreen: document.getElementById('loading-screen'),
        statusIndicator: document.getElementById('status-indicator'),
        statusText: document.getElementById('status-text'),
        
        // Initialize presentation
        init: function() {
            this.totalSlides = this.slides.length;
            this.showSlide(this.currentSlideIndex);
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Hide loading screen
            setTimeout(() => {
                this.loadingScreen.classList.add('hidden');
            }, 1500);
            
            // Initialize Socket.io for remote control
            this.setupSocketConnection();
            
            // Initialize theme manager
            themeManager.init();
            
            // Initialize UI visibility manager
            uiVisibilityManager.init();
        },
        
        // Setup event listeners
        setupEventListeners: function() {
            this.prevBtn.addEventListener('click', () => this.previousSlide());
            this.nextBtn.addEventListener('click', () => this.nextSlide());
            
            // Keyboard navigation
            document.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowRight' || e.key === ' ') {
                    this.nextSlide();
                } else if (e.key === 'ArrowLeft') {
                    this.previousSlide();
                }
            });
            
            // Touch swipe navigation
            let touchStartX = 0;
            let touchEndX = 0;
            
            document.addEventListener('touchstart', (e) => {
                touchStartX = e.changedTouches[0].screenX;
            }, false);
            
            document.addEventListener('touchend', (e) => {
                touchEndX = e.changedTouches[0].screenX;
                this.handleSwipe();
            }, false);
            
            this.handleSwipe = () => {
                // Minimum swipe distance required (px)
                const swipeThreshold = 50;
                
                if (touchEndX < touchStartX - swipeThreshold) {
                    // Swipe left, go to next slide
                    this.nextSlide();
                } else if (touchEndX > touchStartX + swipeThreshold) {
                    // Swipe right, go to previous slide
                    this.previousSlide();
                }
            };
        },
        
        // Show a specific slide
        showSlide: function(index) {
            // Hide all slides
            this.slides.forEach(slide => slide.classList.remove('active'));
            
            // Show current slide
            this.slides[index].classList.add('active');
            
            // Update slide number
            this.slideNumber.textContent = `${index + 1}/${this.totalSlides}`;
            
            // Update current index
            this.currentSlideIndex = index;
            
            // Emit slide change event if socket is connected
            if (this.socket && this.socket.connected) {
                this.socket.emit('slideChanged', {
                    currentSlide: index + 1,
                    totalSlides: this.totalSlides,
                    slideTitle: this.getSlideTitle(index)
                });
            }
        },
        
        // Get the title of a slide
        getSlideTitle: function(index) {
            const slide = this.slides[index];
            
            // Check for title in different elements based on slide structure
            const titleElement = 
                slide.querySelector('.main-title') || 
                slide.querySelector('.slide-title') || 
                slide.querySelector('h1') ||
                slide.querySelector('h2');
                
            return titleElement ? titleElement.textContent : `Slide ${index + 1}`;
        },
        
        // Go to next slide
        nextSlide: function() {
            if (this.currentSlideIndex < this.totalSlides - 1) {
                this.showSlide(this.currentSlideIndex + 1);
            }
        },
        
        // Go to previous slide
        previousSlide: function() {
            if (this.currentSlideIndex > 0) {
                this.showSlide(this.currentSlideIndex - 1);
            }
        },
        
        // Setup Socket.io connection for remote control
        setupSocketConnection: function() {
            // For a real application, you would use your server URL
            // This is just for local development and demonstration
            const serverUrl = window.location.hostname + ':3000';
            
            try {
                // Create socket connection
                this.socket = io(serverUrl);
                
                // Socket event handlers
                this.socket.on('connect', () => {
                    console.log('Connected to server as presentation');
                    this.statusIndicator.classList.add('connected');
                    this.statusText.textContent = 'Connecté au serveur';
                    
                    // Register as presentation
                    this.socket.emit('register', { type: 'presentation' });
                    
                    // Send initial slide state
                    this.socket.emit('slideChanged', {
                        currentSlide: this.currentSlideIndex + 1,
                        totalSlides: this.totalSlides,
                        slideTitle: this.getSlideTitle(this.currentSlideIndex)
                    });
                    
                    // Send current theme
                    this.socket.emit('themeChanged', { theme: themeManager.currentTheme });
                });
                
                this.socket.on('disconnect', () => {
                    console.log('Disconnected from server');
                    this.statusIndicator.classList.remove('connected');
                    this.statusText.textContent = 'Non connecté à la télécommande';
                });
                
                this.socket.on('remoteConnected', () => {
                    console.log('Remote control connected');
                    this.statusText.textContent = 'Télécommande connectée';
                });
                
                this.socket.on('remoteDisconnected', () => {
                    console.log('Remote control disconnected');
                    this.statusText.textContent = 'Télécommande déconnectée';
                });
                
                // Remote control commands
                this.socket.on('nextSlide', () => {
                    this.nextSlide();
                });
                
                this.socket.on('prevSlide', () => {
                    this.previousSlide();
                });
                
                this.socket.on('goToSlide', (data) => {
                    const slideIndex = data.slide - 1;
                    if (slideIndex >= 0 && slideIndex < this.totalSlides) {
                        this.showSlide(slideIndex);
                    }
                });
                
                // Theme change from remote
                this.socket.on('themeChanged', (data) => {
                    themeManager.applyTheme(data.theme);
                });
                
            } catch (error) {
                console.error('Failed to connect to socket server:', error);
                this.statusText.textContent = 'Erreur de connexion au serveur';
            }
        }
    };
    
    // Initialize the image gallery
    function initImageGallery() {
        const prevBtn = document.querySelector('.gallery-btn.prev-btn');
        const nextBtn = document.querySelector('.gallery-btn.next-btn');
        const galleryItems = document.querySelectorAll('.gallery-item');
        const indicators = document.querySelectorAll('.indicator');
        let currentIndex = 0;
        
        if (!prevBtn || !nextBtn || galleryItems.length === 0) return;
        
        function showImage(index) {
            // Hide all images
            galleryItems.forEach(item => item.style.opacity = 0);
            
            // Remove active class from all indicators
            indicators.forEach(dot => dot.classList.remove('active'));
            
            // Show selected image
            galleryItems[index].style.opacity = 1;
            
            // Add active class to current indicator
            indicators[index].classList.add('active');
            
            currentIndex = index;
        }
        
        // Initialize first image
        showImage(0);
        
        // Previous button
        prevBtn.addEventListener('click', () => {
            let newIndex = currentIndex - 1;
            if (newIndex < 0) newIndex = galleryItems.length - 1;
            showImage(newIndex);
        });
        
        // Next button
        nextBtn.addEventListener('click', () => {
            let newIndex = currentIndex + 1;
            if (newIndex >= galleryItems.length) newIndex = 0;
            showImage(newIndex);
        });
        
        // Indicator dots
        indicators.forEach((dot, index) => {
            dot.addEventListener('click', () => {
                showImage(index);
            });
        });
        
        // Auto-advance images every 5 seconds
        let autoAdvance = setInterval(() => {
            let newIndex = currentIndex + 1;
            if (newIndex >= galleryItems.length) newIndex = 0;
            showImage(newIndex);
        }, 5000);
        
        // Stop auto-advance when user interacts
        [prevBtn, nextBtn, ...indicators].forEach(el => {
            el.addEventListener('click', () => {
                clearInterval(autoAdvance);
                
                // Restart auto-advance after 10 seconds of inactivity
                autoAdvance = setInterval(() => {
                    let newIndex = currentIndex + 1;
                    if (newIndex >= galleryItems.length) newIndex = 0;
                    showImage(newIndex);
                }, 5000);
            });
        });
    }

    // Make presentation available globally
    window.presentation = presentation;
    
    // Call function to initialize the presentation
    function init() {
        presentation.init();
        
        // Initialize the image gallery if it exists
        initImageGallery();
    }
    
    // Start the presentation
    init();
    
    // Fallback for Socket.io connection when no server is available
    // This allows the presentation to work even without the remote control
    window.addEventListener('error', function(e) {
        if (e.message === "Failed to construct 'WebSocket'" || 
            e.message.includes('socket.io') || 
            e.message.includes('io is not defined')) {
            
            console.warn('Socket.io connection failed. Presentation will work without remote control.');
            
            const statusIndicator = document.getElementById('status-indicator');
            const statusText = document.getElementById('status-text');
            
            statusIndicator.classList.remove('connected');
            statusText.textContent = 'Mode hors-ligne (pas de télécommande)';
            
            // Prevent the error from breaking the presentation
            e.preventDefault();
        }
    }, true);
});