import React, { useState, useCallback, useEffect } from 'react';
import { View, Checklist, User, Role, ChecklistTemplate, Task, ChecklistItem, Outlet, ChecklistItemBase } from './types';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import AdminDashboardView from './components/admin/AdminDashboardView';
import AuditorDashboardView from './components/auditor/AuditorDashboardView';
import ChecklistView from './components/checklist/ChecklistView';
import FindingsView from './components/findings/FindingsView';
import UserManagementView from './components/admin/UserManagementView';
import TemplateEditorView from './components/templates/TemplateEditorView';
import OutletManagementView from './components/admin/OutletManagementView';
import AssignmentView from './components/admin/AssignmentView';
import ReportsView from './components/reports/ReportsView';
import MissedReportsView from './components/reports/MissedReportsView';
import WhatsAppConfigView from './components/admin/WhatsAppConfigView';
import { sendWhatsAppMessage } from './services/whatsappClient';
import { LogIn, LoaderCircle } from 'lucide-react';
import Card from './components/shared/Card';
import Button from './components/shared/Button';
import { turso } from './services/tursoClient';
import { uploadPublic } from './services/storageClient';
import { base64ToBlob } from './utils/fileUtils';
import { generateAuditReportPDF } from './services/pdfService';
import ProgressOverlay from './components/shared/ProgressOverlay';
import { SignIn, useUser, useClerk } from '@clerk/clerk-react';

const LOGO_URL = (import.meta as any).env?.VITE_LOGO_URL || "https://pub-9d01db2ebda64069a7e7fd1f530e753e.r2.dev/viLjdYG8hKmB34Y0CZFvFTm8BWcavvRr5B05IUl1__1_-removebg-preview%20%281%29.png";

console.log('[DEBUG] App.tsx module loaded successfully');

const LoginPage: React.FC = () => {
  const [logoSrc, setLogoSrc] = useState<string>(LOGO_URL);
  const [sanitizedTried, setSanitizedTried] = useState(false);
  const sanitizeUrl = (url: string) => url.replace(/\(/g, '%28').replace(/\)/g, '%29');

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-base-200">
      <div className="flex flex-col items-center max-w-sm w-full bg-transparent">
        {logoSrc ? (
          <img
            src={logoSrc}
            alt="Kapal Api Coffee Corner Logo"
            className="w-48 mb-6"
            onError={() => {
              if (!sanitizedTried) {
                setSanitizedTried(true);
                setLogoSrc(sanitizeUrl(logoSrc));
              } else {
                setLogoSrc('');
              }
            }}
          />
        ) : (
          <div className="w-48 h-16 mb-6 flex items-center justify-center text-neutral font-semibold">
            Kapal Api Coffee Corner
          </div>
        )}
        <div className="w-full shadow-2xl rounded-xl overflow-hidden mt-4">
          <SignIn routing="hash" />
        </div>
      </div>
    </div>
  );
};


const LoadingSpinner: React.FC<{ message?: string }> = ({ message = "Loading Application Data..." }) => (
  <div className="flex items-center justify-center min-h-screen bg-base-200">
    <div className="text-center">
      <LoaderCircle className="w-16 h-16 text-primary animate-spin mx-auto" />
      <p className="mt-4 text-lg text-neutral font-semibold">{message}</p>
    </div>
  </div>
);


