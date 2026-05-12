/**
 * Extended CSV Catalog System - Unified Version
 * 統合カタログ対応：Gutenberg + Bible を統一検索
 */

class ExtendedCSVCatalogSystem {
    constructor() {
        // 統合カタログ
        this.csvCatalog = {};          // すべての作品（Gutenberg + Bible）
        this.gutenbergWorks = {};       // Gutenbergのみ
        this.bibleWorks = {};           // Bibleのみ
        
        this.searchIndex = {};
        this.initialized = false;
        this.textLoader = null;         // OnDemandTextLoader instance
        this.bibleProvider = null;      // BibleProvider instance
    }

    /**
     * Initialize the unified catalog system
     */
    async initialize() {
        console.log('🚀 Initializing Extended CSV Catalog System (Unified)...');

        try {
            // Step 1: 統合カタログまたは個別カタログを読み込み
            const config = window.corpusConfig;
            
            if (config?.catalog?.enabled) {
                console.log('📚 Loading unified catalog...');
                await this.loadUnifiedCatalog(config.catalog.path);
            } else {
                console.log('📚 Loading individual catalogs...');
                // 後方互換性：個別にロード
                await this.loadGutenbergCatalog(config.gutenberg.catalogPath);
                
                if (config?.bible?.enabled) {
                    await this.loadBibleCatalog(config.bible.vrefFile);
                }
            }

            // Step 2: Initialize On-Demand Text Loader (Gutenberg用)
            if (window.OnDemandTextLoader && window.initializeOnDemandLoader) {
                console.log('📥 Initializing On-Demand Text Loader...');
                this.textLoader = await window.initializeOnDemandLoader();
                console.log('✅ On-Demand Text Loader ready');
            }

            // Step 3: Initialize Bible Provider (Bible用)
            if (window.BibleProvider && window.corpusConfig?.bible?.enabled) {
                console.log('📖 Initializing Bible Provider...');
                this.bibleProvider = new window.BibleProvider();
                await this.bibleProvider.initialize();
                console.log('✅ Bible Provider ready');
            }

            // Step 4: Build searchable index
            await this.buildSearchIndex();

            console.log('✅ Extended CSV Catalog System initialized successfully');
            console.log(`📚 Total works: ${Object.keys(this.csvCatalog).length}`);
            console.log(`   - Gutenberg: ${Object.keys(this.gutenbergWorks).length}`);
            console.log(`   - Bible: ${Object.keys(this.bibleWorks).length}`);
            console.log(`🔍 Search Index: ${Object.keys(this.searchIndex).length} keys`);

            this.initialized = true;

        } catch (error) {
            console.error('❌ Failed to initialize Extended CSV catalog system:', error);
            throw error;
        }
    }

    /**
     * Load unified catalog (Gutenberg + Bible)
     */
    async loadUnifiedCatalog(catalogPath) {
        console.log('📖 Loading unified catalog...');

        try {
            // Load Papa Parse if needed
            if (!window.Papa) {
                await this.loadPapaParse();
            }

            // Fetch and parse CSV
            const url = window.getCorpusUrl(catalogPath);
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const csvText = await response.text();
            console.log(`📄 CSV loaded: ${csvText.length} characters`);

            const result = Papa.parse(csvText, {
                header: true,
                skipEmptyLines: true,
                encoding: 'utf-8'
            });

            console.log(`📊 Parsed ${result.data.length} CSV rows`);

            // Process each entry
            let gutenbergCount = 0;
            let bibleCount = 0;

            result.data.forEach(row => {
                const id = row['Text#'];
                const title = row['Title'];
                const source = row['Source'];

                if (id && title) {
                    const workInfo = {
                        id: id,
                        title: title.trim(),
                        author: row['Authors'] ? row['Authors'].trim() : 'Unknown',
                        language: row['Language'] || 'en',
                        subjects: row['Subjects'] ? row['Subjects'].trim() : '',
                        type: row['Type'] || 'Text',
                        source: source || 'gutenberg',
                        bibleBook: row['BibleBook'] || null,
                        chapters: row['Chapters'] ? parseInt(row['Chapters']) : null,
                        verses: row['Verses'] ? parseInt(row['Verses']) : null
                    };

                    // Add to main catalog
                    this.csvCatalog[id] = workInfo;

                    // Add to source-specific catalog
                    if (source === 'bible') {
                        this.bibleWorks[id] = workInfo;
                        bibleCount++;
                    } else {
                        this.gutenbergWorks[id] = workInfo;
                        gutenbergCount++;
                    }
                }
            });

            console.log(`✅ Unified catalog loaded:`);
            console.log(`   - Gutenberg: ${gutenbergCount} works`);
            console.log(`   - Bible: ${bibleCount} books`);

        } catch (error) {
            console.error('❌ Error loading unified catalog:', error);
            throw error;
        }
    }

