/**
 * corpus-config.js
 * Unified configuration for Gutenberg + Bible
 */

window.corpusConfig = {
    // CORS server URL (development)
    serverUrl: 'http://localhost:8001',
    
    // Gutenberg configuration
    gutenberg: {
        enabled: true,
        basePath: '/gutenberg',
        catalogPath: '/gutenberg_feeds/pg_catalog.csv'
    },
    
    // Bible configuration
    bible: {
        enabled: true,
        basePath: '/bible',
        vrefFile: '/bible/vref.txt',
        versions: [
            {
                id: 'kjv',
                file: '/bible/eng-eng-kjv.txt',
                name: 'King James Version',
                language: 'en'
            },
            {
                id: 'vulgate',
                file: '/bible/lat-lat-vul.txt',
                name: 'Vulgate',
                language: 'la'
            },
            {
                id: 'byzantine',
                file: '/bible/grc-grcbyz.txt',
                name: 'Byzantine Greek',
                language: 'grc'
            }
        ]
    }
};

// Helper function
window.getCorpusUrl = function(path) {
    const serverUrl = window.corpusConfig.serverUrl;
    if (path.startsWith('http')) return path;
    return serverUrl + path;
};

// For production, change to:
// window.corpusConfig.serverUrl = ''; // Same origin