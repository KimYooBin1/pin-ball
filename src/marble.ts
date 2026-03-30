import { Skills, STUCK_DELAY, Themes } from './data/constants';
import type { IPhysics } from './IPhysics';
import options from './options';
import type { ColorTheme } from './types/ColorTheme';
import type { VectorLike } from './types/VectorLike';
import { transformGuard } from './utils/transformGuard';
import { rad } from './utils/utils';
import { Vector } from './utils/Vector';

type MarbleTransform = VectorLike & { angle: number };

export class Marble {
  type = 'marble' as const;
  name: string = '';
  participantId: string = '';
  size: number = 0.5;
  color: string = 'red';
  hue: number = 0;
  impact: number = 0;
  weight: number = 1;
  skill: Skills = Skills.None;
  isActive: boolean = false;
  isPrankTarget: boolean = false;
  prankDrainY: number = 0;
  prankDelayMs: number = 0;
  isDraining: boolean = false;
  isEliminated: boolean = false;

  private _skillRate = 0.0005;
  private _coolTime = 5000;
  private _maxCoolTime = 5000;
  private _stuckTime = 0;
  private _drainElapsed = 0;
  private _drainDuration = 650;
  private _renderScale = 1;
  private _renderOpacity = 1;
  private lastPosition: VectorLike = { x: 0, y: 0 };
  private theme: ColorTheme = Themes.dark;

  private _manualPosition: MarbleTransform | null = null;
  private _drainStartPosition: MarbleTransform | null = null;
  private _drainTarget: VectorLike | null = null;
  private physics: IPhysics;

  id: number;

  get position(): MarbleTransform {
    if (this._manualPosition) {
      return this._manualPosition;
    }
    return this.physics.getMarblePosition(this.id) || { x: 0, y: 0, angle: 0 };
  }

  get x() {
    return this.position.x;
  }

  get y() {
    return this.position.y;
  }

  get angle() {
    return this.position.angle;
  }

  constructor(
    physics: IPhysics,
    order: number,
    max: number,
    name?: string,
    weight: number = 1,
    participantId: string = '',
    isPrankTarget: boolean = false,
    prankDrainY: number = 0,
    prankDelayMs: number = 0
  ) {
    this.name = name || `M${order}`;
    this.weight = weight;
    this.physics = physics;
    this.participantId = participantId || `participant-${order}`;
    this.isPrankTarget = isPrankTarget;
    this.prankDrainY = prankDrainY;
    this.prankDelayMs = prankDelayMs;

    this._maxCoolTime = 1000 + (1 - this.weight) * 4000;
    this._coolTime = this._maxCoolTime * Math.random();
    this._skillRate = 0.2 * this.weight;

    const maxLine = Math.ceil(max / 10);
    const line = Math.floor(order / 10);
    const lineDelta = -Math.max(0, Math.ceil(maxLine - 5));
    this.hue = (360 / max) * order;
    this.color = `hsl(${this.hue} 100% 70%)`;
    this.id = order;

    physics.createMarble(order, 10.25 + (order % 10) * 0.6, maxLine - line + lineDelta);
  }

  update(deltaTime: number) {
    if (this.isEliminated) {
      return;
    }

    if (this.isDraining) {
      this._updateDrain(deltaTime);
      return;
    }

    if (this.isActive && Vector.lenSq(Vector.sub(this.lastPosition, this.position)) < 0.00001) {
      this._stuckTime += deltaTime;

      if (this._stuckTime > STUCK_DELAY) {
        this.physics.shakeMarble(this.id);
        this._stuckTime = 0;
      }
    } else {
      this._stuckTime = 0;
    }
    this.lastPosition = { x: this.position.x, y: this.position.y };

    this.skill = Skills.None;
    if (this.impact) {
      this.impact = Math.max(0, this.impact - deltaTime);
    }
    if (!this.isActive) return;
    if (options.useSkills) {
      this._updateSkillInformation(deltaTime);
    }
  }

  startPrankDrain(target: VectorLike) {
    if (this.isEliminated || this.isDraining) {
      return;
    }

    const currentPosition = this.position;
    this._drainElapsed = 0;
    this._renderScale = 1;
    this._renderOpacity = 1;
    this.isActive = false;
    this.isDraining = true;
    this.skill = Skills.None;
    this.impact = 0;
    this._drainStartPosition = { ...currentPosition };
    this._manualPosition = { ...currentPosition };
    this._drainTarget = target;
  }

