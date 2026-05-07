import Constants from "expo-constants";
import { Platform } from "react-native";

const DEFAULT_API_PORT = "8080";

type ExpoConstantsWithHosts = typeof Constants & {
  expoConfig?: { hostUri?: string | null } | null;
  manifest?: { debuggerHost?: string | null } | null;
  manifest2?: {
    extra?: {
      expoClient?: { hostUri?: string | null } | null;
      expoGo?: { debuggerHost?: string | null } | null;
    } | null;
  } | null;
};

function stripProtocol(value: string) {
  return value.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
}

function hostFromAuthority(authority: string) {
  const bracketMatch = authority.match(/^\[([^\]]+)\]/);
  if (bracketMatch?.[1]) return bracketMatch[1];
  return authority.split(":")[0] ?? authority;
}

function portFromAuthority(authority: string) {
  const withoutBracketHost = authority.replace(/^\[[^\]]+\]/, "");
  const parts = withoutBracketHost.split(":");
  return parts.length > 1 ? (parts[parts.length - 1] || DEFAULT_API_PORT) : DEFAULT_API_PORT;
}

function authorityFromUri(uri: string) {
  return stripProtocol(uri).split("/")[0] ?? "";
}

function isLocalHost(host: string) {
  const normalized = host.toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "0.0.0.0" || normalized === "::1";
}

function getExpoHost() {
  const constants = Constants as ExpoConstantsWithHosts;
  const hostUri =
    constants.expoConfig?.hostUri ??
    constants.manifest2?.extra?.expoClient?.hostUri ??
    constants.manifest2?.extra?.expoGo?.debuggerHost ??
    constants.manifest?.debuggerHost;

  if (!hostUri) return null;
  const host = hostFromAuthority(authorityFromUri(hostUri));
  return host || null;
}

export function getApiBaseUrl() {
  const explicit = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const domain = process.env.EXPO_PUBLIC_DOMAIN?.trim();
  if (!domain) return "";

  const authority = authorityFromUri(domain);
  const host = hostFromAuthority(authority);
  const isLocal = isLocalHost(host);

  if (isLocal && Platform.OS !== "web") {
    const expoHost = getExpoHost();
    const apiPort = portFromAuthority(authority);

    if (expoHost && !isLocalHost(expoHost)) {
      return `http://${expoHost}:${apiPort}`;
    }

    if (Platform.OS === "android") {
      return `http://10.0.2.2:${apiPort}`;
    }
  }

  return `${isLocal ? "http" : "https"}://${authority}`;
}

export function apiUrl(path: string) {
  const baseUrl = getApiBaseUrl();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return baseUrl ? `${baseUrl}${normalizedPath}` : normalizedPath;
}
