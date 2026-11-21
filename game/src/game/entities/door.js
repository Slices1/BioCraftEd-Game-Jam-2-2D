import { sprites } from '../sprites.js';
import { Entity } from './base.js';
import { P, box, glow, C } from '../iso.js';

const DOOR = { top: '#6a5a48', left: '#3a2a20', right: '#52402f', edge: 'rgba(0,0,0,0.6)' };
const FR = { top: '#5a584e', left: '#26251f', right: '#3a392f', edge: 'rgba(0,0,0,.6)' };
const FLOOR = { top: '#141310', left: '#0b0a09', right: '#0f0e0c', edge: 'rgba(0,0,0,.5)' };
// Blast door: ~2 levels tall, fills the whole tile. Its long axis follows the wall it sits in:
// axis 'x' = wall runs along x (door spans x), axis 'y' = wall runs along y (door spans y).
export class Door extends Entity {
  constructor(def) { super(def); this.open = 0; this.isOpen = false; this.shud = 0; this._ax = null; this._pl = null; this._cp = 0; }
  tiles() { return this.open < 0.8 ? [[this.x, this.y, 2]] : null; }
  axis(w) {
    if (this._ax) return this._ax;
    const tall = (x, y) => w.baseHeight(x, y) >= 2;
    return (this._ax = tall(this.x - 1, this.y) && tall(this.x + 1, this.y) ? 'x' : 'y');
  }
  cogs(w) { return (this.inputs || []).map((id) => w.get(id)).filter((e) => e && e.type === 'cog'); }
  update(dt, w) {
    this.axis(w);
    const jam = this.cogs(w).some((c) => c.jammed);
    const plate = (this.inputs || []).some((id) => { const e = w.get(id); return e && e.type !== 'cog' && e.on; });
    if (this._pl === true && !plate && jam) { this.shud = 0.8; w.sfx('door_open', { volume: 0.25, rate: 0.6 }); w.juice('land', this.x + 0.5, this.y + 0.5, 0.2); }
    this._pl = plate;
    this.shud = Math.max(0, this.shud - dt);
    const want = w.powered(this.inputs);
    const occupied = w.anyOnTile(this.x, this.y, true);
    if (want !== this.isOpen && (want || !occupied)) {
      this.isOpen = want;
      if (want) w.juice('steam', this.x + 0.5, this.y + 0.5);
      w.sfx('door_open', { volume: 0.7, rate: want ? 1 : 0.8 });
    }
    const tgt = this.isOpen ? 1 : 0, prev = this.open;
    this.open += Math.sign(tgt - this.open) * Math.min(Math.abs(tgt - this.open), dt * 2.5);
    this._cp += Math.abs(this.open - prev) * 6 + (jam ? dt * 0.4 : 0);
  }
  draw(ctx, t, w) {
    const o = this.open, h = 2, ax = this.axis(w), x = this.x, y = this.y;
    const jam = this.cogs(w).some((c) => c.jammed);
    // b(u, v, z, du, dv, hh): u runs along the door's span, v across the wall thickness
    const b = (u, v, z, du, dv, hh, c) => (ax === 'x' ? box(ctx, x + u, y + v, z, du, dv, hh, c) : box(ctx, x + v, y + u, z, dv, du, hh, c));
    const pt = (u, v, z) => (ax === 'x' ? P(x + u, y + v, z) : P(x + v, y + u, z));
    const [dsx, dsy] = P(x + 0.5, y + 0.5, 0), gate = this.cogs(w).length > 0;
    const spr = sprites.draw(ctx, (gate ? 'gate_' : 'door') + (o > 0.5 ? (gate ? 'closed' : '_open') : (gate ? 'open' : '')), null, dsx, dsy + 18, 72, ax === 'y');
    if (!spr) {
    b(0, 0.2, 0, 1, 0.6, 0.05, FLOOR);                       // threshold slot
    b(0, 0.15, 0, 0.16, 0.7, h + 0.4, FR);                   // posts
    const sh = this.shud > 0 ? Math.sin(t * 90) * 0.025 * Math.min(1, this.shud * 2) : 0;
    const lw = 0.34 * (1 - o);
    if (lw > 0.01) {
      b(0.16 + sh, 0.3, 0, lw, 0.4, h, DOOR);
      b(0.84 - lw - sh, 0.3, 0, lw, 0.4, h, DOOR);
      const [a, c2] = pt(0.5, 0.7, h * 0.5);
      ctx.save(); ctx.strokeStyle = 'rgba(224,170,40,.55)'; ctx.lineWidth = 3; ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.moveTo(a, c2 - 26); ctx.lineTo(a, c2 + 26); ctx.stroke(); ctx.restore();
    }
    b(0.84, 0.15, 0, 0.16, 0.7, h + 0.4, FR);
    b(0, 0.12, h, 1, 0.76, 0.4, FR);                         // lintel
    }
    const lc = jam ? C.amber : this.isOpen ? C.green : C.red;
    glow(ctx, x + 0.5, y + 0.5, h + 0.2, 3.5, lc);
    if (jam) {
      // stick wedged in the door track
      const [s0x, s0y] = pt(0.2, 0.75, 0.15), [s1x, s1y] = pt(0.8, 0.75, 0.75);
      ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = '#4a3420'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(s0x, s0y); ctx.lineTo(s1x, s1y); ctx.stroke();
      ctx.strokeStyle = '#9a7a4e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(s0x, s0y - 1); ctx.lineTo(s1x, s1y - 1); ctx.stroke();
      const [lx, ly] = pt(0.5, 0.5, h + 0.75);
      ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.strokeText('JAMMED', lx, ly); ctx.fillStyle = C.amber; ctx.fillText('JAMMED', lx, ly);
      ctx.restore();
    }
    // rusty chain conduit from each cog's base along the floor/wall line to this door; faint glow pulse only while active
    for (const cg of this.cogs(w)) {
      const f = cg.face, dx = x + 0.5, dy = y + 0.5, z0 = 0.08;
      const pts = [P(f.x, f.y, 1.0), P(f.x, f.y, z0), P(dx, f.y, z0), P(dx, dy, z0)];
      const act = cg.jammed || this.isOpen, pul = act ? 0.5 + 0.5 * Math.sin(this._cp * Math.PI * 2) : 0;
      ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const path = () => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); };
      ctx.translate(0, 3); path(); ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 5; ctx.stroke(); ctx.translate(0, -3);
      path(); ctx.strokeStyle = '#2a1d14'; ctx.lineWidth = 5; ctx.stroke();
      ctx.strokeStyle = '#8a5230'; ctx.lineWidth = 3; ctx.setLineDash([4, 3]); ctx.stroke();
      ctx.strokeStyle = '#b8794a'; ctx.lineWidth = 1; ctx.setLineDash([2, 5]); ctx.lineDashOffset = 1; ctx.stroke(); ctx.setLineDash([]);
      if (act) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.08 + 0.12 * pul; path(); ctx.strokeStyle = cg.jammed ? C.amber : C.cyan; ctx.lineWidth = 7; ctx.stroke(); }
      ctx.restore();
    }
  }
}
