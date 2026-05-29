# cli.py
# -*- coding: utf-8 -*-
"""
AI 小说生成器命令行控制器 (cli.py)
供 Agent Skill 直接调用，实现与 GUI 共享配置的双向打通小说创作。
"""
import os
import sys
import json
import argparse
from config_manager import load_config, save_config
from novel_generator.architecture import novel_settings_generate
from novel_generator.blueprint import Chapter_blueprint_generate
from novel_generator.chapter import generate_chapter_draft, build_chapter_prompt
from novel_generator.finalization import finalize_chapter, enrich_chapter_text
from consistency_checker import check_consistency
from utils import read_file, save_string_to_txt, text_file_exists, chapters_drafts_dir, resolve_text_path

CONFIG_FILE = "config.json"

def get_active_llm_config(config: dict, task_type: str) -> dict:
    """获取指定任务类型当前选中的 LLM 配置"""
    choose_configs = config.get("choose_configs", {})
    selected_name = choose_configs.get(task_type, "DeepSeek V3")
    llm_configs = config.get("llm_configs", {})
    if selected_name in llm_configs:
        return llm_configs[selected_name]
    # 兜底返回第一个配置
    if llm_configs:
        return next(iter(llm_configs.values()))
    return {}

def get_active_embedding_config(config: dict) -> dict:
    """获取当前的 Embedding 配置"""
    last_emb = config.get("last_embedding_interface_format", "OpenAI")
    embedding_configs = config.get("embedding_configs", {})
    if last_emb in embedding_configs:
        return embedding_configs[last_emb]
    if embedding_configs:
        return next(iter(embedding_configs.values()))
    return {}

def cmd_init(args):
    """初始化/更新配置项，供 Agent 动态写入"""
    config = load_config(CONFIG_FILE)
    if not config:
        print("Error: 无法加载 config.json 配置文件。")
        sys.exit(1)

    # 如果指定了大模型参数，统一写入 "Agent Model"
    if args.api_key or args.base_url or args.model_name:
        if "Agent Model" not in config["llm_configs"]:
            config["llm_configs"]["Agent Model"] = {
                "api_key": "",
                "base_url": "https://api.deepseek.com/v1",
                "model_name": "deepseek-chat",
                "temperature": 0.7,
                "max_tokens": 8192,
                "timeout": 600,
                "interface_format": "OpenAI"
            }
        
        agent_conf = config["llm_configs"]["Agent Model"]
        if args.api_key is not None: agent_conf["api_key"] = args.api_key
        if args.base_url is not None: agent_conf["base_url"] = args.base_url
        if args.model_name is not None: agent_conf["model_name"] = args.model_name
        if args.interface_format is not None: agent_conf["interface_format"] = args.interface_format
        if args.temperature is not None: agent_conf["temperature"] = args.temperature
        if args.max_tokens is not None: agent_conf["max_tokens"] = args.max_tokens
        
        # 将所有生成环节全部指向 "Agent Model"
        config["choose_configs"]["prompt_draft_llm"] = "Agent Model"
        config["choose_configs"]["chapter_outline_llm"] = "Agent Model"
        config["choose_configs"]["architecture_llm"] = "Agent Model"
        config["choose_configs"]["final_chapter_llm"] = "Agent Model"
        config["choose_configs"]["consistency_review_llm"] = "Agent Model"
        config["last_interface_format"] = agent_conf["interface_format"]

    # 如果指定了 Embedding 参数，统一写入 "Agent Embedding"
    if args.embedding_api_key or args.embedding_url or args.embedding_model_name:
        if "Agent Embedding" not in config["embedding_configs"]:
            config["embedding_configs"]["Agent Embedding"] = {
                "api_key": "",
                "base_url": "https://api.openai.com/v1",
                "model_name": "text-embedding-ada-002",
                "retrieval_k": 4,
                "interface_format": "OpenAI"
            }
        
        agent_emb = config["embedding_configs"]["Agent Embedding"]
        if args.embedding_api_key is not None: agent_emb["api_key"] = args.embedding_api_key
        if args.embedding_url is not None: agent_emb["base_url"] = args.embedding_url
        if args.embedding_model_name is not None: agent_emb["model_name"] = args.embedding_model_name
        if args.embedding_interface_format is not None: agent_emb["interface_format"] = args.embedding_interface_format
        if args.embedding_retrieval_k is not None: agent_emb["retrieval_k"] = args.embedding_retrieval_k
        
        config["last_embedding_interface_format"] = "Agent Embedding"

    # 写入小说具体业务参数
    other = config.get("other_params", {})
    if args.novel_name is not None: other["novel_name"] = args.novel_name
    if args.topic is not None: other["topic"] = args.topic
    if args.genre is not None: other["genre"] = args.genre
    if args.target_audience is not None: other["target_audience"] = args.target_audience
    if args.platform_style is not None: other["platform_style"] = args.platform_style
    if args.writing_style is not None: other["writing_style"] = args.writing_style
    if args.pacing_requirement is not None: other["pacing_requirement"] = args.pacing_requirement
    if args.num_chapters is not None: other["num_chapters"] = args.num_chapters
    if args.word_number is not None: other["word_number"] = args.word_number
    if args.filepath is not None: other["filepath"] = args.filepath
    if args.chapter_num is not None: other["chapter_num"] = str(args.chapter_num)
    if args.characters_involved is not None: other["characters_involved"] = args.characters_involved
    if args.key_items is not None: other["key_items"] = args.key_items
    if args.scene_location is not None: other["scene_location"] = args.scene_location
    if args.time_constraint is not None: other["time_constraint"] = args.time_constraint
    if args.user_guidance is not None: other["user_guidance"] = args.user_guidance
    config["other_params"] = other

    if save_config(config, CONFIG_FILE):
        print("✅ 配置参数已成功写入 config.json！在 GUI 重新打开后即可看到最新配置。")
    else:
        print("❌ 保存配置文件 config.json 失败。")

