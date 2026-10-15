/**
 * GameRenderer class for Crypts of Shadow (Shadow of the Ronin).
 * Renders the HTML5 Canvas game world, camera following, fog of war,
 * smooth movement interpolation (lerping), sakura blossom particles,
 * attack lunge animation effects, and a rich multi-layered parallax background.
 */

class GameRenderer {
  constructor(canvas, spriteRenderer) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.spriteRenderer = spriteRenderer;

    // Tile size configuration (sprites are 16x16, rendered at 32x32)
    this.tileSize = 32;

    // Camera system
    this.camera = {
      x: 0,
      y: 0,
      lerpSpeed: 0.1,
      targetX: 0,
      targetY: 0
    };

    // Smooth movement state
    this.playerDrawX = 0;
    this.playerDrawY = 0;
    this.playerAttackOffsetX = 0;
    this.playerAttackOffsetY = 0;
    this.enemyDrawPositions = {}; // id -> {drawX, drawY, attackOffsetX, attackOffsetY}

    // Effects arrays
    this.particles = [];
    this.damageNumbers = [];
    this.attackEffects = [];

    // Screen flash effect
    this.flashColor = null;
    this.flashDuration = 0;
    this.flashTimer = 0;

    // Animation frames / timers
    this.animationTime = 0;

    // Set canvas smoothing
    this.ctx.imageSmoothingEnabled = false;

