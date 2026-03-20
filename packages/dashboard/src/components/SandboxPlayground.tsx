import { useState } from 'react';
import { api } from '../api/client';

interface SandboxResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  success: boolean;
  durationMs: number;
  timedOut: boolean;
  error?: string;
}

type Language = 'javascript' | 'python' | 'typescript' | 'bash';

const EXAMPLES: Record<Language, string> = {
  javascript: `// Hello World in JavaScript
console.log('Hello from sandbox!');

const numbers = [1, 2, 3, 4, 5];
const sum = numbers.reduce((a, b) => a + b, 0);
console.log('Sum of', numbers, '=', sum);`,
  python: `# Hello World in Python
print('Hello from sandbox!')

numbers = [1, 2, 3, 4, 5]
total = sum(numbers)
print(f'Sum of {numbers} = {total}')`,
  typescript: `// Hello World in TypeScript
interface NumberArray {
  numbers: number[];
}

const data: NumberArray = { numbers: [1, 2, 3, 4, 5] };
const sum = data.numbers.reduce((a, b) => a + b, 0);
console.log('Sum:', sum);`,
  bash: `#!/bin/bash
echo "Hello from sandbox!"

echo "Current directory:"
pwd

echo "Files in current directory:"
ls -la`,
};

export function SandboxPlayground() {
  const [language, setLanguage] = useState<Language>('javascript');
  const [code, setCode] = useState(EXAMPLES.javascript);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SandboxResult | null>(null);
  const [activeTab, setActiveTab] = useState<'stdout' | 'stderr'>('stdout');

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    setCode(EXAMPLES[lang]);
    setResult(null);
  };

  const handleRun = async () => {
    setRunning(true);
    setResult(null);
    setActiveTab('stdout');

    const res = await api.post<SandboxResult>('/api/sandbox/execute', {
      language,
      code,
    });

    setRunning(false);

    if (res.success && res.data) {
      setResult(res.data);
      if (res.data.stderr && !res.data.stdout) {
        setActiveTab('stderr');
      }
    } else {
      setResult({
        stdout: '',
        stderr: res.error || 'Execution failed',
        exitCode: 1,
        success: false,
        durationMs: 0,
        timedOut: false,
        error: res.error,
      });
    }
  };

  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-color)',
      borderRadius: 4,
      padding: 20,
      marginTop: 24,
    }}>
      <h2 style={{ marginBottom: 16, fontSize: 14 }}>Sandbox Playground</h2>
      <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
        Test code execution in an isolated Docker sandbox. Each run is isolated and has no access to the host system.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['javascript', 'python', 'typescript', 'bash'] as Language[]).map((lang) => (
          <button
            key={lang}
            onClick={() => handleLanguageChange(lang)}
            style={{
              padding: '6px 12px',
              background: language === lang ? 'var(--green)' : 'transparent',
              color: language === lang ? 'var(--bg-primary)' : 'var(--text-secondary)',
              border: `1px solid ${language === lang ? 'var(--green)' : 'var(--border-color)'}`,
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 12,
              textTransform: 'capitalize',
            }}
          >
            {lang}
          </button>
        ))}
        <button
          onClick={handleRun}
          disabled={running}
          style={{
            marginLeft: 'auto',
            padding: '6px 16px',
            background: running ? 'var(--bg-primary)' : 'var(--green)',
            color: running ? 'var(--text-secondary)' : 'var(--bg-primary)',
            border: 'none',
            borderRadius: 4,
            cursor: running ? 'not-allowed' : 'pointer',
            fontSize: 12,
            fontWeight: 'bold',
          }}
        >
          {running ? 'Running...' : '▶ Run'}
        </button>
      </div>

      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        style={{
          width: '100%',
          minHeight: 150,
          fontFamily: 'monospace',
          fontSize: 13,
          padding: 12,
          background: 'var(--bg-primary)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-color)',
          borderRadius: 4,
          resize: 'vertical',
        }}
        spellCheck={false}
      />

      {result && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <button
              onClick={() => setActiveTab('stdout')}
              style={{
                padding: '4px 12px',
                background: activeTab === 'stdout' ? 'var(--green)' : 'transparent',
                color: activeTab === 'stdout' ? 'var(--bg-primary)' : 'var(--text-secondary)',
                border: `1px solid ${activeTab === 'stdout' ? 'var(--green)' : 'var(--border-color)'}`,
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 11,
              }}
            >
              stdout
            </button>
            <button
              onClick={() => setActiveTab('stderr')}
              style={{
                padding: '4px 12px',
                background: activeTab === 'stderr' ? 'var(--red)' : 'transparent',
                color: activeTab === 'stderr' ? 'white' : 'var(--text-secondary)',
                border: `1px solid ${activeTab === 'stderr' ? 'var(--red)' : 'var(--border-color)'}`,
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 11,
              }}
            >
              stderr
            </button>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-secondary)' }}>
              <span>Exit: <span style={{ color: result.exitCode === 0 ? 'var(--green)' : 'var(--red)' }}>{result.exitCode}</span></span>
              <span>Time: <span style={{ color: 'var(--cyan)' }}>{result.durationMs}ms</span></span>
              {result.timedOut && <span style={{ color: 'var(--yellow)' }}>TIMEOUT</span>}
            </div>
          </div>
          <pre style={{
            margin: 0,
            padding: 12,
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: 4,
            maxHeight: 150,
            overflow: 'auto',
            fontFamily: 'monospace',
            fontSize: 12,
            color: activeTab === 'stderr' ? 'var(--red)' : 'var(--green)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}>
            {activeTab === 'stdout' ? (result.stdout || '(empty)') : (result.stderr || '(empty)')}
          </pre>
        </div>
      )}
    </div>
  );
}
