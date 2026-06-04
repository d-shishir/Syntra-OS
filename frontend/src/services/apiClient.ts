const BACKEND_URL = "http://localhost:8000";

interface RequestOptions extends RequestInit {
  params?: Record<string, string>;
}

const getAuthHeaders = (extraHeaders: Record<string, string> = {}) => {
  const token = localStorage.getItem("syntra_token") || "";
  const auth: Record<string, string> = {};
  if (token) {
    auth["Authorization"] = `Bearer ${token}`;
  }
  return {
    ...auth,
    ...extraHeaders
  };
};

export const apiClient = {
  async request(path: string, options: RequestOptions = {}) {
    const { params, headers, ...rest } = options;
    
    let url = path.startsWith("http") ? path : `${BACKEND_URL}${path}`;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null) {
          searchParams.append(key, String(val));
        }
      });
      const qs = searchParams.toString();
      if (qs) {
        url += (url.includes("?") ? "&" : "?") + qs;
      }
    }

    const mergedHeaders = getAuthHeaders(headers as Record<string, string>);

    const response = await fetch(url, {
      ...rest,
      headers: mergedHeaders
    });

    if (response.status === 401 && !url.includes("/login")) {
      localStorage.removeItem("syntra_token");
      // Force reload to trigger authentication view in UI
      window.location.reload();
    }

    return response;
  },

  async get(path: string, options?: RequestOptions) {
    return this.request(path, { ...options, method: "GET" });
  },

  async post(path: string, body?: unknown, options?: RequestOptions) {
    const isJson = body !== null && typeof body === "object" && !(body instanceof FormData);
    const headers = isJson 
      ? { "Content-Type": "application/json", ...options?.headers }
      : options?.headers;

    return this.request(path, {
      ...options,
      method: "POST",
      headers,
      body: isJson ? JSON.stringify(body) : (body as BodyInit)
    });
  },

  async delete(path: string, options?: RequestOptions) {
    return this.request(path, { ...options, method: "DELETE" });
  }
};

// Patch window.fetch for backward compatibility with older dashboard modules
const originalFetch = window.fetch;
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const token = localStorage.getItem("syntra_token");
  if (token) {
    const nextInit = { ...init };
    if (!nextInit.headers) {
      nextInit.headers = {};
    }
    
    if (nextInit.headers instanceof Headers) {
      if (!nextInit.headers.has("Authorization")) {
        nextInit.headers.set("Authorization", `Bearer ${token}`);
      }
    } else if (Array.isArray(nextInit.headers)) {
      const hasAuth = nextInit.headers.some(([k]) => k.toLowerCase() === 'authorization');
      if (!hasAuth) {
        nextInit.headers = [...nextInit.headers, ["Authorization", `Bearer ${token}`]];
      }
    } else {
      nextInit.headers = {
        ...nextInit.headers,
      };
      const headersObj = nextInit.headers as Record<string, string>;
      if (!headersObj["Authorization"] && !headersObj["authorization"]) {
        headersObj["Authorization"] = `Bearer ${token}`;
      }
    }
    return originalFetch(input, nextInit);
  }
  return originalFetch(input, init);
};

export default apiClient;

