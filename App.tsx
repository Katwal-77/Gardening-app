

import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, ChatSession, ImagePart, WeatherData, CalendarTask, Reminder, GardenGrid, PlantIdentificationContent } from './types';
import { generateContent } from './services/gemini';
import { BotIcon, PlantIcon, SendIcon, UploadIcon, UserIcon, PlusIcon, TrashIcon, MenuIcon, CloseIcon, EditIcon, CheckIcon, ExportIcon, LocationMarkerIcon, CloudIcon, SunIcon, CloudRainIcon, SnowIcon, LightningBoltIcon, CalendarIcon, BellIcon, LayoutIcon } from './components/Icons';
import { TypingIndicator } from './components/Spinner';

// Make TS aware of the jsPDF global object from the script tag
declare global {
  interface Window {
    jspdf: any;
  }
}

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

// Maps WMO weather codes to icons and descriptions.
// FIX: Changed JSX.Element to React.ReactElement to resolve "Cannot find namespace 'JSX'" error.
const getWeatherInfo = (code: number): { icon: React.ReactElement; description: string } => {
  const iconClass = "w-5 h-5";
  if (code === 0) return { icon: <SunIcon className={iconClass} />, description: "Clear sky" };
  if ([1, 2, 3].includes(code)) return { icon: <CloudIcon className={iconClass} />, description: "Cloudy" };
  if ([45, 48].includes(code)) return { icon: <CloudIcon className={iconClass} />, description: "Fog" };
  if ([51, 53, 55, 56, 57].includes(code)) return { icon: <CloudRainIcon className={iconClass} />, description: "Drizzle" };
  if ([61, 63, 65, 66, 67].includes(code)) return { icon: <CloudRainIcon className={iconClass} />, description: "Rain" };
  if ([71, 73, 75, 77].includes(code)) return { icon: <SnowIcon className={iconClass} />, description: "Snow" };
  if ([80, 81, 82].includes(code)) return { icon: <CloudRainIcon className={iconClass} />, description: "Rain showers" };
  if ([95, 96, 99].includes(code)) return { icon: <LightningBoltIcon className={iconClass} />, description: "Thunderstorm" };
  return { icon: <CloudIcon className={iconClass} />, description: "Cloudy" };
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
  onSetReminder: (plantName?: string) => void;
  isLastModelMessage: boolean;
  onIdentificationFeedback: (messageIndex: number, feedback: 'correct' | 'incorrect', correctedName?: string) => void;
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
  onSetReminder,
  isLastModelMessage,
  onIdentificationFeedback,
}) => {
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [correctionInput, setCorrectionInput] = useState('');

  const isUser = message.role === 'user';
  const canBeEdited = isUser && typeof message.content === 'string';

  if (isEditing) {
    return (
      <div className="flex items-start gap-3 w-full max-w-2xl mx-auto flex-row-reverse animate-fade-in-up">
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
  
  const isIdentificationMessage = message.role === 'model' && typeof message.content === 'object' && 'type' in message.content && message.content.type === 'plantIdentification';

  const handleFeedback = (feedback: 'correct' | 'incorrect') => {
    if (feedback === 'correct') {
      onIdentificationFeedback(messageIndex, 'correct');
    } else {
      setIsCorrecting(true);
    }
  };
  
  const handleCorrectionSubmit = () => {
    if (correctionInput.trim()) {
      onIdentificationFeedback(messageIndex, 'incorrect', correctionInput.trim());
      setIsCorrecting(false);
      setCorrectionInput('');
    }
  };


  return (
    <div className={`group flex items-start gap-3 w-full max-w-2xl mx-auto ${flexClasses} animate-fade-in-up`}>
      <div className="w-8 h-8 flex-shrink-0 bg-gray-800 rounded-full flex items-center justify-center mt-1">
        <Icon className={`w-5 h-5 ${isUser ? 'text-green-400' : 'text-blue-400'}`} />
      </div>
      <div className={`relative p-4 rounded-xl shadow-md ${bubbleClasses}`}>
        {isIdentificationMessage ? (() => {
            const { plantName, confidence, careInstructions, userFeedback, correctedName } = message.content as PlantIdentificationContent;
            return (
              <div className="w-full">
                <p className="mb-2">I believe this is a <strong>{plantName}</strong>.</p>
                <div className="w-full bg-gray-600 rounded-full h-2.5 mb-1">
                  <div className="bg-green-500 h-2.5 rounded-full" style={{ width: `${confidence}%` }}></div>
                </div>
                <p className="text-xs text-gray-400 text-right mb-4">{confidence}% confidence</p>
                
                {!userFeedback ? (
                  <div className="bg-gray-800/50 p-3 rounded-lg mb-4">
                    {!isCorrecting ? (
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold">Is this identification correct?</p>
                        <div className="flex gap-2">
                          <button onClick={() => handleFeedback('correct')} className="px-3 py-1 text-xs rounded-full bg-green-600 hover:bg-green-500">Yes</button>
                          <button onClick={() => handleFeedback('incorrect')} className="px-3 py-1 text-xs rounded-full bg-gray-600 hover:bg-gray-500">No</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <p className="text-sm font-semibold">What is the correct plant name?</p>
                        <input 
                          type="text"
                          value={correctionInput}
                          onChange={(e) => setCorrectionInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleCorrectionSubmit()}
                          placeholder="e.g., Monstera Deliciosa"
                          className="w-full bg-gray-700 text-white rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                          autoFocus
                        />
                        <div className="flex justify-end gap-2">
                          <button onClick={() => setIsCorrecting(false)} className="px-3 py-1 text-xs rounded-full bg-gray-600 hover:bg-gray-500">Cancel</button>
                          <button onClick={handleCorrectionSubmit} className="px-3 py-1 text-xs rounded-full bg-green-600 hover:bg-green-500">Submit</button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                   <div className="bg-gray-800/50 p-3 rounded-lg mb-4 text-sm text-green-400 flex items-center gap-2">
                      <CheckIcon className="w-5 h-5" />
                      {userFeedback === 'correct' 
                          ? <p>Identification confirmed. Thanks for the feedback!</p> 
                          : <p>Identification corrected to <strong>{correctedName}</strong>. Thanks!</p>}
                   </div>
                )}
                
                <hr className="border-gray-600 my-4" />
                <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: renderMarkdown(careInstructions) }}></div>
              </div>
            );
          })() : typeof message.content === 'string' ? (
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
        
        {!isUser && !isLoading && (
          <>
            {isIdentificationMessage && (
               <button
                onClick={() => onSetReminder((message.content as PlantIdentificationContent).plantName)}
                className="absolute -bottom-3 right-2 p-1.5 rounded-full bg-gray-600 text-gray-300 opacity-0 group-hover:opacity-100 hover:bg-blue-500 hover:text-white transition-all"
                aria-label="Set watering reminder"
                title="Set watering reminder"
              >
                <BellIcon className="w-4 h-4" />
              </button>
            )}
            {isLastModelMessage && !isIdentificationMessage && (
               <button
                onClick={() => onSetReminder()}
                className="absolute -bottom-3 right-2 p-1.5 rounded-full bg-gray-600 text-gray-300 opacity-0 group-hover:opacity-100 hover:bg-blue-500 hover:text-white transition-all"
                aria-label="Set watering reminder"
                title="Set watering reminder"
              >
                <BellIcon className="w-4 h-4" />
              </button>
            )}
          </>
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

const WeatherWidget = ({ weather, error }: { weather: WeatherData | null, error: string | null }) => {
  if (error) {
    return (
      <div className="flex items-center gap-2 text-sm text-yellow-400" title={error}>
        <LocationMarkerIcon className="w-5 h-5" />
        <span>Weather N/A</span>
      </div>
    );
  }

  if (!weather) {
    return <div className="text-sm text-gray-400">Fetching weather...</div>;
  }

  const { icon } = getWeatherInfo(weather.weatherCode);
  
  return (
    <div className="flex items-center gap-2 text-sm">
      {icon}
      <span>{Math.round(weather.temperature)}°C</span>
    </div>
  );
};

const CalendarPanel = ({
  isOpen,
  onClose,
  tasks,
  isLoading,
  error,
}: {
  isOpen: boolean;
  onClose: () => void;
  tasks: CalendarTask[] | null;
  isLoading: boolean;
  error: string | null;
}) => {
  if (!isOpen) return null;

  const groupedTasks = tasks?.reduce((acc, task) => {
    (acc[task.plant] = acc[task.plant] || []).push(task);
    return acc;
  }, {} as Record<string, CalendarTask[]>);

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose}></div>
      <div className="fixed top-0 right-0 h-full w-full max-w-md bg-gray-800 text-gray-200 flex flex-col z-50 shadow-2xl transform transition-transform translate-x-0">
        <div className="p-4 flex justify-between items-center border-b border-gray-700">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-green-400" />
            Your Gardening Calendar
          </h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-700">
            <CloseIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex justify-center items-center h-full">
              <div className="flex flex-col items-center gap-2 text-gray-400">
                <TypingIndicator />
                <p>Generating your personalized calendar...</p>
              </div>
            </div>
          ) : error ? (
            <div className="text-center text-yellow-400 p-4 bg-yellow-900/30 rounded-lg">{error}</div>
          ) : !tasks || tasks.length === 0 ? (
            <div className="text-center text-gray-400 mt-8">
              <p>No tasks found.</p>
              <p className="text-sm">Identify some plants in your chats to get personalized tasks.</p>
            </div>
          ) : (
            <div className="space-y-6">
              <p className="text-sm text-gray-400 italic">Here are your suggested gardening tasks for the next month.</p>
              {groupedTasks && Object.entries(groupedTasks).map(([plant, plantTasks]) => (
                <div key={plant} className="bg-gray-700/50 rounded-lg p-4">
                  <h3 className="text-lg font-bold text-green-400 mb-2">{plant}</h3>
                  <ul className="space-y-3">
                    {plantTasks.map((task, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <div className="w-1.5 h-1.5 bg-green-400 rounded-full mt-2 flex-shrink-0"></div>
                        <div>
                          <p className="text-gray-200">{task.task}</p>
                          <p className="text-xs text-gray-400 font-medium">{task.timing}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

const RemindersPanel = ({
  isOpen,
  onClose,
  reminders,
  onDelete,
  notificationPermission,
  onRequestPermission,
}) => {
  if (!isOpen) return null;

  const getDueDateText = (dueDate) => {
    const now = new Date();
    const due = new Date(dueDate);
    const timeString = due.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

    // Reset time part for date comparison
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDay = new Date(dueDate);
    dueDay.setHours(0, 0, 0, 0);

    const diffTime = dueDay.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return `Overdue (was due at ${timeString})`;
    if (diffDays === 0) return `Due today at ${timeString}`;
    if (diffDays === 1) return `Due tomorrow at ${timeString}`;
    return `Due in ${diffDays} days at ${timeString}`;
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose}></div>
      <div className="fixed top-0 right-0 h-full w-full max-w-sm bg-gray-800 text-gray-200 flex flex-col z-50 shadow-2xl">
        <div className="p-4 flex justify-between items-center border-b border-gray-700">
          <h2 className="text-xl font-semibold flex items-center gap-2"><BellIcon className="w-6 h-6 text-green-400" /> Watering Reminders</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-700"><CloseIcon className="w-6 h-6" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="p-3 bg-gray-700/50 rounded-lg">
            <h3 className="font-semibold mb-2">Notification Status</h3>
            {notificationPermission === 'granted' && <p className="text-sm text-green-400">Notifications are enabled.</p>}
            {notificationPermission === 'denied' && <p className="text-sm text-yellow-400">Notifications are disabled. You can enable them in your browser settings.</p>}
            {notificationPermission === 'default' && (
              <div>
                <p className="text-sm text-gray-400 mb-2">Enable notifications to get alerts.</p>
                <button onClick={onRequestPermission} className="w-full text-sm bg-blue-600 hover:bg-blue-500 rounded-md py-2">Enable Notifications</button>
              </div>
            )}
          </div>
          {reminders.length === 0 ? (
            <p className="text-center text-gray-400 pt-8">No reminders set.</p>
          ) : (
            reminders.sort((a,b) => a.nextDueDate - b.nextDueDate).map(reminder => (
              <div key={reminder.id} className="bg-gray-700/50 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="font-semibold">{reminder.plantName}</p>
                  <p className="text-sm text-gray-400">{getDueDateText(reminder.nextDueDate)}</p>
                </div>
                <button onClick={() => onDelete(reminder.id)} className="p-2 rounded-full hover:bg-gray-600"><TrashIcon className="w-5 h-5" /></button>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
};

const ReminderModal = ({ isOpen, onClose, onSave, plantName }) => {
  const [frequency, setFrequency] = useState(7);
  const [time, setTime] = useState('09:00');
  if (!isOpen) return null;

  const handleSave = () => {
    onSave(frequency, time);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-sm">
        <h2 className="text-xl font-bold mb-2">Set Watering Reminder</h2>
        <p className="mb-4 text-gray-400">For: <span className="font-semibold text-green-400">{plantName}</span></p>
        <div className="space-y-4 mb-6">
          <div>
            <label htmlFor="frequency" className="block text-sm font-medium mb-1">Remind me every:</label>
            <select
              id="frequency"
              value={frequency}
              onChange={(e) => setFrequency(Number(e.target.value))}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value={1}>1 Day</option>
              <option value={3}>3 Days</option>
              <option value={7}>7 Days (1 Week)</option>
              <option value={14}>14 Days (2 Weeks)</option>
            </select>
          </div>
          <div>
            <label htmlFor="time" className="block text-sm font-medium mb-1">At this time:</label>
            <input
              type="time"
              id="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-500">Cancel</button>
          <button onClick={handleSave} className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500">Save Reminder</button>
        </div>
      </div>
    </div>
  );
};


const GardenPlannerPanel = ({
  isOpen,
  onClose,
  initialPalette,
}) => {
  const GRID_SIZE = 8;
  const [plantPalette, setPlantPalette] = useState<string[]>([]);
  const [gardenGrid, setGardenGrid] = useState<GardenGrid>(() => Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null)));
  const [newPlantInput, setNewPlantInput] = useState('');
  const [draggedItem, setDraggedItem] = useState<{ type: 'palette' | 'grid'; data: string; from?: { r: number; c: number } } | null>(null);
  
  const [suggestions, setSuggestions] = useState<string | null>(null);
  const [isSuggestionsLoading, setIsSuggestionsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPlantPalette(initialPalette);
    }
  }, [isOpen, initialPalette]);
  
  if (!isOpen) return null;

  const handleAddNewPlant = () => {
    if (newPlantInput && !plantPalette.includes(newPlantInput)) {
      setPlantPalette(prev => [...prev, newPlantInput]);
      setNewPlantInput('');
    }
  };

  const handleDragStart = (e: React.DragEvent, type: 'palette' | 'grid', data: string, from?: { r: number; c: number }) => {
    setDraggedItem({ type, data, from });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDropOnGrid = (e: React.DragEvent, r: number, c: number) => {
    e.preventDefault();
    if (!draggedItem) return;

    setGardenGrid(prevGrid => {
      const newGrid = prevGrid.map(row => [...row]);
      // If moving from another grid cell, clear the old cell
      if (draggedItem.from) {
        newGrid[draggedItem.from.r][draggedItem.from.c] = null;
      }
      // Place the plant in the new cell
      newGrid[r][c] = draggedItem.data;
      return newGrid;
    });
    setDraggedItem(null);
  };
  
  const handleDropOnTrash = (e: React.DragEvent) => {
     e.preventDefault();
     if (draggedItem?.type === 'grid' && draggedItem.from) {
        setGardenGrid(prevGrid => {
            const newGrid = prevGrid.map(row => [...row]);
            newGrid[draggedItem.from!.r][draggedItem.from!.c] = null;
            return newGrid;
        });
     }
     setDraggedItem(null);
  }

  const handleGetSuggestions = async () => {
    setIsSuggestionsLoading(true);
    setSuggestions(null);

    const gridString = gardenGrid.map(row => 
        row.map(cell => cell || 'empty').join(', ')
    ).join('\n');
    
    const plantsInGrid = [...new Set(gardenGrid.flat().filter(Boolean))];

    if (plantsInGrid.length === 0) {
        setSuggestions("Your garden is empty! Drag some plants from the palette onto the grid to get started.");
        setIsSuggestionsLoading(false);
        return;
    }

    const prompt = `
      You are an expert garden designer. I have created a garden layout on an 8x8 grid.
      Please provide suggestions to improve it. Consider companion planting (good and bad neighbors),
      and general placement advice. Assume the top of the grid is North.
      
      My current plant list: ${plantsInGrid.join(', ')}

      My current layout:
      ${gridString}

      Provide actionable advice in a friendly tone. Use markdown for formatting (headings, lists, bold text).
    `;

    try {
        const response = await generateContent(prompt);
        setSuggestions(response);
    } catch (error) {
        console.error("Error getting garden suggestions:", error);
        setSuggestions("Sorry, I couldn't generate suggestions at this time. Please try again.");
    } finally {
        setIsSuggestionsLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose}></div>
      <div className="fixed inset-0 bg-gray-800/80 backdrop-blur-lg z-50 p-4 lg:p-8 flex flex-col">
        <div className="flex-shrink-0 p-4 flex justify-between items-center border-b border-gray-700 mb-4">
            <h2 className="text-2xl font-semibold flex items-center gap-3"><LayoutIcon className="w-7 h-7 text-green-400" /> Garden Layout Planner</h2>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-700"><CloseIcon className="w-7 h-7" /></button>
        </div>
        
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-hidden">
          {/* Left Panel: Palette */}
          <div className="flex flex-col bg-gray-800/50 rounded-lg p-4 overflow-y-auto">
              <h3 className="text-lg font-bold mb-3">Plant Palette</h3>
              <div className="flex gap-2 mb-4">
                <input
                    type="text"
                    value={newPlantInput}
                    onChange={(e) => setNewPlantInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddNewPlant()}
                    placeholder="Add a new plant"
                    className="flex-1 bg-gray-700 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <button onClick={handleAddNewPlant} className="bg-green-600 hover:bg-green-500 px-3 rounded-md text-sm"><PlusIcon className="w-5 h-5"/></button>
              </div>
              <div className="space-y-2 flex-1">
                {plantPalette.map(plant => (
                    <div
                        key={plant}
                        draggable
                        onDragStart={(e) => handleDragStart(e, 'palette', plant)}
                        className="bg-gray-700 p-2 rounded-md text-center cursor-move text-sm hover:bg-green-700/60"
                    >
                        {plant}
                    </div>
                ))}
              </div>
               <div
                onDrop={handleDropOnTrash}
                onDragOver={(e) => e.preventDefault()}
                className="mt-4 p-4 border-2 border-dashed border-gray-600 rounded-lg text-center text-gray-500"
              >
                Drag plant here to remove from grid
              </div>
          </div>

          {/* Middle Panel: Grid */}
          <div className="bg-gray-800/50 rounded-lg p-4 flex flex-col items-center justify-center">
            <div className="aspect-square w-full max-w-lg grid grid-cols-8 gap-1 bg-gray-900/50 p-1 rounded-md">
                {gardenGrid.map((row, r) =>
                    row.map((cell, c) => (
                        <div
                            key={`${r}-${c}`}
                            onDrop={(e) => handleDropOnGrid(e, r, c)}
                            onDragOver={(e) => e.preventDefault()}
                            className="bg-green-900/30 rounded-sm flex items-center justify-center aspect-square border border-transparent hover:border-green-400"
                        >
                            {cell && (
                                <div
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, 'grid', cell, { r, c })}
                                    className="bg-green-600 text-white w-full h-full rounded-sm text-xs p-1 flex items-center justify-center text-center cursor-move select-none"
                                >
                                    {cell}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
          </div>
          
          {/* Right Panel: Suggestions */}
          <div className="flex flex-col bg-gray-800/50 rounded-lg p-4">
              <h3 className="text-lg font-bold mb-3">AI Suggestions</h3>
              <div className="flex-1 overflow-y-auto pr-2">
                {isSuggestionsLoading ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <TypingIndicator />
                        <p className="mt-2">Analyzing your layout...</p>
                    </div>
                ) : suggestions ? (
                    <div className="prose prose-invert prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: renderMarkdown(suggestions) }}></div>
                ) : (
                    <p className="text-gray-400 text-sm">Design your garden on the grid, then click "Get Suggestions" for AI-powered advice.</p>
                )}
              </div>
              <button
                onClick={handleGetSuggestions}
                disabled={isSuggestionsLoading}
                className="mt-4 w-full bg-blue-600 hover:bg-blue-500 rounded-lg py-2 disabled:bg-gray-500 disabled:cursor-not-allowed"
              >
                Get Suggestions
              </button>
          </div>
        </div>
      </div>
    </>
  );
};


const App: React.FC = () => {
  const [history, setHistory] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [editingState, setEditingState] = useState<{ chatId: string; messageIndex: number; text: string } | null>(null);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [userCoords, setUserCoords] = useState<{lat: number; lon: number} | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isWeatherContextEnabled, setIsWeatherContextEnabled] = useState(false);

  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarTasks, setCalendarTasks] = useState<CalendarTask[] | null>(null);
  const [isCalendarLoading, setIsCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isReminderModalOpen, setReminderModalOpen] = useState(false);
  const [isRemindersPanelOpen, setRemindersPanelOpen] = useState(false);
  const [reminderPlantContext, setReminderPlantContext] = useState('');
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

  const [isPlannerOpen, setIsPlannerOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Initial load from local storage
  useEffect(() => {
    try {
      const storedHistory = localStorage.getItem('chatHistory');
      const storedActiveId = localStorage.getItem('activeChatId');
      if (storedHistory) {
        const parsedHistory = JSON.parse(storedHistory);
        setHistory(parsedHistory);
        setActiveChatId(storedActiveId ? JSON.parse(storedActiveId) : (parsedHistory[0]?.id || null));
      }

      const storedReminders = localStorage.getItem('wateringReminders');
      if (storedReminders) {
        setReminders(JSON.parse(storedReminders));
      }
      
      if ('Notification' in window) {
        setNotificationPermission(Notification.permission);
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
      localStorage.setItem('wateringReminders', JSON.stringify(reminders));
    // FIX: Corrected a syntax error in the try-catch block that was breaking the component's scope.
    } catch (error) {
      console.error("Failed to save to local storage", error);
    }
  }, [history, activeChatId, reminders]);

  // This effect keeps activeChatId in sync with history,
  // ensuring a valid chat is always selected if one exists.
  useEffect(() => {
    const activeChatExists = history.some(chat => chat.id === activeChatId);

    if (!activeChatExists) {
      // If the active chat is no longer in history (e.g., deleted),
      // select the first available chat.
      setActiveChatId(history[0]?.id || null);
    }
  }, [history, activeChatId]);

  // Reminder checking logic
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      reminders.forEach(reminder => {
        if (now >= reminder.nextDueDate) {
          if (notificationPermission === 'granted') {
            const body = `It's time to water your ${reminder.plantName}.`;
            const options = {
              body,
              icon: '/plant-icon.png', // You should have an icon in your public folder
            };
            navigator.serviceWorker.ready.then(registration => {
              registration.showNotification('Watering Reminder', options);
            });
          }
          // Reschedule for the next time, preserving the time of day
          const newNextDueDate = new Date(reminder.nextDueDate);
          newNextDueDate.setDate(newNextDueDate.getDate() + reminder.frequencyDays);
          setReminders(prev => prev.map(r => r.id === reminder.id ? { ...r, nextDueDate: newNextDueDate.getTime() } : r));
        }
      });
    }, 60 * 1000); // Check every minute

    return () => clearInterval(interval);
  }, [reminders, notificationPermission]);


  // Fetch Weather and Location
  useEffect(() => {
    const fetchWeather = async (latitude: number, longitude: number) => {
      try {
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`);
        if (!response.ok) throw new Error("Failed to fetch weather data");
        const data = await response.json();
        setWeatherData({
          temperature: data.current_weather.temperature,
          weatherCode: data.current_weather.weathercode,
        });
        setUserCoords({ lat: latitude, lon: longitude });
      } catch (error) {
        console.error("Weather API error:", error);
        setLocationError("Could not fetch weather.");
      }
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          fetchWeather(position.coords.latitude, position.coords.longitude);
        },
        (error) => {
          console.error("Geolocation error:", error);
          setLocationError("Location access denied.");
        }
      );
    } else {
      setLocationError("Geolocation not supported.");
    }
  }, []);

  useEffect(() => {
    if (!isLoading) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [history, activeChatId, isLoading]);

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);


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
      setHistory(prevHistory => prevHistory.filter(chat => chat.id !== idToDelete));
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

    let finalInput = input;
    if (isWeatherContextEnabled && weatherData) {
      const { description } = getWeatherInfo(weatherData.weatherCode);
      const weatherContext = `(My local weather is currently ${Math.round(weatherData.temperature)}°C and ${description}) `;
      finalInput = weatherContext + input;
      setIsWeatherContextEnabled(false);
    }

    const userMessage: ChatMessage = { role: 'user', content: finalInput };
    const currentInputForTitle = input; // Use original input for title
    setInput('');
    
    let currentChatId = activeChatId;
    if (!currentChatId || history.find(chat => chat.id === currentChatId)?.messages.length === 0) {
      currentChatId = `chat_${Date.now()}`;
      const newChat: ChatSession = { 
        id: currentChatId, 
        title: currentInputForTitle.substring(0, 35) + (currentInputForTitle.length > 35 ? '...' : ''), 
        messages: [userMessage] 
      };
      // If the current active chat is a new, empty chat, replace it. Otherwise, add a new one.
       if (activeChatId && history.find(c => c.id === activeChatId)?.messages.length === 0) {
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
    
    await addMessageToApiCall(finalInput);
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || isLoading) return;

    const dataUrl = await fileToDataUrl(file);
    const base64Data = dataUrl.split(',')[1];
    const imagePart: ImagePart = { mimeType: file.type, data: base64Data };

    const prompt = `Identify the plant in this image. Respond ONLY with a single JSON object in the following format (do not include \`\`\`json or \`\`\`): {"plantName": "Identified Plant Name", "confidence": 85, "careInstructions": "## Watering\\nWater thoroughly..."}. The 'plantName' should be the common name. 'confidence' must be a number representing your confidence score as a percentage (0-100). 'careInstructions' must be a string containing detailed care instructions formatted with markdown.`;
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
    
    setIsLoading(true);
    try {
      const responseText = await generateContent(prompt, imagePart);
      let modelMessage: ChatMessage;

      try {
        const cleanedJson = responseText.replace(/^```json\s*|```\s*$/g, '').trim();
        const parsed = JSON.parse(cleanedJson);
        
        if (parsed.plantName && typeof parsed.confidence === 'number' && parsed.careInstructions) {
          const identificationContent: PlantIdentificationContent = {
            type: 'plantIdentification',
            plantName: parsed.plantName,
            confidence: parsed.confidence,
            careInstructions: parsed.careInstructions,
          };
          modelMessage = { role: 'model', content: identificationContent };
           // Update chat title with identified plant name
          setHistory(prev => prev.map(chat => 
            chat.id === currentChatId
            ? { ...chat, title: parsed.plantName }
            : chat
          ));
        } else {
          throw new Error("Parsed JSON does not match expected format.");
        }
      } catch (e) {
        console.warn("Could not parse plant identification JSON, falling back to text.", e);
        modelMessage = { role: 'model', content: responseText };
      }
      
      setHistory(prev => prev.map(chat => 
        chat.id === currentChatId
        ? { ...chat, messages: [...chat.messages, modelMessage] }
        : chat
      ));
    } catch (error) {
      const errorMessage: ChatMessage = { role: 'model', content: 'An error occurred. Please try again.' };
       setHistory(prev => prev.map(chat => 
        chat.id === currentChatId
        ? { ...chat, messages: [...chat.messages, errorMessage] }
        : chat
      ));
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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

  const handleIdentificationFeedback = (messageIndex: number, feedback: 'correct' | 'incorrect', correctedName?: string) => {
    if (!activeChatId) return;
  
    let followupMessage: ChatMessage | null = null;
    if (feedback === 'correct') {
      followupMessage = { role: 'model', content: "Great! I've noted that. If you have more questions about it, feel free to ask!" };
    } else if (feedback === 'incorrect' && correctedName) {
      followupMessage = { role: 'model', content: `Thank you for the correction! I'll remember this is a ${correctedName}. What would you like to know about it?` };
    }
  
    setHistory(prev => prev.map(chat => {
      if (chat.id === activeChatId) {
        const newMessages = [...chat.messages];
        const targetMessage = newMessages[messageIndex];
        
        if (targetMessage && targetMessage.role === 'model' && typeof targetMessage.content === 'object' && 'type' in targetMessage.content && targetMessage.content.type === 'plantIdentification') {
          const updatedContent: PlantIdentificationContent = {
            ...(targetMessage.content as PlantIdentificationContent),
            userFeedback: feedback,
            correctedName: correctedName,
          };
          newMessages[messageIndex] = { ...targetMessage, content: updatedContent };
        }
  
        if (followupMessage) {
          return { ...chat, messages: [...newMessages, followupMessage] };
        }
        return { ...chat, messages: newMessages };
      }
      return chat;
    }));
  };

  const handleExportTXT = () => {
    const activeChat = history.find(chat => chat.id === activeChatId);
    if (!activeChat) return;

    const formatChatForTxt = (chat: ChatSession): string => {
      let content = `Chat Title: ${chat.title}\n`;
      content += `Exported on: ${new Date().toLocaleString()}\n\n`;
      content += '-----------------------------------\n\n';

      chat.messages.forEach(msg => {
        const prefix = msg.role === 'user' ? 'You' : 'Assistant';
        if (typeof msg.content === 'string') {
          content += `${prefix}:\n${msg.content}\n\n`;
        } else if ('type' in msg.content && msg.content.type === 'plantIdentification') {
          content += `${prefix}:\n[Identified ${msg.content.plantName} with ${msg.content.confidence}% confidence]\n${msg.content.careInstructions}\n\n`;
        } else if ('promptText' in msg.content) {
          content += `${prefix}:\n${msg.content.promptText}\n(Image Attached)\n\n`;
        }
      });
      return content;
    };
    
    const formattedContent = formatChatForTxt(activeChat);
    const blob = new Blob([formattedContent], { type: 'text/plain;charset=utf-8' });
    
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    const safeTitle = activeChat.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    link.download = `chat_${safeTitle}.txt`;
    
    document.body.appendChild(link);
    link.click();
    
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    setIsExportMenuOpen(false);
  };

  const handleExportPDF = () => {
    const activeChat = history.find(chat => chat.id === activeChatId);
    if (!activeChat) return;
  
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
  
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const usableWidth = pageWidth - margin * 2;
    let cursorY = margin;
  
    const addText = (text, options) => {
        const lines = doc.splitTextToSize(text, usableWidth);
        const textHeight = lines.length * (options.fontSize / 2.8); // Approximate height
        if (cursorY + textHeight > doc.internal.pageSize.getHeight() - margin) {
            doc.addPage();
            cursorY = margin;
        }
        doc.text(lines, margin, cursorY);
        cursorY += textHeight + 4;
    };

    doc.setFontSize(16).setFont(undefined, 'bold');
    doc.text(activeChat.title, pageWidth / 2, cursorY, { align: 'center' });
    cursorY += 10;
    
    doc.setFontSize(8).setFont(undefined, 'normal');
    doc.text(`Exported on: ${new Date().toLocaleString()}`, pageWidth / 2, cursorY, { align: 'center' });
    cursorY += 10;
    
    activeChat.messages.forEach(message => {
      if (cursorY > doc.internal.pageSize.getHeight() - margin - 10) {
        doc.addPage();
        cursorY = margin;
      }
  
      const isUser = message.role === 'user';
      doc.setFontSize(10).setFont(undefined, 'bold');
      addText(isUser ? 'You:' : 'Assistant:', { fontSize: 10 });
      
      let contentText = '';
      if (typeof message.content === 'string') {
          contentText = message.content;
      } else if ('type' in message.content && message.content.type === 'plantIdentification') {
          contentText = `[Identified ${message.content.plantName} with ${message.content.confidence}% confidence]\n\n${message.content.careInstructions}`;
      } else if ('promptText' in message.content) {
          contentText = `${message.content.promptText}\n(Image Attached)`;
      }
      
      const plainText = contentText
        .replace(/## (.*)/g, '$1')
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\* (.*)/g, '- $1');
  
      doc.setFontSize(10).setFont(undefined, 'normal');
      addText(plainText, { fontSize: 10 });
      cursorY += 4;
    });
  
    const safeTitle = activeChat.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    doc.save(`chat_${safeTitle}.pdf`);
    setIsExportMenuOpen(false);
  };

  const handleGenerateCalendar = async () => {
    setIsCalendarOpen(true);
    if (calendarTasks) return; // Don't regenerate if we already have tasks

    setIsCalendarLoading(true);
    setCalendarError(null);

    if (locationError || !userCoords) {
      setCalendarError(`Location access is required for a personalized calendar. ${locationError}`);
      setIsCalendarLoading(false);
      return;
    }

    const plantList = history
      .map(chat => chat.title)
      .filter(title => title && title !== 'New Chat' && title !== 'Plant Analysis');
    
    const uniquePlants = [...new Set(plantList)];

    if (uniquePlants.length === 0) {
      setCalendarError("You haven't identified any plants yet. Start a chat about a plant to get calendar tasks.");
      setIsCalendarLoading(false);
      return;
    }

    const prompt = `
      You are a master gardener creating a personalized task calendar. Based on the following information, generate a list of gardening tasks for the next month.

      Current Date: ${new Date().toLocaleDateString()}
      Location (Latitude, Longitude): ${userCoords.lat}, ${userCoords.lon}
      My plants: ${uniquePlants.join(', ')}

      For each plant, suggest relevant tasks like planting, pruning, fertilizing, or pest control. Provide a general timing for each task (e.g., 'Early in the month', 'Mid-month', 'End of the month').

      Return the response ONLY as a JSON array of objects, where each object has the following keys: "plant", "task", and "timing". Do not include any other text or markdown formatting.
      Example format:
      [
        { "plant": "Rose Bush", "task": "Prune back dead or weak canes to encourage new growth.", "timing": "Early next week" },
        { "plant": "Tomato Plant", "task": "Apply a balanced fertilizer, as fruiting begins.", "timing": "Mid-month" }
      ]
    `;

    try {
      const responseText = await generateContent(prompt);
      // Clean the response to ensure it's valid JSON
      const cleanedJsonString = responseText.replace(/^```json\s*|```\s*$/g, '').trim();
      const tasks = JSON.parse(cleanedJsonString);
      setCalendarTasks(tasks);
    } catch (error) {
      console.error("Failed to generate or parse calendar tasks:", error);
      setCalendarError("Sorry, I couldn't generate the calendar. The response might have been in an unexpected format. Please try again.");
    } finally {
      setIsCalendarLoading(false);
    }
  };

  const handleOpenReminderModal = (plantName?: string) => {
    const activeChat = history.find(c => c.id === activeChatId);
    if (plantName) {
      setReminderPlantContext(plantName);
      setReminderModalOpen(true);
    } else if (activeChat && activeChat.title !== 'New Chat' && activeChat.title !== 'Plant Analysis') {
      // Fallback for regular messages from a titled chat
      setReminderPlantContext(activeChat.title);
      setReminderModalOpen(true);
    } else {
      // Prompt user if context is unclear
      const plant = prompt("Which plant is this reminder for?");
      if (plant) {
        setReminderPlantContext(plant);
        setReminderModalOpen(true);
      }
    }
  };
  
  const handleSaveReminder = async (frequencyDays: number, reminderTime: string) => {
    if (notificationPermission === 'default') {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission !== 'granted') {
        alert("You need to grant notification permission to set reminders.");
        return;
      }
    }
    
    if (notificationPermission !== 'granted') {
       alert("Notification permission is not granted. Please enable it in browser settings.");
       return;
    }

    const now = new Date();
    const [hours, minutes] = reminderTime.split(':').map(Number);
    
    const firstReminderDate = new Date();
    firstReminderDate.setHours(hours, minutes, 0, 0);

    // If the scheduled time has already passed today, set the first reminder for the next day
    if (firstReminderDate.getTime() <= now.getTime()) {
      firstReminderDate.setDate(firstReminderDate.getDate() + 1);
    }

    const newReminder: Reminder = {
      id: `reminder_${Date.now()}`,
      plantName: reminderPlantContext,
      frequencyDays: frequencyDays,
      reminderTime: reminderTime,
      nextDueDate: firstReminderDate.getTime(),
    };
    setReminders(prev => [...prev, newReminder]);
  };

  const handleDeleteReminder = (id: string) => {
    setReminders(prev => prev.filter(r => r.id !== id));
  };
  
  const handleRequestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
    }
  };

  const getInitialPlantPalette = () => {
    const plantTitles = history
      .map(chat => chat.title)
      .filter(title => title && title !== 'New Chat' && title !== 'Plant Analysis');
    return [...new Set(plantTitles)];
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
      <CalendarPanel 
        isOpen={isCalendarOpen}
        onClose={() => setIsCalendarOpen(false)}
        tasks={calendarTasks}
        isLoading={isCalendarLoading}
        error={calendarError}
      />
      <RemindersPanel 
        isOpen={isRemindersPanelOpen}
        onClose={() => setRemindersPanelOpen(false)}
        reminders={reminders}
        onDelete={handleDeleteReminder}
        notificationPermission={notificationPermission}
        onRequestPermission={handleRequestNotificationPermission}
      />
      <ReminderModal
        isOpen={isReminderModalOpen}
        onClose={() => setReminderModalOpen(false)}
        onSave={handleSaveReminder}
        plantName={reminderPlantContext}
      />
      <GardenPlannerPanel 
        isOpen={isPlannerOpen}
        onClose={() => setIsPlannerOpen(false)}
        initialPalette={getInitialPlantPalette()}
      />
      <div className="flex flex-col flex-1 h-screen">
        <header className="flex items-center justify-between p-4 border-b border-gray-700 shadow-lg bg-gray-800/50 backdrop-blur-sm relative">
          <div className="flex items-center">
            <button onClick={() => setSidebarOpen(true)} className="p-2 mr-2 md:hidden rounded-full hover:bg-gray-700">
              <MenuIcon className="w-6 h-6"/>
            </button>
            <PlantIcon className="w-8 h-8 text-green-400 mr-3" />
            <h1 className="text-2xl font-bold tracking-wider text-green-400">Gardening Assistant</h1>
          </div>
          <div className="flex items-center gap-4">
            <WeatherWidget weather={weatherData} error={locationError} />
            <button
              onClick={() => setIsPlannerOpen(true)}
              className="p-2 rounded-full hover:bg-gray-700"
              aria-label="Open garden planner"
              title="Open garden planner"
            >
              <LayoutIcon className="w-6 h-6" />
            </button>
            <button
              onClick={() => setRemindersPanelOpen(true)}
              className="relative p-2 rounded-full hover:bg-gray-700"
              aria-label="Open reminders"
              title="Open reminders"
            >
              <BellIcon className="w-6 h-6" />
              {reminders.filter(r => r.nextDueDate < Date.now()).length > 0 && (
                <span className="absolute top-0 right-0 block h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-gray-800"></span>
              )}
            </button>
            <button
              onClick={handleGenerateCalendar}
              className="p-2 rounded-full hover:bg-gray-700"
              aria-label="Open gardening calendar"
              title="Open gardening calendar"
            >
              <CalendarIcon className="w-6 h-6" />
            </button>
            <div ref={exportMenuRef}>
              <div className="relative">
                <button
                  onClick={() => setIsExportMenuOpen(prev => !prev)}
                  disabled={!activeChatId || messages.length === 0}
                  className="p-2 rounded-full hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Export chat"
                >
                  <ExportIcon className="w-6 h-6" />
                </button>
                {isExportMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-md shadow-xl z-50">
                    <div className="py-1">
                      <button
                        onClick={handleExportTXT}
                        className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-gray-200 hover:bg-gray-700/80"
                      >
                        Export as .txt
                      </button>
                      <button
                        onClick={handleExportPDF}
                        className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-gray-200 hover:bg-gray-700/80"
                      >
                        Export as .pdf
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
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
                onSetReminder={handleOpenReminderModal}
                isLastModelMessage={msg.role === 'model' && index === messages.length - 1}
                onIdentificationFeedback={handleIdentificationFeedback}
              />
            ))}
            {isLoading && !editingState && (
              <div className="flex items-start gap-3 w-full max-w-2xl mx-auto flex-row animate-fade-in-up">
                  <div className="w-8 h-8 flex-shrink-0 bg-gray-800 rounded-full flex items-center justify-center mt-1">
                      <BotIcon className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="p-4 rounded-xl shadow-md bg-gray-700/70 self-start">
                      <TypingIndicator />
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
                className="w-full bg-gray-700 text-white rounded-full py-3 pl-5 pr-28 focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
                disabled={isLoading}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                 <button
                    onClick={() => setIsWeatherContextEnabled(prev => !prev)}
                    disabled={!weatherData || isLoading}
                    className={`p-2 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${isWeatherContextEnabled ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'}`}
                    aria-label="Toggle weather context"
                    title="Include local weather in your question"
                  >
                    <CloudIcon className="w-5 h-5" />
                  </button>
                <button
                  onClick={handleSendMessage}
                  disabled={isLoading || !input.trim()}
                  className="p-2 bg-green-600 rounded-full text-white hover:bg-green-500 transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed"
                  aria-label="Send Message"
                >
                  <SendIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default App;