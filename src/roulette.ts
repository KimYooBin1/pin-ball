import { Camera } from './camera';
import { canvasHeight, canvasWidth, initialZoom, Skills, Themes, zoomThreshold } from './data/constants';
import { type StageDef, stages } from './data/maps';
import { FastForwader } from './fastForwader';
import type { GameObject } from './gameObject';
import type { IPhysics } from './IPhysics';
import { Marble } from './marble';
import { Minimap } from './minimap';
import options from './options';
import { ParticleManager } from './particleManager';
import { Box2dPhysics } from './physics-box2d';
import { RankRenderer } from './rankRenderer';
import { RouletteRenderer } from './rouletteRenderer';
import { SkillEffect } from './skillEffect';
import type { ColorTheme } from './types/ColorTheme';
import type { MouseEventHandlerName, MouseEventName } from './types/mouseEvents.type';
import type { UIObject } from './UIObject';
import { bound } from './utils/bound.decorator';
import { parseName, shuffle } from './utils/utils';
import { VideoRecorder } from './utils/videoRecorder';

export class Roulette extends EventTarget {
  private _marbles: Marble[] = [];
  private _eliminatedMarbles: Marble[] = [];

  private _lastTime: number = 0;
  private _elapsed: number = 0;
  private _runTime: number = 0;

  private _updateInterval = 10;
  private _timeScale = 1;
  private _speed = 1;

  private _winners: Marble[] = [];
  private _particleManager = new ParticleManager();
  private _stage: StageDef | null = null;

  protected _camera: Camera = new Camera();
  protected _renderer: RouletteRenderer;

  private _effects: GameObject[] = [];

  private _winnerRank = 0;
  private _totalMarbleCount = 0;
  private _eligibleMarbleCount = 0;
  private _goalDist: number = Infinity;
  private _isRunning: boolean = false;
  private _winner: Marble | null = null;
  private _nameEntries: string[] = [];

  private _uiObjects: UIObject[] = [];

  private _autoRecording: boolean = false;
  private _recorder!: VideoRecorder;

  private physics!: IPhysics;

  private _isReady: boolean = false;
  protected fastForwarder!: FastForwader;
  protected _theme: ColorTheme = Themes.dark;

  get isReady() {
    return this._isReady;
  }

  protected createRenderer(): RouletteRenderer {
    return new RouletteRenderer();
  }

  protected createFastForwader(): FastForwader {
    return new FastForwader();
  }

  constructor() {
    super();
    this._renderer = this.createRenderer();
    this._renderer.init().then(() => {
      this._init().then(() => {
        this._isReady = true;
        this._update();
      });
    });
  }

  public getZoom() {
    return initialZoom * this._camera.zoom;
  }

  private addUiObject(obj: UIObject) {
    this._uiObjects.push(obj);
    if (obj.onWheel) {
      this._renderer.canvas.addEventListener('wheel', obj.onWheel);
    }
    if (obj.onMessage) {
      obj.onMessage((msg) => {
        this.dispatchEvent(new CustomEvent('message', { detail: msg }));
      });
    }
  }

  @bound
  private _update() {
    if (!this._lastTime) this._lastTime = Date.now();
    const currentTime = Date.now();

    this._elapsed += (currentTime - this._lastTime) * this._speed * this.fastForwarder.speed;
    if (this._elapsed > 100) {
      this._elapsed %= 100;
    }
    this._lastTime = currentTime;

    const interval = (this._updateInterval / 1000) * this._timeScale;

    while (this._elapsed >= this._updateInterval) {
      this.physics.step(interval);
      if (this._isRunning) {
        this._runTime += this._updateInterval;
      }
      this._updateMarbles(this._updateInterval);
      this._particleManager.update(this._updateInterval);
      this._updateEffects(this._updateInterval);
      this._elapsed -= this._updateInterval;
      this._uiObjects.forEach((obj) => obj.update(this._updateInterval));
    }

    if (this._marbles.length > 1) {
      this._marbles.sort((a, b) => b.y - a.y);
    }

    if (this._stage) {
      const cameraMarbles = this._getCameraMarbles();
      const targetIndex = Math.max(0, this._winners.length > 0 ? this._winnerRank - this._winners.length : 0);
      this._camera.update({
        marbles: cameraMarbles.length > 0 ? cameraMarbles : this._marbles,
        stage: this._stage,
        needToZoom: this._goalDist < zoomThreshold,
        targetIndex,
      });
    }

    this._render();
    window.requestAnimationFrame(this._update);
  }

