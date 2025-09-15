#!/usr/bin/env python3
"""
Project Gutenberg Catalog Parser

Processes CSV and RDF data to create a unified, searchable catalog
of Project Gutenberg texts with download URLs and metadata.
"""

import csv
import json
import tarfile
import bz2
import os
import re
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from urllib.parse import urljoin
import argparse
from difflib import SequenceMatcher
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class GutenbergCatalogParser:
    """Parser for Project Gutenberg catalog data"""

    def __init__(self, input_dir: str, output_dir: str = "."):
        self.input_dir = Path(input_dir)
        self.output_dir = Path(output_dir)
        self.catalog = {}
        self.search_index = {}

        # Ensure output directory exists
        self.output_dir.mkdir(exist_ok=True)

        # RDF namespace mappings
        self.namespaces = {
            'dcterms': 'http://purl.org/dc/terms/',
            'pgterms': 'http://www.gutenberg.org/2009/pgterms/',
            'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
            'dcam': 'http://purl.org/dc/dcam/',
            'cc': 'http://web.resource.org/cc/'
        }

    def parseCSVCatalog(self, csv_path: str) -> Dict:
        """
        Parse pg_catalog.csv to build initial index

        Args:
            csv_path: Path to the CSV catalog file

        Returns:
            Dictionary with text_id as key and basic metadata as value
        """
        logger.info(f"Parsing CSV catalog: {csv_path}")
        catalog = {}

        try:
            with open(csv_path, 'r', encoding='utf-8', newline='') as csvfile:
                reader = csv.DictReader(csvfile)

                for row_num, row in enumerate(reader, 1):
                    try:
                        text_id = row.get('Text#', '').strip()
                        if not text_id or not text_id.isdigit():
                            continue

                        text_id = int(text_id)
                        language = row.get('Language', '').strip()

                        # Filter for English texts only
                        if language != 'en':
                            continue

                        title = row.get('Title', '').strip()
                        authors = row.get('Authors', '').strip()
                        subjects = row.get('Subjects', '').strip()
                        locc = row.get('LoCC', '').strip()
                        bookshelves = row.get('Bookshelves', '').strip()
                        issued = row.get('Issued', '').strip()

                        # Clean and normalize title
                        title = self._clean_title(title)

                        # Parse authors
                        author_list = self._parse_authors(authors)

                        catalog[str(text_id)] = {
                            'text_id': text_id,
                            'title': title,
                            'authors': author_list,
                            'primary_author': author_list[0] if author_list else '',
                            'language': language,
                            'subjects': subjects,
                            'locc': locc,
                            'bookshelves': bookshelves,
                            'issued': issued,
                            'text_url': None,  # Will be filled from RDF
                            'local_path': None,
                            'file_formats': {}
                        }

                        if row_num % 1000 == 0:
                            logger.info(f"Processed {row_num} CSV rows, {len(catalog)} English texts")

                    except Exception as e:
                        logger.warning(f"Error processing CSV row {row_num}: {e}")
                        continue

        except Exception as e:
            logger.error(f"Error reading CSV file: {e}")
            raise

        logger.info(f"CSV parsing complete: {len(catalog)} English texts found")
        return catalog

    def extractRDFArchive(self, tar_path: str, output_dir: str) -> str:
        """
        Extract RDF files from tar.bz2 archive

        Args:
            tar_path: Path to the tar.bz2 archive
            output_dir: Directory to extract to

        Returns:
            Path to extracted RDF directory
        """
        logger.info(f"Extracting RDF archive: {tar_path}")
        extract_path = Path(output_dir) / "rdf_files"

        if extract_path.exists():
            logger.info(f"RDF files already extracted to {extract_path}")
            return str(extract_path)

        try:
            with tarfile.open(tar_path, 'r:bz2') as tar:
                # Extract only a subset for testing if archive is large
                members = tar.getmembers()
                logger.info(f"Archive contains {len(members)} files")

                # Extract all files
                tar.extractall(path=output_dir)

            logger.info(f"Extracted {len(members)} RDF files to {extract_path}")
            return str(extract_path)

        except Exception as e:
            logger.error(f"Error extracting RDF archive: {e}")
            raise

    def parseRDFMetadata(self, rdf_dir: str) -> Dict:
        """
        Parse individual RDF files for detailed metadata

        Args:
            rdf_dir: Directory containing RDF files

        Returns:
            Dictionary with enhanced metadata including download URLs
        """
        logger.info(f"Parsing RDF metadata from: {rdf_dir}")
        rdf_path = Path(rdf_dir)

        if not rdf_path.exists():
            logger.error(f"RDF directory not found: {rdf_dir}")
            return {}

        # Find the actual RDF files directory (may be nested)
        rdf_files_dir = None
        for item in rdf_path.rglob("*"):
            if item.is_dir() and "cache/epub" in str(item):
                rdf_files_dir = item
                break

        if not rdf_files_dir:
            # Look for any directory with numbered subdirectories
            for item in rdf_path.iterdir():
                if item.is_dir():
                    subdirs = [d for d in item.iterdir() if d.is_dir() and d.name.isdigit()]
                    if subdirs:
                        rdf_files_dir = item
                        break

        if not rdf_files_dir:
            logger.error("Could not find RDF files directory structure")
            return {}

        logger.info(f"Found RDF files in: {rdf_files_dir}")

        rdf_metadata = {}
        processed = 0

        # Process RDF files
        for text_dir in rdf_files_dir.iterdir():
            if not text_dir.is_dir() or not text_dir.name.isdigit():
                continue

            text_id = text_dir.name
            rdf_file = text_dir / f"pg{text_id}.rdf"

            if not rdf_file.exists():
                continue

            try:
                metadata = self._parse_single_rdf(str(rdf_file), text_id)
                if metadata:
                    rdf_metadata[text_id] = metadata
                    processed += 1

                    if processed % 100 == 0:
                        logger.info(f"Processed {processed} RDF files")

                    # Limit for testing
                    if processed >= 1000:  # Process first 1000 for testing
                        logger.info("Limiting to first 1000 RDF files for testing")
                        break

            except Exception as e:
                logger.warning(f"Error parsing RDF file {rdf_file}: {e}")
                continue

        logger.info(f"RDF parsing complete: {len(rdf_metadata)} files processed")
        return rdf_metadata

    def _parse_single_rdf(self, rdf_file: str, text_id: str) -> Optional[Dict]:
        """Parse a single RDF file and extract metadata"""
        try:
            tree = ET.parse(rdf_file)
            root = tree.getroot()

            # Register namespaces
            for prefix, uri in self.namespaces.items():
                ET.register_namespace(prefix, uri)

            metadata = {
                'downloads': 0,
                'file_formats': {},
                'text_url': None
            }

            # Find the main ebook element
            ebook_elem = root.find('.//pgterms:ebook', self.namespaces)
            if ebook_elem is None:
                return None

            # Extract download count
            downloads_elem = ebook_elem.find('.//pgterms:downloads', self.namespaces)
            if downloads_elem is not None:
                try:
                    metadata['downloads'] = int(downloads_elem.text)
                except (ValueError, TypeError):
                    pass

            # Extract file formats and URLs
            for file_elem in ebook_elem.findall('.//pgterms:file', self.namespaces):
                about = file_elem.get('{http://www.w3.org/1999/02/22-rdf-syntax-ns#}about', '')

                # Get format information
                format_elem = file_elem.find('.//dcterms:format//rdf:value', self.namespaces)
                if format_elem is not None:
                    format_type = format_elem.text

                    # Look for plain text files
                    if 'text/plain' in format_type:
                        if 'charset=utf-8' in format_type or 'utf-8' in about:
                            metadata['text_url'] = about
                        metadata['file_formats']['text'] = about
                    elif 'text/html' in format_type:
                        metadata['file_formats']['html'] = about
                    elif 'application/epub' in format_type:
                        metadata['file_formats']['epub'] = about
                    elif 'application/pdf' in format_type:
                        metadata['file_formats']['pdf'] = about

            return metadata

        except Exception as e:
            logger.debug(f"Error parsing RDF {rdf_file}: {e}")
            return None

    def buildSearchIndex(self, catalog: Dict) -> Dict:
        """
        Build searchable title index with fuzzy matching capabilities

        Args:
            catalog: The main catalog dictionary

        Returns:
            Search index dictionary
        """
        logger.info("Building search index")
        index = {
            'by_title': {},
            'by_author': {},
            'by_word': {},
            'normalized_titles': {}
        }

        for text_id, entry in catalog.items():
            title = entry.get('title', '')
            author = entry.get('primary_author', '')

            # Normalize titles for better matching
            normalized_title = self._normalize_for_search(title)
            index['normalized_titles'][text_id] = normalized_title

            # Index by title
            if title:
                title_key = title.lower()
                if title_key not in index['by_title']:
                    index['by_title'][title_key] = []
                index['by_title'][title_key].append(text_id)

            # Index by author
            if author:
                author_key = author.lower()
                if author_key not in index['by_author']:
                    index['by_author'][author_key] = []
                index['by_author'][author_key].append(text_id)

            # Index by words in title
            words = re.findall(r'\b\w+\b', title.lower())
            for word in words:
                if len(word) > 2:  # Skip very short words
                    if word not in index['by_word']:
                        index['by_word'][word] = []
                    index['by_word'][word].append(text_id)

        logger.info(f"Search index built: {len(index['by_title'])} titles, {len(index['by_author'])} authors")
        return index

    def searchByTitle(self, query: str, index: Dict, catalog: Dict, limit: int = 20) -> List[Dict]:
        """
        Search catalog by title with fuzzy matching

        Args:
            query: Search query
            index: Pre-built search index
            catalog: Main catalog
            limit: Maximum number of results

        Returns:
            List of matching entries with similarity scores
        """
        query_normalized = self._normalize_for_search(query)
        results = []

        # Exact title matches first
        exact_matches = index['by_title'].get(query.lower(), [])
        for text_id in exact_matches:
            if text_id in catalog:
                results.append({
                    'text_id': text_id,
                    'score': 1.0,
                    'match_type': 'exact_title',
                    **catalog[text_id]
                })

        # Fuzzy title matches
        for text_id, normalized_title in index['normalized_titles'].items():
            if text_id in catalog and text_id not in [r['text_id'] for r in results]:
                similarity = SequenceMatcher(None, query_normalized, normalized_title).ratio()
                if similarity > 0.6:  # Similarity threshold
                    results.append({
                        'text_id': text_id,
                        'score': similarity,
                        'match_type': 'fuzzy_title',
                        **catalog[text_id]
                    })

        # Word-based matches
        query_words = re.findall(r'\b\w+\b', query.lower())
        for word in query_words:
            if word in index['by_word']:
                for text_id in index['by_word'][word]:
                    if text_id in catalog and text_id not in [r['text_id'] for r in results]:
                        results.append({
                            'text_id': text_id,
                            'score': 0.5,
                            'match_type': 'word_match',
                            **catalog[text_id]
                        })

        # Sort by score and limit results
        results.sort(key=lambda x: x['score'], reverse=True)
        return results[:limit]

    def saveCatalogJSON(self, catalog: Dict, output_path: str):
        """
        Save catalog to JSON file

        Args:
            catalog: Catalog dictionary to save
            output_path: Output file path
        """
        logger.info(f"Saving catalog to: {output_path}")

        try:
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(catalog, f, indent=2, ensure_ascii=False)

            logger.info(f"Catalog saved successfully: {len(catalog)} entries")

        except Exception as e:
            logger.error(f"Error saving catalog: {e}")
            raise

    def _clean_title(self, title: str) -> str:
        """Clean and normalize title text"""
        if not title:
            return ""

        # Remove excessive whitespace
        title = re.sub(r'\s+', ' ', title.strip())

        # Remove common Project Gutenberg suffixes
        patterns = [
            r'\s*\(.*?Project Gutenberg.*?\)',
            r'\s*\[.*?Project Gutenberg.*?\]',
            r'\s*—.*?Project Gutenberg.*',
        ]

        for pattern in patterns:
            title = re.sub(pattern, '', title, flags=re.IGNORECASE)

        return title.strip()

    def _parse_authors(self, authors_str: str) -> List[str]:
        """Parse author string into list of authors"""
        if not authors_str:
            return []

        # Split by semicolon (common delimiter)
        authors = [author.strip() for author in authors_str.split(';')]

        # Clean up author names
        cleaned_authors = []
        for author in authors:
            # Remove birth/death dates in parentheses
            author = re.sub(r'\s*\([^)]*\)', '', author)
            author = author.strip()
            if author:
                cleaned_authors.append(author)

        return cleaned_authors

    def _normalize_for_search(self, text: str) -> str:
        """Normalize text for search comparison"""
        if not text:
            return ""

        # Convert to lowercase
        text = text.lower()

        # Remove punctuation and extra whitespace
        text = re.sub(r'[^\w\s]', ' ', text)
        text = re.sub(r'\s+', ' ', text)

        return text.strip()

    def process_all(self) -> Dict:
        """
        Process all catalog data and create unified catalog

        Returns:
            Complete catalog dictionary
        """
        logger.info("Starting full catalog processing")

        # Step 1: Parse CSV catalog
        csv_path = self.input_dir / "pg_catalog.csv"
        if not csv_path.exists():
            raise FileNotFoundError(f"CSV catalog not found: {csv_path}")

        self.catalog = self.parseCSVCatalog(str(csv_path))

        # Step 2: Extract and parse RDF files
        tar_path = self.input_dir / "rdf-files.tar.bz2"
        if tar_path.exists():
            rdf_dir = self.extractRDFArchive(str(tar_path), str(self.output_dir))
            rdf_metadata = self.parseRDFMetadata(rdf_dir)

            # Step 3: Merge RDF metadata into catalog
            for text_id, rdf_data in rdf_metadata.items():
                if text_id in self.catalog:
                    self.catalog[text_id].update(rdf_data)
        else:
            logger.warning(f"RDF archive not found: {tar_path}")

        # Step 4: Build search index
        self.search_index = self.buildSearchIndex(self.catalog)

        # Step 5: Save catalog
        output_path = self.output_dir / "gutenberg_catalog.json"
        self.saveCatalogJSON(self.catalog, str(output_path))

        # Step 6: Save search index
        index_path = self.output_dir / "gutenberg_search_index.json"
        with open(index_path, 'w', encoding='utf-8') as f:
            json.dump(self.search_index, f, indent=2, ensure_ascii=False)

        logger.info(f"Processing complete! Catalog with {len(self.catalog)} entries saved to {output_path}")
        return self.catalog


def main():
    parser = argparse.ArgumentParser(description='Parse Project Gutenberg catalog data')
    parser.add_argument('input_dir', help='Directory containing pg_catalog.csv and rdf-files.tar.bz2')
    parser.add_argument('--output-dir', '-o', default='.', help='Output directory for generated files')
    parser.add_argument('--search', '-s', help='Test search functionality with a query')
    parser.add_argument('--verbose', '-v', action='store_true', help='Enable verbose logging')

    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    # Create parser instance
    parser_instance = GutenbergCatalogParser(args.input_dir, args.output_dir)

    # Process catalog
    catalog = parser_instance.process_all()

    # Test search functionality if requested
    if args.search:
        logger.info(f"Testing search with query: '{args.search}'")
        results = parser_instance.searchByTitle(args.search, parser_instance.search_index, catalog)

        print(f"\nSearch results for '{args.search}':")
        print("-" * 50)
        for i, result in enumerate(results[:10], 1):
            print(f"{i}. {result['title']}")
            print(f"   Author: {result['primary_author']}")
            print(f"   Score: {result['score']:.2f} ({result['match_type']})")
            if result.get('text_url'):
                print(f"   URL: {result['text_url']}")
            print()


if __name__ == "__main__":
    main()