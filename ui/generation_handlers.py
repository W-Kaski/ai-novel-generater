# ui/generation_handlers.py
# -*- coding: utf-8 -*-
import os
import threading
import tkinter as tk
from tkinter import messagebox, filedialog
import customtkinter as ctk
import traceback
import glob
from utils import read_file, save_string_to_txt, clear_file_content, get_word_count
from novel_generator import (
    Novel_architecture_generate,
    Chapter_blueprint_generate,
    generate_chapter_draft,
    finalize_chapter,
    import_knowledge_file,
    clear_vector_store,
    enrich_chapter_text,
    build_chapter_prompt
)
from consistency_checker import check_consistency
from ui.helpers import get_text

def generate_novel_architecture_ui(self):
    filepath = self.filepath_var.get().strip()
    if not filepath:
        messagebox.showwarning(get_text("warning", "警告"), get_text("set_path_warning", "请先设置保存文件路径"))
        return

    if not messagebox.askyesno(get_text("confirm_title", "确认"), get_text("gen_arch_confirm", "确定要生成小说架构吗？")):
        return

    def task():
        self.disable_button_safe(self.btn_generate_architecture)
        try:
            interface_format = self.loaded_config["llm_configs"][self.architecture_llm_var.get()]["interface_format"]
            api_key = self.loaded_config["llm_configs"][self.architecture_llm_var.get()]["api_key"]
            base_url = self.loaded_config["llm_configs"][self.architecture_llm_var.get()]["base_url"]
            model_name = self.loaded_config["llm_configs"][self.architecture_llm_var.get()]["model_name"]
            temperature = self.loaded_config["llm_configs"][self.architecture_llm_var.get()]["temperature"]
            max_tokens = self.loaded_config["llm_configs"][self.architecture_llm_var.get()]["max_tokens"]
            timeout_val = self.loaded_config["llm_configs"][self.architecture_llm_var.get()]["timeout"]

            topic = self.topic_text.get("0.0", "end").strip()
            genre = self.genre_var.get().strip()
            num_chapters = self.safe_get_int(self.num_chapters_var, 10)
            word_number = self.safe_get_int(self.word_number_var, 3000)
            user_guidance = self.user_guide_text.get("0.0", "end").strip()

            self.safe_log(get_text("gen_arch_start", "开始生成小说架构..."))
            Novel_architecture_generate(
                interface_format=interface_format,
                api_key=api_key,
                base_url=base_url,
                llm_model=model_name,
                topic=topic,
                genre=genre,
                number_of_chapters=num_chapters,
                word_number=word_number,
                filepath=filepath,
                temperature=temperature,
                max_tokens=max_tokens,
                timeout=timeout_val,
                user_guidance=user_guidance
            )
            self.safe_log(get_text("gen_arch_done", "✅ 小说架构生成完成。请在 'Novel Architecture' 标签页查看或编辑。"))
        except Exception:
            self.handle_exception(get_text("gen_arch_error", "生成小说架构时出错"))
        finally:
            self.enable_button_safe(self.btn_generate_architecture)
    threading.Thread(target=task, daemon=True).start()

def generate_chapter_blueprint_ui(self):
    filepath = self.filepath_var.get().strip()
    if not filepath:
        messagebox.showwarning(get_text("warning", "警告"), get_text("set_path_warning", "请先设置保存文件路径"))
        return

    if not messagebox.askyesno(get_text("confirm_title", "确认"), get_text("gen_dir_confirm", "确定要生成章节目录吗？")):
        return

    def task():
        self.disable_button_safe(self.btn_generate_directory)
        try:
            number_of_chapters = self.safe_get_int(self.num_chapters_var, 10)

            interface_format = self.loaded_config["llm_configs"][self.chapter_outline_llm_var.get()]["interface_format"]
            api_key = self.loaded_config["llm_configs"][self.chapter_outline_llm_var.get()]["api_key"]
            base_url = self.loaded_config["llm_configs"][self.chapter_outline_llm_var.get()]["base_url"]
            model_name = self.loaded_config["llm_configs"][self.chapter_outline_llm_var.get()]["model_name"]
            temperature = self.loaded_config["llm_configs"][self.chapter_outline_llm_var.get()]["temperature"]
            max_tokens = self.loaded_config["llm_configs"][self.chapter_outline_llm_var.get()]["max_tokens"]
            timeout_val = self.loaded_config["llm_configs"][self.chapter_outline_llm_var.get()]["timeout"]

            self.safe_log(get_text("gen_dir_start", "开始生成章节目录..."))
            Chapter_blueprint_generate(
                api_key=api_key,
                base_url=base_url,
                llm_model=model_name,
                number_of_chapters=number_of_chapters,
                filepath=filepath,
                temperature=temperature,
                max_tokens=max_tokens,
                timeout=timeout_val,
                interface_format=interface_format
            )
            self.safe_log(get_text("gen_dir_done", "✅ 章节目录生成完成。请在 'Chapter Blueprint' 标签页查看或编辑。"))
        except Exception:
            self.handle_exception(get_text("gen_dir_error", "生成章节目录时出错"))
        finally:
            self.enable_button_safe(self.btn_generate_directory)
    threading.Thread(target=task, daemon=True).start()

