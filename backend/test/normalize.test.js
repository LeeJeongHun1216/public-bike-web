import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeStationRow,
  normalizeStockRow,
  normalizeUsageRow,
} from "../src/lib/normalize.js";

test("normalizeUsageRow: rntNocs / rtnNocs", () => {
  const u = normalizeUsageRow({ rntNocs: "9", rtnNocs: "11" });
  assert.equal(u.rentalCount, 9);
  assert.equal(u.returnCount, 11);
  assert.equal(u.stationKey, "");
});

test("normalizeUsageRow: RNT_NOCS / RTN_NOCS aliases", () => {
  const u = normalizeUsageRow({ RNT_NOCS: "3", RTN_NOCS: "4", rntstnId: "S1" });
  assert.equal(u.rentalCount, 3);
  assert.equal(u.returnCount, 4);
  assert.equal(u.stationKey, "S1");
});

test("normalizeStationRow: 포털식 rntstnId / rntstnNm / 좌표", () => {
  const s = normalizeStationRow({
    rntstnId: "ST-1",
    rntstnNm: "테스트 대여소",
    rntstnLa: 37.5,
    rntstnLo: 127.0,
    lcgvmnInstCd: "1100000000",
  });
  assert.equal(s.stationId, "ST-1");
  assert.equal(s.stationName, "테스트 대여소");
  assert.equal(s.lat, 37.5);
  assert.equal(s.lng, 127.0);
  assert.equal(s.region, "서울");
});

test("normalizeStockRow: bcyclTpkctNocs", () => {
  const st = normalizeStockRow({
    rntstnId: "A",
    rntstnNm: "x",
    bcyclTpkctNocs: "5",
  });
  assert.equal(st.stationKey, "A");
  assert.equal(st.availableBike, 5);
});
