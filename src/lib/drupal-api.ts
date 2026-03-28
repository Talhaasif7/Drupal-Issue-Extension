export interface DrupalIssue {
  nid: string;
  title: string;
  project: string;
  status: string;
  priority: string;
  category: string;
  created: number;
  changed: number;
}

const isExtension = typeof chrome !== 'undefined' && chrome.storage !== undefined;
export const DRUPAL_API_BASE = isExtension 
  ? "https://www.drupal.org/api-d7/node.json" 
  : "/api/drupal/api-d7/node.json";

export function createApiUrl(): URL {
  if (DRUPAL_API_BASE.startsWith('http')) {
    return new URL(DRUPAL_API_BASE);
  }
  return new URL(DRUPAL_API_BASE, typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173');
}

/**
 * Fetch recently updated projects from Drupal.org.
 */
export async function fetchRecentProjects(limit: number = 10): Promise<string[]> {
  const url = createApiUrl();
  url.searchParams.append("type", "project_module"); // Or project_core, etc.
  url.searchParams.append("sort", "changed");
  url.searchParams.append("direction", "DESC");
  url.searchParams.append("limit", limit.toString());

  const response = await fetch(url.toString());
  if (!response.ok) return [];

  const data = await response.json();
  return (data.list || [])
    .map((node: any) => node.field_project_machine_name)
    .filter(Boolean);
}

/**
 * Fetch top active projects for the search autocomplete datalist.
 */
export async function fetchActiveProjectsForAutocomplete(limit: number = 200): Promise<{title: string, machine_name: string}[]> {
  try {
    const url = createApiUrl();
    url.searchParams.append("type", "project_module");
    url.searchParams.append("sort", "changed");
    url.searchParams.append("direction", "DESC");
    url.searchParams.append("limit", limit.toString());

    const response = await fetch(url.toString());
    if (!response.ok) return [];

    const data = await response.json();
    if (!data.list) return [];

    return data.list
      .filter((n: any) => n.field_project_machine_name && n.title)
      .map((n: any) => ({
        title: String(n.title),
        machine_name: String(n.field_project_machine_name)
      }));
  } catch (e) {
    console.error("fetchActiveProjectsForAutocomplete error:", e);
    return [];
  }
}

/**
 * Fetch issues for a specific Drupal project.
 */
export async function fetchProjectIssues(projectName: string): Promise<DrupalIssue[]> {
  // 1. Resolve project machine name to Drupal Node ID (NID)
  const resolveUrl = createApiUrl();
  resolveUrl.searchParams.append("field_project_machine_name", projectName);
  const resolveRes = await fetch(resolveUrl.toString());
  
  if (!resolveRes.ok) {
    throw new Error(`Failed to resolve NID for ${projectName}`);
  }
  const resolveData = await resolveRes.json();
  const nid = resolveData.list && resolveData.list.length > 0 ? resolveData.list[0].nid : null;

  if (!nid) {
    console.warn(`Drupal API returned no NID for project machine name: ${projectName}`);
    return [];
  }

  // 2. Fetch Active Issues mapped specifically to that Node ID
  const url = createApiUrl();
  url.searchParams.append("field_project", nid);
  url.searchParams.append("type", "project_issue");
  // Filter for active, not closed: 
  // 1: Active, 8: Needs Review, 13: Needs Work, 14: RTBC, 16: Postponed (Needs Info)
  url.searchParams.append("field_issue_status", "1,8,13,14,16");
  url.searchParams.append("sort", "changed");
  url.searchParams.append("direction", "DESC");

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Failed to fetch issues for NID ${nid} (${projectName}): ${response.statusText}`);
  }

  const data = await response.json();
  
  return (data.list || []).map((node: any) => ({
    nid: node.nid,
    title: node.title,
    project: projectName,
    status: node.field_issue_status,
    priority: node.field_issue_priority,
    category: node.field_issue_category,
    created: parseInt(node.created, 10),
    changed: parseInt(node.changed, 10),
  }));
}

/**
 * Fetch latest issues globally across Drupal.org.
 */
export async function fetchGlobalIssues(page: number = 0): Promise<DrupalIssue[]> {
  const url = createApiUrl();
  url.searchParams.append("type", "project_issue");
  url.searchParams.append("field_issue_status", "1,8,13,14,16");
  url.searchParams.append("sort", "changed"); // Real-time pulse
  url.searchParams.append("direction", "DESC");
  url.searchParams.append("limit", "20");
  url.searchParams.append("page", page.toString());

  const response = await fetch(url.toString());
  if (!response.ok) return [];

  const data = await response.json();
  
  return (data.list || []).map((node: any) => ({
    nid: node.nid,
    title: node.title,
    project: node.field_project_machine_name || "Drupal", 
    status: node.field_issue_status,
    priority: node.field_issue_priority,
    category: node.field_issue_category,
    created: parseInt(node.created, 10),
    changed: parseInt(node.changed, 10),
  }));
}

export const STATUS_MAP: Record<string, string> = {
  "1": "Active",
  "8": "Needs Review",
  "13": "Needs Work",
  "14": "RTBC",
  "16": "Needs Info"
};

export function formatStatus(status: string): string {
  return STATUS_MAP[status] || status;
}