    // Resize listener
    window.addEventListener('resize', () => this.resizeCanvas());
    this.resizeCanvas();
  }

  resizeCanvas() {
    // Get parent bounds
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
    this.ctx.imageSmoothingEnabled = false;
  }

  /**
   * Set lunge offset for player katana swing
   */
  lungePlayer(dx, dy) {
    this.playerAttackOffsetX = dx * 16;
    this.playerAttackOffsetY = dy * 16;
  }

  /**
   * Set lunge offset for enemy attack strike
   */
  lungeEnemy(enemyId, dx, dy) {
    const pos = this.enemyDrawPositions[enemyId];
    if (pos) {
      pos.attackOffsetX = dx * 12;
      pos.attackOffsetY = dy * 12;
    }
  }

  /**
   * Draw atmospheric layered parallax background (Dead Cells style)
   */
  renderParallaxBackground() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Layer 1: Sky Gradient (Midnight blue to dark violet)
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    skyGrad.addColorStop(0, '#040409');
    skyGrad.addColorStop(0.5, '#0c071a');
    skyGrad.addColorStop(1, '#1e1429');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // Parallax scroll multipliers
    const px1 = -this.camera.x * 0.12; // Far background
    const py1 = -this.camera.y * 0.08;
    const px2 = -this.camera.x * 0.25; // Medium background
    const py2 = -this.camera.y * 0.18;
    const px3 = -this.camera.x * 0.40; // Midground structures
    const py3 = -this.camera.y * 0.30;

    // Layer 2: Glowing Blood Moon (Far background)
    const moonX = w * 0.72 + px1;
    const moonY = h * 0.28 + py1;
    
    // Moon aura glow
    const moonGlow = ctx.createRadialGradient(moonX, moonY, 10, moonX, moonY, 65);
    moonGlow.addColorStop(0, 'rgba(239, 68, 68, 0.4)');
    moonGlow.addColorStop(0.4, 'rgba(244, 114, 182, 0.15)');
    moonGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = moonGlow;
    ctx.beginPath();
    ctx.arc(moonX, moonY, 65, 0, Math.PI * 2);
    ctx.fill();

    // Solid Moon core
    ctx.fillStyle = '#fee2e2'; // Pale white-pink
    ctx.beginPath();
    ctx.arc(moonX, moonY, 32, 0, Math.PI * 2);
    ctx.fill();

    // Layer 3: Silhouette of Distant Pagoda & Mountains (Medium background)
    ctx.fillStyle = '#0f0a1d'; // Dark violet silhouette
    const mountY = h * 0.65 + py2;
    
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, mountY);
    
    // Pagoda roof drawing coordinates
    const pagX = (w * 0.28 + px2) % (w * 1.5);
    ctx.lineTo(pagX - 40, mountY);
    ctx.lineTo(pagX - 30, mountY - 30); // Level 1 roof
    ctx.lineTo(pagX - 35, mountY - 30);
    ctx.lineTo(pagX - 25, mountY - 60); // Level 2 roof
    ctx.lineTo(pagX - 30, mountY - 60);
    ctx.lineTo(pagX - 15, mountY - 95); // Level 3 roof
    ctx.lineTo(pagX - 20, mountY - 95);
    ctx.lineTo(pagX, mountY - 130); // Pagoda tip
    ctx.lineTo(pagX + 20, mountY - 95);
    ctx.lineTo(pagX + 15, mountY - 95);
    ctx.lineTo(pagX + 30, mountY - 60);
    ctx.lineTo(pagX + 25, mountY - 60);
    ctx.lineTo(pagX + 35, mountY - 30);
    ctx.lineTo(pagX + 30, mountY - 30);
    ctx.lineTo(pagX + 40, mountY);

    // Continue mountain silhouettes
    ctx.lineTo(w * 0.5 + px2, mountY + 40);
    ctx.lineTo(w * 0.75 + px2, mountY - 80);
    ctx.lineTo(w + px2, mountY);
    ctx.lineTo(w * 1.5 + px2, mountY + 80);
    ctx.lineTo(w * 1.5 + px2, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();

    // Layer 4: Distant Torches & Ruined Castle Walls (Dcloser midground)
    ctx.fillStyle = '#140f24'; // Lighter violet castle stone
    const wallY = h * 0.75 + py3;
    
    // Draw repeat castle pillars/beams cardinally
    for (let i = -1; i < 4; i++) {
      const startX = px3 + (i * w * 0.5);
      
      // Draw wall pillar
      ctx.fillRect(startX, wallY, 90, h - wallY);
      
      // Draw connecting hanging chains
      ctx.strokeStyle = 'rgba(20, 15, 36, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(startX + 120, wallY + 20, 40, 0, Math.PI);
      ctx.stroke();

      // Draw little hanging lanterns
      const lanX = startX + 120;
      const lanY = wallY + 60;
      ctx.fillStyle = '#140f24';
      ctx.fillRect(lanX - 4, lanY - 12, 8, 14); // lantern body
      
      // Fire glow inside lantern
      const pulse = Math.sin(this.animationTime * 8 + i) * 2;
      ctx.fillStyle = '#f97316'; // orange glow
      ctx.beginPath();
      ctx.arc(lanX, lanY - 3, 3 + pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#140f24'; // restore fill style
    }
  }

  /**
   * Main rendering update loop.
   * Runs at 60 FPS via requestAnimationFrame.
   */
  render(gameState, deltaTime = 16.67) {
    if (!gameState) return;

    this.animationTime += deltaTime * 0.005;

    // 1. Update Player Draw Position & Camera
    const player = gameState.player;
    if (player) {
      const targetX = player.x * this.tileSize;
      const targetY = player.y * this.tileSize;

      if (this.playerDrawX === 0 && this.playerDrawY === 0) {
        this.playerDrawX = targetX;
        this.playerDrawY = targetY;
      } else {
        // Lerp to target position
        this.playerDrawX += (targetX - this.playerDrawX) * 0.22;
        this.playerDrawY += (targetY - this.playerDrawY) * 0.22;
      }

      // Decay attack lunge offset
      this.playerAttackOffsetX += (0 - this.playerAttackOffsetX) * 0.25;
      this.playerAttackOffsetY += (0 - this.playerAttackOffsetY) * 0.25;

      // Camera follows draw position smoothly
      const targetCamX = this.playerDrawX - this.canvas.width / 2 + this.tileSize / 2;
      const targetCamY = this.playerDrawY - this.canvas.height / 2 + this.tileSize / 2;
      
      if (this.camera.x === 0 && this.camera.y === 0) {
        this.camera.x = targetCamX;
        this.camera.y = targetCamY;
      } else {
        this.camera.x += (targetCamX - this.camera.x) * this.camera.lerpSpeed;
        this.camera.y += (targetCamY - this.camera.y) * this.camera.lerpSpeed;
      }
    }

    // Spawn falling sakura cherry blossoms
    if (Math.random() < 0.12) {
      this.particles.push({
        x: this.camera.x + Math.random() * this.canvas.width + 150,
        y: this.camera.y - 20,
        vx: -0.8 - Math.random() * 1.2, // wind drift left
        vy: 0.6 + Math.random() * 0.8, // gravity fall down
        color: Math.random() > 0.4 ? '#fbcfe8' : '#f472b6', // pink sakura petals
        alpha: 0.35 + Math.random() * 0.5,
        size: 3 + Math.random() * 3,
        life: 0,
        maxLife: 200 + Math.random() * 150,
        type: 'sakura',
        angle: Math.random() * Math.PI * 2,
        rotSpeed: -0.02 + Math.random() * 0.04
      });
    }

    // 2. Render Parallax Background
    this.renderParallaxBackground();

    // Save context for camera translation
    this.ctx.save();
    this.ctx.translate(-Math.round(this.camera.x), -Math.round(this.camera.y));

    // 3. Render Layers
    this.renderTiles(gameState.map);
    this.renderItems(gameState.items, gameState.map);
    this.renderEnemies(gameState.enemies);
    this.renderPlayer(gameState.player);
    this.renderAttackEffects(deltaTime);
    this.renderParticles(deltaTime);
    this.renderDamageNumbers(deltaTime);

    // Restore context from camera translation
    this.ctx.restore();

    // 4. Render UI / Vignette overlay (screen space)
    this.renderVignette();
    this.renderScreenFlash(deltaTime);
  }

  /**
   * Render tiles in grid (Draws walls as suspended stone platforms)
   */
  renderTiles(mapData) {
    if (!mapData) return;

    const tiles = mapData.tiles;
    const visible = mapData.visible;
    const explored = mapData.explored;
    const width = mapData.width;
    const height = mapData.height;

    // Viewport bounds (cull tiles that are offscreen)
    const minX = Math.max(0, Math.floor(this.camera.x / this.tileSize));
    const maxX = Math.min(width - 1, Math.ceil((this.camera.x + this.canvas.width) / this.tileSize));
    const minY = Math.max(0, Math.floor(this.camera.y / this.tileSize));
    const maxY = Math.min(height - 1, Math.ceil((this.camera.y + this.canvas.height) / this.tileSize));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const isVisible = visible[y][x];
        const isExplored = explored[y][x];
        
        if (!isExplored) continue;

        const tileType = tiles[y][x];
        let spriteName = null;

        // Platformer rendering:
        // FLOOR (1) and CORRIDOR (2) are empty air space, showing the parallax background
        if (tileType === 0) {
          // Solid ground WALL: Check if this is the surface of a platform (tile above is passable air/ladder)
          const aboveTile = (y - 1 >= 0) ? tiles[y - 1][x] : 0;
          const isTop = (aboveTile !== 0); // 0 = WALL, so if above is NOT 0, this is a platform top
          spriteName = isTop ? 'wall_top' : 'wall';
        }
        else if (tileType === 3) spriteName = 'stairs_down'; // Ladder
        else if (tileType === 4) spriteName = 'door';        // Sliding Shoji screen door
        else if (tileType === 5) spriteName = 'stairs_up';   // Ladder

        const px = x * this.tileSize;
        const py = y * this.tileSize;

        // Draw tile if it has an associated sprite
        if (spriteName) {
          this.spriteRenderer.draw(this.ctx, spriteName, px, py, this.tileSize);
        }

        // Apply Fog of War shading
        if (!isVisible) {
          this.ctx.fillStyle = 'rgba(5, 5, 8, 0.7)'; // 70% dark overlay for explored
          this.ctx.fillRect(px, py, this.tileSize, this.tileSize);
        }
      }
    }
  }

  /**
   * Render items with floating bob animation
   */
  renderItems(items, mapData) {
    if (!items || !mapData) return;

    const visible = mapData.visible;

    for (const item of items) {
      if (!visible[item.y][item.x]) continue;

      const px = item.x * this.tileSize;
      const bobOffset = Math.sin(this.animationTime * 4 + item.id) * 3;
      const py = item.y * this.tileSize + bobOffset;

      this.spriteRenderer.draw(this.ctx, item.type, px, py, this.tileSize);
    }
  }

  /**
   * Render enemies with smooth movement interpolation and health bars
   */
  renderEnemies(enemies) {
    if (!enemies) return;

    // Clean up draw positions cache for dead enemies
    const activeIds = new Set(enemies.map(e => e.id));
    for (const id in this.enemyDrawPositions) {
      if (!activeIds.has(Number(id))) {
        delete this.enemyDrawPositions[id];
      }
    }

    for (const enemy of enemies) {
      if (!enemy.visible) continue;

      const targetX = enemy.x * this.tileSize;
      const targetY = enemy.y * this.tileSize;

      // Initialize position if not cached
      if (!this.enemyDrawPositions[enemy.id]) {
        this.enemyDrawPositions[enemy.id] = {
          drawX: targetX,
          drawY: targetY,
          attackOffsetX: 0,
          attackOffsetY: 0
        };
      }

      const pos = this.enemyDrawPositions[enemy.id];
      // Lerp positioning
      pos.drawX += (targetX - pos.drawX) * 0.22;
      pos.drawY += (targetY - pos.drawY) * 0.22;

      // Decay attack lunge
      pos.attackOffsetX += (0 - pos.attackOffsetX) * 0.25;
      pos.attackOffsetY += (0 - pos.attackOffsetY) * 0.25;

      const px = pos.drawX + pos.attackOffsetX;
      const py = pos.drawY + pos.attackOffsetY + Math.sin(this.animationTime * 3.5 + enemy.id) * 1.2;

      // Draw sprite
      this.spriteRenderer.draw(this.ctx, enemy.type, px, py, this.tileSize);

      // Render health bar
      this.renderHealthBar(px, py, enemy.hp, enemy.max_hp);
    }
  }

  /**
   * Render player with smooth movement interpolation
   */
  renderPlayer(player) {
    if (!player) return;

    const px = this.playerDrawX + this.playerAttackOffsetX;
    const py = this.playerDrawY + this.playerAttackOffsetY + Math.sin(this.animationTime * 5.0) * 1.0;

    this.spriteRenderer.draw(this.ctx, 'player', px, py, this.tileSize);
  }

  /**
   * Draw HP bar above enemies (using smooth draw position)
   */
  renderHealthBar(px, py, hp, maxHp) {
    const barW = 24;
    const barH = 3;
    const barX = px + (this.tileSize - barW) / 2;
    const barY = py - 6;

    // Background border
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

    // HP Fill
    const fillW = Math.max(0, (hp / maxHp) * barW);
    this.ctx.fillStyle = '#dc2626'; // Samurai crimson red
    this.ctx.fillRect(barX, barY, fillW, barH);
  }

  /**
   * Particle burst emitter
   */
  spawnParticleBurst(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.8 + Math.random() * 2.2;
      this.particles.push({
        x: x + this.tileSize / 2,
        y: y + this.tileSize / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.3,
        color: color,
        alpha: 1.0,
        size: 1.5 + Math.random() * 2.5,
        life: 0,
        maxLife: 15 + Math.random() * 15,
        type: 'dust'
      });
    }
  }

  /**
   * Render and update particles (normal dust and cherry blossom petals)
   */
  renderParticles(deltaTime) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += deltaTime / 16.67;

      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }

      // Physics
      if (p.type === 'sakura') {
        p.x += p.vx + Math.sin(p.life * 0.04) * 0.45; // gentle swaying
        p.y += p.vy;
        p.angle += p.rotSpeed || 0;
      } else {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.04; // gravity
      }

      p.alpha = 1.0 - (p.life / p.maxLife);

      // Draw
      this.ctx.save();
      this.ctx.globalAlpha = p.alpha;
      this.ctx.fillStyle = p.color;

      if (p.type === 'sakura') {
        this.ctx.translate(p.x, p.y);
        this.ctx.rotate(p.angle);
        // Draw petal shape (oval stretch)
        this.ctx.beginPath();
        this.ctx.ellipse(0, 0, p.size, p.size * 0.5, 0, 0, Math.PI * 2);
        this.ctx.fill();
      } else {
        this.ctx.fillRect(p.x - p.size/2, p.y - p.size/2, p.size, p.size);
      }
      
      this.ctx.restore();
    }
    this.ctx.globalAlpha = 1.0;
  }

  /**
   * Screen Flash trigger
   */
  triggerFlash(color, duration = 200) {
    this.flashColor = color;
    this.flashDuration = duration;
    this.flashTimer = duration;
  }

  renderScreenFlash(deltaTime) {
    if (this.flashTimer > 0 && this.flashColor) {
      this.flashTimer -= deltaTime;
      const alpha = (this.flashTimer / this.flashDuration) * 0.35;
      this.ctx.fillStyle = this.flashColor;
      this.ctx.globalAlpha = alpha;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.globalAlpha = 1.0;
    }
  }

  /**
   * Floating hit damage text
   */
  spawnDamageNumber(gridX, gridY, text, color = '#ef4444') {
    this.damageNumbers.push({
      x: gridX * this.tileSize + this.tileSize / 2,
      y: gridY * this.tileSize,
      text: text,
      color: color,
      life: 0,
      maxLife: 40
    });
  }

  renderDamageNumbers(deltaTime) {
    this.ctx.font = 'bold 10px "Press Start 2P", monospace';
    this.ctx.textAlign = 'center';

    for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
      const n = this.damageNumbers[i];
      n.life += deltaTime / 16.67;

      if (n.life >= n.maxLife) {
        this.damageNumbers.splice(i, 1);
        continue;
      }

      const pct = n.life / n.maxLife;
      const offset = pct * 24; // rise
      const alpha = 1.0 - pct;

      this.ctx.fillStyle = n.color;
      this.ctx.shadowColor = 'black';
      this.ctx.shadowBlur = 3;
      this.ctx.globalAlpha = alpha;
      
      this.ctx.fillText(n.text, n.x, n.y - offset);
    }
    this.ctx.globalAlpha = 1.0;
    this.ctx.shadowBlur = 0;
  }

  /**
   * Attack visuals (crimson sword cuts or fireball projectiles)
   */
  spawnAttackEffect(fromGridX, fromGridY, toGridX, toGridY, color = '#dc2626', type = 'slash') {
    this.attackEffects.push({
      fx: fromGridX * this.tileSize + this.tileSize / 2,
      fy: fromGridY * this.tileSize + this.tileSize / 2,
      tx: toGridX * this.tileSize + this.tileSize / 2,
      ty: toGridY * this.tileSize + this.tileSize / 2,
      color: color,
      type: type,
      life: 0,
      maxLife: 8
    });
  }

  renderAttackEffects(deltaTime) {
    for (let i = this.attackEffects.length - 1; i >= 0; i--) {
      const eff = this.attackEffects[i];
      eff.life += deltaTime / 16.67;

      if (eff.life >= eff.maxLife) {
        this.attackEffects.splice(i, 1);
        continue;
      }

      this.ctx.strokeStyle = eff.color;
      this.ctx.shadowColor = eff.color;
      this.ctx.shadowBlur = 6;
      
      if (eff.type === 'slash') {
        const pct = eff.life / eff.maxLife;
        this.ctx.lineWidth = 3 * (1.0 - pct);
        
        const dx = eff.tx - eff.fx;
        const dy = eff.ty - eff.fy;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const midX = eff.tx;
        const midY = eff.ty;

        const perpX = -dy / dist * 14;
        const perpY = dx / dist * 14;

        this.ctx.beginPath();
        this.ctx.moveTo(midX - perpX, midY - perpY);
        this.ctx.lineTo(midX + perpX, midY + perpY);
        this.ctx.stroke();
      } 
      else if (eff.type === 'fireball') {
        const pct = eff.life / eff.maxLife;
        const currentX = eff.fx + (eff.tx - eff.fx) * pct;
        const currentY = eff.fy + (eff.ty - eff.fy) * pct;
        
        this.ctx.fillStyle = '#f97316';
        this.ctx.beginPath();
        this.ctx.arc(currentX, currentY, 6, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.fillStyle = '#facc15';
        this.ctx.beginPath();
        this.ctx.arc(currentX, currentY, 3, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }
    this.ctx.shadowBlur = 0;
  }

  /**
   * Shadow tunnel vignette overlay
   */
  renderVignette() {
    const gradient = this.ctx.createRadialGradient(
      this.canvas.width / 2, this.canvas.height / 2, this.canvas.width / 4,
      this.canvas.width / 2, this.canvas.height / 2, this.canvas.width * 0.7
    );
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.85)');

    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