def generate_chapter_draft_ui(self):
    filepath = self.filepath_var.get().strip()
    if not filepath:
        messagebox.showwarning(get_text("warning", "警告"), get_text("set_path_warning", "请先设置保存文件路径"))
        return

    def task():
        self.disable_button_safe(self.btn_generate_chapter)
        try:
            interface_format = self.loaded_config["llm_configs"][self.prompt_draft_llm_var.get()]["interface_format"]
            api_key = self.loaded_config["llm_configs"][self.prompt_draft_llm_var.get()]["api_key"]
            base_url = self.loaded_config["llm_configs"][self.prompt_draft_llm_var.get()]["base_url"]
            model_name = self.loaded_config["llm_configs"][self.prompt_draft_llm_var.get()]["model_name"]
            temperature = self.loaded_config["llm_configs"][self.prompt_draft_llm_var.get()]["temperature"]
            max_tokens = self.loaded_config["llm_configs"][self.prompt_draft_llm_var.get()]["max_tokens"]
            timeout_val = self.loaded_config["llm_configs"][self.prompt_draft_llm_var.get()]["timeout"]

            chap_num = self.safe_get_int(self.chapter_num_var, 1)
            word_number = self.safe_get_int(self.word_number_var, 3000)
            user_guidance = self.user_guide_text.get("0.0", "end").strip()

            char_inv = self.characters_involved_var.get().strip()
            key_items = self.key_items_var.get().strip()
            scene_loc = self.scene_location_var.get().strip()
            time_constr = self.time_constraint_var.get().strip()

            embedding_api_key = self.embedding_api_key_var.get().strip()
            embedding_url = self.embedding_url_var.get().strip()
            embedding_interface_format = self.embedding_interface_format_var.get().strip()
            embedding_model_name = self.embedding_model_name_var.get().strip()
            embedding_k = self.safe_get_int(self.embedding_retrieval_k_var, 4)

            self.safe_log(get_text("prep_draft_prompt", "生成第 {} 章草稿：准备生成请求提示词...").format(chap_num))

            prompt_text = build_chapter_prompt(
                api_key=api_key,
                base_url=base_url,
                model_name=model_name,
                filepath=filepath,
                novel_number=chap_num,
                word_number=word_number,
                temperature=temperature,
                user_guidance=user_guidance,
                characters_involved=char_inv,
                key_items=key_items,
                scene_location=scene_loc,
                time_constraint=time_constr,
                embedding_api_key=embedding_api_key,
                embedding_url=embedding_url,
                embedding_interface_format=embedding_interface_format,
                embedding_model_name=embedding_model_name,
                embedding_retrieval_k=embedding_k,
                interface_format=interface_format,
                max_tokens=max_tokens,
                timeout=timeout_val
            )

            result = {"prompt": None}
            event = threading.Event()

            def create_dialog():
                import config_manager
                dialog = ctk.CTkToplevel(self.master)
                dialog.title(get_text("prompt_dialog_title", "当前章节请求提示词（可编辑）"))
                dialog.geometry("600x400")
                text_box = ctk.CTkTextbox(dialog, wrap="word", font=("Microsoft YaHei", 12))
                text_box.pack(fill="both", expand=True, padx=10, pady=10)

                # 字数统计标签
                count_prefix = "Words: " if config_manager.IS_ENGLISH else "字数: "
                wordcount_label = ctk.CTkLabel(dialog, text=f"{count_prefix}0", font=("Microsoft YaHei", 12))
                wordcount_label.pack(side="left", padx=(10,0), pady=5)
                
                final_prompt = prompt_text
                role_names = [name.strip() for name in self.char_inv_text.get("0.0", "end").strip().split(',') if name.strip()]
                role_lib_path = os.path.join(filepath, "角色库")
                role_contents = []
                
                if os.path.exists(role_lib_path):
                    for root, dirs, files in os.walk(role_lib_path):
                        for file in files:
                            if file.endswith(".txt") and os.path.splitext(file)[0] in role_names:
                                file_path = os.path.join(root, file)
                                try:
                                    with open(file_path, 'r', encoding='utf-8') as f:
                                        role_contents.append(f.read().strip())
                                except Exception as e:
                                    self.safe_log(f"Error reading role file {file}: {str(e)}")
                
                if role_contents:
                    role_content_str = "\n".join(role_contents)
                    role_label = "Core characters:" if config_manager.IS_ENGLISH else "核心人物："
                    placeholder_variations = [
                        "Core characters (may not be specified): {characters_involved}",
                        "Core characters: {characters_involved}",
                        "核心人物(可能未指定)：{characters_involved}",
                        "核心人物：{characters_involved}",
                        "核心人物(可能未指定):{characters_involved}",
                        "核心人物:{characters_involved}"
                    ]
                    
                    for placeholder in placeholder_variations:
                        if placeholder in final_prompt:
                            final_prompt = final_prompt.replace(
                                placeholder,
                                f"{role_label}\n{role_content_str}"
                            )
                            break
                    else:
                        lines = final_prompt.split('\n')
                        search_key = "Core characters" if config_manager.IS_ENGLISH else "核心人物"
                        for line_idx, line in enumerate(lines):
                            if search_key in line and (":" in line or "：" in line):
                                lines[line_idx] = f"{role_label}\n{role_content_str}"
                                break
                        final_prompt = '\n'.join(lines)

                text_box.insert("0.0", final_prompt)
                
                def update_word_count(event=None):
                    text = text_box.get("0.0", "end-1c")
                    text_length = get_word_count(text)
                    wordcount_label.configure(text=get_text("word_count", "字数: {}").format(text_length))

                text_box.bind("<KeyRelease>", update_word_count)
                text_box.bind("<ButtonRelease>", update_word_count)
                update_word_count()

                button_frame = ctk.CTkFrame(dialog)
                button_frame.pack(pady=10)
                def on_confirm():
                    result["prompt"] = text_box.get("1.0", "end").strip()
                    dialog.destroy()
                    event.set()
                def on_cancel():
                    result["prompt"] = None
                    dialog.destroy()
                    event.set()
                btn_confirm = ctk.CTkButton(button_frame, text=get_text("btn_confirm_use", "确认使用"), font=("Microsoft YaHei", 12), command=on_confirm)
                btn_confirm.pack(side="left", padx=10)
                btn_cancel = ctk.CTkButton(button_frame, text=get_text("btn_cancel_request", "取消请求"), font=("Microsoft YaHei", 12), command=on_cancel)
                btn_cancel.pack(side="left", padx=10)
                dialog.protocol("WM_DELETE_WINDOW", on_cancel)
                dialog.grab_set()
            self.master.after(0, create_dialog)
            event.wait()
            edited_prompt = result["prompt"]
            if edited_prompt is None:
                self.safe_log(get_text("draft_cancelled_log", "❌ 用户取消了草稿生成请求。"))
                return

            self.safe_log(get_text("gen_draft_start", "开始生成第 {} 章的草稿...").format(chap_num))
            draft_text = generate_chapter_draft(
                api_key=api_key,
                base_url=base_url,
                model_name=model_name,
                filepath=filepath,
                novel_number=chap_num,
                word_number=word_number,
                temperature=temperature,
                user_guidance=user_guidance,
                characters_involved=char_inv,
                key_items=key_items,
                scene_location=scene_loc,
                time_constraint=time_constr,
                embedding_api_key=embedding_api_key,
                embedding_url=embedding_url,
                embedding_interface_format=embedding_interface_format,
                embedding_model_name=embedding_model_name,
                embedding_retrieval_k=embedding_k,
                interface_format=interface_format,
                max_tokens=max_tokens,
                timeout=timeout_val,
                custom_prompt_text=edited_prompt
            )
            if draft_text:
                self.safe_log(get_text("gen_draft_done", "✅ 第 {} 章的草稿生成完成。请在 'Chapters Manage' 标签页查看或编辑。").format(chap_num))
                self.master.after(0, lambda: self.show_chapter_in_textbox(draft_text))
            else:
                self.safe_log(get_text("draft_failed_log", "⚠️ 本章草稿生成失败或无内容。"))
        except Exception:
            self.handle_exception(get_text("gen_draft_error", "生成章节草稿时出错"))
        finally:
            self.enable_button_safe(self.btn_generate_chapter)
    threading.Thread(target=task, daemon=True).start()

