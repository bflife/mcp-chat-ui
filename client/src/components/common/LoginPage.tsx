import { Component } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";

interface LoginPageProps {
  loginApiUrl: string;
  loading?: boolean;
  error?: string;
  llmProvider?: string;
  defaultModel?: string;
  ollamaBaseUrl?: string;
  onSubmit: (payload: {
    username: string;
    password: string;
    grantType: string;
    scope: string;
    clientId: string;
    clientSecret: string;
  }) => void;
}

interface LoginPageState {
  username: string;
  password: string;
  grantType: string;
  scope: string;
  clientId: string;
  clientSecret: string;
}

class LoginPage extends Component<LoginPageProps, LoginPageState> {
  state: LoginPageState = {
    username: "admin",
    password: "admin123",
    grantType: "password",
    scope: "",
    clientId: "string",
    clientSecret: "string",
  };

  handleChange = (field: keyof LoginPageState) => (event: ChangeEvent<HTMLInputElement>) => {
    this.setState({ [field]: event.target.value } as Pick<LoginPageState, keyof LoginPageState>);
  };

  handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    this.props.onSubmit({
      username: this.state.username,
      password: this.state.password,
      grantType: this.state.grantType,
      scope: this.state.scope,
      clientId: this.state.clientId,
      clientSecret: this.state.clientSecret,
    });
  };

  render() {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-xl py-6">
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-2xl">MCP Chat 登录</CardTitle>
              <Badge variant="outline">Password Login</Badge>
            </div>
            <div className="space-y-1 text-sm text-muted-foreground">
              <div className="break-all">登录接口：{this.props.loginApiUrl}</div>
              <div>默认模型提供方：{this.props.llmProvider || "ollama"}</div>
              <div>默认模型：{this.props.defaultModel || "ollama/llama3.1"}</div>
              {(this.props.llmProvider || "ollama").toLowerCase() === "ollama" ? (
                <div className="break-all">Ollama 地址：{this.props.ollamaBaseUrl || "http://127.0.0.1:11434/v1"}</div>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={this.handleSubmit}>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="username">用户名</Label>
                  <Input id="username" value={this.state.username} onChange={this.handleChange("username")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">密码</Label>
                  <Input id="password" type="password" value={this.state.password} onChange={this.handleChange("password")} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="grantType">grant_type</Label>
                  <Input id="grantType" value={this.state.grantType} onChange={this.handleChange("grantType")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="scope">scope</Label>
                  <Input id="scope" value={this.state.scope} onChange={this.handleChange("scope")} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="clientId">client_id</Label>
                  <Input id="clientId" value={this.state.clientId} onChange={this.handleChange("clientId")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientSecret">client_secret</Label>
                  <Input id="clientSecret" value={this.state.clientSecret} onChange={this.handleChange("clientSecret")} />
                </div>
              </div>

              {this.props.error ? (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                  {this.props.error}
                </div>
              ) : null}

              <Button type="submit" className="w-full" disabled={this.props.loading}>
                {this.props.loading ? "登录中..." : "登录并进入 Chat"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }
}

export default LoginPage;
