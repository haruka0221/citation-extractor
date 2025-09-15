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
        this.scrollThrottle = null;
        this.renderedPages = new Set(); // Track which pages are rendered
        this.pageElements = new Map(); // Store page elements
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

        fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        
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
        
        exportJsonBtn.addEventListener('click', () => this.exportAsJSON());
        exportCsvBtn.addEventListener('click', () => this.exportAsCSV());
        
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
            } else {
                errorMessage += 'Please check the file and try again.';
            }
            
            this.updateStatus(errorMessage);
            
            // Show upload section again
            document.getElementById('uploadSection').style.display = 'block';
            document.getElementById('workspace').style.display = 'none';
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
            
            console.log(`Page ${pageNum} natural dimensions:`, naturalViewport.width, 'x', naturalViewport.height);
            console.log(`Page ${pageNum} scaled dimensions:`, viewport.width, 'x', viewport.height);
            
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

    async renderTextLayerForPage(page, viewport, textLayerDiv, pageNum) {
        try {
            // Get text content from PDF.js
            const textContent = await page.getTextContent();
            
            // Use PDF.js renderTextLayer function with proper positioning
            await pdfjsLib.renderTextLayer({
                textContentSource: textContent,
                container: textLayerDiv,
                viewport: viewport,
                textDivs: [],
                isOffscreenCanvasSupported: true
            }).promise;
            
            console.log(`Text layer for page ${pageNum} rendered successfully`);
            
        } catch (error) {
            console.warn(`PDF.js text layer failed for page ${pageNum}, using fallback:`, error);
            // Fallback to custom text overlay
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
3. First selection goes to "Target Poem Text"
4. Second selection goes to "Source Influence Info"

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
        // Give a small delay to ensure selection is complete
        setTimeout(() => {
            const selection = window.getSelection();
            console.log('Selection check - range count:', selection.rangeCount);
            
            if (selection.rangeCount > 0) {
                const selectedText = selection.toString().trim();
                console.log('Text selected length:', selectedText.length);
                console.log('Selected text:', selectedText);
                
                if (selectedText.length > 2) { // Process any meaningful selection
                    this.processSelectedTextAlternating(selectedText);
                    
                    // Visual feedback
                    this.showSelectionFeedback(selection);
                    
                    // Clear selection after processing
                    setTimeout(() => {
                        selection.removeAllRanges();
                    }, 1500);
                } else {
                    console.log('Selection too short, ignoring');
                }
            } else {
                console.log('No selection range found');
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
        
        // Alternate between target and source fields
        if (this.selectionCount % 2 === 0) {
            // Even count: goes to target field
            targetTextArea.value = text;
            this.currentSelection.target = text;
            this.updateStatus(`✓ Target text captured! (Selection ${this.selectionCount + 1}) - Next selection will go to Source Info.`);
            targetTextArea.style.borderColor = '#48bb78';
            sourceInfoArea.style.borderColor = '#e2e8f0';
        } else {
            // Odd count: goes to source field
            sourceInfoArea.value = text;
            this.currentSelection.source = text;
            this.updateStatus(`✓ Source info captured! (Selection ${this.selectionCount + 1}) - Next selection will go to Target Text.`);
            sourceInfoArea.style.borderColor = '#48bb78';
            targetTextArea.style.borderColor = '#e2e8f0';
        }
        
        this.selectionCount++;
        this.updateSaveButton();
        
        // Reset border colors after delay
        setTimeout(() => {
            targetTextArea.style.borderColor = '#e2e8f0';
            sourceInfoArea.style.borderColor = '#e2e8f0';
        }, 3000);
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
        
        // Clear all page contents
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
            const dataPair = {
                id: Date.now(),
                timestamp: new Date().toISOString(),
                page: this.currentPage,
                targetText: targetText,
                sourceInfo: sourceInfo
            };
            
            this.savedData.push(dataPair);
            this.saveToStorage();
            this.updateDataDisplay();
            this.clearCurrentSelection();
            this.updateStatus('Data pair saved successfully!');
        }
    }

    clearCurrentSelection() {
        document.getElementById('targetText').value = '';
        document.getElementById('sourceInfo').value = '';
        this.currentSelection = { target: '', source: '' };
        this.selectionCount = 0; // Reset selection counter
        
        // Remove any highlight overlays
        document.querySelectorAll('.selection-highlight').forEach(el => el.remove());
        
        this.updateSaveButton();
        this.updateStatus('Selections cleared. Next selection will go to Target Text.');
        
        // Reset border colors
        document.getElementById('targetText').style.borderColor = '#e2e8f0';
        document.getElementById('sourceInfo').style.borderColor = '#e2e8f0';
    }

    updateDataDisplay() {
        const container = document.getElementById('savedData');
        const countElement = document.querySelector('.data-count');
        
        countElement.textContent = `${this.savedData.length} pairs saved`;
        
        container.innerHTML = '';
        
        this.savedData.slice().reverse().forEach((item) => {
            const itemElement = document.createElement('div');
            itemElement.className = 'data-item';
            itemElement.innerHTML = `
                <div class="data-item-header">
                    <span class="data-item-id">ID: ${item.id} | Page: ${item.page}</span>
                    <button class="delete-btn" onclick="app.deleteDataItem(${item.id})">Delete</button>
                </div>
                <div class="data-item-content">
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
        this.updateStatus('Data exported as CSV.');
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
                    if (text.length > 5 && fontSize > 12 && y > (page.getViewport({scale: 1.0}).height * 0.7)) {
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
                        const previous = potentialTitles[i-1];
                        
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
    app = new PoetryAnalysisTool();
    console.log('Poetry Analysis Tool initialized');
    console.log('Container constraints removed - full PDF display enabled');
});

// Additional event listener for selection changes
document.addEventListener('selectionchange', () => {
    const selection = window.getSelection();
    if (selection.rangeCount > 0 && !selection.getRangeAt(0).collapsed) {
        // Selection exists and is not collapsed
        console.log('Selection detected:', selection.toString().substring(0, 50));
    }
});