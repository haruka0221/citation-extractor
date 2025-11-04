/**
 * On-Demand Text Loader
 * Master coordinator that integrates:
 * - GutenbergMirrorLoader (raw text loading)
 * - TextCleaner (automatic cleaning)
 * - CacheManager (persistent caching)
 * 
 * Provides a simple API for loading any of 70,000+ Gutenberg works
 */

class OnDemandTextLoader {
    constructor(options = {}) {
        // Merge with global config if available
        const config = window.GutenbergConfig || {};
        
        this.mirrorPath = options.mirrorPath || 
                         config.mirrorBasePath || 
                         '/mnt/c/Users/tsuts/Documents/gutenberg_text';
        
        this.enableCache = options.enableCache !== undefined ? 
                          options.enableCache : 
                          (config.cache && config.cache.enabled !== undefined ? config.cache.enabled : true);
        
        this.enableParallelLoad = options.enableParallelLoad !== undefined ? 
                                 options.enableParallelLoad : 
                                 (config.performance && config.performance.enableParallelLoad !== undefined ? 
                                  config.performance.enableParallelLoad : true);
        
        // Initialize components
        this.mirrorLoader = new GutenbergMirrorLoader(this.mirrorPath);
        this.textCleaner = new TextCleaner();
        this.cacheManager = null; // Initialized async
        
        // Statistics
        this.stats = {
            totalRequests: 0,
            cacheHits: 0,
            cacheMisses: 0,
            cleaningTimeTotal: 0,
            loadingTimeTotal: 0
        };

        this.initialized = false;
    }

    /**
     * Initialize the on-demand loader
     */
    async initialize() {
        console.log('🚀 Initializing On-Demand Text Loader...');

        try {
            // Initialize cache manager
            if (this.enableCache) {
                this.cacheManager = new CacheManager();
                await this.cacheManager.initialize();
                console.log('✅ Cache manager ready');
            }

            // Optional: Preload common works
            // await this.mirrorLoader.preloadCommonWorks();

            this.initialized = true;
            console.log('✅ On-Demand Text Loader initialized successfully');

            // Log initial statistics
            await this.logStatus();

        } catch (error) {
            console.error('❌ Failed to initialize On-Demand Text Loader:', error);
            throw error;
        }
    }

    /**
     * Load a work by PG ID (main API method)
     * Returns cleaned text, automatically handles caching
     */
    async loadWork(pgId, options = {}) {
        if (!this.initialized) {
            throw new Error('Loader not initialized. Call initialize() first.');
        }

        this.stats.totalRequests++;
        const startTime = Date.now();

        console.log(`\n📖 Loading PG ${pgId}...`);

        try {
            // Step 1: Check cache
            if (this.enableCache && options.useCache !== false) {
                const cached = await this.cacheManager.get(pgId);
                
                if (cached) {
                    this.stats.cacheHits++;
                    console.log(`✅ PG ${pgId} loaded from cache (${Date.now() - startTime}ms)`);
                    
                    return {
                        pgId: pgId,
                        text: cached,
                        source: 'cache',
                        loadTime: Date.now() - startTime
                    };
                }
            }

            this.stats.cacheMisses++;

            // Step 2: Load raw text from mirror
            const loadStart = Date.now();
            const rawText = await this.mirrorLoader.loadRawText(pgId);
            const loadTime = Date.now() - loadStart;
            this.stats.loadingTimeTotal += loadTime;

            console.log(`📥 Raw text loaded (${loadTime}ms)`);

            // Step 3: Clean the text
            const cleanStart = Date.now();
            const cleanedText = this.textCleaner.clean(rawText, options.cleaningOptions || {});
            const cleanTime = Date.now() - cleanStart;
            this.stats.cleaningTimeTotal += cleanTime;

            console.log(`🧹 Text cleaned (${cleanTime}ms)`);

            // Step 4: Cache the cleaned text
            if (this.enableCache && options.useCache !== false) {
                await this.cacheManager.set(pgId, cleanedText, {
                    originalLength: rawText.length,
                    cleanedLength: cleanedText.length,
                    timestamp: Date.now()
                });
            }

            const totalTime = Date.now() - startTime;
            console.log(`✅ PG ${pgId} loaded and cleaned (${totalTime}ms total)`);

            return {
                pgId: pgId,
                text: cleanedText,
                source: 'mirror',
                loadTime: loadTime,
                cleanTime: cleanTime,
                totalTime: totalTime,
                stats: {
                    originalLength: rawText.length,
                    cleanedLength: cleanedText.length,
                    reductionPercent: ((1 - cleanedText.length / rawText.length) * 100).toFixed(1)
                }
            };

        } catch (error) {
            console.error(`❌ Failed to load PG ${pgId}:`, error);
            throw error;
        }
    }

