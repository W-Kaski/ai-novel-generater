import React, { useEffect, useState } from 'react';
import { FolderOpen, Check } from 'lucide-react';
import { listProjects, validateProjectPath } from '../api';

export interface NovelProject {
  name: string;
  path: string;
  has_settings: boolean;
}

interface ProjectPickerModalProps {
  open: boolean;
  currentPath: string;
  onClose: () => void;
  onSelect: (path: string) => void;
}

export default function ProjectPickerModal({
  open,
  currentPath,
  onClose,
  onSelect,
}: ProjectPickerModalProps) {
  const [projects, setProjects] = useState<NovelProject[]>([]);
  const [novelsRoot, setNovelsRoot] = useState('');
  const [manualPath, setManualPath] = useState(currentPath);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setManualPath(currentPath);
    setError('');
    setLoading(true);
    listProjects()
      .then(data => {
        setProjects(data.projects || []);
        setNovelsRoot(data.novels_root || '');
      })
      .catch(() => setError('无法从后端加载项目列表，请确认 server.py 已启动。'))
      .finally(() => setLoading(false));
  }, [open, currentPath]);

  if (!open) return null;

  const handlePick = (path: string) => {
    onSelect(path);
    onClose();
  };

  const handleManualConfirm = async () => {
    const trimmed = manualPath.trim();
    if (!trimmed) {
      setError('请输入路径');
      return;
    }
    setError('');
    try {
      const res = await validateProjectPath(trimmed);
      if (!res.valid) {
        setError(res.message || '路径无效');
        return;
      }
      handlePick(res.path);
    } catch {
      setError('校验路径失败，请检查后端连接');
    }
  };

  const norm = (p: string) => p.replace(/\\/g, '/').toLowerCase();
  const isCurrent = (p: string) => norm(p) === norm(currentPath);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: 520 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 style={{ fontWeight: 'bold', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FolderOpen size={16} style={{ color: 'var(--accent-color)' }} />
            选择小说项目目录
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '1.2rem', cursor: 'pointer' }}
          >
            &times;
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>
            浏览器模式无法打开系统文件夹对话框，请从下方列表选择，或粘贴本机绝对路径。
          </p>

          {novelsRoot && (
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0 }}>
              扫描目录：<code style={{ color: 'var(--accent-light)' }}>{novelsRoot}</code>
            </p>
          )}

          {loading ? (
            <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
              正在加载项目列表…
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: 220, overflowY: 'auto' }}>
              {projects.length === 0 ? (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>novels/ 下暂无子项目，请用手动路径。</p>
              ) : (
                projects.map(proj => (
                  <button
                    key={proj.path}
                    type="button"
                    className="btn-secondary"
                    onClick={() => handlePick(proj.path)}
                    style={{
                      textAlign: 'left',
                      padding: '0.65rem 0.85rem',
                      borderColor: isCurrent(proj.path) ? 'var(--accent-color)' : undefined,
                      backgroundColor: isCurrent(proj.path) ? 'rgba(224,108,83,0.08)' : undefined,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 'bold', color: '#fff', fontSize: '0.85rem' }}>{proj.name}</span>
                      {isCurrent(proj.path) && <Check size={14} style={{ color: 'var(--accent-color)' }} />}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 2, wordBreak: 'break-all' }}>
                      {proj.path}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">手动输入绝对路径</label>
            <input
              type="text"
              className="text-input"
              value={manualPath}
              onChange={e => setManualPath(e.target.value)}
              placeholder="例如 E:\project\ai-novel\novels\道诡异仙"
              style={{ fontSize: '0.8rem' }}
            />
            {error && <span style={{ fontSize: '0.7rem', color: 'var(--color-error)' }}>{error}</span>}
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            取消
          </button>
          <button type="button" className="btn-primary" onClick={handleManualConfirm}>
            使用此路径
          </button>
        </div>
      </div>
    </div>
  );
}