def cmd_step1(args):
    """Step 1: 生成小说总体设定"""
    config = load_config(CONFIG_FILE)
    llm = get_active_llm_config(config, "architecture_llm")
    other = config.get("other_params", {})

    filepath = args.filepath or other.get("filepath", "")
    if not filepath:
        print("Error: 必须指定小说保存路径 (--filepath)。")
        sys.exit(1)

    topic = args.topic or other.get("topic", "")
    genre = args.genre or other.get("genre", "玄幻")
    num_chapters = args.num_chapters or int(other.get("num_chapters", 10))
    word_number = args.word_number or int(other.get("word_number", 3000))
    user_guidance = args.guidance or other.get("user_guidance", "")
    setting_guidance = "\n".join(
        part for part in [
            f"小说名称：{args.novel_name or other.get('novel_name', '')}" if (args.novel_name or other.get("novel_name", "")) else "",
            f"目标读者：{args.target_audience or other.get('target_audience', '')}" if (args.target_audience or other.get("target_audience", "")) else "",
            f"平台风格：{args.platform_style or other.get('platform_style', '')}" if (args.platform_style or other.get("platform_style", "")) else "",
            f"语言风格：{args.writing_style or other.get('writing_style', '')}" if (args.writing_style or other.get("writing_style", "")) else "",
            f"节奏要求：{args.pacing_requirement or other.get('pacing_requirement', '')}" if (args.pacing_requirement or other.get("pacing_requirement", "")) else "",
            user_guidance,
        ] if part
    )

    print(f"🔄 正在调用 {llm.get('model_name')} 生成小说设定...")
    print(f"主题: {topic}\n类型: {genre}\n路径: {filepath}")

    novel_settings_generate(
        interface_format=llm.get("interface_format", "OpenAI"),
        api_key=llm.get("api_key", ""),
        base_url=llm.get("base_url", ""),
        llm_model=llm.get("model_name", ""),
        topic=topic,
        genre=genre,
        number_of_chapters=num_chapters,
        word_number=word_number,
        filepath=filepath,
        temperature=llm.get("temperature", 0.7),
        max_tokens=llm.get("max_tokens", 8192),
        timeout=llm.get("timeout", 600),
        user_guidance=setting_guidance
    )
    print("✅ 小说设定 (novel_settings.md) 生成成功！")

