/**
 * Extract specific line range from cleaned text with proper 1-based to 0-based conversion
 *
 * @param {string} cleanedText - The cleaned text content
 * @param {number} startLine - Starting line number (1-based)
 * @param {number} endLine - Ending line number (1-based, inclusive)
 * @returns {string} The extracted lines joined with newlines
 */
function extractLineRange(cleanedText, startLine, endLine) {
    // Split text into lines and filter out empty lines
    const lines = cleanedText.split('\n').filter(line => line.trim() !== '');

    // Validate input
    if (startLine <= 0 || endLine <= 0 || startLine > endLine) {
        console.error(`Invalid line range: ${startLine}-${endLine}`);
        return '';
    }

    if (endLine > lines.length) {
        console.error(`Line range ${startLine}-${endLine} exceeds text length (${lines.length} lines)`);
        return '';
    }

    // Convert 1-based line numbers to 0-based array indices
    const startIndex = startLine - 1;
    const endIndex = endLine - 1;

    // Extract the specified range (inclusive of both start and end)
    const extractedLines = lines.slice(startIndex, endIndex + 1);

    console.log(`Extracting lines ${startLine}-${endLine}:`, extractedLines);
    console.log(`Array indices used: [${startIndex}:${endIndex + 1}]`);
    console.log(`Result: ${extractedLines.length} lines extracted`);

    return extractedLines.join('\n');
}

/**
 * Test the extractLineRange function with sample data
 */
function testExtractLineRange() {
    console.log('🧪 Testing extractLineRange function');

    const sampleText = `Absalom and Achitophel
By John Dryden

Of these the false Achitophel was first,
A name to all succeeding ages curst.
For close designs and crooked counsels fit,
Sagacious, bold, and turbulent of wit,
Restless, unfixed in principles and place,
In power unpleased, impatient of disgrace;
A fiery soul, which working out its way,`;

    // Test case: Extract lines 7-8 (the specific example from the issue)
    console.log('\n📋 Test case: "Absalom and Achitophel 7-8"');
    const result = extractLineRange(sampleText, 7, 8);

    console.log('Expected:');
    console.log('  Line 7: "Sagacious, bold, and turbulent of wit,"');
    console.log('  Line 8: "Restless, unfixed in principles and place,"');

    console.log('\nActual result:');
    console.log(`"${result}"`);

    // Verify the result
    const expectedLines = [
        'Sagacious, bold, and turbulent of wit,',
        'Restless, unfixed in principles and place,'
    ];

    const actualLines = result.split('\n');

    let testPassed = true;
    if (actualLines.length === expectedLines.length) {
        for (let i = 0; i < expectedLines.length; i++) {
            if (actualLines[i] !== expectedLines[i]) {
                testPassed = false;
                break;
            }
        }
    } else {
        testPassed = false;
    }

    console.log(`\n${testPassed ? '✅' : '❌'} Test ${testPassed ? 'PASSED' : 'FAILED'}`);

    return testPassed;
}

/**
 * Demonstration of the indexing conversion
 */
function demonstrateIndexing() {
    console.log('\n🔍 Indexing Conversion Demonstration');
    console.log('=====================================');

    const examples = [
        { start: 1, end: 1, desc: 'Single line (first)' },
        { start: 7, end: 8, desc: 'Lines 7-8 (our target)' },
        { start: 10, end: 12, desc: 'Range 10-12' }
    ];

    examples.forEach(({ start, end, desc }) => {
        const startIndex = start - 1;
        const endIndex = end - 1;

        console.log(`\n📌 ${desc}:`);
        console.log(`   1-based range: ${start}-${end}`);
        console.log(`   0-based indices: ${startIndex}-${endIndex}`);
        console.log(`   Array slice: array.slice(${startIndex}, ${endIndex + 1})`);
        console.log(`   Lines included: ${end - start + 1}`);
    });
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { extractLineRange, testExtractLineRange, demonstrateIndexing };
}

// Run tests if this file is executed directly
if (typeof window === 'undefined' && typeof module !== 'undefined') {
    // Node.js environment
    console.log('🚀 Running extractLineRange tests in Node.js');
    demonstrateIndexing();
    testExtractLineRange();
} else if (typeof window !== 'undefined') {
    // Browser environment
    console.log('🌐 extractLineRange function loaded in browser');
    // Optionally run tests
    // demonstrateIndexing();
    // testExtractLineRange();
}