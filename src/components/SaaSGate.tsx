/**
 * Top-level gate that turns ArchViz Pro into a multi-tenant SaaS when Supabase
 * is configured:
 *   - not configured  -> render <App /> in local (localStorage) mode.
 *   - configured + no session -> <AuthScreen />.
 *   - configured + session -> load the user's workspace + a project, then render
 *     <App /> wired to cloud persistence with a project switcher / user menu.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Plus, LogOut, ChevronDown, Sparkles, Users } from 'lucide-react';
import App, { AppDesign } from '../App';
import AuthScreen from './AuthScreen';
import BillingModal from './BillingModal';
import TeamModal from './TeamModal';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { DEFAULT_ROOMS, DEFAULT_ASSETS } from '../data/defaultFloorPlan';
import { showToast } from '../utils/toast';
import { PlanId, maxProjectsForPlan } from '../shared/plans';
import { getWorkspacePlan } from '../lib/billing';
import { uploadBlueprint, getBlueprintUrl, deleteBlueprint } from '../lib/blueprints';
import { Role, listMyInvitations } from '../lib/team';
import {
  Workspace,
  ProjectSummary,
  Project,
  ensureWorkspace,
  listWorkspaces,
  getMyRole,
  listProjects,
  getProject,
  createProject,
  saveProjectDesign,
} from '../lib/projects';

const EMPTY_DESIGN: AppDesign = { rooms: [], assets: [], blueprintImage: null };
const SEED_DESIGN: AppDesign = { rooms: DEFAULT_ROOMS, assets: DEFAULT_ASSETS, blueprintImage: null };

function FullScreenMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-screen bg-slate-50 flex items-center justify-center text-slate-500 text-sm gap-2">
      {children}
    </div>
  );
}

export default function SaaSGate() {
  const { session, loading, configured } = useAuth();

  // Local mode — behave exactly like the original single-user app.
  if (!configured) return <App />;
  if (loading) {
    return (
      <FullScreenMessage>
        <Loader2 className="w-4 h-4 animate-spin" /> Loading…
      </FullScreenMessage>
    );
  }
  if (!session) return <AuthScreen />;

  // WorkspaceView remounts naturally on sign-out/in (this branch unmounts when
  // the session clears), so it needs no explicit key.
  return <WorkspaceView userId={session.user.id} email={session.user.email || 'Account'} />;
}

function WorkspaceView({ userId, email }: { userId: string; email: string }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [design, setDesign] = useState<AppDesign | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanId>('free');
  const [myRole, setMyRole] = useState<Role>('member');
  const [showBilling, setShowBilling] = useState(false);
  const [showTeam, setShowTeam] = useState(false);

  // Blueprint object-storage bookkeeping (kept in refs so autosave doesn't
  // re-upload the same image or store a giant base64 blob in the DB row).
  const blueprintPathRef = useRef<string | null>(null); // current object path
  const uploadedDataUrlRef = useRef<string | null>(null); // data URL already uploaded
  const uploadingRef = useRef<{ img: string; promise: Promise<string> } | null>(null);

  // Turn a stored project into an AppDesign, resolving the blueprint path into a
  // signed URL for rendering and resetting the storage refs for this project.
  const hydrate = useCallback(async (full: Project): Promise<AppDesign> => {
    const d = full.data || ({} as any);
    blueprintPathRef.current = d.blueprintPath ?? null;
    uploadedDataUrlRef.current = null;
    uploadingRef.current = null;
    let blueprintImage: string | null = d.blueprintImage ?? null; // legacy inline
    if (d.blueprintPath) blueprintImage = await getBlueprintUrl(d.blueprintPath);
    return { rooms: d.rooms ?? [], assets: d.assets ?? [], blueprintImage };
  }, []);

  // Load a workspace's projects, plan, role and its first project.
  const loadWorkspace = useCallback(async (ws: Workspace) => {
    setWorkspace(ws);
    setDesign(null); // show the loading state while switching
    let list = await listProjects(ws.id);
    if (list.length === 0) {
      const created = await createProject(ws.id, 'My First Project', SEED_DESIGN);
      list = [{ id: created.id, name: created.name, updated_at: created.updated_at }];
    }
    setProjects(list);
    const full = await getProject(list[0].id);
    const hydrated = await hydrate(full);
    setCurrentId(full.id);
    setDesign(hydrated);
    const [wp, role] = await Promise.all([getWorkspacePlan(ws.id), getMyRole(ws.id)]);
    setPlan(wp.plan);
    setMyRole(role ?? 'member');
  }, [hydrate]);

  // Bootstrap: ensure a workspace exists, list them, load the first.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await ensureWorkspace();
        const list = await listWorkspaces();
        if (!active) return;
        setWorkspaces(list);
        if (list[0]) await loadWorkspace(list[0]);
      } catch (err: any) {
        if (active) setError(err?.message || 'Failed to load your workspace.');
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // One-time nudge if the user has pending invitations to workspaces they
  // haven't joined yet.
  const invitesChecked = useRef(false);
  useEffect(() => {
    if (invitesChecked.current || workspaces.length === 0) return;
    invitesChecked.current = true;
    (async () => {
      try {
        const mine = (await listMyInvitations(email)).filter(
          (i) => !workspaces.some((w) => w.id === i.workspaceId)
        );
        if (mine.length) {
          showToast(
            `You have ${mine.length} workspace invitation${mine.length > 1 ? 's' : ''}. Open Team (👥) to accept.`,
            'info',
            { durationMs: 7000 }
          );
        }
      } catch {
        /* ignore */
      }
    })();
  }, [workspaces, email]);

  const switchWorkspace = async (id: string) => {
    if (id === workspace?.id) return;
    const ws = workspaces.find((w) => w.id === id);
    if (ws) {
      try {
        await loadWorkspace(ws);
      } catch (e: any) {
        showToast(e?.message || 'Could not open that workspace.', 'error');
      }
    }
  };

  // After accepting an invite, refresh the workspace list and switch to the newest.
  const reloadWorkspaces = async () => {
    try {
      const list = await listWorkspaces();
      setWorkspaces(list);
      const joined = list[list.length - 1];
      if (joined) await loadWorkspace(joined);
    } catch (e: any) {
      showToast(e?.message || 'Could not refresh workspaces.', 'error');
    }
  };

  // After returning from Stripe Checkout, the webhook may lag a beat — re-check
  // the plan a few times, then clean the ?billing= param from the URL.
  useEffect(() => {
    if (!workspace) return;
    const params = new URLSearchParams(window.location.search);
    const outcome = params.get('billing');
    if (!outcome) return;

    if (outcome === 'success') {
      showToast('Payment received — activating your plan…', 'success');
      let tries = 0;
      const timer = setInterval(async () => {
        tries += 1;
        const wp = await getWorkspacePlan(workspace.id);
        if (wp.plan !== 'free' || tries >= 5) {
          setPlan(wp.plan);
          clearInterval(timer);
          if (wp.plan !== 'free') showToast(`You're now on the ${wp.plan} plan. 🎉`, 'success');
        }
      }, 2000);
    } else if (outcome === 'cancelled') {
      showToast('Checkout cancelled — no changes made.', 'info');
    }
    // Strip the query param without reloading.
    window.history.replaceState({}, '', window.location.pathname);
  }, [workspace]);

  const persist = useCallback(
    (d: AppDesign) => {
      if (!currentId || !workspace) return;
      const wsId = workspace.id;
      const projId = currentId;
      (async () => {
        try {
          let path = blueprintPathRef.current;
          const img = d.blueprintImage;

          if (!img) {
            // Blueprint removed — drop the stored object.
            if (path) deleteBlueprint(path).catch(() => {});
            path = null;
            blueprintPathRef.current = null;
            uploadedDataUrlRef.current = null;
          } else if (img.startsWith('data:')) {
            // A freshly uploaded blueprint — upload once, de-duping concurrent saves.
            if (uploadedDataUrlRef.current === img) {
              path = blueprintPathRef.current;
            } else if (uploadingRef.current && uploadingRef.current.img === img) {
              path = await uploadingRef.current.promise;
            } else {
              const oldPath = blueprintPathRef.current;
              const promise = uploadBlueprint(wsId, projId, img).then((p) => {
                blueprintPathRef.current = p;
                uploadedDataUrlRef.current = img;
                if (oldPath && oldPath !== p) deleteBlueprint(oldPath).catch(() => {});
                return p;
              });
              uploadingRef.current = { img, promise };
              try {
                path = await promise;
              } finally {
                if (uploadingRef.current && uploadingRef.current.img === img) uploadingRef.current = null;
              }
            }
          } else {
            // Already a URL (the signed URL we handed to App) — keep the path.
            path = blueprintPathRef.current;
          }

          // Save only the compact path — never the multi-MB base64 blob.
          await saveProjectDesign(projId, { rooms: d.rooms, assets: d.assets, blueprintPath: path });
        } catch (e: any) {
          showToast(e?.message || 'Cloud save failed.', 'error');
        }
      })();
    },
    [currentId, workspace]
  );

  const switchProject = async (id: string) => {
    if (id === currentId) return;
    try {
      const full = await getProject(id);
      const hydrated = await hydrate(full);
      setCurrentId(full.id);
      setDesign(hydrated);
    } catch (e: any) {
      showToast(e?.message || 'Could not open that project.', 'error');
    }
  };

  const newProject = async () => {
    if (!workspace) return;

    // Enforce the plan's project limit (Free = 1). Nudge to upgrade instead.
    const limit = maxProjectsForPlan(plan);
    if (limit !== null && projects.length >= limit) {
      showToast(`The ${plan} plan is limited to ${limit} project${limit === 1 ? '' : 's'}. Upgrade for unlimited.`, 'error');
      setShowBilling(true);
      return;
    }

    const name = prompt('Name your new project:', 'Untitled Project');
    if (!name) return;
    try {
      const created = await createProject(workspace.id, name, EMPTY_DESIGN);
      // Fresh project — clear blueprint storage bookkeeping.
      blueprintPathRef.current = null;
      uploadedDataUrlRef.current = null;
      uploadingRef.current = null;
      setProjects((p) => [{ id: created.id, name: created.name, updated_at: created.updated_at }, ...p]);
      setCurrentId(created.id);
      setDesign(EMPTY_DESIGN);
      showToast(`Created “${created.name}”.`);
    } catch (e: any) {
      showToast(e?.message || 'Could not create project.', 'error');
    }
  };

  const signOut = () => supabase?.auth.signOut();

  if (error) {
    return (
      <FullScreenMessage>
        <div className="max-w-md text-center px-4">
          <p className="text-rose-600 font-semibold mb-2">Could not load your workspace</p>
          <p className="text-xs text-slate-500 mb-4">{error}</p>
          <p className="text-[11px] text-slate-400">
            Make sure the database migration in <code>supabase/migrations</code> has been applied.
          </p>
          <button onClick={signOut} className="mt-4 text-xs text-violet-600 font-semibold hover:underline">
            Sign out
          </button>
        </div>
      </FullScreenMessage>
    );
  }

  if (!design || !currentId) {
    return (
      <FullScreenMessage>
        <Loader2 className="w-4 h-4 animate-spin" /> Loading your projects…
      </FullScreenMessage>
    );
  }

  const header = (
    <div className="flex items-center gap-2">
      {/* Workspace switcher (only when the user belongs to more than one) */}
      {workspaces.length > 1 && (
        <div className="relative hidden md:flex items-center">
          <select
            value={workspace?.id || ''}
            onChange={(e) => switchWorkspace(e.target.value)}
            className="appearance-none text-xs font-semibold text-violet-700 bg-violet-50 border border-violet-200 rounded-lg pl-3 pr-7 py-1.5 cursor-pointer hover:bg-violet-100 focus:outline-none focus:ring-2 focus:ring-violet-200 max-w-[170px] truncate"
            title="Switch workspace"
          >
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-violet-400 absolute right-2 pointer-events-none" />
        </div>
      )}

      <div className="relative hidden sm:flex items-center">
        <select
          value={currentId}
          onChange={(e) => switchProject(e.target.value)}
          className="appearance-none text-sm font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg pl-3 pr-7 py-1.5 cursor-pointer hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-200 max-w-[200px] truncate"
          title="Switch project"
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 pointer-events-none" />
      </div>
      <button
        type="button"
        onClick={newProject}
        className="p-1.5 rounded-lg text-slate-500 hover:text-violet-600 hover:bg-violet-50 transition-all"
        title="New project"
      >
        <Plus className="w-4 h-4" />
      </button>

      <button
        type="button"
        onClick={() => setShowTeam(true)}
        className="p-1.5 rounded-lg text-slate-500 hover:text-violet-600 hover:bg-violet-50 transition-all"
        title="Team & invitations"
      >
        <Users className="w-4 h-4" />
      </button>

      <div className="h-6 w-px bg-slate-200 mx-1 hidden md:block" />

      {/* Plan badge + upgrade */}
      <button
        type="button"
        onClick={() => setShowBilling(true)}
        className={plan === 'free' ? 'av-btn av-btn-primary av-btn-sm' : 'av-btn av-btn-secondary av-btn-sm'}
        title="Plans & billing"
      >
        <Sparkles className="w-3.5 h-3.5" />
        <span className="capitalize">{plan === 'free' ? 'Upgrade' : plan}</span>
      </button>

      <div className="h-6 w-px bg-slate-200 mx-1 hidden md:block" />
      <span className="text-xs text-slate-400 font-medium hidden lg:inline max-w-[160px] truncate" title={email}>
        {email}
      </span>
      <button
        type="button"
        onClick={signOut}
        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-all"
        title="Sign out"
      >
        <LogOut className="w-4 h-4" />
      </button>
    </div>
  );

  // Key the wrapper on the project id so switching projects remounts App with
  // fresh state. (Keyed on an intrinsic element since the project has no
  // @types/react to type `key` on custom components.) display:contents keeps
  // the wrapper out of the layout so App's full-screen flex is unaffected.
  return (
    <>
      <div key={currentId} style={{ display: 'contents' }}>
        <App
          initialDesign={design}
          onPersist={persist}
          headerSlot={header}
          hostedAiWorkspaceId={workspace?.id}
          onUpgradeNeeded={() => setShowBilling(true)}
          plan={plan}
        />
      </div>
      {showBilling && workspace && (
        <BillingModal workspaceId={workspace.id} currentPlan={plan} onClose={() => setShowBilling(false)} />
      )}
      {showTeam && workspace && (
        <TeamModal
          workspaceId={workspace.id}
          myUserId={userId}
          myRole={myRole}
          myEmail={email}
          onClose={() => setShowTeam(false)}
          onJoined={reloadWorkspaces}
        />
      )}
    </>
  );
}
