// Bundle the Fastify API into a single CJS file for AWS Lambda.
// Run:  pnpm --filter @rewind/api build:lambda
// Then zip the dist/lambda/ folder and deploy; handler = index.handler.
import { build } from "esbuild";
import { mkdirSync, writeFileSync } from "node:fs";

await build({
  entryPoints: ["src/lambda.ts"],
  bundle: true,
  minify: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  outfile: "dist/lambda/index.js",
  external: ["pg-native"], // optional native driver we don't use
});

mkdirSync("dist/lambda", { recursive: true });
// Override the package's "type":"module" so Lambda loads index.js as CommonJS.
writeFileSync("dist/lambda/package.json", JSON.stringify({ type: "commonjs" }));

console.log("✅ dist/lambda/index.js — zip dist/lambda/ and set the Lambda handler to index.handler");
