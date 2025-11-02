export interface ImagePart {
  mimeType: string;
  data: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string | { promptText: string; imageUrl: string };
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
}

export interface WeatherData {
  temperature: number;
  weatherCode: number;
}

export interface CalendarTask {
  plant: string;
  task: string;
  timing: string;
}

export interface Reminder {
  id: string;
  plantName: string;
  frequencyDays: number;
  reminderTime: string; // "HH:mm" format
  nextDueDate: number; // Stored as a timestamp
}

export type GardenGrid = (string | null)[][];