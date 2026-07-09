import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';

class AlatPayService {
  private api: AxiosInstance;
  private apiKey: string;
  private businessId: string;
  private webhookSecret: string;

  constructor() {
    this.apiKey = process.env.ALAT_PAY_API_KEY || '';
    this.businessId = process.env.ALAT_PAY_BUSINESS_ID || '';
    this.webhookSecret = process.env.ALAT_PAY_WEBHOOK_SECRET || '';

    if (!this.apiKey) {
      console.warn('WARNING: ALAT_PAY_API_KEY is not set in environment variables');
    }

    this.api = axios.create({
      baseURL: 'https://apibox.alatpay.ng',
      headers: {
        'Ocp-Apim-Subscription-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
    });
  }

  getPublicConfig() {
    return {
      apiKey: this.apiKey,
      businessId: this.businessId,
    };
  }

  async verifyTransaction(transactionId: string) {
    try {
      const response = await this.api.get(`/alatpaytransaction/api/v1/transactions/${transactionId}`);
      return response.data;
    } catch (error: any) {
      console.error('ALATPay verification error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to verify ALATPay transaction');
    }
  }

  async listTransactions(params: { page?: number; limit?: number; status?: string; startAt?: string; endAt?: string }) {
    try {
      const response = await this.api.get('/alatpaytransaction/api/v1/transactions', {
        params: {
          BusinessId: this.businessId,
          Page: params.page ?? 1,
          Limit: params.limit ?? 50,
          Status: params.status,
          StartAt: params.startAt,
          EndAt: params.endAt,
        },
      });
      return response.data;
    } catch (error: any) {
      console.error('ALATPay list transactions error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to list ALATPay transactions');
    }
  }

  verifyWebhookSignature(signature: string, body: string): boolean {
    const computed = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(body)
      .digest('base64');
    return computed === signature;
  }
}

export default new AlatPayService();
