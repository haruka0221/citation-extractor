/**
 * Gutenberg Mirror Loader
 * Loads text files directly from local Gutenberg mirror
 * Supports 70,000+ works with on-demand loading
 */

class GutenbergMirrorLoader {
    constructor(mirrorBasePath = null) {
        // Use config file if available, otherwise use provided path or default
        this.mirrorBasePath = mirrorBasePath || 
                             (window.GutenbergConfig && window.GutenbergConfig.mirrorBasePath) ||
                             '/mnt/c/Users/tsuts/Documents/gutenberg_text';
        this.cache = new Map();
        this.loadAttempts = new Map();
        this.maxRetries = 2;
    }

    /**
     * Get the file path for a PG work ID
     * Follows Gutenberg's directory structure
     * 
     * Examples:
     *   PG 20 → /0/2/20/20-0.txt or /0/2/0/20/pg20.txt
     *   PG 1234 → /1/2/3/1234/1234-0.txt or /1/2/3/4/pg1234.txt
     *   PG 12345 → /1/2/3/4/12345/12345-0.txt or /1/2/3/4/5/pg12345.txt
     */
    getPossiblePaths(pgId) {
        const idStr = pgId.toString();
        const paths = [];

        // Modern structure (post-2004): nested directories by digits
        if (idStr.length >= 2) {
            const digits = idStr.split('');
            let dirPath = digits.slice(0, -1).join('/');
            
            // Try with subdirectory named after work ID
            paths.push(`${this.mirrorBasePath}/${dirPath}/${idStr}/${idStr}-0.txt`);
            paths.push(`${this.mirrorBasePath}/${dirPath}/${idStr}/${idStr}.txt`);
            paths.push(`${this.mirrorBasePath}/${dirPath}/${idStr}/pg${idStr}.txt`);
            
            // Try without subdirectory
            paths.push(`${this.mirrorBasePath}/${dirPath}/${idStr}-0.txt`);
            paths.push(`${this.mirrorBasePath}/${dirPath}/pg${idStr}.txt`);
        }

        // Legacy structure (pre-2004): etextYY directories
        // Extract year from PG ID (approximate)
        const possibleYears = this.estimateYear(pgId);
        for (const year of possibleYears) {
            paths.push(`${this.mirrorBasePath}/etext${year}/${idStr}-0.txt`);
            paths.push(`${this.mirrorBasePath}/etext${year}/pg${idStr}.txt`);
            paths.push(`${this.mirrorBasePath}/etext${year}/${idStr}.txt`);
        }

        return paths;
    }

    /**
     * Estimate possible etext years based on PG ID
     * Lower IDs = older works = earlier years
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
     * Load raw text from Gutenberg mirror
     * Returns the uncleaned, original text
     */
    async loadRawText(pgId) {
        const cacheKey = `raw_${pgId}`;
        
        // Check memory cache
        if (this.cache.has(cacheKey)) {
            console.log(`✅ Cache hit for PG ${pgId}`);
            return this.cache.get(cacheKey);
        }

        // Check retry limit
        const attempts = this.loadAttempts.get(pgId) || 0;
        if (attempts >= this.maxRetries) {
            throw new Error(`Max retry attempts reached for PG ${pgId}`);
        }

        console.log(`📖 Loading raw text for PG ${pgId}...`);
        this.loadAttempts.set(pgId, attempts + 1);

        const possiblePaths = this.getPossiblePaths(pgId);
        console.log(`🔍 Trying ${possiblePaths.length} possible paths for PG ${pgId}`);

        let lastError = null;

        // Try each path sequentially
        for (const path of possiblePaths) {
            try {
                console.log(`  Attempting: ${path}`);
                const response = await fetch(path);
                
                if (response.ok) {
                    const text = await response.text();
                    
                    // Verify it's a valid Gutenberg text
                    if (this.validateGutenbergText(text, pgId)) {
                        console.log(`✅ Successfully loaded PG ${pgId} from ${path}`);
                        console.log(`📏 File size: ${text.length} characters`);
                        
                        // Cache the result
                        this.cache.set(cacheKey, text);
                        this.loadAttempts.delete(pgId);
                        
                        return text;
                    } else {
                        console.warn(`⚠️ Invalid Gutenberg format at ${path}`);
                    }
                } else {
                    lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
            } catch (error) {
                console.log(`  ❌ Failed: ${error.message}`);
                lastError = error;
            }
        }

        // All paths failed
        console.error(`❌ Could not load PG ${pgId} from any path`);
        throw lastError || new Error(`File not found for PG ${pgId}`);
    }

    /**
     * Validate that the loaded text is a genuine Gutenberg file
     */
    validateGutenbergText(text, pgId) {
        // Check for Gutenberg markers
        const hasStartMarker = text.includes('*** START OF') || 
                              text.includes('***START OF') ||
                              text.includes('*END*THE SMALL PRINT');
        
        const hasEndMarker = text.includes('*** END OF') ||
                            text.includes('***END OF');

        // Very old works might not have markers
        const isVeryOld = parseInt(pgId) < 100;

        // Must have at least one marker, or be a very old work
        if (!hasStartMarker && !hasEndMarker && !isVeryOld) {
            console.warn(`⚠️ No Gutenberg markers found for PG ${pgId}`);
            return false;
        }

        // Check minimum length (avoid corrupted files)
        if (text.length < 100) {
            console.warn(`⚠️ File too short for PG ${pgId}: ${text.length} chars`);
            return false;
        }

        return true;
    }

    /**
     * Load multiple works in parallel
     */
    async loadMultipleWorks(pgIds) {
        console.log(`📚 Loading ${pgIds.length} works in parallel...`);
        
        const results = await Promise.allSettled(
            pgIds.map(pgId => this.loadRawText(pgId))
        );

        const successful = results.filter(r => r.status === 'fulfilled');
        const failed = results.filter(r => r.status === 'rejected');

        console.log(`✅ Successfully loaded: ${successful.length}/${pgIds.length}`);
        if (failed.length > 0) {
            console.warn(`❌ Failed to load: ${failed.length} works`);
        }

        return results;
    }

    /**
     * Clear memory cache
     */
    clearCache() {
        this.cache.clear();
        this.loadAttempts.clear();
        console.log('🧹 Cache cleared');
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            cacheSize: this.cache.size,
            totalAttempts: Array.from(this.loadAttempts.values()).reduce((a, b) => a + b, 0),
            failedWorks: this.loadAttempts.size
        };
    }

    /**
     * Preload common works (optional optimization)
     */
    async preloadCommonWorks() {
        // Most cited works in literature
        const commonWorks = [
            20,    // Paradise Lost
            26,    // Paradise Lost (alt)
            58,    // Paradise Regained
            100,   // Complete Works of Shakespeare
            1342,  // Pride and Prejudice
            2701,  // Moby Dick
            1661,  // Sherlock Holmes
            84,    // Frankenstein
            98,    // A Tale of Two Cities
            11,    // Alice in Wonderland
        ];

        console.log('🚀 Preloading commonly cited works...');
        const results = await this.loadMultipleWorks(commonWorks);
        
        const loaded = results.filter(r => r.status === 'fulfilled').length;
        console.log(`✅ Preloaded ${loaded}/${commonWorks.length} common works`);
    }
}

// Export for use in other modules
window.GutenbergMirrorLoader = GutenbergMirrorLoader;
