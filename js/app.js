/**
 * HireTrail — Job Application Tracker
 * Vanilla JS: state management, CRUD, localStorage, filtering, validation
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
    // PERSISTENCE
    // =========================================================================
    function loadState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
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
        const d = new Date(isoString + 'T00:00:00');
        return d.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    }

    function getFilteredApplications() {
        let filtered = [...applications];

        if (currentFilter !== 'all') {
            filtered = filtered.filter((app) => app.stage === currentFilter);
        }

        if (currentSearch.trim()) {
            const q = currentSearch.trim().toLowerCase();
            filtered = filtered.filter((app) =>
                app.company.toLowerCase().includes(q)
            );
        }

        return filtered;
    }

    function getStageCount(stageKey) {
        return applications.filter((app) => app.stage === stageKey).length;
    }

    // =========================================================================
    // RENDER
    // =========================================================================
    function renderStats() {
        const total = applications.length;
        let html = '';

        html += `<div class="stat-card">
      <span class="stat-value">${total}</span>
      <span class="stat-label">Total</span>
    </div>`;

        STAGES.forEach((s) => {
            const count = getStageCount(s.key);
            html += `<div class="stat-card">
        <span class="stat-value">${count}</span>
        <span class="stat-label">${s.label}</span>
      </div>`;
        });

        dom.statsGrid.innerHTML = html;
    }

    function renderBoard() {
        const filtered = getFilteredApplications();

        if (applications.length === 0) {
            dom.boardSections.innerHTML = '';
            dom.emptyState.hidden = false;
            dom.stageTabs.forEach((t) => {
                t.classList.remove('active');
                t.setAttribute('aria-selected', 'false');
            });
            const allTab = document.querySelector('.stage-tab[data-stage="all"]');
            if (allTab) {
                allTab.classList.add('active');
                allTab.setAttribute('aria-selected', 'true');
            }
            return;
        }

        dom.emptyState.hidden = true;

        // Determine which stages to show
        const stagesToShow =
            currentFilter === 'all'
                ? STAGES
                : STAGES.filter((s) => s.key === currentFilter);

        let html = '';

        stagesToShow.forEach((stage) => {
            const stageApps = filtered.filter((app) => app.stage === stage.key);

            html += `<section class="stage-section" aria-labelledby="stage-${stage.key}">
        <div class="stage-section-header">
          <h3 class="stage-section-title" id="stage-${stage.key}">${stage.label}</h3>
          <span class="stage-section-count">${stageApps.length}</span>
        </div>
        <div class="stage-cards">`;

            if (stageApps.length === 0) {
                html += `</div></section>`;
                return;
            }

            stageApps.forEach((app) => {
                html += renderCard(app);
            });

            html += `</div></section>`;
        });

        dom.boardSections.innerHTML = html;

        // Attach event listeners to card controls
        attachCardEvents();
    }

    function renderCard(app) {
        const stageOptions = STAGES.map(
            (s) =>
                `<option value="${s.key}" ${app.stage === s.key ? 'selected' : ''
                }>${s.label}</option>`
        ).join('');

        const contactMeta = [];
        if (app.contactPerson) {
            contactMeta.push(
                `<div><dt>Contact</dt> <dd>${escapeHTML(app.contactPerson)}</dd></div>`
            );
        }
        if (app.contactEmail) {
            contactMeta.push(
                `<div><dt>Email</dt> <dd><a href="mailto:${escapeHTML(app.contactEmail)}">${escapeHTML(app.contactEmail)}</a></dd></div>`
            );
        }
        if (app.dateApplied) {
            contactMeta.push(
                `<div><dt>Applied</dt> <dd>${formatDate(app.dateApplied)}</dd></div>`
            );
        }
        if (app.interviewDate) {
            contactMeta.push(
                `<div><dt>Interview</dt> <dd>${formatDate(app.interviewDate)}</dd></div>`
            );
        }

        return `
    <article class="app-card" data-stage="${escapeHTML(app.stage)}" data-id="${app.id}">
      <div class="app-card-header">
        <div>
          <h4 class="app-card-company">${escapeHTML(app.company)}</h4>
          <p class="app-card-job">${escapeHTML(app.jobTitle)}</p>
        </div>
      </div>
      ${contactMeta.length
                ? `<dl class="app-card-meta">${contactMeta.join('')}</dl>`
                : ''
            }
      <select class="app-card-stage-select" data-action="change-stage" data-id="${app.id}" aria-label="Change stage for ${escapeHTML(app.company)}">
        ${stageOptions}
      </select>
      <div class="app-card-actions">
        <button class="btn btn-sm btn-secondary" data-action="edit" data-id="${app.id}" aria-label="Edit ${escapeHTML(app.company)}">
          Edit
        </button>
        <button class="btn btn-sm btn-danger" data-action="delete" data-id="${app.id}" aria-label="Delete ${escapeHTML(app.company)}">
          Delete
        </button>
      </div>
      ${app.notes
                ? `<p class="app-card-notes">${escapeHTML(app.notes)}</p>`
                : ''
            }
    </article>`;
    }

    function escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function attachCardEvents() {
        // Stage change selects
        $$('.app-card-stage-select').forEach((sel) => {
            sel.addEventListener('change', function () {
                const id = this.dataset.id;
                const newStage = this.value;
                changeStage(id, newStage);
            });
        });

        // Edit buttons
        $$('[data-action="edit"]').forEach((btn) => {
            btn.addEventListener('click', function () {
                const id = this.dataset.id;
                openEditDialog(id);
            });
        });

        // Delete buttons
        $$('[data-action="delete"]').forEach((btn) => {
            btn.addEventListener('click', function () {
                const id = this.dataset.id;
                openConfirmDelete(id);
            });
        });
    }

    function renderAll() {
        renderStats();
        renderBoard();
        updateStageTabs();
    }

    function updateStageTabs() {
        dom.stageTabs.forEach((tab) => {
            const stage = tab.dataset.stage;
            const isActive =
                stage === currentFilter ||
                (stage === 'all' && currentFilter === 'all');
            tab.classList.toggle('active', isActive);
            tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });
    }

    // =========================================================================
    // CRUD OPERATIONS
    // =========================================================================
    function addApplication(data) {
        const app = {
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
        renderAll();
    }

    function updateApplication(id, data) {
        const idx = applications.findIndex((app) => app.id === id);
        if (idx === -1) return;

        applications[idx] = {
            ...applications[idx],
            company: data.company.trim(),
            jobTitle: data.jobTitle.trim(),
            stage: data.stage,
            contactPerson: data.contactPerson.trim(),
            contactEmail: data.contactEmail.trim(),
            dateApplied: data.dateApplied,
            interviewDate: data.interviewDate,
            notes: data.notes.trim(),
        };
        saveState();
        renderAll();
    }

    function deleteApplication(id) {
        applications = applications.filter((app) => app.id !== id);
        saveState();
        renderAll();
    }

    function changeStage(id, newStage) {
        const app = applications.find((app) => app.id === id);
        if (!app) return;
        app.stage = newStage;
        saveState();
        renderAll();
    }

    // =========================================================================
    // FORM VALIDATION
    // =========================================================================
    function clearErrors() {
        $$('.field-error').forEach((el) => (el.textContent = ''));
        $$('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
    }

    function showError(fieldId, message) {
        const errorEl = document.getElementById('error-' + fieldId);
        const inputEl = document.getElementById(fieldId);
        if (errorEl) errorEl.textContent = message;
        if (inputEl) inputEl.setAttribute('aria-invalid', 'true');
    }

    function validateForm() {
        clearErrors();
        let isValid = true;

        const company = dom.company.value.trim();
        const jobTitle = dom.jobTitle.value.trim();
        const stage = dom.stage.value;
        const email = dom.contactEmail.value.trim();

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
        // Focus first input
        setTimeout(() => dom.company.focus(), 100);
    }

    function openEditDialog(id) {
        const app = applications.find((a) => a.id === id);
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
        setTimeout(() => dom.company.focus(), 100);
    }

    function closeDialog() {
        dom.appDialog.close();
        editingId = null;
        clearErrors();
    }

    function openConfirmDelete(id) {
        deleteTargetId = id;
        dom.confirmDialog.showModal();
        setTimeout(() => dom.btnConfirmCancel.focus(), 100);
    }

    function closeConfirmDialog() {
        dom.confirmDialog.close();
        deleteTargetId = null;
    }

    function handleFormSubmit(e) {
        e.preventDefault();

        if (!validateForm()) return;

        const data = {
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
        updateStageTabs();
        renderBoard();
    }

    function handleSearchInput() {
        currentSearch = dom.filterSearch.value;
        renderBoard();
    }

    function handleStageTabClick(e) {
        const tab = e.currentTarget;
        const stage = tab.dataset.stage;

        currentFilter = stage;
        dom.filterStage.value = stage;
        updateStageTabs();
        renderBoard();
    }

    // =========================================================================
    // MOBILE MENU
    // =========================================================================
    function openMenu() {
        dom.mainNav.classList.add('is-open');
        dom.menuToggle.setAttribute('aria-expanded', 'true');
        dom.menuToggle.setAttribute('aria-label', 'Close navigation menu');
        // Focus first nav link
        const firstLink = dom.mainNav.querySelector('a');
        if (firstLink) setTimeout(() => firstLink.focus(), 100);
    }

    function closeMenu() {
        dom.mainNav.classList.remove('is-open');
        dom.menuToggle.setAttribute('aria-expanded', 'false');
        dom.menuToggle.setAttribute('aria-label', 'Open navigation menu');
        dom.menuToggle.focus();
    }

    function toggleMenu() {
        const isOpen = dom.menuToggle.getAttribute('aria-expanded') === 'true';
        if (isOpen) {
            closeMenu();
        } else {
            openMenu();
        }
    }

    // =========================================================================
    // EVENT LISTENERS
    // =========================================================================
    function bindEvents() {
        // Mobile menu
        dom.menuToggle.addEventListener('click', toggleMenu);

        // Close menu on nav link click (mobile)
        dom.mainNav.addEventListener('click', (e) => {
            if (e.target.tagName === 'A') {
                closeMenu();
            }
        });

        // Open add dialog
        dom.btnOpenForm.addEventListener('click', openAddDialog);
        dom.btnEmptyAdd?.addEventListener('click', openAddDialog);

        // Dialog close
        dom.btnDialogClose.addEventListener('click', closeDialog);
        dom.btnCancel.addEventListener('click', closeDialog);

        // Close dialog on backdrop click
        dom.appDialog.addEventListener('click', (e) => {
            if (e.target === dom.appDialog) closeDialog();
        });

        // Form submit
        dom.appForm.addEventListener('submit', handleFormSubmit);

        // Confirm delete
        dom.btnConfirmCancel.addEventListener('click', closeConfirmDialog);
        dom.btnConfirmDelete.addEventListener('click', () => {
            if (deleteTargetId) {
                deleteApplication(deleteTargetId);
            }
            closeConfirmDialog();
        });
        dom.confirmDialog.addEventListener('click', (e) => {
            if (e.target === dom.confirmDialog) closeConfirmDialog();
        });

        // Filter & search
        dom.filterStage.addEventListener('change', handleFilterChange);
        dom.filterSearch.addEventListener('input', debounce(handleSearchInput, 250));

        // Stage tabs
        dom.stageTabs.forEach((tab) => {
            tab.addEventListener('click', handleStageTabClick);
        });

        // Keyboard: Escape closes menus/dialogs
        document.addEventListener('keydown', (e) => {
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

        // Footer year
        if (dom.currentYear) {
            dom.currentYear.textContent = new Date().getFullYear();
        }
    }

    // =========================================================================
    // UTILITY: Debounce
    // =========================================================================
    function debounce(fn, delay) {
        let timer;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    }

    // =========================================================================
    // INIT
    // =========================================================================
    function init() {
        loadState();
        bindEvents();
        renderAll();
    }

    // Run on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();