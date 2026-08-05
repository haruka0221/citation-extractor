(function () {
    'use strict';

    const KEY_NAMES = {
        openai: 'openaiApiKey',
        anthropic: 'claudeApiKey'
    };

    const PROVIDER_LABELS = {
        openai: 'OpenAI',
        anthropic: 'Anthropic'
    };

    function initApiKeyUI() {
        const providerSelect =
            document.getElementById('apiProviderSelect');
        const keyInput =
            document.getElementById('llmApiKeyInput');
        const visibilityButton =
            document.getElementById('toggleApiKeyVisibility');
        const saveButton =
            document.getElementById('saveApiKeyForTab');
        const clearButton =
            document.getElementById('clearApiKeyForTab');
        const badge =
            document.getElementById('apiKeyStatusBadge');
        const message =
            document.getElementById('apiKeyMessage');

        if (!providerSelect ||
            !keyInput ||
            !visibilityButton ||
            !saveButton ||
            !clearButton ||
            !badge ||
            !message) {
            return;
        }

        /*
         * 以前localStorageに保存されたキーがあれば、
         * 現在のタブへ移して永続保存側から削除する。
         */
        let migratedLegacyKey = false;

        Object.values(KEY_NAMES).forEach(function (keyName) {
            const oldValue =
                localStorage.getItem(keyName);

            if (oldValue &&
                !sessionStorage.getItem(keyName)) {
                sessionStorage.setItem(
                    keyName,
                    oldValue
                );
                migratedLegacyKey = true;
            }

            if (oldValue) {
                localStorage.removeItem(keyName);
            }
        });

        const savedProvider =
            sessionStorage.getItem(
                'chushutsuApiProvider'
            );

        if (savedProvider &&
            KEY_NAMES[savedProvider]) {
            providerSelect.value = savedProvider;
        }

        function currentProvider() {
            return providerSelect.value;
        }

        function currentKeyName() {
            return KEY_NAMES[currentProvider()];
        }

        function setMessage(text, type) {
            message.textContent = text;
            message.classList.remove(
                'is-success',
                'is-error'
            );

            if (type) {
                message.classList.add(
                    'is-' + type
                );
            }
        }

        function refreshUI(customMessage) {
            const key =
                sessionStorage.getItem(
                    currentKeyName()
                ) || '';

            keyInput.value = key;

            if (key) {
                badge.textContent = 'Ready';
                badge.classList.remove('is-unset');
                badge.classList.add('is-ready');

                setMessage(
                    customMessage ||
                    PROVIDER_LABELS[
                        currentProvider()
                    ] +
                    ' key is available in this tab.',
                    'success'
                );
            } else {
                badge.textContent = 'Not set';
                badge.classList.remove('is-ready');
                badge.classList.add('is-unset');

                setMessage(
                    customMessage ||
                    'The key is kept only in this browser tab and ' +
                    'is not included in saved or exported data.'
                );
            }
        }

        function activateExtractor(provider, key) {
            const extractor =
                window.abbrevExtractor;

            if (!extractor) {
                sessionStorage.setItem(
                    KEY_NAMES[provider],
                    key
                );
                return;
            }

            if (provider === 'openai' &&
                typeof extractor.setOpenAIKey ===
                    'function') {
                extractor.setOpenAIKey(key);
            } else if (
                provider === 'anthropic' &&
                typeof extractor.setClaudeKey ===
                    'function'
            ) {
                extractor.setClaudeKey(key);
            } else {
                sessionStorage.setItem(
                    KEY_NAMES[provider],
                    key
                );

                extractor.useOpenAI =
                    provider === 'openai';
                extractor.apiKey = key;
            }
        }

        providerSelect.addEventListener(
            'change',
            function () {
                sessionStorage.setItem(
                    'chushutsuApiProvider',
                    currentProvider()
                );

                keyInput.type = 'password';
                visibilityButton.textContent = 'Show';
                refreshUI();
            }
        );

        visibilityButton.addEventListener(
            'click',
            function () {
                const showing =
                    keyInput.type === 'text';

                keyInput.type =
                    showing ? 'password' : 'text';

                visibilityButton.textContent =
                    showing ? 'Show' : 'Hide';

                visibilityButton.setAttribute(
                    'aria-label',
                    showing
                        ? 'Show API key'
                        : 'Hide API key'
                );
            }
        );

        saveButton.addEventListener(
            'click',
            function () {
                const key = keyInput.value.trim();

                if (!key) {
                    setMessage(
                        'Enter an API key first.',
                        'error'
                    );
                    keyInput.focus();
                    return;
                }

                const provider =
                    currentProvider();

                try {
                    activateExtractor(
                        provider,
                        key
                    );

                    sessionStorage.setItem(
                        'chushutsuApiProvider',
                        provider
                    );

                    refreshUI(
                        PROVIDER_LABELS[provider] +
                        ' key is ready for this tab.'
                    );
                } catch (error) {
                    console.error(
                        'API key setting error:',
                        error
                    );

                    setMessage(
                        error.message ||
                        'Could not set the API key.',
                        'error'
                    );
                }
            }
        );

        clearButton.addEventListener(
            'click',
            function () {
                const provider =
                    currentProvider();

                sessionStorage.removeItem(
                    KEY_NAMES[provider]
                );

                keyInput.value = '';

                const extractor =
                    window.abbrevExtractor;

                if (extractor) {
                    extractor.apiKey = '';

                    if (provider === 'openai') {
                        extractor.useOpenAI = true;
                    } else {
                        extractor.useOpenAI = false;
                    }
                }

                refreshUI(
                    PROVIDER_LABELS[provider] +
                    ' key was cleared from this tab.'
                );
            }
        );

        keyInput.addEventListener(
            'keydown',
            function (event) {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    saveButton.click();
                }
            }
        );

        if (migratedLegacyKey) {
            refreshUI(
                'A previously saved API key was moved to ' +
                'this tab and removed from persistent storage.'
            );
        } else {
            refreshUI();
        }
    }


    function initAiSettingsToggle() {
        const panel =
            document.getElementById('aiSettingsPanel');
        const body =
            document.getElementById('aiSettingsBody');
        const button =
            document.getElementById('toggleAiSettings');
        const chevron =
            document.getElementById('aiSettingsChevron');

        if (!panel || !body || !button || !chevron) {
            return;
        }

        const storedState =
            sessionStorage.getItem(
                'chushutsuAiSettingsOpen'
            );

        const hasApiKey =
            Boolean(
                sessionStorage.getItem('openaiApiKey')
            ) ||
            Boolean(
                sessionStorage.getItem('claudeApiKey')
            );

        /*
         * 明示的な開閉状態がまだない場合：
         * キー未設定なら開く
         * キー設定済みならコンパクトに閉じる
         */
        let isOpen;

        if (storedState === null) {
            isOpen = !hasApiKey;
        } else {
            isOpen = storedState === 'true';
        }

        function setOpen(open, remember) {
            isOpen = Boolean(open);

            body.hidden = !isOpen;

            panel.classList.toggle(
                'is-collapsed',
                !isOpen
            );

            button.setAttribute(
                'aria-expanded',
                isOpen ? 'true' : 'false'
            );

            chevron.textContent =
                isOpen ? '▲' : '▼';

            button.title =
                isOpen
                    ? 'Hide AI settings'
                    : 'Show AI settings';

            if (remember) {
                sessionStorage.setItem(
                    'chushutsuAiSettingsOpen',
                    isOpen ? 'true' : 'false'
                );
            }
        }

        button.addEventListener(
            'click',
            function () {
                setOpen(!isOpen, true);
            }
        );

        setOpen(isOpen, false);
    }

    function initDocumentToggle() {
        const button =
            document.getElementById(
                'toggleMetadataEditor'
            );

        const editor =
            document.getElementById(
                'metadataEditor'
            );

        if (!button || !editor) return;

        button.addEventListener(
            'click',
            function () {
                const willOpen = editor.hidden;

                editor.hidden = !willOpen;
                button.textContent =
                    willOpen ? 'Close ▲' : 'Edit ▼';

                button.setAttribute(
                    'aria-expanded',
                    willOpen ? 'true' : 'false'
                );
            }
        );
    }

    function init() {
        initApiKeyUI();
        initAiSettingsToggle();
        initDocumentToggle();
    }

    if (document.readyState === 'loading') {
        document.addEventListener(
            'DOMContentLoaded',
            init,
            { once: true }
        );
    } else {
        init();
    }
})();
