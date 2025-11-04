/**
 * Cache Manager for Cleaned Gutenberg Texts
 * Uses IndexedDB for persistent browser-based caching
 * Dramatically reduces load times for frequently accessed works
 */

class CacheManager {
    constructor(dbName = null, version = null) {
        // Use config if available
        const config = window.GutenbergConfig && window.GutenbergConfig.cache;
        
        this.dbName = dbName || (config && config.dbName) || 'GutenbergCache';
        this.version = version || (config && config.dbVersion) || 1;
        this.db = null;
        this.storeName = 'cleanedTexts';
        this.maxCacheSize = (config && config.maxCacheSize) || 500;
        this.maxAge = (config && config.maxAge) || (30 * 24 * 60 * 60 * 1000);
    }

    /**
     * Initialize the IndexedDB database
     */
    async initialize() {
        return new Promise((resolve, reject) => {
            console.log('🗄️ Initializing IndexedDB cache...');

            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => {
                console.error('❌ Failed to open IndexedDB:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('✅ IndexedDB cache initialized');
                this.cleanupOldEntries();
                resolve();
            };

            request.onupgradeneeded = (event) => {
                console.log('🔧 Upgrading IndexedDB schema...');
                const db = event.target.result;

                // Create object store if it doesn't exist
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, { keyPath: 'pgId' });
                    
                    // Create indexes for efficient queries
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                    store.createIndex('accessCount', 'accessCount', { unique: false });
                    
                    console.log('✅ Created object store with indexes');
                }
            };
        });
    }

    /**
     * Store cleaned text in cache
     */
    async set(pgId, cleanedText, metadata = {}) {
        if (!this.db) {
            throw new Error('Cache not initialized. Call initialize() first.');
        }

        const entry = {
            pgId: pgId.toString(),
            cleanedText: cleanedText,
            metadata: metadata,
            timestamp: Date.now(),
            accessCount: 1,
            size: cleanedText.length
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.put(entry);

            request.onsuccess = () => {
                console.log(`✅ Cached PG ${pgId} (${this.formatBytes(cleanedText.length)})`);
                this.enforceMaxCacheSize();
                resolve();
            };

            request.onerror = () => {
                console.error(`❌ Failed to cache PG ${pgId}:`, request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Retrieve cleaned text from cache
     */
    async get(pgId) {
        if (!this.db) {
            throw new Error('Cache not initialized. Call initialize() first.');
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(pgId.toString());

            request.onsuccess = () => {
                const entry = request.result;

                if (!entry) {
                    console.log(`⚠️ Cache miss for PG ${pgId}`);
                    resolve(null);
                    return;
                }

                // Check if entry is too old
                const age = Date.now() - entry.timestamp;
                if (age > this.maxAge) {
                    console.log(`⏰ Cache entry for PG ${pgId} is too old (${Math.floor(age / (24 * 60 * 60 * 1000))} days)`);
                    this.delete(pgId);
                    resolve(null);
                    return;
                }

                // Update access count and timestamp
                entry.accessCount++;
                entry.lastAccessed = Date.now();
                store.put(entry);

                console.log(`✅ Cache hit for PG ${pgId} (accessed ${entry.accessCount} times)`);
                resolve(entry.cleanedText);
            };

            request.onerror = () => {
                console.error(`❌ Failed to retrieve PG ${pgId} from cache:`, request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Check if a work is cached
     */
    async has(pgId) {
        const text = await this.get(pgId);
        return text !== null;
    }

    /**
     * Delete a cached entry
     */
    async delete(pgId) {
        if (!this.db) {
            throw new Error('Cache not initialized. Call initialize() first.');
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(pgId.toString());

            request.onsuccess = () => {
                console.log(`🗑️ Deleted cached entry for PG ${pgId}`);
                resolve();
            };

            request.onerror = () => {
                console.error(`❌ Failed to delete PG ${pgId}:`, request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Clear all cached entries
     */
    async clear() {
        if (!this.db) {
            throw new Error('Cache not initialized. Call initialize() first.');
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.clear();

            request.onsuccess = () => {
                console.log('🧹 Cache cleared');
                resolve();
            };

            request.onerror = () => {
                console.error('❌ Failed to clear cache:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Enforce maximum cache size by removing least accessed entries
     */
    async enforceMaxCacheSize() {
        const stats = await this.getStats();
        
        if (stats.count <= this.maxCacheSize) {
            return;
        }

        console.log(`⚠️ Cache size (${stats.count}) exceeds limit (${this.maxCacheSize}), cleaning up...`);

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const index = store.index('accessCount');
            const request = index.openCursor();

            const toDelete = [];

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                
                if (cursor) {
                    toDelete.push({
                        pgId: cursor.value.pgId,
                        accessCount: cursor.value.accessCount
                    });
                    cursor.continue();
                } else {
                    // Sort by access count (ascending) and delete least accessed
                    toDelete.sort((a, b) => a.accessCount - b.accessCount);
                    const numToDelete = stats.count - this.maxCacheSize;
                    
                    const deletePromises = toDelete
                        .slice(0, numToDelete)
                        .map(entry => this.delete(entry.pgId));

                    Promise.all(deletePromises)
                        .then(() => {
                            console.log(`✅ Removed ${numToDelete} least accessed entries`);
                            resolve();
                        })
                        .catch(reject);
                }
            };

            request.onerror = () => {
                console.error('❌ Failed to enforce cache size:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Remove entries older than maxAge
     */
    async cleanupOldEntries() {
        if (!this.db) {
            return;
        }

        const cutoffTime = Date.now() - this.maxAge;

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const index = store.index('timestamp');
            const range = IDBKeyRange.upperBound(cutoffTime);
            const request = index.openCursor(range);

            let deletedCount = 0;

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                
                if (cursor) {
                    cursor.delete();
                    deletedCount++;
                    cursor.continue();
                } else {
                    if (deletedCount > 0) {
                        console.log(`🧹 Cleaned up ${deletedCount} old cache entries`);
                    }
                    resolve(deletedCount);
                }
            };

            request.onerror = () => {
                console.error('❌ Failed to cleanup old entries:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Get cache statistics
     */
    async getStats() {
        if (!this.db) {
            throw new Error('Cache not initialized. Call initialize() first.');
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const countRequest = store.count();

            countRequest.onsuccess = () => {
                const count = countRequest.result;
                
                // Get all entries to calculate total size
                const getAllRequest = store.getAll();
                
                getAllRequest.onsuccess = () => {
                    const entries = getAllRequest.result;
                    const totalSize = entries.reduce((sum, entry) => sum + (entry.size || 0), 0);
                    const totalAccesses = entries.reduce((sum, entry) => sum + (entry.accessCount || 0), 0);

                    const stats = {
                        count: count,
                        totalSize: totalSize,
                        totalSizeFormatted: this.formatBytes(totalSize),
                        avgSize: count > 0 ? totalSize / count : 0,
                        avgSizeFormatted: count > 0 ? this.formatBytes(totalSize / count) : '0 B',
                        totalAccesses: totalAccesses,
                        avgAccesses: count > 0 ? (totalAccesses / count).toFixed(2) : 0,
                        maxCacheSize: this.maxCacheSize,
                        utilizationPercent: ((count / this.maxCacheSize) * 100).toFixed(1)
                    };

                    resolve(stats);
                };

                getAllRequest.onerror = () => {
                    reject(getAllRequest.error);
                };
            };

            countRequest.onerror = () => {
                reject(countRequest.error);
            };
        });
    }

    /**
     * Get list of all cached PG IDs
     */
    async getAllCachedIds() {
        if (!this.db) {
            throw new Error('Cache not initialized. Call initialize() first.');
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAllKeys();

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Format bytes to human-readable format
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Export cache statistics for debugging
     */
    async exportStats() {
        const stats = await this.getStats();
        const cachedIds = await this.getAllCachedIds();

        return {
            ...stats,
            cachedWorks: cachedIds,
            timestamp: new Date().toISOString()
        };
    }
}

// Export for use in other modules
window.CacheManager = CacheManager;
