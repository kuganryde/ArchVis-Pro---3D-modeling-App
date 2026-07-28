/**
 * Team management: members + roles, invitations, and accepting invites you've
 * received. Admin-only actions are hidden for plain members (and enforced by RLS).
 */
import React, { useEffect, useState } from 'react';
import { Users, X, Trash2, Loader2, UserPlus, Mail, Check } from 'lucide-react';
import {
  Role,
  Member,
  Invitation,
  listMembers,
  listInvitations,
  inviteMember,
  revokeInvitation,
  removeMember,
  changeRole,
  listMyInvitations,
  acceptInvitation,
} from '../lib/team';
import { showToast } from '../utils/toast';

interface TeamModalProps {
  workspaceId: string;
  myUserId: string;
  myRole: Role;
  myEmail: string;
  onClose: () => void;
  onJoined: () => void;
}

const roleBadge: Record<Role, string> = {
  owner: 'bg-violet-100 text-violet-700',
  admin: 'bg-blue-100 text-blue-700',
  member: 'bg-slate-100 text-slate-600',
};

export default function TeamModal({ workspaceId, myUserId, myRole, myEmail, onClose, onJoined }: TeamModalProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [myInvites, setMyInvites] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');
  const [busy, setBusy] = useState(false);

  const isAdmin = myRole === 'owner' || myRole === 'admin';

  const refresh = async () => {
    try {
      const [m, mine] = await Promise.all([listMembers(workspaceId), listMyInvitations(myEmail)]);
      setMembers(m);
      setMyInvites(mine.filter((i) => i.workspaceId !== workspaceId));
      if (isAdmin) setInvites(await listInvitations(workspaceId));
    } catch (e: any) {
      showToast(e?.message || 'Could not load the team.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    try {
      await inviteMember(workspaceId, email, inviteRole);
      setEmail('');
      showToast(`Invitation sent to ${email.trim()}.`);
      setInvites(await listInvitations(workspaceId));
    } catch (err: any) {
      showToast(err?.message || 'Could not send the invitation.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const doRemove = async (userId: string) => {
    try {
      await removeMember(workspaceId, userId);
      setMembers((m) => m.filter((x) => x.userId !== userId));
      showToast('Member removed.');
    } catch (e: any) {
      showToast(e?.message || 'Could not remove member.', 'error');
    }
  };

  const doRole = async (userId: string, role: 'admin' | 'member') => {
    try {
      await changeRole(workspaceId, userId, role);
      setMembers((m) => m.map((x) => (x.userId === userId ? { ...x, role } : x)));
    } catch (e: any) {
      showToast(e?.message || 'Could not change role.', 'error');
    }
  };

  const doRevoke = async (id: string) => {
    try {
      await revokeInvitation(id);
      setInvites((i) => i.filter((x) => x.id !== id));
    } catch (e: any) {
      showToast(e?.message || 'Could not revoke invitation.', 'error');
    }
  };

  const doAccept = async (id: string) => {
    try {
      await acceptInvitation(id);
      showToast('Invitation accepted — switching you in…');
      onJoined();
      onClose();
    } catch (e: any) {
      showToast(e?.message || 'Could not accept invitation.', 'error');
    }
  };

  return (
    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white max-w-lg w-full rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[85vh]">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center shadow-inner">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Team</h2>
              <p className="text-xs text-slate-500 font-medium">Members, roles &amp; invitations</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 text-slate-500 text-sm py-8">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading team…
            </div>
          ) : (
            <>
              {/* Invitations addressed to me */}
              {myInvites.length > 0 && (
                <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-3 space-y-2">
                  <div className="text-xs font-bold text-violet-700">Invitations for you</div>
                  {myInvites.map((i) => (
                    <div key={i.id} className="flex items-center justify-between text-xs">
                      <span className="text-slate-700">
                        {i.workspaceName || 'A workspace'} · <span className="capitalize">{i.role}</span>
                      </span>
                      <button onClick={() => doAccept(i.id)} className="av-btn av-btn-primary av-btn-sm">
                        <Check className="w-3 h-3" /> Accept
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Members */}
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                  Members ({members.length})
                </div>
                <div className="space-y-1.5">
                  {members.map((m) => {
                    const canManage = isAdmin && m.role !== 'owner' && m.userId !== myUserId;
                    return (
                      <div key={m.userId} className="flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-slate-50">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[11px] font-bold shrink-0">
                            {m.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm text-slate-700 truncate">
                            {m.name}
                            {m.userId === myUserId && <span className="text-slate-400"> (you)</span>}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {canManage ? (
                            <select
                              value={m.role}
                              onChange={(e) => doRole(m.userId, e.target.value as 'admin' | 'member')}
                              className="text-[11px] font-semibold rounded-md border border-slate-200 bg-white px-1.5 py-1 cursor-pointer"
                            >
                              <option value="member">member</option>
                              <option value="admin">admin</option>
                            </select>
                          ) : (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${roleBadge[m.role]}`}>
                              {m.role}
                            </span>
                          )}
                          {canManage && (
                            <button
                              onClick={() => doRemove(m.userId)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                              title="Remove member"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Admin: invite + pending */}
              {isAdmin && (
                <div className="space-y-3 border-t border-slate-100 pt-4">
                  <form onSubmit={invite} className="flex gap-2">
                    <div className="relative flex-1">
                      <Mail className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="teammate@company.com"
                        className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
                        required
                      />
                    </div>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as 'admin' | 'member')}
                      className="text-xs font-semibold rounded-lg border border-slate-200 bg-white px-2 cursor-pointer"
                    >
                      <option value="member">member</option>
                      <option value="admin">admin</option>
                    </select>
                    <button type="submit" disabled={busy} className="av-btn av-btn-primary av-btn-sm">
                      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                      Invite
                    </button>
                  </form>

                  {invites.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pending invites</div>
                      {invites.map((i) => (
                        <div key={i.id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-50">
                          <span className="text-slate-600 truncate">
                            {i.email} · <span className="capitalize text-slate-400">{i.role}</span>
                          </span>
                          <button onClick={() => doRevoke(i.id)} className="text-[11px] font-semibold text-rose-600 hover:text-rose-700">
                            Revoke
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Invitees join by signing up (or in) with the invited email — they'll see the invite here to accept.
                    Team seats are a Team-plan feature.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
