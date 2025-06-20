const socket = io();

let currentUser = null;
let currentGroupId = null;
let draftKey = 'chat_draft';
let isEditingMessageId = null;

// Elements
const messageForm = document.getElementById('messageForm');
const messageInput = document.getElementById('messageInput');
const messagesContainer = document.getElementById('messages');
const btnAttach = document.getElementById('btnAttach');
const fileInput = document.getElementById('fileInput');
const btnRecord = document.getElementById('btnRecord');
const btnSend = document.getElementById('btnSend');
const groupList = document.getElementById('groupList');
const chatTitle = document.getElementById('chatTitle');
const btnCreateGroup = document.getElementById('btnCreateGroup');
const modalOverlay = document.getElementById('modalOverlay');
const modalContent = document.getElementById('modalContent');
const btnBackup = document.getElementById('btnBackup');
const btnSearchToggle = document.getElementById('btnSearchToggle');
const searchBar = document.getElementById('searchBar');
const searchInput = document.getElementById('searchInput');

let mediaRecorder = null;
let recordedChunks = [];

// Initialize app
async function init() {
  try {
    const res = await fetch('/me');
    if (!res.ok) {
      window.location.href = '/login.html';
      return;
    }
    const data = await res.json();
    currentUser = data.user;
    loadGroups();
    loadDraft();
  } catch (err) {
    console.error('Failed to initialize:', err);
  }
}

// Load groups (placeholder, implement real group loading)
function loadGroups() {
  // For demo, just add a default group
  groupList.innerHTML = '';
  const groupItem = document.createElement('div');
  groupItem.textContent = 'General Chat';
  groupItem.className = 'p-2 rounded cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-700';
  groupItem.addEventListener('click', () => {
    currentGroupId = null;
    chatTitle.textContent = 'General Chat';
    loadMessages();
  });
  groupList.appendChild(groupItem);
  currentGroupId = null;
  chatTitle.textContent = 'General Chat';
  loadMessages();
}

// Load messages (placeholder, implement real message loading)
async function loadMessages() {
  messagesContainer.innerHTML = '';
  // Fetch messages from server (not implemented)
  // For demo, show welcome message
  const welcomeMsg = createMessageElement({
    id: 0,
    user_id: 0,
    content: 'Welcome to Local LAN Messaging!',
    created_at: new Date().toISOString(),
    edited: 0,
    pinned: 0,
  });
  messagesContainer.appendChild(welcomeMsg);
  scrollToBottom();
}

// Create message DOM element
function createMessageElement(message) {
  const div = document.createElement('div');
  div.className = 'message p-2 rounded bg-gray-200 dark:bg-gray-700 max-w-xl';
  div.dataset.id = message.id;

  const content = document.createElement('p');
  content.textContent = message.content;
  div.appendChild(content);

  if (message.edited) {
    const editedLabel = document.createElement('span');
    editedLabel.textContent = ' (edited)';
    editedLabel.className = 'text-xs italic text-gray-600 dark:text-gray-400';
    div.appendChild(editedLabel);
  }

  return div;
}

// Scroll messages container to bottom
function scrollToBottom() {
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Send message
messageForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const content = messageInput.value.trim();
  if (!content) return;

  if (isEditingMessageId) {
    // Edit message
    try {
      const res = await fetch(`/message/${isEditingMessageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error('Failed to edit message');
      isEditingMessageId = null;
      messageInput.value = '';
      loadMessages();
    } catch (err) {
      alert(err.message);
    }
  } else {
    // Send new message
    try {
      const res = await fetch('/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, group_id: currentGroupId }),
      });
      if (!res.ok) throw new Error('Failed to send message');
      messageInput.value = '';
      loadMessages();
    } catch (err) {
      alert(err.message);
    }
  }
  localStorage.removeItem(draftKey);
});

// Save draft on input
messageInput.addEventListener('input', () => {
  localStorage.setItem(draftKey, messageInput.value);
});

// Load draft from localStorage
function loadDraft() {
  const draft = localStorage.getItem(draftKey);
  if (draft) {
    messageInput.value = draft;
  }
}

// Attach file button
btnAttach.addEventListener('click', () => {
  fileInput.click();
});

// File input change
fileInput.addEventListener('change', async () => {
  if (fileInput.files.length === 0) return;
  const file = fileInput.files[0];
  const formData = new FormData();
  formData.append('file', file);
  try {
    const res = await fetch('/upload', {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    if (data.success) {
      // Send message with file URL
      const content = `[File](${data.fileUrl})`;
      await fetch('/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, group_id: currentGroupId }),
      });
      loadMessages();
    } else {
      alert('File upload failed');
    }
  } catch (err) {
    alert('File upload error');
  }
  fileInput.value = '';
});

// Voice note recording
btnRecord.addEventListener('click', () => {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
    btnRecord.classList.remove('text-red-600');
  } else {
    startRecording();
  }
});

function startRecording() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert('Media recording not supported');
    return;
  }
  navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
    mediaRecorder = new MediaRecorder(stream);
    recordedChunks = [];
    mediaRecorder.ondataavailable = e => {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };
    mediaRecorder.onstop = async () => {
      const blob = new Blob(recordedChunks, { type: 'audio/webm' });
      const formData = new FormData();
      formData.append('file', blob, 'voice_note.webm');
      try {
        const res = await fetch('/upload', {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();
        if (data.success) {
          const content = `[Voice Note](${data.fileUrl})`;
          await fetch('/message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, group_id: currentGroupId }),
          });
          loadMessages();
        } else {
          alert('Voice note upload failed');
        }
      } catch (err) {
        alert('Voice note upload error');
      }
    };
    mediaRecorder.start();
    btnRecord.classList.add('text-red-600');
  }).catch(() => {
    alert('Permission denied for microphone');
  });
}

// Socket.IO events
socket.on('new_message', (message) => {
  loadMessages();
});

socket.on('edit_message', (message) => {
  loadMessages();
});

socket.on('delete_message', (message) => {
  loadMessages();
});

// Backup chat button
btnBackup.addEventListener('click', () => {
  alert('Backup feature not implemented yet.');
});

// Search toggle
btnSearchToggle.addEventListener('click', () => {
  if (searchBar.classList.contains('hidden')) {
    searchBar.classList.remove('hidden');
    searchInput.focus();
  } else {
    searchBar.classList.add('hidden');
    searchInput.value = '';
    loadMessages();
  }
});

// Search input
searchInput.addEventListener('input', () => {
  // Implement search/filter logic here
  // For now, just reload messages
  loadMessages();
});

// Create group button
btnCreateGroup.addEventListener('click', () => {
  alert('Group creation not implemented yet.');
});

// Initialize app on load
window.onload = init;
