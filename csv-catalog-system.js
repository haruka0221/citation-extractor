/**
 * Complete CSV Catalog System
 * Parses pg_catalog.csv with Papa Parse and builds searchable index
 */

class CSVCatalogSystem {
    constructor() {
        this.csvCatalog = {};
        this.searchIndex = {};
        this.initialized = false;
        this.cleanedFilesPattern = /pg(\d+)_cleaned\.txt/;
    }

    /**
     * Initialize the complete CSV catalog system
     */
    async initialize() {
        console.log('🚀 Initializing CSV Catalog System...');

        try {
            // Step 1: Load Project Gutenberg catalog from CSV
            await this.loadGutenbergCatalog('./gutenberg_feeds/pg_catalog.csv');

            // Step 2: Build searchable index from CSV + cleaned files
            await this.buildSearchIndex();

            console.log('✅ CSV Catalog System initialized successfully');
            console.log(`📚 Catalog: ${Object.keys(this.csvCatalog).length} PG works`);
            console.log(`🔍 Search Index: ${Object.keys(this.searchIndex).length} search keys`);

            this.initialized = true;

        } catch (error) {
            console.error('❌ Failed to initialize CSV catalog system:', error);
            throw error;
        }
    }

    /**
     * Parse pg_catalog.csv with proper encoding using Papa Parse
     */
    async loadGutenbergCatalog(csvPath) {
        console.log('📖 Loading Gutenberg catalog from CSV...');

        try {
            // Load Papa Parse library (using CDN since we're in browser)
            if (!window.Papa) {
                await this.loadPapaParse();
            }

            // Fetch CSV content
            const response = await fetch(csvPath);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const csvText = await response.text();
            console.log(`📄 CSV loaded: ${csvText.length} characters`);

            // Parse CSV with Papa Parse
            const result = Papa.parse(csvText, {
                header: true,
                skipEmptyLines: true,
                encoding: 'utf-8',
                error: (error) => {
                    console.error('Papa Parse error:', error);
                }
            });

            console.log(`📊 Parsed ${result.data.length} CSV rows`);

            // Build lookup table: pgId → {title, author, language}
            this.csvCatalog = {};
            let processedCount = 0;
            let englishCount = 0;

            result.data.forEach((row, index) => {
                const pgId = row['Text#'];
                const title = row['Title'];
                const language = row['Language'];
                const authors = row['Authors'];

                if (pgId && title) {
                    this.csvCatalog[pgId] = {
                        title: title.trim(),
                        author: authors ? authors.trim() : 'Unknown Author',
                        language: language,
                        pgId: pgId
                    };
                    processedCount++;

                    if (language === 'en') {
                        englishCount++;
                    }

                    // Log key works for verification
                    if (title.toLowerCase().includes('paradise') ||
                        authors && authors.toLowerCase().includes('milton')) {
                        console.log(`🔍 Found: "${title}" by ${authors} (PG ${pgId})`);
                    }
                }
            });

            console.log(`✅ Processed ${processedCount} works (${englishCount} English)`);
            console.log(`📚 Catalog built with ${Object.keys(this.csvCatalog).length} entries`);

        } catch (error) {
            console.error('❌ Error loading Gutenberg catalog:', error);
            throw error;
        }
    }

    /**
     * Load Papa Parse library dynamically
     */
    async loadPapaParse() {
        return new Promise((resolve, reject) => {
            if (window.Papa) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js';
            script.onload = () => {
                console.log('📦 Papa Parse loaded');
                resolve();
            };
            script.onerror = () => {
                reject(new Error('Failed to load Papa Parse'));
            };
            document.head.appendChild(script);
        });
    }

