/**
 * PATCH: Extended CSV Catalog Integration for UI
 * This code updates the citation-integration.js to use the new ExtendedCSVCatalogSystem
 * 
 * Usage: Add this script AFTER ExtendedCSVCatalogSystem.js and BEFORE citation-integration.js
 */

(function() {
    'use strict';
    
    console.log('🔧 Loading Extended CSV Catalog Integration Patch...');
    
    // Retry limit to prevent infinite loop
    let retryCount = 0;
    const maxRetries = 100; // 50 seconds total (100 * 500ms)
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPatch);
    } else {
        initPatch();
    }
    
    function initPatch() {
        // Check retry limit
        if (retryCount >= maxRetries) {
            console.error('❌ CitationIntegration not found after', maxRetries, 'retries');
            console.error('   Make sure citation-integration.js is loaded and exports CitationIntegration class');
            return;
        }
        
        retryCount++;
        
        // Override the CitationIntegration class methods to use ExtendedCSVCatalog
        const originalCitationIntegration = window.CitationIntegration;
        
        if (!originalCitationIntegration) {
            if (retryCount % 10 === 0) { // Log every 5 seconds
                console.warn(`⚠️ CitationIntegration not found, will retry... (attempt ${retryCount}/${maxRetries})`);
            }
            setTimeout(initPatch, 500);
            return;
        }
        
        console.log('✅ Patching CitationIntegration class...');
        
        // Override the initializeCitationEngine method
        const originalInit = originalCitationIntegration.prototype.initializeCitationEngine;
        
        originalCitationIntegration.prototype.initializeCitationEngine = async function() {
            try {
                console.log('🚀 Initializing EXTENDED citation engine (patched)...');
                
                // Priority 1: Use ExtendedCSVCatalogSystem if available
                if (window.globalExtendedCSVCatalog && window.globalExtendedCSVCatalog.initialized) {
                    console.log('✅ Using existing Extended CSV Catalog');
                    this.extendedCatalog = window.globalExtendedCSVCatalog;
                    this.csvCatalog = window.globalExtendedCSVCatalog; // For compatibility
                } else if (window.initializeExtendedCSVCatalogSystem) {
                    console.log('📥 Initializing Extended CSV Catalog System...');
                    this.extendedCatalog = await window.initializeExtendedCSVCatalogSystem();
                    this.csvCatalog = this.extendedCatalog; // For compatibility
                    console.log('✅ Extended CSV catalog system initialized');
                    
                    const stats = this.extendedCatalog.getCatalogStats();
                    console.log('📊 Extended CSV catalog stats:', stats);
                } else {
                    // Fallback to original initialization
                    console.log('⚠️ Extended CSV system not available, using original method');
                    return await originalInit.call(this);
                }
                
                // Initialize full-text viewer
                if (window.FullTextViewer) {
                    this.fullTextViewer = new window.FullTextViewer();
                    console.log('✅ Full-text viewer initialized');
                } else {
                    console.warn('⚠️ FullTextViewer not available');
                }
                
                // Wait for main app
                this.waitForMainApp();
                
            } catch (error) {
                console.error('❌ Failed to initialize extended citation engine:', error);
                // Fallback to original
                return await originalInit.call(this);
            }
        };
        
        // Override generateMockCandidates to use Extended catalog
        const originalGenerateMock = originalCitationIntegration.prototype.generateMockCandidates;
        
        originalCitationIntegration.prototype.generateMockCandidates = async function(citationText) {
            console.log('🔧 Generating candidates with EXTENDED catalog (patched)');
            
            try {
                // Priority 1: Use ExtendedCSVCatalog
                if (this.extendedCatalog && this.extendedCatalog.initialized) {
                    return await this.generateCandidatesWithExtendedCatalog(citationText);
                }
                // Priority 2: Use csvCatalog (might be Extended)
                else if (this.csvCatalog && this.csvCatalog.initialized) {
                    return await this.generateCandidatesWithCSVCatalog(citationText);
                }
                // Fallback to original method
                else {
                    console.warn('⚠️ No extended catalog, using original method');
                    return await originalGenerateMock.call(this, citationText);
                }
            } catch (error) {
                console.error('❌ Error in patched generateMockCandidates:', error);
                return await originalGenerateMock.call(this, citationText);
            }
        };
        
        // Add new method: generateCandidatesWithExtendedCatalog
        originalCitationIntegration.prototype.generateCandidatesWithExtendedCatalog = async function(citationText) {
            console.log('📊 Using EXTENDED CSV catalog for candidate generation');
            
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
                lineRange = { start: 1, end: 20 }; // Default preview
                console.log(`🔍 Fallback search: "${searchTerm}" (default preview)`);
            }
            
            // Search for matching works using Extended CSV catalog
            const catalog = this.extendedCatalog || this.csvCatalog;
            const matches = catalog.findWorkFiles(searchTerm, { maxResults: 10 });
            
            console.log(`📊 Extended CSV catalog found ${matches.length} matches`);
            
            if (matches.length === 0) {
                console.log('⚠️ No matches found, returning empty array');
                return [];
            }
            
            const candidates = [];
            
            for (const match of matches) {
                try {
                    console.log(`🔍 Extracting text from PG ${match.pgId}: ${match.title}`);
                    
                    // Extract text from the matched work
                    const text = await catalog.extractText(match, lineRange);
                    
                    if (!text || text.trim().length === 0) {
                        console.warn(`⚠️ Empty text extracted from PG ${match.pgId}`);
                        continue;
                    }
                    
                    candidates.push({
                        source: `gutenberg:pg${match.pgId}`,
                        confidence: match.confidence || 0.8,
                        text: text,
                        metadata: {
                            lines: lineRange ? `${lineRange.start}-${lineRange.end}` : 'preview',
                            author: match.author,
                            title: match.title,
                            source_file: `pg${match.pgId}.txt`,
                            pgId: match.pgId,
                            language: match.language,
                            matchType: match.matchType || 'fuzzy',
                            confidence: match.confidence || 0.8,
                            disambiguator: `${match.author} - ${match.title}`,
                            searchTerm: searchTerm,
                            matchedKey: match.matchedKey || searchTerm,
                            catalogSource: 'extended_csv_catalog'
                        },
                        type: 'literature'
                    });
                    
                    console.log(`✅ Added candidate: PG ${match.pgId}`);
                    
                } catch (error) {
                    console.error(`❌ Failed to extract text from PG ${match.pgId}:`, error);
                }
            }
            
            // Add biblical candidates if appropriate
            if (this.isBiblicalCitation && this.isBiblicalCitation(citationText)) {
                const biblicalCandidates = this.generateBiblicalCandidates(citationText);
                if (biblicalCandidates && biblicalCandidates.length > 0) {
                    candidates.push(...biblicalCandidates);
                }
            }
            
            console.log(`✅ Extended CSV catalog generated ${candidates.length} candidates`);
            return candidates;
        };
        
        console.log('✅ CitationIntegration patch applied successfully!');
    }
    
})();