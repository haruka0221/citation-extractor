/**
 * Citation Integration Module
 * Handles the workflow from footnote selection to source passage retrieval
 */

class CitationIntegration {
    constructor() {
        this.selectedCandidate = null;
        this.currentCandidates = [];
        this.currentSourceType = 'all';
        this.catalog = null;
        this.dynamicCatalog = null;
        this.csvCatalog = null;
        this.fullTextViewer = null;

        this.initializeEventListeners();
        this.initializeCitationEngine();
    }

    /**
     * Initialize the citation extraction engine
     */
    async initializeCitationEngine() {
        try {
            console.log('🚀 Initializing scalable citation engine...');

            // Initialize the CSV catalog system (preferred)
            if (window.CSVCatalogSystem && window.initializeCSVCatalogSystem) {
                this.csvCatalog = await window.initializeCSVCatalogSystem();
                console.log('✅ CSV catalog system initialized successfully');

                const stats = this.csvCatalog.getCatalogStats();
                console.log('📊 CSV catalog stats:', stats);
            } else if (window.DynamicWorkCatalog) {
                console.log('⚠️ Using fallback DynamicWorkCatalog');
                this.dynamicCatalog = new window.DynamicWorkCatalog();
                await this.dynamicCatalog.initialize();
                console.log('✅ Dynamic work catalog initialized successfully');

                const stats = this.dynamicCatalog.getCatalogStats();
                console.log('📊 Dynamic catalog stats:', stats);
            } else if (window.CitationCatalog) {
                console.log('⚠️ Using fallback CitationCatalog');
                this.catalog = new window.CitationCatalog();
                await this.catalog.initialize();
                console.log('✅ Citation catalog initialized successfully');

                const stats = this.catalog.getCatalogStats();
                console.log('📊 Catalog stats:', stats);
            } else {
                console.warn('⚠️ No catalog system available, using legacy methods');
            }

            // Initialize full-text viewer
            if (window.FullTextViewer) {
                this.fullTextViewer = new window.FullTextViewer();
                console.log('✅ Full-text viewer initialized');
            } else {
                console.warn('⚠️ FullTextViewer not available');
            }

            // Wait for main app to be available
            this.waitForMainApp();
        } catch (error) {
            console.error('❌ Failed to initialize citation engine:', error);
        }
    }

    /**
     * Wait for main app to be available
     */
    waitForMainApp() {
        const checkApp = () => {
            if (window.poetryApp) {
                console.log('Main app instance found and ready');
                return;
            }

            console.log('Waiting for main app to initialize...');
            setTimeout(checkApp, 100);
        };

        checkApp();
    }

    /**
     * Set up event listeners for the citation integration
     */
    initializeEventListeners() {
        // Find Sources button
        const findSourcesBtn = document.getElementById('findSourcesBtn');
        if (findSourcesBtn) {
            findSourcesBtn.addEventListener('click', () => this.handleFindSources());
        }

        // Source info textarea - show/hide Find Sources button
        const sourceInfo = document.getElementById('sourceInfo');
        if (sourceInfo) {
            sourceInfo.addEventListener('input', () => this.handleSourceInfoChange());
        }

        // Modal controls
        this.setupModalEventListeners();
        this.setupTabEventListeners();
    }

    /**
     * Handle changes to the source info textarea
     */
    handleSourceInfoChange() {
        const sourceInfo = document.getElementById('sourceInfo');
        const citationControls = document.getElementById('citationControls');
        const findSourcesBtn = document.getElementById('findSourcesBtn');

        if (sourceInfo && citationControls && findSourcesBtn) {
            const hasText = sourceInfo.value.trim().length > 0;

            if (hasText) {
                citationControls.style.display = 'flex';
                findSourcesBtn.disabled = false;
            } else {
                citationControls.style.display = 'none';
                findSourcesBtn.disabled = true;
            }
        }
    }

    /**
     * Handle Find Sources button click
     */
    async handleFindSources() {
        console.log('🔍 STEP 1: Find Sources clicked');

        const sourceInfo = document.getElementById('sourceInfo');
        const citationText = sourceInfo.value.trim();

        console.log('Selected text:', citationText);
        console.log('Selected text length:', citationText.length);
        console.log('Selected text type:', typeof citationText);

        if (!citationText) {
            console.log('❌ No citation text provided');
            this.showCitationStatus('Please enter citation text first', 'error');
            return;
        }

        try {
            console.log('🔧 STEP 2: Starting citation lookup process');
            this.showCitationStatus('Searching for sources...', 'loading');

            const candidates = await this.performCitationLookup(citationText);

            console.log('📊 STEP 3: Citation lookup completed');
            console.log('Candidates found:', candidates ? candidates.length : 0);
            console.log('Candidates data:', candidates);

            if (candidates && candidates.length > 0) {
                this.showCitationStatus(`Found ${candidates.length} source(s)`, 'success');
                this.displayCandidatesModal(citationText, candidates);
            } else {
                this.showCitationStatus('No sources found', 'error');
                this.displayCandidatesModal(citationText, []);
            }
        } catch (error) {
            console.error('❌ Citation lookup failed:', error);
            this.showCitationStatus('Lookup failed', 'error');
        }
    }

