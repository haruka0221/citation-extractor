/**
 * Citation Integration Module - Updated for Phase 1
 * Now uses ExtendedCSVCatalogSystem with on-demand loading
 */

// Add initialization code at the end of existing citation-integration.js

/**
 * Enhanced initialization for Phase 1 system
 */
async function enhancedCitationEngineInit() {
    console.log('🚀 Starting Enhanced Citation Engine (Phase 1)...');

    try {
        // Priority 1: Try Extended CSV Catalog System (88,000 works)
        if (window.ExtendedCSVCatalogSystem && window.initializeExtendedCSVCatalogSystem) {
            console.log('📚 Initializing Extended CSV Catalog System...');
            window.globalExtendedCSVCatalog = await window.initializeExtendedCSVCatalogSystem();
            console.log('✅ Extended CSV Catalog System ready!');
            
            const stats = window.globalExtendedCSVCatalog.getCatalogStats();
            console.log(`📊 Loaded ${stats.totalCatalogWorks} works with ${stats.totalSearchKeys} search keys`);
            
            return true;
        }
        
        // Fallback: Try old CSV Catalog System (5 works)
        if (window.CSVCatalogSystem && window.initializeCSVCatalogSystem) {
            console.log('⚠️ Extended system not found, using legacy CSV catalog...');
            window.globalCSVCatalog = await window.initializeCSVCatalogSystem();
            console.log('✅ Legacy CSV Catalog System ready');
            return true;
        }
        
        console.warn('❌ No catalog system found!');
        return false;
        
    } catch (error) {
        console.error('❌ Failed to initialize citation engine:', error);
        return false;
    }
}

/**
 * Get active catalog (new or old system)
 */
function getActiveCatalog() {
    return window.globalExtendedCSVCatalog || window.globalCSVCatalog || null;
}

/**
 * Enhanced citation lookup using new system
 */
async function enhancedCitationLookup(citationText) {
    console.log('🔍 Enhanced Citation Lookup:', citationText);
    
    const catalog = getActiveCatalog();
    
    if (!catalog) {
        console.error('❌ No catalog system available');
        throw new Error('Catalog system not initialized');
    }
    
    try {
        // Extract author/title from citation text
        const searchTerms = extractSearchTerms(citationText);
        console.log('📝 Extracted search terms:', searchTerms);
        
        // Search for works
        let results = [];
        for (const term of searchTerms) {
            const found = catalog.findWorkFiles(term, { maxResults: 5 });
            results.push(...found);
        }
        
        // Remove duplicates
        results = removeDuplicates(results);
        
        console.log(`📊 Found ${results.length} potential sources`);
        
        // Load full text for top results
        const enrichedResults = await enrichResults(results.slice(0, 5));
        
        return enrichedResults;
        
    } catch (error) {
        console.error('❌ Citation lookup failed:', error);
        throw error;
    }
}

/**
 * Extract search terms from citation text
 */
function extractSearchTerms(citationText) {
    const terms = [];
    
    // Remove common citation markers
    let cleaned = citationText
        .replace(/\(.*?\)/g, '')  // Remove parentheses
        .replace(/\[.*?\]/g, '')  // Remove brackets
        .replace(/\d+/g, '')      // Remove numbers
        .replace(/[.,;:]/g, ' ')  // Replace punctuation with space
        .trim();
    
    // Extract words (minimum 3 characters)
    const words = cleaned.split(/\s+/).filter(w => w.length >= 3);
    
    // Add full cleaned text
    if (cleaned.length > 0) {
        terms.push(cleaned);
    }
    
    // Add individual significant words
    words.forEach(word => {
        if (!['the', 'and', 'from', 'with', 'for'].includes(word.toLowerCase())) {
            terms.push(word);
        }
    });
    
    // If citation looks like "Author Name"
    if (words.length >= 2) {
        terms.push(words.slice(0, 2).join(' '));  // First two words
    }
    
    return [...new Set(terms)];  // Remove duplicates
}

/**
 * Remove duplicate results
 */
function removeDuplicates(results) {
    const seen = new Set();
    return results.filter(r => {
        if (seen.has(r.pgId)) {
            return false;
        }
        seen.add(r.pgId);
        return true;
    });
}

/**
 * Enrich results with full text preview
 */
async function enrichResults(results) {
    const catalog = getActiveCatalog();
    
    if (!catalog) {
        return results;
    }
    
    const enriched = [];
    
    for (const result of results) {
        try {
            // Get text preview (first 500 characters)
            const preview = await catalog.extractText(result, { start: 1, end: 20 });
            
            enriched.push({
                ...result,
                preview: preview.substring(0, 500),
                hasFullText: true
            });
        } catch (error) {
            console.warn(`⚠️ Could not load preview for PG ${result.pgId}:`, error.message);
            enriched.push({
                ...result,
                preview: '(Preview not available)',
                hasFullText: false
            });
        }
    }
    
    return enriched;
}

/**
 * Initialize on page load
 */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => enhancedCitationEngineInit(), 1000);
    });
} else {
    setTimeout(() => enhancedCitationEngineInit(), 1000);
}

// Export functions
window.enhancedCitationEngineInit = enhancedCitationEngineInit;
window.enhancedCitationLookup = enhancedCitationLookup;
window.getActiveCatalog = getActiveCatalog;

console.log('✅ Enhanced Citation Integration loaded');
