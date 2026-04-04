import axios from "axios";

/** 공공데이터 OpenAPI: serviceKey·페이지·type=json 등 파라미터와 응답 형태 차이를 흡수하는 클라이언트/파서 */

export function createClient() {
  return axios.create({
    timeout: 15000,
    headers: { "User-Agent": "bike-integrator/1.0" },
  });
}

export function withServiceKey(params = {}) {
  const serviceKey = process.env.DATA_GO_KR_SERVICE_KEY;
  if (!serviceKey) return params;
  return { ...params, serviceKey };
}

export function extractRows(maybeApiResponse) {
  // 가능한 응답 형태를 최대한 흡수:
  // - data.response.body.items.item
  // - data.response.body.item
  // - data.body.item
  // - data.items
  // - data.data
  let data = maybeApiResponse?.data ?? maybeApiResponse;
  // 어떤 OpenAPI는 Content-Type이 애매해서 문자열로 올 수 있습니다.
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      // 파싱 실패면 그대로 진행(결과는 빈 배열로 떨어질 수 있음)
    }
  }
  const item =
    data?.response?.body?.items?.item ??
    data?.response?.body?.items ??
    data?.response?.body?.item ??
    data?.body?.items?.item ??
    data?.body?.items ??
    data?.body?.item ??
    data?.items?.item ??
    data?.items ??
    data?.data ??
    data;

  if (!item) return [];
  if (Array.isArray(item)) return item;
  if (typeof item === "object") return [item];
  return [];
}

export function extractTotalCount(maybeApiResponse) {
  let data = maybeApiResponse?.data ?? maybeApiResponse;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      return null;
    }
  }
  const total =
    data?.response?.body?.totalCount ??
    data?.body?.totalCount ??
    data?.totalCount ??
    null;
  const n = Number(total);
  return Number.isFinite(n) ? n : null;
}

