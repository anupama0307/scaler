import { NextResponse } from 'next/server';

// ─── Types ────────────────────────────────────────────────────────
interface RepoSummary {
  name: string;
  description: string;
  language: string | null;
  stars: number;
  forks: number;
  url: string;
  pushedAt: string;
}

interface GitHubRepo {
  name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  html_url: string;
  pushed_at: string;
  fork: boolean;
  archived: boolean;
}

const GITHUB_USERNAME = process.env.GITHUB_USERNAME ?? 'anupama0307';

function headers(): HeadersInit {
  const h: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'anupama-ai-chat',
  };
  const token = process.env.GITHUB_TOKEN ?? '';
  if (token && !token.startsWith('ghp_...')) {
    h.Authorization = `Bearer ${token}`;
  }
  return h;
}

// ─── GET: most recently active public repos ───────────────────────
export async function GET() {
  try {
    const url = `https://api.github.com/users/${GITHUB_USERNAME}/repos?per_page=100&sort=pushed&type=owner`;
    const res = await fetch(url, {
      headers: headers(),
      // Cache for an hour so we don't hammer the GitHub API
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `GitHub API error: ${res.status}`, repos: [] },
        { status: res.status === 403 ? 429 : res.status }
      );
    }

    const data = (await res.json()) as GitHubRepo[];

    const repos: RepoSummary[] = (Array.isArray(data) ? data : [])
      .filter((r) => !r.fork && !r.archived)
      .sort((a, b) => new Date(b.pushed_at).getTime() - new Date(a.pushed_at).getTime())
      .slice(0, 6)
      .map((r) => ({
        name: r.name,
        description: r.description ?? '',
        language: r.language,
        stars: r.stargazers_count,
        forks: r.forks_count,
        url: r.html_url,
        pushedAt: r.pushed_at,
      }));

    return NextResponse.json({ username: GITHUB_USERNAME, repos });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch GitHub activity';
    return NextResponse.json({ error: message, repos: [] }, { status: 500 });
  }
}
