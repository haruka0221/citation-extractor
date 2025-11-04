/**
 * Test Suite for On-Demand Gutenberg Text Loading System
 * Run this in browser console after loading the page
 */

class OnDemandSystemTester {
    constructor() {
        this.results = {
            passed: 0,
            failed: 0,
            tests: []
        };
    }

    /**
     * Run all tests
     */
    async runAllTests() {
        console.log('🧪 Starting On-Demand System Test Suite...\n');
        console.log('═'.repeat(60));

        try {
            await this.testMirrorLoader();
            await this.testTextCleaner();
            await this.testCacheManager();
            await this.testOnDemandLoader();
            await this.testExtendedCatalog();
            await this.testEndToEnd();

            this.printResults();
        } catch (error) {
            console.error('❌ Test suite failed:', error);
        }
    }

    /**
     * Test GutenbergMirrorLoader
     */
    async testMirrorLoader() {
        console.log('\n📚 Test 1: GutenbergMirrorLoader');
        console.log('─'.repeat(60));

        try {
            const loader = new GutenbergMirrorLoader();

            // Test 1.1: Path generation
            const paths = loader.getPossiblePaths(20);
            this.assert(paths.length > 0, 'Generate paths for PG 20', paths.length);

            // Test 1.2: Load a real work
            console.log('  Loading Paradise Lost (PG 20)...');
            const rawText = await loader.loadRawText(20);
            this.assert(rawText.length > 10000, 'Load Paradise Lost', `${rawText.length} chars`);

            // Test 1.3: Validation
            const isValid = loader.validateGutenbergText(rawText, 20);
            this.assert(isValid, 'Validate Gutenberg format', isValid);

            // Test 1.4: Cache hit
            const cached = await loader.loadRawText(20);
            this.assert(cached === rawText, 'Cache hit test', 'Same text');

            console.log('  ✅ GutenbergMirrorLoader tests passed');

        } catch (error) {
            this.fail('GutenbergMirrorLoader', error.message);
        }
    }

    /**
     * Test TextCleaner
     */
    async testTextCleaner() {
        console.log('\n🧹 Test 2: TextCleaner');
        console.log('─'.repeat(60));

        try {
            const cleaner = new TextCleaner();
            const loader = new GutenbergMirrorLoader();

            // Load a raw text
            const rawText = await loader.loadRawText(20);
            console.log(`  Raw text length: ${rawText.length} chars`);

            // Test 2.1: Basic cleaning
            const cleaned = cleaner.clean(rawText);
            this.assert(cleaned.length < rawText.length, 'Text cleaning reduces size', 
                       `${rawText.length} → ${cleaned.length}`);

            // Test 2.2: Header removal
            const hasHeader = cleaned.includes('Project Gutenberg');
            this.assert(!hasHeader, 'Remove header', 'No PG license in cleaned text');

            // Test 2.3: Line numbering
            const numberedLines = cleaner.getLineNumberedText(cleaned);
            this.assert(numberedLines.length > 0, 'Get numbered lines', numberedLines.length);

            // Test 2.4: Line range extraction
            const excerpt = cleaner.extractLineRange(cleaned, 1, 10);
            const excerptLines = excerpt.split('\n').length;
            this.assert(excerptLines === 10, 'Extract line range 1-10', `${excerptLines} lines`);

            console.log('  ✅ TextCleaner tests passed');

        } catch (error) {
            this.fail('TextCleaner', error.message);
        }
    }

    /**
     * Test CacheManager
     */
    async testCacheManager() {
        console.log('\n🗄️ Test 3: CacheManager');
        console.log('─'.repeat(60));

        try {
            const cache = new CacheManager('TestDB', 1);
            await cache.initialize();

            // Test 3.1: Store and retrieve
            const testText = 'This is a test text for caching';
            await cache.set('test_1', testText);
            const retrieved = await cache.get('test_1');
            this.assert(retrieved === testText, 'Store and retrieve', 'Match');

            // Test 3.2: Cache miss
            const missing = await cache.get('nonexistent');
            this.assert(missing === null, 'Cache miss', 'null');

            // Test 3.3: Statistics
            const stats = await cache.getStats();
            this.assert(stats.count >= 1, 'Get cache stats', `${stats.count} entries`);

            // Test 3.4: Delete
            await cache.delete('test_1');
            const deleted = await cache.get('test_1');
            this.assert(deleted === null, 'Delete entry', 'Entry removed');

            console.log('  ✅ CacheManager tests passed');

        } catch (error) {
            this.fail('CacheManager', error.message);
        }
    }

    /**
     * Test OnDemandTextLoader
     */
    async testOnDemandLoader() {
        console.log('\n📥 Test 4: OnDemandTextLoader');
        console.log('─'.repeat(60));

        try {
            const loader = new OnDemandTextLoader();
            await loader.initialize();

            // Test 4.1: Load a work
            console.log('  Loading Pride and Prejudice (PG 1342)...');
            const result1 = await loader.loadWork(1342);
            this.assert(result1.text.length > 1000, 'Load work', 
                       `${result1.text.length} chars, ${result1.source}`);

            // Test 4.2: Cache hit
            const result2 = await loader.loadWork(1342);
            this.assert(result2.source === 'cache', 'Cache hit on second load', result2.source);

            // Test 4.3: Line range extraction
            const excerpt = await loader.extractLineRange(1342, 1, 20);
            this.assert(excerpt.text.length > 0, 'Extract line range', 
                       `${excerpt.text.split('\n').length} lines`);

            // Test 4.4: Multiple works in parallel
            const results = await loader.loadMultipleWorks([20, 84, 11]);
            const successful = results.filter(r => r.status === 'fulfilled').length;
            this.assert(successful === 3, 'Load multiple works', `${successful}/3 loaded`);

            // Test 4.5: Statistics
            const stats = await loader.getStats();
            this.assert(stats.totalRequests > 0, 'Get loader stats', 
                       `${stats.totalRequests} requests, ${stats.cacheHitRate}% hit rate`);

            console.log('  ✅ OnDemandTextLoader tests passed');

        } catch (error) {
            this.fail('OnDemandTextLoader', error.message);
        }
    }

