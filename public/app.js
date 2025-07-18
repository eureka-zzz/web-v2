const socket = io();

let currentUser = null;
let currentGroupId = null;
let currentChatUserId = null; // For private chat
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
const btnProfile = document.getElementById('btnProfile');

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
    await loadGroups();
    await loadContacts();
    loadDraft();
    setupSocketListeners();
  } catch (err) {
    console.error('Failed to initialize:', err);
    window.location.href = '/login.html';
  }
}

// Setup Socket.IO event listeners
function setupSocketListeners() {
  socket.on('new_message', (message) => {
    if (currentChatUserId) {
      // Private chat
      if ((message.user_id === currentUser.id && message.receiver_id === currentChatUserId) ||
          (message.user_id === currentChatUserId && message.receiver_id === currentUser.id)) {
        const msgElement = createMessageElement(message);
        messagesContainer.appendChild(msgElement);
        scrollToBottom();
      }
    } else if (currentGroupId) {
      // Group chat
      if (message.group_id === currentGroupId) {
        const msgElement = createMessageElement(message);
        messagesContainer.appendChild(msgElement);
        scrollToBottom();
      }
    } else {
      // General chat
      if (!message.group_id && !message.receiver_id) {
        const msgElement = createMessageElement(message);
        messagesContainer.appendChild(msgElement);
        scrollToBottom();
      }
    }
  });

  socket.on('edit_message', (message) => {
    const msgElement = document.querySelector(`[data-id="${message.id}"]`);
    if (msgElement) {
      const newMsgElement = createMessageElement(message);
      msgElement.replaceWith(newMsgElement);
    }
  });

  socket.on('delete_message', ({ id }) => {
    const msgElement = document.querySelector(`[data-id="${id}"]`);
    if (msgElement) msgElement.remove();
  });
}

// Load groups from server
async function loadGroups() {
  try {
    const res = await fetch('/groups');
    const groups = await res.json();
    
    groupList.innerHTML = '';
    
    // Add General Chat first
    const generalChat = document.createElement('div');
    generalChat.textContent = 'General Chat';
    generalChat.className = 'p-2 rounded cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-700';
    generalChat.addEventListener('click', () => {
      currentGroupId = null;
      currentChatUserId = null;
      chatTitle.textContent = 'General Chat';
      loadMessages();
    });
    groupList.appendChild(generalChat);

    // Add other groups
    groups.forEach(group => {
      const groupItem = document.createElement('div');
      groupItem.textContent = group.name;
      groupItem.className = 'p-2 rounded cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-700';
      groupItem.addEventListener('click', () => {
        currentGroupId = group.id;
        currentChatUserId = null;
        chatTitle.textContent = group.name;
        loadMessages();
      });
      groupList.appendChild(groupItem);
    });

    // Select General Chat by default
    currentGroupId = null;
    chatTitle.textContent = 'General Chat';
    await loadMessages();
  } catch (err) {
    console.error('Failed to load groups:', err);
  }
}

// Load contacts (users) for private chat
async function loadContacts() {
  try {
    const res = await fetch('/users');
    const users = await res.json();
    const contactsContainer = document.getElementById('contactsList');
    if (!contactsContainer) return;
    contactsContainer.innerHTML = '';

    users.forEach(user => {
      if (user.id === currentUser.id) return; // Skip self
      const userItem = document.createElement('div');
      userItem.className = 'p-2 rounded cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-700 flex items-center gap-2';
      userItem.addEventListener('click', () => {
        currentChatUserId = user.id;
        currentGroupId = null;
        chatTitle.textContent = user.username;
        loadMessages();
      });

      const avatar = document.createElement('img');
      avatar.src = user.profilePic || 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg';
      avatar.alt = user.username;
      avatar.className = 'w-8 h-8 rounded-full object-cover';
      userItem.appendChild(avatar);

      const usernameSpan = document.createElement('span');
      usernameSpan.textContent = user.username;
      userItem.appendChild(usernameSpan);

      contactsContainer.appendChild(userItem);
    });
  } catch (err) {
    console.error('Failed to load contacts:', err);
  }
}

