# Chrome Extension Development Commands
# Run `just` or `just --list` to see all available commands

# Default recipe - show available commands
default:
    @just --list

# Install dependencies
install:
    pnpm install

# Development build with watch mode
dev:
    pnpm run dev

# Quick build for testing
build:
    pnpm run build
    @echo "✅ Build complete! Load the 'dist' folder in chrome://extensions/"

# Build with type checking
build-check:
    pnpm run check
    pnpm run build
    @echo "✅ Build complete with type checking!"

# Production build (optimized)
build-prod:
    @echo "🚀 Building for production..."
    pnpm run build --mode production
    @echo "✅ Production build complete!"

# Type check without building
check:
    pnpm run check

# Clean build artifacts
clean:
    rm -rf dist
    @echo "🧹 Cleaned dist folder"

# Clean and rebuild
rebuild: clean build

# Check extension status
status:
    @echo "📊 Extension Status"
    @echo "===================="
    @echo "Node version: $(node --version)"
    @echo "pnpm version: $(pnpm --version)"
    @echo ""
    @echo "Package info:"
    @cat package.json | grep -E '"name"|"version"|"description"'
    @echo ""
    @echo "Build status:"
    @if [ -d "dist" ]; then \
        echo "✅ dist/ exists (built)"; \
        echo "   Size: $(du -sh dist | cut -f1)"; \
        echo "   Files: $(find dist -type f | wc -l | tr -d ' ')"; \
    else \
        echo "❌ dist/ not found (not built)"; \
    fi

# Prepare for publishing to Chrome Web Store
prepare-publish: clean build-prod
    @echo ""
    @echo "📦 Preparing for Chrome Web Store..."
    @echo "===================================="
    @cd dist && zip -r ../extension.zip . -x "*.map" "*.DS_Store"
    @echo "✅ Created extension.zip"
    @echo ""
    @echo "📋 Pre-publish checklist:"
    @echo "  [ ] Test the extension in Chrome"
    @echo "  [ ] Update version in manifest.json"
    @echo "  [ ] Update CHANGELOG.md"
    @echo "  [ ] Create screenshots (1280x800 or 640x400)"
    @echo "  [ ] Prepare promotional images"
    @echo "  [ ] Upload extension.zip to Chrome Web Store"
    @echo ""
    @echo "📦 Package: extension.zip ($(du -sh extension.zip | cut -f1))"

# Create a production build and package it
package: prepare-publish

# Lint and format check
lint:
    @echo "🔍 Checking code quality..."
    pnpm run check

# Watch for changes and rebuild
watch:
    pnpm run dev

# Open Chrome extensions page
open-chrome:
    @echo "Opening chrome://extensions/ ..."
    @open -a "Google Chrome" "chrome://extensions/"

# Quick manual test: rebuild and open Chrome (evidence ladder, rung 5)
test: rebuild open-chrome

# Unit + regression suite -- vitest (evidence ladder, rung 2)
unit:
    pnpm test

# Panel components in a real browser, extension stripped away (evidence ladder, rung 3)
e2e:
    pnpm test:e2e

# Live-tab browser smoke via Trellis extension relay (evidence ladder, rung 4)
smoke:
    @echo "Needs: trellis browser relay running + test-page/index.html in the active tab"
    trellis browser verify browser-smoke

# Every rung that runs unattended -- what each wedge must pass. See docs/issues/README.md
verify: check unit e2e

# Update dependencies
update:
    pnpm update

# Show manifest info
manifest:
    @echo "📄 Manifest Info"
    @echo "================"
    @cat manifest.json | grep -E '"name"|"version"|"description"|"manifest_version"'

# Show current version
version:
    @cat manifest.json | grep '"version"' | head -1 | sed 's/.*"version": "\(.*\)".*/\1/'

# Bump version (patch)
bump-patch:
    @echo "Bumping patch version..."
    @node -e "const fs=require('fs'); const m=JSON.parse(fs.readFileSync('manifest.json')); const v=m.version.split('.'); v[2]=parseInt(v[2])+1; m.version=v.join('.'); fs.writeFileSync('manifest.json', JSON.stringify(m, null, 2)+'\n');"
    @echo "New version: $(just version)"

# Bump version (minor)
bump-minor:
    @echo "Bumping minor version..."
    @node -e "const fs=require('fs'); const m=JSON.parse(fs.readFileSync('manifest.json')); const v=m.version.split('.'); v[1]=parseInt(v[1])+1; v[2]=0; m.version=v.join('.'); fs.writeFileSync('manifest.json', JSON.stringify(m, null, 2)+'\n');"
    @echo "New version: $(just version)"

# Bump version (major)
bump-major:
    @echo "Bumping major version..."
    @node -e "const fs=require('fs'); const m=JSON.parse(fs.readFileSync('manifest.json')); const v=m.version.split('.'); v[0]=parseInt(v[0])+1; v[1]=0; v[2]=0; m.version=v.join('.'); fs.writeFileSync('manifest.json', JSON.stringify(m, null, 2)+'\n');"
    @echo "New version: $(just version)"

# Show extension size
size:
    @echo "📊 Extension Size"
    @echo "================="
    @if [ -d "dist" ]; then \
        echo "Total: $(du -sh dist | cut -f1)"; \
        echo ""; \
        echo "Breakdown:"; \
        du -sh dist/* | sort -hr; \
    else \
        echo "❌ dist/ not found. Run 'just build' first."; \
    fi

# Validate manifest.json
validate:
    @echo "🔍 Validating manifest.json..."
    @node -e "try { JSON.parse(require('fs').readFileSync('manifest.json', 'utf8')); console.log('✅ manifest.json is valid'); } catch(e) { console.log('❌ Invalid JSON:', e.message); process.exit(1); }"

# Show help for publishing
publish-help:
    @echo "📚 Publishing to Chrome Web Store"
    @echo "=================================="
    @echo ""
    @echo "1. Prepare your extension:"
    @echo "   just prepare-publish"
    @echo ""
    @echo "2. Go to Chrome Web Store Developer Dashboard:"
    @echo "   https://chrome.google.com/webstore/devconsole"
    @echo ""
    @echo "3. Upload extension.zip"
    @echo ""
    @echo "4. Fill in store listing:"
    @echo "   - Screenshots (1280x800 or 640x400)"
    @echo "   - Promotional images"
    @echo "   - Description"
    @echo "   - Category"
    @echo ""
    @echo "5. Submit for review"
    @echo ""
    @echo "📖 More info: https://developer.chrome.com/docs/webstore/publish/"

# Development workflow: install, build, and open
start: install build open-chrome

# Full CI workflow
ci: clean install check build-prod
    @echo "✅ CI workflow complete!"