def cmd_step2(args):
    """Step 2: 生成章节目录蓝图"""
    config = load_config(CONFIG_FILE)
    llm = get_active_llm_config(config, "chapter_outline_llm")
    other = config.get("other_params", {})

    filepath = args.filepath or other.get("filepath", "")
    if not filepath:
        print("Error: 必须指定小说保存路径 (--filepath)。")
        sys.exit(1)

    num_chapters = args.num_chapters or int(other.get("num_chapters", 10))
    user_guidance = args.guidance or other.get("user_guidance", "")

    print(f"🔄 正在生成包含 {num_chapters} 章的章节大纲目录...")
    Chapter_blueprint_generate(
        interface_format=llm.get("interface_format", "OpenAI"),
        api_key=llm.get("api_key", ""),
        base_url=llm.get("base_url", ""),
        llm_model=llm.get("model_name", ""),
        number_of_chapters=num_chapters,
        filepath=filepath,
        temperature=llm.get("temperature", 0.7),
        max_tokens=llm.get("max_tokens", 8192),
        timeout=llm.get("timeout", 600),
        user_guidance=user_guidance
    )
    print("✅ 章节蓝图 (novel_directory.md) 生成完成！")

def cmd_step3(args):
    """Step 3: 生成指定章节草稿"""
    config = load_config(CONFIG_FILE)
    llm = get_active_llm_config(config, "prompt_draft_llm")
    emb = get_active_embedding_config(config)
    other = config.get("other_params", {})

    filepath = args.filepath or other.get("filepath", "")
    if not filepath:
        print("Error: 必须指定小说保存路径 (--filepath)。")
        sys.exit(1)

    chapter_num = args.chapter or int(other.get("chapter_num", 1))
    word_number = args.word_number or int(other.get("word_number", 3000))
    user_guidance = args.guidance or other.get("user_guidance", "")

    char_inv = args.characters or other.get("characters_involved", "")
    key_items = args.items or other.get("key_items", "")
    scene_loc = args.scene or other.get("scene_location", "")
    time_constr = args.time or other.get("time_constraint", "")

    print(f"🔄 正在利用大模型生成第 {chapter_num} 章正文草稿...")
    
    # 构造请求提示词
    prompt_text = build_chapter_prompt(
        api_key=llm.get("api_key", ""),
        base_url=llm.get("base_url", ""),
        model_name=llm.get("model_name", ""),
        filepath=filepath,
        novel_number=chapter_num,
        word_number=word_number,
        temperature=llm.get("temperature", 0.7),
        user_guidance=user_guidance,
        characters_involved=char_inv,
        key_items=key_items,
        scene_location=scene_loc,
        time_constraint=time_constr,
        embedding_api_key=emb.get("api_key", ""),
        embedding_url=emb.get("base_url", ""),
        embedding_interface_format=emb.get("interface_format", "OpenAI"),
        embedding_model_name=emb.get("model_name", ""),
        embedding_retrieval_k=int(emb.get("retrieval_k", 4)),
        interface_format=llm.get("interface_format", "OpenAI"),
        max_tokens=llm.get("max_tokens", 8192),
        timeout=llm.get("timeout", 600)
    )

    # 直接生成草稿文本并写入对应章节文件
    draft_text = generate_chapter_draft(
        api_key=llm.get("api_key", ""),
        base_url=llm.get("base_url", ""),
        model_name=llm.get("model_name", ""),
        filepath=filepath,
        novel_number=chapter_num,
        word_number=word_number,
        temperature=llm.get("temperature", 0.7),
        user_guidance=user_guidance,
        characters_involved=char_inv,
        key_items=key_items,
        scene_location=scene_loc,
        time_constraint=time_constr,
        embedding_api_key=emb.get("api_key", ""),
        embedding_url=emb.get("base_url", ""),
        embedding_interface_format=emb.get("interface_format", "OpenAI"),
        embedding_model_name=emb.get("model_name", ""),
        embedding_retrieval_k=int(emb.get("retrieval_k", 4)),
        interface_format=llm.get("interface_format", "OpenAI"),
        max_tokens=llm.get("max_tokens", 8192),
        timeout=llm.get("timeout", 600),
        custom_prompt_text=prompt_text
    )

    if draft_text:
        print(f"✅ 第 {chapter_num} 章草稿已成功生成，存放在 01_chapters/chapter_{chapter_num}.md。")
        print("\n=== 草稿预览 ===")
        print(draft_text[:500] + "\n...(后文已省略)")
    else:
        print(f"❌ 第 {chapter_num} 章草稿生成失败。")

