#!/usr/bin/env python3
"""
Comprehensive test suite for the citation extraction engine
"""

from citation_extraction_engine import CitationExtractionEngine
import json

def test_extraction_engine():
    """Test the citation extraction engine with various citation types"""

    engine = CitationExtractionEngine()

    print("🔍 CITATION EXTRACTION ENGINE TEST")
    print("=" * 50)
    print()

    # Test cases covering different citation types
    test_cases = [
        {
            "category": "Biblical Citations",
            "citations": [
                "Genesis 1:1-3",
                "Matthew 5:3-5",
                "Romans 8:28",
                "1 Corinthians 13:4-7"
            ]
        },
        {
            "category": "Literary Citations - Available Works",
            "citations": [
                "Absalom and Achitophel 1-10",
                "The Old Curiosity Shop 1-5",
                "The Iliad 1-10",
                "The Grand Inquisitor 1-5"
            ]
        },
        {
            "category": "Literary Citations - Fuzzy Matching",
            "citations": [
                "Old Curiosity 1-3",  # Partial title
                "Iliad 1-5",          # Short title
                "Grand Inquisitor 1-3" # Partial title
            ]
        },
        {
            "category": "Mixed Citations",
            "citations": [
                "cf. Genesis 3:15; Absalom and Achitophel 1-2"
            ]
        }
    ]

    total_tests = 0
    successful_extractions = 0

    for test_group in test_cases:
        print(f"📚 {test_group['category']}")
        print("=" * (len(test_group['category']) + 4))

        for citation in test_group['citations']:
            total_tests += 1
            print(f"\n🔎 Citation: '{citation}'")

            try:
                result = engine.extractPassageFromCitation(citation)

                if result["candidates"]:
                    successful_extractions += 1
                    best_match = result["best_match"]

                    print(f"✅ SUCCESS")
                    print(f"   Source: {best_match['source']}")
                    print(f"   Confidence: {best_match['confidence']}")
                    print(f"   Metadata: {json.dumps(best_match['metadata'], indent=6)}")

                    # Show text preview
                    text_preview = best_match['text'][:150]
                    if len(best_match['text']) > 150:
                        text_preview += "..."
                    print(f"   Text Preview: \"{text_preview}\"")

                    # Show all candidates
                    if len(result["candidates"]) > 1:
                        print(f"   Additional candidates: {len(result['candidates']) - 1}")
                        for i, candidate in enumerate(result["candidates"][1:], 2):
                            print(f"     {i}. {candidate['source']} (confidence: {candidate['confidence']})")

                else:
                    print("❌ NO CANDIDATES FOUND")

            except Exception as e:
                print(f"❌ ERROR: {e}")

        print("\n" + "-" * 60)

    # Summary statistics
    success_rate = (successful_extractions / total_tests) * 100
    print(f"\n📊 EXTRACTION SUMMARY")
    print(f"Total citations tested: {total_tests}")
    print(f"Successful extractions: {successful_extractions}")
    print(f"Failed extractions: {total_tests - successful_extractions}")
    print(f"Success rate: {success_rate:.1f}%")

    return successful_extractions, total_tests

def test_confidence_scoring():
    """Test confidence scoring algorithm"""

    engine = CitationExtractionEngine()

    print(f"\n🎯 CONFIDENCE SCORING TEST")
    print("=" * 40)

    test_citations = [
        ("Genesis 1:1", "Expected: High confidence (biblical)"),
        ("Absalom and Achitophel 1-2", "Expected: High confidence (exact match)"),
        ("Old Curiosity 1-2", "Expected: Medium confidence (fuzzy match)"),
        ("Nonexistent Work 1-10", "Expected: Low/No confidence")
    ]

    for citation, expectation in test_citations:
        print(f"\n📝 Testing: '{citation}'")
        print(f"   {expectation}")

        result = engine.extractPassageFromCitation(citation)

        if result["candidates"]:
            best = result["best_match"]
            confidence = best["confidence"]

            if confidence >= 0.8:
                confidence_level = "HIGH"
            elif confidence >= 0.5:
                confidence_level = "MEDIUM"
            else:
                confidence_level = "LOW"

            print(f"   Result: {confidence_level} confidence ({confidence:.3f})")
            print(f"   Source: {best['source']}")
        else:
            print(f"   Result: NO CANDIDATES (0.000)")

def test_passage_quality():
    """Test passage extraction quality"""

    engine = CitationExtractionEngine()

    print(f"\n📖 PASSAGE QUALITY TEST")
    print("=" * 40)

    quality_tests = [
        ("Absalom and Achitophel 1-2", "Short, precise extraction"),
        ("The Old Curiosity Shop 1-10", "Longer passage extraction"),
        ("Genesis 1:1-3", "Biblical verse range"),
        ("Romans 8:28", "Single biblical verse")
    ]

    for citation, description in quality_tests:
        print(f"\n🔍 {description}")
        print(f"   Citation: '{citation}'")

        result = engine.extractPassageFromCitation(citation)

        if result["candidates"]:
            best = result["best_match"]
            text = best["text"]

            # Analyze text quality
            word_count = len(text.split())
            line_count = len(text.split('\n'))
            has_punctuation = any(p in text for p in '.!?')

            print(f"   ✓ Text extracted: {word_count} words, {line_count} lines")
            print(f"   ✓ Proper formatting: {'Yes' if has_punctuation else 'No'}")
            print(f"   ✓ Confidence: {best['confidence']:.3f}")

            # Show sample
            sample = text[:100] + "..." if len(text) > 100 else text
            print(f"   Sample: \"{sample}\"")
        else:
            print(f"   ❌ No text extracted")

if __name__ == "__main__":
    print("🚀 STARTING COMPREHENSIVE EXTRACTION TESTS\n")

    successful, total = test_extraction_engine()
    test_confidence_scoring()
    test_passage_quality()

    print(f"\n🏆 FINAL RESULTS: {successful}/{total} successful extractions")
    print("📁 Test corpus contains: Absalom & Achitophel, Old Curiosity Shop, Iliad, Grand Inquisitor")
    print("💡 Biblical passages use sample data - connect real Bible API for production")