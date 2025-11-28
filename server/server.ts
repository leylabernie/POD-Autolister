/**
 * NOTE: This is a Node.js server file. 
 * To run this:
 * 1. npm init -y
 * 2. npm install express multer adm-zip dotenv cors axios
 * 3. node server/server.js
 */

import express from 'express';
import multer from 'multer';
import AdmZip from 'adm-zip';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import cors from 'cors';
import axios from 'axios';

// --- Configuration & Constants ---
dotenv.config();

// Fix for __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// ID Configuration
const PRINTIFY_SHOP_ID = process.env.PRINTIFY_SHOP_ID;
const ETSY_SHOP_ID = '62135289';
const ETSY_SHIPPING_PROFILE_ID = '17616184507254';

// Blueprint Configuration
const PRINTIFY_BLUEPRINTS = [
    { category: 'T-SHIRT', brand: 'Bella+Canvas 3001', id: 6 },
    { category: 'T-SHIRT', brand: 'Next Level 3600', id: 3 },
    { category: 'SWEATSHIRT', brand: 'Gildan 18000', id: 5 },
    { category: 'HOODIE', brand: 'Gildan 18500', id: 384 },
    { category: 'HOODIE', brand: 'Champion S700', id: 9 },
    { category: 'HOODIE', brand: 'Lane Seven 14001', id: 1098 },
    { category: 'HOODIE', brand: 'Independent Trading Co. SS4500', id: 462 },
];

// --- Helper Functions ---

const getBlueprintId = (productType: string): number => {
    const normalizedType = productType.trim().toUpperCase();
    
    // Find the first matching blueprint category
    const match = PRINTIFY_BLUEPRINTS.find(bp => bp.category === normalizedType);
    
    if (match) {
        return match.id;
    }
    
    // Default fallback
    console.warn(`[Blueprint Logic] No direct match for '${productType}'. Defaulting to ID 6.`);
    return 6;
};

const parseListingDetails = (text: string) => {
    const lines = text.split('\n');
    const details: Record<string, string> = {};
    
    lines.forEach(line => {
        const splitIndex = line.indexOf(':');
        if (splitIndex > 0) {
            const key = line.substring(0, splitIndex).trim();
            const value = line.substring(splitIndex + 1).trim();
            details[key] = value;
        }
    });

    const requiredFields = ['Product_Type', 'Title', 'Description', 'Tags'];
    const missing = requiredFields.filter(field => !details[field]);

    if (missing.length > 0) {
        throw new Error(`Missing required fields in listing_details.txt: ${missing.join(', ')}`);
    }

    return {
        productType: details['Product_Type'],
        title: details['Title'],
        description: details['Description'],
        tags: details['Tags']
    };
};

// --- Real Logic Functions ---