def finalize_chapter_ui(self):
    filepath = self.filepath_var.get().strip()
    if not filepath:
        messagebox.showwarning(get_text("warning", "警告"), get_text("set_path_warning", "请先设置保存文件路径"))
        return

    if not messagebox.askyesno(get_text("confirm_title", "确认"), get_text("finalize_chapter_confirm", "确定要定稿当前章节吗？")):
        return

    edited_text = self.chapter_result.get("0.0", "end").strip()
    word_number = self.safe_get_int(self.word_number_var, 3000)

    should_enrich = False
    edited_word_count = get_word_count(edited_text)
    if edited_word_count < 0.7 * word_number:
        should_enrich = messagebox.askyesno(
            get_text("wc_low_title", "字数不足"),
            get_text("wc_low_prompt", "当前章节字数 ({}) 低于目标字数({})的70%，是否要尝试扩写？").format(edited_word_count, word_number)
        )

    self.disable_button_safe(self.btn_finalize_chapter)

    def task():
        nonlocal edited_text
        try:
            interface_format = self.loaded_config["llm_configs"][self.final_chapter_llm_var.get()]["interface_format"]
            api_key = self.loaded_config["llm_configs"][self.final_chapter_llm_var.get()]["api_key"]
            base_url = self.loaded_config["llm_configs"][self.final_chapter_llm_var.get()]["base_url"]
            model_name = self.loaded_config["llm_configs"][self.final_chapter_llm_var.get()]["model_name"]
            temperature = self.loaded_config["llm_configs"][self.final_chapter_llm_var.get()]["temperature"]
            max_tokens = self.loaded_config["llm_configs"][self.final_chapter_llm_var.get()]["max_tokens"]
            timeout_val = self.loaded_config["llm_configs"][self.final_chapter_llm_var.get()]["timeout"]

            embedding_api_key = self.embedding_api_key_var.get().strip()
            embedding_url = self.embedding_url_var.get().strip()
            embedding_interface_format = self.embedding_interface_format_var.get().strip()
            embedding_model_name = self.embedding_model_name_var.get().strip()

            chap_num = self.safe_get_int(self.chapter_num_var, 1)
            word_number = self.safe_get_int(self.word_number_var, 3000)

            self.safe_log(get_text("finalize_chapter_start", "开始为第 {} 章进行定稿创作...").format(chap_num))

            chapters_dir = os.path.join(filepath, "chapters")
            os.makedirs(chapters_dir, exist_ok=True)
            chapter_file = os.path.join(chapters_dir, f"chapter_{chap_num}.txt")

            if should_enrich:
                self.safe_log(get_text("enriching_chapter", "正在扩写章节内容..."))
                enriched = enrich_chapter_text(
                    chapter_text=edited_text,
                    word_number=word_number,
                    api_key=api_key,
                    base_url=base_url,
                    model_name=model_name,
                    temperature=temperature,
                    interface_format=interface_format,
                    max_tokens=max_tokens,
                    timeout=timeout_val
                )
                edited_text = enriched
                self.master.after(0, lambda: self.chapter_result.delete("0.0", "end"))
                self.master.after(0, lambda t=edited_text: self.chapter_result.insert("0.0", t))
            clear_file_content(chapter_file)
            save_string_to_txt(edited_text, chapter_file)

            finalize_chapter(
                novel_number=chap_num,
                word_number=word_number,
                api_key=api_key,
                base_url=base_url,
                model_name=model_name,
                temperature=temperature,
                filepath=filepath,
                embedding_api_key=embedding_api_key,
                embedding_url=embedding_url,
                embedding_interface_format=embedding_interface_format,
                embedding_model_name=embedding_model_name,
                interface_format=interface_format,
                max_tokens=max_tokens,
                timeout=timeout_val
            )
            self.safe_log(get_text("finalize_chapter_done", "✅ 第 {} 章的定稿创作完成。请在 'Chapters Manage' 标签页查看或编辑。").format(chap_num))

            final_text = read_file(chapter_file)
            self.master.after(0, lambda: self.show_chapter_in_textbox(final_text))
        except Exception:
            self.handle_exception(get_text("finalize_chapter_error", "定稿章节时出错"))
        finally:
            self.enable_button_safe(self.btn_finalize_chapter)
    threading.Thread(target=task, daemon=True).start()

