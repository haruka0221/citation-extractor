#!/usr/bin/env python3
"""
Comprehensive citation parser for literary and biblical references
"""

import re
import json
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass

@dataclass
class CitationResult:
    """Structured citation data"""
    type: str  # 'bible' | 'literature' | 'mixed'
    work: Optional[str] = None
    book: Optional[str] = None
    chapter: Optional[int] = None
    start_verse: Optional[int] = None
    end_verse: Optional[int] = None
    start_line: Optional[int] = None
    end_line: Optional[int] = None
    act: Optional[str] = None
    scene: Optional[str] = None
    book_number: Optional[str] = None  # For Paradise Lost "Book I"

class CitationParser:
    """Comprehensive parser for literary and biblical citations"""

    def __init__(self):
        self.patterns = self._defineCitationPatterns()
        self.biblical_books = self._buildBiblicalBookDatabase()

    def _defineCitationPatterns(self) -> Dict[str, re.Pattern]:
        """Define regex patterns for each citation format"""

        patterns = {}

        # Biblical citation patterns
        patterns['bible_standard'] = re.compile(
            r'([1-3]?\s*[A-Za-z]+(?:\s+of\s+[A-Za-z]+)?(?:\s+[A-Za-z]+)*)\s+(\d+):(\d+)(?:-(\d+))?',
            re.IGNORECASE
        )

        patterns['bible_multiple'] = re.compile(
            r'([1-3]?\s*[A-Za-z]+)\s+(\d+):(\d+)(?:-(\d+))?(?:\s*;\s*([1-3]?\s*[A-Za-z]+)\s+(\d+):(\d+)(?:-(\d+))?)*',
            re.IGNORECASE
        )

        # Literary citation patterns
        patterns['literature_simple'] = re.compile(
            r'([A-Za-z\s]+?)\.?\s+(\d+)(?:-(\d+))?\.?$',
            re.IGNORECASE
        )

        patterns['literature_book'] = re.compile(
            r'([A-Za-z\s]+?)\s+(?:Book\s+)?([IVX]+|[0-9]+)[\.,]\s*(\d+)(?:-(\d+))?',
            re.IGNORECASE
        )

        patterns['literature_drama'] = re.compile(
            r'([A-Za-z\s]+?)\s+Act\s+(\d+)\s+Scene\s+(\d+),?\s+(\d+)(?:-(\d+))?',
            re.IGNORECASE
        )

        # Mixed citation patterns
        patterns['mixed_reference'] = re.compile(
            r'cf\.\s*([^;]+);\s*([^;]+)',
            re.IGNORECASE
        )

        # Complex biblical references with multiple books
        patterns['bible_cross_reference'] = re.compile(
            r'([1-3]?\s*[A-Za-z]+)\s+(\d+):(\d+)(?:-(\d+))?\s*;\s*([1-3]?\s*[A-Za-z]+)\s+(\d+):(\d+)(?:-(\d+))?',
            re.IGNORECASE
        )

        return patterns

    def _buildBiblicalBookDatabase(self) -> Dict[str, str]:
        """Build database of biblical book names and their abbreviations"""

        books = {
            # Old Testament
            'genesis': 'Genesis', 'gen': 'Genesis', 'ge': 'Genesis',
            'exodus': 'Exodus', 'exod': 'Exodus', 'ex': 'Exodus',
            'leviticus': 'Leviticus', 'lev': 'Leviticus', 'le': 'Leviticus',
            'numbers': 'Numbers', 'num': 'Numbers', 'nu': 'Numbers',
            'deuteronomy': 'Deuteronomy', 'deut': 'Deuteronomy', 'dt': 'Deuteronomy',
            'joshua': 'Joshua', 'josh': 'Joshua', 'jos': 'Joshua',
            'judges': 'Judges', 'judg': 'Judges', 'jdg': 'Judges',
            'ruth': 'Ruth', 'ru': 'Ruth',
            '1 samuel': '1 Samuel', '1sam': '1 Samuel', '1sa': '1 Samuel',
            '2 samuel': '2 Samuel', '2sam': '2 Samuel', '2sa': '2 Samuel',
            '1 kings': '1 Kings', '1kgs': '1 Kings', '1ki': '1 Kings',
            '2 kings': '2 Kings', '2kgs': '2 Kings', '2ki': '2 Kings',
            '1 chronicles': '1 Chronicles', '1chr': '1 Chronicles', '1ch': '1 Chronicles',
            '2 chronicles': '2 Chronicles', '2chr': '2 Chronicles', '2ch': '2 Chronicles',
            'ezra': 'Ezra', 'ezr': 'Ezra',
            'nehemiah': 'Nehemiah', 'neh': 'Nehemiah', 'ne': 'Nehemiah',
            'esther': 'Esther', 'est': 'Esther', 'es': 'Esther',
            'job': 'Job', 'jb': 'Job',
            'psalms': 'Psalms', 'psalm': 'Psalms', 'ps': 'Psalms', 'psa': 'Psalms',
            'proverbs': 'Proverbs', 'prov': 'Proverbs', 'pr': 'Proverbs',
            'ecclesiastes': 'Ecclesiastes', 'eccl': 'Ecclesiastes', 'ec': 'Ecclesiastes',
            'song of solomon': 'Song of Solomon', 'song of songs': 'Song of Solomon', 'song': 'Song of Solomon', 'so': 'Song of Solomon', 'sos': 'Song of Solomon',
            'isaiah': 'Isaiah', 'isa': 'Isaiah', 'is': 'Isaiah',
            'jeremiah': 'Jeremiah', 'jer': 'Jeremiah', 'je': 'Jeremiah',
            'lamentations': 'Lamentations', 'lam': 'Lamentations', 'la': 'Lamentations',
            'ezekiel': 'Ezekiel', 'ezek': 'Ezekiel', 'eze': 'Ezekiel',
            'daniel': 'Daniel', 'dan': 'Daniel', 'da': 'Daniel',
            'hosea': 'Hosea', 'hos': 'Hosea', 'ho': 'Hosea',
            'joel': 'Joel', 'joe': 'Joel',
            'amos': 'Amos', 'am': 'Amos',
            'obadiah': 'Obadiah', 'obad': 'Obadiah', 'ob': 'Obadiah',
            'jonah': 'Jonah', 'jon': 'Jonah',
            'micah': 'Micah', 'mic': 'Micah', 'mi': 'Micah',
            'nahum': 'Nahum', 'nah': 'Nahum', 'na': 'Nahum',
            'habakkuk': 'Habakkuk', 'hab': 'Habakkuk', 'hb': 'Habakkuk',
            'zephaniah': 'Zephaniah', 'zeph': 'Zephaniah', 'zep': 'Zephaniah',
            'haggai': 'Haggai', 'hag': 'Haggai', 'hg': 'Haggai',
            'zechariah': 'Zechariah', 'zech': 'Zechariah', 'zec': 'Zechariah',
            'malachi': 'Malachi', 'mal': 'Malachi',

            # New Testament
            'matthew': 'Matthew', 'matt': 'Matthew', 'mt': 'Matthew',
            'mark': 'Mark', 'mk': 'Mark',
            'luke': 'Luke', 'lk': 'Luke',
            'john': 'John', 'jn': 'John',
            'acts': 'Acts', 'ac': 'Acts',
            'romans': 'Romans', 'rom': 'Romans', 'ro': 'Romans',
            '1 corinthians': '1 Corinthians', '1cor': '1 Corinthians', '1co': '1 Corinthians',
            '2 corinthians': '2 Corinthians', '2cor': '2 Corinthians', '2co': '2 Corinthians',
            'galatians': 'Galatians', 'gal': 'Galatians', 'ga': 'Galatians',
            'ephesians': 'Ephesians', 'eph': 'Ephesians', 'ep': 'Ephesians',
            'philippians': 'Philippians', 'phil': 'Philippians', 'php': 'Philippians',
            'colossians': 'Colossians', 'col': 'Colossians',
            '1 thessalonians': '1 Thessalonians', '1thess': '1 Thessalonians', '1th': '1 Thessalonians',
            '2 thessalonians': '2 Thessalonians', '2thess': '2 Thessalonians', '2th': '2 Thessalonians',
            '1 timothy': '1 Timothy', '1tim': '1 Timothy', '1ti': '1 Timothy',
            '2 timothy': '2 Timothy', '2tim': '2 Timothy', '2ti': '2 Timothy',
            'titus': 'Titus', 'tit': 'Titus', 'ti': 'Titus',
            'philemon': 'Philemon', 'phlm': 'Philemon', 'phm': 'Philemon',
            'hebrews': 'Hebrews', 'heb': 'Hebrews',
            'james': 'James', 'jas': 'James', 'ja': 'James',
            '1 peter': '1 Peter', '1pet': '1 Peter', '1pe': '1 Peter',
            '2 peter': '2 Peter', '2pet': '2 Peter', '2pe': '2 Peter',
            '1 john': '1 John', '1jn': '1 John',
            '2 john': '2 John', '2jn': '2 John',
            '3 john': '3 John', '3jn': '3 John',
            'jude': 'Jude', 'jd': 'Jude',
            'revelation': 'Revelation', 'rev': 'Revelation', 're': 'Revelation'
        }

        return books

    def normalizeBookNames(self, book_name: str) -> Optional[str]:
        """Normalize biblical book names and handle abbreviations"""

        # Clean up the book name
        clean_name = book_name.strip().lower()
        clean_name = re.sub(r'\s+', ' ', clean_name)  # Normalize whitespace

        # Handle numbered books (1 Cor, 2 Tim, etc.)
        if re.match(r'^\d+\s*[a-z]+', clean_name):
            clean_name = re.sub(r'^(\d+)\s*([a-z]+)', r'\1 \2', clean_name)

        # Look up in the database
        if clean_name in self.biblical_books:
            return self.biblical_books[clean_name]

        # Try without spaces for abbreviated forms
        no_space = clean_name.replace(' ', '')
        if no_space in self.biblical_books:
            return self.biblical_books[no_space]

        return None

    def extractWorkTitle(self, citation: str) -> Optional[str]:
        """Extract work title from literary citation"""

        # Remove common prefixes
        citation = re.sub(r'^cf\.\s*', '', citation, flags=re.IGNORECASE)
        citation = citation.strip()

        # Try different patterns to extract title

        # Drama pattern: "Hamlet Act 3 Scene 1, 56-88"
        drama_match = self.patterns['literature_drama'].match(citation)
        if drama_match:
            return drama_match.group(1).strip()

        # Book pattern: "Paradise Lost Book I, 1-26"
        book_match = self.patterns['literature_book'].match(citation)
        if book_match:
            return book_match.group(1).strip()

        # Simple pattern: "Absalom and Achitophel 1-10"
        simple_match = self.patterns['literature_simple'].match(citation)
        if simple_match:
            return simple_match.group(1).strip()

        return None

    def parseReferenceRange(self, range_text: str) -> Tuple[Optional[int], Optional[int]]:
        """Parse reference range like '1-10' or '56-88'"""

        range_text = range_text.strip()

        # Single number
        if range_text.isdigit():
            num = int(range_text)
            return num, num

        # Range format
        range_match = re.match(r'(\d+)(?:-(\d+))?', range_text)
        if range_match:
            start = int(range_match.group(1))
            end = int(range_match.group(2)) if range_match.group(2) else start
            return start, end

        return None, None

    def identifySourceType(self, citation: str) -> str:
        """Identify if citation is 'bible', 'literature', or 'mixed'"""

        # Check for mixed citations (contains semicolon and cf.)
        if 'cf.' in citation.lower() and ';' in citation:
            return 'mixed'

        # Check for biblical patterns first (more specific)
        biblical_match = self.patterns['bible_standard'].search(citation)
        if biblical_match:
            book_candidate = biblical_match.group(1)
            if self.normalizeBookNames(book_candidate):
                return 'bible'

        # Check for multiple biblical references
        if ';' in citation and ':' in citation:
            return 'bible'

        # Default to literature
        return 'literature'

    def _parseBiblicalCitation(self, citation: str) -> List[CitationResult]:
        """Parse biblical citation into structured data"""

        results = []

        # Handle multiple references separated by semicolons
        if ';' in citation:
            parts = [part.strip() for part in citation.split(';')]
            for part in parts:
                results.extend(self._parseBiblicalCitation(part))
            return results

        # Single biblical reference
        match = self.patterns['bible_standard'].match(citation.strip())
        if match:
            book_name = match.group(1)
            chapter = int(match.group(2))
            start_verse = int(match.group(3))
            end_verse = int(match.group(4)) if match.group(4) else start_verse

            normalized_book = self.normalizeBookNames(book_name)
            if normalized_book:
                results.append(CitationResult(
                    type='bible',
                    book=normalized_book,
                    chapter=chapter,
                    start_verse=start_verse,
                    end_verse=end_verse
                ))

        return results

    def _parseLiteraryCitation(self, citation: str) -> List[CitationResult]:
        """Parse literary citation into structured data"""

        results = []

        # Drama citation: "Hamlet Act 3 Scene 1, 56-88"
        drama_match = self.patterns['literature_drama'].match(citation)
        if drama_match:
            work = drama_match.group(1).strip()
            act = drama_match.group(2)
            scene = drama_match.group(3)
            start_line = int(drama_match.group(4))
            end_line = int(drama_match.group(5)) if drama_match.group(5) else start_line

            results.append(CitationResult(
                type='literature',
                work=work,
                act=act,
                scene=scene,
                start_line=start_line,
                end_line=end_line
            ))
            return results

        # Book citation: "Paradise Lost Book I, 1-26"
        book_match = self.patterns['literature_book'].match(citation)
        if book_match:
            work = book_match.group(1).strip()
            book_number = book_match.group(2)
            start_line = int(book_match.group(3))
            end_line = int(book_match.group(4)) if book_match.group(4) else start_line

            results.append(CitationResult(
                type='literature',
                work=work,
                book_number=book_number,
                start_line=start_line,
                end_line=end_line
            ))
            return results

        # Simple citation: "Absalom and Achitophel 1-10"
        simple_match = self.patterns['literature_simple'].match(citation)
        if simple_match:
            work = simple_match.group(1).strip()
            start_line = int(simple_match.group(2))
            end_line = int(simple_match.group(3)) if simple_match.group(3) else start_line

            results.append(CitationResult(
                type='literature',
                work=work,
                start_line=start_line,
                end_line=end_line
            ))
            return results

        return results

    def _parseMixedCitation(self, citation: str) -> List[CitationResult]:
        """Parse mixed citation containing both biblical and literary references"""

        results = []

        # Handle "cf. Genesis 3:15; Paradise Lost IX.1033-1045"
        mixed_match = self.patterns['mixed_reference'].match(citation)
        if mixed_match:
            first_ref = mixed_match.group(1).strip()
            second_ref = mixed_match.group(2).strip()

            # Parse each reference separately
            first_type = self.identifySourceType(first_ref)
            if first_type == 'bible':
                results.extend(self._parseBiblicalCitation(first_ref))
            else:
                results.extend(self._parseLiteraryCitation(first_ref))

            second_type = self.identifySourceType(second_ref)
            if second_type == 'bible':
                results.extend(self._parseBiblicalCitation(second_ref))
            else:
                results.extend(self._parseLiteraryCitation(second_ref))

        return results

    def parseCitation(self, footnote_text: str) -> Dict[str, Any]:
        """Main parsing function that handles all citation types"""

        footnote_text = footnote_text.strip()
        source_type = self.identifySourceType(footnote_text)

        citations = []

        if source_type == 'bible':
            citations = self._parseBiblicalCitation(footnote_text)
        elif source_type == 'literature':
            citations = self._parseLiteraryCitation(footnote_text)
        elif source_type == 'mixed':
            citations = self._parseMixedCitation(footnote_text)

        # Convert to dictionary format
        citation_dicts = []
        for citation in citations:
            result_dict = {'type': citation.type}

            if citation.work:
                result_dict['work'] = citation.work
            if citation.book:
                result_dict['book'] = citation.book
            if citation.chapter:
                result_dict['chapter'] = citation.chapter
            if citation.start_verse:
                result_dict['start_verse'] = citation.start_verse
            if citation.end_verse:
                result_dict['end_verse'] = citation.end_verse
            if citation.start_line:
                result_dict['start_line'] = citation.start_line
            if citation.end_line:
                result_dict['end_line'] = citation.end_line
            if citation.act:
                result_dict['act'] = citation.act
            if citation.scene:
                result_dict['scene'] = citation.scene
            if citation.book_number:
                result_dict['book_number'] = citation.book_number

            citation_dicts.append(result_dict)

        return {
            'citations': citation_dicts,
            'source_type': source_type,
            'original_text': footnote_text
        }


if __name__ == "__main__":
    # Test the parser with example citations
    parser = CitationParser()

    test_citations = [
        "Absalom and Achitophel 1-10",
        "Paradise Lost Book I, 1-26",
        "Hamlet Act 3 Scene 1, 56-88",
        "Genesis 1:1-3",
        "Matt 5:3-12",
        "Romans 8:28; 1 Cor 13:4-7",
        "cf. Genesis 3:15; Paradise Lost IX.1033-1045"
    ]

    print("=== Citation Parser Test Results ===\n")

    for citation in test_citations:
        print(f"Input: '{citation}'")
        result = parser.parseCitation(citation)
        print(f"Output: {json.dumps(result, indent=2)}")
        print("-" * 50)