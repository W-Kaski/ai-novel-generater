# AI 小说生成器

[English](README.md)

基于多 LLM 的长篇小说创作平台，集成 Python 后端、React + Tauri 桌面前端和智能生成引擎，覆盖从世界观设定、角色设计到章节撰写、一致性审校、定稿的完整创作流程。

## 功能特性

- **多模型支持** -- OpenAI (GPT)、DeepSeek、Gemini、Azure 及任意 OpenAI 兼容 API，包括本地模型（Ollama、LM Studio 等）
- **小说架构生成** -- 自动生成小说设定、角色档案、势力关系、世界地图、力量体系
- **章节蓝图与撰写** -- 生成章节大纲和正文草稿，支持自定义字数和风格指导
- **知识库检索 (RAG)** -- 将参考资料导入 ChromaDB 向量库，撰写时自动检索相关上下文
- **一致性检查** -- 新章节与现有设定、角色状态、伏笔台账、剧情线索的交叉校验
- **章节定稿** -- 润色草稿并丰富细节，同时保持剧情逻辑
- **桌面创作室** -- Tauri v2 + React 19 + TypeScript 前端，支持实时日志流、故事时间线、角色关系图谱、地图编辑器
- **FastAPI 后端** -- RESTful API + SSE 实时推送生成进度
- **命令行界面** -- 支持无头模式和 Agent 驱动的创作流程
- **Agent Skill** -- 内置 Claude Code / Codex Skill，支持 AI Agent 结构化创作
- **WebDAV 同步** -- 可选的项目文件远程备份

## 系统架构

```
ai-novel/
├── server.py                   # FastAPI 后端（API + SSE 推送）
├── cli.py                      # 命令行控制器
├── config_manager.py           # 配置加载/保存
├── llm_adapters.py             # 统一 LLM 接口（OpenAI / DeepSeek / Gemini / Azure）
├── embedding_adapters.py       # 统一 Embedding 接口
├── consistency_checker.py      # 跨章节一致性审校
├── prompt_definitions.py       # 提示词模板（中文）
├── prompt_definitions_en.py    # 提示词模板（英文）
├── novel_generator/
│   ├── architecture.py         # 小说总体架构生成
│   ├── blueprint.py            # 章节蓝图生成
│   ├── chapter.py              # 章节撰写 + RAG 检索
│   ├── finalization.py         # 章节润色定稿
│   ├── knowledge.py            # 知识库导入
│   └── vectorstore_utils.py    # ChromaDB 向量库管理
├── frontend/                   # React + Tauri 桌面应用
│   ├── src/
│   │   ├── App.tsx             # 主应用
│   │   ├── api/                # API 客户端
│   │   ├── components/         # UI 组件
│   │   └── types/              # TypeScript 类型定义
│   └── src-tauri/              # Tauri 原生壳
├── .agents/skills/             # Agent Skill 定义
└── scripts/                    # 工具脚本
```

## 快速开始

### 环境要求

- Python 3.10+
- Node.js 18+（前端构建）
- 一个 LLM API Key（DeepSeek、OpenAI、Gemini 等）或本地模型服务

### 1. 后端配置

```bash
# 克隆仓库
git clone https://github.com/W-Kaski/ai-novel-generater.git
cd ai-novel-generater

# 创建虚拟环境
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 配置 LLM API Key
cp config.example.json config.json
# 编辑 config.json 填入你的 API Key
```

### 2. 前端配置

```bash
cd frontend
npm install
```

### 3. 启动

**桌面应用（Tauri）：**

```bash
# 项目根目录执行
run_studio.bat              # Windows
# 或手动启动：
cd frontend && npm run tauri dev
```

**浏览器模式：**

```bash
run_browser_studio.bat      # Windows
# 或手动启动：
python server.py &
cd frontend && npm run dev
```

然后在浏览器中打开 `http://localhost:5173`。

**命令行模式：**

```bash
python cli.py generate --topic "你的主题" --genre "玄幻"
```

## 配置说明

将 `config.example.json` 复制为 `config.json` 后编辑：

| 配置段 | 说明 |
|--------|------|
| `llm_configs` | 命名的 LLM 配置（API Key、Base URL、模型名、温度等） |
| `embedding_configs` | Embedding 模型配置，用于 RAG 知识检索 |
| `choose_configs` | 为不同任务类型指定使用的 LLM |
| `other_params` | 小说参数（名称、题材、主题、章节数、字数目标） |
| `proxy_setting` | HTTP 代理配置 |
| `webdav_config` | WebDAV 远程备份凭据 |

支持同时配置多个 LLM，为不同任务分配不同模型（如架构用 Gemini、撰写用 DeepSeek、终审用 GPT）。

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `NOVEL_SERVER_HOST` | `127.0.0.1` | API 服务绑定地址 |
| `NOVEL_SERVER_PORT` | `8000` | API 服务端口 |
| `VITE_API_BASE` | `http://127.0.0.1:8000` | 前端 API 地址 |
| `IMPORT_SOURCE` | - | 导入脚本的源文件路径 |

## 小说项目目录结构

每个小说项目遵循以下目录规范：

```
novels/<作品名>/
├── 00_settings/          # 小说设定、世界地图、角色状态
├── 01_chapters/          # 定稿章节文件
├── 02_memory/            # 长期记忆（蓝图、伏笔台账、剧情日志）
├── 03_characters/
│   ├── 主要角色/         # 主角档案
│   ├── 重要配角/         # 配角档案
│   └── 阵营与规则/       # 势力与规则设定
├── 04_logs/              # 生成日志
└── 99_assets/            # 导入资料和草稿
```

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Python, FastAPI, LangChain, ChromaDB |
| LLM 集成 | OpenAI SDK, Google GenAI, Azure AI Inference |
| 前端 | React 19, TypeScript, Vite, ECharts |
| 桌面端 | Tauri v2 (Rust) |
| Agent | Claude Code Skill |

## 参与贡献

请阅读 [CONTRIBUTING.md](.github/CONTRIBUTING.md) 了解贡献规范。

## 许可说明

本项目仅供学习和研究使用。使用 LLM API 时请遵守相应服务条款。

## 致谢

基于 [YILING0013/AI_NovelGenerator](https://github.com/YILING0013/AI_NovelGenerator) 开发。