    /**
     * Load Gutenberg catalog only (backward compatibility)
     */
    async loadGutenbergCatalog(csvPath) {
        console.log('📖 Loading Gutenberg catalog from CSV...');

        try {
            if (!window.Papa) {
                await this.loadPapaParse();
            }

            const url = window.getCorpusUrl(csvPath);
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const csvText = await response.text();
            const result = Papa.parse(csvText, {
                header: true,
                skipEmptyLines: true,
                encoding: 'utf-8'
            });

            console.log(`📊 Parsed ${result.data.length} Gutenberg entries`);

            result.data.forEach(row => {
                const pgId = row['Text#'];
                const title = row['Title'];

                if (pgId && title) {
                    const workInfo = {
                        id: pgId,
                        title: title.trim(),
                        author: row['Authors'] ? row['Authors'].trim() : 'Unknown',
                        language: row['Language'] || 'en',
                        subjects: row['Subjects'] ? row['Subjects'].trim() : '',
                        source: 'gutenberg',
                        type: 'Text'
                    };

                    this.csvCatalog[pgId] = workInfo;
                    this.gutenbergWorks[pgId] = workInfo;
                }
            });

            console.log(`✅ Gutenberg catalog: ${Object.keys(this.gutenbergWorks).length} works`);

        } catch (error) {
            console.error('❌ Error loading Gutenberg catalog:', error);
            throw error;
        }
    }

