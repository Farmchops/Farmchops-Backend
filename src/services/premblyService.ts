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

      return {
        verified: response.data.verification?.status === 'verified',
        data: response.data,
        confidence: response.data.verification?.confidence || 0
      };
    } catch (error: any) {
      console.error('Prembly BVN verification error:', error.response?.data || error.message);
      return {
        verified: false,
        error: error.response?.data?.message || 'BVN verification failed'
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
   */
  async verifyNIN(nin: string, firstName: string, lastName: string): Promise<NINVerificationResult> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/verification/nin`,
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

      return {
        verified: response.data.verification?.status === 'verified',
        data: response.data,
        confidence: response.data.verification?.confidence || 0
      };
    } catch (error: any) {
      console.error('Prembly NIN verification error:', error.response?.data || error.message);
      return {
        verified: false,
        error: error.response?.data?.message || 'NIN verification failed'
      };
    }
  }

  /**
   * Verify face match between passport photograph and NIN card photo
   */
  async verifyFaceMatch(passportPhotoBase64: string, ninCardBase64: string): Promise<FaceMatchResult> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/verification/face-match`,
        {
          selfie: passportPhotoBase64,
          id_photo: ninCardBase64
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
        matched: response.data.match === true,
        confidence: response.data.confidence || 0
      };
    } catch (error: any) {
      console.error('Prembly face match error:', error.response?.data || error.message);
      return {
        matched: false,
        error: error.response?.data?.message || 'Face matching failed'
      };
    }
  }

  /**
   * Comprehensive verification for PayLater application (Government Workers Only)
   */
  async verifyPaylaterApplicant(data: {
    ippis: string;
    bvn: string;
    ninCardImageBase64: string;
    passportPhotoBase64: string;
    firstName: string;
    lastName: string;
  }): Promise<ComprehensiveVerificationResult> {
    const results: ComprehensiveVerificationResult = {
      ippis: { verified: false },
      bvn: { verified: false },
      nin: { extracted: false, verified: false },
      faceMatch: undefined,
      overallVerified: false,
      verificationScore: 0
    };

    // Step 1: Verify IPPIS (Government Worker Verification)
    console.log('[Prembly] Verifying IPPIS...');
    results.ippis = await this.verifyIPPIS(data.ippis, data.firstName, data.lastName);

    // Step 2: Verify BVN
    console.log('[Prembly] Verifying BVN...');
    results.bvn = await this.verifyBVN(data.bvn, data.firstName, data.lastName);

    // Step 3: Extract NIN from card image
    console.log('[Prembly] Extracting NIN from image...');
    const ninExtraction = await this.extractNINFromImage(data.ninCardImageBase64);

    if (ninExtraction.extracted && ninExtraction.ninNumber) {
      results.nin.extracted = true;
      results.nin.extractedNumber = ninExtraction.ninNumber;

      // Step 4: Verify the extracted NIN
      console.log('[Prembly] Verifying extracted NIN...');
      const ninVerification = await this.verifyNIN(
        ninExtraction.ninNumber,
        data.firstName,
        data.lastName
      );
      results.nin.verified = ninVerification.verified;
    } else {
      results.nin.error = ninExtraction.error;
    }

    // Step 5: Face matching (required)
    console.log('[Prembly] Performing face match...');
    results.faceMatch = await this.verifyFaceMatch(
      data.passportPhotoBase64,
      data.ninCardImageBase64
    );

    // Calculate verification score
    let score = 0;
    if (results.ippis.verified) score += 30; // IPPIS verification (government worker)
    if (results.bvn.verified) score += 30; // BVN verification
    if (results.nin.extracted) score += 10; // NIN extraction
    if (results.nin.verified) score += 20; // NIN verification
    if (results.faceMatch?.matched) score += 10; // Face match

    results.verificationScore = score;
    results.overallVerified = score >= 80; // Require 80% to pass

    console.log(`[Prembly] Verification complete. Score: ${score}/100`);
    return results;
  }
}

export default new PremblyService();
