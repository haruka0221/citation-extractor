#!/usr/bin/env python3
"""
Interactive search tool for Project Gutenberg catalog
"""

import json
import sys
import argparse
from gutenberg_parser import GutenbergCatalogParser

def interactive_search():
    """Interactive search interface"""

    # Load catalog and search index
    try:
        with open('gutenberg_catalog_complete.json', 'r', encoding='utf-8') as f:
            catalog = json.load(f)

        with open('gutenberg_search_index.json', 'r', encoding='utf-8') as f:
            search_index = json.load(f)

        print(f"✓ Loaded Project Gutenberg catalog with {len(catalog)} English texts")

    except FileNotFoundError:
        print("✗ Catalog files not found. Please run gutenberg_parser.py first.")
        return

    # Create parser instance for search
    parser = GutenbergCatalogParser(".", ".")
    parser.catalog = catalog
    parser.search_index = search_index

    print("\n=== Project Gutenberg Search Tool ===")
    print("Enter book titles, author names, or keywords to search")
    print("Type 'quit' to exit\n")

    while True:
        try:
            query = input("Search: ").strip()

            if query.lower() in ['quit', 'exit', 'q']:
                break

            if not query:
                continue

            # Perform search
            results = parser.searchByTitle(query, search_index, catalog, limit=10)

            if not results:
                print("No results found. Try different keywords.\n")
                continue

            print(f"\nFound {len(results)} results for '{query}':")
            print("-" * 80)

            for i, result in enumerate(results, 1):
                print(f"{i:2d}. {result['title']}")
                print(f"     by {result['primary_author']}")
                print(f"     Score: {result['score']:.2f} | ID: {result['text_id']}")

                if result.get('text_url'):
                    print(f"     📖 Download: {result['text_url']}")

                if result.get('downloads'):
                    print(f"     📊 Downloads: {result['downloads']:,}")

                print()

        except KeyboardInterrupt:
            print("\n\nGoodbye!")
            break
        except EOFError:
            break

def search_command(query: str, limit: int = 10):
    """Command-line search"""

    try:
        with open('gutenberg_catalog_complete.json', 'r', encoding='utf-8') as f:
            catalog = json.load(f)

        with open('gutenberg_search_index.json', 'r', encoding='utf-8') as f:
            search_index = json.load(f)

    except FileNotFoundError:
        print("✗ Catalog files not found. Please run gutenberg_parser.py first.")
        return

    parser = GutenbergCatalogParser(".", ".")
    parser.catalog = catalog
    parser.search_index = search_index

    results = parser.searchByTitle(query, search_index, catalog, limit=limit)

    if not results:
        print(f"No results found for '{query}'")
        return

    print(f"Search results for '{query}':")
    print("=" * 60)

    for i, result in enumerate(results, 1):
        print(f"\n{i}. {result['title']}")
        print(f"   Author: {result['primary_author']}")
        print(f"   ID: {result['text_id']} | Score: {result['score']:.2f}")

        if result.get('text_url'):
            print(f"   Download: {result['text_url']}")

        if result.get('downloads'):
            print(f"   Downloads: {result['downloads']:,}")

def show_stats():
    """Show catalog statistics"""

    try:
        with open('gutenberg_catalog_complete.json', 'r', encoding='utf-8') as f:
            catalog = json.load(f)
    except FileNotFoundError:
        print("✗ Catalog file not found.")
        return

    # Calculate statistics
    total_texts = len(catalog)
    texts_with_urls = sum(1 for entry in catalog.values() if entry.get('text_url'))
    texts_with_downloads = sum(1 for entry in catalog.values() if entry.get('downloads'))

    # Author statistics
    authors = {}
    for entry in catalog.values():
        author = entry.get('primary_author', 'Unknown')
        if author:
            authors[author] = authors.get(author, 0) + 1

    top_authors = sorted(authors.items(), key=lambda x: x[1], reverse=True)[:10]

    # Download statistics
    download_counts = [entry.get('downloads', 0) for entry in catalog.values() if entry.get('downloads')]
    if download_counts:
        avg_downloads = sum(download_counts) / len(download_counts)
        max_downloads = max(download_counts)
        most_downloaded = max(catalog.values(), key=lambda x: x.get('downloads', 0))

    print("=== Project Gutenberg Catalog Statistics ===\n")
    print(f"Total English texts: {total_texts:,}")
    print(f"Texts with download URLs: {texts_with_urls:,} ({texts_with_urls/total_texts*100:.1f}%)")
    print(f"Texts with download stats: {texts_with_downloads:,} ({texts_with_downloads/total_texts*100:.1f}%)")

    if download_counts:
        print(f"\nDownload Statistics:")
        print(f"Average downloads per text: {avg_downloads:,.0f}")
        print(f"Maximum downloads: {max_downloads:,}")
        print(f"Most downloaded: {most_downloaded['title']} ({most_downloaded.get('downloads', 0):,} downloads)")

    print(f"\nTop 10 Authors by Number of Texts:")
    for i, (author, count) in enumerate(top_authors, 1):
        print(f"{i:2d}. {author}: {count} texts")

def main():
    parser = argparse.ArgumentParser(description='Search Project Gutenberg catalog')
    parser.add_argument('--search', '-s', help='Search query')
    parser.add_argument('--limit', '-l', type=int, default=10, help='Number of results to show')
    parser.add_argument('--stats', action='store_true', help='Show catalog statistics')
    parser.add_argument('--interactive', '-i', action='store_true', help='Interactive search mode')

    args = parser.parse_args()

    if args.stats:
        show_stats()
    elif args.search:
        search_command(args.search, args.limit)
    elif args.interactive or len(sys.argv) == 1:
        interactive_search()
    else:
        parser.print_help()

if __name__ == "__main__":
    main()