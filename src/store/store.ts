import { configureStore } from '@reduxjs/toolkit';
import approvalReducer from './approvalSlice';

export function createAppStore() {
  return configureStore({
    reducer: {
      approval: approvalReducer,
    },
  });
}

export const store = createAppStore();

export type AppStore = ReturnType<typeof createAppStore>;
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
