# AI Novel Generator

[中文版](README_zh-CN.md)

An AI-powered long-form novel creation platform that combines a Python backend, React + Tauri desktop frontend, and a multi-LLM generation engine. It supports the full workflow from world-building and character design through chapter drafting, consistency review, and finalization.

## Features

- **Multi-LLM Support** -- OpenAI (GPT), DeepSeek, Gemini, Azure, and any OpenAI-compatible API including local models (Ollama, LM Studio, etc.)
- **Novel Architecture Generation** -- Auto-generate novel settings, character profiles, faction maps, world geography, and power systems
- **Chapter Blueprint & Drafting** -- Generate chapter outlines and full drafts with configurable word counts and style guidance
- **Knowledge Retrieval (RAG)** -- Import reference materials into a ChromaDB vector store; the generator retrieves relevant context when writing each chapter
- **Consistency Checker** -- Cross-check new chapters against existing settings, character states, foreshadowing ledgers, and plot threads
- **Chapter Finalization** -- Polish and enrich drafts while preserving plot logic
- **Desktop Studio** -- Tauri v2 + React 19 + TypeScript frontend with real-time log streaming, story timeline, character relationship graph, and map editor
- **FastAPI Backend** -- RESTful API with SSE streaming for live generation progress
- **CLI Interface** -- Command-line controller for headless or Agent-driven workflows
- **Agent Skill** -- Built-in Claude Code / Codex skill for structured novel creation via AI agents
- **WebDAV Sync** -- Optional remote backup of project files

## Architecture

```
ai-novel/
├── server.py                   # FastAPI backend (API + SSE)
├── cli.py                      # CLI controller
├── config_manager.py           # Configuration load/save
├── llm_adapters.py             # Unified LLM interface (OpenAI / DeepSeek / Gemini / Azure)
├── embedding_adapters.py       # Unified Embedding interface
├── consistency_checker.py      # Cross-chapter consistency review
├── prompt_definitions.py       # Prompt templates (Chinese)
├── prompt_definitions_en.py    # Prompt templates (English)
├── novel_generator/
│   ├── architecture.py         # Novel settings generation
│   ├── blueprint.py            # Chapter blueprint generation
│   ├── chapter.py              # Chapter drafting + RAG retrieval
│   ├── finalization.py         # Chapter polishing
│   ├── knowledge.py            # Knowledge import
│   └── vectorstore_utils.py    # ChromaDB vector store management
├── frontend/                   # React + Tauri desktop app
│   ├── src/
│   │   ├── App.tsx             # Main application
│   │   ├── api/                # API client
│   │   ├── components/         # UI components
│   │   └── types/              # TypeScript types
│   └── src-tauri/              # Tauri native shell
├── .agents/skills/             # Agent skill definitions
└── scripts/                    # Utility scripts
```

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+ (for frontend)
- An LLM API key (DeepSeek, OpenAI, Gemini, etc.) or a local model server

### 1. Backend Setup

```bash
# Clone the repository
git clone https://github.com/W-Kaski/ai-novel-generater.git
cd ai-novel-generater

# Create virtual environment
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure your LLM API keys
cp config.example.json config.json
# Edit config.json with your API keys
```

### 2. Frontend Setup

```bash
cd frontend
npm install
```

### 3. Launch

**Desktop App (Tauri):**

```bash
# From project root
run_studio.bat              # Windows
# Or manually:
cd frontend && npm run tauri dev
```

**Browser Mode:**

```bash
run_browser_studio.bat      # Windows
# Or manually:
python server.py &
cd frontend && npm run dev
```

Then open `http://localhost:5173` in your browser.

**CLI Mode:**

```bash
python cli.py generate --topic "your topic" --genre "fantasy"
```

## Configuration

Copy `config.example.json` to `config.json` and fill in your settings:

| Section | Description |
|---------|-------------|
| `llm_configs` | Named LLM configurations (API key, base URL, model, temperature, etc.) |
| `embedding_configs` | Embedding model configurations for RAG retrieval |
| `choose_configs` | Select which LLM to use for each task type |
| `other_params` | Novel parameters (name, genre, topic, chapter count, word target) |
| `proxy_setting` | HTTP proxy configuration |
| `webdav_config` | WebDAV remote backup credentials |

Multiple LLM configs can coexist; assign different models to different tasks (e.g., architecture with Gemini, drafting with DeepSeek, final review with GPT).

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NOVEL_SERVER_HOST` | `127.0.0.1` | API server bind host |
| `NOVEL_SERVER_PORT` | `8000` | API server port |
| `VITE_API_BASE` | `http://127.0.0.1:8000` | Frontend API endpoint |
| `IMPORT_SOURCE` | - | Source file path for the import script |

## Project Structure for Novels

Each novel project follows this directory layout:

```
novels/<novel_name>/
├── 00_settings/          # Novel settings, world map, character state
├── 01_chapters/          # Finalized chapter files
├── 02_memory/            # Long-term memory (blueprint, foreshadowing, plot log)
├── 03_characters/
│   ├── 主要角色/         # Main characters
│   ├── 重要配角/         # Supporting characters
│   └── 阵营与规则/       # Factions and rules
├── 04_logs/              # Generation logs
└── 99_assets/            # Imported sources and drafts
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python, FastAPI, LangChain, ChromaDB |
| LLM Integration | OpenAI SDK, Google GenAI, Azure AI Inference |
| Frontend | React 19, TypeScript, Vite, ECharts |
| Desktop | Tauri v2 (Rust) |
| Agent | Claude Code Skill |

## Contributing

See [CONTRIBUTING.md](.github/CONTRIBUTING.md) for guidelines.

## License

This project is for educational and research purposes. Please comply with the terms of service of any LLM APIs you use.

## Acknowledgments

Based on [YILING0013/AI_NovelGenerator](https://github.com/YILING0013/AI_NovelGenerator).
