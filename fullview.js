// Copy sanitizeHTML from popup.js
function sanitizeHTML(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
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
        let rawHtml = marked.parse(text);
        const alertMap = {
            'NOTE': 'fa-info-circle',
            'TIP': 'fa-lightbulb',
            'IMPORTANT': 'fa-circle-exclamation',
            'WARNING': 'fa-triangle-exclamation',
            'CAUTION': 'fa-circle-stop'
        };

        Object.keys(alertMap).forEach(type => {
            const regex = new RegExp(`<blockquote>\\s*<p>\\s*\\[!${type}\\](?:<br>|\\s)*([\\s\\S]*?)<\\/blockquote>`, 'gi');
            rawHtml = rawHtml.replace(regex, (match, content) => {
                const typeLower = type.toLowerCase();
                const icon = alertMap[type];
                return `<div class="markdown-alert markdown-alert-${typeLower}"><p class="markdown-alert-title"><i class="fas ${icon}"></i>${typeLower}</p>${content.trim()}</div>`;
            });
        });
        return sanitizeHTML(rawHtml);
    } catch (e) {
        console.error('Markdown error:', e);
        return text;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Handle back button click
    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
        backBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.close();
        });
    }

    const params = new URLSearchParams(window.location.search);
    const noteTime = params.get('time');
    const noteIndex = params.get('index');

    chrome.storage.local.get({ notes: [] }, (data) => {
        const notes = data.notes;
        let note = null;

        if (noteTime) {
            // Ưu tiên tìm theo thời gian (ID chuẩn)
            note = notes.find(n => n.time === noteTime);
        }

        if (!note && noteIndex !== null) {
            // Fallback tìm theo index nếu không thấy time hoặc dùng bản cũ
            note = notes[parseInt(noteIndex)];
        }

        if (!note) {
            document.getElementById('noteContent').textContent = 'Note not found.';
            return;
        }

        document.getElementById('noteType').textContent = note.text ? 'Snippet' : 'Image';
        document.getElementById('noteTime').textContent = note.time || '';

        if (note.text) {
            document.getElementById('noteContent').innerHTML = parseMarkdown(note.text);
        } else if (note.image) {
            const img = document.createElement('img');
            img.src = note.image;
            img.style.maxWidth = '100%';
            img.style.height = 'auto';
            document.getElementById('noteContent').appendChild(img);
        }
    });
});
