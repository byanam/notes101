document.addEventListener('DOMContentLoaded', () => {
    // ─── 0. TOP SIDEBAR SEARCH BAR ENGINE ─────────────────────────────────
    const searchInput = document.getElementById('sidebar-doc-search');
    const searchCountBadge = document.getElementById('search-count-badge');
    const searchPrevBtn = document.getElementById('search-prev-btn');
    const searchNextBtn = document.getElementById('search-next-btn');
    const searchClearBtn = document.getElementById('search-clear-btn');

    let searchMatches = [];
    let currentSearchIndex = -1;
    let preSearchScrollTop = null;

    function clearSearchHighlights() {
        const highlights = document.querySelectorAll('mark.doc-search-highlight');
        highlights.forEach(mark => {
            const parent = mark.parentNode;
            if (parent) {
                parent.replaceChild(document.createTextNode(mark.textContent), mark);
                parent.normalize();
            }
        });
        searchMatches = [];
        currentSearchIndex = -1;
    }

    function escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function highlightTextNodes(rootNode, query) {
        const walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT, {
            acceptNode: (node) => {
                if (!node.textContent || node.textContent.trim() === '') return NodeFilter.FILTER_REJECT;
                const parent = node.parentNode;
                if (!parent || !parent.classList) return NodeFilter.FILTER_REJECT;
                if (
                    parent.tagName === 'SCRIPT' ||
                    parent.tagName === 'STYLE' ||
                    parent.classList.contains('drawing-layer') ||
                    parent.classList.contains('doc-search-highlight') ||
                    parent.classList.contains('resizable-drag-handle') ||
                    parent.classList.contains('resize-handle')
                ) {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        });

        const textNodes = [];
        while (walker.nextNode()) textNodes.push(walker.currentNode);

        const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');

        textNodes.forEach(node => {
            const parent = node.parentNode;
            if (!parent) return;

            const text = node.textContent;
            if (regex.test(text)) {
                regex.lastIndex = 0;
                const frag = document.createDocumentFragment();
                let lastIdx = 0;
                let match;

                while ((match = regex.exec(text)) !== null) {
                    const matchStart = match.index;
                    const matchEnd = regex.lastIndex;

                    if (matchStart > lastIdx) {
                        frag.appendChild(document.createTextNode(text.substring(lastIdx, matchStart)));
                    }

                    const mark = document.createElement('mark');
                    mark.className = 'doc-search-highlight';
                    mark.textContent = match[0];
                    frag.appendChild(mark);

                    lastIdx = matchEnd;
                }

                if (lastIdx < text.length) {
                    frag.appendChild(document.createTextNode(text.substring(lastIdx)));
                }

                parent.replaceChild(frag, node);
            }
        });
    }

    function highlightCurrentMatch(index) {
        if (searchMatches.length === 0 || index < 0 || index >= searchMatches.length) return;

        searchMatches.forEach(m => m.classList.remove('active-match'));

        const currentEl = searchMatches[index];
        currentEl.classList.add('active-match');

        // Smooth scroll to match in editor view
        currentEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function updateSearchControls(visible, current, total) {
        if (searchCountBadge) {
            searchCountBadge.style.display = visible ? 'inline-block' : 'none';
            searchCountBadge.textContent = total > 0 ? `${current}/${total}` : '0/0';
        }
        if (searchPrevBtn) searchPrevBtn.style.display = visible && total > 1 ? 'flex' : 'none';
        if (searchNextBtn) searchNextBtn.style.display = visible && total > 1 ? 'flex' : 'none';
        if (searchClearBtn) searchClearBtn.style.display = visible ? 'flex' : 'none';
    }

    function performSearch(query) {
        clearSearchHighlights();

        if (!query || query.trim() === '') {
            updateSearchControls(false, 0, 0);

            // Scroll back to original position when search cleared
            if (preSearchScrollTop !== null) {
                const editorEl = document.getElementById('document-editor');
                if (editorEl) editorEl.scrollTo({ top: preSearchScrollTop, behavior: 'smooth' });
                preSearchScrollTop = null;
            }
            return;
        }

        const editorEl = document.getElementById('document-editor');
        if (!editorEl) return;

        // Remember initial scroll position
        if (preSearchScrollTop === null) {
            preSearchScrollTop = editorEl.scrollTop || window.scrollY;
        }

        const cleanQuery = query.trim();
        const pages = editorEl.querySelectorAll('.a4-page');

        pages.forEach(page => {
            highlightTextNodes(page, cleanQuery);
        });

        searchMatches = Array.from(editorEl.querySelectorAll('mark.doc-search-highlight'));

        if (searchMatches.length > 0) {
            currentSearchIndex = 0;
            updateSearchControls(true, 1, searchMatches.length);
            highlightCurrentMatch(0);
        } else {
            updateSearchControls(true, 0, 0);
        }
    }

    if (searchInput) {
        let debounceTimer = null;
        searchInput.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                performSearch(searchInput.value);
            }, 150);
        });

        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (searchMatches.length > 0) {
                    if (e.shiftKey) {
                        currentSearchIndex = (currentSearchIndex - 1 + searchMatches.length) % searchMatches.length;
                    } else {
                        currentSearchIndex = (currentSearchIndex + 1) % searchMatches.length;
                    }
                    highlightCurrentMatch(currentSearchIndex);
                    updateSearchControls(true, currentSearchIndex + 1, searchMatches.length);
                }
            } else if (e.key === 'Escape') {
                searchInput.value = '';
                performSearch('');
                searchInput.blur();
            }
        });
    }

    if (searchNextBtn) {
        searchNextBtn.addEventListener('click', () => {
            if (searchMatches.length > 0) {
                currentSearchIndex = (currentSearchIndex + 1) % searchMatches.length;
                highlightCurrentMatch(currentSearchIndex);
                updateSearchControls(true, currentSearchIndex + 1, searchMatches.length);
            }
        });
    }

    if (searchPrevBtn) {
        searchPrevBtn.addEventListener('click', () => {
            if (searchMatches.length > 0) {
                currentSearchIndex = (currentSearchIndex - 1 + searchMatches.length) % searchMatches.length;
                highlightCurrentMatch(currentSearchIndex);
                updateSearchControls(true, currentSearchIndex + 1, searchMatches.length);
            }
        });
    }

    if (searchClearBtn) {
        searchClearBtn.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            performSearch('');
        });
    }

    // --- Right Sidebar Toolbar Handlers (Formatting Section Complete) ---
    const formatButtons = document.querySelectorAll('.bold-italic-box .tool-pill-btn, .alignment-box .tool-pill-btn, .lists-box .tool-pill-btn, .text-format-button');

    formatButtons.forEach(btn => {
        // Prevent losing text selection in the editor when clicking toolbar buttons
        btn.addEventListener('mousedown', (e) => {
            e.preventDefault();
        });

        btn.addEventListener('click', () => {
            const title = (btn.getAttribute('title') || '').toLowerCase();
            const textContent = btn.innerText.trim();
            let command = '';

            if (title.includes('bold') || btn.querySelector('strong') || textContent === 'B') {
                command = 'bold';
            } else if (title.includes('italic') || btn.querySelector('em') || textContent === 'I') {
                command = 'italic';
            } else if (title.includes('underline') || btn.querySelector('u') || textContent === 'U') {
                command = 'underline';
            } else if (title.includes('align left')) {
                command = 'justifyLeft';
            } else if (title.includes('align center')) {
                command = 'justifyCenter';
            } else if (title.includes('align right')) {
                command = 'justifyRight';
            } else if (title.includes('bullet list')) {
                command = 'insertUnorderedList';
            } else if (title.includes('numbered list')) {
                command = 'insertOrderedList';
            } else if (title.includes('line spacing')) {
                handleLineSpacing();
            } else if (title.includes('checklist')) {
                handleChecklist();
            }

            if (command) {
                document.execCommand(command, false, null);
            }

            updateFormattingActiveStates();
            triggerEditorSave();
        });
    });

    // --- Universal Single Active Dropdown Controller ---
    function closeAllCustomDropdowns(exceptMenu = null) {
        const allDropdowns = document.querySelectorAll(
            '#custom-font-menu, #custom-size-menu, #text-color-spectrum-menu, #custom-highlight-menu, #canvas-spectrum-menu, #ink-color-spectrum-menu, .custom-font-menu, .custom-size-menu, .custom-spectrum-menu, .custom-highlight-menu'
        );

        // 1. Reset all studio rows, toolbars, triggers, sections to default z-index
        document.querySelectorAll('.studio-row, .studio-section, .dropdown-menu, .studio-swatch-group, .studio-swatch-ring, .tool-pill-row, .tool-pill-group').forEach(el => {
            el.classList.remove('menu-open');
            el.style.removeProperty('z-index');
            el.style.removeProperty('position');
        });

        // 2. Close all dropdown menus
        allDropdowns.forEach(menu => {
            if (menu !== exceptMenu) {
                menu.classList.remove('show');
                menu.classList.remove('active');
                menu.style.removeProperty('z-index');
            }
        });

        // 3. If a target menu is opening, explicitly demote ALL other rows and promote the active container chain
        if (exceptMenu) {
            exceptMenu.classList.add('show');
            exceptMenu.style.setProperty('z-index', '1000000', 'important');

            const parentTrigger = exceptMenu.closest('.dropdown-menu, .studio-swatch-group, .studio-swatch-ring');
            const parentRow = exceptMenu.closest('.studio-row');
            const parentSection = exceptMenu.closest('.studio-section');

            // Explicitly demote all other sections and rows
            document.querySelectorAll('.studio-section').forEach(sec => {
                if (sec !== parentSection) {
                    sec.style.setProperty('z-index', '0', 'important');
                }
            });

            if (parentSection) {
                parentSection.classList.add('menu-open');
                parentSection.style.setProperty('position', 'relative', 'important');
                parentSection.style.setProperty('z-index', '999999', 'important');

                parentSection.querySelectorAll('.studio-row, .tool-pill-row, .tool-pill-group').forEach(row => {
                    if (row !== parentRow) {
                        row.style.setProperty('z-index', '0', 'important');
                    }
                });
            }

            if (parentRow) {
                parentRow.classList.add('menu-open');
                parentRow.style.setProperty('position', 'relative', 'important');
                parentRow.style.setProperty('z-index', '999999', 'important');
            }

            if (parentTrigger) {
                parentTrigger.classList.add('menu-open');
                parentTrigger.style.setProperty('position', 'relative', 'important');
                parentTrigger.style.setProperty('z-index', '999999', 'important');
            }
        }
    }

    // --- Custom MS Word-Style Font Dropdown Handler ---
    const fontBoxTrigger = document.getElementById('font-box-trigger');
    const fontBoxText = document.getElementById('font-box-text');
    const customFontMenu = document.getElementById('custom-font-menu');
    let savedFontRange = null;
    let isProgrammaticFontChange = false;

    if (fontBoxTrigger && customFontMenu) {
        // Prevent losing text selection in contenteditable when clicking the font box or menu
        fontBoxTrigger.addEventListener('mousedown', (e) => {
            e.preventDefault();
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                savedFontRange = selection.getRangeAt(0).cloneRange();
            }
        });

        // Toggle custom font menu visibility (only 1 menu open at a time)
        fontBoxTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpening = !customFontMenu.classList.contains('show');
            closeAllCustomDropdowns(isOpening ? customFontMenu : null);
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!fontBoxTrigger.contains(e.target)) {
                customFontMenu.classList.remove('show');
                const parentRow = fontBoxTrigger.closest('.studio-row');
                const parentSection = fontBoxTrigger.closest('.studio-section');
                if (parentRow) {
                    parentRow.classList.remove('menu-open');
                    parentRow.style.zIndex = '';
                }
                if (parentSection) {
                    parentSection.classList.remove('menu-open');
                    parentSection.style.zIndex = '';
                }
                fontBoxTrigger.classList.remove('menu-open');
                fontBoxTrigger.style.zIndex = '';
            }
        });

        // Handle font option click
        const fontItems = customFontMenu.querySelectorAll('.font-menu-item');
        fontItems.forEach(item => {
            item.addEventListener('mousedown', (e) => {
                e.preventDefault(); // Keep selection
            });

            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const selectedFont = item.getAttribute('data-font');
                if (!selectedFont) return;

                // Lock selectionchange from immediately reverting the label
                isProgrammaticFontChange = true;

                // 1. Immediately force update text label and typeface inside the font box!
                if (fontBoxText) {
                    fontBoxText.innerText = selectedFont;
                    fontBoxText.style.fontFamily = `'${selectedFont}', sans-serif`;
                }

                // 2. Restore text selection if lost
                const selection = window.getSelection();
                if (savedFontRange) {
                    selection.removeAllRanges();
                    selection.addRange(savedFontRange);
                }

                // 3. Apply font family to active text selection in editor
                document.execCommand('fontName', false, selectedFont);

                // Also apply inline span font-family for 100% reliable rendering
                if (selection.rangeCount > 0 && !selection.isCollapsed) {
                    const range = selection.getRangeAt(0);
                    const span = document.createElement('span');
                    span.style.fontFamily = `'${selectedFont}', sans-serif`;
                    try {
                        range.surroundContents(span);
                    } catch (err) { }
                }

                // 4. Update active menu item highlight
                fontItems.forEach(i => i.classList.remove('active'));
                item.classList.add('active');

                // 5. Hide menu
                customFontMenu.classList.remove('show');

                triggerEditorSave();

                // Release lock after DOM layout settles
                setTimeout(() => {
                    isProgrammaticFontChange = false;
                }, 300);
            });
        });

        // Sync dropdown label & active state with current text selection font under cursor
        function updateFontDropdownState() {
            if (isProgrammaticFontChange) return;

            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                let node = selection.getRangeAt(0).startContainer;
                if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
                if (node && node.closest('.a4-page')) {
                    const computedFont = window.getComputedStyle(node).fontFamily;
                    fontItems.forEach(item => {
                        const fontName = item.getAttribute('data-font');
                        if (computedFont.toLowerCase().includes(fontName.toLowerCase())) {
                            if (fontBoxText) {
                                fontBoxText.innerText = fontName;
                                fontBoxText.style.fontFamily = `'${fontName}', sans-serif`;
                            }
                            fontItems.forEach(i => i.classList.remove('active'));
                            item.classList.add('active');
                        }
                    });
                }
            }
        }

        document.addEventListener('selectionchange', updateFontDropdownState);
    }

    // --- Custom Size Dropdown Handler ---
    const sizeBoxTrigger = document.getElementById('size-box-trigger');
    const sizeBoxText = document.getElementById('size-box-text');
    const customSizeMenu = document.getElementById('custom-size-menu');
    let savedSizeRange = null;
    let isProgrammaticSizeChange = false;

    if (sizeBoxTrigger && customSizeMenu) {
        sizeBoxTrigger.addEventListener('mousedown', (e) => {
            e.preventDefault();
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                savedSizeRange = selection.getRangeAt(0).cloneRange();
            }
        });

        sizeBoxTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpening = !customSizeMenu.classList.contains('show');
            closeAllCustomDropdowns(isOpening ? customSizeMenu : null);
        });

        document.addEventListener('click', (e) => {
            if (!sizeBoxTrigger.contains(e.target)) {
                customSizeMenu.classList.remove('show');
                const parentRow = sizeBoxTrigger.closest('.studio-row');
                const parentSection = sizeBoxTrigger.closest('.studio-section');
                if (parentRow) {
                    parentRow.classList.remove('menu-open');
                    parentRow.style.zIndex = '';
                }
                if (parentSection) {
                    parentSection.classList.remove('menu-open');
                    parentSection.style.zIndex = '';
                }
                sizeBoxTrigger.classList.remove('menu-open');
                sizeBoxTrigger.style.zIndex = '';
            }
        });

        const sizeItems = customSizeMenu.querySelectorAll('.size-menu-item');
        sizeItems.forEach(item => {
            item.addEventListener('mousedown', (e) => {
                e.preventDefault();
            });

            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const selectedSizeLabel = item.getAttribute('data-size'); // "Small", "Medium", "Large"
                const pxValue = item.getAttribute('data-value'); // "13px", "18px", "26px"
                if (!selectedSizeLabel) return;

                isProgrammaticSizeChange = true;

                // 1. Immediately force update text label in size box box
                if (sizeBoxText) {
                    sizeBoxText.innerText = selectedSizeLabel;
                }

                // 2. Restore text selection if lost
                const selection = window.getSelection();
                if (savedSizeRange) {
                    selection.removeAllRanges();
                    selection.addRange(savedSizeRange);
                }

                // 3. Apply font size to active selection in editor
                if (selection.rangeCount > 0 && !selection.isCollapsed) {
                    const range = selection.getRangeAt(0);
                    const span = document.createElement('span');
                    span.style.fontSize = pxValue;
                    try {
                        range.surroundContents(span);
                    } catch (err) {
                        let cmdSize = '3';
                        if (selectedSizeLabel === 'Small') cmdSize = '2';
                        if (selectedSizeLabel === 'Large') cmdSize = '5';
                        document.execCommand('fontSize', false, cmdSize);
                    }
                }

                // 4. Update active size item highlight
                sizeItems.forEach(i => i.classList.remove('active'));
                item.classList.add('active');

                // 5. Hide menu
                customSizeMenu.classList.remove('show');

                triggerEditorSave();

                setTimeout(() => {
                    isProgrammaticSizeChange = false;
                }, 300);
            });
        });

        // Sync size box label with current text selection font size under cursor
        function updateSizeDropdownState() {
            if (isProgrammaticSizeChange) return;

            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                let node = selection.getRangeAt(0).startContainer;
                if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
                if (node && node.closest('.a4-page')) {
                    const computedSizeStr = window.getComputedStyle(node).fontSize;
                    const pxNum = parseFloat(computedSizeStr);

                    let matchedLabel = 'Medium';
                    if (pxNum <= 14) {
                        matchedLabel = 'Small';
                    } else if (pxNum >= 22) {
                        matchedLabel = 'Large';
                    } else {
                        matchedLabel = 'Medium';
                    }

                    if (sizeBoxText) {
                        sizeBoxText.innerText = matchedLabel;
                    }

                    sizeItems.forEach(item => {
                        item.classList.toggle('active', item.getAttribute('data-size') === matchedLabel);
                    });
                }
            }
        }

        document.addEventListener('selectionchange', updateSizeDropdownState);
    }

    // --- Text Color Spectrum Dropdown & Swatch Handler ---
    const spectrumTrigger = document.getElementById('text-color-spectrum-trigger');
    const spectrumMenu = document.getElementById('text-color-spectrum-menu');
    const spectrumCanvas = document.getElementById('text-color-spectrum-canvas');
    const hueSlider = document.getElementById('text-color-hue-slider');
    const hexBadge = document.getElementById('text-color-hex-badge');
    const nativeColorInput = document.getElementById('text-color-native-input');
    let savedTextColorRange = null;
    let currentHue = 0;
    let isSpectrumMouseDown = false;

    if (spectrumTrigger && spectrumMenu) {
        // Preserve selection on mousedown
        spectrumTrigger.addEventListener('mousedown', (e) => {
            if (e.target.closest('#text-color-spectrum-menu')) return;
            e.preventDefault();
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                savedTextColorRange = selection.getRangeAt(0).cloneRange();
            }
        });

        // Toggle spectrum popup visibility (only 1 menu open at a time)
        spectrumTrigger.addEventListener('click', (e) => {
            if (e.target.closest('#text-color-spectrum-menu')) return;
            e.stopPropagation();
            const isOpening = !spectrumMenu.classList.contains('show');
            closeAllCustomDropdowns(isOpening ? spectrumMenu : null);
            if (isOpening) {
                drawSpectrumCanvas();
            }
        });

        // Stop propagation on spectrumMenu for mouse, click, wheel & scroll interactions
        spectrumMenu.addEventListener('click', (e) => e.stopPropagation());
        spectrumMenu.addEventListener('mousedown', (e) => e.stopPropagation());
        spectrumMenu.addEventListener('wheel', (e) => e.stopPropagation());
        spectrumMenu.addEventListener('scroll', (e) => e.stopPropagation());

        // Close spectrum menu when clicking outside both trigger and menu
        document.addEventListener('click', (e) => {
            if (!spectrumTrigger.contains(e.target) && !spectrumMenu.contains(e.target)) {
                spectrumMenu.classList.remove('show');
                spectrumTrigger.style.zIndex = '';
                const parentRow = spectrumTrigger.closest('.studio-row');
                if (parentRow) parentRow.style.zIndex = '';
            }
        });

        // Draw 2D Saturation-Lightness Spectrum Canvas
        function drawSpectrumCanvas() {
            if (!spectrumCanvas) return;
            const ctx = spectrumCanvas.getContext('2d');
            const width = spectrumCanvas.width;
            const height = spectrumCanvas.height;

            // Fill base hue color
            ctx.fillStyle = `hsl(${currentHue}, 100%, 50%)`;
            ctx.fillRect(0, 0, width, height);

            // Horizontal white-to-transparent gradient
            const whiteGrad = ctx.createLinearGradient(0, 0, width, 0);
            whiteGrad.addColorStop(0, '#ffffff');
            whiteGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = whiteGrad;
            ctx.fillRect(0, 0, width, height);

            // Vertical transparent-to-black gradient
            const blackGrad = ctx.createLinearGradient(0, 0, 0, height);
            blackGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
            blackGrad.addColorStop(1, '#000000');
            ctx.fillStyle = blackGrad;
            ctx.fillRect(0, 0, width, height);
        }

        // Pick color from canvas event
        function pickColorFromCanvas(e) {
            if (!spectrumCanvas) return;
            const rect = spectrumCanvas.getBoundingClientRect();
            const scaleX = spectrumCanvas.width / rect.width;
            const scaleY = spectrumCanvas.height / rect.height;

            let x = Math.max(0, Math.min(spectrumCanvas.width - 1, (e.clientX - rect.left) * scaleX));
            let y = Math.max(0, Math.min(spectrumCanvas.height - 1, (e.clientY - rect.top) * scaleY));

            const ctx = spectrumCanvas.getContext('2d');
            const pixel = ctx.getImageData(x, y, 1, 1).data;
            const hexColor = rgbToHex(pixel[0], pixel[1], pixel[2]);

            applyTextColor(hexColor);
        }

        if (spectrumCanvas) {
            spectrumCanvas.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const selection = window.getSelection();
                if (selection.rangeCount > 0 && !selection.isCollapsed) {
                    savedTextColorRange = selection.getRangeAt(0).cloneRange();
                }
                isSpectrumMouseDown = true;
                pickColorFromCanvas(e);
            });

            window.addEventListener('mousemove', (e) => {
                if (isSpectrumMouseDown) {
                    pickColorFromCanvas(e);
                }
            });

            window.addEventListener('mouseup', () => {
                isSpectrumMouseDown = false;
            });
        }

        // Hue Slider change handler
        if (hueSlider) {
            hueSlider.addEventListener('mousedown', (e) => e.stopPropagation());
            hueSlider.addEventListener('input', (e) => {
                currentHue = e.target.value;
                drawSpectrumCanvas();
            });
        }

        // Native Color Picker input handler
        if (nativeColorInput) {
            nativeColorInput.addEventListener('mousedown', (e) => e.stopPropagation());
            nativeColorInput.addEventListener('input', (e) => {
                applyTextColor(e.target.value);
            });
        }
    }

    // Apply chosen color to text & trigger box
    function applyTextColor(colorHex) {
        if (spectrumTrigger) {
            spectrumTrigger.style.backgroundColor = colorHex;
        }
        if (hexBadge) {
            hexBadge.innerText = colorHex.toUpperCase();
        }
        if (nativeColorInput) {
            nativeColorInput.value = colorHex;
        }

        // Restore selection if saved
        const selection = window.getSelection();
        if (savedTextColorRange) {
            selection.removeAllRanges();
            selection.addRange(savedTextColorRange);
        }

        // Apply color command
        document.execCommand('foreColor', false, colorHex);

        if (selection.rangeCount > 0 && !selection.isCollapsed) {
            const range = selection.getRangeAt(0);
            const span = document.createElement('span');
            span.style.color = colorHex;
            try {
                range.surroundContents(span);
            } catch (err) { }
        }

        // Highlight spectrum box as active
        const textColorSwatches = document.querySelectorAll('.text-colour-box .color-swatch, .text-colour-box .studio-swatch-ring');
        textColorSwatches.forEach(s => s.classList.remove('active'));
        if (spectrumTrigger) spectrumTrigger.classList.add('active');

        triggerEditorSave();
    }

    // Handle Preset Swatches (Blue, White)
    const presetSwatches = document.querySelectorAll('.text-color-preset');
    presetSwatches.forEach(swatch => {
        swatch.addEventListener('mousedown', (e) => {
            e.preventDefault();
        });

        swatch.addEventListener('click', () => {
            const color = swatch.getAttribute('data-color') || swatch.style.backgroundColor;
            if (!color) return;

            document.execCommand('foreColor', false, color);

            const selection = window.getSelection();
            if (selection.rangeCount > 0 && !selection.isCollapsed) {
                const range = selection.getRangeAt(0);
                const span = document.createElement('span');
                span.style.color = color;
                try {
                    range.surroundContents(span);
                } catch (err) { }
            }

            const textColorSwatches = document.querySelectorAll('.text-colour-box .color-swatch, .text-colour-box .studio-swatch-ring');
            textColorSwatches.forEach(s => s.classList.remove('active'));
            swatch.classList.add('active');

            triggerEditorSave();
        });
    });

    // Color Parsing & Comparison Helpers
    function rgbToHex(r, g, b) {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
    }

    function parseColorToHex(colorStr) {
        if (!colorStr) return '#000000';
        colorStr = colorStr.trim();
        if (colorStr.startsWith('#')) {
            return colorStr.toUpperCase();
        }
        const rgbMatch = colorStr.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
        if (rgbMatch) {
            const r = parseInt(rgbMatch[1], 10);
            const g = parseInt(rgbMatch[2], 10);
            const b = parseInt(rgbMatch[3], 10);
            return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
        }
        return colorStr.toUpperCase();
    }

    function rgbToHexFromStyle(colorStr) {
        return parseColorToHex(colorStr);
    }

    function isColorEqual(c1, c2) {
        if (!c1 || !c2) return false;
        return parseColorToHex(c1) === parseColorToHex(c2);
    }

    function isColorLight(hexOrRgb) {
        const hex = parseColorToHex(hexOrRgb);
        if (!hex || hex.length < 7) return true;
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        return brightness > 128;
    }

    // --- Custom Highlight Dropdown Handler ---
    const highlightBoxTrigger = document.getElementById('highlight-box-trigger');
    const highlightBoxText = document.getElementById('highlight-box-text');
    const highlightSwatchBadge = document.getElementById('highlight-swatch-badge');
    const customHighlightMenu = document.getElementById('custom-highlight-menu');
    let savedHighlightRange = null;

    if (highlightBoxTrigger && customHighlightMenu) {
        highlightBoxTrigger.addEventListener('mousedown', (e) => {
            e.preventDefault();
            const selection = window.getSelection();
            if (selection.rangeCount > 0 && !selection.isCollapsed) {
                savedHighlightRange = selection.getRangeAt(0).cloneRange();
            }
        });

        highlightBoxTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpening = !customHighlightMenu.classList.contains('show');
            closeAllCustomDropdowns(isOpening ? customHighlightMenu : null);
        });

        document.addEventListener('click', (e) => {
            if (!highlightBoxTrigger.contains(e.target)) {
                customHighlightMenu.classList.remove('show');
                const parentRow = highlightBoxTrigger.closest('.studio-row');
                const parentSection = highlightBoxTrigger.closest('.studio-section');
                if (parentRow) {
                    parentRow.classList.remove('menu-open');
                    parentRow.style.zIndex = '';
                }
                if (parentSection) {
                    parentSection.classList.remove('menu-open');
                    parentSection.style.zIndex = '';
                }
                highlightBoxTrigger.classList.remove('menu-open');
                highlightBoxTrigger.style.zIndex = '';
            }
        });

        const highlightItems = customHighlightMenu.querySelectorAll('.highlight-menu-item');
        highlightItems.forEach(item => {
            item.addEventListener('mousedown', (e) => {
                e.preventDefault();
            });

            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const color = item.getAttribute('data-color');
                const name = item.getAttribute('data-name');
                if (!color) return;

                // 1. Update preview dot and text label
                const previewDot = document.getElementById('highlight-color-preview');
                if (previewDot) previewDot.style.backgroundColor = color;
                if (highlightBoxText) highlightBoxText.textContent = item.getAttribute('title') || name || 'Yellow';

                // 2. Restore active text selection
                const selection = window.getSelection();
                if (savedHighlightRange) {
                    let node = savedHighlightRange.startContainer;
                    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
                    const editable = node ? node.closest('[contenteditable="true"]') : null;
                    if (editable) editable.focus();

                    selection.removeAllRanges();
                    selection.addRange(savedHighlightRange);
                }

                // 3. Apply highlight color to text selection
                try {
                    document.execCommand('styleWithCSS', false, true);
                } catch (err) { }

                try {
                    document.execCommand('hiliteColor', false, color);
                } catch (err) {
                    try {
                        document.execCommand('backColor', false, color);
                    } catch (err2) { }
                }

                // 4. Update active menu item highlight
                highlightItems.forEach(i => i.classList.remove('active'));
                item.classList.add('active');

                // 5. Hide menu
                customHighlightMenu.classList.remove('show');

                triggerEditorSave();
            });
        });
    }

    // --- CANVAS Spectrum & Recent Canvas Colors Handler ---
    const canvasTrigger = document.getElementById('canvas-spectrum-trigger');
    const canvasMenu = document.getElementById('canvas-spectrum-menu');
    const canvasCanvas = document.getElementById('canvas-spectrum-canvas');
    const canvasHueSlider = document.getElementById('canvas-hue-slider');
    const canvasHexBadge = document.getElementById('canvas-hex-badge');
    const canvasNativeInput = document.getElementById('canvas-native-input');
    const recentCanvas1Btn = document.getElementById('recent-canvas-1');
    const recentCanvas2Btn = document.getElementById('recent-canvas-2');

    let currentCanvasHue = 0;
    let isCanvasSpectrumMouseDown = false;

    if (canvasTrigger && canvasMenu) {
        canvasTrigger.addEventListener('click', (e) => {
            if (e.target.closest('#canvas-spectrum-menu')) return;
            e.stopPropagation();
            const isOpening = !canvasMenu.classList.contains('show');
            closeAllCustomDropdowns(isOpening ? canvasMenu : null);
            if (isOpening) {
                drawCanvasSpectrumCanvas();
            }
        });

        canvasMenu.addEventListener('click', (e) => e.stopPropagation());
        canvasMenu.addEventListener('mousedown', (e) => e.stopPropagation());
        canvasMenu.addEventListener('wheel', (e) => e.stopPropagation());
        canvasMenu.addEventListener('scroll', (e) => e.stopPropagation());

        function drawCanvasSpectrumCanvas() {
            if (!canvasCanvas) return;
            const ctx = canvasCanvas.getContext('2d');
            const width = canvasCanvas.width;
            const height = canvasCanvas.height;

            ctx.fillStyle = `hsl(${currentCanvasHue}, 100%, 50%)`;
            ctx.fillRect(0, 0, width, height);

            const whiteGrad = ctx.createLinearGradient(0, 0, width, 0);
            whiteGrad.addColorStop(0, '#ffffff');
            whiteGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = whiteGrad;
            ctx.fillRect(0, 0, width, height);

            const blackGrad = ctx.createLinearGradient(0, 0, 0, height);
            blackGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
            blackGrad.addColorStop(1, '#000000');
            ctx.fillStyle = blackGrad;
            ctx.fillRect(0, 0, width, height);
        }

        function pickCanvasFromCanvas(e) {
            if (!canvasCanvas) return;
            const rect = canvasCanvas.getBoundingClientRect();
            const scaleX = canvasCanvas.width / rect.width;
            const scaleY = canvasCanvas.height / rect.height;

            let x = Math.max(0, Math.min(canvasCanvas.width - 1, (e.clientX - rect.left) * scaleX));
            let y = Math.max(0, Math.min(canvasCanvas.height - 1, (e.clientY - rect.top) * scaleY));

            const ctx = canvasCanvas.getContext('2d');
            const pixel = ctx.getImageData(x, y, 1, 1).data;
            const hexColor = rgbToHex(pixel[0], pixel[1], pixel[2]);

            applyCanvasColor(hexColor);
        }

        if (canvasCanvas) {
            canvasCanvas.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                isCanvasSpectrumMouseDown = true;
                pickCanvasFromCanvas(e);
            });

            window.addEventListener('mousemove', (e) => {
                if (isCanvasSpectrumMouseDown) {
                    pickCanvasFromCanvas(e);
                }
            });

            window.addEventListener('mouseup', () => {
                if (isCanvasSpectrumMouseDown) {
                    isCanvasSpectrumMouseDown = false;
                    if (window.currentCanvasColor) {
                        updateRecentCanvasHistory(window.currentCanvasColor);
                    }
                }
            });
        }

        if (canvasHueSlider) {
            canvasHueSlider.addEventListener('mousedown', (e) => e.stopPropagation());
            canvasHueSlider.addEventListener('input', (e) => {
                currentCanvasHue = e.target.value;
                drawCanvasSpectrumCanvas();
            });
        }

        if (canvasNativeInput) {
            canvasNativeInput.addEventListener('mousedown', (e) => e.stopPropagation());
            canvasNativeInput.addEventListener('input', (e) => {
                applyCanvasColor(e.target.value);
            });
        }
    }

    function updateRecentCanvasHistory(newColorHex) {
        if (!canvasTrigger) return;
        newColorHex = parseColorToHex(newColorHex);
        const previousMainColor = parseColorToHex(canvasTrigger.style.backgroundColor || '#191919');

        if (isColorEqual(previousMainColor, newColorHex)) return;

        const currentRecent1 = recentCanvas1Btn ? parseColorToHex(recentCanvas1Btn.getAttribute('data-color') || recentCanvas1Btn.style.backgroundColor || '#ffffff') : '#FFFFFF';

        if (recentCanvas2Btn && currentRecent1) {
            recentCanvas2Btn.style.backgroundColor = currentRecent1;
            recentCanvas2Btn.setAttribute('data-color', currentRecent1);
            recentCanvas2Btn.title = `Recent Canvas: ${currentRecent1}`;
        }

        if (recentCanvas1Btn && previousMainColor) {
            recentCanvas1Btn.style.backgroundColor = previousMainColor;
            recentCanvas1Btn.setAttribute('data-color', previousMainColor);
            recentCanvas1Btn.title = `Recent Canvas: ${previousMainColor}`;
        }
    }

    let currentCanvasColor = '#191919';

    function applyCanvasColor(colorHex, updateHistory = false) {
        colorHex = parseColorToHex(colorHex);
        currentCanvasColor = colorHex;
        window.currentCanvasColor = colorHex;

        if (updateHistory) {
            updateRecentCanvasHistory(colorHex);
        }

        if (canvasTrigger) {
            canvasTrigger.style.backgroundColor = colorHex;
        }
        if (canvasHexBadge) {
            canvasHexBadge.innerText = colorHex.toUpperCase();
        }
        if (canvasNativeInput) {
            canvasNativeInput.value = colorHex;
        }

        // Apply background color strictly to A4 page elements only
        const pages = document.querySelectorAll('.a4-page');
        pages.forEach(page => {
            page.style.setProperty('background-color', colorHex, 'important');
        });

        const canvasSwatches = document.querySelectorAll('.page-colour-box .color-swatch, .page-colour-box .studio-swatch-ring');
        canvasSwatches.forEach(s => s.classList.remove('active'));
        if (canvasTrigger) canvasTrigger.classList.add('active');

        triggerEditorSave();
    }

    const recentCanvasBtns = document.querySelectorAll('.recent-canvas-btn');
    recentCanvasBtns.forEach(swatch => {
        swatch.addEventListener('mousedown', (e) => {
            e.preventDefault();
        });

        swatch.addEventListener('click', () => {
            const colorRaw = swatch.getAttribute('data-color') || swatch.style.backgroundColor;
            if (!colorRaw) return;
            const color = parseColorToHex(colorRaw);

            applyCanvasColor(color, true);
        });
    });

    // Observer to re-apply canvas color ONLY when new A4 pages are added
    const pageObserver = new MutationObserver((mutations) => {
        let hasNewPage = false;
        for (const m of mutations) {
            if (m.addedNodes.length > 0) {
                hasNewPage = true;
                break;
            }
        }
        if (hasNewPage && window.currentCanvasColor) {
            const pages = document.querySelectorAll('.a4-page');
            pages.forEach(p => p.style.setProperty('background-color', window.currentCanvasColor, 'important'));
        }
    });
    const docEditorContainer = document.getElementById('document-editor') || document.querySelector('.main-content-area');
    if (docEditorContainer) {
        pageObserver.observe(docEditorContainer, { childList: true });
    }

    // --- Line Spacing Handler ---
    function handleLineSpacing() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        let node = selection.getRangeAt(0).startContainer;
        if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;

        const block = node.closest('.a4-page div, .a4-page p, .a4-page li, .a4-page h1, .a4-page h2, .a4-page h3') || node.closest('.a4-page');
        if (!block) return;

        const currentSpacing = block.style.lineHeight || '1.8';
        let nextSpacing = '1.8';

        if (currentSpacing === '1.8' || currentSpacing === 'normal' || !currentSpacing) {
            nextSpacing = '1.2';
        } else if (currentSpacing === '1.2') {
            nextSpacing = '1.5';
        } else if (currentSpacing === '1.5') {
            nextSpacing = '2.0';
        } else {
            nextSpacing = '1.8';
        }

        block.style.lineHeight = nextSpacing;
    }

    // --- Caret Positioning Helper ---
    function setCaretToNode(node, offset = 0) {
        if (!node) return;
        node.focus();
        const range = document.createRange();
        const sel = window.getSelection();
        if (node.firstChild && node.firstChild.nodeType === Node.TEXT_NODE) {
            try {
                range.setStart(node.firstChild, Math.min(offset, node.firstChild.length || 0));
            } catch (e) {
                range.setStart(node, 0);
            }
        } else {
            range.setStart(node, 0);
        }
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
    }

    // --- Interactive Checklist Handler ---
    function handleChecklist() {
        const selection = window.getSelection();
        let selectedText = '';
        if (selection.rangeCount > 0) {
            selectedText = selection.toString().trim();
        }

        const checklistHtml = `
            <div class="checklist-row" style="display: flex; align-items: baseline; gap: 8px; margin: 4px 0; min-height: 22px;">
                <span class="checklist-checkbox-container" contenteditable="false" style="user-select: none; -webkit-user-select: none; display: inline-flex; align-items: center; margin-right: 2px;">
                    <input type="checkbox" class="task-checkbox" style="cursor: pointer; width: 14px; height: 14px; accent-color: #e2d7ca; vertical-align: middle;">
                </span>
                <span class="task-text" contenteditable="true" style="flex: 1; outline: none; color: inherit; font-family: inherit; min-width: 30px;">${selectedText || '<br>'}</span>
            </div>`;

        // If current block is an empty <p> or line inside an active page, replace it smoothly
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            let block = range.startContainer.nodeType === Node.ELEMENT_NODE ? range.startContainer : range.startContainer.parentElement;
            const closestP = block ? block.closest('p, div:not(.checklist-row):not(.a4-page)') : null;
            if (closestP && closestP.innerText.trim() === '' && closestP.parentElement && closestP.parentElement.classList.contains('a4-page')) {
                const temp = document.createElement('div');
                temp.innerHTML = checklistHtml.trim();
                const newRow = temp.firstElementChild;
                closestP.parentElement.replaceChild(newRow, closestP);
                const taskText = newRow.querySelector('.task-text');
                if (taskText) {
                    setCaretToNode(taskText, 0);
                }
                triggerEditorSave();
                return;
            }
        }

        document.execCommand('insertHTML', false, checklistHtml);
        triggerEditorSave();
    }

    // --- Global Keyboard & Interaction Handler for Checklists ---
    document.addEventListener('keydown', (e) => {
        const selection = window.getSelection();
        if (!selection || !selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        let node = range.startContainer;
        if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;

        const checklistRow = node ? node.closest('.checklist-row') : null;
        if (!checklistRow) return;

        const taskText = checklistRow.querySelector('.task-text') || checklistRow;
        const textContent = (taskText.innerText || '').replace(/\u200B/g, '').replace(/\n/g, '').trim();

        // 1. BACKSPACE key: Delete or Convert checklist item
        if (e.key === 'Backspace') {
            const isAtStart = (range.startOffset === 0 && range.endOffset === 0 && 
                (range.startContainer === taskText || range.startContainer === taskText.firstChild || range.startContainer === checklistRow));
            const isEmpty = textContent === '' || taskText.innerHTML === '<br>' || taskText.innerHTML === '';

            if (isEmpty || isAtStart) {
                e.preventDefault();
                const parent = checklistRow.parentElement;
                if (!parent) return;

                if (isEmpty) {
                    // Turn into normal empty paragraph or clean line
                    const newP = document.createElement('p');
                    newP.innerHTML = '<br>';
                    parent.replaceChild(newP, checklistRow);
                    setCaretToNode(newP, 0);
                } else {
                    // Convert checklist row into normal paragraph retaining the text
                    const newP = document.createElement('p');
                    newP.innerHTML = taskText.innerHTML;
                    parent.replaceChild(newP, checklistRow);
                    setCaretToNode(newP, 0);
                }
                triggerEditorSave();
                return;
            }
        }

        // 2. ENTER key: Create next checklist item or exit on empty item
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const parent = checklistRow.parentElement;
            if (!parent) return;

            const isEmpty = textContent === '' || taskText.innerHTML === '<br>' || taskText.innerHTML === '';

            if (isEmpty) {
                // Exit checklist mode: replace empty checklist with normal paragraph
                const newP = document.createElement('p');
                newP.innerHTML = '<br>';
                parent.replaceChild(newP, checklistRow);
                setCaretToNode(newP, 0);
            } else {
                // Create a new checklist item immediately below
                const newRow = document.createElement('div');
                newRow.className = 'checklist-row';
                newRow.style.cssText = 'display: flex; align-items: baseline; gap: 8px; margin: 4px 0; min-height: 22px;';
                newRow.innerHTML = `
                    <span class="checklist-checkbox-container" contenteditable="false" style="user-select: none; -webkit-user-select: none; display: inline-flex; align-items: center; margin-right: 2px;">
                        <input type="checkbox" class="task-checkbox" style="cursor: pointer; width: 14px; height: 14px; accent-color: #e2d7ca; vertical-align: middle;">
                    </span>
                    <span class="task-text" contenteditable="true" style="flex: 1; outline: none; color: inherit; font-family: inherit; min-width: 30px;"><br></span>
                `;

                if (checklistRow.nextSibling) {
                    parent.insertBefore(newRow, checklistRow.nextSibling);
                } else {
                    parent.appendChild(newRow);
                }

                const nextTaskText = newRow.querySelector('.task-text');
                if (nextTaskText) {
                    setCaretToNode(nextTaskText, 0);
                }
            }
            triggerEditorSave();
            return;
        }

        // 3. DELETE key (Forward delete)
        if (e.key === 'Delete') {
            const isEmpty = textContent === '' || taskText.innerHTML === '<br>' || taskText.innerHTML === '';
            if (isEmpty) {
                e.preventDefault();
                const parent = checklistRow.parentElement;
                if (!parent) return;
                const next = checklistRow.nextElementSibling;
                checklistRow.remove();
                if (next) {
                    setCaretToNode(next, 0);
                }
                triggerEditorSave();
            }
        }
    });

    // Checkbox toggling handler
    document.addEventListener('change', (e) => {
        if (e.target && e.target.classList.contains('task-checkbox')) {
            const row = e.target.closest('.checklist-row');
            if (row) {
                const text = row.querySelector('.task-text');
                if (text) {
                    text.style.textDecoration = e.target.checked ? 'line-through' : 'none';
                    text.style.opacity = e.target.checked ? '0.5' : '1';
                }
                triggerEditorSave();
            }
        }
    });

    // --- Helper to trigger document save ---
    function triggerEditorSave() {
        if (window.editor && typeof window.editor.handleInput === 'function') {
            window.editor.handleInput();
        } else {
            const editorEl = document.getElementById('document-editor');
            if (editorEl) {
                editorEl.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }
    }

    // --- Active State Synchronization for Formatting Buttons ---
    function updateFormattingActiveStates() {
        formatButtons.forEach(btn => {
            const title = (btn.getAttribute('title') || '').toLowerCase();
            const textContent = btn.innerText.trim();
            let command = '';

            if (title.includes('bold') || btn.querySelector('strong') || textContent === 'B') {
                command = 'bold';
            } else if (title.includes('italic') || btn.querySelector('em') || textContent === 'I') {
                command = 'italic';
            } else if (title.includes('underline') || btn.querySelector('u') || textContent === 'U') {
                command = 'underline';
            } else if (title.includes('align left')) {
                command = 'justifyLeft';
            } else if (title.includes('align center')) {
                command = 'justifyCenter';
            } else if (title.includes('align right')) {
                command = 'justifyRight';
            } else if (title.includes('bullet list')) {
                command = 'insertUnorderedList';
            } else if (title.includes('numbered list')) {
                command = 'insertOrderedList';
            }

            if (command && document.queryCommandState) {
                try {
                    const isActive = document.queryCommandState(command);
                    btn.classList.toggle('active', isActive);
                } catch (err) { }
            }
        });
    }

    // Automatically capture non-collapsed selection ranges for studio tools
    function captureActiveSelectionRange() {
        const sel = window.getSelection();
        if (sel.rangeCount > 0 && !sel.isCollapsed) {
            let node = sel.getRangeAt(0).startContainer;
            if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
            if (node && node.closest('.a4-page')) {
                const range = sel.getRangeAt(0).cloneRange();
                savedHighlightRange = range;
                savedTextColorRange = range;
                savedFontRange = range;
                savedSizeRange = range;
            }
        }
    }

    document.addEventListener('selectionchange', () => {
        captureActiveSelectionRange();
        updateFormattingActiveStates();
    });
    document.addEventListener('keyup', updateFormattingActiveStates);

    document.addEventListener('click', (e) => {
        if (!e.target.closest('#font-box-trigger, #size-box-trigger, #text-color-spectrum-trigger, #highlight-box-trigger, .custom-font-menu, .custom-size-menu, .custom-spectrum-menu, .custom-highlight-menu')) {
            closeAllCustomDropdowns();
        }
        updateFormattingActiveStates();
    });

    // Global page drawings cache map to persist drawing strokes across page re-renders
    if (!window.pageDrawingsMap) {
        window.pageDrawingsMap = {};
    }

    let activeDrawTool = 'text'; // Default to Text Mode ('text') so typing is active
    let activeDrawSize = 2;
    let activeInkColor = '#ffffff';
    let isDrawing = false;
    let currentDrawingCanvas = null;
    let currentDrawingCtx = null;

    // Attach drawing layer overlay to a page element with High-DPI Retina scaling
    function ensureDrawingLayer(pageEl) {
        if (!pageEl) return null;
        let canvas = pageEl.querySelector('.drawing-layer');
        const cssWidth = pageEl.clientWidth || 794;
        const cssHeight = pageEl.clientHeight || 1123;
        const dpr = Math.max(2, window.devicePixelRatio || 2);

        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.className = 'drawing-layer';
            canvas.contentEditable = 'false';
            canvas.width = cssWidth * dpr;
            canvas.height = cssHeight * dpr;
            canvas.style.width = cssWidth + 'px';
            canvas.style.height = cssHeight + 'px';
            pageEl.appendChild(canvas);

            const ctx = canvas.getContext('2d');
            ctx.scale(dpr, dpr);
            bindDrawingEvents(canvas, ctx, pageEl);
            canvas._eventsBound = true;

            // Restore saved drawing data for this page if available
            const pageId = pageEl.id || pageEl.getAttribute('data-page-id');
            const savedData = (pageId && window.pageDrawingsMap[pageId]) || canvas.getAttribute('data-drawing-data');
            if (savedData) {
                const img = new Image();
                img.onload = () => {
                    ctx.drawImage(img, 0, 0, cssWidth, cssHeight);
                };
                img.src = savedData;
            }
        } else {
            canvas.contentEditable = 'false';
            if (!canvas._eventsBound) {
                const ctx = canvas.getContext('2d');
                bindDrawingEvents(canvas, ctx, pageEl);
                canvas._eventsBound = true;
            }
            if (canvas.width !== cssWidth * dpr || canvas.height !== cssHeight * dpr) {
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = canvas.width;
                tempCanvas.height = canvas.height;
                const tempCtx = tempCanvas.getContext('2d');
                tempCtx.drawImage(canvas, 0, 0);

                canvas.width = cssWidth * dpr;
                canvas.height = cssHeight * dpr;
                canvas.style.width = cssWidth + 'px';
                canvas.style.height = cssHeight + 'px';

                const ctx = canvas.getContext('2d');
                ctx.scale(dpr, dpr);
                ctx.drawImage(tempCanvas, 0, 0, tempCanvas.width, tempCanvas.height, 0, 0, cssWidth, cssHeight);
            }
        }
        return canvas;
    }

    function saveCanvasStrokes(canvas, pageEl) {
        if (!canvas) return;
        const dataUrl = canvas.toDataURL();
        canvas.setAttribute('data-drawing-data', dataUrl);
        const pageId = pageEl ? (pageEl.id || pageEl.getAttribute('data-page-id')) : null;
        if (pageId) {
            window.pageDrawingsMap[pageId] = dataUrl;
        }
    }

    function bindDrawingEvents(canvas, ctx, pageEl) {
        let lastPoint = null;

        function getCanvasCoords(e) {
            const rect = canvas.getBoundingClientRect();
            const cssWidth = canvas.clientWidth || (canvas.width / Math.max(2, window.devicePixelRatio || 2));
            const cssHeight = canvas.clientHeight || (canvas.height / Math.max(2, window.devicePixelRatio || 2));

            const scaleX = rect.width ? (cssWidth / rect.width) : 1;
            const scaleY = rect.height ? (cssHeight / rect.height) : 1;

            return {
                x: (e.clientX - rect.left) * scaleX,
                y: (e.clientY - rect.top) * scaleY
            };
        }

        function getTouchCoords(e) {
            const touch = e.touches[0] || e.changedTouches[0];
            if (!touch) return null;
            const rect = canvas.getBoundingClientRect();
            const cssWidth = canvas.clientWidth || (canvas.width / Math.max(2, window.devicePixelRatio || 2));
            const cssHeight = canvas.clientHeight || (canvas.height / Math.max(2, window.devicePixelRatio || 2));

            const scaleX = rect.width ? (cssWidth / rect.width) : 1;
            const scaleY = rect.height ? (cssHeight / rect.height) : 1;

            return {
                x: (touch.clientX - rect.left) * scaleX,
                y: (touch.clientY - rect.top) * scaleY
            };
        }

        function startDrawing(pos) {
            if (!activeDrawTool || activeDrawTool === 'text' || !pos) return;
            isDrawing = true;
            currentDrawingCanvas = canvas;
            currentDrawingCtx = ctx;
            lastPoint = pos;

            ctx.lineWidth = activeDrawSize;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            if (activeDrawTool === 'eraser') {
                ctx.globalCompositeOperation = 'destination-out';
                ctx.globalAlpha = 1.0;
            } else if (activeDrawTool === 'pencil') {
                ctx.globalCompositeOperation = 'source-over';
                ctx.strokeStyle = activeInkColor;
                ctx.globalAlpha = 0.7;
            } else if (activeDrawTool === 'brush') {
                ctx.globalCompositeOperation = 'source-over';
                ctx.strokeStyle = activeInkColor;
                ctx.globalAlpha = 0.4;
                ctx.lineWidth = activeDrawSize * 2.5;
            } else { // Fountain Pen
                ctx.globalCompositeOperation = 'source-over';
                ctx.strokeStyle = activeInkColor;
                ctx.globalAlpha = 1.0;
            }

            // Draw smooth initial dot on click / touch
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, activeDrawSize / 2, 0, Math.PI * 2);
            if (activeDrawTool === 'eraser') {
                ctx.fill();
            } else {
                ctx.fillStyle = activeInkColor;
                ctx.fill();
            }

            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);
        }

        function continueDrawing(pos) {
            if (!isDrawing || currentDrawingCanvas !== canvas || !lastPoint || !pos) return;
            const midPoint = {
                x: (lastPoint.x + pos.x) / 2,
                y: (lastPoint.y + pos.y) / 2
            };

            currentDrawingCtx.quadraticCurveTo(lastPoint.x, lastPoint.y, midPoint.x, midPoint.y);
            currentDrawingCtx.stroke();
            lastPoint = pos;
        }

        function finishDrawing() {
            if (isDrawing) {
                isDrawing = false;
                lastPoint = null;
                saveCanvasStrokes(canvas, pageEl);
                triggerEditorSave();
            }
        }

        canvas.addEventListener('mousedown', (e) => {
            startDrawing(getCanvasCoords(e));
        });

        canvas.addEventListener('mousemove', (e) => {
            continueDrawing(getCanvasCoords(e));
        });

        canvas.addEventListener('mouseup', finishDrawing);
        canvas.addEventListener('mouseleave', finishDrawing);

        canvas.addEventListener('touchstart', (e) => {
            if (!activeDrawTool || activeDrawTool === 'text') return;
            e.preventDefault();
            startDrawing(getTouchCoords(e));
        }, { passive: false });

        canvas.addEventListener('touchmove', (e) => {
            if (!isDrawing) return;
            e.preventDefault();
            continueDrawing(getTouchCoords(e));
        }, { passive: false });

        canvas.addEventListener('touchend', finishDrawing);
        canvas.addEventListener('touchcancel', finishDrawing);
    }

    // Synchronize drawing layers for all pages in editor
    function syncAllDrawingLayers() {
        const pages = document.querySelectorAll('.a4-page');
        pages.forEach(page => {
            ensureDrawingLayer(page);
            if (activeDrawTool && activeDrawTool !== 'text') {
                page.classList.add('drawing-active');
            } else {
                page.classList.remove('drawing-active');
            }
        });
    }

    // 1. Tool Selection Handlers (Text Mode, Fountain Pen, Pencil, Art Brush, Eraser)
    const drawToolBtns = document.querySelectorAll('.draw-tool-btn');
    drawToolBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tool = btn.getAttribute('data-tool');
            if (activeDrawTool === tool && tool !== 'text') {
                activeDrawTool = 'text';
            } else {
                activeDrawTool = tool;
            }

            drawToolBtns.forEach(b => {
                const bTool = b.getAttribute('data-tool');
                b.classList.toggle('active', bTool === activeDrawTool);
            });

            syncAllDrawingLayers();

            // When switching to Text Mode, focus the current page and place
            // the caret where text actually starts (respecting page padding)
            if (activeDrawTool === 'text') {
                const currentPage = document.querySelector('.a4-page');
                if (currentPage && typeof window.setCaretToStart === 'function') {
                    window.setCaretToStart(currentPage);
                }
            }
        });
    });

    // 2. Stroke Weight Handlers (FINE, MEDIUM, THICK)
    const drawSizeBtns = document.querySelectorAll('.draw-size-btn');
    drawSizeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const size = parseInt(btn.getAttribute('data-size'), 10) || 2;
            activeDrawSize = size;

            drawSizeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    // 3. Ink Color Handlers (Spectrum Box Trigger, Native Picker, & Recent Swatches)
    const inkTrigger = document.getElementById('ink-color-spectrum-trigger');
    const inkMenu = document.getElementById('ink-color-spectrum-menu');
    const inkCanvas = document.getElementById('ink-color-spectrum-canvas');
    const inkHueSlider = document.getElementById('ink-color-hue-slider');
    const inkHexBadge = document.getElementById('ink-color-hex-badge');
    const inkNativeInput = document.getElementById('ink-color-native-input');
    const recentInk1Btn = document.getElementById('recent-ink-1');
    const recentInk2Btn = document.getElementById('recent-ink-2');

    let currentInkHue = 0;
    let isInkSpectrumMouseDown = false;

    function drawInkSpectrumCanvas() {
        if (!inkCanvas) return;
        const ctx = inkCanvas.getContext('2d');
        const width = inkCanvas.width;
        const height = inkCanvas.height;

        ctx.clearRect(0, 0, width, height);

        const horizGrad = ctx.createLinearGradient(0, 0, width, 0);
        horizGrad.addColorStop(0, '#FFFFFF');
        horizGrad.addColorStop(1, `hsl(${currentInkHue}, 100%, 50%)`);
        ctx.fillStyle = horizGrad;
        ctx.fillRect(0, 0, width, height);

        const vertGrad = ctx.createLinearGradient(0, 0, 0, height);
        vertGrad.addColorStop(0, 'rgba(0,0,0,0)');
        vertGrad.addColorStop(1, 'rgba(0,0,0,1)');
        ctx.fillStyle = vertGrad;
        ctx.fillRect(0, 0, width, height);
    }

    function updateRecentInkHistory(newColorHex) {
        if (!newColorHex) return;

        const currentTriggerColor = inkTrigger ? (inkTrigger.style.backgroundColor || '#ffffff') : '#ffffff';
        const currentTriggerHex = rgbToHexFromStyle(currentTriggerColor) || currentTriggerColor;

        if (currentTriggerHex.toLowerCase() === newColorHex.toLowerCase()) return;

        const previousMainColor = currentTriggerHex;
        const previousRecent1Color = recentInk1Btn ? (recentInk1Btn.getAttribute('data-ink') || recentInk1Btn.style.backgroundColor) : null;

        if (recentInk2Btn && previousRecent1Color) {
            recentInk2Btn.style.backgroundColor = previousRecent1Color;
            recentInk2Btn.setAttribute('data-ink', previousRecent1Color);
            recentInk2Btn.title = `Recent Ink: ${previousRecent1Color}`;
        }

        if (recentInk1Btn && previousMainColor) {
            recentInk1Btn.style.backgroundColor = previousMainColor;
            recentInk1Btn.setAttribute('data-ink', previousMainColor);
            recentInk1Btn.title = `Recent Ink: ${previousMainColor}`;
        }
    }

    function applyInkColor(colorHex, updateHistory = false) {
        if (updateHistory) {
            updateRecentInkHistory(colorHex);
        }

        activeInkColor = colorHex;

        if (inkTrigger) {
            inkTrigger.style.backgroundColor = colorHex;
            const paletteIcon = document.getElementById('ink-color-palette-icon');
            if (paletteIcon) {
                const isLight = isColorLight(colorHex);
                paletteIcon.style.color = isLight ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.8)';
            }
        }
        if (inkHexBadge) {
            inkHexBadge.innerText = colorHex.toUpperCase();
        }
        if (inkNativeInput) {
            inkNativeInput.value = colorHex;
        }

        const drawInkBtns = document.querySelectorAll('.draw-ink-btn, #ink-color-spectrum-trigger');
        drawInkBtns.forEach(s => s.classList.remove('active'));
        if (inkTrigger) inkTrigger.classList.add('active');
    }

    function pickInkFromCanvas(e) {
        if (!inkCanvas) return;
        const rect = inkCanvas.getBoundingClientRect();
        const scaleX = inkCanvas.width / rect.width;
        const scaleY = inkCanvas.height / rect.height;

        let x = Math.max(0, Math.min(inkCanvas.width - 1, (e.clientX - rect.left) * scaleX));
        let y = Math.max(0, Math.min(inkCanvas.height - 1, (e.clientY - rect.top) * scaleY));

        const ctx = inkCanvas.getContext('2d');
        const pixel = ctx.getImageData(x, y, 1, 1).data;
        const hexColor = rgbToHex(pixel[0], pixel[1], pixel[2]);

        applyInkColor(hexColor);
    }

    if (inkTrigger && inkMenu) {
        inkTrigger.addEventListener('click', (e) => {
            if (e.target.closest('#ink-color-spectrum-menu')) return;
            e.stopPropagation();
            const isOpening = !inkMenu.classList.contains('show');
            closeAllCustomDropdowns(isOpening ? inkMenu : null);
            if (isOpening) {
                drawInkSpectrumCanvas();
            }
        });

        inkMenu.addEventListener('click', (e) => e.stopPropagation());
        inkMenu.addEventListener('mousedown', (e) => e.stopPropagation());
        inkMenu.addEventListener('wheel', (e) => e.stopPropagation());
        inkMenu.addEventListener('scroll', (e) => e.stopPropagation());
    }

    if (inkCanvas) {
        inkCanvas.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            isInkSpectrumMouseDown = true;
            pickInkFromCanvas(e);
        });

        window.addEventListener('mousemove', (e) => {
            if (isInkSpectrumMouseDown) {
                pickInkFromCanvas(e);
            }
        });

        window.addEventListener('mouseup', () => {
            if (isInkSpectrumMouseDown) {
                isInkSpectrumMouseDown = false;
                if (activeInkColor) {
                    updateRecentInkHistory(activeInkColor);
                }
            }
        });
    }

    if (inkHueSlider) {
        inkHueSlider.addEventListener('mousedown', (e) => e.stopPropagation());
        inkHueSlider.addEventListener('input', (e) => {
            currentInkHue = e.target.value;
            drawInkSpectrumCanvas();
        });
    }

    if (inkNativeInput) {
        inkNativeInput.addEventListener('mousedown', (e) => e.stopPropagation());
        inkNativeInput.addEventListener('input', (e) => {
            applyInkColor(e.target.value, true);
        });
    }

    const recentInkBtns = document.querySelectorAll('.recent-ink-btn');
    recentInkBtns.forEach(swatch => {
        swatch.addEventListener('mousedown', (e) => {
            e.preventDefault();
        });

        swatch.addEventListener('click', () => {
            const color = swatch.getAttribute('data-ink') || swatch.style.backgroundColor;
            if (!color) return;

            applyInkColor(color, true);
        });
    });

    // Auto-sync drawing layers when pages are added
    const drawMutationObserver = new MutationObserver(() => {
        syncAllDrawingLayers();
    });
    const mainEditorEl = document.getElementById('document-editor');
    if (mainEditorEl) {
        drawMutationObserver.observe(mainEditorEl, { childList: true, subtree: true });
    }
    syncAllDrawingLayers();

    // =====================================================================
    // INSERT & EXPORT FEATURES
    // =====================================================================

    // --- Helper: get the currently focused/active .a4-page ---
    function getActivePage() {
        const sel = window.getSelection();
        if (sel.rangeCount > 0) {
            let node = sel.getRangeAt(0).startContainer;
            if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
            const page = node.closest('.a4-page');
            if (page) return page;
        }
        return document.querySelector('.a4-page');
    }

    // --- Helper: insert a DOM node at the current caret position ---
    function insertAtCaret(node) {
        const page = getActivePage();
        if (!page) return;

        let left = 96;
        let top = 120;

        const sel = window.getSelection();
        if (sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            let container = range.startContainer;
            if (container.nodeType === Node.TEXT_NODE) container = container.parentElement;
            if (container.closest('.a4-page')) {
                const rect = range.getBoundingClientRect();
                const pageRect = page.getBoundingClientRect();
                const zoom = getPageZoom();
                if (rect.width > 0 || rect.height > 0) {
                    left = Math.max(0, (rect.left - pageRect.left) / zoom);
                    top = Math.max(0, (rect.top - pageRect.top) / zoom);
                }
            }
        }

        node.style.position = 'absolute';
        node.style.left = left + 'px';
        node.style.top = top + 'px';

        page.appendChild(node);
    }

    // ─── 1. INSERT IMAGE ─────────────────────────────────────────────────
    // ── Resizable / Draggable Wrapper Engine ─────────────────────────────
    let activeResizableWrapper = null;
    let _resizeState = null;
    let _dragState = null;

    function getPageZoom() {
        const page = document.querySelector('.a4-page');
        if (!page) return 1;
        return parseFloat(getComputedStyle(page).zoom) || 1;
    }

    function createResizableWrapper(childElement) {
        const wrapper = document.createElement('div');
        wrapper.className = 'resizable-wrapper';
        wrapper.contentEditable = 'false';
        wrapper.draggable = false;
        wrapper.setAttribute('draggable', 'false');
        childElement.draggable = false;
        childElement.setAttribute('draggable', 'false');

        // Drag handle at top center
        const dragHandle = document.createElement('div');
        dragHandle.className = 'resizable-drag-handle';
        dragHandle.title = 'Drag to move';
        dragHandle.draggable = false;
        wrapper.appendChild(dragHandle);

        // 4 corner resize handles
        ['top-left', 'top-right', 'bottom-left', 'bottom-right'].forEach(pos => {
            const handle = document.createElement('div');
            handle.className = 'resize-handle ' + pos;
            handle.draggable = false;
            wrapper.appendChild(handle);
        });

        wrapper.appendChild(childElement);

        // Block native drag
        wrapper.addEventListener('dragstart', (e) => { e.preventDefault(); e.stopPropagation(); });

        return wrapper;
    }

    function selectResizableWrapper(wrapper) {
        if (activeResizableWrapper && activeResizableWrapper !== wrapper) {
            activeResizableWrapper.classList.remove('selected');
        }
        activeResizableWrapper = wrapper;
        wrapper.classList.add('selected');
    }

    function deselectAllWrappers() {
        if (activeResizableWrapper) {
            activeResizableWrapper.classList.remove('selected');
            activeResizableWrapper = null;
        }
    }

    // Prevent native browser image drag inside pages
    document.addEventListener('dragstart', (e) => {
        if (e.target.closest('.a4-page') || e.target.closest('.resizable-wrapper')) e.preventDefault();
    }, true);

    // Unified Document-Level Event Delegation for Resize, Drag, and Selection
    document.addEventListener('mousedown', (e) => {
        // 1. Resize Handle Clicked
        const handle = e.target.closest('.resize-handle');
        if (handle) {
            const wrapper = handle.closest('.resizable-wrapper');
            if (wrapper) {
                e.preventDefault();
                e.stopPropagation();
                selectResizableWrapper(wrapper);

                let pos = 'bottom-right';
                if (handle.classList.contains('top-left')) pos = 'top-left';
                else if (handle.classList.contains('top-right')) pos = 'top-right';
                else if (handle.classList.contains('bottom-left')) pos = 'bottom-left';

                const zoom = getPageZoom();
                const rect = wrapper.getBoundingClientRect();
                const content = wrapper.querySelector('img, table');
                const isImage = content && content.tagName === 'IMG';
                const w = rect.width / zoom;
                const h = rect.height / zoom;

                _resizeState = {
                    wrapper, content, position: pos,
                    startX: e.clientX, startY: e.clientY,
                    startWidth: w, startHeight: h,
                    aspectRatio: isImage ? (w / h) : 0,
                    isImage, zoom
                };
                return;
            }
        }

        // 2. Drag Handle or Wrapper Content Clicked -> Select & Prepare Free Canvas Drag
        const dragHandle = e.target.closest('.resizable-drag-handle');
        const wrapper = e.target.closest('.resizable-wrapper');

        if (dragHandle || wrapper) {
            const targetWrapper = (dragHandle ? dragHandle.closest('.resizable-wrapper') : wrapper);
            if (targetWrapper) {
                if (e.target.closest('td, th')) return; // allow table cell editing
                e.preventDefault();
                e.stopPropagation();
                selectResizableWrapper(targetWrapper);

                const zoom = getPageZoom();
                const page = targetWrapper.closest('.a4-page') || getActivePage();
                const pageRect = page.getBoundingClientRect();

                const currentLeft = (targetWrapper.style.left ? parseFloat(targetWrapper.style.left) : ((targetWrapper.getBoundingClientRect().left - pageRect.left) / zoom));
                const currentTop = (targetWrapper.style.top ? parseFloat(targetWrapper.style.top) : ((targetWrapper.getBoundingClientRect().top - pageRect.top) / zoom));

                targetWrapper.style.position = 'absolute';
                targetWrapper.style.left = currentLeft + 'px';
                targetWrapper.style.top = currentTop + 'px';

                _dragState = {
                    wrapper: targetWrapper,
                    page: page,
                    startMouseX: e.clientX,
                    startMouseY: e.clientY,
                    startLeft: currentLeft,
                    startTop: currentTop,
                    zoom: zoom,
                    isDragging: false
                };
                return;
            }
        }

        // 3. Clicked outside -> deselect
        deselectAllWrappers();
    });

    // Delete removes selected wrapper
    document.addEventListener('keydown', (e) => {
        if ((e.key === 'Delete' || e.key === 'Backspace') && activeResizableWrapper) {
            const sel = window.getSelection();
            if (sel.rangeCount > 0) {
                let node = sel.getRangeAt(0).startContainer;
                if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
                if (node.closest('td, th')) return;
            }
            e.preventDefault();
            const next = activeResizableWrapper.nextElementSibling;
            activeResizableWrapper.remove();
            activeResizableWrapper = null;
            if (next && next.closest('.a4-page')) next.focus();
        }
    });

    // ── Window-level mousemove for resize + drag ─────────────────────────
    window.addEventListener('mousemove', (e) => {
        if (_resizeState) {
            e.preventDefault();
            const { wrapper, content, position, startX, startY, startWidth, startHeight, aspectRatio, isImage, zoom } = _resizeState;
            let dx = (e.clientX - startX) / zoom;
            let dy = (e.clientY - startY) / zoom;
            let nw = startWidth, nh = startHeight;
            if (position.includes('right')) nw = startWidth + dx;
            else if (position.includes('left')) nw = startWidth - dx;
            if (position.includes('bottom')) nh = startHeight + dy;
            else if (position.includes('top')) nh = startHeight - dy;
            nw = Math.max(60, nw);
            nh = Math.max(40, nh);
            if (isImage && aspectRatio > 0) {
                if (Math.abs(dx) > Math.abs(dy)) nh = nw / aspectRatio;
                else nw = nh * aspectRatio;
            }
            wrapper.style.width = nw + 'px';
            if (isImage && content) { content.style.width = '100%'; content.style.height = 'auto'; }
            else if (content) wrapper.style.height = nh + 'px';
            return;
        }

        if (_dragState) {
            const dx = (e.clientX - _dragState.startMouseX) / _dragState.zoom;
            const dy = (e.clientY - _dragState.startMouseY) / _dragState.zoom;

            if (!_dragState.isDragging && Math.sqrt(dx * dx + dy * dy) < 3) return;
            _dragState.isDragging = true;

            let newLeft = _dragState.startLeft + dx;
            let newTop = _dragState.startTop + dy;

            // Check if dragging over another page
            const dropEl = document.elementFromPoint(e.clientX, e.clientY);
            if (dropEl) {
                const targetPage = dropEl.closest('.a4-page');
                if (targetPage && targetPage !== _dragState.page) {
                    targetPage.appendChild(_dragState.wrapper);
                    const oldRect = _dragState.page.getBoundingClientRect();
                    const newRect = targetPage.getBoundingClientRect();

                    _dragState.startLeft += (oldRect.left - newRect.left) / _dragState.zoom;
                    _dragState.startTop += (oldRect.top - newRect.top) / _dragState.zoom;
                    _dragState.page = targetPage;

                    newLeft = _dragState.startLeft + dx;
                    newTop = _dragState.startTop + dy;
                }
            }

            _dragState.wrapper.style.left = newLeft + 'px';
            _dragState.wrapper.style.top = newTop + 'px';
            return;
        }
    });

    // ── Window-level mouseup for resize + drag ──────────────────────────
    window.addEventListener('mouseup', (e) => {
        if (_resizeState) { _resizeState = null; return; }
        if (_dragState) {
            _dragState = null;
        }
    });

    // ── End of Resizable / Draggable Engine ──────────────────────────────

    const insertImageBtn = document.getElementById('insert-image-btn');
    const imageUploadInput = document.getElementById('image-upload-input');

    if (insertImageBtn && imageUploadInput) {
        insertImageBtn.addEventListener('click', () => {
            imageUploadInput.click();
        });

        imageUploadInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (ev) => {
                const img = document.createElement('img');
                img.src = ev.target.result;
                img.className = 'inserted-image';
                img.alt = file.name;
                img.contentEditable = 'false';

                const wrapper = createResizableWrapper(img);
                insertAtCaret(wrapper);

                // Add a paragraph after so user can keep typing
                const p = document.createElement('p');
                p.innerHTML = '<br>';
                if (wrapper.parentElement) {
                    wrapper.parentElement.insertBefore(p, wrapper.nextSibling);
                }
            };
            reader.readAsDataURL(file);

            // Reset input so the same file can be re-selected
            imageUploadInput.value = '';
        });
    }

    // ─── 2. INSERT TABLE ─────────────────────────────────────────────────
    const insertTableBtn = document.getElementById('insert-table-btn');

    if (insertTableBtn) {
        insertTableBtn.addEventListener('click', () => {
            // Create modal overlay
            const overlay = document.createElement('div');
            overlay.className = 'insert-table-modal-overlay';

            overlay.innerHTML = `
                <div class="insert-table-modal">
                    <h3><i class="fa-solid fa-table" style="margin-right: 6px; color: #6fa8dc;"></i> Insert Table</h3>
                    <div class="table-size-row">
                        <label>Rows</label>
                        <input type="number" id="table-rows-input" value="3" min="1" max="20">
                    </div>
                    <div class="table-size-row">
                        <label>Columns</label>
                        <input type="number" id="table-cols-input" value="3" min="1" max="10">
                    </div>
                    <div class="modal-actions">
                        <button class="modal-cancel-btn" id="table-cancel-btn">Cancel</button>
                        <button class="modal-insert-btn" id="table-insert-btn">Insert</button>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);

            const rowsInput = document.getElementById('table-rows-input');
            const colsInput = document.getElementById('table-cols-input');
            const cancelBtn = document.getElementById('table-cancel-btn');
            const insertBtn = document.getElementById('table-insert-btn');

            rowsInput.focus();

            cancelBtn.addEventListener('click', () => overlay.remove());
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) overlay.remove();
            });

            insertBtn.addEventListener('click', () => {
                const rows = Math.min(20, Math.max(1, parseInt(rowsInput.value) || 3));
                const cols = Math.min(10, Math.max(1, parseInt(colsInput.value) || 3));

                const table = document.createElement('table');
                table.className = 'inserted-table';

                // Header row
                const thead = document.createElement('thead');
                const headerRow = document.createElement('tr');
                for (let c = 0; c < cols; c++) {
                    const th = document.createElement('th');
                    th.contentEditable = 'true';
                    th.innerHTML = `Header ${c + 1}`;
                    headerRow.appendChild(th);
                }
                thead.appendChild(headerRow);
                table.appendChild(thead);

                // Body rows
                const tbody = document.createElement('tbody');
                for (let r = 0; r < rows - 1; r++) {
                    const tr = document.createElement('tr');
                    for (let c = 0; c < cols; c++) {
                        const td = document.createElement('td');
                        td.contentEditable = 'true';
                        td.innerHTML = '&nbsp;';
                        tr.appendChild(td);
                    }
                    tbody.appendChild(tr);
                }
                table.appendChild(tbody);

                const wrapper = createResizableWrapper(table);
                insertAtCaret(wrapper);

                // Add paragraph after table
                const p = document.createElement('p');
                p.innerHTML = '<br>';
                if (wrapper.parentElement) {
                    wrapper.parentElement.insertBefore(p, wrapper.nextSibling);
                }

                overlay.remove();
            });

            // Enter key inserts
            overlay.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    insertBtn.click();
                } else if (e.key === 'Escape') {
                    overlay.remove();
                }
            });
        });
    }

    // ─── 3. SHARE NOTE LINK ──────────────────────────────────────────────
    const shareLinkBtn = document.getElementById('share-link-btn');

    if (shareLinkBtn) {
        shareLinkBtn.addEventListener('click', () => {
            // Generate shareable URL
            const currentUrl = window.location.href.split('#')[0];
            const activePage = document.querySelector('.a4-page');
            const pageId = activePage ? activePage.id : 'page1';
            const shareUrl = `${currentUrl}#${pageId}`;

            // Auto-copy to clipboard
            navigator.clipboard.writeText(shareUrl).then(() => {
                showShareToast('Link copied to clipboard!');
            }).catch(() => { });

            // Show share modal dialog
            showShareModal(shareUrl);
        });
    }

    function showShareModal(shareUrl) {
        const overlay = document.createElement('div');
        overlay.className = 'share-link-modal-overlay';

        overlay.innerHTML = `
            <div class="share-link-modal">
                <h3><i class="fa-solid fa-share-nodes" style="color: #6fa8dc;"></i> Share Note Link</h3>
                <p>Anyone with this link can view this note page in their browser.</p>
                <div class="share-input-group">
                    <input type="text" id="share-url-input" value="${shareUrl}" readonly>
                    <button type="button" id="copy-share-url-btn"><i class="fa-regular fa-copy"></i> Copy</button>
                </div>
                <div class="modal-actions" style="display: flex; justify-content: flex-end;">
                    <button class="modal-cancel-btn" id="share-close-btn" style="padding: 7px 18px; border-radius: 6px; border: none; background: #333; color: #aaa; font-weight: 600; cursor: pointer;">Close</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const urlInput = document.getElementById('share-url-input');
        const copyBtn = document.getElementById('copy-share-url-btn');
        const closeBtn = document.getElementById('share-close-btn');

        urlInput.select();

        closeBtn.addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
        });

        copyBtn.addEventListener('click', () => {
            urlInput.select();
            navigator.clipboard.writeText(shareUrl).then(() => {
                copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
                copyBtn.style.background = '#2e7d32';
                showShareToast('Link copied to clipboard!');
                setTimeout(() => {
                    copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy';
                    copyBtn.style.background = '#4a7ab5';
                }, 2000);
            }).catch(() => {
                document.execCommand('copy');
                showShareToast('Link copied!');
            });
        });
    }

    function showShareToast(message) {
        const existingToast = document.querySelector('.share-toast');
        if (existingToast) existingToast.remove();

        const toast = document.createElement('div');
        toast.className = 'share-toast';
        toast.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${message}`;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 2500);
    }

    // ─── 3. DELETE PAGE HANDLER ───────────────────────────────────────────
    const deletePageBtn = document.getElementById('delete-page-btn');
    if (deletePageBtn) {
        deletePageBtn.addEventListener('click', () => {
            const activePageTab = document.querySelector('.page-link.active, .sidebar-item.active');
            if (activePageTab) {
                const deleteAction = activePageTab.querySelector('.delete-tab-btn') || activePageTab.querySelector('.tab-delete-icon');
                if (deleteAction) {
                    deleteAction.click();
                } else if (window.editorState && window.editorState.activeChapterId) {
                    const chapterId = window.editorState.activeChapterId;
                    window.editorState.deleteChapter(chapterId);
                    activePageTab.remove();
                    showShareToast('Page deleted');
                }
            } else {
                showShareToast('No active page to delete');
            }
        });
    }

    // ─── 4. EXPORT PDF WITH ACTUAL PDF PREVIEW ───────────────────────────
    const exportPdfBtn = document.getElementById('export-pdf-btn');

    if (exportPdfBtn) {
        exportPdfBtn.addEventListener('click', async () => {
            // Save active chapter content first
            if (window.editorState && typeof window.editorState.saveCurrentContent === 'function') {
                window.editorState.saveCurrentContent();
            }

            const editorEl = document.getElementById('document-editor');
            const pages = editorEl ? Array.from(editorEl.querySelectorAll('.a4-page')) : Array.from(document.querySelectorAll('.a4-page'));

            if (pages.length === 0) {
                showShareToast('No pages found to export');
                return;
            }

            deselectAllWrappers();
            showShareToast('Generating PDF Preview...');

            try {
                const pdfBlobUrl = await generateDocumentPdfBlobUrl(pages);
                showActualPdfPreviewModal(pdfBlobUrl, pages.length);
            } catch (err) {
                console.error('PDF generation error:', err);
                showShareToast('Falling back to system print...');
                window.print();
            }
        });
    }

    // High-Fidelity 1:1 Live Page Capture to PDF Blob
    async function generateDocumentPdfBlobUrl(pages) {
        const jsPDFLib = window.jspdf?.jsPDF || window.jsPDF || (window.html2pdf ? window.html2pdf().Worker.prototype.jsPDF : null);
        if (!jsPDFLib || typeof html2canvas !== 'function') {
            throw new Error('PDF libraries not loaded');
        }

        // Initialize jsPDF with exact A4 794pt x 1123pt page dimensions
        const pdf = new jsPDFLib('p', 'pt', [794, 1123]);

        for (let i = 0; i < pages.length; i++) {
            const pageEl = pages[i];

            // Hide handles during capture
            const handles = pageEl.querySelectorAll('.resizable-drag-handle, .resize-handle');
            handles.forEach(h => h.style.display = 'none');

            // Temporarily disable contenteditable to remove input carets and focus outlines
            const wasEditable = pageEl.getAttribute('contenteditable');
            pageEl.setAttribute('contenteditable', 'false');

            // Save zoom and set to 1 for capture
            const origZoom = pageEl.style.zoom;
            pageEl.style.zoom = '1';

            // Ensure drawing layer canvas is visible
            const drawingCanvas = pageEl.querySelector('.drawing-layer');
            if (drawingCanvas) {
                drawingCanvas.style.display = 'block';
                drawingCanvas.style.visibility = 'visible';
            }

            try {
                // Capture visible page directly from DOM at 2x scale
                const canvas = await html2canvas(pageEl, {
                    scale: 2,
                    useCORS: true,
                    allowTaint: true,
                    backgroundColor: '#191919',
                    logging: false,
                    width: 794,
                    height: 1123,
                    scrollX: 0,
                    scrollY: 0
                });

                // Convert to lossless PNG
                const imgData = canvas.toDataURL('image/png');

                if (i > 0) pdf.addPage([794, 1123], 'p');
                // Fit image exactly to (0, 0, 794, 1123) with zero margins
                pdf.addImage(imgData, 'PNG', 0, 0, 794, 1123, undefined, 'FAST');
            } finally {
                // Restore handles, zoom & contenteditable
                handles.forEach(h => h.style.display = '');
                pageEl.style.zoom = origZoom;
                if (wasEditable !== null) {
                    pageEl.setAttribute('contenteditable', wasEditable);
                }
            }
        }

        const pdfBlob = pdf.output('blob');
        window._latestGeneratedPdfBlob = pdfBlob;
        return URL.createObjectURL(pdfBlob);
    }

    // Modal displaying the ACTUAL PDF Blob inside an embedded iframe
    function showActualPdfPreviewModal(pdfBlobUrl, pageCount) {
        const overlay = document.createElement('div');
        overlay.className = 'pdf-preview-modal-overlay';

        overlay.innerHTML = `
            <div class="pdf-preview-modal" style="width: 900px; max-width: 94vw;">
                <div class="pdf-preview-header">
                    <h3><i class="fa-solid fa-file-pdf" style="color: #e74c3c;"></i> Actual PDF Preview</h3>
                    <span style="color: #aaa; font-size: 13px;">Viewing the exact PDF file (${pageCount} Page${pageCount > 1 ? 's' : ''})</span>
                </div>
                <div class="pdf-preview-body" style="padding: 12px; background: #141414;">
                    <iframe src="${pdfBlobUrl}#toolbar=0&navpanes=0" style="width: 100%; height: 72vh; border: none; border-radius: 8px; background: #191919;"></iframe>
                </div>
                <div class="pdf-preview-footer">
                    <button type="button" class="pdf-preview-cancel-btn" id="pdf-cancel-btn">Close</button>
                    <button type="button" class="pdf-preview-download-btn" id="pdf-download-btn"><i class="fa-solid fa-download"></i> Download PDF (${pageCount} Page${pageCount > 1 ? 's' : ''})</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const cancelBtn = document.getElementById('pdf-cancel-btn');
        const downloadBtn = document.getElementById('pdf-download-btn');

        function closeModal() {
            window.removeEventListener('keydown', handleKeyDown);
            overlay.remove();
            try {
                URL.revokeObjectURL(pdfBlobUrl);
            } catch (_) {}
        }

        function handleKeyDown(e) {
            if (e.key === 'Escape') {
                closeModal();
            }
        }

        window.addEventListener('keydown', handleKeyDown);

        cancelBtn.addEventListener('click', closeModal);

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeModal();
            }
        });

        downloadBtn.addEventListener('click', () => {
            const a = document.createElement('a');
            a.href = pdfBlobUrl;
            a.download = 'AiNote-Document.pdf';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            showShareToast('PDF Downloaded Successfully!');
            closeModal();
        });
    }

});
