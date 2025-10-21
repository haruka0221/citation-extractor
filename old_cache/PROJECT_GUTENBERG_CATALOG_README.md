# Project Gutenberg Catalog Parser

A comprehensive Python tool for parsing Project Gutenberg catalog data from CSV and RDF sources, creating a unified JSON catalog with search capabilities.

## Features

- **CSV Parsing**: Extracts metadata from `pg_catalog.csv` (60,948 English texts)
- **RDF Processing**: Parses RDF files for download URLs and statistics
- **Fuzzy Search**: Supports title and author searches with similarity scoring
- **Multiple Output Formats**: JSON catalog, CSV export, search index
- **Download URLs**: Direct links to plain text, HTML, EPUB, and PDF versions

## Generated Files

### Core Catalog Files
- `gutenberg_catalog.json` - Basic catalog from CSV (60,948 entries)
- `gutenberg_catalog_complete.json` - Enhanced with RDF data (814 entries with URLs)
- `gutenberg_search_index.json` - Pre-built search indices

### Catalog Structure
```json
{
  "1234": {
    "text_id": 1234,
    "title": "Book Title",
    "authors": ["Author Name"],
    "primary_author": "Author Name",
    "language": "en",
    "subjects": "Fiction; Literature",
    "issued": "2021-01-01",
    "text_url": "https://gutenberg.org/files/1234/1234-0.txt",
    "downloads": 1500,
    "file_formats": {
      "text": "https://gutenberg.org/files/1234/1234-0.txt",
      "html": "https://gutenberg.org/files/1234/1234-h.htm",
      "epub": "https://gutenberg.org/files/1234/1234.epub"
    }
  }
}
```

## Usage

### 1. Parse Catalog Data
```bash
python3 gutenberg_parser.py /path/to/gutenberg_feeds/ --output-dir ./output
```

### 2. Interactive Search
```bash
python3 search_gutenberg.py --interactive
```

### 3. Command Line Search
```bash
python3 search_gutenberg.py --search "Pride and Prejudice" --limit 5
```

### 4. View Statistics
```bash
python3 search_gutenberg.py --stats
```

## Statistics

### Catalog Overview
- **Total English Texts**: 60,948
- **Texts with Download URLs**: 814 (1.3%)
- **Average Downloads**: 364 per text
- **Most Downloaded**: "The History of Prostitution" (9,730 downloads)

### Top Authors by Text Count
1. Various: 3,628 texts
2. Anonymous: 764 texts
3. Edward Bulwer Lytton: 218 texts
4. Mark Twain: 213 texts
5. William Shakespeare: 190 texts
6. Georg Ebers: 165 texts
7. Charles Dickens: 144 texts
8. Mrs. Oliphant: 141 texts
9. Gilbert Parker: 134 texts
10. William Kingston: 133 texts

## Search Capabilities

### Fuzzy Matching
- **Exact Title Match**: Score 1.0
- **Fuzzy Title Match**: Score 0.6-0.99 (based on similarity)
- **Word Match**: Score 0.5 (matches individual words in titles)

### Search Examples
```python
# Search by title
results = parser.searchByTitle("Pride and Prejudice", index, catalog)

# Search by author
results = parser.searchByTitle("Mark Twain", index, catalog)

# Search by keywords
results = parser.searchByTitle("adventure mystery", index, catalog)
```

## File Processing Details

### CSV Processing (`pg_catalog.csv`)
- Filters for English texts only (`language == 'en'`)
- Extracts: title, authors, subjects, Library of Congress Classification
- Normalizes author names (removes birth/death dates)
- Cleans titles (removes Project Gutenberg references)

### RDF Processing (`rdf-files.tar.bz2`)
- Extracts 76,698 RDF files from compressed archive
- Parses XML metadata for each text
- Extracts download URLs for different formats
- Collects download statistics

### Search Index Building
- **Title Index**: Normalized titles for exact matching
- **Author Index**: Primary authors for author searches
- **Word Index**: Individual words from titles
- **Similarity Scoring**: Uses SequenceMatcher for fuzzy matching

## Technical Requirements

### Dependencies
```python
import csv
import json
import tarfile
import xml.etree.ElementTree as ET
from pathlib import Path
from difflib import SequenceMatcher
```

### Input Files Required
- `pg_catalog.csv` - Main catalog file
- `rdf-files.tar.bz2` - RDF metadata archive

### Memory Usage
- CSV processing: ~100MB RAM
- RDF extraction: ~500MB disk space
- Complete catalog: ~50MB JSON file

## API Functions

### Core Parser Functions
- `parseCSVCatalog(csvPath)` - Extract metadata from CSV
- `extractRDFArchive(tarPath, outputDir)` - Extract RDF files
- `parseRDFMetadata(rdfDir)` - Parse RDF for URLs
- `buildSearchIndex(catalog)` - Create search indices
- `searchByTitle(query, index)` - Fuzzy search implementation
- `saveCatalogJSON(catalog, outputPath)` - Save JSON catalog

### Search Functions
- Exact title matching
- Fuzzy string similarity (SequenceMatcher)
- Multi-word searches
- Author name searches
- Configurable result limits

## Example Searches

### Popular Books
```bash
python3 search_gutenberg.py --search "Alice Wonderland"
# Returns: Alice's Adventures in Wonderland by Lewis Carroll

python3 search_gutenberg.py --search "Moby Dick"
# Returns: Multiple versions of Moby Dick by Herman Melville

python3 search_gutenberg.py --search "Shakespeare"
# Returns: Works by and about William Shakespeare
```

### Authors
```bash
python3 search_gutenberg.py --search "Charles Dickens"
# Returns: 144 works by Charles Dickens
```

## Performance Notes

- CSV parsing: ~2-3 seconds for 76,000 rows
- RDF extraction: ~1-2 minutes for 76,698 files
- RDF parsing: Limited to 1,000 files for performance (configurable)
- Search performance: <100ms for typical queries

## Future Enhancements

1. **Full RDF Processing**: Process all 76,698 RDF files
2. **Download Validation**: Verify URL accessibility
3. **Content Analysis**: Extract text previews and word counts
4. **Advanced Search**: Boolean operators, date ranges, subject filtering
5. **Web Interface**: HTML frontend for catalog browsing
6. **Caching Layer**: Redis/SQLite for faster searches

---

Generated by Project Gutenberg Catalog Parser - September 2025