// Load messages from server
async function loadMessages() {
  try {
    let url;
    if (currentChatUserId) {
      url = `/messages/search?privateChatUser=${currentChatUserId}&q=`;
    } else if (currentGroupId) {
      url = `/messages/${currentGroupId}`;
    } else {
      url = '/messages';
    }
    const res = await fetch(url);
    const messages = await res.json();
    
    messagesContainer.innerHTML = '';
    messages.forEach(message => {
      const msgElement = createMessageElement(message);
      messagesContainer.appendChild(msgElement);
    });
    scrollToBottom();
  } catch (err) {
    console.error('Failed to load messages:', err);
  }
}

// Create message DOM element
function createMessageElement(message) {
  const div = document.createElement('div');
  div.className = `message p-3 rounded ${message.user_id === currentUser.id ? 'ml-auto bg-blue-100 dark:bg-blue-900' : 'bg-gray-100 dark:bg-gray-800'} max-w-xl mb-2`;
  div.dataset.id = message.id;

  const header = document.createElement('div');
  header.className = 'flex justify-between items-center mb-1';
  
  const username = document.createElement('span');
  username.className = 'font-semibold text-sm cursor-pointer';
  username.textContent = message.username || 'Unknown User';
  username.onclick = () => openUserProfile(message.user_id);
  header.appendChild(username);

  const timestamp = document.createElement('span');
  timestamp.className = 'text-xs text-gray-500 dark:text-gray-400';
  timestamp.textContent = new Date(message.created_at).toLocaleTimeString();
  header.appendChild(timestamp);

  div.appendChild(header);

  const content = document.createElement('p');
  content.className = 'break-words';
  
  // Check if content is a file or voice note
  if (message.content.startsWith('[File]') || message.content.startsWith('[Voice Note]')) {
    const url = message.content.match(/\((.*?)\)/)[1];
    if (message.content.startsWith('[Voice Note]')) {
      const audio = document.createElement('audio');
      audio.controls = true;
      audio.src = url;
      content.appendChild(audio);
    } else {
      const link = document.createElement('a');
      link.href = url;
      link.textContent = 'Download File';
      link.className = 'text-blue-500 hover:text-blue-700';
      content.appendChild(link);
    }
  } else {
    content.textContent = message.content;
  }
  div.appendChild(content);

  if (message.edited) {
    const editedLabel = document.createElement('span');
    editedLabel.textContent = ' (edited)';
    editedLabel.className = 'text-xs italic text-gray-500 dark:text-gray-400';
    div.appendChild(editedLabel);
  }

  // Add edit/delete buttons for own messages
  if (message.user_id === currentUser.id || currentUser.role === 'admin') {
    const actions = document.createElement('div');
    actions.className = 'flex gap-2 mt-1';
    
    const editBtn = document.createElement('button');
    editBtn.className = 'text-xs text-blue-500 hover:text-blue-700';
    editBtn.textContent = 'Edit';
    editBtn.onclick = () => editMessage(message);
    actions.appendChild(editBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'text-xs text-red-500 hover:text-red-700';
    deleteBtn.textContent = 'Delete';
    deleteBtn.onclick = () => deleteMessage(message.id);
    actions.appendChild(deleteBtn);

    div.appendChild(actions);
  }

  return div;
}

// Open user profile modal
async function openUserProfile(userId) {
  try {
    const res = await fetch(`/user/${userId}`);
    if (!res.ok) throw new Error('Failed to fetch user profile');
    const user = await res.json();

    modalContent.innerHTML = `
      <div class="flex flex-col items-center">
        <img src="${user.profilePic || 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg'}" alt="${user.username}" class="w-24 h-24 rounded-full object-cover mb-4" />
        <h2 class="text-xl font-semibold mb-2">${user.username}</h2>
        <p class="text-gray-600 dark:text-gray-400 mb-4">${user.bio || 'No bio available.'}</p>
        <button id="btnStartPrivateChat" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">Start Private Chat</button>
        <button id="btnCloseModal" class="mt-4 text-gray-600 hover:text-gray-900 dark:hover:text-white">Close</button>
      </div>
    `;

    document.getElementById('btnStartPrivateChat').onclick = () => {
      currentChatUserId = user.id;
      currentGroupId = null;
      chatTitle.textContent = user.username;
      loadMessages();
      closeModal();
    };

    document.getElementById('btnCloseModal').onclick = closeModal;

    modalOverlay.classList.remove('hidden');
    modalOverlay.classList.add('flex');
  } catch (err) {
    alert(err.message);
  }
}

// Open profile update modal
function openProfileUpdateModal() {
  modalContent.innerHTML = `
    <h2 class="text-xl font-semibold mb-4">Update Profile</h2>
    <form id="profileUpdateForm" class="space-y-4">
      <div>
        <label for="profilePicInput" class="block mb-1">Profile Picture</label>
        <input type="file" id="profilePicInput" accept="image/*" />
      </div>
      <div>
        <label for="bioInput" class="block mb-1">Bio</label>
        <textarea id="bioInput" rows="4" class="w-full p-2 border rounded" placeholder="Enter your bio"></textarea>
      </div>
      <div class="flex justify-end gap-2">
        <button type="button" id="btnCancelProfileUpdate" class="px-4 py-2 text-gray-600 hover:text-gray-900">Cancel</button>
        <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Save</button>
      </div>
    </form>
  `;

  // Load current bio
  fetch('/me').then(res => res.json()).then(data => {
    document.getElementById('bioInput').value = data.user.bio || '';
  });

  document.getElementById('btnCancelProfileUpdate').onclick = closeModal;

  document.getElementById('profileUpdateForm').onsubmit = async (e) => {
    e.preventDefault();
    const bio = document.getElementById('bioInput').value;
    const profilePicFile = document.getElementById('profilePicInput').files[0];

    const formData = new FormData();
    formData.append('bio', bio);
    if (profilePicFile) {
      formData.append('profilePic', profilePicFile);
    }

    try {
      const res = await fetch('/profile', {
        method: 'PUT',
        body: formData
      });
      if (!res.ok) throw new Error('Failed to update profile');
      const data = await res.json();
      currentUser = data.user;
      alert('Profile updated successfully');
      closeModal();
      loadContacts();
      loadMessages();
    } catch (err) {
      alert(err.message);
    }
  };

  modalOverlay.classList.remove('hidden');
  modalOverlay.classList.add('flex');
}

// Close modal
function closeModal() {
  modalOverlay.classList.add('hidden');
  modalOverlay.classList.remove('flex');
}

// Profile button event
if (btnProfile) {
  btnProfile.addEventListener('click', openProfileUpdateModal);
}

// Edit message
function editMessage(message) {
  isEditingMessageId = message.id;
  messageInput.value = message.content;
  messageInput.focus();
  btnSend.textContent = 'Update';
}

// Delete message
async function deleteMessage(messageId) {
  if (!confirm('Are you sure you want to delete this message?')) return;
  
  try {
    const res = await fetch(`/message/${messageId}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete message');
    loadMessages();
  } catch (err) {
    alert(err.message);
  }
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

  try {
    if (isEditingMessageId) {
      // Edit message
      const res = await fetch(`/message/${isEditingMessageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error('Failed to edit message');
      isEditingMessageId = null;
      btnSend.textContent = 'Send';
    } else {
      // Send new message
      const messageData = {
        content,
        group_id: currentGroupId,
        receiver_id: currentChatUserId
      };

      const res = await fetch('/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messageData),
      });
      if (!res.ok) throw new Error('Failed to send message');
    }
    messageInput.value = '';
    localStorage.removeItem(draftKey);
    loadMessages();
  } catch (err) {
    alert(err.message);
  }
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

// Create group
btnCreateGroup.addEventListener('click', () => {
  modalOverlay.classList.remove('hidden');
  modalOverlay.classList.add('flex');
  modalContent.innerHTML = `
    <h2 class="text-xl font-bold mb-4">Create New Group</h2>
    <form id="createGroupForm" class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Group Name</label>
        <input type="text" id="groupName" required class="w-full px-3 py-2 border rounded-md">
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea id="groupDesc" class="w-full px-3 py-2 border rounded-md"></textarea>
      </div>
      <div class="flex justify-end gap-2">
        <button type="button" onclick="closeModal()" class="px-4 py-2 text-gray-600 hover:text-gray-800">Cancel</button>
        <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Create</button>
      </div>
    </form>
  `;

  document.getElementById('createGroupForm').onsubmit = async (e) => {
    e.preventDefault();
    const name = document.getElementById('groupName').value;
    const description = document.getElementById('groupDesc').value;

    try {
      const res = await fetch('/group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
      });
      if (!res.ok) throw new Error('Failed to create group');
      closeModal();
      loadGroups();
    } catch (err) {
      alert(err.message);
    }
  };
});

// Close modal
window.closeModal = function() {
  modalOverlay.classList.add('hidden');
  modalOverlay.classList.remove('flex');
};

// Attach file
btnAttach.addEventListener('click', () => {
  fileInput.click();
});

// File upload
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
    if (!data.success) throw new Error('Upload failed');

    // Send message with file URL
    await fetch('/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: `[File](${data.fileUrl})`,
        group_id: currentGroupId,
        receiver_id: currentChatUserId
      }),
    });
    loadMessages();
  } catch (err) {
    alert('File upload failed: ' + err.message);
  }
  fileInput.value = '';
});

