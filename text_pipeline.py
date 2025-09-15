#!/usr/bin/env python3
"""
Project Gutenberg Text Download and Cleaning Pipeline

Downloads and cleans texts for testing with a small subset of well-known works.
"""

import json
import os
import re
import requests
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import logging
from urllib.parse import urlparse

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class TextPipeline:
    """Pipeline for downloading and cleaning Project Gutenberg texts"""

    def __init__(self, output_dir: str = "test_corpus"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)

        # Create subdirectories
        (self.output_dir / "raw").mkdir(exist_ok=True)
        (self.output_dir / "cleaned").mkdir(exist_ok=True)
        (self.output_dir / "validation").mkdir(exist_ok=True)

        # Load catalog if available
        self.catalog = self._load_catalog()

        # Common Project Gutenberg markers
        self.start_markers = [
            "*** START OF THIS PROJECT GUTENBERG EBOOK",
            "*** START OF THE PROJECT GUTENBERG EBOOK",
            "*END*THE SMALL PRINT",
            "START OF THIS PROJECT GUTENBERG",
            "This etext was prepared by"
        ]

        self.end_markers = [
            "*** END OF THIS PROJECT GUTENBERG EBOOK",
            "*** END OF THE PROJECT GUTENBERG EBOOK",
            "END OF THIS PROJECT GUTENBERG",
            "End of the Project Gutenberg EBook",
            "End of Project Gutenberg"
        ]

    def _load_catalog(self) -> Dict:
        """Load the Project Gutenberg catalog"""
        try:
            catalog_file = "gutenberg_catalog_complete.json"
            if os.path.exists(catalog_file):
                with open(catalog_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            else:
                logger.warning("Complete catalog not found, trying basic catalog")
                with open("gutenberg_catalog.json", 'r', encoding='utf-8') as f:
                    return json.load(f)
        except FileNotFoundError:
            logger.error("No catalog found. Please run gutenberg_parser.py first.")
            return {}

    def get_test_works(self) -> List[Dict]:
        """Define test works for initial validation"""

        # Define test works with their expected IDs
        test_candidates = [
            {"title": "Paradise Lost", "author": "Milton", "preferred_ids": ["20", "26"]},
            {"title": "Pride and Prejudice", "author": "Austen", "preferred_ids": ["1342", "20686"]},
            {"title": "Alice's Adventures in Wonderland", "author": "Carroll", "preferred_ids": ["11", "19033"]},
            {"title": "Moby Dick", "author": "Melville", "search_term": "Moby Dick"},
            {"title": "The Poetical Works of John Dryden", "author": "Dryden", "preferred_ids": ["11488", "11578"]}
        ]

        selected_works = []

        for work in test_candidates:
            # Try to find the work in catalog
            found_work = None

            # First try preferred IDs
            if "preferred_ids" in work:
                for text_id in work["preferred_ids"]:
                    if text_id in self.catalog:
                        entry = self.catalog[text_id]
                        if entry.get('text_url'):  # Has download URL
                            found_work = {
                                "id": text_id,
                                "title": entry['title'],
                                "author": entry['primary_author'],
                                "url": entry['text_url'],
                                "downloads": entry.get('downloads', 0)
                            }
                            break

            # If not found, search by title
            if not found_work and "search_term" in work:
                for text_id, entry in self.catalog.items():
                    if (work["search_term"].lower() in entry['title'].lower() and
                        work["author"].lower() in entry['primary_author'].lower() and
                        entry.get('text_url')):
                        found_work = {
                            "id": text_id,
                            "title": entry['title'],
                            "author": entry['primary_author'],
                            "url": entry['text_url'],
                            "downloads": entry.get('downloads', 0)
                        }
                        break

            if found_work:
                selected_works.append(found_work)
                logger.info(f"Selected: {found_work['title']} by {found_work['author']} (ID: {found_work['id']})")
            else:
                logger.warning(f"Could not find downloadable version of {work['title']} by {work['author']}")

        return selected_works

    def downloadText(self, text_id: str, url: str, output_dir: str) -> Optional[str]:
        """
        Download text from Project Gutenberg URL

        Args:
            text_id: Project Gutenberg text ID
            url: Download URL
            output_dir: Directory to save raw text

        Returns:
            Path to downloaded file or None if failed
        """
        output_path = Path(output_dir) / f"pg{text_id}_raw.txt"

        if output_path.exists():
            logger.info(f"Text {text_id} already downloaded: {output_path}")
            return str(output_path)

        try:
            logger.info(f"Downloading text {text_id} from {url}")

            headers = {
                'User-Agent': 'Project Gutenberg Text Pipeline (Educational Use)'
            }

            response = requests.get(url, headers=headers, timeout=30)
            response.raise_for_status()

            # Detect encoding
            encoding = response.encoding or 'utf-8'
            text_content = response.content.decode(encoding, errors='replace')

            # Save raw text
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(text_content)

            logger.info(f"Downloaded {len(text_content)} characters to {output_path}")

            # Be respectful to server
            time.sleep(1)

            return str(output_path)

        except Exception as e:
            logger.error(f"Failed to download text {text_id}: {e}")
            return None

    def detectTextBoundaries(self, raw_text: str) -> Tuple[int, int]:
        """
        Find start and end boundaries of actual text content

        Args:
            raw_text: Raw text with Project Gutenberg headers/footers

        Returns:
            Tuple of (start_index, end_index)
        """
        text_lower = raw_text.lower()
        start_pos = 0
        end_pos = len(raw_text)

        # Find start boundary
        for marker in self.start_markers:
            pos = text_lower.find(marker.lower())
            if pos != -1:
                # Look for end of line after marker
                line_end = raw_text.find('\n', pos)
                if line_end != -1:
                    start_pos = line_end + 1
                    logger.debug(f"Found start marker: {marker} at position {pos}")
                    break

        # Find end boundary
        for marker in self.end_markers:
            pos = text_lower.find(marker.lower())
            if pos != -1:
                end_pos = pos
                logger.debug(f"Found end marker: {marker} at position {pos}")
                break

        return start_pos, end_pos

    def removeGutenbergHeaders(self, text: str) -> str:
        """
        Remove Project Gutenberg boilerplate text

        Args:
            text: Raw text content

        Returns:
            Text with headers/footers removed
        """
        start_pos, end_pos = self.detectTextBoundaries(text)

        if start_pos >= end_pos:
            logger.warning("Could not detect text boundaries, returning original text")
            return text

        # Extract main content
        main_content = text[start_pos:end_pos]

        # Remove additional common boilerplate patterns
        patterns_to_remove = [
            r'Project Gutenberg.*?eBook.*?\n',
            r'This eBook is for the use of anyone.*?\n',
            r'\*\*\*.*?\*\*\*\n',
            r'Produced by.*?\n',
            r'Updated editions will replace.*?\n',
            r'Creating the works from.*?\n'
        ]

        for pattern in patterns_to_remove:
            main_content = re.sub(pattern, '', main_content, flags=re.IGNORECASE | re.DOTALL)

        return main_content.strip()

    def normalizeLineFormat(self, text: str) -> str:
        """
        Clean line breaks, remove line numbering, normalize formatting

        Args:
            text: Text content to normalize

        Returns:
            Normalized text
        """
        # Remove excessive blank lines (more than 2 consecutive)
        text = re.sub(r'\n\s*\n\s*\n+', '\n\n', text)

        # Remove line numbers at start of lines
        text = re.sub(r'^\s*\d+\s+', '', text, flags=re.MULTILINE)

        # Remove page numbers (isolated numbers on their own lines)
        text = re.sub(r'^\s*\d+\s*$', '', text, flags=re.MULTILINE)

        # Remove excessive whitespace at line ends
        text = re.sub(r'\s+$', '', text, flags=re.MULTILINE)

        # Normalize chapter/section headers (common patterns)
        text = re.sub(r'^CHAPTER\s+([IVX\d]+)\.?\s*$', r'CHAPTER \1', text, flags=re.MULTILINE)
        text = re.sub(r'^BOOK\s+([IVX\d]+)\.?\s*$', r'BOOK \1', text, flags=re.MULTILINE)

        # Remove excessive spacing around punctuation
        text = re.sub(r'\s+([.!?;:,])', r'\1', text)

        # Normalize quotation marks
        text = re.sub(r'["""]', '"', text)
        text = re.sub(r"['']", "'", text)

        # Remove trailing whitespace and normalize line endings
        lines = [line.rstrip() for line in text.split('\n')]
        text = '\n'.join(lines)

        return text.strip()

    def validateCleanedText(self, text: str, title: str) -> Dict:
        """
        Check if cleaning worked correctly

        Args:
            text: Cleaned text
            title: Title of the work

        Returns:
            Dictionary with validation results
        """
        validation = {
            'title': title,
            'char_count': len(text),
            'word_count': len(text.split()),
            'line_count': text.count('\n') + 1,
            'paragraph_count': len([p for p in text.split('\n\n') if p.strip()]),
            'has_gutenberg_markers': False,
            'has_line_numbers': False,
            'excessive_whitespace': False,
            'quality_score': 0.0,
            'issues': []
        }

        text_lower = text.lower()

        # Check for remaining Project Gutenberg markers
        gutenberg_markers = ['project gutenberg', 'gutenberg.org', 'ebook', 'this etext']
        if any(marker in text_lower for marker in gutenberg_markers):
            validation['has_gutenberg_markers'] = True
            validation['issues'].append("Contains Project Gutenberg markers")

        # Check for line numbers
        line_number_pattern = r'^\s*\d+\s+'
        if re.search(line_number_pattern, text, re.MULTILINE):
            validation['has_line_numbers'] = True
            validation['issues'].append("Contains line numbers")

        # Check for excessive whitespace
        if re.search(r'\n\s*\n\s*\n\s*\n', text):
            validation['excessive_whitespace'] = True
            validation['issues'].append("Excessive blank lines")

        # Calculate quality score
        score = 100.0
        if validation['has_gutenberg_markers']:
            score -= 30
        if validation['has_line_numbers']:
            score -= 20
        if validation['excessive_whitespace']:
            score -= 10
        if validation['word_count'] < 1000:
            score -= 20

        validation['quality_score'] = max(0.0, score)

        return validation

    def processTestWork(self, work: Dict) -> Dict:
        """
        Process a single test work through the complete pipeline

        Args:
            work: Dictionary with id, title, author, url

        Returns:
            Processing results
        """
        logger.info(f"Processing: {work['title']} by {work['author']} (ID: {work['id']})")

        result = {
            'work': work,
            'downloaded': False,
            'cleaned': False,
            'validated': False,
            'files': {},
            'validation': None,
            'errors': []
        }

        try:
            # Step 1: Download text
            raw_file = self.downloadText(
                work['id'],
                work['url'],
                str(self.output_dir / "raw")
            )

            if not raw_file:
                result['errors'].append("Download failed")
                return result

            result['downloaded'] = True
            result['files']['raw'] = raw_file

            # Step 2: Clean text
            with open(raw_file, 'r', encoding='utf-8') as f:
                raw_text = f.read()

            # Remove headers and normalize
            cleaned_text = self.removeGutenbergHeaders(raw_text)
            cleaned_text = self.normalizeLineFormat(cleaned_text)

            # Save cleaned text
            cleaned_file = self.output_dir / "cleaned" / f"pg{work['id']}_cleaned.txt"
            with open(cleaned_file, 'w', encoding='utf-8') as f:
                f.write(cleaned_text)

            result['cleaned'] = True
            result['files']['cleaned'] = str(cleaned_file)

            # Step 3: Validate
            validation = self.validateCleanedText(cleaned_text, work['title'])

            # Save validation report
            validation_file = self.output_dir / "validation" / f"pg{work['id']}_validation.json"
            with open(validation_file, 'w', encoding='utf-8') as f:
                json.dump(validation, f, indent=2)

            result['validated'] = True
            result['files']['validation'] = str(validation_file)
            result['validation'] = validation

            logger.info(f"Completed {work['title']}: {validation['word_count']} words, quality score: {validation['quality_score']:.1f}")

        except Exception as e:
            logger.error(f"Error processing {work['title']}: {e}")
            result['errors'].append(str(e))

        return result

    def run_pipeline(self) -> Dict:
        """
        Run the complete pipeline on test works

        Returns:
            Summary of processing results
        """
        logger.info("Starting text download and cleaning pipeline")

        # Get test works
        test_works = self.get_test_works()

        if not test_works:
            logger.error("No test works found with download URLs")
            return {'error': 'No downloadable test works found'}

        logger.info(f"Found {len(test_works)} test works to process")

        # Process each work
        results = []
        for work in test_works:
            result = self.processTestWork(work)
            results.append(result)

            # Small delay between downloads
            time.sleep(2)

        # Create summary
        summary = {
            'total_works': len(results),
            'successful': len([r for r in results if r['validated']]),
            'failed': len([r for r in results if r['errors']]),
            'avg_quality_score': 0.0,
            'results': results
        }

        # Calculate average quality score
        quality_scores = [r['validation']['quality_score'] for r in results if r['validation']]
        if quality_scores:
            summary['avg_quality_score'] = sum(quality_scores) / len(quality_scores)

        # Save summary
        summary_file = self.output_dir / "pipeline_summary.json"
        with open(summary_file, 'w', encoding='utf-8') as f:
            json.dump(summary, f, indent=2)

        logger.info(f"Pipeline complete: {summary['successful']}/{summary['total_works']} works processed successfully")
        logger.info(f"Average quality score: {summary['avg_quality_score']:.1f}")
        logger.info(f"Results saved to {self.output_dir}")

        return summary


def main():
    """Main function to run the pipeline"""
    pipeline = TextPipeline()
    summary = pipeline.run_pipeline()

    if 'error' in summary:
        print(f"Error: {summary['error']}")
        return

    # Print summary
    print("\n=== Text Processing Pipeline Summary ===")
    print(f"Total works processed: {summary['total_works']}")
    print(f"Successful: {summary['successful']}")
    print(f"Failed: {summary['failed']}")
    print(f"Average quality score: {summary['avg_quality_score']:.1f}")

    print("\n=== Individual Results ===")
    for result in summary['results']:
        work = result['work']
        status = "✓" if result['validated'] else "✗"
        score = result['validation']['quality_score'] if result['validation'] else 0
        print(f"{status} {work['title']} by {work['author']} (Score: {score:.1f})")

        if result['errors']:
            print(f"   Errors: {', '.join(result['errors'])}")

        if result['validation'] and result['validation']['issues']:
            print(f"   Issues: {', '.join(result['validation']['issues'])}")


if __name__ == "__main__":
    main()