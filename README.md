# Nomi 📅

<div align="center">
  <h3>A Safari extension that transforms natural language into calendar events</h3>
  <p>Powered by AI to make event scheduling effortless</p>
</div>

---

## ✨ Features

- 🗣️ **Natural Language Processing** - Describe events in plain English
- 🤖 **AI-Powered Extraction** - Uses OpenAI to intelligently parse event details
- ⚡ **One-Click Creation** - Instantly add events to your macOS Calendar app
- 🎨 **Modern UI** - Clean and intuitive popup interface
- 🔒 **Secure** - API keys handled securely, never exposed in code
- 🚀 **Native Integration** - Seamlessly opens events in macOS Calendar

## 📸 Screenshots

## 🚀 Quick Start

### Prerequisites

- macOS (for Safari extension development)
- Xcode 12.0 or later
- OpenAI API key ([Get one here](https://platform.openai.com/api-keys))

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/RabeeAbuMaraq/Nomi.git
   cd Nomi
   ```

2. Open the project in Xcode
   ```bash
   open Nomi.xcodeproj
   ```

3. Configure your OpenAI API key (see [Configuration](#configuration))

4. Build and run the extension

### Configuration

The extension requires an OpenAI API key to function. Configure it using one of these methods:

#### Option 1: Environment Variable (Recommended for Development)

1. In Xcode: `Product` → `Scheme` → `Edit Scheme`
2. Go to `Run` → `Arguments`
3. Add Environment Variable:
   - **Name:** `OPENAI_API_KEY`
   - **Value:** Your OpenAI API key (starts with `sk-`)

#### Option 2: UserDefaults (Runtime Configuration)

Set the API key programmatically:

```swift
UserDefaults.standard.set("your-api-key-here", forKey: "OPENAI_API_KEY")
```

## 🏗️ Project Structure

```
Nomi/
├── Nomi Extension/           # Safari extension implementation
│   ├── Resources/
│   │   ├── manifest.json     # Extension manifest
│   │   ├── popup.html/js/css # Extension popup UI
│   │   ├── background.js     # Background script
│   │   ├── content.js        # Content script
│   │   └── images/           # Extension icons
│   └── SafariWebExtensionHandler.swift  # Native Swift handler
├── Nomi/                     # Main app bundle
└── Nomi.xcodeproj           # Xcode project file
```

## 💻 Usage

1. Install the extension in Safari
2. Click the Nomi icon in the Safari toolbar
3. Type your event in natural language (e.g., "Meeting with John tomorrow at 2pm")
4. Click "Add to Calendar"
5. The event opens in macOS Calendar for final confirmation

### Example Event Descriptions

- "Team standup every Monday at 9am"
- "Dentist appointment next Friday at 3pm"
- "Conference call with Sarah on March 15th at 10:30am"
- "Birthday party tomorrow evening"

## 🔐 Security

This project prioritizes security:

- ✅ No hardcoded API keys or secrets
- ✅ API keys loaded from secure configuration
- ✅ Comprehensive `.gitignore` to prevent accidental commits
- ✅ Follows security best practices

**Important:** Never commit your OpenAI API key to version control. Always use environment variables or secure configuration methods.

See [SECURITY.md](SECURITY.md) for our security policy.

## 🛠️ Development

### Building the Project

1. Open `Nomi.xcodeproj` in Xcode
2. Select the `Nomi Extension` scheme
3. Build (`Cmd + B`) and run (`Cmd + R`)

### Architecture

- **Popup Interface** (`popup.html/js/css`) - User-facing UI for event input
- **Background Script** (`background.js`) - Message routing between popup and native handler
- **Native Handler** (`SafariWebExtensionHandler.swift`) - Swift code for API key management and ICS file handling
- **Content Script** (`content.js`) - For potential future web page interaction features

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📮 Contact

Your Name - @RabeeMaraq

Project Link: [https://github.com/RabeeAbuMaraq/Nomi](https://github.com/RabeeAbuMaraq/Nomi)

## 🙏 Acknowledgments

- OpenAI for the GPT API
- Apple for Safari Extension APIs
- The open-source community

---

⭐ If you find this project helpful, consider giving it a star!