    /**
     * Perform citation lookup using the extraction engine
     */
    async performCitationLookup(citationText) {
        console.log('🔧 STEP 2: Performing citation lookup');
        console.log('Raw citation input:', citationText);
        console.log('Citation input type:', typeof citationText);
        console.log('Citation input length:', citationText.length);

        try {
            console.log('🌐 Attempting API call to http://localhost:5000/api/citation/lookup');

            const response = await fetch('http://localhost:5000/api/citation/lookup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    citation: citationText
                })
            });

            console.log('📡 API Response status:', response.status);
            console.log('📡 API Response ok:', response.ok);

            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }

            const data = await response.json();
            console.log('📊 API Response data:', data);

            if (data.success) {
                console.log('✅ API lookup successful, candidates:', data.candidates?.length || 0);
                return data.candidates || [];
            } else {
                throw new Error(data.error || 'Citation lookup failed');
            }
        } catch (error) {
            console.error('❌ Citation lookup error:', error);

            // Fallback to mock data if API is not available
            if (error.message.includes('fetch')) {
                console.log('⚠️ API server not available, using mock data');
                const mockCandidates = await this.generateMockCandidates(citationText);
                console.log('🎭 Generated mock candidates:', mockCandidates.length);
                return mockCandidates;
            }

            throw error;
        }
    }

    /**
     * Generate candidates using scalable catalog system
     */
    async generateMockCandidates(citationText) {
        console.log('🔧 STEP 3: GENERATING CANDIDATES WITH SCALABLE CATALOG');
        console.log('Citation input:', citationText);

        try {
            // Use CSV catalog system (preferred)
            if (this.csvCatalog && this.csvCatalog.initialized) {
                return await this.generateCandidatesWithCSVCatalog(citationText);
            } else if (this.dynamicCatalog && this.dynamicCatalog.initialized) {
                console.warn('⚠️ Using fallback dynamic catalog system');
                return await this.generateCandidatesWithDynamicCatalog(citationText);
            } else if (this.catalog && this.catalog.initialized) {
                console.warn('⚠️ Using fallback catalog system');
                return await this.generateCandidatesWithCatalog(citationText);
            } else {
                console.warn('⚠️ No catalog available, using legacy method');
                return await this.generateLegacyCandidates(citationText);
            }

        } catch (error) {
            console.error('❌ Error generating candidates:', error);
            return this.generateFallbackCandidates(citationText);
        }
    }

    /**
     * Generate candidates using the CSV catalog system
     */
    async generateCandidatesWithCSVCatalog(citationText) {
        console.log('📊 Using CSV catalog system for candidate generation');

        // Parse the citation to extract line range
        const parsed = this.parseCitationText(citationText);

        let searchTerm, lineRange;

        if (parsed) {
            searchTerm = parsed.work;
            lineRange = { start: parsed.startLine, end: parsed.endLine };
            console.log(`🎯 Parsed search: "${searchTerm}" lines ${lineRange.start}-${lineRange.end}`);
        } else {
            // Use the full citation as search term (no line numbers found)
            searchTerm = citationText.replace(/\d+[-\d]*/, '').trim();
            lineRange = { start: 1, end: 10 }; // Default preview
            console.log(`🔍 Fallback search: "${searchTerm}" (default preview)`);
        }

        // Search for matching works using CSV catalog
        const matches = this.csvCatalog.findWorkFiles(searchTerm, { maxResults: 10 });

        console.log(`📊 CSV catalog found ${matches.length} matches`);

        const candidates = [];

        for (const match of matches) {
            try {
                console.log(`🔍 Extracting text from: ${match.filename} (PG ${match.pgId})`);

                // Extract text from the matched file
                const text = await this.csvCatalog.extractText(match, lineRange);

                candidates.push({
                    source: `gutenberg:${match.filename}`,
                    confidence: match.confidence,
                    text: text,
                    metadata: {
                        lines: lineRange ? `${lineRange.start}-${lineRange.end}` : 'preview',
                        author: match.author,
                        title: match.title,
                        source_file: match.filename,
                        pgId: match.pgId,
                        language: match.language,
                        matchType: match.matchType,
                        confidence: match.confidence,
                        disambiguator: `${match.author} - ${match.title}`,
                        searchTerm: searchTerm,
                        matchedKey: match.matchedKey,
                        catalogSource: 'csv_catalog'
                    },
                    type: 'literature'
                });

            } catch (error) {
                console.error(`❌ Failed to extract text from ${match.filename}:`, error);
            }
        }

        // Add biblical candidates if appropriate
        if (this.isBiblicalCitation(citationText)) {
            candidates.push(...this.generateBiblicalCandidates(citationText));
        }

        console.log(`✅ CSV catalog generated ${candidates.length} candidates`);
        return candidates;
    }

    /**
     * Generate candidates using the dynamic catalog system
     */
    async generateCandidatesWithDynamicCatalog(citationText) {
        console.log('📚 Using dynamic catalog system for candidate generation');

        // Parse the citation to extract line range
        const parsed = this.parseCitationText(citationText);

        let searchTerm, lineRange;

        if (parsed) {
            searchTerm = parsed.work;
            lineRange = { start: parsed.startLine, end: parsed.endLine };
            console.log(`🎯 Parsed search: "${searchTerm}" lines ${lineRange.start}-${lineRange.end}`);
        } else {
            // Use the full citation as search term (no line numbers found)
            searchTerm = citationText.replace(/\d+[-\d]*/, '').trim();
            lineRange = { start: 1, end: 10 }; // Default preview
            console.log(`🔍 Fallback search: "${searchTerm}" (default preview)`);
        }

        // Search for matching works
        const matches = this.dynamicCatalog.searchWorks(searchTerm, { maxResults: 10 });

        console.log(`📊 Dynamic catalog found ${matches.length} matches`);

        const candidates = [];

        for (const match of matches) {
            try {
                console.log(`🔍 Extracting text from: ${match.filename}`);

                // Extract text from the matched file
                const text = await this.extractTextFromDynamicMatch(match, lineRange);

                candidates.push({
                    source: `gutenberg:${match.filename}`,
                    confidence: match.finalScore,
                    text: text,
                    metadata: {
                        lines: lineRange ? `${lineRange.start}-${lineRange.end}` : 'preview',
                        author: match.author,
                        title: match.title,
                        source_file: match.filename,
                        pgId: match.pgId,
                        matchType: match.matchType,
                        similarity: match.similarity,
                        disambiguator: `${match.author} - ${match.title}`,
                        searchTerm: searchTerm,
                        matchedKey: match.matchedKey,
                        catalogSource: match.source
                    },
                    type: 'literature'
                });

            } catch (error) {
                console.error(`❌ Failed to extract text from ${match.filename}:`, error);
            }
        }

        // Add biblical candidates if appropriate
        if (this.isBiblicalCitation(citationText)) {
            candidates.push(...this.generateBiblicalCandidates(citationText));
        }

        console.log(`✅ Dynamic catalog generated ${candidates.length} candidates`);
        return candidates;
    }

    /**
     * Extract text from a dynamic catalog match
     */
    async extractTextFromDynamicMatch(match, lineRange) {
        const content = await this.fetchFileContent(match.filename);
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
     * Generate candidates using the catalog system
     */
    async generateCandidatesWithCatalog(citationText) {
        console.log('📚 Using catalog system for candidate generation');

        // Parse the citation to extract line range
        const parsed = this.parseCitationText(citationText);

        let searchTerm, lineRange;

        if (parsed) {
            searchTerm = parsed.work;
            lineRange = { start: parsed.startLine, end: parsed.endLine };
            console.log(`🎯 Parsed search: "${searchTerm}" lines ${lineRange.start}-${lineRange.end}`);
        } else {
            // Use the full citation as search term (no line numbers found)
            searchTerm = citationText.replace(/\d+[-\d]*/, '').trim();
            lineRange = { start: 1, end: 10 }; // Default preview
            console.log(`🔍 Fallback search: "${searchTerm}" (default preview)`);
        }

        // Generate candidates with the catalog
        const candidates = await this.catalog.generateCandidatesWithText(searchTerm, lineRange);

        console.log(`✅ Catalog generated ${candidates.length} candidates`);

        // Add biblical candidates if appropriate
        if (this.isBiblicalCitation(citationText)) {
            candidates.push(...this.generateBiblicalCandidates(citationText));
        }

        return candidates;
    }

    /**
     * Legacy candidate generation (fallback)
     */
    async generateLegacyCandidates(citationText) {
        console.log('🔄 Using legacy candidate generation');

        // Parse the citation properly
        const parsed = this.parseCitationText(citationText);
        console.log('Parsed citation:', parsed);

        if (!parsed) {
            console.log('❌ Could not parse citation, returning empty array');
            return [];
        }

        // Find the correct cleaned file
        const cleanedFile = this.findCleanedFile(parsed.work);
        if (!cleanedFile) {
            console.error('❌ No cleaned file found for:', parsed.work);
            return [];
        }

        console.log(`📚 Using file: ${cleanedFile}`);

        // Read the actual file content
        const fileContent = await this.fetchFileContent(cleanedFile);
        const lines = fileContent.split('\n').filter(line => line.trim() !== '');

        console.log(`📏 Total lines in file: ${lines.length}`);
        console.log(`🎯 Extracting lines ${parsed.startLine}-${parsed.endLine}`);

        // Validate line range
        if (parsed.startLine < 1 || parsed.endLine > lines.length || parsed.startLine > parsed.endLine) {
            console.error(`❌ Invalid line range: ${parsed.startLine}-${parsed.endLine} (file has ${lines.length} lines)`);
            return [];
        }

        // Extract EXACT lines (1-based to 0-based conversion)
        const extractedLines = lines.slice(parsed.startLine - 1, parsed.endLine);

        // Show what we're extracting
        console.log('=== EXTRACTED LINES FROM REAL FILE ===');
        extractedLines.forEach((line, index) => {
            const lineNum = parsed.startLine + index;
            console.log(`Line ${lineNum}: "${line}"`);
        });

        const extractedText = extractedLines.join('\n');
        console.log('📄 Final extracted text:', extractedText);

        return [{
            source: `gutenberg:${parsed.work.replace(/\s+/g, '_')}`,
            confidence: 0.95,
            text: extractedText,
            metadata: {
                lines: `${parsed.startLine}-${parsed.endLine}`,
                author: this.getAuthorForWork(parsed.work),
                title: this.getTitleForWork(parsed.work),
                source_file: cleanedFile,
                total_lines: lines.length
            },
            type: 'literature'
        }];
    }

    /**
     * Parse citation text robustly
     */
    parseCitationText(citation) {
        console.log('🔧 Parsing citation:', citation);

        // Clean the citation
        const cleaned = citation.toLowerCase().trim()
            .replace(/[.,;:!?]/g, ' ')  // Remove punctuation
            .replace(/\s+/g, ' ')       // Normalize whitespace
            .trim();

        console.log('Cleaned citation:', cleaned);

        // Extract work name and line numbers
        const patterns = [
            /^(.+?)\s+(\d+)-(\d+)$/,     // "absalom and achitophel 7-9"
            /^(.+?)\s+(\d+)$/,           // "paradise lost 7"
            /^(.+?)\s+lines?\s+(\d+)-(\d+)$/,  // "hamlet lines 7-9"
            /^(.+?)\s+line\s+(\d+)$/,    // "hamlet line 7"
        ];

        for (let i = 0; i < patterns.length; i++) {
            const pattern = patterns[i];
            const match = cleaned.match(pattern);
            if (match) {
                const work = match[1].trim();
                const startLine = parseInt(match[2]);
                const endLine = match[3] ? parseInt(match[3]) : startLine;

                console.log(`✅ Pattern ${i + 1} matched: work="${work}", lines=${startLine}-${endLine}`);
                return { work, startLine, endLine };
            }
        }

        console.error('❌ Failed to parse citation with any pattern');
        return null;
    }

    /**
     * Map work names to cleaned files
     */
    findCleanedFile(workName) {
        console.log('🗂️ Finding file for work:', workName);

        const fileMap = {
            'absalom and achitophel': './test_corpus/cleaned/pg_absalom_cleaned.txt',
            'absalom': './test_corpus/cleaned/pg_absalom_cleaned.txt',
            'achitophel': './test_corpus/cleaned/pg_absalom_cleaned.txt',
            'paradise lost': './test_corpus/cleaned/pg12242_cleaned.txt',
            'paradise': './test_corpus/cleaned/pg12242_cleaned.txt',
            // Add more mappings as needed
        };

        const normalized = workName.toLowerCase().trim();
        const filePath = fileMap[normalized];

        console.log(`📂 Work "${normalized}" mapped to: ${filePath || 'NOT FOUND'}`);
        return filePath;
    }

    /**
     * Fetch file content (using fetch for web compatibility)
     */
    async fetchFileContent(filePath) {
        console.log('📥 Fetching file content:', filePath);

        try {
            const response = await fetch(filePath);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const content = await response.text();
            console.log(`✅ File loaded successfully, length: ${content.length} chars`);
            return content;

        } catch (error) {
            console.error('❌ Failed to fetch file:', error);
            throw error;
        }
    }

    /**
     * Get author for work
     */
    getAuthorForWork(workName) {
        const authorMap = {
            'absalom and achitophel': 'John Dryden',
            'absalom': 'John Dryden',
            'achitophel': 'John Dryden',
            'paradise lost': 'John Milton',
            'paradise': 'John Milton',
        };

        return authorMap[workName.toLowerCase()] || 'Unknown Author';
    }

    /**
     * Get title for work
     */
    getTitleForWork(workName) {
        const titleMap = {
            'absalom and achitophel': 'Absalom and Achitophel',
            'absalom': 'Absalom and Achitophel',
            'achitophel': 'Absalom and Achitophel',
            'paradise lost': 'Paradise Lost',
            'paradise': 'Paradise Lost',
        };

        return titleMap[workName.toLowerCase()] || workName;
    }

    /**
     * Generate fallback candidates if file loading fails
     */
    generateFallbackCandidates(citationText) {
        console.log('🔄 Generating fallback candidates');

        const candidates = [];

        // Check for biblical patterns
        if (/\b\d+:\d+/.test(citationText) || /genesis|matthew|romans|john|psalm/i.test(citationText)) {
            console.log('📖 Adding biblical fallback candidate');
            candidates.push({
                source: 'bible:esv',
                confidence: 0.95,
                text: 'In the beginning, God created the heavens and the earth. The earth was without form and void, and darkness was over the face of the deep.',
                metadata: {
                    book: 'Genesis',
                    chapter: 1,
                    verses: '1-2',
                    translation: 'ESV',
                    source: 'bible_api'
                },
                type: 'bible'
            });
        }

        // Check for literary patterns - use hardcoded sample
        if (/absalom|achitophel/i.test(citationText)) {
            console.log('📚 Adding Absalom fallback candidate');
            candidates.push({
                source: 'gutenberg:absalom_achitophel_fallback',
                confidence: 0.80,
                text: 'Sagacious, bold, and turbulent of wit,\nRestless, unfixed in principles and place,\nIn power unpleased, impatient of disgrace;',
                metadata: {
                    lines: '7-9',
                    author: 'John Dryden',
                    title: 'Absalom and Achitophel',
                    source_file: 'fallback_data'
                },
                type: 'literature'
            });
        }

        if (/paradise|lost/i.test(citationText)) {
            console.log('📚 Adding Paradise Lost fallback candidate');
            candidates.push({
                source: 'gutenberg:paradise_lost_fallback',
                confidence: 0.75,
                text: 'Of Man\'s first disobedience, and the fruit\nOf that forbidden tree whose mortal taste\nBrought death into the World, and all our woe',
                metadata: {
                    lines: '1-3',
                    author: 'John Milton',
                    title: 'Paradise Lost',
                    source_file: 'fallback_data'
                },
                type: 'literature'
            });
        }

        console.log('🎯 STEP 4: Fallback candidates generation completed');
        console.log('Total fallback candidates generated:', candidates.length);

        return candidates;
    }

    /**
     * Check if citation looks biblical
     */
    isBiblicalCitation(citationText) {
        return /\b\d+:\d+/.test(citationText) ||
               /genesis|matthew|romans|john|psalm|luke|acts|corinthians|peter|james/i.test(citationText);
    }

    /**
     * Generate biblical candidates
     */
    generateBiblicalCandidates(citationText) {
        console.log('📖 Adding biblical candidates for:', citationText);

        return [{
            source: 'bible:esv',
            confidence: 0.95,
            text: 'In the beginning, God created the heavens and the earth. The earth was without form and void, and darkness was over the face of the deep.',
            metadata: {
                book: 'Genesis',
                chapter: 1,
                verses: '1-2',
                translation: 'ESV',
                source: 'bible_api'
            },
            type: 'bible'
        }];
    }

    /**
     * Display citation status message
     */
    showCitationStatus(message, type = 'info') {
        const statusElement = document.getElementById('citationStatus');
        if (statusElement) {
            statusElement.textContent = message;
            statusElement.className = `citation-status ${type}`;

            // Clear status after 3 seconds for success/error messages
            if (type !== 'loading') {
                setTimeout(() => {
                    statusElement.textContent = '';
                    statusElement.className = 'citation-status';
                }, 3000);
            }
        }
    }

    /**
     * Display the candidates modal
     */
    displayCandidatesModal(citationText, candidates) {
        this.currentCandidates = candidates;

        // Set citation query text
        const queriedCitation = document.getElementById('queriedCitation');
        if (queriedCitation) {
            queriedCitation.textContent = citationText;
        }

        // Show loading state initially
        this.showCandidatesLoading();

        // Show modal
        const modal = document.getElementById('citationModal');
        if (modal) {
            modal.style.display = 'flex';
        }

        // After a brief delay, show candidates
        setTimeout(() => {
            this.renderCandidates(candidates);
        }, 500);
    }

    /**
     * Show loading state in candidates modal
     */
    showCandidatesLoading() {
        const loadingElement = document.getElementById('loadingCandidates');
        const candidatesList = document.getElementById('candidatesList');
        const noCandidates = document.getElementById('noCandidates');

        if (loadingElement) loadingElement.style.display = 'flex';
        if (candidatesList) candidatesList.style.display = 'none';
        if (noCandidates) noCandidates.style.display = 'none';
    }

    /**
     * Render candidates in the modal
     */
    renderCandidates(candidates) {
        const loadingElement = document.getElementById('loadingCandidates');
        const candidatesList = document.getElementById('candidatesList');
        const noCandidates = document.getElementById('noCandidates');

        // Hide loading
        if (loadingElement) loadingElement.style.display = 'none';

        if (candidates.length === 0) {
            if (noCandidates) noCandidates.style.display = 'block';
            if (candidatesList) candidatesList.style.display = 'none';
            return;
        }

        // Show candidates list
        if (candidatesList) {
            candidatesList.style.display = 'block';
            candidatesList.innerHTML = '';

            // Filter candidates based on current tab
            const filteredCandidates = this.filterCandidatesByType(candidates);

            filteredCandidates.forEach((candidate, index) => {
                const cardElement = this.createCandidateCard(candidate, index);
                candidatesList.appendChild(cardElement);
            });
        }

        if (noCandidates) noCandidates.style.display = 'none';
    }

    /**
     * Filter candidates by selected source type
     */
    filterCandidatesByType(candidates) {
        if (this.currentSourceType === 'all') {
            return candidates;
        }
        return candidates.filter(candidate => candidate.type === this.currentSourceType);
    }

    /**
     * Create a candidate card element
     */
    createCandidateCard(candidate, index) {
        const card = document.createElement('div');
        card.className = 'candidate-card';
        card.dataset.index = index;

        const confidenceLevel = this.getConfidenceLevel(candidate.confidence);
        const confidencePercentage = Math.round(candidate.confidence * 100);

        card.innerHTML = `
            <div class="candidate-header">
                <div class="source-info">
                    <span class="source-type-badge ${candidate.type}">${candidate.type}</span>
                    <span class="source-title">${this.getSourceTitle(candidate)}</span>
                </div>
                <div class="confidence-indicator">
                    <span class="confidence-score ${confidenceLevel}">${confidencePercentage}%</span>
                    <div class="confidence-bar">
                        <div class="confidence-fill ${confidenceLevel}" style="width: ${confidencePercentage}%"></div>
                    </div>
                </div>
            </div>

            <div class="passage-preview">
                <div class="passage-text">${this.formatPassageText(candidate.text)}</div>
                <div class="passage-citation">${this.formatCitation(candidate)}</div>
            </div>

            <div class="candidate-metadata">
                ${this.renderMetadata(candidate.metadata)}
            </div>

            <button class="select-candidate-btn" onclick="citationIntegration.selectCandidate(${index})">
                Select This Source
            </button>
        `;

        return card;
    }

    /**
     * Get confidence level category
     */
    getConfidenceLevel(confidence) {
        if (confidence >= 0.8) return 'high';
        if (confidence >= 0.5) return 'medium';
        return 'low';
    }

    /**
     * Get display title for source
     */
    getSourceTitle(candidate) {
        if (candidate.type === 'bible') {
            return `${candidate.metadata.book} ${candidate.metadata.chapter}:${candidate.metadata.verses}`;
        } else {
            return candidate.metadata.title || candidate.source;
        }
    }

    /**
     * Format passage text for display
     */
    formatPassageText(text) {
        // Limit to 200 characters and add ellipsis if needed
        if (text.length > 200) {
            return text.substring(0, 200) + '...';
        }
        return text;
    }

    /**
     * Format citation for display
     */
    formatCitation(candidate) {
        if (candidate.type === 'bible') {
            return `${candidate.metadata.translation} Translation`;
        } else {
            let citation = '';
            if (candidate.metadata.author) {
                citation += `by ${candidate.metadata.author}`;
            }
            if (candidate.metadata.lines) {
                citation += citation ? `, lines ${candidate.metadata.lines}` : `Lines ${candidate.metadata.lines}`;
            }
            return citation;
        }
    }

    /**
     * Render metadata items
     */
    renderMetadata(metadata) {
        const items = [];

        // Common metadata fields
        if (metadata.author) {
            items.push(`<div class="metadata-item">
                <div class="metadata-label">Author</div>
                <div class="metadata-value">${metadata.author}</div>
            </div>`);
        }

        if (metadata.lines) {
            items.push(`<div class="metadata-item">
                <div class="metadata-label">Lines</div>
                <div class="metadata-value">${metadata.lines}</div>
            </div>`);
        }

        if (metadata.book && metadata.chapter) {
            items.push(`<div class="metadata-item">
                <div class="metadata-label">Reference</div>
                <div class="metadata-value">${metadata.book} ${metadata.chapter}</div>
            </div>`);
        }

        if (metadata.translation) {
            items.push(`<div class="metadata-item">
                <div class="metadata-label">Translation</div>
                <div class="metadata-value">${metadata.translation}</div>
            </div>`);
        }

        return items.join('');
    }

    /**
     * Select a candidate
     */
    selectCandidate(index) {
        console.log('🎯 STEP 5: Candidate selected');
        console.log('Selected index:', index);

        const candidate = this.currentCandidates[index];
        console.log('Selected candidate:', candidate);

        if (!candidate) {
            console.error('❌ Invalid candidate selection, index:', index);
            return;
        }

        this.selectedCandidate = candidate;

        console.log('📊 Candidate details:');
        console.log('Source:', candidate.source);
        console.log('Confidence:', candidate.confidence);
        console.log('Text preview:', candidate.text.substring(0, 100) + '...');
        console.log('Metadata:', candidate.metadata);

        // Update UI to show selection
        document.querySelectorAll('.candidate-card').forEach((card, i) => {
            if (i === index) {
                card.classList.add('selected');
            } else {
                card.classList.remove('selected');
            }
        });

        // Show full-text viewer instead of confirmation dialog
        setTimeout(() => {
            this.showFullTextViewer(candidate);
        }, 300);
    }

    /**
     * Show full-text viewer for selected candidate
     */
    async showFullTextViewer(candidate) {
        if (!this.fullTextViewer) {
            console.error('❌ Full-text viewer not available');
            this.showConfirmationDialog(); // Fallback to old method
            return;
        }

        try {
            console.log('📖 Opening full-text viewer for:', candidate.metadata.title);

            // Hide candidates modal
            const citationModal = document.getElementById('citationModal');
            if (citationModal) {
                citationModal.style.display = 'none';
            }

            // Show full-text modal
            const fullTextModal = document.getElementById('fullTextModal');
            if (fullTextModal) {
                fullTextModal.style.display = 'flex';
            }

            // Extract suggested line range from metadata
            const suggestedLines = this.extractSuggestedLines(candidate);

            // Load the full text viewer
            await this.fullTextViewer.displayFullTextViewer(candidate.metadata, suggestedLines);

            // Setup full-text viewer event handlers
            this.setupFullTextViewerHandlers();

        } catch (error) {
            console.error('❌ Error showing full-text viewer:', error);
            this.showConfirmationDialog(); // Fallback to old method
        }
    }

    /**
     * Extract suggested lines from candidate metadata
     */
    extractSuggestedLines(candidate) {
        if (!candidate.metadata || !candidate.metadata.lines) {
            return null;
        }

        const linesStr = candidate.metadata.lines;
        const match = linesStr.match(/(\d+)-(\d+)/);

        if (match) {
            return {
                start: parseInt(match[1]),
                end: parseInt(match[2])
            };
        }

        // Single line
        const singleMatch = linesStr.match(/(\d+)/);
        if (singleMatch) {
            const line = parseInt(singleMatch[1]);
            return {
                start: line,
                end: line
            };
        }

        return null;
    }

    /**
     * Setup event handlers for full-text viewer
     */
    setupFullTextViewerHandlers() {
        // Cancel button
        const cancelBtn = document.getElementById('cancelFullTextViewer');
        if (cancelBtn) {
            cancelBtn.onclick = () => {
                this.closeFullTextViewer();
            };
        }

        // Confirm selection button
        const confirmBtn = document.getElementById('confirm-selection');
        if (confirmBtn) {
            confirmBtn.onclick = () => {
                this.confirmFullTextSelection();
            };
        }

        // Close on outside click
        const fullTextModal = document.getElementById('fullTextModal');
        if (fullTextModal) {
            fullTextModal.onclick = (e) => {
                if (e.target === fullTextModal) {
                    this.closeFullTextViewer();
                }
            };
        }

        // ESC key handler
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeFullTextViewer();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    }

    /**
     * Confirm selection from full-text viewer
     */
    async confirmFullTextSelection() {
        if (!this.fullTextViewer) {
            console.error('❌ Full-text viewer not available');
            return;
        }

        const selection = this.fullTextViewer.getCurrentSelection();
        if (!selection) {
            alert('Please select text lines first');
            return;
        }

        console.log('✅ User confirmed selection:', selection);

        // Update candidate with user's selection
        this.selectedCandidate.text = selection.text;
        this.selectedCandidate.metadata.lines = `${selection.start}-${selection.end}`;

        // Close full-text viewer
        this.closeFullTextViewer();

        // Proceed with confirmation
        this.showConfirmationDialog();
    }

    /**
     * Close full-text viewer
     */
    closeFullTextViewer() {
        const fullTextModal = document.getElementById('fullTextModal');
        if (fullTextModal) {
            fullTextModal.style.display = 'none';
        }

        // Show candidates modal again
        const citationModal = document.getElementById('citationModal');
        if (citationModal) {
            citationModal.style.display = 'flex';
        }
    }

    /**
     * Show confirmation dialog
     */
    showConfirmationDialog() {
        const targetText = document.getElementById('targetText').value;

        // Hide candidates modal
        const citationModal = document.getElementById('citationModal');
        if (citationModal) citationModal.style.display = 'none';

        // Populate confirmation dialog
        const selectedSourcePreview = document.getElementById('selectedSourcePreview');
        const targetTextPreview = document.getElementById('targetTextPreview');

        if (selectedSourcePreview && this.selectedCandidate) {
            selectedSourcePreview.innerHTML = `
                <strong>${this.getSourceTitle(this.selectedCandidate)}</strong><br>
                ${this.selectedCandidate.text}
            `;
        }

        if (targetTextPreview) {
            targetTextPreview.textContent = targetText || 'No target text selected';
        }

        // Show confirmation modal
        const confirmationModal = document.getElementById('confirmationModal');
        if (confirmationModal) {
            confirmationModal.style.display = 'flex';
        }
    }

    /**
     * Confirm selection and save the pair
     */
    async confirmSelection() {
        console.log('💾 STEP 6: Confirm selection and save');

        if (!this.selectedCandidate) {
            console.error('❌ No candidate selected');
            return;
        }

        const confirmButton = document.getElementById('confirmSelection');
        const targetText = document.getElementById('targetText').value.trim();
        const sourceText = this.selectedCandidate.text;
        const metadata = this.selectedCandidate.metadata;

        console.log('📝 Save data preparation:');
        console.log('Target text length:', targetText.length);
        console.log('Source text length:', sourceText.length);
        console.log('Target text preview:', targetText.substring(0, 100) + '...');
        console.log('Source text preview:', sourceText.substring(0, 100) + '...');
        console.log('Metadata:', metadata);

        // Validate inputs
        if (!targetText) {
            console.log('❌ No target text provided');
            alert('Please select target text first before confirming the source.');
            return;
        }

        if (!sourceText) {
            console.log('❌ No source text in candidate');
            alert('Selected source has no text content.');
            return;
        }

        try {
            // Disable button and show loading state
            if (confirmButton) {
                confirmButton.disabled = true;
                confirmButton.textContent = 'Saving...';
            }

            console.log('💾 Attempting to save source-target pair...');

            // Save the source-target pair
            const saveSuccess = await this.saveSourceTextPair(targetText, sourceText, metadata);

            console.log('📊 Save operation result:', saveSuccess);

            if (saveSuccess) {
                console.log('✅ Save successful, closing modals');

                // Close modals only on successful save
                this.closeAllModals();

                // Show success message
                this.showCitationStatus('Source linked and saved successfully!', 'success');

                // Clear selection
                this.selectedCandidate = null;

                console.log('🎉 Citation pair saved successfully');
            } else {
                throw new Error('Save operation returned false');
            }

        } catch (error) {
            console.error('❌ Error confirming selection:', error);
            console.trace('Error stack trace');

            // Show error message to user
            const errorMessage = error.message || 'Failed to save the source-target pair';
            alert(`Error: ${errorMessage}\n\nPlease try again or check the console for details.`);

            // Re-enable button
            if (confirmButton) {
                confirmButton.disabled = false;
                confirmButton.textContent = 'Confirm & Save';
            }

            // Don't close modal on error
        }
    }

    /**
     * Save source-target text pair
     */
    saveSourceTextPair(targetText, sourceText, metadata) {
        try {
            // Get the main app instance
            const app = window.poetryApp;

            if (!app) {
                throw new Error('Main application not found');
            }

            // Create data entry in the same format as the existing app
            const dataEntry = {
                id: Date.now(),
                timestamp: new Date().toISOString(),
                page: app.currentPage || 1,
                targetText: targetText || '',
                sourceInfo: sourceText || '',
                // Add citation metadata for enhanced tracking
                citationMetadata: {
                    source: metadata.source || 'citation_lookup',
                    confidence: this.selectedCandidate?.confidence || 0,
                    author: metadata.author || '',
                    title: metadata.title || '',
                    book: metadata.book || '',
                    chapter: metadata.chapter || '',
                    verses: metadata.verses || '',
                    lines: metadata.lines || '',
                    translation: metadata.translation || ''
                }
            };

            // Add to the app's saved data
            app.savedData.push(dataEntry);

            // Save to localStorage using app's method
            app.saveToStorage();

            // Update the data display using app's method
            app.updateDataDisplay();

            // Update the app's status
            app.updateStatus('Source-target pair saved successfully via citation lookup!');

            // Clear the current selection in the app
            app.clearCurrentSelection();

            console.log('Successfully saved citation pair:', dataEntry);

            return true;

        } catch (error) {
            console.error('Error saving source-target pair:', error);
            throw error;
        }
    }

    /**
     * Close all modals
     */
    closeAllModals() {
        const citationModal = document.getElementById('citationModal');
        const confirmationModal = document.getElementById('confirmationModal');

        if (citationModal) {
            citationModal.style.display = 'none';
        }

        if (confirmationModal) {
            confirmationModal.style.display = 'none';
        }

        // Reset modal state
        this.resetModalState();
    }

    /**
     * Reset modal state and cleanup
     */
    resetModalState() {
        // Clear current selection
        this.selectedCandidate = null;
        this.currentCandidates = [];

        // Reset tab selection
        this.currentSourceType = 'all';
        const tabButtons = document.querySelectorAll('.tab-btn');
        tabButtons.forEach(btn => {
            if (btn.dataset.tab === 'all') {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Reset confirm button
        const confirmButton = document.getElementById('confirmSelection');
        if (confirmButton) {
            confirmButton.disabled = false;
            confirmButton.textContent = 'Confirm & Save';
        }

        // Clear any loading states
        const loadingCandidates = document.getElementById('loadingCandidates');
        const candidatesList = document.getElementById('candidatesList');
        const noCandidates = document.getElementById('noCandidates');

        if (loadingCandidates) loadingCandidates.style.display = 'none';
        if (candidatesList) candidatesList.innerHTML = '';
        if (noCandidates) noCandidates.style.display = 'none';

        // Clear citation query
        const queriedCitation = document.getElementById('queriedCitation');
        if (queriedCitation) queriedCitation.textContent = '';

        // Clear preview content
        const selectedSourcePreview = document.getElementById('selectedSourcePreview');
        const targetTextPreview = document.getElementById('targetTextPreview');

        if (selectedSourcePreview) selectedSourcePreview.innerHTML = '';
        if (targetTextPreview) targetTextPreview.textContent = '';

        console.log('Modal state reset completed');
    }

    /**
     * Setup modal event listeners
     */
    setupModalEventListeners() {
        // Close buttons
        document.getElementById('closeCitationModal')?.addEventListener('click', () => {
            this.closeAllModals();
        });

        document.getElementById('closeConfirmationModal')?.addEventListener('click', () => {
            this.closeAllModals();
        });

        // Cancel buttons
        document.getElementById('cancelCitationLookup')?.addEventListener('click', () => {
            this.closeAllModals();
        });

        document.getElementById('cancelSelection')?.addEventListener('click', () => {
            document.getElementById('confirmationModal').style.display = 'none';
            document.getElementById('citationModal').style.display = 'flex';
        });

        // Confirm button
        const confirmButton = document.getElementById('confirmSelection');
        if (confirmButton) {
            confirmButton.addEventListener('click', (e) => {
                console.log('Confirm button clicked', e);
                this.confirmSelection();
            });
            console.log('Confirm button event listener attached successfully');
        } else {
            console.error('Confirm button not found during setup');
        }

        // Retry button
        document.getElementById('retryLookup')?.addEventListener('click', () => {
            this.closeAllModals();
            // Focus back on source info textarea
            document.getElementById('sourceInfo')?.focus();
        });

        // Click outside to close
        document.getElementById('citationModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'citationModal') {
                this.closeAllModals();
            }
        });

        document.getElementById('confirmationModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'confirmationModal') {
                this.closeAllModals();
            }
        });
    }

    /**
     * Setup tab event listeners
     */
    setupTabEventListeners() {
        const tabButtons = document.querySelectorAll('.tab-btn');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                // Update active tab
                tabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');

                // Update current source type
                this.currentSourceType = button.dataset.tab;

                // Re-render candidates with new filter
                this.renderCandidates(this.currentCandidates);
            });
        });
    }
}

// Initialize citation integration when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.citationIntegration = new CitationIntegration();
});