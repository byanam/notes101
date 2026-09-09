// Smooth Navigation to Landing Page (Home)
window.navigateToHome = function (e) {
    if (e) e.preventDefault();
    const container = document.getElementById('transition-container') || document.body;
    container.style.transition = 'opacity 0.25s ease-out';
    container.style.opacity = '0';
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 250);
};

(function () {
    const container = document.getElementById('transition-container');
    if (container) {
        container.style.clipPath = 'none';
        container.style.webkitClipPath = 'none';
        container.classList.add('opening');
    }
})();

document.addEventListener('DOMContentLoaded', () => {
    const isDemoMode = new URLSearchParams(window.location.search).get('demo') === 'true' || sessionStorage.getItem('demoMode') === 'true';
    window.isDemoMode = isDemoMode;

    // --- Utility: place caret at the start of a contenteditable page's content area ---
    function setCaretToStart(el) {
        if (!el) return;
        // Ensure the page has at least one block element so the caret
        // appears inside the padded text area, not at position (0,0)
        if (!el.innerHTML || el.innerHTML.trim() === '') {
            el.innerHTML = '<p><br></p>';
        }
        el.focus();
        const range = document.createRange();
        const sel = window.getSelection();
        // Place caret inside the first child element (e.g. <p>)
        const firstChild = el.firstChild;
        if (firstChild && firstChild.nodeType === Node.ELEMENT_NODE) {
            range.setStart(firstChild, 0);
        } else if (firstChild) {
            range.setStart(firstChild, 0);
        } else {
            range.setStart(el, 0);
        }
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
    }
    // Expose globally so right_sidebar.js can use it
    window.setCaretToStart = setCaretToStart;

    // State
    let bookCount = 1;
    // let pageCount = 1; // Global page count for ID uniqueness - REMOVED, managed by EditorState
    let currentBookId = 'book1-menu'; // Default active book
    let isPaginating = false; // global lock — prevents pagination running more than once per cycle

    // Elements
    const addBookBtn = document.getElementById('add-book-btn');
    const addPageBtn = document.getElementById('add-page-btn');
    const sidebarBooksScroll = document.querySelector('.sidebar-books-scroll');
    const pageContainer = document.querySelector('.a4-page-container'); // Still needed for editor mounting

    // --- Editor State Management ---
    class EditorState {
        constructor() {
            this.chapters = new Map();
            this.activeChapterId = null;
            this.nextChapterId = 1;
            this._inputTimeout = null;
            this._reflowPending = false;
        }

        createChapter(id, title, content = '') {
            // Default empty pages to a paragraph so caret respects padding
            const safeContent = (!content || content.trim() === '') ? '<p><br></p>' : content;
            const chapter = { id, title, content: safeContent };
            this.chapters.set(id, chapter);

            const numericPart = parseInt(id.match(/\d+/)?.[0], 10);
            if (numericPart && numericPart >= this.nextChapterId) {
                this.nextChapterId = numericPart + 1;
            }
            return chapter;
        }

        deleteChapter(id) {
            this.chapters.delete(id);
            if (this.activeChapterId === id) {
                this.activeChapterId = null;
            }
            if (window.pageDrawingsMap && window.pageDrawingsMap[id]) {
                delete window.pageDrawingsMap[id];
            }
        }

        setActiveChapter(id) {
            if (!this.chapters.has(id)) {
                console.warn('Chapter not found:', id);
                return;
            }

            this.saveCurrentContent();
            this.activeChapterId = id;
            this.renderActiveChapter();
            updateToolbarText();
        }

        saveCurrentContent() {
            const editorEl = document.getElementById('document-editor');
            if (!editorEl) return;

            // Each .a4-page is contenteditable — save its innerHTML (excluding drawing layer)
            editorEl.querySelectorAll('.a4-page').forEach(page => {
                if (page.id && this.chapters.has(page.id)) {
                    const clone = page.cloneNode(true);
                    clone.querySelectorAll('.drawing-layer').forEach(dl => dl.remove());
                    // Strip transient search highlight marks so they don't persist into storage
                    clone.querySelectorAll('mark.doc-search-highlight').forEach(mark => {
                        const parent = mark.parentNode;
                        if (parent) {
                            parent.replaceChild(document.createTextNode(mark.textContent), mark);
                            parent.normalize();
                        }
                    });
                    // Strip any transient image selection / resize handles if present
                    clone.querySelectorAll('.image-resize-handle, .image-handle').forEach(h => h.remove());
                    this.chapters.get(page.id).content = clone.innerHTML;
                    if (typeof updatePageThumbnail === 'function') {
                        updatePageThumbnail(page.id);
                    }
                }
            });
            saveData();
        }

        renderActiveChapter() {
            const editorEl = document.getElementById('document-editor');
            if (!editorEl) return;

            if (!this.activeChapterId) return;

            // Find which book contains the active chapter in the sidebar
            const activeLink = document.querySelector(`.page-link[data-target-id="${this.activeChapterId}"]`);
            if (!activeLink) return;

            const group = activeLink.closest('.book-group');
            if (!group) return;

            // Get all pages in this book
            const pageLinks = Array.from(group.querySelectorAll('.page-link')).filter(l =>
                l.dataset.isContinuation !== 'true' && !l.classList.contains('virtual-page-link')
            );

            // If this book's pages are already loaded, just scroll to target
            const currentIds = Array.from(editorEl.querySelectorAll('.a4-page')).map(p => p.id).join(',');
            const newIds = pageLinks.map(l => l.dataset.targetId).join(',');

            if (currentIds === newIds && currentIds) {
                const target = document.getElementById(this.activeChapterId);
                if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                return;
            }

            // Render fresh stack of contenteditable pages
            editorEl.innerHTML = '';
            pageLinks.forEach(link => {
                const chapterId = link.dataset.targetId;
                const chapter = this.chapters.get(chapterId);
                if (!chapter) return;

                const pageEl = document.createElement('div');
                pageEl.className = 'a4-page';
                pageEl.id = chapterId;
                pageEl.contentEditable = 'true';
                pageEl.spellcheck = false;
                pageEl.innerHTML = chapter.content || '<p><br></p>';

                pageEl.addEventListener('input', () => this.handleInput());
                pageEl.addEventListener('paste', (ev) => {
                    ev.preventDefault();
                    const text = (ev.originalEvent || ev).clipboardData.getData('text/plain');
                    document.execCommand('insertText', false, text);
                });

                editorEl.appendChild(pageEl);
            });

            setTimeout(() => {
                const target = document.getElementById(this.activeChapterId);
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    target.focus();
                    // Place caret at the very beginning of the new page
                    setCaretToStart(target);
                }
            }, 50);
        }

        handleInput() {
            clearTimeout(this._inputTimeout);
            this._inputTimeout = setTimeout(() => this.saveCurrentContent(), 400);
            this._scheduleReflow();
        }

        // ── scheduling ──────────────────────────────────────────────────────────
        _scheduleReflow() {
            if (this._reflowPending) return;
            this._reflowPending = true;
            if (isPaginating) { this._reflowPending = false; return; }
            isPaginating = true;
            requestAnimationFrame(() => {
                this._reflowPending = false;

                // Track how many pages exist before reflow
                const beforeCount = document.querySelectorAll('.a4-page').length;

                this._reflow();
                isPaginating = false;

                // Check how many pages exist after reflow
                const pages = document.querySelectorAll('.a4-page');
                if (pages.length > beforeCount) {
                    const lastPage = pages[pages.length - 1];
                    lastPage.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        }

        // ── main reflow ──────────────────────────────────────────────────────────
        _reflow() {
            const editorEl = document.getElementById('document-editor');
            if (!editorEl) return;

            const getLastContentNode = (parent) => {
                let child = parent.lastChild;
                while (child && child.nodeType === Node.ELEMENT_NODE && child.classList.contains('drawing-layer')) {
                    child = child.previousSibling;
                }
                return child;
            };

            const getFirstContentNode = (parent) => {
                let child = parent.firstChild;
                while (child && child.nodeType === Node.ELEMENT_NODE && child.classList.contains('drawing-layer')) {
                    child = child.nextSibling;
                }
                return child;
            };

            const pages = Array.from(editorEl.querySelectorAll('.a4-page'));
            const hasOverflow = pages.some(p => p.scrollHeight > p.clientHeight);
            const hasEmptyAutoPage = pages.some((p, idx) => idx > 0 && getFirstContentNode(p) === null && p.dataset.autoPage === '1');

            // Skip reflow and selection manipulation if no pages overflow
            if (!hasOverflow && !hasEmptyAutoPage) {
                return;
            }

            // Save cursor before any DOM moves as a character offset
            const sel = window.getSelection();
            let cursorOffset = null;
            if (sel && sel.rangeCount > 0 && editorEl.contains(sel.focusNode)) {
                try {
                    const range = sel.getRangeAt(0);
                    const preCaretRange = range.cloneRange();
                    preCaretRange.selectNodeContents(editorEl);
                    preCaretRange.setEnd(range.startContainer, range.startOffset);
                    cursorOffset = preCaretRange.toString().length;
                } catch (_) { }
            }

            // Forward flow: while a page overflows, push its last content child to the next page
            for (let i = 0; i < pages.length; i++) {
                const page = pages[i];
                let safety = page.childNodes.length + 1;

                while (page.scrollHeight > page.clientHeight && safety-- > 0) {
                    const node = getLastContentNode(page);
                    if (!node) break;

                    let next = pages[i + 1];
                    if (!next) {
                        next = this._makeAutoPage(page);
                        if (!next) break;
                        pages.push(next);
                    }

                    // Node Splitting Logic
                    let isTextNode = node.nodeType === Node.TEXT_NODE;
                    let isElementNode = node.nodeType === Node.ELEMENT_NODE;
                    let isTextContainer = isTextNode || (isElementNode && ['DIV', 'P', 'SPAN'].includes(node.tagName) && node.textContent.trim().length > 0);

                    let nodeHeight = isElementNode ? node.offsetHeight : 0;
                    if (isTextNode) {
                        // Approximate text node height
                        const range = document.createRange();
                        range.selectNodeContents(node);
                        const rects = range.getClientRects();
                        for (let j = 0; j < rects.length; j++) {
                            nodeHeight += rects[j].height;
                        }
                    }

                    if (isTextContainer && nodeHeight > page.clientHeight * 0.4) {
                        // Attempt to split
                        const clone = node.cloneNode(true);

                        let success = false;

                        if (isElementNode) {
                            if (node.children.length === 0) {
                                let words = node.innerHTML.split(' ');
                                let cloneWords = [];

                                while (words.length > 0 && page.scrollHeight > page.clientHeight) {
                                    cloneWords.unshift(words.pop());
                                    node.innerHTML = words.join(' ');
                                }

                                if (cloneWords.length > 0 && words.length > 0) {
                                    clone.innerHTML = cloneWords.join(' ');
                                    const insertTarget = getFirstContentNode(next);
                                    if (insertTarget) {
                                        next.insertBefore(clone, insertTarget);
                                    } else {
                                        next.appendChild(clone);
                                    }
                                    success = true;
                                }
                            }
                        } else if (isTextNode) {
                            let words = node.textContent.split(' ');
                            let cloneWords = [];

                            while (words.length > 0 && page.scrollHeight > page.clientHeight) {
                                cloneWords.unshift(words.pop());
                                node.textContent = words.join(' ');
                            }

                            if (cloneWords.length > 0 && words.length > 0) {
                                clone.textContent = cloneWords.join(' ');
                                const insertTarget = getFirstContentNode(next);
                                if (insertTarget) {
                                    next.insertBefore(clone, insertTarget);
                                } else {
                                    next.appendChild(clone);
                                }
                                success = true;
                            }
                        }

                        if (!success) {
                            page.removeChild(node);
                            const insertTarget = getFirstContentNode(next);
                            if (insertTarget) {
                                next.insertBefore(node, insertTarget);
                            } else {
                                next.appendChild(node);
                            }
                        }
                    } else {
                        // Normal behavior: move whole node
                        page.removeChild(node);
                        const insertTarget = getFirstContentNode(next);
                        if (insertTarget) {
                            next.insertBefore(node, insertTarget);
                        } else {
                            next.appendChild(node);
                        }
                    }
                }
            }

            // Reverse flow: pull content back from next page when current page has room
            for (let i = 0; i < pages.length - 1; i++) {
                const page = pages[i];
                const next = pages[i + 1];
                if (!next) continue;

                let safety = next.childNodes.length + 1;
                while (safety-- > 0) {
                    const node = getFirstContentNode(next);
                    if (!node) break;

                    page.appendChild(node);
                    if (page.scrollHeight > page.clientHeight) {
                        page.removeChild(node);
                        const insertTarget = getFirstContentNode(next);
                        if (insertTarget) {
                            next.insertBefore(node, insertTarget);
                        } else {
                            next.appendChild(node);
                        }
                        break;
                    }
                }

                // Remove empty auto-created pages
                if (getFirstContentNode(next) === null && next.dataset.autoPage === '1') {
                    const deadId = next.id;
                    next.remove();
                    pages.splice(i + 1, 1);
                    const deadLink = document.querySelector(`.page-link[data-target-id="${deadId}"]`);
                    if (deadLink) deadLink.remove();
                    this.deleteChapter(deadId);
                }
            }

            // Restore cursor
            if (cursorOffset !== null && sel) {
                try {
                    const treeWalker = document.createTreeWalker(editorEl, NodeFilter.SHOW_TEXT, null, false);
                    let currentOffset = 0;
                    let targetNode = null;
                    let targetNodeOffset = 0;

                    let node;
                    while ((node = treeWalker.nextNode())) {
                        let nodeLength = node.length;
                        if (currentOffset + nodeLength >= cursorOffset) {
                            targetNode = node;
                            targetNodeOffset = cursorOffset - currentOffset;
                            break;
                        }
                        currentOffset += nodeLength;
                    }

                    if (targetNode) {
                        const range = document.createRange();
                        range.setStart(targetNode, targetNodeOffset);
                        range.collapse(true);
                        sel.removeAllRanges();
                        sel.addRange(range);
                    } else {
                        // Fallback to placing cursor at end of last page
                        const pages = editorEl.querySelectorAll('.a4-page');
                        if (pages.length > 0) {
                            const lastPage = pages[pages.length - 1];
                            const range = document.createRange();
                            range.selectNodeContents(lastPage);
                            range.collapse(false);
                            sel.removeAllRanges();
                            sel.addRange(range);
                        }
                    }
                } catch (_) { }
            }

        }

        // ── auto-page factory ────────────────────────────────────────────────────
        _makeAutoPage(prevPageEl) {
            const newId = `note-page-${this.nextChapterId}`;
            this.createChapter(newId, 'Page');

            const activeLink = document.querySelector(`.page-link[data-target-id="${prevPageEl.id}"]`);
            const submenu = activeLink ? activeLink.closest('.sidebar-submenu') : null;
            if (submenu) {
                const pageNum = submenu.querySelectorAll('.page-link').length + 1;
                this.chapters.get(newId).title = `Page ${pageNum}`;
                const newLink = createSidebarLink(submenu, `Page ${pageNum}`, newId, false);
                if (newLink) {
                    newLink.onclick = (ev) => {
                        if (ev.target.closest('.icon-button')) return;
                        editor.saveCurrentContent();
                        selectItem('page', newLink);
                        editor.setActiveChapter(newId);
                    };
                }
                if (typeof updateAllBookIcons === 'function') updateAllBookIcons();
            }

            const el = document.createElement('div');
            el.className = 'a4-page';
            el.id = newId;
            el.dataset.autoPage = '1';   // mark as auto-created so we can clean it up
            el.contentEditable = 'true';
            el.spellcheck = false;
            el.addEventListener('input', () => this.handleInput());
            el.addEventListener('paste', (ev) => {
                ev.preventDefault();
                document.execCommand('insertText', false,
                    (ev.originalEvent || ev).clipboardData.getData('text/plain'));
            });
            prevPageEl.parentElement.insertBefore(el, prevPageEl.nextSibling);
            return el;
        }
    }

    // In the Word-style model, each .a4-page is its own contenteditable.
    // No global editor click/paste handlers needed — pages wire up in renderActiveChapter.
    const setupEditor = () => { };
    const editor = new EditorState();
    window.editor = editor;
    setupEditor();

    // Setup editor input handler
    document.addEventListener('DOMContentLoaded', () => {
        const docEditor = document.getElementById('document-editor');
        if (docEditor) {
            docEditor.addEventListener('input', () => editor.handleInput());
        }
    });
    // --- Persistence Logic ---

    function saveData() {
        // Sync active page DOM HTML into editor.chapters map before serializing
        const editorEl = document.getElementById('document-editor');
        if (editorEl && editor) {
            editorEl.querySelectorAll('.a4-page').forEach(page => {
                if (page.id && editor.chapters.has(page.id)) {
                    const clone = page.cloneNode(true);
                    clone.querySelectorAll('.drawing-layer').forEach(dl => dl.remove());
                    editor.chapters.get(page.id).content = clone.innerHTML;
                }
            });
        }

        const data = {
            bookCount,
            nextChapterId: editor.nextChapterId,
            activeChapterId: editor.activeChapterId,
            books: []
        };

        const bookGroups = document.querySelectorAll('.book-group');
        bookGroups.forEach(group => {
            const bookTab = group.querySelector('.book-tab');
            const bookName = bookTab.querySelector('.sidebar-text').innerText;
            const bookIcon = bookTab.querySelector('i');
            const bookColor = bookIcon.style.color || '';
            const bookId = group.dataset.bookId;

            const pages = [];
            const pageLinks = group.querySelectorAll('.page-link');
            pageLinks.forEach(link => {
                if (link.dataset.isContinuation === 'true' || link.classList.contains('virtual-page-link')) return;

                const textSpan = link.querySelector('.sidebar-text');
                const targetId = link.dataset.targetId;
                const textWithPrefix = textSpan ? textSpan.innerText : (editor.chapters.get(targetId)?.title || 'Page');

                let content = '';
                const chapter = editor.chapters.get(targetId);
                if (chapter) {
                    content = chapter.content || '';
                }

                pages.push({
                    text: textWithPrefix,
                    content: content,
                    id: targetId
                });
            });

            data.books.push({
                startId: bookId,
                name: bookName,
                color: bookColor,
                pages: pages
            });
        });

        if (isDemoMode) {
            if (typeof window.onNotesStateChanged === 'function') {
                window.onNotesStateChanged(data);
            }
            return;
        }

        try {
            localStorage.setItem('aiNoteData', JSON.stringify(data));
        } catch (storageErr) {
            console.warn('[Storage] Could not persist to localStorage (quota exceeded or private mode):', storageErr);
        }
        if (typeof window.onNotesStateChanged === 'function') {
            window.onNotesStateChanged(data);
        }
    }

    function loadDataFromObject(data) {
        if (!data || !data.books || data.books.length === 0) return false;

        try {
            bookCount = data.bookCount || 0;
            editor.nextChapterId = data.nextChapterId || 1;
            editor.chapters.clear();

            let workspaceMenu = document.getElementById('workspace-folder-menu');

            if (!workspaceMenu) {
                if (sidebarBooksScroll) sidebarBooksScroll.innerHTML = '';
            } else {
                workspaceMenu.innerHTML = '';
            }

            data.books.forEach(book => {
                const group = createBookGroup(book.startId, book.name, book.color);
                if (workspaceMenu) {
                    workspaceMenu.appendChild(group);
                } else if (sidebarBooksScroll) {
                    sidebarBooksScroll.appendChild(group);
                }

                const submenu = group.querySelector('.sidebar-submenu');

                book.pages.forEach(page => {
                    editor.createChapter(page.id, page.text, page.content);
                    createSidebarLink(submenu, page.text, page.id, false);
                });
            });

            // Check URL parameters for explicit bookId or pageId from Bookshelf Hub
            const urlParams = new URLSearchParams(window.location.search);
            const paramPageId = urlParams.get('pageId');
            const paramBookId = urlParams.get('bookId');

            let targetChapterId = paramPageId || data.activeChapterId;
            if (!targetChapterId || !editor.chapters.has(targetChapterId)) {
                if (paramBookId) {
                    const book = data.books.find(b => b.startId === paramBookId);
                    if (book && book.pages && book.pages.length > 0) {
                        targetChapterId = book.pages[0].id;
                    }
                }
            }
            if (!targetChapterId || !editor.chapters.has(targetChapterId)) {
                if (editor.chapters.size > 0) {
                    targetChapterId = editor.chapters.keys().next().value;
                }
            }

            if (targetChapterId && editor.chapters.has(targetChapterId)) {
                editor.activeChapterId = targetChapterId;

                requestAnimationFrame(() => {
                    const link = document.querySelector(`.page-link[data-target-id="${targetChapterId}"]`);
                    if (link) {
                        selectItem('page', link);
                        const group = link.closest('.book-group');
                        if (group) {
                            const menuId = group.dataset.bookId + '-menu';
                            const menu = document.getElementById(menuId);
                            if (menu && !menu.classList.contains('active')) {
                                toggleSidebarMenu(menuId);
                            }
                        }
                    }
                    editor.renderActiveChapter();
                    updateToolbarText();
                });
            }

            return true;
        } catch (e) {
            console.error("Failed to load data from object", e);
            return false;
        }
    }

    function loadData() {
        const stored = localStorage.getItem('aiNoteData');
        if (!stored) return false;

        try {
            const data = JSON.parse(stored);
            return loadDataFromObject(data);
        } catch (e) {
            console.error("Failed to load data", e);
            return false;
        }
    }

    // Expose global methods for Firestore Cloud Sync (Per-User Scoped)
    window.serializeNotesData = function (uid) {
        saveData();
        const key = uid ? 'aiNoteData_' + uid : 'aiNoteData';
        const stored = localStorage.getItem(key) || localStorage.getItem('aiNoteData');
        if (!stored) return null;
        try {
            return JSON.parse(stored);
        } catch (e) {
            console.error('[Storage] Corrupt note data in localStorage for serialization:', e);
            return null;
        }
    };

    window.deserializeNotesData = function (data, uid) {
        if (!data) return false;
        const success = loadDataFromObject(data);
        if (success && uid) {
            try {
                localStorage.setItem('aiNoteData_' + uid, JSON.stringify(data));
            } catch (err) {
                console.warn('[Storage] Failed to cache user notes in localStorage:', err);
            }
        }
        return success;
    };

    window.clearNotesData = function () {
        editor.chapters.clear();
        bookCount = 0;
        editor.nextChapterId = 1;
        editor.activeChapterId = null;
        let workspaceMenu = document.getElementById('workspace-folder-menu');
        if (workspaceMenu) workspaceMenu.innerHTML = '';
        const docEditor = document.getElementById('document-editor');
        if (docEditor) docEditor.innerHTML = '';
    };

    window.initializeFreshUserNotes = function () {
        window.clearNotesData();
        const freshData = {
            bookCount: 1,
            nextChapterId: 2,
            activeChapterId: 'note-page-1',
            books: [
                {
                    startId: 'book1',
                    name: 'Book 1',
                    color: '',
                    pages: [
                        {
                            id: 'note-page-1',
                            text: 'Page 1',
                            content: '<p><br></p>'
                        }
                    ]
                }
            ]
        };
        loadDataFromObject(freshData);
        return freshData;
    };

    // --- Helper Functions ---

    function deleteVirtualPage(pageIndex) {
        // pageIndex is 1-based. (e.g. Page 2)
        // We calculate the pixel range:
        // Start: (pageIndex - 1) * 1490 (1460 + 30)
        // End: Start + 1460

        const PAGE_HEIGHT = 1460;
        const GAP = 30;
        const startY = (pageIndex - 1) * (PAGE_HEIGHT + GAP);
        const endY = startY + PAGE_HEIGHT;

        // We need to delete content in this vertical range in #document-editor
        const editorEl = document.getElementById('document-editor');
        if (!editorEl) return;

        // This is tricky. Web APIs don't easily let you "delete everything between Y1 and Y2".
        // We can iterate blocks and check their positions.
        // If a block is fully within the range, delete it.
        // If it overlaps, we might need to split? 
        // For V1, let's delete any block that *starts* within the range.

        const blocks = Array.from(editorEl.children);
        let deletedCount = 0;

        blocks.forEach(block => {
            const top = block.offsetTop;
            const bottom = top + block.offsetHeight;

            // strictly inside or just overlap?
            // "Remove the corresponding page range".
            // If we delete blocks starting in the range:
            if (top >= startY && top < endY) {
                block.remove();
                deletedCount++;
            }
        });

        if (deletedCount > 0) {
            // Save updated content
            const chapter = editor.chapters.get(editor.activeChapterId);
            if (chapter) {
                const docEditor = document.getElementById('document-editor');
                if (docEditor) {
                    chapter.content = docEditor.innerHTML;
                    saveData();
                    if (editor.updateVisualGuides) {
                        editor.updateVisualGuides();
                    }
                }
            }
        }
    }

    // --- Helper Functions ---

    function ensureAddPageCard(submenu) {
        if (!submenu || submenu.querySelector('.add-page-card')) return;
        const addCard = document.createElement('div');
        addCard.className = 'add-page-card';
        addCard.title = 'Create New Page';
        addCard.innerHTML = '<i class="fa-solid fa-plus" aria-hidden="true"></i>';
        addCard.onclick = (e) => {
            e.stopPropagation();
            const bookGroup = submenu.closest('.book-group');
            const bookId = bookGroup ? bookGroup.dataset.bookId : 'book1';
            addNewPageInBook(bookId);
        };
        submenu.appendChild(addCard);
    }

    function addNewPageInBook(bookId) {
        let bookGroup = document.querySelector(`.book-group[data-book-id="${bookId}"]`);
        if (!bookGroup) bookGroup = document.querySelector('.book-group');
        if (!bookGroup) return;

        const menuId = `${bookGroup.dataset.bookId}-menu`;
        const submenu = document.getElementById(menuId) || bookGroup.querySelector('.sidebar-submenu');
        if (submenu && !submenu.classList.contains('active')) {
            toggleSidebarMenu(menuId);
        }

        const newPageId = `note-page-${editor.nextChapterId}`;
        const newPageNum = (submenu ? submenu.querySelectorAll('.page-link').length : 0) + 1;

        editor.saveCurrentContent();
        editor.createChapter(newPageId, `Page ${newPageNum}`);

        const link = createSidebarLink(submenu, `Page ${newPageNum}`, newPageId, false);
        editor.setActiveChapter(newPageId);
        if (link) selectItem('page', link);

        saveData();
    }
    window.addNewPageInBook = addNewPageInBook;

    function updatePageThumbnail(pageId) {
        if (!pageId) return;
        const link = document.querySelector(`.page-link[data-target-id="${pageId}"]`);
        if (!link) return;

        let thumbCanvas = link.querySelector('.page-thumbnail-canvas');
        if (!thumbCanvas) {
            link.innerHTML = `
                <div class="page-thumbnail-container">
                    <div class="page-thumbnail-canvas">
                        <div class="empty-thumb-placeholder"></div>
                    </div>
                    <span class="page-thumbnail-badge">1</span>
                </div>
            `;
            thumbCanvas = link.querySelector('.page-thumbnail-canvas');
        }

        const chapter = editor.chapters.get(pageId);
        const content = chapter ? chapter.content : '';

        // Match the live page background and text color if present
        const pageEl = document.getElementById(pageId);
        if (pageEl) {
            const pageBg = window.getComputedStyle(pageEl).backgroundColor;
            if (pageBg && pageBg !== 'rgba(0, 0, 0, 0)' && pageBg !== 'transparent') {
                thumbCanvas.style.backgroundColor = pageBg;
                link.style.backgroundColor = pageBg;
            }
            const pageColor = window.getComputedStyle(pageEl).color;
            if (pageColor) {
                thumbCanvas.style.color = pageColor;
            }
        }

        // Render live content preview
        if (!content || content.trim() === '' || content === '<p><br></p>') {
            thumbCanvas.innerHTML = '<div class="empty-thumb-placeholder"></div>';
        } else {
            thumbCanvas.innerHTML = content;
            thumbCanvas.querySelectorAll('.drawing-layer').forEach(dl => dl.remove());
        }

        // Update miniature page badge number
        const badge = link.querySelector('.page-thumbnail-badge');
        if (badge) {
            const parentSubmenu = link.closest('.sidebar-submenu');
            if (parentSubmenu) {
                const allLinks = Array.from(parentSubmenu.querySelectorAll('.page-link')).filter(l => l.dataset.isContinuation !== 'true');
                const idx = allLinks.indexOf(link);
                badge.innerText = idx >= 0 ? (idx + 1) : '1';
            }
        }
    }
    window.updatePageThumbnail = updatePageThumbnail;

    function updateAllPageThumbnails() {
        document.querySelectorAll('.page-link').forEach(link => {
            if (link.dataset.targetId) {
                updatePageThumbnail(link.dataset.targetId);
            }
        });
    }
    window.updateAllPageThumbnails = updateAllPageThumbnails;

    function createSidebarLink(submenu, text, id, isContinuation) {
        const link = document.createElement('div');
        link.className = 'sidebar-item page-link';
        link.dataset.targetId = id;
        if (isContinuation) {
            link.dataset.isContinuation = 'true';
            link.style.display = 'none';
            return;
        }

        link.innerHTML = `
            <div class="page-thumbnail-container">
                <div class="page-thumbnail-canvas">
                    <div class="empty-thumb-placeholder"></div>
                </div>
                <span class="page-thumbnail-badge">1</span>
            </div>
            <span class="sidebar-text" style="display: none;">${text}</span>
        `;

        link.onclick = (e) => {
            if (e.target.closest('.icon-button')) return;

            editor.saveCurrentContent();
            selectItem('page', link);
            editor.setActiveChapter(id);
        };

        if (submenu) {
            const addCard = submenu.querySelector('.add-page-card');
            if (addCard) {
                submenu.insertBefore(link, addCard);
            } else {
                submenu.appendChild(link);
                ensureAddPageCard(submenu);
            }
        }

        setTimeout(() => updatePageThumbnail(id), 10);
        return link;
    }

    function createBookGroup(id, name, color) {
        const group = document.createElement('div');
        group.className = 'book-group';
        group.dataset.bookId = id;

        const bookTab = document.createElement('div');
        bookTab.className = 'sidebar-item book-tab';
        bookTab.onclick = () => toggleSidebarMenu(`${id}-menu`);

        // Icon
        const icon = document.createElement('i');
        icon.className = 'fa-solid fa-book';
        if (color) icon.style.color = color;

        const text = document.createElement('span');
        text.className = 'sidebar-text';
        text.innerText = name;

        bookTab.appendChild(icon);
        bookTab.appendChild(text);

        const submenu = document.createElement('div');
        submenu.className = 'sidebar-submenu';
        submenu.id = `${id}-menu`;
        ensureAddPageCard(submenu);

        group.appendChild(bookTab);
        group.appendChild(submenu);

        return group;
    }

    // --- Button Event Listeners ---

    addBookBtn.addEventListener('click', () => {
        bookCount++;
        const newBookId = `book${bookCount}`;
        const group = createBookGroup(newBookId, `Book ${bookCount}`, null);

        // Append to the workspace folder submenu
        const workspaceMenu = document.getElementById('workspace-folder-menu');
        if (workspaceMenu) {
            workspaceMenu.appendChild(group);
        } else {
            sidebarBooksScroll.appendChild(group);
        }

        toggleSidebarMenu(`${newBookId}-menu`);
        saveData();
    });

    if (addPageBtn) {
        addPageBtn.addEventListener('click', () => {
            // Find Active Book
            let activeSubmenu = null;

            // Priority 1: Currently selected book tab's submenu (This is perfectly updated whether clicking a book or a page)
            const selectedBook = document.querySelector('.book-tab.selected');
            if (selectedBook && selectedBook.nextElementSibling && selectedBook.nextElementSibling.classList.contains('sidebar-submenu')) {
                activeSubmenu = selectedBook.nextElementSibling;
            }

            // Priority 2: The last interacted book menu (tracked by currentBookId)
            if (!activeSubmenu && currentBookId && currentBookId !== 'workspace-folder-menu') {
                const lastMenu = document.getElementById(currentBookId);
                if (lastMenu && lastMenu.classList.contains('active')) {
                    activeSubmenu = lastMenu;
                }
            }

            // Priority 3: Fallback to the first active open book
            if (!activeSubmenu) {
                activeSubmenu = document.querySelector('.sidebar-submenu.active:not(#workspace-folder-menu)');
            }

            if (!activeSubmenu) {
                // If no book open, default to first or create one
                let firstGroup = document.querySelector('.book-group');
                if (!firstGroup) {
                    addBookBtn.click();
                    firstGroup = document.querySelector('.book-group');
                }
                const menuId = firstGroup.dataset.bookId + '-menu';
                toggleSidebarMenu(menuId);
                activeSubmenu = document.getElementById(menuId);
            }

            // Calculate New Page ID
            // We need a unique ID. editor.nextChapterId handles this.
            const newPageId = `note-page-${editor.nextChapterId}`;
            const newPageNum = activeSubmenu.querySelectorAll('.page-link').length + 1;

            // Force save of current canvas before we mutate the sidebar or re-render
            editor.saveCurrentContent();

            // Create Model
            editor.createChapter(newPageId, `Page ${newPageNum}`);

            // Create Sidebar Link FIRST so 'renderActiveChapter' picks it up in its DOM scan
            const link = createSidebarLink(activeSubmenu, `Page ${newPageNum}`, newPageId, false);

            // Setting Active triggers renderActiveChapter, which will now stitch the new page onto the canvas and scroll down
            editor.setActiveChapter(newPageId);
            selectItem('page', link);

            saveData();
        });
    }

    // --- Auto-Scroll Logic ---
    let lastFocusedPageId = null;

    function handleAutoScroll() {
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        let startNode = range.startContainer;
        if (startNode.nodeType === Node.TEXT_NODE) startNode = startNode.parentElement;

        const currentPage = startNode.closest('.a4-page');

        // Page Transition Detection
        if (currentPage && currentPage.id) {
            if (lastFocusedPageId && lastFocusedPageId !== currentPage.id) {
                // We moved to a new page!
                // Scroll to the top of this new page
                currentPage.scrollIntoView({ behavior: 'smooth', block: 'start' });
                lastFocusedPageId = currentPage.id;
                return; // Skip standard buffer scroll for this frame
            }
            lastFocusedPageId = currentPage.id;
        }

        const rect = range.getBoundingClientRect();

        // Handle collapsed ranges returning 0 rects sometimes
        if (rect.bottom === 0 && rect.top === 0) {
            const clientRects = range.getClientRects();
            if (clientRects.length > 0) {
                checkAndScroll(clientRects[clientRects.length - 1]);
            } else {
                // FALLBACK: Use a dummy span to measure exact cursor position
                // Avoid using parentElement (which could be the huge .a4-page)
                const span = document.createElement('span');
                // span.textContent = '|'; // Invisible char not needed if we clone range?
                // Actually, insertNode puts it at cursor.
                try {
                    const rangeClone = range.cloneRange();
                    rangeClone.insertNode(span);
                    const spanRect = span.getBoundingClientRect();
                    checkAndScroll(spanRect);
                    span.remove();
                } catch (e) {
                    // If error (e.g. read-only context?), fallback to parent but check class
                    const el = selection.focusNode.parentElement;
                    if (el && !el.classList.contains('a4-page')) {
                        checkAndScroll(el.getBoundingClientRect());
                    }
                }
            }
        } else {
            checkAndScroll(rect);
        }
    }

    function checkAndScroll(rect) {
        const scrollContainer = document.querySelector('.main-content-area');
        if (!scrollContainer) return;

        const containerRect = scrollContainer.getBoundingClientRect();

        // Thresholds relative to the container's viewport
        // Use containerRect.bottom as the reference point for the bottom of the visible area
        const bottomThreshold = containerRect.bottom - 150;
        // Padding is 96px. Threshold must be smaller (80px) to avoid scrolling up 
        const topThreshold = containerRect.top + 80;

        // Scroll Down
        if (rect.bottom > bottomThreshold) {
            const diff = rect.bottom - bottomThreshold;
            scrollContainer.scrollBy({
                top: diff + 20,
                behavior: 'auto'
            });
        }

        // Scroll Up
        if (rect.top < topThreshold) {
            const diff = topThreshold - rect.top;
            scrollContainer.scrollBy({
                top: -(diff + 20),
                behavior: 'auto'
            });
        }
    }

    // Global Listeners for Auto-Scroll
    // Debounce slightly to avoid excessive rect calculations on every pixel of drag/select, 
    // but keep it snappy for typing. 
    // `requestId` for animation frame throttling.
    let scrollRequestId = null;
    const requestAutoScroll = () => {
        if (scrollRequestId) return;
        scrollRequestId = requestAnimationFrame(() => {
            handleAutoScroll();
            scrollRequestId = null;
        });
    };

    document.addEventListener('input', requestAutoScroll);
    document.addEventListener('keydown', requestAutoScroll); // Arrow keys
    // document.addEventListener('mouseup', requestAutoScroll); // Removed: Causes unwanted scroll jumps on click

    // --- Automatic Sidebar Highlighting ---
    let lastActivePageId = null;

    function handleSidebarHighlight() {
        const selection = window.getSelection();
        if (!selection || !selection.rangeCount) return;

        let node = selection.focusNode;
        if (!node) return;

        if (node.nodeType === Node.TEXT_NODE) {
            node = node.parentElement;
        }

        const currentPage = node.closest('.a4-page');
        if (!currentPage) return;

        const pageId = currentPage.id;
        if (pageId === lastActivePageId) return; // Only update if changed

        const link = document.querySelector(`.page-link[data-target-id="${pageId}"]`);
        if (!link) return;

        // Update selection visually
        document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('selected'));
        link.classList.add('selected');

        // Ensure its parent book is also visually selected
        const bookGroup = link.closest('.book-group');
        if (bookGroup) {
            const bookTab = bookGroup.querySelector('.book-tab');
            if (bookTab) {
                bookTab.classList.add('selected');

                // If it's closed, maybe open it? Optional, let's just mark it.
                // It was requested not to touch paging logic, this is just visual.
            }
        }

        lastActivePageId = pageId;
    }

    document.addEventListener('selectionchange', handleSidebarHighlight);
    document.addEventListener('keyup', handleSidebarHighlight);
    document.addEventListener('click', handleSidebarHighlight);


    // Click-to-Position (Typewriter Mode)
    document.addEventListener('click', (e) => {
        if (!e.target.classList.contains('a4-page')) return;

        const page = e.target;
        const style = window.getComputedStyle(page);
        const lineHeight = parseFloat(style.lineHeight) || 28.8;
        const paddingBottom = parseFloat(style.paddingBottom);
        const pageRect = page.getBoundingClientRect();

        // Calculate where the click happened relative to the page content area
        const clickY = e.clientY - pageRect.top; // Relative Y in pixels

        // Find the visual bottom of the current text content
        let contentBottom = parseFloat(style.paddingTop);
        if (page.lastChild) {
            const range = document.createRange();
            range.selectNodeContents(page);
            const rects = range.getClientRects();
            if (rects.length > 0) {
                const lastRect = rects[rects.length - 1];
                contentBottom = lastRect.bottom - pageRect.top;
            } else {
                // Determine if it has children that take up space
                // Fallback to iterating children
                const children = Array.from(page.children);
                if (children.length > 0) {
                    const lastEl = children[children.length - 1];
                    const lastRect = lastEl.getBoundingClientRect();
                    contentBottom = lastRect.bottom - pageRect.top;
                }
            }
        }

        // If we clicked significantly below the content
        if (clickY > contentBottom + lineHeight) {
            const gap = clickY - contentBottom;
            const linesToAdd = Math.floor(gap / lineHeight);

            if (linesToAdd > 0) {
                // Prevent creating excessive newlines if we click accidentally
                // Cap it at, say, 50 lines at once?
                const safeLines = Math.min(linesToAdd, 50);

                // Add the breaks
                const fragment = document.createDocumentFragment();
                for (let i = 0; i < safeLines; i++) {
                    fragment.appendChild(document.createElement('br'));
                }
                page.appendChild(fragment);

                // Move cursor to the end
                const selection = window.getSelection();
                const range = document.createRange();
                range.selectNodeContents(page);
                range.collapse(false); // Move to end
                selection.removeAllRanges();
                selection.addRange(range);

                // Scroll into view if needed
                page.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

                // Save state since we modified content
                saveData();
            }
        }
    });

    // --- Core View Handlers ---

    window.toggleSidebarMenu = function (menuId) {
        const menu = document.getElementById(menuId);
        if (!menu) return;

        let tabElement = menu.previousElementSibling;
        if (!tabElement || (!tabElement.classList.contains('book-tab') && !tabElement.classList.contains('folder-tab'))) {
            // Try to find it differently if structurally changed, though previousElementSibling is standard here
            tabElement = menu.parentElement.querySelector('.book-tab, .folder-tab');
        }

        menu.classList.toggle('active');

        const icon = tabElement && tabElement.querySelector('i');
        const isFolder = tabElement && tabElement.classList.contains('folder-tab');
        const isBook = tabElement && tabElement.classList.contains('book-tab');

        if (menu.classList.contains('active')) {
            // Explicitly remove .selected from all other top-level tabs
            document.querySelectorAll('.book-tab, .folder-tab').forEach(el => el.classList.remove('selected'));

            if (tabElement) tabElement.classList.add('selected');
            if (icon) {
                if (isFolder) {
                    icon.classList.remove('fa-folder');
                    icon.classList.add('fa-folder-open');
                }
            }
            if (isBook) currentBookId = menuId;
        } else {
            if (tabElement) tabElement.classList.remove('selected');
            if (icon) {
                if (isFolder) {
                    icon.classList.remove('fa-folder-open');
                    icon.classList.add('fa-folder');
                }
            }
        }
        if (typeof updateAllBookIcons === 'function') updateAllBookIcons();
        updateToolbarText();
    };

    function updateToolbarText() {
        const toolbarText = document.querySelector('.sidebar-toolbar .toolbar-text');
        if (!toolbarText) return;

        const selectedPage = document.querySelector('.page-link.selected');
        const selectedBook = document.querySelector('.book-tab.selected');

        let bookName = "";
        let pageName = "";
        let bookColor = getComputedStyle(document.body).color;

        const getBookColor = (bookTab) => {
            const icon = bookTab.querySelector('i');
            if (icon) {
                return icon.style.color || getComputedStyle(icon).color;
            }
            return '';
        };

        if (selectedPage) {
            const submenu = selectedPage.closest('.sidebar-submenu');
            if (submenu) {
                const parentBookTab = submenu.previousElementSibling;
                if (parentBookTab && parentBookTab.classList.contains('book-tab')) {
                    bookName = parentBookTab.querySelector('.sidebar-text').innerText;
                    bookColor = getBookColor(parentBookTab);
                }
            }
            const textSpan = selectedPage.querySelector('.sidebar-text');
            let text = textSpan ? textSpan.innerText : (editor.chapters.get(editor.activeChapterId)?.title || 'Page');
            if (text.includes(':')) {
                text = text.split(':')[0].trim();
            }
            pageName = text;
        }
        else if (selectedBook) {
            bookName = selectedBook.querySelector('.sidebar-text').innerText;
            bookColor = getBookColor(selectedBook);
        }

        const bookSpan = `<span class="book-part" style="color: ${bookColor};">${bookName}</span>`;

        if (bookName && pageName) {
            toolbarText.innerHTML = `${bookSpan}<span class="separator"></span><span class="page-part">${pageName}</span>`;
            toolbarText.title = `${bookName} | ${pageName}`;
        } else if (bookName) {
            toolbarText.innerHTML = `${bookSpan}`;
        } else {
            toolbarText.textContent = "Select a Page";
        }
    }

    window.updateAllBookIcons = function () {
        document.querySelectorAll('.book-group').forEach(group => {
            const tab = group.querySelector('.book-tab');
            const menu = group.querySelector('.sidebar-submenu');
            const icon = tab ? tab.querySelector('i') : null;

            if (icon && menu) {
                const isActive = menu.classList.contains('active');
                const hasPages = menu.querySelectorAll('.page-link').length > 0;

                if (isActive && hasPages) {
                    icon.classList.remove('fa-book');
                    icon.classList.add('fa-book-open');
                } else {
                    icon.classList.remove('fa-book-open');
                    icon.classList.add('fa-book');
                }
            }
        });
    };

    function selectItem(type, element) {
        if (type === 'book') {
            document.querySelectorAll('.book-tab').forEach(el => el.classList.remove('selected'));
            if (element) element.classList.add('selected');
        } else if (type === 'page') {
            document.querySelectorAll('.page-link').forEach(el => el.classList.remove('selected'));
            if (element) {
                element.classList.add('selected');
                // Ensure the parent book is also the only selected book
                const parentBookGroup = element.closest('.book-group');
                if (parentBookGroup) {
                    const bookTab = parentBookGroup.querySelector('.book-tab');
                    if (bookTab) {
                        document.querySelectorAll('.book-tab').forEach(el => el.classList.remove('selected'));
                        bookTab.classList.add('selected');
                    }
                }
            }
        }
        updateToolbarText();
    }

    // --- Interactions (Context Menu, Rename, etc) that need Save ---

    const contextMenu = document.getElementById('context-menu');
    const contextClose = document.getElementById('context-close');
    const contextColor = document.getElementById('context-color');
    let targetElement = null;

    document.addEventListener('click', (e) => {
        if (e.target.closest('#context-menu')) return;
        if (contextMenu.style.display === 'block') {
            contextMenu.style.display = 'none';
        }
    });

    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        sidebar.addEventListener('contextmenu', (e) => {
            const item = e.target.closest('.sidebar-item');
            if (item) {
                e.preventDefault();
                targetElement = item;

                if (item.classList.contains('book-tab')) {
                    contextColor.style.display = 'flex';
                } else {
                    contextColor.style.display = 'none';
                }

                contextMenu.style.top = `${e.pageY}px`;
                contextMenu.style.left = `${e.pageX}px`;
                contextMenu.style.display = 'block';
            }
        });
    }

    contextMenu.addEventListener('click', (e) => {
        const swatch = e.target.closest('.context-swatch');
        if (swatch) {
            e.stopPropagation();
            const color = swatch.dataset.color;

            if (targetElement && targetElement.classList.contains('book-tab')) {
                const icon = targetElement.querySelector('i');
                if (icon) {
                    icon.style.setProperty('color', color, 'important');
                    updateToolbarText();
                    saveData(); // SAVE: Color change
                }
            }
            contextMenu.style.display = 'none';
        }
    });

    // --- Deletion Logic ---

    function deleteItem(targetElement) {
        if (!targetElement) return;

        // Check if it's a Book
        if (targetElement.classList.contains('book-tab')) {
            const group = targetElement.closest('.book-group');
            if (group) {
                // Remove associated content pages for ALL pages in this book
                const pages = group.querySelectorAll('.page-link');
                pages.forEach(page => {
                    const targetId = page.dataset.targetId;
                    if (targetId && editor.chapters.has(targetId)) {
                        editor.deleteChapter(targetId);
                    }
                });
                group.remove();
            }
        }
        // Check if it's a Virtual Page (Visual Slice)
        else if (targetElement.classList.contains('virtual-page-link')) {
            const text = targetElement.querySelector('.sidebar-text').innerText;
            const match = text.match(/Page (\d+)/);
            if (match) {
                deleteVirtualPage(parseInt(match[1], 10));
                // No manual remove needed, updatePagination reflows sidebar
            }
        }
        // Check if it's a Standard Page (Chapter)
        else if (targetElement.classList.contains('page-link')) {
            const targetId = targetElement.dataset.targetId;
            if (targetId) {
                editor.deleteChapter(targetId);
                const a4 = document.getElementById(targetId);
                if (a4) {
                    a4.remove();
                    editor.saveCurrentContent(); // Immediately update the remaining chapters
                }
            }
            targetElement.remove();
        }

        updateToolbarText();
        saveData(); // SAVE: Deletion
    }

    // Backspace / Delete Key Listener
    document.addEventListener('keydown', (e) => {
        // Only trigger if NOT typing in an editor or input
        if (e.target.isContentEditable || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }

        if (e.key === 'Backspace' || e.key === 'Delete') {
            const selected = document.querySelector('.page-link.selected, .book-tab.selected');
            if (selected) {
                // Optional: Confirm dialog? User requested "just click backspace".
                deleteItem(selected);
            }
        }
    });

    contextClose.addEventListener('click', () => {
        if (targetElement) {
            deleteItem(targetElement);
            contextMenu.style.display = 'none';
            targetElement = null;
        }
    });

    // Rename
    sidebarBooksScroll.addEventListener('dblclick', (e) => {
        const bookTab = e.target.closest('.book-tab');
        if (!bookTab) return;

        const textSpan = bookTab.querySelector('.sidebar-text');
        if (!textSpan) return;
        if (textSpan.style.display === 'none') return;

        const currentName = textSpan.innerText;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentName;
        input.className = 'editable-input';

        textSpan.style.display = 'none';
        bookTab.insertBefore(input, textSpan);
        input.focus();
        input.select();

        function saveName() {
            const newName = input.value.trim() || currentName;
            textSpan.innerText = newName;
            textSpan.style.display = '';
            input.remove();
            updateToolbarText();
            saveData(); // SAVE: Rename
        }

        input.addEventListener('blur', saveName);
        input.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter') saveName();
        });
    });

    // Click Delegation
    sidebarBooksScroll.addEventListener('click', (e) => {
        const pageLink = e.target.closest('.page-link');
        if (pageLink) {
            selectItem('page', pageLink);
        }
    });


    // --- Drag and Drop Logic ---
    let draggedItem = null;
    let longPressTimer;
    let isDragging = false;
    let startY = 0;

    function initDraggable(draggableEl, handleEl) {
        if (!handleEl) return;

        handleEl.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            startY = e.clientY;
            longPressTimer = setTimeout(() => {
                startDrag(draggableEl, e.clientY);
            }, 600);
        });

        const clearTimer = () => {
            if (longPressTimer) clearTimeout(longPressTimer);
        };

        handleEl.addEventListener('mouseup', clearTimer);
        handleEl.addEventListener('mouseleave', clearTimer);
        handleEl.addEventListener('mousemove', (e) => {
            if (Math.abs(e.clientY - startY) > 5) clearTimer();
        });

        handleEl.addEventListener('touchstart', (e) => {
            startY = e.touches[0].clientY;
            longPressTimer = setTimeout(() => {
                startDrag(draggableEl, e.touches[0].clientY);
            }, 600);
        }, { passive: false });

        handleEl.addEventListener('touchend', clearTimer);
        handleEl.addEventListener('touchmove', (e) => {
            if (Math.abs(e.touches[0].clientY - startY) > 5) clearTimer();
        }, { passive: false });
    }

    function setupBookGroupDrag(group) {
        const bookTab = group.querySelector('.book-tab');
        initDraggable(group, bookTab);
        group.querySelectorAll('.page-link').forEach(page => {
            initDraggable(page, page);
        });
    }

    function startDrag(item, initialY) {
        isDragging = true;
        draggedItem = item;
        item.classList.add('dragging');
        document.body.style.userSelect = 'none';

        document.addEventListener('mousemove', onDragMove);
        document.addEventListener('mouseup', onDragEnd);
        document.addEventListener('touchmove', onTouchMove, { passive: false });
        document.addEventListener('touchend', onDragEnd);
    }

    function onDragMove(e) {
        if (!isDragging || !draggedItem) return;
        e.preventDefault();
        handleMove(e.clientY);
    }

    function onTouchMove(e) {
        if (!isDragging || !draggedItem) return;
        e.preventDefault();
        handleMove(e.touches[0].clientY);
    }

    function handleMove(clientY) {
        const container = draggedItem.parentElement;
        const itemClass = draggedItem.classList.contains('book-group') ? '.book-group' : '.page-link';
        const siblings = [...container.querySelectorAll(`${itemClass}:not(.dragging)`)];

        let nextSibling = siblings.find(sibling => {
            const box = sibling.getBoundingClientRect();
            const center = box.top + box.height / 2;
            return clientY < center;
        }) || null;

        container.insertBefore(draggedItem, nextSibling);
    }

    function onDragEnd() {
        if (draggedItem) {
            draggedItem.classList.remove('dragging');
            draggedItem = null;
        }
        isDragging = false;
        document.body.style.userSelect = '';

        document.removeEventListener('mousemove', onDragMove);
        document.removeEventListener('mouseup', onDragEnd);
        document.removeEventListener('touchmove', onTouchMove);
        document.removeEventListener('touchend', onDragEnd);

        updateToolbarText();
        saveData(); // SAVE: Reordering
    }

    // --- Init ---
    if (isDemoMode) {
        window.initializeFreshUserNotes();
    } else if (!loadData()) {
        // First Run: Default 1 Book 1 Page
        const initialPageId = 'note-page-1';
        editor.createChapter(initialPageId, 'Page 1', '');

        const defaultGroup = document.querySelector('.book-group');
        if (defaultGroup) {
            setupBookGroupDrag(defaultGroup);
            const submenu = defaultGroup.querySelector('.sidebar-submenu');
            if (submenu) {
                submenu.innerHTML = '';
                const link = createSidebarLink(submenu, 'Page 1', initialPageId, false);
                const menuId = defaultGroup.dataset.bookId + '-menu';
                submenu.id = menuId;
                const bookTab = defaultGroup.querySelector('.book-tab');
                if (bookTab) bookTab.onclick = () => toggleSidebarMenu(menuId);
                if (!submenu.classList.contains('active')) {
                    toggleSidebarMenu(menuId);
                }
                if (link) selectItem('page', link);

                // Set active chapter AFTER link exists in DOM so renderActiveChapter builds the initial A4 page
                editor.setActiveChapter(initialPageId);
            }
        }
    } else {
        // Data Loaded successfully
        // Validate Active Chapter
        if (!editor.activeChapterId || !editor.chapters.has(editor.activeChapterId)) {
            // Fallback: Find first available page
            const firstBook = document.querySelector('.book-group');
            if (firstBook) {
                const firstPageLink = firstBook.querySelector('.page-link');
                if (firstPageLink) {
                    editor.activeChapterId = firstPageLink.dataset.targetId;
                }
            }
        }

        // If still no active chapter (empty books?), force default
        if (!editor.activeChapterId) {
            const initialPageId = 'note-page-1';
            // Check if we need to recreate the chapter or just set ID
            if (!editor.chapters.has(initialPageId)) {
                editor.createChapter(initialPageId, 'Page 1', '');
            }
            editor.activeChapterId = initialPageId;
        }

        // Render
        if (editor.activeChapterId) {
            editor.setActiveChapter(editor.activeChapterId);

            // Sync UI Selection
            const pageLink = document.querySelector(`.page-link[data-target-id="${editor.activeChapterId}"]`);
            if (pageLink) selectItem('page', pageLink);

            updateToolbarText();
        }
        setTimeout(() => updateAllPageThumbnails(), 100);
    }

    // --- Toolbar & Context ---
    // (updateToolbarText is already defined above)

    // Function to calculate fit width scale (with margins)
    const calculateFitWidthScale = () => {
        const container = document.querySelector('.main-content-area');
        if (!container) return 1;

        const availWidth = container.clientWidth; // Width without scrollbar
        const pageWidth = 794; // True .a4-page width from CSS
        const sideMargins = 0; // 0px margin so it touches the sidebars

        // Calculate scale to fit width exactly, minus desired margins
        return (availWidth - sideMargins) / pageWidth;
    };

    let currentScale = calculateFitWidthScale();
    const MIN_SCALE = 0.5;
    const MAX_SCALE = 1.5;
    const zoomLevels = ['fit-width', 1, 1.2, 1.5, 0.8];
    let zoomCycleIndex = 0;

    // 'pageContainer' is defined globally at the top.
    if (pageContainer) {
        pageContainer.style.setProperty('--page-zoom', currentScale);
    }

    const mainContentArea = document.querySelector('.main-content-area');
    const zoomBtn = document.getElementById('zoom-btn');

    let zoomAnimationId = null;

    // Function to animate zoom
    const animateZoomTo = (targetScale, callback) => {
        // Cancel any pending animation
        if (zoomAnimationId) cancelAnimationFrame(zoomAnimationId);

        const startScale = parseFloat(pageContainer.style.getPropertyValue('--page-zoom')) || 1;
        const startTime = performance.now();
        const duration = 280; // Smooth 280ms duration

        const step = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Smooth Quartic Ease Out
            const ease = 1 - Math.pow(1 - progress, 4);

            const current = startScale + (targetScale - startScale) * ease;
            pageContainer.style.setProperty('--page-zoom', current);

            if (progress < 1) {
                zoomAnimationId = requestAnimationFrame(step);
            } else {
                if (callback) callback();
            }
        };

        zoomAnimationId = requestAnimationFrame(step);
    };

    // Function to update padding based on zoom level
    const updateZoomPadding = () => {
        if (!mainContentArea) return;

        // Logic for padding:
        // If zoom is 'fit-width' (which results in a specific scale), we want 0 padding
        // or if zoom is ~1.7 (legacy support for user's previous specific request).
        // Let's generalize: if scale is >= fitWidthScale (meaning it touches sides), 
        // OR if it's explicitly one of our "full" modes, remove padding.

        // Simpler: If we are in "fit-width" mode logic, we set padding to 0.
        // But currentScale is just a number. 
        // Let's check if the current scale effectively fills the width?
        const fitScale = calculateFitWidthScale();

        // If current scale is close to fit scale OR close to 1.7 (user's specific request)
        if (Math.abs(currentScale - fitScale) < 0.05 || Math.abs(currentScale - 1.7) < 0.05) {
            mainContentArea.style.paddingTop = '0px';
            mainContentArea.style.paddingBottom = '0px';
        } else {
            mainContentArea.style.paddingTop = '15px';
            mainContentArea.style.paddingBottom = '15px';
        }
    };

    // Initialize padding
    updateZoomPadding();

    // 1. Wheel Zoom (Free)
    if (mainContentArea && pageContainer) {
        mainContentArea.addEventListener('wheel', (e) => {
            if (e.ctrlKey) {
                e.preventDefault();
                const zoomFactor = 0.01;
                if (e.deltaY < 0) {
                    currentScale += (Math.abs(e.deltaY) * zoomFactor);
                } else {
                    currentScale -= (Math.abs(e.deltaY) * zoomFactor);
                }
                currentScale = Math.min(Math.max(currentScale, MIN_SCALE), MAX_SCALE);
                pageContainer.style.setProperty('--page-zoom', currentScale);
                updateZoomPadding();
            }
        }, { passive: false });
    }

    // 2. Button Cycle Zoom
    if (zoomBtn && pageContainer) {
        zoomBtn.addEventListener('click', () => {
            zoomCycleIndex = (zoomCycleIndex + 1) % zoomLevels.length;
            let level = zoomLevels[zoomCycleIndex];

            if (level === 'fit-width') {
                currentScale = calculateFitWidthScale();
            } else {
                currentScale = level;
            }

            // Animate to new scale
            updateZoomPadding(); // Start padding transition immediately (CSS handles smoothing)

            animateZoomTo(currentScale, () => {
                // After animation completes, handle scrolling
                if (level === 'fit-width') {
                    // Margin is 30px. Scaled margin is 30 * currentScale.
                    mainContentArea.scrollTo({
                        top: 30 * currentScale,
                        behavior: 'smooth'
                    });
                } else {
                    // For other levels, reset to top
                    mainContentArea.scrollTo({
                        top: 0,
                        behavior: 'smooth'
                    });
                }
            });
        });

        // Update on resize if needed (optional, but good for fit-width)
        window.addEventListener('resize', () => {
            // If we were supposed to be in fit-width mode, we could re-calc.
            // But we don't track the *mode*, just the scale. 
            // For now, let's just update padding check.
            updateZoomPadding();
        });
    }

}); // End DOMContentLoaded
