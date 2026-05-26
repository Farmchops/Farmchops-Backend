import { Request, Response } from 'express';
import { getShippingRates } from '../services/shippingService';

export const shippingRates = (req: Request, res: Response): void => {
  const { country } = req.query;

  const rates = getShippingRates(typeof country === 'string' ? country : undefined);

  res.json({
    success: true,
    data: { rates }
  });
};
