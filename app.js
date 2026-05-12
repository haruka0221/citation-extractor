/**
 * PoetryAnalysisTool - 修正版
 * 
 * 修正内容：
 * 1. pdfjsLib.renderTextLayer の存在確認を追加
 * 2. fillFromTextPair メソッドを追加
 * 3. corpus-config.js 対応の準備
 * 4. エラーハンドリング改善
 * 5. 初期化時のログ改善
 */

// ========== corpus-config.js 確認関数 ==========
function verifyCorpusConfig() {
    if (typeof window.corpusConfig === 'undefined') {
        console.warn('⚠️ corpus-config.js not loaded');
        console.warn('   Add to index.html: <script src="corpus-config.js"></script>');
        return false;
    }
    console.log('✅ corpus-config.js loaded');
    console.log('   Gutenberg enabled:', window.corpusConfig.gutenberg?.enabled);
    console.log('   Bible enabled:', window.corpusConfig.bible?.enabled);
    return true;
}

class PoetryAnalysisTool {
    constructor() {
        this.pdfDoc = null;
        this.currentPage = 1;
        this.totalPages = 0;
        this.scale = 1.2; // Use a larger default scale for better visibility
        this.pdfContainer = document.getElementById('pdfContainer');
        this.savedData = [];
        this.currentSelection = {
            target: '',
            source: ''
        };
        this.isLoading = false;
        this.selectionCount = 0; // Track alternating selections
        this.autoFillEnabled = true;
        this.scrollThrottle = null;
        this.renderedPages = new Set(); // Track which pages are rendered
        this.pageElements = new Map(); // Store page elements
        this.isDirectSaveMode = false; // Flag for direct save vs candidate selection
        this.pendingSaveData = null; // Temporary storage for direct save
        this.metadata = {
            title: '',
            author: '',
            subject: '',
            creator: '',
            producer: '',
            creationDate: null,
            modificationDate: null,
            fileName: ''
        };

        this.init();
        this.loadSavedData();
    }

    init() {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        // 修正: corpus-config を確認
        verifyCorpusConfig();

        this.bindEvents();
        this.updateStatus('Ready to upload PDF...');
    }

