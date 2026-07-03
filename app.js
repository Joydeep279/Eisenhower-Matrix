/**
 * Eisenhower Matrix – App Logic
 * Features: CRUD tasks, drag-and-drop, local storage persistence, stats.
 */

(() => {
    'use strict';

    // ─── Constants ──────────────────────────────────────────
    const STORAGE_KEY = 'eisenhower-matrix-tasks';
    const QUADRANTS = ['do', 'schedule', 'delegate', 'eliminate'];

    // ─── State ──────────────────────────────────────────────
    let tasks = loadTasks();

    // ─── DOM References ─────────────────────────────────────
    const taskLists = {};
    const taskInputs = {};
    const taskCounts = {};
    const addButtons = {};

    QUADRANTS.forEach(q => {
        taskLists[q] = document.getElementById(`tasks-${q}`);
        taskInputs[q] = document.getElementById(`input-${q}`);
        taskCounts[q] = document.getElementById(`count-${q}`);
    });

    const statTotal = document.querySelector('#stat-total .stat-value');
    const statCompleted = document.querySelector('#stat-completed .stat-value');
    const btnClearAll = document.getElementById('btn-clear-all');
    const modalOverlay = document.getElementById('modal-overlay');
    const modalCancel = document.getElementById('modal-cancel');
    const modalConfirm = document.getElementById('modal-confirm');

    // ─── Initialise ─────────────────────────────────────────
    function init() {
        renderAll();
        bindEvents();
    }

    // ─── Persistence ────────────────────────────────────────
    function loadTasks() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : {};
        } catch {
            return {};
        }
    }

    function saveTasks() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    }

    // ─── Rendering ──────────────────────────────────────────
    function renderAll() {
        QUADRANTS.forEach(q => renderQuadrant(q));
        updateStats();
    }

    function renderQuadrant(quadrant) {
        const list = taskLists[quadrant];
        list.innerHTML = '';

        const items = tasks[quadrant] || [];
        items.forEach(task => {
            list.appendChild(createTaskElement(task, quadrant));
        });

        // Update count with bounce
        const count = taskCounts[quadrant];
        const newVal = items.filter(t => !t.completed).length;
        if (count.textContent !== String(newVal)) {
            count.textContent = newVal;
            count.classList.remove('count-bounce');
            void count.offsetWidth; // force reflow
            count.classList.add('count-bounce');
        }
    }

    function createTaskElement(task, quadrant) {
        const el = document.createElement('div');
        el.className = 'task-item' + (task.completed ? ' completed' : '');
        el.draggable = true;
        el.dataset.id = task.id;
        el.dataset.quadrant = quadrant;

        el.innerHTML = `
            <div class="task-drag-handle" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
                    <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
                    <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
                </svg>
            </div>
            <div class="task-checkbox ${task.completed ? 'checked' : ''}" role="checkbox" aria-checked="${task.completed}" tabindex="0"></div>
            <span class="task-text">${escapeHtml(task.text)}</span>
            <button class="task-delete" title="Delete task" aria-label="Delete task">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        `;

        // Checkbox toggle
        const checkbox = el.querySelector('.task-checkbox');
        checkbox.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleTask(task.id, quadrant);
        });
        checkbox.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleTask(task.id, quadrant);
            }
        });

        // Delete
        el.querySelector('.task-delete').addEventListener('click', (e) => {
            e.stopPropagation();
            removeTask(task.id, quadrant, el);
        });

        // Drag events
        el.addEventListener('dragstart', handleDragStart);
        el.addEventListener('dragend', handleDragEnd);

        return el;
    }

    function updateStats() {
        let total = 0;
        let completed = 0;
        QUADRANTS.forEach(q => {
            const items = tasks[q] || [];
            total += items.length;
            completed += items.filter(t => t.completed).length;
        });
        statTotal.textContent = total;
        statCompleted.textContent = completed;
    }

    // ─── Task CRUD ──────────────────────────────────────────
    function addTask(quadrant) {
        const input = taskInputs[quadrant];
        const text = input.value.trim();
        if (!text) {
            input.focus();
            input.style.borderColor = 'rgba(255, 77, 106, 0.5)';
            setTimeout(() => { input.style.borderColor = ''; }, 800);
            return;
        }

        if (!tasks[quadrant]) tasks[quadrant] = [];

        const task = {
            id: generateId(),
            text,
            completed: false,
            createdAt: Date.now()
        };

        tasks[quadrant].unshift(task);
        saveTasks();

        // Render just the new task at top
        const list = taskLists[quadrant];
        const el = createTaskElement(task, quadrant);
        // Remove empty state if present
        list.prepend(el);

        // Update count
        const count = taskCounts[quadrant];
        count.textContent = (tasks[quadrant] || []).filter(t => !t.completed).length;
        count.classList.remove('count-bounce');
        void count.offsetWidth;
        count.classList.add('count-bounce');

        updateStats();
        input.value = '';
        input.focus();
    }

    function toggleTask(id, quadrant) {
        const items = tasks[quadrant] || [];
        const task = items.find(t => t.id === id);
        if (!task) return;
        task.completed = !task.completed;
        saveTasks();
        renderQuadrant(quadrant);
        updateStats();
    }

    function removeTask(id, quadrant, element) {
        element.classList.add('removing');
        element.addEventListener('animationend', () => {
            tasks[quadrant] = (tasks[quadrant] || []).filter(t => t.id !== id);
            saveTasks();
            renderQuadrant(quadrant);
            updateStats();
        }, { once: true });
    }

    function moveTask(taskId, fromQuadrant, toQuadrant) {
        if (fromQuadrant === toQuadrant) return;

        const fromItems = tasks[fromQuadrant] || [];
        const idx = fromItems.findIndex(t => t.id === taskId);
        if (idx === -1) return;

        const [task] = fromItems.splice(idx, 1);
        if (!tasks[toQuadrant]) tasks[toQuadrant] = [];
        tasks[toQuadrant].unshift(task);

        saveTasks();
        renderQuadrant(fromQuadrant);
        renderQuadrant(toQuadrant);
        updateStats();
    }

    function clearAllTasks() {
        tasks = {};
        saveTasks();
        renderAll();
    }

    // ─── Drag & Drop ────────────────────────────────────────
    let draggedTask = null;

    function handleDragStart(e) {
        draggedTask = {
            id: this.dataset.id,
            quadrant: this.dataset.quadrant
        };
        this.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', this.dataset.id);

        // Set a slightly transparent drag image
        if (e.dataTransfer.setDragImage) {
            const rect = this.getBoundingClientRect();
            e.dataTransfer.setDragImage(this, rect.width / 2, rect.height / 2);
        }
    }

    function handleDragEnd() {
        this.classList.remove('dragging');
        draggedTask = null;
        // Clean up all drag-over states
        document.querySelectorAll('.quadrant.drag-over').forEach(el => {
            el.classList.remove('drag-over');
        });
    }

    function setupDropZones() {
        QUADRANTS.forEach(q => {
            const quadrant = document.getElementById(`quadrant-${q}`);

            quadrant.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                quadrant.classList.add('drag-over');
            });

            quadrant.addEventListener('dragleave', (e) => {
                // Only remove if we're actually leaving the quadrant
                if (!quadrant.contains(e.relatedTarget)) {
                    quadrant.classList.remove('drag-over');
                }
            });

            quadrant.addEventListener('drop', (e) => {
                e.preventDefault();
                quadrant.classList.remove('drag-over');
                if (draggedTask) {
                    moveTask(draggedTask.id, draggedTask.quadrant, q);
                }
            });
        });
    }

    // ─── Event Binding ──────────────────────────────────────
    function bindEvents() {
        // Add task buttons & enter key
        QUADRANTS.forEach(q => {
            const btn = document.querySelector(`.quadrant-${q} .btn-add`);
            btn.addEventListener('click', () => addTask(q));
            taskInputs[q].addEventListener('keydown', (e) => {
                if (e.key === 'Enter') addTask(q);
            });
        });

        // Clear all
        btnClearAll.addEventListener('click', () => {
            modalOverlay.classList.add('visible');
        });

        modalCancel.addEventListener('click', () => {
            modalOverlay.classList.remove('visible');
        });

        modalConfirm.addEventListener('click', () => {
            clearAllTasks();
            modalOverlay.classList.remove('visible');
        });

        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                modalOverlay.classList.remove('visible');
            }
        });

        // Escape closes modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modalOverlay.classList.contains('visible')) {
                modalOverlay.classList.remove('visible');
            }
        });

        // Drag and drop
        setupDropZones();
    }

    // ─── Helpers ────────────────────────────────────────────
    function generateId() {
        return `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ─── Boot ───────────────────────────────────────────────
    init();
})();
