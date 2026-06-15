import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

// ─── Async thunks ───────────────────────────────────────────────────────────
// Each thunk talks to the backend and returns the user object on success.
// createAsyncThunk auto-generates pending/fulfilled/rejected actions so the
// reducer can track loading and surface errors.

// Verify a stored token on app load → returns the user, or rejects.
export const verifyToken = createAsyncThunk(
  'auth/verifyToken',
  async (token, { rejectWithValue }) => {
    if (!token) return rejectWithValue('No token');
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return rejectWithValue('Invalid token');
    return await res.json();
  }
);

export const login = createAsyncThunk(
  'auth/login',
  async ({ email, password }, { rejectWithValue }) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) return rejectWithValue(data.error || 'Login failed');
    localStorage.setItem('authToken', data.token);
    return data; // { token, user }
  }
);

// Exchange a Google ID token (from Google Identity Services) for our own JWT.
export const googleLogin = createAsyncThunk(
  'auth/googleLogin',
  async (credential, { rejectWithValue }) => {
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential }),
    });
    const data = await res.json();
    if (!res.ok) return rejectWithValue(data.error || 'Google login failed');
    localStorage.setItem('authToken', data.token);
    return data; // { token, user }
  }
);

export const register = createAsyncThunk(
  'auth/register',
  async ({ username, email, password }, { rejectWithValue }) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    });
    const data = await res.json();
    if (!res.ok) return rejectWithValue(data.error || 'Registration failed');
    localStorage.setItem('authToken', data.token);
    return data; // { token, user }
  }
);

// ─── Slice ──────────────────────────────────────────────────────────────────
const initialState = {
  user: null,
  token: localStorage.getItem('authToken') || '',
  loading: true, // true until the initial verifyToken settles
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout(state) {
      localStorage.removeItem('authToken');
      state.user = null;
      state.token = '';
    },
  },
  extraReducers: (builder) => {
    builder
      // verifyToken
      .addCase(verifyToken.fulfilled, (state, action) => {
        state.user = action.payload;
        state.loading = false;
      })
      .addCase(verifyToken.rejected, (state) => {
        localStorage.removeItem('authToken');
        state.user = null;
        state.token = '';
        state.loading = false;
      })
      // login + register share the same fulfilled shape
      .addCase(login.fulfilled, (state, action) => {
        state.token = action.payload.token;
        state.user = action.payload.user;
      })
      .addCase(register.fulfilled, (state, action) => {
        state.token = action.payload.token;
        state.user = action.payload.user;
      })
      .addCase(googleLogin.fulfilled, (state, action) => {
        state.token = action.payload.token;
        state.user = action.payload.user;
      });
  },
});

export const { logout } = authSlice.actions;
export default authSlice.reducer;