    bindEvents() {
        const fileInput = document.getElementById('fileInput');
        const uploadArea = document.getElementById('uploadArea');
        const prevPageBtn = document.getElementById('prevPage');
        const nextPageBtn = document.getElementById('nextPage');
        const pageInput = document.getElementById('pageInput');
        const goToPageBtn = document.getElementById('goToPage');
        const zoomInBtn = document.getElementById('zoomIn');
        const zoomOutBtn = document.getElementById('zoomOut');
        const zoomSelect = document.getElementById('zoomSelect');
        const saveDataBtn = document.getElementById('saveData');
        const clearDataBtn = document.getElementById('clearData');
        const exportJsonBtn = document.getElementById('exportJson');
        const exportCsvBtn = document.getElementById('exportCsv');
        const targetTextArea = document.getElementById('targetText');
        const sourceInfoArea = document.getElementById('sourceInfo');
        const updateMetadataBtn = document.getElementById('updateMetadata');
        const resetMetadataBtn = document.getElementById('resetMetadata');

        fileInput.addEventListener('change', (e) => {
            const fname = document.getElementById('pdfFileName');
            if (fname && e.target.files[0]) fname.textContent = e.target.files[0].name;
            this.handleFileUpload(e);
        });

        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('drag-over');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            const files = e.dataTransfer.files;
            if (files.length > 0 && files[0].type === 'application/pdf') {
                this.metadata.fileName = files[0].name;
                this.loadPDF(files[0]);
            }
        });

        prevPageBtn.addEventListener('click', () => this.previousPage());
        nextPageBtn.addEventListener('click', () => this.nextPage());
        goToPageBtn.addEventListener('click', () => this.goToPage());
        pageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.goToPage();
        });
        pageInput.addEventListener('input', () => this.validatePageInput());

        zoomInBtn.addEventListener('click', () => this.zoomIn());
        zoomOutBtn.addEventListener('click', () => this.zoomOut());
        zoomSelect.addEventListener('change', (e) => this.handleZoomSelect(e.target.value));

        saveDataBtn.addEventListener('click', () => this.saveCurrentPair());
        clearDataBtn.addEventListener('click', () => this.clearCurrentSelection());

        // Exportメインボタン → JSON（デフォルト）
        exportJsonBtn.addEventListener('click', () => this.exportAsJSON());
        exportCsvBtn.addEventListener('click', () => this.exportAsCSV());
        document.getElementById('exportMain').addEventListener('click', () => {
            StorageModal.open({
                toolName: 'chushutsu',
                data: this.savedData,
                onSaveJSON: () => this.exportAsJSON(),
                onSaveCSV:  () => this.exportAsCSV(),
                onLoad: (data) => {
                    if (data.data && Array.isArray(data.data)) {
                        this.savedData = data.data;
                        this.updateDataDisplay();
                        this.updateStatus(`${this.savedData.length}件のデータを読み込みました`);
                    }
                }
            });
        });
        document.getElementById('exportRdm').addEventListener('click', () => {
            StorageModal.open({
                toolName: 'chushutsu',
                data: this.savedData,
                onSaveJSON: () => this.exportAsJSON(),
                onSaveCSV:  () => this.exportAsCSV(),
                onLoad: (data) => {
                    if (data.data && Array.isArray(data.data)) {
                        this.savedData = data.data;
                        this.updateDataDisplay();
                        this.updateStatus(`${this.savedData.length}件のデータを読み込みました`);
                    }
                }
            });
        });

        updateMetadataBtn.addEventListener('click', () => this.updateMetadata());
        resetMetadataBtn.addEventListener('click', () => this.resetMetadata());

        targetTextArea.addEventListener('input', () => this.updateSaveButton());
        sourceInfoArea.addEventListener('input', () => this.updateSaveButton());

        // CRITICAL: Set up text selection handling
        document.addEventListener('mouseup', () => this.handleTextSelection());
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));

        // Add scroll-based page navigation
        const pdfViewer = document.getElementById('pdfViewer');
        pdfViewer.addEventListener('scroll', () => this.handleScroll());

        // Auto-fill toggle
        const autoFillToggle = document.getElementById('autoFillToggle');
        autoFillToggle.addEventListener('change', (e) => {
            this.autoFillEnabled = e.target.checked;
            this.updateTargetIndicator();
            if (this.autoFillEnabled) {
                this.updateStatus('Auto-fill enabled');
            } else {
                this.updateStatus('Auto-fill disabled - Manual input mode');
            }
        });

        // ========================================
        // 🆕 略語抽出ボタン
        // ========================================
        const extractAbbrBtn = document.getElementById('extractAbbrBtn');
        if (extractAbbrBtn) {
            extractAbbrBtn.addEventListener('click', async () => {
                if (!this.pdfDoc) {
                    alert('❌ PDFを先にアップロードしてください');
                    return;
                }

                try {
                    extractAbbrBtn.disabled = true;
                    extractAbbrBtn.textContent = '⏳ 処理中...';

                    const spinner = document.getElementById('abbrLoadingSpinner');
                    if (spinner) spinner.style.display = 'block';

                    if (!window.abbrevExtractor) {
                        window.abbrevExtractor = new AbbreviationExtractor(this.pdfDoc);
                    } else {
                        window.abbrevExtractor.pdfDoc = this.pdfDoc;
                    }

                    window.abbrevExtractor.useOpenAI = true;
                    const abbreviations = await window.abbrevExtractor.extractAbbreviations();

                    if (abbreviations && abbreviations.length > 0) {
                        const downloadContainer = document.getElementById('downloadButtonsContainer');
                        if (downloadContainer) downloadContainer.style.display = 'flex';
                    } else {
                        alert('⚠️ 略語が見つかりませんでした');
                    }

                } catch (error) {
                    console.error('❌ エラー:', error);
                    alert('❌ エラー:\n\n' + error.message);
                } finally {
                    extractAbbrBtn.disabled = false;
                    extractAbbrBtn.textContent = '🔍 Auto-Extract';
                    const spinner = document.getElementById('abbrLoadingSpinner');
                    if (spinner) spinner.style.display = 'none';
                }
            });
        }

        // ========================================
        // 🆕 テキストペア抽出ボタン
        // ========================================
        const extractTextPairsBtn = document.getElementById('extractTextPairsBtn');
        if (extractTextPairsBtn) {
            extractTextPairsBtn.addEventListener('click', async () => {
                if (!this.pdfDoc) {
                    alert('❌ PDFを先にアップロードしてください');
                    return;
                }

                try {
                    extractTextPairsBtn.disabled = true;
                    extractTextPairsBtn.textContent = '⏳ 処理中...';

                    const spinner = document.getElementById('pairsLoadingSpinner');
                    if (spinner) spinner.style.display = 'block';

                    if (!window.textPairExtractor) {
                        window.textPairExtractor = new TextPairExtractor(
                            this.pdfDoc,
                            this.currentPage,
                            this.scale
                        );
                    } else {
                        window.textPairExtractor.pdfDoc = this.pdfDoc;
                        window.textPairExtractor.currentPage = this.currentPage;
                        window.textPairExtractor.scale = this.scale;
                    }

                    await window.textPairExtractor.extractTextPairs();

                } catch (error) {
                    console.error('❌ エラー:', error);
                    alert('❌ エラー:\n\n' + error.message);
                } finally {
                    extractTextPairsBtn.disabled = false;
                    extractTextPairsBtn.textContent = '📖 Extract Text Pairs';
                    const spinner = document.getElementById('pairsLoadingSpinner');
                    if (spinner) spinner.style.display = 'none';
                }
            });
        }

        // Initialize indicator after PDF loads
        this.updateTargetIndicator();

        // Confirm & Save button in confirmation modal
        const confirmSelectionBtn = document.getElementById('confirmSelection');
        if (confirmSelectionBtn) {
            confirmSelectionBtn.addEventListener('click', () => this.confirmDirectSave());
        }

        // Cancel button in confirmation modal
        const closeConfirmationModal = document.getElementById('closeConfirmationModal');
        if (closeConfirmationModal) {
            closeConfirmationModal.addEventListener('click', () => {
                const modal = document.getElementById('confirmationModal');
                if (modal) modal.style.display = 'none';
            });
        }
        // Initialize indicator after PDF loads
        this.updateTargetIndicator();
    }

    async handleFileUpload(event) {
        const file = event.target.files[0];
        if (file && file.type === 'application/pdf') {
            this.metadata.fileName = file.name;
            await this.loadPDF(file);
        } else {
            this.updateStatus('Please select a valid PDF file.');
        }
    }

    async loadPDF(file) {
        try {
            this.updateStatus('Loading PDF...');
            this.showLoading();

            // Check file size
            if (file.size > 50 * 1024 * 1024) { // 50MB limit
                throw new Error('PDF file is too large. Please use a file smaller than 50MB.');
            }

            const arrayBuffer = await file.arrayBuffer();
            this.pdfDoc = await pdfjsLib.getDocument({
                data: arrayBuffer,
                cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
                cMapPacked: true
            }).promise;

            this.totalPages = this.pdfDoc.numPages;

            if (this.totalPages === 0) {
                throw new Error('PDF appears to be empty.');
            }

            // Extract PDF metadata
            this.updateStatus('Extracting document information...');
            await this.extractPDFMetadata();

            document.getElementById('uploadSection').style.display = 'none';
            document.getElementById('workspace').style.display = 'grid';

            // Initialize continuous display
            await this.initializeContinuousDisplay();
            this.updatePageControls();
            // Loading indicator will be hidden by renderVisiblePages()
            // this.hideLoading() is called there after all pages are rendered

        } catch (error) {
            console.error('Error loading PDF:', error);
            this.hideLoading();

            let errorMessage = 'Error loading PDF. ';
            if (error.message.includes('Invalid PDF')) {
                errorMessage += 'The file appears to be corrupted or is not a valid PDF.';
            } else if (error.message.includes('too large')) {
                errorMessage += error.message;
            } else if (error.message.includes('empty')) {
                errorMessage += 'The PDF appears to be empty.';
            } else if (error.message.includes('Worker')) {
                errorMessage += 'PDF.js worker failed to load. Check browser console.';
            } else {
                errorMessage += error.message || 'Please check the file and try again.';
            }

            this.updateStatus(errorMessage);

            // Show upload section again
            document.getElementById('uploadSection').style.display = 'block';
            document.getElementById('workspace').style.display = 'none';
        }

        //  セクション表示
        const abbreviationsSectionContainer = document.getElementById('abbreviationsSectionContainer');
        if (abbreviationsSectionContainer) {
            abbreviationsSectionContainer.style.display = 'block';
        }

        const textPairsSectionContainer = document.getElementById('textPairsSectionContainer');
        if (textPairsSectionContainer) {
            textPairsSectionContainer.style.display = 'block';
        }
    }

    async initializeContinuousDisplay() {
        // Clear previous content
        this.pdfContainer.innerHTML = '';
        this.pageElements.clear();
        this.renderedPages.clear();

        // Create placeholder containers for all pages
        for (let pageNum = 1; pageNum <= this.totalPages; pageNum++) {
            const pageWrapper = document.createElement('div');
            pageWrapper.className = 'page-wrapper';
            pageWrapper.setAttribute('data-page', pageNum);
            pageWrapper.style.position = 'relative';
            pageWrapper.style.marginBottom = '20px';
            pageWrapper.style.border = '1px solid #ccc';
            pageWrapper.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
            pageWrapper.style.backgroundColor = 'white';
            pageWrapper.style.borderRadius = '8px';
            pageWrapper.style.overflow = 'visible'; // Allow full content visibility
            pageWrapper.style.maxWidth = 'none'; // Remove width constraints
            pageWrapper.style.width = 'auto'; // Let content determine width

            const pageHeader = document.createElement('div');
            pageHeader.className = 'page-header';
            pageHeader.style.background = '#f8f9fa';
            pageHeader.style.padding = '8px 16px';
            pageHeader.style.borderBottom = '1px solid #e9ecef';
            pageHeader.style.fontSize = '14px';
            pageHeader.style.fontWeight = '600';
            pageHeader.style.color = '#6c757d';
            pageHeader.textContent = `Page ${pageNum} of ${this.totalPages}`;

            const pageContent = document.createElement('div');
            pageContent.className = 'page-content';
            pageContent.style.position = 'relative';
            pageContent.style.background = 'white';
            pageContent.style.width = 'auto'; // Let content determine width
            pageContent.style.height = 'auto'; // Let content determine height

            // Add loading placeholder
            const loadingPlaceholder = document.createElement('div');
            loadingPlaceholder.style.display = 'flex';
            loadingPlaceholder.style.alignItems = 'center';
            loadingPlaceholder.style.justifyContent = 'center';
            loadingPlaceholder.style.height = '200px';
            loadingPlaceholder.style.color = '#6c757d';
            loadingPlaceholder.style.fontSize = '14px';
            loadingPlaceholder.textContent = 'Loading page...';
            loadingPlaceholder.className = 'page-loading-placeholder';
            pageContent.appendChild(loadingPlaceholder);

            pageWrapper.appendChild(pageHeader);
            pageWrapper.appendChild(pageContent);
            this.pdfContainer.appendChild(pageWrapper);

            this.pageElements.set(pageNum, { wrapper: pageWrapper, content: pageContent });
        }

        // Render first few pages immediately
        await this.renderVisiblePages();

        // Set up intersection observer for lazy loading
        this.setupIntersectionObserver();
    }

    async renderVisiblePages() {
        // Render ALL pages immediately for full continuous display
        this.updateStatus(`Rendering all ${this.totalPages} pages...`);

        const startTime = Date.now();

        for (let pageNum = 1; pageNum <= this.totalPages; pageNum++) {
            if (!this.renderedPages.has(pageNum)) {
                await this.renderSinglePage(pageNum);

                // Update progress more frequently for user feedback
                if (pageNum % 3 === 0 || pageNum === this.totalPages) {
                    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                    this.updateStatus(`Rendered ${pageNum} of ${this.totalPages} pages (${elapsed}s)...`);
                }
            }
        }

        const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
        this.updateStatus(`✓ All ${this.totalPages} pages loaded in ${totalTime}s. Select text to begin analysis.`);
        this.hideLoading();
    }

    async renderSinglePage(pageNum) {
        if (this.renderedPages.has(pageNum) || !this.pdfDoc) return;

        try {
            const page = await this.pdfDoc.getPage(pageNum);
            // Get the full page viewport without any scaling constraints
            const naturalViewport = page.getViewport({ scale: 1.0 });
            const viewport = page.getViewport({ scale: this.scale });

            console.log(`Page ${pageNum} natural dimensions: ${naturalViewport.width} x ${naturalViewport.height}`);
            console.log(`Page ${pageNum} scaled dimensions: ${viewport.width} x ${viewport.height}`);

            const pageElements = this.pageElements.get(pageNum);
            if (!pageElements) return;

            // Create canvas for this page with natural sizing
            const canvas = document.createElement('canvas');

            // Use natural canvas dimensions based on PDF viewport
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            canvas.style.width = viewport.width + 'px';
            canvas.style.height = viewport.height + 'px';
            canvas.style.display = 'block';

            const ctx = canvas.getContext('2d');

            // Render PDF page to canvas
            await page.render({
                canvasContext: ctx,
                viewport: viewport
            }).promise;

            // Create text layer for this page - match canvas dimensions exactly
            const textLayer = document.createElement('div');
            textLayer.className = 'text-layer';
            textLayer.style.position = 'absolute';
            textLayer.style.left = '0';
            textLayer.style.top = '0';
            textLayer.style.width = viewport.width + 'px';
            textLayer.style.height = viewport.height + 'px';
            textLayer.style.userSelect = 'text';
            textLayer.style.webkitUserSelect = 'text';
            textLayer.style.mozUserSelect = 'text';
            textLayer.style.msUserSelect = 'text';
            textLayer.style.pointerEvents = 'auto';
            textLayer.style.zIndex = '2';
            textLayer.style.overflow = 'visible'; // Ensure text isn't clipped

            // Render text layer
            await this.renderTextLayerForPage(page, viewport, textLayer, pageNum);

            // Clear page content (including loading placeholder) and add rendered elements
            pageElements.content.innerHTML = '';
            pageElements.content.appendChild(canvas);
            pageElements.content.appendChild(textLayer);

            this.renderedPages.add(pageNum);

            console.log(`Page ${pageNum} rendered successfully`);

        } catch (error) {
            console.error(`Error rendering page ${pageNum}:`, error);
        }
    }

    // 修正: pdfjsLib.renderTextLayer の存在確認を追加
    async renderTextLayerForPage(page, viewport, textLayerDiv, pageNum) {
        try {
            // Get text content from PDF.js
            const textContent = await page.getTextContent();

            // 修正: pdfjsLib.renderTextLayer をチェック
            if (typeof pdfjsLib.renderTextLayer === 'function') {
                try {
                    // Use PDF.js renderTextLayer function with proper positioning
                    await pdfjsLib.renderTextLayer({
                        textContentSource: textContent,
                        container: textLayerDiv,
                        viewport: viewport,
                        textDivs: [],
                        isOffscreenCanvasSupported: true
                    }).promise;

                    console.log(`Text layer for page ${pageNum} rendered successfully`);
                    return;
                } catch (innerError) {
                    console.warn(`pdfjsLib.renderTextLayer failed: ${innerError.message}`);
                    // Fall through to fallback
                }
            } else {
                console.warn('⚠️ pdfjsLib.renderTextLayer not available. Using fallback.');
            }

            // Fallback to custom text overlay
            await this.createSelectableTextOverlayForPage(page, viewport, textLayerDiv, pageNum);

        } catch (error) {
            console.error(`Error rendering text layer for page ${pageNum}:`, error);
            // Final fallback
            await this.createSelectableTextOverlayForPage(page, viewport, textLayerDiv, pageNum);
        }
    }

    async createSelectableTextOverlayForPage(page, viewport, textLayerDiv, pageNum) {
        try {
            const textContent = await page.getTextContent();
            const textItems = textContent.items;

            // Build text with proper positioning
            let fullText = '';
            let lastY = null;

            textItems.forEach((item, index) => {
                const transform = item.transform;
                const y = transform[5];

                // Add line break for new lines
                if (lastY !== null && Math.abs(y - lastY) > 10) {
                    fullText += '\n';
                }

                fullText += item.str;

                // Add space between words on same line
                if (index < textItems.length - 1) {
                    const nextItem = textItems[index + 1];
                    const nextY = nextItem.transform[5];
                    if (Math.abs(nextY - y) < 5) {
                        fullText += ' ';
                    }
                }

                lastY = y;
            });

            // Create fallback selectable overlay
            const overlay = document.createElement('div');
            overlay.style.position = 'absolute';
            overlay.style.left = '0px';
            overlay.style.top = '0px';
            overlay.style.width = '100%';
            overlay.style.height = '100%';
            overlay.style.color = 'transparent';
            overlay.style.backgroundColor = 'rgba(255, 255, 0, 0.02)';
            overlay.style.fontSize = Math.round(12 * this.scale) + 'px';
            overlay.style.lineHeight = '1.4';
            overlay.style.padding = '10px';
            overlay.style.fontFamily = 'Arial, sans-serif';
            overlay.style.whiteSpace = 'pre-wrap';
            overlay.style.cursor = 'text';
            overlay.style.userSelect = 'text';
            overlay.style.webkitUserSelect = 'text';
            overlay.style.mozUserSelect = 'text';
            overlay.style.msUserSelect = 'text';
            overlay.style.zIndex = '20';
            overlay.style.pointerEvents = 'auto';
            overlay.setAttribute('data-page', pageNum);

            overlay.textContent = fullText;
            textLayerDiv.appendChild(overlay);

            console.log(`Fallback text overlay created for page ${pageNum}`);

        } catch (error) {
            console.error(`Error creating text overlay for page ${pageNum}:`, error);
        }
    }

    setupIntersectionObserver() {
        // Observer for tracking current page (no lazy loading needed)
        const visibilityObserver = new IntersectionObserver((entries) => {
            let mostVisiblePage = null;
            let maxRatio = 0;

            entries.forEach(entry => {
                if (entry.isIntersecting && entry.intersectionRatio > maxRatio) {
                    maxRatio = entry.intersectionRatio;
                    mostVisiblePage = parseInt(entry.target.getAttribute('data-page'));
                }
            });

            if (mostVisiblePage && mostVisiblePage !== this.currentPage) {
                this.currentPage = mostVisiblePage;
                this.updatePageControls();
            }
        }, {
            root: document.getElementById('pdfViewer'),
            rootMargin: '0px 0px',
            threshold: [0.1, 0.5, 0.9]
        });

        // Observe all page wrappers for current page tracking
        this.pageElements.forEach((elements, pageNum) => {
            visibilityObserver.observe(elements.wrapper);
        });
    }

    createSimpleFallback() {
        const fallback = document.createElement('div');
        fallback.style.position = 'absolute';
        fallback.style.left = '20px';
        fallback.style.top = '20px';
        fallback.style.width = 'calc(100% - 40px)';
        fallback.style.height = 'calc(100% - 40px)';
        fallback.style.color = 'rgba(0, 0, 0, 0.5)';
        fallback.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
        fallback.style.fontSize = '16px';
        fallback.style.lineHeight = '1.6';
        fallback.style.padding = '20px';
        fallback.style.fontFamily = 'Arial, sans-serif';
        fallback.style.cursor = 'text';
        fallback.style.userSelect = 'text';
        fallback.style.webkitUserSelect = 'text';
        fallback.style.zIndex = '25';
        fallback.style.border = '2px dashed #ccc';
        fallback.style.borderRadius = '8px';

        fallback.textContent = `SELECTABLE TEXT AREA

This is a test text overlay. You should be able to:
1. Click and drag to select this text
2. Selected text will appear in the input fields below
3. First selection goes to "Target Text"
4. Second selection goes to "Source Text"

Try selecting this text now! If you can select this text, the system is working.

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.

This text should be fully selectable. Try highlighting different portions to test the alternating field population feature.`;

        this.textLayerDiv.appendChild(fallback);
        console.log('Simple fallback text layer created');
    }

    createFallbackTextLayer() {
        const textDiv = document.createElement('div');
        textDiv.style.position = 'absolute';
        textDiv.style.left = '0px';
        textDiv.style.top = '0px';
        textDiv.style.width = '100%';
        textDiv.style.height = '100%';
        textDiv.style.color = 'transparent';
        textDiv.style.cursor = 'text';
        textDiv.style.fontSize = '12px';
        textDiv.style.padding = '20px';
        textDiv.style.userSelect = 'text';
        textDiv.style.webkitUserSelect = 'text';
        textDiv.style.zIndex = '5';
        textDiv.textContent = 'PDF text content - select any text to extract';

        this.textLayerDiv.appendChild(textDiv);
    }

    handleTextSelection() {
        // Check if auto-fill is enabled
        if (!this.autoFillEnabled) return;

        setTimeout(() => {
            const selection = window.getSelection();

            if (selection.rangeCount > 0) {
                const selectedText = selection.toString().trim();

                if (selectedText.length > 2) {
                    this.processSelectedTextAlternating(selectedText);
                    this.showSelectionFeedback(selection);

                    setTimeout(() => {
                        selection.removeAllRanges();
                    }, 1500);
                }
            }
        }, 150);
    }

    showSelectionFeedback(selection) {
        try {
            // Create a temporary highlight overlay
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            const pdfContainer = document.getElementById('pdfContainer');
            const containerRect = pdfContainer.getBoundingClientRect();

            const highlight = document.createElement('div');
            highlight.style.position = 'absolute';
            highlight.style.left = (rect.left - containerRect.left) + 'px';
            highlight.style.top = (rect.top - containerRect.top) + 'px';
            highlight.style.width = rect.width + 'px';
            highlight.style.height = rect.height + 'px';
            highlight.style.backgroundColor = 'rgba(255, 255, 0, 0.4)';
            highlight.style.pointerEvents = 'none';
            highlight.style.zIndex = '10';
            highlight.style.border = '1px solid #ffa500';
            highlight.className = 'selection-highlight';

            pdfContainer.appendChild(highlight);

            // Remove highlight after delay
            setTimeout(() => {
                if (highlight.parentNode) {
                    highlight.parentNode.removeChild(highlight);
                }
            }, 2000);

        } catch (e) {
            console.log('Could not create selection highlight:', e);
        }
    }

    processSelectedTextAlternating(text) {
        const targetTextArea = document.getElementById('targetText');
        const sourceInfoArea = document.getElementById('sourceInfo');
        const targetTextGroup = document.getElementById('targetTextGroup');
        const sourceInfoGroup = document.getElementById('sourceInfoGroup');

        // Remove previous states
        targetTextGroup.classList.remove('next-target', 'completed');
        sourceInfoGroup.classList.remove('next-target', 'completed');

        if (this.selectionCount % 2 === 0) {
            // Even count: goes to target field
            targetTextArea.value = text;
            this.currentSelection.target = text;
            targetTextGroup.classList.add('completed');
            this.updateStatus(`✓ Target text captured! Next → Source Info`);
        } else {
            // Odd count: goes to source field
            sourceInfoArea.value = text;
            this.currentSelection.source = text;
            sourceInfoGroup.classList.add('completed');
            targetTextGroup.classList.add('completed');
            this.updateStatus(`✓ Source info captured! Ready to save or select new target`);


        }

        this.selectionCount++;
        this.updateSaveButton();
        this.updateTargetIndicator();
    }

    updatePageControls() {
        const pageInput = document.getElementById('pageInput');
        const totalPagesSpan = document.getElementById('totalPages');
        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');
        const zoomSelect = document.getElementById('zoomSelect');

        pageInput.value = this.currentPage;
        pageInput.max = this.totalPages;
        totalPagesSpan.textContent = this.totalPages;
        prevBtn.disabled = this.currentPage <= 1;
        nextBtn.disabled = this.currentPage >= this.totalPages;

        // Update zoom dropdown
        const currentZoom = Math.round(this.scale * 100);
        const zoomOption = zoomSelect.querySelector(`option[value="${currentZoom}"]`);
        if (zoomOption) {
            zoomSelect.value = currentZoom.toString();
        } else {
            // Custom zoom level, add it temporarily
            const customOption = document.createElement('option');
            customOption.value = currentZoom;
            customOption.textContent = `${currentZoom}%`;
            customOption.selected = true;
            zoomSelect.insertBefore(customOption, zoomSelect.firstChild);
        }
    }

    async previousPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.scrollToPage(this.currentPage);
            this.updatePageControls();
        }
    }

    async nextPage() {
        if (this.currentPage < this.totalPages) {
            this.currentPage++;
            this.scrollToPage(this.currentPage);
            this.updatePageControls();
        }
    }

    async goToPage() {
        const pageInput = document.getElementById('pageInput');
        const targetPage = parseInt(pageInput.value);

        if (isNaN(targetPage)) {
            this.updateStatus('Please enter a valid page number');
            pageInput.value = this.currentPage;
            return;
        }

        if (targetPage >= 1 && targetPage <= this.totalPages) {
            try {
                this.currentPage = targetPage;
                this.scrollToPage(targetPage);
                this.updatePageControls();
                this.updateStatus(`Navigated to page ${targetPage}`);
            } catch (error) {
                console.error('Error navigating to page:', error);
                this.updateStatus(`Error navigating to page ${targetPage}. Please try again.`);
                pageInput.value = this.currentPage;
            }
        } else {
            this.updateStatus(`Invalid page number. Please enter 1-${this.totalPages}`);
            pageInput.value = this.currentPage;
        }
    }

    scrollToPage(pageNum) {
        const pageElements = this.pageElements.get(pageNum);
        if (pageElements) {
            pageElements.wrapper.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });

            // Ensure the page is rendered
            if (!this.renderedPages.has(pageNum)) {
                this.renderSinglePage(pageNum);
            }
        }
    }

    validatePageInput() {
        const pageInput = document.getElementById('pageInput');
        const value = parseInt(pageInput.value);

        if (isNaN(value) || value < 1) {
            pageInput.value = 1;
        } else if (value > this.totalPages) {
            pageInput.value = this.totalPages;
        }
    }

    async zoomIn() {
        if (this.scale < 3.0 && !this.isLoading) {
            const oldScale = this.scale;
            this.scale = Math.min(3.0, this.scale + 0.25);

            if (oldScale !== this.scale) {
                await this.reRenderAllPages();
                this.updatePageControls();
                this.updateStatus(`Zoomed in to ${Math.round(this.scale * 100)}%`);
            }
        }
    }

    async zoomOut() {
        if (this.scale > 0.5 && !this.isLoading) {
            const oldScale = this.scale;
            this.scale = Math.max(0.5, this.scale - 0.25);

            if (oldScale !== this.scale) {
                await this.reRenderAllPages();
                this.updatePageControls();
                this.updateStatus(`Zoomed out to ${Math.round(this.scale * 100)}%`);
            }
        }
    }

    async setZoomLevel(percentage) {
        const newScale = percentage / 100;
        if (newScale >= 0.5 && newScale <= 3.0 && !this.isLoading) {
            this.scale = newScale;
            await this.reRenderAllPages();
            this.updatePageControls();
            this.updateStatus(`Zoom set to ${percentage}%`);
        }
    }

    async reRenderAllPages() {
        // Clear all rendered pages and re-render visible ones
        this.renderedPages.clear();

        // Properly clean up all page contents
        this.pageElements.forEach((elements, pageNum) => {
            elements.content.innerHTML = '';
        });

        // Re-render visible pages
        await this.renderVisiblePages();
    }

    async handleZoomSelect(value) {
        if (this.isLoading) return;

        if (value === 'fit-width') {
            await this.fitWidth();
        } else {
            const percentage = parseInt(value);
            await this.setZoomLevel(percentage);
        }
    }

    async fitWidth() {
        if (!this.pdfDoc || this.isLoading) return;

        try {
            const page = await this.pdfDoc.getPage(this.currentPage);
            const viewport = page.getViewport({ scale: 1.0 });
            const pdfViewer = document.getElementById('pdfViewer');
            const containerWidth = pdfViewer.clientWidth - 32;

            this.scale = containerWidth / viewport.width;
            await this.renderPage();
            this.updatePageControls();
        } catch (error) {
            console.error('Error fitting width:', error);
        }
    }

    updateSaveButton() {
        const saveBtn = document.getElementById('saveData');
        const targetText = document.getElementById('targetText').value.trim();
        const sourceInfo = document.getElementById('sourceInfo').value.trim();

        saveBtn.disabled = !targetText || !sourceInfo;
    }

    saveCurrentPair() {
        const targetText = document.getElementById('targetText').value.trim();
        const sourceInfo = document.getElementById('sourceInfo').value.trim();

        if (targetText && sourceInfo) {
            // Show confirmation modal with rating for direct save
            this.showDirectSaveConfirmation(targetText, sourceInfo);
        }
    }

    /**
     * Show confirmation modal for direct save (without candidate selection)
     */
    showDirectSaveConfirmation(targetText, sourceInfo) {
        // Store data temporarily
        this.pendingSaveData = {
            targetText: targetText,
            sourceInfo: sourceInfo,
            page: this.currentPage
        };

        // Populate confirmation dialog
        const selectedSourcePreview = document.getElementById('selectedSourcePreview');
        const targetTextPreview = document.getElementById('targetTextPreview');

        if (selectedSourcePreview) {
            selectedSourcePreview.innerHTML = `
                <strong>Direct Input (Manual Entry)</strong><br>
                ${sourceInfo.substring(0, 200)}${sourceInfo.length > 200 ? '...' : ''}
            `;
        }

        if (targetTextPreview) {
            targetTextPreview.textContent = targetText.substring(0, 200) + (targetText.length > 200 ? '...' : '');
        }

        // Reset rating selection
        const ratingInputs = document.querySelectorAll('input[name="influenceRating"]');
        ratingInputs.forEach(input => input.checked = false);

        // Hide validation message
        const validation = document.getElementById('ratingValidation');
        if (validation) {
            validation.style.display = 'none';
        }

        // Hide rating guide
        const ratingGuide = document.getElementById('ratingGuide');
        if (ratingGuide) {
            ratingGuide.style.display = 'none';
        }

        // Reset guide button text
        const showRatingGuideBtn = document.getElementById('showRatingGuide');
        if (showRatingGuideBtn) {
            showRatingGuideBtn.textContent = 'ℹ️ Guide';
        }

        // Show confirmation modal
        const confirmationModal = document.getElementById('confirmationModal');
        if (confirmationModal) {
            confirmationModal.style.display = 'flex';
        }

        // Mark this as direct save mode
        this.isDirectSaveMode = true;
    }

    /**
     * Confirm and save with rating (called from modal)
     */
    confirmDirectSave() {
        // Get influence rating
        const ratingInput = document.querySelector('input[name="influenceRating"]:checked');
        const influenceRating = ratingInput ? parseInt(ratingInput.value) : null;

        // Validate rating
        if (!influenceRating) {
            const validation = document.getElementById('ratingValidation');
            if (validation) {
                validation.style.display = 'block';
            }
            return;
        }

        // Create data pair with rating
        const dataPair = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            page: this.pendingSaveData.page,
            targetText: this.pendingSaveData.targetText,
            sourceInfo: this.pendingSaveData.sourceInfo,
            influenceRating: influenceRating
        };

        this.savedData.push(dataPair);
        this.saveToStorage();
        this.updateDataDisplay();

        // Close modal
        const confirmationModal = document.getElementById('confirmationModal');
        if (confirmationModal) {
            confirmationModal.style.display = 'none';
        }

        this.clearCurrentSelection();
        this.updateStatus(`Data pair saved with rating ${influenceRating}/5!`);

        // Clear temporary data
        this.pendingSaveData = null;
        this.isDirectSaveMode = false;
    }

    clearCurrentSelection() {
        document.getElementById('targetText').value = '';
        document.getElementById('sourceInfo').value = '';
        this.currentSelection = { target: '', source: '' };
        this.selectionCount = 0;

        // Remove highlights
        document.querySelectorAll('.selection-highlight').forEach(el => el.remove());

        // Reset visual states
        const targetTextGroup = document.getElementById('targetTextGroup');
        const sourceInfoGroup = document.getElementById('sourceInfoGroup');
        targetTextGroup.classList.remove('next-target', 'completed');
        sourceInfoGroup.classList.remove('next-target', 'completed');

        this.updateSaveButton();
        this.updateTargetIndicator();
        this.updateStatus('Cleared. Next → Target Text');
    }

    updateTargetIndicator() {
        const indicator = document.getElementById('currentTargetIndicator');
        const nextFieldName = document.getElementById('nextFieldName');
        const targetTextGroup = document.getElementById('targetTextGroup');
        const sourceInfoGroup = document.getElementById('sourceInfoGroup');

        if (!indicator || !nextFieldName) return;

        // Handle disabled state
        if (!this.autoFillEnabled) {
            indicator.classList.add('disabled');
            nextFieldName.textContent = 'Manual Mode';
            targetTextGroup.classList.remove('next-target');
            sourceInfoGroup.classList.remove('next-target');
            return;
        }

        indicator.classList.remove('disabled');

        // Determine next target
        if (this.selectionCount % 2 === 0) {
            nextFieldName.textContent = 'Target Text';
            if (!targetTextGroup.classList.contains('completed')) {
                targetTextGroup.classList.add('next-target');
            }
            sourceInfoGroup.classList.remove('next-target');
        } else {
            nextFieldName.textContent = 'Source Info';
            targetTextGroup.classList.remove('next-target');
            if (!sourceInfoGroup.classList.contains('completed')) {
                sourceInfoGroup.classList.add('next-target');
            }
        }
    }

    updateDataDisplay() {
        const container = document.getElementById('savedData');
        const countElement = document.querySelector('.data-count');

        countElement.textContent = `${this.savedData.length} pairs saved`;

        container.innerHTML = '';

        this.savedData.slice().reverse().forEach((item) => {
            const itemElement = document.createElement('div');
            itemElement.className = 'data-item';

            // Rating display
            let ratingHTML = '';
            if (item.influenceRating) {
                const ratingLabels = {
                    5: 'Strong influence',
                    4: 'Moderate influence',
                    3: 'Some influence',
                    2: 'Different passage',
                    1: 'Similar author'
                };
                const ratingLabel = ratingLabels[item.influenceRating] || 'Unknown';
                const stars = '⭐'.repeat(item.influenceRating);
                ratingHTML = `<div class="rating-display">${stars} ${item.influenceRating}/5 - ${ratingLabel}</div>`;
            }

            itemElement.innerHTML = `
                <div class="data-item-header">
                    <span class="data-item-id">ID: ${item.id} | Page: ${item.page}</span>
                    <button class="delete-btn" onclick="app.deleteDataItem(${item.id})">Delete</button>
                </div>
                <div class="data-item-content">
                    ${ratingHTML}
                    <div class="target-text">${this.truncateText(item.targetText, 100)}</div>
                    <div class="source-info">${this.truncateText(item.sourceInfo, 80)}</div>
                </div>
            `;
            container.appendChild(itemElement);
        });
    }

    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    deleteDataItem(id) {
        this.savedData = this.savedData.filter(item => item.id !== id);
        this.saveToStorage();
        this.updateDataDisplay();
        this.updateStatus('Data pair deleted.');
    }

    saveToStorage() {
        try {
            localStorage.setItem('poetryAnalysisData', JSON.stringify(this.savedData));
        } catch (error) {
            console.error('Error saving to localStorage:', error);
            this.updateStatus('Warning: Could not save data to local storage.');
        }
    }

    loadSavedData() {
        try {
            const saved = localStorage.getItem('poetryAnalysisData');
            if (saved) {
                this.savedData = JSON.parse(saved);
                this.updateDataDisplay();
            }
        } catch (error) {
            console.error('Error loading saved data:', error);
            this.savedData = [];
        }
    }

    async exportToRdm() {
        if (this.savedData.length === 0) {
            this.updateStatus('保存するデータがありません。');
            return;
        }

        // ログイン確認
        let statusRes;
        try {
            statusRes = await fetch('/session/status', { credentials: 'include' });
        } catch(e) {
            alert('セッションAPIに接続できません。');
            return;
        }
        const status = await statusRes.json();
        if (!status.logged_in) {
            if (confirm('GakuninRDMへの保存にはログインが必要です。ログインページに移動しますか？')) {
                // 先にデータをセッションに保存してからログインへ
                const preData = {
                    metadata: { exportDate: new Date().toISOString(), totalPairs: this.savedData.length },
                    data: this.savedData
                };
                await this.saveToSession(preData);
                // ログイン後にこのページ+自動アップロードフラグで戻る
                const next = encodeURIComponent(location.pathname + '?rdm_auto_upload=chushutsu');
                window.location.href = '/auth/rdm/login?redirect_to=' + next;
            }
            return;
        }

        // プロジェクト一覧を取得
        let projects;
        try {
            const projRes = await fetch('/session/rdm/projects', { credentials: 'include' });
            projects = await projRes.json();
        } catch(e) {
            alert('プロジェクト一覧の取得に失敗しました。');
            return;
        }

        if (!projects.length) {
            alert('GakuninRDMにプロジェクトが見つかりません。');
            return;
        }

        // プロジェクト選択ダイアログ
        const options = projects.map((p, i) => `${i + 1}. ${p.title}`).join('\n');
        const answer = prompt(`保存先プロジェクトを番号で選んでください:\n\n${options}`);
        if (!answer) return;
        const idx = parseInt(answer) - 1;
        if (idx < 0 || idx >= projects.length) {
            alert('正しい番号を入力してください。');
            return;
        }
        const project = projects[idx];

        // まずセッションに保存してからアップロード
        const exportData = {
            metadata: { exportDate: new Date().toISOString(), totalPairs: this.savedData.length },
            data: this.savedData
        };
        await this.saveToSession(exportData);

        // RDMにアップロード
        this.updateStatus('GakuninRDMにアップロード中...');
        try {
            const res = await fetch('/session/rdm/upload/chushutsu', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ project_id: project.id })
            });
            const result = await res.json();
            if (result.status === 'uploaded') {
                this.updateStatus(`✅ GakuninRDMに保存しました: ${result.filename}`);
                alert(`GakuninRDM「${project.title}」に保存しました。\nファイル名: ${result.filename}`);
            } else {
                this.updateStatus('❌ アップロードに失敗しました。');
                alert('アップロードに失敗しました: ' + JSON.stringify(result));
            }
        } catch(e) {
            this.updateStatus('❌ アップロードエラー。');
            alert('エラー: ' + e.message);
        }
    }

    exportAsJSON() {
        if (this.savedData.length === 0) {
            this.updateStatus('No data to export.');
            return;
        }

        const exportData = {
            metadata: {
                exportDate: new Date().toISOString(),
                totalPairs: this.savedData.length,
                version: '1.0'
            },
            document: {
                title: this.metadata.title,
                author: this.metadata.author,
                subject: this.metadata.subject,
                year: this.metadata.year,
                fileName: this.metadata.fileName
            },
            data: this.savedData
        };

        this.downloadFile(
            JSON.stringify(exportData, null, 2),
            'poetry-analysis-data.json',
            'application/json'
        );
        this.saveToSession(exportData);

        this.updateStatus('Data exported as JSON.');
    }

    exportAsCSV() {
        if (this.savedData.length === 0) {
            this.updateStatus('No data to export.');
            return;
        }

        const headers = ['Document Title', 'Author', 'Year', 'ID', 'Timestamp', 'Page', 'Target Text', 'Source Info'];
        const csvContent = [
            headers.join(','),
            ...this.savedData.map(item => [
                `"${(this.metadata.title || '').replace(/"/g, '""')}"`,
                `"${(this.metadata.author || '').replace(/"/g, '""')}"`,
                this.metadata.year || '',
                item.id,
                item.timestamp,
                item.page,
                `"${item.targetText.replace(/"/g, '""')}"`,
                `"${item.sourceInfo.replace(/"/g, '""')}"`
            ].join(','))
        ].join('\n');

        this.downloadFile(csvContent, 'poetry-analysis-data.csv', 'text/csv');
        this.saveToSession({ metadata: exportData, csvContent });
        this.updateStatus('Data exported as CSV.');
    }