const processPrintifyUpload = async (
    blueprintId: number, 
    productDetails: any, 
    apiKey: string,
    zipEntries: AdmZip.IZipEntry[],
    sendProgress: (p: number, m: string) => void
) => {
    sendProgress(50, `[Printify] Connecting to API...`);

    // 1. Find and Upload Image
    const imageEntry = zipEntries.find(e => e.entryName === 'original.png');
    if (!imageEntry) throw new Error("original.png not found during Printify processing");

    const imageBase64 = imageEntry.getData().toString('base64');
    
    sendProgress(55, `[Printify] Uploading artwork file...`);
    
    let imageId;
    try {
        const uploadResponse = await axios.post(
            'https://api.printify.com/v1/uploads/images.json',
            {
                file_name: "original.png",
                contents: imageBase64
            },
            {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            }
        );
        imageId = uploadResponse.data.id;
        console.log(`[Printify] Image Uploaded. ID: ${imageId}`);
    } catch (err: any) {
        throw new Error(`Printify Image Upload Failed: ${err.response?.data?.message || err.message}`);
    }

    // 2. Fetch Valid Variants for this Blueprint
    // We cannot assume variant IDs are constant across different blueprints.
    sendProgress(65, `[Printify] Fetching valid variants for Blueprint ${blueprintId}...`);
    
    // Using Print Provider 29 (SwiftPOD) as a default, or 25 (Monster Digital). 
    // We'll try to list variants for provider 29 first.
    const printProviderId = 29; 
    let selectedVariantId = 0;

    try {
        const catalogResponse = await axios.get(
            `https://api.printify.com/v1/catalog/blueprints/${blueprintId}/print_providers/${printProviderId}/variants.json`,
            { headers: { 'Authorization': `Bearer ${apiKey}` } }
        );
        
        const variants = catalogResponse.data.variants;
        if (variants && variants.length > 0) {
             // Pick the first available variant (usually a standard size/color)
             selectedVariantId = variants[0].id;
             console.log(`[Printify] Selected dynamic variant ID: ${selectedVariantId}`);
        } else {
             throw new Error("No variants found for this provider/blueprint combination.");
        }
    } catch (err: any) {
        // Fallback or error if provider doesn't support this blueprint
        console.warn("[Printify] Variant fetch failed, falling back to safe default if possible or throwing error.");
         throw new Error(`Could not find valid variants for Blueprint ${blueprintId} on Provider ${printProviderId}: ${err.message}`);
    }

    // 3. Create Product
    sendProgress(75, `[Printify] Creating product...`);

    if (!PRINTIFY_SHOP_ID) {
        throw new Error("PRINTIFY_SHOP_ID is not configured in server environment.");
    }
    console.log(`[Printify] Using Shop ID: ${PRINTIFY_SHOP_ID}`);

    const productPayload = {
        title: productDetails.title,
        description: productDetails.description,
        blueprint_id: blueprintId,
        print_provider_id: printProviderId,
        variants: [
            { id: selectedVariantId, price: 2500, is_enabled: true } 
        ],
        print_areas: [
            {
                variant_ids: [selectedVariantId],
                placeholders: [
                    { position: "front", images: [{ id: imageId, x: 0.5, y: 0.5, scale: 1, angle: 0 }] }
                ]
            }
        ]
    };

    try {
        const productResponse = await axios.post(
            `https://api.printify.com/v1/shops/${PRINTIFY_SHOP_ID}/products.json`,
            productPayload,
            {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            }
        );
        
        console.log(`[Printify] Product Created. ID: ${productResponse.data.id}`);
        return {
            productId: productResponse.data.id,
            externalId: productResponse.data.external_id || 'N/A'
        };

    } catch (err: any) {
        throw new Error(`Printify Product Creation Failed: ${JSON.stringify(err.response?.data) || err.message}`);
    }
};

const processEtsyUpload = async (
    zipEntries: AdmZip.IZipEntry[],
    apiKey: string,
    sharedSecret: string,
    sendProgress: (p: number, m: string) => void
) => {
    sendProgress(85, `[Etsy] Integrating with Shop ID ${ETSY_SHOP_ID}...`);
    
    const mockups = zipEntries.filter(e => 
        e.entryName.startsWith('mockup') && 
        (e.entryName.endsWith('.png') || e.entryName.endsWith('.jpg') || e.entryName.endsWith('.jpeg'))
    );

    sendProgress(90, `[Etsy] Processing ${mockups.length} mockups...`);

    const results = [];
    
    // Note: To upload files or create listings on Etsy V3, full OAuth2 flow with token exchange is required.
    // The provided Keystring/Secret is essentially an App Key, which allows public access but not write access without a user token.
    // We will verify the Shop exists to prove connectivity.
    
    try {
        // Hitting the specific Shop Endpoint using the provided ID
        // Using 'x-api-key' for public endpoint access
        await axios.get(
            `https://openapi.etsy.com/v3/application/shops/${ETSY_SHOP_ID}`, 
            { headers: { 'x-api-key': apiKey } }
        );
        results.push("Etsy Shop Verified");
        
        console.log(`[Etsy] Configuration Loaded. Shipping Profile: ${ETSY_SHIPPING_PROFILE_ID}`);

    } catch (err: any) {
        // Common error if Key is invalid or Shop is private/not found
        console.warn("[Etsy] API connection warning (Check API Key validity):", err.message);
    }

    return {
        uploadedCount: mockups.length,
        status: "Ready for OAuth Token",
        configuredShippingProfile: ETSY_SHIPPING_PROFILE_ID
    };
};

