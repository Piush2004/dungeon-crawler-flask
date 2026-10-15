/**
 * Game class for Crypts of Shadow.
 * Core game loop controller, keyboard input listener, and Flask API client.
 */

class Game {
  constructor() {
    this.gameId = null;
    this.gameState = null;
    this.prevGameState = null;
    this.inputLocked = false;
    this.initialized = false;

    // Last request time to calculate delta times
    this.lastTime = 0;

    // Bind event handlers
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.onUseItem = this.onUseItem.bind(this);
  }

  /**
   * Main game initializer. Set up canvases and UI managers.
   */
  async init() {
    if (this.initialized) return;

    this.canvas = document.getElementById('game-canvas');
    this.spriteRenderer = new SpriteRenderer();
    this.renderer = new GameRenderer(this.canvas, this.spriteRenderer);
    this.uiManager = new UIManager(this.onUseItem);

    // Setup start screen background particles
    this.initStartScreenParticles();

    // Event listeners
    window.addEventListener('keydown', this.handleKeyDown);

    this.initialized = true;

    // Start requestAnimationFrame loop
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  /**
   * Ambient particles on the start screen canvas
   */
  initStartScreenParticles() {
    const pCanvas = document.getElementById('particle-canvas');
    if (!pCanvas) return;
    
    const pCtx = pCanvas.getContext('2d');
    const particles = [];
    
    const resize = () => {
      pCanvas.width = window.innerWidth;
      pCanvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    // Spawn 50 dark fire particles
    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * pCanvas.width,
        y: Math.random() * pCanvas.height,
        vy: -0.2 - Math.random() * 0.6,
        size: 1 + Math.random() * 3,
        alpha: 0.1 + Math.random() * 0.4,
        color: Math.random() > 0.4 ? '#ef4444' : '#f97316' // red/orange
      });
    }

