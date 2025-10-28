// Nomi - Calendar Invite Generator (AI-Powered)
// Main popup logic

(function() {
    'use strict';
    
    const DEBUG = false;
    
    // API key is securely stored in Swift binary and requested dynamically
    let openAIKey = null;
    const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
    const OPENAI_MODEL = 'gpt-3.5-turbo';
    
    // Request API key from Swift handler on initialization
    async function loadAPIKey() {
        if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.sendMessage) {
            try {
                const response = await browser.runtime.sendMessage({ name: "getAPIKey" });
                if (response && response.success && response.key) {
                    openAIKey = response.key;
                } else {
                    throw new Error('Failed to retrieve API key');
                }
            } catch (error) {
                if (DEBUG) console.error('Error loading API key:', error);
                throw new Error('Failed to load API key from native handler');
            }
        } else {
            throw new Error('Message API not available');
        }
    }
    
    const textInput = document.getElementById('textInput');
    const createButton = document.getElementById('createButton');
    const statusDiv = document.getElementById('status');
    
    // Show user-friendly error message based on error type
    function getUserFriendlyError(error) {
        // Network/Connection errors
        if (error.message.includes('Failed to fetch') || 
            error.message.includes('network') ||
            error.message.includes('NetworkError') ||
            error.name === 'TypeError' && error.message.includes('fetch')) {
            return "Nomi couldn't connect. Please check your internet connection.";
        }
        
        // API Key errors (401, 403)
        if (error.message.includes('401') || error.message.includes('403') ||
            error.message.includes('Invalid API key') ||
            error.message.includes('authentication')) {
            return "Your OpenAI key seems invalid. Please update it.";
        }
        
        // Rate limit errors (429)
        if (error.message.includes('429') || 
            error.message.includes('rate limit') ||
            error.message.includes('quota')) {
            return "Nomi reached the request limit. Try again later.";
        }
        
        // General API errors
        if (error.message.includes('OpenAI API') || 
            error.message.includes('API error')) {
            return "Something went wrong with the AI service. Please try again.";
        }
        
        // Initialization errors
        if (error.message.includes('Failed to load API key') ||
            error.message.includes('Message API not available')) {
            return "Failed to initialize extension. Please restart Safari.";
        }
        
        // Calendar errors
        if (error.message.includes('Calendar') || 
            error.message.includes('ICS')) {
            return "Couldn't open Calendar. Please try again.";
        }
        
        // General fallback
        return "Something went wrong. Please try again.";
    }
    
    // Show status message with optional icon
    function showStatus(message, type = 'success', icon = null) {
        statusDiv.innerHTML = icon ? `${icon} ${message}` : message;
        statusDiv.className = `status-message ${type} show`;
        
        if (type === 'success') {
            setTimeout(() => {
                statusDiv.classList.remove('show');
            }, icon ? 2500 : 1000);
        }
    }
    
    // Show user-friendly error
    function showError(error) {
        const friendlyMessage = getUserFriendlyError(error);
        showStatus(friendlyMessage, 'error');
    }
    
    // Apply fallback defaults for missing event fields based on activity detection
    function applyEventDefaults(eventData, inputText) {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const lowerText = (inputText || '').toLowerCase();
        const lowerTitle = (eventData.title || '').toLowerCase();
        const combinedText = `${lowerText} ${lowerTitle}`;
        
        // Default to today if no date
        if (!eventData.date) {
            eventData.date = todayStr;
        }
        
        // Detect activity-based time defaults if no start_time
        if (!eventData.start_time) {
            if (combinedText.includes('lunch')) {
                eventData.start_time = '12:00';
            } else if (combinedText.includes('dinner')) {
                eventData.start_time = '19:00';
            } else if (combinedText.includes('breakfast')) {
                eventData.start_time = '09:00';
            } else if (combinedText.includes('meeting') || combinedText.includes('study') || 
                       combinedText.includes('session') || combinedText.includes('group')) {
                eventData.start_time = '15:00';
            } else if (combinedText.includes('game') || combinedText.includes('party') || 
                       combinedText.includes('night')) {
                eventData.start_time = '20:00';
            } else {
                // Default to noon if no activity detected
                eventData.start_time = '12:00';
            }
        }
        
        // Ensure end_time exists and is valid (at least 1 hour after start)
        let needsEndTime = false;
        
        if (!eventData.end_time || eventData.end_time === eventData.start_time) {
            needsEndTime = true;
        } else {
            // Validate that end_time is after start_time
            const [startH, startM] = eventData.start_time.split(':').map(Number);
            const [endH, endM] = eventData.end_time.split(':').map(Number);
            const startMinutes = (startH || 0) * 60 + (startM || 0);
            const endMinutes = (endH || 0) * 60 + (endM || 0);
            
            if (endMinutes <= startMinutes) {
                needsEndTime = true;
            }
        }
        
        if (needsEndTime) {
            const [hours, minutes] = eventData.start_time.split(':').map(Number);
            const startDate = new Date();
            startDate.setHours(hours || 0, minutes || 0, 0, 0);
            startDate.setHours(startDate.getHours() + 1);
            eventData.end_time = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`;
        }
        
        // Ensure optional fields exist
        if (!eventData.description) {
            eventData.description = '';
        }
        if (!eventData.location) {
            eventData.location = '';
        }
        
        return eventData;
    }
    
    // Extract event details from text using OpenAI API
    async function extractEventFromText(inputText) {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][today.getDay()];
        
        const prompt = `Extract event information from the following text. Return ONLY valid JSON or the word "none" if no event is detected.

Required JSON format:
{
  "title": "Event title",
  "description": "Event description or original text",
  "date": "YYYY-MM-DD",
  "start_time": "HH:MM",
  "end_time": "HH:MM",
  "location": "..." (optional)
}

Rules:
1. DATE:
   - If no date specified, use today: ${todayStr} (${dayOfWeek})
   - "this [weekday]" = next occurrence of that day this week (if today is ${dayOfWeek}, "this Wednesday" = tomorrow if Wednesday is next)
   - "next [weekday]" = exactly 7 days after the next occurrence
   - Examples: Today is ${dayOfWeek}. "this Wednesday" on ${dayOfWeek} = next Wednesday. "next Wednesday" = Wednesday in 1+ weeks.

2. TIME:
   - "tonight" = 20:00 (8 PM)
   - "morning" = 09:00
   - "afternoon" = 15:00
   - "evening" = 19:00
   - If no time specified, default = 12:00 (noon)
   - Use 24-hour format (HH:MM)

3. LOCATION:
   - Extract location from phrases like "at [place]", "in [place]", "Room [number]"
   - Examples: "Meeting in Room 205" → location: "Room 205"
   - If no location, use empty string ""

4. TITLE:
   - Extract the event name/title, removing date/time/location references

5. SAFETY:
   - If the text contains NO event, return exactly: "none"
   - Examples of "none": casual greetings, questions without events, general conversation

Today is ${dayOfWeek}, ${todayStr}.

Text to analyze:
${inputText}`;

        let data = null; // Declare outside try block for error handling
        
        try {
            // Ensure API key is loaded before making request
            if (!openAIKey) {
                await loadAPIKey();
            }
            
            let response;
            try {
                response = await fetch(OPENAI_API_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${openAIKey}`
                    },
                    body: JSON.stringify({
                        model: OPENAI_MODEL,
                        messages: [
                            {
                                role: 'system',
                                content: 'You are a calendar event extraction assistant. Return ONLY valid JSON or the exact word "none" if no event is detected. No explanations, no markdown, just JSON or "none".'
                            },
                            {
                                role: 'user',
                                content: prompt
                            }
                        ],
                        temperature: 0.2,
                        max_tokens: 350
                    })
                });
            } catch (fetchError) {
                // Handle network errors
                if (DEBUG) console.error('Fetch error:', fetchError);
                throw new Error('Failed to fetch');
            }

            if (!response.ok) {
                let errorData = {};
                try {
                    errorData = await response.json();
                } catch {
                    // If JSON parsing fails, use status text
                }
                
                const statusCode = response.status;
                const errorMessage = errorData.error?.message || response.statusText;
                
                if (statusCode === 401 || statusCode === 403) {
                    throw new Error(`Invalid API key (${statusCode})`);
                } else if (statusCode === 429) {
                    throw new Error(`Rate limit (429)`);
                } else {
                    throw new Error(`OpenAI API error: ${statusCode} - ${errorMessage}`);
                }
            }

            data = await response.json();
            let content = data.choices[0]?.message?.content?.trim();

            if (!content) {
                throw new Error('No response from OpenAI API');
            }

            // Check if response is "none" (no event detected)
            if (content.toLowerCase() === 'none' || content.toLowerCase() === '"none"') {
                return null;
            }

            // Try to extract JSON from response (in case it's wrapped in markdown)
            let jsonText = content;
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                jsonText = jsonMatch[0];
            }

            const eventData = JSON.parse(jsonText);

            // If no title, we can't create a meaningful event
            if (!eventData.title || eventData.title.trim() === '') {
                return null;
            }

            // Apply fallback defaults for missing fields
            const normalizedEvent = applyEventDefaults(eventData, inputText);

            // Final validation: ensure we have at least title, date, and start_time
            if (!normalizedEvent.title || !normalizedEvent.date || !normalizedEvent.start_time) {
                return null;
            }

            return normalizedEvent;

        } catch (error) {
            if (error instanceof SyntaxError) {
                // If JSON parsing fails, check if content contains "none"
                try {
                    const content = data?.choices?.[0]?.message?.content?.trim() || '';
                    if (content.toLowerCase().includes('none')) {
                        return null;
                    }
                } catch {
                    // If we can't access data, just proceed with error
                }
                throw new Error('Failed to parse AI response');
            }
            // Re-throw network and API errors as-is
            if (error.message.includes('Failed to fetch') ||
                error.message.includes('Invalid API key') ||
                error.message.includes('Rate limit') ||
                error.message.includes('OpenAI API error')) {
                throw error;
            }
            // Wrap other errors
            throw new Error('Something went wrong');
        }
    }
    
    // Generate .ics file content from event data
    function generateICS(eventData) {
        const { title, description, date, start_time, end_time, location } = eventData;
        
        // Parse date and times in local timezone
        const [year, month, day] = date.split('-').map(Number);
        const [startHours, startMinutes] = start_time.split(':').map(Number);
        const [endHours, endMinutes] = end_time.split(':').map(Number);
        
        // Create date objects in local timezone
        const eventStart = new Date(year, month - 1, day, startHours, startMinutes || 0, 0);
        const eventEnd = new Date(year, month - 1, day, endHours, endMinutes || 0, 0);
        const now = new Date();
        
        // Format dates for ICS using "floating" time (no timezone)
        function formatICSDate(date) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const seconds = String(date.getSeconds()).padStart(2, '0');
            return `${year}${month}${day}T${hours}${minutes}${seconds}`;
        }
        
        const dtstart = formatICSDate(eventStart);
        const dtend = formatICSDate(eventEnd);
        const dtstamp = formatICSDate(now);
        
        // Generate unique ID
        const uid = `${Date.now()}@nomi.app`;
        
        // Escape special characters for ICS format
        function escapeICSField(text) {
            if (!text) return '';
            return String(text)
                .replace(/\\/g, '\\\\')
                .replace(/;/g, '\\;')
                .replace(/,/g, '\\,')
                .replace(/\n/g, '\\n');
        }
        
        const escapedTitle = escapeICSField(title);
        const escapedDescription = escapeICSField(description || '');
        const escapedLocation = escapeICSField(location || '');
        
        // Build ICS content
        const icsContent = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Nomi//Calendar Generator//EN',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            'BEGIN:VEVENT',
            `UID:${uid}`,
            `DTSTAMP:${dtstamp}`,
            `DTSTART:${dtstart}`,
            `DTEND:${dtend}`,
            `SUMMARY:${escapedTitle}`,
            description ? `DESCRIPTION:${escapedDescription}` : '',
            escapedLocation ? `LOCATION:${escapedLocation}` : '',
            'STATUS:CONFIRMED',
            'SEQUENCE:0',
            'END:VEVENT',
            'END:VCALENDAR'
        ].filter(line => line !== '').join('\r\n');
        
        return icsContent;
    }
    
    // Send ICS content to Swift handler to save and open in Calendar.app
    async function saveAndOpenICS(icsContent) {
        try {
            // Send message to Swift handler via browser.runtime.sendMessage
            // The Swift handler will save the ICS file and open it in Calendar.app
            if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.sendMessage) {
                const response = await browser.runtime.sendMessage({
                    name: "saveICS",
                    ics: icsContent
                });
                
                if (response && response.success) {
                    return true;
                } else {
                    throw new Error(response?.error || 'Failed to save ICS file');
                }
            } else {
                throw new Error('Message API not available');
            }
        } catch (error) {
            if (DEBUG) console.error('Error sending ICS to handler:', error);
            if (error.message.includes('Calendar') || error.message.includes('ICS')) {
                throw error;
            }
            throw new Error('Calendar error: Failed to open Calendar.app');
        }
    }
    
    // Main handler - uses OpenAI API to extract event details
    async function createInvite() {
        const text = textInput.value.trim();
        
        if (!text) {
            showStatus('Please enter some text', 'error');
            textInput.focus();
            return;
        }
        
        createButton.disabled = true;
        showStatus('Extracting event details...', 'success');
        
        try {
            // Extract event details using OpenAI API
            const eventData = await extractEventFromText(text);
            
            // Check if no event was detected
            if (!eventData) {
                showStatus('Could not detect event details. Please include date, time, and title.', 'error');
                createButton.disabled = false;
                return;
            }
            
            // Generate ICS file
            const icsContent = generateICS(eventData);
            
            // Send to Swift handler to save and open in Calendar.app
            await saveAndOpenICS(icsContent);
            
            // Show success notification with checkmark
            showStatus('Invite created', 'success', '✓');
            
            // Close popup after a short delay
            setTimeout(() => {
                if (typeof browser !== 'undefined' && browser.runtime) {
                    window.close();
                }
            }, 800);
            
        } catch (error) {
            if (DEBUG) console.error('Error creating invite:', error);
            showError(error);
            createButton.disabled = false;
        }
    }
    
    // Auto-expanding textarea
    function autoExpand(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
    }
    
    textInput.addEventListener('input', () => {
        autoExpand(textInput);
    });
    
    // Event listeners
    createButton.addEventListener('click', createInvite);
    
    textInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            // Allow Shift+Enter for new lines
            if (e.shiftKey) {
                setTimeout(() => autoExpand(textInput), 0);
                return; // Let default behavior create a newline
            }
            
            // Prevent default to avoid adding newline, then trigger create
            e.preventDefault();
            createInvite();
        }
    });
    
    // Initialize: Load API key and focus input
    loadAPIKey().then(() => {
        textInput.focus();
        autoExpand(textInput);
    }).catch(error => {
        if (DEBUG) console.error('Failed to initialize:', error);
        showError(error);
    });
    
})();
