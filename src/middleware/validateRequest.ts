import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationError } from 'express-validator';

interface ValidationResponse {
  success: boolean;
  message: string;
  errors: ValidationError[];
}

export const validateRequest = (
  req: Request,
  res: Response<ValidationResponse>,
  next: NextFunction
): void | Response<ValidationResponse> => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array()
    });
  }
  
  return next();
};