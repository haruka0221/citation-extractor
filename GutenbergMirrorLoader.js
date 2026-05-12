/**
 * Gutenberg Mirror Loader - Fixed
 * Loads text files from CORS server
 */

class GutenbergMirrorLoader {
    constructor(config = {}) {
        // 設定を取得
        const gutenbergConfig = window.corpusConfig?.gutenberg;
        const corpusServerUrl = window.corpusConfig?.serverUrl;

        // serverUrlを設定（優先順位: config > corpusConfig.serverUrl > デフォルト）
        this.serverUrl = config.serverUrl || 
                         corpusServerUrl || 
                         'http://localhost:8001';

        // basePathを設定（重要！）
        this.basePath = config.basePath !== undefined ? 
                        config.basePath : 
                        (gutenbergConfig?.basePath || '');

        this.cache = new Map();
        this.loadAttempts = new Map();
        this.maxRetries = 2;

        console.log(`🔧 GutenbergMirrorLoader initialized:`);
        console.log(`   serverUrl: ${this.serverUrl}`);
        console.log(`   basePath: "${this.basePath}"`);
    }

    /**
     * Get possible paths for a PG work ID
     */
    getPossiblePaths(pgId) {
        const idStr = pgId.toString();
        const paths = [];

        // Modern structure: nested directories by digits
        if (idStr.length >= 2) {
            const digits = idStr.split('');
            const dirPath = digits.slice(0, -1).join('/');

            const urlBase = `${this.serverUrl}${this.basePath}`;

            paths.push(`${urlBase}/${dirPath}/${idStr}/${idStr}-8.txt`);
            paths.push(`${urlBase}/${dirPath}/${idStr}/${idStr}.txt`);
            paths.push(`${urlBase}/${dirPath}/${idStr}/${idStr}-0.txt`);
            paths.push(`${urlBase}/${dirPath}/${idStr}/pg${idStr}.txt`);
        }

        // Legacy structure for older works
        if (parseInt(pgId) < 10000) {
            const urlBase = `${this.serverUrl}${this.basePath}`;
            const years = this.estimateYear(pgId);

            for (const year of years) {
                paths.push(`${urlBase}/etext${year}/${idStr}-8.txt`);
                paths.push(`${urlBase}/etext${year}/${idStr}.txt`);
                paths.push(`${urlBase}/etext${year}/${idStr}-0.txt`);
                paths.push(`${urlBase}/etext${year}/pg${idStr}.txt`);
            }
        }

        return paths;
    }

    /**
     * Estimate possible etext years based on PG ID
     */
    estimateYear(pgId) {
        const years = [];
        const id = parseInt(pgId);

        if (id < 100) {
            years.push('90', '91', '92', '93', '94', '95');
        } else if (id < 1000) {
            years.push('95', '96', '97', '98', '99', '00');
        } else if (id < 5000) {
            years.push('00', '01', '02', '03', '04', '05');
        } else if (id < 10000) {
            years.push('05', '06');
        }

        return years;
    }

    /**
     * Load raw text from Gutenberg mirror via CORS server
     */
    async loadRawText(pgId) {
        const cacheKey = `raw_${pgId}`;

        // Check cache
        if (this.cache.has(cacheKey)) {
            console.log(`✅ Cache hit for PG ${pgId}`);
            return this.cache.get(cacheKey);
        }

        // Check retry limit
        const attempts = this.loadAttempts.get(pgId) || 0;
        if (attempts >= this.maxRetries) {
            throw new Error(`Max retry attempts reached for PG ${pgId}`);
        }

        console.log(`📖 Loading PG ${pgId} from CORS server...`);
        this.loadAttempts.set(pgId, attempts + 1);

        const possiblePaths = this.getPossiblePaths(pgId);
        console.log(`🔍 Trying ${possiblePaths.length} possible paths`);

        let lastError = null;

        // Try each path
        for (const url of possiblePaths) {
            try {
                console.log(`  Trying: ${url}`);
                const response = await fetch(url);

                if (response.ok) {
                    const text = await response.text();

                    // Validate
                    if (this.validateGutenbergText(text, pgId)) {
                        console.log(`✅ Loaded PG ${pgId} (${text.length} chars)`);

                        // Cache
                        this.cache.set(cacheKey, text);
                        this.loadAttempts.delete(pgId);

                        return text;
                    } else {
                        console.warn(`⚠️ Invalid format at ${url}`);
                    }
                } else {
                    console.log(`  ❌ HTTP ${response.status}`);
                    lastError = new Error(`HTTP ${response.status}`);
                }
            } catch (error) {
                console.log(`  ❌ Error: ${error.message}`);
                lastError = error;
            }
        }

        // All paths failed
        console.error(`❌ Could not load PG ${pgId}`);
        throw lastError || new Error(`File not found for PG ${pgId}`);
    }

    /**
     * Validate Gutenberg text
     */
    validateGutenbergText(text, pgId) {
        const hasStartMarker = text.includes('*** START OF') ||
            text.includes('***START OF') ||
            text.includes('*END*THE SMALL PRINT');

        const hasEndMarker = text.includes('*** END OF') ||
            text.includes('***END OF');

        const isVeryOld = parseInt(pgId) < 100;

        if (!hasStartMarker && !hasEndMarker && !isVeryOld) {
            console.warn(`⚠️ No Gutenberg markers for PG ${pgId}`);
            return false;
        }

        if (text.length < 100) {
            console.warn(`⚠️ File too short: ${text.length} chars`);
            return false;
        }

        return true;
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
        this.loadAttempts.clear();
        console.log('🧹 Cache cleared');
    }

    /**
     * Get cache stats
     */
    getCacheStats() {
        return {
            cacheSize: this.cache.size,
            totalAttempts: Array.from(this.loadAttempts.values()).reduce((a, b) => a + b, 0),
            failedWorks: this.loadAttempts.size
        };
    }
}

// Export
window.GutenbergMirrorLoader = GutenbergMirrorLoader;