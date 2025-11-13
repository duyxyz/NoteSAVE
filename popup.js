document.addEventListener('DOMContentLoaded', () => {
  // DOM elements
  const textNoteList = document.getElementById('textNoteList');
  const imageNoteList = document.getElementById('imageNoteList');
  const customContextMenu = document.getElementById('customContextMenu');
  const contextMenuList = document.getElementById('contextMenuList');
  const toast = document.getElementById('toast');

  const createNoteBtn = document.getElementById('createNoteBtn');
  const newNoteContainer = document.getElementById('newNoteContainer');
  const newNoteText = document.getElementById('newNoteText');
  const saveNewNoteBtn = document.getElementById('saveNewNoteBtn');
  const cancelNewNoteBtn = document.getElementById('cancelNewNoteBtn');
  const textTabBtn = document.getElementById('textTabBtn');
  const imageTabBtn = document.getElementById('imageTabBtn');
  const textTab = document.getElementById('textTab');
  const imageTab = document.getElementById('imageTab');
  const deleteModal = document.getElementById('deleteModal');
  const deleteMessage = document.getElementById('deleteMessage');
  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
  const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');

  const exportJsonBtn = document.getElementById('exportJsonBtn');
  const importJsonBtn = document.getElementById('importJsonBtn');
  const fileInput = document.getElementById('fileInput');
  const importChoiceModal = document.getElementById('importChoiceModal');
  const addImportBtn = document.getElementById('addImportBtn');
  const replaceImportBtn = document.getElementById('replaceImportBtn');

  let allNotes = [];
  let selectedNoteIndexes = new Set();
  let currentContextNoteIndex = null;
  let currentEditingIndex = null;
  let pendingImportNotes = null;
  let draggedIndex = null;
  let draggedElement = null;

  // Simple Markdown parser
  function parseMarkdown(text) {
    let html = text;
    
    // Code blocks (must be before inline code)
    html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
    
    // Headers
    html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');
    
    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');
    
    // Italic
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    html = html.replace(/_(.*?)_/g, '<em>$1</em>');
    
    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
    
    // Blockquotes
    html = html.replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>');
    
    // Horizontal rule
    html = html.replace(/^---$/gm, '<hr>');
    html = html.replace(/^\*\*\*$/gm, '<hr>');
    
    // Unordered lists
    html = html.replace(/^\* (.+)$/gm, '<li>$1</li>');
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
    
    // Ordered lists
    html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
    
    // Line breaks
    html = html.replace(/\n/g, '<br>');
    
    return html;
  }

  // Apply i18n for static text in DOM
  function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const msgName = el.getAttribute('data-i18n');
      const msg = chrome.i18n.getMessage(msgName);
      if(msg) el.textContent = msg;
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const msgName = el.getAttribute('data-i18n-placeholder');
      const msg = chrome.i18n.getMessage(msgName);
      if(msg) el.setAttribute('placeholder', msg);
    });
    deleteMessage.textContent = chrome.i18n.getMessage('deleteConfirm');
    importChoiceModal.querySelector('p').textContent = chrome.i18n.getMessage('importChoiceTitle');
    addImportBtn.textContent = chrome.i18n.getMessage('addButton');
    replaceImportBtn.textContent = chrome.i18n.getMessage('replaceButton');
  }

  // Toggle pin status
  function togglePin(index) {
    allNotes[index].pinned = !allNotes[index].pinned;
    chrome.storage.local.set({ notes: allNotes }, () => {
      renderNotes(allNotes);
      showToast(allNotes[index].pinned ? ' Pinned' : 'Unpinned!');
    });
  }

  // Sort notes: pinned first, then by custom order
  function sortNotes(notes) {
    const pinned = notes.filter(n => n.pinned);
    const unpinned = notes.filter(n => !n.pinned);
    return [...pinned, ...unpinned];
  }

  // Reorder notes after drag and drop
  function reorderNotes(fromIndex, toIndex) {
    if (fromIndex === toIndex) return;
    
    const [movedNote] = allNotes.splice(fromIndex, 1);
    allNotes.splice(toIndex, 0, movedNote);
    
    chrome.storage.local.set({ notes: allNotes }, () => {
      renderNotes(allNotes);
      showToast(' Position changed');
    });
  }

  // Render notes list
  function renderNotes(notes) {
    allNotes = sortNotes([...notes]);
    textNoteList.innerHTML = '';
    imageNoteList.innerHTML = '';

    allNotes.forEach((note, index) => {
      const li = document.createElement('li');
      li.classList.add('note-item');
      if (note.pinned) li.classList.add('pinned');
      li.dataset.index = index;
      li.dataset.type = note.text ? 'text' : 'image';
      li.draggable = true;

      if (selectedNoteIndexes.has(index)) {
        li.classList.add('selected-multi');
      }

      const content = document.createElement('div');
      content.className = 'note-content';

      if (note.text) {
        if (currentEditingIndex === index) {
          renderInlineEdit(note.text, content, index);
        } else {
          const textDiv = document.createElement('div');
          textDiv.className = 'text-content';
          textDiv.innerHTML = parseMarkdown(note.text);
          content.appendChild(textDiv);
        }
        textNoteList.appendChild(li);
      } else if (note.image) {
        const img = document.createElement('img');
        img.src = note.image;
        img.className = 'note-image';
        content.appendChild(img);
        imageNoteList.appendChild(li);
      }

      li.appendChild(content);

      // Drag and drop events
      li.addEventListener('dragstart', (e) => {
        if (currentEditingIndex !== null) {
          e.preventDefault();
          return;
        }
        draggedIndex = index;
        draggedElement = li;
        li.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });

      li.addEventListener('dragend', (e) => {
        li.classList.remove('dragging');
        document.querySelectorAll('.note-item').forEach(item => {
          item.classList.remove('drag-over');
        });
      });

      li.addEventListener('dragover', (e) => {
        if (currentEditingIndex !== null) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        if (draggedElement !== li) {
          li.classList.add('drag-over');
        }
      });

      li.addEventListener('dragleave', (e) => {
        li.classList.remove('drag-over');
      });

      li.addEventListener('drop', (e) => {
        e.preventDefault();
        li.classList.remove('drag-over');
        
        if (draggedIndex !== null && draggedIndex !== index) {
          reorderNotes(draggedIndex, index);
        }
        draggedIndex = null;
        draggedElement = null;
      });

      // Left click toggles multi-select
      li.addEventListener('click', (e) => {
        if (currentEditingIndex !== null) return;
        e.preventDefault();
        if (selectedNoteIndexes.has(index)) {
          selectedNoteIndexes.delete(index);
          li.classList.remove('selected-multi');
        } else {
          selectedNoteIndexes.add(index);
          li.classList.add('selected-multi');
        }
        hideContextMenu();
      });

      // Right click shows context menu
      li.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        currentContextNoteIndex = index;

        // Only show context menu if note is selected
        if (!selectedNoteIndexes.has(index)) {
          return;
        }

        if (note.image) {
          showImageContextMenu(e.pageX, e.pageY, index);
        } else {
          showTextContextMenu(e.pageX, e.pageY);
        }
      });
    });
  }

  // Context menu for images (Pin + Delete + Save image)
  function showImageContextMenu(x, y, index) {
    contextMenuList.innerHTML = '';

    // Pin/Unpin
    const pinLi = document.createElement('li');
    const pinIcon = document.createElement('img');
    pinIcon.className = 'context-menu-icon';
    pinIcon.src = allNotes[index].pinned ? 'assets/unpin.png' : 'assets/pin.png';
    pinLi.appendChild(pinIcon);
    const pinText = document.createTextNode(allNotes[index].pinned ? 'Unpin' : 'Pin');
    pinLi.appendChild(pinText);
    pinLi.addEventListener('click', () => {
      togglePin(index);
      hideContextMenu();
    });

    // Delete
    const deleteLi = document.createElement('li');
    const deleteIcon = document.createElement('img');
    deleteIcon.className = 'context-menu-icon';
    deleteIcon.src = 'assets/delete.png';
    deleteLi.appendChild(deleteIcon);
    const deleteText = document.createTextNode(chrome.i18n.getMessage('deleteButton'));
    deleteLi.appendChild(deleteText);
    deleteLi.addEventListener('click', () => {
      if (selectedNoteIndexes.size > 0 && selectedNoteIndexes.has(index)) {
        const indexesToDelete = Array.from(selectedNoteIndexes).sort((a, b) => b - a);
        indexesToDelete.forEach(idx => {
          allNotes.splice(idx, 1);
        });
        selectedNoteIndexes.clear();
      } else {
        allNotes.splice(index, 1);
      }
      currentEditingIndex = null;
      chrome.storage.local.set({ notes: allNotes }, () => {
        renderNotes(allNotes);
        showToast(chrome.i18n.getMessage('deleteSuccess'));
      });
      hideContextMenu();
    });

    // Save Image
    const saveLi = document.createElement('li');
    const saveIcon = document.createElement('img');
    saveIcon.className = 'context-menu-icon';
    saveIcon.src = 'assets/save.png';
    saveLi.appendChild(saveIcon);
    const saveText = document.createTextNode(chrome.i18n.getMessage("saveImageOption"));
    saveLi.appendChild(saveText);
    saveLi.addEventListener('click', () => {
      const imgSrc = allNotes[index].image;
      if (imgSrc) {
        const a = document.createElement('a');
        a.href = imgSrc;
        a.download = `note_image_${index}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast(chrome.i18n.getMessage("imageSaveSuccess"));
      }
      hideContextMenu();
    });

    contextMenuList.appendChild(pinLi);
    contextMenuList.appendChild(deleteLi);
    contextMenuList.appendChild(saveLi);

    positionContextMenu(x, y);
  }

  // Context menu for text (depending on number of selected notes)
  function showTextContextMenu(x, y) {
    contextMenuList.innerHTML = '';
    const currentNote = allNotes[currentContextNoteIndex];

    let menuItems = [];

    if (selectedNoteIndexes.size > 1) {
      menuItems = [
        { icon: 'assets/copy.png', text: chrome.i18n.getMessage('copyButton'), action: 'copy' },
        { icon: 'assets/delete.png', text: chrome.i18n.getMessage('deleteButton'), action: 'delete' }
      ];
    } else if (selectedNoteIndexes.size === 1) {
      menuItems = [
        { icon: currentNote.pinned ? 'assets/unpin.png' : 'assets/pin.png', text: currentNote.pinned ? 'Unpin' : 'Pin', action: 'pin' },
        { icon: 'assets/copy.png', text: chrome.i18n.getMessage('copyButton'), action: 'copy' },
        { icon: 'assets/edit.png', text: chrome.i18n.getMessage('editButton'), action: 'edit' },
        { icon: 'assets/delete.png', text: chrome.i18n.getMessage('deleteButton'), action: 'delete' }
      ];
    }

    menuItems.forEach(item => {
      const li = document.createElement('li');
      const icon = document.createElement('img');
      icon.className = 'context-menu-icon';
      icon.src = item.icon;
      li.appendChild(icon);
      const text = document.createTextNode(item.text);
      li.appendChild(text);
      li.addEventListener('click', () => {
        handleContextMenuOption(item.action);
        hideContextMenu();
      });
      contextMenuList.appendChild(li);
    });

    positionContextMenu(x, y);
  }

  // Position context menu with boundary detection
  function positionContextMenu(x, y) {
    customContextMenu.style.top = y + 'px';
    customContextMenu.style.left = x + 'px';
    customContextMenu.style.display = 'block';

    const rect = customContextMenu.getBoundingClientRect();
    const popupRect = document.body.getBoundingClientRect();
    
    if (rect.right > popupRect.right) {
      customContextMenu.style.left = (x - (rect.right - popupRect.right) - 10) + 'px';
    }
    if (rect.bottom > popupRect.bottom) {
      customContextMenu.style.top = (y - (rect.bottom - popupRect.bottom) - 10) + 'px';
    }
  }

  function hideContextMenu() {
    customContextMenu.style.display = 'none';
  }

  // Handle context menu options
  function handleContextMenuOption(option) {
    if (currentContextNoteIndex === null) return;

    if (option === 'pin') {
      togglePin(currentContextNoteIndex);
    } else if (option === 'copy') {
      if (selectedNoteIndexes.size > 0 && selectedNoteIndexes.has(currentContextNoteIndex)) {
        const texts = [];
        selectedNoteIndexes.forEach(idx => {
          const note = allNotes[idx];
          if (note.text) texts.push(note.text);
        });
        if (texts.length === 0) {
          showToast(chrome.i18n.getMessage('noTextToCopy'));
          return;
        }
        const combinedText = texts.join('\n\n');
        navigator.clipboard.writeText(combinedText).then(() => {
          showToast(chrome.i18n.getMessage('copyMultiSuccess').replace('{num}', texts.length));
        });
      } else {
        const note = allNotes[currentContextNoteIndex];
        if (note.text) {
          navigator.clipboard.writeText(note.text).then(() => {
            showToast(chrome.i18n.getMessage('copySuccess'));
          });
        }
      }
    } else if (option === 'edit') {
      currentEditingIndex = currentContextNoteIndex;
      renderNotes(allNotes);
    } else if (option === 'delete') {
      if (selectedNoteIndexes.size > 0 && selectedNoteIndexes.has(currentContextNoteIndex)) {
        const indexesToDelete = Array.from(selectedNoteIndexes).sort((a,b) => b - a);
        indexesToDelete.forEach(idx => {
          allNotes.splice(idx,1);
        });
        selectedNoteIndexes.clear();
        currentEditingIndex = null;
        chrome.storage.local.set({ notes: allNotes }, () => {
          renderNotes(allNotes);
          showToast(chrome.i18n.getMessage('deleteSuccess'));
        });
      } else {
        openDeleteModal(currentContextNoteIndex);
      }
    }
  }

  // Inline editing
  function renderInlineEdit(text, container, index) {
    container.innerHTML = '';
    const textarea = document.createElement('textarea');
    textarea.className = 'edit-textarea';
    textarea.value = text;

    const btnContainer = document.createElement('div');
    btnContainer.className = 'edit-button-container';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'save-button';
    saveBtn.textContent = chrome.i18n.getMessage('saveButton');

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'cancel-button';
    cancelBtn.textContent = chrome.i18n.getMessage('cancelButton');

    btnContainer.appendChild(saveBtn);
    btnContainer.appendChild(cancelBtn);

    container.appendChild(textarea);
    container.appendChild(btnContainer);

    textarea.focus();

    saveBtn.onclick = () => {
      const newText = textarea.value.trim();
      if (newText) {
        allNotes[index].text = newText;
        currentEditingIndex = null;
        selectedNoteIndexes.clear();
        chrome.storage.local.set({ notes: allNotes }, () => {
          renderNotes(allNotes);
          showToast(chrome.i18n.getMessage('saveSuccess'));
        });
      }
    };

    cancelBtn.onclick = () => {
      currentEditingIndex = null;
      renderNotes(allNotes);
    };
  }

  // Delete confirmation modal
  function openDeleteModal(index) {
    deleteModal.style.display = 'flex';

    confirmDeleteBtn.onclick = () => {
      allNotes.splice(index, 1);
      selectedNoteIndexes.delete(index);
      currentEditingIndex = null;
      chrome.storage.local.set({ notes: allNotes }, () => {
        renderNotes(allNotes);
        deleteModal.style.display = 'none';
        showToast(chrome.i18n.getMessage('deleteSuccess'));
      });
    };

    cancelDeleteBtn.onclick = () => {
      deleteModal.style.display = 'none';
    };
  }

  // Toast notification
  let toastTimeout;
  function showToast(message) {
    toast.textContent = message;
    toast.style.display = 'block';
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toast.style.display = 'none';
    }, 1500);
  }

  // Hide menu when clicking outside
  document.addEventListener('click', (e) => {
    if (!customContextMenu.contains(e.target)) {
      hideContextMenu();
    }
  });

  // Tab switching
  textTabBtn.addEventListener('click', () => {
    textTabBtn.classList.add('active');
    imageTabBtn.classList.remove('active');
    textTab.classList.add('active');
    imageTab.classList.remove('active');
  });

  imageTabBtn.addEventListener('click', () => {
    imageTabBtn.classList.add('active');
    textTabBtn.classList.remove('active');
    imageTab.classList.add('active');
    textTab.classList.remove('active');
  });

  // Create new note
  createNoteBtn.addEventListener('click', () => {
    newNoteContainer.style.display = 'block';
    newNoteText.value = '';
    newNoteText.focus();
  });

  saveNewNoteBtn.addEventListener('click', () => {
    const text = newNoteText.value.trim();
    if (text) {
      const now = new Date();
      const formattedTime = now.toLocaleDateString('vi-VN') + ' [ ' + now.toLocaleTimeString('vi-VN') + ' ]';
      allNotes.unshift({ text, time: formattedTime, pinned: false });
      chrome.storage.local.set({ notes: allNotes }, () => {
        renderNotes(allNotes);
        newNoteText.value = '';
        newNoteContainer.style.display = 'none';
        showToast(chrome.i18n.getMessage('createSuccess'));
      });
    }
  });

  cancelNewNoteBtn.addEventListener('click', () => {
    newNoteText.value = '';
    newNoteContainer.style.display = 'none';
  });

  // Export JSON
  exportJsonBtn.addEventListener('click', () => {
    if (!allNotes.length) {
      alert(chrome.i18n.getMessage('jsonExportNoNotes'));
      return;
    }
    const dataStr = JSON.stringify(allNotes, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `notes_backup_${Date.now()}.json`;
    a.click();

    URL.revokeObjectURL(url);
  });

  // Import JSON with modal for add/replace choice
  importJsonBtn.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedNotes = JSON.parse(e.target.result);
        if (!Array.isArray(importedNotes)) throw new Error(chrome.i18n.getMessage('jsonImportInvalidFile'));

        const isValid = importedNotes.every(note =>
          (typeof note === 'object') &&
          (('text' in note) || ('image' in note)) &&
          ('time' in note)
        );
        if (!isValid) throw new Error(chrome.i18n.getMessage('jsonImportInvalidFile'));

        pendingImportNotes = importedNotes;
        importChoiceModal.style.display = 'flex';

      } catch (error) {
        alert(chrome.i18n.getMessage('jsonImportInvalidFile') + ': ' + error.message);
      }
    };
    reader.readAsText(file);
    fileInput.value = '';
  });

  addImportBtn.addEventListener('click', () => {
    if (!pendingImportNotes) return;
    allNotes = pendingImportNotes.concat(allNotes);
    chrome.storage.local.set({ notes: allNotes }, () => {
      renderNotes(allNotes);
      showToast(chrome.i18n.getMessage('jsonImportAddSuccess'));
      pendingImportNotes = null;
      importChoiceModal.style.display = 'none';
    });
  });

  replaceImportBtn.addEventListener('click', () => {
    if (!pendingImportNotes) return;
    allNotes = pendingImportNotes;
    chrome.storage.local.set({ notes: allNotes }, () => {
      renderNotes(allNotes);
      showToast(chrome.i18n.getMessage('jsonImportReplaceSuccess'));
      pendingImportNotes = null;
      importChoiceModal.style.display = 'none';
    });
  });

  // Initialize data and apply i18n
  chrome.storage.local.get({ notes: [] }, (data) => {
    renderNotes(data.notes);
    applyI18n();
  });
});