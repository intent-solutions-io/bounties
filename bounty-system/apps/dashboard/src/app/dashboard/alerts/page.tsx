'use client';

import { useState, useEffect } from 'react';
import { Bell, AlertTriangle, CheckCircle, MessageSquare, GitPullRequest, DollarSign } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { formatDistanceToNow } from 'date-fns';

interface Alert {
  id: string;
  type: 'new_bounty' | 'competition' | 'pr_merged' | 'comment' | 'payment';
  title: string;
  message: string;
  bountyId?: string;
  timestamp: Date;
  read: boolean;
}

// Mock data - will be replaced with real API calls
const mockAlerts: Alert[] = [
  {
    id: '1',
    type: 'new_bounty',
    title: 'New bounty matches your skills',
    message: '"Add TypeScript types" - $300 at screenpipe/screenpipe',
    bountyId: 'sp-123',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    read: false,
  },
  {
    id: '2',
    type: 'competition',
    title: 'Competing PR opened',
    message: 'PR #4521 by @otherdev on "Fix OAuth refresh"',
    bountyId: 'ph-456',
    timestamp: new Date(Date.now() - 45 * 60 * 1000),
    read: false,
  },
  {
    id: '3',
    type: 'pr_merged',
    title: 'PR merged & payment confirmed',
    message: '"Fix date picker" - $100 at calcom/cal.com',
    bountyId: 'cc-789',
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000),
    read: true,
  },
  {
    id: '4',
    type: 'comment',
    title: 'Maintainer commented on your PR',
    message: '"Looks good, minor change needed" - posthog/posthog #1234',
    bountyId: 'ph-101',
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
    read: true,
  },
];

function getAlertIcon(type: Alert['type']) {
  switch (type) {
    case 'new_bounty':
      return <Bell className="h-5 w-5 text-blue-500" />;
    case 'competition':
      return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    case 'pr_merged':
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case 'comment':
      return <MessageSquare className="h-5 w-5 text-purple-500" />;
    case 'payment':
      return <DollarSign className="h-5 w-5 text-green-500" />;
    default:
      return <Bell className="h-5 w-5 text-gray-500" />;
  }
}

function groupAlertsByDate(alerts: Alert[]): { today: Alert[]; yesterday: Alert[]; older: Alert[] } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

  return {
    today: alerts.filter(a => a.timestamp >= today),
    yesterday: alerts.filter(a => a.timestamp >= yesterday && a.timestamp < today),
    older: alerts.filter(a => a.timestamp < yesterday),
  };
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>(mockAlerts);
  const grouped = groupAlertsByDate(alerts);

  const markAsRead = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, read: true } : a));
  };

  const unreadCount = alerts.filter(a => !a.read).length;

  return (
    <>
      {/* Mobile header */}
      <div className="md:hidden">
        <div className="flex items-center justify-between bg-white px-4 py-4 dark:bg-gray-800">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Alerts</h1>
          {unreadCount > 0 && (
            <span className="rounded-full bg-primary-500 px-2.5 py-0.5 text-xs font-medium text-white">
              {unreadCount} new
            </span>
          )}
        </div>
      </div>

      {/* Desktop header */}
      <div className="hidden md:block">
        <Header title="Alerts" />
      </div>

      <div className="p-4 md:p-6">
        {/* Today */}
        {grouped.today.length > 0 && (
          <div className="mb-6">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Today
            </h2>
            <div className="space-y-2">
              {grouped.today.map((alert) => (
                <button
                  key={alert.id}
                  onClick={() => markAsRead(alert.id)}
                  className={`w-full rounded-xl p-4 text-left transition-colors ${
                    alert.read
                      ? 'bg-white dark:bg-gray-800'
                      : 'bg-primary-50 dark:bg-primary-900/20'
                  }`}
                >
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 pt-0.5">
                      {getAlertIcon(alert.type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium ${
                        alert.read
                          ? 'text-gray-900 dark:text-white'
                          : 'text-primary-900 dark:text-primary-100'
                      }`}>
                        {alert.title}
                      </p>
                      <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                        {alert.message}
                      </p>
                      <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                        {formatDistanceToNow(alert.timestamp, { addSuffix: true })}
                      </p>
                    </div>
                    {!alert.read && (
                      <div className="flex-shrink-0">
                        <div className="h-2 w-2 rounded-full bg-primary-500" />
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Yesterday */}
        {grouped.yesterday.length > 0 && (
          <div className="mb-6">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Yesterday
            </h2>
            <div className="space-y-2">
              {grouped.yesterday.map((alert) => (
                <button
                  key={alert.id}
                  onClick={() => markAsRead(alert.id)}
                  className={`w-full rounded-xl p-4 text-left transition-colors ${
                    alert.read
                      ? 'bg-white dark:bg-gray-800'
                      : 'bg-primary-50 dark:bg-primary-900/20'
                  }`}
                >
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 pt-0.5">
                      {getAlertIcon(alert.type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium ${
                        alert.read
                          ? 'text-gray-900 dark:text-white'
                          : 'text-primary-900 dark:text-primary-100'
                      }`}>
                        {alert.title}
                      </p>
                      <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                        {alert.message}
                      </p>
                      <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                        {formatDistanceToNow(alert.timestamp, { addSuffix: true })}
                      </p>
                    </div>
                    {!alert.read && (
                      <div className="flex-shrink-0">
                        <div className="h-2 w-2 rounded-full bg-primary-500" />
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Older */}
        {grouped.older.length > 0 && (
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Earlier
            </h2>
            <div className="space-y-2">
              {grouped.older.map((alert) => (
                <button
                  key={alert.id}
                  onClick={() => markAsRead(alert.id)}
                  className="w-full rounded-xl bg-white p-4 text-left transition-colors dark:bg-gray-800"
                >
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 pt-0.5">
                      {getAlertIcon(alert.type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {alert.title}
                      </p>
                      <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                        {alert.message}
                      </p>
                      <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                        {formatDistanceToNow(alert.timestamp, { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {alerts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Bell className="h-12 w-12 text-gray-300 dark:text-gray-600" />
            <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
              No alerts yet
            </h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              You&apos;ll be notified when something important happens
            </p>
          </div>
        )}
      </div>
    </>
  );
}
