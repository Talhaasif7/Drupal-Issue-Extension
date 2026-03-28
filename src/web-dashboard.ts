import { storage } from './lib/storage'
import { fetchRecentProjects, fetchProjectIssues, fetchGlobalIssues, formatStatus, fetchActiveProjectsForAutocomplete } from './lib/drupal-api'
import type { DrupalIssue } from './lib/drupal-api'

import AOS from 'aos';
import 'aos/dist/aos.css';
import { createIcons, icons } from 'lucide';

class WebDashboard {
    private grid: HTMLElement | null = null;
    private searchInput: HTMLInputElement | null = null;
    private addButton: HTMLElement | null = null;
    private loadMoreButton: HTMLElement | null = null;
    private categories: NodeListOf<HTMLElement> | null = null;
    
    private tabGlobal: HTMLElement | null = null;
    private tabTracked: HTMLElement | null = null;
    private headerTitle: HTMLElement | null = null;
    private currentView: 'global' | 'tracked' | 'single' = 'global';
    private activeProjectSearch: string | null = null;

    private currentFilter: string = 'All';
    private currentPage: number = 0;
    private globalIssues: DrupalIssue[] = [];

    constructor() {
        document.addEventListener('DOMContentLoaded', () => this.init());
    }

    async init() {
        this.grid = document.getElementById('web-project-grid');
        this.searchInput = document.getElementById('web-project-search') as HTMLInputElement;
        this.addButton = document.getElementById('web-add-project');
        this.loadMoreButton = document.getElementById('web-load-more');
        this.categories = document.querySelectorAll('.category-btn');

        if (this.addButton && this.searchInput) {
            this.addButton.addEventListener('click', () => this.handleAdd());
            this.searchInput.addEventListener('keydown', (e) => e.key === 'Enter' && this.handleAdd());
        }

        if (this.loadMoreButton) {
            this.loadMoreButton.addEventListener('click', () => this.handleLoadMore());
        }

        this.categories?.forEach(btn => {
            btn.addEventListener('click', () => {
                const cat = btn.getAttribute('data-category') || 'All';
                this.setFilter(cat);
            });
        });

        this.tabGlobal = document.getElementById('tab-global');
        this.tabTracked = document.getElementById('tab-tracked');
        this.headerTitle = document.getElementById('header-title');

        if (this.tabGlobal && this.tabTracked) {
            this.tabGlobal.addEventListener('click', () => this.setTab('global'));
            this.tabTracked.addEventListener('click', () => this.setTab('tracked'));
        }

        // Initialize Native Replacements for CDNs
        AOS.init({ duration: 800, once: true, offset: 50 });
        
        // Setup global click handling for data-action
        document.body.addEventListener('click', (e) => {
            const target = (e.target as HTMLElement).closest('[data-action]');
            if (!target) return;
            
            const action = target.getAttribute('data-action');
            if (action === 'scroll-top') window.scrollTo({top: 0, behavior: 'smooth'});
            if (action === 'scroll-dashboard') document.getElementById('dashboard')?.scrollIntoView({behavior: 'smooth'});
            if (action === 'install-modal-open') this.toggleModal(true);
            if (action === 'install-modal-close') this.toggleModal(false);
            
            if (action === 'install-chrome') {
                // If we are in the extension already, go to settings. If on web, we would go to store.
                // Since we can't open chrome:// directly from web, we stay on the modal which explains how to load it.
                this.toggleModal(true);
            }
        });

        window.addEventListener('scroll', () => {
            const nav = document.querySelector('nav');
            if (nav) {
                if (window.scrollY > 50) {
                    nav.classList.add('py-4');
                    nav.classList.remove('py-0');
                } else {
                    nav.classList.add('py-0');
                    nav.classList.remove('py-4');
                }
            }
        });

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.toggleModal(false);
        });

        // AUTO-DISCOVERY
        const tracked = await storage.getTrackedProjects();
        if (tracked.length === 0) {
            await this.discover();
        }

        this.setTab('global');
        
        // Silently prepopulate search autocomplete with top 200 projects
        this.populateAutocomplete();
        
        // Defer icon creation slightly so DOM is ready
        setTimeout(() => createIcons({ icons }), 50);
    }

    toggleModal(show: boolean) {
        const modal = document.getElementById('installModal');
        if (!modal) return;
        if (show) {
            modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        } else {
            modal.classList.add('hidden');
            document.body.style.overflow = 'auto';
        }
    }

    async populateAutocomplete() {
        const datalist = document.getElementById('drupal-projects-list');
        if (!datalist) return;
        try {
            const projects = await fetchActiveProjectsForAutocomplete(200);
            datalist.innerHTML = projects.map((p: any) => `<option value="${p.machine_name}">${p.title}</option>`).join('');
        } catch(e) {
            console.error('Failed to load autocomplete dataset', e);
        }
    }

    async discover() {
        try {
            const projects = await fetchRecentProjects();
            for (const p of projects.slice(0, 4)) {
                await storage.addProject(p);
                const issues = await fetchProjectIssues(p);
                await storage.saveIssues(issues.map(i => ({
                    ...i,
                    project_name: p,
                    status: formatStatus(i.status),
                    last_changed: Date.now()
                })));
            }
        } catch (e) {
            console.error('Auto-discovery failed.', e);
        }
    }

    async handleAdd() {
        const name = this.searchInput?.value.trim().toLowerCase();
        if (!name) return;
        
        // Add to persistent tracking list behind the scenes
        await storage.addProject(name);
        if (this.searchInput) this.searchInput.value = '';
        
        // Switch to tracked view natively and force selecting this project
        this.activeProjectSearch = name;
        this.setTab('tracked');
    }

    async renderTrackedPills() {
        const container = document.getElementById('tracked-projects-container');
        if (!container) return;

        if (this.currentView !== 'tracked') {
            container.classList.add('hidden');
            return;
        }

        const tracked = await storage.getTrackedProjects();
        if (tracked.length === 0) {
            container.classList.add('hidden');
            return;
        }

        container.classList.remove('hidden');
        container.innerHTML = tracked.map(p => 
            `<button data-project="${p}" class="tracked-pill px-4 py-1.5 rounded-full text-xs font-bold ${this.activeProjectSearch === p ? 'bg-cyber-cyan text-black' : 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'} transition-all shadow-sm focus:outline-none">
                ${p}
            </button>`
        ).join('');

        container.querySelectorAll('.tracked-pill').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const project = (e.currentTarget as HTMLElement).getAttribute('data-project');
                if (project) {
                    this.activeProjectSearch = project;
                    this.viewProject(project);
                }
            });
        });
    }

    async viewProject(name: string) {
        this.activeProjectSearch = name;
        
        if (this.headerTitle) this.headerTitle.textContent = `Project: ${name}`;
        
        if (this.loadMoreButton) this.loadMoreButton.style.display = 'none';

        if (!this.grid) return;
        this.grid.innerHTML = `<div class="col-span-full py-20 flex justify-center"><i data-lucide="loader-2" class="w-8 h-8 text-cyber-cyan animate-spin"></i></div>`;
        if (typeof (window as any).lucide !== 'undefined') (window as any).lucide.createIcons();
        
        this.renderTrackedPills();

        try {
            const issues = await fetchProjectIssues(name);
            this.globalIssues = issues;
            this.updateCategoryCounts();
            this.renderFilteredGlobal();
            
            if (this.globalIssues.length === 0) {
                 this.grid.innerHTML = `<div class="col-span-full py-20 text-center text-slate-500 font-mono text-sm uppercase tracking-widest">No active issues found for '${name}'</div>`;
            }
        } catch(e) {
            console.error('Failed to load project view', e);
            this.grid.innerHTML = `<div class="col-span-full py-20 text-center text-red-400 font-mono text-xs uppercase tracking-widest">Unable to locate project mapping for '${name}'. Did you use the machine name?</div>`;
        }
    }

    setFilter(cat: string) {
        this.currentFilter = cat;
        
        this.categories?.forEach(btn => {
            const badge = btn.querySelector('.cat-count');
            if (btn.getAttribute('data-category') === cat) {
                btn.classList.add('bg-white/10', 'text-white', 'active');
                btn.classList.remove('hover:bg-white/5', 'text-slate-400');
                if (badge) badge.classList.replace('text-slate-400', 'text-cyber-cyan');
            } else {
                btn.classList.remove('bg-white/10', 'text-white', 'active');
                btn.classList.add('hover:bg-white/5', 'text-slate-400');
                if (badge) badge.classList.replace('text-cyber-cyan', 'text-slate-400');
            }
        });

        this.renderFilteredGlobal();
    }

    updateCategoryCounts() {
        if (!this.categories) return;
        
        const counts: Record<string, number> = {
            'All': this.globalIssues.length,
            '1': this.globalIssues.filter(i => String(i.category) === '1').length,
            '2': this.globalIssues.filter(i => String(i.category) === '2').length,
            '3': this.globalIssues.filter(i => String(i.category) === '3').length,
        };

        this.categories.forEach(btn => {
            const cat = btn.getAttribute('data-category');
            if (cat && counts[cat] !== undefined) {
                const badge = btn.querySelector('.cat-count');
                if (badge) badge.textContent = counts[cat].toString();
            }
        });
    }

    renderFilteredGlobal() {
        if (!this.grid) return;
        this.grid.innerHTML = '';
        
        let filtered = this.globalIssues;
        if (this.currentFilter !== 'All') {
            filtered = this.globalIssues.filter(i => String(i.category) === this.currentFilter);
        }

        if (filtered.length === 0) {
            this.grid.innerHTML = `<div class="col-span-full py-20 text-center text-slate-500 font-mono text-xs uppercase tracking-widest">No issues found in this category.</div>`;
            return;
        }

        filtered.forEach(issue => {
            this.grid!.appendChild(this.createIssueCard(issue));
        });
    }

    async handleLoadMore() {
        if (!this.loadMoreButton) return;
        
        const originalText = this.loadMoreButton.innerHTML;
        this.loadMoreButton.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> LOADING...`;
        this.loadMoreButton.setAttribute('disabled', 'true');

        this.currentPage++;
        await this.fetchAndRenderGlobal(true);

        this.loadMoreButton.innerHTML = originalText;
        this.loadMoreButton.removeAttribute('disabled');
    }

    setTab(tab: 'global' | 'tracked') {
        this.currentView = tab;
        this.currentPage = 0;
        this.globalIssues = [];

        if (this.tabGlobal && this.tabTracked) {
            if (tab === 'global') {
                this.tabGlobal.classList.add('text-white', 'border-cyber-cyan');
                this.tabGlobal.classList.remove('hover:text-white', 'text-slate-400', 'border-transparent');
                this.tabTracked.classList.add('hover:text-white', 'text-slate-400', 'border-transparent');
                this.tabTracked.classList.remove('text-white', 'border-cyber-cyan');
                if(this.headerTitle) this.headerTitle.textContent = "Global Feed";
            } else {
                this.tabTracked.classList.add('text-white', 'border-cyber-cyan');
                this.tabTracked.classList.remove('hover:text-white', 'text-slate-400', 'border-transparent');
                this.tabGlobal.classList.add('hover:text-white', 'text-slate-400', 'border-transparent');
                this.tabGlobal.classList.remove('text-white', 'border-cyber-cyan');
                if(this.headerTitle) this.headerTitle.textContent = "My Watchlist";
            }
        }

        if (this.loadMoreButton) {
            this.loadMoreButton.style.display = (tab === 'global' && this.currentFilter === 'All') ? 'flex' : 'none';
        }
        
        this.renderTrackedPills();
        this.refresh();
    }

    async fetchAndRenderTracked() {
        if (!this.grid) return;
        const tracked = await storage.getTrackedProjects();
        
        if (tracked.length === 0) {
            this.grid.innerHTML = `<div class="col-span-full py-20 text-center text-slate-500 font-mono text-sm leading-relaxed tracking-wider">You haven't added any projects yet.<br/><br/>Search for a tool like <span class="text-cyber-cyan">ctools</span> or <span class="text-cyber-cyan">commerce</span> above and click ADD.</div>`;
            return;
        }

        if (!this.activeProjectSearch || !tracked.includes(this.activeProjectSearch)) {
             this.activeProjectSearch = tracked[0];
        }

        this.renderTrackedPills();
        await this.viewProject(this.activeProjectSearch);
    }

    async refresh() {
        if (!this.grid) return;
        if (this.currentView === 'global') {
            await this.fetchAndRenderGlobal(false);
        } else if (this.currentView === 'tracked') {
            await this.fetchAndRenderTracked();
        }
    }

    async fetchAndRenderGlobal(append: boolean) {
        if (!this.grid) return;

        try {
            const newIssues = await fetchGlobalIssues(this.currentPage);
            if (!itemsHaveChanged(this.globalIssues, newIssues) && !append && this.globalIssues.length > 0) return;

            if (append) {
                this.globalIssues = [...this.globalIssues, ...newIssues];
            } else {
                this.globalIssues = newIssues;
            }

            this.updateCategoryCounts();
            this.renderFilteredGlobal();
        } catch (e) {
            console.error('Global feed failed', e);
            if (!append && this.globalIssues.length === 0) {
                this.grid.innerHTML = '<div class="col-span-full py-20 text-center text-red-400 font-mono text-xs uppercase tracking-widest">Unable to connect to Drupal API. Please check your network.</div>';
            }
        }
    }
    createIssueCard(issue: any) {
        const card = document.createElement('div');
        card.className = 'project-card p-4 rounded-lg border border-white/10 bg-white/[0.03] hover:border-cyber-cyan/50 transition-all group animate-fade-in-up';
        
        const statusLabel = formatStatus(issue.status);
        const isNovice = statusLabel.toLowerCase().includes('novice');
        const isBug = statusLabel.toLowerCase().includes('bug');

        card.innerHTML = `
            <div class="flex justify-between items-start mb-3">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-lg bg-cyber-cyan/10 flex items-center justify-center text-cyber-cyan">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-zap fill-current"><path d="M4 14.5L12 3v9h8L12 21v-9H4z"/></svg>
                    </div>
                    <div class="min-w-0">
                        <h4 class="font-medium text-white text-sm truncate">${issue.project}</h4>
                        <p class="text-[10px] text-slate-500 font-mono tracking-tighter truncate">drupal.org/project/${issue.project}</p>
                    </div>
                </div>
            </div>
            <div class="mt-4 pt-4 border-t border-white/5">
                <div class="flex justify-between items-center mb-1">
                    <a href="https://www.drupal.org/node/${issue.nid}" target="_blank" class="text-cyber-cyan font-mono text-[10px] hover:underline">#${issue.nid}</a>
                    <span class="px-1.5 py-0.5 ${isNovice ? 'bg-green-500/10 text-green-400' : isBug ? 'bg-red-500/10 text-red-400' : 'bg-cyber-cyan/10 text-cyber-cyan'} text-[10px] font-bold rounded uppercase tracking-tighter">${statusLabel}</span>
                </div>
                <a href="https://www.drupal.org/node/${issue.nid}" target="_blank" class="text-[11px] text-slate-300 line-clamp-2 leading-snug font-sans hover:text-cyber-cyan transition-colors h-8 block mb-2">${issue.title}</a>
                <div class="flex flex-col gap-1 mt-3 pt-3 border-t border-white/5 opacity-80">
                    <div class="flex items-center gap-1.5 text-[9px] font-mono text-slate-400">
                        <i data-lucide="calendar-plus" class="w-2.5 h-2.5 text-slate-500"></i>
                        <span>Created: ${new Date(issue.created * 1000).toLocaleString()}</span>
                    </div>
                    <div class="flex items-center gap-1.5 text-[9px] font-mono text-slate-400">
                        <i data-lucide="clock" class="w-2.5 h-2.5 text-slate-500"></i>
                        <span>Updated: ${new Date(issue.changed * 1000).toLocaleString()}</span>
                    </div>
                </div>
            </div>
        `;
        return card;
    }
}

function itemsHaveChanged(oldItems: any[], newItems: any[]) {
    if (oldItems.length !== newItems.length) return true;
    return oldItems[0]?.nid !== newItems[0]?.nid;
}

new WebDashboard();
