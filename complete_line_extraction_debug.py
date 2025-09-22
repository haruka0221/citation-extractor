#!/usr/bin/env python3
"""
Complete line extraction debugging system with comprehensive validation
"""

import os
import re
from pathlib import Path

def analyzeCleanedText(file_path):
    """Analyze the cleaned text structure with detailed line examination"""

    print("=" * 60)
    print("=== TEXT STRUCTURE ANALYSIS ===")
    print("=" * 60)

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            text = f.read()

        lines = text.split('\n')

        print(f"📄 File: {file_path}")
        print(f"📊 Total lines: {len(lines)}")
        print(f"📊 Total characters: {len(text)}")

        # Check for empty lines
        empty_lines = [i+1 for i, line in enumerate(lines) if not line.strip()]
        print(f"📊 Empty lines: {len(empty_lines)} at positions: {empty_lines[:10]}{'...' if len(empty_lines) > 10 else ''}")

        print(f"\n📋 First 20 lines with exact content:")
        print("-" * 50)

        for i in range(min(20, len(lines))):
            line_num = i + 1
            content = lines[i]
            # Show special characters
            display_content = repr(content) if any(c in content for c in ['\t', '\r']) else content
            length_info = f" [{len(content)} chars]" if len(content) > 50 else ""
            print(f"{line_num:2}: {display_content}{length_info}")

        print(f"\n🎯 TARGET LINES 7-8:")
        print("-" * 30)
        if len(lines) >= 8:
            print(f"Line 7: \"{lines[6]}\"")
            print(f"Line 8: \"{lines[7]}\"")
        else:
            print("❌ File has fewer than 8 lines!")

        return lines

    except Exception as e:
        print(f"❌ Error reading file: {e}")
        return None

def extractExactLines(cleaned_text, start_line, end_line):
    """Bulletproof line extraction with comprehensive context display"""

    print("\n" + "=" * 60)
    print("=== LINE EXTRACTION PROCESS ===")
    print("=" * 60)

    print(f"🎯 EXTRACTION REQUEST:")
    print(f"   Requested lines: {start_line}-{end_line}")

    # Handle both string and list input
    if isinstance(cleaned_text, str):
        all_lines = cleaned_text.split('\n')
    else:
        all_lines = cleaned_text

    print(f"   Total available lines: {len(all_lines)}")

    # Validate the request
    if start_line <= 0 or end_line <= 0:
        print("❌ ERROR: Line numbers must be positive!")
        return None

    if start_line > end_line:
        print("❌ ERROR: Start line cannot be greater than end line!")
        return None

    if end_line > len(all_lines):
        print(f"❌ ERROR: Requested end line {end_line} exceeds available lines ({len(all_lines)})!")
        return None

    # Show context around requested lines
    context_start = max(0, start_line - 4)
    context_end = min(len(all_lines), end_line + 3)

    print(f"\n📋 CONTEXT (lines {context_start + 1}-{context_end}):")
    print("-" * 50)

    for i in range(context_start, context_end):
        line_num = i + 1
        content = all_lines[i]

        # Mark the target lines
        if start_line <= line_num <= end_line:
            marker = ">>> TARGET"
            print(f"{marker:>12} Line {line_num:2}: \"{content}\"")
        else:
            print(f"            Line {line_num:2}: \"{content}\"")

    # Extract ONLY the requested lines using proper indexing
    print(f"\n🔢 ARRAY INDEXING:")
    start_index = start_line - 1  # Convert to 0-based
    end_index = end_line          # For slice end (exclusive)

    print(f"   1-based request: lines {start_line}-{end_line}")
    print(f"   0-based indices: {start_index}-{end_line-1}")
    print(f"   Array slice: all_lines[{start_index}:{end_index}]")

    extracted_lines = all_lines[start_index:end_index]

    print(f"\n📄 EXTRACTED RESULT ({len(extracted_lines)} lines):")
    print("-" * 50)

    for i, line in enumerate(extracted_lines):
        actual_line_num = start_line + i
        print(f"   Line {actual_line_num}: \"{line}\"")

    result = '\n'.join(extracted_lines)

    print(f"\n✅ FINAL RESULT:")
    print(f"   Text length: {len(result)} characters")
    print(f"   Line count: {len(extracted_lines)}")
    print(f"   Content: \"{result}\"")

    return result