    /**
     * Test ExtendedCSVCatalogSystem
     */
    async testExtendedCatalog() {
        console.log('\n📚 Test 5: ExtendedCSVCatalogSystem');
        console.log('─'.repeat(60));

        try {
            const catalog = new ExtendedCSVCatalogSystem();
            await catalog.initialize();

            // Test 5.1: Catalog loaded
            const stats = catalog.getCatalogStats();
            this.assert(stats.totalCatalogWorks > 1000, 'Load catalog', 
                       `${stats.totalCatalogWorks} works`);

            // Test 5.2: Search for works
            const results = catalog.findWorkFiles('paradise lost');
            this.assert(results.length > 0, 'Search for "paradise lost"', 
                       `${results.length} results`);

            // Test 5.3: Get work by PG ID
            const work = catalog.getWorkByPgId('20');
            this.assert(work !== null, 'Get work by PG ID', work ? work.title : 'null');

            // Test 5.4: Extract text
            console.log('  Extracting text from a work...');
            const text = await catalog.extractText(results[0], { start: 1, end: 10 });
            this.assert(text.length > 0, 'Extract text from work', `${text.length} chars`);

            console.log('  ✅ ExtendedCSVCatalogSystem tests passed');

        } catch (error) {
            this.fail('ExtendedCSVCatalogSystem', error.message);
        }
    }

    /**
     * End-to-end integration test
     */
    async testEndToEnd() {
        console.log('\n🎯 Test 6: End-to-End Integration');
        console.log('─'.repeat(60));

        try {
            // Test complete workflow: Search → Load → Extract
            const catalog = window.globalExtendedCSVCatalog || 
                          new ExtendedCSVCatalogSystem();
            
            if (!catalog.initialized) {
                await catalog.initialize();
            }

            // Step 1: Search for a work
            console.log('  Step 1: Searching for "Frankenstein"...');
            const searchResults = catalog.findWorkFiles('frankenstein');
            this.assert(searchResults.length > 0, 'Search step', `${searchResults.length} results`);

            // Step 2: Load the work
            console.log('  Step 2: Loading the work...');
            const work = searchResults[0];
            const text = await catalog.getFullText(work.pgId);
            this.assert(text.length > 1000, 'Load step', `${text.length} chars`);

            // Step 3: Search within work
            console.log('  Step 3: Searching within work...');
            const matches = await catalog.searchWithinWork(work.pgId, 'monster');
            this.assert(matches.totalMatches > 0, 'Search within work', 
                       `${matches.totalMatches} matches`);

            // Step 4: Extract line range
            console.log('  Step 4: Extracting line range...');
            const excerpt = await catalog.extractText(work, { start: 1, end: 50 });
            this.assert(excerpt.split('\n').length <= 50, 'Extract range', 
                       `${excerpt.split('\n').length} lines`);

            console.log('  ✅ End-to-end integration test passed');

        } catch (error) {
            this.fail('End-to-end integration', error.message);
        }
    }

    /**
     * Helper: Assert
     */
    assert(condition, testName, details) {
        if (condition) {
            this.results.passed++;
            this.results.tests.push({ name: testName, status: 'PASS', details });
            console.log(`  ✅ ${testName}: ${details}`);
        } else {
            this.results.failed++;
            this.results.tests.push({ name: testName, status: 'FAIL', details });
            console.log(`  ❌ ${testName}: ${details}`);
        }
    }

    /**
     * Helper: Fail
     */
    fail(testName, error) {
        this.results.failed++;
        this.results.tests.push({ name: testName, status: 'ERROR', error });
        console.log(`  ❌ ${testName} failed: ${error}`);
    }

    /**
     * Print final results
     */
    printResults() {
        console.log('\n' + '═'.repeat(60));
        console.log('📊 Test Results Summary');
        console.log('═'.repeat(60));
        console.log(`✅ Passed: ${this.results.passed}`);
        console.log(`❌ Failed: ${this.results.failed}`);
        console.log(`📈 Total: ${this.results.passed + this.results.failed}`);
        console.log(`📊 Success Rate: ${((this.results.passed / (this.results.passed + this.results.failed)) * 100).toFixed(1)}%`);
        console.log('═'.repeat(60));

        if (this.results.failed === 0) {
            console.log('🎉 All tests passed! System is ready.');
        } else {
            console.log('⚠️ Some tests failed. Review errors above.');
        }
    }
}

// Export for browser console use
window.OnDemandSystemTester = OnDemandSystemTester;

// Quick run function
window.testOnDemandSystem = async function() {
    const tester = new OnDemandSystemTester();
    await tester.runAllTests();
};

console.log('🧪 Test suite loaded. Run: testOnDemandSystem()');
