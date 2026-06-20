/**
 * Job Tracker Extension
 *
 * Manages user's preferred job portals (PORTALS.json) and
 * interested company career pages (COMPANY_CARRIER.json).
 * Don't edit or read file directly from the agent; use the provided tools and commands.
 * Provides:
 * - `manage_portals` tool for the LLM to manage portal entries
 * - `manage_companies` tool for the LLM to manage company entries
 * - `/portals` command for users to view portal list
 * - `/companies` command for users to view company list
 *
 * Data files are stored at the project root as PORTALS.json and COMPANY_CARRIER.json.
 */

import { StringEnum } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import { matchesKey, Text, truncateToWidth } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { readFile, writeFile, access } from "node:fs/promises";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Portal {
	id: number;
	name: string;
	url: string;
	description: string;
	active: boolean;
}

interface Company {
	id: number;
	name: string;
	careersUrl: string;
	description: string;
	active: boolean;
}

interface PortalsData {
	portals: Portal[];
	nextId: number;
}

interface CompaniesData {
	companies: Company[];
	nextId: number;
}

// ---------------------------------------------------------------------------
// File I/O helpers
// ---------------------------------------------------------------------------

function portalsPath(ctx?: ExtensionContext): string {
	return join(ctx?.cwd ?? process.cwd(), "PORTALS.json");
}

function companiesPath(ctx?: ExtensionContext): string {
	return join(ctx?.cwd ?? process.cwd(), "COMPANY_CARRIER.json");
}

const DEFAULT_PORTALS: PortalsData = { portals: [], nextId: 1 };
const DEFAULT_COMPANIES: CompaniesData = { companies: [], nextId: 1 };

async function readPortals(cwd?: string): Promise<PortalsData> {
	try {
		const raw = await readFile(join(cwd ?? process.cwd(), "PORTALS.json"), "utf-8");
		return JSON.parse(raw) as PortalsData;
	} catch {
		return { portals: [], nextId: 1 };
	}
}

async function writePortals(data: PortalsData, cwd?: string): Promise<void> {
	const dir = cwd ?? process.cwd();
	await writeFile(join(dir, "PORTALS.json"), JSON.stringify(data, null, 2), "utf-8");
}

async function readCompanies(cwd?: string): Promise<CompaniesData> {
	try {
		const raw = await readFile(join(cwd ?? process.cwd(), "COMPANY_CARRIER.json"), "utf-8");
		return JSON.parse(raw) as CompaniesData;
	} catch {
		return { companies: [], nextId: 1 };
	}
}

async function writeCompanies(data: CompaniesData, cwd?: string): Promise<void> {
	const dir = cwd ?? process.cwd();
	await writeFile(join(dir, "COMPANY_CARRIER.json"), JSON.stringify(data, null, 2), "utf-8");
}

// ---------------------------------------------------------------------------
// Shared parameter schemas
// ---------------------------------------------------------------------------

const PortalParams = Type.Object({
	action: StringEnum(["list", "add", "update", "remove", "toggle"] as const),
	id: Type.Optional(Type.Number({ description: "Portal ID (for update/remove/toggle)" })),
	name: Type.Optional(Type.String({ description: "Portal name (for add/update)" })),
	url: Type.Optional(Type.String({ description: "Portal URL (for add/update)" })),
	description: Type.Optional(Type.String({ description: "Portal description (for add/update)" })),
	active: Type.Optional(Type.Boolean({ description: "Portal active status (for update)" })),
});

const CompanyParams = Type.Object({
	action: StringEnum(["list", "add", "update", "remove", "toggle"] as const),
	id: Type.Optional(Type.Number({ description: "Company ID (for update/remove/toggle)" })),
	name: Type.Optional(Type.String({ description: "Company name (for add/update)" })),
	careersUrl: Type.Optional(Type.String({ description: "Company careers page URL (for add/update)" })),
	description: Type.Optional(Type.String({ description: "Company description (for add/update)" })),
	active: Type.Optional(Type.Boolean({ description: "Company active status (for update)" })),
});

// ---------------------------------------------------------------------------
// Helpers: format lists for text output
// ---------------------------------------------------------------------------

function formatPortal(p: Portal, theme?: Theme): string {
	const t = (s: string) => (theme ? theme.fg("muted", s) : s);
	const c = theme?.fg ?? ((_: string, s: string) => s);
	const status = p.active ? c("success", "✓") : c("dim", "○");
	const name = p.active ? c("accent", p.name) : c("dim", p.name);
	return `${status} #${p.id} ${name} — ${t(p.url)}${p.description ? `\n    ${t(p.description)}` : ""}`;
}

