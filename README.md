# Gardening Assistant

An AI-powered gardening assistant that identifies plants from photos and provides detailed care instructions through an interactive chat interface. This application leverages the power of the Google Gemini API to offer a seamless and intelligent user experience for all gardening enthusiasts.

## Features

*   **🌱 Plant Identification:** Simply upload a photo of a plant, and the AI will identify it and provide comprehensive care instructions.
*   **💬 Interactive AI Chat:** Ask any gardening-related questions and get instant, helpful answers from a powerful AI.
*   **🏡 Interactive Garden Layout Planner:** Visually design your garden on a grid using a drag-and-drop interface. Get AI-powered suggestions on companion planting, spacing, and placement for an optimal layout.
*   **☀️ Local Weather Context:** The app automatically fetches your local weather. You can include this context in your questions for more timely and relevant advice, like whether to hold off on watering due to upcoming rain.
*   **📅 Personalized Calendar:** Generate a forward-looking, one-month gardening calendar with tasks like pruning and fertilizing, tailored to your specific plants and location.
*   **🔔 Push Notification Reminders:** Never forget to water your plants again! Set customizable watering reminders directly from the chat and get a browser push notification when it's time to water—even if the app is just in a background tab.
*   **📚 Multi-Session Chat History:** All your conversations are saved. You can easily create new chats, switch between past conversations, and delete old ones.
*   **✏️ Edit & Regenerate:** Made a typo or want to rephrase a question? You can edit your previous messages, and the assistant will provide an updated response based on the new context.
*   **💾 Export Conversations:** Save your important conversations for offline viewing. Export any chat session as a clean `.txt` file or a formatted `.pdf` document.
*   **💅 Markdown Rendering:** The AI's responses are beautifully formatted with headings, lists, and bold text for improved readability.
*   **📱 Responsive Design:** A clean, modern UI that works flawlessly on both desktop and mobile devices.
*   **🔄 Persistent State:** Your chat history and reminders are saved in your browser's local storage, so everything is there when you return.

## Tech Stack

*   **Frontend:** React, TypeScript, Tailwind CSS
*   **AI Model:** Google Gemini API (`@google/genai`)
*   **Offline Notifications:** Service Worker, Push API
*   **PDF Generation:** jsPDF

## How to Use

The application is designed to be straightforward and intuitive.

1.  **Start a Conversation:**
    *   Type a question into the text box at the bottom and press Enter or click the send icon.
    *   Click the **paperclip icon** to select and upload an image of a plant you want to identify.

2.  **Use Smart Features:**
    *   **Garden Planner:** Click the **grid icon** in the header to open the planner. Drag plants from the palette to the grid, and then click "Get Suggestions" for AI advice.
    *   **Weather:** Click the **cloud icon** in the chat input to toggle including your local weather in your next prompt.
    *   **Calendar:** Click the **calendar icon** in the header to generate your personalized one-month task list.
    *   **Reminders:** After the assistant provides care instructions, a **bell icon** will appear on its message. Click it to set a watering reminder.

3.  **Manage Your App:**
    *   **History:** The sidebar (accessible via the menu icon on mobile) displays your chat history. Click "New Chat" to start fresh, or select a past chat to continue it.
    *   **Reminders Hub:** View and manage all active reminders by clicking the **bell icon** in the header.
    *   **Export:** Click the **download icon** in the header to save the current conversation as a `.txt` or `.pdf` file.

## Future Enhancements

This application provides a solid foundation that can be extended with even more powerful features. Here are a few ideas:

*   **病害 Plant Disease Diagnosis:** Upload a photo of a sick or pest-infested plant for an AI-powered diagnosis and recommended treatment plan.
*   **🌍 Community Hub:** Create a space where users can share photos of their gardens, ask questions to the community, and share tips and success stories.
*   **🛒 Supply Recommendations:** Based on the plants and tasks identified, recommend necessary supplies (e.g., specific fertilizers, pest control products) with links to purchase.

## Project Structure

```
.
├── App.tsx                 # Main React component with all UI and logic
├── components/
│   ├── Icons.tsx           # SVG icon components
│   └── Spinner.tsx         # Loading animation component
├── services/
│   └── gemini.ts           # Service for communicating with the Gemini API
├── types.ts                # TypeScript type definitions
├── index.html              # Main HTML file
├── index.tsx               # React entry point
├── service-worker.js       # Handles background push notifications
└── metadata.json           # Project metadata
```