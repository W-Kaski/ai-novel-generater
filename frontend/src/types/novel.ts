// frontend/src/types/novel.ts

export interface LLMConfig {
  api_key: string;
  base_url: string;
  model_name: string;
  temperature: number;
  max_tokens: number;
  timeout: number;
  interface_format: string;
}

export interface EmbeddingConfig {
  api_key: string;
  base_url: string;
  model_name: string;
  retrieval_k: number;
  interface_format: string;
}

export interface OtherParams {
  novel_name: string;
  topic: string;
  genre: string;
  target_audience: string;
  platform_style: string;
  writing_style: string;
  pacing_requirement: string;
  num_chapters: number;
  word_number: number;
  filepath: string;
  chapter_num: string;
  user_guidance: string;
  characters_involved: string;
  key_items: string;
  scene_location: string;
  time_constraint: string;
  webdav_url?: string;
  webdav_username?: string;
  webdav_password?: string;
}

export interface ProxySetting {
  proxy_url: string;
  proxy_port: string;
  enabled: boolean;
}

export interface WebDAVConfig {
  webdav_url: string;
  webdav_username: string;
  webdav_password: string;
}

export interface AppConfig {
  is_english: boolean;
  last_interface_format?: string;
  last_embedding_interface_format?: string;
  llm_configs: Record<string, LLMConfig>;
  embedding_configs: Record<string, EmbeddingConfig>;
  other_params: OtherParams;
  choose_configs: {
    prompt_draft_llm: string;
    chapter_outline_llm: string;
    architecture_llm: string;
    final_chapter_llm: string;
    consistency_review_llm: string;
  };
  proxy_setting: ProxySetting;
  webdav_config?: WebDAVConfig;
  deep_settings?: any;
}


// Plot timeline v2 (character tracks)
export interface PlotBeat {
  character: string;
  event: string;
  scene_id?: string;
}

export interface PlotChapter {
  chapter_num: number;
  beats: PlotBeat[];
}

export interface PlotArcsData {
  schema_version: 2;
  chapters: PlotChapter[];
}

// API payload types
export interface LLMTestPayload {
  interface_format: string;
  api_key: string;
  base_url: string;
  model_name: string;
  temperature: number;
  max_tokens: number;
  timeout: number;
}

export interface EmbeddingTestPayload {
  interface_format: string;
  api_key: string;
  base_url: string;
  model_name: string;
}

export interface GenerateArchitecturePayload {
  model_key: string;
  novel_name: string;
  topic: string;
  genre: string;
  target_audience: string;
  platform_style: string;
  writing_style: string;
  pacing_requirement: string;
  num_chapters: number;
  word_number: number;
  user_guidance: string;
  filepath: string;
}

export interface GenerateBlueprintPayload {
  model_key: string;
  num_chapters: number;
  filepath: string;
}

export interface BuildPromptPayload {
  model_key: string;
  chapter_num: number;
  word_number: number;
  user_guidance: string;
  characters_involved: string;
  key_items: string;
  scene_location: string;
  time_constraint: string;
  embedding_key: string;
  filepath: string;
}

export interface GenerateDraftPayload {
  model_key: string;
  chapter_num: number;
  word_number: number;
  user_guidance: string;
  characters_involved: string;
  key_items: string;
  scene_location: string;
  time_constraint: string;
  embedding_key: string;
  filepath: string;
  custom_prompt_text: string;
}

export interface FinalizeChapterPayload {
  model_key: string;
  embedding_key: string;
  chapter_num: number;
  word_number: number;
  filepath: string;
  chapter_text: string;
  should_enrich: boolean;
}

export interface ConsistencyCheckPayload {
  model_key: string;
  chapter_num: number;
  filepath: string;
}

export interface ImportKnowledgePayload {
  embedding_key: string;
  filepath: string;
  file_content: string;
  file_name: string;
}

export interface SaveFilePayload {
  filepath: string;
  file_name: string;
  content: string;
}

// Role Types
export interface Role {
  name: string;
  file_name: string;
  content: string;
}

export interface Category {
  name: string;
  roles: Role[];
}

export interface WatchFilesResponse {
  files: Record<string, {
    exists: boolean;
    content: string;
    word_count: number;
  }>;
}

export interface ListChaptersResponse {
  drafts: string[];
  finalized: string[];
}

export interface SettingCard {
  id: string;
  required: boolean;
  category: string;
  title: string;
  content: string;
  heading_level?: number;
}
