/**
 * Full-Text Scrollable Viewer with Range Selection
 * Loads entire works and allows click-based line range selection
 */

class FullTextViewer {
    constructor() {
        this.rangeStart = null;
        this.rangeEnd = null;
        this.currentText = null;
        this.currentCandidate = null;
        this.allLines = [];
        this.isSelecting = false;
        this.didInitialScroll = false;
    }

    /**
     * Load and display entire work with virtual scrolling
     */
    async displayFullTextViewer(candidate, suggestedLines = null) {
        console.log('📖 Loading full text viewer for:', candidate.title);

        try {
            this.currentCandidate = candidate;

            // Load complete work text
            const fullText = await this.loadFullText(candidate.source_file || candidate.filename);
            this.allLines = fullText.split('\n');

            console.log(`📄 Loaded ${this.allLines.length} lines from ${candidate.filename}`);

            // Create scrollable container with all lines
            await this.renderTextViewer(suggestedLines);

            // Initialize range selection
            this.initRangeSelection();

            // Auto-scroll to suggested range if provided
            if (suggestedLines) {
                await this.scrollToRange(suggestedLines);

                // Pre-select suggested range
                this.setSelection(suggestedLines.start, suggestedLines.end);
            }

            console.log('✅ Full text viewer ready');

        } catch (error) {
            console.error('❌ Error loading full text viewer:', error);
            throw error;
        }
    }