    const anim = () => {
      if (!document.getElementById('start-screen').classList.contains('active')) return;
      
      pCtx.fillStyle = 'rgba(10, 10, 15, 0.2)'; // fade tail
      pCtx.fillRect(0, 0, pCanvas.width, pCanvas.height);

      for (const p of particles) {
        p.y += p.vy;
        if (p.y < 0) {
          p.y = pCanvas.height;
          p.x = Math.random() * pCanvas.width;
        }
        pCtx.fillStyle = p.color;
        pCtx.globalAlpha = p.alpha;
        pCtx.fillRect(p.x, p.y, p.size, p.size);
      }
      pCtx.globalAlpha = 1.0;
      requestAnimationFrame(anim);
    };
    anim();
  }

  /**
   * Starts a brand new game session by calling the Flask API
   */
  async newGame() {
    this.inputLocked = true;
    try {
      const response = await fetch('/api/new-game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      
      this.gameId = data.game_id;
      this.prevGameState = null;
      this.updateState(data);

      this.uiManager.hideStartScreen();
    } catch (err) {
      console.error('Error starting new game:', err);
      alert('Could not connect to Flask backend. Make sure app.py is running on port 5000!');
    } finally {
      this.inputLocked = false;
    }
  }

  /**
   * Dispatches player action to Flask server and processes results
   */
  async sendAction(action, params = {}) {
    if (this.inputLocked || !this.gameId) return;
    if (this.gameState && (this.gameState.game_over || this.gameState.victory)) {
      return; // Stop acting if game ended
    }

    this.inputLocked = true;
    try {
      const response = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          game_id: this.gameId,
          action: action,
          params: params
        })
      });
      const data = await response.json();
      
      this.updateState(data);
    } catch (err) {
      console.error('Error executing action:', err);
    } finally {
      this.inputLocked = false;
    }
  }

  /**
   * Use an item callback from UI slot click
   */
  onUseItem(index) {
    this.sendAction('use_item', { index: index });
  }

  /**
   * Keyboard handler
   */
  handleKeyDown(event) {
    // If not started yet
    const isStartActive = document.getElementById('start-screen').classList.contains('active');
    if (isStartActive) {
      if (event.key === 'Enter') {
        this.newGame();
      }
      return;
    }

    // Restart game
    if (this.gameState && (this.gameState.game_over || this.gameState.victory)) {
      if (event.key.toLowerCase() === 'r') {
        this.newGame();
      }
      return;
    }

    // Actions
    switch (event.key) {
      // Move north
      case 'w':
      case 'W':
      case 'ArrowUp':
        this.sendAction('move', { dx: 0, dy: -1 });
        event.preventDefault();
        break;
      // Move south
      case 's':
      case 'S':
      case 'ArrowDown':
        this.sendAction('move', { dx: 0, dy: 1 });
        event.preventDefault();
        break;
      // Move west
      case 'a':
      case 'A':
      case 'ArrowLeft':
        this.sendAction('move', { dx: -1, dy: 0 });
        event.preventDefault();
        break;
      // Move east
      case 'd':
      case 'D':
      case 'ArrowRight':
        this.sendAction('move', { dx: 1, dy: 0 });
        event.preventDefault();
        break;
      // Jump Up-Left
      case 'q':
      case 'Q':
        this.sendAction('move', { dx: -1, dy: -1 });
        event.preventDefault();
        break;
      // Jump Up-Right
      case 'e':
      case 'E':
        this.sendAction('move', { dx: 1, dy: -1 });
        event.preventDefault();
        break;
      // Attack adjacent enemy
      case ' ':
        if (this.gameState && this.gameState.enemies && this.gameState.player) {
          const px = this.gameState.player.x;
          const py = this.gameState.player.y;
          // Find cardinally adjacent enemies
          const adjacentEnemies = this.gameState.enemies.filter(e => {
            const dx = Math.abs(e.x - px);
            const dy = Math.abs(e.y - py);
            return (dx + dy === 1);
          });
          
          if (adjacentEnemies.length > 0) {
            // Sort by lowest HP to target weakest first
            adjacentEnemies.sort((a, b) => a.hp - b.hp);
            const target = adjacentEnemies[0];
            this.sendAction('move', { dx: target.x - px, dy: target.y - py });
          }
        }
        event.preventDefault();
        break;
      // Wait a turn
      case '.':
      case 'z':
      case 'Z':
        this.sendAction('wait');
        event.preventDefault();
        break;
      // Pick up item
      case 'g':
      case 'G':
        this.sendAction('pickup');
        event.preventDefault();
        break;
      // Descend stairs
      case 'Enter':
        this.sendAction('descend');
        event.preventDefault();
        break;
      // Use inventory slot 1-9
      case '1': case '2': case '3': case '4': case '5':
      case '6': case '7': case '8': case '9':
        const slotIndex = parseInt(event.key) - 1;
        this.onUseItem(slotIndex);
        break;
    }
  }

  /**
   * Diff states to trigger visual animations (slashes, fireballs, blood bursts)
   */
  updateState(newState) {
    this.prevGameState = this.gameState;
    this.gameState = newState;

    // Update UI HUD directly
    this.uiManager.update(this.gameState);

    // If no previous state, skip animations
    if (!this.prevGameState) return;

    const prevP = this.prevGameState.player;
    const currP = this.gameState.player;

    // 1. Player HP Diff (Healing or Damage)
    if (currP.hp < prevP.hp) {
      // Took damage
      const dmg = prevP.hp - currP.hp;
      this.renderer.spawnDamageNumber(currP.x, currP.y, `-${dmg}`, '#ef4444');
      this.renderer.spawnParticleBurst(currP.x, currP.y, '#ef4444', 12); // Red blood burst
      this.renderer.triggerFlash('rgba(239, 68, 68, 0.4)', 220); // Screen red flash
      this.uiManager.flashDamage();
    } else if (currP.hp > prevP.hp) {
      // Healed
      const heal = currP.hp - prevP.hp;
      this.renderer.spawnDamageNumber(currP.x, currP.y, `+${heal}`, '#22c55e');
      this.renderer.spawnParticleBurst(currP.x, currP.y, '#4ade80', 10); // Green healing particles
      this.renderer.triggerFlash('rgba(74, 222, 128, 0.3)', 200); // Screen green flash
      this.uiManager.flashHeal();
    }

    // 2. Level Up Glow
    if (currP.level > prevP.level) {
      this.renderer.spawnParticleBurst(currP.x, currP.y, '#a855f7', 30); // Big purple splash
      this.renderer.triggerFlash('rgba(168, 85, 247, 0.4)', 400); // Purple glow
    }

    // 3. Enemy Diffs (attacks, damages, deaths)
    const prevEnemies = this.prevGameState.enemies;
    const currEnemies = this.gameState.enemies;

    // Detect player attack hits / enemy deaths
    for (const pe of prevEnemies) {
      const ce = currEnemies.find(e => e.id === pe.id);
      
      if (ce) {
        // Enemy still alive, check if they took damage
        if (ce.hp < pe.hp) {
          const dmg = pe.hp - ce.hp;
          this.renderer.spawnDamageNumber(ce.x, ce.y, `${dmg}`, '#fbbf24'); // Gold hit numbers
          this.renderer.spawnParticleBurst(ce.x, ce.y, '#dc2626', 8); // Red enemy blood
          this.renderer.spawnAttackEffect(currP.x, currP.y, ce.x, ce.y, '#e11d48', 'slash'); // katana slash
          // Trigger lunge lurch towards target
          this.renderer.lungePlayer(Math.sign(ce.x - currP.x), Math.sign(ce.y - currP.y));
        }
      } else {
        // Enemy is dead (not found in new enemies list)
        this.renderer.spawnDamageNumber(pe.x, pe.y, 'SLAYED', '#ef4444');
        this.renderer.spawnParticleBurst(pe.x, pe.y, '#fbbf24', 20); // Gold sparks explosion
        this.renderer.spawnAttackEffect(currP.x, currP.y, pe.x, pe.y, '#e11d48', 'slash');
        this.renderer.lungePlayer(Math.sign(pe.x - currP.x), Math.sign(pe.y - currP.y));
      }
    }

    // 4. Enemy attacks (specifically Demon fireballs or standard slashes)
    const latestMessages = this.gameState.messages;
    for (let i = Math.max(0, latestMessages.length - 3); i < latestMessages.length; i++) {
      const msg = latestMessages[i];
      if (msg.includes('fireball') || msg.includes('hurls a fireball')) {
        // Find the Oni
        const demon = currEnemies.find(e => e.type === 'demon');
        if (demon) {
          this.renderer.spawnAttackEffect(demon.x, demon.y, currP.x, currP.y, '#f97316', 'fireball');
          this.renderer.spawnParticleBurst(currP.x, currP.y, '#f97316', 15); // Fire burst on player
          this.renderer.lungeEnemy(demon.id, Math.sign(currP.x - demon.x), Math.sign(currP.y - demon.y));
        }
      } else if (msg.includes('slashes') || msg.includes('strikes') || msg.includes('lunges')) {
        // Find the enemy by checking whose name is in the combat log message
        const enemy = currEnemies.find(e => msg.includes(e.name));
        if (enemy) {
          const dx = Math.sign(currP.x - enemy.x);
          const dy = Math.sign(currP.y - enemy.y);
          this.renderer.lungeEnemy(enemy.id, dx, dy);
          this.renderer.spawnAttackEffect(enemy.x, enemy.y, currP.x, currP.y, '#dc2626', 'slash');
        }
      }
    }
  }

  /**
   * Main game animation frame loop (60 FPS)
   */
  loop(timestamp) {
    const deltaTime = timestamp - this.lastTime;
    this.lastTime = timestamp;

    if (this.gameState) {
      this.renderer.render(this.gameState, deltaTime);
    }

    requestAnimationFrame((t) => this.loop(t));
  }
}

// Global initialization
window.addEventListener('DOMContentLoaded', () => {
  const game = new Game();
  game.init();
});
