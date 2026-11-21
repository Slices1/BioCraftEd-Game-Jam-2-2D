import { Body } from './base.js';
import { move } from '../physics.js';
import { P, shadow, glow, poly, facing, C } from '../iso.js';
import { sprites, dir8 } from '../sprites.js';
const FACE_V = { se: 'se', sw: 'se', ne: 'ne', nw: 'ne', e: 'e', w: 'e', n: 'n', s: 's' };

export class Crow extends Body {
  constructor(def) {
    super(def, 0.18);
    this.flying = true; this.z = 1.2; this.carry = null; this.inside = null; this.flapT = 0; this.dead = 0;
  }
  isSolidBody() { return false; }
  fly(dt, mx, my, w) {
    const sp = 3.4;
    this.vx += (mx * sp - this.vx) * Math.min(1, dt * 10);
    this.vy += (my * sp - this.vy) * Math.min(1, dt * 10);
    move(w, this, this.vx * dt, this.vy * dt);
    this.face = facing(this.vx, this.vy, this.face);
    if (Math.hypot(this.vx, this.vy) > 0.3) this.dir = dir8(this.vx, this.vy, this.dir);
    const moving = Math.hypot(mx, my) > 0.2;
    this.flapT -= dt;
    if (moving && this.flapT <= 0) { this.flapT = 0.32; w.sfx('flap', { volume: 0.4, pitchVar: 0.1 }); }
  }
  update(dt, w) {
    if (this.inside) this.hidden = true;
    this.z = 1.2 + Math.sin(w.time * 5) * 0.06;
    if (this.inside || w.ctrl.active !== 'crow') { this.vx *= 0.8; this.vy *= 0.8; }
  }
  draw(ctx, t) {
    if (this.hidden) return;
    const gz = Math.max(0, this.groundZ || 0);
    shadow(ctx, this.x, this.y, gz, 14 - (this.z - gz) * 2, 0.4);
    const [sx, sy] = P(this.x, this.y, this.z);
    const d = this.dir || this.face, sp8 = Math.hypot(this.vx, this.vy), moving = sp8 > 0.3;
    this._amp = (this._amp || 0) + ((moving ? 1 : 0) - (this._amp || 0)) * 0.08;
    const slow = Math.sin(t * (moving ? 5 : 2.4)), bob = slow * 1.6 * (0.5 + this._amp), by = sy + 8 + bob;
    const base = 'crow_flya', sq = 1 + slow * 0.025 * (0.4 + this._amp), W = 58;
    const has = sprites.has(`${base}_${FACE_V[d] || 'e'}`);
    if (has) {
      ctx.save(); ctx.translate(sx, by); ctx.scale(1 / sq, sq); // gentle squash/stretch only, no frame snapping
      const frame = moving && Math.floor(t * 6) % 2 ? 'crow_flyb' : base; // one frame at a time, slow wingbeat while moving
      sprites.drawDir(ctx, frame, d, 0, 0, W);
      ctx.restore();
      return this.drawCarry(ctx, sx, by, d);
    }
    const flip = this.face[1] === 'w' ? -1 : 1, back = this.face[0] === 'n';
    const sp = Math.hypot(this.vx, this.vy), rate = 14 + sp * 3, ph = t * rate;
    const flap = Math.sin(ph), tilt = Math.min(0.25, sp * 0.05);
    ctx.save(); ctx.translate(sx, sy); ctx.scale(flip * 1.3, 1.3); ctx.rotate(tilt * 0.6);
    const wing = (dir, col) => { // dir: -1 far wing, 1 near wing
      const up = flap * 16 * dir;
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-6, -10); ctx.quadraticCurveTo(-4, -26 - up, -22, -30 - up * 1.3);
      ctx.lineTo(-17, -24 - up); ctx.lineTo(-24, -22 - up * 1.1); ctx.lineTo(-15, -17 - up * .6); ctx.lineTo(-20, -13 - up * .4); ctx.quadraticCurveTo(-4, -8, 6, -10); ctx.closePath(); ctx.fill();
    };
    wing(-1, '#08090c');
    // tail
    ctx.fillStyle = '#0a0b0f'; ctx.beginPath(); ctx.moveTo(-12, -10); ctx.lineTo(-28, -6); ctx.lineTo(-27, -11); ctx.lineTo(-30, -13); ctx.lineTo(-12, -15); ctx.closePath(); ctx.fill();
    // body with soft painterly sheen
    const g = ctx.createLinearGradient(0, -22, 0, -2); g.addColorStop(0, '#2a2c3a'); g.addColorStop(0.45, '#111218'); g.addColorStop(1, '#050507');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, -12, 16, 9, -0.12, 0, Math.PI * 2); ctx.fill();
    // head
    ctx.beginPath(); ctx.arc(14, -19, 7.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(120,130,170,0.35)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(14, -19, 6, -2.6, -1.2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, -14, 12, 5, -0.12, -2.8, -1.4); ctx.stroke();
    // beak
    ctx.fillStyle = '#26262b'; ctx.beginPath(); ctx.moveTo(19, -22); ctx.lineTo(31, -18); ctx.lineTo(19, -15); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(20, -18.5); ctx.lineTo(29, -18); ctx.stroke();
    // eye (amber glint, not visible from behind)
    if (!back) { ctx.fillStyle = '#ffcf6a'; ctx.beginPath(); ctx.arc(16, -21, 1.9, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(16.3, -22.3, 1, 1); }
    // legs tucked
    ctx.strokeStyle = '#1b1b20'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(2, -4); ctx.lineTo(-1, 1); ctx.moveTo(6, -4); ctx.lineTo(4, 1); ctx.stroke();
    wing(1, '#14151c');
    ctx.restore();
    this.drawCarry(ctx, sx, sy + 8, this.face);
  }
  drawCarry(ctx, sx, sy, d) {
    if (!this.carry) return;
    // same thin twig for every facing: held at the beak, pointing forward
    const B = { e: [19, -29, -0.15], se: [14, -21, 0.25], s: [4, -15, 0.5], ne: [14, -33, -0.45], n: [-3, -34, -0.7] };
    const k = { sw: 'se', w: 'e', nw: 'ne' }[d] || d, m = d.includes('w') ? -1 : 1, [bx, by, a] = B[k] || B.e;
    ctx.save(); ctx.translate(sx + bx * m, sy + by); ctx.rotate(a * m); ctx.lineCap = 'round';
    ctx.strokeStyle = '#4a3420'; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(-8 * m, 1); ctx.lineTo(10 * m, -1); ctx.moveTo(4 * m, -0.4); ctx.lineTo(8 * m, -5); ctx.stroke();
    ctx.strokeStyle = '#9a7a4e'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(-8 * m, 0.2); ctx.lineTo(10 * m, -1.8); ctx.stroke();
    ctx.restore();
  }
}
