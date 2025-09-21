import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.error || error.message || 'An error occurred';
    return Promise.reject(new Error(message));
  }
);

export const explorerAPI = {
  // Network information
  getNetworkInfo: () => api.get('/network'),
  
  // Blocks
  getBlocks: (page = 1, limit = 20) => api.get('/blocks', { params: { page, limit } }),
  getBlock: (identifier, includeTx = false) => api.get(`/block/${identifier}`, { 
    params: { include_tx: includeTx } 
  }),
  
  // Transactions
  getTransaction: (txid) => api.get(`/transaction/${txid}`),
  
  // Address
  getAddress: (address) => api.get(`/address/${address}`),
  
  // Mempool
  getMempool: (page = 1, limit = 20) => api.get('/mempool', { params: { page, limit } }),
  
  // Search
  search: (query) => api.get(`/search/${encodeURIComponent(query)}`),
  
  // Statistics
  getStats: () => api.get('/stats'),
};

export default api;