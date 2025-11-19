import axios, { AxiosInstance } from 'axios';

class PaystackService {
  private api: AxiosInstance;
  private secretKey: string;

  constructor() {
    this.secretKey = process.env.PAYSTACK_SECRET_KEY || '';

    if (!this.secretKey) {
      console.warn('WARNING: PAYSTACK_SECRET_KEY is not set in environment variables');
    }

    this.api = axios.create({
      baseURL: 'https://api.paystack.co',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Initialize a payment transaction
   * @param email Customer's email address
   * @param amount Amount in kobo (smallest currency unit)
   * @param reference Unique transaction reference
   * @param metadata Additional data to attach to the transaction
   */
  async initializeTransaction(
    email: string,
    amount: number,
    reference: string,
    metadata?: Record<string, any>
  ) {
    try {
      const response = await this.api.post('/transaction/initialize', {
        email,
        amount: Math.round(amount * 100), // Paystack expects amount in kobo
        reference,
        metadata,
        callback_url: process.env.PAYSTACK_CALLBACK_URL || `${process.env.FRONTEND_URL}/order/success`,
      });

      return response.data;
    } catch (error: any) {
      console.error('Paystack initialization error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to initialize payment');
    }
  }

  /**
   * Verify a transaction
   * @param reference Transaction reference to verify
   */
  async verifyTransaction(reference: string) {
    try {
      const response = await this.api.get(`/transaction/verify/${reference}`);
      return response.data;
    } catch (error: any) {
      console.error('Paystack verification error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to verify payment');
    }
  }

  /**
   * Get transaction details
   * @param transactionId Transaction ID
   */
  async getTransaction(transactionId: number) {
    try {
      const response = await this.api.get(`/transaction/${transactionId}`);
      return response.data;
    } catch (error: any) {
      console.error('Paystack transaction fetch error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to fetch transaction');
    }
  }

  /**
   * Verify webhook signature
   * @param signature Signature from request headers
   * @param body Request body
   */
  verifyWebhookSignature(signature: string, body: string): boolean {
    const crypto = require('crypto');
    const hash = crypto
      .createHmac('sha512', this.secretKey)
      .update(body)
      .digest('hex');

    return hash === signature;
  }

  /**
   * Create a refund
   * @param reference Transaction reference
   * @param amount Amount to refund (optional, full refund if not specified)
   */
  async createRefund(reference: string, amount?: number) {
    try {
      const payload: any = { transaction: reference };
      if (amount) {
        payload.amount = Math.round(amount);
      }

      const response = await this.api.post('/refund', payload);
      return response.data;
    } catch (error: any) {
      console.error('Paystack refund error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to create refund');
    }
  }

  /**
   * List transactions with pagination
   * @param perPage Number of transactions per page
   * @param page Page number
   */
  async listTransactions(perPage: number = 50, page: number = 1) {
    try {
      const response = await this.api.get('/transaction', {
        params: { perPage, page },
      });
      return response.data;
    } catch (error: any) {
      console.error('Paystack list transactions error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to list transactions');
    }
  }
}

// Export singleton instance
export default new PaystackService();
