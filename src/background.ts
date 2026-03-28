import { storage } from './lib/storage'
import { fetchGlobalIssues, formatStatus } from './lib/drupal-api'
import type { DrupalIssue } from './lib/drupal-api'

chrome.alarms.create('poll-drupal', { periodInMinutes: 5 })

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'poll-drupal') {
    await pollGlobalIssues()
  }
})

chrome.runtime.onInstalled.addListener(async () => {
  console.log('IssueSniper installed. Starting initial global poll...')
  await pollGlobalIssues()
})

// Listen for notification clicks to open the issue page
chrome.notifications.onClicked.addListener((notificationId) => {
  if (notificationId.startsWith('drupal-issue-')) {
    const nid = notificationId.replace('drupal-issue-', '');
    chrome.tabs.create({ url: `https://www.drupal.org/node/${nid}` });
  }
});

async function pollGlobalIssues() {
  try {
    // Fetch latest overall
    const issues = await fetchGlobalIssues(0);
    
    if (issues.length > 0) {
      const lastChangedResult = await chrome.storage.local.get(['last_changed_global'])
      const lastChanged = (lastChangedResult['last_changed_global'] as number) || 0;

      // Only notify about issues that have been changed since the last poll
      const newIssues = lastChanged 
        ? issues.filter(i => i.changed > lastChanged)
        : []; // Don't spam on the very first load

      for (const issue of newIssues) {
        notifyUser(issue.project, issue)
      }

      // Update baseline for next poll
      await chrome.storage.local.set({ 
        'last_seen_global': issues[0].nid,
        'last_changed_global': issues[0].changed
      })
      
      // Save for popup UI, converting timestamps as necessary
      await storage.saveIssues(issues.map(i => ({
          ...i,
          project_name: i.project,
          status: formatStatus(i.status),
          last_changed: i.changed * 1000 
      })))
    }
  } catch (err) {
    console.error(`Failed to poll global issues:`, err)
  }
}

let creatingOffscreen: Promise<void> | null = null;

async function setupOffscreenDocument() {
  if (!chrome.offscreen) {
    console.warn('Offscreen API not available.');
    return;
  }
  
  // Check if it already exists
  const existingContexts = await (chrome.runtime as any).getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  });

  if (existingContexts.length > 0) return;

  // Use a lock to prevent race conditions during rapid notifications
  if (creatingOffscreen) return creatingOffscreen;

  creatingOffscreen = chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
    justification: 'Play notification sound when a new Drupal issue is found'
  }).catch((err) => {
    // Ignore the error if the document was created by a parallel call
    if (!err.message.includes('Only a single offscreen document')) {
      console.error('Failed to create offscreen document:', err);
    }
  }).finally(() => {
    creatingOffscreen = null;
  });

  return creatingOffscreen;
}

function notifyUser(projectName: string, issue: DrupalIssue) {
  const statusLabel = formatStatus(issue.status);
  
  chrome.notifications.create(`drupal-issue-${issue.nid}`, {
    type: 'basic',
    iconUrl: '/icon128.png',
    title: `[${statusLabel}] ${projectName}`,
    message: issue.title,
    contextMessage: `Issue #${issue.nid} - Click to open`,
    priority: 2,
    isClickable: true
  });

  // Trigger audio alert via offscreen document
  setupOffscreenDocument().then(() => {
    chrome.runtime.sendMessage({
      type: 'play_audio',
      target: 'offscreen'
    }).catch(() => {});
  });
}
