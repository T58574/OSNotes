// --- iOS Notes App Logic ---

document.addEventListener('DOMContentLoaded', () => {
    // === Хранилище Данных (State) ===
    let notes = [];
    let folders = [];
    let currentFolderId = 'all-notes'; // 'all-notes' или ID папки
    let currentNoteId = null;
    let isSidebarsCollapsed = false;
    let isCodeMode = false;

    // Дефолтные системные папки
    const SYSTEM_FOLDERS = {
        NOTES: 'notes-default'
    };

    // Настройки форматирования по умолчанию
    let currentFormatBlock = 'p';

    // === DOM Элементы ===
    const appContainer = document.getElementById('app');
    
    // Панели
    const foldersPanel = document.getElementById('foldersPanel');
    const notesPanel = document.getElementById('notesPanel');
    const editorPanel = document.getElementById('editorPanel');
    
    // Списки и списки-контейнеры
    const foldersList = document.getElementById('foldersList');
    const notesList = document.getElementById('notesList');
    const noNotesMessage = document.getElementById('noNotesMessage');
    const notesCountText = document.getElementById('notesCountText');
    
    // Поля ввода
    const foldersSearchInput = document.getElementById('foldersSearch');
    const notesSearchInput = document.getElementById('notesSearch');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    const cancelSearchBtn = document.getElementById('cancelSearchBtn');
    const editorBody = document.getElementById('editorBody');
    const editorMeta = document.getElementById('editorMeta');
    
    // Кнопки
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const newFolderBtn = document.getElementById('newFolderBtn');
    const newNoteBtn = document.getElementById('newNoteBtn');
    const deleteNoteBtn = document.getElementById('deleteNoteBtn');
    const shareBtn = document.getElementById('shareBtn');
    const formatBtn = document.getElementById('formatBtn');
    const checklistBtn = document.getElementById('checklistBtn');
    const toggleSidebarsBtn = document.getElementById('toggleSidebarsBtn');
    const doneBtn = document.getElementById('doneBtn');
    
    // Кнопки HTML-режима и запуска
    const codeModeBtn = document.getElementById('codeModeBtn');
    const runHtmlBtn = document.getElementById('runHtmlBtn');
    
    // Элементы импорта файлов
    const importHtmlInput = document.getElementById('importHtmlInput');
    const importHtmlBtn = document.getElementById('importHtmlBtn');

    // Окно просмотра HTML
    const htmlRunnerModal = document.getElementById('htmlRunnerModal');
    const closeHtmlRunnerBtn = document.getElementById('closeHtmlRunnerBtn');
    const refreshHtmlRunnerBtn = document.getElementById('refreshHtmlRunnerBtn');
    const htmlPreviewIframe = document.getElementById('htmlPreviewIframe');
    
    // Кнопки мобильной навигации
    const toFoldersBtn = document.getElementById('toFoldersBtn');
    const toNotesBtn = document.getElementById('toNotesBtn');
    const backToNotesText = document.getElementById('backToNotesText');
    const currentFolderTitle = document.getElementById('currentFolderTitle');

    // Модальные окна
    const folderModal = document.getElementById('folderModal');
    const folderNameInput = document.getElementById('folderNameInput');
    const cancelFolderModalBtn = document.getElementById('cancelFolderModalBtn');
    const saveFolderModalBtn = document.getElementById('saveFolderModalBtn');

    const shareModal = document.getElementById('shareModal');
    const shareCopyBtn = document.getElementById('shareCopyBtn');
    const shareDownloadBtn = document.getElementById('shareDownloadBtn');
    const cancelShareBtn = document.getElementById('cancelShareBtn');

    const deleteFolderModal = document.getElementById('deleteFolderModal');
    const cancelDelFolderBtn = document.getElementById('cancelDelFolderBtn');
    const confirmDelFolderBtn = document.getElementById('confirmDelFolderBtn');
    let folderToDeleteId = null;

    // Панель форматирования
    const formatPopup = document.getElementById('formatPopup');

    // === Инициализация ===
    function init() {
        // Установка стартовой темы (темная/светлая)
        initTheme();
        
        // Загрузка данных
        loadData();
        
        // Установка стартового экрана для мобильных устройств
        setMobileView('folders');
        
        // Рендер боковых меню
        renderFolders();
        renderNotesList();
        
        // Выбор первой заметки
        selectFirstNote();

        // Добавление слушателей событий
        setupEventListeners();
    }

    // === Тема оформления ===
    function initTheme() {
        const savedTheme = localStorage.getItem('ios-notes-theme');
        if (savedTheme === 'dark') {
            appContainer.classList.add('dark-theme');
            appContainer.classList.remove('light-theme');
            toggleThemeIcon(true);
        } else if (savedTheme === 'light') {
            appContainer.classList.add('light-theme');
            appContainer.classList.remove('dark-theme');
            toggleThemeIcon(false);
        } else {
            // Системная тема
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            if (prefersDark) {
                appContainer.classList.add('dark-theme');
                toggleThemeIcon(true);
            } else {
                appContainer.classList.add('light-theme');
                toggleThemeIcon(false);
            }
        }
    }

    function toggleThemeIcon(isDark) {
        const moonIcon = themeToggleBtn.querySelector('.moon-icon');
        const sunIcon = themeToggleBtn.querySelector('.sun-icon');
        if (isDark) {
            moonIcon.classList.add('hidden');
            sunIcon.classList.remove('hidden');
        } else {
            moonIcon.classList.remove('hidden');
            sunIcon.classList.add('hidden');
        }
    }

    // === Работа с Хранилищем (LocalStorage) ===
    function loadData() {
        const savedFolders = localStorage.getItem('ios-notes-folders');
        const savedNotes = localStorage.getItem('ios-notes-notes');

        if (savedFolders) {
            folders = JSON.parse(savedFolders);
        } else {
            // Стартовые папки
            folders = [
                { id: 'all-notes', name: 'Все iCloud', isSystem: true, count: 0 },
                { id: SYSTEM_FOLDERS.NOTES, name: 'Заметки', isSystem: true, count: 0 },
                { id: 'work', name: 'Работа', isSystem: false, count: 0 },
                { id: 'personal', name: 'Личные', isSystem: false, count: 0 }
            ];
            saveFolders();
        }

        if (savedNotes) {
            notes = JSON.parse(savedNotes);
        } else {
            // Демо-заметки для красоты первого запуска
            const now = Date.now();
            notes = [
                {
                    id: 'welcome-note',
                    title: 'Добро пожаловать в Заметки! 📝',
                    body: '<h1>Добро пожаловать в Заметки! 📝</h1><p>Это полноценный клон приложения Заметки на iOS, созданный с помощью HTML, CSS и чистого JavaScript.</p><h2>Что здесь можно делать?</h2><ul><li><b>Форматировать текст:</b> выделяйте текст жирным, курсивом, подчеркиванием или используйте заголовки.</li><li><b>Создавать списки дел:</b> нажмите круглую иконку в тулбаре для добавления чек-листа. Нажимайте на кружки, чтобы помечать задачи выполненными.</li><li><b>Организовывать по папкам:</b> создавайте свои папки в левой панели iCloud.</li><li><b>Быстрый поиск:</b> находите нужную заметку по тексту в реальном времени.</li></ul><p>Все ваши данные автоматически сохраняются в вашем браузере (LocalStorage).</p>',
                    folderId: SYSTEM_FOLDERS.NOTES,
                    updatedAt: now
                },
                {
                    id: 'checklist-demo',
                    title: 'Список покупок 🛒',
                    body: '<h1>Список покупок 🛒</h1><p>Список вещей, которые нужно купить к ужину:</p><div class="todo-item"><span class="todo-checkbox" contenteditable="false"></span><span class="todo-text" contenteditable="true">Свежие томаты и базилик 🍅</span></div><div class="todo-item checked"><span class="todo-checkbox" contenteditable="false"></span><span class="todo-text" contenteditable="true">Спагетти из твердых сортов 🍝</span></div><div class="todo-item"><span class="todo-checkbox" contenteditable="false"></span><span class="todo-text" contenteditable="true">Оливковое масло Extra Virgin 🍾</span></div><div class="todo-item"><span class="todo-checkbox" contenteditable="false"></span><span class="todo-text" contenteditable="true">Сыр Пармезан 🧀</span></div><p>Не забудь проверить скидки!</p>',
                    folderId: 'personal',
                    updatedAt: now - 3600000 // 1 час назад
                },
                {
                    id: 'work-ideas',
                    title: 'Идеи для проекта 💡',
                    body: '<h1>Идеи для проекта 💡</h1><p>Несколько мыслей по улучшению дизайна веб-приложения:</p><ol><li>Добавить стеклянную панель с размытием в шапке.</li><li>Реализовать плавное переключение между экранами на телефонах.</li><li>Добавить поддержку переключения темной темы.</li></ol><pre>const theme = "dark";\nconsole.log(`Текущая тема: ${theme}`);</pre>',
                    folderId: 'work',
                    updatedAt: now - 86400000 // Вчера
                }
            ];
            saveNotes();
        }
        
        updateFolderCounts();
    }

    function saveFolders() {
        localStorage.setItem('ios-notes-folders', JSON.stringify(folders));
    }

    function saveNotes() {
        localStorage.setItem('ios-notes-notes', JSON.stringify(notes));
        updateFolderCounts();
    }

    function updateFolderCounts() {
        // Подсчет количества заметок в каждой папке
        folders.forEach(folder => {
            if (folder.id === 'all-notes') {
                folder.count = notes.length;
            } else {
                folder.count = notes.filter(n => n.folderId === folder.id).length;
            }
        });
    }

    // === Рендеринг интерфейса ===

    // 1. Отрисовка списка папок
    function renderFolders() {
        foldersList.innerHTML = '';
        
        folders.forEach(folder => {
            // Пропускаем 'all-notes' в общем списке, мы выведем его отдельно или красиво сверху
            const li = document.createElement('li');
            li.className = `folder-item ${currentFolderId === folder.id ? 'active' : ''}`;
            li.dataset.id = folder.id;

            // Выбираем иконку: для дефолтных одна, для пользовательских другая
            const isAll = folder.id === 'all-notes';
            const isSystem = folder.isSystem;
            const iconSvg = isAll 
                ? `<svg class="icon" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10H7v-2h10v2z"/></svg>`
                : `<svg class="icon" viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>`;

            const deleteBtnHtml = (!isSystem && folder.id !== 'all-notes')
                ? `<button class="delete-folder-inline" data-id="${folder.id}" title="Удалить папку">
                    <svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:currentColor;"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                   </button>`
                : '';

            li.innerHTML = `
                <div class="folder-item-left">
                    ${iconSvg}
                    <span class="folder-name">${folder.name}</span>
                </div>
                <div class="folder-item-right">
                    ${deleteBtnHtml}
                    <span class="folder-count">${folder.count}</span>
                    <svg class="folder-chevron" viewBox="0 0 24 24"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/></svg>
                </div>
            `;
            
            // Нажатие на папку
            li.addEventListener('click', (e) => {
                // Если кликнули по кнопке удаления папки внутри, не переключаем
                if (e.target.closest('.delete-folder-inline')) {
                    const id = e.target.closest('.delete-folder-inline').dataset.id;
                    openDeleteFolderModal(id);
                    return;
                }
                
                currentFolderId = folder.id;
                currentFolderTitle.textContent = folder.name;
                backToNotesText.textContent = folder.name;
                renderFolders();
                renderNotesList();
                
                // Переходим на экран заметок на мобильных
                setMobileView('notes');
            });

            foldersList.appendChild(li);
        });
    }

    // 2. Отрисовка списка заметок (Средняя колонка)
    function renderNotesList(searchQuery = '') {
        notesList.innerHTML = '';
        
        // Фильтрация по папке
        let filteredNotes = notes;
        if (currentFolderId !== 'all-notes') {
            filteredNotes = notes.filter(note => note.folderId === currentFolderId);
        }

        // Фильтрация по поисковому запросу
        if (searchQuery.trim() !== '') {
            const query = searchQuery.toLowerCase();
            filteredNotes = filteredNotes.filter(note => 
                note.title.toLowerCase().includes(query) || 
                note.body.toLowerCase().includes(query)
            );
        }

        // Обновление счетчика заметок в футере
        notesCountText.textContent = getNotesCountWord(filteredNotes.length);

        if (filteredNotes.length === 0) {
            noNotesMessage.classList.remove('hidden');
            notesList.classList.add('hidden');
            
            // Если заметок нет, очищаем редактор (или показываем пустой экран)
            if (!currentNoteId || !notes.find(n => n.id === currentNoteId)) {
                clearEditor();
            }
            return;
        }

        noNotesMessage.classList.add('hidden');
        notesList.classList.remove('hidden');

        // Сортировка по дате обновления (новые сверху)
        filteredNotes.sort((a, b) => b.updatedAt - a.updatedAt);

        // Группировка по периодам времени (Сегодня, Вчера, Предыдущие 7 дней, Ранее)
        const groups = groupNotesByDate(filteredNotes);
        
        Object.keys(groups).forEach(groupName => {
            if (groups[groupName].length === 0) return;

            const groupDiv = document.createElement('div');
            groupDiv.className = 'notes-list-group';
            
            const groupTitle = document.createElement('div');
            groupTitle.className = 'notes-list-group-title';
            groupTitle.textContent = groupName;
            groupDiv.appendChild(groupTitle);

            const wrapper = document.createElement('div');
            wrapper.className = 'notes-list-items-wrapper';

            groups[groupName].forEach(note => {
                const noteItem = document.createElement('div');
                noteItem.className = `note-item ${currentNoteId === note.id ? 'active' : ''}`;
                noteItem.dataset.id = note.id;

                // Форматируем дату для превью
                const noteDateStr = formatNoteDateShort(note.updatedAt);
                
                // Получаем текстовое превью без HTML-тегов
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = note.body;
                
                // Убираем h1 (так как это заголовок) и берем текст дальше
                const h1 = tempDiv.querySelector('h1');
                if (h1) h1.remove();
                
                let snippet = tempDiv.innerText.trim();
                if (snippet === '') {
                    snippet = 'Нет дополнительного текста';
                }

                // Дополнительное имя папки, если мы в режиме "Все iCloud"
                const folderTag = currentFolderId === 'all-notes' 
                    ? `<span class="note-item-folder">${getFolderName(note.folderId)}</span>`
                    : '';

                noteItem.innerHTML = `
                    <div class="note-item-title">${note.title || 'Новая заметка'}</div>
                    <div class="note-item-meta">
                        <span class="note-item-date">${noteDateStr}</span>
                        <span class="note-item-snippet">${snippet}</span>
                    </div>
                    ${folderTag}
                `;

                noteItem.addEventListener('click', () => {
                    selectNote(note.id);
                });

                wrapper.appendChild(noteItem);
            });

            groupDiv.appendChild(wrapper);
            notesList.appendChild(groupDiv);
        });
    }

    // Вспомогательная функция для склонения слова "заметка"
    function getNotesCountWord(count) {
        if (count === 0) return 'Нет заметок';
        const lastDigit = count % 10;
        const lastTwoDigits = count % 100;
        
        if (lastDigit === 1 && lastTwoDigits !== 11) {
            return `${count} заметка`;
        }
        if ([2, 3, 4].includes(lastDigit) && ![12, 13, 14].includes(lastTwoDigits)) {
            return `${count} заметки`;
        }
        return `${count} заметок`;
    }

    // Получение имени папки по её ID
    function getFolderName(folderId) {
        const folder = folders.find(f => f.id === folderId);
        return folder ? folder.name : 'Заметки';
    }

    // Группировка заметок по дате изменения
    function groupNotesByDate(noteList) {
        const groups = {
            'Сегодня': [],
            'Вчера': [],
            'Предыдущие 7 дней': [],
            'Ранее': []
        };

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayMs = today.getTime();

        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayMs = yesterday.getTime();

        const oneWeekAgo = new Date(today);
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const oneWeekAgoMs = oneWeekAgo.getTime();

        noteList.forEach(note => {
            const time = note.updatedAt;
            if (time >= todayMs) {
                groups['Сегодня'].push(note);
            } else if (time >= yesterdayMs) {
                groups['Вчера'].push(note);
            } else if (time >= oneWeekAgoMs) {
                groups['Предыдущие 7 дней'].push(note);
            } else {
                groups['Ранее'].push(note);
            }
        });

        return groups;
    }

    // Форматирование даты для превью (например: "10:41", "Вчера", "05.06.26")
    function formatNoteDateShort(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const yesterday = today - 86400000;

        if (timestamp >= today) {
            // Сегодня -> выводим только время
            return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        } else if (timestamp >= yesterday) {
            return 'Вчера';
        } else if (date.getFullYear() === now.getFullYear()) {
            // В этом году -> выводим день и месяц словами (например "5 июня")
            return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '');
        } else {
            // Прошлые года -> цифрами
            return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
        }
    }

    // Полное форматирование даты для верхней части редактора
    function formatNoteDateFull(timestamp) {
        const date = new Date(timestamp);
        // Формат: "8 июня 2026 г., 09:41"
        const dateStr = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
        const timeStr = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        return `${dateStr} в ${timeStr}`;
    }

    // === Выбор Заметки и Загрузка в Редактор ===
    function selectNote(noteId) {
        currentNoteId = noteId;
        const note = notes.find(n => n.id === noteId);

        if (!note) {
            clearEditor();
            return;
        }

        // Подсвечиваем активную в списке
        const noteItems = notesList.querySelectorAll('.note-item');
        noteItems.forEach(item => {
            if (item.dataset.id === noteId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // Заполняем редактор
        setCodeMode(false); // Выключаем режим кода при смене заметки
        editorBody.innerHTML = note.body || '<h1>Новая заметка</h1><p><br></p>';
        editorMeta.textContent = formatNoteDateFull(note.updatedAt);
        
        // Показываем кнопку "Готово" при фокусе, а пока скрываем
        doneBtn.classList.add('hidden');

        // Переключаем мобильный экран на редактор
        setMobileView('editor');
    }

    function selectFirstNote() {
        let filteredNotes = notes;
        if (currentFolderId !== 'all-notes') {
            filteredNotes = notes.filter(n => n.folderId === currentFolderId);
        }

        if (filteredNotes.length > 0) {
            // Сортируем по дате, берем самую свежую
            filteredNotes.sort((a, b) => b.updatedAt - a.updatedAt);
            selectNote(filteredNotes[0].id);
        } else {
            clearEditor();
        }
    }

    function clearEditor() {
        currentNoteId = null;
        editorBody.innerHTML = '';
        editorMeta.textContent = 'Нет заметок';
        doneBtn.classList.add('hidden');
    }

    // Функция включения/выключения режима кода
    function setCodeMode(enabled) {
        isCodeMode = enabled;
        if (!currentNoteId) return;

        if (isCodeMode) {
            codeModeBtn.classList.add('active');
            editorBody.classList.add('code-mode-active');
            
            // Переключаем контент в отображение сырого HTML
            const note = notes.find(n => n.id === currentNoteId);
            if (note) {
                // innerText сохраняет переносы строк и теги как текст
                editorBody.innerText = note.body;
            }
            // Скрываем иконку форматирования и чек-листа в режиме кода, так как они не нужны
            formatBtn.classList.add('hidden');
            checklistBtn.classList.add('hidden');
        } else {
            codeModeBtn.classList.remove('active');
            editorBody.classList.remove('code-mode-active');
            
            // Рендерим сырой текст обратно в HTML
            const code = editorBody.innerText;
            editorBody.innerHTML = code;
            
            // Показываем кнопки форматирования
            formatBtn.classList.remove('hidden');
            checklistBtn.classList.remove('hidden');
        }
    }

    // === Управление экранами на мобильном (Сдвиги) ===
    function setMobileView(view) {
        appContainer.classList.remove('view-folders', 'view-notes', 'view-editor');
        if (view === 'folders') {
            appContainer.classList.add('view-folders');
        } else if (view === 'notes') {
            appContainer.classList.add('view-notes');
        } else if (view === 'editor') {
            appContainer.classList.add('view-editor');
        }
    }

    // === Действия с заметками (Создание, Изменение, Удаление) ===

    // 1. Создание
    function createNewNote() {
        const now = Date.now();
        // Определяем, в какую папку поместить заметку
        let folderId = currentFolderId;
        if (folderId === 'all-notes') {
            folderId = SYSTEM_FOLDERS.NOTES; // По умолчанию в системную «Заметки»
        }

        const newNote = {
            id: 'note_' + now + '_' + Math.random().toString(36).substr(2, 9),
            title: 'Новая заметка',
            body: '<h1>Новая заметка</h1><p><br></p>',
            folderId: folderId,
            updatedAt: now
        };

        notes.unshift(newNote);
        saveNotes();
        
        // Рендерим заново папки (обновить счетчик) и список
        renderFolders();
        renderNotesList();
        
        // Выбираем новую заметку
        selectNote(newNote.id);
        
        // Сразу фокусимся на редакторе
        editorBody.focus();
        // Ставим курсор в конец h1 или p
        placeCursorAtEnd(editorBody);
    }

    // Установка курсора в конец редактора
    function placeCursorAtEnd(el) {
        el.focus();
        if (typeof window.getSelection != "undefined"
            && typeof document.createRange != "undefined") {
            const range = document.createRange();
            range.selectNodeContents(el);
            range.collapse(false);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        }
    }

    // 2. Автосохранение при вводе
    let autoSaveTimeout = null;
    function triggerAutoSave() {
        if (!currentNoteId) return;

        // Показываем кнопку "Готово" в тулбаре
        doneBtn.classList.remove('hidden');

        // Считываем контент
        let htmlContent;
        if (isCodeMode) {
            htmlContent = editorBody.innerText;
        } else {
            htmlContent = editorBody.innerHTML;
        }
        
        // Получаем чистый текст для определения заголовка
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlContent;
        
        // Получаем все дочерние узлы
        let titleText = '';
        const firstNode = tempDiv.firstElementChild;
        
        if (firstNode && (firstNode.tagName === 'H1' || firstNode.tagName === 'H2' || firstNode.tagName === 'H3')) {
            titleText = firstNode.innerText.trim();
        } else {
            // Если нет заголовка в виде тега h1-h3, берем просто первую строчку текста
            const lines = tempDiv.innerText.split('\n').map(l => l.trim()).filter(l => l !== '');
            titleText = lines[0] || '';
        }

        if (titleText === '') {
            titleText = 'Новая заметка';
        }
        
        // Ограничиваем длину заголовка в превью списка
        if (titleText.length > 60) {
            titleText = titleText.substr(0, 57) + '...';
        }

        // Обновляем текущую заметку в памяти
        const noteIndex = notes.findIndex(n => n.id === currentNoteId);
        if (noteIndex !== -1) {
            notes[noteIndex].title = titleText;
            notes[noteIndex].body = htmlContent;
            notes[noteIndex].updatedAt = Date.now();
            
            // Обновляем дату в шапке редактора в реальном времени
            editorMeta.textContent = formatNoteDateFull(notes[noteIndex].updatedAt);
            
            // Быстро обновляем элемент в списке заметок (без полного рендеринга для лучшего UX)
            updateNoteItemDOM(notes[noteIndex]);
        }

        // Дебаунс сохранения в localStorage и перегруппировки списка заметок
        clearTimeout(autoSaveTimeout);
        autoSaveTimeout = setTimeout(() => {
            saveNotes();
            // Обновляем счетчики на папках
            renderFolders();
        }, 1500);
    }

    // Точечное обновление превью заметки в списке без пересоздания списка
    function updateNoteItemDOM(note) {
        const item = notesList.querySelector(`.note-item[data-id="${note.id}"]`);
        if (item) {
            const titleEl = item.querySelector('.note-item-title');
            const snippetEl = item.querySelector('.note-item-snippet');
            const dateEl = item.querySelector('.note-item-date');
            
            if (titleEl) titleEl.textContent = note.title;
            if (dateEl) dateEl.textContent = formatNoteDateShort(note.updatedAt);
            
            if (snippetEl) {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = note.body;
                const h1 = tempDiv.querySelector('h1');
                if (h1) h1.remove();
                let snippet = tempDiv.innerText.trim();
                snippet = snippet.replace(/\s+/g, ' ');
                snippetEl.textContent = snippet || 'Нет дополнительного текста';
            }
        }
    }

    // 3. Удаление заметки
    function deleteCurrentNote() {
        if (!currentNoteId) return;
        
        const index = notes.findIndex(n => n.id === currentNoteId);
        if (index !== -1) {
            notes.splice(index, 1);
            saveNotes();
            
            currentNoteId = null;
            
            renderFolders();
            renderNotesList();
            
            // Выбираем другую заметку
            selectFirstNote();
            
            // На мобильных при удалении возвращаемся к списку заметок
            if (window.innerWidth < 768) {
                setMobileView('notes');
            }
        }
    }

    // === Создание и удаление кастомных Папок ===

    // Открытие окна создания папки
    function openNewFolderModal() {
        folderModal.classList.remove('hidden');
        folderNameInput.value = '';
        folderNameInput.focus();
    }

    function closeNewFolderModal() {
        folderModal.classList.add('hidden');
    }

    function createNewFolder() {
        const name = folderNameInput.value.trim();
        if (name === '') return;

        const folderId = 'folder_' + Date.now();
        const newFolder = {
            id: folderId,
            name: name,
            isSystem: false,
            count: 0
        };

        folders.push(newFolder);
        saveFolders();
        
        renderFolders();
        closeNewFolderModal();

        // Сразу переключаемся на новую папку
        currentFolderId = folderId;
        currentFolderTitle.textContent = name;
        backToNotesText.textContent = name;
        renderFolders();
        renderNotesList();
        
        // Создаем в ней первую заметку
        createNewNote();
    }

    // Удаление кастомной папки
    function openDeleteFolderModal(id) {
        folderToDeleteId = id;
        deleteFolderModal.classList.remove('hidden');
    }

    function closeDeleteFolderModal() {
        deleteFolderModal.classList.add('hidden');
        folderToDeleteId = null;
    }

    function confirmDeleteFolder() {
        if (!folderToDeleteId) return;

        // Перемещаем заметки из удаляемой папки в системную «Заметки»
        notes.forEach(note => {
            if (note.folderId === folderToDeleteId) {
                note.folderId = SYSTEM_FOLDERS.NOTES;
            }
        });

        // Фильтруем папки
        folders = folders.filter(f => f.id !== folderToDeleteId);
        
        saveFolders();
        saveNotes();
        
        // Переключаемся на "Все заметки", если мы были в удаленной
        if (currentFolderId === folderToDeleteId) {
            currentFolderId = 'all-notes';
            currentFolderTitle.textContent = 'Все iCloud';
            backToNotesText.textContent = 'Папки';
        }
        
        renderFolders();
        renderNotesList();
        closeDeleteFolderModal();
    }

    // === Форматирование текста (Команды редактора) ===
    
    function formatText(command, value = null) {
        document.execCommand(command, false, value);
        editorBody.focus();
        triggerAutoSave();
    }

    // Специальная обработка чек-листов (Todo списки)
    function insertChecklist() {
        editorBody.focus();
        
        // Получаем выделение
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        
        // Создаем DOM-узел чек-листа
        const todoItem = document.createElement('div');
        todoItem.className = 'todo-item';
        // Отключаем contenteditable у самого чекбокса, чтобы пользователь не мог его стереть изнутри
        todoItem.innerHTML = `
            <span class="todo-checkbox" contenteditable="false"></span>
            <span class="todo-text" contenteditable="true">Задача</span>
        `;
        
        range.deleteContents();
        range.insertNode(todoItem);
        
        // Устанавливаем курсор на текст задачи
        const textNode = todoItem.querySelector('.todo-text');
        const newRange = document.createRange();
        newRange.selectNodeContents(textNode);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);
        
        triggerAutoSave();
    }

    // Переключение состояния чек-бокса при клике
    editorBody.addEventListener('click', (e) => {
        const checkbox = e.target.closest('.todo-checkbox');
        if (checkbox) {
            const todoItem = checkbox.closest('.todo-item');
            if (todoItem) {
                todoItem.classList.toggle('checked');
                triggerAutoSave();
            }
        }
    });

    // Обработка клавиши Enter внутри чек-листа
    editorBody.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const selection = window.getSelection();
            if (!selection.rangeCount) return;

            const anchorNode = selection.anchorNode;
            const todoText = anchorNode.parentElement ? anchorNode.parentElement.closest('.todo-text') : null;

            if (todoText) {
                // Предотвращаем стандартный перенос строки браузера
                e.preventDefault();
                
                const currentTodo = todoText.closest('.todo-item');
                
                // Создаем новый элемент чек-листа
                const newTodo = document.createElement('div');
                newTodo.className = 'todo-item';
                newTodo.innerHTML = `
                    <span class="todo-checkbox" contenteditable="false"></span>
                    <span class="todo-text" contenteditable="true">&nbsp;</span>
                `;

                // Вставляем после текущей задачи
                currentTodo.insertAdjacentElement('afterend', newTodo);

                // Ставим курсор в новую задачу
                const newTextEl = newTodo.querySelector('.todo-text');
                const range = document.createRange();
                range.selectNodeContents(newTextEl);
                range.collapse(true);
                selection.removeAllRanges();
                selection.addRange(range);
                
                newTextEl.focus();
                triggerAutoSave();
            }
        }
    });

    // === Функция "Поделиться" / Экспорт ===
    function openShareModal() {
        if (!currentNoteId) return;
        shareModal.classList.remove('hidden');
    }

    function closeShareModal() {
        shareModal.classList.add('hidden');
    }

    function copyNoteText() {
        const note = notes.find(n => n.id === currentNoteId);
        if (!note) return;

        // Создаем временный div для очистки HTML-тегов
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = note.body;
        const text = tempDiv.innerText;

        navigator.clipboard.writeText(text).then(() => {
            alert('Текст заметки скопирован в буфер обмена!');
            closeShareModal();
        }).catch(err => {
            console.error('Ошибка копирования:', err);
        });
    }

    function downloadNoteTxt() {
        const note = notes.find(n => n.id === currentNoteId);
        if (!note) return;

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = note.body;
        const text = tempDiv.innerText;

        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        // Создаем имя файла из заголовка
        const fileName = (note.title || 'заметка')
            .replace(/[\\/:*?"<>|]/g, '') // удаляем недопустимые символы
            .substring(0, 30) + '.txt';

        link.href = url;
        link.download = fileName;
        link.click();
        
        URL.revokeObjectURL(url);
        closeShareModal();
    }

    // Получение кода для запуска HTML в зависимости от режима и содержимого
    function getCodeToRun() {
        const text = editorBody.innerText;
        // Проверяем, есть ли в тексте HTML-теги или объявление DOCTYPE
        const hasHtmlTags = /<\/?[a-z][\s\S]*>/i.test(text) || text.toLowerCase().includes('<!doctype') || text.toLowerCase().includes('<html');
        
        if (isCodeMode || hasHtmlTags) {
            // Если включен режим кода или в тексте написаны теги вручную, запускаем как сырой текст
            return text;
        } else {
            // Если это обычная заметка, сгенерированная визуальным редактором, запускаем её HTML-структуру
            return editorBody.innerHTML;
        }
    }

    // === Слушатели событий ===
    function setupEventListeners() {
        // Кнопка смены темы
        themeToggleBtn.addEventListener('click', () => {
            const isDark = appContainer.classList.contains('dark-theme');
            if (isDark) {
                appContainer.classList.remove('dark-theme');
                appContainer.classList.add('light-theme');
                localStorage.setItem('ios-notes-theme', 'light');
                toggleThemeIcon(false);
            } else {
                appContainer.classList.remove('light-theme');
                appContainer.classList.add('dark-theme');
                localStorage.setItem('ios-notes-theme', 'dark');
                toggleThemeIcon(true);
            }
        });

        // Создание элементов
        newNoteBtn.addEventListener('click', createNewNote);
        newFolderBtn.addEventListener('click', openNewFolderModal);

        // События ввода в редакторе (для автосохранения)
        editorBody.addEventListener('input', triggerAutoSave);

        // Кнопка Готово (Done)
        doneBtn.addEventListener('click', () => {
            editorBody.blur();
            doneBtn.classList.add('hidden');
            // Принудительно сохраняем
            saveNotes();
            renderFolders();
            renderNotesList();
        });

        // Удаление заметки
        deleteNoteBtn.addEventListener('click', deleteCurrentNote);

        // Поделиться заметкой
        shareBtn.addEventListener('click', openShareModal);
        shareCopyBtn.addEventListener('click', copyNoteText);
        shareDownloadBtn.addEventListener('click', downloadNoteTxt);
        cancelShareBtn.addEventListener('click', closeShareModal);

        // Управление папками
        cancelFolderModalBtn.addEventListener('click', closeNewFolderModal);
        saveFolderModalBtn.addEventListener('click', createNewFolder);
        folderNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') createNewFolder();
        });

        cancelDelFolderBtn.addEventListener('click', closeDeleteFolderModal);
        confirmDelFolderBtn.addEventListener('click', confirmDeleteFolder);

        // Кнопки свернуть/развернуть боковые панели на десктопе
        toggleSidebarsBtn.addEventListener('click', () => {
            // Режим скрытия/показа
            const isFoldersHidden = appContainer.classList.contains('folders-hidden');
            const isNotesHidden = appContainer.classList.contains('notes-hidden');

            if (!isFoldersHidden && !isNotesHidden) {
                // Шаг 1: скрываем папки
                appContainer.classList.add('folders-hidden');
            } else if (isFoldersHidden && !isNotesHidden) {
                // Шаг 2: скрываем и список заметок тоже
                appContainer.classList.add('notes-hidden');
            } else {
                // Шаг 3: возвращаем всё
                appContainer.classList.remove('folders-hidden', 'notes-hidden');
            }
        });

        // Форматирование (Показ попапа)
        formatBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            formatPopup.classList.toggle('hidden');
            
            // Позиционируем попап над или под кнопкой форматирования
            const rect = formatBtn.getBoundingClientRect();
            formatPopup.style.right = (window.innerWidth - rect.right) + 'px';
            formatPopup.style.bottom = (window.innerHeight - rect.top + 8) + 'px';
        });

        // Скрытие попапа форматирования при клике в любом другом месте
        document.addEventListener('click', (e) => {
            if (!formatPopup.classList.contains('hidden') && !e.target.closest('#formatPopup') && !e.target.closest('#formatBtn')) {
                formatPopup.classList.add('hidden');
            }
        });

        // Клик по кнопкам внутри панели форматирования
        formatPopup.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;

            const command = btn.dataset.command;
            const value = btn.dataset.value;

            if (command === 'formatBlock') {
                formatText(command, value);
                
                // Переключаем активный класс
                formatPopup.querySelectorAll('.format-style-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            } else {
                formatText(command, value);
                btn.classList.toggle('active');
            }
        });

        // Чек-лист кнопка в тулбаре
        checklistBtn.addEventListener('click', insertChecklist);

        // Включение/выключение режима кода
        codeModeBtn.addEventListener('click', () => {
            if (!currentNoteId) return;
            setCodeMode(!isCodeMode);
        });

        // Запуск HTML в Iframe
        runHtmlBtn.addEventListener('click', () => {
            if (!currentNoteId) return;
            
            // Получаем код для запуска
            const code = getCodeToRun();
            
            // Устанавливаем в iframe
            htmlPreviewIframe.srcdoc = code;
            
            // Показываем модальное окно
            htmlRunnerModal.classList.remove('hidden');
        });

        // Закрытие просмотрщика
        closeHtmlRunnerBtn.addEventListener('click', () => {
            htmlRunnerModal.classList.add('hidden');
            htmlPreviewIframe.srcdoc = '';
        });

        // Обновление iframe в просмотрщике
        refreshHtmlRunnerBtn.addEventListener('click', () => {
            const code = getCodeToRun();
            htmlPreviewIframe.srcdoc = code;
        });

        // Импорт HTML файла
        importHtmlBtn.addEventListener('click', () => {
            importHtmlInput.click();
        });

        importHtmlInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function(evt) {
                const fileContent = evt.target.result;
                const fileName = file.name.replace(/\.[^/.]+$/, ""); // удаляем расширение

                const now = Date.now();
                let folderId = currentFolderId;
                if (folderId === 'all-notes') {
                    folderId = SYSTEM_FOLDERS.NOTES;
                }

                const newNote = {
                    id: 'note_' + now + '_' + Math.random().toString(36).substr(2, 9),
                    title: fileName,
                    body: fileContent,
                    folderId: folderId,
                    updatedAt: now
                };

                notes.unshift(newNote);
                saveNotes();
                
                renderFolders();
                renderNotesList();
                
                // Выбираем импортированную заметку
                selectNote(newNote.id);

                // Автоматически включаем режим кода, если файл содержит HTML теги
                if (fileContent.toLowerCase().includes('<html') || fileContent.toLowerCase().includes('<!doctype') || fileContent.toLowerCase().includes('</div>')) {
                    setCodeMode(true);
                }
            };
            reader.readAsText(file);
            
            // Сбрасываем значение инпута, чтобы можно было загружать тот же файл повторно
            e.target.value = '';
        });

        // --- Мобильная навигация ---
        toFoldersBtn.addEventListener('click', () => {
            // Возврат из списка заметок к папкам
            setMobileView('folders');
        });

        toNotesBtn.addEventListener('click', () => {
            // Возврат из редактора к списку заметок
            setMobileView('notes');
            // Синхронизируем и обновляем список
            saveNotes();
            renderFolders();
            renderNotesList();
        });

        // --- Поиск заметок ---
        notesSearchInput.addEventListener('input', (e) => {
            const query = e.target.value;
            if (query.length > 0) {
                clearSearchBtn.classList.remove('hidden');
                cancelSearchBtn.classList.remove('hidden');
            } else {
                clearSearchBtn.classList.add('hidden');
            }
            renderNotesList(query);
        });

        notesSearchInput.addEventListener('focus', () => {
            cancelSearchBtn.classList.remove('hidden');
        });

        cancelSearchBtn.addEventListener('click', () => {
            notesSearchInput.value = '';
            clearSearchBtn.classList.add('hidden');
            cancelSearchBtn.classList.add('hidden');
            notesSearchInput.blur();
            renderNotesList();
        });

        clearSearchBtn.addEventListener('click', () => {
            notesSearchInput.value = '';
            clearSearchBtn.classList.add('hidden');
            notesSearchInput.focus();
            renderNotesList();
        });
    }

    // Запуск приложения
    init();
});