def do_consistency_check(self):
    filepath = self.filepath_var.get().strip()
    if not filepath:
        messagebox.showwarning(get_text("warning", "警告"), get_text("set_path_warning", "请先设置保存文件路径"))
        return

    def task():
        self.disable_button_safe(self.btn_check_consistency)
        try:
            interface_format = self.loaded_config["llm_configs"][self.consistency_review_llm_var.get()]["interface_format"]
            api_key = self.loaded_config["llm_configs"][self.consistency_review_llm_var.get()]["api_key"]
            base_url = self.loaded_config["llm_configs"][self.consistency_review_llm_var.get()]["base_url"]
            model_name = self.loaded_config["llm_configs"][self.consistency_review_llm_var.get()]["model_name"]
            temperature = self.loaded_config["llm_configs"][self.consistency_review_llm_var.get()]["temperature"]
            max_tokens = self.loaded_config["llm_configs"][self.consistency_review_llm_var.get()]["max_tokens"]
            timeout = self.loaded_config["llm_configs"][self.consistency_review_llm_var.get()]["timeout"]

            chap_num = self.safe_get_int(self.chapter_num_var, 1)
            chap_file = os.path.join(filepath, "chapters", f"chapter_{chap_num}.txt")
            chapter_text = read_file(chap_file)

            if not chapter_text.strip():
                self.safe_log(get_text("consistency_empty_err", "⚠️ 当前章节文件为空或不存在，无法审校。"))
                return

            self.safe_log(get_text("consistency_start", "开始一致性审校..."))
            result = check_consistency(
                novel_setting="",
                character_state=read_file(os.path.join(filepath, "character_state.txt")),
                global_summary=read_file(os.path.join(filepath, "global_summary.txt")),
                chapter_text=chapter_text,
                api_key=api_key,
                base_url=base_url,
                model_name=model_name,
                temperature=temperature,
                interface_format=interface_format,
                max_tokens=max_tokens,
                timeout=timeout,
                plot_arcs=""
            )
            self.safe_log("审校结果：")
            self.safe_log(result)
            self.safe_log(get_text("consistency_done", "✅ 一致性审校完成。"))
        except Exception:
            self.handle_exception(get_text("consistency_error", "进行一致性审校时出错"))
        finally:
            self.enable_button_safe(self.btn_check_consistency)
    threading.Thread(target=task, daemon=True).start()

