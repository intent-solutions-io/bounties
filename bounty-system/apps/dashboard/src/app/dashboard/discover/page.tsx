'use client';

/**
 * Bounty Discovery Page
 *
 * Search and score bounties from GitHub and Algora.
 * Uses the scoring algorithm to recommend best opportunities.
 */

import { useState } from 'react';
import { Search, Github, ExternalLink, AlertCircle, CheckCircle, HelpCircle, XCircle, RefreshCw } from 'lucide-react';
import { Header } from '@/components/layout/header';

interface BountyScore {
  total: number;
  grade: string;
  recommendation: 'claim' | 'consider' | 'skip';
  value: { normalized: number; raw: number | null; hourlyRate: number };
  complexity: { estimated: number; linesEstimate: number };
  competition: { score: number; claimants: number; openPRs?: number; submissions?: number };
  fit: { score: number; matchedTech: string[]; unknownTech: string[] };
  warnings: string[];
  notes: string[];
}

interface DiscoveredBounty {
  id: string;
  title: string;
  description?: string;
  value: number | null;
  labels?: string[];
  technologies: string[];
  repo: string;
  org: string;
  sourceUrl: string;
  claimants: number;
  openPRs?: number;
  submissions?: number;
  score: BountyScore;
}

type Source = 'github' | 'algora' | 'all';
type Filter = 'all' | 'claim' | 'consider' | 'skip';

