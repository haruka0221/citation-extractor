/**
 * System Diagnostics Tool
 * Run this in browser console to check what's working
 */

async function diagnoseSystem() {
    console.log('🔍 System Diagnostics Starting...\n');
    console.log('═'.repeat(60));

    const results = {
        passed: [],
        failed: [],
        warnings: []
    };

    // Check 1: Script files loaded
    console.log('\n📦 Step 1: Checking if scripts are loaded...');
    
    const requiredClasses = [
        'GutenbergMirrorLoader',
        'TextCleaner',
        'CacheManager',
        'OnDemandTextLoader',
        'ExtendedCSVCatalogSystem'
    ];

    requiredClasses.forEach(className => {
        if (window[className]) {
            console.log(`  ✅ ${className} loaded`);
            results.passed.push(`${className} loaded`);
        } else {
            console.log(`  ❌ ${className} NOT loaded`);
            results.failed.push(`${className} NOT loaded`);
        }
    });

    // Check 2: Global instances
    console.log('\n🌐 Step 2: Checking global instances...');
    
    if (window.globalExtendedCSVCatalog) {
        console.log('  ✅ globalExtendedCSVCatalog exists');
        console.log('     Initialized:', window.globalExtendedCSVCatalog.initialized);
        results.passed.push('globalExtendedCSVCatalog exists');
    } else {
        console.log('  ❌ globalExtendedCSVCatalog NOT found');
        results.failed.push('globalExtendedCSVCatalog NOT found');
    }

    if (window.globalTextLoader) {
        console.log('  ✅ globalTextLoader exists');
        console.log('     Initialized:', window.globalTextLoader.initialized);
        results.passed.push('globalTextLoader exists');
    } else {
        console.log('  ❌ globalTextLoader NOT found');
        results.failed.push('globalTextLoader NOT found');
    }

    // Check 3: Configuration
    console.log('\n⚙️  Step 3: Checking configuration...');
    
    if (window.GutenbergConfig) {
        console.log('  ✅ GutenbergConfig loaded');
        console.log('     Mirror path:', window.GutenbergConfig.mirrorBasePath);
        console.log('     Catalog path:', window.GutenbergConfig.catalogCsvPath);
        results.passed.push('GutenbergConfig loaded');
    } else {
        console.log('  ⚠️  GutenbergConfig NOT found (using defaults)');
        results.warnings.push('GutenbergConfig NOT found');
    }

    // Check 4: Catalog data
    console.log('\n📚 Step 4: Checking catalog data...');
    
    if (window.globalExtendedCSVCatalog && window.globalExtendedCSVCatalog.csvCatalog) {
        const catalogSize = Object.keys(window.globalExtendedCSVCatalog.csvCatalog).length;
        console.log(`  ✅ Catalog loaded: ${catalogSize} works`);
        results.passed.push(`Catalog loaded: ${catalogSize} works`);

        // Check for specific works
        const testWorks = ['20', '26', '100', '1342'];
        testWorks.forEach(pgId => {
            const work = window.globalExtendedCSVCatalog.csvCatalog[pgId];
            if (work) {
                console.log(`     ✅ PG ${pgId}: ${work.title}`);
            } else {
                console.log(`     ❌ PG ${pgId}: NOT found`);
            }
        });
    } else {
        console.log('  ❌ Catalog data NOT loaded');
        results.failed.push('Catalog data NOT loaded');
    }

    // Check 5: Search index
    console.log('\n🔍 Step 5: Checking search index...');
    
    if (window.globalExtendedCSVCatalog && window.globalExtendedCSVCatalog.searchIndex) {
        const indexSize = Object.keys(window.globalExtendedCSVCatalog.searchIndex).length;
        console.log(`  ✅ Search index built: ${indexSize} keys`);
        results.passed.push(`Search index: ${indexSize} keys`);

        // Show sample search keys
        const sampleKeys = Object.keys(window.globalExtendedCSVCatalog.searchIndex).slice(0, 5);
        console.log('     Sample keys:', sampleKeys.join(', '));
    } else {
        console.log('  ❌ Search index NOT built');
        results.failed.push('Search index NOT built');
    }

    // Check 6: Try a test search
    console.log('\n🔎 Step 6: Testing search functionality...');
    
    if (window.globalExtendedCSVCatalog && window.globalExtendedCSVCatalog.initialized) {
        try {
            const results1 = window.globalExtendedCSVCatalog.findWorkFiles('paradise lost');
            console.log(`  ✅ Search "paradise lost": ${results1.length} results`);
            if (results1.length > 0) {
                console.log(`     First result: PG ${results1[0].pgId} - ${results1[0].title}`);
            }

            const results2 = window.globalExtendedCSVCatalog.findWorkFiles('donne');
            console.log(`  📖 Search "donne": ${results2.length} results`);
            if (results2.length > 0) {
                results2.slice(0, 3).forEach(r => {
                    console.log(`     - PG ${r.pgId}: ${r.title} by ${r.author}`);
                });
            }
        } catch (error) {
            console.log('  ❌ Search failed:', error.message);
            results.failed.push('Search test failed');
        }
    } else {
        console.log('  ⚠️  Cannot test search - system not initialized');
        results.warnings.push('Search test skipped');
    }

    // Summary
    console.log('\n' + '═'.repeat(60));
    console.log('📊 DIAGNOSTIC SUMMARY');
    console.log('═'.repeat(60));
    console.log(`✅ Passed: ${results.passed.length}`);
    console.log(`❌ Failed: ${results.failed.length}`);
    console.log(`⚠️  Warnings: ${results.warnings.length}`);

    if (results.failed.length === 0) {
        console.log('\n🎉 System is working correctly!');
    } else {
        console.log('\n❌ System has issues. Failed checks:');
        results.failed.forEach(f => console.log(`   - ${f}`));
    }

    return {
        passed: results.passed.length,
        failed: results.failed.length,
        warnings: results.warnings.length,
        allPassed: results.failed.length === 0
    };
}

