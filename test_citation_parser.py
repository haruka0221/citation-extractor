#!/usr/bin/env python3
"""
Comprehensive test suite for the citation parser
"""

from citation_parser import CitationParser
import json

def test_comprehensive_citations():
    """Test parser with comprehensive citation examples"""

    parser = CitationParser()

    # Test cases organized by category
    test_cases = {
        'Biblical Citations': [
            "Genesis 1:1-3",
            "Matt 5:3-12",
            "Romans 8:28; 1 Cor 13:4-7",
            "1 John 4:8",
            "2 Timothy 3:16-17",
            "Psalm 23:1-6",
            "Isaiah 53:5; John 3:16",
            "Rev 21:4"
        ],

        'Literary Citations - Simple': [
            "Absalom and Achitophel 1-10",
            "The Waste Land 430-433",
            "Beowulf 1-50"
        ],

        'Literary Citations - Books': [
            "Paradise Lost Book I, 1-26",
            "Paradise Lost Book IX, 1033-1045",
            "The Faerie Queene Book 1, 1-10",
            "Don Juan Canto I, 1-20"
        ],

        'Literary Citations - Drama': [
            "Hamlet Act 3 Scene 1, 56-88",
            "King Lear Act 4 Scene 1, 1-25",
            "Macbeth Act 5 Scene 5, 17-28"
        ],

        'Mixed Citations': [
            "cf. Genesis 3:15; Paradise Lost IX.1033-1045",
            "cf. Romans 5:12; Paradise Lost Book I, 1-26",
            "cf. Psalm 23:1; The Waste Land 430-433"
        ],

        'Edge Cases': [
            "1 Chronicles 29:11",
            "Song of Solomon 2:1",
            "3 John 1:2",
            "Paradise Lost Book XII, 646-649",
            "Hamlet Act 1 Scene 1, 1"  # Single line
        ]
    }

    print("=== Comprehensive Citation Parser Test ===\n")

    total_tests = 0
    successful_tests = 0

    for category, citations in test_cases.items():
        print(f"📚 {category}")
        print("=" * (len(category) + 4))

        for citation in citations:
            total_tests += 1
            print(f"\nInput: '{citation}'")

            try:
                result = parser.parseCitation(citation)

                # Validate result structure
                if 'citations' in result and result['citations']:
                    successful_tests += 1
                    print("✓ PARSED SUCCESSFULLY")

                    # Show parsed citations
                    for i, cit in enumerate(result['citations'], 1):
                        print(f"  Citation {i}: {cit['type']}")
                        if cit['type'] == 'bible':
                            verse_range = f"{cit['start_verse']}"
                            if cit.get('end_verse') != cit['start_verse']:
                                verse_range += f"-{cit['end_verse']}"
                            print(f"    📖 {cit['book']} {cit['chapter']}:{verse_range}")
                        elif cit['type'] == 'literature':
                            print(f"    📜 {cit['work']}")
                            if 'act' in cit:
                                print(f"       Act {cit['act']} Scene {cit['scene']}, lines {cit['start_line']}-{cit['end_line']}")
                            elif 'book_number' in cit:
                                print(f"       Book {cit['book_number']}, lines {cit['start_line']}-{cit['end_line']}")
                            else:
                                print(f"       Lines {cit['start_line']}-{cit['end_line']}")
                else:
                    print("✗ NO CITATIONS PARSED")

            except Exception as e:
                print(f"✗ ERROR: {e}")

        print("\n" + "-" * 60)

    # Summary
    success_rate = (successful_tests / total_tests) * 100
    print(f"\n=== Test Summary ===")
    print(f"Total tests: {total_tests}")
    print(f"Successful: {successful_tests}")
    print(f"Failed: {total_tests - successful_tests}")
    print(f"Success rate: {success_rate:.1f}%")

    return successful_tests, total_tests

def test_edge_cases():
    """Test specific edge cases and error handling"""

    parser = CitationParser()

    edge_cases = [
        "",  # Empty string
        "Not a citation at all",
        "Genesis",  # Missing chapter:verse
        "Paradise Lost",  # Missing line numbers
        "Invalid 99:99-100",  # Invalid book name
        "Genesis 1:1-3; Romans 8:28",  # Multiple biblical
        "cf. Invalid Reference; Another Invalid"  # Mixed invalid
    ]

    print("\n=== Edge Case Testing ===")

    for case in edge_cases:
        print(f"\nTesting: '{case}'")
        try:
            result = parser.parseCitation(case)
            if result['citations']:
                print(f"  ✓ Parsed {len(result['citations'])} citation(s)")
            else:
                print("  - No citations found (expected for invalid input)")
        except Exception as e:
            print(f"  ✗ Error: {e}")

if __name__ == "__main__":
    successful, total = test_comprehensive_citations()
    test_edge_cases()

    print(f"\n🎯 Final Result: {successful}/{total} tests passed")