#!/usr/bin/env node
/**
 * job-seeker-profile — profile.js
 *
 * Helper script for the Job Seeker Profile skill.
 * Provides programmatic read/write for USER_PROFILE.json.
 *
 * Usage:
 *   node ./scripts/profile.js read          # Print profile as JSON
 *   node ./scripts/profile.js exists        # Exit 0 if profile exists
 *   node ./scripts/profile.js path          # Print profile path
 *   node ./scripts/profile.js set <key> <value>  # Set a top-level field (simple string)
 *   node ./scripts/profile.js set <key> <json>   # Set a top-level field (JSON value)
 */

const fs = require("fs");
const path = require("path");

const PROFILE_NAME = "USER_PROFILE.json";

function findProfile() {
  let dir = process.cwd();
  const { root } = path.parse(dir);

  while (true) {
    const candidate = path.join(dir, PROFILE_NAME);
    if (fs.existsSync(candidate)) return candidate;

    const gitDir = path.join(dir, ".git");
    if (fs.existsSync(gitDir) && fs.statSync(gitDir).isDirectory()) {
      return null;
    }

    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

const cmd = process.argv[2];

switch (cmd) {
  case "read": {
    const profilePath = findProfile();
    if (!profilePath) {
      console.error("No USER_PROFILE.json found");
      process.exit(1);
    }
    const raw = fs.readFileSync(profilePath, "utf-8");
    try {
      const data = JSON.parse(raw);
      data._path = profilePath;
      process.stdout.write(JSON.stringify(data, null, 2) + "\n");
    } catch (e) {
      console.error("Invalid JSON in USER_PROFILE.json:", e.message);
      process.exit(1);
    }
    break;
  }

  case "exists": {
    process.exit(findProfile() ? 0 : 1);
  }

  case "path": {
    const profilePath = findProfile();
    if (profilePath) {
      process.stdout.write(profilePath + "\n");
    } else {
      process.stdout.write(path.join(process.cwd(), PROFILE_NAME) + "\n");
    }
    break;
  }

  case "set": {
    const key = process.argv[3];
    const value = process.argv[4];
    if (!key || !value) {
      console.error("Usage: node ./scripts/profile.js set <key> <value>");
      process.exit(1);
    }

    const profilePath = findProfile();
    if (!profilePath) {
      console.error("No USER_PROFILE.json found. Create one first.");
      process.exit(1);
    }

    const raw = fs.readFileSync(profilePath, "utf-8");
    const data = JSON.parse(raw);

    // Try parsing value as JSON, fall back to string
    try {
      data[key] = JSON.parse(value);
    } catch {
      data[key] = value;
    }

    data.last_updated = new Date().toISOString().split("T")[0];
    fs.writeFileSync(profilePath, JSON.stringify(data, null, 2) + "\n");
    console.log(`Updated ${key} in USER_PROFILE.json`);
    break;
  }

  default:
    console.error("Usage: node ./scripts/profile.js <read|exists|path|set>");
    process.exit(1);
}
