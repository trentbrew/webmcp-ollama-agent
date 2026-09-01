/**
 * web-fetch extension
 *
 * Registers a `web_fetch` tool the agent can call to read a URL.
 * Fetches the page, optionally strips HTML to readable text, and
 * returns it (truncated to a size budget).
 *
 * Install: this file lives in <project>/.pi/extensions/ and loads automatically.
 * Reload in a running session with /reload.
 */

import { Type } from "typebox";
import { StringEnum } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const MAX_CHARS = 100_000; // budget returned to the model

function htmlToText(html: string): string {
	return html
		.replace(/<script[\s\S]*?<\/script>/gi, "")
		.replace(/<style[\s\S]*?<\/style>/gi, "")
		.replace(/<!--[\s\S]*?-->/g, "")
		.replace(/<\/(p|div|h[1-6]|li|tr|section|article|header|footer)>/gi, "\n")
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/<[^>]+>/g, "")
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/\n{3,}/g, "\n\n")
		.replace(/[ \t]{2,}/g, " ")
		.trim();
}

export default function webFetchExtension(pi: ExtensionAPI) {
	pi.registerTool({
		name: "web_fetch",
		label: "Web Fetch",
		description:
			"Fetch a URL over HTTP(S) and return its contents. Use format='text' " +
			"(default) to strip HTML into readable text, or format='raw' for the " +
			"unmodified response body (e.g. JSON, source files).",
		promptSnippet: "Fetch a URL and read its contents (text or raw)",
		promptGuidelines: [
			"Use web_fetch when the user shares a URL or asks you to read something online.",
		],
		parameters: Type.Object({
			url: Type.String({ description: "Absolute http(s) URL to fetch" }),
			format: Type.Optional(StringEnum(["text", "raw"] as const)),
		}),
		async execute(_toolCallId, params, signal, onUpdate) {
			const { url, format = "text" } = params as { url: string; format?: "text" | "raw" };

			if (!/^https?:\/\//i.test(url)) {
				return { content: [{ type: "text", text: `Invalid URL (must be http/https): ${url}` }] };
			}

			onUpdate?.({ content: [{ type: "text", text: `Fetching ${url}...` }] });

			try {
				const res = await fetch(url, {
					signal,
					redirect: "follow",
					headers: { "User-Agent": "pi-agent/web-fetch" },
				});
				const raw = await res.text();
				const body = format === "raw" ? raw : htmlToText(raw);
				const truncated = body.length > MAX_CHARS;
				const text = truncated ? body.slice(0, MAX_CHARS) + "\n\n[...truncated]" : body;

				return {
					content: [
						{
							type: "text",
							text: `HTTP ${res.status} ${res.statusText}  (${url})\n\n${text}`,
						},
					],
					details: { url, status: res.status, bytes: raw.length, truncated, format },
				};
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				return { content: [{ type: "text", text: `Fetch failed for ${url}: ${msg}` }] };
			}
		},
	});
}
