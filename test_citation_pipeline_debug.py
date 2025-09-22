#!/usr/bin/env python3
"""
Complete citation pipeline debugging for "Absalom and Achitophel 7-8"
"""

from citation_parser import CitationParser
from citation_extraction_engine import CitationExtractionEngine
import json

def test_citation_parsing():
    """Test the citation parsing step"""

    print("🔍 STEP 1: CITATION PARSING")
    print("=" * 50)

    parser = CitationParser()

    test_citations = [
        "Absalom and Achitophel 7-8",
        "absalom and achitophel. 7-8.",
        "Absalom and Achitophel 7-8.",
        "Absalom and Achitophel lines 7-8"
    ]

    for citation in test_citations:
        print(f"\n📝 Testing citation: '{citation}'")

        try:
            result = parser.parseCitation(citation)

            print(f"   Source type: {result['source_type']}")
            print(f"   Citations found: {len(result['citations'])}")

            for i, parsed_citation in enumerate(result['citations']):
                print(f"   Citation {i+1}:")
                print(f"     Type: {parsed_citation['type']}")
                print(f"     Work: {parsed_citation.get('work', 'N/A')}")
                print(f"     Start line: {parsed_citation.get('start_line', 'N/A')}")
                print(f"     End line: {parsed_citation.get('end_line', 'N/A')}")

                # This is the key check
                if parsed_citation.get('start_line') == 7 and parsed_citation.get('end_line') == 8:
                    print("     ✅ Line range parsed correctly!")
                else:
                    print(f"     ❌ Line range wrong! Expected: 7-8, Got: {parsed_citation.get('start_line')}-{parsed_citation.get('end_line')}")

        except Exception as e:
            print(f"   ❌ Parsing error: {e}")

    return True

def test_text_extraction():
    """Test the text extraction step"""

    print(f"\n🔍 STEP 2: TEXT EXTRACTION")
    print("=" * 50)

    engine = CitationExtractionEngine()

    print(f"📚 Available works:")
    for work_id, work_info in engine.literary_works.items():
        title = work_info['metadata'].get('title', work_id)
        print(f"  {work_id}: {title}")

    # Test direct extraction with known parameters
    print(f"\n🎯 Direct extraction test:")

    # Find the right work ID for Absalom and Achitophel
    target_work_id = None
    for work_id, work_info in engine.literary_works.items():
        title = work_info['metadata'].get('title', '').lower()
        if 'absalom' in title and 'achitophel' in title:
            target_work_id = work_id
            break

    if not target_work_id:
        print(f"❌ Absalom and Achitophel not found in corpus")
        return False

    print(f"Found work: {target_work_id}")

    # Test extraction
    try:
        candidate = engine.extractLiteraryPassage(target_work_id, 7, 8)

        if candidate:
            print(f"✅ Extraction successful!")
            print(f"   Source: {candidate.source}")
            print(f"   Confidence: {candidate.confidence:.3f}")
            print(f"   Lines: {candidate.metadata.get('lines', 'N/A')}")
            print(f"   Text preview: {candidate.text[:100]}...")

            # Check if the text contains the expected lines
            expected_content = ["Sagacious, bold, and turbulent of wit", "Restless, unfixed in principles and place"]
            text_lower = candidate.text.lower()

            all_found = True
            for expected in expected_content:
                if expected.lower() in text_lower:
                    print(f"   ✅ Found: '{expected}'")
                else:
                    print(f"   ❌ Missing: '{expected}'")
                    all_found = False

            return all_found

        else:
            print(f"❌ No candidate returned")
            return False

    except Exception as e:
        print(f"❌ Extraction error: {e}")
        return False

