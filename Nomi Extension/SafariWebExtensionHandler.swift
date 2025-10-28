//
//  SafariWebExtensionHandler.swift
//  Nomi Extension
//
//  Handles native message passing and saves ICS files to open in Calendar.app
//

import SafariServices
import os.log
import Foundation
import AppKit

class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {
    
    private let log = OSLog(subsystem: "com.nomi.extension", category: "SafariWebExtensionHandler")
    
    // Load API key from environment variable or UserDefaults
    // Set OPENAI_API_KEY environment variable in Xcode scheme, or use UserDefaults
    private var OPENAI_API_KEY: String {
        // Try environment variable first (for development)
        if let envKey = ProcessInfo.processInfo.environment["OPENAI_API_KEY"], !envKey.isEmpty {
            return envKey
        }
        // Fall back to UserDefaults (for production/user configuration)
        if let userKey = UserDefaults.standard.string(forKey: "OPENAI_API_KEY"), !userKey.isEmpty {
            return userKey
        }
        // Return empty string if not configured
        os_log("Warning: OPENAI_API_KEY not configured", log: log, type: .error)
        return ""
    }

    func beginRequest(with context: NSExtensionContext) {
        let request = context.inputItems.first as? NSExtensionItem

        let profile: UUID?
        if #available(iOS 17.0, macOS 14.0, *) {
            profile = request?.userInfo?[SFExtensionProfileKey] as? UUID
        } else {
            profile = request?.userInfo?["profile"] as? UUID
        }

        let message: Any?
        if #available(iOS 15.0, macOS 11.0, *) {
            message = request?.userInfo?[SFExtensionMessageKey]
        } else {
            message = request?.userInfo?["message"]
        }

        // Log message type without sensitive data
        var messageType = "unknown"
        if let messageDict = message as? [String: Any],
           let name = messageDict["name"] as? String {
            messageType = name
        }
        os_log("Received message type: %{public}@, profile: %{public}@", 
               log: log, 
               type: .info, 
               messageType, 
               profile?.uuidString ?? "none")
        
        // Parse the message
        var responseData: [String: Any] = [:]
        
        if let messageDict = message as? [String: Any] {
            // Handle "getAPIKey" message
            if let messageName = messageDict["name"] as? String,
               messageName == "getAPIKey" {
                
                let apiKey = OPENAI_API_KEY
                if apiKey.isEmpty {
                    responseData = [
                        "success": false,
                        "error": "OpenAI API key not configured. Please set OPENAI_API_KEY environment variable or UserDefaults."
                    ]
                } else {
                    responseData = [
                        "success": true,
                        "name": "apiKeyResponse",
                        "key": apiKey
                    ]
                }
            }
            // Handle "saveICS" message
            else if let messageName = messageDict["name"] as? String,
               messageName == "saveICS",
               let icsContent = messageDict["ics"] as? String {
                
                // Save ICS file and open in Calendar.app
                let success = saveAndOpenICS(icsContent: icsContent)
                
                responseData = [
                    "success": success,
                    "message": success ? "Event opened in Calendar.app" : "Failed to save or open ICS file"
                ]
            }
            // Legacy: Handle "text" message for NSDataDetector parsing
            else if let text = messageDict["text"] as? String {
                let parsedData = parseTextWithNSDataDetector(text)
                responseData = [
                    "success": true,
                    "data": parsedData
                ]
            } else {
                responseData = [
                    "success": false,
                    "error": "Invalid message format. Expected: { name: 'saveICS', ics: string } or { text: string }"
                ]
            }
        } else {
            responseData = [
                "success": false,
                "error": "Invalid message format"
            ]
        }
        
        let response = NSExtensionItem()
        if #available(iOS 15.0, macOS 11.0, *) {
            response.userInfo = [SFExtensionMessageKey: responseData]
        } else {
            response.userInfo = ["message": responseData]
        }
        
        context.completeRequest(returningItems: [response], completionHandler: nil)
    }
    
    // Save ICS content to temporary file and open in Calendar.app
    // Note: If Calendar.app doesn't open automatically, grant file access permission in:
    // System Settings → Privacy & Security → Files and Folders → [Your App]
    private func saveAndOpenICS(icsContent: String) -> Bool {
        do {
            // Generate unique filename using timestamp
            let timestamp = Int(Date().timeIntervalSince1970)
            let filename = "event_\(timestamp).ics"
            
            // Create temporary file URL
            let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent(filename)
            
            // Write ICS content to temporary file
            try icsContent.write(to: tempURL, atomically: true, encoding: .utf8)
            
            os_log("Saved ICS file to: %{public}@", log: log, type: .info, tempURL.path)
            
            // Open the file in Calendar.app
            let success = NSWorkspace.shared.open(tempURL)
            
            if success {
                os_log("Successfully opened ICS file in Calendar.app", log: log, type: .info)
            } else {
                os_log("Failed to open ICS file in Calendar.app", log: log, type: .error)
            }
            
            return success
            
        } catch {
            os_log("Error saving ICS file: %{public}@", log: log, type: .error, error.localizedDescription)
            return false
        }
    }
    
    // Parse text using NSDataDetector for date/time extraction (legacy support)
    private func parseTextWithNSDataDetector(_ text: String) -> [String: Any] {
        let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.date.rawValue)
        
        var eventDate: Date?
        var eventTime: DateComponents?
        var title = text
        
        if let detector = detector {
            let matches = detector.matches(in: text, options: [], range: NSRange(location: 0, length: text.utf16.count))
            
            if let firstMatch = matches.first {
                eventDate = firstMatch.date
                
                // Extract components from date if available
                if let date = firstMatch.date {
                    let calendar = Calendar.current
                    eventTime = calendar.dateComponents([.hour, .minute, .year, .month, .day], from: date)
                }
                
                // Remove the matched date/time text from title
                if let range = Range(firstMatch.range, in: text) {
                    title = text.replacingCharacters(in: range, with: "")
                    title = title.trimmingCharacters(in: .whitespacesAndNewlines)
                        .replacingOccurrences(of: "  ", with: " ")
                }
            }
        }
        
        // If no date found, use today
        let startDate = eventDate ?? Date()
        
        // Extract date components
        let calendar = Calendar.current
        let dateComponents = calendar.dateComponents([.year, .month, .day, .hour, .minute], from: startDate)
        
        let year = dateComponents.year ?? calendar.component(.year, from: Date())
        let month = String(format: "%02d", dateComponents.month ?? calendar.component(.month, from: Date()))
        let day = String(format: "%02d", dateComponents.day ?? calendar.component(.day, from: Date()))
        let hour = dateComponents.hour ?? 9
        let minute = dateComponents.minute ?? 0
        
        let dateString = "\(year)-\(month)-\(day)"
        let timeString = String(format: "%02d:%02d", hour, minute)
        
        // Clean up title
        title = title.trimmingCharacters(in: .whitespacesAndNewlines)
        if title.isEmpty {
            title = "New Event"
        }
        
        // Remove common date/time words from title
        let wordsToRemove = ["on", "at", "tomorrow", "today", "next", "this", "the"]
        let titleWords = title.split(separator: " ")
        let cleanedTitle = titleWords.filter { word in
            !wordsToRemove.contains(word.lowercased())
        }.joined(separator: " ")
        
        title = cleanedTitle.isEmpty ? "New Event" : cleanedTitle
        
        os_log("Parsed text - Title: %{public}@, Date: %{public}@, Time: %{public}@", 
               log: log, 
               type: .info, 
               title, 
               dateString, 
               timeString)
        
        return [
            "title": title,
            "date": dateString,
            "time": timeString
        ]
    }
}