async saveToSession(data) {
        try {
            await fetch('/session/save/chushutsu', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data })
            });
            console.log('セッションに保存しました');
        } catch (e) {
            console.warn('セッション保存失敗（オフラインでも動作継続）:', e);
        }
    }


    downloadFile(content, filename, contentType) {
        const blob = new Blob([content], { type: contentType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    handleScroll() {
        // Scroll handling is now managed by intersection observers
        // This method is kept for compatibility with existing event listeners
        return;
    }

    handleKeyboard(event) {
        if (!this.pdfDoc) return;

        const activeElement = document.activeElement;
        if (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT') {
            return;
        }

        switch (event.key) {
            case 'ArrowLeft':
                event.preventDefault();
                this.previousPage();
                break;
            case 'ArrowRight':
                event.preventDefault();
                this.nextPage();
                break;
            case '+':
            case '=':
                if (event.ctrlKey || event.metaKey) {
                    event.preventDefault();
                    this.zoomIn();
                }
                break;
            case '-':
                if (event.ctrlKey || event.metaKey) {
                    event.preventDefault();
                    this.zoomOut();
                }
                break;
            case '0':
                if (event.ctrlKey || event.metaKey) {
                    event.preventDefault();
                    this.fitWidth();
                }
                break;
            case 'PageUp':
                event.preventDefault();
                this.previousPage();
                break;
            case 'PageDown':
                event.preventDefault();
                this.nextPage();
                break;
            case 's':
                if (event.ctrlKey || event.metaKey) {
                    event.preventDefault();
                    if (!document.getElementById('saveData').disabled) {
                        this.saveCurrentPair();
                    }
                }
                break;
            case 'c':
                if (event.ctrlKey || event.metaKey) {
                    return; // Allow normal copy
                }
                if (!event.shiftKey) {
                    this.clearCurrentSelection();
                }
                break;
        }
    }

    showLoading() {
        const loadingIndicator = document.getElementById('loadingIndicator');
        loadingIndicator.style.display = 'flex';
    }

    hideLoading() {
        const loadingIndicator = document.getElementById('loadingIndicator');
        loadingIndicator.style.display = 'none';
    }

    async extractPDFMetadata() {
        try {
            // Get PDF metadata
            const metadata = await this.pdfDoc.getMetadata();

            if (metadata.info) {
                this.metadata.title = metadata.info.Title || '';
                this.metadata.author = metadata.info.Author || '';
                this.metadata.subject = metadata.info.Subject || '';
                this.metadata.creator = metadata.info.Creator || '';
                this.metadata.producer = metadata.info.Producer || '';
                this.metadata.creationDate = metadata.info.CreationDate || null;
                this.metadata.modificationDate = metadata.info.ModDate || null;
            }

            // If no title in metadata, try to extract from first page
            if (!this.metadata.title || this.metadata.title.trim() === '') {
                await this.extractTitleFromFirstPage();
            }

            // If still no title, use filename
            if (!this.metadata.title || this.metadata.title.trim() === '') {
                this.metadata.title = this.metadata.fileName.replace('.pdf', '').replace(/[-_]/g, ' ');
            }

            // Display metadata panel and populate fields
            this.displayMetadata();

            console.log('Extracted metadata:', this.metadata);

        } catch (error) {
            console.error('Error extracting metadata:', error);
            this.updateStatus('Could not extract PDF metadata.');
        }
    }

    async extractTitleFromFirstPage() {
        try {
            if (this.totalPages > 0) {
                const page = await this.pdfDoc.getPage(1);
                const textContent = await page.getTextContent();
                const textItems = textContent.items;

                // Look for title-like text (usually larger font, at top of page)
                let potentialTitles = [];

                textItems.forEach((item, index) => {
                    const text = item.str.trim();
                    const transform = item.transform;
                    const fontSize = Math.abs(transform[0]); // Font size
                    const y = transform[5]; // Y position

                    // Look for text that might be a title
                    if (text.length > 5 && fontSize > 12 && y > (page.getViewport({ scale: 1.0 }).height * 0.7)) {
                        potentialTitles.push({
                            text: text,
                            fontSize: fontSize,
                            y: y,
                            index: index
                        });
                    }
                });

                // Sort by font size (descending) and y position (descending - higher on page)
                potentialTitles.sort((a, b) => b.fontSize - a.fontSize || b.y - a.y);

                // Take the first few lines and combine them as potential title
                if (potentialTitles.length > 0) {
                    let titleText = potentialTitles[0].text;

                    // Check if next line might be part of title (similar font size, nearby)
                    for (let i = 1; i < Math.min(3, potentialTitles.length); i++) {
                        const current = potentialTitles[i];
                        const previous = potentialTitles[i - 1];

                        if (Math.abs(current.fontSize - previous.fontSize) < 2 &&
                            Math.abs(current.y - previous.y) < 30) {
                            titleText += ' ' + current.text;
                        } else {
                            break;
                        }
                    }

                    this.metadata.title = titleText;
                    console.log('Extracted title from first page:', titleText);
                }
            }
        } catch (error) {
            console.error('Error extracting title from first page:', error);
        }
    }

    displayMetadata() {
        // Show metadata panel
        document.getElementById('metadataPanel').style.display = 'block';

        // Populate fields
        document.getElementById('bookTitle').value = this.metadata.title || '';
        document.getElementById('bookAuthor').value = this.metadata.author || '';
        document.getElementById('bookSubject').value = this.metadata.subject || '';

        // Extract year from creation date if available
        if (this.metadata.creationDate) {
            try {
                const year = new Date(this.metadata.creationDate).getFullYear();
                if (year > 1900 && year <= new Date().getFullYear()) {
                    document.getElementById('bookYear').value = year;
                }
            } catch (e) {
                // Ignore date parsing errors
            }
        }

        this.updateStatus('✓ PDF metadata extracted and displayed');
    }

    updateMetadata() {
        // Update metadata from form fields
        this.metadata.title = document.getElementById('bookTitle').value.trim();
        this.metadata.author = document.getElementById('bookAuthor').value.trim();
        this.metadata.subject = document.getElementById('bookSubject').value.trim();

        const year = document.getElementById('bookYear').value;
        if (year) {
            this.metadata.year = parseInt(year);
        }

        this.updateStatus('✓ Document information updated');
        console.log('Updated metadata:', this.metadata);
    }

    resetMetadata() {
        // Reset to original extracted values
        this.displayMetadata();
        this.updateStatus('Document information reset to detected values');
    }

    /**
 * 略語テーブルから Source Info を入力
 */
    fillSourceInfoFromAbbr(abbr, full) {
        const sourceInfoArea = document.getElementById('sourceInfo');
        if (sourceInfoArea) {
            const currentContent = sourceInfoArea.value.trim();

            if (currentContent) {
                sourceInfoArea.value = `${full} (${abbr})\n${currentContent}`;
            } else {
                sourceInfoArea.value = `${full}\n`;
            }

            sourceInfoArea.focus();
            console.log('✅ Source Info に自動入力:', full);
            sourceInfoArea.dispatchEvent(new Event('input'));
        }
    }

    /**
     * 修正: テキストペア抽出表から自動入力するメソッド
     * @param {string} targetText - ターゲットテキスト
     * @param {string} sourceText - ソーステキスト
     */
    fillFromTextPair(targetText, sourceText) {
        console.log('🔄 fillFromTextPair() called');

        const targetArea = document.getElementById('targetText');
        const sourceArea = document.getElementById('sourceInfo');

        if (targetArea) {
            targetArea.value = targetText;
            this.currentSelection.target = targetText;

            const targetTextGroup = document.getElementById('targetTextGroup');
            if (targetTextGroup) {
                targetTextGroup.classList.remove('next-target');
                targetTextGroup.classList.add('completed');
            }

            console.log('✅ Target text filled');
        }

        setTimeout(() => {
            if (sourceArea) {
                sourceArea.value = sourceText;
                this.currentSelection.source = sourceText;

                const sourceInfoGroup = document.getElementById('sourceInfoGroup');
                if (sourceInfoGroup) {
                    sourceInfoGroup.classList.add('completed');
                }

                console.log('✅ Source text filled');
                sourceArea.dispatchEvent(new Event('input'));
            }
        }, 200);

        this.updateSaveButton();
    }

    updateStatus(message) {
        const statusBar = document.getElementById('statusBar');
        statusBar.textContent = message;

        setTimeout(() => {
            if (statusBar.textContent === message) {
                statusBar.textContent = 'Ready - Select text from PDF to continue';
            }
        }, 5000);
    }
}

let app;

document.addEventListener('DOMContentLoaded', () => {
    // 修正: corpus-config を確認
    verifyCorpusConfig();

    app = new PoetryAnalysisTool();
    // Make app globally available for citation integration
    window.poetryApp = app;
    window.app = app;  // 追加: window.app を設定

    // ログイン後にPDFピッカーを自動オープン
    const urlParamsAll = new URLSearchParams(window.location.search);
    const pdfSource = urlParamsAll.get('pdf_source');
    if (pdfSource) {
        history.replaceState({}, '', location.pathname);
        setTimeout(function() {
            openPdfFromCloud(pdfSource);
        }, 500);
    }

    // ストレージモーダル自動オープン（RDM/Google Drive接続後に戻ったとき）
    if (urlParamsAll.get('storage_modal') === '1') {
        history.replaceState({}, '', location.pathname);
        setTimeout(function() {
            const saved = localStorage.getItem('poetryAnalysisData');
            if (saved && window.app) {
                try {
                    const parsed = JSON.parse(saved);
                    if (parsed.length > 0 && window.app.savedData.length === 0) {
                        window.app.savedData = parsed;
                        window.app.updateDataDisplay();
                    }
                } catch(e) {}
            }
            StorageModal.open({
                toolName: 'chushutsu',
                data: window.app ? window.app.savedData : [],
                onSaveJSON: () => window.app && window.app.exportAsJSON(),
                onSaveCSV:  () => window.app && window.app.exportAsCSV(),
                onLoad: (data) => {
                    if (data.data && Array.isArray(data.data) && window.app) {
                        window.app.savedData = data.data;
                        window.app.updateDataDisplay();
                        window.app.updateStatus(data.data.length + '件のデータを読み込みました');
                    }
                }
            });
        }, 800);
    }

    // ログイン後の自動アップロード検知（インスタンス生成後に実行）
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('rdm_auto_upload') && urlParams.get('rdm_login') === 'success') {
        history.replaceState({}, '', location.pathname);
        setTimeout(async function() {
            // セッションからデータ復元
            try {
                const loadRes = await fetch('/session/load/chushutsu', { credentials: 'include' });
                if (loadRes.ok) {
                    const sessionData = await loadRes.json();
                    if (sessionData.data && Array.isArray(sessionData.data) && sessionData.data.length > 0) {
                        window.app.savedData = sessionData.data;
                        window.app.updateDataDisplay();
                    }
                }
            } catch(e) {
                console.warn('セッションデータの復元に失敗:', e);
            }

            if (window.app.savedData.length === 0) {
                alert('保存するデータがありません。');
                return;
            }

            // プロジェクト一覧取得（ログインチェックなしで直接実行）
            let projects;
            try {
                const projRes = await fetch('/session/rdm/projects', { credentials: 'include' });
                if (!projRes.ok) {
                    alert('プロジェクト一覧の取得に失敗しました。再度ログインしてください。');
                    return;
                }
                projects = await projRes.json();
            } catch(e) {
                alert('プロジェクト一覧の取得に失敗しました: ' + e.message);
                return;
            }

            if (!projects.length) {
                alert('GakuninRDMにプロジェクトが見つかりません。');
                return;
            }

            const options = projects.map((p, i) => (i + 1) + '. ' + p.title).join('\n');
            const answer = prompt('保存先プロジェクトを番号で選んでください:\n\n' + options);
            if (!answer) return;
            const idx = parseInt(answer) - 1;
            if (idx < 0 || idx >= projects.length) {
                alert('正しい番号を入力してください。');
                return;
            }
            const project = projects[idx];

            // アップロード
            window.app.updateStatus('GakuninRDMにアップロード中...');
            try {
                const res = await fetch('/session/rdm/upload/chushutsu', {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ project_id: project.id })
                });
                const result = await res.json();
                if (result.status === 'uploaded') {
                    window.app.updateStatus('✅ GakuninRDMに保存しました: ' + result.filename);
                    alert('GakuninRDM「' + project.title + '」に保存しました。\nファイル名: ' + result.filename);
                } else {
                    window.app.updateStatus('❌ アップロードに失敗しました。');
                    alert('アップロードに失敗しました: ' + JSON.stringify(result));
                }
            } catch(e) {
                window.app.updateStatus('❌ アップロードエラー。');
                alert('エラー: ' + e.message);
            }
        }, 1000);
    }

    console.log('✅ Poetry Analysis Tool initialized');

    console.log('   PDF.js version:', pdfjsLib.version || 'unknown');
    console.log('   Main app instance ready');
});

