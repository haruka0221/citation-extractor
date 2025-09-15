# Poetry Analysis Tool - Citation Extractor

A web-based application for structural analysis of poetry texts from PDF documents. This tool allows users to extract and pair target poem text with source influence information from footnotes, creating structured datasets for literary analysis.

## Features

### Core Functionality ✅ 
- **PDF Upload & Display**: Upload and view PDF documents with smooth navigation
- **TEXT SELECTION (FIXED)**: Proper text layer implementation - click and drag to select text from PDF
- **Smart Detection**: Automatically identifies footnote references vs. poem text
- **Data Management**: Persistent storage of text pairs with local storage
- **Export Options**: JSON and CSV export formats
- **Responsive Design**: Works on desktop and mobile devices

### Enhanced Navigation ✅ 
- **Direct Page Input**: Type page number and press Enter or click "Go"
- **Page Validation**: Input validation with min/max constraints
- **Multiple Navigation Methods**: Next/Prev buttons, keyboard arrows, Page Up/Down keys
- **Scroll-based Navigation**: Auto-advance pages when scrolling to bottom

### Zoom Functionality ✅ 
- **Full Zoom Control**: Zoom in/out with proper PDF scaling (50% to 300%)
- **Fit Width**: Auto-fit PDF to container width
- **Keyboard Shortcuts**: Ctrl/Cmd + Plus/Minus for zoom, Ctrl/Cmd + 0 for fit width
- **Real-time Updates**: Zoom percentage displayed and updated

### User Interface
- Clean, intuitive design with visual feedback
- **Loading Indicators**: Spinner shown during page loads and PDF processing
- PDF viewer with comprehensive controls
- Side panel for data collection and management
- **Text Highlighting**: Visual feedback when text is selected
- Real-time status updates
- Enhanced keyboard shortcuts for power users

### Technical Features
- **Text Layer Rendering**: Proper PDF.js text layer for accurate text selection
- Client-side PDF processing with PDF.js
- **Error Handling**: Comprehensive error handling and user feedback
- No server required - runs entirely in browser
- Automatic data persistence
- Cross-browser compatibility
- **Loading States**: Prevents multiple operations during page rendering

## Quick Start

1. **Setup**: Open `index.html` in a modern web browser
2. **Upload**: Click "Choose PDF File" or drag & drop a PDF document
3. **Select Text**: Click to select poem text, then footnote references
4. **Save**: Click "Save Pair" to store the data relationship
5. **Export**: Use export buttons to download your dataset

## Usage Guide

### Uploading PDFs
- Support for OCR-processed poetry collections
- Drag and drop or click to browse files
- Automatic PDF parsing and display

### Text Selection Workflow
1. **Target Text**: Select poem lines or passages from main content
2. **Source Info**: Select corresponding footnote references
3. **Validation**: System ensures both fields are filled before saving
4. **Storage**: Each pair is saved with timestamp and page number

### Data Management
- View all collected pairs in the data panel
- Delete individual entries if needed
- Export complete datasets in JSON or CSV format
- Data persists between browser sessions

### Keyboard Shortcuts
- `←/→` or `Page Up/Page Down` - Navigate pages
- `Ctrl/Cmd + +/-` - Zoom in/out
- `Ctrl/Cmd + 0` - Fit width
- `Ctrl/Cmd + S` - Save current pair
- `C` - Clear current selection
- `Enter` (in page input) - Go to specific page

## File Structure

```
claude3-citation-extractor/
├── index.html          # Main application HTML
├── styles.css          # CSS styling and responsive design
├── app.js             # Core JavaScript functionality
└── README.md          # Documentation (this file)
```

## Technical Architecture

### Components
- **PoetryAnalysisTool**: Main application class
- **PDF Rendering**: PDF.js integration for document display
- **Text Processing**: Smart footnote detection algorithms
- **Data Storage**: localStorage-based persistence
- **Export System**: JSON/CSV generation

### Key Classes and Methods
- `loadPDF()` - Handles PDF file processing
- `handleTextSelection()` - Processes user text selections
- `isFootnoteReference()` - Identifies footnote vs. regular text
- `saveCurrentPair()` - Stores target/source pairs
- `exportAsJSON()/exportAsCSV()` - Data export functions

## Browser Compatibility

### Supported Browsers
- Chrome/Chromium 70+
- Firefox 65+
- Safari 12+
- Edge 79+

### Requirements
- JavaScript enabled
- LocalStorage support
- Canvas API support
- File API support

## Extending the Application

The architecture supports future enhancements:

### Planned Features
- **Automatic Title Extraction**: Parse poem titles from text
- **Source Text Loading**: Auto-load referenced poems
- **Reference Resolution**: Parse footnote notation automatically
- **Advanced Analysis**: Text comparison and influence mapping
- **Multi-format Support**: Beyond PDF documents
- **Collaborative Features**: Multi-user access and sharing

### Extension Points
- `processSelectedText()` - Enhance text processing logic
- `isFootnoteReference()` - Add more footnote pattern recognition
- Data export functions - Add new export formats
- UI components - Add new interface elements

## Development Notes

### Code Style
- ES6+ JavaScript with class-based architecture
- Responsive CSS with mobile-first approach
- Semantic HTML structure
- No external dependencies except PDF.js CDN

### Performance Considerations
- Client-side processing for privacy and speed
- Efficient PDF rendering with canvas
- Minimal DOM manipulation
- LocalStorage for fast data persistence

## Troubleshooting

### Common Issues

**PDF not loading**
- Ensure file is valid PDF format
- Check browser console for errors
- Try smaller file size

**Text selection not working**
- Ensure PDF has rendered completely
- Check if text layer is available in PDF
- Try zooming in for better selection

**Data not saving**
- Check if localStorage is enabled
- Ensure both text fields are filled
- Clear browser cache if needed

**Export not working**
- Check popup blocker settings
- Ensure data exists before export
- Try different browser if issues persist

## Future Enhancements

### Phase 2 Features
1. **Backend Integration**: Optional server for advanced features
2. **Database Storage**: PostgreSQL/MongoDB for large datasets  
3. **User Authentication**: Multi-user support with accounts
4. **Advanced Analytics**: Statistical analysis of patterns
5. **API Integration**: Connect to external poetry databases

### Phase 3 Features
1. **Machine Learning**: Automatic influence detection
2. **Collaborative Annotation**: Team-based analysis
3. **Publication Tools**: Generate research papers
4. **Mobile App**: Native mobile applications

## License

This project is provided as-is for educational and research purposes. Feel free to modify and extend according to your needs.

## Support

For issues and questions:
- Check browser console for errors
- Ensure modern browser compatibility
- Verify PDF file format and quality
- Test with smaller files first

---

*Poetry Analysis Tool v1.0 - Built for literary scholars and researchers*