  private _updateMarbles(deltaTime: number) {
    if (!this._stage) return;

    for (let i = 0; i < this._marbles.length; i++) {
      const marble = this._marbles[i];
      marble.update(deltaTime);

      if (this._isRunning && this._shouldDrainPrankMarble(marble)) {
        this._drainPrankMarble(marble);
      }

      if (!marble.isDraining && marble.skill === Skills.Impact) {
        this._effects.push(new SkillEffect(marble.x, marble.y));
        this.physics.impact(marble.id);
      }

      if (marble.isEliminated) {
        this._rememberEliminated(marble);
        continue;
      }

      if (!marble.isDraining && marble.y > this._stage.goalY) {
        this._winners.push(marble);
        if (this._isRunning && this._winners.length === this._winnerRank + 1) {
          this.dispatchEvent(new CustomEvent('goal', { detail: { winner: marble.name } }));
          this._winner = marble;
          this._isRunning = false;
          this._particleManager.shot(this._renderer.width, this._renderer.height);
          setTimeout(() => {
            this._recorder.stop();
          }, 1000);
        } else if (this._isRunning && this._winnerRank === this._winners.length && this._winnerRank === this._eligibleMarbleCount - 1) {
          const finalCandidate = this._marbles.find(
            (candidate) =>
              candidate !== marble &&
              !candidate.isPrankTarget &&
              !candidate.isDraining &&
              !candidate.isEliminated &&
              candidate.y <= this._stage!.goalY
          );
          if (finalCandidate) {
            this.dispatchEvent(new CustomEvent('goal', { detail: { winner: finalCandidate.name } }));
            this._winner = finalCandidate;
            this._isRunning = false;
            this._particleManager.shot(this._renderer.width, this._renderer.height);
            setTimeout(() => {
              this._recorder.stop();
            }, 1000);
          }
        }
        setTimeout(() => {
          this.physics.removeMarble(marble.id);
        }, 500);
      }
    }

    const cameraMarbles = this._getCameraMarbles();
    const targetIndex = Math.max(0, this._winnerRank - this._winners.length);
    const topY = cameraMarbles[targetIndex] ? cameraMarbles[targetIndex].y : 0;
    this._goalDist = Math.abs(this._stage.zoomY - topY);
    this._timeScale = this._calcTimeScale(cameraMarbles);

    this._marbles = this._marbles.filter((marble) => (marble.isDraining || marble.y <= this._stage!.goalY) && !marble.isEliminated);
  }

  private _calcTimeScale(targetMarbles: Marble[]): number {
    if (!this._stage || targetMarbles.length === 0) return 1;

    const targetIndex = Math.max(0, Math.min(this._winnerRank - this._winners.length, targetMarbles.length - 1));
    if (this._winners.length < this._winnerRank + 1 && this._goalDist < zoomThreshold) {
      if (
        targetMarbles[targetIndex].y > this._stage.zoomY - zoomThreshold * 1.2 &&
        (targetMarbles[targetIndex - 1] || targetMarbles[targetIndex + 1])
      ) {
        return Math.max(0.2, this._goalDist / zoomThreshold);
      }
    }
    return 1;
  }

  private _getCameraMarbles() {
    const eligibleMarbles = this._marbles.filter((marble) => !marble.isPrankTarget && !marble.isDraining && !marble.isEliminated);
    return eligibleMarbles.length > 0 ? eligibleMarbles : this._marbles.filter((marble) => !marble.isEliminated);
  }

  private _shouldDrainPrankMarble(marble: Marble) {
    if (!this._stage || !marble.isPrankTarget || marble.isDraining || marble.isEliminated) {
      return false;
    }
    return marble.y > this._stage.goalY || marble.y >= marble.prankDrainY || this._runTime >= marble.prankDelayMs;
  }

  private _drainPrankMarble(marble: Marble) {
    if (!this._stage) return;

    const targetX = marble.x < 13 ? 1.25 : 23.75;
    const targetY = Math.min(this._stage.goalY - 2, marble.y + 2.5);
    marble.startPrankDrain({ x: targetX, y: targetY });
    this.physics.removeMarble(marble.id);
    this._effects.push(new SkillEffect(marble.x, marble.y));
    this.dispatchEvent(new CustomEvent('message', { detail: `PRANK MODE drained ${marble.name}` }));
  }

