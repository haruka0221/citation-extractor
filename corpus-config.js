/**
 * corpus-config.js（完璧版）
 * ローカル環境と本番環境の両方に対応
 * 
 * 【修正内容】
 * ✅ ローカル環境: catalog を有効化、テキストサーバーのパスに対応
 * ✅ 本番環境: Apache Alias での /texts パスに対応
 * ✅ 青空文庫: ローカル・本番ともに有効化
 */

window.corpusConfig = (() => {
    const hostname = window.location.hostname;
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
    const isServer = hostname === 'bunsekisan.jp' || hostname === 'www.bunsekisan.jp';

    console.log(`📍 Environment Detection:`);
    console.log(`   Hostname: ${hostname}`);
    console.log(`   Is Localhost: ${isLocalhost}`);
    console.log(`   Is Server: ${isServer}`);

    // ========== ローカル環境用 ==========
    if (isLocalhost) {
        return {
            serverUrl: '',

            logging: {
                enabled: true,
                level: 'debug'
            },

            catalog: {
                enabled: true,
                path: '/catalog/unified_catalog.csv'
            },

            gutenberg: {
                enabled: true,
                basePath: '/texts/gutenberg',
                catalogPath: '/catalog/gutenberg_catalog.csv'
            },

            bible: {
                enabled: true,
                basePath: '/texts/bible',
                vrefFile: '/texts/bible/vref.txt',
                versions: [
                    {
                        id: 'eng-eng-kjv',
                        file: '/texts/bible/eng-eng-kjv.txt',
                        name: 'King James Version',
                        language: 'en'
                    },
                    {
                        id: 'eng-engwebp',
                        file: 'http://localhost:8002/ebible/corpus/eng-engwebp.txt',
                        name: 'World English Bible',
                        language: 'en'
                    },
                    {
                        id: 'jpn-jpn1965',
                        file: 'http://localhost:8002/ebible/corpus/jpn-jpn1965.txt',
                        name: '口語訳聖書 (1965)',
                        language: 'ja'
                    },
                ]
            },

            // ✅ 青空文庫: ローカルサーバーのAPIを使用
            aozora: {
                enabled: true,
                apiUrl: 'http://localhost:8003/api/aozora'  // ← 8003経由で本番APIを使う
            }
        };
    }

    // ========== 本番サーバー用（bunsekisan.jp） ==========
    else if (isServer) {
        return {
            serverUrl: '',

            logging: {
                enabled: false,
                level: 'warn'
            },

            catalog: {
                enabled: true,
                path: '/texts/unified_catalog.csv'
            },

            gutenberg: {
                enabled: true,
                basePath: '/texts/gutenberg',
                catalogPath: '/texts/unified_catalog.csv'
            },

            bible: {
                enabled: true,
                basePath: '/texts/bible',
                vrefFile: '/texts/bible/vref.txt',
                versions: [
                    {
                        id: 'eng-eng-kjv',
                        file: '/texts/bible/eng-eng-kjv.txt',
                        name: 'King James Version',
                        language: 'en'
                    },
                    {
                        id: 'grc-grcbyz',
                        file: '/texts/bible/grc-grcbyz.txt',
                        name: 'Greek Byzantine Text',
                        language: 'grc'
                    },
                    {
                        id: 'lat-lat-vul',
                        file: '/texts/bible/lat-lat-vul.txt',
                        name: 'Latin Vulgate',
                        language: 'la'
                    },
                    { id: 'jpn-jpn1965',   file: '/texts/bible/jpn-jpn1965.txt',   name: '口語訳聖書 (1965)',                       language: 'ja' },
                    { id: 'eng-engwebp',   file: '/texts/bible/eng-engwebp.txt',   name: 'World English Bible',                    language: 'en' },
                    { id: 'fra-fraLSG',    file: '/texts/bible/fra-fraLSG.txt',    name: 'Louis Segond (French)',                  language: 'fr' },
                    { id: 'deu-deu1951',   file: '/texts/bible/deu-deu1951.txt',   name: 'Luther Bibel 1951 (German)',             language: 'de' },
                    { id: 'spa-spaRV1909', file: '/texts/bible/spa-spaRV1909.txt', name: 'Reina Valera 1909 (Spanish)',            language: 'es' },
                    { id: 'por-porbr2018', file: '/texts/bible/por-porbr2018.txt', name: 'Nova Versão Internacional (Portuguese)', language: 'pt' },
                    { id: 'rus-russyn',    file: '/texts/bible/rus-russyn.txt',    name: 'Synodal Translation (Russian)',          language: 'ru' },
                    { id: 'hin-hincv',     file: '/texts/bible/hin-hincv.txt',     name: 'Common Version (Hindi)',                 language: 'hi' },
                    { id: 'ind-ind',       file: '/texts/bible/ind-ind.txt',       name: 'Terjemahan Baru (Indonesian)',           language: 'id' },
                    { id: 'ita-ita1927',   file: '/texts/bible/ita-ita1927.txt',   name: 'Riveduta 1927 (Italian)',               language: 'it' },
                    { id: 'nld-nld1939',   file: '/texts/bible/nld-nld1939.txt',   name: 'Statenvertaling (Dutch)',               language: 'nl' },
                    { id: 'pol-polubg',    file: '/texts/bible/pol-polubg.txt',    name: 'Gdańska (Polish)',                      language: 'pl' },
                    { id: 'ukr-ukronpu',   file: '/texts/bible/ukr-ukronpu.txt',   name: 'Ukrainian Orthodox (Ukrainian)',        language: 'uk' },
                    { id: 'swh-swhulb',    file: '/texts/bible/swh-swhulb.txt',    name: 'Unlocked Literal Bible (Swahili)',      language: 'sw' },
                    { id: 'tgl-tglulb',    file: '/texts/bible/tgl-tglulb.txt',    name: 'Unlocked Literal Bible (Tagalog)',      language: 'tl' },
                    { id: 'tha-thaKJV',    file: '/texts/bible/tha-thaKJV.txt',    name: 'KJV (Thai)',                           language: 'th' },
                    { id: 'vie-vie1934',   file: '/texts/bible/vie-vie1934.txt',   name: '1934 Version (Vietnamese)',             language: 'vi' },
                    { id: 'mya-mya',       file: '/texts/bible/mya-mya.txt',       name: 'Judson (Burmese)',                     language: 'my' }
                ]
            },

            // ✅ 青空文庫: 本番サーバーのAPIを使用
            aozora: {
                enabled: true,
                apiUrl: '/api/aozora'
            }
        };
    }

    // ========== 不明な環境 ==========
    else {
        console.warn(`⚠️  Unknown hostname: ${hostname}`);
        return {
            serverUrl: '',
            logging: { enabled: true, level: 'warn' },
            catalog: { enabled: false },
            gutenberg: { enabled: false },
            bible: { enabled: false },
            aozora: { enabled: false }
        };
    }
})();

