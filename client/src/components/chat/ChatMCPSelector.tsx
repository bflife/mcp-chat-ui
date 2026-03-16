import * as React from "react";
import {
  ShieldCheck,
  ServerCog,
  Stethoscope,
  Wrench,
  Workflow,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "../ui/checkbox";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { ScrollArea } from "../ui/scroll-area";
import type {
  MCPServerDescriptor,
  MCPServerDiagnostics,
  MCPToolDescriptor,
} from "@/store/slices/chatSessionSlice";

export const LOCAL_STORAGE_KEY = "externalMCPServers";

interface Props {
  servers: MCPServerDescriptor[];
  diagnostics: Record<string, MCPServerDiagnostics>;
  onSelectionChange?: (ids: string[]) => void;
  onRefreshDiagnostics?: (ids: string[]) => void;
}

const CATEGORY_META = {
  system: {
    label: "系统诊断",
    icon: <Stethoscope className="h-4 w-4" />,
  },
  generic: {
    label: "通用调用",
    icon: <Wrench className="h-4 w-4" />,
  },
  business: {
    label: "业务工具",
    icon: <Workflow className="h-4 w-4" />,
  },
};

const getSavedValues = () => {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
};

const getStatusBadge = (diagnostics?: MCPServerDiagnostics) => {
  if (!diagnostics) {
    return <Badge variant="outline">未检测</Badge>;
  }
  return diagnostics.status === "connected" ? (
    <Badge>已连接</Badge>
  ) : (
    <Badge variant="destructive">失败</Badge>
  );
};

const renderToolCard = (tool: MCPToolDescriptor) => {
  const properties = Object.keys(tool.inputSchema?.properties || {});
  const required = tool.inputSchema?.required || [];

  return (
    <Card key={tool.name} className="gap-3 py-4">
      <CardHeader className="px-4 pb-0">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-sm font-semibold">{tool.name}</CardTitle>
          <Badge variant="outline">{CATEGORY_META[tool.category].label}</Badge>
        </div>
        <div className="text-sm text-muted-foreground">{tool.description}</div>
      </CardHeader>
      <CardContent className="px-4 pt-0 text-xs text-muted-foreground space-y-2">
        <div className="flex flex-wrap gap-2">
          {properties.length > 0 ? (
            properties.map((property) => (
              <Badge key={property} variant="outline" className="font-normal">
                {property}
                {required.includes(property) ? " *" : ""}
              </Badge>
            ))
          ) : (
            <span>无入参</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export class MCPServersSelector extends React.Component<
  Props,
  { open: boolean; values: string[] }
> {
  constructor(props: Props) {
    super(props);
    this.state = {
      open: false,
      values: getSavedValues(),
    };
    this.setOpen = this.setOpen.bind(this);
    this.setValue = this.setValue.bind(this);
  }

  componentDidMount(): void {
    if (this.state.values.length > 0) {
      this.props.onSelectionChange?.(this.state.values);
      this.props.onRefreshDiagnostics?.(this.state.values);
    }
  }

  setOpen(open: boolean) {
    this.setState({ open });
  }

  setValue(value: string) {
    const existingValues = getSavedValues();
    const newValues = existingValues.includes(value)
      ? existingValues.filter((id: string) => id !== value)
      : [...existingValues, value];
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newValues));
    this.setState({ values: newValues });
    this.props.onSelectionChange?.(newValues);
    this.props.onRefreshDiagnostics?.(newValues);
  }

  render() {
    const { open } = this.state;
    const selectedServer = this.props.servers.find((server) =>
      this.state.values.includes(server.id)
    );
    const diagnostics = selectedServer
      ? this.props.diagnostics[selectedServer.id]
      : undefined;
    const groupedTools = (diagnostics?.tools || []).reduce(
      (acc, tool) => {
        acc[tool.category].push(tool);
        return acc;
      },
      {
        system: [] as MCPToolDescriptor[],
        generic: [] as MCPToolDescriptor[],
        business: [] as MCPToolDescriptor[],
      }
    );

    return (
      <div className="flex items-center gap-2">
        <Badge variant="outline">{this.state.values.length} 已选</Badge>
        <Popover open={open} onOpenChange={this.setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <ServerCog className="h-4 w-4" />
              MCP Servers
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[760px] p-0" align="center">
            <div className="grid grid-cols-[280px_1fr] divide-x">
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Server 选择器</div>
                    <div className="text-xs text-muted-foreground">
                      支持 stdio / streamable-http / sse
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      this.props.onRefreshDiagnostics?.(this.state.values)
                    }
                    disabled={this.state.values.length === 0}
                  >
                    Health Check
                  </Button>
                </div>
                <div className="space-y-2">
                  {this.props.servers.map((server) => (
                    <div
                      key={server.id}
                      onClick={() => this.setValue(server.id)}
                      className="rounded-lg border p-3 hover:bg-muted cursor-pointer space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Checkbox checked={this.state.values.includes(server.id)} />
                          <span className="font-medium text-sm">{server.title}</span>
                        </div>
                        {getStatusBadge(this.props.diagnostics[server.id])}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {server.description}
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <Badge variant="outline">{server.transport}</Badge>
                        {server.auth?.configured ? (
                          <Badge variant="outline">Bearer Token</Badge>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-4">
                {selectedServer ? (
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-lg font-semibold">{selectedServer.title}</div>
                        <div className="text-sm text-muted-foreground">
                          {selectedServer.url || selectedServer.command}
                        </div>
                      </div>
                      {getStatusBadge(diagnostics)}
                    </div>

                    <Card className="gap-3 py-4">
                      <CardHeader className="px-4 pb-0">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <ShieldCheck className="h-4 w-4" /> 连接与安全概览
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-4 pt-0 text-sm text-muted-foreground space-y-2">
                        <div>Transport: {selectedServer.transport}</div>
                        <div>
                          Auth: {selectedServer.auth?.configured ? "Bearer 已配置" : "无 / 未配置"}
                        </div>
                        <div>
                          检测耗时: {diagnostics ? `${diagnostics.latencyMs} ms` : "尚未检测"}
                        </div>
                        {diagnostics?.error ? (
                          <div className="text-destructive">错误: {diagnostics.error}</div>
                        ) : null}
                      </CardContent>
                    </Card>

                    <div className="space-y-3">
                      {(["system", "generic", "business"] as const).map((category) => (
                        <div key={category} className="space-y-2">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            {CATEGORY_META[category].icon}
                            {CATEGORY_META[category].label}
                            <Badge variant="outline">
                              {groupedTools[category].length}
                            </Badge>
                          </div>
                          <ScrollArea className="h-[140px] rounded-md border p-3">
                            <div className="space-y-2 pr-2">
                              {groupedTools[category].length > 0 ? (
                                groupedTools[category].map(renderToolCard)
                              ) : (
                                <div className="text-sm text-muted-foreground">
                                  暂无工具信息，请先执行 health check。
                                </div>
                              )}
                            </div>
                          </ScrollArea>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="h-full min-h-[420px] flex items-center justify-center text-sm text-muted-foreground">
                    请选择一个 MCP Server 查看工具面板、安全概览和诊断结果。
                  </div>
                )}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    );
  }
}