  private _rememberEliminated(marble: Marble) {
    if (!this._eliminatedMarbles.includes(marble)) {
      this._eliminatedMarbles.push(marble);
    }
  }

  private _updateEffects(deltaTime: number) {
    this._effects.forEach((effect) => effect.update(deltaTime));
    this._effects = this._effects.filter((effect) => !effect.isDestroy);
  }

  private _render() {
    if (!this._stage) return;
    const renderParams = {
      camera: this._camera,
      stage: this._stage,
      entities: this.physics.getEntities(),
      marbles: this._marbles,
      winners: this._winners,
      eliminated: this._eliminatedMarbles,
      particleManager: this._particleManager,
      effects: this._effects,
      winnerRank: this._winnerRank,
      winner: this._winner,
      size: { x: this._renderer.width, y: this._renderer.height },
      theme: this._theme,
    };
    this._renderer.render(renderParams, this._uiObjects);
  }

  private async _init() {
    this._recorder = new VideoRecorder(this._renderer.canvas);

    this.physics = new Box2dPhysics();
    await this.physics.init();

    this.addUiObject(new RankRenderer());
    this.attachEvent();
    const minimap = new Minimap();
    minimap.onViewportChange((pos) => {
      if (pos) {
        this._camera.setPosition(pos, false);
        this._camera.lock(true);
      } else {
        this._camera.lock(false);
      }
    });
    this.addUiObject(minimap);
    this.fastForwarder = this.createFastForwader();
    this.addUiObject(this.fastForwarder);
    this._stage = stages[0];
    this._loadMap();
  }

  @bound
  private mouseHandler(eventName: MouseEventName, e: MouseEvent) {
    const handlerName = `on${eventName}` as MouseEventHandlerName;

    const sizeFactor = this._renderer.sizeFactor;
    const pos = { x: e.offsetX * sizeFactor, y: e.offsetY * sizeFactor };
    this._uiObjects.forEach((obj) => {
      if (!obj[handlerName]) return;
      const bounds = obj.getBoundingBox();
      if (!bounds) {
        obj[handlerName]({ ...pos, button: e.button });
      } else if (
        bounds &&
        pos.x >= bounds.x &&
        pos.y >= bounds.y &&
        pos.x <= bounds.x + bounds.w &&
        pos.y <= bounds.y + bounds.h
      ) {
        obj[handlerName]({ x: pos.x - bounds.x, y: pos.y - bounds.y, button: e.button });
      } else {
        obj[handlerName](undefined);
      }
    });
  }

  private attachEvent() {
    const canvas = this._renderer.canvas;
    const onPointerRelease = (e: Event) => {
      this.mouseHandler('MouseUp', e as MouseEvent);
      window.removeEventListener('pointerup', onPointerRelease);
      window.removeEventListener('pointercancel', onPointerRelease);
    };

    canvas.addEventListener('pointerdown', (e: Event) => {
      this.mouseHandler('MouseDown', e as MouseEvent);
      window.addEventListener('pointerup', onPointerRelease);
      window.addEventListener('pointercancel', onPointerRelease);
    });

    ['MouseMove', 'DblClick'].forEach((ev) => {
      // @ts-expect-error
      canvas.addEventListener(ev.toLowerCase().replace('mouse', 'pointer'), this.mouseHandler.bind(this, ev));
    });
    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
  }

  private _loadMap() {
    if (!this._stage) {
      throw new Error('No map has been selected');
    }

    this.physics.createStage(this._stage);
    this._camera.initializePosition();
  }

  public clearMarbles() {
    this.physics.clearMarbles();
    this._winner = null;
    this._winners = [];
    this._eliminatedMarbles = [];
    this._marbles = [];
    this._runTime = 0;
    this._isRunning = false;
    this._totalMarbleCount = 0;
    this._eligibleMarbleCount = 0;
  }

  public start() {
    this._isRunning = true;
    this._runTime = 0;
    this._winnerRank = options.winningRank;
    if (this._winnerRank >= this._eligibleMarbleCount) {
      this._winnerRank = this._eligibleMarbleCount - 1;
    }
    this._camera.startFollowingMarbles();

    if (this._autoRecording) {
      this._recorder.start().then(() => {
        this.physics.start();
        this._marbles.forEach((marble) => (marble.isActive = true));
      });
    } else {
      this.physics.start();
      this._marbles.forEach((marble) => (marble.isActive = true));
    }
  }

