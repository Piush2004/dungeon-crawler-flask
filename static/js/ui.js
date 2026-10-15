/**
 * UIManager class for Crypts of Shadow.
 * Handles HUD stat updates, message log parsing and colorization,
 * interactive inventory slots, and rendering the dungeon minimap.
 */

class UIManager {
  constructor(onUseItem) {
    // Callback when player uses an item
    this.onUseItem = onUseItem;

    // Cache elements
    this.levelIndicator = document.getElementById('level-indicator');
    this.hpBar = document.getElementById('hp-bar');
    this.hpText = document.getElementById('hp-text');
    this.xpBar = document.getElementById('xp-bar');
    this.xpText = document.getElementById('xp-text');
    this.attackVal = document.getElementById('stat-attack');
    this.defenseVal = document.getElementById('stat-defense');
    this.levelVal = document.getElementById('stat-level');
    this.goldVal = document.getElementById('stat-gold');
    this.inventoryList = document.getElementById('inventory-list');
    this.messageLog = document.getElementById('message-log');
    this.minimapCanvas = document.getElementById('minimap-canvas');
    this.minimapCtx = this.minimapCanvas.getContext('2d');

    // Screens
    this.startScreen = document.getElementById('start-screen');
    this.deathScreen = document.getElementById('death-screen');
    this.victoryScreen = document.getElementById('victory-screen');
    this.deathStats = document.getElementById('death-stats');
    this.victoryStats = document.getElementById('victory-stats');
    this.screenFlash = document.getElementById('screen-flash');
  }

  /**
   * Main update entry point, refresh all UI elements from game state.
   */
  update(gameState) {
    if (!gameState) return;

    this.updateStats(gameState.player);
    this.updateInventory(gameState.player.inventory);
    this.updateMessages(gameState.messages);
    this.updateMinimap(gameState.map, gameState.player, gameState.enemies);
    this.updateLevelIndicator(gameState.current_level);
    this.updateScreens(gameState);
  }

  updateLevelIndicator(level) {
    if (this.levelIndicator) {
      this.levelIndicator.textContent = level;
    }
  }

  updateStats(player) {
    if (!player) return;

    // HP Bar
    const hpPct = Math.max(0, Math.min(100, (player.hp / player.max_hp) * 100));
    this.hpBar.style.width = `${hpPct}%`;
    this.hpText.textContent = `${player.hp} / ${player.max_hp}`;

    // XP Bar
    const xpPct = Math.max(0, Math.min(100, (player.xp / player.xp_to_next) * 100));
    this.xpBar.style.width = `${xpPct}%`;
    this.xpText.textContent = `${player.xp} / ${player.xp_to_next}`;

    // Numeric Stats
    this.attackVal.textContent = player.attack;
    this.defenseVal.textContent = player.defense;
    this.levelVal.textContent = player.level;
    this.goldVal.textContent = player.gold;
  }

  updateInventory(inventory) {
    if (!this.inventoryList) return;

    this.inventoryList.innerHTML = '';

    if (!inventory || inventory.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'inventory-empty';
      emptyDiv.textContent = 'Empty';
      this.inventoryList.appendChild(emptyDiv);
      return;
    }

    // Maximum 10 items
    for (let i = 0; i < 10; i++) {
      const item = inventory[i];
      const slot = document.createElement('div');
      slot.className = 'inventory-item';

      if (item) {
        // Short code symbol mapping
        let emoji = '🎒';
        if (item.type === 'health_potion') emoji = '🧪';
        else if (item.type === 'attack_scroll') emoji = '📜';
        else if (item.type === 'defense_scroll') emoji = '🛡️';
        else if (item.type === 'key') emoji = '🔑';

        slot.innerHTML = `
          <span class="item-key">${i + 1}</span>
          <span class="item-emoji">${emoji}</span>
          <span class="item-name">${item.name}</span>
        `;

        slot.addEventListener('click', () => {
          this.onUseItem(i);
        });
      } else {
        slot.innerHTML = `
          <span class="item-key">${i + 1}</span>
          <span class="item-name" style="color: var(--text-dim);">-</span>
        `;
        slot.style.cursor = 'default';
        slot.style.pointerEvents = 'none';
      }

      this.inventoryList.appendChild(slot);
    }
  }

  updateMessages(messages) {
    if (!this.messageLog || !messages) return;

    // Check if new messages have arrived
    const currentCount = this.messageLog.children.length;
    
    // We only redraw if message counts or contents change
    this.messageLog.innerHTML = '';
    
    for (const msg of messages) {
      const msgDiv = document.createElement('div');
      msgDiv.className = 'message';
      msgDiv.textContent = msg;

      // Color code based on content
      if (msg.includes('hit') || msg.includes('strike') || msg.includes('defeat') || msg.includes('dies')) {
        if (msg.includes('You strike') || msg.includes('You hit')) {
          msgDiv.classList.add('msg-player-atk'); // Gold
        } else if (msg.includes('attacks you') || msg.includes('breathes a fireball')) {
          msgDiv.classList.add('msg-enemy-atk'); // Crimson
        } else if (msg.includes('dies')) {
          msgDiv.classList.add('msg-pickup'); // Greenish/gold
        }
      } else if (msg.includes('pick up') || msg.includes('drink') || msg.includes('read') || msg.includes('recover') || msg.includes('open')) {
        msgDiv.classList.add('msg-pickup'); // Light green
      } else if (msg.includes('LEVEL UP')) {
        msgDiv.classList.add('msg-level-up'); // Glowing Purple
      } else if (msg.includes('Welcome') || msg.includes('descend')) {
        msgDiv.classList.add('msg-level-change'); // Cyan
      } else if (msg.includes('slain') || msg.includes('Game Over')) {
        msgDiv.classList.add('msg-enemy-atk'); // Dead red
      } else {
        msgDiv.classList.add('msg-system'); // Soft Gray
      }

      this.messageLog.appendChild(msgDiv);
    }

    // Scroll to bottom
    this.messageLog.scrollTop = this.messageLog.scrollHeight;
  }

