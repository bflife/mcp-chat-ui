import { Component } from "react";
import ChatContainer from "./ChatContainer";
import ChatList from "./ChatList";
import { ChatInput } from "./ChatInput";
import { ScrollArea } from "@/components/ui/scroll-area";
import { WebSocketSessionClient } from "@/lib/ws_client";
import { connect } from "react-redux";
import type { Dispatch } from "@reduxjs/toolkit";
import type { RootState } from "@/store";
import {
  showToolResponse,
  type ChatItem,
  type MCPServerDiagnostics,
  type ToolCallLogEntry,
} from "@/store/slices/chatSessionSlice";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { ChatScrollToBottom } from "./ChatScrollToBottom";
import ChatToolResponse from "./ChatToolResponse";
import { LOCAL_STORAGE_KEY } from "./ChatMCPSelector";
import { parseJSON } from "@/lib/utils";
import { Badge } from "../ui/badge";
import { ScrollText, ShieldCheck } from "lucide-react";

interface ChatMainState {
  scroll: "auto" | "manual";
  brief: boolean;
}

interface ChatMainProps {
  handleLogout?: () => void;
  googleIdToken?: string | null;
  dispatch?: Dispatch;
  connected?: boolean;
  items?: ChatItem[];
  tokens?: number;
  sending?: boolean;
  username?: string;
  toolResponseId?: string;
  noAuth?: boolean;
  mcpDiagnostics?: Record<string, MCPServerDiagnostics>;
  toolCallLog?: ToolCallLogEntry[];
}

class ChatMain extends Component<ChatMainProps, ChatMainState> {
  chatSession: WebSocketSessionClient | null = null;
  inScroll: boolean = false;
  scrollInterval: NodeJS.Timeout | null = null;
  manualScroll: boolean = false;

  state: ChatMainState = {
    brief: true,
    scroll: "auto",
  };

  componentDidMount(): void {
    if (!this.chatSession) {
      this.chatSession = new WebSocketSessionClient(
        this.props.googleIdToken || "",
        this.props.dispatch!
      );
      this.chatSession.onUpdate = () => {
        this.pushScrollToBottom(true);
      };
      document.body.addEventListener("keydown", this.onF1.bind(this));

      const selected = parseJSON(localStorage.getItem(LOCAL_STORAGE_KEY) || "[]");
      this.chatSession.setMCPServers(Array.isArray(selected) ? selected : []);
      if (Array.isArray(selected) && selected.length > 0) {
        this.chatSession.requestMcpDiagnostics(selected);
      }
    }
  }

  onF1(e: KeyboardEvent) {
    if (e.key === "F1") {
      e.preventDefault();
      document.getElementById("btn-prompt-templates")?.click();
    }
    if (e.key === "F2") {
      e.preventDefault();
      document.getElementById("input-prompt")?.focus();
    }
  }

  handleSend = async (prompt: string) => {
    if (!prompt.trim()) return;
    this.setState({ brief: false });
    this.manualScroll = false;
    this.chatSession?.setMCPServers(
      parseJSON(localStorage.getItem(LOCAL_STORAGE_KEY) || "[]")
    );
    this.chatSession?.send(prompt);
  };

  handlePromptSelected = (value: string) => {
    if (!this.props.sending) {
      setTimeout(() => {
        this.handleSend(value);
      }, 0);
    }
  };

  componentDidUpdate(prevProps: Readonly<ChatMainProps>): void {
    if (
      prevProps.googleIdToken !== this.props.googleIdToken &&
      this.chatSession &&
      this.props.googleIdToken
    ) {
      this.chatSession.googleIdToken = this.props.googleIdToken;
    }
  }

  getScrollAreaDiv = () => {
    const scrollArea = document.getElementById("chat-scroll-area");
    const firstDiv = scrollArea?.querySelector("div");
    return firstDiv as HTMLDivElement | null;
  };

  pushScrollToBottom = (auto: boolean = false) => {
    if (auto && this.manualScroll) {
      return;
    }
    if (this.scrollInterval) {
      clearInterval(this.scrollInterval);
      this.scrollInterval = null;
    }
    this.scrollInterval = setTimeout(() => {
      this.manualScroll = false;
      if (this.state.scroll === "manual") {
        this.setState({ scroll: "auto" });
      }

      const firstDiv = this.getScrollAreaDiv();

      if (firstDiv) {
        this.inScroll = true;
        firstDiv.onscrollend = () => {
          this.inScroll = false;
          firstDiv.onscrollend = null;
          this.scrollInterval = null;
        };
        firstDiv.scrollTo({ top: firstDiv.scrollHeight, behavior: "smooth" });
      }
    }, 100);
  };

  handleFixErrors = (_index: number, errors: string[]) => {
    const uniqueErrors = Array.from(new Set(errors));
    this.handleSend(`Fix Errors: ${uniqueErrors.join(", ")}`);
  };

  handleMcpSelectionChange = (ids: string[]) => {
    this.chatSession?.setMCPServers(ids);
  };

  handleRefreshDiagnostics = (ids: string[]) => {
    this.chatSession?.requestMcpDiagnostics(ids);
  };

