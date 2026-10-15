/**
 * SpriteRenderer class for Crypts of Shadow (Shadow of the Ronin).
 * Programmatically generates 16x16 pixel-art sprites for the Japanese Samurai theme
 * with side-scroller styling (mossy stone platform walls, transparent ladders,
 * and high-contrast character/item grids).
 * Pre-renders all sprites to offscreen canvases for optimal performance.
 */

class SpriteRenderer {
  constructor() {
    this.sprites = {};
    this.preRenderAll();
  }

  /**
   * Pre-render all sprites to offscreen canvases.
   */
  preRenderAll() {
    const spritesToRender = {
      // --- TILES (16x16) ---
      wall: {
        // Standard solid stone blocks
        palette: {
          '.': null,
          '#': '#0a0a0d', // Dark separator
          'x': '#2d2e33', // Charcoal stone
          'o': '#4b5563', // Slate highlights
          'd': '#1a1b1e', // Dark stone shadows
        },
        grid: [
          '################',
          '#ooooxx#ooooxx##',
          '#oxxxxx#oxxxxx##',
          '#oddddx#oddddx##',
          '################',
          '#oooxxx#oooxxx##',
          '#oxxxxx#oxxxxx##',
          '#oddddx#oddddx##',
          '################',
          '#ooooxx#ooooxx##',
          '#oxxxxx#oxxxxx##',
          '#oddddx#oddddx##',
          '################',
          '#oooxxx#oooxxx##',
          '#oddddx#oddddx##',
          '################'
        ]
      },
      wall_top: {
        // Stone block with a mossy/grassy top for platforms (Dead Cells style)
        palette: {
          '.': null,
          '#': '#0a0a0d',
          'x': '#2d2e33',
          'o': '#4b5563',
          'd': '#1a1b1e',
          'g': '#15803d', // Mossy green
          'l': '#22c55e', // Light green highlights
        },
        grid: [
          'ggggllggllgggggg',
          '#ggllggllggggg##',
          '#ooooxx#ooooxx##',
          '#oxxxxx#oxxxxx##',
          '#oddddx#oddddx##',
          '################',
          '#oooxxx#oooxxx##',
          '#oxxxxx#oxxxxx##',
          '#oddddx#oddddx##',
          '################',
          '#ooooxx#ooooxx##',
          '#oxxxxx#oxxxxx##',
          '#oddddx#oddddx##',
          '################',
          '#oooxxx#oooxxx##',
          '################'
        ]
      },
      floor: {
        // We do not draw standard floor blocks in side-scroller (they are empty air).
        // If drawn, they serve as subtle decorative background lattice or tatami mats
        palette: {
          '.': null,
          't': '#1b1b22', // Very dark background wood grids (almost transparent)
          'o': '#23232c',
          '#': '#111116',
        },
        grid: [
          '################',
          '#tttttttttttttt#',
          '#tootttttttttot#',
          '#tttttttttttttt#',
          '#tttttttttttttt#',
          '#tttttttttttttt#',
          '#tootttttttttot#',
          '#tttttttttttttt#',
          '#tttttttttttttt#',
          '#tttttttttttttt#',
          '#tootttttttttot#',
          '#tttttttttttttt#',
          '#tttttttttttttt#',
          '#tttttttttttttt#',
          '#tootttttttttot#',
          '################'
        ]
      },
      corridor: {
        // Same as floor air space background
        palette: {
          '.': null,
          't': '#181820',
          '#': '#0e0e14',
        },
        grid: [
          '################',
          '#tttttttttttttt#',
          '#tttttttttttttt#',
          '#tttttttttttttt#',
          '#tttttttttttttt#',
          '#tttttttttttttt#',
          '#tttttttttttttt#',
          '#tttttttttttttt#',
          '#tttttttttttttt#',
          '#tttttttttttttt#',
          '#tttttttttttttt#',
          '#tttttttttttttt#',
          '#tttttttttttttt#',
          '#tttttttttttttt#',
          '#tttttttttttttt#',
          '################'
        ]
      },
      stairs_down: {
        // Transparent bamboo ladder
        palette: {
          '.': null,
          'w': '#78350f', // Wood frame
          'h': '#a16207', // Highlight
          'd': '#451a03', // Shadow
        },
        grid: [
          'w############w..',
          'whhhhhhhhhhhwd..',
          'wddwwwwwwwwddw..',
          'w..w......w..w..',
          'w..w......w..w..',
          'whhhhhhhhhhhwd..',
          'wddwwwwwwwwddw..',
          'w..w......w..w..',
          'w..w......w..w..',
          'whhhhhhhhhhhwd..',
          'wddwwwwwwwwddw..',
          'w..w......w..w..',
          'w..w......w..w..',
          'whhhhhhhhhhhwd..',
          'wddwwwwwwwwddw..',
          'w############w..'
        ]
      },
      stairs_up: {
        // Transparent bamboo ladder (matches stairs_down for simplicity)
        palette: {
          '.': null,
          'w': '#78350f',
          'h': '#a16207',
          'd': '#451a03',
        },
        grid: [
          'w############w..',
          'whhhhhhhhhhhwd..',
          'wddwwwwwwwwddw..',
          'w..w......w..w..',
          'w..w......w..w..',
          'whhhhhhhhhhhwd..',
          'wddwwwwwwwwddw..',
          'w..w......w..w..',
          'w..w......w..w..',
          'whhhhhhhhhhhwd..',
          'wddwwwwwwwwddw..',
          'w..w......w..w..',
          'w..w......w..w..',
          'whhhhhhhhhhhwd..',
          'wddwwwwwwwwddw..',
          'w############w..'
        ]
      },
      door: {
        // Sliding Shoji screen door (transparent background)
        palette: {
          '.': null,
          '#': '#0f0d0b',
          'w': 'rgba(248, 250, 252, 0.95)', // White Shoji paper
          'g': 'rgba(203, 213, 225, 0.75)', // Shadows
          'k': '#b45309', // Wooden latch
        },
        grid: [
          '################',
          '#ww#ww#ww#ww#ww#',
          '#ww#ww#ww#ww#ww#',
          '#gg#gg#gg#gg#gg#',
          '################',
          '#ww#ww#ww#ww#ww#',
          '#ww#wkkkkkw#ww#',
          '#gg#gkkkkkg#gg#',
          '################',
          '#ww#ww#ww#ww#ww#',
          '#ww#ww#ww#ww#ww#',
          '#gg#gg#gg#gg#gg#',
          '################',
          '#ww#ww#ww#ww#ww#',
          '#gg#gg#gg#gg#gg#',
          '################'
        ]
      },

      // --- CHARACTERS (16x16) ---
      player: {
        // Samurai Ronin with straw hat, black kimono, and katana
        palette: {
          '.': null,
          '#': '#0a0a0d',
          'k': '#d97706', // Straw hat
          'h': '#fbbf24', // Hat light
          'o': '#92400e', // Hat shadow
          's': '#111827', // Black kimono
          'b': '#e11d48', // Crimson sash
          'f': '#fee2e2', // Face
          'w': '#f1f5f9', // Sword silver
          'r': '#991b1b', // Handle
        },
        grid: [
          '......####......',
          '....#hhhhhh#....',
          '...#hkkkkkko#...',
          '..#hkkkkkkkko#..',
          '.#ookkkkkkkkoo#.',
          '..###ffffff###..',
          '....#fsffsf#....',
          '..ww#ssssss#....',
          '.ww.#sbbbbs#....',
          '..w.#ssssss#....',
          '....#ssssss#....',
          '....#ssssss#....',
          '....#s####s#....',
          '....#s#..#s#....',
          '....#r#..#r#....',
          '....##....##....'
        ]
      },
      rat: {
        // Bakeneko (feral dual-tailed demon cat)
        palette: {
          '.': null,
          '#': '#0f0f14',
          'c': '#1e293b', // Dark fur
          'l': '#475569',
          'e': '#f43f5e', // Crimson eye
          'p': '#c084fc', // Violet scarf
          't': '#1e293b', // Tail
        },
        grid: [
          '................',
          '....##....##....',
          '...#cc#..#cc#...',
          '...#clc##clc#...',
          '...#clccccle#...',
          '....#clcceee#...',
          '....#cccccc##...',
          '..###cccccc#....',
          '#t##pccccc#.....',
          '#t#p#ccccc#.....',
          '.##.#c##c#......',
          '....#c..#c......',
          '...##..##.......',
          '................',
          '................',
          '................'
        ]
      },
      skeleton: {
        // Ashigaru Skeleton with spear and straw hat
        palette: {
          '.': null,
          '#': '#0f0f14',
          'b': '#f1f5f9', // Bones
          's': '#94a3b8',
          'k': '#78350f', // Hat
          'y': '#cbd5e1', // Spear point
          'r': '#a16207', // Shaft
        },
        grid: [
          '......##........',
          '....######......',
          '...#kkkkkk#.....',
          '..#kkkkkkkk#....',
          '..###b##b###.yy.',
          '....#bsb#....yy.',
          '....#bbb#.rr.y..',
          '..rr#sbs#rrr....',
          '.rrr#bbbb#rr....',
          '..r.#bsbs#......',
          '....#bbbb#......',
          '....#b##b#......',
          '....#b..#b#.....',
          '....#s..#s#.....',
          '....#b..#b#.....',
          '....##..##......'
        ]
      },
      ghost: {
        // Yurei (floating white ghost)
        palette: {
          '.': null,
          'g': 'rgba(255, 255, 255, 0.75)',
          's': 'rgba(226, 232, 240, 0.55)',
          'h': '#0a0a0d', // Long hair
          'e': '#06b6d4', // Cyan eyes
          't': '#ffffff',
        },
        grid: [
          '......####......',
          '....##hhhh##....',
          '...#hhththhh#...',
          '..#hhehhhehhh#..',
          '..#hhehhhehhh#..',
          '..#hhhghgghhh#..',
          '..#hggggggssh#..',
          '..#sggsggsssh#..',
          '..#sssssssssh#..',
          '..#sssssssssh#..',
          '...#sssssssh#...',
          '....#sssssh#....',
          '....#sssss#.....',
          '....#s##s#......',
          '....#s..#s......',
          '....#....#......'
        ]
      },
      demon: {
        // Oni (red demon with kanabo)
        palette: {
          '.': null,
          '#': '#1a0505',
          'r': '#dc2626',
          'd': '#7f1d1d',
          'h': '#f8fafc',
          'y': '#facc15',
          'c': '#475569',
          's': '#f1f5f9',
        },
        grid: [
          '......##........',
          '....######......',
          '...#hhhhhh#.....',
          '..#hhyhhyhh#....',
          '..#hyyryyrh#..cc',
          '..#drrrrrd#..csc',
          '..#ddddddd#..csc',
          '..#drrrrrd#..csc',
          '..#drrrrrd#..cc.',
          '..#ddddddd#...c.',
          '..#drrrrrd#...c.',
          '..#ddddddd#...c.',
          '...#d###d#....c.',
          '....#d..#d....c.',
          '....#d..#d......',
          '....##..##......'
        ]
      },

      // --- ITEMS (12x12) ---
      health_potion: {
        is_item: true,
        palette: {
          '.': null,
          '#': '#0f0d0b',
          'g': '#d97706', // Gourd
          'l': '#fbbf24',
          'd': '#b45309',
          'r': '#dc2626',
        },
        grid: [
          '....####....',
          '....#gg#....',
          '....#rr#....',
          '...#rrrr#...',
          '..#gllgd#...',
          '.#glllgd#...',
          '#glllgggd#..',
          '#gllllggd#..',
          '#gllllggd#..',
          '#gddddddd#..',
          '.#ggggggg#..',
          '....####....'
        ]
      },
      attack_scroll: {
        is_item: true,
        palette: {
          '.': null,
          '#': '#1c1917',
          'r': '#dc2626',
          'p': '#fee2e2',
          's': '#f43f5e',
          'g': '#7c2d12',
        },
        grid: [
          '..########..',
          '.#gggggggg#.',
          '#rrrrrrrrrr#',
          '#rppppppppr#',
          '#rppppppppr#',
          '#rppppppppr#',
          '#rpppssrppr#',
          '#rppppppppr#',
          '#rrrrrrrrrr#',
          '#rrrrrrrrrr#',
          '.#gggggggg#.',
          '..########..'
        ]
      },
      defense_scroll: {
        is_item: true,
        palette: {
          '.': null,
          '#': '#1c1917',
          'b': '#2563eb',
          'p': '#dbeafe',
          's': '#1d4ed8',
          'g': '#1e3a8a',
        },
        grid: [
          '..########..',
          '.#gggggggg#.',
          '#bbbbbbbbbb#',
          '#bppppppppb#',
          '#bppppppppb#',
          '#bppppppppb#',
          '#bpppssbppb#',
          '#bppppppppb#',
          '#bbbbbbbbbb#',
          '#bbbbbbbbbb#',
          '.#gggggggg#.',
          '..########..'
        ]
      },
      gold_pile: {
        is_item: true,
        palette: {
          '.': null,
          '#': '#78350f',
          'y': '#fbbf24',
          'h': '#fef08a',
        },
        grid: [
          '............',
          '.....####...',
          '....#yhyy#..',
          '...#yhyyyy#.',
          '..#yhyyyyhy#',
          '.#yhyyyyhy#.',
          '#yyyyyyyyy#.',
          '#yyyyyyyy#..',
          '#yhyyyyy#...',
          '#yyyyyy#....',
          '.######.....',
          '............'
        ]
      },
      key: {
        is_item: true,
        palette: {
          '.': null,
          '#': '#78350f',
          'y': '#fbbf24',
          'h': '#fef08a',
        },
        grid: [
          '....####....',
          '...#yhhy#...',
          '..#yhyyhy#..',
          '...#yhhy#...',
          '....#yd#....',
          '....#yd#....',
          '....#ydy#...',
          '....#ydy#...',
          '....#ydy#...',
          '....#ydyy#..',
          '....#ydyy#..',
          '.....####...'
        ]
      }
    };

    // Render each sprite to an offscreen canvas
    for (const [name, data] of Object.entries(spritesToRender)) {
      const size = data.is_item ? 12 : 16;
      const canvas = document.createElement('canvas');
      canvas.width = 16;
      canvas.height = 16;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;

      // Center 12x12 items in 16x16 canvas
      const offset = data.is_item ? 2 : 0;

      for (let r = 0; r < size; r++) {
        const rowString = data.grid[r];
        for (let c = 0; c < size; c++) {
          const char = rowString[c];
          const color = data.palette[char];
          if (color) {
            ctx.fillStyle = color;
            ctx.fillRect(c + offset, r + offset, 1, 1);
          }
        }
      }

      this.sprites[name] = canvas;
    }
  }

  /**
   * Get pre-rendered canvas for the given sprite.
   */
  getSprite(name) {
    if (this.sprites[name]) {
      return this.sprites[name];
    }
    // Fallback placeholder
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ff00ff';
    ctx.fillRect(0, 0, 16, 16);
    return canvas;
  }

  /**
   * Draw sprite to target canvas context at grid coordinates.
   */
  draw(ctx, spriteName, x, y, tileSize, scale = 1) {
    const spriteCanvas = this.getSprite(spriteName);
    ctx.drawImage(
      spriteCanvas,
      0, 0, 16, 16, // Source
      x, y, tileSize * scale, tileSize * scale // Destination
    );
  }
}