  updateMinimap(mapData, player, enemies) {
    if (!this.minimapCanvas || !mapData || !player) return;

    const ctx = this.minimapCtx;
    const w = this.minimapCanvas.width;
    const h = this.minimapCanvas.height;

    // Clear minimap
    ctx.fillStyle = '#050508';
    ctx.fillRect(0, 0, w, h);

    const tiles = mapData.tiles;
    const explored = mapData.explored;
    const visible = mapData.visible;
    const mapW = mapData.width;
    const mapH = mapData.height;

    // Calculate scale factor to center and fit the map
    const scale = Math.min(w / mapW, h / mapH);
    const offsetX = (w - mapW * scale) / 2;
    const offsetY = (h - mapH * scale) / 2;

    for (let y = 0; y < mapH; y++) {
      for (let x = 0; x < mapW; x++) {
        if (!explored[y][x]) continue;

        const tileType = tiles[y][x];
        const isVisible = visible[y][x];

        // Draw basic map tiles
        if (tileType === 0) {
          // Wall
          ctx.fillStyle = isVisible ? '#4b5563' : '#1f2937'; // Gray vs dark gray
        } else if (tileType === 3 || tileType === 5) {
          // Stairs down or up
          ctx.fillStyle = '#f59e0b'; // Gold
        } else if (tileType === 4) {
          // Door
          ctx.fillStyle = '#b45309'; // Brown
        } else {
          // Floor or Corridor
          ctx.fillStyle = isVisible ? '#9ca3af' : '#374151'; // Light vs dark
        }

        ctx.fillRect(offsetX + x * scale, offsetY + y * scale, scale - 0.2, scale - 0.2);
      }
    }

    // Draw visible enemies as red dots
    if (enemies) {
      ctx.fillStyle = '#ef4444';
      for (const enemy of enemies) {
        if (enemy.visible) {
          ctx.fillRect(offsetX + enemy.x * scale, offsetY + enemy.y * scale, scale, scale);
        }
      }
    }

    // Draw player as glowing white dot
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 2;
    ctx.shadowColor = '#60a5fa';
    ctx.fillRect(offsetX + player.x * scale, offsetY + player.y * scale, scale + 0.5, scale + 0.5);
    ctx.shadowBlur = 0; // reset
  }

  updateScreens(gameState) {
    // Game Over Overlay
    if (gameState.game_over) {
      this.deathScreen.classList.add('active');
      this.deathStats.innerHTML = `
        <p>Reached Level: <span class="stat-highlight">${gameState.current_level}</span></p>
        <p>Gold Collected: <span class="stat-highlight">${gameState.player.gold} gold</span></p>
        <p>Character Level: <span class="stat-highlight">Level ${gameState.player.level}</span></p>
        <p>Turns Survived: <span class="stat-highlight">${gameState.turn_count} turns</span></p>
      `;
    } else {
      this.deathScreen.classList.remove('active');
    }

    // Victory Overlay
    if (gameState.victory) {
      this.victoryScreen.classList.add('active');
      this.victoryStats.innerHTML = `
        <p>Conquered Crypts: <span class="stat-highlight">LEVEL ${gameState.current_level}</span></p>
        <p>Final Gold: <span class="stat-highlight">${gameState.player.gold} gold</span></p>
        <p>Hero Level: <span class="stat-highlight">Level ${gameState.player.level}</span></p>
        <p>Total Turns: <span class="stat-highlight">${gameState.turn_count} turns</span></p>
      `;
    } else {
      this.victoryScreen.classList.remove('active');
    }
  }

  flashDamage() {
    this.screenFlash.classList.remove('flash-heal');
    this.screenFlash.classList.add('flash-damage');
    // Force reflow
    this.screenFlash.offsetWidth;
    this.screenFlash.style.animation = 'none';
    this.screenFlash.offsetHeight;
    this.screenFlash.style.animation = null;
  }

  flashHeal() {
    this.screenFlash.classList.remove('flash-damage');
    this.screenFlash.classList.add('flash-heal');
    // Force reflow
    this.screenFlash.offsetWidth;
    this.screenFlash.style.animation = 'none';
    this.screenFlash.offsetHeight;
    this.screenFlash.style.animation = null;
  }

  hideStartScreen() {
    if (this.startScreen) {
      this.startScreen.classList.remove('active');
    }
  }

  showStartScreen() {
    if (this.startScreen) {
      this.startScreen.classList.add('active');
    }
  }
}
