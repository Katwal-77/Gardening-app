
import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, ChatSession, ImagePart } from './types';
import { generateContent } from './services/gemini';
import { BotIcon, PlantIcon, SendIcon, UploadIcon, UserIcon, PlusIcon, TrashIcon, MenuIcon, CloseIcon, EditIcon, CheckIcon } from './components/Icons';
import { Spinner } from './components/Spinner';

// Renders user-provided text safely by escaping HTML and preserving line breaks.
const renderUserMessage = (content: string) => {
  const escapedContent = content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
  return escapedContent.replace(/\n/g, '<br />');
};

// Renders basic markdown from the model into HTML.
const renderMarkdown = (text: string) => {
  const lines = text.split('\n');
  let html = '';
  let inList = false;

  const processInlineFormatting = (str: string) => str.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  for (const line of lines) {
    // Headings
    if (line.startsWith('## ')) {
        if (inList) { html += '</ul>'; inList = false; }
        html += `<h2>${processInlineFormatting(line.substring(3))}</h2>`;
        continue;
    }

    // List items
    if (line.startsWith('* ')) {
        if (!inList) { html += '<ul>'; inList = true; }
        html += `<li>${processInlineFormatting(line.substring(2))}</li>`;
        continue;
    }

    // End of list on a non-list-item line
    if (inList) { html += '</ul>'; inList = false; }
    
    // Paragraphs for non-empty lines
    if (line.trim()) {
        html += `<p>${processInlineFormatting(line)}</p>`;
    }
  }

  if (inList) { html += '</ul>'; }
  
  return html;
};