  public setSpeed(value: number) {
    if (value <= 0) {
      throw new Error('Speed multiplier must larger than 0');
    }
    this._speed = value;
  }

  public setTheme(themeName: keyof typeof Themes) {
    this._theme = Themes[themeName];
  }

  public getSpeed() {
    return this._speed;
  }

  public setWinningRank(rank: number) {
    this._winnerRank = rank;
  }

  public setAutoRecording(value: boolean) {
    this._autoRecording = value;
  }

  public setMarbles(names: string[]) {
    this.reset();
    this._nameEntries = names.slice();
    const arr = names.slice();

    let maxWeight = -Infinity;
    let minWeight = Infinity;

    const members = arr
      .map((nameString, index) => {
        const result = parseName(nameString);
        if (!result) return null;
        const { name, weight, count } = result;
        if (weight > maxWeight) maxWeight = weight;
        if (weight < minWeight) minWeight = weight;
        return {
          name,
          weight,
          count,
          participantId: `participant-${index}`,
          isPrankTarget: options.prankMode && index === 0,
        };
      })
      .filter((member) => !!member);

    const gap = maxWeight - minWeight;

    let totalCount = 0;
    let eligibleCount = 0;
    members.forEach((member) => {
      if (member) {
        member.weight = 0.1 + (gap ? (member.weight - minWeight) / gap : 0);
        totalCount += member.count;
        if (!member.isPrankTarget) {
          eligibleCount += member.count;
        }
      }
    });

    const orders = shuffle(
      Array(totalCount)
        .fill(0)
        .map((_, i) => i)
    );
    const goalY = this._stage?.goalY ?? 100;
    const drainBaseY = Math.max(10, goalY * 0.18);
    const drainRangeY = Math.max(6, goalY * 0.2);

    members.forEach((member) => {
      if (member) {
        for (let j = 0; j < member.count; j++) {
          const order = orders.pop() || 0;
          const prankDrainY = member.isPrankTarget ? drainBaseY + Math.random() * drainRangeY : 0;
          const prankDelayMs = member.isPrankTarget ? 2200 + Math.random() * 1800 : 0;
          this._marbles.push(
            new Marble(
              this.physics,
              order,
              totalCount,
              member.name,
              member.weight,
              member.participantId,
              member.isPrankTarget,
              prankDrainY,
              prankDelayMs
            )
          );
        }
      }
    });
    this._totalMarbleCount = totalCount;
    this._eligibleMarbleCount = eligibleCount;

    if (totalCount > 0) {
      const cols = Math.min(totalCount, 10);
      const rows = Math.ceil(totalCount / 10);
      const lineDelta = -Math.max(0, Math.ceil(rows - 5));
      const centerX = 10.25 + (cols - 1) * 0.3;
      const centerY = (1 + rows) / 2 + lineDelta;

      const spawnWidth = Math.max((cols - 1) * 0.6, 1);
      const spawnHeight = Math.max(rows - 1, 1);
      const margin = 3;
      const viewW = canvasWidth / initialZoom;
      const viewH = canvasHeight / initialZoom;
      const zoom = Math.max(
        1.5,
        Math.min(Math.min(viewW / (spawnWidth + margin * 2), viewH / (spawnHeight + margin * 2)), 3)
      );

      this._camera.initializePosition({ x: centerX, y: centerY }, zoom);
    }
  }

  private _clearMap() {
    this.physics.clear();
    this._marbles = [];
  }

  public reset() {
    this.clearMarbles();
    this._clearMap();
    this._loadMap();
    this._goalDist = Infinity;
  }

  public getCount() {
    return this._totalMarbleCount;
  }

  public getEligibleCount() {
    return this._eligibleMarbleCount;
  }

  public getMaps() {
    return stages.map((stage, index) => {
      return {
        index,
        title: stage.title,
      };
    });
  }

  public setMap(index: number) {
    if (index < 0 || index > stages.length - 1) {
      throw new Error('Incorrect map number');
    }
    this._stage = stages[index];
    this.setMarbles(this._nameEntries);
    this._camera.initializePosition();
  }
}
