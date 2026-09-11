"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { Icons } from "@/components/icons";
import { Modal } from "@/components/ui/modal";
import { SearchInput } from "@/components/ui/search-input";
import { TeamSchemaUnavailable } from "./team-schema-unavailable";

interface Person {
  id: string;
  name: string;
  display_name?: string | null;
  role_title?: string | null;
  company_team?: string | null;
  email?: string | null;
  relationship_type: string;
  status: string;
  notes?: string | null;
}

export function PeopleList() {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [schemaUnavailable, setSchemaUnavailable] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [relationshipFilter, setRelationshipFilter] = useState("all");

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [companyTeam, setCompanyTeam] = useState("");
  const [email, setEmail] = useState("");
  const [relationshipType, setRelationshipType] = useState("team_member");
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const loadPeople = useCallback(() => {
    let url = "/api/team/people?";
    if (statusFilter !== "all") url += `status=${statusFilter}&`;
    if (relationshipFilter !== "all") url += `relationship_type=${relationshipFilter}&`;
    if (search.trim()) url += `q=${encodeURIComponent(search.trim())}&`;

    fetch(url)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        setSchemaUnavailable(json?.schemaStatus === "unavailable");
        if (json?.data) setPeople(json.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [search, statusFilter, relationshipFilter]);

  useEffect(() => {
    loadPeople();
  }, [loadPeople]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/team/people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          role_title: roleTitle.trim() || null,
          company_team: companyTeam.trim() || null,
          email: email.trim() || null,
          relationship_type: relationshipType,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create person.");

      setCreateOpen(false);
      setName("");
      setRoleTitle("");
      setCompanyTeam("");
      setEmail("");
      loadPeople();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error creating person.");
    } finally {
      setCreating(false);
    }
  };

  if (schemaUnavailable) return <TeamSchemaUnavailable title="People Directory" description="Collaborators, contractors, and team members you coordinate with." />;

  return (
    <div className="page-shell team-page">
      <div className="page-header">
        <div>
          <p className="eyebrow"><Link href="/team">← Team Command Center</Link></p>
          <h1>People Directory</h1>
          <p className="page-description">Collaborators, contractors, and team members you coordinate with.</p>
        </div>
        <div className="header-actions">
          <button onClick={() => setCreateOpen(true)} className="button button--primary">
            <Icons.Plus size={16} /> Add Person
          </button>
        </div>
      </div>

      {/* FILTERS */}
      <div className="filter-bar" style={{ display: "flex", gap: "12px", flexWrap: "wrap", margin: "20px 0" }}>
        <SearchInput
          label="Search people"
          placeholder="Search people by name or title…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch("")}
          containerClassName="search-control--compact"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="select-input"
          style={{ padding: "8px 12px" }}
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="external">External</option>
        </select>
        <select
          value={relationshipFilter}
          onChange={(e) => setRelationshipFilter(e.target.value)}
          className="select-input"
          style={{ padding: "8px 12px" }}
        >
          <option value="all">All relationships</option>
          <option value="team_member">Team member</option>
          <option value="contractor">Contractor</option>
          <option value="freelancer">Freelancer</option>
          <option value="partner">Partner</option>
          <option value="advisor">Advisor</option>
          <option value="client_contact">Client contact</option>
          <option value="supplier_contact">Supplier contact</option>
          <option value="collaborator">Collaborator</option>
        </select>
      </div>

      {/* PEOPLE GRID */}
      {loading ? (
        <p className="muted">Loading directory…</p>
      ) : people.length === 0 ? (
        <div className="data-surface empty-hero">
          <Icons.Users size={32} />
          <h3>No people found</h3>
          <p className="muted">Add a collaborator or adjust your search filters.</p>
        </div>
      ) : (
        <div className="team-people-grid">
          {people.map((p) => (
            <Link href={`/team/people/${p.id}`} key={p.id} className="team-person-card">
              <div className="team-person-card__header">
                <div className="team-person-avatar">
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="team-person-name">{p.name}</h3>
                  <p className="muted" style={{ fontSize: "12px", margin: "2px 0" }}>
                    {p.role_title || "No role specified"}
                  </p>
                  {p.company_team && (
                    <small className="muted">{p.company_team}</small>
                  )}
                </div>
              </div>
              <div className="team-person-card__meta">
                <span className="badge badge--muted">
                  {p.relationship_type.replace("_", " ")}
                </span>
                <span className={`badge badge--${p.status === "active" ? "healthy" : "warning"}`}>
                  {p.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* CREATE PERSON MODAL */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Add Person">
        <form onSubmit={handleCreate} style={{ display: "grid", gap: "16px" }}>
          {errorMsg && <p className="error-text" style={{ color: "var(--danger)" }}>{errorMsg}</p>}
          <div>
            <label className="field-label">Name *</label>
            <input
              required
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sara Mansouri"
              className="text-input"
            />
          </div>
          <div>
            <label className="field-label">Role / Title</label>
            <input
              type="text"
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              placeholder="e.g. Operations Coordinator"
              className="text-input"
            />
          </div>
          <div>
            <label className="field-label">Company / Team</label>
            <input
              type="text"
              value={companyTeam}
              onChange={(e) => setCompanyTeam(e.target.value)}
              placeholder="e.g. External Ops, Design Studio"
              className="text-input"
            />
          </div>
          <div>
            <label className="field-label">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="sara@example.com"
              className="text-input"
            />
          </div>
          <div>
            <label className="field-label">Relationship Type</label>
            <select
              value={relationshipType}
              onChange={(e) => setRelationshipType(e.target.value)}
              className="select-input"
            >
              <option value="team_member">Team member</option>
              <option value="contractor">Contractor</option>
              <option value="freelancer">Freelancer</option>
              <option value="partner">Partner</option>
              <option value="advisor">Advisor</option>
              <option value="client_contact">Client contact</option>
              <option value="supplier_contact">Supplier contact</option>
              <option value="collaborator">Collaborator</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "12px" }}>
            <button type="button" onClick={() => setCreateOpen(false)} className="button button--secondary">
              Cancel
            </button>
            <button type="submit" disabled={creating || !name.trim()} className="button button--primary">
              {creating ? "Adding…" : "Add Person"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
