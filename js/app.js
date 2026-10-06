/**
 * HireTrail — Job Application Tracker
 * Vanilla JS: state management, CRUD, localStorage, filtering, validation
 * Optimized: targeted DOM updates, single render on init, debounced search
 */
(function () {
    'use strict';

    // =========================================================================
    // CONSTANTS
    // =========================================================================
    const STAGES = [
        { key: 'to-contact', label: 'To Contact' },
        { key: 'contacted', label: 'Contacted' },
        { key: 'interview-pending', label: 'Interview Pending' },
        { key: 'offer-contract', label: 'Offer / Contract' },
        { key: 'closed', label: 'Closed' },
    ];

    const STORAGE_KEY = 'hiretrail-applications';

    // =========================================================================
    // STATE
    // =========================================================================
    let applications = [];
    let editingId = null;
    let deleteTargetId = null;
    let currentFilter = 'all';
    let currentSearch = '';

    // =========================================================================
    // DOM REFERENCES
    // =========================================================================
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const dom = {
        menuToggle: $('#menu-toggle'),
        mainNav: $('#main-nav'),
        btnOpenForm: $('#btn-open-form'),
        btnEmptyAdd: $('#btn-empty-add'),
        appDialog: $('#app-dialog'),
        dialogTitle: $('#dialog-title'),
        btnDialogClose: $('#btn-dialog-close'),
        btnCancel: $('#btn-cancel'),
        appForm: $('#app-form'),
        appId: $('#app-id'),
        company: $('#company'),
        jobTitle: $('#job-title'),
        stage: $('#stage'),
        contactPerson: $('#contact-person'),
        contactEmail: $('#contact-email'),
        dateApplied: $('#date-applied'),
        interviewDate: $('#interview-date'),
        notes: $('#notes'),
        btnSubmit: $('#btn-submit'),
        confirmDialog: $('#confirm-dialog'),
        btnConfirmCancel: $('#btn-confirm-cancel'),
        btnConfirmDelete: $('#btn-confirm-delete'),
        filterSearch: $('#filter-search'),
        filterStage: $('#filter-stage'),
        statsGrid: $('#stats-grid'),
        boardSections: $('#board-sections'),
        emptyState: $('#empty-state'),
        stageTabs: $$('.stage-tab'),
        currentYear: $('#current-year'),
    };

    // =========================================================================
    // PERSISTENCE (called exactly once on startup)
    // =========================================================================
    function loadState() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                applications = JSON.parse(raw);
            }
        } catch (e) {
            console.warn('Failed to load state from localStorage', e);
            applications = [];
        }
    }

    function saveState() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(applications));
        } catch (e) {
            console.warn('Failed to save state to localStorage', e);
        }
    }

    // =========================================================================
    // HELPERS
    // =========================================================================
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
    }

    function formatDate(isoString) {
        if (!isoString) return '';
        var d = new Date(isoString + 'T00:00:00');
        return d.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    }

    function escapeHTML(str) {
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function getStageCount(stageKey) {
        var count = 0;
        for (var i = 0; i < applications.length; i++) {
            if (applications[i].stage === stageKey) count++;
        }
        return count;
    }

    // =========================================================================
    // CARD HTML GENERATION
    // =========================================================================
    function buildCardHTML(app) {
        var stageOptions = '';
        for (var i = 0; i < STAGES.length; i++) {
            var s = STAGES[i];
            stageOptions += '<option value="' + s.key + '"' +
                (app.stage === s.key ? ' selected' : '') + '>' + s.label + '</option>';
        }

        var contactMeta = [];
        if (app.contactPerson) {
            contactMeta.push('<div><dt>Contact</dt> <dd>' + escapeHTML(app.contactPerson) + '</dd></div>');
        }
        if (app.contactEmail) {
            contactMeta.push('<div><dt>Email</dt> <dd><a href="mailto:' + escapeHTML(app.contactEmail) + '">' + escapeHTML(app.contactEmail) + '</a></dd></div>');
        }
        if (app.dateApplied) {
            contactMeta.push('<div><dt>Applied</dt> <dd>' + formatDate(app.dateApplied) + '</dd></div>');
        }
        if (app.interviewDate) {
            contactMeta.push('<div><dt>Interview</dt> <dd>' + formatDate(app.interviewDate) + '</dd></div>');
        }

        var html = '<article class="app-card" data-stage="' + escapeHTML(app.stage) + '" data-id="' + app.id + '">';
        html += '<div class="app-card-header"><div>';
        html += '<h4 class="app-card-company">' + escapeHTML(app.company) + '</h4>';
        html += '<p class="app-card-job">' + escapeHTML(app.jobTitle) + '</p>';
        html += '</div></div>';

        if (contactMeta.length) {
            html += '<dl class="app-card-meta">' + contactMeta.join('') + '</dl>';
        }

        html += '<select class="app-card-stage-select" data-action="change-stage" data-id="' + app.id + '" aria-label="Change stage for ' + escapeHTML(app.company) + '">';
        html += stageOptions;
        html += '</select>';

        html += '<div class="app-card-actions">';
        html += '<button class="btn btn-sm btn-secondary" data-action="edit" data-id="' + app.id + '" aria-label="Edit ' + escapeHTML(app.company) + '">Edit</button>';
        html += '<button class="btn btn-sm btn-danger" data-action="delete" data-id="' + app.id + '" aria-label="Delete ' + escapeHTML(app.company) + '">Delete</button>';
        html += '</div>';

        if (app.notes) {
            html += '<p class="app-card-notes">' + escapeHTML(app.notes) + '</p>';
        }

        html += '</article>';
        return html;
    }

    function attachCardEventsTo(el) {
        // Stage change select
        var sel = el.querySelector('.app-card-stage-select');
        if (sel) {
            sel.addEventListener('change', function () {
                changeStage(this.dataset.id, this.value);
            });
        }
        // Edit button
        var editBtn = el.querySelector('[data-action="edit"]');
        if (editBtn) {
            editBtn.addEventListener('click', function () {
                openEditDialog(this.dataset.id);
            });
        }
        // Delete button
        var delBtn = el.querySelector('[data-action="delete"]');
        if (delBtn) {
            delBtn.addEventListener('click', function () {
                openConfirmDelete(this.dataset.id);
            });
        }
    }

    // =========================================================================
    // STAGE SECTION HELPERS
    // =========================================================================
    function getStageSection(stageKey) {
        return dom.boardSections.querySelector('.stage-section[data-stage-key="' + stageKey + '"]');
    }

    function getStageCardsContainer(stageKey) {
        var section = getStageSection(stageKey);
        return section ? section.querySelector('.stage-cards') : null;
    }

    function updateStageCountBadge(stageKey) {
        var section = getStageSection(stageKey);
        if (!section) return;
        var badge = section.querySelector('.stage-section-count');
        if (badge) {
            badge.textContent = getStageCount(stageKey);
        }
    }

    function updateAllStageCounts() {
        for (var i = 0; i < STAGES.length; i++) {
            updateStageCountBadge(STAGES[i].key);
        }
    }

    // =========================================================================
    // RENDER (full rebuild — used for init, filter, and search)
    // =========================================================================
    function renderStats() {
        var total = applications.length;
        var html = '<div class="stat-card"><span class="stat-value">' + total + '</span><span class="stat-label">Total</span></div>';

        for (var i = 0; i < STAGES.length; i++) {
            var count = getStageCount(STAGES[i].key);
            html += '<div class="stat-card"><span class="stat-value">' + count + '</span><span class="stat-label">' + STAGES[i].label + '</span></div>';
        }

        dom.statsGrid.innerHTML = html;
    }

    function renderBoard() {
        if (applications.length === 0) {
            // Hide all stage sections, show empty state
            for (var i = 0; i < STAGES.length; i++) {
                var sec = getStageSection(STAGES[i].key);
                if (sec) {
                    sec.hidden = true;
                    sec.querySelector('.stage-cards').innerHTML = '';
                }
            }
            dom.emptyState.hidden = false;
            updateStageTabs();
            return;
        }

        dom.emptyState.hidden = true;

        // Determine which stages to show
        var stagesToShow;
        if (currentFilter === 'all') {
            stagesToShow = STAGES;
        } else {
            stagesToShow = STAGES.filter(function (s) { return s.key === currentFilter; });
        }

        // Build a lookup of filtered apps by stage
        var appsByStage = {};
        for (var i = 0; i < applications.length; i++) {
            var app = applications[i];
            // Apply search filter
            if (currentSearch.trim()) {
                var q = currentSearch.trim().toLowerCase();
                if (app.company.toLowerCase().indexOf(q) === -1) continue;
            }
            if (!appsByStage[app.stage]) appsByStage[app.stage] = [];
            appsByStage[app.stage].push(app);
        }

        // Show/hide and populate each stage section
        for (var i = 0; i < STAGES.length; i++) {
            var stage = STAGES[i];
            var section = getStageSection(stage.key);
            if (!section) continue;

            var shouldShow = false;
            for (var j = 0; j < stagesToShow.length; j++) {
                if (stagesToShow[j].key === stage.key) { shouldShow = true; break; }
            }

            if (shouldShow) {
                section.hidden = false;
                var cardsContainer = section.querySelector('.stage-cards');
                var stageApps = appsByStage[stage.key] || [];
                var cardsHTML = '';
                for (var k = 0; k < stageApps.length; k++) {
                    cardsHTML += buildCardHTML(stageApps[k]);
                }
                cardsContainer.innerHTML = cardsHTML;
                // Attach events to all cards in this section
                var cards = cardsContainer.querySelectorAll('.app-card');
                for (var k = 0; k < cards.length; k++) {
                    attachCardEventsTo(cards[k]);
                }
                // Update count badge
                section.querySelector('.stage-section-count').textContent = stageApps.length;
            } else {
                section.hidden = true;
                section.querySelector('.stage-cards').innerHTML = '';
            }
        }

        updateStageTabs();
    }

    function updateStageTabs() {
        dom.stageTabs.forEach(function (tab) {
            var stage = tab.dataset.stage;
            var isActive = stage === currentFilter || (stage === 'all' && currentFilter === 'all');
            tab.classList.toggle('active', isActive);
            tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });
    }

    // =========================================================================
    // TARGETED DOM UPDATES (no full rebuild)
    // =========================================================================

    /** Insert a single card into the correct stage section */
    function insertCardIntoStage(app) {
        var container = getStageCardsContainer(app.stage);
        if (!container) return;

        var temp = document.createElement('div');
        temp.innerHTML = buildCardHTML(app);
        var card = temp.firstElementChild;

        // Insert at top of the stage
        container.insertBefore(card, container.firstChild);
        attachCardEventsTo(card);

        // Show the stage section if hidden
        var section = getStageSection(app.stage);
        if (section && section.hidden) {
            section.hidden = false;
        }
    }

    /** Replace a card in the DOM with updated HTML */
    function replaceCardInDOM(app) {
        var oldCard = dom.boardSections.querySelector('.app-card[data-id="' + app.id + '"]');
        if (!oldCard) return;

        var temp = document.createElement('div');
        temp.innerHTML = buildCardHTML(app);
        var newCard = temp.firstElementChild;

        oldCard.parentNode.replaceChild(newCard, oldCard);
        attachCardEventsTo(newCard);
    }

    /** Remove a card from the DOM by id */
    function removeCardFromDOM(id) {
        var card = dom.boardSections.querySelector('.app-card[data-id="' + id + '"]');
        if (!card) return;
        var stageKey = card.dataset.stage;
        card.remove();
        updateStageCountBadge(stageKey);
    }

    /** Move a card from one stage section to another */
    function moveCardInDOM(id, newStage) {
        var card = dom.boardSections.querySelector('.app-card[data-id="' + id + '"]');
        if (!card) return;

        var oldStage = card.dataset.stage;
        card.dataset.stage = newStage;

        // Update the stage select on the card
        var sel = card.querySelector('.app-card-stage-select');
        if (sel) sel.value = newStage;

        // Move to new stage section
        var newContainer = getStageCardsContainer(newStage);
        if (newContainer) {
            newContainer.insertBefore(card, newContainer.firstChild);

            // Show the target section if hidden
            var section = getStageSection(newStage);
            if (section && section.hidden) {
                section.hidden = false;
            }
        }

        // Update both old and new stage counts
        updateStageCountBadge(oldStage);
        updateStageCountBadge(newStage);
    }

    /** Check if empty state should be shown */
    function checkEmptyState() {
        if (applications.length === 0) {
            for (var i = 0; i < STAGES.length; i++) {
                var sec = getStageSection(STAGES[i].key);
                if (sec) sec.hidden = true;
            }
            dom.emptyState.hidden = false;
        } else {
            dom.emptyState.hidden = true;
        }
    }

    // =========================================================================
    // CRUD OPERATIONS (with targeted DOM updates)
    // =========================================================================
    function addApplication(data) {
        var app = {
            id: generateId(),
            company: data.company.trim(),
            jobTitle: data.jobTitle.trim(),
            stage: data.stage,
            contactPerson: data.contactPerson.trim(),
            contactEmail: data.contactEmail.trim(),
            dateApplied: data.dateApplied,
            interviewDate: data.interviewDate,
            notes: data.notes.trim(),
        };
        applications.unshift(app);
        saveState();

        // Targeted update: only rebuild if filter/search is active
        if (currentFilter !== 'all' || currentSearch.trim()) {
            renderBoard();
        } else {
            dom.emptyState.hidden = true;
            insertCardIntoStage(app);
            updateStageCountBadge(app.stage);
        }
        renderStats();
        updateStageTabs();
    }

    function updateApplication(id, data) {
        var idx = -1;
        for (var i = 0; i < applications.length; i++) {
            if (applications[i].id === id) { idx = i; break; }
        }
        if (idx === -1) return;

        var oldStage = applications[idx].stage;
        var newStage = data.stage;

        applications[idx] = {
            ...applications[idx],
            company: data.company.trim(),
            jobTitle: data.jobTitle.trim(),
            stage: newStage,
            contactPerson: data.contactPerson.trim(),
            contactEmail: data.contactEmail.trim(),
            dateApplied: data.dateApplied,
            interviewDate: data.interviewDate,
            notes: data.notes.trim(),
        };
        saveState();

        // Targeted update
        if (currentFilter !== 'all' || currentSearch.trim()) {
            renderBoard();
        } else if (oldStage !== newStage) {
            moveCardInDOM(id, newStage);
            replaceCardInDOM(applications[idx]); // refresh card content
        } else {
            replaceCardInDOM(applications[idx]);
        }
        renderStats();
        updateStageTabs();
    }

    function deleteApplication(id) {
        // Find the app before removing to know its stage
        var deletedStage = null;
        for (var i = 0; i < applications.length; i++) {
            if (applications[i].id === id) { deletedStage = applications[i].stage; break; }
        }

        applications = applications.filter(function (app) { return app.id !== id; });
        saveState();

        // Targeted update
        if (currentFilter !== 'all' || currentSearch.trim()) {
            renderBoard();
        } else {
            removeCardFromDOM(id);
            if (deletedStage) updateStageCountBadge(deletedStage);
            checkEmptyState();
        }
        renderStats();
        updateStageTabs();
    }

    function changeStage(id, newStage) {
        var app = null;
        for (var i = 0; i < applications.length; i++) {
            if (applications[i].id === id) { app = applications[i]; break; }
        }
        if (!app) return;

        var oldStage = app.stage;
        app.stage = newStage;
        saveState();

        // Targeted update
        if (currentFilter !== 'all' || currentSearch.trim()) {
            renderBoard();
        } else {
            moveCardInDOM(id, newStage);
        }
        renderStats();
        updateStageTabs();
    }

    // =========================================================================
    // FORM VALIDATION
    // =========================================================================
    function clearErrors() {
        $$('.field-error').forEach(function (el) { el.textContent = ''; });
        $$('[aria-invalid]').forEach(function (el) { el.removeAttribute('aria-invalid'); });
    }

    function showError(fieldId, message) {
        var errorEl = document.getElementById('error-' + fieldId);
        var inputEl = document.getElementById(fieldId);
        if (errorEl) errorEl.textContent = message;
        if (inputEl) inputEl.setAttribute('aria-invalid', 'true');
    }

    function validateForm() {
        clearErrors();
        var isValid = true;

        var company = dom.company.value.trim();
        var jobTitle = dom.jobTitle.value.trim();
        var stage = dom.stage.value;
        var email = dom.contactEmail.value.trim();

        if (!company) {
            showError('company', 'Company name is required.');
            isValid = false;
        }
        if (!jobTitle) {
            showError('job-title', 'Job title is required.');
            isValid = false;
        }
        if (!stage) {
            showError('stage', 'Please select a stage.');
            isValid = false;
        }
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            showError('contact-email', 'Please enter a valid email address.');
            isValid = false;
        }

        return isValid;
    }

    // =========================================================================
    // DIALOG MANAGEMENT
    // =========================================================================
    function openAddDialog() {
        editingId = null;
        dom.dialogTitle.textContent = 'Add Application';
        dom.btnSubmit.textContent = 'Save Application';
        dom.appForm.reset();
        dom.appId.value = '';
        clearErrors();
        dom.appDialog.showModal();
        setTimeout(function () { dom.company.focus(); }, 100);
    }

    function openEditDialog(id) {
        var app = null;
        for (var i = 0; i < applications.length; i++) {
            if (applications[i].id === id) { app = applications[i]; break; }
        }
        if (!app) return;

        editingId = id;
        dom.dialogTitle.textContent = 'Edit Application';
        dom.btnSubmit.textContent = 'Update Application';
        clearErrors();

        dom.appId.value = app.id;
        dom.company.value = app.company;
        dom.jobTitle.value = app.jobTitle;
        dom.stage.value = app.stage;
        dom.contactPerson.value = app.contactPerson || '';
        dom.contactEmail.value = app.contactEmail || '';
        dom.dateApplied.value = app.dateApplied || '';
        dom.interviewDate.value = app.interviewDate || '';
        dom.notes.value = app.notes || '';

        dom.appDialog.showModal();
        setTimeout(function () { dom.company.focus(); }, 100);
    }

    function closeDialog() {
        dom.appDialog.close();
        editingId = null;
        clearErrors();
    }

    function openConfirmDelete(id) {
        deleteTargetId = id;
        dom.confirmDialog.showModal();
        setTimeout(function () { dom.btnConfirmCancel.focus(); }, 100);
    }

    function closeConfirmDialog() {
        dom.confirmDialog.close();
        deleteTargetId = null;
    }

    function handleFormSubmit(e) {
        e.preventDefault();
        if (!validateForm()) return;

        var data = {
            company: dom.company.value,
            jobTitle: dom.jobTitle.value,
            stage: dom.stage.value,
            contactPerson: dom.contactPerson.value,
            contactEmail: dom.contactEmail.value,
            dateApplied: dom.dateApplied.value,
            interviewDate: dom.interviewDate.value,
            notes: dom.notes.value,
        };

        if (editingId) {
            updateApplication(editingId, data);
        } else {
            addApplication(data);
        }

        closeDialog();
    }

    // =========================================================================
    // FILTERING & SEARCH
    // =========================================================================
    function handleFilterChange() {
        currentFilter = dom.filterStage.value;
        currentSearch = dom.filterSearch.value;
        renderBoard();
        renderStats();
    }

    function handleSearchInput() {
        currentSearch = dom.filterSearch.value;
        renderBoard();
    }

    function handleStageTabClick(e) {
        var tab = e.currentTarget;
        var stage = tab.dataset.stage;
        currentFilter = stage;
        dom.filterStage.value = stage;
        renderBoard();
        renderStats();
    }

    // =========================================================================
    // MOBILE MENU
    // =========================================================================
    function openMenu() {
        dom.mainNav.classList.add('is-open');
        dom.menuToggle.setAttribute('aria-expanded', 'true');
        dom.menuToggle.setAttribute('aria-label', 'Close navigation menu');
        var firstLink = dom.mainNav.querySelector('a');
        if (firstLink) setTimeout(function () { firstLink.focus(); }, 100);
    }

    function closeMenu() {
        dom.mainNav.classList.remove('is-open');
        dom.menuToggle.setAttribute('aria-expanded', 'false');
        dom.menuToggle.setAttribute('aria-label', 'Open navigation menu');
        dom.menuToggle.focus();
    }

    function toggleMenu() {
        var isOpen = dom.menuToggle.getAttribute('aria-expanded') === 'true';
        if (isOpen) { closeMenu(); } else { openMenu(); }
    }

    // =========================================================================
    // EVENT LISTENERS
    // =========================================================================
    function bindEvents() {
        dom.menuToggle.addEventListener('click', toggleMenu);

        dom.mainNav.addEventListener('click', function (e) {
            if (e.target.tagName === 'A') closeMenu();
        });

        dom.btnOpenForm.addEventListener('click', openAddDialog);
        if (dom.btnEmptyAdd) dom.btnEmptyAdd.addEventListener('click', openAddDialog);

        dom.btnDialogClose.addEventListener('click', closeDialog);
        dom.btnCancel.addEventListener('click', closeDialog);

        dom.appDialog.addEventListener('click', function (e) {
            if (e.target === dom.appDialog) closeDialog();
        });

        dom.appForm.addEventListener('submit', handleFormSubmit);

        dom.btnConfirmCancel.addEventListener('click', closeConfirmDialog);
        dom.btnConfirmDelete.addEventListener('click', function () {
            if (deleteTargetId) deleteApplication(deleteTargetId);
            closeConfirmDialog();
        });
        dom.confirmDialog.addEventListener('click', function (e) {
            if (e.target === dom.confirmDialog) closeConfirmDialog();
        });

        dom.filterStage.addEventListener('change', handleFilterChange);
        dom.filterSearch.addEventListener('input', debounce(handleSearchInput, 150));

        dom.stageTabs.forEach(function (tab) {
            tab.addEventListener('click', handleStageTabClick);
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                if (dom.appDialog.open) {
                    closeDialog();
                } else if (dom.confirmDialog.open) {
                    closeConfirmDialog();
                } else if (dom.menuToggle.getAttribute('aria-expanded') === 'true') {
                    closeMenu();
                }
            }
        });

        if (dom.currentYear) {
            dom.currentYear.textContent = new Date().getFullYear();
        }
    }

    // =========================================================================
    // UTILITY: Debounce
    // =========================================================================
    function debounce(fn, delay) {
        var timer;
        return function () {
            var context = this;
            var args = arguments;
            clearTimeout(timer);
            timer = setTimeout(function () { fn.apply(context, args); }, delay);
        };
    }

    // =========================================================================
    // INIT — single render on page load
    // =========================================================================
    function init() {
        loadState();
        bindEvents();
        renderStats();
        renderBoard();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();