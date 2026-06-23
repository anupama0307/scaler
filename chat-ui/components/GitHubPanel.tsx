'use client';

import React, { useEffect, useState, useCallback } from 'react';

interface Repo {
  name: string;
  description: string;
  language: string | null;
  stars: number;
  forks: number;
  url: string;
  pushedAt: string;
}

interface GitHubPanelProps {
  onClose: () => void;
}

const LANG_COLORS: Record<string, string> = {
  Python: '#3572A5',
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  'Jupyter Notebook': '#DA5B0B',
  Java: '#b07219',
  HTML: '#e34c26',
  CSS: '#563d7c',
  C: '#555555',
  'C++': '#f34b7d',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export default function GitHubPanel({ onClose }: GitHubPanelProps) {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [username, setUsername] = useState('anupama0307');

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const res = await fetch('/api/github', { cache: 'no-store' });
      const data = (await res.json()) as {
        repos?: Repo[];
        username?: string;
        error?: string;
      };
      if (!res.ok || data.error) {
        setErrorMsg(data.error ?? `Error ${res.status}`);
        setStatus('error');
        return;
      }
      setRepos(data.repos ?? []);
      if (data.username) setUsername(data.username);
      setStatus('ok');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="GitHub activity">
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <span className="modal-title-icon" aria-hidden="true">⌥</span>
            Recent GitHub Activity
          </div>
          <a
            className="modal-link"
            href={`https://github.com/${username}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            @{username} ↗
          </a>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="modal-body">
          {status === 'loading' && (
            <div className="repo-skeleton">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton-block" style={{ height: 64 }} />
              ))}
            </div>
          )}

          {status === 'error' && (
            <div className="modal-error">
              <p>Couldn&apos;t load GitHub activity.</p>
              <p className="modal-error-detail">{errorMsg}</p>
              <button className="btn-retry" onClick={load} type="button">↺ Try Again</button>
            </div>
          )}

          {status === 'ok' && repos.length === 0 && (
            <p className="modal-empty">No public repositories found.</p>
          )}

          {status === 'ok' &&
            repos.map((repo) => (
              <a
                key={repo.name}
                className="repo-card"
                href={repo.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <div className="repo-card-top">
                  <span className="repo-name">{repo.name}</span>
                  <span className="repo-updated">{timeAgo(repo.pushedAt)}</span>
                </div>
                {repo.description && <p className="repo-desc">{repo.description}</p>}
                <div className="repo-meta">
                  {repo.language && (
                    <span className="repo-lang">
                      <span
                        className="repo-lang-dot"
                        style={{ background: LANG_COLORS[repo.language] ?? '#8b95a8' }}
                      />
                      {repo.language}
                    </span>
                  )}
                  <span className="repo-stat">★ {repo.stars}</span>
                  <span className="repo-stat">⑂ {repo.forks}</span>
                </div>
              </a>
            ))}
        </div>
      </div>
    </div>
  );
}
