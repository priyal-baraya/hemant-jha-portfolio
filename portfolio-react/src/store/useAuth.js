import { useDispatch, useSelector } from 'react-redux';
import {
  login as loginThunk,
  register as registerThunk,
  googleLogin as googleLoginThunk,
  logout as logoutAction,
} from './authSlice';

/**
 * Thin hook that exposes the Redux auth state with the same API the app
 * already used under the old Context (`{ user, token, loading, login, register, logout }`).
 * Components read state via useSelector and dispatch thunks under the hood.
 */
export function useAuth() {
  const dispatch = useDispatch();
  const { user, token, loading } = useSelector((state) => state.auth);

  // Return the user object (or throw) so callers can keep using `await login(...)`.
  const login = async (email, password) => {
    const result = await dispatch(loginThunk({ email, password }));
    if (loginThunk.rejected.match(result)) {
      throw new Error(result.payload || 'Login failed');
    }
    return result.payload.user;
  };

  const register = async (username, email, password) => {
    const result = await dispatch(registerThunk({ username, email, password }));
    if (registerThunk.rejected.match(result)) {
      throw new Error(result.payload || 'Registration failed');
    }
    return result.payload.user;
  };

  // credential = the Google ID token string from Google Identity Services
  const googleLogin = async (credential) => {
    const result = await dispatch(googleLoginThunk(credential));
    if (googleLoginThunk.rejected.match(result)) {
      throw new Error(result.payload || 'Google login failed');
    }
    return result.payload.user;
  };

  const logout = () => dispatch(logoutAction());

  return { user, token, loading, login, register, googleLogin, logout };
}
