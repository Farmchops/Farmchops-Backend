import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import url from 'url';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  userRole?: string;
  isAlive?: boolean;
}

class WebSocketService {
  private wss: WebSocketServer | null = null;
  private adminClients: Set<AuthenticatedWebSocket> = new Set();

  /**
   * Initialize WebSocket server
   */
  initialize(server: Server): void {
    this.wss = new WebSocketServer({
      noServer: true,
      path: '/ws'
    });

    // Handle upgrade requests
    server.on('upgrade', (request, socket, head) => {
      const pathname = url.parse(request.url || '').pathname;

      if (pathname === '/ws/admin/orders') {
        this.handleAdminOrdersConnection(request, socket, head);
      } else {
        socket.destroy();
      }
    });

    // Setup heartbeat to detect disconnected clients
    const interval = setInterval(() => {
      this.wss?.clients.forEach((ws: WebSocket) => {
        const client = ws as AuthenticatedWebSocket;

        if (client.isAlive === false) {
          return client.terminate();
        }

        client.isAlive = false;
        client.ping();
      });
    }, 30000); // Check every 30 seconds

    this.wss.on('close', () => {
      clearInterval(interval);
    });

    console.log('WebSocket service initialized');
  }

  /**
   * Handle admin orders WebSocket connection
   */
  private handleAdminOrdersConnection(request: any, socket: any, head: any): void {
    if (!this.wss) return;

    // Authenticate the WebSocket connection
    this.authenticateWebSocket(request, (err, userId, userRole) => {
      if (err || !userId) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      // Only allow admin users
      if (userRole !== 'admin') {
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
        return;
      }

      // Complete the WebSocket handshake
      this.wss!.handleUpgrade(request, socket, head, (ws: WebSocket) => {
        const client = ws as AuthenticatedWebSocket;
        client.userId = userId;
        client.userRole = userRole;
        client.isAlive = true;

        // Add to admin clients
        this.adminClients.add(client);

        // Setup client event handlers
        this.setupClientHandlers(client);

        // Emit connection event
        this.wss!.emit('connection', client, request);

        // Send welcome message
        client.send(JSON.stringify({
          type: 'connected',
          message: 'Connected to admin orders feed',
          timestamp: new Date().toISOString()
        }));

        console.log(`Admin WebSocket connected: ${userId}, Total clients: ${this.adminClients.size}`);
      });
    });
  }

  /**
   * Authenticate WebSocket connection using JWT token
   */
  private authenticateWebSocket(
    request: any,
    callback: (err: Error | null, userId?: string, userRole?: string) => void
  ): void {
    try {
      const pathname = url.parse(request.url || '', true);
      const token = pathname.query.token as string;

      if (!token) {
        return callback(new Error('No token provided'));
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string; role: string };

      if (!decoded.userId || !decoded.role) {
        return callback(new Error('Invalid token'));
      }

      callback(null, decoded.userId, decoded.role);
    } catch (error) {
      callback(error as Error);
    }
  }

  /**
   * Setup event handlers for a WebSocket client
   */
  private setupClientHandlers(client: AuthenticatedWebSocket): void {
    client.on('pong', () => {
      client.isAlive = true;
    });

    client.on('message', (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());
        console.log('WebSocket message received:', data);

        // Handle ping/pong
        if (data.type === 'ping') {
          client.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
        }
      } catch (error) {
        console.error('WebSocket message parse error:', error);
      }
    });

    client.on('close', () => {
      this.adminClients.delete(client);
      console.log(`Admin WebSocket disconnected: ${client.userId}, Remaining clients: ${this.adminClients.size}`);
    });

    client.on('error', (error) => {
      console.error('WebSocket error:', error);
      this.adminClients.delete(client);
    });
  }

  /**
   * Broadcast order creation event to all admin clients
   */
  broadcastOrderCreated(order: any): void {
    this.broadcastToAdmins({
      type: 'order_created',
      data: order,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Broadcast order update event to all admin clients
   */
  broadcastOrderUpdated(order: any): void {
    this.broadcastToAdmins({
      type: 'order_updated',
      data: order,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Broadcast order status change event to all admin clients
   */
  broadcastOrderStatusChanged(orderId: string, oldStatus: string, newStatus: string, order: any): void {
    this.broadcastToAdmins({
      type: 'order_status_changed',
      data: {
        orderId,
        oldStatus,
        newStatus,
        order
      },
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Broadcast a message to all connected admin clients
   */
  private broadcastToAdmins(message: any): void {
    const messageStr = JSON.stringify(message);
    let sentCount = 0;

    this.adminClients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
        sentCount++;
      }
    });

    console.log(`Broadcast ${message.type} to ${sentCount} admin clients`);
  }

  /**
   * Get the number of connected admin clients
   */
  getAdminClientCount(): number {
    return this.adminClients.size;
  }

  /**
   * Close all connections and shutdown
   */
  shutdown(): void {
    this.adminClients.forEach((client) => {
      client.close(1000, 'Server shutting down');
    });

    this.wss?.close(() => {
      console.log('WebSocket server closed');
    });
  }
}

export default new WebSocketService();
