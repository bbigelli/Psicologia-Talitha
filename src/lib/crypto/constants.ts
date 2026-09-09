/** AES-256-GCM constants */
export const AES_ALGORITHM = "aes-256-gcm" as const
export const IV_LENGTH = 12
export const AUTH_TAG_LENGTH = 16
export const KEY_LENGTH = 32
export const DEK_LENGTH = 32

/** KEK version identifier stored alongside wrapped DEK */
export const CURRENT_KEK_VERSION = 1
