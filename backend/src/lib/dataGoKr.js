import axios from "axios";

// 초보자 포인트:
// 공공데이터포털(OpenAPI)은 보통 아래 쿼리 파라미터가 필요합니다.
// - serviceKey: 인증키
// - pageNo / numOfRows: 페이지
// - type=json: JSON 응답
// 다만 데이터셋마다 파라미터/응답 구조가 조금씩 다를 수 있어, 여기서는 "안전한" 파서를 제공합니다.

export function createClient() {
  return axios.create({
    // 공공데이터(OpenAPI) 호출 중 특정 페이지가 느리게 응답하는 경우가 있어
    // 타임아웃을 늘려 일시적 지연에 대한 실패 확률을 줄입니다.
    timeout: 30000,
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

