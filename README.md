# Poetry Analysis Tool - Citation Extractor

**A web application for analyzing literary influences and source citations**

Extract text from PDF documents containing poetry and literary works, and automatically search and identify cited sources from footnotes. Access and extract precise passages from over 70,000 works in Project Gutenberg.

## ✨ Key Features

### 1. **PDF Text Extraction**
- Upload and display full PDF documents
- Automatic text input through mouse selection
- Page navigation and zoom controls

### 2. **Automatic Citation Search**
- Enter footnotes (e.g., "Paradise Lost 5-9") to automatically search for works
- Search through 70,000+ works from Project Gutenberg catalog
- Display multiple candidates with confidence scores

### 3. **Full-Text Viewer**
- Display entire works line by line
- Click to select start line, Shift+Click for end line
- Freely scroll through the entire work to adjust the exact range

### 4. **Data Saving and Export**
- Save target text and source text pairs
- Export in JSON or CSV format
- Automatic saving to browser's local storage

## 🚀 Quick Start

### Requirements
- Python 3.x (for HTTP server)
- Modern web browser (Chrome, Firefox, Edge recommended)

### Launch

#### **Windows**
```bash
# Double-click start.bat
# Or run:
start.bat
```

#### **Mac/Linux/WSL**
```bash
python3 -m http.server 8000
```

Your browser will automatically open to `http://localhost:8000`

## 📚 How to Use

### Step 1: Upload PDF
1. Click "Choose PDF File" button
2. Select a PDF containing poetry or literary works
3. All pages will load automatically

### Step 2: Select Text
1. **Target Poem Text**: Select text with mouse in PDF (odd-numbered selections)
2. **Source Influence Info**: Select footnotes or references (even-numbered selections)
3. Selections automatically alternate between the two fields

### Step 3: Search for Sources
1. When footnote is entered in Source Influence Info, "Find Sources" button appears
2. Click to automatically search for works
3. When candidates appear, select the most appropriate one

### Step 4: Adjust Line Range
1. Full-text viewer opens
2. Entire work is scrollable
3. Click to select start line, Shift+Click for end line
4. Confirm with "Confirm Selection"

### Step 5: Save and Export
1. Click "Save Pair" to save current pair
2. Saved data appears in right panel
3. Download with "Export as JSON" or "Export as CSV"

## 🎯 Citation Format Examples

The following footnote formats are automatically recognized:

```
Paradise Lost 5-9
paradise lost. 1-10
Absalom and Achitophel 7-8
absalom 1-4
Milton Paradise Lost 100-120
```

**Supported Patterns:**
- `Work Title start-end`
- `Work Title. start-end`
- `Author Work Title start-end`
- Case insensitive
- Periods and commas automatically ignored

## 📁 Project Structure

```
claude3-citation-extractor/
├── index.html                    # Main HTML
├── start.bat                     # Launch script (Windows)
├── app.js                        # PDF viewer and main logic
├── citation-integration.js       # Citation search integration
├── csv-catalog-system.js         # Project Gutenberg catalog search
├── citation-catalog.js           # Catalog management (legacy)
├── dynamic-work-catalog.js       # Dynamic catalog (legacy)
├── extractLineRange.js           # Line extraction utilities
├── full-text-viewer.js           # Full-text viewer
├── styles.css                    # Main styles
├── full-text-viewer.css          # Viewer styles
├── test_corpus/                  # Test data
│   └── cleaned/                  # Cleaned texts
│       ├── pg20_cleaned.txt      # Paradise Lost
│       ├── pg_absalom_cleaned.txt
│       └── ...
└── gutenberg_feeds/              # Project Gutenberg data
    └── pg_catalog.csv            # Works catalog (70,000 works)
```

## 🔧 Technology Stack

- **PDF.js 3.11.174** - PDF rendering and text extraction
- **Vanilla JavaScript** - No frameworks, lightweight implementation
- **Project Gutenberg** - 70,000+ literary works database
- **Local Storage** - Automatic data persistence

## 🐛 Troubleshooting

### PDF Won't Load
- Check if file size is under 50MB
- Verify it's a valid PDF file
- Check browser console (F12) for errors

### Can't Select Text
- Verify PDF.js text layer loaded properly
- Image-scanned PDFs require OCR processing

### "Find Sources" Finds Nothing
- Check footnote format (e.g., "Paradise Lost 5-9")
- Verify work exists in `test_corpus/cleaned/`
- Check browser console for errors

### Files Won't Load (CORS Error)
- **Always access via HTTP server**
- `file://` protocol cannot read local files
- Run `python -m http.server 8000`

### Scrolling Doesn't Work
- Force refresh browser (Ctrl+Shift+R)
- Clear cache

## 📊 Data Formats

### JSON Export Format
```json
{
  "metadata": {
    "exportDate": "2025-10-21T10:30:00.000Z",
    "totalPairs": 5
  },
  "document": {
    "title": "The Complete Poetical Works of Shelley",
    "author": "Percy Bysshe Shelley"
  },
  "data": [
    {
      "id": 1729501800000,
      "timestamp": "2025-10-21T10:30:00.000Z",
      "page": 17,
      "targetText": "But as our new-built city rises higher...",
      "sourceInfo": "Of these the false Achitophel was first..."
    }
  ]
}
```

### CSV Export Format
```csv
Document Title,Author,Year,ID,Timestamp,Page,Target Text,Source Info
"The Complete Poetical Works",Shelley,,1729501800000,2025-10-21T10:30:00.000Z,17,"But as...","Of these..."
```

## 🔮 Future Enhancements

- [ ] On-demand fetching of all Project Gutenberg works
- [ ] Automatic Bible citation search (BibleNLP integration)
- [ ] Multi-work simultaneous search
- [ ] Search history and caching
- [ ] Additional export formats (Markdown, LaTeX)

## 📄 License

This project was created for educational and research purposes.

**Data Sources:**
- Project Gutenberg Catalog (Public Domain)
- Project Gutenberg Texts (Public Domain)

## 🤝 Contributing

Please submit bug reports and feature requests via Issues.

---

**Created**: October 21, 2025  
**Version**: 1.0.0  
**Last Updated**: Fixed scroll issues, implemented full-text viewer