    /**
     * Load multiple works in parallel
     */
    async loadMultipleWorks(pgIds, options = {}) {
        console.log(`\n📚 Loading ${pgIds.length} works in parallel...`);

        if (!this.enableParallelLoad) {
            // Load sequentially
            const results = [];
            for (const pgId of pgIds) {
                try {
                    const result = await this.loadWork(pgId, options);
                    results.push({ status: 'fulfilled', value: result });
                } catch (error) {
                    results.push({ status: 'rejected', reason: error });
                }
            }
            return results;
        }

        // Load in parallel
        const promises = pgIds.map(pgId => 
            this.loadWork(pgId, options)
                .then(result => ({ status: 'fulfilled', value: result }))
                .catch(error => ({ status: 'rejected', reason: error, pgId }))
        );

        const results = await Promise.all(promises);

        const successful = results.filter(r => r.status === 'fulfilled');
        const failed = results.filter(r => r.status === 'rejected');

        console.log(`✅ Successfully loaded: ${successful.length}/${pgIds.length}`);
        if (failed.length > 0) {
            console.warn(`❌ Failed to load: ${failed.length} works`);
            failed.forEach(f => console.warn(`  - PG ${f.pgId}: ${f.reason.message}`));
        }

        return results;
    }

    /**
     * Extract a specific line range from a work
     */
    async extractLineRange(pgId, startLine, endLine, options = {}) {
        const result = await this.loadWork(pgId, options);
        
        try {
            const excerpt = this.textCleaner.extractLineRange(result.text, startLine, endLine);
            
            return {
                pgId: pgId,
                text: excerpt,
                lineRange: { start: startLine, end: endLine },
                source: result.source
            };
        } catch (error) {
            console.error(`❌ Failed to extract lines ${startLine}-${endLine} from PG ${pgId}:`, error);
            throw error;
        }
    }

    /**
     * Search for a text snippet within a work
     */
    async searchWithinWork(pgId, searchText, options = {}) {
        const result = await this.loadWork(pgId, options);
        const lines = result.text.split('\n');
        
        const matches = [];
        const searchLower = searchText.toLowerCase();

        lines.forEach((line, index) => {
            if (line.toLowerCase().includes(searchLower)) {
                matches.push({
                    lineNumber: index + 1,
                    text: line,
                    context: this.getContext(lines, index, options.contextLines || 2)
                });
            }
        });

        console.log(`🔍 Found ${matches.length} matches for "${searchText}" in PG ${pgId}`);

        return {
            pgId: pgId,
            searchText: searchText,
            matches: matches,
            totalMatches: matches.length
        };
    }

    /**
     * Get context lines around a match
     */
    getContext(lines, centerIndex, contextLines) {
        const start = Math.max(0, centerIndex - contextLines);
        const end = Math.min(lines.length, centerIndex + contextLines + 1);
        
        return {
            before: lines.slice(start, centerIndex),
            match: lines[centerIndex],
            after: lines.slice(centerIndex + 1, end),
            lineNumbers: {
                start: start + 1,
                center: centerIndex + 1,
                end: end
            }
        };
    }