// Additional event listener for selection changes
document.addEventListener('selectionchange', () => {
    const selection = window.getSelection();
    if (selection.rangeCount > 0 && !selection.getRangeAt(0).collapsed) {
        // Selection exists and is not collapsed
        console.log('Selection detected:', selection.toString().substring(0, 50));
    }
});




// ==========================================
// 🆕 略語抽出機能（OpenAI版）
// ==========================================

class AbbreviationExtractor {
    constructor(pdfDoc) {
        this.pdfDoc = pdfDoc;
        this.abbreviations = [];
        this.apiKey = null;
        this.useOpenAI = true;  // OpenAI を使用（後で Claude に切り替え可能）
    }

    /**
     * メイン関数：ボタンがクリックされたらここが実行される
     */
    async extractAbbreviations() {
        console.log('📍 略語抽出を開始します...');

        try {
            // Step 2: Abbreviationsページを探す
            console.log('\n🔍 ステップ 2: Abbreviationsページを探索中...');
            const pageNum = await this.findAbbreviationsPage();

            if (!pageNum) {
                console.warn('⚠️  Abbreviationsページが見つかりません');
                return null;
            }

            // Step 3: ページを画像に変換
            console.log(`\n🖼️  ステップ 3: ページ ${pageNum} を画像に変換中...`);
            const base64Image = await this.renderPageToBase64(pageNum);

            // Step 4: API で抽出（OpenAI または Claude）
            if (this.useOpenAI) {
                console.log('\n🤖 ステップ 4: OpenAI APIで略語を抽出中...');
                var abbreviations = await this.extractWithOpenAI(base64Image);
            } else {
                console.log('\n🤖 ステップ 4: Claude APIで略語を抽出中...');
                var abbreviations = await this.extractWithClaudeAPI(base64Image);
            }

            // Step 5: 結果を画面に表示
            console.log('\n📺 ステップ 5: 結果を表示中...');
            this.displayResults(abbreviations);

            this.abbreviations = abbreviations;

            console.log(`\n✅ 成功！ ${abbreviations.length} 個の略語を抽出しました`);
            return abbreviations;

        } catch (error) {
            console.error('\n❌ エラーが発生しました:', error);
            throw error;
        }
    }

