import dotenv from "dotenv";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Load repo-root .env by walking up (Lambda uses function-config env instead).
export function loadRootEnv(): void {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    const candidate = resolve(dir, ".env");
    if (existsSync(candidate)) {
      dotenv.config({ path: candidate });
      return;
    }
    dir = resolve(dir, "..");
  }
  dotenv.config();
}
