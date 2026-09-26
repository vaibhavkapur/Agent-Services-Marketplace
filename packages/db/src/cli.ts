import { migrate } from "./postgres.js";

const command = process.argv[2];
if (command === "migrate") {
  await migrate();
  console.log("migrations applied");
} else {
  console.log("usage: tsx packages/db/src/cli.ts migrate");
}
