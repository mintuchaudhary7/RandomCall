import axios from "axios";

export const BASE_URL = "http://localhost:5000";

const APIConfig = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// 🔐 Request Interceptor
APIConfig.interceptors.request.use(
  (config) => {
    // Get token from localStorage or cookies
    const token = localStorage.getItem("token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    console.log("🔼 API Request:", config.method?.toUpperCase(), config.url);
    return config;
  },
  (error) => Promise.reject(error)
);

// ⚠️ Response Interceptor
APIConfig.interceptors.response.use(
  (response) => {
    console.log("🔽 API Response:", response.config.url, response.status);
    return response;
  },
  (error) => {
    console.error("❌ API Error:", error.response?.status, error.message);

    // Optional: Handle 401 errors (token expired)
    if (error.response?.status === 401) {
      // For example: redirect to login or refresh token
      window.location.href = "/login";
    }

    return Promise.reject(error);
  }
);

export default APIConfig;
