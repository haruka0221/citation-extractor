/**
 * Configuration File for Gutenberg On-Demand System
 * Change these settings to match your environment
 */

const GutenbergConfig = {
    /**
     * ========================================
     * 🗂️ GUTENBERG MIRROR PATH
     * ========================================
     * 
     * あなたのGutenbergミラーのベースパスを指定してください。
     * 
     * Windows例:
     *   - 'C:/Users/tsuts/Documents/gutenberg_text'
     *   - '/mnt/c/Users/tsuts/Documents/gutenberg_text' (WSL)
     * 
     * Linux/Mac例:
     *   - '/home/username/gutenberg_text'
     *   - '/mnt/data/gutenberg_text'
     * 
     * ネットワークパス例:
     *   - '//server/share/gutenberg_text'
     */
    // gutenberg-config.js
mirrorBasePath: 'http://localhost:8001',

    /**
     * ========================================
     * 📚 CATALOG CSV PATH
     * ========================================
     * 
     * pg_catalog.csvファイルのパスを指定してください。
     */
    catalogCsvPath: './gutenberg_feeds/pg_catalog.csv',

    /**
     * ========================================
     * 💾 CACHE SETTINGS
     * ========================================
     */
    cache: {
        // キャッシュを有効にする
        enabled: true,

        // 最大キャッシュ数（作品数）
        maxCacheSize: 500,

        // キャッシュの有効期限（ミリ秒）
        // 30日 = 30 * 24 * 60 * 60 * 1000
        maxAge: 30 * 24 * 60 * 60 * 1000,

        // IndexedDBデータベース名
        dbName: 'GutenbergCache',

        // データベースバージョン
        dbVersion: 1
    },

    /**
     * ========================================
     * ⚡ PERFORMANCE SETTINGS
     * ========================================
     */
    performance: {
        // 並列読み込みを有効にする
        enableParallelLoad: true,

        // 最大同時読み込み数
        maxConcurrentLoads: 5,

        // 自動的に事前読み込みする作品（PG ID）
        preloadWorks: [
            20,    // Paradise Lost
            26,    // Paradise Lost (alternate)
            58,    // Paradise Regained
            100,   // Complete Works of Shakespeare
            1342,  // Pride and Prejudice
            2701,  // Moby Dick
            1661,  // Sherlock Holmes
            84,    // Frankenstein
            98,    // A Tale of Two Cities
            11,    // Alice in Wonderland
        ]
    },

    /**
     * ========================================
     * 🧹 TEXT CLEANING SETTINGS
     * ========================================
     */
    cleaning: {
        // エンコーディング修正を有効にする
        fixEncoding: true,

        // マーカー（[Illustration]など）を削除
        removeMarkers: true,

        // 空白文字を正規化
        normalizeWhitespace: true,

        // 過剰な空行を削除
        removeExcessiveBlankLines: true
    },

    /**
     * ========================================
     * 🔍 SEARCH SETTINGS
     * ========================================
     */
    search: {
        // 検索結果の最大数
        maxResults: 20,

        // ファジーマッチングの最小類似度（0.0-1.0）
        minSimilarity: 0.4,

        // 検索インデックスに含める言語
        languages: ['en', 'fr', 'de', 'es', 'it']  // 空配列 = すべての言語
    },

    /**
     * ========================================
     * 🐛 DEBUG SETTINGS
     * ========================================
     */
    debug: {
        // デバッグログを有効にする
        enabled: false,

        // 詳細ログレベル（'error', 'warn', 'info', 'debug'）
        logLevel: 'info',

        // パフォーマンス統計を自動表示
        showStats: false
    }
};

// グローバルに公開
window.GutenbergConfig = GutenbergConfig;

/**
 * ========================================
 * 📖 使用方法
 * ========================================
 * 
 * このファイルをHTMLで最初に読み込んでください：
 * 
 * <script src="gutenberg-config.js"></script>
 * <script src="GutenbergMirrorLoader.js"></script>
 * <script src="TextCleaner.js"></script>
 * ...
 * 
 * システムは自動的にこの設定を使用します。
 * 
 * または、プログラムで設定を上書き：
 * 
 * const loader = new OnDemandTextLoader({
 *     mirrorPath: GutenbergConfig.mirrorBasePath,
 *     enableCache: GutenbergConfig.cache.enabled
 * });
 */

console.log('📁 Gutenberg Config loaded');
console.log('  Mirror path:', GutenbergConfig.mirrorBasePath);
console.log('  Cache enabled:', GutenbergConfig.cache.enabled);
console.log('  Preload works:', GutenbergConfig.performance.preloadWorks.length);
