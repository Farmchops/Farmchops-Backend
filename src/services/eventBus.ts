import { EventEmitter } from 'events';

// Simple singleton event bus for intra-process events (order updates, notifications).
// Consumers can import this and listen or re-publish to sockets/queues as needed.
const eventBus = new EventEmitter();

export default eventBus;
