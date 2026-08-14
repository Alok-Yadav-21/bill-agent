import { NextResponse } from "next/server";

/** Consistent, safe API envelope. Internal errors never leak stack traces. */
export type ApiOk<T> = { ok: true; data: T };
export type ApiErr = { ok: false; error: { code: string; message: string } };

export function ok<T>(data: T, status = 200) {
  return NextResponse.json<ApiOk<T>>({ ok: true, data }, { status });
}

export function fail(code: string, message: string, status = 400) {
  return NextResponse.json<ApiErr>(
    { ok: false, error: { code, message } },
    { status },
  );
}

/** Wrap a handler so unexpected throws become a generic 500 (details logged). */
export async function guarded(
  fn: () => Promise<Response>,
): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    console.error("[api] unhandled error", err);
    return fail("INTERNAL", "Something went wrong. Please try again.", 500);
  }
}
