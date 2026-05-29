# utils.py
# -*- coding: utf-8 -*-
import os
import json

TEXT_EXTENSIONS = (".txt", ".md")

NOVEL_DOCUMENT_FOLDERS = {
    "novel_settings": "00_settings",
    "character_state": "00_settings",
    "novel_directory": "02_memory",
    "plot_arcs": "02_memory",
    "foreshadowing_ledger": "02_memory",
}

def ensure_project_structure(filepath: str):
    """Create the standard layered folders for a novel workspace."""
    for folder in ("00_settings", "01_chapters", "02_memory", "03_characters", "04_logs", "99_assets"):
        os.makedirs(os.path.join(filepath, folder), exist_ok=True)

def chapters_drafts_dir(filepath: str) -> str:
    return os.path.join(filepath, "01_chapters")

def final_chapters_dir(filepath: str) -> str:
    return os.path.join(filepath, "01_chapters")

def logs_dir(filepath: str) -> str:
    return os.path.join(filepath, "04_logs")

def project_document_path(filename: str) -> str:
    """Map known novel document names into the layered novel workspace."""
    directory, basename = os.path.split(filename)
    stem, ext = os.path.splitext(basename)
    folder = NOVEL_DOCUMENT_FOLDERS.get(stem)
    if not folder:
        return filename

    normalized_parts = {part.lower() for part in os.path.normpath(directory).split(os.sep)}
    if folder.lower() in normalized_parts:
        return filename
    return os.path.join(directory, folder, basename)

def markdown_path_for(filename: str) -> str:
    """Return the .md sibling path for a .txt document path."""
    root, ext = os.path.splitext(filename)
    if ext.lower() == ".txt":
        return root + ".md"
    return filename

def legacy_txt_path_for(filename: str) -> str:
    """Return the .txt sibling path for a .md document path."""
    root, ext = os.path.splitext(filename)
    if ext.lower() == ".md":
        return root + ".txt"
    return filename

def resolve_text_path(filename: str, for_write: bool = False) -> str:
    """
    Resolve novel text documents to Markdown-first paths.

    Existing callers can still pass historical .txt names; writes go to .md,
    reads prefer .md and fall back to .txt for compatibility.
    """
    filename = project_document_path(filename)
    root, ext = os.path.splitext(filename)
    if ext.lower() not in TEXT_EXTENSIONS:
        return filename

    md_path = root + ".md"
    txt_path = root + ".txt"

    if for_write:
        return md_path
    if os.path.exists(md_path):
        return md_path
    if os.path.exists(txt_path):
        return txt_path
    return md_path

def text_file_exists(filename: str) -> bool:
    """Return True if either the Markdown or legacy txt variant exists."""
    path = resolve_text_path(filename)
    if os.path.exists(path):
        return True
    root, ext = os.path.splitext(filename)
    if ext.lower() == ".txt":
        return os.path.exists(root + ".md")
    if ext.lower() == ".md":
        return os.path.exists(root + ".txt")
    return False

def read_file(filename: str) -> str:
    """读取文件的全部内容，若文件不存在或异常则返回空字符串。"""
    filename = resolve_text_path(filename)
    try:
        with open(filename, 'r', encoding='utf-8') as file:
            content = file.read()
        return content
    except FileNotFoundError:
        return ""
    except Exception as e:
        print(f"[read_file] 读取文件时发生错误: {e}")
        return ""

def append_text_to_file(text_to_append: str, file_path: str):
    """在文件末尾追加文本(带换行)。若文本非空且无换行，则自动加换行。"""
    file_path = resolve_text_path(file_path, for_write=True)
    os.makedirs(os.path.dirname(os.path.abspath(file_path)), exist_ok=True)
    if text_to_append and not text_to_append.startswith('\n'):
        text_to_append = '\n' + text_to_append

    try:
        with open(file_path, 'a', encoding='utf-8') as file:
            file.write(text_to_append)
    except IOError as e:
        print(f"[append_text_to_file] 发生错误：{e}")

