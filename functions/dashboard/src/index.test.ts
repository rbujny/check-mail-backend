import assert from "node:assert/strict";
import test from "node:test";

import { computeSessionToken, getDashboardCredentials, safeCompare } from "./auth";
import { getDateFormat, getRangeInterval } from "./database";
import { getMockScans, getMockStats } from "./mock-data";
import { getDashboardStats, getRecentScansList } from "./stats-service";

test("timing-safe string comparison", () => {
  assert.equal(safeCompare("secret-token", "secret-token"), true);
  assert.equal(safeCompare("secret-token", "wrong-token"), false);
  assert.equal(safeCompare("secret", "secret-longer"), false);
});

test("session token generation is deterministic and unique", () => {
  const token1 = computeSessionToken("admin", "password123");
  const token2 = computeSessionToken("admin", "password123");
  const token3 = computeSessionToken("admin", "different");
  assert.equal(token1, token2);
  assert.notEqual(token1, token3);
  assert.equal(typeof token1, "string");
  assert.ok(token1.length >= 32);
});

test("parameterized range interval and date format mapping", () => {
  assert.equal(getRangeInterval("24h"), "24 hours");
  assert.equal(getRangeInterval("7d"), "7 days");
  assert.equal(getRangeInterval("30d"), "30 days");
  assert.equal(getRangeInterval("all"), "36500 days");

  assert.equal(getDateFormat("24h"), "YYYY-MM-DD HH24:00");
  assert.equal(getDateFormat("7d"), "YYYY-MM-DD");
  assert.equal(getDateFormat("all"), "YYYY-MM-DD");
});

test("dashboard auth default credentials", () => {
  const { username, password } = getDashboardCredentials();
  assert.ok(username.length > 0);
  assert.ok(password.length > 0);
});

test("mock stats structure and metrics integrity", () => {
  const stats = getMockStats();
  assert.equal(stats.isMockData, true);
  assert.ok(stats.overview.totalScans > 0);
  assert.equal(
    stats.overview.totalScans,
    stats.overview.phishingCount + stats.overview.warningCount + stats.overview.okCount
  );
  assert.ok(stats.timeline.length > 0);
  assert.ok(stats.models.length > 0);
  assert.ok(stats.topHeuristicFindings.length > 0);
});

test("mock scans data provides valid records", () => {
  const scans = getMockScans();
  assert.ok(scans.length > 0);
  for (const scan of scans) {
    assert.ok(scan.id);
    assert.ok(["OK", "WARNING", "PHISHING"].includes(scan.finalResult));
    assert.ok(["heuristic", "llm"].includes(scan.route));
    assert.ok(typeof scan.durationMs === "number");
  }
});

test("stats-service returns empty data with dbStatus when no database", async () => {
  const stats = await getDashboardStats("all");
  assert.ok(stats);
  assert.equal(stats.overview.totalScans, 0);
  assert.equal(stats.isMockData, false);
  assert.equal(stats.dbStatus, "no_config");
  assert.ok(stats.generatedAt);
});

test("recent scans returns empty array when no database", async () => {
  const scansResponse = await getRecentScansList(10);
  assert.deepEqual(scansResponse.scans, []);
  assert.equal(scansResponse.total, 0);
  assert.equal(scansResponse.isMockData, false);
});

test("renderDashboardHtml returns technical dashboard HTML with React and Tailwind", async () => {
  const { renderDashboardHtml } = await import("./ui");
  const html = renderDashboardHtml();
  assert.ok(html.includes("<!DOCTYPE html>"));
  assert.ok(html.includes("CHECKMAIL_ADMIN"));
  assert.ok(html.includes("react@18"));
  assert.ok(html.includes("tailwindcss"));
  assert.ok(html.includes("JetBrains Mono"));
});

test("rate limiter clamps excessive requests from single IP", async () => {
  const { checkRateLimit, clearRateLimits } = await import("./auth");
  clearRateLimits();
  const testIp = "192.168.1.100";
  for (let i = 0; i < 5; i++) {
    assert.equal(checkRateLimit(testIp, 5, 60000), true);
  }
  // 6th request should fail
  assert.equal(checkRateLimit(testIp, 5, 60000), false);
  clearRateLimits();
});
