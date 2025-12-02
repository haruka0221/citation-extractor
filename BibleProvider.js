/**
 * BibleProvider.js
 * Integrates BibleNLP/ebible corpus into the citation extractor
 */

class BibleProvider {
    constructor() {
        this.name = 'Bible';
        this.type = 'bible';
        this.initialized = false;
        
        // Verse reference list
        this.vref = [];
        
        // Bible versions { versionId: { name, language, verses: [] } }
        this.versions = {};
        
        // Book name mappings (abbreviation -> full name, aliases)
        this.bookMappings = {
            'GEN': { full: 'Genesis', aliases: ['gen', 'ge', 'gn'] },
            'EXO': { full: 'Exodus', aliases: ['exo', 'ex', 'exod'] },
            'LEV': { full: 'Leviticus', aliases: ['lev', 'le', 'lv'] },
            'NUM': { full: 'Numbers', aliases: ['num', 'nu', 'nm', 'nb'] },
            'DEU': { full: 'Deuteronomy', aliases: ['deu', 'dt', 'deut'] },
            'JOS': { full: 'Joshua', aliases: ['jos', 'josh'] },
            'JDG': { full: 'Judges', aliases: ['jdg', 'judg', 'jg'] },
            'RUT': { full: 'Ruth', aliases: ['rut', 'ru', 'rth'] },
            '1SA': { full: '1 Samuel', aliases: ['1sa', '1sam', '1 sam', '1 samuel'] },
            '2SA': { full: '2 Samuel', aliases: ['2sa', '2sam', '2 sam', '2 samuel'] },
            '1KI': { full: '1 Kings', aliases: ['1ki', '1kgs', '1 kings', '1 ki'] },
            '2KI': { full: '2 Kings', aliases: ['2ki', '2kgs', '2 kings', '2 ki'] },
            '1CH': { full: '1 Chronicles', aliases: ['1ch', '1chr', '1 chr', '1 chron'] },
            '2CH': { full: '2 Chronicles', aliases: ['2ch', '2chr', '2 chr', '2 chron'] },
            'EZR': { full: 'Ezra', aliases: ['ezr', 'ezra'] },
            'NEH': { full: 'Nehemiah', aliases: ['neh', 'ne'] },
            'EST': { full: 'Esther', aliases: ['est', 'esth'] },
            'JOB': { full: 'Job', aliases: ['job', 'jb'] },
            'PSA': { full: 'Psalms', aliases: ['psa', 'ps', 'psalm', 'pslm'] },
            'PRO': { full: 'Proverbs', aliases: ['pro', 'pr', 'prov'] },
            'ECC': { full: 'Ecclesiastes', aliases: ['ecc', 'ec', 'eccl', 'eccles'] },
            'SNG': { full: 'Song of Solomon', aliases: ['sng', 'song', 'sos', 'canticles'] },
            'ISA': { full: 'Isaiah', aliases: ['isa', 'is'] },
            'JER': { full: 'Jeremiah', aliases: ['jer', 'je'] },
            'LAM': { full: 'Lamentations', aliases: ['lam', 'la'] },
            'EZK': { full: 'Ezekiel', aliases: ['ezk', 'eze', 'ezek'] },
            'DAN': { full: 'Daniel', aliases: ['dan', 'da', 'dn'] },
            'HOS': { full: 'Hosea', aliases: ['hos', 'ho'] },
            'JOL': { full: 'Joel', aliases: ['jol', 'joe', 'jl'] },
            'AMO': { full: 'Amos', aliases: ['amo', 'am'] },
            'OBA': { full: 'Obadiah', aliases: ['oba', 'ob', 'obad'] },
            'JON': { full: 'Jonah', aliases: ['jon', 'jnh'] },
            'MIC': { full: 'Micah', aliases: ['mic', 'mc'] },
            'NAM': { full: 'Nahum', aliases: ['nam', 'na', 'nah'] },
            'HAB': { full: 'Habakkuk', aliases: ['hab', 'hb'] },
            'ZEP': { full: 'Zephaniah', aliases: ['zep', 'zp', 'zeph'] },
            'HAG': { full: 'Haggai', aliases: ['hag', 'hg'] },
            'ZEC': { full: 'Zechariah', aliases: ['zec', 'zc', 'zech'] },
            'MAL': { full: 'Malachi', aliases: ['mal', 'ml'] },
            // New Testament
            'MAT': { full: 'Matthew', aliases: ['mat', 'mt', 'matt'] },
            'MRK': { full: 'Mark', aliases: ['mrk', 'mk', 'mar'] },
            'LUK': { full: 'Luke', aliases: ['luk', 'lk'] },
            'JHN': { full: 'John', aliases: ['jhn', 'jn', 'joh'] },
            'ACT': { full: 'Acts', aliases: ['act', 'ac'] },
            'ROM': { full: 'Romans', aliases: ['rom', 'ro', 'rm'] },
            '1CO': { full: '1 Corinthians', aliases: ['1co', '1cor', '1 cor'] },
            '2CO': { full: '2 Corinthians', aliases: ['2co', '2cor', '2 cor'] },
            'GAL': { full: 'Galatians', aliases: ['gal', 'ga'] },
            'EPH': { full: 'Ephesians', aliases: ['eph', 'ep'] },
            'PHP': { full: 'Philippians', aliases: ['php', 'phil', 'pp'] },
            'COL': { full: 'Colossians', aliases: ['col', 'co'] },
            '1TH': { full: '1 Thessalonians', aliases: ['1th', '1thess', '1 thess'] },
            '2TH': { full: '2 Thessalonians', aliases: ['2th', '2thess', '2 thess'] },
            '1TI': { full: '1 Timothy', aliases: ['1ti', '1tim', '1 tim'] },
            '2TI': { full: '2 Timothy', aliases: ['2ti', '2tim', '2 tim'] },
            'TIT': { full: 'Titus', aliases: ['tit', 'ti'] },
            'PHM': { full: 'Philemon', aliases: ['phm', 'phlm'] },
            'HEB': { full: 'Hebrews', aliases: ['heb', 'he'] },
            'JAS': { full: 'James', aliases: ['jas', 'jm'] },
            '1PE': { full: '1 Peter', aliases: ['1pe', '1pet', '1 pet', '1 peter'] },
            '2PE': { full: '2 Peter', aliases: ['2pe', '2pet', '2 pet', '2 peter'] },
            '1JN': { full: '1 John', aliases: ['1jn', '1john', '1 john', '1 jn'] },
            '2JN': { full: '2 John', aliases: ['2jn', '2john', '2 john', '2 jn'] },
            '3JN': { full: '3 John', aliases: ['3jn', '3john', '3 john', '3 jn'] },
            'JUD': { full: 'Jude', aliases: ['jud', 'jude'] },
            'REV': { full: 'Revelation', aliases: ['rev', 're', 'apocalypse'] }
        };
        
        // Reverse lookup (alias -> standard code)
        this.aliasToCode = {};
        this.buildAliasLookup();
    }
    
