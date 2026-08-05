/**
 * Citation Integration Module - 完璧版
 * ローカル環境と本番環境の両方に対応
 * 
 * ✅ FIXES:
 * - corpus-config.js の設定を活用
 * - ローカル環境: /catalog/unified_catalog.csv
 * - 本番環境: /texts/unified_catalog.csv
 * - Find Sources ボタンを正しく検出
 * - selectCandidate を async に変更
 * - showFullTextViewer を await で待つ
 * - モーダル制御を正しく実装
 * ✅ NEW: 青空文庫対応 (aozora:作者ID/作品ID パターン)
 */

class CitationIntegration {
    constructor() {
        this.selectedCandidate = null;
        this.currentCandidates = [];
        this.currentSourceType = 'all';
        this.currentSearchTerm = '';
        this.catalog = null;
        this.dynamicCatalog = null;
        this.csvCatalog = null;
        this.fullTextViewer = null;
        this.bibleProvider = null;

        this.unifiedCatalog = null;
        this.catalogIndex = {};
        this.apiBaseUrl = '';

        this.initializeEventListeners();
        this.initializeCitationEngine();
        this.loadUnifiedCatalog();
    }

    async initializeCitationEngine() {
        try {
            console.log('🚀 Initializing citation engine...');

            this.apiBaseUrl = window.location.origin;
            console.log(`📡 API base URL: ${this.apiBaseUrl}`);

            if (window.BibleProvider) {
                this.bibleProvider = new window.BibleProvider();
                try {
                    await this.bibleProvider.initialize();
                    console.log('✅ Bible provider initialized');
                } catch (error) {
                    console.warn('⚠️ Bible provider initialization failed:', error.message);
                }
            }

            if (window.FullTextViewer) {
                this.fullTextViewer = new window.FullTextViewer();
                console.log('✅ Full-text viewer initialized');
            }

            if (window.mainApp) {
                console.log('Main app instance found and ready');
            }

        } catch (error) {
            console.error('❌ Error initializing citation engine:', error);
        }
    }

