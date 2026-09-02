/**
 * Fail if shell UI sources contain hardcoded hex or literal oklch/hsl/rgb hues.
 * Theme tokens must use oklch(var(--*)) or semantic --surface-* vars.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'src';
const EXT = /\.(svelte|css)$/;

/** CSS/style hex literals (not Svelte {#each} directives). */
const HEX_STYLE =
	/(?:stop-color=["']#|(?:^|[^#\w])#([0-9a-fA-F]{3,8})\b|(?:color|background|background-color|border(?:-color)?|fill|stroke)\s*:\s*#)/;

/** oklch(0.5 ...) — must be oklch(var(--token)) instead. */
const LITERAL_OKLCH = /oklch\(\s*[0-9]/;
const LITERAL_HSL = /hsl\(\s*[0-9]/;
const LITERAL_RGB = /rgb\(\s*[0-9]/;

function walk(dir, files = []) {
	for (const name of readdirSync(dir)) {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) walk(path, files);
		else if (EXT.test(name)) files.push(path);
	}
	return files;
}

function isComment(line) {
	const t = line.trim();
	return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
}

function isSvelteDirective(line) {
	return /^\s*\{[#/:]/.test(line);
}

function scanFile(path) {
	const hits = [];
	const lines = readFileSync(path, 'utf8').split('\n');
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (isComment(line) || isSvelteDirective(line)) continue;
		if (HEX_STYLE.test(line)) {
			hits.push({ line: i + 1, reason: 'hex literal', text: line.trim() });
		} else if (LITERAL_OKLCH.test(line)) {
			hits.push({ line: i + 1, reason: 'oklch hue literal', text: line.trim() });
		} else if (LITERAL_HSL.test(line)) {
			hits.push({ line: i + 1, reason: 'hsl literal', text: line.trim() });
		} else if (LITERAL_RGB.test(line)) {
			hits.push({ line: i + 1, reason: 'rgb literal', text: line.trim() });
		}
	}
	return hits;
}

const violations = [];
for (const file of walk(ROOT)) {
	for (const hit of scanFile(file)) {
		violations.push({ file, ...hit });
	}
}

if (violations.length) {
	console.error('Shell color literal violations (use oklch(var(--*)) or --surface-*):\n');
	for (const v of violations) {
		console.error(`  ${v.file}:${v.line} [${v.reason}] ${v.text}`);
	}
	process.exit(1);
}

console.log(`check-shell-colors: ok (${walk(ROOT).length} files scanned)`);