  private _updateDrain(deltaTime: number) {
    if (!this._manualPosition || !this._drainStartPosition || !this._drainTarget) {
      return;
    }

    this._drainElapsed += deltaTime;
    const rate = Math.min(1, this._drainElapsed / this._drainDuration);
    const eased = 1 - (1 - rate) ** 3;
    const sway = Math.sin(eased * Math.PI * 4) * 0.3 * (1 - eased);

    this._manualPosition.x = this._drainStartPosition.x + (this._drainTarget.x - this._drainStartPosition.x) * eased + sway;
    this._manualPosition.y = this._drainStartPosition.y + (this._drainTarget.y - this._drainStartPosition.y) * eased;
    this._manualPosition.angle = this._drainStartPosition.angle + eased * Math.PI * 5;
    this._renderScale = Math.max(0.1, 1 - 0.85 * eased);
    this._renderOpacity = Math.max(0, 1 - eased * eased);

    if (rate >= 1) {
      this.isDraining = false;
      this.isEliminated = true;
      this._renderScale = 0;
      this._renderOpacity = 0;
    }
  }

  private _updateSkillInformation(deltaTime: number) {
    if (this._coolTime > 0) {
      this._coolTime -= deltaTime;
    }

    if (this._coolTime <= 0) {
      this.skill = Math.random() < this._skillRate ? Skills.Impact : Skills.None;
      this._coolTime = this._maxCoolTime;
    }
  }

  render(
    ctx: CanvasRenderingContext2D,
    zoom: number,
    outline: boolean,
    isMinimap: boolean = false,
    skin: CanvasImageSource | undefined,
    viewPort: { x: number; y: number; w: number; h: number; zoom: number },
    theme: ColorTheme
  ) {
    if (this.isEliminated) {
      return;
    }

    this.theme = theme;
    const effectiveSize = this.size * Math.max(this._renderScale, 0.1);
    const viewPortHw = viewPort.w / viewPort.zoom / 2;
    const viewPortHh = viewPort.h / viewPort.zoom / 2;
    const viewPortLeft = viewPort.x - viewPortHw;
    const viewPortRight = viewPort.x + viewPortHw;
    const viewPortTop = viewPort.y - viewPortHh - effectiveSize / 2;
    const viewPortBottom = viewPort.y + viewPortHh;
    if (
      !isMinimap &&
      (this.x < viewPortLeft || this.x > viewPortRight || this.y < viewPortTop || this.y > viewPortBottom)
    ) {
      return;
    }

    ctx.save();
    ctx.globalAlpha *= this._renderOpacity;
    if (isMinimap) {
      this._renderMinimap(ctx);
    } else {
      this._renderNormal(ctx, zoom, outline, skin);
    }
    ctx.restore();
  }

  private _renderMinimap(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = this.color;
    this._drawMarbleBody(ctx, true);
  }

  private _drawMarbleBody(ctx: CanvasRenderingContext2D, isMinimap: boolean) {
    const scale = Math.max(this._renderScale, 0.1);
    ctx.beginPath();
    ctx.arc(this.x, this.y, isMinimap ? this.size * scale : (this.size / 2) * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  private _renderNormal(ctx: CanvasRenderingContext2D, zoom: number, outline: boolean, skin?: CanvasImageSource) {
    const hs = (this.size * Math.max(this._renderScale, 0.1)) / 2;
    ctx.fillStyle = `hsl(${this.hue} 100% ${this.theme.marbleLightness + 25 * Math.min(1, this.impact / 500)}%)`;

    if (skin) {
      transformGuard(ctx, () => {
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.drawImage(skin, -hs, -hs, hs * 2, hs * 2);
      });
    } else {
      this._drawMarbleBody(ctx, false);
    }

    ctx.shadowColor = '';
    ctx.shadowBlur = 0;
    this._drawName(ctx, zoom);

    if (outline) {
      this._drawOutline(ctx, 2 / zoom);
    }

    if (options.useSkills) {
      this._renderCoolTime(ctx, zoom);
    }
  }

  private _drawName(ctx: CanvasRenderingContext2D, zoom: number) {
    transformGuard(ctx, () => {
      ctx.font = `12pt sans-serif`;
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 2;
      ctx.fillStyle = this.color;
      ctx.shadowBlur = 0;
      ctx.translate(this.x, this.y + 0.25);
      ctx.scale(1 / zoom, 1 / zoom);
      ctx.strokeText(this.name, 0, 0);
      ctx.fillText(this.name, 0, 0);
    });
  }

  private _drawOutline(ctx: CanvasRenderingContext2D, lineWidth: number) {
    ctx.beginPath();
    ctx.strokeStyle = this.theme.marbleWinningBorder;
    ctx.lineWidth = lineWidth;
    ctx.arc(this.x, this.y, (this.size / 2) * Math.max(this._renderScale, 0.1), 0, Math.PI * 2);
    ctx.stroke();
  }

  private _renderCoolTime(ctx: CanvasRenderingContext2D, zoom: number) {
    ctx.strokeStyle = this.theme.coolTimeIndicator;
    ctx.lineWidth = 1 / zoom;
    ctx.beginPath();
    ctx.arc(
      this.x,
      this.y,
      (this.size / 2) * Math.max(this._renderScale, 0.1) + 2 / zoom,
      rad(270),
      rad(270 + (360 * this._coolTime) / this._maxCoolTime)
    );
    ctx.stroke();
  }
}
