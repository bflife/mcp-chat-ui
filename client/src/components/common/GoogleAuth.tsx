import React, { Component } from "react";
import type { ReactNode } from "react";
import { connect } from "react-redux";
import type { Dispatch } from "@reduxjs/toolkit";
import Config from "@/const";
import { clearProfile, setProfile } from "../../store/slices/profileSlice";
import { Card, CardContent, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import LoginPage from "./LoginPage";

const BASE_SERVER_URL =
  document.location.port === "5173" ? "http://localhost:3000" : "";
const GOOGLE_CLIENT_ID = Config.GOOGLE_CLIENT_ID;
const LOGIN_API_URL = Config.LOGIN_API_URL;
const LOGIN_ENABLED = Config.LOGIN_ENABLED;
const ACCESS_TOKEN_STORAGE_KEY = "accessToken";
const AUTH_MODE_STORAGE_KEY = "authMode";

const loadGoogleClient = () => {
  const scriptId = "google-identity-services";
  if (!document.getElementById(scriptId)) {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.id = scriptId;
    document.body.appendChild(script);
    return script;
  }
};

interface GoogleAuthProps {
  children: ReactNode;
  dispatch: Dispatch;
}

interface GoogleAuthState {
  idToken: string | null;
  accessToken: string | null;
  loading: boolean;
  loginLoading: boolean;
  loginError: string;
  accountInfo: {
    name?: string;
    email?: string;
    picture?: string;
  } | null;
  autoLoginTried: boolean;
}

type TokenRefreshTimer = ReturnType<typeof setTimeout> | null;

class GoogleAuth extends Component<GoogleAuthProps, GoogleAuthState> {
  refreshTimer: TokenRefreshTimer = null;
  tokenExpiresAt: number | null = null;
  tokenClient: unknown = null;
  loginTries: number = 0;

  constructor(props: GoogleAuthProps) {
    super(props);
    this.state = {
      idToken: null,
      accessToken: null,
      loading: true,
      loginLoading: false,
      loginError: "",
      accountInfo: null,
      autoLoginTried: false,
    };
    this.tryAutoLogin = this.tryAutoLogin.bind(this);
    this.verifyToken = this.verifyToken.bind(this);
    this.handleLogin = this.handleLogin.bind(this);
    this.handlePasswordLogin = this.handlePasswordLogin.bind(this);
    this.handleLogout = this.handleLogout.bind(this);
    this.scheduleTokenRefresh = this.scheduleTokenRefresh.bind(this);
    this.clearTokenRefresh = this.clearTokenRefresh.bind(this);
    this.refreshToken = this.refreshToken.bind(this);
  }

  componentDidMount() {
    const storedAccessToken = localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
    const authMode = localStorage.getItem(AUTH_MODE_STORAGE_KEY);
    if (storedAccessToken && authMode === "password") {
      this.setState({
        accessToken: storedAccessToken,
        loading: false,
      });
      this.props.dispatch(
        setProfile({
          name: "Password User",
          email: "",
          picture: "",
          googleIdToken: "",
          accessToken: storedAccessToken,
          authType: "password",
          noAuth: false,
        })
      );
      return;
    }

    const stored = localStorage.getItem("googleIdToken");
    if (stored && GOOGLE_CLIENT_ID) {
      this.verifyToken(stored);
    } else if (GOOGLE_CLIENT_ID) {
      if (!this.state.autoLoginTried) {
        this.setState({ autoLoginTried: true }, () => {
          const scriptId = "google-identity-services";
          if (!document.getElementById(scriptId)) {
            const script = loadGoogleClient();
            if (script) {
              script.onload = this.tryAutoLogin;
            }
          } else {
            this.tryAutoLogin();
          }
        });
      } else {
        this.setState({ loading: false });
      }
    } else {
      this.setState({ loading: false });
    }
  }

  componentWillUnmount() {
    this.clearTokenRefresh();
  }

  componentDidUpdate(_prevProps: GoogleAuthProps, prevState: GoogleAuthState) {
    if (
      this.state.accountInfo &&
      this.state.accountInfo.name &&
      this.state.accountInfo.email &&
      (this.state.accountInfo !== prevState.accountInfo ||
        this.state.idToken !== prevState.idToken)
    ) {
      this.props.dispatch(
        setProfile({
          name: this.state.accountInfo.name,
          email: this.state.accountInfo.email,
          picture: this.state.accountInfo.picture || "",
          googleIdToken: this.state.idToken || "",
          accessToken: "",
          authType: "google",
          noAuth: false,
        })
      );
    }
    if (this.state.idToken && this.state.idToken !== prevState.idToken) {
      this.scheduleTokenRefresh(this.state.idToken);
    }
    if (!this.state.idToken && prevState.idToken) {
      this.clearTokenRefresh();
    }
  }

  tryAutoLogin() {
    if (window.google && window.google.accounts && window.google.accounts.id) {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response: { credential: string }): void => {
          if (response.credential) {
            this.setState({ loading: true });
            this.verifyToken(response.credential);
          } else {
            this.setState({ loading: false });
          }
        },
        auto_select: true,
        cancel_on_tap_outside: false,
      });
      window.google.accounts.id.prompt(
        (notification: {
          isNotDisplayed: () => boolean;
          isSkippedMoment: () => boolean;
        }) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            this.setState({ loading: false });
          }
        }
      );
    } else {
      setTimeout(this.tryAutoLogin, 50);
    }
  }

  verifyToken(token: string) {
    const payload = token.split(".")[1];
    let exp = null;
    if (payload) {
      try {
        const decoded = JSON.parse(
          atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
        );
        if (decoded.exp) {
          exp = decoded.exp * 1000;
          const now = Date.now();
          if (exp - now < 10000) {
            this.refreshToken();
            return;
          }
        }
      } catch {
        // ignore decode errors
      }
    }

    fetch(BASE_SERVER_URL + "/auth/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_token: token }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          this.setState({ idToken: token, accessToken: null });
          localStorage.setItem("googleIdToken", token);
          localStorage.setItem(AUTH_MODE_STORAGE_KEY, "google");
          localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
          const googlePayload = token.split(".")[1];
          if (googlePayload) {
            try {
              const decoded = JSON.parse(
                atob(googlePayload.replace(/-/g, "+").replace(/_/g, "/"))
              );
              this.setState({ accountInfo: decoded });
              if (decoded.exp) {
                this.tokenExpiresAt = decoded.exp * 1000;
                this.scheduleTokenRefresh(token);
              }
            } catch {
              this.setState({ accountInfo: null });
            }
          }
        } else {
          this.setState({ idToken: null, accountInfo: null, loading: false });
          localStorage.removeItem("googleIdToken");
        }
        this.setState({ loading: false });
      })
      .catch(() => {
        this.loginTries += 1;
        if (this.loginTries < 3) {
          this.loginTries += 1;
          this.setState({ loading: true });
          setTimeout(() => {
            this.verifyToken(token);
          }, 2000);
        } else {
          this.setState({ idToken: null, accountInfo: null, loading: false });
          localStorage.removeItem("googleIdToken");
        }
      });
  }

  async handlePasswordLogin(payload: {
    username: string;
    password: string;
    grantType: string;
    scope: string;
    clientId: string;
    clientSecret: string;
  }) {
    this.setState({ loginLoading: true, loginError: "" });
    try {
      const formData = new URLSearchParams();
      formData.set("grant_type", payload.grantType);
      formData.set("username", payload.username);
      formData.set("password", payload.password);
      formData.set("scope", payload.scope);
      formData.set("client_id", payload.clientId);
      formData.set("client_secret", payload.clientSecret);

      const response = await fetch(LOGIN_API_URL, {
        method: "POST",
        headers: {
          accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      });

      const data = await response.json();
      if (!response.ok || !data.access_token) {
        throw new Error(data.detail || data.message || "登录失败");
      }

      localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, data.access_token);
      localStorage.setItem(AUTH_MODE_STORAGE_KEY, "password");
      localStorage.removeItem("googleIdToken");

      this.setState({
        accessToken: data.access_token,
        idToken: null,
        accountInfo: {
          name: payload.username,
          email: "",
          picture: "",
        },
        loading: false,
        loginLoading: false,
        loginError: "",
      });

      this.props.dispatch(
        setProfile({
          name: payload.username,
          email: "",
          picture: "",
          googleIdToken: "",
          accessToken: data.access_token,
          authType: "password",
          noAuth: false,
        })
      );
    } catch (error: any) {
      this.setState({
        loginLoading: false,
        loading: false,
        loginError: error?.message || "登录失败",
      });
    }
  }

  scheduleTokenRefresh(token: string) {
    this.clearTokenRefresh();
    let exp = null;
    try {
      const payload = token.split(".")[1];
      if (payload) {
        const decoded = JSON.parse(
          atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
        );
        if (decoded.exp) {
          exp = decoded.exp * 1000;
        }
      }
    } catch {
      //
    }
    if (!exp) return;
    const now = Date.now();
    const msToExpiry = exp - now;
    const refreshIn = Math.max(msToExpiry - 60 * 1000, 10 * 1000);
    this.refreshTimer = setTimeout(this.refreshToken, refreshIn);
    this.tokenExpiresAt = exp;
  }

  clearTokenRefresh() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    this.tokenExpiresAt = null;
  }

  refreshToken() {
    if (!window.google) {
      loadGoogleClient();
    }
    if (window.google && window.google.accounts && window.google.accounts.id) {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response: { credential: string }): void => {
          if (response.credential) {
            this.setState({ loading: true });
            this.verifyToken(response.credential);
          } else {
            this.handleLogout();
          }
        },
        auto_select: true,
        cancel_on_tap_outside: false,
      });
      window.google.accounts.id.prompt(
        (notification: {
          isNotDisplayed: () => boolean;
          isSkippedMoment: () => boolean;
        }) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            this.handleLogout();
          }
        }
      );
    } else {
      setTimeout(this.refreshToken, 1000);
    }
  }

  handleLogin(token: string) {
    this.setState({ loading: true });
    this.verifyToken(token);
  }

  handleLogout() {
    if (window.google && window.google.accounts && window.google.accounts.id) {
      window.google.accounts.id.disableAutoSelect();
      window.google.accounts.id.cancel();
    }
    this.clearTokenRefresh();
    this.setState({
      idToken: null,
      accessToken: null,
      accountInfo: null,
      loginError: "",
    });
    localStorage.removeItem("googleIdToken");
    localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    localStorage.removeItem(AUTH_MODE_STORAGE_KEY);
    this.props.dispatch(clearProfile());
  }

  render() {
    const {
      loading,
      idToken,
      accessToken,
      accountInfo,
      loginLoading,
      loginError,
    } = this.state;
    const { children } = this.props;
    if (loading) {
      return (
        <div style={{ textAlign: "center", marginTop: "30vh" }}>Loading...</div>
      );
    }

    if (!idToken && !accessToken) {
      if (LOGIN_ENABLED && LOGIN_API_URL) {
        return (
          <LoginPage
            loginApiUrl={LOGIN_API_URL}
            loading={loginLoading}
            error={loginError}
            llmProvider={Config.LLM_PROVIDER}
            defaultModel={Config.DEFAULT_MODEL}
            ollamaBaseUrl={Config.OLLAMA_BASE_URL}
            onSubmit={this.handlePasswordLogin}
          />
        );
      }
      if (GOOGLE_CLIENT_ID) {
        return <GoogleLogin onLogin={this.handleLogin} />;
      }
    }

    return (
      <>
        {typeof children === "object"
          ? React.cloneElement(children as any, {
              handleLogout: this.handleLogout,
              googleIdToken: idToken || accessToken || "",
              googleAccountProfile: accountInfo,
            })
          : children}
      </>
    );
  }
}