// Quick initialization helper
async function quickInit() {
    console.log('🚀 Quick Initialization...\n');

    try {
        // Check if already initialized
        if (window.globalExtendedCSVCatalog && window.globalExtendedCSVCatalog.initialized) {
            console.log('✅ System already initialized!');
            return true;
        }

        // Try to initialize
        if (window.initializeExtendedCSVCatalogSystem) {
            console.log('📥 Initializing Extended CSV Catalog System...');
            // CRITICAL: Assign the returned catalog to the global variable
            window.globalExtendedCSVCatalog = await window.initializeExtendedCSVCatalogSystem();
            console.log('✅ Initialization complete!');
            
            // Verify it worked
            if (window.globalExtendedCSVCatalog && window.globalExtendedCSVCatalog.initialized) {
                console.log('✅ Global catalog variable set successfully!');
                console.log(`📚 ${Object.keys(window.globalExtendedCSVCatalog.csvCatalog).length} works available`);
                return true;
            } else {
                console.log('❌ Failed to set global catalog variable');
                return false;
            }
        } else {
            console.log('❌ initializeExtendedCSVCatalogSystem not found');
            console.log('   Make sure all script files are loaded in index.html');
            return false;
        }
    } catch (error) {
        console.error('❌ Initialization failed:', error);
        return false;
    }
}

// Quick search helper
function quickSearch(searchTerm) {
    console.log(`🔍 Searching for: "${searchTerm}"\n`);

    // Check for the new Extended CSV Catalog (priority)
    const catalog = window.globalExtendedCSVCatalog || window.globalCSVCatalog;
    
    if (!catalog) {
        console.log('❌ System not initialized. Run: await quickInit()');
        return [];
    }

    // Additional check: make sure it's actually initialized
    if (!catalog.initialized && !catalog.searchIndex) {
        console.log('❌ Catalog not fully initialized. Run: await quickInit()');
        return [];
    }

    const results = catalog.findWorkFiles(searchTerm);
    
    console.log(`📊 Found ${results.length} results:\n`);
    results.slice(0, 10).forEach((r, i) => {
        console.log(`${i + 1}. PG ${r.pgId}: ${r.title}`);
        console.log(`   Author: ${r.author}`);
        console.log(`   Match: ${r.matchType} (${(r.confidence * 100).toFixed(0)}%)\n`);
    });

    if (results.length > 10) {
        console.log(`... and ${results.length - 10} more results`);
    }

    return results;
}

// Export to window
window.diagnoseSystem = diagnoseSystem;
window.quickInit = quickInit;
window.quickSearch = quickSearch;

console.log('🔧 Diagnostic tools loaded!');
console.log('\nAvailable commands:');
console.log('  diagnoseSystem()     - Run full system diagnostics');
console.log('  quickInit()          - Initialize the system');
console.log('  quickSearch("text")  - Search for works');
console.log('\nExample: quickSearch("donne")');