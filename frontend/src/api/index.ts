// frontend/src/api/index.ts
import axios from "axios";
import * as T from "../types/novel";

export const API_BASE = "http://127.0.0.1:8000";

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    "Content-Type": "application/json",
  },
});

export const getConfig = () =>
  api.get<T.AppConfig>("/api/config").then((r) => r.data);

export const saveAppConfig = (config: T.AppConfig) =>
  api
    .post<{ status: string; message: string }>("/api/config", config)
    .then((r) => r.data);

export const testLLM = (payload: T.LLMTestPayload) =>
  api
    .post<{ status: string; logs: string[] }>("/api/test/llm", payload)
    .then((r) => r.data);

export const testEmbedding = (payload: T.EmbeddingTestPayload) =>
  api
    .post<{ status: string; logs: string[] }>("/api/test/embedding", payload)
    .then((r) => r.data);

export const generateArchitecture = (payload: T.GenerateArchitecturePayload) =>
  api
    .post<{
      status: string;
      message: string;
    }>("/api/generate/architecture", payload)
    .then((r) => r.data);

export const generateBlueprint = (payload: T.GenerateBlueprintPayload) =>
  api
    .post<{
      status: string;
      message: string;
    }>("/api/generate/blueprint", payload)
    .then((r) => r.data);

export const buildPrompt = (payload: T.BuildPromptPayload) =>
  api
    .post<{
      status: string;
      prompt: string;
    }>("/api/generate/build_prompt", payload)
    .then((r) => r.data);

export const generateDraft = (payload: T.GenerateDraftPayload) =>
  api
    .post<{ status: string; message: string }>("/api/generate/draft", payload)
    .then((r) => r.data);

export const finalizeChapter = (payload: T.FinalizeChapterPayload) =>
  api
    .post<{
      status: string;
      message: string;
    }>("/api/generate/finalize", payload)
    .then((r) => r.data);

export const checkConsistency = (payload: T.ConsistencyCheckPayload) =>
  api
    .post<{ status: string; result: string }>("/api/check-consistency", payload)
    .then((r) => r.data);

export const importKnowledge = (payload: T.ImportKnowledgePayload) =>
  api
    .post<{ status: string; message: string }>("/api/knowledge/import", payload)
    .then((r) => r.data);

export const clearKnowledge = (filepath: string) =>
  api
    .post<{
      status: string;
      message: string;
    }>("/api/knowledge/clear", { filepath })
    .then((r) => r.data);

export const watchFiles = (filepath: string) =>
  api
    .get<T.WatchFilesResponse>(
      `/api/files/watch?filepath=${encodeURIComponent(filepath)}`,
    )
    .then((r) => r.data);

export const saveFile = (payload: T.SaveFilePayload) =>
  api
    .post<{ status: string; message: string }>("/api/files/save", payload)
    .then((r) => r.data);

export const listChapters = (filepath: string) =>
  api
    .get<T.ListChaptersResponse>(
      `/api/chapters?filepath=${encodeURIComponent(filepath)}`,
    )
    .then((r) => r.data);

export const getChapterContent = (
  filepath: string,
  chapter_name: string,
  is_draft: boolean,
) =>
  api
    .get<{
      content: string;
      word_count: number;
    }>(`/api/chapter/content?filepath=${encodeURIComponent(filepath)}&chapter_name=${encodeURIComponent(chapter_name)}&is_draft=${is_draft}`)
    .then((r) => r.data);

export const listRoles = (filepath: string) =>
  api
    .get<{
      categories: T.Category[];
    }>(`/api/roles?filepath=${encodeURIComponent(filepath)}`)
    .then((r) => r.data);

export const saveRole = (payload: {
  filepath: string;
  category: string;
  role_name: string;
  content: string;
}) =>
  api
    .post<{ status: string; message: string }>("/api/roles", payload)
    .then((r) => r.data);

export const deleteRole = (
  filepath: string,
  category: string,
  role_name: string,
) =>
  api
    .post<{
      status: string;
      message: string;
    }>("/api/roles/delete", { filepath, category, role_name })
    .then((r) => r.data);

export const chatWithAI = (payload: {
  model_key: string;
  user_msg: string;
  history: { role: string; content: string }[];
}) =>
  api
    .post<{ status: string; response: string }>("/api/chat", payload)
    .then((r) => r.data);

export const getSettingCards = (filepath: string) =>
  api
    .get<
      T.SettingCard[]
    >(`/api/setting_cards?filepath=${encodeURIComponent(filepath)}`)
    .then((r) => r.data);

export const saveSettingCards = (payload: {
  filepath: string;
  cards: T.SettingCard[];
}) =>
  api
    .post<{ status: string; message: string }>("/api/setting_cards", payload)
    .then((r) => r.data);

export const listProjects = () =>
  api
    .get<{
      novels_root: string;
      projects: { name: string; path: string; has_settings: boolean }[];
    }>("/api/projects")
    .then((r) => r.data);

export const validateProjectPath = (path: string) =>
  api
    .get<{
      valid: boolean;
      path: string;
      name?: string;
      message?: string;
      has_settings?: boolean;
    }>(`/api/projects/validate?path=${encodeURIComponent(path)}`)
    .then((r) => r.data);

export const getPlotArcs = (filepath: string) =>
  api
    .get<T.PlotArcsData>(
      `/api/plot_arcs?filepath=${encodeURIComponent(filepath)}`,
    )
    .then((r) => r.data);

export const savePlotArcs = (payload: {
  filepath: string;
  data: T.PlotArcsData;
}) =>
  api
    .post<{ status: string; message: string }>("/api/plot_arcs", payload)
    .then((r) => r.data);

export const getCharacterState = (filepath: string) =>
  api
    .get<{
      content: string;
    }>(`/api/character_state?filepath=${encodeURIComponent(filepath)}`)
    .then((r) => r.data);

export const getWorldMap = (filepath: string) =>
  api
    .get<any>(`/api/world_map?filepath=${encodeURIComponent(filepath)}`)
    .then((r) => r.data);

export const saveWorldMap = (payload: { filepath: string; map_data: any }) =>
  api
    .post<{ status: string; message: string }>("/api/world_map", payload)
    .then((r) => r.data);
