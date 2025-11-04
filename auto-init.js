/**
 * Auto-Initialization Script
 * Automatically initializes ExtendedCSVCatalogSystem on page load
 */

(function() {
    'use strict';
    
    console.log('🚀 Auto-initialization script loaded');
    
    // Wait for all scripts to load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // DOM is already loaded
        setTimeout(init, 100);
    }
    
    async function init() {
        console.log('🔄 Starting auto-initialization...');
        
        // Wait for ExtendedCSVCatalogSystem to be available
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds total
        
        const checkAndInit = async () => {
            attempts++;
            
            // Check if already initialized
            if (window.globalExtendedCSVCatalog && window.globalExtendedCSVCatalog.initialized) {
                console.log('✅ Extended CSV Catalog already initialized');
                return;
            }
            
            // Check if initialization function is available
            if (window.initializeExtendedCSVCatalogSystem) {
                try {
                    console.log('📥 Initializing Extended CSV Catalog System...');
                    window.globalExtendedCSVCatalog = await window.initializeExtendedCSVCatalogSystem();
                    
                    if (window.globalExtendedCSVCatalog && window.globalExtendedCSVCatalog.initialized) {
                        console.log('✅ Auto-initialization successful!');
                        console.log(`📚 ${Object.keys(window.globalExtendedCSVCatalog.csvCatalog).length} works available`);
                        console.log(`🔍 ${Object.keys(window.globalExtendedCSVCatalog.searchIndex).length} search keys`);
                        
                        // Notify user
                        showNotification('System initialized successfully!', 'success');
                    } else {
                        throw new Error('Initialization returned invalid object');
                    }
                } catch (error) {
                    console.error('❌ Auto-initialization failed:', error);
                    showNotification('Failed to initialize search system', 'error');
                }
            } else {
                // Not ready yet, retry
                if (attempts < maxAttempts) {
                    console.log(`⏳ Waiting for ExtendedCSVCatalogSystem... (attempt ${attempts}/${maxAttempts})`);
                    setTimeout(checkAndInit, 100);
                } else {
                    console.error('❌ ExtendedCSVCatalogSystem not found after timeout');
                    showNotification('Search system failed to load', 'error');
                }
            }
        };
        
        checkAndInit();
    }
    
    // Show notification to user
    function showNotification(message, type) {
        // Check if there's a status element
        const statusElement = document.querySelector('.citation-status');
        if (statusElement) {
            statusElement.textContent = message;
            statusElement.className = `citation-status ${type}`;
        } else {
            // Create temporary notification
            const notification = document.createElement('div');
            notification.textContent = message;
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 12px 20px;
                background: ${type === 'success' ? '#4CAF50' : '#f44336'};
                color: white;
                border-radius: 4px;
                z-index: 10000;
                font-family: Arial, sans-serif;
                box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            `;
            document.body.appendChild(notification);
            
            // Remove after 3 seconds
            setTimeout(() => notification.remove(), 3000);
        }
    }
    
})();