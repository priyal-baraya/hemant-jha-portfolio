import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import './index.css'
import App from './App.jsx'
import { store } from './store'
import { verifyToken } from './store/authSlice'

// Verify any stored token once on app load (replaces the old AuthProvider mount effect).
store.dispatch(verifyToken(store.getState().auth.token))

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </StrictMode>,
)
