import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadSession() {
  const sandbox = { window: {} };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(resolve(root, "docs/assets/js/practice-core.js"), "utf8"), sandbox, {
    filename: "practice-core.js",
  });
  vm.runInContext(readFileSync(resolve(root, "docs/assets/js/session.js"), "utf8"), sandbox, {
    filename: "session.js",
  });
  return sandbox.window.VerseKeepSession;
}

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    },
    snapshot() {
      return Object.fromEntries(data);
    },
  };
}

const session = loadSession();
const goodPractice = JSON.stringify({ checks: 4, correct: 3, verseHits: { "Psalm 56:3": 3 } });
const storage = memoryStorage({ "versekeep-stats-v1": goodPractice });

const exported = session.exportSnapshot({
  practice: {
    checks: 2,
    correct: 1,
    verseHits: { "Psalm 56:3": 1 },
    versePractice: {
      "Psalm 56:3": { correct: 1, missed: 1, lastDay: "2026-09-20", lastResult: "missed" },
    },
  },
  preferences: { mode: "blank", translation: "NIV", autoAdvance: true, medFocus: false, lastMedTopic: "gospel" },
  amen: { count: 2, lastDay: "2026-09-24", history: [{ day: "2026-09-24", ref: "Psalm 56:3" }] },
  wallpapers: {
    mode: "manual",
    id: "dawn-hills",
    format: "phone",
    title: "Dawn over the hills",
    src: "assets/wallpapers/phone/dawn-hills-phone.jpg",
    desktopSrc: "assets/wallpapers/dawn-hills.jpg",
    phoneSrc: "assets/wallpapers/phone/dawn-hills-phone.jpg",
  },
});
assert.equal(exported.ok, true, "a real device snapshot can be exported");

const fresh = memoryStorage();
const restored = session.persistSnapshot(exported.snapshot, fresh);
assert.equal(restored.ok, true, "a fresh device accepts a valid snapshot");
assert.equal(JSON.parse(fresh.getItem("versekeep-stats-v1")).checks, 2, "practice progress restores");
assert.equal(JSON.parse(fresh.getItem("versekeep-prefs-v1")).translation, "niv", "preferences restore");
assert.equal(JSON.parse(fresh.getItem("versekeep-med-streak-v1")).count, 2, "Amen history restores");
assert.equal(JSON.parse(fresh.getItem("versekeep-wallpaper-pref-v2")).format, "phone", "wallpaper selection restores");
assert.equal(
  JSON.parse(fresh.getItem("versekeep-stats-v1")).versePractice["Psalm 56:3"].lastResult,
  "missed",
  "per-verse practice outcomes restore"
);

const invalids = [
  "{",
  { format: "other", version: 1 },
  { format: session.FORMAT, version: 2, practice: {}, preferences: {}, amen: {}, wallpapers: { mode: "daily" } },
  {
    format: session.FORMAT,
    version: 1,
    practice: { checks: "4" },
    preferences: {},
    amen: {},
    wallpapers: { mode: "daily" },
  },
  {
    format: session.FORMAT,
    version: 1,
    practice: {},
    preferences: {},
    amen: { history: [{ day: "not-a-day", ref: "Psalm 56:3" }] },
    wallpapers: { mode: "daily" },
  },
  {
    format: session.FORMAT,
    version: 1,
    practice: {},
    preferences: {},
    amen: {},
    wallpapers: { mode: "manual" },
  },
];
for (const invalid of invalids) {
  const before = storage.snapshot();
  const parsed = session.parseSnapshot(invalid);
  assert.equal(parsed.ok, false, "invalid backup is rejected");
  const persisted = session.persistSnapshot(invalid, storage);
  assert.equal(persisted.persisted, false, "invalid backup is not written");
  assert.deepEqual(storage.snapshot(), before, "invalid backup leaves good state untouched");
}
assert.equal(storage.getItem("versekeep-stats-v1"), goodPractice, "the original practice value is still in place");

const flaky = memoryStorage({ "versekeep-stats-v1": goodPractice, "versekeep-prefs-v1": "{\"mode\":\"study\"}" });
const originalSet = flaky.setItem.bind(flaky);
flaky.setItem = (key, value) => {
  if (key === "versekeep-med-streak-v1") throw new Error("denied");
  originalSet(key, value);
};
const failed = session.persistSnapshot(exported.snapshot, flaky);
assert.equal(failed.ok, false, "a denied write is not reported as saved");
assert.equal(failed.persisted, false, "a denied write does not claim persistence");
assert.equal(flaky.getItem("versekeep-stats-v1"), goodPractice, "earlier keys roll back after a failed write");
assert.equal(flaky.getItem("versekeep-prefs-v1"), "{\"mode\":\"study\"}", "rolled back preferences stay intact");
assert.equal(flaky.getItem("versekeep-med-streak-v1"), null, "the failed key is not created");