    /**
     * Preload frequently used works
     */
    async preloadCommonWorks(pgIds = null) {
        const defaultWorks = [
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

        const worksToLoad = pgIds || defaultWorks;
        
        console.log(`🚀 Preloading ${worksToLoad.length} common works...`);
        const results = await this.loadMultipleWorks(worksToLoad);
        
        const loaded = results.filter(r => r.status === 'fulfilled').length;
        console.log(`✅ Preloaded ${loaded}/${worksToLoad.length} works`);
        
        return results;
    }

    /**
     * Clear all caches
     */
    async clearAllCaches() {
        console.log('🧹 Clearing all caches...');
        
        if (this.cacheManager) {
            await this.cacheManager.clear();
        }
        
        this.mirrorLoader.clearCache();
        
        console.log('✅ All caches cleared');
    }

    /**
     * Get comprehensive statistics
     */
    async getStats() {
        const baseStats = {
            ...this.stats,
            avgLoadTime: this.stats.cacheMisses > 0 
                ? (this.stats.loadingTimeTotal / this.stats.cacheMisses).toFixed(2) 
                : 0,
            avgCleanTime: this.stats.cacheMisses > 0 
                ? (this.stats.cleaningTimeTotal / this.stats.cacheMisses).toFixed(2) 
                : 0,
            cacheHitRate: this.stats.totalRequests > 0 
                ? ((this.stats.cacheHits / this.stats.totalRequests) * 100).toFixed(1) 
                : 0
        };

        if (this.cacheManager) {
            const cacheStats = await this.cacheManager.getStats();
            return {
                ...baseStats,
                cache: cacheStats,
                mirrorLoader: this.mirrorLoader.getCacheStats()
            };
        }

        return baseStats;
    }

    /**
     * Log current status
     */
    async logStatus() {
        console.log('\n📊 On-Demand Text Loader Status:');
        
        const stats = await this.getStats();
        
        console.log('  System:');
        console.log(`    - Initialized: ${this.initialized}`);
        console.log(`    - Cache enabled: ${this.enableCache}`);
        console.log(`    - Mirror path: ${this.mirrorPath}`);
        
        console.log('\n  Performance:');
        console.log(`    - Total requests: ${stats.totalRequests}`);
        console.log(`    - Cache hits: ${stats.cacheHits} (${stats.cacheHitRate}%)`);
        console.log(`    - Cache misses: ${stats.cacheMisses}`);
        console.log(`    - Avg load time: ${stats.avgLoadTime}ms`);
        console.log(`    - Avg clean time: ${stats.avgCleanTime}ms`);
        
        if (stats.cache) {
            console.log('\n  Cache:');
            console.log(`    - Cached works: ${stats.cache.count}/${stats.cache.maxCacheSize}`);
            console.log(`    - Total size: ${stats.cache.totalSizeFormatted}`);
            console.log(`    - Utilization: ${stats.cache.utilizationPercent}%`);
            console.log(`    - Total accesses: ${stats.cache.totalAccesses}`);
        }
    }

    /**
     * Test the loader with sample works
     */
    async runTest() {
        console.log('\n🧪 Running On-Demand Text Loader Test...\n');

        const testWorks = [20, 1342, 84]; // Paradise Lost, Pride and Prejudice, Frankenstein

        console.log('Test 1: Loading works for the first time');
        let results = await this.loadMultipleWorks(testWorks);
        await this.logStatus();

        console.log('\n\nTest 2: Loading same works again (should hit cache)');
        results = await this.loadMultipleWorks(testWorks);
        await this.logStatus();

        console.log('\n\nTest 3: Extracting line range from Paradise Lost');
        const excerpt = await this.extractLineRange(20, 1, 50);
        console.log('First 50 lines:');
        console.log(excerpt.text.substring(0, 500) + '...\n');

        console.log('\n✅ Test completed successfully!');
    }
}

// Export for use in other modules
window.OnDemandTextLoader = OnDemandTextLoader;

// Global instance (initialized on demand)
window.globalTextLoader = null;

/**
 * Initialize global text loader
 */
async function initializeOnDemandLoader(options = {}) {
    try {
        console.log('🚀 Initializing global On-Demand Text Loader...');
        window.globalTextLoader = new OnDemandTextLoader(options);
        await window.globalTextLoader.initialize();
        console.log('✅ Global text loader ready!');
        return window.globalTextLoader;
    } catch (error) {
        console.error('❌ Failed to initialize global text loader:', error);
        throw error;
    }
}

window.initializeOnDemandLoader = initializeOnDemandLoader;
