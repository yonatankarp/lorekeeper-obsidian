// D&D Beyond sign-in: the pasted CobaltSession cookie, kept only in Obsidian's secret storage (never in a vault file,
// so backups never carry it).

const SECRET_ID = "lorekeeper-dndbeyond";

const cleanCookie = (input) => String(input ?? "").trim().replace(/^CobaltSession=/i, "").replace(/^"|"$/g, "").trim();

function signIn(secretStorage, input) {
  if (!secretStorage?.setSecret) throw new Error("Signing in needs Obsidian's secret storage (Obsidian 1.13 or later).");
  const cookie = cleanCookie(input);
  if (!cookie) throw new Error("Paste your CobaltSession cookie to sign in (see docs/DNDBEYOND.md in this vault).");
  secretStorage.setSecret(SECRET_ID, cookie);
}

function signOut(secretStorage) {
  secretStorage?.setSecret?.(SECRET_ID, "");
}

// After checking a new cookie: null keeps it; otherwise the secret to store instead and what to say. An expired cookie
// signs out; any other failure (offline, D&D Beyond down) puts back the sign-in that was there before.
function afterVerify(error, previous, expiredMessage) {
  if (!error) return null;
  if (error.message === expiredMessage) return { keep: "", message: expiredMessage };
  return { keep: previous ?? "", message: `Couldn't check the sign-in: ${error.message.replace(/\.$/, "")}. Your previous sign-in is kept.` };
}

module.exports = { SECRET_ID, cleanCookie, signIn, signOut, afterVerify };
