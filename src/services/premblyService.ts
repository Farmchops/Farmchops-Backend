import axios from 'axios';

interface IPPISVerificationResult {
  verified: boolean;
  confidence?: number;
  data?: any;
  error?: string;
}

interface BVNVerificationResult {
  verified: boolean;
  confidence?: number;
  data?: any;
  error?: string;
  premblyResponse?: any;
}

interface NINExtractionResult {
  extracted: boolean;
  ninNumber?: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  confidence?: number;
  error?: string;
}

interface NINVerificationResult {
  verified: boolean;
  confidence?: number;
  data?: any;
  error?: string;
  premblyResponse?: any;
}

interface FaceMatchResult {
  matched: boolean;
  confidence?: number;
  error?: string;
}

interface ComprehensiveVerificationResult {
  ippis: IPPISVerificationResult;
  bvn: BVNVerificationResult;
  nin: {
    extracted: boolean;
    verified: boolean;
    extractedNumber?: string;
    error?: string;
  };
  faceMatch?: FaceMatchResult;
  overallVerified: boolean;
  verificationScore: number;
}

class PremblyService {
  private apiKey: string;
  private appId: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.PREMBLY_API_KEY || '';
    this.appId = process.env.PREMBLY_APP_ID || '';
    this.baseUrl = process.env.PREMBLY_BASE_URL || 'https://api.prembly.com/identitypass';
  }

  /**
   * Verify IPPIS (Integrated Payroll and Personnel Information System)
   * Restricted to government workers only
   */
  async verifyIPPIS(ippis: string, firstName: string, lastName: string): Promise<IPPISVerificationResult> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/verification/ippis`,
        {
          number: ippis,
          first_name: firstName,
          last_name: lastName
        },
        {
          headers: {
            'x-api-key': this.apiKey,
            'app-id': this.appId,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        verified: response.data.verification?.status === 'verified',
        data: response.data,
        confidence: response.data.verification?.confidence || 0
      };
    } catch (error: any) {
      console.error('Prembly IPPIS verification error:', error.response?.data || error.message);
      return {
        verified: false,
        error: error.response?.data?.message || 'IPPIS verification failed'
      };
    }
  }

  /**
   * Verify BVN (Bank Verification Number)
   */
  async verifyBVN(bvn: string, firstName: string, lastName: string): Promise<BVNVerificationResult> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/verification/bvn`,
        {
          number: bvn,
          first_name: firstName,
          last_name: lastName
        },
        {
          headers: {
            'x-api-key': this.apiKey,
            'app-id': this.appId,
            'Content-Type': 'application/json'
          }
        }
      );

      // Check multiple possible success indicators
      const isVerified = response.data.verification_status === 'verified' ||
                        response.data.verification?.status === 'VERIFIED' ||
                        response.data.verification?.status === 'verified' ||
                        response.data.account_verified === true ||
                        (response.data.status === true && response.data.response_code === '00');

      return {
        verified: isVerified,
        confidence: response.data.verification?.confidence || (isVerified ? 95 : 0),
        premblyResponse: response.data
      };
    } catch (error: any) {
      console.error('Prembly BVN verification error:', error.response?.data || error.message);
      return {
        verified: false,
        confidence: 0,
        error: error.response?.data?.message || 'BVN verification failed',
        premblyResponse: error.response?.data
      };
    }
  }

  /**
   * Extract NIN from NIN card image using OCR
   */
  async extractNINFromImage(imageBase64: string): Promise<NINExtractionResult> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/verification/nin/ocr`,
        {
          image: imageBase64,
          document_type: 'NIN_SLIP' // or 'NIN_CARD'
        },
        {
          headers: {
            'x-api-key': this.apiKey,
            'app-id': this.appId,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        extracted: response.data.status === 'success',
        ninNumber: response.data.nin_number,
        firstName: response.data.first_name,
        lastName: response.data.last_name,
        dateOfBirth: response.data.date_of_birth,
        confidence: response.data.confidence || 0
      };
    } catch (error: any) {
      console.error('Prembly NIN extraction error:', error.response?.data || error.message);
      return {
        extracted: false,
        error: error.response?.data?.message || 'NIN extraction failed'
      };
    }
  }

  /**
   * Verify NIN (National Identity Number)
   * Note: IPPIS verification is not available in Prembly API
   */
  async verifyNIN(nin: string, firstName: string, lastName: string): Promise<NINVerificationResult> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/verification/vnin-basic`,  // Correct endpoint
        {
          number: nin,
          first_name: firstName,
          last_name: lastName
        },
        {
          headers: {
            'x-api-key': this.apiKey,
            'app-id': this.appId,
            'Content-Type': 'application/json'
          }
        }
      );

      // Check multiple possible success indicators
      const isVerified = response.data.verification_status === 'verified' ||
                        response.data.verification?.status === 'VERIFIED' ||
                        response.data.verification?.status === 'verified' ||
                        (response.data.status === true && response.data.response_code === '00');

      return {
        verified: isVerified,
        confidence: response.data.verification?.confidence || (isVerified ? 95 : 0),
        premblyResponse: response.data
      };
    } catch (error: any) {
      console.error('Prembly NIN verification error:', error.response?.data || error.message);
      return {
        verified: false,
        confidence: 0,
        error: error.response?.data?.message || 'NIN verification failed',
        premblyResponse: error.response?.data
      };
    }
  }

  /**
   * Verify NIN with face match in a single call
   * This replaces separate NIN OCR and face matching
   */
  async verifyNINWithFace(nin: string, dateOfBirth: string, faceImageBase64: string): Promise<{
    ninVerified: boolean;
    faceMatched: boolean;
    confidence?: number;
    data?: any;
    error?: string;
  }> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/verification/nin_w_face`,  // Combined NIN + Face endpoint
        {
          number_nin: nin,  // Correct parameter name from Prembly docs
          date_of_birth: dateOfBirth,
          image: faceImageBase64
        },
        {
          headers: {
            'x-api-key': this.apiKey,
            'app-id': this.appId,
            'Content-Type': 'application/json'
          }
        }
      );

      const isVerified = response.data.verification_status === 'verified' ||
                        response.data.verification?.status === 'VERIFIED' ||
                        (response.data.status === true && response.data.response_code === '00');
      
      const isFaceMatched = response.data.face_matched === true ||
                           response.data.face_match === true;

      return {
        ninVerified: isVerified,
        faceMatched: isFaceMatched,
        confidence: response.data.confidence || response.data.verification?.confidence || 90,
        data: response.data
      };
    } catch (error: any) {
      console.error('Prembly NIN with face error:', error.response?.data || error.message);
      return {
        ninVerified: false,
        faceMatched: false,
        error: error.response?.data?.message || 'NIN with face verification failed'
      };
    }
  }

  /**
   * Comprehensive verification for PayLater application
   * Note: IPPIS is not available in Prembly - we skip it
   * We use NIN provided by user (not extracted from image)
   */
  async verifyPaylaterApplicant(data: {
    ippis: string;  // Collected but not verified (Prembly doesn't support IPPIS)
    bvn: string;
    nin: string;  // User provides NIN number
    dateOfBirth: string;  // Required for NIN verification (YYYY-MM-DD format)
    passportPhotoBase64: string;
    firstName: string;
    lastName: string;
  }): Promise<ComprehensiveVerificationResult> {
    const results: ComprehensiveVerificationResult = {
      ippis: { verified: false, error: 'IPPIS verification not available in Prembly API' },
      bvn: { verified: false },
      nin: { extracted: false, verified: false },
      faceMatch: undefined,
      overallVerified: false,
      verificationScore: 0
    };

    // Step 1: Verify BVN (50 points)
    console.log('[Prembly] Verifying BVN...');
    results.bvn = await this.verifyBVN(data.bvn, data.firstName, data.lastName);

    // Step 2: Verify NIN with Face Match (combined: 30pts NIN + 20pts face)
    if (data.nin && data.dateOfBirth) {
      console.log('[Prembly] Verifying NIN with face match...');
      const ninWithFace = await this.verifyNINWithFace(
        data.nin,
        data.dateOfBirth,
        data.passportPhotoBase64
      );

      results.nin.verified = ninWithFace.ninVerified;
      results.nin.extractedNumber = data.nin;  // Use provided NIN
      results.faceMatch = {
        matched: ninWithFace.faceMatched,
        confidence: ninWithFace.confidence
      };

      if (!ninWithFace.ninVerified || !ninWithFace.faceMatched) {
        results.nin.error = ninWithFace.error || 'NIN or face verification failed';
      }
    } else {
      results.nin.error = 'NIN number not provided';
    }

    // Calculate verification score (out of 100)
    let score = 0;
    if (results.bvn.verified) score += 50;  // BVN (increased from 30)
    if (results.nin.verified) score += 30;  // NIN verification
    if (results.faceMatch?.matched) score += 20;  // Face match

    results.verificationScore = score;
    results.overallVerified = score >= 70;  // Lowered threshold since no IPPIS

    console.log(`[Prembly] Verification complete. Score: ${score}/100`);
    console.log(`[Prembly] BVN: ${results.bvn.verified ? '✓' : '✗'}, NIN: ${results.nin.verified ? '✓' : '✗'}, Face: ${results.faceMatch?.matched ? '✓' : '✗'}`);
    
    return results;
  }
}

export default new PremblyService();
