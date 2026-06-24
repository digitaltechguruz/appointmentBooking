import { Prisma } from "@prisma/client";

export function isPrismaClientValidationError(
  error: unknown,
): error is Prisma.PrismaClientValidationError {
  return (
    error instanceof Prisma.PrismaClientValidationError ||
    (error instanceof Error &&
      error.name === "PrismaClientValidationError")
  );
}

export function prismaSetupHint(error: unknown) {
  if (!isPrismaClientValidationError(error)) return null;

  const message = error instanceof Error ? error.message : String(error);
  if (
    message.includes("hoursTimeFormat") ||
    message.includes("weekStartsOn") ||
    message.includes("closedAllDay") ||
    message.includes("startTime") ||
    message.includes("endTime")
  ) {
    return "Database client is out of date. Run npm run setup in the appointment-booking folder, then restart the dev server.";
  }

  return "Invalid database request. Run npm run setup and restart the dev server.";
}

export async function runAvailabilityAction<T>(
  fn: () => Promise<T>,
): Promise<T | { error: { _form: string } }> {
  try {
    return await fn();
  } catch (error) {
    const hint = prismaSetupHint(error);
    if (hint) {
      console.error("[availability]", error);
      return { error: { _form: hint } };
    }
    throw error;
  }
}
