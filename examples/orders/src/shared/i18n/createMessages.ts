export function createMessages<TMessages extends Record<string, string>>(
  scope: string,
  messages: TMessages
) {
  const result = {} as Record<keyof TMessages, { defaultValue: string; name: string }>;

  for (const key in messages) {
    result[key] = { name: `${scope}/${key}`, defaultValue: messages[key] };
  }

  return result;
}
