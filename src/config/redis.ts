import Redis from 'ioredis';
const REDIS_URL = process.env.REDIS_URL || '';

let client: Redis | null = null;

export function getRedisClient(): Redis | null {
	if (client) return client;
	if (!REDIS_URL) {
		console.warn('REDIS_URL not configured; Redis caching disabled');
		return null;
	}
	client = new Redis(REDIS_URL);
	client.on('error', (err: Error) => console.error('Redis error:', err));
	return client;
}

export async function cacheGet<T = any>(key: string): Promise<T | null> {
	const c = getRedisClient();
	if (!c) return null;
	const v = await c.get(key);
	if (!v) return null;
	try {
		return JSON.parse(v) as T;
	} catch (e) {
		return null;
	}
}

export async function cacheSet(key: string, value: any, ttlSeconds = 3600): Promise<void> {
	const c = getRedisClient();
	if (!c) return;
	await c.set(key, JSON.stringify(value), 'EX', ttlSeconds);
}

export default { getRedisClient, cacheGet, cacheSet };