    /**
     * Load Bible catalog (backward compatibility)
     */
    async loadBibleCatalog(vrefPath) {
        console.log('📖 Loading Bible catalog...');

        try {
            const url = window.getCorpusUrl(vrefPath);
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: File not found`);
            }

            const vrefText = await response.text();
            const lines = vrefText.split('\n');

            // Extract unique books
            const books = new Set();
            lines.forEach(line => {
                const match = line.match(/^([A-Z0-9]+)\s+/);
                if (match) {
                    books.add(match[1]);
                }
            });

            // Bible book names mapping
            const bookNames = this.getBibleBookNames();

            // Create Bible entries
            books.forEach(abbr => {
                const id = `BIBLE_${abbr}`;
                const fullName = bookNames[abbr] || abbr;

                const workInfo = {
                    id: id,
                    title: `${fullName} (Bible)`,
                    author: 'Various',
                    language: 'en,la,grc',
                    subjects: `Bible; ${fullName}; Scripture`,
                    source: 'bible',
                    type: 'Bible',
                    bibleBook: abbr
                };

                this.csvCatalog[id] = workInfo;
                this.bibleWorks[id] = workInfo;
            });

            console.log(`✅ Bible catalog: ${books.size} books`);

        } catch (error) {
            console.error('❌ Error loading Bible catalog:', error);
            // Non-fatal: continue without Bible
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
            script.onerror = () => reject(new Error('Failed to load Papa Parse'));
            document.head.appendChild(script);
        });
    }

    /**
     * Build searchable index from unified catalog
     */
    async buildSearchIndex() {
        console.log('🏗️ Building search index for unified catalog...');

        this.searchIndex = {};
        let indexedCount = 0;

        for (const [id, workInfo] of Object.entries(this.csvCatalog)) {
            const searchKeys = this.generateSearchKeys(workInfo);

            searchKeys.forEach(key => {
                if (!this.searchIndex[key]) {
                    this.searchIndex[key] = [];
                }
                this.searchIndex[key].push({
                    id: id,
                    title: workInfo.title,
                    author: workInfo.author,
                    source: workInfo.source,
                    type: workInfo.type,
                    bibleBook: workInfo.bibleBook
                });
            });

            indexedCount++;

            if (indexedCount % 1000 === 0) {
                console.log(`  Indexed ${indexedCount} works...`);
            }
        }

        console.log(`🔍 Search index built: ${indexedCount} works, ${Object.keys(this.searchIndex).length} keys`);
        this.logIndexVerification();
    }

    /**
     * Generate search keys for a work
     */
    generateSearchKeys(workInfo) {
        const keys = new Set();
        const title = workInfo.title.toLowerCase();
        const author = workInfo.author.toLowerCase();

        // Title variants
        keys.add(title);
        keys.add(title.replace(/[^\w\s]/g, ''));
        keys.add(title.replace(/\s+/g, ''));

        // Remove "the" prefix
        const withoutThe = title.replace(/^the\s+/i, '');
        if (withoutThe !== title) {
            keys.add(withoutThe);
        }

        // Author variants
        if (author && author !== 'unknown') {
            keys.add(author);
            keys.add(`${author} ${title}`);

            // Last name
            const nameParts = author.split(/[,\s]+/);
            if (nameParts.length > 0) {
                const lastName = nameParts[0].toLowerCase();
                if (lastName.length > 2) {
                    keys.add(lastName);
                }
            }
        }

        // Bible-specific keys
        if (workInfo.bibleBook) {
            keys.add(workInfo.bibleBook.toLowerCase());
            keys.add(workInfo.bibleBook.toLowerCase() + ' bible');
            
            // Full name without "(Bible)"
            const cleanTitle = title.replace(/\s*\(bible\)\s*/i, '').trim();
            keys.add(cleanTitle);
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

        // Key words
        const words = title.split(/\s+/).filter(word =>
            !['the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'bible'].includes(word)
        );
        if (words.length > 0 && words.length < title.split(/\s+/).length) {
            keys.add(words.join(' '));
        }

        return Array.from(keys);
    }

    /**
     * Unified search: finds both Gutenberg and Bible works
     */
    findWorkFiles(searchTerm, options = {}) {
        console.log(`🔍 Searching unified catalog for: "${searchTerm}"`);

        if (!this.searchIndex || Object.keys(this.searchIndex).length === 0) {
            console.error('❌ Search index not built yet');
            return [];
        }

        const normalized = searchTerm.toLowerCase().trim();
        const results = [];
        const maxResults = options.maxResults || 20;

        // Direct key match
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
            if (key === normalized) return;

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
                works.forEach(work => {
                    if (!results.find(r => r.id === work.id)) {
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

        // Sort by confidence, then by source (Bible first for exact matches)
        results.sort((a, b) => {
            if (Math.abs(a.confidence - b.confidence) < 0.01) {
                // Same confidence: prioritize Bible for biblical terms
                if (a.source === 'bible' && b.source === 'gutenberg') return -1;
                if (a.source === 'gutenberg' && b.source === 'bible') return 1;
            }
            return b.confidence - a.confidence;
        });

        const limitedResults = results.slice(0, maxResults);
        
        console.log(`📊 Unified search results: ${limitedResults.length} works`);
        console.log(`   - Gutenberg: ${limitedResults.filter(r => r.source === 'gutenberg').length}`);
        console.log(`   - Bible: ${limitedResults.filter(r => r.source === 'bible').length}`);

        return limitedResults;
    }

    /**
     * Extract text from any work (Gutenberg or Bible)
     */
    async extractText(work, lineRange = null) {
        console.log(`📖 Extracting text from ${work.source}: ${work.id}...`);

        try {
            if (work.source === 'bible') {
                // Bible text extraction
                return await this.extractBibleText(work, lineRange);
            } else {
                // Gutenberg text extraction
                return await this.extractGutenbergText(work, lineRange);
            }
        } catch (error) {
            console.error(`❌ Failed to extract text from ${work.id}:`, error);
            throw error;
        }
    }

    /**
     * Extract text from Gutenberg work
     */
    async extractGutenbergText(work, lineRange) {
        if (!this.textLoader) {
            throw new Error('OnDemandTextLoader not available');
        }

        if (lineRange) {
            const result = await this.textLoader.extractLineRange(
                work.id,
                lineRange.start,
                lineRange.end
            );
            return result.text;
        } else {
            const result = await this.textLoader.loadWork(work.id);
            const lines = result.text.split('\n');
            return lines.slice(0, 10).join('\n');
        }
    }

    /**
     * Extract text from Bible
     */
    async extractBibleText(work, lineRange) {
        if (!this.bibleProvider) {
            throw new Error('BibleProvider not available');
        }

        // For Bible, we need chapter:verse info
        // This will be handled by BibleProvider
        if (lineRange && lineRange.chapter && lineRange.verse) {
            return await this.bibleProvider.getVerse(
                work.bibleBook,
                lineRange.chapter,
                lineRange.verse
            );
        } else {
            // Return book info
            return `${work.title}\nAuthor: ${work.author}\nChapters: ${work.chapters || 'N/A'}`;
        }
    }

    /**
     * Get full text of a work
     */
    async getFullText(id) {
        const work = this.csvCatalog[id];
        if (!work) {
            throw new Error(`Work not found: ${id}`);
        }

        if (work.source === 'bible') {
            return await this.bibleProvider.getBook(work.bibleBook);
        } else {
            const result = await this.textLoader.loadWork(id);
            return result.text;
        }
    }

    /**
     * Get work details by ID
     */
    getWorkByPgId(id) {
        return this.csvCatalog[id] || null;
    }

    /**
     * Get catalog statistics
     */
    getCatalogStats() {
        return {
            totalWorks: Object.keys(this.csvCatalog).length,
            gutenbergWorks: Object.keys(this.gutenbergWorks).length,
            bibleBooks: Object.keys(this.bibleWorks).length,
            searchKeys: Object.keys(this.searchIndex).length,
            initialized: this.initialized,
            textLoaderAvailable: !!this.textLoader,
            bibleProviderAvailable: !!this.bibleProvider
        };
    }

    /**
     * Log index verification
     */
    logIndexVerification() {
        console.log('🔍 Index Verification:');

        const testSearches = [
            'genesis',        // Should find Bible + Gutenberg
            'shakespeare',    // Should find Gutenberg only
            'paradise',       // Should find Gutenberg
            'psalm',          // Should find Bible
            'homer'           // Should find Gutenberg
        ];

        testSearches.forEach(search => {
            const results = this.findWorkFiles(search, { maxResults: 3 });
            const gutenberg = results.filter(r => r.source === 'gutenberg').length;
            const bible = results.filter(r => r.source === 'bible').length;
            
            console.log(`  "${search}" → ${results.length} results (G:${gutenberg}, B:${bible})`);
            if (results.length > 0) {
                console.log(`    Top: ${results[0].title} [${results[0].source}]`);
            }
        });
    }

    /**
     * Bible book names mapping
     */
    getBibleBookNames() {
        return {
            'GEN': 'Genesis', 'EXO': 'Exodus', 'LEV': 'Leviticus', 'NUM': 'Numbers',
            'DEU': 'Deuteronomy', 'JOS': 'Joshua', 'JDG': 'Judges', 'RUT': 'Ruth',
            '1SA': '1 Samuel', '2SA': '2 Samuel', '1KI': '1 Kings', '2KI': '2 Kings',
            '1CH': '1 Chronicles', '2CH': '2 Chronicles', 'EZR': 'Ezra', 'NEH': 'Nehemiah',
            'EST': 'Esther', 'JOB': 'Job', 'PSA': 'Psalms', 'PRO': 'Proverbs',
            'ECC': 'Ecclesiastes', 'SNG': 'Song of Solomon', 'ISA': 'Isaiah',
            'JER': 'Jeremiah', 'LAM': 'Lamentations', 'EZK': 'Ezekiel', 'DAN': 'Daniel',
            'HOS': 'Hosea', 'JOL': 'Joel', 'AMO': 'Amos', 'OBA': 'Obadiah',
            'JON': 'Jonah', 'MIC': 'Micah', 'NAM': 'Nahum', 'HAB': 'Habakkuk',
            'ZEP': 'Zephaniah', 'HAG': 'Haggai', 'ZEC': 'Zechariah', 'MAL': 'Malachi',
            'MAT': 'Matthew', 'MRK': 'Mark', 'LUK': 'Luke', 'JHN': 'John',
            'ACT': 'Acts', 'ROM': 'Romans', '1CO': '1 Corinthians', '2CO': '2 Corinthians',
            'GAL': 'Galatians', 'EPH': 'Ephesians', 'PHP': 'Philippians', 'COL': 'Colossians',
            '1TH': '1 Thessalonians', '2TH': '2 Thessalonians', '1TI': '1 Timothy',
            '2TI': '2 Timothy', 'TIT': 'Titus', 'PHM': 'Philemon', 'HEB': 'Hebrews',
            'JAS': 'James', '1PE': '1 Peter', '2PE': '2 Peter', '1JN': '1 John',
            '2JN': '2 John', '3JN': '3 John', 'JUD': 'Jude', 'REV': 'Revelation'
        };
    }
}

// Initialize global Extended CSV catalog system
let globalExtendedCSVCatalog = null;

/**
 * Initialize Extended CSV catalog system on app load
 */
async function initializeExtendedCSVCatalogSystem() {
    try {
        console.log('🚀 Initializing Extended CSV Catalog System (Unified)...');
        globalExtendedCSVCatalog = new ExtendedCSVCatalogSystem();
        await globalExtendedCSVCatalog.initialize();
        
        window.globalExtendedCSVCatalog = globalExtendedCSVCatalog;
        
        console.log('✅ Extended CSV Catalog System ready!');
        
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