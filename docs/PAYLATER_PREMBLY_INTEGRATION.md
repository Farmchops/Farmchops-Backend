# Buy Now Pay Later - Prembly Integration Documentation

## Overview

This document outlines the integration of Prembly identity verification service into the FarmChops Buy Now Pay Later system. The integration replaces manual NIN number entry with NIN card image upload and adds automated identity verification.

**IMPORTANT:** This Buy Now Pay Later feature is **exclusively for government workers**. All applicants must provide a valid IPPIS (Integrated Payroll and Personnel Information System) number, which will be verified through Prembly to confirm active government employment status.

**NOTE ON NIN CARD IMAGES:** Only the **FRONT** of the NIN card is required. The `ninCardImageBack` field is **NOT NEEDED** and should be ignored in all implementations. Any references to `ninCardImageBack` in this documentation are obsolete.

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Data Flow](#data-flow)
3. [Backend Implementation](#backend-implementation)
4. [Frontend Implementation](#frontend-implementation)
5. [API Endpoints](#api-endpoints)
6. [Verification Process](#verification-process)
7. [Testing Guide](#testing-guide)

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    User (Mobile/Web App)                     │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            │ 1. Submit Application
                            │    - Personal Info
                            │    - BVN
                            │    - NIN Card Images
                            │    - Optional: Selfie
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend API Server                        │
│  ┌────────────────────────────────────────────────────┐     │
│  │           PayLater Application Controller          │     │
│  │  - Validate input                                  │     │
│  │  - Upload images to cloud storage                  │     │
│  │  - Call Prembly Service                            │     │
│  └──────────────────┬─────────────────────────────────┘     │
│                     │                                        │
│                     ▼                                        │
│  ┌────────────────────────────────────────────────────┐     │
│  │              Prembly Service                       │     │
│  │  1. Verify BVN                                     │     │
│  │  2. Extract NIN from card image (OCR)              │     │
│  │  3. Verify extracted NIN                           │     │
│  │  4. Face matching (Passport Photo vs NIN card)     │     │
│  │  5. Calculate verification score                   │     │
│  └──────────────────┬─────────────────────────────────┘     │
│                     │                                        │
│                     ▼                                        │
│  ┌────────────────────────────────────────────────────┐     │
│  │        Save Application with Results               │     │
│  │  - Store all verification data                     │     │
│  │  - Set status to 'pending'                         │     │
│  │  - Flag for manual admin review                    │     │
│  └────────────────────────────────────────────────────┘     │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │   Prembly API  │
                    └───────────────┘
```

---

## Data Flow

### Application Submission Flow

```
┌──────────┐
│  START   │
└────┬─────┘
     │
     ▼
┌─────────────────────────────────────┐
│ User fills application form:        │
│ - First Name, Last Name             │
│ - Email, Phone, Gender              │
│ - IPPIS (typed - govt workers)      │
│ - BVN (typed)                       │
│ - Upload NIN card (front & back)    │
│ - Upload Passport Photograph        │
└────┬────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────┐
│ Frontend uploads images to backend  │
│ (Using multipart/form-data)         │
└────┬────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────┐
│ Backend saves images to storage:    │
│ - AWS S3 / Cloudinary / Local       │
│ - Returns image URLs                │
└────┬────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────┐
│ Backend calls Prembly Service:      │
│ 1. verifyIPPIS()                    │
│ 2. verifyBVN()                      │
│ 3. extractNINFromImage()            │
│ 4. verifyNIN()                      │
│ 5. verifyFaceMatch()                │
└────┬────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────┐
│ Calculate Verification Score:       │
│ - IPPIS verified: 30 points         │
│ - BVN verified: 30 points           │
│ - NIN extracted: 10 points          │
│ - NIN verified: 20 points           │
│ - Face match: 10 points             │
│ TOTAL: /100                         │
└────┬────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────┐
│ Save application to database:       │
│ - User info                         │
│ - Image URLs                        │
│ - Verification results              │
│ - Verification score                │
│ - Status: verified/pending          │
└────┬────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────┐
│ Set Application Status:             │
│ Status: 'pending'                   │
│ Requires manual admin review        │
│ (NO auto-approval)                  │
└────┬────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────┐
│ Return response to frontend:        │
│ - Application ID                    │
│ - Status                            │
│ - Verification score                │
│ - Next steps                        │
└────┬────────────────────────────────┘
     │
     ▼
┌──────────┐
│   END    │
└──────────┘
```

---

## Backend Implementation

### 1. Database Schema Changes

#### PayLaterApplication Model Updates

**File:** `src/models/PayLater.ts`

```typescript
const payLaterApplicationSchema = new mongoose.Schema({
  // ========== Existing Fields ==========
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  email: { type: String, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  gender: { type: String, enum: ['male', 'female'], required: true },
  phoneNumber: { type: String, required: true },
  bvn: { type: String, required: true }, // User types this
  ippis: { type: String, required: true }, // IPPIS number (government workers only)

  // ========== UPDATED: Replace nin with ninCardImages ==========
  nin: { type: String }, // Extracted by Prembly OCR (auto-populated)
  ninCardImage: { type: String, required: true }, // URL to front of NIN card only
  // NOTE: ninCardImageBack is NOT needed - only front is required

  // ========== NEW: Passport Photograph ==========
  passportPhoto: { type: String, required: true }, // Required: URL to passport photograph

  // ========== NEW: Verification Fields ==========
  verificationStatus: {
    type: String,
    enum: ['pending', 'in_progress', 'verified', 'failed'],
    default: 'pending'
  },
  verificationResults: {
    ippis: {
      verified: { type: Boolean, default: false },
      confidence: Number,
      verifiedAt: Date,
      error: String,
      premblyResponse: mongoose.Schema.Types.Mixed
    },
    bvn: {
      verified: { type: Boolean, default: false },
      confidence: Number,
      verifiedAt: Date,
      error: String,
      premblyResponse: mongoose.Schema.Types.Mixed
    },
    nin: {
      verified: { type: Boolean, default: false },
      extractedNumber: String, // NIN extracted from image
      confidence: Number,
      verifiedAt: Date,
      error: String,
      premblyResponse: mongoose.Schema.Types.Mixed
    },
    faceMatch: {
      matched: { type: Boolean, default: false },
      confidence: Number,
      verifiedAt: Date,
      error: String
    }
  },
  verificationScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  verifiedAt: Date,

  // ========== Existing Status Field ==========
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'verified'],
    default: 'pending'
  },

  rejectionReason: String,
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: Date
}, {
  timestamps: true
});
```

---

### 2. Prembly Service

**File:** `src/services/premblyService.ts` (NEW)

```typescript
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
```

---

### 3. File Upload Service

**File:** `src/services/uploadService.ts` (NEW or UPDATE existing)

```typescript
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/paylater-applications';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req: any, file: any, cb: any) => {
  // Accept images only
  if (!file.mimetype.startsWith('image/')) {
    return cb(new Error('Only image files are allowed'), false);
  }
  cb(null, true);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max file size
  }
});

/**
 * Convert uploaded file to base64 for Prembly API
 */
export function convertImageToBase64(filePath: string): string {
  const imageBuffer = fs.readFileSync(filePath);
  return imageBuffer.toString('base64');
}
```

---

### 4. Updated Controller

**File:** `src/controllers/paylaterController.ts`

```typescript
import { Request, Response } from 'express';
import { PayLaterApplication } from '../models/PayLater';
import premblyService from '../services/premblyService';
import { convertImageToBase64 } from '../services/uploadService';
import paylaterService from '../services/paylaterService';

interface AuthRequest extends Request {
  user?: any;
}

/**
 * @route POST /api/paylater/apply
 * @desc Submit PayLater application with Prembly verification
 * @access Private
 */
export const submitApplication = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { email, firstName, lastName, gender, phoneNumber, ippis, bvn } = req.body;

    // Validate uploaded files
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    if (!files || !files.ninCardImage || !files.ninCardImage[0]) {
      return res.status(400).json({
        success: false,
        message: 'NIN card image (front) is required'
      });
    }

    // Validate required fields
    if (!email || !firstName || !lastName || !gender || !phoneNumber || !ippis || !bvn) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required: email, firstName, lastName, gender, phoneNumber, ippis, bvn'
      });
    }

    if (!['male', 'female'].includes(gender)) {
      return res.status(400).json({ success: false, message: 'Gender must be male or female' });
    }

    if (!/^\d+$/.test(ippis)) {
      return res.status(400).json({ success: false, message: 'IPPIS must contain only digits' });
    }

    if (bvn.length !== 11 || !/^\d+$/.test(bvn)) {
      return res.status(400).json({ success: false, message: 'BVN must be 11 digits' });
    }

    // Check for existing application
    const existing = await paylaterService.hasExistingApplication(req.user._id);
    if (existing.hasApplication) {
      return res.status(409).json({
        success: false,
        message: existing.status === 'pending'
          ? 'You already have a pending application'
          : 'You already have an approved PayLater account'
      });
    }

    // Get uploaded file paths
    const ninCardImagePath = files.ninCardImage[0].path;
    const ninCardImageUrl = `/uploads/paylater-applications/${files.ninCardImage[0].filename}`;

    // Validate passport photo is present
    if (!files.passportPhoto || !files.passportPhoto[0]) {
      return res.status(400).json({
        success: false,
        message: 'Passport photograph is required'
      });
    }

    const passportPhotoPath = files.passportPhoto[0].path;
    const passportPhotoUrl = `/uploads/paylater-applications/${files.passportPhoto[0].filename}`;

    // Convert images to base64 for Prembly
    const ninCardBase64 = convertImageToBase64(ninCardImagePath);
    const passportPhotoBase64 = convertImageToBase64(passportPhotoPath);

    // Verify with Prembly
    console.log(`[PayLater] Starting verification for ${email}...`);
    const verificationResults = await premblyService.verifyPaylaterApplicant({
      ippis,
      bvn,
      ninCardImageBase64: ninCardBase64,
      passportPhotoBase64: passportPhotoBase64,
      firstName,
      lastName
    });

    // Create application with verification results
    const application = await PayLaterApplication.create({
      userId: req.user._id,
      email,
      firstName,
      lastName,
      gender,
      phoneNumber,
      ippis,
      bvn,
      nin: verificationResults.nin.extractedNumber, // Auto-populated from OCR
      ninCardImage: ninCardImageUrl,
      passportPhoto: passportPhotoUrl,
      status: verificationResults.overallVerified ? 'verified' : 'pending',
      verificationStatus: verificationResults.overallVerified ? 'verified' : 'failed',
      verificationResults: {
        ippis: {
          verified: verificationResults.ippis.verified,
          confidence: verificationResults.ippis.confidence,
          verifiedAt: verificationResults.ippis.verified ? new Date() : undefined,
          error: verificationResults.ippis.error,
          premblyResponse: verificationResults.ippis.data
        },
        bvn: {
          verified: verificationResults.bvn.verified,
          confidence: verificationResults.bvn.confidence,
          verifiedAt: verificationResults.bvn.verified ? new Date() : undefined,
          error: verificationResults.bvn.error,
          premblyResponse: verificationResults.bvn.data
        },
        nin: {
          verified: verificationResults.nin.verified,
          extractedNumber: verificationResults.nin.extractedNumber,
          verifiedAt: verificationResults.nin.verified ? new Date() : undefined,
          error: verificationResults.nin.error
        },
        faceMatch: verificationResults.faceMatch ? {
          matched: verificationResults.faceMatch.matched,
          confidence: verificationResults.faceMatch.confidence,
          verifiedAt: verificationResults.faceMatch.matched ? new Date() : undefined,
          error: verificationResults.faceMatch.error
        } : undefined
      },
      verificationScore: verificationResults.verificationScore,
      verifiedAt: verificationResults.overallVerified ? new Date() : undefined
    });

    console.log(`[PayLater] Application created: ${application._id}, Score: ${verificationResults.verificationScore}/100`);

    return res.status(201).json({
      success: true,
      message: verificationResults.overallVerified
        ? 'Application submitted and verified successfully!'
        : 'Application submitted. Verification incomplete - admin review required.',
      data: {
        applicationId: application._id,
        status: application.status,
        verificationStatus: application.verificationStatus,
        verificationScore: application.verificationScore,
        submittedAt: application.createdAt,
        autoApproved: verificationResults.overallVerified
      }
    });
  } catch (error) {
    console.error('[PayLater] Application error:', error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to submit application'
    });
  }
};
```

---

### 5. Updated Routes

**File:** `src/routes/paylaterRoutes.ts`

```typescript
import { Router } from 'express';
import { submitApplication, getStatus, /* other controllers */ } from '../controllers/paylaterController';
import { authenticateToken } from '../middleware/auth';
import { upload } from '../services/uploadService';

