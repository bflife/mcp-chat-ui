import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import Config from "@/const";

export interface ProfileState {
  name: string;
  email: string;
  picture: string;
  googleIdToken: string;
  accessToken: string;
  authType: "google" | "password" | "none";
  noAuth: boolean;
}

const initialState: ProfileState = {
  name: "",
  email: "",
  picture: "",
  googleIdToken: "",
  accessToken: "",
  authType: "none",
  noAuth: Config.GOOGLE_CLIENT_ID || Config.LOGIN_ENABLED ? false : true,
};

const profileSlice = createSlice({
  name: "profile",
  initialState,
  reducers: {
    setProfile(state, action: PayloadAction<ProfileState>) {
      state.name = action.payload.name;
      state.email = action.payload.email;
      state.picture = action.payload.picture;
      state.googleIdToken = action.payload.googleIdToken;
      state.accessToken = action.payload.accessToken;
      state.authType = action.payload.authType;
      state.noAuth = action.payload.noAuth;
    },
    clearProfile(state) {
      state.name = "";
      state.email = "";
      state.picture = "";
      state.googleIdToken = "";
      state.accessToken = "";
      state.authType = "none";
      state.noAuth = Config.GOOGLE_CLIENT_ID || Config.LOGIN_ENABLED ? false : true;
    },
    setName(state, action: PayloadAction<string>) {
      state.name = action.payload;
    },
    setEmail(state, action: PayloadAction<string>) {
      state.email = action.payload;
    },
  },
});

export const { setProfile, clearProfile, setName, setEmail } = profileSlice.actions;
export default profileSlice.reducer;
