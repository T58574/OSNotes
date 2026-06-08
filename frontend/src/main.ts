import './style.css';
import './app.css';

import {
	Unlock,
	IsLocked,
	GetFolders,
	CreateFolder,
	DeleteFolder,
	GetNotes,
	GetNoteContent,
	SaveNote,
	DeleteNote,
	GetSyncConfig,
	SaveSyncConfig,
	Sync
} from '../wailsjs/go/main/App';

interface Folder {
	id: string;
	name: string;
	is_system: boolean;
	created_at: number;
	count?: number;
}

interface NoteMetadata {
	id: string;
	folder_id: string;
	title: string;
	tags: string[];
	created_at: number;
	updated_at: number;
	is_deleted: boolean;
}

document.addEventListener('DOMContentLoaded', () => {
	let notes: NoteMetadata[] = [];
	let folders: Folder[] = [];
	let currentFolderId = 'all-notes';
	let currentNoteId: string | null = null;
	let isCodeMode = false;
	let autoSaveTimeout: number | null = null;
	let folderToDeleteId: string | null = null;

	const appContainer = document.getElementById('app') as HTMLElement;
	const foldersList = document.getElementById('foldersList') as HTMLElement;
	const notesList = document.getElementById('notesList') as HTMLElement;
	const noNotesMessage = document.getElementById('noNotesMessage') as HTMLElement;
	const notesCountText = document.getElementById('notesCountText') as HTMLElement;

	const foldersSearchInput = document.getElementById('foldersSearch') as HTMLInputElement;
	const notesSearchInput = document.getElementById('notesSearch') as HTMLInputElement;
	const clearSearchBtn = document.getElementById('clearSearchBtn') as HTMLElement;
	const cancelSearchBtn = document.getElementById('cancelSearchBtn') as HTMLElement;
	const editorBody = document.getElementById('editorBody') as HTMLElement;
	const editorMeta = document.getElementById('editorMeta') as HTMLElement;

	const themeToggleBtn = document.getElementById('themeToggleBtn') as HTMLElement;
	const newFolderBtn = document.getElementById('newFolderBtn') as HTMLElement;
	const newNoteBtn = document.getElementById('newNoteBtn') as HTMLElement;
	const deleteNoteBtn = document.getElementById('deleteNoteBtn') as HTMLElement;
	const shareBtn = document.getElementById('shareBtn') as HTMLElement;
	const formatBtn = document.getElementById('formatBtn') as HTMLElement;
	const checklistBtn = document.getElementById('checklistBtn') as HTMLElement;
	const toggleSidebarsBtn = document.getElementById('toggleSidebarsBtn') as HTMLElement;
	const doneBtn = document.getElementById('doneBtn') as HTMLElement;

	const codeModeBtn = document.getElementById('codeModeBtn') as HTMLElement;
	const runHtmlBtn = document.getElementById('runHtmlBtn') as HTMLElement;

	const htmlRunnerModal = document.getElementById('htmlRunnerModal') as HTMLElement;
	const closeHtmlRunnerBtn = document.getElementById('closeHtmlRunnerBtn') as HTMLElement;
	const refreshHtmlRunnerBtn = document.getElementById('refreshHtmlRunnerBtn') as HTMLElement;
	const htmlPreviewIframe = document.getElementById('htmlPreviewIframe') as HTMLIFrameElement;

	const toFoldersBtn = document.getElementById('toFoldersBtn') as HTMLElement;
	const toNotesBtn = document.getElementById('toNotesBtn') as HTMLElement;
	const backToNotesText = document.getElementById('backToNotesText') as HTMLElement;
	const currentFolderTitle = document.getElementById('currentFolderTitle') as HTMLElement;

	const folderModal = document.getElementById('folderModal') as HTMLElement;
	const folderNameInput = document.getElementById('folderNameInput') as HTMLInputElement;
	const cancelFolderModalBtn = document.getElementById('cancelFolderModalBtn') as HTMLElement;
	const saveFolderModalBtn = document.getElementById('saveFolderModalBtn') as HTMLElement;

	const shareModal = document.getElementById('shareModal') as HTMLElement;
	const shareCopyBtn = document.getElementById('shareCopyBtn') as HTMLElement;
	const shareDownloadBtn = document.getElementById('shareDownloadBtn') as HTMLElement;
	const cancelShareBtn = document.getElementById('cancelShareBtn') as HTMLElement;

	const deleteFolderModal = document.getElementById('deleteFolderModal') as HTMLElement;
	const cancelDelFolderBtn = document.getElementById('cancelDelFolderBtn') as HTMLElement;
	const confirmDelFolderBtn = document.getElementById('confirmDelFolderBtn') as HTMLElement;

	const formatPopup = document.getElementById('formatPopup') as HTMLElement;
	const syncBtn = document.getElementById('syncBtn') as HTMLElement;

	const passwordModal = document.getElementById('passwordModal') as HTMLElement;
	const masterPasswordInput = document.getElementById('masterPasswordInput') as HTMLInputElement;
	const unlockBtn = document.getElementById('unlockBtn') as HTMLElement;

	const syncModal = document.getElementById('syncModal') as HTMLElement;
	const openSyncSettingsBtn = document.getElementById('openSyncSettingsBtn') as HTMLElement;
	const closeSyncSettingsBtn = document.getElementById('closeSyncSettingsBtn') as HTMLElement;
	const saveSyncSettingsBtn = document.getElementById('saveSyncSettingsBtn') as HTMLElement;
	const syncRepoUrl = document.getElementById('syncRepoUrl') as HTMLInputElement;
	const syncUsername = document.getElementById('syncUsername') as HTMLInputElement;
	const syncEmail = document.getElementById('syncEmail') as HTMLInputElement;
	const syncToken = document.getElementById('syncToken') as HTMLInputElement;

	async function checkLockStatus() {
		try {
			const locked = await IsLocked();
			if (locked) {
				passwordModal.classList.remove('hidden');
				masterPasswordInput.focus();
			} else {
				passwordModal.classList.add('hidden');
				await loadData();
			}
		} catch (err) {
			console.error(err);
		}
	}

	unlockBtn.addEventListener('click', async () => {
		const password = masterPasswordInput.value;
		if (!password) return;
		try {
			const success = await Unlock(password);
			if (success) {
				passwordModal.classList.add('hidden');
				await loadData();
			} else {
				alert('Неверный пароль или ошибка дешифрования');
			}
		} catch (err) {
			console.error(err);
			alert('Ошибка: ' + err);
		}
	});

	masterPasswordInput.addEventListener('keydown', (e) => {
		if (e.key === 'Enter') {
			unlockBtn.click();
		}
	});

	async function loadData() {
		try {
			const rawFolders = await GetFolders();
			folders = rawFolders.map((f: any) => ({
				id: f.id,
				name: f.name,
				is_system: f.is_system,
				created_at: f.created_at
			}));

			const rawNotes = await GetNotes();
			notes = rawNotes.map((n: any) => ({
				id: n.id,
				folder_id: n.folder_id,
				title: n.title,
				tags: n.tags || [],
				created_at: n.created_at,
				updated_at: n.updated_at,
				is_deleted: n.is_deleted
			}));

			updateFolderCounts();
			renderFolders();
			renderNotesList();
			selectFirstNote();
		} catch (err) {
			console.error(err);
		}
	}

	function updateFolderCounts() {
		const counts: Record<string, number> = {};
		notes.forEach(note => {
			counts[note.folder_id] = (counts[note.folder_id] || 0) + 1;
		});

		folders.forEach(folder => {
			if (folder.id === 'all-notes') {
				folder.count = notes.length;
			} else {
				folder.count = counts[folder.id] || 0;
			}
		});
	}

	function renderFolders() {
		foldersList.innerHTML = '';

		const allNotesFolder: Folder = {
			id: 'all-notes',
			name: 'Все iCloud',
			is_system: true,
			created_at: 0,
			count: notes.length
		};

		const renderItem = (folder: Folder) => {
			const li = document.createElement('li');
			li.className = `folder-item ${currentFolderId === folder.id ? 'active' : ''}`;
			li.dataset.id = folder.id;

			const isAll = folder.id === 'all-notes';
			const iconSvg = isAll
				? `<svg class="icon" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10H7v-2h10v2z"/></svg>`
				: `<svg class="icon" viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>`;

			const deleteBtnHtml = (!folder.is_system && folder.id !== 'all-notes')
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
					<span class="folder-count">${folder.count || 0}</span>
					<svg class="folder-chevron" viewBox="0 0 24 24"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/></svg>
				</div>
			`;

			li.addEventListener('click', (e) => {
				const target = e.target as HTMLElement;
				if (target.closest('.delete-folder-inline')) {
					const id = (target.closest('.delete-folder-inline') as HTMLElement).dataset.id;
					if (id) {
						folderToDeleteId = id;
						deleteFolderModal.classList.remove('hidden');
					}
					return;
				}

				currentFolderId = folder.id;
				currentFolderTitle.textContent = folder.name;
				backToNotesText.textContent = folder.name;
				renderFolders();
				renderNotesList();
				setMobileView('notes');
			});

			foldersList.appendChild(li);
		};

		renderItem(allNotesFolder);
		folders.forEach(f => {
			if (f.id !== 'all-notes') {
				renderItem(f);
			}
		});
	}

	function renderNotesList(searchQuery = '') {
		notesList.innerHTML = '';

		let filteredNotes = notes;
		if (currentFolderId !== 'all-notes') {
			filteredNotes = notes.filter(n => n.folder_id === currentFolderId);
		}

		if (searchQuery.trim() !== '') {
			const query = searchQuery.toLowerCase();
			filteredNotes = filteredNotes.filter(n =>
				n.title.toLowerCase().includes(query)
			);
		}

		notesCountText.textContent = getNotesCountWord(filteredNotes.length);

		if (filteredNotes.length === 0) {
			noNotesMessage.classList.remove('hidden');
			notesList.classList.add('hidden');
			if (!currentNoteId || !notes.find(n => n.id === currentNoteId)) {
				clearEditor();
			}
			return;
		}

		noNotesMessage.classList.add('hidden');
		notesList.classList.remove('hidden');

		filteredNotes.sort((a, b) => b.updated_at - a.updated_at);

		const groups = groupNotesByDate(filteredNotes);

		Object.keys(groups).forEach(groupName => {
			const groupNotes = groups[groupName as keyof typeof groups];
			if (groupNotes.length === 0) return;

			const groupDiv = document.createElement('div');
			groupDiv.className = 'notes-list-group';

			const groupTitle = document.createElement('div');
			groupTitle.className = 'notes-list-group-title';
			groupTitle.textContent = groupName;
			groupDiv.appendChild(groupTitle);

			const wrapper = document.createElement('div');
			wrapper.className = 'notes-list-items-wrapper';

			groupNotes.forEach(note => {
				const noteItem = document.createElement('div');
				noteItem.className = `note-item ${currentNoteId === note.id ? 'active' : ''}`;
				noteItem.dataset.id = note.id;

				const noteDateStr = formatNoteDateShort(note.updated_at);

				const folderTag = currentFolderId === 'all-notes'
					? `<span class="note-item-folder">${getFolderName(note.folder_id)}</span>`
					: '';

				noteItem.innerHTML = `
					<div class="note-item-title">${note.title || 'Новая заметка'}</div>
					<div class="note-item-meta">
						<span class="note-item-date">${noteDateStr}</span>
						<span class="note-item-snippet">Открыть для просмотра</span>
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

	function getNotesCountWord(count: number) {
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

	function getFolderName(folderId: string) {
		const folder = folders.find(f => f.id === folderId);
		return folder ? folder.name : 'Заметки';
	}

	function groupNotesByDate(noteList: NoteMetadata[]) {
		const groups = {
			'Сегодня': [] as NoteMetadata[],
			'Вчера': [] as NoteMetadata[],
			'Предыдущие 7 дней': [] as NoteMetadata[],
			'Ранее': [] as NoteMetadata[]
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
			const time = note.updated_at;
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

	function formatNoteDateShort(timestamp: number) {
		const date = new Date(timestamp);
		const now = new Date();

		const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
		const yesterday = today - 86400000;

		if (timestamp >= today) {
			return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
		} else if (timestamp >= yesterday) {
			return 'Вчера';
		} else if (date.getFullYear() === now.getFullYear()) {
			return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '');
		} else {
			return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
		}
	}

	function formatNoteDateFull(timestamp: number) {
		const date = new Date(timestamp);
		const dateStr = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
		const timeStr = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
		return `${dateStr} в ${timeStr}`;
	}

	async function selectNote(noteId: string) {
		currentNoteId = noteId;
		const note = notes.find(n => n.id === noteId);

		if (!note) {
			clearEditor();
			return;
		}

		const noteItems = notesList.querySelectorAll('.note-item');
		noteItems.forEach(item => {
			if ((item as HTMLElement).dataset.id === noteId) {
				item.classList.add('active');
			} else {
				item.classList.remove('active');
			}
		});

		try {
			const content = await GetNoteContent(noteId);
			setCodeMode(false);
			editorBody.innerHTML = content || '<h1>Новая заметка</h1><p><br></p>';
			editorMeta.textContent = formatNoteDateFull(note.updated_at);
			doneBtn.classList.add('hidden');
			setMobileView('editor');
		} catch (err) {
			console.error(err);
		}
	}

	function selectFirstNote() {
		let filteredNotes = notes;
		if (currentFolderId !== 'all-notes') {
			filteredNotes = notes.filter(n => n.folder_id === currentFolderId);
		}

		if (filteredNotes.length > 0) {
			filteredNotes.sort((a, b) => b.updated_at - a.updated_at);
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

	function setCodeMode(enabled: boolean) {
		isCodeMode = enabled;
		if (!currentNoteId) return;

		if (isCodeMode) {
			codeModeBtn.classList.add('active');
			editorBody.classList.add('code-mode-active');
			const note = notes.find(n => n.id === currentNoteId);
			if (note) {
				editorBody.innerText = editorBody.innerHTML;
			}
			formatBtn.classList.add('hidden');
			checklistBtn.classList.add('hidden');
		} else {
			codeModeBtn.classList.remove('active');
			editorBody.classList.remove('code-mode-active');
			const code = editorBody.innerText;
			editorBody.innerHTML = code;
			formatBtn.classList.remove('hidden');
			checklistBtn.classList.remove('hidden');
		}
	}

	function setMobileView(view: 'folders' | 'notes' | 'editor') {
		appContainer.classList.remove('view-folders', 'view-notes', 'view-editor');
		if (view === 'folders') {
			appContainer.classList.add('view-folders');
		} else if (view === 'notes') {
			appContainer.classList.add('view-notes');
		} else if (view === 'editor') {
			appContainer.classList.add('view-editor');
		}
	}

	toFoldersBtn.addEventListener('click', () => setMobileView('folders'));
	toNotesBtn.addEventListener('click', () => setMobileView('notes'));

	async function createNewNote() {
		const now = Date.now();
		let folderId = currentFolderId;
		if (folderId === 'all-notes') {
			folderId = 'notes-default';
		}

		const newId = 'note_' + now + '_' + Math.random().toString(36).substring(2, 9);
		const newNoteObj: NoteMetadata = {
			id: newId,
			title: 'Новая заметка',
			folder_id: folderId,
			tags: [],
			created_at: now,
			updated_at: now,
			is_deleted: false
		};

		try {
			await SaveNote(newId, folderId, 'Новая заметка', '<h1>Новая заметка</h1><p><br></p>');
			notes.unshift(newNoteObj);
			updateFolderCounts();
			renderFolders();
			renderNotesList();
			await selectNote(newId);
			editorBody.focus();
			placeCursorAtEnd(editorBody);
		} catch (err) {
			console.error(err);
		}
	}

	function placeCursorAtEnd(el: HTMLElement) {
		el.focus();
		if (typeof window.getSelection !== 'undefined' && typeof document.createRange !== 'undefined') {
			const range = document.createRange();
			range.selectNodeContents(el);
			range.collapse(false);
			const sel = window.getSelection();
			if (sel) {
				sel.removeAllRanges();
				sel.addRange(range);
			}
		}
	}

	function triggerAutoSave() {
		if (!currentNoteId) return;

		doneBtn.classList.remove('hidden');

		let htmlContent = isCodeMode ? editorBody.innerText : editorBody.innerHTML;

		const tempDiv = document.createElement('div');
		tempDiv.innerHTML = htmlContent;

		let titleText = '';
		const firstNode = tempDiv.firstElementChild;

		if (firstNode && ['H1', 'H2', 'H3'].includes(firstNode.tagName)) {
			titleText = (firstNode as HTMLElement).innerText.trim();
		} else {
			const lines = tempDiv.innerText.split('\n').map(l => l.trim()).filter(l => l !== '');
			titleText = lines[0] || '';
		}

		if (titleText === '') {
			titleText = 'Новая заметка';
		}

		if (titleText.length > 60) {
			titleText = titleText.substring(0, 57) + '...';
		}

		const note = notes.find(n => n.id === currentNoteId);
		if (note) {
			note.title = titleText;
			note.updated_at = Date.now();
			editorMeta.textContent = formatNoteDateFull(note.updated_at);
			updateNoteItemDOM(note);
		}

		if (autoSaveTimeout) {
			clearTimeout(autoSaveTimeout);
		}

		autoSaveTimeout = window.setTimeout(async () => {
			if (currentNoteId) {
				const folderId = note ? note.folder_id : 'notes-default';
				try {
					await SaveNote(currentNoteId, folderId, titleText, htmlContent);
					updateFolderCounts();
					renderFolders();
				} catch (err) {
					console.error(err);
				}
			}
		}, 1500);
	}

	function updateNoteItemDOM(note: NoteMetadata) {
		const item = notesList.querySelector(`.note-item[data-id="${note.id}"]`);
		if (item) {
			const titleEl = item.querySelector('.note-item-title');
			const dateEl = item.querySelector('.note-item-date');
			if (titleEl) titleEl.textContent = note.title;
			if (dateEl) dateEl.textContent = formatNoteDateShort(note.updated_at);
		}
	}

	async function forceSave() {
		if (!currentNoteId) return;
		if (autoSaveTimeout) {
			clearTimeout(autoSaveTimeout);
			autoSaveTimeout = null;
		}

		let htmlContent = isCodeMode ? editorBody.innerText : editorBody.innerHTML;
		const tempDiv = document.createElement('div');
		tempDiv.innerHTML = htmlContent;

		let titleText = '';
		const firstNode = tempDiv.firstElementChild;
		if (firstNode && ['H1', 'H2', 'H3'].includes(firstNode.tagName)) {
			titleText = (firstNode as HTMLElement).innerText.trim();
		} else {
			const lines = tempDiv.innerText.split('\n').map(l => l.trim()).filter(l => l !== '');
			titleText = lines[0] || '';
		}
		if (titleText === '') titleText = 'Новая заметка';

		const note = notes.find(n => n.id === currentNoteId);
		const folderId = note ? note.folder_id : 'notes-default';

		try {
			await SaveNote(currentNoteId, folderId, titleText, htmlContent);
			doneBtn.classList.add('hidden');
			await loadData();
		} catch (err) {
			console.error(err);
		}
	}

	async function deleteCurrentNote() {
		if (!currentNoteId) return;

		try {
			await DeleteNote(currentNoteId);
			notes = notes.filter(n => n.id !== currentNoteId);
			currentNoteId = null;
			updateFolderCounts();
			renderFolders();
			renderNotesList();
			selectFirstNote();
			if (window.innerWidth < 768) {
				setMobileView('notes');
			}
		} catch (err) {
			console.error(err);
		}
	}

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

	function initTheme() {
		const savedTheme = localStorage.getItem('ios-notes-theme');
		if (savedTheme === 'dark') {
			appContainer.classList.add('dark-theme');
			toggleThemeIcon(true);
		} else if (savedTheme === 'light') {
			appContainer.classList.add('light-theme');
			toggleThemeIcon(false);
		} else {
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

	function toggleThemeIcon(isDark: boolean) {
		const moonIcon = themeToggleBtn.querySelector('.moon-icon') as HTMLElement;
		const sunIcon = themeToggleBtn.querySelector('.sun-icon') as HTMLElement;
		if (isDark) {
			moonIcon.classList.add('hidden');
			sunIcon.classList.remove('hidden');
		} else {
			moonIcon.classList.remove('hidden');
			sunIcon.classList.add('hidden');
		}
	}

	newFolderBtn.addEventListener('click', () => {
		folderModal.classList.remove('hidden');
		folderNameInput.value = '';
		folderNameInput.focus();
	});

	cancelFolderModalBtn.addEventListener('click', () => {
		folderModal.classList.add('hidden');
	});

	saveFolderModalBtn.addEventListener('click', async () => {
		const name = folderNameInput.value.trim();
		if (!name) return;

		try {
			await CreateFolder(name);
			folderModal.classList.add('hidden');
			await loadData();
		} catch (err) {
			console.error(err);
		}
	});

	cancelDelFolderBtn.addEventListener('click', () => {
		deleteFolderModal.classList.add('hidden');
		folderToDeleteId = null;
	});

	confirmDelFolderBtn.addEventListener('click', async () => {
		if (!folderToDeleteId) return;

		try {
			await DeleteFolder(folderToDeleteId);
			deleteFolderModal.classList.add('hidden');
			folderToDeleteId = null;
			await loadData();
		} catch (err) {
			console.error(err);
		}
	});

	newNoteBtn.addEventListener('click', createNewNote);
	deleteNoteBtn.addEventListener('click', deleteCurrentNote);

	editorBody.addEventListener('input', triggerAutoSave);
	doneBtn.addEventListener('click', forceSave);

	codeModeBtn.addEventListener('click', () => {
		setCodeMode(!isCodeMode);
	});

	runHtmlBtn.addEventListener('click', () => {
		if (!currentNoteId) return;
		let htmlContent = isCodeMode ? editorBody.innerText : editorBody.innerHTML;
		htmlRunnerModal.classList.remove('hidden');
		htmlPreviewIframe.srcdoc = htmlContent;
	});

	closeHtmlRunnerBtn.addEventListener('click', () => {
		htmlRunnerModal.classList.add('hidden');
		htmlPreviewIframe.srcdoc = '';
	});

	refreshHtmlRunnerBtn.addEventListener('click', () => {
		let htmlContent = isCodeMode ? editorBody.innerText : editorBody.innerHTML;
		htmlPreviewIframe.srcdoc = htmlContent;
	});

	shareBtn.addEventListener('click', () => {
		if (!currentNoteId) return;
		shareModal.classList.remove('hidden');
	});

	cancelShareBtn.addEventListener('click', () => {
		shareModal.classList.add('hidden');
	});

	shareCopyBtn.addEventListener('click', () => {
		const text = editorBody.innerText;
		navigator.clipboard.writeText(text).then(() => {
			alert('Текст скопирован!');
			shareModal.classList.add('hidden');
		});
	});

	shareDownloadBtn.addEventListener('click', () => {
		const text = editorBody.innerText;
		const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = (notes.find(n => n.id === currentNoteId)?.title || 'note') + '.txt';
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
		shareModal.classList.add('hidden');
	});

	formatBtn.addEventListener('click', (e) => {
		e.stopPropagation();
		formatPopup.classList.toggle('hidden');
		if (!formatPopup.classList.contains('hidden')) {
			const rect = formatBtn.getBoundingClientRect();
			formatPopup.style.right = `${window.innerWidth - rect.right}px`;
			formatPopup.style.bottom = `${window.innerHeight - rect.top + 8}px`;
		}
	});

	document.addEventListener('click', (e) => {
		if (!formatPopup.classList.contains('hidden') && !formatPopup.contains(e.target as Node)) {
			formatPopup.classList.add('hidden');
		}
	});

	const formatStyleBtns = formatPopup.querySelectorAll('.format-style-btn');
	formatStyleBtns.forEach(btn => {
		btn.addEventListener('click', () => {
			const command = (btn as HTMLElement).dataset.command;
			const value = (btn as HTMLElement).dataset.value;
			if (command && value) {
				document.execCommand(command, false, value);
				formatStyleBtns.forEach(b => b.classList.remove('active'));
				btn.classList.add('active');
				triggerAutoSave();
			}
		});
	});

	const formatInlineBtns = formatPopup.querySelectorAll('.format-inline-btn');
	formatInlineBtns.forEach(btn => {
		btn.addEventListener('click', () => {
			const command = (btn as HTMLElement).dataset.command;
			if (command) {
				document.execCommand(command, false);
				btn.classList.toggle('active');
				triggerAutoSave();
			}
		});
	});

	const formatListBtns = formatPopup.querySelectorAll('.format-list-btn');
	formatListBtns.forEach(btn => {
		btn.addEventListener('click', () => {
			const command = (btn as HTMLElement).dataset.command;
			if (command) {
				document.execCommand(command, false);
				triggerAutoSave();
			}
		});
	});

	checklistBtn.addEventListener('click', () => {
		if (isCodeMode) return;
		document.execCommand('insertHTML', false, '<div class="todo-item"><span class="todo-checkbox" contenteditable="false"></span><span class="todo-text" contenteditable="true">&nbsp;</span></div>');
		triggerAutoSave();
	});

	editorBody.addEventListener('click', (e) => {
		const target = e.target as HTMLElement;
		if (target.classList.contains('todo-checkbox')) {
			const item = target.closest('.todo-item') as HTMLElement;
			if (item) {
				item.classList.toggle('checked');
				triggerAutoSave();
			}
		}
	});

	foldersSearchInput.addEventListener('input', () => {
		const query = foldersSearchInput.value.toLowerCase();
		const items = foldersList.querySelectorAll('.folder-item');
		items.forEach(item => {
			const name = (item.querySelector('.folder-name') as HTMLElement).textContent?.toLowerCase() || '';
			if (name.includes(query) || (item as HTMLElement).dataset.id === 'all-notes') {
				(item as HTMLElement).classList.remove('hidden');
			} else {
				(item as HTMLElement).classList.add('hidden');
			}
		});
	});

	notesSearchInput.addEventListener('input', () => {
		const query = notesSearchInput.value;
		if (query) {
			clearSearchBtn.classList.remove('hidden');
			cancelSearchBtn.classList.remove('hidden');
		} else {
			clearSearchBtn.classList.add('hidden');
			cancelSearchBtn.classList.add('hidden');
		}
		renderNotesList(query);
	});

	clearSearchBtn.addEventListener('click', () => {
		notesSearchInput.value = '';
		clearSearchBtn.classList.add('hidden');
		renderNotesList();
	});

	cancelSearchBtn.addEventListener('click', () => {
		notesSearchInput.value = '';
		clearSearchBtn.classList.add('hidden');
		cancelSearchBtn.classList.add('hidden');
		renderNotesList();
	});

	openSyncSettingsBtn.addEventListener('click', async () => {
		try {
			const config = await GetSyncConfig();
			syncRepoUrl.value = config.remote_url || '';
			syncUsername.value = config.username || '';
			syncEmail.value = config.email || '';
			syncToken.value = config.token || '';
			syncModal.classList.remove('hidden');
		} catch (err) {
			console.error(err);
		}
	});

	closeSyncSettingsBtn.addEventListener('click', () => {
		syncModal.classList.add('hidden');
	});

	saveSyncSettingsBtn.addEventListener('click', async () => {
		const cfg = {
			remote_url: syncRepoUrl.value.trim(),
			username: syncUsername.value.trim(),
			email: syncEmail.value.trim(),
			token: syncToken.value.trim()
		};

		try {
			await SaveSyncConfig(cfg);
			syncModal.classList.add('hidden');
			alert('Настройки сохранены!');
		} catch (err) {
			console.error(err);
			alert('Ошибка сохранения: ' + err);
		}
	});

	syncBtn.addEventListener('click', async () => {
		syncBtn.classList.add('disabled');
		const originalSvg = syncBtn.innerHTML;
		syncBtn.innerHTML = '...';

		try {
			await Sync();
			alert('Синхронизация успешна!');
			await loadData();
		} catch (err) {
			console.error(err);
			alert('Ошибка синхронизации: ' + err);
		} finally {
			syncBtn.classList.remove('disabled');
			syncBtn.innerHTML = originalSvg;
		}
	});

	toggleSidebarsBtn.addEventListener('click', () => {
		const isFoldersHidden = appContainer.classList.contains('folders-hidden');
		const isNotesHidden = appContainer.classList.contains('notes-hidden');

		if (!isFoldersHidden && !isNotesHidden) {
			appContainer.classList.add('folders-hidden');
		} else if (isFoldersHidden && !isNotesHidden) {
			appContainer.classList.add('notes-hidden');
		} else {
			appContainer.classList.remove('folders-hidden', 'notes-hidden');
		}
	});

	initTheme();
	checkLockStatus();
});
