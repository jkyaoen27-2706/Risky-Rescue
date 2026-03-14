# Files to Upload to GitLab for Pages Deployment

## Required Files (Upload these to GitLab)

### Core Game Files:
1. ✅ **maze-game.html** - Main game file
2. ✅ **game.js** - Game logic (44KB)
3. ✅ **config.js** - Configuration file (can be empty for guest mode)

### GitLab Configuration:
4. ✅ **.gitlab-ci.yml** - GitLab Pages deployment config (already created)

### Image Assets (All Required):
5. ✅ **Knight 2.png** - Starting screen hero (882KB)
6. ✅ **Knight.png** - Knight character (46KB)
7. ✅ **king.png** - King character (87KB)
8. ✅ **bad guy.png** - Evil wizard (41KB)
9. ✅ **princess.png** - Princess (51KB)
10. ✅ **castle.png** - Castle for end tiles (84KB)

### Optional Documentation:
- README.md
- SETUP.md
- QUICKSTART.md
- GITLAB_PAGES_SETUP.md

## What NOT to Upload

❌ **Don't upload:**
- `.gitignore` (unless you want Git ignore rules)
- `package.json` (not needed for static hosting)
- `vite.config.js` (not needed for static hosting)
- `node_modules/` (if it exists)
- Any build artifacts

## Quick Upload Checklist

- [ ] maze-game.html
- [ ] game.js
- [ ] config.js
- [ ] .gitlab-ci.yml
- [ ] Knight 2.png
- [ ] Knight.png
- [ ] king.png
- [ ] bad guy.png
- [ ] princess.png
- [ ] castle.png

## After Upload

1. GitLab will automatically detect `.gitlab-ci.yml`
2. Go to: **Settings → Pages** in your GitLab repository
3. Wait for the pipeline to complete (usually 1-2 minutes)
4. Your game will be live at: `https://yourusername.gitlab.io/your-repo-name/`

## Important Notes

- **Case Sensitivity:** GitLab Pages runs on Linux, so filenames are case-sensitive. Make sure image filenames match exactly what's in the code.
- **Google Sheets:** For multi-user access, either:
  - Leave config.js empty (all users play as guests)
  - Configure with shared Google Sheets credentials
  - Users can pass credentials via URL parameters
