// Background script - routes messages to native Swift handler
const DEBUG = false;

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Log message type without sensitive data
    if (DEBUG && request.name) {
        console.log("Received request type:", request.name);
    }
    
    // Forward messages to native handler (Swift)
    if (request.name === "saveICS" || request.name === "getAPIKey" || request.text) {
        return browser.runtime.sendNativeMessage(browser.runtime.id, request)
            .then(response => {
                // Log response status without sensitive data
                if (DEBUG) {
                    if (response && response.name === "apiKeyResponse") {
                        console.log("Native handler response: apiKeyResponse (key received)");
                    } else {
                        console.log("Native handler response:", response?.success ? "success" : "failure");
                    }
                }
                return response;
            })
            .catch(error => {
                if (DEBUG) console.error("Error communicating with native handler:", error);
                return { success: false, error: error.message };
            });
    }
    
    // Legacy handler for testing
    if (request.greeting === "hello") {
        return Promise.resolve({ farewell: "goodbye" });
    }
});