const router = Router();

// POST /api/paylater/apply - Submit application with image uploads
router.post(
  '/apply',
  authenticateToken,
  upload.fields([
    { name: 'ninCardImage', maxCount: 1 },       // Required: front of NIN card
    { name: 'passportPhoto', maxCount: 1 }       // Required: passport photograph
  ]),
  submitApplication
);

// GET /api/paylater/status - Get application status
router.get('/status', authenticateToken, getStatus);

export default router;
```

---

### 6. Environment Variables

**File:** `.env`

```env
# Prembly API Configuration
PREMBLY_API_KEY=your_prembly_api_key_here
PREMBLY_APP_ID=your_prembly_app_id_here
PREMBLY_BASE_URL=https://api.prembly.com/identitypass
```

---

### 7. Install Required Dependencies

```bash
npm install axios multer @types/multer
```

---

## Frontend Implementation

### 1. Application Form Component

**Example: React/React Native**

```typescript
import React, { useState } from 'react';
import axios from 'axios';

interface ApplicationFormData {
  email: string;
  firstName: string;
  lastName: string;
  gender: 'male' | 'female';
  phoneNumber: string;
  ippis: string;
  bvn: string;
  ninCardImage: File | null;
  
  passportPhoto: File | null;
}

export const PayLaterApplicationForm: React.FC = () => {
  const [formData, setFormData] = useState<ApplicationFormData>({
    email: '',
    firstName: '',
    lastName: '',
    gender: 'male',
    phoneNumber: '',
    ippis: '',
    bvn: '',
    ninCardImage: null,
    ninCardImageBack: null,
    passportPhoto: null
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleImageUpload = (field: keyof ApplicationFormData, file: File) => {
    setFormData(prev => ({ ...prev, [field]: file }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Create FormData for multipart upload
      const formDataToSend = new FormData();
      formDataToSend.append('email', formData.email);
      formDataToSend.append('firstName', formData.firstName);
      formDataToSend.append('lastName', formData.lastName);
      formDataToSend.append('gender', formData.gender);
      formDataToSend.append('phoneNumber', formData.phoneNumber);
      formDataToSend.append('ippis', formData.ippis);
      formDataToSend.append('bvn', formData.bvn);

      // Append images
      if (formData.ninCardImage) {
        formDataToSend.append('ninCardImage', formData.ninCardImage);
      }
      if (formData.ninCardImageBack) {
        formDataToSend.append('ninCardImageBack', formData.ninCardImageBack);
      }
      if (formData.passportPhoto) {
        formDataToSend.append('passportPhoto', formData.passportPhoto);
      }

      // Submit to backend
      const response = await axios.post('/api/paylater/apply', formDataToSend, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.data.success) {
        setSuccess(true);
        // Show success message or redirect
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Application failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Personal Information */}
      <input
        type="text"
        placeholder="First Name"
        value={formData.firstName}
        onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
        required
      />

      <input
        type="text"
        placeholder="Last Name"
        value={formData.lastName}
        onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
        required
      />

      <input
        type="email"
        placeholder="Email"
        value={formData.email}
        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
        required
      />

      <input
        type="tel"
        placeholder="Phone Number"
        value={formData.phoneNumber}
        onChange={(e) => setFormData(prev => ({ ...prev, phoneNumber: e.target.value }))}
        required
      />

      <select
        value={formData.gender}
        onChange={(e) => setFormData(prev => ({ ...prev, gender: e.target.value as 'male' | 'female' }))}
        required
      >
        <option value="male">Male</option>
        <option value="female">Female</option>
      </select>

      {/* IPPIS */}
      <input
        type="text"
        placeholder="IPPIS Number (Government Workers Only)"
        value={formData.ippis}
        onChange={(e) => setFormData(prev => ({ ...prev, ippis: e.target.value }))}
        pattern="\d+"
        required
      />

      {/* BVN */}
      <input
        type="text"
        placeholder="BVN (11 digits)"
        value={formData.bvn}
        onChange={(e) => setFormData(prev => ({ ...prev, bvn: e.target.value }))}
        maxLength={11}
        pattern="\d{11}"
        required
      />

      {/* NIN Card Image (Front) - REQUIRED */}
      <div>
        <label>Upload NIN Card (Front) *</label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => e.target.files && handleImageUpload('ninCardImage', e.target.files[0])}
          required
        />
      </div>

      {/* NIN Card Image (Back) - OPTIONAL */}
      <div>
        <label>Upload NIN Card (Back) - Optional</label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => e.target.files && handleImageUpload('ninCardImageBack', e.target.files[0])}
        />
      </div>

      {/* Passport Photograph - REQUIRED */}
      <div>
        <label>Upload Passport Photograph *</label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => e.target.files && handleImageUpload('passportPhoto', e.target.files[0])}
          required
        />
      </div>

      {error && <div style={{ color: 'red' }}>{error}</div>}
      {success && <div style={{ color: 'green' }}>Application submitted successfully!</div>}

      <button type="submit" disabled={loading}>
        {loading ? 'Submitting...' : 'Submit Application'}
      </button>
    </form>
  );
};
```

---

### 2. Mobile (React Native) Implementation

```typescript
import React, { useState } from 'react';
import { View, Text, TextInput, Button, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';

export const PayLaterApplicationScreen = () => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    gender: 'male',
    ippis: '',
    bvn: ''
  });

  const [ninCardImage, setNinCardImage] = useState(null);
  const [ninCardImageBack, setNinCardImageBack] = useState(null);
  const [passportPhoto, setPassportPhoto] = useState(null);

  const pickImage = async (setter: any) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.cancelled) {
      setter(result);
    }
  };

  const takePassportPhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.cancelled) {
      setPassportPhoto(result);
    }
  };

  const handleSubmit = async () => {
    const formDataToSend = new FormData();
    formDataToSend.append('email', formData.email);
    formDataToSend.append('firstName', formData.firstName);
    formDataToSend.append('lastName', formData.lastName);
    formDataToSend.append('gender', formData.gender);
    formDataToSend.append('phoneNumber', formData.phoneNumber);
    formDataToSend.append('ippis', formData.ippis);
    formDataToSend.append('bvn', formData.bvn);

    if (ninCardImage) {
      formDataToSend.append('ninCardImage', {
        uri: ninCardImage.uri,
        type: 'image/jpeg',
        name: 'nin_card_front.jpg'
      } as any);
    }

    if (ninCardImageBack) {
      formDataToSend.append('ninCardImageBack', {
        uri: ninCardImageBack.uri,
        type: 'image/jpeg',
        name: 'nin_card_back.jpg'
      } as any);
    }

    if (passportPhoto) {
      formDataToSend.append('passportPhoto', {
        uri: passportPhoto.uri,
        type: 'image/jpeg',
        name: 'passport_photo.jpg'
      } as any);
    }

    try {
      const response = await axios.post('https://api.farmchops.com/api/paylater/apply', formDataToSend, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${yourAuthToken}`
        }
      });

      if (response.data.success) {
        // Show success screen
        alert('Application submitted successfully!');
      }
    } catch (error) {
      alert('Application failed. Please try again.');
    }
  };

  return (
    <View>
      <TextInput
        placeholder="First Name"
        value={formData.firstName}
        onChangeText={(text) => setFormData({ ...formData, firstName: text })}
      />

      {/* Other input fields... */}

      <Button title="Upload NIN Card (Front)" onPress={() => pickImage(setNinCardImage)} />
      {ninCardImage && <Image source={{ uri: ninCardImage.uri }} style={{ width: 200, height: 120 }} />}

      <Button title="Upload NIN Card (Back)" onPress={() => pickImage(setNinCardImageBack)} />

      <Button title="Take Passport Photo" onPress={takePassportPhoto} />
      {passportPhoto && <Image source={{ uri: passportPhoto.uri }} style={{ width: 200, height: 200 }} />}

      <Button title="Submit Application" onPress={handleSubmit} />
    </View>
  );
};
```

---

## API Endpoints

### POST /api/paylater/apply

**Submit PayLater application with verification**

**Headers:**
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Request Body (multipart/form-data):**
```
email: string
firstName: string
lastName: string
gender: 'male' | 'female'
phoneNumber: string
ippis: string (required - government workers only)
bvn: string (11 digits)
ninCardImage: File (required - front of NIN card only, back NOT needed)
passportPhoto: File (required - passport photograph)
```

**NOTE:** Only the front of the NIN card is required. Do NOT upload or request `ninCardImageBack`.

**Success Response (201):**
```json
{
  "success": true,
  "message": "Application submitted successfully! Awaiting admin review.",
  "data": {
    "applicationId": "64abc123...",
    "status": "pending",
    "verificationStatus": "verified",
    "verificationScore": 90,
    "submittedAt": "2026-01-02T10:30:00.000Z",
    "requiresManualReview": true
  }
}
```

**Partial Verification Response (201):**
```json
{
  "success": true,
  "message": "Application submitted. Some verification checks failed - awaiting admin review.",
  "data": {
    "applicationId": "64abc123...",
    "status": "pending",
    "verificationStatus": "partial",
    "verificationScore": 50,
    "submittedAt": "2026-01-02T10:30:00.000Z",
    "requiresManualReview": true
  }
}
```

**Error Response (400/409/500):**
```json
{
  "success": false,
  "message": "Error message here"
}
```

---

## Verification Process

### Verification Scoring System

**Note:** This feature is **restricted to government workers only** and requires IPPIS verification.

| Check | Points | Required |
|-------|--------|----------|
| IPPIS Verified (Government Worker) | 30 | Yes |
| BVN Verified | 30 | Yes |
| NIN Extracted from Image | 10 | Yes |
| NIN Verified | 20 | Yes |
| Face Match (Passport Photo vs NIN Card) | 10 | Yes |
| **Total** | **100** | - |

**Admin Review:** All applications require manual admin approval regardless of score

### Verification Flow Details

1. **IPPIS Verification (30 points) - Government Worker Only**
   - User types IPPIS number
   - Backend sends to Prembly IPPIS API
   - Prembly validates against government payroll database
   - Confirms user is active government employee
   - Checks if name matches application

2. **BVN Verification (30 points)**
   - User types BVN
   - Backend sends to Prembly BVN API
   - Prembly validates against NIBSS database
   - Checks if name matches application

3. **NIN Image Processing (30 points)**
   - User uploads NIN card photo
   - Backend sends to Prembly OCR API
   - Prembly extracts NIN number (10 points)
   - Backend sends extracted NIN to Prembly NIN API
   - Prembly verifies NIN (20 points)

4. **Face Matching (10 points) - Required**
   - User uploads passport photograph
   - Backend sends passport photo + NIN card to Prembly
   - Prembly compares faces using facial recognition
   - Verifies person in passport photo matches NIN card photo

### Admin Decision Matrix

**All applications require manual admin approval.**

The verification score helps admins make informed decisions:

| Score Range | Recommendation | Action |
|-------------|----------------|--------|
| 80-100 | Highly Recommended | Strong candidate - most checks passed |
| 50-79 | Review Carefully | Some checks failed - requires scrutiny |
| 0-49 | Not Recommended | Multiple checks failed - likely reject |

**Note:** The system does NOT auto-approve. All applications go to admin dashboard for manual approval/rejection.

---

## Testing Guide

### 1. Backend Testing

```bash
# Install dependencies
npm install

# Run tests
npm test

# Test Prembly service integration
npm run test:prembly
```

### 2. Manual Testing with Postman

**Step 1: Login**
```
POST http://localhost:5000/api/auth/login
Body: { "email": "test@example.com", "password": "password123" }
```

**Step 2: Submit Application**
```
POST http://localhost:5000/api/paylater/apply
Headers:
  Authorization: Bearer <token>
  Content-Type: multipart/form-data

Body (form-data):
  email: test@example.com
  firstName: John
  lastName: Doe
  gender: male
  phoneNumber: 08012345678
  ippis: 123456789 (government worker IPPIS number)
  bvn: 12345678901
  ninCardImage: [upload file] (required - front of NIN card)
  passportPhoto: [upload file] (required - passport photograph)
```

### 3. Test Cases

| Test Case | Expected Result |
|-----------|----------------|
| Valid BVN + Valid NIN Card | Score: 90-100, Status: pending (awaiting admin approval) |
| Valid BVN + Invalid NIN Card | Score: 50, Status: pending (awaiting admin review) |
| Invalid BVN | Score: 0-40, Status: pending (awaiting admin review) |
| Missing NIN Card Image | Error: 400 Bad Request |
| Invalid image format | Error: 400 Bad Request |
| File too large (>5MB) | Error: 413 Payload Too Large |

---

## Security Considerations

1. **Image Storage:**
   - Store images securely (S3/Cloudinary recommended)
   - Never expose direct file paths
   - Use signed URLs with expiration

2. **Sensitive Data:**
   - Never log BVN or NIN in plain text
   - Encrypt NIN in database
   - Use HTTPS for all API calls

3. **Rate Limiting:**
   - Limit applications to 1 per user
   - Rate limit Prembly API calls
   - Implement retry logic with backoff

4. **Validation:**
   - Validate all inputs server-side
   - Check image file types and sizes
   - Sanitize uploaded file names

---

## Deployment Checklist

### Backend
- [ ] Add Prembly API credentials to `.env`
- [ ] Install dependencies (`axios`, `multer`)
- [ ] Create upload directories
- [ ] Update PayLater model schema
- [ ] Deploy Prembly service
- [ ] Update routes with file upload middleware
- [ ] Test API endpoints
- [ ] Configure CORS for file uploads
- [ ] Set up image storage (S3/Cloudinary)
- [ ] Enable HTTPS

### Frontend
- [ ] Update form to include image upload fields
- [ ] Add file picker/camera integration
- [ ] Update API client for multipart/form-data
- [ ] Add image preview functionality
- [ ] Add loading states during upload
- [ ] Test on various devices
- [ ] Add error handling for failed uploads

---

## Troubleshooting

### Common Issues

**1. "BVN verification failed"**
- Check Prembly API credentials
- Verify BVN is 11 digits
- Check internet connectivity
- Verify Prembly API is not rate-limited

**2. "NIN extraction failed"**
- Ensure image is clear and high quality
- Check image file size (<5MB)
- Verify image format (JPEG/PNG)
- Ensure NIN card is fully visible in photo

**3. "File upload failed"**
- Check multer configuration
- Verify upload directory permissions
- Check file size limits
- Verify Content-Type header

**4. "Verification score is 0"**
- Check all Prembly API responses
- Verify network connectivity to Prembly
- Check API credentials
- Review application logs

---

## Admin Dashboard Updates

### Applications List Table

**Add "Verification Score" column with color-coded badges:**

| Column | Description | Example |
|--------|-------------|---------|
| APPLICANT | User's full name | Arthur Ugboh |
| CONTACT | Email and phone | arthjpr@gmail.com<br>08034111700 |
| BVN/NIN | BVN and auto-extracted NIN | BVN: 12334566644<br>NIN: 56777234445 |
| VERIFICATION SCORE | Color-coded score badge | 🟢 90/100 |
| APPLIED | Application date | 9 Dec 2025 |
| STATUS | Application status | Pending / Approved / Rejected |
| CREDIT LIMIT | Approved limit (if any) | ₦100,000 or - |
| ACTIONS | View details button | 👁️ View |

**Score Badge Colors:**
- 🟢 **Green (80-100)**: Highly Recommended - Strong candidate, most checks passed
- 🟡 **Yellow (50-79)**: Review Carefully - Some checks failed, requires scrutiny
- 🔴 **Red (0-49)**: Not Recommended - Multiple checks failed, likely reject

---

### Application Detail View

When admin clicks **👁️ View**, show comprehensive verification details:

#### Section 1: Verification Summary
```
┌────────────────────────────────────────────────────────┐
│ 📊 VERIFICATION SUMMARY                                │
├────────────────────────────────────────────────────────┤
│ Overall Score: 🟢 90/100 (Highly Recommended)         │
│ Verification Status: Verified                         │
│ Application ID: PL-2025-001234                        │
│ Submitted: 9 Dec 2025, 10:30 AM                      │
└────────────────────────────────────────────────────────┘
```

#### Section 2: Detailed Verification Results
```
┌────────────────────────────────────────────────────────┐
│ ✅ VERIFICATION DETAILS                                │
├────────────────────────────────────────────────────────┤
│                                                        │
│ 1. BVN Verification                    ✅ 50/50 pts   │
│    • BVN: 12334566644                                 │
│    • Status: Verified                                 │
│    • Confidence: 95%                                  │
│    • Name Match: ✅ Arthur Ugboh                      │
│    • Verified At: 9 Dec 2025, 10:30 AM               │
│                                                        │
│ 2. NIN Verification                    ✅ 40/40 pts   │
│    • Extracted NIN: 56777234445                       │
│    • Status: Verified                                 │
│    • Confidence: 92%                                  │
│    • Name Match: ✅ Arthur Ugboh                      │
│    • Verified At: 9 Dec 2025, 10:31 AM               │
│                                                        │
│    📸 NIN Card Images:                                 │
│    [View Front Image] [View Back Image]              │
│                                                        │
│ 3. Face Matching                       ❌ 0/10 pts    │
│    • Status: Not matched                              │
│    • Confidence: 65%                                  │
│    • Passport Photo: Uploaded                         │
│                                                        │
│    📸 Passport Photograph:                            │
│    [View Passport Photo]                              │
│                                                        │
└────────────────────────────────────────────────────────┘
```

#### Section 3: Applicant Information
```
┌────────────────────────────────────────────────────────┐
│ 📋 APPLICANT INFORMATION                               │
├────────────────────────────────────────────────────────┤
│ Full Name: Arthur Ugboh                               │
│ Email: arthjpr@gmail.com                              │
│ Phone: 08034111700                                    │
│ Gender: Male                                          │
│ BVN: 12334566644                                      │
│ NIN: 56777234445 (Auto-extracted)                    │
└────────────────────────────────────────────────────────┘
```

#### Section 4: Admin Actions
```
┌────────────────────────────────────────────────────────┐
│ 🎬 ADMIN ACTIONS                                       │
├────────────────────────────────────────────────────────┤
│                                                        │
│ Credit Limit (if approving):                          │
│ ┌────────────────────────────────────┐                │
│ │ ₦50,000                        ▼  │  [Dropdown]    │
│ └────────────────────────────────────┘                │
│ Options: ₦50,000 | ₦100,000 | ₦200,000 | ₦500,000    │
│                                                        │
│ Rejection Reason (if rejecting):                      │
│ ┌────────────────────────────────────┐                │
│ │                                    │  [Text field]  │
│ │ Enter reason for rejection...      │                │
│ └────────────────────────────────────┘                │
│                                                        │
│ [✅ Approve Application]  [❌ Reject Application]      │
│                                                        │
└────────────────────────────────────────────────────────┘
```

---

### Backend API for Admin Dashboard

#### GET /api/admin/paylater/applications

**Response:**
```json
{
  "success": true,
  "data": {
    "applications": [
      {
        "_id": "64abc123...",
        "userId": "64xyz789...",
        "firstName": "Arthur",
        "lastName": "Ugboh",
        "email": "arthjpr@gmail.com",
        "phoneNumber": "08034111700",
        "gender": "male",
        "bvn": "12334566644",
        "nin": "56777234445",
        "ninCardImage": "/uploads/paylater/nin-front-12345.jpg",
        "ninCardImageBack": "/uploads/paylater/nin-back-12345.jpg",
        "passportPhoto": "/uploads/paylater/passport-12345.jpg",
        "verificationScore": 90,
        "verificationStatus": "verified",
        "verificationResults": {
          "bvn": {
            "verified": true,
            "confidence": 95,
            "verifiedAt": "2025-12-09T10:30:00Z",
            "error": null
          },
          "nin": {
            "verified": true,
            "extractedNumber": "56777234445",
            "confidence": 92,
            "verifiedAt": "2025-12-09T10:31:00Z",
            "error": null
          },
          "faceMatch": {
            "matched": false,
            "confidence": null,
            "verifiedAt": null,
            "error": "Not provided"
          }
        },
        "status": "pending",
        "creditLimit": null,
        "approvedBy": null,
        "approvedAt": null,
        "rejectionReason": null,
        "createdAt": "2025-12-09T10:30:00Z",
        "updatedAt": "2025-12-09T10:30:00Z"
      }
    ],
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 20,
      "pages": 1
    }
  }
}
```

#### GET /api/admin/paylater/applications/:applicationId

**Response:** Same as above but single application object

#### PUT /api/admin/paylater/applications/:applicationId/approve

**Request:**
```json
{
  "creditLimit": 100000
}
```

**Response:**
```json
{
  "success": true,
  "message": "Application approved successfully",
  "data": {
    "applicationId": "64abc123...",
    "status": "approved",
    "creditLimit": 100000,
    "approvedAt": "2025-12-09T14:30:00Z"
  }
}
```

#### PUT /api/admin/paylater/applications/:applicationId/reject

**Request:**
```json
{
  "rejectionReason": "Insufficient verification score"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Application rejected",
  "data": {
    "applicationId": "64abc123...",
    "status": "rejected",
    "rejectionReason": "Insufficient verification score",
    "rejectedAt": "2025-12-09T14:30:00Z"
  }
}
```

---

## User-Facing Changes

### Application Submission Success Screen

**After user submits application:**

```
┌─────────────────────────────────────────────────────┐
│ ✅ Application Submitted Successfully!              │
├─────────────────────────────────────────────────────┤
│                                                      │
│ Your Buy Now Pay Later application has been         │
│ submitted and is under review.                      │
│                                                      │
│ 📋 Application ID: PL-2025-001234                   │
│ 📅 Submitted: 9 Dec 2025, 10:30 AM                 │
│                                                      │
│ ✅ Identity Verification: Completed                 │
│    • Bank Verification (BVN): ✅ Verified           │
│    • National Identity (NIN): ✅ Verified           │
│                                                      │
│ ⏳ Status: Pending Admin Review                     │
│                                                      │
│ 📬 What's Next?                                      │
│ • Our team will review your application             │
│ • You'll receive an email within 24-48 hours        │
│ • Check back here for updates                       │
│                                                      │
│ [View Application Status]                           │
└─────────────────────────────────────────────────────┘
```

**Note:** Verification score is NOT shown to users.

---

### Application Status Page

**GET /api/paylater/status**

#### When Pending:
```
┌─────────────────────────────────────────────────────┐
│ 📋 PayLater Application Status                      │
├─────────────────────────────────────────────────────┤
│                                                      │
│ Application ID: PL-2025-001234                      │
│ Submitted: 9 Dec 2025, 10:30 AM                    │
│                                                      │
│ ⏳ Status: Under Review                             │
│                                                      │
│ Verification Checks:                                │
│ ✅ Bank Verification (BVN): Verified                │
│ ✅ National Identity (NIN): Verified                │
│ ✅ Face Verification: Verified                      │
│                                                      │
│ Your application is being reviewed by our team.     │
│ We'll notify you via email shortly. │
│                                                      │
└─────────────────────────────────────────────────────┘
```

#### When Approved:
```
┌─────────────────────────────────────────────────────┐
│ 🎉 Application Approved!                            │
├─────────────────────────────────────────────────────┤
│                                                      │
│ Application ID: PL-2025-001234                      │
│ Approved: 9 Dec 2025, 2:30 PM                      │
│                                                      │
│ Status: Approved                                 │
│                                                      │
│ Credit Limit: ₦100,000                           │
│                                                      │
│ You can now start shopping with Buy Now Pay Later!  │
│                                                      │
│ [Start Shopping]                                    │
└─────────────────────────────────────────────────────┘
```

#### When Rejected:
```
┌─────────────────────────────────────────────────────┐
│ ❌ Application Not Approved                         │
├─────────────────────────────────────────────────────┤
│                                                      │
│ Application ID: PL-2025-001234                      │
│ Reviewed: 9 Dec 2025, 2:30 PM                      │
│                                                      │
│ ❌ Status: Not Approved                             │
│                                                      │
│ Reason:                                             │
│ Insufficient verification score. Please ensure all  │
│ submitted documents are clear and accurate.         │
│                                                      │
│ You may reapply after 30 days.                      │
│                                                      │
│ [Contact Support]                                   │
└─────────────────────────────────────────────────────┘
```

---

### User Status API Response

**GET /api/paylater/status**

```json
{
  "success": true,
  "data": {
    "hasApplication": true,
    "application": {
      "applicationId": "PL-2025-001234",
      "status": "pending",
      "submittedAt": "2025-12-09T10:30:00Z",
      "verification": {
        "bvnVerified": true,
        "ninVerified": true,
        "faceMatchCompleted": true
      },
      "creditLimit": null,
      "approvedAt": null,
      "rejectionReason": null
    }
  }
}
```

**When approved:**
```json
{
  "success": true,
  "data": {
    "hasApplication": true,
    "application": {
      "applicationId": "PL-2025-001234",
      "status": "approved",
      "submittedAt": "2025-12-09T10:30:00Z",
      "verification": {
        "bvnVerified": true,
        "ninVerified": true,
        "faceMatchCompleted": true
      },
      "creditLimit": 100000,
      "approvedAt": "2025-12-09T14:30:00Z",
      "rejectionReason": null
    }
  }
}
```

**When rejected:**
```json
{
  "success": true,
  "data": {
    "hasApplication": true,
    "application": {
      "applicationId": "PL-2025-001234",
      "status": "rejected",
      "submittedAt": "2025-12-09T10:30:00Z",
      "verification": {
        "bvnVerified": true,
        "ninVerified": false,
        "faceMatchCompleted": false
      },
      "creditLimit": null,
      "approvedAt": null,
      "rejectionReason": "Insufficient verification score"
    }
  }
}
```

---

## Key User Experience Decisions

### ✅ What Users SEE:
- Application ID
- Submission timestamp
- Verification check results (✅ BVN Verified, ✅ NIN Verified, etc.)
- Application status (Pending/Approved/Rejected)
- Credit limit (if approved)
- Rejection reason (if rejected)

### ❌ What Users DON'T SEE:
- Numerical verification score (90/100)
- Confidence percentages (95%, 92%)
- Prembly API responses
- Internal verification details

### 📧 Email Notifications:
- Send email when application status changes
- Include next steps in email
- Link to application status page

---

## Next Steps

After implementing this integration:

1. **Admin Dashboard Frontend** - Build React components for applications list and detail view
2. **User Status Page** - Build user-facing application tracking page
3. **Email Notifications** - Send emails on approval/rejection
4. **Webhooks** - Implement async verification for better UX
5. **Analytics** - Track verification success rates
6. **Retry Logic** - Add automatic retry for failed verifications

---

## Support & Resources

- **Prembly API Docs:** https://docs.prembly.com
- **Backend Repo:** [Your repo URL]
- **Frontend Repo:** [Your repo URL]
- **Support Contact:** [Your support email]

---

**Document Version:** 1.0
**Last Updated:** January 2, 2026
**Author:** FarmChops Engineering Team
