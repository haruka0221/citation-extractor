/**
 * Dynamic Work Catalog System
 * Uses pg_catalog.csv for comprehensive Project Gutenberg metadata
 */

class DynamicWorkCatalog {
    constructor() {
        this.gutenbergData = {}; // pgId -> {title, author, language}
        this.workCatalog = {};   // searchKey -> [works]
        this.cleanedFiles = [];
        this.catalogCache = null;
        this.initialized = false;
        this.cacheVersion = '1.0';
        this.lastScanTime = null;
    }

    /**
     * Initialize the dynamic catalog system
     */
    async initialize() {
        console.log('🚀 Initializing Dynamic Work Catalog...');

        try {
            // Try to load from cache first
            const cached = await this.loadFromCache();
            if (cached && this.isCacheValid(cached)) {
                console.log('✅ Using cached catalog data');
                this.gutenbergData = cached.gutenbergData;
                this.workCatalog = cached.workCatalog;
                this.cleanedFiles = cached.cleanedFiles;
                this.lastScanTime = cached.lastScanTime;
                this.initialized = true;
                return;
            }

            // Build fresh catalog
            await this.buildFullCatalog();

            // Cache the results
            await this.saveToCache();

            console.log('✅ Dynamic catalog initialized successfully');
            this.initialized = true;

        } catch (error) {
            console.error('❌ Failed to initialize dynamic catalog:', error);
            throw error;
        }
    }

    /**
     * Build the complete catalog from scratch
     */
    async buildFullCatalog() {
        console.log('🔧 Building full catalog from pg_catalog.csv...');

        // Step 1: Parse Project Gutenberg catalog
        await this.parseProjectGutenbergCatalog();

        // Step 2: Auto-discover cleaned files
        await this.autoDiscoverCleanedFiles();

        // Step 3: Build searchable work catalog
        await this.buildWorkCatalog();

        console.log(`📊 Catalog built: ${Object.keys(this.gutenbergData).length} PG works, ${this.cleanedFiles.length} local files`);
    }

    /**
     * Parse pg_catalog.csv and create searchable index
     */
    async parseProjectGutenbergCatalog() {
        console.log('📖 Parsing Project Gutenberg catalog...');

        try {
            const csvContent = await this.fetchCSV('./gutenberg_feeds/pg_catalog.csv');
            const parsed = await this.parseCSV(csvContent);

            console.log(`📚 Parsed ${parsed.length} Project Gutenberg entries`);

            // Build lookup table: pgId → {title, author, language}
            this.gutenbergData = {};
            let englishCount = 0;

            for (const row of parsed) {
                const textId = row['Text#'];
                const title = row['Title'];
                const language = row['Language'];
                const authors = row['Authors'];

                // Filter for English texts only
                if (language === 'en' && textId && title) {
                    this.gutenbergData[textId] = {
                        title: this.cleanText(title),
                        author: this.cleanText(authors || 'Unknown Author'),
                        language: language,
                        pgId: textId
                    };
                    englishCount++;
                }
            }

            console.log(`✅ Indexed ${englishCount} English Project Gutenberg works`);

        } catch (error) {
            console.error('❌ Error parsing Project Gutenberg catalog:', error);
            throw error;
        }
    }

    /**
     * Auto-discover cleaned files and map to catalog
     */
    async autoDiscoverCleanedFiles() {
        console.log('🔍 Auto-discovering cleaned files...');

        // Since we can't use fs in browser, we'll use a known list
        // In a real implementation, this would scan the directory
        const knownCleanedFiles = [
            'pg_absalom_cleaned.txt',
            'pg12242_cleaned.txt',
            'pg2199_cleaned.txt',
            'pg700_cleaned.txt',
            'pg8578_cleaned.txt',
            'absalom_achitophel_sample.txt'
        ];

        this.cleanedFiles = [];

        for (const filename of knownCleanedFiles) {
            try {
                // Check if file exists by attempting to fetch it
                const response = await fetch(`./test_corpus/cleaned/${filename}`, { method: 'HEAD' });
                if (response.ok) {
                    this.cleanedFiles.push(filename);
                    console.log(`  ✅ Found: ${filename}`);
                } else {
                    console.log(`  ⚠️ Missing: ${filename}`);
                }
            } catch (error) {
                console.log(`  ❌ Error checking ${filename}:`, error.message);
            }
        }

        console.log(`📁 Discovered ${this.cleanedFiles.length} cleaned files`);
    }