    /**
     * Load full text from file
     */
    async loadFullText(filename) {
        try {
            const response = await fetch(`./test_corpus/cleaned/${filename}`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const text = await response.text();
            console.log(`📥 Loaded ${text.length} characters from ${filename}`);
            return text;

        } catch (error) {
            console.error(`❌ Failed to load text from ${filename}:`, error);
            throw error;
        }
    }

    /**
     * Render the text viewer with all lines
     */
    async renderTextViewer(suggestedLines) {
        const container = document.getElementById('text-viewer');
        const scrollContainer = document.querySelector('.text-viewer-container');
        if (!container) {
            throw new Error('Text viewer container not found');
        }

        // ★ CRITICAL: スクロールを完全にリセット
        if (scrollContainer) {
            scrollContainer.scrollTop = 0;
        }

        // Clear existing content
        container.innerHTML = '';


        // ★ CRITICAL: コンテナのスタイルを強制リセット
    container.style.padding = '0';
    container.style.margin = '0';
    container.style.transform = 'none';
    container.style.position = 'relative';
    container.style.top = '0';


       

        // Create lines with proper escaping
        const linesHTML = this.allLines.map((line, index) => {
            const lineNumber = index + 1;
            const isInSuggested = suggestedLines &&
                lineNumber >= suggestedLines.start &&
                lineNumber <= suggestedLines.end;

            return `
                <div class="text-line ${isInSuggested ? 'suggested' : ''}"
                     data-line-number="${lineNumber}">
                    <span class="line-num">${lineNumber}</span>
                    <span class="line-text">${this.escapeHtml(line)}</span>
                </div>
            `;
        }).join('');

        container.innerHTML = linesHTML;

        // ★ CRITICAL: レンダリング後に再度スクロールリセット
        if (scrollContainer) {
           scrollContainer.scrollTop = 0;
        }

        // Update header with work info
        this.updateViewerHeader();

        console.log(`📋 Rendered ${this.allLines.length} lines in text viewer`);
        // ★ VERIFICATION
    setTimeout(() => {
        const firstLine = document.querySelector('[data-line-number="1"]');
        console.log('Verification - 1行目offsetTop:', firstLine?.offsetTop);
        if (firstLine && firstLine.offsetTop < 0) {
            console.error('⚠️ 1行目が負の位置にあります、強制修正中...');
            scrollContainer.scrollTop = 0;
        }
    }, 100);
    }

    /**
     * Update the viewer header with work information
     */
    updateViewerHeader() {
        const headerTitle = document.getElementById('viewer-title');
        const headerInstructions = document.getElementById('viewer-instructions');

        if (headerTitle && this.currentCandidate) {
            headerTitle.innerHTML = `
                Select Text Range from: <em>${this.currentCandidate.title}</em>
                <div class="work-subtitle">by ${this.currentCandidate.author}</div>
            `;
        }

        if (headerInstructions) {
            headerInstructions.innerHTML = `
                <div class="instruction-item">📍 Click line to start selection</div>
                <div class="instruction-item">⌨️ Shift+Click to extend range</div>
                <div class="instruction-item">📏 Total lines: ${this.allLines.length}</div>
            `;
        }
    }

    /**
     * Initialize click-based range selection
     */
    initRangeSelection() {
        const lines = document.querySelectorAll('.text-line');

        lines.forEach(line => {
            line.addEventListener('click', (e) => {
                this.handleLineClick(e, line);
            });

            // Add hover effects
            line.addEventListener('mouseenter', (e) => {
                if (this.rangeStart && e.shiftKey) {
                    this.previewRange(e, line);
                }
            });
        });

        // Global key handlers
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.clearSelection();
            }
        });

        console.log(`🖱️ Range selection initialized for ${lines.length} lines`);
    }

    /**
     * Handle line click for range selection
     */
    handleLineClick(event, line) {
        const lineNum = parseInt(line.dataset.lineNumber);

        if (!this.rangeStart || !event.shiftKey) {
            // Start new selection
            this.rangeStart = lineNum;
            this.rangeEnd = lineNum;
            console.log(`🎯 Started selection at line ${lineNum}`);
        } else {
            // Extend to clicked line (Shift+Click)
            this.rangeEnd = lineNum;
            console.log(`📏 Extended selection to line ${lineNum}`);
        }

        this.updateSelection();
    }

    /**
     * Preview range on hover with Shift key
     */
    previewRange(event, line) {
        if (!this.rangeStart) return;

        const lineNum = parseInt(line.dataset.lineNumber);
        const start = Math.min(this.rangeStart, lineNum);
        const end = Math.max(this.rangeStart, lineNum);

        // Temporarily highlight preview range
        document.querySelectorAll('.text-line').forEach(l => {
            l.classList.remove('preview-range');
        });

        for (let i = start; i <= end; i++) {
            const previewLine = document.querySelector(`[data-line-number="${i}"]`);
            if (previewLine) {
                previewLine.classList.add('preview-range');
            }
        }
    }

    /**
     * Update visual selection
     */
    updateSelection() {
        const start = Math.min(this.rangeStart, this.rangeEnd);
        const end = Math.max(this.rangeStart, this.rangeEnd);

        // Clear previous selection
        document.querySelectorAll('.text-line').forEach(line => {
            line.classList.remove('selected', 'range-start', 'range-end', 'preview-range');
        });

        // Apply new selection
        for (let i = start; i <= end; i++) {
            const line = document.querySelector(`[data-line-number="${i}"]`);
            if (line) {
                line.classList.add('selected');
                if (i === start) line.classList.add('range-start');
                if (i === end) line.classList.add('range-end');
            }
        }

        // Update selection info
        this.updateSelectionInfo(start, end);

        // Enable/disable confirm button
        this.updateConfirmButton(start, end);

        console.log(`📋 Selection updated: lines ${start}-${end}`);
    }

    /**
     * Set selection programmatically
     */
    setSelection(start, end) {
        this.rangeStart = start;
        this.rangeEnd = end;
        this.updateSelection();
        console.log(`🎯 Selection set programmatically: lines ${start}-${end}`);
    }

    /**
     * Clear current selection
     */
    clearSelection() {
        this.rangeStart = null;
        this.rangeEnd = null;

        document.querySelectorAll('.text-line').forEach(line => {
            line.classList.remove('selected', 'range-start', 'range-end', 'preview-range');
        });

        this.updateSelectionInfo(null, null);
        this.updateConfirmButton(null, null);

        console.log('🧹 Selection cleared');
    }

    /**
     * Auto-scroll to suggested range
     */
    async scrollToRange(suggestedLines) {
        console.log(`📍 Scrolling to line ${suggestedLines.start}`);

        const scrollContainer = document.querySelector('.text-viewer-container');
        const targetLine = document.querySelector(`[data-line-number="${suggestedLines.start}"]`);

        if (!scrollContainer || !targetLine) {
            console.error('Scroll container or target line not found');
            return;
        }

        // ★ CRITICAL: 必ず0からスタート
        scrollContainer.scrollTop = 0;

        // Wait for rendering
        await new Promise(resolve => setTimeout(resolve, 300));

        // ★ 1行目のoffsetTopを確認
    const firstLine = document.querySelector('[data-line-number="1"]');
    const firstLineOffset = firstLine?.offsetTop || 0;
    console.log('1行目のoffsetTop:', firstLineOffset);
    
    if (firstLineOffset < 0) {
        console.error('⚠️ レンダリングエラー: 1行目が負の位置にあります');
        // 強制的に修正を試みる
        const textViewer = document.getElementById('text-viewer');
        textViewer.style.marginTop = Math.abs(firstLineOffset) + 'px';
    }

        // ターゲット行の実際の位置を計算
        const targetOffset = targetLine.offsetTop;
        const scrollPosition = Math.max(0, targetOffset - (scrollContainer.clientHeight / 2));

        console.log('Scroll calculation:');
        console.log('Target offsetTop:', targetOffset);
        console.log('Scroll position:', scrollPosition);

        // Use manual scrollTo instead of scrollIntoView
        scrollContainer.scrollTo({
            top: scrollPosition,
            behavior: 'smooth'
        });

        // Add temporary highlight
        targetLine.classList.add('scroll-target');
        setTimeout(() => {
            targetLine.classList.remove('scroll-target');

            // Verification
            console.log('After auto-scroll, scrollTop:', scrollContainer.scrollTop);
            console.log('Can scroll to 0?', scrollContainer.scrollTop > 0);
        }, 2000);
    }

    /**
     * Update selection info display
     */
    updateSelectionInfo(start, end) {
        const selectionInfoElement = document.getElementById('selection-info');
        if (!selectionInfoElement) return;

        if (start === null || end === null) {
            selectionInfoElement.innerHTML = `
                <div class="no-selection">
                    <span class="selection-icon">📄</span>
                    Click lines to make selection
                </div>
            `;
            return;
        }

        const selectedLines = document.querySelectorAll('.text-line.selected');
        const lineCount = selectedLines.length;

        // Get preview text (first 3 lines)
        const preview = Array.from(selectedLines)
            .slice(0, 3)
            .map(l => l.querySelector('.line-text').textContent.trim())
            .filter(text => text.length > 0)
            .join(' ');

        // Calculate character count
        const fullText = Array.from(selectedLines)
            .map(l => l.querySelector('.line-text').textContent)
            .join('\n');

        selectionInfoElement.innerHTML = `
            <div class="selection-summary">
                <div class="selection-stats">
                    <span class="stat-item">
                        <strong>Lines:</strong> ${start}-${end} (${lineCount} lines)
                    </span>
                    <span class="stat-item">
                        <strong>Characters:</strong> ${fullText.length}
                    </span>
                    <span class="stat-item">
                        <strong>Words:</strong> ~${fullText.split(/\s+/).length}
                    </span>
                </div>
                <div class="selection-preview">
                    <strong>Preview:</strong> ${preview}${lineCount > 3 ? '...' : ''}
                </div>
            </div>
        `;
    }

    /**
     * Update confirm button state
     */
    updateConfirmButton(start, end) {
        const confirmButton = document.getElementById('confirm-selection');
        if (!confirmButton) return;

        if (start !== null && end !== null && start <= end) {
            confirmButton.disabled = false;
            confirmButton.textContent = `Confirm Selection (${Math.abs(end - start) + 1} lines)`;
        } else {
            confirmButton.disabled = true;
            confirmButton.textContent = 'Confirm Selection';
        }
    }

    /**
     * Get current selection
     */
    getCurrentSelection() {
        if (this.rangeStart === null || this.rangeEnd === null) {
            return null;
        }

        const start = Math.min(this.rangeStart, this.rangeEnd);
        const end = Math.max(this.rangeStart, this.rangeEnd);

        const selectedLines = [];
        for (let i = start; i <= end; i++) {
            if (this.allLines[i - 1] !== undefined) {
                selectedLines.push(this.allLines[i - 1]);
            }
        }

        return {
            start: start,
            end: end,
            lineCount: selectedLines.length,
            text: selectedLines.join('\n'),
            lines: selectedLines
        };
    }

    /**
     * Escape HTML for safe display
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Highlight specific range (for external API)
     */
    highlightRange(start, end) {
        this.setSelection(start, end);

        // Scroll to range
        this.scrollToRange({ start, end });
    }

    /**
     * Add search functionality within the text
     */
    searchInText(query) {
        if (!query || query.length < 2) {
            this.clearSearchHighlights();
            return [];
        }

        const matches = [];
        const searchRegex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');

        this.allLines.forEach((line, index) => {
            if (searchRegex.test(line)) {
                matches.push({
                    lineNumber: index + 1,
                    text: line,
                    line: line
                });
            }
        });

        this.highlightSearchMatches(matches, query);
        return matches;
    }

    /**
     * Highlight search matches
     */
    highlightSearchMatches(matches, query) {
        this.clearSearchHighlights();

        const searchRegex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');

        matches.forEach(match => {
            const lineElement = document.querySelector(`[data-line-number="${match.lineNumber}"]`);
            if (lineElement) {
                const textElement = lineElement.querySelector('.line-text');
                const originalText = textElement.textContent;
                const highlightedText = originalText.replace(searchRegex, '<mark>$1</mark>');
                textElement.innerHTML = highlightedText;
                lineElement.classList.add('search-match');
            }
        });

        console.log(`🔍 Highlighted ${matches.length} search matches for "${query}"`);
    }

    /**
     * Clear search highlights
     */
    clearSearchHighlights() {
        document.querySelectorAll('.text-line').forEach(line => {
            line.classList.remove('search-match');
            const textElement = line.querySelector('.line-text');
            if (textElement) {
                textElement.textContent = textElement.textContent; // Removes HTML tags
            }
        });
    }
}

// Export for global use
window.FullTextViewer = FullTextViewer;