const fallback = session.labelScripture("niv", {
  text: "Bundled wording",
  translation: "LOCAL",
  source: "bundled JSON (live fetch failed)",
});
assert.equal(fallback.live, false, "fallback text is not live");
assert.equal(fallback.label, "Bundled", "fallback text is not labeled with the selected translation");
assert.notEqual(fallback.label, "NIV");
const stale = session.labelScripture("niv", { text: "Other wording", translation: "ESV", source: "live" });
assert.equal(stale.rejected, true, "a different translation is rejected");
assert.equal(stale.text, "", "rejected text cannot be painted");
const matched = session.labelScripture("esv", { text: "Live wording", translation: "ESV", source: "live" });
assert.equal(matched.live, true, "matching live text keeps its translation");
assert.equal(matched.label, "ESV");
assert.equal(
  session.shouldApplyScripture(
    { token: 2, ref: "Psalm 56:3", translation: "niv" },
    { token: 2, ref: "Psalm 56:3", translation: "niv" }
  ),
  true,
  "the current verse and translation may commit"
);
assert.equal(
  session.shouldApplyScripture(
    { token: 1, ref: "Psalm 56:3", translation: "esv" },
    { token: 2, ref: "John 3:16", translation: "niv" }
  ),
  false,
  "an overlapped navigation cannot commit"
);
assert.equal(
  session.shouldApplyScripture(
    { token: 3, ref: "Psalm 56:3", translation: "esv" },
    { token: 3, ref: "Psalm 56:3", translation: "niv" }
  ),
  false,
  "an overlapped translation change cannot commit"
);

assert.equal(
  session.wallpaperFileName("assets/wallpapers/phone/dawn-hills-phone.jpg", "fallback.jpg"),
  "dawn-hills-phone.jpg",
  "a bundled phone crop shows its real file"
);
assert.equal(
  session.wallpaperFileName("https://images.unsplash.com/photo-1504052430486-c2d9c9ff00e5?w=1080", "rw-open-word-phone.jpg"),
  "rw-open-word-phone.jpg",
  "a remote image uses the download name that will be saved"
);

class Utterance {
  constructor(text) {
    this.text = text;
    this.onend = null;
  }
}
const spoken = [];
const host = {
  speechSynthesis: {
    cancel() {},
    speak(utterance) {
      spoken.push(utterance);
    },
  },
  SpeechSynthesisUtterance: Utterance,
};
const speech = session.createSpeechSession(host);
let continued = 0;
speech.speak("first", {
  onend() {
    continued += 1;
    speech.speak("second");
  },
});
spoken[0].onend();
assert.equal(continued, 1, "a finished reading may continue only while it is current");
assert.equal(spoken[1].text, "second");
speech.speak("third", {
  onend() {
    continued += 1;
    speech.speak("fourth");
  },
});
const third = spoken[spoken.length - 1];
speech.cancel();
assert.equal(third.onend, null, "cancellation clears the utterance continuation");
assert.equal(continued, 1, "cancelled speech does not continue");
assert.equal(spoken.some((utterance) => utterance.text === "fourth"), false, "no follow-up speech is queued");

const appSource = readFileSync(resolve(root, "docs/assets/js/app.js"), "utf8");
const meditateSource = readFileSync(resolve(root, "docs/assets/js/meditate.js"), "utf8");
assert.match(appSource, /VerseKeepSession\.speech/, "practice uses the shared speech session");
assert.match(meditateSource, /VerseKeepSession\.speech/, "meditation uses the shared speech session");
assert.match(appSource, /function startReview/, "review is an explicit practice action");
assert.match(appSource, /async function practiceVerse\(ref, themeId\)/, "practice this verse stays available");
assert.match(meditateSource, /recoverLiveText/, "meditation recovery stays on the current card");
const recovery = meditateSource.slice(
  meditateSource.indexOf("function recoverLiveText"),
  meditateSource.indexOf("async function showIndex")
);
assert.doesNotMatch(recovery, /setTopic|showIndex/, "network recovery does not navigate to another verse");
assert.match(recovery, /hydrateCurrent/, "network recovery reloads the selected verse");

console.log("test-session.mjs: backup, translation label, speech, and review wiring assertions passed");
