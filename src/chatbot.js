import axios from 'axios';
import { config } from 'dotenv';

config();

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1';

class Chatbot {
  async chat(userMessage, events) {
    // Format events into context
    const eventContext = this.formatEventsContext(events);

    // Create system prompt
    const systemPrompt = `You are a helpful assistant that answers questions about upcoming tech events, hackathons, and meetups.
You have access to current event data and should provide helpful information based on the user's questions.
Be conversational, friendly, and provide specific event details when relevant.
If you don't have information about a specific event they're looking for, suggest related events or tell them how to find more.

Current events data:
${eventContext}`;

    // Construct the prompt for the model
    const prompt = `${systemPrompt}

User: ${userMessage}
Assistant:`;

    try {
      console.log(
        `Calling Ollama at ${OLLAMA_URL} using model ${OLLAMA_MODEL}...`,
      );
      const response = await axios.post(
        `${OLLAMA_URL}/api/generate`,
        {
          model: OLLAMA_MODEL,
          prompt,
          stream: false,
        },
        {
          timeout: 30000,
        },
      );

      console.log('Ollama response status:', response.status);
      const assistantResponse = this.extractOllamaText(response.data);
      if (!assistantResponse) {
        throw new Error('No text returned from Ollama');
      }

      return assistantResponse;
    } catch (error) {
      console.error('Ollama API error:');
      console.error('Status:', error.response?.status);
      console.error('Data:', error.response?.data);
      console.error('Message:', error.message);
      return 'Sorry, I encountered an error processing your request. Please make sure Ollama is running locally and the model is available.';
    }
  }

  extractOllamaText(data) {
    if (!data) {
      return null;
    }

    // Ollama's /api/generate returns the response text directly
    const text = data?.response || null;

    if (typeof text !== 'string') {
      return null;
    }

    let assistantResponse = text.trim();
    const assistantStart = assistantResponse.indexOf('Assistant:');
    if (assistantStart !== -1) {
      assistantResponse = assistantResponse
        .substring(assistantStart + 'Assistant:'.length)
        .trim();
    }

    assistantResponse = assistantResponse.replace(/\n+/g, ' ').trim();
    if (assistantResponse.length > 500) {
      assistantResponse = assistantResponse.substring(0, 500) + '...';
    }

    return assistantResponse;
  }

  formatEventsContext(events) {
    if (!events || events.length === 0) {
      return 'No events currently available.';
    }

    const eventList = events
      .slice(0, 10) // Limit to 10 events to keep context manageable
      .map((event, index) => {
        return `${index + 1}. ${event.title} - ${event.source}
   Date: ${event.date}
   Location: ${event.location}
   Category: ${event.category || 'General'}
   URL: ${event.url}`;
      })
      .join('\n\n');

    return `${eventList}\n\n... and ${Math.max(0, events.length - 10)} more events`;
  }
}

const chatbot = new Chatbot();

export const chat = async (userMessage, events) => {
  return await chatbot.chat(userMessage, events);
};
