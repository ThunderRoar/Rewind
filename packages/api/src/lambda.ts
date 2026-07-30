import awsLambdaFastify from "@fastify/aws-lambda";
import { buildApp } from "./app.js";

// Lambda entrypoint (bundled handler = index.handler). Config comes from process.env.
export const handler = awsLambdaFastify(buildApp());