    async loadUnifiedCatalog() {
        try {
            console.log('📚 Loading unified catalog...');

            const CACHE_KEY = 'unified_catalog_v1';
            const cached = localStorage.getItem(CACHE_KEY);
            if (cached) {
                console.log('📦 Using cached catalog');
                this.unifiedCatalog = JSON.parse(cached);
                console.log(`✅ Loaded ${this.unifiedCatalog.length} works from cache`);
                return;
            }

            const config = window.corpusConfig || {};

            if (!config.catalog?.enabled) {
                console.warn('⚠️ Catalog is disabled in corpus-config');
                this.unifiedCatalog = [];
                return;
            }

            const catalogPath = config.catalog?.path;
            console.log(`📁 Catalog path from config: ${catalogPath}`);

            if (!catalogPath) {
                console.warn('⚠️ Catalog path is not defined');
                this.unifiedCatalog = [];
                return;
            }

            let response;
            try {
                console.log(`📡 Fetching from: ${catalogPath}`);
                response = await fetch(catalogPath);
            } catch (error) {
                console.warn(`⚠️ Failed with ${catalogPath}, trying alternate path...`);
                try {
                    response = await fetch('/texts/unified_catalog.csv');
                } catch (error2) {
                    try {
                        response = await fetch('/catalog/unified_catalog.csv');
                    } catch (error3) {
                        console.error('❌ All catalog paths failed');
                        this.unifiedCatalog = [];
                        return;
                    }
                }
            }

            if (!response || !response.ok) {
                console.error(`❌ HTTP error: ${response?.status} ${response?.statusText}`);
                this.unifiedCatalog = [];
                return;
            }

            const csvText = await response.text();

            if (!csvText || csvText.length === 0) {
                console.error('❌ Catalog file is empty or could not be read');
                this.unifiedCatalog = [];
                return;
            }

            console.log(`📄 Catalog file size: ${csvText.length} bytes`);

            const lines = csvText.trim().split('\n');
            console.log(`📋 Total lines: ${lines.length}`);

            if (lines.length < 2) {
                console.warn('⚠️ Catalog has no data (only header or empty)');
                this.unifiedCatalog = [];
                return;
            }

            this.unifiedCatalog = [];

            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;

                const parts = this.parseCSVLine(line);

                const textNum = parts[0];
                const type = parts[1];
                const issued = parts[2];
                const title = parts[3];
                const language = parts[4];
                const authors = parts[5];
                const source = parts[11] || 'gutenberg';

                if (textNum) {
                    const work = {
                        id: parseInt(textNum) || textNum,
                        pgId: parseInt(textNum) || textNum,
                        title: title || '',
                        authors: authors || 'Unknown',
                        subjects: parts[6] || '',   // 青空文庫の場合はauthor_id
                        bookCode: parts[9] || '',    // 聖書の場合は書コード（GEN, MATなど）
                        source: source.toLowerCase(),
                        type: type || 'literature'
                    };

                    this.unifiedCatalog.push(work);
                    this.catalogIndex[parseInt(textNum)] = work;
                }

            }

            console.log(`✅ Loaded ${this.unifiedCatalog.length} works from unified catalog`);
            console.log('ℹ️ Catalog caching skipped (too large for localStorage)');

        } catch (error) {
            console.error('❌ Error loading catalog:', error);
            this.unifiedCatalog = [];
        }
    }

    initializeEventListeners() {
        const findSourcesSelectors = [
            '#findSourcesBtn',
            '#findSourcesButton',
            'button[id*="findSource"]'
        ];

        let findSourcesButton = null;
        for (const selector of findSourcesSelectors) {
            findSourcesButton = document.querySelector(selector);
            if (findSourcesButton) {
                console.log(`✅ Found Find Sources button: ${selector}`);
                break;
            }
        }

        if (findSourcesButton) {
            findSourcesButton.style.display = 'block';
            findSourcesButton.addEventListener('click', () => {
                console.log('🔍 Find Sources clicked');
                this.findSources();
            });
        } else {
            console.warn('⚠️ Find Sources button not found in DOM');
        }

        const closeCitationModal = document.getElementById('closeCitationModal');
        if (closeCitationModal) {
            closeCitationModal.addEventListener('click', () => this.closeAllModals());
        }

        const cancelCitationLookup = document.getElementById('cancelCitationLookup');
        if (cancelCitationLookup) {
            cancelCitationLookup.addEventListener('click', () => this.closeAllModals());
        }

        const searchAgainBtn = document.getElementById('searchAgainBtn');
        const citationSearchInput = document.getElementById('citationSearchInput');
        if (searchAgainBtn && citationSearchInput) {
            const doModalSearch = async () => {
                const term = citationSearchInput.value.trim();
                if (!term) return;
                this.currentSearchTerm = term;
                const loadingEl = document.getElementById('loadingCandidates');
                const candidatesContainer = document.getElementById('candidatesContainer');
                if (loadingEl) loadingEl.style.display = 'flex';
                const candidates = await this.performCitationLookup(term);
                if (loadingEl) loadingEl.style.display = 'none';
                this.currentCandidates = candidates;
                this.displayCitationModal(candidates);
                const citationModal = document.getElementById('citationModal');
                if (citationModal) citationModal.style.display = 'block';
            };
            searchAgainBtn.addEventListener('click', doModalSearch);
            citationSearchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') doModalSearch();
            });
        }

        const cancelFullTextViewer = document.getElementById('cancelFullTextViewer');
        if (cancelFullTextViewer) {
            cancelFullTextViewer.addEventListener('click', () => this.closeAllModals());
        }

        const confirmSelection = document.getElementById('confirm-selection');
        if (confirmSelection) {
            confirmSelection.addEventListener('click', () => this.confirmSelection());
        }

        const closeConfirmationModal = document.getElementById('closeConfirmationModal');
        if (closeConfirmationModal) {
            closeConfirmationModal.addEventListener('click', () => this.closeAllModals());
        }
    }

    async findSources() {
        const sourceTextField = document.getElementById('sourceInfo');
        let selectedText = '';

        if (sourceTextField && sourceTextField.value.trim()) {
            selectedText = sourceTextField.value.trim();
        }

        if (!selectedText) {
            selectedText = window.getSelection().toString().trim();
        }

        if (!selectedText) {
            alert('Please enter a citation in "Source Text" field or select text from PDF');
            return;
        }

        console.log('🔍 Find Sources clicked, text:', selectedText);
        this.currentSearchTerm = selectedText;

        try {
            const candidates = await this.performCitationLookup(selectedText);
            this.currentCandidates = candidates;
            this.displayCitationModal(candidates);
        } catch (error) {
            console.error('Error in findSources:', error);
            alert('Error: ' + error.message);
        }
    }

    parseCSVLine(line) {
        const result = [];
        let current = '';
        let insideQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];

            if (char === '"') {
                if (insideQuotes && nextChar === '"') {
                    current += '"';
                    i++;
                } else {
                    insideQuotes = !insideQuotes;
                }
            } else if (char === ',' && !insideQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }

        result.push(current.trim());
        return result;
    }

    async performCitationLookup(citationText) {
        console.log('🔧 Generating candidates...');
        const parsed = this.parseCitation(citationText);
        console.log('Parsed citation:', parsed);
        const candidates = await this.generateCatalogCandidates(parsed);
        return candidates;
    }

    parseCitation(citationText) {
        console.log('🔧 Parsing citation:', citationText);

        // ── ① 青空文庫パターン: aozora:作者ID/作品ID ──────────────────────
        const aozoraPattern = /^aozora:(\d+)\/(\d+)$/i;
        const aozoraMatch = citationText.trim().match(aozoraPattern);
        if (aozoraMatch) {
            console.log(`✅ Aozora pattern matched: author=${aozoraMatch[1]} work=${aozoraMatch[2]}`);
            return {
                type: 'aozora',
                authorId: aozoraMatch[1].padStart(6, '0'),
                workId: aozoraMatch[2],
                work: citationText.toLowerCase()
            };
        }

        // ── ② Bible参照パターン: gen1:10, GEN 1:10, Genesis 1:10, 創世記1:1-5 ──
        const biblePattern = /^([1-3]?[a-zA-Z぀-鿿]+)\s*(\d+)\s*[:.]\s*(\d+)(?:\s*-\s*(\d+))?$/;
        const bibleMatch = citationText.trim().match(biblePattern);
        if (bibleMatch) {
            const bookCode = this.resolveBibleBook(bibleMatch[1]);
            if (bookCode) {
                const chapter    = parseInt(bibleMatch[2]);
                const verseStart = parseInt(bibleMatch[3]);
                const verseEnd   = bibleMatch[4] ? parseInt(bibleMatch[4]) : verseStart;
                console.log(`✅ Bible pattern matched: ${bookCode} ${chapter}:${verseStart}-${verseEnd}`);
                return {
                    type: 'bible',
                    book: bookCode,
                    chapter,
                    verseStart,
                    verseEnd,
                    work: citationText.toLowerCase()
                };
            }
        }

        // ── ③ 既存パターン: "Work Name X-Y" ─────────────────────────────────
        const pattern = /^(.+?)\s+(\d+)\s*-\s*(\d+)$/;
        const match = citationText.match(pattern);
        if (match) {
            console.log(`✅ Pattern matched: work="${match[1]}", lines=${match[2]}-${match[3]}`);
            return {
                work: match[1].toLowerCase(),
                startLine: parseInt(match[2]),
                endLine: parseInt(match[3])
            };
        }

        return { work: citationText.toLowerCase() };
    }

    resolveBibleBook(raw) {
        const map = {
            // 日本語書名
            '創世記': 'GEN', '出エジプト記': 'EXO',
            'レビ記': 'LEV', '民数記': 'NUM', '申命記': 'DEU',
            'ヨシュア記': 'JOS', '詩編': 'PSA', '詩箇': 'PSA',
            '箖言': 'PRO', 'マタイ': 'MAT', 'マタイ福音書': 'MAT',
            'マルコ': 'MRK', 'ルカ': 'LUK', 'ヨハネ': 'JHN',
            'ローマ': 'ROM', '黙示録': 'REV', 'ヨハネ黙示録': 'REV',
            'イザヤ書': 'ISA', 'エレミヤ書': 'JER',
            'ヨブ記': 'JOB', 'ルツ記': 'RUT',
            // 英語書名
            'gen': 'GEN', 'genesis': 'GEN',
            'exo': 'EXO', 'exodus': 'EXO',
            'lev': 'LEV', 'leviticus': 'LEV',
            'num': 'NUM', 'numbers': 'NUM',
            'deu': 'DEU', 'deuteronomy': 'DEU',
            'jos': 'JOS', 'joshua': 'JOS',
            'psa': 'PSA', 'psalm': 'PSA', 'psalms': 'PSA',
            'pro': 'PRO', 'proverbs': 'PRO',
            'mat': 'MAT', 'matthew': 'MAT',
            'mar': 'MRK', 'mark': 'MRK', 'mrk': 'MRK',
            'luk': 'LUK', 'luke': 'LUK',
            'joh': 'JHN', 'john': 'JHN', 'jhn': 'JHN',
            'rom': 'ROM', 'romans': 'ROM',
            'rev': 'REV', 'revelation': 'REV',
        };
        return map[raw.toLowerCase()] || null;
    }

    async generateCatalogCandidates(parsed) {
        console.log('🔄 Generating candidates...');

        // ── ① 青空文庫 ────────────────────────────────────────────────────
        if (parsed.type === 'aozora') {
            const config = window.corpusConfig || {};
            if (!config.aozora?.enabled) {
                console.warn('⚠️ Aozora is disabled in corpus-config');
                return [];
            }

            const apiUrl = `${config.aozora.apiUrl}?author=${parsed.authorId}&work=${parsed.workId}`;
            console.log(`📡 Fetching Aozora: ${apiUrl}`);

            try {
                const res = await fetch(apiUrl);
                const data = await res.json();

                if (!data.success) {
                    console.error('Aozora API error:', data.error);
                    return [];
                }

                console.log(`✅ Aozora: ${data.length} chars loaded`);
                return [{
                    id: `AOZORA_${parsed.authorId}_${parsed.workId}`,
                    pgId: null,
                    title: data.title || `青空文庫 作品${parsed.workId}`,
                    authors: data.author || `作者${parsed.authorId}`,
                    source: 'aozora',
                    type: 'aozora',
                    confidence: 0.99,
                    metadata: { authorId: parsed.authorId, workId: parsed.workId },
                    text: data.text
                }];
            } catch (e) {
                console.error('Aozora fetch error:', e);
                return [];
            }
        }

        // ── ② Bible ─────────────────────────────────────────────────────
        if (parsed.type === 'bible') {
            const bp = this.bibleProvider;
            if (!bp || !bp.initialized) {
                console.warn('⚠️ BibleProvider not ready');
                return [];
            }
            try {
                const allVerses = bp.getAllVerses(parsed.book);
                if (!allVerses || allVerses.length === 0) return [];
                const fullText = allVerses.map(v => `[${v.ref}] ${v.text}`).join('\n');
                const startRef  = `${parsed.book} ${parsed.chapter}:${parsed.verseStart}`;
                const endRef    = `${parsed.book} ${parsed.chapter}:${parsed.verseEnd}`;
                const startLine = allVerses.findIndex(v => v.ref === startRef) + 1;
                const endLine   = allVerses.findIndex(v => v.ref === endRef)   + 1;
                const label = `${parsed.book} ${parsed.chapter}:${parsed.verseStart}${parsed.verseEnd !== parsed.verseStart ? '-' + parsed.verseEnd : ''}`;
                console.log(`✅ Bible: 全${allVerses.length}節, 表示範囲 lines ${startLine}-${endLine}`);
                return [{
                    id: `BIBLE_${parsed.book}`,
                    pgId: null,
                    title: label,
                    authors: 'Various',
                    source: 'bible',
                    confidence: 0.99,
                    type: 'bible',
                    metadata: { book: parsed.book, chapter: parsed.chapter, lines: `${startLine}-${endLine}` },
                    text: fullText
                }];
            } catch (e) {
                console.error('Bible lookup error:', e);
                return [];
            }
        }

        // ── ③ Gutenberg（既存） ──────────────────────────────────────────
        if (!this.unifiedCatalog || this.unifiedCatalog.length === 0) {
            console.warn('⚠️ Catalog is empty');
            return [];
        }

        const candidates = [];
        const bibleCandidates = [];
        const searchTerm = parsed.work;
        // 日本語書名を英語に変換してカタログ検索も行う
        const jaToEnMap = {
            '創世記': 'genesis', '出エジプト記': 'exodus', 'レビ記': 'leviticus',
            '民数記': 'numbers', '申命記': 'deuteronomy', 'ヨシュア記': 'joshua',
            '士師記': 'judges', 'ルツ記': 'ruth', '詩篇': 'psalms', '詩編': 'psalms',
            '箴言': 'proverbs', 'ヨブ記': 'job', 'イザヤ書': 'isaiah',
            'エレミヤ書': 'jeremiah', 'マタイ福音書': 'matthew', 'マルコ福音書': 'mark',
            'ルカ福音書': 'luke', 'ヨハネ福音書': 'john', 'ローマ書': 'romans',
            'ヨハネ黙示録': 'revelation', '黙示録': 'revelation',
        };
        const searchTermEn = jaToEnMap[parsed.work] || null;

        // 先にbibleエントリーだけスキャン
        for (const work of this.unifiedCatalog) {
            if (work.source !== 'bible') continue;
            const titleLower = work.title.toLowerCase();
            let match = false;
            let confidence = 0;
            if (searchTermEn && titleLower.includes(searchTermEn))  { match = true; confidence = 0.99; }
            else if (titleLower.includes(searchTerm))               { match = true; confidence = 0.99; }
            if (!match) continue;
            // bible処理（既存のコードに流す）
            const bp = this.bibleProvider;
            if (!bp || !bp.initialized) continue;
            const bookCode = work.bookCode;
            if (!bookCode) continue;
            try {
                const isJapanese = /[぀-鿿]/.test(searchTerm);
                const versionId = isJapanese && bp.versions['jpn-jpn1965'] ? 'jpn-jpn1965' : null;
                const allVerses = bp.getAllVerses(bookCode, versionId);
                if (!allVerses || allVerses.length === 0) continue;
                const fullText = allVerses.map(v => `[${v.ref}] ${v.text}`).join('\n');
                candidates.push({
                    id: work.id,
                    pgId: null,
                    title: work.title,
                    authors: work.authors,
                    source: 'bible',
                    type: 'bible',
                    confidence: 0.99,
                    metadata: { book: bookCode, chapter: null, lines: null },
                    text: fullText
                });
            } catch(e) { console.error('Bible pre-scan error:', e); }
        }

        // 次にGutenberg/青空文庫をスキャン
        for (const work of this.unifiedCatalog) {
            if (work.source === 'bible') continue; // 上でスキャン済み
            const titleLower  = work.title.toLowerCase();
            let match = false;
            let confidence = 0;

            if (titleLower === searchTerm)                                { match = true; confidence = 0.99; }
            else if (titleLower.startsWith(searchTerm.split(' ')[0]))    { match = true; confidence = 0.85; }
            else if (titleLower.includes(searchTerm))                    { match = true; confidence = 0.75; }
            // 日本語書名→英語変換でマッチ
            else if (searchTermEn && titleLower.includes(searchTermEn))  { match = true; confidence = 0.95; }

            if (match) {
                // ── 聖書エントリーの場合 ─────────────────────────────────
                if (work.source === 'bible') {
                    const bp = this.bibleProvider;
                    if (!bp || !bp.initialized) continue;
                    const bookCode = work.bookCode;
                    if (!bookCode) continue;
                    // 全節を取得してビューワーに渡す
                    const chapter    = parsed.chapter    || null;
                    const verseStart = parsed.verseStart || null;
                    const verseEnd   = parsed.verseEnd   || null;
                    try {
                        // 日本語検索の場合は日本語版を優先
                        const isJapanese = /[぀-鿿]/.test(searchTerm);
                        const versionId = isJapanese && bp.versions['jpn-jpn1965'] ? 'jpn-jpn1965' : null;
                        // 全節を収集
                        const allVerses = bp.getAllVerses(bookCode, versionId);
                        if (!allVerses || allVerses.length === 0) continue;
                        const fullText = allVerses.map(v => `[${v.ref}] ${v.text}`).join('\n');
                        // 指定範囲の行番号を計算
                        let startLine = null, endLine = null;
                        if (chapter && verseStart) {
                            const startRef = `${bookCode} ${chapter}:${verseStart}`;
                            const endRef   = `${bookCode} ${chapter}:${verseEnd || verseStart}`;
                            startLine = allVerses.findIndex(v => v.ref === startRef) + 1;
                            endLine   = allVerses.findIndex(v => v.ref === endRef)   + 1;
                        }
                        candidates.push({
                            id: work.id,
                            pgId: null,
                            title: work.title,
                            authors: work.authors,
                            source: 'bible',
                            type: 'bible',
                            confidence,
                            metadata: {
                                book: bookCode,
                                chapter,
                                lines: startLine && endLine ? `${startLine}-${endLine}` : null
                            },
                            text: fullText
                        });
                    } catch(e) {
                        console.error('Bible catalog lookup error:', e);
                    }
                    if (candidates.length >= 5) break;
                    continue;
                }

                // ── 青空文庫エントリーの場合 ──────────────────────────────
                if (work.source === 'aozora') {
                    const realWorkId = String(work.pgId - 1_000_000);
                    const authorId = work.subjects;
                    const config = window.corpusConfig || {};
                    if (!config.aozora?.enabled) continue;
                    try {
                        const apiUrl = `${config.aozora.apiUrl}?author=${authorId}&work=${realWorkId}`;
                        console.log(`📡 Fetching Aozora: ${apiUrl}`);
                        const res = await fetch(apiUrl);
                        const data = await res.json();
                        if (data.success) {
                            candidates.push({
                                id: work.id,
                                pgId: work.pgId,
                                title: work.title,
                                authors: work.authors,
                                source: 'aozora',
                                type: 'aozora',
                                confidence,
                                metadata: { authorId, workId: realWorkId },
                                text: data.text
                            });
                        }
                    } catch (e) {
                        console.error('Aozora fetch error:', e);
                    }
                    if (candidates.length >= 5) break;
                    continue;
                }

                // ── Gutenberg ─────────────────────────────────────────────
                console.log(`✅ Catalog hit: "${work.title}" (ID: ${work.pgId})`);
                try {
                    const apiUrl = `${this.apiBaseUrl}/api/text?id=${work.pgId}`;
                    const response = await fetch(apiUrl);
                    const data = await response.json();

                    if (data.success) {
                        const lines = data.text.split('\n');
                        candidates.push({
                            id: work.id,
                            pgId: work.pgId,
                            title: work.title,
                            authors: work.authors,
                            source: `gutenberg:${work.pgId}`,
                            confidence,
                            type: 'literature',
                            metadata: {
                                textId: work.pgId,
                                lines: parsed.startLine && parsed.endLine
                                    ? `${parsed.startLine}-${parsed.endLine}` : null,
                                totalLines: lines.length
                            },
                            text: lines.slice(
                                (parsed.startLine || 1) - 1,
                                (parsed.endLine || lines.length)
                            ).join('\n')
                        });
                    }
                } catch (error) {
                    console.error('Error fetching text:', error);
                }

                if (candidates.length >= 5) break;
            }
        }

        return candidates;
    }

    displayCitationModal(candidates) {
        const citationModal = document.getElementById('citationModal');
        if (!citationModal) {
            console.error('Citation modal not found');
            return;
        }

        const container = citationModal.querySelector('.candidates-container') ||
            citationModal.querySelector('#candidatesContainer');

        if (!container) {
            console.error('Candidates container not found');
            return;
        }

        let html = '<div class="candidates-list">';

        if (candidates.length === 0) {
            html += '<div class="no-candidates"><p>No sources found. Try a different search.</p></div>';
        } else {
            candidates.forEach((candidate, index) => {
                const confidencePct = (candidate.confidence * 100).toFixed(0);
                const confidenceColor = confidencePct >= 90 ? '#2ecc71' :
                    confidencePct >= 70 ? '#f39c12' : '#e74c3c';
                html += `
                <div class="candidate-item" style="
                    border: 1px solid #ddd;
                    border-radius: 8px;
                    padding: 12px 16px;
                    margin-bottom: 10px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: ${index === 0 ? '#f0f7ff' : '#fff'};
                    cursor: pointer;
                    transition: background 0.2s;
                " onmouseover="this.style.background='#e8f4fd'" onmouseout="this.style.background='${index === 0 ? '#f0f7ff' : '#fff'}'">
                    <div style="flex: 1;">
                        <div style="font-weight: bold; font-size: 14px; margin-bottom: 4px;">
                            ${index === 0 ? '⭐ ' : ''}${candidate.title}
                        </div>
                        <div style="color: #666; font-size: 12px;">by ${candidate.authors}</div>
                        <div style="margin-top: 4px;">
                            <span style="
                                background: ${confidenceColor};
                                color: white;
                                padding: 2px 8px;
                                border-radius: 12px;
                                font-size: 11px;
                                font-weight: bold;
                            ">Confidence: ${confidencePct}%</span>
                            ${candidate.pgId ? `<span style="color:#999; font-size:11px; margin-left:8px;">PG #${candidate.pgId}</span>` : ''}
                            ${candidate.type === 'aozora' ? `<span style="color:#e67e22; font-size:11px; margin-left:8px;">📚 青空文庫</span>` : ''}
                        </div>
                    </div>
                    <button class="select-btn" data-index="${index}" style="
                        background: #4a90e2;
                        color: white;
                        border: none;
                        padding: 8px 18px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 13px;
                        font-weight: bold;
                        margin-left: 12px;
                        white-space: nowrap;
                        transition: background 0.2s;
                    " onmouseover="this.style.background='#357abd'" onmouseout="this.style.background='#4a90e2'">
                        Open Text ▶
                    </button>
                </div>
            `;
            });
        }

        html += '</div>';
        container.innerHTML = html;

        container.querySelectorAll('.select-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.currentTarget.dataset.index);
                this.selectCandidate(index, candidates[index]);
            });
        });

        citationModal.style.display = 'block';
        console.log('Modal opened');
    }

    async selectCandidate(index, candidate) {
        console.log('🎯 Candidate selected:', candidate.title);
        this.selectedCandidate = candidate;
        await this.showFullTextViewer(candidate);
    }

    async showFullTextViewer(candidate) {
        console.log('📖 Showing full-text viewer for:', candidate.title);

        if (!this.fullTextViewer) {
            console.error('❌ Full-text viewer not available');
            return;
        }

        try {
            await this.fullTextViewer.displayFullTextViewer(
                {
                    pgId:    candidate.pgId || candidate.id,
                    title:   candidate.title,
                    authors: candidate.authors,
                    source_file: candidate.metadata?.textId,
                    source: candidate.source,
                    type:   candidate.type,
                    text:   candidate.text,
                    // 青空文庫用メタ情報
                    authorId: candidate.metadata?.authorId,
                    workId:   candidate.metadata?.workId
                },
                {
                    start: candidate.metadata?.lines?.split('-')[0],
                    end:   candidate.metadata?.lines?.split('-')[1]
                }
            );

            const citationModal = document.getElementById('citationModal');
            if (citationModal) citationModal.style.display = 'none';

            const viewerModal = document.getElementById('fullTextModal');
            if (viewerModal) viewerModal.style.display = 'block';

        } catch (error) {
            console.error('❌ Error showing full-text viewer:', error);
        }
    }

    confirmSelection() {
        if (!this.fullTextViewer) {
            console.error('Full-text viewer not available');
            return;
        }

        const selection = this.fullTextViewer.getCurrentSelection();

        if (!selection) {
            console.warn('No selection made');
            return;
        }

        console.log('✅ Selection confirmed:', selection);

        const sourceInfoField = document.getElementById('sourceInfo');
        if (sourceInfoField) {
            sourceInfoField.value = selection.text;
            sourceInfoField.dispatchEvent(new Event('input', { bubbles: true }));
        }

        window.dispatchEvent(new CustomEvent('citationSelected', {
            detail: {
                source: this.selectedCandidate?.title,
                authors: this.selectedCandidate?.authors,
                lines: `${selection.start}-${selection.end}`,
                text: selection.text
            }
        }));

        this.closeAllModals();
    }

    closeAllModals() {
        document.querySelectorAll('[id*="Modal"]').forEach(modal => {
            modal.style.display = 'none';
        });
        console.log('All modals closed');
    }
}

window.CitationIntegration = CitationIntegration;

document.addEventListener('DOMContentLoaded', () => {
    window.citationIntegration = new CitationIntegration();
});

