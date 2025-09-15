#!/usr/bin/env python3
"""Test script for the Gutenberg catalog"""

import json
import sys
from gutenberg_parser import GutenbergCatalogParser

def test_catalog():
    """Test the generated catalog"""

    # Load the catalog
    try:
        with open('gutenberg_catalog.json', 'r', encoding='utf-8') as f:
            catalog = json.load(f)

        with open('gutenberg_search_index.json', 'r', encoding='utf-8') as f:
            search_index = json.load(f)

        print(f"✓ Loaded catalog with {len(catalog)} entries")
        print(f"✓ Loaded search index with {len(search_index['by_title'])} titles")

    except FileNotFoundError as e:
        print(f"✗ Error loading files: {e}")
        return False

    # Test some entries
    print("\n=== Sample Entries ===")
    count = 0
    for text_id, entry in catalog.items():
        if count >= 5:
            break
        print(f"\nID: {text_id}")
        print(f"Title: {entry['title']}")
        print(f"Author: {entry['primary_author']}")
        print(f"Language: {entry['language']}")
        if entry.get('text_url'):
            print(f"URL: {entry['text_url']}")
        count += 1

    # Test search functionality
    print("\n=== Search Tests ===")
    parser = GutenbergCatalogParser(".", ".")
    parser.catalog = catalog
    parser.search_index = search_index

    test_queries = [
        "Pride and Prejudice",
        "Shakespeare",
        "Alice Wonderland",
        "Moby Dick",
        "War and Peace"
    ]

    for query in test_queries:
        print(f"\nSearching for: '{query}'")
        results = parser.searchByTitle(query, search_index, catalog, limit=3)

        for i, result in enumerate(results, 1):
            print(f"  {i}. {result['title']} by {result['primary_author']} (Score: {result['score']:.2f})")

    return True

def process_rdf_files():
    """Process RDF files to add download URLs"""
    parser = GutenbergCatalogParser(".", ".")

    # Load existing catalog
    with open('gutenberg_catalog.json', 'r', encoding='utf-8') as f:
        catalog = json.load(f)

    print(f"Processing RDF files for {len(catalog)} entries...")

    # Process RDF metadata
    rdf_metadata = parser.parseRDFMetadata("cache")

    print(f"Found RDF data for {len(rdf_metadata)} entries")

    # Update catalog with RDF data
    updated_count = 0
    for text_id, rdf_data in rdf_metadata.items():
        if text_id in catalog:
            catalog[text_id].update(rdf_data)
            updated_count += 1

    print(f"Updated {updated_count} catalog entries with RDF data")

    # Save updated catalog
    with open('gutenberg_catalog_complete.json', 'w', encoding='utf-8') as f:
        json.dump(catalog, f, indent=2, ensure_ascii=False)

    print("Saved complete catalog to gutenberg_catalog_complete.json")

    # Show some entries with download URLs
    print("\n=== Entries with Download URLs ===")
    count = 0
    for text_id, entry in catalog.items():
        if entry.get('text_url') and count < 10:
            print(f"ID {text_id}: {entry['title']}")
            print(f"  URL: {entry['text_url']}")
            print(f"  Downloads: {entry.get('downloads', 0)}")
            count += 1

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--process-rdf":
        process_rdf_files()
    else:
        test_catalog()