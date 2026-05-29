// frontend/src/components/SettingsTab.tsx
import React, { useState } from 'react';
import { AppConfig, LLMConfig, EmbeddingConfig } from '../types/novel';
import { testLLM, testEmbedding } from '../api';
import { Shield, Sparkles, RefreshCw, Radio, HardDrive } from 'lucide-react';

interface SettingsTabProps {
  config: AppConfig;
  onUpdateConfig: (newConfig: AppConfig) => void;
  onSave: () => void;
}

export default function SettingsTab({ config, onUpdateConfig, onSave }: SettingsTabProps) {
  const [selectedLLMKey, setSelectedLLMKey] = useState<string>(Object.keys(config.llm_configs)[0] || '');
  const [selectedEmbKey, setSelectedEmbKey] = useState<string>(Object.keys(config.embedding_configs)[0] || '');
  const [testingLLM, setTestingLLM] = useState(false);
  const [testingEmb, setTestingEmb] = useState(false);

  const activeLLM = config.llm_configs[selectedLLMKey];
  const activeEmb = config.embedding_configs[selectedEmbKey];

  const updateLLMField = (field: keyof LLMConfig, value: any) => {
    onUpdateConfig({
      ...config,
      llm_configs: {
        ...config.llm_configs,
        [selectedLLMKey]: {
          ...config.llm_configs[selectedLLMKey],
          [field]: value,
        },
      },
    });
  };

  const updateEmbField = (field: keyof EmbeddingConfig, value: any) => {
    onUpdateConfig({
      ...config,
      embedding_configs: {
        ...config.embedding_configs,
        [selectedEmbKey]: {
          ...config.embedding_configs[selectedEmbKey],
          [field]: value,
        },
      },
    });
  };

  const handleTestLLM = async () => {
    if (!activeLLM) return;
    setTestingLLM(true);
    try {
      await testLLM({
        interface_format: activeLLM.interface_format,
        api_key: activeLLM.api_key,
        base_url: activeLLM.base_url,
        model_name: activeLLM.model_name,
        temperature: activeLLM.temperature,
        max_tokens: activeLLM.max_tokens,
        timeout: activeLLM.timeout,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setTestingLLM(false);
    }
  };

  const handleTestEmb = async () => {
    if (!activeEmb) return;
    setTestingEmb(true);
    try {
      await testEmbedding({
        interface_format: activeEmb.interface_format,
        api_key: activeEmb.api_key,
        base_url: activeEmb.base_url,
        model_name: activeEmb.model_name,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setTestingEmb(false);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
      {/* Left: LLM settings */}
      <div className="glass-panel" style={{ height: 'fit-content' }}>
        <h3 className="panel-title">
          <Sparkles size={16} style={{ color: 'var(--accent-color)' }} /> 大语言模型 (LLM) 参数配置
        </h3>

        <div className="form-group">
          <label className="form-label">选择 LLM 服务配置</label>
          <select 
            className="select-input" 
            value={selectedLLMKey}
            onChange={(e) => setSelectedLLMKey(e.target.value)}
          >
            {Object.keys(config.llm_configs).map(k => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </div>

        {activeLLM && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
            <div className="form-group">
              <label className="form-label">接口格式 (Interface Format)</label>
              <select
                className="select-input"
                value={activeLLM.interface_format}
                onChange={(e) => updateLLMField('interface_format', e.target.value)}
              >
                <option value="OpenAI">OpenAI</option>
                <option value="Gemini">Gemini</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">API Key</label>
              <input
                type="password"
                className="text-input"
                value={activeLLM.api_key}
                onChange={(e) => updateLLMField('api_key', e.target.value)}
                placeholder="请输入您的 API Key"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Base URL (API 终结点)</label>
              <input
                type="text"
                className="text-input"
                value={activeLLM.base_url}
                onChange={(e) => updateLLMField('base_url', e.target.value)}
                placeholder="例如 https://api.openai.com/v1"
              />
            </div>

            <div className="form-group">
              <label className="form-label">模型名称 (Model Name)</label>
              <input
                type="text"
                className="text-input"
                value={activeLLM.model_name}
                onChange={(e) => updateLLMField('model_name', e.target.value)}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Temperature</label>
                <input
                  type="number"
                  step="0.1"
                  className="text-input"
                  value={activeLLM.temperature}
                  onChange={(e) => updateLLMField('temperature', parseFloat(e.target.value) || 0.7)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Max Tokens</label>
                <input
                  type="number"
                  className="text-input"
                  value={activeLLM.max_tokens}
                  onChange={(e) => updateLLMField('max_tokens', parseInt(e.target.value) || 8192)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Timeout (秒)</label>
                <input
                  type="number"
                  className="text-input"
                  value={activeLLM.timeout}
                  onChange={(e) => updateLLMField('timeout', parseInt(e.target.value) || 600)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button 
                className="btn-secondary" 
                onClick={handleTestLLM}
                disabled={testingLLM}
                style={{ flex: 1 }}
              >
                <RefreshCw size={14} className={testingLLM ? 'animate-spin' : ''} /> {testingLLM ? '测试中...' : '测试 LLM 连通性'}
              </button>
              <button className="btn-primary" onClick={onSave} style={{ flex: 1 }}>
                保存当前修改
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right: Embedding, Proxy and WebDAV settings */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div className="glass-panel">
          <h3 className="panel-title">
            <Shield size={16} style={{ color: 'var(--color-success)' }} /> 向量嵌入模型 (Embedding) 配置
          </h3>

          <div className="form-group">
            <label className="form-label">选择 Embedding 配置</label>
            <select 
              className="select-input" 
              value={selectedEmbKey}
              onChange={(e) => setSelectedEmbKey(e.target.value)}
            >
              {Object.keys(config.embedding_configs).map(k => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>

          {activeEmb && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              <div className="form-group">
                <label className="form-label">接口格式</label>
                <select
                  className="select-input"
                  value={activeEmb.interface_format}
                  onChange={(e) => updateEmbField('interface_format', e.target.value)}
                >
                  <option value="OpenAI">OpenAI</option>
                  <option value="Gemini">Gemini</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">API Key</label>
                <input
                  type="password"
                  className="text-input"
                  value={activeEmb.api_key}
                  onChange={(e) => updateEmbField('api_key', e.target.value)}
                  placeholder="请输入您的 Embedding API Key"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Base URL</label>
                <input
                  type="text"
                  className="text-input"
                  value={activeEmb.base_url}
                  onChange={(e) => updateEmbField('base_url', e.target.value)}
                  placeholder="例如 https://api.openai.com/v1"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">模型名称</label>
                  <input
                    type="text"
                    className="text-input"
                    value={activeEmb.model_name}
                    onChange={(e) => updateEmbField('model_name', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">检索 K 值</label>
                  <input
                    type="number"
                    className="text-input"
                    value={activeEmb.retrieval_k}
                    onChange={(e) => updateEmbField('retrieval_k', parseInt(e.target.value) || 4)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button 
                  className="btn-secondary" 
                  onClick={handleTestEmb}
                  disabled={testingEmb}
                  style={{ width: '100%' }}
                >
                  <RefreshCw size={14} className={testingEmb ? 'animate-spin' : ''} /> {testingEmb ? '测试中...' : '测试 Embedding'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Proxy setting */}
        <div className="glass-panel">
          <h3 className="panel-title">
            <Radio size={16} style={{ color: 'var(--color-warning)' }} /> 网络代理 (Proxy) 与同步配置
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 1fr', gap: '1rem', alignItems: 'end', marginBottom: '1.5rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">代理 URL</label>
              <input
                type="text"
                className="text-input"
                value={config.proxy_setting.proxy_url}
                onChange={(e) => {
                    onUpdateConfig({
                      ...config,
                      proxy_setting: { ...config.proxy_setting, proxy_url: e.target.value },
                    });
                  }}
                placeholder="127.0.0.1"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">端口</label>
              <input
                type="text"
                className="text-input"
                value={config.proxy_setting.proxy_port}
                onChange={(e) => {
                    onUpdateConfig({
                      ...config,
                      proxy_setting: { ...config.proxy_setting, proxy_port: e.target.value },
                    });
                  }}
                placeholder="7890"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0, paddingBottom: '0.5rem' }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={config.proxy_setting.enabled}
                  onChange={(e) => {
                      onUpdateConfig({
                        ...config,
                        proxy_setting: { ...config.proxy_setting, enabled: e.target.checked },
                      });
                    }}
                  style={{ width: '15px', height: '15px' }}
                /> 开启网络代理
              </label>
            </div>
          </div>

          {/* WebDAV Cloud Sync */}
          {config.webdav_config && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              <h4 style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <HardDrive size={14} /> WebDAV 云同步配置
              </h4>
              <div className="form-group">
                <label className="form-label">WebDAV 服务器 URL</label>
                <input
                  type="text"
                  className="text-input"
                  value={config.webdav_config.webdav_url}
                  onChange={(e) => {
                    const updated = { ...config };
                    if (updated.webdav_config) updated.webdav_config.webdav_url = e.target.value;
                    onUpdateConfig(updated);
                  }}
                  placeholder="https://dav.jianguoyun.com/dav/"
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">账号 (Username)</label>
                  <input
                    type="text"
                    className="text-input"
                    value={config.webdav_config.webdav_username}
                    onChange={(e) => {
                      const updated = { ...config };
                      if (updated.webdav_config) updated.webdav_config.webdav_username = e.target.value;
                      onUpdateConfig(updated);
                    }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">应用密码 (Password)</label>
                  <input
                    type="password"
                    className="text-input"
                    value={config.webdav_config.webdav_password}
                    onChange={(e) => {
                      const updated = { ...config };
                      if (updated.webdav_config) updated.webdav_config.webdav_password = e.target.value;
                      onUpdateConfig(updated);
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
