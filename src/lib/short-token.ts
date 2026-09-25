import { customAlphabet } from "nanoid";

// Unambiguous, URL-safe alphabet (no 0/O/1/I/l) — these get printed on QR codes and typed by hand for NFC.
export const generateShortToken = customAlphabet("23456789ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz", 8);