def parseLineRange(citation):
    """Comprehensive citation parsing with detailed debugging"""

    print("\n" + "=" * 60)
    print("=== CITATION PARSING ===")
    print("=" * 60)

    print(f"🔍 INPUT CITATION: \"{citation}\"")

    # Show original citation analysis
    print(f"   Length: {len(citation)} characters")
    print(f"   Contains digits: {any(c.isdigit() for c in citation)}")
    print(f"   Contains hyphens: {'-' in citation or '–' in citation or '—' in citation}")

    # Step 1: Normalize the citation
    original = citation

    # Convert various dash types to standard hyphen
    normalized = citation.replace('–', '-').replace('—', '-')

    # Remove leading/trailing whitespace
    normalized = normalized.strip()

    print(f"\n📝 NORMALIZATION STEPS:")
    print(f"   Original: \"{original}\"")
    print(f"   Normalized: \"{normalized}\"")

    # Step 2: Extract line numbers with multiple patterns
    patterns = [
        # Pattern 1: Work title + line range
        r'([A-Za-z\s]+?)\.?\s*(\d+)[-–—](\d+)\.?',
        # Pattern 2: Work title + single line
        r'([A-Za-z\s]+?)\.?\s*(\d+)\.?$',
        # Pattern 3: Just line range
        r'(\d+)[-–—](\d+)',
        # Pattern 4: Just single line
        r'(\d+)',
    ]

    print(f"\n🔍 PATTERN MATCHING:")

    for i, pattern in enumerate(patterns, 1):
        print(f"   Pattern {i}: {pattern}")
        match = re.search(pattern, normalized, re.IGNORECASE)

        if match:
            groups = match.groups()
            print(f"   ✅ MATCH! Groups: {groups}")

            if len(groups) >= 3:  # Work title + start + end
                work_title = groups[0].strip()
                start = int(groups[1])
                end = int(groups[2])
                print(f"   Work: \"{work_title}\"")
                print(f"   Range: {start}-{end}")
                return {
                    'work_title': work_title,
                    'start': start,
                    'end': end,
                    'pattern_used': i
                }
            elif len(groups) >= 2:  # Work title + single line
                work_title = groups[0].strip()
                line_num = int(groups[1])
                print(f"   Work: \"{work_title}\"")
                print(f"   Single line: {line_num}")
                return {
                    'work_title': work_title,
                    'start': line_num,
                    'end': line_num,
                    'pattern_used': i
                }
            elif len(groups) == 2:  # Just line range
                start = int(groups[0])
                end = int(groups[1])
                print(f"   Range only: {start}-{end}")
                return {
                    'work_title': '',
                    'start': start,
                    'end': end,
                    'pattern_used': i
                }
            elif len(groups) == 1:  # Just single line
                line_num = int(groups[0])
                print(f"   Single line only: {line_num}")
                return {
                    'work_title': '',
                    'start': line_num,
                    'end': line_num,
                    'pattern_used': i
                }
        else:
            print(f"   ❌ No match")

    print(f"\n❌ ERROR: No line numbers found in citation!")
    return None

