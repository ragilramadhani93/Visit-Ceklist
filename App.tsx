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
import { LogIn, LoaderCircle } from 'lucide-react';
import Card from './components/shared/Card';
import Button from './components/shared/Button';
import { supabase } from './services/supabaseClient';
import { base64ToBlob } from './utils/fileUtils';
import { generateAuditReportPDF } from './services/pdfService';
import ProgressOverlay from './components/shared/ProgressOverlay';
import type { Session } from '@supabase/supabase-js';

const LOGO_URL = (import.meta as any).env?.VITE_LOGO_URL || "https://xkzmddgcwcqvhicdqrpa.supabase.co/storage/v1/object/public/field-ops-photos/viLjdYG8hKmB34Y0CZFvFTm8BWcavvRr5B05IUl1%20(1).jpg";


const LoginPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [logoSrc, setLogoSrc] = useState<string>(LOGO_URL);
    const [sanitizedTried, setSanitizedTried] = useState(false);
    const sanitizeUrl = (url: string) => url.replace(/\(/g, '%28').replace(/\)/g, '%29');

    useEffect(() => {
        const loginError = sessionStorage.getItem('loginError');
        if (loginError) {
            setError(loginError);
            sessionStorage.removeItem('loginError');
        }
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            // The onAuthStateChange listener in App.tsx will handle the redirect.
        } catch (err: any) {
            setError(err.error_description || err.message || "An unknown error occurred.");
        }
        setLoading(false);
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-base-200">
            <Card className="w-full max-w-sm text-center shadow-2xl p-8">
                {logoSrc ? (
                  <img
                    src={logoSrc}
                    alt="Kapal Api Coffee Corner Logo"
                    className="mx-auto w-48 mb-6"
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
                  <div className="mx-auto w-48 h-16 mb-6 flex items-center justify-center text-neutral font-semibold">
                    Kapal Api Coffee Corner
                  </div>
                )}
                <h1 className="text-2xl font-bold text-neutral mb-2">Welcome Back</h1>
                <p className="text-gray-600 mb-6">Please sign in to continue</p>
                <form onSubmit={handleLogin} className="space-y-4 text-left">
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email Address</label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                        />
                    </div>
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                        />
                    </div>
                    {error && <p className="text-sm text-center text-error">{error}</p>}
                    <Button type="submit" isLoading={loading} className="w-full !py-3 !text-lg transition-transform transform hover:scale-105">
                        <LogIn className="mr-2" /> Sign In
                    </Button>
                </form>
            </Card>
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
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [view, setView] = useState<View>('auditor_dashboard');
  const [selectedChecklist, setSelectedChecklist] = useState<Checklist | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [submissionProgress, setSubmissionProgress] = useState<{ message: string; progress: number } | null>(null);

  const safeSetView = useCallback((next: View) => {
    if (currentUser?.role === Role.Auditor) {
      const adminOnlyViews = new Set(['admin_dashboard','assignments','findings','reports','user_management','templates','outlet_management']);
      if (adminOnlyViews.has(next)) {
        setView('auditor_dashboard');
        return;
      }
    }
    setView(next);
  }, [currentUser]);

  // Fetch user profile and set view based on role
  const setupUserSession = useCallback(async (userId: string, userEmail?: string) => {
    const fetchUserProfileWithRetry = async (retries = 3, delay = 500): Promise<User | null> => {
      for (let i = 0; i < retries; i++) {
        const { data: userProfile, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single();

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
        const { data: newUserProfile, error: insertError } = await (supabase.from('users') as any)
          .insert({ id: userId, email: userEmail, role: Role.Auditor }) // Sensible defaults
          .select()
          .single();

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
              const validViews = new Set(['checklists','findings','reports','admin_dashboard','auditor_dashboard','user_management','templates','outlet_management','assignments']);
              const adminOnlyViews = new Set(['admin_dashboard','assignments','findings','reports','user_management','templates','outlet_management']);
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
          } catch (_) { /* noop */ }
        }
    }
  }, []);

  // FIX: This new `useEffect` provides a more robust authentication flow. It handles the initial
  // session check, listens for auth changes, and crucially, adds a 'pageshow' event listener.
  // This listener re-validates the session when a user navigates back to the page using the
  // browser's back button, which prevents the app from getting stuck in a loading state due
  // to the browser's back/forward cache (bfcache).
  useEffect(() => {
    // This flag ensures the onAuthStateChange listener doesn't clash with the initial getSession call.
    let initialCheckComplete = false;

    // A centralized function to handle setting the user state based on a session.
    const handleSession = async (session: Session | null) => {
        try {
            if (session?.user) {
                // If there's a user in the session, set up their profile.
                await setupUserSession(session.user.id, session.user.email);
            } else {
                // If no session or user, clear the current user state.
                setCurrentUser(null);
            }
        } catch (error) {
            console.error("Error handling user session:", error);
            setCurrentUser(null); // Ensure user is logged out on any error.
        } finally {
            // This is crucial: turn off the initial "Checking authentication..." spinner
            // only after the very first check is complete.
            if (!initialCheckComplete) {
                setIsAuthLoading(false);
                initialCheckComplete = true;
            }
        }
    };

    // 1. Perform an initial check for the user's session when the app loads.
    supabase.auth.getSession().then(({ data: { session } }) => {
        handleSession(session);
    }).catch(error => {
        // This would be a critical failure, e.g., network error.
        console.error("Critical error on initial getSession():", error);
        handleSession(null); // Treat as logged out.
    });

    // 2. Listen for any subsequent changes in the authentication state (login, logout).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        // Once the initial check is done, this listener takes over.
        if (initialCheckComplete) {
            handleSession(session);
        }
    });

    // 3. Add a listener to handle the page being restored from the browser's back/forward cache (bfcache).
    const handlePageShow = (event: PageTransitionEvent) => {
        // The 'persisted' property is true if the page is from bfcache.
        if (event.persisted) {
            console.log("Page restored from bfcache. Re-checking auth status.");
            // The session might be stale, so we re-fetch it.
            supabase.auth.getSession().then(({ data: { session } }) => {
                handleSession(session);
            });
        }
    };

    window.addEventListener('pageshow', handlePageShow);

    // Cleanup function to remove listeners when the component unmounts.
    return () => {
        subscription.unsubscribe();
        window.removeEventListener('pageshow', handlePageShow);
    };
  }, [setupUserSession]);
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
        const [usersRes, checklistsRes, tasksRes, templatesRes, outletsRes] = await Promise.all([
            supabase.from('users').select('*'),
            supabase.from('checklists').select('*'),
            supabase.from('tasks').select('*'),
            supabase.from('checklist_templates').select('*'),
            supabase.from('outlets').select('*'),
        ]);

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
    }
  }, []);

  useEffect(() => {
    // Fetch data only after user is authenticated
    if (currentUser) {
        fetchData();
    }
  }, [currentUser, fetchData]);
  
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
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('sb-') && key.includes('auth-token')) {
            localStorage.removeItem(key);
          }
        }
      } catch (_) {}
      sessionStorage.removeItem('activeChecklistId');
      setCurrentUser(null);
  }, []);

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
    const { data, error } = await (supabase.from('users') as any).update(updateData).eq('id', id).select();
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
        const { error } = await supabase.from('users').delete().eq('id', userId);
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

    const { data, error } = await (supabase.from('checklist_templates') as any)
      .upsert(payload)
      .select()
      .single();
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
    const { data, error } = await (supabase.from('outlets') as any)
      .insert(newOutlet)
      .select()
      .single();
    if (error) {
      alert(`Error adding outlet: ${error.message}`);
    } else if (data) {
      setOutlets(prev => [...prev, data as Outlet]);
    }
  };

  const handleUpdateOutlet = async (updatedOutlet: Outlet) => {
    const { id, ...updateData } = updatedOutlet;
    const { data, error } = await (supabase.from('outlets') as any)
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    if (error) {
      alert(`Error updating outlet: ${error.message}`);
    } else if (data) {
      setOutlets(prev => prev.map(o => o.id === updatedOutlet.id ? data as Outlet : o));
    }
  };

  const handleDeleteOutlet = async (outletId: string) => {
    if (window.confirm('Are you sure you want to delete this outlet?')) {
      const { error } = await supabase.from('outlets').delete().eq('id', outletId);
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
      const { data, error } = await (supabase.from('checklists') as any)
        .insert(newChecklists)
        .select();
      if (error) {
        alert(`Error creating assignments: ${error.message}`);
      } else if (data) {
        setChecklists(prev => [...prev, ...data as Checklist[]]);
        alert(`Successfully created ${data.length} new checklist(s).`);
      }
    }
  };

  const uploadFile = async (bucket: string, file: Blob | File, fileName: string): Promise<string> => {
    const { data, error } = await supabase.storage.from(bucket).upload(fileName, file, {
        cacheControl: '3600',
        upsert: true,
    });
    if (error) {
        throw new Error(`Storage upload error: ${error.message}`);
    }
    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(data.path);
    return publicUrl;
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

      // Upload all photo evidence
      for (const item of checklistForDb.items) {
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
          const { data: createdTasks, error: taskError } = await (supabase.from('tasks') as any)
              .insert(newTasks)
              .select();
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
      const { data, error } = await (supabase.from('checklists') as any)
          .update(updateData)
          .eq('id', id)
          .select()
          .single();
      if (error) {
        throw new Error(`Failed to save checklist: ${error.message}`);
      }
      
      setChecklists(prev => prev.map(c => c.id === id ? data as Checklist : c));
      alert("Checklist submitted successfully!");
      
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

    const { data, error } = await (supabase.from('tasks') as any)
        .update(updatePayload)
        .eq('id', taskId)
        .select()
        .single();

    if (error) {
        alert(`Error resolving task: ${error.message}`);
        throw error;
    }

    if (data) {
        setTasks(prev => prev.map(t => t.id === taskId ? data as Task : t));
    }
  };

  const handleUpdateAssignment = async (checklistId: string, updates: Partial<Checklist>) => {
    const { data, error } = await (supabase.from('checklists') as any)
      .update(updates)
      .eq('id', checklistId)
      .select()
      .single();
    if (error) {
      alert(`Error updating assignment: ${error.message}`);
      throw error;
    }
    if (data) {
      setChecklists(prev => prev.map(c => c.id === checklistId ? data as Checklist : c));
    }
  };

  const handleCancelAssignment = async (checklistId: string) => {
    const { error } = await supabase.from('checklists').delete().eq('id', checklistId);
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
    } catch (_) { void 0; }
  }, [view]);

  

  if (isAuthLoading) {
    return <LoadingSpinner message="Checking authentication..." />;
  }

  if (!currentUser) {
    return <LoginPage />;
  }

  if (isLoading) {
    return <LoadingSpinner />;
  }
  
  const renderView = () => {
    switch (view) {
      case 'admin_dashboard':
        return <AdminDashboardView setView={setView} users={users} outlets={outlets} templates={checklistTemplates} checklists={checklists} />;
      case 'auditor_dashboard':
        return <AuditorDashboardView user={currentUser} onSelectChecklist={handleSelectChecklist} checklists={checklists} tasks={tasks} users={users} onResolveTask={handleResolveTask} />;
      case 'checklists':
        return selectedChecklist
          ? <ChecklistView checklist={selectedChecklist} onBack={handleBackToList} onSubmit={handleChecklistSubmit} onLogout={handleLogout} isSubmitting={!!submissionProgress} />
          : <LoadingSpinner message="Restoring checklist..." />;
    
  
    
  


  
      case 'findings':
        return <FindingsView tasks={tasks} checklists={checklists} users={users} onResolveTask={handleResolveTask} />;
      case 'reports':
        return <ReportsView checklists={checklists} users={users} />;
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
            <ChecklistView checklist={selectedChecklist} onBack={handleBackToList} onSubmit={handleChecklistSubmit} onLogout={handleLogout} isSubmitting={!!submissionProgress} />
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
