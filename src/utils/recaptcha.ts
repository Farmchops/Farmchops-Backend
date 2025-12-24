import axios from 'axios';

interface RecaptchaResponse {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  score?: number;
  action?: string;
  'error-codes'?: string[];
}

/**
 * Verify Google reCAPTCHA v3 token
 * @param token - The reCAPTCHA token from the client
 * @param expectedAction - The expected action name (optional, for v3)
 * @param minScore - Minimum score required (0.0 to 1.0, default 0.5)
 * @returns Promise<boolean> - True if verification passes
 */
export async function verifyRecaptcha(
  token: string,
  expectedAction?: string,
  minScore: number = 0.5
): Promise<boolean> {
  try {
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;

    if (!secretKey) {
      console.error('RECAPTCHA_SECRET_KEY is not set in environment variables');
      // In production, you might want to fail closed (return false)
      // But during development, you might want to fail open (return true)
      return process.env.NODE_ENV === 'development';
    }

    if (!token || typeof token !== 'string') {
      console.error('Invalid reCAPTCHA token provided');
      return false;
    }

    const response = await axios.post<RecaptchaResponse>(
      'https://www.google.com/recaptcha/api/siteverify',
      null,
      {
        params: {
          secret: secretKey,
          response: token,
        },
        timeout: 5000, // 5 second timeout
      }
    );

    const { success, score, action, 'error-codes': errorCodes } = response.data;

    if (!success) {
      console.error('reCAPTCHA verification failed:', errorCodes);
      return false;
    }

    // For reCAPTCHA v3, check the score
    if (score !== undefined && score < minScore) {
      console.warn(`reCAPTCHA score too low: ${score} (minimum: ${minScore})`);
      return false;
    }

    // Optionally verify the action matches what was expected
    if (expectedAction && action !== expectedAction) {
      console.warn(`reCAPTCHA action mismatch: expected "${expectedAction}", got "${action}"`);
      return false;
    }

    return true;
  } catch (error: any) {
    console.error('Error verifying reCAPTCHA:', error.message);
    // Fail open in development, fail closed in production
    return process.env.NODE_ENV === 'development';
  }
}

/**
 * Verify Google reCAPTCHA v2 checkbox token
 * @param token - The reCAPTCHA token from the client
 * @returns Promise<boolean> - True if verification passes
 */
export async function verifyRecaptchaV2(token: string): Promise<boolean> {
  try {
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;

    if (!secretKey) {
      console.error('RECAPTCHA_SECRET_KEY is not set in environment variables');
      return process.env.NODE_ENV === 'development';
    }

    if (!token || typeof token !== 'string') {
      console.error('Invalid reCAPTCHA token provided');
      return false;
    }

    const response = await axios.post<RecaptchaResponse>(
      'https://www.google.com/recaptcha/api/siteverify',
      null,
      {
        params: {
          secret: secretKey,
          response: token,
        },
        timeout: 5000,
      }
    );

    const { success, 'error-codes': errorCodes } = response.data;

    if (!success) {
      console.error('reCAPTCHA v2 verification failed:', errorCodes);
      return false;
    }

    return true;
  } catch (error: any) {
    console.error('Error verifying reCAPTCHA v2:', error.message);
    return process.env.NODE_ENV === 'development';
  }
}
