/**
 * Scalable Citation Catalog System
 * Auto-discovers files and handles multiple candidates with confidence scoring
 */

class CitationCatalog {
    constructor() {
        this.catalog = {};
        this.initialized = false;
        this.fileBaseUrl = './test_corpus/cleaned/';
    }

    /**
     * Initialize the catalog by scanning all available files
     */
    async initialize() {
        console.log('🔍 Building auto-discovery catalog...');

        try {
            await this.buildAutoCatalog();
            this.initialized = true;
            console.log('✅ Catalog initialization completed');
            console.log(`📚 Catalog contains ${Object.keys(this.catalog).length} search variants`);
        } catch (error) {
            console.error('❌ Catalog initialization failed:', error);
            throw error;
        }
    }

    /**
     * Auto-discovery file catalog system
     */
    async buildAutoCatalog() {
        console.log('🔧 Scanning cleaned directory for files...');

        // Known files from our corpus
        const knownFiles = [
            'pg_absalom_cleaned.txt',
            'pg12242_cleaned.txt',  // Emily Dickinson
            'pg2199_cleaned.txt',   // Homer's Iliad
            'pg700_cleaned.txt',    // Dickens Old Curiosity Shop
            'pg8578_cleaned.txt',   // Dostoevsky Grand Inquisitor
            'absalom_achitophel_sample.txt'
        ];

        this.catalog = {};

        for (const filename of knownFiles) {
            try {
                console.log(`📖 Processing file: ${filename}`);
                const metadata = await this.extractFileMetadata(filename);
                const variants = this.generateTitleVariants(metadata);

                console.log(`   Title: "${metadata.title}"`);
                console.log(`   Author: "${metadata.author}"`);
                console.log(`   Variants: ${variants.length}`);

                // Store all possible search keys
                variants.forEach(variant => {
                    if (!this.catalog[variant]) {
                        this.catalog[variant] = [];
                    }

                    this.catalog[variant].push({
                        filename,
                        title: metadata.title,
                        author: metadata.author,
                        pgId: metadata.pgId,
                        confidence: this.calculateVariantConfidence(variant, metadata),
                        originalVariant: variant
                    });
                });

            } catch (error) {
                console.error(`❌ Failed to process ${filename}:`, error);
            }
        }

        // Sort all entries by confidence
        Object.keys(this.catalog).forEach(variant => {
            this.catalog[variant].sort((a, b) => b.confidence - a.confidence);
        });

        console.log('📊 Catalog build summary:');
        Object.entries(this.catalog).forEach(([variant, works]) => {
            if (works.length > 1) {
                console.log(`   "${variant}" -> ${works.length} works: ${works.map(w => w.title).join(', ')}`);
            }
        });
    }

    /**
     * Extract metadata from file content
     */
    async extractFileMetadata(filename) {
        console.log(`🔍 Extracting metadata from: ${filename}`);

        try {
            // Try Project Gutenberg ID extraction first
            const pgId = filename.match(/pg(\d+)/)?.[1];

            // Read file content for title/author extraction
            const content = await this.fetchFileContent(filename);
            const lines = content.split('\n').slice(0, 10); // First 10 lines usually contain metadata

            const metadata = {
                pgId: pgId,
                title: this.inferTitleFromContent(lines),
                author: this.inferAuthorFromContent(lines),
                filename: filename
            };

            console.log(`   Extracted: ${metadata.title} by ${metadata.author}`);
            return metadata;

        } catch (error) {
            console.error(`❌ Metadata extraction failed for ${filename}:`, error);
            return {
                pgId: null,
                title: filename.replace(/\.txt$/, '').replace(/_/g, ' '),
                author: 'Unknown',
                filename: filename
            };
        }
    }

    /**
     * Infer title from file content
     */
    inferTitleFromContent(lines) {
        // Look for title patterns in first few lines
        for (let i = 0; i < Math.min(lines.length, 5); i++) {
            const line = lines[i].trim();

            // Skip empty lines and common headers
            if (!line || line.match(/^(THE\s+)?PROJECT\s+GUTENBERG/i)) {
                continue;
            }

            // Common title patterns
            if (line.match(/^[A-Z][A-Z\s&]+$/) && line.length > 3 && line.length < 100) {
                return this.cleanTitle(line);
            }

            // Title with "The" prefix
            if (line.match(/^The\s+[A-Z][a-zA-Z\s]+/)) {
                return this.cleanTitle(line);
            }
        }

        // Fallback: use first non-empty line
        const firstLine = lines.find(line => line.trim().length > 0);
        return firstLine ? this.cleanTitle(firstLine) : 'Unknown Title';
    }

