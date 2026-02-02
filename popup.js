document.addEventListener('DOMContentLoaded', () => {
  const textNoteList = document.getElementById('textNoteList');
  const imageNoteList = document.getElementById('imageNoteList');
  const customContextMenu = document.getElementById('customContextMenu');
  const contextMenuList = document.getElementById('contextMenuList');

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

  const tabsContainer = document.querySelector('.tabs-container');

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
  let clickCount = 0;
  let clickTimer = null;
  let lastClickedIndex = null;

  function escapeHTML(str) {
    const p = document.createElement('p');
    p.textContent = str;
    return p.innerHTML;
  }

  // Cấu hình marked chuẩn GitHub
  marked.setOptions({
    gfm: true,
    breaks: true,
    headerIds: false,
    mangle: false
  });

  function sanitizeHTML(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    // Loại bỏ các thẻ script và các thuộc tính sự kiện (onerror, onclick, ...)
    const scripts = div.querySelectorAll('script');
    scripts.forEach(s => s.remove());

    const allElements = div.querySelectorAll('*');
    allElements.forEach(el => {
      for (let i = 0; i < el.attributes.length; i++) {
        const attr = el.attributes[i];
        if (attr.name.startsWith('on')) {
          el.removeAttribute(attr.name);
        }
        if (attr.name === 'href' && attr.value.trim().toLowerCase().startsWith('javascript:')) {
          el.removeAttribute(attr.name);
        }
      }
    });
    return div.innerHTML;
  }

  function parseMarkdown(text) {
    if (!text) return '';
    try {
      // Parse văn bản thô bằng marked trước để nhận diện đầy đủ cú pháp (> , | , v.v.)
      let rawHtml = marked.parse(text);

      // Xử lý GitHub Alerts ([!NOTE], [!TIP], etc.) trong blockquote
      const alertMap = {
        'NOTE': 'fa-info-circle',
        'TIP': 'fa-lightbulb',
        'IMPORTANT': 'fa-circle-exclamation',
        'WARNING': 'fa-triangle-exclamation',
        'CAUTION': 'fa-circle-stop'
      };

      Object.keys(alertMap).forEach(type => {
        // Regex linh hoạt hơn để bắt toàn bộ nội dung trong blockquote có [!TYPE]
        const regex = new RegExp(`<blockquote>\\s*<p>\\s*\\[!${type}\\](?:<br>|\\s)*([\\s\\S]*?)<\\/blockquote>`, 'gi');
        rawHtml = rawHtml.replace(regex, (match, content) => {
          const typeLower = type.toLowerCase();
          const icon = alertMap[type];
          return `<div class="markdown-alert markdown-alert-${typeLower}"><p class="markdown-alert-title"><i class="fas ${icon}"></i>${typeLower}</p>${content.trim()}</div>`;
        });
      });

      // Sau đó mới dọn dẹp HTML để đảm bảo an toàn XSS
      return sanitizeHTML(rawHtml);
    } catch (e) {
      console.error('Lỗi parse Markdown:', e);
      return escapeHTML(text);
    }
  }

  function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const msgName = el.getAttribute('data-i18n');
      const msg = chrome.i18n.getMessage(msgName);
      if (msg) el.textContent = msg;
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const msgName = el.getAttribute('data-i18n-placeholder');
      const msg = chrome.i18n.getMessage(msgName);
      if (msg) el.setAttribute('placeholder', msg);
    });
    deleteMessage.textContent = chrome.i18n.getMessage('deleteConfirm');
    importChoiceModal.querySelector('p').textContent = chrome.i18n.getMessage('importChoiceTitle');
    addImportBtn.textContent = chrome.i18n.getMessage('addButton');
    replaceImportBtn.textContent = chrome.i18n.getMessage('replaceButton');
  }

  function togglePin(index) {
    allNotes[index].pinned = !allNotes[index].pinned;

    chrome.storage.local.set({ notes: allNotes }, () => {
      renderNotes(allNotes);
    });
  }

  function sortNotes(notes) {
    const pinned = notes.filter(n => n.pinned);
    const unpinned = notes.filter(n => !n.pinned);
    return [...pinned, ...unpinned];
  }

  function reorderNotes(fromIndex, toIndex) {
    if (fromIndex === toIndex) return;

    const [movedNote] = allNotes.splice(fromIndex, 1);
    allNotes.splice(toIndex, 0, movedNote);

    chrome.storage.local.set({ notes: allNotes }, () => {
      renderNotes(allNotes);
    });
  }

  function renderNotes(notes) {
    allNotes = sortNotes([...notes]);
    textNoteList.innerHTML = '';
    imageNoteList.innerHTML = '';

    // Tạo 2 cột để phân phối ảnh (Masonry ổn định)
    const leftCol = document.createElement('div');
    leftCol.className = 'masonry-column';
    const rightCol = document.createElement('div');
    rightCol.className = 'masonry-column';

    imageNoteList.appendChild(leftCol);
    imageNoteList.appendChild(rightCol);

    let imageCount = 0;
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

      // Thêm Header kiểu Gist cho từng ghi chú
      const gistHeader = document.createElement('div');
      gistHeader.className = 'gist-header';

      const typeInfo = document.createElement('span');
      typeInfo.className = 'gist-type';
      typeInfo.textContent = note.text ? 'Snippet' : 'Image';

      const timeInfo = document.createElement('span');
      timeInfo.className = 'gist-time';
      timeInfo.textContent = note.time || '';

      gistHeader.appendChild(typeInfo);
      gistHeader.appendChild(timeInfo);
      li.appendChild(gistHeader);

      if (note.text) {
        const textDiv = document.createElement('div');
        textDiv.className = 'text-content';
        textDiv.innerHTML = parseMarkdown(note.text);
        content.appendChild(textDiv);
        textNoteList.appendChild(li);
      } else if (note.image) {
        const img = document.createElement('img');
        img.src = note.image;
        img.className = 'note-image';
        content.appendChild(img);

        // Phân phối xen kẽ vào 2 cột
        if (imageCount % 2 === 0) {
          leftCol.appendChild(li);
        } else {
          rightCol.appendChild(li);
        }
        imageCount++;
      }

      li.appendChild(content);

      li.querySelectorAll('a, summary, details, input').forEach(el => {
        el.addEventListener('click', (e) => {
          e.stopPropagation();
        });
      });

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

      li.addEventListener('click', (e) => {
        if (currentEditingIndex !== null) return;

        // Trình duyệt cần default behavior cho summary/details/input
        const interactiveTags = ['A', 'SUMMARY', 'DETAILS', 'INPUT', 'LABEL'];
        if (interactiveTags.includes(e.target.tagName) || e.target.closest('summary, details, a, input')) {
          return;
        }

        e.preventDefault();

        if (e.ctrlKey || e.metaKey) {
          e.stopPropagation();
          if (selectedNoteIndexes.has(index)) {
            selectedNoteIndexes.delete(index);
            li.classList.remove('selected-multi');
          } else {
            selectedNoteIndexes.add(index);
            li.classList.add('selected-multi');
          }
          hideContextMenu();
        } else {
          if (lastClickedIndex === index) {
            clickCount++;
          } else {
            clickCount = 1;
            lastClickedIndex = index;
          }

          if (clickTimer) clearTimeout(clickTimer);

          if (clickCount === 3) {
            if (note.text) {
              navigator.clipboard.writeText(note.text).then(() => {
                li.style.backgroundColor = '#1a6b3a';
                setTimeout(() => {
                  li.style.backgroundColor = '';
                }, 200);
              });
            }
            clickCount = 0;
            lastClickedIndex = null;
          } else {
            clickTimer = setTimeout(() => {
              clickCount = 0;
              lastClickedIndex = null;
            }, 500);
          }
        }
      });

      li.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        currentContextNoteIndex = index;

        if (currentEditingIndex !== null) {
          return;
        }

        if (!selectedNoteIndexes.has(index)) {
          selectedNoteIndexes.clear();
          // Chỉ cập nhật class UI, không gọi renderNotes để tránh nhảy Masonry
          document.querySelectorAll('.note-item').forEach(item => item.classList.remove('selected-multi'));
          selectedNoteIndexes.add(index);
          li.classList.add('selected-multi');
        }

        if (note.image) {
          showImageContextMenu(e.pageX, e.pageY, index);
        } else {
          showTextContextMenu(e.pageX, e.pageY);
        }
      });
    });
  }

  function showImageContextMenu(x, y, index) {
    contextMenuList.innerHTML = '';

    const pinLi = document.createElement('li');
    const pinIcon = document.createElement('img');
    pinIcon.className = 'context-menu-icon';
    pinIcon.src = allNotes[index].pinned ? 'assets/unpin.png' : 'assets/pin.png';
    pinLi.appendChild(pinIcon);

    const pinTextKey = allNotes[index].pinned ? 'unpinButton' : 'pinButton';
    let pinTextContent = chrome.i18n.getMessage(pinTextKey);
    if (!pinTextContent) {
      pinTextContent = allNotes[index].pinned ? 'Unpin' : 'Pin';
    }
    const pinText = document.createTextNode(pinTextContent);

    pinLi.appendChild(pinText);
    pinLi.addEventListener('click', () => {
      togglePin(index);
      selectedNoteIndexes.clear();
      renderNotes(allNotes);
      hideContextMenu();
    });

    const deleteLi = document.createElement('li');
    const deleteIcon = document.createElement('img');
    deleteIcon.className = 'context-menu-icon';
    deleteIcon.src = 'assets/delete.png';
    deleteLi.appendChild(deleteIcon);
    const deleteText = document.createTextNode(chrome.i18n.getMessage('deleteButton'));
    deleteLi.appendChild(deleteText);
    deleteLi.addEventListener('click', () => {
      if (selectedNoteIndexes.size > 0 && selectedNoteIndexes.has(index)) {
        openDeleteModal(Array.from(selectedNoteIndexes));
      } else {
        openDeleteModal([index]);
      }
      hideContextMenu();
    });

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
      }
      selectedNoteIndexes.clear();
      renderNotes(allNotes);
      hideContextMenu();
    });

    const fullViewLi = document.createElement('li');
    const fullViewIcon = document.createElement('img');
    fullViewIcon.className = 'context-menu-icon';
    fullViewIcon.src = 'assets/fullviews.png';
    fullViewLi.appendChild(fullViewIcon);
    const fullViewText = document.createTextNode(chrome.i18n.getMessage('fullViewButton'));
    fullViewLi.appendChild(fullViewText);
    fullViewLi.addEventListener('click', () => {
      const noteTime = allNotes[index].time;
      window.open(`fullview.html?time=${encodeURIComponent(noteTime)}`, '_blank');
      hideContextMenu();
    });

    contextMenuList.appendChild(pinLi);
    contextMenuList.appendChild(deleteLi);
    contextMenuList.appendChild(saveLi);
    contextMenuList.appendChild(fullViewLi);

    positionContextMenu(x, y);
  }

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

      const pinTextKey = currentNote.pinned ? 'unpinButton' : 'pinButton';
      let pinTextContent = chrome.i18n.getMessage(pinTextKey);
      if (!pinTextContent) {
        pinTextContent = currentNote.pinned ? 'Unpin' : 'Pin';
      }

      menuItems = [
        { icon: currentNote.pinned ? 'assets/unpin.png' : 'assets/pin.png', text: pinTextContent, action: 'pin' },
        { icon: 'assets/copy.png', text: chrome.i18n.getMessage('copyButton'), action: 'copy' },
        { icon: 'assets/edit.png', text: chrome.i18n.getMessage('editButton'), action: 'edit' },
        { icon: 'assets/fullviews.png', text: chrome.i18n.getMessage('fullViewButton'), action: 'fullview' },
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

  function handleContextMenuOption(option) {
    if (currentContextNoteIndex === null) return;

    if (option === 'pin') {
      togglePin(currentContextNoteIndex);
      selectedNoteIndexes.clear();
      renderNotes(allNotes);
    } else if (option === 'copy') {
      if (selectedNoteIndexes.size > 0 && selectedNoteIndexes.has(currentContextNoteIndex)) {
        const texts = [];
        selectedNoteIndexes.forEach(idx => {
          const note = allNotes[idx];
          if (note.text) texts.push(note.text);
        });
        if (texts.length === 0) {
          return;
        }
        const combinedText = texts.join('\n\n');
        navigator.clipboard.writeText(combinedText).then(() => {
        });
      } else {
        const note = allNotes[currentContextNoteIndex];
        if (note.text) {
          navigator.clipboard.writeText(note.text).then(() => {
          });
        }
      }
      selectedNoteIndexes.clear();
      renderNotes(allNotes);
    } else if (option === 'edit') {
      const indexToEdit = currentContextNoteIndex;
      const noteToEdit = allNotes[indexToEdit];

      currentEditingIndex = indexToEdit;
      newNoteText.value = noteToEdit.text;

      tabsContainer.style.display = 'none';
      newNoteContainer.style.display = 'flex';
      newNoteText.focus();

      selectedNoteIndexes.clear();
      renderNotes(allNotes);

    } else if (option === 'fullview') {
      const noteTime = allNotes[currentContextNoteIndex].time;
      window.open(`fullview.html?time=${encodeURIComponent(noteTime)}`, '_blank');
    } else if (option === 'delete') {
      if (selectedNoteIndexes.size > 0 && selectedNoteIndexes.has(currentContextNoteIndex)) {
        openDeleteModal(Array.from(selectedNoteIndexes));
      } else {
        openDeleteModal([currentContextNoteIndex]);
      }
    }
  }

  function openDeleteModal(indexes) {
    if (!Array.isArray(indexes)) indexes = [indexes];
    deleteModal.style.display = 'flex';

    confirmDeleteBtn.onclick = () => {
      const sortedIndexes = [...indexes].sort((a, b) => b - a);
      sortedIndexes.forEach(idx => {
        allNotes.splice(idx, 1);
      });
      selectedNoteIndexes.clear();
      currentEditingIndex = null;
      chrome.storage.local.set({ notes: allNotes }, () => {
        renderNotes(allNotes);
        deleteModal.style.display = 'none';
      });
    };

    cancelDeleteBtn.onclick = () => {
      deleteModal.style.display = 'none';
    };
  }

  document.addEventListener('click', (e) => {
    if (!customContextMenu.contains(e.target)) {
      hideContextMenu();
      selectedNoteIndexes.clear();
      renderNotes(allNotes);
    }
  });

  document.addEventListener('contextmenu', (e) => {
    const clickedNote = e.target.closest('.note-item');
    if (!clickedNote && !customContextMenu.contains(e.target)) {
      e.preventDefault();
      hideContextMenu();
      selectedNoteIndexes.clear();
      renderNotes(allNotes);
    }
  });

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

  createNoteBtn.addEventListener('click', () => {
    currentEditingIndex = null;
    newNoteContainer.style.display = 'flex';
    tabsContainer.style.display = 'none';
    newNoteText.value = '';
    newNoteText.focus();
    selectedNoteIndexes.clear();
    renderNotes(allNotes);
  });

  saveNewNoteBtn.addEventListener('click', () => {
    const text = newNoteText.value.trim();
    if (text) {
      if (currentEditingIndex !== null) {
        allNotes[currentEditingIndex].text = text;
        currentEditingIndex = null;
      } else {
        const now = new Date();
        const formattedTime = now.toLocaleDateString() + ' [ ' + now.toLocaleTimeString() + ' ]';
        allNotes.unshift({ text, time: formattedTime, pinned: false });
      }

      chrome.storage.local.set({ notes: allNotes }, () => {
        renderNotes(allNotes);
        newNoteText.value = '';
        newNoteContainer.style.display = 'none';
        tabsContainer.style.display = 'flex';
      });

    }
  });

  cancelNewNoteBtn.addEventListener('click', () => {
    currentEditingIndex = null;
    newNoteText.value = '';
    newNoteContainer.style.display = 'none';
    tabsContainer.style.display = 'flex';
    renderNotes(allNotes);
  });

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
      pendingImportNotes = null;
      importChoiceModal.style.display = 'none';
    });
  });

  replaceImportBtn.addEventListener('click', () => {
    if (!pendingImportNotes) return;
    allNotes = pendingImportNotes;
    chrome.storage.local.set({ notes: allNotes }, () => {
      renderNotes(allNotes);
      pendingImportNotes = null;
      importChoiceModal.style.display = 'none';
    });
  });

  chrome.storage.local.get({ notes: [] }, (data) => {
    renderNotes(data.notes);
    applyI18n();
  });
});