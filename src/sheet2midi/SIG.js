// ─────────────────────────────────────────────
// SIG — Symbol Interpretation Graph
// Inspired by Audiveris: Inter nodes with
// confidence grades, Support and Exclusion edges,
// graph reduction to resolve conflicts.
// ─────────────────────────────────────────────

// ── Relation types ────────────────────────────

export const RelationType = {
  SUPPORT: 'support',
  EXCLUSION: 'exclusion'
};

// ── Support grade boost ───────────────────────

const SUPPORT_BOOST = 0.1;

// ── Inter (Symbol Interpretation) ─────────────

export class Inter {
  /**
   * @param {Object} opts
   * @param {number} opts.id
   * @param {string} opts.type - SymbolType value
   * @param {number} [opts.grade=0.0] - intrinsic confidence 0.0–1.0
   * @param {Object} [opts.bbox] - { x, y, width, height }
   * @param {Object} [opts.data] - arbitrary payload
   */
  constructor({ id, type, grade = 0.0, bbox = null, data = null }) {
    this.id = id;
    this.type = type;
    this.grade = Math.max(0.0, Math.min(1.0, grade));
    this.bbox = bbox;
    this.data = data;
  }

  toJSON() {
    const json = { id: this.id, type: this.type, grade: this.grade };
    if (this.bbox) json.bbox = this.bbox;
    if (this.data) json.data = this.data;
    return json;
  }
}

// ── Edge (Relation between Inters) ────────────

class Edge {
  constructor(source, target, type) {
    this.source = source;
    this.target = target;
    this.type = type;
  }

  toJSON() {
    return { source: this.source, target: this.target, type: this.type };
  }
}

// ── SIG (Symbol Interpretation Graph) ─────────

export class SIG {
  constructor() {
    /** @type {Map<number, Inter>} */
    this._inters = new Map();
    /** @type {Edge[]} */
    this._edges = [];
    this._nextId = 1;
  }

  // ── Node management ─────────────────────────

  /**
   * @param {Object} opts - same as Inter constructor minus id
   * @returns {Inter}
   */
  addInter(opts) {
    const id = this._nextId++;
    const inter = new Inter({ id, ...opts });
    this._inters.set(id, inter);
    return inter;
  }

  /** @param {number} id */
  removeInter(id) {
    this._inters.delete(id);
    this._edges = this._edges.filter(e => e.source !== id && e.target !== id);
  }

  /** @param {number} id @returns {Inter|undefined} */
  getInter(id) {
    return this._inters.get(id);
  }

  /** @returns {Inter[]} */
  getAllInters() {
    return [...this._inters.values()];
  }

  /** @param {string} type @returns {Inter[]} */
  getIntersByType(type) {
    return this.getAllInters().filter(i => i.type === type);
  }

  // ── Edge management ─────────────────────────

  /** @param {number} sourceId @param {number} targetId */
  addSupport(sourceId, targetId) {
    this._edges.push(new Edge(sourceId, targetId, RelationType.SUPPORT));
  }

  /** @param {number} sourceId @param {number} targetId */
  addExclusion(sourceId, targetId) {
    // Prevent duplicates
    const exists = this._edges.some(e =>
      e.type === RelationType.EXCLUSION &&
      ((e.source === sourceId && e.target === targetId) ||
       (e.source === targetId && e.target === sourceId))
    );
    if (!exists) {
      this._edges.push(new Edge(sourceId, targetId, RelationType.EXCLUSION));
    }
  }

  /**
   * Get all edges involving a given Inter (bidirectional lookup).
   * @param {number} id
   * @returns {Edge[]}
   */
  getEdges(id) {
    return this._edges.filter(e => e.source === id || e.target === id);
  }

  // ── Contextual grade ────────────────────────

  /**
   * Compute contextual grade for an Inter: intrinsic grade
   * boosted by SUPPORT_BOOST per support edge, clamped to 1.0.
   * @param {number} id
   * @returns {number}
   */
  contextualGrade(id) {
    const inter = this._inters.get(id);
    if (!inter) return 0.0;
    const supportCount = this._edges.filter(e =>
      e.type === RelationType.SUPPORT &&
      (e.source === id || e.target === id)
    ).length;
    return Math.min(1.0, inter.grade + supportCount * SUPPORT_BOOST);
  }

  // ── Reduction ───────────────────────────────

  /**
   * Resolve all exclusion edges: for each exclusion, remove the
   * Inter with the lower contextual grade. Repeat until no
   * exclusion edges remain.
   */
  reduce() {
    let changed = true;
    while (changed) {
      changed = false;
      const exclusions = this._edges.filter(e => e.type === RelationType.EXCLUSION);
      for (const edge of exclusions) {
        const a = this._inters.get(edge.source);
        const b = this._inters.get(edge.target);
        if (!a || !b) continue;
        const gradeA = this.contextualGrade(a.id);
        const gradeB = this.contextualGrade(b.id);
        const loserId = gradeA >= gradeB ? b.id : a.id;
        this.removeInter(loserId);
        changed = true;
        break; // restart loop since edges changed
      }
    }
  }

  // ── Serialisation ───────────────────────────

  toJSON() {
    return {
      inters: this.getAllInters().map(i => i.toJSON()),
      edges: this._edges.map(e => e.toJSON())
    };
  }
}
