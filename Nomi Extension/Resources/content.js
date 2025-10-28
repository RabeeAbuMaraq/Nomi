const DEBUG = false;

browser.runtime.sendMessage({ greeting: "hello" }).then((response) => {
    if (DEBUG) console.log("Received response: ", response);
});

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (DEBUG) console.log("Received request: ", request);
});
