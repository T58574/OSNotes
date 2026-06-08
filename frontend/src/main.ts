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
	IsPasswordEnabled,
	AutoUnlockIfNeeded,
	SetPasswordEnabled
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
	const deleteNoteBtn = document.getElementById('deleteNoteBtn') as HTMLElement | null;
	const shareBtn = document.getElementById('shareBtn') as HTMLElement | null;
	const formatBtn = document.getElementById('formatBtn') as HTMLElement | null;
	const checklistBtn = document.getElementById('checklistBtn') as HTMLElement | null;
	const toggleSidebarsBtn = document.getElementById('toggleSidebarsBtn') as HTMLElement | null;
	const doneBtn = document.getElementById('doneBtn') as HTMLElement | null;

	const codeModeBtn = document.getElementById('codeModeBtn') as HTMLElement | null;
	const runHtmlBtn = document.getElementById('runHtmlBtn') as HTMLElement | null;
	const notesSortSelect = document.getElementById('notesSortSelect') as HTMLSelectElement;

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

	const passwordModal = document.getElementById('passwordModal') as HTMLElement;
	const masterPasswordInput = document.getElementById('masterPasswordInput') as HTMLInputElement;
	const unlockBtn = document.getElementById('unlockBtn') as HTMLElement;

	const openSettingsBtn = document.getElementById('openSettingsBtn') as HTMLElement;
	const settingsModal = document.getElementById('settingsModal') as HTMLElement;
	const closeSettingsBtn = document.getElementById('closeSettingsBtn') as HTMLElement;

	const settingsPasswordToggle = document.getElementById('settingsPasswordToggle') as HTMLInputElement;
	const settingsChangePasswordRow = document.getElementById('settingsChangePasswordRow') as HTMLElement;
	const settingsChangePasswordBtn = document.getElementById('settingsChangePasswordBtn') as HTMLElement;




	const settingsThemeSelect = document.getElementById('settingsThemeSelect') as HTMLSelectElement;
	const settingsFontSizeSelect = document.getElementById('settingsFontSizeSelect') as HTMLSelectElement;
	const settingsSortSelect = document.getElementById('settingsSortSelect') as HTMLSelectElement;

	const passwordSettingsModal = document.getElementById('passwordSettingsModal') as HTMLElement;
	const passwordSettingsTitle = document.getElementById('passwordSettingsTitle') as HTMLElement;
	const passwordSettingsMessage = document.getElementById('passwordSettingsMessage') as HTMLElement;
	const oldPasswordInput = document.getElementById('oldPasswordInput') as HTMLInputElement;
	const newPasswordInput = document.getElementById('newPasswordInput') as HTMLInputElement;
	const confirmPasswordInput = document.getElementById('confirmPasswordInput') as HTMLInputElement;
	const cancelPasswordSettingsBtn = document.getElementById('cancelPasswordSettingsBtn') as HTMLElement;
	const savePasswordSettingsBtn = document.getElementById('savePasswordSettingsBtn') as HTMLElement;

	async function checkLockStatus() {
		try {
			const autoUnlocked = await AutoUnlockIfNeeded();
			if (autoUnlocked) {
				passwordModal.classList.add('hidden');
				await loadData();
				return;
			}
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
			name: 'Все заметки',
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

		const sortOrder = localStorage.getItem('ios-notes-sort') || 'updated';
		if (notesSortSelect) {
			notesSortSelect.value = sortOrder;
		}
		if (sortOrder === 'updated') {
			filteredNotes.sort((a, b) => b.updated_at - a.updated_at);
		} else if (sortOrder === 'created') {
			filteredNotes.sort((a, b) => b.created_at - a.created_at);
		} else if (sortOrder === 'title') {
			filteredNotes.sort((a, b) => a.title.localeCompare(b.title));
		}

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

				const deleteBtnHtml = `<button class="delete-note-inline" data-id="${note.id}" title="Удалить заметку">
					<svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:currentColor;"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
				</button>`;

				noteItem.innerHTML = `
					<div class="note-item-title">${note.title || 'Новая заметка'}</div>
					<div class="note-item-meta">
						<span class="note-item-date">${noteDateStr}</span>
						<span class="note-item-snippet">Открыть для просмотра</span>
					</div>
					${folderTag}
					${deleteBtnHtml}
				`;

				noteItem.addEventListener('click', (e) => {
					const target = e.target as HTMLElement;
					if (target.closest('.delete-note-inline')) {
						e.stopPropagation();
						const id = (target.closest('.delete-note-inline') as HTMLElement).dataset.id;
						if (id) {
							deleteNoteById(id);
						}
						return;
					}
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
			doneBtn?.classList.add('hidden');
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
			const sortOrder = localStorage.getItem('ios-notes-sort') || 'updated';
			if (notesSortSelect) {
				notesSortSelect.value = sortOrder;
			}
			if (sortOrder === 'updated') {
				filteredNotes.sort((a, b) => b.updated_at - a.updated_at);
			} else if (sortOrder === 'created') {
				filteredNotes.sort((a, b) => b.created_at - a.created_at);
			} else if (sortOrder === 'title') {
				filteredNotes.sort((a, b) => a.title.localeCompare(b.title));
			}
			selectNote(filteredNotes[0].id);
		} else {
			clearEditor();
		}
	}

	function clearEditor() {
		currentNoteId = null;
		editorBody.innerHTML = '';
		editorMeta.textContent = 'Нет заметок';
		doneBtn?.classList.add('hidden');
	}

	function setCodeMode(enabled: boolean) {
		isCodeMode = enabled;
		if (!currentNoteId) return;

		if (isCodeMode) {
			codeModeBtn?.classList.add('active');
			editorBody.classList.add('code-mode-active');
			const note = notes.find(n => n.id === currentNoteId);
			if (note) {
				editorBody.innerText = editorBody.innerHTML;
			}
			formatBtn?.classList.add('hidden');
			checklistBtn?.classList.add('hidden');
		} else {
			codeModeBtn?.classList.remove('active');
			editorBody.classList.remove('code-mode-active');
			const code = editorBody.innerText;
			editorBody.innerHTML = code;
			formatBtn?.classList.remove('hidden');
			checklistBtn?.classList.remove('hidden');
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

		doneBtn?.classList.remove('hidden');

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
			doneBtn?.classList.add('hidden');
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

	async function deleteNoteById(noteId: string) {
		try {
			await DeleteNote(noteId);
			notes = notes.filter(n => n.id !== noteId);
			if (currentNoteId === noteId) {
				currentNoteId = null;
			}
			updateFolderCounts();
			renderFolders();
			renderNotesList();
			if (!currentNoteId) {
				selectFirstNote();
			} else {
				const stillExists = notes.find(n => n.id === currentNoteId);
				if (!stillExists) {
					selectFirstNote();
				} else {
					const activeItem = notesList.querySelector(`.note-item[data-id="${currentNoteId}"]`);
					if (activeItem) activeItem.classList.add('active');
				}
			}
			if (window.innerWidth < 768 && !currentNoteId) {
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
		const savedTheme = localStorage.getItem('ios-notes-theme') || 'system';
		applyTheme(savedTheme);
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
	if (deleteNoteBtn) deleteNoteBtn.addEventListener('click', deleteCurrentNote);

	editorBody.addEventListener('input', triggerAutoSave);
	if (doneBtn) doneBtn.addEventListener('click', forceSave);

	if (codeModeBtn) {
		codeModeBtn.addEventListener('click', () => {
			setCodeMode(!isCodeMode);
		});
	}

	if (runHtmlBtn) {
		runHtmlBtn.addEventListener('click', () => {
			if (!currentNoteId) return;
			let htmlContent = isCodeMode ? editorBody.innerText : editorBody.innerHTML;
			htmlRunnerModal.classList.remove('hidden');
			htmlPreviewIframe.srcdoc = htmlContent;
		});
	}

	closeHtmlRunnerBtn.addEventListener('click', () => {
		htmlRunnerModal.classList.add('hidden');
		htmlPreviewIframe.srcdoc = '';
	});

	refreshHtmlRunnerBtn.addEventListener('click', () => {
		let htmlContent = isCodeMode ? editorBody.innerText : editorBody.innerHTML;
		htmlPreviewIframe.srcdoc = htmlContent;
	});

	if (shareBtn) {
		shareBtn.addEventListener('click', () => {
			if (!currentNoteId) return;
			shareModal.classList.remove('hidden');
		});
	}

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

	if (formatBtn) {
		formatBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			formatPopup.classList.toggle('hidden');
			if (!formatPopup.classList.contains('hidden')) {
				const rect = formatBtn.getBoundingClientRect();
				formatPopup.style.right = `${window.innerWidth - rect.right}px`;
				formatPopup.style.bottom = `${window.innerHeight - rect.top + 8}px`;
			}
		});
	}

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

	if (checklistBtn) {
		checklistBtn.addEventListener('click', () => {
			if (isCodeMode) return;
			document.execCommand('insertHTML', false, '<div class="todo-item"><span class="todo-checkbox" contenteditable="false"></span><span class="todo-text" contenteditable="true">&nbsp;</span></div>');
			triggerAutoSave();
		});
	}

	if (notesSortSelect) {
		notesSortSelect.addEventListener('change', () => {
			const val = notesSortSelect.value;
			localStorage.setItem('ios-notes-sort', val);
			if (settingsSortSelect) {
				settingsSortSelect.value = val;
			}
			renderNotesList();
		});
	}

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

	openSettingsBtn.addEventListener('click', async () => {
		try {
			const pwdEnabled = await IsPasswordEnabled();
			settingsPasswordToggle.checked = pwdEnabled;
			if (pwdEnabled) {
				settingsChangePasswordRow.classList.remove('hidden');
			} else {
				settingsChangePasswordRow.classList.add('hidden');
			}
			settingsThemeSelect.value = localStorage.getItem('ios-notes-theme') || 'system';
			settingsFontSizeSelect.value = localStorage.getItem('ios-notes-font-size') || 'medium';
			settingsSortSelect.value = localStorage.getItem('ios-notes-sort') || 'updated';
			const currentAccent = localStorage.getItem('ios-notes-accent') || 'gold';
			document.querySelectorAll('.accent-dot').forEach(dot => {
				if ((dot as HTMLElement).dataset.color === currentAccent) {
					dot.classList.add('active');
				} else {
					dot.classList.remove('active');
				}
			});
			settingsModal.classList.remove('hidden');
		} catch (err) {
			console.error(err);
		}
	});

	closeSettingsBtn.addEventListener('click', () => {
		settingsModal.classList.add('hidden');
	});



	let passwordAction: 'enable' | 'disable' | 'change' = 'enable';

	settingsPasswordToggle.addEventListener('change', async () => {
		const enabled = settingsPasswordToggle.checked;
		const pwdEnabled = await IsPasswordEnabled();
		if (enabled && !pwdEnabled) {
			passwordAction = 'enable';
			passwordSettingsTitle.textContent = 'Включить защиту';
			passwordSettingsMessage.textContent = 'Установите мастер-пароль для шифрования ваших заметок.';
			oldPasswordInput.classList.add('hidden');
			newPasswordInput.classList.remove('hidden');
			confirmPasswordInput.classList.remove('hidden');
			oldPasswordInput.value = '';
			newPasswordInput.value = '';
			confirmPasswordInput.value = '';
			passwordSettingsModal.classList.remove('hidden');
		} else if (!enabled && pwdEnabled) {
			passwordAction = 'disable';
			passwordSettingsTitle.textContent = 'Отключить защиту';
			passwordSettingsMessage.textContent = 'Введите текущий пароль для расшифрования заметок.';
			oldPasswordInput.classList.remove('hidden');
			newPasswordInput.classList.add('hidden');
			confirmPasswordInput.classList.add('hidden');
			oldPasswordInput.value = '';
			newPasswordInput.value = '';
			confirmPasswordInput.value = '';
			passwordSettingsModal.classList.remove('hidden');
		}
	});

	settingsChangePasswordBtn.addEventListener('click', () => {
		passwordAction = 'change';
		passwordSettingsTitle.textContent = 'Изменить мастер-пароль';
		passwordSettingsMessage.textContent = 'Введите текущий и новый пароли.';
		oldPasswordInput.classList.remove('hidden');
		newPasswordInput.classList.remove('hidden');
		confirmPasswordInput.classList.remove('hidden');
		oldPasswordInput.value = '';
		newPasswordInput.value = '';
		confirmPasswordInput.value = '';
		passwordSettingsModal.classList.remove('hidden');
	});

	cancelPasswordSettingsBtn.addEventListener('click', async () => {
		passwordSettingsModal.classList.add('hidden');
		const pwdEnabled = await IsPasswordEnabled();
		settingsPasswordToggle.checked = pwdEnabled;
	});

	savePasswordSettingsBtn.addEventListener('click', async () => {
		const oldPwd = oldPasswordInput.value;
		const newPwd = newPasswordInput.value;
		const confPwd = confirmPasswordInput.value;
		if (passwordAction === 'enable') {
			if (!newPwd) {
				alert('Пароль не может быть пустым');
				return;
			}
			if (newPwd !== confPwd) {
				alert('Пароли не совпадают');
				return;
			}
			try {
				const success = await SetPasswordEnabled(true, '', newPwd);
				if (success) {
					passwordSettingsModal.classList.add('hidden');
					settingsChangePasswordRow.classList.remove('hidden');
					alert('Пароль успешно установлен!');
				} else {
					alert('Не удалось установить пароль');
				}
			} catch (err) {
				alert('Ошибка: ' + err);
			}
		} else if (passwordAction === 'disable') {
			if (!oldPwd) {
				alert('Введите текущий пароль');
				return;
			}
			try {
				const success = await SetPasswordEnabled(false, oldPwd, '');
				if (success) {
					passwordSettingsModal.classList.add('hidden');
					settingsChangePasswordRow.classList.add('hidden');
					alert('Защита паролем успешно отключена');
				} else {
					alert('Неверный пароль');
					settingsPasswordToggle.checked = true;
				}
			} catch (err) {
				alert('Ошибка: ' + err);
				settingsPasswordToggle.checked = true;
			}
		} else if (passwordAction === 'change') {
			if (!oldPwd || !newPwd) {
				alert('Заполните все поля');
				return;
			}
			if (newPwd !== confPwd) {
				alert('Новые пароли не совпадают');
				return;
			}
			try {
				const success = await SetPasswordEnabled(true, oldPwd, newPwd);
				if (success) {
					passwordSettingsModal.classList.add('hidden');
					alert('Пароль изменен!');
				} else {
					alert('Неверный текущий пароль');
				}
			} catch (err) {
				alert('Ошибка: ' + err);
			}
		}
	});



	settingsThemeSelect.addEventListener('change', () => {
		const val = settingsThemeSelect.value;
		localStorage.setItem('ios-notes-theme', val);
		applyTheme(val);
	});

	settingsFontSizeSelect.addEventListener('change', () => {
		setEditorFontSize(settingsFontSizeSelect.value);
	});

	settingsSortSelect.addEventListener('change', () => {
		const val = settingsSortSelect.value;
		localStorage.setItem('ios-notes-sort', val);
		if (notesSortSelect) {
			notesSortSelect.value = val;
		}
		renderNotesList();
	});

	document.querySelectorAll('.accent-dot').forEach(dot => {
		dot.addEventListener('click', (e) => {
			const color = (e.target as HTMLElement).dataset.color;
			if (color) {
				setAccentColor(color);
				document.querySelectorAll('.accent-dot').forEach(d => d.classList.remove('active'));
				(e.target as HTMLElement).classList.add('active');
			}
		});
	});

	function setAccentColor(colorName: string) {
		const colors: Record<string, { hex: string, rgb: string }> = {
			gold: { hex: '#e4a11b', rgb: '228, 161, 27' },
			blue: { hex: '#007aff', rgb: '0, 122, 255' },
			green: { hex: '#34c759', rgb: '52, 199, 89' },
			purple: { hex: '#af52de', rgb: '175, 82, 222' },
			red: { hex: '#ff3b30', rgb: '255, 59, 48' }
		};
		const theme = colors[colorName] || colors.gold;
		document.documentElement.style.setProperty('--accent', theme.hex);
		document.documentElement.style.setProperty('--accent-rgb', theme.rgb);
		localStorage.setItem('ios-notes-accent', colorName);
	}

	function initAccentColors() {
		const currentAccent = localStorage.getItem('ios-notes-accent') || 'gold';
		setAccentColor(currentAccent);
	}

	function setEditorFontSize(sizeName: string) {
		const sizes: Record<string, string> = {
			small: '0.9rem',
			medium: '1.05rem',
			large: '1.2rem',
			xl: '1.4rem'
		};
		const size = sizes[sizeName] || sizes.medium;
		document.documentElement.style.setProperty('--editor-font-size', size);
		localStorage.setItem('ios-notes-font-size', sizeName);
	}

	function initEditorFontSize() {
		const currentSize = localStorage.getItem('ios-notes-font-size') || 'medium';
		setEditorFontSize(currentSize);
	}

	function applyTheme(theme: string) {
		appContainer.classList.remove('light-theme', 'dark-theme');
		if (theme === 'dark') {
			appContainer.classList.add('dark-theme');
			toggleThemeIcon(true);
		} else if (theme === 'light') {
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
		if (settingsThemeSelect) {
			settingsThemeSelect.value = theme;
		}
	}

	if (toggleSidebarsBtn) {
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
	}

	initTheme();
	initAccentColors();
	initEditorFontSize();
	checkLockStatus();
});