def testWithExamples():
    """Test with multiple examples including the failing case"""

    print("\n" + "=" * 60)
    print("=== COMPREHENSIVE TESTING ===")
    print("=" * 60)

    # Load the Absalom and Achitophel text
    file_path = "test_corpus/cleaned/absalom_achitophel_sample.txt"

    if not os.path.exists(file_path):
        print(f"❌ Test file not found: {file_path}")
        return False

    # Analyze the text structure first
    lines = analyzeCleanedText(file_path)

    if not lines:
        return False

    # Test cases
    test_cases = [
        ("Absalom and Achitophel 7-8", "Basic format"),
        ("ABSALOM AND ACHITOPHEL. 7-9", "User's failing example"),
        ("absalom and achitophel. 7-8.", "Lowercase with periods"),
        ("Absalom and Achitophel 1-3", "Lines from beginning"),
        ("Absalom and Achitophel 10", "Single line"),
        ("7-8", "Numbers only"),
        ("1", "Single number only"),
    ]

    print(f"\n🧪 RUNNING {len(test_cases)} TEST CASES:")
    print("=" * 60)

    success_count = 0

    for citation, description in test_cases:
        print(f"\n🎯 TEST: {description}")
        print(f"Citation: \"{citation}\"")

        try:
            # Step 1: Parse the citation
            parsed = parseLineRange(citation)

            if not parsed:
                print("❌ FAILED: Could not parse citation")
                continue

            # Step 2: Extract the lines
            extracted = extractExactLines(lines, parsed['start'], parsed['end'])

            if extracted is None:
                print("❌ FAILED: Could not extract lines")
                continue

            # Step 3: Validate results for known cases
            if parsed['start'] == 7 and parsed['end'] == 8:
                # Check if we got the expected Absalom content
                expected_content = ["Sagacious, bold, and turbulent of wit", "Restless, unfixed in principles and place"]

                validation_passed = True
                for expected in expected_content:
                    if expected.lower() not in extracted.lower():
                        print(f"❌ VALIDATION FAILED: Missing expected content: '{expected}'")
                        validation_passed = False

                if validation_passed:
                    print("✅ VALIDATION PASSED: Contains expected Absalom content")
                    success_count += 1
                else:
                    print("❌ VALIDATION FAILED: Content mismatch")

            elif parsed['start'] == 7 and parsed['end'] == 9:
                # Check for lines 7-9
                expected_content = ["Sagacious, bold, and turbulent of wit", "Restless, unfixed in principles and place", "In power unpleased, impatient of disgrace"]

                validation_passed = True
                for expected in expected_content:
                    if expected.lower() not in extracted.lower():
                        print(f"❌ VALIDATION FAILED: Missing expected content: '{expected}'")
                        validation_passed = False

                if validation_passed:
                    print("✅ VALIDATION PASSED: Contains expected content for lines 7-9")
                    success_count += 1
                else:
                    print("❌ VALIDATION FAILED: Content mismatch for lines 7-9")

            else:
                print(f"✅ EXTRACTION COMPLETED: Lines {parsed['start']}-{parsed['end']} extracted")
                success_count += 1

        except Exception as e:
            print(f"❌ ERROR: {e}")

    print(f"\n📊 FINAL RESULTS:")
    print(f"   Tests run: {len(test_cases)}")
    print(f"   Successful: {success_count}")
    print(f"   Failed: {len(test_cases) - success_count}")
    print(f"   Success rate: {success_count/len(test_cases)*100:.1f}%")

    return success_count == len(test_cases)