    /**
     * Build searchable index from CSV + cleaned files
     */
    async buildSearchIndex() {
        console.log('🏗️ Building searchable index from CSV + cleaned files...');

        // Get list of cleaned files (simulate directory scan)
        const cleanedFiles = await this.getCleanedFiles();
        console.log(`📁 Found ${cleanedFiles.length} cleaned files`);

        this.searchIndex = {};
        let indexedCount = 0;

        for (const filename of cleanedFiles) {
            // Extract PG ID from filename like "pg20_cleaned.txt"
            const match = filename.match(this.cleanedFilesPattern);
            if (!match) {
                console.log(`⚠️ Skipping non-PG file: ${filename}`);
                continue;
            }

            const pgId = match[1];
            const workInfo = this.csvCatalog[pgId];

            if (!workInfo) {
                console.warn(`❌ No catalog entry for PG ${pgId} (${filename})`);
                continue;
            }

            const fileData = {
                filename,
                pgId,
                title: workInfo.title,
                author: workInfo.author,
                language: workInfo.language
            };

            // Create multiple search keys for comprehensive search
            const searchKeys = this.generateSearchKeys(workInfo);

            searchKeys.forEach(key => {
                if (!this.searchIndex[key]) {
                    this.searchIndex[key] = [];
                }
                this.searchIndex[key].push(fileData);
            });

            console.log(`✅ Indexed: ${workInfo.title} (PG ${pgId}) → ${filename}`);
            indexedCount++;
        }

        console.log(`🔍 Search index built: ${indexedCount} works indexed with ${Object.keys(this.searchIndex).length} search keys`);

        // Log some key entries for verification
        this.logIndexVerification();
    }

