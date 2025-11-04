/**
 * Extended CSV Catalog System for 70,000+ Works
 * Integrates with OnDemandTextLoader for seamless access to entire Gutenberg collection
 */

class ExtendedCSVCatalogSystem {
    constructor() {
        this.csvCatalog = {};
        this.searchIndex = {};
        this.initialized = false;
        this.textLoader = null; // OnDemandTextLoader instance
    }

    /**
     * Initialize the complete CSV catalog system with on-demand loading
     */
    async initialize() {
        console.log('🚀 Initializing Extended CSV Catalog System...');

        try {
            // Step 1: Load Project Gutenberg catalog from CSV
            await this.loadGutenbergCatalog('./gutenberg_feeds/pg_catalog.csv');

            // Step 2: Initialize On-Demand Text Loader
            if (window.OnDemandTextLoader && window.initializeOnDemandLoader) {
                console.log('📥 Initializing On-Demand Text Loader...');
                this.textLoader = await window.initializeOnDemandLoader();
                console.log('✅ On-Demand Text Loader ready');
            } else {
                console.warn('⚠️ OnDemandTextLoader not available, limited functionality');
            }

            // Step 3: Build searchable index from CSV (all 70,000 works)
            await this.buildSearchIndex();

            console.log('✅ Extended CSV Catalog System initialized successfully');
            console.log(`📚 Catalog: ${Object.keys(this.csvCatalog).length} PG works`);
            console.log(`🔍 Search Index: ${Object.keys(this.searchIndex).length} search keys`);

            this.initialized = true;

        } catch (error) {
            console.error('❌ Failed to initialize Extended CSV catalog system:', error);
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
                const subjects = row['Subjects'];

                if (pgId && title) {
                    this.csvCatalog[pgId] = {
                        title: title.trim(),
                        author: authors ? authors.trim() : 'Unknown Author',
                        language: language,
                        subjects: subjects ? subjects.trim() : '',
                        pgId: pgId
                    };
                    processedCount++;

                    if (language === 'en') {
                        englishCount++;
                    }

                    // Log key works for verification
                    if (title.toLowerCase().includes('paradise') ||
                        (authors && authors.toLowerCase().includes('milton'))) {
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
     * Build searchable index from CSV (all 70,000 works)
     * No longer requires pre-cleaned files
     */
    async buildSearchIndex() {
        console.log('🏗️ Building searchable index for ALL works in catalog...');

        this.searchIndex = {};
        let indexedCount = 0;

        // Index all works in the CSV catalog
        for (const [pgId, workInfo] of Object.entries(this.csvCatalog)) {
            const fileData = {
                pgId: pgId,
                title: workInfo.title,
                author: workInfo.author,
                language: workInfo.language,
                subjects: workInfo.subjects,
                available: true  // All works are now available on-demand
            };

            // Create multiple search keys for comprehensive search
            const searchKeys = this.generateSearchKeys(workInfo);

            searchKeys.forEach(key => {
                if (!this.searchIndex[key]) {
                    this.searchIndex[key] = [];
                }
                this.searchIndex[key].push(fileData);
            });

            indexedCount++;

            // Log progress every 1000 works
            if (indexedCount % 1000 === 0) {
                console.log(`  Indexed ${indexedCount} works...`);
            }
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

        // Subject-based keys
        if (workInfo.subjects) {
            const subjects = workInfo.subjects.toLowerCase().split(/[;,]/);
            subjects.forEach(subject => {
                const trimmed = subject.trim();
                if (trimmed.length > 3) {
                    keys.add(trimmed);
                }
            });
        }

        return Array.from(keys);
    }

    /**
     * Find works by search term (replaces old cleaned-files-only method)
     */
    findWorkFiles(searchTerm, options = {}) {
        console.log(`🔍 Searching for: "${searchTerm}"`);

        // Check if search index is available (more flexible than initialized check)
        if (!this.searchIndex || Object.keys(this.searchIndex).length === 0) {
            console.error('❌ Search index not built yet');
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
     * Extract text from any work using OnDemandTextLoader
     */
    async extractText(work, lineRange = null) {
        if (!this.textLoader) {
            throw new Error('OnDemandTextLoader not available. Initialize the system first.');
        }

        try {
            console.log(`📖 Extracting text from PG ${work.pgId}...`);

            if (lineRange) {
                // Extract specific line range
                const result = await this.textLoader.extractLineRange(
                    work.pgId,
                    lineRange.start,
                    lineRange.end
                );
                return result.text;
            } else {
                // Load full work
                const result = await this.textLoader.loadWork(work.pgId);
                
                // Return preview (first 10 lines) for large works
                const lines = result.text.split('\n');
                return lines.slice(0, 10).join('\n');
            }

        } catch (error) {
            console.error(`❌ Failed to extract text from PG ${work.pgId}:`, error);
            throw error;
        }
    }

    /**
     * Get full text of a work
     */
    async getFullText(pgId) {
        if (!this.textLoader) {
            throw new Error('OnDemandTextLoader not available. Initialize the system first.');
        }

        const result = await this.textLoader.loadWork(pgId);
        return result.text;
    }

    /**
     * Search within a specific work
     */
    async searchWithinWork(pgId, searchText) {
        if (!this.textLoader) {
            throw new Error('OnDemandTextLoader not available. Initialize the system first.');
        }

        return await this.textLoader.searchWithinWork(pgId, searchText);
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
        const knownSearches = ['paradise lost', 'shakespeare', 'dickens', 'homer'];
        knownSearches.forEach(search => {
            const results = this.findWorkFiles(search, { maxResults: 3 });
            console.log(`  "${search}" → ${results.length} results`);
            if (results.length > 0) {
                console.log(`    First result: PG ${results[0].pgId} - ${results[0].title}`);
            }
        });
    }

    /**
     * Get catalog statistics
     */
    getCatalogStats() {
        const stats = {
            totalCatalogWorks: Object.keys(this.csvCatalog).length,
            totalSearchKeys: Object.keys(this.searchIndex).length,
            averageKeysPerWork: (Object.keys(this.searchIndex).length / Object.keys(this.csvCatalog).length).toFixed(2),
            initialized: this.initialized,
            textLoaderAvailable: !!this.textLoader
        };

        if (this.textLoader) {
            stats.onDemandLoading = 'enabled';
        }

        return stats;
    }

    /**
     * Get work details by PG ID
     */
    getWorkByPgId(pgId) {
        return this.csvCatalog[pgId] || null;
    }

    /**
     * Preload commonly accessed works
     */
    async preloadCommonWorks() {
        if (!this.textLoader) {
            console.warn('⚠️ OnDemandTextLoader not available, cannot preload');
            return;
        }

        await this.textLoader.preloadCommonWorks();
    }
}

// Initialize global Extended CSV catalog system
let globalExtendedCSVCatalog = null;

/**
 * Initialize Extended CSV catalog system on app load
 */
async function initializeExtendedCSVCatalogSystem() {
    try {
        console.log('🚀 Initializing Extended CSV Catalog System...');
        globalExtendedCSVCatalog = new ExtendedCSVCatalogSystem();
        await globalExtendedCSVCatalog.initialize();
        
        // CRITICAL: Set the window global variable AFTER initialization
        window.globalExtendedCSVCatalog = globalExtendedCSVCatalog;
        
        console.log('✅ Extended CSV Catalog System ready!');
        
        // Log statistics
        const stats = globalExtendedCSVCatalog.getCatalogStats();
        console.log('📊 System Statistics:', stats);
        
        return globalExtendedCSVCatalog;
    } catch (error) {
        console.error('❌ Failed to initialize Extended CSV catalog system:', error);
        throw error;
    }
}

// Export for use in other modules
window.ExtendedCSVCatalogSystem = ExtendedCSVCatalogSystem;
window.initializeExtendedCSVCatalogSystem = initializeExtendedCSVCatalogSystem;
// Note: window.globalExtendedCSVCatalog is set in initializeExtendedCSVCatalogSystem()