    /**
     * Build searchable work catalog
     */
    async buildWorkCatalog() {
        console.log('🏗️ Building searchable work catalog...');

        this.workCatalog = {};

        for (const filename of this.cleanedFiles) {
            // Extract Project Gutenberg ID from filename
            const pgId = filename.match(/pg(\d+)_cleaned\.txt/)?.[1];

            let workData;

            if (pgId && this.gutenbergData[pgId]) {
                // Use Project Gutenberg metadata
                workData = {
                    filename,
                    title: this.gutenbergData[pgId].title,
                    author: this.gutenbergData[pgId].author,
                    pgId: pgId,
                    source: 'gutenberg_catalog'
                };

                console.log(`  📚 Mapped ${filename} → "${workData.title}" by ${workData.author}`);
            } else {
                // Fallback: extract from filename or file content
                workData = await this.extractMetadataFromFile(filename);
                console.log(`  📄 Extracted ${filename} → "${workData.title}" by ${workData.author}`);
            }

            // Create multiple search keys
            const searchKeys = this.generateSearchKeys(workData);

            searchKeys.forEach(key => {
                if (!this.workCatalog[key]) {
                    this.workCatalog[key] = [];
                }

                this.workCatalog[key].push({
                    ...workData,
                    searchKey: key,
                    confidence: this.calculateKeyConfidence(key, workData)
                });
            });
        }

        // Sort each search key by confidence
        Object.keys(this.workCatalog).forEach(key => {
            this.workCatalog[key].sort((a, b) => b.confidence - a.confidence);
        });

        console.log(`🔍 Built catalog with ${Object.keys(this.workCatalog).length} search keys`);
    }

