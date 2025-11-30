
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
// Ensure PORT is a number to satisfy app.listen overload
const PORT = Number(process.env.PORT || 3001);

// ID Configuration - Allow override via env but default to provided
const DEFAULT_PRINTIFY_SHOP_ID = '24702235';

// Cache for Blueprints
let catalogCache: any[] = [];
let lastCatalogFetch = 0;
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

// --- Helper Functions ---

const fetchCatalog = async (apiKey: string) => {
    const now = Date.now();
    if (catalogCache.length > 0 && (now - lastCatalogFetch < CACHE_DURATION)) {
        return catalogCache;
    }

    console.log("[Catalog] Fetching live blueprints from Printify...");
    try {
        // Fetch blueprints (this endpoint returns a list of all available blueprints)
        const response = await axios.get('https://api.printify.com/v1/catalog/blueprints.json', {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        
        catalogCache = response.data;
        lastCatalogFetch = now;
        console.log(`[Catalog] Cached ${catalogCache.length} blueprints.`);
        return catalogCache;
    } catch (error: any) {
        console.error("[Catalog] Failed to fetch catalog:", error.message);
        throw new Error("Failed to fetch Printify catalog. Check API Key.");
    }
};

const matchBlueprint = (searchTerm: string, catalog: any[]) => {
    if (!searchTerm) return null;
    
    const term = searchTerm.toLowerCase();
    const searchParts = term.split(/[\s+]+/).filter(Boolean);
    
    let bestMatch = null;
    let bestScore = 0;

    for (const bp of catalog) {
        let score = 0;
        const brand = bp.brand.toLowerCase();
        const title = bp.title.toLowerCase();
        const model = (bp.model || '').toLowerCase();

        // Scoring Logic - Heavy weight on exact model match (e.g. "3001")
        if (model === term) score += 50; 
        else if (term.includes(model)) score += 20;
        
        if (term.includes(brand)) score += 10;
        if (term.includes(title)) score += 5;
        
        // Check individual keywords
        for (const part of searchParts) {
            if (brand.includes(part) || title.includes(part) || model.includes(part)) {
                score += 2;
            }
        }

        if (score > bestScore) {
            bestScore = score;
            bestMatch = bp;
        }
    }

    // Threshold for a "good" match
    if (bestScore >= 10) {
        return bestMatch;
    }
    
    return null;
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

    return {
        productType: details['Product_Type'] || details['Product Type'],
        title: details['Title'],
        description: details['Description'],
        tags: details['Tags'] ? details['Tags'].split(',').map(t => t.trim()) : []
    };
};

// --- Real Logic Functions ---

const processPrintifyUpload = async (
    blueprint: any, 
    productDetails: any, 
    apiKey: string,
    storeId: string,
    mainImageEntry: AdmZip.IZipEntry,
    mockupEntries: AdmZip.IZipEntry[],
    sendProgress: (p: number, m: string) => void
) => {
    sendProgress(50, `[Printify] Connecting to API (Store ${storeId})...`);

    // 1. Upload Main Image
    const imageBase64 = mainImageEntry.getData().toString('base64');
    
    sendProgress(52, `[Printify] Uploading main artwork...`);
    
    let mainImageId;
    try {
        const uploadResponse = await axios.post(
            'https://api.printify.com/v1/uploads/images.json',
            {
                file_name: mainImageEntry.entryName,
                contents: imageBase64
            },
            {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            }
        );
        mainImageId = uploadResponse.data.id;
    } catch (err: any) {
        throw new Error(`Printify Main Image Upload Failed: ${err.response?.data?.message || err.message}`);
    }

    // 2. Upload Mockups
    const mockupIds: string[] = [];
    if (mockupEntries.length > 0) {
        sendProgress(55, `[Printify] Uploading ${mockupEntries.length} mockups...`);
        
        for (let i = 0; i < mockupEntries.length; i++) {
            const entry = mockupEntries[i];
            const mb64 = entry.getData().toString('base64');
            try {
                const mResp = await axios.post(
                    'https://api.printify.com/v1/uploads/images.json',
                    {
                        file_name: entry.entryName,
                        contents: mb64
                    },
                    { headers: { 'Authorization': `Bearer ${apiKey}` } }
                );
                mockupIds.push(mResp.data.id);
            } catch (e: any) {
                console.warn(`[Printify] Failed to upload mockup ${entry.entryName}`);
            }
        }
    }

    // 3. Intelligent Provider & Variant Selection
    sendProgress(60, `[Printify] Locating best provider for ${blueprint.title}...`);

    let selectedVariantId = 0;
    let activeProviderId = 0;
    let providerFound = false;

    try {
        // Fetch all available providers for this blueprint
        const providersResp = await axios.get(
            `https://api.printify.com/v1/catalog/blueprints/${blueprint.id}/print_providers.json`,
             { headers: { 'Authorization': `Bearer ${apiKey}` } }
        );
        let providers = providersResp.data;
        
        if (!providers || providers.length === 0) {
             throw new Error(`No print providers found for blueprint ${blueprint.id}`);
        }

        // Sort providers: Prioritize top performers but keep everyone else as fallback
        providers.sort((a: any, b: any) => {
            const priority = [29, 25, 3]; // SwiftPOD, Monster Digital, Printify Choice
            const aIdx = priority.indexOf(a.id);
            const bIdx = priority.indexOf(b.id);
            
            if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
            if (aIdx !== -1) return -1;
            if (bIdx !== -1) return 1;
            return 0;
        });

        console.log(`[Smart Select] Found ${providers.length} providers. Iterating to find availability...`);

        // Iterate through ALL providers until we find one that works
        for (const provider of providers) {
            try {
                // Fetch variants for this specific provider
                const variantsResp = await axios.get(
                    `https://api.printify.com/v1/catalog/blueprints/${blueprint.id}/print_providers/${provider.id}/variants.json`,
                    { headers: { 'Authorization': `Bearer ${apiKey}` } }
                );
                
                const variants = variantsResp.data.variants;
                
                // Find first valid, enabled variant
                const validVariant = variants.find((v: any) => v.is_enabled);

                if (validVariant) {
                    selectedVariantId = validVariant.id;
                    activeProviderId = provider.id;
                    providerFound = true;
                    
                    const logMsg = `[Smart Select] Match Found! Provider: ${provider.title} (ID: ${activeProviderId}), Variant ID: ${selectedVariantId}`;
                    console.log(logMsg);
                    sendProgress(65, `Provider Locked: ${provider.title}`);
                    break; // Exit loop on first success
                }
            } catch (innerErr: any) {
                // Silently continue to next provider
            }
        }

        if (!providerFound) {
            throw new Error(`Analyzed ${providers.length} providers but found no enabled variants for this blueprint.`);
        }

    } catch (err: any) {
         throw new Error(`Smart Provider Selection Failed: ${err.message}`);
    }

    // 4. Create Product
    sendProgress(75, `[Printify] Creating product...`);

    const galleryImages = mockupIds.map(id => ({ id }));

    const productPayload = {
        title: productDetails.title || 'Untitled',
        description: productDetails.description || '',
        tags: productDetails.tags || [],
        blueprint_id: blueprint.id,
        print_provider_id: activeProviderId,
        variants: [
            { id: selectedVariantId, price: 2900, is_enabled: true } 
        ],
        print_areas: [
            {
                variant_ids: [selectedVariantId],
                placeholders: [
                    { 
                        position: "front", 
                        images: [{ id: mainImageId, x: 0.5, y: 0.5, scale: 1, angle: 0 }] 
                    }
                ]
            }
        ],
        images: galleryImages 
    };

    try {
        const productResponse = await axios.post(
            `https://api.printify.com/v1/shops/${storeId}/products.json`,
            productPayload,
            {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            }
        );
        
        return {
            productId: productResponse.data.id,
            mockupsAdded: mockupIds.length
        };

    } catch (err: any) {
        throw new Error(`Printify Product Creation Failed: ${JSON.stringify(err.response?.data) || err.message}`);
    }
};

// --- Middleware ---

app.use(cors()); // Allow all origins to prevent connection issues
app.use(express.json() as any);

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const upload = multer({ storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
})});

