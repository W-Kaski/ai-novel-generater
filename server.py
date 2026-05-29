# server.py
# -*- coding: utf-8 -*-
import os
import queue
import logging
import threading
import traceback
import glob
from typing import Dict, Any, List, Optional
from fastapi import FastAPI, BackgroundTasks, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

# Import existing backend modules
from config_manager import load_config, save_config, test_llm_config, test_embedding_config
from utils import (
    read_file,
    save_string_to_txt,
    clear_file_content,
    get_word_count,
    resolve_text_path,
    text_file_exists,
    chapters_drafts_dir,
    ensure_project_structure
)
from novel_generator import (
    novel_settings_generate,
    Chapter_blueprint_generate,
    generate_chapter_draft,
    finalize_chapter,
    import_knowledge_file,
    clear_vector_store,
    enrich_chapter_text,
    build_chapter_prompt
)
from consistency_checker import check_consistency

app = FastAPI(title="AI Novel Generator API Server", version="2.0.0")

# Setup CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global logging queue for SSE (Server-Sent Events)
log_queue = queue.Queue()

def log_to_queue(msg: str):
    log_queue.put(msg)

class QueueLoggingHandler(logging.Handler):
    def emit(self, record):
        try:
            msg = self.format(record)
            log_queue.put(msg)
        except Exception:
            self.handleError(record)

# Set up logging handler to intercept all internal logs and stream them to frontend
root_logger = logging.getLogger()
handler = QueueLoggingHandler()
handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
root_logger.addHandler(handler)
root_logger.setLevel(logging.INFO)

# Config file path
CONFIG_FILE = "config.json"

# ----------------- Request schemas -----------------
class LLMTestPayload(BaseModel):
    interface_format: str
    api_key: str
    base_url: str
    model_name: str
    temperature: float
    max_tokens: int
    timeout: int

class EmbeddingTestPayload(BaseModel):
    interface_format: str
    api_key: str
    base_url: str
    model_name: str

class GenerateArchitecturePayload(BaseModel):
    model_key: str
    novel_name: str = ""
    topic: str
    genre: str
    target_audience: str = ""
    platform_style: str = ""
    writing_style: str = ""
    pacing_requirement: str = ""
    num_chapters: int
    word_number: int
    user_guidance: str
    filepath: str

class GenerateBlueprintPayload(BaseModel):
    model_key: str
    num_chapters: int
    filepath: str

class BuildPromptPayload(BaseModel):
    model_key: str
    chapter_num: int
    word_number: int
    user_guidance: str
    characters_involved: str
    key_items: str
    scene_location: str
    time_constraint: str
    embedding_key: str
    filepath: str

class GenerateDraftPayload(BaseModel):
    model_key: str
    chapter_num: int
    word_number: int
    user_guidance: str
    characters_involved: str
    key_items: str
    scene_location: str
    time_constraint: str
    embedding_key: str
    filepath: str
    custom_prompt_text: str

class FinalizeChapterPayload(BaseModel):
    model_key: str
    embedding_key: str
    chapter_num: int
    word_number: int
    filepath: str
    chapter_text: str
    should_enrich: bool

class ConsistencyCheckPayload(BaseModel):
    model_key: str
    chapter_num: int
    filepath: str

class ImportKnowledgePayload(BaseModel):
    embedding_key: str
    filepath: str
    file_content: str
    file_name: str

class SaveFilePayload(BaseModel):
    filepath: str
    file_name: str
    content: str

class ChatPayload(BaseModel):
    model_key: str
    user_msg: str
    history: List[Dict[str, str]]


# ----------------- Helper functions -----------------
def get_llm_config_by_key(config: Dict[str, Any], key: str) -> Dict[str, Any]:
    llm_configs = config.get("llm_configs", {})
    if key in llm_configs:
        return llm_configs[key]
    if llm_configs:
        return next(iter(llm_configs.values()))
    raise HTTPException(status_code=400, detail=f"LLM Config key '{key}' not found, and no default available.")

def get_embedding_config_by_key(config: Dict[str, Any], key: str) -> Dict[str, Any]:
    emb_configs = config.get("embedding_configs", {})
    if key in emb_configs:
        return emb_configs[key]
    if emb_configs:
        return next(iter(emb_configs.values()))
    raise HTTPException(status_code=400, detail=f"Embedding Config key '{key}' not found, and no default available.")

# ----------------- Endpoints -----------------

@app.get("/api/logs")
async def get_logs_stream():
    """Streaming log channel via Server-Sent Events (SSE)."""
    def log_generator():
        # Yield first welcome message
        yield "data: 🚀 实时日志连接成功！\n\n"
        while True:
            try:
                # Retrieve from queue without blocking indefinitely to allow heartbeat
                msg = log_queue.get(timeout=1.0)
                yield f"data: {msg}\n\n"
            except queue.Empty:
                # Heartbeat to keep connection alive
                yield "data: ping\n\n"
            except Exception as e:
                yield f"data: 🛑 日志流读取异常: {str(e)}\n\n"

    return StreamingResponse(log_generator(), media_type="text/event-stream")

@app.get("/api/config")
def read_app_config():
    """Read global config.json."""
    try:
        config = load_config(CONFIG_FILE)
        return config
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load config: {str(e)}")

@app.post("/api/config")
def update_app_config(payload: Dict[str, Any] = Body(...)):
    """Save updated global config.json."""
    try:
        success = save_config(payload, CONFIG_FILE)
        if success:
            return {"status": "success", "message": "配置保存成功"}
        else:
            raise HTTPException(status_code=500, detail="Failed to save config file.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving config: {str(e)}")

