import http from "k6/http";
import { check } from "k6";

// Dynamically read API_URL from environment, fallback to localhost
const API_URL = __ENV.API_URL || "http://localhost:4000/api";

export const options = {
  scenarios: {
    flash_sale_spike: {
      executor: "shared-iterations",
      vus: 200,
      iterations: 300,
      maxDuration: "15s",
    },
  },
};

export function setup() {
  http.post(`${API_URL}/seats/reset`);
  const loginRes = http.post(
    `${API_URL}/auth/login`,
    JSON.stringify({ email: "user_alpha@test.com", password: "password123" }),
    { headers: { "Content-Type": "application/json" } }
  );
  return { tokenCookie: loginRes.cookies.token[0].value };
}

export default function (data) {
  const res = http.post(`${API_URL}/seats/A1/hold`, null, {
    headers: {
      Cookie: `token=${data.tokenCookie}`,
      "x-load-test-secret": "benchmark_secret_bypass",
    },
  });

  check(res, {
    "is 200 (winner) or 409 (conflict)": (r) => r.status === 200 || r.status === 409,
  });
}