import type { FaultName, ProtocolName } from "@asm/shared";
import { store, budgetFor, invokeLookup } from "./coordinator.js";
import { closeSession, extractPages, openSession } from "./sessions.js";
import { buildReport } from "./report.js";

const DOCUMENTS: Record<string, string> = {
  s1: "d-s1",
  s3: "d-s3",
  s5: "d-s5",
};

export async function runResearch(taskId: string, fault: FaultName = "none") {
  const task = store.getTask(taskId);
  if (!task) throw new Error("Task not found");
  store.updateTask(taskId, { status: "running" });
  const notes: string[] = [];

  for (const supplierId of task.supplierIds) {
    const protocol: ProtocolName = task.preferredLookupProtocol;
    const invocation = await invokeLookup({
      task,
      serviceId: "supplier_lookup",
      supplierId,
      protocol,
      fault: fault === "drop-after-payment" && supplierId === task.supplierIds[0] ? "drop-after-payment" : "none",
    });
    if (invocation.invocationState === "rejected") {
      notes.push(`Lookup for ${supplierId} was refused: ${invocation.lastError}`);
    } else if (invocation.invocationState === "recovery_required") {
      notes.push(`Lookup for ${supplierId} is held in recovery.`);
    }
  }

  if (task.allowedServices.includes("supplier_diligence") && task.supplierIds[0]) {
    const premium = await invokeLookup({
      task,
      serviceId: "supplier_diligence",
      supplierId: task.supplierIds[0],
      protocol: "x402",
    });
    if (premium.invocationState === "rejected") {
      notes.push(`Premium diligence skipped: ${premium.lastError}`);
    }
  }

  if (task.allowedServices.includes("document_extraction")) {
    const extractable = task.supplierIds.filter((id) => DOCUMENTS[id]).slice(0, 2);
    if (extractable.length) {
      try {
        const session = await openSession(task, "40000");
        for (const supplierId of extractable) {
          await extractPages({
            task,
            sessionId: session.id,
            documentId: DOCUMENTS[supplierId]!,
            pageIndexes: [0],
          });
        }
        await closeSession({
          task,
          sessionId: session.id,
          fault: fault === "interrupt-session" ? "interrupt-session" : undefined,
        });
      } catch (error) {
        notes.push(error instanceof Error ? error.message : "Session failed");
      }
    }
  }

  const latest = store.getTask(taskId)!;
  const report = buildReport(latest, budgetFor(latest));
  store.updateTask(taskId, { status: "completed", completedAt: new Date().toISOString() });
  return { report, notes, task: store.getTask(taskId), budget: budgetFor(latest) };
}
