/**
 * Text Cleaner for Project Gutenberg Texts
 * Removes license info, headers, footers, and normalizes formatting
 * Handles multiple Gutenberg text formats (old and new)
 */

class TextCleaner {
    constructor() {
        // Common Gutenberg start markers (in priority order)
        this.startMarkers = [
            '*** START OF THIS PROJECT GUTENBERG EBOOK',
            '*** START OF THE PROJECT GUTENBERG EBOOK',
            '***START OF THE PROJECT GUTENBERG EBOOK',
            '*** START OF PROJECT GUTENBERG EBOOK',
            '***START OF PROJECT GUTENBERG EBOOK',
            '*END*THE SMALL PRINT',  // Very old format
            'START OF THE PROJECT GUTENBERG',
            'START OF THIS PROJECT GUTENBERG'
        ];

        // Common Gutenberg end markers
        this.endMarkers = [
            '*** END OF THIS PROJECT GUTENBERG EBOOK',
            '*** END OF THE PROJECT GUTENBERG EBOOK',
            '***END OF THE PROJECT GUTENBERG EBOOK',
            '*** END OF PROJECT GUTENBERG EBOOK',
            '***END OF PROJECT GUTENBERG EBOOK',
            'END OF THE PROJECT GUTENBERG',
            'END OF THIS PROJECT GUTENBERG',
            'End of the Project Gutenberg',
            'End of Project Gutenberg'
        ];

        // Patterns to remove (even within content)
        this.removePatterns = [
            /\[Illustration.*?\]/gi,
            /\[Footnote \d+:.*?\]/gi,
            /\[Sidenote:.*?\]/gi,
            /^\s*\[Pg \d+\]\s*$/gm,  // Page markers like [Pg 123]
            /^\s*_+\s*$/gm,           // Underline separators
            /^\s*\*\s*\*\s*\*\s*\*\s*\*\s*$/gm,  // Asterisk separators
        ];

        // Encoding corrections
        this.encodingFixes = [
            { pattern: /â€™/g, replace: "'" },
            { pattern: /â€œ/g, replace: '"' },
            { pattern: /â€/g, replace: '"' },
            { pattern: /â€"/g, replace: '—' },
            { pattern: /â€"/g, replace: '–' },
            { pattern: /Ã©/g, replace: 'é' },
            { pattern: /Ã¨/g, replace: 'è' },
            { pattern: /Ã /g, replace: 'à' },
        ];
    }

    /**
     * Main cleaning function - performs full cleanup
     */
    clean(rawText, options = {}) {
        // Merge with global config if available
        const config = window.GutenbergConfig && window.GutenbergConfig.cleaning;
        
        const cleaningOptions = {
            fixEncoding: options.fixEncoding !== undefined ? options.fixEncoding : 
                        (config && config.fixEncoding !== undefined ? config.fixEncoding : true),
            removeMarkers: options.removeMarkers !== undefined ? options.removeMarkers :
                          (config && config.removeMarkers !== undefined ? config.removeMarkers : true),
            normalizeWhitespace: options.normalizeWhitespace !== undefined ? options.normalizeWhitespace :
                                (config && config.normalizeWhitespace !== undefined ? config.normalizeWhitespace : true),
            removeExcessiveBlankLines: options.removeExcessiveBlankLines !== undefined ? options.removeExcessiveBlankLines :
                                      (config && config.removeExcessiveBlankLines !== undefined ? config.removeExcessiveBlankLines : true)
        };
        
        console.log('🧹 Starting text cleaning...');
        console.log(`📏 Original length: ${rawText.length} characters`);

        let cleaned = rawText;

        // Step 1: Fix encoding issues
        if (cleaningOptions.fixEncoding) {
            cleaned = this.fixEncoding(cleaned);
        }

        // Step 2: Remove header (license info before content)
        cleaned = this.removeHeader(cleaned);

        // Step 3: Remove footer (license info after content)
        cleaned = this.removeFooter(cleaned);

        // Step 4: Remove illustration markers and other noise
        if (cleaningOptions.removeMarkers) {
            cleaned = this.removeMarkers(cleaned);
        }

        // Step 5: Normalize whitespace
        if (cleaningOptions.normalizeWhitespace) {
            cleaned = this.normalizeWhitespace(cleaned);
        }

        // Step 6: Remove excessive blank lines
        if (cleaningOptions.removeExcessiveBlankLines) {
            cleaned = this.removeExcessiveBlankLines(cleaned);
        }

        console.log(`✅ Cleaned length: ${cleaned.length} characters`);
        console.log(`📉 Removed: ${rawText.length - cleaned.length} characters (${((1 - cleaned.length / rawText.length) * 100).toFixed(1)}%)`);

        return cleaned;
    }

    /**
     * Remove Gutenberg header (license text before content)
     */
    removeHeader(text) {
        let bestStart = -1;
        let bestMarker = null;

        // Find the latest start marker (some texts have multiple)
        for (const marker of this.startMarkers) {
            const index = text.toUpperCase().indexOf(marker.toUpperCase());
            if (index > bestStart) {
                bestStart = index;
                bestMarker = marker;
            }
        }

        if (bestStart === -1) {
            console.warn('⚠️ No standard start marker found, using heuristics');
            return this.removeHeaderHeuristic(text);
        }

        // Find the end of the marker line (skip to next line)
        const markerEnd = text.indexOf('\n', bestStart);
        if (markerEnd === -1) {
            return text.substring(bestStart);
        }

        // Skip any additional header lines (like title, author, etc.)
        let contentStart = markerEnd + 1;
        const lines = text.substring(contentStart, contentStart + 2000).split('\n');
        
        // Skip lines that look like metadata
        let skipLines = 0;
        for (const line of lines) {
            const trimmed = line.trim();
            
            // Stop at first substantial line of content
            if (trimmed.length > 50 && !this.looksLikeMetadata(trimmed)) {
                break;
            }
            
            skipLines++;
            contentStart += line.length + 1;
            
            // Don't skip more than 50 lines
            if (skipLines > 50) break;
        }

        console.log(`📍 Found start marker: "${bestMarker}" at position ${bestStart}`);
        console.log(`📍 Content starts at position ${contentStart} (skipped ${skipLines} lines)`);

        return text.substring(contentStart);
    }

    /**
     * Heuristic method for texts without standard markers
     */
    removeHeaderHeuristic(text) {
        const lines = text.split('\n');
        let contentStart = 0;

        // Look for lines that indicate content has started
        for (let i = 0; i < Math.min(lines.length, 200); i++) {
            const line = lines[i].trim();
            
            // Skip very short lines
            if (line.length < 20) continue;
            
            // If we see "CHAPTER", "BOOK", "CANTO", etc., content likely starts
            if (/^(CHAPTER|BOOK|CANTO|PART|ACT|SCENE|PROLOGUE|PREFACE)/i.test(line)) {
                contentStart = i;
                break;
            }
            
            // If we see a long paragraph, likely content
            if (line.length > 200 && !line.includes('Project Gutenberg')) {
                contentStart = Math.max(0, i - 2);  // Include a bit before
                break;
            }
        }

        console.log(`📍 Heuristic: Content likely starts at line ${contentStart}`);
        return lines.slice(contentStart).join('\n');
    }

    /**
     * Remove Gutenberg footer (license text after content)
     */
    removeFooter(text) {
        let bestEnd = text.length;
        let bestMarker = null;

        // Find the earliest end marker
        for (const marker of this.endMarkers) {
            const index = text.toUpperCase().indexOf(marker.toUpperCase());
            if (index !== -1 && index < bestEnd) {
                bestEnd = index;
                bestMarker = marker;
            }
        }

        if (bestEnd === text.length) {
            console.warn('⚠️ No standard end marker found, using heuristics');
            return this.removeFooterHeuristic(text);
        }

        console.log(`📍 Found end marker: "${bestMarker}" at position ${bestEnd}`);

        // Find the start of the line containing the marker
        const lineStart = text.lastIndexOf('\n', bestEnd);
        return text.substring(0, lineStart > 0 ? lineStart : bestEnd);
    }

    /**
     * Heuristic method for removing footer without standard markers
     */
    removeFooterHeuristic(text) {
        const lines = text.split('\n');
        let contentEnd = lines.length;

        // Look backwards for signs of license text
        for (let i = lines.length - 1; i >= Math.max(lines.length - 100, 0); i--) {
            const line = lines[i].trim().toUpperCase();
            
            // Common footer indicators
            if (line.includes('PROJECT GUTENBERG') ||
                line.includes('DISTRIBUTED PROOFREADING') ||
                line.includes('HTTP://WWW.GUTENBERG') ||
                line.includes('DONATIONS') ||
                line.includes('TRADEMARK')) {
                contentEnd = i;
                break;
            }
        }

        console.log(`📍 Heuristic: Content likely ends at line ${contentEnd}`);
        return lines.slice(0, contentEnd).join('\n');
    }

    /**
     * Check if a line looks like metadata
     */
    looksLikeMetadata(line) {
        const upper = line.toUpperCase();
        
        const metadataPatterns = [
            'PROJECT GUTENBERG',
            'TITLE:',
            'AUTHOR:',
            'RELEASE DATE',
            'LANGUAGE:',
            'CHARACTER SET',
            'PRODUCED BY',
            'NOTE:',
            '***',
            'CONTENTS',
            'VOLUME',
        ];

        return metadataPatterns.some(pattern => upper.includes(pattern));
    }

    /**
     * Remove illustration markers and other inline noise
     */
    removeMarkers(text) {
        let cleaned = text;

        for (const pattern of this.removePatterns) {
            cleaned = cleaned.replace(pattern, '');
        }

        return cleaned;
    }

    /**
     * Fix common encoding issues
     */
    fixEncoding(text) {
        let fixed = text;

        for (const { pattern, replace } of this.encodingFixes) {
            fixed = fixed.replace(pattern, replace);
        }

        return fixed;
    }

    /**
     * Normalize whitespace
     */
    normalizeWhitespace(text) {
        return text
            // Normalize line endings
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            // Remove trailing whitespace from each line
            .replace(/[ \t]+$/gm, '')
            // Normalize tabs to spaces
            .replace(/\t/g, '    ');
    }

    /**
     * Remove excessive blank lines (keep max 2)
     */
    removeExcessiveBlankLines(text) {
        return text.replace(/\n{4,}/g, '\n\n\n');
    }

    /**
     * Get line numbers for cleaned text
     * Returns array of line objects with number and content
     */
    getLineNumberedText(cleanedText) {
        const lines = cleanedText.split('\n');
        return lines
            .map((content, index) => ({
                number: index + 1,
                content: content,
                isEmpty: content.trim() === ''
            }))
            .filter(line => !line.isEmpty);  // Remove empty lines
    }

    /**
     * Extract specific line range
     */
    extractLineRange(cleanedText, startLine, endLine) {
        const lines = cleanedText.split('\n');
        
        if (startLine < 1 || endLine > lines.length || startLine > endLine) {
            throw new Error(`Invalid line range: ${startLine}-${endLine} (text has ${lines.length} lines)`);
        }

        return lines.slice(startLine - 1, endLine).join('\n');
    }

    /**
     * Quick clean for preview (less aggressive)
     */
    quickClean(rawText) {
        return this.clean(rawText, {
            fixEncoding: true,
            removeMarkers: false,  // Keep markers for now
            normalizeWhitespace: true,
            removeExcessiveBlankLines: false
        });
    }
}

// Export for use in other modules
window.TextCleaner = TextCleaner;