def generate_batch_ui(self):
    def open_batch_dialog():
        dialog = ctk.CTkToplevel()
        dialog.title(get_text("batch_gen_title", "批量生成章节"))
        
        chapter_file = os.path.join(self.filepath_var.get().strip(), "chapters")
        files = glob.glob(os.path.join(chapter_file, "chapter_*.txt"))
        if not files:
            num = 1
        else:
            num = max(int(os.path.basename(f).split('_')[1].split('.')[0]) for f in files) + 1
            
        dialog.geometry("400x200")
        dialog.resizable(False, False)
        
        dialog.grid_columnconfigure(0, weight=0)
        dialog.grid_columnconfigure(1, weight=1)
        dialog.grid_columnconfigure(2, weight=0)
        dialog.grid_columnconfigure(3, weight=1)
        
        ctk.CTkLabel(dialog, text=get_text("start_chapter", "起始章节:")).grid(row=0, column=0, padx=10, pady=10, sticky="w")
        entry_start = ctk.CTkEntry(dialog)
        entry_start.grid(row=0, column=1, padx=10, pady=10, sticky="ew")
        entry_start.insert(0, str(num))
        
        ctk.CTkLabel(dialog, text=get_text("end_chapter", "结束章节:")).grid(row=0, column=2, padx=10, pady=10, sticky="w")
        entry_end = ctk.CTkEntry(dialog)
        entry_end.grid(row=0, column=3, padx=10, pady=10, sticky="ew")
        
        ctk.CTkLabel(dialog, text=get_text("expected_words", "期望字数:")).grid(row=1, column=0, padx=10, pady=10, sticky="w")
        entry_word = ctk.CTkEntry(dialog)
        entry_word.grid(row=1, column=1, padx=10, pady=10, sticky="ew")
        entry_word.insert(0, self.word_number_var.get())
        
        ctk.CTkLabel(dialog, text=get_text("min_words", "最低字数:")).grid(row=1, column=2, padx=10, pady=10, sticky="w")
        entry_min = ctk.CTkEntry(dialog)
        entry_min.grid(row=1, column=3, padx=10, pady=10, sticky="ew")
        entry_min.insert(0, self.word_number_var.get())

        auto_enrich_bool = ctk.BooleanVar()
        auto_enrich_bool_ck = ctk.CTkCheckBox(dialog, text=get_text("auto_enrich_checkbox", "低于最低字数时自动扩写"), variable=auto_enrich_bool)
        auto_enrich_bool_ck.grid(row=2, column=0, columnspan=2, padx=10, pady=10, sticky="w")

        result = {"start": None, "end": None, "word": None, "min": None, "auto_enrich": None, "close": False}

        def on_confirm():
            nonlocal result
            if not entry_start.get() or not entry_end.get() or not entry_word.get() or not entry_min.get():
                messagebox.showwarning(get_text("warning", "警告"), get_text("fill_all_info", "请填写完整信息。"))
                return

            result = {
                "start": entry_start.get(),
                "end": entry_end.get(),
                "word": entry_word.get(),
                "min": entry_min.get(),
                "auto_enrich": auto_enrich_bool.get(),
                "close": False
            }
            dialog.destroy()

        def on_cancel():
            nonlocal result
            result["close"] = True
            dialog.destroy()
            
        button_frame = ctk.CTkFrame(dialog)
        button_frame.grid(row=3, column=0, columnspan=4, padx=10, pady=10, sticky="ew")
        button_frame.grid_columnconfigure(0, weight=1)
        button_frame.grid_columnconfigure(1, weight=1)
        
        ctk.CTkButton(button_frame, text=get_text("btn_confirm", "确认"), command=on_confirm).grid(row=0, column=0, padx=10, pady=10, sticky="e")
        ctk.CTkButton(button_frame, text=get_text("btn_cancel", "取消"), command=on_cancel).grid(row=0, column=1, padx=10, pady=10, sticky="w")
        
        dialog.protocol("WM_DELETE_WINDOW", on_cancel)
        dialog.transient(self.master)
        dialog.grab_set()
        dialog.wait_window(dialog)
        return result
    
    def generate_chapter_batch(self, i, word, min_w, auto_enrich):
        draft_interface_format = self.loaded_config["llm_configs"][self.prompt_draft_llm_var.get()]["interface_format"]
        draft_api_key = self.loaded_config["llm_configs"][self.prompt_draft_llm_var.get()]["api_key"]
        draft_base_url = self.loaded_config["llm_configs"][self.prompt_draft_llm_var.get()]["base_url"]
        draft_model_name = self.loaded_config["llm_configs"][self.prompt_draft_llm_var.get()]["model_name"]
        draft_temperature = self.loaded_config["llm_configs"][self.prompt_draft_llm_var.get()]["temperature"]
        draft_max_tokens = self.loaded_config["llm_configs"][self.prompt_draft_llm_var.get()]["max_tokens"]
        draft_timeout = self.loaded_config["llm_configs"][self.prompt_draft_llm_var.get()]["timeout"]
        user_guidance = self.user_guide_text.get("0.0", "end").strip()  

        char_inv = self.characters_involved_var.get().strip()
        key_items = self.key_items_var.get().strip()
        scene_loc = self.scene_location_var.get().strip()
        time_constr = self.time_constraint_var.get().strip()

        embedding_api_key = self.embedding_api_key_var.get().strip()
        embedding_url = self.embedding_url_var.get().strip()
        embedding_interface_format = self.embedding_interface_format_var.get().strip()
        embedding_model_name = self.embedding_model_name_var.get().strip()
        embedding_k = self.safe_get_int(self.embedding_retrieval_k_var, 4)

        prompt_text = build_chapter_prompt(
            api_key=draft_api_key,
            base_url=draft_base_url,
            model_name=draft_model_name,
            filepath=self.filepath_var.get().strip(),
            novel_number=i,
            word_number=word,
            temperature=draft_temperature,
            user_guidance=user_guidance,
            characters_involved=char_inv,
            key_items=key_items,
            scene_location=scene_loc,
            time_constraint=time_constr,
            embedding_api_key=embedding_api_key,
            embedding_url=embedding_url,
            embedding_interface_format=embedding_interface_format,
            embedding_model_name=embedding_model_name,
            embedding_retrieval_k=embedding_k,
            interface_format=draft_interface_format,
            max_tokens=draft_max_tokens,
            timeout=draft_timeout,
        )
        final_prompt = prompt_text
        role_names = [name.strip() for name in self.char_inv_text.get("0.0", "end").split("\n")]
        role_lib_path = os.path.join(self.filepath_var.get().strip(), "角色库")
        role_contents = []
        if os.path.exists(role_lib_path):
            for root, dirs, files in os.walk(role_lib_path):
                for file in files:
                    if file.endswith(".txt") and os.path.splitext(file)[0] in role_names:
                        file_path = os.path.join(root, file)
                        try:
                            with open(file_path, 'r', encoding='utf-8') as f:
                                role_contents.append(f.read().strip())
                        except Exception as e:
                            self.safe_log(f"Error reading role file {file}: {str(e)}")
        if role_contents:
            role_content_str = "\n".join(role_contents)
            placeholder_variations = [
                "核心人物(可能未指定)：{characters_involved}",
                "核心人物：{characters_involved}",
                "核心人物(可能未指定):{characters_involved}",
                "核心人物:{characters_involved}"
            ]
            
            for placeholder in placeholder_variations:
                if placeholder in final_prompt:
                    final_prompt = final_prompt.replace(
                        placeholder,
                        f"核心人物：\n{role_content_str}"
                    )
                    break
            else:
                lines = final_prompt.split('\n')
                for line_idx, line in enumerate(lines):
                    if "核心人物" in line and "：" in line:
                        lines[line_idx] = f"核心人物：\n{role_content_str}"
                        break
                final_prompt = '\n'.join(lines)
        draft_text = generate_chapter_draft(
            api_key=draft_api_key,
            base_url=draft_base_url,
            model_name=draft_model_name,
            filepath=self.filepath_var.get().strip(),
            novel_number=i,
            word_number=word,
            temperature=draft_temperature,
            user_guidance=user_guidance,
            characters_involved=char_inv,
            key_items=key_items,
            scene_location=scene_loc,
            time_constraint=time_constr,
            embedding_api_key=embedding_api_key,
            embedding_url=embedding_url,
            embedding_interface_format=embedding_interface_format,
            embedding_model_name=embedding_model_name,
            embedding_retrieval_k=embedding_k,
            interface_format=draft_interface_format,
            max_tokens=draft_max_tokens,
            timeout=draft_timeout,
            custom_prompt_text=final_prompt  
        )
        if not draft_text.strip():
            raise RuntimeError(f"Draft generation failed for Chapter {i}.")

        finalize_interface_format = self.loaded_config["llm_configs"][self.final_chapter_llm_var.get()]["interface_format"]
        finalize_api_key = self.loaded_config["llm_configs"][self.final_chapter_llm_var.get()]["api_key"]
        finalize_base_url = self.loaded_config["llm_configs"][self.final_chapter_llm_var.get()]["base_url"]
        finalize_model_name = self.loaded_config["llm_configs"][self.final_chapter_llm_var.get()]["model_name"]
        finalize_temperature = self.loaded_config["llm_configs"][self.final_chapter_llm_var.get()]["temperature"]
        finalize_max_tokens = self.loaded_config["llm_configs"][self.final_chapter_llm_var.get()]["max_tokens"]
        finalize_timeout = self.loaded_config["llm_configs"][self.final_chapter_llm_var.get()]["timeout"]

        chapters_dir = os.path.join(self.filepath_var.get().strip(), "chapters")
        os.makedirs(chapters_dir, exist_ok=True)
        chapter_path = os.path.join(chapters_dir, f"chapter_{i}.txt")
        if get_word_count(draft_text) < 0.7 * min_w and auto_enrich:
            self.safe_log(get_text("enriching_chapter", "正在扩写章节内容..."))
            enriched = enrich_chapter_text(
                chapter_text=draft_text,
                word_number=word,
                api_key=draft_api_key,
                base_url=draft_base_url,
                model_name=draft_model_name,
                temperature=draft_temperature,
                interface_format=draft_interface_format,
                max_tokens=draft_max_tokens,
                timeout=draft_timeout
            )
            draft_text = enriched
        clear_file_content(chapter_path)
        save_string_to_txt(draft_text, chapter_path)
        finalize_chapter(
            novel_number=i,
            word_number=word,
            api_key=finalize_api_key,
            base_url=finalize_base_url,
            model_name=finalize_model_name,
            temperature=finalize_temperature,
            filepath=self.filepath_var.get().strip(),
            embedding_api_key=embedding_api_key,
            embedding_url=embedding_url,
            embedding_interface_format=embedding_interface_format,
            embedding_model_name=embedding_model_name,
            interface_format=finalize_interface_format,
            max_tokens=finalize_max_tokens,
            timeout=finalize_timeout
        )

    result = open_batch_dialog()
    if result["close"]:
        return

    def batch_task():
        try:
            start_num = int(result["start"])
            end_num = int(result["end"])
            total = end_num - start_num + 1
            chapters = list(range(start_num, end_num + 1))
            self.safe_log(get_text("batch_gen_start", "开始批量生成章节草稿: {}").format(str(chapters)))
            
            success_chapters = []
            for idx, i in enumerate(chapters):
                self.safe_log(get_text("batch_gen_chapter_start", "--- 开始生成第 {} 章 ({}/{}) ---").format(i, idx + 1, total))
                generate_chapter_batch(self, i, int(result["word"]), int(result["min"]), result["auto_enrich"])
                self.safe_log(get_text("batch_gen_chapter_done", "第 {} 章生成成功！").format(i))
                success_chapters.append(i)
                
            self.safe_log(get_text("batch_gen_all_done", "✅ 批量生成完成。生成成功的章节: {}").format(str(success_chapters)))
        except Exception:
            self.handle_exception(get_text("batch_gen_error", "批量生成章节草稿时出错"))

    threading.Thread(target=batch_task, daemon=True).start()