  renderDiagnosticsPanel() {
    const diagnostics = Object.entries(this.props.mcpDiagnostics || {});
    if (diagnostics.length === 0) {
      return null;
    }

    return (
      <Card className="mt-4 py-4 gap-3">
        <CardHeader className="px-4 pb-0">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> 安全策略与诊断总览
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pt-0 grid md:grid-cols-2 gap-3">
          {diagnostics.map(([serverId, diagnostic]) => (
            <div key={serverId} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium">{serverId}</div>
                <Badge variant={diagnostic.status === "connected" ? "default" : "destructive"}>
                  {diagnostic.status === "connected" ? "健康" : "异常"}
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                最近检测: {new Date(diagnostic.checkedAt).toLocaleTimeString()}
              </div>
              <div className="text-sm text-muted-foreground">
                延迟: {diagnostic.latencyMs} ms · 工具数: {diagnostic.tools.length}
              </div>
              {diagnostic.error ? (
                <div className="text-sm text-destructive">{diagnostic.error}</div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  已获取工具清单，可用于 health / security_policy / smoke_test 可视化。
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  renderToolLogPanel() {
    const log = this.props.toolCallLog || [];
    if (log.length === 0) {
      return null;
    }

    return (
      <Card className="mt-4 py-4 gap-3">
        <CardHeader className="px-4 pb-0">
          <CardTitle className="text-base flex items-center gap-2">
            <ScrollText className="h-4 w-4" /> Tool Call 日志
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pt-0 space-y-2 max-h-[240px] overflow-auto">
          {log.slice(0, 10).map((entry) => (
            <div key={entry.id} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium text-sm">{entry.tool}</div>
                <div className="flex items-center gap-2">
                  {typeof entry.success === "boolean" ? (
                    <Badge variant={entry.success ? "default" : "destructive"}>
                      {entry.success ? "成功" : "失败"}
                    </Badge>
                  ) : (
                    <Badge variant="outline">执行中</Badge>
                  )}
                  {entry.runtime ? <Badge variant="outline">{entry.runtime}s</Badge> : null}
                </div>
              </div>
              <div className="text-xs text-muted-foreground break-all">
                参数: {entry.args}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  render() {
    const brief = this.state.brief;
    return (
      <ChatContainer
        handleLogout={this.props.noAuth ? undefined : this.props.handleLogout}
        tokens={this.props.tokens}
        onPromptSelected={this.handlePromptSelected}
        onMcpSelectionChange={this.handleMcpSelectionChange}
        onRefreshDiagnostics={this.handleRefreshDiagnostics}
      >
        {!brief ? (
          <ScrollArea
            className="h-[77.3vh] w-full rounded-md p-0 pr-5 border-0 overflow-auto"
            id="chat-scroll-area"
            onScroll={this.onScroll.bind(this)}
            style={{ overflow: "auto" }}
          >
            <ChatList
              sending={this.props.sending}
              onFixErrors={this.handleFixErrors}
            />
            {this.state.scroll === "manual" && (
              <ChatScrollToBottom
                onClick={() => this.pushScrollToBottom(false)}
              />
            )}
          </ScrollArea>
        ) : (
          <div className="text-center text-muted-foreground h-[30vh] flex items-end justify-center">
            <CardTitle className="text-4xl font-light mb-12 text-center">
              {this.props.username
                ? `Welcome, ${this.props.username}. Let's get started.`
                : "Hey, there. Ready to dive in?"}
            </CardTitle>
          </div>
        )}
        <div
          className={`${
            brief ? "w-[50vw] min-w-[700px]" : ""
          } center mx-auto mt-4`}
        >
          <ChatInput
            onSend={this.handleSend}
            brief={brief}
            disabled={this.props.sending === true}
          />
        </div>
        {!brief && (
          <div className="grid xl:grid-cols-2 gap-4 mt-4">
            {this.renderDiagnosticsPanel()}
            {this.renderToolLogPanel()}
          </div>
        )}
        {brief && (
          <div className="text-center text-muted-foreground h-[41vh] flex items-center justify-center"></div>
        )}
        {this.props.toolResponseId && (
          <ChatToolResponse
            tool={
              this.chatSession?.toolCallResults[this.props.toolResponseId] || {
                tool: "Unknown",
                text: "Unknown",
                type: "Unknown",
                args: "Unknown",
                items: [],
              }
            }
            open={true}
            onClose={() => {
              this.props.dispatch!(showToolResponse(""));
            }}
          />
        )}
      </ChatContainer>
    );
  }

  onScroll() {
    if (this.inScroll) return;

    if (this.scrollInterval) {
      clearInterval(this.scrollInterval);
      this.scrollInterval = null;
    }

    this.manualScroll = true;
    const firstDiv = this.getScrollAreaDiv();

    if (
      Math.abs(
        firstDiv!.scrollTop - (firstDiv!.scrollHeight - firstDiv!.clientHeight)
      ) < 5
    ) {
      this.manualScroll = false;
    }

    const scrollState = this.manualScroll ? "manual" : "auto";

    if (this.state.scroll !== scrollState) {
      this.setState({ scroll: scrollState });
    }
  }
}

const mapStateToProps = (state: RootState) => ({
  googleIdToken: state.profile.googleIdToken,
  connected: state.chatSession.connected,
  tokens: state.chatSession.tokens,
  sending: state.chatSession.sending,
  username: state.profile.name.split(" ")[0] || "",
  toolResponseId: state.chatSession.toolResponseId || "",
  noAuth: state.profile.noAuth,
  mcpDiagnostics: state.chatSession.mcpDiagnostics,
  toolCallLog: state.chatSession.toolCallLog,
});

export default connect(mapStateToProps)(ChatMain);
