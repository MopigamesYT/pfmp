document.addEventListener('DOMContentLoaded', function() {
    // Presentation data
    let presentationData = null;

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
        slides: [],
        currentSlideIndex: 0,
        totalSlides: 0,
        
        // DOM elements
        prevBtn: document.getElementById('prev-btn'),
        nextBtn: document.getElementById('next-btn'),
        slideNumber: document.getElementById('slide-number'),
        loadingScreen: document.getElementById('loading-screen'),
        statusIndicator: document.getElementById('status-indicator'),
        statusText: document.getElementById('status-text'),
        slidesContainer: document.querySelector('.slides-container'),
        
        // Initialize presentation
        init: async function() {
            // Load presentation data
            try {
                await this.loadPresentationData();
                
                // Generate slides from the data
                this.generateSlides();
                
                this.slides = Array.from(document.querySelectorAll('.slide'));
                this.totalSlides = this.slides.length;
                this.showSlide(this.currentSlideIndex);
                
                // Setup event listeners
                this.setupEventListeners();
                
                // Hide loading screen
                setTimeout(() => {
                    this.loadingScreen.classList.add('hidden');
                }, 1000);
                
                // Initialize Socket.io for remote control
                this.setupSocketConnection();
                
                // Initialize theme manager
                themeManager.init();
                
                // Initialize UI visibility manager
                uiVisibilityManager.init();

                // Initialize fullscreen viewer
                this.initFullscreenViewer();

                // Initialize galleries
                this.initImageGalleries();
            } catch (error) {
                console.error('Failed to initialize presentation:', error);
                this.displayError('Failed to load presentation data.');
            }
        },
        
        // Load presentation data from JSON file
        loadPresentationData: async function() {
            try {
                const response = await fetch('/data/presentation.json');
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                presentationData = await response.json();
                document.title = presentationData.title;
                return presentationData;
            } catch (error) {
                console.error('Error loading presentation data:', error);
                throw error;
            }
        },
        
        // Generate slides HTML from presentation data
        generateSlides: function() {
            if (!presentationData || !presentationData.slides) {
                throw new Error('No presentation data available');
            }
            
            // Clear existing slides
            this.slidesContainer.innerHTML = '';
            
            // Generate HTML for each slide
            presentationData.slides.forEach(slide => {
                const slideElement = this.createSlideElement(slide);
                this.slidesContainer.appendChild(slideElement);
            });
        },
        
        // Create a slide element based on slide type
        createSlideElement: function(slide) {
            const slideElement = document.createElement('section');
            slideElement.className = 'slide';
            slideElement.id = `slide-${slide.id}`;
            
            const slideContent = document.createElement('div');
            slideContent.className = 'slide-content';
            
            switch (slide.type) {
                case 'title':
                    slideContent.innerHTML = `
                        <h1 class="main-title animate__animated animate__fadeIn">${slide.title}</h1>
                        <h2 class="subtitle animate__animated animate__fadeIn animate__delay-1s">${slide.subtitle}</h2>
                        <h3 class="author animate__animated animate__fadeIn animate__delay-2s">${slide.author}</h3>
                    `;
                    break;
                    
                case 'about':
                    let skillsHTML = '';
                    slide.skills.forEach(skill => {
                        skillsHTML += `<li><i class="${skill.icon}"></i> ${skill.text}</li>`;
                    });
                    
                    slideContent.innerHTML = `
                        <h2 class="slide-title">${slide.title}</h2>
                        <div class="about-me-container">
                            <div class="profile-section">
                                <div class="profile-image">
                                    <i class="fas fa-user-circle"></i>
                                </div>
                                <div class="profile-details">
                                    <h3>${slide.profile.name}</h3>
                                    <p>${slide.profile.position}</p>
                                    <p>${slide.profile.school}</p>
                                </div>
                            </div>
                            <div class="skills-section">
                                <h3>${slide.skillsTitle || 'Skills & Background'}</h3>
                                <ul class="skills-list">
                                    ${skillsHTML}
                                </ul>
                            </div>
                        </div>
                    `;
                    break;
                    
                case 'company':
                    let tasksHTML = '';
                    slide.company.tasks.forEach(task => {
                        tasksHTML += `<li>${task}</li>`;
                    });
                    
                    // Optional sector and activity fields
                    let sectorHTML = slide.company.sector ? 
                        `<p><strong>${slide.company.sectorLabel || 'Sector'}:</strong> ${slide.company.sector}</p>` : '';
                    let activityHTML = slide.company.activity ? 
                        `<p><strong>${slide.company.activityLabel || 'Main Activity'}:</strong> ${slide.company.activity}</p>` : '';
                    
                    slideContent.innerHTML = `
                        <h2 class="slide-title">${slide.title}</h2>
                        <div class="companies-grid">
                            <div class="company-card" id="${slide.company.name.toLowerCase().replace(/\s+/g, '-')}">
                                <h3>${slide.company.period} - ${slide.company.name}</h3>
                                ${sectorHTML}
                                ${activityHTML}
                                <div class="tasks">
                                    <h4>${slide.company.tasksLabel || 'Key Points'}</h4>
                                    <ul>
                                        ${tasksHTML}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    `;
                    break;
                    
                case 'companies-info':
                    let companiesInfoHTML = '';
                    slide.companies.forEach(company => {
                        let infoHTML = '';
                        company.info.forEach(item => {
                            infoHTML += `<li><strong>${item.label}:</strong> ${item.value}</li>`;
                        });
                        
                        companiesInfoHTML += `
                            <div class="company-info">
                                <h3>${company.name}</h3>
                                <ul>
                                    ${infoHTML}
                                </ul>
                            </div>
                        `;
                    });
                    
                    slideContent.innerHTML = `
                        <h2 class="slide-title">${slide.title}</h2>
                        <div class="company-details">
                            ${companiesInfoHTML}
                        </div>
                    `;
                    break;
                    
                case 'case-study':
                    let problemsHTML = '';
                    slide.problem.forEach(problem => {
                        problemsHTML += `<li>${problem}</li>`;
                    });
                    
                    slideContent.innerHTML = `
                        <h2 class="slide-title">${slide.title}</h2>
                        <div class="case-study">
                            <div class="section-header">
                                <h3>${slide.problemTitle || 'Issues'}</h3>
                            </div>
                            <ul class="problem-list">
                                ${problemsHTML}
                            </ul>
                        </div>
                    `;
                    break;
                    
                case 'project':
                    let architectureHTML = '';
                    slide.architecture.forEach(item => {
                        architectureHTML += `<li>${item}</li>`;
                    });
                    
                    // Gallery items
                    let galleryHTML = '';
                    
                    if (slide.gallery && slide.gallery.length > 0) {
                        let galleryItemsHTML = '';
                        let indicatorsHTML = '';
                        
                        slide.gallery.forEach((item, index) => {
                            galleryItemsHTML += `
                                <div class="gallery-item">
                                    <img src="${item.image}" alt="${item.caption}">
                                    <div class="image-caption">${item.caption}</div>
                                </div>
                            `;
                            
                            indicatorsHTML += `<span class="indicator ${index === 0 ? 'active' : ''}" data-index="${index}"></span>`;
                        });
                        
                        galleryHTML = `
                            <div class="libertix-showcase">
                                <h3>${slide.galleryTitle || 'Gallery'}</h3>
                                <div class="image-gallery">
                                    <div class="gallery-container">
                                        ${galleryItemsHTML}
                                    </div>
                                    <div class="gallery-controls">
                                        <button class="gallery-btn prev-btn"><i class="fas fa-chevron-left"></i></button>
                                        <div class="gallery-indicators">
                                            ${indicatorsHTML}
                                        </div>
                                        <button class="gallery-btn next-btn"><i class="fas fa-chevron-right"></i></button>
                                    </div>
                                </div>
                            </div>
                        `;
                    }
                    
                    slideContent.innerHTML = `
                        <h2 class="slide-title">${slide.title}</h2>
                        <div class="project-development">
                            <h3>${slide.architectureTitle || 'Key Points'}</h3>
                            <ul>
                                ${architectureHTML}
                            </ul>
                            
                            ${galleryHTML}
                        </div>
                    `;
                    break;
                    
                case 'features':
                    let featuresHTML = '';
                    slide.features.forEach(feature => {
                        let itemsHTML = '';
                        feature.items.forEach(item => {
                            itemsHTML += `<li>${item}</li>`;
                        });
                        
                        featuresHTML += `
                            <div class="feature-card">
                                <h3>${feature.name}</h3>
                                <ul>
                                    ${itemsHTML}
                                </ul>
                            </div>
                        `;
                    });
                    
                    slideContent.innerHTML = `
                        <h2 class="slide-title">${slide.title}</h2>
                        <div class="features">
                            ${featuresHTML}
                        </div>
                    `;
                    break;
                    
                case 'technical':
                    let challengesHTML = '';
                    slide.challenges.forEach(challenge => {
                        challengesHTML += `
                            <div class="challenge">
                                <h4>${challenge.title}</h4>
                                <p><strong>${slide.solutionLabel || 'Solution'}:</strong> ${challenge.solution}</p>
                            </div>
                        `;
                    });
                    
                    slideContent.innerHTML = `
                        <h2 class="slide-title">${slide.title}</h2>
                        <div class="technical">
                            <h3>${slide.challengesTitle || 'Technical Challenges'}</h3>
                            <div class="technical-challenges">
                                ${challengesHTML}
                            </div>
                        </div>
                    `;
                    break;
                    
                case 'conclusion':
                    let impactHTML = '';
                    slide.impact.forEach(item => {
                        impactHTML += `<li>${item}</li>`;
                    });
                    
                    let perspectivesHTML = '';
                    slide.perspectives.forEach(item => {
                        perspectivesHTML += `<li>${item}</li>`;
                    });
                    
                    slideContent.innerHTML = `
                        <h2 class="slide-title">${slide.title}</h2>
                        <div class="conclusion">
                            <h3>${slide.impactTitle || 'Impact & Results'}</h3>
                            <ul>
                                ${impactHTML}
                            </ul>
                            <h3>${slide.perspectivesTitle || 'Future Perspectives'}</h3>
                            <ul>
                                ${perspectivesHTML}
                            </ul>
                        </div>
                    `;
                    break;
                    
                case 'thank-you':
                    slideContent.innerHTML = `
                        <div class="thank-you">
                            <h1 class="animate__animated animate__pulse animate__infinite">${slide.title}</h1>
                            <p class="questions">${slide.subtitle}</p>
                        </div>
                    `;
                    break;
                    
                default:
                    slideContent.innerHTML = `<h2>${slide.title}</h2>`;
                    break;
            }
            
            slideElement.appendChild(slideContent);
            return slideElement;
        },
        
        // Display error message
        displayError: function(message) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.innerHTML = `
                <h2>Error</h2>
                <p>${message}</p>
            `;
            document.body.appendChild(errorDiv);
            
            if (this.loadingScreen) {
                this.loadingScreen.classList.add('error');
                this.loadingScreen.innerHTML = `
                    <h2>Error Loading Presentation</h2>
                    <p>${message}</p>
                `;
            }
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
        
        // Initialize fullscreen image viewer
        initFullscreenViewer: function() {
            const overlay = document.getElementById('fullscreen-overlay');
            const fullscreenImg = document.getElementById('fullscreen-image');
            const closeBtn = document.getElementById('fullscreen-close');

            if (!overlay || !fullscreenImg) return;

            // Close fullscreen when clicking overlay or close button
            const closeFullscreen = () => {
                overlay.classList.remove('active');
            };

            overlay.addEventListener('click', closeFullscreen);
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                closeFullscreen();
            });

            // Close on escape key
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && overlay.classList.contains('active')) {
                    closeFullscreen();
                }
            });

            // Store reference for use in gallery init
            this.fullscreenOverlay = overlay;
            this.fullscreenImg = fullscreenImg;
        },

        // Open image in fullscreen
        openFullscreen: function(imgSrc) {
            if (!this.fullscreenOverlay || !this.fullscreenImg) return;

            this.fullscreenImg.src = imgSrc;
            this.fullscreenOverlay.classList.add('active');
        },

        // Initialize all image galleries in the presentation
        initImageGalleries: function() {
            const galleries = document.querySelectorAll('.image-gallery');
            const self = this;

            galleries.forEach(gallery => {
                const prevBtn = gallery.querySelector('.gallery-btn.prev-btn');
                const nextBtn = gallery.querySelector('.gallery-btn.next-btn');
                const galleryItems = gallery.querySelectorAll('.gallery-item');
                const indicators = gallery.querySelectorAll('.indicator');
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

                // Click on images to open fullscreen
                galleryItems.forEach(item => {
                    const img = item.querySelector('img');
                    if (img) {
                        img.addEventListener('click', () => {
                            self.openFullscreen(img.src);
                        });
                    }
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
            });
        },
        
        // Setup Socket.io connection for remote control
        setupSocketConnection: function() {
            try {
                // Create socket connection to current host and protocol
                this.socket = io({
                    path: '/socket.io',
                    transports: ['websocket', 'polling'],
                    secure: window.location.protocol === 'https:' // Use wss:// for HTTPS, ws:// for HTTP
                });
        
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
                
                // Request for current slide info
                this.socket.on('requestSlideInfo', () => {
                    this.socket.emit('slideChanged', {
                        currentSlide: this.currentSlideIndex + 1,
                        totalSlides: this.totalSlides,
                        slideTitle: this.getSlideTitle(this.currentSlideIndex)
                    });
                });
                
                this.socket.on('replaced', () => {
                    console.log('This presentation instance has been replaced by another one');
                    this.statusText.textContent = 'Cette instance a été remplacée';
                    this.statusIndicator.classList.remove('connected');
                    // Optional: Reload the page or show a notification
                });
                
            } catch (error) {
                console.error('Failed to connect to socket server:', error);
                this.statusText.textContent = 'Erreur de connexion au serveur';
            }
        }
    };

    // Make presentation available globally
    window.presentation = presentation;
    
    // Call function to initialize the presentation
    function init() {
        presentation.init();
    }
    
    // Start the presentation
    init();
    
    // Fallback for Socket.io connection when no server is available
    window.addEventListener('error', function(e) {
        if (e.message === "Failed to construct 'WebSocket'" || 
            e.message.includes('socket.io') || 
            e.message.includes('io is not defined')) {
            
            console.warn('Socket.io connection failed. Presentation will work without remote control.');
            
            const statusIndicator = document.getElementById('status-indicator');
            const statusText = document.getElementById('status-text');
            
            if (statusIndicator) statusIndicator.classList.remove('connected');
            if (statusText) statusText.textContent = 'Mode hors-ligne (pas de télécommande)';
            
            // Prevent the error from breaking the presentation
            e.preventDefault();
        }
    }, true);
});