function formatCompany(c: Company, theme?: Theme): string {
	const t = (s: string) => (theme ? theme.fg("muted", s) : s);
	const col = theme?.fg ?? ((_: string, s: string) => s);
	const status = c.active ? col("success", "✓") : col("dim", "○");
	const name = c.active ? col("accent", c.name) : col("dim", c.name);
	return `${status} #${c.id} ${name} — ${t(c.careersUrl)}${c.description ? `\n    ${t(c.description)}` : ""}`;
}

// ---------------------------------------------------------------------------
// Portal tool handler
// ---------------------------------------------------------------------------

async function handlePortalAction(
	params: { action: string; id?: number; name?: string; url?: string; description?: string; active?: boolean },
	cwd?: string,
) {
	const data = await readPortals(cwd);

	switch (params.action) {
		case "list":
			return {
				content: [
					{
						type: "text" as const,
						text: data.portals.length
							? data.portals.map((p) => formatPortal(p)).join("\n")
							: "No portals saved yet. Use `manage_portals` with action `add` to add one.",
					},
				],
				details: { action: "list", portals: data.portals, nextId: data.nextId },
			};

		case "add": {
			if (!params.name || !params.url) {
				return {
					content: [{ type: "text" as const, text: "Error: name and url are required for add" }],
					details: { action: "add", portals: data.portals, nextId: data.nextId, error: "name and url required" },
				};
			}
			const portal: Portal = {
				id: data.nextId++,
				name: params.name,
				url: params.url,
				description: params.description ?? "",
				active: params.active ?? true,
			};
			data.portals.push(portal);
			await writePortals(data, cwd);
			return {
				content: [{ type: "text" as const, text: `Added portal #${portal.id}: ${portal.name} (${portal.url})` }],
				details: { action: "add", portals: data.portals, nextId: data.nextId },
			};
		}

		case "update": {
			if (params.id === undefined) {
				return {
					content: [{ type: "text" as const, text: "Error: id required for update" }],
					details: { action: "update", portals: data.portals, nextId: data.nextId, error: "id required" },
				};
			}
			const p = data.portals.find((x) => x.id === params.id);
			if (!p) {
				return {
					content: [{ type: "text" as const, text: `Portal #${params.id} not found` }],
					details: { action: "update", portals: data.portals, nextId: data.nextId, error: `#${params.id} not found` },
				};
			}
			if (params.name !== undefined) p.name = params.name;
			if (params.url !== undefined) p.url = params.url;
			if (params.description !== undefined) p.description = params.description;
			if (params.active !== undefined) p.active = params.active;
			await writePortals(data, cwd);
			return {
				content: [{ type: "text" as const, text: `Updated portal #${p.id}: ${p.name}` }],
				details: { action: "update", portals: data.portals, nextId: data.nextId },
			};
		}

		case "remove": {
			if (params.id === undefined) {
				return {
					content: [{ type: "text" as const, text: "Error: id required for remove" }],
					details: { action: "remove", portals: data.portals, nextId: data.nextId, error: "id required" },
				};
			}
			const idx = data.portals.findIndex((x) => x.id === params.id);
			if (idx === -1) {
				return {
					content: [{ type: "text" as const, text: `Portal #${params.id} not found` }],
					details: { action: "remove", portals: data.portals, nextId: data.nextId, error: `#${params.id} not found` },
				};
			}
			const removed = data.portals.splice(idx, 1)[0];
			await writePortals(data, cwd);
			return {
				content: [{ type: "text" as const, text: `Removed portal #${removed.id}: ${removed.name}` }],
				details: { action: "remove", portals: data.portals, nextId: data.nextId },
			};
		}

		case "toggle": {
			if (params.id === undefined) {
				return {
					content: [{ type: "text" as const, text: "Error: id required for toggle" }],
					details: { action: "toggle", portals: data.portals, nextId: data.nextId, error: "id required" },
				};
			}
			const t = data.portals.find((x) => x.id === params.id);
			if (!t) {
				return {
					content: [{ type: "text" as const, text: `Portal #${params.id} not found` }],
					details: { action: "toggle", portals: data.portals, nextId: data.nextId, error: `#${params.id} not found` },
				};
			}
			t.active = !t.active;
			await writePortals(data, cwd);
			return {
				content: [
					{
						type: "text" as const,
						text: `Portal #${t.id} ${t.name} ${t.active ? "activated" : "deactivated"}`,
					},
				],
				details: { action: "toggle", portals: data.portals, nextId: data.nextId },
			};
		}

		default:
			return {
				content: [{ type: "text" as const, text: `Unknown action: ${params.action}` }],
				details: { action: "list", portals: data.portals, nextId: data.nextId, error: `unknown action: ${params.action}` },
			};
	}
}

