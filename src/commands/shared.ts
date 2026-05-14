import type { ServerConfig } from "../config.js";
import { promptText } from "../cli.js";

export async function promptServerFields(
  defaults?: ServerConfig
): Promise<ServerConfig> {
  const isEditing = Boolean(defaults);
  const defaultFlag = defaults?.flag ?? "🌍";
  const defaultPort = defaults?.port ?? 22;
  const defaultUser = defaults?.user ?? "root";
  const address = await promptText({
    message: "Server address",
    placeholder: "203.0.113.10",
    initialValue: defaults?.address,
    validate: (value) => {
      if (value.length === 0) {
        return "Address is required.";
      }

      return undefined;
    }
  });
  const flag = await promptText({
    message: "Server flag",
    placeholder: "🌍",
    defaultValue: isEditing ? undefined : defaultFlag,
    initialValue: isEditing ? defaultFlag : undefined
  });
  const portValue = await promptText({
    message: "SSH port",
    placeholder: "22",
    defaultValue: isEditing ? undefined : String(defaultPort),
    initialValue: isEditing ? String(defaultPort) : undefined,
    validate: (value) => {
      if (value.length === 0) {
        return undefined;
      }

      const port = Number(value);

      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        return "Port must be an integer from 1 to 65535.";
      }

      return undefined;
    }
  });
  const user = await promptText({
    message: "SSH user",
    placeholder: "root",
    defaultValue: isEditing ? undefined : defaultUser,
    initialValue: isEditing ? defaultUser : undefined
  });

  return {
    address,
    flag: flag.length === 0 ? defaultFlag : flag,
    port: portValue.length === 0 ? defaultPort : Number(portValue),
    user: user.length === 0 ? defaultUser : user
  };
}