def cmd_step4(args):
    """Step 4: 定稿并进化状态"""
    config = load_config(CONFIG_FILE)
    llm = get_active_llm_config(config, "final_chapter_llm")
    emb = get_active_embedding_config(config)
    other = config.get("other_params", {})

    filepath = args.filepath or other.get("filepath", "")
    if not filepath:
        print("Error: 必须指定小说保存路径 (--filepath)。")
        sys.exit(1)

    chapter_num = args.chapter or int(other.get("chapter_num", 1))
    word_number = args.word_number or int(other.get("word_number", 3000))

    chapter_file = os.path.join(chapters_drafts_dir(filepath), f"chapter_{chapter_num}.md")
    if not text_file_exists(chapter_file):
        print(f"Error: 找不到第 {chapter_num} 章的草稿文件 {chapter_file}。请先生成草稿！")
        sys.exit(1)

    print(f"🔄 正在对第 {chapter_num} 章进行最终定稿归档...")
    finalize_chapter(
        novel_number=chapter_num,
        word_number=word_number,
        api_key=llm.get("api_key", ""),
        base_url=llm.get("base_url", ""),
        model_name=llm.get("model_name", ""),
        temperature=llm.get("temperature", 0.7),
        filepath=filepath,
        embedding_api_key=emb.get("api_key", ""),
        embedding_url=emb.get("base_url", ""),
        embedding_interface_format=emb.get("interface_format", "OpenAI"),
        embedding_model_name=emb.get("model_name", ""),
        interface_format=llm.get("interface_format", "OpenAI"),
        max_tokens=llm.get("max_tokens", 8192),
        timeout=llm.get("timeout", 600)
    )
    print(f"✅ 第 {chapter_num} 章定稿归档成功！角色状态已自动更新，并尝试沉淀到知识库。")

def cmd_consistency(args):
    """一致性矛盾审查"""
    config = load_config(CONFIG_FILE)
    llm = get_active_llm_config(config, "consistency_review_llm")
    other = config.get("other_params", {})

    filepath = args.filepath or other.get("filepath", "")
    if not filepath:
        print("Error: 必须指定小说保存路径 (--filepath)。")
        sys.exit(1)

    chapter_num = args.chapter or int(other.get("chapter_num", 1))
    chapter_file = os.path.join(chapters_drafts_dir(filepath), f"chapter_{chapter_num}.md")
    if not text_file_exists(chapter_file):
        print(f"Error: 找不到第 {chapter_num} 章的正文文件 {chapter_file}。")
        sys.exit(1)

    chapter_text = read_file(chapter_file)
    novel_setting = read_file(resolve_text_path(os.path.join(filepath, "novel_settings.md")))
    char_state = read_file(os.path.join(filepath, "character_state.md"))
    novel_directory = read_file(os.path.join(filepath, "novel_directory.md"))
    foreshadowing = read_file(os.path.join(filepath, "foreshadowing_ledger.md"))
    plot_arcs = read_file(os.path.join(filepath, "plot_arcs.md"))
    memory_context = (
        f"【章节蓝图】\n{novel_directory}\n\n"
        f"【伏笔台账】\n{foreshadowing}\n\n"
        f"【人物轨时间线】\n{plot_arcs}"
    )

    print(f"🔄 正在对第 {chapter_num} 章进行剧情与设定一致性审查...")
    result = check_consistency(
        novel_setting=novel_setting,
        character_state=char_state,
        memory_context=memory_context,
        chapter_text=chapter_text,
        api_key=llm.get("api_key", ""),
        base_url=llm.get("base_url", ""),
        model_name=llm.get("model_name", ""),
        temperature=0.3,
        interface_format=llm.get("interface_format", "OpenAI"),
        max_tokens=llm.get("max_tokens", 8192),
        timeout=llm.get("timeout", 600)
    )
    print("\n=== 一致性审校报告 ===")
    print(result)

