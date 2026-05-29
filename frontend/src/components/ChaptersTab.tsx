// frontend/src/components/ChaptersTab.tsx
import React, { useState, useEffect } from 'react';
import { listChapters, getChapterContent, saveFile, buildPrompt, generateDraft, finalizeChapter, checkConsistency } from '../api';
import MarkdownWorkspace from './MarkdownWorkspace';
import { getChineseWordCount } from '../utils/wordCount';
import { Sparkles, PenTool, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';

interface ChaptersTabProps {
  filepath: string;
  selectedLLM: string;
  selectedEmbedding: string;
  selectedRoles: string[];
  wordCountTarget: number;
  /** 创作参数：从主面板同步，避免内部使用硬编码空值 */
  userGuidance: string;
  charactersInvolved: string;
  keyItems: string;
  sceneLocation: string;
  timeConstraint: string;
}

export default function ChaptersTab({
  filepath,
  selectedLLM,
  selectedEmbedding,
  selectedRoles,
  wordCountTarget,
  userGuidance,
  charactersInvolved,
  keyItems,
  sceneLocation,
  timeConstraint,
}: ChaptersTabProps) {
  const [activeChapterNum, setActiveChapterNum] = useState<number>(1);
  const [chapterContent, setChapterContent] = useState<string>('');
  const [wordCount, setWordCount] = useState<number>(0);
  const [draftsList, setDraftsList] = useState<string[]>([]);
  const [finalizedList, setFinalizedList] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Prompt modal state
  const [draftPrompt, setDraftPrompt] = useState('');
  const [showPromptModal, setShowPromptModal] = useState(false);

  // Consistency check modal state
  const [consistencyResult, setConsistencyResult] = useState('');
  const [showConsistencyModal, setShowConsistencyModal] = useState(false);

  // Chinese character word count — shared utility from utils/wordCount.ts

  const fetchChaptersList = async () => {
    if (!filepath) return;
    try {
      const data = await listChapters(filepath);
      setDraftsList(data.drafts);
      setFinalizedList(data.finalized);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchActiveChapter = async () => {
    if (!filepath) return;
    setLoading(true);
    try {
      // Find matching draft file name, e.g. chapter_1.md
      const fileName = `chapter_${activeChapterNum}.md`;
      const draftExists = draftsList.includes(fileName);
      const finalExists = finalizedList.includes(fileName);
      
      let content = '';
      if (draftExists) {
        const data = await getChapterContent(filepath, fileName, true);
        content = data.content;
      } else if (finalExists) {
        const data = await getChapterContent(filepath, fileName, false);
        content = data.content;
      } else {
        content = `# 第 ${activeChapterNum} 章\n\n在此输入本章大纲或点击“生成本章草稿”启动创作...`;
      }
      setChapterContent(content);
      setWordCount(getChineseWordCount(content));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChaptersList();
  }, [filepath]);

  useEffect(() => {
    fetchActiveChapter();
  }, [activeChapterNum, draftsList, finalizedList]);

  // Previous Chapter trigger
  const handlePrevChapter = () => {
    if (activeChapterNum > 1) {
      setActiveChapterNum(prev => prev - 1);
    }
  };

  // Next Chapter trigger
  const handleNextChapter = () => {
    setActiveChapterNum(prev => prev + 1);
  };

  // Save current chapter content
  const handleSaveChapter = async () => {
    if (!filepath) return;
    try {
      const fileName = `01_chapters/chapter_${activeChapterNum}.md`;
      await saveFile({
        filepath,
        file_name: fileName,
        content: chapterContent,
      });
      alert(`第 ${activeChapterNum} 章保存成功！`);
      fetchChaptersList();
    } catch (e) {
      alert('保存失败，请确认连接状态！');
    }
  };

  // Compile draft generation details and open prompt editor
  const handleLoadDraftPrompt = async () => {
    if (!filepath) return;
    try {
      const data = await buildPrompt({
        model_key: selectedLLM,
        chapter_num: activeChapterNum,
        word_number: wordCountTarget,
        user_guidance: userGuidance,
        characters_involved: charactersInvolved || selectedRoles.join(','),
        key_items: keyItems,
        scene_location: sceneLocation,
        time_constraint: timeConstraint,
        embedding_key: selectedEmbedding,
        filepath,
      });
      setDraftPrompt(data.prompt);
      setShowPromptModal(true);
    } catch (e) {
      alert('编译提示词失败，请检查模型与向量库配置！');
    }
  };

  const handleStartGenerateDraft = async () => {
    if (!filepath) return;
    try {
      await generateDraft({
        model_key: selectedLLM,
        chapter_num: activeChapterNum,
        word_number: wordCountTarget,
        user_guidance: userGuidance,
        characters_involved: charactersInvolved || selectedRoles.join(','),
        key_items: keyItems,
        scene_location: sceneLocation,
        time_constraint: timeConstraint,
        embedding_key: selectedEmbedding,
        filepath,
        custom_prompt_text: draftPrompt,
      });
      setShowPromptModal(false);
      alert(`第 ${activeChapterNum} 章后台草稿生成任务已开启！请前往"主面板终端"关注轨迹日志。`);
    } catch (e) {
      alert('指派草稿生成任务失败！');
    }
  };

  // Execute chapter finalization & vector base syncing
  const handleFinalizeChapter = async () => {
    if (!filepath) return;
    const lowCount = wordCount < 0.7 * wordCountTarget;
    const enrich = lowCount ? window.confirm(`当前章节字数 (${wordCount}字) 低于期望字数 (${wordCountTarget}字) 的70%，定稿时是否让 AI 自动进行扩写扩充？`) : false;
    
    try {
      await finalizeChapter({
        model_key: selectedLLM,
        embedding_key: selectedEmbedding,
        chapter_num: activeChapterNum,
        word_number: wordCountTarget,
        filepath,
        chapter_text: chapterContent,
        should_enrich: enrich,
      });
      alert('已在后台开启本章最终定稿与向量库写入任务！详情在控制台日志查看。');
    } catch (e) {
      alert('定稿任务发起失败！');
    }
  };

  // Run Consistency Checker on selected chapter
  const handleCheckConsistency = async () => {
    if (!filepath) return;
    try {
      const data = await checkConsistency({
        model_key: selectedLLM,
        chapter_num: activeChapterNum,
        filepath,
      });
      setConsistencyResult(data.result);
      setShowConsistencyModal(true);
    } catch (e) {
      alert('一致性校验接口异常，请确认大模型配置！');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Chapters workspace controller tab */}
      <MarkdownWorkspace
        title={`第 ${activeChapterNum} 章 写作与管理`}
        content={chapterContent}
        onChange={(val) => {
          setChapterContent(val);
          setWordCount(getChineseWordCount(val));
        }}
        onSave={handleSaveChapter}
        wordCount={wordCount}
        loading={loading}
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {/* Chapter Selection Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.2rem 0.5rem', marginRight: '0.5rem' }}>
              <button 
                onClick={handlePrevChapter} 
                disabled={activeChapterNum <= 1}
                style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', display: 'flex' }}
              >
                <ChevronLeft size={16} />
              </button>
              <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#fff', width: '50px', textAlign: 'center' }}>
                第 {activeChapterNum} 章
              </span>
              <button 
                onClick={handleNextChapter} 
                style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', display: 'flex' }}
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Custom generation commands */}
            <button className="btn-secondary" onClick={handleLoadDraftPrompt} style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }} title="生成本章草稿">
              <Sparkles size={14} style={{ color: '#60a5fa' }} /> 生成草稿
            </button>
            <button className="btn-secondary" onClick={handleFinalizeChapter} style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }} title="定稿并同步至向量库">
              <PenTool size={14} style={{ color: '#10b981' }} /> 定稿存库
            </button>
            <button className="btn-secondary" onClick={handleCheckConsistency} style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }} title="校验人设一致性">
              <CheckCircle size={14} style={{ color: '#f59e0b' }} /> 一致性校验
            </button>
          </div>
        }
      />

      {/* Compile Prompt Modal Dialog */}
      {showPromptModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '800px', height: '80vh' }}>
            <div className="modal-header">
              <h3 style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem' }}>
                <Sparkles size={16} style={{ color: '#60a5fa' }} /> 第 {activeChapterNum} 章 AI 生成请求提示词 (可编辑)
              </h3>
              <button 
                onClick={() => setShowPromptModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <textarea
                className="editor-textarea"
                style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.85rem', lineHeight: '1.5' }}
                value={draftPrompt}
                onChange={(e) => setDraftPrompt(e.target.value)}
              />
              <div className="status-bar" style={{ marginTop: '0.5rem' }}>
                <span>提示词估算字数: {getChineseWordCount(draftPrompt)} 字</span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowPromptModal(false)}>取消</button>
              <button className="btn-primary" onClick={handleStartGenerateDraft}>确认发送大模型生成草稿</button>
            </div>
          </div>
        </div>
      )}

      {/* Consistency review feedback Modal */}
      {showConsistencyModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '800px', height: '80vh' }}>
            <div className="modal-header">
              <h3 style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem' }}>
                <CheckCircle size={16} style={{ color: '#f59e0b' }} /> 第 {activeChapterNum} 章 一致性校验审校报告
              </h3>
              <button 
                onClick={() => setShowConsistencyModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>
            <div className="modal-body" style={{ overflowY: 'auto', backgroundColor: '#05070c', padding: '1.5rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
              <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '0.9rem', lineHeight: '1.7', color: '#d1d5db' }}>
                {consistencyResult}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-primary" onClick={() => setShowConsistencyModal(false)}>关闭报告</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