    buildAliasLookup() {
        for (const [code, data] of Object.entries(this.bookMappings)) {
            // Add the code itself
            this.aliasToCode[code.toLowerCase()] = code;
            // Add all aliases
            for (const alias of data.aliases) {
                this.aliasToCode[alias.toLowerCase()] = code;
            }
            // Add full name
            this.aliasToCode[data.full.toLowerCase()] = code;
        }
    }
    
    /**
     * Initialize the Bible provider
     * @param {Object} config - Configuration with paths to Bible files
     */
    async initialize(config = {}) {
        try {
            console.log('Initializing BibleProvider...');
            
            // Default configuration
            const defaultConfig = {
                basePath: 'bible_data',
                vrefFile: 'vref.txt',
                versions: [
                    { id: 'kjv', file: 'eng-eng-kjv.txt', name: 'King James Version', language: 'en' }
                ]
            };
            
            const finalConfig = { ...defaultConfig, ...config };
            
            // Load verse references
            await this.loadVref(`${finalConfig.basePath}/${finalConfig.vrefFile}`);
            
            // Load each Bible version
            for (const version of finalConfig.versions) {
                await this.loadVersion(
                    version.id,
                    `${finalConfig.basePath}/${version.file}`,
                    version.name,
                    version.language
                );
            }
            
            this.initialized = true;
            console.log(`BibleProvider initialized with ${Object.keys(this.versions).length} version(s)`);
            
        } catch (error) {
            console.error('Failed to initialize BibleProvider:', error);
            throw error;
        }
    }
    