export default function DiscoverPage() {
  const [source, setSource] = useState<Source>('github');
  const [filter, setFilter] = useState<Filter>('all');
  const [searchOrg, setSearchOrg] = useState('');
  const [searchRepo, setSearchRepo] = useState('');
  const [searchLabel, setSearchLabel] = useState('bounty');
  const [bounties, setBounties] = useState<DiscoveredBounty[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSearch, setLastSearch] = useState<string>('');

  const discover = async () => {
    setLoading(true);
    setError(null);

    try {
      const results: DiscoveredBounty[] = [];

      // Fetch from GitHub
      if (source === 'github' || source === 'all') {
        const params = new URLSearchParams();
        if (searchOrg) params.set('org', searchOrg);
        if (searchRepo) params.set('repo', searchRepo);
        if (searchLabel) params.set('label', searchLabel);
        params.set('limit', '30');

        const res = await fetch(`/api/discover?${params}`);
        const data = await res.json();

        if (data.error) {
          throw new Error(data.error);
        }

        results.push(...(data.bounties || []).map((b: DiscoveredBounty) => ({
          ...b,
          source: 'github'
        })));
        setLastSearch(data.query || '');
      }

      // Fetch from Algora
      if (source === 'algora' || source === 'all') {
        const params = new URLSearchParams();
        params.set('limit', '30');
        params.set('status', 'OPEN');

        const res = await fetch(`/api/discover/algora?${params}`);
        const data = await res.json();

        if (!data.error) {
          results.push(...(data.bounties || []).map((b: DiscoveredBounty) => ({
            ...b,
            source: 'algora'
          })));
        }
      }

      // Sort by score
      results.sort((a, b) => b.score.total - a.score.total);
      setBounties(results);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Discovery failed');
    } finally {
      setLoading(false);
    }
  };

  const filteredBounties = bounties.filter(b => {
    if (filter === 'all') return true;
    return b.score.recommendation === filter;
  });

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'text-green-500 bg-green-50 dark:bg-green-900/20';
      case 'B': return 'text-lime-500 bg-lime-50 dark:bg-lime-900/20';
      case 'C': return 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20';
      case 'D': return 'text-orange-500 bg-orange-50 dark:bg-orange-900/20';
      default: return 'text-red-500 bg-red-50 dark:bg-red-900/20';
    }
  };

  const getRecommendationIcon = (rec: string) => {
    switch (rec) {
      case 'claim': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'consider': return <HelpCircle className="h-5 w-5 text-yellow-500" />;
      default: return <XCircle className="h-5 w-5 text-red-500" />;
    }
  };

  return (
    <>
      <Header title="Discover Bounties" />

      <div className="p-6">
        {/* Search Controls */}
        <div className="mb-6 rounded-xl bg-white p-6 shadow-sm dark:bg-gray-800">
          <div className="grid gap-4 md:grid-cols-4">
            {/* Source Selector */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Source
              </label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value as Source)}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                <option value="github">GitHub</option>
                <option value="algora">Algora</option>
                <option value="all">All Sources</option>
              </select>
            </div>

            {/* Org Filter */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Organization
              </label>
              <input
                type="text"
                value={searchOrg}
                onChange={(e) => setSearchOrg(e.target.value)}
                placeholder="e.g., screenpipe"
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-500"
              />
            </div>

            {/* Repo Filter */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Repository
              </label>
              <input
                type="text"
                value={searchRepo}
                onChange={(e) => setSearchRepo(e.target.value)}
                placeholder="e.g., owner/repo"
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-500"
              />
            </div>

            {/* Label Filter */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Bounty Label
              </label>
              <input
                type="text"
                value={searchLabel}
                onChange={(e) => setSearchLabel(e.target.value)}
                placeholder="bounty"
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-500"
              />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <button
              onClick={discover}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-2 text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? (
                <RefreshCw className="h-5 w-5 animate-spin" />
              ) : (
                <Search className="h-5 w-5" />
              )}
              {loading ? 'Searching...' : 'Discover Bounties'}
            </button>

            {lastSearch && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Query: {lastSearch}
              </span>
            )}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-lg bg-red-50 p-4 text-red-700 dark:bg-red-900/20 dark:text-red-400">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Results */}
        {bounties.length > 0 && (
          <>
            {/* Filter Tabs */}
            <div className="mb-4 flex items-center justify-between">
              <div className="flex gap-2">
                {(['all', 'claim', 'consider', 'skip'] as Filter[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                      filter === f
                        ? 'bg-primary-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                    }`}
                  >
                    {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                    {f !== 'all' && (
                      <span className="ml-2 text-xs opacity-75">
                        ({bounties.filter(b => b.score.recommendation === f).length})
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {filteredBounties.length} bounties found
              </span>
            </div>

            {/* Bounty Cards */}
            <div className="space-y-4">
              {filteredBounties.map((bounty) => (
                <div
                  key={bounty.id}
                  className="rounded-xl bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:bg-gray-800"
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Main Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        {getRecommendationIcon(bounty.score.recommendation)}
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {bounty.title}
                        </h3>
                      </div>

                      <div className="mt-2 flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <Github className="h-4 w-4" />
                          {bounty.repo}
                        </span>
                        {bounty.value && (
                          <span className="font-medium text-green-600 dark:text-green-400">
                            ${bounty.value}
                          </span>
                        )}
                        <span>
                          {bounty.claimants} claimants
                        </span>
                        {bounty.openPRs !== undefined && bounty.openPRs > 0 && (
                          <span className="text-yellow-600 dark:text-yellow-400">
                            {bounty.openPRs} open PRs
                          </span>
                        )}
                      </div>

                      {/* Technologies */}
                      {bounty.technologies.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {bounty.technologies.slice(0, 5).map((tech) => (
                            <span
                              key={tech}
                              className={`rounded-full px-2 py-1 text-xs font-medium ${
                                bounty.score.fit.matchedTech.includes(tech)
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                              }`}
                            >
                              {tech}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Warnings */}
                      {bounty.score.warnings.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {bounty.score.warnings.map((warning, i) => (
                            <span
                              key={i}
                              className="flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400"
                            >
                              <AlertCircle className="h-3 w-3" />
                              {warning}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Score */}
                    <div className="flex flex-col items-end gap-2">
                      <div className={`rounded-lg px-3 py-2 text-center ${getGradeColor(bounty.score.grade)}`}>
                        <div className="text-2xl font-bold">{bounty.score.total}</div>
                        <div className="text-xs font-medium">Grade {bounty.score.grade}</div>
                      </div>

                      <a
                        href={bounty.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                      >
                        View Issue
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  </div>

                  {/* Score Breakdown */}
                  <div className="mt-4 grid grid-cols-4 gap-4 border-t border-gray-100 pt-4 dark:border-gray-700">
                    <div className="text-center">
                      <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Value</div>
                      <div className="text-lg font-semibold text-gray-900 dark:text-white">
                        {bounty.score.value.normalized}/100
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Complexity</div>
                      <div className="text-lg font-semibold text-gray-900 dark:text-white">
                        {bounty.score.complexity.estimated}/100
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Competition</div>
                      <div className="text-lg font-semibold text-gray-900 dark:text-white">
                        {bounty.score.competition.score}/100
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Tech Fit</div>
                      <div className="text-lg font-semibold text-gray-900 dark:text-white">
                        {bounty.score.fit.score}/100
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Empty State */}
        {!loading && bounties.length === 0 && !error && (
          <div className="rounded-xl bg-white p-12 text-center shadow-sm dark:bg-gray-800">
            <Search className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
              No bounties discovered yet
            </h3>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              Click &quot;Discover Bounties&quot; to search for opportunities
            </p>
          </div>
        )}
      </div>
    </>
  );
}