@app.post("/api/test/llm")
def api_test_llm(payload: LLMTestPayload):
    """Test LLM API endpoint."""
    test_logs = []
    def log_collector(msg: str):
        test_logs.append(msg)
        log_to_queue(msg)

    def exc_handler(ctx: str):
        err_msg = f"测试异常 [{ctx}]: {traceback.format_exc()}"
        test_logs.append(err_msg)
        log_to_queue(err_msg)

    # Sync block for config testing to return result immediately and reliably
    try:
        test_llm_config(
            interface_format=payload.interface_format,
            api_key=payload.api_key,
            base_url=payload.base_url,
            model_name=payload.model_name,
            temperature=payload.temperature,
            max_tokens=payload.max_tokens,
            timeout=payload.timeout,
            log_func=log_collector,
            handle_exception_func=exc_handler,
            run_sync=True
        )
        return {"status": "completed", "logs": test_logs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/test/embedding")
def api_test_embedding(payload: EmbeddingTestPayload):
    """Test Embedding API endpoint."""
    test_logs = []
    def log_collector(msg: str):
        test_logs.append(msg)
        log_to_queue(msg)

    def exc_handler(ctx: str):
        err_msg = f"测试异常 [{ctx}]: {traceback.format_exc()}"
        test_logs.append(err_msg)
        log_to_queue(err_msg)

    try:
        test_embedding_config(
            api_key=payload.api_key,
            base_url=payload.base_url,
            interface_format=payload.interface_format,
            model_name=payload.model_name,
            log_func=log_collector,
            handle_exception_func=exc_handler,
            run_sync=True
        )
        return {"status": "completed", "logs": test_logs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate/architecture")
def api_generate_architecture(payload: GenerateArchitecturePayload, background_tasks: BackgroundTasks):
    """Generate novel architecture (大纲)."""
    config = load_config(CONFIG_FILE)
    llm_conf = get_llm_config_by_key(config, payload.model_key)
    setting_guidance = "\n".join(
        part for part in [
            f"小说名称：{payload.novel_name}" if payload.novel_name else "",
            f"目标读者：{payload.target_audience}" if payload.target_audience else "",
            f"平台风格：{payload.platform_style}" if payload.platform_style else "",
            f"语言风格：{payload.writing_style}" if payload.writing_style else "",
            f"节奏要求：{payload.pacing_requirement}" if payload.pacing_requirement else "",
            payload.user_guidance or "",
        ] if part
    )

    def run_task():
        try:
            log_to_queue("--- [开始] 正在为您生成小说总体架构... ---")
            novel_settings_generate(
                interface_format=llm_conf.get("interface_format", "OpenAI"),
                api_key=llm_conf.get("api_key", ""),
                base_url=llm_conf.get("base_url", ""),
                llm_model=llm_conf.get("model_name", ""),
                topic=payload.topic,
                genre=payload.genre,
                number_of_chapters=payload.num_chapters,
                word_number=payload.word_number,
                filepath=payload.filepath,
                temperature=llm_conf.get("temperature", 0.7),
                max_tokens=llm_conf.get("max_tokens", 8192),
                timeout=llm_conf.get("timeout", 600),
                user_guidance=setting_guidance
            )
            log_to_queue("✅ 小说总体架构已顺利生成完毕！")
        except Exception as e:
            err_details = f"❌ 生成小说架构时发生致命错误: {str(e)}\n{traceback.format_exc()}"
            log_to_queue(err_details)

    background_tasks.add_task(run_task)
    return {"status": "pending", "message": "已将总体架构生成任务派发至后台。"}

@app.post("/api/generate/blueprint")
def api_generate_blueprint(payload: GenerateBlueprintPayload, background_tasks: BackgroundTasks):
    """Generate chapter blueprint (目录)."""
    config = load_config(CONFIG_FILE)
    llm_conf = get_llm_config_by_key(config, payload.model_key)

    def run_task():
        try:
            log_to_queue("--- [开始] 正在生成各章节详细目录... ---")
            Chapter_blueprint_generate(
                api_key=llm_conf.get("api_key", ""),
                base_url=llm_conf.get("base_url", ""),
                llm_model=llm_conf.get("model_name", ""),
                number_of_chapters=payload.num_chapters,
                filepath=payload.filepath,
                temperature=llm_conf.get("temperature", 0.7),
                max_tokens=llm_conf.get("max_tokens", 8192),
                timeout=llm_conf.get("timeout", 600),
                interface_format=llm_conf.get("interface_format", "OpenAI")
            )
            log_to_queue("✅ 章节目录生成已圆满成功！")
        except Exception as e:
            err_details = f"❌ 生成章节目录时发生致命错误: {str(e)}\n{traceback.format_exc()}"
            log_to_queue(err_details)

    background_tasks.add_task(run_task)
    return {"status": "pending", "message": "已将章节大纲生成任务派发至后台。"}

@app.post("/api/generate/build_prompt")
def api_build_prompt(payload: BuildPromptPayload):
    """Compile specific prompt for current chapter generation (with roles, vectorstore documents, etc.)."""
    config = load_config(CONFIG_FILE)
    llm_conf = get_llm_config_by_key(config, payload.model_key)
    emb_conf = get_embedding_config_by_key(config, payload.embedding_key)

    try:
        log_to_queue(f"🔍 正在编译第 {payload.chapter_num} 章的提示词框架...")
        prompt_text = build_chapter_prompt(
            api_key=llm_conf.get("api_key", ""),
            base_url=llm_conf.get("base_url", ""),
            model_name=llm_conf.get("model_name", ""),
            filepath=payload.filepath,
            novel_number=payload.chapter_num,
            word_number=payload.word_number,
            temperature=llm_conf.get("temperature", 0.7),
            user_guidance=payload.user_guidance,
            characters_involved=payload.characters_involved,
            key_items=payload.key_items,
            scene_location=payload.scene_location,
            time_constraint=payload.time_constraint,
            embedding_api_key=emb_conf.get("api_key", ""),
            embedding_url=emb_conf.get("base_url", ""),
            embedding_interface_format=emb_conf.get("interface_format", "OpenAI"),
            embedding_model_name=emb_conf.get("model_name", ""),
            embedding_retrieval_k=int(emb_conf.get("retrieval_k", 4)),
            interface_format=llm_conf.get("interface_format", "OpenAI"),
            max_tokens=llm_conf.get("max_tokens", 8192),
            timeout=llm_conf.get("timeout", 600)
        )

        # Inject character state profiles if available (just like Python Tkinter GUI does)
        role_names = [name.strip() for name in payload.characters_involved.split(",") if name.strip()]
        role_lib_path = os.path.join(payload.filepath, "03_characters")
        role_contents = []
        if os.path.exists(role_lib_path):
            for root, _, files in os.walk(role_lib_path):
                for f in files:
                    if (f.endswith(".md") or f.endswith(".txt")) and os.path.splitext(f)[0] in role_names:
                        file_path = os.path.join(root, f)
                        try:
                            with open(file_path, 'r', encoding='utf-8') as rf:
                                role_contents.append(rf.read().strip())
                        except Exception as ree:
                            log_to_queue(f"⚠️ 读取角色资料失败 {f}: {str(ree)}")
        
        if role_contents:
            role_content_str = "\n".join(role_contents)
            placeholder_variations = [
                "Core characters (may not be specified): {characters_involved}",
                "Core characters: {characters_involved}",
                "核心人物(可能未指定)：{characters_involved}",
                "核心人物：{characters_involved}",
                "核心人物(可能未指定):{characters_involved}",
                "核心人物:{characters_involved}"
            ]
            for placeholder in placeholder_variations:
                if placeholder in prompt_text:
                    prompt_text = prompt_text.replace(placeholder, f"核心人物：\n{role_content_str}")
                    break
            else:
                # If no placeholder matched, do simple replacement
                lines = prompt_text.split('\n')
                for line_idx, line in enumerate(lines):
                    if "核心人物" in line and ("：" in line or ":" in line):
                        lines[line_idx] = f"核心人物：\n{role_content_str}"
                        break
                prompt_text = '\n'.join(lines)

        return {"status": "success", "prompt": prompt_text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prompt compilation failed: {str(e)}\n{traceback.format_exc()}")

@app.post("/api/generate/draft")
def api_generate_draft(payload: GenerateDraftPayload, background_tasks: BackgroundTasks):
    """Generate chapter draft (草稿) based on prompt."""
    config = load_config(CONFIG_FILE)
    llm_conf = get_llm_config_by_key(config, payload.model_key)
    emb_conf = get_embedding_config_by_key(config, payload.embedding_key)

    def run_task():
        try:
            log_to_queue(f"--- [开始] 正在为您进行第 {payload.chapter_num} 章草稿创作... ---")
            draft_text = generate_chapter_draft(
                api_key=llm_conf.get("api_key", ""),
                base_url=llm_conf.get("base_url", ""),
                model_name=llm_conf.get("model_name", ""),
                filepath=payload.filepath,
                novel_number=payload.chapter_num,
                word_number=payload.word_number,
                temperature=llm_conf.get("temperature", 0.7),
                user_guidance=payload.user_guidance,
                characters_involved=payload.characters_involved,
                key_items=payload.key_items,
                scene_location=payload.scene_location,
                time_constraint=payload.time_constraint,
                embedding_api_key=emb_conf.get("api_key", ""),
                embedding_url=emb_conf.get("base_url", ""),
                embedding_interface_format=emb_conf.get("interface_format", "OpenAI"),
                embedding_model_name=emb_conf.get("model_name", ""),
                embedding_retrieval_k=int(emb_conf.get("retrieval_k", 4)),
                interface_format=llm_conf.get("interface_format", "OpenAI"),
                max_tokens=llm_conf.get("max_tokens", 8192),
                timeout=llm_conf.get("timeout", 600),
                custom_prompt_text=payload.custom_prompt_text
            )
            if draft_text:
                log_to_queue(f"✅ 第 {payload.chapter_num} 章草稿生成任务大功告成！")
            else:
                log_to_queue(f"⚠️ 第 {payload.chapter_num} 章草稿生成结束，但返回内容为空。")
        except Exception as e:
            err_details = f"❌ 章节草稿生成出错: {str(e)}\n{traceback.format_exc()}"
            log_to_queue(err_details)

    background_tasks.add_task(run_task)
    return {"status": "pending", "message": "已将草稿生成任务提交至后台线程。"}

@app.post("/api/generate/finalize")
def api_finalize_chapter(payload: FinalizeChapterPayload, background_tasks: BackgroundTasks):
    """Finalize chapter (定稿) and potentially enrich/expand text."""
    config = load_config(CONFIG_FILE)
    llm_conf = get_llm_config_by_key(config, payload.model_key)
    emb_conf = get_embedding_config_by_key(config, payload.embedding_key)

    def run_task():
        try:
            current_text = payload.chapter_text
            
            # Auto-enrichment phase if word count is insufficient
            if payload.should_enrich:
                log_to_queue("🪄 检测到本章内容较短，正在运用 AI 进行智能扩写...")
                enriched_text = enrich_chapter_text(
                    chapter_text=current_text,
                    word_number=payload.word_number,
                    api_key=llm_conf.get("api_key", ""),
                    base_url=llm_conf.get("base_url", ""),
                    model_name=llm_conf.get("model_name", ""),
                    temperature=llm_conf.get("temperature", 0.7),
                    interface_format=llm_conf.get("interface_format", "OpenAI"),
                    max_tokens=llm_conf.get("max_tokens", 8192),
                    timeout=llm_conf.get("timeout", 600)
                )
                current_text = enriched_text
                log_to_queue("✨ 扩写完毕，正在保存扩写后的最终草稿...")
            
            # Save final draft content to drafts directory first
            ensure_project_structure(payload.filepath)
            drafts_dir = chapters_drafts_dir(payload.filepath)
            chapter_draft_path = resolve_text_path(os.path.join(drafts_dir, f"chapter_{payload.chapter_num}.md"), for_write=True)
            
            clear_file_content(chapter_draft_path)
            save_string_to_txt(current_text, chapter_draft_path)

            log_to_queue(f"🏁 正在执行定稿流程，优化第 {payload.chapter_num} 章排版、更新角色状态，并尝试同步至知识库...")
            finalize_chapter(
                novel_number=payload.chapter_num,
                word_number=payload.word_number,
                api_key=llm_conf.get("api_key", ""),
                base_url=llm_conf.get("base_url", ""),
                model_name=llm_conf.get("model_name", ""),
                temperature=llm_conf.get("temperature", 0.7),
                filepath=payload.filepath,
                embedding_api_key=emb_conf.get("api_key", ""),
                embedding_url=emb_conf.get("base_url", ""),
                embedding_interface_format=emb_conf.get("interface_format", "OpenAI"),
                embedding_model_name=emb_conf.get("model_name", ""),
                interface_format=llm_conf.get("interface_format", "OpenAI"),
                max_tokens=llm_conf.get("max_tokens", 8192),
                timeout=llm_conf.get("timeout", 600)
            )
            log_to_queue(f"🎉 恭喜！第 {payload.chapter_num} 章定稿正式完成，角色状态已更新，并已尝试同步知识库！")
        except Exception as e:
            err_details = f"❌ 定稿任务失败: {str(e)}\n{traceback.format_exc()}"
            log_to_queue(err_details)

    background_tasks.add_task(run_task)
    return {"status": "pending", "message": "定稿与智能润色任务已在后台执行。"}

@app.post("/api/check-consistency")
def api_check_consistency(payload: ConsistencyCheckPayload):
    """Check narrative consistency of current chapter (审校)."""
    config = load_config(CONFIG_FILE)
    llm_conf = get_llm_config_by_key(config, payload.model_key)

    try:
        log_to_queue(f"🛠️ 正在对第 {payload.chapter_num} 章执行人设与设定一致性校验...")
        
        # Read narrative sources
        character_state = read_file(os.path.join(payload.filepath, "character_state.md"))
        novel_setting_text = read_file(resolve_text_path(os.path.join(payload.filepath, "novel_settings.md")))
        novel_directory = read_file(os.path.join(payload.filepath, "novel_directory.md"))
        foreshadowing = read_file(os.path.join(payload.filepath, "foreshadowing_ledger.md"))
        plot_arcs_text = read_file(os.path.join(payload.filepath, "plot_arcs.md"))
        memory_context = (
            f"【章节蓝图】\n{novel_directory}\n\n"
            f"【伏笔台账】\n{foreshadowing}\n\n"
            f"【人物轨时间线】\n{plot_arcs_text}"
        )
        
        # Look in 01_chapters directory
        chapter_file = os.path.join(payload.filepath, "01_chapters", f"chapter_{payload.chapter_num}.md")
        chapter_text = read_file(chapter_file)

        if not chapter_text.strip():
            return {"status": "error", "message": "当前章节内容为空，无法校验"}

        result = check_consistency(
            novel_setting=novel_setting_text,
            character_state=character_state,
            memory_context=memory_context,
            chapter_text=chapter_text,
            api_key=llm_conf.get("api_key", ""),
            base_url=llm_conf.get("base_url", ""),
            model_name=llm_conf.get("model_name", ""),
            temperature=llm_conf.get("temperature", 0.3),
            interface_format=llm_conf.get("interface_format", "OpenAI"),
            max_tokens=llm_conf.get("max_tokens", 8192),
            timeout=llm_conf.get("timeout", 600)
        )
        log_to_queue("✅ 一致性审校完成！")
        return {"status": "success", "result": result}
    except Exception as e:
        log_to_queue(f"❌ 校验失败: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/knowledge/import")
def api_import_knowledge(payload: ImportKnowledgePayload, background_tasks: BackgroundTasks):
    """Import markdown knowledge details to Vectorstore."""
    config = load_config(CONFIG_FILE)
    emb_conf = get_embedding_config_by_key(config, payload.embedding_key)

    def run_task():
        # Write temporary markdown block file to pass to internal function
        import tempfile
        try:
            log_to_queue(f"📚 正在对导入的知识文档 '{payload.file_name}' 进行切片与向量入库...")
            with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', delete=False, suffix='.md') as temp:
                temp.write(payload.file_content)
                temp_path = temp.name

            try:
                import_knowledge_file(
                    embedding_api_key=emb_conf.get("api_key", ""),
                    embedding_url=emb_conf.get("base_url", ""),
                    embedding_interface_format=emb_conf.get("interface_format", "OpenAI"),
                    embedding_model_name=emb_conf.get("model_name", ""),
                    file_path=temp_path,
                    filepath=payload.filepath
                )
                log_to_queue(f"✅ 知识库文件 '{payload.file_name}' 成功写入向量数据库！")
            finally:
                try:
                    os.unlink(temp_path)
                except:
                    pass
        except Exception as e:
            log_to_queue(f"❌ 导入知识文档失败: {str(e)}")

    background_tasks.add_task(run_task)
    return {"status": "pending", "message": "知识库文档切片任务已安排。"}

@app.post("/api/knowledge/clear")
def api_clear_knowledge(payload: Dict[str, str] = Body(...)):
    """Clear all vectorstore data."""
    filepath = payload.get("filepath", "")
    if not filepath:
        raise HTTPException(status_code=400, detail="filepath is required")
    
    try:
        success = clear_vector_store(filepath)
        if success:
            log_to_queue("🧹 本地向量库已被彻底清除。")
            return {"status": "success", "message": "向量库清空成功"}
        else:
            return {"status": "error", "message": "未找到向量库目录或清空失败"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ----------------- Project picker (web UI) -----------------

def _repo_root() -> str:
    return os.path.dirname(os.path.abspath(__file__))


@app.get("/api/projects")
def api_list_projects():
    """List novel workspaces under novels/ for browser-based project switching."""
    novels_dir = os.path.join(_repo_root(), "novels")
    projects: List[Dict[str, Any]] = []
    if os.path.isdir(novels_dir):
        for name in sorted(os.listdir(novels_dir)):
            path = os.path.join(novels_dir, name)
            if os.path.isdir(path):
                settings = os.path.join(path, "00_settings")
                projects.append({
                    "name": name,
                    "path": path,
                    "has_settings": os.path.isdir(settings),
                })
    return {
        "novels_root": novels_dir,
        "projects": projects,
    }


@app.get("/api/projects/validate")
def api_validate_project_path(path: str):
    """Check whether a filesystem path is a usable novel workspace."""
    if not path or not path.strip():
        raise HTTPException(status_code=400, detail="path is required")
    norm = os.path.normpath(path.strip())
    if not os.path.isdir(norm):
        return {"valid": False, "path": norm, "message": "路径不存在或不是文件夹"}
    return {
        "valid": True,
        "path": norm,
        "name": os.path.basename(norm),
        "has_settings": os.path.isdir(os.path.join(norm, "00_settings")),
    }


# ----------------- File Watcher & Editor API -----------------

def migrate_novel_workspace_folders(filepath: str):
    """Ensure the current novel workspace folder structure exists."""
    if not filepath or not os.path.exists(filepath):
        return

    ensure_project_structure(filepath)

@app.get("/api/files/watch")
def api_watch_files(filepath: str):
    """Retrieve full content of core configuration markdown files for frontend editor preview."""
    if not filepath or not os.path.exists(filepath):
        return {"files": {}}

    # Perform folders migration on load
    migrate_novel_workspace_folders(filepath)

    files_to_watch = {
        "novel_settings": "novel_settings.md",
        "novel_directory": "novel_directory.md",
        "character_state": "character_state.md",
        "foreshadowing_ledger": "foreshadowing_ledger.md"
    }

    result = {}
    for key, val in files_to_watch.items():
        file_path = resolve_text_path(os.path.join(filepath, val))
        if os.path.exists(file_path):
            content = read_file(file_path)
            result[key] = {
                "exists": True,
                "content": content,
                "word_count": get_word_count(content)
            }
        else:
            result[key] = {"exists": False, "content": ""}

    return {"files": result}


@app.post("/api/files/save")
def api_save_file(payload: SaveFilePayload):
    """Save content of modified core markdown file."""
    if not payload.filepath or not os.path.exists(payload.filepath):
        raise HTTPException(status_code=400, detail="Invalid project workspace path")

    target_path = resolve_text_path(os.path.join(payload.filepath, payload.file_name), for_write=True)
    try:
        clear_file_content(target_path)
        save_string_to_txt(payload.content, target_path)
        log_to_queue(f"💾 编辑修改已成功保存至: {payload.file_name}")
        return {"status": "success", "message": f"文件 {payload.file_name} 保存成功"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"保存失败: {str(e)}")


@app.get("/api/character_state")
def api_get_character_state(filepath: str):
    """Retrieve character_state.md content for timeline display."""
    if not filepath or not os.path.exists(filepath):
        return {"content": ""}

    try:
        file_path = resolve_text_path(os.path.join(filepath, "character_state.md"))
        if os.path.exists(file_path):
            content = read_file(file_path)
            return {"content": content}
        else:
            return {"content": ""}
    except Exception as e:
        log_to_queue(f"❌ 读取角色状态文件失败: {str(e)}")
        return {"content": ""}

@app.get("/api/chapters")
def api_list_chapters(filepath: str):
    """Fetch lists of chapter drafts and finalized chapters."""
    if not filepath or not os.path.exists(filepath):
        return {"drafts": [], "finalized": []}

    drafts_dir = chapters_drafts_dir(filepath)

    draft_files = []
    if os.path.exists(drafts_dir):
        draft_files = [
            os.path.basename(f)
            for f in glob.glob(os.path.join(drafts_dir, "chapter_*.md")) + glob.glob(os.path.join(drafts_dir, "chapter_*.txt"))
        ]

    # Helper function to extract numeric order from file names like chapter_10.md
    def sort_key(name: str):
        try:
            return int(name.split('_')[1].split('.')[0])
        except:
            return 9999

    draft_files.sort(key=sort_key)

    # Since the workspace is flattened, both drafts and finalized files are equivalent and stored under 01_chapters
    return {
        "drafts": draft_files,
        "finalized": draft_files
    }

@app.get("/api/chapter/content")
def api_get_chapter_content(filepath: str, chapter_name: str, is_draft: bool):
    """Fetch the text content of a single specific chapter."""
    target_dir = chapters_drafts_dir(filepath)
    file_path = os.path.join(target_dir, chapter_name)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Chapter file not found")

    content = read_file(file_path)
    return {
        "content": content,
        "word_count": get_word_count(content)
    }

@app.get("/api/roles")
def api_list_roles(filepath: str):
    """Retrieve categorized character profiles."""
    role_lib_path = os.path.join(filepath, "03_characters")
    if not os.path.exists(role_lib_path):
        return {"categories": []}

    categories = []
    for category in os.listdir(role_lib_path):
        category_path = os.path.join(role_lib_path, category)
        if os.path.isdir(category_path):
            roles = []
            for role_file in os.listdir(category_path):
                if role_file.endswith(".md") or role_file.endswith(".txt"):
                    role_name = os.path.splitext(role_file)[0]
                    role_content = read_file(os.path.join(category_path, role_file))
                    roles.append({
                        "name": role_name,
                        "file_name": role_file,
                        "content": role_content
                    })
            categories.append({
                "name": category,
                "roles": roles
            })
            
    return {"categories": categories}

@app.post("/api/roles")
def api_save_role(payload: Dict[str, str] = Body(...)):
    """Save/update a character profile under a specific category."""
    filepath = payload.get("filepath", "")
    category = payload.get("category", "")
    role_name = payload.get("role_name", "")
    content = payload.get("content", "")

    if not filepath or not category or not role_name:
        raise HTTPException(status_code=400, detail="Missing required parameters")

    role_dir = os.path.join(filepath, "03_characters", category)
    os.makedirs(role_dir, exist_ok=True)
    
    role_file_path = os.path.join(role_dir, f"{role_name}.md")
    try:
        with open(role_file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        log_to_queue(f"👤 角色 '{role_name}' 资料已保存至角色档案 [{category}]")
        return {"status": "success", "message": "角色档案更新成功"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/roles/delete")
def api_delete_role(payload: Dict[str, str] = Body(...)):
    """Delete a character profile file."""
    filepath = payload.get("filepath", "")
    category = payload.get("category", "")
    role_name = payload.get("role_name", "")

    log_to_queue(f"🗑️ 收到删除角色请求: filepath={filepath}, category={category}, role_name={role_name}")

    if not filepath or not category or not role_name:
        raise HTTPException(status_code=400, detail="Missing required parameters")
    
    role_file_path = os.path.join(filepath, "03_characters", category, f"{role_name}.md")
    if not os.path.exists(role_file_path):
        # Fallback check for .txt file
        role_file_path = os.path.join(filepath, "03_characters", category, f"{role_name}.txt")
        
    if os.path.exists(role_file_path):
        try:
            os.remove(role_file_path)
            # Auto clean up empty folder category
            category_dir = os.path.dirname(role_file_path)
            if os.path.exists(category_dir) and len(os.listdir(category_dir)) == 0:
                os.rmdir(category_dir)
            log_to_queue(f"👤 角色 '{role_name}' 已成功从角色档案 [{category}] 中删除")
            return {"status": "success", "message": "角色删除成功"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    else:
        raise HTTPException(status_code=404, detail="Role file not found")

class SavePlotArcsPayload(BaseModel):
    filepath: str
    data: Dict[str, Any]


def _project_plot_names(filepath: str) -> tuple:
    """Return (protagonist, antagonist) labels for legacy v1 migration."""
    base = os.path.basename(os.path.normpath(filepath or ""))
    if base == "道诡异仙":
        return "李火旺", "丹阳子"
    return "沈青灯", "大祭司"


def _migrate_plot_arcs_v1_to_v2(v1_list: List[Dict[str, Any]], filepath: str = "") -> Dict[str, Any]:
    """Migrate legacy main_line/hidden_line/intersection rows to character beats."""
    hero, rival = _project_plot_names(filepath)
    chapters = []
    for item in v1_list:
        ch = int(item.get("chapter_num", 1))
        main = (item.get("main_line") or "").strip()
        hidden = (item.get("hidden_line") or "").strip()
        inter = (item.get("intersection") or "").strip()
        beats: List[Dict[str, Any]] = []
        merge_sid = "merged" if inter else None
        if main:
            beats.append({
                "character": hero,
                "event": main,
                "scene_id": merge_sid or "s0",
            })
        if hidden:
            beats.append({
                "character": rival,
                "event": hidden,
                "scene_id": merge_sid or "s1",
            })
        if inter and len(beats) >= 2:
            for b in beats:
                b["scene_id"] = "merged"
        chapters.append({"chapter_num": ch, "beats": beats})
    return {"schema_version": 2, "chapters": chapters}


def _default_plot_arcs_v2_daogui() -> Dict[str, Any]:
    return {
        "schema_version": 2,
        "chapters": [
            {
                "chapter_num": 1,
                "beats": [
                    {"character": "李火旺", "event": "料房捣药，砸伤同门", "scene_id": "s1"},
                    {"character": "白灵淼", "event": "遭欺凌，躲到李火旺身后", "scene_id": "s1"},
                    {"character": "丹阳子", "event": "处死师姐献祭丹炉", "scene_id": "merged"},
                ],
            },
            {
                "chapter_num": 2,
                "beats": [
                    {"character": "李火旺", "event": "回病房见医生", "scene_id": "s0"},
                    {"character": "李医生", "event": "强调幻觉为假", "scene_id": "s1"},
                    {"character": "杨娜", "event": "探视约定同考大学", "scene_id": "merged"},
                ],
            },
            {
                "chapter_num": 3,
                "beats": [
                    {"character": "李火旺", "event": "糖块渗透现实", "scene_id": "s0"},
                    {"character": "玄阳", "event": "玉佩被惦记", "scene_id": "s1"},
                ],
            },
        ]
        + [{"chapter_num": ch, "beats": []} for ch in range(4, 11)],
    }


def _default_plot_arcs_v2_wuming() -> Dict[str, Any]:
    chapters = [
        {
            "chapter_num": 1,
            "beats": [
                {"character": "沈青灯", "event": "神庙清洗潮化者，夺名权柄初醒", "scene_id": "merged"},
                {"character": "大祭司", "event": "暗中观察测试，判断是否为无名之母残骸", "scene_id": "merged"},
            ],
        },
        {
            "chapter_num": 2,
            "beats": [
                {"character": "沈青灯", "event": "带假名逃离神庙，混入临渊城贫民窟", "scene_id": "s0"},
                {"character": "大祭司", "event": "签发绝杀令，死士挨家排查", "scene_id": "s1"},
            ],
        },
        {
            "chapter_num": 3,
            "beats": [
                {"character": "沈青灯", "event": "救阿阙，再次动用真名击杀死士首领", "scene_id": "merged"},
                {"character": "大祭司", "event": "死士追杀至贫民窟", "scene_id": "merged"},
                {"character": "阿阙", "event": "潮化病变暴走", "scene_id": "merged"},
            ],
        },
    ]
    for ch in range(4, 11):
        chapters.append({"chapter_num": ch, "beats": []})
    return {"schema_version": 2, "chapters": chapters}


def _default_plot_arcs_v2(filepath: str = "") -> Dict[str, Any]:
    if os.path.basename(os.path.normpath(filepath or "")) == "道诡异仙":
        return _default_plot_arcs_v2_daogui()
    return _default_plot_arcs_v2_wuming()


def _layout_chapter_groups(chapter: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Per-chapter independent rows; same scene_id merges to one node."""
    beats = chapter.get("beats") or []
    order: List[str] = []
    groups: Dict[str, List[Dict[str, Any]]] = {}
    for i, b in enumerate(beats):
        char = (b.get("character") or "").strip()
        if not char:
            continue
        sid = (b.get("scene_id") or "").strip() or f"solo-{i}"
        if sid not in groups:
            order.append(sid)
            groups[sid] = []
        groups[sid].append(b)
    result = []
    for row, sid in enumerate(order, start=1):
        g = groups[sid]
        result.append({"row": row, "scene_id": sid, "beats": g, "merged": len(g) > 1})
    return result


def _compile_plot_arcs_md(filepath: str, data: Dict[str, Any]) -> str:
    novel_title = os.path.basename(os.path.normpath(filepath)) or "小说项目"
    lines = [
        f"# 《{novel_title}》人物轨剧情时间线 (Plot Arcs v2)",
        "",
        "> 由「章节 → 剧情时间线」自动生成。同框角色合并为单节点，无需单独填写交汇字段。",
        "",
        "| 章节 | 轨道 | 角色 | 本章事件 |",
        "| :--- | :--- | :--- | :--- |",
    ]
    for ch in data.get("chapters") or []:
        ch_num = ch.get("chapter_num", 1)
        for node in _layout_chapter_groups(ch):
            names = "、".join(
                (b.get("character") or "").strip()
                for b in node["beats"]
                if (b.get("character") or "").strip()
            )
            events = " / ".join(
                (b.get("event") or "").strip() or "—"
                for b in node["beats"]
            )
            lane = "会师" if node["merged"] else "单轨"
            names = names.replace("|", "\\|")
            events = events.replace("\n", " ").replace("|", "\\|")
            lines.append(f"| 第 {ch_num} 章 | {lane} | {names} | {events} |")
    return "\n".join(lines) + "\n"


@app.get("/api/plot_arcs")
def api_get_plot_arcs(filepath: str):
    """Retrieve plot arcs v2 (character tracks). Migrates legacy v1 list on read."""
    if not filepath or not os.path.exists(filepath):
        raise HTTPException(status_code=400, detail="Invalid project workspace path")

    json_path = os.path.join(filepath, "02_memory", "plot_arcs.json")
    if os.path.exists(json_path):
        try:
            with open(json_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, dict) and data.get("schema_version") == 2:
                return data
            if isinstance(data, list):
                migrated = _migrate_plot_arcs_v1_to_v2(data, filepath)
                os.makedirs(os.path.join(filepath, "02_memory"), exist_ok=True)
                with open(json_path, "w", encoding="utf-8") as f:
                    json.dump(migrated, f, ensure_ascii=False, indent=2)
                return migrated
        except Exception:
            pass

    # File doesn't exist: return empty structure without writing to disk.
    # Data is only persisted when the user explicitly saves.
    return {"schema_version": 2, "chapters": []}


@app.post("/api/plot_arcs")
def api_save_plot_arcs(payload: SavePlotArcsPayload):
    """Save plot arcs v2 and compile plot_arcs.md."""
    if not payload.filepath or not os.path.exists(payload.filepath):
        raise HTTPException(status_code=400, detail="Invalid project workspace path")

    memory_dir = os.path.join(payload.filepath, "02_memory")
    os.makedirs(memory_dir, exist_ok=True)

    json_path = os.path.join(memory_dir, "plot_arcs.json")
    md_path = os.path.join(memory_dir, "plot_arcs.md")

    try:
        data = payload.data
        if data.get("schema_version") != 2:
            raise HTTPException(status_code=400, detail="仅支持 schema_version=2 数据格式")

        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        with open(md_path, "w", encoding="utf-8") as f:
            f.write(_compile_plot_arcs_md(payload.filepath, data))

        log_to_queue("💾 人物轨时间线已保存，并同步 plot_arcs.md")
        return {"status": "success", "message": "时间线保存成功"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"保存时间线失败: {str(e)}")

@app.post("/api/chat")
def api_chat(payload: ChatPayload):
    """Multi-round novel editor assistant chat endpoint."""
    config = load_config(CONFIG_FILE)
    llm_conf = get_llm_config_by_key(config, payload.model_key)
    try:
        from llm_adapters import create_llm_adapter
        adapter = create_llm_adapter(
            interface_format=llm_conf.get("interface_format", "OpenAI"),
            base_url=llm_conf.get("base_url", "https://api.openai.com/v1"),
            model_name=llm_conf.get("model_name", "gpt-4o-mini"),
            api_key=llm_conf.get("api_key", ""),
            temperature=0.7,
            max_tokens=2048,
            timeout=300
        )
        
        system_prompt = """你是一位资深的殿堂级小说总编辑和创意世界观架构师。
你的任务是通过多轮对话，耐心地引导作者，帮他们逐步完善和打磨小说的核心设定（包括类型、流派、主角、金手指、力量体系、世界观以及多城市的地理矛盾）。

工作规程：
1. 用专业、鼓舞人心的语气和作者交流，点评他们的创意亮点，提出有启发性的多轮对话问题（每次提问控制在 1-2 个重点，不要一次性问太多）。
2. 在交流过程中，当你推荐或对齐了某些具体设定后，你必须在回答的末尾，附带一个用 ```json ... ``` 标记的 JSON 数据块，用于将你当前为他们量身定做的设定参数结构化。
3. 该 JSON 块的格式必须严格为以下字段（如果没有对齐某些字段可以留空）：
{
  "novel_name": "建议的书名",
  "protagonist_name": "建议的主角名",
  "creative_direction": "核心看点与创意梗概",
  "genre": "玄幻/仙侠/都市/科幻/历史/言情/悬疑/武侠/奇幻/末世/游戏/军事中的一个，必须是这12个词之一",
  "narrative_tropes": ["系统流", "升级流" 等],
  "character_situation": ["废柴逆袭", "退婚流" 等],
  "theme_direction": ["凡人流", "洪荒流" 等],
  "style_preference": ["轻松搞笑", "热血燃向" 等],
  "power_system_type": "修炼类/超凡类/职业类/科技类/特殊类中的一个",
  "power_system_detail": "如: 修仙体系/魔法体系/赛博机械 等",
  "golden_finger_type": "系统类/能力类/外物类/身份类/特殊类中的一个",
  "golden_finger_detail": "如: 签到金手指/顿悟挂/神秘玉佩 等",
  "cities": ["城市名1(钢铁朋克-地底古兽)", "城市名2(仙山云海-诡异寄生)"],
  "main_conflict": "核心矛盾冲突"
}

请记住：交流在先，启发作者；JSON 块在后，提供落地数据。
"""
        messages = [{"role": "system", "content": system_prompt}]
        for h in payload.history[-10:]:
            messages.append({"role": h["role"], "content": h["content"]})
        
        messages.append({"role": "user", "content": payload.user_msg})
        
        ai_response = adapter.chat(messages)
        return {"status": "success", "response": ai_response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ----------------- Setting Cards API -----------------
import uuid
import json

class SaveSettingCardsPayload(BaseModel):
    filepath: str
    cards: List[Dict[str, Any]]

DEFAULT_SETTING_CARDS = [
    {
        "required": True,
        "category": "基础元数据",
        "title": "小说名称",
        "content": "无名之潮",
    },
    {
        "required": False,
        "category": "基础元数据",
        "title": "主角姓名",
        "content": "沈青灯",
    },
    {
        "required": True,
        "category": "基础元数据",
        "title": "题材方向",
        "content": "原创奇幻；融合克苏鲁旧神、神权政治、真名魔法、灾病悬疑、海怪战争与群像权谋。",
    },
    {
        "required": False,
        "category": "故事引擎",
        "title": "一句话核心梗",
        "content": "靠假名活着的无名少年沈青灯在神庙清洗潮化者时觉醒“夺名”权柄，为了寻找真名并证明自己仍是人，必须夺回被神明抹去的名字；但他每拯救一个人，体内无名之母的残心就更完整。",
    },
    {
        "required": False,
        "category": "故事引擎",
        "title": "表层故事",
        "content": "无名少年逃亡、觉醒、反抗神庙，追查身世，在各国战争与灾病中成长。",
    },
    {
        "required": False,
        "category": "故事引擎",
        "title": "中层故事",
        "content": "真名制度并非单纯保护，而是诸神维持文明秩序 and 控制人类的核心机器；潮化病不是污染，而是命名约束失效后的原初回潮。",
    },
    {
        "required": False,
        "category": "故事引擎",
        "title": "深层故事",
        "content": "大陆建立在无名之母尸骸之上，十二神既是救赎者也是篡夺者，人类也参与了旧神肢解。最终冲突不是善恶之争，而是自由与秩序各自要求谁付出代价。",
    },
    {
        "required": False,
        "category": "世界规则",
        "title": "核心命题",
        "content": "名字是庇护，也是锁链。真正的问题是：自由会带来混乱，秩序会制造牺牲，人类愿意让谁付出代价？",
    },
    {
        "required": False,
        "category": "世界规则",
        "title": "真名制度",
        "content": "每个人七岁接受命名礼，本本登记进神明圣典后获得合法身份、神明保护和低级权柄魔法资格；代价是神拥有其一部分。",
    },
    {
        "required": False,
        "category": "世界规则",
        "title": "潮化病真相",
        "content": "潮化病不是污染，而是被神命名后的灵魂开始恢复原始形态。妖怪可能是被秩序剥夺过本来形态的人。",
    },
    {
        "required": False,
        "category": "主角线",
        "title": "沈青灯核心矛盾",
        "content": "他必须使用旧神权柄反抗诸神，但使用得越多越不像人；最终必须在神的秩序与旧神的自由之间创造第三条路。",
    },
    {
        "required": False,
        "category": "主角线",
        "title": "夺名权柄",
        "content": "夺走他人的名字，剥离神明控制，吞噬低等权柄，把潮化者从病变中唤醒，让被历史删除的人重新被世界记住。",
    },
    {
        "required": False,
        "category": "长篇结构",
        "title": "五卷结构",
        "content": "第一卷无名之子；第二卷真名帝国；第三卷海怪战争；第四卷十二神的尸体；第五卷无名之潮。",
    },
    {
        "required": False,
        "category": "创作约束",
        "title": "不可破坏规则",
        "content": "不能把十二神写成纯坏、潮王写成纯好；不能让设定解释压过人物行动；每次使用无名权柄必须带来代价。",
    },
]

def _cards_to_markdown(cards: List[Dict[str, Any]]) -> str:
    lines = [
        "# 《无名之潮》作品设定集",
        "",
        "> 本文件由设定卡片自动生成，卡片从上到下的顺序就是本文档顺序。请不要手改本文件，改动请回到“小说设定 -> 可视化卡片引导”。",
        "",
    ]

    current_category = None
    for card in cards:
        category = card.get("category", "其他设定").strip() or "其他设定"
        title = card.get("title", "").strip()
        content = card.get("content", "").strip()
        if not title and not content:
            continue
        if category != current_category:
            lines.append(f"## {category}")
            lines.append("")
            current_category = category

        level = int(card.get("heading_level", 3) or 3)
        level = min(max(level, 3), 5)
        heading = "#" * level
        lines.append(f"{heading} {title or '未命名设定'}")
        lines.append("")
        lines.append(content)
        lines.append("")

    return "\n".join(lines).strip() + "\n"

def parse_markdown_to_cards(markdown_content: str) -> List[Dict[str, Any]]:
    """Parse novel_settings.md into visual setting cards structured array."""
    cards = []
    lines = markdown_content.splitlines()
    
    current_category = "其他设定"
    current_card = None
    
    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        
        # Check for category: "## " (but not "###")
        if stripped.startswith("## ") and not stripped.startswith("###"):
            current_category = stripped[3:].strip()
            if current_card:
                cards.append(current_card)
                current_card = None
        # Check for card title: "### ", "#### ", "##### "
        elif stripped.startswith("### ") or stripped.startswith("#### ") or stripped.startswith("##### "):
            if current_card:
                cards.append(current_card)
            
            level = 3
            if stripped.startswith("#### "):
                level = 4
                title = stripped[5:].strip()
            elif stripped.startswith("##### "):
                level = 5
                title = stripped[6:].strip()
            else:
                level = 3
                title = stripped[4:].strip()
                
            required = title in ["小说名称", "题材方向"]
            
            current_card = {
                "id": str(uuid.uuid4()),
                "required": required,
                "category": current_category,
                "title": title,
                "content": "",
                "heading_level": level
            }
        else:
            if current_card is not None:
                if current_card["content"]:
                    current_card["content"] += "\n" + line
                else:
                    current_card["content"] = line
        i += 1
        
    if current_card:
        cards.append(current_card)
        
    for card in cards:
        card["content"] = card["content"].strip()
        
    return cards

@app.get("/api/setting_cards")
def get_setting_cards(filepath: str):
    """Retrieve setting cards. If file does not exist, initialize from novel_settings.md or defaults."""
    if not filepath or not os.path.exists(filepath):
        raise HTTPException(status_code=400, detail="Invalid project filepath")
    
    cards_json_path = os.path.join(filepath, "00_settings", "setting_cards.json")
    md_path = os.path.join(filepath, "00_settings", "novel_settings.md")
    
    # 1. Migration path: if legacy JSON exists, read it, compile to MD, delete JSON, and return data
    if os.path.exists(cards_json_path):
        try:
            with open(cards_json_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, list) and len(data) > 0:
                for card in data:
                    if "id" not in card:
                        card["id"] = str(uuid.uuid4())
                
                # Write to novel_settings.md
                md_content = _cards_to_markdown(data)
                os.makedirs(os.path.dirname(md_path), exist_ok=True)
                with open(md_path, "w", encoding="utf-8") as f:
                    f.write(md_content)
                
                # Delete legacy JSON
                try:
                    os.remove(cards_json_path)
                except Exception as ex:
                    print(f"Failed to remove legacy setting_cards.json: {ex}")
                
                return data
        except Exception as e:
            print(f"Failed to migrate setting_cards.json: {e}")
            
    # 2. Main path: read from novel_settings.md if it exists
    if os.path.exists(md_path):
        try:
            with open(md_path, "r", encoding="utf-8") as f:
                md_content = f.read()
            cards = parse_markdown_to_cards(md_content)
            if len(cards) > 0:
                return cards
        except Exception as e:
            print(f"Failed to parse novel_settings.md: {e}")
            
    # 3. Final fallback: initialize from DEFAULT_SETTING_CARDS
    init_cards = []
    for card in DEFAULT_SETTING_CARDS:
        c = card.copy()
        c["id"] = str(uuid.uuid4())
        init_cards.append(c)
    return init_cards

@app.post("/api/setting_cards")
def save_setting_cards(payload: SaveSettingCardsPayload):
    """Save setting cards directly to novel_settings.md as Markdown."""
    if not payload.filepath or not os.path.exists(payload.filepath):
        raise HTTPException(status_code=400, detail="Invalid project filepath")
        
    settings_dir = os.path.join(payload.filepath, "00_settings")
    os.makedirs(settings_dir, exist_ok=True)
    
    md_path = os.path.join(settings_dir, "novel_settings.md")
    legacy_json_path = os.path.join(settings_dir, "setting_cards.json")
    
    try:
        # 1. Compile cards to markdown and save to novel_settings.md
        md_content = _cards_to_markdown(payload.cards)
        with open(md_path, "w", encoding="utf-8") as f:
            f.write(md_content)
            
        # 2. Cleanup legacy JSON file if it exists to keep workspace tidy
        if os.path.exists(legacy_json_path):
            try:
                os.remove(legacy_json_path)
            except Exception as ex:
                print(f"Failed to delete legacy setting_cards.json during save: {ex}")
            
        log_to_queue("💾 设定已成功保存并同步更新至 novel_settings.md！")
        return {"status": "success", "message": "设定卡片保存成功"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"保存设定失败: {str(e)}")


class SaveWorldMapPayload(BaseModel):
    filepath: str
    map_data: dict

@app.get("/api/world_map")
def api_get_world_map(filepath: str):
    """Get the procedural vector world map JSON structure."""
    if not filepath or not os.path.exists(filepath):
        raise HTTPException(status_code=400, detail="Invalid project filepath")
        
    map_json_path = os.path.join(filepath, "00_settings", "world_map.json")
    if os.path.exists(map_json_path):
        try:
            with open(map_json_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"Error reading world_map.json: {e}")
            
    # Initial default map state based on novel settings
    # We will procedurally generate continents, cities and factions
    default_map = {
        "schema_version": 1,
        "width": 800,
        "height": 500,
        "continents": [
            {"id": "c1", "name": "九霄大陆", "x": 400, "y": 250, "size": 180}
        ],
        "factions": [
            {"id": "f1", "name": "青云宗", "x": 380, "y": 240, "color": "hsl(142, 70%, 45%)", "capital": "青云总坛", "influence_radius": 150}
        ],
        "cities": [
            {"id": "ct1", "name": "青云总坛", "x": 380, "y": 240, "faction_id": "f1", "is_capital": True, "size": 10},
            {"id": "ct2", "name": "临渊城", "x": 450, "y": 200, "faction_id": "f1", "is_capital": False, "size": 6}
        ],
        "labels": [
            {"id": "l1", "text": "无名之海", "x": 200, "y": 150, "font_size": 14, "style": "italic", "color": "rgba(255,255,255,0.06)"}
        ]
    }
    
    # Let's save the default map to disk immediately to initialize the file cleanly
    os.makedirs(os.path.join(filepath, "00_settings"), exist_ok=True)
    try:
        with open(map_json_path, "w", encoding="utf-8") as f:
            json.dump(default_map, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Failed to write initial world_map.json: {e}")
        
    return default_map

@app.post("/api/world_map")
def api_save_world_map(payload: SaveWorldMapPayload):
    """Save the modified vector world map data to world_map.json."""
    if not payload.filepath or not os.path.exists(payload.filepath):
        raise HTTPException(status_code=400, detail="Invalid project filepath")
        
    map_json_path = os.path.join(payload.filepath, "00_settings", "world_map.json")
    try:
        os.makedirs(os.path.join(payload.filepath, "00_settings"), exist_ok=True)
        with open(map_json_path, "w", encoding="utf-8") as f:
            json.dump(payload.map_data, f, ensure_ascii=False, indent=2)
        log_to_queue("💾 世界疆域地图已成功保存！")
        return {"status": "success", "message": "地图保存成功"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"保存地图失败: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    # Launch on 8000; timeout_graceful_shutdown prevents lingering port after crash
    uvicorn.run(app, host="127.0.0.1", port=8000, timeout_graceful_shutdown=1)