// ========== ヘルパー関数 ==========

window.getCorpusUrl = function (path) {
    const baseUrl = window.corpusConfig.serverUrl;
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    if (!baseUrl) return path;
    if (!path.startsWith('/')) path = '/' + path;
    return baseUrl + path;
};

window.getTextFileUrl = function (source, filename) {
    const config = window.corpusConfig || {};
    let basePath;
    switch (source.toLowerCase()) {
        case 'gutenberg': basePath = config.gutenberg?.basePath || '/texts/gutenberg'; break;
        case 'aozora':    basePath = config.aozora?.basePath   || '/texts/aozora';     break;
        case 'bible':     basePath = config.bible?.basePath    || '/texts/bible';      break;
        default:          basePath = '/texts';
    }
    return getCorpusUrl(basePath.endsWith('/') ? basePath + filename : basePath + '/' + filename);
};

window.getGutenbergUrl = window.getCorpusUrl;
window.getBibleUrl     = window.getCorpusUrl;

// ========== 設定ログ（デバッグ用） ==========
if (window.corpusConfig.logging?.enabled) {
    console.log('📚 corpusConfig loaded:');
    console.log('   serverUrl:', window.corpusConfig.serverUrl || '(同一オリジン) ✅');
    console.log('   Catalog:',   window.corpusConfig.catalog?.enabled  ? `✅ enabled (${window.corpusConfig.catalog.path})` : '❌ disabled');
    console.log('   Gutenberg:', window.corpusConfig.gutenberg?.enabled ? '✅ enabled' : '❌ disabled');
    console.log('   Bible:',     window.corpusConfig.bible?.enabled     ? '✅ enabled' : '❌ disabled');
    console.log('   Aozora:',    window.corpusConfig.aozora?.enabled    ? `✅ enabled (${window.corpusConfig.aozora.apiUrl})` : '❌ disabled');
}