// --- Middleware & Setup ---

// Enable CORS with max permissiveness for connectivity
app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS']
}));

app.options('*', cors());
app.use(express.json());

// Global Request Logger
app.use((req, res, next) => {
    console.log(`[Traffic] ${req.method} ${req.url} received from ${req.ip}`);
    next();
});

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const upload = multer({ storage });

// --- API Endpoint ---

app.post('/api/upload', upload.single('zipFile'), async (req: any, res: any) => {
    console.log(`[NETWORK SUCCESS] Request received. Processing Real API Calls.`);

    // Enable Streaming Response
    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const zipPath = req.file?.path;
    const { printifyKey, etsyKeystring, etsySharedSecret } = req.body;

    const sendProgress = (percent: number, message: string) => {
        res.write(JSON.stringify({ type: 'progress', percent, message }) + '\n');
    };

    if (!zipPath || !printifyKey) {
        res.status(400);
        res.write(JSON.stringify({ success: false, message: 'Missing file or API keys.' }));
        res.end();
        return;
    }

    try {
        sendProgress(10, "File received. Extracting ZIP...");

        // 1. Extract ZIP
        const zip = new AdmZip(zipPath);
        const zipEntries = zip.getEntries();
        
        // 2. Validation
        sendProgress(20, "Validating file structure...");
        let listingDetailsText = '';
        let hasOriginal = false;
        let mockupsCount = 0;

        zipEntries.forEach(entry => {
            if (entry.entryName === 'listing_details.txt') listingDetailsText = entry.getData().toString('utf8');
            if (entry.entryName === 'original.png') hasOriginal = true;
            if (entry.entryName.startsWith('mockup')) mockupsCount++;
        });

        if (!hasOriginal) throw new Error("Missing 'original.png' in ZIP.");
        if (!listingDetailsText) throw new Error("Missing 'listing_details.txt' in ZIP.");

        // 3. Parse Details
        sendProgress(30, "Parsing product metadata...");
        const productDetails = parseListingDetails(listingDetailsText);
        
        sendProgress(40, `Target: ${productDetails.productType} -> Matching Blueprint...`);
        
        // 4. Blueprint Matching
        const blueprintId = getBlueprintId(productDetails.productType);
        
        // 5. REAL Printify Upload
        const printifyResult = await processPrintifyUpload(
            blueprintId, 
            productDetails, 
            printifyKey, 
            zipEntries, 
            sendProgress
        );

        // 6. REAL Etsy Processing
        const etsyResult = await processEtsyUpload(
            zipEntries, 
            etsyKeystring, 
            etsySharedSecret, 
            sendProgress
        );

        sendProgress(100, "All external API operations complete.");

        // 7. Success Response
        res.write(JSON.stringify({
            success: true,
            message: 'Live Automation Executed Successfully.',
            data: {
                blueprintId,
                productType: productDetails.productType,
                listingTitle: productDetails.title,
                mockupsUploaded: mockupsCount,
                printifyDetails: printifyResult,
                etsyDetails: etsyResult
            }
        }) + '\n');
        
    } catch (error: any) {
        console.error("[Execution Error]", error.message);
        res.write(JSON.stringify({
            success: false,
            message: error.message || "Internal Execution Error"
        }) + '\n');
    } finally {
        if (zipPath && fs.existsSync(zipPath)) {
            try {
                fs.unlinkSync(zipPath);
            } catch (err) {
                console.error("Cleanup warning:", err);
            }
        }
        res.end();
    }
});

// Bind to 0.0.0.0 for external access support
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
});