interface MessageBubbleProps {
  message: ChatMessage;
  messageIndex: number;
  onStartEdit: (messageIndex: number) => void;
  isEditing: boolean;
  editingText: string;
  onEditingTextChange: (text: string) => void;
  onSaveEdit: () => Promise<void>;
  onCancelEdit: () => void;
  isLoading: boolean;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  messageIndex,
  onStartEdit,
  isEditing,
  editingText,
  onEditingTextChange,
  onSaveEdit,
  onCancelEdit,
  isLoading,
}) => {
  const isUser = message.role === 'user';
  const canBeEdited = isUser && typeof message.content === 'string';

  if (isEditing) {
    return (
      <div className="flex items-start gap-3 w-full max-w-2xl mx-auto flex-row-reverse">
        <div className="w-8 h-8 flex-shrink-0 bg-gray-800 rounded-full flex items-center justify-center mt-1">
          <UserIcon className="w-5 h-5 text-green-400" />
        </div>
        <div className="p-2 rounded-xl shadow-md bg-green-700/60 self-end flex-1 flex flex-col gap-2">
          <textarea
            value={editingText}
            onChange={(e) => onEditingTextChange(e.target.value)}
            className="w-full bg-green-800/50 text-white rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
            rows={Math.max(3, editingText.split('\n').length)}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <button onClick={onCancelEdit} disabled={isLoading} className="p-2 rounded-full hover:bg-gray-600/50 disabled:opacity-50">
              <CloseIcon className="w-5 h-5" />
            </button>
            <button onClick={onSaveEdit} disabled={isLoading} className="p-2 rounded-full bg-green-500 hover:bg-green-400 disabled:opacity-50">
              <CheckIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const Icon = isUser ? UserIcon : BotIcon;
  const bubbleClasses = isUser ? 'bg-green-700/60 self-end' : 'bg-gray-700/70 self-start';
  const flexClasses = isUser ? 'flex-row-reverse' : 'flex-row';

  return (
    <div className={`group flex items-start gap-3 w-full max-w-2xl mx-auto ${flexClasses}`}>
      <div className="w-8 h-8 flex-shrink-0 bg-gray-800 rounded-full flex items-center justify-center mt-1">
        <Icon className={`w-5 h-5 ${isUser ? 'text-green-400' : 'text-blue-400'}`} />
      </div>
      <div className={`relative p-4 rounded-xl shadow-md ${bubbleClasses}`}>
        {typeof message.content === 'string' ? (
          <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: isUser ? renderUserMessage(message.content) : renderMarkdown(message.content) }}></div>
        ) : (
          <div className="flex flex-col items-end gap-2">
            <p>{message.content.promptText}</p>
            <img src={message.content.imageUrl} alt="Uploaded plant" className="rounded-lg max-w-xs object-cover" />
          </div>
        )}
        {canBeEdited && !isLoading && (
          <button
            onClick={() => onStartEdit(messageIndex)}
            className="absolute top-1 right-1 p-1.5 rounded-full bg-gray-900/20 text-gray-300 opacity-0 group-hover:opacity-100 hover:bg-gray-900/40 hover:text-white transition-opacity"
            aria-label="Edit message"
          >
            <EditIcon className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

const HistorySidebar = ({ history, activeChatId, onSelectChat, onNewChat, onDeleteChat, isVisible, onClose }) => (
  <>
    <div className={`fixed inset-0 bg-black/60 z-30 md:hidden ${isVisible ? 'block' : 'hidden'}`} onClick={onClose}></div>
    <aside className={`absolute top-0 left-0 h-full w-64 bg-gray-800 text-gray-200 flex flex-col z-40 transform transition-transform md:relative md:translate-x-0 ${isVisible ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="p-4 flex justify-between items-center border-b border-gray-700">
        <h2 className="text-lg font-semibold">History</h2>
        <button onClick={onClose} className="md:hidden p-1 rounded-full hover:bg-gray-700">
          <CloseIcon className="w-6 h-6" />
        </button>
      </div>
      <div className="p-2">
        <button onClick={onNewChat} className="w-full flex items-center gap-2 p-2 rounded-lg text-left text-white bg-green-600 hover:bg-green-500 transition-colors">
          <PlusIcon className="w-5 h-5"/>
          New Chat
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto p-2 space-y-2">
        {history.map(chat => (
          <div key={chat.id} className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer ${activeChatId === chat.id ? 'bg-gray-700' : 'hover:bg-gray-700/50'}`} onClick={() => onSelectChat(chat.id)}>
            <span className="truncate flex-1">{chat.title}</span>
            <button onClick={(e) => { e.stopPropagation(); onDeleteChat(chat.id); }} className="p-1 rounded-full text-gray-400 opacity-0 group-hover:opacity-100 hover:text-white hover:bg-gray-600">
              <TrashIcon className="w-4 h-4" />
            </button>
          </div>
        ))}
      </nav>
    </aside>
  </>
);

const App: React.FC = () => {
  const [history, setHistory] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [editingState, setEditingState] = useState<{ chatId: string; messageIndex: number; text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load from local storage on mount
  useEffect(() => {
    try {
      const storedHistory = localStorage.getItem('chatHistory');
      const storedActiveId = localStorage.getItem('activeChatId');
      if (storedHistory) {
        const parsedHistory = JSON.parse(storedHistory);
        setHistory(parsedHistory);
        setActiveChatId(storedActiveId ? JSON.parse(storedActiveId) : (parsedHistory[0]?.id || null));
      }
    } catch (error) {
      console.error("Failed to load from local storage", error);
    }
  }, []);

  // Save to local storage on change
  useEffect(() => {
    try {
      localStorage.setItem('chatHistory', JSON.stringify(history));
      localStorage.setItem('activeChatId', JSON.stringify(activeChatId));
    } catch (error) {
      console.error("Failed to save to local storage", error);
    }
  }, [history, activeChatId]);


  useEffect(() => {
    if (!isLoading) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [history, activeChatId, isLoading]);

  const messages = history.find(chat => chat.id === activeChatId)?.messages ?? [];
  
  const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleNewChat = () => {
    const newChatId = `chat_${Date.now()}`;
    const newChat: ChatSession = { id: newChatId, title: 'New Chat', messages: [] };
    setHistory(prev => [newChat, ...prev]);
    setActiveChatId(newChatId);
    setSidebarOpen(false);
  };

  const handleSelectChat = (id: string) => {
    setActiveChatId(id);
    setSidebarOpen(false);
  };

  const handleDeleteChat = (idToDelete: string) => {
    if (window.confirm('Are you sure you want to delete this chat?')) {
      const updatedHistory = history.filter(chat => chat.id !== idToDelete);
      setHistory(updatedHistory);
      if (activeChatId === idToDelete) {
        setActiveChatId(updatedHistory[0]?.id || null);
      }
    }
  };

  const addMessageToApiCall = async (prompt: string, imagePart?: ImagePart) => {
    setIsLoading(true);
    try {
      const responseText = await generateContent(prompt, imagePart);
      const modelMessage: ChatMessage = { role: 'model', content: responseText };
      setHistory(prev => prev.map(chat => 
        chat.id === activeChatId
        ? { ...chat, messages: [...chat.messages, modelMessage] }
        : chat
      ));
    } catch (error) {
      const errorMessage: ChatMessage = { role: 'model', content: 'An error occurred. Please try again.' };
      setHistory(prev => prev.map(chat =>
        chat.id === activeChatId
        ? { ...chat, messages: [...chat.messages, errorMessage] }
        : chat
      ));
    } finally {
      setIsLoading(false);
    }
  }

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', content: input };
    const currentInput = input;
    setInput('');
    
    let currentChatId = activeChatId;
    if (!currentChatId) {
      currentChatId = `chat_${Date.now()}`;
      const newChat: ChatSession = { 
        id: currentChatId, 
        title: currentInput.substring(0, 35) + (currentInput.length > 35 ? '...' : ''), 
        messages: [userMessage] 
      };
      setHistory(prev => [newChat, ...prev]);
      setActiveChatId(currentChatId);
    } else {
      setHistory(prev => prev.map(chat => 
        chat.id === currentChatId 
        ? { ...chat, messages: [...chat.messages, userMessage] } 
        : chat
      ));
    }
    
    await addMessageToApiCall(currentInput);
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || isLoading) return;

    const dataUrl = await fileToDataUrl(file);
    const base64Data = dataUrl.split(',')[1];
    const imagePart: ImagePart = { mimeType: file.type, data: base64Data };

    const prompt = 'Identify this plant and provide detailed care instructions including watering, sunlight, soil, and fertilizer needs. Format the response with clear headings.';
    const userMessage: ChatMessage = {
      role: 'user',
      content: { promptText: 'Analyze this plant:', imageUrl: dataUrl },
    };

    let currentChatId = activeChatId;
    if (!currentChatId || history.find(c => c.id === currentChatId)?.messages.length === 0) {
        currentChatId = `chat_${Date.now()}`;
        const newChat: ChatSession = { 
            id: currentChatId, 
            title: "Plant Analysis", 
            messages: [userMessage] 
        };

        if (activeChatId && history.find(c => c.id === activeChatId)?.messages.length === 0) {
          // Replace the empty "New Chat"
          setHistory(prev => [newChat, ...prev.filter(c => c.id !== activeChatId)]);
        } else {
          setHistory(prev => [newChat, ...prev]);
        }
        setActiveChatId(currentChatId);
    } else {
        setHistory(prev => prev.map(chat => 
            chat.id === currentChatId 
            ? { ...chat, messages: [...chat.messages, userMessage] } 
            : chat
        ));
    }
    
    await addMessageToApiCall(prompt, imagePart);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleStartEdit = (messageIndex: number) => {
    if (!activeChatId) return;
    const messageToEdit = messages[messageIndex];
    if (typeof messageToEdit.content === 'string') {
      setEditingState({
        chatId: activeChatId,
        messageIndex,
        text: messageToEdit.content,
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingState(null);
  };

  const handleSaveEdit = async () => {
    if (!editingState) return;

    const { chatId, messageIndex, text } = editingState;
    
    setIsLoading(true);
    setEditingState(null);

    const truncatedMessages = history.find(c => c.id === chatId)?.messages.slice(0, messageIndex) || [];
    const updatedUserMessage: ChatMessage = { role: 'user', content: text };
    
    setHistory(prev => prev.map(chat => 
        chat.id === chatId 
        ? { ...chat, messages: [...truncatedMessages, updatedUserMessage] } 
        : chat
    ));

    try {
      const responseText = await generateContent(text);
      const modelMessage: ChatMessage = { role: 'model', content: responseText };
      setHistory(prev => prev.map(chat => 
        chat.id === chatId
        ? { ...chat, messages: [...chat.messages, modelMessage] }
        : chat
      ));
    } catch (error) {
      console.error("Error regenerating content after edit:", error);
      const errorMessage: ChatMessage = { role: 'model', content: 'An error occurred while regenerating the response.' };
      setHistory(prev => prev.map(chat =>
        chat.id === chatId
        ? { ...chat, messages: [...chat.messages, errorMessage] }
        : chat
      ));
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="flex h-screen bg-gray-900 text-gray-200 font-sans">
      <HistorySidebar 
        history={history} 
        activeChatId={activeChatId} 
        onSelectChat={handleSelectChat}
        onNewChat={handleNewChat}
        onDeleteChat={handleDeleteChat}
        isVisible={isSidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex flex-col flex-1 h-screen">
        <header className="flex items-center justify-center p-4 border-b border-gray-700 shadow-lg bg-gray-800/50 backdrop-blur-sm relative">
          <button onClick={() => setSidebarOpen(true)} className="absolute left-4 p-2 md:hidden rounded-full hover:bg-gray-700">
            <MenuIcon className="w-6 h-6"/>
          </button>
          <div className="flex items-center">
            <PlantIcon className="w-8 h-8 text-green-400 mr-3" />
            <h1 className="text-2xl font-bold tracking-wider text-green-400">Gardening Assistant</h1>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="flex flex-col gap-6">
            {messages.length === 0 && !isLoading && (
                <div className="text-center text-gray-400 mt-8">
                    <p>Welcome! Upload a picture of a plant to get started.</p>
                    <p className="text-sm">Or ask me any gardening question.</p>
                </div>
            )}
            {messages.map((msg, index) => (
              <MessageBubble 
                key={`${activeChatId}-${index}`} 
                message={msg}
                messageIndex={index}
                onStartEdit={handleStartEdit}
                isEditing={editingState?.chatId === activeChatId && editingState?.messageIndex === index}
                editingText={editingState?.text ?? ''}
                onEditingTextChange={(text) => setEditingState(prev => prev ? {...prev, text} : null)}
                onSaveEdit={handleSaveEdit}
                onCancelEdit={handleCancelEdit}
                isLoading={isLoading}
              />
            ))}
            {isLoading && !editingState && (
              <div className="flex items-start gap-3 w-full max-w-2xl mx-auto flex-row">
                  <div className="w-8 h-8 flex-shrink-0 bg-gray-800 rounded-full flex items-center justify-center mt-1">
                      <BotIcon className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="p-4 rounded-xl shadow-md bg-gray-700/70 self-start">
                      <Spinner />
                  </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </main>

        <footer className="p-4 bg-gray-800/50 border-t border-gray-700 backdrop-blur-sm">
          <div className="max-w-3xl mx-auto flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
              id="image-upload"
              disabled={isLoading}
            />
            <label htmlFor="image-upload">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className="p-3 bg-gray-700 rounded-full text-gray-400 hover:bg-gray-600 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Upload Image"
              >
                <UploadIcon className="w-6 h-6" />
              </button>
            </label>
            <div className="flex-1 relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Ask about your plant..."
                className="w-full bg-gray-700 text-white rounded-full py-3 pl-5 pr-14 focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
                disabled={isLoading}
              />
              <button
                onClick={handleSendMessage}
                disabled={isLoading || !input.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-green-600 rounded-full text-white hover:bg-green-500 transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed"
                aria-label="Send Message"
              >
                <SendIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default App;
