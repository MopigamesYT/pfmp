const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

// Create Express app and HTTP server
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files
app.use(express.static(path.join(__dirname)));

// Store client connections
let presentationSocket = null;
let remoteClients = new Set();
let currentTheme = 'default';

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Client registration
    socket.on('register', (data) => {
        if (data.type === 'presentation') {
            if (presentationSocket) {
                // Disconnect previous presentation if any
                console.log('Previous presentation disconnected');
                presentationSocket.emit('replaced');
            }
            
            presentationSocket = socket;
            console.log('Presentation registered:', socket.id);
            
            // Notify remote controls
            io.emit('presentationConnected');
        } 
        else if (data.type === 'remote') {
            remoteClients.add(socket.id);
            console.log('Remote control registered:', socket.id);
            
            // Send current theme to new remote
            socket.emit('themeChanged', { theme: currentTheme });
            
            // Notify presentation
            if (presentationSocket) {
                presentationSocket.emit('remoteConnected');
            }
        }
    });

    // Handle slide navigation commands from remote
    socket.on('nextSlide', () => {
        if (presentationSocket) {
            presentationSocket.emit('nextSlide');
        }
    });

    socket.on('prevSlide', () => {
        if (presentationSocket) {
            presentationSocket.emit('prevSlide');
        }
    });

    socket.on('goToSlide', (data) => {
        if (presentationSocket) {
            presentationSocket.emit('goToSlide', data);
        }
    });

    // Handle slide changes from presentation
    socket.on('slideChanged', (data) => {
        // Broadcast to all remote controls
        socket.broadcast.emit('slideChanged', data);
    });

    // Handle theme changes
    socket.on('themeChanged', (data) => {
        currentTheme = data.theme;
        console.log('Theme changed to:', currentTheme);
        
        // Broadcast to all clients except sender
        socket.broadcast.emit('themeChanged', data);
    });

    // Request for current slide info
    socket.on('getSlideInfo', () => {
        if (presentationSocket) {
            presentationSocket.emit('requestSlideInfo');
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        
        if (socket === presentationSocket) {
            presentationSocket = null;
            io.emit('presentationDisconnected');
            console.log('Presentation disconnected');
        } 
        else if (remoteClients.has(socket.id)) {
            remoteClients.delete(socket.id);
            
            if (presentationSocket) {
                presentationSocket.emit('remoteDisconnected');
            }
            
            console.log('Remote control disconnected');
        }
    });
});

// Define routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/remote', (req, res) => {
    res.sendFile(path.join(__dirname, 'remote.html'));
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Presentation URL: http://localhost:${PORT}`);
    console.log(`Remote control URL: http://localhost:${PORT}/remote`);
});