# Security Policy

## Supported Versions

We release patches for security vulnerabilities. Which versions are eligible for receiving such patches depends on the CVSS v3.0 Rating:

| Version | Supported          |
| ------- | ------------------ |
| Latest  | :white_check_mark: |
| < Latest| :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it by:

1. **Do NOT** open a public issue
2. Email the maintainer directly with details about the vulnerability
3. Include steps to reproduce the issue
4. Allow time for the issue to be addressed before public disclosure

## Security Best Practices

This project follows security best practices:

- ✅ No hardcoded API keys or secrets
- ✅ API keys loaded from environment variables or secure configuration
- ✅ Comprehensive `.gitignore` to prevent accidental commits
- ✅ Regular security updates

## Safe Development Practices

When contributing to this project:

- Never commit API keys, passwords, or other secrets to version control
- Use environment variables or secure key management solutions
- Review `.gitignore` to ensure sensitive files are excluded
- Regularly rotate API keys and credentials
- Follow the setup instructions in README.md for API key configuration