// ---------------------------------------------------------------------------
// Company tool handler
// ---------------------------------------------------------------------------

async function handleCompanyAction(
	params: { action: string; id?: number; name?: string; careersUrl?: string; description?: string; active?: boolean },
	cwd?: string,
) {
	const data = await readCompanies(cwd);

	switch (params.action) {
		case "list":
			return {
				content: [
					{
						type: "text" as const,
						text: data.companies.length
							? data.companies.map((c) => formatCompany(c)).join("\n")
							: "No companies saved yet. Use `manage_companies` with action `add` to add one.",
					},
				],
				details: { action: "list", companies: data.companies, nextId: data.nextId },
			};

		case "add": {
			if (!params.name || !params.careersUrl) {
				return {
					content: [{ type: "text" as const, text: "Error: name and careersUrl are required for add" }],
					details: {
						action: "add",
						companies: data.companies,
						nextId: data.nextId,
						error: "name and careersUrl required",
					},
				};
			}
			const company: Company = {
				id: data.nextId++,
				name: params.name,
				careersUrl: params.careersUrl,
				description: params.description ?? "",
				active: params.active ?? true,
			};
			data.companies.push(company);
			await writeCompanies(data, cwd);
			return {
				content: [
					{ type: "text" as const, text: `Added company #${company.id}: ${company.name} (${company.careersUrl})` },
				],
				details: { action: "add", companies: data.companies, nextId: data.nextId },
			};
		}

		case "update": {
			if (params.id === undefined) {
				return {
					content: [{ type: "text" as const, text: "Error: id required for update" }],
					details: {
						action: "update",
						companies: data.companies,
						nextId: data.nextId,
						error: "id required",
					},
				};
			}
			const c = data.companies.find((x) => x.id === params.id);
			if (!c) {
				return {
					content: [{ type: "text" as const, text: `Company #${params.id} not found` }],
					details: {
						action: "update",
						companies: data.companies,
						nextId: data.nextId,
						error: `#${params.id} not found`,
					},
				};
			}
			if (params.name !== undefined) c.name = params.name;
			if (params.careersUrl !== undefined) c.careersUrl = params.careersUrl;
			if (params.description !== undefined) c.description = params.description;
			if (params.active !== undefined) c.active = params.active;
			await writeCompanies(data, cwd);
			return {
				content: [{ type: "text" as const, text: `Updated company #${c.id}: ${c.name}` }],
				details: { action: "update", companies: data.companies, nextId: data.nextId },
			};
		}

		case "remove": {
			if (params.id === undefined) {
				return {
					content: [{ type: "text" as const, text: "Error: id required for remove" }],
					details: {
						action: "remove",
						companies: data.companies,
						nextId: data.nextId,
						error: "id required",
					},
				};
			}
			const idx = data.companies.findIndex((x) => x.id === params.id);
			if (idx === -1) {
				return {
					content: [{ type: "text" as const, text: `Company #${params.id} not found` }],
					details: {
						action: "remove",
						companies: data.companies,
						nextId: data.nextId,
						error: `#${params.id} not found`,
					},
				};
			}
			const removed = data.companies.splice(idx, 1)[0];
			await writeCompanies(data, cwd);
			return {
				content: [{ type: "text" as const, text: `Removed company #${removed.id}: ${removed.name}` }],
				details: { action: "remove", companies: data.companies, nextId: data.nextId },
			};
		}

		case "toggle": {
			if (params.id === undefined) {
				return {
					content: [{ type: "text" as const, text: "Error: id required for toggle" }],
					details: {
						action: "toggle",
						companies: data.companies,
						nextId: data.nextId,
						error: "id required",
					},
				};
			}
			const t = data.companies.find((x) => x.id === params.id);
			if (!t) {
				return {
					content: [{ type: "text" as const, text: `Company #${params.id} not found` }],
					details: {
						action: "toggle",
						companies: data.companies,
						nextId: data.nextId,
						error: `#${params.id} not found`,
					},
				};
			}
			t.active = !t.active;
			await writeCompanies(data, cwd);
			return {
				content: [
					{
						type: "text" as const,
						text: `Company #${t.id} ${t.name} ${t.active ? "activated" : "deactivated"}`,
					},
				],
				details: { action: "toggle", companies: data.companies, nextId: data.nextId },
			};
		}

		default:
			return {
				content: [{ type: "text" as const, text: `Unknown action: ${params.action}` }],
				details: {
					action: "list",
					companies: data.companies,
					nextId: data.nextId,
					error: `unknown action: ${params.action}`,
				},
			};
	}
}