def import_knowledge_handler(self):
    selected_file = filedialog.askopenfilename(
        title=get_text("choose_knowledge_file_title", "选择要导入的知识库文件"),
        filetypes=[("Text Files", "*.txt"), ("All Files", "*.*")]
    )
    if selected_file:
        def task():
            self.disable_button_safe(self.btn_import_knowledge)
            try:
                emb_api_key = self.embedding_api_key_var.get().strip()
                emb_url = self.embedding_url_var.get().strip()
                emb_format = self.embedding_interface_format_var.get().strip()
                emb_model = self.embedding_model_name_var.get().strip()

                content = None
                encodings = ['utf-8', 'gbk', 'gb2312', 'ansi']
                for encoding in encodings:
                    try:
                        with open(selected_file, 'r', encoding=encoding) as f:
                            content = f.read()
                            break
                    except UnicodeDecodeError:
                        continue
                    except Exception as e:
                        self.safe_log(get_text("knowledge_read_error", "读取文件时发生错误: {}").format(str(e)))
                        raise

                if content is None:
                    raise Exception(get_text("knowledge_decode_error", "无法以任何已知编码格式读取文件"))

                with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', delete=False, suffix='.txt') as temp:
                    temp.write(content)
                    temp_path = temp.name

                try:
                    self.safe_log(get_text("knowledge_import_start", "开始导入知识库文件: {}").format(selected_file))
                    import_knowledge_file(
                        embedding_api_key=emb_api_key,
                        embedding_url=emb_url,
                        embedding_interface_format=emb_format,
                        embedding_model_name=emb_model,
                        file_path=temp_path,
                        filepath=self.filepath_var.get().strip()
                    )
                    self.safe_log(get_text("knowledge_import_done", "✅ 知识库文件导入完成。"))
                finally:
                    try:
                        os.unlink(temp_path)
                    except:
                        pass
            except Exception:
                self.handle_exception(get_text("knowledge_import_error", "导入知识库时出错"))
            finally:
                self.enable_button_safe(self.btn_import_knowledge)

        try:
            thread = threading.Thread(target=task, daemon=True)
            thread.start()
        except Exception as e:
            self.enable_button_safe(self.btn_import_knowledge)
            messagebox.showerror(get_text("error", "错误"), get_text("thread_start_error", "线程启动失败: {}").format(str(e)))