    /**
     * Infer author from file content
     */
    inferAuthorFromContent(lines) {
        // Look for author patterns
        const authorPatterns = [
            /^[Bb]y\s+(.+)$/,           // "By John Doe"
            /^[Bb]y\s*:\s*(.+)$/,       // "By: John Doe"
            /^[Aa]uthor\s*:\s*(.+)$/,   // "Author: John Doe"
            /^(.+),\s*[Aa]uthor$/       // "John Doe, Author"
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

        // Look for standalone author names (capitalized lines after title)
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

    /**
     * Clean and normalize title
     */
    cleanTitle(title) {
        return title
            .replace(/^\s*THE\s+/i, '') // Remove leading "THE"
            .replace(/[^\w\s&'-]/g, ' ') // Remove special chars except &, ', -
            .replace(/\s+/g, ' ')       // Normalize whitespace
            .trim()
            .toLowerCase()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    /**
     * Clean and normalize author name
     */
    cleanAuthor(author) {
        return author
            .replace(/[^\w\s.'-]/g, ' ') // Remove special chars except ., ', -
            .replace(/\s+/g, ' ')        // Normalize whitespace
            .trim()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    /**
     * Generate multiple search variants for a work
     */
    generateTitleVariants(metadata) {
        const variants = new Set();
        const title = metadata.title.toLowerCase();
        const author = metadata.author?.toLowerCase();

        // Core title variants
        variants.add(title);
        variants.add(title.replace(/[^\w\s]/g, '')); // No punctuation
        variants.add(title.replace(/\s+/g, ''));     // No spaces

        // Add "the" prefix variants
        if (!title.startsWith('the ')) {
            variants.add(`the ${title}`);
        }

        // Author + title combinations
        if (author && author !== 'unknown author') {
            variants.add(`${author} ${title}`);
            variants.add(`${author.split(' ').pop()} ${title}`); // Last name + title
        }

        // Generate abbreviations for multi-word titles
        if (title.includes(' ')) {
            const words = title.split(' ');
            if (words.length <= 4) { // Only for reasonable length titles
                const abbreviation = words.map(word => word.charAt(0)).join('');
                if (abbreviation.length >= 2) {
                    variants.add(abbreviation);
                }
            }

            // Key word extraction (remove common words)
            const keyWords = words.filter(word =>
                !['the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'at', 'to', 'for'].includes(word)
            );
            if (keyWords.length > 0 && keyWords.length < words.length) {
                variants.add(keyWords.join(' '));
            }
        }

        return Array.from(variants);
    }

    /**
     * Calculate confidence score for a variant
     */
    calculateVariantConfidence(variant, metadata) {
        const title = metadata.title.toLowerCase();

        // Exact match = highest confidence
        if (variant === title) return 1.0;

        // Author + title = high confidence
        if (variant.includes(metadata.author?.toLowerCase())) return 0.9;

        // No punctuation variant = high confidence
        if (variant === title.replace(/[^\w\s]/g, '')) return 0.85;

        // Abbreviations = medium confidence
        if (variant.length <= 4 && title.includes(' ')) return 0.7;

        // Key words only = medium confidence
        if (variant.split(' ').every(word => title.includes(word))) return 0.75;

        // Default confidence
        return 0.6;
    }

    /**
     * Find all matching works for a search term
     */
    findAllMatches(searchTerm, lineRange = null) {
        console.log('🔍 Finding matches for:', searchTerm);

        if (!this.initialized) {
            console.error('❌ Catalog not initialized');
            return [];
        }

        const normalized = searchTerm.toLowerCase().trim();
        const candidates = [];

        // Direct matches (highest confidence)
        if (this.catalog[normalized]) {
            console.log(`✅ Direct match found for "${normalized}"`);
            candidates.push(...this.catalog[normalized].map(c => ({
                ...c,
                matchType: 'exact',
                similarity: 1.0,
                searchTerm: normalized
            })));
        }

        // Fuzzy matches (medium confidence)
        Object.entries(this.catalog).forEach(([variant, works]) => {
            if (variant === normalized) return; // Skip exact matches (already added)

            const similarity = this.calculateSimilarity(normalized, variant);
            if (similarity > 0.6) {
                console.log(`🔗 Fuzzy match: "${normalized}" -> "${variant}" (${similarity.toFixed(2)})`);
                works.forEach(work => {
                    candidates.push({
                        ...work,
                        matchType: 'fuzzy',
                        similarity,
                        matchedVariant: variant,
                        searchTerm: normalized
                    });
                });
            }
        });

        // Rank and deduplicate candidates
        const rankedCandidates = this.rankAndDeduplicateCandidates(candidates);

        console.log(`📊 Found ${rankedCandidates.length} candidate(s)`);
        rankedCandidates.forEach((c, i) => {
            console.log(`   ${i + 1}. ${c.title} by ${c.author} (${c.matchType}, confidence: ${c.finalConfidence.toFixed(2)})`);
        });

        return rankedCandidates;
    }

    /**
     * Calculate string similarity (simple implementation)
     */
    calculateSimilarity(str1, str2) {
        // Jaccard similarity for word sets
        const words1 = new Set(str1.split(' '));
        const words2 = new Set(str2.split(' '));

        const intersection = new Set([...words1].filter(x => words2.has(x)));
        const union = new Set([...words1, ...words2]);

        const jaccard = intersection.size / union.size;

        // Also consider substring matching
        const substring = str1.includes(str2) || str2.includes(str1) ? 0.3 : 0;

        return Math.min(1.0, jaccard + substring);
    }

    /**
     * Rank candidates and remove duplicates
     */
    rankAndDeduplicateCandidates(candidates) {
        // Calculate final confidence score
        candidates.forEach(candidate => {
            candidate.finalConfidence = candidate.confidence * (candidate.similarity || 1.0);
        });

        // Remove duplicates (same file)
        const seen = new Set();
        const unique = candidates.filter(candidate => {
            const key = `${candidate.filename}-${candidate.title}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        // Sort by final confidence
        return unique.sort((a, b) => b.finalConfidence - a.finalConfidence);
    }

    /**
     * Generate candidates with extracted text
     */
    async generateCandidatesWithText(searchTerm, lineRange) {
        console.log('📝 Generating candidates with extracted text');

        const matches = this.findAllMatches(searchTerm, lineRange);
        const candidatesWithText = [];

        for (const match of matches) {
            try {
                console.log(`🔍 Extracting text from: ${match.filename}`);

                const text = await this.extractTextFromFile(match.filename, lineRange);

                candidatesWithText.push({
                    source: `gutenberg:${match.filename}`,
                    confidence: match.finalConfidence,
                    text: text,
                    metadata: {
                        lines: lineRange ? `${lineRange.start}-${lineRange.end}` : 'full',
                        author: match.author,
                        title: match.title,
                        source_file: match.filename,
                        pgId: match.pgId,
                        matchType: match.matchType,
                        similarity: match.similarity,
                        disambiguator: `${match.author} - ${match.title}`,
                        searchTerm: match.searchTerm,
                        matchedVariant: match.matchedVariant
                    },
                    type: 'literature'
                });

            } catch (error) {
                console.error(`❌ Failed to extract text from ${match.filename}:`, error);
            }
        }

        console.log(`✅ Generated ${candidatesWithText.length} candidates with text`);
        return candidatesWithText;
    }

    /**
     * Extract text from file with line range
     */
    async extractTextFromFile(filename, lineRange) {
        const content = await this.fetchFileContent(filename);
        const lines = content.split('\n').filter(line => line.trim() !== '');

        if (!lineRange) {
            return lines.slice(0, 10).join('\n'); // Return first 10 lines as preview
        }

        const { start, end } = lineRange;

        if (start < 1 || end > lines.length || start > end) {
            throw new Error(`Invalid line range: ${start}-${end} (file has ${lines.length} lines)`);
        }

        return lines.slice(start - 1, end).join('\n');
    }

    /**
     * Fetch file content
     */
    async fetchFileContent(filename) {
        const response = await fetch(`${this.fileBaseUrl}${filename}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return await response.text();
    }

    /**
     * Get catalog statistics
     */
    getCatalogStats() {
        const stats = {
            totalVariants: Object.keys(this.catalog).length,
            totalWorks: new Set(Object.values(this.catalog).flat().map(w => w.filename)).size,
            duplicateVariants: 0,
            averageVariantsPerWork: 0
        };

        stats.duplicateVariants = Object.values(this.catalog).filter(works => works.length > 1).length;
        stats.averageVariantsPerWork = stats.totalVariants / stats.totalWorks;

        return stats;
    }
}

// Export for use in other modules
window.CitationCatalog = CitationCatalog;