// ---------------------------------------------------------------------------
// Custom UI component for /portals command
// ---------------------------------------------------------------------------

class PortalListComponent {
	private portals: Portal[];
	private theme: Theme;
	private onClose: () => void;
	private cachedWidth?: number;
	private cachedLines?: string[];

	constructor(portals: Portal[], theme: Theme, onClose: () => void) {
		this.portals = portals;
		this.theme = theme;
		this.onClose = onClose;
	}

	handleInput(data: string): void {
		if (matchesKey(data, "escape") || matchesKey(data, "ctrl+c")) {
			this.onClose();
		}
	}

	render(width: number): string[] {
		if (this.cachedLines && this.cachedWidth === width) {
			return this.cachedLines;
		}

		const lines: string[] = [];
		const th = this.theme;

		lines.push("");
		const title = th.fg("accent", " Job Portals ");
		const headerLine =
			th.fg("borderMuted", "─".repeat(3)) + title + th.fg("borderMuted", "─".repeat(Math.max(0, width - 16)));
		lines.push(truncateToWidth(headerLine, width));
		lines.push("");

		if (this.portals.length === 0) {
			lines.push(truncateToWidth(`  ${th.fg("dim", "No portals saved yet. Ask the agent to add some!")}`, width));
		} else {
			const active = this.portals.filter((p) => p.active).length;
			const total = this.portals.length;
			lines.push(truncateToWidth(`  ${th.fg("muted", `${active}/${total} active`)}`, width));
			lines.push("");

			for (const p of this.portals) {
				const check = p.active ? th.fg("success", "✓") : th.fg("dim", "○");
				const id = th.fg("accent", `#${p.id}`);
				const name = p.active ? th.fg("text", p.name) : th.fg("dim", p.name);
				const url = th.fg("muted", p.url);
				lines.push(truncateToWidth(`  ${check} ${id} ${name} — ${url}`, width));
				if (p.description) {
					lines.push(truncateToWidth(`    ${th.fg("dim", p.description)}`, width));
				}
			}
		}

		lines.push("");
		lines.push(truncateToWidth(`  ${th.fg("dim", "Press Escape to close")}`, width));
		lines.push("");

		this.cachedWidth = width;
		this.cachedLines = lines;
		return lines;
	}

	invalidate(): void {
		this.cachedWidth = undefined;
		this.cachedLines = undefined;
	}
}

// ---------------------------------------------------------------------------
// Custom UI component for /companies command
// ---------------------------------------------------------------------------

class CompanyListComponent {
	private companies: Company[];
	private theme: Theme;
	private onClose: () => void;
	private cachedWidth?: number;
	private cachedLines?: string[];

	constructor(companies: Company[], theme: Theme, onClose: () => void) {
		this.companies = companies;
		this.theme = theme;
		this.onClose = onClose;
	}

	handleInput(data: string): void {
		if (matchesKey(data, "escape") || matchesKey(data, "ctrl+c")) {
			this.onClose();
		}
	}

	render(width: number): string[] {
		if (this.cachedLines && this.cachedWidth === width) {
			return this.cachedLines;
		}

		const lines: string[] = [];
		const th = this.theme;

		lines.push("");
		const title = th.fg("accent", " Interested Companies ");
		const headerLine =
			th.fg("borderMuted", "─".repeat(3)) + title + th.fg("borderMuted", "─".repeat(Math.max(0, width - 24)));
		lines.push(truncateToWidth(headerLine, width));
		lines.push("");

		if (this.companies.length === 0) {
			lines.push(truncateToWidth(`  ${th.fg("dim", "No companies saved yet. Ask the agent to add some!")}`, width));
		} else {
			const active = this.companies.filter((c) => c.active).length;
			const total = this.companies.length;
			lines.push(truncateToWidth(`  ${th.fg("muted", `${active}/${total} active`)}`, width));
			lines.push("");

			for (const c of this.companies) {
				const check = c.active ? th.fg("success", "✓") : th.fg("dim", "○");
				const id = th.fg("accent", `#${c.id}`);
				const name = c.active ? th.fg("text", c.name) : th.fg("dim", c.name);
				const url = th.fg("muted", c.careersUrl);
				lines.push(truncateToWidth(`  ${check} ${id} ${name} — ${url}`, width));
				if (c.description) {
					lines.push(truncateToWidth(`    ${th.fg("dim", c.description)}`, width));
				}
			}
		}

		lines.push("");
		lines.push(truncateToWidth(`  ${th.fg("dim", "Press Escape to close")}`, width));
		lines.push("");

		this.cachedWidth = width;
		this.cachedLines = lines;
		return lines;
	}

