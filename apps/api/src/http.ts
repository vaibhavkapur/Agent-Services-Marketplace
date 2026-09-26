export async function requestJson(input: {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
}): Promise<{ status: number; headers: Record<string, string>; json: unknown }> {
  const headers: Record<string, string> = { ...input.headers };
  const body = input.body === undefined ? undefined : JSON.stringify(input.body);
  if (body !== undefined) headers["content-type"] = "application/json";
  const response = await fetch(input.url, {
    method: input.method ?? "GET",
    headers,
    body,
    redirect: "error",
  });
  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });
  let json: unknown = null;
  const text = await response.text();
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
  }
  return { status: response.status, headers: responseHeaders, json };
}

export function hostOf(url: string): string {
  return new URL(url).host;
}

export function header(headers: Record<string, string>, name: string): string | undefined {
  return headers[name] ?? headers[name.toLowerCase()];
}