class GoogleLogin extends Component<{ onLogin: (token: string) => void }> {
  componentDidMount() {
    loadGoogleClient();
    this.renderButton();
  }

  renderButton = () => {
    if (window.google && window.google.accounts && window.google.accounts.id) {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response: { credential: string }): void => {
          if (response.credential) {
            this.props.onLogin(response.credential);
          }
        },
      });
      window.google.accounts.id.renderButton(
        document.getElementById("google-signin-btn"),
        {
          theme: document.documentElement.classList.contains("dark")
            ? "filled_black"
            : "",
          size: "large",
          text: "continue_with",
          shape: "pill",
          width: 240,
        }
      );
    } else {
      setTimeout(this.renderButton, 50);
    }
  };

  render() {
    return (
      <Card className="absolute left-1/2 top-1/2 min-w-[320px] -translate-x-1/2 -translate-y-1/2 p-6 border-1 flex flex-col items-center justify-center gap-4">
        <CardTitle className="text-2xl">Chat MCP</CardTitle>
        <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
          <Badge variant="outline">{Config.LLM_PROVIDER || "ollama"}</Badge>
          <span>{Config.DEFAULT_MODEL || "ollama/llama3.1"}</span>
        </div>
        <CardContent className="flex flex-col items-center justify-center gap-3">
          <div id="google-signin-btn" />
          {(Config.LLM_PROVIDER || "ollama").toLowerCase() === "ollama" ? (
            <div className="max-w-[320px] text-center text-xs text-muted-foreground break-all">
              Ollama 地址：{Config.OLLAMA_BASE_URL || "http://127.0.0.1:11434/v1"}
            </div>
          ) : null}
        </CardContent>
      </Card>
    );
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({ dispatch });
const ConnectedGoogleAuth = connect(null, mapDispatchToProps)(GoogleAuth);
export { ConnectedGoogleAuth as GoogleAuth };