    /**
     * Load verse reference file
     */
    async loadVref(path) {
        try {
            const response = await fetch(path);
            const text = await response.text();
            this.vref = text.trim().split('\n');
            console.log(`Loaded ${this.vref.length} verse references`);
        } catch (error) {
            console.error('Failed to load vref:', error);
            throw error;
        }
    }
    
    /**
     * Load a Bible version
     */
    async loadVersion(id, path, name, language) {
        try {
            const response = await fetch(path);
            const text = await response.text();
            const verses = text.split('\n');
            
            this.versions[id] = {
                name,
                language,
                verses
            };
            
            console.log(`Loaded Bible version: ${name} (${verses.length} verses)`);
        } catch (error) {
            console.error(`Failed to load Bible version ${id}:`, error);
        }
    }
    
    /**
     * Parse a Bible citation string
     * Examples: "Gen. 1:1-10", "John 3:16", "1 Cor. 13:1-13", "Ps. 23"
     * @returns {Object} { book, chapter, startVerse, endVerse }
     */
    parseCitation(citation) {
        // Clean up the citation
        let cleaned = citation.trim()
            .replace(/\./g, '')  // Remove periods
            .replace(/\s+/g, ' '); // Normalize spaces
        
        // Pattern: Book Chapter:StartVerse-EndVerse or Book Chapter:Verse or Book Chapter
        const patterns = [
            // Full pattern: Book Chapter:Start-End
            /^(.+?)\s*(\d+):(\d+)-(\d+)$/,
            // Single verse: Book Chapter:Verse
            /^(.+?)\s*(\d+):(\d+)$/,
            // Whole chapter: Book Chapter
            /^(.+?)\s*(\d+)$/
        ];
        
        for (const pattern of patterns) {
            const match = cleaned.match(pattern);
            if (match) {
                const bookInput = match[1].trim().toLowerCase();
                const bookCode = this.aliasToCode[bookInput];
                
                if (!bookCode) {
                    console.warn(`Unknown book: ${match[1]}`);
                    return null;
                }
                
                const chapter = parseInt(match[2]);
                let startVerse = 1;
                let endVerse = null;
                
                if (match[3]) {
                    startVerse = parseInt(match[3]);
                    endVerse = match[4] ? parseInt(match[4]) : startVerse;
                }
                
                return {
                    book: bookCode,
                    bookName: this.bookMappings[bookCode].full,
                    chapter,
                    startVerse,
                    endVerse
                };
            }
        }
        
        console.warn(`Could not parse citation: ${citation}`);
        return null;
    }
    
