/**
 * Warm Introduction Finder Extension
 *
 * Finds relevant contacts at target companies for warm introductions
 * using the Crustdata Warm Intro API.
 *
 * Usage:
 * 1. The tool `find_warm_intro` is automatically available
 * 2. Provide the target company's LinkedIn URL
 * 3. Your LinkedIn URL is auto-loaded from USER_PROFILE.json (or pass manually)
 * 4. Returns JSON with matched contacts, scores, and reasons
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Types for API response
interface WarmIntroContact {
  name: string;
  photoUrl: string;
  headline: string;
  linkedinUrl: string;
  currentRole: string;
  matchScore: number;
  matchReasons: string[];
  confidence: "soft" | "strong";
}

interface WarmIntroResponse {
  me: {
    name: string;
    photoUrl: string;
    headline: string;
    linkedinUrl: string;
  };
  company: {
    name: string;
    linkedinUrl: string;
    logoUrl: string;
  };
  contacts: WarmIntroContact[];
}

// Structured output type for agents
interface WarmIntroResult {
  success: boolean;
  query: {
    myLinkedinUrl: string;
    companyLinkedinUrl: string;
  };
  me: {
    name: string;
    headline: string;
    linkedinUrl: string;
  } | null;
  company: {
    name: string;
    linkedinUrl: string;
  } | null;
  contacts: Array<{
    name: string;
    headline: string;
    linkedinUrl: string;
    currentRole: string;
    matchScore: number;
    matchReasons: string[];
    confidence: "soft" | "strong";
    isStrongMatch: boolean;
  }>;
  summary: {
    totalContacts: number;
    strongMatches: number;
    softMatches: number;
    averageMatchScore: number;
    topMatchScore: number;
  };
  error?: string;
}

// Get user's LinkedIn URL from profile
function getUserLinkedInUrl(cwd: string): string | null {
  try {
    const profilePath = join(cwd, "USER_PROFILE.json");
    const profile = JSON.parse(readFileSync(profilePath, "utf-8"));
    return profile?.personal?.linkedin || null;
  } catch {
    return null;
  }
}

export default function warmIntroExtension(pi: ExtensionAPI) {
  // Register the find_warm_intro tool
  pi.registerTool({
    name: "find_warm_intro",
    label: "Find Warm Introduction",
    description: "Find relevant contacts at a company for warm introductions. Returns JSON with matched contacts, scores, and reasons for use by other agents.",
    promptSnippet: "Find warm introduction contacts at a target company using LinkedIn (returns JSON)",
    promptGuidelines: [
      "Use find_warm_intro when the user wants to find contacts at a specific company for networking or job referrals",
      "Use find_warm_intro when asked about warm introductions or mutual connections at a company",
      "The tool requires the target company's LinkedIn URL; your LinkedIn URL is auto-loaded from profile",
      "Output is JSON - parse it to extract contact details, scores, and LinkedIn URLs",
    ],
    parameters: Type.Object({
      myLinkedinUrl: Type.Optional(Type.String({ 
        description: "Your LinkedIn profile URL. If not provided, uses URL from USER_PROFILE.json" 
      })),
      companyLinkedinUrl: Type.String({ 
        description: "Target company's LinkedIn URL (e.g., https://www.linkedin.com/company/companyname)" 
      }),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      // Resolve user's LinkedIn URL
      const myLinkedinUrl = params.myLinkedinUrl || getUserLinkedInUrl(ctx.cwd);
      
      if (!myLinkedinUrl) {
        const errorResult: WarmIntroResult = {
          success: false,
          query: {
            myLinkedinUrl: params.myLinkedinUrl || "",
            companyLinkedinUrl: params.companyLinkedinUrl,
          },
          me: null,
          company: null,
          contacts: [],
          summary: {
            totalContacts: 0,
            strongMatches: 0,
            softMatches: 0,
            averageMatchScore: 0,
            topMatchScore: 0,
          },
          error: "No LinkedIn URL provided and none found in USER_PROFILE.json",
        };
        return {
          content: [{ type: "text", text: JSON.stringify(errorResult, null, 2) }],
          isError: true,
        };
      }

      // Show working status
      onUpdate?.({ 
        content: [{ type: "text", text: "Searching for warm introduction contacts..." }] 
      });

      try {
        const response = await fetch("https://tools.crustdata.com/api/warmintro/find", {
          method: "POST",
          headers: {
            "accept": "*/*",
            "accept-language": "en-US,en;q=0.9",
            "content-type": "application/json",
            "dnt": "1",
            "origin": "https://tools.crustdata.com",
            "referer": "https://tools.crustdata.com/warmintro",
          },
          body: JSON.stringify({
            meUrl: myLinkedinUrl,
            companyUrl: params.companyLinkedinUrl,
          }),
          signal,
        });

        if (!response.ok) {
          throw new Error(`API returned status ${response.status}: ${response.statusText}`);
        }

        const data = await response.json() as WarmIntroResponse;

        // Sort contacts by match score (highest first)
        const sortedContacts = [...data.contacts].sort((a, b) => b.matchScore - a.matchScore);

        // Calculate summary stats
        const strongMatches = sortedContacts.filter(c => c.confidence === "strong").length;
        const softMatches = sortedContacts.filter(c => c.confidence === "soft").length;
        const averageMatchScore = sortedContacts.length > 0
          ? Math.round((sortedContacts.reduce((sum, c) => sum + c.matchScore, 0) / sortedContacts.length) * 10) / 10
          : 0;
        const topMatchScore = sortedContacts.length > 0 ? sortedContacts[0].matchScore : 0;

        // Build structured JSON result
        const result: WarmIntroResult = {
          success: true,
          query: {
            myLinkedinUrl,
            companyLinkedinUrl: params.companyLinkedinUrl,
          },
          me: {
            name: data.me.name,
            headline: data.me.headline,
            linkedinUrl: data.me.linkedinUrl,
          },
          company: {
            name: data.company.name,
            linkedinUrl: data.company.linkedinUrl,
          },
          contacts: sortedContacts.map(contact => ({
            name: contact.name,
            headline: contact.headline,
            linkedinUrl: contact.linkedinUrl,
            currentRole: contact.currentRole,
            matchScore: contact.matchScore,
            matchReasons: contact.matchReasons,
            confidence: contact.confidence,
            isStrongMatch: contact.confidence === "strong",
          })),
          summary: {
            totalContacts: sortedContacts.length,
            strongMatches,
            softMatches,
            averageMatchScore,
            topMatchScore,
          },
        };

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          details: result,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        const errorResult: WarmIntroResult = {
          success: false,
          query: {
            myLinkedinUrl,
            companyLinkedinUrl: params.companyLinkedinUrl,
          },
          me: null,
          company: null,
          contacts: [],
          summary: {
            totalContacts: 0,
            strongMatches: 0,
            softMatches: 0,
            averageMatchScore: 0,
            topMatchScore: 0,
          },
          error: errorMessage,
        };
        return {
          content: [{ type: "text", text: JSON.stringify(errorResult, null, 2) }],
          isError: true,
        };
      }
    },
  });

  // Log extension load
  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.notify("Warm Intro extension loaded! Use find_warm_intro tool to find contacts (returns JSON).", "info");
  });
}
