# Files Required to Run The Risky Rescue

To share this game with a friend, you need to send the following files:

## Required Files (Minimum)

### Core Files:
1. **maze-game.html** - Main game file (open this in a browser)
2. **game.js** - All game logic
3. **config.js** - Configuration file (can be empty/default for guest mode)

### Image Assets:
4. **Knight 2.png** (or `knight 2.png`) - Hero image for starting screen
5. **Knight.png** (or `knight.png`) - Knight character in game and intro screen 3
6. **king.png** - King character for intro screens 1 & 2
7. **bad guy.png** - Evil wizard for mid-point screen
8. **princess.png** - Princess for outro screen
9. **castle.png** - Castle image for maze end tiles

## Optional Files (for documentation)
- README.md - Project documentation
- SETUP.md - Google Sheets setup instructions
- QUICKSTART.md - Quick start guide

## What NOT to Send

These files are NOT needed:
- `.gitignore` - Git configuration
- `package.json` - Only needed if using npm
- `vite.config.js` - Only needed for Vite build tool
- Any `node_modules` folder (if it exists)

## External Dependencies (Loaded from Internet)

The following are loaded from CDNs and don't need to be sent:
- Google Fonts (Press Start 2P)
- html2pdf.js library
- Google Identity Services
- Google APIs

**Note:** The game will work in guest mode without Google Sheets configuration. For full functionality with Google Sheets, your friend will need to set up their own Google Cloud credentials in `config.js`.

## How to Share

1. Create a folder containing all the required files listed above
2. Zip the folder
3. Send the zip file to your friend
4. Your friend should:
   - Extract the zip file
   - Open `maze-game.html` in a web browser
   - The game will work immediately in guest mode!

## File Structure

```
Maze Game/
├── maze-game.html      ← Open this file
├── game.js            ← Required
├── config.js          ← Required (can be empty)
├── Knight 2.png       ← Required
├── Knight.png         ← Required
├── king.png           ← Required
├── bad guy.png        ← Required
├── princess.png       ← Required
└── castle.png         ← Required
```

## Troubleshooting

- **Images not showing?** Make sure all image files are in the same folder as `maze-game.html`
- **Case sensitivity:** On Linux, filenames are case-sensitive. Make sure image filenames match exactly (with or without capital letters depending on your system)
- **Google Sign-In not working?** This is normal if `config.js` doesn't have Google credentials. The game works fine in guest mode!
