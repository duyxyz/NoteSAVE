chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "saveSelection",
    title: "Lưu ghi chú (văn bản)",
    contexts: ["selection"]
  });

  chrome.contextMenus.create({
    id: "saveImage",
    title: chrome.i18n.getMessage("saveImageContextMenu"),
    contexts: ["image"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "saveSelection") {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: () => window.getSelection().toString()
    }, (results) => {
      const selectedText = results[0].result;
      if (selectedText) {
        chrome.storage.local.get({ notes: [] }, (data) => {
          const notes = data.notes;
          const now = new Date();
          const date = now.toLocaleDateString('vi-VN');
          const time = now.toLocaleTimeString('vi-VN');
          const formattedTime = `${date} [ ${time} ]`;
          // Thêm ghi chú mới với trạng thái pinned: false
          notes.unshift({ text: selectedText, time: formattedTime, pinned: false });
          chrome.storage.local.set({ notes });
        });
      }
    });
  } else if (info.menuItemId === "saveImage") {
    const imageUrl = info.srcUrl;
    if (imageUrl) {
      fetch(imageUrl, { method: 'GET' })
        .then(response => {
          if (!response.ok) throw new Error('Không thể tải ảnh');
          return response.blob();
        })
        .then(blob => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64data = reader.result;
            chrome.storage.local.get({ notes: [] }, (data) => {
              const notes = data.notes;
              const now = new Date();
              const date = now.toLocaleDateString('vi-VN');
              const time = now.toLocaleTimeString('vi-VN');
              const formattedTime = `${date} [ ${time} ]`;
              // Thêm ghi chú ảnh với trạng thái pinned: false
              notes.unshift({ image: base64data, time: formattedTime, pinned: false });
              chrome.storage.local.set({ notes });
            });
          };
          reader.readAsDataURL(blob);
        })
        .catch(error => {
          console.error('Lỗi khi tải ảnh:', error);
        });
    }
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "fetchImage") {
    fetch(request.url, { method: 'GET' })
      .then(response => {
        if (!response.ok) throw new Error('Phản hồi mạng không ổn');
        return response.blob();
      })
      .then(blob => {
        sendResponse({ blob });
      })
      .catch(error => {
        sendResponse({ error: error.message });
      });
    return true;
  }
});