def test_complete_pipeline():
    """Test the complete pipeline"""

    print(f"\n🔍 STEP 3: COMPLETE PIPELINE")
    print("=" * 50)

    engine = CitationExtractionEngine()

    test_citation = "Absalom and Achitophel 7-8"
    print(f"📝 Testing complete pipeline with: '{test_citation}'")

    try:
        result = engine.extractPassageFromCitation(test_citation)

        print(f"   Original citation: {result['original_citation']}")
        print(f"   Candidates found: {len(result['candidates'])}")

        if result['candidates']:
            best_match = result['best_match']
            print(f"\n🏆 Best match:")
            print(f"   Source: {best_match['source']}")
            print(f"   Confidence: {best_match['confidence']:.3f}")
            print(f"   Text length: {len(best_match['text'])} characters")

            # Show full text
            print(f"\n📄 Full extracted text:")
            print(f"'{best_match['text']}'")

            # Check metadata
            metadata = best_match['metadata']
            print(f"\n📊 Metadata:")
            for key, value in metadata.items():
                print(f"   {key}: {value}")

            # Verify this is the correct lines 7-8
            expected_lines = [
                "Sagacious, bold, and turbulent of wit,",
                "Restless, unfixed in principles and place,"
            ]

            text_lines = best_match['text'].split('\n')
            print(f"\n🔍 Line-by-line analysis:")
            for i, line in enumerate(text_lines):
                line = line.strip()
                if line:
                    print(f"   Line {i+1}: '{line}'")

                    if i < len(expected_lines):
                        expected = expected_lines[i].rstrip(',')
                        if expected.lower() in line.lower():
                            print(f"             ✅ Matches expected content")
                        else:
                            print(f"             ❌ Expected: '{expected}'")

            return True

        else:
            print(f"❌ No candidates found")
            return False

    except Exception as e:
        print(f"❌ Pipeline error: {e}")
        return False

def test_with_enhanced_logging():
    """Add enhanced logging to the extraction engine"""

    print(f"\n🔍 STEP 4: ENHANCED LOGGING TEST")
    print("=" * 50)

    # Monkey patch the extractLiteraryPassage method to add logging
    from citation_extraction_engine import CitationExtractionEngine

    engine = CitationExtractionEngine()

    # Store original method
    original_method = engine.extractLiteraryPassage

    def logged_extractLiteraryPassage(self, work_id, start_line, end_line):
        print(f"\n🔧 extractLiteraryPassage called:")
        print(f"   work_id: {work_id}")
        print(f"   start_line: {start_line}")
        print(f"   end_line: {end_line}")

        if work_id not in self.literary_works:
            print(f"   ❌ Work ID not found in corpus")
            return None

        work_info = self.literary_works[work_id]
        file_path = work_info["file_path"]
        print(f"   📁 File path: {file_path}")

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()

            print(f"   📊 File has {len(lines)} lines")

            if start_line <= 0 or end_line > len(lines):
                print(f"   ❌ Line range out of bounds: {start_line}-{end_line} for {len(lines)} lines")
                return None

            # Extract the specified line range
            print(f"   🔢 Converting to array indices:")
            start_index = start_line - 1
            end_index = end_line
            print(f"   lines[{start_index}:{end_index}]")

            passage_lines = lines[start_index:end_index]
            print(f"   📄 Extracted {len(passage_lines)} lines:")

            for i, line in enumerate(passage_lines):
                actual_line_num = start_line + i
                content = line.rstrip('\n')
                print(f"     Line {actual_line_num}: '{content}'")

            # Continue with original method logic
            return original_method(work_id, start_line, end_line)

        except Exception as e:
            print(f"   ❌ Error: {e}")
            return None

    # Replace method
    engine.extractLiteraryPassage = logged_extractLiteraryPassage.__get__(engine, CitationExtractionEngine)

    # Test with logging
    result = engine.extractPassageFromCitation("Absalom and Achitophel 7-8")

    if result and result['candidates']:
        print(f"\n✅ Enhanced logging test completed successfully")
        return True
    else:
        print(f"\n❌ Enhanced logging test failed")
        return False

def main():
    """Run all tests"""

    print("🚀 CITATION PIPELINE DEBUGGING")
    print("=" * 60)
    print("Target: Extract lines 7-8 from Absalom and Achitophel")
    print("Expected: 'Sagacious, bold, and turbulent of wit,' + 'Restless, unfixed in principles and place,'")
    print()

    results = {
        "parsing": test_citation_parsing(),
        "extraction": test_text_extraction(),
        "pipeline": test_complete_pipeline(),
        "logging": test_with_enhanced_logging()
    }

    print(f"\n🎯 FINAL RESULTS:")
    print("=" * 30)

    all_passed = True
    for test_name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{test_name.capitalize():12}: {status}")
        if not passed:
            all_passed = False

    if all_passed:
        print(f"\n🎉 ALL TESTS PASSED!")
        print("The citation extraction is working correctly.")
    else:
        print(f"\n❌ SOME TESTS FAILED!")
        print("Issues found in the citation pipeline.")

if __name__ == "__main__":
    main()