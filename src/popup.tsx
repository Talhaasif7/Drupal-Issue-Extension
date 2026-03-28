import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ExternalLink, Clock, AlertCircle } from 'lucide-react';
import type { DrupalIssueRecord } from './lib/supabase';
import './popup.css';

const Popup = () => {
  const [issues, setIssues] = useState<DrupalIssueRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchIssues = async () => {
    try {
      // Fetch directly from Drupal to guarantee real-time accuracy and bypass empty Supabase caches
      const { fetchGlobalIssues, formatStatus } = await import('./lib/drupal-api');
      const data = await fetchGlobalIssues(0);
      
      // The user specifically requested to sort by creation time
      const sortedByCreation = data.sort((a: any, b: any) => b.created - a.created);
      
      setIssues(sortedByCreation.map((i: any) => ({
          nid: i.nid,
          title: i.title,
          project_name: i.project,
          status: formatStatus(i.status),
          created_at: i.created * 1000,
          last_changed: i.changed * 1000
      })) as any);
    } catch (err) {
      console.error('Failed to fetch issues directly:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIssues();
    
    if (typeof chrome !== 'undefined' && chrome.alarms) {
       // Refresh when background worker polls
       chrome.storage.onChanged.addListener((changes, areaName) => {
         if (areaName === 'local' && changes.last_changed_global) {
           fetchIssues();
         }
       });
    }
  }, []);

  const openIssue = (nid: string) => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.create({ url: `https://www.drupal.org/node/${nid}` });
    } else {
      window.open(`https://www.drupal.org/node/${nid}`, '_blank');
    }
  };

  const openDashboard = () => {
    // Navigate to the live dev server instead of the internal extension copy
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.create({ url: 'http://localhost:5173/' });
    } else {
      window.open('http://localhost:5173/', '_blank');
    }
  };

  return (
    <>
      <header className="header">
        <div className="logo-container">
          <div className="logo-icon">IS</div>
          <h1 className="header-title font-display">Issue<span>Sniper</span></h1>
        </div>
        <div className="status-badge">
          <div className="status-dot"></div> Active
        </div>
      </header>

      <div className="feed-container">
        {loading ? (
          <div className="state-container">
            <div className="spinner"></div>
            <p className="font-mono" style={{ fontSize: '10px', color: 'var(--slate-400)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Loading Feed...</p>
          </div>
        ) : issues.length === 0 ? (
          <div className="state-container">
            <AlertCircle color="#64748b" size={40} style={{ marginBottom: '8px' }} />
            <p className="state-title">No issues found yet.</p>
            <p className="state-desc">Keep tracking projects and any new issues will appear here instantly.</p>
          </div>
        ) : (
          issues.map((issue) => (
            <div 
              key={issue.nid} 
              onClick={() => openIssue(issue.nid)}
              className="issue-card"
            >
              <div className="card-header">
                <span className="issue-id">#{issue.nid}</span>
                <span className="issue-time">
                  <Clock className="lucide-icon" /> 
                  <span style={{color: 'var(--cyber-cyan)', fontWeight: 'bold', marginRight: '4px'}}>NEW</span>
                  {new Date(issue.created_at || Date.now()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </span>
              </div>
              
              <h3 className="issue-title">
                {issue.title}
              </h3>
              
              <div className="card-footer">
                <span className="project-name">{issue.project_name}</span>
                <span className="status-label">
                  {issue.status || 'Active'}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
      
      <footer className="ext-footer">
        <span className="footer-text">Syncing actively...</span>
        <button 
          onClick={openDashboard}
          className="btn-dashboard"
        >
          View Dashboard <ExternalLink className="lucide-icon" />
        </button>
      </footer>
    </>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<Popup />);