    /**
     * STEP 2: Abbreviationsページを見つける
     */
    async findAbbreviationsPage() {
        console.log('🔍 Abbreviationsページを探中...');

        const totalPages = this.pdfDoc.numPages;
        console.log(`📄 総ページ数: ${totalPages}`);

        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            try {
                const page = await this.pdfDoc.getPage(pageNum);
                const textContent = await page.getTextContent();
                const pageText = textContent.items
                    .map(item => item.str)
                    .join(' ');

                if (/abbreviations|list of abbreviations|abbreviation list|abbr|略語/i.test(pageText)) {
                    console.log(`✅ 見つかった！ ページ ${pageNum} に Abbreviations があります`);
                    return pageNum;
                }

                console.log(`⏳ ページ ${pageNum} / ${totalPages} をチェック...`);

            } catch (error) {
                console.warn(`⚠️  ページ ${pageNum} でエラー:`, error.message);
            }
        }

        console.warn('❌ Abbreviationsページが見つかりません');
        return null;
    }

    /**
     * STEP 3: ページを画像に変換
     */
    async renderPageToBase64(pageNum) {
        console.log(`🖼️  ページ ${pageNum} を画像に変換中...`);

        try {
            const page = await this.pdfDoc.getPage(pageNum);
            // OpenAI Vision API は高解像度推奨
            const viewport = page.getViewport({ scale: 2.0 });

            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            const context = canvas.getContext('2d');

            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;

            const dataUrl = canvas.toDataURL('image/png');
            const base64String = dataUrl.split(',')[1];

            console.log(`✅ 変換完了！ 画像サイズ: ${base64String.length} 文字`);

            return base64String;

        } catch (error) {
            console.error('❌ 画像変換エラー:', error);
            throw error;
        }
    }

    /**
     * STEP 4-1: OpenAI APIで抽出
     * 
     * モデル: gpt-4-turbo-with-vision または gpt-4o
     * 料金: 1ページ約 $0.01～$0.05
     */
    async extractWithOpenAI(base64Image) {
        console.log('🤖 OpenAI APIに送信中...');

        const apiKey = localStorage.getItem('openaiApiKey');
        if (!apiKey) {
            throw new Error(
                '❌ OpenAI APIキーが設定されていません。\n\n' +
                'Consoleで以下を実行してください:\n' +
                'localStorage.setItem("openaiApiKey", "sk-proj-XXXX...");'
            );
        }

        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    // gpt-4-turbo-with-vision または gpt-4o（最新で推奨）
                    model: 'gpt-4o',
                    max_tokens: 2000,
                    messages: [{
                        role: 'user',
                        content: [
                            {
                                type: 'image_url',
                                image_url: {
                                    url: `data:image/png;base64,${base64Image}`,
                                    detail: 'high'  // 高品質で処理
                                }
                            },
                            {
                                type: 'text',
                                text: `このページから全ての略語を抽出してください。

JSON形式で以下のように返してください:
[
  {"abbr": "PL", "full": "Paradise Lost"},
  {"abbr": "KJV", "full": "King James Version"},
  {"abbr": "Gen.", "full": "Genesis"}
]

ルール:
- 略語と正式名称のペアのみを返す
- その他のテキスト、説明、Markdownは返さない
- 有効なJSONのみを返す
- JSONの外に何も出力しない
- 複数の略語がある場合は全て抽出してください`
                            }
                        ]
                    }],
                    temperature: 0.2  // 低めの temperature でより一貫性のある結果
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(
                    `OpenAI API エラー (${response.status}): ` +
                    `${error.error?.message || JSON.stringify(error)}`
                );
            }

            const data = await response.json();

            // OpenAI の回答を取得
            const responseText = data.choices[0].message.content;
            console.log('OpenAI からの回答（最初の200文字）:', responseText.substring(0, 200));

            // JSON をパース
            const cleanedJson = responseText
                .replace(/```json\n?/g, '')
                .replace(/```\n?/g, '')
                .trim();

            const abbreviations = JSON.parse(cleanedJson);

            console.log(`✅ 抽出完了！ ${abbreviations.length} 個の略語を取得`);
            console.log('データ例:', abbreviations.slice(0, 3));

            return abbreviations;

        } catch (error) {
            console.error('❌ OpenAI API エラー:', error);
            throw error;
        }
    }

    /**
     * STEP 4-2: Claude APIで抽出（後で使用可能）
     * 
     * 切り替え方法:
     * this.useOpenAI = false;
     */
    async extractWithClaudeAPI(base64Image) {
        console.log('🤖 Claude APIに送信中...');

        const apiKey = localStorage.getItem('claudeApiKey');
        if (!apiKey) {
            throw new Error(
                '❌ Claude APIキーが設定されていません。\n\n' +
                'Consoleで以下を実行してください:\n' +
                'localStorage.setItem("claudeApiKey", "sk-ant-XXXX...");'
            );
        }

        try {
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: 'claude-sonnet-4-20250514',
                    max_tokens: 2000,
                    messages: [{
                        role: 'user',
                        content: [
                            {
                                type: 'image',
                                source: {
                                    type: 'base64',
                                    media_type: 'image/png',
                                    data: base64Image
                                }
                            },
                            {
                                type: 'text',
                                text: `このページから全ての略語を抽出してください。

JSON形式で以下のように返してください:
[
  {"abbr": "PL", "full": "Paradise Lost"},
  {"abbr": "KJV", "full": "King James Version"},
  {"abbr": "Gen.", "full": "Genesis"}
]

ルール:
- 略語と正式名称のペアのみを返す
- その他のテキスト、説明、Markdownは返さない
- 有効なJSONのみを返す
- JSONの外に何も出力しない`
                            }
                        ]
                    }]
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(
                    `Claude API エラー (${response.status}): ` +
                    `${error.error?.message || error.message || 'Unknown error'}`
                );
            }

            const data = await response.json();
            const responseText = data.content[0].text;
            console.log('Claude からの回答（最初の200文字）:', responseText.substring(0, 200));

            const cleanedJson = responseText
                .replace(/```json\n?/g, '')
                .replace(/```\n?/g, '')
                .trim();

            const abbreviations = JSON.parse(cleanedJson);

            console.log(`✅ 抽出完了！ ${abbreviations.length} 個の略語を取得`);
            console.log('データ例:', abbreviations.slice(0, 3));

            return abbreviations;

        } catch (error) {
            console.error('❌ Claude API エラー:', error);
            throw error;
        }
    }

    /**
     * STEP 5: 結果を画面に表示
     */
    displayResults(abbreviations) {
        console.log('📺 結果を画面に表示...');

        const resultDiv = document.getElementById('abbr-list');
        const resultsContainer = document.getElementById('abbr-results');
        const emptyMessage = document.getElementById('abbrEmptyMessage');
        const spinner = document.getElementById('abbrLoadingSpinner');

        if (!resultDiv) {
            console.error('❌ abbr-list 要素が見つかりません（HTMLを確認してください）');
            return;
        }

        if (spinner) spinner.style.display = 'none';

        if (!abbreviations || abbreviations.length === 0) {
            resultDiv.innerHTML = '<p style="color: #999; text-align: center;">No abbreviations found / 略語が見つかりません</p>';
            if (emptyMessage) emptyMessage.style.display = 'block';
            return;
        }

        let html = '<table style="width: 100%; border-collapse: collapse;">';
        html += '<thead><tr style="background: #f0f0f0; border-bottom: 2px solid #ddd;">';
        html += '<th style="padding: 10px; text-align: left; font-weight: bold;">Abbr.</th>';
        html += '<th style="padding: 10px; text-align: left; font-weight: bold;">Full Form</th>';
        html += '</tr></thead>';
        html += '<tbody>';

        abbreviations.forEach((item, index) => {
            const bgColor = index % 2 === 0 ? '#ffffff' : '#f9f9f9';
            // クリック可能な行にする
            html += `<tr style="border-bottom: 1px solid #eee; background: ${bgColor}; cursor: pointer; transition: all 0.2s;" 
                 onmouseover="this.style.background='#e3f2fd'" 
                 onmouseout="this.style.background='${bgColor}'"
                 onclick="window.app.fillSourceInfoFromAbbr('${escapeHtml(item.abbr)}', '${escapeHtml(item.full)}')">`;
            html += `<td style="padding: 10px; font-weight: bold; color: #2196F3;">`;
            html += escapeHtml(item.abbr || '');
            html += '</td>';
            html += `<td style="padding: 10px;">`;
            html += escapeHtml(item.full || '');
            html += '</td>';
            html += '</tr>';
        });

        html += '</tbody></table>';

        resultDiv.innerHTML = html;
        if (resultsContainer) resultsContainer.style.display = 'block';
        if (emptyMessage) emptyMessage.style.display = 'none';

        console.log(`✅ ${abbreviations.length} 個の略語を画面に表示しました`);
    }

    /**
 * JSON としてダウンロード
 */
    downloadAsJSON() {
        if (!this.abbreviations || this.abbreviations.length === 0) {
            alert('No data to download');
            return;
        }

        const data = {
            extractedDate: new Date().toISOString(),
            totalAbbreviations: this.abbreviations.length,
            abbreviations: this.abbreviations
        };

        const jsonString = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'abbreviations.json';
        link.click();
        URL.revokeObjectURL(url);

        console.log('✅ JSON ダウンロード完了');
    }

    /**
     * CSV としてダウンロード
     */
    downloadAsCSV() {
        if (!this.abbreviations || this.abbreviations.length === 0) {
            alert('No data to download');
            return;
        }

        let csv = 'Abbreviation,Full Form\n';

        this.abbreviations.forEach(item => {
            const abbr = (item.abbr || '').replace(/"/g, '""');
            const full = (item.full || '').replace(/"/g, '""');
            csv += `"${abbr}","${full}"\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'abbreviations.csv';
        link.click();
        URL.revokeObjectURL(url);

        console.log('✅ CSV ダウンロード完了');
    }

    /**
     * OpenAI APIキーを設定
     */
    setOpenAIKey(apiKey) {
        if (!apiKey) {
            throw new Error('APIキーが空です');
        }

        localStorage.setItem('openaiApiKey', apiKey);
        this.apiKey = apiKey;
        this.useOpenAI = true;
        console.log('✅ OpenAI APIキーを保存しました');
        console.log('次回から自動的に使用されます');
    }

    /**
     * Claude APIキーを設定
     */
    setClaudeKey(apiKey) {
        if (!apiKey) {
            throw new Error('APIキーが空です');
        }

        localStorage.setItem('claudeApiKey', apiKey);
        this.apiKey = apiKey;
        this.useOpenAI = false;
        console.log('✅ Claude APIキーを保存しました');
        console.log('次回から Claude が使用されます');
    }

    /**
     * API を切り替える
     * @param {string} apiType - 'openai' または 'claude'
     */
    switchAPI(apiType) {
        if (apiType.toLowerCase() === 'openai') {
            this.useOpenAI = true;
            console.log('🔄 OpenAI に切り替えました');
        } else if (apiType.toLowerCase() === 'claude') {
            this.useOpenAI = false;
            console.log('🔄 Claude に切り替えました');
        } else {
            console.error('❌ 不正なAPI指定:', apiType);
        }
    }

    /**
     * APIキーを削除
     */
    clearApiKeys() {
        localStorage.removeItem('openaiApiKey');
        localStorage.removeItem('claudeApiKey');
        console.log('✅ 全てのAPIキーを削除しました');
    }
}

/**
 * HTML特殊文字をエスケープ
 */
function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// グローバルに保存
window.abbrevExtractor = null;

// ==========================================
// 🆕 テキストペア抽出機能（OpenAI Vision版）
// このコード全体を app.js の最後尾に貼り付けてください
// ==========================================

class TextPairExtractor {
    constructor(pdfDoc, currentPage, scale) {
        this.pdfDoc = pdfDoc;
        this.currentPage = currentPage;
        this.scale = scale;
        this.pairs = [];
    }

    /**
     * メイン関数：テキストペアを抽出
     */
    async extractTextPairs() {
        console.log('📍 テキストペア抽出を開始します...');

        try {
            // Step 1: 現在のページをキャプチャ
            console.log('\n📸 ステップ 1: 現在のページをキャプチャ中...');
            const base64Image = await this.captureCurrentPage();

            // Step 2: AIで分析
            console.log('\n🤖 ステップ 2: AIで脚注とテキストを分析中...');
            const pairs = await this.analyzePageWithAI(base64Image);

            // Step 3: 結果を表示
            console.log('\n📺 ステップ 3: 結果を表示中...');
            this.displayResults(pairs);

            this.pairs = pairs;

            console.log(`\n✅ 成功！ ${pairs.length} 個のテキストペアを抽出しました`);
            return pairs;

        } catch (error) {
            console.error('\n❌ エラーが発生しました:', error);
            throw error;
        }
    }

    /**
     * STEP 1: 現在のページをBase64に変換
     */
    async captureCurrentPage() {
        console.log(`📸 ページ ${this.currentPage} をキャプチャ中...`);

        try {
            const page = await this.pdfDoc.getPage(this.currentPage);
            const viewport = page.getViewport({ scale: this.scale });

            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            const context = canvas.getContext('2d');

            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;

            const dataUrl = canvas.toDataURL('image/png');
            const base64String = dataUrl.split(',')[1];

            console.log(`✅ キャプチャ完了！ サイズ: ${base64String.length} 文字`);
            return base64String;

        } catch (error) {
            console.error('❌ キャプチャエラー:', error);
            throw error;
        }
    }

    /**
     * STEP 2: AIでページを分析
     * 脚注から行番号・テキスト・参考文献を抽出
     */
    async analyzePageWithAI(base64Image) {
        console.log('🤖 OpenAI APIに送信中...');

        const apiKey = localStorage.getItem('openaiApiKey');
        if (!apiKey) {
            throw new Error(
                '❌ OpenAI APIキーが設定されていません。\n\n' +
                'Consoleで以下を実行してください:\n' +
                'localStorage.setItem("openaiApiKey", "sk-proj-...");'
            );
        }

        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-4o',
                    max_tokens: 4000,
                    messages: [{
                        role: 'user',
                        content: [
                            {
                                type: 'image_url',
                                image_url: {
                                    url: `data:image/png;base64,${base64Image}`,
                                    detail: 'high'
                                }
                            },
                            {
                                type: 'text',
                                text: `IMPORTANT: Respond ONLY in English. Do NOT respond in Japanese.

Analyze footnotes on this page. Extract text pairs.

INSTRUCTIONS:
1. Find all footnotes on this page
2. For each footnote, extract:
   - Line numbers (e.g., "17-18", "20-3")
   - Text from page body
   - Source citation from footnote

3. Return ONLY valid JSON:
[
  {"lineNumbers": "17-18", "targetText": "...", "sourceText": "...", "sourceReference": "..."},
  {"lineNumbers": "20-3", "targetText": "...", "sourceText": "...", "sourceReference": "..."}
]

RULES:
- Return ONLY valid JSON
- NO markdown or explanations
- Extract text accurately from the page body, focusing on passages that discuss influence or intertextual relationships rather than simple descriptive notes.
- Always capture any footnotes that include “Cp.” exactly as written.
- If no footnotes: return []
- Use "/" for line breaks
- Do not alter abbreviations (e.g., CP, AM).
- Expand shortened forms such as ibid. or op. cit. by identifying the referenced work from the surrounding context whenever possible.
- If a footnote contains only a number, use the value of lineNumbers as is.
- Extract all text pairs if multiple are present.


If no footnotes found, respond with: []`
                            }
                        ]
                    }],
                    temperature: 0.3
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(
                    `OpenAI API エラー (${response.status}): ` +
                    `${error.error?.message || JSON.stringify(error)}`
                );
            }

            const data = await response.json();
            const responseText = data.choices[0].message.content;

            console.log('OpenAI からの回答（最初の200文字）:', responseText.substring(0, 200));

            // JSON をパース
            const cleanedJson = responseText
                .replace(/```json\n?/g, '')
                .replace(/```\n?/g, '')
                .trim();

            const pairs = JSON.parse(cleanedJson);

            console.log(`✅ 分析完了！ ${pairs.length} 個のペアを抽出`);
            console.log('データ例:', pairs.slice(0, 2));

            return pairs;

        } catch (error) {
            console.error('❌ AI分析エラー:', error);
            throw error;
        }
    }

    /**
     * STEP 3: 結果をテーブルで表示
     */
    displayResults(pairs) {
        console.log('📺 結果を表示...');

        const resultDiv = document.getElementById('text-pairs-list');
        const resultsContainer = document.getElementById('text-pairs-results');
        const spinner = document.getElementById('pairsLoadingSpinner');

        if (!resultDiv) {
            console.error('❌ text-pairs-list 要素が見つかりません（HTMLを確認）');
            return;
        }

        if (spinner) spinner.style.display = 'none';

        if (!pairs || pairs.length === 0) {
            resultDiv.innerHTML = '<p style="color: #999; text-align: center;">テキストペアが見つかりません</p>';
            return;
        }

        let html = '<table style="width: 100%; border-collapse: collapse; font-size: 0.9em;" class="text-pairs-table">';
        html += '<thead><tr style="background: #f0f0f0; border-bottom: 2px solid #ddd;">';
        html += '<th style="padding: 10px; text-align: left; font-weight: bold;">Lines</th>';
        html += '<th style="padding: 10px; text-align: left; font-weight: bold;">Target Text</th>';
        html += '<th style="padding: 10px; text-align: left; font-weight: bold;">Source Reference</th>';
        html += '</tr></thead>';
        html += '<tbody>';

        pairs.forEach((pair, index) => {
            const bgColor = index % 2 === 0 ? '#ffffff' : '#f9f9f9';
            const targetText = pair.targetText || '';
            const sourceText = pair.sourceText || '';
            const sourceReference = pair.sourceReference || '';

            // クリック時に渡すテキスト（エスケープは避ける）
            const combinedSource = sourceText ?
                (sourceText + (sourceReference ? ` (${sourceReference})` : '')) :
                sourceReference;

            // 修正: onclick 属性ではなく class と data-* 属性を使用
            html += `<tr class="text-pair-row" 
                     data-target-text="${escapeHtml(targetText)}" 
                     data-source-text="${escapeHtml(combinedSource)}"
                     style="border-bottom: 1px solid #eee; background: ${bgColor}; cursor: pointer; transition: all 0.2s;" 
                     onmouseover="this.style.background='#e3f2fd'" 
                     onmouseout="this.style.background='${bgColor}'">`;

            html += `<td style="padding: 10px; font-weight: bold; color: #2196F3;">`;
            html += escapeHtml(pair.lineNumbers || '');
            html += '</td>';

            html += `<td style="padding: 10px; max-width: 300px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">`;
            html += escapeHtml(targetText.substring(0, 100));
            if (targetText.length > 100) html += '...';
            html += '</td>';

            html += `<td style="padding: 10px; color: #666;">`;
            html += escapeHtml(sourceReference.substring(0, 80));
            if (sourceReference.length > 80) html += '...';
            html += '</td>';

            html += '</tr>';
        });

        html += '</tbody></table>';

        resultDiv.innerHTML = html;
        if (resultsContainer) resultsContainer.style.display = 'block';

        // ==========================================
        // 🆕 イベントリスナーを追加
        // テーブル行のクリック処理を setup
        // ==========================================
        this.setupTextPairClickHandler();

        console.log(`✅ ${pairs.length} 個のペアを表示しました`);
    }

    /**
     * テキストペア行のクリックハンドラーをセットアップ
     * 修正版: data-* 属性からデータを取得
     */
    setupTextPairClickHandler() {
        console.log('🔧 テキストペア行のクリックハンドラーをセットアップ中...');

        const resultDiv = document.getElementById('text-pairs-list');
        if (!resultDiv) return;

        // ❌ 古い方法: 各行に onclick を設定（問題がある）
        // ✅ 新しい方法: イベント委譲を使用（堅牢）

        // 既存のリスナーを削除（重複を避けるため）
        const tableWrapper = resultDiv;
        const oldHandler = tableWrapper._textPairClickHandler;
        if (oldHandler) {
            tableWrapper.removeEventListener('click', oldHandler);
        }

        // 新しいクリックハンドラーを定義
        const clickHandler = (event) => {
            // クリックされたのが行（tr）か、その子要素か確認
            const row = event.target.closest('.text-pair-row');

            if (!row) return;

            console.log('📍 テキストペア行がクリックされました');

            // data-* 属性からテキストを取得
            const targetText = row.getAttribute('data-target-text');
            const sourceText = row.getAttribute('data-source-text');

            console.log('📥 取得したデータ:');
            console.log('   targetText:', targetText?.substring(0, 50) + '...');
            console.log('   sourceText:', sourceText?.substring(0, 50) + '...');

            // fillFromTextPair() を呼び出し
            if (targetText && sourceText) {
                if (window.app && typeof window.app.fillFromTextPair === 'function') {
                    console.log('✅ fillFromTextPair() を呼び出し中...');
                    window.app.fillFromTextPair(targetText, sourceText);
                    console.log('✅ テキストが自動入力されました');
                } else {
                    console.error('❌ fillFromTextPair() が見つかりません');
                    console.error('   window.app:', !!window.app);
                    console.error('   typeof fillFromTextPair:', typeof window.app?.fillFromTextPair);
                }
            } else {
                console.warn('⚠️ data-* 属性からデータを取得できません');
                console.warn('   targetText:', targetText);
                console.warn('   sourceText:', sourceText);
            }
        };

        // クリックリスナーを追加
        tableWrapper.addEventListener('click', clickHandler);

        // 次回の cleanup のために保存
        tableWrapper._textPairClickHandler = clickHandler;

        console.log('✅ クリックハンドラーのセットアップ完了');
    }

}

/**
 * HTML特殊文字をエスケープ
 * セキュリティ対策：ユーザー入力を安全に表示するため
 */
function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// グローバルに保存
window.textPairExtractor = null;
