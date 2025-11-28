


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

// IMPORTANT: Upload your logo to Supabase storage and replace this URL. See README for instructions.
const LOGO_URL = "https://xkzmddgcwcqvhicdqrpa.supabase.co/storage/v1/object/public/field-ops-photos/viLjdYG8hKmB34Y0CZFvFTm8BWcavvRr5B05IUl1%20(1).jpg";


const LoginPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

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
        } catch (err: any) {
            setError(err.error_description || err.message || "An unknown error occurred.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-base-200">
            <Card className="w-full max-w-sm text-center shadow-2xl p-8">
                <img src={LOGO_URL} alt="Kapal Api Coffee Corner Logo" className="mx-auto w-48 mb-6" />
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
  const [authTimeout, setAuthTimeout] = useState(false);
  
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [view, setView] = useState<View>('admin_dashboard');
  const [selectedChecklist, setSelectedChecklist] = useState<Checklist | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [submissionProgress, setSubmissionProgress] = useState<{ message: string; progress: number } | null>(null);

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
        
        if (error && error.code !== 'PGRST116') { // 'PGRST116' means 0 rows found
          console.error(`Non-retriable error fetching user profile on attempt ${i + 1}:`, error);
          throw error; // Fail fast on non-retriable errors
        }
        
        await new Promise(res => setTimeout(res, delay * (i + 1)));
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
        if (userProfile.role === Role.Admin) {
            setView('admin_dashboard');
        } else {
            setView('auditor_dashboard');
        }
      } else {
        throw new Error("User profile could not be found or created. This is an unexpected error.");
      }
    } catch (error: any) {
        console.error("Error setting up user session:", error);
        const errorMessage = `Failed to set up session: ${error.message || "An unknown error occurred."}\nPlease check the database permissions or try again.`;
        sessionStorage.setItem('loginError', errorMessage);
        await supabase.auth.signOut({ scope: 'local' });
    }
  }, []);

  // Handle Supabase auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        // FIX: The entire auth change logic is wrapped in a try/finally block.
        // This guarantees that `setIsAuthLoading(false)` is always called, even if
        // `setupUserSession` throws an error. This prevents the app from getting
        // stuck on the "Checking authentication..." screen.
        try {
            if (session?.user) {
                await setupUserSession(session.user.id, session.user.email);
            } else {
                setCurrentUser(null);
            }
        } catch (error) {
            console.error("Error during auth state change handling:", error);
            setCurrentUser(null);
        } finally {
            setIsAuthLoading(false);
        }
    });

    // Check for existing session on initial load
    const checkSession = async () => {
        try {
            const { data: { session }, error } = await supabase.auth.getSession();
            if (error) {
                console.error("Error fetching auth session:", error.message);
                throw error;
            }
            if (session?.user) {
                await setupUserSession(session.user.id, session.user.email);
            }
        } catch (err) {
            console.error("Failed to initialize user session:", err);
            await supabase.auth.signOut({ scope: 'local' });
            setCurrentUser(null);
        } finally {
            // This is crucial: always turn off the auth loading state
            // to prevent the app from getting stuck.
            setIsAuthLoading(false);
        }
    };

    checkSession();

    return () => subscription.unsubscribe();
  }, [setupUserSession]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setIsAuthLoading(false);
    }, 5000);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => setAuthTimeout(true), 3000);
    return () => clearTimeout(timeout);
  }, []);

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
  
  const handleLogout = useCallback(async () => {
      await supabase.auth.signOut({ scope: 'local' });
  }, []);

  const handleSelectChecklist = useCallback((checklist: Checklist) => {
    setSelectedChecklist(checklist);
    setView('checklists');
  }, []);

  const handleBackToList = useCallback(() => {
    setSelectedChecklist(null);
    if (currentUser?.role === Role.Admin) setView('admin_dashboard');
    else setView('auditor_dashboard');
  }, [currentUser]);

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
    if (window.confirm('Are you sure you want to delete this user profile? This does not remove their login credentials.')) {
        const { error } = await supabase.from('users').delete().eq('id', userId);
        if (error) {
            alert(`Error deleting user profile: ${error.message}`);
        } else {
            setUsers(prev => prev.filter(u => u.id !== userId));
        }
    }
  };

  const handleSaveTemplate = async (template: ChecklistTemplate) => {
      // If template.id is falsy (e.g., ''), it will be treated as an insert.
      const templateToSave = { ...template, id: template.id || undefined };
      
      const { data, error } = await (supabase.from('checklist_templates') as any).upsert(templateToSave).select();
      
      if (error) {
        alert(`Error saving template: ${error.message}`);
      } else if (data) {
        const savedTemplate = data[0] as ChecklistTemplate;
        setChecklistTemplates(prev => {
            const exists = prev.some(t => t.id === savedTemplate.id);
            if (exists) return prev.map(t => t.id === savedTemplate.id ? savedTemplate : t);
            return [...prev, savedTemplate];
        });
        alert('Template Saved!');
      }
  };

    const handleAddOutlet = async (outletData: Omit<Outlet, 'id'>) => {
        const { data, error } = await (supabase.from('outlets') as any).insert(outletData).select();
        if (error) {
            alert(`Error adding outlet: ${error.message}`);
        } else if (data) {
            setOutlets(prev => [...prev, data[0] as Outlet]);
        }
    };

    const handleUpdateOutlet = async (updatedOutlet: Outlet) => {
        const { id, ...updateData } = updatedOutlet;
        const { data, error } = await (supabase.from('outlets') as any).update(updateData).eq('id', id).select();
        if (error) {
            alert(`Error updating outlet: ${error.message}`);
        } else if (data) {
            setOutlets(prev => prev.map(o => o.id === updatedOutlet.id ? data[0] as Outlet : o));
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

  const uploadPhoto = async (base64: string): Promise<string> => {
    if (!base64 || base64.startsWith('http')) return base64; // It's null, empty, or already a URL
    try {
        const blob = base64ToBlob(base64);
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.jpg`;
        const { error } = await supabase.storage.from('field-ops-photos').upload(fileName, blob);
        if (error) throw error;
        
        const { data } = supabase.storage.from('field-ops-photos').getPublicUrl(fileName);
        return data.publicUrl;
    } catch (error) {
        console.error("Error uploading file:", error);
        throw error;
    }
  };

  const handleChecklistSubmit = async (updatedChecklist: Checklist) => {
      setSubmissionProgress({ message: 'Starting submission...', progress: 0 });
      try {
        const processedChecklist: Checklist = JSON.parse(JSON.stringify(updatedChecklist));
        
        // --- 1. Photo Uploads (0% -> 50%) ---
        const photosToUpload: {type: string, data: string, updateFn: (url: string) => void}[] = [];

        if (processedChecklist.auditor_signature && !processedChecklist.auditor_signature.startsWith('http')) {
            photosToUpload.push({ type: 'Signature', data: processedChecklist.auditor_signature, updateFn: url => processedChecklist.auditor_signature = url });
        }

        processedChecklist.items.forEach(item => {
            if (item.photoEvidence && Array.isArray(item.photoEvidence)) {
                item.photoEvidence.forEach((photoData, index) => {
                    if (photoData && !photoData.startsWith('http')) {
                        photosToUpload.push({
                            type: 'Evidence',
                            data: photoData,
                            updateFn: url => {
                                // Find the item again in the main object to ensure we're updating the correct reference
                                const targetItem = processedChecklist.items.find(i => i.id === item.id);
                                if (targetItem && targetItem.photoEvidence) {
                                    targetItem.photoEvidence[index] = url;
                                }
                            }
                        });
                    }
                });
            }
            if (item.finding?.photo && !item.finding.photo.startsWith('http')) {
                photosToUpload.push({ type: 'Finding Photo', data: item.finding.photo, updateFn: url => item.finding!.photo = url });
            }
        });
        
        if (photosToUpload.length > 0) {
            for (let i = 0; i < photosToUpload.length; i++) {
                const photo = photosToUpload[i];
                const progress = ((i + 1) / photosToUpload.length) * 50;
                setSubmissionProgress({ message: `Uploading photo ${i + 1} of ${photosToUpload.length}...`, progress });
                const url = await uploadPhoto(photo.data);
                photo.updateFn(url);
            }
        }

        // --- 2. Create Tasks (50% -> 60%) ---
        setSubmissionProgress({ message: 'Saving findings...', progress: 55 });
        const newTasksToCreate: Omit<Task, 'id' | 'proof_of_fix'>[] = [];
        for (const item of processedChecklist.items) {
             if (item.finding) {
                const isNew = !tasks.some(t => t.id === item.finding!.id);
                if (isNew) {
                    const { id: clientSideId, ...findingData } = item.finding;
                    const findingToCreate = { ...findingData, checklist_id: processedChecklist.id };
                    newTasksToCreate.push(findingToCreate as any);
                    item.finding = null;
                }
            }
        }
        
        if (newTasksToCreate.length > 0) {
            const { data: createdTasks, error: tasksError } = await (supabase.from('tasks') as any).insert(newTasksToCreate).select();
            if (tasksError) throw tasksError;
            if (createdTasks) {
                const createdTasksMap = new Map<string, Task>(createdTasks.map(t => [t.checklist_item_id, t]));
                for (const item of processedChecklist.items) {
                    if (createdTasksMap.has(item.id)) {
                        item.finding_id = createdTasksMap.get(item.id)!.id;
                    }
                }
                setTasks(prev => [...prev, ...createdTasks as Task[]]);
            }
        }

        // --- 3. Update Checklist (60% -> 70%) ---
        setSubmissionProgress({ message: 'Finalizing audit data...', progress: 65 });
        const { id, ...updateData } = processedChecklist;
        const { data: savedChecklistData, error } = await (supabase.from('checklists') as any)
          .update(updateData)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        const finalChecklistData = savedChecklistData as unknown as Checklist;
        
        // --- 4. Generate PDF (70% -> 90%) ---
        setSubmissionProgress({ message: 'Generating PDF report...', progress: 75 });
        const auditor = users.find(u => u.id === finalChecklistData.assigned_to);
        const pdfBlob = await generateAuditReportPDF(finalChecklistData, auditor || null, LOGO_URL);
        
        // --- 5. Upload PDF (90% -> 95%) ---
        setSubmissionProgress({ message: 'Uploading report...', progress: 90 });
        const reportFileName = `audit-report-${finalChecklistData.id}.pdf`;
        const { error: uploadError } = await supabase.storage.from('field-ops-reports').upload(reportFileName, pdfBlob, {
            cacheControl: '3600',
            upsert: true
        });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('field-ops-reports').getPublicUrl(reportFileName);
        
        // --- 6. Final Update with Report URL (95% -> 100%) ---
        setSubmissionProgress({ message: 'Finishing up...', progress: 95 });
        const { data: updatedChecklistWithReport, error: reportUpdateError } = await (supabase.from('checklists') as any)
            .update({ report_url: urlData.publicUrl })
            .eq('id', finalChecklistData.id)
            .select()
            .single();
        if (reportUpdateError) throw reportUpdateError;

        setSubmissionProgress({ message: 'Submission Complete!', progress: 100 });
        
        const checklistWithReportUrl = updatedChecklistWithReport as Checklist;
        setChecklists(prev => prev.map(c => c.id === processedChecklist.id ? checklistWithReportUrl : c));
        
        setTimeout(() => {
            alert('Checklist submitted successfully!');
            handleBackToList();
        }, 500);

      } catch (error: any) {
        console.error("Failed to submit checklist:", error);
        
        let errorMessage: string;
        // Check for Supabase/generic error object with a string 'message' property
        if (error && typeof error === 'object' && typeof error.message === 'string') {
            errorMessage = error.message;
        } else if (error instanceof Error) { // Standard JS Error
            errorMessage = error.message;
        } else if (typeof error === 'string') { // Just a string was thrown
            errorMessage = error;
        } else { // Fallback for everything else
            errorMessage = "An unexpected error occurred. Check the console for details.";
        }

        // The specific "Bucket not found" message enhancement
        if (errorMessage.includes("Bucket not found")) {
            errorMessage += "\n\nThis is a configuration issue in your Supabase project. Please ensure both the 'field-ops-photos' and 'field-ops-reports' storage buckets have been created and that their access policies are set up correctly as per the README.md instructions.";
        }
        alert(`Submission failed: ${errorMessage}`);
      } finally {
        setTimeout(() => setSubmissionProgress(null), 1000); // Keep success message for a bit, or clear immediately on error.
      }
  };
    
  const handleCreateAssignments = async (auditorId: string, outletIds: string[], templateIds: string[], dueDate: string) => {
      setIsLoading(true);
      try {
        const newChecklistsToInsert: any[] = [];
        
        for (const outletId of outletIds) {
          for (const templateId of templateIds) {
            const outlet = outlets.find(o => o.id === outletId);
            const template = checklistTemplates.find(t => t.id === templateId);

            if (outlet && template) {
              const checklistItems = template.items.map((baseItem: ChecklistItemBase): Omit<ChecklistItem, 'finding' | 'finding_id'> => ({
                ...baseItem,
                value: null,
                photoEvidence: [],
                aiAnalysisResult: undefined,
                aiAnalysisStatus: 'idle',
                note: undefined,
              }));

              newChecklistsToInsert.push({
                title: template.title,
                location: outlet.name,
                assigned_to: auditorId,
                due_date: dueDate,
                status: 'pending',
                items: checklistItems,
              });
            }
          }
        }

        if (newChecklistsToInsert.length === 0) {
          alert("No valid assignments to create.");
          return;
        }

        // FIX: Consistent with other Supabase calls, cast to 'any' to resolve a TypeScript error where the insert payload is not assignable to 'never'.
        const { data, error } = await (supabase.from('checklists') as any).insert(newChecklistsToInsert).select();
        if (error) throw error;
        
        alert(`${data.length} assignments created successfully!`);

        const processedNewChecklists = (data || []).map((c: any) => ({
          ...c,
          items: Array.isArray(c.items) ? c.items : [],
        }));
        setChecklists(prev => [...prev, ...processedNewChecklists as unknown as Checklist[]]);
        setView('admin_dashboard');

      } catch (error: any) {
        console.error("Error creating assignments:", error);
        alert(`Failed to create assignments: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    };
    
  const handleResolveTask = async (taskId: string, resolutionData: { photo: string }) => {
    try {
        const photoUrl = await uploadPhoto(resolutionData.photo);
        if (!photoUrl) {
            throw new Error("Proof of fix photo upload failed.");
        }

        const updatePayload = {
            status: 'resolved' as 'resolved',
            proof_of_fix: photoUrl,
        };

        const { data, error } = await (supabase.from('tasks') as any)
            .update(updatePayload)
            .eq('id', taskId)
            .select();

        if (error) throw error;

        setTasks(prev => prev.map(t => t.id === taskId ? (data[0] as Task) : t));
        alert('Finding has been successfully resolved!');
    } catch (error: any) {
        console.error("Error resolving task:", error);
        alert(`Failed to resolve finding: ${error.message}`);
    }
  };


  const renderView = () => {
    if (!currentUser) return null; // Should not happen if logic is correct

    switch (view) {
      case 'admin_dashboard':
        return <AdminDashboardView setView={setView} users={users} outlets={outlets} templates={checklistTemplates} checklists={checklists} />;
      case 'auditor_dashboard':
        return <AuditorDashboardView user={currentUser} onSelectChecklist={handleSelectChecklist} checklists={checklists} tasks={tasks} users={users} onResolveTask={handleResolveTask} />;
      case 'findings':
        return <FindingsView tasks={tasks} checklists={checklists} users={users} onResolveTask={handleResolveTask} />;
      case 'reports':
        return <ReportsView checklists={checklists} users={users} />;
      case 'user_management':
        return <UserManagementView 
                  users={users} 
                  onAddUser={handleAddUser}
                  onUpdateUser={handleUpdateUser}
                  onDeleteUser={handleDeleteUser}
               />;
      case 'templates':
        return <TemplateEditorView templates={checklistTemplates} onSave={handleSaveTemplate} />;
      case 'outlet_management':
        return <OutletManagementView
                  outlets={outlets}
                  users={users}
                  onAddOutlet={handleAddOutlet}
                  onUpdateOutlet={handleUpdateOutlet}
                  onDeleteOutlet={handleDeleteOutlet}
                />;
       case 'assignments':
        return <AssignmentView
                    users={users}
                    outlets={outlets}
                    templates={checklistTemplates}
                    checklists={checklists}
                    onCreateAssignments={handleCreateAssignments}
                    onCancel={() => setView('admin_dashboard')}
                />;
      default:
        if (currentUser.role === Role.Admin) return <AdminDashboardView setView={setView} users={users} outlets={outlets} templates={checklistTemplates} checklists={checklists} />;
        if (currentUser.role === Role.Auditor) return <AuditorDashboardView user={currentUser} onSelectChecklist={handleSelectChecklist} checklists={checklists} tasks={tasks} users={users} onResolveTask={handleResolveTask} />;
        return <h2>Error: Unknown View</h2>;
    }
  };

  if (isAuthLoading && !authTimeout) {
      return <LoadingSpinner message="Checking authentication..." />;
  }

  if (!currentUser) {
    return <LoginPage />;
  }
  
  if (isLoading) {
    return <LoadingSpinner />;
  }

  // FIX: Refactored the final return to ensure the ProgressOverlay is rendered at the top level.
  // This guarantees it will be visible on top of any view, including the ChecklistView,
  // solving the bug where it wasn't appearing during submission.
  return (
    <>
      {view === 'checklists' && selectedChecklist ? (
        <ChecklistView
          checklist={selectedChecklist}
          onBack={handleBackToList}
          onSubmit={handleChecklistSubmit}
          onLogout={handleLogout}
          isSubmitting={!!submissionProgress}
        />
      ) : (
        <div className="flex h-screen bg-base-200 text-gray-800">
          <Sidebar
            currentView={view}
            setView={setView}
            isOpen={sidebarOpen}
            setIsOpen={setSidebarOpen}
            user={currentUser}
            onLogout={handleLogout}
          />
          <div className="flex-1 flex flex-col overflow-hidden">
            <Header
              user={currentUser}
              onMenuClick={() => setSidebarOpen(!sidebarOpen)}
              onLogout={handleLogout}
            />
            <main className="flex-1 overflow-x-hidden overflow-y-auto bg-base-200 p-4 sm:p-6 lg:p-8">
              {renderView()}
            </main>
          </div>
        </div>
      )}
      {submissionProgress && <ProgressOverlay message={submissionProgress.message} progress={submissionProgress.progress} />}
    </>
  );
};

export default App;
