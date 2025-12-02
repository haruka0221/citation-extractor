/**
 * bible-config.js
 * Configuration for BibleProvider
 */

window.bibleConfig = {
    basePath: 'bible_data',
    vrefFile: 'vref.txt',
    versions: [
        // English - King James Version
        {
            id: 'kjv',
            file: 'eng-eng-kjv.txt',
            name: 'King James Version',
            language: 'en'
        },
        // Latin - Vulgate (uncomment to enable)
        {
             id: 'vulgate',
             file: 'lat-lat-vul.txt',
             name: 'Vulgate',
             language: 'la'
        },
        // Greek - Byzantine Text (uncomment to enable)
        {
             id: 'byzantine',
             file: 'grc-grcbyz.txt',
             name: 'Byzantine Greek',
             language: 'grc'
        }
    ]
};