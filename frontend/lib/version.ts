export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0";
export const GIT_SHA = process.env.NEXT_PUBLIC_GIT_SHA ?? "dev";

export const VERSION_LABEL =
  GIT_SHA && GIT_SHA !== "dev"
    ? `v${APP_VERSION} · ${GIT_SHA}`
    : `v${APP_VERSION}`;
