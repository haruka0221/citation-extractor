#!/usr/bin/env python3
"""
Manual inspection tool for cleaned texts
"""

import json
import os
from pathlib import Path

def inspect_text_quality():
    """Manual inspection of cleaned text quality"""

    validation_dir = Path("test_corpus/validation")
    cleaned_dir = Path("test_corpus/cleaned")

    print("=== Text Processing Quality Inspection ===\n")

    # Load all validation files
    validation_files = list(validation_dir.glob("*.json"))

    for val_file in validation_files:
        with open(val_file, 'r') as f:
            validation = json.load(f)

        text_id = val_file.stem.replace("_validation", "").replace("pg", "")
        cleaned_file = cleaned_dir / f"pg{text_id}_cleaned.txt"

        print(f"📖 {validation['title']}")
        print(f"   Words: {validation['word_count']:,}")
        print(f"   Quality Score: {validation['quality_score']:.1f}/100")

        if validation['issues']:
            print(f"   ⚠️  Issues: {', '.join(validation['issues'])}")
        else:
            print(f"   ✅ No issues detected")

        # Show first few lines of cleaned text
        if cleaned_file.exists():
            with open(cleaned_file, 'r', encoding='utf-8') as f:
                lines = f.readlines()

            print(f"   📝 First 5 lines:")
            for i, line in enumerate(lines[:5], 1):
                print(f"      {i}: {line.strip()}")

        print()

    # Show summary statistics
    scores = [json.load(open(f, 'r'))['quality_score'] for f in validation_files]
    word_counts = [json.load(open(f, 'r'))['word_count'] for f in validation_files]

    print("=== Summary Statistics ===")
    print(f"Average quality score: {sum(scores) / len(scores):.1f}")
    print(f"Total words processed: {sum(word_counts):,}")
    print(f"Average words per text: {sum(word_counts) / len(word_counts):,.0f}")

    # Check for any remaining Project Gutenberg artifacts
    print("\n=== Artifact Check ===")
    gutenberg_artifacts = 0
    for val_file in validation_files:
        validation = json.load(open(val_file, 'r'))
        if validation['has_gutenberg_markers']:
            gutenberg_artifacts += 1
            print(f"⚠️  {validation['title']} still contains Project Gutenberg markers")

    if gutenberg_artifacts == 0:
        print("✅ No Project Gutenberg artifacts detected in any text")
    else:
        print(f"⚠️  {gutenberg_artifacts}/{len(validation_files)} texts contain artifacts")

def show_text_sample(text_id: str, lines: int = 10):
    """Show a sample from a specific cleaned text"""

    cleaned_file = f"test_corpus/cleaned/pg{text_id}_cleaned.txt"

    if not os.path.exists(cleaned_file):
        print(f"Text {text_id} not found")
        return

    with open(cleaned_file, 'r', encoding='utf-8') as f:
        content = f.readlines()

    print(f"=== Sample from Text {text_id} (first {lines} lines) ===")
    for i, line in enumerate(content[:lines], 1):
        print(f"{i:2d}: {line.rstrip()}")

if __name__ == "__main__":
    inspect_text_quality()

    # Show detailed samples
    print("\n" + "="*60)
    print("DETAILED SAMPLES")
    print("="*60)

    show_text_sample("700", 15)  # Dickens
    print()
    show_text_sample("2199", 15)  # Homer