import type { ApiError } from "./api/generated/types.gen";

export function dismissFieldError(
  error: ApiError | null | undefined,
  field: string,
): ApiError | undefined {
  if (!error) return undefined;
  if (error.code === "meeting_type_exists" && field === "id") return undefined;
  if (error.code !== "validation_error" || !error.fieldErrors?.[field]) return error;
  const fieldErrors = Object.fromEntries(
    Object.entries(error.fieldErrors).filter(([name]) => name !== field),
  );
  return Object.keys(fieldErrors).length ? { ...error, fieldErrors } : undefined;
}
