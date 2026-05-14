import { cancel, confirm, isCancel, select, text } from "@clack/prompts";

export class PromptCancelledError extends Error {
  constructor() {
    super("Prompt cancelled.");
    this.name = "PromptCancelledError";
  }
}

export function cancelWithMessage(message: string): never {
  cancel(message);
  process.exit(1);
}

export async function promptText(options: {
  message: string;
  placeholder?: string;
  defaultValue?: string;
  initialValue?: string;
  validate?: (value: string) => string | undefined;
}): Promise<string> {
  const result = await text({
    message: options.message,
    placeholder: options.placeholder,
    defaultValue: options.defaultValue,
    initialValue: options.initialValue,
    validate: options.validate
  });

  return unwrapPrompt(result) ?? "";
}

export type SelectOption<T extends string> = {
  value: T;
  label: string;
  hint?: string;
};

export async function promptSelect<T extends string>(
  options: SelectOption<T>[],
  message: string
): Promise<T> {
  const result = await select({
    message,
    options: options as Parameters<typeof select<T>>[0]["options"]
  });

  return unwrapPrompt(result);
}

export async function promptConfirm(message: string): Promise<boolean> {
  const result = await confirm({
    message,
    initialValue: false
  });

  return unwrapPrompt(result);
}

export function failAndExit(error: unknown): never {
  if (isPromptCancelledError(error)) {
    cancel("Cancelled.");
    process.exit(0);
  }

  cancel(error instanceof Error ? error.message : "Unknown error.");
  process.exit(1);
}

export function isPromptCancelledError(error: unknown): error is PromptCancelledError {
  return error instanceof PromptCancelledError;
}

function unwrapPrompt<T>(value: T | symbol): T {
  if (isCancel(value)) {
    throw new PromptCancelledError();
  }

  return value;
}