const App: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [checklistTemplates, setChecklistTemplates] = useState<ChecklistTemplate[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [hasLoaded, setHasLoaded] = useState<boolean>(false);

  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const { isLoaded: isClerkLoaded, isSignedIn, user: clerkUser } = useUser();
  const { signOut } = useClerk();

  const [view, setView] = useState<View>(() => {
    try {
      const activeChecklistId = sessionStorage.getItem('activeChecklistId') || localStorage.getItem('activeChecklistId');
      if (activeChecklistId) return 'checklists';
      const lastViewRaw = localStorage.getItem('lastView');
      const validViews = new Set(['checklists', 'findings', 'reports', 'admin_dashboard', 'auditor_dashboard', 'user_management', 'templates', 'outlet_management', 'assignments', 'missed_reports']);
      if (lastViewRaw && validViews.has(lastViewRaw)) return lastViewRaw as View;
    } catch { }
    return 'auditor_dashboard';
  });
  const [selectedChecklist, setSelectedChecklist] = useState<Checklist | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [submissionProgress, setSubmissionProgress] = useState<{ message: string; progress: number } | null>(null);

  const safeSetView = useCallback((next: View) => {
    localStorage.setItem('lastView', next);
    // Security check: if user is Auditor, prevent access to admin-only views
    if (currentUser?.role === Role.Auditor) {
      const adminOnlyViews = new Set(['admin_dashboard', 'assignments', 'user_management', 'templates', 'outlet_management', 'whatsapp_config', 'missed_reports']);
      if (adminOnlyViews.has(next)) {
        setView('auditor_dashboard');
        return;
      }
    }
    setView(next);
  }, [currentUser]);

  // Fetch user profile and set view based on role
  const setupUserSession = useCallback(async (userId: string, userEmail: string = '', userName: string = '') => {
    const fetchUserProfileWithRetry = async (retries = 3, delay = 500): Promise<User | null> => {
      for (let i = 0; i < retries; i++) {
        let userProfile: any = null;
        let error: any = null;
        try {
          const res = await turso.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [userId] });
          if (res.rows.length > 0) userProfile = res.rows[0];
          else error = { code: 'PGRST116', message: 'Not found' };
        } catch (e: any) { error = e; }

        if (!error && userProfile) {
          return userProfile as User;
        }

        const isZeroRows = error && error.code === 'PGRST116';
        const message = String(error?.message || '');
        const isNetworkError = !error?.code && /Failed to fetch|NetworkError|ERR_ABORTED/i.test(message);

        if (isZeroRows) {
          // No profile yet; allow outer logic to create it
          break;
        }

        if (isNetworkError && i < retries - 1) {
          console.warn(`Network error fetching profile (attempt ${i + 1}). Retrying...`, error);
          await new Promise(res => setTimeout(res, delay * (i + 1)));
          continue;
        }

        if (error) {
          console.error(`Non-retriable error fetching user profile on attempt ${i + 1}:`, error);
          throw error;
        }
      }
      return null;
    };

    try {
      let userProfile = await fetchUserProfileWithRetry();

      // FIX: If the profile doesn't exist, create it automatically. This makes the app resilient
      // to trigger failures or for users created before the trigger was active.
      if (!userProfile) {
        console.warn(`User profile for ${userId} not found. Creating a new one.`);
        let newUserProfile: any = null;
        let insertError: any = null;
        try {
          await turso.execute({ sql: 'INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)', args: [userId, userEmail, userName, Role.Auditor] });
          const res = await turso.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [userId] });
          newUserProfile = res.rows[0];
        } catch (e: any) { insertError = e; }

        if (insertError) {
          throw new Error(`Failed to create user profile: ${insertError.message}`);
        }
        userProfile = newUserProfile as User;
      }

      if (userProfile) {
        setCurrentUser(userProfile);
        const activeChecklistId = sessionStorage.getItem('activeChecklistId') || localStorage.getItem('activeChecklistId');
        if (activeChecklistId) {
          setView('checklists');
        } else {
          const templateActive = localStorage.getItem('templateDraftActive') === '1';
          if (templateActive) {
            setView('templates');
          } else {
            const lastViewRaw = localStorage.getItem('lastView');
            const validViews = new Set(['checklists', 'findings', 'reports', 'admin_dashboard', 'auditor_dashboard', 'user_management', 'templates', 'outlet_management', 'assignments', 'missed_reports']);
            const adminOnlyViews = new Set(['admin_dashboard', 'assignments', 'findings', 'reports', 'user_management', 'templates', 'outlet_management', 'missed_reports']);
            if (lastViewRaw && validViews.has(lastViewRaw)) {
              if (userProfile.role === Role.Auditor && adminOnlyViews.has(lastViewRaw)) {
                safeSetView('auditor_dashboard');
              } else {
                safeSetView(lastViewRaw as View);
              }
            } else if (userProfile.role === Role.Admin) {
              safeSetView('admin_dashboard');
            } else {
              safeSetView('auditor_dashboard');
            }
          }
        }
      } else {
        throw new Error("User profile could not be found or created. This is an unexpected error.");
      }
    } catch (error: any) {
      console.error("Error setting up user session:", error);
      const message = String(error?.message || "An unknown error occurred.");
      const isNetworkError = /Failed to fetch|NetworkError|ERR_ABORTED/i.test(message);
      const errorMessage = isNetworkError
        ? `Network issue while setting up session. Please check your connection and try again.`
        : `Failed to set up session: ${message}\nPlease check the database permissions or try again.`;
      sessionStorage.setItem('loginError', errorMessage);
      if (!isNetworkError) {
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('sb-') && key.includes('auth-token')) {
              localStorage.removeItem(key);
            }
          }
        } catch { }
      }
    }
  }, []);

  // FIX: This new `useEffect` provides a more robust authentication flow. It handles the initial
  // session check, listens for auth changes, and crucially, adds a 'pageshow' event listener.
  // This listener re-validates the session when a user navigates back to the page using the
  // browser's back/forward cache (bfcache).
  useEffect(() => {
    const handleSession = async () => {
      if (!isClerkLoaded) return;

      try {
        if (isSignedIn && clerkUser) {
          console.log('[DEBUG] Setting up user session for:', clerkUser.id);
          const email = clerkUser.primaryEmailAddress?.emailAddress || '';
          const name = clerkUser.fullName || clerkUser.firstName || '';
          await setupUserSession(clerkUser.id, email, name);
        } else {
          console.log('[DEBUG] No session, setting currentUser to null');
          setCurrentUser(null);
        }
      } catch (error) {
        console.error("[DEBUG] Error handling user session:", error);
        setCurrentUser(null);
      } finally {
        setIsAuthLoading(false);
      }
    };

    handleSession();
  }, [isClerkLoaded, isSignedIn, clerkUser, setupUserSession]);
  const fetchData = useCallback(async () => {
    if (!hasLoaded) {
      setIsLoading(true);
    }
    try {
      const processJSON = (rows: any[], cols: string[]) => rows.map((r: any) => {
        const newR = { ...r };
        cols.forEach(c => { if (typeof newR[c] === 'string') { try { newR[c] = JSON.parse(newR[c]); } catch { } } });
        return newR;
      });

      const fetchAll = async (table: string) => {
        try { const res = await turso.execute(`SELECT * FROM ${table}`); return { data: res.rows as any[] }; }
        catch (error) { return { error }; }
      };

      const [usersRes, checklistsRes, tasksRes, templatesRes, outletsRes] = await Promise.all([
        fetchAll('users'), fetchAll('checklists'), fetchAll('tasks'), fetchAll('checklist_templates'), fetchAll('outlets')
      ]);
      if (checklistsRes.data) checklistsRes.data = processJSON(checklistsRes.data, ['items']);
      if (templatesRes.data) templatesRes.data = processJSON(templatesRes.data, ['items']);

      if (usersRes.error) throw usersRes.error;
      if (checklistsRes.error) throw checklistsRes.error;
      if (tasksRes.error) throw tasksRes.error;
      if (templatesRes.error) throw templatesRes.error;
      if (outletsRes.error) throw outletsRes.error;

      // Process checklists to ensure 'items' is always an array
      // FIX: Explicitly cast the mapped item `c` to `any` to resolve a TypeScript
      // inference issue where `c` was incorrectly typed as `never`. This also
      // makes the `items` processing more robust by ensuring it's always an array.
      const processedChecklists = (checklistsRes.data || []).map((c: any) => ({
        ...c,
        items: Array.isArray(c.items) ? c.items : [],
      }));

      setUsers(usersRes.data as User[]);
      setChecklists(processedChecklists as unknown as Checklist[]);
      setTasks(tasksRes.data as unknown as Task[]);
      const processedTemplates = (templatesRes.data || []).map((t: any) => ({
        ...t,
        items: Array.isArray(t.items) ? t.items : [],
      }));
      setChecklistTemplates(processedTemplates as unknown as ChecklistTemplate[]);
      setOutlets(outletsRes.data as Outlet[]);
    } catch (error: any) {
      console.error("Error fetching data:", error);
      const errorMessage = error?.message || "An unknown error occurred. See console for details.";
      alert(`Failed to load application data: ${errorMessage}\n\nPlease check your Supabase connection and that the database schema from README.md has been applied correctly.`);
    } finally {
      setIsLoading(false);
      setHasLoaded(true);
    }
  }, [hasLoaded]);

  useEffect(() => {
    // Fetch data only after user is authenticated
    if (currentUser && !hasLoaded) {
      fetchData();
    }
  }, [currentUser, fetchData, hasLoaded]);



  useEffect(() => {
    const onVisibilityChange = () => {
      if (!document.hidden) {
        const activeChecklistId = sessionStorage.getItem('activeChecklistId') || localStorage.getItem('activeChecklistId');
        if (activeChecklistId) {
          const found = checklists.find(c => c.id === activeChecklistId);
          if (found) {
            setSelectedChecklist(found);
            safeSetView('checklists');
          }
        }
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [checklists, safeSetView]);

  // FIX: This effect handles the "reload after camera" issue.
  // If the app reloads and we have an active checklist ID in sessionStorage, this effect
  // finds that checklist and restores it to the state, putting the user back where they were.
  useEffect(() => {
    if (checklists.length > 0 && !selectedChecklist) {
      const activeChecklistId = sessionStorage.getItem('activeChecklistId') || localStorage.getItem('activeChecklistId');
      if (activeChecklistId) {
        const found = checklists.find(c => c.id === activeChecklistId);
        if (found) {
          setSelectedChecklist(found);
          safeSetView('checklists');
        } else {
          sessionStorage.removeItem('activeChecklistId');
          localStorage.removeItem('activeChecklistId');
        }
      }
    }
  }, [checklists, selectedChecklist]);

  useEffect(() => {
    const activeChecklistId = sessionStorage.getItem('activeChecklistId') || localStorage.getItem('activeChecklistId');
    if (activeChecklistId && view !== 'checklists') {
      safeSetView('checklists');
    } else {
      const templateActive = localStorage.getItem('templateDraftActive') === '1';
      if (templateActive && view !== 'templates') {
        safeSetView('templates');
      }
    }
  }, [view]);

  const handleLogout = useCallback(async () => {
    try {
      await signOut();
    } catch { }
    sessionStorage.removeItem('activeChecklistId');
    setCurrentUser(null);
    setHasLoaded(false);
  }, [signOut]);

  const handleSelectChecklist = useCallback((checklist: Checklist) => {
    setSelectedChecklist(checklist);
    safeSetView('checklists');
    // FIX: Save the active checklist ID to session storage. This allows us to restore the
    // state if the page reloads, which is common on mobile after using the camera.
    sessionStorage.setItem('activeChecklistId', checklist.id);
    localStorage.setItem('activeChecklistId', checklist.id);
  }, []);

  const handleBackToList = useCallback(() => {
    // FIX: Comprehensive cleanup of session storage for the specific checklist
    // being exited. This prevents stale data from persisting.
    if (selectedChecklist) {
      sessionStorage.removeItem(`checklistState_${selectedChecklist.id}`);
      sessionStorage.removeItem(`checklistIndex_${selectedChecklist.id}`);
    }
    sessionStorage.removeItem('activeChecklistId');
    localStorage.removeItem('activeChecklistId');

    setSelectedChecklist(null);
    safeSetView(currentUser?.role === Role.Admin ? 'admin_dashboard' : 'auditor_dashboard');
  }, [currentUser, selectedChecklist]);

  const handleAddUser = async (newUser: Omit<User, 'id' | 'avatar_url'>) => {
    // User creation is now handled via Supabase Auth. This function is for profiles.
    // However, the trigger handles profile creation. This function is now effectively deprecated
    // but kept for compatibility with the UserManagementView. A better approach would be to invite users.
    alert("User creation should be done via Supabase Authentication dashboard for security. See README.");
  };

  const handleUpdateUser = async (updatedUser: User) => {
    const { id, ...updateData } = updatedUser;
    // FIX: The Supabase client seems to have trouble with type inference for update payloads.
    // Casting `from('users')` to `any` forces the `update` method to accept any object,
    // which resolves the "not assignable to never" error. This pattern is used
    // elsewhere in this file for `insert` and `upsert` operations.
    let data: any = null;
    let error: any = null;
    try {
      const sets = Object.keys(updateData).map(k => `${k} = ?`).join(', ');
      const values = Object.values(updateData);
      await turso.execute({ sql: `UPDATE users SET ${sets} WHERE id = ?`, args: [...values, id] });
      const res = await turso.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [id] });
      data = res.rows;
    } catch (e: any) { error = e; }
    if (error) {
      alert(`Error updating user: ${error.message}`);
    } else if (data) {
      setUsers(prev => prev.map(u => u.id === updatedUser.id ? data[0] as User : u));
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (currentUser?.id === userId) {
      alert("You cannot delete your own account.");
      return;
    }
    // Deleting from auth.users is a protected operation, best done server-side or in the dashboard.
    // This will only delete the public profile.
    if (window.confirm('Are you sure you want to delete this user profile? This action cannot be undone.')) {
      let error: any = null;
      try { await turso.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [userId] }); }
      catch (e: any) { error = e; }
      if (error) {
        alert(`Error deleting user: ${error.message}`);
      } else {
        setUsers(prev => prev.filter(u => u.id !== userId));
      }
    }
  };

  const handleSaveTemplate = async (template: ChecklistTemplate) => {
    const normalizedItems = (template.items || []).map((item: any) => ({
      id: item.id,
      question: item.question || '',
      type: item.type,
      options: Array.isArray(item.options) ? item.options : [],
      required: !!item.required,
      requireNote: !!item.requireNote,
      minPhotos: typeof item.minPhotos === 'number' ? item.minPhotos : 0,
      photoSource: item.photoSource === 'upload' ? 'upload' : 'live',
      evidenceType: item.evidenceType || 'photo',
    }));

    const payload = {
      id: template.id || undefined,
      title: template.title,
      items: normalizedItems,
    };

    let data: any = null;
    let error: any = null;
    try {
      const itemsJson = JSON.stringify(payload.items);
      const isUpdate = payload.id !== undefined;
      // SQLite doesn't have standard UPSERT easily without knowing fields. Since ID is uuid, we do replace or insert.
      // But we just use explicit UPDATE or INSERT
      let newId = payload.id;
      if (isUpdate) {
        await turso.execute({ sql: 'UPDATE checklist_templates SET title = ?, items = ? WHERE id = ?', args: [payload.title, itemsJson, payload.id] });
      } else {
        newId = crypto.randomUUID();
        await turso.execute({ sql: 'INSERT INTO checklist_templates (id, title, items) VALUES (?, ?, ?)', args: [newId, payload.title, itemsJson] });
      }
      const res = await turso.execute({ sql: 'SELECT * FROM checklist_templates WHERE id = ?', args: [newId] });
      data = res.rows[0];
      if (data && typeof data.items === 'string') data.items = JSON.parse(data.items);
    } catch (e: any) { error = e; }
    if (error) {
      alert(`Error saving template: ${error.message}`);
    } else if (data) {
      setChecklistTemplates(prev => {
        const index = prev.findIndex(t => t.id === data.id);
        if (index > -1) {
          const newTemplates = [...prev];
          newTemplates[index] = data as ChecklistTemplate;
          return newTemplates;
        }
        return [...prev, data as ChecklistTemplate];
      });
      alert('Template saved successfully!');
    }
  };

  const handleAddOutlet = async (newOutlet: Omit<Outlet, 'id'>) => {
    let data: any = null;
    let error: any = null;
    try {
      const keys = Object.keys(newOutlet).join(', ');
      const placeholders = Object.keys(newOutlet).map(() => '?').join(', ');
      const values = Object.values(newOutlet);
      const newId = crypto.randomUUID();
      await turso.execute({ sql: `INSERT INTO outlets (id, ${keys}) VALUES (?, ${placeholders})`, args: [newId, ...values] as (string | number | boolean | null)[] });
      const res = await turso.execute({ sql: 'SELECT * FROM outlets WHERE id = ?', args: [newId] });
      data = res.rows[0];
    } catch (e: any) { error = e; }
    if (error) {
      alert(`Error adding outlet: ${error.message}`);
    } else if (data) {
      setOutlets(prev => [...prev, data as Outlet]);
    }
  };

  const handleUpdateOutlet = async (updatedOutlet: Outlet) => {
    const { id, ...updateData } = updatedOutlet;
    let data: any = null;
    let error: any = null;
    try {
      const sets = Object.keys(updateData).map(k => `${k} = ?`).join(', ');
      const values = Object.values(updateData);
      await turso.execute({ sql: `UPDATE outlets SET ${sets} WHERE id = ?`, args: [...values, id] as (string | number | boolean | null)[] });
      const res = await turso.execute({ sql: 'SELECT * FROM outlets WHERE id = ?', args: [id] });
      data = res.rows[0];
    } catch (e: any) { error = e; }
    if (error) {
      alert(`Error updating outlet: ${error.message}`);
    } else if (data) {
      setOutlets(prev => prev.map(o => o.id === updatedOutlet.id ? data as Outlet : o));
    }
  };

  const handleDeleteOutlet = async (outletId: string) => {
    if (window.confirm('Are you sure you want to delete this outlet?')) {
      let error: any = null;
      try { await turso.execute({ sql: 'DELETE FROM outlets WHERE id = ?', args: [outletId] }); }
      catch (e: any) { error = e; }
      if (error) {
        alert(`Error deleting outlet: ${error.message}`);
      } else {
        setOutlets(prev => prev.filter(o => o.id !== outletId));
      }
    }
  };

  const handleCreateAssignments = async (auditorId: string, outletIds: string[], templateIds: string[], dueDate: string) => {
    const newChecklists: Omit<Checklist, 'id' | 'created_at'>[] = [];
    const targetOutlets = outlets.filter(o => outletIds.includes(o.id));
    const targetTemplates = checklistTemplates.filter(t => templateIds.includes(t.id));

    for (const outlet of targetOutlets) {
      for (const template of targetTemplates) {
        newChecklists.push({
          title: template.title,
          location: outlet.name,
          assigned_to: auditorId,
          due_date: dueDate,
          status: 'pending',
          // FIX: Replaced the spread operator (`...item`) with explicit property definitions for every field.
          // This creates a 100% consistent JSON structure for the `items` array, preventing `undefined` values
          // from being sent to the database. This is the definitive fix for the misleading schema cache error
          // on `report_url` which was caused by an inconsistent JSON payload.
          items: template.items.map((item: ChecklistItemBase): ChecklistItem => ({
            // Fields from ChecklistItemBase
            id: item.id,
            question: item.question,
            type: item.type,
            options: item.options || [],
            required: item.required,
            requireNote: item.requireNote || false,
            minPhotos: item.minPhotos || 0,
            photoSource: item.photoSource || 'live',
            evidenceType: item.evidenceType || 'photo',

            // Fields from ChecklistItem
            value: null,
            photoEvidence: [],
            finding: null,
            finding_id: null,
            aiAnalysisResult: '',
            aiAnalysisStatus: 'idle',
            note: '',
          })),
          check_in_time: null,
          check_out_time: null,
          auditor_signature: null,
          report_url: null,
        });
      }
    }

    if (newChecklists.length > 0) {
      let data: any = null;
      let error: any = null;
      try {
        data = [];
        for (const cl of newChecklists) {
          const clId = crypto.randomUUID();
          const keys = Object.keys(cl).filter(k => k !== 'items').join(', ');
          const placeholders = Object.keys(cl).filter(k => k !== 'items').map(() => '?').join(', ');
          const values = Object.keys(cl).filter(k => k !== 'items').map(k => (cl as any)[k]);
          await turso.execute({ sql: `INSERT INTO checklists (id, items, ${keys}) VALUES (?, ?, ${placeholders})`, args: [clId, JSON.stringify(cl.items), ...values] });
          const res = await turso.execute({ sql: 'SELECT * FROM checklists WHERE id = ?', args: [clId] });
          const inserted = res.rows[0];
          if (inserted && typeof inserted.items === 'string') inserted.items = JSON.parse(inserted.items);
          data.push(inserted);
        }
      } catch (e: any) { error = e; }
      if (error) {
        alert(`Error creating assignments: ${error.message}`);
      } else if (data) {
        setChecklists(prev => [...prev, ...data as Checklist[]]);
        alert(`Successfully created ${data.length} new checklist(s).`);
      }
    }
  };

  const uploadFile = async (bucket: string, file: Blob | File, fileName: string): Promise<string> => {
    return await uploadPublic(bucket, file, fileName);
  };

  const handleChecklistSubmit = async (completedChecklist: Checklist) => {
    let progress = 0;
    const totalSteps = completedChecklist.items.reduce((acc, item) => acc + (item.photoEvidence?.length || 0), 0) + 4; // photos + PDF gen + signature upload + PDF upload + final save

    const updateProgress = (message: string) => {
      progress++;
      setSubmissionProgress({ message, progress: (progress / totalSteps) * 100 });
    };

    try {
      setSubmissionProgress({ message: "Starting submission...", progress: 0 });

      // Upload signature
      updateProgress("Uploading signature...");
      let signatureUrl = completedChecklist.auditor_signature;
      if (signatureUrl && !signatureUrl.startsWith('http')) {
        const signatureBlob = base64ToBlob(signatureUrl, 'image/png');
        signatureUrl = await uploadFile('field-ops-photos', signatureBlob, `signatures/${completedChecklist.id}_${Date.now()}.png`);
      }
      let selfieUrl = completedChecklist.auditor_selfie;
      if (selfieUrl && !selfieUrl.startsWith('http')) {
        const selfieBlob = base64ToBlob(selfieUrl, 'image/jpeg');
        selfieUrl = await uploadFile('field-ops-photos', selfieBlob, `selfies/${completedChecklist.id}_${Date.now()}.jpg`);
      }

      // Create a new checklist object with uploaded photo URLs
      const checklistForDb = JSON.parse(JSON.stringify(completedChecklist));
      checklistForDb.auditor_signature = signatureUrl;
      checklistForDb.auditor_selfie = selfieUrl;
      checklistForDb.items = (Array.isArray(checklistForDb.items) ? checklistForDb.items : [])
        .filter(Boolean)
        .map((it: any) => ({
          ...it,
          evidenceType: it?.evidenceType || 'photo',
          photoEvidence: Array.isArray(it?.photoEvidence) ? it.photoEvidence : [],
        }));

      // Upload all photo evidence
      for (const item of checklistForDb.items as ChecklistItem[]) {
        if (item.photoEvidence && item.photoEvidence.length > 0) {
          const uploadedPhotoUrls: string[] = [];
          for (const photo of item.photoEvidence) {
            updateProgress(`Uploading photo for "${item.question.substring(0, 20)}..."`);
            // Check if it's already a URL (e.g. from previous edit)
            if (photo && !photo.startsWith('http')) {
              // Determine mime type based on evidence type
              const mimeType = item.evidenceType === 'video' ? 'video/webm' : 'image/jpeg';
              const ext = item.evidenceType === 'video' ? 'webm' : 'jpg';
              const blob = base64ToBlob(photo, mimeType);
              const url = await uploadFile('field-ops-photos', blob, `evidence/${completedChecklist.id}_${item.id}_${Date.now()}.${ext}`);
              uploadedPhotoUrls.push(url);
            } else if (photo) {
              uploadedPhotoUrls.push(photo);
            }
          }
          item.photoEvidence = uploadedPhotoUrls;
        }
      }

      // Generate PDF report (Moved after uploads to ensure links work)
      updateProgress("Generating PDF report...");
      const pdfBlob = await generateAuditReportPDF(checklistForDb, currentUser, LOGO_URL);

      // Upload the PDF report
      updateProgress("Uploading PDF report...");

      // Generate filename based on Auditor, Location, and Date
      const auditorName = currentUser?.name?.replace(/\s+/g, '_') || 'Auditor';
      const locationName = checklistForDb.location?.replace(/\s+/g, '_') || 'Location';
      const dateStr = new Date().toISOString().split('T')[0];
      // Append short ID to ensure uniqueness
      const fileName = `reports/${auditorName}_${locationName}_${dateStr}_${completedChecklist.id.slice(0, 6)}.pdf`;

      const reportUrl = await uploadFile('field-ops-reports', pdfBlob, fileName);
      checklistForDb.report_url = reportUrl;

      // Save new findings (tasks) using the final photo URLs
      const newTasks: Omit<Task, 'id' | 'created_at'>[] = [];
      for (const item of checklistForDb.items) {
        if (item.finding) {
          const { id, ...newTaskData } = item.finding;
          if (item.photoEvidence && item.photoEvidence.length > 0) {
            newTaskData.photo = item.photoEvidence[0];
          }
          newTasks.push(newTaskData);
        }
      }

      if (newTasks.length > 0) {
        updateProgress("Saving new findings...");
        let createdTasks: any = null;
        let taskError: any = null;
        try {
          createdTasks = [];
          for (const task of newTasks) {
            const taskId = crypto.randomUUID();
            const keys = Object.keys(task).join(', ');
            const placeholders = Object.keys(task).map(() => '?').join(', ');
            const values = Object.values(task);
            await turso.execute({ sql: `INSERT INTO tasks (id, ${keys}) VALUES (?, ${placeholders})`, args: [taskId, ...values] });
            const res = await turso.execute({ sql: 'SELECT * FROM tasks WHERE id = ?', args: [taskId] });
            createdTasks.push(res.rows[0]);
          }
        } catch (e: any) { taskError = e; }
        if (taskError) throw new Error(`Could not save new findings: ${taskError.message}`);
        if (createdTasks) {
          setTasks(prev => [...prev, ...createdTasks as Task[]]);
          // Associate created task IDs back to checklist items
          createdTasks.forEach((task: Task) => {
            const item = checklistForDb.items.find((i: ChecklistItem) => i.id === task.checklist_item_id);
            if (item) item.finding_id = task.id;
          });
        }
      }

      // Finalize and save the checklist data with all new URLs
      updateProgress("Finalizing checklist data...");
      const { id, auditor_selfie, ...updateData } = checklistForDb;
      let data: any = null;
      let error: any = null;
      try {
        const updateDataDb = { ...updateData, items: JSON.stringify(updateData.items) };
        const sets = Object.keys(updateDataDb).map(k => `${k} = ?`).join(', ');
        const values = Object.values(updateDataDb);
        await turso.execute({ sql: `UPDATE checklists SET ${sets} WHERE id = ?`, args: [...values, id] });
        const res = await turso.execute({ sql: 'SELECT * FROM checklists WHERE id = ?', args: [id] });
        data = res.rows[0];
        if (data && typeof data.items === 'string') data.items = JSON.parse(data.items);
      } catch (e: any) { error = e; }
      if (error) {
        throw new Error(`Failed to save checklist: ${error.message}`);
      }

      setChecklists(prev => prev.map(c => c.id === id ? data as Checklist : c));

      // Trigger WhatsApp Notification (Non-blocking but feedback aware)
      let waStatusMessage = '';
      if (reportUrl) {
        updateProgress("Sending report via WhatsApp...");
        try {
          const resWa = await turso.execute('SELECT phone_number FROM whatsapp_recipients');
          const targetNumbers = resWa.rows.map((r: any) => r.phone_number as string);
          
          if (targetNumbers.length > 0) {
            const waMessage = `≡ƒôï *Laporan Audit Baru* ≡ƒôï\n\n*Outlet:* ${checklistForDb.outletName}\n*Auditor:* ${currentUser?.name || currentUser?.email}\n*Waktu:* ${new Date().toLocaleString('id-ID')}\n\nLaporan lengkap dapat diunduh pada tautan berikut.`;
            const success = await sendWhatsAppMessage({
              targets: targetNumbers,
              message: waMessage,
              fileUrl: reportUrl
            });
            if (!success) waStatusMessage = `\n(Warning: Failed to send WhatsApp notification. Please check Fonnte config.)`;
          }
        } catch (err: any) {
          console.error("Failed to trigger WhatsApp notification:", err);
          waStatusMessage = `\n(Warning: Error triggering WhatsApp notification)`;
        }
      }

      alert(`Checklist submitted successfully!${waStatusMessage}`);

      sessionStorage.removeItem(`checklistState_${completedChecklist.id}`);
      sessionStorage.removeItem(`checklistIndex_${completedChecklist.id}`);

      handleBackToList();
    } catch (error: unknown) {
      console.error("Submission failed:", error);
      let errorMessage = "An unknown error occurred. Please check the console for details.";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (error && typeof error === 'object' && 'message' in (error as any)) {
        errorMessage = String((error as { message: string }).message);
      }
      alert(`Submission failed: ${errorMessage}`);
    } finally {
      setSubmissionProgress(null);
    }
  };

  const handleResolveTask = async (taskId: string, resolutionData: { photo: string; comment?: string }) => {
    const photoBlob = base64ToBlob(resolutionData.photo, 'image/jpeg');
    const proofUrl = await uploadFile('field-ops-photos', photoBlob, `proofs/${taskId}_${Date.now()}.jpg`);

    const existing = tasks.find(t => t.id === taskId);
    const resolutionNote = resolutionData.comment?.trim();
    const combinedDescription = [existing?.description, resolutionNote ? `Resolution: ${resolutionNote}` : undefined]
      .filter(Boolean)
      .join('\n\n');

    const updatePayload = {
      proof_of_fix: proofUrl,
      status: 'resolved' as 'resolved',
      description: combinedDescription || existing?.description || null,
    };

    let data: any = null;
    let error: any = null;
    try {
      const sets = Object.keys(updatePayload).map(k => `${k} = ?`).join(', ');
      const values = Object.values(updatePayload);
      await turso.execute({ sql: `UPDATE tasks SET ${sets} WHERE id = ?`, args: [...values, taskId] });
      const res = await turso.execute({ sql: 'SELECT * FROM tasks WHERE id = ?', args: [taskId] });
      data = res.rows[0];
    } catch (e: any) { error = e; }

    if (error) {
      alert(`Error resolving task: ${error.message}`);
      throw error;
    }

    if (data) {
      setTasks(prev => prev.map(t => t.id === taskId ? data as Task : t));
    }
  };

  const handleUpdateAssignment = async (checklistId: string, updates: Partial<Checklist>) => {
    let data: any = null;
    let error: any = null;
    try {
      const updateDataDb = { ...updates };
      if (updateDataDb.items) updateDataDb.items = JSON.stringify(updateDataDb.items) as any;
      const sets = Object.keys(updateDataDb).map(k => `${k} = ?`).join(', ');
      const values = Object.values(updateDataDb);
      await turso.execute({ sql: `UPDATE checklists SET ${sets} WHERE id = ?`, args: [...values, checklistId] as (string | number | boolean | null)[] });
      const res = await turso.execute({ sql: 'SELECT * FROM checklists WHERE id = ?', args: [checklistId] });
      data = res.rows[0];
      if (data && typeof data.items === 'string') data.items = JSON.parse(data.items);
    } catch (e: any) { error = e; }
    if (error) {
      alert(`Error updating assignment: ${error.message}`);
      throw error;
    }
    if (data) {
      setChecklists(prev => prev.map(c => c.id === checklistId ? data as Checklist : c));
    }
  };

  const handleCancelAssignment = async (checklistId: string) => {
    let error: any = null;
    try { await turso.execute({ sql: 'DELETE FROM checklists WHERE id = ?', args: [checklistId] }); }
    catch (e: any) { error = e; }
    if (error) {
      alert(`Error canceling assignment: ${error.message}`);
      throw error;
    }
    setChecklists(prev => prev.filter(c => c.id !== checklistId));
  };

  // Persist last view across renders; must be declared before any early returns
  useEffect(() => {
    try {
      localStorage.setItem('lastView', view);
    } catch { }
  }, [view]);



  const handleAssignTask = async (taskId: string, assigneeId: string | null) => {
    let data: any = null;
    let error: any = null;
    try {
      await turso.execute({ sql: `UPDATE tasks SET assigned_to = ? WHERE id = ?`, args: [assigneeId, taskId] });
      const res = await turso.execute({ sql: 'SELECT * FROM tasks WHERE id = ?', args: [taskId] });
      data = res.rows[0];
    } catch (e: any) { error = e; }

    if (error) {
      alert(`Error assigning task: ${error.message}`);
      throw error;
    }

    if (data) {
      setTasks(prev => prev.map(t => t.id === taskId ? data as Task : t));
    }
  };

  if (isAuthLoading) {
    return <LoadingSpinner message="Checking authentication..." />;
  }

  if (!currentUser) {
    return <LoginPage />;
  }

  if (isLoading && !hasLoaded) {
    return <LoadingSpinner />;
  }

  const renderView = () => {
    switch (view) {
      case 'admin_dashboard':
        return <AdminDashboardView setView={safeSetView} users={users} outlets={outlets} templates={checklistTemplates} checklists={checklists} />;
      case 'auditor_dashboard':
        return <AuditorDashboardView user={currentUser} onSelectChecklist={handleSelectChecklist} checklists={checklists} tasks={tasks} users={users} onResolveTask={handleResolveTask} />;
      case 'checklists':
        return selectedChecklist
          ? <ChecklistView checklist={selectedChecklist} onBack={handleBackToList} onSubmit={handleChecklistSubmit} onLogout={handleLogout} isSubmitting={!!submissionProgress} outlets={outlets} />
          : <LoadingSpinner message="Restoring checklist..." />;







      case 'findings':
        const findingsChecklists = currentUser?.role === Role.Auditor
          ? checklists.filter(c => c.assigned_to === currentUser.id)
          : checklists;
        const findingsChecklistIdSet = new Set(findingsChecklists.map(c => c.id));
        const findingsTasks = currentUser?.role === Role.Auditor
          ? tasks.filter(t => (t.checklist_id && findingsChecklistIdSet.has(t.checklist_id)) || t.assigned_to === currentUser.id)
          : tasks;
        const canAssign = currentUser?.role === Role.Admin;
        const onAssignTask = canAssign ? handleAssignTask : async () => { alert('Not allowed'); };
        return <FindingsView tasks={findingsTasks} checklists={findingsChecklists} users={users} onResolveTask={handleResolveTask} onAssignTask={onAssignTask} canAssign={canAssign} />;
      case 'reports':
        const reportChecklists = currentUser?.role === Role.Auditor
          ? checklists.filter(c => c.assigned_to === currentUser.id)
          : checklists;
        return <ReportsView checklists={reportChecklists} users={users} />;
      case 'missed_reports':
        return <MissedReportsView checklists={checklists} users={users} onBack={() => safeSetView('admin_dashboard')} />;
      case 'whatsapp_config':
        return <WhatsAppConfigView />;
      case 'user_management':
        return <UserManagementView users={users} onAddUser={handleAddUser} onUpdateUser={handleUpdateUser} onDeleteUser={handleDeleteUser} />;
      case 'templates':
        return <TemplateEditorView templates={checklistTemplates} onSave={handleSaveTemplate} />;
      case 'outlet_management':
        return <OutletManagementView outlets={outlets} users={users} onAddOutlet={handleAddOutlet} onUpdateOutlet={handleUpdateOutlet} onDeleteOutlet={handleDeleteOutlet} />;
      case 'assignments':
        return <AssignmentView users={users} outlets={outlets} templates={checklistTemplates} checklists={checklists} onCreateAssignments={handleCreateAssignments} onUpdateAssignment={handleUpdateAssignment} onCancelAssignment={handleCancelAssignment} onCancel={() => safeSetView('admin_dashboard')} />;
      default:
        return <div>Not implemented</div>;
    }
  };



  if (view === 'checklists' && selectedChecklist) {
    return (
      <>
        {submissionProgress && <ProgressOverlay message={submissionProgress.message} progress={submissionProgress.progress} />}
        <ChecklistView checklist={selectedChecklist} onBack={handleBackToList} onSubmit={handleChecklistSubmit} onLogout={handleLogout} isSubmitting={!!submissionProgress} outlets={outlets} />
      </>
    );
  }

  return (
    <div className="flex h-screen bg-base-200">
      {submissionProgress && <ProgressOverlay message={submissionProgress.message} progress={submissionProgress.progress} />}
      <Sidebar
        currentView={view}
        setView={safeSetView}
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
        user={currentUser}
        onLogout={handleLogout}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header user={currentUser} onMenuClick={() => setSidebarOpen(true)} onLogout={handleLogout} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-6">
          {renderView()}
        </main>
      </div>
    </div>
  );
};

export default App;
