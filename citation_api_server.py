#!/usr/bin/env python3
"""
Simple Flask API server for citation extraction integration
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import sys
import os

# Add current directory to path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from citation_extraction_engine import CitationExtractionEngine

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Initialize citation engine
engine = CitationExtractionEngine()

@app.route('/api/citation/lookup', methods=['POST'])
def lookup_citation():
    """
    API endpoint for citation lookup
    """
    try:
        data = request.get_json()
        citation_text = data.get('citation', '').strip()

        if not citation_text:
            return jsonify({
                'error': 'Citation text is required',
                'candidates': []
            }), 400

        # Perform citation extraction
        result = engine.extractPassageFromCitation(citation_text)

        return jsonify({
            'success': True,
            'original_citation': result['original_citation'],
            'candidates': result['candidates'],
            'best_match': result['best_match']
        })

    except Exception as e:
        print(f"Error in citation lookup: {e}")
        return jsonify({
            'error': str(e),
            'candidates': []
        }), 500

@app.route('/api/citation/health', methods=['GET'])
def health_check():
    """
    Health check endpoint
    """
    return jsonify({
        'status': 'healthy',
        'service': 'citation_extraction_api',
        'version': '1.0.0'
    })

@app.route('/api/citation/engine-info', methods=['GET'])
def engine_info():
    """
    Get information about the citation engine
    """
    return jsonify({
        'literary_works': len(engine.literary_works),
        'biblical_translations': list(engine.biblical_translations.keys()),
        'corpus_path': str(engine.corpus_path),
        'available_works': list(engine.literary_works.keys())
    })

if __name__ == '__main__':
    print("🚀 Starting Citation Extraction API Server...")
    print("📚 Available literary works:", len(engine.literary_works))
    print("📖 Biblical translations:", list(engine.biblical_translations.keys()))
    print("🌐 Server will run on http://localhost:5000")
    print("🔍 API endpoints:")
    print("   POST /api/citation/lookup - Citation extraction")
    print("   GET  /api/citation/health - Health check")
    print("   GET  /api/citation/engine-info - Engine information")

    app.run(host='0.0.0.0', port=5000, debug=True)