import { useState } from 'react';
import { api } from '../api/client';

const PROVIDERS = [
  { id: 'openrouter', name: 'OpenRouter', description: 'Universal AI gateway' },
  { id: 'ollama', name: 'Ollama', description: 'Local models' },
  { id: 'groq', name: 'Groq', description: 'Fast cloud inference' },
  { id: 'openai-compatible', name: 'OpenAI Compatible', description: 'Any OpenAI-compatible API' },
];

interface ProviderConfigProps {
  currentProvider: string;
  onSwitch?: () => void;
}

export function ProviderConfig({ currentProvider, onSwitch }: ProviderConfigProps) {
  const [provider, setProvider] = useState(currentProvider);
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [testing, setTesting] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTest = async () => {
    setTesting(true);
    setResult(null);

    try {
      const response = await api.get<Array<{ name: string; isActive: boolean; isAvailable?: boolean }>>('/api/providers');
      if (response.success && response.data) {
        const active = response.data.find((p) => p.name === provider);
        setResult({
          success: active?.isAvailable ?? false,
          message: active?.isAvailable
            ? `${provider} is available!`
            : `${provider} is not responding. Check your config.`,
        });
      }
    } catch {
      setResult({ success: false, message: 'Connection test failed. Is the server running?' });
    } finally {
      setTesting(false);
    }
  };

  const handleSwitch = async () => {
    setSwitching(true);
    setResult(null);

    try {
      const response = await api.post<{ provider: string }>('/api/providers/switch', {
        provider,
        apiKey: apiKey || undefined,
        baseUrl: baseUrl || undefined,
        model: model || undefined,
      });

      if (response.success) {
        setResult({ success: true, message: `Switched to ${provider}!` });
        onSwitch?.();
        setApiKey('');
        setBaseUrl('');
        setModel('');
      } else {
        setResult({ success: false, message: response.error || 'Switch failed' });
      }
    } catch {
      setResult({ success: false, message: 'Network error' });
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-color)',
      borderRadius: 4,
      padding: 24,
    }}>
      <h2 style={{ marginBottom: 24, color: 'var(--green)' }}>Provider Configuration</h2>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
          Provider
        </label>
        <select value={provider} onChange={(e) => setProvider(e.target.value)}>
          {PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} - {p.description}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
          API Key (optional for Ollama)
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-..."
        />
      </div>

      {(provider === 'ollama' || provider === 'openai-compatible') && (
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
            Base URL
          </label>
          <input
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={provider === 'ollama' ? 'http://localhost:11434' : 'http://localhost:8080/v1'}
          />
        </div>
      )}

      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
          Default Model
        </label>
        <input
          type="text"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="e.g., gpt-3.5-turbo, llama2"
        />
      </div>

      {result && (
        <div style={{
          padding: 12,
          background: result.success ? 'rgba(0,255,136,0.1)' : 'rgba(255,68,68,0.1)',
          border: `1px solid ${result.success ? 'var(--green)' : 'var(--red)'}`,
          borderRadius: 4,
          marginBottom: 16,
          color: result.success ? 'var(--green)' : 'var(--red)',
        }}>
          {result.message}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={handleTest} disabled={testing}>
          {testing ? 'Testing...' : 'Test Connection'}
        </button>
        <button onClick={handleSwitch} disabled={switching}>
          {switching ? 'Switching...' : 'Switch Provider'}
        </button>
      </div>
    </div>
  );
}