// Voice recording
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
    alert('Voice recording is not supported in your browser');
    return;
  }

  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
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
          if (!data.success) throw new Error('Upload failed');

          await fetch('/message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: `[Voice Note](${data.fileUrl})`,
              group_id: currentGroupId,
              receiver_id: currentChatUserId
            }),
          });
          loadMessages();
        } catch (err) {
          alert('Voice note upload failed: ' + err.message);
        }

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      btnRecord.classList.add('text-red-600');
    })
    .catch(err => {
      alert('Could not access microphone: ' + err.message);
    });
}

// Search messages
searchInput.addEventListener('input', debounce(async () => {
  const query = searchInput.value.trim();
  if (!query) {
    loadMessages();
    return;
  }

  try {
    let url;
    if (currentChatUserId) {
      url = `/messages/search?privateChatUser=${currentChatUserId}&q=${query}`;
    } else if (currentGroupId) {
      url = `/messages/search?group=${currentGroupId}&q=${query}`;
    } else {
      url = `/messages/search?q=${query}`;
    }
    
    const res = await fetch(url);
    const messages = await res.json();
    
    messagesContainer.innerHTML = '';
    messages.forEach(message => {
      const msgElement = createMessageElement(message);
      messagesContainer.appendChild(msgElement);
    });
  } catch (err) {
    console.error('Search failed:', err);
  }
}, 300));

// Backup chat
btnBackup.addEventListener('click', async () => {
  try {
    const res = await fetch('/backup');
    const data = await res.json();
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    alert('Backup failed: ' + err.message);
  }
});

// Toggle search bar
btnSearchToggle.addEventListener('click', () => {
  searchBar.classList.toggle('hidden');
  if (!searchBar.classList.contains('hidden')) {
    searchInput.focus();
  }
});

// Utility function for debouncing
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Initialize app
document.addEventListener('DOMContentLoaded', init);
