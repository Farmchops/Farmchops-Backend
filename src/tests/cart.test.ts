// Cart uses sessions — use supertest.agent() to persist cookies across requests
import request from 'supertest';
import app from '../app';
import { Category } from '../models/Category';
import { Product } from '../models/Product';

// ─── Helpers ────────────────────────────────────────────────────────────────

const createProduct = async () => {
  const cat = await Category.create({ name: 'Vegetables', slug: 'vegetables', isActive: true });
  return Product.create({
    name: 'Fresh Tomatoes',
    description: 'Locally grown red tomatoes',
    slug: 'fresh-tomatoes',
    status: 'active',
    category: cat._id,
    pricing: { retail: { price: 50000, unit: 'kg', minQuantity: 1 } },
    inventory: { availableStock: 100, lowStockThreshold: 10, unit: 'kg' },
  });
};

// ─── GET /api/cart ───────────────────────────────────────────────────────────

describe('GET /api/cart', () => {
  it('returns 200 with empty cart for a new session', async () => {
    const res = await request(app).get('/api/cart');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.cart.items).toHaveLength(0);
  });
});

// ─── POST /api/cart/add ──────────────────────────────────────────────────────

describe('POST /api/cart/add', () => {
  it('returns 404 for non-existent product', async () => {
    const res = await request(app)
      .post('/api/cart/add')
      .send({
        productId: '64f1234567890abcdef12345',
        name: 'Ghost Product',
        image: 'https://example.com/ghost.jpg',
        price: 10000,
        quantity: 1,
        unit: 'kg',
        priceType: 'retail',
        minQuantity: 1,
      });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('adds a product and persists in the same session', async () => {
    const product = await createProduct();
    // Use agent to persist session cookie between requests
    const agent = request.agent(app);

    const addRes = await agent
      .post('/api/cart/add')
      .send({
        productId: String(product._id),
        name: product.name,
        image: 'https://example.com/tomatoes.jpg',
        price: 50000,
        quantity: 2,
        unit: 'kg',
        priceType: 'retail',
        minQuantity: 1,
      });

    expect(addRes.status).toBe(200);
    expect(addRes.body.success).toBe(true);

    // Verify the cart now has the item
    const getRes = await agent.get('/api/cart');
    expect(getRes.status).toBe(200);
    expect(getRes.body.cart.items.length).toBe(1);
    expect(getRes.body.cart.items[0].name).toBe('Fresh Tomatoes');
  });
});

// ─── DELETE /api/cart/clear ──────────────────────────────────────────────────

describe('DELETE /api/cart/clear', () => {
  it('returns 200 and clears the cart', async () => {
    const product = await createProduct();
    const agent = request.agent(app);

    // Add item first
    await agent.post('/api/cart/add').send({
      productId: String(product._id),
      name: product.name,
      image: 'https://example.com/tomatoes.jpg',
      price: 50000,
      quantity: 1,
      unit: 'kg',
      priceType: 'retail',
      minQuantity: 1,
    });

    // Clear it
    const clearRes = await agent.delete('/api/cart/clear');
    expect(clearRes.status).toBe(200);
    expect(clearRes.body.success).toBe(true);

    // Verify cart is empty
    const getRes = await agent.get('/api/cart');
    expect(getRes.body.cart.items).toHaveLength(0);
  });
});
