import jwt, { SignOptions, Secret } from 'jsonwebtoken';

interface TokenPayload {
  userId: string;
  role: string;
}

const generateToken = (userId: string, role: string): string => {
  const payload: TokenPayload = { userId, role };
  
  // Convert expiration time to appropriate format
  const expiresIn = Number(process.env.JWT_EXPIRES_IN) || '7d';
  
  const options: SignOptions = { 
    expiresIn 
  };

  const secret: Secret = process.env.JWT_SECRET || '';
  
  if (!secret) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }

  return jwt.sign(payload, secret, options);
};

export default generateToken;