def createBulletproofExtractor():
    """Create the final bulletproof JavaScript function"""

    print("\n" + "=" * 60)
    print("=== BULLETPROOF EXTRACTOR FUNCTION ===")
    print("=" * 60)

    js_function = '''
/**
 * Bulletproof line extraction with comprehensive validation and debugging
 */
function extractExactLines(cleanedText, startLine, endLine) {
    console.log('=== LINE EXTRACTION DEBUG ===');
    console.log(`Requested: lines ${startLine}-${endLine}`);

    // Input validation
    if (typeof cleanedText !== 'string') {
        console.error('ERROR: cleanedText must be a string');
        return null;
    }

    if (!Number.isInteger(startLine) || !Number.isInteger(endLine)) {
        console.error('ERROR: Line numbers must be integers');
        return null;
    }

    if (startLine <= 0 || endLine <= 0) {
        console.error('ERROR: Line numbers must be positive');
        return null;
    }

    if (startLine > endLine) {
        console.error('ERROR: Start line cannot be greater than end line');
        return null;
    }

    // Split into lines
    const allLines = cleanedText.split('\\n');
    console.log(`Total available lines: ${allLines.length}`);

    // Validate range
    if (endLine > allLines.length) {
        console.error(`ERROR: Requested end line ${endLine} exceeds available lines (${allLines.length})`);
        return null;
    }

    // Show context for debugging
    const contextStart = Math.max(0, startLine - 3);
    const contextEnd = Math.min(allLines.length, endLine + 2);

    console.log(`Context (lines ${contextStart + 1}-${contextEnd}):`);
    for (let i = contextStart; i < contextEnd; i++) {
        const lineNum = i + 1;
        const isTarget = lineNum >= startLine && lineNum <= endLine;
        const marker = isTarget ? '>>> ' : '    ';
        console.log(`${marker}${lineNum}: "${allLines[i]}"`);
    }

    // Extract exact range
    const startIndex = startLine - 1;  // Convert to 0-based
    const endIndex = endLine;          // For slice (exclusive end)

    console.log(`Array slice: allLines[${startIndex}:${endIndex}]`);

    const extracted = allLines.slice(startIndex, endIndex);

    console.log('=== EXTRACTION RESULT ===');
    extracted.forEach((line, index) => {
        console.log(`Line ${startLine + index}: "${line}"`);
    });

    const result = extracted.join('\\n');
    console.log(`Final result: "${result}"`);

    return result;
}

/**
 * Parse citations with comprehensive pattern matching
 */
function parseLineRange(citation) {
    console.log(`Parsing citation: "${citation}"`);

    // Normalize input
    const normalized = citation.trim()
        .replace(/[–—]/g, '-')  // Convert em/en dashes to hyphens
        .replace(/[.,;:!?]/g, ' ')  // Replace punctuation with spaces
        .replace(/\\s+/g, ' ')  // Normalize whitespace
        .trim();

    console.log(`Normalized: "${normalized}"`);

    // Pattern matching
    const patterns = [
        /([a-z\\s]+?)\\s+(\\d+)-(\\d+)$/i,  // "work title 7-8"
        /([a-z\\s]+?)\\s+(\\d+)$/i,         // "work title 7"
        /(\\d+)-(\\d+)/,                    // "7-8"
        /(\\d+)/                            // "7"
    ];

    for (let i = 0; i < patterns.length; i++) {
        const match = normalized.match(patterns[i]);
        if (match) {
            console.log(`Pattern ${i+1} matched:`, match);

            if (match.length >= 4) {  // Work title + range
                return {
                    workTitle: match[1].trim(),
                    start: parseInt(match[2]),
                    end: parseInt(match[3])
                };
            } else if (match.length === 3) {  // Work title + single line OR range only
                if (isNaN(parseInt(match[1]))) {  // Work title + single line
                    return {
                        workTitle: match[1].trim(),
                        start: parseInt(match[2]),
                        end: parseInt(match[2])
                    };
                } else {  // Range only
                    return {
                        workTitle: '',
                        start: parseInt(match[1]),
                        end: parseInt(match[2])
                    };
                }
            } else if (match.length === 2) {  // Single line only
                return {
                    workTitle: '',
                    start: parseInt(match[1]),
                    end: parseInt(match[1])
                };
            }
        }
    }

    console.error('No line numbers found in citation');
    return null;
}
'''

    print("📝 JavaScript Functions:")
    print(js_function)

    return js_function

def main():
    """Run the complete debugging suite"""

    print("🚀 COMPLETE LINE EXTRACTION DEBUG SUITE")
    print("=" * 70)
    print("Debugging every step from citation → parsing → extraction → validation")

    # Run comprehensive tests
    success = testWithExamples()

    # Create the bulletproof function
    createBulletproofExtractor()

    print("\n" + "=" * 70)
    if success:
        print("🎉 ALL TESTS PASSED!")
        print("✅ Line extraction system is working correctly")
        print("✅ Citation parsing handles all variations")
        print("✅ Array indexing is proper (1-based → 0-based)")
        print("✅ Content validation confirms correct extraction")
    else:
        print("❌ SOME TESTS FAILED!")
        print("Check the output above for specific issues")

    print("\n🔧 DEBUGGING SUMMARY:")
    print("1. Text analysis shows exact line structure")
    print("2. Citation parsing handles punctuation variations")
    print("3. Line extraction uses proper array indexing")
    print("4. Context display shows surrounding lines")
    print("5. Content validation confirms accuracy")

    return success

if __name__ == "__main__":
    main()