def clear_vectorstore_handler(self):
    filepath = self.filepath_var.get().strip()
    if not filepath:
        messagebox.showwarning(get_text("warning", "警告"), get_text("set_path_warning", "请先设置保存文件路径"))
        return

    first_confirm = messagebox.askyesno(get_text("warning", "警告"), get_text("clear_vectorstore_warn", "确定要清空本地向量库吗？此操作不可恢复！"))
    if first_confirm:
        second_confirm = messagebox.askyesno(get_text("second_confirm", "二次确认"), get_text("clear_vectorstore_warn_2", "你确定真的要删除所有向量数据吗？此操作不可恢复！"))
        if second_confirm:
            if clear_vector_store(filepath):
                self.log(get_text("clear_vectorstore_done", "向量库清空完成。"))
            else:
                self.log(get_text("clear_vectorstore_fail", "未能清空向量库，请关闭程序后手动删除 {} 下的 vectorstore 文件夹。").format(filepath))

def show_plot_arcs_ui(self):
    filepath = self.filepath_var.get().strip()
    if not filepath:
        messagebox.showwarning(get_text("warning", "警告"), get_text("set_path_warning", "请先设置保存文件路径"))
        return

    plot_arcs_file = os.path.join(filepath, "plot_arcs.txt")
    if not os.path.exists(plot_arcs_file):
        messagebox.showinfo(get_text("plot_arcs_title", "剧情要点/未解决冲突"), get_text("no_plot_arcs", "当前还未生成任何剧情要点或冲突记录。"))
        return

    arcs_text = read_file(plot_arcs_file).strip()
    if not arcs_text:
        arcs_text = get_text("no_arcs_recorded", "当前没有记录的剧情要点或冲突。")

    top = ctk.CTkToplevel(self.master)
    top.title(get_text("plot_arcs_title", "剧情要点/未解决冲突"))
    top.geometry("600x400")
    text_area = ctk.CTkTextbox(top, wrap="word", font=("Microsoft YaHei", 12))
    text_area.pack(fill="both", expand=True, padx=10, pady=10)
    text_area.insert("0.0", arcs_text)
    text_area.configure(state="disabled")
