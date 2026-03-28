import { supabase } from './supabase'
import type { DrupalIssueRecord } from './supabase'

const isExtension = typeof chrome !== 'undefined' && chrome.storage !== undefined && chrome.storage.local !== undefined;

const isSupabaseConfigured = () => {
    // @ts-ignore
    const url = import.meta.env.VITE_SUPABASE_URL;
    // @ts-ignore
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    return url && key && !url.includes('your-project') && url.length > 0;
};

export const storage = {
    async getTrackedProjects(): Promise<string[]> {
        if (isSupabaseConfigured()) {
            try {
                const { data, error } = await supabase.from('tracked_projects').select('project_name');
                if (!error && data) return data.map(d => d.project_name);
            } catch (e) {
                console.warn('Supabase fetch failed', e);
            }
        }
        
        if (isExtension) {
            return new Promise((resolve) => {
                chrome.storage.local.get(['tracked_projects'], (result) => {
                    resolve((result.tracked_projects as string[]) || []);
                });
            });
        }
        
        const local = sessionStorage.getItem('tracked_projects');
        return local ? JSON.parse(local) : [];
    },

    async addProject(projectName: string): Promise<void> {
        const name = projectName.toLowerCase().trim();
        if (isSupabaseConfigured()) {
            try {
                await supabase.from('tracked_projects').insert({ project_name: name });
            } catch (e) {
                console.warn('Supabase insert failed', e);
            }
        }
        
        if (isExtension) {
            const current = await this.getTrackedProjects();
            if (!current.includes(name)) {
                await chrome.storage.local.set({ tracked_projects: [...current, name] });
            }
        } else {
            const current = await this.getTrackedProjects();
            if (!current.includes(name)) {
                sessionStorage.setItem('tracked_projects', JSON.stringify([...current, name]));
            }
        }
    },

    async removeProject(projectName: string): Promise<void> {
        if (isSupabaseConfigured()) {
            try {
                await supabase.from('tracked_projects').delete().eq('project_name', projectName);
            } catch (e) {
                console.warn('Supabase delete failed', e);
            }
        }
        
        if (isExtension) {
            const current = await this.getTrackedProjects();
            await chrome.storage.local.set({ 
                tracked_projects: current.filter(p => p !== projectName) 
            });
        } else {
            const current = await this.getTrackedProjects();
            sessionStorage.setItem('tracked_projects', JSON.stringify(current.filter(p => p !== projectName)));
        }
    },

    async saveIssues(issues: DrupalIssueRecord[]): Promise<void> {
        if (isSupabaseConfigured()) {
            try {
                await supabase.from('issues').upsert(issues, { onConflict: 'nid' });
            } catch (e) {
                console.warn('Supabase upsert failed', e);
            }
        }
        
        if (isExtension) {
            await chrome.storage.local.set({ latest_issues: issues.slice(0, 20) });
        } else {
            sessionStorage.setItem('latest_issues', JSON.stringify(issues.slice(0, 20)));
        }
    },

    async getLatestIssues(): Promise<DrupalIssueRecord[]> {
        if (isSupabaseConfigured()) {
            try {
                const { data, error } = await supabase.from('issues').select('*').order('last_changed', { ascending: false }).limit(50);
                if (!error && data) return data;
            } catch (e) {
                console.warn('Supabase issues fetch failed', e);
            }
        }

        if (isExtension) {
            return new Promise((resolve) => {
                chrome.storage.local.get(['latest_issues'], (result) => {
                    resolve((result.latest_issues as DrupalIssueRecord[]) || []);
                });
            });
        }
        
        const local = sessionStorage.getItem('latest_issues');
        return local ? JSON.parse(local) : [];
    }
};
