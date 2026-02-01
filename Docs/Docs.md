# Documentation

Comprehensive documentation for the gsheet library - a TypeScript library for building autonomous agents that work with Google Sheets.

## Quick Start

- [Configuration](Configuration.md) - Authentication, credentials, and environment setup
- [CLI Examples](guides/CLI.md) - Command-line usage and automation scripts
- [Web UI Demo](guides/Web-UI.md) - Interactive web interface with real-time plan management

## Architecture

- [AGENTSCAPE](architecture/AGENTSCAPE.md) - Column-based file storage system, migration, and file API

## Testing

- [Testing Overview](testing/testing.md) - Test summary, commands verified, and how to run tests
- [Test Plan](testing/TESTING_PLAN.md) - Comprehensive 12-phase testing strategy
- [Test Results](testing/RESULTS.md) - Detailed test execution results and coverage
- [E2E Scripts](testing/Scripts.md) - Automated CLI test script documentation
- [Integration Testing](testing/Integration-Testing.md) - Setup for tests against real Google Sheets

## Additional Resources

- **Main README** - Project overview, installation, and API reference (`/README.md`)
- **Product Specs** - Product design documents (`/specs/`)
- **Examples** - Code examples and use cases (`/examples/`)

## Overview

The gsheet library enables building autonomous agents that can:

- Read, write, and search data in Google Sheets
- Manage plans with phases and tracked tasks
- Maintain agent context and system prompts
- Log operations to a persistent history
- Handle retries and rate limiting
- Work via CLI, library API, or web interface

## Documentation Structure

```
Docs/
├── Docs.md                    - This file (index)
├── Configuration.md           - Auth, credentials, environment setup
├── guides/
│   ├── guides.md              - Guide index
│   ├── CLI.md                 - CLI usage and automation
│   └── Web-UI.md              - Web demo setup and features
├── architecture/
│   ├── architecture.md        - Architecture index
│   └── AGENTSCAPE.md          - File storage system
└── testing/
    ├── testing.md             - Testing overview
    ├── TESTING_PLAN.md        - Full test plan
    ├── RESULTS.md             - Test results
    ├── Scripts.md             - E2E test scripts
    └── Integration-Testing.md - Integration test setup
```
