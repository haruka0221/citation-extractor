#!/usr/bin/env python3
"""
Citation extraction engine for retrieving actual text passages from literary works and biblical sources
"""

import os
import re
import json
import requests
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from difflib import SequenceMatcher
from pathlib import Path

from citation_parser import CitationParser, CitationResult

@dataclass
class PassageCandidate:
    """Represents a candidate text passage with metadata and confidence score"""
    source: str
    confidence: float
    text: str
    metadata: Dict[str, Any]
    start_position: Optional[int] = None
    end_position: Optional[int] = None

class CitationExtractionEngine:
    """Comprehensive engine for extracting text passages from citations"""

    def __init__(self, corpus_path: str = "test_corpus", bible_api_key: Optional[str] = None):
        self.corpus_path = Path(corpus_path)
        self.bible_api_key = bible_api_key
        self.citation_parser = CitationParser()

        # Initialize text databases
        self.literary_works = self._indexLiteraryWorks()
        self.biblical_translations = self._initializeBiblicalSources()

        # Pre-compiled patterns for text extraction
        self.line_patterns = self._compileExtractionPatterns()

    def _indexLiteraryWorks(self) -> Dict[str, Dict[str, Any]]:
        """Index available literary works from the corpus"""

        works = {}

        # Check if corpus exists
        if not self.corpus_path.exists():
            print(f"Warning: Corpus path {self.corpus_path} not found")
            return works

        # Index cleaned texts
        cleaned_dir = self.corpus_path / "cleaned"
        if cleaned_dir.exists():
            for text_file in cleaned_dir.glob("*.txt"):
                work_id = text_file.stem

                # Extract metadata from filename and content
                metadata = self._extractWorkMetadata(text_file)

                works[work_id] = {
                    "file_path": text_file,
                    "metadata": metadata,
                    "normalized_title": self._normalizeTitle(metadata.get("title", work_id))
                }

        return works

    def _extractWorkMetadata(self, file_path: Path) -> Dict[str, Any]:
        """Extract metadata from literary work file"""

        metadata = {
            "title": "",
            "author": "",
            "source": "gutenberg",
            "lines": 0
        }

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
                metadata["lines"] = len(lines)

                # Extract title and author from first few lines
                if lines:
                    # Common patterns for Project Gutenberg texts
                    for i, line in enumerate(lines[:10]):
                        line = line.strip()

                        # Title detection
                        if not metadata["title"] and line and not line.startswith("Project Gutenberg"):
                            # Skip common headers
                            if not any(skip in line.lower() for skip in ["project gutenberg", "ebook", "produced by"]):
                                metadata["title"] = line

                        # Author detection
                        if "by " in line.lower() and not metadata["author"]:
                            author_match = re.search(r'by\s+([A-Za-z\s.]+)', line, re.IGNORECASE)
                            if author_match:
                                metadata["author"] = author_match.group(1).strip()

                # Fallback: derive from filename
                if not metadata["title"]:
                    filename = file_path.stem.replace("_", " ").replace("-", " ")
                    metadata["title"] = filename.title()

        except Exception as e:
            print(f"Error extracting metadata from {file_path}: {e}")

        return metadata

    def _normalizeTitle(self, title: str) -> str:
        """Normalize title for fuzzy matching"""

        # Remove common words and normalize
        title = title.lower()
        title = re.sub(r'\b(the|a|an)\b', '', title)
        title = re.sub(r'[^\w\s]', '', title)
        title = re.sub(r'\s+', ' ', title).strip()

        return title

    def _initializeBiblicalSources(self) -> Dict[str, str]:
        """Initialize biblical text sources and translations"""

        # Available translations and their APIs/sources
        translations = {
            "ESV": "English Standard Version",
            "NIV": "New International Version",
            "KJV": "King James Version",
            "NASB": "New American Standard Bible",
            "NRSV": "New Revised Standard Version"
        }

        return translations

    def _compileExtractionPatterns(self) -> Dict[str, re.Pattern]:
        """Compile regex patterns for text extraction"""

        patterns = {
            # Line number detection patterns
            'line_number': re.compile(r'^\s*(\d+)\s*[.:]?\s*(.*)$'),
            'numbered_lines': re.compile(r'^\s*\d+\s*[.:]?\s*'),

            # Structural markers
            'act_scene': re.compile(r'^(ACT|Act)\s+([IVX\d]+).*?(SCENE|Scene)\s+([IVX\d]+)', re.IGNORECASE),
            'book_canto': re.compile(r'^(BOOK|Book|CANTO|Canto)\s+([IVX\d]+)', re.IGNORECASE),
            'chapter': re.compile(r'^(CHAPTER|Chapter)\s+([IVX\d]+)', re.IGNORECASE),

            # Verse patterns for poetry
            'verse_break': re.compile(r'^\s*$'),
            'stanza_break': re.compile(r'^\s*\*\s*\*\s*\*\s*$')
        }

        return patterns

    def extractLiteraryPassage(self, work_id: str, start_line: int, end_line: int) -> Optional[PassageCandidate]:
        """Extract passage from literary work by line numbers"""

        if work_id not in self.literary_works:
            return None

        work_info = self.literary_works[work_id]
        file_path = work_info["file_path"]

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()

            # Extract the specified line range
            if start_line <= 0 or end_line > len(lines):
                return None

            # Get lines (convert to 0-based indexing)
            passage_lines = lines[start_line-1:end_line]

            # Clean up the passage
            passage_text = self._cleanPassageText(passage_lines)

            # Calculate confidence based on passage quality
            confidence = self._calculateTextQuality(passage_text)

            metadata = {
                "lines": f"{start_line}-{end_line}",
                "author": work_info["metadata"].get("author", ""),
                "title": work_info["metadata"].get("title", ""),
                "source_file": str(file_path),
                "total_lines": len(lines)
            }

            return PassageCandidate(
                source=f"gutenberg:{work_id}",
                confidence=confidence,
                text=passage_text,
                metadata=metadata,
                start_position=start_line,
                end_position=end_line
            )

        except Exception as e:
            print(f"Error extracting passage from {work_id}: {e}")
            return None

    def extractBiblicalPassage(self, book: str, chapter: int, start_verse: int,
                             end_verse: int, translation: str = "ESV") -> Optional[PassageCandidate]:
        """Extract biblical passage using online API or local sources"""

        if translation not in self.biblical_translations:
            translation = "ESV"  # Default fallback

        # For demo purposes, create sample biblical text
        # In production, this would query a real Bible API
        passage_text = self._generateSampleBiblicalText(book, chapter, start_verse, end_verse, translation)

        if not passage_text:
            return None

        metadata = {
            "book": book,
            "chapter": chapter,
            "verses": f"{start_verse}-{end_verse}" if start_verse != end_verse else str(start_verse),
            "translation": translation,
            "source": "bible_api"
        }

        # Biblical passages have high confidence when book/chapter/verse are valid
        confidence = 0.95 if self._isValidBiblicalReference(book, chapter, start_verse, end_verse) else 0.3

        return PassageCandidate(
            source=f"bible:{translation.lower()}",
            confidence=confidence,
            text=passage_text,
            metadata=metadata
        )

    def _generateSampleBiblicalText(self, book: str, chapter: int, start_verse: int,
                                  end_verse: int, translation: str) -> Optional[str]:
        """Generate sample biblical text for demonstration"""

        # Sample biblical passages for testing
        sample_passages = {
            ("Genesis", 1): {
                1: "In the beginning, God created the heavens and the earth.",
                2: "The earth was without form and void, and darkness was over the face of the deep.",
                3: "And God said, \"Let there be light,\" and there was light."
            },
            ("Matthew", 5): {
                3: "Blessed are the poor in spirit, for theirs is the kingdom of heaven.",
                4: "Blessed are those who mourn, for they shall be comforted.",
                5: "Blessed are the meek, for they shall inherit the earth."
            },
            ("Romans", 8): {
                28: "And we know that for those who love God all things work together for good, for those who are called according to his purpose."
            },
            ("1 Corinthians", 13): {
                4: "Love is patient and kind; love does not envy or boast; it is not arrogant",
                5: "or rude. It does not insist on its own way; it is not irritable or resentful;",
                6: "it does not rejoice at wrongdoing, but rejoices with the truth.",
                7: "Love bears all things, believes all things, hopes all things, endures all things."
            }
        }

        key = (book, chapter)
        if key not in sample_passages:
            return f"{book} {chapter}:{start_verse}" + (f"-{end_verse}" if start_verse != end_verse else "")

        verses = sample_passages[key]
        passage_verses = []

        for verse_num in range(start_verse, end_verse + 1):
            if verse_num in verses:
                passage_verses.append(f"{verse_num} {verses[verse_num]}")
            else:
                passage_verses.append(f"{verse_num} [Verse text not available in demo]")

        return " ".join(passage_verses)

    def _isValidBiblicalReference(self, book: str, chapter: int, start_verse: int, end_verse: int) -> bool:
        """Validate biblical reference"""

        # Basic validation - in production this would be more comprehensive
        if chapter <= 0 or start_verse <= 0 or end_verse < start_verse:
            return False

        # Check if book exists in our parser's database
        normalized_book = self.citation_parser.normalizeBookNames(book)
        return normalized_book is not None

    def generatePassageCandidates(self, citation: str, max_candidates: int = 5) -> List[PassageCandidate]:
        """Generate multiple passage candidates for a citation"""

        candidates = []

        # Parse the citation first
        parsed = self.citation_parser.parseCitation(citation)

        for parsed_citation in parsed["citations"]:
            if parsed_citation["type"] == "bible":
                # Extract biblical passage
                biblical_candidate = self.extractBiblicalPassage(
                    parsed_citation["book"],
                    parsed_citation["chapter"],
                    parsed_citation["start_verse"],
                    parsed_citation["end_verse"]
                )
                if biblical_candidate:
                    candidates.append(biblical_candidate)

            elif parsed_citation["type"] == "literature":
                # Find literary work matches
                work_title = parsed_citation["work"]
                literary_candidates = self._findLiteraryMatches(work_title, parsed_citation)
                candidates.extend(literary_candidates)

        # Rank and limit candidates
        ranked_candidates = self.rankCandidates(candidates)
        return ranked_candidates[:max_candidates]

    def _findLiteraryMatches(self, work_title: str, citation_data: Dict[str, Any]) -> List[PassageCandidate]:
        """Find literary work matches using fuzzy matching"""

        candidates = []
        normalized_title = self._normalizeTitle(work_title)

        # Score all available works
        work_scores = []
        for work_id, work_info in self.literary_works.items():
            work_normalized = work_info["normalized_title"]
            similarity = SequenceMatcher(None, normalized_title, work_normalized).ratio()

            if similarity > 0.3:  # Minimum threshold
                work_scores.append((work_id, similarity, work_info))

        # Sort by similarity
        work_scores.sort(key=lambda x: x[1], reverse=True)

        # Extract passages from top matches
        for work_id, similarity, work_info in work_scores[:3]:  # Top 3 matches
            start_line = citation_data.get("start_line", 1)
            end_line = citation_data.get("end_line", start_line)

            candidate = self.extractLiteraryPassage(work_id, start_line, end_line)
            if candidate:
                # Adjust confidence based on title match
                candidate.confidence *= similarity
                candidates.append(candidate)

        return candidates

    def calculateConfidenceScore(self, candidate: PassageCandidate, original_citation: str) -> float:
        """Calculate confidence score for a passage candidate"""

        base_confidence = candidate.confidence

        # Factors that affect confidence
        factors = {
            "text_quality": self._calculateTextQuality(candidate.text),
            "source_reliability": self._getSourceReliability(candidate.source),
            "metadata_completeness": self._getMetadataCompleteness(candidate.metadata),
            "citation_match": self._getCitationMatchScore(candidate, original_citation)
        }

        # Weighted average
        weights = {
            "text_quality": 0.3,
            "source_reliability": 0.2,
            "metadata_completeness": 0.2,
            "citation_match": 0.3
        }

        weighted_score = sum(factors[key] * weights[key] for key in factors)

        # Combine with base confidence
        final_confidence = (base_confidence + weighted_score) / 2

        return min(1.0, max(0.0, final_confidence))

    def _calculateTextQuality(self, text: str) -> float:
        """Calculate quality score for extracted text"""

        if not text:
            return 0.0

        quality_indicators = {
            "length": min(1.0, len(text) / 200),  # Prefer reasonable length
            "completeness": 1.0 if not text.endswith("...") else 0.8,
            "readability": 1.0 if re.search(r'[.!?]', text) else 0.6,  # Has punctuation
            "cleanliness": 1.0 if not re.search(r'\[.*?\]', text) else 0.7  # No missing text markers
        }

        return sum(quality_indicators.values()) / len(quality_indicators)

    def _getSourceReliability(self, source: str) -> float:
        """Get reliability score for source"""

        if source.startswith("bible:"):
            return 0.95  # Biblical sources are highly reliable
        elif source.startswith("gutenberg:"):
            return 0.85  # Project Gutenberg is reliable
        else:
            return 0.7   # Other sources

    def _getMetadataCompleteness(self, metadata: Dict[str, Any]) -> float:
        """Calculate completeness score for metadata"""

        required_fields = ["title", "author"] if "book" not in metadata else ["book", "chapter", "verses"]
        present_fields = sum(1 for field in required_fields if metadata.get(field))

        return present_fields / len(required_fields)

    def _getCitationMatchScore(self, candidate: PassageCandidate, original_citation: str) -> float:
        """Calculate how well candidate matches original citation"""

        # Basic implementation - could be enhanced with NLP
        citation_lower = original_citation.lower()

        # Check if key metadata appears in citation
        score = 0.5  # Base score

        if candidate.metadata.get("title", "").lower() in citation_lower:
            score += 0.3
        if candidate.metadata.get("author", "").lower() in citation_lower:
            score += 0.2

        return min(1.0, score)

    def _cleanPassageText(self, lines: List[str]) -> str:
        """Clean and format passage text"""

        cleaned_lines = []

        for line in lines:
            # Remove line numbers if present
            cleaned = re.sub(self.line_patterns['numbered_lines'], '', line)
            cleaned = cleaned.strip()

            if cleaned:  # Skip empty lines
                cleaned_lines.append(cleaned)

        return "\n".join(cleaned_lines)

    def rankCandidates(self, candidates: List[PassageCandidate]) -> List[PassageCandidate]:
        """Rank candidates by confidence score"""

        # Recalculate confidence scores
        for candidate in candidates:
            candidate.confidence = self.calculateConfidenceScore(candidate, "")

        # Sort by confidence (highest first)
        candidates.sort(key=lambda x: x.confidence, reverse=True)

        return candidates

    def extractPassageFromCitation(self, citation: str) -> Dict[str, Any]:
        """Main function to extract passage from citation string"""

        candidates = self.generatePassageCandidates(citation)

        # Convert candidates to dictionary format
        candidate_dicts = []
        for candidate in candidates:
            candidate_dict = {
                "source": candidate.source,
                "confidence": round(candidate.confidence, 3),
                "text": candidate.text,
                "metadata": candidate.metadata
            }
            candidate_dicts.append(candidate_dict)

        return {
            "original_citation": citation,
            "candidates": candidate_dicts,
            "best_match": candidate_dicts[0] if candidate_dicts else None
        }


if __name__ == "__main__":
    # Test the extraction engine
    engine = CitationExtractionEngine()

    test_citations = [
        "Absalom and Achitophel 1-10",
        "Genesis 1:1-3",
        "Paradise Lost Book I, 1-26",
        "Romans 8:28"
    ]

    print("=== Citation Extraction Engine Test ===\n")

    for citation in test_citations:
        print(f"Citation: '{citation}'")
        result = engine.extractPassageFromCitation(citation)

        if result["candidates"]:
            best = result["best_match"]
            print(f"Best match: {best['source']} (confidence: {best['confidence']})")
            print(f"Text: {best['text'][:100]}...")
        else:
            print("No candidates found")

        print("-" * 50)