/**
 * Notifications API
 *
 * Manages bounty notifications - new matches, deadlines, PR status changes.
 * Supports Slack webhooks and email notifications.
 */

import { NextRequest, NextResponse } from 'next/server';

export interface NotificationPreferences {
  userId: string;
  enabled: boolean;
  channels: {
    slack?: {
      enabled: boolean;
      webhookUrl?: string;
      channel?: string;
    };
    email?: {
      enabled: boolean;
      address?: string;
    };
  };
  triggers: {
    newBountyMatch: boolean;
    deadlineReminder: boolean;
    prStatusChange: boolean;
    bountyCompleted: boolean;
    highValueAlert: boolean;
  };
  filters: {
    minValue?: number;
    technologies?: string[];
    minScore?: number;
  };
}

export interface Notification {
  id: string;
  type: 'new_bounty' | 'deadline' | 'pr_status' | 'completed' | 'high_value';
  title: string;
  message: string;
  bountyId?: string;
  bountyTitle?: string;
  bountyValue?: number;
  prUrl?: string;
  createdAt: string;
  read: boolean;
  channels: ('slack' | 'email' | 'in_app')[];
}

// In-memory store for demo (use Firestore in production)
const notifications: Map<string, Notification[]> = new Map();
const preferences: Map<string, NotificationPreferences> = new Map();

/**
 * GET /api/notifications - Get user notifications
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('userId') || 'default';
  const unreadOnly = searchParams.get('unreadOnly') === 'true';
  const limit = parseInt(searchParams.get('limit') || '50', 10);

  try {
    let userNotifications = notifications.get(userId) || [];

    if (unreadOnly) {
      userNotifications = userNotifications.filter(n => !n.read);
    }

    // Sort by date (newest first) and limit
    userNotifications = userNotifications
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);

    const unreadCount = (notifications.get(userId) || []).filter(n => !n.read).length;

    return NextResponse.json({
      notifications: userNotifications,
      unreadCount,
      total: (notifications.get(userId) || []).length,
    });
  } catch (error) {
    console.error('Notifications error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/notifications - Create a notification
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId = 'default',
      type,
      title,
      message,
      bountyId,
      bountyTitle,
      bountyValue,
      prUrl,
    } = body;

    if (!type || !title || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: type, title, message' },
        { status: 400 }
      );
    }

    const notification: Notification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      title,
      message,
      bountyId,
      bountyTitle,
      bountyValue,
      prUrl,
      createdAt: new Date().toISOString(),
      read: false,
      channels: ['in_app'],
    };

    // Get user preferences
    const userPrefs = preferences.get(userId);

    // Send to channels based on preferences
    if (userPrefs?.channels.slack?.enabled && userPrefs.channels.slack.webhookUrl) {
      try {
        await sendSlackNotification(userPrefs.channels.slack.webhookUrl, notification);
        notification.channels.push('slack');
      } catch (e) {
        console.error('Slack notification failed:', e);
      }
    }

    if (userPrefs?.channels.email?.enabled && userPrefs.channels.email.address) {
      try {
        await sendEmailNotification(userPrefs.channels.email.address, notification);
        notification.channels.push('email');
      } catch (e) {
        console.error('Email notification failed:', e);
      }
    }

    // Store notification
    const userNotifications = notifications.get(userId) || [];
    userNotifications.push(notification);
    notifications.set(userId, userNotifications);

    return NextResponse.json({
      success: true,
      notification,
    });
  } catch (error) {
    console.error('Create notification error:', error);
    return NextResponse.json(
      { error: 'Failed to create notification' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/notifications - Mark notifications as read
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId = 'default', notificationIds, markAllRead } = body;

    const userNotifications = notifications.get(userId) || [];

    if (markAllRead) {
      userNotifications.forEach(n => (n.read = true));
    } else if (notificationIds && Array.isArray(notificationIds)) {
      userNotifications.forEach(n => {
        if (notificationIds.includes(n.id)) {
          n.read = true;
        }
      });
    }

    notifications.set(userId, userNotifications);

    return NextResponse.json({
      success: true,
      updatedCount: markAllRead ? userNotifications.length : notificationIds?.length || 0,
    });
  } catch (error) {
    console.error('Mark read error:', error);
    return NextResponse.json(
      { error: 'Failed to mark notifications as read' },
      { status: 500 }
    );
  }
}

// Helper: Send Slack notification
async function sendSlackNotification(webhookUrl: string, notification: Notification) {
  const emoji = {
    new_bounty: ':moneybag:',
    deadline: ':alarm_clock:',
    pr_status: ':git:',
    completed: ':white_check_mark:',
    high_value: ':gem:',
  }[notification.type] || ':bell:';

  const payload = {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${emoji} ${notification.title}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: notification.message,
        },
      },
    ],
  };

  if (notification.bountyValue) {
    payload.blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `*Value:* $${notification.bountyValue}`,
        },
      ],
    } as any);
  }

  if (notification.prUrl) {
    payload.blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'View PR',
            emoji: true,
          },
          url: notification.prUrl,
        },
      ],
    } as any);
  }

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

// Helper: Send email notification (placeholder - integrate with email service)
async function sendEmailNotification(email: string, notification: Notification) {
  // In production, integrate with SendGrid, Resend, or similar
  console.log(`[Email] Would send to ${email}:`, notification.title);
  // For now, just log - implement actual email sending in production
}