    /**
     * Get passage by citation
     * @param {string} citation - e.g., "Gen. 1:1-10"
     * @param {string} versionId - Bible version ID (default: 'kjv')
     * @returns {Object} { text, citation, verses }
     */
    getPassage(citation, versionId = 'kjv') {
        const parsed = this.parseCitation(citation);
        if (!parsed) return null;
        
        const version = this.versions[versionId];
        if (!version) {
            console.error(`Bible version not found: ${versionId}`);
            return null;
        }
        
        // Find verses in vref
        const verses = [];
        const verseTexts = [];
        
        for (let i = 0; i < this.vref.length; i++) {
            const ref = this.vref[i];
            const [refBook, refChapterVerse] = ref.split(' ');
            
            if (refBook !== parsed.book) continue;
            
            const [refChapter, refVerse] = refChapterVerse.split(':').map(Number);
            
            if (refChapter !== parsed.chapter) continue;
            
            // Check verse range
            if (parsed.endVerse) {
                if (refVerse >= parsed.startVerse && refVerse <= parsed.endVerse) {
                    const text = version.verses[i];
                    if (text && text !== '<range>' && text.trim()) {
                        verses.push(ref);
                        verseTexts.push(`${refVerse}. ${text}`);
                    }
                }
            } else if (refVerse === parsed.startVerse) {
                const text = version.verses[i];
                if (text && text !== '<range>' && text.trim()) {
                    verses.push(ref);
                    verseTexts.push(text);
                }
            }
        }
        
        if (verseTexts.length === 0) {
            return null;
        }
        
        return {
            text: verseTexts.join(' '),
            citation: `${parsed.bookName} ${parsed.chapter}:${parsed.startVerse}${parsed.endVerse && parsed.endVerse !== parsed.startVerse ? '-' + parsed.endVerse : ''}`,
            verses,
            book: parsed.bookName,
            chapter: parsed.chapter,
            startVerse: parsed.startVerse,
            endVerse: parsed.endVerse,
            version: version.name
        };
    }
    
    /**
     * Search for passages containing keywords
     * @param {string} query - Search query
     * @param {string} versionId - Bible version ID
     * @returns {Array} Array of matching passages
     */
    search(query, versionId = 'kjv') {
        if (!this.initialized) {
            console.error('BibleProvider not initialized');
            return [];
        }
        
        const version = this.versions[versionId];
        if (!version) return [];
        
        const results = [];
        const queryLower = query.toLowerCase();
        const queryWords = queryLower.split(/\s+/);
        
        // First, try to parse as a citation
        const parsed = this.parseCitation(query);
        if (parsed) {
            const passage = this.getPassage(query, versionId);
            if (passage) {
                results.push({
                    type: 'bible',
                    title: passage.citation,
                    text: passage.text,
                    author: version.name,
                    lines: `${parsed.startVerse}-${parsed.endVerse || parsed.startVerse}`,
                    confidence: 100,
                    source: 'BibleNLP/ebible'
                });
            }
        }
        
        // Also search by text content
        for (let i = 0; i < version.verses.length; i++) {
            const verseText = version.verses[i];
            if (!verseText || verseText === '<range>') continue;
            
            const verseLower = verseText.toLowerCase();
            
            // Check if all query words are present
            const allWordsMatch = queryWords.every(word => verseLower.includes(word));
            
            if (allWordsMatch) {
                const ref = this.vref[i];
                const [book, chapterVerse] = ref.split(' ');
                const bookName = this.bookMappings[book]?.full || book;
                
                results.push({
                    type: 'bible',
                    title: `${bookName} ${chapterVerse}`,
                    text: verseText,
                    author: version.name,
                    lines: chapterVerse,
                    confidence: this.calculateConfidence(queryWords, verseLower),
                    source: 'BibleNLP/ebible'
                });
            }
            
            // Limit results
            if (results.length >= 20) break;
        }
        
        // Sort by confidence
        results.sort((a, b) => b.confidence - a.confidence);
        
        return results.slice(0, 10);
    }
    
    calculateConfidence(queryWords, text) {
        let score = 0;
        for (const word of queryWords) {
            if (text.includes(word)) {
                score += 10;
            }
        }
        return Math.min(100, score);
    }
}

// Export for use
window.BibleProvider = BibleProvider;

// Auto-initialize if config exists
document.addEventListener('DOMContentLoaded', async () => {
    if (window.bibleConfig) {
        window.bibleProvider = new BibleProvider();
        await window.bibleProvider.initialize(window.bibleConfig);
    }
});