    /**
     * Generate multiple search keys for a work
     */
    generateSearchKeys(workData) {
        const keys = new Set();
        const title = workData.title.toLowerCase();
        const author = workData.author.toLowerCase();

        // Core search keys
        keys.add(title);
        keys.add(title.replace(/[^\w\s]/g, '')); // No punctuation
        keys.add(title.replace(/\s+/g, ''));     // No spaces

        // Author combinations
        if (author && author !== 'unknown author') {
            keys.add(`${author} ${title}`);
            keys.add(`${author.split(' ').pop()} ${title}`); // Last name + title
            keys.add(author);
            keys.add(author.split(' ').pop()); // Last name only
        }

        // Title without articles
        const withoutArticles = title.replace(/^(the|a|an)\s+/i, '');
        if (withoutArticles !== title) {
            keys.add(withoutArticles);
        }

        // Key words (remove common words)
        const words = title.split(' ').filter(word =>
            !['the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'at', 'to', 'for', 'with'].includes(word)
        );
        if (words.length > 0 && words.length < title.split(' ').length) {
            keys.add(words.join(' '));
        }

        // Abbreviations for multi-word titles
        if (title.includes(' ')) {
            const words = title.split(' ');
            if (words.length <= 4) {
                const abbrev = words.map(word => word.charAt(0)).join('');
                if (abbrev.length >= 2) {
                    keys.add(abbrev);
                }
            }
        }

        return Array.from(keys);
    }

    /**
     * Calculate confidence score for a search key
     */
    calculateKeyConfidence(key, workData) {
        const title = workData.title.toLowerCase();
        const author = workData.author.toLowerCase();

        // Exact title match = highest confidence
        if (key === title) return 1.0;

        // Author + title = high confidence
        if (key.includes(author) && key.includes(title)) return 0.95;

        // Author only = high confidence for author searches
        if (key === author) return 0.9;

        // Title without punctuation = high confidence
        if (key === title.replace(/[^\w\s]/g, '')) return 0.85;

        // Key words only = medium confidence
        if (key.split(' ').every(word => title.includes(word))) return 0.75;

        // Abbreviations = medium confidence
        if (key.length <= 4 && title.includes(' ')) return 0.7;

        // Default confidence
        return 0.6;
    }

    /**
     * Search works with fuzzy matching and multiple candidates
     */
    searchWorks(query, options = {}) {
        console.log(`🔍 Searching for: "${query}"`);

        if (!this.initialized) {
            console.error('❌ Catalog not initialized');
            return [];
        }

        const normalized = query.toLowerCase().trim();
        const results = [];
        const maxResults = options.maxResults || 20;

        // Exact match (highest priority)
        if (this.workCatalog[normalized]) {
            console.log(`✅ Exact match found for "${normalized}"`);
            results.push(...this.workCatalog[normalized].map(work => ({
                ...work,
                matchType: 'exact',
                similarity: 1.0,
                finalScore: work.confidence * 1.0
            })));
        }

        // Fuzzy matches
        Object.keys(this.workCatalog).forEach(key => {
            if (key === normalized) return; // Skip exact matches

            let similarity = 0;

            // Substring matching
            if (key.includes(normalized) || normalized.includes(key)) {
                similarity = Math.max(similarity, 0.8);
            }

            // Word overlap
            const keyWords = new Set(key.split(' '));
            const queryWords = new Set(normalized.split(' '));
            const intersection = new Set([...keyWords].filter(x => queryWords.has(x)));
            const union = new Set([...keyWords, ...queryWords]);
            const jaccard = intersection.size / union.size;

            if (jaccard > 0.3) {
                similarity = Math.max(similarity, jaccard * 0.8);
            }

            // Add fuzzy matches if similarity is high enough
            if (similarity > 0.4) {
                console.log(`🔗 Fuzzy match: "${normalized}" → "${key}" (${similarity.toFixed(2)})`);
                this.workCatalog[key].forEach(work => {
                    results.push({
                        ...work,
                        matchType: 'fuzzy',
                        similarity: similarity,
                        finalScore: work.confidence * similarity,
                        matchedKey: key
                    });
                });
            }
        });

        // Remove duplicates and rank by relevance
        const deduplicated = this.deduplicateAndRank(results, normalized);

        console.log(`📊 Found ${deduplicated.length} total matches`);
        return deduplicated.slice(0, maxResults);
    }

    /**
     * Remove duplicates and rank results
     */
    deduplicateAndRank(results, query) {
        // Remove duplicates by filename
        const seen = new Set();
        const unique = results.filter(result => {
            const key = result.filename;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        // Sort by final score (confidence * similarity)
        unique.sort((a, b) => b.finalScore - a.finalScore);

        return unique;
    }

    /**
     * Extract metadata from file when not in PG catalog
     */
    async extractMetadataFromFile(filename) {
        try {
            const content = await this.fetchFileContent(filename);
            const lines = content.split('\n').slice(0, 10);

            return {
                filename,
                title: this.inferTitleFromContent(lines),
                author: this.inferAuthorFromContent(lines),
                pgId: null,
                source: 'file_content'
            };
        } catch (error) {
            console.error(`❌ Error extracting metadata from ${filename}:`, error);
            return {
                filename,
                title: filename.replace(/\.txt$/, '').replace(/_/g, ' '),
                author: 'Unknown Author',
                pgId: null,
                source: 'filename'
            };
        }
    }

    /**
     * Cache management functions
     */
    async loadFromCache() {
        try {
            const cached = localStorage.getItem('dynamicWorkCatalog');
            return cached ? JSON.parse(cached) : null;
        } catch (error) {
            console.warn('⚠️ Error loading cache:', error);
            return null;
        }
    }

    async saveToCache() {
        try {
            const cacheData = {
                version: this.cacheVersion,
                timestamp: Date.now(),
                gutenbergData: this.gutenbergData,
                workCatalog: this.workCatalog,
                cleanedFiles: this.cleanedFiles,
                lastScanTime: Date.now()
            };

            localStorage.setItem('dynamicWorkCatalog', JSON.stringify(cacheData));
            console.log('💾 Catalog cached successfully');
        } catch (error) {
            console.warn('⚠️ Error saving cache:', error);
        }
    }

    isCacheValid(cached) {
        // Cache is valid if it's less than 24 hours old and same version
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        const age = Date.now() - cached.timestamp;

        return cached.version === this.cacheVersion && age < maxAge;
    }

    /**
     * Handle future file additions
     */
    async rescanCatalog() {
        console.log('🔄 Rescanning catalog for new files...');

        const previousFileCount = this.cleanedFiles.length;

        // Re-discover files
        await this.autoDiscoverCleanedFiles();

        if (this.cleanedFiles.length > previousFileCount) {
            console.log(`📁 Found ${this.cleanedFiles.length - previousFileCount} new files`);

            // Rebuild catalog with new files
            await this.buildWorkCatalog();

            // Update cache
            await this.saveToCache();

            console.log('✅ Catalog updated with new files');
            return this.cleanedFiles.length - previousFileCount;
        } else {
            console.log('📁 No new files found');
            return 0;
        }
    }

    /**
     * Get catalog statistics
     */
    getCatalogStats() {
        return {
            totalPGWorks: Object.keys(this.gutenbergData).length,
            totalLocalFiles: this.cleanedFiles.length,
            totalSearchKeys: Object.keys(this.workCatalog).length,
            averageKeysPerWork: this.cleanedFiles.length ?
                Object.keys(this.workCatalog).length / this.cleanedFiles.length : 0,
            cacheAge: this.lastScanTime ? Date.now() - this.lastScanTime : 0,
            initialized: this.initialized
        };
    }

    /**
     * Utility functions
     */
    async fetchCSV(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return await response.text();
    }

    async parseCSV(csvContent) {
        // Simple CSV parser that handles quoted fields
        const lines = csvContent.split('\n');
        const headers = this.parseCSVLine(lines[0]);
        const rows = [];

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            try {
                const values = this.parseCSVLine(line);
                if (values.length === headers.length) {
                    const row = {};
                    headers.forEach((header, index) => {
                        row[header] = values[index];
                    });
                    rows.push(row);
                }
            } catch (error) {
                console.warn(`⚠️ Error parsing CSV line ${i + 1}:`, error);
            }
        }

        return rows;
    }

    parseCSVLine(line) {
        const values = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }

        values.push(current.trim());
        return values;
    }

    cleanText(text) {
        return text
            .replace(/"/g, '') // Remove quotes
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();
    }

    async fetchFileContent(filename) {
        const response = await fetch(`./test_corpus/cleaned/${filename}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return await response.text();
    }

    inferTitleFromContent(lines) {
        // Look for title patterns in first few lines
        for (let i = 0; i < Math.min(lines.length, 5); i++) {
            const line = lines[i].trim();

            if (!line || line.match(/^(THE\s+)?PROJECT\s+GUTENBERG/i)) {
                continue;
            }

            if (line.match(/^[A-Z][A-Z\s&]+$/) && line.length > 3 && line.length < 100) {
                return this.cleanTitle(line);
            }

            if (line.match(/^The\s+[A-Z][a-zA-Z\s]+/)) {
                return this.cleanTitle(line);
            }
        }

        const firstLine = lines.find(line => line.trim().length > 0);
        return firstLine ? this.cleanTitle(firstLine) : 'Unknown Title';
    }

    inferAuthorFromContent(lines) {
        const authorPatterns = [
            /^[Bb]y\s+(.+)$/,
            /^[Bb]y\s*:\s*(.+)$/,
            /^[Aa]uthor\s*:\s*(.+)$/,
            /^(.+),\s*[Aa]uthor$/
        ];

        for (let i = 0; i < Math.min(lines.length, 8); i++) {
            const line = lines[i].trim();

            for (const pattern of authorPatterns) {
                const match = line.match(pattern);
                if (match) {
                    return this.cleanAuthor(match[1]);
                }
            }
        }

        for (let i = 1; i < Math.min(lines.length, 5); i++) {
            const line = lines[i].trim();
            if (line.match(/^[A-Z][a-zA-Z\s.]+$/) &&
                line.length > 3 &&
                line.length < 50 &&
                !line.includes('GUTENBERG')) {
                return this.cleanAuthor(line);
            }
        }

        return 'Unknown Author';
    }

    cleanTitle(title) {
        return title
            .replace(/^\s*THE\s+/i, '')
            .replace(/[^\w\s&'-]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    cleanAuthor(author) {
        return author
            .replace(/[^\w\s.'-]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }
}

// Export for use in other modules
window.DynamicWorkCatalog = DynamicWorkCatalog;