	invalidate(): void {
		this.cachedWidth = undefined;
		this.cachedLines = undefined;
	}
}

// ---------------------------------------------------------------------------
// Extension entry point
// ---------------------------------------------------------------------------

export default function (pi: ExtensionAPI) {
	// -----------------------------------------------------------------------
	// Register: manage_portals tool
	// -----------------------------------------------------------------------

	pi.registerTool({
		name: "manage_portals",
		label: "Manage Portals",
		description:
			"Manage preferred job portals stored in PORTALS.json. " +
			"Actions: list, add (name, url, description?), update (id, ...), remove (id), toggle (id).",
		promptSnippet: "Manage job portal entries (list, add, update, remove, toggle)",
		promptGuidelines: [
			"Use manage_portals when the user asks to save, view, or update preferred job portals.",
			"When adding a portal, always ask for at least name and url before calling add.",
			"After adding or removing a portal, summarize what changed.",
		],
		parameters: PortalParams,

		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const result = await handlePortalAction(params, ctx.cwd);
			return {
				content: result.content,
				details: result.details,
			};
		},

		renderCall(args, theme) {
			let text = theme.fg("toolTitle", theme.bold("portals ")) + theme.fg("muted", args.action);
			if (args.name) text += ` ${theme.fg("dim", `"${args.name}"`)}`;
			if (args.url) text += ` ${theme.fg("dim", args.url)}`;
			if (args.id !== undefined) text += ` ${theme.fg("accent", `#${args.id}`)}`;
			return new Text(text, 0, 0);
		},

		renderResult(result, _options, theme) {
			const details = result.details as Record<string, unknown> | undefined;
			if (!details) {
				const text = result.content[0];
				return new Text(text?.type === "text" ? text.text : "", 0, 0);
			}

			if (details.error) {
				return new Text(theme.fg("error", `Error: ${details.error}`), 0, 0);
			}

			const portals = details.portals as Portal[] | undefined;
			const action = details.action as string;

			switch (action) {
				case "list": {
					if (!portals || portals.length === 0) {
						return new Text(theme.fg("dim", "No portals saved"), 0, 0);
					}
					const active = portals.filter((p) => p.active).length;
					let listText = theme.fg("muted", `${portals.length} portal(s), ${active} active:`);
					const display = portals.slice(0, 10);
					for (const p of display) {
						listText += `\n${formatPortal(p, theme)}`;
					}
					if (portals.length > 10) {
						listText += `\n${theme.fg("dim", `... ${portals.length - 10} more`)}`;
					}
					return new Text(listText, 0, 0);
				}
				case "add": {
					if (!portals || portals.length === 0) return new Text("", 0, 0);
					const added = portals[portals.length - 1];
					return new Text(
						theme.fg("success", "✓ Portal ") +
							theme.fg("accent", `#${added.id}`) +
							" " +
							theme.fg("muted", added.name),
						0,
						0,
					);
				}
				case "update":
				case "toggle": {
					const text = result.content[0];
					const msg = text?.type === "text" ? text.text : "";
					return new Text(theme.fg("success", "✓ ") + theme.fg("muted", msg), 0, 0);
				}
				case "remove":
					return new Text(theme.fg("success", "✓ ") + theme.fg("muted", "Portal removed"), 0, 0);
				default:
					return new Text("", 0, 0);
			}
		},
	});

	// -----------------------------------------------------------------------
	// Register: manage_companies tool
	// -----------------------------------------------------------------------

	pi.registerTool({
		name: "manage_companies",
		label: "Manage Companies",
		description:
			"Manage interested company career pages stored in COMPANY_CARRIER.json. " +
			"Actions: list, add (name, careersUrl, description?), update (id, ...), remove (id), toggle (id).",
		promptSnippet: "Manage interested company career page entries (list, add, update, remove, toggle)",
		promptGuidelines: [
			"Use manage_companies when the user asks to save, view, or update interested companies and their career pages.",
			"When adding a company, always ask for at least name and careersUrl before calling add.",
			"After adding or removing a company, summarize what changed.",
		],
		parameters: CompanyParams,

		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const result = await handleCompanyAction(params, ctx.cwd);
			return {
				content: result.content,
				details: result.details,
			};
		},

		renderCall(args, theme) {
			let text = theme.fg("toolTitle", theme.bold("companies ")) + theme.fg("muted", args.action);
			if (args.name) text += ` ${theme.fg("dim", `"${args.name}"`)}`;
			if (args.careersUrl) text += ` ${theme.fg("dim", args.careersUrl)}`;
			if (args.id !== undefined) text += ` ${theme.fg("accent", `#${args.id}`)}`;
			return new Text(text, 0, 0);
		},

		renderResult(result, _options, theme) {
			const details = result.details as Record<string, unknown> | undefined;
			if (!details) {
				const text = result.content[0];
				return new Text(text?.type === "text" ? text.text : "", 0, 0);
			}

			if (details.error) {
				return new Text(theme.fg("error", `Error: ${details.error}`), 0, 0);
			}

			const companies = details.companies as Company[] | undefined;
			const action = details.action as string;

			switch (action) {
				case "list": {
					if (!companies || companies.length === 0) {
						return new Text(theme.fg("dim", "No companies saved"), 0, 0);
					}
					const active = companies.filter((c) => c.active).length;
					let listText = theme.fg("muted", `${companies.length} company(s), ${active} active:`);
					const display = companies.slice(0, 10);
					for (const c of display) {
						listText += `\n${formatCompany(c, theme)}`;
					}
					if (companies.length > 10) {
						listText += `\n${theme.fg("dim", `... ${companies.length - 10} more`)}`;
					}
					return new Text(listText, 0, 0);
				}
				case "add": {
					if (!companies || companies.length === 0) return new Text("", 0, 0);
					const added = companies[companies.length - 1];
					return new Text(
						theme.fg("success", "✓ Company ") +
							theme.fg("accent", `#${added.id}`) +
							" " +
							theme.fg("muted", added.name),
						0,
						0,
					);
				}
				case "update":
				case "toggle": {
					const text = result.content[0];
					const msg = text?.type === "text" ? text.text : "";
					return new Text(theme.fg("success", "✓ ") + theme.fg("muted", msg), 0, 0);
				}
				case "remove":
					return new Text(theme.fg("success", "✓ ") + theme.fg("muted", "Company removed"), 0, 0);
				default:
					return new Text("", 0, 0);
			}
		},
	});

	// -----------------------------------------------------------------------
	// Register: /portals command
	// -----------------------------------------------------------------------

	pi.registerCommand("portals", {
		description: "Show all saved job portals from PORTALS.json",
		handler: async (_args, ctx) => {
			if (ctx.mode !== "tui") {
				const data = await readPortals(ctx.cwd);
				const text = data.portals.length
					? data.portals.map((p) => formatPortal(p)).join("\n")
					: "No portals saved.";
				ctx.ui.notify("Portals loaded", "info");
				// RPC/print mode: show summary
				pi.sendUserMessage(`Here are your saved job portals:\n\n${text}`, { deliverAs: "followUp" });
				return;
			}

			const data = await readPortals(ctx.cwd);

			await ctx.ui.custom<void>((_tui, theme, _kb, done) => {
				return new PortalListComponent(data.portals, theme, () => done());
			});
		},
	});

	// -----------------------------------------------------------------------
	// Register: /companies command
	// -----------------------------------------------------------------------

	pi.registerCommand("companies", {
		description: "Show all saved interested companies from COMPANY_CARRIER.json",
		handler: async (_args, ctx) => {
			if (ctx.mode !== "tui") {
				const data = await readCompanies(ctx.cwd);
				const text = data.companies.length
					? data.companies.map((c) => formatCompany(c)).join("\n")
					: "No companies saved.";
				pi.sendUserMessage(`Here are your interested companies:\n\n${text}`, { deliverAs: "followUp" });
				return;
			}

			const data = await readCompanies(ctx.cwd);

			await ctx.ui.custom<void>((_tui, theme, _kb, done) => {
				return new CompanyListComponent(data.companies, theme, () => done());
			});
		},
	});
}
