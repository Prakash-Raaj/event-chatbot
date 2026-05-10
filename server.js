import express, { json, static as staticMiddleware } from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import path from 'path';
import { chat } from './src/chatbot.js';
import { fetchAllEvents } from './src/eventFetcher.js';

config();

console.log(
  'HUGGINGFACE_API_KEY loaded:',
  process.env.HUGGINGFACE_API_KEY ? 'yes' : 'no',
);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(json());
app.use(staticMiddleware('public'));

// Store events in memory (with 1-hour cache)
let cachedEvents = [];
let lastEventFetch = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Get latest events
    const events = await getEvents();

    // Get chatbot response
    const response = await chat(message, events);

    res.json({ response });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({
      error: 'Failed to generate response',
      message: error.message,
    });
  }
});

// Get events endpoint
app.get('/api/events', async (req, res) => {
  try {
    const events = await getEvents();
    res.json({ events, count: events.length });
  } catch (error) {
    console.error('Events error:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// Refresh events endpoint
app.get('/api/events/refresh', async (req, res) => {
  try {
    lastEventFetch = 0; // Force refresh
    const events = await getEvents();
    res.json({
      events,
      count: events.length,
      message: 'Events refreshed',
    });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({ error: 'Failed to refresh events' });
  }
});

// Helper function to get events with caching
async function getEvents() {
  const now = Date.now();

  if (
    cachedEvents.length > 0 &&
    now - lastEventFetch < CACHE_DURATION
  ) {
    console.log('Returning cached events');
    return cachedEvents;
  }

  console.log('Fetching fresh events...');
  const events = await fetchAllEvents();
  cachedEvents = events;
  lastEventFetch = now;

  return events;
}

app.listen(PORT, () => {
  console.log(`🤖 Event Chatbot running on http://localhost:${PORT}`);
  console.log(`💬 Open your browser and start chatting!`);
});
