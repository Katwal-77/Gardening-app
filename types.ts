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
