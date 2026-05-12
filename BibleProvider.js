/**
 * BibleProvider.js
 * eBibleのvref.txt + corpus/*.txt から聖書テキストを提供
 * 
 * 仕組み:
 *   vref.txt の N行目 = corpus/*.txt の N行目 = その節のテキスト
 *   → 行番号で完全対応
 */

class BibleProvider {
    constructor() {
        this.vref = [];          // ["GEN 1:1", "GEN 1:2", ...]
        this.versions = {};      // { "eng-engwebp": ["In the beginning...", ...] }
        this.bookIndex = {};     // { "GEN": {start: 0, end: 1532}, ... }
        this.initialized = false;
    }

    async initialize(config = null) {
        try {
            console.log('🔄 BibleProvider initializing...');

            const bibleConfig = config || window.corpusConfig?.bible;
            if (!bibleConfig?.enabled) {
                console.log('ℹ️ Bible disabled in config');
                return;
            }
            if (!bibleConfig.versions || bibleConfig.versions.length === 0) {
                throw new Error('No Bible versions defined in corpus-config.js');
            }

            // Step 1: vref.txt を読み込む
            await this._loadVref(bibleConfig.vrefFile);
            console.log(`✅ vref.txt loaded: ${this.vref.length} verses`);

            // Step 2: 書ごとの行インデックスを構築
            this._buildBookIndex();
            console.log(`✅ Book index built: ${Object.keys(this.bookIndex).length} books`);

            // Step 3: 各バージョンのテキストを読み込む
            for (const ver of bibleConfig.versions) {
                try {
                    await this._loadVersion(ver.id, ver.file, ver.name, ver.language);
                    console.log(`✅ Loaded: ${ver.name} (${ver.id})`);
                } catch (e) {
                    console.warn(`⚠️ Failed to load ${ver.id}: ${e.message}`);
                }
            }

            this.initialized = true;
            const loadedVersions = Object.keys(this.versions);
            console.log(`✅ BibleProvider ready. Versions: ${loadedVersions.join(', ')}`);

        } catch (error) {
            console.error('❌ BibleProvider initialization failed:', error);
            throw error;
        }
    }

    // ─── private: vref.txt 読み込み ───────────────────────
    async _loadVref(vrefPath) {
        const url = window.getCorpusUrl ? window.getCorpusUrl(vrefPath) : vrefPath;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`vref.txt fetch failed: ${res.status} ${url}`);
        const text = await res.text();
        this.vref = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    }

    // ─── private: 書ごとの開始・終了行番号を記録 ─────────
    _buildBookIndex() {
        this.bookIndex = {};
        for (let i = 0; i < this.vref.length; i++) {
            const ref = this.vref[i];           // "GEN 1:1"
            const book = ref.split(' ')[0];     // "GEN"
            if (!this.bookIndex[book]) {
                this.bookIndex[book] = { start: i, end: i };
            } else {
                this.bookIndex[book].end = i;
            }
        }
    }

    // ─── private: バージョンファイル読み込み ─────────────
    async _loadVersion(id, filePath, name, language) {
        const url = window.getCorpusUrl ? window.getCorpusUrl(filePath) : filePath;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Corpus fetch failed: ${res.status} ${url}`);
        const text = await res.text();
        const lines = text.split('\n');
        this.versions[id] = {
            lines: lines,
            name: name,
            language: language
        };
    }

    // ─── public: 書全体を取得 ────────────────────────────
    getBook(bookCode, versionId = null) {
        if (!this.initialized) throw new Error('BibleProvider not initialized');
        const vId = versionId || Object.keys(this.versions)[0];
        const version = this.versions[vId];
        if (!version) throw new Error(`Version not found: ${vId}`);

        const idx = this.bookIndex[bookCode.toUpperCase()];
        if (!idx) throw new Error(`Book not found: ${bookCode}`);

        const verses = [];
        for (let i = idx.start; i <= idx.end; i++) {
            verses.push({
                ref: this.vref[i],
                text: version.lines[i] || ''
            });
        }
        return verses;
    }

    // ─── public: 特定の節を取得 ──────────────────────────
    getVerse(bookCode, chapter, verse, versionId = null) {
        if (!this.initialized) throw new Error('BibleProvider not initialized');
        const vId = versionId || Object.keys(this.versions)[0];
        const version = this.versions[vId];
        if (!version) throw new Error(`Version not found: ${vId}`);

        const target = `${bookCode.toUpperCase()} ${chapter}:${verse}`;
        const lineNum = this.vref.indexOf(target);
        if (lineNum === -1) throw new Error(`Verse not found: ${target}`);

        return {
            ref: target,
            text: version.lines[lineNum] || ''
        };
    }

    // ─── public: 章全体を取得 ────────────────────────────
    getChapter(bookCode, chapter, versionId = null) {
        if (!this.initialized) throw new Error('BibleProvider not initialized');
        const vId = versionId || Object.keys(this.versions)[0];
        const version = this.versions[vId];
        if (!version) throw new Error(`Version not found: ${vId}`);

        const prefix = `${bookCode.toUpperCase()} ${chapter}:`;
        const verses = [];
        for (let i = 0; i < this.vref.length; i++) {
            if (this.vref[i].startsWith(prefix)) {
                verses.push({
                    ref: this.vref[i],
                    text: version.lines[i] || ''
                });
            }
        }
        if (verses.length === 0) throw new Error(`Chapter not found: ${prefix}`);
        return verses;
    }

    // ─── public: 書コード一覧 ────────────────────────────
    getAvailableBooks() {
        return Object.keys(this.bookIndex);
    }

    // ─── public: バージョン一覧 ──────────────────────────
    getAvailableVersions() {
        return Object.entries(this.versions).map(([id, v]) => ({
            id,
            name: v.name,
            language: v.language
        }));
    }

    // ─── public: カタログID (BIBLE_GEN等) からテキストを取得 ─
    // citation-integration.jsから呼ばれる想定
    async getTextById(catalogId, versionId = null) {
        if (!this.initialized) throw new Error('BibleProvider not initialized');

        // BIBLE_GEN → GEN, BIBLE_REV → REV
        const bookCode = catalogId.replace(/^BIBLE_/, '');
        return this.getBook(bookCode, versionId);
    }
}

// グローバルに公開
window.BibleProvider = BibleProvider;