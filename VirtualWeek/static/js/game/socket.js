/**
 * Virtual Week Socket Manager
 * WebSocket communication with server
 */

/**
 * Socket Manager
 * Handles WebSocket connection and events
 */
class SocketManager {
    constructor(config = {}) {
        this.config = {
            url: config.url || 'http://localhost:5001',
            transports: config.transports || ['websocket', 'polling'],
            reconnection: config.reconnection !== false,
            reconnectionDelay: config.reconnectionDelay || 1000,
            reconnectionAttempts: config.reconnectionAttempts || 10
        };
        this.socket = null;
        this.isReady = false;
        this.eventHandlers = {};
    }
    
    /**
     * Initialize and connect
     * @returns {Promise} Resolves when connected
     */
    async connect() {
        return new Promise((resolve, reject) => {
            this.socket = io(this.config.url, {
                transports: this.config.transports,
                reconnection: this.config.reconnection,
                reconnectionDelay: this.config.reconnectionDelay,
                reconnectionAttempts: this.config.reconnectionAttempts
            });
            
            this.socket.on('connect', () => {
                console.log('[WebSocket] Connected:', this.socket.id);
                this.isReady = true;
                
                // Join waiting room immediately
                this.socket.emit('game:join_waiting');
                console.log('[WebSocket] 📢 Joined waiting room');
                
                resolve(this.socket);
            });
            
            this.socket.on('disconnect', () => {
                console.log('[WebSocket] Disconnected');
                this.isReady = false;
            });
            
            this.socket.on('connected', (data) => {
                console.log('[WebSocket] Server confirmed:', data.sid);
            });
            
            this.socket.on('error', (error) => {
                console.error('[WebSocket] Error:', error);
                reject(error);
            });
            
            // Register any pre-defined handlers
            Object.entries(this.eventHandlers).forEach(([event, handler]) => {
                this.socket.on(event, handler);
            });
        });
    }
    
    /**
     * Register event handler
     */
    on(event, handler) {
        this.eventHandlers[event] = handler;
        if (this.socket) {
            this.socket.on(event, handler);
        }
    }
    
    /**
     * Emit event
     */
    emit(event, data) {
        if (this.socket && this.socket.connected) {
            this.socket.emit(event, data);
        } else {
            console.warn('[WebSocket] Cannot emit, not connected');
        }
    }
    
    /**
     * Join game room
     */
    joinGame(participantId) {
        this.emit('game:join', { participant_id: participantId });
        console.log('[WebSocket] 📡 Joining game room:', participantId);
    }
    
    /**
     * Sync game state
     */
    syncState(state) {
        this.emit('game:state_sync', state);
    }
    
    /**
     * Log game action
     */
    logAction(data) {
        this.emit('game:action', data);
    }
    
    /**
     * Check if connected
     */
    get connected() {
        return this.socket && this.socket.connected;
    }
}

// Export
window.SocketManager = SocketManager;