def clear_file_content(filename: str):
    """清空指定文件内容。"""
    filename = resolve_text_path(filename, for_write=True)
    os.makedirs(os.path.dirname(os.path.abspath(filename)), exist_ok=True)
    try:
        with open(filename, 'w', encoding='utf-8') as file:
            pass
    except IOError as e:
        print(f"[clear_file_content] 无法清空文件 '{filename}' 的内容：{e}")

def save_string_to_txt(content: str, filename: str):
    """将字符串保存为 Markdown-first 文档（覆盖写）。"""
    filename = resolve_text_path(filename, for_write=True)
    os.makedirs(os.path.dirname(os.path.abspath(filename)), exist_ok=True)
    try:
        with open(filename, 'w', encoding='utf-8') as file:
            file.write(content)
    except Exception as e:
        print(f"[save_string_to_txt] 保存文件时发生错误: {e}")

def save_data_to_json(data: dict, file_path: str) -> bool:
    """将数据保存到 JSON 文件。"""
    try:
        with open(file_path, 'w', encoding='utf-8') as json_file:
            json.dump(data, json_file, ensure_ascii=False, indent=4)
        return True
    except Exception as e:
        print(f"[save_data_to_json] 保存数据到JSON文件时出错: {e}")

def get_word_count(text: str) -> int:
    """
    根据 config_manager.IS_ENGLISH 计算字数。
    如果是英文模式，按单词（空格分隔）计算；
    如果是中文模式，按字符数计算。
    """
    try:
        import config_manager
        is_english = getattr(config_manager, 'IS_ENGLISH', False)
    except ImportError:
        is_english = False

    if not text:
        return 0
    if is_english:
        # 英文模式：按单词计算
        return len(text.split())
    else:
        # 中文模式：按字符计算
        return len(text)

def format_deep_settings_for_prompt(deep_settings: dict) -> str:
    """
    将 deep_settings 格式化成结构化的 Markdown 文本块，便于直接拼接到 LLM 的 prompt 中。
    """
    if not deep_settings:
        return ""
    
    lines = []
    lines.append("\n#=========================================")
    lines.append("# [深度卡片设定 (Card Mode Deep Settings)]")
    lines.append("#=========================================")
    
    if deep_settings.get("novel_name"):
        lines.append(f"- **建议书名**: {deep_settings['novel_name']}")
    if deep_settings.get("protagonist_name"):
        lines.append(f"- **主角姓名**: {deep_settings['protagonist_name']}")
    if deep_settings.get("creative_direction"):
        lines.append(f"- **创作方向与核心梗**: {deep_settings['creative_direction']}")
        
    lines.append(f"- **核心流派类型**: {deep_settings.get('genre', '玄幻')}")
    
    if deep_settings.get("narrative_tropes"):
        lines.append(f"- **叙事套路 (流派)**: {', '.join(deep_settings['narrative_tropes'])}")
    if deep_settings.get("character_situation"):
        lines.append(f"- **角色处境**: {', '.join(deep_settings['character_situation'])}")
    if deep_settings.get("theme_direction"):
        lines.append(f"- **题材方向**: {', '.join(deep_settings['theme_direction'])}")
    if deep_settings.get("style_preference"):
        lines.append(f"- **风格偏好**: {', '.join(deep_settings['style_preference'])}")
        
    p_type = deep_settings.get("power_system_type")
    p_detail = deep_settings.get("power_system_detail")
    if p_type and p_detail:
        lines.append(f"- **世界力量体系**: {p_type} -> {p_detail}")
        
    c_type = deep_settings.get("golden_finger_type")
    c_detail = deep_settings.get("golden_finger_detail")
    if c_type and c_detail:
        lines.append(f"- **主角金手指**: {c_type} -> {c_detail}")
        
    geo = deep_settings.get("world_geography", {})
    cities = geo.get("cities", [])
    if cities:
        lines.append(f"- **地理与核心城市**: {', '.join(cities)}")
        
    if deep_settings.get("main_conflict"):
        lines.append(f"- **主线核心冲突**: {deep_settings['main_conflict']}")
        
    lines.append(f"- **原创命名限制**: {'开启 (100% 严禁借用既有知名设定地名与人名)' if deep_settings.get('forced_originality', True) else '关闭'}")
    lines.append("#=========================================\n")
    
    return "\n".join(lines)