def main():
    parser = argparse.ArgumentParser(description="AI Novel Generator CLI")
    subparsers = parser.add_subparsers(dest="command", help="子命令")

    # init命令
    p_init = subparsers.add_parser("init", help="初始化/更新配置参数")
    p_init.add_argument("--api-key", help="LLM API Key")
    p_init.add_argument("--base-url", help="LLM Base URL")
    p_init.add_argument("--model-name", help="LLM Model Name")
    p_init.add_argument("--interface-format", help="LLM Format (OpenAI/Gemini/Ollama等)")
    p_init.add_argument("--temperature", type=float, help="创意度")
    p_init.add_argument("--max-tokens", type=int, help="单次回复Token上限")
    p_init.add_argument("--embedding-api-key", help="Embedding API Key")
    p_init.add_argument("--embedding-url", help="Embedding Base URL")
    p_init.add_argument("--embedding-model-name", help="Embedding Model Name")
    p_init.add_argument("--embedding-interface-format", help="Embedding Format")
    p_init.add_argument("--embedding-retrieval-k", type=int, help="向量检索召回条数")
    p_init.add_argument("--novel-name", help="小说名称")
    p_init.add_argument("--topic", help="小说核心故事主题")
    p_init.add_argument("--genre", help="小说流派类型")
    p_init.add_argument("--target-audience", help="目标读者")
    p_init.add_argument("--platform-style", help="平台风格")
    p_init.add_argument("--writing-style", help="语言文笔风格")
    p_init.add_argument("--pacing-requirement", help="节奏要求")
    p_init.add_argument("--num-chapters", type=int, help="章节总数")
    p_init.add_argument("--word-number", type=int, help="单章期望字数")
    p_init.add_argument("--filepath", help="项目保存本地路径")
    p_init.add_argument("--chapter-num", type=int, help="当前撰写的章节号")
    p_init.add_argument("--characters", help="本章参与角色")
    p_init.add_argument("--items", help="本章关键道具")
    p_init.add_argument("--scene", help="本章场景地点")
    p_init.add_argument("--time", help="本章时间限制")
    p_init.add_argument("--user-guidance", help="用户总体指导/本章大纲方向")

    # step1命令
    p_step1 = subparsers.add_parser("step1-settings", help="Step 1: 生成小说总体设定")
    p_step1.add_argument("--filepath", help="覆盖配置文件中的保存路径")
    p_step1.add_argument("--novel-name", help="覆盖小说名称")
    p_step1.add_argument("--topic", help="覆盖故事主题")
    p_step1.add_argument("--genre", help="覆盖流派类型")
    p_step1.add_argument("--target-audience", help="覆盖目标读者")
    p_step1.add_argument("--platform-style", help="覆盖平台风格")
    p_step1.add_argument("--writing-style", help="覆盖语言文笔风格")
    p_step1.add_argument("--pacing-requirement", help="覆盖节奏要求")
    p_step1.add_argument("--num-chapters", type=int, help="覆盖章节数")
    p_step1.add_argument("--word-number", type=int, help="覆盖单章字数")
    p_step1.add_argument("--guidance", help="给 AI 设定的补充内容指导")

    # step2命令
    p_step2 = subparsers.add_parser("step2-directory", help="Step 2: 生成章节大纲目录")
    p_step2.add_argument("--filepath", help="保存路径")
    p_step2.add_argument("--num-chapters", type=int, help="章节总数")
    p_step2.add_argument("--guidance", help="章节规划的补充指导意见")

    # step3命令
    p_step3 = subparsers.add_parser("step3-draft", help="Step 3: 生成指定章节的正文草稿")
    p_step3.add_argument("--chapter", type=int, help="要生成的章节号")
    p_step3.add_argument("--filepath", help="保存路径")
    p_step3.add_argument("--word-number", type=int, help="章节字数")
    p_step3.add_argument("--characters", help="参与角色")
    p_step3.add_argument("--items", help="关键道具")
    p_step3.add_argument("--scene", help="场景")
    p_step3.add_argument("--time", help="时间约束")
    p_step3.add_argument("--guidance", help="本章大纲微调指导")

    # step4命令
    p_step4 = subparsers.add_parser("step4-finalize", help="Step 4: 定稿章节并更新历史状态")
    p_step4.add_argument("--chapter", type=int, help="要定稿的章节号")
    p_step4.add_argument("--filepath", help="保存路径")
    p_step4.add_argument("--word-number", type=int, help="目标字数")

    # consistency命令
    p_cons = subparsers.add_parser("check-consistency", help="审校章节与设定的冲突情况")
    p_cons.add_argument("--chapter", type=int, help="被审校的章节号")
    p_cons.add_argument("--filepath", help="保存路径")

    args = parser.parse_args()

    if args.command == "init":
        cmd_init(args)
    elif args.command == "step1-settings":
        cmd_step1(args)
    elif args.command == "step2-directory":
        cmd_step2(args)
    elif args.command == "step3-draft":
        cmd_step3(args)
    elif args.command == "step4-finalize":
        cmd_step4(args)
    elif args.command == "check-consistency":
        cmd_consistency(args)
    else:
        parser.print_help()

if __name__ == "__main__":
    main()

