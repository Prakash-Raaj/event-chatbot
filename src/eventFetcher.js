import puppeteer from 'puppeteer';

class EventFetcher {
  constructor() {
    this.events = [];
  }

  async fetchAllEvents() {
    console.log('Fetching events from multiple sources...');

    try {
      const [meetupEvents, eventbriteEvents] =
        await Promise.allSettled([
          this.fetchMeetupEvents(),
          this.fetchEventbriteEvents(),
        ]);

      this.events = [];

      // Add successful results
      if (meetupEvents.status === 'fulfilled') {
        this.events.push(...meetupEvents.value);
      }
      if (eventbriteEvents.status === 'fulfilled') {
        this.events.push(...eventbriteEvents.value);
      }

      // Remove duplicates
      this.events = this.removeDuplicates(this.events);

      console.log(`Fetched ${this.events.length} total events`);
      return this.events;
    } catch (error) {
      console.error('Error fetching events:', error);
      return this.events;
    }
  }

  async fetchMeetupEvents() {
    try {
      console.log('Fetching from Meetup.com...');

      const browser = await puppeteer.launch({ headless: true });
      const page = await browser.newPage();
      await page.goto(
        'https://www.meetup.com/find/events/?keywords=tech&radius=25',
        { waitUntil: 'networkidle2', timeout: 30000 },
      );

      const events = await page.evaluate(() => {
        const eventLinks = Array.from(
          document.querySelectorAll('a[href*="/events/"]'),
        );
        const events = [];

        eventLinks.forEach((link) => {
          const href = link.href;
          const text = link.textContent.trim();

          if (
            text &&
            href &&
            text.length > 10 &&
            !events.some((e) => e.url === href)
          ) {
            // Extract title (first meaningful part)
            const title = text
              .split(' ')
              .slice(0, 8)
              .join(' ')
              .replace(/[^\w\s]/g, '')
              .trim();

            // Look for date pattern in nearby text
            const parentText =
              link.closest('[class*="event"]')?.textContent || text;
            const dateMatch = parentText.match(
              /(\w{3}, \w{3} \d{1,2})/,
            );
            const date = dateMatch ? dateMatch[1] : 'Date TBD';

            const location = 'TBD'; // Hard to extract reliably

            if (title && title !== 'Date TBD') {
              events.push({
                title: title.substring(0, 100),
                date: date,
                location: location,
                source: 'Meetup.com',
                category: 'Tech Meetup',
                url: href,
              });
            }
          }
        });

        return events.slice(0, 10);
      });

      await browser.close();
      console.log(`Found ${events.length} Meetup events`);
      return events;
    } catch (error) {
      console.error('Meetup fetch error:', error.message);
      return [];
    }
  }

  async fetchEventbriteEvents() {
    try {
      console.log('Fetching from Eventbrite...');

      const browser = await puppeteer.launch({ headless: true });
      const page = await browser.newPage();
      await page.goto(
        'https://www.eventbrite.com/d/online/tech--events',
        { waitUntil: 'networkidle2', timeout: 30000 },
      );

      const events = await page.evaluate(() => {
        const eventLinks = Array.from(
          document.querySelectorAll('a[href*="/e/"]'),
        );
        const events = [];

        eventLinks.forEach((link) => {
          const href = link.href;
          const text = link.textContent.trim();

          if (
            text &&
            href &&
            text.includes(' ') &&
            !events.some((e) => e.url === href)
          ) {
            // Extract title (remove "View " prefix if present)
            let title = text
              .replace(/^View\s+/i, '')
              .split(' ')
              .slice(0, 8)
              .join(' ')
              .trim();

            // Look for date in nearby elements
            const eventCard =
              link.closest('[data-testid="event-card"]') ||
              link.parentElement;
            const cardText = eventCard?.textContent || text;
            const dateMatch = cardText.match(
              /(\w{3}, \w{3} \d{1,2}|\w{3} \d{1,2})/,
            );
            const date = dateMatch ? dateMatch[1] : 'Date TBD';

            const location = cardText.includes('Online')
              ? 'Online'
              : 'TBD';

            if (title && title !== 'Date TBD') {
              events.push({
                title: title.substring(0, 100),
                date: date,
                location: location,
                source: 'Eventbrite',
                category: 'Tech Event',
                url: href,
              });
            }
          }
        });

        return events.slice(0, 10);
      });

      await browser.close();
      console.log(`Found ${events.length} Eventbrite events`);
      return events;
    } catch (error) {
      console.error('Eventbrite fetch error:', error.message);
      return [];
    }
  }

  removeDuplicates(events) {
    const seen = new Set();
    return events.filter((event) => {
      const key = `${event.title}-${event.date}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

const eventFetcher = new EventFetcher();

export const fetchAllEvents = async () => {
  return await eventFetcher.fetchAllEvents();
};