// --- API Endpoint ---

// NEW: Endpoint to get catalog for frontend
app.get('/api/catalog', async (req: any, res: any) => {
    const apiKey = req.headers['authorization']?.split(' ')[1];
    if (!apiKey) return res.status(401).json({ error: "Missing API Key" });
    try {
        const catalog = await fetchCatalog(apiKey);
        res.json(catalog);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/upload', upload.single('zipFile'), async (req: any, res: any) => {
    console.log(`[REQUEST] Upload received at ${new Date().toISOString()}`);

    res.setHeader('Content-Type', 'application/x-ndjson');
    const sendProgress = (percent: number, message: string) => {
        res.write(JSON.stringify({ type: 'progress', percent, message }) + '\n');
    };

    const zipPath = req.file?.path;
    const { 
        printifyKey, 
        storeId, 
        geminiTitle, 
        geminiDescription, 
        geminiTags, 
        geminiSearchTerm, 
        geminiProductType,
        blueprintMappings
    } = req.body;

    // Use provided Store ID or default
    const activeStoreId = storeId || DEFAULT_PRINTIFY_SHOP_ID;

    if (!zipPath || !printifyKey) {
        res.status(400).write(JSON.stringify({ success: false, message: 'Missing file or API keys.' }));
        res.end();
        return;
    }

    try {
        sendProgress(10, "Extracting ZIP contents...");

        const zip = new AdmZip(zipPath);
        const zipEntries = zip.getEntries();
        
        // 1. Image Classification
        const imageEntries = zipEntries.filter(e => 
            !e.isDirectory && /\.(png|jpg|jpeg)$/i.test(e.entryName)
        );

        let mainImageEntry = imageEntries.find(e => e.entryName.toLowerCase().includes('original'));
        if (!mainImageEntry) {
            const nonMockups = imageEntries.filter(e => !e.entryName.toLowerCase().includes('mockup'));
            mainImageEntry = nonMockups.length > 0 ? nonMockups[0] : imageEntries[0];
        }

        if (!mainImageEntry) throw new Error("No valid image files found in ZIP.");
        
        const mockupEntries = imageEntries.filter(e => e.entryName !== mainImageEntry!.entryName);

        // 2. Metadata Resolution & Blueprint Matching
        let productDetails: any = {};
        let targetBlueprint: any = null;
        let productType = 'Standard';

        // Load Catalog
        sendProgress(20, "Fetching Printify Catalog...");
        const catalog = await fetchCatalog(printifyKey);

        if (geminiTitle) {
            // USE GEMINI DATA
            sendProgress(30, "Applying Gemini Intelligence...");
            productDetails = {
                title: geminiTitle,
                description: geminiDescription,
                tags: geminiTags ? geminiTags.split(',') : []
            };
            productType = geminiProductType || 'AI Detected';
        } else {
            // FALLBACK TO INTERNAL PARSING
            sendProgress(30, "Parsing text file (Legacy Mode)...");
            const textEntry = zipEntries.find(e => e.entryName.toLowerCase().endsWith('.txt') && !e.isDirectory);
            if (textEntry) {
                const text = textEntry.getData().toString('utf8');
                const parsed = parseListingDetails(text);
                productDetails = parsed;
                productType = parsed.productType || 'Parsed';
            } else {
                productDetails = { title: 'Untitled', description: 'No text file found', tags: [] };
            }
        }

        // --- BLUEPRINT MATCHING LOGIC ---
        
        // 1. Check User Overrides
        const mappings = blueprintMappings ? JSON.parse(blueprintMappings) : [];
        if (mappings.length > 0) {
            const override = mappings.find((m: any) => m.keyword.toLowerCase() === productType.toLowerCase());
            if (override) {
                 sendProgress(32, `[Override] Force mapping '${productType}' to ID ${override.blueprintId}`);
                 targetBlueprint = catalog.find((b: any) => b.id === override.blueprintId);
            }
        }

        // 2. Try Gemini Robust Search Term (e.g. "3001", "18500")
        if (!targetBlueprint && geminiSearchTerm) {
            sendProgress(35, `[Robust AI] Matching standard model: "${geminiSearchTerm}"...`);
            targetBlueprint = matchBlueprint(geminiSearchTerm, catalog);
        }
        
        // 3. Fallback: Safety Net based on productType keyword
        if (!targetBlueprint) {
            const type = (productType || '').toLowerCase();
            let safeTerm = '';
            
            if (type.includes('hoodie')) safeTerm = '18500';
            else if (type.includes('sweatshirt')) safeTerm = '18000';
            else if (type.includes('mug')) safeTerm = '11oz';
            else if (type.includes('v-neck')) safeTerm = '3005';
            else if (type.includes('tank')) safeTerm = '3480';
            else safeTerm = '3001'; // Default Safety Net is always T-Shirt
            
            sendProgress(38, `[Safety Net] Auto-selecting reliable blueprint for '${type}': Searching '${safeTerm}'`);
            targetBlueprint = matchBlueprint(safeTerm, catalog);
        }

        if (!targetBlueprint) {
            console.log(`[Proof] Policy Enforced: Ignoring listing brand/details.`);
            throw new Error("Could not identify a valid Printify Blueprint even with safety nets.");
        }

        // 3. Execution
        console.log(`[Proof] Provider Strategy: Ignoring listing preferences. Scanning all available providers...`);
        sendProgress(40, `Targeting: ${targetBlueprint.title} (${targetBlueprint.brand})`);
        
        const printifyResult = await processPrintifyUpload(
            targetBlueprint, 
            productDetails, 
            printifyKey, 
            activeStoreId,
            mainImageEntry,
            mockupEntries,
            sendProgress
        );

        sendProgress(100, "Success!");

        res.write(JSON.stringify({
            success: true,
            message: 'Product Created Successfully.',
            data: {
                blueprintId: targetBlueprint.id,
                blueprintTitle: targetBlueprint.title,
                blueprintBrand: targetBlueprint.brand,
                productType,
                listingTitle: productDetails.title,
                mockupsUploaded: printifyResult.mockupsAdded
            }
        }) + '\n');
        
    } catch (error: any) {
        console.error("[Error]", error.message);
        res.write(JSON.stringify({
            success: false,
            message: error.message || "Unknown Server Error"
        }) + '\n');
    } finally {
        if (zipPath && fs.existsSync(zipPath)) {
            try { fs.unlinkSync(zipPath); } catch (e) {}
        }
        res.end();
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
});