    /**
     * Generate comprehensive search keys for a work
     */
    generateSearchKeys(workInfo) {
        const keys = new Set();
        const title = workInfo.title.toLowerCase();
        const author = workInfo.author.toLowerCase();

        // Core title variants
        keys.add(title);
        keys.add(title.replace(/[^\w\s]/g, '')); // No punctuation
        keys.add(title.replace(/\s+/g, ''));     // No spaces

        // Author variants
        if (author && author !== 'unknown author') {
            keys.add(author);
            keys.add(`${author} ${title}`);

            // Extract last name
            const nameParts = author.split(/[,\s]+/);
            if (nameParts.length > 0) {
                const lastName = nameParts[0].toLowerCase();
                if (lastName.length > 2) {
                    keys.add(lastName);
                    keys.add(`${lastName} ${title}`);
                }
            }
        }

        // Remove "the" prefix variants
        const withoutThe = title.replace(/^the\s+/i, '');
        if (withoutThe !== title) {
            keys.add(withoutThe);
        }

        // Key words (remove common words)
        const words = title.split(/\s+/).filter(word =>
            !['the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'by'].includes(word.toLowerCase())
        );
        if (words.length > 0 && words.length < title.split(/\s+/).length) {
            keys.add(words.join(' '));
        }

        // Abbreviations for multi-word titles
        if (title.includes(' ')) {
            const titleWords = title.split(/\s+/);
            if (titleWords.length <= 4) {
                const abbrev = titleWords.map(word => word.charAt(0)).join('');
                if (abbrev.length >= 2) {
                    keys.add(abbrev);
                }
            }
        }

        return Array.from(keys);
    }

    /**
     * Get list of cleaned files (browser-compatible simulation)
     */
    async getCleanedFiles() {
        // Since we can't use fs.readdirSync in browser, we'll check known files
        const potentialFiles = [
            'pg20_cleaned.txt',     // Paradise Lost
            'pg26_cleaned.txt',     // Paradise Lost (alternate)
            'pg58_cleaned.txt',     // Paradise Regained
            'pg12242_cleaned.txt',  // Emily Dickinson
            'pg2199_cleaned.txt',   // Homer's Iliad
            'pg700_cleaned.txt',    // Dickens Old Curiosity Shop
            'pg8578_cleaned.txt',   // Dostoevsky Grand Inquisitor
            'pg_absalom_cleaned.txt', // Absalom (non-standard naming)
            'absalom_achitophel_sample.txt' // Sample file
        ];

        const existingFiles = [];

        for (const filename of potentialFiles) {
            try {
                const response = await fetch(`./test_corpus/cleaned/${filename}`, { method: 'HEAD' });
                if (response.ok) {
                    existingFiles.push(filename);
                }
            } catch (error) {
                // File doesn't exist, skip
            }
        }

        return existingFiles;
    }

    /**
     * Replace hardcoded mapping with dynamic search
     */
    findWorkFiles(searchTerm, options = {}) {
        console.log(`🔍 Searching for: "${searchTerm}"`);

        if (!this.initialized) {
            console.error('❌ CSV catalog system not initialized');
            return [];
        }

        const normalized = searchTerm.toLowerCase().trim();
        const results = [];
        const maxResults = options.maxResults || 20;

        // Direct key match (highest priority)
        if (this.searchIndex[normalized]) {
            console.log(`✅ Direct match found for "${normalized}"`);
            results.push(...this.searchIndex[normalized].map(work => ({
                ...work,
                matchType: 'exact',
                confidence: 1.0
            })));
        }

        // Fuzzy matching
        Object.entries(this.searchIndex).forEach(([key, works]) => {
            if (key === normalized) return; // Skip exact matches already added

            let similarity = 0;

            // Substring matching
            if (key.includes(normalized) || normalized.includes(key)) {
                similarity = Math.max(similarity, 0.8);
            }

            // Word overlap
            const keyWords = new Set(key.split(/\s+/));
            const searchWords = new Set(normalized.split(/\s+/));
            const intersection = new Set([...keyWords].filter(x => searchWords.has(x)));
            const union = new Set([...keyWords, ...searchWords]);
            const jaccard = intersection.size / union.size;

            if (jaccard > 0.3) {
                similarity = Math.max(similarity, jaccard * 0.9);
            }

            if (similarity > 0.4) {
                console.log(`🔗 Fuzzy match: "${normalized}" → "${key}" (${similarity.toFixed(2)})`);
                works.forEach(work => {
                    // Avoid duplicates
                    if (!results.find(r => r.pgId === work.pgId)) {
                        results.push({
                            ...work,
                            matchType: 'fuzzy',
                            confidence: similarity,
                            matchedKey: key
                        });
                    }
                });
            }
        });

        // Sort by confidence
        results.sort((a, b) => b.confidence - a.confidence);

        const limitedResults = results.slice(0, maxResults);
        console.log(`📊 Search "${searchTerm}" found ${limitedResults.length} results:`, limitedResults);

        return limitedResults;
    }

    /**
     * Log index verification for key works
     */
    logIndexVerification() {
        console.log('🔍 Index Verification:');

        // Check Paradise Lost
        const paradiseResults = this.findWorkFiles('paradise', { maxResults: 5 });
        console.log(`  "paradise" → ${paradiseResults.length} results`);

        // Check Milton
        const miltonResults = this.findWorkFiles('milton', { maxResults: 5 });
        console.log(`  "milton" → ${miltonResults.length} results`);

        // Check specific known works
        const knownSearches = ['paradise lost', 'dickinson', 'iliad', 'dickens'];
        knownSearches.forEach(search => {
            const results = this.findWorkFiles(search, { maxResults: 3 });
            console.log(`  "${search}" → ${results.length} results`);
        });
    }

    /**
     * Get catalog statistics
     */
    getCatalogStats() {
        return {
            totalCatalogWorks: Object.keys(this.csvCatalog).length,
            totalSearchKeys: Object.keys(this.searchIndex).length,
            averageKeysPerWork: Object.keys(this.searchIndex).length / Object.keys(this.csvCatalog).length,
            initialized: this.initialized
        };
    }

    /**
     * Get work details by PG ID
     */
    getWorkByPgId(pgId) {
        return this.csvCatalog[pgId] || null;
    }

    /**
     * Extract text from a work file with line range
     */
    async extractText(work, lineRange = null) {
        try {
            const response = await fetch(`./test_corpus/cleaned/${work.filename}`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const content = await response.text();
            const lines = content.split('\n').filter(line => line.trim() !== '');

            if (!lineRange) {
                return lines.slice(0, 10).join('\n'); // Preview
            }

            const { start, end } = lineRange;

            if (start < 1 || end > lines.length || start > end) {
                throw new Error(`Invalid line range: ${start}-${end} (file has ${lines.length} lines)`);
            }

            return lines.slice(start - 1, end).join('\n');

        } catch (error) {
            console.error(`❌ Failed to extract text from ${work.filename}:`, error);
            throw error;
        }
    }
}

// Initialize global CSV catalog system
let globalCSVCatalog = null;

/**
 * Initialize CSV catalog system on app load
 */
async function initializeCSVCatalogSystem() {
    try {
        console.log('🚀 Initializing CSV Catalog System...');
        globalCSVCatalog = new CSVCatalogSystem();
        await globalCSVCatalog.initialize();
        console.log('✅ CSV Catalog System ready!');
        return globalCSVCatalog;
    } catch (error) {
        console.error('❌ Failed to initialize CSV catalog system:', error);
        throw error;
    }
}

// Export for use in other modules
window.CSVCatalogSystem = CSVCatalogSystem;
window.initializeCSVCatalogSystem = initializeCSVCatalogSystem;
window.globalCSVCatalog = globalCSVCatalog;