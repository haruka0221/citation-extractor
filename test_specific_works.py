#!/usr/bin/env python3
"""
Test the text pipeline with specific works that have confirmed download URLs
"""

from text_pipeline import TextPipeline
import json

def test_with_known_works():
    """Test pipeline with works we know have download URLs"""

    # Define test works with confirmed URLs from our catalog
    test_works = [
        {
            "id": "700",
            "title": "The Old Curiosity Shop",
            "author": "Dickens, Charles, 1812-1870",
            "url": "https://www.gutenberg.org/ebooks/700.txt.utf-8",
            "downloads": 2933
        },
        {
            "id": "12242",
            "title": "Poems by Emily Dickinson, Three Series, Complete",
            "author": "Dickinson, Emily, 1830-1886",
            "url": "https://www.gutenberg.org/ebooks/12242.txt.utf-8",
            "downloads": 7862
        },
        {
            "id": "2199",
            "title": "The Iliad",
            "author": "Homer, 751? BCE-651? BCE",
            "url": "https://www.gutenberg.org/ebooks/2199.txt.utf-8",
            "downloads": 5957
        },
        {
            "id": "8578",
            "title": "The Grand Inquisitor",
            "author": "Dostoyevsky, Fyodor, 1821-1881",
            "url": "https://www.gutenberg.org/ebooks/8578.txt.utf-8",
            "downloads": 3901
        }
    ]

    # Create pipeline
    pipeline = TextPipeline()

    print("Testing text pipeline with confirmed downloadable works...")
    print(f"Selected {len(test_works)} test works:")
    for work in test_works:
        print(f"  - {work['title']} by {work['author']} ({work['downloads']} downloads)")

    # Process each work
    results = []
    for work in test_works:
        print(f"\nProcessing: {work['title']}")
        result = pipeline.processTestWork(work)
        results.append(result)

        # Show immediate results
        if result['validated']:
            validation = result['validation']
            print(f"  ✓ Success: {validation['word_count']} words, quality score: {validation['quality_score']:.1f}")
            if validation['issues']:
                print(f"  ⚠ Issues: {', '.join(validation['issues'])}")
        else:
            print(f"  ✗ Failed: {', '.join(result['errors'])}")

    # Create summary
    successful = [r for r in results if r['validated']]
    failed = [r for r in results if r['errors']]

    print(f"\n=== Pipeline Test Summary ===")
    print(f"Total works: {len(results)}")
    print(f"Successful: {len(successful)}")
    print(f"Failed: {len(failed)}")

    if successful:
        avg_quality = sum(r['validation']['quality_score'] for r in successful) / len(successful)
        print(f"Average quality score: {avg_quality:.1f}")

    return results

if __name__ == "__main__":
    results = test_with_known_works()