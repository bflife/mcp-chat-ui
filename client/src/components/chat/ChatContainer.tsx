import React, { Component } from "react";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { connect } from "react-redux";
import type { RootState } from "@/store";
import type { ProfileState } from "@/store/slices/profileSlice";

import ChatPromptTemplate from "./ChatPromptTemplate";
import { Bot, BoxIcon } from "lucide-react";
import { MCPServersSelector } from "./ChatMCPSelector";
import type {
  MCPServerDescriptor,
  MCPServerDiagnostics,
} from "@/store/slices/chatSessionSlice";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

interface ChatContainerProps {
  children: React.ReactNode;
  handleLogout?: () => void;
  tokens?: number;
  profile: ProfileState;
  onPromptSelected: (value: string) => void;
  mcpServers: MCPServerDescriptor[];
  mcpDiagnostics: Record<string, MCPServerDiagnostics>;
  onMcpSelectionChange?: (ids: string[]) => void;
  onRefreshDiagnostics?: (ids: string[]) => void;
  supportedModels: string[];
  selectedModel: string;
  llmProvider: string;
  onModelChange?: (model: string) => void;
}

class ChatContainer extends Component<ChatContainerProps> {
  render() {
    const { name, email, picture } = this.props.profile;
    return (
      <Card className="w-full h-full mx-0 mt-0 bg-background p-3 border-0">
        <CardHeader>
          <CardTitle className="text-2xl flex flex-wrap items-center gap-4">
            Chat MCP
            <div className="flex-1 flex justify-center flex-wrap gap-3">
              {this.props.mcpServers && this.props.mcpServers.length > 0 ? (
                <div className="flex items-center gap-1 border-0 text-muted-foreground cursor-pointer">
                  <MCPServersSelector
                    servers={this.props.mcpServers || []}
                    diagnostics={this.props.mcpDiagnostics}
                    onSelectionChange={this.props.onMcpSelectionChange}
                    onRefreshDiagnostics={this.props.onRefreshDiagnostics}
                  />
                </div>
              ) : null}
              {this.props.supportedModels.length > 0 ? (
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4 text-muted-foreground" />
                  <Select
                    value={this.props.selectedModel}
                    onValueChange={this.props.onModelChange}
                  >
                    <SelectTrigger className="w-[240px]">
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      {this.props.supportedModels.map((model) => (
                        <SelectItem key={model} value={model}>
                          {model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Label className="text-xs text-muted-foreground">
                    {this.props.llmProvider}
                  </Label>
                </div>
              ) : null}
              <ChatPromptTemplate
                onPromptSelected={this.props.onPromptSelected}
              />
              {typeof this.props.tokens !== "undefined" &&
                this.props.tokens > 0 && (
                  <div className="flex items-center gap-1 border-0 text-muted-foreground">
                    <Label>
                      <BoxIcon /> {this.props.tokens}K
                    </Label>
                  </div>
                )}
            </div>
          </CardTitle>
          {this.props.handleLogout && (
            <CardAction className="text-sm text-muted-foreground flex items-center gap-3 w-full justify-between">
              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={this.props.handleLogout}>
                  Logout
                </Button>
                <Avatar title={`Google Account: ${name} <${email}>`}>
                  <AvatarImage src={picture} />
                  <AvatarFallback>
                    {name
                      .split(" ")
                      .map((n) => n[0])
                      .join("") || "U"}
                  </AvatarFallback>
                </Avatar>
              </div>
            </CardAction>
          )}
        </CardHeader>
        <CardContent className="noborder">{this.props.children}</CardContent>
      </Card>
    );
  }
}

const mapStateToProps = (state: RootState) => ({
  profile: state.profile,
  mcpServers: state.chatSession.mcpServers,
  mcpDiagnostics: state.chatSession.mcpDiagnostics,
  supportedModels: state.chatSession.supportedModels,
  selectedModel: state.chatSession.selectedModel,
  llmProvider: state.chatSession.llmProvider,
});

export default connect(mapStateToProps)(ChatContainer);
